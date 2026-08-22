import { canonicalDigest, type Sha256Digest } from "@lego-studio/brick-kernel";

import { stepPanelEvidenceDigest } from "./real-build-panel-evidence-digest";
import { intrinsicRealBuildFreeze } from "./real-build-intrinsic-freeze";
import {
  sourceEvidenceActiveBytes,
  sourceEvidenceDenseArray,
  sourceEvidenceDigestValue,
  sourceEvidenceExactRecord,
  sourceEvidenceFinite,
  sourceEvidenceInteger,
} from "./real-build-browser-output-v4-source-evidence-primitives";
import {
  MAXIMUM_REAL_BUILD_BROWSER_OUTPUT_V4_SOURCE_EVIDENCE_ACTIVE_BYTES,
  MAXIMUM_REAL_BUILD_BROWSER_OUTPUT_V4_SOURCE_EVIDENCE_CALLOUTS,
  MAXIMUM_REAL_BUILD_BROWSER_OUTPUT_V4_SOURCE_EVIDENCE_HIGH_PANEL_BYTES,
  MAXIMUM_REAL_BUILD_BROWSER_OUTPUT_V4_SOURCE_EVIDENCE_MASK_PANEL_BYTES,
  MAXIMUM_REAL_BUILD_BROWSER_OUTPUT_V4_SOURCE_EVIDENCE_WORK_PANEL_BYTES,
  REAL_BUILD_BROWSER_OUTPUT_V4_SOURCE_EVIDENCE_MASKS,
  REAL_BUILD_BROWSER_OUTPUT_V4_SOURCE_EVIDENCE_ROLE_ENCODINGS,
  REAL_BUILD_BROWSER_OUTPUT_V4_SOURCE_EVIDENCE_ROLES,
  type RealBuildBrowserOutputV4SourceEvidenceByteReference,
  type RealBuildBrowserOutputV4SourceEvidenceMaskReference,
  type RealBuildBrowserOutputV4SourceEvidencePanel,
  type RealBuildBrowserOutputV4SourceEvidenceRoleDescriptor,
} from "./real-build-browser-output-v4-source-evidence-types";
import type { RealBuildSourceParityBounds } from "./real-build-observation-source-parity-types";

function parseBounds(value: unknown, path: string): RealBuildSourceParityBounds {
  const row = sourceEvidenceExactRecord(value, ["minXPt", "maxXPt", "minYPt", "maxYPt"], path);
  const result = intrinsicRealBuildFreeze({
    minXPt: sourceEvidenceFinite(row.minXPt, `${path}.minXPt`),
    maxXPt: sourceEvidenceFinite(row.maxXPt, `${path}.maxXPt`),
    minYPt: sourceEvidenceFinite(row.minYPt, `${path}.minYPt`),
    maxYPt: sourceEvidenceFinite(row.maxYPt, `${path}.maxYPt`),
  });
  if (result.maxXPt <= result.minXPt || result.maxYPt <= result.minYPt) {
    throw new RangeError(`${path} must have positive PDF-point width and height.`);
  }
  return result;
}

