import { canonicalDigest } from "@lego-studio/brick-kernel";
import type { BrickDocumentV1 } from "@lego-studio/protocol";

import type {
  RealBuildPrefix50SearchBudget,
  RealBuildPrefix50TargetOccurrence,
} from "./real-build-prefix50-exact-compiler-contract";
import { ownData, sameTransform } from "./real-build-prefix50-exact-compiler-foundation";
import {
  requireRealBuildPrefix50VerifiedProjectionValue,
  type RealBuildPrefix50ChildSubBuildWindow,
  type RealBuildPrefix50VerifiedProjection,
} from "./real-build-prefix50-projection";

export const REAL_BUILD_PREFIX50_SUBBUILD_ROOT_ORDINALS = [258, 259] as const;
const EXPECTED_CHILD_PATH = [
  "7004cf0d-d97f-4b0d-8572-970e23815c05",
  "2956f76b-0e29-497c-84ae-d8bd9099aa3f",
] as const;
const EXPECTED_ROOTS = [
  {
    ordinal: 258,
    catalogPartId: "builtin:plate-1x2-round-end",
    printedStepNumber: 38,
    phaseSequence: 64,
    phaseMemberOrdinal: 1,
    targetTransform: {
      positionLdu: [-120, -86, 108] as const,
      orientationId: "proper-m-00nn000p0",
    },
  },
  {
    ordinal: 259,
    catalogPartId: "builtin:plate-1x12",
    printedStepNumber: 38,
    phaseSequence: 64,
    phaseMemberOrdinal: 2,
    targetTransform: {
      positionLdu: [-220, -86, 116] as const,
      orientationId: "proper-m-00nn000p0",
    },
  },
] as const;

export interface RealBuildPrefix50SubBuildRootInput {
  readonly projection: RealBuildPrefix50VerifiedProjection;
  readonly window: RealBuildPrefix50ChildSubBuildWindow;
  readonly parentDraft: BrickDocumentV1;
  readonly rootRows: readonly [
    RealBuildPrefix50TargetOccurrence,
    RealBuildPrefix50TargetOccurrence,
  ];
  readonly budget: RealBuildPrefix50SearchBudget;
}

