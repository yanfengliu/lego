from __future__ import annotations

import tempfile
import unittest
from fractions import Fraction
from pathlib import Path

from ldcad_shadow_axle_test import ExactAxleShaftTests
from ldcad_shadow_connectors import (
    ShadowSnap,
    axis_normal,
    compose_part_snaps,
    emit_clutch_connectors,
    emit_stud_connectors,
    snap_census,
    snap_instances,
)
from ldcad_shadow_metas import parse_grid, parse_sections, parse_shadow_metas
from ldcad_shadow_source import (
    SHADOW_LIBRARY_COMMIT,
    SHADOW_LIBRARY_LICENSE,
    VerifiedShadowLibrary,
    normalize_shadow_path,
    shadow_candidates,
)

HEADER = (
    '0 LDCad shadow info for "Synthetic Test Part"\n'
    "0 Author: Repository Test\n"
    "0 !LICENSE CC BY-SA 4.0, see LICENSE.md\n"
    "\n"
)


def shadow_text(*meta_lines: str) -> str:
    return HEADER + "".join(f"0 !LDCAD {line}\n" for line in meta_lines)


def one_meta(line: str):
    metas = parse_shadow_metas(shadow_text(line), "parts/test.dat")
    assert len(metas) == 1
    return metas[0]


class StubLDrawLibrary:
    """The two calls the shadow walk makes of an LDraw library, and nothing else."""

    def __init__(self, files: dict[str, str]) -> None:
        self.files = {key.lower(): value for key, value in files.items()}

    def text(self, key: tuple[str, str]) -> str:
        return self.files[key[1].lower()]

    def resolve(self, reference: str, source_archive_id: str) -> tuple[str, str]:
        normalized = reference.replace("\\", "/").lower()
        for candidate in (normalized, f"parts/{normalized}", f"p/{normalized}"):
            if candidate in self.files:
                return (source_archive_id, candidate)
        raise FileNotFoundError(reference)


def write_shadow_tree(root: Path, files: dict[str, str]) -> VerifiedShadowLibrary:
    for relative, content in files.items():
        target = root / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(content, encoding="utf-8", newline="\r\n")
    return VerifiedShadowLibrary(root, expect_pin=False)


class GridTests(unittest.TestCase):
    def test_the_documented_two_by_four_plate_field_expands_to_its_eight_cells(self) -> None:
        meta = one_meta("SNAP_CYL [gender=F] [caps=one] [secs=R 6 4] [pos=0 8 0] [grid=C 4 C 2 20 20]")
        offsets = {(str(x), str(y), str(z)) for x, y, z in parse_grid(meta)}
        self.assertEqual(
            offsets,
            {
                (str(Fraction(x)), "0", str(Fraction(z)))
                for x in (-30, -10, 10, 30)
                for z in (-10, 10)
            },
        )

    def test_an_uncentred_grid_runs_from_the_position_in_the_positive_direction(self) -> None:
        meta = one_meta("SNAP_CYL [gender=F] [caps=one] [secs=R 6 4] [pos=0 8 0] [grid=3 2 20 20]")
        offsets = sorted((int(x), int(z)) for x, _, z in parse_grid(meta))
        self.assertEqual(offsets, [(0, 0), (0, 20), (20, 0), (20, 20), (40, 0), (40, 20)])

    def test_one_axis_may_be_centred_while_the_other_is_not(self) -> None:
        meta = one_meta("SNAP_CYL [gender=F] [caps=one] [secs=R 6 4] [grid=C 2 1 20 0]")
        self.assertEqual(
            sorted((int(x), int(z)) for x, _, z in parse_grid(meta)), [(-10, 0), (10, 0)]
        )

    def test_a_three_axis_grid_repeats_up_the_part_as_well(self) -> None:
        meta = one_meta("SNAP_CYL [gender=F] [caps=one] [secs=R 6 4] [grid=1 2 1 0 60 0]")
        self.assertEqual(
            sorted((int(x), int(y), int(z)) for x, y, z in parse_grid(meta)),
            [(0, 0, 0), (0, 60, 0)],
        )

    def test_a_centred_three_axis_grid_centres_the_axes_it_marks(self) -> None:
        meta = one_meta("SNAP_CYL [gender=F] [caps=one] [secs=R 6 4] [grid=1 C 2 C 2 0 80 60]")
        self.assertEqual(
            sorted((int(x), int(y), int(z)) for x, y, z in parse_grid(meta)),
            [(0, -40, -30), (0, -40, 30), (0, 40, -30), (0, 40, 30)],
        )

    def test_a_meta_with_no_grid_is_exactly_one_instance(self) -> None:
        meta = one_meta("SNAP_CYL [gender=F] [caps=one] [secs=R 6 4] [pos=-10 8 0]")
        self.assertEqual(parse_grid(meta), ((Fraction(0), Fraction(0), Fraction(0)),))

    def test_a_grid_no_arity_can_read_is_refused_with_what_it_declared(self) -> None:
        meta = one_meta("SNAP_CYL [gender=F] [secs=R 6 4] [grid=C 2 2 20]")
        with self.assertRaises(ValueError) as error:
            parse_grid(meta)
        self.assertIn("grid=C 2 2 20", str(error.exception))
        self.assertIn("no reading of", str(error.exception))

    def test_a_grid_count_beyond_the_bound_is_refused_with_the_range(self) -> None:
        meta = one_meta("SNAP_CYL [gender=F] [secs=R 6 4] [grid=999 1 20 0]")
        with self.assertRaises(ValueError) as error:
            parse_grid(meta)
        self.assertIn("999", str(error.exception))
        self.assertIn("1..64", str(error.exception))


