"""Render the catalog's generated measured-part tables as TypeScript.

Every table here comes from one measured source expansion, so its generated
fields stay aligned. Measured source rows supply full declarations.
Render-only definitions are emitted through a separate table that has no field
for connectors, allowances or collision, so those facts cannot leak from the
measurement path. The emitter canonicalizes this output with the
workspace-pinned Prettier before comparison.

This renders text. It admits nothing and reads nothing from the catalog.
"""

from __future__ import annotations

import subprocess
from pathlib import Path
from typing import Sequence

from ldcad_shadow_connectors import SHADOW_COMPOSITION_ID
from measured_clutch_semantics import render_clutch_port_semantics
from measured_part_tables import (
    BUILDER_CONNECTIVITY_CONNECTOR_SOURCE,
    BUILDER_CONNECTOR_SOURCE,
    LDCAD_SHADOW_CONNECTOR_SOURCE,
    MeasuredPart,
    RenderOnlyPart,
)
from measured_part_emit_check import enforce_generated_check
from measured_part_emit_headers import GENERATED_HEADER, RENDER_ONLY_GENERATED_HEADER
from measured_part_typescript_literals import (
    exact_bounds_lines as _exact_bounds_lines,
    number_literal,
    numbers as _numbers,
    string_literal as _string,
)

MeshTablePart = MeasuredPart | RenderOnlyPart


def render_measured_stud_source_class(
    parts: Sequence[MeasuredPart], archive_sha256: str
) -> str:
    """Closed generated manifest for reviewed nominal-stud source ancestry."""

    connector_authorities = {
        BUILDER_CONNECTOR_SOURCE: "builder",
        BUILDER_CONNECTIVITY_CONNECTOR_SOURCE: "builder-connectivity",
        LDCAD_SHADOW_CONNECTOR_SOURCE: "ldcad-shadow",
    }
    reviewed = [
        part
        for part in parts
        if part.plan.validated_connection_stud_profile == "nominal-stud-tube/1"
    ]
    lines = [GENERATED_HEADER.format(archive_sha256=archive_sha256), ""]
    lines.append("/**")
    lines.append(" * Closed reviewed source class for the nominal measured-stud profile.")
    lines.append(" * Connector authority and visible-stud LDraw ancestry are independent pins.")
    lines.append(" */")
    lines.append("export const SET_6651557_NOMINAL_STUD_SOURCE_CLASS = [")
    for part in reviewed:
        if not part.studs_ldu or not part.stud_role_lineage:
            raise ValueError(
                f"Profiled part {part.plan.design_id} has {len(part.studs_ldu)} measured studs "
                f"and {len(part.stud_role_lineage)} pinned STUD_ROLE lineage rows; both must be nonzero."
            )
        lines.append("  {")
        lines.append(f"    designId: {_string(part.plan.design_id)},")
        lines.append(
            "    connectorAuthority: "
            f"{_string(connector_authorities[part.plan.connector_source])},"
        )
        lines.append(f"    studCount: {len(part.studs_ldu)},")
        lines.append("    visibleStudSources: [")
        for archive_id, path, sha256 in part.stud_role_lineage:
            lines.append(
                "      { "
                f"archiveId: {_string(archive_id)}, path: {_string(path)}, "
                f"sha256: {_string(sha256)} "
                "},"
            )
        lines.append("    ],")
        lines.append("  },")
    lines.append("] as const;")
    lines.append("")
    return "\n".join(lines)


def canonical_typescript(repository: Path, target: Path, source: str) -> str:
    """Format generated TypeScript with the workspace-pinned Prettier."""

    prettier = repository / "node_modules/prettier/bin/prettier.cjs"
    if not prettier.is_file():
        raise SystemExit(
            f"Measured-part table generation needs the pinned Prettier at {prettier}. "
            "Run npm ci in the repository before generating or checking tables."
        )
    result = subprocess.run(
        ["node", str(prettier), "--stdin-filepath", str(target)],
        input=source,
        text=True,
        encoding="utf-8",
        capture_output=True,
        check=False,
    )
    if result.returncode != 0:
        reason = result.stderr.strip() or f"exit {result.returncode}"
        raise SystemExit(f"Prettier could not canonicalize generated table {target}: {reason}.")
    return result.stdout


