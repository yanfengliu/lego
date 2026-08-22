from __future__ import annotations

from collections.abc import Callable


Vector3 = tuple[float, float, float]
MeasuredStudRow = (
    tuple[float, float, float, float, float]
    | tuple[float, float, float, float, float, float, float, float]
)


def compile_measured_stud_rows(
    candidate: dict[str, object],
    design_id: str,
    transform_point: Callable[[Vector3], Vector3],
    transform_direction: Callable[[Vector3], Vector3],
) -> tuple[MeasuredStudRow, ...]:
    """Pair each source stud cylinder with its one outward connector frame."""

    rows: list[MeasuredStudRow] = []
    stud_connectors = [
        row
        for row in candidate["connectors"]  # type: ignore[union-attr]
        if row["kind"] == "stud"  # type: ignore[index]
    ]
    for body in candidate["bodies"]:  # type: ignore[union-attr]
        if body["kind"] != "cylinder" or body["tag"] != "stud":  # type: ignore[index]
            continue
        source_center = tuple(
            float(value) for value in body["centerLdu"]  # type: ignore[index,union-attr]
        )
        height = float(body["heightLdu"])  # type: ignore[index]
        axis_index = "xyz".index(str(body["axis"]))  # type: ignore[index]
        matches: list[tuple[Vector3, Vector3]] = []
        for connector in stud_connectors:
            source_position = tuple(
                float(value) for value in connector["positionLdu"]  # type: ignore[index,union-attr]
            )
            source_normal = tuple(
                float(value) for value in connector["normal"]  # type: ignore[index,union-attr]
            )
            if abs(source_normal[axis_index]) != 1 or any(
                source_normal[other] != 0 for other in range(3) if other != axis_index
            ):
                continue
            expected = tuple(
                source_center[coordinate] - source_normal[coordinate] * height / 2
                for coordinate in range(3)
            )
            if source_position == expected:
                matches.append((source_position, source_normal))  # type: ignore[arg-type]
        if len(matches) != 1:
            raise ValueError(
                f"Part {design_id} stud cylinder axis {body['axis']!r} at "  # type: ignore[index]
                f"{list(source_center)} has {len(matches)} same-feature connector frames; "
                "every measured stud must declare one outward axis normal on its seat."
            )
        position = transform_point(matches[0][0])
        normal = transform_direction(matches[0][1])
        prefix = (
            position[0],
            position[1],
            position[2],
            float(body["radiusLdu"]),  # type: ignore[index]
            height,
        )
        rows.append(prefix if normal == (0.0, -1.0, 0.0) else (*prefix, *normal))
    return tuple(sorted(rows))


def require_matching_stud_frames(
    design_id: str,
    shadow_studs: object,
    visible_studs: object,
) -> None:
    """Refuse when LDCad's authored male frames differ from visible LDraw studs."""

    def frames(rows: object) -> list[tuple[Vector3, Vector3]]:
        return sorted(
            (
                tuple(float(value) for value in row["positionLdu"]),  # type: ignore[index,union-attr]
                tuple(float(value) for value in row["normal"]),  # type: ignore[index,union-attr]
            )
            for row in rows  # type: ignore[union-attr]
        )

    shadow_frames = frames(shadow_studs)
    visible_frames = frames(visible_studs)
    if shadow_frames != visible_frames:
        raise ValueError(
            f"Part {design_id} LDCad stud frames {shadow_frames!r} do not exactly match "
            f"its visible LDraw stud frames {visible_frames!r}; the pinned shadow walk owns "
            "the emitted male connector claim, and geometry may only corroborate it."
        )
