# lego

An offline manual brick editor, plus a target loop: read LEGO instruction booklet 6651557, build set 21066, and replay every step.
That loop is a target, not a shipped feature — it does not yet place parts from the booklet's pictures. See Measured position below for what runs today.

## The editor

The manual editor works today: local projects with integrity-checked persistence, a searchable part catalog, snapped placement and attachment, transform and color editing, undo/redo, structural validation, and build playback, plus a bounded LDraw import/export profile.
Its **Instructions** control ingests a PDF into page and text metadata only; it does not render booklet panels, compile steps, or touch the document.

## Measured position

The current numbers — how many of the 359 printed steps align, how much of the catalog matches, and where playback first fails — are in [building-system.md's Executive status](docs/design/building-system.md#executive-status).
Reproduce them with `npm run booklet` and `node scripts/identify-booklet.mjs`, described below; both default to the paths that section cites.

## Requirements and setup

- Node.js 24 or newer and npm 11 or newer.
- Python 3 available as `python`, for the full verification suite.
- Chromium, for Playwright browser tests.

From the repository root:

```powershell
npm ci
npx.cmd playwright install chromium
```

## Run the studio

```powershell
npm run dev
```

Open `http://127.0.0.1:5173`. Pick a part and color in the catalog, then click in the viewport to place it; on an empty model, **Place at origin** gives the first placement. Select a part and use **Attach to selection** to add the chosen part on a free top stud, or **Move**, **Rotate**, and the inspector for later edits. Each placement becomes a build step, in **Build**.

Projects save locally in the browser. **Import** accepts the supported `.ldr` and `.mpd` subset, and **Export LDraw** downloads the current document.

## Booklet tooling

Both commands need a local booklet PDF and LEGO's official model export; neither ships in the repository.

- `npm run booklet` reads booklet 6651557, aligns its printed steps to the official model of set 21066, checks catalog coverage, and replays the official poses through the brick kernel. It prints a per-stage summary and writes `output/booklet/status.json`, plus `reference-build.mpd`: the valid prefix as a labelled reference build. Open it with the editor's Import, then Build, to step through it one printed step at a time. Inputs default to `recipes/6651557.pdf` and `output/official-model/vx1087034_21066_a.xml`, overridden by the env vars `BOOKLET_PDF`, `BOOKLET_LXFML`, `BOOKLET_OFFICIAL_LDRAW`, and `BOOKLET_OUT`. Playback takes every LDraw-to-catalog frame from the catalog. `BOOKLET_LDRAW_FRAMES` names the retired first-50 frame registry, which is compared with the catalog only under `LEGO_RUN_EVIDENCE=1`; nothing waits on it.
- `node scripts/identify-booklet.mjs` identifies every part callout in the booklet by closed-set matching against its own inventory, with no model call, and scores the result against tracked truth for Steps 1-50. The booklet path defaults to `recipes/6651557.pdf`, overridden by `LEGO_BOOKLET_PDF`. It writes `output/booklet/identify.json`.

## Checks

```powershell
npm run verify
```

`verify` is the repository's implemented gate: schema, Node-consumer, observation, bill-of-materials, part, lessons, and notices checks, formatting, lint, types, the Python test suite, Vitest, Playwright, and the production build. The exact steps are in [package.json](package.json).

`npm run test:score` runs the scoring tests that measure the real booklet or a grown assembly against a reference; they stay out of `npm run verify` and `npm test` because they need the same local inputs as the booklet tooling above.

Tests that read retained run evidence (`output/real-build/`, `output/official-model/`, external archives) are skipped by default, each naming why, and run under `LEGO_RUN_EVIDENCE=1`.

A dependency change also needs both audits:

```powershell
npm run audit
npm run audit:runtime
```

## Docs

- [docs/START.md](docs/START.md) — read this first, every session.
- [AGENTS.md](AGENTS.md) — the fleet and repository rules this project works under.
- [docs/policies/local-rules.md](docs/policies/local-rules.md) — this repository's local rules.
- [docs/design/](docs/design/) — product spec, learning system, part model, the building-system assessment (measured position), and threat model.
- [docs/work/](docs/work/) — planning docs and review rounds, one folder per unit of work.
- [docs/devlog/](docs/devlog/) — dated history of behaviour-changing sessions.

Notes on the retired first-50 campaign's internal diagnostics (source-stage tracers, prefix-50 verifiers, sha256 pins) are not duplicated here; they live in git history and on branch `archive/first50-campaign-wip-20260908`.

The app owns brick-specific semantics. The sibling `3d-maker` repository is a separate procedural-asset evolution studio; generic experiment, lineage, and evaluation interfaces may be shared only after both implementations prove the same need.
