# Making a part draw what it claims

The plan for closing the violations `npm run parts:check` reports — 82 when this was written, 139 after the standard was sharpened, 137 once the first shell was drawn — and for the re-verification that owes.

This is scoped to part geometry. `part-model.md` owns how a part is organised and declared; this document owns the gap between that declaration and what gets drawn, and the order in which it closes.

## The problem, measured

Every pixelwise number this project reports — containment, stroke recall, anchor registration, the 0.00328 placement margin at printed step 6 — compares a render of a catalog part against a printed booklet panel. None of those numbers is better than the geometry underneath them, and the geometry was never checked.

`InstructionSurface` is `"body" | "stud"`. Two surfaces: a solid body, and cylinders on top. There is no underside, cavity, wall or tube anywhere in the render pipeline, and `undersideMode` — which 69 parts declare — is consumed by nothing outside the catalog package. It is not a switch that is off; there is no wire behind it.

*(As of 2026-08-09 the second half of that is no longer true, and the way it stopped being true is not the way this paragraph expected. `undersideMode` did not get wired to a renderer: it became a **report** of the body union, which the renderer already draws. See the shell section below. `InstructionSurface` is still `"body" | "stud"` and still needs no third member.)*

Printed steps 4 and 7 are underside panels. Panel 4's stud lattice fits 57 drawn tube rings, panel 7's fits 174, and both were scored against a flat rectangle. Step 4 was accepted on that comparison, so its placement is **not verified**, and step 6's margin sits on a prefix containing it.

`parts:check` reported 82 violations across 85 parts when this was written: 74 parts declaring underside clutches they never draw, and 8 declaring no geometry modes at all. Sharpening the standard with `body-is-hollow-where-it-clutches` took it to 139, and drawing the first shell to **137** — `underside-is-drawn` 73, `body-is-hollow-where-it-clutches` 56, `geometry-mode-is-declared` 8.

## The invariant

**A part draws what it claims.** A declaration the renderer cannot honour is a defect in the declaration, the renderer, or both — never something a part is quietly exempted from.

This is the same rule the editor already enforces on documents: a placement nothing would hold up is refused by the command that would create it. A part claiming clutches it does not model is that failure one layer down.

## The design

### One source of truth, four derivations

The catalog has two provenance routes today, and that split is exactly the 8 `geometry-mode-is-declared` violations: most parts are parametric prisms with declared modes, while 8 were admitted mesh-first and declare nothing — including the wing plate with 115 collision boxes where every generated plate has one.

Unify on the LDraw source, which this repository already bundles and already expands. `scripts/ldraw_surface_expander.py` produced the surface that pinned `3020;L`'s frame to 1.305568 LDU, so the machinery is proven on real parts.

The four layers, each derived from the one below:

1. **LDraw source** — the real part, bundled and digest-pinned. Truth.
2. **Expanded surface** — primitives resolved, transforms applied, triangles in LDU.
3. **Render geometry** — body, studs, and underside, decimated from that surface with a stated tolerance.
4. **Collision primitives** — a decomposition of the same surface, so collision and render can never disagree about where a part is.

Today layer 3 is invented parametrically and layer 4 is derived separately for 8 parts and parametrically for 77. That is why a stud radius could be `6.0001514980873605` in one layer and exactly 6 in another.

### No third surface kind — the seam already exists

This was the plan's original step and it is wrong, refuted by reading the renderer.

`geometry.ts` draws the body from `definition.collision.primitives`, every primitive tagged `body`, and says why in its own comment: *"The solid is drawn from the same body primitives the collision validator reads. Drawing it from `dimensions` instead would let a wedge look like the box it is not, and would let the picture and the solid drift apart in silence."*

So render geometry and collision geometry are already the same declaration. A plate is drawn as one filled box because `part-factory.ts` emits one filled box. Emit a **shell** instead — perimeter walls, a recessed ceiling, and tube cylinders at the seat positions — and the underside becomes real in the render and in the collision at the same moment, with no new surface kind, no new outline path, and no new material key.

The mechanism is already in the factory: `bodyBoxesLdu` takes a union of boxes and numbers them `body:0…body:n`, falling through to the single prism only when absent. That is also why the wing plate looks different from every other part — its 115 primitives are a voxelised solid being drawn literally, which is the same seam used badly.

This is a much smaller change than the plan assumed, and a much larger correctness win: it makes a part's drawn shape and its collidable shape the same object by construction, so they cannot disagree the way `studRadiusLdu` disagreed between layers.

