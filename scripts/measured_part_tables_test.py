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
from pathlib import Path

from ldraw_source_archive import SourceRecord
from ldraw_surface_expander import ExpandedTriangle
from measured_part_emit import (
    canonical_typescript,
    enforce_generated_check,
    bundled_file_table,
    number_literal,
    render_blueprints,
    render_bundled_sources,
    render_mesh_assets,
    render_render_only_blueprints,
)
from measured_part_plan import (
    ADMITTED_PART_PLANS,
    BUILDER_80015_CONNECTIVITY,
    BUNDLED_LDRAW_ARCHIVE_RECORD,
    RENDER_ONLY_PART_PLANS,
)
from measured_part_tables import (
    BUILDER_CONNECTIVITY_CONNECTOR_SOURCE,
    LDCAD_SHADOW_CONNECTOR_SOURCE,
    MeasuredPart,
    MeasuredPartPlan,
    RenderOnlyPart,
    RenderOnlyPartPlan,
    exact_decimal_text,
    frame_box,
    frame_point,
    measured_part_report_row,
    merged_mesh,
    require_front_side_surface,
)
from measured_stud_tables import compile_measured_stud_rows, require_matching_stud_frames
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
            corner_normals=(((0.0, -1.0, 0.0),) * 3,),
        ),
        "positions_ldu": (0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 1.0),
        "normals_asset_local": (0.0, -1.0, 0.0) * 3,
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


