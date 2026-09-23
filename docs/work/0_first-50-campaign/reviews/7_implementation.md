# Review 7: implementation

## Target

Independent review of the source-free RGBA physical-correspondence candidate and its bounded repairs. Repository: `%USERPROFILE%/Documents/github/lego`. Assignment base: `6300c6b817722d2652924ba9df7e06264c135e31`, supplied by the persistent implementer; this reviewer performed no Git operation and does not independently attest HEAD or the broad dirty tree. The reviewed implementation is ignored experimental code, not a committed production change.

The final authored boundary is preserved byte-for-byte as [snapshot 7](../snapshots/7_rgba-preparation.md), 11,474 bytes, SHA-256 `1a64230d9f9b13992bcdc49666bb58803fe4c0f102be1b518e3575c7384cb7d5`. The earlier design obligations remain in [review 3](3_design.md) and [scope snapshot 3](../snapshots/3_raster-producer-scope.md). The raw evidence root below is `output/first50-fresh-search-20260905/raster-rgba-producer-2e8509/`.

The final recoverable source is the eight complete files in [snapshot-admitted-04](../../../../output/first50-fresh-search-20260905/raster-rgba-producer-2e8509/snapshot-admitted-04/). Each was independently hashed and matches the actual run-04 source roster. Earlier executed source remains intact in `snapshot-admitted-01/`, `snapshot-admitted-02/`, and `snapshot-admitted-03/`; the isolated old-bound mutation remains in `mutant-old-bound-03/`. These exact ignored sources and results remain necessary to recover this uncommitted review target and its counterevidence. No raw source, execution output or PNG is promoted into Git by this report.

| Final source | Bytes | SHA-256 |
|---|---:|---|
| `harness.mjs` | 12,195 | `81c7ed12a8a9c7a47b3a386ad85c6e0125c7139ef42d3ec05d459e487cad5e17` |
| `generator.mjs` | 3,310 | `b0055b87bf62302663192d7f41d0e455da8102420be4b267e16bc0a6ac6925f7` |
| `extractor.mjs` | 10,224 | `5a5aa67ac248969c64b808237deda4e6a5a256a3dee401d805add737d42da584` |
| `intervals.mjs` | 3,510 | `703988cdebdb4ad22810ba144c00177b5b9215e0f9dfed8e66acd88cd8080bc2` |
| `pixels.mjs` | 3,867 | `75a62c5df579858aa316f0a4325aeb3eab76c5b86c6a5875569567d786f4c46a` |
| `frame.mjs` | 1,608 | `e689c9f8c6f8ba7aac23f8a78e40a06b1093c414208fed32dbf45a2d7beabdf5` |
| `grammar.mjs` | 1,874 | `753b86d6971a3416ea81fa00d95257ef2333c956bb06d222e1a39c7c0e292a7e` |
| `png.mjs` | 922 | `c3fc1c91fefcc18b31a12c802a4fed02f3c719fe1161afc193bc4db38a966702` |

## Reviewers and coverage

Reviewer: `rgba_independent_review`, independently assigned read-only implementation and evidence review, 2026-09-08. Read the immutable executed source snapshots, attributed preparation history, actual run summaries, applicable AGENTS/local rules/lesson queue/specification sections, and the fleet work-document rules. Checked the actual source text for the admitted rotation, coordinate conversion, no-roll camera convention and frozen dark-core predicates. The first findings came from independent source inspection before the persistent implementer disclosed its matching findings.

This reviewer did not execute or import the candidate, run probes or tests, open a protected PDF or native panel, read runtime payloads or source-bearing incident artifacts, launch a browser/server/native application, or edit implementation code. The only authored repository files are this report and the exact preparation snapshot. All retained harness executions were performed by the persistent implementer task `01a073ae` / `root`, not the chief task `01a07391`. This reviewer inspected the actual recorded results and independently viewed the synthetic PNGs listed below. Author-side views and independent review views are separate observations; neither is a blind or native-source qualification.

## Reports

### rgba_independent_review

The final candidate makes useful, nonvacuous progress on the finite synthetic experiment requested by review 3. It extracts actual RGBA supports, returns all four correspondences on a positive, retains a second physical owner even when its camera is identical, and refuses the necessary pixel erasures and the top/base pixel swap. Its corrected physical-rim bounds include the shared rounding errors. I found no additional material counterexample within the inspected, stipulated family after the repairs below.

