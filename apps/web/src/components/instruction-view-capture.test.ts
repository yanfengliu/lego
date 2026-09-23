import {
  createEmptyBrickDocument,
  createPartInstance,
  documentStructuralHash,
} from "@lego-studio/brick-kernel";
import * as rendering from "@lego-studio/rendering";
import {
  ACESFilmicToneMapping,
  Color,
  NoToneMapping,
  SRGBColorSpace,
  Vector4,
  WebGLRenderTarget,
  type Scene,
  type WebGLRenderer,
} from "three";
import { afterEach, expect, it, vi } from "vitest";

import { renderInstructionViewPixels } from "./instruction-view-capture";

afterEach(() => vi.restoreAllMocks());

function fixture(failure: "none" | "target" | "render" | "readback" = "none") {
  const base = createEmptyBrickDocument({ id: "capture-state", name: "Capture state" });
  const part = createPartInstance({ id: "capture-part" });
  const document = {
    ...base,
    parts: [part],
    submodels: base.submodels.map((row) => ({ ...row, partIds: [part.id] })),
    steps: base.steps.map((row) => ({ ...row, partIds: [part.id] })),
  };
  const maskMaterials = rendering.createSemanticColorMaskMaterials();
  const oldTarget = null;
  let currentTarget: WebGLRenderTarget | null = oldTarget;
  const targetDisposed = vi.fn();
  const originalDerive = rendering.deriveBrickScene;
  const projections: rendering.DerivedBrickScene[] = [];
  vi.spyOn(rendering, "deriveBrickScene").mockImplementation((...args) => {
    expect(args[1]).toEqual({ finish: "instruction" });
    const projection = originalDerive(...args);
    projections.push(projection);
    return projection;
  });
  const viewport = new Vector4(2, 3, 17, 19);
  const scissor = new Vector4(4, 5, 11, 13);
  const clearColor = new Color(0x123456);
  const renderer = {
    toneMapping: ACESFilmicToneMapping as number,
    toneMappingExposure: 1.08,
    shadowMap: { enabled: true },
    autoClear: false,
    autoClearColor: false,
    autoClearDepth: false,
    autoClearStencil: false,
    getRenderTarget: () => currentTarget,
    getViewport: (value: Vector4) => value.copy(viewport),
    getScissor: (value: Vector4) => value.copy(scissor),
    getScissorTest: () => true,
    getClearColor: (value: Color) => value.copy(clearColor),
    getClearAlpha: () => 0.4,
    setRenderTarget: vi.fn((value: WebGLRenderTarget | null) => {
      currentTarget = value;
      if (value !== oldTarget) {
        value.addEventListener("dispose", targetDisposed);
        expect(value.texture.colorSpace).toBe(SRGBColorSpace);
        expect(value.samples).toBe(0);
        expect(value.scissorTest).toBe(false);
        if (failure === "target") throw new Error("injected target failure");
      }
    }),
    setViewport: vi.fn(),
    setScissor: vi.fn(),
    setScissorTest: vi.fn(),
    setClearColor: vi.fn(),
    render: vi.fn((scene: Scene) => {
      expect(scene.environment).toBeNull();
      expect(scene.children).toEqual([projections[0]!.root]);
      expect(renderer.toneMapping).toBe(NoToneMapping);
      expect(renderer.shadowMap.enabled).toBe(false);
      expect(
        renderer.autoClear &&
          renderer.autoClearColor &&
          renderer.autoClearDepth &&
          renderer.autoClearStencil,
      ).toBe(true);
      if (failure === "render") throw new Error("injected render failure");
    }),
    readRenderTargetPixels: vi.fn(
      (
        _target: WebGLRenderTarget,
        _x: number,
        _y: number,
        _width: number,
        _height: number,
        pixels: Uint8Array,
      ) => {
        if (failure === "readback") throw new Error("injected readback failure");
        pixels.set([10, 11, 12, 255, 20, 21, 22, 255]);
      },
    ),
  };
  const input = {
    document,
    expectedDocumentHash: documentStructuralHash(document),
    maskMaterials,
    renderer: renderer as unknown as WebGLRenderer,
    request: {
      scene: "model-only" as const,
      renderMode: "semantic-color-id-mask" as const,
      targetColorIds: [part.colorId],
      backgroundHex: 0x899093,
      parameters: {
        azimuthDegrees: 35,
        elevationDegrees: 35,
        pixelsPerUnit: 80,
        centerXPx: 0.5,
        centerYPx: 1,
      },
      frame: { widthPx: 1, heightPx: 2, target: [0, 0, 0] as const, sceneRadius: 5 },
    },
  };
  return {
    input,
    renderer,
    projections,
    requireRestored() {
      expect(renderer.toneMapping).toBe(ACESFilmicToneMapping);
      expect(renderer.toneMappingExposure).toBe(1.08);
      expect(renderer.shadowMap.enabled).toBe(true);
      expect([
        renderer.autoClear,
        renderer.autoClearColor,
        renderer.autoClearDepth,
        renderer.autoClearStencil,
      ]).toEqual([false, false, false, false]);
      expect(renderer.setRenderTarget).toHaveBeenLastCalledWith(oldTarget);
      expect(renderer.setViewport).toHaveBeenLastCalledWith(viewport);
      expect(renderer.setScissor).toHaveBeenLastCalledWith(scissor);
      expect(renderer.setScissorTest).toHaveBeenLastCalledWith(true);
      expect(renderer.setClearColor).toHaveBeenLastCalledWith(clearColor, 0.4);
      expect(targetDisposed).toHaveBeenCalledOnce();
      expect(projections[0]!.disposed).toBe(true);
    },
    dispose() {
      rendering.disposeSemanticColorMaskMaterials(maskMaterials);
    },
  };
}

