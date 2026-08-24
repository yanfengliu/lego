from __future__ import annotations

import math
import unittest

from part_admission_contract import (
    CANDIDATE_FRAME,
    CANDIDATE_SCHEMA_VERSION,
    Vector3,
    validate_candidate,
)
from part_admission_geometry import (
    PlanIndex,
    body_contains,
    body_exterior_distance,
    body_volume,
    connected_surface_components,
    open_boundary,
    projection_volumes,
    sample_triangle,
)
from part_admission_lattice import lattice_cell_centers, lattice_score, measure_lattice
from part_admission_clutch import measure_clutch_room
from part_admission_surface import BODY_ROLE, CLUTCH_ROLE, MeasuredSurface, STUD_ROLE
from part_admission_scorecard import (
    measure_connectors,
    measure_union_volume,
    measured_connectors,
    score_candidate,
)


def quad(a: Vector3, b: Vector3, c: Vector3, d: Vector3) -> list[tuple[Vector3, ...]]:
    return [(a, b, c), (a, c, d)]


def box_surface(minimum: Vector3, maximum: Vector3) -> list[tuple[Vector3, ...]]:
    """The twelve outward-oriented triangles of one closed axis-aligned box."""

    (x0, y0, z0), (x1, y1, z1) = minimum, maximum
    return [
        *quad((x0, y0, z0), (x0, y0, z1), (x0, y1, z1), (x0, y1, z0)),
        *quad((x1, y0, z0), (x1, y1, z0), (x1, y1, z1), (x1, y0, z1)),
        *quad((x0, y0, z0), (x1, y0, z0), (x1, y0, z1), (x0, y0, z1)),
        *quad((x0, y1, z0), (x0, y1, z1), (x1, y1, z1), (x1, y1, z0)),
        *quad((x0, y0, z0), (x0, y1, z0), (x1, y1, z0), (x1, y0, z0)),
        *quad((x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1)),
    ]


def candidate_document(bodies: list[dict[str, object]], connectors: list[dict[str, object]]):
    return {
        "schemaVersion": CANDIDATE_SCHEMA_VERSION,
        "designId": "test",
        "frame": CANDIDATE_FRAME,
        "derivation": "unit test",
        "bodies": bodies,
        "connectors": connectors,
    }


def box_body(minimum: Vector3, maximum: Vector3, tag: str = "body") -> dict[str, object]:
    return {"kind": "box", "tag": tag, "minLdu": list(minimum), "maxLdu": list(maximum)}


PLATE_MIN = (-20.0, 0.0, -10.0)
PLATE_MAX = (20.0, 8.0, 10.0)


def plate_surface(design_id: str = "test") -> MeasuredSurface:
    triangles = box_surface(PLATE_MIN, PLATE_MAX)
    return MeasuredSurface(
        design_id=design_id,
        triangles=tuple(triangles),
        roles=tuple(BODY_ROLE for _ in triangles),
    )


class CandidateValidationTests(unittest.TestCase):
    def test_rejects_wrong_schema_frame_and_key_set(self) -> None:
        document = candidate_document([box_body(PLATE_MIN, PLATE_MAX)], [])
        with self.assertRaisesRegex(ValueError, "schemaVersion is 'other/1'"):
            validate_candidate({**document, "schemaVersion": "other/1"})
        with self.assertRaisesRegex(ValueError, "frame is 'catalog'"):
            validate_candidate({**document, "frame": "catalog"})
        with self.assertRaisesRegex(ValueError, "expected exactly"):
            validate_candidate({**document, "extra": 1})

    def test_rejects_unknown_body_kind_and_degenerate_extent(self) -> None:
        with self.assertRaisesRegex(ValueError, r"bodies\[0\].kind is 'sphere'"):
            validate_candidate(
                candidate_document([{**box_body(PLATE_MIN, PLATE_MAX), "kind": "sphere"}], [])
            )
        with self.assertRaisesRegex(ValueError, r"maxLdu\[y\]=0.0 at or below minLdu\[y\]=0.0"):
            validate_candidate(
                candidate_document([box_body((0.0, 0.0, 0.0), (4.0, 0.0, 4.0))], [])
            )

    def test_rejects_clockwise_or_concave_plan_polygon(self) -> None:
        clockwise = {
            "kind": "convex-prism",
            "tag": "body",
            "verticesXZLdu": [[0.0, 0.0], [0.0, 10.0], [10.0, 10.0]],
            "minYLdu": 0.0,
            "maxYLdu": 8.0,
        }
        with self.assertRaisesRegex(ValueError, "strictly convex and counter-clockwise"):
            validate_candidate(candidate_document([clockwise], []))

    def test_rejects_a_stud_declared_female(self) -> None:
        connector = {
            "kind": "stud",
            "gender": "female",
            "positionLdu": [0.0, 0.0, 0.0],
            "normal": [0.0, -1.0, 0.0],
        }
        with self.assertRaisesRegex(ValueError, "a stud is always male"):
            validate_candidate(candidate_document([box_body(PLATE_MIN, PLATE_MAX)], [connector]))


