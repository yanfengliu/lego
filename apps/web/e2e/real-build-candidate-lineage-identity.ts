import { canonicalStringify, sha256Hex, type Sha256Digest } from "@lego-studio/brick-kernel";

export const REAL_BUILD_ID_MAXIMUM_LENGTH = 256;
export const REAL_BUILD_LINEAGE_MAXIMUM_STEP_NUMBER = 359;
export const REAL_BUILD_SHA256_DIGEST_PATTERN = /^sha256:[0-9a-f]{64}$/u;
export const REAL_BUILD_LINEAGE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:@-]{0,255}$/u;

const CANDIDATE_KEYS = ["candidateId", "documentHash"] as const;
const CREATE_KEYS = [
  "candidateId",
  "documentHash",
  "localIdentity",
  "parent",
  "throughStepNumber",
] as const;
const LOCAL_IDENTITY_KEYS = ["id", "kind"] as const;
const SNAPSHOT_KEYS = [
  "candidateId",
  "documentHash",
  "lineageId",
  "lineageOrigin",
  "localIdentity",
  "originLineageId",
  "parentLineageId",
  "throughStepNumber",
] as const;
const LINEAGE_DIGEST_SCHEMA = "real-build-lineage-identity/1";
const GENERATED_LINEAGE_PATTERN = /^lineage:sha256:[0-9a-f]{64}$/u;
const digestValidatedLineages = new WeakSet<object>();
const linkedLineages = new WeakSet<object>();

export type RealBuildDocumentCandidateId = `document:${Sha256Digest}`;
export type RealBuildLineageId = `lineage:sha256:${string}`;

export interface RealBuildCandidateIdentity {
  readonly candidateId: RealBuildDocumentCandidateId;
  readonly documentHash: Sha256Digest;
}

export interface RealBuildLineageLocalIdentity {
  readonly kind: "decision" | "evidence";
  readonly id: string;
}

interface RealBuildLineageIdentityBase extends RealBuildCandidateIdentity {
  readonly lineageId: RealBuildLineageId;
  /** Immutable run-root ancestry. Farther-frontier origin is a separate contract field. */
  readonly originLineageId: RealBuildLineageId;
  /** Document prefix, not event depth; later evidence may retain the same prefix step. */
  readonly throughStepNumber: number;
  readonly localIdentity: RealBuildLineageLocalIdentity;
}

export interface RealBuildRootLineageIdentity extends RealBuildLineageIdentityBase {
  readonly lineageOrigin: "root";
  readonly parentLineageId: null;
}

export interface RealBuildDescendantLineageIdentity extends RealBuildLineageIdentityBase {
  readonly lineageOrigin: "descendant";
  readonly parentLineageId: RealBuildLineageId;
}

export type RealBuildLineageIdentity =
  RealBuildRootLineageIdentity | RealBuildDescendantLineageIdentity;

/** Digest-valid identity whose parent-chain continuity has not necessarily been linked yet. */
export type DetachedRealBuildLineageIdentity = RealBuildLineageIdentity;

type IdentityProperties = Readonly<Record<string, unknown>>;

/**
 * Reads only the fixed identity fields through descriptors. Unknown fields are
 * deliberately ignored: enumerating all keys on an untrusted object has no
 * bounded JavaScript primitive, while the returned canonical identity retains
 * none of them.
 */
function snapshotIdentityProperties(
  input: unknown,
  keys: readonly string[],
  label: string,
): IdentityProperties {
  if (input === null || typeof input !== "object") {
    throw new TypeError(`${label} must be a plain object containing ${keys.join(", ")}.`);
  }

  let isArray: boolean;
  let prototype: object | null;
  try {
    isArray = Array.isArray(input);
    prototype = Object.getPrototypeOf(input) as object | null;
  } catch {
    throw new TypeError(`${label} could not be inspected without invoking hostile object traps.`);
  }
  if (isArray) {
    throw new TypeError(`${label} must be a plain object containing ${keys.join(", ")}.`);
  }
  if (prototype !== Object.prototype && prototype !== null) {
    throw new TypeError(`${label} must be a plain object containing ${keys.join(", ")}.`);
  }

  const descriptors = new Map<string, PropertyDescriptor>();
  for (const key of keys) {
    let descriptor: PropertyDescriptor | undefined;
    try {
      descriptor = Object.getOwnPropertyDescriptor(input, key);
    } catch {
      throw new TypeError(`${label} properties could not be inspected safely.`);
    }
    if (descriptor === undefined || !descriptor.enumerable) {
      throw new TypeError(`${label}.${key} must be an enumerable own property.`);
    }
    descriptors.set(key, descriptor);
  }

  const snapshot: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
  for (const key of keys) {
    const descriptor = descriptors.get(key)!;
    if (!("value" in descriptor))
      throw new TypeError(
        `${label}.${key} must be an enumerable own data property; accessors are not invoked at this trust boundary.`,
      );
    snapshot[key] = descriptor.value;
  }
  return snapshot;
}