`undersideMode` stops being semantics-only and becomes the generator's input: the seat grid it names supplies the tube positions.

### What stays parametric

A plate's body may remain a prism when the expanded surface proves it is one. The test is agreement, not provenance: a parametric body whose silhouette matches the LDraw surface from all seven canonical views within tolerance is a legitimate compression of it. A parametric body that does not match is a wrong part wearing a fast representation.

## Order of work

Each step ends with a number that must move, and the next does not start until it has.

**0 — Derive the shell's real dimensions from LDraw.** Wall thickness, ceiling depth and tube radius are not to be invented; `3020.dat` expands to the true surface and this repository already expands it. The number: those four dimensions, measured, with the file and line they came from. Nothing below starts until they are measured, because a shell built from plausible numbers is the same error as a prism built from none — it just looks more like a part.

### Step 0 result — measured from `scripts/ldraw-cache/3020.dat`

A Plate 2x4 is two nested `box5` shells plus studs and tubes, and every number below is read off that file rather than chosen.

| dimension | value | source |
|---|---|---|
| outer body | half-extents 40 x 20, height 8 | line 30, `1 16 0 8 0 40 0 0 0 -8 0 0 0 20 box5.dat` |
| cavity | half-extents 36 x 16, depth 4 | line 21, `1 16 0 8 0 36 0 0 0 -4 0 0 0 16 box5.dat` |
| wall thickness | **4 LDU**, both axes | 40 - 36 and 20 - 16 |
| ceiling thickness | **4 LDU** of the plate's 8 | 8 - 4 |
| underside tubes | 3, at x in {-20, 0, 20}, y 4, z 0 | lines 16-18, `stud4.dat` on the 20 lattice between stud columns |
| top studs | 8, `stud.dat` | eight `1 16 ... stud.dat` lines |

`box5` is a box with five faces - open on one side - which is precisely a shell, so LDraw already models the plate the way the standard demands and the catalog flattened it to a filled prism.

The clutch direction is measured too, not assumed: `plate-2x4` puts its studs at y -4 and its underside clutches at y +4, so the cavity opens toward **+Y** in catalog frame while studs sit at -Y. Catalog axes are swapped against LDraw's - catalog x is the 2-stud width and z the 4-stud length, LDraw the reverse - so the cavity is x half 16, z half 36, y 0..4, and the three tubes sit at z in {-20, 0, 20} with x 0, between the stud rows.

The tube's **inner radius is 6 LDU**, from `stud4od.dat` line 5, `4-4cylo.dat` scaled by 6. It equals the stud radius exactly, which is the clutch itself: an interference fit of a 6 LDU stud into a 6 LDU tube. That the two numbers must agree is now a fact with a file behind it rather than a coincidence.

**Correction, 2026-08-09: the tube's OUTER radius is measured, and the earlier "not yet measured" note was an incomplete search rather than a missing file.** `stud4.dat` itself is indeed absent from `scripts/ldraw-cache/`, but its fractions are not: `1-4stud4.dat` ("Stud Tube Open 0.25") is there and carries the whole profile. Line 13 places `1-4cylo.dat` scaled 6 - the inner wall, agreeing with `stud4od.dat` - and line 14 places `1-4cylo.dat` scaled **8**, which is the outer wall; line 15's `1-4ring3.dat` scaled 2 caps the annulus between radius 6 and 8 and corroborates both. `2-4stud4.dat` lines 19 and 20 say the same. The tube is 4 LDU tall, exactly the cavity depth.

So the tube is an annulus with inner radius **6** and outer radius **8** LDU, and the interference fit is at the wall rather than at the tube: a clutch centre on the 10 LDU half-pitch sits 10 x sqrt(2) = 14.142 LDU from the nearest tube centre, against 6 + 8 = 14, so LDraw's idealised tube clears the stud by 0.142 LDU while the cavity wall touches it exactly.

The lesson is the one this project keeps paying for: the absence was recorded honestly and then believed without re-searching. A blocker you inherited is a claim, not a fact.

### The obstacle step 3 must clear, found before writing any shell

`connector-backing-policy.ts` decides admission by asking *whether a whole stud's worth of the named face is backed by solid* — sampling the footprint and requiring a body box to reach it. That assumption holds only for a filled prism.

