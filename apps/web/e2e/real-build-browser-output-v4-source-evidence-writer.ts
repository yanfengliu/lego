import { sha256Hex, type Sha256Digest } from "@lego-studio/brick-kernel";

import { realBuildSourceParityPreparedPanelsManifest } from "./real-build-observation-source-parity-contract";
import { intrinsicRealBuildFreeze } from "./real-build-intrinsic-freeze";
import { isRealBuildBrowserOutputV4SourceEvidencePanelDescriptor } from "./real-build-browser-output-v4-source-evidence-brands";
import { bindRealBuildBrowserOutputV4SourceEvidencePreparedRun } from "./real-build-browser-output-v4-source-evidence-prepared";
import {
  sourceEvidenceActiveBytes,
  sourceEvidenceCanonicalBytes,
  sourceEvidenceDenseArray,
  sourceEvidenceDigest,
  sourceEvidenceExactRecord,
  sourceEvidenceFreshCopy,
} from "./real-build-browser-output-v4-source-evidence-primitives";
import {
  MAXIMUM_REAL_BUILD_BROWSER_OUTPUT_V4_SOURCE_EVIDENCE_ACTIVE_BYTES,
  MAXIMUM_REAL_BUILD_BROWSER_OUTPUT_V4_SOURCE_EVIDENCE_MANIFEST_BYTES,
  MAXIMUM_REAL_BUILD_BROWSER_OUTPUT_V4_SOURCE_EVIDENCE_PANELS,
  MAXIMUM_REAL_BUILD_BROWSER_OUTPUT_V4_SOURCE_EVIDENCE_TOTAL_HIGH_PIXELS,
  MAXIMUM_REAL_BUILD_BROWSER_OUTPUT_V4_SOURCE_EVIDENCE_TOTAL_MASK_BYTES,
  MAXIMUM_REAL_BUILD_BROWSER_OUTPUT_V4_SOURCE_EVIDENCE_TOTAL_ROLE_BYTES,
  MAXIMUM_REAL_BUILD_BROWSER_OUTPUT_V4_SOURCE_EVIDENCE_TOTAL_WORK_PIXELS,
  REAL_BUILD_BROWSER_OUTPUT_V4_SOURCE_EVIDENCE_AUTHORITY,
  REAL_BUILD_BROWSER_OUTPUT_V4_SOURCE_EVIDENCE_SCHEMA,
  REAL_BUILD_BROWSER_OUTPUT_V4_SOURCE_EXECUTION_PROVENANCE,
  type CreateRealBuildBrowserOutputV4SourceEvidenceManifestInput,
  type RealBuildBrowserOutputV4SourceEvidenceManifestArtifact,
  type RealBuildBrowserOutputV4SourceEvidencePanel,
} from "./real-build-browser-output-v4-source-evidence-types";

const JSON_STRINGIFY = JSON.stringify;
const NUMBER_IS_SAFE_INTEGER = Number.isSafeInteger;

