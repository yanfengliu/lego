# Defect register

Every defect the user reports gets a permanent entry here with the symptom as reported, the investigation, the root cause, the fix, and the whole-class check that remains. This is neither the [devlog](../devlog/summary.md) nor [lessons.md](lessons.md): history records what changed, a lesson is removed when a gate absorbs it, and this register preserves the symptom-to-cause mapping even after the fix ships.

Newest first.

---

## 2026-09-24 - Printed step 31 played back with the wrong parts

**Status:** fixed and gated.

**Symptom.** In the editor, printed step 31 of the reference build (booklet page 35) showed two dark bluish grey 1x3 bricks. The booklet draws a second black 1x2x2 brick and a light grey 1x2 plate there. The harness still reported the build valid through step 31.

**Investigation.** The step's piece count matched its callouts (1+1+2), and the kernel found nothing wrong. `tools/booklet/align.ts` assigned official bricks to printed steps by callout counts only. Step 31's official run held elements with counts {2,1,1}, the same as its callouts, but not the same elements. Element identity was checked only over the whole set. Run inside the harness, closed-set identification showed 22 steps where counts alone gave other parts than the callouts draw.

**Root cause.** When two steps' counts coincide, alignment by counts cannot tell their parts apart. At pages 35-36 the booklet builds two sibling sub-builds in the opposite order to the model, and both runs' counts came out equal. So "valid through step N" measured kernel validity for whatever bricks the counts picked, not whether each step was right.

**Fix.** `npm run booklet` runs identification (`tools/booklet/identify-stage.ts`). It aligns each step by the elements its callouts name (`tools/booklet/align-identity.ts`), and counts only the callouts identification flags. The repair moves the brick the model builds nearest the step that receives it, so a sub-build stays whole. Step 31 now holds the booklet's sub-build, checked against page 35.

**How it is checked from now on.** `tools/booklet/align-identity.test.ts` has a synthetic two-step case where counts pick the wrong parts. Swapping the criterion for count-only logic turns 5 of its tests red. A sub-build case turns red when the repair moves the latest-built brick instead. Each run reports every step as exact identity, count fallback or mismatch, and scores identification against the model; the committed headline carries both. Bound: the 43 steps with flagged callouts still match those callouts by count, so a wrong part of equal count there would pass.

**Class.** A per-step check that compares counts where identities are available. Any count-only match can hide swapped parts.

---

## 2026-09-24 - 42 GB of run evidence under the ignored output/ and var/

**Status:** cleaned up; a budget check exists but nothing runs it automatically.

**Symptom.** The owner found about 42 GB of ignored run evidence in the checkout: 43.6 GB under `output/` and 213 MB under `var/`, of which `output/real-build/runs/` alone was 37.6 GB.

**Investigation.** An audit (2026-09-23, main at 982634d) listed every entry, traced which paths a current entry point reads by default, and found 2.72 MB still needed: `output/official-model/`, one frame-registry file under `output/real-build/history/`, `output/part-identification/prefix50-semantic-closure.json`, and seven small score files the gates rewrite.
**Root cause.** The evidence roots are ignored, so growth never shows in a diff, and nothing measured their size. The fleet rule (canon R23) says to delete evidence once no task needs it, but a rule nobody is prompted to apply does not run.

**Fix.** The owner deleted everything else, leaving about 2.8 MB. Design docs that cited deleted files by byte count and sha256 were cleaned in the same reset.

**How it is checked from now on.** `npm run evidence:budget` (`scripts/check-evidence-budget.mjs`, test `scripts/check-evidence-budget.test.mjs`) fails when `output/` plus `var/` in the checkout pass 256 MiB, naming the size, the budget and the remedy. Its test goes red if the comparison is removed. Honest bound: it is not part of `npm run verify`, whose clean-checkout runs would always pass, so today it runs only when someone invokes it. Wiring it into session start or a hook is open in `docs/work/1_booklet-reset/plan.md`.

**Class.** Unmeasured growth in an ignored path. Any ignored root that a tool writes to needs a size check that someone is made to see.

---

## 2026-09-24 - The README grew to 25.6 KB

**Status:** fixed and gated.

**Symptom.** `README.md`, the project's front door, had grown from about 4 KB (2026-07-10) to 25.6 KB (2026-08-29), too long to read in one sitting.

**Investigation.** One README section gained a paragraph on almost every campaign commit, restating status the design docs and devlog already held. The devlog summary had the same shape: 76 of its 118 lines ran past 300 characters, the longest 4,763.

**Root cause.** Nothing measured the file, so each small addition passed unnoticed.

**Fix.** The README was cut to 4.8 KB and the devlog summary to one line per entry (7c43b22, 4fbc04c).

**How it is checked from now on.** `npm run docs:budget` (`scripts/check-doc-budgets.mjs`), a step of `npm run verify`, fails when `README.md` passes 6,000 bytes, `docs/START.md` 10,000, `AGENTS.md` 30,000, or any `docs/devlog/summary.md` entry line 300 characters. `scripts/check-doc-budgets.test.mjs` makes each real budget go red one byte over. Bound: it checks length only, not whether the text is true.

