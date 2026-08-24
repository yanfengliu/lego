"""Score one candidate catalog part against its measured LDraw source truth.

This scores candidates. It never admits one: no `PartDefinition` is emitted, no
frame is claimed, and the authority state stays measurement-only, exactly like
the eight-part 6651557 source pilot it reads its surfaces from.

The five axes are collision containment, connector coverage, lattice
conformance, conservatism direction, and body budget. Conservatism is not a low
score but a hard fail: docs/design/part-model.md line 113 allows an
approximation to refuse a placement a real part would allow and never to allow
one it would not, which is the measurement that rejected the Builder collision
path outright.
"""

from __future__ import annotations

import math
from typing import Sequence

from part_admission_contract import (
    Body,
    CONTAINMENT_EPSILON_LDU,
    Candidate,
    MAX_SURFACE_SAMPLES,
    Vector3,
)
from part_admission_clutch import clutch_hard_fails, measure_clutch_room
from part_admission_geometry import (
    PlanIndex,
    body_plan_polygon,
    body_volume,
    open_boundary,
    polygon_area,
    projection_volumes,
    sample_triangle,
)
from part_admission_lattice import STUD_PITCH_LDU, measure_lattice, lattice_score
from part_admission_surface import MeasuredConnector, MeasuredSurface, measured_connectors

CONNECTOR_MATCH_TOLERANCE_LDU = 1.0
DEFAULT_SAMPLE_SPACING_LDU = 0.25
MAX_RECORDED_ESCAPES = 8
CATALOG_MAX_PLAN_VERTICES = 8


def measure_containment(
    candidate: Candidate, surface: MeasuredSurface, spacing_ldu: float
) -> dict[str, object]:
    """Sample every triangle of the real surface and test it against the union."""

    index = PlanIndex.build(candidate.bodies)
    sampled = 0
    outside = 0
    per_role_sampled: dict[str, int] = {}
    per_role_outside: dict[str, int] = {}
    escapes: list[dict[str, object]] = []
    worst = 0.0
    for triangle, role in zip(surface.triangles, surface.roles):
        for point in sample_triangle(triangle, spacing_ldu):
            sampled += 1
            per_role_sampled[role] = per_role_sampled.get(role, 0) + 1
            if sampled > MAX_SURFACE_SAMPLES:
                raise ValueError(
                    f"Surface sampling of {surface.design_id} exceeded {MAX_SURFACE_SAMPLES} points "
                    f"at spacing {spacing_ldu} LDU; raise the spacing or the bound deliberately."
                )
            if index.contains_point(point, CONTAINMENT_EPSILON_LDU):
                continue
            outside += 1
            per_role_outside[role] = per_role_outside.get(role, 0) + 1
            distance = index.escape_distance(point)
            if distance > worst:
                worst = distance
            if len(escapes) < MAX_RECORDED_ESCAPES:
                escapes.append(
                    {
                        "pointLdu": [round(value, 6) for value in point],
                        "role": role,
                        "escapeLowerBoundLdu": round(distance, 9),
                    }
                )
    return {
        "sampleSpacingLdu": spacing_ldu,
        "containmentEpsilonLdu": CONTAINMENT_EPSILON_LDU,
        "pointsSampled": sampled,
        "pointsOutside": outside,
        "pointsSampledByRole": dict(sorted(per_role_sampled.items())),
        "pointsOutsideByRole": dict(sorted(per_role_outside.items())),
        "maximumEscapeLowerBoundLdu": round(worst, 9),
        "worstEscapes": escapes,
    }


def _bodies_overlap(left: Body, right: Body) -> float:
    for axis in range(3):
        if left.minimum[axis] >= right.maximum[axis] or right.minimum[axis] >= left.maximum[axis]:
            return 0.0
    overlap = math.prod(
        min(left.maximum[axis], right.maximum[axis]) - max(left.minimum[axis], right.minimum[axis])
        for axis in range(3)
    )
    return overlap


