from __future__ import annotations

import hashlib
import json
import struct
import unittest

from builder_native_source import (
    _primitive_matrix_kind,
    measure_bounds,
    native_measurement,
    validate_native_pack,
)


IDENTITY_PRIMITIVE = {
    "kind": "Box",
    "attributes": {"transformation": "1,0,0,0,1,0,0,0,1,0,0,0"},
}


def fixture(
    *,
    indices: tuple[int, ...] = (0, 1, 2),
    declared_max_x: float = 1.0,
    unused_vertex: bool = False,
) -> tuple[bytes, dict[str, object]]:
    vertices = ((0.0, 0.0, 0.0), (1.0, 0.0, 0.0), (0.0, 1.0, 0.0))
    if unused_vertex:
        vertices = (*vertices, (2.0, 2.0, 2.0))
    position_bytes = b"".join(struct.pack("<fff", *point) for point in vertices)
    index_bytes = b"".join(struct.pack("<I", index) for index in indices)
    binary = position_bytes + index_bytes
    record: dict[str, object] = {
        "id": "123",
        "revision": "A",
        "name": "synthetic",
        "recordSha256": hashlib.sha256(position_bytes + index_bytes).hexdigest(),
        "positionByteOffset": 0,
        "positionCount": len(vertices),
        "indexByteOffset": len(position_bytes),
        "indexCount": len(indices),
        "boundsLdu": {"min": [0, 0, 0], "max": [declared_max_x, 1, 0]},
        "connectivityPrimitives": [IDENTITY_PRIMITIVE],
        "collisionPrimitives": [IDENTITY_PRIMITIVE],
    }
    return binary, record


def review_digest(binary: bytes, record: dict[str, object]) -> str:
    position_offset = int(record["positionByteOffset"])
    position_end = position_offset + int(record["positionCount"]) * 12
    index_offset = int(record["indexByteOffset"])
    index_end = index_offset + int(record["indexCount"]) * 4
    canonical_record = json.dumps(
        {key: value for key, value in record.items() if key != "recordSha256"},
        ensure_ascii=False,
        separators=(",", ":"),
        sort_keys=True,
    ).encode("utf-8")
    return hashlib.sha256(
        canonical_record + b"\0" + binary[position_offset:position_end] + binary[index_offset:index_end]
    ).hexdigest()


def measure(binary: bytes, record: dict[str, object]) -> dict[str, object]:
    return native_measurement(
        binary,
        record,
        str(record["recordSha256"]),
        review_digest(binary, record),
    )


class BuilderNativeSourceTests(unittest.TestCase):
    def test_measures_checksum_bound_binary_without_promoting_primitive_truth(self) -> None:
        binary, record = fixture()

        measured = measure(binary, record)

        self.assertEqual(measured["vertexCount"], 3)
        self.assertEqual(measured["triangleCount"], 1)
        self.assertEqual(measured["boundsLdu"], {"min": [0, 0, 0], "max": [1, 1, 0]})
        self.assertEqual(
            measured["connectivity"],
            {
                "count": 1,
                "kinds": {"Box": 1},
                "frames": {"upright-axis-aligned": 1},
            },
        )

    def test_rejects_index_escape_before_measuring(self) -> None:
        binary, record = fixture(indices=(0, 1, 3))

        with self.assertRaisesRegex(ValueError, "index 3.*outside its 3 vertices"):
            measure(binary, record)

    def test_rejects_unreferenced_positions_and_degenerate_triangles(self) -> None:
        binary, record = fixture(unused_vertex=True)
        with self.assertRaisesRegex(ValueError, "indexes 3 of its 4 vertices"):
            measure(binary, record)

        binary, record = fixture(indices=(0, 1, 1, 0, 1, 2))
        with self.assertRaisesRegex(ValueError, "triangle 0 is degenerate"):
            measure(binary, record)

    def test_rejects_record_digest_and_declared_bound_drift(self) -> None:
        binary, record = fixture()
        with self.assertRaisesRegex(ValueError, "differs from the reviewed"):
            native_measurement(binary, record, "b" * 64, review_digest(binary, record))

        binary, record = fixture(declared_max_x=1.1)
        with self.assertRaisesRegex(ValueError, "declared/binary bound drift"):
            measure(binary, record)

    def test_recomputes_binary_and_complete_record_digests(self) -> None:
        binary, record = fixture()
        original_review = review_digest(binary, record)

        changed_binary = bytes([binary[0] ^ 1]) + binary[1:]
        with self.assertRaisesRegex(ValueError, "binary slices hash to"):
            native_measurement(
                changed_binary,
                record,
                str(record["recordSha256"]),
                original_review,
            )

        changed_record = {**record, "name": "mutated metadata"}
        with self.assertRaisesRegex(ValueError, "complete record and binary review digest"):
            native_measurement(
                binary,
                changed_record,
                str(record["recordSha256"]),
                original_review,
            )

    def test_classifies_upright_non_upright_and_oriented_frames(self) -> None:
        non_upright = {
            "kind": "Slider",
            "attributes": {"transformation": "1,0,0,0,0,-1,0,1,0,0,0,0"},
        }
        oriented = {
            "kind": "Box",
            "attributes": {
                "transformation": (
                    "1,0,0,0,0.5,-0.8660254037844386,0,0.8660254037844386,0.5,0,0,0"
                )
            },
        }

        self.assertEqual(_primitive_matrix_kind(IDENTITY_PRIMITIVE, "identity"), "upright-axis-aligned")
        self.assertEqual(_primitive_matrix_kind(non_upright, "slider"), "axis-aligned-non-upright")
        self.assertEqual(_primitive_matrix_kind(oriented, "box"), "oriented")

    def test_rejects_malformed_or_nonfinite_transform_before_classification(self) -> None:
        short = {"kind": "Box", "attributes": {"transformation": "1,0,0"}}
        nonfinite = {
            "kind": "Box",
            "attributes": {"transformation": "1,0,0,0,1,0,0,0,nan,0,0,0"},
        }

        with self.assertRaisesRegex(ValueError, "needs 12"):
            _primitive_matrix_kind(short, "short")
        with self.assertRaisesRegex(ValueError, "non-finite"):
            _primitive_matrix_kind(nonfinite, "nonfinite")

    def test_rejects_nonrigid_or_reflected_primitive_frames(self) -> None:
        matrices = {
            "zero": "0,0,0,0,0,0,0,0,0,0,0,0",
            "scale": "2,0,0,0,1,0,0,0,1,0,0,0",
            "shear": "1,0.1,0,0,1,0,0,0,1,0,0,0",
            "duplicate": "1,0,0,1,0,0,0,0,1,0,0,0",
            "reflection": "-1,0,0,0,1,0,0,0,1,0,0,0",
        }
        for label, transformation in matrices.items():
            with self.subTest(label=label):
                primitive = {"kind": "Box", "attributes": {"transformation": transformation}}
                with self.assertRaisesRegex(ValueError, "proper orthonormal rotation"):
                    _primitive_matrix_kind(primitive, label)

    def test_normalizes_negative_zero_in_measured_bounds(self) -> None:
        self.assertEqual(
            measure_bounds([(-0.0, -1.0, 2.5), (0.0, 3.0, 4.5)]),
            {"min": [0, -1, 2.5], "max": [0, 3, 4.5]},
        )

    def test_rejects_wrong_native_schema_before_decoding_payload(self) -> None:
        with self.assertRaisesRegex(ValueError, "top-level keys differ"):
            validate_native_pack({"binaryBase64": "would otherwise allocate"})


if __name__ == "__main__":
    unittest.main()
