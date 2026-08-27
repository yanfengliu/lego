"""Reproduce bounded source evidence from the exact Builder 2453-I bundle.

This tool emits measurement evidence only. It cannot admit a catalog part or grant
identity, frame, placement, action, replay, mutation, or completion authority.
"""

from __future__ import annotations

import argparse
import hashlib
import importlib
import importlib.util
import json
import os
import re
import sys
import tempfile
from pathlib import Path, PurePosixPath
from types import ModuleType


BUNDLE_BYTES = 82_073
BUNDLE_SHA256 = "a14c214b69dc57b3123c96e4e15b92f5bd4541d5b8eccfc3885e0bcb5d30a955"
SCHEMA_VERSION = "lego.part-identification-2453-builder-bundle-proof/1"
MAX_REPORT_BYTES = 64 * 1024
WORKER_FLAG = "--isolated-2453-builder-bundle-proof-worker"
SCRIPT_ROOT = Path(__file__).resolve(strict=True).parent
if str(SCRIPT_ROOT) not in sys.path:
    sys.path.insert(0, str(SCRIPT_ROOT))


def _load_sibling(name: str, filename: str) -> ModuleType:
    spec = importlib.util.spec_from_file_location(name, Path(__file__).with_name(filename))
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Cannot load required sibling {filename}.")
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    try:
        spec.loader.exec_module(module)
    except BaseException:
        sys.modules.pop(name, None)
        raise
    return module


DISCOVERY = _load_sibling("builder_2453_discovery_boundary", "discover-builder-shell.py")
FIELD = _load_sibling("builder_2453_field_semantics", "builder_ldraw_field.py")
CORE = DISCOVERY.CORE
META = CORE.META
SNAPSHOT = DISCOVERY.SNAPSHOT
canonical_json_bytes = DISCOVERY.canonical_json_bytes
strict_json_loads = DISCOVERY.strict_json_loads


EXPECTED_ROSTER = (
    {
        "pathId": "-8850176407552686250",
        "type": "Mesh",
        "serializedBytes": 1_044,
        "name": "VME_11002453_LEG_Front_1",
        "locators": ["assets/geometry/2453/2453.fbx"],
    },
    {
        "pathId": "-6688524684917211877",
        "type": "TextAsset",
        "serializedBytes": 3_092,
        "name": "2453",
        "locators": ["assets/geometry/2453/2453.xml"],
    },
    {
        "pathId": "-5616863914101638823",
        "type": "TextAsset",
        "serializedBytes": 104,
        "name": "partinfo",
        "locators": ["assets/geometry/2453/partinfo.json"],
    },
    {
        "pathId": "-4781304290267089130",
        "type": "Mesh",
        "serializedBytes": 6_980,
        "name": "Shell",
        "locators": ["assets/geometry/2453/2453.fbx"],
    },
)


def sha256(payload: bytes) -> str:
    return hashlib.sha256(payload).hexdigest()


def exact_bundle(path: Path, label: str) -> bytes:
    payload = DISCOVERY.capture_regular_bytes(path, BUNDLE_BYTES, label)
    actual = sha256(payload)
    if len(payload) != BUNDLE_BYTES or actual != BUNDLE_SHA256:
        raise ValueError(
            f"{label} identity is {len(payload)} bytes sha256:{actual}; expected exactly "
            f"{BUNDLE_BYTES} bytes sha256:{BUNDLE_SHA256}."
        )
    return payload


def bounded_roster(environment: object) -> tuple[list[dict[str, object]], dict[str, object]]:
    locators = META._locator_map(environment)
    rows: list[dict[str, object]] = []
    candidates: dict[str, object] = {}
    named_count = 0
    for object_count, reader in enumerate(environment.objects, 1):
        if object_count > META.MAX_OBJECTS:
            raise ValueError(f"Bundle exposes more than {META.MAX_OBJECTS} objects.")
        type_name = getattr(getattr(reader, "type", None), "name", None)
        if type_name not in {"Mesh", "TextAsset"}:
            continue
        named_count += 1
        if named_count > META.MAX_NAMED_CANDIDATES:
            raise ValueError(
                f"Bundle exposes more than {META.MAX_NAMED_CANDIDATES} named candidates."
            )
        maximum = META.MAX_SERIALIZED_BYTES if type_name == "Mesh" else META.MAX_TEXT_BYTES
        serialized = META.bounded_int(
            getattr(reader, "byte_size", None),
            maximum,
            f"{type_name} serialized bytes",
            minimum=1,
        )
        peek = getattr(reader, "peek_name", None)
        if not callable(peek):
            raise ValueError(f"Bounded {type_name} candidate lacks peek_name().")
        name = META.bounded_name(peek(), f"{type_name} name")
        path_id = str(getattr(reader, "path_id", ""))
        if re.fullmatch(r"-?[0-9]+", path_id) is None:
            raise ValueError(f"{type_name} path ID {path_id!r} is malformed.")
        row = {
            "pathId": path_id,
            "type": type_name,
            "serializedBytes": serialized,
            "name": name,
            "locators": list(locators.get(path_id, ())),
        }
        rows.append(row)
        if name in candidates:
            raise ValueError(f"Bundle repeats bounded candidate name {name!r}.")
        candidates[name] = META.Candidate(
            reader, path_id, name, serialized, tuple(row["locators"])
        )
    if tuple(rows) != EXPECTED_ROSTER:
        raise ValueError("Exact 2453-I Mesh/TextAsset roster drifted from the reviewed bundle.")
    return rows, candidates


