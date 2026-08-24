from __future__ import annotations

import base64
import json
import math
import struct
from collections import Counter


NATIVE_PACK_BYTES = 2_069_952
NATIVE_PACK_SHA256 = "e5bb745faa79c5e7cb525eb0a11a8443815a0c4805c85644204b26c462ac636d"
NATIVE_BINARY_BYTES = 971_868
NATIVE_BINARY_SHA256 = "76830eb4832492e5416ad6920ab4f8167b6cf55725641cce162ac8f9f215b6c7"
NATIVE_RECORD_SHA256 = {
    "15254": "0ae335fc6d5ee2adf9e2aadf4dc71bce8db432d9ce1dc5283fbe1da7456ff6f2",
    "5092": "7478be166332b46c8b66f85c9e1e836aaf86d24b15e0c57b5d4a273334088387",
    "35480": "56886b144f0f29acbf61903ef9a130f9c811fd1f2a3710a2bb04b98a868298b1",
    "51739": "da86abdd5f2b9af54cc8ba8c6aa5272aa5d0279f6ae16a732a1f83393a1c62de",
    "77844": "cca5e0d252747190c53e10c5a78470a0c721771db19b5b8d84fd2d422184ad6b",
    "93273": "9b517c4de9785e37ef9c9c3e403c5c478dcad8f7fbc26a6af2abae5a447110a9",
}
NATIVE_REVIEW_RECORD_SHA256 = {
    "15254": "64570313b8688b360eb007a929c6222fbca1c85d274218ed69d0e9f4727803b9",
    "5092": "f9eca178a04ce91e8ef6e23e257a710a86f9715844d9fad3ccaa9c7c30c283a2",
    "35480": "ab50ef15b4851f45b76f8916dc87ecaf54d838b82d9a2e967860044ce324a5cb",
    "51739": "029f5873dcfbef5dbae8e4fad7eab2144e735e091aadbb41675fe08f13052b99",
    "77844": "adc1079afcd1b0fef7b7d8761ac6893ffb4b3d680cdccc54d3df8b7241e074f9",
    "93273": "4d80f751a82ae56100df4011dbc42495cee7c1f94d30a5615d0fcf7f988ec6e4",
}

NATIVE_TOP_LEVEL_KEYS = {
    "binaryBase64",
    "binaryBytes",
    "binarySha256",
    "frameId",
    "partCount",
    "parts",
    "schemaVersion",
    "sourceAuditSha256",
    "sourceCacheReportSha256",
    "sourceCoverageSha256",
    "sourceManifestSha256",
    "triangleCount",
    "vertexCount",
}


def _sha256_hex(data: bytes) -> str:
    import hashlib

    return hashlib.sha256(data).hexdigest()


def _exact_integer(value: object, label: str, minimum: int = 0) -> int:
    if isinstance(value, bool) or not isinstance(value, int) or value < minimum:
        raise ValueError(f"{label} must be an integer >= {minimum}; received {value!r}.")
    return value


def _exact_text(value: object, label: str) -> str:
    if not isinstance(value, str) or not value:
        raise ValueError(f"{label} must be a non-empty string; received {value!r}.")
    return value


def _finite_number(value: object, label: str) -> float:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise ValueError(f"{label} must be a finite number; received {value!r}.")
    number = float(value)
    if not math.isfinite(number) or abs(number) > 1_000_000_000:
        raise ValueError(f"{label} is non-finite or exceeds the numeric boundary: {value!r}.")
    return number


def _finite_text_number(value: str, label: str) -> float:
    try:
        number = float(value)
    except ValueError as error:
        raise ValueError(f"{label} must be a finite decimal number; received {value!r}.") from error
    if not math.isfinite(number) or abs(number) > 1_000_000_000:
        raise ValueError(f"{label} is non-finite or exceeds the numeric boundary: {value!r}.")
    return number


def _normalized_number(value: float) -> int | float:
    if value == 0:
        return 0
    if value.is_integer() and abs(value) <= 9_007_199_254_740_991:
        return int(value)
    return value


def measure_bounds(points: list[tuple[float, float, float]]) -> dict[str, list[int | float]]:
    if not points:
        raise ValueError("Cannot measure bounds of an empty point set.")
    return {
        "min": [_normalized_number(min(point[axis] for point in points)) for axis in range(3)],
        "max": [_normalized_number(max(point[axis] for point in points)) for axis in range(3)],
    }


