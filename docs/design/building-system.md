# Building system: current assessment and ordered work

Status date: 2026-08-10

This document is the current position of the editor and printed-booklet build system. [`spec.md`](spec.md) owns the target product and domain contracts, [`learning-system.md`](learning-system.md) owns run evidence and replay, [`part-model.md`](part-model.md) owns catalog truth, and the [devlog](../devlog/summary.md) owns history.

## Executive status

The offline manual editor is usable today. It persists local projects in IndexedDB, renders the versioned `BrickDocument`, validates edits, imports and exports the supported LDraw subset, and plays authored build steps.

The printed-booklet loop is experimental tooling, not a studio workflow. The web UI can load and fingerprint an instruction PDF, but it does not interpret its pages into build steps. The working reader and placement driver run through opt-in Playwright and local derivation scripts; see the [real-build runbook](../runbooks/real-build.md).

The latest retained placement run predates the `/12` render correction and requested printed steps 1 through 7. The driver completed five steps and placed eight pieces, then refused step 6 because its best two candidates were visually indistinguishable. That is an incomplete diagnostic run, not a completed build and not a final structural-hash claim.

Only the first three printed steps are presently verified in the stronger sense required by the product. Catalog `/12` now gives the four definitions implicated by the first underside witness exact LDraw render surfaces, but steps 4 and 5 remain provisional until the retained prefix is rerun against those pixels; their preserved conservative collision is a separate unresolved physical approximation.

## Capability matrix

| Area | Current state | Important limit |
| --- | --- | --- |
| Manual editor | Implemented | Selection and authoring remain primarily single-part; grouping, submodel authoring, and richer step management are not complete UI workflows. |
| Projects | Implemented | Projects and automatic saves are browser-local IndexedDB state. There is no production sync service. |
| Catalog and palette | Implemented, incomplete coverage | The builtin catalog is `builtin.basic-parts/12` with 85 definitions. That count is not the set-coverage denominator. |
| Connectors | Port taxonomy and placement compatibility implemented; wire semantics partial | Ten port kinds and six compatibility rules cover stud/clutch, axle, pin, bar/clip, and hinge pairs. Connection edges and attach programs still serialize only `stud-tube`, with the specific pair inferred from referenced ports. |
| Rendering | Implemented | Four first-witness parts now use exact LDraw surfaces; twelve catalog parts still draw false flat undersides, and large models are not instanced. |
| LDraw interchange | Implemented for a bounded subset | Unsupported parts, transforms, references, and semantics must be refused or preserved explicitly; a text round trip alone does not prove an external consumer accepts the model. |
| Booklet PDF in the studio | Ingestion only | The UI reads metadata and a digest, then states that page-to-build-step interpretation is not implemented. |
| Booklet reader and action ledger | Experimental, implemented in local tooling | It depends on prepared ignored inputs and is not an integrated product service. |
| Transition classification | Experimental, raster-blind | The current classifier does not inspect panel pixels, so its label is not visual evidence that a step changed as claimed. |
| Placement and panel scoring | Experimental, partial | Candidate enumeration and deterministic pixel scoring work on a short prefix; the current run stops at printed step 6. |
| Partial-run evidence | Implemented locally | Completed and refusal rows survive an incomplete run, but the bundles are unauthenticated local diagnostics. |
| Replay | Inspection only | Closure bytes and downstream results can be verified; executable replay and production-sealed replay are unbuilt. |
| Backtracking | Library and tests only | `BuildTree` and `runBacktrackingSearch` exist, but the real-booklet driver does not use them. |
| Physics | Kernel and development session implemented | Rigid-component derivation, articulated joints, compound bodies, Rapier integration, and a cart demo exist; user-facing simulation and pose controls, inertia, and incremental rebuild do not. |
| Companion | Library and test namespace only | The content-addressed store, recorder, and test ledger exist. There is no serving, signing, credential-proxying production broker. |
| Model assistance | Local derivation tooling only | Pinned CLI scripts can classify cropped part art or describe one cropped step image's placement relations. The panel record does not retain its exact input image or receive a candidate render or later-panel witness; ignored readings are not wired into the driver and can discard the settled truth. Panel verification is deterministic; no integrated broker-backed checker exists. |
| Independent evaluator and promotion service | Specified, unbuilt | No production authority, seal, automatic acceptance, or autonomous code-promotion path exists. |

## Measured booklet frontier

These are retained measurements, not product claims.

