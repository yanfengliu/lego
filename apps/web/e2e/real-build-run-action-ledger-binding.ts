import { canonicalStringify } from "@lego-studio/brick-kernel";

import { isTrustedIdentificationConfidence } from "./real-build-identification-trust";
import {
  actionEvidenceDigest,
  type LedgerPieceIdentity,
  type LedgerStep,
  type OfficialModelIndex,
  type RealBuildActionLedger,
} from "./real-build-ledger";
import type { RealBuildOptions, RealBuildPanelSpec } from "./real-build-safety";

function officialTransform(
  official: OfficialModelIndex,
  piece: LedgerPieceIdentity,
  label: string,
) {
  const transform = official.bricks[piece.brickRef]?.canonicalTransform ?? null;
  if (transform === null) {
    throw new TypeError(
      `${label} has no independently calibrated official-model transform, so it cannot reproduce prepared execution semantics.`,
    );
  }
  return transform;
}

function directPieces(
  step: LedgerStep,
  official: OfficialModelIndex,
): RealBuildPanelSpec["pieces"] {
  if (step.action.kind !== "place-callouts") return [];
  return step.action.pieces.flatMap((piece, index) => {
    if (
      piece.calloutKey === null ||
      !isTrustedIdentificationConfidence(piece.identificationConfidence)
    ) {
      return [];
    }
    if (piece.transform !== null) {
      throw new TypeError(
        `Action-ledger step ${step.stepNumber} direct piece ${index} carries a placement transform; visual search must decide it independently.`,
      );
    }
    return [
      {
        identityKey: piece.brickRef,
        designId: piece.designId,
        materialId: piece.materialId,
        catalogPartId: piece.catalogPartId,
        colorId: piece.colorId,
        calloutKey: piece.calloutKey,
        identificationConfidence: piece.identificationConfidence,
        cropDigest: piece.cropDigest,
        identificationInputDigest: piece.identificationInputDigest,
        expectedTransform: officialTransform(
          official,
          piece,
          `Action-ledger step ${step.stepNumber} piece ${index}`,
        ),
      },
    ];
  });
}

function omittedPieces(
  step: LedgerStep,
  official: OfficialModelIndex,
): RealBuildPanelSpec["omittedPieces"] {
  if (step.action.kind !== "place-callouts") return [];
  return step.action.omittedPieces.map((piece, index) => {
    const transform = officialTransform(
      official,
      piece,
      `Action-ledger step ${step.stepNumber} omitted piece ${index}`,
    );
    if (piece.transform === null || !exactSame(piece.transform, transform)) {
      throw new TypeError(
        `Action-ledger step ${step.stepNumber} omitted piece ${index} does not match its independently calibrated official-model transform.`,
      );
    }
    return {
      identityKey: piece.brickRef,
      designId: piece.designId,
      materialId: piece.materialId,
      catalogPartId: piece.catalogPartId,
      colorId: piece.colorId,
      evidenceDigest: piece.evidenceDigest,
      transform,
    };
  });
}

function expectedAction(input: {
  readonly step: LedgerStep;
  readonly ledgerDigest: string;
  readonly options: RealBuildOptions;
  readonly official: OfficialModelIndex;
}): RealBuildPanelSpec["action"] {
  const { step, options, official } = input;
  const evidenceDigest = actionEvidenceDigest({
    ledgerDigest: input.ledgerDigest,
    officialModelDigest: options.inputDigests.officialModel,
    builderCalibrationDigest: options.inputDigests.builderCalibration,
    transitionClassificationsDigest: options.inputDigests.transitionClassifications,
    step,
  });
  if (step.action.kind === "place-callouts") {
    return {
      kind: "place-callouts",
      assembledPieces: directPieces(step, official).length + omittedPieces(step, official).length,
      evidenceDigest,
    };
  }
  if (step.action.kind === "multi-build-copy") {
    const copies = step.action.copies.map((piece, index) => {
      const transform = officialTransform(
        official,
        piece,
        `Action-ledger step ${step.stepNumber} copy ${index}`,
      );
      if (piece.transform === null || !exactSame(piece.transform, transform)) {
        throw new TypeError(
          `Action-ledger step ${step.stepNumber} copy ${index} does not match its independently calibrated official-model transform.`,
        );
      }
      return {
        identityKey: piece.brickRef,
        sourceIdentityKey: piece.sourceBrickRef,
        designId: piece.designId,
        materialId: piece.materialId,
        catalogPartId: piece.catalogPartId,
        colorId: piece.colorId,
        evidenceDigest: piece.evidenceDigest,
        transform,
      };
    });
    return {
      kind: "multi-build-copy",
      assembledPieces: copies.length,
      sourceStepNumber: step.action.sourceStepNumber,
      evidenceDigest,
      copies,
    };
  }
  return {
    kind: "transition",
    assembledPieces: 0,
    transition: step.action.transition,
    panelEvidenceDigest: step.panelEvidenceDigest,
    classificationEvidenceDigest: step.action.classificationEvidenceDigest,
    evidenceDigest,
  };
}

