"""The pinned evidence every 6651557 measurement binds itself to before scoring.

One place reads the approved source pilot, refuses a surface that no longer
reproduces it, and writes a report inside the gitignored output tree. Both the
part-admission scorer and the Builder-to-LDraw frame derivation bind here, so a
second measurement cannot quietly score a different expansion of the same part.

It measures and it binds; it admits nothing.
"""

from __future__ import annotations

import hashlib
import json
import os
import stat
from pathlib import Path

from builder_native_source import measure_bounds
from ldraw_source_archive import LDrawSourceLibrary, canonical_bytes
from ldraw_surface_expander import expand_surface
from part_admission_ldraw_candidate import role_classifier
from part_admission_surface import MeasuredSurface, STUD_ROLE

PILOT_DESIGN_IDS = ("5092", "30357", "35480", "51739", "77844", "93273")
PILOT_BYTES = 10_130
PILOT_SHA256 = "368753adec40d517c5063cbe23f28b9ff21108f0f8824bb0671b8c2575794613"
PILOT_SCHEMA_VERSION = "lego.set-6651557-source-pilot/1"
MEASUREMENT_ONLY = "measurement-only-not-catalog-admitted"


def read_pilot(path: Path) -> dict[str, object]:
    """The approved six-part source pilot, or a refusal naming what differs."""

    resolved = path.resolve(strict=True)
    data = resolved.read_bytes()
    digest = hashlib.sha256(data).hexdigest()
    if len(data) != PILOT_BYTES or digest != PILOT_SHA256:
        raise ValueError(
            f"Source pilot {resolved} is {len(data)} bytes sha256:{digest}; the approved report is "
            f"{PILOT_BYTES} bytes sha256:{PILOT_SHA256}. Regenerate it with "
            "scripts/generate-set-6651557-source-pilot.py rather than re-pinning this reader."
        )
    report = json.loads(data.decode("utf-8"))
    if report.get("schemaVersion") != PILOT_SCHEMA_VERSION:
        raise ValueError(
            f"Source pilot schemaVersion is {report.get('schemaVersion')!r}; expected "
            f"{PILOT_SCHEMA_VERSION!r}."
        )
    if report.get("authority", {}).get("state") != MEASUREMENT_ONLY:
        raise ValueError("Source pilot is not in the measurement-only authority state.")
    return report


def measured_surface(library: LDrawSourceLibrary, design_id: str) -> MeasuredSurface:
    """One expanded, BFC-corrected, role-classified LDraw closure."""

    root = library.exact("official", f"parts/{design_id}.dat")
    triangles = expand_surface(
        library, root, role_classifier(lambda key: library.record(key).sha256)
    )
    return MeasuredSurface(
        design_id=design_id,
        triangles=tuple(triangle.points for triangle in triangles),
        roles=tuple(triangle.role for triangle in triangles),
    )


def bind_to_pilot(surface: MeasuredSurface, pilot_part: dict[str, object]) -> dict[str, object]:
    """Refuse to measure a surface that differs from the approved pilot measurement."""

    expected = pilot_part["ldraw"]
    if not isinstance(expected, dict):
        raise TypeError(f"Source pilot part {surface.design_id} has no ldraw measurement object.")
    studs = surface.by_role(STUD_ROLE)
    solid = tuple(
        triangle for triangle, role in zip(surface.triangles, surface.roles) if role != STUD_ROLE
    )
    points = [point for triangle in surface.triangles for point in triangle]
    actual: dict[str, object] = {
        "triangleCount": len(surface.triangles),
        "studTriangleCount": len(studs),
        "bodyTriangleCount": len(solid),
        "uniquePositionCount": len({point for point in points}),
        "boundsLdu": measure_bounds(points),
        "bodyBoundsLdu": measure_bounds([point for triangle in solid for point in triangle]),
    }
    if studs:
        actual["studBoundsLdu"] = measure_bounds(
            [point for triangle in studs for point in triangle]
        )
    for field, value in actual.items():
        if expected.get(field) != value:
            raise ValueError(
                f"Part {surface.design_id} expands to {field}={value!r}; the approved source pilot "
                f"records {expected.get(field)!r}. The archives, the expander or the stud policy "
                "changed, so this measurement would not describe the reviewed surface."
            )
    return {"checkedFields": sorted(actual), "state": "reproduces-approved-source-pilot"}


def write_output_report(path: Path, report: dict[str, object]) -> str:
    """Write one canonical JSON report below the repository's output/ boundary."""

    repository = Path(__file__).resolve().parents[1]
    boundary = (repository / "output").resolve(strict=True)
    target = Path(os.path.abspath(os.fspath(path)))
    if not target.is_relative_to(boundary) or target == boundary:
        raise ValueError(f"The report must stay below {boundary}; received {target}.")
    parent = target.parent
    parent.mkdir(parents=True, exist_ok=True)
    for directory in (boundary, parent):
        info = os.lstat(directory)
        if stat.S_ISLNK(info.st_mode) or bool(getattr(info, "st_file_attributes", 0) & 0x400):
            raise ValueError(f"Report output path {directory} is a symlink or reparse point.")
    payload = canonical_bytes(report) + b"\n"
    temporary = parent / f"{target.name}.partial"
    temporary.write_bytes(payload)
    os.replace(temporary, target)
    return hashlib.sha256(payload).hexdigest()
