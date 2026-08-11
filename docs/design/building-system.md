# Building system: current assessment and ordered work

Status date: 2026-08-11

This document is the current position of the editor and printed-booklet build system. [`spec.md`](spec.md) owns product, domain, and authority contracts; [`learning-system.md`](learning-system.md) owns run evidence and replay; [`part-model.md`](part-model.md) owns catalog truth; and the [devlog](../devlog/summary.md) owns history.

## Executive status

The offline manual editor is usable today. It stores local projects in IndexedDB, renders and validates the versioned `BrickDocument`, imports and exports the supported LDraw subset, and plays authored build steps.

The studio can ingest an instruction PDF, retain bounded page and text metadata, and fingerprint it, but it does not turn pages into build steps. The reader, action-ledger generator, placement search, and scoring loop remain opt-in local tooling driven through Playwright and scripts; see the [real-build runbook](../runbooks/real-build.md).

Catalog `/13` has 85 definitions: 61 use parametric rendering and 24 use bundled LDraw meshes. Sixteen mesh definitions are render-only promotions that preserve their preceding connector, allowance, and collision truth; eight are fully measured definitions. `npm run parts:check` passes all 85 definitions and is part of `npm run verify`.

Catalog `/13` has a complete native-resolution exterior review; [`part-model.md`](part-model.md#current-catalog) owns the exact review hash and pixel measurements. The result certifies only surfaces exposed by the eight views, and the earlier downsampled contact-sheet attempt remains counterevidence rather than admission.

The latest `/13` booklet run was published from a source-stable snapshot as an unauthenticated, incomplete diagnostic. It settled printed steps 1 through 4 and placed six pieces. Step 5 refused: its own panel could not separate the leading candidates, and the step-6 panel was too occluded to meet the registered agreement threshold. A separate bounded probe carried both step-5 parents through step 6 and showed that step 7 separates the two parent families and favors one by panel agreement, but honest narrowing required 8,609 renders against the declared 8,192 global budget and step 7 still left four step-6 children unresolved. The production driver therefore remains unchanged and correctly refuses.

## Capability matrix

| Area | Current state | Important limit |
| --- | --- | --- |
| Manual editor | Implemented | Selection and authoring remain primarily single-part; grouping, submodel authoring, richer step editing, and user-facing articulation are incomplete. |
| Projects | Implemented | Projects and autosaves are browser-local IndexedDB state; there is no production sync service. |
| Catalog and palette | Implemented, incomplete set coverage | Catalog `/13` has 85 definitions; the prepared set audit currently needs 121 distinct leaf design identities and first reaches missing design `28802` at printed step 26. |
| Connectors | Port compatibility implemented; wire semantics partial | Ten port kinds and six compatibility rules exist, while serialized edges and attach programs still carry only `stud-tube` and infer the exact port pair from references. |
| Rendering | Implemented | Twenty-four definitions use bundled source-derived mesh surfaces with pinned transforms and normals; large models are not instanced, and exterior render equality does not prove hidden interiors or physical collision. |
| Part visual admission | Harness and `/13` exterior review implemented | Capture and separate review bind eight matched views, source closure, cameras, production geometry, hashes, metrics, and explicit outcomes. Hidden interiors still need an interior, cutaway, or other independent witness. |
| Physical geometry | Conservative and deterministic | Render-only promotions deliberately preserve their preceding collision recipes. Those recipes are suitable for current placement checks but are not exact hollow-interior solids. |
| LDraw interchange | Implemented for a bounded subset | Unsupported parts, transforms, references, and semantics must be refused or preserved explicitly; a text round trip does not prove acceptance by another consumer. |
| Booklet PDF in the studio | Ingestion only | Page-to-build-step interpretation is explicitly unimplemented in the UI. |
| Reader and action ledger | Experimental local tooling | The prepared 359-step ledger reconciles booklet sequence and callouts, but its ignored input chain is not a product service. |
| Transition labels | Experimental, raster-blind | The current classifier does not inspect pixels, so its label is not visual proof of a change. |
| Placement and panel scoring | Experimental, partial | Candidate enumeration and deterministic rendering work on a short prefix; a standalone probe measured farther-panel feasibility, but the current deferral examines at most N+1 and has no integrated branch-aware farther-panel search. |
| Multi-panel model checker | Quarantined contract and adapter | A source-bound N/N+1/conditional-K refusal-only checker passes mocked adversarial tests, but it has no PDF-crop producer, consent preflight, driver consumer, or successful live verdict. |
| Partial-run evidence | Implemented locally | Completion and refusal rows survive failed runs, but local bundles are unauthenticated diagnostics and detected source drift prevents finalization rather than diagnostic publication. |
| Replay | Inspection only | Closure bytes and downstream records can be checked; executable and production-sealed replay are unbuilt. |
| Backtracking | Library and tests only | `BuildTree` and `runBacktrackingSearch` exist, but the booklet driver does not use them. |
| Physics | Kernel and development session implemented | Rigid components, articulated joints, compound bodies, Rapier integration, and a cart demo exist; simulation, pose controls, inertia, and incremental rebuild are not complete user workflows. |
| Companion and evaluator | Libraries/specification only | There is no production broker, signing service, credential proxy, independent evaluator, or autonomous promotion path. |

## Measured booklet frontier

These are measured facts with explicit limits, not a completed-build claim.

| Measure | Current result | Interpretation |
| --- | --- | --- |
| Printed sequence | 359 of 359 steps read | Sequence coverage is complete for the prepared booklet. |
| Set accounting | 1,464 assembled pieces; 1,465 inventory pieces | The extra `31510` separator is inventory that the instructions never place. |
| Catalog | 85 definitions at `/13` | 61 render parametrically; 16 use source meshes with preserved physical truth; 8 use fully measured mesh definitions. |
| Part standard | 85 passing; 0 failures | `parts:check` is green and included in `verify`. |
| `/13` visual admission | 24 parts; 192 of 192 visible pairs reviewed `same` | 181 pairs are RGBA-exact; the 11 measured deltas are visually unobservable at native size. Hidden interiors and physical collision remain outside the claim. |
| Prepared coverage | Through printed step 25 | Printed step 26 first requires missing design `28802`; later counts move when identification closure changes. |
| Latest `/13` diagnostic request | Steps 1 through 7 | It completed four rows and placed six pieces before step 5 refused; later rows were blocked. |
| Step 4 | Settled in a source-stable diagnostic | Exact underside surfaces let the own-panel scorer settle both additions with joint visual score `0.8578158458`; retained panel and build images were inspected together. |
| Step 5 local separation | `0.002799` margin | The leading own-panel candidates are closer than the registered `0.01` minimum. |
| Step 5 through panel 6 | Best agreement `0.7635021805` | That is below the registered `0.85` agreement threshold even though it separates the top two branches; panel 6 occludes the disputed region. |
| First visually revealing later panel | Printed step 7 | Direct PDF inspection shows the region again, but the runner cannot yet evaluate it without honestly constructing intervening step 6 for every surviving branch. |
| Standalone step-7 probe | 2 step-5 parents, 9 step-6 children | Step 7 rejects all five children under one parent and retains four under the other, but 8,609 narrowing renders exceed the 8,192 global budget and the best two surviving children remain only `0.005712` apart against a `0.02` margin. |
| Defensible verified prefix | Four printed steps | The source-stable `/13` replay completed and validated steps 1 through 4; step 5 remains an evidence refusal rather than an inferred placement. |
| Completion | Unavailable | Farther-panel lineage, backtracking, world-frame reconciliation, and the final visual audit are incomplete. |

## What the current refusal means

Booklet page 11 draws printed step 4 from below and visibly exposes hollow clutch rings, ribs, walls, and cavities. Catalog `/13` now renders those source surfaces instead of the former dark slab while preserving established connector and collision truth. This closes the rendering defect; it does not turn conservative collision into an exact interior model.

Panel N+1 is the minimum later witness for a placement at N, not a guarantee that the placement is observable. Step 6 is the concrete counterexample: it turns the model over and adds pieces that hide the disputed step-5 region, while step 7 reveals that region again. A correct farther-panel implementation must retain each step-5 branch, construct every intervening step without using official transforms as an oracle, compare the resulting candidates against the first revealing later panel, and record `not-observable` if bounded search cannot produce a trustworthy witness.

The existing single-panel placement reader cannot repair this gap. It can request same-step anchors that its consumer rejects, parse fields the consumer ignores, and narrow away settled truth; its inputs are not bound into the real-build run. The quarantined multi-panel checker improves transport and evidence contracts, but until a consent-checked producer and deterministic driver consumer exist it cannot certify or mutate a build.

The driver also cannot claim overall completion after placement alone. Its transform audit and official model use different world frames, and the required final Node-side visual audit is unimplemented.

## Ordered work

1. Add interior or cutaway evidence wherever the completed exterior packet leaves a claimed cavity hidden; keep every unseen claim `not-observable` meanwhile.
2. Integrate the standalone farther-frontier and aggregate-budget primitives into a branch-aware driver path: retain every N candidate, carry it through intervening steps, select the first revealing panel, and refuse rather than multiplying a per-parent allowance. The measured step-5/6 case must either fit the declared 8,192-render budget or change that budget through a separately justified policy revision.
3. Build the scoped consent-checking producer for the quarantined checker, prove each crop against its PDF page and bounds, bind deterministic face state and candidate renders, then integrate only refusal or backtracking consequences after preregistered counterexamples pass.
4. Integrate immutable candidate lineage and deep backtracking into the booklet driver and publish reversal depth.
5. Reconcile driver and official-ledger world frames and implement the Node-side final visual audit.
6. Regenerate identification and coverage, admit `28802`, and continue adding required designs with provenance, connectors, collision, migration, palette coverage, and visual admission.
7. Move the proven reader, placement, evidence, and playback path behind a user-facing booklet workflow while keeping manual editing available offline.
8. Build the separately released broker, executable replay boundary, and independent evaluator only after the local loop produces evidence worth sealing.

## Manual-editor work beyond the booklet frontier

The editor still needs multi-selection, grouping and submodel authoring, richer build-step editing, user-facing articulated pose controls, and simulation controls.

A complete 1,465-piece model also needs measured rendering and interaction work. The current renderer creates groups, bodies, studs, and instruction outlines per part; connector indexing, instancing, incremental rebuild, and profiling should be driven by real frame-time and memory measurements.

## Evidence rule

Every frontier change records the exact requested prefix, catalog version, input closure, completed and verified step counts, piece count, refusal code, score or margin, and the images that make the number interpretable. For each settled step N, retain its own panel, panel N+1, and the first farther panel that reveals an otherwise occluded or ambiguous placement; record hidden or unavailable claims as `not-observable`.

Raw runs stay under ignored `output/` and `var/runs/`. Stable conclusions live here, failed approaches and historical hashes live in the devlog, and promoted failures become tests or fixtures.
