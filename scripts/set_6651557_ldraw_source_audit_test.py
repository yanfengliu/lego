from __future__ import annotations

import hashlib
import json
import tempfile
import unittest
import zipfile
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

from generate_set_6651557_ldraw_source_audit import (
    DEFAULT_SOURCE_AUDIT,
    audit_unresolved_route,
    build_source_audit,
    id_set_sha256,
    render_source_audit,
)
from ldraw_source_archive import (
    LDrawSourceLibrary,
    VerifiedArchive,
    canonical_bytes,
    reference_candidates,
)
from set_6651557_ldraw_source_audit_plan import (
    EXPECTED_AUDIT_COUNTS,
    REQUIRED_LEAF_IDS,
    REQUIRED_LEAF_SET_SHA256,
)


REPOSITORY_ROOT = Path(__file__).resolve().parent.parent
LIVE_OFFICIAL = Path(r"C:\tmp\ldraw-complete-2026-07.zip")
LIVE_UNOFFICIAL = Path(r"C:\tmp\ldraw-unofficial-2026-08-02.zip")


def part_text(
    name: str,
    *,
    title: str = "Synthetic Part",
    author: str | None = "Repository Test [test]",
    organization: str | None = "Part UPDATE 2026-01",
    license_line: str | None = "Licensed under CC BY 4.0 : see CAreadme.txt",
    body: str = "",
) -> str:
    lines = [f"0 {title}", f"0 Name: {name}"]
    if author is not None:
        lines.append(f"0 Author: {author}")
    if organization is not None:
        lines.append(f"0 !LDRAW_ORG {organization}")
    if license_line is not None:
        lines.append(f"0 !LICENSE {license_line}")
    lines.extend(["", "0 BFC CERTIFY CCW"])
    if body:
        lines.append(body)
    return "\n".join(lines) + "\n"


