from __future__ import annotations

import unittest
from fractions import Fraction

from builder_ldraw_field import (
    BUILDER_UNIT_LDU,
    FEMALE_FAMILIES,
    MALE_FAMILIES,
    TUBE_FAMILIES,
    builder_field_nodes,
)
from builder_ldraw_frame import (
    BuilderLdrawFrame,
    apply_symmetry,
    canonical_frame,
    emit_connectors,
    exact_frames,
    frames_modulo_symmetry,
    lattice_phase_census,
    turn_matrix,
)
from builder_ldraw_frame_pins import (
    EXACT,
    PINNED_FRAMES,
    REGISTERED,
    UNAVAILABLE_DESIGN_IDS,
    check_pinned_digest,
    pinned_frame,
)
from part_admission_clutch import (
    CLUTCH_ROOM_TOLERANCE_LDU,
    LDRAW_INSCRIBED_SAGITTA_LDU,
    clutch_hard_fails,
    measure_clutch_room,
)
from part_admission_contract import (
    CANDIDATE_FRAME,
    CANDIDATE_SCHEMA_VERSION,
    validate_candidate,
)

ZERO = (Fraction(0), Fraction(0), Fraction(0))


def field(
    field_type: int,
    width: int,
    height: int,
    translation: tuple[str, str, str],
    grid: str,
) -> dict[str, object]:
    return {
        "kind": "Custom2DField",
        "attributes": {
            "angle": "0",
            "ax": "0",
            "ay": "1",
            "az": "0",
            "height": str(height),
            "transformation": "1,0,0,0,1,0,0,0,1," + ",".join(translation),
            "tx": translation[0],
            "ty": translation[1],
            "tz": translation[2],
            "type": str(field_type),
            "width": str(width),
        },
        "grid": grid,
    }


def plate_1x2_record() -> dict[str, object]:
    """A 1x2 plate: two studs, two under-stud clutches, one rail between them."""

    return {
        "id": "test",
        "revision": "A",
        "recordSha256": "0" * 64,
        "connectivityPrimitives": [
            field(
                23,
                4,
                2,
                ("-0.4", "0.32", "-0.4"),
                "18:1:1,23:4:1,18:2:1,23:4:1,18:1:1,"
                "23:4:1,0:4:1,23:4:1,0:4:1,23:4:1,"
                "18:1:1,23:4:1,18:2:1,23:4:1,18:1:1",
            ),
            field(
                22,
                4,
                2,
                ("-0.4", "0", "-0.4"),
                "22:1:1,22:2:1,22:2:1,22:2:1,22:1:1,"
                "22:2:1,15:4:1,9:4:1,15:4:1,22:2:1,"
                "22:1:1,22:2:1,22:2:1,22:2:1,22:1:1",
            ),
        ],
    }


def rational(*values: int) -> tuple[Fraction, ...]:
    return tuple(Fraction(value) for value in values)