function requireSha256Digest(value: unknown, label: string): Sha256Digest {
  if (typeof value !== "string" || !REAL_BUILD_SHA256_DIGEST_PATTERN.test(value)) {
    throw new TypeError(
      `${label} must be exactly sha256: followed by 64 lowercase hexadecimal characters.`,
    );
  }
  return value as Sha256Digest;
}

function requireLineageId(value: unknown, label: string): RealBuildLineageId {
  if (
    typeof value !== "string" ||
    value.length > REAL_BUILD_ID_MAXIMUM_LENGTH ||
    !REAL_BUILD_LINEAGE_ID_PATTERN.test(value) ||
    !GENERATED_LINEAGE_PATTERN.test(value)
  ) {
    throw new TypeError(
      `${label} must be a generated lineage:sha256:<lowercase digest> identifier of at most ${REAL_BUILD_ID_MAXIMUM_LENGTH} ASCII characters.`,
    );
  }
  return value as RealBuildLineageId;
}

function requireThroughStepNumber(value: unknown): number {
  if (
    !Number.isSafeInteger(value) ||
    (value as number) < 0 ||
    (value as number) > REAL_BUILD_LINEAGE_MAXIMUM_STEP_NUMBER
  ) {
    throw new RangeError(
      `Real-build lineage throughStepNumber must be a safe integer from 0 through ${REAL_BUILD_LINEAGE_MAXIMUM_STEP_NUMBER}.`,
    );
  }
  return value as number;
}

function snapshotLocalIdentity(input: unknown): RealBuildLineageLocalIdentity {
  const properties = snapshotIdentityProperties(
    input,
    LOCAL_IDENTITY_KEYS,
    "Real-build lineage localIdentity",
  );
  const { id, kind } = properties;
  if (kind !== "decision" && kind !== "evidence") {
    throw new TypeError(
      `Real-build lineage localIdentity.kind must be exactly "decision" or "evidence".`,
    );
  }
  if (
    typeof id !== "string" ||
    id.length > REAL_BUILD_ID_MAXIMUM_LENGTH ||
    !REAL_BUILD_LINEAGE_ID_PATTERN.test(id)
  ) {
    throw new TypeError(
      `Real-build lineage localIdentity.id must be a 1-${REAL_BUILD_ID_MAXIMUM_LENGTH} character ASCII identifier using letters, digits, dot, underscore, colon, at, or hyphen.`,
    );
  }
  return Object.freeze({ id, kind });
}

export function realBuildDocumentCandidateId(documentHash: unknown): RealBuildDocumentCandidateId {
  return `document:${requireSha256Digest(documentHash, "Real-build candidate documentHash")}`;
}

export function snapshotRealBuildCandidateIdentity(input: unknown): RealBuildCandidateIdentity {
  const { candidateId, documentHash: rawDocumentHash } = snapshotIdentityProperties(
    input,
    CANDIDATE_KEYS,
    "Real-build candidate identity",
  );
  const documentHash = requireSha256Digest(
    rawDocumentHash,
    "Real-build candidate identity documentHash",
  );
  const expectedCandidateId = realBuildDocumentCandidateId(documentHash);
  if (candidateId !== expectedCandidateId) {
    throw new TypeError(
      `Real-build candidate identity candidateId must equal document:${documentHash}; the candidate identity cannot differ from its canonical document hash.`,
    );
  }
  return Object.freeze({ candidateId: expectedCandidateId, documentHash });
}

function requireValidatedParent(value: unknown): RealBuildLineageIdentity | null {
  if (value === null) return null;
  if ((typeof value !== "object" && typeof value !== "function") || !linkedLineages.has(value)) {
    throw new TypeError(
      "Real-build lineage parent must be null or a digest-valid identity whose direct-parent links were checked by this module; this establishes inspection continuity only, never execution authority.",
    );
  }
  return value as RealBuildLineageIdentity;
}