function exactSame(left: unknown, right: unknown): boolean {
  return canonicalStringify(left) === canonicalStringify(right);
}

/** Cross-binds the retained current /3 ledger to the action semantics the browser executes. */
export function assertRealBuildActionLedgerMatchesPreparedOptions(input: {
  readonly ledger: RealBuildActionLedger;
  readonly ledgerDigest: string;
  readonly options: RealBuildOptions;
  readonly official: OfficialModelIndex;
}): void {
  const { ledger, options, official } = input;
  const expectedBindings = {
    pdfDigest: options.inputDigests.pdf,
    officialModelDigest: options.inputDigests.officialModel,
    coverageDigest: options.inputDigests.coverage,
    calloutManifestDigest: options.inputDigests.calloutManifest,
    builderCalibrationDigest: options.inputDigests.builderCalibration,
    transitionClassificationsDigest: options.inputDigests.transitionClassifications,
  };
  const retainedBindings = {
    pdfDigest: ledger.pdfDigest,
    officialModelDigest: ledger.officialModelDigest,
    coverageDigest: ledger.coverageDigest,
    calloutManifestDigest: ledger.calloutManifestDigest,
    builderCalibrationDigest: ledger.builderCalibrationDigest,
    transitionClassificationsDigest: ledger.transitionClassificationsDigest,
  };
  if (
    input.ledgerDigest !== options.inputDigests.actionLedger ||
    !exactSame(retainedBindings, expectedBindings)
  ) {
    throw new TypeError(
      "Current action-ledger bindings do not match the exact prepared-options raw input digests.",
    );
  }
  if (
    official.digest !== options.inputDigests.officialModel ||
    official.calibrationDigest !== options.inputDigests.builderCalibration ||
    official.builderGeometryDigest !== options.inputDigests.builderGeometry
  ) {
    throw new TypeError(
      "Prepared action projection is not bound to the exact calibrated official-model, calibration, and geometry roles.",
    );
  }
  if (ledger.steps.length !== options.panels.length) {
    throw new TypeError(
      `Current action-ledger has ${ledger.steps.length} executable rows but prepared-options has ${options.panels.length}; both must retain the same exact prefix.`,
    );
  }
  for (let index = 0; index < ledger.steps.length; index += 1) {
    const step = ledger.steps[index]!;
    const panel = options.panels[index]!;
    const pieces = directPieces(step, official);
    const omitted = omittedPieces(step, official);
    const calloutPieces = step.callouts.reduce(
      (total, callout) =>
        total + callout.physicalBrickRefs.length + callout.semanticMultiplierQuantity,
      0,
    );
    const classifiedPhysicalCalloutPieces = step.callouts.reduce(
      (total, callout) => total + callout.physicalBrickRefs.length,
      0,
    );
    const semanticMultiplierQuantity = step.callouts.reduce(
      (total, callout) => total + callout.semanticMultiplierQuantity,
      0,
    );
    const expected = {
      stepNumber: step.stepNumber,
      pageNumber: step.pageNumber,
      mappedCalloutKeys: step.callouts.map(({ calloutKey }) => calloutKey),
      action: expectedAction({
        step,
        ledgerDigest: input.ledgerDigest,
        options,
        official,
      }),
      pieces,
      omittedPieces: omitted,
      calloutPieces,
      classifiedPhysicalCalloutPieces,
      semanticMultiplierQuantity,
      omittedPhysicalPieces: omitted.length,
    };
    const prepared = {
      stepNumber: panel.stepNumber,
      pageNumber: panel.pageNumber,
      mappedCalloutKeys: panel.mappedCalloutKeys,
      action: panel.action,
      pieces: panel.pieces,
      omittedPieces: panel.omittedPieces,
      calloutPieces: panel.calloutPieces,
      classifiedPhysicalCalloutPieces: panel.classifiedPhysicalCalloutPieces,
      semanticMultiplierQuantity: panel.semanticMultiplierQuantity,
      omittedPhysicalPieces: panel.omittedPhysicalPieces,
    };
    if (!exactSame(prepared, expected)) {
      throw new TypeError(
        `Current action-ledger step ${step.stepNumber} does not exactly reproduce the prepared-options action, identities, and callout accounting.`,
      );
    }
  }
}
