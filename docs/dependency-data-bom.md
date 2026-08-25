# Dependency and data bill of materials

Status: Gate 0 baseline established 2026-07-10; reconciled with catalog `/26` on 2026-08-24

This bill of materials records every direct runtime and development dependency declared by the npm workspace, plus the intended provenance and allowed role of starter geometry, connector, collision, weight, and example sources. It is an allowlist, not a finding that every distributable obligation has already been satisfied.

Real LDraw geometry has been bundled since `builtin.basic-parts/7`: 37 parts now carry the expanded triangles and source-faithful hard-edge normals of their official LDraw closure as their render mesh, under CC BY 4.0 with per-file authorship preserved. Four existing parts moved from approximate parametric surfaces to exact LDraw surfaces at `/12`, and twelve more did so at `/13`; the same `/13` pass corrected LDrawLoader-exact triangulation for 23 generated meshes and source normals for all 24 then-existing assets. The `/12` → `/13` migration reports render-geometry changes for those 24 because `54200` also moves from its parametric catalog drawing to its exact mesh. `/14` adds fully measured `25269` with its official 13-file surface closure and measured collision height field; `/15` adds fully measured `28802` with its official 19-file surface closure, measured collision height field, six outward stud frames, and two clutch cells; `/16` adds fully measured `35787` with its official 22-file surface closure, measured collision height field, and three clutch cells; `/17` adds fully measured `11253` with its official 17-file surface closure, measured collision height field, one source-authored stud, and one clutch cell; `/18` adds fully measured `15254` with its official 15-file surface closure, source-derived 167-box collision field plus six stud cylinders, six source-authored studs, and two Builder-authored end clutches under a jointly pinned frame; `/19` adds fully measured `41682` with its official 14-file surface closure, source-derived 54-box collision field plus two side-stud cylinders, two side-stud frames, and four underside clutch cells; `/20` adds fully measured `2877` with its official 7-file surface closure, source-derived 26-box collision field plus two stud cylinders, two source-authored studs, and two Builder-authored underside clutch cells under one exact reviewed frame; `/21` adds fully measured `3040` with its official 11-file surface closure, source-derived 67-box collision field plus one stud cylinder, one source-authored top stud, and two Builder revision-F underside clutch cells under the exact turn0 frame; `/22` adds fully measured `4519` with its official four-file, 10,983-byte surface closure, 176 triangles at bounds `[-29.5,-6,-6]..[29.5,6,6]`, a 41-box collision field, and three discrete axle seats projected from one direct pinned LDCad route; `/23` adds fully measured `32064` with its moved-to official 23-file, 27,103-byte closure, 458 triangles, a source-derived 23-box collision field plus two source-radius stud cylinders, two studs, two clutch cells, and one transverse female axle-hole seat from the exact pinned LDCad tree; `/24` adds fully measured `11212` with its official 10-file, 11,078-byte closure, 844 triangles over 873 vertices, exact body bounds `[-30,-4,-30]..[30,4,30]`, visual bounds `[-30,-8,-30]..[30,4,30]`, and a 129-box collision field plus nine exact stud cylinders. `/25` adds fully measured `33909` with its official 9-file, 10,203-byte closure rooted at `parts/33909.dat` (`sha256:8da6789db82746f179997ed4b917d00d34d03a6486d6aa27c76d17c9b21d8609`) and closure manifest `sha256:72174370ab6b3d2e0d00d7b72a0687a67da1cccd4014f1f799e113eecb504a15`; the source expands to 220 triangles over 242 vertices, exact body bounds `[-20,-4,-20]..[20,4,20]`, visual bounds `[-20,-8,-20]..[20,4,20]`, and a 41-box collision field plus two exact source-radius stud cylinders. `/26` adds fully measured `78329` with its official 9-file, 8,761-byte closure rooted at `parts/78329.dat` (`sha256:79ec75c5092750b0f2022dab9c7561376d8b2b33fc3dea7059081ef273d4f7fc`) and closure manifest `sha256:d203ae681cfa3842e210b894d46e69e555e64e638796d260c3a2cabdb474f283`; orientation `upright-yaw-90` plus translation `[0,-4,0]` maps the source into the width-first 1 x 5 catalog frame with exact body bounds `[-10,-4,-50]..[10,4,50]`, visual bounds `[-10,-8,-50]..[10,4,50]`, 460 triangles over 489 stored vertices, five studs at `[0,-4,z]` and five underside clutches at `[0,4,z]` for z `[-40,-20,0,20,40]`, and a 39-box collision field plus five exact source-radius stud cylinders. Its emitted candidate scores `0.9968390298840539` with zero hard failures, five of five clutch-room probes, zero outside containment points over 659,766 samples, and ten of ten lattice probes. The `11253` source stud, all nine `11212` source studs, both `33909` source studs, and all five `78329` source studs retain exact radius `6.0001514980873605` LDU as conservative ordinary collision truth; their separately cross-bound nominal 6 LDU profiles may affect only exact validated stud-clutch allowances. All sixteen in-place promotions retain their reviewed connectors, allowances, and conservative collision recipes. Eight fully measured mesh parts use checksum-pinned LEGO Builder fields for connector cells: `5092`, `35480`, `51739`, `77844`, `93273`, `15254`, `2877`, and `3040`. The other thirteen take connector positions from the CC BY-SA 4.0 LDCad Shadow Library: three because no LEGO Builder record exists for their designs, `25269` because Builder record presence is not connector authority, `28802` because the inspected Builder source instead names contradictory design `10201` and is refused, `35787` because its native Builder field has no reviewed catalog frame and exposes only one node where the exact shadow subpart authors three, `11253` because its unframed native Builder record agrees only in count while the exact shadow route authors the selected cell, `41682` because Builder has no record while the exact shadow tree authors four clutches and two side studs reconciled with the official surface, `4519` because the exact direct shadow record authors one capless centered sliding axle shaft projected into three discrete seats, `32064` because `p/axlehol5.dat`, `p/stud2.dat`, and `parts/32064a.dat` author its five connector seats, including one capless sliding `YOnly` A6x1 axle-hole declaration projected from raw `[0,10,0]` along `+Z` to catalog `[0,-2,0]` along `+X`, and `11212` because active `p/stud.dat` metadata authors its nine studs and active `parts/11212.dat` metadata authors its nine clutch cells; consulted `p/stud4.dat` has only a disabled anti-stud declaration and authors none. The `11212` square source and connector lattice are quarter-turn symmetric with yaw 0 selected as the canonical declared frame; revision-I record metadata from the checksum-pinned native pack reports nine clutches without a reviewed frame and remains count-only counterevidence. For `33909`, the exact LDCad route through `p/stud.dat`, `p/stud4.dat`, and `parts/33909.dat` independently matches the two visible studs at catalog `[-10,-4,10]` and `[10,-4,10]` and authors four underside clutch cells at x/z `±10`, y `4`; revision-E record metadata from the checksum-pinned native pack reports four clutches without a reviewed frame and remains count-only corroboration. For `78329`, the exact LDCad route through `p/stud.dat`, `p/stud3.dat`, and `parts/78329.dat` is transformed by yaw 90 plus `[0,-4,0]`, independently matches all five visible stud frames, and authors the five underside clutch cells on the same regular line. Builder counterevidence is retained and the sources are not merged. The `4519` projection does not establish continuous sliding, grip, stability, or axle-through-bore collision allowance. The single `32064` axle-hole endpoint likewise does not establish continuous axial sliding, grip, stability, insertion access, or axle-through-bore collision relief; its structurally compatible axle edge can remain blocked by conservative body collision. The attribution both licences require is reproduced in [bundled-geometry-notices.md](bundled-geometry-notices.md). Reuse is not training, and that right stays unheld for both.

The exact dependency versions and resolved tarballs below come from `package-lock.json`. An npm lockfile license string is upstream-declared metadata, not an independent legal verification. `THIRD_PARTY_NOTICES.md` is generated from the complete locked npm graph, but release redistribution remains blocked until packaged license files, attribution, and evaluation-only exclusions are audited and tested.

Run `node scripts/check-bom.mjs` after changing a workspace or dependency. The check is offline: it compares this inventory with the live package manifests and lockfile and fails on missing, stale, or mismatched records.

## Rights policies

The machine-readable records refer to one of these policies:

- `project-mit`: project-authored source governed by the repository `LICENSE` (MIT). Redistribution is allowed with the copyright and license notice. Preserve “Copyright (c) 2026 Yanfeng Liu” and the MIT text. The material is not designated as a model-training or benchmark corpus merely because its software license permits use.
- `npm-lockfile-spdx-unverified`: the stated license is copied from `package-lock.json` and the installed package manifest. Preserve all upstream copyright, license, and NOTICE material required by the package. The generated `THIRD_PARTY_NOTICES.md` records the locked graph; redistribution still requires verification of packaged license files. The package is approved only for its declared software role, not as model-training or benchmark content.
- `pypi-artifact-spdx-unverified`: the recorded source identity comes from an exact PyPI artifact where an artifact digest is named and otherwise from the installed distribution's checksum-pinned METADATA, WHEEL, and RECORD. Preserve every distribution's upstream copyright, license, and notice material. The environment is approved only for the named local authoring role; it is not a runtime dependency, distributable input, training corpus, or authority source, and its transitive artifact provenance and license texts remain unaudited until separately recorded.
- `external-evaluation-pending-audit`: the source is not included. No redistribution or training use is approved. It may become evaluation-only only after source-specific license, attribution, privacy, and data-rights review; moving it into runtime, examples, knowledge, or training requires a new reviewed BOM entry.
- `private-noncommercial-source-reference`: the repository owner expressly authorizes the named source for this private, noncommercial reconstruction and evaluation. That authorization prevents a commercial-rights audit from blocking local work; it does not silently relicense upstream material. Keep source payloads local where possible and retain exact identities and hashes so factual extractions can be reproduced and challenged.

## Machine-audited inventory

The JSON block is normative for `scripts/check-bom.mjs`. Keep it strict JSON.

