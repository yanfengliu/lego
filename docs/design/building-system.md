# Building system: current assessment and ordered work

Status date: 2026-09-24

This document is the current position of the editor and printed-booklet build system. [`spec.md`](spec.md) owns product, domain, and authority contracts; [`learning-system.md`](learning-system.md) owns run evidence and replay; [`part-model.md`](part-model.md) owns catalog truth; and the [devlog](../devlog/summary.md) owns history.

## Executive status

**Measured 2026-09-24 (batch 4: identity alignment merged with catalog `/31`).** `npm run booklet` reads all 359 printed steps of booklet 6651557 (pages 11-219), identifies every callout's part with the closed-set identifier below (no model call, no answer key), and aligns each step to LEGO's official model of set 21066 by those parts. 316 steps match by identity (303 by run order, 13 re-laid by repair; 26 print no callouts), 43 match with their 65 flagged callouts counted instead (count fallback), and none mismatch. Aligned by callout counts alone, as before, 338 match by run order, 18 by repair and 3 (steps 156-158) not, and 22 steps get other parts than identity gives them: step 31 got two dark bluish grey 1x3 bricks that the booklet draws in step 32. Scored against the model, identification agrees with its run order on 313 of the 333 steps that print callouts; the other 20 differ only where the booklet moves a part to another step than the model builds it in (44 pieces), and after alignment all 859 callouts agree. The catalog covers 82 of the model's 172 designs, 77 exactly and 5 through an interchangeable mould, and misses 90; the first missing design is needed at step 51 and the first absent colour (LDraw 47) at step 18. Played back from the official poses, the build is valid through step 1 as exported (2 parts; step 2 fails `PART_BODY_COLLISION`), and through step 39 (265 parts) with three labelled export-frame corrections (the 77844 pin, a reviewed 80015 origin, and a reviewed 41682 quarter turn). Of the 359 steps, 39 are valid, 5 invalid, and 315 blocked by the catalog. Every LDraw-to-catalog frame playback uses is catalog `/31` truth (198 parts on mesh asset frames, 428 on the parametric frames `scripts/derive-ldraw-catalog-frames.mjs` measures from the official LDraw files), so no ignored run file is read; the retired first-50 frame registry agrees on all 66 of its rows when compared under `LEGO_RUN_EVIDENCE=1`. Step 29, which failed `DISCONNECTED_ASSEMBLY` until `/30`, now passes: the 15573 jumper gained the centre seat that grips a stud half a pitch off its grid. Steps 32-39, which failed `PART_STUD_BODY_COLLISION` under the prior catalog, pass since `/31` gave seven measured parts the `nominal-stud-tube/1` connection profile their studs lacked. Step 40 now fails `DISCONNECTED_ASSEMBLY`: with its frame corrected, 41682's centred flange is a ledge whose recessed back face takes a 1x2 plate's studs, but the catalog part has no clutch on that face and its collision boxes fill the recess. Step 45 is the first the catalog blocks (4519's half-LDU origin). The app-playable reference build (below) can only reach printed steps 1-37, cut short at step 38: playback holds some sub-build apart until the step that attaches it (`tools/booklet/reference-build.ts`), which its own per-step validity tolerates, but the single document the reference build exports cannot, so it stops one step before that document would read as disconnected — the same class of gap already known from step 31 (see G3c-2 below), not 41682's flange collision. `node scripts/identify-booklet.mjs` identifies callouts by closed-set matching against the inventory, with no model call: 313 distinct drawings, a proven-optimal assignment, and 72 of 74 judged Step 1-50 callouts right, 74 of 74 with the 2 recorded truth errata. Camera fit and placement are not scored yet. Reproduce from the main checkout with `BOOKLET_PDF=recipes/6651557.pdf BOOKLET_LXFML=output/official-model/vx1087034_21066_a.xml npm run booklet` and `LEGO_BOOKLET_PDF=recipes/6651557.pdf node scripts/identify-booklet.mjs`; those paths are also both tools' defaults.

`npm run booklet` compares its headline counts with the committed [`status/booklet-baseline.json`](../../status/booklet-baseline.json) on every run and reports the difference; it does not yet fail on a regression (the G3e ratchet is open).

The retired first-50 campaign's figures (its placement search, exact-prefix diagnostics, and step-28 selected-path result) and its uncommitted later work are history, not current status: see the [devlog](../devlog/summary.md) and branch `archive/first50-campaign-wip-20260908` (f44f1b8).

## Capability matrix

