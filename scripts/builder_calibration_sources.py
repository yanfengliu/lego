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
from builder_calibration_source_pins_g import DESIGNS_G
from builder_calibration_ldraw_pins_a import LDRAW_CLOSURE_FILES_A
from builder_calibration_ldraw_pins_b import LDRAW_CLOSURE_FILES_B
from builder_calibration_ldraw_pins_c import LDRAW_CLOSURE_FILES_C
from builder_calibration_ldraw_pins_d import LDRAW_CLOSURE_FILES_D

LDRAW_CLOSURE_DIGEST = 'ffe99f465ae9e045d649750d9290043fd6947e5d740d6576980da42fc365fb63'
LDRAW_CLOSURE_FILES = (*LDRAW_CLOSURE_FILES_A, *LDRAW_CLOSURE_FILES_B, *LDRAW_CLOSURE_FILES_C, *LDRAW_CLOSURE_FILES_D,)
DESIGNS = (*DESIGNS_A, *DESIGNS_B, *DESIGNS_C, *DESIGNS_D, *DESIGNS_E, *DESIGNS_F, *DESIGNS_G,)
GEOMETRY_BUNDLE_BYTES = 1834092
GEOMETRY_BUNDLE_SHA256 = 'c047a4b78518ae658a34efd3f3121de11558d00821b1764a472b87cf0ee82b97'
