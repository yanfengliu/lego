# Real-booklet build runbook

This runbook operates the retained set 6651557 reconstruction. It is developer-only experimental tooling: it does not drive the web studio's **Instructions** control, contact a production companion, or apply a patch to a user's document.

The current measured result and next blocker belong only in [building-system.md](../design/building-system.md). Keep this file about reproducible operation.

## Prerequisites

Run every command from the repository root after completing the [README setup](../../README.md#requirements-and-setup).

The uncommitted, gitignored source booklet must be available as `recipes/6651557.pdf` in this checkout or a parent checkout that the test fixture can discover. Never commit the booklet.

The probe also consumes retained callout, identification, official-model, Builder-geometry, transition, coverage, calibration, compatibility, and action-ledger inputs. Regenerable inputs live under ignored paths; the blind pair-judging truth at `scripts/fixtures/part-identification-truth-first50.json` is a tracked evidence input because it cannot be reconstructed from the booklet alone. Authoritative defaults and override variables are declared in `apps/web/e2e/real-build-input-files.ts`; a missing or stale input is a named refusal, not permission to substitute data.

## Regenerate measured catalog tables

This is a separate authoring chain from the Playwright build inputs below. It needs the two byte-pinned LDraw archives, the pinned LDCad shadow-library checkout, and the private checksum-pinned Builder native pack. Source payloads and derived reports remain ignored; the metadata-only source audit at `packages/catalog/src/quarantine/set-6651557-ldraw-source-audit.generated.json` is the tracked repository input that binds the LDraw closures. The source payloads are pinned by bytes or commit, and each derived report validates and binds the exact inputs it consumes.

Generate the source pilot first, then derive the Builder-to-LDraw frame from that exact pilot:

```powershell
$officialArchive = "C:\tmp\ldraw-complete-2026-07.zip"
$unofficialArchive = "C:\tmp\ldraw-unofficial-2026-08-02.zip"
$nativePack = "C:\tmp\lego-21066-builder-native-part-pack.json"

New-Item -ItemType Directory -Force output/real-build | Out-Null
python -B scripts/generate-set-6651557-source-pilot.py --official $officialArchive --unofficial $unofficialArchive --native-pack $nativePack --source-audit packages/catalog/src/quarantine/set-6651557-ldraw-source-audit.generated.json --output output/real-build/set-6651557-source-pilot.json
python -B scripts/derive-builder-ldraw-frame.py --official $officialArchive --unofficial $unofficialArchive --native-pack $nativePack --pilot output/real-build/set-6651557-source-pilot.json --output output/real-build/set-6651557-builder-ldraw-frame.json
```

Then remeasure, score, canonicalize, and compare the generated catalog outputs. The mesh registry indexes four bounded chunks so no generated source file approaches the 1 MiB text ceiling; the render-only generated type cannot carry connector, allowance, or collision truth. `--check` runs the workspace-pinned Prettier and refuses any byte drift, while report schema `/3` distinguishes full-measured from render-only authority and binds the exact pilot and Builder-frame inputs. [Part-model catalog truth](../design/part-model.md#current-catalog) owns the current `/13` counts, mesh deltas, and migration interpretation.

```powershell
$shadowLibrary = "C:\tmp\ldcad-shadow-20260802"

python -B scripts/emit-measured-part-tables.py --official $officialArchive --unofficial $unofficialArchive --shadow $shadowLibrary --pilot output/real-build/set-6651557-source-pilot.json --builder-frame output/real-build/set-6651557-builder-ldraw-frame.json --report output/real-build/set-6651557-measured-part-emission-check.json --check
```

For an intentional catalog-truth update, run the final command once without `--check`, review all eight generated TypeScript diffs, and rerun it with `--check`. Never hand-edit `mesh-assets-6651557.ts`, its `mesh-assets-6651557-measured-{a,b,c}.ts` and `mesh-assets-6651557-render-only.ts` chunks, `part-blueprints-6651557-measured.ts`, `part-blueprints-6651557-render-only.ts`, or `ldraw-bundled-sources-6651557.ts`.

## Run the retained build

The real build is skipped during ordinary Playwright runs. Set `LEGO_REAL_BUILD_REQUIRED=1` to enable it. `LEGO_REAL_BUILD_LAST_STEP` is optional, defaults to 12, and must be an integer from 1 through 359; choose the range needed for the experiment rather than copying a frontier into this runbook.

```powershell
$env:LEGO_REAL_BUILD_REQUIRED = "1"
$env:LEGO_REAL_BUILD_LAST_STEP = "12"
npx.cmd playwright test apps/web/e2e/real-build.spec.ts
Remove-Item Env:LEGO_REAL_BUILD_REQUIRED -ErrorAction SilentlyContinue
Remove-Item Env:LEGO_REAL_BUILD_LAST_STEP -ErrorAction SilentlyContinue
```

### Panel-camera observation lineage is not yet in the runner

The repository now has a pure `LatticeHand` view transform and `anchorStepCameraLatticeFrame` measurement primitive. It scores four as-fitted quarter turns and four x-reflected quarter turns, retains a separate translation for every hypothesis, and returns `camera-handedness-unresolved` instead of selecting by enumeration order when the best exact score spans both hands. `RealBuildPanelCameraRegistration` validates, copies, and deeply freezes `{latticeHand,latticeDeterminant,registrationPanelStepNumber,turnDegrees,shiftPx}` as panel-local raster evidence and never as physical-transform authority. `resolveRealBuildPanelCameraBranches` detaches and canonicalizes the document, verifies its claimed digest, copies both masks, checks the shared ledger around hash and render callbacks, requires the registering panel to be strictly later than the prefix, and atomically reserves all eight angular branches before admitting any result. Step 0 produces eight unregistered seeds with null observation and shift; a nonempty prefix retains all attempts and successful observations under one hash-bound `candidateId`, unique `lineageId` values, and an explicit `parentLineageId`, while a thrown or malformed render leaves selection null. The arrow boundary derives q0 exactly once from panel-bound fit and raw measurement, then applies the integer D4 transform without reordering the family or changing travel and off-line tolerances. Every result leaves physical-frame authority unresolved.

The retained-build command above still reaches `prepareRunStepCamera` through the proper-only anchor. Runner scoring, reports, farther branch state and lineage, fixed-ledger omissions, and `multi-build-copy` actions do not call the panel-camera resolver or guard, so current run IDs and records remain panel-camera-blind and fixed actions retain their old call path. Running the command therefore does not repair or supersede the current mirrored diagnostic. `executeRealBuildFixedActionWithPhysicalAuthority` is only a fail-closed seam: it returns typed `fixed-ledger-frame-unresolved` for every current decision and intentionally does not read its executor because no trusted producer can mint the required opaque physical-frame authority.

The synthetic chiral regression selects x-reflected turn 90 at shift `[17,-23]` with IoU 1, versus about 0.476 for the best proper-hand hypothesis. A symmetric 2x4 plate reaches IoU 1 in both hands and is refused with all eight attempts retained. These are binary-silhouette measurements only: reflection reverses depth, so they do not establish RGB or occlusion equivalence and do not authorize a physical document branch.

Exercise only that bounded primitive with:

```powershell
npx.cmd vitest run apps/web/src/assembly/panel-face.test.ts apps/web/test/real-build-step-camera.test.ts apps/web/test/real-build-step-camera-handedness.test.ts apps/web/test/real-build-panel-camera-registration.test.ts apps/web/test/real-build-panel-camera-arrow-evidence.test.ts apps/web/test/real-build-panel-camera-branches.test.ts apps/web/test/real-build-panel-camera-resolver.test.ts apps/web/test/real-build-fixed-frame-authority.test.ts
```

The default output root is `output/real-build`. Once artifact-closure verification succeeds, publication writes an immutable run under `<output-root>/runs/<run-id>/` and atomically updates `<output-root>/runs/current.json` even when the retained run result is a failed diagnostic such as `source-drift-detected`; that status prevents finalization, not diagnostic publication. Current publication uses artifact-manifest schema `/3` and score schema `/4`, which distinguish an optional `diagnostic-prefix.json` from canonical `document.json`. An interruption or artifact-verification failure before publication must not replace the pointer. `LEGO_REAL_BUILD_OUT` may redirect the published run only to another traversal-free descendant of `output/`; it does not redirect the retained inputs listed above.

### Read bounded farther-panel evidence

When an own-panel ambiguity survives N+1, the production test driver records the bounded branch proof on the origin row's `farther` field. `origin` retains every step-N candidate with its structural hash, exact atomic piece witnesses, cached N+1 agreement and registration shift; `carries` records every parent-child lineage and intervening-step cost; `panels` records only panels actually scored; `budgets` records shared offered-candidate, narrowing-render, panel-render and reach use plus any refused reservation; and `refusal` or `decision` records the outcome.

The generic rule remains conditional: it may score K only after the complete intervening carry succeeds atomically. One calibrated exception exists for the exact measured step-5 case. It activates only when the two retained origin IDs, their exact piece witnesses, prepared steps 5 through 7, run options, all consumed input digests, and the captured source-closure attestation match the reviewed policy; it then scores those two origins directly at panel 7 after panel 6 remains ambiguous. Any source or data mismatch disables the shortcut, and no caller may use it for another step, origin set, panel sequence, or threshold.

Candidate and narrowing ledgers are shared across all parents. A narrowing reservation precedes its render batch, while a unique complete child is reserved after legal placement proves it exists and before it can enter retained evidence; a refusal retains earlier children as unresolved evidence without admitting a partial frontier, selecting an origin family, scoring conditional K, or changing the settled document. Do not add per-parent allowances together or interpret retained children as placed pieces.

A successful farther decision may select and settle the exact origin document for step N, but that must not be mistaken for settling its intervening descendants. Its `survivingCandidateIds` remain unresolved step-(N+1) alternatives unless a later deterministic step separately settles them; `descendantSettled` stays false whenever more than one survives.

Exact visual evidence is published as dense files named `step-NNN-farther-II-source-panel-panel-KKK.png` and `step-NNN-farther-II-candidate-render-panel-KKK.png`. The parser requires the exact source and scored-candidate ID set, and publication compares each projected path and PNG byte sequence with the browser row before updating `current.json`. An ordinary retained `step-KKK-panel.png` shows that source art was prepared, not that K appears in `farther.panels` or was scored.

Inspect `score.json`, the origin row's farther captures, and the ordinary N/N+1/K panel files together. For the current frontier, [building-system.md](../design/building-system.md#measured-booklet-frontier) records which panel occludes the disputed relation, which later underside view reveals it, what the exact shortcut selected, and why that selection remains diagnostic rather than canonical target completion.

### Read canonical and diagnostic outputs separately

`document.json`, `score.json`'s canonical `structuralHash`, and `finalParts` describe only a finalizer-approved official-target document. After exact report, identity-binding, canonical-part, metadata, step-ownership, and searched-transform checks, finalization exhausts the four proper upright yaws with one global integer-LDU translation. Same-step design/material/catalog/color identities are matched as exact multisets, complete connector/collision/allowance/bounds/flat-render realization must match modulo catalog-proved upright self-symmetry, and official transforms enter only this post-search evaluator. A structurally valid candidate with no surviving proper frame leaves canonical outputs absent, null, and zero; reflection is not permitted frame reconciliation.

For that case, `diagnostic-prefix.json` retains the exact `BrickDocumentV1` candidate separately. Score schema `/4` exposes only the diagnostic summary: schema, through-step number, `targetEquivalence: "unreconciled"`, structural hash, and part count. Artifact-manifest schema `/3` repeats the same summary under `truthSnapshots.diagnosticPrefix`. Verification independently finalizes the retained browser output, reproduces the diagnostic document bytes, validates the document/hash/part/contiguous-step facts, and requires the file, score, and manifest to agree. That closure proves which diagnostic bytes survived, not that they equal the official model.

The target-equivalence audit accepts 1..1,464 unique identity/part rows with safe-integer upright transforms and known catalog definitions. It fails closed on unsupported realization layers and uses an audit-local cache for catalog self-symmetries and definition-plus-relative-transform comparisons. If no proper frame survives, a D4 reflection may be reported only when every origin, connector/collision/allowance/bounds realization, and independently inferred compatible contact matches; exact flat render triangle-and-normal topology is reported separately. An improper diagnostic never changes `targetEquivalence: "unreconciled"` or populates canonical output.

Current verified run `2026-08-12T10-28-52-560Z-34694c87c62e-26128a38-4d9e-4294-9091-6aae9b3ca367` lives under `output/direct-origin-k-production/runs/` and supersedes the prior direct-origin run for current verification. It uses artifact-manifest `/3`, score `/4`, and replay-closure `/3`; `current.json` binds replay digest `sha256:1c27df8a95c655f7508436489e8e31f486f806c7a5382df76d53e0a80801a66c` and artifact-manifest digest `sha256:4dc5ce021e03ba0bc86667a64a1948f9ad54d2d80f95eb887b559a593c7036aa`. The score file is `sha256:cbdf5b5502448011356b7fdb15f655734e97021853a45f41d64f63fd3f9e042e`, and `diagnostic-prefix.json` is `sha256:2edf84fbf1eab57e86cd2670f9bdb5e60a7ac33dbda454f22d9c9a85cbf8b70f`.

Legacy run `2026-08-12T09-14-05-246Z-32668097b507-2989d382-2a93-470c-aadb-14d91107a904` remains an immutable artifact-manifest `/2`, score `/3` historical predecessor. It records the same direct-origin panel-7 scores but predates `diagnostic-prefix.json`; preserve it as history and do not reinterpret it under the current schemas.

## Regenerate catalog-derived inputs

Use the chain entry point instead of rebuilding later artifacts by hand. It preserves this order:

1. Validate the reviewed Builder source pins in `apps/web/e2e/real-build-builder-sources.ts`; the command refuses and changes nothing if those source pins are stale.
2. Rebuild `output/real-build/catalog-coverage.json` only when `LEGO_REAL_BUILD_REGENERATE_COVERAGE=1` is also set.
3. Rebuild `output/real-build/builder-canonical-calibration.json`.
4. Rebuild `output/real-build/action-ledger.json` against the coverage, calibration, transition classifications, and official model.

If stage 1 refuses, update the reviewed `BUILDER_STEP1_DESIGN_SOURCES` digests in the same catalog-truth change that requires them; do not bypass the refusal or regenerate later stages first.

Set the coverage flag when the catalog, callout manifest, or identification closure changed. Omit it only when the retained coverage is deliberately being reused.

In this chain, `LEGO_REAL_BUILD_LAST_STEP` limits the stage-4 ledger validation. A requested coverage rebuild always compiles all 359 printed steps so the retained coverage remains reusable by longer prefixes.

```powershell
$env:LEGO_REAL_BUILD_REGENERATE_INPUTS = "1"
$env:LEGO_REAL_BUILD_REGENERATE_COVERAGE = "1"
$env:LEGO_REAL_BUILD_LAST_STEP = "12"
npx.cmd playwright test apps/web/e2e/real-build-inputs.spec.ts
Remove-Item Env:LEGO_REAL_BUILD_REGENERATE_INPUTS -ErrorAction SilentlyContinue
Remove-Item Env:LEGO_REAL_BUILD_REGENERATE_COVERAGE -ErrorAction SilentlyContinue
Remove-Item Env:LEGO_REAL_BUILD_LAST_STEP -ErrorAction SilentlyContinue
```

The transition-classification bundle is booklet-derived input to stage 4, not a catalog-derived stage. Republish it first when the booklet or transition classifier changes:

```powershell
$env:LEGO_REAL_BUILD_PUBLISH_TRANSITIONS = "1"
npx.cmd playwright test apps/web/e2e/real-build-transitions.spec.ts
Remove-Item Env:LEGO_REAL_BUILD_PUBLISH_TRANSITIONS -ErrorAction SilentlyContinue
```

For a ledger-only rebuild, after proving stages 1 through 3 and the transition bundle are current:

```powershell
$env:LEGO_REAL_BUILD_PUBLISH_ACTION_LEDGER = "1"
$env:LEGO_REAL_BUILD_LAST_STEP = "12"
npx.cmd playwright test apps/web/e2e/real-build-action-ledger.spec.ts
Remove-Item Env:LEGO_REAL_BUILD_PUBLISH_ACTION_LEDGER -ErrorAction SilentlyContinue
Remove-Item Env:LEGO_REAL_BUILD_LAST_STEP -ErrorAction SilentlyContinue
```

Prefer the ordered chain whenever catalog-derived input may have moved.

## Run the separate panel-placement probe

The panel-placement vision probe is not part of the real-build input chain or driver. Its current source images are unbound ignored inputs such as `output/zzz-vision/tight-004.png`; no repository command binds or reproduces them from the PDF, page, and crop bounds. Existing reading digests therefore identify the bytes used but cannot recover them after the mutable image path changes.

The current runner also accepts any resolved local path without source or image validation, grants the pinned Claude CLI repository-wide `Read`, retains the result string but not the tool trace, derives an unretained brief from the fixed `output/real-build/action-ledger.json`, and overwrites `reading-step-NNN.json` on rerun. Run it only after explicit authorization as an opt-in paid diagnostic, never as replay or product evidence:

```powershell
node scripts/panel-placement-run.mjs --steps 4,5 --panels output/zzz-vision --prefix tight --out output/panel-placement
npx.cmd vitest run apps/web/test/panel-reading-booklet.test.ts
```

The source-bound N/N+1/conditional-K checker is a separate quarantined diagnostic, not a replacement for the probe above or an input consumed by the studio or real-build driver. It still has no consent-checking PDF/crop producer and no successful live verdict; do not call its subscription-CLI adapter until that producer exists. [`learning-system.md`](../design/learning-system.md#model-calls-as-evidence) owns its evidence/refusal contract and the [threat model](../design/threat-model.md#current-trust-boundaries) owns its transport and trust boundary.

Exercise only the mocked checker and transport path with:

```powershell
npm run test:vision
```

Green mocked tests prove the local boundary and refusal semantics, not that a provider inspected a booklet image.

The `panel-reading-booklet.test.ts` command applies whatever ignored readings and retained run it finds to the deterministic enumerator; green means the survivors remain enumerated candidates, not that the reading is visually correct or that the settled transform survived. It selects the farthest available score and document independently and only logs `DROPS SETTLED`, so treat it as a diagnostic rather than a safety gate. A reproducible successor must retain immutable source and candidate-render bytes and bind them to PDF/page/bounds, deterministic face, prompt, brief, model response, catalog, base document, action ledger, panel N+1, and, when N+1 occludes the placement or remains ambiguous, the first revealing farther panel.

## Evidence lifecycle

Booklets, source payloads, generated inputs, screenshots, scoreboards, run directories, and replay closures stay under ignored roots. Preserve artifacts used by an active run or an unresolved finding; remove only inactive task-owned evidence after its conclusion and provenance have been recorded in tracked documentation or promoted deliberately into a regression fixture.
