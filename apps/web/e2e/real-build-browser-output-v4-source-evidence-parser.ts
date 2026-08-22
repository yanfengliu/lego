import { sha256Hex, type Sha256Digest } from "@lego-studio/brick-kernel";

import { realBuildSourceParityPreparedPanelsManifest } from "./real-build-observation-source-parity-contract";
import { intrinsicRealBuildFreeze } from "./real-build-intrinsic-freeze";
import { parseRealBuildBrowserOutputV4SourceEvidencePanel } from "./real-build-browser-output-v4-source-evidence-parser-values";
import {
  sourceEvidenceDenseArray,
  sourceEvidenceDigestValue,
  sourceEvidenceExactRecord,
  sourceEvidenceInteger,
  sourceEvidenceParseCanonicalJson,
} from "./real-build-browser-output-v4-source-evidence-primitives";
import {
  MAXIMUM_REAL_BUILD_BROWSER_OUTPUT_V4_SOURCE_EVIDENCE_MANIFEST_BYTES,
  MAXIMUM_REAL_BUILD_BROWSER_OUTPUT_V4_SOURCE_EVIDENCE_PANELS,
  MAXIMUM_REAL_BUILD_BROWSER_OUTPUT_V4_SOURCE_EVIDENCE_TOTAL_HIGH_PIXELS,
  MAXIMUM_REAL_BUILD_BROWSER_OUTPUT_V4_SOURCE_EVIDENCE_TOTAL_MASK_BYTES,
  MAXIMUM_REAL_BUILD_BROWSER_OUTPUT_V4_SOURCE_EVIDENCE_TOTAL_ROLE_BYTES,
  MAXIMUM_REAL_BUILD_BROWSER_OUTPUT_V4_SOURCE_EVIDENCE_TOTAL_WORK_PIXELS,
  REAL_BUILD_BROWSER_OUTPUT_V4_SOURCE_EVIDENCE_AUTHORITY,
  REAL_BUILD_BROWSER_OUTPUT_V4_SOURCE_EVIDENCE_SCHEMA,
  REAL_BUILD_BROWSER_OUTPUT_V4_SOURCE_EXECUTION_PROVENANCE,
  type RealBuildBrowserOutputV4SourceEvidenceManifest,
  type RealBuildBrowserOutputV4SourceEvidencePanel,
} from "./real-build-browser-output-v4-source-evidence-types";

const JSON_STRINGIFY = JSON.stringify;
const NUMBER_IS_SAFE_INTEGER = Number.isSafeInteger;
const AGGREGATE_KEYS = [
  "highRgbaBytes",
  "workRgbaBytes",
  "maskBytes",
  "totalRoleBytes",
  "totalHighPixels",
  "totalWorkPixels",
] as const;

function reproducePreparedPanelsDigest(
  pdfDigest: Sha256Digest,
  panels: readonly RealBuildBrowserOutputV4SourceEvidencePanel[],
): Sha256Digest {
  const prepared = [];
  for (let index = 0; index < panels.length; index += 1) {
    const panel = panels[index]!;
    prepared[index] = {
      stepNumber: panel.stepNumber,
      pageNumber: panel.pageNumber,
      minXPt: panel.minXPt,
      maxXPt: panel.maxXPt,
      minYPt: panel.minYPt,
      maxYPt: panel.maxYPt,
      calloutBoxes: panel.calloutBoxes,
      panelEvidenceDigest: panel.panelEvidenceDigest,
    };
  }
  return `sha256:${sha256Hex(
    JSON_STRINGIFY(realBuildSourceParityPreparedPanelsManifest(pdfDigest, prepared)),
  )}`;
}

