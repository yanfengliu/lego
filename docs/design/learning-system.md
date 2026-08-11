# Booklet-run evidence, replay, and promotion

Status date: 2026-08-10

[`spec.md`](spec.md) owns product, domain, consent, trust, and authority contracts. This document owns the evidence around a booklet run: retention, lifecycle, replay, evaluation, and the conditions under which a finding may become repository knowledge. [`building-system.md`](building-system.md) owns current measured progress, and the [devlog](../devlog/summary.md) owns history.

## Implementation status

| Capability | Status | Boundary |
| --- | --- | --- |
| Per-step booklet reports and incomplete-prefix retention | Implemented in the opt-in local driver | Completed rows and the refusal survive an unfinished run; output is ignored, unauthenticated diagnostic evidence. |
| Content-addressed artifacts and test recorder | Implemented in `apps/companion` | Library and test namespace only; no production service or seal. |
| Test run ledger and lifecycle policy | Implemented | Hash-chained test events and transition checks exist; production identity, signing, and authoritative storage do not. |
| Closure manifest and replay-level derivation | Implemented for retained local bytes | The verifier can inspect closure integrity and reproduce downstream summaries from retained outputs. |
| Executable replay | Unbuilt | The current replay path deliberately refuses re-execution. |
| Production-sealed replay and tombstone lineage | Specified, unbuilt | Requires the released broker, signing identity, authenticated deletion events, and an independent verifier. |
| Candidate lineage and backtracking primitives | Implemented as libraries and tests | The real-booklet driver does not yet build its search from that lineage. |
| Model-call transcript schemas | Implemented protocol | No broker-backed product producer exists. |
| Local part and panel proposers | Implemented as derivation scripts | They invoke a pinned CLI model outside the product for cropped part cards or one printed panel and write ignored local evidence; neither is wired into the studio or real-booklet driver. |
| Blind pair-judgement evidence | Implemented as retained input and consumer | It is not an integrated live checker call. Current panel verification is deterministic pixel scoring. |
| Transition classification | Implemented as prepared local input | The current classifier is raster-blind, so its label is not a visual witness. |
| Independent evaluator and automatic promotion | Specified, unbuilt | No process may grant itself authority by satisfying a local score. |

## Unit of work

A booklet run reads prepared printed steps, compiles each step against one settled `BrickDocument` prefix, enumerates candidate placements, and compares a render with a printed panel at that panel's fitted camera and face.