def _binary_vertices(
    binary: bytes, record: dict[str, object]
) -> tuple[list[tuple[float, float, float]], list[int], bytes]:
    design_id = _exact_text(record.get("id"), "native part id")
    position_offset = _exact_integer(
        record.get("positionByteOffset"), f"native part {design_id} positionByteOffset"
    )
    position_count = _exact_integer(
        record.get("positionCount"), f"native part {design_id} positionCount", 1
    )
    index_offset = _exact_integer(
        record.get("indexByteOffset"), f"native part {design_id} indexByteOffset"
    )
    index_count = _exact_integer(record.get("indexCount"), f"native part {design_id} indexCount", 3)
    if index_count % 3 != 0:
        raise ValueError(f"Native part {design_id} indexCount {index_count} is not a triangle list.")
    position_end = position_offset + position_count * 12
    index_end = index_offset + index_count * 4
    if position_end > len(binary):
        raise ValueError(f"Native part {design_id} position slice escapes the pinned binary payload.")
    if index_end > len(binary):
        raise ValueError(f"Native part {design_id} index slice escapes the pinned binary payload.")
    vertices = [
        struct.unpack_from("<fff", binary, position_offset + index * 12)
        for index in range(position_count)
    ]
    if any(not math.isfinite(value) for point in vertices for value in point):
        raise ValueError(f"Native part {design_id} contains a non-finite binary vertex.")
    indices = [
        struct.unpack_from("<I", binary, index_offset + index * 4)[0]
        for index in range(index_count)
    ]
    invalid = next((index for index in indices if index >= position_count), None)
    if invalid is not None:
        raise ValueError(
            f"Native part {design_id} index {invalid} is outside its {position_count} vertices."
        )
    referenced = set(indices)
    if len(referenced) != position_count:
        raise ValueError(
            f"Native part {design_id} indexes {len(referenced)} of its {position_count} vertices; "
            "unreferenced positions cannot contribute to a measured render surface."
        )
    for triangle_index in range(0, index_count, 3):
        first, second, third = (vertices[indices[triangle_index + offset]] for offset in range(3))
        ab = tuple(second[axis] - first[axis] for axis in range(3))
        ac = tuple(third[axis] - first[axis] for axis in range(3))
        cross = (
            ab[1] * ac[2] - ab[2] * ac[1],
            ab[2] * ac[0] - ab[0] * ac[2],
            ab[0] * ac[1] - ab[1] * ac[0],
        )
        if cross == (0.0, 0.0, 0.0):
            raise ValueError(
                f"Native part {design_id} triangle {triangle_index // 3} is degenerate in the "
                "checksum-pinned binary surface."
            )
    return vertices, indices, binary[position_offset:position_end] + binary[index_offset:index_end]


def _determinant(matrix: list[float]) -> float:
    return (
        matrix[0] * (matrix[4] * matrix[8] - matrix[5] * matrix[7])
        - matrix[1] * (matrix[3] * matrix[8] - matrix[5] * matrix[6])
        + matrix[2] * (matrix[3] * matrix[7] - matrix[4] * matrix[6])
    )


def _validate_proper_rotation(matrix: list[float], label: str) -> None:
    axes = tuple(tuple(matrix[row * 3 + column] for row in range(3)) for column in range(3))
    tolerance = 1e-9
    maximum_error = max(
        abs(
            sum(axes[left][axis] * axes[right][axis] for axis in range(3))
            - (1 if left == right else 0)
        )
        for left in range(3)
        for right in range(left, 3)
    )
    determinant_error = abs(_determinant(matrix) - 1)
    if maximum_error > tolerance or determinant_error > tolerance:
        raise ValueError(
            f"{label} must contain a proper orthonormal rotation within {tolerance:g}; "
            f"maximum axis error is {maximum_error:g} and determinant error is "
            f"{determinant_error:g}. Zero, scale, shear, duplicate axes, and reflections are invalid."
        )


