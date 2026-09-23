# Review 5: design

## Target

Repository: `%USERPROFILE%/Documents/github/lego`. Assignment base remains `6300c6b817722d2652924ba9df7e06264c135e31` plus the preserved dirty tree, supplied by the coordinator and not re-attested through Git by this reviewer. This is a focused F5 re-review of the same prospective relocation idea, against the [corrected design snapshot](../snapshots/5_runtime-relocation-correction.md), 32,677 bytes, SHA-256 `3f405a63fd919060ce043e9a15ebcb6bbaf8c770eda1dbe6840b5ea2ec592cb8`.

The original child lives in [attempt03-design-correction](../../../../output/prospective-runtime-relocation-20260905-design/attempt03-design-correction/). Its authored diff is 33,917 bytes at SHA-256 `89dca66fb65b2bbe76e98cfe6de1de8679bf11a02c8f7659bda22090ba21c703`. Its `verification.json` has SHA-256 `b2bd028e23461767519d04a4c6203b3905d5cddd0561236c02da9269fdc61bd7`; `final-identities.json` has SHA-256 `0570fb2424335208b1c2465ca18899cee7971c178e1ce19f52518be65b6592a8`. These are retained metadata and text, not executed instruments.

[Review 4](4_design.md) remains unchanged at SHA-256 `ad89580983595120cc355203c3c4da1fc012f5d9b2e4797b9bd94516767c84f1`. Its [original design snapshot](../snapshots/4_runtime-relocation-design.md) remains 23,177 bytes at SHA-256 `9523d0883a0fbb32bafe6fcad6f443fd6239d10610f6b16f329f314e3a324d87`. This round supplements that history rather than rewriting its finding or transferring its review to an edited original.

## Reviewers and coverage

Reviewer: `/root/fresh_runtime_scope_review`. Lens: whether the F5 text correction accurately distinguishes the PDF-only projection from full runtime identity, leaves the affected offline entry and its callers unadmitted, preserves the actual required gates, and makes the explicit runtime-location decision reviewable before the user decides. Read the entire corrected design, actual authored diff, retained identity records and relevant current source trace. Rechecked the two direct calling layers solely to interpret the all-callers exclusion.

No new strategy search or broad source audit was performed. The unchanged runtime patch and metadata-preservation review remain bounded by review 4. This round performed no production import, test, module execution, payload read, PDF/image read, native invocation, OS query, browser action, installation or Git operation. Actual runtime recovery, filesystem integrity, operational compatibility and source-admission readiness are outside this review.

## Reports

### /root/fresh_runtime_scope_review

#### F5 continued: the design correction satisfies the explicit nonadmission alternative

The corrected evidence map now matches `apps/web/e2e/real-build-prefix50-step44-camera-only-source-lock.ts:122–156`. Public evidence uses the single frozen PDF row, so its counts and digests remain unchanged for the unchanged PDF and projection. The full lock digest, directory, helper PID and repository identity remain in separate `runtimeIdentity`. The document no longer claims that every source-lock commitment necessarily changes or that a new branded object makes the PDF projection identify a new runtime.

The text also accurately preserves the source-order counterexample. In `real-build-prefix50-subbuild-return-review-camera-real-domain-persisted-qualification.ts`, the PDF-only evidence comparison at line 389 precedes source-geometry reproduction at line 394 and source preparation at line 397. The source loader reaches `real-build-prefix50-subbuild-return-review-camera-real-domain-calibration-raster.ts:65`, which hashes the protected PDF, before the later persisted session comparison at line 424. These unchanged source files match the exact trace identities in the correction record. A later refusal still cannot establish rejection before those reads; the correction now says so without claiming an old qualification passes.

The exact prospective addendum explicitly leaves `verifyPersistedRealBuildPrefix50Step44RealDomainQualificationOffline`, including any caller that can enter it, unadmitted. This covers the direct `readCommittedRealBuildPrefix50Step44PersistedQualification` wrapper in `apps/web/e2e/real-build-prefix50-step44-calibration-persisted-binding.ts:39` and its caller `readAndBindPersistedRealBuildPrefix50Step44RealDomainQualification` in `apps/web/e2e/real-build-prefix50-subbuild-return-review-camera-real-domain-gate-evidence.ts:305`. The former was inspected at SHA-256 `b1bfdec7712eee7774fcb1c9d31c7d5b64d2e656b4cdfc07e7cc0d010c2ce42e`; the latter retains review 4's SHA-256 `1b5634913ab62292e8baf912428ddb07615ab8220c7ddf8dabf9277482441661`. Their source was read, not imported or invoked. This scoped caller check is not a whole-program reachability proof.

