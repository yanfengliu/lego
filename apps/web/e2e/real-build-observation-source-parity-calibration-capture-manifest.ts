import {
  canonicalDigest,
  deepFreeze,
  sha256Hex,
  type Sha256Digest,
} from "@lego-studio/brick-kernel";

import { REAL_BUILD_SOURCE_PARITY_CALIBRATION_PANEL_PAGES } from "./real-build-observation-source-parity-calibration-contract";
import {
  REAL_BUILD_SOURCE_PARITY_MAXIMUM_PDF_BYTES,
  REAL_BUILD_SOURCE_PARITY_MAXIMUM_PIXELS,
  realBuildSourceParityPreparedPanelsManifest,
  realBuildSourceParityWorkGeometry,
} from "./real-build-observation-source-parity-contract";
import {
  MAXIMUM_REAL_BUILD_SOURCE_PARITY_CALIBRATION_CAPTURE_HIGH_RGBA_BYTES,
  MAXIMUM_REAL_BUILD_SOURCE_PARITY_CALIBRATION_BROWSER_CAPTURE_BYTES,
  MAXIMUM_REAL_BUILD_SOURCE_PARITY_CALIBRATION_CAPTURE_PNG_BYTES,
  MAXIMUM_REAL_BUILD_SOURCE_PARITY_CALIBRATION_CAPTURE_STAGE_BYTES,
  MAXIMUM_REAL_BUILD_SOURCE_PARITY_CALIBRATION_CAPTURE_STAGE_MANIFEST_BYTES,
  MAXIMUM_REAL_BUILD_SOURCE_PARITY_CALIBRATION_CAPTURE_W_BYTES,
  MAXIMUM_REAL_BUILD_SOURCE_PARITY_CALIBRATION_CAPTURE_WORK_RGBA_BYTES,
  REAL_BUILD_SOURCE_PARITY_CALIBRATION_CAPTURE_AUTHORITY,
  REAL_BUILD_SOURCE_PARITY_CALIBRATION_CAPTURE_ROLE_ENCODINGS,
  REAL_BUILD_SOURCE_PARITY_CALIBRATION_CAPTURE_ROLES,
  REAL_BUILD_SOURCE_PARITY_CALIBRATION_CAPTURE_SCHEMA,
  type RealBuildSourceParityCalibrationCaptureManifest,
  type RealBuildSourceParityCalibrationCapturePanel,
  type RealBuildSourceParityCalibrationCaptureRoleDescriptor,
} from "./real-build-observation-source-parity-calibration-capture-types";
import {
  denseCaptureArray,
  captureInteger,
  describeCaptureValue,
  exactCaptureRecord,
  requireCaptureDigest,
} from "./real-build-observation-source-parity-calibration-capture-structure";
import {
  parseCaptureBounds,
  parseCaptureByteReference,
  parseCaptureCallouts,
  parseCapturePackedMaskReference,
  parseCapturePairwise,
  parseCapturePngReference,
  requireCaptureHighGeometry,
  parseCaptureStageReference,
} from "./real-build-observation-source-parity-calibration-capture-values";
import { stepPanelEvidenceDigest } from "./real-build-ledger";

const ROLE_MAXIMUMS = Object.freeze({
  "calibration-high-rgba8": MAXIMUM_REAL_BUILD_SOURCE_PARITY_CALIBRATION_CAPTURE_HIGH_RGBA_BYTES,
  "calibration-work-rgba8": MAXIMUM_REAL_BUILD_SOURCE_PARITY_CALIBRATION_CAPTURE_WORK_RGBA_BYTES,
  "calibration-stage-manifest-json":
    MAXIMUM_REAL_BUILD_SOURCE_PARITY_CALIBRATION_CAPTURE_STAGE_MANIFEST_BYTES,
  "calibration-stage-packed-msb": MAXIMUM_REAL_BUILD_SOURCE_PARITY_CALIBRATION_CAPTURE_STAGE_BYTES,
  "calibration-w-packed-msb": MAXIMUM_REAL_BUILD_SOURCE_PARITY_CALIBRATION_CAPTURE_W_BYTES,
});
function parseAuthority(
  value: unknown,
): typeof REAL_BUILD_SOURCE_PARITY_CALIBRATION_CAPTURE_AUTHORITY {
  const authority = exactCaptureRecord(
    value,
    ["status", "authorized", "reason"],
    "calibrationCapture.authority",
  );
  if (
    authority.status !== "absent" ||
    authority.authorized !== false ||
    authority.reason !== "pending-human-review/1"
  ) {
    throw new TypeError(
      `calibrationCapture.authority observed ${describeCaptureValue(authority.status)}/${describeCaptureValue(authority.authorized)}/${describeCaptureValue(authority.reason)}; expected absent/false/pending-human-review/1.`,
    );
  }
  return REAL_BUILD_SOURCE_PARITY_CALIBRATION_CAPTURE_AUTHORITY;
}

