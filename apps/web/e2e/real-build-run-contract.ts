import { createHash } from "node:crypto";

import { canonicalStringify } from "@lego-studio/brick-kernel";

import type {
  RealBuildInputDigests,
  RealBuildOptions,
  RealBuildPanelRasterSpec,
  RealBuildPanelSpec,
} from "./real-build-safety";
import type { RealBuildSourceSnapshot } from "./real-build-replay-files";
import { deriveMeasuredFartherOriginSourceAttestation } from "./real-build-farther-origin-source-attestation";
import {
  assertRealBuildRetainedActionPrefix,
  selectRealBuildExecutablePanels,
} from "./real-build-run-action-prefix";
import {
  describeCurrentRunBudgetDefect,
  hasValidCurrentRunBudgets,
  hasValidLegacyRunBudgetsV2,
} from "./real-build-run-contract-budget-schema";
import {
  assertCanonicalRealBuildJsonBytes,
  encodeCanonicalRealBuildJson,
  parseDuplicateFreeRealBuildJson,
} from "./real-build-json-admission";

export {
  LEGACY_REAL_BUILD_RUN_BUDGET_KEYS_V2,
  REAL_BUILD_RUN_BUDGET_KEYS,
} from "./real-build-run-contract-budget-schema";
export {
  assertRealBuildRetainedActionPrefix,
  selectRealBuildExecutablePanels,
} from "./real-build-run-action-prefix";

const sha256 = (value: string | Uint8Array): string =>
  `sha256:${createHash("sha256").update(value).digest("hex")}`;

function canonicalClone<T>(value: T): T {
  return JSON.parse(canonicalStringify(value)) as T;
}

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
  sourceArtRebound: "source-art-rebound",
  cards: "identification-cards",
  cardImages: "identification-card-images",
  answers: "identification-answers",
  pairJudged: "pair-judged-truth",
} as const;

/** Retained source text from which replay independently re-derives all 359 panel cells. */
export const REAL_BUILD_PANEL_SOURCE_ROLE = "panel-source" as const;

