import { canonicalDigest, canonicalStringify, type Sha256Digest } from "@lego-studio/brick-kernel";

import type { RealBuildCandidateDocumentSnapshot } from "./real-build-candidate-document-snapshot";
import type { RealBuildStepReport } from "./real-build-safety";
import type {
  RealBuildBrowserOutputV4DetachedEnvelope,
  RealBuildBrowserOutputV4IdentityBinding,
} from "./real-build-browser-output-v4-envelope";
import type { RealBuildBrowserBranchDetailedStepInspection } from "./real-build-browser-output-v4-semantic";
import type {
  RealBuildBrowserCameraEvidenceInspection,
  RealBuildBrowserCameraEvidenceRow,
} from "./real-build-browser-output-v4-camera-evidence-types";
import type { RealBuildBrowserOutputV4PlacementAdvance } from "./real-build-browser-output-v4-reader-frontier";
import { realBuildBrowserOutputV4HasCleanPrerequisites } from "./real-build-browser-output-v4-reader-failure";

export {
  deriveRealBuildBrowserOutputV4MissingRoleFailure,
  deriveRealBuildBrowserOutputV4TerminalPlacementFailure,
  requireRealBuildBrowserOutputV4FailedReport,
  requireRealBuildBrowserOutputV4TransitionReport,
} from "./real-build-browser-output-v4-reader-failure";

type SelectedAdvance = Extract<RealBuildBrowserOutputV4PlacementAdvance, { status: "selected" }>;

const COMPILED_OBSERVATION_REFUSAL =
  "exact-browser-output-v4-roles-own-compiled-search-evidence" as const;

function selectedCameraRow(
  step: RealBuildBrowserBranchDetailedStepInspection,
  selected: SelectedAdvance,
  camera: RealBuildBrowserCameraEvidenceInspection,
): RealBuildBrowserCameraEvidenceRow {
  const selection = step.observation?.closure.selection;
  if (
    selection?.status !== "selected" ||
    selection.selectedCameraId === null ||
    selection.selectedCandidateId !== selected.selectedCandidateId
  ) {
    throw new TypeError(
      `Browser output /4 placement report ${step.stepNumber} has no exact selected camera projection.`,
    );
  }
  const rows = camera.manifest.rows.filter(
    (row) =>
      row.cameraId === selection.selectedCameraId &&
      row.child.candidateId === selection.selectedCandidateId,
  );
  if (rows.length !== 1) {
    throw new TypeError(
      `Browser output /4 placement report ${step.stepNumber} requires one exact selected external camera row; found ${rows.length}.`,
    );
  }
  return rows[0]!;
}

function requireSelectedCameraProjection(
  report: RealBuildStepReport,
  row: RealBuildBrowserCameraEvidenceRow,
): void {
  const fitted = row.fittedCamera;
  const expectedFit = {
    azimuthDegrees: fitted.azimuthDegrees,
    elevationDegrees: fitted.elevationDegrees,
    pixelsPerUnit: fitted.pixelsPerUnit,
    residualPx: fitted.residualPx,
    coherence: fitted.coherence,
    failure: null,
  };
  const expectedCamera = {
    ...fitted,
    anchorIou: row.preparedPanel.measure === "iou" ? row.registration.score : null,
    anchorShiftPx: row.registration.shiftPx,
    anchorTurnDegrees: row.lattice.turnDegrees,
  };
  const neutralHighlight = { regions: 0, closedContourRate: 0, strokePx: 0, boundsPx: null };
  const neutralArrows = {
    kept: 0,
    redPx: 0,
    rejected: 0,
    displacementFamily: 0,
    displacementFamilyLdu: [],
  };
  if (
    canonicalStringify(report.fit) !== canonicalStringify(expectedFit) ||
    canonicalStringify(report.camera) !== canonicalStringify(expectedCamera) ||
    canonicalStringify(report.highlight) !== canonicalStringify(neutralHighlight) ||
    canonicalStringify(report.arrows) !== canonicalStringify(neutralArrows) ||
    report.jointVisual !== null ||
    report.deferral !== null ||
    report.farther !== null ||
    report.fartherCaptures.length !== 0 ||
    report.explodedGhost !== null ||
    report.panelPng !== null ||
    report.buildPng !== null
  ) {
    throw new TypeError(
      `Browser output /4 placement report ${report.stepNumber} must project its exact selected external camera and leave superseded legacy evidence fields neutral.`,
    );
  }
}

