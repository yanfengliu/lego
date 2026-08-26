"""Coverage/3 role-set and retained-byte closure for Python reports."""

from __future__ import annotations

import re
from collections.abc import Mapping

from part_identification_descriptor_contract import bounded_observed
from part_identification_report_io import ArtifactContractError
from part_identification_verification_bridge import verify_coverage


COVERAGE_SCHEMA = "lego.real-build-catalog-coverage/3"
SHA256 = re.compile(r"^sha256:[0-9a-f]{64}$")
ALLOWED_ROLES = {
    "pdf",
    "calloutManifest",
    "features",
    "match",
    "distances",
    "cards",
    "cardImages",
    "answers",
    "elementResolution",
    "pairJudged",
    "sourceArtRebound",
}
BASE_ROLES = {
    "pdf",
    "calloutManifest",
    "features",
    "match",
    "distances",
    "elementResolution",
    "pairJudged",
    "sourceArtRebound",
}
ADJUDICATION_ROLES = {"cards", "cardImages", "answers"}


def _mapping(value: object, label: str) -> Mapping:
    if not isinstance(value, Mapping):
        raise ArtifactContractError(
            f"{label} must be a JSON object, received {type(value).__name__}."
        )
    return value


def _digest(value: object, label: str) -> str:
    if not isinstance(value, str) or SHA256.fullmatch(value) is None:
        raise ArtifactContractError(
            f"{label} must be one exact lowercase SHA-256 digest; received {bounded_observed(value)}."
        )
    return value


def require_coverage_chain(
    coverage: object,
    *,
    coverage_digest: str,
    features_digest: str,
    match_digest: str,
    distances_digest: str,
    element_resolution_digest: str,
    source_art_rebound_digest: str | None = None,
    consumed_role_digests: Mapping[str, str] | None = None,
    legacy_tuple: Mapping[str, str] | None = None,
) -> None:
    """Require coverage/3, or one explicitly named immutable legacy tuple."""

    value = _mapping(coverage, "Catalog coverage")
    actual = {
        "coverage": _digest(coverage_digest, "Coverage byte digest"),
        "features": _digest(features_digest, "Features byte digest"),
        "match": _digest(match_digest, "Match byte digest"),
        "distances": _digest(distances_digest, "Distances byte digest"),
        "elementResolution": _digest(
            element_resolution_digest, "Element-resolution byte digest"
        ),
    }
    if source_art_rebound_digest is not None:
        actual["sourceArtRebound"] = _digest(
            source_art_rebound_digest, "Source-art-rebound byte digest"
        )
    consumed = {
        role: _digest(digest, f"Consumed coverage role {role} byte digest")
        for role, digest in (consumed_role_digests or {}).items()
    }
    unsupported = sorted(set(consumed) - ALLOWED_ROLES)
    if unsupported:
        raise ArtifactContractError(
            f"Coverage consumer supplied unsupported digest roles {unsupported}."
        )
    actual.update(consumed)
    if value.get("schemaVersion") != COVERAGE_SCHEMA:
        if legacy_tuple is not None and dict(legacy_tuple) == actual:
            return
        raise ArtifactContractError(
            "Catalog coverage declares schema "
            f"{bounded_observed(value.get('schemaVersion'))}; current reports require "
            f"{COVERAGE_SCHEMA}. Legacy coverage is readable only with its explicit full historical closure tuple."
        )
    if source_art_rebound_digest is None:
        raise ArtifactContractError(
            "Coverage/3 requires the exact source-art-rebound byte digest. Read the retained rebound artifact through the bounded report reader before verifying coverage."
        )
    bindings = _mapping(value.get("inputDigests"), "Coverage inputDigests")
    identification = _mapping(value.get("identification"), "Coverage identification")
    source = identification.get("source")
    if source not in {"deterministic", "adjudicated"}:
        raise ArtifactContractError(
            "Coverage identification source must be deterministic or adjudicated; received "
            f"{bounded_observed(source)}."
        )
    expected = BASE_ROLES | (ADJUDICATION_ROLES if source == "adjudicated" else set())
    if set(bindings) != expected:
        raise ArtifactContractError(
            f"Coverage/3 {source} inputDigests must contain exactly {sorted(expected)}; received "
            f"{sorted(bindings)}. Restore the compiler-authenticated closure roles."
        )
    for role, digest in bindings.items():
        _digest(digest, f"Coverage {role} digest")
    for role in (
        "features",
        "match",
        "distances",
        "elementResolution",
        "sourceArtRebound",
    ):
        if bindings.get(role) != actual[role]:
            raise ArtifactContractError(
                f"Coverage binds {role} {bounded_observed(bindings.get(role))}, but the retained {role} bytes hash to "
                f"{actual[role]}. Restore or regenerate one complete closure."
            )
    for role, digest in consumed.items():
        if bindings.get(role) != digest:
            raise ArtifactContractError(
                f"Coverage binds consumed role {role} {bounded_observed(bindings.get(role))}, but its retained bytes hash to "
                f"{digest}. Restore or regenerate one complete closure."
            )
    verify_coverage(
        coverage,
        coverage_digest=actual["coverage"],
        role_digests={
            **{
                role: actual[role]
                for role in (
                    "features",
                    "match",
                    "distances",
                    "elementResolution",
                    "sourceArtRebound",
                )
            },
            **consumed,
        },
    )
