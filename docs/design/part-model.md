# Part model and catalog truth

Status date: 2026-08-10

This document owns how a part is identified, represented, sourced, derived, checked, admitted, and versioned. [`spec.md`](spec.md) owns document and validator semantics, [`building-system.md`](building-system.md) owns the current product frontier, and [`dependency-data-bom.md`](../dependency-data-bom.md) owns source, license, and allowed-role records.

## Current catalog

The builtin catalog is `builtin.basic-parts/11` with 85 definitions: 77 repository-authored parametric definitions and eight definitions rendered from bounded, content-hashed LDraw closures.

The tracked booklet has 121 distinct required leaf design identities. That is not an 85-of-121 coverage fraction: catalog definitions include parts outside that set, aliases and design identities do not share one denominator, and some booklet callouts remain unidentified. The prepared coverage frontier currently reaches printed step 25; printed step 26 first requires design `28802`.

The part standard is not green. Sixteen definitions declare underside clutches but still render a flat semantic seat grid instead of the cavity, walls, and tubes visible from below. `npm run parts:check` reports all sixteen under `underside-is-drawn`, and the command is not yet part of `npm run verify`.

## One part, four representations

Each representation answers a different question. None may be treated as authority for another.

### 1. Render surface

The renderer and palette preview derive visible geometry from the catalog definition. Parametric parts derive it from bounded features; the eight measured parts use preloaded LDraw meshes with a pinned content hash and one explicit asset-to-catalog frame.

The render surface is disposable view data. It never authorizes a placement, connection, collision waiver, catalog admission, or physical claim.

### 2. Construction lattice and bounds

Placement uses LDraw units and legal catalog orientations. Footprints, nominal heights, exact body bounds where required, and connector centres provide the fast lattice used for enumeration and pruning.

Exact decimal bounds exist only where measured source coordinates cannot be represented inward safely as ordinary binary floats. The catalog derives the float projection from that one exact declaration and refuses a projection that would fall inside the measured body.

Off-lattice articulated poses do not become lattice truth. They retain their rigid transform and use the geometric validators.

### 3. Connection field

Connections are explicit typed ports with local transforms, capacity, gender, profile, and compatibility. The ten implemented kinds are `stud`, `undersideClutch`, `axle`, `axleHole`, `pin`, `pinHole`, `bar`, `clip`, `hinge`, and `hingeSocket`.

Six pair rules define stud/clutch, axle/axle-hole, axle/pin-hole, pin/pin-hole, bar/clip, and hinge/hinge-socket behavior. Rotation and articulation belong to the pair: an axle is rigid in an axle hole and revolute in a round pin hole.

Placement discovery consumes those catalog rules, but the current document and build-program wire contracts serialize every connection edge as `stud-tube`; the referenced ports carry the actual pair. The protocol must grow a versioned pair identity before all ten kinds are represented end to end.

A visible cylinder or cavity does not prove a functional connector. Authored Builder or LDCad fields may supply that claim only through a pinned source and frame, and the claimed insertion volume and backing are checked against independent geometry.

### 4. Collision and physics

Collision is a bounded union of simple primitives suitable for deterministic validation and compound rigid bodies. It must conservatively contain material that exists while leaving functional cavities and connector insertion paths open.

Parametric features derive collision together with visible geometry where the representation supports that derivation. The measured LDraw parts use column height fields that cover their source surface, but those fields can fill internal voids; they are an occupancy approximation, not connector truth or a proof of physical insertion.

Physics derives rigid components and joints from the connection graph, then builds compound bodies and geometric mass properties from the collision layer. Physical mass remains unknown in current inventory metadata; a source default such as Builder's repeated mass value is not accepted as truth.

## One declaration, checked derivations

Repository-authored parts use blueprints so one bounded declaration produces the render recipe, nominal bounds, connector field, collision primitives, legal orientations, search metadata, and part-standard facts.

The core feature vocabulary includes boxes and plates, stud fields, underside shells and grip structures, slopes, curved profiles, cut corners, rings, bars, pins, axles, clips, and hinges. A feature may emit only the representations it can justify; missing geometry is a failing standard, not an invitation to add a silent exception.

External meshes are the deliberate exception to derivation. They are checked rather than trusted: admission binds the asset hash and provenance, expands the source closure within strict limits, applies one explicit frame, verifies bounds and orientation, checks connector and collision consistency, and ensures the palette and viewport render the same asset.

## Semantic part standard

A part must draw what it claims.

- A declared stud is visible and occupies its declared connector centre.
- A declared underside clutch has a visible entrance, cavity, walls, and grip geometry from below.
- Collision does not seal a functional insertion path or omit represented outer material.
- Bounds contain render and collision geometry without silently rounding a measured extent inward.
- A connector is backed and reachable in its own insertion direction.
- Chiral identity, legal orientation, and the asset frame agree with the visible hand.
- Palette preview, scene render, canonical capture, collision, and connection metadata resolve from the same catalog definition.

`scripts/check-part-standard.mjs` and `packages/catalog/src/part-standard.ts` automate seven present rules: underside geometry is drawn, stud radius is exact, geometry modes and collision are declared, clutch-bearing bodies are hollow, outer bounds contain the body, and stud extent matches its declaration. Connector reachability and compatibility, chirality and frames, render/collision parity, palette parity, and canonical visual inspection remain admission obligations enforced by focused catalog/render/browser tests and review rather than by `parts:check` alone.

A new automated exception belongs in the shared rule with evidence and a reason; an individual part is never exempted quietly.

## Current underside gap

The following definitions fail because `semantic-tube-seat-grid` declares clutch seats but draws no underside shell:

