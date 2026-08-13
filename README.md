# lego

A digital brick modeling studio with two surfaces: an offline manual editor for connection- and collision-validated brick assemblies, and an experimental closed loop that reads a printed LEGO instruction booklet, assembles its set, and checks each step against the booklet's own panel.

## Current state

### Web studio

The runnable React and Three.js studio supports local projects with integrity-checked IndexedDB persistence, a searchable part catalog, snapped placement and attachment, precise transform and color editing, deletion, undo and redo, live structural validation, manual build playback, and the app's bounded LDraw import and export profile.

The studio's **Instructions** control currently ingests a PDF locally into bounded page and text metadata plus a content hash. It does not render booklet panels, compile build steps, or apply a booklet run to the document.

### Experimental booklet tooling

The repository contains internal Node, Python, Vitest, and Playwright tooling for booklet parsing, panel measurement, placement search, visual scoring, retained evidence, and the set 6651557 reconstruction. This tooling is an opt-in development harness, not a production service or an automatic path into a user's document.

An authority-free source-stage tracer can retain exact H/P/D masks, while a separate source-parity `/4` diagnostic retains production, W, and XOR comparisons for five mask classes across the dense 359-step prepared panel sequence under a bound PDF, source/runtime closure, browser result, and prepared-panel manifest. Its browser work-RGBA, policy, and derivation commitments remain explicitly opaque, its source-RGBA column is visualization-only, and the full 359-step probe has not been run for the current implementation unit.

The fixed five-panel calibration path can capture steps/pages 90/79, 101/87, 346/213, 358/218, and 359/219 as exact high/work RGBA, H/P/D stages, independently re-derived W, pairwise P/D/W facts, and ten lossless PNGs, then replay those bytes in Node. A separate publication wrapper cross-binds that exact browser capture to the PDF, full 359-row prepared-panel manifest, source snapshot, provenance, served source, checkout, and runtime closure; derives an audit-only execution identity internally; writes five roles, ten PNGs, and the supporting manifests into its content-addressed run tree; and atomically replaces the discoverable summary only after every referenced byte has been written. The real-booklet exact-five opt-in has now retained those rows under execution identity `sha256:979157ed12ef36fcd59a85aba13268d56a47d77ee886070cd31221805d756462`, but the publication remains `pending-unreviewed` and authority-free, the review foundation still returns `needs-adjudication` for every outcome, and the human-owned issuer, admission capability, dense 359-step probe, browser-output `/4`, and document authority remain absent.

The exact measured frontier and ordered work still missing live in [building-system.md](docs/design/building-system.md). See the [real-booklet runbook](docs/runbooks/real-build.md) to reproduce or regenerate the real-build inputs and runs without copying status into another document; it also names the separate panel-reading probe's present reproducibility limits.

Catalog render changes use the separate [part visual-admission runbook](docs/runbooks/part-visual-admission.md), which captures matched source-versus-catalog views and publishes an immutable explicit review without confusing the editor's presentation captures with admission evidence.

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

Choose a part and color in the catalog, then click in the viewport to place it; on an empty model, **Place at origin** provides the deterministic first placement. Select an existing part and use **Attach to selection** to add the chosen part on a free top stud. Use **Move**, **Rotate**, or the inspector for later edits. Each explicit placement becomes a playback step, available from **Build**.

Projects save locally in the browser. **Import** accepts the supported `.ldr` and `.mpd` subset, **Export LDraw** downloads the current document, and **Instructions** performs PDF ingestion only as described above.

## Checks

Run the repository's implemented verification gate with:

```powershell
npm run verify
```

`verify` checks schemas, Node consumers, observation consumers, provenance and notices, the green part-geometry standard, lessons, formatting, lint, types, Python derivation contracts, Vitest, Playwright, and the production browser bundle.

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
- [Part visual-admission runbook](docs/runbooks/part-visual-admission.md)
- [Repository-local policy](docs/policies/local-rules.md)
- [Lessons index and evidence](docs/learning/lessons.md)
- [Historical devlog](docs/devlog/summary.md)
- [Dependency and data bill of materials](docs/dependency-data-bom.md)
- [Generated bundled-geometry notices](docs/bundled-geometry-notices.md)
- [Generated locked npm dependency notices](THIRD_PARTY_NOTICES.md)

The app owns brick-specific semantics. The sibling `3d-maker` repository remains a separate procedural-asset evolution studio; generic experiment, lineage, and evaluation interfaces may be shared only after both implementations prove the same need.
