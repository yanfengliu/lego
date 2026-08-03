import {
  settleAtomicStep,
  type RealBuildPieceReport,
  type RealBuildStepReport,
  type StepFailure,
  type StepOutcome,
} from "./real-build-safety";

export interface RuntimeBrickIdentity {
  readonly identityKey: string;
  readonly partId: string;
  readonly stepNumber: number;
  readonly designId: string;
  readonly materialId: string;
  readonly catalogPartId: string;
  readonly colorId: string;
}

export interface FixedLedgerPiece {
  readonly identityKey: string;
  readonly designId: string;
  readonly materialId: string;
  readonly catalogPartId: string;
  readonly colorId: string;
  readonly transform: {
    readonly positionLdu: readonly [number, number, number];
    readonly orientationId: string;
  };
  readonly sourceIdentityKey?: string;
}

export interface CanonicalPartShape {
  readonly id: string;
  readonly catalogPartId: string;
  readonly colorId: string;
  readonly transform: {
    readonly positionLdu: readonly number[];
    readonly orientationId: string;
  };
}

export interface PlacementResult<T> {
  readonly document: T;
  readonly partId: string;
  readonly stepId: string;
}

export const canonicalPartsFromDocument = (subject: unknown): readonly CanonicalPartShape[] =>
  (subject as { readonly parts: readonly CanonicalPartShape[] }).parts;

export const adaptFixedLedgerPlacement =
  <T>(
    place: (
      base: T,
      catalogPartId: string,
      transform: unknown,
      colorId: string,
      stepNumber: number,
      targetStepId: string | null,
    ) => PlacementResult<T>,
    stepNumber: number,
  ) =>
  (base: T, piece: FixedLedgerPiece, targetStepId: string | null): PlacementResult<T> =>
    place(base, piece.catalogPartId, piece.transform, piece.colorId, stepNumber, targetStepId);

export function createCanonicalPrintedStepPlacer<T>(input: {
  readonly createTransaction: (
    base: T,
    piece: {
      readonly catalogPartId: string;
      readonly colorId: string;
      readonly transform: unknown;
    },
  ) => { readonly operations: readonly unknown[]; readonly partId: string };
  readonly groupOperations: (
    operations: readonly unknown[],
    step: { readonly printedStepNumber: number; readonly targetStepId: string | null },
  ) => { readonly operations: readonly unknown[]; readonly stepId: string };
  readonly applyOperations: (base: T, operations: readonly unknown[]) => T;
}): (
  base: T,
  catalogPartId: string,
  transform: unknown,
  colorId: string,
  printedStepNumber: number,
  targetStepId: string | null,
) => PlacementResult<T> {
  return (base, catalogPartId, transform, colorId, printedStepNumber, targetStepId) => {
    const transaction = input.createTransaction(base, { catalogPartId, colorId, transform });
    const grouped = input.groupOperations(transaction.operations, {
      printedStepNumber,
      targetStepId,
    });
    return {
      document: input.applyOperations(base, grouped.operations),
      partId: transaction.partId,
      stepId: grouped.stepId,
    };
  };
}

const exactTransform = (
  actual: CanonicalPartShape["transform"],
  expected: FixedLedgerPiece["transform"],
): boolean =>
  actual.orientationId === expected.orientationId &&
  actual.positionLdu.length === 3 &&
  actual.positionLdu.every((coordinate, index) => coordinate === expected.positionLdu[index]);

const fixedFailure = (
  stepNumber: number,
  pieceIndex: number,
  piece: FixedLedgerPiece,
  message: string,
): StepFailure => ({
  code: piece.sourceIdentityKey === undefined ? "placement-error" : "multi-build-source-invalid",
  stage: "placement",
  stepNumber,
  pieceIndex,
  catalogPartId: piece.catalogPartId,
  message,
});

const pieceReport = (input: {
  readonly piece: FixedLedgerPiece;
  readonly prefixHash: string;
  readonly placed: boolean;
  readonly failure: StepFailure | null;
}): RealBuildPieceReport => ({
  catalogPartId: input.piece.catalogPartId,
  blind: {
    comparisonPrefixHash: input.prefixHash,
    distinctCandidates: 1,
    feasible: input.failure === null,
    rendered: 0,
    bestScore: null,
    runnerUpScore: null,
    agreesWithHighlight: null,
    refusal: input.failure?.message ?? null,
    elapsedMs: 0,
  },
  enumerated: 1,
  afterProximity: 1,
  rendered: 0,
  bestScore: null,
  runnerUpScore: null,
  placed: input.placed,
  positionLdu: input.placed ? input.piece.transform.positionLdu : null,
  orientationId: input.placed ? input.piece.transform.orientationId : null,
  failure: input.failure,
});