def write_archive(path: Path, entries: list[tuple[str, str]]) -> None:
    with zipfile.ZipFile(path, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        for name, contents in entries:
            archive.writestr(name, contents)


def archive_pin(path: Path, archive_id: str, *, sha256: str | None = None) -> object:
    with zipfile.ZipFile(path) as archive:
        entry_count = len(archive.infolist())
    return SimpleNamespace(
        archive_id=archive_id,
        byte_length=path.stat().st_size,
        sha256=sha256 or hashlib.sha256(path.read_bytes()).hexdigest(),
        entry_count=entry_count,
        max_entry_count=100,
    )


class ArchiveBoundaryTests(unittest.TestCase):
    def test_rejects_hash_drift_case_collisions_and_unsafe_members(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            ordinary = root / "ordinary.zip"
            write_archive(ordinary, [("ldraw/parts/1.dat", part_text("1.dat"))])
            with self.assertRaisesRegex(ValueError, "differs from pinned"):
                VerifiedArchive(ordinary, archive_pin(ordinary, "official", sha256="0" * 64))

            verified = VerifiedArchive(ordinary, archive_pin(ordinary, "official"))
            try:
                with ordinary.open("r+b") as stream:
                    stream.seek(10)
                    original = stream.read(1)
                    stream.seek(10)
                    stream.write(bytes([original[0] ^ 0x01]))
                with self.assertRaisesRegex(ValueError, "changed during traversal"):
                    verified.verify_unchanged()
            finally:
                verified.close()

            duplicate = root / "duplicate.zip"
            write_archive(
                duplicate,
                [
                    ("ldraw/parts/Foo.dat", part_text("Foo.dat")),
                    ("ldraw/parts/foo.dat", part_text("foo.dat")),
                ],
            )
            with self.assertRaisesRegex(ValueError, "repeats case-normalized entry"):
                VerifiedArchive(duplicate, archive_pin(duplicate, "official"))

            unsafe = root / "unsafe.zip"
            write_archive(unsafe, [("../escape.dat", part_text("escape.dat"))])
            with self.assertRaisesRegex(ValueError, "Unsafe LDraw archive member"):
                VerifiedArchive(unsafe, archive_pin(unsafe, "official"))

    def test_rejects_unsafe_references_before_resolution(self) -> None:
        for reference in (
            "../escape.dat",
            "/absolute.dat",
            "C:/drive.dat",
            "bad\0name.dat",
            "parts//double.dat",
            "parts/./dot.dat",
            "parts/caf\N{LATIN SMALL LETTER E WITH ACUTE}.dat",
        ):
            with self.subTest(reference=reference), self.assertRaisesRegex(
                ValueError, "Unsafe LDraw reference"
            ):
                reference_candidates(reference)


class ClosureAuditTests(unittest.TestCase):
    def open_library(
        self,
        root: Path,
        official_entries: list[tuple[str, str]],
        unofficial_entries: list[tuple[str, str]] | None = None,
    ) -> LDrawSourceLibrary:
        official = root / "official.zip"
        unofficial = root / "unofficial.zip"
        write_archive(official, official_entries)
        write_archive(
            unofficial,
            unofficial_entries or [("parts/placeholder.dat", part_text("placeholder.dat"))],
        )
        return LDrawSourceLibrary(
            [
                VerifiedArchive(official, archive_pin(official, "official")),
                VerifiedArchive(unofficial, archive_pin(unofficial, "unofficial")),
            ]
        )

    def test_enforces_official_and_unofficial_reference_layers(self) -> None:
        identity = "1 16 0 0 0 1 0 0 0 1 0 0 0 1 s\\1s01.dat"
        triangle = "3 16 0 0 0 1 0 0 0 1 0"
        with tempfile.TemporaryDirectory() as directory:
            library = self.open_library(
                Path(directory),
                [("ldraw/parts/1.dat", part_text("1.dat", body=identity))],
                [
                    (
                        "parts/s/1s01.dat",
                        part_text(
                            "s/1s01.dat",
                            organization="Unofficial_Subpart",
                            body=triangle,
                        ),
                    )
                ],
            )
            try:
                with self.assertRaisesRegex(FileNotFoundError, "not found in pinned archives"):
                    library.closure(library.exact("official", "parts/1.dat"))
            finally:
                library.close()

            library = self.open_library(
                Path(directory),
                [("ldraw/parts/s/1s01.dat", part_text("s/1s01.dat", body=triangle))],
                [
                    (
                        "parts/1.dat",
                        part_text("1.dat", organization="Unofficial_Part", body=identity),
                    )
                ],
            )
            try:
                records = library.closure(library.exact("unofficial", "parts/1.dat"))
            finally:
                library.close()
            self.assertEqual([(row.archive_id, row.path) for row in records], [
                ("official", "parts/s/1s01.dat"),
                ("unofficial", "parts/1.dat"),
            ])
            self.assertTrue(all(row.author == "Repository Test [test]" for row in records))
            self.assertTrue(all(row.license_expression == "CC-BY-4.0" for row in records))
            self.assertTrue(all(row.sha256.startswith("sha256:") for row in records))

    def test_rejects_recursion_malformed_transforms_and_missing_provenance(self) -> None:
        a_to_b = "1 16 0 0 0 1 0 0 0 1 0 0 0 1 b.dat"
        b_to_a = "1 16 0 0 0 1 0 0 0 1 0 0 0 1 a.dat"
        malformed = "1 16 0 0 0 1 0 0 nope 1 0 0 0 1 child.dat"
        with tempfile.TemporaryDirectory() as directory:
            library = self.open_library(
                Path(directory),
                [
                    ("ldraw/parts/a.dat", part_text("a.dat", body=a_to_b)),
                    ("ldraw/parts/b.dat", part_text("b.dat", body=b_to_a)),
                    ("ldraw/parts/bad.dat", part_text("bad.dat", body=malformed)),
                    (
                        "ldraw/parts/no-author.dat",
                        part_text("no-author.dat", author=None),
                    ),
                ],
            )
            try:
                with self.assertRaisesRegex(ValueError, "Recursive LDraw reference"):
                    library.closure(library.exact("official", "parts/a.dat"))
                with self.assertRaisesRegex(ValueError, "Malformed LDraw transform"):
                    library.closure(library.exact("official", "parts/bad.dat"))
                with self.assertRaisesRegex(ValueError, "needs exactly one 0 Author"):
                    library.record(library.exact("official", "parts/no-author.dat"))
            finally:
                library.close()

    def test_bounds_type_one_reference_work(self) -> None:
        reference = "1 16 0 0 0 1 0 0 0 1 0 0 0 1 child.dat"
        with tempfile.TemporaryDirectory() as directory:
            library = self.open_library(
                Path(directory),
                [
                    ("ldraw/parts/root.dat", part_text("root.dat", body=f"{reference}\n{reference}")),
                    ("ldraw/parts/child.dat", part_text("child.dat")),
                ],
            )
            try:
                with patch("ldraw_source_archive.MAX_REFERENCES_PER_FILE", 1):
                    with self.assertRaisesRegex(ValueError, "exceeds 1 type-1 references"):
                        library.closure(library.exact("official", "parts/root.dat"))
            finally:
                library.close()

    def test_unresolved_route_fails_closed_when_an_exact_root_appears(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            library = self.open_library(
                Path(directory),
                [("ldraw/parts/8172.dat", part_text("8172.dat"))],
            )
            try:
                with self.assertRaisesRegex(ValueError, "now has parts/8172.dat"):
                    audit_unresolved_route(
                        library,
                        {
                            "designId": "8172",
                            "exactPathsRequiredAbsent": ["parts/8172.dat"],
                            "reviewedCandidates": [],
                            "reason": "fixture",
                            "evidence": {},
                        },
                    )
            finally:
                library.close()


class GeneratedSourceAuditContractTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.data = DEFAULT_SOURCE_AUDIT.read_bytes()
        cls.document = json.loads(cls.data)
        cls.header = cls.document["header"]
        cls.parts = cls.document["parts"]
        cls.files = cls.document["files"]

    def test_is_small_canonical_and_covers_the_exact_121_leaf_set(self) -> None:
        self.assertLess(len(self.data), 256 * 1024)
        self.assertTrue(self.data.endswith(b"\n"))
        self.assertEqual(self.data, canonical_bytes(self.document) + b"\n")
        ids = [part["designId"] for part in self.parts]
        self.assertEqual(tuple(ids), REQUIRED_LEAF_IDS)
        self.assertEqual(len(set(ids)), 121)
        self.assertEqual(id_set_sha256(ids), REQUIRED_LEAF_SET_SHA256)
        self.assertEqual(self.header["summary"], EXPECTED_AUDIT_COUNTS)

    def test_keeps_exactly_four_routes_unresolved_and_every_frame_unclaimed(self) -> None:
        unresolved = [part for part in self.parts if part["state"] == "unresolved-source-route"]
        resolved = [
            part
            for part in self.parts
            if part["state"] == "ldraw-root-and-closure-resolved-not-admitted"
        ]
        self.assertEqual([part["designId"] for part in unresolved], ["3245", "7562", "8172", "89680"])
        self.assertEqual(len(resolved), 117)
        self.assertTrue(all(part["catalogAdmitted"] is False for part in self.parts))
        self.assertTrue(all(part["frame"]["catalogFrameClaimed"] is False for part in self.parts))
        self.assertTrue(all(part["rootFileId"].count(":") == 1 for part in resolved))
        self.assertEqual(len(self.files), 439)
        self.assertTrue(all(file["sha256"].startswith("sha256:") for file in self.files))

    def test_records_special_routes_without_exporting_catalog_truth(self) -> None:
        by_id = {part["designId"]: part for part in self.parts}
        self.assertEqual(by_id["3814"]["rootFileId"], "official:parts/973.dat")
        self.assertEqual(by_id["3814"]["identity"]["evidenceLine"], "0 !KEYWORDS Rebrickable 3814")
        for design_id in ("6801", "7236", "7302"):
            self.assertEqual(by_id[design_id]["rootFileId"], f"unofficial:parts/{design_id}.dat")
        forbidden = {"partDefinition", "geometry", "connectors", "collision"}

        def keys(value: object) -> set[str]:
            if isinstance(value, dict):
                return set(value) | set().union(*(keys(child) for child in value.values()))
            if isinstance(value, list):
                return set().union(*(keys(child) for child in value))
            return set()

        self.assertFalse(keys(self.document) & forbidden)
        public_index = (REPOSITORY_ROOT / "packages/catalog/src/index.ts").read_text(encoding="utf-8")
        self.assertNotIn("ldraw-source-audit", public_index)
        self.assertFalse(self.header["authority"]["partDefinitionsEmitted"])
        self.assertFalse(self.header["authority"]["publicCatalogExported"])
        self.assertFalse(self.header["authority"]["catalogAdmitted"])
        self.assertFalse(self.header["authority"]["runtimeExposed"])


@unittest.skipUnless(
    LIVE_OFFICIAL.is_file() and LIVE_UNOFFICIAL.is_file(),
    "pinned local LDraw archives are not present",
)
class LivePinnedArchiveRegressionTests(unittest.TestCase):
    def test_pinned_archives_reproduce_the_committed_source_audit_byte_for_byte(self) -> None:
        document = build_source_audit(LIVE_OFFICIAL, LIVE_UNOFFICIAL)
        self.assertEqual(render_source_audit(document), DEFAULT_SOURCE_AUDIT.read_bytes())


if __name__ == "__main__":
    unittest.main()
