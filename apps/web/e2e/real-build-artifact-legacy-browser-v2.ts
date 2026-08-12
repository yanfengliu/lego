import type { RealBuildOptions } from "./real-build-safety";
import { assertFrozenLegacyReportBaseV2 } from "./real-build-artifact-legacy-browser-v2-report";
import {
  legacyDenseArray,
  legacyExactKeys,
  legacyRecord,
} from "./real-build-artifact-legacy-browser-v2-values";
import { assertFrozenLegacyFartherV2 } from "./real-build-artifact-legacy-farther-v2";

export interface FrozenLegacyIdentityBindingV2 {
  readonly identityKey: string;
  readonly partId: string;
  readonly stepNumber: number;
  readonly designId: string;
  readonly materialId: string;
  readonly catalogPartId: string;
  readonly colorId: string;
}

interface FrozenLegacyExecutedBrowserOutputV2 {
  readonly schemaVersion: "lego.real-build-browser-output/2";
  readonly status: "executed";
  readonly reports: readonly Record<string, unknown>[];
  readonly documentJson: string;
  readonly identityBindings: readonly FrozenLegacyIdentityBindingV2[];
  readonly fetchedPdfDigest: string;
  readonly totalElapsedMs: number;
}

interface FrozenLegacyFailedBrowserOutputV2 {
  readonly schemaVersion: "lego.real-build-browser-output/2";
  readonly status: "failed";
  readonly reports: readonly Record<string, unknown>[];
  readonly documentJson: string | null;
  readonly identityBindings: readonly FrozenLegacyIdentityBindingV2[];
  readonly fetchedPdfDigest: string | null;
  readonly failure: Readonly<Record<string, unknown>>;
  readonly totalElapsedMs: number;
}

export type FrozenLegacyBrowserOutputV2 =
  FrozenLegacyExecutedBrowserOutputV2 | FrozenLegacyFailedBrowserOutputV2;

const ROOT_KEYS = {
  executed: [
    "schemaVersion",
    "status",
    "reports",
    "documentJson",
    "identityBindings",
    "fetchedPdfDigest",
    "totalElapsedMs",
  ],
  failed: [
    "schemaVersion",
    "status",
    "reports",
    "documentJson",
    "identityBindings",
    "fetchedPdfDigest",
    "failure",
    "totalElapsedMs",
  ],
} as const;

const DEFERRED_FAILURE_CODES = new Set([
  "deferred-panel-unscored",
  "deferred-reach-unmeasured",
  "weak-deferred-agreement",
  "ambiguous-deferred-placement",
]);

function assertFrozenReportCrossFields(
  report: Record<string, unknown>,
  panel: RealBuildOptions["panels"][number],
  options: RealBuildOptions,
  index: number,
): void {
  const outcome = report.outcome as Record<string, unknown>;
  const deferral = legacyRecord(report.deferral) ? report.deferral : null;
  const outcomeUsesDeferredLookahead =
    outcome.status === "complete"
      ? outcome.mechanism === "deferred-lookahead"
      : outcome.attemptedMechanism === "deferred-lookahead";
  const pieceReportsDeferredFailure = (report.pieces as readonly Record<string, unknown>[]).some(
    ({ failure }) => legacyRecord(failure) && DEFERRED_FAILURE_CODES.has(String(failure.code)),
  );
  if (
    (deferral !== null) !== outcomeUsesDeferredLookahead ||
    (pieceReportsDeferredFailure && deferral === null)
  ) {
    throw new TypeError(
      `Legacy browser-output /2 report[${index}] has incoherent deferral outcome evidence.`,
    );
  }
  assertFrozenLegacyFartherV2({ report, panel, options });
}

function assertFrozenIdentityBindings(
  bindings: readonly unknown[],
  options: RealBuildOptions,
): void {
  const seenIdentities = new Set<string>();
  const seenParts = new Set<string>();
  for (const binding of bindings) {
    if (
      !legacyRecord(binding) ||
      !legacyExactKeys(binding, [
        "identityKey",
        "partId",
        "stepNumber",
        "designId",
        "materialId",
        "catalogPartId",
        "colorId",
      ]) ||
      Object.entries(binding).some(([name, field]) =>
        name === "stepNumber"
          ? !Number.isInteger(field)
          : typeof field !== "string" || field.length === 0,
      ) ||
      (binding.stepNumber as number) < 1 ||
      (binding.stepNumber as number) > options.lastStep ||
      seenIdentities.has(binding.identityKey as string) ||
      seenParts.has(binding.partId as string)
    ) {
      throw new TypeError(
        "Legacy browser-output /2 identity bindings must be unique, complete, and step-bounded.",
      );
    }
    seenIdentities.add(binding.identityKey as string);
    seenParts.add(binding.partId as string);
  }
}

/** Reads retained generation-2 browser evidence without executing current browser predicates. */
export function inspectFrozenLegacyBrowserOutputV2(
  value: unknown,
  options: RealBuildOptions,
): FrozenLegacyBrowserOutputV2 {
  if (!legacyRecord(value) || (value.status !== "executed" && value.status !== "failed")) {
    throw new TypeError("Legacy browser-output /2 must be an executed or failed object.");
  }
  if (
    !legacyExactKeys(value, ROOT_KEYS[value.status]) ||
    value.schemaVersion !== "lego.real-build-browser-output/2" ||
    !legacyDenseArray(value.reports, options.lastStep) ||
    !legacyDenseArray(value.identityBindings, options.maxParts) ||
    typeof value.totalElapsedMs !== "number" ||
    !Number.isFinite(value.totalElapsedMs) ||
    value.totalElapsedMs < 0 ||
    value.totalElapsedMs > 4 * 60 * 60 * 1_000
  ) {
    throw new TypeError(
      "Legacy browser-output /2 must have its exact bounded root schema and elapsed time.",
    );
  }
  const seenSteps = new Set<number>();
  for (let index = 0; index < value.reports.length; index += 1) {
    const { report, panel } = assertFrozenLegacyReportBaseV2({
      value: value.reports[index],
      index,
      options,
    });
    const stepNumber = report.stepNumber as number;
    if (seenSteps.has(stepNumber)) {
      throw new TypeError(`Legacy browser-output /2 repeats printed step ${stepNumber}.`);
    }
    seenSteps.add(stepNumber);
    assertFrozenReportCrossFields(report, panel, options, index);
  }
  assertFrozenIdentityBindings(value.identityBindings, options);
  if (value.status === "failed") {
    if (
      (value.documentJson !== null && typeof value.documentJson !== "string") ||
      (value.fetchedPdfDigest !== null && value.fetchedPdfDigest !== options.inputDigests.pdf) ||
      !legacyRecord(value.failure) ||
      typeof value.failure.code !== "string" ||
      typeof value.failure.stage !== "string" ||
      typeof value.failure.message !== "string" ||
      value.failure.message.length === 0
    ) {
      throw new TypeError(
        "Legacy failed browser-output /2 must retain its structured failure and exact optional inputs.",
      );
    }
  }
  return value as unknown as FrozenLegacyBrowserOutputV2;
}
