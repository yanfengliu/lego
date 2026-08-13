import { canonicalDigest, sha256Hex, type Sha256Digest } from "@lego-studio/brick-kernel";

import {
  MAXIMUM_REAL_BUILD_SOURCE_PARITY_CALIBRATION_CAPTURE_HIGH_RGBA_BYTES,
  MAXIMUM_REAL_BUILD_SOURCE_PARITY_CALIBRATION_CAPTURE_PNG_BYTES,
  MAXIMUM_REAL_BUILD_SOURCE_PARITY_CALIBRATION_CAPTURE_STAGE_BYTES,
  MAXIMUM_REAL_BUILD_SOURCE_PARITY_CALIBRATION_CAPTURE_STAGE_MANIFEST_BYTES,
  MAXIMUM_REAL_BUILD_SOURCE_PARITY_CALIBRATION_CAPTURE_W_BYTES,
  MAXIMUM_REAL_BUILD_SOURCE_PARITY_CALIBRATION_CAPTURE_WORK_RGBA_BYTES,
  REAL_BUILD_SOURCE_PARITY_CALIBRATION_BROWSER_CAPTURE_SCHEMA,
  REAL_BUILD_SOURCE_PARITY_CALIBRATION_CAPTURE_AUTHORITY,
  REAL_BUILD_SOURCE_PARITY_CALIBRATION_CAPTURE_ROLE_ENCODINGS,
  REAL_BUILD_SOURCE_PARITY_CALIBRATION_CAPTURE_ROLES,
  type RealBuildSourceParityCalibrationBrowserCaptureWire,
  type RealBuildSourceParityCalibrationCaptureByteReference,
  type RealBuildSourceParityCalibrationCapturePackedMaskReference,
  type RealBuildSourceParityCalibrationCaptureRole,
  type RealBuildSourceParityCalibrationCaptureWirePng,
  type RealBuildSourceParityCalibrationCaptureWireRole,
} from "./real-build-observation-source-parity-calibration-capture-types";
import { REAL_BUILD_SOURCE_PARITY_CALIBRATION_PANEL_PAGES } from "./real-build-observation-source-parity-calibration-selection";
import type { RealBuildSourceParityCalibrationBrowserInput } from "./real-build-observation-source-parity-calibration-browser-input";
import type { RealBuildSourceParityCalibrationPanelCaptureInput } from "./real-build-observation-source-parity-calibration-browser-panel";
import { packRealBuildCompiledBinaryMaskMsb } from "./real-build-compiled-observation-registration";
import { createRealBuildObservationSourceStageTrace } from "./real-build-observation-source-stage-trace-trace";

const rawDigest = (bytes: Uint8Array): Sha256Digest => `sha256:${sha256Hex(bytes)}`;

export interface CreateRealBuildSourceParityCalibrationBrowserCaptureInput {
  readonly binding: Pick<
    RealBuildSourceParityCalibrationBrowserInput,
    | "expectedPdfDigest"
    | "expectedPdfBytes"
    | "fullPreparedPanelsDigest"
    | "calibrationPreparedPanelsDigest"
    | "calibrationDigest"
  >;
  readonly measurements: readonly RealBuildSourceParityCalibrationPanelCaptureInput[];
}

interface Piece {
  readonly bytes: Uint8Array;
  readonly digest: Sha256Digest;
  readonly offset: number;
}

interface PreflightBytePiece {
  readonly value: Uint8Array | Uint8ClampedArray;
  readonly byteLength: number;
}

const TYPED_ARRAY_PROTOTYPE = Object.getPrototypeOf(Uint8Array.prototype) as object;
const TYPED_ARRAY_BYTE_LENGTH = Object.getOwnPropertyDescriptor(
  TYPED_ARRAY_PROTOTYPE,
  "byteLength",
)!.get!;
const TYPED_ARRAY_BUFFER = Object.getOwnPropertyDescriptor(TYPED_ARRAY_PROTOTYPE, "buffer")!.get!;

