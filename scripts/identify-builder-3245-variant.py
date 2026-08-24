"""Quarantine-only geometry evidence for exact LEGO Builder design 3245 revision M.

The exact retained bundle is decoded twice in fresh job-contained, RECORD-pinned
workers.  Decoded geometry never grants catalog authority; the public report is
fixed to ``supported=false`` and ``catalogAdmitted=false``.
"""

from __future__ import annotations

import argparse
import hashlib
import importlib
import importlib.util
import os
import re
import sys
import tempfile
from pathlib import Path, PurePosixPath
from types import ModuleType


WORKER_FLAG = "--quarantined-builder-3245-variant-worker"
BUNDLE_BYTES = 85_098
BUNDLE_SHA256 = "1aa4e8333df9914191a4d941a7ce0f95460311eabd8f159f9e4a9b1e5c1c9534"
OFFICIAL_BYTES = 144_722_356
OFFICIAL_SHA256 = "6009f2e94204c4d3a63a4c812010b5c90bad8c5acb19b882c859fdac63734eae"
MODEL_BYTES = 1_903_169
MODEL_SHA256 = "c0564fd86ede633f6cb18738f999fbb70ee948ba93a55cc8d338b4b5f02b5922"
CAPTURE_BYTES = 1_126
CAPTURE_SHA256 = "7fc1cd42f22af7d58c9531dffbc1fa18de48624cbfb76f706a2fb56213cf3a3f"
FRAME_CONTRACT_BYTES = 14_313
FRAME_CONTRACT_SHA256 = "e01defa39408391c658e90b607987fbf3abec413978eba70526f1851ea916f6d"
EXPECTED_MANIFEST_MD5 = "a679d0929e777a86573469a63ce841dd"
OBSERVED_BODY_MD5 = "bdce3745e99adf9c3bfb0708161c6875"


def _load_sibling(module_name: str, filename: str) -> ModuleType:
    spec = importlib.util.spec_from_file_location(module_name, Path(__file__).with_name(filename))
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Cannot load required sibling {filename}.")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


DISCOVERY = _load_sibling("builder_3245_discovery_boundary", "discover-builder-shell.py")
IDENTITY = _load_sibling(
    "builder_3245_variant_geometry", "identify_builder_3245_variant_core.py"
)
REPORT = _load_sibling("builder_3245_variant_report", "identify_builder_3245_variant_report.py")
CORE = DISCOVERY.CORE
SNAPSHOT = DISCOVERY.SNAPSHOT
canonical_json_bytes = DISCOVERY.canonical_json_bytes
strict_json_loads = DISCOVERY.strict_json_loads


def _exact_bytes(path: Path, count: int, digest: str, label: str) -> bytes:
    payload = DISCOVERY.capture_regular_bytes(path, count, label)
    actual = IDENTITY.sha256(payload)
    if len(payload) != count or actual != digest:
        raise ValueError(
            f"{label} identity is {len(payload)} bytes sha256:{actual}; expected exactly "
            f"{count} bytes sha256:{digest}. Re-acquire the fixed benchmark input."
        )
    return payload


