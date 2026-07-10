---
name: multi-cli-review
description: Use when running the multi-CLI (Codex + Claude) adversarial code review on high-risk changes or full-codebase audits — routes to the fleet-canonical runbook (pins, commands, output extraction, failure modes) plus lego-specific notes.
---

# Multi-CLI review — lego stub

**Read the fleet-canonical runbook now:** `../loop-ops/docs/skills/multi-cli-review.md` — current review model pins (the fleet's single bump site), exact CLI commands, `-o` output extraction, Windows gotchas, and failure modes. Do not act from memory of an older per-repo copy of this skill.

lego-specific notes:

- Reviewer pin sites in scripts: NONE (verified 2026-07-10 by repo-wide grep; replace this note if a script ever hard-codes a reviewer model).
- Policy section mapping: where the canonical says "AGENTS.md → Code review", this repo's policy section is AGENTS.md → Review and security (review triggers, aspects, reviewers-must-read directive, convergence).
- Doc-accuracy addendum (this repo defines one — include it in every review prompt): verify docs in the diff match the implementation; flag stale signatures, removed APIs still mentioned, or missing coverage in the canonical design documents (`docs/design/spec.md`, `docs/design/learning-system.md`, `docs/skills/brick-assembly-loop.md`).
- Capture home: the canonical default `tmp/review-runs/<objective>/<date>/<iteration_number>/` applies unchanged and is explicitly gitignored here (`/tmp/review-runs/` under "Raw browser and reviewer evidence"); never staged, cleaned up after synthesis.
- Unreachable-CLI notes: this repo has no devlog or progress log yet — record the unreachable CLI in the commit body until one exists.