def primitive_report(candidate: object) -> dict[str, object]:
    payload = META._read_text(candidate, "2453 primitive XML")
    root = META._xml_root(payload, "2453 primitive XML")
    if META._local_name(root.tag) != "LEGOPrimitive" or root.attrib != {
        "versionMajor": "2",
        "versionMinor": "0",
    }:
        raise ValueError("2453 primitive XML root/version drifted.")
    annotations: dict[str, str] = {}
    annotation_roots = [node for node in root if META._local_name(node.tag) == "Annotations"]
    if len(annotation_roots) != 1:
        raise ValueError("2453 primitive XML must contain exactly one Annotations element.")
    for node in annotation_roots[0]:
        if META._local_name(node.tag) != "Annotation" or len(node.attrib) != 1:
            raise ValueError("2453 primitive XML contains malformed annotation metadata.")
        key, value = next(iter(node.attrib.items()))
        if key in annotations:
            raise ValueError(f"2453 primitive XML repeats annotation {key!r}.")
        annotations[key] = value
    identity = {
        "aliases": annotations.get("aliases"),
        "designname": annotations.get("designname"),
        "revision": annotations.get("revision"),
        "superdesignid": annotations.get("superdesignid"),
    }
    if identity != {
        "aliases": "2453",
        "designname": "BRICK 1X1X5",
        "revision": "I",
        "superdesignid": "11002453",
    }:
        raise ValueError("2453 primitive annotations do not identify exact revision I.")
    roots = [node for node in root if META._local_name(node.tag) == "Connectivity"]
    if len(roots) != 1 or len(roots[0]) != 2:
        raise ValueError("2453 primitive XML must expose exactly two direct connectivity fields.")
    fields: list[dict[str, object]] = []
    native_fields: list[dict[str, object]] = []
    for index, node in enumerate(roots[0]):
        if META._local_name(node.tag) != "Custom2DField":
            raise ValueError(f"2453 connectivity field {index} is not Custom2DField.")
        expected = (
            {
                "type": "23",
                "width": "2",
                "height": "2",
                "transformation": "1,0,0,0,1,0,0,0,1,-0.4,4.8,-0.4",
                "centerFamily": "0:4:1",
            },
            {
                "type": "22",
                "width": "2",
                "height": "2",
                "transformation": "1,0,0,0,1,0,0,0,1,-0.4,0,-0.4",
                "centerFamily": "15:4:1",
            },
        )[index]
        for key in ("type", "width", "height", "transformation"):
            if node.attrib.get(key) != expected[key]:
                raise ValueError(f"2453 connectivity field {index} {key} drifted.")
        cells = [cell.strip() for cell in (node.text or "").split(",") if cell.strip()]
        if len(cells) != 9 or cells[4] != expected["centerFamily"]:
            raise ValueError(f"2453 connectivity field {index} lost its exact center family.")
        fields.append(
            {
                "kind": "Custom2DField",
                **expected,
                "gridSha256": f"sha256:{sha256(','.join(cells).encode('ascii'))}",
            }
        )
        native_fields.append(
            {
                "kind": "Custom2DField",
                "attributes": {
                    key: str(expected[key])
                    for key in ("type", "width", "height", "transformation")
                },
                "grid": ",".join(cells),
            }
        )
    nodes = FIELD.builder_field_nodes(
        {"id": "2453", "connectivityPrimitives": native_fields}
    )
    male = [node for node in nodes if node.field_type == 23 and node.role == "male"]
    female = [node for node in nodes if node.field_type == 22 and node.role == "female"]
    if (
        FIELD.MALE_FAMILIES != {0: "solid-stud", 1: "open-stud"}
        or FIELD.FEMALE_FAMILIES != {15: "under-stud-clutch"}
        or len(male) != 1
        or male[0].family != 0
        or len(female) != 1
        or female[0].family != 15
    ):
        raise ValueError("2453 Builder field does not derive one solid male stud and one clutch.")
    return {
        "bytes": len(payload),
        "sha256": f"sha256:{sha256(payload)}",
        "pathId": candidate.path_id,
        "identity": identity,
        "connectivity": fields,
        "connectorSemantics": {
            "familyContract": {
                "male": {str(key): value for key, value in FIELD.MALE_FAMILIES.items()},
                "female": {str(key): value for key, value in FIELD.FEMALE_FAMILIES.items()},
            },
            "solidMaleStud": {
                "fieldType": male[0].field_type,
                "family": male[0].family,
                "code": male[0].code,
                "centerBuilder": [str(value) for value in male[0].builder],
                "axis": list(male[0].axis),
            },
            "openMaleStudCount": sum(node.family == 1 for node in nodes),
            "undersideClutch": {
                "fieldType": female[0].field_type,
                "family": female[0].family,
                "code": female[0].code,
                "centerBuilder": [str(value) for value in female[0].builder],
                "axis": list(female[0].axis),
            },
        },
    }


