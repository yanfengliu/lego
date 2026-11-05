# AGENTS.md — lego

## What this is

A build player for LEGO set 21066 (owner, 2026-09-24): `npm start` plays the build one printed step at a time, with play, pause, step and scrub controls and a 3D view to examine, beside the booklet page that prints each step. It plays LEGO's official model packed with LDraw parts until the closed loop behind it works: reading a printed LEGO instruction booklet and building its set — counting every part, compiling each printed step into a build program, placing each piece, checking each step against the booklet's own picture, and playing the build back. That loop stays general, since other sets are deferred, not dropped. Stack: TypeScript, Three.js, React, Vitest, Playwright, Python.

Not a manual brick editor (the old one at `/editor.html` was deleted in milestone 2b; its reading pipeline stayed), BrickLink Studio clone, general mesh editor, complete official-parts catalog, or promise of physical stability, clutch or instructions, and not merged with `3d-maker` just because both render 3D.

Session start: read `docs/START.md` and this repo's rules in `docs/policies/local-rules.md`; read a design doc only when the task changes its system. Claim a feature, command, validator or harness exists only once live files and a run prove it. No status in this file: history is `docs/devlog/summary.md`, the measured position `docs/design/building-system.md`.

<!-- FLEET-CANON:BEGIN sha=b0a069afa8a5 generated from ../fleet/FLEET.md by `npm run sync-canon` — do not edit inside this block; this repo's own rules go in docs/policies/local-rules.md -->
## Fleet constitution

Shared rules for every repo under `github/`, kept in `../fleet/FLEET.md`; `../fleet/` is fleet's checkout beside this repo's primary checkout. Where a rule gives its reason, use the reason to judge cases the rule does not name; each `[Rn]`'s history is in `../fleet/docs/canon-rationale.md`. This repo's `docs/policies/local-rules.md` may add rules but cannot change these permissions or limits. [R13]

The designated coordinator reads `../fleet/docs/skills/coordinator.md` before planning and after each compaction, and any agent reads that file's "Delegate" section before delegating. Before these kinds of work, read the matching section of `../fleet/docs/work-rules.md`: standing loops and unattended runs; editing skills, agent instructions or rules; handing off or stopping mid-task.

### Permissions

- Commit, merge to main and push without asking. Force-pushing and rewriting history (they destroy history), and deploying and publishing (they reach other people), need the owner's OK. [R14]
- Ask before a major architecture or product change, a new major dependency, a change to a persistent format or a security boundary, or any other consequential action outside this machine, such as posting or sending something. [R8]
- Change fleet rules (FLEET.md, fleet skills and runbooks, agent memory) or add a rule to a repo's `docs/policies/local-rules.md` only when the owner asks, because the owner sets policy. You may add a proposal with its evidence to `../fleet/canon-candidates.md`, but not edit its entries. [R8]

### Sharing the machine

- Other Claude and Codex sessions may be working in this checkout, and you cannot see them. Do anything beyond a quick read in your own worktree, because two sessions in one tree spoil each other's gates and commits. Never revert, overwrite or delete changes you did not make. When resuming, check which worktrees, branches and files already exist. [R7]
- Done means merged to main and pushed: the owner archives sessions, and work left on a branch is lost. Merge on your branch, get the gates passing there, then move main, because other worktrees build on local main. Judge the merged result itself, not a worker's summary. Then remove your worktree and branch, and report where any unmerged work is. [R14]

### Doing the work

- The repo's gates must pass before any commit that touches code. Docs-only changes need content checks and any gate the repo names for docs, not runtime tests or CI waits. [R14]
- Check the thing that should have changed (the file, the page, the number), not just the exit code or a tool's report: both can pass over a defect. Retest a blocker you inherit before repeating it. Never weaken a test or hide a failure to get green. [R9]
- Look at visual and interactive work rendered at full resolution, through the real controls, from fixed and random views, because passing tests say nothing about pixels. Run it headless unless a visible window is needed. [R16]
- Slowness on the critical path, such as a gate rendering on the CPU of a machine with a GPU, is a defect to fix. [R22]
- After pushing code, follow CI to the end; read a failed job's steps before blaming the code, since a billing limit fails jobs before any step runs. [R15]
- If a fix fails twice for one reason, rethink it. After five real repair attempts at one problem, whatever the approach and counting earlier sessions, stop and report, unless the owner set another limit; for a problem that keeps winning, run the search in `../fleet/docs/skills/hard-problem.md`. Stop when the task's criteria are met; do not invent follow-up work. [R11]
- For substantial or high-risk changes, use independent review when available. High-risk includes persistence and migrations, security and auth, concurrency, money, supply chain, and code changes in another repo. Review the exact revision against the task's criteria, and say so when review was unavailable. Fix the findings that matter and have those fixes checked; note minor ones instead of starting another round. `../fleet/docs/skills/multi-cli-review.md` provides the review mechanics. [R10]
- A defect the owner reports gets a test for its whole class and an entry in `docs/learning/defect-register.md`, because a fix without a check tends to come back. [R17]
- Sessions run long: take new requests in the same session, and never hand off to a new session to shed context. Split work expected to need more than about 200k tokens of context into milestones, each merged to main. [R6]

