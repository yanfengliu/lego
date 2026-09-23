/**
 * Types for closed-set callout identification.
 *
 * Coordinates are PDF user space in points, y growing upward, exactly as pdf.js
 * reports text and image transforms. Nothing here carries booklet pixels: the
 * result names elements, positions and scores, so it can be written anywhere
 * without copying the artwork.
 */
export const IDENTIFY_SCHEMA_VERSION = "lego.booklet-identify/2" as const;

export interface Rect {
  readonly x0: number;
  readonly y0: number;
  readonly x1: number;
  readonly y1: number;
}

/** A positioned text run, as pdf.js splits the text layer. */
export interface TextRun {
  readonly text: string;
  readonly xPt: number;
  /** Baseline, y up. */
  readonly yPt: number;
  /** Font size in points (the text matrix's vertical scale). */
  readonly sizePt: number;
  readonly widthPt: number;
}

/** One `paintImageXObject`, with the transform and clip in force when it ran. */
export interface ImagePaint {
  /** Key of the decoded image in the page's image store. */
  readonly imageKey: string;
  /** Order on the page; later paints cover earlier ones. */
  readonly order: number;
  /** Image space (unit square) to page space: [a, b, c, d, e, f]. */
  readonly transform: readonly [number, number, number, number, number, number];
  /** Bounding box of the clip path in force, or null when nothing clips it. */
  readonly clip: Rect | null;
}

/** A filled path; callout boxes are the axis-aligned rectangles among them. */
export interface FillPath {
  readonly bounds: Rect;
  readonly isRectangle: boolean;
}

export interface PageScan {
  readonly pageNumber: number;
  readonly widthPt: number;
  readonly heightPt: number;
  readonly texts: readonly TextRun[];
  readonly paints: readonly ImagePaint[];
  readonly fills: readonly FillPath[];
}

/** Decoded pixels of one image XObject, always 8-bit RGB. */
export interface DecodedImage {
  readonly width: number;
  readonly height: number;
  readonly rgb: Uint8Array;
  /** Present when the image carried a soft mask; one byte per pixel. */
  readonly alpha: Uint8Array | null;
  /** Content address of the decoded pixels, so a reused drawing is recognisable. */
  readonly digest: string;
}

export type CalloutFlag =
  /** The runner-up scored within `lowMargin` of the chosen element. */
  | "low-margin"
  /** The chosen element's mask agreement is below `lowIou`. */
  | "low-score"
  /** Inventory capacity forced an element other than the visual first choice. */
  | "conflict"
  /** No image sits where the count label says its picture should be. */
  | "unlinked-picture"
  /** Nothing drawable was found for the count label. */
  | "no-picture"
  /** The picture was assembled from more than one separated piece. */
  | "fragments-merged"
  /** The picture touched a neighbouring callout's picture and was cut apart. */
  | "merged-split"
  /** The label sits inside its picture's image rectangle, not below it. */
  | "anchor-contains-label"
  /** A callout outside any numbered step, such as a bag-opening page. */
  | "outside-step"
  /** The assignment could not place it within the inventory's counts. */
  | "unassigned"
  /** The assignment search hit its node budget before proving this drawing's element best. */
  | "assignment-unproven";

export interface Candidate {
  readonly elementId: string;
  readonly score: number;
  readonly iou: number;
}

export interface CalloutIdentification {
  /** `p<page>|q<count>|x<x>|y<y>`: the count label's page, quantity and position. */
  readonly id: string;
  readonly page: number;
  readonly step: number | null;
  readonly count: number;
  /** Picture bounding box on the page, in points; null when no picture was found. */
  readonly bbox: Rect | null;
  /** Identical drawings share this key and are forced to the same element. */
  readonly drawing: string | null;
  readonly elementId: string | null;
  readonly score: number | null;
  readonly iou: number | null;
  readonly firstChoice: Candidate | null;
  readonly runnerUp: Candidate | null;
  /** Assigned score minus the best other candidate's score. */
  readonly margin: number | null;
  /** The top candidates by visual score, best first. */
  readonly candidates: readonly Candidate[];
  readonly flags: readonly CalloutFlag[];
}

export interface InventoryElement {
  readonly elementId: string;
  readonly count: number;
  readonly page: number;
  /** Where the count label is printed. */
  readonly xPt: number;
  readonly yPt: number;
  readonly bbox: Rect | null;
  readonly flags: readonly CalloutFlag[];
}

export interface StepTotals {
  readonly step: number;
  readonly pages: readonly number[];
  /** Element id to pieces, in element-id order. */
  readonly elements: Readonly<Record<string, number>>;
  readonly unassignedPieces: number;
}

export interface Reconciliation {
  readonly elementId: string;
  readonly inventory: number;
  readonly assigned: number;
}

export interface Residual {
  readonly calloutId: string;
  readonly page: number;
  readonly step: number | null;
  readonly count: number;
  readonly flags: readonly CalloutFlag[];
  readonly elementId: string | null;
  /** The closed question to put to a checker: is the picture one of these? */
  readonly candidates: readonly Candidate[];
}

