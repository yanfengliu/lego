from __future__ import annotations

import math
import unittest

from ldraw_surface_expander import (
    SourceKey,
    ancestry_role_classifier,
    expand_surface,
)
from ldraw_source_archive import LDrawSourceLibrary
from measured_part_tables import require_front_side_surface


class FakeLibrary:
    def __init__(self, files: dict[SourceKey, str]) -> None:
        self.files = files

    def text(self, key: SourceKey) -> str:
        try:
            return self.files[key]
        except KeyError as error:
            raise FileNotFoundError(f"missing fake LDraw source {key}") from error

    def resolve(self, reference: str, source_archive_id: str) -> SourceKey:
        normalized = reference.replace("\\", "/").lower()
        candidates = (
            normalized,
            f"parts/{normalized}",
            f"p/{normalized}",
            f"parts/s/{normalized.removeprefix('s/')}",
        )
        for path in candidates:
            key = (source_archive_id, path)
            if key in self.files:
                return key
        raise FileNotFoundError(reference)


class FakeArchive:
    def __init__(self, archive_id: str, files: dict[str, bytes]) -> None:
        self.archive_id = archive_id
        self.files = files

    def contains(self, path: str) -> bool:
        return path in self.files

    def read(self, path: str) -> bytes:
        return self.files[path]

    def verify_unchanged(self) -> None:
        pass

    def close(self) -> None:
        pass


def z_normal(points: tuple[tuple[float, float, float], ...]) -> float:
    a, b, c = points
    ab = tuple(b[index] - a[index] for index in range(3))
    ac = tuple(c[index] - a[index] for index in range(3))
    return ab[0] * ac[1] - ab[1] * ac[0]


