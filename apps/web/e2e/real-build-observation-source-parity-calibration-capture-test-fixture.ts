import { Buffer } from "node:buffer";
import { deflateSync } from "node:zlib";

import { canonicalDigest, sha256Hex, type Sha256Digest } from "@lego-studio/brick-kernel";

import { downsampleRaster } from "../src/assembly/panel-art";
import { derivePanelArtStages } from "../src/assembly/panel-art-stages";
import { packRealBuildCompiledBinaryMaskMsb } from "./real-build-compiled-observation-registration";
import {
  deriveRealBuildObservationSourceRasterCandidate,
  unpackRealBuildObservationSourceRasterCandidateMask,
} from "./real-build-observation-source-raster-candidate";
import { createRealBuildObservationSourceStageTrace } from "./real-build-observation-source-stage-trace-trace";
import {
  realBuildSourceParityPreparedPanelsManifest,
  realBuildSourceParityWorkGeometry,
} from "./real-build-observation-source-parity-contract";
import { REAL_BUILD_SOURCE_PARITY_CALIBRATION_PANEL_PAGES } from "./real-build-observation-source-parity-calibration-selection";
import {
  REAL_BUILD_SOURCE_PARITY_CALIBRATION_BROWSER_CAPTURE_SCHEMA,
  REAL_BUILD_SOURCE_PARITY_CALIBRATION_CAPTURE_AUTHORITY,
  REAL_BUILD_SOURCE_PARITY_CALIBRATION_CAPTURE_ROLE_ENCODINGS,
  REAL_BUILD_SOURCE_PARITY_CALIBRATION_CAPTURE_ROLES,
  type RealBuildSourceParityCalibrationBrowserCaptureWire,
  type RealBuildSourceParityCalibrationCaptureRole,
} from "./real-build-observation-source-parity-calibration-capture-types";
import { stepPanelEvidenceDigest } from "./real-build-ledger";

export const calibrationCaptureTestDigest = (value: Uint8Array | string): Sha256Digest =>
  `sha256:${sha256Hex(value)}`;

const crcTable = (() => {
  const result = new Uint32Array(256);
  for (let value = 0; value < result.length; value += 1) {
    let crc = value;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc & 1) === 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
    }
    result[value] = crc >>> 0;
  }
  return result;
})();

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = crcTable[(crc ^ byte) & 0xff]! ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Uint8Array): Buffer {
  const result = Buffer.alloc(12 + data.length);
  result.writeUInt32BE(data.length, 0);
  result.write(type, 4, "ascii");
  result.set(data, 8);
  result.writeUInt32BE(crc32(result.subarray(4, 8 + data.length)), 8 + data.length);
  return result;
}

