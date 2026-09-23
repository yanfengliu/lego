# Review 0: design

## Target

Repository: `%USERPROFILE%/Documents/github/lego`. Assignment base: `a400ec567c5de2b129853eeee9a8e3011e83cf89`. Observed checkout HEAD: `6300c6b817722d2652924ba9df7e06264c135e31`. This review covers retained, uncommitted source preparation under `output/first50-fresh-search-20260905/native-ownership/native-handle-proof-20260905-a1/`, not all changes since either revision. Preserve that packet while this review or its findings need it. A later production revision does not inherit this review automatically.

The packet's `preparation.json` SHA-256 is `a804ed43d425253cd1860f094499661159ff6d07e949e142b5152febdfa0aa01`. All ten declared inputs matched their byte lengths and hashes during independent read-only verification. The four focused source hashes are:

| File | SHA-256 |
|---|---|
| `source-original.cs` | `e04b734a2da59e5cb8f054858013bd18cedaa26c44a7c30ffc24c2011e30df11` |
| `source-adapted.cs` | `6793745aa929134b88ddb3c2abe5d76c644086d076ea333fdb91b2beb016538e` |
| `Fixture.cs` | `85e6915f0a642bac8ca7bd5df57b3ee24a29fdaf2a75f8e7b645455b3bc0b5a9` |
| `proof.mjs` | `709efe75bf95424972a0b400d0c07ced694f4d79f72e1467a9c87c671f10d27a` |

The original source matches `apps/web/e2e/real-build-prefix50-subbuild-return-review-poppler-job-launcher.cs`. The manifest also binds the five directly used bounded-child launcher files. The retained supporting hashes are `README.md`: `9b20ced1880a859789c9a6e1eee51bb186c2c07e4fe922392ff7d4528f16928b`; `source-check.json`: `aa8c2118cfb09a146921aea32d82db118a6c3a0bd58ac0b77264dddd08637d2c`; and `source-transform.diff`: `70d74a6871198e9755a305cc50b2cfd6cdedb975ce4857cc187d42fa64d8ba8f`. The original and adapted sources preserve the complete transformation target; the retained diff is supporting provenance, not the independent equality check.

## Reviewers and coverage

Reviewer: `/root/fresh_native_source_review`. Lens: independent source review of four fixed synthetic arms, native error fidelity, exact child-handle observation, rescue ordering, normal parity, and finite execution claims. Read current repository instructions and local rules, the prepared sources, their manifest and README, and the direct shipped bounded-child harness. Checked relevant Microsoft API documentation and .NET Framework reference source. Did not use prior diagnosis, transcripts, or memory to establish the verdict.

No packet command, compilation, native arm, production module import, browser, runtime payload, PDF, or construction source was executed or read. This is one source-review pass. It is not a native test, threat model of the whole system, or proof that a whole strategy cannot work.

## Reports

### /root/fresh_native_source_review

The instrument's core is suitable for the narrow question. Independent text verification reproduced the adapted prefix from exactly the five declared replacements. `Run`, `Require`, the accounting predicate, and their statement order remain intact. `source-original.cs:263-266` creates a suspended child and attempts assignment before resuming it. Its `finally` at lines 322-345 terminates the product job and closes the original handles. No adapter change weakens that accounting or inserts rescue into that method.

