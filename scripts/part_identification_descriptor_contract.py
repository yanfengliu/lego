"""Exact bounded descriptor shape consumed by Python identification reports."""

from __future__ import annotations

import math
import re
from collections.abc import Mapping

from part_identification_report_io import ArtifactContractError


DESCRIPTOR_GRID_CELLS = 28 * 28
MAX_FEATURE_CALLOUTS = 4_000
MAX_INVENTORY_ELEMENTS = 4_096
ELEMENT_ID = re.compile(r"^[0-9]{3,12}$")
DESCRIPTOR_FIELDS = {
    "aspect",
    "boxHeight",
    "boxWidth",
    "colours",
    "detail",
    "grid",
    "ink",
    "lightFace",
    "mean",
    "pixels",
}
COLOUR_FIELDS = {"rgb", "share"}
MAX_OBSERVED_CHARACTERS = 240
MAX_OBSERVED_STRING_CHARACTERS = 120
MAX_OBSERVED_SAMPLE_ITEMS = 4


def _bounded_text(value: str) -> str:
    if len(value) <= MAX_OBSERVED_STRING_CHARACTERS:
        return repr(value)
    prefix = value[: MAX_OBSERVED_STRING_CHARACTERS - 3] + "..."
    return f"{prefix!r} (string length {len(value)})"


def _scalar_observed(value: object) -> str:
    if isinstance(value, str):
        return _bounded_text(value)
    if value is None or type(value) in (bool, int, float):
        return repr(value)
    if isinstance(value, list):
        return f"list(length={len(value)})"
    if isinstance(value, Mapping):
        return f"object(keys={len(value)})"
    return f"<{type(value).__name__}>"


def bounded_observed(value: object) -> str:
    try:
        if isinstance(value, list):
            sample = ", ".join(
                _scalar_observed(item)
                for item in value[:MAX_OBSERVED_SAMPLE_ITEMS]
            )
            suffix = ", ..." if len(value) > MAX_OBSERVED_SAMPLE_ITEMS else ""
            rendered = f"list(length={len(value)}, sample=[{sample}{suffix}])"
        elif isinstance(value, Mapping):
            keys = list(value)[:MAX_OBSERVED_SAMPLE_ITEMS]
            sample = ", ".join(_scalar_observed(key) for key in keys)
            suffix = ", ..." if len(value) > MAX_OBSERVED_SAMPLE_ITEMS else ""
            rendered = f"object(keys={len(value)}, sample=[{sample}{suffix}])"
        else:
            rendered = _scalar_observed(value)
    except Exception:
        rendered = f"<uninspectable {type(value).__name__}>"
    if len(rendered) <= MAX_OBSERVED_CHARACTERS:
        return rendered
    return rendered[: MAX_OBSERVED_CHARACTERS - 3] + "..."


def _descriptor_error(label: str, requirement: str, value: object) -> None:
    raise ArtifactContractError(
        f"{label} {requirement}; received {bounded_observed(value)}. "
        "Regenerate this descriptor from the exact retained thumbnail bytes."
    )


def _mapping(value: object, label: str) -> Mapping:
    if not isinstance(value, Mapping):
        raise ArtifactContractError(
            f"{label} must be a JSON object; received {bounded_observed(value)}."
        )
    return value


def _exact_fields(value: Mapping, expected: set[str], label: str) -> None:
    observed = set(value)
    if observed != expected:
        missing = sorted(expected - observed)
        extras = sorted(observed - expected, key=repr)
        raise ArtifactContractError(
            f"{label} must contain exactly {sorted(expected)}; missing {bounded_observed(missing)}, "
            f"extra {bounded_observed(extras)}. Regenerate this descriptor from the exact retained "
            "thumbnail bytes."
        )


def _finite_number(value: object) -> bool:
    return type(value) is int or (type(value) is float and math.isfinite(value))


def _integer(value: object, minimum: int, maximum: int) -> bool:
    return (
        _finite_number(value)
        and int(value) == value
        and minimum <= value <= maximum
    )


def _byte(value: object) -> bool:
    return _integer(value, 0, 255)


def _byte_cells(value: object, label: str) -> None:
    if not isinstance(value, list) or len(value) != DESCRIPTOR_GRID_CELLS:
        _descriptor_error(
            label,
            f"must contain exactly {DESCRIPTOR_GRID_CELLS} byte cells",
            value,
        )
    invalid_index = next(
        (index for index, cell in enumerate(value) if not _byte(cell)), None
    )
    if invalid_index is not None:
        _descriptor_error(
            f"{label}[{invalid_index}]",
            "must be an integer byte from 0 through 255",
            value[invalid_index],
        )