/**
 * What the capacity constraint forces. These are not evidence that any picture
 * was read right: the assignment never spends more of an element than the
 * inventory holds, so on a booklet whose callouts add up to its inventory they
 * come out full whichever elements the pictures are given. In the review of
 * 71f2f55 a sweep of the weights moved first-choice agreement from 761 to 839
 * callouts and left these at 859/859 and 275/276 throughout.
 */
export interface ForcedByCapacity {
  /** Step callouts given an element. */
  readonly calloutsAssigned: number;
  readonly piecesAssigned: number;
  /** Elements whose assigned pieces equal their inventory count exactly. */
  readonly elementsExact: number;
}

export interface IdentifySummary {
  readonly inventoryElements: number;
  readonly inventoryPieces: number;
  readonly inventoryThumbnails: number;
  readonly callouts: number;
  readonly calloutPieces: number;
  readonly stepCallouts: number;
  readonly stepCalloutPieces: number;
  readonly calloutsWithPicture: number;
  readonly drawings: number;
  readonly forcedByCapacity: ForcedByCapacity;
  /**
   * Callouts whose assigned element is also their visual first choice: agreement
   * between two stages of this module, not accuracy. Accuracy comes only from
   * callouts a person judged, scored by `scoreAgainstTruth`.
   */
  readonly firstChoiceKept: number;
  /**
   * Callouts left for a closed-question check. The count depends on the weights
   * and thresholds (appearanceWeight, colourWeight, lowMargin, lowIou): the same
   * sweep moved it from 35 to 304. Compare it only between runs with equal
   * parameters.
   */
  readonly residuals: number;
}

export interface UnpairedElementId {
  readonly elementId: string;
  readonly page: number;
}

/** What the text layer said, before any picture was read. */
export interface TextCounts {
  readonly inventoryPages: readonly number[];
  /** Element ids on the inventory pages that no count label sits over; kept, never dropped. */
  readonly unpairedElementIds: readonly UnpairedElementId[];
  /** The size callout count labels are printed at, or null when no build page prints one. */
  readonly calloutLabelSizePt: number | null;
  /** Text runs on the build pages dropped as overprints of a run at the same spot. */
  readonly overprintsDropped: number;
  /** Count labels printed at another size: sub-assembly multipliers, not part callouts. */
  readonly otherSizeCountLabels: number;
  /** Step numbers found. */
  readonly stepNumbers: number;
  readonly lastStep: number | null;
  /** Numbers from 1 to `lastStep` that no step prints, and those printed more than once. */
  readonly missingSteps: readonly number[];
  readonly repeatedSteps: readonly number[];
}

/** How the drawings were assigned to elements; see `assign.ts`. */
export interface AssignmentSummary {
  /** 1000 per piece per point of score below a perfect match, 10,000,000 per unassigned piece. */
  readonly cost: number;
  /** The fractional optimum, which no whole assignment can beat. */
  readonly lowerBound: number;
  /** True when the search finished, so no whole assignment costs less than `cost`. */
  readonly provenOptimal: boolean;
  /** Flow problems solved; 1 when the fractional optimum was already whole. */
  readonly nodes: number;
}

export interface IdentifyResult {
  readonly schemaVersion: typeof IDENTIFY_SCHEMA_VERSION;
  readonly source: {
    readonly sha256: string;
    readonly byteLength: number;
    readonly pageCount: number;
    readonly pdfjsVersion: string;
  };
  readonly parameters: IdentifyParameters;
  readonly summary: IdentifySummary;
  readonly text: TextCounts;
  readonly assignment: AssignmentSummary;
  readonly inventory: readonly InventoryElement[];
  readonly callouts: readonly CalloutIdentification[];
  readonly steps: readonly StepTotals[];
  readonly reconciliation: readonly Reconciliation[];
  readonly residuals: readonly Residual[];
  readonly timingsMs: Readonly<Record<string, number>>;
}

export interface IdentifyParameters {
  /** Callout drawings are printed this many times larger than inventory thumbnails. */
  readonly calloutScale: number;
  /** Comparison grid, in pixels per inventory point. */
  readonly gridPxPerPt: number;
  /** Colour distance (0..441) above the local background that counts as ink. */
  readonly backgroundTolerance: number;
  /** Pixel shift searched in each direction when aligning two masks. */
  readonly alignSearchPx: number;
  /** How much appearance correlation counts against mask overlap. */
  readonly appearanceWeight: number;
  /** Score lost per unit of mean colour distance. */
  readonly colourWeight: number;
  /** Candidates kept per drawing for the assignment. */
  readonly candidatesPerDrawing: number;
  /** Flag a callout whose runner-up is this close. */
  readonly lowMargin: number;
  /** Flag a callout whose chosen element overlaps less than this. */
  readonly lowIou: number;
}
