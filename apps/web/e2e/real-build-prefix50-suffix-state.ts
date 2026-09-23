import {
  canonicalDigest,
  deepFreeze,
  documentStructuralHash,
  validateBrickDocument,
} from "@lego-studio/brick-kernel";
import type { BrickDocumentV1, ConnectionEdge } from "@lego-studio/protocol";

import {
  requireRealBuildPrefix50SuffixSubBuildPlan,
  type RealBuildPrefix50SameStepReturnGroup,
  type RealBuildPrefix50SuffixSubBuildPlan,
} from "./real-build-prefix50-suffix-subbuild-plan";

const INCOMPLETE_VALIDATION_CODES = new Set([
  "COLLISION_COMPARISON_BUDGET_EXCEEDED",
  "COLLISION_FINDING_BUDGET_EXCEEDED",
  "VALIDATION_ISSUE_BUDGET_EXCEEDED",
]);
const SAME_STEP_RETURN_STEPS = new Map<46 | 47 | 48 | 49, number>([
  [46, 288],
  [47, 292],
  [48, 298],
  [49, 311],
]);

export interface RealBuildPrefix50OrdinalPartRow {
  readonly ordinal: number;
  readonly partId: string;
}

export function realBuildPrefix50OrdinalPartRowsThrough(
  partIdByOccurrenceOrdinal: ReadonlyMap<number, string>,
  count: number,
): readonly RealBuildPrefix50OrdinalPartRow[] {
  return deepFreeze(
    Array.from({ length: count }, (_, index) => {
      const ordinal = index + 1;
      const partId = partIdByOccurrenceOrdinal.get(ordinal);
      if (partId === undefined) {
        throw new TypeError(`Prefix-50 suffix state lost occurrence ${ordinal} part membership.`);
      }
      return { ordinal, partId };
    }),
  );
}

export interface RealBuildPrefix50SameStepReturnState {
  readonly schemaVersion: "lego.real-build-prefix50-same-step-return-state/1";
  readonly authority: "none";
  readonly completedPrintedStep: 46 | 47 | 48 | 49;
  readonly planCommitment: `sha256:${string}`;
  readonly documentHash: `sha256:${string}`;
  readonly partCount: number;
  readonly connectionCount: number;
  readonly hardValid: true;
  readonly groups: readonly {
    readonly sourceSubBuildPath: readonly [string, string];
    readonly occurrenceOrdinals: readonly number[];
    readonly childPartIds: readonly string[];
    readonly internalConnectionIds: readonly string[];
    readonly integrationConnectionIds: readonly string[];
  }[];
  readonly commitment: `sha256:${string}`;
}

export type RealBuildPrefix50SameStepReturnStates = readonly [
  RealBuildPrefix50SameStepReturnState,
  RealBuildPrefix50SameStepReturnState,
  RealBuildPrefix50SameStepReturnState,
  RealBuildPrefix50SameStepReturnState,
];

export interface RealBuildPrefix50TerminalDetachedState {
  readonly schemaVersion: "lego.real-build-prefix50-terminal-detached-state/1";
  readonly authority: "none";
  readonly completionAuthority: false;
  readonly completedPrintedStep: 50;
  readonly exactBoundary: "printed-steps-1-through-50-only";
  readonly step51Inspected: false;
  readonly planCommitment: `sha256:${string}`;
  readonly combinedDocumentHash: `sha256:${string}`;
  readonly parentDocumentHash: `sha256:${string}`;
  readonly childDocumentHash: `sha256:${string}`;
  readonly combinedPartCount: 320;
  readonly parentPartCount: 311;
  readonly childPartCount: 9;
  readonly childOccurrenceOrdinals: readonly [312, 313, 314, 315, 316, 317, 318, 319, 320];
  readonly childPartIds: readonly string[];
  readonly combinedBlockingCodes: readonly ["DISCONNECTED_ASSEMBLY"];
  readonly crossComponentConnectionCount: 0;
  readonly parentDocument: BrickDocumentV1;
  readonly childDocument: BrickDocumentV1;
  readonly commitment: `sha256:${string}`;
}

