import { createHash } from "node:crypto";

import type { TrustedIdentificationConfidence } from "./real-build-identification-trust";
import type { LedgerTransform, OfficialBrickRecord } from "./real-build-official";

export { stepPanelEvidenceDigest } from "./real-build-panel-evidence-digest";

export {
  applyBuilderCanonicalCalibration,
  BUILDER_CANONICAL_CALIBRATION_SCHEMA,
  createBuilderFrameEvidence,
  parseOfficialModelIndex,
  validateOfficialModelAccounting,
} from "./real-build-official";
export type {
  BuilderCanonicalCalibration,
  LedgerTransform,
  OfficialBrickRecord,
  OfficialModelIndex,
} from "./real-build-official";

export const REAL_BUILD_ACTION_LEDGER_SCHEMA = "lego.real-build-action-ledger/2" as const;

export interface LedgerPieceIdentity {
  readonly brickRef: string;
  readonly designId: string;
  readonly materialId: string;
  readonly catalogPartId: string;
  readonly colorId: string;
  readonly calloutKey: string | null;
  readonly identificationConfidence: TrustedIdentificationConfidence | "official-model";
  readonly cropDigest: string | null;
  readonly identificationInputDigest: string;
  readonly evidenceDigest: string;
  readonly transform: LedgerTransform | null;
}

export interface LedgerCopyIdentity extends LedgerPieceIdentity {
  readonly sourceBrickRef: string;
}

export type LedgerStepAction =
  | {
      readonly kind: "place-callouts";
      readonly pieces: readonly LedgerPieceIdentity[];
      readonly omittedPieces: readonly LedgerPieceIdentity[];
    }
  | {
      readonly kind: "multi-build-copy";
      readonly sourceStepNumber: number;
      readonly copies: readonly LedgerCopyIdentity[];
    }
  | {
      readonly kind: "transition";
      readonly transition: "rotation" | "attachment" | "final-view";
      readonly classificationEvidenceDigest: string;
    };

export interface LedgerStep {
  readonly stepNumber: number;
  readonly pageNumber: number;
  readonly panelEvidenceDigest: string;
  readonly callouts: readonly {
    readonly calloutKey: string;
    readonly physicalBrickRefs: readonly string[];
    readonly semanticMultiplierQuantity: number;
  }[];
  readonly action: LedgerStepAction;
}

export interface RealBuildActionLedger {
  readonly schemaVersion: typeof REAL_BUILD_ACTION_LEDGER_SCHEMA;
  readonly pdfDigest: string;
  readonly officialModelDigest: string;
  readonly coverageDigest: string;
  readonly calloutManifestDigest: string;
  readonly builderCalibrationDigest: string;
  readonly transitionClassificationsDigest: string;
  readonly steps: readonly LedgerStep[];
}

export interface TransitionClassificationEvidence {
  readonly stepNumber: number;
  readonly pageNumber: number;
  readonly panelEvidenceDigest: string;
  readonly transition: "rotation" | "attachment" | "final-view";
  readonly evidenceDigest: string;
  /** An unauthenticated local claim retained for diagnosis; it is not reviewer authority. */
  readonly localClassification: {
    readonly schemaVersion: "lego.transition-unauthenticated-classification/1";
    readonly authenticated: false;
    readonly classifierKind: "human-claim" | "model-claim";
    readonly classifierClaimId: string;
    readonly reviewedPanelDigest: string;
    readonly decision: "rotation" | "attachment" | "final-view";
    readonly reasonCodes: readonly (
      "rotation-cue" | "attachment-cue" | "final-model-cue" | "no-new-piece-callout"
    )[];
    readonly notes: string;
  };
}

const TRANSITION_DECISIONS = ["rotation", "attachment", "final-view"] as const;
const TRANSITION_CLASSIFIER_KINDS = ["human-claim", "model-claim"] as const;
const TRANSITION_REASON_CODES = [
  "rotation-cue",
  "attachment-cue",
  "final-model-cue",
  "no-new-piece-callout",
] as const;

