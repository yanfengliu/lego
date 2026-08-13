import { describe, expect, it } from "vitest";

import { clearPdfBoxes, type PdfPointBox } from "../src/assembly/panel-art";
import { derivePanelArtStages } from "../src/assembly/panel-art-stages";
import {
  derivePanelRasterEvidence,
  mappedPanelCalloutRectangles,
  MAXIMUM_REAL_BUILD_PAGE_RASTER_PIXELS,
  renderRealBuildPageCanvas,
} from "./real-build-panel-raster";

describe("mappedPanelCalloutRectangles", () => {
  it("clears exactly the pixels the historical PDF-box composition cleared", () => {
    const width = 37;
    const height = 23;
    const crop = {
      width,
      height,
      renderScale: 2,
      sourceXPx: 53,
      sourceYPx: 71,
      ratio: 0.73,
      pageHeightPx: 842,
      marginPx: 4,
    } as const;
    const boxes: readonly PdfPointBox[] = [
      { minXPt: 30, maxXPt: 43, minYPt: 374, maxYPt: 386 },
      { minXPt: 42.4, maxXPt: 60.2, minYPt: 371.1, maxYPt: 393.7 },
      { minXPt: -200, maxXPt: -150, minYPt: -200, maxYPt: -150 },
    ];
    const historical = new Uint8Array(width * height).fill(1);
    clearPdfBoxes(historical, crop, boxes);

    const mapped = mappedPanelCalloutRectangles({
      ...crop,
      boxes,
    });
    const replacement = new Uint8Array(width * height).fill(1);
    for (const rectangle of mapped) {
      for (let y = rectangle.minY; y <= rectangle.maxY; y += 1) {
        replacement.fill(0, y * width + rectangle.minX, y * width + rectangle.maxX + 1);
      }
    }

    expect(replacement).toEqual(historical);
  });

  it("refuses an oversized crop before creating or sizing its canvas", () => {
    let created = 0;
    const previousDocument = globalThis.document;
    Object.defineProperty(globalThis, "document", {
      configurable: true,
      value: {
        createElement: () => {
          created += 1;
          throw new Error("canvas must not be created");
        },
      },
    });
    try {
      expect(() =>
        derivePanelRasterEvidence({
          pageCanvas: { width: 1_000, height: 10_000 } as HTMLCanvasElement,
          spec: {
            stepNumber: 90,
            pageNumber: 1,
            panelFace: null,
            minXPt: 0,
            maxXPt: 1,
            minYPt: 0,
            maxYPt: 10_000,
            calloutBoxes: [],
          } as never,
          options: {
            renderScale: 1,
            panelWidth: 1_000,
            workFactor: 2,
            proximityMarginPx: 1,
          },
          modules: { assembly: {}, lattice: {} } as never,
        }),
      ).toThrow(/crop 1000x10000000.*4194304 pixels before canvas allocation/su);
      expect(created).toBe(0);
    } finally {
      Object.defineProperty(globalThis, "document", {
        configurable: true,
        value: previousDocument,
      });
    }
  });

  it("refuses oversized work-stage allocation before creating a crop canvas", () => {
    let created = 0;
    const previousDocument = globalThis.document;
    Object.defineProperty(globalThis, "document", {
      configurable: true,
      value: {
        createElement: () => {
          created += 1;
          throw new Error("canvas must not be created");
        },
      },
    });
    try {
      expect(() =>
        derivePanelRasterEvidence({
          pageCanvas: { width: 100, height: 100 } as HTMLCanvasElement,
          spec: {
            stepNumber: 90,
            pageNumber: 1,
            panelFace: null,
            minXPt: 0,
            maxXPt: 2,
            minYPt: 0,
            maxYPt: 1,
            calloutBoxes: [],
          } as never,
          options: {
            renderScale: 1,
            panelWidth: 2_048,
            workFactor: 1,
            proximityMarginPx: 1,
          },
          modules: { assembly: {}, lattice: {} } as never,
        }),
      ).toThrow(/work raster 2048x1024.*1048576 pixels before canvas allocation/su);
      expect(created).toBe(0);
    } finally {
      Object.defineProperty(globalThis, "document", {
        configurable: true,
        value: previousDocument,
      });
    }
  });

  it("refuses non-exact or non-positive callout bounds before creating a crop canvas", () => {
    let created = 0;
    const previousDocument = globalThis.document;
    Object.defineProperty(globalThis, "document", {
      configurable: true,
      value: {
        createElement: () => {
          created += 1;
          throw new Error("canvas must not be created");
        },
      },
    });
    const base = {
      stepNumber: 90,
      pageNumber: 1,
      panelFace: null,
      minXPt: 0,
      maxXPt: 10,
      minYPt: 0,
      maxYPt: 10,
    } as const;
    const invalidCallouts: readonly unknown[] = [
      Object.assign(Object.create(null) as object, {
        minXPt: 1,
        maxXPt: 2,
        minYPt: 1,
        maxYPt: 2,
      }),
      { minXPt: 1, maxXPt: 2, minYPt: 1, maxYPt: 2, extra: true },
      { minXPt: 1, maxXPt: Number.NaN, minYPt: 1, maxYPt: 2 },
      { minXPt: 2, maxXPt: 2, minYPt: 1, maxYPt: 2 },
    ];
    try {
      for (const callout of invalidCallouts) {
        expect(() =>
          derivePanelRasterEvidence({
            pageCanvas: { width: 100, height: 100 } as HTMLCanvasElement,
            spec: { ...base, calloutBoxes: [callout] } as never,
            options: {
              renderScale: 1,
              panelWidth: 10,
              workFactor: 1,
              proximityMarginPx: 1,
            },
            modules: { assembly: {}, lattice: {} } as never,
          }),
        ).toThrow(
          /calloutBoxes\[0\].*(before crop allocation|ordinary plain object)|must contain exactly|finite|positive/su,
        );
      }
      expect(created).toBe(0);
    } finally {
      Object.defineProperty(globalThis, "document", {
        configurable: true,
        value: previousDocument,
      });
    }
  });

  it("refuses spec, bounds, callout, and sparse-array accessors before crop allocation", () => {
    let created = 0;
    let accessorReads = 0;
    const previousDocument = globalThis.document;
    Object.defineProperty(globalThis, "document", {
      configurable: true,
      value: { createElement: () => (created += 1) },
    });
    const base = {
      stepNumber: 90,
      pageNumber: 1,
      panelFace: null,
      minXPt: 0,
      maxXPt: 10,
      minYPt: 0,
      maxYPt: 10,
      calloutBoxes: [],
    };
    const specBoundsAccessor = { ...base };
    Object.defineProperty(specBoundsAccessor, "minXPt", {
      enumerable: true,
      get: () => {
        accessorReads += 1;
        return 0;
      },
    });
    const specCalloutAccessor = { ...base };
    Object.defineProperty(specCalloutAccessor, "calloutBoxes", {
      enumerable: true,
      get: () => {
        accessorReads += 1;
        return [];
      },
    });
    const calloutAccessor = { minXPt: 1, maxXPt: 2, minYPt: 1, maxYPt: 2 };
    Object.defineProperty(calloutAccessor, "maxXPt", {
      enumerable: true,
      get: () => {
        accessorReads += 1;
        return 2;
      },
    });
    const sparseCallouts = new Array(1);
    const hostileSpecs = [
      specBoundsAccessor,
      specCalloutAccessor,
      { ...base, calloutBoxes: [calloutAccessor] },
      { ...base, calloutBoxes: sparseCallouts },
    ];
    try {
      for (const spec of hostileSpecs) {
        expect(() =>
          derivePanelRasterEvidence({
            pageCanvas: { width: 100, height: 100 } as HTMLCanvasElement,
            spec: spec as never,
            options: {
              renderScale: 1,
              panelWidth: 10,
              workFactor: 1,
              proximityMarginPx: 1,
            },
            modules: { assembly: {}, lattice: {} } as never,
          }),
        ).toThrow(/own data property|ordinary dense array/su);
      }
      expect(accessorReads).toBe(0);
      expect(created).toBe(0);
    } finally {
      Object.defineProperty(globalThis, "document", {
        configurable: true,
        value: previousDocument,
      });
    }
  });

  it("refuses an oversized PDF viewport before creating or sizing its canvas", async () => {
    let created = 0;
    let cleaned = 0;
    const previousDocument = globalThis.document;
    Object.defineProperty(globalThis, "document", {
      configurable: true,
      value: { createElement: () => (created += 1) },
    });
    try {
      const pdf = {
        getPage: async () => ({
          getViewport: () => ({ width: MAXIMUM_REAL_BUILD_PAGE_RASTER_PIXELS + 1, height: 1 }),
          cleanup: () => {
            cleaned += 1;
          },
        }),
      };
      await expect(renderRealBuildPageCanvas(pdf as never, 1, 1)).rejects.toThrow(
        /viewport.*33554432 pixels before canvas allocation/su,
      );
      expect(created).toBe(0);
      expect(cleaned).toBe(1);
    } finally {
      Object.defineProperty(globalThis, "document", {
        configurable: true,
        value: previousDocument,
      });
    }
  });

  it("cleans an acquired PDF page when viewport inspection throws", async () => {
    let cleaned = 0;
    const pdf = {
      getPage: async () => ({
        getViewport: () => {
          throw new Error("hostile viewport");
        },
        cleanup: () => {
          cleaned += 1;
        },
      }),
    };

    await expect(renderRealBuildPageCanvas(pdf as never, 1, 1)).rejects.toThrow(
      /hostile viewport/su,
    );
    expect(cleaned).toBe(1);
  });

  it("always releases the crop and bounds highlight candidate-mask work", () => {
    const pixels = new Uint8ClampedArray(10 * 10 * 4);
    for (let pixel = 0; pixel < 100; pixel += 1) {
      pixels[pixel * 4] = 0x89;
      pixels[pixel * 4 + 1] = 0x90;
      pixels[pixel * 4 + 2] = 0x93;
      pixels[pixel * 4 + 3] = 255;
    }
    let removed = 0;
    let boundedHighlightPixels = 0;
    let liveGeometryReads = 0;
    const rejectLiveReads = <T extends object>(value: T): T =>
      new Proxy(value, {
        get: () => {
          liveGeometryReads += 1;
          throw new Error("preflight snapshot must prevent every live geometry read");
        },
      });
    const crop = {
      width: 0,
      height: 0,
      remove: () => {
        removed += 1;
      },
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
    const callout = rejectLiveReads({ minXPt: 20, maxXPt: 21, minYPt: 20, maxYPt: 21 });
    const calloutBoxes = rejectLiveReads([callout]);
    const spec = rejectLiveReads({
      stepNumber: 1,
      pageNumber: 1,
      panelFace: null,
      minXPt: 0,
      maxXPt: 10,
      minYPt: 0,
      maxYPt: 10,
      calloutBoxes,
    }) as never;
    const options = {
      renderScale: 1,
      panelWidth: 10,
      workFactor: 1,
      proximityMarginPx: 1,
    } as const;
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
      extractHighlightRegions: (
        _rgba: unknown,
        _width: unknown,
        _height: unknown,
        extraction: { readonly maximumAggregateCandidateMaskPixels: number },
      ) => {
        boundedHighlightPixels = extraction.maximumAggregateCandidateMaskPixels;
        return highlight;
      },
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
    try {
      const evidence = derivePanelRasterEvidence({
        pageCanvas: { width: 100, height: 100 } as HTMLCanvasElement,
        spec,
        options,
        modules: { assembly, lattice } as never,
      });
      expect(evidence.width).toBe(10);
      expect(boundedHighlightPixels).toBe(6_400);
      expect(liveGeometryReads).toBe(0);
      expect(crop.width).toBe(0);
      expect(crop.height).toBe(0);
      expect(removed).toBe(1);
    } finally {
      Object.defineProperty(globalThis, "document", {
        configurable: true,
        value: previousDocument,
      });
    }
  });

  it("releases the crop when a downstream lattice callback throws", () => {
    const crop = {
      width: 0,
      height: 0,
      removed: false,
      remove() {
        this.removed = true;
      },
      getContext: () => ({
        imageSmoothingEnabled: false,
        drawImage: () => undefined,
        getImageData: () => ({ data: new Uint8ClampedArray(10 * 10 * 4) }),
      }),
    };
    const previousDocument = globalThis.document;
    Object.defineProperty(globalThis, "document", {
      configurable: true,
      value: { createElement: () => crop },
    });
    try {
      expect(() =>
        derivePanelRasterEvidence({
          pageCanvas: { width: 100, height: 100 } as HTMLCanvasElement,
          spec: {
            stepNumber: 1,
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
          modules: {
            assembly: { derivePanelArtStages },
            lattice: {
              buildStudTextureField: () => {
                throw new Error("lattice failed");
              },
            },
          } as never,
        }),
      ).toThrow(/lattice failed/su);
      expect(crop.width).toBe(0);
      expect(crop.height).toBe(0);
      expect(crop.removed).toBe(true);
    } finally {
      Object.defineProperty(globalThis, "document", {
        configurable: true,
        value: previousDocument,
      });
    }
  });
});
