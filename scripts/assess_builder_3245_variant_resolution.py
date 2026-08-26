"""Apply a frozen target-independent geometry contract to quarantined 3245 evidence."""

from __future__ import annotations

import argparse
import hashlib
import json
import math
from pathlib import Path

import builder_variant_resolution_contract as CONTRACT
import identify_builder_3245_variant_report as TARGET_REPORT


SCHEMA_VERSION = "lego.builder-3245-calibrated-resolution/1"
FROZEN_CONTRACT_BYTES = 11_198
FROZEN_CONTRACT_SHA256 = "22d71c7655e4e490378204d9b3a2cdefa8d48a94c26b32df40a6c5b6449177c8"
TARGET_REPORT_BYTES = 12_520
TARGET_REPORT_SHA256 = "33d3a213fcf347a8a03ae4dcc2bd6a12605d98c1d4f5bd4e2facada8b793ebbb"
SOURCE_VERDICT_BYTES = 11_165
SOURCE_VERDICT_SHA256 = "eed1e8d9ef5be58c73abc4f33edff6d397ea4715dcd7b0be31df16133265df18"
MAX_INPUT_BYTES = 512 * 1024
MAX_OUTPUT_BYTES = 512 * 1024


def canonical_bytes(value: object) -> bytes:
    return (json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=True) + "\n").encode()


def sha256(payload: bytes) -> str:
    return hashlib.sha256(payload).hexdigest()


def read_json(path: Path, maximum: int, label: str) -> tuple[bytes, object]:
    payload = path.read_bytes()
    if not 0 < len(payload) <= maximum:
        raise ValueError(f"{label} must contain 1..{maximum} bytes; received {len(payload)}.")
    try:
        return payload, json.loads(payload)
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        raise ValueError(f"{label} is not strict UTF-8 JSON: {error}.") from error


def validate_contract(value: object) -> dict[str, object]:
    if not isinstance(value, dict) or value.get("schemaVersion") != CONTRACT.SCHEMA_VERSION:
        raise ValueError("Control contract has the wrong schema.")
    if value.get("containsTargetData") is not False:
        raise ValueError("Control contract contains or claims target data.")
    authority = value.get("authority")
    metric = value.get("metric")
    thresholds = value.get("thresholds")
    controls = value.get("controls")
    if (
        not isinstance(authority, dict)
        or authority.get("catalogAdmission") is not False
        or authority.get("placement") is not False
        or not isinstance(metric, dict)
        or metric.get("properFrameCount") != 24
        or metric.get("reflectionsAdmitted") is not False
        or not isinstance(thresholds, dict)
        or not isinstance(controls, list)
        or len(controls) != 6
    ):
        raise ValueError("Control contract weakens authority, frame, or population boundaries.")
    derivation = thresholds.get("derivation")
    if not isinstance(derivation, dict) or derivation.get("targetRead") is not False:
        raise ValueError("Control thresholds were not frozen independently of the target.")
    decisive = [row for row in controls if isinstance(row, dict) and row.get("expected") == "select-correct"]
    ambiguous = [row for row in controls if isinstance(row, dict) and row.get("expected") == "unresolved"]
    if len(decisive) != 4 or len(ambiguous) != 2:
        raise ValueError("Control contract must retain four decisive and two ambiguous controls.")
    for row in decisive:
        scoring = row.get("scoring")
        if not isinstance(scoring, dict) or scoring.get("rawVerdict") != row.get("correctRoot"):
            raise ValueError("A decisive control no longer selects its authenticated correct root.")
    for row in ambiguous:
        scoring = row.get("scoring")
        if not isinstance(scoring, dict) or scoring.get("rawVerdict") != "unresolved":
            raise ValueError("An exact-alias control no longer refuses selection.")
    return value


def normalized_proper_frame(linear: object) -> tuple[int, ...]:
    if not isinstance(linear, list) or len(linear) != 9:
        raise ValueError("Target frame must contain one nine-number linear map.")
    normalized = []
    for value in linear:
        if isinstance(value, bool) or not isinstance(value, (int, float)):
            raise ValueError("Target frame contains a nonnumeric coefficient.")
        quotient = float(value) / 25
        rounded = round(quotient)
        if abs(quotient - rounded) > 1e-9:
            raise ValueError("Target frame is not the exact Builder-to-LDU scale times a signed permutation.")
        normalized.append(rounded)
    matrix = tuple(normalized)
    if matrix not in CONTRACT.proper_orientation_registry().values():
        raise ValueError("Target frame is not one of the exact 24 determinant-positive orientations.")
    return matrix


