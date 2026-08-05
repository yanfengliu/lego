# Part model

How a brick is organised, indexed, defined, and constructed.

The catalog held 55 parts and every one was a rectangular prism, because the generator could only make rectangular prisms.
The sample booklet's first fifty steps need wedge plates, arches, curved slopes, corner plates and cheese slopes, and 142 designs covering 856 pieces are missing across the set.
None of them are boxes, so the gap was not "more sizes" — it was a part model that can describe a shape at all.
This is that model.

It now holds 77, and five of its families are not rectangular prisms: wedge plates use a prism cut by a vertical plane, arches, curved slopes and cheese slopes use unions of measured boxes, and corner plates use either boxes or an analytic circular plan feature.

## What the other tools do

Worth knowing before inventing anything, because three mature tools have already paid for these lessons.

**LDraw** defines geometry and nothing else.
A part is a tree of subfile references, each a 3x3 matrix and a translation, bottoming out in a shared primitive library — `stud.dat`, `stug-1x4.dat`, cylinders, boxes.
Composition, not hand-modelling, is what makes 16,873 parts tractable, and it is the single best idea in the ecosystem.
Identity is the part number, with renames handled by `~Moved to` indirection files, and cross-catalog identifiers for BrickLink, Brickowl, Brickset and Rebrickable carried in `!KEYWORDS`.
It has no notion of connection or collision.

**LDCad** patches that gap from outside with a *shadow library*: a parallel tree of files that add connectivity metadata to parts they do not own.
Connections are typed, gendered snap metas — `SNAP_CYL` for holes and pegs, `SNAP_CLP` for clips, `SNAP_FGR` for interlocking fingers, `SNAP_GEN` for everything else.
A whole stud field compresses to one line: `SNAP_CYL [gender=F] [caps=one] [secs=R 6 4] [pos=0 8 0] [grid=C 4 C 2 20 20]` is the entire 4x2 anti-stud grid of a 2x4 plate.
The profile `R 6 4` is a round section of radius 6 and length 4 — the same numbers this catalog already uses for a stud.
Matching is male against female, coaxial, with the profile deciding whether the fit is real.

**BrickLink Studio** ships collision as `.col` files holding **axis-aligned boxes and nothing else**.
No rotation, no meshes, no convex decomposition; complex parts like a boat hull are approximated by many boxes.
The boxes are deliberately *slightly smaller than the part*, and collision fires only past a threshold overlap rather than on contact.

**LEGO Digital Designer** used oriented boxes for collision, a typed 2D grid per stud field for connectivity, an explicit AABB, and a physics block with mass and inertia.

Two conclusions carry directly.
A union of simple convex bodies is enough for collision — the commercial tool ships it, so we do not need meshes or GJK.
And connectivity bolted on after the fact is never finished, which is why the shadow library exists and why it still has gaps: whoever owns the geometry should own the connections in the same breath.

## Four layers

Each layer is a different representation, fit for a different job, and none of them is a substitute for another.

**1. Mesh assets — what it looks like.**
Real part geometry, for rendering only.
Never authoritative for placement, connection, or collision, and never consulted by a validator.
A pixel cannot prove a graph correct.

**2. Integer construction lattice — where it sits.**
Every placement is integer LDU: stud pitch 20, plate 8 tall, brick 24, the build plate at +12, stud centres on the 20n+10 lattice.
A part occupies a set of integer cells, indexed as a 2D footprint mask times a height in plates.
This is the fast layer: enumeration, support and the great majority of pruning run here and never touch geometry.
It is exact for lattice-aligned parts, which is nearly all of them; anything placed off-lattice is excluded from lattice reasoning and falls through to layer 4.

**3. Explicit connector graph — how it attaches.**
Typed, gendered connectors, each with a position, an axis, and a profile, following LDCad's model because it is the one that has been tested against the whole library.
Today: `stud` male and `undersideClutch` female. Next: `bar`, `clip`, `pin`, `axle`, `socket`.
A match requires compatible kinds, opposed genders, a shared axis within tolerance, and profiles that actually fit.
Authoring uses grid compression; the graph is expanded at build time so nothing downstream has to understand a grid.

**4. Compound-body physics — what it displaces.**
A part's solid is a union of convex bodies: axis-aligned box, cylinder, right prism cut by a vertical plane, or vertical prism with a strictly convex plan polygon.
Plan bodies use their exact authored polygons. Collision requires a strictly positive overlap area, so faces that merely touch do not register; sampled arc bodies are the one conservative exception and may expand outward only within their measured approximation bound.
A stud may penetrate a matching clutch to its declared depth; that is the existing allowance mechanism and it stays.

The prism's cut is *vertical*, which decides how a shape gets represented and is the thing that is easy to get wrong.
A wedge plate tapers in plan, so it is one prism and the cut is exact.
A slope falls away in elevation, so no cut expresses it and it is not one primitive of any kind: it becomes a staircase of boxes, each as tall as the highest point of the real profile over its own span.
An arch is the same idea upside down — legs, a span, and steps following the curve down from the flat top.
Where a staircase is wrong it claims material the part does not have, which is the direction the collision model is allowed to be wrong in.
The steps are measured, not guessed: `scripts/ldraw-part-facts.mjs` gives the extents and stud positions, and ray-casting the flattened part gives the profile between them.
Parity is useless on these files — LDraw builds hollows out of open primitives, so "inside" is undefined — but containment is not: every point of the real surface must lie inside the union, and that is what was checked before these parts landed.

