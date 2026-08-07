# Building system: assessment and plan

An assessment of this repository against a full brick-building-system specification, and the design for what is missing.

Written because the specification describes a system largely already built here, and the expensive mistake would be to build it a second time alongside.
Read `part-model.md` first for how a part itself is organised; this is about the system around it.

It is not the goal. The goal is in `spec.md`: read a printed instruction booklet, build the set it describes, verify each step against the booklet's own picture, and play the result back.
Everything here serves that. Parts exist because the loop cannot place a wedge plate it does not have; physics exists because a model that has been built should be shown standing up and moving.
When the two compete, the booklet wins — a building system with nothing to build is the more comfortable problem and the wrong one.

## Against the specification

**Already built, and should be reused rather than replaced.**

The construction coordinate system is exact integer LDU with stud pitch 20, brick 24, plate 8, stud 4, and four canonical quarter turns — `packages/catalog/src/constants.ts` and `transforms.ts`.
`PartDefinition` and `PartInstance` exist with stable ids, aliases, families, substitution groups and provenance; a part instance carries its submodel, step, semantic tags and provenance.
Connectors are typed and gendered with positions, axes and profiles, and connections are explicit edges.
Placement has a live ghost preview with a valid or blocked verdict, and refuses an unsupported placement at the command rather than flagging it afterwards.
Collision separates connector engagement from solid overlap: a stud may enter a matching clutch to a declared depth, and everything else that shares space is refused.
Colours are a stable palette of 45 ids, changing one edits instance data.
Undo and redo, project save and load, LDraw import and export, a searchable catalog panel grouped by family, and broad unit and browser regression suites all exist.

**Partly built.**

Connector kinds are `stud` and `undersideClutch` only — nothing articulated.
Selection is single-part; there is no multi-select or box select.
The asset pipeline has the parametric box, wedge, cylinder and analytic-plan generators, the LDraw fact reader, and a closed preloaded-mesh renderer whose immutable registry caps asset, vertex, triangle and byte totals, whose successful frame-resolution cache is a fixed-size LRU, whose admission checks content hash, generic asset-local frame and represented connector/collision/body/visual bounds, and whose finish-aware scene budget accounts for indexed sources, de-indexed instruction fills, role splits, colors and outlines.
Its production mesh registry now holds the eight bundled set 6651557 meshes admitted at `builtin.basic-parts/7` and `/8`, so the capability is exercised by real parts rather than only by fixtures.
The retained six-part 6651557 pilot was the measurable intermediate for that admission: six exact LDraw closures (70 unique files), checked file-by-file against the complete exact 439-record source audit, cover six designs while independently rehashed Builder native record slices cover five, and its pressure rows showed where fractional bounds, non-upright connectivity and oriented collision exceeded the representation. Five of those six are admitted — 5092, 35480, 51739, 77844 and 93273, composites 0.9947/0.9712/0.9901/0.9961/0.8937 with zero hard fails — taking their render mesh from bundled LDraw geometry, their collision from that surface's per-column height field, their connectors from Builder's authored field through the pinned per-part frame, and their extents from the exact closure. The fractional-bounds pressure is answered by the exact bound representation and two of the five need it. Three more followed at `/8` — 30357, 2450 and 79491, composites 0.988908/0.989972/0.990096 with zero hard fails — taking their clutch cells from the LDCad shadow library, because the Builder pack has no record of any of them and LDraw geometry supplies no female connector at all. That is what moved the booklet: the retained coverage report's covered prefix ran to step 15, step 16's only missing design was one of the three, and admitting them takes the first uncovered step from 16 to 26. Four further LDCad-covered designs were scored and refused — 44237 and 93888 on catalog identity, 41682 and 3814 on a `male-connector-over-claim` hard fail. Non-upright connectivity and oriented Builder collision still exceed the representation, and neither is used by these eight. The catalog holds 85 parts; the set needs 121 leaf designs, so eight admitted is a start and not coverage.
Collision does a one-dimensional sweep on x with an early break, which is sweep-and-prune, but connector lookup is linear.

**Not built at all.**

Physics: Rapier drives compound bodies and revolute joints from the kernel's descriptors. No simulation mode in the app yet, and no support model beyond the static placement check.
GPU instancing is absent: each part is a `Group` containing one or more body meshes plus separate stud meshes, so a 1465-piece model produces more than 1465 meshes (and instruction rendering adds outline objects).
Inertia is absent from `PartDefinition`; mass and centre of mass are derived from the declared compound solid, with an optional known-mass override.
No profiling metrics.

## One disagreement worth stating

The specification makes the connection graph the source of truth for how parts are attached.
This repository does not, and should not change: part transforms are authoritative and connection edges are validated annotations, recorded in `spec.md` as an invariant.