def render_only(**overrides: object) -> RenderOnlyPart:
    render_plan = RenderOnlyPartPlan(
        design_id="render-unit",
        ldraw_path="parts/render-unit.dat",
        family="cheese-slope",
        width_studs=1,
        length_studs=1,
        variant=None,
        height_ldu=16,
        orientation_id="upright-yaw-0",
        translation_ldu=(0, 8, 0),
    )
    fields: dict[str, object] = {
        "plan": render_plan,
        "surface": MeasuredSurface(
            design_id="render-unit",
            triangles=(((0.0, 0.0, 0.0), (1.0, 0.0, 0.0), (0.0, 0.0, 1.0)),),
            roles=(BODY_ROLE,),
            corner_normals=(((0.0, -1.0, 0.0),) * 3,),
        ),
        "positions_ldu": (0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 1.0),
        "normals_asset_local": (0.0, -1.0, 0.0) * 3,
        "indices": (0, 1, 2),
        "body_triangle_count": 1,
        "stud_triangle_count": 0,
        "exact_body_bounds": (("-10", "-7.6", "-10"), ("10", "8", "10")),
        "exact_bounds": (("-10", "-7.6", "-10"), ("10", "8", "10")),
        "source_stud_seats_ldu": (),
        "root": record("parts/render-unit.dat", "sha256:44"),
        "closure": (record("parts/render-unit.dat", "sha256:44"),),
    }
    fields.update(overrides)
    return RenderOnlyPart(**fields)  # type: ignore[arg-type]


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
        # The body triangle is emitted first, so its (2, 0, 0) corner is vertex 1.
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

        self.assertIn(ARCHIVE_SHA256, rendered)
        self.assertIn("scripts/emit-measured-part-tables.py", rendered)
        self.assertIn("--pilot <set-6651557-source-pilot.json>", rendered)
        self.assertIn("--builder-frame <set-6651557-builder-ldraw-frame.json>", rendered)

    def test_check_mode_refuses_a_canonical_generated_file_drift(self) -> None:
        with self.assertRaisesRegex(SystemExit, "do not reproduce.*mesh-assets-6651557"):
            enforce_generated_check(["packages/catalog/src/mesh-assets-6651557.ts"])
        enforce_generated_check([])

    def test_generated_typescript_uses_the_workspace_pinned_formatter(self) -> None:
        repository = Path(__file__).resolve().parents[1]
        formatted = canonical_typescript(
            repository,
            repository / "packages/catalog/src/example-generated.ts",
            "export const value={items:[1,2]};\n",
        )
        self.assertEqual(formatted, "export const value = { items: [1, 2] };\n")

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

    def test_a_builder_connectivity_part_emits_the_seven_seat_evidence(self) -> None:
        rendered = render_blueprints(
            [
                measured(
                    plan=plan(
                        connector_source=BUILDER_CONNECTIVITY_CONNECTOR_SOURCE,
                        builder_connectivity_fact=BUILDER_80015_CONNECTIVITY,
                    )
                )
            ],
            ARCHIVE_SHA256,
            BUILDER_RECORDS,
            SHADOW_IDENTITY,
        )

        self.assertIn("builderConnectivitySource: {", rendered)
        self.assertIn(
            'normalizedClutchOffsetsSha256: "sha256:0e77ae20bce268bcde610fa8d2b34fa2e91a0c3a0132e298e933433591e8f0d5"',
            rendered,
        )
        self.assertIn("positionLdu: [30, -70]", rendered)
        self.assertIn("positionLdu: [70, -30]", rendered)
        self.assertNotIn("builderSource: {", rendered)
        self.assertNotIn("ldcadShadowSource", rendered)

    def test_a_variant_is_omitted_rather_than_emitted_as_undefined(self) -> None:
        rendered = render_blueprints([measured()], ARCHIVE_SHA256, BUILDER_RECORDS, SHADOW_IDENTITY)

        self.assertNotIn("variant:", rendered)

    def test_a_reviewed_stud_profile_is_emitted_only_when_the_plan_names_it(self) -> None:
        legacy = render_blueprints(
            [measured()], ARCHIVE_SHA256, BUILDER_RECORDS, SHADOW_IDENTITY
        )
        profiled = render_blueprints(
            [
                measured(
                    plan=plan(
                        validated_connection_stud_profile="nominal-stud-tube/1"
                    )
                )
            ],
            ARCHIVE_SHA256,
            BUILDER_RECORDS,
            SHADOW_IDENTITY,
        )

        self.assertNotIn("validatedConnectionStudProfile", legacy)
        self.assertIn(
            'validatedConnectionStudProfile: "nominal-stud-tube/1"', profiled
        )

    def test_render_only_emission_has_no_connector_collision_or_allowance_authority(self) -> None:
        rendered = render_render_only_blueprints([render_only()], ARCHIVE_SHA256)

        self.assertIn('designId: "render-unit"', rendered)
        self.assertIn('exactBodyBoundsLdu:', rendered)
        self.assertIn('sourceStudSeatsLdu: []', rendered)
        for forbidden in (
            "connectorSource",
            "connectors:",
            "clutchesLdu",
            "bodyBoxesLdu",
            "collision",
            "allowance",
            "builderSource",
            "ldcadShadowSource",
        ):
            self.assertNotIn(forbidden, rendered)

    def test_emission_report_schema_distinguishes_render_only_and_profile_authority(self) -> None:
        repository = Path(__file__).resolve().parents[1]
        driver = (repository / "scripts/emit-measured-part-tables.py").read_text(encoding="utf-8")

        self.assertIn(
            'REPORT_SCHEMA_VERSION = "lego.measured-part-admission-emission/4"',
            driver,
        )
        self.assertIn('"fullMeasuredParts": len(measured_parts)', driver)
        self.assertIn('"renderOnlyParts": len(render_only_parts)', driver)

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

    def test_generated_catalog_modules_stay_below_the_hard_file_ceiling(self) -> None:
        catalog = Path(__file__).resolve().parents[1] / "packages/catalog/src"
        mesh_chunks = sorted(catalog.glob("mesh-assets-6651557-*.ts"))
        self.assertEqual(
            [path.name for path in mesh_chunks],
            [
                "mesh-assets-6651557-measured-a.ts",
                "mesh-assets-6651557-measured-b.ts",
                "mesh-assets-6651557-measured-c.ts",
                "mesh-assets-6651557-render-only.ts",
            ],
        )
        generated = [
            *mesh_chunks,
            catalog / "mesh-assets-6651557.ts",
            catalog / "part-blueprints-6651557-measured.ts",
            catalog / "part-blueprints-6651557-render-only.ts",
            catalog / "ldraw-bundled-sources-6651557.ts",
        ]
        line_counts = {
            path.name: len(path.read_text(encoding="utf-8").splitlines()) for path in generated
        }

        self.assertEqual(
            {name: count for name, count in line_counts.items() if count >= 1_000},
            {},
        )


