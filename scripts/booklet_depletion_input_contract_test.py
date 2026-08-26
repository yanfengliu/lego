"""Exact retained-role closure tests for the booklet depletion report."""

from __future__ import annotations

import hashlib
import json
import tempfile
import unittest
from pathlib import Path

from booklet_depletion_input_contract import (
    ADJUDICATED_JSON,
    COVERAGE,
    PDF,
    REQUIRED_JSON,
    load_depletion_inputs,
)
from part_identification_report_contract_test_fixture import (
    materialize_report_contract_fixture,
    report_contract_test_verifier_patch,
)


_TEST_VERIFIER_PATCH = None


def setUpModule() -> None:
    global _TEST_VERIFIER_PATCH
    _TEST_VERIFIER_PATCH = report_contract_test_verifier_patch()
    _TEST_VERIFIER_PATCH.start()


def tearDownModule() -> None:
    if _TEST_VERIFIER_PATCH is not None:
        _TEST_VERIFIER_PATCH.stop()


def write_bytes(path: Path, value: bytes) -> str:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(value)
    return "sha256:" + hashlib.sha256(value).hexdigest()


def write_json(path: Path, value: object) -> str:
    return write_bytes(path, (json.dumps(value) + "\n").encode("utf-8"))


def descriptor() -> dict:
    return {
        "aspect": 1,
        "boxHeight": 1,
        "boxWidth": 1,
        "colours": [{"rgb": [0, 0, 0], "share": 1}],
        "detail": [0] * 784,
        "grid": [0] * 784,
        "ink": 1,
        "lightFace": 0,
        "mean": [0, 0, 0],
        "pixels": 1,
    }


class DepletionInputClosureTests(unittest.TestCase):
    def materialize(self, root: Path, *, source: str = "adjudicated") -> dict[str, Path]:
        materialize_report_contract_fixture(root, coverage_source=source)
        paths = {role: root / relative for role, relative in REQUIRED_JSON.items()}
        paths.update({role: root / relative for role, relative in ADJUDICATED_JSON.items()})
        paths["pdf"] = root / PDF
        paths["coverage"] = root / COVERAGE
        cards = json.loads(paths["cards"].read_text(encoding="utf-8"))
        paths["cardImages"] = paths["cards"].parent / cards["imagesFile"]
        if source == "deterministic":
            paths["answers"].unlink()
            paths["cardImages"].unlink()
            paths["cards"].unlink()
        return paths

    def case(self, *, source: str = "adjudicated") -> tuple[Path, dict[str, Path]]:
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        root = Path(temporary.name)
        return root, self.materialize(root, source=source)

    def load(self, root: Path, paths: dict[str, Path]):
        return load_depletion_inputs(root, paths["coverage"])

    def test_current_adjudicated_closure_hashes_every_consumed_role(self) -> None:
        root, paths = self.case()
        loaded = self.load(root, paths)
        self.assertEqual(
            set(loaded.role_digests),
            {
                "pdf",
                "calloutManifest",
                "features",
                "match",
                "distances",
                "elementResolution",
                "pairJudged",
                "sourceArtRebound",
                "cards",
                "cardImages",
                "answers",
            },
        )

    def test_current_deterministic_closure_does_not_require_adjudication_files(self) -> None:
        root, paths = self.case(source="deterministic")
        loaded = self.load(root, paths)
        self.assertNotIn("cards", loaded.role_digests)
        self.assertNotIn("cardImages", loaded.role_digests)
        self.assertNotIn("answers", loaded.role_digests)

    def test_stale_pair_cards_images_answers_pdf_and_manifest_are_refused(self) -> None:
        expected_error = {
            "pairJudged": "pairJudged",
            "cards": "cards",
            "cardImages": "cardImages",
            "answers": "answers",
            "pdf": "PDF",
            "calloutManifest": "callout manifest",
            "sourceArtRebound": "sourceArtRebound",
        }
        for role in (
            "pairJudged",
            "cards",
            "cardImages",
            "answers",
            "pdf",
            "calloutManifest",
            "sourceArtRebound",
        ):
            with self.subTest(role=role):
                root, paths = self.case()
                path = paths[role]
                if path.suffix == ".json":
                    value = json.loads(path.read_text(encoding="utf-8"))
                    if role == "pairJudged":
                        value["note"] = "changed retained truth bytes"
                    else:
                        value["staleMarker"] = role
                    write_json(path, value)
                else:
                    write_bytes(path, path.read_bytes() + b" stale")
                with self.assertRaisesRegex(SystemExit, expected_error[role]):
                    self.load(root, paths)

    def test_missing_retained_roles_are_refused_by_path(self) -> None:
        for role in (
            "pairJudged",
            "cards",
            "cardImages",
            "answers",
            "pdf",
            "calloutManifest",
            "sourceArtRebound",
        ):
            with self.subTest(role=role):
                root, paths = self.case()
                paths[role].unlink()
                with self.assertRaisesRegex(SystemExit, "could not be inspected"):
                    self.load(root, paths)

    def test_coverage_missing_any_required_digest_role_is_refused(self) -> None:
        required = (
            "pdf",
            "calloutManifest",
            "features",
            "match",
            "distances",
            "elementResolution",
            "pairJudged",
            "sourceArtRebound",
            "cards",
            "cardImages",
            "answers",
        )
        for role in required:
            with self.subTest(role=role):
                root, paths = self.case()
                coverage = json.loads(paths["coverage"].read_text(encoding="utf-8"))
                del coverage["inputDigests"][role]
                write_json(paths["coverage"], coverage)
                with self.assertRaisesRegex(SystemExit, "must contain exactly"):
                    self.load(root, paths)

    def test_coverage_v1_has_no_implicit_historical_path(self) -> None:
        root, paths = self.case()
        coverage = json.loads(paths["coverage"].read_text(encoding="utf-8"))
        coverage["schemaVersion"] = "lego.real-build-catalog-coverage/1"
        write_json(paths["coverage"], coverage)
        with self.assertRaisesRegex(SystemExit, "coverage/3"):
            self.load(root, paths)
