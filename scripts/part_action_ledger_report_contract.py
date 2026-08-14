"""Bound and cross-bind action-ledger facts before Python reports call them truth."""

from __future__ import annotations

import re
from collections.abc import Mapping

from part_action_ledger_official_contract import official_bricks
from part_action_ledger_piece_contract import (
    CALLOUT_KEY,
    require_action_piece,
    require_direct_piece_binding,
)
from part_identification_descriptor_contract import bounded_observed
from part_identification_report_io import ArtifactContractError
from part_identification_verification_bridge import verify_action_ledger


SHA256 = re.compile(r"^sha256:[0-9a-f]{64}$")
MAX_LEDGER_STEPS = 359
MAX_LEDGER_IDENTITIES = 4_000


def _mapping(value: object, label: str) -> Mapping:
    if not isinstance(value, Mapping):
        raise ArtifactContractError(
            f"{label} must be a JSON object; received {type(value).__name__}. "
            "Regenerate the exact bounded action ledger."
        )
    return value


def _exact_fields(value: Mapping, expected: set[str], label: str) -> None:
    if set(value) != expected:
        raise ArtifactContractError(
            f"{label} must contain exactly {sorted(expected)}; received {bounded_observed(sorted(value))}. "
            "Regenerate the action ledger with the current ledger compiler."
        )


def _digest(value: object, label: str) -> str:
    if not isinstance(value, str) or SHA256.fullmatch(value) is None:
        raise ArtifactContractError(
            f"{label} must be a lowercase sha256 digest; received {bounded_observed(value)}."
        )
    return value


def _bounded_string(value: object, label: str, maximum: int = 512) -> str:
    if not isinstance(value, str) or not 1 <= len(value) <= maximum:
        length = len(value) if isinstance(value, str) else type(value).__name__
        raise ArtifactContractError(
            f"{label} must contain 1 through {maximum} characters; received {length}."
        )
    return value


def _whole(value: object, label: str, minimum: int, maximum: int) -> int:
    if type(value) is not int or not minimum <= value <= maximum:
        raise ArtifactContractError(
            f"{label} must be an integer from {minimum} through {maximum}; received {bounded_observed(value)}."
        )
    return value


