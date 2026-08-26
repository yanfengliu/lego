"""Focused generation-closure tests shared by Python identification reports."""

from __future__ import annotations

import copy
import hashlib
import json
import subprocess
import unittest
import tempfile
from contextlib import ExitStack
from pathlib import Path
from unittest.mock import patch

import part_retrieval_ceiling_report as retrieval_report
import score_description_retrieval as description_report

from part_identification_report_contract import (
    ArtifactContractError,
    read_bounded_bytes,
    read_binary_artifact,
    read_card_images_artifact,
    read_json_artifact,
    require_adjudication_chain,
    require_coverage_chain,
    require_identification_chain,
    require_score_summary_chain,
    require_truth_v3,
)
from part_identification_report_contract_test_fixture import (
    materialize_report_contract_fixture,
    report_contract_test_verifier_patch,
)
from part_identification_report_io import (
    BUILDER_GEOMETRY_EXACT_BYTES,
    RETRIEVAL_REPORT_INPUTS,
)
from part_identification_report_io_test import ReportInputBoundsTests  # noqa: F401
from part_retrieval_work_contract import require_report_comparison_budget


_TEST_VERIFIER_PATCH = None


def setUpModule() -> None:
    global _TEST_VERIFIER_PATCH
    _TEST_VERIFIER_PATCH = report_contract_test_verifier_patch()
    _TEST_VERIFIER_PATCH.start()


def tearDownModule() -> None:
    if _TEST_VERIFIER_PATCH is not None:
        _TEST_VERIFIER_PATCH.stop()


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


def write_json(path: Path, value: object) -> str:
    data = (json.dumps(value) + "\n").encode("utf-8")
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)
    return "sha256:" + hashlib.sha256(data).hexdigest()


def write_retrieval_placeholders(root: Path, *, omit: set[str] | None = None) -> None:
    for name, relative in RETRIEVAL_REPORT_INPUTS.items():
        if name in (omit or set()):
            continue
        path = root / relative
        path.parent.mkdir(parents=True, exist_ok=True)
        if name == "builderGeometry":
            path.write_bytes(bytes(BUILDER_GEOMETRY_EXACT_BYTES))
        elif name == "bookletPdf":
            path.write_bytes(b"pdf")
        else:
            path.write_text("<LXFML />\n" if path.suffix == ".xml" else "{}\n", encoding="utf-8")


