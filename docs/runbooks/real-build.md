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

Then remeasure, score, canonicalize, and compare the generated catalog outputs. The generator owns 18 tracked outputs: the mesh registry, eight bounded measured mesh shards A through H, one render-only mesh shard, the measured blueprint root plus bounded D through H shards, one render-only blueprint shard, and the bundled-source table. The render-only generated type cannot carry connector, allowance, or collision truth. `--check` runs the workspace-pinned Prettier and refuses any byte drift, while report schema `/6` records 33 measured-pipeline rows and 12 dedicated render-only-pipeline rows, binds the exact pilot and Builder-frame inputs, records optional source-bounded connector rows such as the three discrete `4519` axle seats, the single transverse `32064` axle-hole seat, and the nine-stud/nine-clutch `11212` lattice, and retains the optional validated-connection stud profile without weakening ordinary collision. Four of those measured-pipeline rows are final catalog render-only promotions whose earlier physical authority is overlaid by the catalog factory, so the catalog result is twenty-nine fully measured definitions plus sixteen render-only promotions rather than the report's generation-path 33/12 split. The `32064` axle-hole row remains a discrete structural endpoint with no continuous axial authority. The `11212` row comes only from exact `p/stud.dat`, `p/stud4.dat`, and `parts/11212.dat` shadow routes; exact source-radius cylinders remain ordinary collision, while nominal radius 6 applies only to exact validated edges. The `33909` row binds the 9-file, 10,203-byte official closure rooted at `parts/33909.dat` (`sha256:8da6789db82746f179997ed4b917d00d34d03a6486d6aa27c76d17c9b21d8609`) with closure manifest `sha256:72174370ab6b3d2e0d00d7b72a0687a67da1cccd4014f1f799e113eecb504a15`, 220 triangles over 242 vertices, exact body bounds `[-20,-4,-20]..[20,4,20]`, visual bounds `[-20,-8,-20]..[20,4,20]`, the exact connector route through `p/stud.dat`, `p/stud4.dat`, and `parts/33909.dat`, two studs at `[-10,-4,10]` and `[10,-4,10]`, four clutches at x/z `±10`, y `4`, and 41 body boxes plus two exact source-radius stud cylinders. Its score is `0.9955832518073061` with zero hard failures, four of four clutch-room probes, zero outside containment points, and six of six lattice probes; revision-E metadata is count-only corroboration because it has no reviewed frame. The `78329` row binds the 9-file, 8,761-byte official closure rooted at `parts/78329.dat` (`sha256:79ec75c5092750b0f2022dab9c7561376d8b2b33fc3dea7059081ef273d4f7fc`) with closure manifest `sha256:d203ae681cfa3842e210b894d46e69e555e64e638796d260c3a2cabdb474f283`, 460 triangles over 489 stored vertices, exact body bounds `[-10,-4,-50]..[10,4,50]`, visual bounds `[-10,-8,-50]..[10,4,50]`, orientation `upright-yaw-90` plus translation `[0,-4,0]`, the exact connector route through `p/stud.dat`, `p/stud3.dat`, and `parts/78329.dat`, five studs at `[0,-4,z]` and five clutches at `[0,4,z]` for z `[-40,-20,0,20,40]`, and 39 body boxes plus five exact source-radius stud cylinders. Its score is `0.9968390298840539` with zero hard failures, five of five clutch-room probes, zero outside containment points over 659,766 samples, and ten of ten lattice probes. The `/29` `10201` row binds official root `parts/10201.dat` (`sha256:028bc441268df93c08a363d375406cdf1eb70a25250bb3b56945fd6828395b7e`) through its exact 21-file, 18,905-byte closure at `sha256:3c786b7ef3c89032ab9e4568f53e1962b06987c9cda780c399f752721a4e4a24` into 660 triangles, 23 conservative body boxes plus six source-radius stud cylinders, four outward side studs, two top studs, and two explicitly opted-in square-S6 underside clutches. The root's redirect to `2436b.dat` is closure evidence only; the catalog exposes exact `10201`, not `2436b`, as this identity.

The `/29` `3245b` row binds official root `parts/3245b.dat` (`sha256:3741551acda207402f56b5f7905f1ccc507f8261ea92359fec7829b464b08649`) through its exact 11-file, 10,868-byte closure at `sha256:9fdf84fa4dac343eaa9f4f3f30950044ae86613d66033b5c4bffd20a46b139c1` into 144 triangles, 29 conservative body boxes plus two source-radius stud cylinders, two top studs, two round underside clutches, and one fixed female blind axle socket. Its checksum-, source-line-, frame-, and closure-bound one-cap A6 × 44 declaration retains catalog midpoint `[0,2,0]`, closed end `[0,-20,0]`, open mouth `[0,24,0]`, outward normal `[0,1,0]`, depth 44 LDU, and `slide=false`; the generator and production admission gate require both ends to remain inside measured body bounds. This one-sided structural seat grants no continuous sliding, collision relief, insertion access, bare alias, or cross-suffix alias.

