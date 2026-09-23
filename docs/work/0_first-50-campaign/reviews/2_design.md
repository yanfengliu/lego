# Review 2: design

## Target

Repository: `%USERPROFILE%/Documents/github/lego`. Original assignment base: `a400ec567c5de2b129853eeee9a8e3011e83cf89`. The correction packet records observed HEAD `6300c6b817722d2652924ba9df7e06264c135e31`. This is a focused re-review of F0 and F1 against retained source packet `output/first50-fresh-search-20260905/native-ownership/native-handle-proof-20260905-a2/`, compared with its preserved `native-handle-proof-20260905-a1/` sibling and [review 0](0_design.md). It does not reopen the whole source audit or review unrelated worktree changes.

| Reviewed a2 file | SHA-256 |
|---|---|
| `preparation.json` | `5e1cb693e02f900f4dc434499c189d1e4088ccf2a1494a3fbf8cc2fa6166e008` |
| `proof.mjs` | `67e53383a79b07fe849724c29669c56252400ac9bb67e8af5c2a2277f6244d6b` |
| `README.md` | `1dbf5df9bd866493513af7e9e4d61b1220f6e9d53eab1c9302728163af08f7e9` |
| `source-check.json` | `44434caf8b1b7083e3bc118535d1d446f04be2efda6f84e4030deb590bc50c64` |
| `correction.diff` | `b698c33ea2095c4370eedebee1373fd9d77793e5af159d22e41872e458bd6372` |

The three C# hashes remain `source-original.cs`: `e04b734a2da59e5cb8f054858013bd18cedaa26c44a7c30ffc24c2011e30df11`; `source-adapted.cs`: `6793745aa929134b88ddb3c2abe5d76c644086d076ea333fdb91b2beb016538e`; and `Fixture.cs`: `85e6915f0a642bac8ca7bd5df57b3ee24a29fdaf2a75f8e7b645455b3bc0b5a9`. The native transformation diff retains SHA-256 `70d74a6871198e9755a305cc50b2cfd6cdedb975ce4857cc187d42fa64d8ba8f`. All six workspace source pins are identical between the two manifests and match the live files. This preserves the earlier review's native-code target without transferring it to changed native code.

All eight a1 files match the digests independently recorded in review 0. The original report still has SHA-256 `62bacc39af28f5dc8011989b94ef8690329bab71845186c923fb395e5dc17962`. Neither the packet nor that report was changed by this reviewer. Keep both retained packets while these review targets need to remain recoverable.

## Reviewers and coverage

Reviewer: `/root/fresh_native_source_review`. Assigned lens: whether the actual F0/F1 corrections repair their evidence claims, preserve the fixed native experiment, and support a separately admitted build followed by one fixed four-arm run. Read the actual correction diff, complete current JavaScript driver, README, manifest, and source-check record. Independently checked file hashes and manifest comparisons using read-only PowerShell.

No packet command, compilation, native arm, module import, browser, runtime payload, construction source, or process probe was run. The earlier report supplies the unchanged native-source and API review; this round assesses only the correction and its direct implications. The coordinator reported acceptance of F0/F1 for correction, but the repair recommendation below follows the actual corrected source.

## Reports

### /root/fresh_native_source_review

#### F0 continued: repaired at source level

`proof.mjs:4` imports `performance`, and lines 181-183 and 191-203 use `performance.now()` for total and completed-arm measurements. Most importantly, lines 216-222 finish source verification, capture `finalElapsedMs`, check that exact value against 152000 ms, and publish the same value with `measuredAcceptanceCeilingMs: 152000`. There is no later replacement sample that could differ from the value admitted by the check. `checkElapsed` at lines 82-89 rejects a non-finite, negative, or over-limit sample and writes an instrument-failure record before throwing. Its failure cannot fall through to accepted summary publication.

`README.md:27` now accurately defines a measured acceptance ceiling covering the arms, inter-arm work, final parity, and final source verification. It expressly excludes the summary write and does not claim an aggregate cancellation timer. That stated bound matches the changed code. The independently bounded per-arm execution remains unchanged. This repairs F0 without inventing a stronger timing requirement. No runtime timing test was performed in this round.

#### F1 continued: reporting repaired; bootstrap ownership remains a separate premise

`proof.mjs:18-22` records launcher/bootstrap and descendant cleanup as unproven, outer-job establishment as unknown, and an execution-owner cleanup obligation. Rejected build invocations use that record at lines 110-114; unsuccessful returned build results use it at lines 116-120. Rejected arm invocations use it at lines 196-199. Returned results that fail target-receipt validation use it at lines 204-210. Each path stops before another compiler or child. The timing-failure record at lines 84-87 also preserves the obligation to resolve cleanup not established by prior records. None of these corrections turns an unvalidated failure into positive cleanup evidence.

