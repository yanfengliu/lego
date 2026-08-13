import { types as nodeTypes } from "node:util";

import {
  STEP_13_ALIGNMENT_INPUT_SCHEMA,
  type AlignmentCallout,
  type AlignmentPhase,
  type AlignmentStep,
  type IdentificationEvidence,
  type Step13AlignmentInput,
} from "./real-build-action-ledger-alignment-types";

export {
  STEP_13_ALIGNMENT_INPUT_SCHEMA,
  type Step13AlignmentInput,
} from "./real-build-action-ledger-alignment-types";

const SHA256 = /^sha256:[0-9a-f]{64}$/u;
const STEP_NUMBERS = [12, 13, 14] as const;
const STEP_QUANTITIES = [1, 3, 3] as const;
const MAX_PHASES = 8;
const MAX_IDENTITIES = 16;
const MAX_CALLOUTS = 8;
const MAX_EVIDENCE_ROWS = 8;
type JsonObject = Record<string, unknown>;

function observed(value: unknown): string {
  if (value === null) return "null";
  switch (typeof value) {
    case "string": {
      const bounded = value.length > 120 ? `${value.slice(0, 120)}...` : value;
      return JSON.stringify(bounded);
    }
    case "number":
    case "boolean":
    case "bigint":
      return String(value);
    case "undefined":
    case "symbol":
    case "function":
    case "object":
      return `<${typeof value}>`;
  }
  return "<unknown>";
}

function object(value: unknown, label: string, keys: readonly string[]): JsonObject {
  if (value === null || typeof value !== "object") {
    throw new TypeError(`${label} must be a plain data object; received ${observed(value)}.`);
  }
  if (nodeTypes.isProxy(value)) {
    throw new TypeError(`${label} is a Proxy; supply one ordinary accessor-free data object.`);
  }
  let descriptors: PropertyDescriptorMap;
  let prototype: object | null;
  try {
    prototype = Object.getPrototypeOf(value) as object | null;
    descriptors = Object.getOwnPropertyDescriptors(value);
  } catch {
    throw new TypeError(`${label} could not be inspected without invoking hostile traps.`);
  }
  if (Array.isArray(value)) {
    throw new TypeError(`${label} is an array; supply one plain data object.`);
  }
  if (prototype !== Object.prototype && prototype !== null) {
    throw new TypeError(`${label} has a custom prototype; supply an Object or null prototype.`);
  }
  const actualKeys = Reflect.ownKeys(descriptors);
  const unexpected = actualKeys.find((key) => typeof key !== "string" || !keys.includes(key));
  if (unexpected !== undefined) {
    throw new TypeError(
      `${label} contains unsupported own field ${typeof unexpected === "symbol" ? unexpected.toString() : JSON.stringify(unexpected)}; expected exactly [${keys.join(", ")}].`,
    );
  }
  const missing = keys.find((key) => descriptors[key] === undefined);
  if (missing !== undefined) {
    throw new TypeError(
      `${label}.${missing} is missing; expected one enumerable own data property.`,
    );
  }
  const snapshot: JsonObject = Object.create(null) as JsonObject;
  for (const key of keys) {
    const descriptor = descriptors[key];
    if (descriptor === undefined || !descriptor.enumerable || !("value" in descriptor)) {
      throw new TypeError(`${label}.${key} must be an enumerable own data property.`);
    }
    snapshot[key] = descriptor.value;
  }
  return snapshot;
}

