import {
  canonicalDigest,
  composeRigidTransforms,
  documentStructuralHash,
  validateBrickDocument,
} from "@lego-studio/brick-kernel";
import type { BrickDocumentV1, RigidTransform } from "@lego-studio/protocol";

import type {
  RealBuildPrefix50SearchBudget,
  RealBuildPrefix50TargetOccurrence,
} from "./real-build-prefix50-exact-compiler-contract";
import { ownData, sameTransform } from "./real-build-prefix50-exact-compiler-foundation";
import {
  realBuildPrefix50ProjectionCommitment,
  requireRealBuildPrefix50VerifiedProjectionValue,
  type RealBuildPrefix50VerifiedProjection,
} from "./real-build-prefix50-projection";
import {
  requireRealBuildPrefix50SuffixSubBuildPlan,
  type RealBuildPrefix50SuffixSubBuildPlan,
} from "./real-build-prefix50-suffix-subbuild-plan";

export const REAL_BUILD_PREFIX50_STEP50_ROOT_ORDINALS = [312, 313] as const;
const INCOMPLETE_VALIDATION_CODES = new Set([
  "COLLISION_COMPARISON_BUDGET_EXCEEDED",
  "COLLISION_FINDING_BUDGET_EXCEEDED",
  "VALIDATION_ISSUE_BUDGET_EXCEEDED",
]);

export interface RealBuildPrefix50Step50AtomicRootInput {
  readonly projection: RealBuildPrefix50VerifiedProjection;
  readonly plan: RealBuildPrefix50SuffixSubBuildPlan;
  readonly parentDocument: BrickDocumentV1;
  readonly gauge: RigidTransform;
  readonly rootRows: readonly [
    RealBuildPrefix50TargetOccurrence,
    RealBuildPrefix50TargetOccurrence,
  ];
  readonly budget: RealBuildPrefix50SearchBudget;
}

export interface RealBuildPrefix50ValidatedStep50AtomicRootInput {
  readonly projection: RealBuildPrefix50VerifiedProjection;
  readonly plan: RealBuildPrefix50SuffixSubBuildPlan;
  readonly parentDocumentHash: `sha256:${string}`;
  readonly parentTruthDigest: `sha256:${string}`;
  readonly rows: readonly [RealBuildPrefix50TargetOccurrence, RealBuildPrefix50TargetOccurrence];
  readonly budget: RealBuildPrefix50SearchBudget;
}

