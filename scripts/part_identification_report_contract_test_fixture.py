"""Materialize the canonical tiny report closure used by Python contract tests."""

from __future__ import annotations

import hashlib
import subprocess
from pathlib import Path
from unittest.mock import patch

import part_identification_verification_bridge as verification_bridge


FIXTURE_WRITER = Path(__file__).with_name(
    "part-identification-report-contract-fixture.mjs"
)
TEST_VERIFIER = Path(__file__).with_name("part-identification-report-test-verifier.mjs")
EXPECTED_SCORE_BYTES = 14_512
EXPECTED_SCORE_DIGEST = "sha256:adfdf497959b25dd4ea5b5bcdae2f77bd099a991e9b3bc81eacaef2dce10cbd4"
TEST_ROOT_MARKER = ".lego-report-contract-fixture-root"
TEST_ROOT_MARKER_CONTENT = "lego-report-contract-fixture/1\n"


def report_contract_test_verifier_patch():
    """Route only this test process through explicit synthetic expectations."""

    return patch.object(verification_bridge, "BRIDGE_PATH", TEST_VERIFIER)


def materialize_report_contract_fixture(
    root: Path, *, coverage_source: str = "adjudicated"
) -> None:
    if not root.is_dir() or any(root.iterdir()):
        raise RuntimeError("Report fixture destination must be one new empty test directory.")
    (root / TEST_ROOT_MARKER).write_bytes(TEST_ROOT_MARKER_CONTENT.encode("utf-8"))
    try:
        subprocess.run(
            ["node", str(FIXTURE_WRITER), str(root), coverage_source],
            check=True,
            stdin=subprocess.DEVNULL,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.PIPE,
            text=True,
            timeout=20,
        )
    except subprocess.CalledProcessError as error:
        diagnostic = (error.stderr or "").strip()[-4_096:]
        raise RuntimeError(
            f"Canonical report fixture producer refused {coverage_source!r}: {diagnostic}"
        ) from error
    score_bytes = (root / "output/part-identification/score.json").read_bytes()
    score_digest = "sha256:" + hashlib.sha256(score_bytes).hexdigest()
    if len(score_bytes) != EXPECTED_SCORE_BYTES or score_digest != EXPECTED_SCORE_DIGEST:
        raise RuntimeError(
            "Canonical score fixture moved from its independently reviewed exact byte length/digest."
        )