function preflightBytePieces(
  pieces: readonly unknown[],
  expectedBytes: readonly number[],
  expectedPrototype: object,
  maximum: number,
  label: string,
): readonly PreflightBytePiece[] {
  if (pieces.length !== expectedBytes.length) {
    throw new RangeError(`${label} preflight received inconsistent piece and dimension counts.`);
  }
  let aggregate = 0;
  return pieces.map((value, index) => {
    const required = expectedBytes[index]!;
    if (!Number.isSafeInteger(required) || required < 1 || required > maximum) {
      throw new RangeError(
        `${label} row ${index} dimensions require ${String(required)} bytes; expected 1 through ${maximum} before typed-array access.`,
      );
    }
    let byteLength: number;
    let buffer: ArrayBufferLike;
    let prototype: object | null;
    try {
      byteLength = Reflect.apply(TYPED_ARRAY_BYTE_LENGTH, value, []) as number;
      buffer = Reflect.apply(TYPED_ARRAY_BUFFER, value, []) as ArrayBufferLike;
      prototype = Object.getPrototypeOf(value);
    } catch {
      throw new TypeError(
        `${label} row ${index} must be one exact intrinsic one-byte typed array, not a proxy or wrapper.`,
      );
    }
    if (prototype !== expectedPrototype) {
      throw new TypeError(`${label} row ${index} has the wrong typed-array prototype.`);
    }
    if (typeof SharedArrayBuffer !== "undefined" && buffer instanceof SharedArrayBuffer) {
      throw new TypeError(`${label} row ${index} must not use SharedArrayBuffer storage.`);
    }
    if (byteLength !== required) {
      throw new RangeError(
        `${label} row ${index} has ${byteLength} bytes; exact panel dimensions require ${required} before any role allocation or byte copy.`,
      );
    }
    const next = aggregate + byteLength;
    if (!Number.isSafeInteger(next) || next > maximum) {
      throw new RangeError(
        `${label} row ${index} raises aggregate bytes to ${String(next)}; expected at most ${maximum}.`,
      );
    }
    aggregate = next;
    return Object.freeze({
      value: value as Uint8Array | Uint8ClampedArray,
      byteLength,
    });
  });
}

function concatenate(
  pieces: readonly PreflightBytePiece[],
  label: string,
): { readonly bytes: Uint8Array; readonly refs: readonly Piece[] } {
  const length = pieces.reduce((total, piece) => total + piece.byteLength, 0);
  const bytes = new Uint8Array(length);
  const refs: Piece[] = [];
  let offset = 0;
  for (const [index, piece] of pieces.entries()) {
    try {
      Uint8Array.prototype.set.call(bytes, piece.value, offset);
    } catch {
      throw new TypeError(`${label} row ${index} bytes detached before their bounded copy.`);
    }
    const retained = bytes.subarray(offset, offset + piece.byteLength);
    refs.push({ bytes: retained, digest: rawDigest(retained), offset });
    offset += piece.byteLength;
  }
  return { bytes, refs };
}

function bytesToBase64(bytes: Uint8Array): string {
  const chunks: string[] = [];
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    chunks.push(
      String.fromCharCode(...bytes.subarray(offset, Math.min(offset + 0x8000, bytes.length))),
    );
  }
  return btoa(chunks.join(""));
}

function role(
  roleName: RealBuildSourceParityCalibrationCaptureRole,
  bytes: Uint8Array,
): RealBuildSourceParityCalibrationCaptureWireRole {
  return Object.freeze({
    role: roleName,
    contentEncoding: REAL_BUILD_SOURCE_PARITY_CALIBRATION_CAPTURE_ROLE_ENCODINGS[roleName],
    transportEncoding: "base64/1" as const,
    byteLength: bytes.length,
    digest: rawDigest(bytes),
    base64: bytesToBase64(bytes),
  });
}

function byteReference(
  roleName: "calibration-high-rgba8" | "calibration-work-rgba8",
  piece: Piece,
): RealBuildSourceParityCalibrationCaptureByteReference {
  return Object.freeze({
    role: roleName,
    offset: piece.offset,
    byteLength: piece.bytes.length,
    digest: piece.digest,
  });
}

