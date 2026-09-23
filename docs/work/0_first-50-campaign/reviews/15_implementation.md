# Review 15: implementation

## Target

Independent focused review of the immutable `judge-child-v2` finite synthetic estimate-record checker under `output/first50-fresh-search-20260908/forward-camera-route`. Base and observed HEAD: `6300c6b817722d2652924ba9df7e06264c135e31`, branch `main`, repository `%USERPROFILE%/Documents/github/lego`. The existing dirty tree is preserved. This review accepts no production change or unrelated work.

The exact authored targets are retained as [admission](../snapshots/15_judge-admission.md), 16,736 bytes, SHA-256 `37c05920c85802340351bd7cf02789293b231dd8f9864236a50768b6c8b45409`, and [results](../snapshots/15_judge-results.md), 7,313 bytes, SHA-256 `577b64d061666c275dd7ce16d96f2f346cb5dddd514f6d2a86930b04c856ea9c`. The admission's source-only status is its frozen preparation-time status; results and this review describe the later measurements.

The eight-file executable/data closure is bound by `judge-child-v2/source-roster.json`, SHA-256 `6736d5a82de7f391b89fa8e5edc67a0c82fbbed4f26efec4f5c3382a4c3326b8`. Its seven members and the roster itself match current bytes and the retained byte-exact [packet source](../../../../output/first50-fresh-search-20260908/forward-camera-route/review-15-verification/packet-source/). The 36 original payloads match `input-roster.json`, SHA-256 `9373185026a18e1761de1c27f7e0d9e60100e251e2b10b9d1a484f0567e39ad2`. The review's locator is the actual [population handoff](../../../../output/first50-fresh-search-20260908/forward-camera-route/judge-v2-population-handoff.json), SHA-256 `7e63884a883411145a88c08ebb1b0617952c66caf4c2dd5f3ab67adf81942835`; its summary claims were checked against the underlying records.

| Reviewed executable | SHA-256 |
|---|---|
| `judge-core.mjs` | `72005b3939d22af39a175696e08e1679bc62759c364bf7b8ed2ff5a0c45587f1` |
| `judge-io.mjs` | `ee5c82092d482e1ac0d03e20b55b20c85cc52599649454c9dcf67d13892c299e` |
| `judge-record.mjs` | `22155577a07e7f49bfc2f8f769f99a873b9c9b9d8f738af139632b0b7bcf8d10` |
| `make-record-mutants.mjs` | `8f1228a903d94feefdaa9c64536bbcb6ad4a06f37aebfc5fdbfaf57da8fd0442` |
| `check-controls.mjs` | `bf14c311370a5f734569449bf103280acf2d3f2f6f08db27c4ffe07e8c7c6187` |

## Reviewers and coverage

Reviewer: `/root/forward_judge_review15`, 2026-09-08. Acceptance was derived from the admission and [review 13](13_implementation.md) F11/F12 before inspecting outcomes. Review 13 still hashes to `772445265da99a7e0d33f61bc7231fe2ed8462b4d0029d99b9d47827dc4f9f2c`. The earlier `review-15-verification/source-admission.md` was read as evidence and independently checked against current source.

Required acceptance: all six immutable baseline records pass with complete validation and zero errors; each of twelve distinct, single-path mutants produces its named semantic error with complete validation and exit 1; symmetry means distinct physical owner-swapping poses, not translation copies; each claimed edge and pair is checked from its pinned data; reported sign/aggregate flags cannot confer validity; output and execution provenance agree; and the claim remains conditional finite pixel compatibility.

The reviewer read all five executables, admission, source/input rosters, controls, actual eighteen judgments including every one of their 63 errors, twenty execution receipts, forty raw stream files, all output identities, mutant manifest/precheck, original estimates and private synthetic payloads, and the final comparator output. Read-only PowerShell arithmetic independently checked positive sample/pair semantics and single-path mutations. No checker, mutant writer, comparator, estimator, generator, renderer, import, syntax check, test suite, browser, GUI, server, native payload, installed Poppler, PDF reader, protected panel output or network request was executed. Existing images were not displayed again: this changes a record checker, not rendered geometry; this review makes no new visual correctness claim. The only writes are this report and its two exact document snapshots.

