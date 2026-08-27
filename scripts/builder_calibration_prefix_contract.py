"""Recompute retained Builder source identities and role-bound anchor rows.

The caller supplies the current TypeScript source rows as untrusted JSON on
stdin. This module binds them to the ignored, digest-pinned Builder evidence and
returns only recomputed diagnostics. It grants no frame, placement, execution,
mutation, acceptance, replay, or completion authority.
"""

from __future__ import annotations

import hashlib
import json
import os
import stat
import sys
from pathlib import Path

from builder_ldraw_field import (
    ABSENT_FAMILY,
    FEMALE_FAMILIES,
    MALE_FAMILIES,
    MARKER_FAMILIES,
    TOP_FIELD_TYPE,
    UNDERSIDE_FIELD_TYPE,
    builder_field_nodes,
)

MAX_STDIN_BYTES = 2 * 1_024 * 1_024

EVIDENCE = {
    "manifest": (
        "manifest.json",
        18_766,
        "3e57aa4df4ab5327c5b8408912d056ba73b93cd98e769e41d6aabaf6cb0618a6",
    ),
    "cache": (
        "cache-report.json",
        93_314,
        "bf853ffadc349f43f13cf24c2f790a9bc556103c1c96fb24ad064aa502e475d8",
    ),
    "audit": (
        "audit-report.json",
        1_881_665,
        "ab85e95fa94267b19dd16a160d270e48bf752926697c893db01b0597e7a8f4c4",
    ),
    "nativePack": (
        "native-part-pack.json",
        2_069_952,
        "e5bb745faa79c5e7cb525eb0a11a8443815a0c4805c85644204b26c462ac636d",
    ),
}


def canonical_json(value: object) -> bytes:
    return json.dumps(value, separators=(",", ":"), ensure_ascii=True, allow_nan=False).encode()


def _verified_json(directory: Path, name: str) -> object:
    filename, expected_bytes, expected_digest = EVIDENCE[name]
    path = (directory / filename).resolve(strict=True)
    with path.open("rb") as stream:
        before = os.fstat(stream.fileno())
        if not stat.S_ISREG(before.st_mode) or before.st_size != expected_bytes:
            raise ValueError(
                f"Builder {name} evidence must be the exact {expected_bytes}-byte regular file; "
                f"received mode={before.st_mode} bytes={before.st_size}."
            )
        payload = stream.read(expected_bytes + 1)
        after = os.fstat(stream.fileno())
    actual = hashlib.sha256(payload).hexdigest()
    if (
        len(payload) != expected_bytes
        or after.st_size != before.st_size
        or actual != expected_digest
    ):
        raise ValueError(
            f"Builder {name} evidence is {len(payload)} bytes sha256:{actual}; expected "
            f"{expected_bytes} bytes sha256:{expected_digest}."
        )
    return json.loads(payload.decode("utf-8"))


def _one_by(rows: list[object], key) -> dict[str, dict[str, object]]:
    result: dict[str, dict[str, object]] = {}
    for candidate in rows:
        if not isinstance(candidate, dict):
            raise ValueError("Builder evidence contains a non-object record.")
        identity = key(candidate)
        if identity in result:
            raise ValueError(f"Builder evidence repeats record {identity}.")
        result[identity] = candidate
    return result


def _revision(value: str) -> tuple[str, str]:
    parts = value.split(";")
    if len(parts) != 2 or not parts[0].isdigit() or not parts[1]:
        raise ValueError(f"Builder design revision {value!r} is not DESIGN;REVISION.")
    return parts[0], parts[1]


def _framed_centers(nodes, label: str) -> list[list[int]]:
    centers: list[list[int]] = []
    for node in nodes:
        framed = (node.builder[0] * 25, -node.builder[1] * 25, -node.builder[2] * 25)
        if any(value.denominator != 1 for value in framed):
            raise ValueError(
                f"{label} node is not an exact whole-LDU center: "
                f"{[str(value) for value in framed]}."
            )
        centers.append([int(value) for value in framed])
    return sorted(centers)


