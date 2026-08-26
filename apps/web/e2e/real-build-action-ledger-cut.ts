import type { CalloutResolution } from "./real-build-input-files";
import type { OfficialModelIndex } from "./real-build-ledger";
import type { OfficialBuilderIdentity } from "./real-build-action-ledger";
import {
  TRUSTED_IDENTIFICATION_CONFIDENCES_SENTENCE,
  isTrustedIdentificationConfidence,
  trustedIdentificationInputDigest,
} from "./real-build-identification-trust";

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
const DIAGNOSTIC_IDENTITY_LIMIT = 12;
const DIAGNOSTIC_ITEM_NO_LIMIT = 4;
const DIAGNOSTIC_VALUE_LIMIT = 80;

function boundedDiagnosticValue(value: string): string {
  return value.length <= DIAGNOSTIC_VALUE_LIMIT
    ? value
    : `${value.slice(0, DIAGNOSTIC_VALUE_LIMIT)}...`;
}

function quotedDiagnosticValue(value: string): string {
  return JSON.stringify(boundedDiagnosticValue(value));
}

function officialCutContext(
  official: OfficialModelIndex,
  slice: readonly OfficialBuilderIdentity[],
): string {
  const identities = slice.slice(0, DIAGNOSTIC_IDENTITY_LIMIT).map(({ brickRef }) => {
    const brick = official.bricks[brickRef];
    if (brick === undefined) {
      return {
        brickRef: boundedDiagnosticValue(brickRef),
        record: "missing",
      };
    }
    return {
      brickRef: boundedDiagnosticValue(brickRef),
      designId: boundedDiagnosticValue(brick.designId),
      itemNoCount: brick.itemNos.length,
      itemNos: brick.itemNos.slice(0, DIAGNOSTIC_ITEM_NO_LIMIT).map(boundedDiagnosticValue),
    };
  });
  const omitted = slice.length - identities.length;
  return `${JSON.stringify(identities)}${omitted > 0 ? ` (${omitted} more identities omitted)` : ""}`;
}