function parseRoles(
  value: unknown,
  expectedBytes: readonly [number, number, number],
  path: string,
): readonly RealBuildBrowserOutputV4SourceEvidenceRoleDescriptor[] {
  const rows = sourceEvidenceDenseArray(value, 3, 3, path);
  const limits = [
    MAXIMUM_REAL_BUILD_BROWSER_OUTPUT_V4_SOURCE_EVIDENCE_HIGH_PANEL_BYTES,
    MAXIMUM_REAL_BUILD_BROWSER_OUTPUT_V4_SOURCE_EVIDENCE_WORK_PANEL_BYTES,
    MAXIMUM_REAL_BUILD_BROWSER_OUTPUT_V4_SOURCE_EVIDENCE_MASK_PANEL_BYTES,
  ] as const;
  const result: RealBuildBrowserOutputV4SourceEvidenceRoleDescriptor[] = [];
  for (let index = 0; index < rows.length; index += 1) {
    const row = sourceEvidenceExactRecord(
      rows[index],
      ["role", "contentEncoding", "byteLength", "digest"],
      `${path}[${index}]`,
    );
    const role = REAL_BUILD_BROWSER_OUTPUT_V4_SOURCE_EVIDENCE_ROLES[index]!;
    if (row.role !== role) throw new TypeError(`${path}[${index}].role must be ${role}.`);
    const encoding = REAL_BUILD_BROWSER_OUTPUT_V4_SOURCE_EVIDENCE_ROLE_ENCODINGS[role];
    if (row.contentEncoding !== encoding) {
      throw new TypeError(`${path}[${index}].contentEncoding must be ${encoding}.`);
    }
    const byteLength = sourceEvidenceInteger(
      row.byteLength,
      1,
      limits[index]!,
      `${path}[${index}].byteLength`,
    );
    if (byteLength !== expectedBytes[index]) {
      throw new RangeError(
        `${path}[${index}].byteLength is ${byteLength}; exact panel geometry requires ${expectedBytes[index]}.`,
      );
    }
    result[index] = intrinsicRealBuildFreeze({
      role,
      contentEncoding: encoding,
      byteLength,
      digest: sourceEvidenceDigestValue(row.digest, `${path}[${index}].digest`),
    });
  }
  return intrinsicRealBuildFreeze(result);
}

function parseRgbaReference(
  value: unknown,
  role: "source-high-rgba8" | "source-work-rgba8",
  expectedBytes: number,
  roleDigest: Sha256Digest,
  path: string,
): RealBuildBrowserOutputV4SourceEvidenceByteReference {
  const row = sourceEvidenceExactRecord(value, ["role", "offset", "byteLength", "digest"], path);
  if (row.role !== role || row.offset !== 0 || row.byteLength !== expectedBytes) {
    throw new TypeError(`${path} must cover the complete ${role} payload from offset zero.`);
  }
  const digest = sourceEvidenceDigestValue(row.digest, `${path}.digest`);
  if (digest !== roleDigest)
    throw new TypeError(`${path}.digest must equal its whole role digest.`);
  return intrinsicRealBuildFreeze({ role, offset: 0, byteLength: expectedBytes, digest });
}

function parseMasks(
  value: unknown,
  highWidth: number,
  highHeight: number,
  workWidth: number,
  workHeight: number,
  maskRoleBytes: number,
  path: string,
): readonly RealBuildBrowserOutputV4SourceEvidenceMaskReference[] {
  const rows = sourceEvidenceDenseArray(value, 8, 8, path);
  const result: RealBuildBrowserOutputV4SourceEvidenceMaskReference[] = [];
  let cursor = 0;
  for (let index = 0; index < rows.length; index += 1) {
    const row = sourceEvidenceExactRecord(
      rows[index],
      [
        "name",
        "role",
        "contentEncoding",
        "width",
        "height",
        "pixelCount",
        "offset",
        "byteLength",
        "lowPaddingBits",
        "packedDigest",
        "unpackedDigest",
      ],
      `${path}[${index}]`,
    );
    const name = REAL_BUILD_BROWSER_OUTPUT_V4_SOURCE_EVIDENCE_MASKS[index]!;
    const width = name === "H" ? highWidth : workWidth;
    const height = name === "H" ? highHeight : workHeight;
    const pixels = width * height;
    const bytes = Math.ceil(pixels / 8);
    const padding = (8 - (pixels & 7)) & 7;
    if (
      row.name !== name ||
      row.role !== "source-masks-packed-msb" ||
      row.contentEncoding !== "packed-binary-mask-msb/1" ||
      row.width !== width ||
      row.height !== height ||
      row.pixelCount !== pixels ||
      row.offset !== cursor ||
      row.byteLength !== bytes ||
      row.lowPaddingBits !== padding
    ) {
      throw new TypeError(
        `${path}[${index}] must be the exact dense ${name} ${width}x${height} packed-MSB reference at offset ${cursor}.`,
      );
    }
    result[index] = intrinsicRealBuildFreeze({
      name,
      role: "source-masks-packed-msb",
      contentEncoding: "packed-binary-mask-msb/1",
      width,
      height,
      pixelCount: pixels,
      offset: cursor,
      byteLength: bytes,
      lowPaddingBits: padding,
      packedDigest: sourceEvidenceDigestValue(row.packedDigest, `${path}[${index}].packedDigest`),
      unpackedDigest: sourceEvidenceDigestValue(
        row.unpackedDigest,
        `${path}[${index}].unpackedDigest`,
      ),
    });
    cursor += bytes;
  }
  if (cursor !== maskRoleBytes) {
    throw new RangeError(`${path} covers ${cursor} bytes; mask role declares ${maskRoleBytes}.`);
  }
  return intrinsicRealBuildFreeze(result);
}

