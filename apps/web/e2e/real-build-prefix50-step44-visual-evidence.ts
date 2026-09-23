import { createHash } from "node:crypto";

import type { Page, TestInfo } from "@playwright/test";
import type { Sha256Digest } from "@lego-studio/brick-kernel";

import { inspectPng } from "./callout-publication";

export const PREFIX50_STEP44_MODEL_ONLY_VIEW_NAMES = [
  "isometric",
  "front",
  "back",
  "left",
  "right",
  "top",
  "underside",
] as const;

export const PREFIX50_STEP44_BOOKLET_VISIBLE_DELTA_VIEWS = ["isometric", "top"] as const;

const CAPTURE_WIDTH = 640;
const CAPTURE_HEIGHT = 480;
const MAXIMUM_PNG_BYTES = 16 * 1024 * 1024;
const PNG_DATA_URL_PREFIX = "data:image/png;base64,";
const SHA256_PATTERN = /^sha256:[0-9a-f]{64}$/u;

export type Prefix50Step44ModelOnlyViewName =
  (typeof PREFIX50_STEP44_MODEL_ONLY_VIEW_NAMES)[number];

export interface Prefix50Step44ModelOnlyViewEvidence {
  readonly viewName: Prefix50Step44ModelOnlyViewName;
  readonly width: typeof CAPTURE_WIDTH;
  readonly height: typeof CAPTURE_HEIGHT;
  readonly pngBytes: number;
  /** Digest of the exact retained PNG artifact bytes. */
  readonly pngSha256: Sha256Digest;
  /** Digest of decoded top-left-origin RGBA pixels, independent of PNG encoding. */
  readonly rgbaSha256: Sha256Digest;
}

export interface Prefix50Step44ModelOnlyEvidence {
  readonly completedPrintedStep: 43 | 44;
  readonly scene: "model-only";
  readonly views: Readonly<
    Record<Prefix50Step44ModelOnlyViewName, Prefix50Step44ModelOnlyViewEvidence>
  >;
}

export interface Prefix50Step44VisualDelta {
  readonly changedViews: readonly Prefix50Step44ModelOnlyViewName[];
  readonly unchangedViews: readonly Prefix50Step44ModelOnlyViewName[];
  readonly requiredChangedViews: typeof PREFIX50_STEP44_BOOKLET_VISIBLE_DELTA_VIEWS;
}

interface BrowserCapture {
  readonly pngDataUrl: string;
  readonly width: number;
  readonly height: number;
  readonly rgbaSha256: string;
}

