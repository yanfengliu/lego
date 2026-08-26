import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import type { InstructionSourceV1 } from "../src/instructions/instruction-source";
import { stableIdentity } from "../e2e/callout-analysis";
import { encodeCanonicalRealBuildJson } from "../e2e/real-build-json-admission";
import {
  __testOnly,
  encodeRealBuildRetainedPanelSource,
  replayRealBuildPanelSource,
  type RealBuildReplayPanelSourceInput,
} from "../e2e/real-build-replay-panel-source";
import {
  ROTATION_ICON_FILL_HEX,
  ROTATION_ICON_SIDE_PT,
} from "../e2e/real-build-transition-features";

const PDF_BYTES = Buffer.from("synthetic synchronous panel-source fixture bytes", "utf8");
const PDF_DIGEST = `sha256:${createHash("sha256").update(PDF_BYTES).digest("hex")}`;
const HASH = `sha256:${"1".repeat(64)}`;

interface MutableInstructionTextElement {
  text: string;
  heightPt: number;
  xPt: number;
  yPt: number;
}

interface MutableInstructionSource extends Omit<InstructionSourceV1, "pages"> {
  pages: {
    pageNumber: number;
    widthPt: number;
    heightPt: number;
    text: string;
    textElements: MutableInstructionTextElement[];
    textTruncated: boolean;
  }[];
}

interface MutableShape {
  fillHex: string;
  bounds: { minXPt: number; maxXPt: number; minYPt: number; maxYPt: number };
  pointCount: number;
}

interface MutableRetainedEnvelope {
  requestedLastStep: number;
  pageShapes: { pageNumber: number; shapes: MutableShape[] }[];
}

function source(): MutableInstructionSource {
  const textElements = [
    { text: "1", heightPt: 26, xPt: 40, yPt: 500 },
    { text: "1x", heightPt: 8, xPt: 50, yPt: 530 },
    { text: "2", heightPt: 26, xPt: 41, yPt: 200 },
    { text: "2x", heightPt: 8, xPt: 50, yPt: 270 },
    { text: "1", heightPt: 7, xPt: 10, yPt: 10 },
  ];
  return {
    schemaVersion: "lego.instruction-source/1",
    contentHash: PDF_DIGEST,
    fileName: "fixture.pdf",
    byteLength: PDF_BYTES.byteLength,
    pageCount: 1,
    pages: [
      {
        pageNumber: 1,
        widthPt: 600,
        heightPt: 600,
        text: textElements.map(({ text }) => text).join(" "),
        textElements,
        textTruncated: false,
      },
    ],
    provenance: { origin: "user-supplied", ingestedBy: "lego-studio:pdf-ingest/1" },
  };
}

function row(input: {
  stepNumber: number;
  quantity: number;
  xPt: number;
  yPt: number;
  box: {
    minXPt: number;
    maxXPt: number;
    minYPt: number;
    maxYPt: number;
  };
}) {
  return {
    identity: stableIdentity(1, input.quantity, input.xPt, input.yPt),
    file: `step-${input.stepNumber}.png`,
    pageNumber: 1,
    stepNumber: input.stepNumber,
    quantity: input.quantity,
    xPt: input.xPt,
    yPt: input.yPt,
    box: input.box,
    evidenceKind: "part-art",
    sha256: HASH,
  };
}

function manifest() {
  const callouts = [
    row({
      stepNumber: 1,
      quantity: 1,
      xPt: 50,
      yPt: 530,
      box: { minXPt: 30, maxXPt: 100, minYPt: 510, maxYPt: 550 },
    }),
    row({
      stepNumber: 2,
      quantity: 2,
      xPt: 50,
      yPt: 270,
      box: { minXPt: 30, maxXPt: 100, minYPt: 250, maxYPt: 300 },
    }),
  ];
  return {
    schemaVersion: "lego.callout-thumbnails/6",
    sourceHash: PDF_DIGEST,
    pageSelection: "full booklet",
    calloutCount: callouts.length,
    callouts,
  };
}

function rotationIcon(): MutableShape {
  return {
    fillHex: ROTATION_ICON_FILL_HEX,
    bounds: {
      minXPt: 120,
      maxXPt: 120 + ROTATION_ICON_SIDE_PT,
      minYPt: 500,
      maxYPt: 500 + ROTATION_ICON_SIDE_PT,
    },
    pointCount: 4,
  };
}

function retainedSourceBytes(
  value = source(),
  pageShapes: readonly {
    readonly pageNumber: number;
    readonly shapes: readonly MutableShape[];
  }[] = [{ pageNumber: 1, shapes: [] }],
  requestedLastStep = 1,
): Uint8Array {
  return __testOnly.encodeRealBuildRetainedPanelSourceWithExpectedPrintedSteps(
    { pdfBytes: PDF_BYTES, source: value, requestedLastStep, pageShapes },
    2,
  );
}

function retainedSourceBytesForShapes(shapes: readonly MutableShape[]): Uint8Array {
  return retainedSourceBytes(source(), [{ pageNumber: 1, shapes: [...shapes] }]);
}

