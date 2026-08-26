"""Focused hostile tests for report-side action-ledger authentication."""

from __future__ import annotations

import copy
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from part_action_ledger_report_contract import require_action_ledger_report_chain
from part_identification_report_contract import (
    ArtifactContractError,
    read_binary_artifact,
    read_json_artifact,
    read_text_artifact,
)
from part_identification_report_contract_test_fixture import (
    materialize_report_contract_fixture,
    report_contract_test_verifier_patch,
)
from part_identification_report_io import (
    BUILDER_GEOMETRY_EXACT_BYTES,
    MAX_BOOKLET_PDF_BYTES,
)


def sha(character: str) -> str:
    return "sha256:" + character * 64


_TEST_VERIFIER_PATCH = None


def setUpModule() -> None:
    global _TEST_VERIFIER_PATCH
    _TEST_VERIFIER_PATCH = report_contract_test_verifier_patch()
    _TEST_VERIFIER_PATCH.start()


def tearDownModule() -> None:
    if _TEST_VERIFIER_PATCH is not None:
        _TEST_VERIFIER_PATCH.stop()


def closure(root: Path) -> dict:
    def json_role(relative: str, label: str) -> tuple[object, str]:
        return read_json_artifact(root / relative, label)

    ledger, ledger_digest = json_role("output/real-build/action-ledger.json", "Test ledger")
    coverage, coverage_digest = json_role("output/real-build/catalog-coverage.json", "Test coverage")
    features, features_digest = json_role("output/part-identification/features.json", "Test features")
    _, manifest_digest = json_role("output/callout-thumbnails/manifest.json", "Test manifest")
    _, calibration_digest = json_role(
        "output/real-build/builder-canonical-calibration.json", "Test calibration"
    )
    _, transitions_digest = json_role(
        "output/real-build/transition-classifications.json", "Test transitions"
    )
    official_text, official_digest = read_text_artifact(
        root / "output/official-model/vx1087034_21066_a.xml", "Test official model"
    )
    _, booklet_digest = read_binary_artifact(
        root / "recipes/6651557.pdf",
        "Test booklet",
        max_bytes=MAX_BOOKLET_PDF_BYTES,
    )
    _, geometry_digest = read_binary_artifact(
        root / "output/real-build/builder-shell-geometry.bin",
        "Test Builder geometry",
        max_bytes=BUILDER_GEOMETRY_EXACT_BYTES,
        exact_bytes=BUILDER_GEOMETRY_EXACT_BYTES,
    )
    return {
        "ledger": ledger,
        "ledger_digest": ledger_digest,
        "coverage": coverage,
        "coverage_digest": coverage_digest,
        "features": features,
        "features_digest": features_digest,
        "callout_manifest_digest": manifest_digest,
        "official_model_text": official_text,
        "official_model_digest": official_digest,
        "builder_calibration_digest": calibration_digest,
        "transition_classifications_digest": transitions_digest,
        "booklet_pdf_digest": booklet_digest,
        "builder_geometry_digest": geometry_digest,
    }


class ActionLedgerReportContractTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        materialize_report_contract_fixture(self.root)

    def test_one_exact_bounded_direct_piece_is_accepted(self) -> None:
        require_action_ledger_report_chain(**closure(self.root))

    def test_current_v3_is_required_and_legacy_v2_is_not_admitted(self) -> None:
        arguments = closure(self.root)
        arguments["ledger"]["schemaVersion"] = "lego.real-build-action-ledger/2"
        with self.assertRaisesRegex(
            ArtifactContractError, "must use lego.real-build-action-ledger/3"
        ):
            require_action_ledger_report_chain(**arguments)

    def test_every_consumed_digest_edge_is_required(self) -> None:
        arguments = closure(self.root)
        for field, declared in (
            ("coverage_digest", "coverageDigest"),
            ("official_model_digest", "officialModelDigest"),
            ("callout_manifest_digest", "calloutManifestDigest"),
            ("builder_calibration_digest", "builderCalibrationDigest"),
            ("transition_classifications_digest", "transitionClassificationsDigest"),
        ):
            with self.subTest(field=field):
                forged = copy.deepcopy(arguments)
                forged[field] = sha("f")
                with self.assertRaisesRegex(ArtifactContractError, declared):
                    require_action_ledger_report_chain(**forged)

    def test_hostile_digest_diagnostic_is_bounded(self) -> None:
        arguments = closure(self.root)
        arguments["ledger_digest"] = "x" * 1_000_000
        with self.assertRaises(ArtifactContractError) as raised:
            require_action_ledger_report_chain(**arguments)
        self.assertLess(len(str(raised.exception)), 512)
        self.assertIn("string length 1000000", str(raised.exception))

    def test_a_brick_from_another_official_element_cannot_become_callout_truth(self) -> None:
        arguments = closure(self.root)
        step = arguments["ledger"]["steps"][0]
        step["callouts"][0]["physicalBrickRefs"] = ["brick-2"]
        step["action"]["pieces"][0]["brickRef"] = "brick-2"
        with self.assertRaisesRegex(
            ArtifactContractError,
            "exact official Brick 'brick-2'.*reconciled coverage/ledger/official-model",
        ):
            require_action_ledger_report_chain(**arguments)

    def test_a_piece_cannot_mint_a_trusted_confidence_or_callout_identity(self) -> None:
        for field, value, message in (
            ("identificationConfidence", "self-contradicted", "not a trusted coverage label"),
            ("calloutKey", "p١١|q1|x1.000|y2.000", "canonical ASCII callout identity"),
        ):
            with self.subTest(field=field):
                arguments = closure(self.root)
                arguments["ledger"]["steps"][0]["action"]["pieces"][0][field] = value
                with self.assertRaisesRegex(ArtifactContractError, message):
                    require_action_ledger_report_chain(**arguments)

    def test_provenance_counts_cannot_hide_extra_or_missing_direct_pieces(self) -> None:
        arguments = closure(self.root)
        arguments["ledger"]["provenance"]["directPieceCount"] = 0
        with self.assertRaisesRegex(
            ArtifactContractError, "directPieceCount is 0.*action.pieces contain 1"
        ):
            require_action_ledger_report_chain(**arguments)

    def test_requested_prefix_is_required_and_bounded_by_the_printed_booklet(self) -> None:
        for requested, message in (
            (None, "must contain exactly.*requestedLastStep"),
            (0, "requestedLastStep.*from 1 through 359"),
            (360, "requestedLastStep.*from 1 through 359"),
        ):
            with self.subTest(requested=requested):
                arguments = closure(self.root)
                provenance = arguments["ledger"]["provenance"]
                if requested is None:
                    del provenance["requestedLastStep"]
                else:
                    provenance["requestedLastStep"] = requested
                with self.assertRaisesRegex(ArtifactContractError, message):
                    require_action_ledger_report_chain(**arguments)

    def test_requested_prefix_must_match_coverage_but_may_retain_honest_partial_progress(self) -> None:
        arguments = closure(self.root)
        arguments["ledger"]["provenance"]["requestedLastStep"] = 50
        with self.assertRaisesRegex(
            ArtifactContractError, "requestedLastStep is 50.*coverage.lastStep is 1"
        ):
            require_action_ledger_report_chain(**arguments)

        arguments["coverage"]["lastStep"] = 50
        with patch("part_action_ledger_report_contract.verify_action_ledger"):
            require_action_ledger_report_chain(**arguments)

    def test_tail_rows_and_extra_provenance_fields_are_rejected(self) -> None:
        arguments = closure(self.root)
        arguments["ledger"]["provenance"]["unexpectedTailPermission"] = True
        with self.assertRaisesRegex(ArtifactContractError, "must contain exactly"):
            require_action_ledger_report_chain(**arguments)

        arguments = closure(self.root)
        arguments["ledger"]["steps"].append(
            {
                "stepNumber": 2,
                "pageNumber": 11,
                "panelEvidenceDigest": sha("a"),
                "callouts": [],
                "action": {
                    "kind": "transition",
                    "transition": "rotation",
                    "classificationEvidenceDigest": sha("b"),
                },
            }
        )
        arguments["ledger"]["provenance"]["alignedThroughStep"] = 2
        arguments["ledger"]["provenance"]["transitionStepCount"] = 1
        with self.assertRaisesRegex(
            ArtifactContractError, "alignedThroughStep.*from 1 through 1"
        ):
            require_action_ledger_report_chain(**arguments)

    def test_independently_rehashed_piece_evidence_is_not_canonical(self) -> None:
        path = self.root / "output/real-build/action-ledger.json"
        ledger = json.loads(path.read_text(encoding="utf-8"))
        ledger["steps"][0]["action"]["pieces"][0]["evidenceDigest"] = sha("f")
        path.write_text(json.dumps(ledger, indent=1) + "\n", encoding="utf-8")
        arguments = closure(self.root)
        with self.assertRaisesRegex(ArtifactContractError, "Canonical JavaScript action-ledger"):
            require_action_ledger_report_chain(**arguments)


if __name__ == "__main__":
    unittest.main()
