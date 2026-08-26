from __future__ import annotations

import argparse
import json
import math
from pathlib import Path
from typing import Iterable

from PIL import Image

from part_identification_2453_stud_discriminator_support import (
    CALLOUT_MANIFEST_PIN,
    CANDIDATE_GEOMETRY,
    CONTROLS,
    DEFAULT_OFFICIAL_ARCHIVE,
    DEFAULT_OUTPUT,
    INVENTORY_MANIFEST_PIN,
    MAX_PNG_PIXELS,
    MAX_TOTAL_PNG_PIXELS,
    OFFICIAL_ARCHIVE_PIN,
    REPOSITORY_ROOT,
    SCHEMA_VERSION,
    SEMANTIC_ARTIFACT_PIN,
    TARGETS,
    OfficialGeometry,
    canonical_bytes,
    control_gate,
    image_from_pinned_row,
    montage,
    pinned_json,
    sha256_prefixed,
    unique_rows,
)

FEATURE = {
    "backgroundChannelDelta": 28,
    "minimumTopRunWidth": 12,
    "maximumTopRunWidth": 63,
    "topRunMustBeOdd": True,
    "centerRadiusScale": 0.25,
    "centerTopScale": 0.42,
    "centerBottomScale": 0.79,
    "referenceRadiusScale": 1.0,
    "minimumCenterPixels": 64,
    "minimumReferencePixels": 64,
    "minimumReferenceP90Luma": 48,
    "darkLumaReferenceScale": 0.35,
    "solidMinimumRatio": 0.90,
    "solidMaximumDarkShare": 0.10,
    "hollowMaximumRatio": 0.20,
    "hollowMinimumDarkShare": 0.90,
}


def percentile(values: Iterable[int], proportion: float) -> int | None:
    ordered = sorted(values)
    if not ordered:
        return None
    return ordered[math.floor((len(ordered) - 1) * proportion)]


def luma(pixel: tuple[int, int, int, int]) -> int:
    return (pixel[0] * 299 + pixel[1] * 587 + pixel[2] * 114 + 500) // 1000


def channel_delta(pixel: tuple[int, int, int, int], background: tuple[int, int, int, int]) -> int:
    return max(abs(pixel[index] - background[index]) for index in range(3))


def contiguous_runs(xs: list[int]) -> list[tuple[int, int]]:
    if not xs:
        return []
    runs = []
    start = prior = xs[0]
    for value in xs[1:]:
        if value != prior + 1:
            runs.append((start, prior))
            start = value
        prior = value
    runs.append((start, prior))
    return runs


