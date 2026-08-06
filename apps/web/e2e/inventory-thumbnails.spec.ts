import { mkdirSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";

import { test, expect } from "@playwright/test";

import { readFileSync } from "node:fs";

import { ingestInstructionPdf, type PdfDocument } from "../src/instructions/ingest-pdf";
import { extractPartsInventory } from "../src/instructions/parts-inventory";
import {
  GALLERY_CROP_CONTRACT_VERSION,
  GALLERY_CROP_POLICY,
  adjudicateGalleryCrop,
  assignGalleryComponents,
  galleryComponentScore,
  summariseCodeReachability,
  type GalleryAssignmentPair,
  type GalleryContaminationCode,
  type GalleryCropMeasurement,
  type GalleryLabelAssignment,
} from "./gallery-crop-contract";
import {
  INVENTORY_PAGE_LIMITS,
  analyseInventoryPage,
  cropAssignedInventoryComponents,
  type InventoryCropRequest,
} from "./inventory-browser-crops";
import { SAMPLE_BOOKLET_PATH, bookletProbeUrls, hasSampleBooklet } from "./sample-booklet";

/**
 * Cuts one labelled thumbnail out of the page for every inventory element, and
 * says what is wrong with each one.
 *
 * This is what makes an image reader measurable. The element id beside every
 * thumbnail comes out of the text layer, so each crop arrives already labelled
 * without anything having looked at a picture, and the labels resolve to real
 * part names against a published inventory. That turns "does the reader work"
 * from an impression into a score.
 *
 * What it did not do was check its own work. A cell used to be a rectangle
 * sized from the column pitch and a climb up through clear rows, and the
 * inventory grid is ragged: `383228`'s 2x8 plate overflows its column, so the
 * rectangle cut its right end off, and that same overflow sat inside the
 * rectangle `302028` one column over was cut from. Both crops were published
 * looking exactly like good ones, and both ranked far down the retrieval they
 * feed — 197th and 17th of 265 — so the right answer for two refused callouts
 * never reached a card.
 *
 * A rectangle is the wrong object. The page is labelled into connected
 * components once, PDF text masked out, and each element is assigned one
 * component globally — a component belongs to exactly one cell, so taking it
 * costs every other cell. Then every crop publishes its own measurement, and a
 * contaminated one fails the run rather than joining the gallery.
 */
const OUT = "output/inventory-thumbnails";
const MANIFEST_SCHEMA = "lego.inventory-thumbnails/1" as const;
const RENDER_SCALE = 8;
/** A part picture is at least this many ink pixels; below it is print noise. */
const MINIMUM_COMPONENT_PIXELS = 900;
/** Padding around the isolated component, in pixels of the rendered page. */
const CROP_PAD_PX = Math.round(0.6 * RENDER_SCALE);
/**
 * How far from its element id a component may sit and still be a candidate for
 * it, in points. Wide enough that a part overflowing its column still reaches
 * its own label, narrow enough that the far side of the page never competes.
 */
const MAXIMUM_CANDIDATE_DISTANCE_PT = 120;

interface PublishedThumbnail {
  readonly elementId: string;
  readonly file: string;
  readonly quantity: number;
  readonly pageNumber: number;
  readonly masksApplied: readonly string[];
  readonly contamination: readonly GalleryContaminationCode[];
  readonly sha256: string;
  readonly byteLength: number;
  readonly widthPx: number;
  readonly heightPx: number;
  readonly foregroundPixels: number;
  readonly largestUnclaimedRivalPixels: number;
  readonly largestUnclaimedRivalAreaPt2: number;
  readonly unclaimedRivalComponentsAboveThreshold: number;
  readonly rivalComponentPixels: number;
  readonly rivalComponentCount: number;
  readonly quantityGlyphInkPixels: number;
  readonly quantityGlyphPixelsInCropRect: number;
  readonly sourceTextGlyphPixels: number;
  readonly selectedScore: number;
  readonly freeRunnerUpScore: number | null;
  readonly outbidScore: number | null;
  readonly touchesPageBoundary: boolean;
  readonly boundaryClearancePx: {
    readonly left: number;
    readonly top: number;
    readonly right: number;
    readonly bottom: number;
  };
  readonly cropRectPx: {
    readonly left: number;
    readonly top: number;
    readonly right: number;
    readonly bottom: number;
  };
}

test("crops a labelled, measured thumbnail for every inventory element", async ({ page }) => {
  test.setTimeout(1_200_000);
  test.skip(!hasSampleBooklet, "no sample booklet");
  mkdirSync(OUT, { recursive: true });

  const bytes = readFileSync(SAMPLE_BOOKLET_PATH!);
  const source = await ingestInstructionPdf(
    { name: "6651557.pdf", arrayBuffer: async () => bytes.buffer as ArrayBuffer },
    {
      loadPdf: async () => {
        const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
        return (await getDocument({ data: new Uint8Array(bytes), isEvalSupported: false })
          .promise) as unknown as PdfDocument;
      },
    },
  );
  const inventory = extractPartsInventory(source);
  expect(inventory.entries.length).toBeGreaterThan(0);

  await page.goto("/");
  const published: PublishedThumbnail[] = [];
  const measurements: GalleryCropMeasurement[] = [];
  const writtenFiles = new Set<string>();
  const unassigned: { elementId: string; pageNumber: number; reason: string }[] = [];
  const unclaimedComponents: {
    pageNumber: number;
    pixels: number;
    boundsPx: { left: number; top: number; right: number; bottom: number };
  }[] = [];
  const pageReports: {
    pageNumber: number;
    labels: number;
    inkComponentsFound: number;
    inkComponentsBelowPartThreshold: number;
    candidateComponents: number;
    candidatePairs: number;
    pairsDroppedBelowLabel: number;
    pairsDroppedBeyondDistance: number;
    componentsNoElementTook: number;
  }[] = [];

  for (const pageNumber of inventory.pageNumbers) {
    const anchors = inventory.entries
      .filter((entry) => entry.pageNumber === pageNumber)
      .map(({ elementId, quantity, xPt, yPt }) => ({ elementId, quantity, xPt, yPt }));
    if (anchors.length === 0) continue;

    const analysis = await page.evaluate(analyseInventoryPage, {
      ...bookletProbeUrls(),
      pageNumber,
      scale: RENDER_SCALE,
      minimumComponentPixels: MINIMUM_COMPONENT_PIXELS,
      limits: INVENTORY_PAGE_LIMITS,
      anchors,
    });

    // Every (element, component) pair near enough to be plausible, scored by
    // how far the picture sits from the label that names it, then assigned once
    // across the whole page. Both rejections are counted: a pair silently
    // dropped is a candidate the gallery could not have chosen, and a run that
    // does not say how many it dropped cannot be told from one that had none.
    const maximumDistancePx = MAXIMUM_CANDIDATE_DISTANCE_PT * RENDER_SCALE;
    const pairs: GalleryAssignmentPair[] = [];
    let droppedBelowLabel = 0;
    let droppedBeyondDistance = 0;
    for (const [labelIndex, label] of analysis.labels.entries()) {
      for (const [componentIndex, component] of analysis.components.entries()) {
        // A component drawn below its own label is another cell's; only the
        // picture above a label can belong to it.
        if (component.bottomPx > label.labelTopPx) {
          droppedBelowLabel += 1;
          continue;
        }
        const score = galleryComponentScore({
          labelXPx: label.labelXPx,
          labelTopPx: label.labelTopPx,
          componentLeftPx: component.leftPx,
          componentRightPx: component.rightPx,
          componentBottomPx: component.bottomPx,
        });
        if (score > maximumDistancePx) {
          droppedBeyondDistance += 1;
          continue;
        }
        pairs.push({ labelIndex, componentIndex, score });
      }
    }
    const assignment = assignGalleryComponents(
      pairs,
      analysis.components.map((_component, index) => index),
    );

    const requests: InventoryCropRequest[] = [];
    const selection = new Map<string, GalleryLabelAssignment>();
    for (const [labelIndex, label] of analysis.labels.entries()) {
      const chosen = assignment.byLabel.get(labelIndex);
      if (chosen === undefined) {
        // Two very different failures; naming which one, with the numbers that
        // decided it, is the difference between a diagnosis and a shrug.
        const offered = pairs.filter((pair) => pair.labelIndex === labelIndex);
        unassigned.push({
          elementId: label.elementId,
          pageNumber,
          reason:
            offered.length === 0
              ? `No ink component of at least ${MINIMUM_COMPONENT_PIXELS} pixels sits above element ` +
                `${label.elementId} within ${MAXIMUM_CANDIDATE_DISTANCE_PT}pt of its label; the page held ` +
                `${analysis.components.length} candidate component(s).`
              : `All ${offered.length} candidate(s) for element ${label.elementId} were taken by nearer ` +
                `elements; its best would have scored ` +
                `${Math.round(Math.min(...offered.map(({ score }) => score)) * 100) / 100}.`,
        });
        continue;
      }
      const component = analysis.components[chosen.componentIndex]!;
      requests.push({
        elementId: label.elementId,
        componentIndex: component.index,
        componentBoundsPx: {
          left: component.leftPx,
          top: component.topPx,
          right: component.rightPx,
          bottom: component.bottomPx,
        },
        componentPixels: component.pixels,
        padPx: CROP_PAD_PX,
      });
      selection.set(label.elementId, chosen);
    }

    const crops = await page.evaluate(cropAssignedInventoryComponents, {
      pageNumber,
      rasterId: analysis.rasterId,
      requests,
    });
    const quantityByElement = new Map(
      inventory.entries.map(({ elementId, quantity }) => [elementId, quantity]),
    );
    // A component another cell was awarded is that cell's part, correctly
    // painted out of this one. Ink nobody claimed is the dangerous kind — but
    // "nobody claimed it" mostly means "it is a speck of antialiasing", so the
    // check is on the largest single unclaimed blob, and separately on whether
    // any unclaimed blob is itself big enough to have been a part picture.
    const componentByIndex = new Map(
      analysis.components.map((component) => [component.index, component]),
    );
    const claimed = new Set(
      [...assignment.byLabel.values()].map(
        ({ componentIndex }) => analysis.components[componentIndex]!.index,
      ),
    );
    for (const leftover of assignment.unclaimedComponents) {
      const component = analysis.components[leftover]!;
      unclaimedComponents.push({
        pageNumber,
        pixels: component.pixels,
        boundsPx: {
          left: component.leftPx,
          top: component.topPx,
          right: component.rightPx,
          bottom: component.bottomPx,
        },
      });
    }
    for (const crop of crops) {
      const chosen = selection.get(crop.elementId)!;
      const unclaimedRivals = crop.rivalComponents.filter(({ index }) => !claimed.has(index));
      const measurement = {
        foregroundPixels: crop.foregroundPixels,
        largestUnclaimedRivalPixels: unclaimedRivals[0]?.pixels ?? 0,
        largestUnclaimedRivalAreaPt2:
          Math.round(((unclaimedRivals[0]?.pixels ?? 0) / (RENDER_SCALE * RENDER_SCALE)) * 100) /
          100,
        unclaimedRivalComponentsAboveThreshold: unclaimedRivals.filter(
          ({ index }) => (componentByIndex.get(index)?.pixels ?? 0) >= MINIMUM_COMPONENT_PIXELS,
        ).length,
        quantityGlyphInkPixels: crop.quantityGlyphInkPixels,
        selectedScore: chosen.score,
        freeRunnerUpScore: chosen.freeRunnerUpScore,
        touchesPageBoundary: crop.touchesPageBoundary,
      };
      measurements.push(measurement);
      const contamination = adjudicateGalleryCrop(measurement);
      const png = Buffer.from(crop.url.split(",")[1]!, "base64");
      const file = `${crop.elementId}.png`;
      if (writtenFiles.has(file)) {
        throw new TypeError(
          `Element ${crop.elementId} was published twice, so the second crop would overwrite the ` +
            `first and the manifest would carry two records for one file. The printed inventory ` +
            `repeats an element id; publish it under a per-entry name before allowing that.`,
        );
      }
      writtenFiles.add(file);
      writeFileSync(`${OUT}/${file}`, png);
      published.push({
        elementId: crop.elementId,
        file,
        quantity: quantityByElement.get(crop.elementId) ?? 0,
        pageNumber,
        masksApplied: ["all-pdf-text", "quantity-label"],
        contamination,
        sha256: `sha256:${createHash("sha256").update(png).digest("hex")}`,
        byteLength: png.byteLength,
        widthPx: crop.widthPx,
        heightPx: crop.heightPx,
        foregroundPixels: crop.foregroundPixels,
        largestUnclaimedRivalPixels: measurement.largestUnclaimedRivalPixels,
        largestUnclaimedRivalAreaPt2: measurement.largestUnclaimedRivalAreaPt2,
        unclaimedRivalComponentsAboveThreshold: measurement.unclaimedRivalComponentsAboveThreshold,
        rivalComponentPixels: crop.rivalComponents.reduce((total, { pixels }) => total + pixels, 0),
        rivalComponentCount: crop.rivalComponents.length,
        quantityGlyphInkPixels: crop.quantityGlyphInkPixels,
        quantityGlyphPixelsInCropRect: crop.quantityGlyphPixelsInCropRect,
        sourceTextGlyphPixels: crop.sourceTextGlyphPixels,
        selectedScore: Math.round(chosen.score * 100) / 100,
        freeRunnerUpScore:
          chosen.freeRunnerUpScore === null
            ? null
            : Math.round(chosen.freeRunnerUpScore * 100) / 100,
        outbidScore:
          chosen.outbidScore === null ? null : Math.round(chosen.outbidScore * 100) / 100,
        touchesPageBoundary: crop.touchesPageBoundary,
        boundaryClearancePx: crop.boundaryClearancePx,
        cropRectPx: crop.cropRectPx,
      });
    }
    pageReports.push({
      pageNumber,
      labels: analysis.labels.length,
      inkComponentsFound: analysis.componentsFound,
      inkComponentsBelowPartThreshold: analysis.componentsFound - analysis.components.length,
      candidateComponents: analysis.components.length,
      candidatePairs: pairs.length,
      pairsDroppedBelowLabel: droppedBelowLabel,
      pairsDroppedBeyondDistance: droppedBeyondDistance,
      componentsNoElementTook: assignment.unclaimedComponents.length,
    });
  }

  published.sort((left, right) => left.elementId.localeCompare(right.elementId));
  const contaminated = published.filter(({ contamination }) => contamination.length > 0);
  const byCode = new Map<GalleryContaminationCode, string[]>();
  for (const record of contaminated) {
    for (const code of record.contamination) {
      byCode.set(code, [...(byCode.get(code) ?? []), record.elementId]);
    }
  }
  writeFileSync(
    `${OUT}/manifest.json`,
    JSON.stringify(
      {
        schemaVersion: MANIFEST_SCHEMA,
        cropContract: GALLERY_CROP_CONTRACT_VERSION,
        // Every number that decided an outcome, not only the four the
        // adjudicator reads. The pool threshold and the candidate radius decide
        // far more than the adjudication thresholds do, and a manifest that
        // omits them cannot be argued with.
        constants: {
          renderScale: RENDER_SCALE,
          minimumComponentPixels: MINIMUM_COMPONENT_PIXELS,
          maximumCandidateDistancePt: MAXIMUM_CANDIDATE_DISTANCE_PT,
          cropPadPx: CROP_PAD_PX,
          ...INVENTORY_PAGE_LIMITS,
        },
        policy: GALLERY_CROP_POLICY,
        sourceHash: inventory.sourceHash,
        totalPieces: inventory.totalPieces,
        distinctElements: inventory.distinctElements,
        published: published.length,
        contaminated: contaminated.length,
        contaminationByCode: Object.fromEntries(
          [...byCode].sort(([left], [right]) => left.localeCompare(right)),
        ),
        // How close each check came to firing. "No crop was contaminated" and
        // "no crop could have been" read identically without this.
        codeReachability: summariseCodeReachability(measurements),
        // What the pipeline discarded, per page. An unreported drop is a
        // candidate the gallery could not have chosen, and silence about it
        // reads as "there were none".
        pages: pageReports,
        // Ink the assignment left on the table that is large enough to have
        // been a part picture. This is where page furniture shows up: the
        // circled bag number is a legitimate scoring candidate and is kept out
        // only by distance, never by kind.
        unclaimedComponents: unclaimedComponents.sort((left, right) => right.pixels - left.pixels),
        unassigned,
        thumbnails: published,
      },
      null,
      1,
    ),
  );
  // Kept for every reader that still expects the flat label list.
  writeFileSync(
    `${OUT}/labels.json`,
    JSON.stringify(
      {
        note: "Labels come from the booklet's text layer, not from reading any picture.",
        sourceHash: inventory.sourceHash,
        totalPieces: inventory.totalPieces,
        entries: inventory.entries.map(({ elementId, quantity }) => ({ elementId, quantity })),
      },
      null,
      1,
    ),
  );

  const reachability = summariseCodeReachability(measurements);
  console.log(
    `published ${published.length}/${inventory.distinctElements} thumbnails; ` +
      `${contaminated.length} contaminated; ${unassigned.length} unassigned; ` +
      `${unclaimedComponents.length} component(s) no element took\n` +
      reachability
        .map(
          ({ code, closestObserved, threshold, fired }) =>
            `  ${code}: fired ${fired}, closest ${closestObserved} against ${threshold}`,
        )
        .join("\n"),
  );

  // A crop that cannot say what is wrong with it is what this replaces, so the
  // gallery fails on its own measurement rather than shipping a bad picture.
  expect(
    contaminated.map(({ elementId, contamination }) => `${elementId}: ${contamination.join(",")}`),
  ).toEqual([]);
  expect(unassigned).toEqual([]);
  // The set, not the count: two entries for one element id would overwrite one
  // file and publish two records for it, and a count comparison would report
  // that as an off-by-one rather than as the collision it is.
  expect(new Set(published.map(({ elementId }) => elementId)).size).toBe(published.length);
  expect(published.length).toBe(inventory.distinctElements);
});