def partinfo_report(candidate: object) -> dict[str, object]:
    payload = META._read_text(candidate, "2453 partinfo")
    value = strict_json_loads(payload, "2453 partinfo")
    expected = {
        "ItemId": "VX0002453",
        "Name": "11002453",
        "IsFoil": False,
        "SuperDesign": "11002453",
    }
    if value != expected:
        raise ValueError("2453 partinfo no longer identifies exact VX0002453 source geometry.")
    return {
        "bytes": len(payload),
        "sha256": f"sha256:{sha256(payload)}",
        "pathId": candidate.path_id,
        "value": value,
    }


def build_report(bundle_payload: bytes, unitypy: object, mesh_helper: object) -> dict[str, object]:
    environment = CORE.EXTRACTOR.load_environment_from_bytes(bundle_payload, unitypy.load)
    roster, candidates = bounded_roster(environment)
    report = {
        "schemaVersion": SCHEMA_VERSION,
        "environment": {
            "contractSha256": f"sha256:{SNAPSHOT.PINNED_ENVIRONMENT_DIGEST}",
            "unityPyVersion": SNAPSHOT.UNITYPY_VERSION,
        },
        "bundle": {"bytes": len(bundle_payload), "sha256": f"sha256:{sha256(bundle_payload)}"},
        "roster": roster,
        "primitive": primitive_report(candidates["2453"]),
        "partinfo": partinfo_report(candidates["partinfo"]),
        "shell": CORE.shell_report(candidates["Shell"], mesh_helper.MeshHandler),
        "conclusion": "bounded-source-measurement-only-no-authority",
    }
    encoded = canonical_json_bytes(report)
    if len(encoded) > MAX_REPORT_BYTES:
        raise ValueError(f"2453 bundle proof has {len(encoded)} bytes; limit is {MAX_REPORT_BYTES}.")
    return report


def worker_main(arguments: list[str]) -> int:
    parser = argparse.ArgumentParser(add_help=False)
    parser.add_argument("--packages", type=Path, required=True)
    parser.add_argument("--bundle", type=Path, required=True)
    parser.add_argument("--report", type=Path, required=True)
    args = parser.parse_args(arguments)
    SNAPSHOT.validate_worker_runtime()
    packages, package_rows = DISCOVERY.stable_directory(args.packages, "Private package snapshot")
    private_root, private_rows = DISCOVERY.stable_directory(packages.parent, "Private worker root")
    bundle = Path(os.path.abspath(os.fspath(args.bundle)))
    report = Path(os.path.abspath(os.fspath(args.report)))
    if packages.name != "packages" or bundle.parent != private_root or report.parent != private_root:
        raise ValueError("Worker inputs must be siblings in one private controller root.")
    if report.exists():
        raise ValueError("Worker report target must be fresh.")
    package_payloads = SNAPSHOT.capture_pinned_import_payloads(packages)
    SNAPSHOT.assert_exact_snapshot_tree(packages, package_payloads)
    bundle_payload = exact_bundle(bundle, "Private 2453-I bundle")
    DISCOVERY._assert_chain(package_rows, "Private package snapshot")
    DISCOVERY._assert_chain(private_rows, "Private worker root")
    sys.dont_write_bytecode = True
    sys.path[:] = [str(packages), *SNAPSHOT.trusted_runtime_paths()]
    sys.path_importer_cache.clear()
    importlib.invalidate_caches()
    pinned = {name for row in SNAPSHOT.PINNED_DISTRIBUTIONS for name in row["topLevels"]}
    preloaded = sorted(name for name in sys.modules if name.split(".", 1)[0] in pinned)
    if preloaded:
        raise ValueError(f"Pinned packages imported before validation: {preloaded}.")
    baseline = set(sys.modules)
    handles: list[object] = []
    try:
        if hasattr(os, "add_dll_directory"):
            directories = sorted(
                {
                    packages.joinpath(*PurePosixPath(name).parts).parent
                    for name in package_payloads
                    if PurePosixPath(name).suffix.lower() in {".dll", ".pyd"}
                },
                key=str,
            )
            handles = [os.add_dll_directory(str(path)) for path in directories]
        unitypy = importlib.import_module("UnityPy")
        mesh_helper = importlib.import_module("UnityPy.helpers.MeshHelper")
        if (
            Path(unitypy.__file__).resolve(strict=True) != packages / "UnityPy" / "__init__.py"
            or Path(mesh_helper.__file__).resolve(strict=True)
            != packages / "UnityPy" / "helpers" / "MeshHelper.py"
        ):
            raise ValueError("Pinned UnityPy imports escaped the private verified snapshot.")
        if getattr(unitypy, "__version__", None) != SNAPSHOT.UNITYPY_VERSION:
            raise ValueError("Imported UnityPy version differs from the exact reviewed pin.")
        SNAPSHOT.assert_new_import_origins(baseline, packages)
        value = build_report(bundle_payload, unitypy, mesh_helper)
        SNAPSHOT.assert_new_import_origins(baseline, packages)
        SNAPSHOT.assert_exact_snapshot_tree(packages, package_payloads)
        CORE.EXTRACTOR.write_atomic(report, canonical_json_bytes(value))
    finally:
        for handle in reversed(handles):
            handle.close()
    return 0


