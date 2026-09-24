# Booklet-run evidence, replay, and promotion

Status date: 2026-09-24

[`spec.md`](spec.md) owns product, domain, consent, trust, and authority contracts. This document owns the evidence around a booklet run: retention, lifecycle, replay, evaluation, and the conditions under which a finding may become repository knowledge. [`building-system.md`](building-system.md) owns the current measured position, `npm run booklet` produces it, and [`docs/work/1_booklet-reset/plan.md`](../work/1_booklet-reset/plan.md) holds the open milestones. History lives in the [devlog](../devlog/summary.md) and on branch `archive/first50-campaign-wip-20260908` (f44f1b8), which keeps the retired first-50 campaign.

Each section below says whether it describes something that exists or something specified and unbuilt.

## Implementation status

- **Booklet harness, `npm run booklet` (`tools/booklet/`)** (exists): Reads the booklet, identifies every callout's part, aligns printed steps to the official model by those parts (flagged callouts by count), reports catalog coverage, checks export frames, and plays back the official-pose reference build, per printed step, scored against LEGO's official model. Per-step rows go to the ignored `output/booklet/status.json` and `output/booklet/reference-playback.json`. The valid prefix also goes to `output/booklet/reference-build.mpd`, a labelled reference build that the editor imports and plays back one printed step at a time. Headline counts are committed in `status/booklet-baseline.json` and compared on each run; a change is reported, not enforced as a failing gate (the G3e ratchet is open).
- **Closed-set callout identification (`apps/web/src/instructions/identify/`, `node scripts/identify-booklet.mjs`)** (exists): pdf.js reads the booklet, image XObjects are cut out and matched to 276 inventory thumbnails, and a min-cost flow with branch and bound proves the assignment optimal. No model is called. `npm run booklet` runs it and scores it against the official model per printed step: run-order agreement, the parts the booklet moves to another step, and each callout after alignment (G3c-2).
- **Camera fit and placement scored against the key (G3d)** (unbuilt): No step is placed by search and scored against the official model.
- **Per-step verification of a rebuild against the printed panel** (unbuilt): The harness compares with the official model, not with booklet pixels.
- **Reference build playable in the app (G3b)** (unbuilt): The studio's Instructions control ingests a PDF into bounded page and text metadata only; it does not turn pages into build steps.
- **Experimental `apps/web/e2e/real-build-*` family** (exists in code, scheduled for retirement under G3e): Its run contract, browser outputs, replay closure, candidate-lineage and panel-camera primitives, and publisher are local unauthenticated diagnostics. It is not the current frontier. The [real-build runbook](../runbooks/real-build.md) covers its commands.
- **Content-addressed artifact store and test run recorder (`apps/companion`)** (exists): Library and test namespace only; no production service or seal.
- **Test run ledger and lifecycle policy (`apps/companion`)** (exists): Hash-chained test events and transition checks exist; production identity, signing, and authoritative storage do not.
- **Replay-level derivation for retained local bytes** (exists in the real-build family): The verifier inspects closure integrity and reproduces downstream summaries from retained outputs. It deliberately refuses re-execution.
- **Build tree and backtracking (`apps/web/src/assembly/`)** (exists as a library with tests): `BuildTree` and `runBacktrackingSearch` implement the lineage rules below; no booklet driver uses them.
- **Model-call transcript schemas** (exist as protocol types): No broker-backed product producer exists.
- **Retired model-pilot identification and quarantined multi-panel checker** (scripts remain; retired or quarantined): Neither is called by the studio or the harness. Model output stays untrusted data.
- **Released broker, credential proxy, production signing, sealed replay, tombstone lineage** (specified, unbuilt): Requires the released broker, a signing identity, authenticated deletion events, and an independent verifier.
- **Independent evaluator and automatic promotion** (specified, unbuilt): No process may grant itself authority by satisfying a local score.

## Unit of work

