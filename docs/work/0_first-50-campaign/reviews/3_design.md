# Review 3: design

## Target

Independent review of the [retained raster-producer scope](../snapshots/3_raster-producer-scope.md), 21,769 bytes, SHA-256 `7a56842b39c840ef60d715b4895dddbfe188a1eb6a4bc95ebd65ffc950f5b7fd`. The reviewer independently checked that digest against the original ignored `SCOPE.md`. Both remain unchanged. This review does not cover a producer implementation.

Repository: `%USERPROFILE%/Documents/github/lego`. Assignment base: `6300c6b817722d2652924ba9df7e06264c135e31`, reported by the coordinator; this reviewer performed no Git operation and does not independently attest that HEAD or the dirty-tree inventory. Current source comparisons are bound to the exact bytes below. The complete 24-file read-identity inventory remains in [ignored review evidence](../../../../output/first50-fresh-search-20260905/raster-scope-review-5720f1/read-identities.json). It records hashes, not a recoverable patch; integration must bind any changed source to its own retained patch or committed revision before treating this as implementation review.

| Current comparison input | SHA-256 |
|---|---|
| `real-domain-source-axis.ts` | `26fdc13644e2e7976da7051e1ccd005b15687786a482a6e61a8bbf3a5857e193` |
| `real-domain-step42-admission.ts` | `11fd33895ec3d189ecfd681bff1a9fe54a26f4574ecd90714db760a7b27ca8ae` |
| `real-domain-source-spec.ts` | `cf1f1788e7d0e53ae58a52ac75fcc7306ae2a8fcb3d35e3e3cf9c5cebf76d6a1` |
| `real-domain-source-anchor.ts` | `3946389816a4dffad0ece6f6d9cd7bb2f225b5d79b244fa53c8e9aa096ca47ae` |
| `real-domain-lattice.ts` | `03e9bcf3742d1f1d2b867b6627be5bbf62e651d99fa4e6ecf9da27d4ed4a8bf5` |
| Frozen `search-contract.md` | `ef8d041f1649cc229d8645d8e4af9723fcd836c3c4b7dba95b9a80fe0e14bd61` |
| Disclosed-verification runbook | `e990c7498aaf04d4701275cd55597c5255fa8eb1c4ff10f578c0b2ae9c3cfa59` |

The abbreviated TypeScript names above share the prefix `apps/web/e2e/real-build-prefix50-subbuild-return-review-camera-`. The frozen contract and runbook are linked from the campaign plan.

## Reviewers and coverage

Reviewer: `fresh_raster_scope_review`, an independently assigned read-only worker, 2026-09-05. Coverage: the authored scope; current AGENTS, local rules, lesson queue and applicable specification boundaries; the fleet work-document format; actual raster-axis, admission, source-spec, anchor and lattice code; adjacent vector consumer and persisted-case predicates; actual coordinate, admitted-orientation and panel-face implementations. The source-bearing test was read as source to establish its import/beforeAll boundary and was not executed.

No protected PDF or panel image, runtime/native payload, prior source-bearing incident or camera output was opened. No import, test, build, browser, native runtime or product operation was performed. No source-stage admission or observation about the unread native crop is asserted. No subagent was used. The only authored permanent file is this report; raw identity checks are confined to its assigned ignored directory. Review 2 was pending in the assignment and was not read, fabricated or declared complete.

## Reports

### fresh_raster_scope_review

The scope is safe to use as a starting boundary for source-free work. It is not yet a complete positive producer design. The fixed contract requires independently checked extraction, all four source-bound correspondences and the specified mirror/erasure controls. It does not require rejecting every imaginable unmodelled owner or distinguishing two encodings of the same correspondence. No impossibility result follows from the current refusal strings: `source-axis.ts:410-452` constructs a refusal and the signed consumer always throws; those literals do not measure the unavailable correspondence from pixels.

#### F2 — Define a finite observation grammar and physical equivalence before counting survivors

Priority: P1 for positive implementation. Scope lines 33-45 enumerate boundary subchains, all segmentations, junction pairings and visible surface ownership, then refuse if two ownership assignments survive. D2 at line 57 invokes an unrestricted unknown owner. The boundary graph is finite, but the proposed physical population has no executable membership predicate until the observation grammar defines which owner alternatives are supported by those pixels. Adding an unconstrained predecessor explanation is neither a measured alternative nor an impossibility proof under the fixed source contract.

