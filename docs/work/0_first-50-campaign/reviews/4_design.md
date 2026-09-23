# Review 4: design

## Target

Repository: `%USERPROFILE%/Documents/github/lego`. Assignment base: `6300c6b817722d2652924ba9df7e06264c135e31` plus the preserved dirty tree, as supplied by the coordinator. This reviewer performed no Git operation and does not independently attest HEAD. The exact reviewed document is the [retained prospective runtime-relocation design](../snapshots/4_runtime-relocation-design.md), 23,177 bytes, SHA-256 `9523d0883a0fbb32bafe6fcad6f443fd6239d10610f6b16f329f314e3a324d87`. This is a proposal review, not an applied implementation or runtime-pin authorization.

The [ignored proposal directory](../../../../output/prospective-runtime-relocation-20260905-design/) retains the following exact inputs. Keep its before/proposed source snapshots and patches while this uncommitted review target needs to remain recoverable.

| Input | SHA-256 |
|---|---|
| `attempt02/core-prospective.patch`, 5,539 bytes | `5b6f1bc3748000bb039d12a8f34d21f55d66eb783a0f8f83a62c5a9a867ca576` |
| `attempt02/conditional-closure-prospective.patch`, 3,415 bytes | `49b0b18f2540f8c32f8f66b6fb8b3d7cd7c8ee092a64df7f97549e3524c98dbc` |
| `attempt02/static-proof.json` | `8c166c1a893ec444e217259edfe35a58d1d5d08bf7acf88d89d3c32b0bfcb889` |
| `attempt02/verification.json` | `4c795be9a057d4baf76e1cc744726c6edb18df52865d81c878fcdd4ca62d4e93` |
| `attempt02/recovery-metadata.json` | `323f5ef4830ca9570c316cc9df1e0d4e52488c72067e424bc737b4f1363334d7` |

The design's 30 retained before snapshots were independently compared with their recorded hashes and the current source files: all matched. Six additional plain-source snapshots supporting the direct replay trace are retained in [review evidence](../../../../output/first50-fresh-search-20260905/runtime-scope-review-40dd2c/), with [read identities](../../../../output/first50-fresh-search-20260905/runtime-scope-review-40dd2c/read-identities.json) SHA-256 `ba2f41636526119949daa8a9a8d64fb3b72cf57e63a334d541aa073fbaab8737`. No runtime payload is in those snapshots.

## Reviewers and coverage

Reviewer: `/root/fresh_runtime_scope_review`, independent read-only source/design reviewer, 2026-09-05. Coverage: the original attachment's toolchain paragraph at lines 88–100; current local rules, lesson queue and relevant specification boundaries; the disclosed-verification runbook; both actual patches; the production factory, verifier, helper and wrapper; direct source-closure and execution-roster consumers; camera raster commitments, source-lock projection and persisted replay ordering; and the supplied runtime-binding and availability reports with their query records. The work-document runbook supplies this report's format.

The shipped verifier and source-closure gate are the eventual runtime instruments. Their native-byte reads are outside this assignment, so this review used static text/JSON comparisons only. No DLL, EXE, font, configuration payload, PDF, image or other runtime payload was opened or hashed. No production module import, test, build, native invocation, OS query, guest operation, installation, browser, source-bearing command or Git mutation occurred. This review does not establish payload integrity, host compatibility, runtime quiescence, complete closure readiness or source-stage admission.

## Reports

### /root/fresh_runtime_scope_review

The proposal identifies a concrete location-only change that can be put to the user. Its five core hunks do not weaken a file, directory, version, canonical-path, identity, framing, timeout, environment, process or receipt guard. They do not add a caller override or an alternative accepted root. The conditional closure patch remains a calculation awaiting the separately required closure decision. One material downstream design gap, F5, prevents treating the current document as a complete admission design.

#### Location and exact-byte scope

The original user instruction forbids equivalent README bytes, roster reduction, shared-runtime changes and silent root repinning. The disclosed protocol additionally says that it does not authorize runtime repinning. Its approval therefore does not authorize either patch. The design correctly asks for a separate explicit decision, retains the previous body and receipts, and makes the new root and `FONTCONFIG_PATH` visible. Its proposed toolchain body hashes to `f36d5a2829890b1d55fd74a48577260599569bcfb386a32383bd84da286aa7d6`; the old body hashes to `ad3675e883db5966ee288583783841777cd63d908789ec4d2f77247f7433824f`.

