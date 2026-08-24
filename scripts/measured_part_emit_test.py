"""TypeScript-emission tests for measured-part tables."""

from __future__ import annotations

import re
import unittest
from pathlib import Path

from measured_part_emit import (
    bundled_file_table,
    canonical_typescript,
    enforce_generated_check,
    number_literal,
    render_blueprints,
    render_bundled_sources,
    render_mesh_asset_aggregator,
    render_mesh_assets,
    render_render_only_blueprints,
)
from measured_part_plan import (
    ADMITTED_PART_PLANS,
    BUILDER_80015_CONNECTIVITY,
    BUNDLED_LDRAW_ARCHIVE_RECORD,
)
from measured_part_tables import (
    BUILDER_CONNECTIVITY_CONNECTOR_SOURCE,
    LDCAD_SHADOW_CONNECTOR_SOURCE,
)
from measured_part_test_support import (
    ARCHIVE_SHA256,
    BUILDER_RECORDS,
    SHADOW_IDENTITY,
    measured,
    plan,
    record,
    render_only,
)


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

    def test_append_only_e_shards_follow_d_without_rewriting_2877(self) -> None:
        mesh_aggregator = render_mesh_asset_aggregator()
        self.assertIn(
            'import { SET_6651557_MEASURED_MESH_ASSETS_D } from "./mesh-assets-6651557-measured-d.ts";',
            mesh_aggregator,
        )
        self.assertIn(
            'import { SET_6651557_MEASURED_MESH_ASSETS_E } from "./mesh-assets-6651557-measured-e.ts";',
            mesh_aggregator,
        )
        self.assertLess(
            mesh_aggregator.index("...SET_6651557_MEASURED_MESH_ASSETS_C"),
            mesh_aggregator.index("...SET_6651557_MEASURED_MESH_ASSETS_D"),
        )
        self.assertLess(
            mesh_aggregator.index("...SET_6651557_MEASURED_MESH_ASSETS_D"),
            mesh_aggregator.index("...SET_6651557_MEASURED_MESH_ASSETS_E"),
        )
        self.assertLess(
            mesh_aggregator.index("...SET_6651557_MEASURED_MESH_ASSETS_E"),
            mesh_aggregator.index("...SET_6651557_RENDER_ONLY_MESH_ASSETS"),
        )

        blueprint_aggregator = render_blueprints(
            [measured()],
            ARCHIVE_SHA256,
            BUILDER_RECORDS,
            SHADOW_IDENTITY,
            export_name="SET_6651557_MEASURED_BLUEPRINTS_D",
            appended_shard=(
                "SET_6651557_MEASURED_BLUEPRINTS_E",
                "./part-blueprints-6651557-measured-e.ts",
            ),
        )
        self.assertIn(
            'import { SET_6651557_MEASURED_BLUEPRINTS_E } from "./part-blueprints-6651557-measured-e.ts";',
            blueprint_aggregator,
        )
        self.assertLess(
            blueprint_aggregator.index('designId: "unit"'),
            blueprint_aggregator.index("...SET_6651557_MEASURED_BLUEPRINTS_E"),
        )

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
        self.assertIn("exactBodyBoundsLdu:", rendered)
        self.assertIn("sourceStudSeatsLdu: []", rendered)
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
                "mesh-assets-6651557-measured-d.ts",
                "mesh-assets-6651557-measured-e.ts",
                "mesh-assets-6651557-render-only.ts",
            ],
        )
        blueprint_chunks = sorted(catalog.glob("part-blueprints-6651557-measured*.ts"))
        self.assertEqual(
            [path.name for path in blueprint_chunks],
            [
                "part-blueprints-6651557-measured-d.ts",
                "part-blueprints-6651557-measured-e.ts",
                "part-blueprints-6651557-measured.ts",
            ],
        )
        admitted_ids = [row.design_id for row in ADMITTED_PART_PLANS]
        mesh_ids = {
            path.name: re.findall(
                r'^    "ldraw:official:([^"]+)\.dat": \{$',
                path.read_text(encoding="utf-8"),
                re.MULTILINE,
            )
            for path in mesh_chunks
        }
        blueprint_ids = {
            path.name: re.findall(
                r'^    designId: "([^"]+)",$',
                path.read_text(encoding="utf-8"),
                re.MULTILINE,
            )
            for path in blueprint_chunks
        }
        self.assertEqual(
            mesh_ids["mesh-assets-6651557-measured-c.ts"],
            admitted_ids[9:18],
        )
        self.assertEqual(mesh_ids["mesh-assets-6651557-measured-d.ts"], ["2877"])
        self.assertEqual(mesh_ids["mesh-assets-6651557-measured-e.ts"], ["3040"])
        self.assertEqual(
            blueprint_ids["part-blueprints-6651557-measured.ts"],
            admitted_ids[:18],
        )
        self.assertEqual(
            blueprint_ids["part-blueprints-6651557-measured-d.ts"],
            ["2877"],
        )
        self.assertEqual(
            blueprint_ids["part-blueprints-6651557-measured-e.ts"],
            ["3040"],
        )
        generated = [
            *mesh_chunks,
            *blueprint_chunks,
            catalog / "mesh-assets-6651557.ts",
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


if __name__ == "__main__":
    unittest.main(verbosity=2)