export function encodeCalibrationCaptureTestPng(
  rgba: Uint8Array,
  width: number,
  height: number,
): Uint8Array {
  const raw = Buffer.alloc(height * (width * 4 + 1));
  for (let y = 0; y < height; y += 1) {
    const offset = y * (width * 4 + 1);
    raw[offset] = 0;
    raw.set(rgba.subarray(y * width * 4, (y + 1) * width * 4), offset + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return encodeCalibrationCaptureTestPngChunks(ihdr, [deflateSync(raw)]);
}

function encodeCalibrationCaptureTestPngChunks(
  ihdr: Uint8Array,
  idat: readonly Uint8Array[],
): Uint8Array {
  return new Uint8Array(
    Buffer.concat([
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
      pngChunk("IHDR", ihdr),
      ...idat.map((piece) => pngChunk("IDAT", piece)),
      pngChunk("IEND", Buffer.alloc(0)),
    ]),
  );
}

export function encodeCalibrationCaptureSplitIdatTestPng(idatChunks: number): Uint8Array {
  if (!Number.isSafeInteger(idatChunks) || idatChunks < 1) {
    throw new RangeError(`Split PNG fixture requires a positive IDAT chunk count.`);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(1, 0);
  ihdr.writeUInt32BE(1, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const compressed = deflateSync(Buffer.from([0, 0x89, 0x90, 0x93, 0xff]));
  return encodeCalibrationCaptureTestPngChunks(ihdr, [
    compressed,
    ...Array.from({ length: idatChunks - 1 }, () => new Uint8Array()),
  ]);
}

function concatenate(values: readonly Uint8Array[]): {
  readonly bytes: Uint8Array;
  readonly offsets: readonly number[];
} {
  const offsets: number[] = [];
  let length = 0;
  values.forEach((value) => {
    offsets.push(length);
    length += value.length;
  });
  const bytes = new Uint8Array(length);
  values.forEach((value, index) => bytes.set(value, offsets[index]!));
  return { bytes, offsets };
}

function pairwise(left: "P" | "D", right: "D" | "W", a: Uint8Array, b: Uint8Array) {
  const xor = new Uint8Array(a.length);
  let differingPixels = 0;
  let intersectionPixels = 0;
  let unionPixels = 0;
  a.forEach((value, index) => {
    const other = b[index]!;
    if (value !== other) {
      xor[index] = 1;
      differingPixels += 1;
    }
    if (value === 1 && other === 1) intersectionPixels += 1;
    if (value === 1 || other === 1) unionPixels += 1;
  });
  return {
    left,
    right,
    differingPixels,
    intersectionPixels,
    unionPixels,
    iou: unionPixels === 0 ? 1 : intersectionPixels / unionPixels,
    xorDigest: calibrationCaptureTestDigest(xor),
  };
}

function rgba(width: number, height: number): Uint8ClampedArray {
  const bytes = new Uint8ClampedArray(width * height * 4);
  for (let pixel = 0; pixel < width * height; pixel += 1) {
    bytes.set([0x89, 0x90, 0x93, 0xff], pixel * 4);
  }
  // B is four high pixels but becomes the first two-pixel work component. A is
  // five high pixels and therefore wins H, yet also samples to two work pixels.
  // Thus P selects A while D and independently-derived W select B: all masks
  // are non-empty and the retained pairwise bindings exercise real differences.
  for (const [start, end] of [
    [0, 3],
    [101, 105],
  ] as const) {
    for (let x = start; x <= end; x += 1) bytes.set([0x20, 0x20, 0x20, 0xff], x * 4);
  }
  return bytes;
}

const byteView = (value: Uint8ClampedArray): Uint8Array =>
  new Uint8Array(value.buffer, value.byteOffset, value.byteLength);

export function createCalibrationCaptureTestWire(): RealBuildSourceParityCalibrationBrowserCaptureWire {
  const pdfDigest = calibrationCaptureTestDigest("calibration-pdf");
  const bounds = { minXPt: 0, maxXPt: 1_000, minYPt: 0, maxYPt: 1 };
  const pageByStep = new Map<number, number>(
    REAL_BUILD_SOURCE_PARITY_CALIBRATION_PANEL_PAGES.map(({ stepNumber, pageNumber }) => [
      stepNumber,
      pageNumber,
    ]),
  );
  const fullPanels = Array.from({ length: 359 }, (_, index) => {
    const stepNumber = index + 1;
    const pageNumber = pageByStep.get(stepNumber) ?? stepNumber;
    return {
      stepNumber,
      pageNumber,
      ...bounds,
      calloutBoxes: [],
      panelEvidenceDigest: stepPanelEvidenceDigest({
        pdfDigest,
        stepNumber,
        pageNumber,
        bounds,
        calloutBoxes: [],
      }) as Sha256Digest,
    };
  });
  const panels = REAL_BUILD_SOURCE_PARITY_CALIBRATION_PANEL_PAGES.map(
    ({ stepNumber }) => fullPanels[stepNumber - 1]!,
  );
  const fullPreparedPanelsDigest = calibrationCaptureTestDigest(
    JSON.stringify(realBuildSourceParityPreparedPanelsManifest(pdfDigest, fullPanels)),
  );
  const calibrationPreparedPanelsDigest = calibrationCaptureTestDigest(
    JSON.stringify(realBuildSourceParityPreparedPanelsManifest(pdfDigest, panels)),
  );
  const geometry = realBuildSourceParityWorkGeometry(bounds);
  const high = rgba(1_000, 1);
  const stages = derivePanelArtStages({
    raster: { width: 1_000, height: 1, pixels: high },
    workFactor: 2,
    backgroundHex: 0x899093,
    backgroundToleranceLevels: 10,
    calloutRectangles: [],
  });
  const work = downsampleRaster({ width: 1_000, height: 1, pixels: high }, 2).pixels;
  const candidate = deriveRealBuildObservationSourceRasterCandidate(
    geometry.width,
    geometry.height,
    2,
    work,
    bounds.minXPt,
    bounds.maxXPt,
    bounds.minYPt,
    bounds.maxYPt,
    new Float64Array(),
  );
  const wMask = unpackRealBuildObservationSourceRasterCandidateMask(candidate.assemblyMask);
  const pMask = stages.isolateThenDownsampleMask;
  const dMask = stages.downsampleThenIsolateMask;
  if (
    !pMask.includes(1) ||
    !dMask.includes(1) ||
    !wMask.includes(1) ||
    pMask.every((value, index) => value === dMask[index]) ||
    pMask.every((value, index) => value === wMask[index])
  ) {
    throw new Error("Calibration capture fixture must retain non-empty, differing P/D/W masks.");
  }
  const stageTrace = createRealBuildObservationSourceStageTrace(
    panels.map((panel) => ({
      stepNumber: panel.stepNumber,
      pageNumber: panel.pageNumber,
      source: {
        schemaVersion: "lego.real-build-observation-source-stage-opaque-provenance/1" as const,
        reproduction: "not-claimed" as const,
        pdfDigest,
        panelEvidenceDigest: panel.panelEvidenceDigest,
        cropDescriptorDigest: canonicalDigest({
          schemaVersion: "lego.real-build-calibration-crop/1",
          panel,
          highWidth: stages.width,
          highHeight: stages.height,
        }),
        policyDescriptorDigest: candidate.policyDescriptorDigest,
        workPixelsDigest: candidate.workPixelsDigest,
      },
      stages,
    })),
  );
  const highRole = concatenate(panels.map(() => new Uint8Array(high)));
  const workRole = concatenate(panels.map(() => new Uint8Array(work)));
  const packedW = packRealBuildCompiledBinaryMaskMsb(wMask, geometry.width, geometry.height);
  const wRole = concatenate(panels.map(() => packedW));
  const stageManifestBytes = stageTrace.readManifestBytes();
  const stageBytes = stageTrace.readRoleBytes();
  const roleBytes = new Map<RealBuildSourceParityCalibrationCaptureRole, Uint8Array>([
    ["calibration-high-rgba8", highRole.bytes],
    ["calibration-work-rgba8", workRole.bytes],
    ["calibration-stage-manifest-json", stageManifestBytes],
    ["calibration-stage-packed-msb", stageBytes],
    ["calibration-w-packed-msb", wRole.bytes],
  ]);
  const highPng = encodeCalibrationCaptureTestPng(byteView(high), stages.width, stages.height);
  const workPng = encodeCalibrationCaptureTestPng(byteView(work), geometry.width, geometry.height);
  const calibrationDigest = canonicalDigest({
    schemaVersion: "lego.real-build-observation-source-parity-calibration-contract/1",
    authority: "absent",
    pdfDigest,
    fullPreparedPanelsDigest,
    calibrationPreparedPanelsDigest,
    panels: panels.map(({ stepNumber, pageNumber }) => ({
      stepNumber,
      pageNumber,
      width: geometry.width,
      height: geometry.height,
      pixelCount: geometry.pixels,
      workFactor: 2,
    })),
  });
  return {
    schemaVersion: REAL_BUILD_SOURCE_PARITY_CALIBRATION_BROWSER_CAPTURE_SCHEMA,
    authority: REAL_BUILD_SOURCE_PARITY_CALIBRATION_CAPTURE_AUTHORITY,
    reviewState: "pending-unreviewed",
    pdfDigest,
    pdfBytes: 3,
    fullPreparedPanelsDigest,
    calibrationPreparedPanelsDigest,
    calibrationDigest,
    roles: REAL_BUILD_SOURCE_PARITY_CALIBRATION_CAPTURE_ROLES.map((role) => {
      const bytes = roleBytes.get(role)!;
      return {
        role,
        contentEncoding: REAL_BUILD_SOURCE_PARITY_CALIBRATION_CAPTURE_ROLE_ENCODINGS[role],
        byteLength: bytes.length,
        digest: calibrationCaptureTestDigest(bytes),
        transportEncoding: "base64/1",
        base64: Buffer.from(bytes).toString("base64"),
      };
    }),
    panels: panels.map((panel, index) => {
      const tracePanel = stageTrace.manifest.panels[index]!;
      const pMask = tracePanel.stages[5]!;
      const dMask = tracePanel.stages[6]!;
      return {
        ...panel,
        highWidth: stages.width,
        highHeight: stages.height,
        highPixelCount: stages.width * stages.height,
        workWidth: geometry.width,
        workHeight: geometry.height,
        workPixelCount: geometry.pixels,
        workFactor: 2,
        highRgba: {
          role: "calibration-high-rgba8",
          offset: highRole.offsets[index]!,
          byteLength: high.length,
          digest: calibrationCaptureTestDigest(byteView(high)),
        },
        workRgba: {
          role: "calibration-work-rgba8",
          offset: workRole.offsets[index]!,
          byteLength: work.length,
          digest: calibrationCaptureTestDigest(byteView(work)),
        },
        stageTracePanelIndex: index,
        pMask,
        dMask,
        wMask: {
          role: "calibration-w-packed-msb",
          contentEncoding: "packed-binary-mask-msb/1",
          offset: wRole.offsets[index]!,
          byteLength: packedW.length,
          digest: calibrationCaptureTestDigest(packedW),
          width: geometry.width,
          height: geometry.height,
          pixelCount: geometry.pixels,
          lowPaddingBits: (8 - (geometry.pixels & 7)) & 7,
          unpackedDigest: calibrationCaptureTestDigest(wMask),
        },
        candidatePolicyDigest: candidate.policyDescriptorDigest,
        candidateDerivationDigest: candidate.derivationDescriptorDigest,
        pairwisePdw: [
          pairwise("P", "D", stages.isolateThenDownsampleMask, stages.downsampleThenIsolateMask),
          pairwise("P", "W", stages.isolateThenDownsampleMask, wMask),
          pairwise("D", "W", stages.downsampleThenIsolateMask, wMask),
        ],
        highPng: {
          mediaType: "image/png",
          byteLength: highPng.length,
          digest: calibrationCaptureTestDigest(highPng),
          width: stages.width,
          height: stages.height,
          rgbaDigest: calibrationCaptureTestDigest(byteView(high)),
          transportEncoding: "data-url-base64/1",
          dataUrl: `data:image/png;base64,${Buffer.from(highPng).toString("base64")}`,
        },
        workPng: {
          mediaType: "image/png",
          byteLength: workPng.length,
          digest: calibrationCaptureTestDigest(workPng),
          width: geometry.width,
          height: geometry.height,
          rgbaDigest: calibrationCaptureTestDigest(byteView(work)),
          transportEncoding: "data-url-base64/1",
          dataUrl: `data:image/png;base64,${Buffer.from(workPng).toString("base64")}`,
        },
      };
    }),
  };
}