The bound is narrow and explicit: a 720 by 470 exact-tone schematic, fully outlined axis-aligned ellipses, complete vertical wall tangents, an asymmetric member outline, independently supplied up sign +1, shared integer layout snapping, and at most one supported vertical seam contact. The physical height and radius are synthetic constants. This is not evidence that the unread booklet has those drawing semantics, that the real member's rim geometry is admitted, or that arbitrary camera poses and ink formation are covered.

#### F6 — Independent half-pixel rim-center bounds omitted shared layout error

Priority: P1 for a correct physical-curve claim. In snapshots 01 and 02, `intervals.mjs:8-13`, SHA-256 `738be8b0ffc5860480601acfe29fc00a30642b68e0ba4feeffef1e4a313b395a`, assigned every physical center its own plus-or-minus 0.5-pixel interval. The declared formation instead rounds the shared origin and shared pitch before constructing all four centers. A physical center therefore accumulates the pitch rounding error with its stud index. Top centers also combine origin-y and height rounding errors.

A camera-consistent counterexample needs no unknown owner or native image: take scale and pitch 39.4, projected height 18, origin x 348.4, horizontal radius `197/15`, and vertical radius `sqrt(6409)/15`. These satisfy the positive quadratic camera relation and round to the same 39-pixel pitch, 18-pixel height and 13-by-5 radii. The fourth physical center is 466.6, outside the old interval `[464.5,465.5]`. Its positive-x rim extreme differs from the snapped extreme by more than the old one-pixel pointwise bound. The green run-02 fixture result did not catch this incorrect physical uncertainty claim.

The final `intervals.mjs:8-22` retains shared origin/pitch/height/radius parameters and explicit center expressions. It derives x-center uncertainty of plus-or-minus `(0.5 + index*0.5)`, top-y uncertainty of plus-or-minus 1, and base-y uncertainty of plus-or-minus 0.5. Adding radius rounding gives the stated all-phase coordinate bounds by the triangle inequality. `extractor.mjs:148-152` derives these records from the complete ordered four-pair hypothesis. The shared camera constraints remain attached; the returned marginal boxes are conservative and are not a claim that every independent combination of their endpoints is feasible.

The withheld continuous fixture in `generator.mjs:20-28` uses physical scale/pitch 39.49 and origin x 348.49. It renders the same RGBA bytes as the integer positive while its true last center is approximately 466.96. Run 03 contains that center in `[463,467]` and checks all four top/base centers and radii, camera coupling and the all-phase curve bound. The isolated mutation restores only the old `rimUncertainty` function; all seven other source files match snapshot 03. Its actual run fails `continuous-all-four-correlated-centers-and-radii`, so the regression result is not solely caused by the old pointwise field having a different shape. The old-bound assertion and all-phase check also fail. F6 is repaired for this exact formation model; no native ink-to-rim bound follows.

#### F7 — Mutation coverage could pass without reaching the mutation, and missing controls disappeared

Priority: P2 for the experiment's evidence. Snapshot 01 `harness.mjs:74-75`, SHA-256 `e8802e267a66dec4ca8f26b5126e87ed939479fbe77343d8fd5b5112bcc01274`, called any nonpositive mutant result a killed always-refuse mutation. In the actual first run, both the positive and the mutant stopped at `resource-components` before the mutation site. The individual mutation check still passed. Lines 59-73 also omitted five wall checks when no positive support existed. The whole run remained red; the defect was its overstated mutation coverage and changing check population.

The final harness requires a passing positive baseline, the expected changed outcome and a mutation-reach witness. It records unavailable dependent controls as failed/not-run and checks the fixed 38-check denominator before exit. The retained final evidence reaches the always-refuse site, skips 136 genuinely missing wall pixels in the ignore-wall control, and skips one actual observed contact in the ignore-contact control. Their matched baselines respectively produce a positive, a wall-erasure refusal and a two-owner ambiguity. The changed outcomes contradict those baseline requirements. F7 is repaired within these retained fixtures; it is not a general mutation-coverage claim.

#### Existing F2, F3 and F4 obligations: what the final fixture establishes

For F2, the extractor enumerates cap permutations, candidate base offsets and both displacement signs, then all four-pair combinations and supported owner alternatives. Observed asymmetric clearances bind the row order. Physical keys retain the owner and the full support set, so splitting the same support does not invent a second physical hypothesis, while a different owner survives even with an identical camera. The raw/split equivalence check is a support-set identity test over emitted pixels, not a general contour-graph parser. The finite grammar supplies the owner alternatives; no theorem against unrestricted hidden scenes is claimed.

