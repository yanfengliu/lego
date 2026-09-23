import {
  applyBuildOperations,
  canonicalDigest,
  createEmptyBrickDocument,
  deepFreeze,
  validateBrickDocument,
} from "@lego-studio/brick-kernel";
import type { BrickDocumentV1, RigidTransform } from "@lego-studio/protocol";

import { enumeratePlacements } from "../src/assembly/enumerate-placements";
import { prefix50TemporaryOperations } from "./real-build-prefix50-temporary-placement";
import {
  REAL_BUILD_PREFIX50_STEP42_CANONICAL_ORIENTATION as CANONICAL,
  REAL_BUILD_PREFIX50_STEP42_RAW_ORIENTATION as RAW_ORIENTATION,
  type RealBuildPrefix50Step42WindowRow,
} from "./real-build-prefix50-step42-source-repair-contract";

const row = (
  ordinal: number,
  printedStepNumber: number,
  catalogPartId: string,
  colorId: string,
  positionLdu: [number, number, number],
  orientationId: string,
): RealBuildPrefix50Step42WindowRow => ({
  ordinal,
  printedStepNumber,
  catalogPartId,
  colorId,
  sourceWorldTransform: { positionLdu, orientationId },
});

/** Exact cheap-control window. It is evidence input, never a placement authority. */
export const REAL_BUILD_PREFIX50_STEP42_PREFLIGHT_ROWS = deepFreeze([
  row(
    258,
    38,
    "builtin:plate-1x2-round-end",
    "builtin:medium-azure",
    [440, -98, -86],
    "proper-m-00nn000p0",
  ),
  row(259, 38, "builtin:plate-1x12", "builtin:black", [340, -98, -78], "proper-m-00nn000p0"),
  row(
    260,
    39,
    "builtin:plate-1x2-round-end",
    "builtin:medium-azure",
    [240, -98, -86],
    "proper-m-00nn000p0",
  ),
  row(
    261,
    39,
    "builtin:technic-brick-1x1-axle-hole",
    "builtin:dark-azure",
    [270, -98, -94],
    "proper-m-00nn000p0",
  ),
  row(
    262,
    39,
    "builtin:plate-1x2-round-end",
    "builtin:medium-azure",
    [380, -98, -86],
    "proper-m-00nn000p0",
  ),
  row(
    263,
    39,
    "builtin:plate-1x2-round-end",
    "builtin:medium-azure",
    [300, -98, -86],
    "proper-m-00nn000p0",
  ),
  row(
    264,
    39,
    "builtin:technic-brick-1x2-axle-hole",
    "builtin:medium-azure",
    [340, -98, -94],
    "proper-m-00pp000p0",
  ),
  row(
    265,
    39,
    "builtin:technic-brick-1x1-axle-hole",
    "builtin:dark-azure",
    [410, -98, -94],
    "proper-m-00nn000p0",
  ),
  row(
    266,
    40,
    "builtin:bracket-2x2-1x2-vertical-studs",
    "builtin:black",
    [240, -88, -104],
    "proper-m-p0000n0p0",
  ),
  row(
    267,
    40,
    "builtin:bracket-2x2-1x2-vertical-studs",
    "builtin:black",
    [440, -88, -104],
    "proper-m-p0000n0p0",
  ),
  row(
    268,
    40,
    "builtin:bracket-2x2-1x2-vertical-studs",
    "builtin:black",
    [380, -88, -104],
    "proper-m-p0000n0p0",
  ),
  row(
    269,
    40,
    "builtin:bracket-2x2-1x2-vertical-studs",
    "builtin:black",
    [300, -88, -104],
    "proper-m-p0000n0p0",
  ),
  row(270, 41, "builtin:plate-1x2-round-end", "builtin:medium-azure", [440, -80, -108], CANONICAL),
  row(271, 41, "builtin:plate-1x2-round-end", "builtin:medium-azure", [240, -80, -108], CANONICAL),
  row(272, 41, "builtin:plate-1x2-round-end", "builtin:medium-azure", [300, -80, -108], CANONICAL),
  row(273, 41, "builtin:plate-1x2-round-end", "builtin:medium-azure", [380, -80, -108], CANONICAL),
  row(274, 42, "builtin:tile-1x6", "builtin:black", [400, -98, -110], RAW_ORIENTATION),
]);

export function step42TemporaryOccurrence(rowValue: RealBuildPrefix50Step42WindowRow) {
  return {
    ordinal: rowValue.ordinal,
    colorId: rowValue.colorId,
    partIdentity: { reconciledCatalogPartId: rowValue.catalogPartId },
  };
}

function sameTransform(left: RigidTransform, right: RigidTransform): boolean {
  return (
    left.orientationId === right.orientationId &&
    left.positionLdu.every((coordinate, axis) => coordinate === right.positionLdu[axis])
  );
}

function addRoot(document: BrickDocumentV1, rowValue: RealBuildPrefix50Step42WindowRow) {
  return applyBuildOperations(
    document,
    prefix50TemporaryOperations(document, step42TemporaryOccurrence(rowValue), {
      catalogPartId: rowValue.catalogPartId,
      transform: rowValue.sourceWorldTransform,
      connections: [],
      restsOnBuildPlate: false,
    }),
  );
}

function placeRows(
  document: BrickDocumentV1,
  remaining: readonly RealBuildPrefix50Step42WindowRow[],
): BrickDocumentV1 | null {
  if (remaining.length === 0) return document;
  for (const [index, rowValue] of remaining.entries()) {
    const enumeration = enumeratePlacements(document, rowValue.catalogPartId, {
      orientationIds: [rowValue.sourceWorldTransform.orientationId],
      includeBuildPlate: false,
      allowDetached: false,
      maxDistinctTransforms: 200_000,
    });
    const candidate = enumeration.candidates.find(({ transform }) =>
      sameTransform(transform, rowValue.sourceWorldTransform),
    );
    if (candidate === undefined) continue;
    const next = applyBuildOperations(
      document,
      prefix50TemporaryOperations(document, step42TemporaryOccurrence(rowValue), candidate),
    );
    const result = placeRows(next, [...remaining.slice(0, index), ...remaining.slice(index + 1)]);
    if (result !== null) return result;
  }
  return null;
}

export function buildExactRealBuildPrefix50Step42Child(
  rows: readonly RealBuildPrefix50Step42WindowRow[],
): BrickDocumentV1 {
  if (canonicalDigest(rows) !== canonicalDigest(REAL_BUILD_PREFIX50_STEP42_PREFLIGHT_ROWS)) {
    throw new TypeError(
      "Step-42 preflight requires exact repaired-child rows 258..273 plus raw row 274.",
    );
  }
  let document = addRoot(
    createEmptyBrickDocument({ id: "step42-preflight", name: "Step 42 preflight" }),
    rows[0]!,
  );
  for (const step of [38, 39, 40, 41]) {
    const placed = placeRows(
      document,
      rows.filter(
        ({ printedStepNumber, ordinal }) => printedStepNumber === step && ordinal !== 258,
      ),
    );
    if (placed === null)
      throw new TypeError(`Step-42 preflight could not reconstruct child step ${step}.`);
    document = placed;
  }
  const blockers = validateBrickDocument(document).issues.filter(
    ({ severity }) => severity === "blocking",
  );
  if (document.parts.length !== 16 || document.connections.length !== 28 || blockers.length !== 0) {
    throw new TypeError(
      `Step-42 preflight control child must be hard-valid at 16 parts/28 edges; found ${document.parts.length}/${document.connections.length}/${blockers.length}.`,
    );
  }
  return document;
}
