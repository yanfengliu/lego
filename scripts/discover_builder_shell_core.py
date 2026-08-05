from __future__ import annotations

import importlib.util
import math
import re
import sys
from pathlib import Path
from types import ModuleType
from typing import Callable


def _load_sibling(module_name: str, filename: str) -> ModuleType:
    spec = importlib.util.spec_from_file_location(module_name, Path(__file__).with_name(filename))
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Cannot load required sibling {filename}.")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


META = _load_sibling("builder_shell_discovery_metadata", "discover_builder_shell_metadata.py")
EXTRACTOR = _load_sibling("builder_shell_extractor_foundation", "extract-builder-shell.py")
PUBLICATION = _load_sibling(
    "builder_shell_discovery_publication", "discover_builder_shell_publication.py"
)
SNAPSHOT = EXTRACTOR.SNAPSHOT
DESIGN_ID = META.DESIGN_ID
REVISION = META.REVISION
BUNDLE_BYTES = META.BUNDLE_BYTES
BUNDLE_SHA256 = META.BUNDLE_SHA256
SCHEMA_VERSION = META.SCHEMA_VERSION
OUTPUT_NAME = META.OUTPUT_NAME
MAX_SERIALIZED_BYTES = META.MAX_SERIALIZED_BYTES
MAX_TEXT_BYTES = META.MAX_TEXT_BYTES
MAX_REPORT_BYTES = META.MAX_REPORT_BYTES
MAX_CONNECTORS = META.MAX_CONNECTORS
MAX_METADATA_CHARACTERS = META.MAX_METADATA_CHARACTERS
SHA256_RE = META.SHA256_RE
Candidate = META.Candidate
canonical_json_bytes = META.canonical_json_bytes
strict_json_loads = META.strict_json_loads
sha256 = META.sha256