- **Manual editor** (built): Local projects and autosaves live in browser IndexedDB, with no sync service. The editor renders and validates the versioned `BrickDocument`, searches the palette, and plays authored build steps. Selection and authoring are mostly single-part; grouping, submodels, richer step editing, and articulation controls are missing.
- **LDraw interchange** (built for a bounded subset): Unsupported parts, transforms, references, and semantics are refused or preserved explicitly. A text round trip does not prove another consumer accepts the file.
- **Deterministic kernel** (built): `packages/protocol` (schema and generated types), `packages/catalog`, `packages/brick-kernel` (canonicalization, compiler, patch policy and verification, validation, collisions, migration, LDraw), and `packages/rendering` (a disposable Three.js view).
- **Orientations** (built, legality part-scoped): Transform, connector, collision, rendering, LDraw, and saved-document code represent all 24 proper rotations. Every part keeps the four upright yaws; a non-upright orientation is legal only where that part's own evidence declares it.
- **Connectors** (partial): The catalog types eleven connector kinds, but saved connection edges and attach programs still carry only `stud-tube`.
- **Catalog `/32` and frame truth** (built): 106 definitions: 61 parametric, 45 mesh-backed; `/30` to `/32` add no part. Every parametric part's LDraw-to-catalog frame is catalog truth, measured by `scripts/derive-ldraw-catalog-frames.mjs` from the byte-pinned official LDraw archive. The 15573 jumper gained a centre underside seat (`/30`), seven measured parts' studs the `nominal-stud-tube/1` connection profile (`/31`), and 41682 the two clutch seats in its wall's back recess, facing +Z, with collision measured as solid intervals per column so the recess is empty (`/32`). Truth `sha256:dbb4c8147a20b8ed0598ebf617583993fa7dd89788cdc491056d1579ee7b19d6`, catalog `sha256:2d95bc0b371954519d2f04bc56a950036c63de162469688d62cba9bee4fe2832`. [`part-model.md`](part-model.md#current-catalog) owns the roster.
- **Migration** (built): Saved documents migrate through explicit versioned steps with a report. `/29` to `/30` carries forward saved `/4`-`/29` edges on a 15573 grid clutch (`undersideClutch:0:0` and `:0:1`) under a proven delta class: 56 carried endpoint deltas across 28 rows. `/30` to `/31` carries saved edges on the seven newly profiled parts' studs under a second class, `validated-stud-profile-added-to-unchanged-stud`; `npm run migration-history:check` proves 476 carried endpoint deltas across 29 rows in all. `/31` to `/32` only adds 41682's two recess seats, so saved edges on its existing ports migrate unchanged. Other removed or changed endpoints still refuse rather than being reinterpreted.
- **Part visual admission** (built harness): Source and catalog renders are compared at native resolution ([runbook](../runbooks/part-visual-admission.md)). Exterior equality proves nothing about hidden interiors, collision, grip, or stability.
- **Physics** (partial): Rigid components, articulated joints, compound bodies, Rapier integration, and a cart demo exist. Simulation, pose controls, inertia, and incremental rebuild are not user workflows.
- **Backtracking** (library only): `BuildTree` and `runBacktrackingSearch` (`apps/web/src/assembly/backtracking-search.ts`) exist with tests; nothing in the booklet loop uses them.
- **Booklet PDF in the studio** (ingestion only): The Instructions control turns a PDF into bounded page and text metadata. It does not produce build steps.
- **Booklet reading** (built): `npm run booklet` (`tools/booklet/`) reads 359 of 359 steps, 1,464 placed pieces against a 1,465-piece inventory; the extra `31510` separator is never placed.
- **Alignment to the official model** (built, by identity): each printed step is held to the parts identification names in its callouts; a callout identification flags is matched by count only. 316 steps match by identity (13 of them re-laid by repair), 43 by count fallback, 0 mismatch. The alignment by counts alone stays as a comparison line (338 by run order, 18 by repair, steps 156-158 unmatched), and 22 steps differ in parts between the two.
- **Catalog coverage** (measured): 82 of 172 designs covered (77 exact, 5 interchangeable); 90 missing, first needed at step 51; colour LDraw 47 absent, first needed at step 18.
- **Reference playback** (built in the harness): Official poses played step by step through catalog truth, with three labelled export-frame corrections (77844, 80015, 41682). It runs in `tools/booklet`, not in the app.
- **Closed-set identification** (built, scored against the key): `apps/web/src/instructions/identify/` and `node scripts/identify-booklet.mjs`: pdf.js, image-XObject cut-out, matching to 276 inventory thumbnails, min-cost flow plus branch and bound, no model call. `npm run booklet` runs it and scores it against the official model per step: 313 of 333 steps agree by run order, 20 differ only by the booklet moving a part, 0 unexplained.
- **Camera fit scored against the key** (not built (G3d)): Silhouette camera-fit primitives exist in `packages/rendering/src/camera-fit.ts`, used by specs and the experimental family; nothing fits a printed panel's camera and scores it against the official camera.
- **Placement scored against the key** (not built (G3d)): `compareBuilds` runs only against a synthetic reference (`apps/web/e2e/build-search.spec.ts`).
- **Per-step verification against the printed panel** (not built): No rebuild step is checked against its booklet picture.
- **Reference build in the app** (built (G3b)): `npm run booklet` writes the valid prefix to ignored `output/booklet/reference-build.mpd`, with one editor step per printed step and labelled as a reference. Use the editor's Import, then Build, to step through printed steps 1-37 (cut short at step 38: not yet one connected document); step 31 holds the booklet's sub-build (a 2x4 plate, two black 1x2x2 bricks and a light grey 1x2 plate), checked against page 35 on 2026-09-24. `apps/web/e2e/reference-build-playback.spec.ts` (opt-in) checks each step's counts against the printed callouts. Looked at 2026-09-24: step 31 matches booklet page 35 without a flip once the renderer's LDU-to-Three map became a rotation (it had been a reflection that mirrored every model, the editor drawing it flipped), and trans-clear appears as an opaque stand-in.
- **Ratchet** (baseline reported, not enforced (G3e)): Headline counts are committed and compared each run; a regression does not fail.
- **Broker and evaluator** (not built): `apps/companion` holds local run-ledger and artifact-store libraries. There is no released broker, credential proxy, production signing, sealed replay, or independent evaluator.
- **Experimental `real-build-*` family** (exists, retiring (G3e)): `apps/web/e2e/real-build-*` is the retired first-50 campaign's tooling. It reads the official model directly as a named exception and is not the current frontier. It is removed once the harness reproduces its useful numbers.

