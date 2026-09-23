# Review 18: implementation

## Target

This is a source-only review of the first fixture and raw-support increment under `output/first50-fresh-search-20260908/inverse-boundary-graph-01/`, against base `6300c6b817722d2652924ba9df7e06264c135e31` plus its preserved dirty tree. It is not a review of an inverse solver or a completed run. The exact authored preparation is retained at [snapshot 18](../snapshots/18_inverse-boundary-initial-preparation.md), SHA-256 `f289199254dbe1842b31bd00a6da4306f7ff32bd59b0bd39cecc1682b49f0a7f`.

The recoverable uncommitted code target is retained under `output/first50-fresh-search-20260908/inverse-boundary-graph-01/source-snapshot-initial-01/`. Its `mapping.json`, 2,688 bytes at SHA-256 `ac781fba0ac916d913093b728424b591bdc5d429c0944f5eabe9ad50d4a7bca1`, maps eight exact text copies to their original locations. The reviewer checked the original and retained-copy hashes below. The retained copies are review evidence, not additional runtime inputs, and must remain available while this review depends on the uncommitted source target.

| Original target | Bytes | SHA-256 |
|---|---:|---|
| Candidate `fixture.mjs` | 4253 | `be5252c6a871628efce340653f9c8c1cd84506d7902608ffd538d98236bd01ef` |
| Candidate `trace.mjs` | 5414 | `c5eb6bb360c754a6e4c4bef8a40a56a4785d0b56ddd4fe48b003d3f7d8c61db5` |
| Candidate `run.mjs` | 20197 | `6633b5fad6ea6271d5d3ea6e4035c3059d8965b215c8c11e4130935cbc42ca6f` |
| Candidate `preparation-initial-01.md` | 13812 | `f289199254dbe1842b31bd00a6da4306f7ff32bd59b0bd39cecc1682b49f0a7f` |
| Candidate `source-closure-initial-01.json` | 15482 | `5a036a62417ce5518e7e2fd23d70562608c87b430b1a4865e9805dabdddabbd2` |
| `apps/web/e2e/real-build-prefix50-subbuild-return-review-png.ts` | 10358 | `21fb281b7de222c9452a46c0731ef93400ba9ad68e0e24c094aa940345b3fa5c` |
| Root `package.json` | 6994 | `75e850cb2e03cc0bf14072d332dcde7d6ab5bc7edc937a553ce36e54d723a6b6` |
| `apps/web/package.json` | 592 | `992c1659e702f16c75c1516d978242370002fe7fe75b09aad670a2a596950799` |

The design parents remain [snapshot 12](../snapshots/12_inverse-boundary-graph-design.md) at `f91e05d14a9eb9c4849da764a56c44c8300c4889bebfeda24bae83b92c36c3c4`, [snapshot 14](../snapshots/14_inverse-boundary-graph-design.md) at `bb765b22632b2448931a0fa65f8220ac68c7490f6e51af364cecfc302dfd11e9`, and [snapshot 17](../snapshots/17_inverse-boundary-graph-design.md) at `b3d91e608d45831320982c1530a7fcd5cc9b607a59a8e33a550c84d9f3b60536`. The original preparation closure remains `4838d4eb314c3eb589367a4f6d393917c3945fa9ee85898f9931c75d7cd7697c`. New `inverse.mjs` and `interval.mjs` are not included or claimed.

## Reviewers and coverage

Reviewer: `/root/boundary_observability_review`, independent of the source author `/root/inverse_boundary_source`. The reviewer whole-read all three new modules, the preparation and closure, the reused PNG codec, the two package files and the ignored source-retention mapping. The review compares source behavior with the frozen parents and the earlier independent N2 interpretation. It covers analytic geometry and visibility ordering, pixel-only observation, pair and topology checking, evaluation order, finite-probe claims, resource limits and the application import/read/write closure.

The root integration owner separately whole-read the same frozen sources and reported no contrary material code issue. This report attributes that agreement without treating it as another execution result. No project code was parsed by a language runtime, imported, tested, typechecked or executed in this review. No raster was created, decoded or inspected; no PNG payload, native geometry, protected source, scorer truth, old route result, browser, model or network operation was used. Node and its OS loading behavior were not executed or measured. The only review writes are this report and its exact preparation snapshot.

## Reports

### Independent source and closure assessment

#### The initial painter matches the declared source geometry within its scope

`fixture.mjs:18-35` evaluates polygons and the radius-30-by-18 image ellipse at doubled integer pixel-center coordinates. The polygon crossing predicate uses integer cross products, includes an exact boundary tie, and stays within safe-integer arithmetic for the fixed 720-by-470 domain. The ellipse inequality `324*dx*dx + 900*dy*dy <= 1166400` is the correct doubled-coordinate form. There is no antialiasing, ink stroke, external input or hidden palette-role output.

`fixture.mjs:38-60` fills the two visible platform sides, then the top, then each stud's projected body/front-base region and cap, and finally P2's foreground polygon. The cap overwrites the covered wall and rear-platform portions. The four studs have disjoint horizontal projected interiors, so their iteration order does not choose a competing stud depth. For the declared upright positive, the rectangle-plus-lower-ellipse body fill followed by the full cap gives the intended visible cylinder wall. This is a source/algebra assessment of the analytic fixture, not proof that the generated pixels will be correct.

