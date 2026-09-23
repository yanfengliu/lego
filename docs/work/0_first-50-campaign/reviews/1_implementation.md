# Review 1: implementation

## Target

This independent review covers only the uncommitted root-identity repair in `apps/web/e2e/real-build-prefix50-ui-replay.spec.ts` and `apps/web/test/real-build-prefix50-production-base.test.ts` in `%USERPROFILE%/Documents/github/lego`. The coordinator supplied investigation base `a400ec567c5de2b129853eeee9a8e3011e83cf89` and current HEAD `6300c6b817722d2652924ba9df7e06264c135e31`, reporting only an AGENTS canon change between those commits. No Git command was run in this review. The extensive surrounding dirty tree is excluded.

The exact reviewed code is recoverable from the retained before/after source copies and raw patches in `output/first50-fresh-search-20260905/root-lineage-fix-20260905-a/`. Live hashes and retained-copy hashes were independently read and matched the following values.

| Target | Before SHA-256 | Reviewed SHA-256 |
| --- | --- | --- |
| `apps/web/e2e/real-build-prefix50-ui-replay.spec.ts` | `ed8eeea70976e25712612df2f223b6742afbf1b8fc42c4cbd4283b89a8bf6f98` | `4cc7e17405164049d4d29e532937e4fb0fabd3cde274dc2217e8c70c179fce88` |
| `apps/web/test/real-build-prefix50-production-base.test.ts` | `77617b4ac5a2a38732ec38291295c382aab5ab29c5a0f7379b3ec08605b361ab` | `b6bffd4c4c1a28162d85aea48c1406e2ca617ca099670dc34c4a0d2387312a89` |

The retained files are `before-ui-replay.spec.ts.txt`, `after-ui-replay.spec.ts.txt`, `before-production-base.test.ts.txt`, and `after-production-base.test.ts.txt`. The raw patches are `ui-replay.diff` at SHA-256 `7c2cbcb90f7b2711f35028770d0cf4a1b3fc6bdd29f9bf2c87e5141e23b19a9e` and `production-base-test.diff` at SHA-256 `d738fc1d991f9fbd182abf17d94c6ec00907c75ea177d915631c1f5770eab262`. `HANDOFF.md` is bound at SHA-256 `1d8e551763044389c44a30d925e618e2ce17a304a0fd36d104062c170a930c7b`. Retain these ignored inputs until the reviewed changes are bound to a recoverable committed revision.

## Reviewers and coverage

Reviewer: `/root/fresh_root_lineage_review`, independently assigned one bounded read-only implementation pass on 2026-09-05 local time. Coverage included the exact patches, existing pinned test, production factory, actual UI setup and compiler-input construction, snapshot validation, canonical versus structural serialization, production materials construction, and recorded selected-test/format/lint results. Live AGENTS, local rules, lessons, relevant spec sections and the fleet work-document format were read.

The review used source text, retained code snapshots, hashes and saved execution receipts. It did not import or execute repository modules, rerun tests, launch a browser/server/GUI, read PDF/panel/native payloads or protected campaign artifacts, invoke default gates, or perform Git actions. Its sole authored file is this report. It is an implementation review, not a separate multi-CLI or full source-closure audit.

## Reports

### /root/fresh_root_lineage_review

No scoped material findings.

The UI delta removes the generic constructor import, imports the existing production factory at `apps/web/e2e/real-build-prefix50-ui-replay.spec.ts:33`, and replaces the metadata-specific empty-root constructor at line 123. Lines 148-152 pass that root directly through the existing canonical-byte and structural-hash snapshot operands. The production factory remains unchanged at SHA-256 `679a682e508b7e15b60d4bf8c1ba26d8aaa9a987cea5694f6db3419d5c31663c`; it retains `prefix50-current-diagnostic` and `Prefix 50 current diagnostic`. The same factory and snapshot operands already appear in `real-build-prefix50-subbuild-return-review-production-materials.ts:65` through line 71. `real-build-prefix50-ui-replay-compilation.ts` forwards the input snapshot through its `compilerInput` helper to both diagnosis and final compilation. No replacement digest, exception, relaxed comparison, or production-factory change is present in the patch.

