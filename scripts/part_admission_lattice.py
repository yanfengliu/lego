"""Layer 2: does a candidate sit on the integer construction lattice at all.

part-model.md line 51 makes this decisive rather than cosmetic — anything placed
off-lattice is excluded from lattice reasoning and falls through to layer 4
geometry — so the measurement reports which of pitch, phase and plate height
fails, not just a verdict.
"""

from __future__ import annotations

import math
from typing import Sequence

from part_admission_contract import Candidate

STUD_PITCH_LDU = 20.0
STUD_LATTICE_PHASE_LDU = 10.0
PLATE_HEIGHT_LDU = 8.0
LATTICE_TOLERANCE_LDU = 1e-6


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


def measure_lattice(candidate: Candidate) -> dict[str, object]:
    rows = [
        {
            "kind": connector.kind,
            "positionLdu": [round(value, 9) for value in connector.position],
        }
        for connector in candidate.connectors
    ]
    pitch: dict[str, object] | None = None
    if candidate.connectors:
        phase_x, deviation_x, on_grid_x = _phase([row.position[0] for row in candidate.connectors])
        phase_z, deviation_z, on_grid_z = _phase([row.position[2] for row in candidate.connectors])
        integer_phase = max(abs(phase_x - round(phase_x)), abs(phase_z - round(phase_z)))
        stud_phase = max(
            min(abs(phase - target) for target in (0.0, STUD_LATTICE_PHASE_LDU, STUD_PITCH_LDU))
            for phase in (phase_x, phase_z)
        )
        pitch = {
            "commonPhaseLdu": {"x": round(phase_x, 9), "z": round(phase_z, 9)},
            "maximumPitchDeviationLdu": round(max(deviation_x, deviation_z), 9),
            "connectorsOnCommonGrid": min(on_grid_x, on_grid_z),
            "phaseIsIntegerLdu": integer_phase <= LATTICE_TOLERANCE_LDU,
            "phaseMatchesStudCentreLattice": stud_phase <= LATTICE_TOLERANCE_LDU,
        }
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
    alignable = (
        (pitch is None or bool(pitch["phaseIsIntegerLdu"]))
        and (pitch is None or float(pitch["maximumPitchDeviationLdu"]) <= LATTICE_TOLERANCE_LDU)  # type: ignore[arg-type]
        and height_residual <= LATTICE_TOLERANCE_LDU
    )
    return {
        "connectorCount": len(rows),
        "connectorPitch": pitch,
        "solid": {
            "heightLdu": height,
            "heightInPlates": height / PLATE_HEIGHT_LDU,
            "plateHeightResidualLdu": height_residual,
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
        parts.append(1.0 if pitch["phaseIsIntegerLdu"] else 0.0)
    solid = lattice["solid"]
    if isinstance(solid, dict):
        parts.append(
            1.0 if float(solid["plateHeightResidualLdu"]) <= LATTICE_TOLERANCE_LDU else 0.0
        )
    return sum(parts) / len(parts) if parts else 0.0
