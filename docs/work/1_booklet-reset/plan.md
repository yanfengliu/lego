# Booklet reset

Status: active
Owner: Claude Code session 472890e3 (coordinator)
Created: 2026-09-22
Updated: 2026-09-24

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

Done (on main):

- [x] G1 archive, clean, refs; baseline measured. The WIP is on archive/first50-campaign-wip-20260908 (f44f1b8), and main was clean at b1e1d0e.
- [x] G2 workflow reform (23be69a): AGENTS.md 35,357 → 28,621 bytes with the fleet canon block byte-identical, docs/START.md, the local-rules rewrite, and the `scout` agent.
- [x] G3a harness milestone 1: read, align, catalog, reference playback (ee3e7af). `npm run booklet` reads 359/359 steps; aligns 338 by run order, 18 by repair and 3 not; covers 77 exact and 5 interchangeable designs of 172, with 90 missing.
- [x] G3a-2 frame truth, catalog `/30` (merge 3d5822e). Every parametric part's LDraw-to-catalog frame is catalog truth, so playback reads no ignored registry; the 15573 jumper's centre seat clears step 29. The `/29`→`/30` migration carries saved 15573 grid-clutch edges forward under a proven delta class (b466d94). Playback was valid through step 31 with the two labelled corrections; step 32 failed `PART_STUD_BODY_COLLISION` (measured 2026-09-24 at 384a70d) — superseded below by catalog `/31` and identity alignment.
- [x] G3c closed-set identification scored against the key (0271962). `node scripts/identify-booklet.mjs` finds 313 drawings, proves its assignment optimal, and gets 72/74 judged Step 1-50 callouts right, 74/74 with the 2 recorded truth errata.
- [x] G3c-2 identification inside the harness and alignment by identity (994a460, batch 4). `tools/booklet/identify-stage.ts` runs the closed-set identifier inside `npm run booklet` (no model call, no answer key); the aligner holds each step to its identified elements, falling back to counts only where a callout is flagged. 316 steps exact identity (303 run order, 13 repair), 43 count fallback, 0 mismatch; identification agrees with the model's run order on 313 of 333 steps with callouts, and all 859 callouts agree after alignment. Step 31 now holds the booklet's own sub-build — the "2 of 4 pieces wrong" defect from G3b is fixed. The untested `maxOperatorsPerPage`/`maxDecodedPixelsPerPage` limits are now covered by tests.
- [x] Catalog `/31`, nominal-stud-tube profile and the 41682 correction (a840684, batch 4). Seven measured parts gain the `nominal-stud-tube/1` connection profile; the `/30`→`/31` migration carries forward saved edges on their studs (476 endpoint deltas across 29 rows in all, `npm run migration-history:check`). 41682's export frame is turned to the ledge the booklet draws, a third correction beside 77844 and 80015. Combined with identity alignment (measured 2026-09-24 after merging both): playback valid through step 39 (265 parts), 5 invalid, 315 catalog-blocked; first invalid step 40 `DISCONNECTED_ASSEMBLY` (41682's recessed flange face has no clutch for the 1x2 plate's studs it takes); first catalog-blocked step unchanged at 45. The app-playable reference build reached only printed steps 1-37 (cut short at 38). Corrected cause, measured after `/32` (see the frontier-3 entry): not attach timing but the file's one document, which draws the step 38-43 strip where it ends up; that strip touches nothing until 41682's recess seats take it at step 40, so the file's last state at 39 was disconnected and the exporter refused it.
- [x] Frontier 3: catalog `/32` and sub-build attach timing (this branch; `/32` awaits independent review). 41682 gains its two recess clutch seats from the pinned LDCad socket (`undersideClutch:4`/`:5`, facing +Z) and solid-interval collision measured from its LDraw surface; the two 1-LDU stick-outs came from a clip-roundoff sliver in the column height field. `/31`→`/32` only adds endpoints: `migration-history:check` 33 source truths, 476 carried deltas as before; a new clutch-seat collision class test seats a probe in every catalog clutch. Sub-builds attach at the printed step the booklet joins them (`tools/booklet/sub-build-attach.ts`). Measured 2026-09-24 after merging both: valid through step 44 (280 parts), 0 invalid, 315 catalog-blocked, first blocked step 45 (4519); the reference build holds steps 1-44, and `status.json` records its range and any cut. Steps 41-44 needed no fix of their own: they carried step 40's issues. Looked at steps 31-44 in the editor against pages 35-45.
- [x] G3f-1 the gate made green (feea2f8): `npm run verify` exit 0, the `LEGO_RUN_EVIDENCE` opt-in with its class check, and `npm run test:score`.
- [x] G3f-2 the a8fc397 generated-file staleness tests ported (741e9a2).
- [x] README cut to 4.8 KB and the `docs:budget` gate (7c43b22); operating-docs fixes from the ops review (4fbc04c); both merged in c53723e.
- [x] Evidence cleanup: ignored `output/` and `var/` cut from about 42 GB to 2.8 MB, keeping only the inputs `npm run booklet`, `identify-booklet.mjs` and the score tests read.
- [x] Fleet canon trim (fleet 20a77f3), synced here in 8ed4adc and 002a6af.
- [x] Design docs trimmed to contracts plus the measured position, and the session records written (this branch).

Todo:

- [x] Step 40 `DISCONNECTED_ASSEMBLY`: done by catalog `/32` (frontier 3 above).
- [ ] Reference build sub-builds as submodels: the file is one LDraw document the exporter writes only when its last state is connected, so a valid prefix ending while a sub-build is apart is cut back (with the reason recorded).
- [ ] G3a-3 catalog coverage: the 90 missing designs (first needed at step 51), LDraw colour 47 (first needed at step 18), and 4519's half-LDU origin (first blocks step 45).
- [x] G3b reference build playable in the app, per step (`output/booklet/reference-build.mpd`; step 31's parts are now right under alignment by identity). The mirror was fixed in the renderer (1299598). The file stopped at 37 while playback was valid through 39 because its one document was disconnected at 38-39, not because of attach timing (see frontier 3); it now holds every valid step, 1-44.
- [x] G3c-2 identification follow-ups: tests for the untested `maxOperatorsPerPage` and `maxDecodedPixelsPerPage` limits, and identification scored against the official model inside the harness. Done in 994a460 (batch 4); see G3c-2 above.
- [ ] G3d camera fit (fed) and placement (fed) scored against the key.
- [ ] G3e ratchet baseline (today `status/booklet-baseline.json` is reported, not enforced); retire the real-build-* family.
- [x] G3f-3 move the Playwright specs gated on booklet existence (`hasSampleBooklet`) to the `LEGO_RUN_EVIDENCE` opt-in (da37b92): 24 of 26 converted, one compound case kept its onlyIf, `real-build-step7-gate3-diagnostic.spec.ts` left alone since it already fails loudly rather than skipping; the class check now scans Playwright's spec population too.
- [ ] Editor centre-seat placement: the editor cannot hand-place a part on the 15573 centre seat (the `snapPlacementOrigin` lattice).
- [ ] App recovery for refused documents: the app offers no way forward for any document the migration refuses.
- [ ] Run `npm run evidence:budget` automatically (session start or a hook); today it runs only when invoked.
- [ ] G4 canon candidates.
- [ ] Not ours: the local AGENTS.md trims needed in the scenes, cards and voxel repos.

## Outcome

Pending.