<!-- bom-data:start -->
```json
{
  "schemaVersion": 1,
  "rightsPolicies": {
    "attribution-required-facts-only": {
      "licenseEvidence": "The exact `!LICENSE`, `Author`, and `!LDRAW_ORG` headers are read per source file at the same time as the measurements; the inspected files include both legacy CC BY 2.0 and CC BY 4.0 declarations.",
      "attribution": "Credit LDraw.org and the part's named author for measurements taken from the official library; the catalog records the LDraw identifier for every part measured this way.",
      "redistribution": "No LDraw file, geometry, mesh, or excerpt is copied into this repository or shipped. What is kept is measurement — a part's stud positions and body extents as numbers — which is then hand-authored into a project-owned parametric blueprint.",
      "trainingUse": "Not designated as a model-training or benchmark corpus; permission to read geometry is not permission to train on it."
    },
    "attribution-required-bundled-geometry": {
      "licenseEvidence": "The exact `!LICENSE`, `Author`, `!LDRAW_ORG` and SHA-256 of every bundled file are read from the pinned official archive and preserved per file in packages/catalog/src/ldraw-bundled-sources-6651557.ts. Of the 211 unique files in the 37 bundled closures, 209 declare CC BY 4.0; parts/30503.dat and parts/32064a.dat declare CC BY 2.0 or CC BY 4.0, and the bundle selects the CC BY 4.0 option for both.",
      "attribution": "Credit LDraw.org and each bundled file's named author. Attribution is per file and is never flattened: the catalog carries the path, author, title, licence and content hash of every file whose geometry is bundled, and each mesh recipe names its root file and author.",
      "redistribution": "Allowed under CC BY 4.0 with attribution. Real LDraw geometry is bundled for rendering and palette previews. Runtime validators do not inspect the mesh triangles directly, but exact source-derived visual bounds are catalog truth and validator inputs. Connector truth remains separately authored. All twenty-one fully measured definitions carry attributed authoring-time collision height fields derived from their official surfaces; the sixteen render-only promotions preserve independently authored collision. Runtime consumes emitted bounded boxes rather than treating mesh triangles as a collision oracle.",
      "trainingUse": "Not held. Permission to reuse geometry is not permission to train on it, and no bundled file is designated as a model-training or benchmark corpus."
    },
    "project-mit": {
      "licenseEvidence": "Repository LICENSE (MIT).",
      "attribution": "Preserve Copyright (c) 2026 Yanfeng Liu and the repository MIT license text.",
      "redistribution": "Allowed under the repository MIT license with its copyright and permission notice.",
      "trainingUse": "Not designated as a model-training or benchmark corpus."
    },
    "npm-lockfile-spdx-unverified": {
      "licenseEvidence": "package-lock.json and installed package manifest metadata; upstream license text not yet independently audited.",
      "attribution": "Preserve all upstream copyright, license, and NOTICE material required by the package.",
      "redistribution": "Conditional on verifying packaged license files and notices against the generated THIRD_PARTY_NOTICES.md inventory.",
      "trainingUse": "Not approved as model-training or benchmark content; use only for the declared software role."
    },
    "pypi-artifact-spdx-unverified": {
      "licenseEvidence": "Exact PyPI artifact identity where recorded plus installed checksum-pinned METADATA, WHEEL, RECORD, and any included license files; upstream license texts and transitive artifact provenance have not received an independent audit.",
      "attribution": "Preserve each pinned distribution's upstream copyright, license, and notice material, including Copyright (c) 2019-2026 K0lb3 and the UnityPy MIT license.",
      "redistribution": "Not bundled by this repository. Any later redistribution must audit every pinned distribution's source artifact and include all required upstream notices and license texts.",
      "trainingUse": "Not approved as model-training or benchmark content; use only for the declared local authoring role."
    },
    "derived-measurement-of-external-source": {
      "licenseEvidence": "None obtained. The measured source is a LEGO-copyrighted instruction booklet that is not included in the repository and is not approved for any role.",
      "attribution": "Name the source set and the fact that the data is a measurement rather than a reproduction wherever the fixture is described.",
      "redistribution": "Only as the numeric measurement itself. No expressive content of the source may be redistributed, and the measurement must not be presented as, or expanded back towards, booklet content.",
      "trainingUse": "Not approved. Permission to measure a work is not permission to train on it."
    },
    "private-noncommercial-source-reference": {
      "licenseEvidence": "The repository owner expressly authorized use of the named source for private, noncommercial reconstruction and evaluation on 2026-08-02; this records task scope rather than an upstream relicensing claim.",
      "attribution": "Retain the exact source identity, revision, extraction method, and integrity hashes beside every committed fact derived from the source.",
      "redistribution": "Source bundles, native files, and booklet pages remain local; only minimal factual measurements and project-authored validation code are committed unless the owner separately expands the scope.",
      "trainingUse": "Not designated as model-training content; the approved role is private reconstruction and evaluation."
    },
    "external-evaluation-pending-audit": {
      "licenseEvidence": "Unverified; the source is not included.",
      "attribution": "Determine and preserve source-specific, file-level attribution before any inclusion.",
      "redistribution": "Not permitted until a source-specific license and redistribution audit succeeds.",
      "trainingUse": "Not permitted; separate explicit rights and consent would be required."
    }
  },
  "workspaces": [
    { "manifest": "apps/companion/package.json", "name": "@lego-studio/companion", "version": "0.0.0" },
    { "manifest": "apps/web/package.json", "name": "@lego-studio/web", "version": "0.0.0" },
    { "manifest": "packages/brick-kernel/package.json", "name": "@lego-studio/brick-kernel", "version": "0.0.0" },
    { "manifest": "packages/catalog/package.json", "name": "@lego-studio/catalog", "version": "0.0.0" },
    { "manifest": "packages/protocol/package.json", "name": "@lego-studio/protocol", "version": "0.0.0" },
    { "manifest": "packages/rendering/package.json", "name": "@lego-studio/rendering", "version": "0.0.0" }
  ],
  "declarations": [
    { "manifest": "apps/companion/package.json", "section": "dependencies", "name": "@lego-studio/protocol", "spec": "0.0.0" },
    { "manifest": "apps/companion/package.json", "section": "devDependencies", "name": "@lego-studio/brick-kernel", "spec": "0.0.0" },
    { "manifest": "apps/companion/package.json", "section": "devDependencies", "name": "@lego-studio/catalog", "spec": "0.0.0" },
    { "manifest": "package.json", "section": "devDependencies", "name": "@eslint/js", "spec": "10.0.1" },
    { "manifest": "package.json", "section": "devDependencies", "name": "@playwright/test", "spec": "1.61.1" },
    { "manifest": "package.json", "section": "devDependencies", "name": "@types/node", "spec": "26.1.1" },
    { "manifest": "package.json", "section": "devDependencies", "name": "@types/react", "spec": "19.2.17" },
    { "manifest": "package.json", "section": "devDependencies", "name": "@types/react-dom", "spec": "19.2.3" },
    { "manifest": "package.json", "section": "devDependencies", "name": "@types/three", "spec": "0.185.1" },
    { "manifest": "package.json", "section": "devDependencies", "name": "@vitejs/plugin-react", "spec": "6.0.3" },
    { "manifest": "package.json", "section": "devDependencies", "name": "eslint", "spec": "10.6.0" },
    { "manifest": "package.json", "section": "devDependencies", "name": "eslint-plugin-react-hooks", "spec": "7.1.1" },
    { "manifest": "package.json", "section": "devDependencies", "name": "eslint-plugin-react-refresh", "spec": "0.5.3" },
    { "manifest": "package.json", "section": "devDependencies", "name": "globals", "spec": "17.7.0" },
    { "manifest": "package.json", "section": "devDependencies", "name": "json-schema-to-typescript", "spec": "15.0.4" },
    { "manifest": "package.json", "section": "devDependencies", "name": "prettier", "spec": "3.9.5" },
    { "manifest": "package.json", "section": "devDependencies", "name": "typescript", "spec": "6.0.3" },
    { "manifest": "package.json", "section": "devDependencies", "name": "typescript-eslint", "spec": "8.63.0" },
    { "manifest": "package.json", "section": "devDependencies", "name": "vite", "spec": "8.1.4" },
    { "manifest": "package.json", "section": "devDependencies", "name": "vitest", "spec": "4.1.10" },
    { "manifest": "apps/web/package.json", "section": "dependencies", "name": "@dimforge/rapier3d-compat", "spec": "0.12.0" },
    { "manifest": "apps/web/package.json", "section": "dependencies", "name": "@lego-studio/brick-kernel", "spec": "0.0.0" },
    { "manifest": "apps/web/package.json", "section": "dependencies", "name": "@lego-studio/catalog", "spec": "0.0.0" },
    { "manifest": "apps/web/package.json", "section": "dependencies", "name": "@lego-studio/protocol", "spec": "0.0.0" },
    { "manifest": "apps/web/package.json", "section": "dependencies", "name": "@lego-studio/rendering", "spec": "0.0.0" },
    { "manifest": "apps/web/package.json", "section": "dependencies", "name": "react", "spec": "19.2.7" },
    { "manifest": "apps/web/package.json", "section": "dependencies", "name": "pdfjs-dist", "spec": "5.4.149" },
    { "manifest": "apps/web/package.json", "section": "dependencies", "name": "react-dom", "spec": "19.2.7" },
    { "manifest": "packages/protocol/package.json", "section": "dependencies", "name": "ajv", "spec": "8.20.0" },
    { "manifest": "packages/protocol/package.json", "section": "dependencies", "name": "@noble/hashes", "spec": "2.2.0" },
    { "manifest": "packages/catalog/package.json", "section": "dependencies", "name": "@noble/hashes", "spec": "2.2.0" },
    { "manifest": "packages/brick-kernel/package.json", "section": "dependencies", "name": "@lego-studio/catalog", "spec": "0.0.0" },
    { "manifest": "packages/brick-kernel/package.json", "section": "dependencies", "name": "@lego-studio/protocol", "spec": "0.0.0" },
    { "manifest": "packages/brick-kernel/package.json", "section": "dependencies", "name": "@noble/hashes", "spec": "2.2.0" },
    { "manifest": "packages/rendering/package.json", "section": "dependencies", "name": "@lego-studio/brick-kernel", "spec": "0.0.0" },
    { "manifest": "packages/rendering/package.json", "section": "dependencies", "name": "@lego-studio/catalog", "spec": "0.0.0" },
    { "manifest": "packages/rendering/package.json", "section": "dependencies", "name": "@lego-studio/protocol", "spec": "0.0.0" },
    { "manifest": "packages/rendering/package.json", "section": "dependencies", "name": "three", "spec": "0.185.1" }
  ],
  "packages": [
    {
      "name": "@eslint/js",
      "version": "10.0.1",
      "kind": "npm",
      "resolvedSource": "https://registry.npmjs.org/@eslint/js/-/js-10.0.1.tgz",
      "upstreamSource": "https://github.com/eslint/eslint/tree/main/packages/js",
      "declaredLicense": "MIT",
      "rightsPolicy": "npm-lockfile-spdx-unverified",
      "allowedRoles": ["development lint configuration"]
    },
    {
      "name": "@playwright/test",
      "version": "1.61.1",
      "kind": "npm",
      "resolvedSource": "https://registry.npmjs.org/@playwright/test/-/test-1.61.1.tgz",
      "upstreamSource": "https://github.com/microsoft/playwright",
      "declaredLicense": "Apache-2.0",
      "rightsPolicy": "npm-lockfile-spdx-unverified",
      "allowedRoles": ["development browser and interaction testing"]
    },
    {
      "name": "@types/node",
      "version": "26.1.1",
      "kind": "npm",
      "resolvedSource": "https://registry.npmjs.org/@types/node/-/node-26.1.1.tgz",
      "upstreamSource": "https://github.com/DefinitelyTyped/DefinitelyTyped/tree/master/types/node",
      "declaredLicense": "MIT",
      "rightsPolicy": "npm-lockfile-spdx-unverified",
      "allowedRoles": ["development TypeScript declarations for Node.js"]
    },
    {
      "name": "@types/react",
      "version": "19.2.17",
      "kind": "npm",
      "resolvedSource": "https://registry.npmjs.org/@types/react/-/react-19.2.17.tgz",
      "upstreamSource": "https://github.com/DefinitelyTyped/DefinitelyTyped/tree/master/types/react",
      "declaredLicense": "MIT",
      "rightsPolicy": "npm-lockfile-spdx-unverified",
      "allowedRoles": ["development TypeScript declarations for React"]
    },
    {
      "name": "@dimforge/rapier3d-compat",
      "version": "0.12.0",
      "kind": "npm",
      "resolvedSource": "https://registry.npmjs.org/@dimforge/rapier3d-compat/-/rapier3d-compat-0.12.0.tgz",
      "upstreamSource": "https://github.com/dimforge/rapier.js",
      "declaredLicense": "Apache-2.0",
      "rightsPolicy": "npm-lockfile-spdx-unverified",
      "allowedRoles": ["rigid-body simulation of accepted assemblies, in the browser only"]
    },
    {
      "name": "@types/react-dom",
      "version": "19.2.3",
      "kind": "npm",
      "resolvedSource": "https://registry.npmjs.org/@types/react-dom/-/react-dom-19.2.3.tgz",
      "upstreamSource": "https://github.com/DefinitelyTyped/DefinitelyTyped/tree/master/types/react-dom",
      "declaredLicense": "MIT",
      "rightsPolicy": "npm-lockfile-spdx-unverified",
      "allowedRoles": ["development TypeScript declarations for React DOM"]
    },
    {
      "name": "@types/three",
      "version": "0.185.1",
      "kind": "npm",
      "resolvedSource": "https://registry.npmjs.org/@types/three/-/three-0.185.1.tgz",
      "upstreamSource": "https://github.com/DefinitelyTyped/DefinitelyTyped/tree/master/types/three",
      "declaredLicense": "MIT",
      "rightsPolicy": "npm-lockfile-spdx-unverified",
      "allowedRoles": ["development TypeScript declarations for Three.js"]
    },
    {
      "name": "@vitejs/plugin-react",
      "version": "6.0.3",
      "kind": "npm",
      "resolvedSource": "https://registry.npmjs.org/@vitejs/plugin-react/-/plugin-react-6.0.3.tgz",
      "upstreamSource": "https://github.com/vitejs/vite-plugin-react/tree/main/packages/plugin-react",
      "declaredLicense": "MIT",
      "rightsPolicy": "npm-lockfile-spdx-unverified",
      "allowedRoles": ["development React compilation in Vite"]
    },
    {
      "name": "eslint",
      "version": "10.6.0",
      "kind": "npm",
      "resolvedSource": "https://registry.npmjs.org/eslint/-/eslint-10.6.0.tgz",
      "upstreamSource": "https://github.com/eslint/eslint",
      "declaredLicense": "MIT",
      "rightsPolicy": "npm-lockfile-spdx-unverified",
      "allowedRoles": ["development static analysis"]
    },
    {
      "name": "eslint-plugin-react-hooks",
      "version": "7.1.1",
      "kind": "npm",
      "resolvedSource": "https://registry.npmjs.org/eslint-plugin-react-hooks/-/eslint-plugin-react-hooks-7.1.1.tgz",
      "upstreamSource": "https://github.com/facebook/react/tree/main/packages/eslint-plugin-react-hooks",
      "declaredLicense": "MIT",
      "rightsPolicy": "npm-lockfile-spdx-unverified",
      "allowedRoles": ["development React Hooks lint rules"]
    },
    {
      "name": "eslint-plugin-react-refresh",
      "version": "0.5.3",
      "kind": "npm",
      "resolvedSource": "https://registry.npmjs.org/eslint-plugin-react-refresh/-/eslint-plugin-react-refresh-0.5.3.tgz",
      "upstreamSource": "https://github.com/ArnaudBarre/eslint-plugin-react-refresh",
      "declaredLicense": "MIT",
      "rightsPolicy": "npm-lockfile-spdx-unverified",
      "allowedRoles": ["development React Refresh lint rules"]
    },
    {
      "name": "globals",
      "version": "17.7.0",
      "kind": "npm",
      "resolvedSource": "https://registry.npmjs.org/globals/-/globals-17.7.0.tgz",
      "upstreamSource": "https://github.com/sindresorhus/globals",
      "declaredLicense": "MIT",
      "rightsPolicy": "npm-lockfile-spdx-unverified",
      "allowedRoles": ["development lint environment definitions"]
    },
    {
      "name": "json-schema-to-typescript",
      "version": "15.0.4",
      "kind": "npm",
      "resolvedSource": "https://registry.npmjs.org/json-schema-to-typescript/-/json-schema-to-typescript-15.0.4.tgz",
      "upstreamSource": "https://github.com/bcherny/json-schema-to-typescript",
      "declaredLicense": "MIT",
      "rightsPolicy": "npm-lockfile-spdx-unverified",
      "allowedRoles": ["development generation of TypeScript declarations from reviewed schemas"]
    },
    {
      "name": "pdfjs-dist",
      "version": "5.4.149",
      "kind": "npm",
      "resolvedSource": "https://registry.npmjs.org/pdfjs-dist/-/pdfjs-dist-5.4.149.tgz",
      "upstreamSource": "https://github.com/mozilla/pdf.js",
      "declaredLicense": "Apache-2.0",
      "rightsPolicy": "npm-lockfile-spdx-unverified",
      "allowedRoles": ["runtime instruction PDF parsing"]
    },
    {
      "name": "prettier",
      "version": "3.9.5",
      "kind": "npm",
      "resolvedSource": "https://registry.npmjs.org/prettier/-/prettier-3.9.5.tgz",
      "upstreamSource": "https://github.com/prettier/prettier",
      "declaredLicense": "MIT",
      "rightsPolicy": "npm-lockfile-spdx-unverified",
      "allowedRoles": ["development source formatting"]
    },
    {
      "name": "typescript",
      "version": "6.0.3",
      "kind": "npm",
      "resolvedSource": "https://registry.npmjs.org/typescript/-/typescript-6.0.3.tgz",
      "upstreamSource": "https://github.com/microsoft/TypeScript",
      "declaredLicense": "Apache-2.0",
      "rightsPolicy": "npm-lockfile-spdx-unverified",
      "allowedRoles": ["development type checking and compilation"]
    },
    {
      "name": "typescript-eslint",
      "version": "8.63.0",
      "kind": "npm",
      "resolvedSource": "https://registry.npmjs.org/typescript-eslint/-/typescript-eslint-8.63.0.tgz",
      "upstreamSource": "https://github.com/typescript-eslint/typescript-eslint",
      "declaredLicense": "MIT",
      "rightsPolicy": "npm-lockfile-spdx-unverified",
      "allowedRoles": ["development TypeScript parsing and lint rules"]
    },
    {
      "name": "vite",
      "version": "8.1.4",
      "kind": "npm",
      "resolvedSource": "https://registry.npmjs.org/vite/-/vite-8.1.4.tgz",
      "upstreamSource": "https://github.com/vitejs/vite",
      "declaredLicense": "MIT",
      "rightsPolicy": "npm-lockfile-spdx-unverified",
      "allowedRoles": ["development server and production web bundling"]
    },
    {
      "name": "vitest",
      "version": "4.1.10",
      "kind": "npm",
      "resolvedSource": "https://registry.npmjs.org/vitest/-/vitest-4.1.10.tgz",
      "upstreamSource": "https://github.com/vitest-dev/vitest",
      "declaredLicense": "MIT",
      "rightsPolicy": "npm-lockfile-spdx-unverified",
      "allowedRoles": ["development unit, property, and contract testing"]
    },
    {
      "name": "react",
      "version": "19.2.7",
      "kind": "npm",
      "resolvedSource": "https://registry.npmjs.org/react/-/react-19.2.7.tgz",
      "upstreamSource": "https://github.com/facebook/react/tree/main/packages/react",
      "declaredLicense": "MIT",
      "rightsPolicy": "npm-lockfile-spdx-unverified",
      "allowedRoles": ["browser runtime user-interface composition"]
    },
    {
      "name": "react-dom",
      "version": "19.2.7",
      "kind": "npm",
      "resolvedSource": "https://registry.npmjs.org/react-dom/-/react-dom-19.2.7.tgz",
      "upstreamSource": "https://github.com/facebook/react/tree/main/packages/react-dom",
      "declaredLicense": "MIT",
      "rightsPolicy": "npm-lockfile-spdx-unverified",
      "allowedRoles": ["browser runtime DOM rendering"]
    },
    {
      "name": "ajv",
      "version": "8.20.0",
      "kind": "npm",
      "resolvedSource": "https://registry.npmjs.org/ajv/-/ajv-8.20.0.tgz",
      "upstreamSource": "https://github.com/ajv-validator/ajv",
      "declaredLicense": "MIT",
      "rightsPolicy": "npm-lockfile-spdx-unverified",
      "allowedRoles": ["runtime validation of versioned JSON Schema boundaries"]
    },
    {
      "name": "@noble/hashes",
      "version": "2.2.0",
      "kind": "npm",
      "resolvedSource": "https://registry.npmjs.org/@noble/hashes/-/hashes-2.2.0.tgz",
      "upstreamSource": "https://github.com/paulmillr/noble-hashes",
      "declaredLicense": "MIT",
      "rightsPolicy": "npm-lockfile-spdx-unverified",
      "allowedRoles": ["runtime deterministic content hashing in the pure brick kernel and immutable protocol snapshots"]
    },
    {
      "name": "three",
      "version": "0.185.1",
      "kind": "npm",
      "resolvedSource": "https://registry.npmjs.org/three/-/three-0.185.1.tgz",
      "upstreamSource": "https://github.com/mrdoob/three.js",
      "declaredLicense": "MIT",
      "rightsPolicy": "npm-lockfile-spdx-unverified",
      "allowedRoles": ["browser runtime derivation and rendering of disposable scene state"]
    },
    {
      "name": "@lego-studio/brick-kernel",
      "version": "0.0.0",
      "kind": "workspace",
      "resolvedSource": "workspace:packages/brick-kernel",
      "upstreamSource": "this repository",
      "declaredLicense": "MIT",
      "rightsPolicy": "project-mit",
      "allowedRoles": ["runtime canonical document, compiler, canonicalization, and deterministic validation"]
    },
    {
      "name": "@lego-studio/catalog",
      "version": "0.0.0",
      "kind": "workspace",
      "resolvedSource": "workspace:packages/catalog",
      "upstreamSource": "this repository",
      "declaredLicense": "MIT",
      "rightsPolicy": "project-mit",
      "allowedRoles": ["runtime curated catalog truth and project-authored parametric part definitions"]
    },
    {
      "name": "@lego-studio/protocol",
      "version": "0.0.0",
      "kind": "workspace",
      "resolvedSource": "workspace:packages/protocol",
      "upstreamSource": "this repository",
      "declaredLicense": "MIT",
      "rightsPolicy": "project-mit",
      "allowedRoles": ["runtime versioned schemas, generated types, and boundary validation"]
    },
    {
      "name": "@lego-studio/rendering",
      "version": "0.0.0",
      "kind": "workspace",
      "resolvedSource": "workspace:packages/rendering",
      "upstreamSource": "this repository",
      "declaredLicense": "MIT",
      "rightsPolicy": "project-mit",
      "allowedRoles": ["browser runtime disposable Three.js scene derivation and canonical captures"]
    }
  ],
  "dataAssets": [
    {
      "id": "builtin-parametric-basic-parts",
      "category": "catalog-data-and-geometry",
      "status": "implemented-project-authored",
      "source": "packages/catalog/src/",
      "version": "builtin.basic-parts/26",
      "declaredLicense": "MIT",
      "rightsPolicy": "project-mit",
      "allowedRoles": ["runtime", "tests", "distribution"],
      "intent": "Project-authored dimensions and parametric box, shell, wedge, compound-box, and analytic-plan recipes remain active render or preserved physical recipes for 77 of the 98 builtin parts: 61 remain parametric renders, while four moved to exact LDraw render surfaces and visual bounds at builtin.basic-parts/12 and twelve more at /13 while retaining their reviewed project-authored connectors, allowances, and conservative collision recipes. The other twenty-one parts are fully measured definitions, including 25269 added at /14, 28802 added at /15, 35787 added at /16, 11253 added at /17, 15254 added at /18, 41682 added at /19, 2877 added at /20, 3040 added at /21, 4519 added at /22, 32064 added at /23, 11212 added at /24, 33909 added at /25, and 78329 added at /26. No LDraw mesh file is copied into this layer; all 37 bundled surfaces are recorded separately under ldraw-bundled-part-geometry."
    },
    {
      "id": "ldraw-bundled-part-geometry",
      "category": "external-render-geometry",
      "status": "included-bundled-attribution-bound",
      "source": "packages/catalog/src/mesh-assets-6651557.ts with its generated measured/render-only chunks, plus packages/catalog/src/ldraw-bundled-sources-6651557.ts, expanded offline from the pinned local official LDraw archive",
      "version": "ldraw-complete-2026-07 archive sha256 6009f2e94204c4d3a63a4c812010b5c90bad8c5acb19b882c859fdac63734eae; 37 roots, 211 unique files, 30 named authors; 209 CC BY 4.0, while parts/30503.dat and parts/32064a.dat are CC BY 2.0 or CC BY 4.0 with the CC BY 4.0 option selected; catalog builtin.basic-parts/26",
      "declaredLicense": "CC-BY-4.0; parts/30503.dat and parts/32064a.dat are CC-BY-2.0 OR CC-BY-4.0 with CC-BY-4.0 selected",
      "rightsPolicy": "attribution-required-bundled-geometry",
      "allowedRoles": ["runtime render mesh", "palette preview", "visual bounds", "authoring-time collision measurement", "derived collision data", "tests", "distribution"],
      "intent": "The expanded BFC-corrected triangles and LDrawLoader-equivalent hard-edge normals of the 37 roots listed in docs/bundled-geometry-notices.md are bundled in immutable asset-local LDraw frames, and each part applies its explicit source-to-catalog frame exactly once. Catalog /13 corrects source-exact triangulation for 23 generated meshes and source normals for its 24 roots; migration reports render geometry for all 24 because 54200 also replaces its parametric /12 drawing. Bounds remain source-derived and unchanged for the twelve already-bundled definitions. The eight fully measured parts admitted at builtin.basic-parts/7 and /8 use separately attributed connector data and authoring-time collision height fields measured from their bundled official surfaces; /14 adds 25269 as a ninth fully measured part with 96 triangles over 146 stored vertices from a 13-file official closure, a 26-box surface-derived collision field, and one separately attributed LDCad clutch cell. /15 adds 28802 as a tenth fully measured part with 618 triangles over 663 stored vertices from a 19-file, 17,940-byte official closure, a 23-box surface-derived collision field, six LDCad-authored outward stud frames, and two LDCad-authored clutch cells; four side studs remain unusable under the unchanged upright-only transform policy. /16 adds 35787 as an eleventh fully measured part with 128 triangles over 161 stored vertices from a 22-file, 16,184-byte official closure, a 66-box surface-derived collision field, and three exclusively LDCad-authored clutch cells under its canonical triangular half. /17 adds 11253 as a twelfth fully measured part with 690 triangles over 705 stored vertices from a 17-file, 28,352-byte official closure, a 78-box surface-derived collision field plus its exact `6.0001514980873605` LDU stud cylinder, and one exclusively LDCad-authored clutch cell; its separately cross-bound nominal 6 LDU connection profile applies only to the exact validated stud-clutch allowance, and its unframed native Builder record remains count-only counterevidence and is not merged. /18 adds 15254 as a thirteenth fully measured part with 548 triangles over 594 stored vertices, 334 unique, from a 15-file, 18,061-byte official closure, a 167-box surface-derived collision field plus six source-radius stud cylinders, 173 primitives total, six LDraw-authored top studs, and two end clutches from the exact framed Builder revision-J record. /19 adds 41682 as a fourteenth fully measured part with 336 triangles over 399 stored vertices from a 14-file, 15,430-byte official closure, a 54-box surface-derived collision field plus two source-radius side-stud cylinders, 56 primitives total, and an exact LDCad route that exclusively authors two z-negative studs and four underside clutches; Builder has no record for the design. /20 adds 2877 as a fifteenth fully measured part with 264 triangles over 375 stored vertices from a 7-file, 12,845-byte official closure, a 26-box surface-derived collision field plus two source-radius stud cylinders, 28 primitives total, two LDraw-authored top studs, and two underside clutches from the exact framed Builder revision-E record. /21 adds 3040 as a sixteenth fully measured part with 178 triangles over 184 stored vertices from an 11-file, 13,050-byte official closure, a 67-box surface-derived collision field plus one source-radius stud cylinder, 68 primitives total, one LDraw-authored top stud, and two underside clutches from the exact turn0-framed Builder revision-F record; its emitted candidate has composite score `0.9856779517112434` with zero hard failures. /22 adds 4519 as a seventeenth fully measured part with 176 triangles from a four-file, 10,983-byte official closure rooted at `parts/4519.dat` (`sha256:ecec609013e9d7af63c352cb61d990077c005c4c5453e121b3d192914ab55ff0`), exact bounds `[-29.5,-6,-6]..[29.5,6,6]`, a 41-box surface-derived collision field, and three discrete LDCad-authored axle seats; its emitted candidate has composite score `0.990325` with zero hard failures, while the source-connector rows remain unscored under a separate exact-source gate. /23 adds 32064 as an eighteenth fully measured part with 458 triangles from the 23-file, 27,103-byte official closure rooted at moved-to `parts/32064.dat` (`sha256:b6240d5798083701834cec8f566d7fca05cbc51123fad8500d3125fa68b4c465`) and resolved through dual-licensed `parts/32064a.dat`; its exact bounds are `[-10,-16,-20]..[10,12,20]`, its collision recipe has 23 surface-derived boxes plus two source-radius stud cylinders, and the exact three-file LDCad tree authors two studs, two clutch cells, and one transverse female axle-hole seat. Its emitted candidate has composite score `0.9694824982385262` with zero hard failures; the axle-hole row remains unscored under its separate exact-source gate and does not authorize continuous axial sliding, grip, stability, insertion access, or collision relief through the bore. /24 adds 11212 as a nineteenth fully measured part with 844 triangles over 873 stored vertices from the 10-file, 11,078-byte official closure rooted at `parts/11212.dat` (`sha256:c527adbbc5db2983cdc9d0b28481d57a248fd0125d8aa00c13aebd7c32b6633f`); its exact body bounds are `[-30,-4,-30]..[30,4,30]` and visual bounds are `[-30,-8,-30]..[30,4,30]`; its collision recipe has 129 surface-derived boxes plus nine exact source-radius stud cylinders; and the exact LDCad walk consults `p/stud.dat`, `p/stud4.dat`, and `parts/11212.dat`: active `p/stud.dat` metadata authors nine studs, active root metadata authors nine clutch cells, and `p/stud4.dat` has only a disabled anti-stud declaration. The square source and connector lattice are quarter-turn symmetric with yaw 0 selected as the canonical declared frame; revision-I record metadata from the checksum-pinned native pack reports nine clutches without a reviewed frame and remains count-only counterevidence. Its exact stud radius `6.0001514980873605` LDU remains ordinary collision truth, while nominal 6 LDU applies only to exact validated connection edges. Its emitted candidate has composite score `0.9925023760839874` with zero hard failures. /25 adds 33909 as a twentieth fully measured part with 220 triangles over 242 stored vertices from the 9-file, 10,203-byte official closure rooted at `parts/33909.dat` (`sha256:8da6789db82746f179997ed4b917d00d34d03a6486d6aa27c76d17c9b21d8609`) with closure manifest `sha256:72174370ab6b3d2e0d00d7b72a0687a67da1cccd4014f1f799e113eecb504a15`; its exact body bounds are `[-20,-4,-20]..[20,4,20]` and visual bounds are `[-20,-8,-20]..[20,4,20]`; its collision recipe has 41 surface-derived boxes plus two exact source-radius stud cylinders; and the exact LDCad route through `p/stud.dat`, `p/stud4.dat`, and `parts/33909.dat` authors two top studs at catalog `[-10,-4,10]` and `[10,-4,10]` plus four underside clutch cells at x/z `±10`, y `4`. Its emitted candidate has composite score `0.9955832518073061` with zero hard failures, four of four clutch-room probes, zero outside containment points, and six of six lattice probes. Revision-E record metadata reports four clutches without a reviewed frame and remains count-only corroboration. /26 adds 78329 as a twenty-first fully measured part with 460 triangles over 489 stored vertices, 313 unique positions, from the 9-file, 8,761-byte official closure rooted at `parts/78329.dat` (`sha256:79ec75c5092750b0f2022dab9c7561376d8b2b33fc3dea7059081ef273d4f7fc`) with closure manifest `sha256:d203ae681cfa3842e210b894d46e69e555e64e638796d260c3a2cabdb474f283`; orientation `upright-yaw-90` plus translation `[0,-4,0]` maps it into exact body bounds `[-10,-4,-50]..[10,4,50]` and visual bounds `[-10,-8,-50]..[10,4,50]`; its collision recipe has 39 surface-derived boxes plus five exact source-radius stud cylinders; and the exact LDCad route through `p/stud.dat`, `p/stud3.dat`, and `parts/78329.dat` authors five top studs at `[0,-4,z]` plus five underside clutch cells at `[0,4,z]` for z `[-40,-20,0,20,40]`. Its emitted candidate has composite score `0.9968390298840539` with zero hard failures, five of five clutch-room probes, zero outside containment points over 659,766 samples, and ten of ten lattice probes. The initial schema-`/6` write report is 219,309 bytes at `sha256:56cea66dcd26f4eceda2a63efbf500144106c1db028d5e1c0d259413edde48de` and records generated files with `written:true`. The current schema-`/6` check control is 219,322 bytes at `sha256:7c71d75f3d8f2388fbd83a01bbc74aabc6eeb8345c910e1f54bc8d05893b3f22`; it reproduces all 16 generated files with `written:false`, retains all 25 measured-pipeline and 12 render-only rows, and has no hard-failing part. The sixteen in-place render promotions at /12 and /13 take source-derived visual bounds while preserving their prior connector, allowance, connector-grid-centre, partial-overhang-evidence, and conservative collision declarations; the mesh cannot certify physical semantics. Per-file authorship, title, licence, status, and content hash are preserved for all 211 unique files and reproduced in the generated notice, which packages/catalog/src/bundled-geometry-notices.test.ts holds to the catalog. Both source tables are emitted from the byte-pinned archive, so the triangles, normals, and attribution cannot describe different files. Reuse is not training: trainingUseAllowed is false on every bundled record and that right stays unheld."
    },
    {
      "id": "builtin-stud-clutch-taxonomy",
      "category": "connector-data",
      "status": "implemented-project-authored",
      "source": "packages/catalog/src/",
      "version": "builtin.connectors/1",
      "declaredLicense": "MIT",
      "rightsPolicy": "project-mit",
      "allowedRoles": ["runtime", "tests", "distribution"],
      "intent": "Project-authored connector kinds, compatibility rules, and parametric port transforms. Externally authored connector positions remain separately attributed in the records below: eight measured parts use pinned LEGO Builder fields, thirteen use LDCad-derived positions, and 80015 revision E's two partial-overhang grips are pinned to LEGO Builder and independently cross-checked against LDCad. Builder metadata also names 25269, but that admission consumes neither its shell nor connector fields; its single central clutch comes only from the exact LDCad route. For 28802, the inspected Builder source instead names contradictory design 10201 and is refused; its six outward stud frames and two clutch cells come from the exact LDCad route. For 35787, the native Builder field has no reviewed catalog frame and exposes one node where the exact shadow subpart authors three cells; the record is retained as counterevidence while the catalog selects the exclusive LDCad route. For 11253, the unframed native Builder record agrees only in count; the exact LDCad route exclusively authors the selected clutch. For 15254, the exact native Builder revision-J record and measured official LDraw surface jointly pin yaw 90 plus `[0,-24,0]`; official LDraw stud ancestry authors the six top studs and the framed Builder record authors only the two end clutches. For 41682, Builder has no record and grants no authority; the exact LDCad tree exclusively authors two z-negative side studs and four underside clutches reconciled with the official surface. For 2877, the exact native Builder revision-E record and measured official LDraw surface jointly pin yaw 180 plus `[10,24,0]`; official LDraw stud ancestry authors the two top studs and the framed Builder record exclusively authors the two underside clutches. For 3040, the exact native Builder revision-F record and measured official LDraw surface jointly pin the canonical proper turn0 frame plus `[0,24,0]`; official LDraw stud ancestry authors the one top stud and the framed Builder record exclusively authors the two underside clutches. For 4519, direct shadow `parts/4519.dat` at `sha256:f5c2c6057cae2fd6cd77bc50b932bb3692ee42645b3d034e3fe944333be68344` declares one capless, centered, sliding male `SNAP_CYL` A6 6 x 60 shaft; the bounded route projects three discrete axle seats at x `[-20,0,20]` with normals `[-X,+X,+X]`. That projection does not authorize continuous sliding, grip, stability, or axle-through-bore collision allowance. For 32064, the exact shadow composition through `p/axlehol5.dat`, `p/stud2.dat`, and `parts/32064a.dat` authors its two stud seats, two clutch seats, and one capless sliding `YOnly` A6x1 female axle hole; the pinned source-to-catalog frame maps the raw hole endpoint `[0,10,0]` along `+Z` to catalog `[0,-2,0]` along `+X`. The emitted axle-hole endpoint is one discrete structural site only: it does not authorize continuous axial sliding, grip, stability, insertion access, or axle-through-bore collision relief, and a compatible edge can remain body-collision-blocked. For 11212, the exact shadow walk consults `p/stud.dat`, `p/stud4.dat`, and `parts/11212.dat`; active `p/stud.dat` metadata authors its nine stud seats, active root metadata authors its nine underside clutch seats, and the `p/stud4.dat` anti-stud declaration is disabled and authors none. The square source and connector lattice are quarter-turn symmetric, with yaw 0 selected as the canonical declared frame; revision-I record metadata from the checksum-pinned native pack reports nine clutches without a reviewed frame and remains count-only counterevidence that is not merged. For 33909, the exact shadow route through `p/stud.dat`, `p/stud4.dat`, and `parts/33909.dat` under yaw 0 plus translation `[0,-4,0]` authors two top studs at catalog `[-10,-4,10]` and `[10,-4,10]` and four underside clutch cells at x/z `±10`, y `4`; revision-E record metadata from the checksum-pinned native pack reports four clutches without a reviewed frame and remains count-only corroboration that is not merged. For 78329, the exact shadow route through `p/stud.dat`, `p/stud3.dat`, and `parts/78329.dat` under orientation `upright-yaw-90` plus translation `[0,-4,0]` independently matches its five visible studs and authors five underside clutch cells at z `[-40,-20,0,20,40]` in the width-first catalog frame. No source bundle or shadow file is included."
    },
    {
      "id": "builtin-analytic-collision-model",
      "category": "collision-data",
      "status": "implemented-project-authored",
      "source": "packages/catalog/src/",
      "version": "rectilinear-stud-clearance/3",
      "declaredLicense": "MIT",
      "rightsPolicy": "project-mit",
      "allowedRoles": ["runtime", "tests", "distribution"],
      "intent": "Project-authored bounded collision representations, including body-box unions shared with the renderer for parametric shells, inscribed underside-tube approximations, conservative disjoint convex-prism decompositions of circular plan features, and connector allowances derived from the catalog definitions. The body-box height fields for all twenty-one fully measured definitions are derived data measured at authoring time from their attributed bundled LDraw surfaces under the ldraw-bundled-part-geometry record; the sixteen render-only promotions preserve independently authored collision. The /3 model adds a source-bounded nominal-stud profile used only by an exact validated connector allowance: broad phase, unconnected overlaps, misaligned or forged edges, stud-stud checks, third-body collisions, and every ordinary collision primitive retain the exact source radius. For `11212`, all nine stud cylinders retain exact source radius `6.0001514980873605` LDU for ordinary collision; nominal 6 LDU is available only to exact validated stud-clutch edges. For `33909`, its 41 surface-derived body boxes plus two stud cylinders make 43 collision bodies; both cylinders retain exact source radius `6.0001514980873605` LDU for ordinary collision, while nominal 6 LDU is available only to exact validated stud-clutch edges. For `78329`, its 39 surface-derived body boxes plus five stud cylinders make 44 collision bodies; all five cylinders retain exact source radius `6.0001514980873605` LDU for ordinary collision, while nominal 6 LDU is available only to exact validated stud-clutch edges. The `4519` axle and `32064` axle hole add no axle-through-bore collision allowance; the latter's exact structural endpoint can therefore validate while conservative body collision still blocks the assembly. Neither path makes a render mesh a general runtime collision oracle."
    },
    {
      "id": "builtin-derived-three-geometry",
      "category": "render-geometry",
      "status": "implemented-project-authored",
      "source": "packages/rendering/src/",
      "version": "lego.rendering/1",
      "declaredLicense": "MIT",
      "rightsPolicy": "project-mit",
      "allowedRoles": ["runtime", "tests", "distribution"],
      "intent": "Disposable Three.js scenes derived from canonical catalog declarations: 61 parts render project-authored parametric primitives and analytic features, while 37 mesh-backed parts render their separately attributed bundled LDraw surface. Rendering is never an authoring source of truth."
    },
    {
      "id": "repo-owned-synthetic-examples",
      "category": "example-models",
      "status": "planned-project-authored",
      "source": "future benchmarks/dev and test fixtures",
      "version": "not-created",
      "declaredLicense": "MIT",
      "rightsPolicy": "project-mit",
      "allowedRoles": ["tests", "development-evaluation", "distribution"],
      "intent": "Only synthetic, repo-owned examples are approved by default; there are no example model files in the scaffold yet."
    },
    {
      "id": "synthetic-real-build-identification-goldens",
      "category": "regression-fixtures",
      "status": "implemented-project-authored",
      "source": "apps/web/test/fixtures/real-build-identification-golden/",
      "version": "lego.synthetic-real-build-identification-goldens/1; exact byte counts and SHA-256 digests bound in apps/web/test/real-build-identification-golden.ts",
      "declaredLicense": "MIT",
      "rightsPolicy": "project-mit",
      "allowedRoles": ["tests", "development-evaluation", "distribution"],
      "intent": "Reviewable repo-authored JSON fixtures preserve the synthetic identification pipeline closure without embedding encoded payload bytes in TypeScript source; the loader enforces each exact byte count and digest before use."
    },
    {
      "id": "ldraw-part-dimensions-reference",
      "category": "external-geometry-and-catalog-data",
      "status": "read-at-authoring-time-not-bundled",
      "source": "https://library.ldraw.org/library/official",
      "version": "per-file headers inspected 2026-08-02",
      "declaredLicense": "PER-FILE-CC-BY-2.0-OR-CC-BY-4.0",
      "rightsPolicy": "attribution-required-facts-only",
      "allowedRoles": ["dimension-reference-authoring-only"],
      "intent": "scripts/ldraw-part-facts.mjs reads official part files by hand to measure a part's stud positions, body extents, and local frame, which are then hand-authored into catalog blueprints as numbers. This layer copies no LDraw file, geometry, or mesh, and nothing fetches at runtime or during a gate; geometry that is bundled is recorded separately under ldraw-bundled-part-geometry. Attribution and the applicable CC BY version are retained from each file header."
    },
    {
      "id": "external-ldraw-parts-library",
      "category": "external-geometry-and-catalog-data",
      "status": "not-included-pending-audit",
      "source": "https://www.ldraw.org/legal-info",
      "version": "unselected",
      "declaredLicense": "UNVERIFIED-PER-FILE",
      "rightsPolicy": "external-evaluation-pending-audit",
      "allowedRoles": ["evaluation-only-after-audit"],
      "intent": "Potential interoperability reference. Any future import must preserve file-level source, license, and attribution rather than flattening geometry into project-owned data."
    },
    {
      "id": "ldraw-set-6651557-source-resolution-audit",
      "category": "external-catalog-source-metadata",
      "status": "included-metadata-only-attribution-bound",
      "source": "packages/catalog/src/quarantine/set-6651557-ldraw-source-audit.generated.json, reproduced offline from pinned local official and unofficial LDraw archives",
      "version": "lego.set-6651557-ldraw-source-audit/1; official archive sha256 6009f2e94204c4d3a63a4c812010b5c90bad8c5acb19b882c859fdac63734eae; unofficial archive sha256 09ec08007203b66e79b1f857aa4804cbee26e1337e177a7c3a87adc1268e44d4; generated audit sha256 cacee99596d0067223977a4cdf967e1aed6cbf072dec1aac8862e486a140cb42",
      "declaredLicense": "CC-BY-2.0-OR-CC-BY-4.0-PER-FILE-SOURCE-METADATA",
      "rightsPolicy": "attribution-required-facts-only",
      "allowedRoles": ["offline source-route evidence", "private reconstruction authoring", "tests"],
      "intent": "The generated JSON records one resolution-only row for each of the exact 121 required leaves, resolves 117 reviewed LDraw source routes, keeps 3245, 7562, 8172, and 89680 explicitly unresolved, and binds the 439-file transitive graph's root identities, direct references, content hashes, authors, licence expressions, and sizes. It is explicitly blocked from catalog admission, contains no LDraw source bytes or geometry, emits no PartDefinition, is not exported by the public catalog, performs no runtime fetch, and leaves every catalog frame unclaimed. scripts/generate_set_6651557_ldraw_source_audit.py verifies and re-verifies the same open archive handles around bounded traversal and reproduces or checks the source audit offline."
    },
    {
      "id": "lego-builder-21066-source-coverage-ledger",
      "category": "external-catalog-source-metadata",
      "status": "included-metadata-only-private-source-authorized",
      "source": "packages/catalog/src/quarantine/set-6651557-coverage-ledger.ts, derived from uncommitted local LEGO Builder and LXFML artifacts",
      "version": "lego.set-catalog-coverage-ledger/1; instructions sha256 baef0a373164b58d7c982984b52d4e50b10cc59ed28007acb456faa72359bd27; model XML sha256 c0564fd86ede633f6cb18738f999fbb70ee948ba93a55cc8d338b4b5f02b5922; Builder manifest sha256 3e57aa4df4ab5327c5b8408912d056ba73b93cd98e769e41d6aabaf6cb0618a6; cache report sha256 bf853ffadc349f43f13cf24c2f790a9bc556103c1c96fb24ad064aa502e475d8; missing-design audit sha256 c66a6ab711186f228234a4d70f7c0dabebc6d893895900c3bb672c01c501196f; all-design audit sha256 ab85e95fa94267b19dd16a160d270e48bf752926697c893db01b0597e7a8f4c4; precursor pack sha256 e5bb745faa79c5e7cb525eb0a11a8443815a0c4805c85644204b26c462ac636d",
      "declaredLicense": "USER-AUTHORIZED-PRIVATE-NONCOMMERCIAL-REFERENCE",
      "rightsPolicy": "private-noncommercial-source-reference",
      "allowedRoles": ["source coverage metadata", "private reconstruction authoring", "tests"],
      "intent": "The immutable ledger, which is not exported from the public catalog entry point, binds the exact 54 covered and 118 missing top-level designs, the 121 required leaf designs, the 107-record precursor pack, four separately checksum-verified composite components, ten checksum-mismatch quarantines, and the coverage-only 76382 decomposition. It retains hashes, identifiers, counts, source URLs, and bounded measurements only: no Builder bundle, mesh, primitive payload, LXFML model, LDraw geometry, booklet page, absolute local path, or base64 source bytes are committed or fetched by runtime or gates. Against the immutable 121-leaf denominator, the historical `/25` catalog identity intersection contained 19 design IDs at `sha256:7859f65b300f4e8a2b6dae85cffedbcd71e5f54fcffd8f688089c3353c549f28`; the current `/26` intersection contains 20 at `sha256:4e5df0a3aa5723b5aa5abef96e705562913c560a8a7452a2cf29582c2f05ba8f` after admitting `78329`; this is inventory coverage only, not a continuous printed-step prefix, build frontier, or adjudication of the stale step-39 pair-judged and step-101 unreviewed locators for 32064 or the internally inconsistent stale step-76 locator for 33909. The 33909 locator grants no trusted printed identity, printed crop, placement, action-ledger, or frontier authority. The 78329 catalog admission likewise grants no printed identity, crop, placement, action-ledger, or frontier authority. The separately retained action ledger remains bounded through step 25, and the step-26 `28802`/`10201` identity contradiction remains unresolved. Neither inventory count records a Gate-3 long run nor a current printed frontier. Source-integrity verification does not publish a PartDefinition or claim catalog, structural, visual, or physical validity."
    },
    {
      "id": "set-6651557-nine-part-source-pilot",
      "category": "external-render-geometry-and-primitive-frame-evidence",
      "status": "local-authoring-only-private-source-authorized-not-bundled-not-admitted",
      "source": "Nine exact roots and their audited closures in the local pinned official/unofficial LDraw archives, plus eight checksum-valid records from the local 107-record LEGO Builder native pack; 30357 remains explicitly unavailable from that pack because its Builder bundle failed the recorded integrity pin",
      "version": "lego.set-6651557-source-pilot/1; source audit sha256 cacee99596d0067223977a4cdf967e1aed6cbf072dec1aac8862e486a140cb42; official archive sha256 6009f2e94204c4d3a63a4c812010b5c90bad8c5acb19b882c859fdac63734eae; unofficial archive sha256 09ec08007203b66e79b1f857aa4804cbee26e1337e177a7c3a87adc1268e44d4; Builder native pack sha256 e5bb745faa79c5e7cb525eb0a11a8443815a0c4805c85644204b26c462ac636d; decoded binary sha256 76830eb4832492e5416ad6920ab4f8167b6cf55725641cce162ac8f9f215b6c7; retained report 14663 bytes sha256 a52e927a7901ab7fbcc680d7be14d397326f23bfa014e9b8c02aeceb5eeb1018",
      "declaredLicense": "LDRAW-NINE-CLOSURES-CC-BY-4.0; USER-AUTHORIZED-PRIVATE-NONCOMMERCIAL-BUILDER-REFERENCE",
      "rightsPolicy": "private-noncommercial-source-reference",
      "allowedRoles": ["local source-surface measurement", "local primitive-frame pressure measurement", "local Builder-to-LDraw frame derivation", "local connector-candidate emission scored against the measured LDraw surface", "private reconstruction strategy benchmark", "synthetic committed tests"],
      "intent": "scripts/derive-builder-ldraw-frame.py, with builder_ldraw_frame.py, builder_ldraw_frame_pins.py, builder_ldraw_frame_witness.py and part_admission_clutch.py, re-derives one integer Builder-to-LDraw frame per part from the same pinned inputs on every run, refuses to continue unless the derived frame reproduces the pinned SHA-256 that binds design, Builder revision letter, Builder record digest, matrix and translation, and emits stud and under-stud-clutch candidates that scripts/score-part-admission.py then measures against the expanded LDraw surface. Only per-part integer matrices, integer translations, node-family counts, lattice phases and bounded connector positions are retained; no Builder primitive XML, grid string, mesh, or bundle byte is committed. It emits no PartDefinition, bumps no catalog version, claims no catalog frame, and holds no admission authority. scripts/generate-set-6651557-source-pilot.py captures each exact pinned archive once into an immutable bounded snapshot, binds every opened file in the nine closures' 82-file union to its corresponding row and reference set in the complete exact 439-record source audit, reads the exact native pack through one held descriptor, rejects duplicate/non-finite or over-budget JSON, independently rehashes each reviewed metadata-and-binary slice, validates rigid primitive frames, and publishes only an ignored canonical measurement report through a prevalidated Windows directory handle. scripts/ldraw_surface_expander.py preserves exact type-1 composition including internal filename spaces, BFC winding and INVERTNEXT semantics, determinant reversal, bounded closure expansion, inherited visible-stud ancestry, and the official quad validity tolerances. No LDraw text, expanded geometry, Builder payload, base64, absolute source path, or mesh is committed or packaged. The report is explicitly measurement-only: it emits no PartDefinition, claims no frame/connector/collision truth, performs no runtime fetch, and cannot admit or self-certify a catalog part."
    },
    {
      "id": "unitypy-builder-shell-extractor",
      "category": "external-authoring-software-dependency",
      "status": "local-authoring-only-pinned-not-bundled",
      "source": "https://pypi.org/project/UnityPy/1.25.3/; upstream https://github.com/K0lb3/UnityPy; transitive source-artifact provenance remains pending audit",
      "version": "Pinned import environment contract sha256 c4cc3cf7e9e066258688bc9fcace54e0b5c32d39f01956f07d1aff9c25dba80b: UnityPy 1.25.3, archspec 0.2.6, astc-encoder-py 0.1.12, attrs 26.1.0, brotli 1.2.0, etcpak 0.9.15, fmod_toolkit 0.1.3, fsspec 2026.7.0, lz4 4.4.5, pillow 12.3.0, pyfmodex 0.7.2, texture2ddecoder 1.0.6, and tpk_ar 0.2.4; exact per-distribution RECORD digests, wheel tags, and admitted top-level imports are hard-coded in scripts/builder-import-snapshot.py; CPython 3.13 Windows x86-64 UnityPy wheel unitypy-1.25.3-cp313-cp313-win_amd64.whl sha256 255b7284e2f61161ceb0b361f742ac516236e0785fdb11c7d6911e691f1c0782; UnityPy installed RECORD sha256 2c0725359f1bee3e737b2acf4e7bcc37724645db94c3219945aabb45ca0da379",
      "declaredLicense": "UnityPy MIT; transitive distribution license metadata and texts pending independent audit",
      "rightsPolicy": "pypi-artifact-spdx-unverified",
      "allowedRoles": ["local authoring-only decoding of the fifteen checksum-pinned Builder Shell meshes", "local authoring-only quarantine-report discovery of the one checksum-pinned 3245 revision M Builder bundle", "local authoring-only quarantine geometry comparison of that exact 3245 revision M Shell"],
      "intent": "Four executors share this pinned environment: scripts/extract-builder-shell.py, scripts/generate-builder-calibration.py, scripts/discover-builder-shell.py with its discover_builder_shell_core.py, discover_builder_shell_metadata.py, discover_builder_shell_publication.py and discover_builder_shell_worker.py siblings, and scripts/identify-builder-3245-variant.py with its identify_builder_3245_variant_core.py and identify_builder_3245_variant_report.py siblings. The latter two paths emit bounded quarantine evidence for design 3245 revision M only and hold no admission authority: neither can write SUPPORTED_SHELLS, emit a PartDefinition, mark the design supported, or resolve source authority. The variant comparator performs two byte-identical fresh isolated decodes, keeps raw decoded arrays inside its controller-owned temporary directory, measures all three fixed official LDraw candidates in one exterior-derived frame with independent synthetic instrument controls, and publishes an explicit unresolved result because no numerical decisive margin was predeclared and the Builder-manifest MD5 contradiction remains unresolved. The pinned environment is the one real barrier to decoding an untrusted Builder bundle here, and the refusal is executable rather than documentary: CORE.assert_pinned_environment_for_retained_bundle refuses to hand the exact retained 3245-M bytes to any loader unless the active import root is the exact 13-distribution set with matching RECORD digests. The CPython 3.13 interpreter check is necessary but is not that barrier - conforming 64-bit CPython 3.13 interpreters exist on the development machine and satisfy it - so installing UnityPy into an ordinary interpreter's site-packages does not unblock a real decode. scripts/extract-builder-shell.py and its focused scripts/builder-import-snapshot.py helper validate the hard-coded 13-distribution environment contract and exact dist-info set, then same-handle capture every non-bytecode RECORD-pinned payload before writing a fresh private temporary snapshot. A child CPython process launched with -I -S -B revalidates that snapshot, disables bytecode writes, limits sys.path to the snapshot and trusted base-runtime paths, constrains PATH, and imports UnityPy only from the snapshot; the mutable original target is never placed on the worker import path, stray top-level modules and timestamp-valid pyc files are not copied, and the snapshot is deleted only after the worker exits. The controller bounds and independently validates the worker report's strict JSON schema, identities, counts, finite coordinates, index ranges, and canonical mesh digest before publishing it, then admits only the hard-coded fifteen reviewed bundle/path/count tuples. UnityPy and the pinned authoring environment are not committed, bundled, fetched by runtime or gates, used as catalog authority, or approved for training. Transitive source-artifact provenance and license/text review remain a Gate 0 gap."
    },
    {
      "id": "lego-builder-step1-shell-frame-calibration",
      "category": "external-render-geometry-and-frame-evidence",
      "status": "local-authoring-only-private-source-authorized-not-bundled",
      "source": "Local checksum-pinned LEGO Builder Shell meshes for the fifteen design revisions set 6651557 places in its opening printed steps - 3020;L, 3032;F, 3034;J, 3460;N, 3795;I, 3832;G, 6106;D, 30503;F, 30565;E, 41539;F, 51739;H, 54383;F, 60479;F, 80015;E, 91988;F - the retained 21066 LXFML model, and local checksum-pinned official/unofficial LDraw archives used only as an independent surface comparison",
      "version": "lego.builder-canonical-calibration/8 over frame evidence protocol builder-type23-frame-plus-ldraw-surface/3; model sha256 c0564fd86ede633f6cb18738f999fbb70ee948ba93a55cc8d338b4b5f02b5922; fifteen reviewed Builder bundle and Shell canonical SHA-256 pairs pinned in apps/web/e2e/real-build-builder-sources.ts and scripts/builder_calibration_sources.py; official LDraw archive sha256 6009f2e94204c4d3a63a4c812010b5c90bad8c5acb19b882c859fdac63734eae; unofficial LDraw archive sha256 09ec08007203b66e79b1f857aa4804cbee26e1337e177a7c3a87adc1268e44d4; exact 102-file official LDraw closure manifest sha256 8674c2d085b3ddd3690cec5832e4c14f5e9705ddbeccc3a9249b4a41e50d8823; local geometry bundle 1091772 bytes sha256 da8260f77540db459bd745d75ebb072d1b08d357d1628569a06c58d6aed77c55; the retained `/24` ignored calibration report is schema /8 and 20379 bytes; its digest is deliberately not pinned here because it embeds BUILTIN_CATALOG_VERSION and moves on every catalog bump",
      "declaredLicense": "USER-AUTHORIZED-PRIVATE-NONCOMMERCIAL-REFERENCE; LDRAW-PER-FILE-CC-BY-2.0-OR-CC-BY-4.0",
      "rightsPolicy": "private-noncommercial-source-reference",
      "allowedRoles": ["local render-surface comparison", "private reconstruction frame calibration", "tests with synthetic committed fixtures"],
      "intent": "scripts/extract-builder-shell.py parses the exact captured bytes of one hard-coded checksum-pinned Builder bundle per design and emits a local Shell inspection; scripts/generate-builder-calibration.py parses the exact already-hashed local archive bytes under fixed ZIP expansion bounds and writes one ignored local geometry bundle. Before geometry expansion, every traversed LDraw member must match the metadata-only closure's normalized path, SHA-256, Author, !LICENSE, and !LDRAW_ORG values; all 102 are official-library files, 100 declaring CC BY 4.0 and two declaring both CC BY 2.0 and CC BY 4.0 in their own headers, and the unofficial archive may not contribute. The frames themselves are derived in apps/web/e2e/real-build-builder-calibration.ts from those bytes and the reviewed source pins, so no catalog version or frame is hardcoded in the Python generator. Each frame is an exact integer stud-lattice correspondence, quotiented by the catalog part's own measured self-symmetry and, where symmetry cannot explain the residual, settled by the independent LDraw surface at a required margin. 41769;G is deliberately absent: its served bundle hashes md5 fb1e8bb3edf0174350cf84b75a378b6a against the manifest's declared cab7c4020d384b66e079c5c86bb40f03, so it stays quarantined and undecoded. No Builder bundle, Shell report, LDraw source text, expanded LDraw geometry, generated geometry bundle, calibration report, or source path is committed, packaged, fetched at runtime, uploaded, or approved for training. This evidence does not admit a PartDefinition and cannot author or independently certify connector truth (C), collision truth (X), or canonical frame truth (F); it is a reproducible local review input only, and changing a digest or limit is not source authorization.",
      "trainingUse": "Refused. Not designated as a model-training or benchmark corpus; the owner's private-noncommercial reading authorization is not training permission, and the per-file LDraw CC BY terms above license reuse rather than training."
    },
    {
      "id": "lego-builder-3245-M-quarantined-bundle",
      "category": "external-render-geometry-and-primitive-frame-evidence",
      "status": "local-authoring-only-private-source-authorized-not-bundled-not-admitted",
      "source": "https://api.prod.dbix.i.lego.com/api/v1/Bricks/3245?Revision=M&Platform=Android, retained locally and only locally at the ignored path output/real-build/sources/3245-M-android.bundle with its sibling capture record 3245-M-android.capture.json; the retained primary 21066 model XML and its derived LDR cross-check; and official LDraw parts/3245a.dat, parts/3245b.dat, parts/3245c.dat plus their closures from the checksum-pinned local official archive",
      "version": "3245 revision M, Android platform; bundle 85098 bytes sha256 1aa4e8333df9914191a4d941a7ce0f95460311eabd8f159f9e4a9b1e5c1c9534, md5/ETag bdce3745e99adf9c3bfb0708161c6875, object version fLSSBMSQEk2QBK4jCeJIpJ0WIlOaCfpF, upstream last-modified 2026-02-17T12:37:35Z, retrieved 2026-08-03T21:22:17Z; capture schema lego.builder-live-source-capture/1 and capture sha256 7fc1cd42f22af7d58c9531dffbc1fa18de48624cbfb76f706a2fb56213cf3a3f; primary model 1903169 bytes sha256 c0564fd86ede633f6cb18738f999fbb70ee948ba93a55cc8d338b4b5f02b5922; derived LDR 139649 bytes sha256 096b78037ef1ee15a6dcff90b38f00f09465d0f5a246cb6f5f08fac087dd7bc2; official archive sha256 6009f2e94204c4d3a63a4c812010b5c90bad8c5acb19b882c859fdac63734eae",
      "declaredLicense": "USER-AUTHORIZED-PRIVATE-NONCOMMERCIAL-REFERENCE; LDRAW-PER-FILE-CC-BY-4.0",
      "rightsPolicy": "private-noncommercial-source-reference",
      "allowedRoles": ["local quarantine-report source evidence", "local quarantine-only same-frame surface comparison", "private reconstruction authoring"],
      "intent": "One exact untrusted third-party LEGO Builder bundle, retained because 3245 is one of the required designs with no selected exact LDraw source route and an alias manufactured to fill that gap would be worse than the gap. It is hostile input: scripts/discover-builder-shell.py and scripts/identify-builder-3245-variant.py may read it only inside the pinned RECORD-verified UnityPy snapshot recorded by unitypy-builder-shell-extractor. Discovery preserves its zero-primitive-XML refusal. The separate comparator decodes exactly one Shell twice in fresh isolated workers, applies the established lego-builder-native-to-catalog-ldu/1 proper basis before exterior registration, measures bounded interior-sensitive surface populations against all three official LDraw candidates, keeps decoded arrays local and ignored, and emits only a strict unresolved quarantine report. Its fixed-topology barycentric population is topology-weighted and explicitly not generally tessellation-invariant. The current fixed report observes parts/3245c.dat as the best geometric fit but cannot select it: no numerical decisive margin was declared before the target scores were seen, the upstream manifest's expected MD5 a679d0929e777a86573469a63ce841dd still contradicts the captured body's independently reproduced MD5/ETag bdce3745e99adf9c3bfb0708161c6875, and the derived model LDR names 3245b.dat ten times without retaining the converter or revision-M alias table needed to give that cross-check official selection authority. Explicitly not approved: catalog admission, PartDefinition emission, SUPPORTED_SHELLS membership, frame/connector/collision truth, redistribution of Builder bytes, packaging, runtime or gate fetching, upload, benchmark inclusion, and model training. The Builder bundle and decoded geometry are never committed - the whole output/ root is gitignored - and the private-noncommercial authorization for local reconstruction does not relicense LEGO's material or waive this record.",
      "trainingUse": "Not designated as a model-training or benchmark corpus; the owner's private-noncommercial reading authorization is not training permission."
    },
    {
      "id": "lego-builder-41769-G-quarantined-bundle",
      "category": "external-render-geometry-and-primitive-frame-evidence",
      "status": "quarantined-manifest-declaration-mismatch-not-decoded-not-admitted",
      "source": "https://api.prod.dbix.i.lego.com/api/v1/Bricks/41769?Revision=G&Platform=Android, published by the LEGO Group; retained locally and only locally at the ignored path C:/tmp/lego-21066-builder-assets/quarantine/41769-G-android-fb1e8bb3edf0174350cf84b75a378b6a.bundle with its capture record at the ignored path output/real-build/sources/41769-G-android.capture.json",
      "version": "41769 revision G, Android platform; served bundle 97802 bytes sha256 9408d7815b145c787d4dc7635b2e3ddadeaab946cbd127cb60da7044768c51bc, md5/ETag fb1e8bb3edf0174350cf84b75a378b6a, object version BghIX8UDJ6cJ7v24PmUMRLlp70XFZPPX, upstream last-modified 2025-08-29T08:50:15Z, re-acquired 2026-08-06T05:23:15Z under one same-host redirect to /assets/brick/vx0041769_41769_g/android; the 175-row Builder manifest sha256 3e57aa4df4ab5327c5b8408912d056ba73b93cd98e769e41d6aabaf6cb0618a6 declares md5 cab7c4020d384b66e079c5c86bb40f03 for this row, which the served object does not reproduce; capture schema lego.builder-live-source-capture/1",
      "declaredLicense": "USER-AUTHORIZED-PRIVATE-NONCOMMERCIAL-REFERENCE",
      "rightsPolicy": "private-noncommercial-source-reference",
      "allowedRoles": ["local quarantine provenance evidence"],
      "intent": "One exact untrusted third-party LEGO Builder bundle, re-acquired under owner authorization on 2026-08-06 because 41769;G is the last official-frame-calibration-missing design in the set 6651557 printed steps. It is recorded and not admitted. The bytes are internally sound - HTTP Content-Length, received length and the UnityFS header's own declared total size all read 97802, the origin ETag equals the body md5, and the payload is byte-identical to the 2026-08-02 quarantine copy four days earlier against an upstream last-modified of 2025-08-29 - so transport damage, truncation and a fetch race are all excluded. What is not sound is the declaration: the manifest Checksum column is demonstrably a whole-served-payload md5, because all 157 named locally captured bundles reproduce their declared checksum exactly with zero mismatches, and 18 of the 175 rows nevertheless serve an object whose md5 differs from the value declared for it, reproducibly across a manifest regeneration 25 minutes later. The mismatch is therefore a stale or wrong upstream declaration, not a corrupt payload, but it leaves the bundle with no independent witness that agrees with it, so the quarantine stands. No decode was performed and none is possible here without weakening a pin: scripts/extract-builder-shell.py admits only its fifteen reviewed tuples, and scripts/discover-builder-shell.py is hard-pinned to design 3245 revision M at 85098 bytes and refuses 97802 at its byte ceiling. Explicitly not approved: catalog admission, PartDefinition emission, SUPPORTED_SHELLS membership, frame/connector/collision truth, decoding, redistribution, packaging, runtime or gate fetching, upload, benchmark inclusion, and model training. Redistribution is refused. Training is refused. The bundle bytes are never committed - the whole output/ root is gitignored - and the private-noncommercial authorization for local reconstruction does not relicense the LEGO Group's material or waive this record.",
      "trainingUse": "Refused. Not designated as a model-training or benchmark corpus; the owner's private-noncommercial acquisition authorization of 2026-08-06 explicitly excluded redistribution, packaging, runtime fetching, upload, benchmark inclusion and training."
    },
    {
      "id": "lego-builder-80015-connectivity-fact",
      "category": "external-connector-data",
      "status": "read-at-authoring-time-fact-pinned",
      "source": "https://api.prod.dbix.i.lego.com/api/v1/Bricks/80015?Revision=E&Platform=Android",
      "version": "80015 revision E; manifest sha256 3e57aa4df4ab5327c5b8408912d056ba73b93cd98e769e41d6aabaf6cb0618a6; bundle md5 bb72d5b5609e411392df36903c8c5daa; bundle sha256 f3a11d40f9de9fa54670bdd87db0a87e034896d87b56e64e9f382c3ef0098c75; primitive XML sha256 ad9aca4ca7275358e2f680ad154b5f577f8fc79b87a8ea1c60aea4558a0a23bc; normalized seven-offset fact sha256 0e77ae20bce268bcde610fa8d2b34fa2e91a0c3a0132e298e933433591e8f0d5",
      "declaredLicense": "USER-AUTHORIZED-PRIVATE-NONCOMMERCIAL-REFERENCE",
      "rightsPolicy": "private-noncommercial-source-reference",
      "allowedRoles": ["runtime connector fact", "tests", "private reconstruction"],
      "intent": "The manifest-pinned Custom2DField type-22 centres establish seven underside grips for 80015, including the two explicit partial-overhang offsets [30, -70] and [70, -30] in catalog LDU coordinates. The bundle and primitive XML are not committed or fetched by runtime or gates."
    },
    {
      "id": "ldcad-shadow-library-connectors",
      "category": "external-connector-data",
      "status": "read-at-authoring-time-derived-connectors-admitted-no-file-bundled",
      "source": "https://github.com/RolandMelkert/LDCadShadowLibrary, retained locally and only locally as a working-tree checkout of the pinned commit",
      "version": "commit 15aa1e718b6a8da37d24fc7af5e52e262c041bfb, authored 2026-03-15 by Roland Melkert; whole-tree manifest of 4257 files and 1768204 bytes, sha256 668bc047a45e5560ff0fbbd69e9eb5adafab127781720bcb069a1554cb3f0c0f over the sorted lowercased path/bytes/sha256 table excluding .git; LICENSE.md sha256 23ee78c8bae49cf08ea2f0c84945c66b987ebe4520881fb51b3dad4fb43d07c2; parts/80015.dat sha256 c4dbcc5c5e2969e2b6e5c394519606a66b8483437503b8f4886cdf9262cd7170; parts/s/80015s01.dat sha256 fa4324fccee90f9903c68c65a75bb4e747a76d429a94d648c10b9e24ceb4d879; parts/s/25269s01.dat sha256 c9dc60933f1476d94b050539a3a755d5cfbe2c56a021e813aa8a2119a650b8ce; exact 28802 route parts/28802.dat plus p/stud.dat, p/stud2.dat and p/stud3.dat; exact 35787 route parts/s/35787s01.dat sha256 94dab3296c585c746af8433c18d882a5fc65db88b8a61d2717b6375b2d042095; exact 11253 route p/stud.dat plus parts/11253.dat; exact 41682 route p/stud.dat, p/stud3.dat, p/stud4.dat and parts/41682.dat; direct parts/4519.dat sha256 f5c2c6057cae2fd6cd77bc50b932bb3692ee42645b3d034e3fe944333be68344; exact 32064 route p/axlehol5.dat, p/stud2.dat, and parts/32064a.dat; exact 11212 consulted route p/stud.dat, p/stud4.dat, and parts/11212.dat, with no active meta in p/stud4.dat; exact 33909 consulted route p/stud.dat, p/stud4.dat, and parts/33909.dat; exact 78329 consulted route p/stud.dat, p/stud3.dat, and parts/78329.dat",
      "declaredLicense": "CC-BY-SA-4.0",
      "rightsPolicy": "private-noncommercial-source-reference",
      "allowedRoles": [
        "authoring-time connector fact cross-check",
        "runtime source-derived connector truth for catalog parts that select the LDCad route as authority",
        "local female-connector coverage survey over the 121 required 6651557 leaves",
        "tests",
        "private reconstruction",
        "distribution as attributed share-alike derived data"
      ],
      "licenseFinding": "The library states CC BY-SA 4.0 in its README and ships the full Attribution-ShareAlike 4.0 International text as LICENSE.md, and every read file repeats `0 !LICENSE CC BY-SA 4.0, see LICENSE.md` in its own header. Reading it and recording measurements is permitted with attribution. Section 4 of that licence also covers sui generis database rights, so extracting a substantial portion of the library's contents into a new database makes that database Adapted Material.",
      "shareAlikeObligation": "The owner directed on 2026-08-05 that licence must not block this work, because it is private and noncommercial, and LDCad-derived connectors MAY now be admitted. That decision waives nothing it does not say. Three obligations stand and are recorded rather than dropped. (1) Attribution travels with the derived data: `LDCAD_SHADOW_CONNECTOR_PROVENANCE` in packages/catalog/src/constants.ts names Roland Melkert and cites the per-file !HISTORY contributors as a class on every admitted part, carries the pinned commit and whole-tree manifest digest in its sourceVersion, and declares `MIT AND CC-BY-SA-4.0`; docs/bundled-geometry-notices.md renders the catalog attribution and separately names the exact admitted-route contributors Roland Melkert, Philippe Hurbain, and Jason McReynolds from a path-keyed pinned-header map that refuses an unknown route file. (2) ShareAlike attaches to the derived connector data if it is ever redistributed — section 4's sui generis database-rights clause reaches an extracted database too — so a public release of this repository would have to license that data share-alike or re-derive it independently; the catalog remains MIT and the derived connector data is dual-recorded rather than silently relicensed. (3) Training rights are still not held: a CC BY-SA licence to read and share is not permission to train, `trainingUseAllowed` stays false on every record, and no shadow-derived data is designated as a training or benchmark corpus. No shadow file, meta line, header or excerpt is committed at any point; what is admitted is derived positions.",
      "intent": "The exact 80015 shadow part and subpart independently confirm five of LEGO Builder's seven underside centres, including both partial-overhang seats; they do not establish the two endpoint seats at [-10, -70] and [70, 10]. scripts/ldcad_shadow_source.py verifies the whole tree before parsing; scripts/ldcad_shadow_metas.py rejects unknown commands; scripts/ldcad_shadow_connectors.py composes snap metadata through each LDraw tree in exact rational arithmetic; and scripts/ldcad_shadow_coverage.py checks those results against measured stud primitives, pinned Builder frames, and all 121 required leaves. Three designs with no Builder record — 30357, 2450, and 79491 — retain 16 LDCad-derived clutch cells admitted at builtin.basic-parts/8. At /14, the exact `parts/s/25269s01.dat` route adds one LDCad-authored central clutch at raw `[0, 8, 0]`, composed through the pinned upright frame to catalog `[0, 4, 0]`; Builder metadata record presence is not consumed as surface, frame, or connector authority. At /15, the exact `parts/28802.dat` route through `p/stud.dat`, `p/stud2.dat`, and `p/stud3.dat` adds six outward stud frames and two clutch cells; the four side-facing stud frames remain represented and collision-checked but unusable under the upright-only transform policy. The inspected Builder source names 10201 instead and is refused rather than merged. At /16, the exact `parts/s/35787s01.dat` route adds three raw female R6x4 cells at `[-10,8,-10]`, `[-10,8,10]`, and `[10,8,-10]`, which the pinned yaw-0 plus `[0,-4,0]` frame maps to the matching catalog cells under the occupied triangular half. The native Builder record has no reviewed catalog frame and exposes only one node; it remains counterevidence and is not merged. At /17, the exact `p/stud.dat` plus `parts/11253.dat` route adds one clutch at raw `[0,8,0]`, composed through the pinned yaw-0 plus `[0,-4,0]` frame to catalog `[0,4,0]`; the unframed native Builder record agrees only in count and remains counterevidence. At /19, the exact `p/stud.dat`, `p/stud3.dat`, `p/stud4.dat`, and `parts/41682.dat` tree adds four clutch cells at raw y 8 and two negative-z studs at raw `[-10,-10,-4]` and `[10,-10,-4]`; the pinned yaw-0 plus `[0,6,0]` frame maps them to the catalog's four `y=14` clutches and studs at `[-10,-4,-4]` and `[10,-4,-4]`. Builder has no record for the design and grants no authority. At /22, direct `parts/4519.dat` declares one exact capless, centered, sliding male `SNAP_CYL` A6 6 x 60 shaft; the bounded exact route accepts no scale or mirror and projects three discrete axle seats at x `[-20,0,20]` with normals `[-X,+X,+X]`. At /23, the exact `p/axlehol5.dat`, `p/stud2.dat`, and `parts/32064a.dat` tree authors two studs, two underside clutches, and one capless sliding `YOnly` A6x1 female axle-hole row; the pinned frame maps raw `[0,10,0]` along `+Z` to catalog `[0,-2,0]` along `+X`. At /24, the exact walk consults `p/stud.dat`, `p/stud4.dat`, and `parts/11212.dat`; active `p/stud.dat` metadata authors nine studs, active root metadata authors nine underside clutch cells, and `p/stud4.dat` has only a disabled anti-stud declaration; the square source and connector lattice are quarter-turn symmetric with yaw 0 selected as the canonical declared frame. Revision-I record metadata from the checksum-pinned native pack reports nine clutches without a reviewed frame and remains count-only counterevidence. At /25, the exact `p/stud.dat`, `p/stud4.dat`, and `parts/33909.dat` route under yaw 0 plus translation `[0,-4,0]` authors two top studs at catalog `[-10,-4,10]` and `[10,-4,10]` and four underside clutch cells at x/z `±10`, y `4`; revision-E record metadata from the checksum-pinned native pack reports four clutches without a reviewed frame and remains count-only corroboration. At /26, the exact `p/stud.dat`, `p/stud3.dat`, and `parts/78329.dat` route under orientation `upright-yaw-90` plus translation `[0,-4,0]` independently matches five top studs at catalog `[0,-4,z]` and authors five underside clutch cells at `[0,4,z]` for z `[-40,-20,0,20,40]`. Per-record numeric refusal prevents one malformed shadow row from aborting unrelated measurements. Neither axle admission establishes continuous sliding, grip strength, stability, insertion access, or axle-through-bore collision relief; `32064` retains conservative body collision even for a structurally compatible axle edge. At /12 the measured-table generator also uses the pinned LDCad routes for 30503, 6106, and 30565 as scored admission evidence, but their promoted catalog definitions preserve the prior project-authored connector arrays, so no new LDCad-derived connector truth is admitted. The generator refuses the complete measured catalog emission if any candidate hard-fails the part-admission scorer. npm run test:python gates the bounded parser, the 4251-file parse sweep, and coverage contracts. No shadow file, meta line, header, or excerpt is committed, packaged, or fetched by runtime or gates.",
      "trainingUse": "Not designated as a model-training or benchmark corpus; a CC BY-SA licence to read and share the material is not permission to train on it, and no separate right has been obtained."
    },
    {
      "id": "claude-code-part-identification-transport",
      "category": "external-authoring-software-dependency",
      "status": "local-install-pinned-in-code-provider-execution-disabled",
      "source": "User-installed Anthropic Claude Code CLI for Windows; the binary is not committed, packaged, fetched by runtime, or invoked by ordinary gates",
      "version": "Claude Code 2.1.232; 319026336-byte Windows executable sha256 ec9e32479bc887809003c91384c6c3a26e7691856d1916f72f6f6d21800f3bd6; local part-identification transport contract lego.part-identification-claude-mcp-transport/1 at sha256 5c1730b7c6a2b99e3e82f05129fdfa522bf6a6f78cf24b90fa0af9dac99b1c4f",
      "declaredLicense": "UNVERIFIED-ANTHROPIC-PROPRIETARY-TERMS",
      "rightsPolicy": "external-evaluation-pending-audit",
      "allowedRoles": ["synthetic local transport-contract tests", "future cropped-card proposer transport only after a separate reviewed Gate-0 authorization"],
      "intent": "The strict local adapter is source code for a fail-closed future proposer path. It pins the installed CLI identity, disables built-in tools and setting sources, exposes one no-argument MCP image tool, and retains sanitized local diagnostic proof. Both production entrypoints currently throw before any runtime or provider work because no card-scoped consent/provider-policy record or immutable success/failure launch settlement exists. This BOM row records the local software dependency; it does not authorize executing it, transmitting a crop, treating its proof as provider-authenticated, redistributing the binary, or using model output as catalog, document, validation, acceptance, benchmark, or training authority.",
      "trainingUse": "No transmission, benchmark inclusion, or training use is authorized by this record."
    },
    {
      "id": "anthropic-firstparty-claude-opus-5-part-identification",
      "category": "external-generator-code-data-weights",
      "status": "not-used-current-generation-provider-disabled-pending-policy-and-consent",
      "source": "Anthropic first-party Claude service, reachable only through the separately recorded local Claude Code CLI after a future reviewed authorization",
      "version": "requested and response identity claude-opus-5; current local transport evidence level local-diagnostic/sanitized-downstream with providerExecutionAuthenticated false and executableReplay false",
      "declaredLicense": "UNVERIFIED-ANTHROPIC-SERVICE-TERMS-AND-PRIVACY-POLICY",
      "rightsPolicy": "external-evaluation-pending-audit",
      "allowedRoles": ["future proposer-only identification of exact consented cropped part cards after source-specific policy and privacy review"],
      "intent": "No trusted current-generation call has been made. The stopped legacy transport left 73 ignored replies that are quarantined and refused by answer schema /5 after the model created local files despite its nominal Read allowance. A future one-call pilot may expose only one exact ordered six-card packet after an immutable record binds purpose, card/request/transport digests, crop-scoped consent, reviewed provider policy and privacy state, provider/model identity, one-launch budgets, and success/failure settlement through the request and retained lineage. No whole booklet or page, unrelated repository content, credential, session detail, source bundle, user document, or candidate acceptance capability is an allowed input. A proposal remains untrusted local diagnostic evidence and cannot admit a part, certify truth, mutate a document, establish that Anthropic executed the call, or become a benchmark/training corpus.",
      "trainingUse": "No crop transmission or provider training use is authorized by this pending record; that decision requires separate explicit evidence."
    },
    {
      "id": "bricknet-code-data-and-weights",
      "category": "external-generator-code-data-weights",
      "status": "not-included-pending-audit",
      "source": "https://github.com/kulits/BrickNet",
      "version": "unselected",
      "declaredLicense": "UNVERIFIED",
      "rightsPolicy": "external-evaluation-pending-audit",
      "allowedRoles": ["evaluation-only-after-audit"],
      "intent": "Research reference only; code, datasets, connector assets, collision assets, and weights require separate audits."
    },
    {
      "id": "brickgpt-code-data-and-weights",
      "category": "external-generator-code-data-weights",
      "status": "not-included-pending-audit",
      "source": "https://github.com/AvaLovelace1/BrickGPT",
      "version": "unselected",
      "declaredLicense": "UNVERIFIED",
      "rightsPolicy": "external-evaluation-pending-audit",
      "allowedRoles": ["evaluation-only-after-audit"],
      "intent": "Research reference only; upstream code, dataset, solver, and weight terms require separate audits."
    },
    {
      "id": "booklet-edge-profile-fixture",
      "category": "derived-measurement-from-external-instruction-booklet",
      "status": "included-private-source-authorized",
      "source": "apps/web/src/instructions/__fixtures__/booklet-edges.json, traced from the uncommitted LEGO set 21066 booklet recipes/6651557.pdf",
      "version": "captured 2026-07-31 at render scales 4 and 6",
      "declaredLicense": "UNVERIFIED-SOURCE-BOOKLET-COPYRIGHT-LEGO",
      "rightsPolicy": "private-noncommercial-source-reference",
      "allowedRoles": ["regression fixture for stud pitch detection", "private reconstruction", "local evaluation"],
      "intent": "Twelve integer arrays give the topmost row of a highlight outline per pixel column, plus a verdict set by looking at the rendered region. The owner authorizes the local LEGO set 21066 booklet recipes/6651557.pdf as a private, noncommercial reconstruction and evaluation input. The source booklet remains uncommitted and no artwork, page, or expressive excerpt is shipped; the retained fixture records only an edge measurement that cannot reconstruct the page."
    },
    {
      "id": "internet-curated-models",
      "category": "external-example-and-training-models",
      "status": "not-included-pending-audit",
      "source": "no source approved",
      "version": "none",
      "declaredLicense": "UNVERIFIED",
      "rightsPolicy": "external-evaluation-pending-audit",
      "allowedRoles": ["evaluation-only-after-audit"],
      "intent": "Models found online are not approved for examples, benchmarks, retrieval, knowledge, or training merely because their referenced part geometry may be reusable."
    }
  ]
}
```
<!-- bom-data:end -->

