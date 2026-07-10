# AGENTS.md

## Working style

Treat this file as adaptable defaults except where it names a load-bearing invariant, authority boundary, consent rule, or safety gate. Optimize for a correct, verified, readable outcome. If a default would make the work worse, deviate deliberately and explain why.

Scale the workflow to the task. Handle a trivial edit directly. For substantial features, audits, migrations, or broad refactors, use an explicit explore → plan → implement → verify flow, parallelize genuinely independent work, and keep the primary agent responsible for decisions and integration. Adversarially verify non-trivial work against live files and artifacts.

Continue through an accepted multi-step plan without artificial checkpoints. Stop only for a genuine blocker, an explicit stop, missing authority, or a material product choice that cannot be inferred safely.

**Never manage context yourself — auto-compaction handles it. In a loop, just keep pushing progress.** Do NOT stop, checkpoint, hand off "for fresh context", or ask "should I keep going / do you want to check first" because the conversation is getting long. The harness auto-summarizes when needed and work continues seamlessly, so context length is never a reason to pause, wrap up, or offer the user a checkpoint. When one increment ships (gates green + commit + push + docs), immediately start the next one in the same turn. Only ever stop for (a) a genuine blocker, (b) a real user decision that changes direction, or (c) the user explicitly saying stop. Reporting shipped milestones is fine; turning that report into a "want me to continue?" gate is not. This rule was reinforced 2026-07-05 after the user objected — again — to a mid-marathon "want me to keep rolling or check first?" offer.

Preserve unrelated user changes. Inspect the worktree before editing and keep the diff scoped.

## Canonical procedures

Read `docs/design/spec.md` at session start, and each of these before changing the relevant system:

- `docs/design/spec.md` — product intent, non-goals, architecture, trust boundaries, contracts, and delivery gates.
- `docs/design/learning-system.md` — maker, knowledge, evaluation, feedback, and engineering-improvement loops.
- `docs/skills/brick-assembly-loop.md` — canonical operating procedure for generation, rendered-result inspection, repair, learning, and app or harness improvement.

When they overlap, `spec.md` owns product, domain, trust, and authority contracts; `learning-system.md` owns experiment, lifecycle, feedback, evaluation, and promotion contracts; `brick-assembly-loop.md` is the subordinate operating procedure and may not weaken either design document.

Before building recursive-loop machinery, read `../loop-ops/docs/skills/building-recursive-loop.md`. Before running an existing recursive pass, read `../loop-ops/docs/skills/recursive-playtest.md` and `../loop-ops/DIRECTIVES.md`.

For co-evolution work, also read `../3d-maker/AGENTS.md` and `../3d-maker/docs/design/spec.md`. Do not modify a sibling repository unless the task explicitly scopes it, and do not transfer its domain invariants into this repository.

`CLAUDE.md` is a pointer to this file. Keep policy here rather than duplicating it across agent-specific files.

## Project intent and scope

This repository is an AI-native digital brick modeling studio with three coordinated surfaces:

1. A precise manual brick editor.
2. An AI copilot that generates complete models or scoped, previewable subassembly patches.
3. A replayable laboratory that improves templates, techniques, the harness, and the application under protected evaluation and human authority.

The repository now has an initial Gate 0/1 TypeScript workspace with protocol, catalog, brick-kernel, rendering, and browser packages. Provider-backed generation, the companion trust broker, production candidate acceptance, retained native run bundles, and the recursive engineering runner remain unimplemented. Do not claim that a documented feature, command, validator, provider, broker, or harness exists until live files and executable behavior prove it.

The first product is not a BrickLink Studio clone, a general mesh editor, a complete official-parts catalog, or a guarantee of physical stability, clutch strength, or instruction accessibility. It does not merge with `3d-maker` merely because both render 3D objects.

## Load-bearing invariants

