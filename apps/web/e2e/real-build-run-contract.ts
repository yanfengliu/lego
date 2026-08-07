import { createHash } from "node:crypto";

import type {
  RealBuildInputDigests,
  RealBuildOptions,
  RealBuildPanelSpec,
} from "./real-build-safety";
import type { RealBuildSourceSnapshot } from "./real-build-replay-files";

const sha256 = (value: string | Uint8Array): string =>
  `sha256:${createHash("sha256").update(value).digest("hex")}`;

export const REAL_BUILD_INPUT_ROLE_BY_DIGEST = {
  pdf: "pdf",
  calloutManifest: "callout-manifest",
  coverage: "coverage",
  officialModel: "official-model",
  actionLedger: "action-ledger",
  highlightCalibration: "highlight-calibration",
  builderCalibration: "builder-calibration",
  builderGeometry: "builder-geometry",
  transitionClassifications: "transition-classifications",
} as const satisfies Readonly<Record<keyof RealBuildInputDigests, string>>;

export const REAL_BUILD_IDENTIFICATION_ROLE_BY_DIGEST = {
  features: "identification-features",
  match: "identification-match",
  distances: "identification-distances",
  elements: "element-resolution",
  cards: "identification-cards",
  cardImages: "identification-card-images",
  answers: "identification-answers",
  pairJudged: "pair-judged-truth",
} as const;

export interface RealBuildIdentificationClosureDigests {
  readonly source: "deterministic" | "adjudicated";
  readonly features: string;
  readonly match: string;
  readonly distances: string;
  readonly elements: string;
  readonly cards: string | null;
  readonly cardImages: string | null;
  readonly answers: string | null;
  /** Mandatory in both modes: blind pair judging is a trust source, not an adjudication aid. */
  readonly pairJudged: string;
}

export interface RealBuildRunContract {
  readonly schemaVersion: "lego.real-build-run-contract/2";
  readonly inputDigests: RealBuildInputDigests;
  readonly identificationClosure: RealBuildIdentificationClosureDigests;
  readonly normalizedPanelsDigest: string;
  readonly actionLedger: readonly unknown[];
  readonly actionLedgerDigest: string;
  readonly budgets: Readonly<Record<string, number>>;
  readonly thresholds: Readonly<Record<string, number | string | null>>;
  readonly policy: {
    readonly searchDisagreement: "refuse";
    readonly partialStep: "rollback";
    readonly unboundIdentity: "refuse";
  };
  readonly codeSnapshots: Readonly<Record<string, string>>;
  readonly contractDigest: string;
}

function normalizedPanels(panels: readonly RealBuildPanelSpec[]): readonly unknown[] {
  return panels.map((panel) => ({
    stepNumber: panel.stepNumber,
    pageNumber: panel.pageNumber,
    bounds: [panel.minXPt, panel.maxXPt, panel.minYPt, panel.maxYPt],
    calloutBoxes: panel.calloutBoxes,
    mappedCalloutKeys: panel.mappedCalloutKeys,
    calloutPieces: panel.calloutPieces,
    classifiedPhysicalCalloutPieces: panel.classifiedPhysicalCalloutPieces,
    semanticMultiplierQuantity: panel.semanticMultiplierQuantity,
    omittedPhysicalPieces: panel.omittedPhysicalPieces,
  }));
}

function normalizedActions(panels: readonly RealBuildPanelSpec[]): readonly unknown[] {
  return panels.map((panel) => ({
    stepNumber: panel.stepNumber,
    action: panel.action,
    directIdentities: panel.pieces.map(
      ({
        identityKey,
        designId,
        materialId,
        catalogPartId,
        colorId,
        calloutKey,
        identificationConfidence,
        cropDigest,
        identificationInputDigest,
        expectedTransform,
      }) => ({
        identityKey,
        designId,
        materialId,
        catalogPartId,
        colorId,
        calloutKey,
        identificationConfidence,
        cropDigest,
        identificationInputDigest,
        expectedTransform,
      }),
    ),
    omittedIdentities: panel.omittedPieces,
  }));
}

export function realBuildRunBudgets(options: RealBuildOptions): Readonly<Record<string, number>> {
  return {
    lastStep: options.lastStep,
    expectedPrintedSteps: options.expectedPrintedSteps,
    maxParts: options.maxParts,
    targetPartCount: options.targetPartCount,
    maxRendersPerPiece: options.maxRendersPerPiece,
    blindRenderBudget: options.blindRenderBudget,
    deferredCandidateBudget: options.deferredCandidateBudget,
  };
}

