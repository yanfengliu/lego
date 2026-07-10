# lego

An AI-native digital brick modeling studio for manually building, generating, repairing, and evolving digitally connection- and collision-validated brick assemblies.

Status: Gate 0/1 implementation is underway and the first Gate 2 harness foundations are landing. The repository now contains a runnable browser studio with integrity-checked local project persistence, strict wire schemas, truth-bound immutable template admission, a project-authored starter catalog, deterministic assembly kernel, a bounded four-candidate maker population and parallel-worker verifier lab, an unprivileged captured-output replay harness, disposable Three.js renderer, exact canonical render-packet validation, a bounded LDraw profile, and the companion package's local content-addressed artifact store plus an unsealed, test-namespace native run ledger and retained maker-run bundle recorder. Provider-backed AI, the authoritative production companion broker surfaces, and the recursive engineering runner are not implemented yet.

## Run it

```powershell
npm install
npm run dev
```

Open `http://127.0.0.1:5173`. The current studio supports explicit part placement and attachment, precise transforms, recoloring, deletion, undo/redo, live graph/port/collision validation, canonical 3D views, and strict LDraw import/export.

The Candidate population panel is a deterministic local lab. It binds a bounded text-only full-empty `BuildBrief` and `ScopeCapability` to the exact current `BrickDocument`, runs the four-attempt maker and a separate same-build digest verifier in parallel module workers, shows ranked hard-valid candidates plus non-selectable duplicate or failure evidence, and previews only the exact selected candidate. It makes no provider or network call and never mutates the saved document. Acceptance remains disabled until the companion broker can issue and verify the required one-use authorization.

Run the complete implemented gate set with:

```powershell
npm run verify
```

`verify` also exercises the shared packages under the supported Node 24 TypeScript-stripping runtime and proves that development automation globals are absent from the production browser bundle.

## Design

- [Product and architecture specification](docs/design/spec.md)
- [Current implementation threat model](docs/design/threat-model.md)
- [Learning harness and improvement loops](docs/design/learning-system.md)
- [Brick assembly loop skill procedure](docs/skills/brick-assembly-loop.md)

## First vertical slice

The first useful slice is deliberately small: a curated basic-part catalog, a precise manual editor, deterministic connection and collision validation, text-to-model candidate generation, canonical multi-view renders, previewable AI patches, LDraw interchange, and replayable run artifacts.

Implemented today: 14 parametric bricks and plates, strict JSON Schema/Ajv protocol validators, canonical hashing, invertible build operations, scoped restricted-program compilation, truth-bound fixed-graph template admission, hard validators, a deterministic restricted-text population with immutable lineage, structural deduplication, retained-byte admission and hash-pinned hard-valid ranking, an authority-free captured maker-output schema, canonical in-memory test captures, generator-free downstream replay of compilation/validation/deduplication/metrics/ranking, independent patch reapplication, worker-isolated browser candidate comparison with stale-result suppression and exact preview evidence, replay-checked IndexedDB editor history, renderer lifecycle and camera packets, deterministic seven-view beauty-pass `RenderPacket` assembly with exact camera-policy checks, development-only automation hooks, a bounded verify-on-read content-addressed artifact store, a policy- and limit-pinned test ledger with hash-linked events and recovery checks, atomic prefix-checked terminal anchoring, and a consent-gated test recorder that retains the exact request and authority-free maker output in an unsealed CAS-backed bundle, plus provenance/BOM checks, third-party notices, and the metadata-bearing LDraw subset emitted by this app. Unsealed captures, bundles, LDraw metadata, and test-ledger events grant no production authority or replay-level claim. Complete replay-closure certification, capture-to-CAS render receipts, arbitrary ecosystem LDraw files, physical-stability claims, broker-authorized candidate acceptance, model providers, sealed native run manifests, authoritative production broker events or seals, and self-improvement passes remain outside the current executable slice.

The app owns brick-specific semantics. The sibling `3d-maker` repository remains a separate procedural-asset evolution studio; the two projects may later share experiment, lineage, and visual-evaluation protocols after real duplicate implementations exist.
