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

The default output root is `output/real-build`. Once artifact-closure verification succeeds, publication writes an immutable run under `<output-root>/runs/<run-id>/` and atomically updates `<output-root>/runs/current.json` even when the retained run result is a failed diagnostic such as `source-drift-detected`; that status prevents finalization, not diagnostic publication. An interruption or artifact-verification failure before publication must not replace the pointer. `LEGO_REAL_BUILD_OUT` may redirect the published run only to another traversal-free descendant of `output/`; it does not redirect the retained inputs listed above.

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
