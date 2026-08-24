import { isDeepStrictEqual } from "node:util";

import { PDF_EMBEDDED_SOURCE_ART_MEASUREMENT_SCHEMA } from "./part-identification-source-art-images.mjs";

export const CALLOUT_SOURCE_ART_BINDING_SCHEMA = "lego.callout-source-art-binding/1";

const MAX_ROWS = 16;
const SHA256 = /^sha256:[0-9a-f]{64}$/u;
const BOUNDS_KEYS = ["bottom", "left", "right", "top"];
const COMPONENT_KEYS = [
  "absoluteForegroundSha256",
  "boundsPx",
  "foregroundPixels",
  "rasterScale",
  "rawComponentCount",
];
const ROW_KEYS = [
  "expectedCropSha256",
  "expectedOperatorIndex",
  "heightPt",
  "identity",
  "key",
  "pageNumber",
  "quantity",
  "sourceComponent",
  "stepNumber",
  "xPt",
  "yPt",
];
const MEASUREMENT_KEYS = [
  "admissionAuthority",
  "claim",
  "observedPdfSha256",
  "pageNumberConvention",
  "pdfjsVersion",
  "schemaVersion",
  "semanticIdentityClaimed",
  "witnesses",
];

function exactKeys(value, keys) {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.keys(value).sort().join(",") === [...keys].sort().join(",")
  );
}

function finiteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function shown(value) {
  const encoded = JSON.stringify(value);
  return encoded === undefined ? String(value) : encoded;
}

function mismatch(label, field, observed, expected) {
  throw new Error(`${label} ${field} was ${shown(observed)}; expected ${shown(expected)}.`);
}

function assertEqual(label, field, observed, expected) {
  if (!isDeepStrictEqual(observed, expected)) mismatch(label, field, observed, expected);
}

function assertPredicate(label, field, observed, expectation, predicate) {
  if (!predicate(observed)) {
    throw new Error(`${label} ${field} was ${shown(observed)}; expected ${expectation}.`);
  }
}

function assertBounds(value, label) {
  assertPredicate(label, "value", value, "one bounds object", (candidate) =>
    exactKeys(candidate, BOUNDS_KEYS),
  );
  for (const field of BOUNDS_KEYS) {
    assertPredicate(
      label,
      field,
      value[field],
      "a non-negative safe integer",
      (coordinate) => Number.isSafeInteger(coordinate) && coordinate >= 0,
    );
  }
  assertPredicate(label, "horizontal interval", [value.left, value.right], "left <= right", () =>
    Boolean(value.left <= value.right),
  );
  assertPredicate(label, "vertical interval", [value.top, value.bottom], "top <= bottom", () =>
    Boolean(value.top <= value.bottom),
  );
}

function assertSourceComponent(value, label) {
  assertPredicate(label, "value", value, "one exact source-component object", (candidate) =>
    exactKeys(candidate, COMPONENT_KEYS),
  );
  assertEqual(label, "rasterScale", value.rasterScale, 8);
  assertBounds(value.boundsPx, `${label} boundsPx`);
  assertPredicate(
    label,
    "foregroundPixels",
    value.foregroundPixels,
    "a positive safe integer",
    (count) => Number.isSafeInteger(count) && count > 0,
  );
  assertPredicate(
    label,
    "rawComponentCount",
    value.rawComponentCount,
    "a positive safe integer",
    (count) => Number.isSafeInteger(count) && count > 0,
  );
  assertPredicate(
    label,
    "absoluteForegroundSha256",
    value.absoluteForegroundSha256,
    "one lowercase sha256 digest",
    (digest) => typeof digest === "string" && SHA256.test(digest),
  );
}

