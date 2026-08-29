"""Target-independent calibration for Builder-to-LDraw variant resolution.

This module deliberately contains no 3245 input, candidate, or score. It derives
one refusal-aware metric contract from already authenticated Builder/LDraw
controls and writes only bounded measurement evidence under a caller-selected
ignored output path. It cannot admit a catalog part or author placement truth.
"""

from __future__ import annotations

import argparse
import hashlib
import importlib.util
import itertools
import json
import math
import struct
from dataclasses import dataclass
from pathlib import Path
from types import ModuleType
from typing import Sequence

from proper_orientations_generated import PROPER_ORIENTATION_ROWS
import builder_calibration_sources as SOURCES
import identify_builder_3245_variant_core as GEOMETRY
SCHEMA_VERSION = "lego.builder-variant-control-contract/1"
OFFICIAL_ARCHIVE_BYTES = 144_722_356
OFFICIAL_ARCHIVE_SHA256 = "6009f2e94204c4d3a63a4c812010b5c90bad8c5acb19b882c859fdac63734eae"
CONTROL_GEOMETRY_BYTES = 1_091_772
CONTROL_GEOMETRY_SHA256 = "da8260f77540db459bd745d75ebb072d1b08d357d1628569a06c58d6aed77c55"
WITNESS_DISTANCE_LDU = 0.5
FRAME_DISTANCE_TOLERANCE_LDU = 0.000003
FIT_CEILING_MULTIPLIER = 2.0
MARGIN_RESERVE_FRACTION = 0.5
MAX_OUTPUT_BYTES = 512 * 1024
@dataclass(frozen=True)
class Transform:
    orientation_id: str
    position_ldu: tuple[float, float, float]
@dataclass(frozen=True)
class Control:
    name: str
    design_revision: str
    correct_root: str
    candidate_roots: tuple[str, ...]
    expected: str
    catalog_to_builder: Transform
    ldraw_to_catalog: Transform
    expected_frame_p95_ldu: float
    expected_frame_maximum_ldu: float
CONTROLS: tuple[Control, ...] = (
    Control(
        "cut-corner-versus-round-corner",
        "30503;F",
        "30503",
        ("30503", "30565"),
        "select-correct",
        Transform("upright-yaw-0", (30, -4, -30)),
        Transform("upright-yaw-0", (0, -4, 0)),
        1.282422,
        1.299038,
    ),
    Control(
        "round-corner-versus-cut-corner",
        "30565;E",
        "30565",
        ("30565", "30503"),
        "select-correct",
        Transform("upright-yaw-0", (30, -4, -30)),
        Transform("upright-yaw-0", (0, -4, 0)),
        1.299038,
        1.316400,
    ),
    Control(
        "right-wing-versus-left-wing",
        "54383;F",
        "54383",
        ("54383", "54384"),
        "select-correct",
        Transform("upright-yaw-90", (50, -4, 20)),
        Transform("upright-yaw-0", (0, -4, 0)),
        1.250012,
        1.299038,
    ),
    Control(
        "two-by-four-wing-family",
        "51739;H",
        "51739",
        ("51739", "41769a", "41769b", "41770a", "41770b"),
        "select-correct",
        Transform("upright-yaw-270", (30, -4, -10)),
        Transform("upright-yaw-90", (0, -4, 0)),
        1.030776,
        1.060658,
    ),
    Control(
        "plate-exact-colour-alias",
        "3020;L",
        "3020",
        ("3020", "302021"),
        "unresolved",
        Transform("upright-yaw-90", (30, -4, 10)),
        Transform("upright-yaw-90", (0, -4, 0)),
        1.305568,
        1.305568,
    ),
    Control(
        "right-wing-exact-colour-alias",
        "54383;F",
        "54383",
        ("54383", "4287707"),
        "unresolved",
        Transform("upright-yaw-90", (50, -4, 20)),
        Transform("upright-yaw-0", (0, -4, 0)),
        1.250012,
        1.299038,
    ),
)
def canonical_bytes(value: object) -> bytes:
    return (json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=True) + "\n").encode()


def sha256(payload: bytes) -> str:
    return hashlib.sha256(payload).hexdigest()
def exact_bytes(path: Path, count: int, digest: str, label: str) -> bytes:
    payload = path.read_bytes()
    actual = sha256(payload)
    if len(payload) != count or actual != digest:
        raise ValueError(
            f"{label} is {len(payload)} bytes sha256:{actual}; expected exactly "
            f"{count} bytes sha256:{digest}."
        )
    return payload
def _load_sibling(module_name: str, filename: str) -> ModuleType:
    spec = importlib.util.spec_from_file_location(module_name, Path(__file__).with_name(filename))
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Cannot load required sibling {filename}.")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module
def determinant(matrix: Sequence[int]) -> int:
    a, b, c, d, e, f, g, h, i = matrix
    return a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g)