export interface RealBuildPrefix50ValidatedSubBuildRootInput {
  readonly projection: RealBuildPrefix50VerifiedProjection;
  readonly window: RealBuildPrefix50ChildSubBuildWindow;
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

function samePath(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function requireExactWindow(
  projection: RealBuildPrefix50VerifiedProjection,
  unsafeWindow: unknown,
): RealBuildPrefix50ChildSubBuildWindow {
  const window = projection.childSubBuildWindow;
  if (
    window === null ||
    unsafeWindow !== window ||
    window.schemaVersion !== "lego.real-build-prefix50-child-subbuild-window/1" ||
    window.firstOccurrenceOrdinal !== 258 ||
    window.lastOccurrenceOrdinal !== 280 ||
    window.entryPrintedStepNumber !== 38 ||
    window.lastPhysicalPrintedStepNumber !== 43 ||
    window.returnPrintedStepNumber !== 44 ||
    window.precedingPhaseSequence !== 71 ||
    window.followingPhaseSequence !== 72 ||
    window.childSubBuildUuid !== EXPECTED_CHILD_PATH[1] ||
    !samePath(window.childSubBuildPath, EXPECTED_CHILD_PATH) ||
    window.sourceBuilderIdentityOrdinals.length !== 23 ||
    window.sourceBuilderIdentityOrdinals.some((ordinal, index) => ordinal !== index + 258)
  ) {
    throw new TypeError(
      "Prefix-50 atomic SubBuild root requires the exact branded 258..280 step-38-entry/step-44-return child window.",
    );
  }
  return window;
}

function requireExactRows(
  projection: RealBuildPrefix50VerifiedProjection,
  unsafeRows: unknown,
): readonly [RealBuildPrefix50TargetOccurrence, RealBuildPrefix50TargetOccurrence] {
  if (!Array.isArray(unsafeRows) || unsafeRows.length !== 2) {
    throw new TypeError(
      "Prefix-50 atomic SubBuild root requires exactly two source-order target rows and no third body.",
    );
  }
  const rows = unsafeRows as unknown as readonly [
    RealBuildPrefix50TargetOccurrence,
    RealBuildPrefix50TargetOccurrence,
  ];
  for (const [index, row] of rows.entries()) {
    const expected = EXPECTED_ROOTS[index]!;
    const source = projection.occurrences[expected.ordinal - 1]!;
    const label = `Prefix-50 atomic SubBuild root row ${index}`;
    exactKeys(
      row,
      [
        "colorId",
        "ordinal",
        "partIdentity",
        "phaseMemberOrdinal",
        "phaseSequence",
        "printedStepNumber",
        "sourceWorldTransform",
        "subBuildPath",
        "targetTransform",
      ],
      label,
    );
    const target = ownData(row, "targetTransform", label);
    exactKeys(target, ["orientationId", "positionLdu"], `${label}.targetTransform`);
    const targetPosition = ownData(target, "positionLdu", `${label}.targetTransform`);
    if (
      !Array.isArray(targetPosition) ||
      targetPosition.length !== 3 ||
      !targetPosition.every((coordinate) => Number.isSafeInteger(coordinate)) ||
      row.ordinal !== expected.ordinal ||
      row.printedStepNumber !== expected.printedStepNumber ||
      row.phaseSequence !== expected.phaseSequence ||
      row.phaseMemberOrdinal !== expected.phaseMemberOrdinal ||
      row.partIdentity.reconciledCatalogPartId !== expected.catalogPartId ||
      row.partIdentity !== source.partIdentity ||
      row.sourceWorldTransform !== source.sourceWorldTransform ||
      row.subBuildPath !== source.subBuildPath ||
      !samePath(row.subBuildPath, EXPECTED_CHILD_PATH) ||
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
      !sameTransform(
        target as RealBuildPrefix50TargetOccurrence["targetTransform"],
        expected.targetTransform,
      )
    ) {
      throw new TypeError(
        `Prefix-50 atomic SubBuild root row ${index} must be exact source ordinal ${expected.ordinal} with its verified step, phase, path, identity, and target pose.`,
      );
    }
  }
  return rows;
}

function requireBudget(value: unknown): RealBuildPrefix50SearchBudget {
  exactKeys(
    value,
    ["enumerations", "nodes", "orientationNarrowedEnumerations", "targetAttempts"],
    "Prefix-50 atomic SubBuild root search accounting",
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
      "Prefix-50 atomic SubBuild root requires the shared bounded search accounting object.",
    );
  }
  return budget;
}

export function requireRealBuildPrefix50SubBuildRootInput(
  unsafeInput: RealBuildPrefix50SubBuildRootInput,
): RealBuildPrefix50ValidatedSubBuildRootInput {
  exactKeys(
    unsafeInput,
    ["budget", "parentDraft", "projection", "rootRows", "window"],
    "Prefix-50 atomic SubBuild root input",
  );
  const projection = requireRealBuildPrefix50VerifiedProjectionValue(
    ownData(
      unsafeInput,
      "projection",
      "Prefix-50 atomic SubBuild root input",
    ) as RealBuildPrefix50VerifiedProjection,
  );
  if (projection.sourceSetId !== "6651557") {
    throw new TypeError(
      "Prefix-50 atomic SubBuild root is scoped only to exact source set 6651557.",
    );
  }
  const parentDraft = ownData(
    unsafeInput,
    "parentDraft",
    "Prefix-50 atomic SubBuild root input",
  ) as BrickDocumentV1;
  return {
    projection,
    window: requireExactWindow(
      projection,
      ownData(unsafeInput, "window", "Prefix-50 atomic SubBuild root input"),
    ),
    parentTruthDigest: canonicalDigest(
      ownData(parentDraft, "truth", "Prefix-50 atomic SubBuild root parent draft"),
    ),
    rows: requireExactRows(
      projection,
      ownData(unsafeInput, "rootRows", "Prefix-50 atomic SubBuild root input"),
    ),
    budget: requireBudget(ownData(unsafeInput, "budget", "Prefix-50 atomic SubBuild root input")),
  };
}