A printed step is the unit of evidence. The implemented local row records the fields listed under [Implemented local bundle](#implemented-local-bundle) and links image filenames whose bytes are hashed by a separate artifact manifest; the stronger per-step bindings described under [Target evidence contract](#target-evidence-contract) do not exist yet.

The comparison is closed: does this exact render agree with this exact printed art under the registered measurement? A model or human may help establish an input claim, but neither may declare structural validity or bypass deterministic compilation, collision, connection, scope, or accounting checks.

## Visual observation envelope

The target evidence packet for a placement made at step N includes panel N, panel N+1 as the minimum later witness, and the first farther panel that actually reveals the placement when N+1 occludes it or remains ambiguous. N+1 is a floor, not a guarantee, and looking ahead stops only at a revealing witness or a named evidence limit.

Every visual claim is scoped to the exact source crop, render, camera, face, registration, mask, and view in which it is visible. A hidden internal surface, an occluded connection, or any feature absent from all retained views is recorded as `not-observable`; unseen pixels cannot certify it. Part admission separately inspects matched top, bottom, front, back, left, right, isometric, and underside-oblique views because a booklet sequence may never expose every surface.

Printed step 4 is the concrete failure that sets this rule: its underside panel visibly shows hollow clutch rings, ribs, walls, and cavities, while the former candidate render showed an almost solid slab. Catalog `/12` corrects the four implicated visible surfaces with exact LDraw meshes, but preserved conservative collision remains outside what that image can prove and the old step verdict must be rerun rather than inherited.

The current real-booklet runner does not satisfy that target packet. It invokes one-panel deferral only when own-panel scoring is unavailable or cannot separate the top two candidates, then tests the first later panel and stops; it does not scan for the first revealing farther witness or record `not-observable`. Its transition classifier is raster-blind, its retained vision inputs are not an integrated checker, and its linear search does not backtrack; those limits travel with every local verdict.

## Authority boundaries

| Actor or loop | May change | May not change |
| --- | --- | --- |
| Booklet driver | Its local candidate set, settled diagnostic prefix, and ignored run artifacts within declared budgets | A user document, catalog truth, validators, scoring policy, consent, or application code |
| Curator or developer | Quarantined tests, fixtures, thresholds, templates, and code changes through the repository workflow | Protected evaluation inputs, production identity, another actor's consent, or its own proof standard |
| Test companion | Test-namespace artifacts and ledger events | A production seal, accepted namespace, user authorization, credential, or physical claim |
| Future independent evaluator | A report under a predeclared policy | The challenger, benchmark definition, consent record, or protected holdout it evaluates |
| Human maintainer | Reviewed repository and product-policy decisions | Retroactive alteration of immutable evidence |

An experiment may change the system under test or the evaluation contract, never both in one result. Otherwise a weaker validator, easier benchmark, shifted camera, or tuned threshold can masquerade as improvement.

## Evidence contract

### Implemented local bundle

The current run binds input digests for its booklet, prepared panels and callouts, action ledger, transition classifications, identification inputs, run options, application source/build closure, runtime environment, and any model-derived input that the real-build run actually consumes and lists in its contract. The separate panel-placement readings are not consumed or bound by that run. Binding a transition-classification file does not make its raster-blind labels visual evidence. The input chain is regenerated deliberately and in dependency order; the [real-build runbook](../runbooks/real-build.md) owns the commands.

The current result records local unauthenticated authority, status, requested and expected step counts, assembled target, input and completion failures, retained step rows, optional final document and structural hash, final part count, and elapsed time.

Each retained step row records its step and page, action and action-evidence digest, expected/attempted/placed counts, outcome, prerequisite facts, validation target/truth/validator hashes when validation ran, fit and camera facts, highlights and arrows, per-piece search and score data, whole-step/deferral/exploded evidence, elapsed time, and panel/build PNG filenames. The artifact manifest hashes retained files separately; the row does not carry a digest for each PNG.

An incomplete run retains every readable row that matches its prepared input and then records the refusal that stopped the prefix. Malformed envelopes may be rejected wholesale; an ordinary reproduction defect does not erase valid earlier evidence.

Current gaps are explicit. The run contract does not separately bind a catalog snapshot or complete truth bundle; a step row does not record document revisions, a before-and-after structural-hash pair, per-image digests, a complete N/N+1/first-revealing-farther observation packet, or `not-observable` claims; and `score.json` does not contain reversal depth, retained byte count, or replay level. Replay closure and artifact-size facts live in separate manifest files, and the linear driver has no reversal depth to report.

### Target evidence contract

The complete target run input binds the catalog and truth snapshots and every retained nondeterministic response in addition to the implemented closure.

The complete target step record adds document revision and structural hash before and after the step, per-row source and render digests, the bound N/N+1/first-revealing-farther observation packet with explicit `not-observable` outcomes, the step-1 face seed, rotate-icon sequence and fold, derived panel face, and candidate-lineage provenance sufficient to reproduce the decision without joining unbound filenames.

The complete target summary adds deferral and reversal totals, deepest reversal, retained byte count, replay level, termination policy, and every finding that prevents completion. These fields become current only when their schemas, producers, and verification tests exist.

Current local publication content-addresses retained artifacts and enforces the render, candidate, role-byte, and stored-byte limits declared by its participating contracts. A closure may claim only the replay level its required bytes support; broader target budgets are stated under [Operational guarantees](#operational-guarantees).

Raw evidence lives only under ignored `output/` and `var/runs/` roots. It enters Git only when review promotes a minimized, licensed, secret-scanned fixture, golden, benchmark, or contract input.

## Candidates and lineage

Every alternative is immutable. A repair, replan, or rejected placement is a child that references its parent and exact base state; it never overwrites the branch that produced counterevidence.

Structural hashes identify duplicate states, lineage identifies cycles, and metric history identifies oscillation. Backtracking walks to the shallowest ancestor with an eligible untried child and reports how many steps were undone and the maximum reversal depth.

Those rules are implemented in the generic build-tree and backtracking libraries, but the current real-booklet driver still uses a linear prefix. Until it is integrated, a retained run must not claim real-run lineage, reversal depth, or recovery merely because the library tests pass.

## Typed refusals

A refusal is a product surface and evidence. It names what happened, the exact input and observed value, the required condition, and any bounded next action the caller may take.

Hard validation dominates visual agreement. A candidate that looks right but collides, disconnects required structure, uses an illegal port, exceeds scope, or violates accounting is refused. A structurally valid candidate that the panel cannot distinguish is also refused rather than selected by a numerically meaningless lead.

Thresholds and budgets carry the measurement that set them, the metric and registration they use, their false-accept and false-refusal observations, and the population on which those counts were measured. A positive score or a passing majority-class baseline is not evidence of correctness.

## Replay

Deterministic compilation is stronger than run replay. Identical canonical base bytes, normalized program bytes, and pinned truth snapshots must produce identical compilation and validation; a run that depended on a model or missing source boundary may support only partial replay.

### Replay levels

- `full`: every required input and captured nondeterministic boundary is retained so trusted code can re-execute from the beginning. This level requires the future sealed production path and is unavailable to current local booklet runs.
- `downstream-only`: retained bytes form a complete closure from the earliest captured boundary, normally the browser output, so downstream parsing, finalization, hashing, and scoring summaries can be checked without re-running the missing upstream work.
- `metadata-only`: the record is inspectable audit metadata but lacks the bytes required for downstream execution.

The verifier derives the maximum level from the transitive content-addressed closure; callers do not choose it. Unknown roles, missing required roles, hash mismatch, unavailable bytes, consent restrictions, or an exceeded role limit lower or invalidate the claim by name.

Current local closures carry `authority: "local-diagnostic"` and `authenticated: false`. The replay reader verifies retained bytes and downstream results, then explicitly refuses executable replay. A manifest that says `downstream-only` therefore does not imply that the browser or model call can be rerun.

The target production design adds an immutable `sealedReplayLevel` and a separately derived `effectiveReplayLevel`. Consent-driven deletion would append an authenticated tombstone, remove permitted bytes and indexes, and lower the effective level without rewriting the original certificate. None of that is implemented by the current companion library.

## Test ledger lifecycle

The implemented test ledger is an append-only, hash-chained event stream with a rebuildable query view. It records schema version, sequence, previous-event hash, actor, transition, idempotency key, and referenced artifact hashes.

Run states are `created`, `queued`, `running`, `draining`, `cancelling`, `persistenceFailed`, `succeeded`, `exhausted`, `failed`, and `cancelled`. Normal completion and budget exhaustion pass through `draining`; no new work starts there.

Model-attempt states are `created`, `running`, `succeeded`, `failed`, `timedOut`, and `cancelled`. An attempt result that cannot be retained moves the enclosing run to `persistenceFailed` rather than allowing an unrecorded success.

Candidate states distinguish receipt, compilation, hard validity, diagnostic rendering and review, canonical rendering, panel comparison, ranking, presentation, archival, cancellation, processing failure, and persistence failure. A hard-invalid candidate can produce diagnosis or a child repair but can never become rankable.

The exact allowed transitions are enforced in `apps/companion`; this summary does not grant production authority. Recovery resumes only from a verified durable checkpoint, cancellation is idempotent, and late events from an older generation are diagnostic.

## Model calls as evidence

[`spec.md`](spec.md#model-calls-and-consent) owns consent, minimization, provider policy, and the untrusted-output rule.

The current model-assisted derivation paths are local scripts that send bounded part-art crops or one cropped printed-step image to a pinned CLI model to propose identification or placement relations. They are not called by the studio or real-booklet driver, do not run through a broker, and cannot mutate a document or admit a catalog part.

The current panel-placement script accepts one arbitrary resolved local input path without containment, file-type, dimension, PDF, page, or crop-bounds validation and exposes its authenticated temporary snapshot to the CLI with a fixed relation prompt and text naming the new and already-built pieces. The CLI receives no candidate render, panel N+1, first revealing farther panel, alternate view, deterministic panel-face parity, or source binding and is granted repository-wide `Read`. The ignored reading retains image, prompt, brief, and model digests; the raw result and parsed reading; model identity; timing, call, and cost metadata; and current-piece descriptors. It does not retain the input bytes or source path, exact brief or built-piece-list bytes, action-ledger digest, CLI tool trace, or an immutable attempt ID, and the fixed per-step output filename is replaced on rerun. When the mutable input path changes, the digest says that different bytes were used without making the original bytes reproducible. The prompt prefers a same-step anchor that the consumer then refuses as not yet placed, while parsed `newPieceOutlines` and `confidence` fields have no consumer; these are proposal-schema gaps, not evidence that narrowing is correct. That record is proposal evidence only, not a replayable visual observation packet.

For this booklet the panel face is already deterministic evidence: the detector finds 43 rotate icons across all 359 printed steps, while the independently reviewed 43-panel prefix contains eight icon-bearing steps whose fold from the explicit step-1 `studs-up` seed reproduces all 43 reviewed face states, including five underside panels. When present, the model's `viewpoint` field may agree, decline, or make the entire reading refuse; it cannot override that parity record or establish absolute face from the projected lattice. A missing panel line currently parses as `panel: null` and still permits piece predicates to narrow without a face refusal, which is another reason the reading is not a safety gate.

The tracked schema-2 blind-pair input keys each verdict by a 16-hex-character prefix of the SHA-256 digest of the judged callout crop plus the claimed element identifier, and the consumer binds the truth file as an input. It does not retain or bind the complete comparison image, exact prompt, raw model responses or model parameters, so it is durable label evidence rather than a complete replay of the judging calls. The consumer does not make a live checker call, and a narrowing result can discard the settled truth while every retained candidate remains safe. Panel placement is decided by deterministic image measurements and structural validators; candidate safety is not visual correctness.

Protocol types for provider capabilities, actor observations, attempt transcripts, and retained responses exist and have contract tests. They have no integrated product producer or broker enforcement path today, so docs and UI must not describe their presence as an operating model service.

Any future external call records purpose, provider, pinned model identity, parameters, seed where supported, bounded input digest, raw response hash, timing, cost, terminal status, consent and provider-policy digests, and the exact boundary from which replay can resume. A response that cannot prove the pinned identity or be durably captured is refused.

## Evaluation

### Measurable intermediates

A booklet supplies its own early checks: steps run 1 through N without gaps, action and callout counts reconcile, type size distinguishes quantity from repeat multiplier, placed pieces reconcile with inventory, and candidate renders can be compared per step rather than by final hash equality.

Every claimed improvement names the number it should move and retains the image or structured evidence that makes the number meaningful. A fixture that derives its expected answer from the same path under test, or an accuracy figure without its majority baseline, is not an independent check.

### Metrics

Hard metrics are compilation, schema and catalog compatibility, connector and collision validity, required connectivity and support, scope compliance, resource limits, accounting, structural hashes, and replay-closure integrity.

Booklet metrics are sequence and callout coverage, covered catalog prefix, pieces placed, steps settled by evidence class, observation coverage and `not-observable` claims, named refusals, score and margin at each refusal, deferral reach, reversal depth, and completion-audit agreement.

Soft metrics are panel agreement, silhouette similarity, blind pair agreement, latency, render count, storage, model calls, tokens, and cost. Soft metrics never compensate for a new hard failure.

### Promotion

A confirmed failure becomes a regression test or fixture only after its provenance and consent are clear, it fails on the old behavior, passes on the proposed fix, and retains the exact test or fixture identifier. Real user or provider artifacts require separate consent, minimization, license review, and secret and personal-data scanning before Git retention.

Stable knowledge is never overwritten. A promotion changes a versioned pointer after paired evaluation under frozen inputs, policies, budgets, validators, cameras, and stopping rules; rollback restores the prior pointer and preserves the evidence.

The independent evaluator, sealed promotion policy, protected holdout service, and automatic pointer update are target architecture. Current repository work is reviewed, gated, committed, and pushed under `AGENTS.md`; the product's future improvement loop is the actor forbidden from auto-merging, deploying, changing secrets, or approving its own evaluator.

## Knowledge classes

Truth is catalog geometry, connector legality, collision, migration, and provenance. It changes only through the catalog admission path and never through a model verdict or visual score.

Templates are bounded declarative subassemblies. Snapshot schemas and admission primitives exist, but no integrated booklet or studio path currently compiles a template into an accepted user change.

Current search policy is implemented as reviewed constants and run options for candidate budgets, one-panel deferral reach, thresholds, registration, and pruning. A change travels as an ordinary code change with its measurement and regression tests; there is no search-policy schema, champion pointer, challenger lifecycle, or automatic rollback today.

The target learning system versions that policy as knowledge so a changed value becomes a challenger evaluated against the same cases and reversible by pointer rather than by rewriting history.

Lessons are scoped hypotheses with durable anchors. Their one-line index is [`docs/learning/lessons.md`](../learning/lessons.md), their evidence is [`lessons-evidence.md`](../learning/lessons-evidence.md), and obsolete or machine-enforced lessons are removed rather than accumulated.

## Physical feedback

A physical claim binds only the exact document and catalog hash that was built. Any structural edit invalidates it.

Physical reports may calibrate advisory build order and stability. They do not silently change catalog truth, promote an advisory validator to blocking, or generalize one successful model into a claim about other assemblies.

## Operational guarantees

The current real-build run contract declares requested/expected step counts, maximum and target part counts, and per-piece, blind, one-panel-deferred, exploded, and narrowing render/candidate budgets. Input, raster, artifact-role, and stored-byte bounds are enforced by their own contracts rather than collected into one run budget; no current budget grants calibrated arbitrary farther-panel reach.

The target production run additionally declares ceilings for wall time, attempts, model calls, tokens, cost, total stored bytes, image dimensions, recursion, and every other external resource. A budget must be able to bind and reserve enough proof budget for a meaningful rerun.

Malformed inputs, model timeout or refusal, cancellation, WebGL context loss, catalog drift, stale revisions, partial writes, disk exhaustion, and repeated-state loops remain isolated failures. One candidate or response cannot corrupt the settled prefix or crash the manual editor.

Task-run evidence is cleaned when no active process needs it. Promoted fixtures are the exception, not a reason to retain raw corpora.

## Non-negotiable safeguards

- Model and vision output is untrusted data, never executable code or self-certifying truth.
- Every retained candidate, comparison, decision, and promotion is immutable and attributable.
- Hard validity dominates visual resemblance; pixels and structure answer different questions and both are inspected.
- A panel score is meaningful only with its exact camera, face, masks, registration, reachable bound, and image evidence.
- N+1 is only the minimum later witness; farther panels continue until the placement is revealed or the claim is recorded `not-observable`.
- Hidden surfaces are never certified by an image that does not expose them.
- User documents change only through explicit manual commands today; no automatic acceptance path exists.
- Production signing, credentials, consent authority, evaluation, and accepted namespaces cannot be created by test or challenger identities.
- Truth, technique, and preference stay separate, versioned, measured, and reversible.
