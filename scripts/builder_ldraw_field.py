"""Builder's `Custom2DField`, read as the exact half-stud node lattice it is.

A field is a `(width + 1)` by `(height + 1)` lattice of nodes on a 0.4 Builder
unit pitch — one Builder unit is exactly 25 LDU, so that is the 10 LDU half stud
— laid out row-major from the field's own transformation. Each node carries a
`family:subtype:flags` code, and the family is the whole of what the field says
about connection: 0 and 1 are studs, 15 is the under-stud clutch, 7 and 9 are the
tube and rail that make a clutch grip, 18, 22 and 23 mark planes and edges, and
29 marks a node the part deliberately does not have.

Positions are exact rationals, never floats, because the whole point of this
lattice is that it lands on the stud grid exactly or not at all. Anything that
would make a node position inexact — a rotation that is not an axis permutation,
a grid whose length does not match its declared size, a field type with no
gender — is refused here and named, rather than carried forward as a small error.
"""

from __future__ import annotations

from dataclasses import dataclass
from fractions import Fraction
from typing import Sequence

BUILDER_UNIT_LDU = 25
FIELD_NODE_PITCH_BUILDER = Fraction(2, 5)
FIELD_NODE_PITCH_LDU = 10
STUD_PITCH_LDU = 20
MAX_FIELD_NODES = 4_096

TOP_FIELD_TYPE = 23
UNDERSIDE_FIELD_TYPE = 22

MALE_FAMILIES = {0: "solid-stud", 1: "open-stud"}
FEMALE_FAMILIES = {15: "under-stud-clutch"}
TUBE_FAMILIES = {7: "tube", 9: "rail"}
MARKER_FAMILIES = {18: "top-plane-marker", 22: "underside-plane-marker", 23: "field-edge-marker"}
ABSENT_FAMILY = 29

Rational3 = tuple[Fraction, Fraction, Fraction]


def _exact(value: str, label: str) -> Fraction:
    try:
        return Fraction(value)
    except (ValueError, ZeroDivisionError) as error:
        raise ValueError(
            f"{label} must be an exact decimal number; received {value!r}. A Builder frame is "
            "derived by exact lattice correspondence, so an unparsable coordinate is a refusal."
        ) from error


@dataclass(frozen=True)
class BuilderNode:
    """One `Custom2DField` node, in exact Builder units."""

    field_index: int
    field_type: int
    col: int
    row: int
    code: str
    family: int
    builder: Rational3
    axis: tuple[int, int, int]

    @property
    def role(self) -> str:
        if self.family in MALE_FAMILIES:
            return "male"
        if self.family in FEMALE_FAMILIES:
            return "female"
        if self.family in TUBE_FAMILIES:
            return "tube"
        if self.family == ABSENT_FAMILY:
            return "absent"
        if self.family in MARKER_FAMILIES:
            return "marker"
        return "unmapped"


def _signed_permutation(values: Sequence[Fraction], label: str) -> tuple[int, ...]:
    """An exact axis permutation, refused unless its storage order cannot matter.

    `builder_native_source` reads these nine numbers row-major and
    `derive-builder-ldraw-frames.py` reads them column-major; every pilot field
    is the identity, so the pilot does not settle which is right. A symmetric
    matrix reads the same either way, and anything else is refused rather than
    guessed.
    """

    if any(value.denominator != 1 or value not in (-1, 0, 1) for value in values[:9]):
        raise ValueError(
            f"{label} rotation is {[str(v) for v in values[:9]]}; this derivation accepts only an "
            "exact signed permutation of the axes, because a node lattice rotated by anything else "
            "is no longer an exact rational LDU position. Measure that field before fitting it."
        )
    matrix = tuple(int(value) for value in values[:9])
    for index in range(3):
        row = [matrix[index * 3 + column] for column in range(3)]
        column = [matrix[row_index * 3 + index] for row_index in range(3)]
        if sum(abs(value) for value in row) != 1 or sum(abs(value) for value in column) != 1:
            raise ValueError(
                f"{label} rotation {list(matrix)} is not a permutation of the three axes: row "
                f"{index} is {row} and column {index} is {column}, and each must carry exactly one "
                "entry of magnitude one."
            )
    transpose = tuple(matrix[column * 3 + row] for row in range(3) for column in range(3))
    if matrix != transpose:
        raise ValueError(
            f"{label} rotation {list(matrix)} is not symmetric, so reading it row-major and "
            "column-major give different frames. The seven-part pilot only ever carries the identity, "
            "so nothing here establishes which order Builder stores; measure a rotated field before "
            "accepting one."
        )
    return matrix


