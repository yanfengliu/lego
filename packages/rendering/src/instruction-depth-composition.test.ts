import { describe, expect, it } from "vitest";

import {
  INSTRUCTION_DEPTH_CLEAR,
  INSTRUCTION_DEPTH_COMPOSITION_SCHEMA,
  MAX_INSTRUCTION_DEPTH_COMPOSITION_PIXELS,
  composeInstructionDepthPrefixWithSparseProbe,
  composeInstructionDepthSurfaces,
  createInstructionDepthCompatibility,
  createInstructionSparseDepthSurfaceFromReadback,
  createInstructionDepthSurfaceFromReadback,
  type InstructionDepthCameraState,
  type InstructionDepthCompatibility,
  type InstructionDepthSurface,
  type InstructionSparseDepthSurface,
} from "./instruction-depth-composition.ts";
const BACKGROUND_HEX = 0x010203;
const IDENTITY = Object.freeze([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);

function compatibility(
  overrides: Partial<InstructionDepthCompatibility> = {},
): InstructionDepthCompatibility {
  return {
    schemaVersion: INSTRUCTION_DEPTH_COMPOSITION_SCHEMA,
    rendererInstanceKey: "test-renderer:1",
    width: 3,
    height: 1,
    backgroundHex: BACKGROUND_HEX,
    contextVendor: "test-vendor",
    contextRenderer: "test-renderer",
    contextVersion: "WebGL 2 test",
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
    ...overrides,
  };
}

function camera(overrides: Partial<InstructionDepthCameraState> = {}): InstructionDepthCameraState {
  return {
    projectionMatrix: IDENTITY,
    matrixWorldInverse: IDENTITY,
    layersMask: 1,
    coordinateSystem: 2000,
    ...overrides,
  };
}

function rgba(hexes: readonly number[]): Uint8Array {
  const bytes = new Uint8Array(hexes.length * 4);
  for (let index = 0; index < hexes.length; index += 1) {
    const hex = hexes[index]!;
    bytes.set([(hex >> 16) & 0xff, (hex >> 8) & 0xff, hex & 0xff, 0xff], index * 4);
  }
  return bytes;
}

function surface(input: {
  readonly subjectKey: string;
  readonly color: readonly number[];
  readonly depth: readonly number[];
  readonly compatibility?: InstructionDepthCompatibility;
  readonly camera?: InstructionDepthCameraState;
}): InstructionDepthSurface {
  return createInstructionDepthSurfaceFromReadback({
    subjectKey: input.subjectKey,
    compatibility: input.compatibility ?? compatibility(),
    camera: input.camera ?? camera(),
    color: rgba(input.color),
    depth: new Uint32Array(input.depth),
  });
}

function sparseSurface(input: {
  readonly subjectKey: string;
  readonly color: readonly number[];
  readonly depth: readonly number[];
  readonly compatibility?: InstructionDepthCompatibility;
  readonly camera?: InstructionDepthCameraState;
}): InstructionSparseDepthSurface {
  return createInstructionSparseDepthSurfaceFromReadback({
    subjectKey: input.subjectKey,
    compatibility: input.compatibility ?? compatibility(),
    camera: input.camera ?? camera(),
    color: rgba(input.color),
    depth: new Uint32Array(input.depth),
  });
}

describe("exact instruction depth composition", () => {
  it("selects each strict depth minimum and preserves top-to-bottom RGBA", () => {
    const prefix = surface({
      subjectKey: "prefix",
      color: [0xaa0000, 0x00aa00, BACKGROUND_HEX],
      depth: [100, 300, INSTRUCTION_DEPTH_CLEAR],
    });
    const probe = surface({
      subjectKey: "probe",
      color: [0x0000aa, 0xaaaa00, 0xaa00aa],
      depth: [200, 250, 50],
    });

    const result = composeInstructionDepthSurfaces(prefix, probe);

    expect(result).toMatchObject({
      status: "composed",
      prefixVisiblePixels: 1,
      probeVisiblePixels: 2,
      prefixSubjectKey: "prefix",
      probeSubjectKey: "probe",
    });
    if (result.status !== "composed") return;
    expect([...result.pixels]).toEqual([...rgba([0xaa0000, 0xaaaa00, 0xaa00aa])]);
    expect([...result.probeVisibleMask]).toEqual([0, 1, 1]);
  });

  it("treats the exact clear code as empty without mistaking it for a tie", () => {
    const prefix = surface({
      subjectKey: "empty-prefix",
      color: [BACKGROUND_HEX, 0xaa0000, BACKGROUND_HEX],
      depth: [INSTRUCTION_DEPTH_CLEAR, 100, INSTRUCTION_DEPTH_CLEAR],
    });
    const probe = surface({
      subjectKey: "partly-empty-probe",
      color: [0x0000aa, BACKGROUND_HEX, BACKGROUND_HEX],
      depth: [20, INSTRUCTION_DEPTH_CLEAR, INSTRUCTION_DEPTH_CLEAR],
    });

    const result = composeInstructionDepthSurfaces(prefix, probe);

    expect(result.status).toBe("composed");
    if (result.status !== "composed") return;
    expect(result.prefixVisiblePixels).toBe(1);
    expect(result.probeVisiblePixels).toBe(1);
    expect([...result.pixels]).toEqual([...rgba([0x0000aa, 0xaa0000, BACKGROUND_HEX])]);
    expect([...result.probeVisibleMask]).toEqual([1, 0, 0]);
  });

  it("keeps adjacent stored 24-bit depths distinct immediately below clear", () => {
    const prefix = surface({
      subjectKey: "prefix-near-clear",
      color: [0xaa0000, BACKGROUND_HEX, BACKGROUND_HEX],
      depth: [INSTRUCTION_DEPTH_CLEAR - 2, INSTRUCTION_DEPTH_CLEAR, INSTRUCTION_DEPTH_CLEAR],
    });
    const probe = surface({
      subjectKey: "probe-near-clear",
      color: [0x0000aa, BACKGROUND_HEX, BACKGROUND_HEX],
      depth: [INSTRUCTION_DEPTH_CLEAR - 3, INSTRUCTION_DEPTH_CLEAR, INSTRUCTION_DEPTH_CLEAR],
    });

    const result = composeInstructionDepthSurfaces(prefix, probe);

    expect(result.status).toBe("composed");
    if (result.status !== "composed") return;
    expect([...result.pixels.slice(0, 4)]).toEqual([...rgba([0x0000aa])]);
  });

  it("returns no candidate pixels for an equal non-clear LEQUAL depth", () => {
    const prefix = surface({
      subjectKey: "prefix-tie",
      color: [0xaa0000, BACKGROUND_HEX, BACKGROUND_HEX],
      depth: [123, INSTRUCTION_DEPTH_CLEAR, INSTRUCTION_DEPTH_CLEAR],
    });
    const probe = surface({
      subjectKey: "probe-tie",
      color: [0xaa0000, BACKGROUND_HEX, BACKGROUND_HEX],
      depth: [123, INSTRUCTION_DEPTH_CLEAR, INSTRUCTION_DEPTH_CLEAR],
    });

    const result = composeInstructionDepthSurfaces(prefix, probe);

    expect(result).toEqual({
      status: "refused",
      reason: "equal-depth-tie",
      message:
        'Prefix "prefix-tie" and probe "probe-tie" both resolve to depth 123 at pixel 0; LEQUAL ownership depends on whole-scene draw order.',
      pixelIndex: 0,
      x: 0,
      y: 0,
      depth: 123,
    });
    expect("pixels" in result).toBe(false);
  });

  it("refuses renderer-instance and exact-camera mismatches", () => {
    const prefix = surface({
      subjectKey: "prefix-frame",
      color: [BACKGROUND_HEX, BACKGROUND_HEX, BACKGROUND_HEX],
      depth: [INSTRUCTION_DEPTH_CLEAR, INSTRUCTION_DEPTH_CLEAR, INSTRUCTION_DEPTH_CLEAR],
    });
    const otherRenderer = surface({
      subjectKey: "other-renderer",
      compatibility: compatibility({ rendererInstanceKey: "test-renderer:2" }),
      color: [BACKGROUND_HEX, BACKGROUND_HEX, BACKGROUND_HEX],
      depth: [INSTRUCTION_DEPTH_CLEAR, INSTRUCTION_DEPTH_CLEAR, INSTRUCTION_DEPTH_CLEAR],
    });
    const shiftedMatrix = [...IDENTITY];
    shiftedMatrix[12] = 1;
    const otherCamera = surface({
      subjectKey: "other-camera",
      camera: camera({ matrixWorldInverse: shiftedMatrix }),
      color: [BACKGROUND_HEX, BACKGROUND_HEX, BACKGROUND_HEX],
      depth: [INSTRUCTION_DEPTH_CLEAR, INSTRUCTION_DEPTH_CLEAR, INSTRUCTION_DEPTH_CLEAR],
    });

    expect(composeInstructionDepthSurfaces(prefix, otherRenderer)).toMatchObject({
      status: "refused",
      reason: "incompatible-frame",
    });
    expect(composeInstructionDepthSurfaces(prefix, otherCamera)).toMatchObject({
      status: "refused",
      reason: "incompatible-frame",
    });
  });

  it("copies readbacks defensively and never exposes mutable cached bytes", () => {
    const inputColor = rgba([0xaa0000, BACKGROUND_HEX, BACKGROUND_HEX]);
    const inputDepth = new Uint32Array([100, INSTRUCTION_DEPTH_CLEAR, INSTRUCTION_DEPTH_CLEAR]);
    const retained = createInstructionDepthSurfaceFromReadback({
      subjectKey: "immutable",
      compatibility: compatibility(),
      camera: camera(),
      color: inputColor,
      depth: inputDepth,
    });
    inputColor[0] = 0;
    inputDepth[0] = 999;
    const copiedColor = retained.copyColor();
    const copiedDepth = retained.copyDepth();
    copiedColor[0] = 0;
    copiedDepth[0] = 999;

    expect([...retained.copyColor().slice(0, 4)]).toEqual([...rgba([0xaa0000])]);
    expect(retained.copyDepth()[0]).toBe(100);
  });

  it("rejects malformed depth declarations, far-plane ambiguity, and oversized rasters", () => {
    const forged = {
      ...compatibility(),
      depthAttachmentBits: 16,
    } as unknown as InstructionDepthCompatibility;
    expect(() => createInstructionDepthCompatibility(forged)).toThrow(/does not declare the exact/);
    expect(() =>
      surface({
        subjectKey: "far-plane-ambiguous",
        color: [0xaa0000, BACKGROUND_HEX, BACKGROUND_HEX],
        depth: [INSTRUCTION_DEPTH_CLEAR, INSTRUCTION_DEPTH_CLEAR, INSTRUCTION_DEPTH_CLEAR],
      }),
    ).toThrow(/clear depth code but non-background color/);
    expect(() =>
      createInstructionDepthCompatibility(
        compatibility({
          width: Math.sqrt(MAX_INSTRUCTION_DEPTH_COMPOSITION_PIXELS) + 1,
          height: Math.sqrt(MAX_INSTRUCTION_DEPTH_COMPOSITION_PIXELS) + 1,
        }),
      ),
    ).toThrow(/bounded to 4194304 pixels/);
  });

  it("refuses structurally forged surface objects", () => {
    const fake = {
      subjectKey: "fake",
      compatibility: compatibility(),
      camera: camera(),
      copyColor: () =>
        new Uint8ClampedArray(rgba([BACKGROUND_HEX, BACKGROUND_HEX, BACKGROUND_HEX])),
      copyDepth: () =>
        new Uint32Array([
          INSTRUCTION_DEPTH_CLEAR,
          INSTRUCTION_DEPTH_CLEAR,
          INSTRUCTION_DEPTH_CLEAR,
        ]),
    };
    Object.defineProperty(
      fake,
      Symbol.for("lego.instruction-depth-composition.surface-storage/1"),
      {
        value: {
          copyColor: fake.copyColor,
          copyDepth: fake.copyDepth,
          compatibilityKey: JSON.stringify(fake.compatibility),
          cameraKey: JSON.stringify(fake.camera),
        },
      },
    );

    expect(composeInstructionDepthSurfaces(fake, fake)).toMatchObject({
      status: "refused",
      reason: "unrecognized-surface",
    });
  });

  it("composes a sparse probe against the dense prefix without retaining clear pixels", () => {
    const prefix = surface({
      subjectKey: "dense-prefix",
      color: [0xaa0000, 0x00aa00, BACKGROUND_HEX],
      depth: [100, 300, INSTRUCTION_DEPTH_CLEAR],
    });
    const probe = sparseSurface({
      subjectKey: "sparse-probe",
      color: [0x0000aa, 0xaaaa00, BACKGROUND_HEX],
      depth: [200, 250, INSTRUCTION_DEPTH_CLEAR],
    });

    expect(probe.nonClearPixels).toBe(2);
    expect([...probe.copyPixelIndices()]).toEqual([0, 1]);
    expect([...probe.copyDepth()]).toEqual([200, 250]);
    expect(composeInstructionDepthPrefixWithSparseProbe(prefix, probe)).toMatchObject({
      status: "composed",
      probeVisiblePixels: 1,
      probeVisibleMask: new Uint8Array([0, 1, 0]),
      prefixSubjectKey: "dense-prefix",
      probeSubjectKey: "sparse-probe",
    });
  });

  it("refuses sparse equal-depth ties, incompatible frames, and structural forgeries", () => {
    const prefix = surface({
      subjectKey: "sparse-prefix",
      color: [0xaa0000, BACKGROUND_HEX, BACKGROUND_HEX],
      depth: [123, INSTRUCTION_DEPTH_CLEAR, INSTRUCTION_DEPTH_CLEAR],
    });
    const tie = sparseSurface({
      subjectKey: "sparse-tie",
      color: [0x0000aa, BACKGROUND_HEX, BACKGROUND_HEX],
      depth: [123, INSTRUCTION_DEPTH_CLEAR, INSTRUCTION_DEPTH_CLEAR],
    });
    const otherFrame = sparseSurface({
      subjectKey: "sparse-other-frame",
      compatibility: compatibility({ rendererInstanceKey: "test-renderer:other" }),
      color: [0x0000aa, BACKGROUND_HEX, BACKGROUND_HEX],
      depth: [100, INSTRUCTION_DEPTH_CLEAR, INSTRUCTION_DEPTH_CLEAR],
    });
    const fake = {
      subjectKey: "sparse-fake",
      compatibility: compatibility(),
      camera: camera(),
      nonClearPixels: 1,
      copyPixelIndices: () => new Uint32Array([0]),
      copyDepth: () => new Uint32Array([100]),
    };

    expect(composeInstructionDepthPrefixWithSparseProbe(prefix, tie)).toMatchObject({
      status: "refused",
      reason: "equal-depth-tie",
      pixelIndex: 0,
      depth: 123,
    });
    expect(composeInstructionDepthPrefixWithSparseProbe(prefix, otherFrame)).toMatchObject({
      status: "refused",
      reason: "incompatible-frame",
    });
    expect(composeInstructionDepthPrefixWithSparseProbe(prefix, fake)).toMatchObject({
      status: "refused",
      reason: "unrecognized-surface",
    });
  });

  it("copies sparse readbacks defensively and never exposes mutable cached entries", () => {
    const inputColor = rgba([0xaa0000, BACKGROUND_HEX, 0x00aa00]);
    const inputDepth = new Uint32Array([100, INSTRUCTION_DEPTH_CLEAR, 300]);
    const retained = createInstructionSparseDepthSurfaceFromReadback({
      subjectKey: "sparse-immutable",
      compatibility: compatibility(),
      camera: camera(),
      color: inputColor,
      depth: inputDepth,
    });
    inputColor[0] = 0;
    inputDepth[0] = 999;
    const copiedIndices = retained.copyPixelIndices();
    const copiedDepth = retained.copyDepth();
    copiedIndices[0] = 2;
    copiedDepth[0] = 999;

    expect([...retained.copyPixelIndices()]).toEqual([0, 2]);
    expect([...retained.copyDepth()]).toEqual([100, 300]);
  });
});