The reason is the booklet.
An instruction booklet gives placements, never connections, so the closed loop derives which studs meet which tubes from geometry — and if edges were authoritative, a document could assert a connection the geometry contradicts, with nothing able to say which was right.
Deriving edges from transforms can only be wrong in one place; making both authoritative can be wrong in two that disagree.

Everything the specification wants from the graph — connected components, rigid boundaries, splitting on deletion, subassembly selection — works exactly the same on derived edges.
The difference is only which one gets rebuilt when they conflict.

## Where the booklet build actually is

Measured, not asserted. Every figure here comes from a real run and is reproducible by the commands named below; if one disagrees with the code, the code is right and this section is stale.

The build places **zero pieces**. It has never placed one: the run below still measures `stepsComplete 0`, `piecesPlaced 0`, status `input-rejected`. What has changed is that "why not" is a short named list rather than an unknown, and the list keeps getting shorter — the blockers below have been cleared in order, and what remains is three named causes in twelve failures rather than a set-wide refusal.

Cleared: the catalog held none of the set's parts, and now holds 85 definitions at `builtin.basic-parts/8` with the first 77 rows still hashing exactly as they did. Admitting `30357`, `2450` and `79491` — whose female connectors come from the LDCad shadow library, the only source that has them — moved the covered prefix from 15 printed steps to 25, because step 16's only missing design was one of them. The prefix still measures 25, with step 26 the first uncovered and `28802` its only missing design.

Cleared: identification confidence. Blind pair-judged verdicts are a digest-bound closure role, and printed steps 1 to 18 now carry 40 of 42 piece slots trusted, up from 17. Step 1's `80015` callout, which made every prefix impossible, resolves.

Cleared: the last two. Both refused callouts were one cluster, and the reason it could not be answered was two bad crops in the gallery it retrieves from. The inventory grid is ragged and a cell was a rectangle sized from the column pitch, so `383228`'s 2x8 plate — which overflows its column — was published with its end cut off, and that same overflow sat inside the rectangle `302028` was cut from one column over, giving it two plates and a `2x`. Both were published looking exactly like good crops, because an inventory record carried an element id and a quantity and nothing else. Cutting the page into connected components with the text masked, and assigning each element one component, fixed both; against the Builder-export truth, which is independent of the descriptor, shortlist recall went from 0.88 at every k with ranks {1:22, 17:1, 197:2} to 1.000 with all 25 at rank 1. The cluster's shortlist then led with `302028` at a 0.021 distance against 0.067, the vision call answered "plate, 4 long, 2 wide, Green" and picked it, and the two `untrusted-identification` failures are gone.

Cleared: set accounting, which was rejecting the run at any length because it carried no step number. The booklet distinguishes a parts-bin quantity from a repeat multiplier by type size alone — 8pt against 16, 24 and 40pt — and the 196 step pages carry 881 Nx labels: 859 at 8pt totalling **1464**, and 22 at the larger faces totalling 48. 1464 is the assembled model, corroborated twice over: the back-matter inventory on pages 221-222 totals 1465, one more because the loose `31510` separator is never placed, and the official Builder XML yields 1395 direct + 69 MultiBuild = 1464 instruction identities from 1465 Bricks with that same separator unmatched.
Both halves of the contract were wrong. `OFFICIAL_REAL_BUILD_ACCOUNTING` still declared the superseded 870-identity generation (raw 1486, physical 1446) and closed the gap with an `omittedPhysicalPieces: 18` class no artifact ever enumerated; the publication had moved to 881/1512 but classified four multiplier labels as part art — `p59|q2|x124.683|y55.056`, `p85|q2|x662.244|y445.465`, `p96|q2|x125.941|y478.298`, `p109|q2|x723.002|y319.540` — putting its physical total 8 pieces above the set. The 26-piece discrepancy was 8 of real over-read plus an 18-piece class that never existed. The constant now reads 1512 = 1464 + 48 with omitted 0, and the four labels are preregistered semantic.

That miss was only findable by hand because the type size was extracted and then dropped: the manifest published a class and no measurement that could contradict it, and any identity absent from the curated recovery fixture defaulted to physical. The manifest is `lego.callout-thumbnails/5` and every callout record now carries its `heightPt`, so the classification has two independent sources — the preregistered fixture and the booklet's own type size — and publication refuses when they disagree. The bounds are measured, not assumed: the parts-bin band is 7-9pt and the multiplier bound is 16pt, with the 8-to-16 gap empty in this booklet. A face in that gap, or the 6pt back-matter inventory row, fails as unclassifiable rather than landing in either class, because another set's booklet will set its own sizes.

