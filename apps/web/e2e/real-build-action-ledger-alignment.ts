import { parseStep13AlignmentInput } from "./real-build-action-ledger-alignment-input";
import type {
  AlignmentCallout,
  AlignmentIdentity,
  AlignmentStepNumber,
} from "./real-build-action-ledger-alignment-types";

export {
  STEP_13_ALIGNMENT_INPUT_SCHEMA,
  type Step13AlignmentInput,
} from "./real-build-action-ledger-alignment-input";

export const STEP_13_ALIGNMENT_DIAGNOSTIC_SCHEMA = "lego.step-13-alignment-diagnostic/1" as const;
export type Step13AlignmentOutcome =
  | "misidentification-indicated-unverified"
  | "boundary-indicated-unverified"
  | "ambiguous"
  | "insufficient-evidence";
type Signal = "member-local-candidate-distance" | "member-local-stud-core-count";

interface RangeWitness {
  readonly stepNumber: AlignmentStepNumber;
  readonly identityCursorStart: number;
  readonly identityCursorEnd: number;
  readonly phaseSequences: readonly number[];
  readonly phaseIds: readonly string[];
  readonly designs: readonly string[];
  readonly subBuildPaths: readonly (readonly string[])[];
}

interface SplitConflict {
  readonly stepNumber: 13 | 14;
  readonly requiredEndCursor: number;
  readonly phaseSequence: number;
  readonly phaseId: string;
  readonly phaseStartCursor: number;
  readonly phaseEndCursor: number;
  readonly subBuildPath: readonly string[];
}

export interface Step13AlignmentDiagnostic {
  readonly schemaVersion: typeof STEP_13_ALIGNMENT_DIAGNOSTIC_SCHEMA;
  readonly authority: {
    readonly status: "absent";
    readonly authenticated: false;
    readonly admissionAuthority: false;
  };
  readonly source: {
    readonly verification: "unbound-detached-input";
    readonly builderSourceDigest: string;
    readonly builderPhaseDigest: string;
  };
  readonly anchor: { readonly afterStepNumber: 12; readonly identityCursor: 26 };
  readonly outcome: Step13AlignmentOutcome;
  readonly boundaryWitness: {
    readonly status:
      "whole-phase-partition" | "nested-phase-split-required" | "non-nested-phase-split-required";
    readonly ranges: readonly RangeWitness[];
    readonly splitConflict: SplitConflict | null;
  };
  readonly identificationWitness: {
    readonly status:
      | "supports-builder-design"
      | "supports-claimed-design"
      | "conflicting"
      | "insufficient"
      | "not-evaluated";
    readonly mismatch: {
      readonly stepNumber: AlignmentStepNumber;
      readonly calloutKey: string;
      readonly calloutUnit: number;
      readonly brickRef: string;
      readonly claimedDesignId: string;
      readonly builderDesignId: string;
      readonly ownCropDigest: string | null;
      readonly inheritedJudgedCropDigest: string | null;
      readonly candidatePreferredDesignId: string | null;
      readonly studCorePreferredDesignId: string | null;
      readonly builderSupportSignals: readonly Signal[];
      readonly claimedSupportSignals: readonly Signal[];
    } | null;
  };
}

const STEP_QUANTITIES = [1, 3, 3] as const;

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

function preferredDesign(
  rows: readonly { readonly designId: string; readonly distance: number }[],
  claimedDesignId: string,
  builderDesignId: string,
): string | null {
  const claimed = rows.find(({ designId }) => designId === claimedDesignId);
  const builder = rows.find(({ designId }) => designId === builderDesignId);
  if (claimed === undefined || builder === undefined || claimed.distance === builder.distance)
    return null;
  return claimed.distance < builder.distance ? claimedDesignId : builderDesignId;
}

