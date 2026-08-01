# Part model

How a brick is organised, indexed, defined, and constructed.

The catalog holds 55 parts and every one is a rectangular prism, because the generator can only make rectangular prisms.
The sample booklet's first fifty steps need wedge plates, arches, curved slopes, corner plates and cheese slopes, and 142 designs covering 856 pieces are missing across the set.
None of them are boxes, so the gap is not "more sizes" — it is a part model that can describe a shape at all.
This is that model.

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
A part's solid is a union of convex bodies: axis-aligned box, oriented box, cylinder, and right triangular prism.
That set covers this catalog's needs exactly — a wedge plate is a prism, an arch is two legs and a span with the void simply left uncovered, a curved slope is a prism plus a box.
Bodies are inset by a clearance epsilon so touching faces do not register, which is Studio's tolerance idea and the reason its collision is usable rather than maddening.
A stud may penetrate a matching clutch to its declared depth; that is the existing allowance mechanism and it stays.

## One declaration, four derivations

The layers are not authored separately. That is the mistake the shadow library exists to correct.

A part is declared once, as a list of **features**, and each feature emits its lattice cells, its connectors, and its bodies together:

- `body-box`, `body-wedge`, `body-cylinder` — solid, and the cells they fill
- `stud-field(origin, countX, countZ, stepX, stepZ)` — male connectors, their collision cylinders, and the cells they stud
- `clutch-field(...)` — female connectors and their allowances

Because one feature emits all three, geometry, connection and collision cannot drift apart.
They are the same statement read three ways.

The mesh is the exception, because it comes from outside, so it is **checked** rather than derived.
`scripts/ldraw-part-facts.mjs` already reads a part's true stud positions and body extents out of the official LDraw files.
Running it against a declaration is a real gate: it catches a wrong LDraw identifier and a wrong hand-authored declaration with the same test.
It has already earned this — run against twenty-three parts authored from memory, it found `34103`'s studs at plus and minus 10 where the declaration said 20.

## Identity

Canonical id stays `builtin:<family>-<size>`; it is ours and it does not move.
Aliases are namespaced, and LDraw hands us the cross-catalog ones for free in `!KEYWORDS` — BrickLink, Brickowl, Brickset, Rebrickable — so the identifier map is harvested, not typed.
Superseded identifiers must resolve: LDraw renamed `41770` to `41770a` and a catalog that only knows the new one cannot read an old document or an old booklet.
Families group the palette and must stay small enough to scan; substitution groups say which parts are interchangeable for a fit.

## Boundaries

Catalog truth is versioned: adding parts bumps `BUILTIN_CATALOG_VERSION`, extends `MIGRATABLE_CATALOG_VERSIONS`, and the migration report says what changed.
A part with no explicit stud offsets must keep hashing exactly as it did, so growing the model does not re-hash the parts already in it.
Layer 1 is derived and disposable; layers 2, 3 and 4 are truth.
Collision must stay conservative in the safe direction: an approximation may refuse a placement a real part would allow, and must never allow one it would not.

## Open decision

Using real LDraw meshes for layer 1 is a licensing choice, not a technical one, and it is the owner's.
LDraw parts are CC BY 4.0, which permits redistribution with attribution, so bundling them is allowed — but it flips this repository's current position, recorded in `docs/dependency-data-bom.md`, that no LDraw geometry is bundled and the role is identifiers only.
It would require preserving per-file authorship and licence, and permission to reuse geometry is still not permission to train on it.
The alternative is to keep generating our own geometry from the feature list, which costs fidelity on curves and gains nothing else.
Layers 2, 3 and 4 do not depend on this and can proceed either way.