def score_target(report: dict[str, object], thresholds: dict[str, object]) -> dict[str, object]:
    candidates = report["geometry"]["candidateMeasurements"]
    rows = []
    frame_rosters = []
    for candidate in candidates:
        frame_scores = []
        frame_rows = candidate["frames"]
        for frame_row in frame_rows:
            matrix = normalized_proper_frame(frame_row["frame"]["linearLdu"])
            frame_rosters.append((frame_row["frame"]["name"], matrix))
            witnesses = frame_row["pairwiseDiscriminativeSurface"]
            if len(witnesses) != 2:
                raise ValueError("Each target candidate must retain two rejected-candidate witnesses.")
            maxima = []
            for witness in witnesses:
                if witness.get("candidatePointsFartherThanThresholdFromOther", 0) <= 0:
                    raise ValueError("Target candidates are pairwise ambiguous under the frozen witness distance.")
                distance = witness.get("distanceToBuilderShell")
                if not isinstance(distance, dict):
                    raise ValueError("Target witness omits its Builder Shell distance.")
                maxima.append(float(distance["maximumLdu"]))
            frame_scores.append(max(maxima))
        if len(frame_scores) != 2 or abs(frame_scores[0] - frame_scores[1]) > 0.000001:
            raise ValueError("The target's residual proper-frame symmetry changes its candidate score.")
        rows.append({"root": candidate["root"], "scoreMaximumWitnessDistanceLdu": frame_scores[0]})
    expected_frames = {
        ("turn0", (1, 0, 0, 0, -1, 0, 0, 0, -1)),
        ("turn180", (-1, 0, 0, 0, -1, 0, 0, 0, 1)),
    }
    if set(frame_rosters) != expected_frames:
        raise ValueError("Target comparison did not retain exactly both proved residual proper frames.")
    ranked = sorted((float(row["scoreMaximumWitnessDistanceLdu"]), str(row["root"])) for row in rows)
    best, runner_up = ranked[0], ranked[1]
    gap = round(runner_up[0] - best[0], 6)
    ratio = math.inf if best[0] == 0 else round(runner_up[0] / best[0], 6)
    fit_limit = float(thresholds["maximumAcceptedWitnessDistanceLdu"])
    gap_limit = float(thresholds["minimumRunnerUpGapLdu"])
    ratio_limit = float(thresholds["minimumRunnerUpRatio"])
    gates = {
        "fitCeiling": best[0] <= fit_limit,
        "absoluteMargin": gap >= gap_limit,
        "ratioMargin": ratio >= ratio_limit,
    }
    selected = best[1] if all(gates.values()) else None
    return {
        "candidateScores": rows,
        "observedBestRoot": best[1],
        "observedBestScoreLdu": best[0],
        "observedRunnerUpRoot": runner_up[1],
        "observedRunnerUpScoreLdu": runner_up[0],
        "runnerUpGapLdu": gap,
        "runnerUpRatio": ratio,
        "thresholds": thresholds,
        "gates": gates,
        "selectedRoot": selected,
        "state": "selected-under-control-derived-geometry-contract" if selected else "unresolved",
    }


def validate_source_verdict(payload: bytes, value: object) -> dict[str, object]:
    if len(payload) != SOURCE_VERDICT_BYTES or sha256(payload) != SOURCE_VERDICT_SHA256:
        raise ValueError("Source-integrity verdict differs from the exact retained independent audit.")
    if not isinstance(value, dict) or value.get("schemaVersion") != "lego.builder-source-integrity-verdict/1":
        raise ValueError("Source-integrity verdict has the wrong schema.")
    verdict = value.get("verdict")
    controls = value.get("instrumentAndPopulationControls")
    expected = value.get("expectedChecksumProvenance")
    observed = value.get("observedObjectProvenance")
    alternates = value.get("alternateRouteExhaustion")
    if (
        not isinstance(verdict, dict)
        or verdict.get("state") != "unresolved-upstream-manifest-object-contradiction"
        or verdict.get("catalogAdmissionAuthorized") is not False
        or verdict.get("variantIdentityAuthorized") is not False
        or verdict.get("sourceAuthorityResolved") is not False
        or not isinstance(controls, dict)
        or not isinstance(expected, dict)
        or not isinstance(observed, dict)
        or not isinstance(alternates, dict)
    ):
        raise ValueError("Independent source verdict no longer preserves its unresolved authority.")
    population = controls.get("retainedSetCache")
    persistence = expected.get("persistence")
    current = observed.get("current")
    if (
        not isinstance(population, dict)
        or population.get("bundleCount") != 175
        or population.get("manifestEqualsWholeServedPayloadMd5") != 157
        or population.get("manifestMismatchCount") != 18
        or population.get("declaredA679BodyOccurrences") != 0
        or population.get("observedBdceBodyOccurrences") != 1
        or population.get("allMismatchExpectedChecksumsAbsentFromObservedBodyMd5Population") is not True
        or not isinstance(persistence, dict)
        or persistence.get("sameRowAcrossThreeResponses") is not True
        or not isinstance(current, dict)
        or current.get("byteIdenticalToRetainedBundle") is not True
        or alternates.get("declaredAndroidChecksumMatchesAnySiblingPayload") is not False
    ):
        raise ValueError("Source contradiction population or alternate-route evidence is incomplete.")
    return value


