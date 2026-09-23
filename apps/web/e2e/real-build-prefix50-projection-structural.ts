import { deepFreeze } from "@lego-studio/brick-kernel";

const SHA256 = /^sha256:[0-9a-f]{64}$/u;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;
const EXPECTED_6651557_CHILD_UUID = "2956f76b-0e29-497c-84ae-d8bd9099aa3f";
const EXPECTED_6651557_PARENT_PATH = ["7004cf0d-d97f-4b0d-8572-970e23815c05"] as const;
const EXPECTED_6651557_MEMBER_DIGEST =
  "sha256:4944f0b5ef959fc73471c1dc9bcad76ed7b47aec0f74b76cf2d55a85f7cd725c";

export interface RealBuildPrefix50StructuralMemberCommitment {
  readonly schemaVersion: "lego.part-identification-prefix50-structural-member-commitment/1";
  readonly rows: number;
  readonly bytes: number;
  readonly digest: `sha256:${string}`;
}

export interface RealBuildPrefix50ChildSubBuildWindow {
  readonly schemaVersion: "lego.real-build-prefix50-child-subbuild-window/1";
  readonly sourceStructuralEventSequence: number;
  readonly sourceStructuralEventDigest: `sha256:${string}`;
  readonly parentStepUuid: string;
  readonly parentSubBuildPath: readonly string[];
  readonly childSubBuildUuid: string;
  readonly childSubBuildPath: readonly string[];
  readonly entryPrintedStepNumber: number;
  readonly lastPhysicalPrintedStepNumber: number;
  readonly returnPrintedStepNumber: number;
  readonly firstOccurrenceOrdinal: number;
  readonly lastOccurrenceOrdinal: number;
  readonly sourceBuilderIdentityOrdinals: readonly number[];
  readonly precedingPhaseSequence: number;
  readonly followingPhaseSequence: number;
  readonly memberCommitment: RealBuildPrefix50StructuralMemberCommitment;
}

interface StructuralOccurrence {
  readonly ordinal: number;
  readonly printedStepNumber: number;
  readonly phaseSequence: number;
  readonly subBuildPath: readonly string[];
}