- Wedge plates: `wedge-plate-2x4-left`, `wedge-plate-2x4-right`, `wedge-plate-2x3-left`, `wedge-plate-2x3-right`, `wedge-plate-4x4-cut-corner`, `wedge-plate-6x6-cut-corner`, and `wedge-plate-3x6-right`.
- Arches: `arch-1x4` and `arch-1x6`.
- Curved slopes: `curved-slope-1x2`, `curved-slope-1x3`, and `curved-slope-1x4`.
- Cheese slopes: `cheese-slope-1x1` and `cheese-slope-2x1`.
- Rounded corners: `corner-plate-4x4-round` and `corner-plate-5x5-quarter-ring`.

The pinned LDraw closures have already been measured; mirrored hands share the same measurement and are grouped here so the sixteen-part count remains explicit.

| Catalog part or mirrored pair | LDraw design | Measured underside |
| --- | --- | --- |
| `wedge-plate-2x4-left` / `right` | `41770a` / `41769a` | 4-LDU cavity; area 1,713 LDU² |
| `wedge-plate-2x3-left` / `right` | `43723a` / `43722a` | 4-LDU cavity; area 1,246 LDU² |
| `wedge-plate-4x4-cut-corner` | `30503` | 4-LDU cavity; area 3,666 LDU² |
| `wedge-plate-6x6-cut-corner` | `6106` | 4-LDU cavity; area 9,721 LDU² |
| `wedge-plate-3x6-right` | `54383` | 4-LDU cavity; area 3,841 LDU² |
| `corner-plate-4x4-round` | `30565` | 4-LDU cavity; area 4,065 LDU² |
| `corner-plate-5x5-quarter-ring` | `80015` | 4-LDU cavity; area 1,928 LDU² |
| `arch-1x4` | `3659` | Cavity 4 LDU from the top; 768 LDU²; 8-LDU end walls |
| `arch-1x6` | `3455` | Cavity 4 LDU from the top; 1,248 LDU²; 8-LDU end walls |
| `curved-slope-1x2` | `11477` | Stepped levels 12, 10, 8, and 4 LDU above the bottom |
| `curved-slope-1x3` | `50950` | Stepped levels 8, 4, and 1 LDU above the bottom |
| `curved-slope-1x4` | `61678` | Stepped levels 20, 16, 8, 4, and 0.2 LDU above the bottom |
| `cheese-slope-1x1` | `54200` | 1-LDU recess over most of the underside; 4-LDU, 4-LDU² pocket |
| `cheese-slope-2x1` | `85984` | 1-LDU recess over most of the underside; 4-LDU, 8-LDU² pocket |

The wedge and rounded-corner families need a shell ring decomposable into supported convex primitives around an approximately 4-LDU cavity. Arches retain their measured end-wall thickness, curved slopes have stepped undersides, and cheese slopes have a local recess rather than a full plate cavity. A generic plate rule would make all three families wrong in different ways.

The eight measured mesh parts already draw their source undersides, but hollow collision parity remains separate work because a polygon surface has no intrinsic inside and the present height-field decomposition fills columns.

The exit is visual and structural: all sixteen definitions pass the standard, from-below canonical captures prove cavities and grip features are present, collision leaves those cavities usable, and the real-booklet prefix is rerun before its underside-dependent steps are called verified.

## Identity and versioning

A `PartDefinition` carries a namespaced catalog ID, real LDraw design identifier and aliases, family and searchable name, geometry recipe and content hash, bounds, collision primitives, connectors, legal orientations, available colors, a substitution-group identifier, inventory metadata with physical mass currently unset, and source/license/attribution provenance.

Catalog IDs are semantic identities, not filenames. A changed shape, connector field, collision model, hand, or source frame is changed truth even when the display name remains similar.

Every admission advances `BUILTIN_CATALOG_VERSION`, adds the previous snapshot to `MIGRATABLE_CATALOG_VERSIONS`, and makes migration produce an explicit report. Saved documents pin their catalog and other truth snapshots and are never silently reinterpreted under `/11` or a later version.

The catalog digest binds every field that can change geometry, placement, connection, validation, migration, or provenance. Cosmetic search text may be excluded only by an explicit canonicalization rule.

## Source ownership

Repository-authored parametric blueprints own their declared geometry. LDraw owns the bundled measured render surface and exact bounds of the eight mesh parts, with file-level authorship preserved. Builder and the LDCad Shadow Library may provide authored connector fields after their exact records, transforms, and licenses are pinned and independently checked.

Builder collision is not catalog truth: its deliberately inset boxes allow measured material to escape. Builder mass is not catalog truth: many unrelated records carry the same placeholder value. LDraw geometry alone supplies no female functional claim, and LDCad-derived connector positions remain separately attributed under their source terms.

Every source's origin, revision, license, attribution, redistribution and training rights, and allowed role live in the bill of materials. Permission to render geometry never implies permission to train on it.

## Admission checklist

A part may enter the builtin catalog only when all of the following are true:

1. Its stable catalog identity, family, real design identifier, hand, aliases, and searchable name are settled.
2. Every source file, closure, revision, content hash, license, attribution, and allowed role is recorded.
3. One catalog frame aligns visible geometry, exact or conservative bounds, connector centres, collision, and legal orientations.
4. The part standard passes, including canonical top, underside, isometric, and orthographic visual inspection.
5. Connector claims have an authored or repository-owned basis and pass insertion, backing, capacity, compatibility, and geometry checks.
6. Collision contains outer material, preserves functional voids, and stays within primitive and resource limits.
7. Palette search and preview expose the exact geometry the editor places.
8. Catalog version, migratable versions, migration report, schema fixtures, notices, and bill of materials are updated.
9. Focused catalog, renderer, migration, LDraw, and browser tests pass, followed by the authoritative gates.

Missing parts remain work items. A booklet step is never completed by substituting a visually similar design, dropping a piece, mirroring a hand, or weakening a hard check.