function soleOfficialItemNo(
  official: OfficialModelIndex,
  identity: OfficialBuilderIdentity,
): string | null {
  const itemNos = official.bricks[identity.brickRef]?.itemNos;
  return itemNos?.length === 1 ? itemNos[0]! : null;
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
 * Corroboration for the slice the cumulative quantity cursor already selected.
 *
 * A trusted callout whose exact element is not present in the cut means the
 * cursor has drifted off the printed sequence, and every later cut would be
 * fiction. Design labels cannot corroborate this boundary: their source is the
 * catalog resolution under review. Untrusted callouts are deliberately not
 * consulted as counter-evidence, but every official identity in the cut must
 * still carry exactly one itemNo before any assignment can be attempted. This
 * check neither searches adjacent windows nor proves this itemNo multiset is a
 * unique boundary; printed quantities and the prior cumulative cursor own the
 * cut, and exact elements only corroborate that already-selected slice.
 */
export function uncorroboratedElementCut(
  official: OfficialModelIndex,
  rows: readonly CoverageRow[],
  slice: readonly OfficialBuilderIdentity[],
): string | null {
  const context = officialCutContext(official, slice);
  for (const identity of slice) {
    const brick = official.bricks[identity.brickRef];
    if (brick === undefined) {
      return (
        `official Builder identity ${quotedDiagnosticValue(identity.brickRef)} has no physical Brick record. ` +
        `Exact element corroboration requires one inventory record with exactly one itemNo for every identity ` +
        `in the cut. Bounded cut context: ${context}.`
      );
    }
    if (brick.itemNos.length !== 1) {
      return (
        `official Builder identity ${quotedDiagnosticValue(identity.brickRef)} of design ` +
        `${quotedDiagnosticValue(brick.designId)} has ${brick.itemNos.length} itemNos; exact element ` +
        `corroboration requires exactly one itemNo, not a missing or ambiguous element identity. ` +
        `Bounded cut context: ${context}.`
      );
    }
  }

  const calloutByElement = new Map<
    string,
    { readonly calloutKey: string; readonly trusted: boolean }
  >();
  for (const { calloutKey, claim } of rows) {
    if (claim.elementId === null) continue;
    const trusted = isTrustedIdentificationConfidence(claim.identificationConfidence);
    const existing = calloutByElement.get(claim.elementId);
    if (existing !== undefined && existing.calloutKey !== calloutKey) {
      const trustDescription =
        existing.trusted && trusted
          ? "trusted callouts"
          : existing.trusted || trusted
            ? "mixed-trust callouts"
            : "untrusted callouts";
      return (
        `${trustDescription} ${quotedDiagnosticValue(existing.calloutKey)} and ` +
        `${quotedDiagnosticValue(calloutKey)} both claim element ${quotedDiagnosticValue(claim.elementId)} ` +
        `within one printed step. Exact element corroboration cannot decide which callout owns which physical ` +
        `Brick UUID when distinct callouts share an element, and trust priority cannot manufacture that missing ` +
        `ownership evidence. Retain the full printed quantity on one callout, or correct the element identity ` +
        `before publishing; the assembler will not choose arbitrarily.`
      );
    }
    calloutByElement.set(claim.elementId, { calloutKey, trusted });
  }

  const available = slice.map((identity) => ({
    identity,
    itemNo: soleOfficialItemNo(official, identity)!,
  }));
  for (const { calloutKey, claim } of rows) {
    if (!isTrustedIdentificationConfidence(claim.identificationConfidence)) continue;
    if (claim.elementId === null) {
      return (
        `trusted callout ${quotedDiagnosticValue(calloutKey)} has no elementId. Exact official-cut ` +
        `corroboration requires claim.elementId to equal the sole itemNo on one physical Brick for each ` +
        `printed unit. Bounded cut context: ${context}.`
      );
    }
    for (let unit = 0; unit < claim.quantity; unit += 1) {
      const index = available.findIndex(({ itemNo }) => itemNo === claim.elementId);
      if (index === -1) {
        return (
          `trusted callout ${quotedDiagnosticValue(calloutKey)} claims element ` +
          `${quotedDiagnosticValue(claim.elementId)} ${claim.quantity} time(s), but only ${unit} of ` +
          `${claim.quantity} printed unit(s) matched one-to-one against a physical Brick whose sole official ` +
          `itemNo is that exact value. Bounded cut context: ${context}. ` +
          `The cumulative quantity-derived cursor is no longer corroborated, so this step and every later one ` +
          `are left out. Republish coverage with the exact official element identity and quantity, or correct ` +
          `the upstream quantity accounting; this check does not search or select an adjacent Builder window.`
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
  // Cross-callout element competition has already failed closed above; retained
  // order only expands one unambiguous callout quantity into physical slots.
  for (const row of slots) {
    const elementId = row.claim.elementId;
    const index =
      elementId === null
        ? -1
        : pool.findIndex((identity) => soleOfficialItemNo(official, identity) === elementId);
    if (index !== -1) assigned.push({ row, identity: pool.splice(index, 1)[0]! });
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
  readonly sourceArtReboundDigest: string;
}): string | null {
  const brick = input.official.bricks[input.identity.brickRef];
  if (brick === undefined) {
    return (
      `official Builder identity ${quotedDiagnosticValue(input.identity.brickRef)} has no physical Brick ` +
      `record in the model ` +
      `inventory. Republish the official model export; an instruction reference without an inventory row ` +
      `cannot define a placement.`
    );
  }
  if (input.identity.kind !== "direct") {
    return (
      `official identity ${quotedDiagnosticValue(input.identity.brickRef)} is a MultiBuild copy of ` +
      `${quotedDiagnosticValue(input.identity.sourceBrickRef ?? "missing")}, but printed step ` +
      `${input.stepNumber} binds it to piece callout ${quotedDiagnosticValue(input.calloutKey)}. A copy step ` +
      `needs a multi-build-copy action with an explicit semantic multiplier, which retained coverage does ` +
      `not yet carry for this step.`
    );
  }
  if (!isTrustedIdentificationConfidence(input.claim.identificationConfidence)) {
    return (
      `callout ${quotedDiagnosticValue(input.calloutKey)} carries identification confidence ` +
      `${quotedDiagnosticValue(input.claim.identificationConfidence ?? "missing")}, and only ` +
      `${TRUSTED_IDENTIFICATION_CONFIDENCES_SENTENCE} callouts may become a ledger piece. Re-run part ` +
      `identification for this crop until it is kept, or judge the pair blind against its claimed element; ` +
      `writing it out as a trusted confidence would make the ledger certify its own input.`
    );
  }
  if (input.claim.resolution === null || input.claim.resolution.catalogPartId === null) {
    return (
      `callout ${quotedDiagnosticValue(input.calloutKey)} has no resolved catalog part, so the piece it ` +
      `places cannot be named. Resolve its element to a catalog part before binding it.`
    );
  }
  if (input.claim.resolution.partNum !== brick.designId) {
    return (
      `callout ${quotedDiagnosticValue(input.calloutKey)} identifies part ` +
      `${quotedDiagnosticValue(input.claim.resolution.partNum)}, but the official Builder identity cut to ` +
      `this callout is ${quotedDiagnosticValue(input.identity.brickRef)} of design ` +
      `${quotedDiagnosticValue(brick.designId)} (${quotedDiagnosticValue(brick.designRevision)}). One of ` +
      `the two is wrong about this piece; the ledger records neither until they agree.`
    );
  }
  if (!DIGEST_PATTERN.test(input.claim.cropDigest ?? "")) {
    return (
      `callout ${quotedDiagnosticValue(input.calloutKey)} has crop digest ` +
      `${quotedDiagnosticValue(input.claim.cropDigest ?? "missing")}, which is not a sha256:<64 hex> digest ` +
      `of a retained crop.`
    );
  }
  const expectedIdentificationInputDigest = trustedIdentificationInputDigest(
    input.claim.identificationConfidence,
    input,
  );
  if (input.claim.inputDigest !== expectedIdentificationInputDigest) {
    return (
      `callout ${quotedDiagnosticValue(input.calloutKey)} was identified from input ` +
      `${quotedDiagnosticValue(input.claim.inputDigest ?? "missing")}, but confidence ` +
      `${quotedDiagnosticValue(input.claim.identificationConfidence)} requires exact retained input ` +
      `${quotedDiagnosticValue(expectedIdentificationInputDigest)}. Re-run identification or source-art rebound ` +
      `against the exact artifacts being built.`
    );
  }
  return null;
}