export function parseRealBuildBrowserOutputV4SourceEvidenceManifest(
  bytesValue: unknown,
): RealBuildBrowserOutputV4SourceEvidenceManifest {
  const parsed = sourceEvidenceParseCanonicalJson(
    bytesValue,
    MAXIMUM_REAL_BUILD_BROWSER_OUTPUT_V4_SOURCE_EVIDENCE_MANIFEST_BYTES,
    "Source evidence manifest",
  );
  const row = sourceEvidenceExactRecord(
    parsed.value,
    [
      "schemaVersion",
      "authority",
      "sourceExecutionProvenance",
      "coverage",
      "preparedRunInputDigest",
      "pdfDigest",
      "preparedPanelsDigest",
      "rasterPolicy",
      "aggregate",
      "panels",
    ],
    "Source evidence manifest",
  );
  if (row.schemaVersion !== REAL_BUILD_BROWSER_OUTPUT_V4_SOURCE_EVIDENCE_SCHEMA) {
    throw new TypeError(
      `Source evidence manifest.schemaVersion must be ${REAL_BUILD_BROWSER_OUTPUT_V4_SOURCE_EVIDENCE_SCHEMA}.`,
    );
  }
  const authority = sourceEvidenceExactRecord(
    row.authority,
    ["status", "authorized", "reason"],
    "Source evidence manifest.authority",
  );
  if (
    authority.status !== REAL_BUILD_BROWSER_OUTPUT_V4_SOURCE_EVIDENCE_AUTHORITY.status ||
    authority.authorized !== REAL_BUILD_BROWSER_OUTPUT_V4_SOURCE_EVIDENCE_AUTHORITY.authorized ||
    authority.reason !== REAL_BUILD_BROWSER_OUTPUT_V4_SOURCE_EVIDENCE_AUTHORITY.reason
  ) {
    throw new TypeError("Source evidence manifest must retain exact absent authority.");
  }
  const sourceExecutionProvenance = sourceEvidenceExactRecord(
    row.sourceExecutionProvenance,
    ["status", "reason"],
    "Source evidence manifest.sourceExecutionProvenance",
  );
  if (
    sourceExecutionProvenance.status !==
      REAL_BUILD_BROWSER_OUTPUT_V4_SOURCE_EXECUTION_PROVENANCE.status ||
    sourceExecutionProvenance.reason !==
      REAL_BUILD_BROWSER_OUTPUT_V4_SOURCE_EXECUTION_PROVENANCE.reason
  ) {
    throw new TypeError(
      "Source evidence manifest must retain exact absent PDF-render/provisional provenance.",
    );
  }
  const coverage = sourceEvidenceExactRecord(
    row.coverage,
    ["expectedPanelCount", "retainedPanelCount", "status"],
    "Source evidence manifest.coverage",
  );
  if (
    coverage.expectedPanelCount !== 359 ||
    coverage.retainedPanelCount !== 359 ||
    coverage.status !== "complete"
  ) {
    throw new TypeError("Source evidence manifest coverage must be exact complete 359/359.");
  }
  const preparedRunInputDigest = sourceEvidenceDigestValue(
    row.preparedRunInputDigest,
    "Source evidence manifest.preparedRunInputDigest",
  );
  const pdfDigest = sourceEvidenceDigestValue(row.pdfDigest, "Source evidence manifest.pdfDigest");
  const preparedPanelsDigest = sourceEvidenceDigestValue(
    row.preparedPanelsDigest,
    "Source evidence manifest.preparedPanelsDigest",
  );
  const raster = sourceEvidenceExactRecord(
    row.rasterPolicy,
    ["renderScale", "panelWidth", "workFactor"],
    "Source evidence manifest.rasterPolicy",
  );
  if (raster.renderScale !== 6 || raster.panelWidth !== 1_000 || raster.workFactor !== 2) {
    throw new TypeError("Source evidence manifest raster policy must be exact 6/1000/2.");
  }
  const rawPanels = sourceEvidenceDenseArray(
    row.panels,
    MAXIMUM_REAL_BUILD_BROWSER_OUTPUT_V4_SOURCE_EVIDENCE_PANELS,
    MAXIMUM_REAL_BUILD_BROWSER_OUTPUT_V4_SOURCE_EVIDENCE_PANELS,
    "Source evidence manifest.panels",
  );
  const panels: RealBuildBrowserOutputV4SourceEvidencePanel[] = [];
  let previousPage = 0;
  let highRgbaBytes = 0;
  let workRgbaBytes = 0;
  let maskBytes = 0;
  let totalHighPixels = 0;
  let totalWorkPixels = 0;
  for (let index = 0; index < rawPanels.length; index += 1) {
    const panel = parseRealBuildBrowserOutputV4SourceEvidencePanel(
      rawPanels[index],
      index,
      pdfDigest,
      previousPage,
    );
    previousPage = panel.pageNumber;
    highRgbaBytes += panel.roles[0]!.byteLength;
    workRgbaBytes += panel.roles[1]!.byteLength;
    maskBytes += panel.roles[2]!.byteLength;
    totalHighPixels += panel.highPixelCount;
    totalWorkPixels += panel.workPixelCount;
    panels[index] = panel;
  }
  const totalRoleBytes = highRgbaBytes + workRgbaBytes + maskBytes;
  if (
    totalHighPixels > MAXIMUM_REAL_BUILD_BROWSER_OUTPUT_V4_SOURCE_EVIDENCE_TOTAL_HIGH_PIXELS ||
    totalWorkPixels > MAXIMUM_REAL_BUILD_BROWSER_OUTPUT_V4_SOURCE_EVIDENCE_TOTAL_WORK_PIXELS ||
    maskBytes > MAXIMUM_REAL_BUILD_BROWSER_OUTPUT_V4_SOURCE_EVIDENCE_TOTAL_MASK_BYTES ||
    !NUMBER_IS_SAFE_INTEGER(totalRoleBytes) ||
    totalRoleBytes > MAXIMUM_REAL_BUILD_BROWSER_OUTPUT_V4_SOURCE_EVIDENCE_TOTAL_ROLE_BYTES
  ) {
    throw new RangeError("Source evidence manifest exceeds aggregate pixel or external-role caps.");
  }
  const aggregate = sourceEvidenceExactRecord(
    row.aggregate,
    [
      "highRgbaBytes",
      "workRgbaBytes",
      "maskBytes",
      "totalRoleBytes",
      "totalHighPixels",
      "totalWorkPixels",
    ],
    "Source evidence manifest.aggregate",
  );
  const observedAggregate = {
    highRgbaBytes: sourceEvidenceInteger(
      aggregate.highRgbaBytes,
      1,
      MAXIMUM_REAL_BUILD_BROWSER_OUTPUT_V4_SOURCE_EVIDENCE_TOTAL_ROLE_BYTES,
      "Source evidence aggregate.highRgbaBytes",
    ),
    workRgbaBytes: sourceEvidenceInteger(
      aggregate.workRgbaBytes,
      1,
      MAXIMUM_REAL_BUILD_BROWSER_OUTPUT_V4_SOURCE_EVIDENCE_TOTAL_ROLE_BYTES,
      "Source evidence aggregate.workRgbaBytes",
    ),
    maskBytes: sourceEvidenceInteger(
      aggregate.maskBytes,
      1,
      MAXIMUM_REAL_BUILD_BROWSER_OUTPUT_V4_SOURCE_EVIDENCE_TOTAL_MASK_BYTES,
      "Source evidence aggregate.maskBytes",
    ),
    totalRoleBytes: sourceEvidenceInteger(
      aggregate.totalRoleBytes,
      1,
      MAXIMUM_REAL_BUILD_BROWSER_OUTPUT_V4_SOURCE_EVIDENCE_TOTAL_ROLE_BYTES,
      "Source evidence aggregate.totalRoleBytes",
    ),
    totalHighPixels: sourceEvidenceInteger(
      aggregate.totalHighPixels,
      1,
      MAXIMUM_REAL_BUILD_BROWSER_OUTPUT_V4_SOURCE_EVIDENCE_TOTAL_HIGH_PIXELS,
      "Source evidence aggregate.totalHighPixels",
    ),
    totalWorkPixels: sourceEvidenceInteger(
      aggregate.totalWorkPixels,
      1,
      MAXIMUM_REAL_BUILD_BROWSER_OUTPUT_V4_SOURCE_EVIDENCE_TOTAL_WORK_PIXELS,
      "Source evidence aggregate.totalWorkPixels",
    ),
  };
  const reproducedAggregate = {
    highRgbaBytes,
    workRgbaBytes,
    maskBytes,
    totalRoleBytes,
    totalHighPixels,
    totalWorkPixels,
  };
  for (let index = 0; index < AGGREGATE_KEYS.length; index += 1) {
    const key = AGGREGATE_KEYS[index]!;
    if (observedAggregate[key] !== reproducedAggregate[key]) {
      throw new TypeError(
        `Source evidence aggregate.${key} is ${observedAggregate[key]}; descriptors reproduce ${reproducedAggregate[key]}.`,
      );
    }
  }
  const reproducedPrepared = reproducePreparedPanelsDigest(pdfDigest, panels);
  if (preparedPanelsDigest !== reproducedPrepared) {
    throw new TypeError(
      `Source evidence preparedPanelsDigest is ${preparedPanelsDigest}; exact 359 PDF/page/bounds/callouts rows reproduce ${reproducedPrepared}.`,
    );
  }
  return intrinsicRealBuildFreeze({
    schemaVersion: REAL_BUILD_BROWSER_OUTPUT_V4_SOURCE_EVIDENCE_SCHEMA,
    authority: REAL_BUILD_BROWSER_OUTPUT_V4_SOURCE_EVIDENCE_AUTHORITY,
    sourceExecutionProvenance: REAL_BUILD_BROWSER_OUTPUT_V4_SOURCE_EXECUTION_PROVENANCE,
    coverage: intrinsicRealBuildFreeze({
      expectedPanelCount: 359 as const,
      retainedPanelCount: 359 as const,
      status: "complete" as const,
    }),
    preparedRunInputDigest,
    pdfDigest,
    preparedPanelsDigest,
    rasterPolicy: intrinsicRealBuildFreeze({
      renderScale: 6 as const,
      panelWidth: 1_000 as const,
      workFactor: 2 as const,
    }),
    aggregate: intrinsicRealBuildFreeze(observedAggregate),
    panels: intrinsicRealBuildFreeze(panels),
  });
}