function neutralCompiledPieceDiagnostics(
  piece: RealBuildStepReport["pieces"][number],
  parentDocumentHash: string,
): boolean {
  return (
    piece.enumerated === 0 &&
    piece.afterProximity === 0 &&
    piece.rendered === 0 &&
    piece.bestScore === null &&
    piece.runnerUpScore === null &&
    canonicalStringify(piece.blind) ===
      canonicalStringify({
        comparisonPrefixHash: parentDocumentHash,
        distinctCandidates: 0,
        feasible: false,
        rendered: 0,
        bestScore: null,
        runnerUpScore: null,
        agreesWithHighlight: null,
        refusal: COMPILED_OBSERVATION_REFUSAL,
        elapsedMs: 0,
      })
  );
}

function sameTransform(
  left: { readonly positionLdu: readonly number[]; readonly orientationId: string },
  right: { readonly positionLdu: readonly number[]; readonly orientationId: string },
): boolean {
  return (
    left.orientationId === right.orientationId &&
    left.positionLdu.length === 3 &&
    right.positionLdu.length === 3 &&
    left.positionLdu.every((value, index) => value === right.positionLdu[index])
  );
}

export function requireRealBuildBrowserOutputV4SelectedPlacementReport(
  report: RealBuildStepReport,
  step: RealBuildBrowserBranchDetailedStepInspection,
  selected: SelectedAdvance,
  camera: RealBuildBrowserCameraEvidenceInspection,
): void {
  const validation = selected.receipt.validation;
  if (
    report.outcome.mechanism === "official-ledger" ||
    report.outcome.mechanism === "instruction-transition"
  ) {
    throw new TypeError(
      `Browser output /4 placement report ${report.stepNumber} cannot claim ${report.outcome.mechanism}; compiled branch selection cannot borrow fixed-action or transition authority.`,
    );
  }
  if (
    report.outcome.status !== "complete" ||
    report.outcome.mechanism !== "compiled-observation" ||
    report.outcome.failure !== null ||
    report.stepNumber !== step.stepNumber ||
    report.expectedAssembledPieces !== selected.witnesses.length ||
    report.attemptedPieces !== selected.witnesses.length ||
    report.placedPieces !== selected.witnesses.length ||
    report.canonicalStepId !== selected.receipt.canonicalStepId ||
    report.documentParts !== selected.frontier.documentSnapshot.document.parts.length ||
    !report.validation.attempted ||
    report.validation.targetDocumentHash !== validation.targetDocumentHash ||
    report.validation.truthSnapshotHash !== validation.truthSnapshotHash ||
    report.validation.validatorSetHash !== validation.validatorSetHash ||
    report.validation.documentGloballyValid !== true ||
    report.validation.blockingIssues.length !== 0 ||
    report.validation.failure !== null ||
    !realBuildBrowserOutputV4HasCleanPrerequisites(report) ||
    report.pieces.length !== selected.witnesses.length
  ) {
    throw new TypeError(
      `Browser output /4 placement report ${report.stepNumber} does not equal its selected exact child and independent validation.`,
    );
  }
  for (let index = 0; index < selected.witnesses.length; index += 1) {
    const witness = selected.witnesses[index]!;
    const piece = report.pieces[index]!;
    if (
      piece.catalogPartId !== witness.catalogPartId ||
      !piece.placed ||
      piece.failure !== null ||
      piece.positionLdu === null ||
      piece.orientationId === null ||
      !neutralCompiledPieceDiagnostics(piece, selected.receipt.baseDocumentHash) ||
      !sameTransform(
        { positionLdu: piece.positionLdu, orientationId: piece.orientationId },
        witness.transform,
      )
    ) {
      throw new TypeError(
        `Browser output /4 placement report ${report.stepNumber} piece ${index} does not retain its exact selected witness.`,
      );
    }
  }
  requireSelectedCameraProjection(report, selectedCameraRow(step, selected, camera));
}