- The versioned `BrickDocument` part-and-connection graph is the authoring source of truth. Part transforms are authoritative; connection edges are validated semantic annotations. Three.js scenes, meshes, renders, overlays, LDraw, GLB, screenshots, and provider responses are derived artifacts.
- Deterministic compilation is the central contract: identical canonical base bytes and normalized build-program bytes under the same compiler, schema, catalog, template, transform, connector, collision, and validator snapshots produce the same structural hash and validation report.
- Saved documents pin their truth snapshots. Schema or truth changes require an explicit versioned migration and report; never silently reinterpret an old document.
- Manual editing may temporarily create a draft-invalid document. An applied AI patch must be scope-valid, must not add a blocking failure outside its scope, and must preserve global validity when the base was globally valid.
- Provider, critic, generated-template, lesson, and repair output is untrusted data. It cannot declare itself valid, author trusted scope or provenance, execute code, waive a hard validator, or directly mutate the user document.
- Hard structural validity dominates visual resemblance. Pixels cannot prove graph correctness, and graph correctness cannot prove that the model satisfies the brief. Inspect both.
- Every model-assisted repair or replan creates an immutable child candidate. Do not overwrite parents or erase counterevidence.
- User documents change only through explicit manual commands or previewed acceptance. AI never silently accepts a patch, promotes knowledge, merges code, deploys, changes secrets, or weakens its evaluator.
- A physical claim applies only to the exact document and catalog hash actually tested. Structural edits invalidate it.

## Architecture and authority boundaries

- Keep domain, build-program, canonicalization, migration, and deterministic validation code independent of the DOM, React, Three.js scene objects, provider SDKs, and persistence adapters.
- Treat the Three.js scene graph as a disposable view derived from canonical state. Rebuild it safely after context loss and dispose geometries, materials, textures, render targets, controls, and listeners deliberately.
- Keep React responsible for application UI and state orchestration, not ownership of mutable Three.js truth.
- The released companion trust broker owns production signing, credential proxying, authoritative events, and artifact sealing. It verifies and enforces a user-originated, scope-bounded, one-use acceptance capability and records the sealed event; neither broker nor harness may originate acceptance, consent, or broader scope.
- The broker never loads or launches challenger code. Production and test identities, keys, credentials, ledgers, and namespaces remain distinct. The independent evaluator accepts only expected-namespace broker or evaluator seals; challenger execution has no arbitrary filesystem access or direct network egress, and only bounded schema-checked aggregate output leaves the evaluator boundary.
- The browser remains a useful offline manual editor. Model-provider generation, recorded AI candidates, and AI-patch acceptance require the broker boundary defined by the specification.
- Isolate candidate and provider failures. One malformed response, invalid candidate, failed render, or exhausted strategy must not corrupt the document or crash the editor.
- `lego` owns brick semantics. `3d-maker` owns genome-to-mesh semantics. Share only proven generic experiment, lineage, artifact, comparison, or evaluation interfaces after both implementations demonstrate the same need.

## Change workflow

- Read the affected path and trace data flow before editing. Prefer the smallest coherent change that satisfies the real contract.
- Use test-driven development for behavior: write or update the failing contract test first, then implement. Test externally meaningful behavior rather than incidental implementation structure.
- Use property, fuzz, and golden tests for canonical serialization, migrations, compiler determinism, legal transforms, connectors, collisions, scope enforcement, replay, LDraw round trips, and malformed provider data.
- Reproduce failures from the exact sealed run when available and consent permits. Check the current `effectiveReplayLevel` first and replay only from its allowed boundary; a historical `sealedReplayLevel` does not restore deleted bytes. Inspect the brief, base document, build program, snapshots, validation report, lineage, render packet, and event sequence before inventing a synthetic reproduction. Do not forward sensitive run contents to an external model, reviewer, provider, or log without the separately required consent.
- Make async states, ordering, cancellation, retries, idempotency, persistence, cleanup, and terminal outcomes explicit. Never let a late job win against newer user state.
- Keep files and functions focused. Split when responsibilities diverge; do not create speculative shared abstractions before real duplication proves them.
- Keep tunable values in schemas, catalogs, policies, or named constants rather than scattering magic numbers through compiler or renderer code.
- Update durable design or procedure documents in the same task when architecture, authority, schemas, migrations, validation, replay, public automation hooks, or delivery gates change. Canonical documents must state only the current normative rule; update or remove superseded operational text and leave history to Git until an explicit non-normative decision record exists. If such a record is later created, preserve decisions by adding superseding entries rather than rewriting history.
- Gate 0 begins with a dependency and data bill of materials. Record the source, version, license, attribution, redistribution and training rights, and allowed runtime or evaluation role for every code, geometry, connector, collision, weight, model, and example source. Preserve file-level LDraw provenance. Permission to reuse geometry does not imply permission to train on models that use it.