def measure_rgba(image: Image.Image) -> dict[str, object]:
    if image.mode != "RGBA":
        raise ValueError(f"Source PNG must decode directly as RGBA, not {image.mode}")
    width, height = image.size
    if width < 1 or height < 1 or width * height > MAX_PNG_PIXELS:
        raise ValueError(f"Source PNG has unsafe dimensions {width}x{height}")
    pixels = image.load()
    corners = (
        pixels[0, 0],
        pixels[width - 1, 0],
        pixels[0, height - 1],
        pixels[width - 1, height - 1],
    )
    background = corners[0]
    reasons = []
    if any(pixel != background for pixel in corners) or background[3] != 255:
        reasons.append("nonuniform-or-nonopaque-background-corners")
    threshold = int(FEATURE["backgroundChannelDelta"])
    foreground = [
        (x, y)
        for y in range(height)
        for x in range(width)
        if channel_delta(pixels[x, y], background) >= threshold
    ]
    if not foreground:
        return {
            "backgroundRgba": list(background),
            "heightPx": height,
            "observable": False,
            "reasons": [*reasons, "no-foreground"],
            "verdict": "not-observable",
            "widthPx": width,
        }
    top_y = min(y for _, y in foreground)
    top_xs = sorted(x for x, y in foreground if y == top_y)
    runs = contiguous_runs(top_xs)
    if len(runs) != 1:
        reasons.append("top-row-does-not-have-one-foreground-run")
    anchor = max(runs, key=lambda run: run[1] - run[0])
    run_width = anchor[1] - anchor[0] + 1
    center_x = (anchor[0] + anchor[1]) / 2
    if run_width < int(FEATURE["minimumTopRunWidth"]):
        reasons.append("top-run-below-visibility-floor")
    if run_width > int(FEATURE["maximumTopRunWidth"]):
        reasons.append("top-run-above-bounded-scale")
    if bool(FEATURE["topRunMustBeOdd"]) and run_width % 2 == 0:
        reasons.append("top-run-midpoint-is-not-integral")
    if not center_x.is_integer():
        reasons.append("top-run-midpoint-is-not-integral")
    center_x_int = int(center_x) if center_x.is_integer() else None
    center_radius = math.floor(run_width * float(FEATURE["centerRadiusScale"]))
    y_start = top_y + math.ceil(run_width * float(FEATURE["centerTopScale"]))
    y_end = top_y + math.floor(run_width * float(FEATURE["centerBottomScale"]))
    reference_radius = math.floor(run_width * float(FEATURE["referenceRadiusScale"]))
    if center_x_int is None:
        center_pixels = []
        reference_lumas = []
    elif (
        center_x_int - reference_radius < 0
        or center_x_int + reference_radius >= width
        or y_start < 0
        or y_end >= height
        or y_end < y_start
    ):
        reasons.append("feature-window-is-off-image")
        center_pixels: list[tuple[int, int, int, int]] = []
        reference_lumas: list[int] = []
    else:
        center_pixels = [
            pixels[x, y]
            for y in range(y_start, y_end + 1)
            for x in range(center_x_int - center_radius, center_x_int + center_radius + 1)
        ]
        reference_lumas = [
            luma(pixels[x, y])
            for y in range(y_start, y_end + 1)
            for x in range(center_x_int - reference_radius, center_x_int + reference_radius + 1)
            if abs(x - center_x_int) > center_radius
            and channel_delta(pixels[x, y], background) >= threshold
        ]
    center_lumas = [luma(pixel) for pixel in center_pixels]
    background_like_center_pixels = sum(
        channel_delta(pixel, background) < threshold for pixel in center_pixels
    )
    if len(center_lumas) < int(FEATURE["minimumCenterPixels"]):
        reasons.append("center-support-below-visibility-floor")
    if len(reference_lumas) < int(FEATURE["minimumReferencePixels"]):
        reasons.append("reference-support-below-visibility-floor")
    if background_like_center_pixels:
        reasons.append("center-contains-background-like-pixels")
    center_median = percentile(center_lumas, 0.5)
    reference_p90 = percentile(reference_lumas, 0.9)
    ratio = (
        center_median / reference_p90
        if center_median is not None and reference_p90 not in (None, 0)
        else None
    )
    dark_share = (
        sum(
            value <= reference_p90 * float(FEATURE["darkLumaReferenceScale"])
            for value in center_lumas
        )
        / len(center_lumas)
        if center_lumas and reference_p90 is not None
        else None
    )
    if reference_p90 is None or reference_p90 < int(FEATURE["minimumReferenceP90Luma"]):
        reasons.append("reference-luma-below-visibility-floor")
    unqualified_class = "ambiguous-feature-band"
    if ratio is not None and dark_share is not None:
        if (
            ratio >= float(FEATURE["solidMinimumRatio"])
            and dark_share <= float(FEATURE["solidMaximumDarkShare"])
        ):
            unqualified_class = "solid-stud"
        elif (
            ratio <= float(FEATURE["hollowMaximumRatio"])
            and dark_share >= float(FEATURE["hollowMinimumDarkShare"])
        ):
            unqualified_class = "hollow-stud"
        else:
            reasons.append("feature-falls-in-refusal-band")
    reasons = list(dict.fromkeys(reasons))
    observable = not reasons
    return {
        "anchor": {
            "centerX": center_x,
            "run": [anchor[0], anchor[1]],
            "runCount": len(runs),
            "topY": top_y,
            "width": run_width,
        },
        "backgroundLikeCenterPixels": background_like_center_pixels,
        "backgroundRgba": list(background),
        "centerDarkShare": dark_share,
        "centerMedianLuma": center_median,
        "centerPixels": len(center_lumas),
        "centerRect": None
        if center_x_int is None
        else {
            "bottom": y_end,
            "left": center_x_int - center_radius,
            "right": center_x_int + center_radius,
            "top": y_start,
        },
        "heightPx": height,
        "observable": observable,
        "ratio": ratio,
        "reasons": reasons,
        "referenceP90Luma": reference_p90,
        "referencePixels": len(reference_lumas),
        "unqualifiedFeatureClass": unqualified_class,
        "verdict": unqualified_class if observable else "not-observable",
        "widthPx": width,
    }