### Records, sized to the work

- Read `docs/learning/lessons.md` at session start; it lists this repo's known traps, and its header says how to add one. [R18]
- Work that spans sessions, has several agents writing, or gets an independent review keeps its plan and review records in `docs/work/` (`../fleet/docs/work-docs.md`) and adds a dated line to `docs/devlog/summary.md` (`../fleet/docs/devlog-template.md`) when it lands. Other work needs neither. [R24]
- Raw output (logs, captures, screenshots) stays in ignored folders. Never commit a binary over 512 KiB or any file over 1 MiB; LFS needs the owner's OK. [R23]

### Style and environment

- Plain words; one line per paragraph, no hard wrapping. A report says what changed, how it was checked (including any check skipped or failed) and what is not done. [R25]
- Node 24 is the baseline. Products pin the model IDs they call in their own repo, and nowhere else. Reviewer model pins live only in `../fleet/docs/skills/multi-cli-review.md`. Runtime model calls are allowed and paid for; make per-item calls one-shot, not agent sessions. [R28, R29]
<!-- FLEET-CANON:END -->

## Gates

Node 24 (`.nvmrc`), npm 11, Python 3 as `python`, Playwright Chromium; commands: `package.json`. Iterate on the smallest relevant check; `npm run verify` passes before implementation is done, and a unit-only pass never covers a change crossing persistence, broker, provider, browser, import/export or rendering boundaries. A dependency change also runs `npm run audit` and `audit:runtime`; a new HIGH or CRITICAL blocks.

## Invariants & boundaries

- The versioned `BrickDocument` part-and-connection graph is the truth: part transforms are authoritative, connection edges validated annotations; scenes, renders, LDraw, GLB, screenshots and provider responses are derived.
- Same canonical base bytes + normalized build-program bytes under the same compiler, schema, catalog, template, transform, connector, collision and validator snapshots give the same structural hash and validation report.
- Saved documents pin their truth snapshots; a schema or truth change ships a versioned migration and report, never a silent reinterpretation.
- Manual edits may leave a draft-invalid document; a compiled patch — all a printed step or template can become — is scope-valid, adds no blocking failure outside its scope, and keeps a globally valid base globally valid.
- A command refuses to create a state the domain forbids (a placement nothing holds up) and says what was wrong; the UI cannot reach that state.
- Model output (vision proposals, panel judgements, templates, repairs) is untrusted data: it cannot declare itself valid, author trusted scope or provenance, run code, waive a hard validator, admit a part or directly mutate the user document. It proposes; a deterministic check disposes, and no visual score outweighs a hard failure.
- A repair, replan or rejected placement creates an immutable child candidate; never overwrite a parent or erase counterevidence — backtracking needs the wrong branch to survive as evidence, not vanish as a gap.
- User documents change only by explicit manual command or previewed acceptance; nothing automatic accepts a patch, promotes knowledge, merges code, deploys, changes secrets or weakens its evaluator.
- A physical claim applies only to the exact document and catalog hash tested; a structural edit invalidates it.
- Domain, build-program, canonicalization, migration and validation code never depends on the DOM, React, Three.js scene objects, provider SDKs or persistence adapters; the Three.js scene is a disposable view, disposed deliberately and rebuilt after context loss.
- The released companion trust broker alone holds production signing, credential proxying, authoritative events and artifact sealing, and enforces a scope-bounded, one-use acceptance capability whose event it seals; only the user originates acceptance, consent or scope. It never loads or launches challenger code; production and test identities, keys, ledgers and namespaces stay apart; the independent evaluator accepts only expected-namespace seals; challengers get no arbitrary filesystem access or direct network egress, and only bounded schema-checked aggregates leave the evaluator.
- The browser stays a working offline build player; runtime model calls, recorded runs and patch acceptance go through the broker. One bad response, candidate, render or strategy cannot corrupt the document or crash the player.
- `lego` owns brick semantics, `3d-maker` genome-to-mesh semantics: share only generic experiment, lineage, artifact, comparison or evaluation interfaces both have proved they need, never add the game engine to brick-domain, browser, broker or evaluator packages, and change a sibling repo only when the task scopes it, never importing its invariants.
- Imports, archives, images, LDraw, JSON, HTML, provider output and loopback requests are hostile: bound bytes, depth, dimensions, expansion, recursion, operation and part counts, time, render memory, paths, origins and output schemas.
- Credentials, tokens, signing keys, private endpoints and session material stay out of source, bundles, run artifacts, prompts and logs; tests mock provider and network calls, and live calls need explicit authorization. User references and designs are local by default: sending, training, benchmark use, sharing and Git retention are separate consents.

## Conventions

Task-run evidence goes only to ignored `var/runs/`, `var/state/`, `output/` and Playwright's `test-results/`; `docs/START.md` says what goes where.
