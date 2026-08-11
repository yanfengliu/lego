import type {
  FartherAtomicPieceIdentity,
  FartherCarryInput,
  FartherCandidate,
  FartherFrontier,
  FartherLineageStep,
  FartherOriginCandidateInput,
  FartherOriginEvidence,
  FartherOriginInput,
  FartherPanelObservationInput,
  FartherPlacementWitness,
  FirstRevealingPanelInput,
} from "./real-build-farther-panel-types";

export interface RuntimeParseResult<T> {
  readonly value: T | null;
  readonly error: string | null;
}

class RuntimeInputError extends Error {}

const fail = (message: string): never => {
  throw new RuntimeInputError(message);
};

const keyName = (key: PropertyKey): string =>
  typeof key === "symbol" ? key.toString() : JSON.stringify(key);

function exactRecord(
  value: unknown,
  path: string,
  expectedKeys: readonly string[],
): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return fail(`${path} is ${String(value)}; required an object`);
  }
  const keys = Reflect.ownKeys(value);
  const missing = expectedKeys.find((key) => !keys.includes(key));
  if (missing !== undefined) {
    return fail(
      `${path} is missing key ${JSON.stringify(missing)}; required exact keys ${JSON.stringify(expectedKeys)}`,
    );
  }
  const unexpected = keys.find((key) => typeof key !== "string" || !expectedKeys.includes(key));
  if (unexpected !== undefined) {
    return fail(
      `${path} has unexpected key ${keyName(unexpected)}; allowed exact keys ${JSON.stringify(expectedKeys)}`,
    );
  }
  const snapshot: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
  for (const key of expectedKeys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor === undefined || !("value" in descriptor)) {
      return fail(`${path}.${key} must be an own data property; accessors are not accepted`);
    }
    snapshot[key] = descriptor.value;
  }
  return snapshot;
}

function denseArray(value: unknown, path: string): readonly unknown[] {
  if (!Array.isArray(value)) {
    return fail(`${path} is ${String(value)}; required an array`);
  }
  const lengthDescriptor = Object.getOwnPropertyDescriptor(value, "length");
  if (
    lengthDescriptor === undefined ||
    !("value" in lengthDescriptor) ||
    !Number.isSafeInteger(lengthDescriptor.value) ||
    (lengthDescriptor.value as number) < 0
  ) {
    return fail(
      `${path}.length must be an own data property containing a non-negative safe integer`,
    );
  }
  const length = lengthDescriptor.value as number;
  const keys = Reflect.ownKeys(value);
  const unexpected = keys.find((key) => {
    if (key === "length") return false;
    if (typeof key !== "string" || !/^(0|[1-9]\d*)$/u.test(key)) return true;
    return Number(key) >= length;
  });
  if (unexpected !== undefined) {
    return fail(`${path} has unexpected array key ${keyName(unexpected)}`);
  }
  const snapshot: unknown[] = [];
  for (let index = 0; index < length; index += 1) {
    if (!keys.includes(String(index))) {
      return fail(`${path}[${index}] is missing; required a dense array`);
    }
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (descriptor === undefined) {
      return fail(`${path}[${index}] is missing; required a dense array`);
    }
    if (!("value" in descriptor)) {
      return fail(`${path}[${index}] must be an own data property; accessors are not accepted`);
    }
    snapshot.push(descriptor.value);
  }
  return snapshot;
}

const stringValue = (value: unknown, path: string): string =>
  typeof value === "string" ? value : fail(`${path} is ${String(value)}; required a string`);

const numberValue = (value: unknown, path: string): number =>
  typeof value === "number" ? value : fail(`${path} is ${String(value)}; required a number`);

const nullableNumber = (value: unknown, path: string): number | null =>
  value === null ? null : numberValue(value, path);

const booleanValue = (value: unknown, path: string): boolean =>
  typeof value === "boolean" ? value : fail(`${path} is ${String(value)}; required a boolean`);