function input(
  overrides: Partial<RealBuildReplayPanelSourceInput> = {},
): RealBuildReplayPanelSourceInput {
  return {
    pdfBytes: PDF_BYTES,
    retainedSourceBytes: retainedSourceBytes(),
    manifestBytes: encodeCanonicalRealBuildJson(manifest()),
    ...overrides,
  };
}

function replay(value: RealBuildReplayPanelSourceInput) {
  return __testOnly.replayRealBuildPanelSourceWithExpectedPrintedSteps(value, 2);
}

function rewriteRetainedSource(
  bytes: Uint8Array,
  mutate: (value: MutableRetainedEnvelope) => void,
): Uint8Array {
  const value = JSON.parse(Buffer.from(bytes).toString("utf8")) as MutableRetainedEnvelope;
  mutate(value);
  return encodeCanonicalRealBuildJson(value);
}

describe("synchronous real-build panel-source replay", () => {
  it("binds canonical source bytes and returns the exact ordered panel/callout evidence", () => {
    expect(() =>
      encodeRealBuildRetainedPanelSource({
        pdfBytes: PDF_BYTES,
        source: source(),
        requestedLastStep: 1,
        pageShapes: [{ pageNumber: 1, shapes: [] }],
      }),
    ).toThrow(/359 indexed printed-step labels/u);
    expect(() => replayRealBuildPanelSource(input())).toThrow(/359 indexed printed-step labels/u);

    const result = replay(input());

    expect(result.pdfDigest).toBe(PDF_DIGEST);
    expect(result.manifestCalloutCount).toBe(2);
    expect(result.panels.map(({ stepNumber }) => stepNumber)).toEqual([1, 2]);
    expect(result.panels[0]!.bounds.minYPt).toBe(302);
    expect(result.panels[1]!.bounds.maxYPt).toBe(302);
    expect(result.calloutBoxesByStep).toEqual({
      1: [{ minXPt: 30, maxXPt: 100, minYPt: 510, maxYPt: 550 }],
      2: [{ minXPt: 30, maxXPt: 100, minYPt: 250, maxYPt: 300 }],
    });
    expect(result.panelEvidenceByStep[1]!.digest).toMatch(/^sha256:[0-9a-f]{64}$/u);
    expect(result.requestedLastStep).toBe(1);
    expect(result.observationThroughStep).toBe(2);
    expect(result.panelFaceByStep).toEqual({ 1: "studs-up", 2: "studs-up" });
    expect(result.authority).toEqual({
      sourceText: "retained-derived-local-diagnostic",
      pageShapes: "retained-derived-local-diagnostic",
      pdfParserReplay: "not-performed",
      sourceExecution: "absent",
      preparedRun: "absent",
      placement: "absent",
      completion: "absent",
    });
    expect(Object.isFrozen(result)).toBe(true);
  });

  it("folds a retained rotation-icon shape into the bounded observation faces", () => {
    const retainedSourceBytes = retainedSourceBytesForShapes([rotationIcon()]);
    const result = replay(input({ retainedSourceBytes }));

    expect(result.panelFaceByStep).toEqual({ 1: "underside", 2: "underside" });
  });

  it("rejects retained shape, page, and observation-scope mutations", () => {
    const withIcon = retainedSourceBytesForShapes([rotationIcon()]);
    const outOfBoundsShape = rewriteRetainedSource(withIcon, (value) => {
      value.pageShapes[0]!.shapes[0]!.bounds.maxXPt = 30_000;
    });
    expect(() => replay(input({ retainedSourceBytes: outOfBoundsShape }))).toThrow(
      /bounded finite ordered coordinates/u,
    );

    const wrongPage = rewriteRetainedSource(retainedSourceBytes(), (value) => {
      value.pageShapes[0]!.pageNumber = 2;
    });
    expect(() => replay(input({ retainedSourceBytes: wrongPage }))).toThrow(
      /unique existing page/u,
    );

    const duplicatePage = rewriteRetainedSource(retainedSourceBytes(), (value) => {
      value.pageShapes.push(structuredClone(value.pageShapes[0]!));
    });
    expect(() => replay(input({ retainedSourceBytes: duplicatePage }))).toThrow(
      /unique existing page in strictly increasing order/u,
    );

    const missingPage = rewriteRetainedSource(retainedSourceBytes(), (value) => {
      value.pageShapes = [];
    });
    expect(() => replay(input({ retainedSourceBytes: missingPage }))).toThrow(
      /exactly 1 observation page rows/u,
    );

    const widenedScope = rewriteRetainedSource(retainedSourceBytes(), (value) => {
      value.requestedLastStep = 3;
    });
    expect(() => replay(input({ retainedSourceBytes: widenedScope }))).toThrow(
      /requestedLastStep.*1\.\.2/u,
    );
  });

  it("rejects page-shape extras, accessors, and proxies before retaining them", () => {
    const withExtra = rewriteRetainedSource(
      retainedSourceBytesForShapes([rotationIcon()]),
      (value) => {
        Object.assign(value.pageShapes[0]!.shapes[0]!, { unexpected: true });
      },
    );
    expect(() => replay(input({ retainedSourceBytes: withExtra }))).toThrow(
      /must contain exactly \[fillHex, bounds, pointCount\]/u,
    );

    const proxy = new Proxy([{ pageNumber: 1, shapes: [] }], {});
    expect(() =>
      __testOnly.encodeRealBuildRetainedPanelSourceWithExpectedPrintedSteps(
        {
          pdfBytes: PDF_BYTES,
          source: source(),
          requestedLastStep: 1,
          pageShapes: proxy,
        },
        2,
      ),
    ).toThrow(/non-Proxy ordinary dense array/u);

    const accessor = Object.defineProperties(
      {},
      {
        pageNumber: { enumerable: true, get: () => 1 },
        shapes: { enumerable: true, value: [] },
      },
    );
    expect(() =>
      __testOnly.encodeRealBuildRetainedPanelSourceWithExpectedPrintedSteps(
        {
          pdfBytes: PDF_BYTES,
          source: source(),
          requestedLastStep: 1,
          pageShapes: [accessor as never],
        },
        2,
      ),
    ).toThrow(/pageNumber must be one enumerable own data property/u);
  });

  it("rejects a canonical panel-source step-label position mutation that changes containment", () => {
    const mutated = structuredClone(source());
    mutated.pages[0]!.textElements[2]!.xPt = 400;

    expect(() => replay(input({ retainedSourceBytes: retainedSourceBytes(mutated) }))).toThrow(
      /declares step\/page 2\/1, but independent retained-text containment derives 1\/1/u,
    );
  });

  it.each([
    {
      name: "quantity-label position",
      mutate: (value: ReturnType<typeof manifest>) => {
        value.callouts[0]!.xPt = 51;
        value.callouts[0]!.identity = stableIdentity(1, 1, 51, 530);
      },
      pattern: /must match exact retained positioned text/u,
    },
    {
      name: "callout box",
      mutate: (value: ReturnType<typeof manifest>) => {
        value.callouts[0]!.box.maxYPt = 520;
      },
      pattern: /box containing its exact quantity label/u,
    },
    {
      name: "declared step",
      mutate: (value: ReturnType<typeof manifest>) => {
        value.callouts[0]!.stepNumber = 2;
      },
      pattern: /declares step\/page 2\/1, but independent retained-text containment derives 1\/1/u,
    },
    {
      name: "declared page",
      mutate: (value: ReturnType<typeof manifest>) => {
        value.callouts[0]!.pageNumber = 2;
        value.callouts[0]!.identity = stableIdentity(2, 1, 50, 530);
      },
      pattern: /declares absent source page 2/u,
    },
  ])("rejects a manifest $name mutation", ({ mutate, pattern }) => {
    const mutated = structuredClone(manifest());
    mutate(mutated);

    expect(() => replay(input({ manifestBytes: encodeCanonicalRealBuildJson(mutated) }))).toThrow(
      pattern,
    );
  });

  it("rejects changed PDF bytes and duplicate manifest rows", () => {
    const changedPdf = Buffer.from(PDF_BYTES);
    changedPdf[changedPdf.length - 1] = changedPdf.at(-1)! ^ 1;
    expect(() => replay(input({ pdfBytes: changedPdf }))).toThrow(/replay received.*hashing/u);

    const duplicated = structuredClone(manifest());
    duplicated.callouts.push(structuredClone(duplicated.callouts[0]!));
    duplicated.calloutCount = duplicated.callouts.length;
    expect(() =>
      replay(input({ manifestBytes: encodeCanonicalRealBuildJson(duplicated) })),
    ).toThrow(/unique typed v6 manifest rows/u);
  });

  it("rejects a missing printed-step label before panel projection", () => {
    const missing = structuredClone(source());
    missing.pages[0]!.textElements.splice(2, 1);

    expect(() => replay(input({ retainedSourceBytes: retainedSourceBytes(missing) }))).toThrow(
      /exactly 2 indexed printed-step labels/u,
    );
  });

  it("rejects duplicate JSON members and every noncanonical retained-source spelling", () => {
    const canonical = retainedSourceBytes();
    const canonicalText = new TextDecoder().decode(canonical);
    const byteLengthMember = `"byteLength":${PDF_BYTES.byteLength}`;
    const duplicateSource = Buffer.from(
      canonicalText.replace(byteLengthMember, `${byteLengthMember},${byteLengthMember}`),
      "utf8",
    );
    expect(() => replay(input({ retainedSourceBytes: duplicateSource }))).toThrow(
      /duplicate-free/u,
    );

    const duplicateManifestMember = Buffer.from(
      new TextDecoder()
        .decode(encodeCanonicalRealBuildJson(manifest()))
        .replace('"calloutCount":2', '"calloutCount":2,"calloutCount":2'),
      "utf8",
    );
    expect(() => replay(input({ manifestBytes: duplicateManifestMember }))).toThrow(
      /duplicate-free/u,
    );

    const pretty = Buffer.from(JSON.stringify(JSON.parse(canonicalText), null, 2), "utf8");
    expect(() => replay(input({ retainedSourceBytes: pretty }))).toThrow(
      /exact canonical compact/u,
    );
  });
});
