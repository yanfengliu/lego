import { canonicalDigest, deepFreeze } from "@lego-studio/brick-kernel";

import {
  realBuildPrefix50ProjectionCommitment,
  requireRealBuildPrefix50VerifiedProjectionValue,
  type RealBuildPrefix50ProjectionOccurrence,
  type RealBuildPrefix50VerifiedProjection,
} from "./real-build-prefix50-projection";
import {
  REAL_BUILD_PREFIX50_SUFFIX_PANEL_FIXTURE,
  REAL_BUILD_PREFIX50_SUFFIX_PANEL_FIXTURE_COMMITMENT,
} from "./real-build-prefix50-suffix-panel-fixture";

const ROOT_PATH = "7004cf0d-d97f-4b0d-8572-970e23815c05";
const STEP46_CHILD_A = "f5152801-059e-4801-90ff-2c359130a6cd";
const STEP46_CHILD_B = "5966e599-1648-4263-aea4-abee33332a02";
const STEP47_CHILD = "477fcb23-f71d-4dc4-8211-432ee1b48b77";
const STEP48_CHILD = "362eace5-3968-4dce-bdb5-fa56052d308a";
const STEP49_CHILD = "29b61345-1b4e-4c15-b756-3976a152055f";
const STEP50_CHILD = "91f6c994-aa46-4bc3-8468-a85c54eb7a8a";

interface ExpectedSuffixRow {
  readonly ordinal: number;
  readonly printedStepNumber: number;
  readonly phaseSequence: number;
  readonly phaseMemberOrdinal: number;
  readonly subBuildPath: readonly string[];
}

function rows(
  printedStepNumber: number,
  path: readonly string[],
  phases: readonly (readonly [phaseSequence: number, memberCount: number])[],
  firstOrdinal: number,
): readonly ExpectedSuffixRow[] {
  const result: ExpectedSuffixRow[] = [];
  let ordinal = firstOrdinal;
  for (const [phaseSequence, memberCount] of phases) {
    for (let member = 1; member <= memberCount; member += 1) {
      result.push({
        ordinal,
        printedStepNumber,
        phaseSequence,
        phaseMemberOrdinal: member,
        subBuildPath: path,
      });
      ordinal += 1;
    }
  }
  return result;
}

export const REAL_BUILD_PREFIX50_SUFFIX_SOURCE_ROWS = deepFreeze([
  ...rows(45, [ROOT_PATH], [[72, 3]], 281),
  ...rows(46, [ROOT_PATH, STEP46_CHILD_A], [[73, 2]], 284),
  ...rows(
    46,
    [ROOT_PATH, STEP46_CHILD_B],
    [
      [74, 2],
      [75, 1],
    ],
    286,
  ),
  ...rows(
    47,
    [ROOT_PATH, STEP47_CHILD],
    [
      [76, 2],
      [77, 1],
      [78, 1],
    ],
    289,
  ),
  ...rows(
    48,
    [ROOT_PATH, STEP48_CHILD],
    [
      [79, 2],
      [80, 1],
      [81, 2],
      [82, 1],
    ],
    293,
  ),
  ...rows(
    49,
    [ROOT_PATH, STEP49_CHILD],
    [
      [83, 2],
      [84, 1],
      [85, 3],
      [86, 1],
      [87, 2],
      [88, 2],
      [89, 2],
    ],
    299,
  ),
  ...rows(
    50,
    [ROOT_PATH, STEP50_CHILD],
    [
      [90, 2],
      [91, 1],
      [92, 2],
      [93, 1],
      [94, 2],
      [95, 1],
    ],
    312,
  ),
]);

export interface RealBuildPrefix50SameStepReturnGroup {
  readonly printedStepNumber: 46 | 47 | 48 | 49;
  readonly sourceSubBuildPath: readonly [string, string];
  readonly sourcePhaseSequences: readonly number[];
  readonly occurrenceOrdinals: readonly number[];
  readonly requiredEndState: "hard-valid-connected-to-completed-prefix-before-step-commit";
}

export interface RealBuildPrefix50SuffixSubBuildPlan {
  readonly schemaVersion: "lego.real-build-prefix50-suffix-subbuild-plan/1";
  readonly authority: "none";
  readonly sourceSetId: "6651557";
  readonly exactPrintedStepBoundary: readonly [45, 50];
  readonly projectionCommitment: `sha256:${string}`;
  readonly panelFixtureCommitment: `sha256:${string}`;
  readonly rootDirectStep: {
    readonly printedStepNumber: 45;
    readonly sourceSubBuildPath: readonly [string];
    readonly occurrenceOrdinals: readonly [281, 282, 283];
  };
  readonly sameStepReturns: readonly RealBuildPrefix50SameStepReturnGroup[];
  readonly terminalDetachedChild: {
    readonly printedStepNumber: 50;
    readonly sourceSubBuildPath: readonly [string, string];
    readonly sourcePhaseSequences: readonly [90, 91, 92, 93, 94, 95];
    readonly occurrenceOrdinals: readonly [312, 313, 314, 315, 316, 317, 318, 319, 320];
    readonly requiredEndState: "internally-hard-valid-detached-child";
    readonly returnObservedWithinExactPrefix: false;
    readonly step51Inspected: false;
  };
  readonly commitment: `sha256:${string}`;
}