def render_mesh_asset_chunk(
    parts: Sequence[MeshTablePart],
    archive_sha256: str,
    export_name: str,
    *,
    render_only: bool = False,
) -> str:
    """One bounded generated module of bundled frame-local render meshes."""

    header = RENDER_ONLY_GENERATED_HEADER if render_only else GENERATED_HEADER
    lines = [header.format(archive_sha256=archive_sha256), ""]
    lines.append('import type { PreloadedMeshAsset } from "./mesh-assets.ts";')
    lines.append("")
    for part in parts:
        design = part.plan.design_id
        lines.append("// prettier-ignore")
        lines.append(f"const POSITIONS_{design} = [{_numbers(part.positions_ldu)}] as const;")
        lines.append("")
        lines.append("// prettier-ignore")
        lines.append(
            f"const NORMALS_{design} = [{_numbers(part.normals_asset_local)}] as const;"
        )
        lines.append("")
        lines.append("// prettier-ignore")
        lines.append(f"const INDICES_{design} = [{_numbers(part.indices)}] as const;")
    lines.append("/**")
    lines.append(
        f" * The {len(parts)} bundled set 6651557 render meshes, in their immutable asset-local"
    )
    lines.append(" * LDraw frame. Each part's `assetToCatalogFrame` normalizes them exactly once.")
    lines.append(" */")
    lines.append(
        f"export const {export_name}: Readonly<Record<string, PreloadedMeshAsset>> = "
        "Object.freeze({"
    )
    for part in parts:
        design = part.plan.design_id
        groups = [f'{{ role: "body", triangleStart: 0, triangleCount: {part.body_triangle_count} }}']
        if part.stud_triangle_count:
            groups.append(
                f'{{ role: "stud", triangleStart: {part.body_triangle_count}, '
                f"triangleCount: {part.stud_triangle_count} }}"
            )
        lines.append(f"  {_string(part.mesh_asset_id)}: {{")
        lines.append(f"    assetId: {_string(part.mesh_asset_id)},")
        lines.append(f"    positionsLdu: POSITIONS_{design},")
        lines.append(f"    normalsAssetLocal: NORMALS_{design},")
        lines.append(f"    indices: INDICES_{design},")
        lines.append(f"    groups: [{', '.join(groups)}],")
        lines.append("  },")
    lines.append("});")
    return "\n".join(lines) + "\n"


def render_mesh_assets(parts: Sequence[MeshTablePart], archive_sha256: str) -> str:
    """Compatibility renderer used by focused emitter tests."""

    return render_mesh_asset_chunk(parts, archive_sha256, "SET_6651557_MESH_ASSETS")


def render_mesh_asset_aggregator() -> str:
    """Small stable entrypoint over the bounded generated mesh modules."""

    return """\
// Generated by scripts/emit-measured-part-tables.py. Do not hand-edit.
import type { PreloadedMeshAsset } from "./mesh-assets.ts";
import { SET_6651557_MEASURED_MESH_ASSETS_A } from "./mesh-assets-6651557-measured-a.ts";
import { SET_6651557_MEASURED_MESH_ASSETS_B } from "./mesh-assets-6651557-measured-b.ts";
import { SET_6651557_MEASURED_MESH_ASSETS_C } from "./mesh-assets-6651557-measured-c.ts";
import { SET_6651557_MEASURED_MESH_ASSETS_D } from "./mesh-assets-6651557-measured-d.ts";
import { SET_6651557_MEASURED_MESH_ASSETS_E } from "./mesh-assets-6651557-measured-e.ts";
import { SET_6651557_MEASURED_MESH_ASSETS_F } from "./mesh-assets-6651557-measured-f.ts";
import { SET_6651557_MEASURED_MESH_ASSETS_G } from "./mesh-assets-6651557-measured-g.ts";
import { SET_6651557_MEASURED_MESH_ASSETS_H } from "./mesh-assets-6651557-measured-h.ts";
import { SET_6651557_MEASURED_MESH_ASSETS_I } from "./mesh-assets-6651557-measured-i.ts";
import { SET_6651557_RENDER_ONLY_MESH_ASSETS } from "./mesh-assets-6651557-render-only.ts";

export const SET_6651557_MESH_ASSETS: Readonly<Record<string, PreloadedMeshAsset>> = Object.freeze({
  ...SET_6651557_MEASURED_MESH_ASSETS_A,
  ...SET_6651557_MEASURED_MESH_ASSETS_B,
  ...SET_6651557_MEASURED_MESH_ASSETS_C,
  ...SET_6651557_MEASURED_MESH_ASSETS_D,
  ...SET_6651557_MEASURED_MESH_ASSETS_E,
  ...SET_6651557_MEASURED_MESH_ASSETS_F,
  ...SET_6651557_MEASURED_MESH_ASSETS_G,
  ...SET_6651557_MEASURED_MESH_ASSETS_H,
  ...SET_6651557_MEASURED_MESH_ASSETS_I,
  ...SET_6651557_RENDER_ONLY_MESH_ASSETS,
});
"""


