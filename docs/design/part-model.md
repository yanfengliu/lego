# Part model and catalog truth

Status date: 2026-08-10

This document owns how a part is identified, represented, sourced, derived, checked, admitted, and versioned. [`spec.md`](spec.md) owns document and validator semantics, [`building-system.md`](building-system.md) owns the current product frontier, and [`dependency-data-bom.md`](../dependency-data-bom.md) owns source, license, and allowed-role records.

## Current catalog

The builtin catalog is `builtin.basic-parts/12` with 85 definitions: 73 render from repository-authored parametric recipes and 12 render exact surfaces from bounded, content-hashed LDraw closures. Four of those mesh surfaces replace earlier parametric render recipes in place, so the catalog count did not grow.

The four render-only promotions are `wedge-plate-4x4-cut-corner` (`30503`), `wedge-plate-6x6-cut-corner` (`6106`), `corner-plate-4x4-round` (`30565`), and `corner-plate-5x5-quarter-ring` (`80015`). Their exact visible mesh and bounds come from LDraw, while their previous connector and collision arrays remain byte-for-byte unchanged and the mesh recipe labels that collision `preserved-catalog-recipe`; the conservative collision can fill visible voids and is not a claim of hollow physical truth.

The tracked booklet has 121 distinct required leaf design identities. That is not an 85-of-121 coverage fraction: catalog definitions include parts outside that set, aliases and design identities do not share one denominator, and some booklet callouts remain unidentified. The prepared coverage frontier currently reaches printed step 25; printed step 26 first requires design `28802`.

The part standard is not green. Twelve definitions declare underside clutches but still render a flat semantic seat grid instead of the cavity, walls, and tubes visible from below. `npm run parts:check` reports all twelve under `underside-is-drawn`, and the command is not yet part of `npm run verify`.

## One part, four representations

Each representation answers a different question. None may be treated as authority for another.

### 1. Render surface

The renderer and palette preview derive visible geometry from the catalog definition. Parametric parts derive it from bounded features; the 12 mesh-rendered parts use preloaded LDraw surfaces with a pinned content hash and one explicit asset-to-catalog frame.

The render surface is disposable view data. It never authorizes a placement, connection, collision waiver, catalog admission, or physical claim.

### 2. Construction lattice and bounds

Placement uses LDraw units and legal catalog orientations. Footprints, nominal heights, exact body bounds where required, and connector centres provide the fast lattice used for enumeration and pruning.

Exact decimal bounds exist only where measured source coordinates cannot be represented inward safely as ordinary binary floats. The catalog derives the float projection from that one exact declaration and refuses a projection that would fall inside the measured body.

Off-lattice articulated poses do not become lattice truth. They retain their rigid transform and use the geometric validators.

### 3. Connection field

Catalog connection metadata and placement discovery use typed ports with local transforms, capacity, gender, profile, and compatibility. The ten implemented catalog kinds are `stud`, `undersideClutch`, `axle`, `axleHole`, `pin`, `pinHole`, `bar`, `clip`, `hinge`, and `hingeSocket`.

Six pair rules define stud/clutch, axle/axle-hole, axle/pin-hole, pin/pin-hole, bar/clip, and hinge/hinge-socket behavior. Rotation and articulation belong to the pair: an axle is rigid in an axle hole and revolute in a round pin hole.

Placement discovery consumes those catalog rules, but the current document and build-program wire contracts serialize every connection edge as `stud-tube`; the referenced ports carry the actual pair. The protocol must grow a versioned pair identity before all ten kinds are represented end to end.

A visible cylinder or cavity does not prove a functional connector. Authored Builder or LDCad fields may supply that claim only through a pinned source and frame, and the claimed insertion volume and backing are checked against independent geometry.

### 4. Collision and physics

Collision is a bounded union of simple primitives suitable for deterministic validation and compound rigid bodies. It must conservatively contain material that exists while leaving functional cavities and connector insertion paths open.

Parametric features derive collision together with visible geometry where that derivation is justified. Eight measured-only LDraw definitions use column height fields that cover their source surface; the four render-only promotions preserve their earlier parametric collision instead. Both are conservative occupancy approximations that may fill internal voids, not connector truth or proof of physical insertion.

Physics derives rigid components and joints from the connection graph, then builds compound bodies and geometric mass properties from the collision layer. Physical mass remains unknown in current inventory metadata; a source default such as Builder's repeated mass value is not accepted as truth.

## One declaration, checked derivations

Repository-authored parts use blueprints so one bounded declaration produces the render recipe, nominal bounds, connector field, collision primitives, legal orientations, search metadata, and part-standard facts.

The core feature vocabulary includes boxes and plates, stud fields, underside shells and grip structures, slopes, curved profiles, cut corners, rings, bars, pins, axles, clips, and hinges. A feature may emit only the representations it can justify; missing geometry is a failing standard, not an invitation to add a silent exception.

