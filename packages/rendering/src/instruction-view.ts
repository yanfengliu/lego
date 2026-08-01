import {
  Color,
  NoToneMapping,
  Object3D,
  Scene,
  SRGBColorSpace,
  WebGLRenderer,
  WebGLRenderTarget,
  type Camera,
} from "three";

import { INSTRUCTION_BACKGROUND_HEX } from "./constants.ts";

/**
 * An offscreen renderer that draws in the dialect a LEGO booklet prints in.
 *
 * The closed loop compares a render of the current assembly against the
 * booklet's own art for the same step, so the render has to be comparable:
 * unlit, untonemapped, unantialiased, over the page colour. Every one of those
 * is a decision to keep pixels in a small exact palette, because a comparison
 * that has to tolerate lighting gradients and antialiased blends is a
 * comparison that tolerates being wrong.
 *
 * The pixels come back through a render target rather than the canvas, so the
 * package needs no DOM node and no `preserveDrawingBuffer`. Callers that want
 * to look at a render paint the returned pixels themselves.
 */
export interface InstructionRendererOptions {
  readonly width: number;
  readonly height: number;
  /** Page colour behind the model. Defaults to the measured booklet grey. */
  readonly backgroundHex?: number;
}

export interface InstructionRenderer {
  readonly width: number;
  readonly height: number;
  /**
   * Renders one object tree through one camera and returns its pixels as RGBA
   * rows running top to bottom, which is the orientation `ImageData` and every
   * page raster in this repo use — WebGL's own bottom-up rows are flipped here
   * so no caller has to remember which convention it holds.
   */
  render(root: Object3D, camera: Camera): Uint8ClampedArray;
  readonly disposed: boolean;
  dispose(): void;
}

function requirePositiveInteger(value: number, label: string): number {
  if (!Number.isInteger(value) || value <= 0) {
    throw new RangeError(`${label} must be a positive integer, received ${String(value)}`);
  }
  return value;
}

/** Beyond this a single readback allocates more than a gigabyte of pixels. */
const MAX_DIMENSION = 8192;

export function createInstructionRenderer(
  options: InstructionRendererOptions,
): InstructionRenderer {
  const width = requirePositiveInteger(options.width, "width");
  const height = requirePositiveInteger(options.height, "height");
  if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
    throw new RangeError(
      `Instruction render is bounded to ${MAX_DIMENSION}x${MAX_DIMENSION}, received ${width}x${height}`,
    );
  }

  const renderer = new WebGLRenderer({ antialias: false, alpha: false });
  renderer.toneMapping = NoToneMapping;
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.shadowMap.enabled = false;
  renderer.setPixelRatio(1);
  renderer.setSize(width, height, false);

  const target = new WebGLRenderTarget(width, height);
  // Without this the readback is linear-light bytes, and a part filled with
  // #899093 would not read back as #899093.
  target.texture.colorSpace = SRGBColorSpace;

  const scene = new Scene();
  scene.background = new Color(options.backgroundHex ?? INSTRUCTION_BACKGROUND_HEX);
  scene.userData = { renderRole: "instruction-view" };

  const buffer = new Uint8Array(width * height * 4);
  const flipped = new Uint8ClampedArray(width * height * 4);
  const stride = width * 4;
  let disposed = false;

  return {
    width,
    height,
    render(root: Object3D, camera: Camera): Uint8ClampedArray {
      if (disposed) {
        throw new Error(
          `Cannot render through a disposed ${width}x${height} instruction renderer. ` +
            `Its GL context and render target are already released, so this call cannot be retried — ` +
            `create a new renderer with createInstructionRenderer, or move the dispose() after the last render.`,
        );
      }
      scene.add(root);
      try {
        renderer.setRenderTarget(target);
        renderer.render(scene, camera);
        renderer.readRenderTargetPixels(target, 0, 0, width, height, buffer);
      } finally {
        renderer.setRenderTarget(null);
        scene.remove(root);
      }
      for (let row = 0; row < height; row += 1) {
        flipped.set(
          buffer.subarray((height - 1 - row) * stride, (height - row) * stride),
          row * stride,
        );
      }
      return flipped;
    },
    get disposed() {
      return disposed;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      scene.clear();
      target.dispose();
      renderer.dispose();
    },
  };
}
