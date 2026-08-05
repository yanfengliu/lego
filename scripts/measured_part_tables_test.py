"""Gate the measured-part table emitter on synthetic input, with no archive.

The pinned LDraw archives are 230 MB of local evidence, so a test that needs them
is a test nobody runs. What matters here is reproducible anyway without them: the
source-to-catalog frame is applied exactly once, the exact bound names the
measured value or refuses, the vertex merge keeps a position the renderer can
hold apart and drops one it cannot, and the emitted TypeScript is the shape the
catalog reads. The archive-backed half is proved by regenerating the committed
tables and diffing them, which is what the reproduction command in the file
header does.
"""

from __future__ import annotations

import unittest

from ldraw_source_archive import SourceRecord
from measured_part_emit import (
    bundled_file_table,
    number_literal,
    render_blueprints,
    render_bundled_sources,
    render_mesh_assets,
)
from measured_part_plan import ADMITTED_PART_PLANS, BUNDLED_LDRAW_ARCHIVE_RECORD
from measured_part_tables import (
    LDCAD_SHADOW_CONNECTOR_SOURCE,
    MeasuredPart,
    MeasuredPartPlan,
    exact_decimal_text,
    frame_box,
    frame_point,
    merged_mesh,
)
from part_admission_surface import BODY_ROLE, MeasuredSurface, STUD_ROLE

ARCHIVE_SHA256 = "6009f2e94204c4d3a63a4c812010b5c90bad8c5acb19b882c859fdac63734eae"
SHADOW_IDENTITY = {
    "libraryId": "ldcad-shadow-library",
    "commit": "15aa1e718b6a8da37d24fc7af5e52e262c041bfb",
    "manifestSha256": "sha256:668bc047a45e5560ff0fbbd69e9eb5adafab127781720bcb069a1554cb3f0c0f",
}
BUILDER_RECORDS = {
    "unit": {"revision": "A", "recordSha256": "sha256:ab", "frameSha256": "sha256:cd"}
}


def plan(**overrides: object) -> MeasuredPartPlan:
    fields: dict[str, object] = {
        "design_id": "unit",
        "ldraw_path": "parts/unit.dat",
        "family": "plate",
        "width_studs": 1,
        "length_studs": 2,
        "variant": None,
        "height_ldu": 8,
        "orientation_id": "upright-yaw-0",
        "translation_ldu": (0, -4, 0),
        "connector_grid_center_ldu": (0, 0),
        "connector_source": "builder",
    }
    fields.update(overrides)
    return MeasuredPartPlan(**fields)  # type: ignore[arg-type]


def record(path: str, digest: str) -> SourceRecord:
    return SourceRecord(
        archive_id="official",
        path=path,
        byte_length=10,
        sha256=digest,
        title="Unit",
        declared_name=path,
        author="Unit Author",
        ldraw_org="Part UPDATE 2026-01",
        license_expression="CC-BY-4.0",
    )


def measured(**overrides: object) -> MeasuredPart:
    fields: dict[str, object] = {
        "plan": plan(),
        "surface": MeasuredSurface(
            design_id="unit", triangles=(((0.0, 0.0, 0.0), (1.0, 0.0, 0.0), (0.0, 0.0, 1.0)),),
            roles=(BODY_ROLE,),
        ),
        "positions_ldu": (0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 1.0),
        "indices": (0, 1, 2),
        "body_triangle_count": 1,
        "stud_triangle_count": 0,
        "exact_body_bounds": (("-10", "-4", "-20"), ("10", "4", "20")),
        "exact_bounds": (("-10", "-8", "-20"), ("10", "4", "20")),
        "studs_ldu": ((0.0, -4.0, -10.0, 6.0, 4.0),),
        "clutches_ldu": ((0.0, 4.0, -10.0),),
        "body_boxes_ldu": (-10.0, -4.0, -20.0, 10.0, 4.0, 20.0),
        "root": record("parts/unit.dat", "sha256:11"),
        "closure": (record("parts/unit.dat", "sha256:11"), record("p/stud.dat", "sha256:22")),
        "shadow_files": ("p/stud.dat", "parts/unit.dat"),
        "candidate": {},
    }
    fields.update(overrides)
    return MeasuredPart(**fields)  # type: ignore[arg-type]