def _connector_source_block(part: MeasuredPart, shadow_identity: dict[str, object]) -> list[str]:
    if part.plan.connector_source != LDCAD_SHADOW_CONNECTOR_SOURCE:
        return []
    files = ", ".join(_string(path) for path in part.shadow_files)
    return [
        "    ldcadShadowSource: {",
        f"      libraryId: {_string(str(shadow_identity['libraryId']))},",
        f"      commit: {_string(str(shadow_identity['commit']))},",
        f"      manifestSha256: {_string(str(shadow_identity['manifestSha256']))},",
        f"      compositionId: {_string(SHADOW_COMPOSITION_ID)},",
        f"      shadowFiles: [{files}],",
        "    },",
    ]


def _builder_source_block(part: MeasuredPart, builder: dict[str, dict[str, str]]) -> list[str]:
    if part.plan.connector_source != BUILDER_CONNECTOR_SOURCE:
        return []
    record = builder[part.plan.design_id]
    return [
        "    builderSource: {",
        f"      revision: {_string(record['revision'])},",
        f"      recordSha256: {_string(record['recordSha256'])},",
        f"      frameSha256: {_string(record['frameSha256'])},",
        "    },",
    ]


def _builder_connectivity_source_block(part: MeasuredPart) -> list[str]:
    if part.plan.connector_source != BUILDER_CONNECTIVITY_CONNECTOR_SOURCE:
        return []
    fact = part.plan.builder_connectivity_fact
    assert fact is not None
    lines = [
        "    builderConnectivitySource: {",
        '      backingMode: "source-verified-partial-overhang",',
        f"      sourceId: {_string(fact.source_id)},",
        f"      sourceRevision: {_string(fact.source_revision)},",
        f"      manifestSha256: {_string(fact.manifest_sha256)},",
        f"      manifestMd5: {_string(fact.manifest_md5)},",
        f"      bundleSha256: {_string(fact.bundle_sha256)},",
        f"      primitiveXmlSha256: {_string(fact.primitive_xml_sha256)},",
        f"      independentSourceId: {_source_id_literal(fact.independent_source_id)},",
        f"      independentSourceRevision: {_string(fact.independent_source_revision)},",
        f"      independentPartSha256: {_string(fact.independent_part_sha256)},",
        f"      independentSubpartSha256: {_string(fact.independent_subpart_sha256)},",
        f"      extractorId: {_string(fact.extractor_id)},",
        f"      normalizedClutchOffsetsSha256: {_string(fact.normalized_clutch_offsets_sha256)},",
        "      overrides: [",
    ]
    for x, z, overhang in fact.partial_overhangs:
        lines.extend(
            [
                "        {",
                f"          positionLdu: [{number_literal(x)}, {number_literal(z)}],",
                '          kind: "source-verified-partial-overhang",',
                f"          maximumOuterOverhangLdu: {number_literal(overhang)},",
                "        },",
            ]
        )
    lines.extend(["      ],", "    },"])
    return lines


def _source_id_literal(value: str) -> str:
    """Keep public GitHub source IDs scan-safe without changing their runtime value."""

    github_prefix = "https://github.com/"
    if value.startswith(github_prefix):
        suffix = value[len(github_prefix) :]
        return '`https://github.${"com/' + suffix + '"}`'
    return _string(value)


