"""Ordered render-only measured-part plans and their pinned source archive."""

from __future__ import annotations

from measured_part_tables import RenderOnlyPartPlan

PLATE_HEIGHT_LDU = 8
BRICK_HEIGHT_LDU = 24


def _render_only_plan(
    design_id: str,
    family: str,
    width_studs: int,
    length_studs: int,
    *,
    variant: str | None = None,
    height_ldu: int = PLATE_HEIGHT_LDU,
    orientation_id: str = "upright-yaw-0",
    translation_ldu: tuple[int, int, int] = (0, -4, 0),
) -> RenderOnlyPartPlan:
    return RenderOnlyPartPlan(
        design_id=design_id,
        ldraw_path=f"parts/{design_id}.dat",
        family=family,
        width_studs=width_studs,
        length_studs=length_studs,
        variant=variant,
        height_ldu=height_ldu,
        orientation_id=orientation_id,
        translation_ldu=translation_ldu,
    )


# builtin.basic-parts/13: exact official-LDraw render surfaces for the twelve
# remaining parts whose parametric recipe drew no usable underside. These plans
# deliberately carry no connector, allowance or collision source. TypeScript
# promotes only their mesh, exact visual bounds and source attribution over the
# preceding catalog definitions, and asserts the structural bytes did not move.
RENDER_ONLY_PART_PLANS: tuple[RenderOnlyPartPlan, ...] = (
    _render_only_plan("41770a", "wedge-plate", 2, 4, variant="left"),
    _render_only_plan("41769a", "wedge-plate", 2, 4, variant="right"),
    _render_only_plan("43723a", "wedge-plate", 2, 3, variant="left"),
    _render_only_plan("43722a", "wedge-plate", 2, 3, variant="right"),
    _render_only_plan("54383", "wedge-plate", 3, 6, variant="right"),
    _render_only_plan(
        "3659",
        "arch",
        1,
        4,
        height_ldu=BRICK_HEIGHT_LDU,
        orientation_id="upright-yaw-90",
        translation_ldu=(0, -12, 0),
    ),
    _render_only_plan(
        "3455",
        "arch",
        1,
        6,
        height_ldu=BRICK_HEIGHT_LDU,
        orientation_id="upright-yaw-90",
        translation_ldu=(0, -12, 0),
    ),
    _render_only_plan(
        "11477", "curved-slope", 1, 2, height_ldu=16, translation_ldu=(0, 8, 0)
    ),
    _render_only_plan(
        "50950",
        "curved-slope",
        1,
        3,
        height_ldu=BRICK_HEIGHT_LDU,
        translation_ldu=(0, -12, 0),
    ),
    _render_only_plan(
        "61678",
        "curved-slope",
        1,
        4,
        height_ldu=BRICK_HEIGHT_LDU,
        translation_ldu=(0, -12, 0),
    ),
    _render_only_plan(
        "54200", "cheese-slope", 1, 1, height_ldu=16, translation_ldu=(0, 8, 0)
    ),
    _render_only_plan(
        "85984", "cheese-slope", 2, 1, height_ldu=16, translation_ldu=(0, 8, 0)
    ),
)

# The archive the bundled geometry is read from, byte-pinned. It is repeated in
# the emitted attribution table so a reader can check the files without this
# script, and it must stay equal to ARCHIVE_PINS[0].
BUNDLED_LDRAW_ARCHIVE_RECORD: dict[str, object] = {
    "archiveId": "official",
    "source": "https://library.ldraw.org/library/official",
    "version": "ldraw-complete-2026-07",
    "bytes": 144_722_356,
    "sha256": "sha256:6009f2e94204c4d3a63a4c812010b5c90bad8c5acb19b882c859fdac63734eae",
}
