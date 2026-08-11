# lego

A digital brick modeling studio with two surfaces: an offline manual editor for connection- and collision-validated brick assemblies, and an experimental closed loop that reads a printed LEGO instruction booklet, assembles its set, and checks each step against the booklet's own panel.

## Current state

### Web studio

The runnable React and Three.js studio supports local projects with integrity-checked IndexedDB persistence, a searchable part catalog, snapped placement and attachment, precise transform and color editing, deletion, undo and redo, live structural validation, manual build playback, and the app's bounded LDraw import and export profile.

The studio's **Instructions** control currently reads, bounds, and fingerprints a PDF only. Turning those pages into build steps and applying a booklet run is not yet a user-facing workflow.

### Experimental booklet tooling

The repository contains internal Node, Python, Vitest, and Playwright tooling for booklet parsing, panel measurement, placement search, visual scoring, retained evidence, and the set 6651557 reconstruction. This tooling is an opt-in development harness, not a production service or an automatic path into a user's document.

The exact measured frontier and ordered work still missing live in [building-system.md](docs/design/building-system.md). See the [real-booklet runbook](docs/runbooks/real-build.md) to reproduce or regenerate retained runs without copying status into another document.

### Specified but unbuilt

`apps/companion` currently exports a library-level content-addressed artifact store, an unsealed test-namespace ledger, and a consent-gated test recorder. It has no HTTP server, production signing identity, credential proxy, authoritative production namespace, or runnable start command.

The production companion broker, unprivileged model worker, sealed replay lifecycle, and authoritative event surfaces remain specified rather than implemented. The text-brief AI copilot and its candidate lab were cut on 2026-08-07 and are not a deferred product; the [specification's removed-product section](docs/design/spec.md#removed-product-surface) records which shared contracts remain and why.

## Requirements and setup

- Node.js 24 or newer and npm 11 or newer.
- Python 3 available as `python` for the full verification suite.
- Chromium installed for Playwright browser tests.

From the repository root:

```powershell
npm ci
npx.cmd playwright install chromium
```

## Run the studio

```powershell
npm run dev
```

Open `http://127.0.0.1:5173`.

Choose a part and color in the catalog, then click in the viewport to place it; selecting an existing part lets **Add** attach to a free top stud. Use **Move**, **Rotate**, or the inspector for later edits. Each explicit viewport placement becomes a playback step, available from **Build**.

Projects save locally in the browser. **Import** accepts the supported `.ldr` and `.mpd` subset, **Export LDraw** downloads the current document, and **Instructions** performs PDF ingestion only as described above.

## Checks

Run the repository's implemented verification gate with:

```powershell
npm run verify
```

`verify` checks schemas, Node consumers, observation consumers, provenance and notices, lessons, formatting, lint, types, Python derivation contracts, Vitest, Playwright, and the production browser bundle. The standalone `npm run parts:check` catalog-standard diagnostic is not included in `verify`.

The declared runtime contract is Node 24.x, not one exact minor. A current real-build replay-environment fixture embeds Node 24.18.1 and can make `verify` fail on another Node 24 minor; that is a known fixture mismatch, not an additional setup requirement.

Dependency changes additionally require both audits:

```powershell
npm run audit
npm run audit:runtime
```

The authoritative command definitions are in [package.json](package.json).

## Design and policy

- [Product and architecture specification](docs/design/spec.md)
- [Part model](docs/design/part-model.md)
- [Building-system assessment and current measured position](docs/design/building-system.md)
- [Booklet-run evidence, replay, and promotion](docs/design/learning-system.md)
- [Current implementation threat model](docs/design/threat-model.md)
- [Real-booklet developer runbook](docs/runbooks/real-build.md)
- [Repository-local policy](docs/policies/local-rules.md)
- [Lessons index and evidence](docs/learning/lessons.md)
- [Historical devlog](docs/devlog/summary.md)
- [Dependency and data bill of materials](docs/dependency-data-bom.md)
- [Generated bundled-geometry notices](docs/bundled-geometry-notices.md)

The app owns brick-specific semantics. The sibling `3d-maker` repository remains a separate procedural-asset evolution studio; generic experiment, lineage, and evaluation interfaces may be shared only after both implementations prove the same need.
