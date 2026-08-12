import { createHash } from "node:crypto";

import type {
  RealBuildInputDigests,
  RealBuildOptions,
  RealBuildPanelSpec,
} from "./real-build-safety";
import type { RealBuildSourceSnapshot } from "./real-build-replay-files";
import { deriveMeasuredFartherOriginSourceAttestation } from "./real-build-farther-origin-source-attestation";
import {
  describeCurrentRunBudgetDefect,
  hasValidCurrentRunBudgets,
  hasValidLegacyRunBudgetsV2,
} from "./real-build-run-contract-budget-schema";

export {
  LEGACY_REAL_BUILD_RUN_BUDGET_KEYS_V2,
  REAL_BUILD_RUN_BUDGET_KEYS,
} from "./real-build-run-contract-budget-schema";

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

interface RealBuildRunContractFields {
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

/** Frozen inspection shape for already-retained generation-2 contract bytes. */
export interface LegacyRealBuildRunContractV2 extends RealBuildRunContractFields {
  readonly schemaVersion: "lego.real-build-run-contract/2";
}

/** Current contract generation; only this shape may verify current prepared options. */
export interface CurrentRealBuildRunContract extends RealBuildRunContractFields {
  readonly schemaVersion: "lego.real-build-run-contract/3";
}

export type RealBuildRunContract = LegacyRealBuildRunContractV2 | CurrentRealBuildRunContract;

const REAL_BUILD_RUN_CONTRACT_KEYS = [
  "schemaVersion",
  "inputDigests",
  "identificationClosure",
  "normalizedPanelsDigest",
  "actionLedger",
  "actionLedgerDigest",
  "budgets",
  "thresholds",
  "policy",
  "codeSnapshots",
  "contractDigest",
] as const;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const hasExactKeys = (value: Record<string, unknown>, keys: readonly string[]): boolean =>
  Object.keys(value).length === keys.length && keys.every((key) => key in value);

function normalizedPanels(panels: readonly RealBuildPanelSpec[]): readonly unknown[] {
  return panels.map((panel) => ({
    stepNumber: panel.stepNumber,
    pageNumber: panel.pageNumber,
    panelFace: panel.panelFace,
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
    panelFace: panel.panelFace,
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
    panelCameraBranchBudget: options.panelCameraBranchBudget,
    explodedGhostRenderBudget: options.explodedGhostRenderBudget,
    deferredNarrowingRenderBudget: options.deferredNarrowingRenderBudget,
    fartherPanelMaximumReachSteps: options.fartherPanelMaximumReachSteps,
    fartherPanelRenderBudget: options.fartherPanelRenderBudget,
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
}): CurrentRealBuildRunContract {
  if (!hasValidCurrentRunBudgets(input.budgets)) {
    throw new TypeError(
      "Real-build run contract budgets must have the exact bounded placement, deferred, " +
        `farther-panel, and panel-camera keys. ${describeCurrentRunBudgetDefect(input.budgets)}`,
    );
  }
  const actionLedger = normalizedActions(input.panels);
  const base = {
    schemaVersion: "lego.real-build-run-contract/3" as const,
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
  let parsedValue: unknown;
  try {
    parsedValue = JSON.parse(new TextDecoder("utf8", { fatal: true }).decode(bytes)) as unknown;
  } catch (error) {
    throw new TypeError(
      `Retained real-build run contract is not strict UTF-8 JSON: ${error instanceof Error ? error.message : String(error)}.`,
      { cause: error },
    );
  }
  if (
    !isRecord(parsedValue) ||
    !hasExactKeys(parsedValue, REAL_BUILD_RUN_CONTRACT_KEYS) ||
    (parsedValue.schemaVersion !== "lego.real-build-run-contract/2" &&
      parsedValue.schemaVersion !== "lego.real-build-run-contract/3") ||
    typeof parsedValue.contractDigest !== "string" ||
    !/^sha256:[0-9a-f]{64}$/u.test(parsedValue.contractDigest) ||
    (parsedValue.schemaVersion === "lego.real-build-run-contract/2"
      ? !hasValidLegacyRunBudgetsV2(parsedValue.budgets)
      : !hasValidCurrentRunBudgets(parsedValue.budgets)) ||
    !isRecord(parsedValue.policy) ||
    !hasExactKeys(parsedValue.policy, ["searchDisagreement", "partialStep", "unboundIdentity"]) ||
    parsedValue.policy.searchDisagreement !== "refuse" ||
    parsedValue.policy.partialStep !== "rollback" ||
    parsedValue.policy.unboundIdentity !== "refuse" ||
    !Array.isArray(parsedValue.actionLedger) ||
    !isRecord(parsedValue.inputDigests) ||
    !isRecord(parsedValue.identificationClosure) ||
    !isRecord(parsedValue.thresholds) ||
    !isRecord(parsedValue.codeSnapshots) ||
    typeof parsedValue.normalizedPanelsDigest !== "string" ||
    !/^sha256:[0-9a-f]{64}$/u.test(parsedValue.normalizedPanelsDigest) ||
    typeof parsedValue.actionLedgerDigest !== "string" ||
    !/^sha256:[0-9a-f]{64}$/u.test(parsedValue.actionLedgerDigest)
  ) {
    throw new TypeError("Retained real-build run contract has a malformed schema.");
  }
  const parsed = parsedValue as unknown as RealBuildRunContract;
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
  if (input.contract.schemaVersion !== "lego.real-build-run-contract/3") {
    throw new TypeError(
      "Current prepared real-build options cannot verify against retained run-contract /2 bytes; " +
        "generation 2 is frozen for parsing and inspection only, while current generation requires " +
        "run-contract /3 with panelCameraBranchBudget.",
    );
  }
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
  if (input.options.measuredFartherOriginSourceAttestation != null) {
    const contractAttestation = deriveMeasuredFartherOriginSourceAttestation(
      input.contract.codeSnapshots,
    );
    const retainedSourceAttestation = deriveMeasuredFartherOriginSourceAttestation(codeSnapshots);
    if (
      JSON.stringify(input.options.measuredFartherOriginSourceAttestation) !==
        JSON.stringify(contractAttestation) ||
      JSON.stringify(input.options.measuredFartherOriginSourceAttestation) !==
        JSON.stringify(retainedSourceAttestation)
    ) {
      throw new TypeError(
        "Prepared measured farther-origin source attestation does not reproduce from both " +
          "run-contract /3 codeSnapshots and the exact retained source bundle.",
      );
    }
  }
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
