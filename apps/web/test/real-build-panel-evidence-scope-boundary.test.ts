import { createHash } from "node:crypto";

import { beforeEach, describe, expect, it, vi } from "vitest";

import type { SampleCalloutBox } from "../e2e/booklet-fixture";
import type { InstructionSourceV1 } from "../src/instructions/instruction-source";

const probe = vi.hoisted(() => ({
  pageScopes: [] as number[][],
  pdfDigests: [] as string[],
  sourceStepCountsAfterAwait: [] as number[],
  callouts: new Map<number, readonly SampleCalloutBox[]>(),
}));

vi.mock("../e2e/booklet-fixture", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../e2e/booklet-fixture")>();
  return {
    ...actual,
    sampleBookletCalloutBoxes: async (
      bytes: Buffer,
      source: InstructionSourceV1,
      pages: readonly number[],
    ) => {
      probe.pageScopes.push([...pages]);
      await Promise.resolve();
      probe.pdfDigests.push(`sha256:${createHash("sha256").update(bytes).digest("hex")}`);
      probe.sourceStepCountsAfterAwait.push(
        source.pages.reduce(
          (count, page) =>
            count + page.textElements.filter(({ heightPt }) => heightPt === 26).length,
          0,
        ),
      );
      return probe.callouts;
    },
  };
});

import {
  deriveRealBuildPanelEvidence,
  deriveScopedRealBuildPanelEvidence,
} from "../e2e/real-build-panel-evidence";