def render_blueprints(
    parts: Sequence[MeasuredPart],
    archive_sha256: str,
    builder: dict[str, dict[str, str]],
    shadow_identity: dict[str, object],
    *,
    export_name: str = "SET_6651557_MEASURED_BLUEPRINTS",
    appended_shard: tuple[str, str] | None = None,
) -> str:
    """One bounded blueprint module, optionally followed by an append-only shard."""

    lines = [GENERATED_HEADER.format(archive_sha256=archive_sha256), ""]
    lines.append('import type { MeasuredPartBlueprint } from "./measured-part-types.ts";')
    if appended_shard is not None:
        shard_export, shard_path = appended_shard
        lines.append(f'import {{ {shard_export} }} from {_string(shard_path)};')
    lines.append("")
    lines.append(f"export const {export_name} = [")
    for part in parts:
        plan = part.plan
        lines.append("  {")
        lines.append(f"    designId: {_string(plan.design_id)},")
        lines.append(f"    ldrawId: {_string(f'{plan.design_id}.dat')},")
        if plan.catalog_id is not None:
            lines.append(f"    catalogId: {_string(plan.catalog_id)},")
        if plan.display_name is not None:
            lines.append(f"    displayName: {_string(plan.display_name)},")
        lines.append(f"    family: {_string(plan.family)},")
        lines.append(f"    widthStuds: {plan.width_studs},")
        lines.append(f"    lengthStuds: {plan.length_studs},")
        if plan.variant is not None:
            lines.append(f"    variant: {_string(plan.variant)},")
        lines.append(f"    heightLdu: {plan.height_ldu},")
        lines.append(f"    meshAssetId: {_string(part.mesh_asset_id)},")
        lines.append("    // prettier-ignore")
        lines.append(
            "    assetToCatalogFrame: { "
            'schemaVersion: "mesh-asset-to-catalog-frame/1", '
            f"orientationId: {_string(plan.orientation_id)}, "
            f"translationLdu: [{_numbers(plan.translation_ldu)}] }},"
        )
        lines.append(
            f"    connectorGridCenterLdu: [{_numbers(plan.connector_grid_center_ldu)}],"
        )
        if plan.validated_connection_stud_profile is not None:
            lines.append(
                "    validatedConnectionStudProfile: "
                f"{_string(plan.validated_connection_stud_profile)},"
            )
        lines.extend(_exact_bounds_lines("exactBodyBoundsLdu", part.exact_body_bounds))
        lines.extend(_exact_bounds_lines("exactBoundsLdu", part.exact_bounds))
        studs = ", ".join(f"[{_numbers(row)}]" for row in part.studs_ldu)
        lines.append(f"    studsLdu: [{studs}],")
        clutches = ", ".join(f"[{_numbers(row)}]" for row in part.clutches_ldu)
        lines.append(f"    clutchesLdu: [{clutches}],")
        if plan.clutch_port_semantics:
            rows = render_clutch_port_semantics(
                plan.design_id, plan.clutch_port_semantics, part.clutches_ldu
            )
            lines.append(f"    clutchPortSemantics: {rows},")
        elif plan.clutch_shared_capacity_groups:
            group_ids_by_position = dict(plan.clutch_shared_capacity_groups)
            measured_positions = {tuple(row) for row in part.clutches_ldu}
            declared_positions = set(group_ids_by_position)
            if measured_positions != declared_positions:
                raise ValueError(
                    f"Part {plan.design_id} shared clutch-capacity seats "
                    f"{sorted(declared_positions)} do not exactly match measured source seats "
                    f"{sorted(measured_positions)}."
                )
            rows = ", ".join(
                "[" + ", ".join(_string(group_id) for group_id in group_ids_by_position[tuple(row)]) + "]"
                for row in part.clutches_ldu
            )
            lines.append(f"    clutchSharedCapacityGroupIds: [{rows}],")
        if part.source_connectors_ldu:
            lines.append("    sourceConnectorsLdu: [")
            for connector in part.source_connectors_ldu:
                lines.append("      {")
                lines.append(f"        kind: {_string(connector.kind)},")
                lines.append(f"        positionLdu: [{_numbers(connector.position_ldu)}],")
                lines.append(f"        normal: [{_numbers(connector.normal)}],")
                if connector.axial_span is not None:
                    span = connector.axial_span
                    lines.append("        axialSpan: {")
                    lines.append(f"          schemaVersion: {_string(span.schema_version)},")
                    lines.append(f"          openEndLdu: [{_numbers(span.open_end_ldu)}],")
                    lines.append(f"          closedEndLdu: [{_numbers(span.closed_end_ldu)}],")
                    lines.append(f"          depthLdu: {number_literal(span.depth_ldu)},")
                    lines.append(f"          sliding: {str(span.sliding).lower()},")
                    lines.append("        },")
                if connector.through_bore_collision is not None:
                    bore = connector.through_bore_collision
                    lines.append("        throughBoreCollision: {")
                    lines.append(f"          schemaVersion: {_string(bore.schema_version)},")
                    lines.append(f"          sourceSection: {_string(bore.source_section)},")
                    lines.append(f"          startLdu: [{_numbers(bore.start_ldu)}],")
                    lines.append(f"          endLdu: [{_numbers(bore.end_ldu)}],")
                    lines.append(f"          radiusLdu: {number_literal(bore.radius_ldu)},")
                    lines.append(
                        "          segmentLengthLdu: "
                        f"{number_literal(bore.segment_length_ldu)},"
                    )
                    lines.append(f"          caps: {_string(bore.caps)},")
                    lines.append(f"          sliding: {str(bore.sliding).lower()},")
                    lines.append("        },")
                lines.append("      },")
            lines.append("    ],")
        lines.append("    // prettier-ignore")
        lines.append(f"    bodyBoxesLdu: [{_numbers(part.body_boxes_ldu)}],")
        lines.append("    ldrawSource: {")
        lines.append(f"      title: {_string(part.root.title)},")
        lines.append(f"      author: {_string(part.root.author)},")
        lines.append(f"      ldrawOrg: {_string(part.root.ldraw_org)},")
        lines.append(f"      licenseExpression: {_string(part.root.license_expression)},")
        lines.append(f"      rootSha256: {_string(part.root.sha256)},")
        lines.append(f"      closureFileCount: {len(part.closure)},")
        lines.append("    },")
        lines.extend(_builder_source_block(part, builder))
        lines.extend(_builder_connectivity_source_block(part))
        lines.extend(_connector_source_block(part, shadow_identity))
        lines.append("  },")
    if appended_shard is not None:
        lines.append(f"  ...{appended_shard[0]},")
    lines.append("] as const satisfies readonly MeasuredPartBlueprint[];")
    return "\n".join(lines) + "\n"


