import {
  assignSlots,
  coverageRowsByStep,
  pieceRefusal,
  uncorroboratedElementCut,
} from "./real-build-action-ledger-cut";
import type { CalloutResolution } from "./real-build-input-files";
import { requireTrustedIdentificationConfidence } from "./real-build-identification-trust";
import {
  pieceEvidenceDigest,
  REAL_BUILD_ACTION_LEDGER_SCHEMA,
  type LedgerPieceIdentity,
  type LedgerStep,
  type OfficialModelIndex,
  type RealBuildActionLedger,
  type TransitionClassificationEvidence,
} from "./real-build-ledger";

/**
 * The action-ledger input, and the one place its assembly is decided.
 *
 * The booklet says how many pieces a printed step places; the official Builder
 * program says which physical Bricks are placed and in what order. Neither
 * alone names "printed step 7 places Brick <uuid>". This module states that
 * correspondence as a *checked* walk rather than an assertion: the Builder
 * identity sequence is cut by each printed step's retained callout quantity,
 * and every cut is corroborated against the callouts whose identification is
 * trusted. The walk stops at the first printed step the evidence no longer
 * corroborates, and the emitted ledger is the contiguous prefix before it.
 *
 * Nothing here may upgrade its own evidence. A callout the identification
 * pipeline did not keep is refused with a named reason instead of being
 * written out as `vision-kept`, because a generated record that certifies its
 * own inputs is worth nothing to the validator that reads it.
 */

export const REAL_BUILD_ACTION_LEDGER_GENERATOR =
  "apps/web/e2e/real-build-action-ledger.spec.ts" as const;

export interface OfficialBuilderIdentity {
  readonly kind: "direct" | "multi-build-copy";
  readonly brickRef: string;
  readonly sourceBrickRef: string | null;
}

/** Every physical identity the sequenced Builder program introduces, in source order. */
export function flattenOfficialBuilderIdentities(
  official: OfficialModelIndex,
): readonly OfficialBuilderIdentity[] {
  return official.builderOrder.phases.flatMap<OfficialBuilderIdentity>((phase) =>
    phase.kind === "direct"
      ? phase.brickRefs.map((brickRef) => ({
          kind: "direct",
          brickRef,
          sourceBrickRef: null,
        }))
      : phase.copies.map(({ actualBrickRef, sourceBrickRef }) => ({
          kind: "multi-build-copy",
          brickRef: actualBrickRef,
          sourceBrickRef,
        })),
  );
}

export interface ActionLedgerRefusal {
  readonly stepNumber: number;
  readonly calloutKey: string | null;
  readonly brickRef: string | null;
  readonly reason: string;
}

export interface ActionLedgerRefusalOutputLimits {
  readonly maximumCount: number;
  readonly maximumCharacters: number;
}

export const ACTION_LEDGER_REFUSAL_OUTPUT_LIMITS: ActionLedgerRefusalOutputLimits = {
  maximumCount: 20,
  maximumCharacters: 8_192,
};

function refusalOmissionLine(
  omittedCount: number,
  limits: ActionLedgerRefusalOutputLimits,
): string {
  return (
    `  ... ${omittedCount} additional refusal${omittedCount === 1 ? "" : "s"} omitted ` +
    `(publisher limit: ${limits.maximumCount} entries / ${limits.maximumCharacters} characters).\n`
  );
}

/** Bounded publisher diagnostics; the complete refusal provenance stays in the ledger artifact. */
export function formatActionLedgerRefusalOutput(
  refusals: readonly ActionLedgerRefusal[],
  limits: ActionLedgerRefusalOutputLimits = ACTION_LEDGER_REFUSAL_OUTPUT_LIMITS,
): string {
  if (!Number.isSafeInteger(limits.maximumCount) || limits.maximumCount < 1) {
    throw new TypeError(
      `Action-ledger refusal output maximumCount must be a positive safe integer; received ${JSON.stringify(limits.maximumCount)}.`,
    );
  }
  if (!Number.isSafeInteger(limits.maximumCharacters) || limits.maximumCharacters < 256) {
    throw new TypeError(
      `Action-ledger refusal output maximumCharacters must be a safe integer of at least 256; received ${JSON.stringify(limits.maximumCharacters)}.`,
    );
  }
  const lines: string[] = [];
  let characterCount = 0;
  const candidateCount = Math.min(refusals.length, limits.maximumCount);
  const maximumOmissionLineLength = refusalOmissionLine(refusals.length, limits).length;
  for (let index = 0; index < candidateCount; index += 1) {
    const refusal = refusals[index]!;
    const line = `  refused step ${refusal.stepNumber}: ${refusal.reason}\n`;
    const willOmit = index + 1 < refusals.length;
    const reservedCharacters = willOmit ? maximumOmissionLineLength : 0;
    if (characterCount + line.length + reservedCharacters > limits.maximumCharacters) break;
    lines.push(line);
    characterCount += line.length;
  }
  const omittedCount = refusals.length - lines.length;
  if (omittedCount > 0) lines.push(refusalOmissionLine(omittedCount, limits));
  return lines.join("");
}