function matchMismatches(
  steps: ReturnType<typeof parseStep13AlignmentInput>["steps"],
  phases: ReturnType<typeof parseStep13AlignmentInput>["phases"],
  ranges: readonly RangeWitness[],
): readonly {
  readonly stepNumber: AlignmentStepNumber;
  readonly callout: AlignmentCallout;
  readonly unit: number;
  readonly identity: AlignmentIdentity;
}[] {
  const unmatched: {
    stepNumber: AlignmentStepNumber;
    callout: AlignmentCallout;
    unit: number;
    identity: AlignmentIdentity;
  }[] = [];
  for (const [stepIndex, step] of steps.entries()) {
    const range = ranges[stepIndex]!;
    const pool = phases
      .filter(({ sequence }) => range.phaseSequences.includes(sequence))
      .flatMap(({ identities }) => identities.map((identity) => ({ ...identity })));
    const deferred: { callout: AlignmentCallout; unit: number }[] = [];
    for (const callout of [...step.callouts].sort((left, right) =>
      left.calloutKey.localeCompare(right.calloutKey),
    )) {
      for (let unit = 1; unit <= callout.quantity; unit += 1) {
        const exact = pool.findIndex(({ designId }) => designId === callout.claimedDesignId);
        if (exact === -1) deferred.push({ callout, unit });
        else pool.splice(exact, 1);
      }
    }
    if (deferred.length !== pool.length) continue;
    deferred.forEach(({ callout, unit }, index) => {
      unmatched.push({ stepNumber: step.stepNumber, callout, unit, identity: pool[index]! });
    });
  }
  return unmatched;
}

function identificationWitness(
  mismatch:
    | {
        readonly stepNumber: AlignmentStepNumber;
        readonly callout: AlignmentCallout;
        readonly unit: number;
        readonly identity: AlignmentIdentity;
      }
    | undefined,
): Step13AlignmentDiagnostic["identificationWitness"] {
  if (mismatch === undefined) return { status: "insufficient", mismatch: null };
  const { callout, identity } = mismatch;
  const evidence = callout.identification;
  const builderSupportSignals: Signal[] = [];
  const claimedSupportSignals: Signal[] = [];
  let candidatePreferredDesignId: string | null = null;
  let studCorePreferredDesignId: string | null = null;
  if (evidence !== null) {
    candidatePreferredDesignId = preferredDesign(
      evidence.candidates,
      callout.claimedDesignId,
      identity.designId,
    );
    if (candidatePreferredDesignId === identity.designId)
      builderSupportSignals.push("member-local-candidate-distance");
    if (candidatePreferredDesignId === callout.claimedDesignId)
      claimedSupportSignals.push("member-local-candidate-distance");
    const claimedCount = evidence.studCore?.expectedByDesign.find(
      ({ designId }) => designId === callout.claimedDesignId,
    )?.count;
    const builderCount = evidence.studCore?.expectedByDesign.find(
      ({ designId }) => designId === identity.designId,
    )?.count;
    if (
      evidence.studCore !== null &&
      claimedCount !== undefined &&
      builderCount !== undefined &&
      claimedCount !== builderCount
    ) {
      if (evidence.studCore.observedCount === builderCount) {
        studCorePreferredDesignId = identity.designId;
        builderSupportSignals.push("member-local-stud-core-count");
      } else if (evidence.studCore.observedCount === claimedCount) {
        studCorePreferredDesignId = callout.claimedDesignId;
        claimedSupportSignals.push("member-local-stud-core-count");
      }
    }
  }
  const status =
    builderSupportSignals.length > 0 && claimedSupportSignals.length > 0
      ? "conflicting"
      : builderSupportSignals.length >= 2
        ? "supports-builder-design"
        : claimedSupportSignals.length >= 2
          ? "supports-claimed-design"
          : "insufficient";
  return {
    status,
    mismatch: {
      stepNumber: mismatch.stepNumber,
      calloutKey: callout.calloutKey,
      calloutUnit: mismatch.unit,
      brickRef: identity.brickRef,
      claimedDesignId: callout.claimedDesignId,
      builderDesignId: identity.designId,
      ownCropDigest: evidence?.ownCropDigest ?? null,
      inheritedJudgedCropDigest: evidence?.inheritedJudgement?.judgedCropDigest ?? null,
      candidatePreferredDesignId,
      studCorePreferredDesignId,
      builderSupportSignals,
      claimedSupportSignals,
    },
  };
}