## Commands and completion gates

The authoritative workspace commands are:

- `npm run dev` — serve the browser studio on the pinned local development origin.
- `npm run schema:check` — prove generated protocol types and standalone validators match the authoritative schema.
- `npm run node:check` — exercise protocol, catalog, and brick-kernel imports in the supported Node 24 source-first runtime.
- `npm run bom:check` — reconcile workspace manifests, exact pins, lockfile metadata, and the dependency/data bill of materials.
- `npm run notices:check` — prove `THIRD_PARTY_NOTICES.md` matches the locked third-party graph.
- `npm run test:browser` — drive persistence and interaction contracts in a real browser with an in-process disposable Vite server.
- `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm test`, and `npm run build` — individual source, behavior, and production-bundle gates; the build fails if development automation globals survive tree-shaking.
- `npm run verify` — run the complete implemented gate set in the required order.

`npm run playtest:recursive` does not exist yet. Add it only with the recorded-input runner, immutable evidence, finding lifecycle, replay verification, ledger behavior, and acceptance drill required by `../loop-ops/docs/skills/building-recursive-loop.md`; never add a placeholder command that merely exits successfully.

For documentation-only work, at minimum verify the diff, internal paths and links, Markdown fences, and trailing whitespace. When Gate 0 or Gate 1 introduces executable packages, add their real commands here in the same change and make those scripts authoritative.

Run the smallest relevant checks while iterating, then the complete applicable gate set before declaring implementation complete. A unit-only pass is insufficient for changes that cross persistence, broker, provider, browser, import/export, or rendering boundaries.

## Render and interaction verification

For any ordinary UI change, drive and inspect the affected surface in the actual served browser application. For a model, renderer, camera, overlay, selection, scope, or 3D interaction change:

1. Drive the actual served application in a real browser.
2. Capture the canonical isometric and orthographic model views plus relevant overlays.
3. Inspect `window.render_app_to_text()`, `window.capture_model_views()`, `window.get_model_snapshot()`, `window.advanceTime(ms)`, validator output, errors, selection, scope, and candidate lineage.
4. Compare before and after pixels when the change is visual, using tolerances appropriate to the renderer.
5. Confirm that pixels, structured state, and intended behavior agree; fix and repeat.

The development browser automation bridge is implemented in `apps/web/src/automation.ts` and tested at the contract level. Do not approve a visual feature from source inspection or hook presence alone, and do not approve structural behavior from a pleasing screenshot alone. Test the served app, resize, WebGL context loss, repeated candidate disposal, and renderer-memory stability when relevant. Production builds must still omit the bridge or require the authenticated non-production namespace specified above before they can handle real user documents.

Import/export work must exercise the actual supported consumer or viewer path. A string round trip alone does not prove that an exported model loads, renders, or preserves the supported canonical edge set.

## Learning and recursive improvement

The engineering loop is:

`run → evidence → finding → verify → select → fix → rerun → prove → ledger`

