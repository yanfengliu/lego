# Boundary graph inverse experiment: preparation 03 addendum

Owner: `/root/rgba_independent_review`, recovering the existing candidate on 2026-09-08 against base `6300c6b817722d2652924ba9df7e06264c135e31` and the preserved dirty tree. This source-only addendum replaces preparation 02's conditional vertex-displacement yaw bounds and their stated ratio width. All other clauses remain in force. It introduces no implementation or execution admission.

The exact parents read were `proposal.md`, SHA-256 `f91e05d14a9eb9c4849da764a56c44c8300c4889bebfeda24bae83b92c36c3c4`; `proposal-v2.md`, SHA-256 `bb765b22632b2448931a0fa65f8220ac68c7490f6e51af364cecfc302dfd11e9`; and `source-closure.json`, SHA-256 `4838d4eb314c3eb589367a4f6d393917c3945fa9ee85898f9931c75d7cd7697c`. Review 12 was read at SHA-256 `de073b87ba69e72a8e876fe64d1d1d1524cd326e0aebfa1240748cf48ca502b5`. Those files remain unchanged.

## Replace corner displacement with one supported line

The declared P0 platform front edge runs from audit point `D=(140,152)` to `C=(460,296)`, on the line `v-(9/20)*u-89=0`. Each stud's base-center value under this line functional is `-75/2`, and its ellipse support radius is `45/2`; its cap and intervening wall project farther behind the line. Thus every stud projection has functional value at most `-15`. The P2 polygon's maximum value is `-213/10`. Consequently the declared analytic geometry leaves the entire front edge unoccluded in P0 and P2; P1 preserves P0's geometry. These coordinate facts do not establish that a future rasterizer or tracer preserves its support.

Require the preparation 02 two-pixel envelope on this entire straight edge, including its endpoint neighborhoods. In particular, the independent fixture/support audit must identify raw support points `rD,rC` on the same assigned observed chain with Chebyshev distances at most 2 from D and C. Every supported candidate must match those same raw points within 2 pixels to points `lD,lC` on one and the same assigned straight physical edge. Full boundary coverage on that chain remains required; discarding its ends, splitting its physical owner, or matching one end to another line does not satisfy this premise. D/C are separate audit coordinates, not extractor inputs or supplied world labels. The extractor must establish the chain's platform-edge role through its observed support and physical incidence, preserving unresolved alternatives.

The triangle inequality gives `|lD-D|_infinity <= 4` and `|lC-C|_infinity <= 4`. These are bounds on two points of the candidate line, not on its vertices or its intersections with other lines. Their difference therefore satisfies `deltaU in [312,328]` and `deltaV in [136,152]`, with both components positive. The candidate line's slope consequently obeys `mLong in [136/328,152/312] = [17/41,19/39]`. This derivation uses neither a corner-localization box nor the platform's 80:20 length ratio.

After independently supported incidence establishes the existing positive `q in [7/17,11/13]`, the no-roll equations give the replacement yaw bands:

- When this observed direction is assigned to physical X, `abs(t/c) = abs(mLong)/q in [221/451,323/273]`.
- When it is assigned to physical Z, `abs(t/c) = q/abs(mLong) in [273/323,451/221]`.

Both bands are finite and bounded away from zero. Together with the unchanged scale and q bands, they reject an almost unchanged quadrant. The former long-X width `380/1599` is superseded; the new long-X ratio width is `85340/123123`. Retain the signed branches required by the original vector equations and complete correspondence roster; these magnitude bounds do not merge or select physical axes or signs. Every accepted box must satisfy its applicable band through the exact containment check required by preparation 02, with a supported nonempty branch. Appending a band as an unevaluated equation to a broad box remains insufficient.

## Conditions still to establish

This repairs the yaw algebra conditionally on same-chain coverage and matching. It does not certify those conditions from pixels. If the fixed raster's support does not reach either endpoint neighborhood within 2 pixels, or a correspondence cannot establish that both samples belong to the same physical straight edge, these numerical bounds cannot be used to prune that alternative. The positive is incomplete until a separately reviewed successor establishes a valid bound; no post-result enlargement or silent assumption is allowed. Fixture visibility, all raw-support and full-coverage checks, the second feasible point, safe partition/pruning certificates, complete alternatives and resource enforcement remain the preparation 02 prerequisites.

F10's local gauge remains unchanged: the identified-camera tuple omits `tx,ty`, and any diagnostic translation is relative to an actually observed platform vertex with its separately justified raw support and localization box. The line-point proof above supplies no vertex box and does not discharge that anchor-localization obligation. No canonical document origin or placement authority follows.

Only the four named text artifacts and applicable instructions were read for this recovery. No new code, raster, payload, image, runtime import, test, browser, solver or renderer was created, read or executed. Only this addendum was written. The eight-case scope, five proposed source files and false `executionReady` state remain unchanged; focused design review and root admission remain pending.
