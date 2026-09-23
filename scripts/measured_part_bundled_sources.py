"""Render append-only bundled LDraw source attribution and closure tables."""

from __future__ import annotations

from typing import Sequence

from ldraw_source_archive import SourceRecord, canonical_bytes, sha256_prefixed
from measured_part_bundled_source_order import BUNDLED_LDRAW_SOURCE_PATH_PREFIX
from measured_part_emit_headers import GENERATED_HEADER
from measured_part_tables import MeasuredPart, RenderOnlyPart
from measured_part_typescript_literals import string_literal

MeshTablePart = MeasuredPart | RenderOnlyPart


def bundled_file_table(
    parts: Sequence[MeshTablePart],
    preserved_path_prefix: Sequence[str] = (),
) -> tuple[list[SourceRecord], dict[str, list[int]]]:
    """Every closure file, with an immutable historical prefix and sorted append."""

    records: dict[str, SourceRecord] = {}
    for part in parts:
        for record in part.closure:
            existing = records.get(record.path)
            if existing is not None and existing.sha256 != record.sha256:
                raise ValueError(
                    f"LDraw file {record.path} resolves to {record.sha256} for "
                    f"{part.plan.design_id} and {existing.sha256} elsewhere; one bundled path "
                    "cannot carry two different files."
                )
            records[record.path] = record
    if len(set(preserved_path_prefix)) != len(preserved_path_prefix):
        raise ValueError("The preserved bundled-source path prefix contains duplicate paths.")
    missing_prefix_paths = [path for path in preserved_path_prefix if path not in records]
    if missing_prefix_paths:
        raise ValueError(
            "The measured closure set no longer contains preserved bundled-source paths "
            f"{missing_prefix_paths}; an additive admission may append source rows and may not "
            "drop or renumber historical attribution records."
        )
    preserved = set(preserved_path_prefix)
    appended_paths = sorted(path for path in records if path not in preserved)
    ordered_paths = [*preserved_path_prefix, *appended_paths]
    ordered = [records[path] for path in ordered_paths]
    index_by_path = {record.path: index for index, record in enumerate(ordered)}
    closures = {
        part.plan.design_id: sorted(index_by_path[record.path] for record in part.closure)
        for part in parts
    }
    return ordered, closures


def render_bundled_sources(
    parts: Sequence[MeshTablePart],
    archive: dict[str, object],
    *,
    preserved_path_prefix: Sequence[str] = BUNDLED_LDRAW_SOURCE_PATH_PREFIX,
) -> str:
    """Render per-file CC BY 4.0 attribution and exact closure manifests."""

    files, closures = bundled_file_table(parts, preserved_path_prefix)
    lines = [GENERATED_HEADER.format(archive_sha256=str(archive["sha256"]).split(":")[-1]), ""]
    lines.extend(
        [
            "/**",
            " * Per-file authorship and licence for every LDraw file whose geometry is",
            " * bundled, preserved rather than flattened. Reuse is not training: the mesh",
            " * provenance records "
            + chr(96)
            + "trainingUseAllowed: false"
            + chr(96)
            + " and this table is the",
            " * attribution the CC BY 4.0 licence requires.",
            " */",
            "export interface BundledLdrawSourceFile {",
            "  /** Path inside the official LDraw library, which is the file's identity. */",
            "  readonly path: string;",
            "  readonly bytes: number;",
            "  readonly sha256: " + chr(96) + "sha256:" + chr(36) + "{string}" + chr(96) + ";",
            "  readonly title: string;",
            "  readonly author: string;",
            "  readonly ldrawOrg: string;",
            "  readonly licenseExpression: string;",
            "}",
            "",
            f"/** Every file in the {len(parts)} bundled closures, deduplicated and append-ordered. */",
            "export const BUNDLED_LDRAW_SOURCE_FILES: readonly BundledLdrawSourceFile[] = "
            "Object.freeze([",
        ]
    )
    for record in files:
        lines.append("  // prettier-ignore")
        lines.append(
            "  { "
            f"path: {string_literal(record.path)}, "
            f"bytes: {record.byte_length}, "
            f"sha256: {string_literal(record.sha256)}, "
            f"title: {string_literal(record.title)}, "
            f"author: {string_literal(record.author)}, "
            f"ldrawOrg: {string_literal(record.ldraw_org)}, "
            f"licenseExpression: {string_literal(record.license_expression)} "
            "},"
        )
    lines.append("]);")
    lines.append("")
    lines.append("/** Which of those files each bundled part's exact closure references. */")
    lines.append(
        "export const BUNDLED_LDRAW_CLOSURES: Readonly<Record<string, readonly number[]>> = "
        "Object.freeze({"
    )
    for design_id, indices in closures.items():
        lines.append(
            f"  {string_literal(design_id)}: [{', '.join(str(index) for index in indices)}],"
        )
    lines.append("});")
    lines.append("")
    lines.append("export interface BundledLdrawClosureManifest {")
    lines.append("  readonly bytes: number;")
    lines.append(
        "  readonly manifestSha256: " + chr(96) + "sha256:" + chr(36) + "{string}" + chr(96) + ";"
    )
    lines.append("}")
    lines.append("")
    lines.append("/** Canonical full-record digest and byte count for each exact closure. */")
    lines.append(
        "export const BUNDLED_LDRAW_CLOSURE_MANIFESTS: "
        "Readonly<Record<string, BundledLdrawClosureManifest>> = Object.freeze({"
    )
    for part in parts:
        manifest = [record.manifest_record() for record in part.closure]
        lines.append(
            f"  {string_literal(part.plan.design_id)}: {{ "
            f"bytes: {sum(record.byte_length for record in part.closure)}, "
            f"manifestSha256: {string_literal(sha256_prefixed(canonical_bytes(manifest)))} "
            "},"
        )
    lines.append("});")
    lines.append("")
    lines.append("/** The archive the files above were read from, byte-pinned. */")
    lines.append("export const BUNDLED_LDRAW_ARCHIVE = Object.freeze({")
    for key in ("archiveId", "source", "version"):
        lines.append(f"  {key}: {string_literal(str(archive[key]))},")
    lines.append(f"  bytes: {int(archive['bytes'])},")  # type: ignore[arg-type]
    lines.append(f"  sha256: {string_literal(str(archive['sha256']))},")
    lines.append("});")
    return "\n".join(lines) + "\n"
