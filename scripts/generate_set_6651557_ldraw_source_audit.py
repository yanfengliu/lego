from __future__ import annotations

import argparse
import hashlib
import json
import os
import tempfile
from pathlib import Path

from ldraw_source_archive import (
    LDrawSourceLibrary,
    SourceRecord,
    VerifiedArchive,
    canonical_bytes,
    sha256_prefixed,
)
from set_6651557_ldraw_source_audit_plan import (
    ARCHIVE_PINS,
    EXPECTED_AUDIT_COUNTS,
    REQUIRED_LEAF_IDS,
    REQUIRED_LEAF_SET_SHA256,
    SOURCE_AUDIT_PLAN,
)


REPOSITORY_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_SOURCE_AUDIT = (
    REPOSITORY_ROOT
    / "packages/catalog/src/quarantine/set-6651557-ldraw-source-audit.generated.json"
)


def id_set_sha256(ids: list[str] | tuple[str, ...]) -> str:
    payload = json.dumps(sorted(ids), separators=(",", ":")).encode("utf-8")
    return sha256_prefixed(payload)


def source_file_id(record: SourceRecord) -> str:
    return f"{record.archive_id}:{record.path}"


def root_presence(library: LDrawSourceLibrary, path: str) -> list[str]:
    return [
        archive_id
        for archive_id in library.precedence
        if library.archives[archive_id].contains(path)
    ]


def audit_unresolved_route(
    library: LDrawSourceLibrary, route: dict[str, object]
) -> dict[str, object]:
    design_id = str(route["designId"])
    for path in route["exactPathsRequiredAbsent"]:
        presence = root_presence(library, str(path))
        if presence:
            raise ValueError(
                f"Unresolved {design_id} now has {path} in {presence}; review and replace its unresolved route"
            )
    candidates = []
    for candidate in route["reviewedCandidates"]:
        archive_id = str(candidate["archiveId"])
        path = str(candidate["path"])
        library.exact(archive_id, path)
        record = library.record((archive_id, path))
        candidates.append(
            {
                "archiveId": archive_id,
                "path": path,
                "bytes": record.byte_length,
                "sha256": record.sha256,
                "title": record.title,
                "author": record.author,
                "ldrawOrg": record.ldraw_org,
                "licenseExpression": record.license_expression,
                "resolutionDecision": "reviewed-not-proven-equivalent",
            }
        )
    return {
        "recordType": "leaf-route",
        "designId": design_id,
        "state": "unresolved-source-route",
        "reason": route["reason"],
        "catalogAdmitted": False,
        "frame": {
            "status": "blocked-by-unresolved-source-identity",
            "catalogFrameClaimed": False,
        },
        "reviewedCandidates": candidates,
        "evidence": route["evidence"],
    }


def audit_resolved_route(
    library: LDrawSourceLibrary, route: dict[str, object]
) -> tuple[dict[str, object], list[SourceRecord]]:
    design_id = str(route["designId"])
    archive_id = str(route["archiveId"])
    path = str(route["path"])
    identity_kind = str(route["identityKind"])
    if identity_kind == "exact-design-filename" and path != f"parts/{design_id}.dat":
        raise ValueError(f"Exact route {design_id} points at non-exact path {path}")
    root_key = library.exact(archive_id, path)
    root_text = library.text(root_key)
    evidence_line = route.get("identityEvidenceLine")
    if evidence_line is not None and root_text.splitlines().count(str(evidence_line)) != 1:
        raise ValueError(
            f"{design_id} identity evidence line must occur exactly once in {archive_id}:{path}"
        )
    root = library.record(root_key)
    if archive_id == "official" and root.ldraw_org.startswith("Unofficial_"):
        raise ValueError(f"Official route {design_id} resolves to unofficial metadata")
    if archive_id == "unofficial" and not root.ldraw_org.startswith("Unofficial_"):
        raise ValueError(f"Unofficial route {design_id} lacks unofficial metadata")
    records = library.closure(root_key)
    identity: dict[str, object] = {
        "kind": identity_kind,
        "rootPresenceByArchivePrecedence": root_presence(library, path),
    }
    if evidence_line is not None:
        identity["evidenceLine"] = evidence_line
        identity["evidenceLineSha256"] = sha256_prefixed(str(evidence_line).encode("utf-8"))
    return (
        {
            "recordType": "leaf-route",
            "designId": design_id,
            "state": "ldraw-root-and-closure-resolved-not-admitted",
            "catalogAdmitted": False,
            "identity": identity,
            "rootFileId": source_file_id(root),
            "frame": {
                "status": "unverified-catalog-frame",
                "catalogFrameClaimed": False,
                "reason": "identity and source provenance do not establish the LDraw-to-catalog transform",
            },
        },
        records,
    )