function addedParts(
  parent: RealBuildCandidateDocumentSnapshot,
  child: RealBuildCandidateDocumentSnapshot,
) {
  const parentIds = new Set(parent.document.parts.map(({ id }) => id));
  return child.document.parts.filter(({ id }) => !parentIds.has(id));
}

export function deriveRealBuildBrowserOutputV4PlacementBindings(input: {
  readonly parent: RealBuildCandidateDocumentSnapshot;
  readonly selected: SelectedAdvance;
  readonly preparedPanel: {
    readonly pieces: readonly {
      readonly identityKey: string;
      readonly designId: string;
      readonly materialId: string;
      readonly catalogPartId: string;
      readonly colorId: string;
    }[];
  };
  readonly stepNumber: number;
}): readonly RealBuildBrowserOutputV4IdentityBinding[] {
  const additions = addedParts(input.parent, input.selected.frontier.documentSnapshot);
  if (additions.length !== input.selected.witnesses.length) {
    throw new TypeError(
      `Browser output /4 placement step ${input.stepNumber} adds ${additions.length} exact parts for ${input.selected.witnesses.length} witnesses.`,
    );
  }
  const used = new Set<string>();
  return input.selected.witnesses.map((witness, index) => {
    const prepared = input.preparedPanel.pieces.find(
      ({ identityKey }) => identityKey === witness.identityKey,
    );
    const matches = additions.filter(
      (part) =>
        !used.has(part.id) &&
        part.catalogPartId === witness.catalogPartId &&
        part.colorId === witness.colorId &&
        sameTransform(part.transform, witness.transform),
    );
    if (
      prepared === undefined ||
      prepared.catalogPartId !== witness.catalogPartId ||
      prepared.colorId !== witness.colorId ||
      matches.length !== 1
    ) {
      throw new TypeError(
        `Browser output /4 placement step ${input.stepNumber} witness ${index} does not uniquely bind one prepared identity and added canonical part.`,
      );
    }
    const part = matches[0]!;
    used.add(part.id);
    return Object.freeze({
      identityKey: witness.identityKey,
      partId: part.id,
      stepNumber: input.stepNumber,
      designId: prepared.designId,
      materialId: prepared.materialId,
      catalogPartId: witness.catalogPartId,
      colorId: witness.colorId,
    });
  });
}

export function requireRealBuildBrowserOutputV4IdentityBindings(
  actual: readonly RealBuildBrowserOutputV4IdentityBinding[],
  expected: readonly RealBuildBrowserOutputV4IdentityBinding[],
): void {
  if (
    actual.length !== expected.length ||
    actual.some(
      (binding, index) => canonicalStringify(binding) !== canonicalStringify(expected[index]),
    )
  ) {
    throw new TypeError(
      `Browser output /4 retains ${actual.length} identity bindings; exact selected placement replay derives ${expected.length} in deterministic order.`,
    );
  }
}

export function realBuildBrowserOutputV4IdentityDigest(input: {
  readonly envelope: RealBuildBrowserOutputV4DetachedEnvelope;
  readonly preparedRunInputDigest: Sha256Digest;
  readonly terminalDocument: RealBuildCandidateDocumentSnapshot;
}): Sha256Digest {
  return canonicalDigest({
    schemaVersion: "lego.real-build-browser-output-v4-output-identity/1",
    preparedRunInputDigest: input.preparedRunInputDigest,
    status: input.envelope.status,
    evidence: input.envelope.evidence,
    reportDigests: input.envelope.reports.map((report) => canonicalDigest(report)),
    terminalDocumentHash: input.terminalDocument.documentHash,
    terminalCanonicalBytesHash: input.terminalDocument.canonicalBytesHash,
    terminalCanonicalByteLength: input.terminalDocument.canonicalByteLength,
    identityBindingsDigest: canonicalDigest(input.envelope.identityBindings),
    fetchedPdfDigest: input.envelope.fetchedPdfDigest,
    totalElapsedMs: input.envelope.totalElapsedMs,
    failureDigest:
      input.envelope.status === "failed" ? canonicalDigest(input.envelope.failure) : null,
  });
}
