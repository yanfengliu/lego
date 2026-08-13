import { expect, it } from "vitest";

import { derivePanelArtStages } from "../src/assembly/panel-art-stages";
import { derivePanelRasterEvidence } from "./real-build-panel-raster";
import { copyRealBuildPanelCalibrationHighRgba } from "./real-build-panel-raster-calibration-snapshot";

it("retains isolated copy-on-read high RGBA only when calibration explicitly requests it", () => {
  const pixels = new Uint8ClampedArray(10 * 10 * 4);
  for (let pixel = 0; pixel < 100; pixel += 1) {
    pixels[pixel * 4] = 0x89;
    pixels[pixel * 4 + 1] = 0x90;
    pixels[pixel * 4 + 2] = 0x93;
    pixels[pixel * 4 + 3] = 255;
  }
  const crop = {
    width: 0,
    height: 0,
    remove: () => undefined,
    getContext: () => ({
      imageSmoothingEnabled: false,
      drawImage: () => undefined,
      getImageData: () => ({ data: new Uint8ClampedArray(pixels) }),
    }),
  };
  const previousDocument = globalThis.document;
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: { createElement: () => crop },
  });
  const highlight = {
    regions: [],
    closedContourRate: 0,
    keyedPx: 0,
    mask: new Uint8Array(100),
    strokeMask: new Uint8Array(100),
    contourStrokeMask: new Uint8Array(100),
  };
  const assembly = {
    derivePanelArtStages,
    downsampleRaster: (raster: unknown) => raster,
    extractHighlightRegions: () => highlight,
    alreadyBuiltMask: () => new Uint8Array(100),
    readDisplacementArrows: () => ({
      arrows: [],
      rejected: [],
      redPx: 0,
      displacementXPx: null,
      displacementYPx: null,
    }),
    highlightBounds: () => null,
  };
  const lattice = {
    buildStudTextureField: () => ({}),
    fitStudLattice: () => ({ solution: null, failure: "synthetic", coherence: 0 }),
  };
  const common = {
    pageCanvas: { width: 100, height: 100 } as HTMLCanvasElement,
    spec: {
      stepNumber: 90,
      pageNumber: 79,
      panelFace: null,
      minXPt: 0,
      maxXPt: 10,
      minYPt: 0,
      maxYPt: 10,
      calloutBoxes: [],
    } as never,
    options: {
      renderScale: 1,
      panelWidth: 10,
      workFactor: 1,
      proximityMarginPx: 1,
    },
    modules: { assembly, lattice } as never,
  } as const;
  try {
    expect(derivePanelRasterEvidence(common).calibrationHighRgba).toBeUndefined();
    const retained = derivePanelRasterEvidence({
      ...common,
      retainCalibrationHighRgba: true,
    }).calibrationHighRgba;
    expect(retained).toMatchObject({
      encoding: "rgba8-clamped/1",
      width: 10,
      height: 10,
      pixelCount: 100,
      byteLength: 400,
    });
    pixels[0] = 0;
    const firstCopy = copyRealBuildPanelCalibrationHighRgba(retained);
    expect(firstCopy[0]).toBe(0x89);
    firstCopy[0] = 0;
    expect(copyRealBuildPanelCalibrationHighRgba(retained)[0]).toBe(0x89);
    expect(() => copyRealBuildPanelCalibrationHighRgba({ ...retained })).toThrow(
      /storage-integrity snapshot.*does not authenticate pixel origin/su,
    );
  } finally {
    Object.defineProperty(globalThis, "document", {
      configurable: true,
      value: previousDocument,
    });
  }
});
