export const LEGACY_REAL_BUILD_RUN_BUDGET_KEYS_V2 = [
  "lastStep",
  "expectedPrintedSteps",
  "maxParts",
  "targetPartCount",
  "maxRendersPerPiece",
  "blindRenderBudget",
  "deferredCandidateBudget",
  "explodedGhostRenderBudget",
  "deferredNarrowingRenderBudget",
  "fartherPanelMaximumReachSteps",
  "fartherPanelRenderBudget",
] as const;

export const REAL_BUILD_RUN_BUDGET_KEYS = [
  "lastStep",
  "expectedPrintedSteps",
  "maxParts",
  "targetPartCount",
  "maxRendersPerPiece",
  "blindRenderBudget",
  "deferredCandidateBudget",
  "panelCameraBranchBudget",
  "explodedGhostRenderBudget",
  "deferredNarrowingRenderBudget",
  "fartherPanelMaximumReachSteps",
  "fartherPanelRenderBudget",
] as const;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const hasExactKeys = (value: Record<string, unknown>, keys: readonly string[]): boolean =>
  Object.keys(value).length === keys.length && keys.every((key) => key in value);

type SharedRunBudgetKey = Exclude<
  (typeof REAL_BUILD_RUN_BUDGET_KEYS)[number],
  "panelCameraBranchBudget"
>;

function hasValidSharedRunBudgets(value: Readonly<Record<SharedRunBudgetKey, number>>): boolean {
  return (
    value.lastStep >= 1 &&
    value.lastStep <= value.expectedPrintedSteps &&
    value.expectedPrintedSteps === 359 &&
    value.targetPartCount >= 1 &&
    value.maxParts >= value.targetPartCount &&
    value.maxRendersPerPiece >= 1 &&
    value.blindRenderBudget >= 1 &&
    value.maxRendersPerPiece >= value.blindRenderBudget &&
    value.deferredCandidateBudget >= 1 &&
    value.explodedGhostRenderBudget >= value.deferredCandidateBudget &&
    value.deferredNarrowingRenderBudget >= value.deferredCandidateBudget &&
    value.fartherPanelMaximumReachSteps >= 1 &&
    value.fartherPanelMaximumReachSteps < value.expectedPrintedSteps &&
    value.fartherPanelRenderBudget >= 1 &&
    value.fartherPanelRenderBudget <= 16
  );
}

export function hasValidLegacyRunBudgetsV2(
  value: unknown,
): value is Readonly<Record<string, number>> {
  if (!isRecord(value) || !hasExactKeys(value, LEGACY_REAL_BUILD_RUN_BUDGET_KEYS_V2)) {
    return false;
  }
  if (!LEGACY_REAL_BUILD_RUN_BUDGET_KEYS_V2.every((key) => Number.isSafeInteger(value[key]))) {
    return false;
  }
  return hasValidSharedRunBudgets(value as Readonly<Record<SharedRunBudgetKey, number>>);
}

export function hasValidCurrentRunBudgets(
  value: unknown,
): value is Readonly<Record<string, number>> {
  if (!isRecord(value) || !hasExactKeys(value, REAL_BUILD_RUN_BUDGET_KEYS)) return false;
  if (!REAL_BUILD_RUN_BUDGET_KEYS.every((key) => Number.isSafeInteger(value[key]))) return false;
  const budget = value as Readonly<Record<(typeof REAL_BUILD_RUN_BUDGET_KEYS)[number], number>>;
  return (
    hasValidSharedRunBudgets(budget) &&
    budget.panelCameraBranchBudget >= 8 &&
    budget.panelCameraBranchBudget <= 800_000 &&
    budget.panelCameraBranchBudget % 8 === 0
  );
}

function describe(value: unknown): string {
  if (typeof value === "number" && !Number.isFinite(value)) return String(value);
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return Object.prototype.toString.call(value);
  }
}

export function describeCurrentRunBudgetDefect(value: unknown): string {
  if (!isRecord(value)) return `Received ${describe(value)} instead of an object.`;
  const actualKeys = Object.keys(value);
  const missing = REAL_BUILD_RUN_BUDGET_KEYS.filter((key) => !(key in value));
  const expected = new Set<string>(REAL_BUILD_RUN_BUDGET_KEYS);
  const extra = actualKeys.filter((key) => !expected.has(key));
  if (missing.length > 0 || extra.length > 0) {
    return (
      `Missing keys: ${missing.length === 0 ? "none" : missing.join(", ")}. ` +
      `Unexpected keys: ${extra.length === 0 ? "none" : extra.join(", ")}.`
    );
  }
  const unsafe = REAL_BUILD_RUN_BUDGET_KEYS.find((key) => !Number.isSafeInteger(value[key]));
  if (unsafe !== undefined)
    return `${unsafe} is ${describe(value[unsafe])}; required a safe integer.`;
  const budget = value as Readonly<Record<(typeof REAL_BUILD_RUN_BUDGET_KEYS)[number], number>>;
  if (budget.panelCameraBranchBudget < 8 || budget.panelCameraBranchBudget > 800_000) {
    return (
      `panelCameraBranchBudget is ${budget.panelCameraBranchBudget}; required 8 through 800000, ` +
      `inclusive.`
    );
  }
  if (budget.panelCameraBranchBudget % 8 !== 0) {
    return (
      `panelCameraBranchBudget is ${budget.panelCameraBranchBudget}; required a multiple of 8 ` +
      `for atomic D4 hypothesis groups.`
    );
  }
  return `Observed bounded values: ${describe(value)}.`;
}
