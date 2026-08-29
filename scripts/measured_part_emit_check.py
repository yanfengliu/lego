"""Check-mode refusal policy for measured-part generated tables."""

from __future__ import annotations

from typing import Sequence


def enforce_generated_check(drifted: Sequence[str]) -> None:
    """Make check mode a real refusal rather than a report-only comparison."""

    if not drifted:
        return
    raise SystemExit(
        "Measured-part generated tables do not reproduce their canonical committed bytes: "
        f"{', '.join(drifted)}. Run this command without --check against the same pinned "
        "inputs, review the resulting diff, and commit the regenerated tables."
    )
