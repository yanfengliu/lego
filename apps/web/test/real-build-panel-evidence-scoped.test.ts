import { createHash } from "node:crypto";
import { performance } from "node:perf_hooks";

import { describe, expect, it } from "vitest";

import {
  readSampleBooklet,
  sampleBookletCalloutBoxes,
  type SampleBookletGetDocument,
} from "../e2e/booklet-fixture";
import {
  deriveRealBuildPanelEvidence,
  deriveScopedRealBuildPanelEvidence,
} from "../e2e/real-build-panel-evidence";
import { hasSampleBooklet } from "../e2e/sample-booklet";
import type {
  InstructionPage,
  InstructionSourceV1,
  InstructionTextElement,
} from "../src/instructions/instruction-source";

const PDF_DIGEST = "sha256:baef0a373164b58d7c982984b52d4e50b10cc59ed28007acb456faa72359bd27";
const EXPECTED_PANEL_DIGESTS = Object.freeze([
  "sha256:5e5bee4479b9ca1a5037c0c255a793c677766f46b5d2686b4d698c0668ddc717",
  "sha256:685bc60dff569cf15354b53593da3bd4042a3eb56cea43d2917f3ef5b4b4fa71",
  "sha256:808b0ac770e15a04a047ce090a0b08ad0e42e01bd23c7c2133030af45ca0e49b",
]);

interface PdfTrace {
  readonly getPageNumbers: number[];
  readonly operatorListPageNumbers: number[];
  readonly cleanedPageNumbers: number[];
  destroyedDocuments: number;
  destroyedLoadingTasks: number;
}

function emptyTrace(): PdfTrace {
  return {
    getPageNumbers: [],
    operatorListPageNumbers: [],
    cleanedPageNumbers: [],
    destroyedDocuments: 0,
    destroyedLoadingTasks: 0,
  };
}