Emit a shell and the bottom face stops being solid exactly where the clutches are, so `faceHoldsStud("bottom", …)` fails and every `undersideClutch` on all 74 parts is refused. The policy is not wrong; it is right about a stud and silently wrong about a clutch, because the two want opposite things from the same face. A stud needs material behind it to push against. **A clutch needs a cavity** — a hole with a wall and a tube to grip — and material behind it is precisely what makes it impossible.

So step 3 is not "emit shells"; it is "teach backing what a clutch is, then emit shells". The order matters: shells first would refuse 74 parts' connectors and look like the shells were wrong.

This is worth stating as a general shape, because it is the fourth instance in this project: a check that is correct for the case it was written against and silently wrong for a case that arrives later. The stud radius, `isRealBuildBrowserOutput` answering two questions with one boolean, the ledger assertion checking a constant, and now backing. Each looked right in isolation.

### The obstacle is cleared, and the first shell is drawn — 2026-08-09

`faceHoldsStud` is unchanged and still answers only the stud question. Beside it, `cavityHoldsStud` answers the clutch question from the body union, and a clutch is admitted when either says yes — a strict widening, so no existing part's connectors moved. All three of its conditions come from the measurements above:

- **clearance** — no body box crosses the cylinder the incoming stud sweeps, which is exactly the volume the `tubeSeat` allowance already reserves;
- **grip** — some box standing in that band reaches the stud's own 6 LDU circle without crossing it. The range is zero because `3020.dat` makes it zero: cavity face at 16, clutch centre at 10, stud radius 6;
- **seat** — the cavity is roofed over the stud's footprint, so it bottoms out instead of passing through.

`undersideMode` is now derived from that predicate rather than declared, and gained the value `modelled-shell-cavity`. A part whose union fills its own cavity reverts to `semantic-tube-seat-grid` automatically, so the claim cannot outrun the geometry.

`builtin:plate-2x4` carries the measured shell — a ceiling slab and four walls, five boxes, no tubes. Its eight clutches and eight studs survive unchanged, `parts:check` drops from **139 violations to 137** (`underside-is-drawn` 74 → 73, `body-is-hollow-where-it-clutches` 57 → 56, `geometry-mode-is-declared` 8 → 8), and no other part changes in any field. Rendered from below it is a tray: a rim of four wall bottoms with the ceiling recessed 4 LDU inside it, against `plate-2x3`'s flat face at the same viewpoint.

*(Corrected 2026-08-09: that last sentence claims more than the picture it was read from. The straight-down orthographic capture shows the wall bottoms, the tube rings and the recessed ceiling as faces with one normal and one material, so it is one flat colour whatever is behind it — which is how a tube whose triangles were all wound backwards went unnoticed through a whole render pass. The cavity is only visible from an angle under the model; see the step 3 result.)*

**The tubes are deliberately absent from this first shell**, now for a stated reason rather than a missing number. `bodyBoxesLdu` takes boxes, and a tube is an annulus; drawing it as a solid box or a solid cylinder would fill its 6 LDU bore and replace one lie with another. Every clutch on this part is held by the walls alone, and the tubes' own contribution — the opposing grip at an interior seat — cannot be checked until the union can hold a hollow cylinder. Step 3 needs that before it reaches a part whose interior seats have no wall within reach.

**1 — Extend the standard.** Add the rules the current four do not cover: the render silhouette agrees with the expanded LDraw surface from all seven canonical views within a stated tolerance; `bodyBoundsLdu` equals the drawn extent; collision primitives cover the body and no more. Expect the violation count to *rise* above 82; a standard that finds less after being sharpened was not sharpened.

**2 — Build the underside surface for one part.** `plate-2x4`, because `3020;L` is already pinned and its LDraw expansion is already proven. Render it from below beside panel 4's art and read both. The number: its from-below silhouette agreement against the expanded surface, from nothing to within tolerance.

**3 — Generalise to the 74.** Drive it from `undersideMode` and the declared seat grid. The number: 74 `underside-is-drawn` violations to zero.

### Step 3 result — 137 violations to 24, and the tubes are drawn — 2026-08-09

`part-shell.ts` derives the shell from a part's own footprint rather than from anything authored per part: erode the footprint by the 4 LDU wall, roof it with the 4 LDU ceiling, and stand a tube at the centre of every complete 2 x 2 block of stud cells. Every number in it is read off an LDraw file with the file and line beside it, and a family whose own file nobody has read makes it throw rather than inherit a plate's numbers.

