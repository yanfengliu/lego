# Brick assembly loop — canonical skill procedure

This is the version-controlled procedure for building, operating, and improving the AI-native brick modeling system in this repository. The global `brick-assembly-loop` skill is only a pointer to this file.

## Required reading

Before acting:

1. Read [the product and architecture specification](../design/spec.md).
2. Read [the learning harness and controlled improvement design](../design/learning-system.md).
3. Inspect the current repository state, implementation commands, and local agent guidance. Do not assume the design draft has already been implemented.
4. For engineering-loop onboarding, read the global `building-recursive-loop` skill and its canonical `loop-ops` build recipe.
5. For an existing engineering improvement pass, read the global `recursive-playtest` skill and the current `loop-ops/DIRECTIVES.md` before running it.
6. For broker, provider, evaluator, consent, signing, or artifact-boundary work, use `security-threat-model` before design changes and `security-best-practices` during implementation or review.
7. For browser interaction and canonical render QA, use the installed Playwright skill after the app has an executable surface.
8. For co-evolution work, read `3d-maker/AGENTS.md` and its approved specification. Do not infer its genome-to-mesh rules from this repository.

## Route the task

| Request | Primary procedure |
| --- | --- |
| Build or edit the application | Follow the delivery gates and preserve the canonical brick graph boundary. |
| Generate a model or subassembly | Run the maker loop below. |
| Diagnose a bad generated model | Inspect pixels and structured assembly evidence together. |
| Improve a prompt, template, technique, repair, or ranker | Create a quarantined challenger and use the knowledge promotion path. |
| Improve code, UI, validators, the harness, or the broker | Use the engineering loop and the fleet recursive-loop contract. |
| Share behavior with `3d-maker` | Share experiment protocol only after duplicate implementations prove the abstraction. |

## Run the maker loop

1. **Capture authority and truth.** Normalize the brief, reference assets, base revision, scope capability, required ports, frozen parts, catalog and validator snapshots, consent, and hard budgets.
2. **Plan hierarchically.** Identify semantic components, approximate volumes, typed interfaces, an attachment graph, candidate templates, and a coarse build order. Do not begin with a flat list of coordinates.
3. **Generate restricted data.** Produce an `UntrustedCandidateProgram` or deterministic template/search result. Never emit executable code or a self-declared valid patch.
4. **Compile and hard-validate.** Let only released trusted code compile an `AssemblyPatch`. Reject unknown parts, illegal transforms, incompatible or occupied ports, disconnection, collisions, scope violations, or budget violations.
5. **Render canonical evidence.** Capture the fixed isometric and orthographic views, silhouette, depth, connection/collision overlays, structural snapshot, patch diff, issue list, lineage, costs, and version hashes.
6. **Critique with typed evidence.** Compare every critique to named views, parts, ports, requirements, or metrics. A visual critic may advise but cannot waive a hard validator.
7. **Repair by creating children.** Prefer deterministic localized repairs. Every model-assisted repair or replan creates an immutable child candidate. Detect duplicate hashes, lineage cycles, oscillation, and exhausted budgets.
8. **Rank only hard-valid candidates.** Preserve useful diversity before soft ranking. A hard-invalid result may be shown diagnostically but never ranked as applicable or inserted into the document.
9. **Preview rather than mutate.** Show additions, removals, changes, advisory issues, provenance, and comparison views. AI acceptance requires the broker-sealed presented envelope and one-use authorization defined by the specification.
10. **Record the outcome honestly.** Keep selection, acceptance, finalization, correction, rejection, and physical verification distinct. Learn only under the recorded consent and exact document/catalog hashes.

## Inspect a rendered result

Use both surfaces:

- **Pixels:** canonical multi-view packet, silhouette, depth, camera framing, composition, recognizable features, color blocking, and diagnostic overlays.
- **State:** `render_app_to_text()`, document structural hash, part and connection graph, selected scope, validator issues, patch operations, candidate lineage, active budgets, errors, and provenance.

