from __future__ import annotations
import argparse
import importlib
import importlib.util
import os
import stat
import sys
import tempfile
from pathlib import Path, PurePosixPath
from types import ModuleType


WORKER_FLAG = "--quarantined-builder-shell-discovery-worker"

def _load_sibling(module_name: str, filename: str) -> ModuleType:
    spec = importlib.util.spec_from_file_location(module_name, Path(__file__).with_name(filename))
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Cannot load required sibling {filename}.")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


CORE = _load_sibling("builder_shell_discovery_core", "discover_builder_shell_core.py")
EXTRACTOR = CORE.EXTRACTOR
SNAPSHOT = EXTRACTOR.SNAPSHOT
BUNDLE_BYTES = CORE.BUNDLE_BYTES
BUNDLE_SHA256 = CORE.BUNDLE_SHA256
SCHEMA_VERSION = CORE.SCHEMA_VERSION
OUTPUT_NAME = CORE.OUTPUT_NAME
MAX_REPORT_BYTES = CORE.MAX_REPORT_BYTES
canonical_json_bytes = CORE.canonical_json_bytes
strict_json_loads = CORE.strict_json_loads
sha256 = CORE.sha256
validate_report = CORE.validate_report
build_report = CORE.build_report
shell_report = CORE.shell_report
assert_pinned_environment_for_retained_bundle = CORE.assert_pinned_environment_for_retained_bundle
PINNED_ENVIRONMENT_BARRIER = CORE.PINNED_ENVIRONMENT_BARRIER
enumerate_candidates = CORE.META.enumerate_candidates
primitive_report = CORE.META.primitive_report
partinfo_report = CORE.META.partinfo_report
Candidate = CORE.META.Candidate
WORKER = _load_sibling(
    "builder_shell_discovery_worker", "discover_builder_shell_worker.py"
)
WORKER.bind(CORE)
WorkerResult = WORKER.WorkerResult
validate_worker_result = WORKER.validate_worker_result
run_worker = WORKER.run_worker
MAX_DIAGNOSTIC_BYTES = WORKER.MAX_DIAGNOSTIC_BYTES
WORKER_TIMEOUT_SECONDS = WORKER.WORKER_TIMEOUT_SECONDS


def _is_reparse(info: os.stat_result) -> bool:
    return bool(getattr(info, "st_file_attributes", 0) & 0x400)


def _absolute(path: Path) -> Path:
    return Path(os.path.abspath(os.fspath(path)))


def _chain(path: Path) -> list[tuple[Path, tuple[int, int, int, int]]]:
    absolute = _absolute(path)
    current = Path(absolute.anchor)
    rows: list[tuple[Path, tuple[int, int, int, int]]] = []
    for part in absolute.parts[1:]:
        current /= part
        info = os.lstat(current)
        if stat.S_ISLNK(info.st_mode) or _is_reparse(info):
            raise ValueError(f"Path {current} is a symlink or reparse point; refusing it.")
        identity_size = info.st_size if stat.S_ISREG(info.st_mode) else 0
        rows.append((current, (info.st_dev, info.st_ino, info.st_mode, identity_size)))
    return rows


def _assert_chain(
    rows: list[tuple[Path, tuple[int, int, int, int]]], label: str
) -> None:
    for path, expected in rows:
        info = os.lstat(path)
        identity_size = info.st_size if stat.S_ISREG(info.st_mode) else 0
        actual = (info.st_dev, info.st_ino, info.st_mode, identity_size)
        if stat.S_ISLNK(info.st_mode) or _is_reparse(info) or actual != expected:
            raise ValueError(f"{label} changed during use at {path}; refusing a TOCTOU result.")


def stable_directory(
    path: Path, label: str
) -> tuple[Path, list[tuple[Path, tuple[int, int, int, int]]]]:
    absolute = _absolute(path)
    rows = _chain(absolute)
    if not rows or not stat.S_ISDIR(rows[-1][1][2]):
        raise ValueError(f"{label} must be an existing regular directory; received {absolute}.")
    return absolute, rows