function array(
  value: unknown,
  label: string,
  minimum: number,
  maximum: number,
): readonly unknown[] {
  if (value === null || typeof value !== "object") {
    throw new TypeError(
      `${label} must be an exact ordinary dense data array; received ${observed(value)}.`,
    );
  }
  if (nodeTypes.isProxy(value)) {
    throw new TypeError(`${label} is a Proxy; supply one ordinary dense data array.`);
  }
  let descriptors: PropertyDescriptorMap;
  let prototype: object | null;
  try {
    prototype = Object.getPrototypeOf(value) as object | null;
    descriptors = Object.getOwnPropertyDescriptors(value);
  } catch {
    throw new TypeError(`${label} could not be inspected without invoking hostile traps.`);
  }
  if (!Array.isArray(value)) {
    throw new TypeError(`${label} is not an array; supply one ordinary dense data array.`);
  }
  if (prototype !== Array.prototype) {
    throw new TypeError(`${label} has a custom prototype; supply an ordinary Array.`);
  }
  const lengthDescriptor = descriptors.length;
  const length = "value" in (lengthDescriptor ?? {}) ? lengthDescriptor?.value : undefined;
  if (!Number.isSafeInteger(length)) {
    throw new TypeError(`${label}.length must be one safe-integer own data property.`);
  }
  if ((length as number) < minimum || (length as number) > maximum) {
    throw new TypeError(
      `${label} must contain ${minimum}..${maximum} entries; received ${observed(length)}.`,
    );
  }
  const expectedKeys = Array.from({ length: length as number }, (_, index) => String(index));
  const actualKeys = Reflect.ownKeys(descriptors);
  const missingIndex = expectedKeys.find((key) => descriptors[key] === undefined);
  if (missingIndex !== undefined) {
    throw new TypeError(
      `${label}[${missingIndex}] is missing; expected every index from 0 through ${(length as number) - 1} as an enumerable own data property.`,
    );
  }
  const symbolKey = actualKeys.find((key) => typeof key === "symbol");
  if (symbolKey !== undefined) {
    throw new TypeError(
      `${label} contains a symbol property; expected only length and dense indices.`,
    );
  }
  const extraKey = actualKeys.find(
    (key) => key !== "length" && typeof key === "string" && !expectedKeys.includes(key),
  );
  if (extraKey !== undefined) {
    throw new TypeError(
      `${label} contains unsupported own field ${JSON.stringify(extraKey)}; expected only length and dense indices.`,
    );
  }
  const snapshot: unknown[] = [];
  for (let index = 0; index < (length as number); index += 1) {
    const descriptor = descriptors[String(index)];
    if (descriptor === undefined || !descriptor.enumerable || !("value" in descriptor)) {
      throw new TypeError(`${label}[${index}] must be an enumerable own data property.`);
    }
    snapshot.push(descriptor.value);
  }
  return snapshot;
}

function string(value: unknown, label: string): string {
  if (typeof value !== "string") {
    throw new TypeError(`${label} must be a string; received ${typeof value}.`);
  }
  if (value.length < 1 || value.length > 200) {
    throw new TypeError(`${label} must contain 1..200 characters; received ${value.length}.`);
  }
  return value;
}

function digest(value: unknown, label: string): string {
  if (typeof value !== "string" || !SHA256.test(value)) {
    throw new TypeError(
      `${label} must be a sha256:<64 lowercase hex> digest; received ${observed(value)}.`,
    );
  }
  return value;
}

function integer(value: unknown, label: string, minimum: number, maximum: number): number {
  if (!Number.isInteger(value)) {
    throw new TypeError(`${label} must be an integer; received ${observed(value)}.`);
  }
  if ((value as number) < minimum || (value as number) > maximum) {
    throw new TypeError(`${label} must be ${minimum}..${maximum}; received ${observed(value)}.`);
  }
  return value as number;
}

