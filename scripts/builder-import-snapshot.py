from __future__ import annotations

import base64
import csv
import hashlib
import io
import json
import os
import re
import stat
import struct
import sys
import sysconfig
from pathlib import Path, PurePosixPath


MAX_RECORD_BYTES = 64 * 1024
MAX_DISTRIBUTION_FILE_BYTES = 8 * 1024 * 1024
MAX_DISTRIBUTION_FILES = 5_000
MAX_SNAPSHOT_BYTES = 64 * 1024 * 1024
UNITYPY_VERSION = "1.25.3"
UNITYPY_WHEEL_TAG = "cp313-cp313-win_amd64"
UNITYPY_WHEEL_SHA256 = "255b7284e2f61161ceb0b361f742ac516236e0785fdb11c7d6911e691f1c0782"
UNITYPY_RECORD_SHA256 = "2c0725359f1bee3e737b2acf4e7bcc37724645db94c3219945aabb45ca0da379"
PINNED_DISTRIBUTIONS = (
    {
        "distInfo": "archspec-0.2.6.dist-info",
        "name": "archspec",
        "version": "0.2.6",
        "recordSha256": "e2e3e78725bc8649eca8810839801094b42bc3942da23ce92eca4a6ddb5cb50b",
        "wheelTags": ("py3-none-any",),
        "topLevels": ("archspec",),
    },
    {
        "distInfo": "astc_encoder_py-0.1.12.dist-info",
        "name": "astc-encoder-py",
        "version": "0.1.12",
        "recordSha256": "979c06f9ba4e068f72312b941e9c7df8e88e7a5f0e64fa1ddb2eaba6117912e1",
        "wheelTags": ("cp37-abi3-win_amd64",),
        "topLevels": ("astc_encoder",),
    },
    {
        "distInfo": "attrs-26.1.0.dist-info",
        "name": "attrs",
        "version": "26.1.0",
        "recordSha256": "d5e36b4e3a4f8f4eef148e133178740d9291a00515eb59ad678ade2474f85d30",
        "wheelTags": ("py3-none-any",),
        "topLevels": ("attr", "attrs"),
    },
    {
        "distInfo": "brotli-1.2.0.dist-info",
        "name": "brotli",
        "version": "1.2.0",
        "recordSha256": "4873e98e0b3ab4784e6252f0e50e467a770ea54325bc3400dfa255e6852cc1e0",
        "wheelTags": ("cp313-cp313-win_amd64",),
        "topLevels": ("_brotli", "brotli"),
    },
    {
        "distInfo": "etcpak-0.9.15.dist-info",
        "name": "etcpak",
        "version": "0.9.15",
        "recordSha256": "925329af464c6d9448fa82a880b43e4c78b41626dc12d3aa7b7ef87300befabd",
        "wheelTags": ("cp37-abi3-win_amd64",),
        "topLevels": ("etcpak",),
    },
    {
        "distInfo": "fmod_toolkit-0.1.3.dist-info",
        "name": "fmod_toolkit",
        "version": "0.1.3",
        "recordSha256": "b4510da471e35dcd6158b8f122de2df49df7d16ef923497ee27d1d4ba5758aff",
        "wheelTags": ("cp38-abi3-win_amd64", "cp38-abi3t-win_amd64"),
        "topLevels": ("fmod_toolkit",),
    },
    {
        "distInfo": "fsspec-2026.7.0.dist-info",
        "name": "fsspec",
        "version": "2026.7.0",
        "recordSha256": "d39b3bb6f4db58359f46480e8dc0090049da87ae2e69cf46aa36982e347c53b9",
        "wheelTags": ("py3-none-any",),
        "topLevels": ("fsspec",),
    },
    {
        "distInfo": "lz4-4.4.5.dist-info",
        "name": "lz4",
        "version": "4.4.5",
        "recordSha256": "87c3f0cc7074c90bf9d0584089e396e10c413452a7d259fad449a920aa4b09ff",
        "wheelTags": ("cp313-cp313-win_amd64",),
        "topLevels": ("lz4",),
    },
    {
        "distInfo": "pillow-12.3.0.dist-info",
        "name": "pillow",
        "version": "12.3.0",
        "recordSha256": "d8316e04515627eb6005335704818ff59d07867874f30fc4ecd3d4998d6cb1bb",
        "wheelTags": ("cp313-cp313-win_amd64",),
        "topLevels": ("PIL",),
    },
    {
        "distInfo": "pyfmodex-0.7.2.dist-info",
        "name": "pyfmodex",
        "version": "0.7.2",
        "recordSha256": "d768a48cfec44a3040961e425c79faeb527a1f23d7424529bdf91925272985c1",
        "wheelTags": ("py3-none-any",),
        "topLevels": ("pyfmodex",),
    },
    {
        "distInfo": "texture2ddecoder-1.0.6.dist-info",
        "name": "texture2ddecoder",
        "version": "1.0.6",
        "recordSha256": "474dd431e31e6b865264731f056a7525eb9e8612fbe75cd4b25c0a7c1b690a7f",
        "wheelTags": ("cp311-abi3-win_amd64",),
        "topLevels": ("texture2ddecoder",),
    },
    {
        "distInfo": "tpk_ar-0.2.4.dist-info",
        "name": "tpk_ar",
        "version": "0.2.4",
        "recordSha256": "e7d3cbce410ee3a10f9ec6f4c0158c11e5ca1dde552e0d83ef77a3935f8b1eb6",
        "wheelTags": ("py3-none-any",),
        "topLevels": ("tpk_ar",),
    },
    {
        "distInfo": "unitypy-1.25.3.dist-info",
        "name": "UnityPy",
        "version": UNITYPY_VERSION,
        "recordSha256": UNITYPY_RECORD_SHA256,
        "wheelTags": (UNITYPY_WHEEL_TAG,),
        "topLevels": ("UnityPy",),
    },
)
PINNED_ENVIRONMENT_DIGEST = "c4cc3cf7e9e066258688bc9fcace54e0b5c32d39f01956f07d1aff9c25dba80b"


