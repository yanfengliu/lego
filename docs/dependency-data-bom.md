# Dependency and data bill of materials

Status: Gate 0 baseline, 2026-07-09

This bill of materials records every direct runtime and development dependency declared by the npm workspace, plus the intended provenance and allowed role of starter geometry, connector, collision, weight, and example sources. It is an allowlist, not a finding that every distributable obligation has already been satisfied.

The exact dependency versions and resolved tarballs below come from `package-lock.json`. An npm lockfile license string is upstream-declared metadata, not an independent legal verification. `THIRD_PARTY_NOTICES.md` is generated from the complete locked npm graph, but release redistribution remains blocked until packaged license files, attribution, and evaluation-only exclusions are audited and tested.

Run `node scripts/check-bom.mjs` after changing a workspace or dependency. The check is offline: it compares this inventory with the live package manifests and lockfile and fails on missing, stale, or mismatched records.

## Rights policies

The machine-readable records refer to one of these policies:

- `project-mit`: project-authored source governed by the repository `LICENSE` (MIT). Redistribution is allowed with the copyright and license notice. Preserve “Copyright (c) 2026 Yanfeng Liu” and the MIT text. The material is not designated as a model-training or benchmark corpus merely because its software license permits use.
- `npm-lockfile-spdx-unverified`: the stated license is copied from `package-lock.json` and the installed package manifest. Preserve all upstream copyright, license, and NOTICE material required by the package. The generated `THIRD_PARTY_NOTICES.md` records the locked graph; redistribution still requires verification of packaged license files. The package is approved only for its declared software role, not as model-training or benchmark content.
- `external-evaluation-pending-audit`: the source is not included. No redistribution or training use is approved. It may become evaluation-only only after source-specific license, attribution, privacy, and data-rights review; moving it into runtime, examples, knowledge, or training requires a new reviewed BOM entry.

## Machine-audited inventory

The JSON block is normative for `scripts/check-bom.mjs`. Keep it strict JSON.

<!-- bom-data:start -->
```json
{
  "schemaVersion": 1,
  "rightsPolicies": {
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
    { "manifest": "apps/web/package.json", "section": "dependencies", "name": "@lego-studio/brick-kernel", "spec": "0.0.0" },
    { "manifest": "apps/web/package.json", "section": "dependencies", "name": "@lego-studio/catalog", "spec": "0.0.0" },
    { "manifest": "apps/web/package.json", "section": "dependencies", "name": "@lego-studio/protocol", "spec": "0.0.0" },
    { "manifest": "apps/web/package.json", "section": "dependencies", "name": "@lego-studio/rendering", "spec": "0.0.0" },
    { "manifest": "apps/web/package.json", "section": "dependencies", "name": "react", "spec": "19.2.7" },
    { "manifest": "apps/web/package.json", "section": "dependencies", "name": "react-dom", "spec": "19.2.7" },
    { "manifest": "packages/protocol/package.json", "section": "dependencies", "name": "ajv", "spec": "8.20.0" },
    { "manifest": "packages/protocol/package.json", "section": "dependencies", "name": "@noble/hashes", "spec": "2.2.0" },
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
      "version": "builtin.basic-parts/1",
      "declaredLicense": "MIT",
      "rightsPolicy": "project-mit",
      "allowedRoles": ["runtime", "tests", "distribution"],
      "intent": "Project-authored dimensions and parametric geometry for the initial basic brick and plate catalog; no LDraw mesh files are copied into this layer."
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
      "intent": "Project-authored stud and underside-clutch port transforms and compatibility rules; no LDCad Shadow Library data is included."
    },
    {
      "id": "builtin-analytic-collision-model",
      "category": "collision-data",
      "status": "implemented-project-authored",
      "source": "packages/catalog/src/",
      "version": "builtin.collision/1",
      "declaredLicense": "MIT",
      "rightsPolicy": "project-mit",
      "allowedRoles": ["runtime", "tests", "distribution"],
      "intent": "Project-authored bounded analytic collision bodies and connector allowances derived from the starter catalog definitions."
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
      "intent": "Disposable Three.js meshes generated from canonical project-authored catalog dimensions; never an authoring source of truth."
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
      "id": "ldcad-shadow-library-connectors",
      "category": "external-connector-data",
      "status": "not-included-pending-audit",
      "source": "https://github.com/RolandMelkert/LDCadShadowLibrary",
      "version": "unselected",
      "declaredLicense": "UNVERIFIED-SHARE-ALIKE-TERMS",
      "rightsPolicy": "external-evaluation-pending-audit",
      "allowedRoles": ["evaluation-only-after-audit"],
      "intent": "Potential connector research layer that must remain separately attributable and cannot silently seed the builtin connector taxonomy."
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
- No LDraw geometry, LDCad Shadow Library connector data, research-model code/data/weights, or internet-curated model is approved for runtime, packaging, knowledge, benchmarks, or training.
- The checker verifies manifest, lockfile, and BOM agreement. It does not make legal conclusions, inspect transitive package license texts, prove file-level provenance, or certify trademark compliance.

Gate 0 therefore remains open. This baseline makes additions fail closed and identifies the work required before a distributable package can satisfy the gate exit.