/** Runtime guard for hostile local classification JSON; hashes do not authenticate a classifier. */
export function isUnauthenticatedTransitionClassification(
  value: unknown,
): value is TransitionClassificationEvidence["localClassification"] {
  if (typeof value !== "object" || value === null) return false;
  const classification = value as Partial<TransitionClassificationEvidence["localClassification"]>;
  const decisionCue =
    classification.decision === "rotation"
      ? "rotation-cue"
      : classification.decision === "attachment"
        ? "attachment-cue"
        : classification.decision === "final-view"
          ? "final-model-cue"
          : null;
  return (
    classification.schemaVersion === "lego.transition-unauthenticated-classification/1" &&
    classification.authenticated === false &&
    TRANSITION_CLASSIFIER_KINDS.some((kind) => kind === classification.classifierKind) &&
    typeof classification.classifierClaimId === "string" &&
    /^sha256:[0-9a-f]{64}$/u.test(classification.classifierClaimId) &&
    typeof classification.reviewedPanelDigest === "string" &&
    /^sha256:[0-9a-f]{64}$/u.test(classification.reviewedPanelDigest) &&
    TRANSITION_DECISIONS.some((decision) => decision === classification.decision) &&
    Array.isArray(classification.reasonCodes) &&
    classification.reasonCodes.length > 0 &&
    new Set(classification.reasonCodes).size === classification.reasonCodes.length &&
    classification.reasonCodes.every((reason) =>
      TRANSITION_REASON_CODES.some((allowed) => allowed === reason),
    ) &&
    classification.reasonCodes.length === 2 &&
    decisionCue !== null &&
    classification.reasonCodes.includes(decisionCue) &&
    classification.reasonCodes.includes("no-new-piece-callout") &&
    typeof classification.notes === "string" &&
    classification.notes.trim().length >= 12 &&
    classification.notes.length <= 2_000
  );
}

export interface CoverageLedgerClaim {
  readonly pageNumber: number;
  readonly stepNumber: number | null;
  readonly quantity: number;
  readonly elementId?: string | null;
  readonly identificationConfidence?: string | null;
  readonly cropDigest?: string | null;
  readonly inputDigest?: string | null;
  readonly resolution?: {
    readonly catalogPartId: string | null;
    readonly colorId: string;
    readonly partNum: string;
  } | null;
}

/** Exact element corroboration for one direct callout-to-Brick binding. */
export function officialItemNoMatchesCoverageClaim(
  official: OfficialBrickRecord | undefined,
  claim: CoverageLedgerClaim | undefined,
): boolean {
  return (
    official?.itemNos.length === 1 &&
    typeof claim?.elementId === "string" &&
    official.itemNos[0] === claim.elementId
  );
}

const digest = (value: string | Uint8Array): string =>
  `sha256:${createHash("sha256").update(value).digest("hex")}`;

export function actionEvidenceDigest(input: {
  readonly ledgerDigest: string;
  readonly officialModelDigest: string;
  readonly builderCalibrationDigest: string;
  readonly transitionClassificationsDigest: string;
  readonly step: LedgerStep;
}): string {
  return digest(JSON.stringify(input));
}

export function transitionClassificationEvidenceDigest(
  input: Omit<TransitionClassificationEvidence, "evidenceDigest">,
): string {
  return digest(JSON.stringify(input));
}

export function pieceEvidenceDigest(input: {
  readonly pdfDigest: string;
  readonly panelEvidenceDigest: string;
  readonly officialModelDigest: string;
  readonly coverageDigest: string;
  readonly calloutManifestDigest: string;
  readonly builderCalibrationDigest: string;
  readonly stepNumber: number;
  readonly pageNumber: number;
  readonly piece:
    Omit<LedgerPieceIdentity, "evidenceDigest"> | Omit<LedgerCopyIdentity, "evidenceDigest">;
}): string {
  return digest(JSON.stringify(input));
}
