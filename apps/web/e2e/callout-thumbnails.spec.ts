import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import { expect, test } from "@playwright/test";

import {
  extractBookletStructure,
  selectStepNumberHeight,
  withoutPrintedPageNumbers,
} from "../src/instructions/booklet-structure";
import { ingestInstructionPdf, type PdfDocument } from "../src/instructions/ingest-pdf";
import { extractPageShapes, type OperatorList } from "../src/instructions/page-shapes";
import { extractPartsInventory } from "../src/instructions/parts-inventory";
import { deriveStepPanels } from "../src/instructions/step-panels";
import {
  area,
  contains,
  evidenceContract,
  fileStem,
  parseRequestedPages,
  recoverPanelNeighbourCell,
  selectStepPages,
  stableIdentity,
} from "./callout-analysis";
import { evaluateRecoveryBenchmark, selectEvidenceAwareCrop } from "./callout-benchmark";
import { renderCalloutCrops } from "./callout-browser-crops";
import {
  CALLOUT_RECOVERY_BY_IDENTITY,
  CALLOUT_RECOVERY_FIXTURE,
  FULL_BOOKLET_CALLOUT_ACCOUNTING,
  SEMANTIC_CALLOUTS,
} from "./callout-recovery-fixture";
import { publishCalloutRun, type PreparedCrop } from "./callout-publication";
import type {
  BrowserCrop,
  BrowserResult,
  CalloutManifest,
  CalloutTarget,
  PublishedCallout,
  QuantityLabel,
  RetainedFailure,
} from "./callout-types";
import { SAMPLE_BOOKLET_PATH, bookletProbeUrls, hasSampleBooklet } from "./sample-booklet";

const OUT = "output/callout-thumbnails";
const PAGE_LIMIT = Number(process.env.CALLOUT_PAGE_LIMIT ?? "8");
const REQUESTED_PAGES = parseRequestedPages(process.env.CALLOUT_PAGES);
const FULL_LABEL_COUNT = FULL_BOOKLET_CALLOUT_ACCOUNTING.rawNxIdentityCount;
const FULL_RAW_NX_QUANTITY = FULL_BOOKLET_CALLOUT_ACCOUNTING.rawNxQuantityTotal;
const FULL_PHYSICAL_LABEL_COUNT = FULL_BOOKLET_CALLOUT_ACCOUNTING.physicalPartArtIdentityCount;
const FULL_PHYSICAL_QUANTITY = FULL_BOOKLET_CALLOUT_ACCOUNTING.physicalPartArtQuantityTotal;