export function rollbackPlacedPieceReports(
  reports: RealBuildPieceReport[],
  input: { readonly stepNumber: number; readonly reason: string },
): void {
  for (let pieceIndex = 0; pieceIndex < reports.length; pieceIndex += 1) {
    const report = reports[pieceIndex]!;
    if (!report.placed) continue;
    reports[pieceIndex] = {
      ...report,
      placed: false,
      failure: {
        code: "atomic-step-rollback",
        stage: "atomicity",
        stepNumber: input.stepNumber,
        pieceIndex,
        catalogPartId: report.catalogPartId,
        message: `${report.catalogPartId} was rolled back at printed step ${input.stepNumber}: ${input.reason}`,
      },
    };
  }
}

/** Places only content-bound fixed transforms and returns registrations for atomic commit. */
export function executeFixedLedgerPlacements<T>(input: {
  readonly stepNumber: number;
  readonly baseDocument: T;
  readonly targetStepId: string | null;
  readonly pieces: readonly FixedLedgerPiece[];
  readonly priorIdentities: ReadonlyMap<string, RuntimeBrickIdentity>;
  readonly getParts: (document: T) => readonly CanonicalPartShape[];
  readonly structuralHash: (document: T) => string;
  readonly place: (
    base: T,
    piece: FixedLedgerPiece,
    targetStepId: string | null,
  ) => PlacementResult<T>;
}): {
  readonly document: T;
  readonly partIds: readonly string[];
  readonly stepId: string | null;
  readonly registrations: readonly RuntimeBrickIdentity[];
  readonly reports: readonly RealBuildPieceReport[];
  readonly failure: StepFailure | null;
} {
  let candidate = input.baseDocument;
  let stepId = input.targetStepId;
  const registrations: RuntimeBrickIdentity[] = [];
  const partIds: string[] = [];
  const reports: RealBuildPieceReport[] = [];
  const localIdentities = new Set<string>();
  for (const [pieceIndex, piece] of input.pieces.entries()) {
    const prefixHash = input.structuralHash(candidate);
    let failure: StepFailure | null = null;
    if (
      piece.identityKey.trim().length === 0 ||
      input.priorIdentities.has(piece.identityKey) ||
      localIdentities.has(piece.identityKey)
    ) {
      failure = fixedFailure(
        input.stepNumber,
        pieceIndex,
        piece,
        `Fixed ledger identity ${JSON.stringify(piece.identityKey)} is empty or already established; ` +
          `one physical Brick identity may be placed only once.`,
      );
    }
    if (failure === null && piece.sourceIdentityKey !== undefined) {
      const source = input.priorIdentities.get(piece.sourceIdentityKey);
      const sourcePart =
        source === undefined
          ? undefined
          : input.getParts(input.baseDocument).find(({ id }) => id === source.partId);
      if (
        source === undefined ||
        source.stepNumber >= input.stepNumber ||
        source.designId !== piece.designId ||
        source.materialId !== piece.materialId ||
        source.catalogPartId !== piece.catalogPartId ||
        source.colorId !== piece.colorId ||
        sourcePart?.catalogPartId !== piece.catalogPartId ||
        sourcePart.colorId !== piece.colorId
      ) {
        failure = fixedFailure(
          input.stepNumber,
          pieceIndex,
          piece,
          `MultiBuild copy ${piece.identityKey} requires prior exact source ${piece.sourceIdentityKey} with ` +
            `${piece.designId}/${piece.materialId}/${piece.catalogPartId}/${piece.colorId}; the canonical ` +
            `prefix does not contain that bound source identity.`,
        );
      }
    }
    if (failure !== null) {
      reports.push(pieceReport({ piece, prefixHash, placed: false, failure }));
      return { document: candidate, partIds, stepId, registrations, reports, failure };
    }
    try {
      const applied = input.place(candidate, piece, stepId);
      const part = input.getParts(applied.document).find(({ id }) => id === applied.partId);
      if (
        part?.catalogPartId !== piece.catalogPartId ||
        part.colorId !== piece.colorId ||
        !exactTransform(part.transform, piece.transform)
      ) {
        throw new TypeError(
          `placement did not preserve exact catalog/color/position/orientation for ${piece.identityKey}`,
        );
      }
      candidate = applied.document;
      stepId = applied.stepId;
      partIds.push(applied.partId);
      localIdentities.add(piece.identityKey);
      registrations.push({
        identityKey: piece.identityKey,
        partId: applied.partId,
        stepNumber: input.stepNumber,
        designId: piece.designId,
        materialId: piece.materialId,
        catalogPartId: piece.catalogPartId,
        colorId: piece.colorId,
      });
      reports.push(pieceReport({ piece, prefixHash, placed: true, failure: null }));
    } catch (error) {
      const failure = fixedFailure(
        input.stepNumber,
        pieceIndex,
        piece,
        `Fixed ledger placement ${piece.identityKey} failed at its exact transform: ` +
          `${error instanceof Error ? error.message : String(error)}.`,
      );
      reports.push(pieceReport({ piece, prefixHash, placed: false, failure }));
      return { document: candidate, partIds, stepId, registrations, reports, failure };
    }
  }
  return { document: candidate, partIds, stepId, registrations, reports, failure: null };
}

