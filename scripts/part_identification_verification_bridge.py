"""Bounded Python-to-Node authentication for identification report inputs."""

from __future__ import annotations

import hashlib
import math
from dataclasses import dataclass
from pathlib import Path
from typing import Final

from part_identification_report_io import (
    ArtifactContractError,
    read_bounded_bytes as _read_bounded_bytes,
    read_card_images_artifact as _read_card_images_artifact,
    read_json_artifact as _read_json_artifact,
    read_text_artifact as _read_text_artifact,
)
from part_identification_verification_process import (
    VerificationProcessError,
    run_node_verifier,
)


BRIDGE_SCHEMA: Final = "lego.part-identification-report-verification/1"
BRIDGE_PATH: Final = Path(__file__).with_name("part-identification-report-verifier.mjs")
REPOSITORY_ROOT: Final = Path(__file__).resolve().parent.parent
@dataclass(frozen=True)
class _JsonRecord:
    value: object
    path: Path
    digest: str
    structure_digest: str


@dataclass(frozen=True)
class _BinaryRecord:
    path: Path
    digest: str


_json_by_identity: dict[int, _JsonRecord] = {}
_json_by_digest: dict[str, list[_JsonRecord]] = {}
_binary_by_digest: dict[str, list[_BinaryRecord]] = {}


def _structural_digest(value: object) -> str:
    """Hash parsed JSON while preserving types and list order without re-encoding it."""

    digest = hashlib.sha256()
    pending: list[tuple[str, object]] = [("value", value)]
    while pending:
        kind, item = pending.pop()
        if kind == "end-list":
            digest.update(b"]")
            continue
        if kind == "end-object":
            digest.update(b"}")
            continue
        if kind == "key":
            encoded = str(item).encode("utf-8")
            digest.update(b"k")
            digest.update(len(encoded).to_bytes(8, "big"))
            digest.update(encoded)
            continue
        if item is None:
            digest.update(b"n")
        elif type(item) is bool:
            digest.update(b"t" if item else b"f")
        elif type(item) is int:
            digest.update(b"i")
            digest.update(str(item).encode("ascii"))
            digest.update(b";")
        elif type(item) is float:
            if not math.isfinite(item):
                raise ArtifactContractError(
                    "A registered report artifact acquired a non-finite number after parsing."
                )
            digest.update(b"d")
            digest.update(item.hex().encode("ascii"))
            digest.update(b";")
        elif type(item) is str:
            encoded = item.encode("utf-8")
            digest.update(b"s")
            digest.update(len(encoded).to_bytes(8, "big"))
            digest.update(encoded)
        elif type(item) is list:
            digest.update(b"[")
            digest.update(len(item).to_bytes(8, "big"))
            pending.append(("end-list", None))
            pending.extend(("value", child) for child in reversed(item))
        elif type(item) is dict:
            keys = sorted(item)
            if any(type(key) is not str for key in keys):
                raise ArtifactContractError(
                    "A registered report artifact contains a non-string JSON object key."
                )
            digest.update(b"{")
            digest.update(len(keys).to_bytes(8, "big"))
            pending.append(("end-object", None))
            for key in reversed(keys):
                pending.append(("value", item[key]))
                pending.append(("key", key))
        else:
            raise ArtifactContractError(
                f"A registered report artifact contains unsupported parsed type {type(item).__name__}."
            )
    return digest.hexdigest()


def register_json_artifact(value: object, path: Path, digest: str) -> None:
    record = _JsonRecord(
        value=value,
        path=path.resolve(),
        digest=digest,
        structure_digest=_structural_digest(value),
    )
    _json_by_identity[id(value)] = record
    _json_by_digest.setdefault(digest, []).append(record)


def register_binary_artifact(path: Path, digest: str) -> None:
    record = _BinaryRecord(path=path.resolve(), digest=digest)
    _binary_by_digest.setdefault(digest, []).append(record)


def read_json_artifact(path: Path, label: str, **bounds) -> tuple[object, str]:
    value, digest = _read_json_artifact(path, label, **bounds)
    register_json_artifact(value, path, digest)
    return value, digest


def read_card_images_artifact(cards_root: Path, cards: object) -> tuple[Path, str]:
    path, digest = _read_card_images_artifact(cards_root, cards)
    register_binary_artifact(path, digest)
    return path, digest


def read_binary_artifact(
    path: Path,
    label: str,
    *,
    max_bytes: int,
    exact_bytes: int | None = None,
) -> tuple[bytes, str]:
    """Read one bounded binary role and retain the exact path/digest authority."""

    data = _read_bounded_bytes(path, label, max_bytes=max_bytes)
    if exact_bytes is not None and len(data) != exact_bytes:
        raise ArtifactContractError(
            f"{label} at {path} is {len(data)} bytes; the exact required size is {exact_bytes} bytes."
        )
    digest = "sha256:" + hashlib.sha256(data).hexdigest()
    register_binary_artifact(path, digest)
    return data, digest


def read_text_artifact(
    path: Path, label: str, *, errors: str = "strict"
) -> tuple[str, str]:
    """Decode bounded text and retain authority over the same exact bytes."""

    value, digest = _read_text_artifact(path, label, errors=errors)
    register_binary_artifact(path, digest)
    return value, digest


