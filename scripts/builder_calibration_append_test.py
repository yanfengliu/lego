from __future__ import annotations

import hashlib
import importlib.util
import unittest
from pathlib import Path
from types import ModuleType


def load_appender() -> ModuleType:
    path = Path(__file__).resolve().with_name("append-builder-calibration.py")
    spec = importlib.util.spec_from_file_location("builder_calibration_appender", path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Cannot load {path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


APPENDER = load_appender()


def digest(payload: bytes) -> str:
    return hashlib.sha256(payload).hexdigest()


class AppendBuilderCalibrationTests(unittest.TestCase):
    def fixture(self) -> tuple[bytes, bytes, bytes, dict[str, object]]:
        base = b"base"
        builder = b"b" * 36
        ldraw = b"l" * 72
        design: dict[str, object] = {
            "builderGeometry": {
                "byteOffset": len(base),
                "byteLength": len(builder),
                "digest": f"sha256:{digest(builder)}",
                "triangleCount": 1,
            },
            "ldrawReferenceGeometry": {
                "byteOffset": len(base) + len(builder),
                "byteLength": len(ldraw),
                "digest": f"sha256:{digest(ldraw)}",
                "triangleCount": 2,
            },
        }
        return base, builder, ldraw, design

    def assemble(self, base: bytes, builder: bytes, ldraw: bytes, design: dict[str, object]) -> bytes:
        expected = base + builder + ldraw
        return APPENDER.assemble_append_only(
            base,
            builder,
            ldraw,
            design,
            base_bytes=len(base),
            base_digest=digest(base),
            final_bytes=len(expected),
            final_digest=digest(expected),
        )

    def test_appends_only_the_two_reviewed_contiguous_slices(self) -> None:
        base, builder, ldraw, design = self.fixture()
        self.assertEqual(self.assemble(base, builder, ldraw, design), base + builder + ldraw)

    def test_reproves_the_prefix_inside_an_exact_final_bundle(self) -> None:
        base, builder, ldraw, _ = self.fixture()
        final = base + builder + ldraw
        prefix, state = APPENDER.reviewed_base_prefix(
            final,
            base_bytes=len(base),
            base_digest=digest(base),
            final_bytes=len(final),
            final_digest=digest(final),
        )
        self.assertEqual((prefix, state), (base, "reviewed-final-bundle"))

        corrupted = final[:-1] + bytes([final[-1] ^ 1])
        with self.assertRaisesRegex(ValueError, "expected either the exact"):
            APPENDER.reviewed_base_prefix(
                corrupted,
                base_bytes=len(base),
                base_digest=digest(base),
                final_bytes=len(final),
                final_digest=digest(final),
            )

    def test_refuses_base_slice_and_final_digest_drift(self) -> None:
        base, builder, ldraw, design = self.fixture()
        with self.assertRaisesRegex(ValueError, "Base Builder geometry"):
            APPENDER.assemble_append_only(
                base + b"x",
                builder,
                ldraw,
                design,
                base_bytes=len(base),
                base_digest=digest(base),
                final_bytes=len(base + builder + ldraw),
                final_digest=digest(base + builder + ldraw),
            )

        builder_pin = design["builderGeometry"]
        assert isinstance(builder_pin, dict)
        builder_pin["byteOffset"] = len(base) + 1
        with self.assertRaisesRegex(ValueError, "Appended Builder Shell"):
            self.assemble(base, builder, ldraw, design)

        base, builder, ldraw, design = self.fixture()
        with self.assertRaisesRegex(ValueError, "Final Builder geometry"):
            APPENDER.assemble_append_only(
                base,
                builder,
                ldraw,
                design,
                base_bytes=len(base),
                base_digest=digest(base),
                final_bytes=len(base + builder + ldraw),
                final_digest="0" * 64,
            )


if __name__ == "__main__":
    unittest.main()