I independently parsed all 178 literal source roster rows and compared path, digest and byte count with the proposed JSON body and retained recovery metadata. Every row matched. Old and proposed bodies contain the same version, six directory names and 96,810,767 total file bytes. Reverting only `root` and `loaderEnvironment.FONTCONFIG_PATH` in the new canonical body reproduces the old body byte-for-byte. This verifies the proposed metadata delta; it does not rehash the recovered files or prove their filesystem identities.

The helper changes only its root and expected body digest. Its expected launcher digest is unchanged. The wrapper changes only the helper's size/digest pins. Its separately pinned PowerShell path, size and digest, launcher bytes/digest, default factory selection and child environment remain unchanged. The execution roster retains all ten entries, with only the existing Poppler entry's executable target changed. The conditional source manifest retains all 527 rows, with only the three named production-source/helper rows changed. No omitted direct literal runtime-pin consumer was found by the scoped searches over `apps`, `packages` and `scripts`.

The patch continues to reject an unapproved root through the production factory's body pin, helper's independent literal pin and downstream raster pin. Retaining the compatibility ID `shared-pinned-poppler` does not expand its capability or establish where the bytes are installed. The current crop and canonical-PNG checks remain necessary: byte-identical runtime files at another location do not establish equivalent font lookup, loader behavior or rendered pixels.

#### What the alternative evidence establishes

The [binding report](../../../../output/first50-fresh-search-20260905/runtime-binding-3941df/REPORT.md), SHA-256 `31ee4390dfd3ced9481773555c52836151caabba5349a08f15e2a038adb857a0`, correctly distinguishes canonical pathname identity from relative-file byte identity. Its unchanged-pin Windows-namespace route remains a design candidate, not a measured runtime pass. The [availability report](../../../../output/first50-fresh-search-20260905/runtime-availability-584de1/REPORT.md), SHA-256 `252973db6ca0686dc322ff4fd4baa851c338534f25642d2e90f88d5602389e23`, and [queries](../../../../output/first50-fresh-search-20260905/runtime-availability-584de1/queries.json), SHA-256 `685583702007bf930b7d58d9b6a52883ff30227cc308ae03fd8e01aa0a23945c`, retain unsuccessful feature/hardware/guest queries as unavailable. Their successful inventories do not identify a currently runnable candidate within the stated searches. Aggregate exit zero is not used to turn the failed queries into empty successful inventories.

I did not repeat those queries or independently verify their linked platform documentation. The records support the bounded conclusion that this search did not establish a runnable guest. They do not prove universal absence, rule out another machine, or show the unchanged-pin strategy impossible. Relocation is the smallest concrete current-host binding delta among the presented choices; calling it the globally smallest scope decision would overstate this evidence. Keeping the recovered directory under ignored output also creates a continuing retention obligation that must be recorded before binding it.

#### F5 — Distinguish the PDF-only lock from runtime identity and define the pre-read replay boundary

Priority: P1 for source-stage admission. Design line 81 says fresh source-lock commitments necessarily change; its consumer table at line 62 relies on matching the persisted manifest's source lock to the current live opaque lock; line 97 requires old/new/copy combinations to refuse before a protected read. Those statements do not specify the current distinction that matters to this relocation.

The exact lock source is `%USERPROFILE%/Documents/github/lego/apps/web/e2e/real-build-prefix50-step44-camera-only-source-lock.ts`. Lines 122–150 construct public evidence from a single frozen PDF row. Its `bootstrapSourceManifestDigest`, `lockManifestDigest`, counts and evidence commitment depend on that PDF-only projection. The full locked roster, directory, helper PID and repository identity are in the separate `runtimeIdentity` at lines 151–156. Relocation changes source bytes and the full bootstrap lock's commitments, but it does not necessarily change this public PDF-only evidence. A fresh opaque lock object also does not make the projected digest identify a new runtime.

`real-build-prefix50-subbuild-return-review-camera-real-domain-persisted-qualification.ts:388–395` compares the persisted manifest against that PDF-only evidence and then calls source-geometry reproduction. At lines 397–403 it prepares current source cases. `real-build-prefix50-subbuild-return-review-camera-real-domain-source.ts:296–303` validates the live lock and enters the calibration raster reader; `real-build-prefix50-subbuild-return-review-camera-real-domain-calibration-raster.ts:53–65` hashes the protected PDF before producing the two crops. The later case/session comparisons, including the session equality at persisted-qualification line 424, cannot establish refusal before those reads. This is a source-order finding, not a claim that an old qualification currently passes or that protected input was read in this review.