Never conclude that a model is correct from a screenshot alone. Never conclude that it satisfies the brief from structural validity alone. Turn each observed problem into a typed, reproducible finding with the smallest plausible change class.

## Improve technique and knowledge

1. Cluster repeated failures by stable class.
2. Form a falsifiable, scoped hypothesis.
3. Choose the smallest challenger: prompt, retrieval rule, declarative template, technique configuration, repair, ranker, or stopping rule.
4. Pin the champion, truth snapshots, budgets, cases, cameras, metrics, and promotion policy before execution.
5. Run paired dev and regression cases; use the independent evaluator for masked holdout evidence.
6. Promote only with hard-validity non-regression, declared metric evidence, human authority, compare-and-swap, and a verified rollback path.
7. Preserve counterexamples and rejected challengers. Never overwrite a stable item.

Generated templates, lessons, predicates, and operation patterns remain schema-validated declarative data interpreted under depth, part, operation, memory, time, and cost budgets. They cannot contain JavaScript, Python, callbacks, imports, dynamic expressions, or evaluation hooks.

## Improve the app or harness

Use the fleet engineering contract:

`run → evidence → finding → verify → select → fix → rerun → prove → ledger`

- Use `building-recursive-loop` when the repo lacks the deterministic drive/evidence/pass machinery.
- Use `recursive-playtest` when that machinery exists.
- Keep product run artifacts in `var/runs/` and engineering recursive-pass artifacts in `output/`; neither belongs in Git.
- Before any fallible engineering-pass preflight, ask the broker to allocate the pass ID and commit an idempotent `PassOpened` event. If admission itself cannot be persisted, no pass exists: return a typed admission error and emit neither terminal record nor projection.
- Treat the broker-sealed native run as authority. Once the compatibility adapter exists, emit a rebuildable LEGO-wrapped `civ-engine`-compatible run and finding projection that references the native run and immutable artifact hashes; use the separate `loop-ops` pass contract for pass records. Validate the LEGO wrapper and source seal before the nested civ shapes, and do not make brick-domain, browser, broker, or evaluator packages depend on the full game engine.
- Project only durable tracking-worthy product, technique, template, provider, replay, observation, harness, security, data-loss, or UX failures. A routinely invalid candidate remains a native validator result unless it exposes a durable systemic failure; a first critical failure is eligible immediately and does not wait for recurrence.
- Start every projected finding as `unverified` and give it an explicit stable `data.class`. Structural, scope and replay claims require addressed deterministic native evidence. Independent screenshot, accessibility, specification or human methods may verify only their corresponding claim, never structural truth. Static findings use real content-hashed engineering evidence rather than fabricated product runs. Fleet finding signatures and state digests are grouping and comparison aids, never security, identity, document-hash, or seal contracts.
- Let only the broker-owned native run store allocate authoritative run, attempt and sequence IDs or seal native pass artifacts. Before each actor or provider call, the unprivileged harness asks the broker to commit an attempt-start event, then submits a typed terminal event for the broker to commit. Preserve a rejected proposed decision separately from the absent executed action for stale observations, capability rejection or unavailable controls, and prove no mutation with unchanged document hashes and no command transaction. Never discover a run by modification time or let historical records point at mutable `latest.*` artifacts.
- Show a browser playtest agent only a hashed, settled `ActorObservation` containing the rendered surface and controls permitted for that run. Every action cites the observation and control IDs and is rejected when stale, no longer offered or outside capability. Visibility and enabled state never authorize acceptance, consent, user-data transmission, deletion, policy, promotion, merge or deployment. Acceptance-path tests use synthetic documents and an isolated fixture-user namespace.
- Give a maker agent only a content-hashed `MakerObservation`: a consent-authorized, minimized projection of the brief, mutable scope, read-only boundary context, exposed connectors, model and validator summaries, render evidence, references, approved knowledge and budgets. Never leak locked-region or unrelated document details. Keep full debug state and automation hooks in `VerifierEvidence` behind trusted capture boundaries; case-level holdout truth remains evaluator-local and only its signed aggregate report may leave.
- Reproduce the issue and add a failing test or benchmark before the fix. Replay proof must be non-vacuous: check at least one required checkpoint, skip no required hard validator, and fail closed on any replay mismatch.
- Select one verified finding per full pass and grant separate non-borrowable attempt and proof-budget capabilities before starting. If proof cannot be reserved, do not start full mode. Change one coherent factor in a disposable exact-base worktree; never clean, reset, switch, or otherwise mutate the user's active checkout.
- Inspect browser behavior, canonical model views, structured state, accessibility, cost, latency, and resource cleanup where relevant. Rerun the exact retained case and a fresh independent oracle sweep.
- Prove the fix only when an evaluator-owned or released verifier signs a `PassVerdict`, the stable failure class is absent, affected sensor canaries pass, and preregistered non-regression checks still pass. The harness cannot grade itself. Diff inspection, a run-specific finding ID, an empty rerun, or `proposal-only` is not proof.
- Finalize only after cleanup, contained-retention or rollback results exist. The broker then appends one idempotent `PassTerminalRecord` with the exact mode, stage, stop reason, outcome and optional verifier-verdict hash; it may account for `blocked` or `fix-unproven` when no verifier ran but can never manufacture `fixed-proven`. Do not project or promote an uncommitted terminal record.
- Quarantine a confirmed failure's regression draft until its provenance, champion failure, challenger success, exact identity, and signed maintainer or independent benchmark-owner approval are recorded. The challenger cannot author and approve the same regression. Never auto-push, merge, deploy, or promote a challenger.

