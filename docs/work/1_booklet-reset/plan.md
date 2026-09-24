# Booklet reset

Status: active
Owner: Claude Code session 472890e3 (coordinator)
Created: 2026-09-22
Updated: 2026-09-23

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

### Using the archive

Branch archive/first50-campaign-wip-20260908 (f44f1b8) is kept as the campaign's permanent record. About 3.7K lines of product code in it may be ported, each only when a harness number shows it helps:

- exact step-operation playback, for G3b;
- instruction-style capture and colour masks, for G3d;
- rigid sub-assembly return, for sub-build steps;
- the catalog's 15573 jumper and 35480 orientation, for step 29 and catalog coverage.

Nothing else is ported.

## Acceptance criteria

- Each goal G1-G4 in Scope is met on main, with its checks recorded here.

## Implementation steps

Done (integrated on branch integrate/booklet-reset-1; `npm run verify` exit 0 at c2a3d7a):

- [x] G1 archive, clean, refs; baseline measured. The WIP is on archive/first50-campaign-wip-20260908 (f44f1b8), and main was clean at b1e1d0e.
- [x] G2 workflow reform (23be69a): AGENTS.md 35,357 → 28,621 bytes with the fleet canon block byte-identical, docs/START.md, the local-rules rewrite, and the `scout` agent.
- [x] G3a harness milestone 1: read, align, catalog, reference playback (ee3e7af). `npm run booklet` reads 359/359 steps; aligns 338 by run order, 18 by repair and 3 not; covers 77 exact and 5 interchangeable designs of 172, with 90 missing; plays back valid through step 1 as exported and through 28 with the two labelled corrections, then step 29 is `DISCONNECTED_ASSEMBLY` on the 15573 jumpers.
- [x] G3c closed-set identification scored against the key (0271962). `node scripts/identify-booklet.mjs` finds 313 drawings, proves its assignment optimal, and gets 72/74 judged Step 1-50 callouts right, 74/74 with the 2 recorded truth errata.
- [x] G3f-1 the gate made green (feea2f8): `npm run verify` exit 0, the `LEGO_RUN_EVIDENCE` opt-in with its class check, and `npm run test:score`.

Todo:

- [ ] G3a-2 frame truth: move the measured frames into catalog data so the harness stops reading `output/real-build/history`, and fix the 15573 jumper that blocks step 29.
- [ ] G3a-3 catalog coverage: the 90 missing designs (first needed at step 51), LDraw colour 47 (first needed at step 18), and 4519's half-LDU origin (first blocks step 45).
- [ ] G3b reference build playable in the app, per step
- [ ] G3c-2 identification follow-ups: tests for the untested `maxOperatorsPerPage` and `maxDecodedPixelsPerPage` limits, and identification scored against the official model inside the harness.
- [ ] G3d camera fit (fed) and placement (fed) scored against the key
- [ ] G3e ratchet baseline; retire the real-build-* family
- [ ] G3f-2 port the a8fc397 staleness tests
- [x] G3f-3 move the 26 Playwright specs gated on booklet existence (`hasSampleBooklet`) to the `LEGO_RUN_EVIDENCE` opt-in.
- [ ] G4 records and canon candidates

## Outcome

Pending.
