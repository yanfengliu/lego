# AGENTS.md — lego

## What this is

A build player for LEGO set 21066 (owner, 2026-09-24): `npm start` plays the build one printed step at a time, with play, pause, step and scrub controls and a 3D view to examine, beside the booklet page that prints each step. It plays LEGO's official model packed with LDraw parts until the closed loop behind it works: reading a printed LEGO instruction booklet and building its set — counting every part, compiling each printed step into a build program, placing each piece, checking each step against the booklet's own picture, and playing the build back. That loop stays general, since other sets are deferred, not dropped. Stack: TypeScript, Three.js, React, Vitest, Playwright, Python.

Not a manual brick editor (the old one at `/editor.html` was deleted in milestone 2b; its reading pipeline stayed), BrickLink Studio clone, general mesh editor, complete official-parts catalog, or promise of physical stability, clutch or instructions, and not merged with `3d-maker` just because both render 3D.

Session start: read `docs/START.md` and this repo's rules in `docs/policies/local-rules.md`; read a design doc only when the task changes its system. Claim a feature, command, validator or harness exists only once live files and a run prove it. No status in this file: history is `docs/devlog/summary.md`, the measured position `docs/design/building-system.md`.

<!-- FLEET-CANON:BEGIN sha=e54f2a9ae007 generated from ../fleet/FLEET.md by `npm run sync-canon` — do not edit inside this block; this repo's own rules go in docs/policies/local-rules.md -->
## Fleet constitution

Reasons and evidence per `[Rn]`: `../fleet/docs/canon-rationale.md`. `../fleet/` is fleet's checkout beside the repo's primary checkout, also from a worktree. The designated coordinator reads `../fleet/docs/skills/coordinator.md` before planning and after each compaction, and any agent reads that file's "Delegate" section before delegating. Before these kinds of work, read the matching section of `../fleet/docs/work-rules.md`: visual and interactive work; games, simulations and research; measuring, debugging and slow steps; writing error messages; toolchains, dependencies and model calls; standing loops and unattended runs; pushing executable changes; a user-reported defect; editing skills, agent instructions or rules; run output and files over 256 KiB; handing off or stopping mid-task.

### Fleet Orchestration Policy

Deliver the requested outcome with verified correctness, coherent architecture and minimal necessary complexity. Optimize useful progress, not agent count, code volume or maximum reasoning. Adapt rigor to risk. This policy grants no new permissions or capabilities. [R1]

**Roles.** Only an explicitly designated agent coordinates; each scope has one accountable integration owner. [R2]

Workers own bounded outcomes and local implementation decisions. [R3]

Inspect instructions, code, docs, tree state and active tasks; set outcome, non-goals, acceptance criteria, dependencies and verification; settle ambiguity with evidence and reversible defaults. [R4]

**Session size** (owner directives, 2026-09-23 and 2026-10-22). Sessions run long: take new requests as separate assignments in the same session, and never hand off to a successor session to shed context; auto-compaction carries the session. Split tasks expected to exceed about 200k context tokens into milestones within that budget, each committed and merged to main once green. Milestones are task boundaries; a compaction never justifies wrapping up or handing off. [R6]

**Coordinate safely.** Beyond a trivial read, each session or agent defaults to its own worktree; serialize overlapping writes only when none is available, and say why. Finish each bounded increment in its session: merge to main, push, then `git worktree remove`, remove completed task-owned branches and unneeded temporary files, and explicitly transfer the ownership and location of still-needed resources. Report any merged worktree left and its location as a defect. Never overwrite or discard another participant's work. On resumption, first inspect surviving worktrees, artifacts and task status, assuming nothing survived until checked; recover what exists and preserve unfinished work. [R7]

