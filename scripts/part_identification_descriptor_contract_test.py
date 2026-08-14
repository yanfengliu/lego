"""Hostile-value diagnostics for the Python descriptor preflight."""

from __future__ import annotations

import copy
import unittest

from part_identification_descriptor_contract import require_descriptor
from part_identification_report_io import ArtifactContractError


def descriptor() -> dict:
    return {
        "aspect": 1.0,
        "boxHeight": 28,
        "boxWidth": 28,
        "colours": [{"rgb": [0, 0, 0], "share": 1.0}],
        "detail": [0] * (28 * 28),
        "grid": [0] * (28 * 28),
        "ink": 1.0,
        "lightFace": 0,
        "mean": [0, 0, 0],
        "pixels": 28 * 28,
    }


class DescriptorDiagnosticTests(unittest.TestCase):
    def message_for(self, value: object) -> str:
        with self.assertRaises(ArtifactContractError) as raised:
            require_descriptor(value, "Features/3 callout 7 descriptor")
        return str(raised.exception)

    def test_invalid_grid_cell_names_path_value_and_recovery(self) -> None:
        value = descriptor()
        value["grid"][37] = 256
        message = self.message_for(value)
        self.assertIn("descriptor.grid[37]", message)
        self.assertIn("received 256", message)
        self.assertIn("Regenerate this descriptor", message)

    def test_large_wrong_type_is_bounded_without_losing_size(self) -> None:
        value = descriptor()
        value["mean"] = "x" * (1024 * 1024)
        message = self.message_for(value)
        self.assertIn("descriptor.mean", message)
        self.assertIn("string length 1048576", message)
        self.assertLess(len(message), 768)

    def test_invalid_colour_channel_names_nested_index(self) -> None:
        value = copy.deepcopy(descriptor())
        value["colours"][0]["rgb"][2] = float("inf")
        message = self.message_for(value)
        self.assertIn("descriptor.colours[0].rgb[2]", message)
        self.assertIn("received inf", message)


if __name__ == "__main__":
    unittest.main()
