# Devlog — 2026-08-07 (responsiveness gate)

Recalibrating the one assertion in `npm run test:browser` that was deciding the suite by scheduling luck.

## The responsiveness gate was measuring the machine, not the page

**Timestamp:** 2026-08-07

**Action:** `candidate-lab.spec.ts` sampled a 10ms interval while four candidates generated, took the largest gap between ticks, and asserted it under 200ms. Replaced the statistic and recalibrated the ceiling from measurement. The probe now also records `longtask` entries and keeps its raw samples; the summary moved into `apps/web/e2e/responsiveness.ts`, which computes every statistic in Node so it can be unit tested without a browser, and carries the calibration table that produced the number.

**Result:** The gate is now `blockedFraction < 0.85` — the share of the generation window in which the main thread was over a 16.7ms frame budget — plus a `maximum < 1000ms` backstop for one pathological freeze. Measured over 121 completed runs on a 32-core machine across load regimes of 0, 4, 8, 16, 32, 64 and 128 held busy processes:

| statistic | idle median | all-regime range | ceiling needed to never flake |
| --- | --- | --- | --- |
| maximum gap (the old gate) | 88.6ms | 78.8 – 371.4ms | 4.19x idle |
| p99 gap | 88.6ms | 77.1 – 371.4ms | 4.19x idle |
| p90 gap | 48.6ms | 11.1 – 101.1ms | 2.08x idle |
| blocked ms over 50ms | 47.2ms | 33.4 – 767.3ms | 16.26x idle |
| blocked fraction over 50ms | 0.082 | 0.059 – 0.486 | 5.94x idle |
| blocked ms over 16.7ms | 251.2ms | 229.1 – 1177.0ms | 4.69x idle |
| blocked fraction over 16.7ms | 0.428 | 0.190 – 0.656 | **1.53x idle** |

The old 200ms ceiling failed **78 of the 121** runs while failing **0 of the 12** idle ones. The new gate at 0.85 is 1.30x the worst observed and 1.99x the idle median — still tighter, relative to normal behaviour, than the 2.26x the old ceiling had on a quiet machine.

**Reasoning:** This was never a regression. It was checked against a dependency bump landed alongside it and the built bundles were byte-identical across both lockfiles, so the page ran the same code in every run. What moved was the machine, and a maximum is the statistic most exposed to it: one scheduling hiccup anywhere in ~30 samples decides the verdict.

Two plausible repairs were tried and both died on the data, which is the part worth remembering.

A quantile is not available at this sample size. The probe collects 26–32 samples in the ~580ms an idle generation takes, so `ceil(0.99 * n) === n` and p99 is arithmetically the maximum — the same single sample under a different name. p90 does move off the tail, but its own range is 9.11x, because the sample count changes with load and drags p90 into a different part of the distribution.

Total blocked time over a 50ms budget is the maximum in disguise, and worse than it. An idle run puts only about two gaps over 50ms, so the sum tracks `maximum - 50`; under load many gaps cross the budget at once and it ranges **22.97x**, the worst behaviour of anything measured. Lowering the budget to 16.7ms is what turns the sum into a sum — about 15 gaps clear it per idle run instead of two.

What survives is a ratio, because load stretches the generation window and the blocked time inside it together and dividing one by the other cancels most of the machine out. It is the only statistic tried whose busiest and quietest runs overlap at all.

**Validation:** 14 acceptance runs held at the load that produces the highest fractions all pass, at 0.583–0.650, where the old ceiling would have failed 10 of the same 14. Both failure messages were read by forcing them, not assumed: each names the measured percentage, the blocked milliseconds, the sample count, the window, the worst gap, the long-task count, and the path to the full distribution. `responsiveness.test.ts` covers the statistics directly, including that one 300ms hiccup among fifty 30ms gaps multiplies the maximum by ten and the fraction by a fifth, and that an empty sample set throws rather than summarising as a responsive zero.

**Notes:** Three things a later session could trip over.

The tail was still moving well into sampling — the worst run was 0.598 after 76 runs and 0.656 after 107 — and two batches at the same nominal load differed by 0.07 in median, so the load parameter does not capture everything about the machine's state. A final 14 runs at the peak-producing load left every figure in the table unmoved, which is what the real tail looks like, but the 1.30x margin is deliberately not a tight fit.

The fraction can be diluted, which is the whole reason the 1000ms backstop exists. Under the heaviest load the window stretched to 4.9s while the fraction *fell* to 0.19, because the page was waiting on starved workers rather than blocking. A single multi-second stall inside a window that long would not move the fraction.

`longtask` entries do not fire for work run inside a `page.evaluate` binding — an early support check blocked the main thread for 200ms from inside an evaluate and saw zero entries, which looks exactly like the API being unsupported. Blocking from a page-scheduled `setTimeout` instead reports it correctly. The entries are recorded because they separate a page regression from a busy machine: an idle run here shows a ~89ms worst gap and zero to one long tasks, so that gap is mostly the machine; under load the same run reports nine to eleven.

Unrelated, and worth knowing: five runs mid-calibration failed with `Cannot find package 'vite'` because a sibling session was reinstalling `node_modules` in the parent checkout, which this worktree resolves into. Those failures are environmental and not the gate.
