from __future__ import annotations

import unittest

from part_admission_contract import CANDIDATE_FRAME, CANDIDATE_SCHEMA_VERSION, Vector3, validate_candidate
from part_admission_ldraw_candidate import (
    PRIMITIVE_ROLE_PINS,
    _height_field,
    column_candidate,
    horizontally_inset_candidate,
    role_classifier,
)
from part_admission_scorecard import measure_union_volume, score_candidate
from part_admission_surface import BODY_ROLE, CLUTCH_ROLE, MeasuredSurface, STUD_ROLE


def quad(a: Vector3, b: Vector3, c: Vector3, d: Vector3) -> list[tuple[Vector3, ...]]:
    return [(a, b, c), (a, c, d)]


def box_surface(minimum: Vector3, maximum: Vector3) -> list[tuple[Vector3, ...]]:
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


PLATE_MIN = (-20.0, 0.0, -10.0)
PLATE_MAX = (20.0, 8.0, 10.0)


def plate_surface() -> MeasuredSurface:
    triangles = box_surface(PLATE_MIN, PLATE_MAX)
    return MeasuredSurface(
        design_id="test",
        triangles=tuple(triangles),
        roles=tuple(BODY_ROLE for _ in triangles),
    )


class LDrawCandidateTests(unittest.TestCase):
    def test_role_classifier_pins_the_primitive_digest(self) -> None:
        key = ("official", "p/stud.dat")
        digest = PRIMITIVE_ROLE_PINS[key][0]
        classify = role_classifier(lambda _: digest)
        self.assertEqual(classify((("official", "parts/3024.dat"), key)), STUD_ROLE)
        self.assertEqual(classify((("official", "parts/3024.dat"),)), BODY_ROLE)
        with self.assertRaisesRegex(ValueError, "the pinned role policy expects"):
            role_classifier(lambda _: "sha256:0")((key,))

    def test_stud3a_is_checksum_pinned_as_a_clutch_tube_not_a_visible_stud(self) -> None:
        key = ("official", "p/stud3a.dat")
        expected = "sha256:91b1f54ed55b2f57dd73225da3198b5198e31f7587a5e8b7d3351b1478c8881c"
        self.assertEqual(PRIMITIVE_ROLE_PINS[key], (expected, CLUTCH_ROLE))
        classify = role_classifier(lambda source: PRIMITIVE_ROLE_PINS[source][0])
        role = classify((("official", "parts/3040.dat"), key))
        self.assertEqual(role, CLUTCH_ROLE)
        self.assertNotEqual(role, STUD_ROLE)
        with self.assertRaisesRegex(ValueError, "the pinned role policy expects"):
            role_classifier(lambda _: "sha256:0")((key,))

    def test_column_candidate_tiles_a_box_exactly(self) -> None:
        candidate = validate_candidate(column_candidate(plate_surface(), 4.0))
        union = measure_union_volume(candidate.bodies)
        self.assertEqual(union["state"], "exact-pairwise-disjoint")
        self.assertAlmostEqual(float(union["volumeLdu3"]), 40.0 * 8.0 * 24.0)  # type: ignore[arg-type]
        self.assertGreater(float(union["volumeLdu3"]), 40.0 * 8.0 * 20.0)  # type: ignore[arg-type]
        self.assertEqual(score_candidate(candidate, plate_surface(), 1.0)["collisionContainment"]["pointsOutside"], 0)  # type: ignore[index]

    def test_side_stud_discovery_matches_position_and_outward_normal(self) -> None:
        body = box_surface((-10.0, 0.0, -10.0), (10.0, 8.0, 10.0))
        side_stud = box_surface((-6.0, -2.0, -14.0), (6.0, 10.0, -10.0))
        surface = MeasuredSurface(
            design_id="side-stud",
            triangles=tuple([*body, *side_stud]),
            roles=tuple([*[BODY_ROLE for _ in body], *[STUD_ROLE for _ in side_stud]]),
        )
        raw = column_candidate(surface, 2.0)
        candidate = validate_candidate(raw)
        self.assertEqual(
            [(row.position, row.normal) for row in candidate.male_connectors],
            [((0.0, 4.0, -10.0), (0.0, 0.0, -1.0))],
        )
        self.assertNotIn(
            "male-connector-over-claim",
            [row["code"] for row in score_candidate(candidate, surface, 2.0)["hardFails"]],  # type: ignore[index]
        )
        raw["connectors"][0]["normal"] = [0.0, -1.0, 0.0]  # type: ignore[index]
        self.assertIn(
            "male-connector-over-claim",
            [row["code"] for row in score_candidate(validate_candidate(raw), surface, 2.0)["hardFails"]],  # type: ignore[index]
        )

    def test_a_wall_on_a_column_boundary_opens_no_column_outside_the_part(self) -> None:
        cells = _height_field(box_surface(PLATE_MIN, PLATE_MAX), 4.0)
        self.assertEqual((min(row[0] for row in cells), max(row[0] for row in cells)), (-5, 4))
        self.assertEqual((min(row[1] for row in cells), max(row[1] for row in cells)), (-3, 2))

    def test_a_zero_thickness_sheet_becomes_a_minimum_height_body(self) -> None:
        sheet = [
            *quad((0.0, 4.0, 0.0), (4.0, 4.0, 0.0), (4.0, 4.0, 4.0), (0.0, 4.0, 4.0)),
            *quad((0.0, 4.0, 4.0), (4.0, 4.0, 4.0), (4.0, 4.0, 0.0), (0.0, 4.0, 0.0)),
        ]
        surface = MeasuredSurface(
            design_id="sheet", triangles=tuple(sheet), roles=tuple(BODY_ROLE for _ in sheet)
        )
        candidate = validate_candidate(column_candidate(surface, 4.0))
        self.assertEqual(len(candidate.bodies), 1)
        self.assertAlmostEqual(candidate.bodies[0].maximum[1] - candidate.bodies[0].minimum[1], 0.001)
        self.assertEqual(score_candidate(candidate, surface, 1.0)["collisionContainment"]["pointsOutside"], 0)  # type: ignore[index]

    def test_the_inset_probe_shrinks_only_horizontal_faces(self) -> None:
        candidate = column_candidate(plate_surface(), 20.0)
        probe = horizontally_inset_candidate(candidate)
        original = validate_candidate(candidate).bodies[0]
        inset = validate_candidate(probe).bodies[0]
        self.assertAlmostEqual(inset.minimum[0] - original.minimum[0], 0.25)
        self.assertAlmostEqual(original.maximum[2] - inset.maximum[2], 0.25)
        self.assertEqual((inset.minimum[1], inset.maximum[1]), (original.minimum[1], original.maximum[1]))
        scorecard = score_candidate(validate_candidate(probe), plate_surface(), 1.0)
        self.assertEqual(
            [row["code"] for row in scorecard["hardFails"]],  # type: ignore[index]
            ["female-connector-has-no-room-for-a-stud", "collision-under-claim"],
        )


if __name__ == "__main__":
    unittest.main()