function parseRoles(
  value: unknown,
): readonly RealBuildSourceParityCalibrationCaptureRoleDescriptor[] {
  return Object.freeze(
    denseCaptureArray(
      value,
      REAL_BUILD_SOURCE_PARITY_CALIBRATION_CAPTURE_ROLES.length,
      "calibrationCapture.roles",
    ).map((candidate, index) => {
      const path = `calibrationCapture.roles[${index}]`;
      const row = exactCaptureRecord(
        candidate,
        ["role", "contentEncoding", "byteLength", "digest"],
        path,
      );
      const role = REAL_BUILD_SOURCE_PARITY_CALIBRATION_CAPTURE_ROLES[index]!;
      const contentEncoding = REAL_BUILD_SOURCE_PARITY_CALIBRATION_CAPTURE_ROLE_ENCODINGS[role];
      if (row.role !== role) {
        throw new TypeError(
          `${path}.role observed ${describeCaptureValue(row.role)}; expected ${role}.`,
        );
      }
      if (row.contentEncoding !== contentEncoding) {
        throw new TypeError(
          `${path}.contentEncoding observed ${describeCaptureValue(row.contentEncoding)}; expected ${contentEncoding}.`,
        );
      }
      return Object.freeze({
        role,
        contentEncoding,
        byteLength: captureInteger(row.byteLength, 1, ROLE_MAXIMUMS[role], `${path}.byteLength`),
        digest: requireCaptureDigest(row.digest, `${path}.digest`),
      });
    }),
  );
}

