from __future__ import annotations

import unittest
from dataclasses import replace
from fractions import Fraction
from pathlib import Path

from ldcad_shadow_axle_holes import (
    emit_axle_hole_connectors,
    is_axle_hole_declaration,
)
from ldcad_shadow_connectors import (
    compose_part_snaps,
    emit_clutch_connectors,
    emit_stud_connectors,
    snap_instances,
)
from ldcad_shadow_metas import parse_shadow_metas
from ldcad_shadow_source import VerifiedShadowLibrary
from ldraw_source_archive import LDrawSourceLibrary, VerifiedArchive
from set_6651557_ldraw_source_audit_plan import ARCHIVE_PINS

HEADER = (
    '0 LDCad shadow info for "Synthetic Axle Hole"\n'
    "0 Author: Repository Test\n"
    "0 !LICENSE CC BY-SA 4.0, see LICENSE.md\n\n"
)
EXACT_AXLE_HOLE = (
    "SNAP_CYL [id=axleHole] [pos=0 2 0] [secs=A 6 1] [scale=YOnly] "
    "[slide=true] [caps=none] [gender=F]"
)
EXACT_AXLE_HOLE4 = EXACT_AXLE_HOLE.replace("pos=0 2 0", "pos=0 1 0")
EXACT_32064A_MATRIX = (
    Fraction(0),
    Fraction(0),
    Fraction(1),
    Fraction(-1),
    Fraction(0),
    Fraction(0),
    Fraction(0),
    Fraction(-20),
    Fraction(0),
)
EXACT_32064A_TRANSLATION = (Fraction(0), Fraction(10), Fraction(30))
EXACT_73230_MATRIX = (
    Fraction(1),
    Fraction(0),
    Fraction(0),
    Fraction(0),
    Fraction(0),
    Fraction(1),
    Fraction(0),
    Fraction(20),
    Fraction(0),
)
EXACT_73230_TRANSLATION = (Fraction(0), Fraction(10), Fraction(-10))
PINNED_OFFICIAL = Path("C:/tmp/ldraw-complete-2026-07.zip")
PINNED_UNOFFICIAL = Path("C:/tmp/ldraw-unofficial-2026-08-02.zip")
PINNED_SHADOW = Path("C:/tmp/ldcad-shadow-20260802")


def source_snap(line: str = EXACT_AXLE_HOLE, path: str = "p/axlehol5.dat"):
    metas = parse_shadow_metas(HEADER + f"0 !LDCAD {line}\n", path)
    assert len(metas) == 1
    snaps = snap_instances(metas[0])
    assert len(snaps) == 1
    return snaps[0]


def composed_snap():
    return source_snap().transformed(EXACT_32064A_MATRIX, EXACT_32064A_TRANSLATION)


def composed_73230_snap():
    return source_snap(EXACT_AXLE_HOLE4, "p/axlehol4.dat").transformed(
        EXACT_73230_MATRIX, EXACT_73230_TRANSLATION
    )