The earlier model-pilot identification path (the pilot transports and the quarantined multi-panel checker) is retired; model output stays untrusted data wherever it returns.

## Measured booklet frontier

The next gaps, in build order, as `npm run booklet` measures them:

- Step 18: colour LDraw 47 is first needed and absent from the catalog.
- Step 40: playback fails `DISCONNECTED_ASSEMBLY`; it is the first invalid step after 39 valid ones. 41682's recessed flange face takes a 1x2 plate's studs with no clutch modelled there.
- The app-playable reference build stops two steps earlier still, at printed step 37: a sub-build rests apart until playback attaches it later, which the single exported document cannot hold — the known step-31-class gap, not step 40's flange collision.
- Step 45: the first step the catalog blocks, on 4519's half-LDU origin.
- Step 51 onward: 90 designs are missing, 371 pieces in all.
- 43 steps align with flagged callouts counted, not identified, so a part there could still be the wrong one of equal count.

Rules the retired campaign established, which still bind:

- Panel N+1 is the minimum later witness for a placement at step N, not a guarantee that the placement is visible. Step 5 was the counterexample: panel 6 hides the disputed relation and panel 7's underside view reveals it.
- A mirror image (determinant -1) of the target never counts as completion, however well it matches in silhouette.
- Silhouette registration is panel-local raster evidence, never authority over a physical transform.
- Catalog admission of a part grants no printed assignment, frame, or placement.
- A budget refusal reserves work before it starts, retains the exact request, and admits no partial frontier.

## Ordered work

### Open reset items

[`docs/work/1_booklet-reset/plan.md`](../work/1_booklet-reset/plan.md) is the list of record. Open now:

1. Step 40 (was step 33's `PART_STUD_BODY_COLLISION`, resolved by catalog `/31`): resolve `DISCONNECTED_ASSEMBLY` on 41682's recessed flange face. Separately, the reference build's own stop at step 37/38 is the known sub-build attach-timing gap (a resting-apart sub-build the single exported document cannot hold), not this collision.
2. G3a-3 catalog gaps: the 90 missing designs, colour LDraw 47, and 4519's half-LDU origin.
3. G3b: done. The reference build plays in the app, per step, and step 31's parts are right since alignment by identity.
4. G3c-2: done. Identification runs inside `npm run booklet`, aligns each step by identity and is scored against the official model; the two untested limits have tests.
5. Catalog `/31`: done. Seven measured parts gained the `nominal-stud-tube/1` connection profile and 41682's export frame was turned to the ledge the booklet draws; combined with identity alignment, playback is valid through step 39.
6. G3d: camera fit, and placement scored against the key.
7. G3e: enforce the ratchet on the committed baseline, and retire the `real-build-*` family.
8. G3f-3: move the Playwright specs gated on `hasSampleBooklet` to the `LEGO_RUN_EVIDENCE` opt-in.
9. Editor: hand placement on the 15573 centre seat (the `snapPlacementOrigin` lattice cannot reach it yet).
10. App: a recovery path for a document the migration refuses.

### Later product work

1. Move the proven reader, placement, evidence, and playback path behind a user-facing booklet workflow, keeping manual editing available offline.
2. Build the released broker, executable replay, and independent evaluator only after the local loop produces evidence worth sealing.
3. Generalize placement search into immutable deep backtracking that reports its reversal depth.
4. Add interior or cutaway evidence wherever an exterior review leaves a claimed cavity hidden, and keep every unseen claim `not-observable` until then.

## Manual-editor work beyond the booklet frontier

The editor still needs multi-selection, grouping and submodel authoring, richer build-step editing, user-facing articulated pose controls, and simulation controls.

A complete 1,465-piece model also needs measured rendering and interaction work. The current renderer creates groups, bodies, studs, and instruction outlines per part; connector indexing, instancing, incremental rebuild, and profiling should be driven by real frame-time and memory measurements.

## Evidence rule

Every frontier change records the exact inputs, catalog version, step counts, refusal code, and the images that make the number interpretable.

Raw runs stay under ignored `output/` and `var/runs/`. Stable conclusions live here, history lives in the devlog, and promoted failures become tests or fixtures.
