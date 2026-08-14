import { createHash } from "node:crypto";

import {
  CALLOUT_RECOVERY_FIXTURE,
  FULL_BOOKLET_CALLOUT_ACCOUNTING,
  FULL_BOOKLET_CALLOUT_SOURCE_CLOSURE,
  FULL_BOOKLET_STEP_PAGES,
} from "./callout-recovery-fixture";
import type { CalloutManifest } from "./callout-types";

const ARRAY_IS_ARRAY = Array.isArray;
const NUMBER_IS_FINITE = Number.isFinite;
const NUMBER_IS_SAFE_INTEGER = Number.isSafeInteger;
const NUMBER_TO_FIXED = Number.prototype.toFixed;
const OBJECT_HAS_OWN = Object.hasOwn;
const REFLECT_APPLY = Reflect.apply;
const REFLECT_OWN_KEYS = Reflect.ownKeys;
const FULL_ACCOUNTING_KEYS = [
  "rawNxIdentityCount",
  "rawNxQuantityTotal",
  "physicalPartArtIdentityCount",
  "physicalPartArtQuantityTotal",
  "semanticIdentityCount",
  "semanticQuantityTotal",
] as const;

export interface CalloutManifestClosureInput {
  readonly pointerFile: "manifest.json" | "manifest.partial.json";
  readonly runId: string;
  readonly manifest: CalloutManifest;
}

function sha256(text: string): string {
  return `sha256:${createHash("sha256").update(text).digest("hex")}`;
}

function validPartialPageSelection(
  value: unknown,
  calloutPages: readonly number[],
): value is number[] {
  if (
    !ARRAY_IS_ARRAY(value) ||
    value.length < 1 ||
    value.length > FULL_BOOKLET_CALLOUT_SOURCE_CLOSURE.pagesCropped
  )
    return false;
  let calloutIndex = 0;
  for (let index = 0; index < value.length; index += 1) {
    if (!OBJECT_HAS_OWN(value, index)) return false;
    const page = value[index];
    if (
      !NUMBER_IS_SAFE_INTEGER(page) ||
      page < 1 ||
      page > 10_000 ||
      (index > 0 && value[index - 1]! >= page)
    )
      return false;
    let sourcePage = false;
    for (let sourceIndex = 0; sourceIndex < FULL_BOOKLET_STEP_PAGES.length; sourceIndex += 1) {
      if (FULL_BOOKLET_STEP_PAGES[sourceIndex] === page) {
        sourcePage = true;
        break;
      }
    }
    if (!sourcePage) return false;
    while (calloutPages[calloutIndex] !== undefined && calloutPages[calloutIndex]! < page)
      return false;
    if (calloutPages[calloutIndex] === page) calloutIndex += 1;
  }
  return calloutIndex === calloutPages.length;
}

function exactRecord(observed: unknown, expected: Readonly<Record<string, unknown>>): boolean {
  if (observed === null || typeof observed !== "object" || ARRAY_IS_ARRAY(observed)) return false;
  const observedKeys = REFLECT_OWN_KEYS(observed);
  const expectedKeys = REFLECT_OWN_KEYS(expected);
  if (observedKeys.length !== expectedKeys.length) return false;
  for (let index = 0; index < expectedKeys.length; index += 1) {
    const key = expectedKeys[index]!;
    if (
      typeof key !== "string" ||
      !OBJECT_HAS_OWN(observed, key) ||
      (observed as Record<string, unknown>)[key] !== expected[key]
    )
      return false;
  }
  return true;
}

function finiteCoordinate(value: unknown): value is number {
  return NUMBER_IS_FINITE(value) && Math.abs(value as number) <= 100_000;
}

function stableIdentity(pageNumber: number, quantity: number, xPt: number, yPt: number): string {
  const x = REFLECT_APPLY(NUMBER_TO_FIXED, xPt, [3]) as string;
  const y = REFLECT_APPLY(NUMBER_TO_FIXED, yPt, [3]) as string;
  return `p${pageNumber}|q${quantity}|x${x}|y${y}`;
}

function fileStem(identity: string): string {
  let result = "";
  for (let index = 0; index < identity.length; index += 1) {
    const character = identity[index]!;
    result += character === "|" ? "-" : character === "." ? "d" : character;
  }
  return result;
}

function insertSortedUnique(values: number[], value: number): void {
  let index = 0;
  while (index < values.length && values[index]! < value) index += 1;
  if (values[index] === value) return;
  for (let shift = values.length; shift > index; shift -= 1) values[shift] = values[shift - 1]!;
  values[index] = value;
}