**At a three-step prefix the booklet-side failures are gone entirely, and the frontier has moved off the booklet.** Regenerating the inputs at `LEGO_REAL_BUILD_LAST_STEP=3` reports "0 remaining evidence failures through printed step 3", and the run now reaches `incomplete` rather than `input-rejected` — the inputs are accepted and the browser driver loads and runs.

Getting there meant closing three holes in the sealed replay's module graph, all of them vite resolving imports against its own graph rather than the mirror. Bare imports inside mirrored files become `/node_modules/.vite/deps/*`, relative to the dev server's root — and that cache lives under vite's root rather than beside the lockfile, so declaring the repository-root `node_modules/.vite` mirrors an empty directory and changes nothing. Vite injects an import of `/@vite/client` into every module it transforms, independently of HMR: switching HMR off removes the socket, not the import. And a served module can be handed a sibling's absolute path in the ordinary checkout, which is how that client reaches `env.mjs`. Chasing routes one at a time was the wrong cut; what the mirror vouches for is a file at a repository-relative path, and the drift check proves the checkout still holds the captured bytes, so a checkout path resolves exactly when the mirror declares the same relative path. Recorder and replay verifier apply the same rule.
Measured: served requests move from 22 fulfilled and 4 blocked to **110 fulfilled and 1**.

Two defects surfaced only because the run got that far, and both are the same shape — a check that no failing run could reach. `MAXIMUM_REPLAY_ROLE_COUNT` was 20 while the closure emits 21, and the twenty-first is `browser-output`, which exists only once the browser completes; the bound was one too small from the day it was written. And the drift check reported "digest map changed" and named nothing whenever its snapshot half fired alone, because that half was a bare `JSON.stringify` inequality; it now names the path and both digests.

Still zero pieces placed, but the chain of harness refusals is exhausted, the arrows now convert, and **the search runs on a printed panel for the first time**. The driver returns a valid document and the exact prepared PDF; step 1 enumerates and renders four candidates under both the pruned and exhaustive strategies, and every one scores zero. Steps 2 and 3 are blocked behind it.

`real-build-run.ts` used to read the displacement arrows and then pass `usableArrowPlacementCount: 0` as a literal, so every exploded step refused with `no-placement-signal`. The conversion existed and nothing called it: `measureArrowClearances` reads the gaps the artist left at each end, `correctArrowForClearance` adds them back — 0.00 to 0.47 of a stud on this booklet, always the same direction — and `arrowDisplacementFamily` returns every whole-grid displacement whose projection matches what is left. Wiring those moved step 1's refusal from `no-placement-signal` to `benchmark-disagreement`.

**Why the score is zero is a fact about the booklet, not a defect.** Step 1 reports `highlight 0 region(s), 0px stroke, closed 0; arrows 2 kept 0 rejected`. It is the first step, so nothing is already built and there is nothing to outline; the panel prints no highlight at all. `scoreStepDelta` therefore has `regionIou` null and an empty stroke mask, and every candidate scores zero by construction. The search is not failing — it is being asked a question this panel does not answer.

The panel's own drawn art cannot stand in for the missing highlight either, because step 1 is drawn exploded: the wedge floats above the curved plate with two arrows into it, so an assembled candidate does not match the drawing however it is placed.

The arrows do constrain it, and by a measured amount: step 1 reports `family 4`. Its two red arrows narrow the placement from every legal enumeration to **four** whole-grid displacements and no further, so step 1 is neither underdetermined nor solved — it has four candidates and no local evidence to choose among them. Four is a beam width rather than a search.

That is exactly the case the section below designs for — an exploded step need not be read at all, because the following step is not exploded. The run cannot yet do it: it settles each step against its own panel through `selectUniquePlacementScore`, which is why an unanswerable panel is a dead end rather than a deferral. Carrying step 1's candidates forward and letting step 2's panel score them is the next change, and it is the same swap the section below already argues for.

The four are published per step, closest projection first. Step 1's are `[-60,80,-40] [140,-88,100] [60,-24,40] [0,32,0]` in LDU.

An authored answer for step 1 exists and is worth recording, but it does **not** check the family, and saying why matters more than the numbers. The official Builder model places the two pieces at `30565;E` translation `22.8, 0.32, 8.16` unrotated and `80015;E` translation `22, 0, 10.56` under a quarter turn about Y; Builder's units are 0.8 per stud pitch and 0.32 per plate, so the offset between them is `(-0.8, -0.32, +2.4)` — minus one stud, minus one plate, plus three studs, or `(-20, -8, +60)` LDU. None of the four resembles it, and that is not evidence against the arrows, because the two quantities are different things. An arrow measures **ghost travel**: from where a part is drawn floating to where it seats. The official model records only seated positions, so it cannot say where the artist drew the exploded ghost, and the offset between two seated pieces is not the distance either of them travelled.
Checking the family therefore needs the drawn position too — the part's projected location in the panel, carried back through the fitted camera — and the test is whether applying one of the four to that position lands on the official seat. That is the comparison worth building, and it is still one between a reading of printed pixels and a source that never saw them.