function png(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
  label: string,
): RealBuildSourceParityCalibrationCaptureWirePng {
  if (rgba.length !== width * height * 4) {
    throw new RangeError(
      `${label} RGBA has ${rgba.length} bytes; expected ${width * height * 4} for ${width}x${height}.`,
    );
  }
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  try {
    const context = canvas.getContext("2d");
    if (context === null) throw new Error(`${label} PNG canvas has no 2D context.`);
    const image = context.createImageData(width, height);
    image.data.set(rgba);
    context.putImageData(image, 0, 0);
    const dataUrl = canvas.toDataURL("image/png");
    const prefix = "data:image/png;base64,";
    if (!dataUrl.startsWith(prefix)) {
      throw new TypeError(
        `${label} PNG observed ${dataUrl.slice(0, 32)}; expected a PNG base64 data URL.`,
      );
    }
    const base64 = dataUrl.slice(prefix.length);
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    return Object.freeze({
      mediaType: "image/png" as const,
      transportEncoding: "data-url-base64/1" as const,
      byteLength: bytes.length,
      digest: rawDigest(bytes),
      width,
      height,
      rgbaDigest: rawDigest(new Uint8Array(rgba.buffer, rgba.byteOffset, rgba.byteLength)),
      dataUrl,
    });
  } finally {
    canvas.width = 0;
    canvas.height = 0;
    canvas.remove();
  }
}

function pairwise(leftName: "P" | "D", rightName: "D" | "W", left: Uint8Array, right: Uint8Array) {
  if (left.length !== right.length) {
    throw new RangeError(
      `Calibration ${leftName}/${rightName} masks have ${left.length} and ${right.length} pixels; expected one shared work raster.`,
    );
  }
  const xor = new Uint8Array(left.length);
  let differingPixels = 0;
  let intersectionPixels = 0;
  let unionPixels = 0;
  for (let pixel = 0; pixel < left.length; pixel += 1) {
    const a = left[pixel]!;
    const b = right[pixel]!;
    if ((a !== 0 && a !== 1) || (b !== 0 && b !== 1)) {
      throw new TypeError(
        `Calibration ${leftName}/${rightName} pixel ${pixel} observed ${a}/${b}; expected binary 0/1 values.`,
      );
    }
    if (a !== b) {
      xor[pixel] = 1;
      differingPixels += 1;
    }
    if (a === 1 && b === 1) intersectionPixels += 1;
    if (a === 1 || b === 1) unionPixels += 1;
  }
  return Object.freeze({
    left: leftName,
    right: rightName,
    differingPixels,
    intersectionPixels,
    unionPixels,
    iou: unionPixels === 0 ? 1 : intersectionPixels / unionPixels,
    xorDigest: rawDigest(xor),
  });
}