export function realBuildRunThresholds(
  options: RealBuildOptions,
): Readonly<Record<string, number | string | null>> {
  return {
    minimumScoreMargin: options.minimumScoreMargin,
    minimumDeferredAgreementMargin: options.minimumDeferredAgreementMargin,
    minimumDeferredAgreement: options.minimumDeferredAgreement,
    minimumWholeStepScore: options.minimumWholeStepScore,
    minimumExclusiveHighlightPixelsPerPiece: options.minimumExclusiveHighlightPixelsPerPiece,
    highlightCalibrationDigest: options.highlightCalibrationDigest,
    proximityMarginPx: options.proximityMarginPx,
    renderScale: options.renderScale,
    panelWidth: options.panelWidth,
    workFactor: options.workFactor,
  };
}

export function createRealBuildRunContract(input: {
  readonly inputDigests: RealBuildInputDigests;
  readonly identificationClosure: RealBuildIdentificationClosureDigests;
  readonly panels: readonly RealBuildPanelSpec[];
  readonly budgets: Readonly<Record<string, number>>;
  readonly thresholds: Readonly<Record<string, number | string | null>>;
  readonly codeSnapshots: Readonly<Record<string, string>>;
}): RealBuildRunContract {
  const actionLedger = normalizedActions(input.panels);
  const base = {
    schemaVersion: "lego.real-build-run-contract/2" as const,
    inputDigests: input.inputDigests,
    identificationClosure: input.identificationClosure,
    normalizedPanelsDigest: sha256(JSON.stringify(normalizedPanels(input.panels))),
    actionLedger,
    actionLedgerDigest: sha256(JSON.stringify(actionLedger)),
    budgets: input.budgets,
    thresholds: input.thresholds,
    policy: {
      searchDisagreement: "refuse" as const,
      partialStep: "rollback" as const,
      unboundIdentity: "refuse" as const,
    },
    codeSnapshots: input.codeSnapshots,
  };
  return { ...base, contractDigest: sha256(JSON.stringify(base)) };
}

export function parseRealBuildRunContract(bytes: Uint8Array): RealBuildRunContract {
  let parsed: RealBuildRunContract;
  try {
    parsed = JSON.parse(
      new TextDecoder("utf8", { fatal: true }).decode(bytes),
    ) as RealBuildRunContract;
  } catch (error) {
    throw new TypeError(
      `Retained real-build run contract is not strict UTF-8 JSON: ${error instanceof Error ? error.message : String(error)}.`,
      { cause: error },
    );
  }
  if (
    typeof parsed !== "object" ||
    parsed === null ||
    parsed.schemaVersion !== "lego.real-build-run-contract/2" ||
    typeof parsed.contractDigest !== "string"
  ) {
    throw new TypeError("Retained real-build run contract has a malformed schema.");
  }
  const { contractDigest, ...base } = parsed;
  if (sha256(JSON.stringify(base)) !== contractDigest) {
    throw new TypeError("Retained real-build run contract does not reproduce its content digest.");
  }
  return parsed;
}

/** Verifies the contract's digest fields against exact retained raw role hashes. */
export function verifyRealBuildRunContractRoleDigests(
  contract: RealBuildRunContract,
  roleDigests: Readonly<Record<string, string>>,
): void {
  for (const [inputKey, role] of Object.entries(REAL_BUILD_INPUT_ROLE_BY_DIGEST) as [
    keyof RealBuildInputDigests,
    string,
  ][]) {
    if (contract.inputDigests[inputKey] !== roleDigests[role]) {
      throw new TypeError(
        `Run contract ${inputKey} digest is not bound to retained raw role ${role}.`,
      );
    }
  }
  const identification = contract.identificationClosure;
  if (
    (identification.source !== "deterministic" && identification.source !== "adjudicated") ||
    !/^sha256:[0-9a-f]{64}$/u.test(identification.features) ||
    !/^sha256:[0-9a-f]{64}$/u.test(identification.match) ||
    !/^sha256:[0-9a-f]{64}$/u.test(identification.distances) ||
    !/^sha256:[0-9a-f]{64}$/u.test(identification.elements) ||
    !/^sha256:[0-9a-f]{64}$/u.test(identification.pairJudged) ||
    (identification.source === "deterministic" &&
      (identification.cards !== null ||
        identification.cardImages !== null ||
        identification.answers !== null)) ||
    (identification.source === "adjudicated" &&
      (!/^sha256:[0-9a-f]{64}$/u.test(identification.cards ?? "") ||
        !/^sha256:[0-9a-f]{64}$/u.test(identification.cardImages ?? "") ||
        !/^sha256:[0-9a-f]{64}$/u.test(identification.answers ?? "")))
  ) {
    throw new TypeError(
      "Run contract identification closure must contain mandatory raw digests and source-exact conditional adjudication digests.",
    );
  }
  for (const key of ["features", "match", "distances", "elements", "pairJudged"] as const) {
    const role = REAL_BUILD_IDENTIFICATION_ROLE_BY_DIGEST[key];
    if (identification[key] !== roleDigests[role]) {
      throw new TypeError(
        `Run contract identification ${key} digest is not bound to retained raw role ${role}.`,
      );
    }
  }
  for (const key of ["cards", "cardImages", "answers"] as const) {
    const role = REAL_BUILD_IDENTIFICATION_ROLE_BY_DIGEST[key];
    if (identification.source === "adjudicated") {
      if (identification[key] !== roleDigests[role]) {
        throw new TypeError(
          `Adjudicated run contract ${key} digest is not bound to retained raw role ${role}.`,
        );
      }
    } else if (role in roleDigests) {
      throw new TypeError(
        `Deterministic run contract must omit the conditional retained raw role ${role}.`,
      );
    }
  }
}