def sha256(payload: bytes) -> str:
    return hashlib.sha256(payload).hexdigest()


def bounded_bytes(path: Path, maximum: int, label: str) -> bytes:
    resolved = path.resolve(strict=True)
    with resolved.open("rb") as stream:
        before = os.fstat(stream.fileno())
        if not stat.S_ISREG(before.st_mode):
            raise ValueError(
                f"{label} {resolved} is not a regular file. Copy the exact reviewed source "
                "to a stable local file before capture."
            )
        if before.st_size > maximum:
            raise ValueError(
                f"{label} has {before.st_size} bytes; limit is {maximum}. Use the exact pinned "
                "input or a smaller reviewed input; do not raise the limit for unreviewed data."
            )
        payload = stream.read(maximum + 1)
        after = os.fstat(stream.fileno())
    if len(payload) > maximum or len(payload) != before.st_size or after.st_size != before.st_size:
        raise ValueError(
            f"{label} changed while the same open handle was being captured or exceeded its "
            f"{maximum}-byte limit. Retry from a stable local copy; the bytes were discarded."
        )
    return payload


def decode_record_digest(value: str, label: str) -> bytes:
    if not value.startswith("sha256="):
        raise ValueError(
            f"{label} uses unsupported wheel RECORD digest {value!r}; expected sha256. "
            "Reinstall the exact pinned distribution into a clean local target."
        )
    encoded = value.removeprefix("sha256=")
    try:
        return base64.urlsafe_b64decode(encoded + "=" * (-len(encoded) % 4))
    except ValueError as error:
        raise ValueError(
            f"{label} has malformed wheel RECORD digest {value!r}. Reinstall the exact pinned "
            "distribution into a clean local target."
        ) from error