def proper_orientation_registry() -> dict[str, tuple[int, ...]]:
    registry = dict(PROPER_ORIENTATION_ROWS)
    matrices = list(registry.values())
    if len(registry) != 24 or len(set(matrices)) != 24:
        raise ValueError("Proper orientation registry must contain exactly 24 unique rows.")
    if any(
        len(matrix) != 9
        or determinant(matrix) != 1
        or sorted(sum((abs(matrix[row * 3 + column]) for column in range(3)), 0) for row in range(3))
        != [1, 1, 1]
        for matrix in matrices
    ):
        raise ValueError("Proper orientation registry contains a reflection or non-permutation row.")
    expected = {
        tuple(
            signs[row] if permutation[row] == column else 0
            for row in range(3)
            for column in range(3)
        )
        for permutation in itertools.permutations(range(3))
        for signs in itertools.product((-1, 1), repeat=3)
        if determinant(
            tuple(
                signs[row] if permutation[row] == column else 0
                for row in range(3)
                for column in range(3)
            )
        )
        == 1
    }
    if set(matrices) != expected:
        raise ValueError("Proper orientation registry is not the complete determinant-positive group.")
    return registry
def apply_matrix(matrix: Sequence[int], point: Sequence[float]) -> tuple[float, float, float]:
    return tuple(
        sum(matrix[row * 3 + column] * float(point[column]) for column in range(3))
        for row in range(3)
    )  # type: ignore[return-value]
def inverse_transform(transform: Transform, point: Sequence[float]) -> tuple[float, float, float]:
    matrix = proper_orientation_registry().get(transform.orientation_id)
    if matrix is None:
        raise ValueError(f"Unknown proper orientation {transform.orientation_id}.")
    shifted = tuple(float(point[axis]) - transform.position_ldu[axis] for axis in range(3))
    transpose = tuple(matrix[column * 3 + row] for row in range(3) for column in range(3))
    return apply_matrix(transpose, shifted)


def decode_builder_triangles(payload: bytes, reference: dict[str, object]):
    offset = int(reference["byteOffset"])
    length = int(reference["byteLength"])
    section = payload[offset : offset + length]
    if len(section) != length or len(section) % 36:
        raise ValueError("Builder control slice is truncated or not a triangle multiple.")
    expected_digest = str(reference["digest"])
    if f"sha256:{sha256(section)}" != expected_digest:
        raise ValueError("Builder control slice differs from its authenticated digest.")
    values = [row[0] for row in struct.iter_unpack("<f", section)]
    points = [
        (values[index] / 0.04, -values[index + 1] / 0.04, values[index + 2] / 0.04)
        for index in range(0, len(values), 3)
    ]
    return [tuple(points[index : index + 3]) for index in range(0, len(points), 3)]


def decode_ldraw_triangles(payload: bytes, reference: dict[str, object]):
    offset = int(reference["byteOffset"])
    length = int(reference["byteLength"])
    section = payload[offset : offset + length]
    if len(section) != length or len(section) % 36:
        raise ValueError("LDraw control slice is truncated or not a triangle multiple.")
    if f"sha256:{sha256(section)}" != str(reference["digest"]):
        raise ValueError("LDraw control slice differs from its authenticated digest.")
    values = [row[0] for row in struct.iter_unpack("<f", section)]
    points = [tuple(values[index : index + 3]) for index in range(0, len(values), 3)]
    return [tuple(points[index : index + 3]) for index in range(0, len(points), 3)]


def quantize_ldraw_triangles(triangles):
    return [
        tuple(tuple(struct.unpack("<fff", struct.pack("<fff", *point))) for point in triangle)
        for triangle in triangles
    ]


def align_builder(control: Control, triangles):
    return [
        tuple(
            inverse_transform(
                control.ldraw_to_catalog,
                inverse_transform(control.catalog_to_builder, point),
            )
            for point in triangle
        )
        for triangle in triangles
    ]


def unique_points(triangles) -> list[tuple[float, float, float]]:
    return sorted({tuple(round(float(value), 9) for value in point) for triangle in triangles for point in triangle})


def frame_measurement(builder_triangles, correct_surface) -> dict[str, float | int]:
    distances = GEOMETRY.nearest_distances(unique_points(builder_triangles), correct_surface)
    summary = GEOMETRY.distance_summary(distances)
    return {
        "points": int(summary["count"]),
        "p95Ldu": float(summary["p95Ldu"]),
        "maximumLdu": float(summary["maximumLdu"]),
    }