function parseNumberArray(value: unknown, path: string): readonly number[] {
  return denseArray(value, path).map((entry, index) => numberValue(entry, `${path}[${index}]`));
}

function parseWitness(value: unknown, path: string): FartherPlacementWitness {
  const record = exactRecord(value, path, ["catalogPartId", "colorId", "transform"]);
  const transform = exactRecord(record.transform, `${path}.transform`, [
    "positionLdu",
    "orientationId",
  ]);
  const position = parseNumberArray(transform.positionLdu, `${path}.transform.positionLdu`);
  if (position.length !== 3) {
    return fail(`${path}.transform.positionLdu has length ${position.length}; required exactly 3`);
  }
  return {
    catalogPartId: stringValue(record.catalogPartId, `${path}.catalogPartId`),
    colorId: stringValue(record.colorId, `${path}.colorId`),
    transform: {
      positionLdu: position as unknown as readonly [number, number, number],
      orientationId: stringValue(transform.orientationId, `${path}.transform.orientationId`),
    },
  };
}

function parseWitnessArray(value: unknown, path: string): readonly FartherPlacementWitness[] {
  return denseArray(value, path).map((entry, index) => parseWitness(entry, `${path}[${index}]`));
}

function parseAtomicIdentity(value: unknown, path: string): FartherAtomicPieceIdentity {
  const record = exactRecord(value, path, ["catalogPartId", "colorId"]);
  return {
    catalogPartId: stringValue(record.catalogPartId, `${path}.catalogPartId`),
    colorId: stringValue(record.colorId, `${path}.colorId`),
  };
}

function parseLineageStep(value: unknown, path: string): FartherLineageStep {
  const record = exactRecord(value, path, ["stepNumber", "documentHash", "pieces"]);
  return {
    stepNumber: numberValue(record.stepNumber, `${path}.stepNumber`),
    documentHash: stringValue(record.documentHash, `${path}.documentHash`),
    pieces: parseWitnessArray(record.pieces, `${path}.pieces`),
  };
}

function parseCandidate<D>(value: unknown, path: string): FartherCandidate<D> {
  const record = exactRecord(value, path, [
    "candidateId",
    "parentCandidateId",
    "originCandidateId",
    "document",
    "lineage",
  ]);
  const parentCandidateId =
    record.parentCandidateId === null
      ? null
      : stringValue(record.parentCandidateId, `${path}.parentCandidateId`);
  return {
    candidateId: stringValue(record.candidateId, `${path}.candidateId`),
    parentCandidateId,
    originCandidateId: stringValue(record.originCandidateId, `${path}.originCandidateId`),
    document: record.document as D,
    lineage: denseArray(record.lineage, `${path}.lineage`).map((entry, index) =>
      parseLineageStep(entry, `${path}.lineage[${index}]`),
    ),
  };
}

function parseFrontier<D>(value: unknown, path: string): FartherFrontier<D> {
  const record = exactRecord(value, path, ["originStepNumber", "throughStepNumber", "candidates"]);
  return {
    originStepNumber: numberValue(record.originStepNumber, `${path}.originStepNumber`),
    throughStepNumber: numberValue(record.throughStepNumber, `${path}.throughStepNumber`),
    candidates: denseArray(record.candidates, `${path}.candidates`).map((entry, index) =>
      parseCandidate<D>(entry, `${path}.candidates[${index}]`),
    ),
  };
}

function parseOriginCandidate<D>(value: unknown, path: string): FartherOriginCandidateInput<D> {
  const record = exactRecord(value, path, ["candidateId", "document", "documentHash", "pieces"]);
  return {
    candidateId: stringValue(record.candidateId, `${path}.candidateId`),
    document: record.document as D,
    documentHash: stringValue(record.documentHash, `${path}.documentHash`),
    pieces: parseWitnessArray(record.pieces, `${path}.pieces`),
  };
}