What is already known is that **applying the four as inter-piece offsets produces no legal placement at all**: constructing the two step-1 pieces at each of the four relative displacements and asking the editor to place them, every one is refused by the support check — "would rest -80/88/24/-32 LDU above the build plate with nothing under it". That is a third independent voice, the repository's own validator, which saw neither the arrows nor the official model. It does not by itself condemn the family, because it shares the mis-posing above; it does mean a beam over these four would have searched a set containing no legal answer.

Two things the panels say that no parser produced, and they are worth more than the arithmetic. Step 1's arrows point **down** — the quarter-round plate descends onto the curved arc — and step 2's arrows point **up**, the new wedge arriving from beneath. And of the four displacements, exactly one is purely vertical with no ground component, `[0,32,0]`, which is the only one whose direction matches what step 1 draws. `arrowDisplacementFamily` sorts by pixel agreement and put it **last**, which its own docstring warns about: that order is a ranking of pixel agreement and not of correctness.

Blocking at printed step 10 — chosen because step 11 is the only step in that prefix that needs `41769;G`, so a ten-step request separates the frame question from everything else: **seven input failures, all of them one cause.**

That cause is a missing Builder frame, and it is no longer `41769;G`. It is **`3020;L`**, the `builtin:plate-2x4` that steps 5 and 7 now resolve to. Two `official-frame-calibration-missing`, two `action-ledger-incomplete`, two `coverage-key-mismatch` and the `set-accounting-mismatch` are all that one design. The blocker moved because the identification did: while those callouts were refused, nothing had to name a design for them; now they name `302028`, and `302028` is design 3020.

The two are not the same kind of blocker, and the difference is the whole decision.
`41769;G` is absent from the local 159-bundle capture, and the one bundle that serves it hashes md5 `fb1e8bb3…` against the manifest's declared `cab7c402…`. The payload is internally sound — Content-Length, received length and the UnityFS header's own declared size all agree at 97802, the origin ETag equals the body md5, and it is byte-identical to a copy taken four days earlier — and the declaration is the thing that looks wrong, because all 157 named captured bundles reproduce their declared checksum exactly while 18 of 175 rows reproducibly do not. But nothing independent agrees with the payload, so admitting it is a judgement about an upstream declaration, not a derivation. That is an owner decision.
`3020;L` is not, and the difference is checkable rather than argued. `3020-L-android.bundle` is in the capture at 9571 bytes, sha256 `a0bee312fc74b5f7f054c255b020933d9afb43a9feac6f12012749b6f659a030`, and the local cache report records it `verified: true` — its md5 `e94e8489ac5f11afd887ba07ab754f21` is exactly what the Builder manifest declares for that row. It is one of the 157 that reproduce their declaration, not one of the 18 that do not, so it carries the independent corroboration `41769;G` has never had. Deriving its frame is the same ordinary work the other fourteen rows went through.
What stands in the way is only that the tooling is pinned to those fourteen: `extract-builder-shell.py` admits exactly its reviewed tuples and `discover-builder-shell.py` fixes `BUNDLE_BYTES` and `BUNDLE_SHA256` to the single 3245-M capture. Turning those single pins into a reviewed set is a source change `real-build-inputs.spec.ts` deliberately refuses to make for itself, and it touches the decode boundary, so it is the kind of change this repository sends to independent review before it lands.

One caveat on the coverage these numbers were taken against: the vision pass that produced them answered 224 of 269 clusters before the remaining calls began exceeding their fifteen-minute limit, so 18 callouts are unidentified and the covered prefix of 25 was compiled without them. Steps 1 to 25 are covered; the number could move either way when the rest answer.

Both of the contract defects previously listed here are closed.
`real-build-artifacts.ts` required an `input-rejected` run to carry zero step rows while `inputRejectedRealBuildResult` exists to retain one typed refusal row per requested step — a branch nothing could satisfy, so publication threw on every rejected run whatever its cause and the run's own evidence could not be read at all. It now checks what the status actually forbids: no completed step, no placed piece, no structural hash, no row that is anything but a failure, no row claiming it attempted a piece or reached a canonical step, and either one row per requested step or none.
`scripts/generate-builder-calibration.py` no longer hardcodes any catalog version — the string `basic-parts` does not appear in it, and its 22 tests pass. That entry was a claim about the file rather than a fact about it, which is what retesting an inherited blocker is for.

To see the current position rather than trusting this paragraph:

```
LEGO_REAL_BUILD_REGENERATE_COVERAGE=1 LEGO_REAL_BUILD_REGENERATE_INPUTS=1 LEGO_REAL_BUILD_LAST_STEP=10 npx playwright test apps/web/e2e/real-build-inputs.spec.ts
LEGO_REAL_BUILD_REQUIRED=1 LEGO_REAL_BUILD_LAST_STEP=10 npx playwright test apps/web/e2e/real-build.spec.ts
```

Drop `LEGO_REAL_BUILD_LAST_STEP` to see the twelve-step position instead, which adds the four failures that belong to `41769;G`.

The second takes a Windows share-mode lock over the whole source tree, so nothing else can write while it runs.

## Plan

Ordered by what unblocks the most, and by what can be proven headlessly before anything is drawn.

**1. Connector kinds beyond studs.**
`axle`, `axleHole`, `pin`, `pinHole`, `clip`, `bar`, `hinge`, `hingeSocket`, with an explicit compatibility table and an allowed-rotation field of fixed, quarter turns, or continuous.
LDCad's model is the one to copy because it has been tested against the whole library: gender, a section profile, and a grid clause that compresses a whole field to one line.
Nothing articulated is possible before this, and it is pure model work with no rendering.

**2. Mass properties. Done, except inertia.**
`partMassProperties` derives volume and centre of mass from the compound body a part already declares, rather than storing them — nothing to keep in step, and nothing new in the geometry digest.
The volume is of the modelled solid, which is solid where a real brick is hollow, so the mass estimate runs about double: a 2x4 brick reads near 5 g against a real 2.4 g.
That is fine for relative mass and wrong for absolute, so it is named an estimate and `inventory.knownMassGrams` overrides it.
An inertia tensor is not done and is only needed once an engine exists.

**3. Rigid components.**
Connected components over rigid edges only, with articulated edges as boundaries.
Testable headless, and it is the thing physics consumes, so it should be correct before an engine is chosen.

**3a. An articulated part, so joints are exercised. Done.**
A Technic brick 1x2 with a round hole and a 2L axle, measured from LDraw `3700` and `32062`.
The hole is one port at `[0, -2, 0]` with its axis on x, not two: it is one feature open at both ends, which is why axis matching became a property of the pair — a stud enters a clutch from one side only and must oppose it, a shaft may enter a hole either way and need only be collinear.
Both parts are boxes for collision. The hole is a void the connector graph knows about and the solid does not, which over-claims space by exactly the hole and so refuses more than a real part would — the safe direction.
The visible cost of having no mesh layer: the brick renders as a plain 1x2, because the hole is not geometry.

**4. Compound bodies and constraints. Done, except incremental rebuild.**
`derivePhysicsScene` turns the assembly graph into bodies and joints as plain LDU data, and `apps/web/src/physics/rapier-world.ts` runs them in Rapier.
One body per rigid component, one constraint per articulated joint, and no constraint per stud.
Mass comes from the catalog rather than from collider volume, so the engine cannot disagree with what a part weighs.
Rebuilding only the components a change touched is not done: today a change rebuilds the scene.

**5. Edit and simulation modes. Session done; the app toggle is not.**
`startSimulation` reads the document once, builds bodies from it, and afterwards reports only where those bodies have got to.
Restore is therefore not an operation at all, which is stronger than making it a reliable one: an operation that does not exist cannot fail or be interrupted halfway.
It also sidesteps a real conflict — a solver produces a brick resting at 23.37 and tilted four degrees, and no such thing is a lattice position.
Apply, if it is ever wanted, needs its own answer about where off-lattice parts live, and should be a separate posed layer rather than a write to the build.
Still to do: the mode toggle in the app, and a viewport that draws part poses instead of document transforms while a session runs.

**6. Indexing and instancing, when measured.**
A connector index and instanced rendering are both real needs at 1465 parts and both are premature before a number says so.
The repository's rule is to build the measurable intermediate first, so these wait on a profile that names them.

## Notes on the demonstration

The specified vertical slice is a wheeled cart, which needs items 1 through 5 and a wheel, an axle and an axle-bearing brick in the catalog.
It is the right target: it exercises rigid assembly, articulation, support and simulation together, and none of it can be faked.

A useful intermediate exists first, though, and costs almost nothing: place two compatible parts, snap, save, reload, render.
Every piece of that already works here, so it is a regression test rather than a build.

## The official model's world placements are mirrored, and step 1's target is unbuildable

Found 2026-08-07 while asking why step 1's arrow family contained no legal placement. It is upstream of the placement question and of every frame admitted from Builder, so it is stated before the plan.

`resolveBuilderBoneTransform` maps a Builder Bone position to LDU keeping the sign of z. Three independent lines say it should negate it.