export interface AssembledRealBuildActionLedger {
  readonly ledger: RealBuildActionLedger;
  readonly refusals: readonly ActionLedgerRefusal[];
  readonly alignedThroughStep: number;
  readonly stopReason: string;
  readonly directPieceCount: number;
  readonly transitionStepCount: number;
}

export interface RealBuildActionLedgerBindings {
  readonly pdfDigest: string;
  readonly coverageDigest: string;
  readonly calloutManifestDigest: string;
  readonly builderCalibrationDigest: string;
  readonly transitionClassificationsDigest: string;
}

const DIGEST_PATTERN = /^sha256:[0-9a-f]{64}$/u;
const REFUSAL_DIAGNOSTIC_VALUE_LIMIT = 160;

function boundedRefusalValue(value: string): string {
  return JSON.stringify(
    value.length <= REFUSAL_DIAGNOSTIC_VALUE_LIMIT
      ? value
      : `${value.slice(0, REFUSAL_DIAGNOSTIC_VALUE_LIMIT)}...`,
  );
}

function directPiece(input: {
  readonly stepNumber: number;
  readonly pageNumber: number;
  readonly panelEvidenceDigest: string;
  readonly calloutKey: string;
  readonly brickRef: string;
  readonly official: OfficialModelIndex;
  readonly claim: CalloutResolution;
  readonly bindings: RealBuildActionLedgerBindings;
}): LedgerPieceIdentity {
  const brick = input.official.bricks[input.brickRef]!;
  const base: Omit<LedgerPieceIdentity, "evidenceDigest"> = {
    brickRef: input.brickRef,
    designId: brick.designId,
    materialId: brick.materialId,
    catalogPartId: brick.calibratedCatalogPartId ?? input.claim.resolution!.catalogPartId!,
    colorId: input.claim.resolution!.colorId,
    calloutKey: input.calloutKey,
    // The claim's own published confidence, never a literal: a pair-judged
    // identity written out as vision-kept would be the ledger relabelling the
    // evidence that produced it, and the validator's coverage-match check would
    // then be comparing the ledger against a claim it had already rewritten.
    identificationConfidence: requireTrustedIdentificationConfidence(
      input.claim.identificationConfidence,
      input.calloutKey,
    ),
    cropDigest: input.claim.cropDigest!,
    identificationInputDigest: input.bindings.calloutManifestDigest,
    transform: null,
  };
  return {
    ...base,
    evidenceDigest: pieceEvidenceDigest({
      pdfDigest: input.bindings.pdfDigest,
      panelEvidenceDigest: input.panelEvidenceDigest,
      officialModelDigest: input.official.digest,
      coverageDigest: input.bindings.coverageDigest,
      calloutManifestDigest: input.bindings.calloutManifestDigest,
      builderCalibrationDigest: input.bindings.builderCalibrationDigest,
      stepNumber: input.stepNumber,
      pageNumber: input.pageNumber,
      piece: base,
    }),
  };
}

export interface AssembleRealBuildActionLedgerInput {
  readonly official: OfficialModelIndex;
  readonly bindings: RealBuildActionLedgerBindings;
  readonly coverageByCallout: Readonly<Record<string, CalloutResolution>>;
  readonly panelEvidenceByStep: Readonly<
    Record<number, { readonly pageNumber: number; readonly digest: string }>
  >;
  readonly transitionClassificationsByStep: Readonly<
    Record<number, TransitionClassificationEvidence>
  >;
  readonly expectedPrintedSteps: number;
}

/**
 * Walks the printed steps and the official Builder program together.
 *
 * The result is deliberately a prefix: a ledger step the validator would reject
 * is worse than an absent one, and a step assembled after the cursor drifted
 * would name the wrong physical Brick with a perfectly reproducible digest.
 */