The proposed hunks leave this route unchanged. A correctly preserved old manifest with the same PDF evidence is not distinguished at its initial source-lock check merely by relocating Poppler. Later raster/case/session commitments can still refuse mixed evidence, but that is a different guarantee from pre-read rejection. The design's instruction to add tripwire tests is useful acceptance work; it is not an identified mechanism that makes the five-file patch supply this guarantee.

Correct the commitment map to name the unchanged PDF-only evidence separately from changed full source-lock runtime identity and raster/runtime commitments. Before admitting a persisted replay entry point, identify a metadata-only check that binds its exact approved successor lineage, source closure and runtime body before the first protected read, with independently reviewed source-free mixed-lineage controls. Alternatively, explicitly leave that offline replay route unadmitted until such a concrete check is reviewed. Do not fix the distinction by retagging an old receipt, treating a campaign inventory as an opaque capability, weakening its source-lock predicates, or silently expanding the relocation patch. This recommendation adds no source access or authority.

#### Separate wrapper repair and remaining implementation obligations

The conditional manifest's wrapper row changes from 9,875 bytes at `794598a43a968f8abac9be1fb93093663dd3e29fbd0180cc9f4848964f370a50` to the proposed 9,821-byte wrapper at `53d4cca008da359c1054995208e1e0005dd4fc1f097006a3b74f45f43d02f359`. The current before snapshot is `da79335c191aaf11bff8a42ee5d80ac7abb21defca0ddbd49bbd3345b02c05f7`. The coordinator separately reports that current wrapper as an accepted diagnostic repair awaiting source-closure rebind. This reviewer did not re-review that repair. Its earlier 54-byte delta is not attributed to relocation, rejected as unauthorized, or approved by the conditional aggregate. The frozen design's older unresolved-drift wording remains preserved as historical review input.

Before implementation acceptance, the final integrated wrapper/helper/source rows must undergo the already required exact closure review, with every other existing mismatch retained as a refusal. If resolving that work changes a reviewed byte, recompute and review the resulting location proposal. Updating two independent expected test literals preserves their pinning role, but the described additional mutations, read/spawn tripwires and actual native readiness tests remain unperformed. The unit suite's own header and filesystem boundary still allow pinned host/helper reads; its source-free label does not mean native-payload-free execution.

## Findings and disposition

| ID | Finding | Disposition and reason | Repair or follow-up |
|---|---|---|---|
| F5 | [PDF-only source-lock evidence does not provide the stated runtime distinction before persisted replay reads](#f5--distinguish-the-pdf-only-lock-from-runtime-identity-and-define-the-pre-read-replay-boundary) | Accepted by the coordinator at source level after an independent trace; correction remains open. The core relocation hunks preserve guards but do not implement the promised pre-read discriminator. | Correct the commitment map and identify a reviewed metadata-only admission check, or leave persisted offline replay unadmitted; prove mixed-lineage refusal with source-free read/spawn tripwires before source admission. |

## Verification

Read and hashed the exact authored design, patches, proof and allowed source/JSON metadata. Independently checked all 30 declared before-snapshot hashes against current source, all 178 source/body/recovery metadata rows, exact two-field body reversion, unchanged directory roster, ten execution entries and 527 manifest rows with exactly the three disclosed changes. Inspected actual changed hunks and the direct replay call order. The proposal's earlier `git apply --check` result was read as retained evidence, not rerun by this reviewer.

The report's local links resolve, its Markdown has no unpaired fences, and it has no trailing whitespace. These are document checks only; they do not establish a repository gate or final integration.

No unit, integration, source-closure audit, native, runtime, browser or full repository gate was run. No payload equivalence or operational feasibility result follows from these static checks. All shell reads completed synchronously. This lane created no persistent process, browser, GUI, server or watcher; it has no such resource to stop. Its only writes are this report, the exact authored-design snapshot and the six retained text snapshots/read-identity metadata needed to recover the finding. The design snapshot and original were both checked at 23,177 bytes and the target digest after copying. No production source, runtime, existing proposal, predecessor evidence or Git state was changed.

## Round outcome

The explicit location-only decision is concrete and preserves the runtime payload contract. The proposed core patch contains no observed guard weakening, and the unchanged-pin guest alternative has not been disproved. The current design needs F5 corrected before it is accepted as a complete source-admission plan. A subsequent user decision may authorize exactly the named root and derived environment-field change, with the separately reviewed dependent commitments; it must not be inferred from this review or the disclosed protocol. Payload verification, source-closure rebind, native readiness, camera qualification, source admission, one-shot accounting and full campaign acceptance remain separate and incomplete.