def capture_regular_bytes(path: Path, maximum: int, label: str) -> bytes:
    absolute = _absolute(path)
    rows = _chain(absolute)
    before = os.lstat(absolute)
    if not stat.S_ISREG(before.st_mode):
        raise ValueError(f"{label} must be a regular file; received {absolute}.")
    flags = os.O_RDONLY | getattr(os, "O_BINARY", 0) | getattr(os, "O_NOINHERIT", 0)
    descriptor = os.open(absolute, flags)
    try:
        opened = os.fstat(descriptor)
        if (before.st_dev, before.st_ino) != (opened.st_dev, opened.st_ino):
            raise ValueError(f"{label} changed before its verified handle opened.")
        if opened.st_size > maximum:
            raise ValueError(f"{label} has {opened.st_size} bytes; limit is {maximum}.")
        chunks: list[bytes] = []
        remaining = maximum + 1
        while remaining:
            chunk = os.read(descriptor, min(65_536, remaining))
            if not chunk:
                break
            chunks.append(chunk)
            remaining -= len(chunk)
        payload = b"".join(chunks)
        after_handle = os.fstat(descriptor)
    finally:
        os.close(descriptor)
    after_path = os.lstat(absolute)
    _assert_chain(rows, label)
    identities = {
        (value.st_dev, value.st_ino, value.st_size)
        for value in (opened, after_handle, after_path)
    }
    if len(identities) != 1 or len(payload) != opened.st_size:
        raise ValueError(f"{label} changed while its verified handle was read.")
    if len(payload) > maximum:
        raise ValueError(f"{label} exceeds its {maximum}-byte limit.")
    return payload


def write_atomic_contained(
    root: Path,
    rows: list[tuple[Path, tuple[int, int, int, int]]],
    payload: bytes,
) -> Path:
    target = root / OUTPUT_NAME
    if target.parent != root:
        raise ValueError("Fixed discovery report escaped the caller-selected output root.")
    _assert_chain(rows, "Output root")
    if target.exists() or target.is_symlink():
        target_rows = _chain(target)
        if not target_rows or not stat.S_ISREG(target_rows[-1][1][2]):
            raise ValueError(f"Output target {target} is not a regular file.")
    CORE.atomic_write_relative_windows(
        root,
        OUTPUT_NAME,
        payload,
        lambda: _assert_chain(rows, "Output root"),
        (rows[-1][1][0], rows[-1][1][1]),
    )
    return target

def snapshot_worker_main(arguments: list[str]) -> int:
    parser = argparse.ArgumentParser(add_help=False)
    parser.add_argument("--packages", type=Path, required=True)
    parser.add_argument("--bundle", type=Path, required=True)
    parser.add_argument("--report", type=Path, required=True)
    args = parser.parse_args(arguments)
    SNAPSHOT.validate_worker_runtime()
    packages, package_rows = stable_directory(args.packages, "Private package snapshot")
    bundle = _absolute(args.bundle)
    report = _absolute(args.report)
    private_root, private_rows = stable_directory(packages.parent, "Private worker root")
    if (
        packages.name != "packages"
        or bundle.parent != private_root
        or report.parent != private_root
        or report.exists()
    ):
        raise ValueError(
            "Worker inputs must be fresh siblings in one private controller-owned directory."
        )
    payloads = SNAPSHOT.capture_pinned_import_payloads(packages)
    SNAPSHOT.assert_exact_snapshot_tree(packages, payloads)
    bundle_payload = capture_regular_bytes(bundle, CORE.BUNDLE_BYTES, "Private captured bundle")
    _assert_chain(package_rows, "Private package snapshot")
    _assert_chain(private_rows, "Private worker root")
    if len(bundle_payload) != CORE.BUNDLE_BYTES or sha256(bundle_payload) != CORE.BUNDLE_SHA256:
        raise ValueError("Private bundle differs from the exact quarantined 3245-M capture.")
    sys.dont_write_bytecode = True
    sys.path[:] = [str(packages), *SNAPSHOT.trusted_runtime_paths()]
    sys.path_importer_cache.clear()
    importlib.invalidate_caches()
    pinned = {
        name for row in SNAPSHOT.PINNED_DISTRIBUTIONS for name in row["topLevels"]
    }
    preloaded = sorted(name for name in sys.modules if name.split(".", 1)[0] in pinned)
    if preloaded:
        raise ValueError(f"Pinned packages were imported before snapshot validation: {preloaded}.")
    baseline = set(sys.modules)
    handles: list[object] = []
    try:
        if hasattr(os, "add_dll_directory"):
            directories = sorted(
                {
                    packages.joinpath(*PurePosixPath(name).parts).parent
                    for name in payloads
                    if PurePosixPath(name).suffix.lower() in {".dll", ".pyd"}
                },
                key=str,
            )
            handles = [os.add_dll_directory(str(path)) for path in directories]
        unitypy = importlib.import_module("UnityPy")
        mesh_helper = importlib.import_module("UnityPy.helpers.MeshHelper")
        expected_unitypy = packages / "UnityPy" / "__init__.py"
        expected_helper = packages / "UnityPy" / "helpers" / "MeshHelper.py"
        if (
            Path(unitypy.__file__).resolve(strict=True) != expected_unitypy
            or Path(mesh_helper.__file__).resolve(strict=True) != expected_helper
        ):
            raise ValueError("Pinned UnityPy imports escaped the private RECORD-verified snapshot.")
        if getattr(unitypy, "__version__", None) != SNAPSHOT.UNITYPY_VERSION:
            raise ValueError(
                f"Imported UnityPy version differs from exact pin {SNAPSHOT.UNITYPY_VERSION}."
            )
        SNAPSHOT.assert_new_import_origins(baseline, packages)
        report_value = CORE.build_report(
            bundle_payload, unitypy.load, mesh_helper.MeshHandler, snapshot_root=packages
        )
        SNAPSHOT.assert_new_import_origins(baseline, packages)
        SNAPSHOT.assert_exact_snapshot_tree(packages, payloads)
        encoded = canonical_json_bytes(report_value)
        if len(encoded) > CORE.MAX_REPORT_BYTES:
            raise ValueError(
                f"Discovery report has {len(encoded)} bytes; limit is {CORE.MAX_REPORT_BYTES}."
            )
        EXTRACTOR.write_atomic(report, encoded)
    finally:
        for handle in reversed(handles):
            handle.close()
    return 0