function ownData(value: unknown, key: string, label: string): unknown {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${label} must be a data object.`);
  }
  let descriptor: PropertyDescriptor | undefined;
  try {
    descriptor = Object.getOwnPropertyDescriptor(value, key);
  } catch {
    throw new TypeError(`${label}.${key} could not be inspected safely.`);
  }
  if (descriptor === undefined || !descriptor.enumerable || !("value" in descriptor)) {
    throw new TypeError(`${label}.${key} must be an enumerable own data property.`);
  }
  return descriptor.value;
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
  if (keys.length !== wanted.length || keys.some((key, index) => key !== wanted[index])) {
    throw new TypeError(`${label} must contain exactly ${wanted.join(", ")}.`);
  }
}

function positiveInteger(value: unknown, label: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 1) {
    throw new TypeError(`${label} must be a positive safe integer.`);
  }
  return value as number;
}

function digest(value: unknown, label: string): `sha256:${string}` {
  if (typeof value !== "string" || !SHA256.test(value)) {
    throw new TypeError(`${label} must be an exact sha256 digest.`);
  }
  return value as `sha256:${string}`;
}

function uuid(value: unknown, label: string): string {
  if (typeof value !== "string" || !UUID.test(value)) {
    throw new TypeError(`${label} must be one exact source UUID.`);
  }
  return value;
}

function uuidPath(value: unknown, label: string): readonly string[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 8) {
    throw new TypeError(`${label} must contain one through eight source UUIDs.`);
  }
  return deepFreeze(value.map((entry, index) => uuid(entry, `${label}[${index}]`)));
}

function memberCommitment(
  value: unknown,
  expectedRows: number,
  label: string,
): RealBuildPrefix50StructuralMemberCommitment {
  exactKeys(value, ["bytes", "digest", "rows", "schemaVersion"], label);
  const rows = positiveInteger(ownData(value, "rows", label), `${label}.rows`);
  const bytes = positiveInteger(ownData(value, "bytes", label), `${label}.bytes`);
  if (
    ownData(value, "schemaVersion", label) !==
      "lego.part-identification-prefix50-structural-member-commitment/1" ||
    rows !== expectedRows
  ) {
    throw new TypeError(`${label} must bind every projected child member exactly once.`);
  }
  return deepFreeze({
    schemaVersion: "lego.part-identification-prefix50-structural-member-commitment/1" as const,
    rows,
    bytes,
    digest: digest(ownData(value, "digest", label), `${label}.digest`),
  });
}

function samePath(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((entry, index) => entry === right[index]);
}

export function validateRealBuildPrefix50ChildSubBuildWindow(
  value: unknown,
  sourceSetId: string,
  occurrences: readonly StructuralOccurrence[],
  allowSyntheticAbsence = false,
): RealBuildPrefix50ChildSubBuildWindow | null {
  if (value === null) {
    if (sourceSetId === "6651557" && !allowSyntheticAbsence) {
      throw new TypeError(
        "Verified set 6651557 requires its independently verified child-SubBuild window.",
      );
    }
    return null;
  }
  const label = "Verified prefix-50 child-SubBuild window";
  exactKeys(
    value,
    [
      "childSubBuildPath",
      "childSubBuildUuid",
      "entryPrintedStepNumber",
      "firstOccurrenceOrdinal",
      "followingPhaseSequence",
      "lastOccurrenceOrdinal",
      "lastPhysicalPrintedStepNumber",
      "memberCommitment",
      "parentStepUuid",
      "parentSubBuildPath",
      "precedingPhaseSequence",
      "returnPrintedStepNumber",
      "schemaVersion",
      "sourceBuilderIdentityOrdinals",
      "sourceStructuralEventDigest",
      "sourceStructuralEventSequence",
    ],
    label,
  );
  if (
    ownData(value, "schemaVersion", label) !== "lego.real-build-prefix50-child-subbuild-window/1"
  ) {
    throw new TypeError(`${label}.schemaVersion is unsupported.`);
  }
  const parentSubBuildPath = uuidPath(
    ownData(value, "parentSubBuildPath", label),
    `${label}.parentSubBuildPath`,
  );
  const childSubBuildPath = uuidPath(
    ownData(value, "childSubBuildPath", label),
    `${label}.childSubBuildPath`,
  );
  const childSubBuildUuid = uuid(
    ownData(value, "childSubBuildUuid", label),
    `${label}.childSubBuildUuid`,
  );
  if (
    childSubBuildPath.length !== parentSubBuildPath.length + 1 ||
    !samePath(childSubBuildPath.slice(0, -1), parentSubBuildPath) ||
    childSubBuildPath.at(-1) !== childSubBuildUuid
  ) {
    throw new TypeError(`${label} must retain one exact parent-to-child source path.`);
  }
  const firstOccurrenceOrdinal = positiveInteger(
    ownData(value, "firstOccurrenceOrdinal", label),
    `${label}.firstOccurrenceOrdinal`,
  );
  const lastOccurrenceOrdinal = positiveInteger(
    ownData(value, "lastOccurrenceOrdinal", label),
    `${label}.lastOccurrenceOrdinal`,
  );
  const unsafeOrdinals = ownData(value, "sourceBuilderIdentityOrdinals", label);
  if (!Array.isArray(unsafeOrdinals) || unsafeOrdinals.length < 1) {
    throw new TypeError(`${label}.sourceBuilderIdentityOrdinals must not be empty.`);
  }
  const sourceBuilderIdentityOrdinals = unsafeOrdinals.map((ordinal, index) =>
    positiveInteger(ordinal, `${label}.sourceBuilderIdentityOrdinals[${index}]`),
  );
  if (
    sourceBuilderIdentityOrdinals[0] !== firstOccurrenceOrdinal ||
    sourceBuilderIdentityOrdinals.at(-1) !== lastOccurrenceOrdinal ||
    sourceBuilderIdentityOrdinals.some(
      (ordinal, index) => index > 0 && ordinal !== sourceBuilderIdentityOrdinals[index - 1]! + 1,
    )
  ) {
    throw new TypeError(`${label} must bind one contiguous ordered occurrence window.`);
  }
  const entryPrintedStepNumber = positiveInteger(
    ownData(value, "entryPrintedStepNumber", label),
    `${label}.entryPrintedStepNumber`,
  );
  const lastPhysicalPrintedStepNumber = positiveInteger(
    ownData(value, "lastPhysicalPrintedStepNumber", label),
    `${label}.lastPhysicalPrintedStepNumber`,
  );
  const returnPrintedStepNumber = positiveInteger(
    ownData(value, "returnPrintedStepNumber", label),
    `${label}.returnPrintedStepNumber`,
  );
  const precedingPhaseSequence = positiveInteger(
    ownData(value, "precedingPhaseSequence", label),
    `${label}.precedingPhaseSequence`,
  );
  const followingPhaseSequence = positiveInteger(
    ownData(value, "followingPhaseSequence", label),
    `${label}.followingPhaseSequence`,
  );
  const members = sourceBuilderIdentityOrdinals.map((ordinal) => occurrences[ordinal - 1]);
  const allPathMembers = occurrences.filter(({ subBuildPath }) =>
    subBuildPath.includes(childSubBuildUuid),
  );
  if (
    members.some((occurrence, index) => {
      if (occurrence === undefined) return true;
      return (
        occurrence.ordinal !== sourceBuilderIdentityOrdinals[index] ||
        !samePath(occurrence.subBuildPath, childSubBuildPath)
      );
    }) ||
    allPathMembers.length !== members.length ||
    allPathMembers.some((occurrence, index) => occurrence !== members[index]) ||
    members[0]?.printedStepNumber !== entryPrintedStepNumber ||
    members.at(-1)?.printedStepNumber !== lastPhysicalPrintedStepNumber ||
    members.at(-1)?.phaseSequence !== precedingPhaseSequence ||
    occurrences[lastOccurrenceOrdinal]?.printedStepNumber !== returnPrintedStepNumber + 1 ||
    occurrences[lastOccurrenceOrdinal]?.phaseSequence !== followingPhaseSequence ||
    returnPrintedStepNumber !== lastPhysicalPrintedStepNumber + 1
  ) {
    throw new TypeError(
      `${label} contradicts its per-occurrence action phases or return boundary.`,
    );
  }
  const commitment = memberCommitment(
    ownData(value, "memberCommitment", label),
    members.length,
    `${label}.memberCommitment`,
  );
  if (
    sourceSetId === "6651557" &&
    (childSubBuildUuid !== EXPECTED_6651557_CHILD_UUID ||
      !samePath(parentSubBuildPath, EXPECTED_6651557_PARENT_PATH) ||
      firstOccurrenceOrdinal !== 258 ||
      lastOccurrenceOrdinal !== 280 ||
      entryPrintedStepNumber !== 38 ||
      lastPhysicalPrintedStepNumber !== 43 ||
      returnPrintedStepNumber !== 44 ||
      precedingPhaseSequence !== 71 ||
      followingPhaseSequence !== 72 ||
      commitment.rows !== 23 ||
      commitment.bytes !== 2141 ||
      commitment.digest !== EXPECTED_6651557_MEMBER_DIGEST)
  ) {
    throw new TypeError(`${label} is not the exact reviewed set-6651557 source window.`);
  }
  return deepFreeze({
    schemaVersion: "lego.real-build-prefix50-child-subbuild-window/1" as const,
    sourceStructuralEventSequence: positiveInteger(
      ownData(value, "sourceStructuralEventSequence", label),
      `${label}.sourceStructuralEventSequence`,
    ),
    sourceStructuralEventDigest: digest(
      ownData(value, "sourceStructuralEventDigest", label),
      `${label}.sourceStructuralEventDigest`,
    ),
    parentStepUuid: uuid(ownData(value, "parentStepUuid", label), `${label}.parentStepUuid`),
    parentSubBuildPath,
    childSubBuildUuid,
    childSubBuildPath,
    entryPrintedStepNumber,
    lastPhysicalPrintedStepNumber,
    returnPrintedStepNumber,
    firstOccurrenceOrdinal,
    lastOccurrenceOrdinal,
    sourceBuilderIdentityOrdinals: deepFreeze(sourceBuilderIdentityOrdinals),
    precedingPhaseSequence,
    followingPhaseSequence,
    memberCommitment: commitment,
  });
}