export interface LegacyRealBuildIdentificationClosureDigests {
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

export interface RealBuildIdentificationClosureDigests extends LegacyRealBuildIdentificationClosureDigests {
  /** Recomputed raw-PDF relation proof; it is not semantic identity or placement authority by itself. */
  readonly sourceArtRebound: string;
}

interface RealBuildRunContractFields<
  IdentificationClosure extends LegacyRealBuildIdentificationClosureDigests,
> {
  readonly inputDigests: RealBuildInputDigests;
  readonly identificationClosure: IdentificationClosure;
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
export interface LegacyRealBuildRunContractV2 extends RealBuildRunContractFields<LegacyRealBuildIdentificationClosureDigests> {
  readonly schemaVersion: "lego.real-build-run-contract/2";
}

/** Frozen inspection shape for pre-prefix generation-3 contract bytes. */
export interface LegacyRealBuildRunContractV3 extends RealBuildRunContractFields<LegacyRealBuildIdentificationClosureDigests> {
  readonly schemaVersion: "lego.real-build-run-contract/3";
}

/** Frozen inspection shape for the pre-rebound bounded-prefix contract. */
export interface LegacyRealBuildRunContractV4 extends RealBuildRunContractFields<LegacyRealBuildIdentificationClosureDigests> {
  readonly schemaVersion: "lego.real-build-run-contract/4";
  /** Exact bounded instruction-source bytes used to reconstruct panel geometry during replay. */
  readonly panelSourceDigest: string;
  /** Exact ordered raster-only suffix whose pixels may score the final executable step. */
  readonly normalizedPassivePanelsDigest: string;
}

/** Current contract generation; only this shape may verify current prepared options. */
export interface CurrentRealBuildRunContract extends RealBuildRunContractFields<RealBuildIdentificationClosureDigests> {
  readonly schemaVersion: "lego.real-build-run-contract/5";
  /** Exact bounded instruction-source bytes used to reconstruct panel geometry during replay. */
  readonly panelSourceDigest: string;
  /** Exact ordered raster-only suffix whose pixels may score the final executable step. */
  readonly normalizedPassivePanelsDigest: string;
}

export type RealBuildRunContract =
  | LegacyRealBuildRunContractV2
  | LegacyRealBuildRunContractV3
  | LegacyRealBuildRunContractV4
  | CurrentRealBuildRunContract;

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
const CURRENT_REAL_BUILD_RUN_CONTRACT_KEYS = [
  ...REAL_BUILD_RUN_CONTRACT_KEYS,
  "panelSourceDigest",
  "normalizedPassivePanelsDigest",
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

function normalizedPassivePanels(panels: readonly RealBuildPanelRasterSpec[]): readonly unknown[] {
  return panels.map((panel) => ({
    stepNumber: panel.stepNumber,
    pageNumber: panel.pageNumber,
    panelFace: panel.panelFace,
    bounds: [panel.minXPt, panel.maxXPt, panel.minYPt, panel.maxYPt],
    calloutBoxes: panel.calloutBoxes,
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
  readonly panelSourceDigest: string;
  readonly panels: readonly RealBuildPanelSpec[];
  readonly passivePanels: readonly RealBuildPanelRasterSpec[];
  readonly budgets: Readonly<Record<string, number>>;
  readonly thresholds: Readonly<Record<string, number | string | null>>;
  readonly codeSnapshots: Readonly<Record<string, string>>;
}): CurrentRealBuildRunContract {
  if (!/^sha256:[0-9a-f]{64}$/u.test(input.panelSourceDigest)) {
    throw new TypeError(
      `Real-build run contract panelSourceDigest must bind exact retained source bytes; received ${JSON.stringify(input.panelSourceDigest)}.`,
    );
  }
  if (!hasValidCurrentRunBudgets(input.budgets)) {
    throw new TypeError(
      "Real-build run contract budgets must have the exact bounded placement, deferred, " +
        `farther-panel, and panel-camera keys. ${describeCurrentRunBudgetDefect(input.budgets)}`,
    );
  }
  const executablePanels = selectRealBuildExecutablePanels(input.panels, input.budgets.lastStep!);
  const actionLedger = canonicalClone(normalizedActions(executablePanels));
  const base = canonicalClone({
    schemaVersion: "lego.real-build-run-contract/5" as const,
    inputDigests: input.inputDigests,
    identificationClosure: input.identificationClosure,
    panelSourceDigest: input.panelSourceDigest,
    normalizedPanelsDigest: sha256(canonicalStringify(normalizedPanels(executablePanels))),
    normalizedPassivePanelsDigest: sha256(
      canonicalStringify(normalizedPassivePanels(input.passivePanels)),
    ),
    actionLedger,
    actionLedgerDigest: sha256(canonicalStringify(actionLedger)),
    budgets: input.budgets,
    thresholds: input.thresholds,
    policy: {
      searchDisagreement: "refuse" as const,
      partialStep: "rollback" as const,
      unboundIdentity: "refuse" as const,
    },
    codeSnapshots: input.codeSnapshots,
  });
  return { ...base, contractDigest: sha256(canonicalStringify(base)) };
}

/** Current contracts have one duplicate-free canonical compact byte representation. */
export function encodeCurrentRealBuildRunContract(
  contract: CurrentRealBuildRunContract,
): Uint8Array {
  return encodeCanonicalRealBuildJson(contract);
}

export function parseRealBuildRunContract(bytes: Uint8Array): RealBuildRunContract {
  const parsedValue = parseDuplicateFreeRealBuildJson<unknown>(
    bytes,
    "retained real-build run contract",
  );
  if (
    !isRecord(parsedValue) ||
    !hasExactKeys(
      parsedValue,
      parsedValue.schemaVersion === "lego.real-build-run-contract/4" ||
        parsedValue.schemaVersion === "lego.real-build-run-contract/5"
        ? CURRENT_REAL_BUILD_RUN_CONTRACT_KEYS
        : REAL_BUILD_RUN_CONTRACT_KEYS,
    ) ||
    (parsedValue.schemaVersion !== "lego.real-build-run-contract/2" &&
      parsedValue.schemaVersion !== "lego.real-build-run-contract/3" &&
      parsedValue.schemaVersion !== "lego.real-build-run-contract/4" &&
      parsedValue.schemaVersion !== "lego.real-build-run-contract/5") ||
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
    ((parsedValue.schemaVersion === "lego.real-build-run-contract/4" ||
      parsedValue.schemaVersion === "lego.real-build-run-contract/5") &&
      (typeof parsedValue.panelSourceDigest !== "string" ||
        !/^sha256:[0-9a-f]{64}$/u.test(parsedValue.panelSourceDigest))) ||
    ((parsedValue.schemaVersion === "lego.real-build-run-contract/4" ||
      parsedValue.schemaVersion === "lego.real-build-run-contract/5") &&
      (typeof parsedValue.normalizedPassivePanelsDigest !== "string" ||
        !/^sha256:[0-9a-f]{64}$/u.test(parsedValue.normalizedPassivePanelsDigest))) ||
    typeof parsedValue.actionLedgerDigest !== "string" ||
    !/^sha256:[0-9a-f]{64}$/u.test(parsedValue.actionLedgerDigest)
  ) {
    throw new TypeError("Retained real-build run contract has a malformed schema.");
  }
  const parsed = parsedValue as unknown as RealBuildRunContract;
  if (
    parsed.schemaVersion === "lego.real-build-run-contract/4" ||
    parsed.schemaVersion === "lego.real-build-run-contract/5"
  ) {
    assertCanonicalRealBuildJsonBytes(
      bytes,
      parsed,
      `retained canonical real-build run contract ${parsed.schemaVersion.slice(-2)}`,
    );
  }
  const { contractDigest, ...base } = parsed;
  const reproducedDigest =
    parsed.schemaVersion === "lego.real-build-run-contract/4" ||
    parsed.schemaVersion === "lego.real-build-run-contract/5"
      ? sha256(canonicalStringify(base))
      : sha256(JSON.stringify(base));
  if (reproducedDigest !== contractDigest) {
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
  if (
    (contract.schemaVersion === "lego.real-build-run-contract/4" ||
      contract.schemaVersion === "lego.real-build-run-contract/5") &&
    roleDigests[REAL_BUILD_PANEL_SOURCE_ROLE] !== contract.panelSourceDigest
  ) {
    throw new TypeError(
      `Run contract panelSourceDigest is not bound to retained raw role ${REAL_BUILD_PANEL_SOURCE_ROLE}.`,
    );
  }
  const identification = contract.identificationClosure;
  if (
    (identification.source !== "deterministic" && identification.source !== "adjudicated") ||
    !/^sha256:[0-9a-f]{64}$/u.test(identification.features) ||
    !/^sha256:[0-9a-f]{64}$/u.test(identification.match) ||
    !/^sha256:[0-9a-f]{64}$/u.test(identification.distances) ||
    !/^sha256:[0-9a-f]{64}$/u.test(identification.elements) ||
    !/^sha256:[0-9a-f]{64}$/u.test(identification.pairJudged) ||
    (contract.schemaVersion === "lego.real-build-run-contract/5" &&
      (!("sourceArtRebound" in identification) ||
        !/^sha256:[0-9a-f]{64}$/u.test(identification.sourceArtRebound))) ||
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
  const mandatoryDigestKeys = ["features", "match", "distances", "elements", "pairJudged"] as const;
  for (const key of mandatoryDigestKeys) {
    const role = REAL_BUILD_IDENTIFICATION_ROLE_BY_DIGEST[key];
    if (identification[key] !== roleDigests[role]) {
      throw new TypeError(
        `Run contract identification ${key} digest is not bound to retained raw role ${role}.`,
      );
    }
  }
  if (contract.schemaVersion === "lego.real-build-run-contract/5") {
    const role = REAL_BUILD_IDENTIFICATION_ROLE_BY_DIGEST.sourceArtRebound;
    if (
      !("sourceArtRebound" in identification) ||
      identification.sourceArtRebound !== roleDigests[role]
    ) {
      throw new TypeError(
        `Run contract identification sourceArtRebound digest is not bound to retained raw role ${role}.`,
      );
    }
  } else if (REAL_BUILD_IDENTIFICATION_ROLE_BY_DIGEST.sourceArtRebound in roleDigests) {
    throw new TypeError(
      `Legacy run contract ${contract.schemaVersion} must omit the future retained raw role ${REAL_BUILD_IDENTIFICATION_ROLE_BY_DIGEST.sourceArtRebound}.`,
    );
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
  if (input.contract.schemaVersion !== "lego.real-build-run-contract/5") {
    throw new TypeError(
      "Current prepared real-build options cannot verify against retained run-contract /2, /3, or /4 " +
        "bytes; generations 2 through 4 are frozen for parsing and inspection only, while current " +
        "generation requires run-contract /5 source-art rebound semantics.",
    );
  }
  assertRealBuildRetainedActionPrefix({ contract: input.contract, options: input.options });
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
          "run-contract /5 codeSnapshots and the exact retained source bundle.",
      );
    }
  }
  const regenerated = createRealBuildRunContract({
    inputDigests: input.options.inputDigests,
    identificationClosure: input.contract.identificationClosure,
    panelSourceDigest: input.roleDigests[REAL_BUILD_PANEL_SOURCE_ROLE]!,
    panels: input.options.panels,
    passivePanels: input.options.passivePanels,
    budgets: realBuildRunBudgets(input.options),
    thresholds: realBuildRunThresholds(input.options),
    codeSnapshots,
  });
  if (canonicalStringify(regenerated) !== canonicalStringify(input.contract)) {
    throw new TypeError(
      "Retained options do not exactly reproduce the raw-input/source-bound real-build run contract.",
    );
  }
}