For F3, actual source text confirms the admitted `proper-m-00nn000p0` matrix and `C = diag(1,-1,1)/20`. In `frame.mjs:2-24`, local row +Z supplies document/Three -X and local top-minus-base -Y supplies document/Three -Z. The signed X/Z columns yield the remaining Y column through the no-roll relation and independent up sign. The nominal synthetic columns are `aX=(-39,0)`, `aZ=(0,-36)`, `aY=(0,-15)`, giving positive document-Y derivative `(0,0.75)` per LDU. Full B, translation and up-sign comparisons for all three declared image mirrors use generator-only truth, beyond the first snapshot's Y-only check. No actual axis-swap or unit-error code mutation was executed, so none is described as killed.

The original scope's top/base control is now an actual RGBA operation: final `harness.mjs:98-113` exchanges complete ellipse patches located from the positive's observed supports, leaves pixels outside those disks unchanged, and reruns extraction. The recorded swap changes the image, preserves four 94-pixel dark cores, pitch 39 and zero deviation, and returns `not-observable` with zero physical hypotheses. This satisfies that control within the named family without deleting or relabelling an association record.

For F4, the final ordinary positive produces all four pairs, the seam-bearing image retains two same-camera physical hypotheses, and removing the two discriminating seam pixels produces one owner. Erasing all 136 necessary wall pixels or the fourth pair's wall pixels refuses; the erased support is disjoint from top support. The missing-core image also refuses. All paths start from RGBA, with generator truth outside the extractor import closure. The auxiliary shell repair uses eight-connectivity only for line components; the copied dark-core detector remains four-connected with unchanged limits. Recorded shell counts are 72 versus 12 over the same 1,116 foreground pixels, while all four dark cores retain 94 pixels.

### Owner dispositions supplied by the persistent implementer

The persistent implementer accepts F6 and F7 as material defects in the retained earlier revisions, and accepts their fixes for the exact final bounded synthetic family based on inspected source, run 04's 38/38 result and the old-bound mutation's actual center-containment failure. F6's shared origin/pitch/height expressions and conservative per-stud bounds satisfy the declared formation model, without transferring an ink/rim claim to the native source. F7's fixed population, failed unavailable controls and baseline/reach/outcome requirements eliminate the observed vacuity within the retained fixtures, without claiming general mutation coverage. The implementer accepts the existing F3 pixel-swap obligation within this family and treats F2/F4 as useful bounded positive evidence, not promotion of a genuine native producer. These are implementer dispositions; chief integration acceptance remains separate and pending.

## Findings and disposition