class NodeLatticeTests(unittest.TestCase):
    def test_a_field_is_a_half_stud_node_lattice(self) -> None:
        nodes = builder_field_nodes(plate_1x2_record())
        self.assertEqual(len(nodes), 30)
        top = [node for node in nodes if node.field_type == 23]
        self.assertEqual(len(top), 15)
        studs = [node for node in nodes if node.family in MALE_FAMILIES]
        self.assertEqual([(node.col, node.row) for node in studs], [(1, 1), (3, 1)])
        self.assertEqual(studs[0].builder, (Fraction(0), Fraction(8, 25), Fraction(0)))
        self.assertEqual(studs[1].builder, (Fraction(4, 5), Fraction(8, 25), Fraction(0)))

    def test_a_grid_that_is_not_a_node_lattice_is_refused_by_size(self) -> None:
        record = plate_1x2_record()
        record["connectivityPrimitives"][0]["attributes"]["width"] = "3"  # type: ignore[index]
        with self.assertRaisesRegex(ValueError, "grid has 15 codes; a 3x2 field is a 4x3"):
            builder_field_nodes(record)

    def test_an_unknown_field_type_has_no_gender_and_is_refused(self) -> None:
        record = plate_1x2_record()
        record["connectivityPrimitives"][0]["attributes"]["type"] = "7"  # type: ignore[index]
        with self.assertRaisesRegex(ValueError, "field type 7; this derivation reads 23"):
            builder_field_nodes(record)

    def test_a_rotation_is_read_column_major(self) -> None:
        record = plate_1x2_record()
        record["connectivityPrimitives"][0]["attributes"]["transformation"] = (  # type: ignore[index]
            "0,0,1,0,1,0,-1,0,0,-0.4,0.32,-0.4"
        )
        studs = [node for node in builder_field_nodes(record) if node.family in MALE_FAMILIES]
        self.assertEqual(studs[0].builder, (Fraction(-4, 5), Fraction(8, 25), Fraction(0)))
        self.assertEqual(studs[1].builder, (Fraction(-4, 5), Fraction(8, 25), Fraction(4, 5)))

    def test_a_measured_floating_residue_snaps_but_a_real_rotation_does_not(self) -> None:
        record = plate_1x2_record()
        record["connectivityPrimitives"][0]["attributes"]["transformation"] = (  # type: ignore[index]
            "2.220446049e-16,0,1,0,1,0,-1,0,2.220446049e-16,-0.4,0.32,-0.4"
        )
        studs = [node for node in builder_field_nodes(record) if node.family in MALE_FAMILIES]
        self.assertEqual(studs[1].builder, (Fraction(-4, 5), Fraction(8, 25), Fraction(4, 5)))
        record["connectivityPrimitives"][0]["attributes"]["transformation"] = (  # type: ignore[index]
            "0.000001,0,1,0,1,0,-1,0,0.000001,0,0,0"
        )
        with self.assertRaisesRegex(ValueError, "serialized residue"):
            builder_field_nodes(record)

    def test_a_reflected_field_is_not_a_proper_local_frame(self) -> None:
        record = plate_1x2_record()
        record["connectivityPrimitives"][0]["attributes"]["transformation"] = (  # type: ignore[index]
            "-1,0,0,0,1,0,0,0,1,0,0,0"
        )
        with self.assertRaisesRegex(ValueError, "determinant -1"):
            builder_field_nodes(record)

    def test_a_record_with_no_field_says_so(self) -> None:
        with self.assertRaisesRegex(ValueError, "carries no Custom2DField"):
            builder_field_nodes({"id": "empty", "connectivityPrimitives": []})


class FrameAlgebraTests(unittest.TestCase):
    def test_the_matrix_is_the_turn_composed_with_the_native_pack_frame(self) -> None:
        self.assertEqual(turn_matrix("turn0"), (25, 0, 0, 0, -25, 0, 0, 0, -25))
        self.assertEqual(turn_matrix("turn180"), (-25, 0, 0, 0, -25, 0, 0, 0, 25))
        self.assertEqual(turn_matrix("turn90"), (0, 0, 25, 0, -25, 0, 25, 0, 0))

    def test_every_pinned_frame_is_a_proper_turn(self) -> None:
        for frame in PINNED_FRAMES.values():
            self.assertEqual(frame.determinant_sign, 1, frame.design_id)

    def test_the_frame_round_trips_exactly(self) -> None:
        for frame in PINNED_FRAMES.values():
            for point in (
                (Fraction(0), Fraction(0), Fraction(0)),
                (Fraction(2, 5), Fraction(8, 25), Fraction(-2, 5)),
                (Fraction(-7, 3), Fraction(1, 7), Fraction(11, 13)),
            ):
                self.assertEqual(frame.invert(frame.apply(point)), point, frame.design_id)

    def test_a_unit_builder_step_is_exactly_25_ldu(self) -> None:
        frame = pinned_frame("51739")
        origin = frame.apply(ZERO)
        stepped = frame.apply((Fraction(1), Fraction(0), Fraction(0)))
        self.assertEqual(
            max(abs(stepped[axis] - origin[axis]) for axis in range(3)),
            Fraction(BUILDER_UNIT_LDU),
        )

    def test_the_digest_changes_when_any_bound_field_changes(self) -> None:
        frame = pinned_frame("77844")
        check_pinned_digest(frame)
        for changed in (
            BuilderLdrawFrame(
                frame.design_id, "C", frame.record_sha256, frame.turn, frame.translation, EXACT
            ),
            BuilderLdrawFrame(
                frame.design_id, frame.revision, "f" * 64, frame.turn, frame.translation, EXACT
            ),
            BuilderLdrawFrame(
                frame.design_id, frame.revision, frame.record_sha256, "turn90", frame.translation, EXACT
            ),
            BuilderLdrawFrame(
                frame.design_id, frame.revision, frame.record_sha256, frame.turn, ZERO, EXACT
            ),
            BuilderLdrawFrame(
                frame.design_id,
                frame.revision,
                frame.record_sha256,
                frame.turn,
                frame.translation,
                REGISTERED,
            ),
        ):
            self.assertNotEqual(changed.digest, frame.digest)
            with self.assertRaisesRegex(ValueError, "Re-derive and review the frame"):
                check_pinned_digest(changed)

    def test_30357_has_no_frame_and_the_refusal_says_why(self) -> None:
        self.assertEqual(UNAVAILABLE_DESIGN_IDS, ("30357",))
        with self.assertRaisesRegex(KeyError, "has no Builder record at all"):
            pinned_frame("30357")


