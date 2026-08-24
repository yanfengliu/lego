from __future__ import annotations

import unittest
from pathlib import Path

from ldcad_shadow_axles import emit_axle_connectors
from ldcad_shadow_connectors import snap_census, snap_instances
from ldcad_shadow_metas import parse_shadow_metas
from ldcad_shadow_source import VerifiedShadowLibrary


HEADER = (
    '0 LDCad shadow info for "Synthetic Axle"\n'
    "0 Author: Repository Test\n"
    "0 !LICENSE CC BY-SA 4.0, see LICENSE.md\n\n"
)
SYNTHETIC_4519_SEMANTICS = (
    "SNAP_CYL [slide=true] [secs=A 6 60] [center=true] [caps=none] [gender=M] "
    "[ori=0 -1 0 1 0 0 0 0 1]"
)
PINNED_SHADOW_ROOT = Path("C:/tmp/ldcad-shadow-20260802")


def snaps_for(line: str):
    metas = parse_shadow_metas(HEADER + f"0 !LDCAD {line}\n", "parts/4519.dat")
    assert len(metas) == 1
    return snap_instances(metas[0])


def one_snap(line: str):
    snaps = snaps_for(line)
    assert len(snaps) == 1
    return snaps[0]


class ExactAxleShaftTests(unittest.TestCase):
    def test_4519_projects_its_exact_sixty_ldu_segment_to_three_axle_ports(self) -> None:
        snap = one_snap(SYNTHETIC_4519_SEMANTICS)

        self.assertTrue(snap.is_axle_shaft)
        emitted = emit_axle_connectors([snap])
        self.assertEqual(
            [
                (row["kind"], row["gender"], row["positionLdu"], row["normal"])
                for row in emitted
            ],
            [
                ("axle", "male", [-20.0, 0.0, 0.0], [-1.0, 0.0, 0.0]),
                ("axle", "male", [0.0, 0.0, 0.0], [1.0, 0.0, 0.0]),
                ("axle", "male", [20.0, 0.0, 0.0], [1.0, 0.0, 0.0]),
            ],
        )
        self.assertEqual(
            emitted[0]["source"],
            {
                "path": "parts/4519.dat",
                "line": 5,
                "command": "SNAP_CYL",
                "section": "A 6 60",
                "caps": "none",
                "slide": True,
                "centered": True,
                "gridCount": 1,
                "scale": None,
                "mirror": None,
                "startLdu": [-30.0, 0.0, 0.0],
                "endLdu": [30.0, 0.0, 0.0],
                "direction": [1.0, 0.0, 0.0],
            },
        )
        self.assertEqual(snap_census([snap])["axleShafts"], 1)

    def test_composition_keeps_axle_metadata_and_rotates_the_exact_segment(self) -> None:
        snap = one_snap(SYNTHETIC_4519_SEMANTICS).transformed(
            (0, 0, 1, 0, 1, 0, -1, 0, 0),
            (0, 0, 0),
        )

        self.assertEqual((snap.caps, snap.slide, snap.centered), ("none", True, True))
        self.assertEqual(
            [(row["positionLdu"], row["normal"]) for row in emit_axle_connectors([snap])],
            [
                ([0.0, 0.0, -20.0], [0.0, 0.0, -1.0]),
                ([0.0, 0.0, 0.0], [0.0, 0.0, -1.0]),
                ([0.0, 0.0, 20.0], [0.0, 0.0, 1.0]),
            ],
        )

    def test_only_the_exact_4519_authored_shape_is_eligible(self) -> None:
        rejected = (
            "SNAP_CYL [gender=F] [caps=none] [secs=A 6 60] [center=true] [slide=true]",
            "SNAP_CYL [gender=M] [caps=one] [secs=A 6 60] [center=true] [slide=true]",
            "SNAP_CYL [gender=M] [caps=none] [secs=A 6 60] [center=true] [slide=false]",
            "SNAP_CYL [gender=M] [caps=none] [secs=A 6 60] [slide=true]",
            "SNAP_CYL [gender=M] [caps=none] [secs=R 6 60] [center=true] [slide=true]",
            "SNAP_CYL [gender=M] [caps=none] [secs=A 5 60] [center=true] [slide=true]",
            "SNAP_CYL [gender=M] [caps=none] [secs=A 6 40] [center=true] [slide=true]",
            "SNAP_CYL [gender=M] [caps=none] [secs=A 6 60.5] [center=true] [slide=true]",
            "SNAP_CYL [gender=M] [caps=none] [secs=A 6 60 A 6 1] [center=true] [slide=true]",
            "SNAP_GEN [gender=M] [caps=none] [secs=A 6 60] [center=true] [slide=true]",
            "SNAP_CYL [gender=M] [caps=none] [secs=A 6 60] [center=true] [slide=true] "
            "[ori=0.70710678 -0.70710678 0 0.70710678 0.70710678 0 0 0 1]",
            "SNAP_CYL [gender=M] [caps=none] [secs=A 6 60] [center=true] [slide=true] "
            "[ori=0 -1 0 0.5 0 0 0 0 1]",
            SYNTHETIC_4519_SEMANTICS + " [scale=YOnly]",
            SYNTHETIC_4519_SEMANTICS + " [mirror=cor]",
        )

        for line in rejected:
            with self.subTest(line=line):
                snap = one_snap(line)
                self.assertFalse(snap.is_axle_shaft)
                self.assertEqual(emit_axle_connectors([snap]), [])

    def test_a_grid_of_similar_segments_is_not_the_single_authored_4519_shaft(self) -> None:
        snaps = snaps_for(SYNTHETIC_4519_SEMANTICS + " [grid=C 2 1 20 0]")

        self.assertEqual(len(snaps), 2)
        self.assertTrue(all(not snap.is_axle_shaft for snap in snaps))
        self.assertEqual(emit_axle_connectors(snaps), [])

    def test_a_fractional_segment_start_is_not_rounded_into_catalog_truth(self) -> None:
        snap = one_snap(SYNTHETIC_4519_SEMANTICS + " [pos=0.5 0 0]")
        rejections: list[str] = []

        self.assertEqual(
            emit_axle_connectors(
                [snap], on_reject=lambda reason, rejected: rejections.append(reason)
            ),
            [],
        )
        self.assertEqual(rejections, ["fractional-axle-segment-start"])

    def test_an_integer_that_float64_cannot_represent_rejects_only_that_snap(self) -> None:
        huge = one_snap(SYNTHETIC_4519_SEMANTICS + " [pos=9007199254740993 0 0]")
        exact = one_snap(SYNTHETIC_4519_SEMANTICS)
        rejections: list[str] = []

        emitted = emit_axle_connectors(
            [huge, exact], on_reject=lambda reason, rejected: rejections.append(reason)
        )

        self.assertEqual([row["positionLdu"] for row in emitted], [[-20.0, 0.0, 0.0], [0.0, 0.0, 0.0], [20.0, 0.0, 0.0]])
        self.assertEqual(rejections, ["axle-position-not-exactly-representable"])

    def test_a_malformed_slide_flag_is_refused_during_parsing(self) -> None:
        with self.assertRaises(ValueError) as error:
            one_snap(SYNTHETIC_4519_SEMANTICS.replace("slide=true", "slide=sometimes"))
        self.assertIn("a boolean shadow parameter is true or false", str(error.exception))

    @unittest.skipUnless(PINNED_SHADOW_ROOT.is_dir(), "pinned local shadow checkout is absent")
    def test_the_pinned_4519_shadow_file_matches_the_exact_bridge_contract(self) -> None:
        shadow = VerifiedShadowLibrary(PINNED_SHADOW_ROOT)
        source = shadow.read("parts/4519.dat")
        snaps = [snap for meta in source.metas for snap in snap_instances(meta)]

        self.assertEqual(len(snaps), 1)
        self.assertEqual(
            [(row["positionLdu"], row["normal"]) for row in emit_axle_connectors(snaps)],
            [
                ([-20.0, 0.0, 0.0], [-1.0, 0.0, 0.0]),
                ([0.0, 0.0, 0.0], [1.0, 0.0, 0.0]),
                ([20.0, 0.0, 0.0], [1.0, 0.0, 0.0]),
            ],
        )


if __name__ == "__main__":
    unittest.main()
