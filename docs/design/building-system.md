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

Cleared: the catalog held none of the set's parts, and now holds 85 definitions at `builtin.basic-parts/8` with the first 77 rows still hashing exactly as they did. Admitting `30357`, `2450` and `79491` — whose female connectors come from the LDCad shadow library, the only source that has them — moved the covered prefix from 15 printed steps to 25, because step 16's only missing design was one of them.

Cleared: identification confidence. Blind pair-judged verdicts are a digest-bound closure role, and printed steps 1 to 18 now carry 40 of 42 piece slots trusted, up from 17. Step 1's `80015` callout, which made every prefix impossible, resolves.

Cleared: set accounting, which was rejecting the run at any length because it carried no step number. The booklet distinguishes a parts-bin quantity from a repeat multiplier by type size alone — 8pt against 16, 24 and 40pt — and the 196 step pages carry 881 Nx labels: 859 at 8pt totalling **1464**, and 22 at the larger faces totalling 48. 1464 is the assembled model, corroborated twice over: the back-matter inventory on pages 221-222 totals 1465, one more because the loose `31510` separator is never placed, and the official Builder XML yields 1395 direct + 69 MultiBuild = 1464 instruction identities from 1465 Bricks with that same separator unmatched.
Both halves of the contract were wrong. `OFFICIAL_REAL_BUILD_ACCOUNTING` still declared the superseded 870-identity generation (raw 1486, physical 1446) and closed the gap with an `omittedPhysicalPieces: 18` class no artifact ever enumerated; the publication had moved to 881/1512 but classified four multiplier labels as part art — `p59|q2|x124.683|y55.056`, `p85|q2|x662.244|y445.465`, `p96|q2|x125.941|y478.298`, `p109|q2|x723.002|y319.540` — putting its physical total 8 pieces above the set. The 26-piece discrepancy was 8 of real over-read plus an 18-piece class that never existed. The constant now reads 1512 = 1464 + 48 with omitted 0, and the four labels are preregistered semantic.

That miss was only findable by hand because the type size was extracted and then dropped: the manifest published a class and no measurement that could contradict it, and any identity absent from the curated recovery fixture defaulted to physical. The manifest is `lego.callout-thumbnails/5` and every callout record now carries its `heightPt`, so the classification has two independent sources — the preregistered fixture and the booklet's own type size — and publication refuses when they disagree. The bounds are measured, not assumed: the parts-bin band is 7-9pt and the multiplier bound is 16pt, with the 8-to-16 gap empty in this booklet. A face in that gap, or the 6pt back-matter inventory row, fails as unclassifiable rather than landing in either class, because another set's booklet will set its own sizes.

Blocking now, measured from the run below at printed step 12: **twelve input failures across three causes, and none of them is the set accounting.**
**One** official design revision still has no code-pinned Builder frame — `41769;G`, the `builtin:wedge-plate-2x4-right` used by step 11 — down from 13. It resolves to a catalog part that already exists, so this is a missing frame pin rather than a missing part, and it is the whole reason `set-accounting-mismatch` still appears: the failure now names its clause, and the clause is `prefix`, failing on step 11 alone because that one unplaceable piece leaves the step's action ledger at 23 pieces against 24 classified.
**Two** callouts in the opening steps stay untrusted — `p12|q1|x108.829|y453.870` at step 5 and `p13|q1|x83.311|y434.390` at step 7, both `refused`. Printed steps 1 to 18 hold 40 of 42 piece slots trusted; these are the other two, and each drags a `coverage-key-mismatch` with it because its step maps a coverage key that no direct identity can cite.

Two contract defects are known, owned by nobody, and neither is the reason the build is at zero:
`real-build-artifacts.ts` requires an `input-rejected` run to carry zero step rows, while any such run that attempted steps necessarily has them, so publication throws regardless of cause.
`scripts/generate-builder-calibration.py` hardcodes `builtin.basic-parts/6` and two definition digests that disagree with the TypeScript pins; it has been stale across two version bumps.

To see the current position rather than trusting this paragraph:

```
LEGO_REAL_BUILD_REGENERATE_COVERAGE=1 LEGO_REAL_BUILD_REGENERATE_INPUTS=1 npx playwright test apps/web/e2e/real-build-inputs.spec.ts
LEGO_REAL_BUILD_REQUIRED=1 npx playwright test apps/web/e2e/real-build.spec.ts
```

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