/** Executes and atomically settles a MultiBuild row without treating it as an ordinary search. */
export function executeMultiBuildLedgerStep<T>(input: {
  readonly stepNumber: number;
  readonly baseDocument: T;
  readonly expectedPieces: number;
  readonly pieces: readonly FixedLedgerPiece[];
  readonly priorIdentities: ReadonlyMap<string, RuntimeBrickIdentity>;
  readonly getParts: (document: T) => readonly CanonicalPartShape[];
  readonly structuralHash: (document: T) => string;
  readonly place: (
    base: T,
    piece: FixedLedgerPiece,
    targetStepId: string | null,
  ) => PlacementResult<T>;
  readonly assess: (document: T) => {
    readonly passed: boolean;
    readonly validation: RealBuildStepReport["validation"];
    readonly failure: StepFailure | null;
  };
}): {
  readonly document: T;
  readonly placed: number;
  readonly stepId: string | null;
  readonly registrations: readonly RuntimeBrickIdentity[];
  readonly reports: readonly RealBuildPieceReport[];
  readonly validation: RealBuildStepReport["validation"];
  readonly outcome: StepOutcome;
} {
  const fixed = executeFixedLedgerPlacements({
    stepNumber: input.stepNumber,
    baseDocument: input.baseDocument,
    targetStepId: null,
    pieces: input.pieces,
    priorIdentities: input.priorIdentities,
    getParts: input.getParts,
    structuralHash: input.structuralHash,
    place: input.place,
  });
  let validation: RealBuildStepReport["validation"] = {
    attempted: false,
    targetDocumentHash: null,
    truthSnapshotHash: null,
    validatorSetHash: null,
    documentGloballyValid: null,
    blockingIssues: [],
    failure: null,
  };
  let failure = fixed.failure;
  let hardValidationPassed = false;
  if (failure === null && fixed.registrations.length === input.expectedPieces) {
    const assessed = input.assess(fixed.document);
    hardValidationPassed = assessed.passed;
    validation = assessed.validation;
    failure = assessed.failure;
  }
  const settled = settleAtomicStep({
    stepNumber: input.stepNumber,
    baseDocument: input.baseDocument,
    candidateDocument: fixed.document,
    expectedPieces: input.expectedPieces,
    candidatePieces: fixed.registrations.length,
    attemptedMechanism: "official-ledger",
    firstPieceFailure: failure,
    hardValidationPassed,
  });
  const reports = fixed.reports.map((report, pieceIndex) =>
    settled.outcome.status === "complete" || !report.placed
      ? report
      : {
          ...report,
          placed: false,
          failure: {
            code: "atomic-step-rollback" as const,
            stage: "atomicity" as const,
            stepNumber: input.stepNumber,
            pieceIndex,
            catalogPartId: report.catalogPartId,
            message:
              `Fixed MultiBuild piece ${report.catalogPartId} was rolled back because printed step ` +
              `${input.stepNumber} did not complete and pass hard validation.`,
          },
        },
  );
  return {
    document: settled.document,
    placed: settled.acceptedPieces,
    stepId: settled.outcome.status === "complete" ? fixed.stepId : null,
    registrations: settled.outcome.status === "complete" ? fixed.registrations : [],
    reports,
    validation,
    outcome: settled.outcome,
  };
}