export function assembleRealBuildActionLedger(
  input: AssembleRealBuildActionLedgerInput,
): AssembledRealBuildActionLedger {
  for (const [field, value] of Object.entries(input.bindings)) {
    if (!DIGEST_PATTERN.test(value)) {
      throw new TypeError(
        `Action-ledger binding ${field} is ${JSON.stringify(value)}, which is not a sha256:<64 hex> digest. ` +
          `Bind the exact bytes this run ingested for that input.`,
      );
    }
  }
  const identities = flattenOfficialBuilderIdentities(input.official);
  const rowsByStep = coverageRowsByStep(input.coverageByCallout);
  const refusals: ActionLedgerRefusal[] = [];
  const steps: LedgerStep[] = [];
  let cursor = 0;
  let directPieceCount = 0;
  let transitionStepCount = 0;
  let stopReason =
    `the cumulative quantity cursor was corroborated through printed step ${input.expectedPrintedSteps}; ` +
    `this does not claim every retained callout was admitted as a ledger action.`;

  for (let stepNumber = 1; stepNumber <= input.expectedPrintedSteps; stepNumber += 1) {
    const panel = input.panelEvidenceByStep[stepNumber];
    if (panel === undefined) {
      stopReason =
        `printed step ${stepNumber} has no retained PDF panel evidence, so no ledger step can be bound ` +
        `to it. Derive panel evidence for every printed step from the exact booklet before republishing.`;
      break;
    }
    const rows = rowsByStep.get(stepNumber) ?? [];
    if (rows.length === 0) {
      const classification = input.transitionClassificationsByStep[stepNumber];
      if (
        classification === undefined ||
        classification.pageNumber !== panel.pageNumber ||
        classification.panelEvidenceDigest !== panel.digest
      ) {
        stopReason =
          `printed step ${stepNumber} places no retained callout piece and carries no transition ` +
          `classification for panel ${panel.digest}. Classify it as rotation, attachment, or final view in ` +
          `the transition-classification bundle; an omitted step is not a zero-piece action.`;
        break;
      }
      steps.push({
        stepNumber,
        pageNumber: panel.pageNumber,
        panelEvidenceDigest: panel.digest,
        callouts: [],
        action: {
          kind: "transition",
          transition: classification.transition,
          classificationEvidenceDigest: classification.evidenceDigest,
        },
      });
      transitionStepCount += 1;
      continue;
    }
    const pageMismatch = rows.find(({ claim }) => claim.pageNumber !== panel.pageNumber);
    if (pageMismatch !== undefined) {
      stopReason =
        `printed step ${stepNumber} is derived from booklet page ${panel.pageNumber}, but retained coverage ` +
        `puts callout ${pageMismatch.calloutKey} on page ${pageMismatch.claim.pageNumber}. Republish coverage ` +
        `from the exact panel derivation this run uses.`;
      break;
    }
    const required = rows.reduce((total, { claim }) => total + claim.quantity, 0);
    const slice = identities.slice(cursor, cursor + required);
    if (slice.length !== required) {
      stopReason =
        `printed step ${stepNumber} needs ${required} official identities, but only ${slice.length} remain in ` +
        `the sequenced Builder program after ${cursor} were consumed. Retained coverage claims more pieces ` +
        `than the official model places.`;
      break;
    }
    const drift = uncorroboratedElementCut(input.official, rows, slice);
    if (drift !== null) {
      stopReason = `printed step ${stepNumber} is not corroborated: ${drift}`;
      break;
    }
    const assigned = assignSlots(input.official, rows, slice);
    const piecesByCallout = new Map<string, LedgerPieceIdentity[]>();
    const assignmentCountByCallout = new Map<string, number>();
    const stepRefusals: ActionLedgerRefusal[] = [];
    for (const { row, identity } of assigned) {
      assignmentCountByCallout.set(
        row.calloutKey,
        (assignmentCountByCallout.get(row.calloutKey) ?? 0) + 1,
      );
      const refusal = pieceRefusal({
        stepNumber,
        calloutKey: row.calloutKey,
        identity,
        claim: row.claim,
        official: input.official,
        calloutManifestDigest: input.bindings.calloutManifestDigest,
      });
      if (refusal !== null) {
        stepRefusals.push({
          stepNumber,
          calloutKey: row.calloutKey,
          brickRef: identity.brickRef,
          reason: refusal,
        });
        continue;
      }
      const pieces = piecesByCallout.get(row.calloutKey) ?? [];
      pieces.push(
        directPiece({
          stepNumber,
          pageNumber: panel.pageNumber,
          panelEvidenceDigest: panel.digest,
          calloutKey: row.calloutKey,
          brickRef: identity.brickRef,
          official: input.official,
          claim: row.claim,
          bindings: input.bindings,
        }),
      );
      piecesByCallout.set(row.calloutKey, pieces);
    }
    // A callout binds all of its printed quantity or none of it: a binding that
    // lists fewer identities than the callout prints would claim the booklet
    // asked for fewer pieces than it did.
    const callouts: LedgerStep["callouts"][number][] = [];
    const pieces: LedgerPieceIdentity[] = [];
    for (const { calloutKey, claim } of rows) {
      const bound = piecesByCallout.get(calloutKey) ?? [];
      const assignmentCount = assignmentCountByCallout.get(calloutKey) ?? 0;
      if (bound.length !== claim.quantity) {
        if (assignmentCount < claim.quantity) {
          stepRefusals.push({
            stepNumber,
            calloutKey,
            brickRef: null,
            reason:
              `callout ${boundedRefusalValue(calloutKey)} prints ${claim.quantity} piece(s), but only ` +
              `${assignmentCount} could be assigned one-to-one by exact claim.elementId equality with a ` +
              `physical Brick's sole official itemNo; ${claim.quantity - assignmentCount} remain without an ` +
              `official identity. None are recorded because a partial callout would under-count the printed step.`,
          });
        } else if (bound.length > 0) {
          stepRefusals.push({
            stepNumber,
            calloutKey,
            brickRef: null,
            reason:
              `callout ${calloutKey} prints ${claim.quantity} piece(s) but only ${bound.length} could be ` +
              `bound to an official identity, so none of them are recorded. A partial callout would under-count ` +
              `the printed step.`,
          });
        }
        continue;
      }
      callouts.push({
        calloutKey,
        physicalBrickRefs: bound.map(({ brickRef }) => brickRef),
        semanticMultiplierQuantity: 0,
      });
      pieces.push(...bound);
    }
    refusals.push(...stepRefusals);
    directPieceCount += pieces.length;
    steps.push({
      stepNumber,
      pageNumber: panel.pageNumber,
      panelEvidenceDigest: panel.digest,
      callouts,
      action: { kind: "place-callouts", pieces, omittedPieces: [] },
    });
    cursor += required;
  }

  return {
    ledger: {
      schemaVersion: REAL_BUILD_ACTION_LEDGER_SCHEMA,
      pdfDigest: input.bindings.pdfDigest,
      officialModelDigest: input.official.digest,
      coverageDigest: input.bindings.coverageDigest,
      calloutManifestDigest: input.bindings.calloutManifestDigest,
      builderCalibrationDigest: input.bindings.builderCalibrationDigest,
      transitionClassificationsDigest: input.bindings.transitionClassificationsDigest,
      steps,
    },
    refusals,
    alignedThroughStep: steps.length,
    stopReason,
    directPieceCount,
    transitionStepCount,
  };
}

