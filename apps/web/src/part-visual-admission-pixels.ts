import { sha256Hex } from "@lego-studio/brick-kernel";
import {
  PART_VISUAL_ADMISSION_CAPTURE_POLICY,
  createPartVisualAdmissionCamera,
  type PartVisualAdmissionCameraPacket,
  type PartVisualAdmissionViewName,
} from "@lego-studio/rendering";
import type { Scene, WebGLRenderer } from "three";

export interface PartVisualAdmissionCaptureTransport {
  readonly side: "source" | "candidate";
  readonly viewName: PartVisualAdmissionViewName;
  readonly cameraName: string;
  readonly projection: "orthographic" | "perspective";
  readonly width: number;
  readonly height: number;
  readonly pngDataUrl: string;
  readonly rgbaBase64: string;
  readonly rgbaBytes: number;
  readonly rgbaSha256: `sha256:${string}`;
}

export interface PartVisualAdmissionViewMetric {
  readonly viewName: PartVisualAdmissionViewName;
  readonly differingPixelCount: number;
  readonly meanAbsoluteRgbDelta: number;
  readonly maximumChannelDelta: number;
  readonly foregroundIntersectionOverUnion: number | null;
  readonly sourceForegroundPixels: number;
  readonly candidateForegroundPixels: number;
}

export interface RawPartVisualAdmissionCapture {
  readonly transport: PartVisualAdmissionCaptureTransport;
  readonly rgba: Uint8Array;
}

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 32_768) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 32_768));
  }
  return btoa(binary);
}

export function capturePartVisualAdmissionView(
  renderer: WebGLRenderer,
  scene: Scene,
  side: "source" | "candidate",
  view: PartVisualAdmissionCameraPacket["views"][number],
): RawPartVisualAdmissionCapture {
  const camera = createPartVisualAdmissionCamera(view);
  renderer.render(scene, camera);
  const context = renderer.getContext();
  context.finish();
  const { width, height } = PART_VISUAL_ADMISSION_CAPTURE_POLICY;
  const rgba = new Uint8Array(width * height * 4);
  context.readPixels(0, 0, width, height, context.RGBA, context.UNSIGNED_BYTE, rgba);
  const rgbaSha256 = `sha256:${sha256Hex(rgba)}` as const;
  return {
    transport: {
      side,
      viewName: view.name,
      cameraName: camera.name,
      projection: view.projection,
      width,
      height,
      pngDataUrl: renderer.domElement.toDataURL("image/png"),
      rgbaBase64: uint8ToBase64(rgba),
      rgbaBytes: rgba.byteLength,
      rgbaSha256,
    },
    rgba,
  };
}

export function comparePartVisualAdmissionView(
  viewName: PartVisualAdmissionViewName,
  source: Uint8Array,
  candidate: Uint8Array,
): PartVisualAdmissionViewMetric {
  if (source.length !== candidate.length || source.length % 4 !== 0) {
    throw new RangeError(
      `Visual-admission ${viewName} RGBA lengths differ or are incomplete: ${source.length} and ${candidate.length}.`,
    );
  }
  let differingPixelCount = 0;
  let absoluteDelta = 0;
  let maximumChannelDelta = 0;
  let sourceForegroundPixels = 0;
  let candidateForegroundPixels = 0;
  let intersection = 0;
  let union = 0;
  for (let offset = 0; offset < source.length; offset += 4) {
    let pixelDiffers = false;
    for (let channel = 0; channel < 3; channel += 1) {
      const delta = Math.abs(source[offset + channel]! - candidate[offset + channel]!);
      absoluteDelta += delta;
      maximumChannelDelta = Math.max(maximumChannelDelta, delta);
      pixelDiffers ||= delta > 0;
    }
    if (pixelDiffers) differingPixelCount += 1;
    const sourceForeground =
      source[offset]! < 250 || source[offset + 1]! < 250 || source[offset + 2]! < 250;
    const candidateForeground =
      candidate[offset]! < 250 || candidate[offset + 1]! < 250 || candidate[offset + 2]! < 250;
    if (sourceForeground) sourceForegroundPixels += 1;
    if (candidateForeground) candidateForegroundPixels += 1;
    if (sourceForeground && candidateForeground) intersection += 1;
    if (sourceForeground || candidateForeground) union += 1;
  }
  return {
    viewName,
    differingPixelCount,
    meanAbsoluteRgbDelta: absoluteDelta / (source.length / 4) / 3,
    maximumChannelDelta,
    foregroundIntersectionOverUnion: union === 0 ? null : intersection / union,
    sourceForegroundPixels,
    candidateForegroundPixels,
  };
}