def build_report(
    official_archive: Path = DEFAULT_OFFICIAL_ARCHIVE, *, include_targets: bool = True
) -> tuple[dict[str, object], list[dict[str, object]], list[dict[str, object]]]:
    inventory_manifest = pinned_json(
        REPOSITORY_ROOT / str(INVENTORY_MANIFEST_PIN["path"]),
        INVENTORY_MANIFEST_PIN,
        "Inventory thumbnail manifest",
    )
    if inventory_manifest.get("sourceHash") != INVENTORY_MANIFEST_PIN["sourceHash"]:
        raise ValueError("Inventory thumbnail manifest changed authenticated booklet source")
    if inventory_manifest.get("constants", {}).get("inkThreshold") != FEATURE["backgroundChannelDelta"]:
        raise ValueError("Inventory thumbnail foreground threshold drifted from frozen feature")
    inventory_rows = unique_rows(inventory_manifest.get("thumbnails"), "elementId", "Inventory rows")

    geometry = OfficialGeometry(official_archive)
    try:
        geometry_controls = {
            (control.design_id, control.expected_primitive): geometry.witness(
                control.design_id, control.expected_primitive
            )
            for control in CONTROLS
        }
        candidate_geometry = []
        for suffix, kind, primitive in CANDIDATE_GEOMETRY:
            witness = geometry.witness(suffix, primitive)
            direct = geometry.references(f"parts/{suffix}.dat")
            if primitive not in direct:
                raise ValueError(f"Official candidate {suffix} does not directly use {primitive}")
            candidate_geometry.append({"kind": kind, "suffix": suffix, **witness})

        control_measurements = []
        total_pixels = 0
        for control in CONTROLS:
            row = inventory_rows.get(control.element_id)
            if row is None:
                raise ValueError(f"Inventory manifest lacks control {control.element_id}")
            image, source = image_from_pinned_row(
                REPOSITORY_ROOT / "output/inventory-thumbnails",
                row,
                f"Control {control.element_id}",
            )
            total_pixels += image.width * image.height
            measurement = measure_rgba(image)
            control_measurements.append(
                {
                    "_image": image,
                    "designId": control.design_id,
                    "elementId": control.element_id,
                    "expectedKind": control.expected_kind,
                    "geometry": geometry_controls[(control.design_id, control.expected_primitive)],
                    "label": f"control {control.element_id}",
                    "measurement": measurement,
                    "role": control.role,
                    "source": source,
                }
            )
        if total_pixels > MAX_TOTAL_PNG_PIXELS:
            raise ValueError("Control source-art decode exceeds fixed aggregate pixel budget")
        calibration_gate = control_gate(control_measurements, {"calibration"})
        candidate_one = control_gate(
            control_measurements, {"calibration", "same-color-refusal"}
        )
        candidate_two = control_gate(
            control_measurements,
            {"calibration", "held-out"},
            required_observable_role="held-out",
        )
        controls_pass = (
            calibration_gate["passed"] and candidate_one["passed"] and candidate_two["passed"]
        )

        target_measurements: list[dict[str, object]] = []
        target_results: list[dict[str, object]] = []
        if include_targets:
            callout_manifest = pinned_json(
                REPOSITORY_ROOT / str(CALLOUT_MANIFEST_PIN["path"]),
                CALLOUT_MANIFEST_PIN,
                "Callout thumbnail manifest",
            )
            if callout_manifest.get("sourceHash") != CALLOUT_MANIFEST_PIN["sourceHash"]:
                raise ValueError("Callout manifest changed authenticated booklet source")
            callout_rows = unique_rows(callout_manifest.get("callouts"), "identity", "Callout rows")
            semantic = pinned_json(
                REPOSITORY_ROOT / str(SEMANTIC_ARTIFACT_PIN["path"]),
                SEMANTIC_ARTIFACT_PIN,
                "Legacy recut semantic artifact",
            )
            for target in TARGETS:
                inventory_row = inventory_rows.get(str(target["elementId"]))
                callout_row = callout_rows.get(str(target["calloutIdentity"]))
                if inventory_row is None or callout_row is None:
                    raise ValueError(f"Pinned source manifests lack target {target['elementId']}")
                if inventory_row.get("file") != target["inventoryFile"]:
                    raise ValueError(
                        f"Target {target['elementId']} inventory view is not its frozen file "
                        f"{target['inventoryFile']}"
                    )
                expected_prefix = f"runs/{CALLOUT_MANIFEST_PIN['runId']}/"
                if not str(callout_row.get("file", "")).startswith(expected_prefix):
                    raise ValueError(
                        f"Target {target['elementId']} callout does not come from immutable run "
                        f"{CALLOUT_MANIFEST_PIN['runId']}"
                    )
                semantic_rows = unique_rows(
                    semantic.get(str(target["semanticCollection"])),
                    "identity",
                    str(target["semanticCollection"]),
                )
                relation = semantic_rows.get(str(target["calloutIdentity"]))
                if (
                    relation is None
                    or relation.get("elementId") != target["elementId"]
                    or relation.get("currentCropSha256") != callout_row.get("sha256")
                ):
                    raise ValueError(
                        f"Pinned semantic relation does not bind target {target['elementId']} "
                        f"to {target['calloutIdentity']}"
                    )
                views = []
                for kind, root, source_row in (
                    ("inventory", REPOSITORY_ROOT / "output/inventory-thumbnails", inventory_row),
                    ("callout", REPOSITORY_ROOT / "output/callout-thumbnails", callout_row),
                ):
                    image, source = image_from_pinned_row(
                        root, source_row, f"Target {target['elementId']} {kind}"
                    )
                    total_pixels += image.width * image.height
                    views.append(
                        {
                            "_image": image,
                            "elementId": target["elementId"],
                            "label": f"target {target['elementId']} {kind}",
                            "measurement": measure_rgba(image),
                            "source": {"kind": kind, **source},
                        }
                    )
                if total_pixels > MAX_TOTAL_PNG_PIXELS:
                    raise ValueError("Source-art decode exceeds fixed aggregate pixel budget")
                measured_views = [view["measurement"] for view in views]
                raw_classes = {
                    str(view["verdict"]) for view in measured_views if view["observable"]
                }
                target_measurements.extend(views)
                target_results.append({
                    "elementId": target["elementId"],
                    "reason": "calibration-controls-failed"
                    if not controls_pass
                    else "all-rostered-views-must-be-observable-and-agree",
                    "semanticDisposition": target["semanticDisposition"],
                    "suffix": None,
                    "unqualifiedObservableClasses": sorted(raw_classes),
                    "verdict": "not-observable",
                    "views": [
                        {
                            key: value
                            for key, value in view.items()
                            if key not in {"_image", "elementId", "label"}
                        }
                        for view in views
                    ],
                })
        report = {
            "authority": {
                "assignment": False,
                "catalogAdmission": False,
                "completion": False,
                "documentMutation": False,
                "physicalFrame": False,
                "placement": False,
                "replay": False,
                "sourceExecution": False,
                "suffixIdentity": False,
            },
            "candidateGeometry": candidate_geometry,
            "controlGates": {
                "calibration": calibration_gate,
                "candidateOne": candidate_one,
                "candidateTwo": candidate_two,
                "targetsMayResolve": controls_pass,
            },
            "controls": [
                {key: value for key, value in row.items() if key not in {"_image", "label"}}
                for row in control_measurements
            ],
            "feature": FEATURE,
            "scope": {
                "controlsOnly": not include_targets,
                "source": "already-pinned-booklet-inventory-and-callout-art",
                "targetElements": [] if not include_targets else [row["elementId"] for row in TARGETS],
            },
            "schemaVersion": SCHEMA_VERSION,
            "sourcePins": {
                "calloutManifest": CALLOUT_MANIFEST_PIN if include_targets else None,
                "inventoryManifest": INVENTORY_MANIFEST_PIN,
                "officialLdraw": OFFICIAL_ARCHIVE_PIN,
                "semanticArtifact": SEMANTIC_ARTIFACT_PIN if include_targets else None,
            },
            "targets": target_results,
            "work": {
                "decodedPixels": total_pixels,
                "decodedPixelLimit": MAX_TOTAL_PNG_PIXELS,
                "views": len(control_measurements) + len(target_measurements),
            },
        }
        return report, control_measurements, target_measurements
    finally:
        geometry.close()


