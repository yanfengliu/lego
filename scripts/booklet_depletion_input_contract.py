"""Retained-byte closure for the current booklet depletion report."""

from __future__ import annotations

import hashlib
from collections.abc import Mapping
from dataclasses import dataclass
from pathlib import Path

from part_identification_descriptor_contract import bounded_observed
from part_identification_report_contract import (
    ArtifactContractError,
    read_bounded_bytes,
    read_card_images_artifact,
    read_json_artifact,
    require_adjudication_chain,
    require_coverage_chain,
    require_identification_chain,
    require_truth_v3,
)


MAX_BOOKLET_PDF_BYTES = 128 * 1024 * 1024
PDF = "recipes/6651557.pdf"
COVERAGE = "output/real-build/catalog-coverage.json"
REQUIRED_JSON = {
    "elementResolution": "output/part-identification/element-resolution.json",
    "features": "output/part-identification/features.json",
    "match": "output/part-identification/match.json",
    "distances": "output/part-identification/distances.json",
    "calloutManifest": "output/callout-thumbnails/manifest.json",
    "pairJudged": "scripts/fixtures/part-identification-truth-first50.json",
}
ADJUDICATED_JSON = {
    "cards": "output/part-identification/cards/manifest.json",
    "answers": "output/part-identification/answers-claude-opus-5.json",
}


@dataclass(frozen=True)
class DepletionReportInputs:
    inventory: dict
    features: dict
    match: dict
    distances: dict
    coverage: dict
    coverage_digest: str
    role_digests: dict[str, str]


def _json(path: Path, label: str) -> tuple[dict, str]:
    value, digest = read_json_artifact(path, label)
    if not isinstance(value, dict):
        raise ArtifactContractError(
            f"{label} at {path} must be a JSON object, received {type(value).__name__}."
        )
    return value, digest


def _source(coverage: Mapping) -> object:
    identification = coverage.get("identification")
    return identification.get("source") if isinstance(identification, Mapping) else None


def _require_source_edges(
    features: Mapping,
    callout_manifest: Mapping,
    *,
    pdf_digest: str,
    callout_manifest_digest: str,
) -> None:
    source_inputs = features.get("inputDigests")
    if not isinstance(source_inputs, Mapping):
        raise ArtifactContractError(
            "Features/3 source inputDigests must bind the exact PDF and callout manifest."
        )
    if source_inputs.get("pdf") != pdf_digest:
        raise ArtifactContractError(
            f"Features/3 binds PDF {bounded_observed(source_inputs.get('pdf'))}, but recipes/6651557.pdf hashes "
            f"to {pdf_digest}. Regenerate the complete identification closure from that PDF."
        )
    if source_inputs.get("calloutManifest") != callout_manifest_digest:
        raise ArtifactContractError(
            "Features/3 binds callout manifest "
            f"{bounded_observed(source_inputs.get('calloutManifest'))}, but the "
            f"retained manifest bytes hash to {callout_manifest_digest}. Regenerate the complete "
            "identification closure from that manifest."
        )
    if callout_manifest.get("sourceHash") != pdf_digest:
        raise ArtifactContractError(
            "Callout manifest binds source PDF "
            f"{bounded_observed(callout_manifest.get('sourceHash'))}, but "
            f"recipes/6651557.pdf hashes to {pdf_digest}. Restore one source-faithful manifest."
        )


def _load(repository_root: Path, coverage_path: Path) -> DepletionReportInputs:
    artifacts = {
        role: _json(repository_root / relative, f"Depletion-report {role}")
        for role, relative in REQUIRED_JSON.items()
    }
    values = {role: artifact[0] for role, artifact in artifacts.items()}
    role_digests = {role: artifact[1] for role, artifact in artifacts.items()}
    coverage, coverage_digest = _json(coverage_path, "Depletion-report coverage")
    pdf_bytes = read_bounded_bytes(
        repository_root / PDF,
        "Depletion-report source PDF",
        max_bytes=MAX_BOOKLET_PDF_BYTES,
    )
    role_digests["pdf"] = "sha256:" + hashlib.sha256(pdf_bytes).hexdigest()

    require_identification_chain(
        values["features"],
        values["match"],
        values["distances"],
        features_digest=role_digests["features"],
        match_digest=role_digests["match"],
        distances_digest=role_digests["distances"],
        callout_manifest_digest=role_digests["calloutManifest"],
    )
    _require_source_edges(
        values["features"],
        values["calloutManifest"],
        pdf_digest=role_digests["pdf"],
        callout_manifest_digest=role_digests["calloutManifest"],
    )
    require_truth_v3(values["pairJudged"])

    if _source(coverage) == "adjudicated":
        adjudicated = {
            role: _json(repository_root / relative, f"Depletion-report {role}")
            for role, relative in ADJUDICATED_JSON.items()
        }
        adjudicated_values = {role: artifact[0] for role, artifact in adjudicated.items()}
        role_digests.update(
            {role: artifact[1] for role, artifact in adjudicated.items()}
        )
        _, role_digests["cardImages"] = read_card_images_artifact(
            (repository_root / ADJUDICATED_JSON["cards"]).parent,
            adjudicated_values["cards"],
        )
        require_adjudication_chain(
            adjudicated_values["cards"],
            adjudicated_values["answers"],
            features_digest=role_digests["features"],
            match_digest=role_digests["match"],
            cards_digest=role_digests["cards"],
        )

    require_coverage_chain(
        coverage,
        coverage_digest=coverage_digest,
        features_digest=role_digests["features"],
        match_digest=role_digests["match"],
        distances_digest=role_digests["distances"],
        element_resolution_digest=role_digests["elementResolution"],
        consumed_role_digests=role_digests,
    )
    return DepletionReportInputs(
        inventory=values["elementResolution"],
        features=values["features"],
        match=values["match"],
        distances=values["distances"],
        coverage=coverage,
        coverage_digest=coverage_digest,
        role_digests=role_digests,
    )


def load_depletion_inputs(
    repository_root: Path, coverage_path: Path | None = None
) -> DepletionReportInputs:
    """Read and authenticate one current coverage/2 closure before walking claims."""

    resolved_coverage = repository_root / COVERAGE if coverage_path is None else coverage_path
    try:
        return _load(repository_root, resolved_coverage)
    except ArtifactContractError as error:
        raise SystemExit(
            f"could not verify the depletion-report input closure: {error}"
        ) from error
