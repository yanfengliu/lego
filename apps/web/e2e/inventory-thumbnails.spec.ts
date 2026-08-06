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
  type GalleryAssignmentPair,
  type GalleryContaminationCode,
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
  readonly componentPixels: number;
  readonly unclaimedRivalPixels: number;
  readonly rivalComponentPixels: number;
  readonly rivalComponentCount: number;
  readonly quantityGlyphInkPixels: number;
  readonly quantityGlyphPixelsInCropRect: number;
  readonly sourceTextGlyphPixels: number;
  readonly selectedScore: number;
  readonly runnerUpScore: number | null;
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
  const unassigned: { elementId: string; pageNumber: number; reason: string }[] = [];

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
    // across the whole page.
    const maximumDistancePx = MAXIMUM_CANDIDATE_DISTANCE_PT * RENDER_SCALE;
    const pairs: GalleryAssignmentPair[] = [];
    for (const [labelIndex, label] of analysis.labels.entries()) {
      for (const [componentIndex, component] of analysis.components.entries()) {
        const score = galleryComponentScore({
          labelXPx: label.labelXPx,
          labelTopPx: label.labelTopPx,
          componentLeftPx: component.leftPx,
          componentRightPx: component.rightPx,
          componentBottomPx: component.bottomPx,
        });
        // A component drawn below its own label is another cell's; only the
        // picture above a label can belong to it.
        if (component.bottomPx > label.labelTopPx) continue;
        if (score > maximumDistancePx) continue;
        pairs.push({ labelIndex, componentIndex, score });
      }
    }
    const assignment = assignGalleryComponents(pairs);

    const requests: InventoryCropRequest[] = [];
    const selection = new Map<string, { score: number; runnerUp: number | null }>();
    for (const [labelIndex, label] of analysis.labels.entries()) {
      const chosen = assignment.byLabel.get(labelIndex);
      if (chosen === undefined) {
        unassigned.push({
          elementId: label.elementId,
          pageNumber,
          reason:
            `No ink component sits above element ${label.elementId} within ` +
            `${MAXIMUM_CANDIDATE_DISTANCE_PT}pt of its label, or every candidate was taken by a nearer element.`,
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
      selection.set(label.elementId, {
        score: chosen.score,
        runnerUp: assignment.runnerUpByLabel.get(labelIndex) ?? null,
      });
    }

    const crops = await page.evaluate(cropAssignedInventoryComponents, { pageNumber, requests });
    const quantityByElement = new Map(
      inventory.entries.map(({ elementId, quantity }) => [elementId, quantity]),
    );
    // A component another cell was awarded is that cell's part, correctly
    // painted out of this one. Only ink nobody claimed can be this part's own
    // missing half, so only that counts against the crop.
    const claimedComponents = new Set(
      [...assignment.byLabel.values()].map(
        ({ componentIndex }) => analysis.components[componentIndex]!.index,
      ),
    );
    for (const crop of crops) {
      const chosen = selection.get(crop.elementId)!;
      const unclaimedRivalPixels = crop.rivalComponents
        .filter(({ index }) => !claimedComponents.has(index))
        .reduce((total, { pixels }) => total + pixels, 0);
      const contamination = adjudicateGalleryCrop({
        foregroundPixels: crop.foregroundPixels,
        componentPixels: crop.componentPixels,
        unclaimedRivalPixels,
        rivalComponentCount: crop.rivalComponents.length,
        quantityGlyphInkPixels: crop.quantityGlyphInkPixels,
        sourceTextGlyphPixels: crop.sourceTextGlyphPixels,
        selectedScore: chosen.score,
        runnerUpScore: chosen.runnerUp,
        touchesPageBoundary: crop.touchesPageBoundary,
        boundaryClearancePx: crop.boundaryClearancePx,
        floodBudgetExhausted: false,
      });
      const png = Buffer.from(crop.url.split(",")[1]!, "base64");
      const file = `${crop.elementId}.png`;
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
        componentPixels: crop.componentPixels,
        unclaimedRivalPixels,
        rivalComponentPixels: crop.rivalComponents.reduce((total, { pixels }) => total + pixels, 0),
        rivalComponentCount: crop.rivalComponents.length,
        quantityGlyphInkPixels: crop.quantityGlyphInkPixels,
        quantityGlyphPixelsInCropRect: crop.quantityGlyphPixelsInCropRect,
        sourceTextGlyphPixels: crop.sourceTextGlyphPixels,
        selectedScore: Math.round(chosen.score * 100) / 100,
        runnerUpScore: chosen.runnerUp === null ? null : Math.round(chosen.runnerUp * 100) / 100,
        touchesPageBoundary: crop.touchesPageBoundary,
        boundaryClearancePx: crop.boundaryClearancePx,
        cropRectPx: crop.cropRectPx,
      });
    }
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
        policy: GALLERY_CROP_POLICY,
        renderScale: RENDER_SCALE,
        sourceHash: inventory.sourceHash,
        totalPieces: inventory.totalPieces,
        distinctElements: inventory.distinctElements,
        published: published.length,
        contaminated: contaminated.length,
        contaminationByCode: Object.fromEntries(
          [...byCode].sort(([left], [right]) => left.localeCompare(right)),
        ),
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

  console.log(
    `published ${published.length}/${inventory.distinctElements} thumbnails; ` +
      `${contaminated.length} contaminated; ${unassigned.length} unassigned`,
  );

  // A crop that cannot say what is wrong with it is what this replaces, so the
  // gallery fails on its own measurement rather than shipping a bad picture.
  expect(
    contaminated.map(({ elementId, contamination }) => `${elementId}: ${contamination.join(",")}`),
  ).toEqual([]);
  expect(unassigned).toEqual([]);
  expect(published.length).toBe(inventory.distinctElements);
});
