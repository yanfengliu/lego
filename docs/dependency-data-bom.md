# Dependency and data bill of materials

Status: Gate 0 baseline, 2026-07-10

This bill of materials records every direct runtime and development dependency declared by the npm workspace, plus the intended provenance and allowed role of starter geometry, connector, collision, weight, and example sources. It is an allowlist, not a finding that every distributable obligation has already been satisfied.

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
    { "manifest": "apps/harness/package.json", "name": "@lego-studio/harness", "version": "0.0.0" },
    { "manifest": "apps/web/package.json", "name": "@lego-studio/web", "version": "0.0.0" },
    { "manifest": "packages/brick-kernel/package.json", "name": "@lego-studio/brick-kernel", "version": "0.0.0" },
    { "manifest": "packages/catalog/package.json", "name": "@lego-studio/catalog", "version": "0.0.0" },
    { "manifest": "packages/generation/package.json", "name": "@lego-studio/generation", "version": "0.0.0" },
    { "manifest": "packages/protocol/package.json", "name": "@lego-studio/protocol", "version": "0.0.0" },
    { "manifest": "packages/rendering/package.json", "name": "@lego-studio/rendering", "version": "0.0.0" }
  ],
  "declarations": [
    { "manifest": "apps/companion/package.json", "section": "dependencies", "name": "@lego-studio/protocol", "spec": "0.0.0" },
    { "manifest": "apps/companion/package.json", "section": "devDependencies", "name": "@lego-studio/brick-kernel", "spec": "0.0.0" },
    { "manifest": "apps/companion/package.json", "section": "devDependencies", "name": "@lego-studio/catalog", "spec": "0.0.0" },
    { "manifest": "apps/companion/package.json", "section": "devDependencies", "name": "@lego-studio/generation", "spec": "0.0.0" },
    { "manifest": "apps/companion/package.json", "section": "devDependencies", "name": "@lego-studio/harness", "spec": "0.0.0" },
    { "manifest": "apps/harness/package.json", "section": "dependencies", "name": "@lego-studio/brick-kernel", "spec": "0.0.0" },
    { "manifest": "apps/harness/package.json", "section": "dependencies", "name": "@lego-studio/catalog", "spec": "0.0.0" },
    { "manifest": "apps/harness/package.json", "section": "dependencies", "name": "@lego-studio/generation", "spec": "0.0.0" },
    { "manifest": "apps/harness/package.json", "section": "dependencies", "name": "@lego-studio/protocol", "spec": "0.0.0" },
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
    { "manifest": "apps/web/package.json", "section": "dependencies", "name": "@lego-studio/generation", "spec": "0.0.0" },
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
    { "manifest": "packages/generation/package.json", "section": "dependencies", "name": "@lego-studio/brick-kernel", "spec": "0.0.0" },
    { "manifest": "packages/generation/package.json", "section": "dependencies", "name": "@lego-studio/catalog", "spec": "0.0.0" },
    { "manifest": "packages/generation/package.json", "section": "dependencies", "name": "@lego-studio/protocol", "spec": "0.0.0" },
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
      "name": "@lego-studio/generation",
      "version": "0.0.0",
      "kind": "workspace",
      "resolvedSource": "workspace:packages/generation",
      "upstreamSource": "this repository",
      "declaredLicense": "MIT",
      "rightsPolicy": "project-mit",
      "allowedRoles": ["runtime deterministic local candidate population, constrained recipes, ranking, and lineage evidence"]
    },
    {
      "name": "@lego-studio/harness",
      "version": "0.0.0",
      "kind": "workspace",
      "resolvedSource": "workspace:apps/harness",
      "upstreamSource": "this repository",
      "declaredLicense": "MIT",
      "rightsPolicy": "project-mit",
      "allowedRoles": ["runtime unprivileged deterministic maker capture and downstream replay, plus development companion integration testing"]
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
      "version": "builtin.basic-parts/6",
      "declaredLicense": "MIT",
      "rightsPolicy": "project-mit",
      "allowedRoles": ["runtime", "tests", "distribution"],
      "intent": "Project-authored dimensions and parametric box, wedge, compound-box, and analytic-plan geometry for the 77-part builtin catalog; no LDraw mesh files are copied into this layer."
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
      "intent": "Project-authored stud and underside-clutch port transforms and compatibility rules. The only external fact currently retained is 80015 revision E's two source-verified partial-overhang underside grips, separately pinned below to LEGO Builder and independently cross-checked against LDCad; no source bundle or shadow file is included."
    },
    {
      "id": "builtin-analytic-collision-model",
      "category": "collision-data",
      "status": "implemented-project-authored",
      "source": "packages/catalog/src/",
      "version": "rectilinear-stud-clearance/2",
      "declaredLicense": "MIT",
      "rightsPolicy": "project-mit",
      "allowedRoles": ["runtime", "tests", "distribution"],
      "intent": "Project-authored bounded analytic collision bodies, including conservative disjoint convex-prism decompositions of circular plan features, and connector allowances derived from the catalog definitions."
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
      "intent": "Disposable Three.js meshes generated from canonical project-authored catalog dimensions and exact source features rather than collision approximations; never an authoring source of truth."
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
      "intent": "scripts/ldraw-part-facts.mjs reads official part files by hand to measure a part's stud positions, body extents, and local frame, which are then hand-authored into catalog blueprints as numbers. No LDraw file, geometry, or mesh is copied into the repository or shipped, and nothing fetches at runtime or during a gate. Attribution and the applicable CC BY version are retained from each file header."
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
      "intent": "The immutable ledger, which is not exported from the public catalog entry point, binds the exact 54 covered and 118 missing top-level designs, the 121 required leaf designs, the 107-record precursor pack, four separately checksum-verified composite components, ten checksum-mismatch quarantines, and the coverage-only 76382 decomposition. It retains hashes, identifiers, counts, source URLs, and bounded measurements only: no Builder bundle, mesh, primitive payload, LXFML model, LDraw geometry, booklet page, absolute local path, or base64 source bytes are committed or fetched by runtime or gates. Source-integrity verification does not publish a PartDefinition or claim catalog, structural, visual, or physical validity."
    },
    {
      "id": "set-6651557-six-part-source-pilot",
      "category": "external-render-geometry-and-primitive-frame-evidence",
      "status": "local-authoring-only-private-source-authorized-not-bundled-not-admitted",
      "source": "Six exact roots and their audited closures in the local pinned official/unofficial LDraw archives, plus five checksum-valid records from the local 107-record LEGO Builder native pack; 30357 remains explicitly unavailable from that pack because its Builder bundle failed the recorded integrity pin",
      "version": "lego.set-6651557-source-pilot/1; source audit sha256 cacee99596d0067223977a4cdf967e1aed6cbf072dec1aac8862e486a140cb42; official archive sha256 6009f2e94204c4d3a63a4c812010b5c90bad8c5acb19b882c859fdac63734eae; unofficial archive sha256 09ec08007203b66e79b1f857aa4804cbee26e1337e177a7c3a87adc1268e44d4; Builder native pack sha256 e5bb745faa79c5e7cb525eb0a11a8443815a0c4805c85644204b26c462ac636d; decoded binary sha256 76830eb4832492e5416ad6920ab4f8167b6cf55725641cce162ac8f9f215b6c7; retained report sha256 368753adec40d517c5063cbe23f28b9ff21108f0f8824bb0671b8c2575794613",
      "declaredLicense": "LDRAW-SIX-CLOSURES-CC-BY-4.0; USER-AUTHORIZED-PRIVATE-NONCOMMERCIAL-BUILDER-REFERENCE",
      "rightsPolicy": "private-noncommercial-source-reference",
      "allowedRoles": ["local source-surface measurement", "local primitive-frame pressure measurement", "private reconstruction strategy benchmark", "synthetic committed tests"],
      "intent": "scripts/generate-set-6651557-source-pilot.py captures each exact pinned archive once into an immutable bounded snapshot, binds every opened file in the six closures' 70-file union to its corresponding row and reference set in the complete exact 439-record source audit, reads the exact native pack through one held descriptor, rejects duplicate/non-finite or over-budget JSON, independently rehashes each reviewed metadata-and-binary slice, validates rigid primitive frames, and publishes only an ignored canonical measurement report through a prevalidated Windows directory handle. scripts/ldraw_surface_expander.py preserves exact type-1 composition including internal filename spaces, BFC winding and INVERTNEXT semantics, determinant reversal, bounded closure expansion, inherited visible-stud ancestry, and the official quad validity tolerances. No LDraw text, expanded geometry, Builder payload, base64, absolute source path, or mesh is committed or packaged. The report is explicitly measurement-only: it emits no PartDefinition, claims no frame/connector/collision truth, performs no runtime fetch, and cannot admit or self-certify a catalog part."
    },
    {
      "id": "unitypy-builder-shell-extractor",
      "category": "external-authoring-software-dependency",
      "status": "local-authoring-only-pinned-not-bundled",
      "source": "https://pypi.org/project/UnityPy/1.25.3/; upstream https://github.com/K0lb3/UnityPy; transitive source-artifact provenance remains pending audit",
      "version": "Pinned import environment contract sha256 c4cc3cf7e9e066258688bc9fcace54e0b5c32d39f01956f07d1aff9c25dba80b: UnityPy 1.25.3, archspec 0.2.6, astc-encoder-py 0.1.12, attrs 26.1.0, brotli 1.2.0, etcpak 0.9.15, fmod_toolkit 0.1.3, fsspec 2026.7.0, lz4 4.4.5, pillow 12.3.0, pyfmodex 0.7.2, texture2ddecoder 1.0.6, and tpk_ar 0.2.4; exact per-distribution RECORD digests, wheel tags, and admitted top-level imports are hard-coded in scripts/builder-import-snapshot.py; CPython 3.13 Windows x86-64 UnityPy wheel unitypy-1.25.3-cp313-cp313-win_amd64.whl sha256 255b7284e2f61161ceb0b361f742ac516236e0785fdb11c7d6911e691f1c0782; UnityPy installed RECORD sha256 2c0725359f1bee3e737b2acf4e7bcc37724645db94c3219945aabb45ca0da379",
      "declaredLicense": "UnityPy MIT; transitive distribution license metadata and texts pending independent audit",
      "rightsPolicy": "pypi-artifact-spdx-unverified",
      "allowedRoles": ["local authoring-only decoding of the two checksum-pinned Builder Shell meshes", "local authoring-only quarantine-report discovery of the one checksum-pinned 3245 revision M Builder bundle"],
      "intent": "Three executors share this pinned environment: scripts/extract-builder-shell.py, scripts/generate-builder-calibration.py, and scripts/discover-builder-shell.py with its discover_builder_shell_core.py, discover_builder_shell_metadata.py, discover_builder_shell_publication.py and discover_builder_shell_worker.py siblings. The third emits a bounded quarantine report for design 3245 revision M only and holds no admission authority: it cannot write SUPPORTED_SHELLS, emit a PartDefinition, or mark the design supported. The pinned environment is the one real barrier to decoding an untrusted Builder bundle here, and the refusal is executable rather than documentary: CORE.assert_pinned_environment_for_retained_bundle refuses to hand the exact retained 3245-M bytes to any loader unless the active import root is the exact 13-distribution set with matching RECORD digests. The CPython 3.13 interpreter check is necessary but is not that barrier - conforming 64-bit CPython 3.13 interpreters exist on the development machine and satisfy it - so installing UnityPy into an ordinary interpreter's site-packages does not unblock a real decode. scripts/extract-builder-shell.py and its focused scripts/builder-import-snapshot.py helper validate the hard-coded 13-distribution environment contract and exact dist-info set, then same-handle capture every non-bytecode RECORD-pinned payload before writing a fresh private temporary snapshot. A child CPython process launched with -I -S -B revalidates that snapshot, disables bytecode writes, limits sys.path to the snapshot and trusted base-runtime paths, constrains PATH, and imports UnityPy only from the snapshot; the mutable original target is never placed on the worker import path, stray top-level modules and timestamp-valid pyc files are not copied, and the snapshot is deleted only after the worker exits. The controller bounds and independently validates the worker report's strict JSON schema, identities, counts, finite coordinates, index ranges, and canonical mesh digest before publishing it, then admits only the hard-coded 30565 revision E and 80015 revision E bundle/path/count tuples. UnityPy and the pinned authoring environment are not committed, bundled, fetched by runtime or gates, used as catalog authority, or approved for training. Transitive source-artifact provenance and license/text review remain a Gate 0 gap."
    },
    {
      "id": "lego-builder-step1-shell-frame-calibration",
      "category": "external-render-geometry-and-frame-evidence",
      "status": "local-authoring-only-private-source-authorized-not-bundled",
      "source": "Local checksum-pinned LEGO Builder Shell meshes for 30565 revision E and 80015 revision E, the retained 21066 LXFML model, and local checksum-pinned official/unofficial LDraw archives used only as an independent surface comparison",
      "version": "lego.builder-canonical-calibration/6; model sha256 c0564fd86ede633f6cb18738f999fbb70ee948ba93a55cc8d338b4b5f02b5922; 30565 bundle sha256 955ce425a8ddf4b12d320260d627df3f3fb46c52fedaf70f1d562b0e1efa7c93 and Shell canonical sha256 8b41bc4bed4f2e9ee8ddd49b6ed74b52035c1b4f86507d838db56bb55deec8b2; 80015 bundle sha256 f3a11d40f9de9fa54670bdd87db0a87e034896d87b56e64e9f382c3ef0098c75 and Shell canonical sha256 946c5c5782c36a44883200cc57e150c43bef2f4b8e8444257cfcb49952327723; official LDraw archive sha256 6009f2e94204c4d3a63a4c812010b5c90bad8c5acb19b882c859fdac63734eae; unofficial LDraw archive sha256 09ec08007203b66e79b1f857aa4804cbee26e1337e177a7c3a87adc1268e44d4; exact 57-file official LDraw closure manifest sha256 588e47260fc03cdc0fc2fea3bf8a0c5eef62818b0b41dd028aea859031af3fa6; local geometry bundle 122688 bytes sha256 4c03dc3f534e7eab78da7e9c61bf3a539de064a01aa829b18023ac86340f8450; local calibration report sha256 78bcdc88850a40e5763e251ec90f2815a6926c8aa3b59a9988de561488e0fdb1",
      "declaredLicense": "USER-AUTHORIZED-PRIVATE-NONCOMMERCIAL-REFERENCE; LDRAW-PER-FILE-CC-BY-2.0-OR-CC-BY-4.0",
      "rightsPolicy": "private-noncommercial-source-reference",
      "allowedRoles": ["local render-surface comparison", "private reconstruction frame calibration", "tests with synthetic committed fixtures"],
      "intent": "scripts/extract-builder-shell.py parses the exact captured bytes of one hard-coded checksum-pinned Builder bundle and emits a local Shell inspection; scripts/generate-builder-calibration.py parses the exact already-hashed local archive bytes under fixed ZIP expansion bounds and produces ignored local geometry/calibration outputs. Before geometry expansion, every traversed 30565/80015 LDraw member must match the embedded metadata-only closure's normalized path, SHA-256, Author, !LICENSE, and !LDRAW_ORG values; all 57 are official-library CC BY 4.0 files and the unofficial archive may not contribute. The evidence compares two named Builder Shells with independently pinned LDraw surfaces and the already-reviewed catalog digests for those same designs. No Builder bundle, Shell report, LDraw source text, expanded LDraw geometry, generated geometry bundle, calibration report, or source path is committed, packaged, fetched at runtime, uploaded, or approved for training. This evidence does not admit a PartDefinition and cannot author or independently certify connector truth (C), collision truth (X), or canonical frame truth (F); it is a reproducible local review input only, and changing a digest or limit is not source authorization."
    },
    {
      "id": "lego-builder-3245-M-quarantined-bundle",
      "category": "external-render-geometry-and-primitive-frame-evidence",
      "status": "local-authoring-only-private-source-authorized-not-bundled-not-admitted",
      "source": "https://api.prod.dbix.i.lego.com/api/v1/Bricks/3245?Revision=M&Platform=Android, retained locally and only locally at the ignored path output/real-build/sources/3245-M-android.bundle with its sibling capture record 3245-M-android.capture.json",
      "version": "3245 revision M, Android platform; bundle 85098 bytes sha256 1aa4e8333df9914191a4d941a7ce0f95460311eabd8f159f9e4a9b1e5c1c9534, md5/ETag bdce3745e99adf9c3bfb0708161c6875, object version fLSSBMSQEk2QBK4jCeJIpJ0WIlOaCfpF, upstream last-modified 2026-02-17T12:37:35Z, retrieved 2026-08-03T21:22:17Z; capture schema lego.builder-live-source-capture/1",
      "declaredLicense": "USER-AUTHORIZED-PRIVATE-NONCOMMERCIAL-REFERENCE",
      "rightsPolicy": "private-noncommercial-source-reference",
      "allowedRoles": ["local quarantine-report source evidence", "private reconstruction authoring"],
      "intent": "One exact untrusted third-party LEGO Builder bundle, retained because 3245 is one of the four required designs with no selected exact LDraw source route and an alias manufactured to fill that gap would be worse than the gap. It is hostile input: only scripts/discover-builder-shell.py may read it, only inside the pinned RECORD-verified UnityPy snapshot recorded by unitypy-builder-shell-extractor, and only to emit a bounded quarantine report of bundle identity, one Shell tuple and canonical digest, bounded primitive connector centres, and bounded part identity. Explicitly not approved: catalog admission, PartDefinition emission, SUPPORTED_SHELLS membership, frame/connector/collision truth, redistribution, packaging, runtime or gate fetching, upload, benchmark inclusion, and model training. The bundle bytes are never committed - the whole output/ root is gitignored - and the private-noncommercial authorization for local reconstruction does not relicense LEGO's material or waive this record.",
      "trainingUse": "Not designated as a model-training or benchmark corpus; the owner's private-noncommercial reading authorization is not training permission."
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
      "status": "read-at-authoring-time-one-fact-pinned",
      "source": "https://github.com/RolandMelkert/LDCadShadowLibrary",
      "version": "commit 15aa1e718b6a8da37d24fc7af5e52e262c041bfb; parts/80015.dat sha256 c4dbcc5c5e2969e2b6e5c394519606a66b8483437503b8f4886cdf9262cd7170; parts/s/80015s01.dat sha256 fa4324fccee90f9903c68c65a75bb4e747a76d429a94d648c10b9e24ceb4d879",
      "declaredLicense": "CC-BY-SA-4.0",
      "rightsPolicy": "private-noncommercial-source-reference",
      "allowedRoles": ["authoring-time connector fact cross-check", "tests", "private reconstruction"],
      "intent": "The exact 80015 shadow part and subpart independently confirm the same seven underside centres reported by LEGO Builder. Only the two numeric partial-overhang offsets, source identity, and hashes are retained; no LDCad shadow file is bundled or fetched by runtime or gates."
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
- The starter catalog, connector taxonomy, collision model, and derived Three.js geometry are implemented with versioned project-authored provenance; individual geometry recipes carry SHA-256 content hashes and the truth snapshot pins their aggregate interpretation inputs. Synthetic benchmark examples remain an intent record.
- No raw LDraw geometry, LEGO Builder bundle or XML, LDCad Shadow Library file, research-model code/data/weights, internet-curated model, or booklet page is approved for packaging or training. Minimal source-pinned measurements and metadata for the private reconstruction are allowed where this BOM names their exact role; currently that includes official LDraw dimensions, the metadata-only 6651557 LDraw source-resolution audit and 21066 source-coverage ledger, the local-only six-part LDraw/Builder source pilot and two-design Builder Shell/frame comparison, the 80015 Builder connector fact and its LDCad cross-check, and the local booklet edge fixture.
- The checker verifies manifest, lockfile, and BOM agreement. It does not make legal conclusions, inspect transitive package license texts, prove file-level provenance, or certify trademark compliance.

Gate 0 therefore remains open. This baseline makes additions fail closed and identifies the work required before a distributable package can satisfy the gate exit.