The adapter duplicates the actual returned process handle in `source-adapted.cs:378-393`, with inheritance disabled and the same access rights. The duplicate names the same process object; it is not PID reopening or a process-count estimate. Microsoft documents these properties in [DuplicateHandle](https://learn.microsoft.com/en-us/windows/win32/api/handleapi/nf-handleapi-duplicatehandle). The wrapper records real assignment results at lines 396-402. Only managed field writes follow the native error capture before unchanged `Require` reads it; [Marshal.GetLastWin32Error](https://learn.microsoft.com/en-us/dotnet/api/system.runtime.interopservices.marshal.getlastwin32error?view=netframework-4.8.1) supports that error-preservation design.

`Fixture.cs:118-176` calls the original method, catches its outcome after `finally`, observes the duplicate, and emits the frozen verdict before `ProofRescue` at lines 187-209. The failure arm requires native error 6 from both the call and original exception, no resume, original handle closure, and `WAIT_TIMEOUT` on the held process handle. Microsoft defines a zero-duration wait and the distinct timeout/failure results in [WaitForSingleObject](https://learn.microsoft.com/en-us/windows/win32/api/synchapi/nf-synchapi-waitforsingleobject). Rescue waits on that same object after requesting termination and records its exit code separately. Successful rescue does not change the product-failure verdict or the expected exit 10.

The two normal arms retain the original returned accounting fields and compare them in `proof.mjs:178-180`. The observer-refusal arm retains its duplicate for cleanup while producing instrument failure. It does not pretend that observer failure proves a product defect. These are meaningful controls for this single child and native call path, subject to the untested premises below.

#### F0: P2 - The aggregate deadline is not a final pass condition

`proof.mjs:154-156` uses `Date.now()` and checks the 152000-ms total only before each arm. Lines 178-186 perform parity, source verification, and summary publication without checking the final total. Consequently a run that crosses the total ceiling during the final arm or later file work can still write `controlsMatched: true`. The per-arm check at line 175 does not impose a ceiling on time spent between arms or after the last one. System-clock adjustment is another reason not to use `Date.now()` for elapsed execution admission. This conflicts with the checked four-arm wall-budget claim in `README.md:25`.

Minimal correction: use a monotonic elapsed clock, check the aggregate elapsed value after the final verification and before publishing the accepted summary, and bind the published elapsed value to that check. If 152000 ms is intended as an enforced cancellation deadline, also cap each new arm by the remaining allowance; otherwise describe it as a measured acceptance ceiling. Preserve over-budget evidence as failure. This is a receipt defect, not evidence against the held-handle approach.

#### F1: P2 - A wrapper-bootstrap failure cannot claim the outer job existed

`proof.mjs:169-172` labels every `runBoundedChild` rejection with `outer-job-backstop-only`. `README.md:23` similarly describes an outer-wrapper timeout using that backstop. But `scripts/windows-bounded-child.ps1:23` first compiles its launcher with `Add-Type`; only lines 54-69 call `RunExact` or `Run`. The task job is created later in `scripts/windows-bounded-child.cs:22`, and the target joins it atomically at lines 79-91. The Node timeout path in `scripts/part-identification-bounded-child.mjs:97-110` terminates the directly spawned PowerShell process, not an independently held bootstrap compiler process.

This matters in Windows PowerShell's .NET Framework compiler path: Microsoft's [CSharpCodeProvider source](https://raw.githubusercontent.com/microsoft/referencesource/main/System/compmod/microsoft/csharp/csharpcodeprovider.cs) selects `csc.exe`, and [Executor source](https://raw.githubusercontent.com/microsoft/referencesource/main/System/compmod/system/codedom/compiler/Executor.cs) creates that process, writes captured output to temporary files, and waits for it. This supports the bootstrap-child distinction; it is not a live measurement of this host's compiler or a claim that a compiler actually leaked. Killing the bootstrap PowerShell before job creation cannot derive compiler exit from the later job's semantics.

Minimal correction: failures without target-entry evidence must say launcher/bootstrap or child cleanup is unproven, rather than asserting that an outer job supplied the backstop. State the bootstrap compiler's scope separately in the run protocol and assign its cleanup to the execution owner. If admission requires every bootstrap descendant to be contained under a proven task-owned job, establish that before building; the present sources do not establish it. A successful compiler exit and completed wrapper setup support the next stage within their bounds. Do not broaden this into a production-wrapper rewrite or claim an unrelated inherited job provides coverage without evidence.

#### Untested premises and limits

The official [AssignProcessToJobObject contract](https://learn.microsoft.com/en-us/windows/win32/api/jobapi2/nf-jobapi2-assignprocesstojobobject) requires a valid job handle with assignment access. It does not promise the exact null-handle error and survival behavior assumed by this experiment. Some documented assignment failures terminate the process, so failure alone is insufficient. The prepared arm correctly requires actual error 6 and a live held handle after product cleanup. Compiler acceptance, platform policy permitting that fault, cached native-error fidelity in the built program, and normal parity under nested jobs remain native measurements. Unexpected behavior must invalidate the arm; it cannot be reinterpreted as the expected counterexample.

The observer duplicate belongs to the worker, so a worker crash or hang cannot yield supervisor-held descendant-exit evidence. `README.md:31` states that limit correctly. The atomic outer job covers the admitted target and its ordinary non-breakaway descendants once creation succeeds. This source review does not prove cleanup after host death, bootstrap interruption, suspension, kernel failure, or a malicious same-user rewrite. The fixed synthetic child contains no browser, process fan-out, construction input, or network request. Compiler temporary-file volume is distinct from the stdout/stderr byte caps.

## Findings and disposition

| ID | Finding | Disposition and reason | Repair or follow-up |
|---|---|---|---|
| F0 | [Aggregate deadline is not a final pass condition](#f0-p2---the-aggregate-deadline-is-not-a-final-pass-condition) | Unresolved at authored handoff; integration owner has not supplied a disposition. | Check final monotonic elapsed time before accepted summary publication; rebind changed packet bytes. |
| F1 | [Wrapper-bootstrap failure cannot claim the outer job existed](#f1-p2---a-wrapper-bootstrap-failure-cannot-claim-the-outer-job-existed) | Unresolved at authored handoff; integration owner must separate launcher/bootstrap uncertainty from worker-job coverage. | Correct failure scope and document exact bootstrap ownership/cleanup assumptions before admission. |

## Verification

Read-only PowerShell checks independently verified all ten manifest input lengths and SHA-256 digests, the exact five unique prefix transformations, and absence of `build/` and `execution/`. Result: ten matching inputs, no mismatches, adapted prefix equal, build absent, execution absent. Packet sources were not executed to perform these checks. Read the actual source logic rather than accepting `source-check.json` as proof.

No C# build, native control, compiler/bootstrap cleanup check, or final run was performed. No task-owned browser, GUI, server, or native child was created by this reviewer. Only the assigned authored report was written. Its Markdown/path verification is documentation evidence, not executable validation.

## Round outcome

No core source-shape or observation-order blocker was found. Keep the narrow experiment. Correct F0 and F1 before treating a run as satisfying the documented packet contract. The smallest supported next step is a separately admitted synthetic build, with bootstrap process ownership and failure cleanup bounds explicit, followed by one fixed four-arm run of the bound binaries after build evidence is inspected. A changed packet needs fresh digest binding and focused re-review; this report does not approve unseen corrections or give a blanket cleanup guarantee. A matched run would establish one synthetic local counterexample to cleanup after this actual native assignment failure, not source-bearing readiness or first-50 campaign acceptance.
