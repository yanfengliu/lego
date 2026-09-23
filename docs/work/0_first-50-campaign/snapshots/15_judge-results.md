# Corrected judge v2: fixed population results

All eighteen frozen judgments completed with the expected semantic outcome: six baseline passes and twelve mutant rejections. The immutable mutant writer and final comparator each exited 0. Exactly twenty Node commands ran: the previously admitted native baseline, then the nineteen remaining commands in dependency order. No candidate command was retried. Focused independent review 15 is still required before accepting the F11/F12 repair as a reusable bounded judge.

The [population handoff](judge-v2-population-handoff.json), SHA-256 `7e63884a883411145a88c08ebb1b0617952c66caf4c2dd5f3ab67adf81942835`, contains every judgment and telemetry digest, all twenty invocation receipt references/digests, all errors, counts, private projections and symmetry output. The [final comparison](runs/judge-v2-control-check-first-20260908/controls.json), SHA-256 `b2c6d3fd48de82188bf45cfab05d0e76cad1803327a1a1faf00301e4c674c8fd`, confirms all eighteen expected outcomes and all twelve single-path changes. The [mutant manifest](runs/judge-v2-record-mutants-first-20260908/manifest.json), SHA-256 `292a7b4a4a0465dfe370a553ed8bc3f113cc4256bbed2afa7d1aa7c986f75084`, binds the actual twelve record bytes to their original estimates and frozen source closure.

## Actual commands and outcomes

Every row below has recordValidationComplete true, unchanged source/input pins and empty raw stdout/stderr. Exit 1 is the expected complete semantic rejection for a mutant. The error column counts every retained error, including effects of the same mutation on dependent pair/group/aggregate checks. No error was discarded. Exact error objects and their paths remain in each judgment and execution receipt, as well as the population handoff.

| Control | Actual exit | Native invocation ms | Pass | Errors |
|---|---:|---:|---|---:|
| native-baseline | 0 | 138.9073 | true | 0 |
| horizontal-baseline | 0 | 230.8142 | true | 0 |
| vertical-baseline | 0 | 162.4540 | true | 0 |
| combined-baseline | 0 | 152.1917 | true | 0 |
| symmetric-baseline | 0 | 204.4800 | true | 0 |
| erased-baseline | 0 | 168.4385 | true | 0 |
| symmetry-translation-only | 1 | 121.5605 | false | 1 |
| symmetry-partial-owner | 1 | 139.1720 | false | 1 |
| erased-partial-wall-rim | 1 | 107.5597 | false | 3 |
| sign-inversion | 1 | 144.9668 | false | 6 |
| forged-interval | 1 | 145.7578 | false | 4 |
| wrong-reference | 1 | 137.9130 | false | 5 |
| false-aggregate | 1 | 134.3983 | false | 2 |
| false-group-sign | 1 | 148.8731 | false | 1 |
| wrong-sample-tone | 1 | 141.4526 | false | 13 |
| forged-midpoint | 1 | 142.7900 | false | 13 |
| wrong-edge-kind | 1 | 146.3529 | false | 13 |
| forged-camera-sign | 1 | 143.5427 | false | 1 |

The record writer exited 0 in 163.2374 ms. Before any mutant judgment, read-only PowerShell record checks verified the exact twelve-member population and restored each single changed subtree to recover its pinned original. The retained [precheck](judge-v2-mutant-record-precheck.json) has SHA-256 `d6e9e9906e5511748f360d8a40453feb9391f92a83aa7b00c60a1219bb25bec0`. The final comparator exited 0 in 100.7283 ms after all eighteen judgments were present. Its invocation receipt has SHA-256 `64b9c581dfe5ea15291e4fc58668bdf63299b2765d7c69bd05d840335fb60fc0`.

## Measured corrections

Each of the four positive baselines independently checked 446 private owner sample references and all 938 signed pairs: 1,784 references and 3,752 pairs across the positives, with zero errors. Their four derived owner groups agree with the reported aggregate. The independently projected private top-to-base displacements are approximately +6.928203 pixels for native/horizontal and -6.928203 pixels for vertical/combined. These are evaluations of the retained finite synthetic records, not a new camera census.

The symmetric baseline retains its true camera and the physical 180-degree counterpart, with a geometry-preserving owner permutation and no fixed-owner edges or pairs. Translation-only symmetry is rejected solely by SYMMETRY_DISTINCT_PHYSICAL_ROWS. The partial symmetric owner group is rejected solely by SYMMETRY_ZERO_FIXED_OWNER_SUPPORT. Thus those two controls isolate the F11 omissions on the captured fixture. The erased partial-pair record is rejected by ERASED_ZERO_WALL_RIM_SUPPORT, PAIR_REFERENCE and PAIR_SET; those three errors are all retained.

The interval sign inversion, forged allowance, invalid reference, falsely asserted four-group aggregate, wrong group flag, forged sample tone/midpoint/kind and forged camera projection each produce the required named error from the frozen control contract. There are 63 total semantic errors across the twelve mutants, all retained. No incomplete validation, unexpected candidate exit, budget exhaustion, missing judgment, pin drift or no-op mutation occurred.

The largest sampled RSS among all twenty commands is 66,248,704 bytes. The longest measured native invocation is 230.8142 ms. These measurements are within the declared cooperative 60-second/256-MiB bounds; sampled RSS and V8 old-space flags do not establish an OS memory ceiling or preemptive wall-time guarantee.

## Provenance and remaining limits

The frozen source roster remains `6736d5a82de7f391b89fa8e5edc67a0c82fbbed4f26efec4f5c3382a4c3326b8`; admission remains `37c05920c85802340351bd7cf02789293b231dd8f9864236a50768b6c8b45409`; input roster remains `9373185026a18e1761de1c27f7e0d9e60100e251e2b10b9d1a484f0567e39ad2`. Every actual command has its own raw stdout/stderr files and execution receipt with true exit, native invocation elapsed time, output hashes, and all eight source plus thirty-six original input identities before and after. No original packet, estimate, judgment, private input, review 13 or NEXT-DESIGN file was edited.

Before the remaining commands, one functions.exec dispatcher call failed during JavaScript parsing with `SyntaxError: Unexpected identifier 'n'`. A PowerShell newline backtick had been placed inside a JavaScript raw template literal. No nested tool or Node command executed in that failed call. The coordinator explicitly authorized correcting only the orchestration quoting after verifying all nineteen remaining output directories were absent and the pins matched. This [separate dispatcher failure](judge-v2-remainder-dispatcher-parse-failure.json), SHA-256 `04d7af95e268b2e2b85fcf31aa85e994646d9d473fb008fc904a38fabd57fdb2`, is preserved and does not count as a candidate measurement or retry.

No estimator, image generator, renderer, browser, production gate, native launcher, Poppler process, PDF/source-image reader or new continuous mechanism ran. All Node processes completed synchronously; no owned server, watcher or GUI process remains. The judge checks recorded finite completion and pair completeness among validated reported owner edges; it does not independently regenerate the full finite owner consensus. The claims remain conditional finite pixel compatibility using pinned synthetic evaluation inputs. Continuous camera uniqueness, fractional translation, antialiasing/source-art nuisance, exact continuous correspondences and production qualification remain unproved. The only current acceptance dependency is focused review 15; NEXT-DESIGN remains unexecuted for a fresh owner.