## Reports

### `/root/forward_judge_review15`

#### F11: physical ambiguity and absent support

`judge-core.mjs:34-45` derives the geometry-preserving permutation under the proper half-turn `diag(-1,1,-1)`. It requires even regular-prism side count and a bijection of the solids. Lines 168-174 require every stud ID to move, the true camera row and its opposite azimuth at identical elevation, up sign, scale and translation, and zero top edges, base edges and pairs across every ownership group. Lines 175-176 impose the zero-support requirement for erasure independently of the reported four-group boolean.

The actual symmetric geometry has a centered body from x=-40 to 40 and z=-10 to 10 and four equal 32-sided studs at x=-30,-10,10,30. The rotation fixes the body and exchanges stud0/stud3 and stud1/stud2. The baseline has nine translations at azimuth 30 and the same nine at 210, elevation 30, up sign +1 and scale 2. Both include private translation [351,242]. All groups are empty. The translation-only mutant retains nine rows at azimuth 30, including the true pose, and fails solely with `SYMMETRY_DISTINCT_PHYSICAL_ROWS`. Thus translation multiplicity cannot satisfy this control.

The partial-owner symmetric mutant deliberately retains a valid stud0 group: 32 top edges, 46 base edges and 232 independently valid pairs. The other groups and false aggregate remain untouched. It fails solely with `SYMMETRY_ZERO_FIXED_OWNER_SUPPORT`, so the negative rule is being exercised after the positive per-group checks succeed. The erased baseline has zero poses and support. Its one-pair mutant has no edge references and fails with `PAIR_REFERENCE`, `PAIR_SET` and the required `ERASED_ZERO_WALL_RIM_SUPPORT`. All three errors are appropriate and retained.

These source changes and exact negative controls resolve F11 for the declared captured-record population. They do not prove arbitrary geometries symmetric or rerender every retained explanation.

#### F12: independently derived edges, pairs and signs

`judge-core.mjs:64-89` verifies whole-buffer dimensions, tones, owner/surface ranges and part kinds, then reconstructs canonical RGBA adjacency IDs. Lines 116-130 validate each claimed edge's kind, coordinates, tones, pixel-center midpoint and private owner/surface. Lines 14-23 construct a local camera frame without importing the estimator, generator or a projection routine. The four-unit stud height is projected from model top/base centers. Lines 99-104 separately check the reported +Y projection; reported projection values do not predict the private displacement.

Lines 134-159 resolve pair references inside the claimed owner group, derive dx/dy, require the exact [dy-3,dy+3] endpoints, check private containment/sign and Euclidean compatibility, and require all and only compatible pairs among the validated reported edges across every retained finite camera row. Lines 160-179 derive group and four-owner decisions and compare them with the reported flags. A forged camera sign can therefore leave independently derived pair/group quantities true while the record correctly fails its separate `CAMERA_PROJECTION` check. Likewise, the false group-sign mutant derives a true group and rejects the false reported flag; it does not inherit the reported flag.

Independent read-only arithmetic over each positive original record checked all 316 reported edges, canonical ordering among them, neighboring RGBA samples, midpoint coordinates, 446 private stud sample references, every one of 938 pair references/intervals, and the compatible pair set over all 6,046 top/base combinations. The private displacement was derived separately as `(base-top)*scale*upSign*cos(elevation)`, approximately +6.928203 pixels for native/horizontal and -6.928203 for vertical/combined. All 36 positive camera-row projection declarations agreed. The 1,264 edge records, 1,784 stud sample references and 3,752 pairs produced zero discrepancies. References are counted with repetition; they are not distinct image support sites. This arithmetic did not perform another full-image adjacency scan or reconstruct finite owner consensus through rendering.

| Baseline | Retained rows | Claimed top/base edges | Valid pairs | Signed groups | Actual exit / errors |
|---|---:|---:|---:|---:|---|
| Native | 9 | 130 / 186 | 938 | 4 positive | 0 / 0 |
| Horizontal | 9 | 130 / 186 | 938 | 4 positive | 0 / 0 |
| Vertical | 9 | 130 / 186 | 938 | 4 negative | 0 / 0 |
| Combined | 9 | 130 / 186 | 938 | 4 negative | 0 / 0 |
| Symmetric | 18 | 0 / 0 | 0 | 0 | 0 / 0 |
| Erased | 0 | 0 / 0 | 0 | 0 | 0 / 0 |