def distribution_contract_digest(distributions: tuple[dict[str, object], ...]) -> str:
    payload = json.dumps(
        distributions,
        separators=(",", ":"),
        sort_keys=True,
        ensure_ascii=True,
        allow_nan=False,
    ).encode("utf-8")
    return sha256(payload)


def top_level_matches(path: PurePosixPath, top_level: str) -> bool:
    first = path.parts[0]
    return (
        first == top_level
        or first == f"{top_level}.py"
        or (first.startswith(f"{top_level}.") and first.endswith((".pyd", ".so", ".dll")))
    )


def capture_pinned_import_payloads(
    path: Path,
    distributions: tuple[dict[str, object], ...] = PINNED_DISTRIBUTIONS,
) -> dict[str, bytes]:
    root = path.resolve(strict=True)
    if not root.is_dir():
        raise ValueError(
            f"Pinned import target {root} is not a directory. Install the exact reviewed "
            "UnityPy authoring environment into a clean local target."
        )
    if distributions is PINNED_DISTRIBUTIONS:
        actual_contract_digest = distribution_contract_digest(distributions)
        if actual_contract_digest != PINNED_ENVIRONMENT_DIGEST:
            raise ValueError(
                f"Pinned import distribution contract SHA-256 is {actual_contract_digest}; "
                f"expected {PINNED_ENVIRONMENT_DIGEST}. Restore the reviewed contract before "
                "reading or executing any package bytes."
            )

    expected_dist_infos = {str(distribution["distInfo"]) for distribution in distributions}
    actual_dist_infos: set[str] = set()
    for candidate in root.glob("*.dist-info"):
        if candidate.is_symlink() or not candidate.is_dir():
            raise ValueError(
                f"Pinned import target contains non-directory or symlink distribution metadata "
                f"{candidate}. Reinstall the exact reviewed environment into a clean target."
            )
        actual_dist_infos.add(candidate.name)
    if actual_dist_infos != expected_dist_infos:
        raise ValueError(
            f"Pinned import distribution set differs; extra="
            f"{sorted(actual_dist_infos - expected_dist_infos)}, missing="
            f"{sorted(expected_dist_infos - actual_dist_infos)}. Install exactly the reviewed "
            "environment; unpinned top-level distributions are not executable inputs."
        )

    captured: dict[str, bytes] = {}
    captured_total = 0
    for distribution in distributions:
        dist_info = str(distribution["distInfo"])
        label = f"{distribution['name']} {distribution['version']}"
        record_name = f"{dist_info}/RECORD"
        record_payload = bounded_bytes(
            root / dist_info / "RECORD", MAX_RECORD_BYTES, f"{label} wheel RECORD"
        )
        actual_record_sha256 = sha256(record_payload)
        if actual_record_sha256 != distribution["recordSha256"]:
            raise ValueError(
                f"{label} RECORD SHA-256 is {actual_record_sha256}; expected "
                f"{distribution['recordSha256']}. Reinstall the exact pinned distribution; "
                "do not execute a modified package tree."
            )
        try:
            rows = list(csv.reader(io.StringIO(record_payload.decode("utf-8", "strict"))))
        except (UnicodeDecodeError, csv.Error) as error:
            raise ValueError(
                f"{label} RECORD is not strict UTF-8 CSV. Reinstall the exact pinned "
                "distribution into a clean target."
            ) from error
        if len(rows) > MAX_DISTRIBUTION_FILES:
            raise ValueError(
                f"{label} RECORD has {len(rows)} rows; limit is {MAX_DISTRIBUTION_FILES}. "
                "Reinstall the exact pinned distribution; do not raise the limit."
            )

        distribution_paths: set[str] = set()
        top_levels = tuple(str(value) for value in distribution["topLevels"])
        for row_index, row in enumerate(rows, 1):
            if len(row) != 3:
                raise ValueError(
                    f"{label} RECORD row {row_index} has {len(row)} fields; expected 3. "
                    "Reinstall the exact pinned distribution into a clean target."
                )
            package_path, digest_value, size_value = row
            if "\\" in package_path or ":" in package_path:
                raise ValueError(
                    f"{label} RECORD row {row_index} uses unsafe path {package_path!r}. "
                    "Reinstall the exact pinned distribution into a clean target."
                )
            relative = PurePosixPath(package_path)
            if not relative.parts or str(relative) == ".":
                raise ValueError(
                    f"{label} RECORD row {row_index} has an empty package path. Reinstall the "
                    "exact pinned distribution into a clean target."
                )
            if relative.parts[:2] == ("..", "..") and relative.parts[2:3] == ("bin",):
                continue
            if relative.is_absolute() or ".." in relative.parts:
                raise ValueError(
                    f"{label} RECORD row {row_index} escapes the package target at "
                    f"{package_path!r}. Reinstall the exact pinned distribution."
                )
            if "__pycache__" in relative.parts or relative.suffix == ".pyc":
                continue
            if relative.suffix == ".pth":
                raise ValueError(
                    f"{label} RECORD includes executable site hook {package_path!r}; .pth "
                    "execution is not admitted by this isolated snapshot."
                )
            if not (
                relative.parts[0] == dist_info
                or any(top_level_matches(relative, top_level) for top_level in top_levels)
            ):
                raise ValueError(
                    f"{label} RECORD claims unpinned top-level path {package_path!r}; allowed "
                    f"imports are {list(top_levels)}. Review the full dependency closure before "
                    "admitting another executable package."
                )
            if package_path == record_name:
                payload = record_payload
            else:
                if not digest_value or not size_value:
                    raise ValueError(
                        f"{label} RECORD row {row_index} lacks a digest or size for "
                        f"{package_path!r}. Reinstall the exact pinned distribution."
                    )
                try:
                    expected_size = int(size_value)
                except ValueError as error:
                    raise ValueError(
                        f"{label} RECORD row {row_index} has invalid size {size_value!r} for "
                        f"{package_path!r}. Reinstall the exact pinned distribution."
                    ) from error
                if expected_size < 0 or expected_size > MAX_DISTRIBUTION_FILE_BYTES:
                    raise ValueError(
                        f"{label} file {package_path!r} declares {expected_size} bytes; allowed "
                        f"range is 0..{MAX_DISTRIBUTION_FILE_BYTES}. Reinstall the exact pinned "
                        "distribution; do not raise the bound."
                    )
                candidate = root.joinpath(*relative.parts)
                if candidate.is_symlink():
                    raise ValueError(
                        f"{label} file {package_path!r} is a symlink. Reinstall the exact pinned "
                        "distribution into a clean target."
                    )
                resolved_candidate = candidate.resolve(strict=True)
                try:
                    resolved_candidate.relative_to(root)
                except ValueError as error:
                    raise ValueError(
                        f"{label} file {package_path!r} resolves outside the reviewed target. "
                        "Reinstall the exact pinned distribution."
                    ) from error
                payload = bounded_bytes(
                    resolved_candidate, expected_size, f"{label} file {package_path!r}"
                )
                expected_digest = decode_record_digest(
                    digest_value, f"{label} RECORD row {row_index}"
                )
                if hashlib.sha256(payload).digest() != expected_digest:
                    raise ValueError(
                        f"{label} file {package_path!r} differs from its RECORD digest. "
                        "Reinstall the exact pinned distribution; modified bytes are not "
                        "executable inputs."
                    )
            prior = captured.get(package_path)
            if prior is not None and prior != payload:
                raise ValueError(
                    f"Pinned distributions claim conflicting bytes for {package_path!r}. "
                    "Reinstall the exact reviewed environment."
                )
            captured[package_path] = payload
            distribution_paths.add(package_path)
            captured_total += len(payload) if prior is None else 0
            if captured_total > MAX_SNAPSHOT_BYTES:
                raise ValueError(
                    f"Pinned import snapshot exceeds {MAX_SNAPSHOT_BYTES} bytes while capturing "
                    f"{package_path!r}. Restore the reviewed environment; do not raise the bound."
                )

        for top_level in top_levels:
            if not any(
                top_level_matches(PurePosixPath(package_path), top_level)
                for package_path in distribution_paths
            ):
                raise ValueError(
                    f"{label} RECORD does not provide pinned top-level import {top_level!r}. "
                    "Reinstall the exact reviewed distribution."
                )
        metadata_name = f"{dist_info}/METADATA"
        wheel_name = f"{dist_info}/WHEEL"
        if metadata_name not in captured or wheel_name not in captured:
            raise ValueError(
                f"{label} RECORD omits METADATA or WHEEL. Reinstall the exact pinned "
                "distribution."
            )
        metadata = captured[metadata_name].decode("utf-8", "strict")
        wheel = captured[wheel_name].decode("utf-8", "strict")
        if (
            re.search(rf"(?mi)^Name: {re.escape(str(distribution['name']))}\r?$", metadata)
            is None
            or re.search(
                rf"(?mi)^Version: {re.escape(str(distribution['version']))}\r?$", metadata
            )
            is None
        ):
            raise ValueError(
                f"{label} METADATA name/version differs from the code pin. Reinstall the exact "
                "reviewed distribution."
            )
        actual_tags = tuple(
            match.group(1) for match in re.finditer(r"(?m)^Tag: ([^\r\n]+)\r?$", wheel)
        )
        if actual_tags != tuple(distribution["wheelTags"]):
            raise ValueError(
                f"{label} wheel tags are {actual_tags}; expected "
                f"{tuple(distribution['wheelTags'])}. Reinstall the exact reviewed artifact."
            )

    if any(distribution["name"] == "UnityPy" for distribution in distributions):
        required = {
            "UnityPy/__init__.py",
            "UnityPy/helpers/MeshHelper.py",
            f"unitypy-{UNITYPY_VERSION}.dist-info/licenses/LICENSE",
        }
        missing_required = sorted(required - captured.keys())
        if missing_required:
            raise ValueError(
                f"Pinned import snapshot omits required UnityPy payloads {missing_required}. "
                "Reinstall the exact reviewed environment."
            )
    return captured