function parseIdentification(value: unknown, label: string): IdentificationEvidence | null {
  if (value === null) return null;
  const record = object(value, label, [
    "ownCropDigest",
    "claimedElementId",
    "inheritedJudgement",
    "candidates",
    "studCore",
  ]);
  const inheritedJudgement =
    record.inheritedJudgement === null
      ? null
      : (() => {
          const row = object(record.inheritedJudgement, `${label}.inheritedJudgement`, [
            "judgedCropDigest",
            "elementId",
            "designId",
            "verdict",
          ]);
          if (row.verdict !== "same" && row.verdict !== "different") {
            throw new TypeError(
              `${label}.inheritedJudgement.verdict must be same or different; received ${observed(row.verdict)}.`,
            );
          }
          return {
            judgedCropDigest: digest(
              row.judgedCropDigest,
              `${label}.inheritedJudgement.judgedCropDigest`,
            ),
            elementId: string(row.elementId, `${label}.inheritedJudgement.elementId`),
            designId: string(row.designId, `${label}.inheritedJudgement.designId`),
            verdict: row.verdict as "same" | "different",
          };
        })();
  const ownCropDigest = digest(record.ownCropDigest, `${label}.ownCropDigest`);
  if (inheritedJudgement?.judgedCropDigest === ownCropDigest) {
    throw new TypeError(
      `${label}.inheritedJudgement is labelled inherited but judgedCropDigest equals ownCropDigest ${ownCropDigest}. Supply the distinct lead crop or omit inheritedJudgement.`,
    );
  }
  const seenCandidates = new Set<string>();
  const candidates = array(record.candidates, `${label}.candidates`, 0, MAX_EVIDENCE_ROWS).map(
    (candidate, index) => {
      const rowLabel = `${label}.candidates[${index}]`;
      const row = object(candidate, rowLabel, ["elementId", "designId", "distance"]);
      const designId = string(row.designId, `${rowLabel}.designId`);
      if (seenCandidates.has(designId)) {
        throw new TypeError(`${label}.candidates repeats design ${designId}.`);
      }
      seenCandidates.add(designId);
      if (typeof row.distance !== "number" || !Number.isFinite(row.distance)) {
        throw new TypeError(
          `${rowLabel}.distance must be finite; received ${observed(row.distance)}.`,
        );
      }
      if (row.distance < 0) {
        throw new TypeError(`${rowLabel}.distance must be non-negative; received ${row.distance}.`);
      }
      return {
        elementId: string(row.elementId, `${rowLabel}.elementId`),
        designId,
        distance: row.distance,
      };
    },
  );
  const studCore =
    record.studCore === null
      ? null
      : (() => {
          const core = object(record.studCore, `${label}.studCore`, [
            "observedCount",
            "expectedByDesign",
          ]);
          const seen = new Set<string>();
          const expectedByDesign = array(
            core.expectedByDesign,
            `${label}.studCore.expectedByDesign`,
            1,
            MAX_EVIDENCE_ROWS,
          ).map((expected, index) => {
            const rowLabel = `${label}.studCore.expectedByDesign[${index}]`;
            const row = object(expected, rowLabel, ["designId", "count"]);
            const designId = string(row.designId, `${rowLabel}.designId`);
            if (seen.has(designId)) {
              throw new TypeError(`${label}.studCore.expectedByDesign repeats design ${designId}.`);
            }
            seen.add(designId);
            return {
              designId,
              count: integer(row.count, `${rowLabel}.count`, 0, 1024),
            };
          });
          return {
            observedCount: integer(core.observedCount, `${label}.studCore.observedCount`, 0, 1024),
            expectedByDesign,
          };
        })();
  return {
    ownCropDigest,
    claimedElementId: string(record.claimedElementId, `${label}.claimedElementId`),
    inheritedJudgement,
    candidates,
    studCore,
  };
}

function parsePhases(value: unknown): readonly AlignmentPhase[] {
  const seenBrickRefs = new Set<string>();
  const seenPhaseIds = new Set<string>();
  const phases = array(value, "Step-13 alignment phases", 1, MAX_PHASES).map(
    (candidate, index): AlignmentPhase => {
      const label = `Step-13 alignment phases[${index}]`;
      const phase = object(candidate, label, [
        "sequence",
        "phaseId",
        "subBuildPath",
        "sourceIdentityCount",
        "identities",
      ]);
      const identities = array(phase.identities, `${label}.identities`, 1, MAX_IDENTITIES).map(
        (candidateIdentity, identityIndex) => {
          const identityLabel = `${label}.identities[${identityIndex}]`;
          const identity = object(candidateIdentity, identityLabel, ["brickRef", "designId"]);
          const brickRef = string(identity.brickRef, `${identityLabel}.brickRef`);
          if (seenBrickRefs.has(brickRef)) {
            throw new TypeError(`Step-13 alignment phases repeat physical Brick ${brickRef}.`);
          }
          seenBrickRefs.add(brickRef);
          return { brickRef, designId: string(identity.designId, `${identityLabel}.designId`) };
        },
      );
      const sourceIdentityCount = integer(
        phase.sourceIdentityCount,
        `${label}.sourceIdentityCount`,
        1,
        MAX_IDENTITIES,
      );
      if (sourceIdentityCount !== identities.length) {
        throw new TypeError(
          `${label} is a split phase: sourceIdentityCount is ${sourceIdentityCount} but identities has ${identities.length}. Supply the complete source phase.`,
        );
      }
      const phaseId = string(phase.phaseId, `${label}.phaseId`);
      if (seenPhaseIds.has(phaseId)) {
        throw new TypeError(`Step-13 alignment phases repeat phaseId ${phaseId}.`);
      }
      seenPhaseIds.add(phaseId);
      return {
        sequence: integer(phase.sequence, `${label}.sequence`, 1, 10_000),
        phaseId,
        subBuildPath: array(phase.subBuildPath, `${label}.subBuildPath`, 0, 8).map(
          (path, pathIndex) => string(path, `${label}.subBuildPath[${pathIndex}]`),
        ),
        sourceIdentityCount,
        identities,
      };
    },
  );
  phases.forEach((phase, index) => {
    const expected = 14 + index;
    if (phase.sequence !== expected) {
      throw new TypeError(
        `Step-13 alignment phases must be contiguous source order from sequence 14; entry ${index} is ${phase.sequence}, expected ${expected}. Refusing a rewind, skip, or reorder.`,
      );
    }
  });
  const identityCount = phases.reduce((total, phase) => total + phase.identities.length, 0);
  if (identityCount !== 7) {
    throw new TypeError(
      `Step-13 alignment phase window must contain the seven identities printed by steps 12..14; received ${identityCount}. Refusing a skipped or out-of-window identity.`,
    );
  }
  return phases;
}

