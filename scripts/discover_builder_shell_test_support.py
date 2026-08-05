"""Shared fixtures for the quarantined 3245 Builder shell discovery tests.

Both test modules load the discovery entry point exactly once through this
module, so a patch applied to DISCOVERY, CORE, META, or PUBLICATION is seen by
every test in the suite.
"""

from __future__ import annotations
import importlib.util
from pathlib import Path
from types import SimpleNamespace


SCRIPT = Path(__file__).with_name("discover-builder-shell.py")
SPEC = importlib.util.spec_from_file_location("discover_builder_shell", SCRIPT)
if SPEC is None or SPEC.loader is None:
    raise RuntimeError(f"Cannot load {SCRIPT}")
DISCOVERY = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(DISCOVERY)
CORE = DISCOVERY.CORE
META = CORE.META
PUBLICATION = CORE.PUBLICATION


class FakeObject:
    def __init__(
        self,
        type_name: str,
        name: str,
        path_id: int,
        byte_size: int,
        value: object | None = None,
        *,
        forbid_peek: bool = False,
        forbid_read: bool = False,
    ) -> None:
        self.type = SimpleNamespace(name=type_name)
        self._name = name
        self.path_id = path_id
        self.byte_size = byte_size
        self.value = value
        self.forbid_peek = forbid_peek
        self.forbid_read = forbid_read
        self.peek_calls = 0
        self.read_calls = 0

    def peek_name(self) -> str:
        self.peek_calls += 1
        if self.forbid_peek:
            raise AssertionError("unbounded object metadata must not be read")
        return self._name

    def read(self) -> object:
        self.read_calls += 1
        if self.forbid_read:
            raise AssertionError("object must not be decoded")
        return self.value


def mesh_value(*, compressed: object | None = None) -> object:
    return SimpleNamespace(
        m_Name="Shell",
        m_VertexData=SimpleNamespace(m_VertexCount=3, m_DataSize=b"v" * 36),
        m_IndexBuffer=b"i" * 6,
        m_SubMeshes=[SimpleNamespace(topology=0, indexCount=3)],
        m_MeshCompression=0,
        m_CompressedMesh=compressed,
    )


def text_value(name: str, payload: str | bytes) -> object:
    return SimpleNamespace(m_Name=name, m_Script=payload)


PRIMITIVE_XML = (
    '<Primitive><Connectivity><Fixed type="4" '
    'transform="1,0,0,0,1,0,0,0,1,2,3,4"/></Connectivity></Primitive>'
)
class FakeHandler:
    process_calls = 0

    def __init__(self, _mesh: object) -> None:
        self.m_Vertices = [(0.0, 0.0, 0.0), (1.0, 0.0, 0.0), (0.0, 1.0, 0.0)]

    def process(self) -> None:
        type(self).process_calls += 1

    def get_triangles(self) -> list[list[tuple[int, int, int]]]:
        return [[(0, 1, 2)]]


def environment(*, partinfo: bool = True) -> tuple[object, dict[str, FakeObject]]:
    arbitrary = FakeObject("Texture2D", "malicious", 1, 10, forbid_peek=True, forbid_read=True)
    other_mesh = FakeObject("Mesh", "NotShell", 2, 128, forbid_read=True)
    shell = FakeObject("Mesh", "Shell", 3, 128, mesh_value())
    primitive = FakeObject(
        "TextAsset",
        "Primitive.xml",
        4,
        200,
        text_value("Primitive.xml", PRIMITIVE_XML),
    )
    objects = [arbitrary, other_mesh, shell, primitive]
    named = {"arbitrary": arbitrary, "other": other_mesh, "shell": shell, "primitive": primitive}
    if partinfo:
        info = FakeObject(
            "TextAsset",
            "PartInfo.json",
            5,
            100,
            text_value("PartInfo.json", '{"designId":"3245","revision":"M","name":"Fixture"}'),
        )
        objects.append(info)
        named["partinfo"] = info
    container = {
        "Assets/Primitive.xml": primitive,
        **({"Assets/PartInfo.json": named["partinfo"]} if partinfo else {}),
    }
    return SimpleNamespace(objects=objects, container=container), named


def valid_report() -> dict[str, object]:
    return {
        "catalogAdmitted": False,
        "partInfo": None,
        "primitiveXml": {
            "connectorCenters": [{"center": [2.0, 3.0, 4.0], "kind": "Fixed", "type": "4"}],
            "name": "Primitive.xml",
            "pathId": "4",
            "serializedBytes": 200,
            "sha256": "sha256:" + "b" * 64,
        },
        "schemaVersion": CORE.SCHEMA_VERSION,
        "shell": {
            "canonicalMeshSha256": "sha256:" + "a" * 64,
            "canonicalTriangles": 1,
            "canonicalVertices": 3,
            "declaredCompression": 0,
            "declaredSubmeshes": 1,
            "declaredTopologies": [0],
            "declaredTriangles": 1,
            "declaredVertices": 3,
            "indexBufferBytes": 6,
            "pathId": "3",
            "serializedBytes": 128,
            "vertexDataBytes": 36,
        },
        "source": {
            "bundleBytes": CORE.BUNDLE_BYTES,
            "bundleSha256": "sha256:" + CORE.BUNDLE_SHA256,
            "designId": "3245",
            "revision": "M",
        },
        "status": "quarantined-source-evidence-only",
        "supported": False,
    }