def write_private_import_snapshot(destination: Path, payloads: dict[str, bytes]) -> None:
    destination.mkdir(mode=0o700, parents=False, exist_ok=False)
    for package_path, payload in sorted(payloads.items()):
        target = destination.joinpath(*PurePosixPath(package_path).parts)
        target.parent.mkdir(parents=True, exist_ok=True)
        with target.open("xb") as stream:
            stream.write(payload)
            stream.flush()
            os.fsync(stream.fileno())


def assert_exact_snapshot_tree(root: Path, payloads: dict[str, bytes]) -> None:
    actual: set[str] = set()
    for candidate in root.rglob("*"):
        if candidate.is_symlink():
            raise ValueError(f"Private import snapshot contains symlink {candidate}.")
        if not candidate.is_file():
            continue
        relative = candidate.relative_to(root).as_posix()
        if "__pycache__" in candidate.relative_to(root).parts or candidate.suffix == ".pyc":
            raise ValueError(
                f"Private import snapshot contains forbidden bytecode {relative!r}; only "
                "same-handle-captured RECORD-pinned payload bytes may execute."
            )
        actual.add(relative)
    if actual != set(payloads):
        raise ValueError(
            "Private import snapshot tree differs from captured payloads; "
            f"extra={sorted(actual - set(payloads))}, missing={sorted(set(payloads) - actual)}."
        )