Fifty-eight of the eighty-five parts now draw that shell — every brick, plate, tile, jumper plate, grille tile, technic brick and the corner plate, wherever the body is a uniform-height prism. `parts:check` goes from **137 violations to 24**: `body-is-hollow-where-it-clutches` 56 to **0**, `underside-is-drawn` 73 to **16**, `geometry-mode-is-declared` 8 to 8. The 16 that remain are exactly the bodies this rule does not reach — a wedge's sloped prism, an arc's analytic plan, and the staircases an arch, a curved slope and a cheese slope are, whose bottom is not one plane. The 8 are step 4.

No connector moved. The reviewed Builder source pins say it in one number: of the fifteen designs pinned in `real-build-builder-sources.ts`, nine had their geometry and collision digests move and **not one had its connector digest move**.

Three defects were found in the generalisation, and all three were in the half nobody had looked at:

- **The tube's collision primitive cannot be a cylinder.** `collisions.ts` gives a body cylinder its bounding box — right for a wheel, which stands alone, and wrong for a tube, which sits between four studs 10 * sqrt(2) LDU away. Every exactly seated stack of two 2-wide parts reported `PART_STUD_BODY_COLLISION` against its own tubes, connection declared. It is now the largest axis-aligned box inside the tube circle, whose corners meet that circle exactly in the four directions the studs occupy.
- **The tube's 144 triangles were wound backwards**, so `FrontSide` culled all of them: the tubes were in the scene, counted by a passing test, and drew nothing. Found by rendering the underside and looking at it.
- **A shell's box decomposition is not canonical under rotation.** Sweeping x before z cuts a square plate's wall ring into two long boxes and two inset ones, a set no quarter turn maps onto itself, so the Builder frame self-symmetry proof called every square plate asymmetric and sent it to the surface witness. The proof now compares the volume the boxes occupy rather than the boxes, which is the question it meant to ask and the one that survives step 4 re-deriving bodies nobody chose by hand.

The pictures are the evidence and they were looked at: orbited under the model, a 2x4 plate is a tray with three tubes down its centre line, a 4x4 plate has the 3 x 3 grid `3031.dat` places, a 2x4 brick has a 20 LDU deep cavity with three full-height tubes standing in it, and a 1x4 plate has the tray and no tubes at all — the `stud3` pins `part-shell.ts` deliberately omits. The straight-down orthographic capture shows none of this and cannot: from directly below the wall bottoms, the tube rings and the recessed ceiling are all faces with one normal and one material, so the picture is flat whatever is behind it.

**4 — Re-derive the 8 mesh-first parts through the same path.** The number: 8 `geometry-mode-is-declared` violations to zero, and the wing plate's 115 collision boxes replaced by a decomposition of its own surface.

### Step 4 result — 16 violations, and the premise of its second half is refuted — 2026-08-09

**The first half is done: `geometry-mode-is-declared` is 8 to 0, and `parts:check` reports 24 to 16.**

Not by re-deriving those parts as parametric ones, which the owner decision of 2026-08-04 forbids — generated approximations were rejected because lost curve fidelity fails the measurement the goal is judged by. They already draw the expanded LDraw surface, which is the highest-fidelity geometry in this catalog. What they lacked was any way to *say* what they draw: `MeshReferenceGeometryRecipe` named no mode, so the standard could only report them as unverifiable.