def worker_main(arguments: list[str]) -> int:
    parser = argparse.ArgumentParser(add_help=False)
    parser.add_argument("--packages", type=Path, required=True)
    parser.add_argument("--bundle", type=Path, required=True)
    parser.add_argument("--report", type=Path, required=True)
    args = parser.parse_args(arguments)

    SNAPSHOT.validate_worker_runtime()
    packages, package_rows = DISCOVERY.stable_directory(args.packages, "Private package snapshot")
    private_root, private_rows = DISCOVERY.stable_directory(
        packages.parent, "Private worker root"
    )
    bundle = Path(os.path.abspath(os.fspath(args.bundle)))
    report = Path(os.path.abspath(os.fspath(args.report)))
    if (
        packages.name != "packages"
        or bundle.parent != private_root
        or report.parent != private_root
        or report.exists()
    ):
        raise ValueError("Worker inputs must be fresh siblings in one private controller root.")
    package_payloads = SNAPSHOT.capture_pinned_import_payloads(packages)
    SNAPSHOT.assert_exact_snapshot_tree(packages, package_payloads)
    bundle_payload = _exact_bytes(bundle, BUNDLE_BYTES, BUNDLE_SHA256, "Private bundle")
    DISCOVERY._assert_chain(package_rows, "Private package snapshot")
    DISCOVERY._assert_chain(private_rows, "Private worker root")

    sys.dont_write_bytecode = True
    sys.path[:] = [str(packages), *SNAPSHOT.trusted_runtime_paths()]
    sys.path_importer_cache.clear()
    importlib.invalidate_caches()
    pinned = {
        name for row in SNAPSHOT.PINNED_DISTRIBUTIONS for name in row["topLevels"]
    }
    preloaded = sorted(name for name in sys.modules if name.split(".", 1)[0] in pinned)
    if preloaded:
        raise ValueError(f"Pinned packages imported before snapshot validation: {preloaded}.")
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
            raise ValueError(f"Imported UnityPy differs from exact pin {SNAPSHOT.UNITYPY_VERSION}.")
        SNAPSHOT.assert_new_import_origins(baseline, packages)
        CORE.assert_pinned_environment_for_retained_bundle(bundle_payload, packages)
        environment = CORE.EXTRACTOR.load_environment_from_bytes(bundle_payload, unitypy.load)
        shell = IDENTITY.decode_shell(environment, mesh_helper.MeshHandler)
        worker_report = {
            "bundleSha256": f"sha256:{BUNDLE_SHA256}",
            "schemaVersion": IDENTITY.WORKER_SCHEMA_VERSION,
            "shell": shell,
        }
        SNAPSHOT.assert_new_import_origins(baseline, packages)
        SNAPSHOT.assert_exact_snapshot_tree(packages, package_payloads)
        encoded = canonical_json_bytes(worker_report)
        if len(encoded) > IDENTITY.MAX_WORKER_REPORT_BYTES:
            raise ValueError(
                f"Worker geometry report has {len(encoded)} bytes; limit is "
                f"{IDENTITY.MAX_WORKER_REPORT_BYTES}."
            )
        CORE.EXTRACTOR.write_atomic(report, encoded)
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
    payload = DISCOVERY.capture_regular_bytes(
        report, IDENTITY.MAX_WORKER_REPORT_BYTES, f"Variant worker {index} report"
    )
    value = strict_json_loads(payload, f"Variant worker {index} report")
    if canonical_json_bytes(value) != payload:
        raise ValueError(f"Variant worker {index} report is not canonical JSON.")
    if not isinstance(value, dict) or value.get("schemaVersion") != IDENTITY.WORKER_SCHEMA_VERSION:
        raise ValueError(f"Variant worker {index} report has an unexpected schema.")
    return payload


def _source_report(capture_payload: bytes, model_payload: bytes, derived_ldr_payload: bytes) -> dict[str, object]:
    capture = strict_json_loads(capture_payload, "Builder capture record")
    if not isinstance(capture, dict):
        raise ValueError("Builder capture record must be an object.")
    body = capture.get("body")
    response = capture.get("response")
    request = capture.get("request")
    if not isinstance(body, dict) or not isinstance(response, dict) or not isinstance(request, dict):
        raise ValueError("Builder capture record omits body, response, or request provenance.")
    if body != {
        "bytes": BUNDLE_BYTES,
        "md5": OBSERVED_BODY_MD5,
        "sha256": BUNDLE_SHA256,
    }:
        raise ValueError("Builder capture body identity differs from the exact fixed bundle.")
    expected_url = "https://api.prod.dbix.i.lego.com/api/v1/Bricks/3245?Revision=M&Platform=Android"
    if request.get("url") != expected_url or response.get("etag") != f'"{OBSERVED_BODY_MD5}"':
        raise ValueError("Builder request revision/platform or response ETag is not the fixed capture.")
    text = model_payload.decode("utf-8", "strict")
    brick_count = len(re.findall(r'<Brick\s+designID="3245;M"(?=\s)', text))
    part_count = len(re.findall(r'<Part\s+[^>]*\bdesignID="3245;M"(?=\s)', text))
    if (brick_count, part_count) != (10, 10):
        raise ValueError(
            f"Official model contains {brick_count} Brick and {part_count} Part 3245;M rows; "
            "the fixed benchmark requires exactly 10 of each."
        )
    derived_crosscheck = REPORT.derived_ldr_crosscheck(derived_ldr_payload)
    return {
        "authorityResolved": False,
        "builderCapture": {
            "bundleMd5": OBSERVED_BODY_MD5,
            "bundleSha256": f"sha256:{BUNDLE_SHA256}",
            "request": "design=3245;revision=M;platform=Android",
            "responseEtagMatchesBodyMd5": True,
        },
        "manifestContradiction": {
            "expectedMd5": EXPECTED_MANIFEST_MD5,
            "observedBodyMd5": OBSERVED_BODY_MD5,
            "resolved": False,
        },
        "derivedModelLdrawCrossCheck": derived_crosscheck,
        "officialModel": {
            "brickRowsFor3245M": brick_count,
            "partRowsFor3245M": part_count,
            "selectsLdrawSuffix": False,
        },
        "reason": (
            "The exact primary model selects design 3245 revision M and the exact captured "
            "response binds that request to its body, but no primary manifest explains why its "
            "expected MD5 differs from the response body and ETag. The derived model LDR names "
            "3245b.dat ten times, but its converter and revision-M alias table are unretained, so "
            "that conflicting cross-check has no official selection authority. Geometry cannot "
            "repair either source-authority gap."
        ),
    }