def _run_once(
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
    EXTRACTOR.write_atomic(bundle, bundle_payload)
    command = [
        sys.executable, "-I", "-S", "-B", str(Path(__file__).resolve(strict=True)),
        WORKER_FLAG, "--packages", str(packages), "--bundle", str(bundle),
        "--report", str(report),
    ]
    validate_worker_result(run_worker(command, run_root))
    report_payload = capture_regular_bytes(
        report, CORE.MAX_REPORT_BYTES, f"Discovery worker {index} report"
    )
    value = CORE.validate_report(
        strict_json_loads(report_payload, f"Discovery worker {index} report")
    )
    if canonical_json_bytes(value) != report_payload:
        raise ValueError(f"Discovery worker {index} report is not exact canonical JSON.")
    return report_payload


def main() -> int:
    parser = argparse.ArgumentParser(
        description=(
            "Discover bounded metadata from one exact quarantined Builder 3245-M bundle; "
            "never admit or support it."
        )
    )
    parser.add_argument("--unitypy", type=Path, required=True)
    parser.add_argument("--bundle", type=Path, required=True)
    parser.add_argument("--output-root", type=Path, required=True)
    args = parser.parse_args()
    bundle_payload = capture_regular_bytes(
        args.bundle, CORE.BUNDLE_BYTES, "Quarantined Builder bundle"
    )
    actual_digest = sha256(bundle_payload)
    if len(bundle_payload) != CORE.BUNDLE_BYTES or actual_digest != CORE.BUNDLE_SHA256:
        raise ValueError(
            f"Quarantined Builder bundle identity is {len(bundle_payload)} bytes "
            f"sha256:{actual_digest}; expected exactly {CORE.BUNDLE_BYTES} bytes "
            f"sha256:{CORE.BUNDLE_SHA256}."
        )
    output_root, output_rows = stable_directory(args.output_root, "Output root")
    unitypy_root, unitypy_rows = stable_directory(args.unitypy, "UnityPy source root")
    SNAPSHOT.validate_worker_runtime()
    package_payloads = SNAPSHOT.capture_pinned_import_payloads(unitypy_root)
    _assert_chain(unitypy_rows, "UnityPy source root")
    with tempfile.TemporaryDirectory(prefix="lego-builder-3245-quarantine-") as directory:
        private_root = Path(directory).resolve(strict=True)
        private_root.chmod(0o700)
        first = _run_once(1, private_root, package_payloads, bundle_payload)
        second = _run_once(2, private_root, package_payloads, bundle_payload)
        if first != second:
            raise ValueError(
                "Two independent isolated discovery runs produced different report bytes; "
                "no output was released."
            )
    output = write_atomic_contained(output_root, output_rows, first)
    summary = {
        "bundleSha256": f"sha256:{CORE.BUNDLE_SHA256}",
        "output": str(output),
        "status": "quarantined-source-evidence-only",
    }
    print(canonical_json_bytes(summary).decode("utf-8"))
    return 0


if __name__ == "__main__":
    if sys.argv[1:2] == [WORKER_FLAG]:
        raise SystemExit(snapshot_worker_main(sys.argv[2:]))
    raise SystemExit(main())