def shell_report(candidate: Candidate, mesh_handler_factory: Callable[[object], object]) -> dict[str, object]:
    mesh = candidate.reader.read()
    if getattr(mesh, "m_Name", None) != "Shell":
        raise ValueError("Decoded Shell name differs from bounded peek metadata.")
    vertex_data = getattr(mesh, "m_VertexData", None)
    vertex_bytes = getattr(vertex_data, "m_DataSize", None)
    if not isinstance(vertex_bytes, (bytes, bytearray)):
        raise ValueError("Shell vertex data is not a byte buffer.")
    vertex_data_bytes = len(vertex_bytes)
    META.bounded_int(vertex_data_bytes, MAX_SERIALIZED_BYTES, "Shell vertex data bytes")
    declared_vertices = META.bounded_int(
        getattr(vertex_data, "m_VertexCount", None),
        EXTRACTOR.MAX_VERTICES,
        "Shell declared vertices",
        minimum=1,
    )
    index_buffer = getattr(mesh, "m_IndexBuffer", None)
    if not isinstance(index_buffer, (bytes, bytearray, list, tuple)):
        raise ValueError("Shell index buffer has an unsupported representation.")
    index_buffer_bytes = len(index_buffer)
    META.bounded_int(
        index_buffer_bytes, EXTRACTOR.MAX_TRIANGLES * 4, "Shell index buffer bytes"
    )
    submeshes = getattr(mesh, "m_SubMeshes", None)
    if not isinstance(submeshes, (list, tuple)):
        raise ValueError("Shell submesh declaration is not a bounded sequence.")
    declared_submeshes = META.bounded_int(
        len(submeshes),
        EXTRACTOR.MAX_SUBMESHES,
        "Shell declared submeshes",
        minimum=1,
    )
    topologies: list[int] = []
    indexes = 0
    for index, submesh in enumerate(submeshes):
        topology = META.bounded_int(
            getattr(submesh, "topology", None), 4, f"Shell submesh {index} topology"
        )
        if topology != 0:
            raise ValueError(
                f"Shell submesh {index} uses unsupported non-triangle topology {topology}."
            )
        topologies.append(topology)
        indexes += META.bounded_int(
            getattr(submesh, "indexCount", None),
            EXTRACTOR.MAX_TRIANGLES * 3,
            f"Shell submesh {index} index count",
        )
        META.bounded_int(
            indexes, EXTRACTOR.MAX_TRIANGLES * 3, "Shell aggregate index count"
        )
    if indexes % 3:
        raise ValueError(
            f"Shell declares {indexes} triangle indexes, which is not divisible by three."
        )
    compression = META.bounded_int(
        getattr(mesh, "m_MeshCompression", None), 3, "Shell mesh compression"
    )
    compressed = getattr(mesh, "m_CompressedMesh", None)
    if compressed is not None:
        fields = (
            "m_BindPoses", "m_BoneIndices", "m_Colors", "m_FloatColors", "m_NormalSigns",
            "m_Normals", "m_TangentSigns", "m_Tangents", "m_Triangles", "m_UV",
            "m_Vertices", "m_Weights",
        )
        for field_name in fields:
            packed = getattr(compressed, field_name, None)
            if packed is None:
                continue
            maximum = (
                EXTRACTOR.MAX_TRIANGLES * 3
                if field_name == "m_Triangles"
                else EXTRACTOR.MAX_VERTICES * 8
            )
            META.bounded_int(
                getattr(packed, "m_NumItems", None),
                maximum,
                f"Shell compressed {field_name} item count",
            )
            packed_data = getattr(packed, "m_Data", None) or []
            if not isinstance(packed_data, (bytes, bytearray, list, tuple)) or len(
                packed_data
            ) > MAX_SERIALIZED_BYTES:
                raise ValueError(
                    f"Shell compressed {field_name} data is unsupported or oversized."
                )
    handler = mesh_handler_factory(mesh)
    handler.process()
    raw_groups = handler.get_triangles()

    def bounded_groups():
        for group_index, group in enumerate(raw_groups):
            if group_index >= EXTRACTOR.MAX_SUBMESHES:
                raise ValueError(
                    f"Decoded Shell exceeds {EXTRACTOR.MAX_SUBMESHES} triangle groups; "
                    "the over-limit group was not appended."
                )
            yield group

    bounded_handler = type(
        "BoundedMeshHandler",
        (),
        {"m_Vertices": handler.m_Vertices, "get_triangles": lambda _self: bounded_groups()},
    )()
    vertices, triangle_groups = EXTRACTOR.bounded_mesh_data(bounded_handler)
    triangle_count = sum(len(group) for group in triangle_groups)
    if (
        len(vertices) != declared_vertices
        or triangle_count != indexes // 3
        or len(triangle_groups) != declared_submeshes
    ):
        raise ValueError(
            "Canonical Shell counts do not reconcile with its bounded declarations."
        )
    return {
        "canonicalMeshSha256": f"sha256:{EXTRACTOR.mesh_digest(vertices, triangle_groups)}",
        "canonicalTriangles": triangle_count,
        "canonicalVertices": len(vertices),
        "declaredCompression": compression,
        "declaredSubmeshes": declared_submeshes,
        "declaredTopologies": topologies,
        "declaredTriangles": indexes // 3,
        "declaredVertices": declared_vertices,
        "indexBufferBytes": index_buffer_bytes,
        "pathId": candidate.path_id,
        "serializedBytes": candidate.serialized_bytes,
        "vertexDataBytes": vertex_data_bytes,
    }


# The two module names that must come from the private RECORD-verified snapshot
# before any byte of the retained bundle is handed to third-party parsing code.
PINNED_IMPORT_MODULES = ("UnityPy", "UnityPy.helpers.MeshHelper")

