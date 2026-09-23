# Review 9: design

## Target

Repository: `%USERPROFILE%/Documents/github/lego`. Assignment base is `6300c6b817722d2652924ba9df7e06264c135e31` plus the preserved dirty tree, observed during review 8 and not re-attested through Git this round. This is a focused F8 re-review of the immutable [protected-read correction](../snapshots/9_runtime-location-protected-read-correction.md), 13,990 bytes at SHA-256 `8fc1137d2954f910059e9905ab44ed0b09a47df460438efd5a6d44f8ea620b65`.

The [authored diff](../../../../output/first50-fresh-search-20260908/runtime-location-stage-addendum/f8-protected-tree-read/authored.diff) is 16,874 bytes at SHA-256 `6d7069e0c4f8118f21090b04a10dcde538f4654a3415875ce0bab14fa40ee642`; its [identity inventory](../../../../output/first50-fresh-search-20260908/runtime-location-stage-addendum/f8-protected-tree-read/identities.json) is 5,326 bytes at SHA-256 `0ccc5da02cc3a5507bd62455710a59e6366ee19cb764c8e8974cb1a8696dfbfd`. The parent proposal and snapshot 8 remain SHA-256 `5926a6fe71ce026ed12904914a1270997682885a9debd86c192a14c93560cf2e`. [Review 8](8_design.md) remains 12,044 bytes at SHA-256 `a50838782f82534e5f73da5fa29065d7babbdb43e2a14566d217833480eb81b5`.

All sixteen source inputs bound by review 8 retain their exact lengths and SHA-256 values. Its [source patch](../../../../output/first50-fresh-search-20260908/runtime-location-stage-review-8/reviewed-source.patch) remains the recoverable core source target at SHA-256 `ebe0f918c9996f7c910ee7ca5af1f4c9ace689227eeb65889e25ec530a227431`. This round additionally preserves the three named caller files as full source additions in an ignored [caller snapshot patch](../../../../output/first50-fresh-search-20260908/runtime-location-stage-review-9/caller-source-snapshot.patch), 42,184 bytes at SHA-256 `8493f8bf0e11aa1fae4c2045ff367ecc9ae949b4bf8689284b29ad6fe8034ab8`. This is a current-byte recovery record, not an applied Git change. Their exact identities and this round's checks are in [verification metadata](../../../../output/first50-fresh-search-20260908/runtime-location-stage-review-9/verification.json), 1,318 bytes at SHA-256 `3ec0e7f28f6cced4e44f5b65624c1094a84f940cf32fe6b865b288a585a59bf4`.

## Reviewers and coverage

Reviewer: `/root/runtime_stage_review`, continuing independently from the correction author. Lens: whether the child fixes accepted F8 at the earliest protected read, explicitly excludes the existing three-case wrapper during Stage 2, preserves later closure checks and legitimate post-Stage-3 use, and avoids inventing authority or another validation opportunity. This is focused design re-review, not a new strategy search or a full implementation audit.

Re-read the corrected proposal, actual authored diff, relevant raw runbook conditions, wrapper/tree source and the three newly named caller sites. Revalidated all sixteen original source identities and all sixteen source/document pins supplied by the child. The runbook remains SHA-256 `e990c7498aaf04d4701275cd55597c5255fa8eb1c4ff10f578c0b2ae9c3cfa59`; the search contract remains `ef8d041f1649cc229d8645d8e4af9723fcd836c3c4b7dba95b9a80fe0e14bd61`. Earlier raw-contract analysis is retained in review 8, rather than repeated as a new finding.

No protected payload, PDF or image was read. No production module was imported or executed, no test/native/runtime/browser command ran, and no Git operation or production mutation occurred. No persistent process was launched. Existing executable guards and future readiness controls were not verified by execution.

## Reports

### /root/runtime_stage_review

#### F8 continued: the correction covers the earliest protected read

The child now makes the relevant boundary explicit. Its lines 9 and 29 exclude `readCommittedRealBuildPrefix50Step44PersistedQualification` and every caller entering that three-case wrapper during Stage 2. Line 11 and obligations 1–3 require qualification, complete freeze, genuine authority and admitted stage/opportunity provenance before the earliest protected Step 43 payload read in the complete selected path. They name tree stabilization as well as consume/import/crop access. Obligation 1 expressly forbids reading the protected tree to reconstruct those prerequisites.

This matches the current code. `real-build-prefix50-step44-calibration-persisted-binding.ts:30–39` enters the three-case tree wrapper before the inner verifier. `real-build-prefix50-subbuild-return-review-camera-real-domain-gate-tree.ts:159–161` snapshots the tree before its callback. Lines 93–110 visit each case file and call `digest`, whose lines 32–37 read the bytes. The correction no longer treats the inner verifier's later old-runtime refusal as proof that this earlier Step 43 access was prevented.