const sameStepStates = new WeakSet<object>();
const terminalStates = new WeakSet<object>();
const SAFE_ADD = WeakSet.prototype.add;
const SAFE_HAS = WeakSet.prototype.has;
const SAFE_APPLY = Reflect.apply;

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

function snapshotOrdinalRows(
  value: unknown,
  expectedCount: number,
  document: BrickDocumentV1,
): readonly RealBuildPrefix50OrdinalPartRow[] {
  if (!Array.isArray(value) || value.length !== expectedCount) {
    throw new TypeError(
      `Prefix-50 suffix state requires exactly ${expectedCount} ordinal-to-part rows.`,
    );
  }
  const rows = value.map((unsafeRow, index) => {
    const label = `Prefix-50 suffix ordinal row[${index}]`;
    exactKeys(unsafeRow, ["ordinal", "partId"], label);
    const ordinal = ownData(unsafeRow, "ordinal", label);
    const partId = ownData(unsafeRow, "partId", label);
    if (
      ordinal !== index + 1 ||
      typeof partId !== "string" ||
      partId.length < 1 ||
      partId.length > 128
    ) {
      throw new TypeError(`${label} must retain exact ordinal ${index + 1} and a bounded part ID.`);
    }
    return deepFreeze({ ordinal, partId });
  });
  const rowIds = rows.map(({ partId }) => partId);
  const documentIds = document.parts.map(({ id }) => id);
  if (
    new Set(rowIds).size !== expectedCount ||
    new Set(documentIds).size !== expectedCount ||
    documentIds.some((partId) => !rowIds.includes(partId))
  ) {
    throw new TypeError(
      "Prefix-50 suffix ordinal rows must bijectively name every compiled document part.",
    );
  }
  return deepFreeze(rows);
}

function blockingCodes(report: ReturnType<typeof validateBrickDocument>): readonly string[] {
  return [
    ...new Set(
      report.issues.filter(({ severity }) => severity === "blocking").map(({ code }) => code),
    ),
  ].sort();
}

function requireCompleteHardValidity(document: BrickDocumentV1, label: string): void {
  const report = validateBrickDocument(document);
  const incomplete = report.issues.filter(({ code }) => INCOMPLETE_VALIDATION_CODES.has(code));
  const blocking = report.issues.filter(({ severity }) => severity === "blocking");
  if (
    incomplete.length !== 0 ||
    blocking.length !== 0 ||
    !report.documentGloballyValid ||
    report.targetDocumentHash !== documentStructuralHash(document)
  ) {
    throw new TypeError(
      `${label} must be completely hard-valid; incomplete/blocking=${incomplete.map(({ code }) => code).join("+") || "none"}/${blocking.map(({ code }) => code).join("+") || "none"}.`,
    );
  }
}

function isConnected(partIds: readonly string[], connections: readonly ConnectionEdge[]): boolean {
  if (partIds.length === 0) return false;
  const allowed = new Set(partIds);
  const adjacent = new Map(partIds.map((partId) => [partId, new Set<string>()]));
  for (const { a, b } of connections) {
    if (!allowed.has(a.partId) || !allowed.has(b.partId)) continue;
    adjacent.get(a.partId)!.add(b.partId);
    adjacent.get(b.partId)!.add(a.partId);
  }
  const visited = new Set([partIds[0]!]);
  const pending = [partIds[0]!];
  while (pending.length > 0) {
    for (const neighbor of adjacent.get(pending.pop()!) ?? []) {
      if (visited.has(neighbor)) continue;
      visited.add(neighbor);
      pending.push(neighbor);
    }
  }
  return visited.size === partIds.length;
}

