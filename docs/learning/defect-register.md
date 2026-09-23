# Defect register

Every defect the user reports gets a permanent entry here with the symptom as reported, the investigation, the root cause, the fix, and the whole-class check that remains. This is neither the [devlog](../devlog/summary.md) nor [lessons.md](lessons.md): history records what changed, a lesson is removed when a gate absorbs it, and this register preserves the symptom-to-cause mapping even after the fix ships.

Newest first.

---

## 2026-09-05 - Fixed Poppler refusals retained raw diagnostic causes

**Status:** two demonstrated cause routes repaired, independently reviewed and accepted after 13/13 implementation-owner controls and the chief parent's 24/24 diagnostic-plus-crop rerun. Complete diagnostic redaction and Stage-1 readiness remain unproved; source-measurement admission stays closed.

**Symptom and investigation.** Diagnostic review found raw spawn-error and malformed-stdout markers reachable behind fixed wrapper messages. Immediate Error graphs exposed the nested values, and the actual installed Playwright serializer carried Error-valued causes into its reported graph. Checking only the top-level message missed the release.

**Root cause.** Refusal construction attached the untrusted returned spawn Error or JSON parse Error as `cause`. A fixed message did not remove their message, stack, nested causes or other own fields. Reporter serialization supplied another consumer of that object graph.

**Fix and standing check.** The wrapper removes exactly those two causes while preserving its fixed messages, status and withheld-byte rendering, receipt validation and integrity `finally`. `real-build-prefix50-subbuild-return-review-poppler.test.ts` keeps eight existing controls and adds five fixed cases covering valid/nonquiescent receipts, stderr, malformed stdout and a returned spawn Error with nested, ordinary, non-enumerable and symbol diagnostics. `real-build-poppler-diagnostic-test-support.ts` bounds own-descriptor traversal and uses the authentic installed serializer with loader/process/environment/cache restoration checks. The first run's four loader failures were corrected by nine helper lines, then all 13 controls and the isolated baseline passed.

**Class and bounds.** Withholding a message requires checking reachable diagnostics and their actual serialization, not only the displayed string. Restoring the spawn cause makes the intended immediate-marker assertion fail with seven marker paths; its retained serialized graph has four, while an adjacent stderr case separately fails a cause-shape assertion. Restoring the parse cause fails with two immediate paths and retains two serialized paths. The hard immediate assertion prevents the later reported-absence assertion from executing on these mutants; their saved serialized graphs are measured leakage, not a second executed RED assertion. The five synthetic returned-spawn cases do not cover synchronous spawn throws, arbitrary getters/non-Error causes, native diagnostics, publication or report-file writing. Sixty-six prior synthetic roots and eleven fresh parent roots were checked absent; the CIM process census was unavailable. The [dated evidence](../devlog/detailed/2026-09-05-poppler-diagnostic-causes.md) retains the failed instrument, exact mutant controls, authentic serializer bounds and unchanged source/native/camera limits.

---

## 2026-09-05 - Calibration runner cleanup preceded output ownership checks

**Status:** bounded runner ownership repaired and independently reviewed; the parent's selected rerun passed 93 tests with one unavailable file-symlink control. Complete Stage-1 readiness remains unproved and source-measurement admission stays closed.

**Symptom and investigation.** First-50 readiness review found calibration using the shared `test-results/playwright` directory. Installed Playwright deletes output before global setup, so later validation cannot prevent that deletion. Synthetic controls also reproduced independent reporter/last-run writes and attachment copying; no production calibration or user output was needed for the reproduction.

**Root cause.** The selected operation inherited shared output defaults, while ownership checks were absent before runner cleanup. Checking only the configured directory would also miss CLI/environment overrides and worker config re-evaluation. A second invocation must not adopt another run's record, and an actual worker must not create a second run.