A global test against the official `.ldr` export, over 1465 bricks and 173 designs, requiring each design to admit one part frame: the z-negated reading explains **1439 of 1440** instances, the reading in the repository **656**. All 170 resolved per-design frames under the winner are proper rotations, so the export is a rigid re-expression of the model rather than a mirror of it.

The consequence at step 1 is checkable without any of that reasoning, and the editor is the arbiter because it refuses a placement nothing holds up at the command. At the repository's own canonical transforms — `80015;E` at `[0,8,0]` yaw-180 and `30565;E` at `[60,0,-20]` yaw-0 — the second piece is **refused**: "would rest 8 LDU above the build plate with nothing under it". Negating z alone is also refused. At the relation the export gives, both pieces at the same yaw offset `[100,-8,0]`, the editor places both and derives **two connections** — exactly the two stud/clutch coincidences the contact analysis predicted, the 4x4 quarter circle sitting one plate on the 5x5 quarter ring over a 1x3 stud overlap.

So the run has been searching for a step-1 placement that cannot exist. That is also why every one of the four arrow-family displacements was refused for want of support: the family was being resolved toward an unbuildable target.

The root cause is named and is not the calibration's arithmetic. `scripts/extract-builder-shell.py` writes Shell vertices as `-25·v`, negating all three axes, which is correct because the Android asset bundle's frame is left-handed — the chiral design `54383;F`, a *right* wedge plate, lands on the official LDraw surface at p95 1.250 LDU under that decode and cannot be fitted at all with z flipped, p95 10.714. `resolveBuilderBoneTransform` then applies that same handedness to LXFML Bone positions, which are right-handed. **The local part frames are right; the world placements are mirrored.** Step 1's own two parts cannot settle it — both are mirror-ambiguous under a free upright fit, scoring within 0.03 LDU either way — which is why it survived the per-part admission scoring that has passed eight designs.

Fixing it changes pinned catalog and frame truth, so it goes through independent review before it lands, and `canonicalTransform` is what a placed piece is graded against, so anything previously scored against it inherits the mirror and has to be re-scored rather than trusted.

## Placement: search against the next panel, not inference from this one

Nothing here places a piece yet, and the booklet does not say where pieces go.
It gives placements rather than connections; roughly half its step highlights are open contours, because the new parts go behind built ones; some steps are drawn exploded, so the highlight fixes shape and orientation but not position; and a panel difference finds the right stud without fixing the offset.
Treated as an inference problem — read this panel, output a transform — that is underdetermined, and the parts of it that are underdetermined are exactly the ones a rule cannot close.

It is not underdetermined as a search problem, because the booklet renders the same growing object 359 times.
Panel N+1 contains everything placed at step N. A wrong placement therefore does not merely produce a wrong model; it produces a visibly wrong panel N+1, and N+2, and every panel after. Each future step is a free check on every past placement, so the loop is: propose a placement, render the model from the panel's own camera, compare, and on disagreement undo and take the next candidate.

That reframing dissolves the three hard cases rather than solving them. An exploded step need not be read at all, because the following step is not exploded. An open contour does not matter when the whole render is being compared instead of the highlight. And "the right stud but not the right offset" describes a candidate set, which is what a search wants.

The oracle already exists: `compareBuilds` scores a rebuild per step, `capture_model_views()` renders canonical views, and the camera is solved — a panel's own stud grid fits the booklet's angle and scale with no part identities. The lattice, the connector graph and the collision check prune candidates before any render, and the depletion walk narrows which part is being placed.

Vision belongs here in two distinct jobs, and the distinction is measured rather than stylistic.
Reading an exploded panel — which floating piece belongs where, on which face, which way up — is general visual sense and cannot be hardcoded; that is a PROPOSER, open-ended, and cheap to be wrong because a wrong candidate is discarded by the next panel.
Asking whether a render matches a printed panel is a CHECKER, and it must be posed as same-or-different: the open N-way form measured 39.9 percent self-consistent on this booklet where the closed binary form scored 84 of 84 between two independent raters.
Proposer output stays untrusted data, as every other provider result here does.

Symmetry defers the check rather than defeating it, and that distinction sets the real requirement.
A placement that renders identically to the correct one contradicts nothing at the step it is made — but it is only *locally* symmetric. A 2x2 plate rotated a quarter turn is indistinguishable alone; attach a 1x2 to one of its edges and the two orientations diverge. The booklet does precisely that, because the model keeps growing on top of every placement, so a symmetric mistake surfaces as soon as something lands that breaks the symmetry, and then it fails like any other wrong placement.
The frame calibration met the same shape and settled it up front, with an independent witness at a measured margin, because a catalog frame is fixed once and reused everywhere. A placement is not: it sits in a sequence that keeps testing it.