Workers act autonomously in scope; escalate cross-task interfaces, persistent formats, security boundaries, major dependencies and scope changes to the coordinator for resolution within the approved mandate. Unapproved major architecture or product changes and consequential external actions need human authorization. Fleet rules (FLEET.md, the fleet's skills and runbooks, canon candidates, and agent memory) change only when the owner asks (owner directive, 2026-10-28). Agents propose changes instead of making them. The one exception: they may add a proposal to `../fleet/canon-candidates.md`, with the lesson, its evidence and the rule it would change (owner directive, 2026-10-29). They never change, promote or delete an entry: the owner decides each one, and the session the owner asks makes the change. Never reset consumed allowances. [R8]

**Implement and verify.** Inspect, implement a coherent increment, check, diagnose, fix, recheck. Preserve architecture; no unrelated rewrites, speculative abstractions or unnecessary dependencies. Implement when requested. Use task-appropriate evidence and baselines; prototype uncertain ideas before generalizing. Never weaken tests or conceal failures to claim success. Docs-only work uses content and version checks; skip runtime tests and CI waits. [R9]

During authorized work and within scope and budget, proactively improve products and the task's orchestration, learn from recorded outcomes and propose improvements to fleet rules. Read `../fleet/docs/skills/self-improvement/SKILL.md` when proposing a fleet-rule change or turning a mistake into a gate (owner directive, 2026-10-29). [R33]

Obtain independent, preferably read-only review for substantial or high-risk changes when available. Review the exact revision against acceptance criteria. Report unavailable review; fix justified findings, rerun affected checks, and obtain focused re-review when fixes invalidate earlier review. [R10]

**Integrate, report, and stop.** Reassess after two failures for one reason. Unless another budget is set or the user authorizes more, cap automatic repair at five substantive attempts, then report; explicit overrides hold for their stated scope without asking again. Keep updates brief and decision-relevant. Stop when acceptance criteria and material findings are resolved; invent no follow-up work. [R11]

**Final acceptance gate.** The integration owner integrates in dependency order and on the final integrated revision's actual changes and evidence, not worker summaries, checks every acceptance criterion, runs relevant automated checks and exercises affected end-to-end behavior and cross-task interactions. Substantial or high-risk work gets independent read-only review of the integrated changes, integration fixes included. Confirm the merge to main; report that revision, review status and every failed, skipped or unavailable check and unmet criterion. Nothing is fully verified with an open material finding or required check. [R12]

### Fleet conventions

- Repository rules add local constraints consistent with this policy; they cannot override its permissions, adaptive workflow or stopping limits. [R13]
- Gates pass before any commit touching code, a merge included: merge on a detached HEAD or its own branch and move main to it once its gate passes. The user's standing grant covers committing, merging to main and pushing in their repos; force-pushing, rewriting history, deploying and publishing still need authorization. Work is done only once merged to main, regardless of green branch or worktree gates; report unmerged work's location. [R14]
- For substantial or high-risk changes, use independent review when available. High-risk includes persistence and migrations, security and auth, concurrency, money, supply chain, and executable changes in sibling repos; `../fleet/docs/skills/multi-cli-review.md` provides the review mechanics. [R10]
- Reviewer model pins live only in `../fleet/docs/skills/multi-cli-review.md`; every model a product calls is pinned in its calling repo. No model IDs are hardcoded elsewhere. [R29]
- Read `docs/learning/lessons.md` at session start. Record the session's lessons there; each names its retiring gate and is deleted in the commit landing it. A gate counts only after going red with the defect reintroduced, following `../fleet/docs/lessons-template.md`. [R18]
- Gates prove nothing beyond their bounds: name the bound in the header and pin every reproducing input. Distinguish passed from did-not-run; a check built from its checked symbol proves only self-agreement. [R19]
- Verify outcomes beyond exit status, red or green, and return values: read the artifact that should have changed. Retest inherited blockers before repeating them. [R20]
- Keep plans and every authored review round in permanent `docs/work/<id>_<theme>/` folders (`../fleet/docs/work-docs.md`). Record history, not status: a dated devlog line per behaviour-changing session in `docs/devlog/summary.md` (`../fleet/docs/devlog-template.md`). [R24]
- Use common words with the same meaning in chat, docs, commits, PRs, comments and errors. One idea per sentence unless a rule needs more. Cut length, not facts: keep exact terms, numbers and evidence. Quotes and pastes are exempt; do not copy this canon's style. One line per paragraph, no hard wrapping. [R25]
- When blocked, immediately hand over the redacted artifact with the named blocker, before analysis; continue safe independent work. [R27]
- The owner's directions that outlive a task land that session in `../fleet/FLEET.md` if fleet-wide, otherwise the repo's `docs/policies/local-rules.md`; report where. [R31]
- When a hard problem blocks progress, run the search in `../fleet/docs/skills/hard-problem.md`. [R32]
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