function sortedStrings(values: readonly string[]): string[] {
  const result: string[] = [];
  for (let source = 0; source < values.length; source += 1) {
    const value = values[source]!;
    let index = 0;
    while (index < result.length && result[index]! <= value) index += 1;
    for (let shift = result.length; shift > index; shift -= 1) result[shift] = result[shift - 1]!;
    result[index] = value;
  }
  return result;
}

function joinedLines(values: readonly string[]): string {
  let result = "";
  for (let index = 0; index < values.length; index += 1) {
    if (index > 0) result += "\n";
    result += values[index]!;
  }
  return result;
}

function append<T>(values: T[], value: T): void {
  values[values.length] = value;
}

function canonicalRecordFailure(
  callout: CalloutManifest["callouts"][number],
  index: number,
  runId: string,
): string | null {
  const box = callout?.box;
  if (typeof callout?.identity !== "string" || typeof box !== "object" || box === null) {
    return `record-${index}-shape`;
  }
  if (
    !NUMBER_IS_SAFE_INTEGER(callout.pageNumber) ||
    callout.pageNumber < 1 ||
    callout.pageNumber > 10_000 ||
    !NUMBER_IS_SAFE_INTEGER(callout.quantity) ||
    callout.quantity < 1 ||
    callout.quantity > 10_000
  ) {
    return `record-${index}-page-or-quantity`;
  }
  if (
    !finiteCoordinate(callout.xPt) ||
    !finiteCoordinate(callout.yPt) ||
    !finiteCoordinate(box.minXPt) ||
    !finiteCoordinate(box.minYPt) ||
    !finiteCoordinate(box.maxXPt) ||
    !finiteCoordinate(box.maxYPt) ||
    box.minXPt >= box.maxXPt ||
    box.minYPt >= box.maxYPt
  ) {
    return `record-${index}-coordinates`;
  }
  const expectedIdentity = stableIdentity(
    callout.pageNumber,
    callout.quantity,
    callout.xPt,
    callout.yPt,
  );
  if (callout.identity !== expectedIdentity) return `record-${index}-identity`;
  if (
    !NUMBER_IS_SAFE_INTEGER(callout.stepNumber) ||
    callout.stepNumber < 1 ||
    callout.stepNumber > 10_000
  ) {
    return `record-${index}-step`;
  }
  if (!NUMBER_IS_FINITE(callout.heightPt) || callout.heightPt <= 0 || callout.heightPt > 100) {
    return `record-${index}-label-height`;
  }
  if (callout.boxMethod !== "vector-smallest" && callout.boxMethod !== "panel-neighbor-cell") {
    return `record-${index}-box-method`;
  }
  const expectedStem = fileStem(callout.identity);
  if (callout.file !== `runs/${runId}/${expectedStem}.png`) return `record-${index}-file`;
  return null;
}