function deriveLineageId(input: {
  readonly candidateId: RealBuildDocumentCandidateId;
  readonly documentHash: Sha256Digest;
  readonly lineageOrigin: "root" | "descendant";
  readonly originLineageId: RealBuildLineageId | "self";
  readonly parentLineageId: RealBuildLineageId | null;
  readonly throughStepNumber: number;
  readonly localIdentity: RealBuildLineageLocalIdentity;
}): RealBuildLineageId {
  return `lineage:sha256:${sha256Hex(
    canonicalStringify({
      schema: LINEAGE_DIGEST_SCHEMA,
      lineageOrigin: input.lineageOrigin,
      originLineageId: input.originLineageId,
      parentLineageId: input.parentLineageId,
      candidateId: input.candidateId,
      documentHash: input.documentHash,
      throughStepNumber: input.throughStepNumber,
      localIdentity: input.localIdentity,
    }),
  )}`;
}

function buildLineageIdentity(
  input: {
    readonly candidateId: RealBuildDocumentCandidateId;
    readonly documentHash: Sha256Digest;
    readonly parent: RealBuildLineageIdentity | null;
    readonly throughStepNumber: number;
    readonly localIdentity: RealBuildLineageLocalIdentity;
  },
  chainValidated = true,
): RealBuildLineageIdentity {
  const { candidateId, documentHash, parent, throughStepNumber, localIdentity } = input;
  if ((throughStepNumber === 0) !== (parent === null)) {
    throw new TypeError(
      parent === null
        ? "Real-build lineage root parent may be null only at throughStepNumber 0."
        : "Real-build lineage throughStepNumber 0 is a root and cannot have a parent.",
    );
  }
  if (parent !== null && throughStepNumber < parent.throughStepNumber) {
    throw new RangeError(
      `Real-build lineage child throughStepNumber ${throughStepNumber} cannot precede its parent at step ${parent.throughStepNumber}.`,
    );
  }
  let identity: RealBuildLineageIdentity;
  if (parent === null) {
    const lineageId = deriveLineageId({
      candidateId,
      documentHash,
      lineageOrigin: "root",
      originLineageId: "self",
      parentLineageId: null,
      throughStepNumber,
      localIdentity,
    });
    identity = Object.freeze({
      candidateId,
      documentHash,
      lineageId,
      lineageOrigin: "root",
      localIdentity,
      originLineageId: lineageId,
      parentLineageId: null,
      throughStepNumber,
    });
  } else {
    const parentLineageId = parent.lineageId;
    const originLineageId = parent.originLineageId;
    const lineageId = deriveLineageId({
      candidateId,
      documentHash,
      lineageOrigin: "descendant",
      originLineageId,
      parentLineageId,
      throughStepNumber,
      localIdentity,
    });
    identity = Object.freeze({
      candidateId,
      documentHash,
      lineageId,
      lineageOrigin: "descendant",
      localIdentity,
      originLineageId,
      parentLineageId,
      throughStepNumber,
    });
  }
  digestValidatedLineages.add(identity);
  if (chainValidated) linkedLineages.add(identity);
  return identity;
}

export function createRealBuildLineageIdentity(input: unknown): RealBuildLineageIdentity {
  const properties = snapshotIdentityProperties(
    input,
    CREATE_KEYS,
    "Real-build lineage creation input",
  );
  const candidate = snapshotRealBuildCandidateIdentity({
    candidateId: properties.candidateId,
    documentHash: properties.documentHash,
  });
  return buildLineageIdentity({
    ...candidate,
    parent: requireValidatedParent(properties.parent),
    throughStepNumber: requireThroughStepNumber(properties.throughStepNumber),
    localIdentity: snapshotLocalIdentity(properties.localIdentity),
  });
}

/**
 * Derives a digest-valid child from a detached, digest-valid parent without
 * claiming that the parent's earlier ancestry was proved here. Callers must
 * retain and validate the direct-parent evidence chain separately.
 */
export function deriveRealBuildLineageIdentity(input: unknown): DetachedRealBuildLineageIdentity {
  const properties = snapshotIdentityProperties(
    input,
    CREATE_KEYS,
    "Real-build detached lineage derivation input",
  );
  const candidate = snapshotRealBuildCandidateIdentity({
    candidateId: properties.candidateId,
    documentHash: properties.documentHash,
  });
  const parent =
    properties.parent === null ? null : snapshotRealBuildLineageIdentity(properties.parent);
  if (parent === null) {
    throw new TypeError(
      "Real-build detached lineage derivation requires a digest-valid non-null parent; create run roots through createRealBuildLineageIdentity.",
    );
  }
  return buildLineageIdentity(
    {
      ...candidate,
      parent,
      throughStepNumber: requireThroughStepNumber(properties.throughStepNumber),
      localIdentity: snapshotLocalIdentity(properties.localIdentity),
    },
    false,
  );
}

