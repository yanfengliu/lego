# Devlog Summary

Current state belongs in the design documents; this index records only behaviour changes, measured results, and links to the matching detailed history.

- [2026-09-24 (frontier 3, catalog /32)](detailed/2026-09-24_2026-09-24.md) — 41682 gains recess clutches and solid-interval collision; sub-builds join at the booklet's step. Valid through 39 → 44 (280 parts), first blocked 45; reference build 1-37 → 1-44 (stop was its one document, not timing).
- [2026-09-24 (renderer handedness)](detailed/2026-09-24_2026-09-24.md) — LDU reached Three as (x,-y,z), a reflection: every model drew mirrored, step 31 flipped against page 35. Now the half-turn (x,-y,-z) everywhere; `lego.rendering/2`; det, chiral-pair and pick gates.
- [2026-09-24 (physics tilt handedness)](detailed/2026-09-24_2026-09-24.md) — Session forwarded Rapier's raw sim-frame rotation unconverted, tilting bodies backwards; now converted at the session boundary, with a tilt-direction gate and a strengthened picking gate.
- [2026-09-24 (batch 4, identity alignment + catalog `/31` integrated)](detailed/2026-09-24_2026-09-24.md) — Merged: valid through 39 (not 32 alone), first invalid step 40 `DISCONNECTED_ASSEMBLY` (41682 flange). Reference build in-app reaches only 1-37, 2 steps short.
- [2026-09-24 (G3c-2, alignment by identity)](detailed/2026-09-24_2026-09-24.md) — `npm run booklet` identifies callouts and aligns steps by part: 316 exact, 43 count fallback, 0 mismatch (counts: 338/18/3). 22 steps change parts; step 31 is right. Valid through 31 → 32.
- [2026-09-24 (stud profile `/31`, 41682 frame)](detailed/2026-09-24_2026-09-24.md) — Seven measured parts get the nominal stud profile (catalog `/31`): playback valid through 31 → 39. 41682's export frame is turned to the ledge the booklet draws; step 40 waits on its missing flange clutches.
- [2026-09-24 (G3b, reference build in the editor)](detailed/2026-09-24_2026-09-24.md) — `npm run booklet` writes `reference-build.mpd`, printed steps 1-31 as editor steps. Screenshots found two faults no gate saw: the editor draws the model mirrored; step 31 has 2 of 4 pieces wrong.
- [2026-09-24 (design docs cut, reset records)](detailed/2026-09-24_2026-09-24.md) — Design docs 479,409 → 215,422 B: retired first-50 status and dead evidence citations out, contracts kept; four owner-reported defects registered; `npm run evidence:budget` (256 MiB, not in verify).
- [2026-09-24 (canon sync 973eb18eaf96)](detailed/2026-09-24_2026-09-24.md) — `AGENTS.md` canon block re-synced after the fleet canon trim (fleet 20a77f3, here 002a6af); local rules drop their copy of the session-size rule, now canon R6.
- [2026-09-24 (evidence cleanup)](detailed/2026-09-24_2026-09-24.md) — Ignored `output/` and `var/` cut from about 42 GB to 2.8 MB by the owner after an audit at 982634d; only inputs a current command reads by default, and the gates' score files, remain.
- [2026-09-24 (G3f-3, Playwright specs onto LEGO_RUN_EVIDENCE)](detailed/2026-09-24_2026-09-24.md) — 24 of 26 booklet-gated specs converted to `skipWithoutRunEvidence`; the class check now scans Playwright too; `test:browser` 59/14 (main) → 45/28 here.
- [2026-09-23 (frame truth review fixes)](detailed/2026-09-23_2026-09-23.md) — Saved `/4`-`/29` edges on 15573 grid clutches now migrate under a proven delta class instead of being refused; real `/1` files pin LDraw fidelity; `3023` credits `3023b`, moving the `/30` catalog hash.
- [2026-09-23 (canon sync a4df5e4b87dc)](detailed/2026-09-23_2026-09-23.md) — The `AGENTS.md` canon block re-synced from `../fleet/FLEET.md` by the sync script (8ed4adc).
- [2026-09-23 (staleness tests ported)](detailed/2026-09-23_2026-09-23.md) — 14 of a8fc397's 19 generated-file staleness tests ported to main (G3f-2); the 5 `describeStaleRunPin` tests dropped with their removed feature.
- [2026-09-23 (README and doc budgets)](detailed/2026-09-23_2026-09-23.md) — README 25.6 → 4.8 KB; `npm run docs:budget` in verify caps README 6,000 B, START 10,000, AGENTS.md 30,000 and devlog lines 300 chars; devlog summary 68,092 → 29,972 B.
- [2026-09-23 (frame truth, catalog `/30`)](detailed/2026-09-23_2026-09-23.md) — Parametric LDraw frames measured from the official files into catalog truth; playback reads no ignored registry (valid through 3 → 31 without it); the 15573 centre seat clears step 29; LDraw subset `/2`.
- [2026-09-23 (booklet-reset milestone 1 integrated)](detailed/2026-09-23_2026-09-23.md) — Four branches merged; `npm run verify` exit 0 in 16 min (Vitest 3881 passed, Python 608 ran, Playwright 59 passed). The run-evidence class check now reads vitest's include, so `tools/` tests are scanned.
- [2026-09-23 (`npm run verify` green again)](detailed/2026-09-23_2026-09-23.md) — Vitest failures on main 31 → 0. Tests reading ignored run evidence skip unless `LEGO_RUN_EVIDENCE=1`, and a class check fails any test gated on a path's existence; scoring runs moved to `npm run test:score`.
- [2026-09-23 (`npm run booklet`)](detailed/2026-09-23_2026-09-23.md) — New booklet harness: 338 of 359 steps align by run order, 18 by repair, 3 not; 82 of 172 designs covered; official-pose playback valid through step 1 as exported, 28 with the 77844 pin and a reviewed 80015 origin.
- [2026-09-23 (closed-set callout identification)](detailed/2026-09-23_2026-09-23.md) — `node scripts/identify-booklet.mjs` matches callouts to the inventory with no model call: 313 drawings, a proven-optimal assignment, 72/74 judged Step 1-50 callouts right (74/74 with 2 recorded truth errata).
- 2026-09-23: **Workflow reform** — AGENTS.md 35,357 → 28,621 bytes with the canon block unchanged, plus `docs/START.md`, local rules that each state their reason, and a read-only `scout` agent, all from a token audit ([design](../work/1_booklet-reset/design.md)).
- 2026-09-22: **The uncommitted first-50 campaign is archived, not merged** — 759 files, gates red, now on branch `archive/first50-campaign-wip-20260908` (f44f1b8). The stash and stale refs are resolved: archived to `archive/` branches, or deleted where merged.
- [2026-09-02 (the second lessons pass, measured against the standing gates)](detailed/2026-09-02_2026-09-02.md) — Vitest: 44 files / 103 tests failed, 4231 passed over 589 files — the same failures as the first pass, plus seven new gate files' 34 cases.
- [2026-09-02 (the lessons queue now names the gate every entry waits for)](detailed/2026-09-02_2026-09-02.md) — Triaged 21 lessons: 8 gated and mutation-proved, 2 promoted to canon-candidates, 2 to local-rules, 1 dropped, 10 retained; `check-lessons.mjs` now refuses any rule naming no gate.
- [2026-09-02 (reach and clause audit of the lesson gates)](detailed/2026-09-02_2026-09-02.md) — The tube-clearance gate's `kind !== "box"` guard skipped boxed cylinders; fixed, its non-vacuity floor moved 20 → 582 over 30 tubed parts.
- [2026-09-02 (the six gates the first lessons pass could not make go red)](detailed/2026-09-02_2026-09-02.md) — 6 of the 27 lessons left unproved are now gated and mutation-proved, including the exploded-step blend and the lattice selector's acceptance ordering.
- [2026-09-02 (every deleted lesson's gate was made to go red first)](detailed/2026-09-02_2026-09-02.md) — Triaged all 66 `lessons.md` rules: 23 gated and deleted, 9 to canon-candidates, 6 to local-rules, 1 already in AGENTS.md, 27 remain unproved.
- [2026-08-28 (`/29` first-50 catalog identity closure and authority-free selected-path diagnostic)](detailed/2026-08-28_2026-08-28.md) — Catalog `/29` admits `10201`/`3245b`, reaching 106 definitions; authority-free selected-path search stops after 163 parts at step 29.
- [2026-08-28 (exact first-50 frame, occurrence, and structural evidence)](detailed/2026-08-28_2026-08-28.md) — A 62-alias frame registry binds all 320 physical occurrences into 11 `MultiBuild` rows; steps 51–359 remain index-only.
- [2026-08-27 (deterministic Gate-3 growth and three-dimensional collision broadphase)](detailed/2026-08-27_2026-08-27.md) — Worst aggregate collision-growth measure fell to `2.310218`, under the unchanged `<3` gate; Vitest now fixes 8 workers, 431 files / 3,576 tests in 180.94s.
- [2026-08-26 (token-gated `2453;I`, exact all-proper runtime, and official prefix-50 world proposal)](detailed/2026-08-26_2026-08-26.md) — All 24 proper signed-permutation rotations now preserve across every consumer; an official XML/LDraw parse yields 309 world proposals plus 11 quarantines.
- [2026-08-26 (bounded first-50 action preparation and exact Builder-frame census)](detailed/2026-08-26_2026-08-26.md) — Action-preparation orders 187 first-50 callouts / 320 identities into 95 exact phases; the Builder frame registry expands to 42 revisions / 192 pieces.
- [2026-08-26 (exact suffix catalog admission closes first-50 catalog coverage)](detailed/2026-08-26_2026-08-26.md) — Catalog `/28` admits exact `3245c`/`2453b`, raising the roster to 104 definitions; Builder required-leaf coverage stays 24 of 121.

- [2026-08-26 (prefix-50 semantic coverage without action authority)](detailed/2026-08-26_2026-08-26.md) — Coverage `/4` measures 44 of 49 action-bearing steps and 308 of 320 pieces catalog-placeable, at covered prefix 29.
- [2026-08-26 (catalog `/27` measured admissions and shared connector capacity)](detailed/2026-08-26_2026-08-26.md) — Catalog `/27` adds `99563`, `73230`, `35464`, `49307`, raising the roster to 102 definitions and required-leaf intersection to 24 of 121.
- [2026-08-26 (proper source-frame infrastructure without truth drift)](detailed/2026-08-26_2026-08-26.md) — Generated tables now expose all 24 signed-permutation rotations to frame consumers; every saved document stays limited to the four upright yaws.
- [2026-08-26 (complete first-50 semantic identity closure)](detailed/2026-08-26_2026-08-26.md) — An opaque verifier closes semantic identity for all 187 first-50 callouts / 320 pieces, exact-matching an independent 320-piece parse.
- [2026-08-26 (bounded step-31/32 order reconciliation)](detailed/2026-08-26_2026-08-26.md) — Three reviewed identities falsify naive order cuts at steps 31/32; phases 49–54 repartition 180+4+10 quantities, conserving all 14 window identities.
- [2026-08-26 (exact source-art semantic transfer)](detailed/2026-08-26_2026-08-26.md) — An opaque-verifier compiler extends the semantic identity roster from 70/107 to 86/147 relations/pieces, leaving 101/173 residual.
- [2026-08-26 (sparse exact semantic identity cut)](detailed/2026-08-24_2026-08-24.md) — The legacy recut plus official quantity cut publish semantic identity for 70 compatible callouts / 107 pieces; three conflicts and recut n38 remain quarantined.
- [2026-08-25 (exact legacy-recut evidence bridge)](detailed/2026-08-24_2026-08-24.md) — Callout `/5`, current `/6`, and truth `/3` compile into a diagnostic retaining 73 positive relations / 113 pieces and 8 negative / 10 pieces; n25 and n38 crops refuse.
- [2026-08-25 (exact source-art rebound and bounded prefix-50 admission)](detailed/2026-08-24_2026-08-24.md) — Coverage `/3` preserves all 859 source rows while nulling 672 post-prefix identities; the prefix-50 ledger stays unpublished on 174 incomplete actions.
- [2026-08-25 (full-source, bounded-prefix reconstruction contract)](detailed/2026-08-24_2026-08-24.md) — Real-booklet publication preserves exactly 359 source/index rows behind one required identity/action prefix; run-contract `/4` binds the retained panel-source envelope.
- [2026-08-25 (fixed-8,192 proper-C4 render integration)](detailed/2026-08-24_2026-08-24.md) — 20 closures execute 800 physical renders for the current 100-orbit quotient; 60 more rerender 300 omitted members across 8 cameras, matching all 2,400 masks.
- [2026-08-25 (exact-three source packet and executable proper-C4 gate)](detailed/2026-08-24_2026-08-24.md) — A page-11 packet maps steps 1–3 to panels 2–4; the current `/26` proper-C4 gate closes 400 raw candidates into 100 exact four-member orbits.
- [2026-08-24–2026-08-25 (bounded caller-source panel projection)](detailed/2026-08-24_2026-08-24.md) — Vector/operator extraction fell 171 → 1 pages while keeping inference over 224 text pages / 359 labels; page 11's four joint panels are now materialized.
- [2026-08-24 (bounded scene reuse across step-1 camera hypotheses)](detailed/2026-08-24_2026-08-24.md) — One child scene now serves all eight hand/turn renders, cutting scene derive/dispose 8/8 → 1/1; a regression test pins peak live scenes at one.
- [2026-08-24 (authority-absent step-1 compiled-camera diagnostic)](detailed/2026-08-24_2026-08-24.md) — One unique offer retains 8 lineage edges from 1 compiler call / 8 renders for 64 camera branches; two offers retain 16 edges from 2 calls / 16 renders.
- [2026-08-24 (measured 78329 catalog growth and fixed-parent Gate-3 `/26` rebind)](detailed/2026-08-24_2026-08-24.md) — Catalog `/26` grows 97 → 98 definitions with Plate 1×5 `78329`; required-leaf coverage reaches 20 of 121, Gate 3 rebinds only its four immutable parents.
- [2026-08-24 (measured 33909 catalog growth and fixed-parent Gate-3 `/25` rebind)](detailed/2026-08-24_2026-08-24.md) — Catalog `/25` grows 96 → 97 definitions with asymmetric Plate 2×2 `33909`; required-leaf coverage reaches 19 of 121, all eight view pairs byte-identical.
- [2026-08-24 (measured 11212 catalog growth and focused Gate-3 `/24` rebind)](detailed/2026-08-24_2026-08-24.md) — Catalog `/24` grows 95 → 96 definitions with regular Plate 3×3 `11212`; required-leaf coverage reaches 18 of 121.
- [2026-08-24 (measured 32064 catalog growth and Gate-3 successor rebind)](detailed/2026-08-24_2026-08-24.md) — Catalog `/23` grows 94 → 95 definitions with Technic brick `32064`; required-leaf intersection reaches 17 of 121 identities.

- [2026-08-24 (measured 4519 catalog growth)](detailed/2026-08-24_2026-08-24.md) — Catalog `/22` grows 93 → 94 definitions with Technic axle `4519`; required-leaf intersection reaches 16 of 121 identities.

- [2026-08-24 (step-16 embedded source-art diagnostic)](detailed/2026-08-24_2026-08-24.md) — Three page-18/20 witnesses compared: part `3023`'s embedded art is identical; `35480` legacy/current differs by exactly four background rows.

- [2026-08-24 (measured 3040 catalog growth)](detailed/2026-08-24_2026-08-24.md) — Catalog `/21` grows 92 → 93 definitions with the 45-degree 1×2 slope `3040`; required-leaf intersection reaches 15 of 121 identities.

- [2026-08-24 (measured 2877 catalog growth)](detailed/2026-08-24_2026-08-24.md) — Catalog `/20` grows 91 → 92 definitions with the 1×2 grille brick `2877`; required-leaf intersection reaches 14 of 121 identities.

- [2026-08-24 (measured 41682 catalog growth)](detailed/2026-08-24_2026-08-24.md) — Catalog `/19` grows 90 → 91 definitions with the 2×2 bracket `41682`; required-leaf intersection reaches 13 of 121 identities.

- [2026-08-24 (3245-M variant geometry remains quarantined)](detailed/2026-08-24_2026-08-24.md) — Builder revision M measured against all three official `3245` surfaces: `3245c` best-fits at 0.391277 LDU RMS versus 1.081863 runner-up; result stays unresolved.

- [2026-08-23 (measured 15254 catalog growth)](detailed/2026-08-22_2026-08-23.md) — Catalog `/18` grows 89 → 90 definitions with the thin-top arch `15254`; required-leaf intersection reaches 12 of 121 identities.

- [2026-08-23 (measured 11253 catalog growth)](detailed/2026-08-22_2026-08-23.md) — Catalog `/17` grows 88 → 89 definitions with the roller skate `11253`; required-leaf intersection reaches 11 of 121 identities.

- [2026-08-23 (measured 35787 catalog growth)](detailed/2026-08-22_2026-08-23.md) — Catalog `/16` grows 87 → 88 definitions with the triangular tile `35787`; required-leaf intersection reaches 10 of 121 identities.

- [2026-08-23 (fixed-8,192 semantics-preserving step-7 carry)](detailed/2026-08-22_2026-08-23.md) — A source-observed run reproduces all 14,172 baseline rows / 17 leaves with 6,559 charged subject rasters; the required step-7 continuation stays at zero.

- [2026-08-23 (current-source step-7 workload denominator)](detailed/2026-08-22_2026-08-23.md) — Reproduces 14,172 narrowing-render rows / 30 batches / 17 leaves and the exact 8,037 + 599 > 8,192 production-shadow refusal; the 8,192 budget stays unchanged.

- [2026-08-22 (canonical protocol time and exact-five exchange semantics)](detailed/2026-08-21_2026-08-22.md) — Signed timestamps, signatures, and anchored ASCII scalars now have cross-engine canonical wire spellings; exact-five structural roots stay explicit, no new authority.

- [2026-08-22 (exact-one-use six-card Gate 0)](detailed/2026-08-21_2026-08-22.md) — Strict `/5` first-pass execution requires one held Windows executable launched atomically in a Job Object; the six-card pilot remains unrun, grants no authority.

- [2026-08-22 (all-359 source parity and authority-free exact-five receipts)](detailed/2026-08-21_2026-08-22.md) — The real booklet's 359-panel source stream has retained source-parity diagnostics at aggregate assembly IoU 0.9655; no production broker or reconstruction authority claimed.

- [2026-08-22 (detached browser-output `/4` evidence replay)](detailed/2026-08-21_2026-08-22.md) — A standalone reader cross-binds the 359-panel source stream, D4 camera roles, and evidence-derived reports; hostile inputs fail closed, no live producer exists.

- [2026-08-22 (exact multi-root compilation and branch-role finalization)](detailed/2026-08-21_2026-08-22.md) — One inspection-only atomic batch covers distinct root documents under one reservation and pre-admits every zero-frontier terminal shape; publishes only private storage.

- [2026-08-21 through 2026-08-22 (refusal-only branch semantic inspection)](detailed/2026-08-21_2026-08-22.md) — A local semantic consumer requires legacy observation state empty and rejects orphan source/camera tables before replay; genuine paths pass 1+1 work.

- [2026-08-14 (strict part-identification transport boundary)](detailed/2026-08-13_2026-08-14.md) — The writable legacy answer transport is retired after a model child created local files; 73 `/4` replies remain quarantined behind a disabled Gate-0 boundary.

- [2026-08-14 (measured 28802 catalog growth)](detailed/2026-08-13_2026-08-14.md) — Catalog `/15` grows 86 → 87 definitions with step-26's `28802` bracket; the contradictory Builder `10201` record remains counterevidence, ledger unchanged.

- [2026-08-14 (measured 25269 catalog growth)](detailed/2026-08-13_2026-08-14.md) — Catalog `/14` grows 85 → 86 definitions with the step-18 quarter tile `25269`; `28802` and fresh v6 adjudication remain open.

- [2026-08-14 (manifest-v6 callout correction)](detailed/2026-08-13_2026-08-14.md) — Separating duplicated printed-step-18 crops moves deterministic identification to 288 groups; fresh answers and ledger publication stay blocked by Claude OAuth 401.

- [2026-08-13 through 2026-08-14 (exact report authentication)](detailed/2026-08-13_2026-08-14.md) — Canonical replay refuses independently rehashed ledger evidence; it reproduces retained ledger bytes but exposes 97 validation failures, 48 records removed.

- [2026-08-13 (regenerated identification closure)](detailed/2026-08-12_2026-08-13.md) — The identification chain retains 273 of 285 prompt-bound Claude answers; the rebuilt action ledger aligns through step 25 with 44 trusted pieces before a `28802` mismatch.

- [2026-08-13 (member-safe identification refinement)](detailed/2026-08-12_2026-08-13.md) — Part identification refines legacy visual groups without cross-group movement, moving 269 groups to 285 and binding 67 callouts / 104 pieces; 15 verdicts stay inert.

- [2026-08-13 (unverified step-13 alignment diagnostic)](detailed/2026-08-12_2026-08-13.md) — A hostile-safe helper isolates the step-12-through-14 alignment question, indicating a synthetic step-13 `41539`/`3958` misidentification; inputs stay unauthenticated.

- [2026-08-13 (verified branch-byte reuse prerequisites)](detailed/2026-08-12_2026-08-13.md) — Browser branch-role inspection retains one verified copy and returns fresh per-step slices; prepared-run bytes now parse once for reusable lookups.

- [2026-08-13 (real exact-five source-locked execution)](detailed/2026-08-12_2026-08-13.md) — The real booklet produced one authenticated fixed-five publication; all ten native PNGs preserved their bound panel composition, review remains pending.

- [2026-08-13 (source-bound exact-five calibration publication)](detailed/2026-08-12_2026-08-13.md) — The five-panel capture reproduces against the PDF and full 359-row manifest, and publishes five roles plus ten content-addressed PNGs; human authority still absent.

- [2026-08-13 (source-stage parity and fail-closed calibration)](detailed/2026-08-12_2026-08-13.md) — Source-parity `/4` retains dense production/W/XOR diagnostics; a separate browser/Node path closes RGBA and lossless PNG bytes, every outcome remains needs-adjudication.

- [2026-08-13 (compiled observation replay and branch-role transport)](detailed/2026-08-12_2026-08-13.md) — Packed masks now reproduce optimal registration and camera-group selection under prepared thresholds; both paths remain inspection-only pending provenance.

- [2026-08-12 through 2026-08-13 (atomic compiled branch inspection)](detailed/2026-08-12_2026-08-13.md) — Eight empty-root proposals converge to one compiled child while retaining eight parent-specific lineage edges; browser `/3` still refuses step 1, not wired into the runner.

- [2026-08-12 (lineage and search prerequisites)](detailed/2026-08-12_2026-08-12.md) — A fresh four-yaw step-1/2/3 probe found no highlight and no step-1 winner, with truth ranked as low as 171; browser `/3` still refuses at the eight empty roots.

- [2026-08-12 (browser and artifact closure hardening)](detailed/2026-08-12_2026-08-12.md) — Reviewer-found gaps now reject forged hash-preserving zero-piece steps and zero-work blocked-row drift; the 10:28 run stays frozen, inspection-only.

- [2026-08-12 (live fail-closed camera boundary)](detailed/2026-08-12_2026-08-12.md) — Browser-output `/3` retains the canonical eight-way empty-root frontier and refuses step 1 until scoring carries lineage; the 10:28 run stays legacy inspection-only.

- [2026-08-12 (source-attested extraction)](detailed/2026-08-12_2026-08-12.md) — Real-build runner/artifact/report-parser/safety boundaries were split below their line ceilings; LF checkout rules make the 3,087-file source attestation reproduce from Git.

- [2026-08-12 (panel-camera resolver and fixed-action refusal)](detailed/2026-08-12_2026-08-12.md) — A pure resolver reserves eight hash-bound camera lineages atomically, granting no physical authority; the fixed-action seam returns `fixed-ledger-frame-unresolved`.

- [2026-08-12 (panel-camera observation prerequisites)](detailed/2026-08-12_2026-08-12.md) — Panel-bound registrations preserve stable document candidates and transform one q0 arrow family through exact D4; document-camera pairs admit atomically, no hand chosen.

- [2026-08-12 (handedness primitive)](detailed/2026-08-12_2026-08-12.md) — Determinant-aware silhouette registration measures all eight camera hand/turn hypotheses; a chiral fixture selects x-reflected turn 90 at IoU 1 versus about 0.476 proper.

- [2026-08-12 (target audit)](detailed/2026-08-12_2026-08-12.md) — Deterministic finalization exhausts proper upright target frames; the measured prefix is uniquely proper through step 2, then step-3 `6106` leaves only an x-reflection diagnostic.

- [2026-08-12 (latest)](detailed/2026-08-12_2026-08-12.md) — Panel-7 scoring moved the visual-search diagnostic from step 4/6 pieces to step 5/8 pieces at 0.816572 vs. 0.936752; review proved it a global x reflection, not an official-frame model.

- [2026-08-11 (latest)](detailed/2026-08-11_2026-08-11.md) — The production farther driver now retains both step-5 parents and their 5+3 complete step-6 leaves, then atomically refuses the next narrowing batch at 8,037/8,192 renders; the verified prefix remains four printed steps.

- [2026-08-11](detailed/2026-08-11_2026-08-11.md) — Final adversarial review made review batches rebind every image/outcome and required explicit LDraw BFC certification; every new generated table split below its line ceiling.

- [2026-08-11](detailed/2026-08-11_2026-08-11.md) — Catalog `/13` closed all 192 native-resolution pairs as `same`; verified prefix advanced 3 → 4 printed steps, though a step-7 probe needed 8,609 renders against the 8,192 budget.

- [2026-08-10](detailed/2026-08-10_2026-08-10.md) — Twelve official-root render promotions closed `parts:check` 12 → 0 and moved catalog `/12` → `/13`; all 24 mesh tables now reproduce source triangles and normals.

- [2026-08-10 (later)](detailed/2026-08-10_2026-08-10.md) — A quarantined N/N+1/conditional-K checker binds source/render bytes and preflight budgets; 56 mocked cases pass, but the first live call stopped at expired OAuth.

- [2026-08-10](detailed/2026-08-10_2026-08-10.md) — Four first-witness parts render their expanded LDraw surfaces: `parts:check` fell 16 → 12, catalog `/11` → `/12`; a replay showed green vision narrowing can drop the settled answer.
- [2026-08-09 (later)](detailed/2026-08-09_2026-08-09.md) — Mesh-backed parts gained measurable geometry modes: `parts:check` fell 24 → 16, geometry-mode gaps 8 → 0, and the catalog moved /10 → /11; the remaining 16 underside gaps are measured, and `parts:check` is still outside `verify`.
- [2026-08-09](detailed/2026-08-09_2026-08-09.md) — Real shells reached 58 parts: `parts:check` fell 137 → 24, hollow-body gaps 56 → 0, underside gaps 73 → 16, and catalog /9 → /10; the booklet prefix stayed 5/5 steps and 8 pieces, with 3 printed steps visually verified.
- [2026-08-09](detailed/2026-08-09_2026-08-09.md) — Clutch backing was corrected to test cavity clearance, grip, and seating; the 2×4 plate gained a measured shell, `parts:check` moved 139 → 137, tube outer radius was confirmed as 8 LDU, and catalog /8 → /9 without changing placements.
- [2026-08-08 (night)](detailed/2026-08-08_2026-08-08-night.md) — Order-free lattice pairs plus strongest-peak ranking raised step-6 agreement 0.4482 → 0.8837 past the 0.85 bar; synthetic recovery improved 476 → 532 and mis-fits fell 83 → 53, while the next ambiguity remained 0.8837 versus 0.8804.
- [2026-08-08 (evening)](detailed/2026-08-08_2026-08-08-evening.md) — Open-contour lookahead made step 6 score after 4,187 renders, exposing a camera defect at 0.4482 agreement; four plausible lattice rankings were measured and rejected.
- [2026-08-08](detailed/2026-08-08_2026-08-08.md) — Open contours moved placement scoring from filled area to printed stroke: 374 and 174 placements were swept, winning margins were 0.6347/0.4962 and 0.2428/0.1854, and the prefix advanced to 5 steps and 8 pieces.
- [2026-08-08](detailed/2026-08-08_2026-08-08.md) — The step-4 camera was corrected for underside face and quarter turn; anchor agreement became 0.903118, 0.889836, and 0.831192 through panels 2–4, advancing the prefix to 4 steps and 6 pieces.
- [2026-08-08](detailed/2026-08-08_2026-08-08.md) — Step 4's second near-tie was reclassified as deferred at 0.2734539 versus 0.2723737, a 0.0010802 margin below the 0.02 noise floor; panel 5 then exposed an open-contour limitation.
- [2026-08-08](detailed/2026-08-08_2026-08-08.md) — A camera refusal had reported the loser's 9.11 px residual; the corrected fit is 0.474% of pitch after 220 candidate renders, while the placement still defers on a roughly 0.0011 score margin.
- [2026-08-08](detailed/2026-08-08_2026-08-08.md) — Vision-derived claims were split from evidence: 14/15 kept IDs survived review, 17 weak claims refused; the run through step 8 placed 26 pieces with zero hard failures.
- [2026-08-08](detailed/2026-08-08_2026-08-08.md) — Builder frame calibration admitted `3020`: resolved prefix connectors rose 16/18 → 18/18, export agreement 39/40 → 42/43, the source bundle grew to 1,091,772 bytes, and LDraw closure to 102 files.
- [2026-08-07](detailed/2026-08-06_2026-08-07.md) — The widened vision reply gained a consumed observations report and gate: 7/9 answer fields affect pipeline claims, `note` and `confidence` remain report-only, and bounded re-asks may remove but never create trust.
- [2026-08-07](detailed/2026-08-06_2026-08-07.md) — The obsolete candidate lab and harness were deleted: 41 files and 6,954 lines removed, workspaces 8 → 6, while the companion run recorder and its two legacy input schemas stayed because they still have a consumer.
- [2026-08-07](detailed/2026-08-06_2026-08-07.md) — Dead acceptance-envelope schemas were removed without changing saved-document truth: protocol roots fell 29 → 27, interfaces 87 → 85, and the generated validator 51,334 → 49,313 lines.
- [2026-08-07](detailed/2026-08-07_2026-08-07.md) — Three byte-comparison gates now report the semantic values or first differing line instead of presenting identical hashes as a moved value.
- [2026-08-07](detailed/2026-08-07_2026-08-07.md) — Tracked ignore rules closed the nested-worktree hole: a fresh clone offered 315 files before the rule and 0 after it, while lint avoided traversing 976 unrelated files.
- [2026-08-07](detailed/2026-08-06_2026-08-07.md) — The step-2 refusal report was disproved at HEAD; the actual defect was an empty-stroke test that let a spilling candidate score 0.5968 over the contained candidate's 0.5806, and the test now fails under both bad rankings.
- [2026-08-07](detailed/2026-08-06_2026-08-07.md) — `learning-system.md` was rewritten around the booklet loop, shrinking 1,186 → 420 lines and deleting 391 dead TypeScript lines while preserving live run-state and replay contracts.
- [2026-08-07](detailed/2026-08-06_2026-08-07.md) — The AI-copilot generation product was cut from `spec.md`, reducing it 561 → 383 lines and replacing a document that mentioned the booklet zero times with the implemented product boundary.
- [2026-08-07](detailed/2026-08-06_2026-08-07.md) — Printed step 1 placed 2/2 bricks after fixing mirrored Builder world transforms; impossible stud coincidences fell 64/65 → 0/0, with settlement coming from step 2's panel.
- [2026-08-06 (late)](detailed/2026-08-06_2026-08-07.md) — Rotate-icon extraction rose 39 → 43 and the face fold reached 43/43 against 7/43 before the fix; corrected Builder world transforms then let printed step 1 place 2/2 pieces.
- [2026-08-06 (evening)](detailed/2026-08-06_2026-08-06-evening.md) — Applying panel face at render time rebuilt 6/6 placements against 5/6 face-blind, and the real browser harness advanced until step 1 exposed four arrow-compatible candidates that its own panel could not rank.
- [2026-08-06](detailed/2026-08-06_2026-08-06.md) — Component-based inventory crops raised shortlist recall 0.88 → 1.000, placement was reframed as search, and immutable backtracking began reporting reversals, deepest reach, and withheld alternatives.
- [2026-08-05](detailed/2026-08-05_2026-08-05.md) — Eight measured parts expanded the catalog 77 → 85, blind judging reached 84/84 agreement, build-input failures fell 92 → 62 → 12, and retrieval recall@6 measured 96.0%.
- [2026-08-04](detailed/2026-08-03_2026-08-04.md) — A false Git-write blocker had stranded about 4,000 approved lines; exact oriented-box truth found 598 missed disagreements, and Builder collision was rejected after real geometry escaped its boxes by up to 4.675 LDU.
- [2026-08-03](detailed/2026-08-03_2026-08-04.md) — The 6651557 source-route audit resolved 117/121 leaves across 439 files and 896,002 bytes; the metadata artifact stayed below the 256 KiB ceiling at 251,402 bytes, and Python tests joined `verify`.
- [2026-08-02](detailed/2026-08-01_2026-08-02.md) — Adversarial review removed inert panel-fit proof after noise scored a 1.000 hit rate; global assignment named 1,308/1,465 parts, and analytic arc parts raised the catalog to 77.
- [2026-08-01](detailed/2026-08-01_2026-08-02.md) — The closed loop rebuilt 6/6 parts after fixing an insertion-order assumption in the probe; physics also gained a usable ground slab after the original 20 µm slab let bricks fall through.
- [2026-07-31](detailed/2026-07-30_2026-07-31.md) — Booklet sequence coverage reached 359/359, and separating 1,480 inventory tokens corrected the step-callout total 3,102 → 1,622; visual review also disproved vector-art and 6 px stud-pitch assumptions.
- [2026-07-30](detailed/2026-07-30_2026-07-31.md) — The editor gained lattice placement, click-to-place, and build steps while catalog truth moved /1 → /3; UI driving found five defects, and the first 224-page, 67 MB booklet parse took about 20 seconds.
- [2026-07-22](detailed/2026-07-09_2026-07-22.md) — `AGENTS.md` adopted the lean fleet form (160 lines removed, 64 added), exposing the unresolved conflict between the 1 MiB Git ceiling and the tracked 1.53 MB generated validator.
- [2026-07-14](detailed/2026-07-09_2026-07-22.md) — The coherent-unit commit rule was recorded five days after the 31,794-line commit that motivated it; no executable behaviour changed.
- [2026-07-12](detailed/2026-07-09_2026-07-22.md) — Headless-first became mandatory, with a stated reason required before any visible browser or GUI path; no executable behaviour changed.
- [2026-07-11](detailed/2026-07-09_2026-07-22.md) — The brick-assembly-loop skill moved into repository ownership in a 32-line chore; no product behaviour changed.
- [2026-07-10](detailed/2026-07-09_2026-07-22.md) — Three scoped-patch authority bypasses were closed 72 minutes after shipping, compiler truth moved /1 → /2, and the generated validator grew 418 KB → 1.53 MB.
- [2026-07-09](detailed/2026-07-09_2026-07-22.md) — A 1,909-line design preceded the 31,794-line, 85-file Gate 0/1 drop; 24/29 commits in the range had empty bodies, so the history had to be reconstructed from diffs.
