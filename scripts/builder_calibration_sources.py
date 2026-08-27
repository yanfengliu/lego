"""Exact source pins for the proved Builder-frame registry.

The original fifteen geometry slices remain byte-for-byte at the front of the
bundle. Additive slices are pinned in reviewed byte-offset order, and the
LDraw records are the exact official transitive closure of all retained roots.
"""

from __future__ import annotations

from builder_calibration_source_pins_a import DESIGNS_A
from builder_calibration_source_pins_b import DESIGNS_B
from builder_calibration_source_pins_c import DESIGNS_C
from builder_calibration_source_pins_d import DESIGNS_D
from builder_calibration_source_pins_e import DESIGNS_E
from builder_calibration_source_pins_f import DESIGNS_F
from builder_calibration_ldraw_pins_a import LDRAW_CLOSURE_FILES_A
from builder_calibration_ldraw_pins_b import LDRAW_CLOSURE_FILES_B
from builder_calibration_ldraw_pins_c import LDRAW_CLOSURE_FILES_C

LDRAW_CLOSURE_DIGEST = '5f352e55531f0e2cab5fd4ddc0ce2b554e8ec9c24e7ac296359fa843abe8be6e'
LDRAW_CLOSURE_FILES = (*LDRAW_CLOSURE_FILES_A, *LDRAW_CLOSURE_FILES_B, *LDRAW_CLOSURE_FILES_C,)
DESIGNS = (*DESIGNS_A, *DESIGNS_B, *DESIGNS_C, *DESIGNS_D, *DESIGNS_E, *DESIGNS_F,)
GEOMETRY_BUNDLE_BYTES = 1814364
GEOMETRY_BUNDLE_SHA256 = 'd3636d02dca8a5bec1b1c759cd38cae705547cf0af9f57e6377325cb57d86d0f'
