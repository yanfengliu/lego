# Building system: assessment and plan

An assessment of this repository against a full brick-building-system specification, and the design for what is missing.

Written because the specification describes a system largely already built here, and the expensive mistake would be to build it a second time alongside.
Read `part-model.md` first for how a part itself is organised; this is about the system around it.

## Against the specification

**Already built, and should be reused rather than replaced.**

The construction coordinate system is exact integer LDU with stud pitch 20, brick 24, plate 8, stud 4, and four canonical quarter turns — `packages/catalog/src/constants.ts` and `transforms.ts`.
`PartDefinition` and `PartInstance` exist with stable ids, aliases, families, substitution groups and provenance; a part instance carries its submodel, step, semantic tags and provenance.
Connectors are typed and gendered with positions, axes and profiles, and connections are explicit edges.
Placement has a live ghost preview with a valid or blocked verdict, and refuses an unsupported placement at the command rather than flagging it afterwards.
Collision separates connector engagement from solid overlap: a stud may enter a matching clutch to a declared depth, and everything else that shares space is refused.
Colours are a stable palette of 45 ids, changing one edits instance data.
Undo and redo, project save and load, LDraw import and export, a searchable catalog panel grouped by family, and 640 unit plus 24 browser tests all exist.

**Partly built.**

Connector kinds are `stud` and `undersideClutch` only — nothing articulated.
Selection is single-part; there is no multi-select or box select.
The asset pipeline is a parametric generator plus the LDraw fact reader, with no mesh stage.
Collision does a one-dimensional sweep on x with an early break, which is sweep-and-prune, but connector lookup is linear.

**Not built at all.**

Physics: no engine, no compound bodies, no constraints, no simulation mode, no support model beyond the static placement check.
GPU instancing: one mesh per part, so a 1465-piece model is 1465 meshes.
Mass, centre of mass and inertia are absent from `PartDefinition`.
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

**4. Compound bodies and constraints.**
One rigid body per rigid component, not one per part and never one constraint per stud.
Constraints only for articulated edges. Rebuild only the components a change touched.
This is where an engine gets chosen; nothing above depends on which.

**5. Edit and simulation modes.**
Restore on exit first, apply later, because restore cannot corrupt a construction and apply can.

**6. Indexing and instancing, when measured.**
A connector index and instanced rendering are both real needs at 1465 parts and both are premature before a number says so.
The repository's rule is to build the measurable intermediate first, so these wait on a profile that names them.

## Notes on the demonstration

The specified vertical slice is a wheeled cart, which needs items 1 through 5 and a wheel, an axle and an axle-bearing brick in the catalog.
It is the right target: it exercises rigid assembly, articulation, support and simulation together, and none of it can be faked.

A useful intermediate exists first, though, and costs almost nothing: place two compatible parts, snap, save, reload, render.
Every piece of that already works here, so it is a regression test rather than a build.