The distinction measured by the new counterexample is real. `packages/brick-kernel/src/document.ts:122` serializes the normalized complete document, while `structuralDocumentValue` at line 126 omits top-level document id and name. `real-build-candidate-document-snapshot.ts` validates exact canonical JSON, independently verifies the structural hash, and retains a separate SHA-256 digest of the complete canonical bytes. Equal structural roots therefore do not establish equal canonical root bytes. The new test at `apps/web/test/real-build-prefix50-production-base.test.ts:132` asserts structural equality, canonical inequality and equality after replacing only id/name. The original 4,906-byte length and `sha256:0f155126bc975a659b588e074c7af40b7aad19a206f03af1e21e61854c27aab1` pin remain verbatim.

The source-only regression at test line 73 reads the actual UI spec as UTF-8 text and uses TypeScript's parser without importing the spec. It checks the shared import, the sole setup root declaration, the root's three identifier occurrences, and both operands of the actual compiler snapshot. It therefore exercises more than an unused import or a duplicate test-local factory call. Its documented bound is the current explicit entry-point source shape and empty-root identity contract. It is not a general symbol-resolution or arbitrary data-flow proof; future setup refactors need a deliberate gate review. No misleading broader guarantee is needed to accept this exact patch.

The saved RED/GREEN records isolate the repair. Comparing the recorded source rosters across the RED and first GREEN arms found only the UI file changed. The regression bytes stayed at `905b17e122a351203dfeb8472ca1f7c9e99e77866114b185b62d94346072d96d`. The retained pre-format source and final patch show only later test line wrapping; final formatted bytes have their own passing receipt. The RED failure names the absent shared UI import, while the old pinned-byte test and metadata counterexample pass. This supports a meaningful regression for the observed root mismatch rather than an environment failure.

No material integration risk was found within the two-file delta. It changes canonical root metadata, so later exact-byte lineage results must be produced from the reviewed source version. This review supplies no evidence that the real Step-44 promotion path or the complete UI replay succeeds, and it does not grant a source-bearing invocation or transfer acceptance from an earlier source closure.

## Findings and disposition

No new finding IDs were assigned. There is no material finding from this round requiring a repair. Campaign findings F0/F1 from the separate design review are outside this report's disposition; their owner retains those decisions. The integration owner remains responsible for accepting the patch against the full campaign obligations.

## Verification

The reviewer inspected actual `invocation.json`, `effective-config.json`, test JSON/stdout/stderr, supervision and before/after source identity records under `output/first50-fresh-search-20260905/`. No passing check was rerun.

| Retained arm | Observed result | Bound |
| --- | --- | --- |
| `root-lineage-red-20260905-a` | Exit 1; 1 failed / 2 passed; 3.8196 seconds supervised | Actual original UI source; new shared-import assertion fails |
| `root-lineage-green-20260905-a` | Exit 0; 3 passed; 2.7321 seconds supervised | Only UI source changed from RED |
| `root-lineage-final-green-20260905-a` | Exit 0; 3 passed; 2.9997 seconds supervised | Final formatted test and final UI hashes above |
| `root-lineage-final-format-20260905-a` | Exit 0; both matched files pass | Explicit two-path Prettier check |
| `root-lineage-final-lint-20260905-a` | Exit 0; no diagnostics | Explicit two-path ESLint check, cache disabled |

All three selected-test effective configurations recorded only `apps/web/test/real-build-prefix50-production-base.test.ts`, Node environment, native config loading, `envDir: false`, disabled test/filesystem module caches, and no setup/globalSetup/browser/API hook. The source identity rows were independently compared before and after all five arms and were equal. The saved formatter and linter invocations explicitly named only the changed paths.

All five supervision records report the root process exited without timeout. Each also records CIM `Access denied`, `childQueryStatus: unavailable`, and `childAbsenceVerified: false`; this review makes no child-absence claim from those receipts. The reviewer launched no browser, GUI, server, or persistent helper, and its read commands completed. Raw evidence and counterevidence were preserved.

Real UI execution, per-step visual inspection, Step-44 qualification/promotion, full repository verification and full first-50 campaign acceptance were not performed or established by this round. The campaign's stage restrictions remain applicable.

## Round outcome

The exact two-file root-identity repair has no scoped material findings and is supported by the inspected selected regression and focused format/lint evidence. This is a bounded implementation-review acceptance recommendation. It is not a claim of merge, full verification, source admission, real UI success or campaign completion. Any later change to the target bytes requires review coverage appropriate to that change; the next admitted source stage must bind the new live source closure.