class DerivationTests(unittest.TestCase):
    def setUp(self) -> None:
        self.nodes = builder_field_nodes(plate_1x2_record())
        # A 1x2 plate whose LDraw frame puts its studs at x = -10 and x = +10.
        self.studs = [rational(-10, 0, 0), rational(10, 0, 0)]
        self.tubes = [rational(0, 8, 0)]

    def derive(self):
        return exact_frames("test", "A", "0" * 64, self.nodes, self.studs, self.tubes)

    def test_exact_correspondence_finds_the_frame_with_no_residual(self) -> None:
        frames = self.derive()
        self.assertTrue(frames)
        for frame in frames:
            for node, target in zip(
                [node for node in self.nodes if node.family in MALE_FAMILIES], self.studs
            ):
                mapped = frame.apply(node.builder)
                self.assertEqual(mapped[1], target[1])
            self.assertEqual(frame.derivation, "exact-lattice-correspondence")

    def test_a_symmetric_part_admits_several_frames_that_are_one_class(self) -> None:
        frames = self.derive()
        symmetries = [
            ("turn0", ZERO),
            ("turn180", ZERO),
            ("mirrorX-turn0", ZERO),
            ("mirrorX-turn180", ZERO),
        ]
        self.assertEqual(len(frames), 4)
        self.assertEqual(len(frames_modulo_symmetry(frames, symmetries)), 1)
        self.assertEqual(canonical_frame(frames).turn, "turn0")

    def test_a_wrong_tube_position_leaves_no_exact_frame(self) -> None:
        self.tubes = [rational(4, 8, 0)]
        self.assertEqual(self.derive(), [])

    def test_a_missing_measured_stud_leaves_no_exact_frame(self) -> None:
        self.studs = [rational(-10, 0, 0)]
        self.assertEqual(self.derive(), [])

    def test_only_studs_and_under_stud_clutches_are_emitted(self) -> None:
        frame = canonical_frame(self.derive())
        connectors = emit_connectors(self.nodes, frame)
        self.assertEqual(
            [(row["kind"], tuple(row["positionLdu"])) for row in connectors],
            [
                ("stud", (-10.0, 0.0, 0.0)),
                ("stud", (10.0, 0.0, 0.0)),
                ("undersideClutch", (-10.0, 8.0, 0.0)),
                ("undersideClutch", (10.0, 8.0, 0.0)),
            ],
        )
        self.assertEqual(connectors[0]["normal"], [0.0, -1.0, 0.0])
        self.assertEqual(connectors[2]["normal"], [0.0, 1.0, 0.0])

    def test_the_rail_is_measured_but_never_emitted_because_it_is_off_the_cell(self) -> None:
        frame = canonical_frame(self.derive())
        rails = [node for node in self.nodes if node.family in TUBE_FAMILIES]
        self.assertEqual(len(rails), 1)
        census = lattice_phase_census(self.nodes, frame)
        by_family = census["byFamily"]
        self.assertEqual(by_family["9"], {"half/cell": 1})
        for family in MALE_FAMILIES:
            if str(family) in by_family:
                self.assertEqual(by_family[str(family)], {"cell/cell": 2})
        for family in FEMALE_FAMILIES:
            self.assertEqual(by_family[str(family)], {"cell/cell": 2})

    def test_a_grip_that_is_off_the_common_cell_phase_is_reported(self) -> None:
        frame = canonical_frame(self.derive())
        moved = BuilderLdrawFrame(
            frame.design_id,
            frame.revision,
            frame.record_sha256,
            frame.turn,
            (frame.translation[0] + Fraction(5), frame.translation[1], frame.translation[2]),
            frame.derivation,
        )
        census = lattice_phase_census(self.nodes, moved)
        self.assertEqual(census["gripNodesOffThatPhase"], [])
        self.assertEqual(census["cellPhaseLdu"], ["15", "0"])


def clutch_candidate(minimum, maximum, clutches) -> dict[str, object]:
    return {
        "schemaVersion": CANDIDATE_SCHEMA_VERSION,
        "designId": "clutch",
        "frame": CANDIDATE_FRAME,
        "derivation": "test",
        "bodies": [{"kind": "box", "tag": "body", "minLdu": list(minimum), "maxLdu": list(maximum)}],
        "connectors": [
            {
                "kind": "undersideClutch",
                "gender": "female",
                "positionLdu": list(position),
                "normal": [0.0, 1.0, 0.0],
            }
            for position in clutches
        ],
    }


