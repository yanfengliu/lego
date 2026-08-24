"""Strict public-report boundary for the quarantine-only 3245-M comparator."""

from __future__ import annotations

import re


SCHEMA_VERSION = "lego.quarantined-builder-3245-variant/1"
DERIVED_LDR_BYTES = 139_649
DERIVED_LDR_SHA256 = "096b78037ef1ee15a6dcff90b38f00f09465d0f5a246cb6f5f08fac087dd7bc2"
EXPECTED_INPUT_IDENTITIES = {
    "builderBundle": {"bytes": 85_098, "sha256": "sha256:1aa4e8333df9914191a4d941a7ce0f95460311eabd8f159f9e4a9b1e5c1c9534"},
    "builderNativeFrameContract": {"bytes": 14_313, "sha256": "sha256:e01defa39408391c658e90b607987fbf3abec413978eba70526f1851ea916f6d"},
    "capture": {"bytes": 1_126, "sha256": "sha256:7fc1cd42f22af7d58c9531dffbc1fa18de48624cbfb76f706a2fb56213cf3a3f"},
    "derivedModelLdraw": {"bytes": DERIVED_LDR_BYTES, "sha256": f"sha256:{DERIVED_LDR_SHA256}"},
    "officialLdraw": {"bytes": 144_722_356, "sha256": "sha256:6009f2e94204c4d3a63a4c812010b5c90bad8c5acb19b882c859fdac63734eae"},
    "officialModel": {"bytes": 1_903_169, "sha256": "sha256:c0564fd86ede633f6cb18738f999fbb70ee948ba93a55cc8d338b4b5f02b5922"},
    "pinnedParserContractSha256": "sha256:c4cc3cf7e9e066258688bc9fcace54e0b5c32d39f01956f07d1aff9c25dba80b",
}
UNRESOLVED_REASONS = [
    "no-numerical-decisive-margin-was-predeclared-before-the-3245-scores-were-observed",
    "builder-manifest-expected-md5-contradicts-the-captured-body-and-response-etag",
    "derived-model-ldr-references-b-without-a-retained-converter-or-m-to-b-alias-table",
]


def derived_ldr_crosscheck(payload: bytes) -> dict[str, object]:
    roots = []
    for line in payload.decode("utf-8", "strict").splitlines():
        fields = line.split()
        if fields and fields[0] == "1" and re.fullmatch(r"3245(?:[abc])?\.dat", fields[-1], re.I):
            roots.append(fields[-1].lower())
    if roots != ["3245b.dat"] * 10:
        raise ValueError(
            "Derived model LDR must retain exactly ten 3245b.dat counterevidence rows; "
            f"found {roots}."
        )
    return {
        "converterRetained": False,
        "officialSelectionAuthority": False,
        "references": [{"count": 10, "root": "3245b.dat"}],
        "revisionAliasTableRetained": False,
    }


def _object(value: object, keys: set[str], label: str) -> dict[str, object]:
    if not isinstance(value, dict) or set(value) != keys:
        actual = set(value) if isinstance(value, dict) else set()
        raise ValueError(
            f"{label} has unexpected schema; extra={sorted(actual - keys)}, "
            f"missing={sorted(keys - actual)}."
        )
    return value


def validate_report(value: object) -> dict[str, object]:
    report = _object(
        value,
        {
            "catalogAdmitted",
            "geometry",
            "inputIdentities",
            "schemaVersion",
            "sourceAuthority",
            "status",
            "supported",
            "unresolvedReasons",
            "verdict",
        },
        "Variant report",
    )
    if (
        report["schemaVersion"] != SCHEMA_VERSION
        or report["status"] != "quarantined-source-evidence-only"
        or report["catalogAdmitted"] is not False
        or report["supported"] is not False
        or report["verdict"] != "unresolved"
        or report["unresolvedReasons"] != UNRESOLVED_REASONS
    ):
        raise ValueError("Variant report attempts to alter its fixed unresolved quarantine authority.")
    if report["inputIdentities"] != EXPECTED_INPUT_IDENTITIES:
        raise ValueError("Variant report input identities differ from the exact fixed benchmark pins.")
    geometry = report["geometry"]
    if not isinstance(geometry, dict):
        raise ValueError("Variant geometry must be a bounded object.")
    strongest = geometry.get("strongestProvedResult")
    instrument = geometry.get("instrument")
    candidates = geometry.get("candidateMeasurements")
    if (
        geometry.get("comparisonStatus") != "unresolved-no-predeclared-decisive-margin"
        or geometry.get("isolatedDecodes") != 2
        or not isinstance(strongest, dict)
        or strongest.get("admissionDecisionSupported") is not False
        or not isinstance(instrument, dict)
        or not isinstance(instrument.get("controls"), dict)
        or instrument.get("tessellationInvariant") is not False
        or instrument["controls"].get("allPassed") is not True
        or instrument["controls"].get("contains3245Data") is not False
        or instrument["controls"].get("population") != 4
        or not isinstance(candidates, list)
    ):
        raise ValueError("Variant geometry is incomplete or attempts to publish a selection.")
    expected_roots = ["parts/3245a.dat", "parts/3245b.dat", "parts/3245c.dat"]
    if [row.get("root") if isinstance(row, dict) else None for row in candidates] != expected_roots:
        raise ValueError("Variant geometry must measure all three fixed official candidate roots.")
    for candidate in candidates:
        frames = candidate.get("frames")
        if (
            not isinstance(frames, list)
            or [row.get("frame", {}).get("name") for row in frames] != ["turn0", "turn180"]
        ):
            raise ValueError("Each variant must measure both residual same-frame symmetries.")
    source = report["sourceAuthority"]
    if not isinstance(source, dict) or source.get("authorityResolved") is not False:
        raise ValueError("Geometry may not self-certify Builder source authority.")
    contradiction = source.get("manifestContradiction")
    if not isinstance(contradiction, dict) or contradiction.get("resolved") is not False:
        raise ValueError("Variant report must preserve the unresolved Builder MD5 contradiction.")
    crosscheck = source.get("derivedModelLdrawCrossCheck")
    if crosscheck != derived_ldr_crosscheck(b"1 0 0 0 0 1 0 0 0 1 0 0 0 1 3245b.dat\n" * 10):
        raise ValueError("Variant report must retain the derived LDR's authority-free b counterevidence.")
    frame = geometry.get("frameDerivation")
    if (
        not isinstance(frame, dict)
        or frame.get("builderNativeFrameId") != "lego-builder-native-to-catalog-ldu/1"
        or frame.get("builderNativeBasisLinearLdu") != [25, 0, 0, 0, -25, 0, 0, 0, -25]
        or frame.get("mirroredRegistrationsAdmitted") is not False
    ):
        raise ValueError("Variant report must bind the established proper Builder native basis.")
    return report
