# Part model and catalog truth

Status date: 2026-08-23

This document owns how a part is identified, represented, sourced, derived, checked, admitted, and versioned. [`spec.md`](spec.md) owns document and validator semantics, [`building-system.md`](building-system.md) owns the product frontier, and the [dependency and data bill of materials](../dependency-data-bom.md) owns source, license, and allowed-role records.

## Current catalog

The builtin catalog is `builtin.basic-parts/16` with 88 definitions. Sixty-one render from repository-authored parametric recipes and 27 render bundled, content-hashed LDraw surfaces with source-faithful normals. Sixteen of the mesh-backed definitions are render-only promotions of earlier parametric parts; the other eleven are fully measured definitions.

The sixteen render-only promotions take their visible triangles, normals, exact bounds, and explicit source-to-catalog frame from LDraw while preserving their preceding connector, allowance, connector-grid, evidence, and collision declarations. Their `preserved-catalog-recipe` collision can fill a visible void and is not proof of hollow physical truth. The `/13` migration therefore reports changed render interpretation without pretending that physical semantics changed.

The tracked booklet has 121 distinct required leaf design identities. That is not an 88-of-121 coverage fraction: catalog definitions include parts outside the set, aliases and design identities do not share one denominator, and some booklet callouts remain unidentified. A deterministic current-catalog intersection now finds 10 of those 121 identities, digest `sha256:6c9839c2158ecb3cf4baa41c528796c161f4e40a87fd1907e8089d433e0913c8`; `/16` adds exactly `35787`, whose official inventory contains 18 instances. Full-booklet manifest v6 corrects printed step 18's quantity-two callout from the adjacent `3069` crop to element `6514469`, design `25269`; exact source-component replay independently reproduces that corrected quantity-two evidence, and `/14` carries the measured quarter tile. Fresh trusted crop-local model adjudication is still absent, however, so there is no current v6 score or coverage prefix: 73 current-input replies captured before the local-write transport defect was found remain quarantined under legacy answer schema `/4`, and strict `/5` refuses them. `/15` admits distinct design `28802` from its official LDraw and LDCad evidence, but the printed-step-26 Builder source still contradicts that identity by naming `10201`; neither that admission nor the additive `/16` `35787` row resolves or advances the retained action ledger, whose source-boundary check reaches step 25 only by retaining omissions and refusals rather than claiming every intervening piece is placeable.

`npm run parts:check` covers all 88 definitions and is part of `npm run verify`. It is a declaration-consistency gate, not a substitute for source review, matched visual inspection, connector evidence, collision review, or browser verification.

The `/13` exterior visual review remains complete. Twenty-four immutable packets bind 192 matched native-resolution source/catalog pairs; a separate review records every visible pair as `same` in batch `sha256:e1094576c2250db8a9875828254f064384c195991304d363c5a2a9ff5a50c0dd`. Of those pairs, 181 are RGBA-exact, ten differ by 12 pixels total at maximum channel delta 1, and the remaining `cheese-slope-2x1` isometric pair differs in 104 pixels without an observable geometry or shading difference at native size.

The `/14` `25269` review is separately closed. Packet `sha256:61ff5179fd5c7bb117657b84c05a82ae77a5db7eb3c37dbeb1bf9669b815185a` and native-pair manifest `sha256:db728157c8189f070330a73075f4381536fac8a49e95906fe2a3c9e3010093c2` bind the eight original 640 × 640 top, bottom, front, back, left, right, isometric, and underside-oblique source/catalog pairs. Every pair was inspected at original size and reviewed `same`; batch `sha256:2df2c85b096549ccc4838760093f2128ef9d26871d0806a89fe2c150713d9b71` publishes review `sha256:520d1711c0c0a4e5c0e7ed2d0f110e2ab94862ab23d1213332ec54823b09d213`.

The `/15` `28802` review is also separately closed. Packet `sha256:5833ac0ff3c959fab154b730d64142169555861a118f46e3bb4326e19b103531`, native-pair manifest `sha256:cad00fbefb0ecc4ea2440821612dad2ba05d423bffaf69fa47742ff7071be7a1`, and capture batch `sha256:c2b1d40ea718b23012021b389102dc7a4362d7914a2daf62bb7690411cedc427` bind its eight original 640 × 640 source/catalog pairs. Every pair was inspected at original size and reviewed `same`; review `sha256:ba63d84b83d2d5142a129c144c392a160e754b6b8d3477351e705304ee86c239` is retained by review batch `sha256:51ed92e631be31b208fbf21424e8bc3a0f4f3925881cf2c98b1b81e204a0f6c0`.