- Every finding is born unverified. Structural, scope and replay claims require mechanical replay or addressed deterministic evidence. Visual, accessibility, specification or human-preference claims may use the corresponding independent method and an addressed sealed evidence bundle, but can never certify structural truth. Source, documentation, architecture, schema and security findings may use reproducible content-hashed live-file evidence, static or type checks, schema proofs, or threat-model evidence appropriate to the claim.
- The broker-sealed native run is authoritative. Only the broker allocates authoritative run, attempt and event-sequence IDs or seals native evidence; the harness submits records and artifacts under those IDs. A `civ-engine`-compatible run or finding projection, or a `loop-ops`-compatible pass record, is rebuildable derived data that references explicit native run IDs and immutable artifacts through the LEGO-owned projection envelope. Do not add the full game engine as a dependency of brick-domain, browser, broker, or evaluator packages merely to reuse its contracts.
- Project only durable tracking-worthy failures, not every invalid candidate. A first critical scope, security, data-loss or replay failure is eligible immediately; recurrence is a ranking and promotion signal, not an admission requirement. Give each projected finding an explicit stable `data.class`; a finding signature groups failure classes and a state digest compares sanitized checkpoints, but neither signs, seals, or identifies a `BrickDocument`.
- When implementation was authorized and a verified fix candidate was selected, a recursive pass is not complete at `proposal-only`. Use the fleet vocabulary verbatim: `fixed-proven`, `fix-unproven`, or `blocked`. Preserve runner stop reasons such as `no-fix-candidate` or `run-failed` without inventing LEGO-only synonyms. Diagnosis-only requests remain read-only.
- Prove a fix with non-vacuous replay of an explicit retained run plus a fresh independent oracle sweep, comparing at stable failure-class granularity rather than reading the diff or matching run-specific finding IDs. A replay that checks no required checkpoint, skips a required hard validator, or relies on `latest.*` or modification-time discovery cannot prove anything.
- Run an authorized fix in a disposable exact-base worktree with one selected finding, bounded patch capability, and a reserved proof budget. Never clean, reset, switch, or otherwise mutate the user's active checkout; never auto-push, merge, deploy, or change the production evaluator or broker.
- Full mode starts only after separate non-borrowable attempt and proof-budget capabilities exist. Only an evaluator-owned or released verifier may sign `fixed-proven`; the harness cannot grade itself, and missing affected-canary or verifier evidence prevents promotion.
- A model-facing browser actor receives only a hashed `ActorObservation` and a bounded capability API, never arbitrary evaluation or verifier hooks. A maker receives only a hashed, consent-authorized and scope-filtered `MakerObservation`, never the local brief, locked-region details or unapproved references directly. Visible and enabled controls are not authorization: production actors cannot accept patches, grant consent, transmit or delete user data, change policy, promote, merge or deploy. Rich structured state belongs to trusted `VerifierEvidence`; case-level holdout evidence remains evaluator-local, and acceptance-path automation uses synthetic fixtures and an isolated test broker.
- Promote confirmed failures into regression tests or fixtures. A fix without a way to catch recurrence is incomplete.
- Quarantine prompt, retrieval, template, technique, repair, ranking, and stopping challengers until protected benchmarks and the independent evaluator support promotion. Never let a challenger change the contract that grades it.
- Changes to `docs/skills/brick-assembly-loop.md` are cross-agent contract changes. State the failure or missing behavior motivating the edit and forward-test the revised procedure on a realistic scenario. Verify README and repo pointers, and verify installed global pointer skills when the current environment exposes them and the task authorizes global changes.
- Product run artifacts belong under `var/runs/`; local broker databases, indexes, CAS data, and development state belong under `var/state/`; fleet recursive-pass artifacts belong under `output/`. Configure browser and reviewer raw captures under those ignored roots. Keep raw runs, provider responses, screenshots, and temporary reviewer logs out of Git.
- Committed fixtures and benchmark evidence are synthetic, repo-owned, or public by default. A real user or provider artifact requires separate inspectable consent for Git or benchmark use, provider and license clearance, minimization and redaction, and secret and personal-data scanning. Consent to generate is not consent to retain, train, benchmark, share, or commit.

When a non-obvious lesson deserves preservation, anchor it to the run or manifest hash, originating finding or review, fix commit when available, exact regression test or benchmark, and measurable behavior delta. Without evidence anchors, a lesson is folklore rather than accumulated learning.

## Review and security