**Fix and standing check.** `real-build-step44-calibration-runner-output.test.ts` covers live preparation, absent/recreated disposable directories, stale ownership, initial emptiness, real directory/file replacement, links, prospective paths and raw/resolved/test-output drift. `real-build-step44-calibration-runner-output-integration.test.ts` exercises both actual installed CLI entries and their workers, independent fresh runs, inherited-CLI refusal, pre-cleanup overrides, attachment/trace/last-run artifacts and five guard mutants with actual writer effects. `real-build-step44-calibration-global-setup.test.ts` requires output validation before source checks in every required-flag state. The operation and import-closure tests retain independent literal setup/teardown expectations and full-factory traversal; source discovery uses the shared pure selector without fabricating ownership. Wrong-selector, factory-divergence and source-before-output mutations fail, and restored bytes pass.

**Class and bounds.** An error after cleanup cannot undo an earlier deletion or write. The gate covers invocation ownership and independent writer paths before source snapshots and runner cleanup, with repeated checks before publication and attachment. Same-user authentication, filesystem races between observations and diagnostic-content release remain outside its claim. Normal closure of 28 recorded PIDs was checked; forced cleanup was not exercised. Windows denied the file-symlink instrument with `EPERM`, so that control is unavailable rather than passed. The [dated evidence](../devlog/detailed/2026-09-05-calibration-runner-output.md) distinguishes the earlier 80-pass selection from the later 93-pass run, whose extra live closure cases were admitted only for identity hashing, and retains the incomplete runtime, camera and campaign state.

---

## 2026-09-05 - Final browser refusal followed the protected transition

**Status:** the two-context transition checkpoint is repaired, independently reviewed and accepted after the coordinator's 45/45 rerun; complete Stage-1 readiness remains unproved.

**Symptom and investigation.** Independent review of the calibration delivery guard found Step-43 consumption inside the callback that preceded final policy accounting. A source-free reproduction caught a refused foreign fetch, advanced a synthetic consumption counter to 1, then returned lifecycle failure. The final red verdict arrived too late to prevent the transition.

**Root cause.** Sticky refusal was checked only after trusted callback work, while its browser context could still issue requests. A live-context counter check would also leave a check/consume race.

**Fix and standing check.** `real-build-prefix50-step44-calibration-phase-ordering.test.ts` exercises the actual owned lifecycle: first-context close and awaited route drain/refusal check must succeed before the sole transition can consume, then a fresh context may begin. Its fixed 14 cases cover callback/policy/close failures, refusal, in-flight work, fresh-context success and outer cleanup failures. Moving transition before awaited finalization made three selected controls fail, including consumption counter 1 for caught and tracked in-flight refusals. The gate retains the genuine in-memory session and one-use consumer; no token is forged to obtain source access. The separately repaired import-closure instrument also fails under a test-only ordinary-setup selection mutation. Exact bytes were restored before acceptance.

**Class and bounds.** A final failure verdict cannot prevent an earlier side effect. Caught and tracked refusals now stop the transition; scheduled cancellation is labeled separately and never counted as explicit policy refusal. The Node callback remains trusted, and the checks do not establish OS isolation, whole Stage-1 readiness or source qualification. The [dated evidence](../devlog/detailed/2026-09-05-calibration-context-transition.md) binds the baseline, mutations, retained 44/45 instrument failure, final 45/45 acceptance, native captures and cleanup limits.

---

## 2026-09-05 - Calibration browser requests lacked a context-wide delivery guard