## Current Gate 0 gaps

- The direct-dependency inventory is checked, but transitive dependency notices and license files are not yet audited.
- `THIRD_PARTY_NOTICES.md` is generated deterministically from the complete locked npm graph and checked for drift. The distributable-package attribution/exclusion test does not exist yet, so distribution remains blocked until it passes and the packaged license texts are audited.
- The 98-part `builtin.basic-parts/26` catalog, connector taxonomy, collision model, and derived Three.js geometry are implemented with versioned provenance; individual geometry recipes carry SHA-256 content hashes and the truth snapshot pins their aggregate interpretation inputs. Synthetic benchmark examples remain an intent record.
- Real LDraw part geometry is bundled under the selected CC BY 4.0 option for 37 parts: eight fully measured definitions admitted at `builtin.basic-parts/7` and `/8`, `25269` admitted as the ninth at `/14`, `28802` admitted as the tenth at `/15`, `35787` admitted as the eleventh at `/16`, `11253` admitted as the twelfth at `/17`, `15254` admitted as the thirteenth at `/18`, `41682` admitted as the fourteenth at `/19`, `2877` admitted as the fifteenth at `/20`, `3040` admitted as the sixteenth at `/21`, `4519` admitted as the seventeenth at `/22`, `32064` admitted as the eighteenth at `/23`, `11212` admitted as the nineteenth at `/24`, `33909` admitted as the twentieth at `/25`, `78329` admitted as the twenty-first at `/26`, four existing parts promoted to exact visible surfaces and visual bounds at `/12`, and twelve more promoted at `/13`. The `/13` assets store source-faithful normals for all 24 then-existing meshes so type-2 hard edges stay crisp instead of being globally smoothed at runtime, and correct source-exact triangulation for 23 generated meshes. Migration reports render geometry for those 24 because `54200` also replaces its parametric `/12` catalog drawing with that exact mesh. File-level attribution now covers 209 files that declare CC BY 4.0 plus dual-licensed `parts/30503.dat` and `parts/32064a.dat`, both used here under their CC BY 4.0 option. All sixteen promotions preserve their reviewed connector, allowance, and conservative collision declarations; a render mesh does not establish physical truth.
- **Nothing is approved for training.** Reuse of the bundled geometry is not permission to train on it; that right stays unheld and is recorded as `trainingUseAllowed: false` on every record. No LEGO Builder bundle or XML, LDCad Shadow Library file, research-model code/data/weights, internet-curated model, or booklet page is approved for packaging either. Minimal source-pinned measurements and metadata for the private reconstruction are allowed where this BOM names their exact role; currently that includes official LDraw dimensions, the metadata-only 6651557 LDraw source-resolution audit and 21066 source-coverage ledger, the local-only nine-part LDraw/Builder source pilot, the fifteen-design Builder Shell/frame calibration, the 80015 Builder connector fact and its LDCad cross-check, the local-only LDCad shadow-library connector measurement, and the local booklet edge fixture.
- The LDCad Shadow Library is CC BY-SA 4.0, and the owner directed on 2026-08-05 that licence must not block this private, noncommercial work, so its derived connector positions are admitted at `builtin.basic-parts/8`, `/14`, `/15`, `/16`, `/17`, `/19`, `/22`, `/23`, `/24`, `/25`, and `/26`. Three things that decision did not waive are still true and still recorded: attribution travels with the derived data and is rendered into the notices from the catalog, ShareAlike — including the sui generis database-rights clause — would attach to that derived data on redistribution and a public release must license it share-alike or re-derive it independently, and training rights remain unheld. No shadow file is committed; what is admitted is derived positions.
- The pinned local Claude Code binary and intended first-party `claude-opus-5` proposer role are recorded, but no provider call is authorized. Before one exact six-card pilot, Gate 0 still requires an immutable record binding purpose, the exact ordered card/request/transport digests, crop-scoped consent, reviewed provider terms/privacy policy and account privacy state, provider/model identity, a one-launch budget, and success/failure settlement. That record must flow through the request, launch ticket, proof and checkpoint; this pending BOM row, a command-line flag, local OAuth metadata, or a self-consistent proof cannot substitute for it.
- The checker verifies manifest, lockfile, and BOM agreement. It does not make legal conclusions, inspect transitive package license texts, prove file-level provenance, or certify trademark compliance.

Gate 0 therefore remains open. This baseline makes additions fail closed and identifies the work required before a distributable package can satisfy the gate exit.