def trusted_runtime_paths() -> list[str]:
    base_prefix = Path(sys.base_prefix).resolve(strict=True)
    candidates: list[str] = [entry for entry in sys.path if entry]
    for key in ("stdlib", "platstdlib"):
        candidate = sysconfig.get_path(key)
        if candidate:
            candidates.append(candidate)
    executable_parent = Path(sys.executable).resolve(strict=True).parent
    candidates.extend((str(executable_parent), str(executable_parent / "DLLs")))
    trusted: list[str] = []
    seen: set[str] = set()
    for candidate in candidates:
        resolved = Path(candidate).resolve(strict=False)
        try:
            resolved.relative_to(base_prefix)
        except ValueError:
            continue
        normalized = str(resolved)
        if normalized not in seen:
            seen.add(normalized)
            trusted.append(normalized)
    if not trusted:
        raise ValueError(
            f"No trusted CPython runtime paths resolve beneath {base_prefix}. Restore the "
            "reviewed CPython 3.13 installation before importing the pinned snapshot."
        )
    return trusted


def assert_new_import_origins(baseline_modules: set[str], snapshot_root: Path) -> None:
    snapshot_root = snapshot_root.resolve(strict=True)
    base_prefix = Path(sys.base_prefix).resolve(strict=True)
    for module_name in sorted(set(sys.modules) - baseline_modules):
        module = sys.modules.get(module_name)
        if module is None:
            continue
        origin_candidates: list[str] = []
        module_file = getattr(module, "__file__", None)
        if module_file:
            origin_candidates.append(str(module_file))
        spec = getattr(module, "__spec__", None)
        search_locations = getattr(spec, "submodule_search_locations", None)
        if search_locations is not None:
            origin_candidates.extend(str(location) for location in search_locations)
        for origin in origin_candidates:
            resolved = Path(origin).resolve(strict=False)
            admitted = False
            for admitted_root in (snapshot_root, base_prefix):
                try:
                    resolved.relative_to(admitted_root)
                    admitted = True
                    break
                except ValueError:
                    continue
            if not admitted:
                raise ValueError(
                    f"Module {module_name!r} loaded from unverified origin {resolved}. Only the "
                    "private RECORD-pinned snapshot and trusted CPython runtime may execute."
                )