def measure_union_volume(bodies: Sequence[Body]) -> dict[str, object]:
    """Exact when the bodies are pairwise disjoint; a bracket when they are not."""

    total = sum(body_volume(body) for body in bodies)
    overlap_upper_bound = 0.0
    overlapping_pairs = 0
    ordered = sorted(bodies, key=lambda body: body.minimum[0])
    for position, left in enumerate(ordered):
        for right in ordered[position + 1 :]:
            if right.minimum[0] >= left.maximum[0]:
                break
            overlap = _bodies_overlap(left, right)
            if overlap > 0:
                overlapping_pairs += 1
                overlap_upper_bound += overlap
    if overlapping_pairs == 0:
        return {
            "state": "exact-pairwise-disjoint",
            "volumeLdu3": total,
            "lowerLdu3": total,
            "upperLdu3": total,
            "overlappingBoundingBoxPairs": 0,
        }
    return {
        "state": "bracketed-overlapping-bounding-boxes",
        "volumeLdu3": None,
        "lowerLdu3": max(total - overlap_upper_bound, max(body_volume(body) for body in bodies)),
        "upperLdu3": total,
        "overlappingBoundingBoxPairs": overlapping_pairs,
    }


def measure_over_claim(candidate: Candidate, surface: MeasuredSurface) -> dict[str, object]:
    estimators = projection_volumes(surface.triangles)
    magnitudes = [
        abs(estimators["projectionX"]),
        abs(estimators["projectionY"]),
        abs(estimators["projectionZ"]),
    ]
    reference_low, reference_high = min(magnitudes), max(magnitudes)
    union = measure_union_volume(candidate.bodies)
    union_low = float(union["lowerLdu3"])  # type: ignore[arg-type]
    union_high = float(union["upperLdu3"])  # type: ignore[arg-type]
    return {
        "referenceVolumeBracketLdu3": {
            "low": reference_low,
            "high": reference_high,
            "spreadFraction": (reference_high - reference_low) / reference_high
            if reference_high > 0
            else None,
        },
        "referenceVolumeEstimatorsLdu3": estimators,
        "unionVolume": union,
        "overClaimRatioBracket": {
            "low": union_low / reference_high if reference_high > 0 else None,
            "high": union_high / reference_low if reference_low > 0 else None,
            "interpretation": (
                "a disagreement interval, not a confidence interval: it brackets the true "
                "over-claim only to the extent the material volume lies inside the reference "
                "bracket, and a low bound under 1 means that bracket is wider than the material, "
                "never that the candidate under-claims. Containment decides under-claim."
            ),
        },
        "surfaceClosure": open_boundary(surface.triangles),
    }


def _match(
    candidate_frames: Sequence[tuple[Vector3, Vector3]],
    truth_frames: Sequence[tuple[Vector3, Vector3]],
    tolerance: float,
) -> dict[str, object]:
    pairs = sorted(
        (
            (math.dist(candidate_position, truth_position), left, right)
            for left, (candidate_position, candidate_normal) in enumerate(candidate_frames)
            for right, (truth_position, truth_normal) in enumerate(truth_frames)
            if candidate_normal == truth_normal
            and math.dist(candidate_position, truth_position) <= tolerance
        ),
        key=lambda row: (row[0], row[1], row[2]),
    )
    ambiguous = sum(
        1
        for index in {left for _, left, _ in pairs}
        if sum(1 for _, left, _ in pairs if left == index) > 1
    ) + sum(
        1
        for index in {right for _, _, right in pairs}
        if sum(1 for _, _, right in pairs if right == index) > 1
    )
    used_candidate: set[int] = set()
    used_truth: set[int] = set()
    matched: list[tuple[int, int, float]] = []
    for distance, left, right in pairs:
        if left in used_candidate or right in used_truth:
            continue
        used_candidate.add(left)
        used_truth.add(right)
        matched.append((left, right, distance))
    return {
        "matched": len(matched),
        "unmatchedInCandidate": len(candidate_frames) - len(matched),
        "unmatchedInSource": len(truth_frames) - len(matched),
        "maximumPositionErrorLdu": max((distance for _, _, distance in matched), default=None),
        "ambiguousPairsWithinTolerance": max(0, ambiguous),
        "matchToleranceLdu": tolerance,
    }


