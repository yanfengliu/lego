/**
 * The booklet's quantity-label type sizes, and the publication check derived from them.
 *
 * A step parts bin and a multiplier both print `Nx`, and the only thing on the
 * page that separates them is how big the glyphs are. That signal was extracted
 * and dropped, so a multiplier nobody had preregistered was counted as a
 * physical piece and nothing in the published evidence contradicted it: four of
 * them put the physical total 8 pieces above the printed inventory.
 *
 * Measured 2026-08-05 over `recipes/6651557.pdf`, with the publication's own
 * extraction (pdfjs item height, deduplicated by stable identity):
 *
 *   6pt    276 labels / 1465 pieces  back-matter inventory rows, pages 221-222
 *   8pt    859 labels / 1464 pieces  step parts-bin quantities, on the 196 step pages
 *   16pt    20 labels /   44 pieces  multipliers
 *   24pt     1 label  /    2 pieces  multiplier
 *   40pt     1 label  /    2 pieces  multiplier
 *
 * Two facts make a gate safe here. Nothing is set between 8 and 16, so a bound
 * at the smallest multiplier face separates the two classes with a factor of two
 * of margin. And 6pt is populated with a third meaning entirely, so the rule
 * cannot be "anything that is not the parts-bin face is a multiplier", and the
 * parts-bin band cannot be an open half-line downwards either. Anything outside
 * both bands is refused as a new case rather than guessed into one of them —
 * another set's booklet will have its own faces, and this check must say so.
 */

export type QuantityFaceClass = "parts-bin" | "multiplier";

/** The minimum a face check needs off a published callout record. */
export interface QuantityFaceRecord {
  readonly identity: string;
  readonly heightPt: number;
  readonly evidenceKind: string;
}

export const QUANTITY_LABEL_FACE_CONTRACT = Object.freeze({
  /** The one face every step parts bin sets its quantity in. */
  partsBinPt: 8,
  /**
   * Half the distance to the nearest other measured face, the 6pt back-matter
   * inventory row. Absorbs float dust from a different text extractor without
   * ever reaching a face that means something else.
   */
  partsBinTolerancePt: 1,
  /** The smallest multiplier face. 16, 24 and 40pt are all multipliers. */
  multiplierMinPt: 16,
});

/** Measured face population, for the tests and messages that quote it. */
export const MEASURED_QUANTITY_FACES_PT = Object.freeze({
  backMatterInventory: 6,
  partsBin: 8,
  multipliers: Object.freeze([16, 24, 40]),
});

export function classifyQuantityFace(heightPt: unknown): QuantityFaceClass | null {
  if (typeof heightPt !== "number" || !Number.isFinite(heightPt) || heightPt <= 0) return null;
  const { partsBinPt, partsBinTolerancePt, multiplierMinPt } = QUANTITY_LABEL_FACE_CONTRACT;
  if (heightPt >= multiplierMinPt) return "multiplier";
  if (Math.abs(heightPt - partsBinPt) <= partsBinTolerancePt) return "parts-bin";
  return null;
}

type FaceFaultCode =
  "face-unpublished" | "face-unclassifiable" | "multiplier-as-part-art" | "parts-bin-as-semantic";

interface FaceFault {
  readonly code: FaceFaultCode;
  readonly identity: string;
  readonly heightPt: unknown;
  readonly evidenceKind: string;
}

const { partsBinPt, partsBinTolerancePt, multiplierMinPt } = QUANTITY_LABEL_FACE_CONTRACT;

const PARTS_BIN_BAND = `${partsBinPt - partsBinTolerancePt}..${partsBinPt + partsBinTolerancePt}pt`;