const plans = new WeakSet<object>();
const SAFE_ADD = WeakSet.prototype.add;
const SAFE_HAS = WeakSet.prototype.has;
const SAFE_APPLY = Reflect.apply;

function samePath(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((entry, index) => entry === right[index]);
}

function requireExactSuffixRow(
  occurrence: RealBuildPrefix50ProjectionOccurrence | undefined,
  expected: ExpectedSuffixRow,
): void {
  if (
    occurrence?.ordinal !== expected.ordinal ||
    occurrence.printedStepNumber !== expected.printedStepNumber ||
    occurrence.phaseSequence !== expected.phaseSequence ||
    occurrence.phaseMemberOrdinal !== expected.phaseMemberOrdinal ||
    !samePath(occurrence.subBuildPath, expected.subBuildPath)
  ) {
    throw new TypeError(
      `Prefix-50 suffix occurrence ${expected.ordinal} must retain exact printed-step, phase/member, and source SubBuild path semantics.`,
    );
  }
}

function group(
  printedStepNumber: 46 | 47 | 48 | 49,
  childPath: string,
  phaseSequences: readonly number[],
  occurrenceOrdinals: readonly number[],
): RealBuildPrefix50SameStepReturnGroup {
  return deepFreeze({
    printedStepNumber,
    sourceSubBuildPath: [ROOT_PATH, childPath] as const,
    sourcePhaseSequences: phaseSequences,
    occurrenceOrdinals,
    requiredEndState: "hard-valid-connected-to-completed-prefix-before-step-commit" as const,
  });
}

export function deriveRealBuildPrefix50SuffixSubBuildPlan(
  projectionValue: RealBuildPrefix50VerifiedProjection,
): RealBuildPrefix50SuffixSubBuildPlan {
  const projection = requireRealBuildPrefix50VerifiedProjectionValue(projectionValue);
  if (
    projection.sourceSetId !== REAL_BUILD_PREFIX50_SUFFIX_PANEL_FIXTURE.sourceSetId ||
    projection.occurrences.length !== 320 ||
    projection.steps.length !== 50
  ) {
    throw new TypeError(
      "Prefix-50 suffix planning requires the exact set-6651557 projection bounded to steps 1 through 50 and ordinals 1 through 320.",
    );
  }
  for (const expected of REAL_BUILD_PREFIX50_SUFFIX_SOURCE_ROWS) {
    requireExactSuffixRow(projection.occurrences[expected.ordinal - 1], expected);
  }
  const body = deepFreeze({
    schemaVersion: "lego.real-build-prefix50-suffix-subbuild-plan/1" as const,
    authority: "none" as const,
    sourceSetId: "6651557" as const,
    exactPrintedStepBoundary: [45, 50] as const,
    projectionCommitment: realBuildPrefix50ProjectionCommitment(projection),
    panelFixtureCommitment: REAL_BUILD_PREFIX50_SUFFIX_PANEL_FIXTURE_COMMITMENT,
    rootDirectStep: {
      printedStepNumber: 45 as const,
      sourceSubBuildPath: [ROOT_PATH] as const,
      occurrenceOrdinals: [281, 282, 283] as const,
    },
    sameStepReturns: [
      group(46, STEP46_CHILD_A, [73], [284, 285]),
      group(46, STEP46_CHILD_B, [74, 75], [286, 287, 288]),
      group(47, STEP47_CHILD, [76, 77, 78], [289, 290, 291, 292]),
      group(48, STEP48_CHILD, [79, 80, 81, 82], [293, 294, 295, 296, 297, 298]),
      group(
        49,
        STEP49_CHILD,
        [83, 84, 85, 86, 87, 88, 89],
        [299, 300, 301, 302, 303, 304, 305, 306, 307, 308, 309, 310, 311],
      ),
    ],
    terminalDetachedChild: {
      printedStepNumber: 50 as const,
      sourceSubBuildPath: [ROOT_PATH, STEP50_CHILD] as const,
      sourcePhaseSequences: [90, 91, 92, 93, 94, 95] as const,
      occurrenceOrdinals: [312, 313, 314, 315, 316, 317, 318, 319, 320] as const,
      requiredEndState: "internally-hard-valid-detached-child" as const,
      returnObservedWithinExactPrefix: false as const,
      step51Inspected: false as const,
    },
  });
  const result = deepFreeze({ ...body, commitment: canonicalDigest(body) });
  SAFE_APPLY(SAFE_ADD, plans, [result]);
  return result;
}

export function requireRealBuildPrefix50SuffixSubBuildPlan(
  value: unknown,
): RealBuildPrefix50SuffixSubBuildPlan {
  if (value === null || typeof value !== "object" || !SAFE_APPLY(SAFE_HAS, plans, [value])) {
    throw new TypeError(
      "Prefix-50 suffix compilation requires the exact runtime-branded plan; caller clones cannot classify same-step returns or the detached Step-50 boundary.",
    );
  }
  return value as RealBuildPrefix50SuffixSubBuildPlan;
}
