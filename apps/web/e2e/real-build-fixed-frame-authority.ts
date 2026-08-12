import type { StepFailure } from "./real-build-safety";
import { createRealBuildPanelCameraRegistration } from "./real-build-panel-camera-registration";

const DECISION_KEYS = [
  "auditBasis",
  "determinant",
  "evidenceDigest",
  "mapping",
  "reason",
  "schemaVersion",
  "sourceDocumentHash",
  "status",
] as const;
const INPUT_KEYS = ["actionKind", "frameDecision", "sourceDocumentHash", "stepNumber"] as const;
const SHA256_DIGEST = /^sha256:[0-9a-f]{64}$/u;
const AUTHORITY = Symbol("RealBuildPhysicalFrameAuthority");

export type RealBuildFixedActionKind = "multi-build-copy" | "omitted-ledger-pieces";

/**
 * Data-only output of an independent physical-frame audit. Panel-camera
 * registration deliberately does not implement this contract.
 */
export type RealBuildPhysicalFrameDecision =
  | {
      readonly schemaVersion: "lego.real-build-physical-frame-decision/1";
      readonly auditBasis: "independent-physical-frame-audit";
      readonly status: "proper";
      readonly determinant: 1;
      /** Only the already-established catalog-world identity mapping is admitted. */
      readonly mapping: "catalog-world-identity";
      readonly sourceDocumentHash: string;
      readonly evidenceDigest: string;
      readonly reason: null;
    }
  | {
      readonly schemaVersion: "lego.real-build-physical-frame-decision/1";
      readonly auditBasis: "independent-physical-frame-audit";
      readonly status: "reflected";
      readonly determinant: -1;
      readonly mapping: null;
      readonly sourceDocumentHash: string;
      readonly evidenceDigest: string;
      readonly reason: string;
    }
  | {
      readonly schemaVersion: "lego.real-build-physical-frame-decision/1";
      readonly auditBasis: "independent-physical-frame-audit";
      readonly status: "unresolved";
      readonly determinant: null;
      readonly mapping: null;
      readonly sourceDocumentHash: string;
      readonly evidenceDigest: string;
      readonly reason: string;
    };

/**
 * Opaque capability reserved for a future trusted producer tied directly to a
 * verified physical audit. No current data parser or exported factory mints it.
 */
export interface RealBuildPhysicalFrameAuthority {
  readonly schemaVersion: "lego.real-build-physical-frame-authority/1";
  readonly authorityKind: "physical-catalog-world-frame";
  readonly mapping: "catalog-world-identity";
  readonly determinant: 1;
  readonly sourceDocumentHash: string;
  readonly evidenceDigest: string;
  readonly [AUTHORITY]: true;
}

export interface RealBuildPhysicalFrameAdmission {
  readonly status: "refused";
  readonly authority: null;
  readonly failure: StepFailure;
}

export interface RealBuildFixedActionExecution {
  readonly status: "refused";
  readonly authority: null;
  readonly value: null;
  readonly failure: StepFailure;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

function hasExactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const actual = Object.keys(value);
  const required = new Set(expected);
  return actual.length === required.size && actual.every((key) => required.has(key));
}

function describe(value: unknown): string {
  if (typeof value === "number" && !Number.isFinite(value)) return String(value);
  try {
    const encoded = JSON.stringify(value);
    return encoded === undefined ? String(value) : encoded;
  } catch {
    return Object.prototype.toString.call(value);
  }
}

function panelCameraDescription(value: unknown): string | null {
  try {
    const registration = createRealBuildPanelCameraRegistration(value);
    return (
      `panel-camera registration from printed panel ${registration.registrationPanelStepNumber} ` +
      `(hand ${registration.latticeHand}, determinant ${registration.latticeDeterminant}, ` +
      `turn ${registration.turnDegrees}, shift ${JSON.stringify(registration.shiftPx)})`
    );
  } catch {
    return null;
  }
}

function refusal(input: {
  readonly actionKind: RealBuildFixedActionKind;
  readonly stepNumber: number;
  readonly sourceDocumentHash: string;
  readonly reason: string;
}): RealBuildPhysicalFrameAdmission {
  return Object.freeze({
    status: "refused" as const,
    authority: null,
    failure: Object.freeze({
      code: "fixed-ledger-frame-unresolved" as const,
      stage: "placement" as const,
      stepNumber: input.stepNumber,
      message:
        `Fixed-ledger ${input.actionKind} at printed step ${input.stepNumber} cannot use its exact official ` +
        `transform for canonical source ${JSON.stringify(input.sourceDocumentHash)}: ${input.reason} ` +
        `The fixed action remains unexecuted until a separately audited, determinant +1 physical ` +
        `catalog-world frame binds this exact source document.`,
    }),
  });
}

