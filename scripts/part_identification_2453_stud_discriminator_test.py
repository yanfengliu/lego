from __future__ import annotations

import unittest
from pathlib import Path

from PIL import Image

from part_identification_2453_stud_discriminator import (
    DEFAULT_OFFICIAL_ARCHIVE,
    REPOSITORY_ROOT,
    build_report,
    canonical_bytes,
    measure_rgba,
    sha256_prefixed,
)


LIVE_INPUTS = (
    DEFAULT_OFFICIAL_ARCHIVE,
    REPOSITORY_ROOT / "output/inventory-thumbnails/manifest.json",
    REPOSITORY_ROOT / "output/callout-thumbnails/manifest.json",
    REPOSITORY_ROOT / "output/part-identification/legacy-recut-semantic.json",
)


def synthetic_stud(kind: str, *, run_width: int = 19) -> Image.Image:
    background = (140, 148, 148, 255)
    image = Image.new("RGBA", (80, 70), background)
    pixels = image.load()
    center_x = 40
    top_y = 5
    run_left = center_x - run_width // 2
    for x in range(run_left, run_left + run_width):
        pixels[x, top_y] = (70, 70, 70, 255)
    center_radius = run_width // 4
    y_start = top_y + (run_width * 42 + 99) // 100
    y_end = top_y + (run_width * 79) // 100
    for y in range(y_start, y_end + 1):
        for x in range(center_x - run_width, center_x + run_width + 1):
            pixels[x, y] = (220, 220, 220, 255)
        center_color = (220, 220, 220, 255) if kind == "solid-stud" else (10, 10, 10, 255)
        for x in range(center_x - center_radius, center_x + center_radius + 1):
            pixels[x, y] = center_color
    return image


class FeatureBoundaryTests(unittest.TestCase):
    def test_classifies_only_well_supported_synthetic_solid_and_hollow_apertures(self) -> None:
        solid = measure_rgba(synthetic_stud("solid-stud"))
        hollow = measure_rgba(synthetic_stud("hollow-stud"))
        self.assertTrue(solid["observable"])
        self.assertEqual(solid["verdict"], "solid-stud")
        self.assertEqual(solid["ratio"], 1.0)
        self.assertEqual(solid["centerDarkShare"], 0.0)
        self.assertTrue(hollow["observable"])
        self.assertEqual(hollow["verdict"], "hollow-stud")
        self.assertAlmostEqual(hollow["ratio"], 10 / 220)
        self.assertEqual(hollow["centerDarkShare"], 1.0)

    def test_refuses_low_resolution_without_rounding_a_half_pixel_anchor(self) -> None:
        measurement = measure_rgba(synthetic_stud("solid-stud", run_width=8))
        self.assertFalse(measurement["observable"])
        self.assertEqual(measurement["verdict"], "not-observable")
        self.assertIn("top-run-below-visibility-floor", measurement["reasons"])
        self.assertIn("top-run-midpoint-is-not-integral", measurement["reasons"])
        self.assertIn("center-support-below-visibility-floor", measurement["reasons"])
        self.assertIsNone(measurement["centerMedianLuma"])
        self.assertIsNone(measurement["referenceP90Luma"])
        self.assertIsNone(measurement["ratio"])
        self.assertEqual(measurement["unqualifiedFeatureClass"], "ambiguous-feature-band")

    def test_refuses_nonuniform_crop_background(self) -> None:
        image = synthetic_stud("solid-stud")
        image.putpixel((image.width - 1, image.height - 1), (1, 2, 3, 255))
        measurement = measure_rgba(image)
        self.assertFalse(measurement["observable"])
        self.assertIn("nonuniform-or-nonopaque-background-corners", measurement["reasons"])


