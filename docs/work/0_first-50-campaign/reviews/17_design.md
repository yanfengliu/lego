# Review 17: design

## Target

This focused round reviews `output/first50-fresh-search-20260908/inverse-boundary-graph-01/proposal-v3.md`, SHA-256 `b3d91e608d45831320982c1530a7fcd5cc9b607a59a8e33a550c84d9f3b60536`, retained byte-for-byte at [snapshot 17](../snapshots/17_inverse-boundary-graph-design.md). Its immutable parents remain part of the target except where expressly replaced: preparation 01 at SHA-256 `f91e05d14a9eb9c4849da764a56c44c8300c4889bebfeda24bae83b92c36c3c4`, retained at [snapshot 12](../snapshots/12_inverse-boundary-graph-design.md), and preparation 02 at SHA-256 `bb765b22632b2448931a0fa65f8220ac68c7490f6e51af364cecfc302dfd11e9`, retained at [snapshot 14](../snapshots/14_inverse-boundary-graph-design.md).

The unchanged source-closure metadata is `output/first50-fresh-search-20260908/inverse-boundary-graph-01/source-closure.json`, SHA-256 `4838d4eb314c3eb589367a4f6d393917c3945fa9ee85898f9931c75d7cd7697c`. The declared source base is `6300c6b817722d2652924ba9df7e06264c135e31` plus its preserved dirty tree. This round closes the focused design question left in [review 14](14_design.md); it does not review new executable source, an actual raster, or a run result.

## Reviewers and coverage

Reviewer: `/root/boundary_observability_review`, independent of the recovered v3 author `/root/rgba_independent_review`. The reviewer whole-read the exact new addendum and checked its digest, using the already reviewed parents and independent upright-camera algebra. Coverage is limited to replacement of the unsupported vertex-based yaw bound, its same-edge support premises, preservation of alternatives, F10's local gauge, and the distinction between a valid implementation design and successful execution.

No project code, image/PDF/raster payload, native geometry capture, scorer truth, old route report, browser, model call, network request, solver or renderer was executed or inspected in this focused round. No new witness or implementation was supplied to the author. This report and its exact snapshot are the only authorized writes.

## Reports

### Focused independent v3 assessment

#### The replacement yaw derivation is sound under its explicit support premises

V3 replaces the conditional vertex-displacement yaw bounds and their old width. It preserves the reviewed scale and positive-elevation requirements. Its proof uses two points on one candidate straight line, rather than intersections or vertices of that line, so it avoids the localization amplification that kept F9 open in review 14.

The audit front edge has endpoints `D=(140,152)` and `C=(460,296)`. The required raw support points `rD,rC` must lie on the same assigned observed chain and within Chebyshev distance 2 of D and C. Every supported candidate must match those same samples within distance 2 to points `lD,lC` on one assigned physical straight edge. Triangle inequality therefore gives coordinate errors of at most 4 for `lD` and `lC`, and at most 8 for their displacement. Thus `deltaU in [312,328]`, `deltaV in [136,152]`, and the line slope is in `[17/41,19/39]`. No two-pixel candidate-vertex box or platform-length ratio is used.

With independently supported positive `q = sin(elevation) in [7/17,11/13]`, the no-roll vector equations give `abs(t/c) in [221/451,323/273]` for assignment of the observed direction to X, or `[273/323,451/221]` for assignment to Z. Here `t = sin(azimuth)` and `c = cos(azimuth)`. The new long-X ratio width is exactly `323/273 - 221/451 = 85340/123123`. These finite bands exclude an almost unchanged quadrant when enforced by the parent's exact box-containment requirement. Their magnitude form does not select an axis or erase the signed branches imposed by the original vector equations.

The analytic geometry supports investigating this particular chain. On `v-(9/20)*u-89=0`, each stud's base ellipse has maximum functional value `-75/2 + 45/2 = -15`; the cap and wall do not cross the front edge. The P2 polygon's maximum is `-213/10`. The declared subject therefore leaves the full front edge unoccluded in P0/P2, and RGB inversion preserves P1 geometry. These facts establish geometric clearance, not actual raster support or correct tracing.