function preparedPanelsDigest(
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

/** Finalizes only the exact dense descriptor set; per-panel payloads stay external. */
export function createRealBuildBrowserOutputV4SourceEvidenceManifest(
  value: CreateRealBuildBrowserOutputV4SourceEvidenceManifestInput | unknown,
): RealBuildBrowserOutputV4SourceEvidenceManifestArtifact {
  const input = sourceEvidenceExactRecord(
    value,
    ["preparedRunInputInspection", "panels"],
    "Source evidence manifest input",
  );
  const suppliedPanels = sourceEvidenceDenseArray(
    input.panels,
    MAXIMUM_REAL_BUILD_BROWSER_OUTPUT_V4_SOURCE_EVIDENCE_PANELS,
    MAXIMUM_REAL_BUILD_BROWSER_OUTPUT_V4_SOURCE_EVIDENCE_PANELS,
    "Source evidence manifest input.panels",
  );
  const panels: RealBuildBrowserOutputV4SourceEvidencePanel[] = [];
  let previousPage = 0;
  let highRgbaBytes = 0;
  let workRgbaBytes = 0;
  let maskBytes = 0;
  let totalHighPixels = 0;
  let totalWorkPixels = 0;
  for (let index = 0; index < suppliedPanels.length; index += 1) {
    const panel = suppliedPanels[index];
    if (!isRealBuildBrowserOutputV4SourceEvidencePanelDescriptor(panel)) {
      throw new TypeError(
        `Source evidence manifest panel ${index} must be an exact panel-writer descriptor.`,
      );
    }
    if (panel.stepNumber !== index + 1) {
      throw new TypeError(
        `Source evidence manifest panel ${index} is step ${panel.stepNumber}; expected ${index + 1}.`,
      );
    }
    if (panel.pageNumber < previousPage) {
      throw new TypeError(
        `Source evidence step ${panel.stepNumber} page ${panel.pageNumber} precedes page ${previousPage}.`,
      );
    }
    previousPage = panel.pageNumber;
    const activeBytes = sourceEvidenceActiveBytes(
      panel.highPixelCount,
      panel.workPixelCount,
      panel.roles[2]!.byteLength,
    );
    if (activeBytes > MAXIMUM_REAL_BUILD_BROWSER_OUTPUT_V4_SOURCE_EVIDENCE_ACTIVE_BYTES) {
      throw new RangeError(
        `Source evidence step ${panel.stepNumber} requires ${activeBytes} estimated active bytes; maximum is ${MAXIMUM_REAL_BUILD_BROWSER_OUTPUT_V4_SOURCE_EVIDENCE_ACTIVE_BYTES}.`,
      );
    }
    highRgbaBytes += panel.roles[0]!.byteLength;
    workRgbaBytes += panel.roles[1]!.byteLength;
    maskBytes += panel.roles[2]!.byteLength;
    totalHighPixels += panel.highPixelCount;
    totalWorkPixels += panel.workPixelCount;
    panels[index] = panel;
  }
  const { preparedRunInputDigest, pdfDigest } =
    bindRealBuildBrowserOutputV4SourceEvidencePreparedRun(input.preparedRunInputInspection, panels);
  const totalRoleBytes = highRgbaBytes + workRgbaBytes + maskBytes;
  if (
    totalHighPixels > MAXIMUM_REAL_BUILD_BROWSER_OUTPUT_V4_SOURCE_EVIDENCE_TOTAL_HIGH_PIXELS ||
    totalWorkPixels > MAXIMUM_REAL_BUILD_BROWSER_OUTPUT_V4_SOURCE_EVIDENCE_TOTAL_WORK_PIXELS ||
    maskBytes > MAXIMUM_REAL_BUILD_BROWSER_OUTPUT_V4_SOURCE_EVIDENCE_TOTAL_MASK_BYTES ||
    !NUMBER_IS_SAFE_INTEGER(totalRoleBytes) ||
    totalRoleBytes > MAXIMUM_REAL_BUILD_BROWSER_OUTPUT_V4_SOURCE_EVIDENCE_TOTAL_ROLE_BYTES
  ) {
    throw new RangeError(
      `Source evidence aggregate high/work/mask/total is ${totalHighPixels}/${totalWorkPixels}/${maskBytes}/${String(totalRoleBytes)}; limits are ${MAXIMUM_REAL_BUILD_BROWSER_OUTPUT_V4_SOURCE_EVIDENCE_TOTAL_HIGH_PIXELS}/${MAXIMUM_REAL_BUILD_BROWSER_OUTPUT_V4_SOURCE_EVIDENCE_TOTAL_WORK_PIXELS}/${MAXIMUM_REAL_BUILD_BROWSER_OUTPUT_V4_SOURCE_EVIDENCE_TOTAL_MASK_BYTES}/${MAXIMUM_REAL_BUILD_BROWSER_OUTPUT_V4_SOURCE_EVIDENCE_TOTAL_ROLE_BYTES}.`,
    );
  }
  const manifest = intrinsicRealBuildFreeze({
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
    preparedPanelsDigest: preparedPanelsDigest(pdfDigest, panels),
    rasterPolicy: intrinsicRealBuildFreeze({
      renderScale: 6 as const,
      panelWidth: 1_000 as const,
      workFactor: 2 as const,
    }),
    aggregate: intrinsicRealBuildFreeze({
      highRgbaBytes,
      workRgbaBytes,
      maskBytes,
      totalRoleBytes,
      totalHighPixels,
      totalWorkPixels,
    }),
    panels: intrinsicRealBuildFreeze(panels),
  });
  const manifestBytes = sourceEvidenceCanonicalBytes(manifest);
  if (
    manifestBytes.byteLength > MAXIMUM_REAL_BUILD_BROWSER_OUTPUT_V4_SOURCE_EVIDENCE_MANIFEST_BYTES
  ) {
    throw new RangeError(
      `Source evidence manifest has ${manifestBytes.byteLength} bytes; maximum is ${MAXIMUM_REAL_BUILD_BROWSER_OUTPUT_V4_SOURCE_EVIDENCE_MANIFEST_BYTES}.`,
    );
  }
  const retained = sourceEvidenceFreshCopy(manifestBytes);
  return intrinsicRealBuildFreeze({
    manifest,
    manifestDigest: sourceEvidenceDigest(retained),
    readManifestBytes: () => sourceEvidenceFreshCopy(retained),
  });
}