function parseMode(value: unknown, ownPanel: boolean, path: string) {
  const row = sourceEvidenceExactRecord(
    value,
    ["measure", "sourceDescriptorDigest", "exclusionDescriptorDigest"],
    path,
  );
  if (row.measure !== "iou" && row.measure !== "containment") {
    throw new TypeError(`${path}.measure must be iou or containment.`);
  }
  if (ownPanel && row.measure !== "iou") throw new TypeError(`${path}.measure must be iou.`);
  return intrinsicRealBuildFreeze({
    measure: row.measure,
    sourceDescriptorDigest: sourceEvidenceDigestValue(
      row.sourceDescriptorDigest,
      `${path}.sourceDescriptorDigest`,
    ),
    exclusionDescriptorDigest: sourceEvidenceDigestValue(
      row.exclusionDescriptorDigest,
      `${path}.exclusionDescriptorDigest`,
    ),
  });
}

export function parseRealBuildBrowserOutputV4SourceEvidencePanel(
  value: unknown,
  index: number,
  pdfDigest: Sha256Digest,
  previousPage: number,
): RealBuildBrowserOutputV4SourceEvidencePanel {
  const path = `Source evidence manifest.panels[${index}]`;
  const row = sourceEvidenceExactRecord(
    value,
    [
      "stepNumber",
      "pageNumber",
      "minXPt",
      "maxXPt",
      "minYPt",
      "maxYPt",
      "calloutBoxes",
      "panelEvidenceDigest",
      "cropDescriptorDigest",
      "highWidth",
      "highHeight",
      "highPixelCount",
      "workWidth",
      "workHeight",
      "workPixelCount",
      "workFactor",
      "roles",
      "highRgba",
      "workRgba",
      "masks",
      "workPixelsDigest",
      "policyDescriptorDigest",
      "derivationDescriptorDigest",
      "assemblyMaskDigest",
      "ownPanel",
      "lookahead",
    ],
    path,
  );
  const stepNumber = sourceEvidenceInteger(row.stepNumber, 1, 359, `${path}.stepNumber`);
  if (stepNumber !== index + 1) throw new TypeError(`${path}.stepNumber must be ${index + 1}.`);
  const pageNumber = sourceEvidenceInteger(row.pageNumber, 1, 400, `${path}.pageNumber`);
  if (pageNumber < previousPage) throw new TypeError(`${path}.pageNumber precedes the prior page.`);
  const panelBounds = parseBounds(
    {
      minXPt: row.minXPt,
      maxXPt: row.maxXPt,
      minYPt: row.minYPt,
      maxYPt: row.maxYPt,
    },
    path,
  );
  const rawCallouts = sourceEvidenceDenseArray(
    row.calloutBoxes,
    0,
    MAXIMUM_REAL_BUILD_BROWSER_OUTPUT_V4_SOURCE_EVIDENCE_CALLOUTS,
    `${path}.calloutBoxes`,
  );
  const calloutBoxes: RealBuildSourceParityBounds[] = [];
  for (let callout = 0; callout < rawCallouts.length; callout += 1) {
    calloutBoxes[callout] = parseBounds(rawCallouts[callout], `${path}.calloutBoxes[${callout}]`);
  }
  const panelEvidenceDigest = sourceEvidenceDigestValue(
    row.panelEvidenceDigest,
    `${path}.panelEvidenceDigest`,
  );
  const preparedPanel = intrinsicRealBuildFreeze({
    stepNumber,
    pageNumber,
    ...panelBounds,
    calloutBoxes: intrinsicRealBuildFreeze(calloutBoxes),
    panelEvidenceDigest,
  });
  const reproducedPanelDigest = stepPanelEvidenceDigest({
    pdfDigest,
    stepNumber,
    pageNumber,
    bounds: panelBounds,
    calloutBoxes,
  });
  if (panelEvidenceDigest !== reproducedPanelDigest) {
    throw new TypeError(
      `${path}.panelEvidenceDigest does not reproduce from PDF/page/panel facts.`,
    );
  }
  const highWidth = 1_000;
  const highHeight = Math.max(
    1,
    Math.round(
      ((panelBounds.maxYPt - panelBounds.minYPt) * 1_000) /
        (panelBounds.maxXPt - panelBounds.minXPt),
    ),
  );
  const highPixels = highWidth * highHeight;
  const workWidth = Math.ceil(highWidth / 2);
  const workHeight = Math.ceil(highHeight / 2);
  const workPixels = workWidth * workHeight;
  if (
    row.highWidth !== highWidth ||
    row.highHeight !== highHeight ||
    row.highPixelCount !== highPixels ||
    row.workWidth !== workWidth ||
    row.workHeight !== workHeight ||
    row.workPixelCount !== workPixels ||
    row.workFactor !== 2
  ) {
    throw new TypeError(`${path} raster geometry does not reproduce from exact prepared bounds.`);
  }
  const maskBytes = Math.ceil(highPixels / 8) + 7 * Math.ceil(workPixels / 8);
  const activeBytes = sourceEvidenceActiveBytes(highPixels, workPixels, maskBytes);
  if (activeBytes > MAXIMUM_REAL_BUILD_BROWSER_OUTPUT_V4_SOURCE_EVIDENCE_ACTIVE_BYTES) {
    throw new RangeError(`${path} exceeds the 64 MiB active derivation bound.`);
  }
  const roles = parseRoles(row.roles, [highPixels * 4, workPixels * 4, maskBytes], `${path}.roles`);
  const highRgba = parseRgbaReference(
    row.highRgba,
    "source-high-rgba8",
    highPixels * 4,
    roles[0]!.digest,
    `${path}.highRgba`,
  );
  const workRgba = parseRgbaReference(
    row.workRgba,
    "source-work-rgba8",
    workPixels * 4,
    roles[1]!.digest,
    `${path}.workRgba`,
  );
  const masks = parseMasks(
    row.masks,
    highWidth,
    highHeight,
    workWidth,
    workHeight,
    maskBytes,
    `${path}.masks`,
  );
  const cropDescriptorDigest = sourceEvidenceDigestValue(
    row.cropDescriptorDigest,
    `${path}.cropDescriptorDigest`,
  );
  const reproducedCrop = canonicalDigest({
    schemaVersion: "lego.real-build-calibration-crop/1",
    panel: preparedPanel,
    highWidth,
    highHeight,
  });
  if (cropDescriptorDigest !== reproducedCrop) {
    throw new TypeError(`${path}.cropDescriptorDigest does not reproduce.`);
  }
  return intrinsicRealBuildFreeze({
    ...preparedPanel,
    cropDescriptorDigest,
    highWidth,
    highHeight,
    highPixelCount: highPixels,
    workWidth,
    workHeight,
    workPixelCount: workPixels,
    workFactor: 2 as const,
    roles,
    highRgba,
    workRgba,
    masks,
    workPixelsDigest: sourceEvidenceDigestValue(row.workPixelsDigest, `${path}.workPixelsDigest`),
    policyDescriptorDigest: sourceEvidenceDigestValue(
      row.policyDescriptorDigest,
      `${path}.policyDescriptorDigest`,
    ),
    derivationDescriptorDigest: sourceEvidenceDigestValue(
      row.derivationDescriptorDigest,
      `${path}.derivationDescriptorDigest`,
    ),
    assemblyMaskDigest: sourceEvidenceDigestValue(
      row.assemblyMaskDigest,
      `${path}.assemblyMaskDigest`,
    ),
    ownPanel: parseMode(
      row.ownPanel,
      true,
      `${path}.ownPanel`,
    ) as RealBuildBrowserOutputV4SourceEvidencePanel["ownPanel"],
    lookahead: parseMode(
      row.lookahead,
      false,
      `${path}.lookahead`,
    ) as RealBuildBrowserOutputV4SourceEvidencePanel["lookahead"],
  });
}