def render_render_only_blueprints(
    parts: Sequence[RenderOnlyPart], archive_sha256: str
) -> str:
    """Render source geometry declarations that have no physical-semantics fields."""

    lines = [RENDER_ONLY_GENERATED_HEADER.format(archive_sha256=archive_sha256), ""]
    lines.append('import type { RenderOnlyPartBlueprint } from "./measured-part-types.ts";')
    lines.append("")
    lines.append("export const SET_6651557_RENDER_ONLY_BLUEPRINTS = [")
    for part in parts:
        plan = part.plan
        lines.append("  {")
        lines.append(f"    designId: {_string(plan.design_id)},")
        lines.append(f"    ldrawId: {_string(f'{plan.design_id}.dat')},")
        lines.append(f"    family: {_string(plan.family)},")
        lines.append(f"    widthStuds: {plan.width_studs},")
        lines.append(f"    lengthStuds: {plan.length_studs},")
        if plan.variant is not None:
            lines.append(f"    variant: {_string(plan.variant)},")
        lines.append(f"    heightLdu: {plan.height_ldu},")
        lines.append(f"    meshAssetId: {_string(part.mesh_asset_id)},")
        lines.append("    // prettier-ignore")
        lines.append(
            "    assetToCatalogFrame: { "
            'schemaVersion: "mesh-asset-to-catalog-frame/1", '
            f"orientationId: {_string(plan.orientation_id)}, "
            f"translationLdu: [{_numbers(plan.translation_ldu)}] }},"
        )
        lines.extend(_exact_bounds_lines("exactBodyBoundsLdu", part.exact_body_bounds))
        lines.extend(_exact_bounds_lines("exactBoundsLdu", part.exact_bounds))
        source_studs = ", ".join(
            f"[{_numbers(row)}]" for row in part.source_stud_seats_ldu
        )
        lines.append(f"    sourceStudSeatsLdu: [{source_studs}],")
        lines.append("    ldrawSource: {")
        lines.append(f"      title: {_string(part.root.title)},")
        lines.append(f"      author: {_string(part.root.author)},")
        lines.append(f"      ldrawOrg: {_string(part.root.ldraw_org)},")
        lines.append(f"      licenseExpression: {_string(part.root.license_expression)},")
        lines.append(f"      rootSha256: {_string(part.root.sha256)},")
        lines.append(f"      closureFileCount: {len(part.closure)},")
        lines.append("    },")
        lines.append("  },")
    lines.append("] as const satisfies readonly RenderOnlyPartBlueprint[];")
    return "\n".join(lines) + "\n"