// Bound: borrowed-renderer state and owned resources for success plus faults at
// target binding, rendering, and readback. Actual color/geometry is browser-gated.
it.each(["none", "target", "render", "readback"] as const)(
  "restores state and disposes owned capture resources after %s",
  (failure) => {
    const subject = fixture(failure);
    try {
      if (failure === "none") {
        const capture = renderInstructionViewPixels(subject.input);
        expect([...capture.pixels]).toEqual([20, 21, 22, 255, 10, 11, 12, 255]);
        expect(capture.semanticColorMask?.targetPartIds).toEqual(["capture-part"]);
      } else
        expect(() => renderInstructionViewPixels(subject.input)).toThrow(
          `injected ${failure} failure`,
        );
      subject.requireRestored();
    } finally {
      subject.dispose();
    }
  },
);

it("refuses a stale document or invalid request before deriving a scene or touching the renderer", () => {
  const subject = fixture();
  try {
    expect(() =>
      renderInstructionViewPixels({ ...subject.input, expectedDocumentHash: "stale" }),
    ).toThrow(/has not reached the framed viewport/u);
    expect(() =>
      renderInstructionViewPixels({
        ...subject.input,
        request: {
          ...subject.input.request,
          frame: { ...subject.input.request.frame, widthPx: 0 },
        },
      }),
    ).toThrow(/1..2048/u);
    expect(subject.projections).toEqual([]);
    expect(subject.renderer.setRenderTarget).not.toHaveBeenCalled();
  } finally {
    subject.dispose();
  }
});

it("refuses a nested offscreen target without touching its viewport or allocating a scene", () => {
  const subject = fixture();
  const externalTarget = new WebGLRenderTarget(3, 4);
  try {
    vi.spyOn(subject.renderer, "getRenderTarget").mockReturnValue(externalTarget);
    expect(() => renderInstructionViewPixels(subject.input)).toThrow(
      /finish the active offscreen render/u,
    );
    expect(subject.projections).toEqual([]);
    expect(subject.renderer.setRenderTarget).not.toHaveBeenCalled();
    expect(subject.renderer.setViewport).not.toHaveBeenCalled();
  } finally {
    externalTarget.dispose();
    subject.dispose();
  }
});
