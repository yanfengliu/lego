"""Bind exact authored non-stud connector projections to admitted design identities."""

from __future__ import annotations

from typing import Sequence

from ldcad_shadow_axles import emit_axle_connectors
from ldcad_shadow_connectors import ShadowSnap


def source_connectors_for(
    design_id: str, snaps: Sequence[ShadowSnap], shadow_files: Sequence[str]
) -> list[tuple[str, Sequence[float], Sequence[float]]]:
    """Admit only 4519's exact direct-shadow three-seat axle projection."""

    eligible = [snap for snap in snaps if snap.is_axle_shaft]
    axles = emit_axle_connectors(snaps)
    if design_id == "4519":
        source_paths = [snap.source_path for snap in eligible]
        if (
            len(eligible) != 1
            or source_paths != ["parts/4519.dat"]
            or len(axles) != 3
            or list(shadow_files) != ["parts/4519.dat"]
        ):
            raise ValueError(
                "Part 4519 requires exactly one eligible declaration from parts/4519.dat, "
                "exactly three emitted seats, and only parts/4519.dat in the composed shadow "
                f"closure; measured {len(eligible)} declarations from {source_paths}, "
                f"{len(axles)} seats, and closure {list(shadow_files)}."
            )
        return [
            (
                str(row["kind"]),
                row["positionLdu"],  # type: ignore[arg-type]
                row["normal"],  # type: ignore[arg-type]
            )
            for row in axles
        ]
    if eligible or axles:
        raise ValueError(
            f"Part {design_id} exposes {len(eligible)} exact A6x60 declarations and "
            f"{len(axles)} axle seats; that source route is admitted only for design 4519."
        )
    return []
