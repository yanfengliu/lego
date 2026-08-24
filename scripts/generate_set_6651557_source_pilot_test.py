from __future__ import annotations

import contextlib
import hashlib
import importlib.util
import io
import json
import sys
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest import mock


SCRIPT_PATH = Path(__file__).with_name("generate-set-6651557-source-pilot.py")
SPEC = importlib.util.spec_from_file_location("set_6651557_source_pilot", SCRIPT_PATH)
if SPEC is None or SPEC.loader is None:
    raise RuntimeError(f"Cannot load source pilot module from {SCRIPT_PATH}")
PILOT = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = PILOT
SPEC.loader.exec_module(PILOT)


class Set6651557SourcePilotTests(unittest.TestCase):
    def test_strict_json_rejects_duplicates_nonfinite_and_invalid_utf8(self) -> None:
        with self.assertRaisesRegex(ValueError, "repeats JSON key 'a'"):
            PILOT.strict_json(b'{"a":1,"a":2}', "duplicate")
        with self.assertRaisesRegex(ValueError, "forbidden non-finite JSON token"):
            PILOT.strict_json(b'{"a":NaN}', "nonfinite")
        with self.assertRaisesRegex(ValueError, "not strict UTF-8 at byte 0"):
            PILOT.strict_json(b"\xff", "invalid")

    def test_strict_json_enforces_depth_node_and_string_budgets(self) -> None:
        with mock.patch.object(PILOT, "MAX_JSON_DEPTH", 3):
            with self.assertRaisesRegex(ValueError, "maximum JSON depth 3"):
                PILOT.strict_json(b"[[[[]]]]", "deep")
        with mock.patch.object(PILOT, "MAX_JSON_NODES", 3):
            with self.assertRaisesRegex(ValueError, "maximum JSON node count 3"):
                PILOT.strict_json(b"[1,2,3]", "wide")
        with mock.patch.object(PILOT, "MAX_JSON_STRING_CHARACTERS", 3):
            with self.assertRaisesRegex(ValueError, "4-character string"):
                PILOT.strict_json(b'"abcd"', "long")
        with mock.patch.object(PILOT, "MAX_JSON_AGGREGATE_STRING_CHARACTERS", 5):
            with self.assertRaisesRegex(ValueError, "6 aggregate string characters"):
                PILOT.strict_json(b'["abc","def"]', "aggregate")

    def test_pinned_read_checks_exact_size_and_digest(self) -> None:
        # The reader under test requires a path inside the repository, so the
        # temporary directory is anchored here rather than in the system temp.
        # output/ is gitignored and therefore absent from a fresh clone, where
        # this raised FileNotFoundError and failed npm run verify.
        output_root = SCRIPT_PATH.parents[1] / "output"
        output_root.mkdir(parents=True, exist_ok=True)
        with tempfile.TemporaryDirectory(dir=output_root) as directory:
            path = Path(directory) / "pinned.bin"
            path.write_bytes(b"reviewed")
            digest = hashlib.sha256(b"reviewed").hexdigest()

            self.assertEqual(PILOT.read_pinned_file(path, 8, digest), b"reviewed")
            with self.assertRaisesRegex(ValueError, "expected exactly 7"):
                PILOT.read_pinned_file(path, 7, digest)
            with self.assertRaisesRegex(ValueError, "Re-acquire the reviewed bytes"):
                PILOT.read_pinned_file(path, 8, "0" * 64)

    def test_requires_all_nine_exact_unadmitted_audit_routes(self) -> None:
        self.assertEqual(
            PILOT.PILOT_DESIGN_IDS,
            ("5092", "30357", "35480", "51739", "77844", "93273", "15254", "2877", "3040"),
        )
        rows = [
            {
                "designId": design_id,
                "state": "ldraw-root-and-closure-resolved-not-admitted",
                "rootFileId": f"official:parts/{design_id}.dat",
            }
            for design_id in PILOT.PILOT_DESIGN_IDS
        ]

        self.assertEqual(
            PILOT.audited_roots({"parts": rows}),
            {
                design_id: ("official", f"parts/{design_id}.dat")
                for design_id in PILOT.PILOT_DESIGN_IDS
            },
        )
        rows[0]["state"] = "catalog-admitted"
        with self.assertRaisesRegex(ValueError, "reviewed unresolved-admission route"):
            PILOT.audited_roots({"parts": rows})

    def test_command_help_names_the_fixed_nine_part_packet(self) -> None:
        stdout = io.StringIO()
        with mock.patch.object(sys, "argv", [str(SCRIPT_PATH), "--help"]):
            with contextlib.redirect_stdout(stdout), self.assertRaises(SystemExit) as caught:
                PILOT.main()

        self.assertEqual(caught.exception.code, 0)
        self.assertIn(
            "Measure the fixed nine-part 6651557 source pilot without admitting catalog truth.",
            " ".join(stdout.getvalue().split()),
        )

    def test_stud3a_enters_only_the_new_3040_closure_in_the_tracked_audit(self) -> None:
        audit_path = (
            SCRIPT_PATH.parents[1]
            / "packages/catalog/src/quarantine/set-6651557-ldraw-source-audit.generated.json"
        )
        audit = PILOT.strict_json(audit_path.read_bytes(), audit_path)
        roots = PILOT.audited_roots(audit)
        files = PILOT.audited_file_table(audit)
        stud3a = ("official", "p/stud3a.dat")

        def closure(root: tuple[str, str]) -> set[tuple[str, str]]:
            pending = [root]
            seen: set[tuple[str, str]] = set()
            while pending:
                key = pending.pop()
                if key in seen:
                    continue
                seen.add(key)
                pending.extend(files[key][1])
            return seen

        closures = {design_id: closure(root) for design_id, root in roots.items()}
        self.assertEqual(
            [design_id for design_id, keys in closures.items() if stud3a in keys],
            ["3040"],
        )
        self.assertTrue(
            all(
                stud3a not in closures[design_id]
                for design_id in PILOT.PILOT_DESIGN_IDS[:-1]
            )
        )

    def test_audit_file_table_binds_manifest_digest_and_direct_references(self) -> None:
        row = {
            "archiveId": "official",
            "author": "Synthetic",
            "bytes": 12,
            "declaredName": "root.dat",
            "directReferences": [],
            "fileId": "official:parts/root.dat",
            "ldrawOrg": "Part",
            "licenseExpression": "CC-BY-4.0",
            "path": "parts/root.dat",
            "sha256": "sha256:" + "a" * 64,
            "title": "Synthetic root",
        }
        with mock.patch.object(PILOT, "SOURCE_AUDIT_FILE_COUNT", 1):
            table = PILOT.audited_file_table({"files": [row]})
            self.assertEqual(table[("official", "parts/root.dat")][0]["sha256"], row["sha256"])

            missing = {**row, "directReferences": ["official:p/missing.dat"]}
            with self.assertRaisesRegex(ValueError, "omits referenced records"):
                PILOT.audited_file_table({"files": [missing]})

    def test_audit_file_table_canonicalizes_reference_order(self) -> None:
        digest = "sha256:" + "a" * 64
        rows = []
        for path, references in (
            ("parts/root.dat", ["official:p/z.dat", "official:p/a.dat"]),
            ("p/a.dat", []),
            ("p/z.dat", []),
        ):
            rows.append(
                {
                    "archiveId": "official",
                    "author": "Synthetic",
                    "bytes": 12,
                    "declaredName": Path(path).name,
                    "directReferences": references,
                    "fileId": f"official:{path}",
                    "ldrawOrg": "Part",
                    "licenseExpression": "CC-BY-4.0",
                    "path": path,
                    "sha256": digest,
                    "title": "Synthetic source",
                }
            )

        with mock.patch.object(PILOT, "SOURCE_AUDIT_FILE_COUNT", 3):
            table = PILOT.audited_file_table({"files": rows})

        self.assertEqual(
            table[("official", "parts/root.dat")][1],
            (("official", "p/a.dat"), ("official", "p/z.dat")),
        )

    def test_ldraw_measurement_rejects_mutated_audit_manifest_and_references(self) -> None:
        key = ("official", "parts/root.dat")
        manifest = {
            "archiveId": "official",
            "author": "Synthetic",
            "bytes": 12,
            "declaredName": "root.dat",
            "ldrawOrg": "Part",
            "licenseExpression": "CC-BY-4.0",
            "path": "parts/root.dat",
            "sha256": "sha256:" + "a" * 64,
            "title": "Synthetic root",
        }
        record = SimpleNamespace(
            archive_id=key[0],
            path=key[1],
            byte_length=12,
            manifest_record=lambda: manifest,
        )

        class FakeLibrary:
            def closure(self, root: tuple[str, str]) -> list[object]:
                self.assert_root(root)
                return [record]

            def record(self, root: tuple[str, str]) -> object:
                self.assert_root(root)
                return record

            def dependencies(self, root: tuple[str, str]) -> tuple[tuple[str, str], ...]:
                self.assert_root(root)
                return (("official", "p/child.dat"),)

            @staticmethod
            def assert_root(root: tuple[str, str]) -> None:
                if root != key:
                    raise AssertionError(f"unexpected source root {root}")

        triangle = SimpleNamespace(
            certified=True,
            cull_enabled=True,
            points=((0.0, 0.0, 0.0), (1.0, 0.0, 0.0), (0.0, 1.0, 0.0)),
            role="body",
        )

        def expand_fixture(
            _library: object,
            root: tuple[str, str],
            _classifier: object,
            opened: object,
        ) -> list[object]:
            opened(root)
            return [triangle]

        mutations = (
            (
                ({**manifest, "sha256": "sha256:" + "b" * 64}, (("official", "p/child.dat"),)),
                "metadata or digest differs",
            ),
            (
                (manifest, (("official", "p/different.dat"),)),
                "resolves references",
            ),
        )
        with mock.patch.object(PILOT, "expand_surface", side_effect=expand_fixture):
            for audited, pattern in mutations:
                with self.subTest(pattern=pattern), self.assertRaisesRegex(ValueError, pattern):
                    PILOT.ldraw_measurement(
                        FakeLibrary(),
                        "root",
                        key,
                        {key: audited},
                        frozenset(),
                    )

    def test_pressure_helpers_report_fractional_and_general_frame_requirements(self) -> None:
        row = {
            "ldraw": {"boundsLdu": {"min": [-38.5, -4, -20], "max": [38.5, 8, 20]}},
            "builderNative": {
                "connectivity": {"frames": {"axis-aligned-non-upright": 2}},
                "collision": {"frames": {"oriented": 3}},
            },
        }

        self.assertTrue(PILOT.fractional_bound(row))
        self.assertEqual(PILOT.frame_count(row, "connectivity", "axis-aligned-non-upright"), 2)
        self.assertEqual(PILOT.frame_count(row, "collision", "oriented"), 3)

    def test_report_writer_is_canonical_atomic_and_confined_to_output(self) -> None:
        # The reader under test requires a path inside the repository, so the
        # temporary directory is anchored here rather than in the system temp.
        # output/ is gitignored and therefore absent from a fresh clone, where
        # this raised FileNotFoundError and failed npm run verify.
        output_root = SCRIPT_PATH.parents[1] / "output"
        output_root.mkdir(parents=True, exist_ok=True)
        with tempfile.TemporaryDirectory(dir=output_root) as directory:
            path = Path(directory) / "report.json"
            digest = PILOT.write_report(path, {"z": 2, "a": 1})
            payload = path.read_bytes()

            self.assertEqual(payload, b'{"a":1,"z":2}\n')
            self.assertEqual(digest, hashlib.sha256(payload).hexdigest())
            self.assertEqual(list(path.parent.glob(f".{path.name}.*.tmp")), [])

        with self.assertRaisesRegex(ValueError, "must stay below"):
            PILOT.write_report(SCRIPT_PATH.parents[1] / "escape.json", {"forbidden": True})


if __name__ == "__main__":
    unittest.main()