# What actually stops a real decode here, stated once so no doc has to guess. The
# interpreter gate is necessary and not sufficient: this machine already carries
# conforming 64-bit CPython 3.13 interpreters under which validate_worker_runtime()
# returns cleanly. Only the pinned distribution set is the barrier.
PINNED_ENVIRONMENT_BARRIER = (
    "Only a private snapshot holding exactly the "
    f"{len(SNAPSHOT.PINNED_DISTRIBUTIONS)} pinned distributions (UnityPy "
    f"{SNAPSHOT.UNITYPY_VERSION} and its {len(SNAPSHOT.PINNED_DISTRIBUTIONS) - 1} pinned "
    "dependencies, contract sha256 "
    f"{SNAPSHOT.PINNED_ENVIRONMENT_DIGEST}) with matching wheel RECORD digests may decode "
    "it. Build one by running scripts/discover-builder-shell.py --unitypy <exact reviewed "
    "environment> --bundle <bundle> --output-root <root>, which captures and revalidates "
    "that snapshot before the worker imports anything. Dead ends: the CPython 3.13 "
    "interpreter check is NOT the barrier - a conforming 64-bit CPython 3.13 already "
    "satisfies it - and pip install UnityPy=="
    f"{SNAPSHOT.UNITYPY_VERSION} into an existing interpreter's site-packages does not "
    "satisfy this gate, because that target carries unpinned distributions the contract "
    "rejects; neither switching interpreter nor installing the package unblocks a real "
    "decode."
)


def assert_pinned_environment_for_retained_bundle(
    payload: bytes, snapshot_root: Path | None
) -> None:
    """Refuse to parse the exact retained bundle outside the pinned distribution set.

    Synthetic fixtures are not the retained artifact and are not gated. The exact
    85,098-byte quarantined 3245-M capture is, and the refusal is executable rather
    than documentary.
    """
    if sha256(payload) != META.BUNDLE_SHA256:
        return
    if snapshot_root is None:
        raise ValueError(
            f"Refusing to parse the exact retained {META.DESIGN_ID}-{META.REVISION} bundle "
            f"({META.BUNDLE_BYTES} bytes sha256:{META.BUNDLE_SHA256}): build_report was called "
            "without a pinned snapshot root, so no verified UnityPy environment backs the "
            f"loader. {PINNED_ENVIRONMENT_BARRIER}"
        )
    root = Path(snapshot_root).resolve(strict=False)
    try:
        # Necessary, never sufficient - the message below says so, so that a failure
        # here is not mistaken for the barrier a second time.
        SNAPSHOT.validate_worker_runtime()
        SNAPSHOT.capture_pinned_import_payloads(root)
    except BaseException as error:
        raise ValueError(
            f"Refusing to parse the exact retained {META.DESIGN_ID}-{META.REVISION} bundle "
            f"({META.BUNDLE_BYTES} bytes sha256:{META.BUNDLE_SHA256}): the import root {root} "
            f"is not the exact pinned distribution set ({error}). {PINNED_ENVIRONMENT_BARRIER}"
        ) from error
    for module_name in PINNED_IMPORT_MODULES:
        module = sys.modules.get(module_name)
        origin = getattr(module, "__file__", None)
        if module is None or not origin:
            raise ValueError(
                f"Refusing to parse the exact retained {META.DESIGN_ID}-{META.REVISION} bundle "
                f"({META.BUNDLE_BYTES} bytes sha256:{META.BUNDLE_SHA256}): required pinned "
                f"module {module_name!r} is not imported from {root}. "
                f"{PINNED_ENVIRONMENT_BARRIER}"
            )
        resolved = Path(origin).resolve(strict=False)
        if not resolved.is_relative_to(root):
            raise ValueError(
                f"Refusing to parse the exact retained {META.DESIGN_ID}-{META.REVISION} bundle "
                f"({META.BUNDLE_BYTES} bytes sha256:{META.BUNDLE_SHA256}): pinned module "
                f"{module_name!r} was imported from {resolved}, which is outside the verified "
                f"snapshot {root}. {PINNED_ENVIRONMENT_BARRIER}"
            )