class GeometryTests(unittest.TestCase):
    def test_body_volumes_match_their_closed_forms(self) -> None:
        candidate = validate_candidate(
            candidate_document(
                [
                    box_body((0.0, 0.0, 0.0), (2.0, 3.0, 4.0)),
                    {
                        "kind": "cylinder",
                        "tag": "stud",
                        "axis": "y",
                        "centerLdu": [0.0, 0.0, 0.0],
                        "radiusLdu": 6.0,
                        "heightLdu": 4.0,
                    },
                    {
                        "kind": "convex-prism",
                        "tag": "body",
                        "verticesXZLdu": [[0.0, 0.0], [10.0, 0.0], [10.0, 10.0], [0.0, 10.0]],
                        "minYLdu": 0.0,
                        "maxYLdu": 2.0,
                    },
                    {
                        "kind": "wedge",
                        "tag": "body",
                        "minLdu": [0.0, 0.0, 0.0],
                        "maxLdu": [10.0, 1.0, 10.0],
                        "cutNormalXZ": [1.0, 1.0],
                        "cutOffsetLdu": 10.0,
                    },
                ],
                [],
            )
        )
        volumes = [body_volume(body) for body in candidate.bodies]
        self.assertAlmostEqual(volumes[0], 24.0)
        self.assertAlmostEqual(volumes[1], math.pi * 36 * 4)
        self.assertAlmostEqual(volumes[2], 200.0)
        self.assertAlmostEqual(volumes[3], 50.0)

    def test_containment_and_exterior_distance_of_a_box(self) -> None:
        body = validate_candidate(
            candidate_document([box_body((0.0, 0.0, 0.0), (10.0, 10.0, 10.0))], [])
        ).bodies[0]
        self.assertTrue(body_contains(body, (5.0, 5.0, 5.0)))
        self.assertTrue(body_contains(body, (10.0, 5.0, 5.0)))
        self.assertFalse(body_contains(body, (10.25, 5.0, 5.0)))
        self.assertAlmostEqual(body_exterior_distance(body, (10.25, 5.0, 5.0)), 0.25)
        self.assertAlmostEqual(
            body_exterior_distance(body, (10.25, 5.0, 10.25)), math.hypot(0.25, 0.25)
        )

    def test_plan_index_finds_a_body_whose_face_is_on_a_bucket_boundary(self) -> None:
        candidate = validate_candidate(
            candidate_document([box_body((-20.0, 0.0, 0.0), (-16.0, 8.0, 4.0))], [])
        )
        index = PlanIndex.build(candidate.bodies)
        self.assertTrue(index.contains_point((-20.0, 4.0, 2.0)))
        self.assertTrue(index.contains_point((-20.000000000000004, 4.0, 2.0)))

    def test_sample_triangle_respects_the_requested_spacing(self) -> None:
        triangle = ((0.0, 0.0, 0.0), (4.0, 0.0, 0.0), (0.0, 0.0, 4.0))
        points = list(sample_triangle(triangle, 1.0))
        # The 4 by 4 legs give a hypotenuse of 5.66, so six steps, and a
        # barycentric grid of (n + 1)(n + 2) / 2 points at 0.67 LDU apart.
        self.assertEqual(len(points), (7 * 8) // 2)
        for point in points:
            self.assertTrue(any(math.dist(point, other) <= 1.0 for other in points if other != point))

    def test_projection_estimators_agree_on_a_closed_box_and_split_on_an_open_one(self) -> None:
        closed = box_surface((0.0, 0.0, 0.0), (10.0, 4.0, 20.0))
        estimators = projection_volumes(closed)
        for key in ("projectionX", "projectionY", "projectionZ", "divergence"):
            self.assertAlmostEqual(estimators[key], 800.0, places=9)
        opened = [triangle for triangle in closed if not all(point[1] == 4.0 for point in triangle)]
        split = projection_volumes(opened)
        self.assertAlmostEqual(split["projectionX"], 800.0, places=9)
        self.assertAlmostEqual(split["projectionZ"], 800.0, places=9)
        self.assertAlmostEqual(split["projectionY"], 0.0, places=9)

    def test_open_boundary_counts_only_uncancelled_directed_edges(self) -> None:
        closed = box_surface((0.0, 0.0, 0.0), (10.0, 4.0, 20.0))
        self.assertEqual(
            open_boundary(closed), {"directedEdgeResidual": 0, "supportingLineResidual": 0}
        )
        opened = [triangle for triangle in closed if not all(point[1] == 4.0 for point in triangle)]
        residual = open_boundary(opened)
        self.assertEqual(residual["directedEdgeResidual"], 4)
        self.assertEqual(residual["supportingLineResidual"], 4)

    def test_connected_components_separate_two_disjoint_shells(self) -> None:
        shells = box_surface((0.0, 0.0, 0.0), (4.0, 4.0, 4.0)) + box_surface(
            (20.0, 0.0, 0.0), (24.0, 4.0, 4.0)
        )
        self.assertEqual(len(connected_surface_components(shells)), 2)

    def test_union_volume_is_exact_when_disjoint_and_bracketed_when_not(self) -> None:
        disjoint = validate_candidate(
            candidate_document(
                [box_body((0.0, 0.0, 0.0), (4.0, 4.0, 4.0)), box_body((4.0, 0.0, 0.0), (8.0, 4.0, 4.0))],
                [],
            )
        )
        exact = measure_union_volume(disjoint.bodies)
        self.assertEqual(exact["state"], "exact-pairwise-disjoint")
        self.assertAlmostEqual(float(exact["volumeLdu3"]), 128.0)  # type: ignore[arg-type]
        overlapping = validate_candidate(
            candidate_document(
                [box_body((0.0, 0.0, 0.0), (4.0, 4.0, 4.0)), box_body((2.0, 0.0, 0.0), (6.0, 4.0, 4.0))],
                [],
            )
        )
        bracket = measure_union_volume(overlapping.bodies)
        self.assertEqual(bracket["state"], "bracketed-overlapping-bounding-boxes")
        self.assertIsNone(bracket["volumeLdu3"])
        self.assertLess(float(bracket["lowerLdu3"]), float(bracket["upperLdu3"]))  # type: ignore[arg-type]


class ScoreTests(unittest.TestCase):
    def test_a_source_gated_axle_is_not_misread_as_a_visible_stud_or_clutch(self) -> None:
        candidate = validate_candidate(
            candidate_document(
                [box_body((-30.0, -6.0, -6.0), (30.0, 6.0, 6.0))],
                [
                    {
                        "kind": "axle",
                        "gender": "male",
                        "positionLdu": [-20.0, 0.0, 0.0],
                        "normal": [-1.0, 0.0, 0.0],
                    }
                ],
            )
        )

        measured = measure_connectors(candidate, plate_surface())

        self.assertEqual(candidate.stud_connectors, ())
        self.assertEqual(len(candidate.axle_connectors), 1)
        self.assertEqual(measured["male"]["unmatchedInCandidate"], 0)  # type: ignore[index]
        self.assertEqual(measured["sourceAuthoredUnscored"]["count"], 1)  # type: ignore[index]
        self.assertEqual(measure_clutch_room(candidate, ())["declaredClutches"], 0)

    def test_an_exact_box_candidate_scores_clean(self) -> None:
        candidate = validate_candidate(candidate_document([box_body(PLATE_MIN, PLATE_MAX)], []))
        scorecard = score_candidate(candidate, plate_surface(), 1.0)
        self.assertEqual(scorecard["hardFails"], [])
        self.assertEqual(scorecard["collisionContainment"]["pointsOutside"], 0)  # type: ignore[index]
        self.assertGreater(scorecard["collisionContainment"]["pointsSampled"], 1000)  # type: ignore[index]
        bracket = scorecard["overClaim"]["overClaimRatioBracket"]  # type: ignore[index]
        self.assertAlmostEqual(float(bracket["low"]), 1.0, places=9)
        self.assertAlmostEqual(float(bracket["high"]), 1.0, places=9)
        self.assertEqual(
            scorecard["authority"]["state"], "measurement-only-not-catalog-admitted"  # type: ignore[index]
        )

    def test_a_quarter_ldu_inset_is_a_hard_fail_not_a_low_score(self) -> None:
        inset = validate_candidate(
            candidate_document(
                [box_body((-19.75, 0.0, -9.75), (19.75, 8.0, 9.75))],
                [],
            )
        )
        scorecard = score_candidate(inset, plate_surface(), 1.0)
        self.assertEqual([row["code"] for row in scorecard["hardFails"]], ["collision-under-claim"])  # type: ignore[index]
        self.assertEqual(scorecard["score"]["composite"], 0.0)  # type: ignore[index]
        self.assertGreaterEqual(
            float(scorecard["collisionContainment"]["maximumEscapeLowerBoundLdu"]), 0.25  # type: ignore[index,arg-type]
        )

    def test_a_stud_the_source_does_not_have_is_a_hard_fail(self) -> None:
        invented = validate_candidate(
            candidate_document(
                [box_body(PLATE_MIN, PLATE_MAX)],
                [
                    {
                        "kind": "stud",
                        "gender": "male",
                        "positionLdu": [-10.0, 0.0, 0.0],
                        "normal": [0.0, -1.0, 0.0],
                    }
                ],
            )
        )
        scorecard = score_candidate(invented, plate_surface(), 2.0)
        self.assertEqual(
            [row["code"] for row in scorecard["hardFails"]], ["male-connector-over-claim"]  # type: ignore[index]
        )
        male = scorecard["connectorCoverage"]["male"]  # type: ignore[index]
        self.assertEqual(male["unmatchedInCandidate"], 1)
        self.assertEqual(male["unmatchedInSource"], 0)

    def test_measured_male_connectors_come_from_stud_components(self) -> None:
        body = box_surface(PLATE_MIN, PLATE_MAX)
        stud = box_surface((-14.0, -4.0, -4.0), (-6.0, 0.0, 4.0))
        tube = box_surface((-4.0, 4.0, -4.0), (4.0, 8.0, 4.0))
        surface = MeasuredSurface(
            design_id="test",
            triangles=tuple(body + stud + tube),
            roles=tuple(
                [BODY_ROLE] * len(body) + [STUD_ROLE] * len(stud) + [CLUTCH_ROLE] * len(tube)
            ),
        )
        truth = measured_connectors(surface)
        self.assertEqual(len(truth["male"]), 1)
        self.assertEqual(truth["male"][0].position, (-10.0, 0.0, 0.0))
        self.assertEqual(truth["male"][0].normal, (0.0, -1.0, 0.0))
        self.assertEqual(len(truth["female"]), 1)
        self.assertEqual(truth["female"][0].position, (0.0, 8.0, 0.0))

    def test_a_tube_at_the_half_pitch_is_reported_as_an_offset_not_a_clutch_cell(self) -> None:
        body = box_surface(PLATE_MIN, PLATE_MAX)
        stud = box_surface((-14.0, -4.0, -4.0), (-6.0, 0.0, 4.0))
        tube = box_surface((-4.0, 4.0, -4.0), (4.0, 8.0, 4.0))
        surface = MeasuredSurface(
            design_id="test",
            triangles=tuple(body + stud + tube),
            roles=tuple(
                [BODY_ROLE] * len(body) + [STUD_ROLE] * len(stud) + [CLUTCH_ROLE] * len(tube)
            ),
        )
        candidate = validate_candidate(
            candidate_document(
                [box_body(PLATE_MIN, PLATE_MAX), box_body((-14.0, -4.0, -4.0), (-6.0, 0.0, 4.0), "stud")],
                [
                    {
                        "kind": "stud",
                        "gender": "male",
                        "positionLdu": [-10.0, 0.0, 0.0],
                        "normal": [0.0, -1.0, 0.0],
                    }
                ],
            )
        )
        scorecard = score_candidate(candidate, surface, 2.0)
        female = scorecard["connectorCoverage"]["female"]  # type: ignore[index]
        self.assertEqual(female["scored"], False)
        self.assertEqual(female["tubeOffsetFromStudLatticeLdu"], [[10.0, 0.0]])
        self.assertEqual(female["unmatchedInSource"], 1)
        components = scorecard["score"]["components"]  # type: ignore[index]
        self.assertEqual(components["connectorCoverageFemaleDiagnosticUnscored"], 0.0)
        # Zero female coverage must not move the composite: an underside tube is
        # not clutch-cell truth, so it is reported and left out of the score.
        self.assertGreater(float(scorecard["score"]["composite"]), 0.9)  # type: ignore[index,arg-type]

    def test_a_fractional_height_is_not_lattice_alignable(self) -> None:
        fractional = validate_candidate(
            candidate_document([box_body((-10.0, -16.00016098, -40.0), (10.0, 0.0, 40.0))], [])
        )
        lattice = measure_lattice(fractional)
        self.assertFalse(lattice["latticeAlignable"])
        self.assertAlmostEqual(
            float(lattice["solid"]["plateHeightResidualLdu"]), 0.00016098, places=9  # type: ignore[index,arg-type]
        )
        self.assertEqual(lattice["solid"]["footprintCells"], [1, 4])  # type: ignore[index]

    def test_directional_connector_faces_use_their_own_tangent_lattices(self) -> None:
        bracket = validate_candidate(
            candidate_document(
                [box_body((-40.0, -10.0, -14.0), (40.0, 10.0, 10.0))],
                [
                    {
                        "kind": "stud",
                        "gender": "male",
                        "positionLdu": [-30.0, 0.0, -14.0],
                        "normal": [0.0, 0.0, -1.0],
                    },
                    {
                        "kind": "stud",
                        "gender": "male",
                        "positionLdu": [-10.0, 0.0, -14.0],
                        "normal": [0.0, 0.0, -1.0],
                    },
                    {
                        "kind": "stud",
                        "gender": "male",
                        "positionLdu": [-10.0, -10.0, 0.0],
                        "normal": [0.0, -1.0, 0.0],
                    },
                    {
                        "kind": "undersideClutch",
                        "gender": "female",
                        "positionLdu": [-10.0, 10.0, 0.0],
                        "normal": [0.0, 1.0, 0.0],
                    },
                ],
            )
        )
        lattice = measure_lattice(bracket)

        self.assertTrue(lattice["latticeAlignable"])
        self.assertEqual(lattice["connectorPitch"]["connectorsOnCommonGrid"], 4)  # type: ignore[index]
        self.assertEqual(len(lattice["connectorPitch"]["groups"]), 3)  # type: ignore[index]
        self.assertEqual(
            lattice["solid"]["plateHeightCriterion"],  # type: ignore[index]
            "not-applicable-directional-connector-envelope",
        )
        self.assertIsNone(lattice["solid"]["plateHeightConforms"])  # type: ignore[index]
        self.assertEqual(lattice_score(lattice), 1.0)

    def test_lattice_cell_centers_pick_the_phase_that_covers_with_fewest_cells(self) -> None:
        self.assertEqual(lattice_cell_centers(-10.0, 10.0), [0.0])
        self.assertEqual(lattice_cell_centers(-20.0, 20.0), [-10.0, 10.0])
        self.assertEqual(lattice_cell_centers(-20.0, 17.0), [-10.0, 10.0])


if __name__ == "__main__":
    unittest.main()