def interior_samples(triangles, body_bounds):
    points = GEOMETRY.sample_surface(triangles)
    lower, upper = body_bounds
    return [
        point
        for point in points
        if lower[0] + 0.5 < point[0] < upper[0] - 0.5
        and lower[2] + 0.5 < point[2] < upper[2] - 0.5
        and lower[1] + 0.5 < point[1] <= upper[1] + GEOMETRY.FRAME_TOLERANCE_LDU
    ]


def score_candidates(builder_triangles, surfaces: dict[str, object]) -> dict[str, object]:
    body_bounds = GEOMETRY.finite_bounds(unique_points(builder_triangles))
    builder_samples = interior_samples(builder_triangles, body_bounds)
    if not builder_samples:
        raise ValueError("Control Builder shell exposes no bounded interior surface samples.")
    sampled = {root: interior_samples(surface, body_bounds) for root, surface in surfaces.items()}
    rows = []
    ambiguous_pairs: set[tuple[str, str]] = set()
    for root in sorted(surfaces):
        witnesses = []
        for other in sorted(surfaces):
            if other == root:
                continue
            points = GEOMETRY.discriminative_points(sampled[root], surfaces[other])
            if not points:
                ambiguous_pairs.add(tuple(sorted((root, other))))
                witnesses.append({"against": other, "points": 0, "distanceToBuilder": None})
                continue
            distances = GEOMETRY.nearest_distances(points, builder_triangles)
            witnesses.append(
                {
                    "against": other,
                    "points": len(points),
                    "distanceToBuilder": GEOMETRY.distance_summary(distances),
                }
            )
        maxima = [
            float(row["distanceToBuilder"]["maximumLdu"])
            for row in witnesses
            if row["distanceToBuilder"] is not None
        ]
        rows.append(
            {
                "root": root,
                "scoreMaximumWitnessDistanceLdu": max(maxima) if maxima else None,
                "witnesses": witnesses,
            }
        )
    finite = sorted(
        (float(row["scoreMaximumWitnessDistanceLdu"]), str(row["root"]))
        for row in rows
        if row["scoreMaximumWitnessDistanceLdu"] is not None
    )
    if len(finite) < 2 or sum(abs(row[0] - finite[0][0]) <= 0.000001 for row in finite) != 1:
        verdict = "unresolved"
        best = runner_up = gap = ratio = None
    else:
        best, runner_up = finite[0], finite[1]
        gap = round(runner_up[0] - best[0], 6)
        ratio = math.inf if best[0] == 0 else round(runner_up[0] / best[0], 6)
        verdict = best[1]
    return {
        "ambiguousPairs": [list(row) for row in sorted(ambiguous_pairs)],
        "bodyBoundsLdu": body_bounds,
        "builderInteriorSamples": len(builder_samples),
        "candidates": rows,
        "observedBestRoot": None if best is None else best[1],
        "observedBestScoreLdu": None if best is None else best[0],
        "observedRunnerUpRoot": None if runner_up is None else runner_up[1],
        "observedRunnerUpScoreLdu": None if runner_up is None else runner_up[0],
        "runnerUpGapLdu": gap,
        "runnerUpRatio": ratio,
        "rawVerdict": verdict,
    }


