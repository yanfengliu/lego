# Booklet-run evidence, replay, and promotion

Status date: 2026-08-12

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
| Candidate lineage, farther-frontier, and backtracking primitives | Bounded farther carry integrated; generic backtracking remains library-only | The real-booklet driver retains immutable N parents, exact atomic piece witnesses and N+1 captures, carries one intervening step under shared ledgers, and conditionally scores K only after an atomic carry; generic deep reversal is not integrated. |
| Diagnostic-prefix retention and target equivalence | Deterministic proper-upright audit implemented in Node finalization; separate local publication implemented | Exact bound identity groups and complete catalog realizations must share one proper upright yaw plus integer-LDU translation; otherwise a structurally valid searched document remains `diagnostic-prefix.json` and canonical final document, hash, and part count remain unavailable. |
| Model-call transcript schemas | Implemented protocol | No broker-backed product producer exists. |
| Local part and panel proposers | Implemented as derivation scripts | They invoke a pinned CLI model outside the product for cropped part cards or one printed panel and write ignored local evidence; neither is wired into the studio or real-booklet driver. |
| Part visual-admission packets and reviews | Implemented as developer tooling; `/13` exterior review complete | An independent LDraw render and the production catalog render share one eight-view camera packet; every generation is pending-only, while the `/13` tranche has separately published native-resolution review sidecars and a complete review-batch manifest. |
| Blind pair-judgement evidence | Implemented as retained input and consumer | It is not an integrated live checker call. Current panel verification is deterministic pixel scoring. |
| Transition classification | Implemented as prepared local input | The current classifier is raster-blind, so its label is not a visual witness. |
| Independent evaluator and automatic promotion | Specified, unbuilt | No process may grant itself authority by satisfying a local score. |

## Unit of work

A booklet run reads prepared printed steps, compiles an ordinary step against one settled `BrickDocument` prefix, enumerates candidate placements, and compares a render with a printed panel at that panel's fitted camera and face. A deferred origin may now branch temporarily, but no branch becomes document truth until the bounded family decision is complete.

