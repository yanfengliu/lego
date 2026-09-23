import { describe, expect, it, vi } from "vitest";

import {
  requireInstructionViewCaptureBounds,
  withInstructionViewCaptureStateRestored,
} from "./instruction-view-capture-contract";

describe("instruction-view capture contract", () => {
  it.each([-1, 0x1000000, 1.5, Number.NaN])(
    "rejects invalid backgroundHex %s before renderer state changes",
    (backgroundHex) => {
      expect(() =>
        requireInstructionViewCaptureBounds({
          scene: "model-only",
          renderMode: "instruction-art",
          backgroundHex,
          frame: { widthPx: 720, heightPx: 470 },
        }),
      ).toThrow(/backgroundHex/u);
    },
  );

  it.each([undefined, "beauty", "material", 1])(
    "rejects invalid renderMode %s before renderer state changes",
    (renderMode) => {
      expect(() =>
        requireInstructionViewCaptureBounds({
          scene: "model-only",
          renderMode,
          backgroundHex: 0x899093,
          frame: { widthPx: 720, heightPx: 470 },
        }),
      ).toThrow(/renderMode/u);
    },
  );

  it("requires a bounded sorted semantic roster and rejects one on instruction art", () => {
    expect(
      requireInstructionViewCaptureBounds({
        scene: "model-only",
        renderMode: "semantic-color-id-mask",
        targetColorIds: ["builtin:blue", "builtin:dark-blue"],
        backgroundHex: 0x899093,
        frame: { widthPx: 720, heightPx: 470 },
      }).targetColorIds,
    ).toEqual(["builtin:blue", "builtin:dark-blue"]);
    expect(() =>
      requireInstructionViewCaptureBounds({
        scene: "model-only",
        renderMode: "semantic-color-id-mask",
        targetColorIds: ["builtin:dark-blue", "builtin:blue"],
        backgroundHex: 0x899093,
        frame: { widthPx: 720, heightPx: 470 },
      }),
    ).toThrow(/strictly sorted/u);
    expect(() =>
      requireInstructionViewCaptureBounds({
        scene: "model-only",
        renderMode: "instruction-art",
        targetColorIds: ["builtin:blue"],
        backgroundHex: 0x899093,
        frame: { widthPx: 720, heightPx: 470 },
      }),
    ).toThrow(/must not carry/u);
  });

  it("restores mutable renderer state when capture throws", () => {
    const restore = vi.fn();
    expect(() =>
      withInstructionViewCaptureStateRestored(() => {
        throw new Error("renderer failed");
      }, restore),
    ).toThrow("renderer failed");
    expect(restore).toHaveBeenCalledOnce();
  });
});
