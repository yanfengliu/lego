# Part model

How a brick is organised, indexed, defined, and constructed.

The catalog held 55 parts and every one was a rectangular prism, because the generator could only make rectangular prisms.
The sample booklet's first fifty steps need wedge plates, arches, curved slopes, corner plates and cheese slopes, and 142 designs covering 856 pieces are missing across the set.
None of them are boxes, so the gap was not "more sizes" — it was a part model that can describe a shape at all.
This is that model.

It now holds 85, and five of its families are not rectangular prisms: wedge plates use a prism cut by a vertical plane, arches, curved slopes and cheese slopes use unions of measured boxes, and corner plates use either boxes or an analytic circular plan feature.

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
A connector is a physical claim, so inferred and project-authored cells carry a stud or clutch only where a whole stud footprint is backed by solid on that face — independently per face, because an arch's span is studded above and open below, and a corner plate's missing quarter is neither. Taking the cell centre instead would invent a grip wherever a conservative body overshoots the real part.
A cell that comes from an authored source rather than from a body is checked by the same standard read the other way round: the nominal stud volume it claims — 6 LDU radius, 4 LDU deep, driven in along the connector's own normal — must be free of source material, and the face must be open where the stud enters. Both are measured against the expanded source surface, so an authored claim is answered by geometry the author did not supply. The only exception is an explicit underside grip that exact source data identifies as intentionally straddling a curved outer edge: the complete normalized source-extracted connector set carries its own SHA-256, every exceptional offset is named, primary and independent source revisions and hashes are pinned, all of that evidence enters the catalog digest, and each exception is checked for its centre, inner-void and sector clearance, minimum backed area, and maximum outer overhang. It still opens collision allowance only for its exact validated connection; evidence never promotes adjacent cells or weakens the default whole-footprint rule.

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
The production asset registry holds the eight bundled set 6651557 meshes described under the admissions below; this capability does not turn pixels into connector or collision truth, and the other 77 parts remain parametric.
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
A new part is appended rather than interleaved, because catalog order is part of the truth digest: at `/7` and again at `/8` the 77 geometry content hashes are byte-identical to what they were at `/6`, which is what proves parts were added rather than seventy-seven regenerated.
Layer 1 is derived and disposable, but it is no longer generated: it is bundled source geometry, so it carries its own licence and attribution and is still never consulted by a validator. Layers 2, 3 and 4 are truth.
Collision must stay conservative in the safe direction: an approximation may refuse a placement a real part would allow, and must never allow one it would not.

## Which source owns which layer

Two deliberately different strategies were built against the six-part pilot and scored on measurements, not on their own reports. Neither won outright, and the split is not a compromise — each layer went to whichever source can actually be checked.

**Layer 4, collision, comes from LDraw.** Per-column height-field decomposition of the expanded BFC surface into boxes and stud cylinders yields 37-276 bodies per part at 1.07-1.28x over-claim, and 3,400,701 sampled surface points with none outside the union. It needs no new body kind. The per-slab convex-prism alternative is far fewer bodies but over-claims up to 2.02x and produces 18-vertex hulls against the current 3-8 vertex limit.

**Builder collision is refused, and the reason is not preference.** Its authored boxes are inset a uniform 0.25 LDU on every horizontal face — the deliberate undersize this document already predicted of BrickLink Studio — so the real part escapes them by 0.25 to 4.675 LDU measured alignment-free, Builder's own mesh against Builder's own boxes in one frame, which is why no registration error can explain it. That is the one direction collision may never be wrong in. Uniform inflation does not rescue it: closing the escape needs 3.21-5.66 LDU of margin, after which the union overhangs the real part by up to 10.29 LDU per face and its volume grows 8.5 to 36.8 times.