def contained_output(path: Path) -> Path:
    output_root = (REPOSITORY_ROOT / "output").resolve(strict=True)
    resolved = path.resolve()
    if output_root != resolved and output_root not in resolved.parents:
        raise ValueError(f"Diagnostic output must stay under {output_root}")
    resolved.mkdir(parents=True, exist_ok=True)
    return resolved


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Replay the frozen, authority-free 2453 stud-aperture diagnostic."
    )
    parser.add_argument("--official", type=Path, default=DEFAULT_OFFICIAL_ARCHIVE)
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--controls-only", action="store_true")
    args = parser.parse_args()
    output = contained_output(args.output_dir)
    report, controls, targets = build_report(args.official, include_targets=not args.controls_only)
    report_bytes = canonical_bytes(report)
    if len(report_bytes) > 256 * 1024:
        raise ValueError(f"Diagnostic report is {len(report_bytes)} bytes; maximum is 262144")
    report_path = output / ("controls.json" if args.controls_only else "report.json")
    report_path.write_bytes(report_bytes)
    montage(controls, output / "controls-montage.png", 3)
    if targets:
        montage(targets, output / "targets-montage.png", 2)
    print(
        json.dumps(
            {
                "bytes": len(report_bytes),
                "controlsPassed": report["controlGates"]["targetsMayResolve"],
                "digest": sha256_prefixed(report_bytes),
                "path": report_path.relative_to(REPOSITORY_ROOT).as_posix(),
                "targetVerdicts": [
                    {"elementId": row["elementId"], "verdict": row["verdict"]}
                    for row in report["targets"]
                ],
            },
            separators=(",", ":"),
            sort_keys=True,
        )
    )


if __name__ == "__main__":
    main()