function restrictDocument(
  document: BrickDocumentV1,
  includedPartIds: ReadonlySet<string>,
): BrickDocumentV1 {
  const restrict = <T extends { readonly partIds: readonly string[] }>(entry: T): T => ({
    ...entry,
    partIds: entry.partIds.filter((partId) => includedPartIds.has(partId)),
  });
  return deepFreeze({
    ...document,
    parts: document.parts.filter(({ id }) => includedPartIds.has(id)),
    connections: document.connections.filter(
      ({ a, b }) => includedPartIds.has(a.partId) && includedPartIds.has(b.partId),
    ),
    submodels: document.submodels.map(restrict),
    steps: document.steps.map(restrict),
    semanticRegions: document.semanticRegions.map(restrict),
  });
}

function groupsFor(
  plan: RealBuildPrefix50SuffixSubBuildPlan,
  completedPrintedStep: 46 | 47 | 48 | 49,
): readonly RealBuildPrefix50SameStepReturnGroup[] {
  return plan.sameStepReturns.filter((group) => group.printedStepNumber === completedPrintedStep);
}

export function verifyRealBuildPrefix50SameStepReturnState(
  unsafeInput: unknown,
): RealBuildPrefix50SameStepReturnState {
  const label = "Prefix-50 same-step return input";
  exactKeys(unsafeInput, ["completedPrintedStep", "document", "ordinalPartRows", "plan"], label);
  const plan = requireRealBuildPrefix50SuffixSubBuildPlan(ownData(unsafeInput, "plan", label));
  const completedPrintedStep = ownData(unsafeInput, "completedPrintedStep", label);
  if (!SAME_STEP_RETURN_STEPS.has(completedPrintedStep as 46 | 47 | 48 | 49)) {
    throw new TypeError(
      "Prefix-50 same-step return verification is reserved for steps 46 through 49.",
    );
  }
  const step = completedPrintedStep as 46 | 47 | 48 | 49;
  const expectedCount = SAME_STEP_RETURN_STEPS.get(step)!;
  const document = ownData(unsafeInput, "document", label) as BrickDocumentV1;
  if (
    document?.parts?.length !== expectedCount ||
    document?.steps?.length !== step ||
    document.steps.some(({ index }, arrayIndex) => index !== arrayIndex)
  ) {
    throw new TypeError(
      `Prefix-50 same-step return ${step} must retain exactly ${expectedCount} parts and contiguous BuildSteps 1 through ${step}.`,
    );
  }
  const ordinalRows = snapshotOrdinalRows(
    ownData(unsafeInput, "ordinalPartRows", label),
    expectedCount,
    document,
  );
  const partIdByOrdinal = new Map(ordinalRows.map(({ ordinal, partId }) => [ordinal, partId]));
  const groups = groupsFor(plan, step);
  const expectedStepPartIds = groups.flatMap(({ occurrenceOrdinals }) =>
    occurrenceOrdinals.map((ordinal) => partIdByOrdinal.get(ordinal)!),
  );
  const builtStep = document.steps[step - 1]!;
  const expectedStepPartIdSet = new Set(expectedStepPartIds);
  const builtStepPartIdSet = new Set(builtStep.partIds);
  const partById = new Map(document.parts.map((part) => [part.id, part]));
  if (
    builtStep.partIds.length !== expectedStepPartIds.length ||
    builtStepPartIdSet.size !== expectedStepPartIdSet.size ||
    expectedStepPartIds.some((partId) => !builtStepPartIdSet.has(partId)) ||
    builtStep.partIds.some((partId) => !expectedStepPartIdSet.has(partId)) ||
    expectedStepPartIds.some((partId) => partById.get(partId)?.stepId !== builtStep.id)
  ) {
    throw new TypeError(
      `Prefix-50 same-step return ${step} BuildStep must contain exactly its source child occurrence roster.`,
    );
  }
  requireCompleteHardValidity(document, `Prefix-50 same-step return ${step} state`);
  const groupReceipts = groups.map((groupPlan) => {
    const childPartIds = groupPlan.occurrenceOrdinals.map((ordinal) =>
      partIdByOrdinal.get(ordinal)!,
    );
    const childIds = new Set(childPartIds);
    const internalConnectionIds = document.connections
      .filter(({ a, b }) => childIds.has(a.partId) && childIds.has(b.partId))
      .map(({ id }) => id)
      .sort();
    const integrationConnectionIds = document.connections
      .filter(({ a, b }) => childIds.has(a.partId) !== childIds.has(b.partId))
      .map(({ id }) => id)
      .sort();
    if (!isConnected(childPartIds, document.connections) || integrationConnectionIds.length === 0) {
      throw new TypeError(
        `Prefix-50 same-step return ${step} child ${groupPlan.sourceSubBuildPath[1]} must be internally connected and integrated before the BuildStep commits.`,
      );
    }
    return deepFreeze({
      sourceSubBuildPath: groupPlan.sourceSubBuildPath,
      occurrenceOrdinals: groupPlan.occurrenceOrdinals,
      childPartIds,
      internalConnectionIds,
      integrationConnectionIds,
    });
  });
  const body = deepFreeze({
    schemaVersion: "lego.real-build-prefix50-same-step-return-state/1" as const,
    authority: "none" as const,
    completedPrintedStep: step,
    planCommitment: plan.commitment,
    documentHash: documentStructuralHash(document),
    partCount: document.parts.length,
    connectionCount: document.connections.length,
    hardValid: true as const,
    groups: groupReceipts,
  });
  const result = deepFreeze({ ...body, commitment: canonicalDigest(body) });
  SAFE_APPLY(SAFE_ADD, sameStepStates, [result]);
  return result;
}