External meshes are the deliberate exception to derivation. The generation and test path binds the asset hash and provenance, expands the source closure within strict limits, applies one explicit frame, verifies bounds and orientation, checks connector and collision consistency, and ensures the palette and viewport render the same asset. Those automated checks do not admit a part by themselves: admission remains a reviewed catalog change with source records, visual inspection, migration, and repository gates.

## Semantic part standard

A part must draw what it claims.

- A declared stud is visible and occupies its declared connector centre.
- A declared underside clutch has a visible entrance, cavity, walls, and grip geometry from below.
- Collision does not seal a functional insertion path or omit represented outer material.
- Visual bounds contain the render without silently rounding a measured extent inward; collision is checked under its declared mesh-derived or preserved-recipe mode rather than assumed to share those bounds.
- A connector is backed and reachable in its own insertion direction.
- Chiral identity, legal orientation, and the asset frame agree with the visible hand.
- Palette preview, scene render, canonical capture, collision, and connection metadata resolve from the same catalog definition.

`scripts/check-part-standard.mjs` and `packages/catalog/src/part-standard.ts` automate seven present rules: underside geometry is drawn, stud radius is exact, geometry modes and collision are declared, clutch-bearing bodies are hollow, outer bounds contain the body, and stud extent matches its declaration. Connector reachability and compatibility, chirality and frames, render/collision parity, palette parity, and canonical visual inspection remain admission obligations enforced by focused catalog/render/browser tests and review rather than by `parts:check` alone.

A new automated exception belongs in the shared rule with evidence and a reason; an individual part is never exempted quietly.

## Current underside gap

The printed panel for step 4 is the first strong underside witness in the retained booklet prefix: it visibly contains perimeter and inner walls, hollow clutch rings, ribs, and cavities where the former render showed an almost solid slab. The four `/12` render-only promotions correct the exact visible surfaces implicated by that panel, but steps 4 and 5 remain provisional until the prefix is rerun, and their preserved conservative collision does not establish that those voids are physically usable.

The following twelve definitions still fail because a semantic tube-seat mode declares clutch seats but draws no underside shell: eleven use `semantic-tube-seat-grid`, while `wedge-plate-3x6-right` uses `semantic-tube-seat-offsets`.

- Wedge plates: `wedge-plate-2x4-left`, `wedge-plate-2x4-right`, `wedge-plate-2x3-left`, `wedge-plate-2x3-right`, and `wedge-plate-3x6-right`.
- Arches: `arch-1x4` and `arch-1x6`.
- Curved slopes: `curved-slope-1x2`, `curved-slope-1x3`, and `curved-slope-1x4`.
- Cheese slopes: `cheese-slope-1x1` and `cheese-slope-2x1`.

Their pinned LDraw closures have already been measured; mirrored hands share the same measurement and are grouped here so the twelve-part count remains explicit.

| Catalog part or mirrored pair | LDraw design | Measured underside |
| --- | --- | --- |
| `wedge-plate-2x4-left` / `right` | `41770a` / `41769a` | 4-LDU cavity; area 1,713 LDU² |
| `wedge-plate-2x3-left` / `right` | `43723a` / `43722a` | 4-LDU cavity; area 1,246 LDU² |
| `wedge-plate-3x6-right` | `54383` | 4-LDU cavity; area 3,841 LDU² |
| `arch-1x4` | `3659` | Cavity 4 LDU from the top; 768 LDU²; 8-LDU end walls |
| `arch-1x6` | `3455` | Cavity 4 LDU from the top; 1,248 LDU²; 8-LDU end walls |
| `curved-slope-1x2` | `11477` | Stepped levels 12, 10, 8, and 4 LDU above the bottom |
| `curved-slope-1x3` | `50950` | Stepped levels 8, 4, and 1 LDU above the bottom |
| `curved-slope-1x4` | `61678` | Stepped levels 20, 16, 8, 4, and 0.2 LDU above the bottom |
| `cheese-slope-1x1` | `54200` | 1-LDU recess over most of the underside; 4-LDU, 4-LDU² pocket |
| `cheese-slope-2x1` | `85984` | 1-LDU recess over most of the underside; 4-LDU, 8-LDU² pocket |

The remaining wedge families need shell rings around an approximately 4-LDU cavity. Arches retain their measured end-wall thickness, curved slopes have stepped undersides, and cheese slopes have a local recess rather than a full plate cavity. A generic plate rule would make all three families wrong in different ways.

All twelve official roots are present in the pinned LDraw sources. A measured render-only projection for the complete tranche expands the generated asset table from 12 to 24 meshes and 321,069 to 450,588 bytes, with total triangles moving 10,492 to 14,919; doing only the six catalog definitions referenced by the set-6651557 coverage saves just 47,170 generated bytes. Those coverage rows account for 42 pieces, beginning with `54383` at printed step 6; the `41769a` and `41770a` rows remain variant outcomes rather than exact design-identity matches.