The selected altered member is explicitly index 0 in N1/N2. N1 changes its body/base displacement to 24 while preserving its cap. N2 replaces only its cap with the same-extrema rectangle, retaining underlying wall/base geometry and drawing only what survives opaque masking. The negative fixtures need not be valid members of the positive four-cylinder family. P1 uses the exact decoded P0 PNG from the same invocation and inverts each RGB byte while preserving alpha, rather than rerendering an approximate photometric variant. The fixed palette's unequal-color differences exceed all seven contrast thresholds.

#### F13: N2's conic discriminator remains a later obligation

The opaque interpretation is consistent with the parent's no-hidden-line rule. It also hides the underlying flank evidence: the rectangle covers vertical coordinates `[cy-18,cy+18]`, whereas the original generators at `cx +/- 30` occupy `[cy,cy+16]`. Any coincident visible rectangle-side pixels have cap-edge ownership, not independent observed wall-generator ownership. The base front arc also loses its endpoint neighborhoods; its visible portion must satisfy `16 + 18*sqrt(1-((u-cx)/30)^2) > 18`.

Consequently an otherwise sound incidence check can refuse a complete four-stud assignment before inspecting the false cap conic. An extrema-only implementation might also refuse for that same missing-incidence reason. Complete-assignment refusal alone would therefore not demonstrate the parent's intended N2 conic discriminator. Before the later full experiment can claim this control passed, an independent conic-specific check and its extrema-only mutant must demonstrate the intended distinction on actual supported boundary evidence, or a focused successor must revise that control's acceptance design.

The present source handles this limitation honestly. `run.mjs:223-233` assigns zero ellipse probe sites to the changed N2 cap and states that the conic mutant remains untested. The summary at `run.mjs:325-327` leaves conic control and all physical/camera acceptance metrics unrun or unimplemented. The preparation explains the opaque-mask confound. F13 is thus an open later-stage obligation, not a defect that prevents source-only acceptance of this initial raw stage.

#### The raw tracer preserves the declared observation boundary

`trace.mjs:65-112` receives fixed-size dimensions/RGBA and an operational checkpoint callback. It imports no fixture, case, geometry or camera data. Each unequal right/down neighbor pair produces one shared dual-grid side, identified by `2*p+axis`, with both original pixel indices, both RGBA tuples, exact maximum-channel contrast and seven strict-threshold membership bits. No physical center, stud index, cap/base assignment or confidence is emitted. The two-pixel envelope is explicitly `declared-unverified`.

`trace.mjs:12-62` preserves every active segment in maximal chains between non-degree-two vertices, with complete cycles for components containing only degree-two vertices. Degree-three nodes remain branches. Four-way nodes retain all three distinct perfect pairings; no pairing is selected. Nested threshold populations with equal counts are identical because membership is monotone, so sharing their topology does not discard a distinct population. The segment and compact-chain limits throw incomplete failures rather than returning a truncated successful graph.

#### The independent checker covers the complete fixed pixel population

`run.mjs:84-186` does not import tracer helpers or the tracer's threshold constant. It enumerates neighbor pairs in a different order, reconstructs the expected row bytes and shared-side vertices, and checks every one of `470*719 + 720*469 = 675610` pairs per input. Its comparison detects missing, invented, duplicated or byte-mismatched support and wrong memberships. It reconstructs incidence from the checked rows, walks the saved ordered chains, checks interior degree, terminal degree, closed-cycle claims, coverage and node incidence, and requires all three distinct four-way pairings. Each contrast level is accounted for, including the compact population equivalence.

The wrong-output controls at `run.mjs:245-267` mutate copies of actual P0 output: missing support, a wrong membership, broken chain coverage and a missing four-way pairing. Each reports its applicable population and exercised count. Absence of a four-way node is explicitly unexercised, not a passing mutation proof. Budget failures are rethrown and cannot count as successful mutant detection. This source design is appropriate for the raw observation/checker scope; this review does not claim any control has run or that the later independent camera-certificate checker exists.

The control wrapper catches any non-budget exception. Outcome review must therefore inspect each actual rejection reason and confirm that the intended invariant rejected the mutation; an unrelated `TypeError` is insufficient evidence. The four frozen mutations appear to target explicit checker invariants, but only their exact execution results can establish which rejection occurred. This is an acceptance requirement for those results, not a request for an extra run or a general error-handling change.

#### The output barrier and finite probe claims are honest

The first loop in `run.mjs:287-300` writes all eight PNGs, graphs and overlays before the coordinate-based audit begins. P1's own P0 decoding and the common codec round-trip check are part of generation; neither supplies expected physical labels to the tracer. Fixture source necessarily contains its authored coordinates from module load, so this is an interface and evaluation-order boundary, not a claim that labels were unread by the process or that an independent security identity was used.