**Layer 3, connectors, comes from Builder.** Its `Custom2DField` is a half-stud node lattice, and reading the top-plane field reproduces the LDraw-measured stud centres to 0.000 LDU with nothing unmatched in either direction. It wins because it carries something geometry does not contain: an *authored functional claim*. 5092 declares one clutch and codes the neighbouring cell absent — the exact cell the LDraw-led rule can only score 1 of 2 on, because the overhang is genuinely partial and no amount of measuring the shape settles what the part is for.

**Layer 2, bounds, comes from LDraw, exactly.** Every composed coordinate in all six closures is a terminating decimal, so a bound is signed integer units at a fixed 10^-9 scale, inside the safe-integer range. This is forced, not chosen: float64 round-trips five of the six parts and fails 93273, whose -16.00016098 is not a double.

That representation is implemented in `packages/catalog/src/exact-ldu.ts`, and its scope is narrow because the measurement is. Of the 96 coordinates the pilot reports across bounds, body bounds and stud bounds, 6 are not integers and only 2 are not float64 — both of them 93273's -16.00016098. Every stud-bound coordinate is an integer, so connectors do not need it, and the construction lattice is integer by definition, so placement does not either. Body extents carry it and nothing else does: placement transforms, connector positions and collision primitives keep their float64 vectors, and no placement, rendering or kernel code changed.

A part declares `exactBodyBoundsLdu` as canonical decimal text per axis; the factory parses it, derives the float64 `bodyBoundsLdu` and `boundsLdu` from it rather than accepting a second authored copy, and puts the exact decimal into the geometry digest so the hash binds the measured value and not the double it projects to. The declaration is bounded on both sides — a tenth fractional digit and units outside the safe-integer range are refusals that name the observed value, with 5.0e10 units the largest the pilot needs against a 9.007e15 ceiling — and the float64 projection is refused outright if it would fall inside the exact bound, because that is the one direction collision may not be wrong in. All six pilot bounds round-trip exactly and project outward or exactly; 93273's projection lands 4.2e-16 LDU outside its exact bound, eleven orders of magnitude below the renderer's own 1e-4 LDU Float32 tolerance, which this does not touch. The field is absent unless a part declares it, so all 77 definitions are byte-identical: this is contract, and no part is admitted by it.

A scorer now measures a candidate against that split rather than an opinion of it, and its baseline says two things the strategy comparison could only argue.

The first is that the Builder refusal reproduces on demand: a Builder-style inset probe hard-fails all six parts with 1,962,029 of 3,400,701 sampled surface points outside the union and a maximum escape of 0.353553391 LDU, which is the measured 0.25 LDU face inset appearing at a corner as 0.25 times root two. The LDraw column candidate escapes nowhere at any swept column size.

The second is sharper, and it is why the Builder frame is now on the critical path rather than a convenience. The whole-footprint backing rule above emits **zero** clutch cells on all six parts, because an LDraw underside is a cavity and nothing solid backs the footprint at the bottom face. The measured tubes are not a substitute: they sit exactly 10 LDU — half a stud pitch — off the stud grid in at least one axis on every part. So female connectors are not recoverable from LDraw geometry at all, and Builder's authored field is not merely the better source for them, it is the only one. Female coverage is therefore reported and deliberately excluded from the composite score rather than folded in as a figure that looks like agreement.

The one-declaration rule still holds, and has to be defended deliberately here, because taking connectors and bodies from different sources is exactly how they drift apart. A part is still declared once; the Builder-derived connector set is admitted only through a containment gate against the exact LDraw closure, so the two sources cannot disagree silently. That makes the LDraw expansion a hard prerequisite of the Builder path rather than a cross-check of it.

### The frame that path needs