`README.md:7`, lines 25-29, and line 35 now distinguish target creation inside the atomic job from the earlier compiler bootstrap. They do not claim that the timeout driver independently owns the bootstrap compiler handle or that some inherited job supplies the missing proof. This repairs F1's misleading failure scope. It does not add bootstrap descendant containment or prove any process exited. Keeping that distinction explicit is the intended disposition of this finding, not a new finding against the same unchanged implementation.

No material finding was introduced by these corrections. The C# files, native transformations, arm roster, expected worker exits, native fault, original accounting, and observation-before-rescue logic are unchanged. The patch adds reporting and measured timing checks; it does not weaken the counterexample predicates or turn rescue into product success.

#### Admission conditions and remaining premises

The smallest supported next step is a separately admitted `node proof.mjs build` from the exact a2 directory. Before that invocation, the execution owner must state how task-owned bootstrap/compiler processes will be accounted for on success or interruption. The reviewed packet cannot satisfy a requirement that every bootstrap descendant is already under independently proven task-job containment. If that stronger condition applies, the build remains unadmitted until separate evidence satisfies it. Otherwise the recorded bootstrap limitation and execution-owner cleanup obligation remain explicit bounds of this small experiment.

After a successful build, inspect both compile records, the two synthetic binaries, and `build/build.json` bound to the reviewed preparation digest before admitting one `node proof.mjs run`. Keep the four fixed arms and expected worker exits `0, 0, 10, 20`. Require the unchanged exact executable pins, normal-path parity, post-finally live-handle evidence, separately recorded rescue, and the checked final elapsed sample. Successful matching still reports product failure and driver exit 10. Any unexpected compilation result, timeout, receipt mismatch, or uncertain cleanup stops the sequence; it does not authorize reinterpretation, reuse of an existing output tree, another child, or deletion of potentially active temporary files.

Compiler acceptance, runtime native-error preservation, the actual null-job failure returning error 6 without killing the child, and normal parity under nested jobs remain experimental premises. Their treatment is unchanged from review 0: native results must establish them, and a mismatch invalidates the intended control. Worker-local observation still cannot supply supervisor-held descendant-exit evidence after worker death. No source-bearing readiness or first-50 campaign advancement follows from this review or a matched synthetic run.

## Findings and disposition

| ID | Finding | Disposition and reason | Repair or follow-up |
|---|---|---|---|
| F0 | [Aggregate deadline was not a final pass condition](0_design.md#f0-p2---the-aggregate-deadline-is-not-a-final-pass-condition) | Accepted for correction by the integration owner; reviewer recommends closed as repaired at source level. The final monotonic sample is checked and published unchanged, and the README states its precise measured interval. | Reviewed a2 preparation `5e1cb693e02f900f4dc434499c189d1e4088ccf2a1494a3fbf8cc2fa6166e008`; executable timing behavior remains untested in this round. |
| F1 | [Bootstrap failure incorrectly implied an outer-job backstop](0_design.md#f1-p2---a-wrapper-bootstrap-failure-cannot-claim-the-outer-job-existed) | Accepted for correction by the integration owner; reviewer recommends closed as a repaired evidence claim. Unknown failure scope and an explicit cleanup obligation replace the unsupported backstop assertion. Bootstrap containment itself remains unproved. | Same reviewed a2 preparation. Execution owner must account for bootstrap cleanup before build/run admission and stop on uncertain cleanup. |

## Verification

Read-only hash checks found eight unchanged a1 files, unchanged review 0, ten matching a2 manifest inputs, no changed C# or native-diff bytes, and identical workspace source pins. Neither `build/` nor `execution/` exists in a2. The corrected final timing and failure-record paths were inspected directly in the current driver, rather than inferred from `source-check.json`.

The preparer's retained source-check record reports a passing standalone JavaScript syntax check and source-only `inspect`; this reviewer did not rerun either command and does not claim independent execution of them. No compiler, native arm, process-cleanup control, or source-bearing gate ran during this round. Only this assigned report was written; documentation structure and whitespace were checked separately.

## Round outcome

F0 and F1 are repaired as source and reporting defects in the exact a2 packet. No additional correction-related blocker was found. Recommend a staged synthetic build under the stated bootstrap ownership conditions, followed by inspection of build evidence and then one fixed four-arm run. This recommendation is confined to the reviewed hashes and does not claim bootstrap containment, native success, whole-strategy validity, or campaign acceptance.
