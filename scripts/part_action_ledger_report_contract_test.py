"""Focused hostile tests for report-side action-ledger authentication."""

from __future__ import annotations

import copy
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import part_identification_verification_bridge as verification_bridge
from part_action_ledger_field_names import TRANSITION_CLASSIFICATIONS_DIGEST_FIELD
from part_action_ledger_report_contract import require_action_ledger_report_chain
from part_identification_report_contract import (
    ArtifactContractError,
    read_binary_artifact,
    read_card_images_artifact,
    read_json_artifact,
    read_text_artifact,
)
from part_identification_report_contract_test_fixture import (
    TEST_VERIFIER,
    materialize_report_contract_fixture,
    report_contract_test_verifier_patch,
)
from part_identification_report_io import (
    BUILDER_GEOMETRY_EXACT_BYTES,
    MAX_BOOKLET_PDF_BYTES,
)


def sha(character: str) -> str:
    return "sha256:" + character * 64


def closure(root: Path) -> dict:
    def json_role(relative: str, label: str) -> tuple[object, str]:
        return read_json_artifact(root / relative, label)

    ledger, ledger_digest = json_role("output/real-build/action-ledger.json", "Test ledger")
    coverage, coverage_digest = json_role("output/real-build/catalog-coverage.json", "Test coverage")
    features, features_digest = json_role("output/part-identification/features.json", "Test features")
    match, match_digest = json_role("output/part-identification/match.json", "Test match")
    distances, distances_digest = json_role(
        "output/part-identification/distances.json", "Test distances"
    )
    element_resolution, element_resolution_digest = json_role(
        "output/part-identification/element-resolution.json", "Test element resolution"
    )
    pair_judged, pair_judged_digest = json_role(
        "scripts/fixtures/part-identification-truth-first50.json", "Test pair truth"
    )
    if coverage["identification"]["source"] == "adjudicated":
        cards, cards_digest = json_role(
            "output/part-identification/cards/manifest.json", "Test cards"
        )
        answers, answers_digest = json_role(
            "output/part-identification/answers-claude-opus-5.json", "Test answers"
        )
        _, card_images_digest = read_card_images_artifact(
            root / "output/part-identification/cards", cards
        )
    else:
        cards = cards_digest = card_images_digest = answers = answers_digest = None
    _, manifest_digest = json_role("output/callout-thumbnails/manifest.json", "Test manifest")
    _, source_art_rebound_digest = json_role(
        "output/part-identification/source-art-rebound.json", "Test source-art rebound"
    )
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
        "match": match,
        "match_digest": match_digest,
        "distances": distances,
        "distances_digest": distances_digest,
        "element_resolution": element_resolution,
        "element_resolution_digest": element_resolution_digest,
        "pair_judged": pair_judged,
        "pair_judged_digest": pair_judged_digest,
        "cards": cards,
        "cards_digest": cards_digest,
        "card_images_digest": card_images_digest,
        "answers": answers,
        "answers_digest": answers_digest,
        "callout_manifest_digest": manifest_digest,
        "source_art_rebound_digest": source_art_rebound_digest,
        "official_model_text": official_text,
        "official_model_digest": official_digest,
        "builder_calibration_digest": calibration_digest,
        "transition_classifications_digest": transitions_digest,
        "booklet_pdf_digest": booklet_digest,
        "builder_geometry_digest": geometry_digest,
    }


class ActionLedgerReportContractTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        test_verifier_patch = report_contract_test_verifier_patch()
        test_verifier_patch.start()
        cls.addClassCleanup(test_verifier_patch.stop)

    def setUp(self) -> None:
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        materialize_report_contract_fixture(self.root)

    def test_synthetic_verifier_fixture_follows_the_class_across_collection(self) -> None:
        self.assertEqual(verification_bridge.BRIDGE_PATH, TEST_VERIFIER)

    def test_one_exact_bounded_direct_piece_is_accepted(self) -> None:
        require_action_ledger_report_chain(**closure(self.root))

    def test_deterministic_closure_omits_adjudication_roles_and_rejects_extras(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            materialize_report_contract_fixture(root, coverage_source="deterministic")
            arguments = closure(root)
            for field in (
                "cards",
                "cards_digest",
                "card_images_digest",
                "answers",
                "answers_digest",
            ):
                self.assertIsNone(arguments[field])
            require_action_ledger_report_chain(**arguments)

            arguments["cards"] = {}
            arguments["cards_digest"] = sha("a")
            arguments["card_images_digest"] = sha("b")
            arguments["answers"] = {}
            arguments["answers_digest"] = sha("c")
            with self.assertRaisesRegex(
                ArtifactContractError, "Deterministic.*must omit"
            ):
                require_action_ledger_report_chain(**arguments)

    def test_adjudicated_closure_requires_every_adjudication_role(self) -> None:
        arguments = closure(self.root)
        for field in (
            "cards",
            "cards_digest",
            "card_images_digest",
            "answers",
            "answers_digest",
        ):
            arguments[field] = None
        with self.assertRaisesRegex(ArtifactContractError, "Adjudicated.*requires exact"):
            require_action_ledger_report_chain(**arguments)

    def test_registered_mandatory_roles_cannot_be_swapped(self) -> None:
        arguments = closure(self.root)
        arguments["match"] = arguments["distances"]
        arguments["match_digest"] = arguments["distances_digest"]
        with self.assertRaisesRegex(ArtifactContractError, "Canonical JavaScript action-ledger"):
            require_action_ledger_report_chain(**arguments)

    def test_canonical_replay_reopens_the_complete_raw_identification_closure(self) -> None:
        for field in (
            "match",
            "distances",
            "element_resolution",
            "pair_judged",
            "cards",
            "answers",
        ):
            with self.subTest(field=field):
                arguments = closure(self.root)
                arguments[field]["postReadMutation"] = True
                with self.assertRaisesRegex(
                    ArtifactContractError, "changed after its bounded read"
                ):
                    require_action_ledger_report_chain(**arguments)

        for field in (
            "match_digest",
            "distances_digest",
            "element_resolution_digest",
            "pair_judged_digest",
            "cards_digest",
            "card_images_digest",
            "answers_digest",
        ):
            with self.subTest(field=field):
                arguments = closure(self.root)
                arguments[field] = sha("f")
                with self.assertRaises(ArtifactContractError):
                    require_action_ledger_report_chain(**arguments)

    def test_current_v4_is_required_and_legacy_v3_is_not_admitted(self) -> None:
        arguments = closure(self.root)
        arguments["ledger"]["schemaVersion"] = "lego.real-build-action-ledger/3"
        with self.assertRaisesRegex(
            ArtifactContractError, "must use lego.real-build-action-ledger/4"
        ):
            require_action_ledger_report_chain(**arguments)

    def test_every_consumed_digest_edge_is_required(self) -> None:
        arguments = closure(self.root)
        for field, declared in (
            ("coverage_digest", "coverageDigest"),
            ("official_model_digest", "officialModelDigest"),
            ("callout_manifest_digest", "calloutManifestDigest"),
            ("source_art_rebound_digest", "sourceArtReboundDigest"),
            ("builder_calibration_digest", "builderCalibrationDigest"),
            ("transition_classifications_digest", TRANSITION_CLASSIFICATIONS_DIGEST_FIELD),
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

    def test_source_art_confidence_requires_exact_rebound_input_and_no_transform(self) -> None:
        arguments = closure(self.root)
        piece = arguments["ledger"]["steps"][0]["action"]["pieces"][0]
        claim = arguments["coverage"]["byCallout"][piece["calloutKey"]]
        piece["identificationConfidence"] = "source-art-rebound"
        claim["identificationConfidence"] = "source-art-rebound"
        with self.assertRaisesRegex(ArtifactContractError, "requires exact retained input"):
            require_action_ledger_report_chain(**arguments)

        arguments = closure(self.root)
        arguments["ledger"]["steps"][0]["action"]["pieces"][0]["transform"] = {
            "orientationId": "upright-yaw-0",
            "positionLdu": [0, 0, 0],
        }
        with self.assertRaisesRegex(ArtifactContractError, "cannot author placement authority"):
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
            (0, "requestedLastStep.*from 1 through 50"),
            (51, "requestedLastStep.*from 1 through 50"),
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