export function verifyRealBuildPrefix50TerminalDetachedState(
  unsafeInput: unknown,
): RealBuildPrefix50TerminalDetachedState {
  const label = "Prefix-50 terminal detached-state input";
  exactKeys(unsafeInput, ["document", "ordinalPartRows", "plan"], label);
  const plan = requireRealBuildPrefix50SuffixSubBuildPlan(ownData(unsafeInput, "plan", label));
  const document = ownData(unsafeInput, "document", label) as BrickDocumentV1;
  if (
    document?.parts?.length !== 320 ||
    document?.steps?.length !== 50 ||
    document.steps.some(({ index }, arrayIndex) => index !== arrayIndex) ||
    document.steps[43]?.partIds.length !== 0
  ) {
    throw new TypeError(
      "Prefix-50 terminal detached state requires exactly 320 parts, 50 contiguous BuildSteps, a zero-part Step 44, and no Step-51 suffix.",
    );
  }
  const ordinalRows = snapshotOrdinalRows(
    ownData(unsafeInput, "ordinalPartRows", label),
    320,
    document,
  );
  const childOccurrenceOrdinals = plan.terminalDetachedChild.occurrenceOrdinals;
  const childPartIds = childOccurrenceOrdinals.map((ordinal) => ordinalRows[ordinal - 1]!.partId);
  const step50 = document.steps[49]!;
  const childPartIdSet = new Set(childPartIds);
  const step50PartIdSet = new Set(step50.partIds);
  const partById = new Map(document.parts.map((part) => [part.id, part]));
  if (
    step50.partIds.length !== childPartIds.length ||
    step50PartIdSet.size !== childPartIdSet.size ||
    childPartIds.some((partId) => !step50PartIdSet.has(partId)) ||
    step50.partIds.some((partId) => !childPartIdSet.has(partId)) ||
    childPartIds.some((partId) => partById.get(partId)?.stepId !== step50.id)
  ) {
    throw new TypeError(
      "Prefix-50 terminal Step 50 must contain exactly detached child occurrences 312 through 320.",
    );
  }
  const childIds = childPartIdSet;
  const parentIds = new Set(
    document.parts.filter(({ id }) => !childIds.has(id)).map(({ id }) => id),
  );
  const crossConnections = document.connections.filter(
    ({ a, b }) => childIds.has(a.partId) !== childIds.has(b.partId),
  );
  if (parentIds.size !== 311 || childIds.size !== 9 || crossConnections.length !== 0) {
    throw new TypeError(
      "Prefix-50 terminal boundary must preserve a 311-part parent and exact nine-part child with zero invented return edges.",
    );
  }
  const combinedReport = validateBrickDocument(document);
  const combinedCodes = blockingCodes(combinedReport);
  if (
    combinedCodes.length !== 1 ||
    combinedCodes[0] !== "DISCONNECTED_ASSEMBLY" ||
    combinedReport.documentGloballyValid ||
    combinedReport.issues.some(({ code }) => INCOMPLETE_VALIDATION_CODES.has(code)) ||
    combinedReport.targetDocumentHash !== documentStructuralHash(document)
  ) {
    throw new TypeError(
      `Prefix-50 terminal compound state must retain DISCONNECTED_ASSEMBLY as its sole complete blocker; observed ${combinedCodes.join("+") || "none"}.`,
    );
  }
  const parentDocument = restrictDocument(document, parentIds);
  const childDocument = restrictDocument(document, childIds);
  requireCompleteHardValidity(parentDocument, "Prefix-50 terminal parent component");
  requireCompleteHardValidity(childDocument, "Prefix-50 terminal Step-50 child component");
  if (
    !isConnected(
      parentDocument.parts.map(({ id }) => id),
      parentDocument.connections,
    ) ||
    !isConnected(childPartIds, childDocument.connections)
  ) {
    throw new TypeError(
      "Prefix-50 terminal compound state requires exactly two internally connected hard-valid components.",
    );
  }
  const body = deepFreeze({
    schemaVersion: "lego.real-build-prefix50-terminal-detached-state/1" as const,
    authority: "none" as const,
    completionAuthority: false as const,
    completedPrintedStep: 50 as const,
    exactBoundary: "printed-steps-1-through-50-only" as const,
    step51Inspected: false as const,
    planCommitment: plan.commitment,
    combinedDocumentHash: documentStructuralHash(document),
    parentDocumentHash: documentStructuralHash(parentDocument),
    childDocumentHash: documentStructuralHash(childDocument),
    combinedPartCount: 320 as const,
    parentPartCount: 311 as const,
    childPartCount: 9 as const,
    childOccurrenceOrdinals,
    childPartIds: deepFreeze(childPartIds),
    combinedBlockingCodes: ["DISCONNECTED_ASSEMBLY"] as const,
    crossComponentConnectionCount: 0 as const,
    parentDocument,
    childDocument,
  });
  const result = deepFreeze({ ...body, commitment: canonicalDigest(body) });
  SAFE_APPLY(SAFE_ADD, terminalStates, [result]);
  return result;
}

export function requireRealBuildPrefix50SameStepReturnState(
  value: unknown,
): RealBuildPrefix50SameStepReturnState {
  if (
    value === null ||
    typeof value !== "object" ||
    !SAFE_APPLY(SAFE_HAS, sameStepStates, [value])
  ) {
    throw new TypeError("Prefix-50 same-step return state requires its exact runtime brand.");
  }
  return value as RealBuildPrefix50SameStepReturnState;
}

export function requireRealBuildPrefix50TerminalDetachedState(
  value: unknown,
): RealBuildPrefix50TerminalDetachedState {
  if (
    value === null ||
    typeof value !== "object" ||
    !SAFE_APPLY(SAFE_HAS, terminalStates, [value])
  ) {
    throw new TypeError("Prefix-50 terminal detached state requires its exact runtime brand.");
  }
  return value as RealBuildPrefix50TerminalDetachedState;
}