function exactKeys(value: unknown, expected: readonly string[], label: string): void {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${label} must be a data object.`);
  }
  let keys: readonly string[];
  try {
    keys = Object.keys(value).sort();
  } catch {
    throw new TypeError(`${label} could not be inspected safely.`);
  }
  const wanted = [...expected].sort();
  if (
    keys.length !== wanted.length ||
    keys.some((key, index) => key !== wanted[index]) ||
    keys.some((key) => {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      return descriptor === undefined || !descriptor.enumerable || !("value" in descriptor);
    })
  ) {
    throw new TypeError(`${label} must contain exactly ${wanted.join(", ")}.`);
  }
}

function requireParentDocument(value: unknown): BrickDocumentV1 {
  const document = value as BrickDocumentV1;
  if (
    document?.parts?.length !== 311 ||
    document?.steps?.length !== 49 ||
    document.steps.some(({ index }, arrayIndex) => index !== arrayIndex) ||
    document.steps[43]?.partIds.length !== 0
  ) {
    throw new TypeError(
      "Prefix-50 Step-50 atomic root requires the exact hard-valid 311-part Step-49 parent with contiguous Steps 1 through 49 and empty Step 44.",
    );
  }
  const report = validateBrickDocument(document);
  const blocking = report.issues.filter(({ severity }) => severity === "blocking");
  const incomplete = report.issues.filter(({ code }) => INCOMPLETE_VALIDATION_CODES.has(code));
  if (
    blocking.length !== 0 ||
    incomplete.length !== 0 ||
    !report.documentGloballyValid ||
    report.targetDocumentHash !== documentStructuralHash(document)
  ) {
    throw new TypeError(
      `Prefix-50 Step-50 atomic root parent must be completely hard-valid; blocking/incomplete=${blocking.map(({ code }) => code).join("+") || "none"}/${incomplete.map(({ code }) => code).join("+") || "none"}.`,
    );
  }
  return document;
}

function requireRows(
  value: unknown,
  projection: RealBuildPrefix50VerifiedProjection,
  gauge: RigidTransform,
  plan: RealBuildPrefix50SuffixSubBuildPlan,
): RealBuildPrefix50ValidatedStep50AtomicRootInput["rows"] {
  if (!Array.isArray(value) || value.length !== 2) {
    throw new TypeError(
      "Prefix-50 Step-50 atomic root requires exactly source-order ordinals 312 and 313.",
    );
  }
  const rows = value as unknown as RealBuildPrefix50ValidatedStep50AtomicRootInput["rows"];
  for (const [index, row] of rows.entries()) {
    const ordinal = REAL_BUILD_PREFIX50_STEP50_ROOT_ORDINALS[index]!;
    const source = projection.occurrences[ordinal - 1];
    const expectedTarget =
      source === undefined ? null : composeRigidTransforms(gauge, source.sourceWorldTransform);
    if (
      source === undefined ||
      row.ordinal !== ordinal ||
      row.printedStepNumber !== 50 ||
      row.phaseSequence !== 90 ||
      row.phaseMemberOrdinal !== index + 1 ||
      row.partIdentity !== source.partIdentity ||
      row.sourceWorldTransform !== source.sourceWorldTransform ||
      row.subBuildPath !== source.subBuildPath ||
      canonicalDigest({
        ordinal: row.ordinal,
        printedStepNumber: row.printedStepNumber,
        phaseSequence: row.phaseSequence,
        phaseMemberOrdinal: row.phaseMemberOrdinal,
        subBuildPath: row.subBuildPath,
        colorId: row.colorId,
        partIdentity: row.partIdentity,
        sourceWorldTransform: row.sourceWorldTransform,
      }) !== canonicalDigest(source) ||
      expectedTarget === null ||
      !sameTransform(row.targetTransform, expectedTarget) ||
      canonicalDigest(row.subBuildPath) !==
        canonicalDigest(plan.terminalDetachedChild.sourceSubBuildPath)
    ) {
      throw new TypeError(
        `Prefix-50 Step-50 atomic root row ${index} must retain exact source ordinal ${ordinal}, phase-90 membership, child path, identity, and gauge-composed target pose.`,
      );
    }
  }
  return rows;
}

function requireBudget(value: unknown): RealBuildPrefix50SearchBudget {
  exactKeys(
    value,
    ["enumerations", "nodes", "orientationNarrowedEnumerations", "targetAttempts"],
    "Prefix-50 Step-50 atomic root search accounting",
  );
  const budget = value as RealBuildPrefix50SearchBudget;
  if (
    !Number.isSafeInteger(budget.nodes) ||
    budget.nodes < 0 ||
    !Number.isSafeInteger(budget.enumerations) ||
    budget.enumerations < 0 ||
    !Number.isSafeInteger(budget.orientationNarrowedEnumerations) ||
    budget.orientationNarrowedEnumerations < 0 ||
    !(budget.targetAttempts instanceof Map)
  ) {
    throw new TypeError(
      "Prefix-50 Step-50 atomic root requires the shared bounded search accounting object.",
    );
  }
  return budget;
}

export function requireRealBuildPrefix50Step50AtomicRootInput(
  unsafeInput: RealBuildPrefix50Step50AtomicRootInput,
): RealBuildPrefix50ValidatedStep50AtomicRootInput {
  exactKeys(
    unsafeInput,
    ["budget", "gauge", "parentDocument", "plan", "projection", "rootRows"],
    "Prefix-50 Step-50 atomic root input",
  );
  const projection = requireRealBuildPrefix50VerifiedProjectionValue(
    ownData(
      unsafeInput,
      "projection",
      "Prefix-50 Step-50 atomic root input",
    ) as RealBuildPrefix50VerifiedProjection,
  );
  const plan = requireRealBuildPrefix50SuffixSubBuildPlan(
    ownData(unsafeInput, "plan", "Prefix-50 Step-50 atomic root input"),
  );
  if (
    projection.sourceSetId !== "6651557" ||
    plan.projectionCommitment !== realBuildPrefix50ProjectionCommitment(projection) ||
    plan.terminalDetachedChild.printedStepNumber !== 50 ||
    plan.terminalDetachedChild.step51Inspected
  ) {
    throw new TypeError(
      "Prefix-50 Step-50 atomic root requires the exact branded suffix plan and verified steps-1-through-50 projection with no Step-51 inspection.",
    );
  }
  const gauge = ownData(
    unsafeInput,
    "gauge",
    "Prefix-50 Step-50 atomic root input",
  ) as RigidTransform;
  const parentDocument = requireParentDocument(
    ownData(unsafeInput, "parentDocument", "Prefix-50 Step-50 atomic root input"),
  );
  return {
    projection,
    plan,
    parentDocumentHash: documentStructuralHash(parentDocument),
    parentTruthDigest: canonicalDigest(parentDocument.truth),
    rows: requireRows(
      ownData(unsafeInput, "rootRows", "Prefix-50 Step-50 atomic root input"),
      projection,
      gauge,
      plan,
    ),
    budget: requireBudget(ownData(unsafeInput, "budget", "Prefix-50 Step-50 atomic root input")),
  };
}
