"""Layer 2: does a candidate sit on the integer construction lattice at all.

part-model.md line 51 makes this decisive rather than cosmetic — anything placed
off-lattice is excluded from lattice reasoning and falls through to layer 4
geometry — so the measurement reports which of pitch, phase and plate height
fails, not just a verdict.
"""

from __future__ import annotations

import math
from collections import defaultdict
from typing import Sequence

from part_admission_contract import Candidate, Connector

STUD_PITCH_LDU = 20.0
STUD_LATTICE_PHASE_LDU = 10.0
PLATE_HEIGHT_LDU = 8.0
LATTICE_TOLERANCE_LDU = 1e-6
AXIS_NAMES = ("x", "y", "z")


def lattice_cell_centers(low: float, high: float) -> list[float]:
    """Stud-cell centres covering one axis, on whichever 20-pitch phase fits best.

    A part's local frame is not the world lattice: 30357's studs sit at multiples
    of 20 and 51739's at 20n+10, because an odd footprint centres a stud on the
    origin and an even one centres the gap. Both are placeable, because a
    placement translation is any integer LDU.
    """

    chosen: list[float] = []
    best: tuple[int, float, float] | None = None
    for phase in (0.0, STUD_LATTICE_PHASE_LDU):
        first = math.ceil((low - 10.0 - phase) / STUD_PITCH_LDU)
        last = math.floor((high + 10.0 - phase) / STUD_PITCH_LDU)
        centers = [
            phase + STUD_PITCH_LDU * index
            for index in range(first, last + 1)
            if phase + STUD_PITCH_LDU * index + 10 > low
            and phase + STUD_PITCH_LDU * index - 10 < high
        ]
        if not centers:
            continue
        slack = STUD_PITCH_LDU * len(centers) - (high - low)
        key = (len(centers), abs(slack), phase)
        if best is None or key < best:
            best, chosen = key, centers
    return chosen


def _phase(values: Sequence[float]) -> tuple[float, float, int]:
    residues = [value % STUD_PITCH_LDU for value in values]
    reference = residues[0]
    deviations = [
        min(abs(residue - reference), STUD_PITCH_LDU - abs(residue - reference))
        for residue in residues
    ]
    return (
        reference,
        max(deviations),
        sum(1 for deviation in deviations if deviation <= LATTICE_TOLERANCE_LDU),
    )


def _axis_normal(normal: Sequence[float]) -> tuple[int, int] | None:
    normal_axis = [
        index
        for index, value in enumerate(normal)
        if abs(abs(value) - 1.0) <= LATTICE_TOLERANCE_LDU
    ]
    if len(normal_axis) != 1:
        return None
    axis = normal_axis[0]
    if any(
        abs(value) > LATTICE_TOLERANCE_LDU
        for index, value in enumerate(normal)
        if index != axis
    ):
        return None
    return axis, -1 if normal[axis] < 0 else 1


def _connector_pitch(candidate: Candidate) -> dict[str, object] | None:
    if not candidate.connectors:
        return None
    grouped: dict[tuple[int, int] | None, list[Connector]] = defaultdict(list)
    for connector in candidate.connectors:
        grouped[_axis_normal(connector.normal)].append(connector)
    groups: list[dict[str, object]] = []
    total_on_grid = 0
    maximum_deviation = 0.0
    all_integer = True
    all_stud_phase = True
    all_axis_aligned = None not in grouped
    for normal_key, connectors in sorted(
        grouped.items(), key=lambda row: (row[0] is None, row[0] or (3, 0))
    ):
        if normal_key is None:
            groups.append(
                {
                    "normal": None,
                    "normalIsAxisAligned": False,
                    "connectorCount": len(connectors),
                    "tangentAxes": [],
                    "commonPhaseLdu": {},
                    "maximumPitchDeviationLdu": None,
                    "connectorsOnCommonGrid": 0,
                    "phaseIsIntegerLdu": False,
                    "phaseMatchesStudCentreLattice": False,
                }
            )
            all_integer = False
            all_stud_phase = False
            continue
        normal_axis, sign = normal_key
        tangent_axes = [axis for axis in range(3) if axis != normal_axis]
        phases: dict[str, float] = {}
        deviations: list[float] = []
        on_grid: list[int] = []
        integer_deviations: list[float] = []
        stud_deviations: list[float] = []
        for axis in tangent_axes:
            phase, deviation, aligned = _phase(
                [connector.position[axis] for connector in connectors]
            )
            phases[AXIS_NAMES[axis]] = round(phase, 9)
            deviations.append(deviation)
            on_grid.append(aligned)
            integer_deviations.append(abs(phase - round(phase)))
            stud_deviations.append(
                min(
                    abs(phase - target)
                    for target in (0.0, STUD_LATTICE_PHASE_LDU, STUD_PITCH_LDU)
                )
            )
        group_deviation = max(deviations)
        group_on_grid = min(on_grid)
        group_integer = max(integer_deviations) <= LATTICE_TOLERANCE_LDU
        group_stud_phase = max(stud_deviations) <= LATTICE_TOLERANCE_LDU
        total_on_grid += group_on_grid
        maximum_deviation = max(maximum_deviation, group_deviation)
        all_integer = all_integer and group_integer
        all_stud_phase = all_stud_phase and group_stud_phase
        normal = [0, 0, 0]
        normal[normal_axis] = sign
        groups.append(
            {
                "normal": normal,
                "normalIsAxisAligned": True,
                "connectorCount": len(connectors),
                "tangentAxes": [AXIS_NAMES[axis] for axis in tangent_axes],
                "commonPhaseLdu": phases,
                "maximumPitchDeviationLdu": round(group_deviation, 9),
                "connectorsOnCommonGrid": group_on_grid,
                "phaseIsIntegerLdu": group_integer,
                "phaseMatchesStudCentreLattice": group_stud_phase,
            }
        )
    return {
        "state": "grouped-by-outward-normal",
        "groups": groups,
        "maximumPitchDeviationLdu": round(maximum_deviation, 9),
        "connectorsOnCommonGrid": total_on_grid,
        "phaseIsIntegerLdu": all_integer,
        "phaseMatchesStudCentreLattice": all_stud_phase,
        "normalsAreAxisAligned": all_axis_aligned,
    }


