import type { CalloutResolution } from "./real-build-input-files";
import type { OfficialModelIndex } from "./real-build-ledger";
import type { OfficialBuilderIdentity } from "./real-build-action-ledger";

/**
 * How one printed step's slice of the official Builder program is corroborated,
 * assigned to the callouts printed beside it, and refused.
 *
 * Split out of the assembler because these are the decisions a reviewer will
 * argue with: what counts as confirmation that the cursor is still on the
 * printed sequence, which retained callout unit gets which physical Brick, and
 * exactly why a piece the booklet clearly places is nonetheless left out.
 * Every refusal returns prose naming the callout or identity that caused it and
 * what would satisfy it, because the emitted ledger carries these strings as
 * its provenance and they are the only account a later reader gets.
 */

export interface CoverageRow {
  readonly calloutKey: string;
  readonly claim: CalloutResolution;
}

const DIGEST_PATTERN = /^sha256:[0-9a-f]{64}$/u;

/**
 * Corroboration only: LEGO design IDs and BrickLink part numbers name the same
 * mould with a different suffix convention (`3069` / `3069b`). A cut may be
 * confirmed across that convention, but an emitted piece never is: its
 * `designId` is always the official one, and a coverage `partNum` that differs
 * from it is refused so the validator can name the disagreement.
 */
export function corroboratesDesign(officialDesignId: string, partNum: string): boolean {
  return (
    officialDesignId === partNum ||
    (/^\d+[a-z]$/u.test(partNum) && partNum.slice(0, -1) === officialDesignId)
  );
}

export function coverageRowsByStep(
  coverageByCallout: Readonly<Record<string, CalloutResolution>>,
): ReadonlyMap<number, readonly CoverageRow[]> {
  const byStep = new Map<number, CoverageRow[]>();
  for (const calloutKey of Object.keys(coverageByCallout).sort((left, right) =>
    left.localeCompare(right),
  )) {
    const claim = coverageByCallout[calloutKey]!;
    if (claim.stepNumber === null) continue;
    const rows = byStep.get(claim.stepNumber) ?? [];
    rows.push({ calloutKey, claim });
    byStep.set(claim.stepNumber, rows);
  }
  return byStep;
}

/**
 * Cut corroboration for one printed step.
 *
 * A trusted callout that names a design the cut does not contain means the
 * cursor has drifted off the printed sequence, and every later cut would be
 * fiction. Untrusted callouts are deliberately not consulted: a refused
 * identification is not counter-evidence about which Brick the booklet placed.
 */
export function uncorroboratedDesign(
  official: OfficialModelIndex,
  rows: readonly CoverageRow[],
  slice: readonly OfficialBuilderIdentity[],
): string | null {
  const available = slice.map(({ brickRef }) => official.bricks[brickRef]?.designId ?? null);
  for (const { calloutKey, claim } of rows) {
    if (claim.identificationConfidence !== "vision-kept" || claim.resolution === null) continue;
    for (let unit = 0; unit < claim.quantity; unit += 1) {
      const index = available.findIndex(
        (designId) => designId !== null && corroboratesDesign(designId, claim.resolution!.partNum),
      );
      if (index === -1) {
        return (
          `trusted callout ${calloutKey} identifies part ${claim.resolution.partNum} ` +
          `${claim.quantity} time(s), but the official Builder cut for this printed step contains ` +
          `[${slice.map(({ brickRef }) => official.bricks[brickRef]?.designId ?? "unknown").join(", ") || "nothing"}]. ` +
          `The printed-step cursor is no longer corroborated, so this step and every later one are left ` +
          `out. Republish coverage so its retained per-step quantities account for every physical piece, ` +
          `or record the printed-step boundary the Builder program actually uses.`
        );
      }
      available.splice(index, 1);
    }
  }
  return null;
}

