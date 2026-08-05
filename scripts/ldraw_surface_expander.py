from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Callable, Protocol


SourceKey = tuple[str, str]
SourceIdentity = tuple[str, str, str]
Vector3 = tuple[float, float, float]
Matrix3 = tuple[float, float, float, float, float, float, float, float, float]

MAX_RECURSION_DEPTH = 64
MAX_EXPANDED_REFERENCES = 65_536
MAX_EXPANDED_TRIANGLES = 2_000_000
MAX_SOURCE_NUMBER_MAGNITUDE = 1_000_000_000.0
MAX_EXPANDED_COORDINATE_MAGNITUDE_LDU = 1_000_000_000.0


class SourceLibrary(Protocol):
    def text(self, key: SourceKey) -> str: ...

    def resolve(self, reference: str, source_archive_id: str) -> SourceKey: ...


@dataclass(frozen=True)
class AffineTransform:
    matrix: Matrix3
    translation: Vector3


@dataclass(frozen=True)
class ExpandedTriangle:
    points: tuple[Vector3, Vector3, Vector3]
    role: str
    ancestry: tuple[SourceKey, ...]
    source: SourceKey
    line_number: int
    certified: bool
    cull_enabled: bool


@dataclass
class _ExpansionBudget:
    references: int = 0
    triangles: int = 0


IDENTITY = AffineTransform(
    matrix=(1.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 1.0),
    translation=(0.0, 0.0, 0.0),
)


def determinant(matrix: Matrix3) -> float:
    a, b, c, d, e, f, g, h, i = matrix
    return a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g)


def transform_point(transform: AffineTransform, point: Vector3) -> Vector3:
    a, b, c, d, e, f, g, h, i = transform.matrix
    x, y, z = point
    tx, ty, tz = transform.translation
    result = (
        a * x + b * y + c * z + tx,
        d * x + e * y + f * z + ty,
        g * x + h * y + i * z + tz,
    )
    if any(
        not math.isfinite(value) or abs(value) > MAX_EXPANDED_COORDINATE_MAGNITUDE_LDU
        for value in result
    ):
        raise ValueError(
            "Expanded LDraw coordinate is non-finite or exceeds "
            f"{MAX_EXPANDED_COORDINATE_MAGNITUDE_LDU:g} LDU: {result}"
        )
    return result


def compose(parent: AffineTransform, child: AffineTransform) -> AffineTransform:
    pa, pb, pc, pd, pe, pf, pg, ph, pi = parent.matrix
    ca, cb, cc, cd, ce, cf, cg, ch, ci = child.matrix
    matrix = (
        pa * ca + pb * cd + pc * cg,
        pa * cb + pb * ce + pc * ch,
        pa * cc + pb * cf + pc * ci,
        pd * ca + pe * cd + pf * cg,
        pd * cb + pe * ce + pf * ch,
        pd * cc + pe * cf + pf * ci,
        pg * ca + ph * cd + pi * cg,
        pg * cb + ph * ce + pi * ch,
        pg * cc + ph * cf + pi * ci,
    )
    translation = transform_point(parent, child.translation)
    if any(not math.isfinite(value) or abs(value) > MAX_SOURCE_NUMBER_MAGNITUDE for value in matrix):
        raise ValueError(
            "Composed LDraw matrix is non-finite or exceeds the numeric boundary: "
            f"{matrix}"
        )
    return AffineTransform(matrix=matrix, translation=translation)


def _numbers(fields: list[str], source: SourceKey, line_number: int) -> list[float]:
    try:
        values = [float(value) for value in fields]
    except ValueError as error:
        raise ValueError(
            f"Malformed LDraw number at {source[0]}:{source[1]}:{line_number}: {error}"
        ) from error
    if any(
        not math.isfinite(value) or abs(value) > MAX_SOURCE_NUMBER_MAGNITUDE
        for value in values
    ):
        raise ValueError(
            f"LDraw number at {source[0]}:{source[1]}:{line_number} is non-finite or exceeds "
            f"magnitude {MAX_SOURCE_NUMBER_MAGNITUDE:g}: {fields}"
        )
    return values


def _validate_colour(value: str, source: SourceKey, line_number: int) -> None:
    decimal = value.isdecimal()
    direct = (
        len(value) == 9
        and value.startswith(("0x2", "0x3"))
        and all(character in "0123456789ABCDEF" for character in value[3:])
    )
    if not decimal and not direct:
        raise ValueError(
            f"Malformed LDraw colour at {source[0]}:{source[1]}:{line_number}: {value!r}; "
            "expected a non-negative decimal colour or an exact 0x2/0x3 direct colour."
        )
    if decimal and int(value) > int(MAX_SOURCE_NUMBER_MAGNITUDE):
        raise ValueError(
            f"LDraw colour at {source[0]}:{source[1]}:{line_number} exceeds the numeric "
            f"boundary {MAX_SOURCE_NUMBER_MAGNITUDE:g}: {value!r}"
        )


