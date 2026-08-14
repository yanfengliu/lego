"""Bound and clean up the Node subprocess used by report authentication."""

from __future__ import annotations

import json
import os
import shutil
import subprocess
import tempfile
import threading
from dataclasses import dataclass
from pathlib import Path


MAX_REQUEST_BYTES = 64 * 1024
MAX_RESPONSE_BYTES = 16 * 1024
MAX_DIAGNOSTIC_BYTES = 16 * 1024
DEFAULT_TIMEOUT_SECONDS = 20
SCORE_TIMEOUT_SECONDS = 59
ACTION_LEDGER_TIMEOUT_SECONDS = 59


class VerificationProcessError(RuntimeError):
    """One bounded, context-safe verifier process failure."""


@dataclass
class _BoundedCapture:
    data: bytearray
    exceeded: bool = False
    failed: bool = False


def _capture_stream(stream, maximum: int, process: subprocess.Popen, capture: _BoundedCapture) -> None:
    try:
        while True:
            chunk = stream.read(4_096)
            if not chunk:
                break
            remaining = maximum - len(capture.data)
            if len(chunk) > remaining:
                if remaining > 0:
                    capture.data.extend(chunk[:remaining])
                capture.exceeded = True
                try:
                    process.kill()
                except OSError:
                    pass
                break
            capture.data.extend(chunk)
    except OSError:
        capture.failed = True
    finally:
        try:
            stream.close()
        except OSError:
            pass


def _cleanup_process(process, threads: list[threading.Thread]) -> tuple[bool, bool]:
    """Always join collectors; report timeout and OS cleanup failure separately."""

    timed_out = False
    cleanup_failed = False
    try:
        if process is not None:
            try:
                running = process.poll() is None
            except OSError:
                running = True
                cleanup_failed = True
            if running:
                try:
                    process.kill()
                except OSError:
                    cleanup_failed = True
            try:
                process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                timed_out = True
                try:
                    process.kill()
                except OSError:
                    cleanup_failed = True
                try:
                    process.wait(timeout=2)
                except (OSError, subprocess.TimeoutExpired):
                    cleanup_failed = True
            except OSError:
                cleanup_failed = True
    finally:
        for thread in threads:
            try:
                thread.join(timeout=2)
            except RuntimeError:
                cleanup_failed = True
    return timed_out, cleanup_failed


def run_node_verifier(
    *,
    schema: str,
    kind: str,
    artifacts: dict[str, dict[str, str]],
    bridge_path: Path,
    repository_root: Path,
) -> None:
    """Run one verifier request under byte, heap, time, and cleanup bounds."""

    node = shutil.which("node")
    if node is None:
        raise VerificationProcessError(
            "Canonical report verification requires the repository's pinned Node 24 runtime, but node was unavailable."
        )
    request = {"schemaVersion": schema, "kind": kind, "artifacts": artifacts}
    encoded = json.dumps(request, separators=(",", ":"), ensure_ascii=True).encode("utf-8")
    if len(encoded) > MAX_REQUEST_BYTES:
        raise VerificationProcessError(
            f"Canonical {kind} verification request is {len(encoded)} bytes; the bounded maximum is {MAX_REQUEST_BYTES}."
        )
    timeout = (
        ACTION_LEDGER_TIMEOUT_SECONDS
        if kind == "action-ledger"
        else SCORE_TIMEOUT_SECONDS
        if kind == "score-summary"
        else DEFAULT_TIMEOUT_SECONDS
    )
    with tempfile.TemporaryDirectory(prefix="lego-report-verifier-") as directory:
        request_path = Path(directory) / "request.json"
        request_path.write_bytes(encoded)
        creationflags = subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0
        process = None
        threads: list[threading.Thread] = []
        captures = (_BoundedCapture(bytearray()), _BoundedCapture(bytearray()))
        timed_out = False
        cleanup_failed = False
        supervision_error: OSError | None = None
        try:
            process = subprocess.Popen(
                [node, "--max-old-space-size=256", str(bridge_path), str(request_path)],
                cwd=repository_root,
                stdin=subprocess.DEVNULL,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                creationflags=creationflags,
            )
            assert process.stdout is not None and process.stderr is not None
            for stream, maximum, capture in (
                (process.stdout, MAX_RESPONSE_BYTES, captures[0]),
                (process.stderr, MAX_DIAGNOSTIC_BYTES, captures[1]),
            ):
                thread = threading.Thread(
                    target=_capture_stream,
                    args=(stream, maximum, process, capture),
                    daemon=True,
                )
                thread.start()
                threads.append(thread)
            try:
                return_code = process.wait(timeout=timeout)
            except subprocess.TimeoutExpired:
                timed_out = True
                return_code = -1
        except OSError as error:
            supervision_error = error
            return_code = -1
        finally:
            cleanup_timed_out, cleanup_failed = _cleanup_process(process, threads)
            timed_out = timed_out or cleanup_timed_out
        if supervision_error is not None or cleanup_failed:
            raise VerificationProcessError(
                f"Canonical {kind} verification could not start, supervise, or clean up its bounded Node process."
            ) from supervision_error
        if timed_out:
            raise VerificationProcessError(
                f"Canonical {kind} verification exceeded its {timeout}-second execution bound."
            )
        if any(thread.is_alive() for thread in threads) or any(capture.failed for capture in captures):
            raise VerificationProcessError(
                f"Canonical {kind} verification could not collect its bounded machine verdict."
            )
        if captures[0].exceeded or captures[1].exceeded:
            raise VerificationProcessError(
                f"Canonical {kind} verification exceeded its bounded output or diagnostic byte ceiling."
            )
        response_bytes = bytes(captures[0].data)
    try:
        response = json.loads(response_bytes.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        raise VerificationProcessError(
            f"Canonical {kind} verification returned no bounded machine-readable verdict."
        ) from error
    expected_digests = {role: artifact["digest"] for role, artifact in artifacts.items()}
    if (
        return_code != 0
        or not isinstance(response, dict)
        or response.get("schemaVersion") != schema
        or response.get("kind") != kind
        or response.get("ok") is not True
        or response.get("digests") != expected_digests
    ):
        safe_code = response.get("code")
        safe_stage = (
            isinstance(safe_code, str)
            and safe_code.replace("-", "").isalnum()
            and len(safe_code) <= 128
        )
        detail = f" (bounded verifier stage {safe_code})" if safe_stage else ""
        if safe_stage and safe_code.startswith("action-ledger-canonical-validation-"):
            remediation = (
                "Exact ledger bytes reproduced; repair the named canonical validation categories "
                "and republish the ledger before scoring."
            )
        elif safe_stage and safe_code == "action-ledger-exact-bytes":
            remediation = "Regenerate the ledger from the authenticated inputs and retain its exact bytes."
        else:
            remediation = (
                "Regenerate one complete closure; independently rehashed derived output is not evidence."
            )
        raise VerificationProcessError(
            f"Canonical JavaScript {kind} verification rejected the retained artifact content{detail}. "
            f"{remediation}"
        )
