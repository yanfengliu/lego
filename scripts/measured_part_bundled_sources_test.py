"""Append-only bundled-source emission tests for measured catalog parts."""

from __future__ import annotations

import unittest

from measured_part_bundled_sources import bundled_file_table, render_bundled_sources
from measured_part_plan import BUNDLED_LDRAW_ARCHIVE_RECORD
from measured_part_test_support import measured, plan, record


class BundledSourceEmissionTests(unittest.TestCase):
    def test_the_bundled_file_table_deduplicates_and_indexes_by_path(self) -> None:
        shared = record("p/stud.dat", "sha256:22")
        first = measured(closure=(record("parts/a.dat", "sha256:aa"), shared))
        second = measured(
            plan=plan(design_id="other"), closure=(record("parts/b.dat", "sha256:bb"), shared)
        )

        files, closures = bundled_file_table([first, second])

        self.assertEqual([row.path for row in files], ["p/stud.dat", "parts/a.dat", "parts/b.dat"])
        self.assertEqual(closures, {"unit": [0, 1], "other": [0, 2]})

    def test_the_bundled_file_table_preserves_a_historical_prefix_and_appends(self) -> None:
        shared = record("p/stud.dat", "sha256:22")
        first = measured(closure=(record("parts/a.dat", "sha256:aa"), shared))
        second = measured(
            plan=plan(design_id="other"), closure=(record("parts/b.dat", "sha256:bb"), shared)
        )

        files, closures = bundled_file_table(
            [first, second], ["parts/a.dat", "p/stud.dat"]
        )

        self.assertEqual(
            [row.path for row in files],
            ["parts/a.dat", "p/stud.dat", "parts/b.dat"],
        )
        self.assertEqual(closures, {"unit": [0, 1], "other": [1, 2]})

    def test_the_bundled_file_table_refuses_to_drop_a_preserved_path(self) -> None:
        with self.assertRaisesRegex(ValueError, "no longer contains preserved"):
            bundled_file_table([measured()], ["parts/missing.dat"])

    def test_one_path_carrying_two_different_files_is_refused_by_name(self) -> None:
        first = measured(closure=(record("p/stud.dat", "sha256:22"),))
        second = measured(
            plan=plan(design_id="other"), closure=(record("p/stud.dat", "sha256:33"),)
        )

        with self.assertRaises(ValueError) as caught:
            bundled_file_table([first, second])

        self.assertIn("p/stud.dat", str(caught.exception))
        self.assertIn("sha256:33", str(caught.exception))

    def test_the_attribution_table_carries_every_file_and_the_pinned_archive(self) -> None:
        rendered = render_bundled_sources(
            [measured()], BUNDLED_LDRAW_ARCHIVE_RECORD, preserved_path_prefix=()
        )

        self.assertIn('path: "p/stud.dat"', rendered)
        self.assertIn('author: "Unit Author"', rendered)
        self.assertIn('licenseExpression: "CC-BY-4.0"', rendered)
        self.assertIn('version: "ldraw-complete-2026-07"', rendered)
        self.assertIn("bytes: 144722356", rendered)


if __name__ == "__main__":
    unittest.main(verbosity=2)
