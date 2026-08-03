import { createHash } from "node:crypto";

import type { StepFailure } from "./real-build-safety";
import {
  officialTransformFailure,
  type LedgerTransform,
  type OfficialModelIndex,
} from "./real-build-official";

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
  readonly identificationConfidence: "vision-kept" | "official-model";
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
  readonly identificationConfidence?: string | null;
  readonly cropDigest?: string | null;
  readonly inputDigest?: string | null;
  readonly resolution?: {
    readonly catalogPartId: string | null;
    readonly colorId: string;
    readonly partNum: string;
  } | null;
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

export function stepPanelEvidenceDigest(input: {
  readonly pdfDigest: string;
  readonly stepNumber: number;
  readonly pageNumber: number;
  readonly bounds: {
    readonly minXPt: number;
    readonly maxXPt: number;
    readonly minYPt: number;
    readonly maxYPt: number;
  };
  readonly calloutBoxes: readonly {
    readonly minXPt: number;
    readonly maxXPt: number;
    readonly minYPt: number;
    readonly maxYPt: number;
  }[];
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

const failure = (stepNumber: number | undefined, message: string): StepFailure => ({
  code: "action-ledger-incomplete",
  stage: "input",
  ...(stepNumber === undefined ? {} : { stepNumber }),
  message,
});

const sameTransform = (left: LedgerTransform | null, right: LedgerTransform | null): boolean =>
  left !== null &&
  right !== null &&
  left.orientationId === right.orientationId &&
  left.positionLdu.every((coordinate, axis) => coordinate === right.positionLdu[axis]);

/** Rejects quantity conservation unless every assembled identity reconciles to official and coverage truth. */
export function validateRealBuildActionLedger(input: {
  readonly ledger: RealBuildActionLedger;
  readonly ledgerDigest: string;
  readonly lastStep: number;
  readonly official: OfficialModelIndex;
  readonly pdfDigest: string;
  readonly coverageDigest: string;
  readonly calloutManifestDigest: string;
  readonly builderCalibrationDigest: string;
  readonly transitionClassificationsDigest: string;
  readonly coverageByCallout: Readonly<Record<string, CoverageLedgerClaim>>;
  readonly panelEvidenceByStep: Readonly<
    Record<number, { readonly pageNumber: number; readonly digest: string }>
  >;
  readonly transitionClassificationsByStep: Readonly<
    Record<number, TransitionClassificationEvidence>
  >;
}): readonly StepFailure[] {
  const failures: StepFailure[] = [];
  try {
    if (!Array.isArray(input.ledger.steps)) {
      return [
        failure(
          undefined,
          "Action ledger has no steps array; no quantity or identity can be trusted.",
        ),
      ];
    }
    const ledgerSteps: readonly LedgerStep[] = input.ledger.steps;
    if (!Number.isInteger(input.lastStep) || input.lastStep < 1 || input.lastStep > 359) {
      return [
        failure(
          undefined,
          `Action ledger validation requires a requested last step from 1 through 359; received ${input.lastStep}.`,
        ),
      ];
    }
    if (
      !/^sha256:[0-9a-f]{64}$/u.test(input.ledgerDigest) ||
      input.ledger.schemaVersion !== REAL_BUILD_ACTION_LEDGER_SCHEMA ||
      input.ledger.pdfDigest !== input.pdfDigest ||
      input.ledger.officialModelDigest !== input.official.digest ||
      input.ledger.coverageDigest !== input.coverageDigest ||
      input.ledger.calloutManifestDigest !== input.calloutManifestDigest ||
      input.ledger.builderCalibrationDigest !== input.builderCalibrationDigest ||
      input.official.calibrationDigest !== input.builderCalibrationDigest ||
      input.ledger.transitionClassificationsDigest !== input.transitionClassificationsDigest ||
      !/^sha256:[0-9a-f]{64}$/u.test(input.ledger.transitionClassificationsDigest)
    ) {
      failures.push(
        failure(
          undefined,
          `Action ledger bindings do not match the exact official model, coverage, and callout manifest. ` +
            `Ledger ${input.ledger.pdfDigest}/${input.ledger.officialModelDigest}/` +
            `${input.ledger.coverageDigest}/` +
            `${input.ledger.calloutManifestDigest}/${input.ledger.builderCalibrationDigest}/` +
            `${input.ledger.transitionClassificationsDigest}; live ${input.official.digest}/` +
            `${input.coverageDigest}/${input.calloutManifestDigest}/${input.builderCalibrationDigest} ` +
            `with PDF ${input.pdfDigest}.`,
        ),
      );
    }
    const fullRun = input.lastStep === 359;
    const requestedLedgerSteps = fullRun
      ? ledgerSteps
      : ledgerSteps.filter(({ stepNumber }) => stepNumber <= input.lastStep);
    const ordered = [...requestedLedgerSteps].sort(
      (left, right) => left.stepNumber - right.stepNumber,
    );
    if (
      ordered.length !== input.lastStep ||
      ordered.some(({ stepNumber }, index) => stepNumber !== index + 1)
    ) {
      failures.push(
        failure(
          undefined,
          `Action ledger must contain each requested printed step 1..${input.lastStep} exactly once${
            fullRun ? "." : "; later tail steps are outside this prefix and are not validated."
          }`,
        ),
      );
    }
    const established = new Map<
      string,
      { readonly stepNumber: number; readonly piece: LedgerPieceIdentity }
    >();
    const seenDirect = new Set<string>();
    const seenCopies = new Set<string>();
    const calloutCounts = new Map<string, number>();
    const boundCallouts = new Set<string>();
    const boundPhysicalRefs = new Set<string>();
    const requiredCalloutRefs = new Set<string>();
    for (const step of ordered) {
      const expectedPanel = input.panelEvidenceByStep[step.stepNumber];
      if (
        expectedPanel === undefined ||
        expectedPanel.pageNumber !== step.pageNumber ||
        expectedPanel.digest !== step.panelEvidenceDigest
      ) {
        failures.push(
          failure(
            step.stepNumber,
            `Ledger step ${step.stepNumber} page ${step.pageNumber} is not bound to the exact PDF panel ` +
              `evidence expected for that printed step.`,
          ),
        );
      }
      const identities =
        step.action.kind === "place-callouts"
          ? [...step.action.pieces, ...step.action.omittedPieces]
          : step.action.kind === "multi-build-copy"
            ? step.action.copies
            : [];
      for (const piece of identities) {
        const official = input.official.bricks[piece.brickRef];
        const isCopy = step.action.kind === "multi-build-copy";
        const expectedSource = isCopy
          ? input.official.multiBuildByActualRef.get(piece.brickRef)
          : undefined;
        const metadataMatches =
          official !== undefined &&
          official.designId === piece.designId &&
          official.materialId === piece.materialId;
        if (!metadataMatches) {
          failures.push(
            failure(
              step.stepNumber,
              `Ledger Brick ${piece.brickRef} says ${piece.designId}/${piece.materialId}, but that exact ` +
                `official-model identity is ${official?.designId ?? "missing"}/${official?.materialId ?? "missing"}.`,
            ),
          );
        }
        if (official !== undefined && official.canonicalTransform === null) {
          failures.push(officialTransformFailure(official, step.stepNumber));
        }
        if (
          official !== undefined &&
          (official.calibratedCatalogPartId !== piece.catalogPartId ||
            !/^sha256:[0-9a-f]{64}$/u.test(official.frameEvidenceDigest ?? ""))
        ) {
          failures.push(
            failure(
              step.stepNumber,
              `Official design revision ${official.designRevision} is calibrated for catalog part ` +
                `${official.calibratedCatalogPartId ?? "none"}, not ledger part ${piece.catalogPartId}, ` +
                `or lacks retained independent frame evidence.`,
            ),
          );
        }
        const { evidenceDigest, ...pieceWithoutEvidence } = piece;
        const expectedEvidence = pieceEvidenceDigest({
          pdfDigest: input.pdfDigest,
          panelEvidenceDigest: step.panelEvidenceDigest,
          officialModelDigest: input.official.digest,
          coverageDigest: input.coverageDigest,
          calloutManifestDigest: input.calloutManifestDigest,
          builderCalibrationDigest: input.builderCalibrationDigest,
          stepNumber: step.stepNumber,
          pageNumber: step.pageNumber,
          piece: pieceWithoutEvidence,
        });
        if (evidenceDigest !== expectedEvidence) {
          failures.push(
            failure(
              step.stepNumber,
              `Brick ${piece.brickRef} evidence digest does not bind its exact official identity, coverage input, ` +
                `callout manifest, printed step/page, part/color/confidence/input evidence, and fixed transform.`,
            ),
          );
        }
        if (isCopy) {
          const copy = piece as LedgerCopyIdentity;
          const source = established.get(copy.sourceBrickRef);
          if (
            expectedSource !== copy.sourceBrickRef ||
            source === undefined ||
            source.stepNumber >= step.stepNumber ||
            step.action.kind !== "multi-build-copy" ||
            step.action.sourceStepNumber !== source.stepNumber ||
            source.piece.designId !== piece.designId ||
            source.piece.materialId !== piece.materialId ||
            (source.piece as LedgerPieceIdentity).catalogPartId !== piece.catalogPartId ||
            (source.piece as LedgerPieceIdentity).colorId !== piece.colorId ||
            !/^sha256:[0-9a-f]{64}$/u.test((source.piece as LedgerPieceIdentity).evidenceDigest)
          ) {
            failures.push(
              failure(
                step.stepNumber,
                `MultiBuild actual Brick ${piece.brickRef} cites ${copy.sourceBrickRef}; official XML cites ` +
                  `${expectedSource ?? "nothing"}, and action source step ${
                    step.action.kind === "multi-build-copy"
                      ? step.action.sourceStepNumber
                      : "missing"
                  } must equal the earlier exact design/material/catalog/color source and its retained evidence.`,
              ),
            );
          }
          if (
            piece.calloutKey !== null ||
            piece.identificationConfidence !== "official-model" ||
            piece.cropDigest !== null ||
            piece.identificationInputDigest !== input.official.digest ||
            piece.transform === null
          ) {
            failures.push(
              failure(
                step.stepNumber,
                `MultiBuild copy ${piece.brickRef} must be an official-model identity with exact model input digest, ` +
                  `no crop/callout masquerade, and a fixed transform.`,
              ),
            );
          }
          if (!sameTransform(piece.transform, official?.canonicalTransform ?? null)) {
            failures.push(
              failure(
                step.stepNumber,
                `MultiBuild copy ${piece.brickRef} transform ${JSON.stringify(piece.transform)} does not ` +
                  `equal calibrated official Bone truth ${JSON.stringify(official?.canonicalTransform ?? null)}.`,
              ),
            );
          }
          if (seenCopies.has(piece.brickRef))
            failures.push(failure(step.stepNumber, `Copy ${piece.brickRef} is duplicated.`));
          seenCopies.add(piece.brickRef);
        } else {
          if (!input.official.directBrickRefs.has(piece.brickRef)) {
            failures.push(
              failure(
                step.stepNumber,
                `Direct Brick ${piece.brickRef} is not an official instruction In reference.`,
              ),
            );
          }
          if (seenDirect.has(piece.brickRef))
            failures.push(
              failure(step.stepNumber, `Direct Brick ${piece.brickRef} is duplicated.`),
            );
          seenDirect.add(piece.brickRef);
          const omitted =
            step.action.kind === "place-callouts" &&
            step.action.omittedPieces.some(({ brickRef }) => brickRef === piece.brickRef);
          if (
            omitted &&
            (piece.calloutKey !== null ||
              piece.identificationConfidence !== "official-model" ||
              piece.cropDigest !== null ||
              piece.identificationInputDigest !== input.official.digest ||
              piece.transform === null)
          ) {
            failures.push(
              failure(
                step.stepNumber,
                `Omitted Brick ${piece.brickRef} must be an exact fixed-transform official-model identity, not a ` +
                  `quantity-only or crop-derived placeholder.`,
              ),
            );
          }
          if (omitted && !sameTransform(piece.transform, official?.canonicalTransform ?? null)) {
            failures.push(
              failure(
                step.stepNumber,
                `Omitted Brick ${piece.brickRef} transform ${JSON.stringify(piece.transform)} does not equal ` +
                  `calibrated official Bone truth ${JSON.stringify(official?.canonicalTransform ?? null)}.`,
              ),
            );
          }
          if (
            !omitted &&
            (piece.calloutKey === null ||
              piece.identificationConfidence !== "vision-kept" ||
              !/^sha256:[0-9a-f]{64}$/u.test(piece.cropDigest ?? "") ||
              !/^sha256:[0-9a-f]{64}$/u.test(piece.identificationInputDigest) ||
              piece.identificationInputDigest !== input.calloutManifestDigest ||
              piece.transform !== null)
          ) {
            failures.push(
              failure(
                step.stepNumber,
                `Direct Brick ${piece.brickRef} must bind one exact coverage callout with vision-kept ` +
                  `confidence and retained crop/input digests; its placement transform is decided by the ` +
                  `independent visual search, not ignored ledger data.`,
              ),
            );
          }
          if (!omitted) requiredCalloutRefs.add(piece.brickRef);
        }
        if (established.has(piece.brickRef))
          failures.push(failure(step.stepNumber, `Brick identity ${piece.brickRef} is reused.`));
        established.set(piece.brickRef, { stepNumber: step.stepNumber, piece });
        if (piece.calloutKey !== null) {
          const claim = input.coverageByCallout[piece.calloutKey];
          const claimMatches =
            claim !== undefined &&
            claim.stepNumber === step.stepNumber &&
            claim.pageNumber === step.pageNumber &&
            claim.identificationConfidence === piece.identificationConfidence &&
            claim.cropDigest === piece.cropDigest &&
            claim.inputDigest === piece.identificationInputDigest &&
            claim.resolution?.catalogPartId === piece.catalogPartId &&
            claim.resolution?.colorId === piece.colorId &&
            claim.resolution?.partNum === piece.designId;
          if (!claimMatches) {
            failures.push(
              failure(
                step.stepNumber,
                `Brick ${piece.brickRef} does not exactly match coverage claim ${piece.calloutKey} for ` +
                  `step/page/part/color/confidence/crop/input evidence.`,
              ),
            );
          }
        }
      }
      const actionBrickRefs = new Set(identities.map(({ brickRef }) => brickRef));
      for (const binding of step.callouts) {
        const claim = input.coverageByCallout[binding.calloutKey];
        const physicalRefs = new Set(binding.physicalBrickRefs);
        if (
          boundCallouts.has(binding.calloutKey) ||
          claim === undefined ||
          claim.stepNumber !== step.stepNumber ||
          claim.pageNumber !== step.pageNumber ||
          !Number.isInteger(binding.semanticMultiplierQuantity) ||
          binding.semanticMultiplierQuantity < 0 ||
          physicalRefs.size !== binding.physicalBrickRefs.length ||
          binding.physicalBrickRefs.some((brickRef) => boundPhysicalRefs.has(brickRef)) ||
          binding.physicalBrickRefs.some((brickRef) => !actionBrickRefs.has(brickRef)) ||
          binding.physicalBrickRefs.some((brickRef) => {
            const piece = identities.find((candidate) => candidate.brickRef === brickRef);
            return (
              piece === undefined ||
              (step.action.kind === "place-callouts" && piece.calloutKey !== binding.calloutKey) ||
              claim.resolution?.catalogPartId !== piece.catalogPartId ||
              claim.resolution?.colorId !== piece.colorId ||
              claim.resolution?.partNum !== piece.designId
            );
          }) ||
          claim.quantity !==
            binding.physicalBrickRefs.length + binding.semanticMultiplierQuantity ||
          (binding.semanticMultiplierQuantity > 0 && step.action.kind !== "multi-build-copy")
        ) {
          failures.push(
            failure(
              step.stepNumber,
              `Callout binding ${binding.calloutKey} must exactly match one coverage claim, its page/step/raw ` +
                `quantity, the listed physical Brick identities, and any explicit MultiBuild multiplier.`,
            ),
          );
        }
        for (const brickRef of binding.physicalBrickRefs) boundPhysicalRefs.add(brickRef);
        calloutCounts.set(
          binding.calloutKey,
          (calloutCounts.get(binding.calloutKey) ?? 0) + binding.physicalBrickRefs.length,
        );
        boundCallouts.add(binding.calloutKey);
      }
      if (step.action.kind === "transition") {
        const claim = input.transitionClassificationsByStep[step.stepNumber];
        const classificationValid = isUnauthenticatedTransitionClassification(
          claim?.localClassification,
        );
        if (
          claim === undefined ||
          claim.stepNumber !== step.stepNumber ||
          claim.pageNumber !== step.pageNumber ||
          claim.panelEvidenceDigest !== step.panelEvidenceDigest ||
          claim.transition !== step.action.transition ||
          claim.evidenceDigest !== step.action.classificationEvidenceDigest ||
          !/^sha256:[0-9a-f]{64}$/u.test(claim.evidenceDigest) ||
          transitionClassificationEvidenceDigest({
            stepNumber: claim.stepNumber,
            pageNumber: claim.pageNumber,
            panelEvidenceDigest: claim.panelEvidenceDigest,
            transition: claim.transition,
            localClassification: claim.localClassification,
          }) !== claim.evidenceDigest ||
          !classificationValid ||
          claim.localClassification?.decision !== claim.transition ||
          claim.localClassification?.reviewedPanelDigest !== claim.panelEvidenceDigest ||
          claim.evidenceDigest === step.panelEvidenceDigest
        ) {
          failures.push({
            code: "transition-classification-unverified",
            stage: "input",
            stepNumber: step.stepNumber,
            inputKey: `transition-${step.stepNumber}`,
            message:
              `Transition ${step.action.transition} at step ${step.stepNumber} is not reproduced by the ` +
              `explicitly unauthenticated local transition-classification claim for the exact refined panel. ` +
              `The claim is diagnostic only; a ledger assertion or panel hash cannot authenticate a reviewer ` +
              `or authorize rotation, attachment, or final-view semantics.`,
          });
        }
      }
    }
    for (const [key, claim] of Object.entries(input.coverageByCallout)) {
      if (claim.stepNumber === null || claim.stepNumber > input.lastStep) continue;
      const count = calloutCounts.get(key) ?? 0;
      const binding = ordered
        .flatMap(({ callouts }) => callouts)
        .find(({ calloutKey }) => calloutKey === key);
      const physicalQuantity = binding?.physicalBrickRefs.length ?? 0;
      if (count !== physicalQuantity || !boundCallouts.has(key)) {
        failures.push(
          failure(
            claim.stepNumber,
            `Coverage ${key} at step ${claim.stepNumber} binds ${count}/${physicalQuantity} exact physical ` +
              `identities and ${binding?.semanticMultiplierQuantity ?? 0} explicit semantic multiplier quantity; ` +
              `every assigned coverage key needs one exact ledger classification.`,
          ),
        );
      }
    }
    if (
      (fullRun && seenDirect.size !== input.official.directBrickRefs.size) ||
      (fullRun && seenCopies.size !== input.official.multiBuildByActualRef.size) ||
      [...requiredCalloutRefs].some((brickRef) => !boundPhysicalRefs.has(brickRef))
    ) {
      failures.push(
        failure(
          undefined,
          `Action ledger covers ${seenDirect.size}/${input.official.directBrickRefs.size} direct and ` +
            `${seenCopies.size}/${input.official.multiBuildByActualRef.size} MultiBuild identities through requested ` +
            `step ${input.lastStep}; exact callout binding is required for the prefix, and full official identity ` +
            `conservation is additionally required at step 359.`,
        ),
      );
    }
    return failures;
  } catch (error) {
    return [
      ...failures,
      failure(
        undefined,
        `Action ledger is structurally malformed and cannot define build truth: ${
          error instanceof Error ? error.message : String(error)
        }.`,
      ),
    ];
  }
}
