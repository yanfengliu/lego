# Building system: current assessment and ordered work

Status date: 2026-08-12

This document is the current position of the editor and printed-booklet build system. [`spec.md`](spec.md) owns product, domain, and authority contracts; [`learning-system.md`](learning-system.md) owns run evidence and replay; [`part-model.md`](part-model.md) owns catalog truth; and the [devlog](../devlog/summary.md) owns history.

## Executive status

The offline manual editor is usable today. It stores local projects in IndexedDB, renders and validates the versioned `BrickDocument`, imports and exports the supported LDraw subset, and plays authored build steps.

The studio can ingest an instruction PDF, retain bounded page and text metadata, and fingerprint it, but it does not turn pages into build steps. The reader, action-ledger generator, placement search, and scoring loop remain opt-in local tooling driven through Playwright and scripts; see the [real-build runbook](../runbooks/real-build.md).

Catalog `/13` has 85 definitions: 61 use parametric rendering and 24 use bundled LDraw meshes. Sixteen mesh definitions are render-only promotions that preserve their preceding connector, allowance, and collision truth; eight are fully measured definitions. `npm run parts:check` passes all 85 definitions and is part of `npm run verify`.

Catalog `/13` has a complete native-resolution exterior review; [`part-model.md`](part-model.md#current-catalog) owns the exact review hash and pixel measurements. The result certifies only surfaces exposed by the eight views, and the earlier downsampled contact-sheet attempt remains counterevidence rather than admission.

The current measured `/13` run is `2026-08-12T10-28-52-560Z-34694c87c62e-26128a38-4d9e-4294-9091-6aae9b3ca367`, an unauthenticated, incomplete diagnostic published under artifact-manifest `/3`, score `/4`, and replay-closure `/3`. The exact source- and data-attested step-5 shortcut reproduced scores `0.81657223796034` and `0.9367520589707421`, selected the second origin at `sha256:47ae3d353885f5de11b685a4bec4ca1132554a19e1f1e30454281252f7d64c93`, and produced an eight-piece browser candidate through step 5. Step 6 then retained four unseparated origins; the step-7 carry expanded three parents for 2,218 + 2,169 + 3,650 = 8,037 narrowing renders and retained eight immutable lineages before the next 599-render request was refused because 8,037 + 599 exceeds 8,192. No partial frontier was admitted, and step 7 remained blocked.

The current pointer binds replay-closure digest `sha256:1c27df8a95c655f7508436489e8e31f486f806c7a5382df76d53e0a80801a66c` and artifact-manifest digest `sha256:4dc5ce021e03ba0bc86667a64a1948f9ad54d2d80f95eb887b559a593c7036aa`. The score file is `sha256:cbdf5b5502448011356b7fdb15f655734e97021853a45f41d64f63fd3f9e042e`; `diagnostic-prefix.json` is `sha256:2edf84fbf1eab57e86cd2670f9bdb5e60a7ac33dbda454f22d9c9a85cbf8b70f`. Run `2026-08-12T09-14-05-246Z-32668097b507-2989d382-2a93-470c-aadb-14d91107a904` remains an immutable artifact-manifest `/2`, score `/3` historical predecessor but is superseded for current verification by the new run.

The Node semantic audit proved that the retained eight-part candidate is not the official target under any proper upright yaw plus translation. Steps 1 and 2 have one proper fit at yaw 90 degrees and zero translation; the first instance-level divergence is the step-3 design `6106`, and all eight retained positions and their contact graph instead follow one global x reflection. A separate reflected-mesh comparison already finds the renderer geometry non-invariant by step 2. The search result is therefore a structurally valid diagnostic prefix, not canonical completion: canonical `finalParts`, `structuralHash`, and document remain zero, null, and null, while `diagnostic-prefix.json` retains the exact Node-audited candidate with eight parts, 30 connections, `throughStepNumber: 5`, structural hash `sha256:47ae3d353885f5de11b685a4bec4ca1132554a19e1f1e30454281252f7d64c93`, and `targetEquivalence: "unreconciled"`.

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
| Placement and panel scoring | Experimental, partial | Candidate enumeration, deterministic scoring, and a bounded branch-aware N/N+1/conditional-K path run on the real-booklet driver; one exact attested step-5 shortcut scores its two known origins directly at K, while the generic path still carries the intervening step and refuses on shared aggregate budgets. |
| Multi-panel model checker | Quarantined contract and adapter | A source-bound N/N+1/conditional-K refusal-only checker passes mocked adversarial tests, but it has no PDF-crop producer, consent preflight, driver consumer, or successful live verdict. |
| Partial-run evidence | Implemented locally | Completion, immutable farther lineages, exact source/candidate captures, aggregate budget use, typed refusal rows, and an unreconciled diagnostic prefix survive failed runs, but local bundles are unauthenticated diagnostics and detected source drift prevents finalization rather than diagnostic publication. |
| Replay | Inspection only | Manifest `/3` and score `/4` can rebind `diagnostic-prefix.json` separately from canonical output; executable and production-sealed replay are unbuilt. |
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
| Latest `/13` diagnostic request | Steps 1 through 7 | The browser completed five rows and placed eight pieces; step 6 refused at the 8,192-render aggregate narrowing ceiling and step 7 was blocked. |
| Step 4 | Settled in a source-stable diagnostic | Exact underside surfaces let the own-panel scorer settle both additions with joint visual score `0.8578158458`; retained panel and build images were inspected together. |
| Step 5 local separation | `0.002799` margin | The leading own-panel candidates are closer than the registered `0.01` minimum. |
| Step 5 through panel 6 | Agreements `0.600683` and `0.763502` | The best is below the registered `0.85` agreement threshold; retained images confirm that panel 6 occludes the disputed relation. |
| Exact calibrated step-5 K | `0.81657223796034` versus `0.9367520589707421` | Source- and data-attested direct scoring of the exact two origins at panel 7 selected the second by `0.12017982101040214`; this shortcut is not generic carry. |
| Step 6 after origin selection | Four unseparated step-6 origins | The next-step carry expanded three parents and retained eight lineages after 2,218 + 2,169 + 3,650 = 8,037 renders; the next 599-render request refused because it would exceed 8,192, with no partial frontier. |
| Visual-search diagnostic frontier | Five printed steps; eight pieces | Node independently validates and retains the selected candidate as `diagnosticPrefix`, but its target equivalence is explicitly unreconciled. |
| Official proper-frame-equivalent frontier | Two printed steps | A unique yaw-90, zero-translation mapping fits steps 1 and 2; design `6106` first breaks every proper upright mapping at step 3. |
| Canonical completion | Unavailable | Canonical final document, hash, and part count remain null, null, and zero; search handedness, step-6 budget, generic deep backtracking, final visual audit, and the remaining 357 official-frame steps are incomplete. |

## What the current refusal means

Booklet page 11 draws printed step 4 from below and visibly exposes hollow clutch rings, ribs, walls, and cavities. Catalog `/13` now renders those source surfaces instead of the former dark slab while preserving established connector and collision truth. This closes the rendering defect; it does not turn conservative collision into an exact interior model.

Panel N+1 is the minimum later witness for a placement at N, not a guarantee that the placement is observable. Panel 6 is the concrete counterexample for step 5: it hides the disputed relation, while panel 7's underside view reveals it. The calibrated shortcut binds the exact two step-5 origin hashes and atomic piece witnesses, exact prepared steps 5 through 7, exact run options and input digests, and an attested captured source closure before scoring panel 7 directly. Any data or source drift disables the shortcut rather than broadening it into a generic rule.

The retained source panel and both scored candidate renders were inspected together. Their scores select the second origin and advance the visual-search diagnostic to step 5, but that is only a claim about what the registered image comparison prefers. A separate Node semantic audit rejects every upright yaw-plus-translation fit after step 2: the retained eight-part state is related to the official ledger by a global x reflection, which preserves its contact graph but is not a legal world rotation. Official transforms are used only after selection for this audit; feeding them into enumeration or scoring would make the evaluator choose its own answer.

This has the same broad handedness shape as the historical Builder basis failure, but it is not evidence that the repaired Builder calibration regressed. The retained official inputs and searched document each survive their own bindings; the unresolved defect is the shared visual/search camera-world frame, which can make reflected placements look coherent to the scorer. Canonical output therefore stays empty while `diagnosticPrefix` preserves the exact structurally valid counterexample without relabeling it as the target.

After selecting the step-5 origin, step 6 retains four unseparated candidates. The step-7 carry expands three of those parents for 2,218, 2,169, and 3,650 narrowing renders, retains eight immutable lineages at aggregate 8,037, then refuses the fourth parent's next 599-render request before work because 8,037 + 599 exceeds the fixed 8,192 limit. No partial frontier enters the document, and fixing handedness does not authorize raising that budget.

The existing single-panel placement reader cannot repair this gap. It can request same-step anchors that its consumer rejects, parse fields the consumer ignores, and narrow away settled truth; its inputs are not bound into the real-build run. The quarantined multi-panel checker improves transport and evidence contracts, but until a consent-checked producer and deterministic driver consumer exist it cannot certify or mutate a build.

The driver also cannot claim overall completion after placement alone. The one-off proper-frame semantic audit names reflection as a target-equivalence failure, but the production path still needs that audit made reproducible, the search camera/world frame remains wrong, and the required final Node-side visual audit is unimplemented.

## Ordered work

1. Implement the post-hoc proper-frame target-equivalence audit for every retained prefix and resolve the visual/search camera-world handedness that first diverges from the official ledger at step 3; never normalize a reflection into canonical output.
2. Move ordinary step-6 narrowing within the fixed 8,192-render budget through semantics-preserving pruning, deduplication or reuse; do not admit a partial frontier or raise the budget to fit the observation.
3. Add interior or cutaway evidence wherever the completed exterior packet leaves a claimed cavity hidden; keep every unseen claim `not-observable` meanwhile.
4. Build the scoped consent-checking producer for the quarantined checker, prove each crop against its PDF page and bounds, bind deterministic face state and candidate renders, then integrate only refusal or backtracking consequences after preregistered counterexamples pass.
5. Generalize the measured one-intervening-step path into immutable deep backtracking and publish reversal depth; the current farther carry is not that generic search.
6. Implement the final Node-side visual audit after the search frame is reconciled.
7. Regenerate identification and coverage, admit `28802`, and continue adding required designs with provenance, connectors, collision, migration, palette coverage, and visual admission.
8. Move the proven reader, placement, evidence, and playback path behind a user-facing booklet workflow while keeping manual editing available offline.
9. Build the separately released broker, executable replay boundary, and independent evaluator only after the local loop produces evidence worth sealing.

## Manual-editor work beyond the booklet frontier

The editor still needs multi-selection, grouping and submodel authoring, richer build-step editing, user-facing articulated pose controls, and simulation controls.

A complete 1,465-piece model also needs measured rendering and interaction work. The current renderer creates groups, bodies, studs, and instruction outlines per part; connector indexing, instancing, incremental rebuild, and profiling should be driven by real frame-time and memory measurements.

## Evidence rule

Every frontier change records the exact requested prefix, catalog version, input closure, completed and verified step counts, piece count, refusal code, score or margin, and the images that make the number interpretable. For each deferred step N, retain immutable parent and descendant lineages, exact source and scored-candidate captures, shared budget reservations, and family-only decisions that leave ambiguous descendants unresolved; retain panel N+1 and the first farther panel reached within policy, and record hidden or unavailable claims as `not-observable`. Report visual-search progress, proper-frame target equivalence, and canonical completion as three separate numbers; an unreconciled `diagnosticPrefix` never populates canonical final fields.

Raw runs stay under ignored `output/` and `var/runs/`. Stable conclusions live here, failed approaches and historical hashes live in the devlog, and promoted failures become tests or fixtures.