function parseSteps(value: unknown): readonly AlignmentStep[] {
  const seenCallouts = new Set<string>();
  return array(value, "Step-13 alignment steps", 3, 3).map((candidate, index): AlignmentStep => {
    const label = `Step-13 alignment steps[${index}]`;
    const step = object(candidate, label, ["stepNumber", "callouts"]);
    const expectedStep = STEP_NUMBERS[index]!;
    if (step.stepNumber !== expectedStep) {
      throw new TypeError(
        `Step-13 alignment step entry ${index} must be printed step ${expectedStep}; received ${observed(step.stepNumber)}. Refusing reordered steps.`,
      );
    }
    const callouts = array(step.callouts, `${label}.callouts`, 1, MAX_CALLOUTS).map(
      (candidateCallout, calloutIndex): AlignmentCallout => {
        const calloutLabel = `${label}.callouts[${calloutIndex}]`;
        const callout = object(candidateCallout, calloutLabel, [
          "calloutKey",
          "quantity",
          "claimedDesignId",
          "identification",
        ]);
        const calloutKey = string(callout.calloutKey, `${calloutLabel}.calloutKey`);
        if (seenCallouts.has(calloutKey)) {
          throw new TypeError(`Step-13 alignment steps repeat callout ${calloutKey}.`);
        }
        seenCallouts.add(calloutKey);
        return {
          calloutKey,
          quantity: integer(callout.quantity, `${calloutLabel}.quantity`, 1, MAX_IDENTITIES),
          claimedDesignId: string(callout.claimedDesignId, `${calloutLabel}.claimedDesignId`),
          identification: parseIdentification(
            callout.identification,
            `${calloutLabel}.identification`,
          ),
        };
      },
    );
    const quantity = callouts.reduce((total, callout) => total + callout.quantity, 0);
    if (quantity !== STEP_QUANTITIES[index]) {
      throw new TypeError(
        `Printed step ${expectedStep} must retain ${STEP_QUANTITIES[index]} physical units; received ${quantity}.`,
      );
    }
    return { stepNumber: expectedStep, callouts };
  });
}

export function parseStep13AlignmentInput(value: unknown): Step13AlignmentInput {
  const root = object(value, "Step-13 alignment input", [
    "schemaVersion",
    "builderSourceDigest",
    "builderPhaseDigest",
    "phaseWindowStartIdentityCursor",
    "anchor",
    "phases",
    "steps",
  ]);
  if (root.schemaVersion !== STEP_13_ALIGNMENT_INPUT_SCHEMA) {
    throw new TypeError(
      `Step-13 alignment input schema is ${observed(root.schemaVersion)}; expected ${STEP_13_ALIGNMENT_INPUT_SCHEMA}.`,
    );
  }
  const anchor = object(root.anchor, "Step-13 alignment anchor", [
    "afterStepNumber",
    "identityCursor",
  ]);
  if (anchor.afterStepNumber !== 12) {
    throw new TypeError(
      `Step-13 alignment anchor must follow printed step 12; received ${observed(anchor.afterStepNumber)}. Refusing a rewind or later anchor.`,
    );
  }
  if (anchor.identityCursor !== 26) {
    throw new TypeError(
      `Step-13 alignment anchor identityCursor must be 26; received ${observed(anchor.identityCursor)}. Refusing a cursor offset.`,
    );
  }
  const startCursor = integer(
    root.phaseWindowStartIdentityCursor,
    "Step-13 alignment phaseWindowStartIdentityCursor",
    0,
    10_000,
  );
  if (startCursor !== 25) {
    throw new TypeError(
      `Step-13 alignment phase window must begin at cursor 25 so step 12 closes cursor 26; received ${startCursor}. Refusing a rewind or cursor offset.`,
    );
  }
  return {
    schemaVersion: STEP_13_ALIGNMENT_INPUT_SCHEMA,
    builderSourceDigest: digest(root.builderSourceDigest, "builderSourceDigest"),
    builderPhaseDigest: digest(root.builderPhaseDigest, "builderPhaseDigest"),
    phaseWindowStartIdentityCursor: startCursor,
    anchor: { afterStepNumber: 12, identityCursor: 26 },
    phases: parsePhases(root.phases),
    steps: parseSteps(root.steps),
  };
}