def require_action_ledger_report_chain(
    ledger: object,
    *,
    ledger_digest: str,
    coverage: object,
    coverage_digest: str,
    features: object,
    features_digest: str,
    callout_manifest_digest: str,
    official_model_text: str,
    official_model_digest: str,
    builder_calibration_digest: str,
    transition_classifications_digest: str,
    booklet_pdf_digest: str,
    builder_geometry_digest: str,
) -> None:
    """Require bounded ledger structure and every digest/content edge reports consume."""

    ledger_digest = _digest(ledger_digest, "Action-ledger retained bytes digest")
    coverage_digest = _digest(coverage_digest, "Action-ledger coverage byte digest")
    features_digest = _digest(features_digest, "Action-ledger features byte digest")
    value = _mapping(ledger, "Action ledger")
    _exact_fields(
        value,
        {
            "schemaVersion",
            "pdfDigest",
            "officialModelDigest",
            "coverageDigest",
            "calloutManifestDigest",
            "builderCalibrationDigest",
            "transitionClassificationsDigest",
            "steps",
            "provenance",
        },
        "Action ledger",
    )
    if value["schemaVersion"] != "lego.real-build-action-ledger/2":
        raise ArtifactContractError(
            "Action ledger must use lego.real-build-action-ledger/2; received "
            f"{bounded_observed(value['schemaVersion'])}."
        )
    coverage_value = _mapping(coverage, "Action-ledger coverage")
    features_value = _mapping(features, "Action-ledger features")
    input_digests = _mapping(features_value.get("inputDigests"), "Action-ledger feature digests")
    coverage_digests = _mapping(
        coverage_value.get("inputDigests"), "Action-ledger coverage digests"
    )
    bindings = {
        "pdfDigest": (value["pdfDigest"], input_digests.get("pdf")),
        "coveragePdfDigest": (value["pdfDigest"], coverage_digests.get("pdf")),
        "officialModelDigest": (value["officialModelDigest"], official_model_digest),
        "coverageDigest": (value["coverageDigest"], coverage_digest),
        "calloutManifestDigest": (
            value["calloutManifestDigest"],
            callout_manifest_digest,
        ),
        "coverageCalloutManifestDigest": (
            value["calloutManifestDigest"],
            coverage_digests.get("calloutManifest"),
        ),
        "builderCalibrationDigest": (
            value["builderCalibrationDigest"],
            builder_calibration_digest,
        ),
        "transitionClassificationsDigest": (
            value["transitionClassificationsDigest"],
            transition_classifications_digest,
        ),
    }
    for field, (declared, actual) in bindings.items():
        _digest(declared, f"Action ledger {field}")
        _digest(actual, f"Action ledger exact {field} input")
        if declared != actual:
            raise ArtifactContractError(
                f"Action ledger {field} declares {declared}, but the exact consumed input is "
                f"{actual}. Regenerate the ledger from the same retained report closure."
            )

    official = official_bricks(official_model_text)
    coverage_by_callout = _mapping(
        coverage_value.get("byCallout"), "Action-ledger coverage.byCallout"
    )
    steps = value["steps"]
    if not isinstance(steps, list) or not 1 <= len(steps) <= MAX_LEDGER_STEPS:
        count = len(steps) if isinstance(steps, list) else type(steps).__name__
        raise ArtifactContractError(
            f"Action ledger must contain 1 through {MAX_LEDGER_STEPS} bounded steps; received {count}."
        )

    accepted_count = 0
    transition_count = 0
    identity_count = 0
    seen_bricks: set[str] = set()
    for index, raw_step in enumerate(steps):
        step = _mapping(raw_step, f"Action ledger steps[{index}]")
        _exact_fields(
            step,
            {"stepNumber", "pageNumber", "panelEvidenceDigest", "callouts", "action"},
            f"Action ledger steps[{index}]",
        )
        step_number = _whole(step["stepNumber"], f"Action ledger steps[{index}].stepNumber", 1, 359)
        if step_number != index + 1:
            raise ArtifactContractError(
                f"Action ledger steps[{index}].stepNumber is {step_number}; required dense printed "
                f"step {index + 1}. Sort and regenerate the ledger before scoring."
            )
        _whole(step["pageNumber"], f"Action ledger step {step_number}.pageNumber", 1, 10_000)
        _digest(step["panelEvidenceDigest"], f"Action ledger step {step_number}.panelEvidenceDigest")
        callouts = step["callouts"]
        if not isinstance(callouts, list) or len(callouts) > MAX_LEDGER_IDENTITIES:
            raise ArtifactContractError(
                f"Action ledger step {step_number}.callouts must be a bounded array of at most "
                f"{MAX_LEDGER_IDENTITIES}; received {len(callouts) if isinstance(callouts, list) else type(callouts).__name__}."
            )
        step_callouts: dict[str, set[str]] = {}
        for callout_index, raw_callout in enumerate(callouts):
            label = f"Action ledger step {step_number}.callouts[{callout_index}]"
            callout = _mapping(raw_callout, label)
            _exact_fields(
                callout,
                {"calloutKey", "physicalBrickRefs", "semanticMultiplierQuantity"},
                label,
            )
            key = callout["calloutKey"]
            if not isinstance(key, str) or CALLOUT_KEY.fullmatch(key) is None or key in step_callouts:
                raise ArtifactContractError(
                    f"{label}.calloutKey must be one unique canonical ASCII identity; received {bounded_observed(key)}."
                )
            references = callout["physicalBrickRefs"]
            if (
                not isinstance(references, list)
                or len(references) > MAX_LEDGER_IDENTITIES
                or any(not isinstance(ref, str) or not ref for ref in references)
                or len(set(references)) != len(references)
            ):
                raise ArtifactContractError(
                    f"{label}.physicalBrickRefs must be a bounded unique string array."
                )
            _whole(
                callout["semanticMultiplierQuantity"],
                f"{label}.semanticMultiplierQuantity",
                0,
                10_000,
            )
            step_callouts[key] = set(references)

        action = _mapping(step["action"], f"Action ledger step {step_number}.action")
        kind = action.get("kind")
        if kind == "place-callouts":
            _exact_fields(action, {"kind", "pieces", "omittedPieces"}, f"Action ledger step {step_number}.action")
            for field in ("pieces", "omittedPieces"):
                rows = action[field]
                if not isinstance(rows, list) or len(rows) > MAX_LEDGER_IDENTITIES:
                    raise ArtifactContractError(
                        f"Action ledger step {step_number}.action.{field} must be a bounded array."
                    )
                identity_count += len(rows)
                for piece_index, raw_piece in enumerate(rows):
                    label = f"Action ledger step {step_number}.action.{field}[{piece_index}]"
                    piece = require_action_piece(raw_piece, label)
                    brick_ref = piece["brickRef"]
                    if brick_ref in seen_bricks:
                        raise ArtifactContractError(
                            f"{label}.brickRef {bounded_observed(brick_ref)} was already used by an earlier ledger identity."
                        )
                    seen_bricks.add(brick_ref)
                    if field == "pieces":
                        accepted_count += 1
                        require_direct_piece_binding(
                            piece,
                            label=label,
                            step_number=step_number,
                            step_callouts=step_callouts,
                            coverage_by_callout=coverage_by_callout,
                            official_bricks=official,
                        )
        elif kind == "multi-build-copy":
            _exact_fields(action, {"kind", "sourceStepNumber", "copies"}, f"Action ledger step {step_number}.action")
            _whole(
                action["sourceStepNumber"],
                f"Action ledger step {step_number}.action.sourceStepNumber",
                1,
                step_number - 1,
            )
            copies = action["copies"]
            if not isinstance(copies, list) or len(copies) > MAX_LEDGER_IDENTITIES:
                raise ArtifactContractError(
                    f"Action ledger step {step_number}.action.copies must be a bounded array."
                )
            identity_count += len(copies)
            for copy_index, raw_copy in enumerate(copies):
                require_action_piece(
                    raw_copy,
                    f"Action ledger step {step_number}.action.copies[{copy_index}]",
                    copy=True,
                )
        elif kind == "transition":
            _exact_fields(
                action,
                {"kind", "transition", "classificationEvidenceDigest"},
                f"Action ledger step {step_number}.action",
            )
            if action["transition"] not in {"rotation", "attachment", "final-view"}:
                raise ArtifactContractError(
                    f"Action ledger step {step_number}.action.transition is unsupported: "
                    f"{bounded_observed(action['transition'])}."
                )
            _digest(
                action["classificationEvidenceDigest"],
                f"Action ledger step {step_number}.action.classificationEvidenceDigest",
            )
            transition_count += 1
        else:
            raise ArtifactContractError(
                f"Action ledger step {step_number}.action.kind is {bounded_observed(kind)}; required "
                "place-callouts, multi-build-copy, or transition."
            )
        if identity_count > MAX_LEDGER_IDENTITIES:
            raise ArtifactContractError(
                f"Action ledger contains more than {MAX_LEDGER_IDENTITIES} piece/copy identities."
            )

    provenance = _mapping(value["provenance"], "Action ledger provenance")
    _exact_fields(
        provenance,
        {
            "generator",
            "authenticated",
            "expectedPrintedSteps",
            "alignedThroughStep",
            "stopReason",
            "directPieceCount",
            "transitionStepCount",
            "refusals",
        },
        "Action ledger provenance",
    )
    _bounded_string(provenance["generator"], "Action ledger provenance.generator", 512)
    if provenance["authenticated"] is not False:
        raise ArtifactContractError(
            "Action ledger provenance.authenticated must remain false; this local diagnostic is not authority."
        )
    _whole(provenance["expectedPrintedSteps"], "Action ledger expectedPrintedSteps", 359, 359)
    if provenance["alignedThroughStep"] != len(steps):
        raise ArtifactContractError(
            "Action ledger provenance.alignedThroughStep is "
            f"{bounded_observed(provenance['alignedThroughStep'])}, "
            f"but the dense retained prefix contains {len(steps)} steps."
        )
    _bounded_string(provenance["stopReason"], "Action ledger provenance.stopReason", 16_384)
    if provenance["directPieceCount"] != accepted_count:
        raise ArtifactContractError(
            "Action ledger provenance.directPieceCount is "
            f"{bounded_observed(provenance['directPieceCount'])}, "
            f"but exact accepted action.pieces contain {accepted_count}."
        )
    if provenance["transitionStepCount"] != transition_count:
        raise ArtifactContractError(
            "Action ledger provenance.transitionStepCount is "
            f"{bounded_observed(provenance['transitionStepCount'])}, "
            f"but exact transition actions contain {transition_count}."
        )
    refusals = provenance["refusals"]
    if not isinstance(refusals, list) or len(refusals) > MAX_LEDGER_IDENTITIES:
        raise ArtifactContractError(
            f"Action ledger provenance.refusals must contain at most {MAX_LEDGER_IDENTITIES} records."
        )
    for index, raw_refusal in enumerate(refusals):
        label = f"Action ledger provenance.refusals[{index}]"
        refusal = _mapping(raw_refusal, label)
        _exact_fields(refusal, {"stepNumber", "calloutKey", "brickRef", "reason"}, label)
        _whole(refusal["stepNumber"], f"{label}.stepNumber", 1, 359)
        if not isinstance(refusal["calloutKey"], str) or CALLOUT_KEY.fullmatch(refusal["calloutKey"]) is None:
            raise ArtifactContractError(
                f"{label}.calloutKey must be one canonical ASCII identity; received "
                f"{bounded_observed(refusal['calloutKey'])}."
            )
        if refusal["brickRef"] is not None:
            _bounded_string(refusal["brickRef"], f"{label}.brickRef", 256)
        _bounded_string(refusal["reason"], f"{label}.reason", 16_384)

    verify_action_ledger(
        value, coverage_value, features_value,
        ledger_digest=ledger_digest,
        coverage_digest=coverage_digest,
        features_digest=features_digest,
        role_digests={
            "calloutManifest": callout_manifest_digest, "officialModel": official_model_digest,
            "builderCalibration": builder_calibration_digest, "bookletPdf": booklet_pdf_digest,
            "transitionClassifications": transition_classifications_digest,
            "builderGeometry": builder_geometry_digest,
        },
    )