It is derived and pinned per part now, and four of the five available parts need no fitting at all.
A `Custom2DField` node sits at `0.4 * (col, 0, row)` Builder units from its own transformation, one Builder unit is exactly 25 LDU, and the native pack's declared `lego-builder-native-to-catalog-ldu/1` frame is `diag(25, -25, -25)`, so a frame is an integer matrix — a quarter turn about the vertical axis composed with that — plus an integer LDU translation, and every node lands on an exact rational LDU position with no arithmetic that could round. Under those frames Builder's family 0 and 1 nodes land on the LDraw-measured stud centres and its family 7 and 9 nodes on the LDraw-measured underside tube centres by rational equality, with nothing unmatched in either direction: 2/2, 4/4 and 5/5 studs, 1/1, 1/1 and 4/4 tubes, maximum positional error exactly 0. The turns are 0, 0, 0, 180 and 90 degrees and the translations reach 40 LDU, so origins do differ per part and there is no global constant to find.

An exact correspondence does not by itself give one frame, and treating it as if it did is the trap.
A square of four studs is invariant under every quarter turn, so 51739 and 93273 each admit eight exact frames; what matters is how many classes those fall into once the part's own measured self-symmetry is divided out, which is four and two. A surviving class ambiguity is settled by carrying Builder's own shell vertices through each candidate and measuring how far they land from the LDraw surface — 51739 chooses by a factor of 27.8 (0.172 LDU mean against 4.775) and 93273 by 18.5 (0.605 against 11.19) — while 35480 and 77844 leave exactly one class and need no witness at all.

5092 is the exception and is recorded as a fit rather than dressed up as a derivation.
It expands to 84 body triangles with no stud and no tube primitive, so nothing measured exists for its single authored clutch to correspond with. Its vertical offset is still exact, because every candidate matrix leaves the Y row alone and matching the two Y extents gives the same 8 LDU from both ends, disagreeing by 1.9e-6 LDU; its turn and horizontal translation come from a bounded search over the eight axis maps and the 10 LDU half-stud lattice, won by a factor of 4.88 at a 0.445 LDU mean residual. It is also the one pilot part with no self-symmetry, which makes it the only place handedness is measured rather than assumed: its best mirrored frame is 5.0 times worse, so no pilot frame needs a mirror.

Each frame carries a SHA-256 over its canonical form, binding design, Builder revision letter, Builder record digest, matrix and translation together, and the derivation re-runs from the pinned archives and pack on every pass and stops if what it derives is not what is pinned. Builder to LDraw to Builder is exactly the identity on all 226 authored nodes, in rational arithmetic.

What a field may emit is decided by measurement, not by what a family is called.
Under the pinned frames every family 0, 1 and 15 node — 27 of them — sits on its own part's 20 LDU cell lattice, and no family 7, 9, 18, 22 or 23 node ever does: the tube sits at the corner of four cells, the rail at the half pitch along one axis, the plane and edge markers at corners and edges. No stud can be held at a half pitch, so only 0 and 1 (male) and 15 (female) are emitted and the tubes and rails are reported as the geometry that makes a clutch grip rather than as grips. That is 16 clutch cells across the five parts — 1, 2, 4, 5 and 4 — against the zero the whole-footprint rule emits, every one of them on its part's own cell phase with zero pitch deviation. All 16 pass the stud-room check above; the worst intrusion is 0.115238 LDU and needs no allowance to explain, because an LDraw circle is an inscribed 16-gon and a socket wall nominally tangent to the stud reads as exactly `6 * (1 - cos(pi/16))` = 0.115288 LDU of material. The probe is not vacuous: a solid closed box with a clutch declared on its bottom face fails it.

30357 pays the whole price under Builder alone, and it is worth naming rather than averaging away.
It is absent from the 107-record pack, so it has no frame, no revision pin and no authored lattice, and the LDraw geometric rule leaves it 8 stud connectors and 0 clutch cells against the 4 underside tubes its own geometry carries. A part with studs and no clutches can be built on and can never be placed on anything, which is not a degraded part but a different one. The section below is the measured answer to exactly that part.