export interface EmittedRealBuildActionLedger extends RealBuildActionLedger {
  /** Repeated inside the file so a reader of the JSON alone cannot mistake it for authority. */
  readonly provenance: {
    readonly generator: typeof REAL_BUILD_ACTION_LEDGER_GENERATOR;
    readonly authenticated: false;
    readonly expectedPrintedSteps: number;
    readonly alignedThroughStep: number;
    readonly stopReason: string;
    readonly directPieceCount: number;
    readonly transitionStepCount: number;
    readonly refusals: readonly ActionLedgerRefusal[];
  };
}

export function emittedRealBuildActionLedger(
  assembled: AssembledRealBuildActionLedger,
  expectedPrintedSteps: number,
): EmittedRealBuildActionLedger {
  return {
    ...assembled.ledger,
    provenance: {
      generator: REAL_BUILD_ACTION_LEDGER_GENERATOR,
      authenticated: false,
      expectedPrintedSteps,
      alignedThroughStep: assembled.alignedThroughStep,
      stopReason: assembled.stopReason,
      directPieceCount: assembled.directPieceCount,
      transitionStepCount: assembled.transitionStepCount,
      refusals: assembled.refusals,
    },
  };
}

/** Canonical bytes: generator key order, no clock, so the file's digest is reproducible. */
export function encodeRealBuildActionLedger(ledger: EmittedRealBuildActionLedger): Buffer {
  return Buffer.from(`${JSON.stringify(ledger, null, 1)}\n`, "utf8");
}