class SectionTests(unittest.TestCase):
    def test_a_two_block_section_list_keeps_both_blocks_in_order(self) -> None:
        sections = parse_sections(one_meta("SNAP_CYL [gender=F] [secs=R 6 4   R 4 8]"))
        self.assertEqual(
            [(row.variant, int(row.radius), int(row.length)) for row in sections],
            [("R", 6, 4), ("R", 4, 8)],
        )

    def test_a_section_list_that_is_not_a_multiple_of_three_is_refused(self) -> None:
        with self.assertRaises(ValueError) as error:
            parse_sections(one_meta("SNAP_CYL [gender=F] [secs=R 6]"))
        self.assertIn("blocks of three", str(error.exception))

    def test_an_unknown_shape_variant_names_the_variants_ldcad_defines(self) -> None:
        with self.assertRaises(ValueError) as error:
            parse_sections(one_meta("SNAP_CYL [gender=F] [secs=Q 6 4]"))
        self.assertIn("'Q'", str(error.exception))
        self.assertIn("R (round)", str(error.exception))


class MetaParsingTests(unittest.TestCase):
    def test_a_commented_meta_is_text_and_never_a_claim(self) -> None:
        text = HEADER + "0 //!LDCAD SNAP_CYL [id=aStud] [gender=F] [caps=one] [secs=R 6 4]\n"
        self.assertEqual(parse_shadow_metas(text, "p/stud4.dat"), ())

    def test_an_unknown_ldcad_command_is_refused_rather_than_skipped(self) -> None:
        with self.assertRaises(ValueError) as error:
            parse_shadow_metas(HEADER + "0 !LDCAD SNAP_NEW [gender=F]\n", "parts/test.dat")
        self.assertIn("SNAP_NEW", str(error.exception))
        self.assertIn("refusal rather than a skip", str(error.exception))

    def test_a_parameter_that_contradicts_itself_is_refused_with_both_values(self) -> None:
        with self.assertRaises(ValueError) as error:
            parse_shadow_metas(
                HEADER + "0 !LDCAD SNAP_CYL [gender=F] [gender=M]\n", "parts/test.dat"
            )
        self.assertIn("[gender=F]", str(error.exception))
        self.assertIn("[gender=M]", str(error.exception))

    def test_a_parameter_repeated_with_the_same_value_is_redundant_not_ambiguous(self) -> None:
        meta = one_meta("SNAP_GEN [group=techBallJnt] [gender=M] [group=techBallJnt]")
        self.assertEqual(meta.text("group"), "techBallJnt")

    def test_an_unterminated_bracket_is_refused(self) -> None:
        with self.assertRaises(ValueError) as error:
            parse_shadow_metas(HEADER + "0 !LDCAD SNAP_CYL [gender=F\n", "parts/test.dat")
        self.assertIn("unterminated", str(error.exception))

    def test_an_unknown_gender_word_names_the_two_ldcad_defines(self) -> None:
        from ldcad_shadow_connectors import _gender

        with self.assertRaises(ValueError) as error:
            _gender(one_meta("SNAP_CYL [gender=X] [secs=R 6 4]"))
        self.assertIn("LDCad genders are M and F", str(error.exception))


