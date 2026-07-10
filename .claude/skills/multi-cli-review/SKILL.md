---
name: multi-cli-review
description: Use when running the multi-CLI (Codex + Claude) adversarial code review on high-risk changes or full-codebase audits — current review model pins, exact CLI commands, sandbox flags, output extraction, and CLI failure modes.
---

# Multi-CLI review runbook

This is the mechanics companion to AGENTS.md → Review and security. Policy (when multi-CLI review is required, the review aspects, the reviewers-must-read directive, convergence criteria, and the review artifact conventions) lives in AGENTS.md; this file is how to actually run the CLIs. Read this file before every multi-CLI session.

## Current review model pins (single bump site)

| CLI | Model | Effort | Notes |
|---|---|---|---|
| Codex | `gpt-5.6-sol` | `-c model_reasoning_effort=ultra` | `ultra` verified 2026-07-09; earlier models capped at `xhigh` |
| Claude | `opus[1m]` | `--effort max` | tracks the latest Opus alias; `[1m]` selects the 1 M-token-context variant — quote the model string so the shell doesn't glob-expand the brackets |

Bump review pins here first, per the AGENTS.md model-currency rule, with a one-line smoke test before committing; then sync any repo-local scripts that hard-code reviewer pins (known sites in this repo: NONE — replace this note if a grep of scripts finds hard-coded reviewer models). If this repo pins app-facing LLM models for its own features, that policy lives in the repo's own docs, not here.

## Pre-flight

Always upgrade the Codex CLI before each review session (defensive against silent model-name rejection and sandbox-policy regressions in older builds): `npm install -g @openai/codex@latest`, then verify with `codex --version`. `gpt-5.6-sol` requires Codex CLI ≥ 0.144.1 — older builds reject the model name with `requires a newer version of Codex`.

## Prompt assembly

Start from the baseline below and **enrich it with task-specific context** — the change's intent, prior-iteration findings to verify, files to focus on, and an anti-regression checklist. The bare baseline returns generic feedback; useful reviews need the specifics.

> "You are a senior code reviewer. Flag bugs, security issues, and performance concerns. Do NOT modify files or propose patches. Only return findings, explanations, and suggestions in plain text. Be concise but effective: keep the reasoning, impact, and file/line evidence needed to act without preserving transcripts, command chatter, or repetitive detail. Only point out an issue if it is real and important. If there is no issue, say so instead of nit-picking."

Every prompt must additionally include the reviewers-must-read directive (quoted in AGENTS.md → Review and security) and a doc-accuracy addendum: verify docs in the diff match the implementation; flag stale signatures, removed APIs still mentioned, or missing coverage in the canonical design documents.

Codex prompts should also include the marker sentence — a harmless secondary delimiter now that `-o` extraction is primary (see Reading Codex output below): `Begin your review with the literal token "===BEGIN-REVIEW===" on its own line and end with "===END-REVIEW===" on its own line. Do not emit those markers anywhere else in your output.`

## Commands

Codex diff review (note `-o` and the redirected stdout — see Reading Codex output):

```bash
git diff [branch] | codex exec --model gpt-5.6-sol -c model_reasoning_effort=ultra -c approval_policy=never --sandbox read-only --ephemeral -o codex-review.txt "<prompt>" > codex-fullstdout.log 2>&1
```

**Do NOT pass `--ignore-user-config`.** That flag bypasses `~/.codex/rules/default.rules`, which is what permits codex on this Windows machine to use Windows-native commands (`findstr`, `type`, `dir`, `ls`) when its bash wrapper hits the PowerShell deny rule. Without those rules, codex's `read-only` sandbox blocks every shell tool and the reviewer silently falls back to "review without reading the code." Verified 2026-05-02.

Claude diff review (diff piped via stdin):

```bash
git diff [branch] | claude -p --model "opus[1m]" --effort max --append-system-prompt <prompt> --allowedTools "Read,Bash(git diff *),Bash(git log *),Bash(git show *)"
```

## Full-codebase reviews (no diff)

Drop the `git diff` pipe and pass the prompt as the positional argument so each CLI agentically explores the workspace from its CWD; keep the same model/effort flags. Give each reviewer a distinct subsystem lens (with a whole-tree mandate to range freely) so N reviewers cover the codebase deeply rather than redundantly.