The `/16` `35787` review is separately closed. Packet `sha256:aae445b7c4018d2d8b591d9ff6ff9cfd8d451c5c0bcacefe383c7421e417e4dc`, native-pair manifest `sha256:938cec88eba5d76ee33514eda75d251dc377e95485b6818dadee402f63a55303`, and capture batch `sha256:1279d4978b403c32b409b522d52b970b7ed74a0c332773fd509579a3a60880d9` bind its eight original 640 × 640 source/catalog pairs. All eight were inspected at original size and reviewed `same`: seven are pixel-identical, while underside-oblique differs in one pixel at maximum channel delta 1, foreground IoU 1, and mean absolute RGB delta `8.138020833333334e-7`. Review `sha256:0f1c4a12a6ad2bd28e628e171f4584910be5166a4c8bdbb32deb6db98a4dc1fa` is retained by review batch `sha256:7ce9abe76d7e408a176b244183331318ca828e6f21db6dcd161af2e6a30e1605`. Together the four generations close the named exterior views for all 27 mesh-backed parts, not hidden interiors, exact physical collision, clutch performance, sideways attachment, or stability. This matched renderer applies the declared recipe frame to both source and candidate, so its agreement does not independently prove yaw; the exact source triangles, frame, and connector-route regressions carry that claim.

The `25269` definition expands the official 13-file LDraw closure into 96 render triangles over 146 stored vertices. Its 26-box collision height field is measured from that surface, and its one central underside clutch is authored separately by the pinned LDCad Shadow Library. The admission scorecard reaches composite `0.9793537209` with zero hard failures. Builder metadata names a revision-O record, but this admission consumes neither its shell nor its connector fields: the official LDraw closure owns the surface and frame, while the exact LDCad route owns the clutch.

The `28802` definition expands the official 19-file, 17,940-byte LDraw closure into 618 render triangles over 663 stored vertices. Its 23-box collision height field is measured from that surface; the pinned LDCad route authors two underside clutches and six outward stud frames. Four studs face horizontally and remain represented and validated, but the unchanged upright-only transform policy cannot attach through them. Per-outward-normal lattice scoring now measures all eight connector frames on their own tangent grids and does not misclassify the bracket's 20-LDU envelope as a malformed plate stack; the admission scorecard reaches composite `0.9869554553824675` with zero hard failures. The inspected Builder source instead names `10201`; that contradiction is retained as counterevidence and grants no surface, frame, connector, collision, or ledger authority.

The `35787` definition expands the official 22-file, 16,184-byte LDraw closure into 128 render triangles over 161 stored vertices. Its canonical source-frame diagonal occupies `x + z <= 0`; the mesh and three-cell connector set are mirror-self-symmetric across `x = z`, so this is an orientation convention rather than intrinsic chirality. A 66-box collision height field is measured from the official surface, while the exact LDCad subpart exclusively authors three underside cells at catalog positions `[-10,4,-10]`, `[-10,4,10]`, and `[10,4,-10]`; the absent `[10,4,10]` cell lies outside the occupied triangular half. The source probe sampled 374,750 collision points with none outside, found zero intrusion and zero face blockers at all three cells, and measured the first material at depth 4 LDU; the shipped mesh independently classifies all three center stops as recessed. Composite `0.987506819809668` has zero hard failures. These measurements prove clear insertion paths and a recessed center stop, not grip strength, full-footprint backing, physical stability, or hidden material. The native Builder record exposes one unframed family-15 node plus three sliders and is retained only as counterevidence; it is not merged into the selected LDCad route.

## One part, four representations

Each representation answers a different question. None is authority for another.

### 1. Render surface

The viewport and palette preview resolve the same catalog definition. Parametric parts derive visible geometry from bounded features; mesh-backed parts use preloaded LDraw triangles, source-derived normals, a pinned content hash, and one explicit asset-to-catalog frame.

Render geometry is disposable view data. It cannot authorize placement, connection, collision, catalog admission, or a claim about hidden physical material. “Exact source geometry” in this repository means the admitted LDraw triangles, loader-faithful normals, and pinned source-to-catalog frame, not pixel identity across independent render paths or access to LEGO production CAD.

### 2. Construction lattice and bounds

