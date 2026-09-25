# lego

A build player for LEGO set 21066: it plays the build one printed step at a time, beside the booklet page that prints each step.
The rest of the repository is the pipeline meant to read a set's booklet and build the set from it; until that is reliable, the player plays LEGO's official model of the set.

## Play the build

Needs Node.js 24 or newer and npm 11 or newer. From the repository root:

```powershell
npm ci
npm start
```

`npm start` makes the player data current, starts the dev server and opens the player at the URL it prints (`http://127.0.0.1:5173/`; set `PORT` for another port, pass `--no-open` to skip the browser).
When the data is missing or stale, it first runs `npm run booklet`, which takes about half a minute.

The data is built from local files that never enter Git: the booklet `recipes/6651557.pdf`, LEGO's official model export in `output/official-model/`, the pinned LDraw parts library `C:/tmp/ldraw-complete-2026-07.zip` (`LEGO_LDRAW_OFFICIAL_ARCHIVE`), and the set's LEGO Builder mesh pack `C:/tmp/lego-21066-builder-native-part-pack.json` (`LEGO_BUILDER_NATIVE_PACK`), which stands in for the six designs the LDraw library lacks.

The screen is a 3D view of the model built so far, the booklet page for the current step, and the controls:

- drag to orbit, right-drag to pan, scroll to zoom; **Reset view** frames the current step again;
- ⏮ ◀ ▶/⏸ ▶| ⏭ go to the first step, the previous one, play or pause (with a speed choice), the next one and the last;
- the scrubber moves over all 359 steps, and the label reads `Step N / 359 · page P · +K parts`;
- Space plays or pauses, ← and → step, Home and End jump to the ends;
- the parts a step adds glow for a moment. A sub-build shows in its final position at the steps that build it.

The sets the player knows are listed in `tools/player/sets.ts`. The player's input format, `model.mpd` plus `steps.json` per set, is described in `apps/web/src/player/player-data.ts`.
The old manual editor still runs at `/editor.html` until it is removed.

## Booklet tooling

- `npm run booklet` reads booklet 6651557, identifies every callout's part, aligns each printed step to the official model by those parts, checks catalog coverage, and replays the official poses through the brick kernel. It writes `output/booklet/status.json`, the reference build `output/booklet/reference-build.mpd`, and the player data in `output/booklet/player/21066/`. Inputs come from the set's entry in `tools/player/sets.ts`, overridden by `BOOKLET_PDF`, `BOOKLET_LXFML`, `BOOKLET_OFFICIAL_LDRAW` and `BOOKLET_OUT`; `--set <id>` picks another set.
- `node scripts/identify-booklet.mjs` identifies every part callout in the booklet by closed-set matching against its own inventory, with no model call, and scores Steps 1-50 against tracked truth. It writes `output/booklet/identify.json`.

The measured position of the booklet pipeline is in [building-system.md](docs/design/building-system.md#executive-status).

## Checks

Python 3 as `python` and Playwright's Chromium (`npx.cmd playwright install chromium`) are needed for the full gate:

```powershell
npm run verify
```

`verify` runs the schema, Node-consumer, observation, bill-of-materials, part, lessons and notices checks, formatting, lint, types, the Python tests, Vitest, Playwright and the production build; the exact steps are in [package.json](package.json).
`npm run test:score` runs the scoring tests that measure the real booklet; they stay out of `verify`.
Tests that read local evidence (`output/`, external archives, the booklet) skip by default, each naming why, and run under `LEGO_RUN_EVIDENCE=1`.
A dependency change also needs `npm run audit` and `npm run audit:runtime`.

## Docs

- [docs/START.md](docs/START.md) — read this first, every session.
- [AGENTS.md](AGENTS.md) — the fleet and repository rules this project works under.
- [docs/policies/local-rules.md](docs/policies/local-rules.md) — this repository's local rules, including the product's scope.
- [docs/design/](docs/design/) — product spec, learning system, part model, building-system assessment and threat model.
- [docs/work/](docs/work/) — plans and review rounds, one folder per unit of work.
- [docs/devlog/](docs/devlog/) — dated history of behaviour-changing sessions.

The app owns brick-specific semantics. The sibling `3d-maker` repository is a separate procedural-asset studio; generic experiment, lineage and evaluation interfaces may be shared only after both prove the same need.
