import {
  Camera,
  Color,
  DepthTexture,
  Mesh,
  NoToneMapping,
  NoColorSpace,
  Object3D,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  SRGBColorSpace,
  UnsignedIntType,
  WebGLRenderer,
  WebGLRenderTarget,
} from "three";

import { INSTRUCTION_BACKGROUND_HEX } from "./constants.ts";
import {
  INSTRUCTION_DEPTH_CLEAR,
  INSTRUCTION_DEPTH_COMPOSITION_SCHEMA,
  createInstructionSparseDepthSurfaceFromReadback,
  createInstructionDepthSurfaceFromReadback,
  type InstructionDepthReadback,
  type InstructionDepthSurface,
  type InstructionSparseDepthSurface,
} from "./instruction-depth-composition.ts";

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
  /**
   * Renders one exact subject into the same opaque instruction dialect while retaining its
   * DEPTH_COMPONENT24 attachment as an immutable composition surface. The subject is rasterized
   * once; a fixed full-screen pass only packs that completed depth texture into readable RGB8.
   */
  captureDepthSurface(root: Object3D, camera: Camera, subjectKey: string): InstructionDepthSurface;
  /** Captures the same authenticated subject but retains only non-clear probe-depth fragments. */
  captureSparseDepthSurface(
    root: Object3D,
    camera: Camera,
    subjectKey: string,
  ): InstructionSparseDepthSurface;
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
let nextInstructionRendererInstance = 1;

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

  const backgroundHex = options.backgroundHex ?? INSTRUCTION_BACKGROUND_HEX;
  const rendererInstanceKey = `instruction-renderer:${nextInstructionRendererInstance}`;
  nextInstructionRendererInstance += 1;
  const target = new WebGLRenderTarget(width, height);
  // Without this the readback is linear-light bytes, and a part filled with
  // #899093 would not read back as #899093.
  target.texture.colorSpace = SRGBColorSpace;
  const captureTarget = new WebGLRenderTarget(width, height);
  captureTarget.texture.colorSpace = SRGBColorSpace;
  captureTarget.depthTexture = new DepthTexture(width, height, UnsignedIntType);
  captureTarget.stencilBuffer = false;
  captureTarget.samples = 0;
  const depthPackTarget = new WebGLRenderTarget(width, height);
  depthPackTarget.texture.colorSpace = NoColorSpace;
  depthPackTarget.samples = 0;
  const depthPackMaterial = new ShaderMaterial({
    uniforms: { sourceDepth: { value: captureTarget.depthTexture } },
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
    vertexShader:
      "varying vec2 packedUv; void main() { packedUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }",
    fragmentShader:
      "precision highp float; uniform sampler2D sourceDepth; varying vec2 packedUv; void main() { float code = min(floor(texture2D(sourceDepth, packedUv).r * 16777215.0 + 0.5), 16777215.0); float red = floor(code / 65536.0); code -= red * 65536.0; float green = floor(code / 256.0); float blue = code - green * 256.0; gl_FragColor = vec4(red, green, blue, 255.0) / 255.0; }",
  });
  const depthPackQuad = new Mesh(new PlaneGeometry(2, 2), depthPackMaterial);
  depthPackQuad.frustumCulled = false;
  const depthPackScene = new Scene();
  depthPackScene.add(depthPackQuad);
  const depthPackCamera = new Camera();

  const scene = new Scene();
  scene.background = new Color(backgroundHex);
  scene.userData = { renderRole: "instruction-view" };

  const buffer = new Uint8Array(width * height * 4);
  const flipped = new Uint8ClampedArray(width * height * 4);
  const captureColor = new Uint8Array(width * height * 4);
  const captureColorFlipped = new Uint8ClampedArray(width * height * 4);
  const packedDepth = new Uint8Array(width * height * 4);
  const capturedDepthFlipped = new Uint32Array(width * height);
  const stride = width * 4;
  const context = renderer.getContext() as WebGL2RenderingContext;
  const contextVendor = String(context.getParameter(context.VENDOR));
  const contextRenderer = String(context.getParameter(context.RENDERER));
  const contextVersion = String(context.getParameter(context.VERSION));
  let disposed = false;

  const requireLive = (): void => {
    if (!disposed) return;
    throw new Error(
      `Cannot render through a disposed ${width}x${height} instruction renderer. ` +
        `Its GL context and render targets are already released, so this call cannot be retried — ` +
        `create a new renderer with createInstructionRenderer, or move the dispose() after the last render.`,
    );
  };

  const requireFramebuffer = (label: string): void => {
    const status = context.checkFramebufferStatus(context.FRAMEBUFFER);
    const depthBits = context.getParameter(context.DEPTH_BITS) as number;
    if (status !== context.FRAMEBUFFER_COMPLETE || depthBits !== 24) {
      throw new TypeError(
        `${label} requires one complete DEPTH_COMPONENT24 framebuffer; status ${String(status)} exposes ${String(depthBits)} depth bits.`,
      );
    }
  };

  const captureDepthReadback = (
    root: Object3D,
    camera: Camera,
    subjectKey: string,
  ): InstructionDepthReadback => {
    requireLive();
    scene.add(root);
    try {
      renderer.setRenderTarget(target);
      requireFramebuffer("Instruction reference target");
      renderer.setRenderTarget(captureTarget);
      renderer.render(scene, camera);
      requireFramebuffer("Instruction depth-capture target");
      renderer.readRenderTargetPixels(captureTarget, 0, 0, width, height, captureColor);
      renderer.setRenderTarget(depthPackTarget);
      renderer.render(depthPackScene, depthPackCamera);
      renderer.readRenderTargetPixels(depthPackTarget, 0, 0, width, height, packedDepth);
    } finally {
      renderer.setRenderTarget(null);
      scene.remove(root);
    }
    for (let row = 0; row < height; row += 1) {
      const sourceRow = height - 1 - row;
      captureColorFlipped.set(
        captureColor.subarray(sourceRow * stride, (sourceRow + 1) * stride),
        row * stride,
      );
      for (let x = 0; x < width; x += 1) {
        const sourceOffset = (sourceRow * width + x) * 4;
        capturedDepthFlipped[row * width + x] =
          (packedDepth[sourceOffset]! << 16) |
          (packedDepth[sourceOffset + 1]! << 8) |
          packedDepth[sourceOffset + 2]!;
      }
    }
    return {
      subjectKey,
      compatibility: {
        schemaVersion: INSTRUCTION_DEPTH_COMPOSITION_SCHEMA,
        rendererInstanceKey,
        width,
        height,
        backgroundHex,
        contextVendor,
        contextRenderer,
        contextVersion,
        antialias: false,
        samples: 0,
        referenceDepthAttachment: "depth-component24-renderbuffer",
        captureDepthAttachment: "depth-component24-texture",
        depthAttachmentBits: 24,
        depthReadback: "depth-texture-uint24-rgb8-pack",
        depthFunction: "less-equal",
        depthOrder: "smaller-is-nearer",
        clearDepth: INSTRUCTION_DEPTH_CLEAR,
        outputColorSpace: "srgb",
        toneMapping: "none",
      },
      camera: {
        projectionMatrix: [...camera.projectionMatrix.elements],
        matrixWorldInverse: [...camera.matrixWorldInverse.elements],
        layersMask: camera.layers.mask,
        coordinateSystem: camera.coordinateSystem,
      },
      color: captureColorFlipped,
      depth: capturedDepthFlipped,
    };
  };

  return {
    width,
    height,
    render(root: Object3D, camera: Camera): Uint8ClampedArray {
      requireLive();
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
    captureDepthSurface(
      root: Object3D,
      camera: Camera,
      subjectKey: string,
    ): InstructionDepthSurface {
      return createInstructionDepthSurfaceFromReadback(
        captureDepthReadback(root, camera, subjectKey),
      );
    },
    captureSparseDepthSurface(
      root: Object3D,
      camera: Camera,
      subjectKey: string,
    ): InstructionSparseDepthSurface {
      return createInstructionSparseDepthSurfaceFromReadback(
        captureDepthReadback(root, camera, subjectKey),
      );
    },
    get disposed() {
      return disposed;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      scene.clear();
      depthPackScene.clear();
      target.dispose();
      captureTarget.dispose();
      depthPackTarget.dispose();
      depthPackQuad.geometry.dispose();
      depthPackMaterial.dispose();
      renderer.dispose();
    },
  };
}
