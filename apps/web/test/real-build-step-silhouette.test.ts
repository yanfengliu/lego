import { describe, expect, it, vi } from "vitest";

import { createStepSilhouette, prepareStepSilhouette } from "../e2e/real-build-step-silhouette";

const VIEW = { azimuthDegrees: 35, elevationDegrees: 25, pixelsPerUnit: 12 };
const FRAME = {
  widthPx: 2,
  heightPx: 1,
  target: [0, 0, 0] as const,
  sceneRadius: 20,
};
const BACKGROUND = [0x89, 0x90, 0x93, 0xff] as const;
const PROBE = [0x92, 0x39, 0x78, 0xff] as const;

function harness(
  options: { readonly failSilhouetteMode?: boolean; readonly failDispose?: boolean } = {},
) {
  const dispose = vi.fn(() => {
    if (options.failDispose) throw new Error("synthetic disposal failure");
  });
  const root = { kind: "scene-root" };
  const deriveBrickScene = vi.fn((subject: unknown, sceneOptions: unknown) => {
    void subject;
    void sceneOptions;
    return { root, dispose };
  });
  const setInstructionSilhouetteMode = vi.fn(() => {
    if (options.failSilhouetteMode) throw new Error("synthetic setup failure");
  });
  const createOrthographicViewCamera = vi.fn((view, frame) => ({ view, frame }));
  const shared = new Uint8Array(8);
  let renders = 0;
  const render = vi.fn(() => {
    renders += 1;
    shared.set(renders === 1 ? [...PROBE, ...BACKGROUND] : [...BACKGROUND, 0, 0, 0, 0xff]);
    return shared;
  });
  return {
    rendering: { deriveBrickScene, setInstructionSilhouetteMode, createOrthographicViewCamera },
    renderer: { render },
    deriveBrickScene,
    setInstructionSilhouetteMode,
    createOrthographicViewCamera,
    dispose,
    render,
  };
}

describe("prepared step silhouette", () => {
  it("derives once, copies a shared readback buffer, and disposes exactly once", () => {
    const subject = {
      parts: [
        { id: "probe", colorId: "builtin:black" },
        { id: "retained", colorId: "builtin:green" },
      ],
    };
    const controlled = harness();
    const prepared = prepareStepSilhouette({
      rendering: controlled.rendering,
      renderer: controlled.renderer,
      subject,
      probePartIds: "probe",
      frame: FRAME,
      widthPx: 2,
      heightPx: 1,
    });

    const first = prepared.render(VIEW, [1, 0.5]);
    const second = prepared.render({ ...VIEW, azimuthDegrees: 125 }, [1, 0.5]);

    expect(controlled.deriveBrickScene).toHaveBeenCalledOnce();
    expect(controlled.deriveBrickScene.mock.calls[0]![0]).toMatchObject({
      parts: [
        { id: "probe", colorId: "builtin:magenta" },
        { id: "retained", colorId: "builtin:green" },
      ],
    });
    expect(controlled.setInstructionSilhouetteMode).toHaveBeenCalledOnce();
    expect(controlled.render).toHaveBeenCalledTimes(2);
    expect(first).toEqual({ all: new Uint8Array([1, 0]), probe: new Uint8Array([1, 0]) });
    expect(second).toEqual({ all: new Uint8Array([0, 1]), probe: new Uint8Array([0, 0]) });
    expect(first).toEqual({ all: new Uint8Array([1, 0]), probe: new Uint8Array([1, 0]) });

    prepared.dispose();
    prepared.dispose();
    expect(controlled.dispose).toHaveBeenCalledOnce();
    expect(() => prepared.render(VIEW, [1, 0.5])).toThrow(/disposed prepared step silhouette/u);
  });

  it("cleans a partially prepared scene and preserves one-shot compatibility", () => {
    const failed = harness({ failSilhouetteMode: true });
    expect(() =>
      prepareStepSilhouette({
        rendering: failed.rendering,
        renderer: failed.renderer,
        subject: { parts: [] },
        probePartIds: null,
        frame: FRAME,
        widthPx: 2,
        heightPx: 1,
      }),
    ).toThrow(/synthetic setup failure/u);
    expect(failed.dispose).toHaveBeenCalledOnce();

    const doublyFailed = harness({ failSilhouetteMode: true, failDispose: true });
    expect(() =>
      prepareStepSilhouette({
        rendering: doublyFailed.rendering,
        renderer: doublyFailed.renderer,
        subject: { parts: [] },
        probePartIds: null,
        frame: FRAME,
        widthPx: 2,
        heightPx: 1,
      }),
    ).toThrow(/partially prepared scene could not be disposed/u);

    const controlled = harness();
    const silhouette = createStepSilhouette({
      rendering: controlled.rendering,
      renderer: controlled.renderer,
      view: VIEW,
      frame: FRAME,
      widthPx: 2,
      heightPx: 1,
    });
    expect(silhouette({ parts: [] }, null, [1, 0.5]).all).toEqual(new Uint8Array([1, 0]));
    expect(controlled.deriveBrickScene).toHaveBeenCalledOnce();
    expect(controlled.dispose).toHaveBeenCalledOnce();
  });

  it("captures the one-shot configuration once instead of rereading caller accessors", () => {
    const controlled = harness();
    let viewReads = 0;
    const configuration = {
      rendering: controlled.rendering,
      renderer: controlled.renderer,
      frame: FRAME,
      widthPx: 2,
      heightPx: 1,
    } as Record<string, unknown>;
    Object.defineProperty(configuration, "view", {
      configurable: true,
      enumerable: true,
      get: () => {
        viewReads += 1;
        return VIEW;
      },
    });
    const silhouette = createStepSilhouette(
      configuration as Parameters<typeof createStepSilhouette>[0],
    );
    Object.defineProperty(configuration, "view", {
      configurable: true,
      enumerable: true,
      value: { ...VIEW, azimuthDegrees: 215 },
    });

    silhouette({ parts: [] }, null, [1, 0.5]);

    expect(viewReads).toBe(1);
    expect(controlled.createOrthographicViewCamera.mock.calls[0]![0]).toMatchObject({
      azimuthDegrees: VIEW.azimuthDegrees,
    });
  });
});