const REMEDY: Readonly<Record<FaceFaultCode, string>> = Object.freeze({
  "face-unpublished":
    `Every published callout must carry the heightPt its Nx label was extracted at. ` +
    `Re-run the callout publication from the booklet; a manifest record cannot be repaired by hand.`,
  "face-unclassifiable":
    `A satisfying face is the ${PARTS_BIN_BAND} parts-bin band or ${multiplierMinPt}pt and above. ` +
    `This booklet sets step quantities at ${MEASURED_QUANTITY_FACES_PT.partsBin}pt, multipliers at ` +
    `${MEASURED_QUANTITY_FACES_PT.multipliers.join(", ")}pt, and back-matter inventory rows at ` +
    `${MEASURED_QUANTITY_FACES_PT.backMatterInventory}pt. Read the printed page at this face, decide what it means, ` +
    `and widen QUANTITY_LABEL_FACE_CONTRACT deliberately — an unmeasured face must not default into either class.`,
  "multiplier-as-part-art":
    `A label at or above ${multiplierMinPt}pt restates pieces the step's own parts bin has already counted, so ` +
    `publishing it as part-art double-counts them. Preregister the identity in CALLOUT_RECOVERY_FIXTURE with a ` +
    `non-part-art evidenceKind — subassembly-repeat or assembly-action — or correct the extraction that read this face.`,
  "parts-bin-as-semantic":
    `Every label in the ${PARTS_BIN_BAND} band is a step parts-bin quantity, so publishing it as anything but ` +
    `part-art drops real pieces from the physical total. Remove the identity from CALLOUT_RECOVERY_FIXTURE's ` +
    `semantic entries, or correct the extraction that read this face.`,
});

const SUMMARY: Readonly<Record<FaceFaultCode, string>> = Object.freeze({
  "face-unpublished": "publish no measured quantity-label type size",
  "face-unclassifiable": "were read at a type size this booklet has never been measured at",
  "multiplier-as-part-art":
    "were read at a multiplier type size but published as physical part art",
  "parts-bin-as-semantic": "were read at the parts-bin type size but published as semantic",
});

const ORDER: readonly FaceFaultCode[] = [
  "face-unpublished",
  "multiplier-as-part-art",
  "parts-bin-as-semantic",
  "face-unclassifiable",
];

const MAX_LISTED = 20;

function faultOf(record: QuantityFaceRecord): FaceFault | null {
  const { identity, heightPt, evidenceKind } = record;
  if (typeof heightPt !== "number" || !Number.isFinite(heightPt) || heightPt <= 0) {
    return { code: "face-unpublished", identity, heightPt, evidenceKind };
  }
  const faceClass = classifyQuantityFace(heightPt);
  if (faceClass === null) {
    return { code: "face-unclassifiable", identity, heightPt, evidenceKind };
  }
  if (faceClass === "multiplier" && evidenceKind === "part-art") {
    return { code: "multiplier-as-part-art", identity, heightPt, evidenceKind };
  }
  if (faceClass === "parts-bin" && evidenceKind !== "part-art") {
    return { code: "parts-bin-as-semantic", identity, heightPt, evidenceKind };
  }
  return null;
}

function line(fault: FaceFault): string {
  const face =
    typeof fault.heightPt === "number" && Number.isFinite(fault.heightPt)
      ? `${fault.heightPt}pt`
      : JSON.stringify(fault.heightPt ?? null);
  return `${fault.identity} at ${face}, published as ${JSON.stringify(fault.evidenceKind)}`;
}

/**
 * The derived publication check: the type size the booklet printed, against the
 * class the run is about to publish. It is deliberately independent of
 * CALLOUT_RECOVERY_FIXTURE, which stays the preregistered region and crop
 * contract — two sources agreeing is the point, and this one can see a label
 * nobody preregistered.
 */
export function assertPublishedQuantityFaces(records: readonly QuantityFaceRecord[]): void {
  const faults = records.flatMap((record) => {
    const fault = faultOf(record);
    return fault === null ? [] : [fault];
  });
  if (faults.length === 0) return;
  const code = ORDER.find((candidate) => faults.some((fault) => fault.code === candidate))!;
  const matching = faults.filter((fault) => fault.code === code);
  const listed = matching.slice(0, MAX_LISTED).map(line).join("; ");
  const elided = matching.length > MAX_LISTED ? ` (and ${matching.length - MAX_LISTED} more)` : "";
  const others =
    faults.length === matching.length
      ? ""
      : ` ${faults.length - matching.length} further callout(s) fail a different type-size condition; they are reported once this one is resolved.`;
  throw new Error(
    `Callout publication refused: ${matching.length} callout(s) ${SUMMARY[code]} — ${listed}${elided}. ` +
      `${REMEDY[code]}${others}`,
  );
}
