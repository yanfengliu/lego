import { documentStructuralHash } from "@lego-studio/brick-kernel";
import type { BrickDocumentV1 } from "@lego-studio/protocol";
import {
  createOrthographicViewCamera,
  deriveBrickScene,
  withSemanticColorIdMask,
  type SemanticColorMaskClassification,
  type SemanticColorMaskMaterials,
} from "@lego-studio/rendering";
import {
  Color,
  NoToneMapping,
  Scene,
  SRGBColorSpace,
  Vector4,
  WebGLRenderTarget,
  type WebGLRenderer,
} from "three";

import type { InstructionViewCaptureRequest, InstructionViewCaptureResult } from "./BrickViewport";
import { requireInstructionViewCaptureBounds } from "./instruction-view-capture-contract";

/**
 * An instruction capture borrows only the viewport's GL context, never its lit
 * scene, selection, materials, or canvas. Both art and masks use the same
 * instruction geometry and a non-multisampled sRGB target. No new context is
 * allocated. Every temporary resource and changed renderer setting is restored.
 */
export function renderInstructionViewPixels(input: {
  readonly document: BrickDocumentV1;
  readonly expectedDocumentHash: string;
  readonly request: InstructionViewCaptureRequest;
  readonly renderer: WebGLRenderer;
  readonly maskMaterials: SemanticColorMaskMaterials;
}): Omit<InstructionViewCaptureResult, "pngDataUrl"> & {
  readonly pixels: Uint8ClampedArray<ArrayBuffer>;
} {
  const { request, renderer } = input;
  const { widthPx, heightPx, targetColorIds } = requireInstructionViewCaptureBounds(request);
  const camera = createOrthographicViewCamera(request.parameters, request.frame);
  if (documentStructuralHash(input.document) !== input.expectedDocumentHash)
    throw new Error(
      "Instruction-view capture document has not reached the framed viewport; wait for the requested structure to render before capturing.",
    );
  if (renderer.getRenderTarget() !== null)
    throw new Error(
      "Instruction-view capture requires the viewport's default canvas target; finish the active offscreen render before capturing.",
    );
  const projection = deriveBrickScene(input.document, { finish: "instruction" });
  try {
    const target = new WebGLRenderTarget(widthPx, heightPx);
    target.texture.colorSpace = SRGBColorSpace;
    target.samples = 0;
    const scene = new Scene();
    scene.background = new Color(request.backgroundHex);
    scene.add(projection.root);
    try {
      const previous = {
        viewport: renderer.getViewport(new Vector4()),
        scissor: renderer.getScissor(new Vector4()),
        scissorTest: renderer.getScissorTest(),
        clearColor: renderer.getClearColor(new Color()),
        clearAlpha: renderer.getClearAlpha(),
        toneMapping: renderer.toneMapping,
        toneMappingExposure: renderer.toneMappingExposure,
        shadowEnabled: renderer.shadowMap.enabled,
        autoClear: renderer.autoClear,
        autoClearColor: renderer.autoClearColor,
        autoClearDepth: renderer.autoClearDepth,
        autoClearStencil: renderer.autoClearStencil,
      };
      try {
        renderer.toneMapping = NoToneMapping;
        renderer.toneMappingExposure = 1;
        renderer.shadowMap.enabled = false;
        renderer.autoClear =
          renderer.autoClearColor =
          renderer.autoClearDepth =
          renderer.autoClearStencil =
            true;
        renderer.setRenderTarget(target);
        const capture = (semanticColorMask: SemanticColorMaskClassification | null) => {
          renderer.render(scene, camera);
          const raw = new Uint8Array(widthPx * heightPx * 4);
          renderer.readRenderTargetPixels(target, 0, 0, widthPx, heightPx, raw);
          const pixels = new Uint8ClampedArray(raw.length);
          const stride = widthPx * 4;
          for (let row = 0; row < heightPx; row += 1)
            pixels.set(
              raw.subarray((heightPx - 1 - row) * stride, (heightPx - row) * stride),
              row * stride,
            );
          return {
            scene: "model-only" as const,
            renderMode: request.renderMode,
            semanticColorMask,
            backgroundHex: request.backgroundHex,
            width: widthPx,
            height: heightPx,
            pixels,
            parameters: request.parameters,
            frame: request.frame,
            projectionMatrix: [...camera.projectionMatrix.elements],
            matrixWorldInverse: [...camera.matrixWorldInverse.elements],
          };
        };
        return targetColorIds === null
          ? capture(null)
          : withSemanticColorIdMask({
              projection,
              targetColorIds,
              materials: input.maskMaterials,
              capture,
            });
      } finally {
        renderer.toneMapping = previous.toneMapping;
        renderer.toneMappingExposure = previous.toneMappingExposure;
        renderer.shadowMap.enabled = previous.shadowEnabled;
        renderer.autoClear = previous.autoClear;
        renderer.autoClearColor = previous.autoClearColor;
        renderer.autoClearDepth = previous.autoClearDepth;
        renderer.autoClearStencil = previous.autoClearStencil;
        renderer.setRenderTarget(null);
        renderer.setViewport(previous.viewport);
        renderer.setScissor(previous.scissor);
        renderer.setScissorTest(previous.scissorTest);
        renderer.setClearColor(previous.clearColor, previous.clearAlpha);
      }
    } finally {
      scene.clear();
      target.dispose();
    }
  } finally {
    projection.dispose();
  }
}