class FrameTests(unittest.TestCase):
    def test_quarter_turn_and_translation_are_applied_exactly_once(self) -> None:
        turned = plan(orientation_id="upright-yaw-90")

        self.assertEqual(frame_point((3.0, 5.0, 7.0), turned), (7.0, 1.0, -3.0))

    def test_a_turned_box_keeps_its_corners_ordered(self) -> None:
        low, high = frame_box((-1.0, 0.0, -2.0), (1.0, 8.0, 2.0), plan(orientation_id="upright-yaw-90"))

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
    def test_body_triangles_come_first_so_the_two_render_groups_are_contiguous(self) -> None:
        triangles = (
            ((0.0, 0.0, 0.0), (1.0, 0.0, 0.0), (0.0, 0.0, 1.0)),
            ((0.0, 0.0, 0.0), (2.0, 0.0, 0.0), (0.0, 0.0, 2.0)),
        )
        surface = MeasuredSurface(
            design_id="unit", triangles=triangles, roles=(STUD_ROLE, BODY_ROLE)
        )

        positions, indices, body, stud = merged_mesh(surface, plan())

        self.assertEqual((body, stud), (1, 1))
        # The body triangle is emitted first, so its (2, 0, 0) corner is vertex 1.
        self.assertEqual(positions[3:6], (2.0, 0.0, 0.0))
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
        )

        positions, indices, _, _ = merged_mesh(surface, plan())

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
        )

        positions, _, _, _ = merged_mesh(surface, plan())

        self.assertEqual(len(positions) // 3, 5)


class NumberLiteralTests(unittest.TestCase):
    def test_an_integral_coordinate_emits_as_an_integer(self) -> None:
        self.assertEqual(number_literal(-38.0), "-38")

    def test_a_measured_coordinate_keeps_its_shortest_round_trip_form(self) -> None:
        self.assertEqual(number_literal(-7.9530777189999995), "-7.9530777189999995")

    def test_a_non_finite_coordinate_is_refused(self) -> None:
        with self.assertRaises(ValueError):
            number_literal(float("inf"))


class RenderTests(unittest.TestCase):
    def test_a_mesh_asset_declares_its_stud_group_only_when_it_has_studs(self) -> None:
        without = render_mesh_assets([measured()], ARCHIVE_SHA256)
        with_studs = render_mesh_assets(
            [measured(body_triangle_count=4, stud_triangle_count=2)], ARCHIVE_SHA256
        )

        self.assertIn('groups: [{ role: "body", triangleStart: 0, triangleCount: 1 }]', without)
        self.assertNotIn('role: "stud"', without)
        self.assertIn(
            'groups: [{ role: "body", triangleStart: 0, triangleCount: 4 }, '
            '{ role: "stud", triangleStart: 4, triangleCount: 2 }]',
            with_studs,
        )

    def test_the_header_names_the_command_that_reproduces_the_file(self) -> None:
        rendered = render_mesh_assets([measured()], ARCHIVE_SHA256)

        self.assertIn("scripts/emit-measured-part-tables.py", rendered)
        self.assertIn(ARCHIVE_SHA256, rendered)
        self.assertIn("npx prettier --write", rendered)

    def test_a_builder_part_declares_a_builder_source_and_no_shadow_source(self) -> None:
        rendered = render_blueprints(
            [measured()], ARCHIVE_SHA256, BUILDER_RECORDS, SHADOW_IDENTITY
        )

        self.assertIn("builderSource: {", rendered)
        self.assertNotIn("ldcadShadowSource", rendered)

    def test_a_shadow_part_declares_the_pinned_library_and_the_files_it_read(self) -> None:
        rendered = render_blueprints(
            [measured(plan=plan(connector_source=LDCAD_SHADOW_CONNECTOR_SOURCE))],
            ARCHIVE_SHA256,
            BUILDER_RECORDS,
            SHADOW_IDENTITY,
        )

        self.assertNotIn("builderSource", rendered)
        self.assertIn('commit: "15aa1e718b6a8da37d24fc7af5e52e262c041bfb"', rendered)
        self.assertIn('compositionId: "ldcad-shadow-composed-over-ldraw-tree/1"', rendered)
        self.assertIn('shadowFiles: ["p/stud.dat", "parts/unit.dat"]', rendered)

    def test_a_variant_is_omitted_rather_than_emitted_as_undefined(self) -> None:
        rendered = render_blueprints([measured()], ARCHIVE_SHA256, BUILDER_RECORDS, SHADOW_IDENTITY)

        self.assertNotIn("variant:", rendered)

    def test_the_bundled_file_table_deduplicates_and_indexes_by_path(self) -> None:
        shared = record("p/stud.dat", "sha256:22")
        first = measured(closure=(record("parts/a.dat", "sha256:aa"), shared))
        second = measured(
            plan=plan(design_id="other"), closure=(record("parts/b.dat", "sha256:bb"), shared)
        )

        files, closures = bundled_file_table([first, second])

        self.assertEqual([row.path for row in files], ["p/stud.dat", "parts/a.dat", "parts/b.dat"])
        self.assertEqual(closures, {"unit": [0, 1], "other": [0, 2]})

    def test_one_path_carrying_two_different_files_is_refused_by_name(self) -> None:
        first = measured(closure=(record("p/stud.dat", "sha256:22"),))
        second = measured(
            plan=plan(design_id="other"), closure=(record("p/stud.dat", "sha256:33"),)
        )

        with self.assertRaises(ValueError) as caught:
            bundled_file_table([first, second])

        self.assertIn("p/stud.dat", str(caught.exception))
        self.assertIn("sha256:33", str(caught.exception))

    def test_the_attribution_table_carries_every_file_and_the_pinned_archive(self) -> None:
        rendered = render_bundled_sources([measured()], BUNDLED_LDRAW_ARCHIVE_RECORD)

        self.assertIn('path: "p/stud.dat"', rendered)
        self.assertIn('author: "Unit Author"', rendered)
        self.assertIn('licenseExpression: "CC-BY-4.0"', rendered)
        self.assertIn('version: "ldraw-complete-2026-07"', rendered)
        self.assertIn("bytes: 144722356", rendered)


class PlanTests(unittest.TestCase):
    def test_every_admitted_plan_has_a_distinct_catalog_identity(self) -> None:
        identities = [
            (row.family, row.width_studs, row.length_studs, row.variant)
            for row in ADMITTED_PART_PLANS
        ]

        self.assertEqual(len(identities), len(set(identities)))

    def test_the_five_first_admission_parts_keep_their_position_and_frame(self) -> None:
        # Catalog order is part of the truth digest, so a new part is appended.
        # This is what turns "the roster moved" into a test failure here rather
        # than into a silently re-hashed catalog.
        self.assertEqual(
            [row.design_id for row in ADMITTED_PART_PLANS[:5]],
            ["5092", "35480", "51739", "77844", "93273"],
        )
        self.assertTrue(all(row.connector_source == "builder" for row in ADMITTED_PART_PLANS[:5]))
        self.assertTrue(
            all(
                row.connector_source == LDCAD_SHADOW_CONNECTOR_SOURCE
                for row in ADMITTED_PART_PLANS[5:]
            )
        )


if __name__ == "__main__":
    unittest.main(verbosity=2)