#### Missing support cannot become a rejection certificate

The support premises are concrete implementation and acceptance obligations. The independent audit must identify actual raw samples near both endpoint neighborhoods, prove full same-chain coverage, and verify that each supported candidate matches those samples to the same assigned straight physical edge. An endpoint matched to a neighboring line, a discarded end, a split physical owner, or proximity only to a union of boundaries does not satisfy the premise. Audit coordinates and the known camera remain separate from extractor inputs.

V3 explicitly prohibits using the numerical band to prune a correspondence that cannot establish these conditions. Such an alternative remains in the complete population; inability to support the bound makes the positive incomplete rather than making that alternative impossible. This preserves the parent's independent roster, retained unproved cells, complete partition records and exclusion-certificate contract. Appending a band to a broad uncontracted box still cannot pass.

There is no remaining algebraic gap requiring another design before source-only implementation can be considered. Proving that the unbuilt rasterizer, tracer and contractor meet these premises belongs to implementation review and admitted execution. This verdict does not demand a pre-code runtime result or assume one has occurred. Failure of the fixed raster/support premise must produce the specified incomplete result and a separately reviewed successor; it cannot justify post-result enlargement of the envelope.

#### F10 and the wider claim boundaries remain intact

The identified-camera tuple continues to omit `tx,ty`. Any diagnostic translation remains relative to an actually observed platform vertex with separately justified support and a localization box. The line-point proof supplies no such vertex box, and v3 explicitly says so. Anchor choice is a coordinate gauge, not a physical-axis selection, canonical document identity, or placement claim. F10 remains resolved at design level.

The route still needs independent fixture/visibility and full-support checks, complete-extrema bounds, supported elevation sign, the exact second point's full feasibility, source and algebra review of its arithmetic/checker, complete correspondence enumeration, partition/exclusion checks, falsifying mutants, resource enforcement, frozen implementation hashes and actual runtime metadata closure. Their existence in the contract is not evidence that they pass. In particular, the continuous-set enclosure and no-false-pruning proof obligations are this route's stated research guarantee; this review does not impose them as a universal campaign requirement.

The scope remains the eight upright analytic synthetic cases and five proposed source files. The known rotated campaign subject, native image transfer, physical placement, protected-source use and first-50 completion are excluded. No source-bearing execution, runtime import, production authority or campaign acceptance follows from this design verdict.

## Findings and disposition

| ID | Finding | Disposition and reason | Repair or follow-up |
|---|---|---|---|
| F9 | Earlier nonvacuity and pruning requirements lacked a justified yaw bound. | Resolved at design level; accepted by the root integration owner. V3 replaces the invalid vertex inference with a correct line-point derivation, explicit support obligations and conservative handling of unsupported alternatives. | Verify the actual same-chain support, matching, enclosure, roster, partition and mutant behavior during separately authorized implementation review and execution. |
| F10 | Identified translation previously had an unbounded origin gauge. | Remains resolved at design level; accepted by the root integration owner. Identified output omits global translation and preserves the separately supported local-origin convention. | Check actual anchor support and relative-translation handling in implementation. The yaw proof must not be reused as a vertex-localization proof. |

No new finding ID was used. F13/F14 remain unused by this round.

## Verification

Whole-read v3 at the stated digest, checked its exact replacement against the reviewed parent clauses, and checked the line-point triangle inequality, slope interval, both yaw intervals, ratio width, front-edge clearance and unsupported-alternative handling algebraically. No pixels, project execution or implementation behavior were checked. The assigned snapshot is copied without rewriting the addendum, and documentation checks cover its digest, report links/headings, balanced fences and trailing whitespace.

## Round outcome

Design accepted within this focused scope: F9 is resolved at design level and F10 remains resolved. The proposal is suitable for source-only implementation once the integration owner authorizes that next step. That authorization remains pending the chief's comparison with the camera-contract audit; this report does not grant it. Actual fixture, support, implementation, runtime and execution acceptance remain unproved. This verdict binds only v3 at `b3d91e608d45831320982c1530a7fcd5cc9b607a59a8e33a550c84d9f3b60536` together with its unchanged parent clauses.