def validate_plan() -> None:
    ids = [str(route["designId"]) for route in SOURCE_AUDIT_PLAN]
    if tuple(ids) != REQUIRED_LEAF_IDS or len(set(ids)) != 121:
        raise ValueError("Set 6651557 source-audit plan must contain the exact sorted 121 unique leaves")
    if id_set_sha256(ids) != REQUIRED_LEAF_SET_SHA256:
        raise ValueError("Set 6651557 source-audit plan differs from the coverage-ledger leaf digest")


def source_file_manifest(
    library: LDrawSourceLibrary, record: SourceRecord
) -> dict[str, object]:
    references = sorted(
        f"{archive_id}:{path}"
        for archive_id, path in library.dependencies((record.archive_id, record.path))
    )
    return {
        "fileId": source_file_id(record),
        **record.manifest_record(),
        "directReferences": references,
    }


def archive_manifest(library: LDrawSourceLibrary, pin: object) -> dict[str, object]:
    archive_id = str(getattr(pin, "archive_id"))
    archive = library.archives[archive_id]
    license_documents = []
    for document in getattr(pin, "license_documents"):
        path = str(getattr(document, "path"))
        data = archive.read(path)
        expected_bytes = int(getattr(document, "byte_length"))
        expected_sha256 = str(getattr(document, "sha256"))
        if len(data) != expected_bytes or sha256_prefixed(data) != f"sha256:{expected_sha256}":
            raise ValueError(f"{archive_id}:{path} differs from its pinned license document")
        license_documents.append(
            {
                "path": path,
                "bytes": expected_bytes,
                "sha256": f"sha256:{expected_sha256}",
            }
        )
    return {
        "archiveId": archive_id,
        "logicalName": str(getattr(pin, "logical_name")),
        "bytes": int(getattr(pin, "byte_length")),
        "sha256": f"sha256:{getattr(pin, 'sha256')}",
        "entryCount": int(getattr(pin, "entry_count")),
        "licenseDocuments": license_documents,
    }