def validate_worker_runtime() -> None:
    if (
        sys.implementation.name != "cpython"
        or sys.version_info[:2] != (3, 13)
        or sys.platform != "win32"
        or struct.calcsize("P") != 8
    ):
        raise ValueError(
            f"Pinned UnityPy wheel {UNITYPY_WHEEL_TAG} requires 64-bit CPython 3.13 on Windows; "
            f"this runtime is {sys.implementation.name} {sys.version_info.major}."
            f"{sys.version_info.minor} on {sys.platform} ({struct.calcsize('P') * 8}-bit). Run "
            "the extraction with the reviewed runtime rather than substituting another wheel."
        )


def isolated_worker_environment() -> dict[str, str]:
    environment: dict[str, str] = {}
    for name in ("SystemRoot", "WINDIR", "TEMP", "TMP"):
        value = os.environ.get(name)
        if value:
            environment[name] = value
    system_root = Path(
        environment.get("SystemRoot", environment.get("WINDIR", r"C:\Windows"))
    )
    environment["PATH"] = os.pathsep.join(
        (str(Path(sys.executable).resolve(strict=True).parent), str(system_root / "System32"))
    )
    environment["PYTHONDONTWRITEBYTECODE"] = "1"
    return environment


def finite_json_loads(payload: bytes, label: str) -> object:
    try:
        text = payload.decode("utf-8", "strict")

        def reject_constant(value: str) -> object:
            raise ValueError(f"non-finite JSON constant {value}")

        return json.loads(text, parse_constant=reject_constant)
    except (UnicodeDecodeError, json.JSONDecodeError, ValueError) as error:
        raise ValueError(
            f"{label} is not strict finite UTF-8 JSON: {error}. Discard it and rerun the "
            "pinned extraction."
        ) from error