Under this corrected proposal, admission requires a separately concrete and independently reviewed metadata-only check binding the approved successor lineage, full source closure and runtime body before source-geometry reproduction or any protected PDF/hash/crop read. Its stated source-free controls include same-PDF old/new-runtime mixtures, mismatched full closures, copied manifests, caller-shaped records and an unapproved third runtime, with read/spawn tripwires. The correction requires checking every entry into the route and forbids invoking it merely to discover whether a later predicate refuses.

This is the explicit exclusion alternative requested in F5. It does not claim to have implemented the missing check. It does not substitute campaign inventory or a matching PDF digest for authority, change a source-lock schema or predicate, or grant another source entry point by implication. The addendum expressly says the exclusion waives no required persisted replay gate and that completion remains incomplete while a required route is unavailable. The underlying replay-admission work therefore remains pending even though this design finding is addressed.

This re-review checks the truth of the corrected proposal's chosen restriction. It does not derive a new user requirement for universal pre-read rejection from the original design's overstatement, or decide whether the frozen contract separately requires such a discriminator before otherwise admitted calibration reads. That contract question remains separate. It grants no execution under the presently explicit exclusion.

#### The bounded location decision remains concrete

The corrected decision still names exactly the recovered directory and toolchain body `sha256:f36d5a2829890b1d55fd74a48577260599569bcfb386a32383bd84da286aa7d6`. It permits only `root`, its derived `loaderEnvironment.FONTCONFIG_PATH`, and independently reviewed necessary dependent commitments. It retains all 178 file rows, byte/digest pins, six directory names, version and other loader values. The original five-file core patch remains SHA-256 `5b6f1bc3748000bb039d12a8f34d21f55d66eb783a0f8f83a62c5a9a867ca576`; the two-file conditional closure patch remains `49b0b18f2540f8c32f8f66b6fb8b3d7cd7c8ee092a64df7f97549e3524c98dbc`. The proposed body itself retains the named `f36d5a...` digest. No new production hunk is hidden in the authored correction.

The document correctly describes the existing wrapper at `da79335c191aaf11bff8a42ee5d80ac7abb21defca0ddbd49bbd3345b02c05f7` as a diagnostic repair separately accepted by the coordinator, with exact integrated source-closure rebind still pending. It does not use the conditional aggregate to approve that repair or unrelated closure changes. This review does not independently repeat the separate diagnostic review.

The revised minimum-change claim is limited to the presented current-host binding choice. It no longer purports to prove all alternative strategies impossible. Old commitments and evidence, the shared runtime, frozen scientific inputs, source-stage requirements and one-shot Step-43 accounting remain preserved. The original disclosed-protocol approval is not treated as runtime-pin authorization. The proposed directory still has an explicit retention obligation while bound.

The corrected explicit location decision is acceptable to present to the user for an approval or refusal. That conclusion does not authorize applying the patch or running readiness checks. Exact integrated source review, selected-read admission, payload/filesystem verification, synthetic native execution, source release and the remaining campaign gates retain their own required decisions and evidence.

No new material finding was introduced by the correction.

## Findings and disposition

| ID | Finding | Disposition and reason | Repair or follow-up |
|---|---|---|---|
| F5 | [PDF-only evidence and the persisted replay pre-read boundary](#f5-continued-the-design-correction-satisfies-the-explicit-nonadmission-alternative) | Closed at design level with coordinator acceptance; the corrected text implements the explicit nonadmission alternative from review 4. This disposition does not infer a new user requirement or close the separate contract question. | Preserve the corrected proposal's offline-route exclusion and its stated release conditions until a separately reviewed decision changes them. No underlying runtime mechanism is declared repaired. |

## Verification

Independently checked all 18 identities listed across the correction's frozen patch/body, seven current patch-target source and eight trace/context records: no mismatches. Confirmed unchanged review 4 and original snapshot hashes. Reconstructed all seven authored diff hunks against the exact retained before text; hunk counts and context matched, and the reconstructed corrected text matched after normalization of line endings. Separately checked the exact raw corrected bytes and SHA-256, then copied them through an exclusive create into snapshot 5 and verified the same 32,677 bytes and digest.

The relevant current source trace and direct calling layers were inspected without execution. All 178 runtime payloads were left unread; the earlier metadata comparison was not repeated or upgraded to payload verification. No unit, integration, source-closure, native, browser or repository gate ran. No process with a persistent lifetime was launched. This lane's only new files are the exact design snapshot and this authored report; review 4, the original design, production sources and Git state remain unchanged.

## Round outcome

F5's design correction is satisfied, with no new material finding. The corrected runtime-location decision is concrete, truthful and ready for the user's decision, subject to its preserved exclusions. It is not a complete source-admission plan, an implemented metadata gate, permission to invoke offline replay, a runtime readiness result or campaign completion. Preserve this round and both snapshots; any later design or implementation change needs review against its own exact target.
