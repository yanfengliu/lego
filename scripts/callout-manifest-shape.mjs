const OBSERVED_LEGACY_FAILURE_IDENTITIES_FIELD = "observedLegacyFailureIdentities";

export { OBSERVED_LEGACY_FAILURE_IDENTITIES_FIELD };

const TOP_LEVEL_KEYS = [
  "accounting",
  "calloutCount",
  "callouts",
  "conservation",
  "failures",
  "pageSelection",
  "pagesCropped",
  "recoveryBenchmark",
  "schemaVersion",
  "sourceHash",
];
const ACCOUNTING_KEYS = [
  "physicalPartArtIdentityCount",
  "physicalPartArtQuantityTotal",
  "rawNxIdentityCount",
  "rawNxQuantityTotal",
  "semanticIdentityCount",
  "semanticQuantityTotal",
];
const CONSERVATION_KEYS = [
  "expectedIdentityCount",
  "expectedIdentitySetSha256",
  "expectedRawNxQuantityTotal",
  "publishedIdentityCount",
  "publishedIdentitySetSha256",
  "publishedRawNxQuantityTotal",
];
const BENCHMARK_KEYS = [
  "fixedFailureClassSize",
  "fixtureSourceHash",
  OBSERVED_LEGACY_FAILURE_IDENTITIES_FIELD,
  "schemaVersion",
  "scores",
  "selected",
  "winner",
  "winningMargin",
];
const SCORE_KEYS = [
  "invalidIdentities",
  "kindCorrect",
  "masksCorrect",
  "points",
  "recovered",
  "regionCorrect",
  "strategy",
  "uncontaminated",
  "valid",
];
const CALLOUT_KEYS = [
  "boundaryClearancePx",
  "box",
  "boxMethod",
  "byteLength",
  "contamination",
  "cropRectPx",
  "cropStrategy",
  "evidenceKind",
  "file",
  "foregroundPixels",
  "heightPt",
  "heightPx",
  "identity",
  "masksApplied",
  "pageNumber",
  "quantity",
  "quantityGlyphOverlapPixels",
  "quantityGlyphPixelsMasked",
  "regionKind",
  "sha256",
  "sourceComponent",
  "sourceQuantityGlyphPixels",
  "sourceTextGlyphPixels",
  "stepNumber",
  "textGlyphOverlapPixels",
  "widthPx",
  "xPt",
  "yPt",
];
const BOX_KEYS = ["maxXPt", "maxYPt", "minXPt", "minYPt"];
const PIXEL_KEYS = ["bottom", "left", "right", "top"];
const COMPONENT_KEYS = [
  "absoluteForegroundSha256",
  "boundsPx",
  "foregroundPixels",
  "rasterScale",
  "rawComponentCount",
];
const SHA256 = /^sha256:[0-9a-f]{64}$/u;
const ARRAY_IS_ARRAY = Array.isArray;
const OBJECT_KEYS = Object.keys;
const HAS_OWN = Object.prototype.hasOwnProperty;

const safeInteger = (value, minimum, maximum) =>
  Number.isSafeInteger(value) && value >= minimum && value <= maximum;
const finiteCoordinate = (value) => Number.isFinite(value) && Math.abs(value) <= 100_000;

function exactKeys(value, expected, path) {
  if (value === null || typeof value !== "object" || ARRAY_IS_ARRAY(value)) {
    throw new Error(`${path} must be one exact plain record.`);
  }
  const observed = Reflect.apply(OBJECT_KEYS, Object, [value]);
  let hasEveryExpected = true;
  for (let index = 0; index < expected.length; index += 1) {
    if (!Reflect.apply(HAS_OWN, value, [expected[index]])) {
      hasEveryExpected = false;
      break;
    }
  }
  if (observed.length !== expected.length || !hasEveryExpected) {
    const preview = (key) => `${JSON.stringify(key.slice(0, 80))}${key.length > 80 ? "..." : ""}`;
    const unexpected = [];
    for (
      let observedIndex = 0;
      observedIndex < observed.length && unexpected.length < 4;
      observedIndex += 1
    ) {
      const key = observed[observedIndex];
      let known = false;
      for (let expectedIndex = 0; expectedIndex < expected.length; expectedIndex += 1) {
        if (expected[expectedIndex] === key) {
          known = true;
          break;
        }
      }
      if (!known) unexpected.push(preview(key));
    }
    const missing = [];
    for (let index = 0; index < expected.length && missing.length < 4; index += 1) {
      const key = expected[index];
      if (!Reflect.apply(HAS_OWN, value, [key])) missing.push(key);
    }
    throw new Error(
      `${path} must contain exactly its versioned keys; unexpected=${unexpected.join(",") || "none"}, missing=${missing.join(",") || "none"}.`,
    );
  }
}