function assertRows(rows) {
  if (!Array.isArray(rows) || rows.length < 1 || rows.length > MAX_ROWS) {
    throw new Error(
      `Source-art binding row count was ${Array.isArray(rows) ? rows.length : shown(rows)}; expected 1..${MAX_ROWS}.`,
    );
  }
  const keys = new Set();
  const identities = new Set();
  for (const [position, row] of rows.entries()) {
    const positionLabel = `Source-art binding row ${position}`;
    assertPredicate(positionLabel, "value", row, "one exact callout row", (candidate) =>
      exactKeys(candidate, ROW_KEYS),
    );
    assertPredicate(positionLabel, "key", row.key, "a 1..96 character string", (value) =>
      Boolean(typeof value === "string" && value.length >= 1 && value.length <= 96),
    );
    const label = `Source-art binding row ${shown(row.key)}`;
    assertPredicate(label, "identity", row.identity, "a 1..128 character string", (value) =>
      Boolean(typeof value === "string" && value.length >= 1 && value.length <= 128),
    );
    for (const field of ["pageNumber", "stepNumber", "quantity"]) {
      assertPredicate(label, field, row[field], "a positive safe integer", (value) =>
        Boolean(Number.isSafeInteger(value) && value >= 1),
      );
    }
    for (const field of ["xPt", "yPt"]) {
      assertPredicate(label, field, row[field], "one finite number", finiteNumber);
    }
    assertPredicate(label, "heightPt", row.heightPt, "a positive finite number", (value) =>
      Boolean(finiteNumber(value) && value > 0),
    );
    assertPredicate(
      label,
      "expectedOperatorIndex",
      row.expectedOperatorIndex,
      "a non-negative safe integer",
      (value) => Number.isSafeInteger(value) && value >= 0,
    );
    assertPredicate(
      label,
      "expectedCropSha256",
      row.expectedCropSha256,
      "one lowercase sha256 digest",
      (value) => typeof value === "string" && SHA256.test(value),
    );
    assertSourceComponent(row.sourceComponent, `${label} sourceComponent`);
    if (keys.has(row.key)) mismatch(label, "key", row.key, "a unique row key");
    if (identities.has(row.identity)) {
      mismatch(label, "identity", row.identity, "a unique callout identity");
    }
    keys.add(row.key);
    identities.add(row.identity);
  }
}

function assertMeasurement(measurement) {
  const label = "Source-art measurement";
  assertPredicate(label, "value", measurement, "one exact measurement /1 object", (candidate) =>
    exactKeys(candidate, MEASUREMENT_KEYS),
  );
  assertEqual(
    label,
    "schemaVersion",
    measurement.schemaVersion,
    PDF_EMBEDDED_SOURCE_ART_MEASUREMENT_SCHEMA,
  );
  assertEqual(label, "admissionAuthority", measurement.admissionAuthority, "none");
  assertEqual(label, "claim", measurement.claim, "embedded-source-art-only");
  assertEqual(label, "semanticIdentityClaimed", measurement.semanticIdentityClaimed, false);
  assertEqual(label, "pageNumberConvention", measurement.pageNumberConvention, "pdf-one-based");
  assertPredicate(
    label,
    "observedPdfSha256",
    measurement.observedPdfSha256,
    "one lowercase sha256 digest",
    (value) => typeof value === "string" && SHA256.test(value),
  );
  assertPredicate(label, "pdfjsVersion", measurement.pdfjsVersion, "a non-empty string", (value) =>
    Boolean(typeof value === "string" && value.length > 0),
  );
  assertPredicate(label, "witnesses", measurement.witnesses, "one witness array", Array.isArray);
}

function exactMap(values, rows, label, key) {
  assertPredicate(label, "value", values, "one selected-record array", Array.isArray);
  assertEqual(label, "record count", values.length, rows.length);
  const map = new Map();
  for (const [position, value] of values.entries()) {
    const identity = value?.[key];
    const recordLabel = `${label} record ${position}`;
    assertPredicate(recordLabel, key, identity, "one string key", (candidate) =>
      Boolean(typeof candidate === "string" && candidate.length > 0),
    );
    if (map.has(identity)) {
      mismatch(recordLabel, key, identity, `a unique ${key}`);
    }
    map.set(identity, value);
  }
  return map;
}

/**
 * Cross-binds an authority-free PDF image measurement to already authenticated
 * current manifest rows and freshly regenerated ranked browser crops.
 */