/** Enforces exact fixed-input and workspace-package alias semantics, not only a self-consistent map. */
export function verifyRealBuildExecutionSourceBindings(input: {
  readonly sourceFiles: readonly RealBuildSourceSnapshot[];
  readonly pdfDigest: string;
}): void {
  const byPath = new Map<string, RealBuildSourceSnapshot>();
  for (const source of input.sourceFiles) {
    if (
      byPath.has(source.path) ||
      !Number.isSafeInteger(source.bytes) ||
      source.bytes < 0 ||
      !/^sha256:[0-9a-f]{64}$/u.test(source.digest)
    ) {
      throw new TypeError(
        `Execution source bundle has a duplicated or malformed entry: ${source.path}.`,
      );
    }
    byPath.set(source.path, source);
  }
  const booklet = byPath.get("inputs/booklet.pdf");
  if (booklet === undefined || booklet.digest !== input.pdfDigest) {
    throw new TypeError(
      "Execution source inputs/booklet.pdf must exactly bind the retained raw pdf role.",
    );
  }
  for (const source of input.sourceFiles) {
    const packageMatch = /^packages\/([^/]+)\/(.+)$/u.exec(source.path);
    const aliasMatch = /^node_modules\/@lego-studio\/([^/]+)\/(.+)$/u.exec(source.path);
    if (packageMatch === null && aliasMatch === null) continue;
    const counterpartPath =
      packageMatch === null
        ? `packages/${aliasMatch![1]!}/${aliasMatch![2]!}`
        : `node_modules/@lego-studio/${packageMatch[1]!}/${packageMatch[2]!}`;
    const counterpart = byPath.get(counterpartPath);
    if (
      counterpart === undefined ||
      counterpart.digest !== source.digest ||
      counterpart.bytes !== source.bytes
    ) {
      throw new TypeError(
        `Execution source package identity ${source.path} must have one exact workspace/alias counterpart at ${counterpartPath}.`,
      );
    }
  }
}

/** Binds deserialized options to raw role hashes, the canonical run contract, and every source byte. */
export function verifyRealBuildRunContract(input: {
  readonly contract: RealBuildRunContract;
  readonly options: RealBuildOptions;
  readonly roleDigests: Readonly<Record<string, string>>;
  readonly sourceFiles: readonly RealBuildSourceSnapshot[];
}): void {
  verifyRealBuildRunContractRoleDigests(input.contract, input.roleDigests);
  verifyRealBuildExecutionSourceBindings({
    sourceFiles: input.sourceFiles,
    pdfDigest: input.roleDigests.pdf!,
  });
  for (const [inputKey, role] of Object.entries(REAL_BUILD_INPUT_ROLE_BY_DIGEST) as [
    keyof RealBuildInputDigests,
    string,
  ][]) {
    if (input.options.inputDigests[inputKey] !== input.roleDigests[role]) {
      throw new TypeError(
        `Prepared options ${inputKey} digest is not bound to retained raw role ${role}.`,
      );
    }
  }
  const codeSnapshots = Object.fromEntries(
    input.sourceFiles
      .map(({ path, digest }) => [path, digest] as const)
      .sort(([left], [right]) => left.localeCompare(right)),
  );
  const regenerated = createRealBuildRunContract({
    inputDigests: input.options.inputDigests,
    identificationClosure: input.contract.identificationClosure,
    panels: input.options.panels,
    budgets: realBuildRunBudgets(input.options),
    thresholds: realBuildRunThresholds(input.options),
    codeSnapshots,
  });
  if (JSON.stringify(regenerated) !== JSON.stringify(input.contract)) {
    throw new TypeError(
      "Retained options do not exactly reproduce the raw-input/source-bound real-build run contract.",
    );
  }
}
