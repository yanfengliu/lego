"""Hostile-input tests for Python part-identification report readers."""

from __future__ import annotations

import os
import stat
import subprocess
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

import part_identification_report_io as report_io
from part_identification_verification_process import _cleanup_process

from part_identification_report_contract import (
    ArtifactContractError,
    read_bounded_bytes,
    read_json_artifact,
)


def stat_snapshot(
    *, size: int, inode: int = 7, mtime_ns: int = 100, ctime_ns: int = 200
) -> SimpleNamespace:
    return SimpleNamespace(
        st_mode=stat.S_IFREG,
        st_size=size,
        st_dev=11,
        st_ino=inode,
        st_mtime_ns=mtime_ns,
        st_ctime_ns=ctime_ns,
        st_file_attributes=0,
    )


class ReportInputBoundsTests(unittest.TestCase):
    def test_verifier_cleanup_joins_collectors_when_kill_and_wait_fail(self) -> None:
        class FailedProcess:
            def poll(self):
                return None

            def kill(self):
                raise OSError("simulated kill failure")

            def wait(self, timeout):
                raise subprocess.TimeoutExpired("node", timeout)

        class Collector:
            joined = False

            def join(self, timeout):
                self.joined = True

        collector = Collector()
        timed_out, cleanup_failed = _cleanup_process(FailedProcess(), [collector])
        self.assertTrue(timed_out)
        self.assertTrue(cleanup_failed)
        self.assertTrue(collector.joined)

    def test_a_file_over_its_declared_byte_ceiling_is_refused_before_read(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "large.json"
            path.write_bytes(b"{}")
            with patch.object(Path, "open", side_effect=AssertionError("must not open")) as opener:
                with self.assertRaisesRegex(ArtifactContractError, "input ceiling is 1"):
                    read_bounded_bytes(path, "Synthetic report input", max_bytes=1)
            opener.assert_not_called()

    def test_nonfinite_json_numbers_are_refused_at_the_reader_boundary(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "nonfinite.json"
            for token in ("NaN", "1e9999", "-1e9999"):
                with self.subTest(token=token):
                    path.write_text(f'{{"distance": {token}}}', encoding="utf-8")
                    with self.assertRaisesRegex(
                        ArtifactContractError, rf"non-finite JSON number {token}"
                    ):
                        read_json_artifact(path, "Synthetic report input")

    def test_finite_exponent_json_numbers_are_preserved(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "finite.json"
            path.write_text('{"negative":-1.25e3,"positive":1.25e3}', encoding="utf-8")
            value, _ = read_json_artifact(path, "Synthetic report input")
        self.assertEqual(value, {"negative": -1250.0, "positive": 1250.0})

    def test_duplicate_schema_and_digest_keys_are_refused(self) -> None:
        cases = (
            '{"schemaVersion":"one","schemaVersion":"two"}',
            '{"inputDigests":{"match":"one","match":"two"}}',
        )
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "duplicate.json"
            for value in cases:
                with self.subTest(value=value):
                    path.write_text(value, encoding="utf-8")
                    with self.assertRaisesRegex(ArtifactContractError, "duplicate JSON object key"):
                        read_json_artifact(path, "Synthetic report input")

    def test_duplicate_key_diagnostic_is_bounded(self) -> None:
        key = "x" * 1_000_000
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "duplicate-large-key.json"
            path.write_text(f'{{"{key}":1,"{key}":2}}', encoding="utf-8")
            with self.assertRaises(ArtifactContractError) as raised:
                read_json_artifact(path, "Synthetic report input")
        self.assertLess(len(str(raised.exception)), 512)
        self.assertIn("string length 1000000", str(raised.exception))

    def test_json_must_be_plain_utf8_without_a_byte_order_mark(self) -> None:
        cases = (b"\xef\xbb\xbf{}", "{}".encode("utf-16"))
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "encoded.json"
            for value in cases:
                with self.subTest(value=value):
                    path.write_bytes(value)
                    with self.assertRaisesRegex(ArtifactContractError, "finite UTF-8 JSON"):
                        read_json_artifact(path, "Synthetic report input")

    def test_json_depth_value_and_container_ceilings_are_enforced(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "bounded.json"
            cases = (
                ("[[[[0]]]]", {"max_depth": 3}, "depth ceiling"),
                ("[0,1,2]", {"max_values": 2}, "value JSON ceiling"),
                ("[[],[]]", {"max_containers": 2}, "container JSON ceiling"),
            )
            for value, limits, error in cases:
                with self.subTest(error=error):
                    path.write_text(value, encoding="utf-8")
                    with patch.object(
                        report_io.json,
                        "loads",
                        side_effect=AssertionError("bounded input reached json.loads"),
                    ) as loader:
                        with self.assertRaisesRegex(ArtifactContractError, error):
                            read_json_artifact(path, "Synthetic report input", **limits)
                    loader.assert_not_called()

    def test_string_and_number_token_ceilings_run_before_json_loads(self) -> None:
        cases = (
            (
                b'{"v":"abcd"}',
                {"max_string_bytes": 3},
                "JSON string at byte 5 is 4 encoded bytes; the per-string ceiling is 3",
            ),
            (
                b'["abc","def"]',
                {"max_total_string_bytes": 5},
                "JSON strings total 6 encoded bytes.*aggregate string ceiling is 5",
            ),
            (
                b'{"v":1234}',
                {"max_number_bytes": 3},
                "JSON number at byte 5 is 4 bytes; the number ceiling is 3",
            ),
        )
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "oversized-token.json"
            for data, limits, expected in cases:
                with self.subTest(expected=expected):
                    path.write_bytes(data)
                    with patch.object(
                        report_io.json,
                        "loads",
                        side_effect=AssertionError("oversized token reached json.loads"),
                    ) as loader:
                        with self.assertRaisesRegex(ArtifactContractError, expected):
                            read_json_artifact(path, "Synthetic report input", **limits)
                    loader.assert_not_called()

    def test_same_inode_growth_shrink_and_rewrite_are_refused_by_descriptor_state(self) -> None:
        mutations = (
            (
                stat_snapshot(size=2),
                stat_snapshot(size=3, mtime_ns=101, ctime_ns=201),
                "ctimeNs 200 -> 201.*mtimeNs 100 -> 101.*size 2 -> 3",
            ),
            (
                stat_snapshot(size=3),
                stat_snapshot(size=2, mtime_ns=101, ctime_ns=201),
                "ctimeNs 200 -> 201.*mtimeNs 100 -> 101.*size 3 -> 2",
            ),
            (
                stat_snapshot(size=2),
                stat_snapshot(size=2, mtime_ns=101, ctime_ns=201),
                "ctimeNs 200 -> 201.*mtimeNs 100 -> 101",
            ),
        )
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "mutating.json"
            path.write_bytes(b"{}")
            for opened_before, opened_after, expected in mutations:
                with self.subTest(expected=expected):
                    inspected = stat_snapshot(size=opened_before.st_size)
                    with (
                        patch.object(Path, "lstat", return_value=inspected),
                        patch.object(
                            report_io.os,
                            "fstat",
                            side_effect=(opened_before, opened_after),
                        ),
                    ):
                        with self.assertRaisesRegex(
                            ArtifactContractError,
                            "Synthetic report input.*changed same-inode descriptor state.*"
                            + expected,
                        ):
                            read_bounded_bytes(path, "Synthetic report input")

    def test_descriptor_size_must_equal_the_exact_bytes_read(self) -> None:
        snapshot = stat_snapshot(size=3)
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "short-read.json"
            path.write_bytes(b"{}")
            with (
                patch.object(Path, "lstat", return_value=snapshot),
                patch.object(report_io.os, "fstat", side_effect=(snapshot, snapshot)),
            ):
                with self.assertRaisesRegex(
                    ArtifactContractError,
                    "descriptor declared 3 bytes before and 3 bytes after.*exactly 2 bytes were read",
                ):
                    read_bounded_bytes(path, "Synthetic report input")

    def test_same_inode_path_rewrite_after_descriptor_read_is_refused(self) -> None:
        before = stat_snapshot(size=2)
        path_after = stat_snapshot(size=2, mtime_ns=101, ctime_ns=201)
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "late-rewrite.json"
            path.write_bytes(b"{}")
            with (
                patch.object(Path, "lstat", side_effect=(before, path_after)),
                patch.object(report_io.os, "fstat", side_effect=(before, before)),
            ):
                with self.assertRaisesRegex(
                    ArtifactContractError,
                    "changed path state after the descriptor read.*ctimeNs 200 -> 201.*"
                    "mtimeNs 100 -> 101",
                ):
                    read_bounded_bytes(path, "Synthetic report input")

    def test_path_replacement_after_descriptor_read_is_refused(self) -> None:
        before = stat_snapshot(size=2)
        replacement = stat_snapshot(size=2, inode=8)
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "late-replacement.json"
            path.write_bytes(b"{}")
            with (
                patch.object(Path, "lstat", side_effect=(before, replacement)),
                patch.object(report_io.os, "fstat", side_effect=(before, before)),
            ):
                with self.assertRaisesRegex(
                    ArtifactContractError, "changed path identity after the descriptor read"
                ):
                    read_bounded_bytes(path, "Synthetic report input")

    def test_retrieval_inputs_name_every_action_ledger_digest_role(self) -> None:
        self.assertEqual(
            {
                role: report_io.RETRIEVAL_REPORT_INPUTS[role]
                for role in (
                    "coverage",
                    "builderCalibration",
                    "transitionClassifications",
                )
            },
            {
                "coverage": "output/real-build/catalog-coverage.json",
                "builderCalibration": "output/real-build/builder-canonical-calibration.json",
                "transitionClassifications": "output/real-build/transition-classifications.json",
            },
        )

    def test_card_bundle_reader_uses_the_authoritative_192_mib_ceiling(self) -> None:
        run_id = "a" * 24
        cards = {"runId": run_id, "imagesFile": f"runs/{run_id}/images.bin"}
        root = Path("cards")
        expected = root / "runs" / run_id / "images.bin"
        with patch.object(report_io, "read_bounded_bytes", return_value=b"bundle") as reader:
            path, _ = report_io.read_card_images_artifact(root, cards)
        self.assertEqual(path, expected)
        reader.assert_called_once_with(
            expected,
            "Part-identification card-image bundle",
            max_bytes=report_io.MAX_CARD_IMAGE_BUNDLE_BYTES,
        )
        self.assertEqual(report_io.MAX_CARD_IMAGE_BUNDLE_BYTES, 192 * 1024 * 1024)

    def test_symlink_inputs_are_refused_where_the_platform_supports_them(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            target = root / "target.json"
            link = root / "link.json"
            target.write_text("{}", encoding="utf-8")
            try:
                os.symlink(target, link)
            except OSError as error:
                self.skipTest(f"symlink creation unavailable: {error}")
            with self.assertRaisesRegex(ArtifactContractError, "not a link"):
                read_json_artifact(link, "Synthetic report input")

    def test_zero_inspected_device_does_not_reject_the_same_positive_inode(self) -> None:
        inspected = SimpleNamespace(
            st_mode=stat.S_IFREG,
            st_size=2,
            st_dev=0,
            st_ino=7,
            st_file_attributes=0,
        )
        opened = SimpleNamespace(st_dev=99, st_ino=7)
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "same.json"
            path.write_bytes(b"{}")
            with (
                patch.object(Path, "lstat", return_value=inspected),
                patch.object(report_io.os, "fstat", side_effect=(opened, opened)),
            ):
                self.assertEqual(read_bounded_bytes(path, "Synthetic report input"), b"{}")

    def test_mismatched_open_inode_is_refused(self) -> None:
        inspected = SimpleNamespace(
            st_mode=stat.S_IFREG,
            st_size=2,
            st_dev=0,
            st_ino=7,
            st_file_attributes=0,
        )
        opened = SimpleNamespace(st_dev=99, st_ino=8)
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "replaced.json"
            path.write_bytes(b"{}")
            with (
                patch.object(Path, "lstat", return_value=inspected),
                patch.object(report_io.os, "fstat", return_value=opened),
            ):
                with self.assertRaisesRegex(ArtifactContractError, "changed identity"):
                    read_bounded_bytes(path, "Synthetic report input")


if __name__ == "__main__":
    unittest.main()