function parseOriginInput<D>(value: unknown): FartherOriginInput<D> {
  const record = exactRecord(value, "origin", ["stepNumber", "candidates"]);
  return {
    stepNumber: numberValue(record.stepNumber, "origin.stepNumber"),
    candidates: denseArray(record.candidates, "origin.candidates").map((entry, index) =>
      parseOriginCandidate<D>(entry, `origin.candidates[${index}]`),
    ),
  };
}

function parseExpansion<D>(value: unknown, path: string) {
  const record = exactRecord(value, path, [
    "parentCandidateId",
    "narrowingRenders",
    "offeredPerPiece",
    "carriedPerPiece",
    "children",
  ]);
  return {
    parentCandidateId: stringValue(record.parentCandidateId, `${path}.parentCandidateId`),
    narrowingRenders: numberValue(record.narrowingRenders, `${path}.narrowingRenders`),
    offeredPerPiece: parseNumberArray(record.offeredPerPiece, `${path}.offeredPerPiece`),
    carriedPerPiece: parseNumberArray(record.carriedPerPiece, `${path}.carriedPerPiece`),
    children: denseArray(record.children, `${path}.children`).map((entry, index) => {
      const childPath = `${path}.children[${index}]`;
      const child = exactRecord(entry, childPath, [
        "candidateId",
        "document",
        "documentHash",
        "pieces",
      ]);
      return {
        candidateId: stringValue(child.candidateId, `${childPath}.candidateId`),
        document: child.document as D,
        documentHash: stringValue(child.documentHash, `${childPath}.documentHash`),
        pieces: parseWitnessArray(child.pieces, `${childPath}.pieces`),
      };
    }),
  };
}

function parseCarryInput<D>(value: unknown): FartherCarryInput<D> {
  const record = exactRecord(value, "carry", [
    "frontier",
    "stepNumber",
    "expectedAtomicPieces",
    "expansions",
    "maximumCandidates",
    "maximumNarrowingRenders",
  ]);
  return {
    frontier: parseFrontier<D>(record.frontier, "carry.frontier"),
    stepNumber: numberValue(record.stepNumber, "carry.stepNumber"),
    expectedAtomicPieces: denseArray(record.expectedAtomicPieces, "carry.expectedAtomicPieces").map(
      (entry, index) => parseAtomicIdentity(entry, `carry.expectedAtomicPieces[${index}]`),
    ),
    expansions: denseArray(record.expansions, "carry.expansions").map((entry, index) =>
      parseExpansion<D>(entry, `carry.expansions[${index}]`),
    ),
    maximumCandidates: numberValue(record.maximumCandidates, "carry.maximumCandidates"),
    maximumNarrowingRenders: numberValue(
      record.maximumNarrowingRenders,
      "carry.maximumNarrowingRenders",
    ),
  };
}

function parseOriginEvidence(value: unknown): FartherOriginEvidence {
  const record = exactRecord(value, "panel.originEvidence", [
    "stepNumber",
    "status",
    "margin",
    "minimumMargin",
  ]);
  const status = stringValue(record.status, "panel.originEvidence.status");
  if (status !== "no-local-signal" && status !== "unseparated") {
    return fail(
      `panel.originEvidence.status is ${JSON.stringify(status)}; required "no-local-signal" or "unseparated"`,
    );
  }
  return {
    stepNumber: numberValue(record.stepNumber, "panel.originEvidence.stepNumber"),
    status,
    margin: nullableNumber(record.margin, "panel.originEvidence.margin"),
    minimumMargin: nullableNumber(record.minimumMargin, "panel.originEvidence.minimumMargin"),
  };
}

