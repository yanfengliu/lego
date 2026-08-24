# Part visual admission

Use this harness to compare an exact LDraw source closure with the production catalog geometry independently of the live editor scene.

Capture is evidence generation, not review: every packet is immutable and `pending`, and only a separately published review sidecar can record `same`, `different`, or `not-observable` for each view.

## Prerequisites

Use the repository-pinned Node/npm and Playwright Chromium, Python 3, the official `ldraw-complete-2026-07.zip` archive with SHA-256 `6009f2e94204c4d3a63a4c812010b5c90bad8c5acb19b882c859fdac63734eae`, and the unofficial `ldraw-unofficial-2026-08-02.zip` archive with SHA-256 `09ec08007203b66e79b1f857aa4804cbee26e1337e177a7c3a87adc1268e44d4`.

The materializer refuses a missing archive, a checksum mismatch, archive expansion outside its limits, a missing root or reference, a path escape, a link, and source bytes that change during the run.

## Capture

Capture every source-normal mesh definition with:

```powershell
$officialArchive = "C:\tmp\ldraw-complete-2026-07.zip"
$unofficialArchive = "C:\tmp\ldraw-unofficial-2026-08-02.zip"
$batchRoot = "output\part-visual-admission\review-2026-08-11"
npm run parts:visual-capture -- --official $officialArchive --unofficial $unofficialArchive --output $batchRoot
```

Limit an intentional diagnostic run with one comma-separated `--parts` value containing exact catalog IDs; an unknown, empty, or repeated ID fails rather than being skipped.

The command fails if any required archive, output, part, exact mesh route, materialized closure, browser capture, packet publication, or process cleanup step fails; the ordinary browser suite uses only the synthetic fixture and skips the real-archive case unless this command explicitly requires it.

The primary packet renders `top`, `bottom`, `front`, `back`, `left`, `right`, `isometric`, and `underside-oblique` in that order with one shared union fit, six orthographic cameras, two pinned 35-degree perspective cameras, DPR 1, one neutral `FrontSide` material, one light rig, and no grid, shadows, selection, or source line overlays.

The source uses Three's independent `LDrawLoader` over the exact materialized closure; the candidate uses production `createCatalogPartGeometry`; both consume the real asset-to-catalog frame and LDU-to-Three transform.

The ignored output contains one immutable run directory per part with `packet.json` and all 16 raw PNGs, plus one batch manifest binding the requested catalog IDs, relative packet paths, and packet hashes.

A catalog or part-definition truth change invalidates every packet that was bound as current, even when mesh hashes, frames, renderer inputs, and decoded pixels stay unchanged. Capture every affected definition again under the new truth. Exact old/new PNG and decoded-RGBA identity, together with unchanged mesh, frame, source manifest, camera, and renderer bindings, may justify transferring an already-inspected outcome into a new review sidecar that states that evidence; it never rebinds or relabels the old packet as current.

## Inspect

Inspect every raw source/candidate pair at native size; a contact sheet is an unbound navigation aid and never replaces the packet-bound PNG pair.

Create manifest-bound, lossless native-size inspection aids after capture:

```powershell
$captureBatches = @(Get-ChildItem -LiteralPath (Join-Path $batchRoot "batches") -Filter "*.json" | Where-Object { $_.Name -notlike "*.review.json" })
if ($captureBatches.Count -ne 1) { throw "Expected exactly one capture batch under $batchRoot; found $($captureBatches.Count)." }
$captureBatch = $captureBatches[0].FullName
$nativePairs = Join-Path $batchRoot "native-pairs"
if (Test-Path -LiteralPath $nativePairs) { throw "Choose a new native-pair output path; $nativePairs already exists." }
npm run parts:visual-pairs -- --batch $captureBatch --output $nativePairs
```

The command creates one deterministic `<part-slug>/<01..08>-<view>.png` pair per view with the two bound 640x640 PNGs copied side by side without resampling and labels outside both panels; it decodes every retained composite and refuses publication unless both 640x640 regions exactly match the decoded packet PNG pixels.

The capture batch, every packet/image input, and the new pair-output parent must stay below ordinary `output/` or `test-results/` directory trees; a symbolic-link or junction ancestor is a refusal.