Known gaps, which are work items rather than caveats: 14 of the 121 required designs are absent from the Builder pack outright, of which the shadow library measured below answers 7 — three of those are now admitted and four were scored and refused for reasons recorded there — and the other 7 still fall back to the LDraw geometric rule; the pilot now validates nine node families (0, 1, 7, 9, 15, 18, 22, 23, 29) and leaves five the pack uses (2, 3, 5, 11, 16) unvalidated, along with the `Hinge`, `Axel`, `Fixed` and `Slider` connectivity kinds; only 5 of 107 records carry an external review pin. Builder physics is refused as mass truth on sight — 66 of 107 records declare mass exactly `1`, which makes a 1x2 tile outweigh a 1x4 curved slope.

### The third source, measured

The LDCad Shadow Library was the obvious candidate for the parts Builder has no record of, and it is now measured rather than assumed.

Licence first, because it decided for a while what the measurement was worth.
The library is CC BY-SA 4.0: stated in its README, shipped whole as `LICENSE.md`, and repeated in the header of every file read.
Reading it and recording numbers is permitted with attribution; shipping a connector set derived from a substantial portion of it is a ShareAlike obligation, and the licence's sui generis database-rights clause reaches an extracted database too, so the measurement stopped at the licence rather than at a number.
The owner resolved that on 2026-08-05: licence must not block this work, because it is private and noncommercial, so LDCad-derived connectors may be admitted.
The obligations that decision did not waive are carried rather than dropped — attribution travels with the derived data and is rendered into `docs/bundled-geometry-notices.md` from the catalog under a test, ShareAlike would attach to that derived data on redistribution, and training rights stay unheld — and all three are recorded in `docs/dependency-data-bom.md` beside the whole-tree manifest digest the reader verifies before parsing anything.
No shadow file is committed at any point: what is admitted is derived positions.

Reading a part's shadow information means walking its LDraw tree, not opening one file.
LDCad appends a shadow file to the identically named LDraw file during loading, so a snap written against `p/stud.dat` is inherited through the same type-1 matrix that places the geometry, and a whole anti-stud field compresses to one `[grid=...]` clause whose `C` prefix centres an axis. 93273 has no shadow file of its own and takes all four of its clutches from `parts/s/93273s01.dat`; 77844 has neither.

The walk validates itself before its female claims are read.
The library says nothing about where a stud is — it inherits `p/stud.dat` — so the composed male studs are matched against the LDraw-measured visible stud primitives first: 8 of 8 on 30357, 5 of 5 on 77844, 4 of 4 on 51739, 2 of 2 on 35480, maximum position error exactly 0 LDU on every part, nothing unmatched in either direction. A composition that could not place a stud could not be believed about a clutch.

Where both authored sources have a claim they agree exactly, and where they differ the difference is the finding.
5092, 35480 and 93273 are identical sets at 0 LDU — 1, 2 and 4 cells. 51739 reproduces all four Builder cells at 0 LDU and adds two more at (±30, 8, 10). 77844 is the reverse: Builder authors five clutches and LDCad authors none at all. So 11 of Builder's 16 cells are independently confirmed by a source that never saw Builder, 2 are LDCad-only and 5 are Builder-only, and neither source is a superset of the other.

Both disagreements are silence rather than contradiction, and the node census already recorded above is what shows it.
51739's Builder field carries two absent-coded nodes and both sit at the half pitch, so its 5x5 node lattice stops at ±20 LDU and never reaches the wing tips at ±30: Builder does not deny those cells, it does not describe them. 77844 is the same shape of gap from the other side — it has no shadow file anywhere in its LDraw closure, so LDCad has nothing to say about it, while Builder deliberately codes eight of its cells absent on the part's own lattice. Reading either silence as a denial would be inventing a claim neither source made.

