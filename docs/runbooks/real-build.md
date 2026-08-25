# Real-booklet build runbook

This runbook operates the retained set 6651557 reconstruction. It is developer-only experimental tooling: it does not drive the web studio's **Instructions** control, contact a production companion, or apply a patch to a user's document.

The current measured result and next blocker belong only in [building-system.md](../design/building-system.md). Keep this file about reproducible operation.

## Prerequisites

Run every command from the repository root after completing the [README setup](../../README.md#requirements-and-setup).

The uncommitted, gitignored source booklet must be available as `recipes/6651557.pdf` in this checkout or a parent checkout that the test fixture can discover. Never commit the booklet.

The probe also consumes retained callout, identification, official-model, Builder-geometry, transition, coverage, calibration, compatibility, and action-ledger inputs. Regenerable inputs live under ignored paths; the blind pair-judging truth at `scripts/fixtures/part-identification-truth-first50.json` is a tracked evidence input because it cannot be reconstructed from the booklet alone. Authoritative defaults and override variables are declared in `apps/web/e2e/real-build-input-files.ts`; a missing or stale input is a named refusal, not permission to substitute data.

## Regenerate measured catalog tables

This is a separate authoring chain from the Playwright build inputs below. It needs the two byte-pinned LDraw archives, the pinned LDCad shadow-library checkout, and the private checksum-pinned Builder native pack. Source payloads and derived reports remain ignored; the metadata-only source audit at `packages/catalog/src/quarantine/set-6651557-ldraw-source-audit.generated.json` is the tracked repository input that binds the LDraw closures. The source payloads are pinned by bytes or commit, and each derived report validates and binds the exact inputs it consumes.

Generate the source pilot first, then derive the Builder-to-LDraw frame from that exact pilot:

```powershell
$officialArchive = "C:\tmp\ldraw-complete-2026-07.zip"
$unofficialArchive = "C:\tmp\ldraw-unofficial-2026-08-02.zip"
$nativePack = "C:\tmp\lego-21066-builder-native-part-pack.json"

New-Item -ItemType Directory -Force output/real-build | Out-Null
python -B scripts/generate-set-6651557-source-pilot.py --official $officialArchive --unofficial $unofficialArchive --native-pack $nativePack --source-audit packages/catalog/src/quarantine/set-6651557-ldraw-source-audit.generated.json --output output/real-build/set-6651557-source-pilot.json
python -B scripts/derive-builder-ldraw-frame.py --official $officialArchive --unofficial $unofficialArchive --native-pack $nativePack --pilot output/real-build/set-6651557-source-pilot.json --output output/real-build/set-6651557-builder-ldraw-frame.json
```

Then remeasure, score, canonicalize, and compare the generated catalog outputs. The generator owns 16 tracked outputs: the mesh registry, seven bounded measured mesh shards A through G, one render-only mesh shard, the measured blueprint root plus bounded D through G shards, one render-only blueprint shard, and the bundled-source table. The render-only generated type cannot carry connector, allowance, or collision truth. `--check` runs the workspace-pinned Prettier and refuses any byte drift, while report schema `/6` records 25 measured-pipeline rows and 12 dedicated render-only-pipeline rows, binds the exact pilot and Builder-frame inputs, records optional source-bounded connector rows such as the three discrete `4519` axle seats, the single transverse `32064` axle-hole seat, and the nine-stud/nine-clutch `11212` lattice, and retains the optional validated-connection stud profile without weakening ordinary collision. Four of those measured-pipeline rows are final catalog render-only promotions whose earlier physical authority is overlaid by the catalog factory, so the catalog result is twenty-one fully measured definitions plus sixteen render-only promotions rather than the report's generation-path 25/12 split. The `32064` axle-hole row remains a discrete structural endpoint with no continuous axial authority. The `11212` row comes only from exact `p/stud.dat`, `p/stud4.dat`, and `parts/11212.dat` shadow routes; exact source-radius cylinders remain ordinary collision, while nominal radius 6 applies only to exact validated edges. The `33909` row binds the 9-file, 10,203-byte official closure rooted at `parts/33909.dat` (`sha256:8da6789db82746f179997ed4b917d00d34d03a6486d6aa27c76d17c9b21d8609`) with closure manifest `sha256:72174370ab6b3d2e0d00d7b72a0687a67da1cccd4014f1f799e113eecb504a15`, 220 triangles over 242 vertices, exact body bounds `[-20,-4,-20]..[20,4,20]`, visual bounds `[-20,-8,-20]..[20,4,20]`, the exact connector route through `p/stud.dat`, `p/stud4.dat`, and `parts/33909.dat`, two studs at `[-10,-4,10]` and `[10,-4,10]`, four clutches at x/z `±10`, y `4`, and 41 body boxes plus two exact source-radius stud cylinders. Its score is `0.9955832518073061` with zero hard failures, four of four clutch-room probes, zero outside containment points, and six of six lattice probes; revision-E metadata is count-only corroboration because it has no reviewed frame. The `78329` row binds the 9-file, 8,761-byte official closure rooted at `parts/78329.dat` (`sha256:79ec75c5092750b0f2022dab9c7561376d8b2b33fc3dea7059081ef273d4f7fc`) with closure manifest `sha256:d203ae681cfa3842e210b894d46e69e555e64e638796d260c3a2cabdb474f283`, 460 triangles over 489 stored vertices, exact body bounds `[-10,-4,-50]..[10,4,50]`, visual bounds `[-10,-8,-50]..[10,4,50]`, orientation `upright-yaw-90` plus translation `[0,-4,0]`, the exact connector route through `p/stud.dat`, `p/stud3.dat`, and `parts/78329.dat`, five studs at `[0,-4,z]` and five clutches at `[0,4,z]` for z `[-40,-20,0,20,40]`, and 39 body boxes plus five exact source-radius stud cylinders. Its score is `0.9968390298840539` with zero hard failures, five of five clutch-room probes, zero outside containment points over 659,766 samples, and ten of ten lattice probes. The current `/26` catalog has 98 definitions: 77 retain project-authored physical recipes and 21 are fully measured; 37 mesh closures comprise 211 unique source files, of which 209 declare CC BY 4.0 and two select the CC BY 4.0 option from dual declarations; thirteen fully measured connector routes come from LDCad. [Part-model catalog truth](../design/part-model.md#current-catalog) owns the current `/26` counts, mesh deltas, and migration interpretation.

```powershell
$shadowLibrary = "C:\tmp\ldcad-shadow-20260802"

python -B scripts/emit-measured-part-tables.py --official $officialArchive --unofficial $unofficialArchive --shadow $shadowLibrary --pilot output/real-build/set-6651557-source-pilot.json --builder-frame output/real-build/set-6651557-builder-ldraw-frame.json --report output/real-build/set-6651557-measured-part-emission-check.json --check
```

For an intentional catalog-truth update, run the final command once without `--check`, review all 16 generated TypeScript diffs, and rerun it with `--check`. Never hand-edit `mesh-assets-6651557.ts`, its `mesh-assets-6651557-measured-{a,b,c,d,e,f,g}.ts` and `mesh-assets-6651557-render-only.ts` chunks, `part-blueprints-6651557-measured.ts`, its `part-blueprints-6651557-measured-{d,e,f,g}.ts` shards, `part-blueprints-6651557-render-only.ts`, or `ldraw-bundled-sources-6651557.ts`.

The retained historical `/24` instrument control is the ignored 203,106-byte schema-`/6` check report at `output/real-build/set-6651557-measured-part-emission-v24-check.json`; it reproduces all 16 generated files with `written:false` at `sha256:7aeccd85ad90106af16eb5c152a93162e3cb22be1793731e75673d1d02f45719`. The retained historical `/25` instrument control is the ignored 210,666-byte schema-`/6` check report at `output/real-build/set-6651557-measured-part-emission-v25-check.json`; it reproduces all 16 generated files with `written:false` at `sha256:5a358bee3beb3f7181cac34fd0703c2f7521c08393a7139ba2f363fa81fe37b9`. Its separate historical initial write report is 210,653 bytes at `sha256:af2bec62a01a69212b57bc403f536957e942ad1e4613253da2807bdf03009354`. The initial `/26` write report is the ignored 219,309-byte schema-`/6` report at `output/real-build/set-6651557-measured-part-emission-v26.json`; it records generated files with `written:true` at `sha256:56cea66dcd26f4eceda2a63efbf500144106c1db028d5e1c0d259413edde48de`. The current `/26` instrument control is the ignored 219,322-byte schema-`/6` check report at `output/real-build/set-6651557-measured-part-emission-v26-check.json`; it reproduces all 16 generated files with `written:false` at `sha256:7c71d75f3d8f2388fbd83a01bbc74aabc6eeb8345c910e1f54bc8d05893b3f22`, retains all 25 measured-pipeline and 12 render-only rows, and has no hard-failing part. Each report's `sampleSpacingLdu` field remains the backward-compatible requested-spacing alias; the additive requested, maximum-effective, 256-subdivision-limit, and cap-limited-triangle fields disclose the grid actually sampled without changing the pinned older report envelopes. Those reports are generator evidence, not independent source, catalog, physical, or build authority.

## Run the retained build

The real build is skipped during ordinary Playwright runs. Set `LEGO_REAL_BUILD_REQUIRED=1` to enable it. `LEGO_REAL_BUILD_LAST_STEP` is optional, defaults to 12, and must be an integer from 1 through 359; choose the range needed for the experiment rather than copying a frontier into this runbook.

```powershell
$env:LEGO_REAL_BUILD_REQUIRED = "1"
$env:LEGO_REAL_BUILD_LAST_STEP = "12"
npx.cmd playwright test apps/web/e2e/real-build.spec.ts
Remove-Item Env:LEGO_REAL_BUILD_REQUIRED -ErrorAction SilentlyContinue
Remove-Item Env:LEGO_REAL_BUILD_LAST_STEP -ErrorAction SilentlyContinue
```

### Run the source-parity diagnostic

This is a separate calibration-only probe, not the retained build. It is intentionally expensive and dense: when enabled it processes all 359 prepared steps and five production/candidate mask classes rather than honoring `LEGO_REAL_BUILD_LAST_STEP`. The real-booklet command completed on 2026-08-22 with all 359 rows, measurement digest `sha256:39a810d8a30f28fb93bb619f2ce522ce01e95146e8fe14666d6606270c0cb615`, 3,759,314 capture bytes, 38,593,159 packed-evidence bytes, and 116,474,520 provenance bytes; these numbers are calibration evidence, not build progress or authority.

The stage convention is H for the high-resolution cleaned-art mask, P for high-resolution isolation followed by downsampling, D for the downsample-then-isolate counterfactual, and W for the independently derived work-raster candidate. The exact-byte stage trace retains H/P/D and intermediate masks but marks source provenance opaque; source-parity `/4` separately retains production, W, and XOR evidence for assembly, own-panel source, own-panel exclusion, built, and exclusion across the dense sequence.

Run only when the ignored booklet and prepared inputs are current and you deliberately want the full diagnostic:

```powershell
$env:LEGO_REAL_BUILD_REQUIRED = "1"
$env:LEGO_REAL_BUILD_SOURCE_PARITY = "1"
npx.cmd playwright test apps/web/e2e/real-build-observation-source-parity.spec.ts
Remove-Item Env:LEGO_REAL_BUILD_SOURCE_PARITY -ErrorAction SilentlyContinue
Remove-Item Env:LEGO_REAL_BUILD_REQUIRED -ErrorAction SilentlyContinue
```

The publication binds the exact PDF and full prepared-panel digest, bootstrap source lock, execution mirror, served responses and retrievable served-source bundle, runtime and checkout identity, browser-result bytes, packed evidence, PNG diagnostics, and contained atomic output. Its work-RGBA, candidate-policy, and candidate-derivation browser commitments are explicitly opaque and not independently reproduced; the point-sampled source-RGBA column is visualization-only and cannot reconstruct source pixels.

**This command cannot choose truth, authorize a candidate, or advance a build.** The fixed calibration foundation only inspects steps/pages 90/79, 101/87, 346/213, 358/218, and 359/219. A packet that claims human review remains an unverified external-review claim, and absent truth, drift, W difference, and exact W equality still return `needs-adjudication`. A separate request inspector can reproduce exact publication-derived W equality, derive the expected review-presentation digest, and retain an authority-absent private request. A bounded receipt inspector can verify canonical Ed25519 bytes against supplied trust snapshotted before one fresh local challenge, exact request/scope/review-presentation bindings, current ordered times, and a recomputed event/root transition from the supplied ledger checkpoint, but its result also has authority absent; process-local replay state fails closed after 64 concurrent inspections or 4,096 retained successes and is not durable consumption. Production admission delegates to an asynchronous external event seam and always refuses because no released broker or authenticated production pairing/key/checkpoint source can create its module-owned runtime event capability. The optional high-RGBA snapshot protects retained storage only. No calibration path can enter the live runner, document mutation, or completion.

The separate exact-five command exercises only those five rows. Its current spec reconstructs the bounded browser wire in Node and closes exact high/work RGBA, H/P/D/W, pairwise facts, and ten lossless PNGs, then publishes only after the exact browser capture reproduces against the PDF, full 359-row prepared manifest, source snapshot, provenance, served source, checkout, and runtime closure. The publisher derives the execution identity internally as audit data, writes the capture manifest, full manifest, five roles, ten PNGs, and provenance beneath `output/playwright/real-build-source-calibration/runs/<identity-hash>/`, and atomically replaces `output/playwright/real-build-source-calibration/summary.json` last. The retained reader reopens every byte class and reproduces that identity. The summary remains `pending-unreviewed` with authority absent; it is not a human review, bearer capability, calibration admission, browser-output `/4` result, or document authority. The real-booklet exact-five opt-in was executed on 2026-08-13 and retained under audit-only execution identity `sha256:979157ed12ef36fcd59a85aba13268d56a47d77ee886070cd31221805d756462`; this does not admit the dense 359-step probe. Tests can replace the unavailable event seam with a request-bound one-use future-broker mock to exercise the private admission consumer, including version, event-identity, sequential-replay and reentrant-replay refusal; that mock is not a production authority source.

```powershell
$env:LEGO_REAL_BUILD_REQUIRED = "1"
$env:LEGO_REAL_BUILD_SOURCE_PARITY_CALIBRATION = "1"
npx.cmd playwright test apps/web/e2e/real-build-observation-source-parity-calibration.spec.ts
Remove-Item Env:LEGO_REAL_BUILD_SOURCE_PARITY_CALIBRATION -ErrorAction SilentlyContinue
Remove-Item Env:LEGO_REAL_BUILD_REQUIRED -ErrorAction SilentlyContinue
```

### Inspect a detached browser-output `/4` tuple

Browser-output `/4` currently has a standalone Node reader and synthetic fixtures, not a live producer or command that runs the booklet. The reader first verifies that the captured synchronous derivation/replay primordials are unchanged, snapshots an exact closed data-only outer input, then requires the prepared-run bytes, branch index plus compiled/observation roles, a finished 359-panel streamed source-evidence inspection and its manifest, D4 camera manifest/render/mask roles, and the zero-piece transition manifest. Source records and arrays reject Proxies, and each streaming session reserves its current sequential step before byte-copy or derivation work and releases the reservation in `finally`. Camera manifests use closure-local ranges plus ordered run-wide mask-role bases, so exact range-and-descriptor aliases and source-only closures remain reproducible across multiple placement steps without cross-step overlap. The reader verifies every role digest and cross-binding, refuses any reported panel whose exact prepared input still contains coverage failures, unresolved callouts, or missing designs, replays selected placement and transition frontiers, exact-projects reports with neutral legacy visual fields and replay-neutral zero timing, derives missing-role and terminal failures from retained evidence, and requires identity bindings and the terminal canonical document to equal the induced prefix. A failed tuple with no report is refused before external role work because no retained role reproduces its caller-authored outer error; empty-prefix input rejection remains unavailable until a separate typed digest-bound witness exists.

Run the focused synthetic contract with:

```powershell
npx.cmd vitest run real-build-browser-output-v4
```

The returned inspection is reproducible evidence only. It labels source-render execution provenance, provisional identity, physical frame, placement and completion authority absent; completed fixed-ledger and `multi-build-copy` reports refuse until separate physical-frame authority and deterministic fixed-action replay exist. Do not relabel a synthetic `/4` tuple as a real-booklet run, and do not replace the public `/3` runner output with `/4` until the private producer and independent Node reproduction are both green.

### Panel-camera roots are live; positive placement lineage remains refused

The repository has a pure `LatticeHand` view transform and `anchorStepCameraLatticeFrame` measurement primitive. It scores four as-fitted quarter turns and four x-reflected quarter turns, retains a separate translation for every hypothesis, and returns `camera-handedness-unresolved` instead of selecting by enumeration order when the best exact score spans both hands. `RealBuildPanelCameraRegistration` validates, copies, and deeply freezes `{latticeHand,latticeDeterminant,registrationPanelStepNumber,turnDegrees,shiftPx}` as panel-local raster evidence and never as physical-transform authority. `resolveRealBuildPanelCameraBranches` detaches and canonicalizes the document, verifies its claimed digest, copies both masks, checks the shared ledger around hash and render callbacks, requires the registering panel to be strictly later than the prefix for observations, and atomically reserves complete eight-way angular families. Step 0 produces eight unregistered seeds with null observation and shift; a nonempty prefix retains all attempts and successful observations under one hash-bound `candidateId`, unique `lineageId` values, and explicit parents, while a thrown or malformed render leaves selection null. The arrow boundary derives q0 exactly once from panel-bound fit and raw measurement, then applies the integer D4 transform without reordering the family or changing travel and off-line tolerances. Every result leaves physical-frame authority unresolved.

When every retained input closure is current enough to reach the browser driver, the live `/3` path creates the exact canonical empty document, reserves all eight step-0 D4 roots against the run's cumulative branch budget, retains them in report 1, and intentionally refuses printed step 1 before any placement callback because scoring is not yet carried through those immutable lineages. The ignored defaults inspected on 2026-08-22 stop earlier: `output/part-identification/answers-claude-opus-5.json` is absent and the retained coverage chain binds superseded callout/features/match/distances/cards inputs, so the command returns `coverage-closure-unbound` without invoking the browser driver. Regenerate the authorized identification → coverage → calibration → ledger chain before expecting the eight-root refusal; never describe a stale-input rejection as that later live result. The `/3` reader exact-binds every action and evidence digest to its prepared panel, bounds terminal `documentJson` by encoded size, nesting, structural nodes, steps and parts, parses it once, and binds the terminal document to accepted hash and part continuity, global validity, ordered accepted `BuildStep` ID/index/semantic-name/owned-part facts, canonical root ownership, metadata and manual provenance. Fixed-ledger omissions and `multi-build-copy` runner call sites pass through `executeRealBuildFixedActionWithPhysicalAuthority` before their executor; every current decision returns typed `fixed-ledger-frame-unresolved` because no trusted producer can mint the required opaque physical-frame authority. Running the command therefore neither repairs nor supersedes the retained mirrored diagnostic.

A zero-piece printed transition is not permitted to masquerade as a hash-preserving omission. It advances continuity only when the terminal document contains exactly one empty canonical `BuildStep` at that index, its semantic name and report fields match the prepared transition, its independently recomputed validation tuple is globally valid, its target prefix changes the structural hash without changing the part count, and the camera frontier remains unselected. Missing, duplicate, unvalidated, hostile, or forged no-op witnesses are rejected.

Nested panel-camera evidence uses schema `/2`. Its measurement commitment binds the prepared PDF digest, page/crop/face, exact retained panel and candidate capture digests, camera, raster dimensions, built/excluded/render-mask digests, silhouette score, centre, shift, hand, determinant, and turn. It does not retain the exact mask bytes, so replay cannot independently recompute the score and the browser-output verifier rejects any positive-piece completion that tries to treat this measurement as authority.

The current lineage cutover is additive and fail-closed. Central `document:sha256:*` candidates and parent-bound `lineage:sha256:*` identities, bounded lineage-evidence `/1`, scalar and convergent-frontier camera adapters, exact canonical document snapshots, a normalized farther DAG, prepared-step/search inspection, a private budget ledger, and a restricted automatic placement compiler are implemented. Public bytes or proposal inputs cannot mint prepared-step, search-batch, transition, farther-frontier, scored-panel, completion, or acceptance authority. The automatic compiler atomically replaces only the exact empty step-1 bootstrap or appends one contiguous `BuildStep`, compiles its detached placement program twice to bind final candidate provenance, and independently replays the combined transition under hard validation. All three whole-transition passes are preflight-bounded; the ordinary `CompilationResult` cannot place anything in the current runner by itself.

The ignored `output/build-search/step1-deferral.json` probe is a diagnostic counterexample, not a golden input. In the fresh 2026-08-12 run, step 1 contained no detected highlight region or stroke and all four enumerated proper-yaw candidates scored 0. Each truth rotation admitted 100 step-2 continuations with gauge IoU 1, but its rank at panel 2 was 35, 31, absent after proximity, and 24; at panel 3 it was 9, 171, 115, and 92. The retained panel, silhouette and branch PNGs were visually inspected together. Every branch exceeded that probe's render allowance, and the probe did not enumerate the reflected D4 hand, so it demonstrates why existing later-panel scores cannot authorize the first placement rather than resolving it.

Before asynchronous module or PDF preparation, the runner deep-detaches the complete JSON-like run input, including panels, order and page bindings, digests, accounting, coverage, and budgets. It re-snapshots the caller input after preparation and refuses any drift before raster, search, or placement, globally sorts the detached panels by printed step, and asserts the next contiguous step before rasterizing its page. Pages are rendered on demand. Module, page, PDF-document, and loading-task failures use bounded diagnostics that do not invoke hostile formatting hooks; a page-render failure retains the exact preceding document and one causally blocked row for every later request, and cleanup failure returns typed failed output without erasing completed reports, document bytes, or input digests.

The synthetic chiral regression selects x-reflected turn 90 at shift `[17,-23]` with IoU 1, versus about 0.476 for the best proper-hand hypothesis. A symmetric 2x4 plate reaches IoU 1 in both hands and is refused with all eight attempts retained. These are binary-silhouette measurements only: reflection reverses depth, so they do not establish RGB or occlusion equivalence and do not authorize a physical document branch.

Exercise only that bounded primitive with:

```powershell
npx.cmd vitest run apps/web/src/assembly/panel-face.test.ts apps/web/test/real-build-step-camera.test.ts apps/web/test/real-build-step-camera-handedness.test.ts apps/web/test/real-build-panel-camera-registration.test.ts apps/web/test/real-build-panel-camera-arrow-evidence.test.ts apps/web/test/real-build-panel-camera-branches.test.ts apps/web/test/real-build-panel-camera-resolver.test.ts apps/web/test/real-build-panel-camera-frontier.test.ts apps/web/test/real-build-panel-camera-evidence.test.ts apps/web/test/real-build-browser-output-v3.test.ts apps/web/test/real-build-run-panel-camera-cutover.test.ts apps/web/test/real-build-run-fixed-actions.test.ts apps/web/test/real-build-fixed-frame-authority.test.ts
```

The default output root is `output/real-build`. Once an eligible artifact closure verifies, publication writes an immutable run under `<output-root>/runs/<run-id>/` and atomically updates `<output-root>/runs/current.json`. Current publication requires the exact tuple artifact-manifest `/4`, run-contract `/3`, browser-output `/3`, and result/score `/5`, and the replay closure must be `downstream-only` from browser output. Both the writer and verifier intentionally refuse metadata-only or input-rejection closures because they retain no typed digest-bound witness from which Node can reproduce the exact rejection and score; do not treat a caller-authored `source-drift-detected` summary as publishable evidence until that witness exists. No production run has yet been published under the current tuple. An interruption, ineligible boundary, or artifact-verification failure before publication must not replace the pointer. `LEGO_REAL_BUILD_OUT` may redirect the published run only to another traversal-free descendant of `output/`; it does not redirect the retained inputs listed above.

### Read frozen bounded farther-panel evidence

The retained browser-output `/2` driver recorded a bounded branch proof on the origin row's `farther` field when an own-panel ambiguity survived N+1. `origin` retains every step-N candidate with its structural hash, exact atomic piece witnesses, cached N+1 agreement and registration shift; `carries` records every parent-child lineage and intervening-step cost; `panels` records only panels actually scored; `budgets` records shared offered-candidate, narrowing-render, panel-render and reach use plus any refused reservation; and `refusal` or `decision` records the outcome. Candidate-only browser-positive and mutation tests invoke the frozen `/2` inspector explicitly; they are not current `/3` evidence. Current `/3` remains at the exact step-1 root refusal until stable document `candidateId` and unique `lineageId` are carried through this substrate.

The generic rule remains conditional: it may score K only after the complete intervening carry succeeds atomically. One calibrated exception exists for the exact measured step-5 case. It activates only when the two retained origin IDs, their exact piece witnesses, prepared steps 5 through 7, run options, all consumed input digests, and the captured source-closure attestation match the reviewed policy; it then scores those two origins directly at panel 7 after panel 6 remains ambiguous. Any source or data mismatch disables the shortcut, and no caller may use it for another step, origin set, panel sequence, or threshold.

The retained historical `/24` source-closure pin is `lego.real-build-source-attestation/1` over 3,601 repository files at `sha256:253fe23d52798792c55f6a46988168048740222cdfc4d58415241a4f3fb5210c`; historical `/25` covers 3,604 files at `sha256:ba13563c252361846501b8d3a634e178561e75ba15d61dbaf62f7dedf0454245`. The current `/26` source-closure pin uses the same schema over 3,607 repository files at `sha256:e0080ad0e0e93d8e132f12dfff6f17d1807c462b90ae8697c3244666c6b3751a`, declared in `apps/web/e2e/real-build-farther-origin-source-manifest.ts`. Each is the exact executable-source condition for its calibrated exception, not a fresh 14,172-row depth run, a score rebind, visual target truth, or build progress.

After a reviewed additive catalog migration changes current document hashes, rebind only the four fixed production parents before considering any depth rerun. The command requires the exact local booklet and retained legacy source run, acquires the Windows pre-discovery source lock, reconstructs all four immutable `/13` parents before migration, applies the current reviewed successor, and emits no Gate-3 image or output bundle:

```powershell
Remove-Item Env:LEGO_GATE3_STEP7_DIAGNOSTIC -ErrorAction SilentlyContinue
Remove-Item Env:LEGO_GATE3_STEP7_PREWARM -ErrorAction SilentlyContinue
$env:LEGO_REAL_BUILD_REQUIRED = "1"
$env:LEGO_GATE3_STEP7_PARENT_ONLY = "1"
try {
  npx.cmd playwright test apps/web/e2e/real-build-step7-gate3-diagnostic.spec.ts
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
} finally {
  Remove-Item Env:LEGO_GATE3_STEP7_PARENT_ONLY -ErrorAction SilentlyContinue
  Remove-Item Env:LEGO_REAL_BUILD_REQUIRED -ErrorAction SilentlyContinue
}
```

Parent-only success proves the fixed source/current migration pins and private production wrapper under the locked checkout; it does not execute or rebind the 14,172 rows, scores, 17 leaves, panel image, frontier, or document. A requested diagnostic or parent-only run fails closed rather than skipping when the booklet is missing: provide `recipes/6651557.pdf` at 70,238,655 bytes and SHA-256 `baef0a373164b58d7c982984b52d4e50b10cc59ed28007acb456faa72359bd27`, and preserve the exact retained source run under `output/direct-origin-k-production/runs/2026-08-12T10-28-52-560Z-34694c87c62e-26128a38-4d9e-4294-9091-6aae9b3ca367`.

Candidate and narrowing ledgers are shared across all parents. A narrowing reservation precedes its render batch, while a unique complete child is reserved after legal placement proves it exists and before it can enter retained evidence; a refusal retains earlier children as unresolved evidence without admitting a partial frontier, selecting an origin family, scoring conditional K, or changing the settled document. Do not add per-parent allowances together or interpret retained children as placed pieces.

A successful farther decision may select and settle the exact origin document for step N, but that must not be mistaken for settling its intervening descendants. Its `survivingCandidateIds` remain unresolved step-(N+1) alternatives unless a later deterministic step separately settles them; `descendantSettled` stays false whenever more than one survives.

Exact visual evidence is published as dense files named `step-NNN-farther-II-source-panel-panel-KKK.png` and `step-NNN-farther-II-candidate-render-panel-KKK.png`. The parser requires the exact source and scored-candidate ID set, and publication compares each projected path and PNG byte sequence with the browser row before updating `current.json`. An ordinary retained `step-KKK-panel.png` shows that source art was prepared, not that K appears in `farther.panels` or was scored.

Inspect `score.json`, the origin row's farther captures, and the ordinary N/N+1/K panel files together. For the current frontier, [building-system.md](../design/building-system.md#measured-booklet-frontier) records which panel occludes the disputed relation, which later underside view reveals it, what the exact shortcut selected, and why that selection remains diagnostic rather than canonical target completion.

### Read canonical and diagnostic outputs separately

`document.json`, `score.json`'s canonical `structuralHash`, and `finalParts` describe only a finalizer-approved official-target document. After exact report, identity-binding, canonical-part, metadata, step-ownership, and searched-transform checks, finalization exhausts the four proper upright yaws with one global integer-LDU translation. Same-step design/material/catalog/color identities are matched as exact multisets, complete connector/collision/allowance/bounds/flat-render realization must match modulo catalog-proved upright self-symmetry, and official transforms enter only this post-search evaluator. A structurally valid candidate with no surviving proper frame leaves canonical outputs absent, null, and zero; reflection is not permitted frame reconciliation.

For that case, `diagnostic-prefix.json` retains the exact `BrickDocumentV1` candidate separately. Current score `/5` and artifact-manifest `/4` bind the diagnostic summary under the generation-3 contract and browser boundary; an eligible downstream verifier independently finalizes retained browser-output `/3`, reproduces the diagnostic document bytes, validates document/hash/part/contiguous-step facts, and requires the file, score, and manifest to agree. Metadata-only and input-rejection boundaries cannot enter this verifier until they retain typed digest-bound rejection evidence, and no production artifact currently exercises the current tuple. The frozen legacy score `/4` and artifact-manifest `/3` encode the corresponding historical summary under contract/browser `/2`, but the retained tuple now fails the explicit full inspector at identification match `/2` because current semantic replay requires match `/3`. Independently pinned replay-closure, prepared-options, browser-output, and diagnostic-prefix bytes are rechecked through the frozen browser `/2` and semantic completion predicates; that narrower closure reproduces the five-step document projection and seven expected non-authorizing failures, but does not prove the score and manifest agree, authenticate the PDF/render source, or establish that the bytes equal the official model.

The target-equivalence audit accepts 1..1,464 unique identity/part rows with safe-integer upright transforms and known catalog definitions. It fails closed on unsupported realization layers and uses an audit-local cache for catalog self-symmetries and definition-plus-relative-transform comparisons. If no proper frame survives, a D4 reflection may be reported only when every origin, connector/collision/allowance/bounds realization, and independently inferred compatible contact matches; exact flat render triangle-and-normal topology is reported separately. An improper diagnostic never changes `targetEquivalence: "unreconciled"` or populates canonical output.

Retained run `2026-08-12T10-28-52-560Z-34694c87c62e-26128a38-4d9e-4294-9091-6aae9b3ca367` lives under `output/direct-origin-k-production/runs/` as immutable legacy inspection-only evidence. It uses artifact-manifest `/3`, run-contract `/2`, browser-output `/2`, result/score `/4`, and replay-closure `/3`; the exact full-tuple inspector now rejects it because its retained identification match is `/2` and current semantic replay requires `/3`. The ignored-run regression pins replay-closure.json at 725,460 bytes and `sha256:a8562c9ae06569f54e8df4ac7b3ec28d6975466ea77a8e662116e70da61b88ef`, requires its historical manifest digest `sha256:1c27df8a95c655f7508436489e8e31f486f806c7a5382df76d53e0a80801a66c`, derives the prepared-options and browser-output CAS paths only from their pinned digests, authenticates those exact role bytes, pins the 14,896-byte diagnostic prefix at `sha256:2edf84fbf1eab57e86cd2670f9bdb5e60a7ac33dbda454f22d9c9a85cbf8b70f`, and runs both the generation-local frozen browser `/2` inspector and semantic completion projection. This proves the pinned closure declaration, those three exact roles, five globally valid and buildable diagnostic prefixes, and the seven expected non-authorizing failures, not the full tuple, score, manifest, PDF/render source, or official target. The historical `current.json` still binds replay digest `sha256:1c27df8a95c655f7508436489e8e31f486f806c7a5382df76d53e0a80801a66c` and artifact-manifest digest `sha256:4dc5ce021e03ba0bc86667a64a1948f9ad54d2d80f95eb887b559a593c7036aa`; the measured score file remains `sha256:cbdf5b5502448011356b7fdb15f655734e97021853a45f41d64f63fd3f9e042e`, and `diagnostic-prefix.json` remains `sha256:2edf84fbf1eab57e86cd2670f9bdb5e60a7ac33dbda454f22d9c9a85cbf8b70f` as the exact diagnostic bytes exercised by this local regression without production authority.

Earlier legacy run `2026-08-12T09-14-05-246Z-32668097b507-2989d382-2a93-470c-aadb-14d91107a904` remains an immutable artifact-manifest `/2`, score `/3` historical predecessor. It records the same direct-origin panel-7 scores but predates `diagnostic-prefix.json`; preserve it as history and do not reinterpret either legacy run under current schemas.

## Regenerate catalog-derived inputs

Use the chain entry point instead of rebuilding later artifacts by hand. It preserves this order:

1. Validate the reviewed Builder source pins in `apps/web/e2e/real-build-builder-sources.ts`; the command refuses and changes nothing if those source pins are stale.
2. Rebuild `output/real-build/catalog-coverage.json` only when `LEGO_REAL_BUILD_REGENERATE_COVERAGE=1` is also set.
3. Rebuild `output/real-build/builder-canonical-calibration.json`.
4. Rebuild `output/real-build/action-ledger.json` against the coverage, calibration, transition classifications, and official model.

The retained historical `/24` stage-3 control reproduces all fifteen reviewed Builder designs as `lego.builder-canonical-calibration/8` in 20,379 bytes. Only the catalog-definition digests moved; the reviewed geometry, connector, and collision pins stayed fixed. Do not copy the report digest into this runbook or the BOM: the report embeds `BUILTIN_CATALOG_VERSION`, so that checksum is intentionally volatile across catalog bumps.

If stage 1 refuses, update the reviewed `BUILDER_STEP1_DESIGN_SOURCES` digests in the same catalog-truth change that requires them; do not bypass the refusal or regenerate later stages first.

Set the coverage flag when the catalog, callout manifest, or identification closure changed. Omit it only when the retained coverage is deliberately being reused.

The separate tracked ledger/current-catalog identity check measured 19 of the immutable 121 required leaf design IDs under historical `/25` at `sha256:7859f65b300f4e8a2b6dae85cffedbcd71e5f54fcffd8f688089c3353c549f28`; current `/26` measures 20 at `sha256:4e5df0a3aa5723b5aa5abef96e705562913c560a8a7452a2cf29582c2f05ba8f` after admitting `78329`. That inventory intersection neither regenerates the ignored `catalog-coverage.json` nor establishes a continuous printed-step prefix or build frontier; `11212` has no trusted printed-crop or placement authority, the stale step-39 pair-judged and step-101 unreviewed `32064` locators remain counterevidence only, and `33909` has no trusted printed identity, printed crop, placement, action-ledger, or frontier authority because its stale step-76 locator is internally inconsistent. All seven retained `78329` locators at steps 265, 268, 271, 274, 277, 282, and 336 are likewise stale and self-contradictory and grant no trusted printed identity, crop, placement, action-ledger, or frontier authority. The action ledger remains through step 25, with the step-26 `28802` versus Builder `10201` contradiction unresolved.

In this chain, `LEGO_REAL_BUILD_LAST_STEP` limits the stage-4 ledger validation. A requested coverage rebuild always compiles all 359 printed steps so the retained coverage remains reusable by longer prefixes.

```powershell
$env:LEGO_REAL_BUILD_REGENERATE_INPUTS = "1"
$env:LEGO_REAL_BUILD_REGENERATE_COVERAGE = "1"
$env:LEGO_REAL_BUILD_LAST_STEP = "12"
npx.cmd playwright test apps/web/e2e/real-build-inputs.spec.ts
Remove-Item Env:LEGO_REAL_BUILD_REGENERATE_INPUTS -ErrorAction SilentlyContinue
Remove-Item Env:LEGO_REAL_BUILD_REGENERATE_COVERAGE -ErrorAction SilentlyContinue
Remove-Item Env:LEGO_REAL_BUILD_LAST_STEP -ErrorAction SilentlyContinue
```

The transition-classification bundle is booklet-derived input to stage 4, not a catalog-derived stage. Republish it first when the booklet or transition classifier changes:

```powershell
$env:LEGO_REAL_BUILD_PUBLISH_TRANSITIONS = "1"
npx.cmd playwright test apps/web/e2e/real-build-transitions.spec.ts
Remove-Item Env:LEGO_REAL_BUILD_PUBLISH_TRANSITIONS -ErrorAction SilentlyContinue
```

For a ledger-only rebuild, after proving stages 1 through 3 and the transition bundle are current:

```powershell
$env:LEGO_REAL_BUILD_PUBLISH_ACTION_LEDGER = "1"
$env:LEGO_REAL_BUILD_LAST_STEP = "12"
npx.cmd playwright test apps/web/e2e/real-build-action-ledger.spec.ts
Remove-Item Env:LEGO_REAL_BUILD_PUBLISH_ACTION_LEDGER -ErrorAction SilentlyContinue
Remove-Item Env:LEGO_REAL_BUILD_LAST_STEP -ErrorAction SilentlyContinue
```

Prefer the ordered chain whenever catalog-derived input may have moved.

## Run the separate panel-placement probe

The panel-placement vision probe is not part of the real-build input chain or driver. Its current source images are unbound ignored inputs such as `output/zzz-vision/tight-004.png`; no repository command binds or reproduces them from the PDF, page, and crop bounds. Existing reading digests therefore identify the bytes used but cannot recover them after the mutable image path changes.

The current runner also accepts any resolved local path without source or image validation, grants the pinned Claude CLI repository-wide `Read`, retains the result string but not the tool trace, derives an unretained brief from the fixed `output/real-build/action-ledger.json`, and overwrites `reading-step-NNN.json` on rerun. Run it only after explicit authorization as an opt-in paid diagnostic, never as replay or product evidence:

```powershell
node scripts/panel-placement-run.mjs --steps 4,5 --panels output/zzz-vision --prefix tight --out output/panel-placement
npx.cmd vitest run apps/web/test/panel-reading-booklet.test.ts
```

The source-bound N/N+1/conditional-K checker is a separate quarantined diagnostic, not a replacement for the probe above or an input consumed by the studio or real-build driver. It still has no consent-checking PDF/crop producer and no successful live verdict; do not call its subscription-CLI adapter until that producer exists. [`learning-system.md`](../design/learning-system.md#model-calls-as-evidence) owns its evidence/refusal contract and the [threat model](../design/threat-model.md#current-trust-boundaries) owns its transport and trust boundary.

Exercise only the mocked checker and transport path with:

```powershell
npm run test:vision
```

Green mocked tests prove the local boundary and refusal semantics, not that a provider inspected a booklet image.

The `panel-reading-booklet.test.ts` command applies whatever ignored readings and retained run it finds to the deterministic enumerator; green means the survivors remain enumerated candidates, not that the reading is visually correct or that the settled transform survived. It selects the farthest available score and document independently and only logs `DROPS SETTLED`, so treat it as a diagnostic rather than a safety gate. A reproducible successor must retain immutable source and candidate-render bytes and bind them to PDF/page/bounds, deterministic face, prompt, brief, model response, catalog, base document, action ledger, panel N+1, and, when N+1 occludes the placement or remains ambiguous, the first revealing farther panel.

## Evidence lifecycle

Booklets, source payloads, generated inputs, screenshots, scoreboards, run directories, and replay closures stay under ignored roots. Preserve artifacts used by an active run or an unresolved finding; remove only inactive task-owned evidence after its conclusion and provenance have been recorded in tracked documentation or promoted deliberately into a regression fixture.
