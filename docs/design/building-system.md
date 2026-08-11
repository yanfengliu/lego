# Building system: current assessment and ordered work

Status date: 2026-08-10

This document is the current position of the editor and printed-booklet build system. [`spec.md`](spec.md) owns the target product and domain contracts, [`learning-system.md`](learning-system.md) owns run evidence and replay, [`part-model.md`](part-model.md) owns catalog truth, and the [devlog](../devlog/summary.md) owns history.

## Executive status

The offline manual editor is usable today. It persists local projects in IndexedDB, renders the versioned `BrickDocument`, validates edits, imports and exports the supported LDraw subset, and plays authored build steps.

The printed-booklet loop is experimental tooling, not a studio workflow. The web UI can load and fingerprint an instruction PDF, but it does not interpret its pages into build steps. The working reader and placement driver run through opt-in Playwright and local derivation scripts; see the [real-build runbook](../runbooks/real-build.md).

The latest retained real-booklet prefix requested printed steps 1 through 7. The driver completed five steps and placed eight pieces, then refused step 6 because its best two candidates were visually indistinguishable. That is an incomplete diagnostic run, not a completed build and not a final structural-hash claim.

Only the first three printed steps are presently verified in the stronger sense required by the product. Steps 4 and 5 are provisional because the underside panel used to judge that prefix is being compared against flat placeholder undersides on parts that fail the catalog's visual standard.

## Capability matrix

| Area | Current state | Important limit |
| --- | --- | --- |
| Manual editor | Implemented | Selection and authoring remain primarily single-part; grouping, submodel authoring, and richer step management are not complete UI workflows. |
| Projects | Implemented | Projects and automatic saves are browser-local IndexedDB state. There is no production sync service. |
| Catalog and palette | Implemented, incomplete coverage | The builtin catalog is `builtin.basic-parts/11` with 85 definitions. That count is not the set-coverage denominator. |
| Connectors | Port taxonomy and placement compatibility implemented; wire semantics partial | Ten port kinds and six compatibility rules cover stud/clutch, axle, pin, bar/clip, and hinge pairs. Connection edges and attach programs still serialize only `stud-tube`, with the specific pair inferred from referenced ports. |
| Rendering | Implemented | Canonical captures and instruction-style rendering exist, but sixteen catalog parts still draw false flat undersides and large models are not instanced. |
| LDraw interchange | Implemented for a bounded subset | Unsupported parts, transforms, references, and semantics must be refused or preserved explicitly; a text round trip alone does not prove an external consumer accepts the model. |
| Booklet PDF in the studio | Ingestion only | The UI reads metadata and a digest, then states that page-to-build-step interpretation is not implemented. |
| Booklet reader and action ledger | Experimental, implemented in local tooling | It depends on prepared ignored inputs and is not an integrated product service. |
| Placement and panel scoring | Experimental, partial | Candidate enumeration and deterministic pixel scoring work on a short prefix; the current run stops at printed step 6. |
| Partial-run evidence | Implemented locally | Completed and refusal rows survive an incomplete run, but the bundles are unauthenticated local diagnostics. |
| Replay | Inspection only | Closure bytes and downstream results can be verified; executable replay and production-sealed replay are unbuilt. |
| Backtracking | Library and tests only | `BuildTree` and `runBacktrackingSearch` exist, but the real-booklet driver does not use them. |
| Physics | Kernel and development session implemented | Rigid-component derivation, articulated joints, compound bodies, Rapier integration, and a cart demo exist; user-facing simulation and pose controls, inertia, and incremental rebuild do not. |
| Companion | Library and test namespace only | The content-addressed store, recorder, and test ledger exist. There is no serving, signing, credential-proxying production broker. |
| Model assistance | Local derivation tooling only | A pinned CLI proposer can classify cropped part art and retained blind-pair verdicts are consumed as evidence. Panel verification is deterministic; no integrated broker-backed checker exists. |
| Independent evaluator and promotion service | Specified, unbuilt | No production authority, seal, automatic acceptance, or autonomous code-promotion path exists. |