def _anchor_node_sets(record: dict[str, object]):
    nodes = builder_field_nodes(record)
    authored_top = [
        node
        for node in nodes
        if node.field_type == TOP_FIELD_TYPE
        and node.family not in MARKER_FAMILIES
        and node.family != ABSENT_FAMILY
    ]
    authored_underside = [
        node
        for node in nodes
        if node.field_type == UNDERSIDE_FIELD_TYPE
        and node.family not in MARKER_FAMILIES
        and node.family != ABSENT_FAMILY
    ]
    recognized_top = [node for node in authored_top if node.family in MALE_FAMILIES]
    recognized_underside = [
        node for node in authored_underside if node.family in FEMALE_FAMILIES
    ]
    return recognized_top, recognized_underside, authored_top, authored_underside


def _eligible_anchor_nodes(record: dict[str, object]):
    recognized_top, recognized_underside, _, _ = _anchor_node_sets(record)
    return recognized_top, recognized_underside


def _anchor_centers(record: dict[str, object], role: str) -> list[list[int]]:
    top, underside, authored_top, authored_underside = _anchor_node_sets(record)
    if role == "builder-shell-to-catalog-ldraw-surface":
        if authored_top or authored_underside:
            raise ValueError(
                f"Builder record {record.get('id')} requests surface-only registration but "
                f"recomputes {len(authored_top)} authored top-field and "
                f"{len(authored_underside)} authored underside-field lattice nodes "
                f"({len(top)} recognized male, {len(underside)} recognized female). A "
                "caller-selected empty role cannot erase either a recognized or unmapped "
                "audited lattice."
            )
        return []
    if role == "top-field-to-catalog-stud":
        return _framed_centers(top, f"Builder record {record.get('id')} {role}")
    if role == "underside-field-to-catalog-clutch":
        return _framed_centers(underside, f"Builder record {record.get('id')} {role}")
    raise ValueError(f"Unknown Builder anchor role {role!r}.")


def _declared_design_ids(*records: dict[str, object] | None) -> list[str]:
    declared: set[str] = set()
    for record in records:
        if record is None:
            continue
        for key in ("Id", "id"):
            value = record.get(key)
            if isinstance(value, (str, int)) and str(value):
                declared.add(str(value))
        annotations = record.get("annotations")
        if isinstance(annotations, dict):
            aliases = annotations.get("aliases")
            if isinstance(aliases, str):
                declared.update(alias.strip() for alias in aliases.split(";") if alias.strip())
    return sorted(declared)