export function assertCalloutManifestClosure(input: CalloutManifestClosureInput): void {
  if (input.pointerFile !== "manifest.json" && input.pointerFile !== "manifest.partial.json") {
    throw new Error(
      "Callout publication pointerFile must be exactly manifest.json or manifest.partial.json before any filesystem work.",
    );
  }
  const { manifest } = input;
  if (
    !ARRAY_IS_ARRAY(manifest.callouts) ||
    manifest.callouts.length < 1 ||
    manifest.callouts.length > 2_000
  ) {
    throw new Error(
      "Callout manifest closure must contain 1..2000 snapshotted callout records before sorting or aggregation.",
    );
  }
  const quantityOf = (callout: CalloutManifest["callouts"][number]): number =>
    NUMBER_IS_SAFE_INTEGER(callout?.quantity) ? callout.quantity : 0;
  const calloutPages: number[] = [];
  const identities: string[] = [];
  let rawQuantity = 0;
  let physicalIdentityCount = 0;
  let physicalQuantity = 0;
  let semanticIdentityCount = 0;
  let semanticQuantity = 0;
  let recordFailure: string | null = null;
  let identityLengthInvalid = false;
  for (let index = 0; index < manifest.callouts.length; index += 1) {
    const callout = manifest.callouts[index]!;
    if (NUMBER_IS_SAFE_INTEGER(callout?.pageNumber))
      insertSortedUnique(calloutPages, callout.pageNumber);
    const identity = typeof callout?.identity === "string" ? callout.identity : "";
    identities[index] = identity;
    if (identity.length < 1 || identity.length > 96) identityLengthInvalid = true;
    const quantity = quantityOf(callout);
    rawQuantity += quantity;
    if (callout?.evidenceKind === "part-art") {
      physicalIdentityCount += 1;
      physicalQuantity += quantity;
    } else {
      semanticIdentityCount += 1;
      semanticQuantity += quantity;
    }
    if (recordFailure === null) recordFailure = canonicalRecordFailure(callout, index, input.runId);
  }
  const accounting = {
    rawNxIdentityCount: manifest.callouts.length,
    rawNxQuantityTotal: rawQuantity,
    physicalPartArtIdentityCount: physicalIdentityCount,
    physicalPartArtQuantityTotal: physicalQuantity,
    semanticIdentityCount,
    semanticQuantityTotal: semanticQuantity,
  };
  const sortedIdentities = sortedStrings(identities);
  const identitySetSha256 = sha256(joinedLines(sortedIdentities));
  const conservation = {
    expectedIdentityCount: identities.length,
    expectedRawNxQuantityTotal: rawQuantity,
    expectedIdentitySetSha256: identitySetSha256,
    publishedIdentityCount: identities.length,
    publishedRawNxQuantityTotal: rawQuantity,
    publishedIdentitySetSha256: identitySetSha256,
  };
  const failures: string[] = [];
  if (manifest.schemaVersion !== "lego.callout-thumbnails/6") append(failures, "schema");
  if (manifest.sourceHash !== CALLOUT_RECOVERY_FIXTURE.sourceHash) append(failures, "source-hash");
  const selectionIsValid =
    input.pointerFile === "manifest.json"
      ? manifest.pageSelection === "full booklet"
      : validPartialPageSelection(manifest.pageSelection, calloutPages);
  if (!selectionIsValid) append(failures, "page-selection");
  if (input.pointerFile === "manifest.json") {
    if (manifest.pagesCropped !== FULL_BOOKLET_CALLOUT_SOURCE_CLOSURE.pagesCropped)
      append(failures, "full-pages");
    if (identities.length !== FULL_BOOKLET_CALLOUT_ACCOUNTING.rawNxIdentityCount)
      append(failures, "full-identity-count");
    if (rawQuantity !== FULL_BOOKLET_CALLOUT_ACCOUNTING.rawNxQuantityTotal)
      append(failures, "full-quantity");
    if (identitySetSha256 !== FULL_BOOKLET_CALLOUT_SOURCE_CLOSURE.identitySetSha256)
      append(failures, "full-identity-set");
    for (let index = 0; index < FULL_ACCOUNTING_KEYS.length; index += 1) {
      const key = FULL_ACCOUNTING_KEYS[index]!;
      if (accounting[key] !== FULL_BOOKLET_CALLOUT_ACCOUNTING[key]) append(failures, `full-${key}`);
    }
  }
  if (recordFailure) append(failures, recordFailure);
  const expectedPageCount =
    input.pointerFile === "manifest.json"
      ? FULL_BOOKLET_CALLOUT_SOURCE_CLOSURE.pagesCropped
      : ARRAY_IS_ARRAY(manifest.pageSelection)
        ? manifest.pageSelection.length
        : -1;
  if (!NUMBER_IS_SAFE_INTEGER(manifest.pagesCropped) || manifest.pagesCropped !== expectedPageCount)
    append(failures, "page-count");
  if (identityLengthInvalid) append(failures, "identity-length");
  let duplicateIdentities = false;
  for (let index = 1; index < sortedIdentities.length; index += 1) {
    if (sortedIdentities[index - 1] === sortedIdentities[index]) {
      duplicateIdentities = true;
      break;
    }
  }
  if (duplicateIdentities) append(failures, "duplicate-identities");
  if (!exactRecord(manifest.accounting, accounting)) append(failures, "accounting");
  if (!exactRecord(manifest.conservation, conservation)) append(failures, "conservation");
  if (failures.length > 0) {
    const shownCount = failures.length < 8 ? failures.length : 8;
    let shown = "";
    for (let index = 0; index < shownCount; index += 1) {
      if (index > 0) shown += ", ";
      shown += failures[index]!;
    }
    const omitted = failures.length - shownCount;
    throw new Error(
      `Callout manifest must be a /6 publication for the pinned PDF whose page selection, unique identities, accounting, and conservation recompute exactly from its bounded callout records; failed checks: ${shown}${omitted > 0 ? `, plus ${omitted} more` : ""}.`,
    );
  }
}