Placement uses LDraw units and legal catalog orientations. Footprints, nominal heights, exact body bounds where needed, and connector centres provide the lattice used for enumeration and pruning.

Exact decimal bounds are retained when a measured extent cannot be projected safely as an ordinary binary float. The catalog derives the float projection from that declaration and refuses inward rounding. Off-lattice articulated poses retain their rigid transform and use geometric validators rather than becoming lattice truth.

### 3. Connection field

Catalog ports carry local transforms, capacity, gender, profile, and one of ten implemented kinds: `stud`, `undersideClutch`, `axle`, `axleHole`, `pin`, `pinHole`, `bar`, `clip`, `hinge`, and `hingeSocket`. Six pair rules cover stud/clutch, axle/axle-hole, axle/pin-hole, pin/pin-hole, bar/clip, and hinge/hinge-socket behavior.

Placement discovery consumes those rules, but document edges and attach programs still serialize only `stud-tube`; referenced ports imply the actual pair. A versioned pair identity is still needed before the full taxonomy is represented end to end.

A visible cylinder or cavity does not prove a functional connector. Builder or LDCad fields may supply that claim only through a pinned source and frame, with insertion volume and backing checked against independent geometry.

### 4. Collision and physics

Collision is a bounded union of simple primitives for deterministic validation and compound rigid bodies. It must contain represented outer material while leaving functional connector paths open.

Parametric features derive collision where that derivation is justified. Eleven fully measured mesh definitions use conservative column height fields; sixteen render-only promotions preserve their earlier conservative recipes. Neither mode proves that every visible cavity is physically usable.

Physics derives rigid components and joints from the connection graph, then builds compound bodies and geometric mass properties from collision. Physical mass remains unknown in current inventory metadata; repeated source defaults are not admitted as truth.

## Declaration and derivation

Repository-authored blueprints produce render recipes, nominal bounds, connector fields, collision primitives, legal orientations, search metadata, and part-standard facts from one bounded declaration. A feature may emit only the representations it can justify; missing geometry is a failing standard, not an invitation for a silent exception.

External meshes deliberately split authority. The generated full-measured path may carry reviewed render, connector, and collision evidence. The render-only path can carry only source closure, visible geometry, normals, bounds, frame, stud witnesses, and attribution; the catalog factory overlays those render fields onto the preceding physical definition and proves the preserved fields unchanged.

The bounded generator verifies archive hashes, path and expansion limits, BFC winding, LDrawLoader-equivalent hard edges, frames, bounds, visible stud witnesses, provenance, and reproducible generated bytes. Runtime admission verifies hashes, indices, normals, finite bounds, represented body collision, and resource ceilings. These checks produce evidence; they do not replace reviewed admission.

## Semantic part standard

A part must draw what it claims.

- A declared stud is visible at its declared centre and exact radius.
- A declared underside clutch has a visible entrance, cavity, walls, and grip geometry from below.
- Collision neither omits represented outer material nor silently seals a claimed connector path.
- Visual bounds contain the render without inward rounding; collision is checked under its declared mesh-derived or preserved-recipe mode.
- Connector backing, reachability, capacity, and compatibility are independently checked.
- Chiral identity, legal orientation, and source frame agree with the visible hand.
- Palette preview, viewport geometry, catalog metadata, and retained admission images resolve the same definition.

`scripts/check-part-standard.mjs` automates seven current declaration rules: underside geometry, stud radius, declared geometry mode, declared collision, hollow clutch-bearing bodies, body containment, and stud extent. Connector reachability and compatibility, chirality, source frames, render/collision parity, palette parity, and matched visual inspection remain separate test and review obligations.

## Render-only promotions and remaining physical limits

Printed step 4 first exposed the old rendering failure: its underside art shows walls, hollow rings, ribs, and cavities where the candidate drew an almost solid slab. `/12` replaced the four implicated surfaces; `/13` replaced the remaining twelve flat semantic undersides and added source-faithful normals to all 24 mesh assets. All sixteen promotions preserve their preceding physical fields.

The twelve `/13` promotions cover five wedge plates, two arches, three curved slopes, and two cheese slopes. Their measured underside shapes differ enough that one generic plate shell would be wrong:

| Catalog part or mirrored pair | LDraw design | Durable underside measurement |
| --- | --- | --- |
| `wedge-plate-2x4-left` / `right` | `41770a` / `41769a` | 4-LDU cavity; 1,713 LDU^2 area |
| `wedge-plate-2x3-left` / `right` | `43723a` / `43722a` | 4-LDU cavity; 1,246 LDU^2 area |
| `wedge-plate-3x6-right` | `54383` | 4-LDU cavity; 3,841 LDU^2 area |
| `arch-1x4` | `3659` | Cavity 4 LDU from top; 768 LDU^2; 8-LDU end walls |
| `arch-1x6` | `3455` | Cavity 4 LDU from top; 1,248 LDU^2; 8-LDU end walls |
| `curved-slope-1x2` | `11477` | Stepped levels 12, 10, 8, and 4 LDU above bottom |
| `curved-slope-1x3` | `50950` | Stepped levels 8, 4, and 1 LDU above bottom |
| `curved-slope-1x4` | `61678` | Stepped levels 20, 16, 8, 4, and 0.2 LDU above bottom |
| `cheese-slope-1x1` | `54200` | 1-LDU recess over most of underside; 4-LDU, 4-LDU^2 pocket |
| `cheese-slope-2x1` | `85984` | 1-LDU recess over most of underside; 4-LDU, 8-LDU^2 pocket |

LDraw supplies no female connector authority. The pinned LDCad replay agrees with the preserved clutch centres for only `11477`, `54200`, and `85984`, supplies none for seven designs, and disagrees for `61678` and `54383`. That is why `/13` admits these twelve as render-only changes instead of laundering generated connector or collision values into catalog truth.

The source surfaces and underside checks are now green, but conservative collision remains a known approximation. A visually hollow ring is not automatically an open collision volume, and an exterior packet cannot certify an unexposed interior. Hidden claims are `not-observable` until an interior, cutaway, insertion, or other independent witness exposes them.

## Identity, versioning, and sources

A `PartDefinition` carries a namespaced catalog ID, LDraw design identifier and aliases, family and searchable name, geometry recipe and content hash, bounds, collision primitives, connectors, legal orientations, colors, substitution grouping, inventory metadata with physical mass currently unset, and source/license/attribution provenance.

Catalog IDs are semantic identities, not filenames. A changed shape, connector field, collision model, hand, or source frame is changed truth even when its display name stays similar.

Every catalog-truth change advances `BUILTIN_CATALOG_VERSION`, retains supported prior snapshots in `MIGRATABLE_CATALOG_VERSIONS`, and emits an explicit migration report. Saved documents pin catalog and other truth snapshots and are never silently reinterpreted.

Repository-authored blueprints own parametric declarations. LDraw owns the admitted render surface, normals, exact bounds, and file-level attribution of 27 mesh-backed parts. Builder and LDCad may own connector evidence only where their exact records, frames, licenses, and independent checks are pinned. Builder collision and repeated mass defaults are not catalog truth.

Every source's origin, revision, hash, license, attribution, redistribution and training rights, and allowed role live in the bill of materials. Permission to render geometry never implies permission to train on it.

## Admission checklist

The reproducible admission workflow is documented in the [part visual-admission runbook](../runbooks/part-visual-admission.md). It keeps the editor's seven-view presentation hook separate from the clean eight-view source-versus-catalog review packet.

Before a new or modified part enters catalog truth:

1. Settle stable identity, family, design ID, hand, aliases, and search name.
2. Record every source closure, revision, hash, license, attribution, and allowed role.
3. Prove one catalog frame aligns visible geometry, bounds, connectors, collision, and legal orientations.
4. Pass the automated part standard and matched top, bottom, front, back, left, right, isometric, and underside-oblique review; add interior or cutaway views where the exterior cannot expose a relevant cavity.
5. Establish connector claims from an authored or repository-owned basis and test insertion, backing, capacity, and compatibility.
6. Review collision separately for represented material, functional voids, and resource limits.
7. Verify palette search/preview and production viewport resolve the admitted geometry.
8. Update catalog migration, schema fixtures, notices, bill of materials, and durable review conclusions.
9. Run focused catalog, renderer, migration, generator, and browser checks followed by `npm run verify`.

Packet generation always leaves review outcomes pending. A separate immutable sidecar binds the packet and both image hashes for each ordered view; only an explicit `same`, `different`, or `not-observable` review closes that evidence. Tests and image metrics support this decision but cannot make it automatically. The completed `/13` sidecars follow this boundary; their all-`same` result is explicitly limited to surfaces visible in the eight retained views.

Missing parts remain work items. A booklet step is never completed by substituting a similar design, dropping a piece, mirroring a hand, or weakening a hard check.