def build_source_audit(official_path: Path, unofficial_path: Path) -> dict[str, object]:
    validate_plan()
    paths = {"official": official_path, "unofficial": unofficial_path}
    archives: list[VerifiedArchive] = []
    try:
        for pin in ARCHIVE_PINS:
            archives.append(VerifiedArchive(paths[pin.archive_id], pin))
    except BaseException:
        for archive in archives:
            archive.close()
        raise
    library = LDrawSourceLibrary(archives)
    parts: list[dict[str, object]] = []
    union: dict[tuple[str, str], SourceRecord] = {}
    try:
        for route in SOURCE_AUDIT_PLAN:
            if route["state"] == "unresolved-source-route":
                parts.append(audit_unresolved_route(library, route))
            else:
                entry, records = audit_resolved_route(library, route)
                parts.append(entry)
                for record in records:
                    union[(record.archive_id, record.path)] = record
        union_records = sorted(union.values(), key=lambda row: (row.archive_id, row.path))
        files = [source_file_manifest(library, record) for record in union_records]
        file_ids = {str(record["fileId"]) for record in files}
        missing_references = sorted(
            {
                str(reference)
                for record in files
                for reference in record["directReferences"]
                if reference not in file_ids
            }
        )
        if missing_references:
            raise ValueError(
                f"Source-audit graph references files outside resolved closures: {missing_references}"
            )
        archive_records = [archive_manifest(library, pin) for pin in ARCHIVE_PINS]
        library.verify_unchanged()
    finally:
        library.close()
    resolved = [
        part
        for part in parts
        if part["state"] == "ldraw-root-and-closure-resolved-not-admitted"
    ]
    unresolved = [part for part in parts if part["state"] == "unresolved-source-route"]
    exact_official = [
        part
        for part in resolved
        if str(part["rootFileId"]).startswith("official:")
        and part["identity"]["kind"] == "exact-design-filename"
    ]
    exact_unofficial = [
        part
        for part in resolved
        if str(part["rootFileId"]).startswith("unofficial:")
        and part["identity"]["kind"] == "exact-design-filename"
    ]
    keyword = [
        part
        for part in resolved
        if part["identity"]["kind"] == "header-keyword-cross-catalog"
    ]
    summary = {
        "requiredLeaves": len(parts),
        "resolvedRoutes": len(resolved),
        "unresolvedRoutes": len(unresolved),
        "officialExactRoots": len(exact_official),
        "unofficialExactRoots": len(exact_unofficial),
        "officialKeywordMappings": len(keyword),
        "uniqueClosureSourceFiles": len(union_records),
        "uniqueClosureSourceBytes": sum(record.byte_length for record in union_records),
    }
    if summary != EXPECTED_AUDIT_COUNTS:
        raise ValueError(
            f"LDraw source-audit summary drifted: {summary}; expected {EXPECTED_AUDIT_COUNTS}"
        )
    header = {
        "recordType": "source-audit-header",
        "schemaVersion": "lego.set-6651557-ldraw-source-audit/1",
        "admissionState": "blocked-unresolved-parts",
        "authority": {
            "kind": "ldraw-source-resolution-only",
            "catalogAdmitted": False,
            "runtimeExposed": False,
            "identitySelfCertified": False,
            "geometrySelfCertified": False,
            "partDefinitionsEmitted": False,
            "publicCatalogExported": False,
            "runtimeFetchAllowed": False,
            "connectorTruthClaimed": False,
            "collisionTruthClaimed": False,
            "catalogFramesClaimed": False,
        },
        "archives": archive_records,
        "referenceLayerPolicy": {
            "official": ["official"],
            "unofficial": ["unofficial", "official"],
        },
        "requiredLeafSetSha256": REQUIRED_LEAF_SET_SHA256,
        "summary": summary,
        "partRecordsSha256": sha256_prefixed(canonical_bytes(parts)),
        "fileRecordsSha256": sha256_prefixed(canonical_bytes(files)),
        "serialization": "canonical compact UTF-8 JSON object with sorted keys and LF termination",
    }
    return {"files": files, "header": header, "parts": parts}


def render_source_audit(document: dict[str, object]) -> bytes:
    return canonical_bytes(document) + b"\n"


def write_atomic(path: Path, data: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    descriptor, temporary = tempfile.mkstemp(prefix=f".{path.name}.", dir=path.parent)
    temporary_path = Path(temporary)
    try:
        with os.fdopen(descriptor, "wb") as stream:
            stream.write(data)
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary_path, path)
    finally:
        temporary_path.unlink(missing_ok=True)


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Audit pinned LDraw archives and generate the quarantined set-6651557 source audit."
    )
    parser.add_argument("--official", type=Path, required=True)
    parser.add_argument("--unofficial", type=Path, required=True)
    parser.add_argument("--audit", type=Path, default=DEFAULT_SOURCE_AUDIT)
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--check", action="store_true")
    mode.add_argument("--write", action="store_true")
    args = parser.parse_args()
    document = build_source_audit(args.official, args.unofficial)
    generated = render_source_audit(document)
    audit = args.audit.resolve()
    if args.check:
        if not audit.is_file():
            raise FileNotFoundError(f"Generated source audit is missing: {audit}")
        actual = audit.read_bytes()
        if actual != generated:
            raise ValueError(
                f"Generated source audit is stale: {audit} has {len(actual)} bytes/{sha256_prefixed(actual)}, "
                f"expected {len(generated)} bytes/{sha256_prefixed(generated)}; rerun with --write and review the evidence diff"
            )
    else:
        write_atomic(audit, generated)
    print(
        json.dumps(
            {
                "audit": str(audit),
                "bytes": len(generated),
                "sha256": sha256_prefixed(generated),
                "summary": document["header"]["summary"],
            },
            indent=2,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
