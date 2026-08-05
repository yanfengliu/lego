"""The independent witnesses that settle a frame the lattice cannot settle alone.

Two different jobs, both measured against geometry rather than assertion.

**Self-symmetry.** A part whose matched features are symmetric admits several
exact frames. They are only a real ambiguity if they differ by something other
than a symmetry the part already has, so the exact self-symmetries of the
measured LDraw vertex set are computed and the frames are quotiented by them.

**Mesh registration.** Where a genuine ambiguity survives, or where a part has no
lattice anchor at all, Builder's own shell vertices are carried into LDraw
part-local coordinates by each candidate frame and the distance from every vertex
to the LDraw surface is measured. The winning frame is the one whose mesh agrees;
the margin to the runner-up is reported so the choice can be judged rather than
trusted. This is a fit, and everything derived from it is labelled as a fit.

The shell is not a substitute for either source: it carries no studs, and it
disagrees with LDraw by up to a few tenths of an LDU where the two sources
tessellate a curve differently. It is used only to choose between a small,
already-enumerated set of frames.
"""

from __future__ import annotations

import math
import struct
from fractions import Fraction
from typing import Sequence

from builder_ldraw_field import BUILDER_UNIT_LDU, Rational3
from builder_ldraw_frame import TURNS, BuilderLdrawFrame, apply_symmetry
from part_admission_contract import Triangle, Vector3
from part_admission_surface import MeasuredSurface

REGISTRATION_TRANSLATION_STEP_LDU = 10
REGISTRATION_TRANSLATION_REACH_LDU = 80
REGISTRATION_BOX_SLACK_LDU = 10.0
FLOAT32_SOURCE_TOLERANCE_LDU = 1e-4
MAX_SYMMETRY_VERTICES = 20_000


def native_shell_vertices(binary: bytes, record: dict[str, object]) -> list[Vector3]:
    """The record's shell vertices, already in the pack's declared catalog-LDU frame."""

    offset = int(record["positionByteOffset"])  # type: ignore[arg-type]
    count = int(record["positionCount"])  # type: ignore[arg-type]
    return [struct.unpack_from("<fff", binary, offset + index * 12) for index in range(count)]


def ldraw_self_symmetries(surface: MeasuredSurface) -> list[tuple[str, Rational3]]:
    """Every axis turn plus integer translation that maps the vertex set onto itself."""

    points = {
        (
            Fraction(point[0]).limit_denominator(10**8),
            Fraction(point[1]).limit_denominator(10**8),
            Fraction(point[2]).limit_denominator(10**8),
        )
        for triangle in surface.triangles
        for point in triangle
    }
    if len(points) > MAX_SYMMETRY_VERTICES:
        raise ValueError(
            f"Surface {surface.design_id} has {len(points)} distinct vertices, above the "
            f"{MAX_SYMMETRY_VERTICES} bound for an exact symmetry search."
        )
    ordered = sorted(points)
    zero = Fraction(0)
    found: list[tuple[str, Rational3]] = []
    for turn in TURNS:
        base = apply_symmetry(turn, (zero, zero, zero), ordered[0])
        for target in ordered:
            translation = (target[0] - base[0], zero, target[2] - base[2])
            if translation[0].denominator != 1 or translation[2].denominator != 1:
                continue
            mapped = {apply_symmetry(turn, translation, point) for point in ordered}
            if mapped == points:
                found.append((turn, translation))
                break
    return found


def _point_triangle_distance(point: Vector3, triangle: Triangle) -> float:
    a, b, c = triangle
    ab = [b[i] - a[i] for i in range(3)]
    ac = [c[i] - a[i] for i in range(3)]
    ap = [point[i] - a[i] for i in range(3)]
    d1 = sum(ab[i] * ap[i] for i in range(3))
    d2 = sum(ac[i] * ap[i] for i in range(3))
    if d1 <= 0 and d2 <= 0:
        return math.dist(point, a)
    bp = [point[i] - b[i] for i in range(3)]
    d3 = sum(ab[i] * bp[i] for i in range(3))
    d4 = sum(ac[i] * bp[i] for i in range(3))
    if d3 >= 0 and d4 <= d3:
        return math.dist(point, b)
    vc = d1 * d4 - d3 * d2
    if vc <= 0 and d1 >= 0 and d3 <= 0:
        ratio = d1 / (d1 - d3)
        return math.dist(point, [a[i] + ab[i] * ratio for i in range(3)])
    cp = [point[i] - c[i] for i in range(3)]
    d5 = sum(ab[i] * cp[i] for i in range(3))
    d6 = sum(ac[i] * cp[i] for i in range(3))
    if d6 >= 0 and d5 <= d6:
        return math.dist(point, c)
    vb = d5 * d2 - d1 * d6
    if vb <= 0 and d2 >= 0 and d6 <= 0:
        ratio = d2 / (d2 - d6)
        return math.dist(point, [a[i] + ac[i] * ratio for i in range(3)])
    va = d3 * d6 - d5 * d4
    if va <= 0 and (d4 - d3) >= 0 and (d5 - d6) >= 0:
        ratio = (d4 - d3) / ((d4 - d3) + (d5 - d6))
        return math.dist(point, [b[i] + (c[i] - b[i]) * ratio for i in range(3)])
    denominator = 1.0 / (va + vb + vc)
    v, w = vb * denominator, vc * denominator
    return math.dist(point, [a[i] + ab[i] * v + ac[i] * w for i in range(3)])


