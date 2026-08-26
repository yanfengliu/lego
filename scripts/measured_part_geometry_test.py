"""Frame, bound, mesh, and stud-row tests for measured-part tables."""

from __future__ import annotations

import unittest

from ldraw_surface_expander import ExpandedTriangle
from measured_part_plan import BUILDER_80015_CONNECTIVITY
from measured_part_tables import (
    BUILDER_CONNECTIVITY_CONNECTOR_SOURCE,
    LDCAD_SHADOW_CONNECTOR_SOURCE,
    _clamped_source_candidate,
    exact_decimal_text,
    frame_box,
    frame_point,
    merged_mesh,
    require_front_side_surface,
)
from measured_part_test_support import plan
from measured_stud_tables import compile_measured_stud_rows, require_matching_stud_frames
from part_admission_surface import BODY_ROLE, MeasuredSurface, STUD_ROLE


class MeasuredStudRowTests(unittest.TestCase):
    def test_a_side_stud_keeps_its_outward_frame_and_axis(self) -> None:
        candidate = {
            "connectors": [
                {"kind": "stud", "positionLdu": [0, 0, 0], "normal": [0, 0, -1]}
            ],
            "bodies": [
                {
                    "kind": "cylinder",
                    "tag": "stud",
                    "axis": "z",
                    "centerLdu": [0, 0, -2],
                    "radiusLdu": 6,
                    "heightLdu": 4,
                }
            ],
        }

        self.assertEqual(
            compile_measured_stud_rows(
                candidate,
                "side",
                lambda point: point,
                lambda normal: normal,
            ),
            ((0.0, 0.0, 0.0, 6.0, 4.0, 0.0, 0.0, -1.0),),
        )

    def test_shadow_and_visible_stud_frames_must_match_in_position_and_normal(self) -> None:
        shadow = [{"positionLdu": [0, 0, 0], "normal": [0, 0, -1]}]
        require_matching_stud_frames("side", shadow, list(shadow))
        with self.assertRaisesRegex(ValueError, "do not exactly match"):
            require_matching_stud_frames(
                "side",
                shadow,
                [{"positionLdu": [0, 0, 0], "normal": [0, -1, 0]}],
            )


class FrameTests(unittest.TestCase):
    def test_quarter_turn_and_translation_are_applied_exactly_once(self) -> None:
        turned = plan(orientation_id="upright-yaw-90")

        self.assertEqual(frame_point((3.0, 5.0, 7.0), turned), (7.0, 1.0, -3.0))

    def test_a_non_upright_proper_source_frame_is_applied_exactly_once(self) -> None:
        turned = plan(orientation_id="proper-m-p000n000n")

        self.assertEqual(frame_point((3.0, 5.0, 7.0), turned), (3.0, -9.0, -7.0))

    def test_a_turned_box_keeps_its_corners_ordered(self) -> None:
        low, high = frame_box(
            (-1.0, 0.0, -2.0),
            (1.0, 8.0, 2.0),
            plan(orientation_id="upright-yaw-90"),
        )

        self.assertEqual(low, (-2.0, -4.0, -1.0))
        self.assertEqual(high, (2.0, 4.0, 1.0))

    def test_an_unknown_orientation_names_the_frames_that_exist(self) -> None:
        with self.assertRaises(ValueError) as caught:
            plan(orientation_id="tilted")

        self.assertIn("tilted", str(caught.exception))
        self.assertIn("upright-yaw-90", str(caught.exception))

    def test_an_unknown_connector_source_names_the_admitted_ones(self) -> None:
        with self.assertRaises(ValueError) as caught:
            plan(connector_source="guessed")

        self.assertIn("guessed", str(caught.exception))
        self.assertIn(LDCAD_SHADOW_CONNECTOR_SOURCE, str(caught.exception))

    def test_boundary_only_columns_are_dropped_before_scoring_and_emission(self) -> None:
        candidate = {
            "derivation": "unit-height-field",
            "bodies": [
                {
                    "kind": "box",
                    "tag": "body",
                    "minLdu": [-1.0, 0.0, 10.0],
                    "maxLdu": [0.0, 0.001, 11.0],
                },
                {
                    "kind": "box",
                    "tag": "body",
                    "minLdu": [-1.0, 0.0, 9.0],
                    "maxLdu": [0.0, 1.0, 10.0],
                },
                {
                    "kind": "cylinder",
                    "tag": "stud",
                    "axis": "y",
                    "centerLdu": [0.0, -2.0, 0.0],
                    "radiusLdu": 6.0,
                    "heightLdu": 4.0,
                },
            ],
            "connectors": [],
        }

        clipped = _clamped_source_candidate(
            candidate,
            ((-10.0, 0.0, -10.0), (10.0, 8.0, 10.0)),
        )

        self.assertEqual(len(clipped["bodies"]), 2)
        self.assertEqual(clipped["bodies"][0]["maxLdu"], [0.0, 1.0, 10.0])
        self.assertEqual(clipped["bodies"][1]["kind"], "cylinder")
        self.assertIn("clipped to measured solid bounds", clipped["derivation"])

    def test_a_builder_connectivity_fact_is_required_exactly_for_its_source(self) -> None:
        with self.assertRaises(ValueError):
            plan(connector_source=BUILDER_CONNECTIVITY_CONNECTOR_SOURCE)
        with self.assertRaises(ValueError):
            plan(builder_connectivity_fact=BUILDER_80015_CONNECTIVITY)