def builder_field_nodes(record: dict[str, object]) -> tuple[BuilderNode, ...]:
    """Every `Custom2DField` node of one Builder record, in exact Builder units."""

    design_id = record.get("id")
    primitives = record.get("connectivityPrimitives")
    if not isinstance(primitives, list):
        raise ValueError(f"Builder record {design_id!r} has no connectivityPrimitives array.")
    nodes: list[BuilderNode] = []
    for index, primitive in enumerate(primitives):
        if not isinstance(primitive, dict) or primitive.get("kind") != "Custom2DField":
            continue
        label = f"Builder record {design_id} connectivityPrimitives[{index}]"
        attributes = primitive.get("attributes")
        if not isinstance(attributes, dict):
            raise ValueError(f"{label} has no attributes object.")
        width = int(str(attributes.get("width")))
        height = int(str(attributes.get("height")))
        if width < 0 or height < 0 or (width + 1) * (height + 1) > MAX_FIELD_NODES:
            raise ValueError(
                f"{label} declares a {width}x{height} field; the node bound is {MAX_FIELD_NODES}."
            )
        field_type = int(str(attributes.get("type")))
        if field_type not in (TOP_FIELD_TYPE, UNDERSIDE_FIELD_TYPE):
            raise ValueError(
                f"{label} has field type {field_type}; this derivation reads {TOP_FIELD_TYPE} "
                f"(top plane) and {UNDERSIDE_FIELD_TYPE} (underside) only, because gender comes "
                "from the field type and an unknown type has no gender."
            )
        encoded = str(attributes.get("transformation")).split(",")
        if len(encoded) != 12:
            raise ValueError(
                f"{label} transformation needs 12 comma-separated numbers; found {len(encoded)}."
            )
        values = [_exact(value, f"{label} transformation") for value in encoded]
        rotation = _signed_permutation(values, label)
        translation = tuple(values[9:12])
        grid = str(primitive.get("grid", "")).split(",")
        cells = [cell.strip() for cell in grid]
        if len(cells) != (width + 1) * (height + 1):
            raise ValueError(
                f"{label} grid has {len(cells)} codes; a {width}x{height} field is a "
                f"{width + 1}x{height + 1} node lattice, so it needs "
                f"{(width + 1) * (height + 1)}."
            )
        axis = tuple(rotation[row * 3 + 1] for row in range(3))
        for row in range(height + 1):
            for col in range(width + 1):
                code = cells[row * (width + 1) + col]
                head = code.split(":")[0]
                if not head.isdecimal():
                    raise ValueError(
                        f"{label} node ({col}, {row}) is {code!r}; a node code starts with a "
                        "decimal family number."
                    )
                local = (
                    FIELD_NODE_PITCH_BUILDER * col,
                    Fraction(0),
                    FIELD_NODE_PITCH_BUILDER * row,
                )
                builder = tuple(
                    rotation[a * 3 + 0] * local[0]
                    + rotation[a * 3 + 1] * local[1]
                    + rotation[a * 3 + 2] * local[2]
                    + translation[a]
                    for a in range(3)
                )
                nodes.append(
                    BuilderNode(
                        field_index=index,
                        field_type=field_type,
                        col=col,
                        row=row,
                        code=code,
                        family=int(head),
                        builder=builder,  # type: ignore[arg-type]
                        axis=axis,  # type: ignore[arg-type]
                    )
                )
    if not nodes:
        raise ValueError(
            f"Builder record {design_id!r} carries no Custom2DField; there is no authored node "
            "lattice to derive a frame from."
        )
    return tuple(nodes)