function parsePanel(value: unknown, path: string): FartherPanelObservationInput {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return fail(`${path} is ${String(value)}; required a panel object`);
  }
  const statusDescriptor = Object.getOwnPropertyDescriptor(value, "status");
  if (statusDescriptor === undefined || !("value" in statusDescriptor)) {
    return fail(`${path} is missing own data key "status"`);
  }
  const status = stringValue(statusDescriptor.value, `${path}.status`);
  if (status === "not-observable") {
    const record = exactRecord(value, path, ["stepNumber", "status", "reason"]);
    const reason = stringValue(record.reason, `${path}.reason`);
    if (reason !== "occluded" && reason !== "no-built-art" && reason !== "camera-unresolved") {
      return fail(
        `${path}.reason is ${JSON.stringify(reason)}; required "occluded", "no-built-art", or "camera-unresolved"`,
      );
    }
    return { stepNumber: numberValue(record.stepNumber, `${path}.stepNumber`), status, reason };
  }
  if (status !== "scored") {
    return fail(
      `${path}.status is ${JSON.stringify(status)}; required "not-observable" or "scored"`,
    );
  }
  const record = exactRecord(value, path, ["stepNumber", "status", "subject", "scores"]);
  const subject = stringValue(record.subject, `${path}.subject`);
  if (subject !== "origin" && subject !== "frontier") {
    return fail(`${path}.subject is ${JSON.stringify(subject)}; required "origin" or "frontier"`);
  }
  const scores = denseArray(record.scores, `${path}.scores`).map((entry, index) => {
    const scorePath = `${path}.scores[${index}]`;
    const score = exactRecord(entry, scorePath, ["candidateId", "agreement"]);
    return {
      candidateId: stringValue(score.candidateId, `${scorePath}.candidateId`),
      agreement: numberValue(score.agreement, `${scorePath}.agreement`),
    };
  });
  return {
    stepNumber: numberValue(record.stepNumber, `${path}.stepNumber`),
    status,
    subject,
    scores,
  };
}

function parsePanelInput<D>(value: unknown): FirstRevealingPanelInput<D> {
  const record = exactRecord(value, "panel", [
    "frontier",
    "originEvidence",
    "panels",
    "minimumAgreement",
    "minimumMargin",
    "maximumPanelRenders",
    "maximumReachSteps",
    "fartherPanelsAvailable",
  ]);
  return {
    frontier: parseFrontier<D>(record.frontier, "panel.frontier"),
    originEvidence: parseOriginEvidence(record.originEvidence),
    panels: denseArray(record.panels, "panel.panels").map((entry, index) =>
      parsePanel(entry, `panel.panels[${index}]`),
    ),
    minimumAgreement: numberValue(record.minimumAgreement, "panel.minimumAgreement"),
    minimumMargin: numberValue(record.minimumMargin, "panel.minimumMargin"),
    maximumPanelRenders: numberValue(record.maximumPanelRenders, "panel.maximumPanelRenders"),
    maximumReachSteps: numberValue(record.maximumReachSteps, "panel.maximumReachSteps"),
    fartherPanelsAvailable: booleanValue(
      record.fartherPanelsAvailable,
      "panel.fartherPanelsAvailable",
    ),
  };
}

function parse<T>(operation: () => T): RuntimeParseResult<T> {
  try {
    return { value: operation(), error: null };
  } catch (error) {
    let message = "unknown inspection failure";
    let validationFailure = false;
    let nativeError = false;
    try {
      validationFailure = error instanceof RuntimeInputError;
      nativeError = error instanceof Error;
    } catch {
      // A hostile proxy can throw an unprintable value. The boundary still refuses it.
    }
    try {
      const detail = nativeError ? (error as Error).message : error;
      message = typeof detail === "string" ? detail : String(detail);
    } catch {
      // Error.message can itself be a hostile accessor or a non-string with a throwing coercion.
    }
    return {
      value: null,
      error: validationFailure ? message : `input could not be inspected safely: ${message}`,
    };
  }
}

export const parseFartherOriginInput = <D>(
  value: unknown,
): RuntimeParseResult<FartherOriginInput<D>> => parse(() => parseOriginInput<D>(value));

export const parseFartherCarryInput = <D>(
  value: unknown,
): RuntimeParseResult<FartherCarryInput<D>> => parse(() => parseCarryInput<D>(value));

export const parseFirstRevealingPanelInput = <D>(
  value: unknown,
): RuntimeParseResult<FirstRevealingPanelInput<D>> => parse(() => parsePanelInput<D>(value));