function parsePanel(
  value: unknown,
  index: number,
  pdfDigest: Sha256Digest,
): RealBuildSourceParityCalibrationCapturePanel {
  const path = `calibrationCapture.panels[${index}]`;
  const row = exactCaptureRecord(
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
      "highWidth",
      "highHeight",
      "highPixelCount",
      "workWidth",
      "workHeight",
      "workPixelCount",
      "workFactor",
      "highRgba",
      "workRgba",
      "stageTracePanelIndex",
      "pMask",
      "dMask",
      "wMask",
      "candidatePolicyDigest",
      "candidateDerivationDigest",
      "pairwisePdw",
      "highPng",
      "workPng",
    ],
    path,
  );
  const identity = REAL_BUILD_SOURCE_PARITY_CALIBRATION_PANEL_PAGES[index]!;
  if (row.stepNumber !== identity.stepNumber || row.pageNumber !== identity.pageNumber) {
    throw new TypeError(
      `${path} observed step/page ${describeCaptureValue(row.stepNumber)}/${describeCaptureValue(row.pageNumber)}; expected ${identity.stepNumber}/${identity.pageNumber}.`,
    );
  }
  const bounds = parseCaptureBounds(
    {
      minXPt: row.minXPt,
      maxXPt: row.maxXPt,
      minYPt: row.minYPt,
      maxYPt: row.maxYPt,
    },
    `${path}.bounds`,
  );
  const calloutBoxes = parseCaptureCallouts(row.calloutBoxes, `${path}.calloutBoxes`);
  const panelEvidenceDigest = requireCaptureDigest(
    row.panelEvidenceDigest,
    `${path}.panelEvidenceDigest`,
  );
  const reproducedPanelDigest = stepPanelEvidenceDigest({
    pdfDigest,
    stepNumber: identity.stepNumber,
    pageNumber: identity.pageNumber,
    bounds,
    calloutBoxes,
  });
  if (panelEvidenceDigest !== reproducedPanelDigest) {
    throw new TypeError(
      `${path}.panelEvidenceDigest observed ${panelEvidenceDigest}; exact PDF/page/bounds/callouts reproduce ${reproducedPanelDigest}.`,
    );
  }
  const highWidth = captureInteger(row.highWidth, 1, 4_194_304, `${path}.highWidth`);
  const highHeight = captureInteger(row.highHeight, 1, 4_194_304, `${path}.highHeight`);
  requireCaptureHighGeometry(bounds, highWidth, highHeight, path);
  const highPixelCount = highWidth * highHeight;
  if (
    !Number.isSafeInteger(highPixelCount) ||
    highPixelCount > 4_194_304 ||
    row.highPixelCount !== highPixelCount
  ) {
    throw new RangeError(
      `${path}.highPixelCount observed ${describeCaptureValue(row.highPixelCount)}; ${highWidth}x${highHeight} requires 1..4194304 and exactly ${highPixelCount}.`,
    );
  }
  const workWidth = captureInteger(
    row.workWidth,
    1,
    REAL_BUILD_SOURCE_PARITY_MAXIMUM_PIXELS,
    `${path}.workWidth`,
  );
  const workHeight = captureInteger(
    row.workHeight,
    1,
    REAL_BUILD_SOURCE_PARITY_MAXIMUM_PIXELS,
    `${path}.workHeight`,
  );
  const workPixelCount = workWidth * workHeight;
  if (
    !Number.isSafeInteger(workPixelCount) ||
    workPixelCount > REAL_BUILD_SOURCE_PARITY_MAXIMUM_PIXELS ||
    row.workPixelCount !== workPixelCount
  ) {
    throw new RangeError(
      `${path}.workPixelCount observed ${describeCaptureValue(row.workPixelCount)}; ${workWidth}x${workHeight} requires 1..${REAL_BUILD_SOURCE_PARITY_MAXIMUM_PIXELS} and exactly ${workPixelCount}.`,
    );
  }
  if (
    row.workFactor !== 2 ||
    workWidth !== Math.ceil(highWidth / 2) ||
    workHeight !== Math.ceil(highHeight / 2)
  ) {
    throw new RangeError(
      `${path} observed high/work ${highWidth}x${highHeight}/${workWidth}x${workHeight} factor ${describeCaptureValue(row.workFactor)}; expected exact factor-2 ceiling dimensions.`,
    );
  }
  const expectedWork = realBuildSourceParityWorkGeometry(bounds);
  if (workWidth !== expectedWork.width || workHeight !== expectedWork.height) {
    throw new RangeError(
      `${path} work raster observed ${workWidth}x${workHeight}; prepared bounds require ${expectedWork.width}x${expectedWork.height}.`,
    );
  }
  const highRgba = parseCaptureByteReference(
    row.highRgba,
    "calibration-high-rgba8",
    MAXIMUM_REAL_BUILD_SOURCE_PARITY_CALIBRATION_CAPTURE_HIGH_RGBA_BYTES,
    `${path}.highRgba`,
  );
  if (highRgba.byteLength !== highPixelCount * 4) {
    throw new RangeError(
      `${path}.highRgba.byteLength observed ${highRgba.byteLength}; ${highWidth}x${highHeight} RGBA8 requires ${highPixelCount * 4}.`,
    );
  }
  const workRgba = parseCaptureByteReference(
    row.workRgba,
    "calibration-work-rgba8",
    MAXIMUM_REAL_BUILD_SOURCE_PARITY_CALIBRATION_CAPTURE_WORK_RGBA_BYTES,
    `${path}.workRgba`,
  );
  if (workRgba.byteLength !== workPixelCount * 4) {
    throw new RangeError(
      `${path}.workRgba.byteLength observed ${workRgba.byteLength}; ${workWidth}x${workHeight} RGBA8 requires ${workPixelCount * 4}.`,
    );
  }
  const highPng = parseCapturePngReference(
    row.highPng,
    highWidth,
    highHeight,
    MAXIMUM_REAL_BUILD_SOURCE_PARITY_CALIBRATION_CAPTURE_PNG_BYTES,
    `${path}.highPng`,
  );
  if (highPng.rgbaDigest !== highRgba.digest) {
    throw new TypeError(
      `${path}.highPng.rgbaDigest observed ${highPng.rgbaDigest}; the exact high RGBA slice declares ${highRgba.digest}.`,
    );
  }
  const workPng = parseCapturePngReference(
    row.workPng,
    workWidth,
    workHeight,
    MAXIMUM_REAL_BUILD_SOURCE_PARITY_CALIBRATION_CAPTURE_PNG_BYTES,
    `${path}.workPng`,
  );
  if (workPng.rgbaDigest !== workRgba.digest) {
    throw new TypeError(
      `${path}.workPng.rgbaDigest observed ${workPng.rgbaDigest}; the exact work RGBA slice declares ${workRgba.digest}.`,
    );
  }
  const pairwise = denseCaptureArray(row.pairwisePdw, 3, `${path}.pairwisePdw`);
  return deepFreeze({
    stepNumber: identity.stepNumber,
    pageNumber: identity.pageNumber,
    ...bounds,
    calloutBoxes,
    panelEvidenceDigest,
    highWidth,
    highHeight,
    highPixelCount,
    workWidth,
    workHeight,
    workPixelCount,
    workFactor: 2 as const,
    highRgba,
    workRgba,
    stageTracePanelIndex: captureInteger(
      row.stageTracePanelIndex,
      index,
      index,
      `${path}.stageTracePanelIndex`,
    ),
    pMask: parseCaptureStageReference(
      row.pMask,
      "isolate-then-downsample",
      workWidth,
      workHeight,
      `${path}.pMask`,
    ),
    dMask: parseCaptureStageReference(
      row.dMask,
      "downsample-then-isolate",
      workWidth,
      workHeight,
      `${path}.dMask`,
    ),
    wMask: parseCapturePackedMaskReference(row.wMask, workWidth, workHeight, `${path}.wMask`),
    candidatePolicyDigest: requireCaptureDigest(
      row.candidatePolicyDigest,
      `${path}.candidatePolicyDigest`,
    ),
    candidateDerivationDigest: requireCaptureDigest(
      row.candidateDerivationDigest,
      `${path}.candidateDerivationDigest`,
    ),
    pairwisePdw: Object.freeze([
      parseCapturePairwise(pairwise[0], "P", "D", workPixelCount, `${path}.pairwisePdw[0]`),
      parseCapturePairwise(pairwise[1], "P", "W", workPixelCount, `${path}.pairwisePdw[1]`),
      parseCapturePairwise(pairwise[2], "D", "W", workPixelCount, `${path}.pairwisePdw[2]`),
    ]),
    highPng,
    workPng,
  });
}