function sha256(bytes: Uint8Array | string): string {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function distinctLabels(
  pageNumber: number,
  elements: readonly {
    readonly text: string;
    readonly xPt: number;
    readonly yPt: number;
    readonly heightPt: number;
  }[],
): QuantityLabel[] {
  const seen = new Set<string>();
  return elements
    .map((element) => ({ element, match: /^(\d{1,3})x$/.exec(element.text) }))
    .filter(({ match }) => match !== null)
    .map(({ element, match }) => ({
      pageNumber,
      quantity: Number(match![1]),
      xPt: element.xPt,
      yPt: element.yPt,
      heightPt: element.heightPt,
      identity: stableIdentity(pageNumber, Number(match![1]), element.xPt, element.yPt),
    }))
    .filter(({ identity }) => {
      if (seen.has(identity)) return false;
      seen.add(identity);
      return true;
    });
}

function failure(
  failures: RetainedFailure[],
  label: QuantityLabel,
  stage: RetainedFailure["stage"],
  code: string,
  message: string,
): void {
  failures.push({ ...label, stage, code, message });
}

function selectCrop(result: BrowserResult): BrowserCrop | null {
  if (
    result.targetEvidenceKind === "part-art" &&
    result.legacy !== null &&
    result.legacy.contamination.length === 0
  )
    return result.legacy;
  return selectEvidenceAwareCrop(result);
}

test("publishes typed evidence for every distinct Nx label", async ({ page }) => {
  test.setTimeout(3_000_000);
  test.skip(!hasSampleBooklet, "no sample booklet");

  const bytes = readFileSync(SAMPLE_BOOKLET_PATH!);
  const source = await ingestInstructionPdf(
    {
      name: "6651557.pdf",
      arrayBuffer: async () =>
        bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
    },
    {
      loadPdf: async () => {
        const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
        return (await getDocument({ data: new Uint8Array(bytes), isEvalSupported: false })
          .promise) as unknown as PdfDocument;
      },
    },
  );
  const structure = extractBookletStructure(source);
  expect(structure.sourceHash).toBe(CALLOUT_RECOVERY_FIXTURE.sourceHash);
  const sightings = source.pages.flatMap((sourcePage) =>
    sourcePage.textElements
      .filter(({ text }) => /^\d{1,4}$/.test(text))
      .map(({ text, heightPt }) => ({
        value: Number(text),
        pageNumber: sourcePage.pageNumber,
        heightPt: Math.round(heightPt * 10) / 10,
      })),
  );
  const stepNumberHeightPt = selectStepNumberHeight(sightings);
  expect(stepNumberHeightPt).not.toBeNull();
  const panels = deriveStepPanels(source, { stepNumberHeightPt: stepNumberHeightPt! });
  expect(withoutPrintedPageNumbers(sightings).length).toBeGreaterThan(0);
  const inventoryPages = new Set(extractPartsInventory(source).pageNumbers);
  const allStepPages = [...new Set(panels.map(({ pageNumber }) => pageNumber))]
    .filter((pageNumber) => !inventoryPages.has(pageNumber))
    .sort((left, right) => left - right);
  const publishPages = selectStepPages(allStepPages, REQUESTED_PAGES, PAGE_LIMIT);
  const fixturePages = CALLOUT_RECOVERY_FIXTURE.cases.map(({ identity }) =>
    Number(/^p(\d+)\|/.exec(identity)![1]),
  );
  const processingPages = [...new Set([...publishPages, ...fixturePages])].sort(
    (left, right) => left - right,
  );
  const publishPageSet = new Set(publishPages);

  const { getDocument, OPS } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const shapeDoc = await getDocument({ data: new Uint8Array(bytes), isEvalSupported: false })
    .promise;
  const shapeCodes = {
    setFillRGBColor: OPS.setFillRGBColor,
    constructPath: OPS.constructPath,
    fill: OPS.fill,
    eoFill: OPS.eoFill,
    fillStroke: OPS.fillStroke,
    save: OPS.save,
    restore: OPS.restore,
    transform: OPS.transform,
  };
  const expected: QuantityLabel[] = [];
  const targets: CalloutTarget[] = [];
  const failures: RetainedFailure[] = [];
  const browserResults: BrowserResult[] = [];

  try {
    await page.goto("/");
    for (const pageNumber of processingPages) {
      const sourcePage = source.pages.find((candidate) => candidate.pageNumber === pageNumber)!;
      const allLabels = distinctLabels(pageNumber, sourcePage.textElements);
      if (publishPageSet.has(pageNumber)) expected.push(...allLabels);
      const labels = publishPageSet.has(pageNumber)
        ? allLabels
        : allLabels.filter(({ identity }) => CALLOUT_RECOVERY_BY_IDENTITY.has(identity));
      if (labels.length === 0) continue;

      const shapePage = await shapeDoc.getPage(pageNumber);
      const shapeViewport = shapePage.getViewport({ scale: 1 });
      const pageArea = shapeViewport.width * shapeViewport.height;
      const vectorBoxes = extractPageShapes(
        (await shapePage.getOperatorList()) as unknown as OperatorList,
        shapeCodes,
      )
        .map(({ bounds }) => bounds)
        .filter((bounds) => {
          const width = bounds.maxXPt - bounds.minXPt;
          const height = bounds.maxYPt - bounds.minYPt;
          return width > 25 && height > 25 && width * height < pageArea * 0.5;
        });
      const pending: {
        readonly label: QuantityLabel;
        readonly panel: (typeof panels)[number]["bounds"];
        readonly stepNumber: number;
      }[] = [];
      const pageTargets: CalloutTarget[] = [];
      for (const label of labels) {
        const panelMatches = panels.filter(
          (candidate) =>
            candidate.pageNumber === pageNumber && contains(candidate.bounds, label.xPt, label.yPt),
        );
        if (panelMatches.length !== 1) {
          failure(
            failures,
            label,
            "panel",
            "quantity-panel-cardinality",
            `${label.identity} matched ${panelMatches.length} step panels; exactly one is required.`,
          );
          continue;
        }
        const containing = vectorBoxes
          .filter((bounds) => contains(bounds, label.xPt, label.yPt))
          .sort((left, right) => area(left) - area(right));
        if (containing.length === 0) {
          pending.push({
            label,
            panel: panelMatches[0]!.bounds,
            stepNumber: panelMatches[0]!.stepNumber,
          });
          continue;
        }
        const contract = evidenceContract(label.identity, "vector-smallest")!;
        pageTargets.push({
          ...label,
          stepNumber: panelMatches[0]!.stepNumber,
          box: containing[0]!,
          boxMethod: "vector-smallest",
          ...contract,
        });
      }
      for (const entry of pending) {
        const peers = pageTargets.filter(
          (peer) =>
            peer.stepNumber === entry.stepNumber && contains(entry.panel, peer.xPt, peer.yPt),
        );
        const box = recoverPanelNeighbourCell(entry.label, entry.panel, peers);
        const contract = evidenceContract(entry.label.identity, "panel-neighbor-cell");
        if (box === null || contract === null) {
          failure(
            failures,
            entry.label,
            "box",
            contract === null ? "unregistered-unboxed-semantic" : "panel-neighbor-cell-degenerate",
            contract === null
              ? `${entry.label.identity} has no vector box and no preregistered semantic evidence contract.`
              : `${entry.label.identity} has no vector box and its derived panel-neighbor cell is smaller than 25pt.`,
          );
          continue;
        }
        pageTargets.push({
          ...entry.label,
          stepNumber: entry.stepNumber,
          box,
          boxMethod: "panel-neighbor-cell",
          ...contract,
        });
      }
      targets.push(...pageTargets);
      if (pageTargets.length === 0) continue;
      browserResults.push(
        ...(await page.evaluate(renderCalloutCrops, {
          ...bookletProbeUrls(),
          pageNumber,
          targets: pageTargets,
        })),
      );
    }
  } finally {
    await shapeDoc.destroy();
  }

  if (expected.length === 0) {
    throw new Error(
      `Selected step pages ${publishPages.join(", ")} contain no distinct Nx labels; no manifest was published.`,
    );
  }
  const expectedIdentities = new Set(expected.map(({ identity }) => identity));
  expect(expectedIdentities.size).toBe(expected.length);
  const fullRun = PAGE_LIMIT === 0 && REQUESTED_PAGES === undefined;
  if (fullRun) {
    expect(expected.length).toBe(FULL_LABEL_COUNT);
    expect(expected.reduce((total, { quantity }) => total + quantity, 0)).toBe(
      FULL_RAW_NX_QUANTITY,
    );
  }
  const benchmark = evaluateRecoveryBenchmark(structure.sourceHash, browserResults);
  const selected = new Map<string, BrowserCrop>();
  for (const result of browserResults) {
    const crop = selectCrop(result);
    if (crop === null) {
      const label = targets.find(({ identity }) => identity === result.identity)!;
      failure(
        failures,
        label,
        "crop",
        "no-valid-evidence-crop",
        `${result.identity} produced no crop satisfying its ${result.targetEvidenceKind} evidence contract.`,
      );
    } else {
      selected.set(result.identity, crop);
    }
  }
  for (const label of expected) {
    if (
      !selected.has(label.identity) &&
      !failures.some(({ identity }) => identity === label.identity)
    ) {
      failure(
        failures,
        label,
        "box",
        "quantity-unaccounted",
        `${label.identity} reached neither a crop nor a typed failure.`,
      );
    }
  }
  expect(failures).toEqual([]);
  if (publishPages.includes(11)) {
    expect(
      targets.filter(({ pageNumber }) => pageNumber === 11).map(({ stepNumber }) => stepNumber),
    ).toEqual([1, 1, 2, 3, 4, 4]);
  }

  const publishedTargets = targets
    .filter(({ identity }) => expectedIdentities.has(identity))
    .sort((left, right) => left.identity.localeCompare(right.identity));
  const crops: PreparedCrop[] = publishedTargets.map((target) => {
    const crop = selected.get(target.identity)!;
    expect(crop.contamination).toEqual([]);
    if (target.evidenceKind === "part-art") expect(crop.textGlyphOverlapPixels).toBe(0);
    const png = Buffer.from(crop.url.split(",")[1]!, "base64");
    const metadata: PublishedCallout = {
      identity: target.identity,
      fileName: `${fileStem(target.identity)}.png`,
      pageNumber: target.pageNumber,
      stepNumber: target.stepNumber,
      quantity: target.quantity,
      xPt: target.xPt,
      yPt: target.yPt,
      boxMethod: target.boxMethod,
      box: target.box,
      evidenceKind: target.evidenceKind,
      regionKind: target.regionKind,
      cropStrategy: crop.strategy,
      masksApplied: crop.masksApplied,
      contamination: crop.contamination,
      sha256: sha256(png),
      byteLength: png.length,
      widthPx: crop.widthPx,
      heightPx: crop.heightPx,
      foregroundPixels: crop.foregroundPixels,
      sourceTextGlyphPixels: crop.sourceTextGlyphPixels,
      sourceQuantityGlyphPixels: crop.sourceQuantityGlyphPixels,
      textGlyphOverlapPixels: crop.textGlyphOverlapPixels,
      quantityGlyphOverlapPixels: crop.quantityGlyphOverlapPixels,
      quantityGlyphPixelsMasked: crop.quantityGlyphPixelsMasked,
      cropRectPx: crop.cropRectPx,
      boundaryClearancePx: crop.boundaryClearancePx,
    };
    return { metadata, png };
  });
  expect(crops.length).toBe(expected.length);

  const rawNxQuantityTotal = expected.reduce((total, { quantity }) => total + quantity, 0);
  const physical = crops.filter(({ metadata }) => metadata.evidenceKind === "part-art");
  const semantic = crops.filter(({ metadata }) => metadata.evidenceKind !== "part-art");
  const accounting = {
    rawNxIdentityCount: expected.length,
    rawNxQuantityTotal,
    physicalPartArtIdentityCount: physical.length,
    physicalPartArtQuantityTotal: physical.reduce(
      (total, { metadata }) => total + metadata.quantity,
      0,
    ),
    semanticIdentityCount: semantic.length,
    semanticQuantityTotal: semantic.reduce((total, { metadata }) => total + metadata.quantity, 0),
  };
  if (fullRun) {
    expect(benchmark.fixedFailureClassSize).toBe(
      FULL_BOOKLET_CALLOUT_ACCOUNTING.fixedFailureClassSize,
    );
    expect(accounting.physicalPartArtIdentityCount).toBe(FULL_PHYSICAL_LABEL_COUNT);
    expect(accounting.physicalPartArtQuantityTotal).toBe(FULL_PHYSICAL_QUANTITY);
    expect(accounting.semanticIdentityCount).toBe(
      FULL_BOOKLET_CALLOUT_ACCOUNTING.semanticIdentityCount,
    );
    expect(accounting.semanticQuantityTotal).toBe(
      FULL_BOOKLET_CALLOUT_ACCOUNTING.semanticQuantityTotal,
    );
    expect(semantic.map(({ metadata }) => metadata.identity).sort()).toEqual(
      SEMANTIC_CALLOUTS.map(({ identity }) => identity).sort(),
    );
  }
  const conservation = {
    expectedIdentityCount: expected.length,
    expectedRawNxQuantityTotal: rawNxQuantityTotal,
    expectedIdentitySetSha256: sha256([...expectedIdentities].sort().join("\n")),
    publishedIdentityCount: crops.length,
    publishedRawNxQuantityTotal: crops.reduce(
      (total, { metadata }) => total + metadata.quantity,
      0,
    ),
    publishedIdentitySetSha256: sha256(
      crops
        .map(({ metadata }) => metadata.identity)
        .sort()
        .join("\n"),
    ),
  };
  expect(conservation.publishedIdentitySetSha256).toBe(conservation.expectedIdentitySetSha256);
  expect(conservation.publishedRawNxQuantityTotal).toBe(conservation.expectedRawNxQuantityTotal);

  const runId = sha256(
    JSON.stringify({
      schemaVersion: "lego.callout-thumbnails/4",
      sourceHash: structure.sourceHash,
      publishPages,
      benchmark,
      accounting,
      conservation,
      crops: crops.map(({ metadata }) => metadata),
    }),
  ).slice("sha256:".length, "sha256:".length + 24);
  const manifest: CalloutManifest = {
    schemaVersion: "lego.callout-thumbnails/4",
    sourceHash: structure.sourceHash,
    pageSelection: fullRun ? "full booklet" : publishPages,
    pagesCropped: publishPages.length,
    calloutCount: crops.length,
    accounting,
    recoveryBenchmark: benchmark,
    conservation,
    failures,
    callouts: crops.map(({ metadata: { fileName, ...metadata } }) => ({
      ...metadata,
      file: `runs/${runId}/${fileName}`,
    })),
  };
  const publication = publishCalloutRun({
    outDirectory: OUT,
    pointerFile: fullRun ? "manifest.json" : "manifest.partial.json",
    runId,
    manifest,
    crops,
  });
  console.log(
    `published ${accounting.rawNxIdentityCount} raw Nx identities / ${accounting.rawNxQuantityTotal} raw quantity; ` +
      `${accounting.physicalPartArtIdentityCount} physical part-art labels / ${accounting.semanticIdentityCount} semantic labels; ` +
      `run ${runId}; reused=${publication.reused}; cleaned=${publication.cleanup.removedFiles}`,
  );
});