A circular sector or ring is authored once as its exact centre, inner and outer radii, angular sweep, and optional endpoint caps.
Rendering and palette previews sample that source directly as one smooth body; collision and physics derive disjoint convex prisms whose outer edges are tangents and inner edges are chords, so they conservatively contain the source without exposing their seams.
The quarter-ring parts use twelve slices per quarter: the maximum radial expansion is under 0.2 LDU and is pinned by tests rather than chosen by appearance.

A union also decides where a part grips.
A connector is a physical claim, so inferred and project-authored cells carry a stud or clutch only where a whole stud footprint is backed by solid on that face — independently per face, because an arch's span is studded above and open below, and a corner plate's missing quarter is neither. Taking the cell centre instead would invent a grip wherever a conservative body overshoots the real part. The only exception is an explicit underside grip that exact source data identifies as intentionally straddling a curved outer edge: the complete normalized source-extracted connector set carries its own SHA-256, every exceptional offset is named, primary and independent source revisions and hashes are pinned, all of that evidence enters the catalog digest, and each exception is checked for its centre, inner-void and sector clearance, minimum backed area, and maximum outer overhang. It still opens collision allowance only for its exact validated connection; evidence never promotes adjacent cells or weakens the default whole-footprint rule.

## One declaration, four derivations

The layers are not authored separately. That is the mistake the shadow library exists to correct.

A part is declared once, as a list of **features**, and each feature emits its lattice cells, its connectors, and its bodies together:

- `body-box`, `body-wedge`, `body-cylinder`, `body-arc` — solid, and the cells they fill
- `stud-field(origin, countX, countZ, stepX, stepZ)` — male connectors, their collision cylinders, and the cells they stud
- `clutch-field(...)` — female connectors and their allowances

Because one feature emits all three, geometry, connection and collision cannot drift apart.
They are the same statement read three ways.

The mesh is the exception, because it comes from outside, so it is **checked** rather than derived.
The renderer now has a closed preloaded-mesh capability: a catalog recipe names a bounded asset and exact content hash, an explicit asset-local-to-catalog frame is applied once independently of any optional LDraw interchange frame, and an admission gate checks provenance, frame, connector-grid centre, connector/collision consistency, body bounds and visual bounds before a definition may use it.
The production asset registry is still empty and no catalog part is mesh-backed yet; this capability does not turn pixels into connector or collision truth.
The measurement-only 6651557 six-part pilot expands exact audited LDraw closures with BFC, inherited stud ancestry and the [official two-diagonal, at-most-3-degree legacy quad tolerance](https://www.ldraw.org/article/512.html), then independently rehashes and measures five Builder native records without emitting a definition. Its retained pressure report finds fractional LDraw bounds for 51739 and 93273, no checksum-valid Builder surface for 30357, non-upright connectivity for 5092, and collision frames outside the current axis-aligned representation for every available record. Those measurements reject rounding, omitted primitives and premature admission; the source-integrity unit has passed fresh adversarial approval, but it does not choose a new catalog contract, so a scored comparison of distinct LDraw- and Builder-led strategies still comes first.
`scripts/ldraw-part-facts.mjs` already reads a part's true stud positions and body extents out of the official LDraw files.
Running it against a declaration is a real gate: it catches a wrong LDraw identifier and a wrong hand-authored declaration with the same test.
It has already earned this — run against twenty-three parts authored from memory, it found `34103`'s studs at plus and minus 10 where the declaration said 20.

## Identity

Canonical id stays `builtin:<family>-<size>`; it is ours and it does not move.
Aliases are namespaced, and LDraw hands us the cross-catalog ones for free in `!KEYWORDS` — BrickLink, Brickowl, Brickset, Rebrickable — so the identifier map is harvested, not typed.
Superseded identifiers must resolve: LDraw renamed `41770` to `41770a` and a catalog that only knows the new one cannot read an old document or an old booklet.
When an LDraw file's local axes differ from the catalog's width-first frame, the part declaration records the finite LDraw-to-catalog orientation; export composes it and import composes its inverse so the canonical document transform never silently rotates.
Families group the palette and must stay small enough to scan; substitution groups say which parts are interchangeable for a fit.

## Boundaries

Catalog truth is versioned: adding parts bumps `BUILTIN_CATALOG_VERSION`, extends `MIGRATABLE_CATALOG_VERSIONS`, and the migration report says what changed.
A part with no explicit stud offsets must keep hashing exactly as it did, so growing the model does not re-hash the parts already in it.
Layer 1 is derived and disposable; layers 2, 3 and 4 are truth.
Collision must stay conservative in the safe direction: an approximation may refuse a placement a real part would allow, and must never allow one it would not.

## Resolved decision

Layer 1 bundles real LDraw geometry. The owner decided this on 2026-08-04; it was a licensing choice, not a technical one.

The reason it had to be decided rather than deferred is the booklet: every claimed-built step is compared against its printed panel, so a generated approximation of a curve is not merely less pretty, it is a step that fails its own check for a reason that has nothing to do with whether the build is right.
Generating our own geometry "costs fidelity on curves and gains nothing else", and that cost lands directly on the one measurement the goal is scored by.

What the decision obliges, none of which is optional:
per-file authorship and licence are preserved for every bundled file;
`docs/dependency-data-bom.md` flips from "no LDraw geometry is bundled, identifiers only" to geometry bundled under CC BY 4.0 with attribution required, and the third-party notices are regenerated with it;
and permission to reuse geometry is still **not** permission to train on it, which stays recorded as a separate and unheld right.

The BOM and notices flip at first admission, not now — bundling is a claim about files that are actually present, so the record changes when the geometry does.
Layers 2, 3 and 4 never depended on this and are derived from measured source either way.