function assertContiguousReferences(
  panels: readonly RealBuildSourceParityCalibrationCapturePanel[],
  roles: readonly RealBuildSourceParityCalibrationCaptureRoleDescriptor[],
): void {
  for (const [field, roleIndex] of [
    ["highRgba", 0],
    ["workRgba", 1],
    ["wMask", 4],
  ] as const) {
    let offset = 0;
    for (const panel of panels) {
      const reference = panel[field];
      if (reference.offset !== offset) {
        throw new RangeError(
          `Calibration capture step ${panel.stepNumber} ${field}.offset observed ${reference.offset}; expected contiguous offset ${offset}.`,
        );
      }
      offset += reference.byteLength;
    }
    if (offset !== roles[roleIndex]!.byteLength) {
      throw new RangeError(
        `Calibration capture ${field} slices cover ${offset} bytes; role ${roles[roleIndex]!.role} declares ${roles[roleIndex]!.byteLength}.`,
      );
    }
  }
  const stageBytes = roles[3]!.byteLength;
  for (const panel of panels) {
    for (const [label, reference] of [
      ["P", panel.pMask],
      ["D", panel.dMask],
    ] as const) {
      const end = reference.offset + reference.bytes;
      if (!Number.isSafeInteger(end) || end > stageBytes) {
        throw new RangeError(
          `Calibration capture step ${panel.stepNumber} ${label} requests stage bytes ${reference.offset} through ${String(end)}; calibration-stage-packed-msb declares ${stageBytes}.`,
        );
      }
    }
  }
}