@unittest.skipUnless(all(path.is_file() for path in LIVE_INPUTS), "pinned local source art is absent")
class LivePinnedDiagnosticTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.report, cls.controls, cls.targets = build_report(include_targets=True)

    def test_controls_reproduce_the_frozen_pass_and_refusal_boundaries(self) -> None:
        gates = self.report["controlGates"]
        self.assertTrue(gates["calibration"]["passed"])
        self.assertFalse(gates["candidateOne"]["passed"])
        self.assertFalse(gates["candidateTwo"]["passed"])
        self.assertFalse(gates["targetsMayResolve"])
        self.assertEqual(
            gates["candidateOne"]["failures"],
            [
                "4211098 not observable",
                "6388133 not observable",
                "4255413 not observable",
            ],
        )
        self.assertEqual(
            gates["candidateTwo"]["failures"],
            [
                "614126 not observable",
                "6331225 not observable",
                "4210719 not observable",
                "6401023 not observable",
                "no observable correct held-out solid-stud control",
                "no observable correct held-out hollow-stud control",
            ],
        )
        expected = {
            "614101": (True, "solid-stud", 19, 237, 237, 1.0, 0.0),
            "6449593": (True, "hollow-stud", 19, 17, 192, 17 / 192, 1.0),
            "4211098": (False, "not-observable", 8, None, None, None, None),
            "6388133": (False, "not-observable", 8, None, None, None, None),
            "4255413": (False, "not-observable", 8, None, None, None, None),
            "614126": (False, "not-observable", 11, 45, 70, 45 / 70, 0.0),
            "6331225": (False, "not-observable", 16, None, None, None, None),
            "4210719": (False, "not-observable", 8, None, None, None, None),
            "6401023": (False, "not-observable", 8, None, None, None, None),
        }
        for row in self.report["controls"]:
            measurement = row["measurement"]
            observed = (
                measurement["observable"],
                measurement["verdict"],
                measurement["anchor"]["width"],
                measurement["centerMedianLuma"],
                measurement["referenceP90Luma"],
                measurement["ratio"],
                measurement["centerDarkShare"],
            )
            wanted = expected[row["elementId"]]
            self.assertEqual(observed[:5], wanted[:5], row["elementId"])
            if wanted[5] is None:
                self.assertIsNone(observed[5], row["elementId"])
                self.assertIsNone(observed[6], row["elementId"])
            else:
                self.assertAlmostEqual(observed[5], wanted[5], msg=row["elementId"])
                self.assertAlmostEqual(observed[6], wanted[6], msg=row["elementId"])

    def test_both_target_elements_refuse_without_suffix_or_downstream_authority(self) -> None:
        self.assertTrue(all(value is False for value in self.report["authority"].values()))
        self.assertEqual(
            [(row["elementId"], row["verdict"], row["reason"], row["suffix"]) for row in self.report["targets"]],
            [
                ("4210690", "not-observable", "calibration-controls-failed", None),
                ("6595205", "not-observable", "calibration-controls-failed", None),
            ],
        )
        expected = {
            ("4210690", "inventory"): (7, 72, 80, 0.9, 0.0),
            ("4210690", "callout"): (4, None, None, None, None),
            ("6595205", "inventory"): (8, None, None, None, None),
            ("6595205", "callout"): (3, 64, 120, 64 / 120, 0.0),
        }
        for target in self.report["targets"]:
            self.assertEqual(target["unqualifiedObservableClasses"], [])
            for view in target["views"]:
                measurement = view["measurement"]
                wanted = expected[(target["elementId"], view["source"]["kind"])]
                self.assertFalse(measurement["observable"])
                self.assertEqual(measurement["verdict"], "not-observable")
                self.assertEqual(
                    (
                        measurement["anchor"]["width"],
                        measurement["centerMedianLuma"],
                        measurement["referenceP90Luma"],
                    ),
                    wanted[:3],
                )
                if wanted[3] is None:
                    self.assertIsNone(measurement["ratio"])
                    self.assertIsNone(measurement["centerDarkShare"])
                else:
                    self.assertAlmostEqual(measurement["ratio"], wanted[3])
                    self.assertAlmostEqual(measurement["centerDarkShare"], wanted[4])

    def test_report_is_small_canonical_and_binds_both_official_candidate_geometries(self) -> None:
        data = canonical_bytes(self.report)
        self.assertLess(len(data), 256 * 1024)
        self.assertEqual(
            [(row["suffix"], row["kind"], row["expectedPrimitive"]) for row in self.report["candidateGeometry"]],
            [
                ("2453a", "hollow-stud", "p/stud2a.dat"),
                ("2453b", "solid-stud", "p/stud.dat"),
            ],
        )
        self.assertTrue(all(row["rootSha256"].startswith("sha256:") for row in self.report["candidateGeometry"]))
        self.assertEqual(len(self.targets), 4)
        self.assertEqual(len(self.controls), 9)
        self.assertEqual(sha256_prefixed(data), sha256_prefixed(canonical_bytes(self.report)))


if __name__ == "__main__":
    unittest.main()