## Measured booklet frontier

These are retained measurements, not product claims.

| Measure | Current retained result | Interpretation |
| --- | --- | --- |
| Printed sequence | 359 of 359 steps read | Sequence coverage is complete for the prepared booklet. |
| Set accounting | 1,464 assembled pieces; 1,465 inventory pieces | The one-piece difference is the loose `31510` separator, which the instructions never place. |
| Catalog | 85 total definitions at `/11` | The set audit tracks 121 distinct required leaf design identities, a separate denominator. |
| Contiguous prepared coverage | Through printed step 25 | Printed step 26 first needs missing design `28802`; unidentified callouts mean the longer-range count must be regenerated when the identification closure changes. |
| Driver prefix | Five completed rows; eight pieces | The request ran through step 7 but stopped while resolving step 6. |
| Defensible verified prefix | Three printed steps | Steps 4 and 5 depend on underside pixels the current catalog does not draw truthfully. |
| Step 6 decision | `0.88369` versus `0.88042` | The `0.00327` margin is below the registered `0.02` noise floor, so the driver correctly reports `ambiguous-deferred-placement`. |
| Completion | Unavailable | The run is incomplete, its world frame is not reconciled with the official ledger, and no Node-side visual audit can issue the required visual claim. |

The catalog standard currently fails sixteen parts, all under `underside-is-drawn`. `npm run parts:check` is therefore red and is not included in `npm run verify`; this is a known release-gate gap, not a passing exception.

## What the current refusal means

Printed step 6 has two whole-step candidates that both explain the next retained panel well enough, but the registration cannot separate them above its own noise. Picking the slightly larger score would manufacture certainty.

The next useful witness is a farther printed panel, but lookahead reach two has not been calibrated. That experiment must follow the underside repair: otherwise it would optimize a decision procedure against renders already known to describe the wrong geometry.

The driver also cannot claim overall completion after placement alone. Its transform audit and the official model use different world frames, and the final visual-evidence check has no Node-side implementation. Those are independent completion blockers.

## Ordered work

1. Draw truthful undersides for the sixteen failing catalog parts, add from-below regressions, make `npm run parts:check` pass, and include it in the authoritative verification gate.
2. Rerun the retained prefix and re-establish which of steps 4 and 5 remain settled when the pixels describe real cavities, walls, and tubes.
3. Calibrate reach-two deferral on preregistered panels and counterexamples, then use it to ask whether a later panel separates step 6 without an oracle.
4. Integrate immutable lineage and deep backtracking into the real-booklet driver and publish reversal depth.
5. Reconcile the driver and official-ledger world frames, and add the Node-side visual audit required for a completed status.
6. Regenerate identification and coverage, admit `28802`, and continue adding every newly required design with provenance, connectors, collision, migration, and palette coverage.
7. Move the proven reader, placement, evidence, and playback path behind a user-facing booklet workflow while keeping manual editing available offline.
8. Build the separately released broker, executable replay boundary, and independent evaluator only when the local loop has evidence worth sealing.

## Manual-editor work beyond the booklet blocker

The editor still needs multi-selection, grouping and submodel authoring, richer build-step editing, user-facing articulated pose controls, and simulation controls.

A complete 1,465-piece model will also require measured rendering and interaction work. The current renderer creates groups, body meshes, studs, and instruction outlines per part; connector indexing, instancing, incremental scene rebuild, and profiling should be driven by real frame-time and memory measurements rather than assumed limits.

## Evidence rule

Every change to the booklet frontier must record the exact requested prefix, catalog version, input closure, completed and verified step counts, piece count, refusal code, score or margin, and the images that make the number interpretable.

Raw runs stay under ignored `output/` and `var/runs/` paths. Stable conclusions live here, failed approaches and historical hashes live in the devlog, and promoted failures become tests or fixtures.