def run_once(
    index: int,
    private_root: Path,
    package_payloads: dict[str, bytes],
    bundle_payload: bytes,
) -> bytes:
    run_root = private_root / f"run-{index}"
    run_root.mkdir(mode=0o700)
    packages = run_root / "packages"
    bundle = run_root / "bundle.bin"
    report = run_root / "report.json"
    SNAPSHOT.write_private_import_snapshot(packages, package_payloads)
    SNAPSHOT.assert_exact_snapshot_tree(packages, package_payloads)
    CORE.EXTRACTOR.write_atomic(bundle, bundle_payload)
    command = [
        sys.executable,
        "-I",
        "-S",
        "-B",
        str(Path(__file__).resolve(strict=True)),
        WORKER_FLAG,
        "--packages",
        str(packages),
        "--bundle",
        str(bundle),
        "--report",
        str(report),
    ]
    DISCOVERY.validate_worker_result(DISCOVERY.run_worker(command, run_root))
    payload = DISCOVERY.capture_regular_bytes(report, MAX_REPORT_BYTES, f"2453 worker {index} report")
    value = strict_json_loads(payload, f"2453 worker {index} report")
    if canonical_json_bytes(value) != payload or not isinstance(value, dict):
        raise ValueError(f"2453 worker {index} report is not exact canonical JSON.")
    if value.get("schemaVersion") != SCHEMA_VERSION:
        raise ValueError(f"2453 worker {index} report has an unexpected schema.")
    return payload


def main() -> int:
    parser = argparse.ArgumentParser(description="Reproduce source-only proof for exact 2453-I.")
    parser.add_argument("--unitypy", type=Path, required=True)
    parser.add_argument("--bundle", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    bundle_payload = exact_bundle(args.bundle, "Builder 2453-I bundle")
    unitypy_root, unitypy_rows = DISCOVERY.stable_directory(args.unitypy, "UnityPy source root")
    SNAPSHOT.validate_worker_runtime()
    package_payloads = SNAPSHOT.capture_pinned_import_payloads(unitypy_root)
    DISCOVERY._assert_chain(unitypy_rows, "UnityPy source root")
    with tempfile.TemporaryDirectory(prefix="lego-builder-2453-proof-") as directory:
        private_root = Path(directory).resolve(strict=True)
        private_root.chmod(0o700)
        first = run_once(1, private_root, package_payloads, bundle_payload)
        second = run_once(2, private_root, package_payloads, bundle_payload)
        if first != second:
            raise ValueError("Two isolated 2453 bundle decodes produced different report bytes.")
    output = Path(os.path.abspath(os.fspath(args.output)))
    output.parent.mkdir(parents=True, exist_ok=True)
    CORE.EXTRACTOR.write_atomic(output, first)
    print(
        json.dumps(
            {"output": str(output), "bytes": len(first), "sha256": f"sha256:{sha256(first)}"},
            sort_keys=True,
        )
    )
    return 0


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == WORKER_FLAG:
        raise SystemExit(worker_main(sys.argv[2:]))
    raise SystemExit(main())