#### Every mutant and additional error

All twelve actual mutants differ from their original at exactly the declared path. Independently restoring only that path recovers the entire parsed original in every case. The frozen source never chains one mutant into another. Each judgment has `recordValidationComplete: true`, `pass: false`, the expected named error and actual exit 1. `errorCount` equals the complete retained error-array length in all eighteen judgments, so the 256-error storage cap hid no error.

In the table, the common three-error consequence means `GROUP_SIGN_AGGREGATE`, `FOUR_GROUP_AGGREGATE` and `POSITIVE_FOUR_SIGNED_OWNERS`, each once. These follow when one claimed positive group has invalid support. The table accounts for all 63 errors, including repeated errors at distinct pair paths.

| Mutant | Direct required error | All additional errors | Total |
|---|---|---|---:|
| symmetry-translation-only | `SYMMETRY_DISTINCT_PHYSICAL_ROWS` | None | 1 |
| symmetry-partial-owner | `SYMMETRY_ZERO_FIXED_OWNER_SUPPORT` | None | 1 |
| erased-partial-wall-rim | `ERASED_ZERO_WALL_RIM_SUPPORT` | `PAIR_REFERENCE`, `PAIR_SET` | 3 |
| sign-inversion | `PRIVATE_DISPLACEMENT_SIGN` | `INTERVAL_ALLOWANCE`, `PRIVATE_INTERVAL_CONTAINMENT`, common three | 6 |
| forged-interval | `INTERVAL_ALLOWANCE` | Common three | 4 |
| wrong-reference | `PAIR_REFERENCE` | `PAIR_SET`, common three | 5 |
| false-aggregate | `FOUR_GROUP_AGGREGATE` | `POSITIVE_FOUR_SIGNED_OWNERS` | 2 |
| false-group-sign | `GROUP_SIGN_AGGREGATE` | None | 1 |
| wrong-sample-tone | `EDGE_SAMPLE_PIXELS` | Eight `PAIR_REFERENCE`, `PAIR_SET`, common three | 13 |
| forged-midpoint | `EDGE_MIDPOINT` | Eight `PAIR_REFERENCE`, `PAIR_SET`, common three | 13 |
| wrong-edge-kind | `EDGE_REFERENCE_KIND` | Eight `PAIR_REFERENCE`, `PAIR_SET`, common three | 13 |
| forged-camera-sign | `CAMERA_PROJECTION` | None | 1 |

The sign-inversion control changes [1.5,7.5] to [-7.5,-1.5], so allowance, containment and sign fail together. Widening that interval to [1.25,7.75] retains its sign and private containment but correctly fails the exact allowance contract. Wrong reference replaces a top ID with a base ID. The sample-tone, midpoint and kind controls invalidate the first top edge, which all first eight pairs reference; those eight pair failures are the intended consequence, and the independently valid pair count falls from 232 to 224 in that group. No additional error is unexplained, an incomplete execution, or a substitute for the named semantic rejection. These controls and the positive corroboration resolve F12 within the stated record scope.

#### Provenance, execution and document accuracy

`judge-record.mjs:9-16` binds the estimate, baseline, mutant manifest, five private/public payload identities and eight source identities into each judgment. `check-controls.mjs:11-23` independently repeats single-path restoration, requires complete expected outcomes, and checks those identities. It does not itself inspect process exit codes; the twenty external receipts supply those separately. Every receipt's before/after source and original-input roster was independently compared with all eight current source and all 36 current original-input identities. All matched, as did all twenty receipt hashes, 52 emitted file identities and forty actual empty stdout/stderr streams.