**Class.** A document that is read whole on every session, growing one paragraph at a time.

---

## 2026-09-24 - Two weeks of work left uncommitted

**Status:** archived; the rule is canon, and only part of it is automated.

**Symptom.** The first-50 campaign made no product commit after 2026-08-29. By 2026-09-22 its work was a 759-file uncommitted tree with red gates, which had to be archived rather than merged (branch `archive/first50-campaign-wip-20260908`, f44f1b8).

**Investigation.** The campaign ran as a long unattended "do not stop until done" loop with no commit point. Its blind staged protocol also banned the full browser gate before a late stage, so the tree was never in a state where gates could pass and a commit could land.

**Root cause.** No milestone boundary: nothing required the work to reach main in pieces that each passed the gates.

**Fix.** The tree was archived, not merged, and main was cleaned (b1e1d0e). The blind protocol was retired, and the reset lands as milestones, each merged to main once `npm run verify` passes.

**How it is checked from now on.** Fleet canon R6 (in `AGENTS.md`) splits work expected to need more than about 200k tokens into milestones, each committed and merged to main once green, and forbids an unattended loop without milestone commits; R14 counts work as done only once merged. `npm run verify` (which now includes `docs:budget`) is the gate each milestone passes before it merges. Honest bound: no automated check detects a long-lived uncommitted tree or an old unmerged branch. The rule is enforced only by the coordinator reading the working tree and branches at session start.

**Class.** Work that cannot be lost only if someone remembers to commit it.

---

## 2026-09-24 - Token burn from sessions that never restarted

**Status:** rules and settings changed; no automated check.

**Symptom.** From 2026-08-04 to 2026-09-15 this repo used about 4.0B Claude tokens and about 3.0B Codex tokens and verified 0 booklet steps.

**Investigation.** A token audit of session transcripts (2026-09-22, `docs/work/1_booklet-reset/design.md`) parsed 579 transcripts and found 87.8% of the Claude tokens in two sessions that were never restarted; their contexts reached 998k and 846k tokens on the 1M-context setting, so every turn re-read that context. Fan-out added to it: subagent and workflow transcripts held 66% of tokens, across 181 subagents, all run at max effort.

**Root cause.** A session kept taking new requests with no size limit, and delegated work used the same model and effort whatever its size.

**Fix.** The owner changed the Claude Code settings from the 1M context window at max effort to the standard context window at high effort, and the canon gained the session limits below.

**How it is checked from now on.** Fleet canon R6: one task per session, milestones within about 200k tokens of context, mechanical subagents at lower effort or a smaller model, and per-item model calls as one-shot calls, never agent sessions. The standard context window means no session can grow to 1M tokens. Honest bound: no automated check measures session size or fan-out; the context-window setting is the only mechanical limit.

**Class.** A cost that grows with session length and nobody measures while it grows.

---

## 2026-08-23 - Six fail-closed paths hid genuine native Error detail

**Status:** fixed and gated in the Gate-3 step-7 evidence unit.

**Symptom.** The authoritative `npm run verify` reached Vitest and then failed five cases in `real-build-run-panel-camera-lifecycle.test.ts` - hostile page rejection, genuine raster failure, page-disposal failure, PDF plus loading-task cleanup failure, and hostile cleanup values - plus the hostile transition-witness case in `real-build-browser-output-v3.test.ts`. The retained error text had collapsed the genuine native failures into a generic non-native thrown-object fallback, so the evidence no longer named what actually failed.

**Investigation.** Running only those two files reproduced all six failures. Each path handed a real native `Error` to the newly generalized non-probing formatter. The blanket object fallback intentionally refused to inspect hostile objects but also erased safe own name/message data from native errors. The first repair was not safe enough: it called the live global `Error.isError` receiver and trusted `descriptor.value` without proving that `value` was an own data property, so replaced globals and polluted descriptor prototypes could still steer the formatter.

**Root cause.** The formatter had treated "do not probe an arbitrary thrown object" and "do not read captured own data from a proved native Error" as the same rule. Its attempted exception then depended on mutable globals and an incompletely validated descriptor record.

**Fix.** The browser path captures `Error.isError`, constructor/descriptor/Reflect/string/number intrinsics before hostile code can replace them and validates the descriptor of the descriptor's own `value` property. The host path uses captured `util.types.isNativeError`, builds Error-name descriptors on null-prototype records through captured `Reflect.defineProperty`, and both paths bound the resulting strings. Evidence branding uses captured `WeakMap` set/get methods, so prototype replacement cannot forge or erase membership.

**How it is checked from now on.** `non-probing-error.test.ts`, the two original failing suites, and the forced browser source-boundary controls cover genuine native errors alongside strings, null, arbitrary objects, proxies, accessors, inherited descriptor values, replaced globals and polluted prototypes. The focused repair set passes 115/115 plus three forced-browser controls, the final Gate-3-focused unit slice passes 132/132, and the complete repository gate reruns the original six paths.

**Class.** A safety formatter that hides the cause it is supposed to retain. The standing rule is to recognize only proved native errors through captured intrinsics, copy only validated own data, and keep every other thrown object opaque.
