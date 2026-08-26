"""Focused gates for opt-in LDCad female square S6 clutch sockets."""

from __future__ import annotations

import hashlib
import json
import unittest
from fractions import Fraction
from pathlib import Path

from builder_ldraw_field import builder_field_nodes
from builder_ldraw_frame import emit_connectors
from builder_ldraw_frame_pins import PINNED_FRAMES, check_pinned_digest
from builder_native_source import NATIVE_PACK_BYTES, NATIVE_PACK_SHA256, validate_native_pack
from ldcad_shadow_connectors import (
    compose_part_snaps,
    emit_clutch_connectors,
    snap_instances,
)
from ldcad_shadow_metas import parse_shadow_metas
from ldcad_shadow_source import VerifiedShadowLibrary
from ldcad_shadow_square_clutches import is_square_s6_clutch_socket
from ldraw_source_archive import LDrawSourceLibrary, VerifiedArchive
from ldraw_surface_expander import expand_surface
from part_admission_clutch import measure_clutch_room
from part_admission_contract import Candidate, Connector
from part_admission_ldraw_candidate import role_classifier
from set_6651557_ldraw_source_audit_plan import ARCHIVE_PINS

HEADER = (
    '0 LDCad shadow info for "Synthetic Square Socket"\n'
    "0 Author: Repository Test\n"
    "0 !LICENSE CC BY-SA 4.0, see LICENSE.md\n\n"
)
EXACT_SQUARE_SOCKET = "SNAP_CYL [gender=F] [caps=one] [secs=S 6 4]"
PINNED_OFFICIAL = Path("C:/tmp/ldraw-complete-2026-07.zip")
PINNED_UNOFFICIAL = Path("C:/tmp/ldraw-unofficial-2026-08-02.zip")
PINNED_SHADOW = Path("C:/tmp/ldcad-shadow-20260802")
PINNED_NATIVE_PACK = Path("C:/tmp/lego-21066-builder-native-part-pack.json")


def snaps_for(line: str, path: str = "parts/synthetic.dat"):
    return snap_instances(parse_shadow_metas(HEADER + f"0 !LDCAD {line}\n", path)[0])


class ExactSquareClutchTests(unittest.TestCase):
    def test_square_s6_is_excluded_by_default_and_needs_a_literal_boolean_opt_in(self) -> None:
        snaps = snaps_for(EXACT_SQUARE_SOCKET)

        self.assertTrue(is_square_s6_clutch_socket(snaps[0]))
        self.assertEqual(emit_clutch_connectors(snaps), [])
        self.assertEqual(
            emit_clutch_connectors(snaps, allow_square_s6=True),
            [
                {
                    "kind": "undersideClutch",
                    "gender": "female",
                    "positionLdu": [0.0, 0.0, 0.0],
                    "normal": [0.0, 1.0, 0.0],
                }
            ],
        )
        with self.assertRaisesRegex(ValueError, "explicit boolean"):
            emit_clutch_connectors(snaps, allow_square_s6=1)  # type: ignore[arg-type]

    def test_only_the_exact_bounded_single_section_socket_shape_is_eligible(self) -> None:
        variants = (
            EXACT_SQUARE_SOCKET.replace("gender=F", "gender=M"),
            EXACT_SQUARE_SOCKET.replace("caps=one", "caps=none"),
            EXACT_SQUARE_SOCKET.replace("S 6 4", "R 6 4"),
            EXACT_SQUARE_SOCKET.replace("S 6 4", "S 5 4"),
            EXACT_SQUARE_SOCKET.replace("S 6 4", "S 6 3.999"),
            EXACT_SQUARE_SOCKET.replace("S 6 4", "S 6 4 R 4 8"),
            EXACT_SQUARE_SOCKET + " [slide=true]",
            EXACT_SQUARE_SOCKET + " [center=true]",
            EXACT_SQUARE_SOCKET + " [id=clutch]",
            EXACT_SQUARE_SOCKET + " [group=mechanism]",
            EXACT_SQUARE_SOCKET + " [scale=YOnly]",
            EXACT_SQUARE_SOCKET + " [mirror=cor]",
        )

        for line in variants:
            with self.subTest(line=line):
                snaps = snaps_for(line)
                self.assertTrue(all(not is_square_s6_clutch_socket(snap) for snap in snaps))
                self.assertEqual(
                    emit_clutch_connectors(snaps, allow_square_s6=True),
                    emit_clutch_connectors(snaps),
                )

    def test_grid_expansion_and_composed_position_and_normal_frames_are_exact(self) -> None:
        snaps = snaps_for(EXACT_SQUARE_SOCKET + " [pos=0 8 0] [grid=C 2 1 20 0]")
        matrix = (
            Fraction(0),
            Fraction(1),
            Fraction(0),
            Fraction(0),
            Fraction(0),
            Fraction(1),
            Fraction(1),
            Fraction(0),
            Fraction(0),
        )
        translation = (Fraction(1), Fraction(2), Fraction(3))

        emitted = emit_clutch_connectors(
            [snap.transformed(matrix, translation) for snap in snaps],
            allow_square_s6=True,
        )

        self.assertEqual([snap.grid_count for snap in snaps], [2, 2])
        self.assertEqual(
            [(row["positionLdu"], row["normal"]) for row in emitted],
            [([9.0, 2.0, -7.0], [1.0, 0.0, 0.0]), ([9.0, 2.0, 13.0], [1.0, 0.0, 0.0])],
        )