These pair images are inspection/navigation aids bound by their own `manifest.json`, not packet authority; review notes still bind and name the source/candidate hashes in the immutable packet/review record.

For every view, check FrontSide visibility and winding, outer and cavity silhouettes, surface depth and occlusion ordering, nonplanar-quad diagonals, hard versus smooth normal boundaries, and lighting continuity; compare the packet's foreground IoU/counts and RGB deltas as diagnostics, not as an automatic verdict.

Use `not-observable` with a specific note when the required surface claim is hidden in that view; add an explicit interior or cutaway corroboration before claiming a cavity that all eight exterior views leave hidden.

## Publish the review sidecar

Create a strict review input with all eight rows in policy order:

```json
{
  "schemaVersion": "lego.part-visual-admission-review-input/1",
  "reviewer": "reviewer identity",
  "method": "original-resolution-visual-inspection",
  "views": [
    { "viewName": "top", "outcome": "same", "note": "Raw top source sha256:<digest> and candidate sha256:<digest>, inspected at native size: outer silhouette and visible stud positions match." },
    { "viewName": "bottom", "outcome": "same", "note": "Raw bottom source sha256:<digest> and candidate sha256:<digest>, inspected at native size: silhouette and exposed underside openings match." },
    { "viewName": "front", "outcome": "same", "note": "Raw front source sha256:<digest> and candidate sha256:<digest>, inspected at native size: wall profile, stud height, and visible cavities match." },
    { "viewName": "back", "outcome": "same", "note": "Raw back source sha256:<digest> and candidate sha256:<digest>, inspected at native size: wall profile, stud height, and visible cavities match." },
    { "viewName": "left", "outcome": "same", "note": "Raw left source sha256:<digest> and candidate sha256:<digest>, inspected at native size: side silhouette, depth ordering, and surface boundaries match." },
    { "viewName": "right", "outcome": "same", "note": "Raw right source sha256:<digest> and candidate sha256:<digest>, inspected at native size: side silhouette, depth ordering, and surface boundaries match." },
    { "viewName": "isometric", "outcome": "same", "note": "Raw isometric source sha256:<digest> and candidate sha256:<digest>, inspected at native size: handedness, occlusion order, and hard versus smooth shading match." },
    { "viewName": "underside-oblique", "outcome": "same", "note": "Raw underside-oblique source sha256:<digest> and candidate sha256:<digest>, inspected at native size: exposed rings, ribs, walls, cavities, and shading match." }
  ]
}
```

Replace each placeholder digest and feature list with the exact pair and surfaces actually inspected; use `not-observable` instead of copying a claim that the view does not expose.

The review-input JSON must be an ordinary contained file below `output/` or `test-results/`; arbitrary paths and symbolic-link or junction ancestors are refused.

Publish it with:

```powershell
$reviewInput = "output\part-visual-admission\review-input.json"
$packet = (Get-ChildItem -LiteralPath (Join-Path $batchRoot "runs") -Filter "packet.json" -Recurse | Sort-Object FullName | Select-Object -First 1).FullName
npm run parts:visual-review -- --packet $packet --input $reviewInput
```

Repeat the packet command with each ordered `packet.json` in the capture batch and a review input written for that part.

Publication revalidates the pending packet hash and every retained PNG before exclusively creating `review.json`; it refuses a missing or reordered view, `pending` as an outcome, an empty note, packet/image tampering, and any attempt to overwrite an existing sidecar.

Each note must name the raw packet pair inspected and the observable basis for its outcome; a contact-sheet-only note cannot close admission.

After every packet in one capture batch has a valid sidecar, bind the complete ordered tranche into one immutable review-batch manifest:

```powershell
npm run parts:visual-review -- --batch $captureBatch
```

Batch publication rereads every packet PNG and reconstructs every ordered review image binding and aggregate outcome before creating the adjacent `<capture-batch>.review.json`; it refuses missing, stale, rehashed-but-inconsistent, reordered, duplicated, linked, or already-published evidence.

## Output lifecycle

Everything under `output/part-visual-admission/` is ignored task evidence: retain the batch, raw pairs, packets, and review sidecars while review or migration work depends on them, then remove only the no-longer-needed owned batch after its durable conclusions have landed in tests, catalog truth, or the devlog.