| Measure | Current retained result | Interpretation |
| --- | --- | --- |
| Printed sequence | 359 of 359 steps read | Sequence coverage is complete for the prepared booklet. |
| Set accounting | 1,464 assembled pieces; 1,465 inventory pieces | The one-piece difference is the loose `31510` separator, which the instructions never place. |
| Catalog | 85 total definitions at `/12` | Of 12 exact LDraw render surfaces, four are render-only promotions with preserved connector and collision arrays; the set audit tracks 121 distinct required leaf design identities, a separate denominator. |
| Contiguous prepared coverage | Through printed step 25 | Printed step 26 first needs missing design `28802`; unidentified callouts mean the longer-range count must be regenerated when the identification closure changes. |
| Driver prefix | Five completed rows; eight pieces | The request ran through step 7 but stopped while resolving step 6. |
| Defensible verified prefix | Three printed steps | The step-4 render blocker is corrected in `/12`, but steps 4 and 5 have not been rerun and cannot inherit verification from the old evidence. |
| Step 6 decision | `0.88369` versus `0.88042` | The `0.00327` margin is below the registered `0.02` noise floor, so the driver correctly reports `ambiguous-deferred-placement`. |
| Completion | Unavailable | The run is incomplete, its world frame is not reconciled with the official ledger, and no Node-side visual audit can issue the required visual claim. |

The catalog standard currently fails twelve parts, all under `underside-is-drawn`. `npm run parts:check` is therefore red and is not included in `npm run verify`; this is a known release-gate gap, not a passing exception.

## What the current refusal means

Booklet PDF page 11, which draws printed step 4 from below, visibly contains hollow clutch rings, ribs, perimeter and inner walls, and cavities. The former render was an almost solid slab. Definitions `30503`, `6106`, `30565`, and `80015` now draw exact LDraw surfaces, but their connectors and conservative collision remain unchanged; this fixes the visible comparison, not hollow collision truth.

Printed step 6 has two whole-step candidates that both explain the next retained panel well enough, but the registration cannot separate them above its own noise. Picking the slightly larger score would manufacture certainty.

Panel N+1 is the minimum later witness for a placement made at step N, not a guarantee. When it occludes the placement or remains ambiguous, the target evidence packet continues to the first farther panel that actually reveals it; if no retained panel does, that surface or relation is `not-observable`, not silently accepted. The current runner invokes deferral only when the step's own panel has no usable score or cannot separate its top two candidates, tests exactly the first later panel, and is hard-capped at one step; it neither scans for a revealing farther panel nor records `not-observable`.

The current transition classifier is raster-blind, the retained vision inputs are not an integrated checker and may narrow away the settled truth, and the driver does not use the available backtracking library. None of those paths can presently turn a safe candidate set into a visual correctness claim or recover from a later contradiction.

The driver also cannot claim overall completion after placement alone. Its transform audit and the official model use different world frames, and the final visual-evidence check has no Node-side implementation. Those are independent completion blockers.

## Ordered work

1. Rerun the retained prefix under `/12` and re-establish steps 4 and 5 from bound N and N+1 evidence, adding the first revealing farther panel when N+1 occludes the placement or remains ambiguous.
2. Produce reproducible source-versus-render packets for all four `/12` promotions, including `80015`, with clean top, bottom, front, back, left, right, isometric, and underside-oblique images, hashes, camera policy, and review outcomes; give all twelve remaining failures exact LDraw render surfaces while preserving their current connector, allowance, and collision values; add matched-view regressions; make `npm run parts:check` pass; and include it in the authoritative verification gate.
3. Replace or augment raster-blind transition labels with bound visual evidence. Bind any placement-proposer crop to its PDF, page, bounds, exact bytes, prompt, model response, candidate render, deterministic face record, panel N+1, and first revealing farther panel, then prove that narrowing retains the settled truth on preregistered counterexamples.
4. Calibrate farther-panel deferral on preregistered panels, then test whether the first revealing panel separates step 6 without an oracle.
5. Integrate immutable lineage and deep backtracking into the real-booklet driver and publish reversal depth.
6. Reconcile the driver and official-ledger world frames, and add the Node-side visual audit required for a completed status.
7. Regenerate identification and coverage, admit `28802`, and continue adding every newly required design with provenance, connectors, collision, migration, and palette coverage.
8. Move the proven reader, placement, evidence, and playback path behind a user-facing booklet workflow while keeping manual editing available offline.
9. Build the separately released broker, executable replay boundary, and independent evaluator only when the local loop has evidence worth sealing.

## Manual-editor work beyond the booklet blocker

The editor still needs multi-selection, grouping and submodel authoring, richer build-step editing, user-facing articulated pose controls, and simulation controls.

A complete 1,465-piece model will also require measured rendering and interaction work. The current renderer creates groups, body meshes, studs, and instruction outlines per part; connector indexing, instancing, incremental scene rebuild, and profiling should be driven by real frame-time and memory measurements rather than assumed limits.

## Evidence rule

Every change to the booklet frontier must record the exact requested prefix, catalog version, input closure, completed and verified step counts, piece count, refusal code, score or margin, and the images that make the number interpretable. For each settled step N, retain its own panel, panel N+1, and the first farther panel that actually reveals an otherwise occluded or ambiguous placement; record hidden or unavailable claims as `not-observable`.

Raw runs stay under ignored `output/` and `var/runs/` paths. Stable conclusions live here, failed approaches and historical hashes live in the devlog, and promoted failures become tests or fixtures.
