from __future__ import annotations

import math
import unittest

from ldraw_surface_smoothing import SmoothingFace, smooth_face_normals


def close_tuple(
    case: unittest.TestCase,
    actual: tuple[float, float, float],
    expected: tuple[float, float, float],
) -> None:
    for component, wanted in zip(actual, expected):
        case.assertAlmostEqual(component, wanted, places=12)


class LDrawSurfaceSmoothingTests(unittest.TestCase):
    def test_type_2_edge_blocks_a_shallow_fold_that_would_otherwise_smooth(self) -> None:
        slope = math.sqrt(3) / 2
        faces = (
            SmoothingFace(((0, 0, 0), (1, 0, 0), (0, 1, 0)), "16"),
            SmoothingFace(((1, 0, 0), (0, 0, 0), (0, -slope, 0.5)), "16"),
        )
        smoothed = smooth_face_normals(faces, ())
        self.assertNotEqual(smoothed[0][0], (0.0, 0.0, 1.0))

        hard = smooth_face_normals(faces, (((0, 0, 0), (1, 0, 0)),))
        close_tuple(self, hard[0][0], (0.0, 0.0, 1.0))
        close_tuple(self, hard[1][1], (0.0, 0.5, math.sqrt(3) / 2))

    def test_fold_past_67_5_degrees_is_hard_without_a_source_line(self) -> None:
        faces = (
            SmoothingFace(((0, 0, 0), (1, 0, 0), (0, 1, 0)), "16"),
            SmoothingFace(((1, 0, 0), (0, 0, 0), (0, -0.1, 1)), "16"),
        )
        normals = smooth_face_normals(faces, ())
        close_tuple(self, normals[0][0], (0.0, 0.0, 1.0))
        self.assertGreater(normals[1][1][1], 0.99)

    def test_quad_face_contributes_once_to_a_shared_corner_normal(self) -> None:
        slope = math.sqrt(3) / 2
        faces = (
            SmoothingFace(((0, 0, 0), (1, 0, 0), (1, 1, 0), (0, 1, 0)), "16"),
            SmoothingFace(((1, 0, 0), (0, 0, 0), (0, -slope, 0.5)), "16"),
        )
        normals = smooth_face_normals(faces, ())
        expected = (0.0, math.sin(math.radians(15)), math.cos(math.radians(15)))
        close_tuple(self, normals[0][0], expected)
        close_tuple(self, normals[0][1], expected)
        close_tuple(self, normals[0][2], (0.0, 0.0, 1.0))

    def test_hard_line_subsegments_are_checked_only_for_multiple_face_colours(self) -> None:
        slope = math.sqrt(3) / 2
        one_colour = (
            SmoothingFace(((0, 0, 0), (1, 0, 0), (0, 1, 0)), "16"),
            SmoothingFace(((1, 0, 0), (0, 0, 0), (0, -slope, 0.5)), "16"),
        )
        spanning_line = (((0, 0, 0), (2, 0, 0)),)
        self.assertNotEqual(smooth_face_normals(one_colour, spanning_line)[0][0], (0.0, 0.0, 1.0))

        multiple_colours = (one_colour[0], SmoothingFace(one_colour[1].points, "4"))
        normals = smooth_face_normals(multiple_colours, spanning_line)
        close_tuple(self, normals[0][0], (0.0, 0.0, 1.0))


if __name__ == "__main__":
    unittest.main()
