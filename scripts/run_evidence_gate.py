"""The one opt-in for tests that read ignored run evidence.

`scripts/run-evidence-gate.mjs` explains the variable. This module reads the
same one, so a Python test that pins `output/real-build/` or
`output/official-model/` skips by default with its reason and runs under
`LEGO_RUN_EVIDENCE=1`.
"""

from __future__ import annotations

import os
import unittest

RUN_EVIDENCE_VARIABLE = "LEGO_RUN_EVIDENCE"


def _read_opt_in() -> bool:
    value = os.environ.get(RUN_EVIDENCE_VARIABLE)
    if value in (None, "", "0"):
        return False
    if value == "1":
        return True
    raise ValueError(
        f"{RUN_EVIDENCE_VARIABLE} is {value!r}; set it to 1 to run the tests that read "
        "ignored run evidence, or leave it unset (or 0) to skip them."
    )


RUN_EVIDENCE_ENABLED = _read_opt_in()


def requires_run_evidence(reason: str):
    """Skip a test or test class unless the run-evidence opt-in is set, naming why."""
    return unittest.skipUnless(
        RUN_EVIDENCE_ENABLED, f"skipped without {RUN_EVIDENCE_VARIABLE}=1: {reason}"
    )