def measure_lattice(candidate: Candidate) -> dict[str, object]:
    rows = [
        {
            "kind": connector.kind,
            "positionLdu": [round(value, 9) for value in connector.position],
        }
        for connector in candidate.connectors
    ]
    pitch = _connector_pitch(candidate)
    solid = [body for body in candidate.bodies if body.tag == "body"] or list(candidate.bodies)
    height = max(body.maximum[1] for body in solid) - min(body.minimum[1] for body in solid)
    height_residual = min(
        height % PLATE_HEIGHT_LDU, PLATE_HEIGHT_LDU - (height % PLATE_HEIGHT_LDU)
    )
    plan = (
        min(body.minimum[0] for body in solid),
        max(body.maximum[0] for body in solid),
        min(body.minimum[2] for body in solid),
        max(body.maximum[2] for body in solid),
    )
    cells: list[int] = []
    slack: list[float] = []
    for low, high in ((plan[0], plan[1]), (plan[2], plan[3])):
        centers = lattice_cell_centers(low, high)
        cells.append(len(centers))
        slack.append(STUD_PITCH_LDU * len(centers) - (high - low))
    directional_envelope = any(
        (normal_axis := _axis_normal(connector.normal)) is not None and normal_axis[0] != 1
        for connector in candidate.connectors
    )
    plate_height_applies = not directional_envelope
    pitch_alignable = (
        (pitch is None or bool(pitch["phaseIsIntegerLdu"]))
        and (pitch is None or float(pitch["maximumPitchDeviationLdu"]) <= LATTICE_TOLERANCE_LDU)  # type: ignore[arg-type]
        and (pitch is None or bool(pitch["normalsAreAxisAligned"]))
    )
    alignable = pitch_alignable and (
        not plate_height_applies or height_residual <= LATTICE_TOLERANCE_LDU
    )
    return {
        "connectorCount": len(rows),
        "connectorPitch": pitch,
        "solid": {
            "heightLdu": height,
            "heightInPlates": height / PLATE_HEIGHT_LDU,
            "plateHeightResidualLdu": height_residual,
            "plateHeightCriterion": (
                "applicable-vertical-or-connectorless-envelope"
                if plate_height_applies
                else "not-applicable-directional-connector-envelope"
            ),
            "plateHeightConforms": (
                height_residual <= LATTICE_TOLERANCE_LDU if plate_height_applies else None
            ),
            "planExtentsLdu": [plan[1] - plan[0], plan[3] - plan[2]],
            "footprintCells": cells,
            "footprintSlackLdu": slack,
        },
        "latticeAlignable": alignable,
        "latticeToleranceLdu": LATTICE_TOLERANCE_LDU,
        "consequenceIfNotAlignable": (
            "part-model.md layer 2: anything off-lattice is excluded from lattice reasoning and "
            "falls through to layer 4 geometry"
        ),
        "connectors": rows,
    }


def lattice_score(lattice: dict[str, object]) -> float:
    parts: list[float] = []
    pitch = lattice["connectorPitch"]
    if isinstance(pitch, dict):
        total = int(lattice["connectorCount"])  # type: ignore[arg-type]
        parts.append(float(pitch["connectorsOnCommonGrid"]) / total if total else 1.0)
        parts.append(
            1.0 if pitch["phaseIsIntegerLdu"] and pitch["normalsAreAxisAligned"] else 0.0
        )
    solid = lattice["solid"]
    if isinstance(solid, dict) and solid["plateHeightConforms"] is not None:
        parts.append(1.0 if solid["plateHeightConforms"] else 0.0)
    return sum(parts) / len(parts) if parts else 0.0