Geometry answers whether a stud fits, and cannot answer who is right about the rest.
All 21 clutches emitted across the pilot pass the same stud-room probe against the expanded LDraw surface, including both disputed 51739 cells; the worst intrusion anywhere is 0.117147353 LDU against the 0.230576635 LDU bound. A sharper diagnostic is how far each claimed cell sits from a real underside tube: every cell the two sources agree on has a tube at a corner of its own cell, and the two LDCad-only cells on 51739 have their nearest tube a full 30 LDU away — but so do two cells *both* sources author on 93273, where walls rather than tubes do the gripping. It is evidence, not a verdict, and it is recorded as such.

30357 is what this was for.
The shadow library authors all eight of its clutches, at exactly the eight cells 8 LDU beneath its eight LDraw-measured studs, each with a tube at a corner, all eight with room for a stud, no hard fail, composite 0.988908. The worst two sit beside the rounded corner at 0.117147353 LDU of intrusion, which is 1.016 times the inscribed-16-gon sagitta and still under half the bound. The part that could be built on and never placed now has both faces.

Over all 121 required leaves: 112 have at least one shadow file somewhere in their LDraw closure, but only 55 carry an under-stud clutch, because the library's male studs come free from the primitives and its female fields are authored per part. Builder authors a clutch claim for 84. The two overlap on 38, Builder alone covers 46, LDCad alone covers 17 — including 7 of the 14 designs absent from the Builder pack (2450, 3814, 30357, 41682, 44237, 79491, 93888), three of which are admitted at `/8`. LDraw contributes 0, by construction rather than omission. That leaves 20 leaves with no female claim from any source (11090, 11610, 23443, 24482, 30374, 3245, 32828, 35464, 37846, 3818, 3819, 3820, 4519, 4569, 63965, 64647, 7126, 78258, 87994, 99563), of which 8 do carry some other female cylinder the shadow library authors — a minifig arm socket or a technic hole is a female snap and is not a place a stud is held.
One of the 20 is misfiled by that count and the report says so rather than letting it stand: 3245 is one of the four leaves with no selected LDraw source route, so there is no tree to walk, yet the shadow library holds seven files for its lettered variants and `3245b` declares a 6 by 44 LDU round female hole on a centred pair. Its gap is the route, not the source.

The measurement still admits nothing on its own. `scripts/derive-ldcad-shadow-connectors.py` emits no `PartDefinition`, bumps no catalog version, claims no catalog frame, reads the pinned Builder frame report without writing it, and refuses to run at all if the shadow tree is not the pinned checkout. Admission is the separate path in the section after next, which re-derives the same walk and scores what it emits before writing a table.

## Resolved decision

Layer 1 bundles real LDraw geometry. The owner decided this on 2026-08-04; it was a licensing choice, not a technical one.

The reason it had to be decided rather than deferred is the booklet: every claimed-built step is compared against its printed panel, so a generated approximation of a curve is not merely less pretty, it is a step that fails its own check for a reason that has nothing to do with whether the build is right.
Generating our own geometry "costs fidelity on curves and gains nothing else", and that cost lands directly on the one measurement the goal is scored by.

What the decision obliges, none of which is optional:
per-file authorship and licence are preserved for every bundled file;
`docs/dependency-data-bom.md` flips from "no LDraw geometry is bundled, identifiers only" to geometry bundled under CC BY 4.0 with attribution required, and the notices are regenerated with it;
and permission to reuse geometry is still **not** permission to train on it, which stays recorded as a separate and unheld right.

The BOM and notices flipped at the first admission that actually bundles a file, which is the one below — bundling is a claim about files that are present, so the record changed when the geometry did.
`docs/bundled-geometry-notices.md` is the attribution CC BY 4.0 requires, rendered from the catalog by a test that fails if the two disagree, so admitting or removing a file moves it in the same commit.
It names 84 files and 22 authors, and every one declares CC BY 4.0 in its own header. It also carries the CC BY-SA 4.0 attribution the LDCad-derived connector sets require, for the same reason and under the same test.
The npm notices file is generated from the lockfile alone and could not carry this; the geometry record is its own document rather than an appendix to a package inventory.

## The first admission

