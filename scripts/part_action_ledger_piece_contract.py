"""Piece-level schema and coverage/official binding for report action ledgers."""

from __future__ import annotations

import math
import re
from collections.abc import Mapping

from part_identification_descriptor_contract import bounded_observed
from part_identification_report_io import ArtifactContractError


SHA256 = re.compile(r"^sha256:[0-9a-f]{64}$")
CALLOUT_KEY = re.compile(
    r"^p[0-9]+\|q[0-9]+\|x-?[0-9]+\.[0-9]{3}\|y-?[0-9]+\.[0-9]{3}$"
)
TRUSTED_CONFIDENCES = frozenset({"vision-kept", "pair-judged-same"})
PIECE_FIELDS = {
    "brickRef", "designId", "materialId", "catalogPartId", "colorId", "calloutKey",
    "identificationConfidence", "cropDigest", "identificationInputDigest", "evidenceDigest",
    "transform",
}


def _mapping(value: object, label: str) -> Mapping:
    if not isinstance(value, Mapping):
        raise ArtifactContractError(f"{label} must be a JSON object; received {type(value).__name__}.")
    return value


def _digest(value: object, label: str) -> str:
    if not isinstance(value, str) or SHA256.fullmatch(value) is None:
        raise ArtifactContractError(
            f"{label} must be a lowercase sha256 digest; received {bounded_observed(value)}."
        )
    return value


def _bounded_string(value: object, label: str, maximum: int) -> str:
    if not isinstance(value, str) or not 1 <= len(value) <= maximum:
        raise ArtifactContractError(f"{label} must contain 1 through {maximum} characters.")
    return value


def _transform(value: object, label: str) -> None:
    if value is None:
        return
    transform = _mapping(value, label)
    if set(transform) != {"orientationId", "positionLdu"}:
        raise ArtifactContractError(
            f"{label} must contain exactly orientationId and positionLdu."
        )
    _bounded_string(transform["orientationId"], f"{label}.orientationId", 128)
    position = transform["positionLdu"]
    if (
        not isinstance(position, list)
        or len(position) != 3
        or any(
            not isinstance(coordinate, (int, float))
            or isinstance(coordinate, bool)
            or not math.isfinite(coordinate)
            or abs(coordinate) > 1_000_000
            for coordinate in position
        )
    ):
        raise ArtifactContractError(
            f"{label}.positionLdu must contain three finite coordinates within +/-1000000."
        )


def require_action_piece(value: object, label: str, *, copy: bool = False) -> Mapping:
    piece = _mapping(value, label)
    fields = PIECE_FIELDS | ({"sourceBrickRef"} if copy else set())
    if set(piece) != fields:
        raise ArtifactContractError(
            f"{label} must contain exactly {sorted(fields)}; received {sorted(piece)}."
        )
    for field, maximum in (
        ("brickRef", 256), ("designId", 64), ("materialId", 64),
        ("catalogPartId", 256), ("colorId", 128),
    ):
        _bounded_string(piece[field], f"{label}.{field}", maximum)
    if copy:
        _bounded_string(piece["sourceBrickRef"], f"{label}.sourceBrickRef", 256)
    callout_key = piece["calloutKey"]
    if callout_key is not None and (
        not isinstance(callout_key, str) or CALLOUT_KEY.fullmatch(callout_key) is None
    ):
        raise ArtifactContractError(
            f"{label}.calloutKey must be null or one canonical ASCII callout identity; received {bounded_observed(callout_key)}."
        )
    confidence = piece["identificationConfidence"]
    if confidence not in TRUSTED_CONFIDENCES and confidence != "official-model":
        raise ArtifactContractError(
            f"{label}.identificationConfidence {bounded_observed(confidence)} is not a trusted coverage label or "
            "official-model. Refuse the piece instead of minting positive truth."
        )
    if piece["cropDigest"] is not None:
        _digest(piece["cropDigest"], f"{label}.cropDigest")
    _digest(piece["identificationInputDigest"], f"{label}.identificationInputDigest")
    _digest(piece["evidenceDigest"], f"{label}.evidenceDigest")
    _transform(piece["transform"], f"{label}.transform")
    return piece


def require_direct_piece_binding(
    piece: Mapping,
    *,
    label: str,
    step_number: int,
    step_callouts: Mapping[str, set[str]],
    coverage_by_callout: Mapping,
    official_bricks: Mapping[str, Mapping],
) -> None:
    callout_key = piece["calloutKey"]
    if not isinstance(callout_key, str):
        raise ArtifactContractError(f"{label}.calloutKey must bind one exact printed callout.")
    physical_refs = step_callouts.get(callout_key)
    if physical_refs is None or piece["brickRef"] not in physical_refs:
        raise ArtifactContractError(
            f"{label} binds callout {bounded_observed(callout_key)} to Brick "
            f"{bounded_observed(piece['brickRef'])}, but ledger step "
            f"{step_number} does not declare that exact callout/physicalBrickRefs pair."
        )
    claim = _mapping(coverage_by_callout.get(callout_key), f"{label} coverage claim")
    resolution = _mapping(claim.get("resolution"), f"{label} coverage resolution")
    expected = {
        "stepNumber": (step_number, claim.get("stepNumber")),
        "designId": (piece["designId"], resolution.get("partNum")),
        "catalogPartId": (piece["catalogPartId"], resolution.get("catalogPartId")),
        "colorId": (piece["colorId"], resolution.get("colorId")),
        "identificationConfidence": (piece["identificationConfidence"], claim.get("identificationConfidence")),
        "cropDigest": (piece["cropDigest"], claim.get("cropDigest")),
        "identificationInputDigest": (piece["identificationInputDigest"], claim.get("inputDigest")),
    }
    mismatches = {field: {"piece": left, "coverage": right} for field, (left, right) in expected.items() if left != right}
    if mismatches or piece["identificationConfidence"] not in TRUSTED_CONFIDENCES:
        raise ArtifactContractError(
            f"{label} does not reproduce its exact trusted coverage claim for {callout_key}: "
            f"{bounded_observed(mismatches or piece['identificationConfidence'])}. "
            "Regenerate coverage and the action ledger together."
        )
    official = official_bricks.get(piece["brickRef"])
    element_id = claim.get("elementId")
    if (
        official is None
        or official["designId"] != piece["designId"]
        or official["materialId"] != piece["materialId"]
        or not isinstance(element_id, str)
        or element_id not in official["elementIds"]
    ):
        raise ArtifactContractError(
            f"{label} callout {bounded_observed(callout_key)} claims element/design/material "
            f"{bounded_observed(element_id)}/{bounded_observed(piece['designId'])}/"
            f"{bounded_observed(piece['materialId'])}, but exact official Brick "
            f"{bounded_observed(piece['brickRef'])} resolves to {bounded_observed(official)}. Restore one reconciled "
            "coverage/ledger/official-model closure before scoring."
        )