class PathSafetyTests(unittest.TestCase):
    def test_a_traversal_path_is_refused(self) -> None:
        for unsafe in ("../secrets.dat", "/etc/passwd", "c:/windows/x.dat", "parts/\u00e9.dat"):
            with self.assertRaises(ValueError):
                normalize_shadow_path(unsafe)

    def test_a_backslash_subpart_reference_resolves_like_ldraw_does(self) -> None:
        self.assertEqual(
            shadow_candidates("s\\93273s01.dat"), ("parts/s/93273s01.dat", "s/93273s01.dat")
        )


class VerifiedShadowLibraryTests(unittest.TestCase):
    def test_a_tree_that_is_not_the_pinned_checkout_names_both_digests(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "parts").mkdir()
            (root / "parts/test.dat").write_text(shadow_text("SNAP_CYL [gender=F]"), encoding="utf-8")
            with self.assertRaises(ValueError) as error:
                VerifiedShadowLibrary(root)
            message = str(error.exception)
            self.assertIn(SHADOW_LIBRARY_COMMIT, message)
            self.assertIn("Re-check out the pinned commit", message)

    def test_an_oversized_shadow_file_is_refused_before_it_is_parsed(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "parts").mkdir()
            (root / "parts/big.dat").write_bytes(b"0 x\n" * 40_000)
            with self.assertRaises(ValueError) as error:
                VerifiedShadowLibrary(root, expect_pin=False)
            self.assertIn("the bound is 65536", str(error.exception))

    def test_the_identity_it_reports_is_the_licence_the_bill_of_materials_records(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            library = write_shadow_tree(
                Path(directory), {"parts/test.dat": shadow_text("SNAP_CYL [gender=F] [secs=R 6 4]")}
            )
            identity = library.identity()
            self.assertEqual(identity["declaredLicense"], SHADOW_LIBRARY_LICENSE)
            self.assertEqual(identity["commit"], SHADOW_LIBRARY_COMMIT)
            self.assertIn("no shadow file is committed", str(identity["allowedRole"]))

    def test_lettered_variants_of_a_design_are_findable_when_the_exact_name_is_not(self) -> None:
        meta = shadow_text("SNAP_CYL [gender=F] [caps=one] [secs=R 6 44]")
        with tempfile.TemporaryDirectory() as directory:
            library = write_shadow_tree(
                Path(directory),
                {
                    "parts/3245a.dat": meta,
                    "parts/3245b.dat": meta,
                    "parts/s/3245as01.dat": meta,
                    "parts/32456.dat": meta,
                    "parts/9999.dat": meta,
                },
            )
            self.assertIsNone(library.resolve("3245.dat"))
            self.assertEqual(
                library.variants("3245"), ["parts/32456.dat", "parts/3245a.dat", "parts/3245b.dat"]
            )
            self.assertEqual(library.variants("9999"), ["parts/9999.dat"])
            self.assertEqual(library.variants("41770"), [])


class CompositionTests(unittest.TestCase):
    """The walk itself: a snap inherits the matrix that places its geometry."""

    def _compose(self, ldraw: dict[str, str], shadow: dict[str, str], root: str = "parts/root.dat"):
        library = StubLDrawLibrary(ldraw)
        with tempfile.TemporaryDirectory() as directory:
            tree = write_shadow_tree(Path(directory), shadow)
            return compose_part_snaps(library, tree, ("official", root))  # type: ignore[arg-type]

    def test_a_clutch_declared_on_a_subpart_is_carried_by_the_subparts_placement(self) -> None:
        composition = self._compose(
            {
                "parts/root.dat": "0 Root\n1 16 40 0 -20 1 0 0 0 1 0 0 0 1 s\\rootsub.dat\n",
                "parts/s/rootsub.dat": "0 Sub\n",
            },
            {"parts/s/rootsub.dat": shadow_text("SNAP_CYL [gender=F] [caps=one] [secs=R 6 4] [pos=0 8 0]")},
        )
        self.assertEqual(
            emit_clutch_connectors(composition.snaps),
            [
                {
                    "kind": "undersideClutch",
                    "gender": "female",
                    "positionLdu": [40.0, 8.0, -20.0],
                    "normal": [0.0, 1.0, 0.0],
                }
            ],
        )

    def test_a_quarter_turn_placement_rotates_the_grid_it_inherits(self) -> None:
        composition = self._compose(
            {
                "parts/root.dat": "0 Root\n1 16 0 0 0 0 0 1 0 1 0 -1 0 0 s\\rootsub.dat\n",
                "parts/s/rootsub.dat": "0 Sub\n",
            },
            {
                "parts/s/rootsub.dat": shadow_text(
                    "SNAP_CYL [gender=F] [caps=one] [secs=R 6 4] [pos=0 8 0] [grid=C 2 1 20 0]"
                )
            },
        )
        self.assertEqual(
            [row["positionLdu"] for row in emit_clutch_connectors(composition.snaps)],
            [[0.0, 8.0, -10.0], [0.0, 8.0, 10.0]],
        )

    def test_an_upside_down_placement_flips_the_face_the_clutch_opens_on(self) -> None:
        composition = self._compose(
            {
                "parts/root.dat": "0 Root\n1 16 0 0 0 1 0 0 0 -1 0 0 0 1 s\\rootsub.dat\n",
                "parts/s/rootsub.dat": "0 Sub\n",
            },
            {"parts/s/rootsub.dat": shadow_text("SNAP_CYL [gender=F] [caps=one] [secs=R 6 4] [pos=0 8 0]")},
        )
        emitted = emit_clutch_connectors(composition.snaps)
        self.assertEqual(emitted[0]["positionLdu"], [0.0, -8.0, 0.0])
        self.assertEqual(emitted[0]["normal"], [0.0, -1.0, 0.0])

    def test_the_same_grip_declared_at_two_levels_is_one_grip_and_says_so(self) -> None:
        rejections: list[tuple[str, ShadowSnap]] = []
        composition = self._compose(
            {
                "parts/root.dat": "0 Root\n1 16 0 0 0 1 0 0 0 1 0 0 0 1 s\\rootsub.dat\n",
                "parts/s/rootsub.dat": "0 Sub\n",
            },
            {
                "parts/root.dat": shadow_text("SNAP_CYL [gender=F] [caps=one] [secs=R 6 4] [pos=-10 8 0]"),
                "parts/s/rootsub.dat": shadow_text(
                    "SNAP_CYL [gender=F] [caps=one] [secs=R 6 4] [pos=-10 8 0]"
                ),
            },
        )
        emitted = emit_clutch_connectors(
            composition.snaps, on_reject=lambda reason, snap: rejections.append((reason, snap))
        )
        self.assertEqual(len(emitted), 1)
        self.assertEqual([reason for reason, _ in rejections], ["duplicate-of-an-already-emitted-grip"])

    def test_snap_clear_flushes_what_the_subfiles_contributed(self) -> None:
        ldraw = {
            "parts/root.dat": "0 Root\n1 16 0 0 0 1 0 0 0 1 0 0 0 1 s\\rootsub.dat\n",
            "parts/s/rootsub.dat": "0 Sub\n",
        }
        inherited = shadow_text("SNAP_CYL [id=aStud] [gender=F] [caps=one] [secs=R 6 4] [pos=0 8 0]")
        cleared = self._compose(ldraw, {"parts/s/rootsub.dat": inherited, "parts/root.dat": shadow_text("SNAP_CLEAR")})
        self.assertEqual(emit_clutch_connectors(cleared.snaps), [])
        self.assertEqual(cleared.cleared, 1)
        by_id = self._compose(
            ldraw, {"parts/s/rootsub.dat": inherited, "parts/root.dat": shadow_text("SNAP_CLEAR [id=axleHole]")}
        )
        self.assertEqual(len(emit_clutch_connectors(by_id.snaps)), 1)

    def test_snap_incl_copies_another_files_metas_and_leaves_nested_ones_alone(self) -> None:
        composition = self._compose(
            {"parts/root.dat": "0 Root\n"},
            {
                "parts/root.dat": shadow_text("SNAP_INCL [ref=donor.dat] [pos=0 8 0] [grid=C 2 1 20 0]"),
                "parts/donor.dat": shadow_text(
                    "SNAP_CYL [gender=F] [caps=one] [secs=R 6 4]",
                    "SNAP_INCL [ref=other.dat]",
                ),
                "parts/other.dat": shadow_text("SNAP_CYL [gender=F] [caps=one] [secs=R 6 4]"),
            },
        )
        self.assertEqual(
            [row["positionLdu"] for row in emit_clutch_connectors(composition.snaps)],
            [[-10.0, 8.0, 0.0], [10.0, 8.0, 0.0]],
        )
        self.assertEqual(composition.includes_followed, 1)
        self.assertEqual(composition.nested_includes_not_followed, 1)

    def test_a_recursive_ldraw_reference_is_refused_with_its_chain(self) -> None:
        with self.assertRaises(ValueError) as error:
            self._compose(
                {
                    "parts/root.dat": "0 Root\n1 16 0 0 0 1 0 0 0 1 0 0 0 1 s\\rootsub.dat\n",
                    "parts/s/rootsub.dat": "0 Sub\n1 16 0 0 0 1 0 0 0 1 0 0 0 1 root.dat\n",
                },
                {},
            )
        self.assertIn("Recursive LDraw reference", str(error.exception))


class ShapeDiscriminationTests(unittest.TestCase):
    """A female cylinder is not automatically a place a stud is held."""

    def _snaps(self, line: str) -> list[ShadowSnap]:
        return snap_instances(one_meta(line))

    def test_only_a_round_six_by_four_or_deeper_female_hole_is_an_anti_stud(self) -> None:
        cases = {
            "SNAP_CYL [gender=F] [caps=one] [secs=R 6 4]": True,
            "SNAP_CYL [gender=F] [caps=none] [secs=R 6 4   R 4 8]": True,
            "SNAP_CYL [gender=F] [caps=one] [secs=S 16 4]": False,
            "SNAP_CYL [gender=F] [caps=one] [secs=R 4 4]": False,
            "SNAP_CYL [gender=F] [caps=none] [secs=R 8 2 R 6 16 R 8 2]": False,
            "SNAP_CYL [gender=F] [caps=one] [secs=R 6 2]": False,
            "SNAP_CYL [gender=M] [caps=one] [secs=R 6 4]": False,
        }
        for line, expected in cases.items():
            with self.subTest(line=line):
                self.assertEqual(self._snaps(line)[0].is_anti_stud, expected)

    def test_a_male_stud_meta_is_read_as_a_stud_and_a_solid_tube_is_not(self) -> None:
        self.assertTrue(self._snaps("SNAP_CYL [gender=M] [caps=one] [secs=R 6 4]")[0].is_stud)
        self.assertFalse(self._snaps("SNAP_CYL [gender=M] [caps=one] [secs=R 4 4]")[0].is_stud)

    def test_a_centred_cylinder_puts_its_mouth_half_a_length_along_its_own_axis(self) -> None:
        snap = self._snaps("SNAP_CYL [gender=F] [caps=none] [secs=R 6 4] [pos=0 0 0] [center=true]")[0]
        self.assertEqual([str(value) for value in snap.position], ["0", "2", "0"])

    def test_a_non_axis_normal_is_reported_rather_than_rounded_to_one(self) -> None:
        self.assertIsNone(
            axis_normal((Fraction(707, 1000), Fraction(707, 1000), Fraction(0)))
        )
        rejections: list[str] = []
        snaps = self._snaps(
            "SNAP_CYL [gender=F] [caps=one] [secs=R 6 4] "
            "[ori=0.70710678 -0.70710678 0 0.70710678 0.70710678 0 0 0 1]"
        )
        self.assertEqual(
            emit_clutch_connectors(snaps, on_reject=lambda reason, snap: rejections.append(reason)),
            [],
        )
        self.assertEqual(rejections, ["non-axis-clutch-normal"])

    def test_the_census_counts_every_snap_by_command_gender_and_leading_shape(self) -> None:
        snaps = self._snaps("SNAP_CYL [gender=F] [caps=one] [secs=R 6 4] [grid=C 2 1 20 0]")
        census = snap_census(snaps)
        self.assertEqual(census["totalSnaps"], 2)
        self.assertEqual(census["antiStuds"], 2)
        self.assertEqual(census["byCommandGenderShape"], {"SNAP_CYL/F/R6x4": 2})

    def test_studs_and_clutches_are_emitted_from_the_same_walk_without_crossing(self) -> None:
        snaps = self._snaps("SNAP_CYL [gender=M] [caps=one] [secs=R 6 4]")
        self.assertEqual(emit_clutch_connectors(snaps), [])
        self.assertEqual(
            emit_stud_connectors(snaps),
            [
                {
                    "kind": "stud",
                    "gender": "male",
                    "positionLdu": [0.0, 0.0, 0.0],
                    "normal": [0.0, -1.0, 0.0],
                }
            ],
        )



if __name__ == "__main__":
    unittest.main()