export function bindCalloutSourceArtMeasurement({
  rows,
  measurement,
  manifestCallouts,
  renderedCrops,
}) {
  assertRows(rows);
  assertMeasurement(measurement);
  const measurements = exactMap(measurement.witnesses, rows, "Measured witnesses", "key");
  const manifest = exactMap(manifestCallouts, rows, "Authenticated manifest callouts", "identity");
  const rendered = exactMap(renderedCrops, rows, "Fresh rendered crops", "identity");

  const boundRows = rows.map((row) => {
    const label = `Source-art binding row ${shown(row.key)}`;
    const measured = measurements.get(row.key);
    const current = manifest.get(row.identity);
    const fresh = rendered.get(row.identity);
    if (measured === undefined) mismatch(label, "measurement", measured, `witness key ${row.key}`);
    assertEqual(label, "measurement.identity", measured.identity, row.identity);
    assertEqual(label, "measurement.pageNumber", measured.pageNumber, row.pageNumber);
    assertEqual(
      label,
      "measurement.operatorIndex",
      measured.operatorIndex,
      row.expectedOperatorIndex,
    );
    assertEqual(label, "measurement.label", measured.label, `${row.quantity}x`);
    assertEqual(label, "measurement.labelTransformPt", measured.labelTransformPt, [
      row.xPt,
      row.yPt,
    ]);
    assertEqual(
      label,
      "measurement.componentBoundsPxAtScale8",
      measured.componentBoundsPxAtScale8,
      row.sourceComponent.boundsPx,
    );
    if (current === undefined) mismatch(label, "manifest callout", current, row.identity);
    for (const field of [
      "identity",
      "pageNumber",
      "stepNumber",
      "quantity",
      "xPt",
      "yPt",
      "heightPt",
    ]) {
      assertEqual(label, `manifest.${field}`, current[field], row[field]);
    }
    assertEqual(label, "manifest.cropStrategy", current.cropStrategy, "ranked-component");
    assertEqual(label, "manifest.evidenceKind", current.evidenceKind, "part-art");
    assertEqual(label, "manifest.regionKind", current.regionKind, "isolated-component");
    assertEqual(label, "manifest.sha256", current.sha256, row.expectedCropSha256);
    assertEqual(
      label,
      "manifest.foregroundPixels",
      current.foregroundPixels,
      row.sourceComponent.foregroundPixels,
    );
    assertEqual(label, "manifest.sourceComponent", current.sourceComponent, row.sourceComponent);
    const crop = fresh?.crop;
    if (fresh === undefined) mismatch(label, "fresh crop", fresh, row.identity);
    if (crop === undefined) mismatch(label, "fresh.crop", crop, "one rendered crop");
    assertEqual(label, "fresh.sha256", fresh.sha256, row.expectedCropSha256);
    assertEqual(label, "fresh.crop.strategy", crop.strategy, "ranked-component");
    assertEqual(label, "fresh.crop.evidenceKind", crop.evidenceKind, "part-art");
    assertEqual(label, "fresh.crop.regionKind", crop.regionKind, "isolated-component");
    assertEqual(label, "fresh.crop.widthPx", crop.widthPx, current.widthPx);
    assertEqual(label, "fresh.crop.heightPx", crop.heightPx, current.heightPx);
    assertEqual(
      label,
      "fresh.crop.foregroundPixels",
      crop.foregroundPixels,
      row.sourceComponent.foregroundPixels,
    );
    assertEqual(label, "fresh.crop.sourceComponent", crop.sourceComponent, row.sourceComponent);
    return {
      cropSha256: row.expectedCropSha256,
      decodedPixelSha256: measured.decodedPixelSha256,
      embeddedSourceArtSha256: measured.embeddedSourceArtSha256,
      heightPx: crop.heightPx,
      identity: row.identity,
      key: row.key,
      operatorIndex: row.expectedOperatorIndex,
      pageNumber: row.pageNumber,
      quantity: row.quantity,
      sourceComponent: row.sourceComponent,
      stepNumber: row.stepNumber,
      widthPx: crop.widthPx,
    };
  });

  return {
    admissionAuthority: "none",
    coverageTrustGranted: false,
    rows: boundRows,
    schemaVersion: CALLOUT_SOURCE_ART_BINDING_SCHEMA,
    semanticIdentityClaimed: false,
  };
}

export const __testOnly = Object.freeze({ assertRows });