So the requirement is not to resolve ambiguity before committing, which is expensive and sometimes impossible. It is to be able to go back far enough when it surfaces — deep backtracking, and a history the search can actually rewind.
That also gives the loop its own measurable: how many steps had to be undone, and how far back the deepest reversal reached. A number that can be recorded and driven down, where "prove this placement is unique" cannot be.
Building it right in one shot is not the goal; noticing and recovering is.

`runBacktrackingSearch` now exists and reports those numbers. It commits to the best candidate, keeps every rejected alternative, and walks back to the shallowest step with an untried one; `BuildTree` addresses a node by its parent and its placement, so returning to an abandoned branch finds the work already there and the wrong branch survives as counterevidence rather than as a gap.
Two things about it are worth stating because both were wrong on the first attempt and neither was visible from the passing tests.
The number it exists to produce was zero on precisely the run where it is the answer: a reversal was recorded only when the search advanced again afterwards, so a search that committed thirty steps and unwound all thirty reported none, and the last descent — by construction the deepest one made — was the one never counted.
And its per-step allowance was a silent cap whose verdict named the wrong subject: with the default of four alternatives and six placements at a step of which only the sixth is viable, it reported that the booklet could not be satisfied by any placement this catalog and camera can produce, for a limit the caller had set. Withheld alternatives are counted now and the verdict says which of the two it is holding.

It is not wired into the real booklet run. `real-build-run.ts` still selects a placement with `selectUniquePlacementScore`, which refuses a step whose best candidate does not beat its runner-up by a margin — the "prove this placement is unique" requirement this section argues against. Swapping it in is the next step, and the right order is to see what the strict selector actually refuses on real panels first, because that is the list the search has to be able to recover from.

**Before any of that, the loop was scoring against the wrong face of the model.**

This set is built partly upside down. The booklet turns it over mid-build and marks each turn with a printed icon, and over printed steps 1 to 12 that icon is a strict toggle of which side the panel is drawn from: steps 1-3 studs up, 4 underside, 5 studs up, 6 studs up, 7 underside, 8 studs up, 9 studs up, 10 underside, 11 still underside. Read by eye off pages 11 to 15; every one of them checks.
The cue was detected and understood and then consumed by nothing. `deriveTransitionPanelFeatures` finds the icon exactly, an earlier pass correctly concluded it annotates the viewpoint rather than naming the action, and correctly refused to map it to the `rotation` action class — and then no viewpoint state was ever built. `transition-classifications.json` still holds 25 attachments and one final-view, zero rotations, nothing before step 44.
The camera fit cannot catch the error, because it is fitted to the panel's own stud grid and a projected square lattice reads the same from above and below. It reports a positive elevation on all 32 fitted panels, flipped ones included, and its own legend already says it is a fit quality and not a proof.
So from step 4 onward a candidate render would be compared against the opposite face of the printed drawing. No frame and no identification fixes that, which puts this above `3020;L` in the order: clearing that frame would have started the placement loop and then failed it for a reason nothing in the run reports.

**All three parts of it are now fixed, with numbers.**

The icon count was an undercount, and the cause was not attribution. `extractPageShapes` stacked only the transform on save/restore, so `fillHex` leaked forward across a restore; page 13 draws the icon twice and the second takes its white from the restored state, so it was reported `#000000` and `isRotationIcon` — which keys on `#ffffff` — never saw it. Restoring the whole graphics state takes the booklet from **39 icons to 43**, and steps 8, 131, 142 and 253 appear. "39 icons, one per page" was that leak stated as a finding.
`derivePanelFaces` now folds the icons into a `panelFace` per printed step, carried on `TransitionPanelFeatures`. It is scored against a blind reading of the pages rather than against the icon: two independent raters read the rendered panels of steps 1 to 43 without being shown the icon or each other's answers and agreed on all 43, and the fold reproduces **43 of 43**. Before the fill-colour fix the same comparison scored **7 of 43** — a single missed icon inverts the parity of every step after it and later icons keep toggling from the wrong phase, so it never resynchronises. Underside panels in the opening are 4, 7, 10, 11 and 16. The judged truth is committed at `apps/web/test/fixtures/panel-face-ground-truth.json` and gated in Vitest.
The seed — that printed step 1 is drawn studs up — is an assumption and is named as one; `derivePanelFaces` takes it as a parameter, so one judged panel fixes the phase of every other by parity.