def build_report(
    payload: bytes,
    loader: Callable[[bytes], object],
    mesh_handler_factory: Callable[[object], object],
    snapshot_root: Path | None = None,
) -> dict[str, object]:
    if len(payload) != BUNDLE_BYTES or sha256(payload) != BUNDLE_SHA256:
        raise ValueError(
            "Bundle bytes do not match the one exact quarantined 3245-M source identity."
        )
    assert_pinned_environment_for_retained_bundle(payload, snapshot_root)
    environment = EXTRACTOR.load_environment_from_bytes(payload, loader)
    shell, primitive, partinfo = META.enumerate_candidates(environment)
    report = {
        "catalogAdmitted": False,
        "partInfo": META.partinfo_report(partinfo) if partinfo else None,
        "primitiveXml": META.primitive_report(primitive),
        "schemaVersion": SCHEMA_VERSION,
        "shell": shell_report(shell, mesh_handler_factory),
        "source": {
            "bundleBytes": BUNDLE_BYTES,
            "bundleSha256": f"sha256:{BUNDLE_SHA256}",
            "designId": DESIGN_ID,
            "revision": REVISION,
        },
        "status": "quarantined-source-evidence-only",
        "supported": False,
    }
    validate_report(report)
    return report


def _keys(value: object, expected: set[str], label: str) -> dict[str, object]:
    if not isinstance(value, dict) or set(value) != expected:
        actual = set(value) if isinstance(value, dict) else set()
        raise ValueError(
            f"{label} has unexpected schema; extra={sorted(actual - expected)}, "
            f"missing={sorted(expected - actual)}."
        )
    return value


def _asset_header(value: object, label: str) -> dict[str, object]:
    asset = _keys(value, {"name", "pathId", "serializedBytes", "sha256"}, label)
    path_id = asset["pathId"] if isinstance(asset["pathId"], str) else ""
    if (
        re.fullmatch(r"-?[0-9]+", path_id) is None
        or not isinstance(asset["sha256"], str)
        or SHA256_RE.fullmatch(asset["sha256"]) is None
    ):
        raise ValueError(f"{label} path or digest metadata is malformed.")
    META.bounded_name(asset["name"], f"{label} name")
    META.bounded_int(
        asset["serializedBytes"], MAX_TEXT_BYTES, f"{label} serialized bytes", minimum=1
    )
    return asset