class LDrawSurfaceExpanderTests(unittest.TestCase):
    def test_composes_type_one_transform_and_preserves_full_ancestry(self) -> None:
        library = FakeLibrary(
            {
                ("official", "parts/root.dat"): "\n".join(
                    (
                        "0 root",
                        "0 BFC CERTIFY CCW",
                        "1 16 10 20 30 0 -1 0 1 0 0 0 0 1 s/child.dat",
                    )
                ),
                ("official", "parts/s/child.dat"): "\n".join(
                    (
                        "0 child",
                        "0 BFC CERTIFY CCW",
                        "3 16 1 2 3 4 2 3 1 5 3",
                    )
                ),
            }
        )

        triangles = expand_surface(library, ("official", "parts/root.dat"), lambda _: "body")

        self.assertEqual(len(triangles), 1)
        self.assertEqual(
            triangles[0].points,
            ((8.0, 21.0, 33.0), (8.0, 24.0, 33.0), (5.0, 21.0, 33.0)),
        )
        self.assertEqual(
            triangles[0].ancestry,
            (("official", "parts/root.dat"), ("official", "parts/s/child.dat")),
        )
        self.assertTrue(triangles[0].certified)
        self.assertTrue(triangles[0].cull_enabled)

    def test_bfc_inversion_matrix_reversal_and_winding_are_independent(self) -> None:
        triangle = "3 16 0 0 0 1 0 0 0 1 0"
        library = FakeLibrary(
            {
                ("official", "parts/root.dat"): "\n".join(
                    (
                        "0 root",
                        "0 BFC CERTIFY CCW",
                        "1 16 0 0 0 1 0 0 0 1 0 0 0 1 child.dat",
                        "0 BFC INVERTNEXT",
                        "1 16 2 0 0 1 0 0 0 1 0 0 0 1 child.dat",
                        "1 16 4 0 0 -1 0 0 0 1 0 0 0 1 child.dat",
                        "1 16 6 0 0 1 0 0 0 1 0 0 0 1 cw.dat",
                    )
                ),
                ("official", "parts/child.dat"): f"0 child\n0 BFC CERTIFY CCW\n{triangle}",
                ("official", "parts/cw.dat"): f"0 child\n0 BFC CERTIFY CW\n{triangle}",
            }
        )

        triangles = expand_surface(library, ("official", "parts/root.dat"), lambda _: "body")

        self.assertEqual([z_normal(row.points) for row in triangles], [1.0, -1.0, 1.0, -1.0])
        self.assertEqual([row.points[0][0] for row in triangles], [0.0, 2.0, 4.0, 6.0])

    def test_quad_split_and_noclip_propagate_without_losing_geometry(self) -> None:
        library = FakeLibrary(
            {
                ("official", "parts/root.dat"): "\n".join(
                    (
                        "0 root",
                        "0 BFC CERTIFY CCW",
                        "0 BFC NOCLIP",
                        "1 16 0 0 0 1 0 0 0 1 0 0 0 1 child.dat",
                    )
                ),
                ("official", "parts/child.dat"): "\n".join(
                    (
                        "0 child",
                        "0 BFC CERTIFY CCW",
                        "4 16 0 0 0 1 0 0 1 1 0 0 1 0",
                    )
                ),
            }
        )

        triangles = expand_surface(library, ("official", "parts/root.dat"), lambda _: "body")

        self.assertEqual(len(triangles), 2)
        self.assertEqual(triangles[0].points, ((0.0, 0.0, 0.0), (1.0, 0.0, 0.0), (1.0, 1.0, 0.0)))
        self.assertEqual(triangles[1].points, ((0.0, 0.0, 0.0), (1.0, 1.0, 0.0), (0.0, 1.0, 0.0)))
        self.assertFalse(triangles[0].cull_enabled)
        self.assertFalse(triangles[1].cull_enabled)

    def test_bare_bfc_ccw_does_not_certify_front_side_geometry(self) -> None:
        library = FakeLibrary(
            {
                ("official", "parts/root.dat"): (
                    "0 root\n0 BFC CCW\n3 16 0 0 0 1 0 0 0 1 0"
                )
            }
        )

        triangles = expand_surface(library, ("official", "parts/root.dat"), lambda _: "body")

        self.assertEqual(len(triangles), 1)
        self.assertFalse(triangles[0].certified)
        self.assertFalse(triangles[0].cull_enabled)
        with self.assertRaisesRegex(ValueError, "BFC NOCERTIFY"):
            require_front_side_surface("bare-ccw", triangles)

    def test_reversed_nonplanar_quad_uses_ldraw_loaders_p3_p1_surface_diagonal(self) -> None:
        points = ((0.0, 0.0, 0.0), (2.0, 0.0, 0.0), (2.0, 2.0, 0.07), (0.0, 2.0, 0.0))
        quad = "4 16 " + " ".join(str(value) for point in points for value in point)
        library = FakeLibrary(
            {
                ("official", "parts/root.dat"): "\n".join(
                    ("0 root", "0 BFC CERTIFY CW", quad)
                )
            }
        )

        triangles = expand_surface(library, ("official", "parts/root.dat"), lambda _: "body")

        self.assertEqual(triangles[0].points, (points[3], points[2], points[1]))
        self.assertEqual(triangles[1].points, (points[3], points[1], points[0]))
        self.assertEqual(triangles[0].corner_normals[0], triangles[1].corner_normals[0])
        self.assertEqual(triangles[0].corner_normals[2], triangles[1].corner_normals[1])

    def test_stud_role_is_inherited_by_primitive_descendants(self) -> None:
        library = FakeLibrary(
            {
                ("official", "parts/root.dat"): "\n".join(
                    (
                        "0 root",
                        "0 BFC CERTIFY CCW",
                        "1 16 0 0 0 1 0 0 0 1 0 0 0 1 stud.dat",
                    )
                ),
                ("official", "p/stud.dat"): "\n".join(
                    (
                        "0 stud",
                        "0 BFC CERTIFY CCW",
                        "1 16 0 0 0 1 0 0 0 1 0 0 0 1 4-4cyli.dat",
                    )
                ),
                ("official", "p/4-4cyli.dat"): "\n".join(
                    ("0 cylinder", "0 BFC CERTIFY CCW", "3 16 0 0 0 1 0 0 0 1 0")
                ),
            }
        )
        digest = "sha256:" + "a" * 64
        classifier = ancestry_role_classifier(
            frozenset({("official", "p/stud.dat", digest)}),
            lambda _: digest,
        )

        triangles = expand_surface(library, ("official", "parts/root.dat"), classifier)

        self.assertEqual([row.role for row in triangles], ["stud"])
        self.assertEqual(triangles[0].source, ("official", "p/4-4cyli.dat"))

    def test_uncertified_surface_is_retained_but_not_relabelled_as_cull_safe(self) -> None:
        library = FakeLibrary(
            {
                ("official", "parts/root.dat"): "\n".join(
                    ("0 root", "0 BFC NOCERTIFY", "3 16 0 0 0 1 0 0 0 1 0")
                )
            }
        )

        triangles = expand_surface(library, ("official", "parts/root.dat"), lambda _: "body")

        self.assertEqual(len(triangles), 1)
        self.assertFalse(triangles[0].certified)
        self.assertFalse(triangles[0].cull_enabled)
        self.assertEqual(z_normal(triangles[0].points), 1.0)

    def test_rejects_invertnext_interruption_with_actionable_location(self) -> None:
        library = FakeLibrary(
            {
                ("official", "parts/root.dat"): "\n".join(
                    (
                        "0 root",
                        "0 BFC CERTIFY CCW",
                        "0 BFC INVERTNEXT",
                        "0 a comment is not a subfile",
                        "1 16 0 0 0 1 0 0 0 1 0 0 0 1 child.dat",
                    )
                ),
                ("official", "parts/child.dat"): "0 child\n0 BFC CERTIFY CCW",
            }
        )

        with self.assertRaisesRegex(ValueError, "parts/root.dat.*immediately followed.*line 4"):
            expand_surface(library, ("official", "parts/root.dat"), lambda _: "body")

    def test_rejects_duplicate_or_late_certification(self) -> None:
        duplicate = FakeLibrary(
            {
                ("official", "parts/root.dat"): "\n".join(
                    ("0 root", "0 BFC CERTIFY CCW", "0 BFC CERTIFY CCW")
                )
            }
        )
        late = FakeLibrary(
            {
                ("official", "parts/root.dat"): "\n".join(
                    ("0 root", "3 16 0 0 0 1 0 0 0 1 0", "0 BFC CERTIFY CCW")
                )
            }
        )
        after_bfc = FakeLibrary(
            {
                ("official", "parts/root.dat"): "\n".join(
                    ("0 root", "0 BFC NOCLIP", "0 BFC CERTIFY CCW")
                )
            }
        )

        for library in (duplicate, late, after_bfc):
            with self.subTest(library=library):
                with self.assertRaisesRegex(ValueError, "only certification statement"):
                    expand_surface(library, ("official", "parts/root.dat"), lambda _: "body")

    def test_rejects_nonconforming_quads_before_triangulation(self) -> None:
        invalid = {
            "self-intersecting": "4 16 0 0 0 1 1 0 0 1 0 1 0 0",
            "concave": "4 16 0 0 0 2 0 0 0.5 0.5 0 0 2 0",
            "non-planar": "4 16 0 0 0 1 0 0 1 1 0 0 1 0.1",
            "collinear": "4 16 0 0 0 1 0 0 2 0 0 2 1 0",
        }
        for label, quad in invalid.items():
            with self.subTest(label=label):
                library = FakeLibrary(
                    {
                        ("official", "parts/root.dat"): (
                            f"0 root\n0 BFC CERTIFY CCW\n{quad}"
                        )
                    }
                )
                with self.assertRaisesRegex(
                    ValueError,
                    "non-planar|concave or self-intersecting|collinear|repeated",
                ):
                    expand_surface(
                        library,
                        ("official", "parts/root.dat"),
                        lambda _: "body",
                    )

    def test_accepts_official_library_quad_warp_below_three_degrees(self) -> None:
        library = FakeLibrary(
            {
                ("official", "parts/root.dat"): (
                    "0 root\n0 BFC CERTIFY CCW\n"
                    "4 16 0 0 0 1 0 0 1 1 0 0 1 0.01"
                )
            }
        )

        triangles = expand_surface(
            library,
            ("official", "parts/root.dat"),
            lambda _: "body",
        )

        self.assertEqual(len(triangles), 2)

    def test_applies_the_official_three_degree_quad_boundary_to_both_splits(self) -> None:
        def warped_quad(normal_angle_degrees: float) -> str:
            height = math.sqrt(1 / math.cos(math.radians(normal_angle_degrees)) - 1)
            return f"4 16 0 0 0 1 0 0 1 1 0 0 1 {height:.17g}"

        accepted = FakeLibrary(
            {
                ("official", "parts/root.dat"): (
                    "0 root\n0 BFC CERTIFY CCW\n" + warped_quad(3.0)
                )
            }
        )
        self.assertEqual(
            len(expand_surface(accepted, ("official", "parts/root.dat"), lambda _: "body")),
            2,
        )

        rejected = FakeLibrary(
            {
                ("official", "parts/root.dat"): (
                    "0 root\n0 BFC CERTIFY CCW\n" + warped_quad(3.0001)
                )
            }
        )
        with self.assertRaisesRegex(ValueError, "at most 3 degrees"):
            expand_surface(rejected, ("official", "parts/root.dat"), lambda _: "body")

    def test_stud_role_requires_exact_archive_path_and_digest(self) -> None:
        expected_digest = "sha256:" + "a" * 64
        other_digest = "sha256:" + "b" * 64
        classifier = ancestry_role_classifier(
            frozenset({("official", "p/stud.dat", expected_digest)}),
            lambda _: expected_digest,
        )

        self.assertEqual(classifier((("official", "p/stud.dat"),)), "stud")
        self.assertEqual(classifier((("unofficial", "p/stud.dat"),)), "body")
        self.assertEqual(classifier((("official", "p/not-stud.dat"),)), "body")

        wrong_digest = ancestry_role_classifier(
            frozenset({("official", "p/stud.dat", expected_digest)}),
            lambda _: other_digest,
        )
        self.assertEqual(wrong_digest((("official", "p/stud.dat"),)), "body")

    def test_rejects_cycles_and_nonfinite_numbers(self) -> None:
        cycle = FakeLibrary(
            {
                ("official", "parts/a.dat"): "0 a\n0 BFC CERTIFY CCW\n1 16 0 0 0 1 0 0 0 1 0 0 0 1 b.dat",
                ("official", "parts/b.dat"): "0 b\n0 BFC CERTIFY CCW\n1 16 0 0 0 1 0 0 0 1 0 0 0 1 a.dat",
            }
        )
        nonfinite = FakeLibrary(
            {
                ("official", "parts/root.dat"): "0 root\n0 BFC CERTIFY CCW\n3 16 nan 0 0 1 0 0 0 1 0"
            }
        )

        with self.assertRaisesRegex(ValueError, "Recursive LDraw surface reference"):
            expand_surface(cycle, ("official", "parts/a.dat"), lambda _: "body")
        with self.assertRaisesRegex(ValueError, "non-finite"):
            expand_surface(nonfinite, ("official", "parts/root.dat"), lambda _: "body")

    def test_validates_ignored_line_and_conditional_line_records(self) -> None:
        malformed_line = FakeLibrary(
            {
                ("official", "parts/root.dat"): "0 root\n0 BFC CERTIFY CCW\n2 24 0 0 0 1 0"
            }
        )
        nonfinite_conditional = FakeLibrary(
            {
                ("official", "parts/root.dat"): (
                    "0 root\n0 BFC CERTIFY CCW\n5 24 0 0 0 1 0 0 0 1 0 0 nan 0"
                )
            }
        )

        with self.assertRaisesRegex(ValueError, "type-2.*expected 8 fields"):
            expand_surface(malformed_line, ("official", "parts/root.dat"), lambda _: "body")
        with self.assertRaisesRegex(ValueError, "non-finite"):
            expand_surface(nonfinite_conditional, ("official", "parts/root.dat"), lambda _: "body")

    def test_rejects_triangle_collapsed_by_a_complete_reference_transform(self) -> None:
        library = FakeLibrary(
            {
                ("official", "parts/root.dat"): (
                    "0 root\n0 BFC CERTIFY CCW\n"
                    "1 16 0 0 0 1 0 0 0 0 0 0 0 1 child.dat"
                ),
                ("official", "parts/child.dat"): (
                    "0 child\n0 BFC CERTIFY CCW\n3 16 0 0 0 1 0 0 0 1 0"
                ),
            }
        )

        with self.assertRaisesRegex(ValueError, "degenerate after its complete type-1 transform"):
            expand_surface(library, ("official", "parts/root.dat"), lambda _: "body")

    def test_degenerate_reference_matrix_retains_surface_but_disables_culling(self) -> None:
        library = FakeLibrary(
            {
                ("official", "parts/root.dat"): (
                    "0 root\n0 BFC CERTIFY CCW\n"
                    "1 16 0 0 0 1 0 0 0 1 0 0 0 0 child.dat"
                ),
                ("official", "parts/child.dat"): (
                    "0 child\n0 BFC CERTIFY CCW\n3 16 0 0 0 1 0 1 0 1 1"
                ),
            }
        )

        triangles = expand_surface(library, ("official", "parts/root.dat"), lambda _: "body")

        self.assertEqual(len(triangles), 1)
        self.assertFalse(triangles[0].cull_enabled)

    def test_validates_colours_and_preserves_internal_reference_filename_spaces(self) -> None:
        spaced = FakeLibrary(
            {
                ("official", "parts/root.dat"): (
                    "0 root\n0 BFC CERTIFY CCW\n"
                    "1 16 0 0 0 1 0 0 0 1 0 0 0 1 child  with  spaces.dat"
                ),
                ("official", "parts/child  with  spaces.dat"): (
                    "0 child\n0 BFC CERTIFY CCW\n3 0x2ABCDEF 0 0 0 1 0 0 0 1 0"
                ),
            }
        )
        malformed = FakeLibrary(
            {
                ("official", "parts/root.dat"): (
                    "0 root\n0 BFC CERTIFY CCW\n3 sixteen 0 0 0 1 0 0 0 1 0"
                )
            }
        )

        self.assertEqual(
            len(expand_surface(spaced, ("official", "parts/root.dat"), lambda _: "body")),
            1,
        )
        with self.assertRaisesRegex(ValueError, "Malformed LDraw colour.*'sixteen'"):
            expand_surface(malformed, ("official", "parts/root.dat"), lambda _: "body")

    def test_source_library_dependencies_preserve_repeated_filename_spaces(self) -> None:
        root = (
            b"0 root\n"
            b"1 16 0 0 0 1 0 0 0 1 0 0 0 1 child  with  spaces.dat\n"
        )
        library = LDrawSourceLibrary(
            (
                FakeArchive(
                    "official",
                    {
                        "parts/root.dat": root,
                        "parts/child  with  spaces.dat": b"0 child\n",
                    },
                ),
                FakeArchive("unofficial", {}),
            )
        )

        self.assertEqual(
            library.dependencies(("official", "parts/root.dat")),
            (("official", "parts/child  with  spaces.dat"),),
        )


if __name__ == "__main__":
    unittest.main()