def _json_record_for_value(value: object, digest: str, label: str) -> _JsonRecord:
    record = _json_by_identity.get(id(value))
    if record is None or record.value is not value:
        raise ArtifactContractError(
            f"{label} has no retained raw-byte authority. Read it through the bounded report reader before verification."
        )
    if record.digest != digest:
        raise ArtifactContractError(
            f"{label} was read with digest {record.digest}, but verification was asked to bind {digest}."
        )
    if record.structure_digest != _structural_digest(value):
        raise ArtifactContractError(
            f"{label} changed after its bounded read. Re-read one immutable retained generation before verification."
        )
    return record


def _json_record_for_digest(digest: str, label: str) -> _JsonRecord:
    for record in reversed(_json_by_digest.get(digest, [])):
        if record.path.is_file() and record.structure_digest == _structural_digest(record.value):
            return record
    raise ArtifactContractError(
        f"{label} digest {digest} has no immutable retained JSON role in this report read."
    )


def _binary_record_for_digest(digest: str, label: str) -> _BinaryRecord:
    for record in reversed(_binary_by_digest.get(digest, [])):
        if record.path.is_file():
            return record
    raise ArtifactContractError(
        f"{label} digest {digest} has no immutable retained binary role in this report read."
    )


def _artifact(record: _JsonRecord | _BinaryRecord) -> dict[str, str]:
    return {"path": str(record.path), "digest": record.digest}


def _run(kind: str, artifacts: dict[str, dict[str, str]]) -> None:
    try:
        run_node_verifier(
            schema=BRIDGE_SCHEMA,
            kind=kind,
            artifacts=artifacts,
            bridge_path=BRIDGE_PATH,
            repository_root=REPOSITORY_ROOT,
        )
    except VerificationProcessError as error:
        raise ArtifactContractError(
            str(error)
        ) from error


def verify_identification(
    features: object,
    match: object,
    distances: object,
    *,
    features_digest: str,
    match_digest: str,
    distances_digest: str,
) -> None:
    _run(
        "identification",
        {
            "features": _artifact(
                _json_record_for_value(features, features_digest, "Part-identification features")
            ),
            "match": _artifact(_json_record_for_value(match, match_digest, "Part-identification match")),
            "distances": _artifact(
                _json_record_for_value(distances, distances_digest, "Part-identification distances")
            ),
        },
    )


def verify_adjudication(
    cards: object,
    answers: object,
    *,
    features_digest: str,
    match_digest: str,
    cards_digest: str,
) -> None:
    answers_record = _json_by_identity.get(id(answers))
    if answers_record is None or answers_record.value is not answers:
        raise ArtifactContractError(
            "Part-identification answers have no retained raw-byte authority. Read them through the bounded report reader before verification."
        )
    _run(
        "adjudication",
        {
            "match": _artifact(_json_record_for_digest(match_digest, "Part-identification match")),
            "cards": _artifact(_json_record_for_value(cards, cards_digest, "Part-identification cards")),
            "answers": _artifact(
                _json_record_for_value(answers, answers_record.digest, "Part-identification answers")
            ),
            "features-binding": {"path": "", "digest": features_digest},
        },
    )


def verify_coverage(
    coverage: object,
    *,
    coverage_digest: str,
    role_digests: dict[str, str],
) -> None:
    artifacts = {
        "coverage": _artifact(
            _json_record_for_value(coverage, coverage_digest, "Catalog coverage")
        )
    }
    json_roles = {
        "features",
        "match",
        "distances",
        "elementResolution",
        "calloutManifest",
        "pairJudged",
        "cards",
        "answers",
    }
    for role in sorted(json_roles & set(role_digests)):
        artifacts[role] = _artifact(_json_record_for_digest(role_digests[role], role))
    if "cardImages" in role_digests:
        artifacts["cardImages"] = _artifact(
            _binary_record_for_digest(role_digests["cardImages"], "cardImages")
        )
    _run("coverage", artifacts)


def verify_score_summary(score: object, *, digests: dict[str, str]) -> None:
    score_record = _json_by_identity.get(id(score))
    if score_record is None or score_record.value is not score:
        raise ArtifactContractError(
            "Part-identification score summary has no retained raw-byte authority. Read it through the bounded report reader before verification."
        )
    required_json = {
        "features",
        "match",
        "distances",
        "elementResolution",
        "inventoryLabels",
        "truthFirstFifty",
        "cards",
        "answers",
    }
    artifacts = {"score": _artifact(_json_record_for_value(score, score_record.digest, "Score summary"))}
    for role in sorted(required_json):
        artifacts[role] = _artifact(_json_record_for_digest(digests[role], role))
    artifacts["cardImages"] = _artifact(
        _binary_record_for_digest(digests["cardImages"], "cardImages")
    )
    _run("score-summary", artifacts)


def verify_action_ledger(
    ledger: object,
    coverage: object,
    features: object,
    *,
    ledger_digest: str,
    coverage_digest: str,
    features_digest: str,
    role_digests: dict[str, str],
) -> None:
    """Reproduce exact ledger bytes with the canonical TypeScript compiler and validator."""

    artifacts = {
        "actionLedger": _artifact(
            _json_record_for_value(ledger, ledger_digest, "Action ledger")
        ),
        "coverage": _artifact(
            _json_record_for_value(coverage, coverage_digest, "Action-ledger coverage")
        ),
        "features": _artifact(
            _json_record_for_value(features, features_digest, "Action-ledger features")
        ),
    }
    for role in ("calloutManifest", "builderCalibration", "transitionClassifications"):
        artifacts[role] = _artifact(_json_record_for_digest(role_digests[role], role))
    for role in ("officialModel", "bookletPdf", "builderGeometry"):
        artifacts[role] = _artifact(_binary_record_for_digest(role_digests[role], role))
    _run("action-ledger", artifacts)