class ExactBoundTests(unittest.TestCase):
    def test_an_integral_measurement_prints_without_a_fractional_part(self) -> None:
        self.assertEqual(exact_decimal_text(-38.0, "unit"), "-38")

    def test_a_measured_decimal_keeps_every_digit_it_needs(self) -> None:
        self.assertEqual(exact_decimal_text(-16.00016098, "unit"), "-16.00016098")
        self.assertEqual(exact_decimal_text(38.5, "unit"), "38.5")

    def test_a_tenth_fractional_digit_is_refused_by_name(self) -> None:
        with self.assertRaises(ValueError) as caught:
            exact_decimal_text(1.0123456789, "93273 body bounds min y")

        self.assertIn("93273 body bounds min y", str(caught.exception))
        self.assertIn("10 fractional digits", str(caught.exception))

    def test_a_coordinate_that_prints_in_exponent_form_is_refused(self) -> None:
        with self.assertRaises(ValueError) as caught:
            exact_decimal_text(1e-9, "unit min x")

        self.assertIn("unit min x", str(caught.exception))
        self.assertIn("plain decimal text", str(caught.exception))


class MeshMergeTests(unittest.TestCase):
    def test_front_side_admission_refuses_nocertify_and_noclip_semantics(self) -> None:
        base = {
            "points": ((0.0, 0.0, 0.0), (1.0, 0.0, 0.0), (0.0, 0.0, 1.0)),
            "corner_normals": ((0.0, -1.0, 0.0),) * 3,
            "role": BODY_ROLE,
            "ancestry": (("official", "parts/unit.dat"),),
            "source": ("official", "parts/unit.dat"),
            "line_number": 7,
        }
        for label, certified, cull_enabled in (
            ("BFC NOCERTIFY", False, True),
            ("BFC NOCLIP", True, False),
        ):
            with self.subTest(label=label), self.assertRaisesRegex(ValueError, label):
                require_front_side_surface(
                    "unit",
                    [
                        ExpandedTriangle(
                            **base,
                            certified=certified,
                            cull_enabled=cull_enabled,
                        )
                    ],
                )

    def test_body_triangles_come_first_so_the_two_render_groups_are_contiguous(self) -> None:
        triangles = (
            ((0.0, 0.0, 0.0), (1.0, 0.0, 0.0), (0.0, 0.0, 1.0)),
            ((0.0, 0.0, 0.0), (2.0, 0.0, 0.0), (0.0, 0.0, 2.0)),
        )
        surface = MeasuredSurface(
            design_id="unit",
            triangles=triangles,
            roles=(STUD_ROLE, BODY_ROLE),
            corner_normals=(((0.0, -1.0, 0.0),) * 3,) * 2,
        )

        positions, normals, indices, body, stud = merged_mesh(surface, plan())

        self.assertEqual((body, stud), (1, 1))
        self.assertEqual(positions[3:6], (2.0, 0.0, 0.0))
        self.assertEqual(normals[3:6], (0.0, -1.0, 0.0))
        self.assertEqual(indices[:3], (0, 1, 2))

    def test_two_corners_the_renderer_cannot_hold_apart_become_one_vertex(self) -> None:
        near = 1.0 + 1e-15
        surface = MeasuredSurface(
            design_id="unit",
            triangles=(
                ((0.0, 0.0, 0.0), (1.0, 0.0, 0.0), (0.0, 0.0, 1.0)),
                ((0.0, 0.0, 0.0), (near, 0.0, 0.0), (0.0, 0.0, 2.0)),
            ),
            roles=(BODY_ROLE, BODY_ROLE),
            corner_normals=(((0.0, -1.0, 0.0),) * 3,) * 2,
        )

        positions, _, indices, _, _ = merged_mesh(surface, plan())

        self.assertEqual(len(positions) // 3, 4)
        self.assertEqual(indices[3:6], (0, 1, 3))

    def test_two_corners_the_renderer_can_hold_apart_stay_two_vertices(self) -> None:
        surface = MeasuredSurface(
            design_id="unit",
            triangles=(
                ((0.0, 0.0, 0.0), (1.0, 0.0, 0.0), (0.0, 0.0, 1.0)),
                ((0.0, 0.0, 0.0), (1.001, 0.0, 0.0), (0.0, 0.0, 2.0)),
            ),
            roles=(BODY_ROLE, BODY_ROLE),
            corner_normals=(((0.0, -1.0, 0.0),) * 3,) * 2,
        )

        positions, _, _, _, _ = merged_mesh(surface, plan())

        self.assertEqual(len(positions) // 3, 5)

    def test_5092_route_noise_reuses_one_exact_position_across_hard_normal_islands(self) -> None:
        first = (2.7574, 8.0, -1.2426)
        route_alias = (2.7574, 8.0, -1.2426000000000001)
        surface = MeasuredSurface(
            design_id="5092",
            triangles=(
                (first, (0.0, 8.0, -4.0), (2.7574, 4.0, -1.2426)),
                (route_alias, (5.7574, 8.0, -4.2426), (2.7574, 4.0, -1.2426)),
            ),
            roles=(BODY_ROLE, BODY_ROLE),
            corner_normals=(
                ((0.0, 1.0, 0.0),) * 3,
                ((0.0, 0.0, 1.0),) * 3,
            ),
        )

        positions, _, indices, _, _ = merged_mesh(surface, plan(design_id="5092"))

        first_offset = indices[0] * 3
        alias_offset = indices[3] * 3
        self.assertNotEqual(indices[0], indices[3])
        self.assertEqual(positions[first_offset : first_offset + 3], first)
        self.assertEqual(positions[alias_offset : alias_offset + 3], first)

    def test_a_material_renderer_position_collapse_is_refused_instead_of_welded(self) -> None:
        surface = MeasuredSurface(
            design_id="unit",
            triangles=(
                ((1000.0, 0.0, 0.0), (0.0, 0.0, 0.0), (0.0, 0.0, 1.0)),
                ((1000.00001, 0.0, 0.0), (2.0, 0.0, 0.0), (0.0, 0.0, 2.0)),
            ),
            roles=(BODY_ROLE, BODY_ROLE),
            corner_normals=(
                ((0.0, 1.0, 0.0),) * 3,
                ((0.0, 0.0, 1.0),) * 3,
            ),
        )

        with self.assertRaisesRegex(ValueError, "materially collapse"):
            merged_mesh(surface, plan())


if __name__ == "__main__":
    unittest.main(verbosity=2)
