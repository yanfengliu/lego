"""Focused retained-role closure tests for the description measurement."""

from __future__ import annotations

import hashlib
import json
import tempfile
import unittest
from pathlib import Path

from part_description_report_support import (
    MAX_DESCRIPTION_RANKING_SORT_ITEMS,
    load_description_inputs,
    require_description_report_work_budget,
)
from part_identification_report_contract import ArtifactContractError
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


def sha(character: str) -> str:
    return "sha256:" + character * 64


def write_json(path: Path, value: object) -> str:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value) + "\n", encoding="utf-8")
    return "sha256:" + hashlib.sha256(path.read_bytes()).hexdigest()


def write_bytes(path: Path, value: bytes) -> str:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(value)
    return "sha256:" + hashlib.sha256(value).hexdigest()


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


class DescriptionInputContractTests(unittest.TestCase):
    def materialize(
        self,
        root: Path,
        *,
        match_schema: str = "lego.part-identification-match/3",
        distance_match_digest: str | None = None,
        coverage_schema: str | None = None,
        coverage_source: str = "adjudicated",
        coverage_features_digest: str | None = None,
        answers_cards_digest: str | None = None,
        stale_coverage_role: str | None = None,
        stale_feature_manifest: bool = False,
    ) -> None:
        materialize_report_contract_fixture(root)
        inventory_path = root / "output/part-identification/element-resolution.json"
        inventory_digest = "sha256:" + hashlib.sha256(inventory_path.read_bytes()).hexdigest()
        manifest_path = root / "output/callout-thumbnails/manifest.json"
        manifest_digest = "sha256:" + hashlib.sha256(manifest_path.read_bytes()).hexdigest()
        features_path = root / "output/part-identification/features.json"
        features = json.loads(features_path.read_text(encoding="utf-8"))
        if stale_feature_manifest:
            features["inputDigests"]["calloutManifest"] = sha("f")
            features_digest = write_json(features_path, features)
        else:
            features_digest = "sha256:" + hashlib.sha256(features_path.read_bytes()).hexdigest()
        match_path = root / "output/part-identification/match.json"
        match = json.loads(match_path.read_text(encoding="utf-8"))
        if match_schema != match["schemaVersion"]:
            match["schemaVersion"] = match_schema
            match_digest = write_json(match_path, match)
        else:
            match_digest = "sha256:" + hashlib.sha256(match_path.read_bytes()).hexdigest()
        distances_path = root / "output/part-identification/distances.json"
        distances = json.loads(distances_path.read_text(encoding="utf-8"))
        if distance_match_digest is not None:
            distances["matchDigest"] = distance_match_digest
            distances_digest = write_json(distances_path, distances)
        else:
            distances_digest = "sha256:" + hashlib.sha256(distances_path.read_bytes()).hexdigest()
        cards_path = root / "output/part-identification/cards/manifest.json"
        cards = json.loads(cards_path.read_text(encoding="utf-8"))
        cards_digest = "sha256:" + hashlib.sha256(cards_path.read_bytes()).hexdigest()
        card_images_path = cards_path.parent / cards["imagesFile"]
        card_images_digest = "sha256:" + hashlib.sha256(card_images_path.read_bytes()).hexdigest()
        answers_path = root / "output/part-identification/answers-claude-opus-5.json"
        answers = json.loads(answers_path.read_text(encoding="utf-8"))
        if answers_cards_digest is not None:
            answers["cardsDigest"] = answers_cards_digest
            answers_digest = write_json(answers_path, answers)
        else:
            answers_digest = "sha256:" + hashlib.sha256(answers_path.read_bytes()).hexdigest()
        truth_path = root / "scripts/fixtures/part-identification-truth-first50.json"
        truth_digest = "sha256:" + hashlib.sha256(truth_path.read_bytes()).hexdigest()
        if coverage_schema is None:
            return
        roles = {
            "pdf": features["inputDigests"]["pdf"],
            "calloutManifest": manifest_digest,
            "features": coverage_features_digest or features_digest,
            "match": match_digest,
            "distances": distances_digest,
            "elementResolution": inventory_digest,
            "pairJudged": truth_digest,
        }
        if coverage_source == "adjudicated":
            roles.update(
                {
                    "cards": cards_digest,
                    "cardImages": card_images_digest,
                    "answers": answers_digest,
                }
            )
        if stale_coverage_role is not None:
            roles[stale_coverage_role] = sha("e")
        write_json(
            root / "output/real-build/catalog-coverage.json",
            {
                "schemaVersion": coverage_schema,
                "inputDigests": roles,
                "identification": {
                    "source": coverage_source,
                    "model": "claude-opus-5" if coverage_source == "adjudicated" else None,
                    "assignment": "nearest",
                },
                "lastStep": 1,
            },
        )

    def load_case(self, **changes) -> object:
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        root = Path(temporary.name)
        self.materialize(root, **changes)
        return load_description_inputs(root)

    def test_one_exact_current_closure_is_accepted(self) -> None:
        loaded = self.load_case()
        self.assertEqual(
            loaded.coverage["schemaVersion"], "lego.real-build-catalog-coverage/2"
        )
        self.assertTrue(any(path.endswith("/images.bin") for path in loaded.pins))

    def test_mixed_match_schema_is_refused_before_scoring(self) -> None:
        with self.assertRaisesRegex(SystemExit, "match/3"):
            self.load_case(match_schema="lego.part-identification-match/2")

    def test_distances_from_another_match_are_refused(self) -> None:
        with self.assertRaisesRegex(SystemExit, "Distances bind match"):
            self.load_case(distance_match_digest=sha("f"))

    def test_coverage_v1_has_no_implicit_compatibility_path(self) -> None:
        with self.assertRaisesRegex(SystemExit, "coverage/2"):
            self.load_case(coverage_schema="lego.real-build-catalog-coverage/1")

    def test_coverage_from_another_features_file_is_refused(self) -> None:
        with self.assertRaisesRegex(SystemExit, "Coverage binds features"):
            self.load_case(
                coverage_schema="lego.real-build-catalog-coverage/2",
                coverage_features_digest=sha("e"),
            )

    def test_answers_from_another_card_manifest_are_refused(self) -> None:
        with self.assertRaisesRegex(SystemExit, "answers.cardsDigest"):
            self.load_case(answers_cards_digest=sha("d"))

    def test_features_from_another_callout_manifest_are_refused(self) -> None:
        with self.assertRaisesRegex(SystemExit, "Features/3 binds callout manifest"):
            self.load_case(stale_feature_manifest=True)

    def test_every_consumed_coverage_role_binds_its_exact_bytes(self) -> None:
        for role in ("pdf", "calloutManifest", "cards", "cardImages", "answers", "pairJudged"):
            with self.subTest(role=role):
                with self.assertRaisesRegex(SystemExit, f"consumed role {role}"):
                    self.load_case(
                        coverage_schema="lego.real-build-catalog-coverage/2",
                        stale_coverage_role=role,
                    )

    def test_deterministic_coverage_cannot_cover_consumed_adjudication(self) -> None:
        with self.assertRaisesRegex(SystemExit, "consumed role cards"):
            self.load_case(
                coverage_schema="lego.real-build-catalog-coverage/2",
                coverage_source="deterministic",
            )

    def test_element_resolution_rejects_empty_malformed_and_unicode_id_records(self) -> None:
        for inventory, message in (
            ({}, "1 through 4096 records"),
            ({"1234": {}}, "must contain exactly"),
            (
                {
                    "١٢٣٤": {
                        "partNum": "3005",
                        "name": "Brick 1 x 1",
                        "colorId": "0",
                        "quantity": 1,
                    }
                },
                "ASCII digits",
            ),
        ):
            with self.subTest(inventory=inventory):
                with self.assertRaisesRegex(ArtifactContractError, message):
                    require_description_report_work_budget(
                        inventory,
                        {"clusters": []},
                        {"elementIds": [next(iter(inventory), "1234")]},
                    )

    def test_full_inventory_ranking_work_is_charged_before_sorting(self) -> None:
        element_ids = [str(100_000 + index) for index in range(4_096)]
        record = {
            "partNum": "3005",
            "name": "Brick 1 x 1",
            "colorId": "0",
            "quantity": 1,
        }
        inventory = {element_id: record for element_id in element_ids}
        clusters = [{} for _ in range(489)]
        with self.assertRaisesRegex(
            ArtifactContractError,
            f"would sort .* bounded maximum is {MAX_DESCRIPTION_RANKING_SORT_ITEMS}",
        ):
            require_description_report_work_budget(
                inventory,
                {"clusters": clusters},
                {"elementIds": element_ids},
            )


if __name__ == "__main__":
    unittest.main()