function sha256(bytes: Uint8Array): Sha256Digest {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function exactViewNames(captures: Record<string, BrowserCapture>): void {
  const actual = Object.keys(captures);
  const expected = [...PREFIX50_STEP44_MODEL_ONLY_VIEW_NAMES];
  if (actual.length !== expected.length || actual.some((name, index) => name !== expected[index])) {
    throw new Error(
      `Model-only capture returned view names ${JSON.stringify(actual)}; expected exactly ${JSON.stringify(expected)} in canonical packet order.`,
    );
  }
}

function decodePngDataUrl(dataUrl: string, label: string): Buffer {
  if (!dataUrl.startsWith(PNG_DATA_URL_PREFIX)) {
    throw new TypeError(`${label} is not a base64 PNG data URL.`);
  }
  const encoded = dataUrl.slice(PNG_DATA_URL_PREFIX.length);
  if (
    encoded.length === 0 ||
    encoded.length % 4 !== 0 ||
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u.test(encoded)
  ) {
    throw new TypeError(`${label} contains malformed base64 PNG data.`);
  }
  const png = Buffer.from(encoded, "base64");
  if (png.toString("base64") !== encoded) {
    throw new TypeError(`${label} does not use one canonical base64 encoding.`);
  }
  if (png.length <= 0 || png.length > MAXIMUM_PNG_BYTES) {
    throw new RangeError(
      `${label} is ${png.length} PNG bytes; expected a bounded 1..${MAXIMUM_PNG_BYTES} artifact.`,
    );
  }
  return png;
}

async function captureDecodedPixels(page: Page): Promise<Record<string, BrowserCapture>> {
  return page.evaluate(async () => {
    if (!window.capture_model_views) {
      throw new Error(
        "window.capture_model_views is unavailable; the UI automation bridge is absent.",
      );
    }
    const captures = await window.capture_model_views({ scene: "model-only" });
    const result: Record<string, BrowserCapture> = {};
    for (const [viewName, pngDataUrl] of Object.entries(captures)) {
      if (typeof pngDataUrl !== "string") {
        throw new TypeError(`Canonical view ${viewName} did not return a string PNG data URL.`);
      }
      const response = await fetch(pngDataUrl);
      if (!response.ok) {
        throw new Error(`Canonical view ${viewName} data URL could not be decoded.`);
      }
      const bitmap = await createImageBitmap(await response.blob());
      try {
        const canvas = document.createElement("canvas");
        canvas.width = bitmap.width;
        canvas.height = bitmap.height;
        const context = canvas.getContext("2d", { willReadFrequently: true });
        if (!context) throw new Error(`Canonical view ${viewName} has no 2D decode context.`);
        context.drawImage(bitmap, 0, 0);
        const rgba = context.getImageData(0, 0, bitmap.width, bitmap.height).data;
        const digest = await crypto.subtle.digest("SHA-256", rgba.slice().buffer);
        result[viewName] = {
          pngDataUrl,
          width: bitmap.width,
          height: bitmap.height,
          rgbaSha256: `sha256:${Array.from(new Uint8Array(digest), (byte) =>
            byte.toString(16).padStart(2, "0"),
          ).join("")}`,
        };
      } finally {
        bitmap.close();
      }
    }
    return result;
  });
}

/**
 * Captures and retains all seven canonical views from the renderer's model-only
 * scene. The PNG digest binds the attached artifact while the RGBA digest binds
 * decoded pixels and therefore cannot be changed by PNG metadata or compression.
 */
export async function capturePrefix50Step44ModelOnlyEvidence(input: {
  readonly page: Page;
  readonly testInfo: TestInfo;
  readonly completedPrintedStep: 43 | 44;
}): Promise<Prefix50Step44ModelOnlyEvidence> {
  const captures = await captureDecodedPixels(input.page);
  exactViewNames(captures);

  const views = {} as Record<Prefix50Step44ModelOnlyViewName, Prefix50Step44ModelOnlyViewEvidence>;
  const retained: { readonly name: string; readonly png: Buffer }[] = [];
  for (const viewName of PREFIX50_STEP44_MODEL_ONLY_VIEW_NAMES) {
    const capture = captures[viewName]!;
    const label = `prefix50 Step ${input.completedPrintedStep} model-only ${viewName}`;
    const png = decodePngDataUrl(capture.pngDataUrl, label);
    const dimensions = inspectPng(png);
    if (
      capture.width !== CAPTURE_WIDTH ||
      capture.height !== CAPTURE_HEIGHT ||
      dimensions.width !== CAPTURE_WIDTH ||
      dimensions.height !== CAPTURE_HEIGHT
    ) {
      throw new Error(
        `${label} was decoded as ${capture.width}x${capture.height} and has a ${dimensions.width}x${dimensions.height} IHDR; expected both to be ${CAPTURE_WIDTH}x${CAPTURE_HEIGHT}.`,
      );
    }
    if (!SHA256_PATTERN.test(capture.rgbaSha256)) {
      throw new Error(`${label} has malformed decoded-pixel digest ${capture.rgbaSha256}.`);
    }
    views[viewName] = {
      viewName,
      width: CAPTURE_WIDTH,
      height: CAPTURE_HEIGHT,
      pngBytes: png.length,
      pngSha256: sha256(png),
      rgbaSha256: capture.rgbaSha256 as Sha256Digest,
    };
    retained.push({
      name: `prefix50-playback-step${input.completedPrintedStep}-model-only-${viewName}.png`,
      png,
    });
  }

  for (const artifact of retained) {
    await input.testInfo.attach(artifact.name, { body: artifact.png, contentType: "image/png" });
  }
  return {
    completedPrintedStep: input.completedPrintedStep,
    scene: "model-only",
    views,
  };
}

/**
 * Proves the zero-piece Step 43 -> 44 transition is visible in the two views
 * closest to the booklet's overhead/isometric presentation. PNG encodings are
 * retained for review, but the gate compares decoded RGBA pixels.
 */
export function assertPrefix50Step43To44VisualDelta(
  step43: Prefix50Step44ModelOnlyEvidence,
  step44: Prefix50Step44ModelOnlyEvidence,
): Prefix50Step44VisualDelta {
  if (step43.completedPrintedStep !== 43 || step44.completedPrintedStep !== 44) {
    throw new Error(
      `Step 43 -> 44 visual evidence received positions ${step43.completedPrintedStep} -> ${step44.completedPrintedStep}; expected 43 -> 44.`,
    );
  }
  const changedViews = PREFIX50_STEP44_MODEL_ONLY_VIEW_NAMES.filter(
    (viewName) => step43.views[viewName].rgbaSha256 !== step44.views[viewName].rgbaSha256,
  );
  const unchangedViews = PREFIX50_STEP44_MODEL_ONLY_VIEW_NAMES.filter(
    (viewName) => !changedViews.includes(viewName),
  );
  const missingRequired = PREFIX50_STEP44_BOOKLET_VISIBLE_DELTA_VIEWS.filter(
    (viewName) => !changedViews.includes(viewName),
  );
  if (missingRequired.length > 0) {
    throw new Error(
      `Step 43 -> 44 decoded pixels did not change in required booklet-visible views ${missingRequired.join(", ")}; changed views were ${changedViews.join(", ") || "none"}.`,
    );
  }
  return {
    changedViews,
    unchangedViews,
    requiredChangedViews: PREFIX50_STEP44_BOOKLET_VISIBLE_DELTA_VIEWS,
  };
}