| ID | Finding | Disposition and reason | Repair or follow-up |
|---|---|---|---|
| F6 | [Shared rounding error omitted from physical-rim bounds](#f6--independent-half-pixel-rim-center-bounds-omitted-shared-layout-error) | Accepted; fixed for the exact synthetic formation. Independent review agrees with the implementer's bounded disposition. | Final `intervals.mjs` hash `703988cdebdb4ad22810ba144c00177b5b9215e0f9dfed8e66acd88cd8080bc2`; run 03 and 04 positives plus actual old-function mutation failure. Native D1 coverage remains unproved. |
| F7 | [Mutation could pass without reaching its site; controls could vanish](#f7--mutation-coverage-could-pass-without-reaching-the-mutation-and-missing-controls-disappeared) | Accepted; fixed within the retained fixtures. Earlier misleading passes remain counterevidence. | Final fixed population and baseline/reach/outcome checks; retain run 01's 5/21 result and final run 04's 38/38 result. |
| F2 | Finite observation grammar and physical equivalence | Bounded synthetic follow-up implemented and observed. | General/native grammar membership and source ownership admission are outside this result. |
| F3 | Actual transformed stud-axis route and signed frame | Correct R/C route and pixel-swap refusal observed within this fixture. | Native face/geometry provenance, general camera coverage and production consumer integration remain open. |
| F4 | A refusal-only fixture could be vacuous | Nonvacuous RGBA positive and reached falsification controls now observed. | This does not qualify either native calibration panel or authorize producer promotion. |

## Verification

This reviewer performed read-only source inspection, exact SHA-256/byte-length checks, inspection of existing JSON results, analytic frame/rounding checks and original-resolution synthetic image viewing. Final document inspection checked the exact snapshot copy, local link targets, balanced Markdown fences and trailing whitespace. The persistent implementer performed the executions; reported exits are attributed to that task. The inspected summary files bind the actual check populations, results, cases and source identities below. No reviewer test, probe, import, native invocation or product operation ran.

| Retained run under the evidence root | Recorded checks | Implementer-reported exit | Summary SHA-256 |
|---|---:|---:|---|
| `run-admitted-01/` | 5/21 | 1 | `a054f93e332fc62d1422baa0b743826fc380dfe759d27fe530461c65162dbd88` |
| `run-admitted-02/` | 30/30 | 0 | `58ebd71f3b1ebbe08b7a5f4f13132fc8c498d243e45ac7a680f91bfe56c63205` |
| `run-admitted-03/` | 36/36 | 0 | `682d94eea7e2a8f9fa43f96d8442a0e0edfc9d6ca05f0097908143beddebe30a` |
| `run-admitted-04/` | 38/38 | 0 | `94b510bb76443ee367f0827fd877e88dfa4f23c7f9e39dd33dd08822779794c0` |
| `mutant-old-bound-03/run-admitted-mutant-old-bound-03/` | 33/36 | 1 | `4580543b25232fc162160cfea40060f4e3af8fe71c7597cf2fa9dce3bf9bf541` |

The following files were independently opened at their original 720 by 470 resolution and separately hashed. Their visual outcomes describe the synthetic drawings relative to the ordinary positive and the declared control, not native physical truth. Repeated identical PNG bytes in other run cases were checked by their recorded digests, not represented as additional independent views.

| Inspected PNG under the evidence root | SHA-256 | Visual outcome |
|---|---|---|
| `run-admitted-01/positive.png` | `88db97914b93b0929a5247e1fb6e50dc3b0ac6717ab6634e0b46e2252266d938` | Same as the declared four-cylinder schematic. |
| `run-admitted-01/ambiguous.png` | `4348d41720fad12e278adf9ed460db4fe134868455f394dded6efda5a7cc2774` | Different: visible fourth seam reaches the rim. |
| `run-admitted-01/patched.png` | `526800ae8de3671f437bd402ca6168b9eb2030d4dcaee42457ca3e47e38a3526` | Different: the seam terminates before the rim. |
| `run-admitted-03/mirror-x.png` | `9a3a81ed45d4c599bbeebedebbe0a15161f0420a209cbfba87d506991acec3d7` | Different: horizontal image reflection. |
| `run-admitted-03/mirror-y.png` | `2e2f02ba350321a80b7669c77a25d315fa7f54d4647811eb1294a9319744d38f` | Different: vertical image reflection. |
| `run-admitted-03/mirror-xy.png` | `2285f18da0e3554ce306c9e0444553e9e22f14a6166ec6396bca03cc9a62d5c5` | Different: both image reflections. |
| `run-admitted-03/erased-wall.png` | `6e3ee462bc37fa50c0dfe55c462df4891b67886bfe5a5634255d78e6cbfa617e` | Different: required side-wall strokes removed from all four. |
| `run-admitted-03/erased-one-wall.png` | `da4dc9ef0781abcbeabedd963dbffe8961570d9581856f72c8dd4689bf543ffc` | Different: required fourth side-wall strokes removed. |
| `run-admitted-03/missing-core.png` | `3133d456ee166162defdadb7958b1e9a53bfe30de6c38a3163082370dc93cf56` | Different: fourth dark annular shading removed. |
| `run-admitted-04/swapped-top-base.png` | `c88a4f2e05460de65eede359ae5bb87c50cdbf1231fc065999aba11750150419` | Different: dark cap patches moved to the opposite full rims. |

Unavailable and intentionally unrun: native opaque geometry admission, exact source crop binding, yellow segmentation and 6/4/2 source binding, native ink/coverage/seam membership, both calibration panels, production camera tolerances, source-stage invocation, signed-anchor/lattice integration, one-shot validation, authority flow, browser/default tests and complete repository gates. These are missing production coverage, not waived requirements. No task-owned browser, GUI, server or native process was launched by this reviewer; no long-lived reviewer process requires cleanup. The retained source snapshots and evidence remain needed for this handoff.

## Round outcome

F6 and F7 are addressed in the exact final synthetic candidate, and the original finite-grammar, rotated-frame and nonvacuity requirements have meaningful bounded evidence. The independently inspected final source matches the 38/38 run, and restoring the old bound makes a relevant existing containment check fail. There is no remaining material finding within this round's declared synthetic scope.

This closes the bounded implementation review only. It does not establish native observability, admit a source stage, replace the production anchor, qualify calibration, grant placement or completion authority, or complete the first-50 campaign. Chief integration acceptance remains pending. The experimental implementation and raw evidence remain in the ignored root; this report and snapshot remain uncommitted pending the owner's documentation delivery. Nothing was merged to main or pushed by this reviewer.