`mesh-underside.ts` measures it instead. For each clutch a part declares, it finds the lowest horizontal body surface standing over that cell and answers **recessed** (the surface is above the part's own bottom face), **open** (nothing stands there at all), or **flat** (the part is solid under its own clutch, which is the defect). All eight come back `modelled-shell-cavity`, and `35480` comes back `open` at both clutches because its studs are open and the hole runs right through — its ceiling is measurably present at y 0 over x [-6, 6] and z [-16, 16] and measurably absent at the two clutch centres, which is the part being right rather than the measurement being wrong.

**The second half rests on a false premise.** "The wing plate with 115 collision boxes ... its 115 primitives are a voxelised solid being drawn literally" — they are not drawn at all. `createCatalogPartGeometry` takes the mesh branch for these parts and never reads their collision primitives, so nothing about the wing plate's appearance comes from those boxes. They are its collision decomposition, generated as a per-column height field by `emit-measured-part-tables.py` from the same expansion that made the mesh.

What *is* wrong with them is a different thing, and it is the defect the shell fixed on the other side: **a height field is filled, so collision fills a cavity the mesh draws hollow**. Collision and render disagree on all eight parts, exactly where they now agree on the other fifty-eight.

**Correction, same day: I claimed here that this was feasible to fix and then measured it, and the claim was wrong.** The reasoning was that the meshes' winding is perfectly consistent — which it is, every triangle at the top face pointing up and every one at the bottom face pointing down across all eight parts with no exceptions — so a ceiling could be told from a floor and a column's solid runs paired off without the crossing-parity test an open LDraw surface defeats.

Pairing fails anyway, and the place it fails is the tube. Probing `plate-3x3-corner-round` down a column 7 LDU from a tube axis — in the annulus, between bore and outer wall — the mesh has **one** up-facing surface and **two** down-facing ones: the top face at y -4, the cavity ceiling at y 0, and the tube's own ring at y 4. There is no up-facing surface at the tube's top because LDraw places the tube through the ceiling without CSG, so the ceiling face spans the cavity underneath it. An unpaired close cannot say where its run began: read one way the tube vanishes, read the other the bore fills. Probes at 0, 5 and 9 LDU from the axis each pair cleanly, which is exactly why one column had to be chosen where it would not.

So this is the repository's own lesson one turn further on. An LDraw part has no inside, and that defeats crossing parity; it also has no CSG, and that defeats orientation pairing. Deriving hollow collision from these surfaces needs something that is neither — and the pipeline is at least ready for it: `emit-measured-part-tables.py` was run against the pinned archives and reproduces all three generated tables **byte for byte** after `prettier`, so a change to the decomposition would show up as exactly its own diff.

### The 16 that remain, measured from their own LDraw files — 2026-08-09

Step 3 targeted 74 `underside-is-drawn` violations to zero and reached 16. Every one of those sixteen has been expanded from the pinned official archive and its underside measured, so the next attempt does not have to re-measure anything. LDraw y, top face at 0 unless stated:

| part | file | cavity ceiling | measured against the plate rule |
|---|---|---|---|
| wedge plate 2x4 left | `41770a` | 4.0, area 1713 | 4 LDU deep, same as a plate |
| wedge plate 2x3 left | `43723a` | 4.0, area 1246 | same |
| wedge plate 4x4 cut-corner | `30503` | 4.0, area 3666 | same |
| wedge plate 6x6 cut-corner | `6106` | 4.0, area 9721 | same |
| wedge plate 3x6 right | `54383` | 4.0, area 3841 | same |
| corner plate 4x4 round | `30565` | 4.0, area 4065 | same |
| corner plate 5x5 quarter-ring | `80015` | 4.0, area 1928 | same |
| arch 1x4 | `3659` | 4.0 from the top, area 768 | **end walls are 8 LDU, not 4** |
| arch 1x6 | `3455` | 4.0 from the top, area 1248 | **end walls are 8 LDU, not 4** |
| curved slope 1x2 | `11477` | 12, 10, 8 and 4 above the bottom | stepped, no single ceiling |
| curved slope 1x3 | `50950` | 8, 4 and 1 above the bottom | stepped |
| curved slope 1x4 | `61678` | 20, 16, 8, 4 and 0.2 above the bottom | stepped |
| cheese slope 1x1 | `54200` | 4 (area 4) and 1 (area 76) above the bottom | a 1 LDU recess, not a cavity |
| cheese slope 2x1 | `85984` | 4 (area 8) and 1 (area 116) above the bottom | the same |

Three findings, and each is a reason none of the sixteen was shelled here rather than a reason to defer:

**The seven wedge and arc plates have exactly the plate's 4 LDU cavity**, so nothing about their depth needs measuring again. What stops them is representation: a wedge plate's body is one `wedge` primitive and an arc plate's is one `bodyArc`, and the wall ring a shell needs is the plan minus the plan eroded by 4 — a shape neither kind can hold, and not a box union either. It decomposes exactly into convex quad prisms, one per plan edge, and `convex-prism` already exists as a collision kind; what does not exist is a renderer that draws one, because `geometry.ts` skips every convex prism on the grounds that an arc's visible body is its own analytic feature. That is the piece of work, and it is a representation change rather than a measurement.

**The arches are 8 LDU at the ends, not 4, and the plate rule would get them wrong.** `3659`'s ceiling measures 768 LDU squared where eroding its 20 x 80 plan by 4 predicts 864; 768 is 12 x 64, so the cavity stops 8 LDU short at each end. `3455` says the same: 1248 measured against 1344 predicted, and 1248 is 12 x 104. Two files, one number, and it is not the plate's. Applying the plate rule to an arch would be the exact error this document opens by naming — a shell built from plausible numbers, which just looks more like a part.

**A cheese slope has no cavity to model.** Its underside is a 1 LDU recess over most of its area with a 4 LDU pocket of 4 to 8 LDU squared, which is not a wall-and-tube cavity and would not hold a stud the way `cavityHoldsStud` means. Whatever admits its clutch, it is not the plate's shell, and saying so needs `54200` read as a structure rather than as a set of levels.

**5 — Wire `parts:check` into `verify`** and delete the note at the top of the script. The number: `parts:check` exits 0.

### Step 5 is not done, and the reason is the 16 above — 2026-08-09

`parts:check` exits 1 with 16 violations, so wiring it into `verify` would make `verify` red on `main`. It is not wired. The honest statement of where this stands is the count and its composition: **24 to 16, all of one rule, every one of them measured and none of them modelled.**

**6 — Re-verify the booklet prefix.** Steps 4 and 5 were accepted against flat undersides and must be re-run against real ones. The number: `stepsComplete` re-measured, and it may go **down** before it goes up. A prefix that shrinks here is the standard working.

### Step 6, first half — the prefix is unchanged — 2026-08-09

Re-run against the real undersides, the booklet reports **5/5 steps complete and 8 pieces placed** at `--last-step 5`, and **4/4 and 6** at `--last-step 4`. Both pins hold to the piece. Printed step 4 is still classified `underside` and still completes, now scored against a plate that has a cavity and tubes rather than against a flat rectangle.

That is the geometry half and it is done. What it does not do is upgrade step 4 to verified: the run's own refusals still report step 4's chosen transform as the mirror of the ledger's, which is the standing mirroring gap and not something a shell can fix. Re-reading steps 4 and 7 against their panels — the comparison numbers, not the completion count — is what remains of this step.

### Step 6, second half — the panels were opened, and step 4 is untouched by any of this — 2026-08-09

**Printed step 4's build render still draws no tubes, and the reason is exact: every part in its prefix is one of the sixteen.** The run retains `step-004-panel.png` and `step-004-build.png` side by side and they were looked at. The booklet draws the model from below with the underside tube rings of every plate printed as rows of circles — that is the 57 this document opens by counting. The build renders the same six pieces as a flat silhouette with studs around the rim and nothing inside it.

The six are `80015`, `30565`, `30503` twice, `6106` and one more, and each carries `semantic-tube-seat-offsets`. `plate-2x4` and `plate-2x14`, the two shelled parts of the early build, do not arrive until printed step 5. So shelling fifty-eight parts changed printed step 4's comparison by nothing at all, and the seven wedge and arc plates in the table above are not one of several ways to make that panel comparable — they are the only one.

**Printed step 7 has never been scored, by this or by any loop.** At `--last-step 7` the run reports `blocked-by-prior-step`: step 6 refuses first with `ambiguous-deferred-placement`, separating its best two of 36 whole-step candidates by **0.003271695476935066** (0.8836938904939751 against 0.88042219501704) where 0.02 is required, and step 7 is then not attempted because the canonical document still represents the base of step 6. Its candidate count is 0 — nothing was enumerated, nothing rendered. The earlier framing that steps 4 and 7 "were both scored against a flat rectangle" is right about step 4 and wrong about step 7: panel 7 has been *registered* against a rendered prefix in the camera-fit work, and no placement of its own has ever been scored.

## What re-verification owes

Steps 1, 2 and 3 are studs-up panels and their comparisons are unaffected by the underside gap; they stay verified. Steps 4 and 5 are provisional, and step 6's margin is measured through them.

The honest position, with the shell drawn and the prefix re-measured: **3 verified printed steps, not 5.** The geometry those two panels are scored against is now the part; whether the placements they chose are the ones the booklet draws has not been re-read.

## Why this is worth the cost

The alternative is continuing to tune scorers against geometry that is not the part. Every hour spent on a 0.003 margin, an anchor IoU, or a stroke tolerance is spent measuring the wrong shape precisely — and the closer those numbers get to their thresholds, the more confidently wrong the result.

The three signals that pointed here were each logged and none acted on: the renders draw no tubes, a stud radius wrong by 60 nanometres, and 115 collision primitives on one part against one on every other. A standard that runs on every part change is what turns the fourth such signal into a failure instead of a note.