def measure_connectors(
    candidate: Candidate, surface: MeasuredSurface
) -> dict[str, object]:
    truth = measured_connectors(surface)
    male = _match(
        [(row.position, row.normal) for row in candidate.male_connectors],
        [(row.position, row.normal) for row in truth["male"]],
        CONNECTOR_MATCH_TOLERANCE_LDU,
    )
    female = _match(
        [(row.position, row.normal) for row in candidate.female_connectors],
        [(row.position, row.normal) for row in truth["female"]],
        CONNECTOR_MATCH_TOLERANCE_LDU,
    )
    male["truthSource"] = "ldraw-visible-stud-primitive-components"
    male["truthCount"] = len(truth["male"])
    male["truthIsClutchCellTruth"] = True
    male["truthPositionsLdu"] = _positions(truth["male"])
    female["truthPositionsLdu"] = _positions(truth["female"])
    female["truthSource"] = "ldraw-underside-tube-primitive-components"
    female["truthCount"] = len(truth["female"])
    female["truthIsClutchCellTruth"] = False
    female["truthCaveat"] = (
        "an underside tube is not a clutch cell: it sits at the half pitch between cells and one "
        "tube can serve several cells, so this comparison is a diagnostic and is deliberately left "
        "out of the composite score rather than folded in as a false figure. A candidate whose "
        "clutches are correctly on the cell lattice scores zero here by construction; what actually "
        "measures a declared clutch is the clutchRoom section"
    )
    female["tubeOffsetFromStudLatticeLdu"] = _tube_offsets(
        truth["female"], [row.position for row in candidate.male_connectors]
    )
    female["scored"] = False
    male["scored"] = True
    return {"male": male, "female": female}


def _positions(connectors: Sequence[MeasuredConnector]) -> list[dict[str, object]]:
    return [
        {
            "positionLdu": [round(value, 9) for value in row.position],
            "normal": [round(value, 9) for value in row.normal],
            "measuredRadiusLdu": round(row.radius_ldu, 9),
            "measuredHeightLdu": round(row.height_ldu, 9),
        }
        for row in connectors
    ]


def _tube_offsets(
    tubes: Sequence[MeasuredConnector], male_positions: Sequence[Vector3]
) -> list[list[float]] | None:
    """How far each measured tube sits from the stud grid the studs themselves define."""

    if not tubes or not male_positions:
        return None
    phase_x = male_positions[0][0] % STUD_PITCH_LDU
    phase_z = male_positions[0][2] % STUD_PITCH_LDU
    offsets: list[list[float]] = []
    for tube in tubes:
        residual_x = (tube.center_xz[0] - phase_x) % STUD_PITCH_LDU
        residual_z = (tube.center_xz[1] - phase_z) % STUD_PITCH_LDU
        offsets.append(
            [
                round(min(residual_x, STUD_PITCH_LDU - residual_x), 6),
                round(min(residual_z, STUD_PITCH_LDU - residual_z), 6),
            ]
        )
    return offsets


def measure_body_budget(candidate: Candidate) -> dict[str, object]:
    kinds: dict[str, int] = {}
    tags: dict[str, int] = {}
    for body in candidate.bodies:
        kinds[body.kind] = kinds.get(body.kind, 0) + 1
        tags[body.tag] = tags.get(body.tag, 0) + 1
    plan_vertices = max(body.plan_vertices for body in candidate.bodies)
    plan_area = sum(polygon_area(body_plan_polygon(body)) for body in candidate.bodies if body.tag == "body")
    stud_cells = plan_area / (STUD_PITCH_LDU * STUD_PITCH_LDU)
    return {
        "bodyCount": len(candidate.bodies),
        "kinds": dict(sorted(kinds.items())),
        "tags": dict(sorted(tags.items())),
        "maximumPlanVertices": plan_vertices,
        "catalogMaximumPlanVertices": CATALOG_MAX_PLAN_VERTICES,
        "withinCatalogVertexLimit": plan_vertices <= CATALOG_MAX_PLAN_VERTICES,
        "solidPlanAreaLdu2": plan_area,
        "bodiesPerStudCell": len(candidate.bodies) / stud_cells if stud_cells > 0 else None,
    }


