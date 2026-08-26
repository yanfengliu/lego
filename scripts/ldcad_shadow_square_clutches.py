"""Exact opt-in semantics for LDCad female square S6 clutch sockets."""

from __future__ import annotations

from fractions import Fraction
from typing import Protocol, Sequence

SQUARE_CLUTCH_RADIUS_LDU = Fraction(6)
SQUARE_CLUTCH_MIN_DEPTH_LDU = Fraction(4)


class _Section(Protocol):
    variant: str
    radius: Fraction
    length: Fraction


class SquareSocketSnap(Protocol):
    command: str
    gender: str
    caps: str
    slide: bool
    centered: bool
    snap_id: str
    group: str
    transform_modifiers: tuple[str | None, str | None]
    sections: Sequence[_Section]


def require_square_s6_opt_in(value: object) -> bool:
    """Accept only a literal boolean because enabling this creates authority."""

    if type(value) is not bool:
        raise ValueError(
            "allow_square_s6 must be an explicit boolean; square LDCad sockets are "
            "connector authority and cannot be enabled by a truthy value."
        )
    return value


def is_square_s6_clutch_socket(snap: SquareSocketSnap) -> bool:
    """Match the independently controlled, bounded single-section socket shape."""

    return (
        snap.command == "SNAP_CYL"
        and snap.gender == "F"
        and snap.caps == "one"
        and not snap.slide
        and not snap.centered
        and snap.snap_id == ""
        and snap.group == ""
        and snap.transform_modifiers == (None, None)
        and len(snap.sections) == 1
        and snap.sections[0].variant == "S"
        and snap.sections[0].radius == SQUARE_CLUTCH_RADIUS_LDU
        and snap.sections[0].length >= SQUARE_CLUTCH_MIN_DEPTH_LDU
    )
