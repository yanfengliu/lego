"""Authenticate and bound every retained input used by the retrieval report."""

from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass
from typing import Callable

from part_action_ledger_report_contract import require_action_ledger_report_chain
from part_identification_report_contract import (
    ArtifactContractError,
    read_binary_artifact,
    read_card_images_artifact,
    read_json_artifact,
    read_text_artifact,
    require_adjudication_chain,
    require_coverage_chain,
    require_identification_chain,
    require_score_summary_chain,
    require_truth_v3,
)
from part_identification_report_io import (
    BUILDER_GEOMETRY_EXACT_BYTES,
    MAX_BOOKLET_PDF_BYTES,
    RETRIEVAL_REPORT_INPUTS,
)
from part_retrieval_ceiling import REPOSITORY_ROOT
from part_retrieval_work_contract import require_report_comparison_budget


def _uses_adjudicated_coverage(value: object) -> bool:
    """Inspect only validated JSON shapes without pre-empting canonical rejection."""

    if not isinstance(value, Mapping):
        return False
    identification = value.get("identification")
    return (
        isinstance(identification, Mapping)
        and identification.get("source") == "adjudicated"
    )


@dataclass(frozen=True)
class VerifiedRetrievalInputs:
    features: dict
    match: dict
    distances: dict
    score: dict
    resolution: dict
    truth_fixture: dict
    action_ledger: dict
    official_model: str
    digests: dict[str, str]


@dataclass(frozen=True)
class RetrievalInputVerificationHooks:
    identification: Callable[..., object] = require_identification_chain
    truth: Callable[..., object] = require_truth_v3
    adjudication: Callable[..., object] = require_adjudication_chain
    score: Callable[..., object] = require_score_summary_chain
    work_budget: Callable[..., object] = require_report_comparison_budget


def load_verified_retrieval_inputs(
    *,
    quick: bool,
    repository_root=REPOSITORY_ROOT,
    hooks: RetrievalInputVerificationHooks = RetrievalInputVerificationHooks(),
) -> VerifiedRetrievalInputs:
    """Read one immutable generation, authenticate its closure, and bound its work."""

    paths = {
        name: repository_root / relative
        for name, relative in RETRIEVAL_REPORT_INPUTS.items()
    }
    missing = sorted(name for name, path in paths.items() if not path.exists())
    if missing:
        raise SystemExit(
            f"could not verify: retained inputs absent: {', '.join(missing)}"
        )

    try:
        artifacts = {
            name: read_json_artifact(path, f"Retrieval-report {name}")
            for name, path in paths.items()
            if name not in {"officialModel", "bookletPdf", "builderGeometry"}
        }
        official_model, official_digest = read_text_artifact(
            paths["officialModel"],
            "Retrieval-report official model",
        )
        _, booklet_pdf_digest = read_binary_artifact(
            paths["bookletPdf"],
            "Retrieval-report instruction booklet",
            max_bytes=MAX_BOOKLET_PDF_BYTES,
        )
        _, builder_geometry_digest = read_binary_artifact(
            paths["builderGeometry"],
            "Retrieval-report Builder shell geometry",
            max_bytes=BUILDER_GEOMETRY_EXACT_BYTES,
            exact_bytes=BUILDER_GEOMETRY_EXACT_BYTES,
        )
        digests = {name: artifact[1] for name, artifact in artifacts.items()}
        digests["officialModel"] = official_digest
        digests["bookletPdf"] = booklet_pdf_digest
        digests["builderGeometry"] = builder_geometry_digest
        features = artifacts["features"][0]
        match = artifacts["match"][0]
        distances = artifacts["distances"][0]
        score = artifacts["score"][0]
        cards = artifacts["cards"][0]
        answers = artifacts["answers"][0]
        resolution = artifacts["elementResolution"][0]
        truth_fixture = artifacts["truthFirstFifty"][0]
        action_ledger = artifacts["actionLedger"][0]
        coverage = artifacts["coverage"][0]

        hooks.identification(
            features,
            match,
            distances,
            features_digest=digests["features"],
            match_digest=digests["match"],
            distances_digest=digests["distances"],
            callout_manifest_digest=digests["calloutManifest"],
        )
        hooks.truth(truth_fixture)
        try:
            hooks.work_budget(
                features=features,
                clusters=match["clusters"],
                verdicts=truth_fixture["verdicts"],
                ledger=action_ledger,
                element_ids=distances["elementIds"],
                resolution=resolution,
                quick=quick,
            )
        except ValueError as error:
            raise SystemExit(
                f"could not verify the retrieval-report work bound: {error}"
            ) from error
        hooks.adjudication(
            cards,
            answers,
            features_digest=digests["features"],
            match_digest=digests["match"],
            cards_digest=digests["cards"],
        )
        _, digests["cardImages"] = read_card_images_artifact(
            paths["cards"].parent, cards
        )
        adjudicated_coverage = _uses_adjudicated_coverage(coverage)
        require_coverage_chain(
            coverage,
            coverage_digest=digests["coverage"],
            features_digest=digests["features"],
            match_digest=digests["match"],
            distances_digest=digests["distances"],
            element_resolution_digest=digests["elementResolution"],
            source_art_rebound_digest=digests["sourceArtRebound"],
            consumed_role_digests={
                "pdf": features["inputDigests"]["pdf"],
                "calloutManifest": digests["calloutManifest"],
                **(
                    {
                        "cards": digests["cards"],
                        "cardImages": digests["cardImages"],
                        "answers": digests["answers"],
                    }
                    if adjudicated_coverage
                    else {}
                ),
                "pairJudged": digests["truthFirstFifty"],
                "sourceArtRebound": digests["sourceArtRebound"],
            },
        )
        require_action_ledger_report_chain(
            action_ledger,
            ledger_digest=digests["actionLedger"],
            coverage=coverage,
            coverage_digest=digests["coverage"],
            features=features,
            features_digest=digests["features"],
            match=match,
            match_digest=digests["match"],
            distances=distances,
            distances_digest=digests["distances"],
            element_resolution=resolution,
            element_resolution_digest=digests["elementResolution"],
            pair_judged=truth_fixture,
            pair_judged_digest=digests["truthFirstFifty"],
            cards=cards if adjudicated_coverage else None,
            cards_digest=digests["cards"] if adjudicated_coverage else None,
            card_images_digest=(digests["cardImages"] if adjudicated_coverage else None),
            answers=answers if adjudicated_coverage else None,
            answers_digest=digests["answers"] if adjudicated_coverage else None,
            callout_manifest_digest=digests["calloutManifest"],
            source_art_rebound_digest=digests["sourceArtRebound"],
            official_model_text=official_model,
            official_model_digest=digests["officialModel"],
            builder_calibration_digest=digests["builderCalibration"],
            transition_classifications_digest=digests[
                "transitionClassifications"
            ],
            booklet_pdf_digest=digests["bookletPdf"],
            builder_geometry_digest=digests["builderGeometry"],
        )
        hooks.score(score, digests=digests)
    except ArtifactContractError as error:
        raise SystemExit(
            f"could not verify the retrieval-report input closure: {error}"
        ) from error

    return VerifiedRetrievalInputs(
        features=features,
        match=match,
        distances=distances,
        score=score,
        resolution=resolution,
        truth_fixture=truth_fixture,
        action_ledger=action_ledger,
        official_model=official_model,
        digests=digests,
    )