The current `/29` catalog has 106 definitions: 77 retain project-authored physical recipes and 29 are fully measured; 45 mesh closures comprise 237 unique source files, of which 233 declare CC BY 4.0 and four select the CC BY 4.0 option from dual declarations; twenty-one fully measured connector routes come from LDCad. [Part-model catalog truth](../design/part-model.md#current-catalog) owns the current `/29` counts, mesh deltas, and migration interpretation. Historical `/27` rows bind exact official `99563`, `73230`, `35464`, and `49307` surfaces; `99563` assigns its center clutch both shared half-cells and each outer clutch one half-cell, so the two outers coexist while center plus either outer refuses order-independently with `PORT_CAPACITY_EXCEEDED` under the same part instance. The `/28` rows bind only exact official suffixes `3245c` and `2453b`; bare and cross-suffix variants remain absent, and their Builder physical frames remain unresolved. These generator and catalog checks create no printed identity, assignment, frame, placement, replay, action-ledger, source-execution, acceptance, or step-frontier authority.

```powershell
$shadowLibrary = "C:\tmp\ldcad-shadow-20260802"

python -B scripts/emit-measured-part-tables.py --official $officialArchive --unofficial $unofficialArchive --shadow $shadowLibrary --pilot output/real-build/set-6651557-source-pilot.json --builder-frame output/real-build/set-6651557-builder-ldraw-frame.json --report output/real-build/set-6651557-measured-part-emission-check.json --check
```

For an intentional catalog-truth update, run the final command once without `--check`, review all 18 generated TypeScript diffs, and rerun it with `--check`. Never hand-edit `mesh-assets-6651557.ts`, its `mesh-assets-6651557-measured-{a,b,c,d,e,f,g,h}.ts` and `mesh-assets-6651557-render-only.ts` chunks, `part-blueprints-6651557-measured.ts`, its `part-blueprints-6651557-measured-{d,e,f,g,h}.ts` shards, `part-blueprints-6651557-render-only.ts`, or `ldraw-bundled-sources-6651557.ts`.

The retained historical `/24` instrument control is the ignored 203,106-byte schema-`/6` check report at `output/real-build/set-6651557-measured-part-emission-v24-check.json`; it reproduces all 16 generated files with `written:false` at `sha256:7aeccd85ad90106af16eb5c152a93162e3cb22be1793731e75673d1d02f45719`. The retained historical `/25` instrument control is the ignored 210,666-byte schema-`/6` check report at `output/real-build/set-6651557-measured-part-emission-v25-check.json`; it reproduces all 16 generated files with `written:false` at `sha256:5a358bee3beb3f7181cac34fd0703c2f7521c08393a7139ba2f363fa81fe37b9`. Its separate historical initial write report is 210,653 bytes at `sha256:af2bec62a01a69212b57bc403f536957e942ad1e4613253da2807bdf03009354`. The initial `/26` write report is the ignored 219,309-byte schema-`/6` report at `output/real-build/set-6651557-measured-part-emission-v26.json`; it records generated files with `written:true` at `sha256:56cea66dcd26f4eceda2a63efbf500144106c1db028d5e1c0d259413edde48de`. The retained historical `/26` instrument control is the ignored 219,322-byte schema-`/6` check report at `output/real-build/set-6651557-measured-part-emission-v26-check.json`; it reproduces all 16 generated files with `written:false` at `sha256:7c71d75f3d8f2388fbd83a01bbc74aabc6eeb8345c910e1f54bc8d05893b3f22`, retains all 25 measured-pipeline and 12 render-only rows, and has no hard-failing part. Each report's `sampleSpacingLdu` field remains the backward-compatible requested-spacing alias; the additive requested, maximum-effective, 256-subdivision-limit, and cap-limited-triangle fields disclose the grid actually sampled without changing the pinned older report envelopes. Those reports are generator evidence, not independent source, catalog, physical, or build authority. The retained historical `/28` instrument control is the ignored 258,087-byte schema-`/6` report at `output/.codex-wip/prefix50-admission/measured-part-emission-28-check.json`; it reproduces all eighteen generated files with `written:false` at `sha256:4631f079c210ed75c4a80662955ac96f3d5e822f9deeeb7d675fbbb66d827e1e`, retains 31 measured-pipeline and 12 dedicated render-only-pipeline rows, and has zero hard failures.

## Run the retained build

The real build is skipped during ordinary Playwright runs. Set `LEGO_REAL_BUILD_REQUIRED=1` to enable it and set `LEGO_REAL_BUILD_LAST_STEP` explicitly to a canonical integer from 1 through 50; there is no default and coercive spellings such as whitespace or exponent notation are refused. The full source/index contract remains 359 steps even though current execution is bounded to the requested first-50 prefix. Current run-contract `/5` retains a mandatory canonical `panel-source` envelope bound to the exact PDF digest and length plus the exact verified source-art-rebound role: the complete `InstructionSourceV1`, the explicit request, and exact retained page-shape rows for panels 1 through `min(request + 2, 359)`. Local replay reconstructs all 359 panels and manifest callout containment before prefix projection, independently re-derives the bounded panel faces from those page shapes, requires prepared execution/passive page, face, bounds and boxes to match, and uses that reconstruction for action-ledger panel evidence. This does not replay the PDF parser or renderer and grants no source-execution, identity, frame, placement or completion authority.

```powershell
$env:LEGO_REAL_BUILD_REQUIRED = "1"
$env:LEGO_REAL_BUILD_LAST_STEP = "50"
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

### Verify private step-1 scene reuse

The private authority-absent step-1/panel-2 diagnostic prepares one instruction scene per unique compiled child, renders all eight D4 hypotheses through it, copies every reusable readback before mask extraction, and disposes that child before preparing the next. Factory raster dimensions, frame dimensions and registration-panel number must match the detached source before work. The fitted view, frame target/radius and centre are not inspectably bound by `sourceDescriptorDigest`, so this control is not source-authenticated proper-frame evidence and cannot select or accept a booklet placement.

Run the real-WebGL parity and resource control headlessly:

```powershell
npx.cmd playwright test apps/web/e2e/real-build-step-one-silhouette-reuse.spec.ts
```

The control uses a non-square 320 × 192 raster and compares the prepared route with an independent inline direct renderer. It requires all eight ordered mask digests to match, all eight prepared digests to be distinct and nonempty, and scene derive/dispose counts of 1/1 versus 8/8. This is a scene-construction measurement only: all eight WebGL renders still execute and no wall-clock speedup is claimed. The focused Vitest diagnostic additionally requires immediate child-A disposal before child-B preparation, peak live prepared scenes of one, immutable constructor configuration, pre-render refusal for transposed or wrong-panel metadata, and fatal propagation of setup/disposal failure.

The retained historical `/26` proper-C4 gate validates the complete 400-row raw roster and then forms exactly 100 four-member proper-yaw orbits. It preserves the original raw member IDs, support data, operations, connections, prepared catalog/color identity, 100 deterministic representatives, and all 400 raw-to-representative inverse mappings; malformed, aliased, reflected, incomplete, oversized, or provenance-drifted families fail closed. The pinned roster is `sha256:24e68a134cf86c181ede701c2f189d1f2816af4a83510e2a841f270249d5ce72` and its historical quotient is `sha256:e9f23510849153d022bb0aafd6dbf5281bbf6c519c7aff8d14bdefd0fd1145b9`. Shared-capacity-aware compiler `/3` leaves that raw roster exact; historical catalog `/27` bound executable quotient `sha256:67c9642155e95db895d03a9fd8b9df9521d73fd3cf8ef91a4aa9f9b0e5ef0190`, while retained catalog `/28` moves only its metadata envelope to `sha256:5465db578166f8944e7ec0c0bc980b6ee18b87df5153c9959f9af7af9c87c00c`; the genuine retained `/28` browser run below verifies that envelope while remaining authority-absent and creating no placement claim. The gate projects physical root edges 3,200 → 800 and logical camera branches 25,600 → 6,400, but it does not render or select. Render integration must use exactly twenty deterministic closures of five representatives and one global aggregator, share the cumulative fixed-8,192 ledger, preserve each closure's pixel cap, prove `t_rep = t_member - d*q (mod 360)` plus exact mask/shift/score/ranking and global tie parity, inverse-expand all 400 rows, and never choose a batch-local winner.

Exercise only the quotient gate with:

```powershell
npx.cmd vitest run apps/web/test/real-build-step-one-proper-c4-quotient.test.ts
```

The ignored `output/build-search/step1-deferral.json` probe is a diagnostic counterexample, not a golden input. In the fresh 2026-08-12 run, step 1 contained no detected highlight region or stroke and all four enumerated proper-yaw candidates scored 0. Each truth rotation admitted 100 step-2 continuations with gauge IoU 1, but its rank at panel 2 was 35, 31, absent after proximity, and 24; at panel 3 it was 9, 171, 115, and 92. The retained panel, silhouette and branch PNGs were visually inspected together. Every branch exceeded that probe's render allowance, and the probe did not enumerate the reflected D4 hand, so it demonstrates why existing later-panel scores cannot authorize the first placement rather than resolving it.

Before asynchronous module or PDF preparation, the runner deep-detaches the complete JSON-like run input, including panels, order and page bindings, digests, accounting, coverage, and budgets. It re-snapshots the caller input after preparation and refuses any drift before raster, search, or placement, globally sorts the detached panels by printed step, and asserts the next contiguous step before rasterizing its page. Pages are rendered on demand. Module, page, PDF-document, and loading-task failures use bounded diagnostics that do not invoke hostile formatting hooks; a page-render failure retains the exact preceding document and one causally blocked row for every later request, and cleanup failure returns typed failed output without erasing completed reports, document bytes, or input digests.

The synthetic chiral regression selects x-reflected turn 90 at shift `[17,-23]` with IoU 1, versus about 0.476 for the best proper-hand hypothesis. A symmetric 2x4 plate reaches IoU 1 in both hands and is refused with all eight attempts retained. These are binary-silhouette measurements only: reflection reverses depth, so they do not establish RGB or occlusion equivalence and do not authorize a physical document branch.

Exercise only that bounded primitive with:

```powershell
npx.cmd vitest run apps/web/src/assembly/panel-face.test.ts apps/web/test/real-build-step-camera.test.ts apps/web/test/real-build-step-camera-handedness.test.ts apps/web/test/real-build-panel-camera-registration.test.ts apps/web/test/real-build-panel-camera-arrow-evidence.test.ts apps/web/test/real-build-panel-camera-branches.test.ts apps/web/test/real-build-panel-camera-resolver.test.ts apps/web/test/real-build-panel-camera-frontier.test.ts apps/web/test/real-build-panel-camera-evidence.test.ts apps/web/test/real-build-browser-output-v3.test.ts apps/web/test/real-build-run-panel-camera-cutover.test.ts apps/web/test/real-build-run-fixed-actions.test.ts apps/web/test/real-build-fixed-frame-authority.test.ts
```

### Verify the bounded steps 2–4 caller-source panel projection

Run the scoped boundary and genuine-booklet control together:

```powershell
npx.cmd vitest run apps/web/test/real-build-panel-evidence-scoped.test.ts apps/web/test/real-build-panel-evidence-scope-boundary.test.ts apps/web/e2e/real-build-observation-source-parity-browser-input.test.ts
```

The genuine-booklet case still ingests text from all 224 PDF pages and indexes all 359 step labels, because glyph-height inference is booklet-global. It must touch only page 11 for vector/operator-list extraction, materialize all four panels jointly printed there, emit only steps 2–4, and reproduce their three pinned commitment digests. The result explicitly says that positioned text is caller-supplied and parser replay was not performed; it has no source-text, prepared-run, placement or completion authority, and its commitment field names cannot satisfy the legacy dense evidence shape. The unchanged source-parity browser input must reject the three-row projection because it still requires exactly 359 panels.

The exact-three packet is a separate strict transport for that projection. Its writer and independent reader both require placement steps `[1,2,3]`, registration panels `[2,3,4]`, page 11, exactly 359 indexed labels, and exactly four materialized page panels; they cross-bind and reproduce high RGBA, work RGBA, and packed-mask roles. Run its hostile unit gate and genuine capture with:

```powershell
npx.cmd vitest run apps/web/test/real-build-exact-three-source-packet.test.ts
$env:LEGO_REAL_BUILD_EXACT_THREE_SOURCE = "1"
try {
  npx.cmd playwright test apps/web/e2e/real-build-exact-three-source.spec.ts --workers=1
} finally {
  Remove-Item Env:LEGO_REAL_BUILD_EXACT_THREE_SOURCE -ErrorAction SilentlyContinue
}
```

The genuine capture must report manifest `sha256:6b09685905bab077c254adf1e8b32ee2eebd7eefac76d04da678ff47a77c3138`, 20,009 manifest bytes, and 8,592,000/2,150,000/738,816 high/work/mask bytes, with one PDF fetch/render/dispose/destroy cycle. Inspect all six regenerated high/work images before accepting the run. This packet does not supply source-execution, prepared-run, physical-frame, placement, accepted-document, or completion authority.

The exact source-art rebound independently recompiles one shared embedded-art class at printed steps 2, 4, and 16, preserves the four later suffix members as counterevidence, and grants no authority by itself. Reproduce its Node artifact and the two independent Chromium PDF.js routes with:

```powershell
npx.cmd vitest run scripts/part-identification-source-art-rebound.test.mjs
node scripts/part-identification-source-art-rebound-cli.mjs
$env:LEGO_REAL_BUILD_SOURCE_ART_REBOUND = "1"
try {
  npx.cmd playwright test apps/web/e2e/callout-source-art-rebound.spec.ts --workers=1
} finally {
  Remove-Item Env:LEGO_REAL_BUILD_SOURCE_ART_REBOUND -ErrorAction SilentlyContinue
}
```

The Node artifact must be 9,786 bytes at `sha256:a58a55e65c19e2771defe02fc9d37e24c00246bbed9dd375d8d0a2f16382897d`. The browser gate must reproduce the pinned step-2/4/16 diagnostic RGBA digests through modern and legacy PDF.js `5.4.149`; inspect all six full/isolated images at original resolution. Coverage may upgrade step 2 only through the separately retained step-4 pair-judged anchor and must bind the upgraded row to the rebound artifact digest.

The exact legacy-recut semantic consumer independently verifies the retained recut artifact, derives the first-50 official quantity cut, and publishes semantic identity only for the 70 compatible listed relations. Reproduce its hostile-boundary tests and three-pass ignored artifact with:

```powershell
npx.cmd vitest run scripts/part-identification-legacy-recut.test.mjs scripts/part-identification-legacy-recut-semantic.test.mjs scripts/part-identification-legacy-recut-semantic-boundary.test.mjs
npm.cmd run part-identification:legacy-recut-semantic
```

The artifact must be 42,105 bytes at `sha256:e92ef982f9039b7fd94fb2cdca23fa5e56fb34fb6820ef4fa7ee9b999a0a63ea`, with 70 semantic relations / 107 pieces and four quarantined relations. Its workflow must report exactly 510 crop images, 43,833,660 decoded pixels, three model-index calls / 5,709,507 input bytes, and six full XML decodes / 11,419,014 decoded bytes under the fixed workflow ceilings; a fourth protected callback must refuse before reading inputs. It assigns no physical Brick, publishes no catalog or coverage trust, and grants no frame, placement, accepted-document, or completion authority; do not feed it into coverage until a separately versioned consumer is verified.

The separate source-art semantic compiler consumes only the opaque verified legacy-recut semantic handle, the exact full manifest/PDF, and the official first-50 cut. It compares embedded source art by exact decoded RGB24 identity plus one ordered, strict-allowlisted image closure whose page translation and terminal resource name are normalized explicitly and whose numeric operands use the declared nearest-milli rule. Each member separately retains a nonempty support mask, isolated/full support-RGBA equality, and zero on-support interference; page translation may change raster phase, so cross-member support-mask or support-RGBA equality is not claimed. Reproduce its hostile protocol tests and real two-lifecycle artifact with:

```powershell
npx.cmd vitest run scripts/part-identification-source-art-semantic-rebound.test.mjs scripts/part-identification-source-art-semantic-rebound-program.test.mjs scripts/part-identification-source-art-semantic-rebound-cli.test.mjs
npm.cmd run part-identification:source-art-semantic-rebound
```

The artifact must be 211,319 bytes at `sha256:4be7bd77d386a7a656019affe9c995e77135080a7aa90df19e43a6f2167ab721`. Sixteen relations / 40 pieces extend the sparse semantic set to 86 / 147, while 101 relations / 173 pieces remain residual under the exact 187-row / 320-piece first-50 denominator and the full 881-row / 359-step source index remains intact. The two-lifecycle workflow must report 19,750,648 component pixels, 1,846,598 decoded RGB24 pixels / 5,539,794 bytes, 76 full-page renders, 290 isolated renders, 290 control renders, two official-model indexes over 3,806,338 input bytes, and four full XML decodes / 7,612,676 bytes. This is semantic identity evidence only: source execution, prepared-run, physical assignment, frame, catalog admission, coverage publication, action, placement, document, replay, acceptance, and completion authority remain absent.

The downstream prefix-50 semantic-closure verifier consumes that exact opaque source-art verifier result, the pinned callout and inventory manifests, element-resolution and official-model bytes, the retained 41-row static, 57-row broad, and 3-row focused review inputs, and a separately pinned 101-row original-resolution review-outcome input. Reproduce its real evidence path with:

```powershell
npx.cmd vitest run scripts/part-identification-prefix50-semantic-closure.test.mjs
```

With every ignored input present, all 12 tests must run and pass; a clean checkout may skip the six live-evidence tests, so a skipped pass does not verify the closure. The exact review-outcome file must be 30,429 bytes at `sha256:286696d9254e89d027eb4a244d176cb8aff064991655347865ce8d3d5f1012b7`; it binds all 101 identity, element, callout-digest, and inventory-digest tuples to explicit outcomes, and only `same` is admitted. The opaque handle carries 86 safe relations / 147 pieces without reopening those crop files. Only the exact 101 residual relations / 173 pieces reopen one manifest-bound callout crop and one manifest-bound inventory crop per relation, for 101 + 101 authenticated reads. The three residual partitions are 41 / 66, 57 / 102, and 3 / 5 relations / pieces; together with the safe roster they yield exactly 187 relations / 320 pieces. The exact official first-320 sequence and the semantic roster must aggregate to the same 86 elements / 320 pieces with zero quantity differences. The canonical 92,426-byte `/1` artifact must be `sha256:1902af68a13cb629d9dbac1707c8c5c6998ec355cfcb6ef4dad2fc938f76155b`, retain the full 881-row / 359-step source/index contract, and say `suffixStepsReconstructed=false`. This is local semantic-element identity only. Published part-number/color fields are input-bound resolution metadata, not catalog admissions or aliases, and no authenticated source execution, prepared run, physical assignment, frame, transform, coverage, action, production ledger, placement, replay, document mutation, acceptance, or completion authority follows.

The next bounded consumer prepares, but does not authorize, the exact first-50 action schedule. Reproduce it with:

```powershell
npx.cmd vitest run scripts/part-identification-prefix50-action-preparation.test.mjs
npm.cmd run part-identification:prefix50-action-preparation
```

The current result must be 317,152 bytes at `sha256:5fbab00b90c6ffbe6c9b09727819e0b3a964cebbd88138232bd2418df6100fb6`: 50 printed-step rows, 49 part-bearing rows, zero-piece step 44, 187 callouts / 320 physical identities, 95 phases, 91 direct phases / 309 identities, and four `MultiBuild` phases / 11 identities. It must preserve exact repeat ownership at steps 28–29 and the token-gated phase sequence across steps 31–32 while retaining `expectedPrintedSteps=359` and `suffixStepsReconstructed=false`. Production verification accepts only the opaque semantic-closure result and module-owned current pins. The artifact's `actionPreparation:true` is not action authority: authentication, source execution, prepared run, physical frame, assignment/action authority, production action-ledger publication, placement, mutation, replay, accepted-document, and completion remain false.

The private first-50 Builder-frame diagnostic binds that preparation to exact Builder, official-model, catalog, and LDraw evidence. Reproduce its bounded checks with:

```powershell
npx.cmd vitest run apps/web/test/real-build-builder-prefix-contract.test.ts apps/web/test/real-build-builder-frame-selection.test.ts apps/web/test/real-build-builder-calibration.test.ts apps/web/test/real-build-builder-source-parity.test.ts
python -B scripts/builder_calibration_scripts_test.py
python -B scripts/builder_ldraw_frame_test.py
```

The source-parity test must exact-compare all 43 TypeScript/Python design tuples, all 43 Python Shell identities against their TypeScript source rows, and all 184 canonical LDraw closure files; the ordered Shell aggregate must be `sha256:ce023de75e9c5214cd49ebc381e1842cdeb4bd75c6da39b055a11124f5dcd136`. These are duplicate committed representations guarded for equality, not one generated authority. The current ignored geometry policy is exactly 1,820,412 bytes at `sha256:7e91e1402f2ab609fee6e502336f86ee74fb3a94d970e9b0b75acf07f925a76f`; the 184-file official closure remains `sha256:72ca520b68934fdaa384e9bbc961090538f0b4ee1269773675db1adcf3cc7fdd`. After explicit semantic coverage verification, current catalog `/29` calibration `/8` is 54,993 bytes at `sha256:69555bf4a0b7a7beaeb4f98b6d0e5750fa28b6946a957cdc5772633602636a70`, and the closed-field 78,884-byte proper-world diagnostic `/2` is `sha256:6a26f70df0aa6faac4361a195bd2d95931f8f46acd2e56ecc7c7f052ea0aa940`. Only Builder families 0/1 may anchor a catalog stud and family 15 a catalog clutch; an unmapped authored lattice still blocks surface-only fallback. These calibration artifacts grant no source execution, official world placement, action authority, replay, mutation, acceptance, or completion authority.

The exact `2453;I` route is a separate source-production and identity unit. Verify the retained evidence and opaque boundary with:

```powershell
npx.cmd vitest run scripts/part-identification-2453-builder-identity.test.mjs
```

With the exact ignored inputs present, all 12 tests must run and pass. The CPython 3.13-pinned source-production extractor runs twice in isolated workers and emits 2,603 canonical bytes at `sha256:86196d880b405b1fc4516cbdfba1d7fbedd6746d2d7a56079b927d718f036f11`; it is deliberately not a default-Python or ordinary `test:python` gate. The 6,730-byte identity artifact must be `sha256:087a8f0308bdf83a7a585196acb4f695409350367e311b38dbb7920038d1f5d4`, prove solid `2453b` rather than hollow `2453a`, and derive the proper local translation `[0,60,0]`. Verification accepts only module-owned pins and adjudication requires the actual opaque compiler token. The narrow registry consumer admits only item `6595205`, maps it to exact catalog `2453b`, and applies the inverse local translation `[0,-60,0]`; it refuses item `4210690`, suffix aliases, parsed-artifact lookalikes, and all action or placement authority. Its five prefix pieces are included in the current 197-row diagnostic census, while placement, action, mutation, replay, acceptance, and completion remain false.

The separate official XML/LDraw world-proposal diagnostic consumes only the opaque current action-preparation token plus exact pinned official model XML and derived LDraw MPD. Reproduce and verify it with:

```powershell
node scripts/part-identification-prefix50-official-ldraw-world-proposal-cli.mjs
npx.cmd vitest run scripts/part-identification-prefix50-official-ldraw-world-proposal.test.mjs
```

The current ignored artifact must be 764,234 bytes at `sha256:24c10640f118d2961dd297cff608b6978bd54eab85a37cf0c314f4711612f960`. It independently reconciles the exact XML and LDraw sources and retains all 320 prefix action rows under current catalog `/29` identity evidence without widening aliases. Three step-45 `4519` origins remain exactly half-LDU at z `-96.5`; do not round or infer document legality. The artifact is a local diagnostic proposal only and grants no source execution, physical frame, action, placement, document mutation, replay, acceptance, or completion authority.

Reproduce the downstream exact-frame, occurrence/world, and structural-event chain with:

```powershell
npm.cmd run part-identification:prefix50-ldraw-catalog-frames
npm.cmd run part-identification:prefix50-official-world-reconciliation
npm.cmd run part-identification:prefix50-structural-events
npx.cmd vitest run scripts/part-identification-prefix50-ldraw-catalog-frames.test.mjs scripts/part-identification-prefix50-official-world-reconciliation.test.mjs scripts/part-identification-prefix50-structural-events.test.mjs
```

The current exact-frame artifact must be 330,415 bytes at `sha256:bcf9702150b73cab1bd70d7ecd0bf33b3b3917522ce4f0ca892be56424b861a1`: 66 exact aliases and all 320 occurrences with zero exclusions. The current world artifact must be 651,618 bytes at `sha256:4037ecb9cc60bc63bae38b963abeef8096d7405f2da80a40e79fe60fdff4092b`, reconcile 309 direct rows plus eleven real `MultiBuild` rows, and leave zero quarantines. The reconciler must derive actual/source/master copy provenance from its opaque action-preparation input; no static occurrence table may author `MultiBuild` kind. The official parser reproduces 561 physical phases and 132 separately ordered completion events; the current 7,292-byte structural artifact at `sha256:ea1ee9791575ecd858cf13b076d0b3c6de4ebfca9a51a268a9242d3e07667fe3` binds the current action input and publishes the zero-piece printed-step-44 return over child occurrences 258 through 280. All three artifacts are ignored fail-closed evidence: a missing current or history artifact, parsed lookalike, forged token, same-design swap, `MultiBuild` source substitution, step 51, suffix widening, or incomplete transform must refuse. They grant no action, placement, mutation, replay, acceptance, or completion authority. Each generator compares its in-memory reproduction with the reviewed pin, never overwrites differing current bytes, and requires explicit promotion before a reviewed candidate becomes current evidence.

Re-run the selected-path search and current-evidence controls with the exact command below. All 19 tests across all three files must run and pass; a skipped current-evidence test is not a green control and means one or more of its seven ignored evidence inputs is unavailable. This is a retained local evidence execution, not a clean-checkout repository gate.

```powershell
npx.cmd vitest run apps/web/test/real-build-prefix50-exact-compiler.test.ts apps/web/test/real-build-prefix50-exact-compiler-search-state.test.ts apps/web/test/real-build-prefix50-exact-compiler-current-evidence.test.ts
```

The latest retained local control passed three files / 19 tests with no skip in 185.28 seconds of suite wall time and preserved the step-29 selected-path observation. That wall time is test-run telemetry only; it does not refresh the retained diagnostic runtime or detailed enumeration fields. Authority-free `lego.real-build-prefix50-selected-path-diagnostic/1` selects the first locally complete order per printed step, backtracks within the current step only, never revisits an earlier committed step, and charges its search-node budget cumulatively across the prefix. Canonical `lego.real-build-prefix50-exact-compilation/2` requires all 50 steps, 320 parts, 51 state commitments, and the occurrence-30 proof and is therefore unavailable. The selected-path `/1` diagnostic is unrelated to `lego.builder-proper-world-diagnostic/2`, the closed-field Builder-frame census artifact described above.

Before expensive placement enumeration, inspect the requested target's connector topology and collision feasibility against the exact prepared world and refuse a provably impossible part/port combination cheaply. On its selected committed prefix, diagnostic `/1` completes printed step 28 with 163 compiled parts and reports `selected-committed-prefix-within-step-blocker` at printed step 29 occurrence 165 on `builtin:jumper-plate-1x2`. Retained 2026-08-28 output records source `[280,-36,-124]/upright-yaw-270`, target `[-280,-24,70]/upright-yaw-270`, `enumerationCount=749`, `searchNodeCount=256`, and 188.80 seconds. It also records 65 complete enumerations for occurrence 165; the final enumeration reports `freeStuds=191`, `freeClutches=367`, raw stud/clutch counts `382/367`, `distinct=617`, `below=226`, `colliding=124`, and `accepted=267`. Those detailed values are retained historical selected-path fields, not fresh canonical compilation evidence. The earlier 325-enumeration / 115.316-second result is unsound counterevidence: its remaining-only dead-state memo conflated different documents and placement histories, while the repaired memo commits the complete within-step search state including raw part order. An abstract isolated search-helper `[1,2]` versus `[2,1]` control models the early-return false-negative class; its synthetic tile topology is not a production-valid compiled model, so it does not prove a currently reachable production case. Independently, the implementation has no cross-step backtracking, so the selected-path observation cannot support a globally first blocker or infeasibility claim. Do not label the current observation a topology or collision failure from these aggregate counts alone. A successful exact compilation would remain an existence witness; before making a global infeasibility claim, implement and measure a continuation solver that revisits earlier step choices. This operational checkpoint does not mean printed step 29 completed or step 50 assembled.

The bounded step-31/32 order reconciler authenticates the current callout manifest and official Builder XML, then tests the three reviewed source/inventory identity pairs against exact phases 49 through 54. It does not reopen the inventory crop bytes: their reviewed digests are committed metadata. Reproduce the compiler/verifier boundary with:

```powershell
npx.cmd vitest run scripts/part-identification-step31-32-order-reconciliation.test.mjs
```

The canonical `/2` artifact must be 6,680 bytes at `sha256:66451b2324142d9f563b731739532c38be06e34018eb8397bacfe4a0e6245810`. It retains the exact 180 + 4 + 10 source cut, proves naïve step-local slices short by 1, 1, and 2 pieces, and repartitions the same six phases into exact four-piece step 31 and ten-piece step 32 aggregates while conserving all 14 physical identities. Only the reviewed semantic rows, aggregate step multisets, contradictions, input commitments, and an explicit disclosure are serialized. Direct Brick UUID-to-callout rows are absent, but the open pinned XML and repository derivation make the five reviewed associations reconstructible; do not treat omission as confidentiality. The source index says `cropByteEvidence=not-consumed-reviewed-digests-only`: this unit authenticates manifest and XML bytes plus reviewed digest metadata, not the crop bytes themselves. This evidence still grants no assignment, frame, transform, catalog part, production-ledger integration, placement, replay, document, or completion authority.

Treat wall-clock output as an observation, not the gate. The deterministic work trace is the proof: 171 → 1 vector/operator pages, four page-complete panels, three emitted commitments. A future verified full-manifest cache belongs under `var/state/` and must key the exact PDF, pdfjs dependency, schema and transitive derivation source; no reusable cache exists yet.

The default output root is `output/real-build`. Once an eligible artifact closure verifies, publication writes an immutable run under `<output-root>/runs/<run-id>/` and atomically updates `<output-root>/runs/current.json`. Current publication requires the exact tuple artifact-manifest `/4`, run-contract `/5`, browser-output `/3`, and result/score `/5`; run-contract `/4` is frozen inspection-only, and the replay closure must be `downstream-only` from browser output. Both the writer and verifier intentionally refuse metadata-only or input-rejection closures because they retain no typed digest-bound witness from which Node can reproduce the exact rejection and score; do not treat a caller-authored `source-drift-detected` summary as publishable evidence until that witness exists. No production run has yet been published under the current tuple. An interruption, ineligible boundary, or artifact-verification failure before publication must not replace the pointer. `LEGO_REAL_BUILD_OUT` may redirect the published run only to another traversal-free descendant of `output/`; it does not redirect the retained inputs listed above.

### Read frozen bounded farther-panel evidence

The retained browser-output `/2` driver recorded a bounded branch proof on the origin row's `farther` field when an own-panel ambiguity survived N+1. `origin` retains every step-N candidate with its structural hash, exact atomic piece witnesses, cached N+1 agreement and registration shift; `carries` records every parent-child lineage and intervening-step cost; `panels` records only panels actually scored; `budgets` records shared offered-candidate, narrowing-render, panel-render and reach use plus any refused reservation; and `refusal` or `decision` records the outcome. Candidate-only browser-positive and mutation tests invoke the frozen `/2` inspector explicitly; they are not current `/3` evidence. Current `/3` remains at the exact step-1 root refusal until stable document `candidateId` and unique `lineageId` are carried through this substrate.

The generic rule remains conditional: it may score K only after the complete intervening carry succeeds atomically. One calibrated exception exists for the exact measured step-5 case. It activates only when the two retained origin IDs, their exact piece witnesses, prepared steps 5 through 7, run options, all consumed input digests, and the captured source-closure attestation match the reviewed policy; it then scores those two origins directly at panel 7 after panel 6 remains ambiguous. Any source or data mismatch disables the shortcut, and no caller may use it for another step, origin set, panel sequence, or threshold.

The retained historical `/24` source-closure pin is `lego.real-build-source-attestation/1` over 3,601 repository files at `sha256:253fe23d52798792c55f6a46988168048740222cdfc4d58415241a4f3fb5210c`; historical `/25` covers 3,604 files at `sha256:ba13563c252361846501b8d3a634e178561e75ba15d61dbaf62f7dedf0454245`; and the historical `/26` catalog-session checkpoint covers 3,607 files at `sha256:e0080ad0e0e93d8e132f12dfff6f17d1807c462b90ae8697c3244666c6b3751a`. The current executable-source successor uses the same schema over 3,748 repository files at `sha256:00cb15b09681797b066aec5f3b0a63c660cbb8610f93bf097034349345b92d87`, declared in `apps/web/e2e/real-build-farther-origin-source-manifest.ts`. Each is the exact executable-source condition for its calibrated exception, not a fresh 14,172-row depth run, a score rebind, visual target truth, or build progress.

After a reviewed catalog successor changes current document hashes, rebind only the four fixed production parents before considering any depth rerun. The command requires the exact local booklet and retained legacy source run, acquires the Windows pre-discovery source lock, reconstructs all four immutable `/13` parents, authenticates the exact live `/13` to `/29` truth and roster-intersected connector/collision interpretation report, then projects it onto the separately frozen additive `/26` compatibility boundary; it emits no Gate-3 image or output bundle:

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

For that case, `diagnostic-prefix.json` retains the exact `BrickDocumentV1` candidate separately. Current score `/5` and artifact-manifest `/4` bind the diagnostic summary under run-contract `/4` and browser-output `/3`; run-contract `/3` is frozen inspection-only. An eligible downstream verifier independently finalizes retained browser-output `/3`, reproduces the diagnostic document bytes, validates document/hash/part/contiguous-step facts, and requires the file, score, and manifest to agree. Metadata-only and input-rejection boundaries cannot enter this verifier until they retain typed digest-bound rejection evidence, and no production artifact currently exercises the current tuple. The frozen legacy score `/4` and artifact-manifest `/3` encode the corresponding historical summary under contract/browser `/2`, but the retained tuple now fails the explicit full inspector first because its 1,091,772-byte Builder geometry role does not satisfy the exact current 1,820,412-byte replay policy. Independently pinned replay-closure, prepared-options, browser-output, and diagnostic-prefix bytes are rechecked through the frozen browser `/2` and semantic completion predicates; that narrower closure reproduces the five-step document projection and seven expected non-authorizing failures, but does not prove the score and manifest agree, authenticate the PDF/render source, or establish that the bytes equal the official model.

The target-equivalence audit accepts 1..1,464 unique identity/part rows with safe-integer upright transforms and known catalog definitions. It fails closed on unsupported realization layers and uses an audit-local cache for catalog self-symmetries and definition-plus-relative-transform comparisons. If no proper frame survives, a D4 reflection may be reported only when every origin, connector/collision/allowance/bounds realization, and independently inferred compatible contact matches; exact flat render triangle-and-normal topology is reported separately. An improper diagnostic never changes `targetEquivalence: "unreconciled"` or populates canonical output.

Retained run `2026-08-12T10-28-52-560Z-34694c87c62e-26128a38-4d9e-4294-9091-6aae9b3ca367` lives under `output/direct-origin-k-production/runs/` as immutable legacy inspection-only evidence. It uses artifact-manifest `/3`, run-contract `/2`, browser-output `/2`, result/score `/4`, and replay-closure `/3`; the exact full-tuple inspector now rejects it at the current Builder-geometry role boundary, 1,091,772 retained bytes versus exactly 1,820,412 required. The ignored-run regression pins replay-closure.json at 725,460 bytes and `sha256:a8562c9ae06569f54e8df4ac7b3ec28d6975466ea77a8e662116e70da61b88ef`, requires its historical manifest digest `sha256:1c27df8a95c655f7508436489e8e31f486f806c7a5382df76d53e0a80801a66c`, derives the prepared-options and browser-output CAS paths only from their pinned digests, authenticates those exact role bytes, pins the 14,896-byte diagnostic prefix at `sha256:2edf84fbf1eab57e86cd2670f9bdb5e60a7ac33dbda454f22d9c9a85cbf8b70f`, and runs both the generation-local frozen browser `/2` inspector and semantic completion projection. This proves the pinned closure declaration, those three exact roles, five globally valid and buildable diagnostic prefixes, and the seven expected non-authorizing failures, not the full tuple, score, manifest, PDF/render source, or official target. The historical `current.json` still binds replay digest `sha256:1c27df8a95c655f7508436489e8e31f486f806c7a5382df76d53e0a80801a66c` and artifact-manifest digest `sha256:4dc5ce021e03ba0bc86667a64a1948f9ad54d2d80f95eb887b559a593c7036aa`; the measured score file remains `sha256:cbdf5b5502448011356b7fdb15f655734e97021853a45f41d64f63fd3f9e042e`, and `diagnostic-prefix.json` remains `sha256:2edf84fbf1eab57e86cd2670f9bdb5e60a7ac33dbda454f22d9c9a85cbf8b70f` as the exact diagnostic bytes exercised by this local regression without production authority.

Earlier legacy run `2026-08-12T09-14-05-246Z-32668097b507-2989d382-2a93-470c-aadb-14d91107a904` remains an immutable artifact-manifest `/2`, score `/3` historical predecessor. It records the same direct-origin panel-7 scores but predates `diagnostic-prefix.json`; preserve it as history and do not reinterpret either legacy run under current schemas.

## Regenerate catalog-derived inputs

Use the chain entry point instead of rebuilding later artifacts by hand. The current `/29` checkpoint intentionally stops at calibration:

1. Validate the reviewed Builder source pins in `apps/web/e2e/real-build-builder-sources.ts`; the command refuses and changes nothing if those source pins are stale.
2. Explicitly verify and, only when requested, republish `output/real-build/catalog-coverage.json` from the opaque semantic closure.
3. Publish `output/real-build/builder-canonical-calibration.json` for catalog `/29` and stop at `LEGO_REAL_BUILD_REGENERATE_THROUGH=calibration`.
4. Leave `output/real-build/action-ledger.json` untouched: semantic coverage `/4` is identity-only and the production action consumer deliberately refuses it as action authority.

The retained historical `/24` stage-3 control reproduces all fifteen reviewed Builder designs as `lego.builder-canonical-calibration/8` in 20,379 bytes. Only the catalog-definition digests moved; the reviewed geometry, connector, and collision pins stayed fixed. Do not copy the report digest into this runbook or the BOM: the report embeds `BUILTIN_CATALOG_VERSION`, so that checksum is intentionally volatile across catalog bumps.

If stage 1 refuses, update the reviewed `BUILDER_STEP1_DESIGN_SOURCES` digests in the same catalog-truth change that requires them; do not bypass the refusal or regenerate later stages first. The current full-chain result is `BLOCKED` at the intentional action-authority boundary, not a failed `/29` calibration.

Set the coverage flag when the catalog, callout manifest, or identification closure changed. Omit it only when retained coverage is deliberately being verified and reused. The current `/29` semantic artifact is 588,467 bytes at `sha256:861d08a28dac94619e8c541e928d7803b4b6cab9fe9fa12da9f166fc0e46444d`; calibration is 54,993 bytes at `sha256:69555bf4a0b7a7beaeb4f98b6d0e5750fa28b6946a957cdc5772633602636a70`, and the 78,884-byte proper-world diagnostic `/2` is `sha256:6a26f70df0aa6faac4361a195bd2d95931f8f46acd2e56ecc7c7f052ea0aa940`.

The separate tracked intersection measured 19 of the immutable 121 required leaf design IDs under historical `/25` and 24 under retained `/28`; those historical denominators remain counterevidence rather than current frontier claims. Catalog `/29` now admits exact `10201` and `3245b`, and current semantic coverage closes catalog identity for all 187 first-50 callouts / 320 pieces. That identity closure establishes neither a continuous placed prefix nor a build frontier. Action preparation `/1` orders all 320 identities but remains refused by production action consumers; no official world placement, trusted action ledger, replay, source execution, acceptance, or step-frontier authority follows.

In this chain, `LEGO_REAL_BUILD_LAST_STEP` is mandatory and selects the exact semantic prefix for a requested coverage rebuild. It does not truncate the callout manifest or source index: those remain dense through all 359 printed steps. Coverage compiled for one prefix is deliberately not reusable as a longer or shorter prefix, and the publisher refuses a mismatch instead of silently widening work. `LEGO_REAL_BUILD_REGENERATE_THROUGH=calibration` is likewise an exact boundary, not permission to fall through to action-ledger publication.

```powershell
$env:LEGO_REAL_BUILD_REGENERATE_INPUTS = "1"
$env:LEGO_REAL_BUILD_REGENERATE_COVERAGE = "1"
$env:LEGO_REAL_BUILD_REGENERATE_THROUGH = "calibration"
$env:LEGO_REAL_BUILD_LAST_STEP = "50"
npx.cmd playwright test apps/web/e2e/real-build-inputs.spec.ts
Remove-Item Env:LEGO_REAL_BUILD_REGENERATE_INPUTS -ErrorAction SilentlyContinue
Remove-Item Env:LEGO_REAL_BUILD_REGENERATE_COVERAGE -ErrorAction SilentlyContinue
Remove-Item Env:LEGO_REAL_BUILD_REGENERATE_THROUGH -ErrorAction SilentlyContinue
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
$env:LEGO_REAL_BUILD_LAST_STEP = "50"
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