Five parts, at `builtin.basic-parts/7`. The version advanced here rather than when the mesh contract landed, so `/6` stays a historical migration snapshot and a document saved against it still carries forward.

| Part | LDraw | Composite | Bodies | Studs | Clutches | Mesh |
| --- | --- | --- | --- | --- | --- | --- |
| `builtin:tile-1x2-cut-right-45` | 5092 | 0.9947 | 44 | 0 | 1 | 84 triangles |
| `builtin:plate-1x2-round-end` | 35480 | 0.9712 | 74 | 2 | 2 | 604 |
| `builtin:wedge-plate-2x4-wing` | 51739 | 0.9901 | 119 | 4 | 4 | 424 |
| `builtin:corner-plate-3x3` | 77844 | 0.9961 | 55 | 5 | 5 | 485 |
| `builtin:curved-slope-1x4-double` | 93273 | 0.8937 | 275 | 0 | 4 | 328 |

The composites are the connector scorecards in the pinned frame report, which score the thing actually admitted — Builder's authored connectors over the LDraw column bodies — rather than either source alone.
Zero hard fails, 2,538,158 surface points sampled across the five with none outside the union, and all 16 clutch seats have room for a stud.
93273 scores lowest for a reason worth keeping visible: it has no stud connector at all, so it is not lattice-alignable and loses a third of its lattice-conformance component.
Its collision is also the most expensive in the catalog at 275 columns, which is what a curve costs at 1 LDU.

**30357 was deliberately not admitted here**, and the section below is where it arrives.
It is absent from the 107-record Builder pack, so LDraw alone gives it 8 stud connectors and zero clutch cells: a part that can be built on and can never be placed on anything is a different part, not a degraded one.
It waited on a licensing decision rather than on more measurement, and the decision came on 2026-08-05.

Each part carries an explicit source-to-catalog frame — a quarter turn about the vertical axis and a whole-LDU translation, applied exactly once — because the source frames are not centred and they differ per part.
5092, 35480 and 51739 turn 90 degrees so the catalog's width-first convention holds; 77844 and 93273 do not turn at all; the vertical translation is -4 for the four plate-height parts and +8 for 93273.
The raw horizontal frame is preserved rather than recentred, so 77844's corner still runs -10 to 50 LDU and the connector lattice is centred independently at (20, 20).

Two of the five need the exact bound representation and all five use it, because a measured part states its extents once: 51739's wing ends at 38.5 LDU and 93273's curve peaks at -8.00016098, which is not a float64.
The float64 pair every consumer reads is derived from the exact decimal rather than authored beside it, and 93273's projection lands 4.2e-16 LDU outside its exact bound, which is the safe direction for a minimum.

93273 also forced two rules to be stated properly rather than assumed.
Its underside is stepped, so two of its four clutches seat 8 LDU above the lowest plane; "a clutch sits at `bodyBounds.max[1]`" was a fact about flat parts, and the rule is now that a seat must be a plane the represented solid actually presents downward with none of that solid inside the stud footprint below it — which is strictly stronger for a flat part and correct for a stepped one.
And its curve stands 0.00016098 LDU proud of two plates, so the vertical-extents rule is now that the underside plane is exact, because placement rests the part there, while the top may stand proud of the nominal height and may never fall short of it.
The same pressure retired the whole-LDU requirement on extents and collision bodies: measured geometry is float64 and bounded by what the exact representation can carry, while connector positions, the lattice centre, the asset frame and the collision allowances stay whole LDU because those are lattice claims rather than measurements.

The mesh is the expanded BFC-corrected surface in its immutable asset-local LDraw frame, with one vertex per position the renderer can hold apart: composing a closure by two routes reaches the same corner with a 1e-15 LDU difference that Float32 cannot carry, and keeping both would declare vertices the pipeline then collapses. The merge is checked to leave every measured extent unmoved.

## The second admission, and the generator