def mesh_disagreement(
    frame: BuilderLdrawFrame, vertices: Sequence[Vector3], surface: MeasuredSurface
) -> dict[str, object]:
    """How far Builder's shell lands from the LDraw surface under one frame."""

    triangles = surface.triangles
    scale = 1.0 / BUILDER_UNIT_LDU
    linear = frame.linear
    translation = [float(value) for value in frame.translation]
    worst = 0.0
    total = 0.0
    for vertex in vertices:
        builder = (vertex[0] * scale, vertex[1] * scale, vertex[2] * scale)
        # The pack binary is already in diag(25, -25, -25) of Builder units, so
        # dividing by 25 recovers a signed Builder-unit point that the frame's
        # own matrix then carries the rest of the way.
        moved = tuple(
            linear[axis * 3 + 0] * builder[0]
            + linear[axis * 3 + 1] * -builder[1]
            + linear[axis * 3 + 2] * -builder[2]
            + translation[axis]
            for axis in range(3)
        )
        distance = min(_point_triangle_distance(moved, triangle) for triangle in triangles)
        worst = max(worst, distance)
        total += distance
    return {
        "verticesChecked": len(vertices),
        "meanDistanceLdu": round(total / len(vertices), 6),
        "maximumDistanceLdu": round(worst, 6),
    }


def _vertical_translation(
    vertices: Sequence[Vector3], ldraw_low: float, ldraw_high: float
) -> tuple[Fraction, float]:
    """The exact vertical offset, because every turn leaves the Y row alone.

    The Y row of every candidate matrix is (0, -25, 0), so a shell vertex's
    packed Y already is its mapped Y. Matching the two Y extents therefore gives
    the offset twice; they must agree, or the two sources do not describe a part
    of the same height and no single offset is right.
    """

    low = min(vertex[1] for vertex in vertices)
    high = max(vertex[1] for vertex in vertices)
    from_low = ldraw_low - low
    from_high = ldraw_high - high
    drift = abs(from_low - from_high)
    if drift > FLOAT32_SOURCE_TOLERANCE_LDU:
        raise ValueError(
            f"Matching the Y extents gives {from_low} from the low end and {from_high} from the "
            f"high end, a disagreement of {drift} LDU. The shell and the LDraw closure do not agree "
            "on the part's height, so the vertical offset cannot be read off the bounds."
        )
    rounded = round((from_low + from_high) / 2)
    if abs((from_low + from_high) / 2 - rounded) > FLOAT32_SOURCE_TOLERANCE_LDU:
        raise ValueError(
            f"The vertical offset measures {(from_low + from_high) / 2} LDU, which is not an "
            "integer LDU within the Float32 source tolerance."
        )
    return Fraction(rounded), drift


def _boxes_agree(
    frame: BuilderLdrawFrame,
    vertices: Sequence[Vector3],
    ldraw_low: Sequence[float],
    ldraw_high: Sequence[float],
) -> bool:
    scale = 1.0 / BUILDER_UNIT_LDU
    linear = frame.linear
    translation = [float(value) for value in frame.translation]
    low = [math.inf, math.inf, math.inf]
    high = [-math.inf, -math.inf, -math.inf]
    for vertex in vertices:
        builder = (vertex[0] * scale, -vertex[1] * scale, -vertex[2] * scale)
        for axis in range(3):
            value = (
                linear[axis * 3 + 0] * builder[0]
                + linear[axis * 3 + 1] * builder[1]
                + linear[axis * 3 + 2] * builder[2]
                + translation[axis]
            )
            low[axis] = min(low[axis], value)
            high[axis] = max(high[axis], value)
    return all(
        abs(low[axis] - ldraw_low[axis]) <= REGISTRATION_BOX_SLACK_LDU
        and abs(high[axis] - ldraw_high[axis]) <= REGISTRATION_BOX_SLACK_LDU
        for axis in range(3)
    )


