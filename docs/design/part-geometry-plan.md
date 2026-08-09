# Making a part draw what it claims

The plan for closing the 82 violations `npm run parts:check` reports, and for the re-verification that owes.

This is scoped to part geometry. `part-model.md` owns how a part is organised and declared; this document owns the gap between that declaration and what gets drawn, and the order in which it closes.

## The problem, measured

Every pixelwise number this project reports — containment, stroke recall, anchor registration, the 0.00328 placement margin at printed step 6 — compares a render of a catalog part against a printed booklet panel. None of those numbers is better than the geometry underneath them, and the geometry was never checked.

`InstructionSurface` is `"body" | "stud"`. Two surfaces: a solid body, and cylinders on top. There is no underside, cavity, wall or tube anywhere in the render pipeline, and `undersideMode` — which 69 parts declare — is consumed by nothing outside the catalog package. It is not a switch that is off; there is no wire behind it.

Printed steps 4 and 7 are underside panels. Panel 4's stud lattice fits 57 drawn tube rings, panel 7's fits 174, and both were scored against a flat rectangle. Step 4 was accepted on that comparison, so its placement is **not verified**, and step 6's margin sits on a prefix containing it.

`parts:check` reports 82 violations across 85 parts: 74 parts declaring underside clutches they never draw, and 8 declaring no geometry modes at all.

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

**Not yet measured:** the tube's OUTER radius. `stud4.dat` is absent from `scripts/ldraw-cache/`, which holds `stud3a.dat` and `stud4od.dat` but not it. That is one missing file, not a missing method, and it is recorded rather than guessed - a tube radius invented here would be the same class of error as the stud radius that read 6.0001514980873605.

**1 — Extend the standard.** Add the rules the current four do not cover: the render silhouette agrees with the expanded LDraw surface from all seven canonical views within a stated tolerance; `bodyBoundsLdu` equals the drawn extent; collision primitives cover the body and no more. Expect the violation count to *rise* above 82; a standard that finds less after being sharpened was not sharpened.

**2 — Build the underside surface for one part.** `plate-2x4`, because `3020;L` is already pinned and its LDraw expansion is already proven. Render it from below beside panel 4's art and read both. The number: its from-below silhouette agreement against the expanded surface, from nothing to within tolerance.

**3 — Generalise to the 74.** Drive it from `undersideMode` and the declared seat grid. The number: 74 `underside-is-drawn` violations to zero.

**4 — Re-derive the 8 mesh-first parts through the same path.** The number: 8 `geometry-mode-is-declared` violations to zero, and the wing plate's 115 collision boxes replaced by a decomposition of its own surface.

**5 — Wire `parts:check` into `verify`** and delete the note at the top of the script. The number: `parts:check` exits 0.

**6 — Re-verify the booklet prefix.** Steps 4 and 5 were accepted against flat undersides and must be re-run against real ones. The number: `stepsComplete` re-measured, and it may go **down** before it goes up. A prefix that shrinks here is the standard working.

## What re-verification owes

Steps 1, 2 and 3 are studs-up panels and their comparisons are unaffected by the underside gap; they stay verified. Steps 4 and 5 are provisional, and step 6's margin is measured through them.

The honest position until step 6 above completes: **3 verified printed steps, not 5.**

## Why this is worth the cost

The alternative is continuing to tune scorers against geometry that is not the part. Every hour spent on a 0.003 margin, an anchor IoU, or a stroke tolerance is spent measuring the wrong shape precisely — and the closer those numbers get to their thresholds, the more confidently wrong the result.

The three signals that pointed here were each logged and none acted on: the renders draw no tubes, a stud radius wrong by 60 nanometres, and 115 collision primitives on one part against one on every other. A standard that runs on every part change is what turns the fourth such signal into a failure instead of a note.