class ReportClosureTests(unittest.TestCase):
    """A report refuses mixed raw generations before scoring any claims."""

    def setUp(self) -> None:
        self.features_digest = "sha256:" + "a" * 64
        self.match_digest = "sha256:" + "b" * 64
        self.distances_digest = "sha256:" + "c" * 64
        self.resolution_digest = "sha256:" + "d" * 64
        self.source_art_rebound_digest = "sha256:" + "4" * 64
        self.coverage_digest = "sha256:" + "e" * 64
        self.features = {
            "schemaVersion": "lego.part-identification-features/3",
            "callouts": [
                {"evidenceKind": "part-art", "descriptor": descriptor()}
            ],
            "inventory": {"300501": descriptor()},
        }
        self.match = {
            "schemaVersion": "lego.part-identification-match/3",
            "featuresDigest": self.features_digest,
            "clusters": [{"clusterIndex": 0}],
        }
        self.distances = {
            "schemaVersion": "lego.part-identification-distances/3",
            "featuresDigest": self.features_digest,
            "matchDigest": self.match_digest,
            "elementIds": ["300501"],
            "rows": [[0.0]],
        }
        self.coverage = {
            "schemaVersion": "lego.real-build-catalog-coverage/3",
            "identification": {"source": "deterministic"},
            "inputDigests": {
                "pdf": "sha256:" + "1" * 64,
                "calloutManifest": "sha256:" + "2" * 64,
                "features": self.features_digest,
                "match": self.match_digest,
                "distances": self.distances_digest,
                "elementResolution": self.resolution_digest,
                "pairJudged": "sha256:" + "3" * 64,
                "sourceArtRebound": self.source_art_rebound_digest,
            },
        }

    def test_distances_must_bind_the_exact_match_bytes(self) -> None:
        detached = {**self.distances, "matchDigest": "sha256:" + "f" * 64}
        with self.assertRaisesRegex(ArtifactContractError, "Distances bind match"):
            require_identification_chain(
                self.features,
                self.match,
                detached,
                features_digest=self.features_digest,
                match_digest=self.match_digest,
                distances_digest=self.distances_digest,
            )

    def test_a_superseded_match_schema_is_not_accepted_by_shape(self) -> None:
        old_match = {**self.match, "schemaVersion": "lego.part-identification-match/2"}
        with self.assertRaisesRegex(
            ArtifactContractError, "requires lego.part-identification-match/3"
        ):
            require_identification_chain(
                self.features,
                old_match,
                self.distances,
                features_digest=self.features_digest,
                match_digest=self.match_digest,
                distances_digest=self.distances_digest,
            )

    def test_coverage_must_bind_the_same_distances_bytes(self) -> None:
        stale = {
            **self.coverage,
            "inputDigests": {
                **self.coverage["inputDigests"],
                "distances": "sha256:" + "0" * 64,
            },
        }
        with self.assertRaisesRegex(ArtifactContractError, "Coverage binds distances"):
            require_coverage_chain(
                stale,
                coverage_digest=self.coverage_digest,
                features_digest=self.features_digest,
                match_digest=self.match_digest,
                distances_digest=self.distances_digest,
                element_resolution_digest=self.resolution_digest,
                source_art_rebound_digest=self.source_art_rebound_digest,
            )

    def test_element_ids_are_unique_code_point_sorted_and_rows_are_finite(self) -> None:
        unsorted = {
            **self.distances,
            "elementIds": ["300502", "300501"],
            "rows": [[0.0, 1.0]],
        }
        with self.assertRaisesRegex(ArtifactContractError, "canonical numeric elementIds"):
            require_identification_chain(
                self.features,
                self.match,
                unsorted,
                features_digest=self.features_digest,
                match_digest=self.match_digest,
                distances_digest=self.distances_digest,
            )
        nonfinite = {**self.distances, "rows": [[float("inf")]]}
        with self.assertRaisesRegex(ArtifactContractError, "finite numbers"):
            require_identification_chain(
                self.features,
                self.match,
                nonfinite,
                features_digest=self.features_digest,
                match_digest=self.match_digest,
                distances_digest=self.distances_digest,
            )

    def test_legacy_coverage_needs_its_explicit_complete_historical_tuple(self) -> None:
        legacy = {"schemaVersion": "lego.real-build-catalog-coverage/1"}
        arguments = {
            "coverage_digest": self.coverage_digest,
            "features_digest": self.features_digest,
            "match_digest": self.match_digest,
            "distances_digest": self.distances_digest,
            "element_resolution_digest": self.resolution_digest,
        }
        with self.assertRaisesRegex(
            ArtifactContractError, "explicit full historical closure tuple"
        ):
            require_coverage_chain(legacy, **arguments)
        require_coverage_chain(
            legacy,
            legacy_tuple={
                "coverage": self.coverage_digest,
                "features": self.features_digest,
                "match": self.match_digest,
                "distances": self.distances_digest,
                "elementResolution": self.resolution_digest,
            },
            **arguments,
        )

    def test_descriptor_grids_refuse_under_and_oversized_channels(self) -> None:
        undersized = copy.deepcopy(self.features)
        undersized["callouts"][0]["descriptor"]["grid"].pop()
        with self.assertRaisesRegex(ArtifactContractError, r"grid.*exactly 784.*783"):
            self.require_chain(undersized)
        oversized = copy.deepcopy(self.features)
        oversized["inventory"]["300501"]["detail"].append(0)
        with self.assertRaisesRegex(
            ArtifactContractError, r"inventory descriptor 300501\.detail.*exactly 784.*785"
        ):
            self.require_chain(oversized)

    def test_descriptor_nonfinite_and_malformed_vectors_are_refused(self) -> None:
        nonfinite = copy.deepcopy(self.features)
        nonfinite["inventory"]["300501"]["colours"][0]["share"] = float("inf")
        with self.assertRaisesRegex(ArtifactContractError, r"share must be finite"):
            self.require_chain(nonfinite)
        malformed = copy.deepcopy(self.features)
        malformed["callouts"][0]["descriptor"]["mean"] = [0, 0]
        with self.assertRaisesRegex(ArtifactContractError, r"mean must contain exactly three"):
            self.require_chain(malformed)

    def test_descriptor_scalars_and_exact_fields_are_refused(self) -> None:
        wrong_ratio = copy.deepcopy(self.features)
        wrong_ratio["inventory"]["300501"]["aspect"] = 2
        with self.assertRaisesRegex(ArtifactContractError, r"aspect must be the exact finite"):
            self.require_chain(wrong_ratio)
        extra = copy.deepcopy(self.features)
        extra["callouts"][0]["descriptor"]["detached"] = 1
        with self.assertRaisesRegex(ArtifactContractError, r"must contain exactly.*detached"):
            self.require_chain(extra)

    def test_truth_source_and_assignment_match_the_js_enums(self) -> None:
        base = {
            "schemaVersion": "lego.part-identification-truth/3",
            "lastStep": 1,
            "pairsJudged": 0,
            "pairsUnjudgeable": 0,
            "verdicts": [],
            "unjudgeable": [],
        }
        for source in ("deterministic", "adjudicated"):
            for assignment in ("nearest", "one-to-one", "quantity-informed"):
                require_truth_v3({**base, "source": source, "assignment": assignment})
        with self.assertRaisesRegex(ArtifactContractError, "deterministic or adjudicated"):
            require_truth_v3({**base, "source": "vision"})
        with self.assertRaisesRegex(ArtifactContractError, "nearest, one-to-one, or quantity-informed"):
            require_truth_v3({**base, "assignment": "cluster-greedy"})

    def test_unicode_digits_do_not_cross_the_javascript_contract(self) -> None:
        unicode_element = copy.deepcopy(self.features)
        unicode_element["inventory"] = {"١٢٣٤": descriptor()}
        unicode_distances = {
            **self.distances,
            "elementIds": ["١٢٣٤"],
            "rows": [[0.0]],
        }
        with self.assertRaisesRegex(ArtifactContractError, "decimal digits"):
            require_identification_chain(
                unicode_element,
                self.match,
                unicode_distances,
                features_digest=self.features_digest,
                match_digest=self.match_digest,
                distances_digest=self.distances_digest,
            )
        truth = {
            "schemaVersion": "lego.part-identification-truth/3",
            "lastStep": 1,
            "pairsJudged": 0,
            "pairsUnjudgeable": 0,
            "verdicts": [],
            "unjudgeable": [],
            "raters": {
                "primary": "one",
                "secondary": "two",
                "agreement": "٠/٠",
                "descriptionDivergenceAdjudicated": [],
                "adjudicationNote": "none",
            },
        }
        with self.assertRaisesRegex(ArtifactContractError, "Truth/3 raters"):
            require_truth_v3(truth)
        with self.assertRaisesRegex(ValueError, "unique numeric element ids"):
            require_report_comparison_budget(
                features={
                    "callouts": [
                        {
                            "evidenceKind": "part-art",
                            "file": "one.png",
                            "sha256": "sha256:" + "1" * 64,
                            "identity": "p1|q1|x0.000|y0.000",
                        }
                    ],
                    "inventory": {"١٢٣٤": {}},
                },
                clusters=[
                    {"clusterIndex": 0, "lead": "one.png", "members": [0]}
                ],
                verdicts=[],
                ledger={"steps": [{"action": {"kind": "transition"}}]},
                element_ids=["١٢٣٤"],
                resolution={"١٢٣٤": {"partNum": "3005", "quantity": 1}},
                quick=True,
            )

    def require_chain(self, features: object) -> None:
        require_identification_chain(
            features,
            self.match,
            self.distances,
            features_digest=self.features_digest,
            match_digest=self.match_digest,
            distances_digest=self.distances_digest,
        )

    def test_retrieval_report_refuses_bad_descriptors_before_work(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            write_retrieval_placeholders(root)
            invalid = copy.deepcopy(self.features)
            invalid["callouts"][0]["descriptor"]["grid"].pop()
            features_digest = write_json(root / RETRIEVAL_REPORT_INPUTS["features"], invalid)
            match = {**self.match, "featuresDigest": features_digest}
            match_digest = write_json(root / RETRIEVAL_REPORT_INPUTS["match"], match)
            distances = {
                **self.distances,
                "featuresDigest": features_digest,
                "matchDigest": match_digest,
            }
            write_json(root / RETRIEVAL_REPORT_INPUTS["distances"], distances)
            with (
                patch.object(retrieval_report, "REPOSITORY_ROOT", root),
                patch.object(retrieval_report, "distance_terms") as distance_work,
                patch.object(retrieval_report, "require_report_comparison_budget") as budget_work,
            ):
                with self.assertRaisesRegex(SystemExit, r"grid.*exactly 784"):
                    retrieval_report.build_report(quick=True)
                distance_work.assert_not_called()
                budget_work.assert_not_called()

    def test_quick_and_full_work_plans_charge_every_comparison_family(self) -> None:
        crop = "sha256:" + "9" * 64
        features = {
            "callouts": [
                {
                    "evidenceKind": "part-art",
                    "file": "0.png",
                    "sha256": crop,
                    "identity": "p1|q1|x0.000|y0.000",
                },
                {
                    "evidenceKind": "part-art",
                    "file": "1.png",
                    "sha256": crop,
                    "identity": "p1|q1|x1.000|y0.000",
                },
            ],
            "inventory": {"100": {}, "101": {}},
        }
        clusters = [{"clusterIndex": 0, "lead": "0.png", "members": [0, 1]}]
        verdicts = [{"judgedCropSha256": crop}]
        ledger = {
            "steps": [
                {
                    "action": {
                        "kind": "place-callouts",
                        "pieces": [{"calloutKey": "p1|q1|x1.000|y0.000"}],
                    }
                }
            ]
        }
        resolution = {
            "100": {"partNum": "P", "quantity": 1},
            "101": {"partNum": "P", "quantity": 1},
        }
        quick = require_report_comparison_budget(
            features=features,
            clusters=clusters,
            verdicts=verdicts,
            ledger=ledger,
            element_ids=["100", "101"],
            resolution=resolution,
            quick=True,
        )
        full = require_report_comparison_budget(
            features=features,
            clusters=clusters,
            verdicts=verdicts,
            ledger=ledger,
            element_ids=["100", "101"],
            resolution=resolution,
            quick=False,
        )
        self.assertEqual(quick["descriptorComparisons"], 14)
        self.assertEqual(full["descriptorComparisons"], 17)
        self.assertEqual(full["builderTruthMemberRows"], 1)
        self.assertEqual(full["acceptedBuilderPieces"], 1)
        self.assertEqual(full["nonleadInventoryRows"], 1)
        self.assertEqual(full["withinClusterMemberPairs"], 1)
        self.assertEqual(full["sameMouldSiblingComparisons"], 2)

    def test_builder_member_rows_are_bounded_before_descriptor_work(self) -> None:
        identity = "p1|q1|x0.000|y0.000"
        with self.assertRaisesRegex(ValueError, "at most 4000 accepted pieces"):
            require_report_comparison_budget(
                features={
                    "callouts": [
                        {
                            "evidenceKind": "part-art",
                            "file": "0.png",
                            "sha256": "sha256:" + "9" * 64,
                            "identity": identity,
                        }
                    ],
                    "inventory": {"100": {}},
                },
                clusters=[{"clusterIndex": 0, "lead": "0.png", "members": [0]}],
                verdicts=[],
                ledger={
                    "steps": [
                        {
                            "action": {
                                "kind": "place-callouts",
                                "pieces": [{"calloutKey": identity}] * 4_001,
                            }
                        }
                    ]
                },
                element_ids=["100"],
                resolution={"100": {"partNum": "P", "quantity": 1}},
                quick=True,
            )

    def test_huge_single_cluster_is_refused_before_distance_or_ablation(self) -> None:
        crop = "sha256:" + "a" * 64
        callouts = [
            {
                "evidenceKind": "part-art",
                "file": f"{index}.png",
                "sha256": crop,
                "identity": f"p1|q1|x{index}.000|y0.000",
            }
            for index in range(4_000)
        ]
        self.assert_work_refused(
            features={"callouts": callouts, "inventory": {"100": {}}},
            match={
                "clusters": [
                    {
                        "clusterIndex": 0,
                        "lead": "0.png",
                        "members": list(range(4_000)),
                    }
                ]
            },
            distances={"elementIds": ["100"], "rows": [[0.0]]},
            resolution={"100": {"partNum": "P", "quantity": 1}},
            quick=False,
            cause="withinClusterMemberPairs",
        )

    def test_huge_single_mould_is_refused_before_distance_or_ablation(self) -> None:
        element_ids = [str(100_000 + index) for index in range(4_096)]
        self.assert_work_refused(
            features={
                "callouts": [
                    {
                        "evidenceKind": "part-art",
                        "file": "0.png",
                        "sha256": "sha256:" + "b" * 64,
                        "identity": "p1|q1|x0.000|y0.000",
                    }
                ],
                "inventory": {element: {} for element in element_ids},
            },
            match={"clusters": [{"clusterIndex": 0, "lead": "0.png", "members": [0]}]},
            distances={"elementIds": element_ids, "rows": [[0.0] * len(element_ids)]},
            resolution={
                element: {"partNum": "ONE-MOULD", "quantity": 1}
                for element in element_ids
            },
            quick=True,
            cause="sameMouldSiblingComparisons",
        )

    def assert_work_refused(
        self,
        *,
        features: dict,
        match: dict,
        distances: dict,
        resolution: dict,
        quick: bool,
        cause: str,
    ) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            write_retrieval_placeholders(root)
            write_json(root / RETRIEVAL_REPORT_INPUTS["features"], features)
            write_json(root / RETRIEVAL_REPORT_INPUTS["match"], match)
            write_json(root / RETRIEVAL_REPORT_INPUTS["distances"], distances)
            write_json(root / RETRIEVAL_REPORT_INPUTS["elementResolution"], resolution)
            write_json(root / RETRIEVAL_REPORT_INPUTS["truthFirstFifty"], {"verdicts": []})
            write_json(
                root / RETRIEVAL_REPORT_INPUTS["actionLedger"],
                {"steps": [{"action": {"kind": "transition"}}]},
            )
            write_json(root / RETRIEVAL_REPORT_INPUTS["score"], {"headline": {}})
            run_id = "a" * 24
            write_json(
                root / RETRIEVAL_REPORT_INPUTS["cards"],
                {"runId": run_id, "imagesFile": f"runs/{run_id}/images.bin"},
            )
            bundle = root / "output/part-identification/cards/runs" / run_id / "images.bin"
            bundle.parent.mkdir(parents=True, exist_ok=True)
            bundle.write_bytes(b"bundle")
            with ExitStack() as stack:
                stack.enter_context(patch.object(retrieval_report, "REPOSITORY_ROOT", root))
                for name in (
                    "require_identification_chain",
                    "require_truth_v3",
                    "require_adjudication_chain",
                    "require_score_summary_chain",
                ):
                    stack.enter_context(patch.object(retrieval_report, name))
                work_mocks = [
                    stack.enter_context(
                        patch.object(retrieval_report, name, side_effect=AssertionError(name))
                    )
                    for name in (
                        "distance_terms",
                        "pair_judged_truth",
                        "sibling_outliers",
                        "ablate",
                        "lead_representativeness",
                    )
                ]
                with self.assertRaisesRegex(SystemExit, cause):
                    retrieval_report.build_report(quick=quick)
                for work_mock in work_mocks:
                    work_mock.assert_not_called()

    def test_description_measurement_output_uses_schema_v2(self) -> None:
        self.assertEqual(
            description_report.REPORT_SCHEMA_VERSION,
            "lego.part-description-retrieval/2",
        )

    def test_retrieval_report_requires_the_retained_inventory_labels_file(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            write_retrieval_placeholders(root, omit={"inventoryLabels"})
            with patch.object(retrieval_report, "REPOSITORY_ROOT", root):
                with self.assertRaisesRegex(SystemExit, "inventoryLabels"):
                    retrieval_report.build_report(quick=True)


class CanonicalContentAuthenticationTests(unittest.TestCase):
    """Independently rehashed derived content cannot certify itself."""

    def setUp(self) -> None:
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        self.root = Path(temporary.name)
        materialize_report_contract_fixture(self.root)
        self.paths = {
            "features": self.root / "output/part-identification/features.json",
            "match": self.root / "output/part-identification/match.json",
            "distances": self.root / "output/part-identification/distances.json",
            "cards": self.root / "output/part-identification/cards/manifest.json",
            "answers": self.root / "output/part-identification/answers-claude-opus-5.json",
            "elementResolution": self.root
            / "output/part-identification/element-resolution.json",
            "inventoryLabels": self.root / "output/inventory-thumbnails/labels.json",
            "truthFirstFifty": self.root
            / "scripts/fixtures/part-identification-truth-first50.json",
            "sourceArtRebound": self.root
            / "output/part-identification/source-art-rebound.json",
            "calloutManifest": self.root / "output/callout-thumbnails/manifest.json",
            "coverage": self.root / "output/real-build/catalog-coverage.json",
            "score": self.root / "output/part-identification/score.json",
        }
        self.artifacts = {
            role: read_json_artifact(path, f"Fixture {role}")
            for role, path in self.paths.items()
        }
        self.digests = {role: artifact[1] for role, artifact in self.artifacts.items()}
        cards = self.artifacts["cards"][0]
        _, self.digests["cardImages"] = read_card_images_artifact(
            self.paths["cards"].parent, cards
        )
        _, self.digests["pdf"] = read_binary_artifact(
            self.root / "recipes/6651557.pdf",
            "Fixture source PDF",
            max_bytes=1024,
        )

    def require_identification(self, *, match=None, distances=None) -> None:
        require_identification_chain(
            self.artifacts["features"][0],
            self.artifacts["match"][0] if match is None else match[0],
            self.artifacts["distances"][0] if distances is None else distances[0],
            features_digest=self.digests["features"],
            match_digest=self.digests["match"] if match is None else match[1],
            distances_digest=self.digests["distances"] if distances is None else distances[1],
        )

    def test_one_producer_derived_identification_adjudication_and_score_are_accepted(self) -> None:
        self.require_identification()
        require_adjudication_chain(
            self.artifacts["cards"][0],
            self.artifacts["answers"][0],
            features_digest=self.digests["features"],
            match_digest=self.digests["match"],
            cards_digest=self.digests["cards"],
        )
        require_score_summary_chain(
            self.artifacts["score"][0], digests=self.digests
        )

    def rewrite(self, role: str, value: object) -> tuple[object, str]:
        write_json(self.paths[role], value)
        return read_json_artifact(self.paths[role], f"Mutated fixture {role}")

    def test_rehashed_match_and_distance_rows_are_rejected(self) -> None:
        match_value = copy.deepcopy(self.artifacts["match"][0])
        match_value["clusters"][0]["lead"] = "detached.png"
        changed_match = self.rewrite("match", match_value)
        distance_value = copy.deepcopy(self.artifacts["distances"][0])
        distance_value["matchDigest"] = changed_match[1]
        changed_distances = self.rewrite("distances", distance_value)
        with self.assertRaisesRegex(ArtifactContractError, "canonical JavaScript|Canonical JavaScript"):
            self.require_identification(match=changed_match, distances=changed_distances)

        original_match = self.rewrite("match", self.artifacts["match"][0])
        changed_rows = copy.deepcopy(self.artifacts["distances"][0])
        changed_rows["matchDigest"] = original_match[1]
        changed_rows["rows"][0][0] += 1
        changed_distances = self.rewrite("distances", changed_rows)
        with self.assertRaisesRegex(ArtifactContractError, "Canonical JavaScript"):
            require_identification_chain(
                self.artifacts["features"][0],
                original_match[0],
                changed_distances[0],
                features_digest=self.digests["features"],
                match_digest=original_match[1],
                distances_digest=changed_distances[1],
            )

    def test_rehashed_answer_provenance_and_records_are_rejected(self) -> None:
        for mutation in ("provenance", "record"):
            with self.subTest(mutation=mutation):
                answers = copy.deepcopy(self.artifacts["answers"][0])
                if mutation == "provenance":
                    answers["modelIdentity"]["provider"] = "detached"
                else:
                    answers["answers"]["0"]["pick"] = 2
                changed = self.rewrite("answers", answers)
                with self.assertRaisesRegex(ArtifactContractError, "Canonical JavaScript"):
                    require_adjudication_chain(
                        self.artifacts["cards"][0],
                        changed[0],
                        features_digest=self.digests["features"],
                        match_digest=self.digests["match"],
                        cards_digest=self.digests["cards"],
                    )

    def test_rehashed_score_numbers_are_rejected(self) -> None:
        score = copy.deepcopy(self.artifacts["score"][0])
        score["headline"]["calloutsIdentified"] += 1
        changed = self.rewrite("score", score)
        with self.assertRaisesRegex(ArtifactContractError, "Canonical JavaScript"):
            require_score_summary_chain(changed[0], digests=self.digests)

    def test_rehashed_coverage_by_callout_is_rejected(self) -> None:
        coverage = copy.deepcopy(self.artifacts["coverage"][0])
        only = next(iter(coverage["byCallout"].values()))
        only["quantity"] += 1
        changed_path = self.root / "coverage-mutated.json"
        write_json(changed_path, coverage)
        changed = read_json_artifact(changed_path, "Mutated coverage")
        require_identification_chain(
            self.artifacts["features"][0],
            self.artifacts["match"][0],
            self.artifacts["distances"][0],
            features_digest=self.digests["features"],
            match_digest=self.digests["match"],
            distances_digest=self.digests["distances"],
            callout_manifest_digest=self.digests["calloutManifest"],
        )
        with self.assertRaisesRegex(ArtifactContractError, "Canonical JavaScript"):
            require_coverage_chain(
                changed[0],
                coverage_digest=changed[1],
                features_digest=self.digests["features"],
                match_digest=self.digests["match"],
                distances_digest=self.digests["distances"],
                element_resolution_digest=self.digests["elementResolution"],
                source_art_rebound_digest=self.digests["sourceArtRebound"],
                consumed_role_digests={
                    "calloutManifest": self.digests["calloutManifest"],
                    "pairJudged": self.digests["truthFirstFifty"],
                    "pdf": self.digests["pdf"],
                },
            )


if __name__ == "__main__":
    unittest.main()