def _bfc_options(fields: list[str], source: SourceKey, line_number: int) -> tuple[str, ...]:
    options = tuple(fields[2:])
    allowed = {
        ("NOCERTIFY",),
        ("CERTIFY",),
        ("CERTIFY", "CW"),
        ("CERTIFY", "CCW"),
        ("CW",),
        ("CCW",),
        ("CLIP",),
        ("CLIP", "CW"),
        ("CLIP", "CCW"),
        ("CW", "CLIP"),
        ("CCW", "CLIP"),
        ("NOCLIP",),
        ("INVERTNEXT",),
    }
    if options not in allowed:
        raise ValueError(
            f"Unsupported or malformed BFC statement at {source[0]}:{source[1]}:{line_number}: "
            f"{' '.join(fields)!r}"
        )
    return options


def _subtract(left: Vector3, right: Vector3) -> Vector3:
    return (left[0] - right[0], left[1] - right[1], left[2] - right[2])


def _cross(left: Vector3, right: Vector3) -> Vector3:
    return (
        left[1] * right[2] - left[2] * right[1],
        left[2] * right[0] - left[0] * right[2],
        left[0] * right[1] - left[1] * right[0],
    )


def _dot(left: Vector3, right: Vector3) -> float:
    return left[0] * right[0] + left[1] * right[1] + left[2] * right[2]


def _length(vector: Vector3) -> float:
    return math.hypot(*vector)


def _angle_degrees(left: Vector3, right: Vector3) -> float:
    denominator = _length(left) * _length(right)
    if denominator == 0:
        return 0.0
    cosine = max(-1.0, min(1.0, _dot(left, right) / denominator))
    return math.degrees(math.acos(cosine))


def _validate_quad(points: list[Vector3], source: SourceKey, line_number: int) -> None:
    scale = max(
        1.0,
        *(
            _length(_subtract(points[left], points[right]))
            for left in range(4)
            for right in range(left)
        ),
    )
    area_tolerance = scale * scale * 1e-12
    edge_tolerance = scale * 1e-12
    for index in range(4):
        incoming = _subtract(points[(index - 1) % 4], points[index])
        outgoing = _subtract(points[(index + 1) % 4], points[index])
        if _length(incoming) <= edge_tolerance or _length(outgoing) <= edge_tolerance:
            raise ValueError(
                f"LDraw quad at {source[0]}:{source[1]}:{line_number} contains repeated "
                "adjacent vertices; provide four distinct vertices."
            )
        interior_angle = _angle_degrees(incoming, outgoing)
        if interior_angle < 0.025 or interior_angle > 179.9:
            raise ValueError(
                f"LDraw quad at {source[0]}:{source[1]}:{line_number} has a collinear "
                f"or nearly collinear interior angle of {interior_angle:g} degrees at "
                f"vertex {index + 1}; every angle must be between 0.025 and 179.9 degrees."
            )
    for first in range(4):
        for second in range(first + 1, 4):
            for third in range(second + 1, 4):
                triple_area = _length(
                    _cross(
                        _subtract(points[second], points[first]),
                        _subtract(points[third], points[first]),
                    )
                )
                if triple_area <= area_tolerance:
                    raise ValueError(
                        f"LDraw quad at {source[0]}:{source[1]}:{line_number} contains "
                        "three collinear or repeated vertices."
                    )
    normal = _cross(_subtract(points[1], points[0]), _subtract(points[2], points[0]))
    dropped_axis = max(range(3), key=lambda axis: abs(normal[axis]))
    projected = [
        tuple(point[axis] for axis in range(3) if axis != dropped_axis) for point in points
    ]
    turns = []
    for index in range(4):
        current = projected[index]
        following = projected[(index + 1) % 4]
        after = projected[(index + 2) % 4]
        turn = (following[0] - current[0]) * (after[1] - following[1]) - (
            following[1] - current[1]
        ) * (after[0] - following[0])
        if abs(turn) <= area_tolerance:
            raise ValueError(
                f"LDraw quad at {source[0]}:{source[1]}:{line_number} has a collinear turn."
            )
        turns.append(turn)
    if any(turn > 0 for turn in turns) and any(turn < 0 for turn in turns):
        raise ValueError(
            f"LDraw quad at {source[0]}:{source[1]}:{line_number} is concave or "
            "self-intersecting; source order cannot be triangulated as a certified quad."
        )
    diagonal_splits = (
        ((0, 1, 2), (0, 2, 3)),
        ((1, 2, 3), (1, 3, 0)),
    )
    split_angles = []
    for first_triangle, second_triangle in diagonal_splits:
        first_normal = _cross(
            _subtract(points[first_triangle[1]], points[first_triangle[0]]),
            _subtract(points[first_triangle[2]], points[first_triangle[0]]),
        )
        second_normal = _cross(
            _subtract(points[second_triangle[1]], points[second_triangle[0]]),
            _subtract(points[second_triangle[2]], points[second_triangle[0]]),
        )
        split_angles.append(_angle_degrees(first_normal, second_normal))
    worst_split_angle = max(split_angles)
    if worst_split_angle > 3.0 + 1e-9:
        raise ValueError(
            f"LDraw quad at {source[0]}:{source[1]}:{line_number} is non-planar: its "
            f"worst diagonal split differs by {worst_split_angle:g} degrees; both split "
            "normal angles must be at most 3 degrees, or the source must use triangles."
        )