/** Assigns each retained callout unit to one official identity from the same cut. */
export function assignSlots(
  official: OfficialModelIndex,
  rows: readonly CoverageRow[],
  slice: readonly OfficialBuilderIdentity[],
): readonly { readonly row: CoverageRow; readonly identity: OfficialBuilderIdentity }[] {
  const pool = [...slice];
  const slots = rows.flatMap((row) => Array.from({ length: row.claim.quantity }, () => row));
  const assigned: { row: CoverageRow; identity: OfficialBuilderIdentity }[] = [];
  const deferred: CoverageRow[] = [];
  for (const row of slots) {
    const partNum = row.claim.resolution?.partNum ?? null;
    const index =
      partNum === null
        ? -1
        : pool.findIndex(({ brickRef }) => {
            const designId = official.bricks[brickRef]?.designId;
            return designId !== undefined && corroboratesDesign(designId, partNum);
          });
    if (index === -1) deferred.push(row);
    else assigned.push({ row, identity: pool.splice(index, 1)[0]! });
  }
  for (const row of deferred) {
    const identity = pool.shift();
    if (identity !== undefined) assigned.push({ row, identity });
  }
  return assigned;
}

export function pieceRefusal(input: {
  readonly stepNumber: number;
  readonly calloutKey: string;
  readonly identity: OfficialBuilderIdentity;
  readonly claim: CalloutResolution;
  readonly official: OfficialModelIndex;
  readonly calloutManifestDigest: string;
}): string | null {
  const brick = input.official.bricks[input.identity.brickRef];
  if (brick === undefined) {
    return (
      `official Builder identity ${input.identity.brickRef} has no physical Brick record in the model ` +
      `inventory. Republish the official model export; an instruction reference without an inventory row ` +
      `cannot define a placement.`
    );
  }
  if (input.identity.kind !== "direct") {
    return (
      `official identity ${input.identity.brickRef} is a MultiBuild copy of ${input.identity.sourceBrickRef}, ` +
      `but printed step ${input.stepNumber} binds it to piece callout ${input.calloutKey}. A copy step needs a ` +
      `multi-build-copy action with an explicit semantic multiplier, which retained coverage does not yet ` +
      `carry for this step.`
    );
  }
  if (input.claim.identificationConfidence !== "vision-kept") {
    return (
      `callout ${input.calloutKey} carries identification confidence ` +
      `${JSON.stringify(input.claim.identificationConfidence ?? "missing")}, and only vision-kept callouts may ` +
      `become a ledger piece. Re-run part identification for this crop until it is kept; writing it out as ` +
      `vision-kept would make the ledger certify its own input.`
    );
  }
  if (input.claim.resolution === null || input.claim.resolution.catalogPartId === null) {
    return (
      `callout ${input.calloutKey} has no resolved catalog part, so the piece it places cannot be named. ` +
      `Resolve its element to a catalog part before binding it.`
    );
  }
  if (input.claim.resolution.partNum !== brick.designId) {
    return (
      `callout ${input.calloutKey} identifies part ${input.claim.resolution.partNum}, but the official Builder ` +
      `identity cut to this callout is ${input.identity.brickRef} of design ${brick.designId} ` +
      `(${brick.designRevision}). One of the two is wrong about this piece; the ledger records neither until ` +
      `they agree.`
    );
  }
  if (!DIGEST_PATTERN.test(input.claim.cropDigest ?? "")) {
    return (
      `callout ${input.calloutKey} has crop digest ${JSON.stringify(input.claim.cropDigest ?? "missing")}, ` +
      `which is not a sha256:<64 hex> digest of a retained crop.`
    );
  }
  if (input.claim.inputDigest !== input.calloutManifestDigest) {
    return (
      `callout ${input.calloutKey} was identified from input ${JSON.stringify(input.claim.inputDigest ?? "missing")}, ` +
      `but this run reads callout manifest ${input.calloutManifestDigest}. Re-run identification against the ` +
      `exact manifest being built.`
    );
  }
  return null;
}