export function snapshotRealBuildLineageIdentity(input: unknown): DetachedRealBuildLineageIdentity {
  const properties = snapshotIdentityProperties(
    input,
    SNAPSHOT_KEYS,
    "Real-build lineage identity",
  );
  const candidate = snapshotRealBuildCandidateIdentity({
    candidateId: properties.candidateId,
    documentHash: properties.documentHash,
  });
  const throughStepNumber = requireThroughStepNumber(properties.throughStepNumber);
  const localIdentity = snapshotLocalIdentity(properties.localIdentity);
  const claimedLineageId = requireLineageId(
    properties.lineageId,
    "Real-build lineage identity lineageId",
  );
  const claimedOriginLineageId = requireLineageId(
    properties.originLineageId,
    "Real-build lineage identity originLineageId",
  );
  let expectedLineageId: RealBuildLineageId;
  let identity: DetachedRealBuildLineageIdentity;
  if (properties.lineageOrigin === "root") {
    if (
      throughStepNumber !== 0 ||
      properties.parentLineageId !== null ||
      claimedOriginLineageId !== claimedLineageId
    ) {
      throw new TypeError(
        "Real-build root lineage must be at throughStepNumber 0 with null parentLineageId and originLineageId equal to itself.",
      );
    }
    expectedLineageId = deriveLineageId({
      ...candidate,
      lineageOrigin: "root",
      originLineageId: "self",
      parentLineageId: null,
      throughStepNumber,
      localIdentity,
    });
    identity = Object.freeze({
      ...candidate,
      lineageId: claimedLineageId,
      lineageOrigin: "root",
      localIdentity,
      originLineageId: claimedOriginLineageId,
      parentLineageId: null,
      throughStepNumber,
    });
  } else if (properties.lineageOrigin === "descendant") {
    if (throughStepNumber === 0) {
      throw new TypeError(
        "Real-build descendant lineage must have a positive throughStepNumber and non-null parentLineageId.",
      );
    }
    const parentLineageId = requireLineageId(
      properties.parentLineageId,
      "Real-build descendant lineage parentLineageId",
    );
    expectedLineageId = deriveLineageId({
      ...candidate,
      lineageOrigin: "descendant",
      originLineageId: claimedOriginLineageId,
      parentLineageId,
      throughStepNumber,
      localIdentity,
    });
    identity = Object.freeze({
      ...candidate,
      lineageId: claimedLineageId,
      lineageOrigin: "descendant",
      localIdentity,
      originLineageId: claimedOriginLineageId,
      parentLineageId,
      throughStepNumber,
    });
  } else {
    throw new TypeError(
      `Real-build lineage identity lineageOrigin must be exactly "root" or "descendant".`,
    );
  }
  if (claimedLineageId !== expectedLineageId) {
    throw new TypeError(
      "Real-build lineage identity lineageId does not match its canonical candidate, document hash, parent, run-root origin, step, and local evidence/decision identity commitment.",
    );
  }
  digestValidatedLineages.add(identity);
  return identity;
}

export function assertRealBuildLineageParent(
  child: DetachedRealBuildLineageIdentity,
  parent: DetachedRealBuildLineageIdentity | null,
): void {
  if (
    !digestValidatedLineages.has(child) ||
    (parent !== null && !digestValidatedLineages.has(parent))
  ) {
    throw new TypeError(
      "Real-build lineage parent check requires digest-valid identities returned by this module's snapshot or creator.",
    );
  }
  if (
    (child.lineageOrigin === "root" && parent !== null) ||
    (child.lineageOrigin === "descendant" && parent === null) ||
    child.parentLineageId !== (parent?.lineageId ?? null) ||
    child.originLineageId !== (parent?.originLineageId ?? child.lineageId) ||
    (parent !== null && child.throughStepNumber < parent.throughStepNumber)
  ) {
    throw new TypeError(
      "Real-build lineage does not match the exact direct parent, inherited run-root origin, or monotonic step semantics.",
    );
  }
  if (parent === null || linkedLineages.has(parent)) linkedLineages.add(child);
}
