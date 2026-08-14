import type { StepFailure } from "./real-build-safety";
import {
  TRUSTED_IDENTIFICATION_CONFIDENCES_SENTENCE,
  isTrustedIdentificationConfidence,
} from "./real-build-identification-trust";
import { officialTransformFailure } from "./real-build-official";
import {
  coverageStepNumbers,
  ledgerStepActionAuthorityFailure,
} from "./real-build-ledger-action-authority";
import { boundedLedgerFailures, preflightActionLedgerRows } from "./real-build-ledger-bounds";
import {
  REAL_BUILD_ACTION_LEDGER_SCHEMA,
  isUnauthenticatedTransitionClassification,
  officialItemNoMatchesCoverageClaim,
  pieceEvidenceDigest,
  transitionClassificationEvidenceDigest,
  type CoverageLedgerClaim,
  type LedgerCopyIdentity,
  type LedgerPieceIdentity,
  type LedgerTransform,
  type OfficialModelIndex,
  type RealBuildActionLedger,
  type TransitionClassificationEvidence,
} from "./real-build-ledger-contract";

export * from "./real-build-ledger-contract";

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
  readonly coverageByCallout: Readonly<Record<string, CoverageLedgerClaim>> | null;
  readonly panelEvidenceByStep: Readonly<
    Record<number, { readonly pageNumber: number; readonly digest: string }>
  >;
  readonly transitionClassificationsByStep: Readonly<
    Record<number, TransitionClassificationEvidence>
  >;
}): readonly StepFailure[] {
  const failures = boundedLedgerFailures();
  try {
    const boundedRows = preflightActionLedgerRows(input.ledger.steps);
    if (boundedRows.failure !== null) return [boundedRows.failure];
    const ledgerSteps = boundedRows.steps;
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
      failures.add(
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
      failures.add(
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
    const coveredSteps = coverageStepNumbers(input.coverageByCallout);
    for (const step of ordered) {
      const authorityFailure = ledgerStepActionAuthorityFailure(step, coveredSteps);
      if (authorityFailure !== null) {
        failures.add(failure(step.stepNumber, authorityFailure));
        continue;
      }
      const expectedPanel = input.panelEvidenceByStep[step.stepNumber];
      if (
        expectedPanel === undefined ||
        expectedPanel.pageNumber !== step.pageNumber ||
        expectedPanel.digest !== step.panelEvidenceDigest
      ) {
        failures.add(
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
          failures.add(
            failure(
              step.stepNumber,
              `Ledger Brick ${piece.brickRef} says ${piece.designId}/${piece.materialId}, but that exact ` +
                `official-model identity is ${official?.designId ?? "missing"}/${official?.materialId ?? "missing"}.`,
            ),
          );
        }
        if (official !== undefined && official.canonicalTransform === null) {
          failures.add(officialTransformFailure(official, step.stepNumber));
        }
        if (
          official !== undefined &&
          (official.calibratedCatalogPartId !== piece.catalogPartId ||
            !/^sha256:[0-9a-f]{64}$/u.test(official.frameEvidenceDigest ?? ""))
        ) {
          failures.add(
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
          failures.add(
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
            failures.add(
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
            failures.add(
              failure(
                step.stepNumber,
                `MultiBuild copy ${piece.brickRef} must be an official-model identity with exact model input digest, ` +
                  `no crop/callout masquerade, and a fixed transform.`,
              ),
            );
          }
          if (!sameTransform(piece.transform, official?.canonicalTransform ?? null)) {
            failures.add(
              failure(
                step.stepNumber,
                `MultiBuild copy ${piece.brickRef} transform ${JSON.stringify(piece.transform)} does not ` +
                  `equal calibrated official Bone truth ${JSON.stringify(official?.canonicalTransform ?? null)}.`,
              ),
            );
          }
          if (seenCopies.has(piece.brickRef))
            failures.add(failure(step.stepNumber, `Copy ${piece.brickRef} is duplicated.`));
          seenCopies.add(piece.brickRef);
        } else {
          if (!input.official.directBrickRefs.has(piece.brickRef)) {
            failures.add(
              failure(
                step.stepNumber,
                `Direct Brick ${piece.brickRef} is not an official instruction In reference.`,
              ),
            );
          }
          if (seenDirect.has(piece.brickRef))
            failures.add(failure(step.stepNumber, `Direct Brick ${piece.brickRef} is duplicated.`));
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
            failures.add(
              failure(
                step.stepNumber,
                `Omitted Brick ${piece.brickRef} must be an exact fixed-transform official-model identity, not a ` +
                  `quantity-only or crop-derived placeholder.`,
              ),
            );
          }
          if (omitted && !sameTransform(piece.transform, official?.canonicalTransform ?? null)) {
            failures.add(
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
              !isTrustedIdentificationConfidence(piece.identificationConfidence) ||
              !/^sha256:[0-9a-f]{64}$/u.test(piece.cropDigest ?? "") ||
              !/^sha256:[0-9a-f]{64}$/u.test(piece.identificationInputDigest) ||
              piece.identificationInputDigest !== input.calloutManifestDigest ||
              piece.transform !== null)
          ) {
            failures.add(
              failure(
                step.stepNumber,
                `Direct Brick ${piece.brickRef} must bind one exact coverage callout whose identification ` +
                  `confidence is ${TRUSTED_IDENTIFICATION_CONFIDENCES_SENTENCE}, with retained crop/input ` +
                  `digests; it declares ${JSON.stringify(piece.identificationConfidence)}. Its placement ` +
                  `transform is decided by the independent visual search, not ignored ledger data.`,
              ),
            );
          }
          if (!omitted) requiredCalloutRefs.add(piece.brickRef);
        }
        if (established.has(piece.brickRef))
          failures.add(failure(step.stepNumber, `Brick identity ${piece.brickRef} is reused.`));
        established.set(piece.brickRef, { stepNumber: step.stepNumber, piece });
        if (piece.calloutKey !== null && input.coverageByCallout !== null) {
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
            claim.resolution?.partNum === piece.designId &&
            officialItemNoMatchesCoverageClaim(official, claim);
          if (!claimMatches) {
            failures.add(
              failure(
                step.stepNumber,
                `Brick ${piece.brickRef} does not exactly match coverage claim ${piece.calloutKey} for ` +
                  `step/page/part/color/sole official itemNo/confidence/crop/input evidence.`,
              ),
            );
          }
        }
      }
      const actionBrickRefs = new Set(identities.map(({ brickRef }) => brickRef));
      for (const binding of step.callouts) {
        const claim = input.coverageByCallout?.[binding.calloutKey];
        const physicalRefs = new Set(binding.physicalBrickRefs);
        if (
          input.coverageByCallout !== null &&
          (boundCallouts.has(binding.calloutKey) ||
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
                (step.action.kind === "place-callouts" &&
                  piece.calloutKey !== binding.calloutKey) ||
                (step.action.kind === "place-callouts" &&
                  !officialItemNoMatchesCoverageClaim(
                    input.official.bricks[piece.brickRef],
                    claim,
                  )) ||
                claim.resolution?.catalogPartId !== piece.catalogPartId ||
                claim.resolution?.colorId !== piece.colorId ||
                claim.resolution?.partNum !== piece.designId
              );
            }) ||
            claim.quantity !==
              binding.physicalBrickRefs.length + binding.semanticMultiplierQuantity ||
            (binding.semanticMultiplierQuantity > 0 && step.action.kind !== "multi-build-copy"))
        ) {
          failures.add(
            failure(
              step.stepNumber,
              `Callout binding ${binding.calloutKey} must exactly match one coverage claim, its page/step/raw ` +
                `quantity, each direct Brick's sole official itemNo, the listed physical identities, and any ` +
                `explicit MultiBuild multiplier.`,
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
          failures.add({
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
    for (const [key, claim] of Object.entries(input.coverageByCallout ?? {})) {
      if (claim.stepNumber === null || claim.stepNumber > input.lastStep) continue;
      const count = calloutCounts.get(key) ?? 0;
      const binding = ordered
        .flatMap(({ callouts }) => callouts)
        .find(({ calloutKey }) => calloutKey === key);
      const physicalQuantity = binding?.physicalBrickRefs.length ?? 0;
      if (count !== physicalQuantity || !boundCallouts.has(key)) {
        failures.add(
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
      failures.add(
        failure(
          undefined,
          `Action ledger covers ${seenDirect.size}/${input.official.directBrickRefs.size} direct and ` +
            `${seenCopies.size}/${input.official.multiBuildByActualRef.size} MultiBuild identities through requested ` +
            `step ${input.lastStep}; exact callout binding is required for the prefix, and full official identity ` +
            `conservation is additionally required at step 359.`,
        ),
      );
    }
    return failures.result();
  } catch (error) {
    failures.add(
      failure(
        undefined,
        `Action ledger is structurally malformed and cannot define build truth: ${
          error instanceof Error ? error.message : String(error)
        }.`,
      ),
    );
    return failures.result();
  }
}
