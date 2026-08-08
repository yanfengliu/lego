from __future__ import annotations

import argparse
import hashlib
import importlib
import importlib.util
import json
import math
import os
import re
import struct
import subprocess
import sys
import tempfile
from pathlib import Path, PurePosixPath
from types import ModuleType
from typing import Callable


MAX_BUNDLE_BYTES = 1_000_000
MAX_BUNDLE_OBJECTS = 100_000
MAX_SHELL_SERIALIZED_BYTES = 512 * 1024
MAX_VERTICES = 100_000
MAX_TRIANGLES = 100_000
MAX_SUBMESHES = 4_096
MAX_PACKED_MESH_ITEMS = MAX_VERTICES * 8
MAX_WORKER_REPORT_BYTES = 4 * 1024 * 1024
MAX_WORKER_DIAGNOSTIC_CHARACTERS = 4_000
WORKER_TIMEOUT_SECONDS = 120
SNAPSHOT_WORKER_FLAG = "--verified-unitypy-snapshot-worker"
SHA256_ARGUMENT = re.compile(r"^[0-9a-fA-F]{64}$")


def load_snapshot_helper() -> ModuleType:
    helper_path = Path(__file__).resolve(strict=True).with_name("builder-import-snapshot.py")
    spec = importlib.util.spec_from_file_location("builder_import_snapshot", helper_path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Cannot load trusted Builder import helper {helper_path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


SNAPSHOT = load_snapshot_helper()
sha256 = SNAPSHOT.sha256
bounded_bytes = SNAPSHOT.bounded_bytes

# Every design the set 6651557 real build needs a Builder frame for, with the
# exact identity its bundle, its decoded Shell and its serialized layout must
# reproduce. Adding a row is a review step: the tuple comes from the pinned
# asset audit, and a bundle that does not match all of it is not decoded.
SUPPORTED_SHELLS = (
    {
        "designRevision": "30565;E",
        "bundleSha256": "955ce425a8ddf4b12d320260d627df3f3fb46c52fedaf70f1d562b0e1efa7c93",
        "shellPathId": "-2382827459408350605",
        "shellCanonicalSha256": "8b41bc4bed4f2e9ee8ddd49b6ed74b52035c1b4f86507d838db56bb55deec8b2",
        "serializedBytes": 15908,
        "vertexDataBytes": 14112,
        "indexBufferBytes": 1416,
        "vertices": 294,
        "triangles": 236,
    },
    {
        "designRevision": "80015;E",
        "bundleSha256": "f3a11d40f9de9fa54670bdd87db0a87e034896d87b56e64e9f382c3ef0098c75",
        "shellPathId": "3328116897400514273",
        "shellCanonicalSha256": "946c5c5782c36a44883200cc57e150c43bef2f4b8e8444257cfcb49952327723",
        "serializedBytes": 57200,
        "vertexDataBytes": 51968,
        "indexBufferBytes": 4824,
        "vertices": 928,
        "triangles": 804,
    },
    {
        "designRevision": "3020;L",
        "bundleSha256": "a0bee312fc74b5f7f054c255b020933d9afb43a9feac6f12012749b6f659a030",
        "shellPathId": "-3965320204972781753",
        "shellCanonicalSha256": "3fa58d39e1ec1038e12ecbcdc57c0da0089324716b82140345590089fbbb3163",
        "serializedBytes": 3264,
        "vertexDataBytes": 2688,
        "indexBufferBytes": 168,
        "vertices": 48,
        "triangles": 28,
    },
    {
        "designRevision": "3032;F",
        "bundleSha256": "a771edd53c9739b178ea7915cf8f284834de230572ed63f5ce88ac392f4f25dc",
        "shellPathId": "-6153107707984632065",
        "shellCanonicalSha256": "c2649659638ea67820eea88811d38a742189e9a87cec2878fda4a6baea967da4",
        "serializedBytes": 2880,
        "vertexDataBytes": 2304,
        "indexBufferBytes": 168,
        "vertices": 48,
        "triangles": 28,
    },
    {
        "designRevision": "3034;J",
        "bundleSha256": "0f04e02b9340cca5be83af43e1b767f49125916c272cf6351d2952dff4c90b06",
        "shellPathId": "3859792364607955227",
        "shellCanonicalSha256": "15d430abff3cf43b61fac344cc70f64f460b821b5fc9640f2e06a4b4b6e268d4",
        "serializedBytes": 3264,
        "vertexDataBytes": 2688,
        "indexBufferBytes": 168,
        "vertices": 48,
        "triangles": 28,
    },
    {
        "designRevision": "3460;N",
        "bundleSha256": "65a1b563ac9b1eae6dd061596e098d452e10dba61adb7b993242aa0c3be3366f",
        "shellPathId": "-5167410168576913850",
        "shellCanonicalSha256": "343b54d4f5304c69c463a29667d5018dc325e22f2426de384395aac37784011b",
        "serializedBytes": 3264,
        "vertexDataBytes": 2688,
        "indexBufferBytes": 168,
        "vertices": 48,
        "triangles": 28,
    },
    {
        "designRevision": "3795;I",
        "bundleSha256": "b7e896b1d881d51fb6195095e41127b30cee5ab64d56c20d77de4049a881cbd2",
        "shellPathId": "4098456159558082482",
        "shellCanonicalSha256": "6663280aa115d666032144f5131ccf188c24e8ff4cafc197893d29f2681eba2b",
        "serializedBytes": 3264,
        "vertexDataBytes": 2688,
        "indexBufferBytes": 168,
        "vertices": 48,
        "triangles": 28,
    },
    {
        "designRevision": "3832;G",
        "bundleSha256": "a44e58c707b0b898dffd8580923eb70331a548467fcf721944f9fec1602ad3cb",
        "shellPathId": "-1247914159549873248",
        "shellCanonicalSha256": "a2a3f114c8a5463b9a38926b83ef10963a55e50b35a47f0611ef60de1f2b8c53",
        "serializedBytes": 3264,
        "vertexDataBytes": 2688,
        "indexBufferBytes": 168,
        "vertices": 48,
        "triangles": 28,
    },
    {
        "designRevision": "6106;D",
        "bundleSha256": "000c995217c337e466bae51d8a1f91aff43407bef73b616f54179501b0f0bf4c",
        "shellPathId": "-3386435689471635927",
        "shellCanonicalSha256": "ab71f6fa24770ba594816ece8d3838183108dc8a9678fac0ef33800531fd7a26",
        "serializedBytes": 12956,
        "vertexDataBytes": 11712,
        "indexBufferBytes": 864,
        "vertices": 244,
        "triangles": 144,
    },
    {
        "designRevision": "30503;F",
        "bundleSha256": "dd4ccd984224bd8305a31666780955e1738c5ddfff0352b118a65239beea7ba9",
        "shellPathId": "7133946934050365661",
        "shellCanonicalSha256": "d2e698f1fc253fef56b93354dc9221bfd118314272cb46879c31f038c2f4a33e",
        "serializedBytes": 11740,
        "vertexDataBytes": 10640,
        "indexBufferBytes": 720,
        "vertices": 190,
        "triangles": 120,
    },
    {
        "designRevision": "41539;F",
        "bundleSha256": "baccf7cfe24530c8585e58e98141d92c64fb58d6b9a19e1fbd39c41f45e51f47",
        "shellPathId": "-1097953145414435942",
        "shellCanonicalSha256": "a6f406444faa2d5dbc4a41aef59bae41f929929f793b570eb6ee0a779aa152a9",
        "serializedBytes": 3264,
        "vertexDataBytes": 2688,
        "indexBufferBytes": 168,
        "vertices": 48,
        "triangles": 28,
    },
    {
        "designRevision": "51739;H",
        "bundleSha256": "6966c3d9308749f36d20efbb900ac79aeb95db3b7b7ed05bfadd04ebca158938",
        "shellPathId": "3375856213334120950",
        "shellCanonicalSha256": "a6f64c3bdfa5762334877f2361c347c4ff6a340b0695a6abafea0ef3f61b4f4a",
        "serializedBytes": 16736,
        "vertexDataBytes": 15008,
        "indexBufferBytes": 1320,
        "vertices": 268,
        "triangles": 220,
    },
    {
        "designRevision": "54383;F",
        "bundleSha256": "b4302061dc1c661a4e7ef0fe38cb88bb9ae69968c2cd49a0c7de1be489f61b89",
        "shellPathId": "-8116910261973647149",
        "shellCanonicalSha256": "27b302a1c3980b34de12f0c6c83e87ac1966fd1d440cac911bc001f4bf3c0e49",
        "serializedBytes": 16152,
        "vertexDataBytes": 14400,
        "indexBufferBytes": 1344,
        "vertices": 300,
        "triangles": 224,
    },
    {
        "designRevision": "60479;F",
        "bundleSha256": "edf1c2ab46b1fec3c96e2470aed6861cef83c202696f68f251b7d724973f2073",
        "shellPathId": "6568512417183503593",
        "shellCanonicalSha256": "8a93898ee1f2d287c8e5152f9dcb52fb5ab049954daa92f8cb7a719bd855eb23",
        "serializedBytes": 3264,
        "vertexDataBytes": 2688,
        "indexBufferBytes": 168,
        "vertices": 48,
        "triangles": 28,
    },
    {
        "designRevision": "91988;F",
        "bundleSha256": "6c7e38460cf7306b820336e2c59853913bfda9d89abd7ea72d1fcaedbcf6a7a7",
        "shellPathId": "-1297394108001815733",
        "shellCanonicalSha256": "596b7b194d82e742f292148d1a577f92f10e995cc4fcabd6bde412698ec3f7c9",
        "serializedBytes": 3264,
        "vertexDataBytes": 2688,
        "indexBufferBytes": 168,
        "vertices": 48,
        "triangles": 28,
    },
)
def supported_shell(
    bundle_sha256: str,
    shell_path_id: str,
    shell_canonical_sha256: str,
    vertices: int,
    triangles: int,
) -> dict[str, object]:
    requested = (
        bundle_sha256,
        shell_path_id,
        shell_canonical_sha256,
        vertices,
        triangles,
    )
    for source in SUPPORTED_SHELLS:
        expected = (
            source["bundleSha256"],
            source["shellPathId"],
            source["shellCanonicalSha256"],
            source["vertices"],
            source["triangles"],
        )
        if requested == expected:
            return source
    supported = ", ".join(str(source["designRevision"]) for source in SUPPORTED_SHELLS)
    raise ValueError(
        "Requested Builder Shell identity is not an exact supported pin. "
        f"Only {supported} may be decoded by this authoring tool. Use the reviewed bundle and "
        "copy all path, digest, and count pins together; adding a new source requires a reviewed "
        "BOM and hard-limit update before parsing."
    )


def mesh_digest(
    vertices: list[tuple[float, float, float]],
    triangle_groups: list[list[tuple[int, int, int]]],
) -> str:
    result = hashlib.sha256()
    for position in vertices:
        result.update(struct.pack("<ddd", *position))
    for group in triangle_groups:
        result.update(struct.pack("<Q", len(group)))
        for triangle in group:
            result.update(struct.pack("<III", *triangle))
    return result.hexdigest()


def load_environment_from_bytes(payload: bytes, loader: Callable[[bytes], object]) -> object:
    """Keeps the parser on the exact immutable bytes whose SHA-256 was checked."""
    return loader(payload)


def normalize_sha256_argument(value: str, label: str) -> str:
    if SHA256_ARGUMENT.fullmatch(value) is None:
        raise ValueError(
            f"{label} must be exactly 64 hexadecimal characters; received {value!r}. "
            "Copy the digest from the reviewed source record instead of weakening the check."
        )
    return value.lower()


def validate_expected_count(value: int, maximum: int, label: str) -> None:
    if value < 1 or value > maximum:
        raise ValueError(
            f"{label} must be within 1..{maximum}; received {value}. Use the reviewed Shell "
            "count for the pinned bundle rather than expanding the extraction limit."
        )


def bounded_count(value: object, maximum: int, label: str) -> int:
    if isinstance(value, bool) or not isinstance(value, int) or value < 0 or value > maximum:
        raise ValueError(
            f"{label} must be an integer within 0..{maximum}; received {value!r}. Verify the "
            "exact pinned Shell bundle; do not raise a mesh bound for another source."
        )
    return value


def validate_mesh_declarations(mesh: object, source: dict[str, object]) -> None:
    vertex_data = getattr(mesh, "m_VertexData", None)
    if vertex_data is not None:
        bounded_count(
            getattr(vertex_data, "m_VertexCount", 0),
            MAX_VERTICES,
            "Shell declared vertex count",
        )
        vertex_bytes = getattr(vertex_data, "m_DataSize", b"") or b""
        if not isinstance(vertex_bytes, (bytes, bytearray)):
            raise ValueError(
                f"Shell vertex data has unsupported type {type(vertex_bytes).__name__}; "
                "verify the exact pinned bundle and UnityPy wheel."
            )
        if len(vertex_bytes) > MAX_SHELL_SERIALIZED_BYTES:
            raise ValueError(
                f"Shell vertex data has {len(vertex_bytes)} bytes; limit is "
                f"{MAX_SHELL_SERIALIZED_BYTES}. Verify the exact pinned Shell bundle; do not "
                "process or raise the bound for another mesh."
            )
        if getattr(vertex_data, "m_VertexCount", 0) != source["vertices"]:
            raise ValueError(
                f"Pinned {source['designRevision']} Shell declares "
                f"{getattr(vertex_data, 'm_VertexCount', 0)} vertices; expected "
                f"{source['vertices']}. Re-acquire the exact reviewed bundle before processing."
            )
        if len(vertex_bytes) != source["vertexDataBytes"]:
            raise ValueError(
                f"Pinned {source['designRevision']} Shell vertex data has {len(vertex_bytes)} "
                f"bytes; expected {source['vertexDataBytes']}. Re-acquire the exact reviewed "
                "bundle before processing."
            )

    index_buffer = getattr(mesh, "m_IndexBuffer", None) or []
    if len(index_buffer) > MAX_TRIANGLES * 4:
        raise ValueError(
            f"Shell raw index buffer has {len(index_buffer)} items; limit is "
            f"{MAX_TRIANGLES * 4}. Verify the exact pinned Shell bundle before processing."
        )
    if len(index_buffer) != source["indexBufferBytes"]:
        raise ValueError(
            f"Pinned {source['designRevision']} Shell raw index buffer has {len(index_buffer)} "
            f"bytes; expected {source['indexBufferBytes']}. Re-acquire the exact reviewed "
            "bundle before processing."
        )
    submeshes = getattr(mesh, "m_SubMeshes", None) or []
    if len(submeshes) > MAX_SUBMESHES:
        raise ValueError(
            f"Shell declares {len(submeshes)} submeshes; limit is {MAX_SUBMESHES}. Verify the "
            "exact pinned Shell bundle before processing."
        )
    if len(submeshes) != 1:
        raise ValueError(
            f"Pinned {source['designRevision']} Shell declares {len(submeshes)} submeshes; "
            "expected exactly 1. Re-acquire the exact reviewed bundle before processing."
        )
    declared_indices = 0
    for submesh_index, submesh in enumerate(submeshes):
        index_count = bounded_count(
            getattr(submesh, "indexCount", None),
            MAX_TRIANGLES * 4,
            f"Shell submesh {submesh_index} index count",
        )
        declared_indices += index_count
        if declared_indices > MAX_TRIANGLES * 4:
            raise ValueError(
                f"Shell submeshes declare {declared_indices} indexes in aggregate; limit is "
                f"{MAX_TRIANGLES * 4}. Verify the exact pinned Shell bundle before processing."
            )
        if getattr(submesh, "topology", None) != 0:
            raise ValueError(
                f"Pinned {source['designRevision']} Shell submesh {submesh_index} topology is "
                f"{getattr(submesh, 'topology', None)!r}; expected triangle topology 0. "
                "Re-acquire the exact reviewed bundle before processing."
            )
    if declared_indices != int(source["triangles"]) * 3:
        raise ValueError(
            f"Pinned {source['designRevision']} Shell declares {declared_indices} indexes; "
            f"expected {int(source['triangles']) * 3}. Re-acquire the exact reviewed bundle "
            "before processing."
        )
    if getattr(mesh, "m_IndexFormat", None) != 0 or getattr(mesh, "m_MeshCompression", None) != 0:
        raise ValueError(
            f"Pinned {source['designRevision']} Shell indexFormat/meshCompression is "
            f"{getattr(mesh, 'm_IndexFormat', None)!r}/"
            f"{getattr(mesh, 'm_MeshCompression', None)!r}; expected 0/0. Re-acquire the exact "
            "reviewed bundle before processing."
        )

    compressed = getattr(mesh, "m_CompressedMesh", None)
    if compressed is not None:
        for field_name in (
            "m_BindPoses",
            "m_BoneIndices",
            "m_Colors",
            "m_FloatColors",
            "m_NormalSigns",
            "m_Normals",
            "m_TangentSigns",
            "m_Tangents",
            "m_Triangles",
            "m_UV",
            "m_Vertices",
            "m_Weights",
        ):
            packed = getattr(compressed, field_name, None)
            if packed is None:
                continue
            field_limit = MAX_PACKED_MESH_ITEMS
            if field_name == "m_Triangles":
                field_limit = MAX_TRIANGLES * 3
            elif field_name == "m_Vertices":
                field_limit = MAX_VERTICES * 3
            bounded_count(
                getattr(packed, "m_NumItems", None),
                field_limit,
                f"Shell compressed field {field_name} item count",
            )
            packed_data = getattr(packed, "m_Data", None) or []
            if len(packed_data) > MAX_SHELL_SERIALIZED_BYTES:
                raise ValueError(
                    f"Shell compressed field {field_name} has {len(packed_data)} data bytes; "
                    f"limit is {MAX_SHELL_SERIALIZED_BYTES}. Verify the exact pinned Shell "
                    "bundle before processing."
                )


def extract_pinned_shell(
    environment: object,
    source: dict[str, object],
    mesh_handler_factory: Callable[[object], object],
) -> tuple[int, object]:
    expected_path_id = str(source["shellPathId"])
    target: object | None = None
    object_count = 0
    for object_count, obj in enumerate(environment.objects, 1):
        if object_count > MAX_BUNDLE_OBJECTS:
            raise ValueError(
                f"Bundle exposes more than {MAX_BUNDLE_OBJECTS} Unity objects. Verify the exact "
                "reviewed bundle; object-count limits are not an admission knob."
            )
        if str(obj.path_id) != expected_path_id:
            continue
        if target is not None:
            raise ValueError(
                f"Bundle repeats target path ID {expected_path_id}. Verify the exact pinned "
                "bundle; duplicate target objects are not decoded."
            )
        target = obj
    if target is None:
        raise ValueError(
            f"Bundle has no object at pinned Shell path ID {expected_path_id}. Verify the exact "
            "reviewed bundle and source identity."
        )
    if target.type.name != "Mesh":
        raise ValueError(
            f"Pinned Shell path ID {expected_path_id} has Unity type {target.type.name!r}; "
            "expected 'Mesh'. Verify the exact reviewed bundle before deserialization."
        )
    serialized_size = bounded_count(
        getattr(target, "byte_size", None),
        MAX_SHELL_SERIALIZED_BYTES,
        f"Pinned Shell path ID {expected_path_id} serialized byte size",
    )
    if serialized_size == 0:
        raise ValueError(
            f"Pinned Shell path ID {expected_path_id} declares an empty serialized payload. "
            "Verify the exact reviewed bundle before deserialization."
        )
    if serialized_size != source["serializedBytes"]:
        raise ValueError(
            f"Pinned {source['designRevision']} Shell serialized byte size is "
            f"{serialized_size}; expected {source['serializedBytes']}. Re-acquire the exact "
            "reviewed bundle before deserialization."
        )
    data = target.read()
    if getattr(data, "m_Name", "") != "Shell":
        raise ValueError(
            f"Pinned Mesh path ID {expected_path_id} is named "
            f"{getattr(data, 'm_Name', '')!r}; expected 'Shell'. Verify the exact reviewed "
            "bundle before processing."
        )
    validate_mesh_declarations(data, source)
    handler = mesh_handler_factory(data)
    handler.process()
    return int(target.path_id), handler


def bounded_mesh_data(
    handler: object,
) -> tuple[
    list[tuple[float, float, float]],
    list[list[tuple[int, int, int]]],
]:
    raw_vertices = handler.m_Vertices
    if len(raw_vertices) > MAX_VERTICES:
        raise ValueError(
            f"Shell contains {len(raw_vertices)} vertices; hard limit is {MAX_VERTICES}. "
            "Verify the pinned Shell path ID and bundle instead of increasing the limit."
        )
    vertices: list[tuple[float, float, float]] = []
    for vertex_index, raw_vertex in enumerate(raw_vertices):
        if len(raw_vertex) < 3:
            raise ValueError(
                f"Shell vertex {vertex_index} has {len(raw_vertex)} coordinates; expected at least 3."
            )
        vertex = tuple(map(float, raw_vertex[:3]))
        if any(not math.isfinite(coordinate) for coordinate in vertex):
            raise ValueError(f"Shell vertex {vertex_index} contains a non-finite coordinate.")
        vertices.append(vertex)

    triangle_groups: list[list[tuple[int, int, int]]] = []
    triangle_count = 0
    for group_index, raw_group in enumerate(handler.get_triangles()):
        group: list[tuple[int, int, int]] = []
        for triangle_index, raw_triangle in enumerate(raw_group):
            triangle_count += 1
            if triangle_count > MAX_TRIANGLES:
                raise ValueError(
                    f"Shell exceeds the hard {MAX_TRIANGLES}-triangle limit while reading group "
                    f"{group_index}. Verify the pinned Shell path ID and bundle instead of "
                    "increasing the limit."
                )
            if len(raw_triangle) != 3:
                raise ValueError(
                    f"Shell triangle {group_index}:{triangle_index} has {len(raw_triangle)} "
                    "indexes; expected exactly 3."
                )
            converted: list[int] = []
            for raw_index in raw_triangle:
                index = int(raw_index)
                if isinstance(raw_index, bool) or float(raw_index) != index:
                    raise ValueError(
                        f"Shell triangle {group_index}:{triangle_index} contains non-integral "
                        f"index {raw_index!r}."
                    )
                if index < 0 or index >= len(vertices):
                    raise ValueError(
                        f"Shell triangle {group_index}:{triangle_index} index {index} is outside "
                        f"0..{len(vertices) - 1}."
                    )
                converted.append(index)
            group.append(tuple(converted))
        triangle_groups.append(group)
    return vertices, triangle_groups


def build_shell_report(
    payload: bytes,
    source: dict[str, object],
    unitypy_loader: Callable[[bytes], object],
    mesh_handler_factory: Callable[[object], object],
) -> dict[str, object]:
    actual_bundle_sha256 = sha256(payload)
    if actual_bundle_sha256 != source["bundleSha256"]:
        raise ValueError(
            f"Bundle SHA-256 differs: {actual_bundle_sha256} != {source['bundleSha256']}. "
            "Use the exact reviewed Builder bundle; changing the expected digest does not "
            "authorize a replacement source."
        )
    environment = load_environment_from_bytes(payload, unitypy_loader)
    path_id, handler = extract_pinned_shell(environment, source, mesh_handler_factory)
    canonical_vertices, triangle_groups = bounded_mesh_data(handler)
    triangles = [triangle for group in triangle_groups for triangle in group]
    canonical_sha256 = mesh_digest(canonical_vertices, triangle_groups)
    if str(path_id) != source["shellPathId"]:
        raise ValueError(
            f"Shell path ID differs: {path_id} != {source['shellPathId']}. Use the exact "
            "reviewed bundle and asset-audit identity."
        )
    if canonical_sha256 != source["shellCanonicalSha256"]:
        raise ValueError(
            f"Shell canonical SHA-256 differs: {canonical_sha256} != "
            f"{source['shellCanonicalSha256']}. Re-run the source audit; do not rehash an "
            "unreviewed mesh into the expected value."
        )
    if len(canonical_vertices) != source["vertices"]:
        raise ValueError(
            f"Shell vertex count differs: {len(canonical_vertices)} != {source['vertices']}. "
            "Verify the reviewed bundle, path ID, and UnityPy version."
        )
    if len(triangles) != source["triangles"]:
        raise ValueError(
            f"Shell triangle count differs: {len(triangles)} != {source['triangles']}. "
            "Verify the reviewed bundle, path ID, and UnityPy version."
        )
    return {
        "schemaVersion": "lego.builder-shell-inspection/2",
        "bundleSha256": f"sha256:{actual_bundle_sha256}",
        "shellPathId": str(path_id),
        "shellCanonicalSha256": f"sha256:{canonical_sha256}",
        "verticesLdu": [
            [-25.0 * vertex[0], -25.0 * vertex[1], -25.0 * vertex[2]]
            for vertex in canonical_vertices
        ],
        "triangles": [list(triangle) for triangle in triangles],
    }


def validate_shell_report(
    report: object, source: dict[str, object]
) -> dict[str, object]:
    if not isinstance(report, dict):
        raise ValueError(
            f"Isolated worker report must be a JSON object; received {type(report).__name__}."
        )
    expected_keys = {
        "schemaVersion",
        "bundleSha256",
        "shellPathId",
        "shellCanonicalSha256",
        "verticesLdu",
        "triangles",
    }
    if set(report) != expected_keys:
        raise ValueError(
            "Isolated worker report has an unexpected schema; "
            f"extra={sorted(set(report) - expected_keys)}, "
            f"missing={sorted(expected_keys - set(report))}."
        )
    expected_scalars = {
        "schemaVersion": "lego.builder-shell-inspection/2",
        "bundleSha256": f"sha256:{source['bundleSha256']}",
        "shellPathId": str(source["shellPathId"]),
        "shellCanonicalSha256": f"sha256:{source['shellCanonicalSha256']}",
    }
    for field_name, expected in expected_scalars.items():
        if report[field_name] != expected:
            raise ValueError(
                f"Isolated worker report {field_name} is {report[field_name]!r}; expected "
                f"{expected!r}. Discard the report and rerun the pinned extraction."
            )

    raw_vertices = report["verticesLdu"]
    if not isinstance(raw_vertices, list) or len(raw_vertices) != source["vertices"]:
        actual_count = len(raw_vertices) if isinstance(raw_vertices, list) else "non-list"
        raise ValueError(
            f"Isolated worker report has {actual_count} vertices; expected "
            f"{source['vertices']}. Discard the report and rerun the pinned extraction."
        )
    canonical_vertices: list[tuple[float, float, float]] = []
    for vertex_index, raw_vertex in enumerate(raw_vertices):
        if not isinstance(raw_vertex, list) or len(raw_vertex) != 3:
            raise ValueError(
                f"Isolated worker report vertex {vertex_index} must have exactly three "
                f"coordinates; received {raw_vertex!r}."
            )
        coordinates: list[float] = []
        for coordinate in raw_vertex:
            if isinstance(coordinate, bool) or not isinstance(coordinate, (int, float)):
                raise ValueError(
                    f"Isolated worker report vertex {vertex_index} contains non-numeric "
                    f"coordinate {coordinate!r}."
                )
            converted = float(coordinate)
            if not math.isfinite(converted):
                raise ValueError(
                    f"Isolated worker report vertex {vertex_index} contains non-finite "
                    f"coordinate {coordinate!r}."
                )
            coordinates.append(-converted / 25.0)
        canonical_vertices.append(tuple(coordinates))

    raw_triangles = report["triangles"]
    if not isinstance(raw_triangles, list) or len(raw_triangles) != source["triangles"]:
        actual_count = len(raw_triangles) if isinstance(raw_triangles, list) else "non-list"
        raise ValueError(
            f"Isolated worker report has {actual_count} triangles; expected "
            f"{source['triangles']}. Discard the report and rerun the pinned extraction."
        )
    triangles: list[tuple[int, int, int]] = []
    for triangle_index, raw_triangle in enumerate(raw_triangles):
        if not isinstance(raw_triangle, list) or len(raw_triangle) != 3:
            raise ValueError(
                f"Isolated worker report triangle {triangle_index} must have exactly three "
                f"indexes; received {raw_triangle!r}."
            )
        converted_triangle: list[int] = []
        for index in raw_triangle:
            if isinstance(index, bool) or not isinstance(index, int):
                raise ValueError(
                    f"Isolated worker report triangle {triangle_index} contains non-integer "
                    f"index {index!r}."
                )
            if index < 0 or index >= len(canonical_vertices):
                raise ValueError(
                    f"Isolated worker report triangle {triangle_index} index {index} is outside "
                    f"0..{len(canonical_vertices) - 1}."
                )
            converted_triangle.append(index)
        triangles.append(tuple(converted_triangle))

    actual_canonical_sha256 = mesh_digest(canonical_vertices, [triangles])
    if actual_canonical_sha256 != source["shellCanonicalSha256"]:
        raise ValueError(
            f"Isolated worker report mesh SHA-256 is {actual_canonical_sha256}; expected "
            f"{source['shellCanonicalSha256']}. The worker output was modified or malformed; "
            "discard it and rerun the pinned extraction."
        )
    return report
def snapshot_worker_main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(add_help=False)
    parser.add_argument("--packages", type=Path, required=True)
    parser.add_argument("--bundle", type=Path, required=True)
    parser.add_argument("--report", type=Path, required=True)
    parser.add_argument("--source-index", type=int, required=True)
    args = parser.parse_args(argv)

    SNAPSHOT.validate_worker_runtime()
    if args.source_index < 0 or args.source_index >= len(SUPPORTED_SHELLS):
        raise ValueError(
            f"Isolated worker source index {args.source_index} is outside 0.."
            f"{len(SUPPORTED_SHELLS) - 1}. The controller must select an exact supported pin."
        )
    packages = args.packages.resolve(strict=True)
    private_root = packages.parent.resolve(strict=True)
    bundle = args.bundle.resolve(strict=True)
    report = args.report.resolve(strict=False)
    if (
        packages.name != "packages"
        or bundle.parent != private_root
        or report.parent.resolve(strict=True) != private_root
        or report.exists()
    ):
        raise ValueError(
            "Isolated worker inputs must be fresh siblings inside one private controller-owned "
            "temporary directory. Do not invoke the worker against a mutable package root or "
            "pre-existing report."
        )

    captured_payloads = SNAPSHOT.capture_pinned_import_payloads(packages)
    SNAPSHOT.assert_exact_snapshot_tree(packages, captured_payloads)
    bundle_payload = bounded_bytes(bundle, MAX_BUNDLE_BYTES, "Private captured bundle")

    sys.dont_write_bytecode = True
    sys.path[:] = [str(packages), *SNAPSHOT.trusted_runtime_paths()]
    sys.path_importer_cache.clear()
    importlib.invalidate_caches()
    pinned_top_levels = {
        top_level
        for distribution in SNAPSHOT.PINNED_DISTRIBUTIONS
        for top_level in distribution["topLevels"]
    }
    preloaded = sorted(
        module_name
        for module_name in sys.modules
        if module_name.split(".", 1)[0] in pinned_top_levels
    )
    if preloaded:
        raise ValueError(
            f"Pinned packages were imported before snapshot validation: {preloaded}. Run only "
            "the controller-created isolated worker."
        )
    baseline_modules = set(sys.modules)

    dll_handles: list[object] = []
    try:
        if hasattr(os, "add_dll_directory"):
            native_directories = sorted(
                {
                    packages.joinpath(*PurePosixPath(package_path).parts).parent
                    for package_path in captured_payloads
                    if PurePosixPath(package_path).suffix.lower() in {".dll", ".pyd"}
                },
                key=str,
            )
            dll_handles = [os.add_dll_directory(str(path)) for path in native_directories]
        unitypy = importlib.import_module("UnityPy")
        mesh_helper = importlib.import_module("UnityPy.helpers.MeshHelper")
        expected_unitypy_path = packages / "UnityPy" / "__init__.py"
        expected_mesh_helper_path = packages / "UnityPy" / "helpers" / "MeshHelper.py"
        actual_unitypy_path = Path(unitypy.__file__).resolve(strict=True)
        actual_mesh_helper_path = Path(mesh_helper.__file__).resolve(strict=True)
        if actual_unitypy_path != expected_unitypy_path:
            raise ValueError(
                f"Imported UnityPy from {actual_unitypy_path}; expected private snapshot path "
                f"{expected_unitypy_path}. No mutable original package root may execute."
            )
        if actual_mesh_helper_path != expected_mesh_helper_path:
            raise ValueError(
                f"Imported MeshHelper from {actual_mesh_helper_path}; expected private snapshot "
                f"path {expected_mesh_helper_path}. No mutable original package root may execute."
            )
        if getattr(unitypy, "__version__", None) != SNAPSHOT.UNITYPY_VERSION:
            raise ValueError(
                f"Imported UnityPy version {getattr(unitypy, '__version__', None)!r}; expected "
                f"{SNAPSHOT.UNITYPY_VERSION}. Reinstall the exact pinned wheel artifact sha256 "
                f"{SNAPSHOT.UNITYPY_WHEEL_SHA256}."
            )
        SNAPSHOT.assert_new_import_origins(baseline_modules, packages)
        source = SUPPORTED_SHELLS[args.source_index]
        shell_report = build_shell_report(
            bundle_payload, source, unitypy.load, mesh_helper.MeshHandler
        )
        SNAPSHOT.assert_new_import_origins(baseline_modules, packages)
        validate_shell_report(shell_report, source)
        encoded = json.dumps(
            shell_report, separators=(",", ":"), ensure_ascii=True, allow_nan=False
        ).encode("utf-8")
        write_atomic(report, encoded)
    finally:
        for handle in reversed(dll_handles):
            handle.close()
    return 0


def write_atomic(path: Path, payload: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    descriptor, temporary = tempfile.mkstemp(prefix=f".{path.name}.", dir=path.parent)
    try:
        with os.fdopen(descriptor, "wb") as stream:
            stream.write(payload)
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary, path)
    except BaseException:
        Path(temporary).unlink(missing_ok=True)
        raise


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Extract one exact LEGO Builder Shell into its fixed decoded local frame."
    )
    parser.add_argument("--unitypy", type=Path, required=True)
    parser.add_argument("--bundle", type=Path, required=True)
    parser.add_argument("--expected-bundle-sha256", required=True)
    parser.add_argument("--expected-shell-path-id", required=True)
    parser.add_argument("--expected-shell-canonical-sha256", required=True)
    parser.add_argument("--expected-vertices", type=int, required=True)
    parser.add_argument("--expected-triangles", type=int, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()

    expected_bundle_sha256 = normalize_sha256_argument(
        args.expected_bundle_sha256, "Expected bundle SHA-256"
    )
    expected_shell_canonical_sha256 = normalize_sha256_argument(
        args.expected_shell_canonical_sha256, "Expected Shell canonical SHA-256"
    )
    if re.fullmatch(r"-?[0-9]+", args.expected_shell_path_id) is None:
        raise ValueError(
            f"Expected Shell path ID must be a signed decimal integer; received "
            f"{args.expected_shell_path_id!r}. Copy the path ID from the reviewed asset audit."
        )
    validate_expected_count(args.expected_vertices, MAX_VERTICES, "Expected vertex count")
    validate_expected_count(args.expected_triangles, MAX_TRIANGLES, "Expected triangle count")
    source = supported_shell(
        expected_bundle_sha256,
        args.expected_shell_path_id,
        expected_shell_canonical_sha256,
        args.expected_vertices,
        args.expected_triangles,
    )

    payload = bounded_bytes(args.bundle, MAX_BUNDLE_BYTES, "Bundle")
    actual_bundle_sha256 = sha256(payload)
    if actual_bundle_sha256 != expected_bundle_sha256:
        raise ValueError(
            f"Bundle SHA-256 differs: {actual_bundle_sha256} != {expected_bundle_sha256}. "
            "Use the exact reviewed Builder bundle; changing the expected digest does not "
            "authorize a replacement source."
        )
    SNAPSHOT.validate_worker_runtime()
    captured_payloads = SNAPSHOT.capture_pinned_import_payloads(args.unitypy)
    with tempfile.TemporaryDirectory(prefix="lego-builder-pinned-import-") as directory:
        private_root = Path(directory).resolve(strict=True)
        private_root.chmod(0o700)
        packages = private_root / "packages"
        bundle = private_root / "bundle.bin"
        worker_report = private_root / "report.json"
        SNAPSHOT.write_private_import_snapshot(packages, captured_payloads)
        SNAPSHOT.assert_exact_snapshot_tree(packages, captured_payloads)
        write_atomic(bundle, payload)
        # Security boundary: isolated mode prevents the mutable source tree, user site, and
        # environment-provided import paths from reopening bytes after RECORD verification.
        command = [
            sys.executable,
            "-I",
            "-S",
            "-B",
            str(Path(__file__).resolve(strict=True)),
            SNAPSHOT_WORKER_FLAG,
            "--packages",
            str(packages),
            "--bundle",
            str(bundle),
            "--report",
            str(worker_report),
            "--source-index",
            str(SUPPORTED_SHELLS.index(source)),
        ]
        try:
            completed = subprocess.run(
                command,
                cwd=private_root,
                env=SNAPSHOT.isolated_worker_environment(),
                capture_output=True,
                text=True,
                check=False,
                timeout=WORKER_TIMEOUT_SECONDS,
                creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
            )
        except subprocess.TimeoutExpired as error:
            raise ValueError(
                f"Isolated Builder importer exceeded {WORKER_TIMEOUT_SECONDS} seconds. Verify "
                "the exact pinned bundle and dependency snapshot; do not increase the timeout "
                "for another source."
            ) from error
        if completed.returncode != 0:
            diagnostic = (completed.stderr or completed.stdout or "no diagnostic").strip()
            diagnostic = diagnostic[-MAX_WORKER_DIAGNOSTIC_CHARACTERS:]
            raise ValueError(
                f"Isolated Builder importer exited {completed.returncode}. The bounded worker "
                f"diagnostic follows:\n{diagnostic}"
            )
        if completed.stdout.strip():
            diagnostic = completed.stdout.strip()[-MAX_WORKER_DIAGNOSTIC_CHARACTERS:]
            raise ValueError(
                "Isolated Builder importer produced unexpected standard output; pinned imports "
                f"must be silent. Bounded output follows:\n{diagnostic}"
            )
        report_payload = bounded_bytes(
            worker_report, MAX_WORKER_REPORT_BYTES, "Isolated worker report"
        )
        report = validate_shell_report(
            SNAPSHOT.finite_json_loads(report_payload, "Isolated worker report"), source
        )

    output = args.output.resolve()
    encoded = json.dumps(
        report, separators=(",", ":"), ensure_ascii=True, allow_nan=False
    ).encode("utf-8")
    write_atomic(output, encoded)
    print(
        json.dumps(
            {
                "output": str(output),
                "vertices": len(report["verticesLdu"]),
                "triangles": len(report["triangles"]),
                "bundleSha256": actual_bundle_sha256,
                "shellCanonicalSha256": source["shellCanonicalSha256"],
            },
            indent=2,
        )
    )
    return 0


if __name__ == "__main__":
    if sys.argv[1:2] == [SNAPSHOT_WORKER_FLAG]:
        raise SystemExit(snapshot_worker_main(sys.argv[2:]))
    raise SystemExit(main())