def registered_frame(
    design_id: str,
    revision: str,
    record_sha256: str,
    vertices: Sequence[Vector3],
    surface: MeasuredSurface,
) -> tuple[BuilderLdrawFrame, dict[str, object]]:
    """A frame chosen by search, for a part with no lattice anchor at all.

    This is the weak case and it is named as such. The search is bounded and
    discrete — the eight axis maps and the 10 LDU half-stud translation lattice —
    so what comes out is still an exact integer frame; what is fitted is which one.
    """

    points = [point for triangle in surface.triangles for point in triangle]
    ldraw_low = [min(point[axis] for point in points) for axis in range(3)]
    ldraw_high = [max(point[axis] for point in points) for axis in range(3)]
    vertical, vertical_drift = _vertical_translation(vertices, ldraw_low[1], ldraw_high[1])
    step = REGISTRATION_TRANSLATION_STEP_LDU
    reach = REGISTRATION_TRANSLATION_REACH_LDU
    rows: list[tuple[float, float, BuilderLdrawFrame]] = []
    considered = 0
    for turn in TURNS:
        for x in range(-reach, reach + 1, step):
            for z in range(-reach, reach + 1, step):
                frame = BuilderLdrawFrame(
                    design_id=design_id,
                    revision=revision,
                    record_sha256=record_sha256,
                    turn=turn,
                    translation=(Fraction(x), vertical, Fraction(z)),
                    derivation="registered-discrete-search",
                )
                considered += 1
                if not _boxes_agree(frame, vertices, ldraw_low, ldraw_high):
                    continue
                measured = mesh_disagreement(frame, vertices, surface)
                rows.append(
                    (
                        float(measured["meanDistanceLdu"]),  # type: ignore[arg-type]
                        float(measured["maximumDistanceLdu"]),  # type: ignore[arg-type]
                        frame,
                    )
                )
    if len(rows) < 2:
        raise ValueError(
            f"The bounded search for {design_id} left {len(rows)} frames whose bounding box lands "
            f"within {REGISTRATION_BOX_SLACK_LDU} LDU of the source; a registration with nothing to "
            "compare against is not a choice."
        )
    rows.sort(key=lambda row: (row[0], row[1], row[2].turn, row[2].translation))
    best, runner_up = rows[0], rows[1]
    witness = {
        "method": "registered-discrete-search",
        "reason": (
            f"{design_id} expands to no visible stud primitive and no underside tube primitive, so "
            "there is no measured LDraw feature for the authored lattice to correspond with. This "
            "frame is fitted, not derived, and is weaker evidence than an exact one."
        ),
        "searchSpace": {
            "axisMaps": len(TURNS),
            "translationStepLdu": step,
            "translationReachLdu": reach,
            "framesEnumerated": considered,
            "framesScored": len(rows),
            "boundingBoxSlackLdu": REGISTRATION_BOX_SLACK_LDU,
        },
        "verticalTranslation": {
            "valueLdu": str(vertical),
            "source": "both Y extents of the two sources agree, so this component is not fitted",
            "endpointDisagreementLdu": vertical_drift,
        },
        "residualLdu": {"mean": best[0], "maximum": best[1]},
        "runnerUp": {
            "turn": runner_up[2].turn,
            "translationLdu": [str(value) for value in runner_up[2].translation],
            "meanDistanceLdu": runner_up[0],
        },
        "selectionMarginRatio": runner_up[0] / best[0] if best[0] > 0 else None,
    }
    mirrors = [row for row in rows if row[2].determinant_sign == -1]
    if mirrors:
        # 5092 is the one pilot part with no self-symmetry at all, so it is also
        # the only one where a mirrored frame is a different part rather than the
        # same part described twice. Recording how badly the best mirror scores is
        # what makes "Builder and LDraw are both right-handed" a measurement here.
        witness["bestMirroredFrame"] = {
            "turn": mirrors[0][2].turn,
            "translationLdu": [str(value) for value in mirrors[0][2].translation],
            "meanDistanceLdu": mirrors[0][0],
            "marginRatioAgainstChosenFrame": mirrors[0][0] / best[0] if best[0] > 0 else None,
        }
    return best[2], witness
