# lego

A digital brick modeling studio with two surfaces: a precise manual editor for digitally connection- and collision-validated brick assemblies, and a closed loop that reads a printed LEGO instruction booklet and assembles the set it describes, verifying each step against the booklet's own printed panel.

Status: the repository contains a runnable browser studio with integrity-checked local project persistence, strict wire schemas, truth-bound immutable template admission, a project-authored catalog, deterministic assembly kernel, disposable Three.js renderer, exact canonical render-packet validation, a bounded LDraw profile, the booklet reader and printed-panel scoring loop, and the companion package's local content-addressed artifact store plus an unsealed, test-namespace native run ledger and retained run bundle recorder. The authoritative production companion broker surfaces are not implemented. The AI copilot that earlier drafts of the specification described — generating a model from a text brief and accepting scoped patches — was cut on 2026-08-07; see the [cut section](docs/design/spec.md#cut-the-ai-copilot) for what survives it in code and why.

## Run it

```powershell
npm install
npm run dev
```

Open `http://127.0.0.1:5173`. The current studio supports explicit part placement and attachment, precise transforms, recoloring, deletion, undo/redo, live graph/port/collision validation, canonical 3D views, and strict LDraw import/export.

Run the complete implemented gate set with:

```powershell
npm run verify
```

`verify` also exercises the shared packages under the supported Node 24 TypeScript-stripping runtime and proves that development automation globals are absent from the production browser bundle.

## Design

- [Product and architecture specification](docs/design/spec.md)
- [Part model](docs/design/part-model.md)
- [Building system: assessment, measured position, and plan](docs/design/building-system.md)
- [Current implementation threat model](docs/design/threat-model.md)
- [Booklet-run evidence, evaluation, and promotion](docs/design/learning-system.md)

## First vertical slice

The first useful slice is deliberately small: a curated basic-part catalog, a precise manual editor, deterministic connection and collision validation, canonical multi-view renders, booklet reading with printed-panel verification, LDraw interchange, and replayable run artifacts.

Implemented today: 85 parts in thirteen families — 77 parametric and eight declared from measured source — bricks, plates, tiles, jumper and grille tiles, wedge plates, Technic bricks, axles and wheels, plus arches, curved slopes, cheese slopes and corner plates whose solids are measured from official LDraw files and expressed as boxes, cut prisms, or analytic circular plan features with conservative convex collision decomposition — strict JSON Schema/Ajv protocol validators, canonical hashing, invertible build operations, scoped restricted-program compilation, truth-bound fixed-graph template admission, hard validators, a deterministic restricted-text population with immutable lineage, structural deduplication, retained-byte admission and hash-pinned hard-valid ranking, an authority-free captured maker-output schema, canonical in-memory test captures, generator-free downstream replay of compilation/validation/deduplication/metrics/ranking, independent patch reapplication, worker-isolated browser candidate comparison with stale-result suppression and exact preview evidence, replay-checked IndexedDB editor history, renderer lifecycle and camera packets, deterministic seven-view beauty-pass `RenderPacket` assembly with exact camera-policy checks, development-only automation hooks, a bounded verify-on-read content-addressed artifact store, a policy- and limit-pinned test ledger with hash-linked events and recovery checks, atomic prefix-checked terminal anchoring, and a consent-gated test recorder that retains the exact request and authority-free maker output in an unsealed CAS-backed bundle, plus provenance/BOM checks, third-party notices, and the metadata-bearing LDraw subset emitted by this app. Unsealed captures, bundles, LDraw metadata, and test-ledger events grant no production authority or replay-level claim. Complete replay-closure certification, capture-to-CAS render receipts, arbitrary ecosystem LDraw files, physical-stability claims, broker-authorized candidate acceptance, sealed native run manifests, and authoritative production broker events or seals remain outside the current executable slice.

The booklet loop is the other half of what is implemented, and its measured position — how many printed steps read, how many pieces placed, what each refusal was named and what number it refused on — is kept in [building-system.md](docs/design/building-system.md) rather than here, because a status line in a README goes stale silently.

The set 6651557 reconstruction also has a local, measurement-only six-part source pilot. It compares six exact LDraw closures (70 unique files), checked file-by-file against the complete exact 439-record source audit, with independently rehashed LEGO Builder record slices and records where fractional bounds, non-upright connectivity, missing source integrity and oriented collision exceed the current catalog contract. It snapshots each pinned archive before parsing, bundles no source geometry and admits no runtime part. The scored two-strategy comparison it gated is done, and the first contract it forced has landed: body extents may now be declared exactly, as signed integer units at a fixed 10^-9 scale, bounded on both scale and magnitude and refused if their float64 projection would shrink the solid. The Builder-to-LDraw frame that female connectors depend on is derived and pinned per part, exactly for four of the five available records and by a labelled bounded fit for the fifth, and it emits 16 measured clutch cells that the LDraw-only rule cannot produce at all.

Five of those six parts were admitted at catalog version `builtin.basic-parts/7`: 5092, 35480, 51739, 77844 and 93273. Their render mesh is real LDraw geometry, bundled under CC BY 4.0 with per-file authorship preserved in [docs/bundled-geometry-notices.md](docs/bundled-geometry-notices.md) — reuse is not training, and that right stays unheld. Their collision is the per-column height field of that same expanded surface, their connectors are Builder's authored field through the pinned frame, and their extents are the exact LDraw closure.

`builtin.basic-parts/8` adds the three designs LEGO Builder has no record of at all — 30357, 2450 and 79491 — whose underside clutch cells come from the CC BY-SA 4.0 LDCad shadow library instead, because a female connector is not recoverable from LDraw geometry and without one each of these is a part that can be built on and never placed on anything. That was costing the real booklet build: it stopped at step 16, whose only missing design was one of the three, and admitting them takes the covered prefix from 15 steps to 25. Attribution travels with the derived data, share-alike would attach to it on redistribution, and training rights stay unheld; `docs/dependency-data-bom.md` records all three. Four further LDCad-covered designs were scored and refused with their measured reasons. The 77 parts already in the catalog keep their geometry content hashes exactly; `/6` and `/7` become historical migration snapshots, and `scripts/emit-measured-part-tables.py` reproduces every generated table from the pinned archives.

The app owns brick-specific semantics. The sibling `3d-maker` repository remains a separate procedural-asset evolution studio; the two projects may later share experiment, lineage, and visual-evaluation protocols after real duplicate implementations exist.