After the barrier, each PNG/graph is reopened only through the invocation's recorded filename/size/hash table. The raw graph's RGBA digest must match its decoded saved PNG. The P0/P1 comparison checks exact inverted pixels plus graph support IDs, membership and topology. These checks do not make the files immutable against an adversary; they detect a changed own file before accepting its bytes, within the declared cooperative scope.

`run.mjs:189-235` separately records finite nearness probes. It checks 258 rational ellipse sites per unchanged audit rim, including repeated parameter endpoints, and reports the four extrema separately. Its front-edge probe uses 161 fixed sites on actual raw chains with endpoint-near support. It reports missing sites without removing them, warns that P2 foreground proximity is not rim ownership, and never turns proximity to any boundary into a physical label. The status remains `finite-support-measurement-only`, with continuous coverage and visibility unverified and physical ownership unimplemented. An `initial-raw-stage-checked` summary therefore does not claim a supported raised stud, a continuous two-direction envelope, an anchor localization, a camera interval, a feasible witness or a passing N2 conic test.

#### Application closure is narrow; launch and resource admission remain open

The import/read/write calls match the recorded application closure. The fixture and tracer have no imports. The runner imports those modules, the exact native TypeScript PNG codec, and `node:fs`, `node:crypto`, `node:path`, `node:url`, `node:process` and `node:buffer`. The codec imports only `node:buffer` and `node:zlib`; its top-level CRC table construction and exported codec/crop helpers do not discover or read a project payload. The two package files identify ES modules. Direct loading does not invoke their npm scripts.

Explicit runtime source reads are the three candidate modules, codec and two package files. Result reads are restricted by the invocation's ownership table to its own eight PNGs and eight graph JSONs. The runner accepts only the fixed argument shape and exact resolved output child. `mkdirSync` creates that child without recursion or reuse, ordinary output writes use `wx`, and no file is deleted. At review time the five recorded nearer package paths and `run-v2-initial-01` were absent. These observations must be refreshed before any admitted launch; they are not durable absence guarantees.

Source/package identities, nearer metadata absence, path identity, the exact Node binary and the prelaunch environment still need launch admission. The in-program `NODE_OPTIONS`/`NODE_PATH` check occurs after static imports and cannot stop a preload that has already run. The preparation acknowledges that limit. This review did not measure OS executable/DLL loading or establish filesystem/process isolation. Source hashes recorded after module loading are provenance within the prelaunch freeze, not a substitute for that freeze or a proof against same-user races.

The graph bounds are explicit, and the output budget reserves terminal failure space inside 64 MiB. Generation/check phases accumulate sampled per-case work toward 60 seconds. RSS checkpoints detect observed excess over 256 MiB. Serialization, codec buffers, object/Map overhead, garbage-collector retention and time between checkpoints are not a proved process-memory or external wall-time bound. The source and preparation say so. Runtime/resource admission must resolve the parent limit before execution can be accepted; a separate inquiry into peak-memory measurement cannot silently change this frozen target or the meaning of this review. No hard-cap claim is inferred from a sampled number or a Node heap flag.

#### Document accuracy and review limit

The preparation accurately describes the three implemented source files, fixed selected negative members, no-ink masking, pixel-only tracer, evaluation barrier, complete raw checker, finite-site denominators, untested N2 discriminator and absent later solver. It distinguishes authored source from executed, visually inspected or accepted artifacts and leaves `executionReady` false. No additional material source-code finding was identified within this bounded initial-stage scope. This does not validate syntax, runtime behavior, the actual painter output, memory use or any later camera contract.

## Findings and disposition

| ID | Finding | Disposition and reason | Repair or follow-up |
|---|---|---|---|
| F13 | Opaque rectangle masking hides N2's original flank evidence, so missing-incidence refusal can masquerade as conic-control success in the later full experiment. | Open later-stage obligation; accepted by the root integration owner. The initial source correctly labels conic control not-run, so this does not block source-only acceptance of the raw stage. | Before claiming the full N2 control passed, demonstrate a conic-specific distinction with the required extrema-only mutant on supported evidence, or freeze and review a focused successor control design. |

F14 is unused. The root integration owner accepted the bounded source-review verdict and reported no contrary material code issue. Launch/bootstrap/resource requirements remain explicit unresolved prerequisites rather than invented executed findings.

## Verification

Whole-read all three new modules, the authored preparation, source closure, reused codec, two package files and source-retention mapping as text. Checked original and retained-copy hashes for all eight recorded text targets and the mapping hash. Checked the recorded nearer package and output-child absences by metadata only. Assessed the integer geometry, opaque ordering, graph and checker logic, barrier and bounds from source. No parser, import, syntax/type/test command, renderer, image creation/decoding/inspection, browser, native runtime, network or model execution occurred. Documentation verification covers the report's required headings and links, exact preparation snapshot bytes, fences and trailing whitespace.

## Round outcome

Conditional source acceptance for the initial fixture and raw-support stage only. F13 remains open for the later conic-specific control; no additional material source issue was found. Execution is not admitted: launch/bootstrap identity and actual resource handling remain unresolved, and no raw pixels, support result, continuous coverage, physical correspondence, camera region or conic result has been verified. The ignored exact code snapshot and mapping retain this review target; later source changes require their own review and do not inherit this verdict.