@unittest.skipUnless(
    PINNED_OFFICIAL.is_file()
    and PINNED_UNOFFICIAL.is_file()
    and PINNED_SHADOW.is_dir()
    and PINNED_NATIVE_PACK.is_file(),
    "pinned LDraw, LDCad, or Builder control input is absent",
)
class PinnedBuilderSquareClutchControlTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        paths = {"official": PINNED_OFFICIAL, "unofficial": PINNED_UNOFFICIAL}
        cls.library = LDrawSourceLibrary(
            [VerifiedArchive(paths[pin.archive_id], pin) for pin in ARCHIVE_PINS]
        )
        try:
            cls.shadow = VerifiedShadowLibrary(PINNED_SHADOW)
            payload = PINNED_NATIVE_PACK.resolve(strict=True).read_bytes()
            if (
                len(payload) != NATIVE_PACK_BYTES
                or hashlib.sha256(payload).hexdigest() != NATIVE_PACK_SHA256
            ):
                raise ValueError(
                    "Builder square-clutch control pack does not match its byte and digest pins."
                )
            cls.builder_records, _, _ = validate_native_pack(json.loads(payload.decode("utf-8")))
        except Exception:
            cls.library.close()
            raise

    @classmethod
    def tearDownClass(cls) -> None:
        cls.library.close()

    def assert_clutches_have_source_room(
        self, design_id: str, root: tuple[str, str], rows: list[dict[str, object]]
    ) -> None:
        expanded = expand_surface(
            self.library,
            root,
            role_classifier(lambda key: self.library.record(key).sha256),
        )
        candidate = Candidate(
            design_id=design_id,
            derivation="independent square-clutch control",
            bodies=(),
            connectors=tuple(
                Connector(
                    index=index,
                    kind="undersideClutch",
                    gender="female",
                    position=tuple(row["positionLdu"]),  # type: ignore[arg-type]
                    normal=tuple(row["normal"]),  # type: ignore[arg-type]
                )
                for index, row in enumerate(rows)
            ),
        )
        room = measure_clutch_room(candidate, [triangle.points for triangle in expanded])
        self.assertEqual(room["declaredClutches"], len(rows))
        self.assertEqual(room["clutchesWithRoom"], len(rows))

    def test_five_exact_root_routes_emit_only_their_opted_in_square_clutches(self) -> None:
        expectations = {
            "99563": {
                "files": ["parts/96910.dat"],
                "rows": [([-10.0, 8.0, 0.0], [0.0, 1.0, 0.0]), ([0.0, 8.0, 0.0], [0.0, 1.0, 0.0]), ([10.0, 8.0, 0.0], [0.0, 1.0, 0.0])],
                "lengths": ["5", "5", "5"],
            },
            "73230": {
                "files": ["p/axlehol4.dat", "p/stud2.dat", "parts/73230.dat"],
                "rows": [([0.0, 24.0, 0.0], [0.0, 1.0, 0.0])],
                "lengths": ["8"],
            },
            "35464": {
                "files": ["parts/35464.dat"],
                "rows": [([0.0, 0.0, 0.0], [0.0, 1.0, 0.0])],
                "lengths": ["5"],
            },
            "49307": {
                "files": ["parts/49307.dat"],
                "rows": [([0.0, 0.0, 0.0], [0.0, 1.0, 0.0])],
                "lengths": ["6"],
            },
            "2453b": {
                "files": ["p/stud.dat", "parts/2453b.dat"],
                "rows": [([0.0, 120.0, 0.0], [0.0, 1.0, 0.0])],
                "lengths": ["116"],
            },
        }
        for design_id, expected in expectations.items():
            with self.subTest(design_id=design_id):
                root = self.library.exact("official", f"parts/{design_id}.dat")
                composition = compose_part_snaps(self.library, self.shadow, root)
                square_snaps = [
                    snap for snap in composition.snaps if is_square_s6_clutch_socket(snap)
                ]
                rows = emit_clutch_connectors(composition.snaps, allow_square_s6=True)

                self.assertEqual(composition.shadow_files_used, expected["files"])
                self.assertEqual(emit_clutch_connectors(composition.snaps), [])
                self.assertEqual(
                    [(row["positionLdu"], row["normal"]) for row in rows], expected["rows"]
                )
                self.assertEqual(
                    [str(snap.sections[0].length) for snap in square_snaps],
                    expected["lengths"],
                )
                self.assert_clutches_have_source_room(design_id, root, rows)

    def test_3245c_keeps_inherited_square_rows_non_authoritative(self) -> None:
        root = self.library.exact("official", "parts/3245c.dat")
        composition = compose_part_snaps(self.library, self.shadow, root)
        square_snaps = [snap for snap in composition.snaps if is_square_s6_clutch_socket(snap)]
        rows = emit_clutch_connectors(composition.snaps)

        self.assertEqual(
            composition.shadow_files_used,
            ["p/stud.dat", "parts/3245a.dat", "parts/3245c.dat", "parts/s/3245cs01.dat"],
        )
        self.assertEqual(len(square_snaps), 2)
        self.assertEqual(
            [(row["positionLdu"], row["normal"]) for row in rows],
            [
                ([-10.0, 48.0, 0.0], [0.0, 1.0, 0.0]),
                ([0.0, 48.0, 0.0], [0.0, 1.0, 0.0]),
                ([10.0, 48.0, 0.0], [0.0, 1.0, 0.0]),
            ],
        )
        self.assert_clutches_have_source_room("3245c", root, rows)

    def test_square_interpretation_matches_three_independent_builder_frames_and_geometry(self) -> None:
        expectations = {
            "2877": {"count": 2, "lengths": ["20", "20"], "grids": [2, 2]},
            "3040": {"count": 2, "lengths": ["20", "4"], "grids": [1, 1]},
            "15254": {"count": 2, "lengths": ["44", "44"], "grids": [2, 2]},
        }
        for design_id, expected in expectations.items():
            with self.subTest(design_id=design_id):
                frame = PINNED_FRAMES[design_id]
                check_pinned_digest(frame)
                builder = [
                    row
                    for row in emit_connectors(
                        builder_field_nodes(self.builder_records[design_id]), frame
                    )
                    if row["kind"] == "undersideClutch"
                ]
                root = self.library.exact("official", f"parts/{design_id}.dat")
                composition = compose_part_snaps(self.library, self.shadow, root)
                square_snaps = [
                    snap for snap in composition.snaps if is_square_s6_clutch_socket(snap)
                ]
                ldcad = emit_clutch_connectors(composition.snaps, allow_square_s6=True)

                self.assertEqual(emit_clutch_connectors(composition.snaps), [])
                self.assertEqual(ldcad, builder)
                self.assertEqual(len(ldcad), expected["count"])
                self.assertEqual([str(snap.sections[0].length) for snap in square_snaps], expected["lengths"])
                self.assertEqual([snap.grid_count for snap in square_snaps], expected["grids"])

                self.assert_clutches_have_source_room(design_id, root, ldcad)


if __name__ == "__main__":
    unittest.main(verbosity=2)