function sha256(bytes: Uint8Array): string {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function syntheticSource(bytes: Buffer): InstructionSourceV1 {
  const step = (text: string, xPt: number, yPt: number): InstructionTextElement => ({
    text,
    heightPt: 26,
    xPt,
    yPt,
  });
  const pages = [
    [step("1", 40, 500), step("2", 41, 200)],
    [step("3", 40, 500), step("4", 41, 200)],
    [step("5", 40, 500), step("6", 41, 200)],
  ].map((textElements, index) => {
    const pageNumber = index + 1;
    const elements = [
      ...textElements,
      { text: `${pageNumber + 1}x`, heightPt: 16, xPt: 80, yPt: 450 },
      { text: String(pageNumber), heightPt: 10, xPt: 10, yPt: 10 },
    ];
    return {
      pageNumber,
      widthPt: 765,
      heightPt: 544,
      text: elements.map(({ text }) => text).join(" "),
      textElements: elements,
      textTruncated: false,
    };
  });
  return {
    schemaVersion: "lego.instruction-source/1",
    contentHash: sha256(bytes),
    fileName: "synthetic.pdf",
    byteLength: bytes.byteLength,
    pageCount: pages.length,
    pages,
    provenance: { origin: "user-supplied", ingestedBy: "lego-studio:pdf-ingest/1" },
  };
}

function syntheticGetDocument(
  trace: PdfTrace,
  options: {
    readonly failLoading?: boolean;
    readonly failOperatorList?: boolean;
    readonly failPageCleanup?: boolean;
    readonly failTaskDestroy?: boolean;
    readonly viewportWidth?: number;
    readonly viewportHeight?: number;
  } = {},
): SampleBookletGetDocument {
  return () => ({
    promise: options.failLoading
      ? Promise.reject(new Error("synthetic PDF loading failure"))
      : Promise.resolve({
          getPage: async (pageNumber) => {
            trace.getPageNumbers.push(pageNumber);
            return {
              getViewport: () => ({
                width: options.viewportWidth ?? 765,
                height: options.viewportHeight ?? 544,
              }),
              getOperatorList: async () => {
                trace.operatorListPageNumbers.push(pageNumber);
                if (options.failOperatorList) {
                  throw new Error("synthetic operator-list failure");
                }
                return { fnArray: [], argsArray: [] };
              },
              cleanup: () => {
                trace.cleanedPageNumbers.push(pageNumber);
                if (options.failPageCleanup) throw new Error("synthetic page cleanup failure");
              },
            };
          },
        }),
    destroy: () => {
      trace.destroyedLoadingTasks += 1;
      if (!options.failLoading) trace.destroyedDocuments += 1;
      if (options.failTaskDestroy) throw new Error("synthetic task destroy failure");
    },
  });
}

describe("scoped real-build panel evidence", () => {
  it("refuses an empty or non-increasing scope before booklet work", async () => {
    const base = {
      pdfBytes: Buffer.alloc(0),
      source: null as never,
      pdfDigest: PDF_DIGEST,
    };

    await expect(deriveScopedRealBuildPanelEvidence({ ...base, stepNumbers: [] })).rejects.toThrow(
      /requires 1 through 359/u,
    );
    await expect(
      deriveScopedRealBuildPanelEvidence({ ...base, stepNumbers: [2, 2] }),
    ).rejects.toThrow(/strictly increasing and unique/u);
  });

  it("binds the declared digest, source identity, and exact PDF bytes before parsing", async () => {
    const sourceBytes = Buffer.from("source-a");
    const otherBytes = Buffer.from("source-b");
    const source = syntheticSource(sourceBytes);

    await expect(
      deriveScopedRealBuildPanelEvidence({
        pdfBytes: sourceBytes,
        source,
        pdfDigest: sha256(otherBytes),
        stepNumbers: [2],
      }),
    ).rejects.toThrow(/input identity mismatch/u);
    await expect(
      deriveScopedRealBuildPanelEvidence({
        pdfBytes: otherBytes,
        source,
        pdfDigest: sha256(otherBytes),
        stepNumbers: [2],
      }),
    ).rejects.toThrow(/input identity mismatch/u);
  });

  it("refuses byte and positioned-text work outside the ingest ceilings", async () => {
    const emptyBytes = Buffer.alloc(0);
    await expect(
      deriveScopedRealBuildPanelEvidence({
        pdfBytes: emptyBytes,
        source: syntheticSource(emptyBytes),
        pdfDigest: sha256(emptyBytes),
        stepNumbers: [2],
      }),
    ).rejects.toThrow(/expected 1 through/u);

    const bytes = Buffer.from("oversized-source-text");
    const source = syntheticSource(bytes);
    const oversizedPage = {
      ...source.pages[0]!,
      textElements: [
        {
          text: "x".repeat(20_001),
          heightPt: 26,
          xPt: 40,
          yPt: 500,
        },
      ],
    } satisfies InstructionPage;
    await expect(
      deriveScopedRealBuildPanelEvidence({
        pdfBytes: bytes,
        source: { ...source, pages: [oversizedPage, ...source.pages.slice(1)] },
        pdfDigest: sha256(bytes),
        stepNumbers: [2],
      }),
    ).rejects.toThrow(/positioned text exceeds/u);
  });

  it("gates actual parser calls below the fixed evidence-producing boundary", async () => {
    const bytes = Buffer.from("synthetic-panel-probe");
    const source = syntheticSource(bytes);
    const scopedTrace = emptyTrace();
    const fullTrace = emptyTrace();

    await sampleBookletCalloutBoxes(bytes, source, [1], {
      getDocument: syntheticGetDocument(scopedTrace),
    });
    await sampleBookletCalloutBoxes(bytes, source, [1, 2, 3], {
      getDocument: syntheticGetDocument(fullTrace),
    });

    expect(scopedTrace).toEqual({
      getPageNumbers: [1],
      operatorListPageNumbers: [1],
      cleanedPageNumbers: [1],
      destroyedDocuments: 1,
      destroyedLoadingTasks: 1,
    });
    expect(fullTrace).toEqual({
      getPageNumbers: [1, 2, 3],
      operatorListPageNumbers: [1, 2, 3],
      cleanedPageNumbers: [1, 2, 3],
      destroyedDocuments: 1,
      destroyedLoadingTasks: 1,
    });
  });

  it("cleans the page, document, and loading task when operator extraction fails", async () => {
    const bytes = Buffer.from("synthetic-failing-panel-probe");
    const trace = emptyTrace();

    await expect(
      sampleBookletCalloutBoxes(bytes, syntheticSource(bytes), [1], {
        getDocument: syntheticGetDocument(trace, { failOperatorList: true }),
      }),
    ).rejects.toThrow(/synthetic operator-list failure/u);
    expect(trace).toEqual({
      getPageNumbers: [1],
      operatorListPageNumbers: [1],
      cleanedPageNumbers: [1],
      destroyedDocuments: 1,
      destroyedLoadingTasks: 1,
    });
  });

  it("retains both operator and page-cleanup failures while destroying once", async () => {
    const bytes = Buffer.from("synthetic-double-failing-panel-probe");
    const trace = emptyTrace();

    let failure: unknown;
    try {
      await sampleBookletCalloutBoxes(bytes, syntheticSource(bytes), [1], {
        getDocument: syntheticGetDocument(trace, {
          failOperatorList: true,
          failPageCleanup: true,
        }),
      });
    } catch (error) {
      failure = error;
    }
    expect(failure).toBeInstanceOf(AggregateError);
    expect(
      (failure as AggregateError).errors.map((error) =>
        error instanceof Error ? error.message : String(error),
      ),
    ).toEqual(["synthetic operator-list failure", "synthetic page cleanup failure"]);
    expect(trace).toEqual({
      getPageNumbers: [1],
      operatorListPageNumbers: [1],
      cleanedPageNumbers: [1],
      destroyedDocuments: 1,
      destroyedLoadingTasks: 1,
    });
  });

  it("rejects a parser viewport that disagrees with the detached source before operators", async () => {
    const bytes = Buffer.from("synthetic-mismatched-panel-viewport");
    const trace = emptyTrace();

    await expect(
      sampleBookletCalloutBoxes(bytes, syntheticSource(bytes), [1], {
        getDocument: syntheticGetDocument(trace, { viewportWidth: 764 }),
      }),
    ).rejects.toThrow(/measures 764 x 544 pt.*declares 765 x 544 pt/u);
    expect(trace).toEqual({
      getPageNumbers: [1],
      operatorListPageNumbers: [],
      cleanedPageNumbers: [1],
      destroyedDocuments: 1,
      destroyedLoadingTasks: 1,
    });
  });

  it("destroys the loading task when parser initialization fails", async () => {
    const bytes = Buffer.from("synthetic-loading-failure");
    const trace = emptyTrace();

    await expect(
      sampleBookletCalloutBoxes(bytes, syntheticSource(bytes), [1], {
        getDocument: syntheticGetDocument(trace, { failLoading: true }),
      }),
    ).rejects.toThrow(/synthetic PDF loading failure/u);
    expect(trace).toEqual({
      getPageNumbers: [],
      operatorListPageNumbers: [],
      cleanedPageNumbers: [],
      destroyedDocuments: 0,
      destroyedLoadingTasks: 1,
    });
  });

  it("retains extraction and task-destroy failures together", async () => {
    const bytes = Buffer.from("synthetic-extraction-and-destroy-failure");
    const trace = emptyTrace();

    let failure: unknown;
    try {
      await sampleBookletCalloutBoxes(bytes, syntheticSource(bytes), [1], {
        getDocument: syntheticGetDocument(trace, {
          failOperatorList: true,
          failTaskDestroy: true,
        }),
      });
    } catch (error) {
      failure = error;
    }
    expect(failure).toBeInstanceOf(AggregateError);
    expect(
      (failure as AggregateError).errors.map((error) =>
        error instanceof Error ? error.message : String(error),
      ),
    ).toEqual(["synthetic operator-list failure", "synthetic task destroy failure"]);
    expect(trace.destroyedLoadingTasks).toBe(1);
  });

  it("retains loading and task-destroy failures together", async () => {
    const bytes = Buffer.from("synthetic-loading-and-destroy-failure");
    const trace = emptyTrace();

    let failure: unknown;
    try {
      await sampleBookletCalloutBoxes(bytes, syntheticSource(bytes), [1], {
        getDocument: syntheticGetDocument(trace, {
          failLoading: true,
          failTaskDestroy: true,
        }),
      });
    } catch (error) {
      failure = error;
    }
    expect(failure).toBeInstanceOf(AggregateError);
    expect(
      (failure as AggregateError).errors.map((error) =>
        error instanceof Error ? error.message : String(error),
      ),
    ).toEqual(["synthetic PDF loading failure", "synthetic task destroy failure"]);
    expect(trace.destroyedLoadingTasks).toBe(1);
  });

  it("rejects otherwise successful extraction when its sole owner cannot be destroyed", async () => {
    const bytes = Buffer.from("synthetic-cleanup-only-failure");
    const trace = emptyTrace();

    let failure: unknown;
    try {
      await sampleBookletCalloutBoxes(bytes, syntheticSource(bytes), [1], {
        getDocument: syntheticGetDocument(trace, { failTaskDestroy: true }),
      });
    } catch (error) {
      failure = error;
    }
    expect(failure).toBeInstanceOf(AggregateError);
    expect(
      (failure as AggregateError).errors.map((error) =>
        error instanceof Error ? error.message : String(error),
      ),
    ).toEqual(["synthetic task destroy failure"]);
    expect(trace.destroyedLoadingTasks).toBe(1);
  });

  it("rejects oversized step arrays before booklet work", async () => {
    const bytes = Buffer.from("oversized-panel-step-array");
    const source = syntheticSource(bytes);
    const stepNumbers = Array.from({ length: 360 }, (_, index) => index + 1);

    await expect(
      deriveScopedRealBuildPanelEvidence({
        pdfBytes: bytes,
        source,
        pdfDigest: sha256(bytes),
        stepNumbers,
      }),
    ).rejects.toThrow(/at most 359 entries/u);
  });

  it("ignores shadowed byte metadata and iterators after taking one intrinsic snapshot", async () => {
    const bytes = Buffer.from("shadowed-panel-bytes");
    const source = syntheticSource(bytes);
    let iteratorCalls = 0;
    let byteLengthReads = 0;
    Object.defineProperty(bytes, "byteLength", {
      get: () => {
        byteLengthReads += 1;
        return 1;
      },
      configurable: true,
    });
    Object.defineProperty(bytes, Symbol.iterator, {
      get: () => {
        iteratorCalls += 1;
        return function hostileByteIterator() {
          throw new Error("hostile byte iterator ran");
        };
      },
      configurable: true,
    });
    expect(Reflect.get(bytes, "byteLength")).toBe(1);
    expect(Reflect.get(bytes, Symbol.iterator)).toBeTypeOf("function");
    byteLengthReads = 0;
    iteratorCalls = 0;
    let parserBytes: Uint8Array | undefined;
    const trace = emptyTrace();
    const loader = syntheticGetDocument(trace);

    await sampleBookletCalloutBoxes(bytes, source, [1], {
      getDocument: (snapshot) => {
        parserBytes = snapshot;
        return loader(snapshot);
      },
    });

    expect(iteratorCalls).toBe(0);
    expect(byteLengthReads).toBe(0);
    expect(parserBytes).toBeInstanceOf(Uint8Array);
    expect(Buffer.isBuffer(parserBytes)).toBe(false);
    expect(parserBytes).toEqual(new Uint8Array(Buffer.from("shadowed-panel-bytes")));
  });

  it("rejects hostile source and scope arrays without invoking their methods", async () => {
    const bytes = Buffer.from("hostile-panel-arrays");
    const source = syntheticSource(bytes);
    let mapCalls = 0;
    Object.defineProperty(source.pages, "map", {
      value: () => {
        mapCalls += 1;
        throw new Error("hostile map ran");
      },
      configurable: true,
    });
    expect(() => Reflect.apply(Reflect.get(source.pages, "map"), source.pages, [])).toThrow(
      /hostile map ran/u,
    );
    mapCalls = 0;
    await expect(
      sampleBookletCalloutBoxes(bytes, source, [1], {
        getDocument: syntheticGetDocument(emptyTrace()),
      }),
    ).rejects.toThrow(/dense numeric indices/u);
    expect(mapCalls).toBe(0);

    const ordinarySource = syntheticSource(bytes);
    const pages = [1];
    let iteratorCalls = 0;
    Object.defineProperty(pages, Symbol.iterator, {
      get: () => {
        iteratorCalls += 1;
        return function hostilePageIterator() {
          throw new Error("hostile page iterator ran");
        };
      },
      configurable: true,
    });
    expect(Reflect.get(pages, Symbol.iterator)).toBeTypeOf("function");
    iteratorCalls = 0;
    await expect(
      sampleBookletCalloutBoxes(bytes, ordinarySource, pages, {
        getDocument: syntheticGetDocument(emptyTrace()),
      }),
    ).rejects.toThrow(/dense numeric indices/u);
    expect(iteratorCalls).toBe(0);
  });

  it("detaches selected source text before the first asynchronous boundary", async () => {
    const bytes = Buffer.from("detached-selected-panel-page");
    const source = syntheticSource(bytes);
    const trace = emptyTrace();
    const derivation = sampleBookletCalloutBoxes(bytes, source, [1], {
      getDocument: syntheticGetDocument(trace),
    });
    (source.pages[0]!.textElements as unknown[]).splice(0);

    await expect(derivation).resolves.toBeInstanceOf(Map);
    expect(trace.operatorListPageNumbers).toEqual([1]);
  });

  it("refuses positioned geometry large enough to overflow panel arithmetic", async () => {
    const bytes = Buffer.from("unbounded-panel-geometry");
    const source = syntheticSource(bytes);
    const firstPage = source.pages[0]!;
    const firstElement = firstPage.textElements[0]!;
    const unbounded = {
      ...source,
      pages: [
        {
          ...firstPage,
          textElements: [{ ...firstElement, xPt: 1e308 }, ...firstPage.textElements.slice(1)],
        },
        ...source.pages.slice(1),
      ],
    } satisfies InstructionSourceV1;

    await expect(
      deriveScopedRealBuildPanelEvidence({
        pdfBytes: bytes,
        source: unbounded,
        pdfDigest: sha256(bytes),
        stepNumbers: [2],
      }),
    ).rejects.toThrow(/position inside page 1/u);
  });

  it.each([
    ["NaN x", { xPt: Number.NaN }],
    ["infinite y", { yPt: Number.POSITIVE_INFINITY }],
    ["negative x", { xPt: -1 }],
    ["oversized x", { xPt: 5_001 }],
    ["negative height", { heightPt: -1 }],
    ["oversized height", { heightPt: 5_001 }],
  ])("rejects %s positioned geometry before parser work", async (_label, replacement) => {
    const bytes = Buffer.from("bounded-panel-geometry-cases");
    const source = syntheticSource(bytes);
    const firstPage = source.pages[0]!;
    const malformed = {
      ...source,
      pages: [
        {
          ...firstPage,
          textElements: [
            { ...firstPage.textElements[0]!, ...replacement },
            ...firstPage.textElements.slice(1),
          ],
        },
        ...source.pages.slice(1),
      ],
    } satisfies InstructionSourceV1;
    const trace = emptyTrace();

    await expect(
      sampleBookletCalloutBoxes(bytes, malformed, [1], {
        getDocument: syntheticGetDocument(trace),
      }),
    ).rejects.toThrow(/glyph height bounded to 5000 pt.*position inside page 1/u);
    expect(trace).toEqual(emptyTrace());
  });

  it.skipIf(!hasSampleBooklet)(
    "matches full-run steps 2-4 for the genuine freshly ingested caller source",
    async () => {
      const readStarted = performance.now();
      const { bytes, source } = await readSampleBooklet();
      const readMilliseconds = performance.now() - readStarted;
      const scopedBeforeStarted = performance.now();
      const scopedBefore = await deriveScopedRealBuildPanelEvidence({
        pdfBytes: bytes,
        source,
        pdfDigest: PDF_DIGEST,
        stepNumbers: [2, 3, 4],
      });
      const scopedBeforeMilliseconds = performance.now() - scopedBeforeStarted;
      const fullStarted = performance.now();
      const full = await deriveRealBuildPanelEvidence({
        pdfBytes: bytes,
        source,
        pdfDigest: PDF_DIGEST,
      });
      const fullMilliseconds = performance.now() - fullStarted;
      const scopedAfterStarted = performance.now();
      const scopedAfter = await deriveScopedRealBuildPanelEvidence({
        pdfBytes: bytes,
        source,
        pdfDigest: PDF_DIGEST,
        stepNumbers: [2, 3, 4],
      });
      const scopedAfterMilliseconds = performance.now() - scopedAfterStarted;
      const selectedPanels = full.panels.filter(({ stepNumber }) => [2, 3, 4].includes(stepNumber));
      const selectedCallouts = Object.fromEntries(
        [2, 3, 4].map((stepNumber) => [stepNumber, full.calloutBoxesByStep[stepNumber]]),
      );
      const selectedEvidence = Object.fromEntries(
        [2, 3, 4].map((stepNumber) => {
          const entry = full.panelEvidenceByStep[stepNumber]!;
          return [stepNumber, { pageNumber: entry.pageNumber, commitmentDigest: entry.digest }];
        }),
      );
      const allCalloutPages = source.pages
        .filter((page) => page.textElements.some(({ text }) => /^\d{1,3}x$/.test(text)))
        .map(({ pageNumber }) => pageNumber);
      const fullPanelPages = new Set(full.panels.map(({ pageNumber }) => pageNumber));
      const fullCalloutPages = allCalloutPages.filter((pageNumber) =>
        fullPanelPages.has(pageNumber),
      );

      expect(scopedBefore.panels).toEqual(selectedPanels);
      expect(scopedBefore.calloutBoxesByStep).toEqual(selectedCallouts);
      expect(scopedBefore.callerSourcePanelCommitmentByStep).toEqual(selectedEvidence);
      expect(scopedAfter).toEqual(scopedBefore);
      expect(scopedBefore).not.toHaveProperty("panelEvidenceByStep");
      expect(scopedBefore.binding).toEqual({
        pdfBytesDigest: PDF_DIGEST,
        callerInstructionSourceSnapshotDigest: expect.stringMatching(/^sha256:[0-9a-f]{64}$/u),
        callerSourceContentHashClaimMatchedPdfBytes: true,
        sourceTextParserReplay: "not-performed",
      });
      expect(scopedBefore.authority).toEqual({
        sourceText: "caller-supplied-unverified",
        preparedRun: "absent",
        placement: "absent",
        completion: "absent",
      });
      expect(scopedBefore.scope).toEqual({
        requestedStepNumbers: [2, 3, 4],
        calloutProbePageNumbers: [11],
        indexedStepLabelCount: 359,
        materializedPagePanelCount: 4,
        emittedPanelCount: 3,
      });
      expect(
        [2, 3, 4].map(
          (stepNumber) =>
            scopedBefore.callerSourcePanelCommitmentByStep[stepNumber]!.commitmentDigest,
        ),
      ).toEqual(EXPECTED_PANEL_DIGESTS);
      expect(allCalloutPages).toHaveLength(175);
      expect(fullCalloutPages).toHaveLength(171);
      process.stdout.write(
        `Scoped panel evidence: ingest ${readMilliseconds.toFixed(1)}ms; ` +
          `full ${fullMilliseconds.toFixed(1)}ms; bracketed scoped ` +
          `${scopedBeforeMilliseconds.toFixed(1)}/${scopedAfterMilliseconds.toFixed(1)}ms; ` +
          `359 indexed labels; 4 page-complete panels -> 3 emitted; callout pages 171 -> 1.\n`,
      );
    },
    30_000,
  );
});