class ExactAxleHoleTests(unittest.TestCase):
    def test_32064a_projects_the_scaled_source_segment_to_its_exact_midpoint(self) -> None:
        snap = composed_snap()

        self.assertTrue(is_axle_hole_declaration(snap))
        emitted = emit_axle_hole_connectors([snap])
        self.assertEqual(
            [
                (row["kind"], row["gender"], row["positionLdu"], row["normal"])
                for row in emitted
            ],
            [("axleHole", "female", [0.0, 10.0, 0.0], [0.0, 0.0, 1.0])],
        )
        source = emitted[0]["source"]
        self.assertIsInstance(source, dict)
        assert isinstance(source, dict)
        self.assertEqual(source["path"], "p/axlehol5.dat")
        self.assertEqual(source["section"], "A 6 1")
        self.assertEqual((source["scale"], source["mirror"]), ("YOnly", None))
        self.assertEqual(source["startLdu"], [0.0, 10.0, -10.0])
        self.assertEqual(source["endLdu"], [0.0, 10.0, 10.0])
        self.assertEqual(source["midpointLdu"], [0.0, 10.0, 0.0])
        self.assertEqual(source["segmentLengthLdu"], 20.0)

    def test_73230_projects_axlehol4_to_its_exact_opposed_frame(self) -> None:
        snap = composed_73230_snap()

        self.assertTrue(is_axle_hole_declaration(snap))
        emitted = emit_axle_hole_connectors([snap])

        self.assertEqual(
            [
                (row["kind"], row["gender"], row["positionLdu"], row["normal"])
                for row in emitted
            ],
            [("axleHole", "female", [0.0, 10.0, 0.0], [0.0, 0.0, -1.0])],
        )
        source = emitted[0]["source"]
        self.assertIsInstance(source, dict)
        assert isinstance(source, dict)
        self.assertEqual(source["path"], "p/axlehol4.dat")
        self.assertEqual(source["startLdu"], [0.0, 10.0, 10.0])
        self.assertEqual(source["endLdu"], [0.0, 10.0, -10.0])
        self.assertEqual(source["midpointLdu"], [0.0, 10.0, 0.0])
        self.assertEqual(source["direction"], [0.0, 0.0, -1.0])

    def test_only_the_exact_female_capless_sliding_a6_yonly_shape_is_eligible(self) -> None:
        variants = (
            EXACT_AXLE_HOLE.replace("gender=F", "gender=M"),
            EXACT_AXLE_HOLE.replace("caps=none", "caps=one"),
            EXACT_AXLE_HOLE.replace("slide=true", "slide=false"),
            EXACT_AXLE_HOLE.replace("secs=A 6 1", "secs=R 6 1"),
            EXACT_AXLE_HOLE.replace("secs=A 6 1", "secs=A 5 1"),
            EXACT_AXLE_HOLE.replace("secs=A 6 1", "secs=A 6 2"),
            EXACT_AXLE_HOLE.replace("[id=axleHole] ", ""),
            EXACT_AXLE_HOLE.replace("id=axleHole", "id=other"),
            EXACT_AXLE_HOLE + " [group=other]",
            EXACT_AXLE_HOLE.replace(" [scale=YOnly]", ""),
            EXACT_AXLE_HOLE.replace("scale=YOnly", "scale=XYZ"),
            EXACT_AXLE_HOLE + " [mirror=cor]",
            EXACT_AXLE_HOLE + " [center=true]",
            EXACT_AXLE_HOLE + " [grid=C 2 1 20 0]",
        )

        for line in variants:
            with self.subTest(line=line):
                snaps = snap_instances(
                    parse_shadow_metas(HEADER + f"0 !LDCAD {line}\n", "p/axlehol5.dat")[0]
                )
                self.assertTrue(all(not is_axle_hole_declaration(snap) for snap in snaps))
                self.assertEqual(emit_axle_hole_connectors(snaps), [])

    def test_wrong_source_path_rejects_only_that_snap(self) -> None:
        exact = composed_snap()
        wrong = replace(exact, source_path="p/not-axlehol5.dat")
        rejections: list[str] = []

        emitted = emit_axle_hole_connectors(
            [wrong, exact], on_reject=lambda reason, snap: rejections.append(reason)
        )

        self.assertEqual([row["positionLdu"] for row in emitted], [[0.0, 10.0, 0.0]])
        self.assertEqual(rejections, ["unexpected-axle-hole-source-path"])

    def test_duplicate_declarations_deduplicate_but_report_the_duplicate(self) -> None:
        exact = composed_snap()
        rejections: list[str] = []

        emitted = emit_axle_hole_connectors(
            [exact, exact], on_reject=lambda reason, snap: rejections.append(reason)
        )

        self.assertEqual(len(emitted), 1)
        self.assertEqual(rejections, ["duplicate-of-an-already-emitted-axle-hole"])

    def test_fractional_midpoint_is_not_rounded_into_connector_truth(self) -> None:
        fractional = source_snap().transformed(
            EXACT_32064A_MATRIX,
            (Fraction(1, 2), Fraction(10), Fraction(10)),
        )
        rejections: list[str] = []

        self.assertEqual(
            emit_axle_hole_connectors(
                [fractional], on_reject=lambda reason, snap: rejections.append(reason)
            ),
            [],
        )
        self.assertEqual(rejections, ["fractional-axle-hole-segment"])

    def test_nonrepresentable_position_rejects_only_that_snap(self) -> None:
        huge = source_snap().transformed(
            EXACT_32064A_MATRIX,
            (Fraction(9_007_199_254_740_993), Fraction(10), Fraction(10)),
        )
        exact = composed_snap()
        rejections: list[str] = []

        emitted = emit_axle_hole_connectors(
            [huge, exact], on_reject=lambda reason, snap: rejections.append(reason)
        )

        self.assertEqual([row["positionLdu"] for row in emitted], [[0.0, 10.0, 0.0]])
        self.assertEqual(rejections, ["axle-hole-position-not-exactly-representable"])

    def test_non_axis_and_wrong_length_segments_refuse_without_aborting_the_batch(self) -> None:
        non_axis = source_snap().transformed(
            (
                Fraction(1),
                Fraction(1),
                Fraction(0),
                Fraction(0),
                Fraction(0),
                Fraction(1),
                Fraction(0),
                Fraction(-20),
                Fraction(0),
            ),
            EXACT_32064A_TRANSLATION,
        )
        short = source_snap().transformed(
            (*EXACT_32064A_MATRIX[:7], Fraction(-19), Fraction(0)),
            EXACT_32064A_TRANSLATION,
        )
        rejections: list[str] = []

        emitted = emit_axle_hole_connectors(
            [non_axis, short, composed_snap()],
            on_reject=lambda reason, snap: rejections.append(reason),
        )

        self.assertEqual([row["positionLdu"] for row in emitted], [[0.0, 10.0, 0.0]])
        self.assertEqual(
            rejections,
            ["non-axis-axle-hole-segment", "unexpected-axle-hole-segment-length"],
        )

    @unittest.skipUnless(
        PINNED_OFFICIAL.is_file() and PINNED_UNOFFICIAL.is_file() and PINNED_SHADOW.is_dir(),
        "pinned local LDraw and LDCad inputs are absent",
    )
    def test_pinned_32064a_composition_matches_the_exact_bridge_contract(self) -> None:
        paths = {"official": PINNED_OFFICIAL, "unofficial": PINNED_UNOFFICIAL}
        library = LDrawSourceLibrary(
            [VerifiedArchive(paths[pin.archive_id], pin) for pin in ARCHIVE_PINS]
        )
        try:
            composition = compose_part_snaps(
                library,
                VerifiedShadowLibrary(PINNED_SHADOW),
                library.exact("official", "parts/32064a.dat"),
            )
        finally:
            library.close()

        self.assertEqual(
            composition.shadow_files_used,
            ["p/axlehol5.dat", "p/stud2.dat", "parts/32064a.dat"],
        )
        eligible = [snap for snap in composition.snaps if is_axle_hole_declaration(snap)]
        self.assertEqual(len(eligible), 1)
        self.assertEqual(
            [
                (row["positionLdu"], row["normal"])
                for row in emit_axle_hole_connectors(composition.snaps)
            ],
            [([0.0, 10.0, 0.0], [0.0, 0.0, 1.0])],
        )

    @unittest.skipUnless(
        PINNED_OFFICIAL.is_file() and PINNED_UNOFFICIAL.is_file() and PINNED_SHADOW.is_dir(),
        "pinned local LDraw and LDCad inputs are absent",
    )
    def test_pinned_73230_composition_matches_the_exact_axlehol4_bridge(self) -> None:
        paths = {"official": PINNED_OFFICIAL, "unofficial": PINNED_UNOFFICIAL}
        library = LDrawSourceLibrary(
            [VerifiedArchive(paths[pin.archive_id], pin) for pin in ARCHIVE_PINS]
        )
        try:
            composition = compose_part_snaps(
                library,
                VerifiedShadowLibrary(PINNED_SHADOW),
                library.exact("official", "parts/73230.dat"),
            )
        finally:
            library.close()

        self.assertEqual(
            composition.shadow_files_used,
            ["p/axlehol4.dat", "p/stud2.dat", "parts/73230.dat"],
        )
        eligible = [snap for snap in composition.snaps if is_axle_hole_declaration(snap)]
        self.assertEqual(len(eligible), 1)
        self.assertEqual(
            [
                (row["positionLdu"], row["normal"])
                for row in emit_stud_connectors(composition.snaps)
            ],
            [([0.0, 0.0, 0.0], [0.0, -1.0, 0.0])],
        )
        self.assertEqual(emit_clutch_connectors(composition.snaps), [])
        self.assertEqual(
            [
                (row["positionLdu"], row["normal"])
                for row in emit_clutch_connectors(
                    composition.snaps, allow_square_s6=True
                )
            ],
            [([0.0, 24.0, 0.0], [0.0, 1.0, 0.0])],
        )
        self.assertEqual(
            [
                (row["positionLdu"], row["normal"])
                for row in emit_axle_hole_connectors(composition.snaps)
            ],
            [([0.0, 10.0, 0.0], [0.0, 0.0, -1.0])],
        )


if __name__ == "__main__":
    unittest.main(verbosity=2)
