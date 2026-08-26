"""Bounded byte readers shared by Python identification reports."""

from __future__ import annotations

import hashlib
import json
import os
import re
import stat
from collections.abc import Mapping
from pathlib import Path

from part_identification_report_json import (
    MAX_JSON_CONTAINERS,
    MAX_JSON_DEPTH,
    MAX_JSON_NUMBER_BYTES,
    MAX_JSON_STRING_BYTES,
    MAX_JSON_TOTAL_STRING_BYTES,
    MAX_JSON_VALUES,
    parse_finite_json_float,
    prescan_json_bytes,
    reject_nonfinite_json,
    unique_object,
)

MAX_REPORT_INPUT_BYTES = 64 * 1024 * 1024
MAX_CARD_IMAGE_BUNDLE_BYTES = 192 * 1024 * 1024
MAX_BOOKLET_PDF_BYTES = 96 * 1024 * 1024
BUILDER_GEOMETRY_EXACT_BYTES = 1_091_772
CARD_RUN_ID = re.compile(r"^[0-9a-f]{24}$")
RETRIEVAL_REPORT_INPUTS = {
    "features": "output/part-identification/features.json",
    "match": "output/part-identification/match.json",
    "distances": "output/part-identification/distances.json",
    "cards": "output/part-identification/cards/manifest.json",
    "answers": "output/part-identification/answers-claude-opus-5.json",
    "score": "output/part-identification/score.json",
    "calloutManifest": "output/callout-thumbnails/manifest.json",
    "elementResolution": "output/part-identification/element-resolution.json",
    "inventoryLabels": "output/inventory-thumbnails/labels.json",
    "truthFirstFifty": "scripts/fixtures/part-identification-truth-first50.json",
    "sourceArtRebound": "output/part-identification/source-art-rebound.json",
    "actionLedger": "output/real-build/action-ledger.json",
    "coverage": "output/real-build/catalog-coverage.json",
    "builderCalibration": "output/real-build/builder-canonical-calibration.json",
    "transitionClassifications": "output/real-build/transition-classifications.json",
    "officialModel": "output/official-model/vx1087034_21066_a.xml",
    "bookletPdf": "recipes/6651557.pdf",
    "builderGeometry": "output/real-build/builder-shell-geometry.bin",
}


class ArtifactContractError(ValueError):
    """A report input cannot belong to one exact identification closure."""


def _same_file_identity(left: os.stat_result, right: os.stat_result) -> bool:
    """Match open files on Windows without treating an unavailable device as a mismatch."""

    if left.st_ino <= 0 or right.st_ino <= 0 or left.st_ino != right.st_ino:
        return False
    return not (left.st_dev and right.st_dev and left.st_dev != right.st_dev)


def _stat_state(
    value: os.stat_result, *, include_ctime: bool = True
) -> dict[str, int | float]:
    """State fields that expose same-inode mutation without relying on access time."""

    state: dict[str, int | float] = {}
    if hasattr(value, "st_size"):
        state["size"] = value.st_size
    names = ("mtime", "ctime") if include_ctime else ("mtime",)
    for name in names:
        nanoseconds = getattr(value, f"st_{name}_ns", None)
        seconds = getattr(value, f"st_{name}", None)
        if nanoseconds is not None:
            state[f"{name}Ns"] = nanoseconds
        elif seconds is not None:
            state[name] = seconds
    return state


def _state_changes(
    before: os.stat_result, after: os.stat_result, *, include_ctime: bool = True
) -> list[tuple[str, int | float, int | float]]:
    left = _stat_state(before, include_ctime=include_ctime)
    right = _stat_state(after, include_ctime=include_ctime)
    return [
        (name, left[name], right[name])
        for name in sorted(left.keys() & right.keys())
        if left[name] != right[name]
    ]


def _format_state_changes(
    changes: list[tuple[str, int | float, int | float]],
) -> str:
    return ", ".join(f"{name} {before!r} -> {after!r}" for name, before, after in changes)