def validate_report(value: object) -> dict[str, object]:
    report_keys = {
        "catalogAdmitted", "partInfo", "primitiveXml", "schemaVersion", "shell",
        "source", "status", "supported",
    }
    report = _keys(value, report_keys, "Discovery report")
    if (
        report["schemaVersion"] != SCHEMA_VERSION
        or report["status"] != "quarantined-source-evidence-only"
        or report["catalogAdmitted"] is not False
        or report["supported"] is not False
    ):
        raise ValueError("Discovery report attempts to alter its fixed quarantine authority.")
    source = _keys(
        report["source"],
        {"bundleBytes", "bundleSha256", "designId", "revision"},
        "Discovery source",
    )
    expected_source = {
        "bundleBytes": BUNDLE_BYTES,
        "bundleSha256": f"sha256:{BUNDLE_SHA256}",
        "designId": DESIGN_ID,
        "revision": REVISION,
    }
    if source != expected_source:
        raise ValueError("Discovery report source identity differs from the exact 3245-M pin.")
    shell_keys = {
        "canonicalMeshSha256", "canonicalTriangles", "canonicalVertices",
        "declaredCompression", "declaredSubmeshes", "declaredTopologies",
        "declaredTriangles", "declaredVertices", "indexBufferBytes", "pathId",
        "serializedBytes", "vertexDataBytes",
    }
    shell = _keys(report["shell"], shell_keys, "Shell tuple")
    path_id = shell["pathId"] if isinstance(shell["pathId"], str) else ""
    if (
        re.fullmatch(r"-?[0-9]+", path_id) is None
        or not isinstance(shell["canonicalMeshSha256"], str)
        or SHA256_RE.fullmatch(shell["canonicalMeshSha256"]) is None
    ):
        raise ValueError("Shell tuple has malformed path or canonical digest metadata.")
    bounds = (
        ("serializedBytes", MAX_SERIALIZED_BYTES),
        ("vertexDataBytes", MAX_SERIALIZED_BYTES),
        ("indexBufferBytes", EXTRACTOR.MAX_TRIANGLES * 4),
        ("declaredVertices", EXTRACTOR.MAX_VERTICES),
        ("canonicalVertices", EXTRACTOR.MAX_VERTICES),
        ("declaredTriangles", EXTRACTOR.MAX_TRIANGLES),
        ("canonicalTriangles", EXTRACTOR.MAX_TRIANGLES),
        ("declaredSubmeshes", EXTRACTOR.MAX_SUBMESHES),
        ("declaredCompression", 3),
    )
    for key, maximum in bounds:
        META.bounded_int(
            shell[key],
            maximum,
            f"Shell tuple {key}",
            minimum=1 if key not in {"indexBufferBytes", "declaredCompression"} else 0,
        )
    if (
        shell["canonicalVertices"] != shell["declaredVertices"]
        or shell["canonicalTriangles"] != shell["declaredTriangles"]
    ):
        raise ValueError("Shell tuple canonical counts do not equal declarations.")
    topologies = shell["declaredTopologies"]
    if (
        not isinstance(topologies, list)
        or len(topologies) != shell["declaredSubmeshes"]
        or any(value != 0 for value in topologies)
    ):
        raise ValueError("Shell tuple topology declarations are malformed or unsupported.")
    primitive = _keys(
        report["primitiveXml"],
        {"connectorCenters", "name", "pathId", "serializedBytes", "sha256"},
        "Primitive XML",
    )
    _asset_header(
        {key: primitive[key] for key in ("name", "pathId", "serializedBytes", "sha256")},
        "Primitive XML",
    )
    centers = primitive["connectorCenters"]
    if not isinstance(centers, list) or not 1 <= len(centers) <= MAX_CONNECTORS:
        raise ValueError("Primitive XML connector-center list is malformed.")
    for index, row in enumerate(centers):
        item = _keys(row, {"center", "kind", "type"}, f"Connector center {index}")
        META.bounded_name(item["kind"], f"Connector center {index} kind")
        if item["type"] is not None:
            META.bounded_name(item["type"], f"Connector center {index} type")
        center = item["center"]
        if (
            not isinstance(center, list)
            or len(center) != 3
            or any(
                isinstance(number, bool)
                or not isinstance(number, (int, float))
                or not math.isfinite(number)
                or abs(number) > 1_000_000_000
                for number in center
            )
        ):
            raise ValueError(f"Connector center {index} is not a bounded finite triple.")
    partinfo = report["partInfo"]
    if partinfo is not None:
        part = _keys(
            partinfo,
            {"identity", "name", "pathId", "serializedBytes", "sha256"},
            "Partinfo",
        )
        _asset_header(
            {key: part[key] for key in ("name", "pathId", "serializedBytes", "sha256")},
            "Partinfo",
        )
        identity = _keys(
            part["identity"], {"designId", "name", "revision"}, "Partinfo identity"
        )
        name = identity["name"]
        if (
            identity["designId"] != DESIGN_ID
            or identity["revision"] not in {None, REVISION}
            or (
                name is not None
                and (
                    not isinstance(name, str)
                    or not name
                    or len(name) > MAX_METADATA_CHARACTERS
                )
            )
        ):
            raise ValueError("Partinfo identity conflicts with the exact 3245-M source.")
    return report


def atomic_write_relative_windows(
    root: Path,
    target_name: str,
    payload: bytes,
    verify: Callable[[], None],
    expected_root_identity: tuple[int, int],
) -> None:
    """Publish one bounded report atomically inside a prevalidated output root.

    The handle lifetimes, NTSTATUS reporting, and the rule that nothing is deleted
    once the rename commits live in discover_builder_shell_publication.py.
    """
    PUBLICATION.atomic_write_relative_windows(
        root,
        target_name,
        payload,
        verify,
        expected_root_identity,
        META.close_windows_handle,
    )