There is also a concrete representation counterexample. Consider an isolated unbroken rim-support chain with three successive vertices A, B, C and no contact with another component. The chain A–C and its segmentation A–B plus B–C have identical pixel support, physical owner, fitted curve and camera. Preserving every admissible splitting produces both descriptions without introducing a second physical hypothesis. Interval subdivision creates the analogous duplicate for a single connected feasible camera set. Counting these descriptions as different ownership assignments would refuse an otherwise unique correspondence. This example needs no unknown owner and changes none of the admitted geometry or image predicates.

Define the population from a committed finite drawing grammar: actual observed boundary contacts, admissible continuation rules, allowed geometric primitives and an explicit `unresolved` result where those rules cannot settle a contact. Canonicalize representations of the same owned physical support and merge certified overlapping camera boxes before counting materially different hypotheses. Continue refusing a genuinely different owner assignment even when its camera is identical. D2 should justify the particular competing continuation from actual observed support; it should not require a proof against an unlimited external scene. This is a routine design requirement within the authorized extraction work, not a request for another user approval.

#### F3 — Specify the actual stud-axis route to document Y

Priority: P1 for positive implementation. Scope lines 21-25 correctly warn against assuming local top is document +Y, but stop at the conditional “if” an axis conversion yields `aY`. The actual admitted occurrence 276 uses `proper-m-00nn000p0` in `step42-binding.ts:56-66`. `proper-orientations.generated.ts:12-13` gives `R = [0,0,-1; -1,0,0; 0,1,0]`. Consequently local row pitch +Z becomes document −X, while local top-minus-base displacement `[0,-h,0]` becomes document `[0,0,-h]`. With `C = diag(1,-1,1)/20`, the latter measures Three −Z, not Three +Y. An upright toy fixture alone would miss this production-frame error class.

There is a concrete algebraic route, conditional on correctly observed physical support. Let `aX` and `aZ` be image derivatives per positive Three X and Z, `s` positive pixels per Three unit, and `u` the independently bound camera up sign. Away from the existing pole fallback, `camera-fit.ts:99-107,140-158` yields `aX=(u*s*cos(theta), u*s*sin(e)*sin(theta))`, `aZ=(-u*s*sin(theta), u*s*sin(e)*cos(theta))`, and `aY=(0,-u*s*cos(e))`. Therefore `s=hypot(aX.x,aZ.x)`, `sin(e)=det(aX,aZ)/(s*s)`, and the signed X/Z measurements plus the declared no-roll domain determine the missing Y column. The implementation must propagate observation intervals through these equations and reject singular or inconsistent cases. It must not relabel the top/base displacement as Y.

For an exact source-free control, choose `theta=30 degrees`, `e=30 degrees`, `s=40`, `u=1`, local pitch 20 LDU and local stud height 4 LDU, then apply the actual admitted R. The projected positive Three columns are `aX=(20*sqrt(3),10)`, `aZ=(-20,10*sqrt(3))`, and `aY=(0,-20*sqrt(3))`. A top-minus-base displacement is `(4,-2*sqrt(3))` pixels. The desired positive document-Y derivative is `(0,sqrt(3))` pixels per LDU. These are analytic control values, not measurements of the booklet. This one case exposes an axis swap, a top/base sign reversal and a factor-of-20 mistake.

The scope also overattributes elevation-sign evidence to `viewForPanelFace`: `panel-face.ts:148-160` supplies `upSign` but returns the input elevation unchanged for studs-up and negates it for underside. It is not independently an absolute elevation-sign measurement. Name the input seed's actual provenance or derive the sign from the signed, oriented X/Z determinant under the reviewed family. Keep the face and turn commitments fixed; fitting a sign and claiming it came from the face adapter is not valid provenance.

#### F4 — A negative-only RGBA fixture can pass with an extractor that always refuses

Priority: P2 for the next increment. Scope lines 61-69 require an ambiguity refusal and make the positive companion conditional on unresolved D1/D2. That is honest, but it allows the whole initial suite to stay green for an extractor that returns `ambiguous` for every image. Such a result measures refusal safety only and does not advance positive physical correspondence. The actual core detector also rejects changed component sizes/counts; connecting synthetic wall and platform ink must not silently bypass that detector by supplying prelabelled core supports.