def _primitive_matrix_kind(primitive: object, label: str) -> str:
    if not isinstance(primitive, dict) or not isinstance(primitive.get("attributes"), dict):
        raise ValueError(f"{label} must have an attributes object.")
    encoded = _exact_text(primitive["attributes"].get("transformation"), f"{label} transformation")
    fields = encoded.split(",")
    if len(fields) != 12:
        raise ValueError(f"{label} transformation needs 12 comma-separated numbers; found {len(fields)}.")
    values = [_finite_text_number(value, f"{label} transformation") for value in fields]
    matrix = values[:9]
    _validate_proper_rotation(matrix, label)
    tolerance = 0.000001
    signed_permutation = all(
        sum(abs(matrix[row * 3 + column]) > tolerance for column in range(3)) == 1
        for row in range(3)
    ) and all(
        sum(abs(matrix[row * 3 + column]) > tolerance for row in range(3)) == 1
        for column in range(3)
    ) and all(
        abs(abs(value) - 1) <= tolerance or abs(value) <= tolerance for value in matrix
    )
    if not signed_permutation:
        return "oriented"
    upright = (
        abs(matrix[3]) <= tolerance
        and abs(matrix[4] - 1) <= tolerance
        and abs(matrix[5]) <= tolerance
        and abs(matrix[1]) <= tolerance
        and abs(matrix[7]) <= tolerance
    )
    return "upright-axis-aligned" if upright else "axis-aligned-non-upright"


def _primitive_summary(primitives: object, label: str) -> dict[str, object]:
    if not isinstance(primitives, list):
        raise ValueError(f"{label} must be an array.")
    kinds: Counter[str] = Counter()
    matrices: Counter[str] = Counter()
    for index, primitive in enumerate(primitives):
        if not isinstance(primitive, dict):
            raise ValueError(f"{label}[{index}] must be an object.")
        kinds[_exact_text(primitive.get("kind"), f"{label}[{index}].kind")] += 1
        matrices[_primitive_matrix_kind(primitive, f"{label}[{index}]")] += 1
    return {
        "count": len(primitives),
        "kinds": dict(sorted(kinds.items())),
        "frames": dict(sorted(matrices.items())),
    }


def native_measurement(
    binary: bytes,
    record: dict[str, object],
    expected_record_sha256: str,
    expected_review_sha256: str,
) -> dict[str, object]:
    design_id = _exact_text(record.get("id"), "native part id")
    actual_record_sha256 = _exact_text(
        record.get("recordSha256"), f"native part {design_id} recordSha256"
    )
    if actual_record_sha256 != expected_record_sha256:
        raise ValueError(
            f"Native part {design_id} record digest {actual_record_sha256} differs from the reviewed "
            f"{expected_record_sha256}."
        )
    vertices, indices, binary_slices = _binary_vertices(binary, record)
    recomputed_record_sha256 = _sha256_hex(binary_slices)
    if recomputed_record_sha256 != actual_record_sha256:
        raise ValueError(
            f"Native part {design_id} binary slices hash to {recomputed_record_sha256}; embedded "
            f"recordSha256 is {actual_record_sha256}."
        )
    record_without_digest = {key: value for key, value in record.items() if key != "recordSha256"}
    canonical_record = json.dumps(
        record_without_digest,
        ensure_ascii=False,
        separators=(",", ":"),
        sort_keys=True,
    ).encode("utf-8")
    recomputed_review_sha256 = _sha256_hex(canonical_record + b"\0" + binary_slices)
    if recomputed_review_sha256 != expected_review_sha256:
        raise ValueError(
            f"Native part {design_id} complete record and binary review digest is "
            f"{recomputed_review_sha256}; expected {expected_review_sha256}."
        )
    measured_bounds = measure_bounds(vertices)
    declared = record.get("boundsLdu")
    if not isinstance(declared, dict) or set(declared) != {"min", "max"}:
        raise ValueError(f"Native part {design_id} boundsLdu must contain exactly min and max.")
    maximum_bound_drift = 0.0
    for side in ("min", "max"):
        coordinates = declared[side]
        if not isinstance(coordinates, list) or len(coordinates) != 3:
            raise ValueError(f"Native part {design_id} boundsLdu.{side} needs exactly three numbers.")
        for axis, value in enumerate(coordinates):
            maximum_bound_drift = max(
                maximum_bound_drift,
                abs(
                    _finite_number(value, f"native part {design_id} boundsLdu.{side}[{axis}]")
                    - float(measured_bounds[side][axis])
                ),
            )
    if maximum_bound_drift > 0.00001:
        raise ValueError(
            f"Native part {design_id} declared/binary bound drift is {maximum_bound_drift} LDU; "
            "allowed Float32/source conversion drift is 0.00001 LDU."
        )
    return {
        "revision": _exact_text(record.get("revision"), f"native part {design_id} revision"),
        "name": _exact_text(record.get("name"), f"native part {design_id} name"),
        "recordSha256": f"sha256:{actual_record_sha256}",
        "reviewedRecordSha256": f"sha256:{recomputed_review_sha256}",
        "vertexCount": len(vertices),
        "uniquePositionCount": len(set(vertices)),
        "triangleCount": len(indices) // 3,
        "boundsLdu": measured_bounds,
        "declaredToBinaryMaximumBoundDriftLdu": maximum_bound_drift,
        "connectivity": _primitive_summary(
            record.get("connectivityPrimitives"), f"native part {design_id} connectivityPrimitives"
        ),
        "collision": _primitive_summary(
            record.get("collisionPrimitives"), f"native part {design_id} collisionPrimitives"
        ),
    }