The final comparison has eighteen matching outcomes, six passes and twelve named rejections. Its SHA-256 is `b2c6d3fd48de82188bf45cfab05d0e76cad1803327a1a1faf00301e4c674c8fd`. The twelve-member mutant manifest is `292a7b4a4a0465dfe370a553ed8bc3f113cc4256bbed2afa7d1aa7c986f75084`; the independently corroborated precheck is `d6e9e9906e5511748f360d8a40453feb9391f92a83aa7b00c60a1219bb25bec0`. Receipt commands and timestamps show one native baseline followed by the five other baselines, mutant preparation, twelve mutant judgments, and final comparison in dependency order. Both utility commands exited 0. The longest recorded invocation is 230.8142 ms; maximum sampled RSS is 66,248,704 bytes. The source and documentation correctly disclose cooperative sampling rather than an OS memory or preemptive time guarantee.

The retained dispatcher parse failure, SHA-256 `04d7af95e268b2e2b85fcf31aa85e994646d9d473fb008fc904a38fabd57fdb2`, records zero nested command or candidate execution and no candidate outcome. Its preserved source/input checks and absence of the nineteen remaining outputs support the documented orchestration-only correction. It is separate provenance, not a twenty-first candidate or a failed mutant.

One existing documentation qualification remains explicit: admission line 105 describes operational failure as exit 2 with failure/telemetry files. Source setup is outside the entry-point `try` blocks (`judge-record.mjs:5-8`, `make-record-mutants.mjs:4-12`, `check-controls.mjs:4-7`), so a startup pin or fresh-directory failure can instead exit 1 without that receipt. The earlier source-admission note already identified this. No such failure occurred in this population, and the comparator cannot count missing/incomplete judgment output as a named rejection. This report limits that sentence to failures reached inside the guarded phase; frozen admission bytes are preserved. It is not an unresolved F11/F12 defect or a reason to expand this finite repair into general startup hardening.

The results otherwise match the source and measured records. Whole-estimate pins restrict the accepted baselines to these six records. Pair-set completeness is among reported validated edges, not all theoretically recoverable owner edges. The checker verifies recorded 1,440-camera accounting without rerunning the census. The three-pixel allowance and separate 1e-10 arithmetic margin remain unchanged. This is neither continuous correspondence nor outward-rounded numerical certification.

## Findings and disposition

| ID | Finding | Disposition and reason | Repair or follow-up |
|---|---|---|---|
| F11 | Original negative controls permitted translation copies or partial owner support. | Resolved for this immutable finite captured-record checker: physical half-turn and zero-support checks are exercised by the intended controls, including two isolated single-error rejections. | Preserve the original deficient judge and outputs; do not transfer this review to changed geometry or records by filename. |
| F12 | Original judge trusted signed-pair output and aggregate flags. | Resolved for the stated scope: independent reconstruction/projection and derived decisions pass four positive records and reject all nine positive-record mutations at their required semantic checks. | No additional execution or production promotion is implied. |

No new material finding was found. F17 and F18 remain unused. The startup documentation qualification above is carried forward rather than silently treated as a stronger failure-receipt guarantee.

## Verification

All twenty execution receipts and all eighteen actual judgments were read and cross-checked, including every semantic error, output digest and before/after pin. All twelve mutations passed independent restoration checks. Positive record arithmetic matched the quantities stated above. No candidate process was rerun. Raw invocation outcomes are retained evidence, not personally observed fresh execution. No browser, GUI, server, watcher or candidate child process was launched by this reviewer, so no such task-owned resource required cleanup. Prior campaign evidence and this handoff remain needed and are retained.

The report and two snapshots were checked for trailing whitespace and Markdown fences. Report links were checked relative to this report; exact snapshot links were checked against their original artifact directories so their bytes remain unchanged. Current source/input and snapshot digests were rechecked after authoring. The report is authored documentation in the existing main checkout, uncommitted at handoff; ignored checker and run artifacts are likewise uncommitted. No merge, commit, push or full production verification is claimed.

## Round outcome

Accept the F11/F12 correction and the exact six-pass/twelve-rejection population as a bounded finite synthetic record-checker result. This review grants no new source access, execution, continuous-camera, fractional-translation, antialiasing, printed-art, full finite-owner-consensus, exact-point, native-runtime, production, placement or first-50 completion authority. Four synthetic studs remain four studs. The broader campaign remains incomplete, and the separate continuous design remains unexecuted.