def _require_direct_regular_file(value: os.stat_result, path: Path, label: str) -> None:
    reparse_flag = getattr(stat, "FILE_ATTRIBUTE_REPARSE_POINT", 0x400)
    if (
        stat.S_ISLNK(value.st_mode)
        or bool(getattr(value, "st_file_attributes", 0) & reparse_flag)
        or not stat.S_ISREG(value.st_mode)
    ):
        raise ArtifactContractError(
            f"{label} at {path} must be one direct regular file, not a link, reparse point, or directory."
        )


def read_bounded_bytes(
    path: Path, label: str, *, max_bytes: int = MAX_REPORT_INPUT_BYTES
) -> bytes:
    """Read one immutable regular-file snapshot under an exact byte ceiling."""

    if not isinstance(max_bytes, int) or isinstance(max_bytes, bool) or max_bytes < 0:
        raise ArtifactContractError(
            f"{label} at {path} received invalid byte ceiling {max_bytes!r}; use a non-negative integer."
        )

    try:
        inspected = path.lstat()
    except OSError as error:
        raise ArtifactContractError(
            f"{label} at {path} could not be inspected ({error.strerror or error})."
        ) from error
    _require_direct_regular_file(inspected, path, label)
    if inspected.st_size > max_bytes:
        raise ArtifactContractError(
            f"{label} at {path} is {inspected.st_size} bytes; the report input ceiling is "
            f"{max_bytes} bytes."
        )
    try:
        with path.open("rb") as handle:
            opened_before = os.fstat(handle.fileno())
            if not _same_file_identity(inspected, opened_before):
                raise ArtifactContractError(
                    f"{label} at {path} changed identity between inspection and open; retry from immutable bytes."
                )
            opened_size = getattr(opened_before, "st_size", inspected.st_size)
            if opened_size > max_bytes:
                raise ArtifactContractError(
                    f"{label} at {path} grew to {opened_size} bytes before open completed; "
                    f"the report input ceiling is {max_bytes} bytes."
                )
            # Windows exposes ctime differently through path and descriptor
            # snapshots, so compare it only between like-for-like snapshots.
            before_open_changes = _state_changes(
                inspected, opened_before, include_ctime=False
            )
            if before_open_changes:
                raise ArtifactContractError(
                    f"{label} at {path} changed state between inspection and open "
                    f"({_format_state_changes(before_open_changes)}); retry from immutable bytes."
                )
            data = handle.read(max_bytes + 1)
            opened_after = os.fstat(handle.fileno())
            if not _same_file_identity(opened_before, opened_after):
                raise ArtifactContractError(
                    f"{label} at {path} changed identity while being read; retry from immutable bytes."
                )
            if len(data) > max_bytes:
                raise ArtifactContractError(
                    f"{label} at {path} produced {len(data)} bytes while being read; the ceiling is "
                    f"{max_bytes} bytes."
                )
            after_size = getattr(opened_after, "st_size", len(data))
            if after_size > max_bytes:
                raise ArtifactContractError(
                    f"{label} at {path} grew to descriptor size {after_size} bytes while being read; "
                    f"the ceiling is {max_bytes} bytes."
                )
            during_read_changes = _state_changes(opened_before, opened_after)
            if during_read_changes:
                raise ArtifactContractError(
                    f"{label} at {path} changed same-inode descriptor state while being read "
                    f"({_format_state_changes(during_read_changes)}); retry from immutable bytes."
                )
            if len(data) != opened_size or len(data) != after_size:
                raise ArtifactContractError(
                    f"{label} at {path} descriptor declared {opened_size} bytes before and "
                    f"{after_size} bytes after the read, but exactly {len(data)} bytes were read; "
                    "the file shrank, grew, or returned an incomplete snapshot. Retry from immutable bytes."
                )
    except OSError as error:
        raise ArtifactContractError(
            f"{label} at {path} could not be read ({error.strerror or error})."
        ) from error

    try:
        path_after = path.lstat()
    except OSError as error:
        raise ArtifactContractError(
            f"{label} at {path} could not be re-inspected after reading "
            f"({error.strerror or error}); retry from immutable bytes."
        ) from error
    _require_direct_regular_file(path_after, path, label)
    if not _same_file_identity(opened_after, path_after):
        raise ArtifactContractError(
            f"{label} at {path} changed path identity after the descriptor read; retry from immutable bytes."
        )
    path_after_changes = _state_changes(inspected, path_after)
    if path_after_changes:
        raise ArtifactContractError(
            f"{label} at {path} changed path state after the descriptor read "
            f"({_format_state_changes(path_after_changes)}); retry from immutable bytes."
        )
    return data