def quad(a, b, c, d):
    return [(a, b, c), (a, c, d)]


class ClutchRoomTests(unittest.TestCase):
    def open_recess(self):
        """A plate bottom at y = 8 with a 4 LDU deep, 20 LDU wide open recess."""

        return [
            *quad((-10.0, 4.0, -10.0), (10.0, 4.0, -10.0), (10.0, 4.0, 10.0), (-10.0, 4.0, 10.0)),
            *quad((-10.0, 0.0, -10.0), (-10.0, 0.0, 10.0), (10.0, 0.0, 10.0), (10.0, 0.0, -10.0)),
        ]

    def closed_face(self):
        return [
            *self.open_recess(),
            *quad((-10.0, 8.0, -10.0), (10.0, 8.0, -10.0), (10.0, 8.0, 10.0), (-10.0, 8.0, 10.0)),
        ]

    def test_a_real_recess_has_room_for_a_stud(self) -> None:
        candidate = validate_candidate(
            clutch_candidate((-10.0, 0.0, -10.0), (10.0, 8.0, 10.0), [(0.0, 8.0, 0.0)])
        )
        measured = measure_clutch_room(candidate, self.open_recess(), 0.5)
        self.assertEqual(measured["clutchesWithRoom"], 1)
        self.assertEqual(measured["maximumIntrusionLdu"], 0.0)
        self.assertEqual(clutch_hard_fails(measured), [])

    def test_a_closed_face_is_a_hard_fail_because_no_stud_can_enter(self) -> None:
        candidate = validate_candidate(
            clutch_candidate((-10.0, 0.0, -10.0), (10.0, 8.0, 10.0), [(0.0, 8.0, 0.0)])
        )
        measured = measure_clutch_room(candidate, self.closed_face(), 0.5)
        self.assertEqual(measured["clutchesWithRoom"], 0)
        self.assertGreater(measured["clutches"][0]["facePointsBlockingOpening"], 0)  # type: ignore[index]
        self.assertEqual(
            [row["code"] for row in clutch_hard_fails(measured)],
            ["female-connector-has-no-room-for-a-stud"],
        )

    def test_material_standing_in_the_stud_volume_is_a_hard_fail(self) -> None:
        blocked = [
            *self.open_recess(),
            *quad((-2.0, 5.0, -2.0), (2.0, 5.0, -2.0), (2.0, 5.0, 2.0), (-2.0, 5.0, 2.0)),
        ]
        candidate = validate_candidate(
            clutch_candidate((-10.0, 0.0, -10.0), (10.0, 8.0, 10.0), [(0.0, 8.0, 0.0)])
        )
        measured = measure_clutch_room(candidate, blocked, 0.5)
        self.assertGreater(float(measured["maximumIntrusionLdu"]), CLUTCH_ROOM_TOLERANCE_LDU)
        self.assertEqual(measured["clutchesWithRoom"], 0)

    def test_the_tolerance_is_two_ldraw_sagittae_and_names_its_cause(self) -> None:
        self.assertAlmostEqual(LDRAW_INSCRIBED_SAGITTA_LDU, 0.1152883, places=6)
        self.assertAlmostEqual(CLUTCH_ROOM_TOLERANCE_LDU, 2 * LDRAW_INSCRIBED_SAGITTA_LDU)

    def test_an_off_axis_clutch_normal_is_refused_rather_than_projected(self) -> None:
        candidate = validate_candidate(
            {
                **clutch_candidate((-10.0, 0.0, -10.0), (10.0, 8.0, 10.0), [(0.0, 8.0, 0.0)]),
                "connectors": [
                    {
                        "kind": "undersideClutch",
                        "gender": "female",
                        "positionLdu": [0.0, 8.0, 0.0],
                        "normal": [0.6, 0.8, 0.0],
                    }
                ],
            }
        )
        with self.assertRaisesRegex(ValueError, "is not an axis"):
            measure_clutch_room(candidate, self.open_recess(), 1.0)


class SymmetryTests(unittest.TestCase):
    def test_a_symmetry_is_a_turn_with_no_scale(self) -> None:
        point = (Fraction(3), Fraction(5), Fraction(7))
        self.assertEqual(apply_symmetry("turn0", ZERO, point), point)
        self.assertEqual(
            apply_symmetry("turn180", (Fraction(4), Fraction(0), Fraction(0)), point),
            (Fraction(1), Fraction(5), Fraction(-7)),
        )


if __name__ == "__main__":
    unittest.main()
