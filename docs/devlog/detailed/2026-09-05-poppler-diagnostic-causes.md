# Poppler diagnostic causes: two bounded release routes removed

The Poppler wrapper no longer attaches the returned spawn Error or the malformed-JSON parse Error as a cause of its fixed refusal. Independent review and implementation-owner checks accepted these two changes; the chief parent's later combined run passed 24/24 tests, comprising the 13 Poppler controls and 11 unchanged synthetic crop controls. Complete diagnostic redaction, native-runtime recovery, Stage-1 readiness, camera qualification and the first-50 goal remain incomplete. Source-measurement admission stays closed.

## What changed and what stayed fixed

The earlier diagnostic investigation found that a fixed top-level message did not withhold a raw Error reachable through `cause`. The [wrapper](../../../apps/web/e2e/real-build-prefix50-subbuild-return-review-poppler.ts) now removes exactly `{ cause: run.error }` from returned-spawn failure and `{ cause: error }` from malformed-JSON refusal; the latter catch has no unused binding. Fixed messages, numeric/null status rendering, withheld stderr byte count, receipt validation and the post-spawn integrity `finally` are unchanged. No launcher, verifier, native pin, production API or dependency changed.

The [permanent test](../../../apps/web/test/real-build-prefix50-subbuild-return-review-poppler.test.ts) preserves its original eight controls byte for byte and adds five fixed diagnostic cases: valid receipt, nonquiescent receipt, nonzero stderr, malformed stdout and returned spawn Error. The last case places its marker in the message, nested cause, ordinary, non-enumerable and symbol fields. The 532-line file keeps those existing controls and explicit instrument assertions together, below the 1,000-line ceiling.

The [test helper](../../../apps/web/test/real-build-poppler-diagnostic-test-support.ts) invokes the actual installed Playwright `serializeError`, with Node 24.12.0, Playwright 1.61.1 and Vitest 4.1.10. It walks immediate and reported graphs through own descriptors under depth, node, property and string-byte bounds; incomplete traversal and cycles fail. It recognizes the native Error stack getter and checks that an unrelated getter is not invoked. Each error case restores loader, process and environment state, removes only its five added CommonJS cache entries and owned parent-child references, and checks that preexisting state remains intact.

The loader permits at most 32 installed code/metadata files and 16 MiB; each successful call loads five authentic files. The filesystem boundary permits registered synthetic roots and identity reads of the existing pinned PS1, launcher DLL and exact system PowerShell executable. Native spawn remains mocked. Real framing, factory selection, verification before and after spawn, response parsing and installed serialization run within that boundary; publication code and protected PDF/material inputs do not.

## Instrument failures, positive controls and mutations

The first permanent run passed 9/13 and failed four times while loading the serializer, before any serializer call. The guard refused `fs.ReadStream`. One reviewed nine-line helper correction replaces the four lazy stream-constructor accessor exports with constructible denial-function data values: installed dependency initialization may read the references, while later construction still reaches denial. No native getter or constructor is invoked. The two production cause removals did not change. A separate initial focused TypeScript config had an extra `../` and loaded no inputs; its TS5083/TS18003 failure is retained as a configuration error.

The corrected owner run passed 13/13. The implementation coordinator independently repeated all 13 tests and scoped TypeScript, ESLint and Prettier with exit 0. Each positive diagnostic run completed five rows and four actual serializer calls. An isolated copy with only disclosed import and identity-path relocation then passed 13/13 before either cause was restored.

| Isolated control | Actual result | Diagnostic evidence |
| --- | --- | --- |
| Baseline | 13/13 passed | Both graph absence checks executed. |
| Restore returned-spawn cause | 11 passed, 2 failed | Intended spawn-marker failure: seven immediate paths and four serialized paths. A separate stderr case failed its own-cause-undefined shape assertion. |
| Restore parse-error cause | 12 passed, 1 failed | Intended malformed-stdout marker failure: two immediate paths and two serialized paths. |