The target booklet run reads prepared printed steps, compiles each ordinary step against one settled `BrickDocument` prefix, enumerates candidate placements, and compares a render with the printed panel at that panel's fitted camera and face. Camera fit, placement search scored against the key, and panel comparison of a rebuild are unbuilt (see the status table).

What runs today is narrower. `npm run booklet` measures each printed step against LEGO's official model: whether the step was read, whether it aligns to the official model's run order, whether the catalog covers its parts, whether the official export frames agree with catalog truth, and whether the official-pose reference build stays valid through that step. [`building-system.md`](building-system.md) reports those numbers.

A printed step is the unit of evidence. Every score, refusal, and verdict is attached to one printed step and names the inputs it was measured on.

The comparison is closed: does this exact render agree with this exact printed art under the registered measurement? A model or a human may help establish an input claim, but neither may declare structural validity or bypass deterministic compilation, collision, connection, scope, or accounting checks.

The official model is the answer key, never an input to search. Official transforms may score a result; they never enter candidate enumeration, scoring of a candidate, or a user document. A lint rule in `eslint.config.js`, proved by `tools/booklet/answer-key-guard.test.ts`, refuses product code that loads `tools/booklet` or names `output/official-model`, and the harness refuses to write its rows to a path Git does not ignore, because those rows carry official transforms.

These rules bind the placement loop when it is built. Parts of them already exist as primitives in the experimental real-build family:

- Panel registration is panel-local observation state: horizontal hand, determinant, registering panel, quarter turn, and pixel shift. It never claims a physical transform.
- A document candidate keeps one stable hash-bound identity. Each root seed or panel observation of it gets its own lineage, bound to a unique parent, run origin, prefix step, and local decision.
- Convergent branches (A to X and B to X) stay distinct lineages over one exact candidate snapshot, and share one transition when their physical work is identical.
- A batch reserves its whole budget before the first compile. Any budget, compiler, replay, or size failure emits no child frontier, but the request and its terminal evidence are retained.
- Structurally equal but byte-distinct documents are different compiler work; a lineage binds exact canonical bytes, not just a structural hash.
- No executable origin, carry, transition, or scored-panel entry point may run until a trusted producer mints its inputs. Until then those entry points refuse every caller.

## Visual observation envelope

This section is a contract for the unbuilt panel-comparison loop.

The evidence packet for a placement made at step N includes panel N, panel N+1 as the minimum later witness, and the first farther panel that actually reveals the placement when N+1 occludes it or stays ambiguous. N+1 is a floor, not a guarantee. Looking ahead stops only at a revealing witness or at a named evidence limit.

Every visual claim is scoped to the exact source crop, render, camera, face, horizontal hand and determinant, quarter turn, registration, mask, and view in which it is visible. A hidden internal surface, an occluded connection, or any feature absent from every retained view is recorded as `not-observable`; unseen pixels cannot certify it.

