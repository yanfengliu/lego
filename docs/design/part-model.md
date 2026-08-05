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
The measurement-only 6651557 six-part pilot expands exact audited LDraw closures with BFC, inherited stud ancestry and the [official two-diagonal, at-most-3-degree legacy quad tolerance](https://www.ldraw.org/article/512.html), then independently rehashes and measures five Builder native records without emitting a definition. Its retained pressure report finds fractional LDraw bounds for 51739 and 93273, no checksum-valid Builder surface for 30357, non-upright connectivity for 5092, and collision frames outside the current axis-aligned representation for every available record. Those measurements reject rounding, omitted primitives and premature admission; the scored comparison they forced is the section below, and the fractional-bounds pressure it recorded is answered by the exact bound representation described there.
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
A version advances at the first production admission rather than at the contract change, so the preceding version stays a historical migration snapshot.
A part with no explicit stud offsets must keep hashing exactly as it did, so growing the model does not re-hash the parts already in it — and the same holds for exact bounds, which are absent from a part that does not declare them.
Layer 1 is derived and disposable; layers 2, 3 and 4 are truth.
Collision must stay conservative in the safe direction: an approximation may refuse a placement a real part would allow, and must never allow one it would not.

## Which source owns which layer

Two deliberately different strategies were built against the six-part pilot and scored on measurements, not on their own reports. Neither won outright, and the split is not a compromise — each layer went to whichever source can actually be checked.

**Layer 4, collision, comes from LDraw.** Per-column height-field decomposition of the expanded BFC surface into boxes and stud cylinders yields 37-276 bodies per part at 1.07-1.28x over-claim, and 3,400,701 sampled surface points with none outside the union. It needs no new body kind. The per-slab convex-prism alternative is far fewer bodies but over-claims up to 2.02x and produces 18-vertex hulls against the current 3-8 vertex limit.

**Builder collision is refused, and the reason is not preference.** Its authored boxes are inset a uniform 0.25 LDU on every horizontal face — the deliberate undersize this document already predicted of BrickLink Studio — so the real part escapes them by 0.25 to 4.675 LDU measured alignment-free, Builder's own mesh against Builder's own boxes in one frame, which is why no registration error can explain it. That is the one direction collision may never be wrong in. Uniform inflation does not rescue it: closing the escape needs 3.21-5.66 LDU of margin, after which the union overhangs the real part by up to 10.29 LDU per face and its volume grows 8.5 to 36.8 times.

**Layer 3, connectors, comes from Builder.** Its `Custom2DField` is a half-stud node lattice, and reading the top-plane field reproduces the LDraw-measured stud centres to 0.000 LDU with nothing unmatched in either direction. It wins because it carries something geometry does not contain: an *authored functional claim*. 5092 declares one clutch and codes the neighbouring cell absent — the exact cell the LDraw-led rule can only score 1 of 2 on, because the overhang is genuinely partial and no amount of measuring the shape settles what the part is for.

**Layer 2, bounds, comes from LDraw, exactly.** Every composed coordinate in all six closures is a terminating decimal, so a bound is signed integer units at a fixed 10^-9 scale, inside the safe-integer range. This is forced, not chosen: float64 round-trips five of the six parts and fails 93273, whose -16.00016098 is not a double.

That representation is implemented in `packages/catalog/src/exact-ldu.ts`, and its scope is narrow because the measurement is. Of the 96 coordinates the pilot reports across bounds, body bounds and stud bounds, 6 are not integers and only 2 are not float64 — both of them 93273's -16.00016098. Every stud-bound coordinate is an integer, so connectors do not need it, and the construction lattice is integer by definition, so placement does not either. Body extents carry it and nothing else does: placement transforms, connector positions and collision primitives keep their float64 vectors, and no placement, rendering or kernel code changed.

A part declares `exactBodyBoundsLdu` as canonical decimal text per axis; the factory parses it, derives the float64 `bodyBoundsLdu` and `boundsLdu` from it rather than accepting a second authored copy, and puts the exact decimal into the geometry digest so the hash binds the measured value and not the double it projects to. The declaration is bounded on both sides — a tenth fractional digit and units outside the safe-integer range are refusals that name the observed value, with 5.0e10 units the largest the pilot needs against a 9.007e15 ceiling — and the float64 projection is refused outright if it would fall inside the exact bound, because that is the one direction collision may not be wrong in. All six pilot bounds round-trip exactly and project outward or exactly; 93273's projection lands 4.2e-16 LDU outside its exact bound, eleven orders of magnitude below the renderer's own 1e-4 LDU Float32 tolerance, which this does not touch. The field is absent unless a part declares it, so all 77 definitions and the five truth digests are byte-identical: this is contract, and no part is admitted by it.

The one-declaration rule still holds, and has to be defended deliberately here, because taking connectors and bodies from different sources is exactly how they drift apart. A part is still declared once; the Builder-derived connector set is admitted only through a containment gate against the exact LDraw closure, so the two sources cannot disagree silently. That makes the LDraw expansion a hard prerequisite of the Builder path rather than a cross-check of it.

Known gaps, which are work items rather than caveats: 14 of the 121 required designs are absent from the Builder pack outright and fall back to the LDraw geometric rule; 20 required leaves depend on a node family the pilot never validated; only 5 of 107 records carry an external review pin. Builder physics is refused as mass truth on sight — 66 of 107 records declare mass exactly `1`, which makes a 1x2 tile outweigh a 1x4 curved slope.

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