**Where the face has to be applied, measured.** Not at the camera fit. A below-view lattice at azimuth A is exactly the same lattice as an above-view at azimuth -A — `a(A, -e) = a(-A, e)` and `b(A, -e) = -b(-A, e)`, and negating one basis vector spans the same lattice — so a stud grid cannot separate the two faces even in principle, and the fitter's search over re-basings always reaches the positive-elevation twin. Refitting all forty panels of the camera-fit run a second time as below-views returned no solution on any of them, the five drawn from underneath included. The 32 of 40 it fits and the 8 it refuses have nothing to do with the face.
So `panelFace` is a render-time input: the panel fit supplies azimuth, scale and phase, and the icon supplies the sign of the elevation a candidate is rendered at. Rendering one plate at +35 and -35 degrees confirms the sign does move the camera below. Its underside comes out featureless, because `builtin:plate-6x6` is a parametric box with no tubes, but `scoreStepDelta` is silhouette-only — region IoU plus stroke recall and boundary precision — so missing interior detail never reaches the score.

The transformation is `(-A, -e)` rather than `(A, -e)`, because the fit reports the negated azimuth when the true view is below — strictly, `-A` modulo 90, since the lattice pins the azimuth no further than its quarter-turn coset. `(A, -e)` does put the camera below the model; it arrives from the wrong side of it. This was checked by rendering a deliberately asymmetric model under all four sign combinations, but that probe was not retained, so the claim rests on the algebra above and on the closed-loop drive below rather than on a committed artifact.
What remains ambiguous after that is the azimuth branch. A quarter turn maps A to A+90, which folds to the same value modulo 90 and so cannot produce two different reported azimuths; the 55.1 and 34.8 degree groups the run reports over its first forty panels are the *mirror* branch, plus or minus A modulo 90, which is the same above/below identity again. The grouping does not line up with the faces either: steps 4 and 7 do not fit at all, steps 12 to 15 are studs-up yet sit with 10 and 11, and step 16 is underside yet fits with the 55-degree run. Neither an explanation nor a correlation is established here, and asserting one would be inventing it. What is established is that the branch is a small candidate set, resolved the way the rest of this section resolves things — render each and let the panel score them.

**The loop itself now survives a flip, measured on a synthetic booklet.** `build-search.spec.ts` drives the real enumerator, renderer, highlight extractor, score and beam over a six-step booklet with two underside panels, twice — once told which face each panel was drawn from, once not. Told, it rebuilds 6 of 6 with the drawn placement ranked first at every step. Not told, it ranks 5 of 6 and diverges at step 3.
The failure mode is the part worth knowing, because it is not a refusal. At the first underside panel the face-blind run never rendered the correct placement at all: the candidate projects nowhere near the highlight, so the proximity prune discarded it before scoring and the best score fell from 0.96 to 0.294. The beam survived on a wrong candidate and carried the error to the end. A face-blind loop does not stop — it produces a confidently wrong build, which is exactly the failure a per-step check is supposed to prevent and would not have.
Only one of the two underside steps loses, though, and the margin is one step. At the second the face-blind run did render the drawn placement and ranked it first at 0.559, so "no placement can satisfy it" is false at half the underside panels; what a wrong face costs depends on how far the projection moves. Only the inequality is asserted in the test — the 6/6 and 5/6 are reported, not gated, and can drift.

**The printed run now reads it.** `real-build-run.ts` is no longer face-blind: `viewForPanelFace` applies the icon's sign to the fit, and both consumers take the corrected view — the renderer *and* `panelProjectionFromFit`, because a face-blind projection would convert the printed arrows into the wrong displacements before any render happened. The face rides on `RealBuildPanelSpec` and is reported per step, bound by the browser-output contract to the face the inputs declared, so the run can no longer report a face it was not given.

It is nullable and a null is a refusal, not a default. The fold is a running parity from step 1, so it is derivable only over a contiguous prefix whose icons have all been read; a step outside that prefix fails `panel-face-unknown` rather than rendering studs-up. Defaulting there would reintroduce exactly the silent error, since a face-blind step reports a low score and not an error.

Measured on the booklet through printed step 16: the derivation the run performs returns underside at **4, 7, 10, 11, 16** — the blind-judged set exactly — and the render camera on those steps moves from azimuth 55.10 elevation 35.59 to **-55.10 and -35.59**. `panel-face.spec.ts` still reproduces the fixture's icons from the booklet itself after the fold moved to `src/assembly/panel-face.ts`, where a Vitest suite now also pins the algebra: the two faces span the same lattice through the real `panelProjectionFromFit` (`a` identical, `b` exactly negated), and `(A, -e)` matches neither.

What this does **not** yet show is a flipped render on a printed panel, and the reason is unchanged: step 1 still fails `benchmark-disagreement` at score zero, so steps 2 to 4 are `blocked-by-prior-step` and step 4 — the first underside panel — never renders. A four-step run is the probe that would show it, and it now reaches the browser with its inputs accepted and no `panel-face-unknown` on any of the four. The face is wired and checked; step 1 is still the thing in front of it.