export function createRealBuildSourceParityCalibrationBrowserCapture(
  input: CreateRealBuildSourceParityCalibrationBrowserCaptureInput,
): RealBuildSourceParityCalibrationBrowserCaptureWire {
  if (input.measurements.length !== REAL_BUILD_SOURCE_PARITY_CALIBRATION_PANEL_PAGES.length) {
    throw new RangeError(
      `Calibration capture received ${input.measurements.length} measurements; expected exactly ${REAL_BUILD_SOURCE_PARITY_CALIBRATION_PANEL_PAGES.length}.`,
    );
  }
  const highPieces = preflightBytePieces(
    input.measurements.map(({ highRgba }) => {
      return highRgba;
    }),
    input.measurements.map(
      ({ sourceArtStages }) => Number(sourceArtStages.width) * Number(sourceArtStages.height) * 4,
    ),
    Uint8ClampedArray.prototype,
    MAXIMUM_REAL_BUILD_SOURCE_PARITY_CALIBRATION_CAPTURE_HIGH_RGBA_BYTES,
    "Calibration high RGBA role",
  );
  const workPieces = preflightBytePieces(
    input.measurements.map(({ workRgba }) => workRgba),
    input.measurements.map(({ width, height }) => Number(width) * Number(height) * 4),
    Uint8ClampedArray.prototype,
    MAXIMUM_REAL_BUILD_SOURCE_PARITY_CALIBRATION_CAPTURE_WORK_RGBA_BYTES,
    "Calibration work RGBA role",
  );
  const high = concatenate(highPieces, "Calibration high RGBA role");
  const work = concatenate(workPieces, "Calibration work RGBA role");
  const stageTrace = createRealBuildObservationSourceStageTrace(
    input.measurements.map(
      ({ panel, sourceArtStages, candidatePolicyDigest, candidateWorkPixelsDigest }, index) => {
        if (candidateWorkPixelsDigest !== work.refs[index]!.digest) {
          throw new TypeError(
            `Calibration capture step ${panel.stepNumber} candidate work digest ${candidateWorkPixelsDigest} does not reproduce retained work RGBA ${work.refs[index]!.digest}.`,
          );
        }
        return {
          stepNumber: panel.stepNumber,
          pageNumber: panel.pageNumber,
          source: {
            schemaVersion: "lego.real-build-observation-source-stage-opaque-provenance/1" as const,
            reproduction: "not-claimed" as const,
            pdfDigest: input.binding.expectedPdfDigest as Sha256Digest,
            panelEvidenceDigest: panel.panelEvidenceDigest as Sha256Digest,
            cropDescriptorDigest: canonicalDigest({
              schemaVersion: "lego.real-build-calibration-crop/1",
              panel,
              highWidth: sourceArtStages.width,
              highHeight: sourceArtStages.height,
            }),
            policyDescriptorDigest: candidatePolicyDigest,
            workPixelsDigest: candidateWorkPixelsDigest,
          },
          stages: sourceArtStages,
        };
      },
    ),
  );
  const stageManifestBytes = stageTrace.readManifestBytes();
  if (
    stageManifestBytes.length >
    MAXIMUM_REAL_BUILD_SOURCE_PARITY_CALIBRATION_CAPTURE_STAGE_MANIFEST_BYTES
  ) {
    throw new RangeError(
      `Calibration stage manifest has ${stageManifestBytes.length} bytes; expected at most ${MAXIMUM_REAL_BUILD_SOURCE_PARITY_CALIBRATION_CAPTURE_STAGE_MANIFEST_BYTES}.`,
    );
  }
  const stageBytes = stageTrace.readRoleBytes();
  if (stageBytes.length > MAXIMUM_REAL_BUILD_SOURCE_PARITY_CALIBRATION_CAPTURE_STAGE_BYTES) {
    throw new RangeError(
      `Calibration stage role has ${stageBytes.length} bytes; expected at most ${MAXIMUM_REAL_BUILD_SOURCE_PARITY_CALIBRATION_CAPTURE_STAGE_BYTES}.`,
    );
  }
  const packedW = input.measurements.map(({ wMask, width, height }) =>
    packRealBuildCompiledBinaryMaskMsb(wMask, width, height),
  );
  const w = concatenate(
    preflightBytePieces(
      packedW,
      packedW.map(({ byteLength }) => byteLength),
      Uint8Array.prototype,
      MAXIMUM_REAL_BUILD_SOURCE_PARITY_CALIBRATION_CAPTURE_W_BYTES,
      "Calibration W role",
    ),
    "Calibration W role",
  );
  let pngBytes = 0;
  const panels = input.measurements.map((measurement, index) => {
    const expected = REAL_BUILD_SOURCE_PARITY_CALIBRATION_PANEL_PAGES[index]!;
    const {
      panel,
      width,
      height,
      sourceArtStages: stages,
      candidatePolicyDigest,
      candidateDerivationDigest,
      highRgba,
      workRgba,
      wMask,
    } = measurement;
    if (panel.stepNumber !== expected.stepNumber || panel.pageNumber !== expected.pageNumber) {
      throw new TypeError(
        `Calibration measurement row ${index} observed step/page ${panel.stepNumber}/${panel.pageNumber}; expected ${expected.stepNumber}/${expected.pageNumber}.`,
      );
    }
    const pMask = stages.isolateThenDownsampleMask;
    const dMask = stages.downsampleThenIsolateMask;
    if (wMask.length !== width * height) {
      throw new RangeError(
        `Calibration step ${panel.stepNumber} W has ${wMask.length} pixels; expected ${width * height}.`,
      );
    }
    const highPng = png(
      highRgba,
      stages.width,
      stages.height,
      `Calibration step ${panel.stepNumber} high`,
    );
    const workPng = png(workRgba, width, height, `Calibration step ${panel.stepNumber} work`);
    pngBytes += highPng.byteLength + workPng.byteLength;
    if (pngBytes > MAXIMUM_REAL_BUILD_SOURCE_PARITY_CALIBRATION_CAPTURE_PNG_BYTES) {
      throw new RangeError(
        `Calibration PNGs reach ${pngBytes} decoded bytes at step ${panel.stepNumber}; expected at most ${MAXIMUM_REAL_BUILD_SOURCE_PARITY_CALIBRATION_CAPTURE_PNG_BYTES}.`,
      );
    }
    const wPiece = w.refs[index]!;
    const wRef: RealBuildSourceParityCalibrationCapturePackedMaskReference = Object.freeze({
      role: "calibration-w-packed-msb",
      contentEncoding: "packed-binary-mask-msb/1",
      offset: wPiece.offset,
      byteLength: wPiece.bytes.length,
      digest: wPiece.digest,
      width,
      height,
      pixelCount: wMask.length,
      lowPaddingBits: (8 - (wMask.length & 7)) & 7,
      unpackedDigest: rawDigest(wMask),
    });
    const stagePanel = stageTrace.manifest.panels[index]!;
    const pRef = stagePanel.stages.find(({ stage }) => stage === "isolate-then-downsample");
    const dRef = stagePanel.stages.find(({ stage }) => stage === "downsample-then-isolate");
    if (pRef === undefined || dRef === undefined) {
      throw new TypeError(`Calibration step ${panel.stepNumber} stage trace omitted P or D.`);
    }
    return Object.freeze({
      stepNumber: panel.stepNumber,
      pageNumber: panel.pageNumber,
      minXPt: panel.minXPt,
      maxXPt: panel.maxXPt,
      minYPt: panel.minYPt,
      maxYPt: panel.maxYPt,
      calloutBoxes: panel.calloutBoxes,
      panelEvidenceDigest: panel.panelEvidenceDigest as Sha256Digest,
      highWidth: stages.width,
      highHeight: stages.height,
      highPixelCount: stages.width * stages.height,
      workWidth: width,
      workHeight: height,
      workPixelCount: width * height,
      workFactor: 2 as const,
      highRgba: byteReference("calibration-high-rgba8", high.refs[index]!),
      workRgba: byteReference("calibration-work-rgba8", work.refs[index]!),
      stageTracePanelIndex: index,
      pMask: pRef,
      dMask: dRef,
      wMask: wRef,
      candidatePolicyDigest,
      candidateDerivationDigest,
      pairwisePdw: Object.freeze([
        pairwise("P", "D", pMask, dMask),
        pairwise("P", "W", pMask, wMask),
        pairwise("D", "W", dMask, wMask),
      ] as const),
      highPng,
      workPng,
    });
  });
  const roleBytes = new Map<RealBuildSourceParityCalibrationCaptureRole, Uint8Array>([
    ["calibration-high-rgba8", high.bytes],
    ["calibration-work-rgba8", work.bytes],
    ["calibration-stage-manifest-json", stageManifestBytes],
    ["calibration-stage-packed-msb", stageBytes],
    ["calibration-w-packed-msb", w.bytes],
  ]);
  return Object.freeze({
    schemaVersion: REAL_BUILD_SOURCE_PARITY_CALIBRATION_BROWSER_CAPTURE_SCHEMA,
    authority: REAL_BUILD_SOURCE_PARITY_CALIBRATION_CAPTURE_AUTHORITY,
    reviewState: "pending-unreviewed" as const,
    pdfDigest: input.binding.expectedPdfDigest as Sha256Digest,
    pdfBytes: input.binding.expectedPdfBytes,
    fullPreparedPanelsDigest: input.binding.fullPreparedPanelsDigest as Sha256Digest,
    calibrationPreparedPanelsDigest: input.binding.calibrationPreparedPanelsDigest as Sha256Digest,
    calibrationDigest: input.binding.calibrationDigest as Sha256Digest,
    roles: Object.freeze(
      REAL_BUILD_SOURCE_PARITY_CALIBRATION_CAPTURE_ROLES.map((roleName) =>
        role(roleName, roleBytes.get(roleName)!),
      ),
    ),
    panels: Object.freeze(panels),
  });
}