function sha256(bytes: Uint8Array): string {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function syntheticSource(bytes: Buffer): InstructionSourceV1 {
  const pages = Array.from({ length: 3 }, (_, index) => {
    const pageNumber = index + 1;
    const firstStep = index * 2 + 1;
    const textElements = [
      { text: String(firstStep), heightPt: 26, xPt: 40, yPt: 500 },
      { text: String(firstStep + 1), heightPt: 26, xPt: 41, yPt: 200 },
      { text: `${pageNumber + 1}x`, heightPt: 16, xPt: 80, yPt: 450 },
      { text: String(pageNumber), heightPt: 10, xPt: 10, yPt: 10 },
    ];
    return {
      pageNumber,
      widthPt: 765,
      heightPt: 544,
      text: textElements.map(({ text }) => text).join(" "),
      textElements,
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

describe("scoped panel evidence helper boundary", () => {
  beforeEach(() => {
    probe.pageScopes.length = 0;
    probe.pdfDigests.length = 0;
    probe.sourceStepCountsAfterAwait.length = 0;
    probe.callouts.clear();
  });

  it("passes one selected complete page instead of every full-evidence page", async () => {
    const bytes = Buffer.from("synthetic-panel-boundary");
    const source = syntheticSource(bytes);
    const scoped = await deriveScopedRealBuildPanelEvidence({
      pdfBytes: bytes,
      source,
      pdfDigest: sha256(bytes),
      stepNumbers: [2],
    });
    const full = await deriveRealBuildPanelEvidence({
      pdfBytes: bytes,
      source,
      pdfDigest: sha256(bytes),
    });

    expect(probe.pageScopes).toEqual([[1], [1, 2, 3]]);
    expect(scoped.panels).toEqual(full.panels.filter(({ stepNumber }) => stepNumber === 2));
    expect(scoped.authority).toEqual({
      sourceText: "caller-supplied-unverified",
      preparedRun: "absent",
      placement: "absent",
      completion: "absent",
    });
    expect(scoped.scope).toEqual({
      requestedStepNumbers: [2],
      calloutProbePageNumbers: [1],
      indexedStepLabelCount: 6,
      materializedPagePanelCount: 2,
      emittedPanelCount: 1,
    });
  });

  it("rejects outer accessors without invoking them", async () => {
    const bytes = Buffer.from("source-getter-mutation");
    const expectedDigest = sha256(bytes);
    const source = syntheticSource(bytes);
    let pdfBytesReads = 0;
    let sourceReads = 0;
    const input = {
      get pdfBytes(): Buffer {
        pdfBytesReads += 1;
        return bytes;
      },
      get source(): InstructionSourceV1 {
        sourceReads += 1;
        bytes.fill(0);
        return source;
      },
      pdfDigest: expectedDigest,
      stepNumbers: [2],
    };

    expect(input.pdfBytes).toBe(bytes);
    pdfBytesReads = 0;
    await expect(deriveScopedRealBuildPanelEvidence(input)).rejects.toThrow(
      /pdfBytes must be one enumerable own data property/u,
    );
    expect(pdfBytesReads).toBe(0);
    expect(sourceReads).toBe(0);
    expect(probe.pdfDigests).toEqual([]);
  });

  it("uses detached bytes, scope, source fields, pages, and elements after awaiting", async () => {
    const bytes = Buffer.from("source-page-mutation");
    const expectedDigest = sha256(bytes);
    const source = syntheticSource(bytes);
    const stepNumbers = [2];
    const derivation = deriveScopedRealBuildPanelEvidence({
      pdfBytes: bytes,
      source,
      pdfDigest: expectedDigest,
      stepNumbers,
    });
    bytes.fill(0);
    stepNumbers[0] = 1;
    (source as unknown as { pageCount: number }).pageCount = 1;
    (source.pages[0] as unknown as { pageNumber: number }).pageNumber = 99;
    (source.pages[0]!.textElements[0] as unknown as { text: string }).text = "359";
    (source.pages[0]!.textElements as unknown[]).splice(0);

    await expect(derivation).resolves.toMatchObject({
      panels: [{ stepNumber: 2, pageNumber: 1 }],
      scope: { requestedStepNumbers: [2] },
    });
    expect(probe.pdfDigests).toEqual([expectedDigest]);
    expect(probe.sourceStepCountsAfterAwait).toEqual([6]);
  });

  it("rejects proxies, accessors, and hostile scope indices without running hooks", async () => {
    const bytes = Buffer.from("hostile-panel-boundary");
    const source = syntheticSource(bytes);
    let traps = 0;
    const proxy = new Proxy(
      {
        pdfBytes: bytes,
        source,
        pdfDigest: sha256(bytes),
        stepNumbers: [2],
      },
      {
        get: () => {
          traps += 1;
          throw new Error("hostile get trap ran");
        },
        ownKeys: () => {
          traps += 1;
          throw new Error("hostile ownKeys trap ran");
        },
        getOwnPropertyDescriptor: () => {
          traps += 1;
          throw new Error("hostile descriptor trap ran");
        },
        getPrototypeOf: () => {
          traps += 1;
          throw new Error("hostile prototype trap ran");
        },
      },
    );
    expect(() => Reflect.get(proxy, "pdfBytes")).toThrow(/hostile get trap ran/u);
    traps = 0;
    await expect(deriveScopedRealBuildPanelEvidence(proxy)).rejects.toThrow(/Proxy/u);
    expect(traps).toBe(0);

    const revocable = Proxy.revocable({ anything: true }, {});
    revocable.revoke();
    await expect(deriveScopedRealBuildPanelEvidence(revocable.proxy as never)).rejects.toThrow(
      /Proxy/u,
    );

    const indexAccessor = [2];
    let indexReads = 0;
    Object.defineProperty(indexAccessor, "0", {
      get: () => {
        indexReads += 1;
        return 2;
      },
      enumerable: true,
      configurable: true,
    });
    expect(indexAccessor[0]).toBe(2);
    indexReads = 0;
    await expect(
      deriveScopedRealBuildPanelEvidence({
        pdfBytes: bytes,
        source,
        pdfDigest: sha256(bytes),
        stepNumbers: indexAccessor,
      }),
    ).rejects.toThrow(/enumerable own data property/u);
    expect(indexReads).toBe(0);
    expect(probe.pageScopes).toEqual([]);
  });

  it("rejects nested accessors and object-valued identities without coercion", async () => {
    const bytes = Buffer.from("hostile-nested-panel-boundary");
    const source = syntheticSource(bytes);
    let getterReads = 0;
    const hostilePage = { ...source.pages[0] };
    Object.defineProperty(hostilePage, "textElements", {
      get: () => {
        getterReads += 1;
        return source.pages[0]!.textElements;
      },
      enumerable: true,
      configurable: true,
    });
    expect(hostilePage.textElements).toEqual(source.pages[0]!.textElements);
    getterReads = 0;
    await expect(
      deriveScopedRealBuildPanelEvidence({
        pdfBytes: bytes,
        source: {
          ...source,
          pages: [hostilePage, ...source.pages.slice(1)],
        } as InstructionSourceV1,
        pdfDigest: sha256(bytes),
        stepNumbers: [2],
      }),
    ).rejects.toThrow(/textElements must be one enumerable own data property/u);
    expect(getterReads).toBe(0);

    let coercions = 0;
    const hostileDigest = {
      [Symbol.toPrimitive]: () => {
        coercions += 1;
        return sha256(bytes);
      },
    };
    expect(String(hostileDigest)).toBe(sha256(bytes));
    coercions = 0;
    await expect(
      deriveScopedRealBuildPanelEvidence({
        pdfBytes: bytes,
        source,
        pdfDigest: hostileDigest as never,
        stepNumbers: [2],
      }),
    ).rejects.toThrow(/exact booklet digest/u);
    expect(coercions).toBe(0);
    expect(probe.pageScopes).toEqual([]);

    const hostilePageCount = {
      [Symbol.toPrimitive]: () => {
        coercions += 1;
        return source.pageCount;
      },
    };
    expect(Number(hostilePageCount)).toBe(source.pageCount);
    coercions = 0;
    await expect(
      deriveScopedRealBuildPanelEvidence({
        pdfBytes: bytes,
        source: { ...source, pageCount: hostilePageCount } as never,
        pdfDigest: sha256(bytes),
        stepNumbers: [2],
      }),
    ).rejects.toThrow(/pageCount must be one number/u);
    expect(coercions).toBe(0);
    expect(probe.pageScopes).toEqual([]);
  });

  it("commits separately to caller-supplied text changes under identical PDF bytes", async () => {
    const bytes = Buffer.from("caller-source-commitment");
    const source = syntheticSource(bytes);
    const movedSource = syntheticSource(bytes);
    const movedPage = movedSource.pages[0]!;
    const movedElements = movedPage.textElements.map((element, index) =>
      index === 1 ? { ...element, yPt: element.yPt - 50 } : element,
    );
    const moved = {
      ...movedSource,
      pages: [{ ...movedPage, textElements: movedElements }, ...movedSource.pages.slice(1)],
    } satisfies InstructionSourceV1;

    const original = await deriveScopedRealBuildPanelEvidence({
      pdfBytes: bytes,
      source,
      pdfDigest: sha256(bytes),
      stepNumbers: [2],
    });
    const changed = await deriveScopedRealBuildPanelEvidence({
      pdfBytes: bytes,
      source: moved,
      pdfDigest: sha256(bytes),
      stepNumbers: [2],
    });

    expect(changed.binding.pdfBytesDigest).toBe(original.binding.pdfBytesDigest);
    expect(changed.binding.sourceTextParserReplay).toBe("not-performed");
    expect(changed.binding.callerInstructionSourceSnapshotDigest).not.toBe(
      original.binding.callerInstructionSourceSnapshotDigest,
    );
    expect(changed.callerSourcePanelCommitmentByStep[2]!.commitmentDigest).not.toBe(
      original.callerSourcePanelCommitmentByStep[2]!.commitmentDigest,
    );
  });

  it("refuses a page-joint zero-area panel before creating a commitment", async () => {
    const bytes = Buffer.from("zero-area-panel-cell");
    const source = syntheticSource(bytes);
    const page = source.pages[0]!;
    const collapsed = {
      ...source,
      pages: [
        {
          ...page,
          widthPt: 1,
          heightPt: 1,
          textElements: [
            { text: "1", heightPt: 26, xPt: 0.5, yPt: 0 },
            { text: "2", heightPt: 26, xPt: 0.5, yPt: 0 },
            { text: "1", heightPt: 10, xPt: 0, yPt: 0 },
          ],
        },
        ...source.pages.slice(1),
      ],
    } satisfies InstructionSourceV1;

    await expect(
      deriveScopedRealBuildPanelEvidence({
        pdfBytes: bytes,
        source: collapsed,
        pdfDigest: sha256(bytes),
        stepNumbers: [2],
      }),
    ).rejects.toThrow(/does not form one finite, nonempty page-bounded cell/u);
  });

  it("refuses a malformed callout box before creating a commitment", async () => {
    const bytes = Buffer.from("malformed-callout-commitment");
    probe.callouts.set(1, [
      {
        quantity: 2,
        labelXPt: 80,
        labelYPt: 450,
        box: { minXPt: -1, maxXPt: 100, minYPt: 400, maxYPt: 500 },
      },
    ]);

    await expect(
      deriveScopedRealBuildPanelEvidence({
        pdfBytes: bytes,
        source: syntheticSource(bytes),
        pdfDigest: sha256(bytes),
        stepNumbers: [2],
      }),
    ).rejects.toThrow(/bounded quantity, label, and finite nonempty in-page box/u);
  });
});