def validate_native_pack(
    value: object,
) -> tuple[dict[str, dict[str, object]], bytes, dict[str, object]]:
    if not isinstance(value, dict) or set(value) != NATIVE_TOP_LEVEL_KEYS:
        received = sorted(value) if isinstance(value, dict) else type(value).__name__
        raise ValueError(f"Native pack top-level keys differ from the exact schema: {received}.")
    expected_header = {
        "schemaVersion": "lego.builder-native-mesh-pack/1",
        "frameId": "lego-builder-native-to-catalog-ldu/1",
        "partCount": 107,
        "vertexCount": 42_440,
        "triangleCount": 38_549,
        "binaryBytes": NATIVE_BINARY_BYTES,
        "binarySha256": NATIVE_BINARY_SHA256,
    }
    for key, expected in expected_header.items():
        if value.get(key) != expected:
            raise ValueError(f"Native pack {key} is {value.get(key)!r}; expected {expected!r}.")
    encoded = _exact_text(value.get("binaryBase64"), "native pack binaryBase64")
    try:
        binary = base64.b64decode(encoded, validate=True)
    except ValueError as error:
        raise ValueError(f"Native pack binaryBase64 is not canonical base64: {error}") from error
    if len(binary) != NATIVE_BINARY_BYTES or _sha256_hex(binary) != NATIVE_BINARY_SHA256:
        raise ValueError("Native pack decoded binary does not reproduce its reviewed byte count and SHA-256.")
    parts = value.get("parts")
    if not isinstance(parts, list) or len(parts) != 107:
        raise ValueError(f"Native pack parts must contain exactly 107 records; received {type(parts).__name__}.")
    by_id: dict[str, dict[str, object]] = {}
    expected_offset = 0
    total_vertices = 0
    total_triangles = 0
    for index, record in enumerate(parts):
        if not isinstance(record, dict):
            raise ValueError(f"Native pack parts[{index}] must be an object.")
        design_id = _exact_text(record.get("id"), f"native pack parts[{index}].id")
        if not design_id.isdecimal() or design_id in by_id:
            raise ValueError(f"Native pack part id {design_id!r} is non-numeric or repeated.")
        position_offset = _exact_integer(
            record.get("positionByteOffset"), f"native part {design_id} positionByteOffset"
        )
        position_count = _exact_integer(
            record.get("positionCount"), f"native part {design_id} positionCount", 1
        )
        index_offset = _exact_integer(
            record.get("indexByteOffset"), f"native part {design_id} indexByteOffset"
        )
        index_count = _exact_integer(
            record.get("indexCount"), f"native part {design_id} indexCount", 3
        )
        if position_offset != expected_offset or index_offset != position_offset + position_count * 12:
            raise ValueError(
                f"Native part {design_id} slices begin at {position_offset}/{index_offset}; expected "
                f"gap-free offsets {expected_offset}/{position_offset + position_count * 12}."
            )
        if index_count % 3 != 0:
            raise ValueError(f"Native part {design_id} index count {index_count} is not divisible by three.")
        expected_offset = index_offset + index_count * 4
        total_vertices += position_count
        total_triangles += index_count // 3
        by_id[design_id] = record
    if expected_offset != len(binary) or total_vertices != 42_440 or total_triangles != 38_549:
        raise ValueError(
            f"Native pack slices cover {expected_offset}/{len(binary)} bytes, {total_vertices}/42440 "
            f"vertices, and {total_triangles}/38549 triangles."
        )
    header = {
        key: value[key] for key in sorted(NATIVE_TOP_LEVEL_KEYS - {"parts", "binaryBase64"})
    }
    return by_id, binary, header