The listed caller paths are real. `real-build-prefix50-subbuild-return-review-camera-real-domain-gate-evidence.ts:304–306` calls the committed wrapper. `real-build-prefix50-step44-camera-only-gate-support.ts:80` and `real-build-prefix50-subbuild-return-review-source-locked.spec.ts:157` call that binding function. `real-build-prefix50-offline-finalized-promotion-selector.ts:138` uses `reopenQualification`, and its production dependency at line 272 supplies that same binding function. This verifies the named callers, not a whole-program reachability claim. The general exclusion covers any other caller entering the wrapper.

The future source-free controls now instrument both the earliest tree-file read and the subsequent consume/import/crop seams. They also require a valid admitted synthetic chain to preserve exact full-tree roster and stability, publication-marker and descriptor checks. Those checks correspond to the present wrapper's before/after tree comparison and its final descriptor equality at `calibration-persisted-binding.ts:42–55`. The correction authorizes neither dropping Step 43 files nor bypassing the wrapper to manufacture acceptance. F8's missing design boundary is addressed.

#### The correction preserves stage scope without inventing authority

The raw runbook at lines 63–67 permits only admitted Steps 41/42 during qualification and requires the complete freeze before Step 43 validation-source access. Lines 71–75 preserve genuine authority and the prospective single validation attempt. Lines 81–83 require the genuine later consumer and all 211 candidates after validation. The child retains these distinctions: an admitted calibration-only path may perform the fixed PDF identity check and exact calibration work, while the whole three-case replay remains excluded from Stage 2.

The child does not demand a new prevalidation reader or rewrite a legitimate later replay merely because it reads all three cases. Its line 29 instead requires explicit admitted stage, exact candidate/freeze/artifact identities, genuine authority and existing opportunity provenance before that later read. Any subsequent consume/crop execution still needs its reviewed scope and opportunity. A fresh process or receipt supplies none. This is consistent with the runbook's existing campaign record and source authority; it creates no new mint, durable ledger or cryptographic guarantee.

The complete-freeze join and calibration-proof joins remain stated implementation obligations. The correction does not claim the current full lock proves equality to the previous frozen code closure, or that an inventory supplies a capability. Nor does it require every malformed final-result field to be rejected before otherwise admitted calibration work. Its actual-entry-point controls are a bounded future verification requirement. This source review does not establish that those controls or joins exist or pass.

#### The location decision remains separate and concrete

The child's lines 3, 7, 13 and 43 leave runtime relocation unapproved. The inherited location proposal remains limited to the literal root, derived `FONTCONFIG_PATH` and necessary independently reviewed dependent commitments. It preserves the exact 178-file roster and payload identities, PDF, first-50 scope, thresholds, validators, 211 candidates, existing source guards and one-shot accounting. No silent runtime repin, extra opportunity or source-bearing invocation is approved by the correction.

No new material finding was found. The corrected ordering amendment is acceptable at design level and can accompany the concrete location proposal for the owner's/user's decision. Runtime approval, implementation, exact integrated closure review, readiness evidence and each selected source-stage invocation retain their separate prerequisites.

## Findings and disposition

| ID | Finding | Disposition and reason | Repair or follow-up |
|---|---|---|---|
| F8 | [The committed wrapper reads Step 43 before the inner consume checkpoint](#f8-continued-the-correction-covers-the-earliest-protected-read) | Finding accepted by the coordinator in the assignment. This independent re-review judges the immutable child correction satisfied at design level; coordinator acceptance of this correction remains a separate disposition. | Preserve the child and this round. Keep the three-case wrapper unadmitted during Stage 2. Implement and independently review the stated joins and source-free controls before any dependent invocation; retain all later closure checks. |

## Verification

Verified the child's expected raw hash and all sixteen supplied source/document pins. Revalidated all sixteen original source identities. Reconstructed all nine authored diff hunks from the unchanged parent, checking old/new line positions, deleted text and hunk counts; the resulting text exactly matches the child after line-ending normalization. Separately copied the raw child bytes through exclusive creation to snapshot 9 and verified its exact length and SHA-256. Confirmed source snapshot-patch recovery and checked this report and snapshot for required headings where applicable, existing local link targets, balanced fences and trailing whitespace. Rechecked the preserved parent/review/source identities after drafting.

No executable source-isolation, closure, native, unit, browser or full repository gate ran. The new report and snapshot are the only permanent files this reviewer created in this round. Review 8, snapshot 8, the proposals, production sources and previous evidence remain unchanged. The small ignored caller snapshot and verification metadata are intentionally retained review evidence; no browser, GUI, server or persistent process was created or left running.

## Round outcome

F8 is satisfied by the immutable design correction, with no new material finding. The corrected stage-ordering amendment is ready for coordinator acceptance and the separate concrete user decision about runtime location. This verdict approves no relocation, source access, invocation, validation attempt or capability. Unimplemented joins, executable guards, runtime readiness and campaign acceptance remain separate work.