Part admission separately inspects matched top, bottom, front, back, left, right, isometric, and underside-oblique views, because a booklet sequence may never show every surface. [`part-model.md`](part-model.md#current-catalog) records each admission's outcome. A visual admission does not make hidden material, connector sources, collision recipes, frames, grip, stability, insertion access, or placement into visually observed truth.

Printed step 4 is the failure that set this rule. Its underside panel clearly shows hollow clutch rings, ribs, walls, and cavities, while the candidate render of the time showed an almost solid slab. [Part-model catalog truth](part-model.md#render-only-promotions-and-remaining-physical-limits) owns the render fix and the conservative collision it kept. A step verdict cannot be inherited across a render-truth change, and images still cannot prove collision.

Changing how a mask is produced (depth composition, cached probes, batching) may change only its cost. It may not change the mask rows, select a candidate, advance a prefix, raise a budget ceiling, or relax the immutable-candidate and no-partial-frontier rules. Each batch acquires its worst-case charge before work and refunds what it did not use.

## Authority boundaries

- **Booklet driver** (its local candidate set, settled diagnostic prefix, and ignored run artifacts within declared budgets): A user document, catalog truth, validators, scoring policy, consent, or application code
- **Curator or developer** (quarantined tests, fixtures, thresholds, templates, and code changes through the repository workflow): Protected evaluation inputs, production identity, another actor's consent, or its own proof standard
- **Test companion** (test-namespace artifacts and ledger events): A production seal, accepted namespace, user authorization, credential, or physical claim
- **Future independent evaluator** (a report under a predeclared policy): The challenger, benchmark definition, consent record, or protected holdout it evaluates
- **Human maintainer** (reviewed repository and product-policy decisions): Retroactive alteration of immutable evidence

An experiment may change the system under test or the evaluation contract, never both in one result. Otherwise a weaker validator, easier benchmark, shifted camera, or tuned threshold can pass for improvement.

A local inspector may check a signature, a challenge's freshness, and a ledger transition, but it returns authority absent. Only a released broker's durable one-use event can admit a user decision, and an audit identity is never a bearer capability.

## Evidence contract

### Implemented local bundle

**Booklet harness (exists).** Each run records its inputs by path, byte length, and SHA-256; an input over its byte limit is refused by name, and an absent input skips only the stages that need it. Each stage writes per-step rows to `output/booklet/status.json` (schema `lego.booklet-status/3`), and the reference build goes to `output/booklet/reference-playback.json`. Identification runs on the booklet alone; alignment then holds each printed step to the parts identification names, and records beside it the alignment by callout counts alone, so a change in which bricks a step gets is visible. Both are ignored, and both carry official transforms. A present but unusable input (malformed, oversized, or an official export whose rows contradict the LXFML) fails the stages that need it and the run, naming the file and the fault; the other stages still report. The headline counts are the only committed output (`status/booklet-baseline.json`, rewritten only by `--write-baseline`). Every LDraw-to-catalog frame playback uses is catalog truth; the first-50 frame registry under `output/real-build/history/` is read only with `LEGO_RUN_EVIDENCE=1`, and then only to compare with catalog frames.

**Experimental real-build family (exists, retiring under G3e).** Its run contract binds input digests for the booklet, prepared panels and callouts, action ledger, transition classifications, identification inputs, run options, application source and build closure, runtime, and any model-derived input the run consumes. Binding a raster-blind transition label does not make it visual evidence. Its outputs are local, unauthenticated diagnostics. The rules below are the durable part of that code and bind any successor.

- An incomplete run retains every readable row that matches its prepared input, then records the refusal that stopped the prefix. A malformed envelope may be rejected whole; an ordinary reproduction defect does not erase valid earlier evidence.
- After the first failed row, every later row is an exact unattempted, zero-placement causal block naming its step, with no validation, candidate, render, camera, or document drift.
- A run input is deep-copied before its first await and re-checked after preparation; any drift refuses before raster, search, or placement.
- When target equivalence is not reconciled but the document, identity bindings, build sequence, validation report, and searched transforms stay coherent, the document is published only as `diagnostic-prefix.json`. The canonical final document, hash, and part count then stay unavailable.
- Target equivalence is checked after search, never during it. Same-step design, material, catalog, and colour groups are matched as exact multisets under one proper upright yaw and one integer-LDU translation, and each placement must match its complete connector, collision, allowance, bounds, and render realization modulo catalog-proved self-symmetry. A reflection (determinant -1) is diagnosed and reported but never fills canonical fields. The audit is bounded to 1..1,464 identity rows and fails closed on unknown parts or unsupported realization layers.
- Own-panel evidence may register at the compiled step. Lookahead must use a strictly later panel. An exact tie between best camera groups stays unresolved even for one structural candidate.
- A registration whose exact mask bytes are not retained cannot authorize a positive placement, because its score cannot be recomputed.
- A failure reason is derived from the exact step, lineage, and evidence role that produced it; a caller-authored failure with no evidence-derived witness is refused rather than retained as a typed refusal.
- Document continuity advances only through a genuine validated `BuildStep`. A validated zero-piece step changes the accepted hash without changing the part count; an absent, duplicate, unvalidated, or hash-preserving no-op step cannot advance it.
- A fixed-ledger or `multi-build-copy` action refuses with `fixed-ledger-frame-unresolved` before its executor runs, because no trusted physical-frame producer exists.

Observation-source masks keep four named stages: H is the high-resolution cleaned-art mask; P isolates at high resolution before downsampling and is the production mask; D downsamples before isolating; W is derived separately from the work raster. Comparisons between them are calibration evidence only. Local publication uses exclusive writes, fsync, same-directory rename, and read-back; on Windows that is cooperative detection, not directory sealing, crash durability, or protection from a same-user race. A browser-side commitment that Node cannot reproduce is labelled an opaque browser assertion, and a point-sampled display column cannot authenticate source pixels.

Current gaps, stated so they are not mistaken for features. No run contract binds a catalog snapshot or complete truth bundle. No step row records document revisions, a before-and-after structural-hash pair, inline mask bytes, or a complete N / N+1 / first-revealing-farther packet. No score records reversal depth, retained byte count, replay level, or a structured target-equivalence audit. Panel-local registration is never physical-transform authority, and no trusted physical-frame producer exists.

### Target evidence contract

This is specified and unbuilt.

The complete run input binds the catalog and truth snapshots and every retained nondeterministic response, in addition to the local closure.

The complete step record adds: document revision and structural hash before and after the step; per-row source and render digests; the N / N+1 / first-revealing-farther observation packet with explicit `not-observable` outcomes; the step-1 face seed, rotate-icon sequence and fold, and derived panel face; all eight scored or empty hand-and-turn hypotheses with their determinant and translation; any exact-tie refusal; and candidate-lineage provenance that keeps one stable candidate identity while binding each root seed or panel observation to a unique lineage and explicit parent, so the decision can be reproduced without joining unbound filenames.

The complete summary adds deferral and reversal totals, deepest reversal, retained byte count, replay level, termination policy, and every finding that prevents completion. These fields become current only when their schemas, producers, and verification tests exist.

Publication content-addresses retained artifacts and enforces the render, candidate, role-byte, and stored-byte limits its contracts declare. A closure may claim only the replay level its retained bytes support; broader budgets are under [Operational guarantees](#operational-guarantees).

Raw evidence lives only under ignored `output/` and `var/runs/` roots. It enters Git only when review promotes a minimized, licensed, secret-scanned fixture, golden, benchmark, or contract input.

## Candidates and lineage

Every alternative is immutable. A repair, replan, or rejected placement is a child that references its parent and exact base state; it never overwrites the branch that produced counterevidence.

Structural hashes identify duplicate states, lineage identifies cycles, and metric history identifies oscillation. Backtracking walks to the shallowest ancestor with an eligible untried child and reports how many steps were undone and the maximum reversal depth.

`BuildTree` and `runBacktrackingSearch` in `apps/web/src/assembly/` implement those rules as a library with tests; no booklet driver uses them. The real-build family adds narrower primitives: parent and child document hashes are rechecked around callbacks, candidate and narrowing budgets are shared and reserved before work, a family-only decision does not falsely settle its ambiguous descendants, a thrown or malformed render keeps its attempts and counterevidence but authorizes no selection, and a whole row is validated before lineage state changes.

What the placement loop still needs, in order: a producer that binds trusted step preparation, enumeration, exact source execution, visual measurement, and shared budgets into one run; a released broker to authenticate the user's event without exposing a local mint; and trusted physical-frame replay before any fixed action completes. Generic ancestor reversal, carry through arbitrary depth, and reversal-depth reporting are unbuilt.

A search may not charge less work after it has observed results. Pruning (projected-fill bounds, same-batch mask reuse, upper-bound cuts) stays a hypothesis until exact bound inputs, certified row identities, skipped-row masks, and selection parity with the unpruned baseline are retained, and it needs a certified cost agreed before work starts.

## Typed refusals

A refusal is a product surface and evidence. It names what happened, the exact input and observed value, the required condition, and any bounded next action the caller may take.

Hard validation dominates visual agreement. A candidate that looks right but collides, disconnects required structure, uses an illegal port, exceeds scope, or breaks accounting is refused. A structurally valid candidate that the panel cannot distinguish is also refused rather than chosen by a numerically meaningless lead. In the determinant-aware registration primitive, an exact best-score tie spanning both horizontal hands returns `camera-handedness-unresolved` and keeps all eight attempted hypotheses; enumeration order has no authority to choose a hand.

Thresholds and budgets carry the measurement that set them, the metric and registration they use, their false-accept and false-refusal observations, and the population on which those counts were measured. A positive score or a passing majority-class baseline is not evidence of correctness.

## Replay

Deterministic compilation is stronger than run replay. Identical canonical base bytes, normalized program bytes, and pinned truth snapshots must produce identical compilation and validation; a run that depended on a model or a missing source boundary may support only partial replay.

### Replay levels

- `full`: every required input and captured nondeterministic boundary is retained, so trusted code can re-execute from the beginning. This needs the sealed production path, which is unbuilt, so no local booklet run can claim it.
- `downstream-only`: retained bytes form a complete closure from the earliest captured boundary, normally the browser output, so downstream parsing, finalization, hashing, and scoring can be checked without re-running the missing upstream work.
- `metadata-only`: the record is inspectable audit metadata but lacks the bytes needed for downstream execution. The real-build publisher refuses to publish or verify this level, or any input-rejection boundary, until a typed digest-bound rejection witness makes the exact refusal reproducible.

The verifier derives the maximum level from the transitive content-addressed closure; callers do not choose it. Unknown roles, missing required roles, hash mismatch, unavailable bytes, consent restrictions, or an exceeded role limit lower or invalidate the claim by name.

Local closures carry `authority: "local-diagnostic"` and `authenticated: false`. The replay reader verifies retained bytes and downstream results, then refuses executable replay. A manifest that says `downstream-only` does not imply that the browser work or a model call can be rerun.

An old closure is read under its own schema generation and is never relabelled as current. The retained real-build runs of the first-50 campaign were deleted with the evidence cleanup; their history is in the devlog and the archive branch.

The target production design adds an immutable `sealedReplayLevel` and a separately derived `effectiveReplayLevel`. Consent-driven deletion would append an authenticated tombstone, remove permitted bytes and indexes, and lower the effective level without rewriting the original certificate. None of that is built.

## Test ledger lifecycle

This exists in `apps/companion`, in the test namespace only.

The test ledger is an append-only, hash-chained event stream with a rebuildable query view. It records schema version, sequence, previous-event hash, actor, transition, idempotency key, and referenced artifact hashes.

Run states are `created`, `queued`, `running`, `draining`, `cancelling`, `persistenceFailed`, `succeeded`, `exhausted`, `failed`, and `cancelled`. Normal completion and budget exhaustion pass through `draining`; no new work starts there.

Model-attempt states are `created`, `running`, `succeeded`, `failed`, `timedOut`, and `cancelled`. An attempt result that cannot be retained moves the enclosing run to `persistenceFailed` rather than allowing an unrecorded success.

Candidate states distinguish receipt, compilation, hard validity, diagnostic rendering and review, canonical rendering, panel comparison, ranking, presentation, archival, cancellation, processing failure, and persistence failure. A hard-invalid candidate can produce a diagnosis or a child repair but can never become rankable.

The exact allowed transitions are enforced in code; this summary grants no production authority. Recovery resumes only from a verified durable checkpoint, cancellation is idempotent, and late events from an older generation are diagnostic.

## Model calls as evidence

[`spec.md`](spec.md#model-calls-and-consent) owns consent, minimization, provider policy, and the untrusted-output rule.

The current identification path calls no model: closed-set callout identification matches cut-out booklet images to inventory thumbnails and proves the assignment optimal. The earlier model-pilot identification (the `/4` and `/5` answer transports and their six-card pilot), the single-panel placement script, and the multi-panel N / N+1 / K checker remain as scripts, retired or quarantined. None is called by the studio or the harness, none runs through a broker, and none can change a document or admit a catalog part. No live verdict from any of them is retained as evidence.

Protocol types for provider capabilities, actor observations, attempt transcripts, and retained responses exist and have contract tests. They have no product producer or broker enforcement path, so docs and UI must not describe them as a working model service.

Any vision-checker call, including a revived multi-panel checker, must meet this contract before it counts as evidence:

- It binds the exact source and render PNG bytes for panels N and N+1, and for a farther panel K sent only after an unjudgeable predecessor. It also binds the PDF digest, page, and crop claims; the deterministic face; the base document, catalog, truth, ledger, candidate, transform-set, and same-step group identities; the exact prompt, minimized brief, and instruction bytes; the pinned model identity; usage; the raw response; and the tool trace.
- The whole sequence is preflighted before the first transmission against call, byte, decoded-pixel, retention, and farther-step limits. Callers may lower hard budgets but never widen them. Images are parsed under bounded dimensions with checked chunks.
- The model gets no general file access; it sees only the bound images, and the retained tool result must reproduce them byte for byte.
- A strict `different` may veto the whole candidate. `same` only corroborates pending deterministic validators. Exhausted `unjudgeable` attempts record `not-observable`. Every result denies certification, mutation, validator bypass, and authenticated authority.
- A producer must prove the source crop came from the named PDF, page, and bounds, and that the user consented to sending it. An image digest cannot create either fact.

The panel face is deterministic evidence, not a model answer. Rotate icons fold from the explicit step-1 `studs-up` seed to give each panel's face. A model's `viewpoint` field may agree, decline, or make its whole reading refuse; it cannot override the parity record or set the absolute face from the drawn lattice.

A blind pair-judgement verdict binds only the exact crop, by its full SHA-256, and the claimed element. Other bytes, another element, or membership of a similarity cluster stay unjudged. Such a file is durable label evidence, not a replay of the judging calls.

Any future external call records purpose, provider, pinned model identity, parameters, seed where supported, bounded input digest, raw response hash, timing, cost, terminal status, consent and provider-policy digests, and the exact boundary from which replay can resume. A response that cannot prove its pinned identity or be durably captured is refused. Evidence produced without a broker seal (a same-user process can fabricate consistent local bytes) supports diagnosis only, never a catalog, truth, acceptance, or provider-authentication claim.

## Evaluation

### Measurable intermediates

A booklet supplies its own early checks: steps run 1 through N without gaps, action and callout counts reconcile, type size tells quantity from a repeat multiplier, placed pieces reconcile with the inventory, and results are compared per step rather than by final hash equality. `npm run booklet` measures the ones that exist today per step (read, aligned, catalog-covered, reference playback valid) and compares its headline counts with the committed baseline; `npm run test:score` runs the scoring tests that `npm test` leaves out.

Every claimed improvement names the number it should move and keeps the image or structured evidence that makes the number meaningful. A fixture that derives its expected answer from the path under test, or an accuracy figure without its majority baseline, is not an independent check.

### Metrics

Hard metrics are compilation, schema and catalog compatibility, connector and collision validity, required connectivity and support, scope compliance, resource limits, accounting, structural hashes, and replay-closure integrity.

Booklet metrics are sequence and callout coverage, catalog coverage, pieces placed, steps settled by evidence class, observation coverage and `not-observable` claims, named refusals, score and margin at each refusal, deferral reach, reversal depth, and agreement with the completion audit.

Soft metrics are panel agreement, silhouette similarity, blind pair agreement, latency, render count, storage, model calls, tokens, and cost. Soft metrics never make up for a new hard failure.

### Promotion

A confirmed failure becomes a regression test or fixture only after its provenance and consent are clear, it fails on the old behaviour, passes on the proposed fix, and keeps the exact test or fixture identifier. Real user or provider artifacts need separate consent, minimization, license review, and secret and personal-data scanning before Git retention.

Stable knowledge is never overwritten. A promotion changes a versioned pointer after paired evaluation under frozen inputs, policies, budgets, validators, cameras, and stopping rules; rollback restores the prior pointer and keeps the evidence.

The independent evaluator, sealed promotion policy, protected holdout service, and automatic pointer update are target architecture and unbuilt. Repository work today is reviewed, gated, committed, and pushed under `AGENTS.md`; the product's future improvement loop is the actor forbidden from auto-merging, deploying, changing secrets, or approving its own evaluator.

## Knowledge classes

Truth is catalog geometry, connector legality, collision, migration, and provenance. It changes only through the catalog admission path, never through a model verdict or a visual score.

Templates are bounded declarative subassemblies. Snapshot schemas and admission primitives exist, but no booklet or studio path compiles a template into an accepted user change.

Search policy today is reviewed constants and run options (candidate budgets, deferral reach, thresholds, registration, pruning). A change travels as an ordinary code change with its measurement and regression tests; there is no search-policy schema, champion pointer, challenger lifecycle, or automatic rollback.

The target learning system versions that policy as knowledge, so a changed value becomes a challenger evaluated against the same cases and reversible by pointer rather than by rewriting history.

Lessons are scoped hypotheses with durable anchors. Their one-line index is [`docs/learning/lessons.md`](../learning/lessons.md), their evidence is [`lessons-evidence.md`](../learning/lessons-evidence.md), and a lesson is removed once its gate lands rather than kept.

## Physical feedback

A physical claim binds only the exact document and catalog hash that was built. Any structural edit invalidates it.

Physical reports may calibrate advisory build order and stability. They do not silently change catalog truth, promote an advisory validator to blocking, or generalize one successful model into a claim about other assemblies.

## Operational guarantees

The harness (exists) caps each input's bytes and records its length and SHA-256. An absent input skips its stages, and an unusable one fails them by name.

A placement run binds these rules. The real-build run contract implements them today, and any successor keeps them:

- The run declares its limits up front: the expected printed-step count, the last step requested, part counts, per-piece and farther-panel limits, and shared candidate and render budgets. Execution, reports, and document changes end at the requested step; source rows past it are passive evidence and cannot contribute an action, a piece, or a placement.
- A reservation is made before the batch or render it pays for. A refusal keeps completed immutable evidence and admits no partial frontier.
- Input, raster, artifact-role, and stored-byte bounds are enforced by their own contracts rather than one pooled budget. No current budget grants arbitrary farther-panel depth or deep backtracking.

The target production run also declares ceilings for wall time, attempts, model calls, tokens, cost, total stored bytes, image dimensions, recursion, and every other external resource. A budget must be able to reserve enough proof budget for a meaningful rerun.

Malformed inputs, model timeout or refusal, cancellation, WebGL context loss, catalog drift, stale revisions, partial writes, disk exhaustion, and repeated-state loops stay isolated failures. One candidate or response cannot corrupt the settled prefix or crash the manual editor.

Task-run evidence is cleaned when no active process needs it. Promoted fixtures are the exception, not a reason to keep raw corpora.

## Non-negotiable safeguards

- Model and vision output is untrusted data, never executable code or self-certifying truth.
- Every retained candidate, comparison, decision, and promotion is immutable and attributable.
- Hard validity dominates visual resemblance; pixels and structure answer different questions, and both are inspected.
- A panel score is meaningful only with its exact camera, face, masks, registration, reachable bound, and image evidence.
- N+1 is only the minimum later witness; farther panels continue until the placement is revealed or the claim is recorded `not-observable`.
- Hidden surfaces are never certified by an image that does not show them.
- The official model is the answer key: it scores results and never feeds search, candidates, or documents.
- User documents change only through explicit manual commands today; no automatic acceptance path exists.
- Production signing, credentials, consent authority, evaluation, and accepted namespaces cannot be created by test or challenger identities.
- Truth, technique, and preference stay separate, versioned, measured, and reversible.