A printed step is the unit of evidence. The implemented local row records the fields listed under [Implemented local bundle](#implemented-local-bundle), including bounded farther evidence when invoked, and links image filenames whose bytes are hashed and cross-checked by the artifact manifest; the complete generic packet described under [Target evidence contract](#target-evidence-contract) does not exist yet.

The comparison is closed: does this exact render agree with this exact printed art under the registered measurement? A model or human may help establish an input claim, but neither may declare structural validity or bypass deterministic compilation, collision, connection, scope, or accounting checks.

## Visual observation envelope

The target evidence packet for a placement made at step N includes panel N, panel N+1 as the minimum later witness, and the first farther panel that actually reveals the placement when N+1 occludes it or remains ambiguous. N+1 is a floor, not a guarantee, and looking ahead stops only at a revealing witness or a named evidence limit.

Every visual claim is scoped to the exact source crop, render, camera, face, registration, mask, and view in which it is visible. A hidden internal surface, an occluded connection, or any feature absent from all retained views is recorded as `not-observable`; unseen pixels cannot certify it. Part admission separately inspects matched top, bottom, front, back, left, right, isometric, and underside-oblique views because a booklet sequence may never expose every surface.

The completed `/13` outcome and measurements are recorded in [`part-model.md`](part-model.md#current-catalog). Here they establish only that separately published native-resolution review sidecars can close retained exterior views; they do not turn hidden interiors or conservative collision recipes into observed truth.

Printed step 4 is the concrete failure that sets this rule: its underside panel visibly shows hollow clutch rings, ribs, walls, and cavities, while the former candidate render showed an almost solid slab. [Part-model catalog truth](part-model.md#render-only-promotions-and-remaining-physical-limits) owns the render correction and its preserved conservative collision; an old step verdict cannot be inherited across that render-truth change, and the images still cannot prove collision.

The current real-booklet runner implements a bounded subset of that packet. When own-panel scoring cannot separate step N and N+1 remains unrevealing, the generic path retains every N parent with its exact cached N+1 score render, carries one configured intervening step under shared candidate and narrowing ledgers, and scores a conditional K only after the entire carry succeeds. The calibrated step-5 shortcut is narrower: only the exact two retained origins, their piece witnesses, prepared step-5/6/7 data, run options, input digests, and captured source closure admitted by the reviewed attestation may be scored directly against panel 7 after panel 6 remains ambiguous. The current run scored those origins `0.81657223796034` and `0.9367520589707421`, selected the second, and produced an eight-piece searched prefix through step 5. Step 6 then retained four unseparated origins; the step-7 carry expanded three parents for 2,218, 2,169, and 3,650 narrowing renders and retained eight lineages at aggregate 8,037 before refusing the next 599-render request against the shared 8,192 ceiling, with no partial frontier. This is not arbitrary farther-panel scanning, generic deep backtracking, or a vision checker; the raster-blind transition classifier and separate model-derived readings remain non-visual or unintegrated evidence.

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

The current result records local unauthenticated authority, status, requested and expected step counts, assembled target, input and completion failures, retained step rows, optional canonical final document and structural hash, canonical final part count, an optional diagnostic prefix, and elapsed time. After exact report-to-binding-to-canonical-part identity, metadata, step ownership, and transform checks pass, Node finalization evaluates the official transforms post-search under all four proper upright yaws and one global integer-LDU translation. Same-step design/material/catalog/color groups are matched as exact multisets, and each placement must match complete connector, collision, allowance, bounds, and flat render triangle-and-normal realization modulo catalog-proved upright self-symmetry. Official transforms never enter candidate enumeration or scoring, and a structurally valid reflection cannot populate canonical fields.

Each retained step row records its step and page, action and action-evidence digest, expected/attempted/placed counts, outcome, prerequisite facts, validation target/truth/validator hashes when validation ran, fit and camera facts, highlights and arrows, per-piece search and score data, whole-step/deferral/exploded evidence, elapsed time, and panel/build PNG filenames. When bounded farther search runs, the row also binds the origin parents and hashes, exact piece witnesses, parent-child lineages, per-panel scores, shared candidate/narrowing/panel budget facts, typed refusal or family-only decision, and dense exact source/candidate capture metadata. The artifact manifest verifies the projected capture paths and PNG bytes separately; the row does not carry a digest for each PNG.

An incomplete run retains every readable row that matches its prepared input and then records the refusal that stopped the prefix. Malformed envelopes may be rejected wholesale; an ordinary reproduction defect does not erase valid earlier evidence.

When target equivalence is unreconciled but the retained document, identity bindings, build sequence, validation report, and searched transforms remain coherent, publication writes the exact candidate document to `diagnostic-prefix.json`. Score schema `/4` carries only its schema, through-step count, `targetEquivalence`, structural hash, and part count; artifact-manifest schema `/3` repeats that summary as a truth snapshot and replay independently finalizes the browser output, reproduces the exact document bytes, and verifies the file, score, and manifest agree. Current run `2026-08-12T10-28-52-560Z-34694c87c62e-26128a38-4d9e-4294-9091-6aae9b3ca367` closes that path over a five-step, eight-part, 30-connection diagnostic document with hash `sha256:47ae3d353885f5de11b685a4bec4ca1132554a19e1f1e30454281252f7d64c93`. This proves which structurally valid diagnostic bytes survived; it does not prove that the candidate is the official model.

The target-equivalence audit is bounded to 1..1,464 unique identity/part rows with safe-integer upright transforms and fails closed on unknown catalog parts or unsupported realization layers. Its per-audit cache retains catalog self-symmetry results by definition and full comparisons by definition plus relative transform, so repeated identical parts do not regenerate the same surface along every group-matching path. A diagnostic D4 reflection must map every origin, preserve the connector, collision, allowance, and bounds layers, and reproduce the independently inferred compatible-contact multiset; its exact flat render topology is reported separately and never converts determinant -1 into completion.

Current gaps are explicit. The run contract does not separately bind a catalog snapshot or complete truth bundle; a step row does not record document revisions, a before-and-after structural-hash pair, inline per-image digests, or a complete arbitrary-depth N/N+1/first-revealing-farther observation packet; and `score.json` does not contain reversal depth, retained byte count, replay level, or the structured target-equivalence audit. Replay closure and artifact-size facts live in separate manifest files, the bounded one-intervening-step driver has no generic reversal depth to report, and the implemented post-search audit diagnoses but does not repair the search camera/world hand.

### Target evidence contract

The complete target run input binds the catalog and truth snapshots and every retained nondeterministic response in addition to the implemented closure.

The complete target step record adds document revision and structural hash before and after the step, per-row source and render digests, the bound N/N+1/first-revealing-farther observation packet with explicit `not-observable` outcomes, the step-1 face seed, rotate-icon sequence and fold, derived panel face, and candidate-lineage provenance sufficient to reproduce the decision without joining unbound filenames.

The complete target summary adds deferral and reversal totals, deepest reversal, retained byte count, replay level, termination policy, and every finding that prevents completion. These fields become current only when their schemas, producers, and verification tests exist.

Current local publication content-addresses retained artifacts and enforces the render, candidate, role-byte, and stored-byte limits declared by its participating contracts. A closure may claim only the replay level its required bytes support; broader target budgets are stated under [Operational guarantees](#operational-guarantees).

Raw evidence lives only under ignored `output/` and `var/runs/` roots. It enters Git only when review promotes a minimized, licensed, secret-scanned fixture, golden, benchmark, or contract input.

## Candidates and lineage

Every alternative is immutable. A repair, replan, or rejected placement is a child that references its parent and exact base state; it never overwrites the branch that produced counterevidence.

Structural hashes identify duplicate states, lineage identifies cycles, and metric history identifies oscillation. Backtracking walks to the shallowest ancestor with an eligible untried child and reports how many steps were undone and the maximum reversal depth.

Those rules are implemented in the generic build-tree and backtracking libraries. The real-booklet driver now consumes the bounded farther-frontier path: it rechecks parent and child document hashes around callbacks, retains exact atomic catalog-part/color witnesses and immutable lineages, uses shared aggregate candidate and narrowing ledgers, and admits a family-only decision without falsely settling its ambiguous descendants. The exact attested step-5 shortcut proved that panel 7 separates the two retained origins by `0.12017982101040214`, but its selected eight-piece document remains a diagnostic candidate because finalization's deterministic catalog-realization audit proves that no proper upright target frame survives the step-3 `6106`. The next ordinary carry retains eight lineages from three of four step-6 origins at 8,037 renders and refuses the next 599-render request before work; generic ancestor reversal, arbitrary-depth carry, and reversal-depth reporting remain unbuilt in the driver.

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

Run `2026-08-12T09-14-05-246Z-32668097b507-2989d382-2a93-470c-aadb-14d91107a904` remains the immutable artifact-manifest `/2`, score `/3` predecessor and cannot be interpreted as if it contained a diagnostic-prefix truth snapshot. Current run `2026-08-12T10-28-52-560Z-34694c87c62e-26128a38-4d9e-4294-9091-6aae9b3ca367` explicitly supersedes it for verification under artifact-manifest `/3`, score `/4`, and replay-closure `/3`; the pointer binds replay digest `sha256:1c27df8a95c655f7508436489e8e31f486f806c7a5382df76d53e0a80801a66c` and artifact-manifest digest `sha256:4dc5ce021e03ba0bc86667a64a1948f9ad54d2d80f95eb887b559a593c7036aa`.

The target production design adds an immutable `sealedReplayLevel` and a separately derived `effectiveReplayLevel`. Consent-driven deletion would append an authenticated tombstone, remove permitted bytes and indexes, and lower the effective level without rewriting the original certificate. None of that is implemented by the current companion library.

## Test ledger lifecycle

The implemented test ledger is an append-only, hash-chained event stream with a rebuildable query view. It records schema version, sequence, previous-event hash, actor, transition, idempotency key, and referenced artifact hashes.

Run states are `created`, `queued`, `running`, `draining`, `cancelling`, `persistenceFailed`, `succeeded`, `exhausted`, `failed`, and `cancelled`. Normal completion and budget exhaustion pass through `draining`; no new work starts there.

Model-attempt states are `created`, `running`, `succeeded`, `failed`, `timedOut`, and `cancelled`. An attempt result that cannot be retained moves the enclosing run to `persistenceFailed` rather than allowing an unrecorded success.

Candidate states distinguish receipt, compilation, hard validity, diagnostic rendering and review, canonical rendering, panel comparison, ranking, presentation, archival, cancellation, processing failure, and persistence failure. A hard-invalid candidate can produce diagnosis or a child repair but can never become rankable.

The exact allowed transitions are enforced in `apps/companion`; this summary does not grant production authority. Recovery resumes only from a verified durable checkpoint, cancellation is idempotent, and late events from an older generation are diagnostic.

## Model calls as evidence

[`spec.md`](spec.md#model-calls-and-consent) owns consent, minimization, provider policy, and the untrusted-output rule.

The current model-assisted derivation paths are local scripts that send bounded part-art crops or one cropped printed-step image to a pinned CLI model to propose identification or placement relations. A quarantined multi-panel checker and subscription-CLI MCP adapter now also implement the source-bound N/N+1/conditional-K request, immutable attempt, strict verdict, and refusal contracts in local tooling. None is called by the studio or real-booklet driver, none runs through a broker, and none can mutate a document or admit a catalog part.

The current panel-placement script accepts one arbitrary resolved local input path without containment, file-type, dimension, PDF, page, or crop-bounds validation and exposes its authenticated temporary snapshot to the CLI with a fixed relation prompt and text naming the new and already-built pieces. The CLI receives no candidate render, panel N+1, first revealing farther panel, alternate view, deterministic panel-face parity, or source binding and is granted repository-wide `Read`. The ignored reading retains image, prompt, brief, and model digests; the raw result and parsed reading; model identity; timing, call, and cost metadata; and current-piece descriptors. It does not retain the input bytes or source path, exact brief or built-piece-list bytes, action-ledger digest, CLI tool trace, or an immutable attempt ID, and the fixed per-step output filename is replaced on rerun. When the mutable input path changes, the digest says that different bytes were used without making the original bytes reproducible. The prompt prefers a same-step anchor that the consumer then refuses as not yet placed, while parsed `newPieceOutlines` and `confidence` fields have no consumer; these are proposal-schema gaps, not evidence that narrowing is correct. That record is proposal evidence only, not a replayable visual observation packet.

The new checker closes the byte-transport and refusal gaps only inside its quarantined local path. It binds exact source and render PNG bytes/digests for N, N+1, and a K supplied only after an unjudgeable predecessor; PDF digest/page/crop claims; deterministic face seed, every rotate-icon fold, and resulting face; base document, catalog, truth, ledger, candidate-node, transform-set, and same-step atomic-group identities; exact prompt, minimized model brief, and complete instruction bytes; pinned model identity; bounded usage; raw response; and raw stream-json tool/result trace. Full-sequence preflight validates every prospective panel bundle and full-budget canonical request floor, plus call, byte, decoded-pixel, retention, and farther-step limits, before the first transmission; callers may lower hard budgets but cannot widen them. PNGs require bounded dimensions, authenticated IHDR and chunk CRCs, ordered data, exact IEND closure, and an exact bounded 8-bit non-interlaced raster decode with valid row filters. Its Claude adapter disables built-ins and settings, enables safe mode, passes an allowlisted environment, and offers only a one-shot no-argument MCP image tool, so no general `Read` capability or unrelated repository environment reaches the model. The retained tool result must byte-for-byte reproduce the bound labels and image blocks for that request; farther attempts bind the remaining cumulative token, cost, time, and retention budgets, with cost and time constrained by the CLI and token and retention excess refused postflight; and a typed mid-run failure exposes every already sealed attempt instead of trapping it in a local array. Strict `different` may veto the whole candidate, `same` only corroborates pending deterministic validators, and exhausted `unjudgeable` attempts record `not-observable`; every result denies certification, mutation, validator bypass, and authenticated authority.

This checker is still diagnostic infrastructure, not an operating booklet loop. No real-PDF/candidate-render producer feeds it, no accepted driver path consumes its result, and no current code proves that a claimed source PNG was actually cropped from the named PDF/page/bounds or that a caller holds consent to transmit that crop and candidate render; those are required producer and broker preflights, not facts an image digest can create. Its 56 mocked contract, adversarial, protocol, sequencing, process, and cleanup cases prove the local byte and refusal boundaries they exercise; they do not prove source authorization, live visual accuracy, or successful provider transport. No live verdict has been retained.

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

The current real-build run contract declares requested/expected step counts, maximum and target part counts, per-piece, blind, one-panel-deferred and exploded limits, a bounded farther-panel reach, a farther-panel score-render limit, and shared aggregate candidate and narrowing ledgers for intervening carry. Reservations are made before the batch or render they authorize, and a refusal retains completed immutable evidence without admitting a partial frontier. Input, raster, artifact-role, and stored-byte bounds are enforced by their own contracts rather than collected into one run budget; no current budget grants arbitrary farther-panel depth or deep backtracking.

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