def expand_surface(
    library: SourceLibrary,
    root: SourceKey,
    role_for_ancestry: Callable[[tuple[SourceKey, ...]], str],
    on_source: Callable[[SourceKey], None] | None = None,
) -> list[ExpandedTriangle]:
    budget = _ExpansionBudget()
    result: list[ExpandedTriangle] = []
    source_visited = on_source or (lambda _: None)

    def visit(
        source: SourceKey,
        transform: AffineTransform,
        ancestry: tuple[SourceKey, ...],
        inverted: bool,
        inherited_cull: bool,
        stack: tuple[SourceKey, ...],
    ) -> None:
        if source in stack:
            chain = " -> ".join(f"{archive}:{path}" for archive, path in (*stack, source))
            raise ValueError(f"Recursive LDraw surface reference: {chain}")
        if len(stack) >= MAX_RECURSION_DEPTH:
            raise ValueError(
                f"LDraw surface recursion exceeds {MAX_RECURSION_DEPTH} at {source[0]}:{source[1]}"
            )
        source_visited(source)

        certified: bool | None = None
        certification_declared = False
        bfc_seen = False
        operational_seen = False
        winding = "CCW"
        local_cull = True
        invert_next = False
        next_ancestry = (*ancestry, source)

        for line_number, raw_line in enumerate(library.text(source).splitlines(), 1):
            stripped = raw_line.strip()
            if not stripped:
                continue
            fields = stripped.split()
            record_type = fields[0]

            if record_type == "0" and len(fields) >= 2 and fields[1] == "BFC":
                if invert_next:
                    raise ValueError(
                        f"BFC INVERTNEXT at {source[0]}:{source[1]} must be immediately followed "
                        f"by a type-1 reference; found another BFC statement on line {line_number}."
                    )
                options = _bfc_options(fields, source, line_number)
                if "CERTIFY" in options or "NOCERTIFY" in options:
                    if bfc_seen or operational_seen or certification_declared:
                        raise ValueError(
                            f"BFC certification at {source[0]}:{source[1]}:{line_number} must be "
                            "the only certification statement and precede every other BFC or "
                            "operational record."
                        )
                    certification_declared = True
                    certified = "NOCERTIFY" not in options
                elif certified is False:
                    continue
                elif certified is None and not operational_seen:
                    certified = True
                if "CW" in options:
                    winding = "CW"
                elif "CCW" in options:
                    winding = "CCW"
                if "CLIP" in options:
                    local_cull = True
                elif "NOCLIP" in options:
                    local_cull = False
                invert_next = "INVERTNEXT" in options
                bfc_seen = True
                continue

            if record_type == "0":
                if invert_next:
                    raise ValueError(
                        f"BFC INVERTNEXT at {source[0]}:{source[1]} must be immediately followed "
                        f"by a type-1 reference; found a comment or meta statement on line {line_number}."
                    )
                continue

            if record_type not in {"1", "2", "3", "4", "5"}:
                raise ValueError(
                    f"Unknown LDraw record type {record_type!r} at "
                    f"{source[0]}:{source[1]}:{line_number}."
                )
            operational_seen = True
            if certified is None:
                certified = False
            if invert_next and record_type != "1":
                raise ValueError(
                    f"BFC INVERTNEXT at {source[0]}:{source[1]} must be immediately followed by "
                    f"a type-1 reference; found type {record_type} on line {line_number}."
                )

            if record_type == "1":
                reference_fields = stripped.split(maxsplit=14)
                if len(reference_fields) < 15:
                    raise ValueError(
                        f"Malformed LDraw type-1 record at {source[0]}:{source[1]}:{line_number}; "
                        "expected color, translation, 3x3 matrix, and a source reference."
                    )
                _validate_colour(reference_fields[1], source, line_number)
                values = _numbers(reference_fields[2:14], source, line_number)
                child_transform = AffineTransform(
                    matrix=tuple(values[3:12]),  # type: ignore[arg-type]
                    translation=tuple(values[0:3]),  # type: ignore[arg-type]
                )
                child = library.resolve(reference_fields[14], source[0])
                budget.references += 1
                if budget.references > MAX_EXPANDED_REFERENCES:
                    raise ValueError(
                        f"Expanded LDraw surface exceeds {MAX_EXPANDED_REFERENCES} references at "
                        f"{source[0]}:{source[1]}:{line_number}."
                    )
                composed_transform = compose(transform, child_transform)
                visit(
                    child,
                    composed_transform,
                    next_ancestry,
                    inverted ^ invert_next,
                    inherited_cull
                    and local_cull
                    and certified
                    and determinant(composed_transform.matrix) != 0,
                    (*stack, source),
                )
                invert_next = False
                continue

            invert_next = False
            if record_type in {"2", "5"}:
                expected_length = 8 if record_type == "2" else 14
                if len(fields) != expected_length:
                    raise ValueError(
                        f"Malformed LDraw type-{record_type} record at "
                        f"{source[0]}:{source[1]}:{line_number}; expected {expected_length} fields, "
                        f"found {len(fields)}."
                    )
                _numbers(fields[2:], source, line_number)
                _validate_colour(fields[1], source, line_number)
                continue

            expected_length = 11 if record_type == "3" else 14
            if len(fields) != expected_length:
                raise ValueError(
                    f"Malformed LDraw type-{record_type} record at "
                    f"{source[0]}:{source[1]}:{line_number}; expected {expected_length} fields, "
                    f"found {len(fields)}."
                )
            values = _numbers(fields[2:], source, line_number)
            _validate_colour(fields[1], source, line_number)
            points = [
                transform_point(transform, tuple(values[index : index + 3]))  # type: ignore[arg-type]
                for index in range(0, len(values), 3)
            ]
            if record_type == "4":
                _validate_quad(points, source, line_number)
            triangles = (
                [(points[0], points[1], points[2])]
                if record_type == "3"
                else [
                    (points[0], points[1], points[2]),
                    (points[0], points[2], points[3]),
                ]
            )
            reverse = certified and (
                (winding == "CW") ^ inverted ^ (determinant(transform.matrix) < 0)
            )
            for triangle in triangles:
                first, second, third = triangle
                ab = tuple(second[axis] - first[axis] for axis in range(3))
                ac = tuple(third[axis] - first[axis] for axis in range(3))
                cross = (
                    ab[1] * ac[2] - ab[2] * ac[1],
                    ab[2] * ac[0] - ab[0] * ac[2],
                    ab[0] * ac[1] - ab[1] * ac[0],
                )
                if cross == (0.0, 0.0, 0.0):
                    raise ValueError(
                        f"Expanded LDraw triangle at {source[0]}:{source[1]}:{line_number} "
                        "is degenerate after its complete type-1 transform."
                    )
                if reverse:
                    triangle = (triangle[0], triangle[2], triangle[1])
                budget.triangles += 1
                if budget.triangles > MAX_EXPANDED_TRIANGLES:
                    raise ValueError(
                        f"Expanded LDraw surface exceeds {MAX_EXPANDED_TRIANGLES} triangles at "
                        f"{source[0]}:{source[1]}:{line_number}."
                    )
                result.append(
                    ExpandedTriangle(
                        points=triangle,
                        role=role_for_ancestry(next_ancestry),
                        ancestry=next_ancestry,
                        source=source,
                        line_number=line_number,
                        certified=certified,
                        cull_enabled=inherited_cull and local_cull and certified,
                    )
                )

        if invert_next:
            raise ValueError(
                f"BFC INVERTNEXT at {source[0]}:{source[1]} reaches end of file without a "
                "type-1 reference."
            )

    visit(root, IDENTITY, (), False, True, ())
    return result


def ancestry_role_classifier(
    stud_sources: frozenset[SourceIdentity],
    digest_for_source: Callable[[SourceKey], str],
) -> Callable[[tuple[SourceKey, ...]], str]:
    normalized = frozenset(
        (archive_id, path.lower(), digest.lower())
        for archive_id, path, digest in stud_sources
    )

    def classify(ancestry: tuple[SourceKey, ...]) -> str:
        return (
            "stud"
            if any(
                (archive_id, path.lower(), digest_for_source((archive_id, path)).lower())
                in normalized
                for archive_id, path in ancestry
            )
            else "body"
        )

    return classify