def _geometry_report(shell: dict[str, object], official_payload: bytes) -> dict[str, object]:
    calibration = _load_sibling(
        "builder_3245_pinned_ldraw_reader", "generate-builder-calibration.py"
    )
    raw_vertices = shell["vertices"]
    raw_groups = shell["triangleGroups"]
    if not isinstance(raw_vertices, list) or not isinstance(raw_groups, list):
        raise ValueError("Reproduced Shell report omits its bounded geometry arrays.")
    frames = IDENTITY.same_frame_candidates(raw_vertices)
    raw_shell_triangles = IDENTITY.shell_triangles(raw_vertices, raw_groups)
    library = calibration.LDrawLibrary([("exact-pinned-official", official_payload)])
    try:
        surfaces = {
            root: library.triangles(f"{root}.dat") for root in ("3245a", "3245b", "3245c")
        }
    finally:
        library.close()
    candidate_samples = {
        root: IDENTITY.interior_points(IDENTITY.sample_surface(triangles))
        for root, triangles in surfaces.items()
    }
    candidates = []
    for root, triangles in surfaces.items():
        frame_rows = []
        for frame in frames:
            points = [frame.apply(point) for point in raw_vertices]
            interior = IDENTITY.interior_points(points)
            if not interior:
                raise ValueError(f"Shared frame {frame.name} exposes no interior Shell vertices.")
            transformed_shell = IDENTITY.transform_triangles(raw_shell_triangles, frame)
            shell_interior_samples = IDENTITY.interior_points(
                IDENTITY.sample_surface(transformed_shell)
            )
            if not shell_interior_samples or not candidate_samples[root]:
                raise ValueError("Interior surface sampling produced an empty comparison side.")
            shell_to_candidate = IDENTITY.nearest_distances(shell_interior_samples, triangles)
            candidate_to_shell = IDENTITY.nearest_distances(
                candidate_samples[root], transformed_shell
            )
            pairwise = []
            for other_root, other_triangles in surfaces.items():
                if other_root == root:
                    continue
                discriminative = IDENTITY.discriminative_points(
                    candidate_samples[root], other_triangles
                )
                pairwise.append(
                    {
                        "against": f"parts/{other_root}.dat",
                        "candidatePointsFartherThanThresholdFromOther": len(discriminative),
                        "distanceToBuilderShell": (
                            IDENTITY.distance_summary(
                                IDENTITY.nearest_distances(discriminative, transformed_shell)
                            )
                            if discriminative
                            else None
                        ),
                    }
                )
            frame_rows.append(
                {
                    "allShellVerticesToSurface": IDENTITY.distance_summary(
                        IDENTITY.nearest_distances(points, triangles)
                    ),
                    "frame": {
                        "linearLdu": list(frame.linear),
                        "name": frame.name,
                        "translationLdu": [round(value, 9) for value in frame.translation],
                    },
                    "interiorShellVerticesToSurface": IDENTITY.distance_summary(
                        IDENTITY.nearest_distances(interior, triangles)
                    ),
                    "interiorShellVertices": len(interior),
                    "pairwiseDiscriminativeSurface": pairwise,
                    "sampledInteriorSurface": {
                        "builderPoints": len(shell_interior_samples),
                        "builderToCandidate": IDENTITY.distance_summary(shell_to_candidate),
                        "candidatePoints": len(candidate_samples[root]),
                        "candidateToBuilder": IDENTITY.distance_summary(candidate_to_shell),
                        "symmetricRmsLdu": IDENTITY.rms_combined(
                            shell_to_candidate, candidate_to_shell
                        ),
                    },
                    "transformedShellSurfaceSha256": IDENTITY.surface_digest(transformed_shell),
                }
            )
        candidates.append(
            {
                "expandedSurfaceSha256": IDENTITY.surface_digest(triangles),
                "expandedTriangles": len(triangles),
                "frames": frame_rows,
                "root": f"parts/{root}.dat",
            }
        )
    controls = IDENTITY.instrument_controls()
    if controls["allPassed"] is not True:
        raise ValueError("Independent geometry instrument controls failed; no comparison is released.")
    ranked: list[tuple[float, str]] = []
    for candidate in candidates:
        frame_scores = [
            float(frame["sampledInteriorSurface"]["symmetricRmsLdu"])
            for frame in candidate["frames"]
        ]
        if len(set(frame_scores)) != 1:
            raise ValueError(
                f"Residual 180-degree frame symmetry changes {candidate['root']} score: "
                f"{frame_scores}. The comparison is not in a proved same frame."
            )
        ranked.append((frame_scores[0], str(candidate["root"])))
    ranked.sort()
    best, runner_up = ranked[0], ranked[1]
    return {
        "candidateMeasurements": candidates,
        "comparisonStatus": "unresolved-no-predeclared-decisive-margin",
        "decodedBoundsBuilderUnits": IDENTITY.finite_bounds(raw_vertices),
        "frameDerivation": {
            "builderNativeBasisLinearLdu": list(IDENTITY.BUILDER_NATIVE_BASIS_LINEAR_LDU),
            "builderNativeFrameId": IDENTITY.BUILDER_NATIVE_FRAME_ID,
            "candidateInteriorUsed": False,
            "method": (
                "proper quarter-turns of the established Builder native basis, followed by exact "
                "extent and centre registration to the shared 1x2x2 body box"
            ),
            "mirroredRegistrationsAdmitted": False,
            "remainingFrames": [frame.name for frame in frames],
            "targetBodyBoundsLdu": [list(row) for row in IDENTITY.TARGET_BODY_BOUNDS],
        },
        "instrument": {
            "controls": controls,
            "discriminativeDistanceLdu": IDENTITY.DISCRIMINATIVE_DISTANCE_LDU,
            "surfaceSampleSpacingLdu": IDENTITY.SURFACE_SAMPLE_SPACING_LDU,
            "surfaceWeighting": "fixed-topology deduplicated per-triangle barycentric samples",
            "tessellationInvariant": False,
        },
        "isolatedDecodes": 2,
        "shellCanonicalMeshSha256": shell["canonicalMeshSha256"],
        "shellPathId": shell["pathId"],
        "shellTriangles": shell["triangles"],
        "shellVertices": len(raw_vertices),
        "strongestProvedResult": {
            "admissionDecisionSupported": False,
            "observedBestFit": best[1],
            "observedBestFitRmsLdu": best[0],
            "observedRunnerUp": runner_up[1],
            "observedRunnerUpRmsLdu": runner_up[0],
            "runnerUpToBestRatio": round(runner_up[0] / best[0], 6),
            "reason": (
                "The fixed contract names no numerical decisive margin, so choosing one after "
                "observing these 3245 scores would tune the acceptance test on the target. The "
                "topology-weighted measurements are released as quarantine evidence, not a "
                "variant selection."
            ),
        },
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Compare exact quarantined Builder 3245-M geometry without admitting it.")
    parser.add_argument("--unitypy", type=Path, required=True)
    parser.add_argument("--bundle", type=Path, required=True)
    parser.add_argument("--official", type=Path, required=True)
    parser.add_argument("--official-model", type=Path, required=True)
    parser.add_argument("--capture", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    if args.output.name != IDENTITY.OUTPUT_NAME:
        raise ValueError(f"Output filename must be exactly {IDENTITY.OUTPUT_NAME!r}.")

    bundle_payload = _exact_bytes(args.bundle, BUNDLE_BYTES, BUNDLE_SHA256, "Builder bundle")
    official_payload = _exact_bytes(args.official, OFFICIAL_BYTES, OFFICIAL_SHA256, "Official LDraw archive")
    model_payload = _exact_bytes(args.official_model, MODEL_BYTES, MODEL_SHA256, "Official model XML")
    derived_ldr_payload = _exact_bytes(args.official_model.with_suffix(".ldr"), REPORT.DERIVED_LDR_BYTES, REPORT.DERIVED_LDR_SHA256, "Derived model LDR counterevidence")
    capture_payload = _exact_bytes(args.capture, CAPTURE_BYTES, CAPTURE_SHA256, "Builder capture record")
    frame_contract_payload = _exact_bytes(Path(__file__).with_name("builder_ldraw_frame.py"), FRAME_CONTRACT_BYTES, FRAME_CONTRACT_SHA256, "Established Builder native-frame contract source")
    if b'BUILDER_NATIVE_FRAME_ID = "lego-builder-native-to-catalog-ldu/1"' not in frame_contract_payload:
        raise ValueError("Pinned Builder native-frame contract omits its expected frame ID.")
    unitypy_root, unitypy_rows = DISCOVERY.stable_directory(
        args.unitypy, "UnityPy source root"
    )
    output_root, output_rows = DISCOVERY.stable_directory(
        args.output.parent, "Output root"
    )
    SNAPSHOT.validate_worker_runtime()
    package_payloads = SNAPSHOT.capture_pinned_import_payloads(unitypy_root)
    DISCOVERY._assert_chain(unitypy_rows, "UnityPy source root")
    with tempfile.TemporaryDirectory(prefix="lego-builder-3245-variant-") as directory:
        private_root = Path(directory).resolve(strict=True)
        private_root.chmod(0o700)
        first = _run_once(1, private_root, package_payloads, bundle_payload)
        second = _run_once(2, private_root, package_payloads, bundle_payload)
        if first != second:
            raise ValueError(
                "Two fresh isolated 3245-M decodes produced different canonical bytes; no "
                "variant report is released."
            )
    decoded = strict_json_loads(first, "Reproduced Builder Shell")
    shell = decoded["shell"]
    report = {
        "catalogAdmitted": False,
        "geometry": _geometry_report(shell, official_payload),
        "inputIdentities": {
            "builderBundle": {"bytes": BUNDLE_BYTES, "sha256": f"sha256:{BUNDLE_SHA256}"},
            "builderNativeFrameContract": {"bytes": FRAME_CONTRACT_BYTES, "sha256": f"sha256:{FRAME_CONTRACT_SHA256}"},
            "capture": {"bytes": CAPTURE_BYTES, "sha256": f"sha256:{CAPTURE_SHA256}"},
            "derivedModelLdraw": {"bytes": REPORT.DERIVED_LDR_BYTES, "sha256": f"sha256:{REPORT.DERIVED_LDR_SHA256}"},
            "officialLdraw": {
                "bytes": OFFICIAL_BYTES,
                "sha256": f"sha256:{OFFICIAL_SHA256}",
            },
            "officialModel": {"bytes": MODEL_BYTES, "sha256": f"sha256:{MODEL_SHA256}"},
            "pinnedParserContractSha256": f"sha256:{SNAPSHOT.PINNED_ENVIRONMENT_DIGEST}",
        },
        "schemaVersion": IDENTITY.SCHEMA_VERSION,
        "sourceAuthority": _source_report(capture_payload, model_payload, derived_ldr_payload),
        "status": "quarantined-source-evidence-only",
        "supported": False,
        "unresolvedReasons": REPORT.UNRESOLVED_REASONS.copy(),
        "verdict": "unresolved",
    }
    report["geometry"]["isolatedReportSha256"] = f"sha256:{IDENTITY.sha256(first)}"
    REPORT.validate_report(report)
    encoded = canonical_json_bytes(report)
    if len(encoded) > IDENTITY.MAX_REPORT_BYTES:
        raise ValueError(f"Variant report has {len(encoded)} bytes; limit is {IDENTITY.MAX_REPORT_BYTES}.")
    DISCOVERY._assert_chain(output_rows, "Output root")
    CORE.atomic_write_relative_windows(
        output_root,
        IDENTITY.OUTPUT_NAME,
        encoded,
        lambda: DISCOVERY._assert_chain(output_rows, "Output root"),
        (output_rows[-1][1][0], output_rows[-1][1][1]),
    )
    print(
        canonical_json_bytes(
            {
                "output": str(output_root / IDENTITY.OUTPUT_NAME),
                "status": report["status"],
                "verdict": report["verdict"],
            }
        ).decode("utf-8")
    )
    return 0


if __name__ == "__main__":
    if sys.argv[1:2] == [WORKER_FLAG]:
        raise SystemExit(worker_main(sys.argv[2:]))
    raise SystemExit(main())
