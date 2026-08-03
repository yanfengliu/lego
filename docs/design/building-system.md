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
The asset pipeline is a parametric box, wedge, cylinder, and analytic-plan generator plus the LDraw fact reader, with no imported-mesh stage.
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