`civ-engine`, `aoe2`, `farm`, `city`, and `townscaper` provide the fleet contract and adapter philosophy, not LEGO domain code. Borrow their evidence lifecycle, bounded action surfaces, transcripts, replay discipline, canaries, and pass outcomes; keep game ticks, simulations, content heuristics, and destructive checkout automation out of this repository.

The unprivileged harness may propose changes but cannot access production credentials or signing keys, write the authoritative ledger, alter the evaluator, self-approve, merge, deploy, or change release policy. Changes to the companion trust broker require explicit maintainer approval and security review.

## Reuse and co-evolution boundaries

- Treat LDraw and BrickLink Studio as interoperability targets, not application source code or canonical storage.
- Keep `lego`'s part-and-connection graph and `3d-maker`'s genome-to-mesh model separate.
- Share only generic experiment envelopes, lineage, artifact-store interfaces, candidate galleries, and visual-evaluation orchestration after both repos have independently exercised the same behavior.
- Do not share generators, domain documents, validators, catalogs, databases, or renderer scene graphs.

## Build in this order

1. Provenance, schemas, threat model, and broker/worker boundary.
2. Deterministic 8–20-part assembly kernel, manual editor, validators, canonical renders, and exact supported LDraw subset.
3. Model-agnostic 10–40-part harness with templates, search, repair, replay, benchmarks, and rollback.
4. One text-to-small-model provider behind the broker contract.
5. Scoped copilot generation through exposed ports and frozen regions.
6. Reference-image workflows, richer parts, calibrated physical evidence, and later co-evolution.

Do not move model integration ahead of deterministic truth, observable renders, replayable evidence, and protected evaluation.

## Completion check

Before reporting completion, state:

- What canonical graph, truth snapshots, scope, and budgets were used.
- Which hard validators passed or failed.
- Which render views and structured evidence were inspected.
- What changed from parent to child and why.
- Whether the result is diagnostic, patch-valid, globally valid, accepted, finalized, or physically verified.
- What was replayed, what is retained, and the current effective replay level.
- What regression or benchmark proves any claimed app, harness, or technique improvement.