That render projection cannot supply connector or collision truth. The pinned LDCad female-seat replay agrees with the current XZ centres only for `11477`, `54200`, and `85984`; supplies no seats for `41770a`, `41769a`, `43723a`, `43722a`, `3659`, `3455`, or `50950`; and disagrees for `61678` and `54383`. The repair must therefore preserve every current connector, allowance, and collision value byte-for-byte unless a separate authored source and review deliberately changes it.

All 12 mesh-rendered parts draw their source surfaces. The eight measured-only definitions still use column height-field collision, while the four render-only promotions retain their earlier conservative collision; neither mode proves hollow collision parity because a polygon surface has no intrinsic inside and both approximations may fill voids.

The exit is visual and structural: all twelve remaining definitions pass the standard, canonical top, bottom, front, back, left, right, isometric, and underside-oblique captures show every observable surface, collision leaves functional cavities usable, and the real-booklet prefix is rerun before its underside-dependent steps are called verified. A surface not exposed by those views or by a later booklet panel is recorded as `not-observable`, never certified from absent pixels.

## Identity and versioning

A `PartDefinition` carries a namespaced catalog ID, real LDraw design identifier and aliases, family and searchable name, geometry recipe and content hash, bounds, collision primitives, connectors, legal orientations, available colors, a substitution-group identifier, inventory metadata with physical mass currently unset, and source/license/attribution provenance.

Catalog IDs are semantic identities, not filenames. A changed shape, connector field, collision model, hand, or source frame is changed truth even when the display name remains similar.

Every admission advances `BUILTIN_CATALOG_VERSION`, adds the previous snapshot to `MIGRATABLE_CATALOG_VERSIONS`, and makes migration produce an explicit report. Saved documents pin their catalog and other truth snapshots and are never silently reinterpreted under `/12` or a later version.

The catalog digest binds every field that can change geometry, placement, connection, validation, migration, or provenance. Cosmetic search text may be excluded only by an explicit canonicalization rule.

## Source ownership

Repository-authored parametric blueprints own their declared geometry. LDraw owns the bundled render surface and exact bounds of the 12 mesh-rendered parts, with file-level authorship preserved. Builder and the LDCad Shadow Library may provide authored connector fields after their exact records, transforms, and licenses are pinned and independently checked; the four render-only promotions instead retain their preceding catalog connector arrays.

Builder collision is not catalog truth: its deliberately inset boxes allow measured material to escape. Builder mass is not catalog truth: many unrelated records carry the same placeholder value. LDraw geometry alone supplies no female functional claim, and LDCad-derived connector positions remain separately attributed under their source terms.

Every source's origin, revision, license, attribution, redistribution and training rights, and allowed role live in the bill of materials. Permission to render geometry never implies permission to train on it.

## Admission checklist

The complete matched-view rule was established during `/12` review, after the four promotions had already been admitted. The tracked tests exercise palette and limited presentation-scene captures, and the devlog retains the printed-step conclusion, but no reproducible source-versus-render packet with image hashes, camera policy, and review outcomes survives for `30503`, `6106`, `30565`, or `80015`. All four packets are explicit review debt; prior visual inspection is not promoted into reproducible evidence by prose alone.

Before any catalog-truth version after `/12` may enter, every new or modified part must satisfy all of the following. The twelve current `underside-is-drawn` failures predate the complete standard and remain grandfathered geometry debt; they must be repaired before `parts:check` joins `verify`, and reproducible matched-view packets for all four `/12` promotions must also be closed.

1. Its stable catalog identity, family, real design identifier, hand, aliases, and searchable name are settled.
2. Every source file, closure, revision, content hash, license, attribution, and allowed role is recorded.
3. One catalog frame aligns visible geometry, exact or conservative bounds, connector centres, collision, and legal orientations.
4. The part standard passes, including matched top, bottom, front, back, left, right, isometric, and underside-oblique visual inspection; unexposed internal or hidden surfaces are named `not-observable` rather than inferred from silence.
5. Connector claims have an authored or repository-owned basis and pass insertion, backing, capacity, compatibility, and geometry checks.
6. Collision contains outer material, preserves functional voids, and stays within primitive and resource limits.
7. Palette search and preview expose the exact geometry the editor places.
8. Catalog version, migratable versions, migration report, schema fixtures, notices, and bill of materials are updated.
9. Focused catalog, renderer, migration, LDraw, and browser tests pass, followed by the authoritative gates; these checks support but do not replace reviewed admission.

Missing parts remain work items. A booklet step is never completed by substituting a visually similar design, dropping a piece, mirroring a hand, or weakening a hard check.