Both mutants compute and retain the actual serialized graph before the first hard assertion. That immediate-graph assertion fails and stops the defective case before its reported-graph absence loop. The executed RED assertion therefore proves immediate leakage; the saved serialized graph separately measures reported leakage. It is not a second executed RED assertion. The adjacent stderr shape failure is also not the spawn leak proof. All isolated runs made four serializer calls with complete graphs, no instrument error and successful restoration. Shared source bytes were never mutated; the defective copies and first failed run remain counterevidence. The original frozen five-case probe was not rerun or replaced.

## Parent acceptance and retained provenance

The [chief-parent log](../../../output/calibration-diagnostic-repair-20260905/parent-84b9df/selected.log), SHA-256 `1b245898e30398941254e72009329111dc02e228621fc8a1a89b579cf5fb7c61`, records 24/24 passing in 2.85 seconds. Its [fresh diagnostic receipt](../../../output/calibration-diagnostic-repair-20260905/parent-84b9df/case-results.json), SHA-256 `96814edbf4b30b93cf9fe2d249c6596a55a3aee21c515b80910097e0533da3ef`, records five completed cases, four serializer calls, 20 owned cache-entry removals across those calls, complete restoration, no output-graph markers or incomplete branches, and eleven removed synthetic roots. The parent accepted the exact three source files and independent review after reading the actual changes and mutant evidence, matching 58 retained artifacts totaling 732,546 bytes and 32 current/frozen identities, and checking the 66 prior roots plus its eleven fresh roots absent.

The adjacent eleven crop checks are the unchanged synthetic controls already bounded in the [runner-output history](2026-09-05-calibration-runner-output.md). Their presence in the combined run does not add native execution, source decoding or broader crop qualification.

| Accepted source | SHA-256 |
| --- | --- |
| Poppler wrapper | `da79335c191aaf11bff8a42ee5d80ac7abb21defca0ddbd49bbd3345b02c05f7` |
| Poppler test | `5c9f6e55764469a3e2375b0b94e7795673bf3dd70b8dd575eab8a200c9c4036d` |
| Diagnostic test helper | `d5c36b8cd313068a54a540c7354d70a91dc2c8655d13c285bc11da50a645f1aa` |

The [implementation handoff](../../../output/calibration-diagnostic-repair-20260905/repair-2722861662/HANDOFF.md), SHA-256 `c0434c8c0572dc3362cf9d031bc566d6f9bcc1caf6b56f7cc5d6a87c8f6bfd86`, retains commands, run receipts, correction and mutation paths. The [independent review](../../../output/calibration-diagnostic-repair-20260905/repair-2722861662/REVIEW-independent.md), SHA-256 `4267e05892050b85e849b8b61b5b0b54fa7b0a0bcb7a82275e0bcab8dbd1797d`, accepts the exact increment and its bounds. Their [artifact manifest](../../../output/calibration-diagnostic-repair-20260905/repair-2722861662/artifact-manifest.json), SHA-256 `b749d9d6941ccc0a1aeb9bd74b0df2ab35fddf710977867c753c0add5beb5c27`, binds the retained evidence without circularly including the later review.

## Limits and cleanup

The measured population is five synthetic returned-spawn cases. Synchronous `spawnSync` throws, actual native diagnostics, arbitrary getters or non-Error causes, publication execution and downstream report-file writing remain unmeasured. Identity reads of admitted native prerequisites do not execute them or measure construction sources. These results establish neither complete diagnostic-content release nor general OS isolation.

All 66 unique synthetic roots from the six pre-parent runs were checked absent. The parent's fresh eleven roots were also checked absent. The retained CIM process postcheck was unavailable because access was denied; terminal Vitest exits and mocked native spawn do not independently enumerate anonymous worker PIDs or prove general process cleanup. In these diagnostic runs, no native helper, PowerShell, Poppler, browser or server was launched, and no process was killed. The disclosed protocol, disqualified source incident, rejected camera candidate and runtime boundaries remain unchanged. No source-bearing or default/full gate, migration, commit, push or full-goal completion follows from this repair.