/** Rejects silent schema extension before publication or feature propagation. */
export function assertCalloutManifestExactShape(manifest, label = "Callout manifest") {
  exactKeys(manifest, TOP_LEVEL_KEYS, label);
  exactKeys(manifest.accounting, ACCOUNTING_KEYS, `${label}.accounting`);
  exactKeys(manifest.conservation, CONSERVATION_KEYS, `${label}.conservation`);
  exactKeys(manifest.recoveryBenchmark, BENCHMARK_KEYS, `${label}.recoveryBenchmark`);
  if (
    !ARRAY_IS_ARRAY(manifest.recoveryBenchmark.scores) ||
    manifest.recoveryBenchmark.scores.length !== 2
  ) {
    throw new Error(`${label}.recoveryBenchmark.scores must contain exactly two score records.`);
  }
  for (let index = 0; index < manifest.recoveryBenchmark.scores.length; index += 1) {
    exactKeys(
      manifest.recoveryBenchmark.scores[index],
      SCORE_KEYS,
      `${label}.recoveryBenchmark.scores[${index}]`,
    );
  }
  if (
    !ARRAY_IS_ARRAY(manifest.callouts) ||
    manifest.callouts.length < 1 ||
    manifest.callouts.length > 2_000
  ) {
    throw new Error(`${label}.callouts must contain 1..2000 exact records.`);
  }
  for (let index = 0; index < manifest.callouts.length; index += 1) {
    const callout = manifest.callouts[index];
    const path = `${label}.callouts[${index}]`;
    exactKeys(callout, CALLOUT_KEYS, path);
    exactKeys(callout.box, BOX_KEYS, `${path}.box`);
    exactKeys(callout.cropRectPx, PIXEL_KEYS, `${path}.cropRectPx`);
    exactKeys(callout.boundaryClearancePx, PIXEL_KEYS, `${path}.boundaryClearancePx`);
    if (callout.sourceComponent !== null) {
      exactKeys(callout.sourceComponent, COMPONENT_KEYS, `${path}.sourceComponent`);
      exactKeys(callout.sourceComponent.boundsPx, PIXEL_KEYS, `${path}.sourceComponent.boundsPx`);
    }
    if (
      typeof callout.identity !== "string" ||
      callout.identity.length < 1 ||
      callout.identity.length > 96 ||
      typeof callout.file !== "string" ||
      callout.file.length < 1 ||
      callout.file.length > 512 ||
      !safeInteger(callout.pageNumber, 1, 10_000) ||
      !safeInteger(callout.stepNumber, 1, 10_000) ||
      !safeInteger(callout.quantity, 1, 10_000) ||
      !finiteCoordinate(callout.xPt) ||
      !finiteCoordinate(callout.yPt) ||
      !Number.isFinite(callout.heightPt) ||
      callout.heightPt <= 0 ||
      callout.heightPt > 100 ||
      (callout.boxMethod !== "vector-smallest" && callout.boxMethod !== "panel-neighbor-cell") ||
      !finiteCoordinate(callout.box.minXPt) ||
      !finiteCoordinate(callout.box.minYPt) ||
      !finiteCoordinate(callout.box.maxXPt) ||
      !finiteCoordinate(callout.box.maxYPt) ||
      callout.box.minXPt >= callout.box.maxXPt ||
      callout.box.minYPt >= callout.box.maxYPt ||
      !SHA256.test(callout.sha256) ||
      !safeInteger(callout.byteLength, 1, 2 * 1024 * 1024)
    ) {
      throw new Error(
        `${path} must bind bounded canonical identity/file scalars, 1..10000 page/step/quantity, finite ordered booklet geometry, a supported box method, one lowercase crop digest, and 1..2097152 retained PNG bytes.`,
      );
    }
  }
  return manifest;
}