def create_control_contract(geometry_payload: bytes, official_payload: bytes) -> dict[str, object]:
    control_tokens = "\n".join(
        token
        for control in CONTROLS
        for token in (
            control.name,
            control.design_revision,
            control.correct_root,
            *control.candidate_roots,
        )
    )
    if "3245" in control_tokens:
        raise ValueError("Target data leaked into the control specification.")
    registry = proper_orientation_registry()
    source_by_revision = {str(row["designRevision"]): row for row in SOURCES.DESIGNS}
    calibration = _load_sibling("builder_variant_control_ldraw_reader", "generate-builder-calibration.py")
    library = calibration.LDrawLibrary([("exact-pinned-official", official_payload)])
    results = []
    try:
        all_roots = sorted({root for control in CONTROLS for root in control.candidate_roots})
        surfaces = {
            root: quantize_ldraw_triangles(library.triangles(f"{root}.dat"))
            for root in all_roots
        }
        for control in CONTROLS:
            source = source_by_revision.get(control.design_revision)
            if source is None:
                raise ValueError(f"Control {control.design_revision} is not in the authenticated corpus.")
            builder = align_builder(
                control,
                decode_builder_triangles(geometry_payload, source["builderGeometry"]),
            )
            pinned_correct = decode_ldraw_triangles(geometry_payload, source["ldrawReferenceGeometry"])
            if GEOMETRY.surface_digest(pinned_correct) != GEOMETRY.surface_digest(surfaces[control.correct_root]):
                raise ValueError(
                    f"Official archive root {control.correct_root} does not reproduce its pinned control slice."
                )
            frame = frame_measurement(builder, surfaces[control.correct_root])
            if (
                abs(float(frame["p95Ldu"]) - control.expected_frame_p95_ldu)
                > FRAME_DISTANCE_TOLERANCE_LDU
                or abs(float(frame["maximumLdu"]) - control.expected_frame_maximum_ldu)
                > FRAME_DISTANCE_TOLERANCE_LDU
            ):
                raise ValueError(
                    f"Control frame {control.name} drifted: p95={frame['p95Ldu']}, "
                    f"maximum={frame['maximumLdu']}."
                )
            scoring = score_candidates(
                builder, {root: surfaces[root] for root in control.candidate_roots}
            )
            if control.expected == "select-correct" and scoring["rawVerdict"] != control.correct_root:
                raise ValueError(
                    f"Control {control.name} failed to select {control.correct_root}: "
                    f"{json.dumps(scoring, sort_keys=True)}"
                )
            if control.expected == "unresolved" and scoring["rawVerdict"] != "unresolved":
                raise ValueError(f"Ambiguous control {control.name} failed to refuse selection.")
            results.append(
                {
                    "name": control.name,
                    "designRevision": control.design_revision,
                    "correctRoot": control.correct_root,
                    "expected": control.expected,
                    "frameMeasurement": frame,
                    "scoring": scoring,
                    "sourceSlices": {
                        "builder": source["builderGeometry"],
                        "ldrawReference": source["ldrawReferenceGeometry"],
                    },
                }
            )
    finally:
        library.close()
    decisive = [row for row in results if row["expected"] == "select-correct"]
    correct_scores = [float(row["scoring"]["observedBestScoreLdu"]) for row in decisive]
    gaps = [float(row["scoring"]["runnerUpGapLdu"]) for row in decisive]
    ratios = [float(row["scoring"]["runnerUpRatio"]) for row in decisive]
    thresholds = {
        "maximumAcceptedWitnessDistanceLdu": round(
            max(correct_scores) * FIT_CEILING_MULTIPLIER, 6
        ),
        "minimumRunnerUpGapLdu": round(min(gaps) * MARGIN_RESERVE_FRACTION, 6),
        "minimumRunnerUpRatio": round(1 + (min(ratios) - 1) * MARGIN_RESERVE_FRACTION, 6),
        "derivation": {
            "fitCeiling": "two-times-worst-known-correct-control-score",
            "margin": "half-of-smallest-known-correct-control-separation-above-tie",
            "targetRead": False,
        },
    }
    return {
        "schemaVersion": SCHEMA_VERSION,
        "authority": {
            "catalogAdmission": False,
            "connectorOrCollisionTruth": False,
            "placement": False,
            "role": "geometry-selection-contract-only",
        },
        "containsTargetData": False,
        "controls": results,
        "inputs": {
            "builderLdrawControlBundle": {
                "bytes": len(geometry_payload),
                "sha256": f"sha256:{sha256(geometry_payload)}",
            },
            "officialLdrawArchive": {
                "bytes": len(official_payload),
                "sha256": f"sha256:{sha256(official_payload)}",
            },
        },
        "metric": {
            "candidateScore": "maximum distance from every pairwise-discriminative interior candidate sample to Builder Shell",
            "pairwiseDiscriminativeDistanceLdu": WITNESS_DISTANCE_LDU,
            "properFrameCount": len(registry),
            "properFrameRosterSha256": f"sha256:{sha256(canonical_bytes(list(PROPER_ORIENTATION_ROWS)))}",
            "reflectionsAdmitted": False,
            "surfaceSampleSpacingLdu": GEOMETRY.SURFACE_SAMPLE_SPACING_LDU,
        },
        "thresholds": thresholds,
    }


def write_atomic(path: Path, payload: bytes) -> None:
    if len(payload) > MAX_OUTPUT_BYTES:
        raise ValueError(f"Control contract is {len(payload)} bytes; cap is {MAX_OUTPUT_BYTES}.")
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(f".{path.name}.tmp")
    temporary.write_bytes(payload)
    temporary.replace(path)


def main() -> int:
    parser = argparse.ArgumentParser(description="Freeze target-independent Builder variant controls.")
    parser.add_argument("--geometry", type=Path, required=True)
    parser.add_argument("--official", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    geometry = exact_bytes(
        args.geometry, CONTROL_GEOMETRY_BYTES, CONTROL_GEOMETRY_SHA256, "Control geometry bundle"
    )
    official = exact_bytes(
        args.official, OFFICIAL_ARCHIVE_BYTES, OFFICIAL_ARCHIVE_SHA256, "Official LDraw archive"
    )
    contract = create_control_contract(geometry, official)
    encoded = canonical_bytes(contract)
    write_atomic(args.output, encoded)
    print(
        canonical_bytes(
            {
                "bytes": len(encoded),
                "output": str(args.output),
                "sha256": f"sha256:{sha256(encoded)}",
            }
        ).decode(),
        end="",
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