def require_descriptor(descriptor: object, label: str) -> None:
    """Mirror the features/3 descriptor contract used by thumbnailDistance."""

    value = _mapping(descriptor, label)
    _exact_fields(value, DESCRIPTOR_FIELDS, label)
    _byte_cells(value["grid"], f"{label}.grid")
    _byte_cells(value["detail"], f"{label}.detail")
    width = value["boxWidth"]
    height = value["boxHeight"]
    if not _integer(width, 1, 4_096):
        _descriptor_error(
            f"{label}.boxWidth", "must be a safe integer from 1 through 4096", width
        )
    if not _integer(height, 1, 4_096):
        _descriptor_error(
            f"{label}.boxHeight", "must be a safe integer from 1 through 4096", height
        )
    pixels = value["pixels"]
    area = width * height
    if not _integer(pixels, 1, area):
        _descriptor_error(
            f"{label}.pixels",
            f"must be a positive integer no larger than boxWidth*boxHeight ({area})",
            pixels,
        )
    if not _finite_number(value["aspect"]) or value["aspect"] != width / height:
        _descriptor_error(
            f"{label}.aspect",
            f"must be the exact finite boxWidth/boxHeight ratio {width / height}",
            value["aspect"],
        )
    if not _finite_number(value["ink"]) or value["ink"] != pixels / area:
        _descriptor_error(
            f"{label}.ink",
            f"must be the exact finite pixels/(boxWidth*boxHeight) ratio {pixels / area}",
            value["ink"],
        )
    mean = value["mean"]
    if not isinstance(mean, list) or len(mean) != 3:
        _descriptor_error(
            f"{label}.mean", "must contain exactly three integer byte channels", mean
        )
    invalid_mean = next(
        (index for index, channel in enumerate(mean) if not _byte(channel)), None
    )
    if invalid_mean is not None:
        _descriptor_error(
            f"{label}.mean[{invalid_mean}]",
            "must be an integer byte from 0 through 255",
            mean[invalid_mean],
        )
    if not _byte(value["lightFace"]):
        _descriptor_error(
            f"{label}.lightFace",
            "must be one integer byte from 0 through 255",
            value["lightFace"],
        )
    colours = value["colours"]
    if not isinstance(colours, list) or not 1 <= len(colours) <= 4:
        _descriptor_error(
            f"{label}.colours", "must contain 1 through 4 colour records", colours
        )
    for index, colour in enumerate(colours):
        colour_value = _mapping(colour, f"{label}.colours[{index}]")
        _exact_fields(colour_value, COLOUR_FIELDS, f"{label}.colours[{index}]")
        rgb = colour_value["rgb"]
        if not isinstance(rgb, list) or len(rgb) != 3:
            _descriptor_error(
                f"{label}.colours[{index}].rgb",
                "must contain exactly three integer byte channels",
                rgb,
            )
        invalid_rgb = next(
            (channel for channel, value in enumerate(rgb) if not _byte(value)), None
        )
        if invalid_rgb is not None:
            _descriptor_error(
                f"{label}.colours[{index}].rgb[{invalid_rgb}]",
                "must be an integer byte from 0 through 255",
                rgb[invalid_rgb],
            )
        share = colour_value["share"]
        if not _finite_number(share) or not 0 < share <= 1:
            _descriptor_error(
                f"{label}.colours[{index}].share",
                "must be finite and greater than 0 through 1",
                share,
            )


def require_features_v3_descriptors(features: object) -> tuple[str, ...]:
    """Validate every callout and inventory descriptor before distance work."""

    value = _mapping(features, "Part-identification features")
    callouts = value.get("callouts")
    if not isinstance(callouts, list) or not 1 <= len(callouts) <= MAX_FEATURE_CALLOUTS:
        raise ArtifactContractError(
            "Features/3 callouts must be a bounded array containing 1 through 4000 records."
        )
    for index, callout in enumerate(callouts):
        callout_value = _mapping(callout, f"Features/3 callout {index}")
        if callout_value.get("evidenceKind") == "part-art":
            require_descriptor(callout_value.get("descriptor"), f"Features/3 callout {index} descriptor")
        elif "descriptor" in callout_value:
            raise ArtifactContractError(
                f"Features/3 non-part-art callout {index} must not carry a descriptor."
            )
    inventory = _mapping(value.get("inventory"), "Features/3 inventory")
    if not 1 <= len(inventory) <= MAX_INVENTORY_ELEMENTS:
        raise ArtifactContractError(
            "Features/3 inventory must contain 1 through 4096 descriptor records."
        )
    for element_id, descriptor in inventory.items():
        if not isinstance(element_id, str) or ELEMENT_ID.fullmatch(element_id) is None:
            raise ArtifactContractError(
                f"Features/3 inventory element id {bounded_observed(element_id)} must contain 3 through 12 "
                "ASCII decimal digits; regenerate element-resolution and features from the exact "
                "inventory labels."
            )
        require_descriptor(descriptor, f"Features/3 inventory descriptor {element_id}")
    return tuple(inventory)