def read_json_artifact(
    path: Path,
    label: str,
    *,
    max_bytes: int = MAX_REPORT_INPUT_BYTES,
    max_depth: int = MAX_JSON_DEPTH,
    max_values: int = MAX_JSON_VALUES,
    max_containers: int = MAX_JSON_CONTAINERS,
    max_string_bytes: int = MAX_JSON_STRING_BYTES,
    max_total_string_bytes: int = MAX_JSON_TOTAL_STRING_BYTES,
    max_number_bytes: int = MAX_JSON_NUMBER_BYTES,
) -> tuple[object, str]:
    """Parse and hash the same bounded UTF-8 JSON bytes."""

    data = read_bounded_bytes(path, label, max_bytes=max_bytes)
    try:
        prescan_json_bytes(
            data,
            max_bytes=max_bytes,
            max_depth=max_depth,
            max_values=max_values,
            max_containers=max_containers,
            max_string_bytes=max_string_bytes,
            max_total_string_bytes=max_total_string_bytes,
            max_number_bytes=max_number_bytes,
        )
        text = data.decode("utf-8")
        value = json.loads(
            text,
            parse_constant=reject_nonfinite_json,
            parse_float=parse_finite_json_float,
            object_pairs_hook=unique_object,
        )
    except (UnicodeDecodeError, json.JSONDecodeError, RecursionError, ValueError) as error:
        raise ArtifactContractError(
            f"{label} at {path} is not bounded finite UTF-8 JSON: {error}."
        ) from error
    return value, "sha256:" + hashlib.sha256(data).hexdigest()


def read_card_images_artifact(cards_root: Path, cards: object) -> tuple[Path, str]:
    """Hash the bounded immutable bundle named by one canonical cards/4 manifest."""

    if not isinstance(cards, Mapping):
        raise ArtifactContractError("Cards manifest must be a JSON object before reading card images.")
    run_id = cards.get("runId")
    images_file = cards.get("imagesFile")
    if (
        not isinstance(run_id, str)
        or CARD_RUN_ID.fullmatch(run_id) is None
        or images_file != f"runs/{run_id}/images.bin"
    ):
        raise ArtifactContractError(
            "Cards/4 must bind one canonical runs/<24 lowercase hex>/images.bin bundle."
        )
    path = cards_root / "runs" / run_id / "images.bin"
    data = read_bounded_bytes(
        path,
        "Part-identification card-image bundle",
        max_bytes=MAX_CARD_IMAGE_BUNDLE_BYTES,
    )
    return path, "sha256:" + hashlib.sha256(data).hexdigest()


def read_text_artifact(
    path: Path, label: str, *, errors: str = "strict"
) -> tuple[str, str]:
    """Decode and hash the same bounded text bytes."""

    data = read_bounded_bytes(path, label)
    try:
        text = data.decode("utf-8", errors=errors)
    except UnicodeDecodeError as error:
        raise ArtifactContractError(f"{label} at {path} is not valid UTF-8: {error}.") from error
    return text, "sha256:" + hashlib.sha256(data).hexdigest()