class PlanTests(unittest.TestCase):
    def test_plan_refuses_an_unknown_validated_connection_stud_profile(self) -> None:
        with self.assertRaisesRegex(ValueError, "only admitted source-rounding normalization"):
            plan(validated_connection_stud_profile="invented-profile/1")

    def test_emission_report_uses_the_explicit_28802_catalog_identity(self) -> None:
        part = measured(
            plan=ADMITTED_PART_PLANS[13],
            studs_ldu=((0.0, 0.0, 0.0, 1.0, 1.0),) * 6,
            clutches_ldu=((0.0, 0.0, 0.0),) * 2,
            body_boxes_ldu=(0.0,) * (23 * 6),
            body_triangle_count=500,
            stud_triangle_count=118,
            closure=(record("parts/28802.dat", "sha256:11"),) * 19,
            shadow_files=("p/stud.dat", "p/stud2.dat", "p/stud3.dat", "parts/28802.dat"),
        )

        self.assertEqual(
            measured_part_report_row(part),
            {
                "designId": "28802",
                "catalogId": "builtin:bracket-1x2-1x4-rounded-bottom",
                "connectorSource": LDCAD_SHADOW_CONNECTOR_SOURCE,
                "studs": 6,
                "clutches": 2,
                "collisionBoxes": 23,
                "meshTriangles": 618,
                "closureFileCount": 19,
                "shadowFiles": [
                    "p/stud.dat",
                    "p/stud2.dat",
                    "p/stud3.dat",
                    "parts/28802.dat",
                ],
            },
        )

    def test_every_admitted_plan_has_a_distinct_catalog_identity(self) -> None:
        identities = [
            (row.family, row.width_studs, row.length_studs, row.variant)
            for row in ADMITTED_PART_PLANS
        ]

        self.assertEqual(len(identities), len(set(identities)))

    def test_admitted_source_roots_keep_their_position_and_connector_source(self) -> None:
        self.assertEqual(
            [row.design_id for row in ADMITTED_PART_PLANS],
            [
                "5092",
                "35480",
                "51739",
                "77844",
                "93273",
                "30357",
                "2450",
                "79491",
                "30503",
                "6106",
                "30565",
                "80015",
                "25269",
                "28802",
                "35787",
                "11253",
            ],
        )
        self.assertTrue(all(row.connector_source == "builder" for row in ADMITTED_PART_PLANS[:5]))
        self.assertTrue(
            all(
                row.connector_source == LDCAD_SHADOW_CONNECTOR_SOURCE
                for row in ADMITTED_PART_PLANS[5:11]
            )
        )
        self.assertEqual(
            ADMITTED_PART_PLANS[11].connector_source,
            BUILDER_CONNECTIVITY_CONNECTOR_SOURCE,
        )
        self.assertEqual(
            ADMITTED_PART_PLANS[12].connector_source,
            LDCAD_SHADOW_CONNECTOR_SOURCE,
        )
        self.assertEqual(
            (
                ADMITTED_PART_PLANS[13].connector_source,
                ADMITTED_PART_PLANS[13].catalog_id,
                ADMITTED_PART_PLANS[13].display_name,
            ),
            (
                LDCAD_SHADOW_CONNECTOR_SOURCE,
                "builtin:bracket-1x2-1x4-rounded-bottom",
                "Bracket 1 x 2 - 1 x 4 Rounded Bottom",
            ),
        )
        self.assertEqual(
            (
                ADMITTED_PART_PLANS[14].connector_source,
                ADMITTED_PART_PLANS[14].catalog_id,
                ADMITTED_PART_PLANS[14].display_name,
            ),
            (
                LDCAD_SHADOW_CONNECTOR_SOURCE,
                "builtin:tile-2x2-triangular",
                "Tile 2 x 2 Triangular",
            ),
        )
        self.assertEqual(
            (
                ADMITTED_PART_PLANS[15].connector_source,
                ADMITTED_PART_PLANS[15].catalog_id,
                ADMITTED_PART_PLANS[15].display_name,
                ADMITTED_PART_PLANS[15].validated_connection_stud_profile,
            ),
            (
                LDCAD_SHADOW_CONNECTOR_SOURCE,
                "builtin:roller-skate",
                "Roller Skate",
                "nominal-stud-tube/1",
            ),
        )
        self.assertTrue(
            all(
                row.validated_connection_stud_profile is None
                for row in ADMITTED_PART_PLANS[:15]
            )
        )

    def test_11253_report_retains_the_reviewed_stud_profile(self) -> None:
        row = measured_part_report_row(
            measured(plan=ADMITTED_PART_PLANS[15])
        )

        self.assertEqual(
            row["validatedConnectionStudProfile"], "nominal-stud-tube/1"
        )

    def test_render_only_roots_are_distinct_and_cannot_name_a_connector_source(self) -> None:
        self.assertEqual(
            [row.design_id for row in RENDER_ONLY_PART_PLANS],
            [
                "41770a",
                "41769a",
                "43723a",
                "43722a",
                "54383",
                "3659",
                "3455",
                "11477",
                "50950",
                "61678",
                "54200",
                "85984",
            ],
        )
        self.assertTrue(
            all(not hasattr(row, "connector_source") for row in RENDER_ONLY_PART_PLANS)
        )
        self.assertEqual(
            len({(row.family, row.width_studs, row.length_studs, row.variant) for row in RENDER_ONLY_PART_PLANS}),
            len(RENDER_ONLY_PART_PLANS),
        )


if __name__ == "__main__":
    unittest.main(verbosity=2)