Three parts, at `builtin.basic-parts/8`: the designs the Builder pack has no record of at all, whose female connectors the LDCad shadow library authored.

| Part | LDraw | Composite | Bodies | Studs | Clutches | Mesh |
| --- | --- | --- | --- | --- | --- | --- |
| `builtin:plate-3x3-corner-round` | 30357 | 0.988908 | 165 | 8 | 8 | 904 triangles |
| `builtin:wedge-plate-3x3-cut-corner` | 2450 | 0.989972 | 174 | 6 | 6 | 650 |
| `builtin:corner-plate-2x2-round` | 79491 | 0.990096 | 55 | 2 | 2 | 302 |

Every one of the 16 clutch cells sits 8 LDU beneath a stud the LDraw surface actually carries, so each part gained the face it was missing rather than a new claim: the clutch set and the stud set are the same cells read from below.
Zero hard fails; 16 of 16 seats have room for a stud; the worst intrusion anywhere is 30357's 0.117147353 LDU beside its rounded corner, which is 1.016 inscribed-16-gon sagittae and still under half the 0.230576635 LDU bound — tessellation, not material.

The number that moved is the booklet's, which is what this was for.
The retained catalog-coverage report's covered prefix ran to step 15, and step 16's only missing design was one of these three; so were 58, 134, 145, 347, 348 and 350.
Admitting them takes the first uncovered step from 16 to 26, a covered prefix of 15 to 25.

**Four more designs were scored and refused, and the reasons are measurements rather than preferences.**
44237 (`=Brick 2x6`) and 93888 (`=Brick 2x8`) score 0.983481 and 0.979484 with no hard fail and 12 and 16 clutch cells, and are refused on identity: their canonical ids are `builtin:brick-2x6` and `builtin:brick-2x8`, which the parametric definitions inside the pinned first-77 roster already hold. Admitting them would either duplicate an id or re-hash a part nobody changed.
41682 (`Bracket 2x2 - 1x2 Up Centred`) hard-fails `male-connector-over-claim` at composite 0: its two male studs compose at (±10, -10, -4) on an upstand facing horizontally, 6.325 LDU from the LDraw-measured visible stud primitives at (±10, -4, -6), which the measured blueprint's vertical-seat contract cannot express.
3814 routes to `parts/973.dat`, a Minifig Torso; it hard-fails the same check at composite 0 with one composed male snap of shape R6x12 — a neck post — against zero visible stud primitives, and it has no family in this catalog's taxonomy either.

**The generator is promoted, which the first admission's was not.**
`/7`'s tables were emitted from a scratch script that no longer exists, leaving generated files in Git with no way to reproduce them. The path is now real:

```
python -B scripts/emit-measured-part-tables.py   --official <ldraw-complete-2026-07.zip>   --unofficial <ldraw-unofficial-2026-08-02.zip>   --shadow <ldcad-shadow-20260802>
npx prettier --write packages/catalog/src/mesh-assets-6651557.ts   packages/catalog/src/part-blueprints-6651557-measured.ts   packages/catalog/src/ldraw-bundled-sources-6651557.ts
```

It measures each part once and emits the mesh, the collision decomposition, the connectors and the per-file attribution from that one measurement, so the four cannot describe different geometry; it scores every part with the existing part-admission scorer first and writes nothing at all if any part hard-fails. `scripts/measured_part_plan.py` is the only hand-authored input — a catalog id, a lattice height, a quarter turn and a whole-LDU translation per part — and `scripts/measured_part_tables_test.py` gates the pure half under `npm run test:python` without needing the 230 MB of pinned archives.
Its correctness against the archives was established the only way that settles it: re-running it over the five `/7` parts alone reproduces `part-blueprints-6651557-measured.ts` byte for byte, and the mesh and attribution tables to the word, so the tables the catalog already shipped were regenerated rather than restated.
Layers 2, 3 and 4 never depended on the mesh and are derived from measured source either way.