function validateGuardInput(input: unknown): {
  readonly stepNumber: number;
  readonly actionKind: RealBuildFixedActionKind;
  readonly sourceDocumentHash: string;
  readonly frameDecision: unknown;
} {
  if (!isRecord(input) || !hasExactKeys(input, INPUT_KEYS)) {
    throw new TypeError(
      `A fixed-action physical-frame guard requires exactly ${INPUT_KEYS.join(", ")}; received ${describe(input)}.`,
    );
  }
  const { stepNumber, actionKind, sourceDocumentHash, frameDecision } = input;
  if (!Number.isSafeInteger(stepNumber) || (stepNumber as number) < 1) {
    throw new RangeError(
      `Fixed-action physical-frame stepNumber must be a positive safe integer; received ${describe(stepNumber)}.`,
    );
  }
  if (actionKind !== "multi-build-copy" && actionKind !== "omitted-ledger-pieces") {
    throw new TypeError(
      `Fixed-action physical-frame actionKind must be "multi-build-copy" or "omitted-ledger-pieces"; received ${describe(actionKind)}.`,
    );
  }
  if (typeof sourceDocumentHash !== "string" || !SHA256_DIGEST.test(sourceDocumentHash)) {
    throw new TypeError(
      `Fixed-action physical-frame sourceDocumentHash must be sha256:<64 lowercase hex>; received ${describe(sourceDocumentHash)}.`,
    );
  }
  return { stepNumber: stepNumber as number, actionKind, sourceDocumentHash, frameDecision };
}

/**
 * Rejects every current data-only physical-frame claim. A future trusted
 * producer may mint the opaque capability only by consuming a verified audit
 * directly; accepting a self-labelled digest object here would let untrusted
 * input certify itself.
 */
export function admitRealBuildPhysicalFrameAuthority(
  suppliedInput: unknown,
): RealBuildPhysicalFrameAdmission {
  const input = validateGuardInput(suppliedInput);
  const camera = panelCameraDescription(input.frameDecision);
  if (camera !== null) {
    return refusal({
      ...input,
      reason:
        `received ${camera}. That observation registers pixels and binary silhouette only; it is explicitly ` +
        `not physical transform authority.`,
    });
  }
  if (!isRecord(input.frameDecision) || !hasExactKeys(input.frameDecision, DECISION_KEYS)) {
    return refusal({
      ...input,
      reason: `no complete independent physical-frame decision was supplied; received ${describe(input.frameDecision)}.`,
    });
  }
  const decision = Object.freeze({
    schemaVersion: input.frameDecision.schemaVersion,
    auditBasis: input.frameDecision.auditBasis,
    status: input.frameDecision.status,
    determinant: input.frameDecision.determinant,
    mapping: input.frameDecision.mapping,
    sourceDocumentHash: input.frameDecision.sourceDocumentHash,
    evidenceDigest: input.frameDecision.evidenceDigest,
    reason: input.frameDecision.reason,
  });
  const wellShaped =
    decision.schemaVersion === "lego.real-build-physical-frame-decision/1" &&
    decision.auditBasis === "independent-physical-frame-audit" &&
    typeof decision.sourceDocumentHash === "string" &&
    SHA256_DIGEST.test(decision.sourceDocumentHash) &&
    typeof decision.evidenceDigest === "string" &&
    SHA256_DIGEST.test(decision.evidenceDigest);
  if (!wellShaped) {
    return refusal({
      ...input,
      reason: `the claimed physical-frame decision has invalid schema, audit basis, or source/evidence digest: ${describe(decision)}.`,
    });
  }
  if (decision.sourceDocumentHash !== input.sourceDocumentHash) {
    return refusal({
      ...input,
      reason:
        `the independent decision binds source ${JSON.stringify(decision.sourceDocumentHash)}, not the ` +
        `requested canonical source ${JSON.stringify(input.sourceDocumentHash)}.`,
    });
  }
  if (decision.status !== "proper") {
    const detail =
      typeof decision.reason === "string" && decision.reason.trim().length > 0
        ? decision.reason
        : "the data-only physical-frame decision did not establish one proper identity mapping";
    return refusal({
      ...input,
      reason:
        `the data-only decision is ${describe(decision.status)} with determinant ${describe(decision.determinant)} ` +
        `and mapping ${describe(decision.mapping)}: ${detail}. Reflections and unresolved mappings cannot place ` +
        `catalog-world parts.`,
    });
  }
  return refusal({
    ...input,
    reason:
      `received a data-only claim of status ${describe(decision.status)}, determinant ${describe(decision.determinant)}, ` +
      `and mapping ${describe(decision.mapping)}. Even a well-shaped proper/identity claim cannot mint the ` +
      `opaque authority: no trusted physical-audit producer is implemented, so this caller-supplied object ` +
      `cannot certify itself.`,
  });
}

/**
 * The current fixed-action caller seam. `execute` is intentionally never read:
 * no trusted physical-authority producer exists yet, so hash/getParts/place/
 * assess can all remain behind one fail-closed callback.
 */
export function executeRealBuildFixedActionWithPhysicalAuthority(
  suppliedInput: unknown,
): RealBuildFixedActionExecution {
  if (!isRecord(suppliedInput)) {
    throw new TypeError(
      `A guarded fixed action must be an object; received ${describe(suppliedInput)}.`,
    );
  }
  const admission = admitRealBuildPhysicalFrameAuthority({
    actionKind: suppliedInput.actionKind,
    frameDecision: suppliedInput.frameDecision,
    sourceDocumentHash: suppliedInput.sourceDocumentHash,
    stepNumber: suppliedInput.stepNumber,
  });
  return Object.freeze({
    status: "refused",
    authority: null,
    value: null,
    failure: admission.failure,
  });
}