export function diagnoseStep13Alignment(value: unknown): Step13AlignmentDiagnostic {
  const input = parseStep13AlignmentInput(value);
  const phaseCursors = input.phases.map((phase, index) => ({
    phase,
    start:
      input.phaseWindowStartIdentityCursor +
      input.phases.slice(0, index).reduce((total, item) => total + item.identities.length, 0),
  }));
  const ranges: RangeWitness[] = [];
  let phaseIndex = 0;
  let cursor = input.phaseWindowStartIdentityCursor;
  let splitConflict: SplitConflict | null = null;
  for (const [stepIndex, step] of input.steps.entries()) {
    const startPhaseIndex = phaseIndex;
    const startCursor = cursor;
    const required = STEP_QUANTITIES[stepIndex]!;
    let accumulated = 0;
    while (phaseIndex < phaseCursors.length && accumulated < required) {
      const current = phaseCursors[phaseIndex]!;
      const next = accumulated + current.phase.identities.length;
      if (next > required) {
        if (step.stepNumber === 12) {
          throw new TypeError(
            `Printed step 12 would split Builder phase ${current.phase.sequence}: it needs ${required} identity but phase contains ${current.phase.identities.length}. Supply the unslid whole phase that closes cursor 26.`,
          );
        }
        splitConflict = {
          stepNumber: step.stepNumber,
          requiredEndCursor: startCursor + required,
          phaseSequence: current.phase.sequence,
          phaseId: current.phase.phaseId,
          phaseStartCursor: current.start,
          phaseEndCursor: current.start + current.phase.identities.length,
          subBuildPath: [...current.phase.subBuildPath],
        };
        break;
      }
      accumulated = next;
      phaseIndex += 1;
    }
    if (splitConflict !== null) break;
    if (accumulated !== required) {
      throw new TypeError(
        `Printed step ${step.stepNumber} needs ${required} identities, but the whole-phase window supplies ${accumulated}. Supply every contiguous source phase through step 14.`,
      );
    }
    cursor += required;
    const used = input.phases.slice(startPhaseIndex, phaseIndex);
    ranges.push({
      stepNumber: step.stepNumber,
      identityCursorStart: startCursor,
      identityCursorEnd: cursor,
      phaseSequences: used.map(({ sequence }) => sequence),
      phaseIds: used.map(({ phaseId }) => phaseId),
      designs: used.flatMap(({ identities }) => identities.map(({ designId }) => designId)),
      subBuildPaths: used.map(({ subBuildPath }) => [...subBuildPath]),
    });
  }
  if (ranges[0]?.identityCursorEnd !== 26) {
    throw new TypeError(
      `Printed step 12 ended at identity cursor ${String(ranges[0]?.identityCursorEnd)}; expected fixed cursor 26.`,
    );
  }
  const boundaryStatus =
    splitConflict === null
      ? "whole-phase-partition"
      : splitConflict.subBuildPath.length > 0
        ? "nested-phase-split-required"
        : "non-nested-phase-split-required";
  const mismatches =
    splitConflict === null ? matchMismatches(input.steps, input.phases, ranges) : [];
  const step13Mismatch =
    mismatches.length === 1 && mismatches[0]?.stepNumber === 13 ? mismatches[0] : undefined;
  const identification =
    splitConflict === null
      ? identificationWitness(step13Mismatch)
      : ({ status: "not-evaluated", mismatch: null } as const);
  const outcome: Step13AlignmentOutcome =
    boundaryStatus === "nested-phase-split-required" && splitConflict?.stepNumber === 13
      ? "boundary-indicated-unverified"
      : identification.status === "supports-builder-design"
        ? "misidentification-indicated-unverified"
        : identification.status === "conflicting" ||
            identification.status === "supports-claimed-design"
          ? "ambiguous"
          : "insufficient-evidence";
  return deepFreeze({
    schemaVersion: STEP_13_ALIGNMENT_DIAGNOSTIC_SCHEMA,
    authority: { status: "absent", authenticated: false, admissionAuthority: false },
    source: {
      verification: "unbound-detached-input",
      builderSourceDigest: input.builderSourceDigest,
      builderPhaseDigest: input.builderPhaseDigest,
    },
    anchor: { afterStepNumber: 12, identityCursor: 26 },
    outcome,
    boundaryWitness: { status: boundaryStatus, ranges, splitConflict },
    identificationWitness: identification,
  });
}