**Status:** request-delivery and final-lifecycle scope repaired and independently reviewed; the later [transition repair](#2026-09-05---final-browser-refusal-followed-the-protected-transition) closes the Step-43 checkpoint gap. Full Stage-1 isolation remains incomplete.

**Symptom and investigation.** First-50 readiness review found that the separate static browser path still needed controls for requests from pages, popups, second pages and WebSockets. A later exception alone could not establish that a request never reached its destination. The retained guard-disable mutation demonstrates the distinction: foreign fetch reaches an owned canary and direct navigation reads an owned sentinel file.

**Root cause.** Owning a static server and browser process does not restrict browser-content delivery. Caught request errors can also conceal a refusal unless it survives the callback. The trusted callback's own Node/context access remains outside this guard's threat boundary.

**Fix and standing check.** The calibration-only lifecycle installs context HTTP and page-WebSocket routing before page creation, blocks service workers, and retains bounded refusal counters through cleanup and final assertion. `real-build-prefix50-step44-calibration-request-policy.test.ts` and `real-build-prefix50-step44-calibration-browser-integration.test.ts` cover exact origin/path/method rules, request metadata, all nine HTTP/WebSocket controls, two distinct file-refusal mechanisms, the synthetic import flow and cleanup. Together with existing source-closure and legacy browser checks, the coordinator's explicit rerun passed 39/39. Disabling the guard made the two selected controls fail, and the exact bytes were restored.

**Class and bounds.** Guard every page in the owned context before requests can be delivered, and distinguish prevention from an error reported later. These controls cover the fixed synthetic population and a trusted harness, not arbitrary Node access or general OS isolation. At this delivery-guard checkpoint, final policy accounting still followed the callback containing Step-43 consume; the later transition entry records its repair. All 12 strict records report cleanup, but the separate OS process census was denied. The [dated evidence](../devlog/detailed/2026-09-05-calibration-browser-policy.md) preserves these limits and the disqualified source incident.

---

## 2026-09-05 - Calibration selected the ordinary source-discovering setup

**Status:** repaired and independently reviewed with focused setup/import-closure gates; complete Stage-1 isolation remains unproved.

**Symptom and investigation.** During the user's first-50 continuation, entry-point review found that calibration selected `global-setup.ts`. Its static imports reached `sample-booklet.ts` and Vite before a function-level guard could help, although calibration already owns a separate pinned static server. A strengthened operation-selection case reproduced the wrong setup.

**Root cause.** A protected calibration operation inherited an ordinary bootstrap whose transitive imports discover recipes and configure development-server access. Checking only the calibration test body missed that independent entry point.

**Fix and standing check.** Calibration selects `real-build-step44-calibration-global-setup.ts`, which reads the required bootstrap manifest and asserts the held source lock without creating a server. The closure follows the actual selected setup and refuses reachable ordinary setup, sample-booklet discovery, Vite lifecycle/configuration paths, and Vite imports. `playwright-step44-operation.test.ts`, `real-build-step44-calibration-global-setup.test.ts`, and `real-build-step44-playwright-source-closure.test.ts` passed all 25 cases in the coordinator's independent rerun. Removing the lock call, adding a recipe-discovery import, and disabling the Vite guard each made the corresponding synthetic gate fail; exact bytes were restored afterward.

**Class and bounds.** Operation-specific setup or a transitive import exposes source discovery before a test body's guard. The gates cover the selected bootstrap and import graph, including admitted identity-only byte hashing; they do not prove every browser, Node, child-process, output, or diagnostic boundary. Other operations retain their prior setup and teardown. No browser or server launched during this repair; a Windows process census was unavailable.

---

## 2026-09-05 - Build playback clipped its controls and footer

**Status:** repaired with source-free desktop browser checks; the complete first-50 and full repository gates remain incomplete.

**Symptom and investigation.** Native review of the manual-playback failure screenshot showed the lower readout and footer cut off at a 1440 × 1000 viewport. The old test also expected `verified`, although the implemented final-membership preview correctly displays `preview` and carries no exact operation trace. Correcting that stale expectation exposed a separate failing layout-containment assertion.

**Root cause.** Opening playback adds a fourth direct workspace child, but the CSS still allocated only three rows. The playback bar occupied the fixed footer row, and the footer overflowed the workspace. Direct-child bounding boxes alone also missed nested text clipping during the first regression review.

**Fix and standing check.** The workspace gains an auto-sized playback row only while its direct playback bar exists. `manual-building.spec.ts` preserves the structural/validator/hash assertions and explicitly checks non-exact membership mode, a null trace commitment, preview text and its explanation. At 1440 × 1000 and 1280 × 720, the gate bounds every control, readout, verdict and footer, checks positive area and nested text ranges, and retains screenshots. It failed before the layout fix and again when a mutation squeezed the nested readout to one pixel with hidden overflow. Both repaired layouts and all seven native model views were inspected; their digest-bound review lives under `output/playwright/first50-playback-layout-reviewed-20260905`.

**Class.** A conditional panel adds a layout row without updating its parent, or a contained box conceals clipped descendant text. The check is bounded to these two desktop sizes and a two-step manual build; it does not establish arbitrary small-screen or long-name coverage.

---

## 2026-09-05 - Instruction captures silently used the presentation finish

**Status:** repaired with focused browser and fault-path gates; full repository verification and booklet camera qualification remain incomplete.

**Symptom and investigation.** While pursuing the user's first-50 quality request, the source-free four-stud experiment found camera-dependent presentation lighting in captures labeled `instruction-art`. Native inspection agreed with instruction-palette fractions of 1.9754%, 0.4739%, 0.2345%, and 34.1907%. A separate blue-brick browser test found all 12,059 model pixels off-palette in its first view and off-palette antialiasing in semantic masks. Both rejected packets remain under ignored output paths named in the dated devlog.

**Root cause.** `BrickViewport.captureInstructionView` changed camera and background but rendered the existing presentation projection through the antialiased, ACES-tonemapped viewport. Echoing the requested mode into metadata did not change geometry or the color pipeline.

**Fix and standing check.** `instruction-view-capture.ts` derives a fresh instruction scene for both art and masks and renders into an unlit, non-multisampled sRGB target. It restores the borrowed default-canvas renderer and disposes temporary resources. `real-build-prefix50-instruction-art-integration.test.ts` gates actual four-view/four-scale PNG palettes, nonempty bounded subject area, repeated-art equality, and unchanged seven-view presentation output. `instruction-view-capture.test.ts` exercises resource/state restoration under three injected failures and rejects stale documents or an already-active offscreen target. The original browser gate was observed red before repair; passing synthetic pictures does not qualify a booklet panel or camera.

**Class.** Capture metadata that promises a render mode the pixels do not use. Verify the actual color pipeline and rendered geometry through the user-facing capture path before relying on its measurements.

---

## 2026-08-23 - Six fail-closed paths hid genuine native Error detail

**Status:** fixed and gated in the Gate-3 step-7 evidence unit.

**Symptom.** The authoritative `npm run verify` reached Vitest and then failed five cases in `real-build-run-panel-camera-lifecycle.test.ts` - hostile page rejection, genuine raster failure, page-disposal failure, PDF plus loading-task cleanup failure, and hostile cleanup values - plus the hostile transition-witness case in `real-build-browser-output-v3.test.ts`. The retained error text had collapsed the genuine native failures into a generic non-native thrown-object fallback, so the evidence no longer named what actually failed.

**Investigation.** Running only those two files reproduced all six failures. Each path handed a real native `Error` to the newly generalized non-probing formatter. The blanket object fallback intentionally refused to inspect hostile objects but also erased safe own name/message data from native errors. The first repair was not safe enough: it called the live global `Error.isError` receiver and trusted `descriptor.value` without proving that `value` was an own data property, so replaced globals and polluted descriptor prototypes could still steer the formatter.

**Root cause.** The formatter had treated "do not probe an arbitrary thrown object" and "do not read captured own data from a proved native Error" as the same rule. Its attempted exception then depended on mutable globals and an incompletely validated descriptor record.

**Fix.** The browser path captures `Error.isError`, constructor/descriptor/Reflect/string/number intrinsics before hostile code can replace them and validates the descriptor of the descriptor's own `value` property. The host path uses captured `util.types.isNativeError`, builds Error-name descriptors on null-prototype records through captured `Reflect.defineProperty`, and both paths bound the resulting strings. Evidence branding uses captured `WeakMap` set/get methods, so prototype replacement cannot forge or erase membership.

**How it is checked from now on.** `non-probing-error.test.ts`, the two original failing suites, and the forced browser source-boundary controls cover genuine native errors alongside strings, null, arbitrary objects, proxies, accessors, inherited descriptor values, replaced globals and polluted prototypes. The focused repair set passes 115/115 plus three forced-browser controls, the final Gate-3-focused unit slice passes 132/132, and the complete repository gate reruns the original six paths.

**Class.** A safety formatter that hides the cause it is supposed to retain. The standing rule is to recognize only proved native errors through captured intrinsics, copy only validated own data, and keep every other thrown object opaque.