Require at least one bounded source-free positive from RGBA through the actual primitive-generation and assignment path, paired with the same-camera/different-owner refusal and the smallest discriminating pixel patch. The fixture generator retains ownership solely as withheld test truth. Its known image formation supplies explicit stroke/coverage bounds for that fixture family. Preserve detector predicate coverage, record every returned physical pair's actual support pixels, and rerun the same extractor on mirrors and pixel erasures. Replacing physical labels or association records is not a valid image control. An always-refuse mutation must fail the positive; an ignore-wall/ignore-contact mutation must fail a refusal control. Neither success establishes that the unread native crop belongs to the fixture's drawing grammar.

#### D1 and D3 disposition guidance

D1 correctly identifies the gap between thresholded ink boundaries and physical rims. Cell quantization alone cannot bound a physical curve when stroke displacement and coverage are unspecified. Defining an explicit observation model and bounded numerical implementation is authorized source-free design work. The current qualification tolerances must remain unchanged. Synthetic renderer bounds justify only their named fixture family; they cannot be silently transferred to the booklet. No particular ink width, residual threshold, continuous tangent length or complete-seam premise follows from the frozen threshold bytes.

D3 identifies a real integration issue. `source-anchor.ts:10-71` has only the two-raster seam; `SharedOrientationAnchor` requires a typed lattice fit; and `persisted-case-contract.ts:177-187` checks its digest, qualified/failure values and the fixed expected branch. A signed axis alone cannot fill these fields with success literals. Conversely, `source-spec.ts` expressly names an independent signed full-rank receipt as the replacement requirement for the obsolete anchor. Prepare an assertion-by-assertion map separating frozen qualification/corroboration predicates from the old producer's candidate-selection mechanics. Retain the old lattice result as counterevidence, execute all preserved required predicates through the new adapter, and name any actual conflict. Do not turn “replace the obsolete anchor” into a requirement that the unchanged obsolete algorithm must start succeeding on identical inputs. No downstream integration or closed-tree schema change is approved by this source-free review.

## Findings and disposition

| ID | Finding | Disposition and reason | Repair or follow-up |
|---|---|---|---|
| F2 | [Physical population and equivalence are unspecified](#f2--define-a-finite-observation-grammar-and-physical-equivalence-before-counting-survivors) | Unresolved; owner disposition pending. The universal-owner argument establishes no contract-bound impossibility, and representation multiplicity is not physical ambiguity. | Define the finite grammar and physical equivalence; add the A–B–C split and same-camera/different-owner controls. |
| F3 | [Actual transformed stud height is −Z, with incomplete +Y/sign provenance](#f3--specify-the-actual-stud-axis-route-to-document-y) | Unresolved; owner disposition pending. The generic warning does not specify the actual admitted frame's consumer derivation. | Bind the real R/C composition, propagate X/Z intervals into Y, and exercise the analytic rotated control plus image mirrors. |
| F4 | [Initial refusal fixtures can be vacuous](#f4--a-negative-only-rgba-fixture-can-pass-with-an-extractor-that-always-refuses) | Unresolved; owner disposition pending. A green refusal suite cannot establish a positive producer. | Add one bounded RGBA positive with withheld truth and show always-refuse and ignore-wall mutations fail the appropriate controls. |

## Verification

Performed read-only file inspection and SHA-256/byte-length checks. The recoverable scope snapshot and original match the expected digest. Code observations and analytic examples were checked by reading the actual transforms and equations; no executable test or numeric probe ran. Applicable source-bearing tests, native raster examination, runtime admission, qualification, replay and full gates were intentionally unavailable within this assignment. These are missing implementation/production coverage, not waived requirements.

No task-owned browser, GUI, server, worker or native process was launched. No long-lived process requires cleanup. The ignored identity inventory remains needed for this handoff. No source or other review file was edited.

## Round outcome

The smallest justified next experiment is one source-free pure RGBA correspondence fixture family with an explicit finite drawing grammar and known pixel-formation bounds, using the actual admitted rotation and unequal height/pitch. First establish a positive all-four physical support result and the analytic X/Z-to-Y conversion; then keep the camera fixed while introducing the fourth-pair competing continuation, apply a discriminating pixel patch, and erase the necessary wall pixels. Count physical hypotheses after equivalence, not graph encodings. Run mirror and withheld-truth controls through the same extraction path. This can advance a bounded positive producer without reading protected material or requesting a new routine parameter approval.

F2-F4 require owner disposition and focused design/fixture follow-up. The current scope proves neither raster impossibility nor a genuine positive source producer. Native observability, both calibration panels, one-shot validation, genuine authority flow and complete campaign acceptance remain unmeasured by this round. The coordinator retains stage admission and integration ownership.