- Claude: `claude -p "<full prompt>" --model "opus[1m]" --effort max --allowedTools "Read,Glob,Grep,Bash(git diff *),Bash(git log *),Bash(git show *),Bash(wc *),Bash(ls *),Bash(find *)"`. `--append-system-prompt` is unnecessary there and the long-prompt-as-stdin form is not needed.
- Codex still uses `-o <file>` here — the clean final review lands in that file while the (large) agentic exploration chatter goes to the redirected stdout log.
- **Two Windows gotchas, both validated 2026-06-13 on `/full-review`:** (1) **the no-pipe form hangs** — with nothing piped, codex (and claude `-p`) block reading stdin; redirect `< /dev/null` for immediate EOF: `codex exec --model gpt-5.6-sol -c model_reasoning_effort=ultra -c approval_policy=never --sandbox read-only --ephemeral -o codex-review.txt "<full prompt>" < /dev/null > codex-full.log 2>&1`. (2) **Do NOT run two `codex exec --sandbox read-only` instances concurrently** — the Windows sandbox helper fails to initialize (`orchestrator_helper_exit_nonzero … exited with status … -1073741502`, i.e. `STATUS_DLL_INIT_FAILED`) and codex reviews without reading the code. Run codex reviewers **sequentially** (chain the second to start when the first writes its `done` sentinel). Solo codex works fine *alongside* any number of concurrent Claude instances — Claude uses the harness tools, not that sandbox — so the working pattern is: all Claude lenses in parallel + codex lenses serialized.

## Per-CLI codebase-reading capability

Grounded reviews require reviewers that can actually read the repo:

- **Claude** reads via the Read/Glob/Grep tools you grant it (`--allowedTools "Read,Glob,Grep,..."`). Treat as load-bearing for code-vs-spec correctness. Caution: a spawned `claude -p` reviewer with `--allowedTools` is not hard-sandboxed — audit `git status` after a Claude review and prefer the Codex read-only sandbox when rigor matters.
- **Codex** can read files when `--sandbox read-only` runs WITHOUT `--ignore-user-config` (see above). Smoke-test occasionally with `echo "Read X and report" | codex exec --sandbox read-only --ephemeral` — codex must return content, not bail on "PowerShell blocked."

## Running

Diff reviews take ~5 minutes per CLI on a multi-hundred-line diff. Run both CLIs in parallel with `run_in_background: true`, capturing each CLI's output under `tmp/review-runs/<objective>/<date>/<iteration_number>/` (never staged; clean up after synthesis). Wait via a single background `until` poller (`until [ -s codex-review.txt ] && [ -s claude.txt ]; do sleep 8; done`) so the harness's no-long-sleeps guard doesn't fire and you don't poll repeatedly.

## Reading Codex output

Use **`-o <FILE>`** (alias `--output-last-message <FILE>`) and read that file. `codex exec`'s stdout is polluted: it echoes the entire piped stdin (the diff/spec), the prompt, and exec-sandbox chatter, then prints the review near the end — so a naive Read of the redirected stdout burns 30K-100K tokens of repeated content, AND a naive first-marker `awk` extraction grabs the echoed prompt (which contains the literal marker instruction), not the review. `-o` writes ONLY the agent's final message — the review itself — to `<FILE>`, with none of the echo or chatter (validated 2026-06-13: a review whose full stdout was 280 KB produced a ~2 KB `-o` file). Read `codex-review.txt` (typically 1-5 KB, clean).

Fallbacks (only if `-o` is empty/unavailable):

- Extract between the LAST marker pair (the first pair is the prompt-echo): `b=$(grep -n '===BEGIN-REVIEW===' codex.txt | tail -1 | cut -d: -f1); e=$(grep -n '===END-REVIEW===' codex.txt | tail -1 | cut -d: -f1); sed -n "$((b+1)),$((e-1))p" codex.txt`
- `wc -l codex.txt`, then `Read` the last ~250 lines.

Claude writes clean output — read it normally; markers are optional but harmless if you include them in both prompts for consistency.

## Failure modes

If a CLI is unreachable (quota exhaustion, model name rejected by harness, network/SSL failure), proceed with the remaining reviewer and note the unreachable CLI in the devlog (until this repo has one, the commit body). One solid review is still useful signal — do not block the workflow waiting on the other; always retry the unreachable CLI on the next iteration. When independent-reviewer COUNT matters for thoroughness (a full-codebase `/full-review`, an audit), compensate for a down CLI by spawning EXTRA instances of the reachable one as independent reviewers, each with a distinct lens, rather than dropping the count.