def create_assessment(
    contract_payload: bytes,
    target_payload: bytes,
    source_payload: bytes,
    expected_contract_sha256: str,
) -> dict[str, object]:
    actual_contract = sha256(contract_payload)
    if (
        len(contract_payload) != FROZEN_CONTRACT_BYTES
        or actual_contract != FROZEN_CONTRACT_SHA256
        or expected_contract_sha256.removeprefix("sha256:") != FROZEN_CONTRACT_SHA256
    ):
        raise ValueError(
            f"Control contract is {len(contract_payload)} bytes sha256:{actual_contract}; expected "
            f"exactly {FROZEN_CONTRACT_BYTES} bytes sha256:{FROZEN_CONTRACT_SHA256}."
        )
    if len(target_payload) != TARGET_REPORT_BYTES or sha256(target_payload) != TARGET_REPORT_SHA256:
        raise ValueError("Target report differs from the exact fresh comparator rerun.")
    contract = validate_contract(json.loads(contract_payload))
    target = TARGET_REPORT.validate_report(json.loads(target_payload))
    source = validate_source_verdict(source_payload, json.loads(source_payload))
    geometry = score_target(target, contract["thresholds"])
    source_unresolved = source["verdict"]["sourceAuthorityResolved"] is False
    return {
        "schemaVersion": SCHEMA_VERSION,
        "scope": {
            "elementId": "4618852",
            "builderDesignRevision": "3245;M",
            "officialLdrawCandidates": ["parts/3245a.dat", "parts/3245b.dat", "parts/3245c.dat"],
        },
        "inputs": {
            "controlContract": {"bytes": len(contract_payload), "sha256": f"sha256:{actual_contract}"},
            "targetReport": {"bytes": len(target_payload), "sha256": f"sha256:{sha256(target_payload)}"},
            "sourceIntegrityVerdict": {
                "bytes": len(source_payload),
                "sha256": f"sha256:{sha256(source_payload)}",
            },
        },
        "geometry": geometry,
        "sourceAuthority": {
            "state": source["verdict"]["state"],
            "fatalForElementRevisionIdentity": source_unresolved,
            "manifestMd5": source["expectedChecksumProvenance"]["md5"],
            "servedBodyMd5": source["observedObjectProvenance"]["md5"],
            "reason": (
                "The official route and ETag bind the retained bytes to one served versioned object, "
                "but 157 of 175 retained controls prove that this manifest Checksum field normally "
                "equals the whole served-body MD5. The target is among 18 contradictions, the declared "
                "MD5 occurs in zero retained bodies, and no retained first-party record maps it to the "
                "served object. Response metadata bounds the object; it does not reconcile the two "
                "official identities."
            ),
        },
        "authorityVerdict": {
            "catalogAdmitted": False,
            "placementAuthorized": False,
            "variantIdentityAuthorized": False,
            "verdict": "unresolved",
            "strongestProvedResult": (
                f"The frozen non-target geometry contract selects {geometry['selectedRoot']}; "
                "the unresolved official manifest/object contradiction still blocks an honest "
                "element-to-revision-to-LDraw identity claim."
            ),
        },
    }


def write_atomic(path: Path, payload: bytes) -> None:
    if len(payload) > MAX_OUTPUT_BYTES:
        raise ValueError(f"Assessment is {len(payload)} bytes; cap is {MAX_OUTPUT_BYTES}.")
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(f".{path.name}.tmp")
    temporary.write_bytes(payload)
    temporary.replace(path)


def main() -> int:
    parser = argparse.ArgumentParser(description="Assess 3245 only after freezing non-target controls.")
    parser.add_argument("--contract", type=Path, required=True)
    parser.add_argument("--contract-sha256", required=True)
    parser.add_argument("--target-report", type=Path, required=True)
    parser.add_argument("--source-verdict", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    contract_payload, _ = read_json(args.contract, MAX_INPUT_BYTES, "Control contract")
    target_payload, _ = read_json(args.target_report, MAX_INPUT_BYTES, "Target report")
    source_payload, _ = read_json(args.source_verdict, MAX_INPUT_BYTES, "Source-integrity verdict")
    assessment = create_assessment(
        contract_payload, target_payload, source_payload, args.contract_sha256
    )
    encoded = canonical_bytes(assessment)
    write_atomic(args.output, encoded)
    print(
        canonical_bytes(
            {
                "geometryState": assessment["geometry"]["state"],
                "output": str(args.output),
                "sha256": f"sha256:{sha256(encoded)}",
                "verdict": assessment["authorityVerdict"]["verdict"],
            }
        ).decode(),
        end="",
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