def score_candidate(
    candidate: Candidate,
    surface: MeasuredSurface,
    sample_spacing_ldu: float = DEFAULT_SAMPLE_SPACING_LDU,
) -> dict[str, object]:
    """One scorecard. Reports numbers; admits nothing."""

    if candidate.design_id != surface.design_id:
        raise ValueError(
            f"Candidate designId {candidate.design_id!r} does not match the measured surface "
            f"{surface.design_id!r}; a scorecard may only compare one part with its own source."
        )
    containment = measure_containment(candidate, surface, sample_spacing_ldu)
    over_claim = measure_over_claim(candidate, surface)
    connectors = measure_connectors(candidate, surface)
    lattice = measure_lattice(candidate)
    budget = measure_body_budget(candidate)
    clutch_room = measure_clutch_room(candidate, surface.triangles)

    hard_fails: list[dict[str, object]] = list(clutch_hard_fails(clutch_room))
    if int(containment["pointsOutside"]) > 0:  # type: ignore[arg-type]
        hard_fails.append(
            {
                "code": "collision-under-claim",
                "detail": (
                    f"{containment['pointsOutside']} of {containment['pointsSampled']} sampled "
                    f"surface points lie outside the candidate union, escaping by at least "
                    f"{containment['maximumEscapeLowerBoundLdu']} LDU. An approximation may refuse a "
                    "placement a real part would allow and must never allow one it would not."
                ),
            }
        )
    male = connectors["male"]
    if isinstance(male, dict) and int(male["unmatchedInCandidate"]) > 0:  # type: ignore[arg-type]
        hard_fails.append(
            {
                "code": "male-connector-over-claim",
                "detail": (
                    f"{male['unmatchedInCandidate']} declared stud connectors have no visible stud "
                    "primitive within "
                    f"{CONNECTOR_MATCH_TOLERANCE_LDU} LDU in the expanded source; a connector is a "
                    "physical claim and inventing one lets the editor attach where the real part "
                    "cannot."
                ),
            }
        )

    ratio_high = over_claim["overClaimRatioBracket"]["high"]  # type: ignore[index]
    ratio_low = over_claim["overClaimRatioBracket"]["low"]  # type: ignore[index]
    components: dict[str, float | None] = {
        "containment": 1.0 if int(containment["pointsOutside"]) == 0 else 0.0,  # type: ignore[arg-type]
        "volumeEfficiencyWorstCase": (1.0 / float(ratio_high)) if ratio_high else None,
        "volumeEfficiencyBestCase": (1.0 / float(ratio_low)) if ratio_low else None,
        "connectorCoverageMale": _coverage(male),
        "connectorCoverageFemaleDiagnosticUnscored": _coverage(connectors["female"]),
        "latticeConformance": lattice_score(lattice),
        "representableInCatalogContract": 1.0 if budget["withinCatalogVertexLimit"] else 0.0,
    }
    unscored = ("volumeEfficiencyBestCase", "connectorCoverageFemaleDiagnosticUnscored")
    scored = [
        value for key, value in components.items() if value is not None and key not in unscored
    ]
    composite = 0.0 if hard_fails else (sum(scored) / len(scored) if scored else 0.0)
    return {
        "designId": candidate.design_id,
        "derivation": candidate.derivation,
        "authority": {
            "state": "measurement-only-not-catalog-admitted",
            "partDefinitionsEmitted": False,
            "framesClaimed": False,
            "connectorTruthClaimed": False,
            "collisionTruthClaimed": False,
        },
        "score": {
            "composite": composite,
            "compositeIsZeroBecauseOfHardFail": bool(hard_fails),
            "components": components,
            "componentWeighting": "unweighted mean of the scored components listed above",
        },
        "hardFails": hard_fails,
        "collisionContainment": containment,
        "overClaim": over_claim,
        "connectorCoverage": connectors,
        "clutchRoom": clutch_room,
        "latticeConformance": lattice,
        "bodyBudget": budget,
    }


def _coverage(section: object) -> float | None:
    if not isinstance(section, dict):
        return None
    matched = int(section["matched"])
    total = matched + int(section["unmatchedInCandidate"]) + int(section["unmatchedInSource"])
    if total == 0:
        return None
    return matched / total
