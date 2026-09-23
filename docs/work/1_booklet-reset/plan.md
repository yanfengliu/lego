# Booklet reset

Status: active
Owner: Claude Code session 472890e3 (coordinator)
Created: 2026-09-22
Updated: 2026-09-22

## Problem and outcome

Why: 4.0B Claude tokens and about 3.0B Codex tokens over 08-04..09-15 left 0 steps verified against the booklet. 87.8% of Claude tokens went to two sessions that never restarted. The blind first-50 protocol produced no product commit after 08-29. LEGO's official model of set 21066 (all 1,465 bricks and a camera per step, ignored under output/official-model/) was used only as a diagnostic through Step 50.

## Scope

Goals:

- G1 Clean main: WIP archived, tree clean, stash and stale refs resolved, gate baseline recorded.
- G2 Workflow reform (repo-local): AGENTS.md ≤ 30 KB, docs/START.md, local-rules rewrite, scout agent. Fleet proposals staged for the owner.
- G3 New approach:
  - `npm run booklet` scores each stage per step against the official model;
  - the 359-step reference build plays back in the app;
  - deterministic closed-set part identification;
  - a mirror-safe camera fit by shaded render-and-compare;
  - a committed ratchet baseline;
  - the real-build-* family retired once the harness reproduces today's numbers.
- G4 Records: devlog, building-system position, defect register, canon candidates.

## Approach

Decisions:

- Booklet pages are ordinary inputs, and the blind protocol is retired.
- The official model is the per-step scoring reference and a labelled reference build. Product code never imports it.
- pdf.js, pinned by package-lock, is the rasterizer of record.
- The first-50 WIP is archived, not merged: branch archive/first50-campaign-wip-20260908 at f44f1b83fa6c95f3ba298c555a1037afa600ccf3.

## Acceptance criteria

- Each goal G1-G4 in Scope is met on main, with its checks recorded here.

## Implementation steps

Todo:

- [ ] G1 archive, clean, refs, baseline
- [ ] G2 workflow reform merged
- [ ] G3a harness: read, align, catalog, reference playback
- [ ] G3b reference build playable in the app, per step
- [ ] G3c closed-set identification scored against the key
- [ ] G3d camera fit (fed) and placement (fed) scored against the key
- [ ] G3e ratchet baseline; retire the real-build-* family
- [ ] G3f port a8fc397 staleness tests; fix gate defects from the baseline
- [ ] G4 records and canon candidates

## Outcome

Pending.
