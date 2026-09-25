"""Gates for the solid-interval column derivation (part_admission_solid_columns.py)."""

from __future__ import annotations

import unittest

from part_admission_contract import Vector3
from part_admission_ldraw_candidate import _height_field, column_candidate
from part_admission_solid_columns import (
    OpenColumnSurfaceError,
    solid_interval_candidate,
    solid_interval_columns,
)
from part_admission_surface import BODY_ROLE, CLUTCH_ROLE, MeasuredSurface


def quad(a: Vector3, b: Vector3, c: Vector3, d: Vector3) -> list[tuple[Vector3, ...]]:
    return [(a, b, c), (a, c, d)]


def box(minimum: Vector3, maximum: Vector3, *, top: bool = True) -> list[tuple[Vector3, ...]]:
    """A closed box wound outward, as the expander emits BFC-corrected triangles."""

    (x0, y0, z0), (x1, y1, z1) = minimum, maximum
    faces = [
        *quad((x0, y0, z0), (x0, y0, z1), (x0, y1, z1), (x0, y1, z0)),
        *quad((x1, y0, z0), (x1, y1, z0), (x1, y1, z1), (x1, y0, z1)),
        *quad((x0, y1, z0), (x0, y1, z1), (x1, y1, z1), (x1, y1, z0)),
        *quad((x0, y0, z0), (x0, y1, z0), (x1, y1, z0), (x1, y0, z0)),
        *quad((x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1)),
    ]
    if top:
        faces.extend(quad((x0, y0, z0), (x1, y0, z0), (x1, y0, z1), (x0, y0, z1)))
    return faces


def surface(body: list, tubes: list | None = None) -> MeasuredSurface:
    tubes = tubes or []
    return MeasuredSurface(
        design_id="synthetic",
        triangles=tuple(body + tubes),
        roles=tuple([BODY_ROLE] * len(body) + [CLUTCH_ROLE] * len(tubes)),
    )


class SolidIntervalColumnTests(unittest.TestCase):
    def test_box_winding_marks_outward_faces_as_entries_and_exits(self) -> None:
        columns, counts = solid_interval_columns(surface(box((0, 0, 0), (2, 3, 2))))

        self.assertEqual(columns, {(x, z): [(0, 3)] for x in range(2) for z in range(2)})
        self.assertEqual(counts["columns"], 4)

    def test_a_cavity_opening_sideways_stays_empty_where_the_height_field_fills_it(self) -> None:
        # A "C" open toward +X, like 41682's flange recess that a stud enters along +Z.
        body = [
            *box((0, 0, 0), (4, 1, 2)),
            *box((0, 1, 0), (1, 3, 2)),
            *box((0, 3, 0), (4, 4, 2)),
        ]

        columns, _ = solid_interval_columns(surface(body))

        for x in range(1, 4):
            self.assertEqual(columns[(x, 0)], [(0, 1), (3, 4)])
        self.assertEqual(columns[(0, 0)], [(0, 4)])
        self.assertEqual(_height_field(body, 1.0)[(2, 0)], (0, 4))

    def test_a_clip_sliver_on_a_column_boundary_reaches_no_column(self) -> None:
        # 41682's flange top: this exact triangulation of a face ending on the z = 4
        # boundary leaves a 4.4e-16 LDU clip sliver in two columns behind it, which
        # the height field extends to the flange top (its two 1-LDU stick-outs).
        top = [
            ((20.0, -20.0, 4.0), (-20.0, -20.0, 4.0), (-20.0, -20.0, -4.0)),
            ((20.0, -20.0, 4.0), (-20.0, -20.0, -4.0), (20.0, -20.0, -4.0)),
        ]
        body = [*box((-20.0, -20.0, -4.0), (20.0, 0.0, 4.0), top=False), *top]

        height_field = _height_field(body, 1.0)
        columns, _ = solid_interval_columns(surface(body))

        self.assertEqual(sorted(cell for cell in height_field if cell[1] == 4), [(-17, 4), (-12, 4)])
        self.assertEqual(sorted(cell for cell in columns if cell[1] == 4), [])
        self.assertEqual(columns[(-12, 3)], [(-20.0, 0.0)])

    def test_a_body_surface_open_along_a_column_is_refused(self) -> None:
        with self.assertRaisesRegex(OpenColumnSurfaceError, r"not closed along column x \[0, 1\]"):
            solid_interval_columns(surface(box((0, 0, 0), (1, 2, 1), top=False)))

    def test_an_open_underside_tube_keeps_its_full_height_in_every_column_it_reaches(self) -> None:
        # A tube hangs open-topped from the plate's underside, as stud4 does; inside
        # its walls only its bottom face reaches the column, yet the wall is solid.
        plate = box((0, 0, 0), (4, 1, 4))
        tube = box((1, 1, 1), (3, 3, 3), top=False)

        columns, counts = solid_interval_columns(surface(plate, tube))

        self.assertEqual(columns[(1, 1)], [(0, 3)])
        self.assertEqual(columns[(0, 0)], [(0, 1)])
        self.assertEqual(counts["tubeEnvelopes"], 4)

    def test_the_candidate_is_boxes_over_each_solid_interval(self) -> None:
        body = [
            *box((0, 0, 0), (4, 1, 2)),
            *box((0, 1, 0), (1, 3, 2)),
            *box((0, 3, 0), (4, 4, 2)),
        ]

        candidate = solid_interval_candidate(surface(body))
        boxes = sorted(
            (tuple(row["minLdu"]), tuple(row["maxLdu"]))  # type: ignore[index]
            for row in candidate["bodies"]  # type: ignore[union-attr]
        )

        self.assertEqual(
            boxes,
            [((0, 0, 0), (1, 4, 2)), ((1, 0, 0), (4, 1, 2)), ((1, 3, 0), (4, 4, 2))],
        )
        self.assertIn("column-solid-intervals/1ldu", str(candidate["derivation"]))
        self.assertEqual(len(column_candidate(surface(body))["bodies"]), 1)  # type: ignore[arg-type]


if __name__ == "__main__":
    unittest.main(verbosity=2)