def validate_prefix_sources(sources: list[object], evidence_directory: Path) -> dict[str, object]:
    manifest = _verified_json(evidence_directory, "manifest")
    cache = _verified_json(evidence_directory, "cache")
    audit = _verified_json(evidence_directory, "audit")
    native_pack = _verified_json(evidence_directory, "nativePack")
    if not all(isinstance(value, dict) for value in (manifest, cache, audit, native_pack)):
        raise ValueError("Builder evidence roots must be JSON objects.")
    assert isinstance(manifest, dict)
    assert isinstance(cache, dict)
    assert isinstance(audit, dict)
    assert isinstance(native_pack, dict)
    if (
        cache.get("schemaVersion") != "lego.builder-asset-cache/1"
        or audit.get("schemaVersion") != "lego.builder-asset-audit/1"
        or native_pack.get("schemaVersion") != "lego.builder-native-mesh-pack/1"
        or native_pack.get("sourceManifestSha256") != EVIDENCE["manifest"][2]
        or native_pack.get("sourceCacheReportSha256") != EVIDENCE["cache"][2]
        or native_pack.get("sourceAuditSha256") != EVIDENCE["audit"][2]
        or native_pack.get("partCount") != 107
    ):
        raise ValueError("Builder cache/audit/native-pack schemas or cross-source pins drifted.")
    manifest_rows = _one_by(
        list(manifest.get("Bricks", [])),
        lambda row: f"{row.get('Id')};{row.get('Revision')}",
    )
    cache_rows = _one_by(
        list(cache.get("bundles", [])),
        lambda row: f"{row.get('id')};{row.get('revision')}",
    )
    audit_rows = _one_by(
        list(audit.get("parts", [])),
        lambda row: f"{row.get('id')};{row.get('annotations', {}).get('revision')}",
    )
    native_rows = _one_by(
        list(native_pack.get("parts", [])),
        lambda row: f"{row.get('id')};{row.get('revision')}",
    )
    checksum_mismatches: list[dict[str, object]] = []
    verified_identities: list[dict[str, object]] = []
    for design_revision, cached in cache_rows.items():
        manifest_row = manifest_rows.get(design_revision)
        audited = audit_rows.get(design_revision)
        native = native_rows.get(design_revision)
        if manifest_row is None:
            raise ValueError(f"Builder cache row {design_revision} is absent from the exact manifest.")
        platform = manifest_row.get("Platform")
        if not isinstance(platform, dict) or platform.get("Name") != "Android":
            raise ValueError(f"Builder manifest row {design_revision} has no exact Android identity.")
        manifest_md5 = str(platform.get("Checksum"))
        if cached.get("manifestMd5") != manifest_md5:
            raise ValueError(f"Builder cache row {design_revision} changed its manifest MD5 join.")
        if cached.get("verified") is False:
            if (
                cached.get("actualMd5") == manifest_md5
                or cached.get("state") != "checksum-mismatch-quarantined"
            ):
                raise ValueError(
                    f"Builder cache row {design_revision} claims a checksum refusal without an exact mismatch."
                )
            checksum_mismatches.append(
                {
                    "designRevision": design_revision,
                    "manifestMd5": manifest_md5,
                    "actualMd5": cached.get("actualMd5"),
                }
            )
            continue
        if cached.get("verified") is not True or cached.get("actualMd5") != manifest_md5:
            raise ValueError(f"Builder cache row {design_revision} has an unknown verification state.")
        if audited is None:
            raise ValueError(
                f"Verified Builder row {design_revision} is absent from the exact audit join."
            )
        if (
            audited.get("bundleSha256") != cached.get("sha256")
        ):
            raise ValueError(f"Verified Builder row {design_revision} fails its audit join.")
        if native is not None and (
            native.get("bundleSha256") != cached.get("sha256")
            or native.get("manifestMd5") != manifest_md5
            or native.get("primitiveXmlSha256") != audited.get("primitiveXmlSha256")
            or native.get("connectivityPrimitives") != audited.get("connectivityPrimitives")
        ):
            raise ValueError(f"Verified Builder row {design_revision} fails its native-pack join.")
        try:
            (
                eligible_top,
                eligible_underside,
                authored_top,
                authored_underside,
            ) = _anchor_node_sets(audited)
            anchor_counts: tuple[int | None, int | None, int | None, int | None] = (
                len(eligible_top),
                len(eligible_underside),
                len(authored_top),
                len(authored_underside),
            )
        except ValueError:
            anchor_counts = (None, None, None, None)
        verified_identities.append(
            {
                "designRevision": design_revision,
                "nativeConnectivityBound": native is not None,
                "declaredDesignIds": _declared_design_ids(
                    manifest_row, cached, audited, native
                ),
                "eligibleTopAnchorCount": anchor_counts[0],
                "eligibleUndersideAnchorCount": anchor_counts[1],
                "authoredTopFieldCount": anchor_counts[2],
                "authoredUndersideFieldCount": anchor_counts[3],
                "bundleSha256": f"sha256:{cached.get('sha256')}",
                "manifestMd5": f"md5:{manifest_md5}",
                "primitiveXmlSha256": f"sha256:{audited.get('primitiveXmlSha256')}",
                "shellPathId": str(
                    next(
                        (row.get("pathId") for row in audited.get("meshes", []) if row.get("name") == "Shell"),
                        "",
                    )
                ),
                "shellCanonicalSha256": f"sha256:{next((row.get('canonicalSha256') for row in audited.get('meshes', []) if row.get('name') == 'Shell'), '')}",
                "shellVertexCount": next(
                    (row.get("vertices") for row in audited.get("meshes", []) if row.get("name") == "Shell"),
                    None,
                ),
                "shellTriangleCount": next(
                    (row.get("triangles") for row in audited.get("meshes", []) if row.get("name") == "Shell"),
                    None,
                ),
            }
        )
    seen: set[str] = set()
    results: list[dict[str, object]] = []
    for raw_source in sources:
        if not isinstance(raw_source, dict):
            raise ValueError("Builder source registry contains a non-object row.")
        source = raw_source
        design_revision = str(source.get("designRevision"))
        design_id, revision = _revision(design_revision)
        if design_revision in seen:
            raise ValueError(f"Builder source registry repeats {design_revision}.")
        seen.add(design_revision)
        identity = source.get("sourceIdentity")
        if not isinstance(identity, dict):
            raise ValueError(f"Builder source {design_revision} has no sourceIdentity object.")
        manifest_row = manifest_rows.get(design_revision)
        cached = cache_rows.get(design_revision)
        audited = audit_rows.get(design_revision)
        native = native_rows.get(design_revision)
        if manifest_row is None or cached is None or audited is None:
            raise ValueError(
                f"Builder source {design_revision} is absent from the exact manifest/cache/audit join."
            )
        manifest_md5 = str(identity.get("manifestMd5"))
        platform = manifest_row.get("Platform")
        if (
            not isinstance(platform, dict)
            or platform.get("Name") != "Android"
            or f"md5:{platform.get('Checksum')}" != manifest_md5
            or cached.get("platform") != "Android"
            or cached.get("manifestMd5") != manifest_md5.removeprefix("md5:")
            or cached.get("actualMd5") != manifest_md5.removeprefix("md5:")
            or cached.get("verified") is not True
            or f"sha256:{cached.get('sha256')}" != identity.get("bundleSha256")
            or f"sha256:{audited.get('bundleSha256')}" != identity.get("bundleSha256")
            or f"sha256:{audited.get('primitiveXmlSha256')}"
            != identity.get("primitiveXmlSha256")
            or (
                native is not None
                and native.get("connectivityPrimitives") != audited.get("connectivityPrimitives")
            )
        ):
            raise ValueError(f"Builder source {design_revision} fails its manifest/cache/audit identity join.")
        shells = [row for row in audited.get("meshes", []) if row.get("name") == "Shell"]
        if (
            len(shells) != 1
            or str(shells[0].get("pathId")) != str(identity.get("shellPathId"))
            or f"sha256:{shells[0].get('canonicalSha256')}"
            != identity.get("shellCanonicalSha256")
            or shells[0].get("vertices") != identity.get("shellVertexCount")
            or shells[0].get("triangles") != identity.get("shellTriangleCount")
        ):
            raise ValueError(f"Builder source {design_revision} fails its exact Shell identity join.")
        legacy = source.get("builderStudCentersLdu")
        role = (
            "top-field-to-catalog-stud" if legacy is not None else source.get("builderAnchorRole")
        )
        centers = _anchor_centers(audited, str(role))
        pinned_centers = legacy if legacy is not None else source.get("builderAnchorCentersLdu")
        pinned_digest = (
            source.get("builderStudCentersDigest")
            if legacy is not None
            else source.get("builderAnchorCentersDigest")
        )
        actual_digest = f"sha256:{hashlib.sha256(canonical_json(centers)).hexdigest()}"
        if centers != pinned_centers or actual_digest != pinned_digest:
            raise ValueError(
                f"Builder source {design_revision} recomputes {role} centers {centers} at "
                f"{actual_digest}; retained pins are {pinned_centers} at {pinned_digest}."
            )
        results.append(
            {
                "designRevision": design_revision,
                "designId": design_id,
                "revision": revision,
                "anchorRole": role,
                "anchorCentersLdu": centers,
                "anchorCentersDigest": actual_digest,
            }
        )
    return {
        "schemaVersion": "lego.builder-prefix-source-contract/1",
        "authority": {
            "kind": "local-diagnostic",
            "physicalFrame": False,
            "placement": False,
            "sourceExecution": False,
            "preparedRun": False,
            "documentMutation": False,
            "replay": False,
            "completion": False,
        },
        "sourceRows": len(results),
        "rows": results,
        "checksumMismatches": sorted(
            checksum_mismatches, key=lambda row: str(row["designRevision"])
        ),
        "verifiedIdentities": sorted(
            verified_identities, key=lambda row: str(row["designRevision"])
        ),
    }


def main() -> int:
    repository = Path(__file__).resolve().parents[1]
    source = sys.stdin.buffer.read(MAX_STDIN_BYTES + 1)
    if len(source) > MAX_STDIN_BYTES:
        raise ValueError(
            f"Builder prefix source contract stdin exceeds {MAX_STDIN_BYTES} bytes; pass only "
            "the bounded current source rows, not evidence payloads."
        )
    payload = json.loads(source.decode("utf-8"))
    if not isinstance(payload, dict) or not isinstance(payload.get("sources"), list):
        raise ValueError("Builder prefix source contract stdin requires one sources array.")
    report = validate_prefix_sources(
        payload["sources"], repository / "output/real-build/builder-prefix-source"
    )
    sys.stdout.buffer.write(canonical_json(report))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