export function parseRealBuildSourceParityCalibrationCaptureManifest(
  value: unknown,
): RealBuildSourceParityCalibrationCaptureManifest {
  const root = exactCaptureRecord(
    value,
    [
      "schemaVersion",
      "authority",
      "reviewState",
      "pdfDigest",
      "pdfBytes",
      "fullPreparedPanelsDigest",
      "calibrationPreparedPanelsDigest",
      "calibrationDigest",
      "browserCaptureDigest",
      "browserCaptureBytes",
      "roles",
      "panels",
    ],
    "calibrationCapture",
  );
  if (root.schemaVersion !== REAL_BUILD_SOURCE_PARITY_CALIBRATION_CAPTURE_SCHEMA) {
    throw new TypeError(
      `calibrationCapture.schemaVersion observed ${describeCaptureValue(root.schemaVersion)}; expected ${REAL_BUILD_SOURCE_PARITY_CALIBRATION_CAPTURE_SCHEMA}.`,
    );
  }
  if (root.reviewState !== "pending-unreviewed") {
    throw new TypeError(
      `calibrationCapture.reviewState observed ${describeCaptureValue(root.reviewState)}; expected pending-unreviewed.`,
    );
  }
  const pdfDigest = requireCaptureDigest(root.pdfDigest, "calibrationCapture.pdfDigest");
  const pdfBytes = captureInteger(
    root.pdfBytes,
    1,
    REAL_BUILD_SOURCE_PARITY_MAXIMUM_PDF_BYTES,
    "calibrationCapture.pdfBytes",
  );
  const fullPreparedPanelsDigest = requireCaptureDigest(
    root.fullPreparedPanelsDigest,
    "calibrationCapture.fullPreparedPanelsDigest",
  );
  const calibrationPreparedPanelsDigest = requireCaptureDigest(
    root.calibrationPreparedPanelsDigest,
    "calibrationCapture.calibrationPreparedPanelsDigest",
  );
  const roles = parseRoles(root.roles);
  const panels = Object.freeze(
    denseCaptureArray(root.panels, 5, "calibrationCapture.panels").map((panel, index) =>
      parsePanel(panel, index, pdfDigest),
    ),
  );
  const declaredPngBytes = panels.reduce(
    (total, panel) => total + panel.highPng.byteLength + panel.workPng.byteLength,
    0,
  );
  if (declaredPngBytes > MAXIMUM_REAL_BUILD_SOURCE_PARITY_CALIBRATION_CAPTURE_PNG_BYTES) {
    throw new RangeError(
      `calibrationCapture.panels declare ${declaredPngBytes} aggregate PNG bytes; expected at most ${MAXIMUM_REAL_BUILD_SOURCE_PARITY_CALIBRATION_CAPTURE_PNG_BYTES} before PNG attachment access.`,
    );
  }
  assertContiguousReferences(panels, roles);
  const subsetDigest = `sha256:${sha256Hex(
    JSON.stringify(realBuildSourceParityPreparedPanelsManifest(pdfDigest, panels)),
  )}` as Sha256Digest;
  if (subsetDigest !== calibrationPreparedPanelsDigest) {
    throw new TypeError(
      `calibrationCapture.calibrationPreparedPanelsDigest observed ${calibrationPreparedPanelsDigest}; exact five prepared rows reproduce ${subsetDigest}.`,
    );
  }
  const contractBase = {
    schemaVersion: "lego.real-build-observation-source-parity-calibration-contract/1" as const,
    authority: "absent" as const,
    pdfDigest,
    fullPreparedPanelsDigest,
    calibrationPreparedPanelsDigest,
    panels: panels.map(({ stepNumber, pageNumber, workWidth, workHeight, workPixelCount }) => ({
      stepNumber,
      pageNumber,
      width: workWidth,
      height: workHeight,
      pixelCount: workPixelCount,
      workFactor: 2 as const,
    })),
  };
  const calibrationDigest = requireCaptureDigest(
    root.calibrationDigest,
    "calibrationCapture.calibrationDigest",
  );
  const reproducedCalibrationDigest = canonicalDigest(contractBase);
  if (calibrationDigest !== reproducedCalibrationDigest) {
    throw new TypeError(
      `calibrationCapture.calibrationDigest observed ${calibrationDigest}; bound PDF/full/subset/panel contract reproduces ${reproducedCalibrationDigest}.`,
    );
  }
  return deepFreeze({
    schemaVersion: REAL_BUILD_SOURCE_PARITY_CALIBRATION_CAPTURE_SCHEMA,
    authority: parseAuthority(root.authority),
    reviewState: "pending-unreviewed" as const,
    pdfDigest,
    pdfBytes,
    fullPreparedPanelsDigest,
    calibrationPreparedPanelsDigest,
    calibrationDigest,
    browserCaptureDigest: requireCaptureDigest(
      root.browserCaptureDigest,
      "calibrationCapture.browserCaptureDigest",
    ),
    browserCaptureBytes: captureInteger(
      root.browserCaptureBytes,
      2,
      MAXIMUM_REAL_BUILD_SOURCE_PARITY_CALIBRATION_BROWSER_CAPTURE_BYTES,
      "calibrationCapture.browserCaptureBytes",
    ),
    roles,
    panels,
  });
}