- Self-review trivial prose or formatting. Use independent adversarial review for non-trivial behavior. Add specialized independent security or multi-model review for trust-broker, evaluator, provider, consent, signing, persistence, scoped-patch, migration, recursive-loop, or data-loss changes. Multi-CLI mechanics — current reviewer model pins, exact commands, sandbox flags, output extraction, and CLI failure modes — live in `.claude/skills/multi-cli-review/SKILL.md`; read it before every multi-CLI session and bump review pins there first.
- Reviewers must read the live files and artifacts. Every review prompt must include the directive: *"Verify each claim in the plan/diff against the live codebase — grep for the symbols, function signatures, column names, and file paths it references; do not approve based on prompt text alone."* Independently verify each claim before changing code. Convergence is the absence of substantive findings, not the number of approval votes — a HIGH defect from one reviewer outweighs APPROVED from two.
- Aspects to review: (1) design — easily scales, generalizes, debugs, can be understood and reasoned about, stays lean; (2) test coverage; (3) correctness; (4) clean code — typing, efficiency, memory leaks, duplicated logic, inconsistent implementations, boundary violations. Keep files under 500 LOC (hard ceiling 1000), prefer composition over inheritance, clean up dead code, and do not change behavior beyond what the task asks.
- Enrich the baseline review prompt (quoted in the runbook skill) with task-specific context — the change's intent, prior-iteration findings to verify, files to focus on, and an anti-regression checklist. The bare baseline returns generic feedback; useful reviews need the specifics.
- Keep reviewer model IDs current. Use the latest-family alias when a command should track the newest model; bump pinned strings whenever a more capable fixed variant ships, and verify with a one-line smoke test before committing the bump — silent fallback to an older model is the failure mode to guard against. Review-command pins live in the runbook skill.
- For trust-boundary changes, produce a repository-grounded threat model covering assets, trust edges, attacker capabilities, abuse paths, impact, and mapped mitigations. For implementation and review, apply stack-appropriate secure defaults and evidence-backed checks. The `security-threat-model` and `security-best-practices` skills are preferred implementations when available, not cross-agent prerequisites.
- Keep credentials, tokens, signing keys, private endpoints, and session material outside source, browser bundles, run artifacts, prompts, and logs. Mock provider/network calls in ordinary tests. Require explicit authorization for live calls.
- User references and designs are local by default. External-provider transmission, knowledge or benchmark inclusion, training, sharing, and Git retention are separate consent decisions. Runtime provider discovery may narrow the maintainer-reviewed `ProviderCapabilities` policy but never broaden its data use, locality, retention, or training permissions.
- Treat file imports, archives, images, LDraw, JSON, HTML text, provider output, and loopback requests as hostile inputs. Bound bytes, depth, dimensions, expansion, recursion, operation counts, part counts, time, render memory, paths, origins, and output schemas.
- Before any authorized commit, inspect the staged diff and newly tracked files for secrets and accidental raw artifacts. If credentials may be exposed, stop further disclosure, report the credential and every known location, and treat it as compromised. Rotate or revoke it only when explicitly authorized; otherwise give the owner the exact required containment and rotation steps. Deleting a line later is not sufficient.
- When dependencies change, update the selected lockfile, run both runtime-only and full dependency audits supported by the package manager, and block new HIGH or CRITICAL findings unless the user accepts a documented, expiring exception.

## Git and documentation hygiene

- Preserve unrelated changes and never discard user work. Stage only a coherent requested unit.
- Commit directly to `main`: this is a solo-developer repository, so land each coherent, self-contained unit of change as its own commit once the applicable gate set passes, and push at the end of every task — do not leave the remote behind.
- Branch, merge, release, rewrite history, or modify sibling repositories only when the task authorizes that action; branches are reserved for explicit experimentation meant to stay isolated from `main`. This autonomy does not weaken the safety gates: the recursive-loop harness still never auto-pushes, auto-merges, or deploys, and AI patch acceptance still requires previewed user consent.
- Keep canonical policy in this file; keep `CLAUDE.md` as a pointer.
- Keep the README and the three canonical documents above aligned with implemented reality. Do not create heavyweight changelog, devlog, architecture, or progress trees until the repository has enough implementation and recurring work to justify them.
- Temporary evidence belongs in ignored run directories. Committed documentation should be durable, concise, and useful to a future agent.
