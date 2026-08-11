"""Synthetic gates for the bounded visual-admission LDraw materializer."""

from __future__ import annotations

import hashlib
import json
import runpy
import tempfile
import unittest
from pathlib import Path


MODULE = runpy.run_path(
    str(Path(__file__).with_name("materialize-ldraw-visual-admission.py")),
    run_name="visual_admission_materializer_tests",
)


class MaterializerTests(unittest.TestCase):
    def test_synthetic_archives_and_exact_closure_are_reproducibly_pinned(self) -> None:
        official, unofficial = MODULE["synthetic_archive_bytes"]()
        pins = MODULE["synthetic_pins"](official, unofficial)
        self.assertEqual(hashlib.sha256(official).hexdigest(), MODULE["SYNTHETIC_OFFICIAL_SHA256"])
        self.assertEqual(
            hashlib.sha256(unofficial).hexdigest(), MODULE["SYNTHETIC_UNOFFICIAL_SHA256"]
        )
        with tempfile.TemporaryDirectory(prefix="lego-visual-admission-materializer-test-") as raw:
            directory = Path(raw)
            official_path = directory / pins[0].logical_name
            unofficial_path = directory / pins[1].logical_name
            official_path.write_bytes(official)
            unofficial_path.write_bytes(unofficial)
            output = directory / "materialized"
            manifest = MODULE["materialize"](
                archive_paths={"official": official_path, "unofficial": unofficial_path},
                pins=pins,
                root_archive="official",
                root_path="parts/asymmetric.dat",
                output=output,
                source_labels={
                    "official": "generated-checksum-pinned-synthetic-fixture",
                    "unofficial": "generated-checksum-pinned-synthetic-fixture",
                },
            )
            retained = json.loads((output / "manifest.json").read_text(encoding="utf-8"))

            self.assertEqual(retained, manifest)
            self.assertEqual(retained["root"]["fileId"], "official:parts/asymmetric.dat")
            self.assertEqual(retained["fileCount"], 1)
            self.assertEqual(
                (output / "library" / "parts" / "asymmetric.dat").read_text(encoding="utf-8"),
                MODULE["SYNTHETIC_ROOT_TEXT"],
            )

    def test_fixture_byte_change_requires_an_explicit_pin_update(self) -> None:
        official, unofficial = MODULE["synthetic_archive_bytes"]()
        with self.assertRaisesRegex(ValueError, "Review the fixture geometry and repin"):
            MODULE["synthetic_pins"](official + b"tamper", unofficial)


if __name__ == "__main__":
    unittest.main(verbosity=2)
