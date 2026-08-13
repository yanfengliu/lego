import {
  canonicalStringify,
  documentStructuralHash,
  normalizeBrickDocument,
  sha256Hex,
} from "@lego-studio/brick-kernel";
import { validateBrickDocumentV1, type BrickDocumentV1 } from "@lego-studio/protocol";

import {
  REAL_BUILD_SHA256_DIGEST_PATTERN,
  type RealBuildLineageIdentity,
} from "./real-build-candidate-lineage-identity";

export const MAXIMUM_REAL_BUILD_CANDIDATE_DOCUMENT_BYTES = 16 * 1024 * 1024;
const MAXIMUM_REAL_BUILD_CANDIDATE_DOCUMENT_DEPTH = 128;
const MAXIMUM_REAL_BUILD_CANDIDATE_DOCUMENT_NODES = 1_000_000;
const MAXIMUM_REAL_BUILD_CANDIDATE_DOCUMENT_PARTS = 10_000;
const MAXIMUM_REAL_BUILD_CANDIDATE_DOCUMENT_CONNECTIONS = 50_000;

declare const candidateDocumentType: unique symbol;

export type RealBuildCandidateDocumentSnapshot = Readonly<{
  canonicalBytes: string;
  canonicalByteLength: number;
  canonicalBytesHash: `sha256:${string}`;
  document: BrickDocumentV1;
  documentHash: RealBuildLineageIdentity["documentHash"];
  readonly [candidateDocumentType]: BrickDocumentV1;
}>;

const snapshots = new WeakSet<object>();

function dataProperty(value: unknown, key: string, label: string): unknown {
  if (value === null || (typeof value !== "object" && typeof value !== "function")) {
    throw new TypeError(`${label} must contain an own data property ${key}.`);
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

function utf8ByteLength(value: string): number {
  let bytes = 0;
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code <= 0x7f) bytes += 1;
    else if (code <= 0x7ff) bytes += 2;
    else if (code >= 0xd800 && code <= 0xdbff && index + 1 < value.length) {
      const next = value.charCodeAt(index + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        bytes += 4;
        index += 1;
      } else bytes += 3;
    } else bytes += 3;
    if (bytes > MAXIMUM_REAL_BUILD_CANDIDATE_DOCUMENT_BYTES) return bytes;
  }
  return bytes;
}

function requireBoundedJsonDepth(value: string): void {
  let depth = 0;
  let nodes = 1;
  let inString = false;
  let escaped = false;
  for (const character of value) {
    if (inString) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === '"') inString = false;
      continue;
    }
    if (character === '"') inString = true;
    else if (character === "{" || character === "[") {
      depth += 1;
      nodes += 1;
      if (depth > MAXIMUM_REAL_BUILD_CANDIDATE_DOCUMENT_DEPTH) {
        throw new TypeError("Candidate document canonical JSON exceeds its depth limit.");
      }
    } else if (character === "}" || character === "]") depth -= 1;
    else if (character === ",") nodes += 1;
    if (nodes > MAXIMUM_REAL_BUILD_CANDIDATE_DOCUMENT_NODES) {
      throw new TypeError(
        `Candidate document canonical JSON exceeds ${MAXIMUM_REAL_BUILD_CANDIDATE_DOCUMENT_NODES} structural values; reject it before parsing.`,
      );
    }
    if (depth < 0) throw new TypeError("Candidate document canonical JSON is malformed.");
  }
  if (inString || depth !== 0) {
    throw new TypeError("Candidate document canonical JSON is malformed.");
  }
}

/** The graph has already come from bounded JSON.parse, so it cannot contain traps or aliases. */
function deepFreezeParsedJson(value: unknown): void {
  const pending: { readonly value: unknown; readonly depth: number }[] = [{ value, depth: 0 }];
  const objects: object[] = [];
  let nodes = 0;
  while (pending.length > 0) {
    const current = pending.pop()!;
    nodes += 1;
    if (nodes > MAXIMUM_REAL_BUILD_CANDIDATE_DOCUMENT_NODES) {
      throw new TypeError("Candidate document exceeds its aggregate parsed-data node limit.");
    }
    if (current.value === null || typeof current.value !== "object") continue;
    if (current.depth > MAXIMUM_REAL_BUILD_CANDIDATE_DOCUMENT_DEPTH) {
      throw new TypeError("Candidate document exceeds its parsed-data depth limit.");
    }
    objects.push(current.value);
    if (Array.isArray(current.value)) {
      for (const child of current.value) pending.push({ value: child, depth: current.depth + 1 });
    } else {
      for (const child of Object.values(current.value)) {
        pending.push({ value: child, depth: current.depth + 1 });
      }
    }
  }
  for (let index = objects.length - 1; index >= 0; index -= 1) Object.freeze(objects[index]!);
}

/**
 * Parses bounded canonical bytes and binds them to the kernel-owned structural hash.
 * No caller object is enumerated and no callback can supply a hash result.
 */
export function createRealBuildCandidateDocumentSnapshot(input: {
  readonly canonicalDocument: string;
  readonly expectedDocumentHash: RealBuildLineageIdentity["documentHash"];
}): RealBuildCandidateDocumentSnapshot {
  const canonicalDocument = dataProperty(
    input,
    "canonicalDocument",
    "Candidate document snapshot input",
  );
  const expectedDocumentHash = dataProperty(
    input,
    "expectedDocumentHash",
    "Candidate document snapshot input",
  );
  if (
    typeof expectedDocumentHash !== "string" ||
    !REAL_BUILD_SHA256_DIGEST_PATTERN.test(expectedDocumentHash)
  ) {
    throw new TypeError("Candidate document snapshot expectedDocumentHash is not a sha256 digest.");
  }
  if (typeof canonicalDocument !== "string") {
    throw new TypeError(
      `Candidate canonicalDocument must be a string no larger than ${MAXIMUM_REAL_BUILD_CANDIDATE_DOCUMENT_BYTES} UTF-8 bytes.`,
    );
  }
  const canonicalByteLength = utf8ByteLength(canonicalDocument);
  if (canonicalByteLength > MAXIMUM_REAL_BUILD_CANDIDATE_DOCUMENT_BYTES) {
    throw new TypeError(
      `Candidate canonicalDocument must be a string no larger than ${MAXIMUM_REAL_BUILD_CANDIDATE_DOCUMENT_BYTES} UTF-8 bytes.`,
    );
  }
  requireBoundedJsonDepth(canonicalDocument);
  let parsed: unknown;
  try {
    parsed = JSON.parse(canonicalDocument);
  } catch {
    throw new TypeError("Candidate canonicalDocument is not valid bounded JSON.");
  }
  if (!validateBrickDocumentV1(parsed)) {
    throw new TypeError("Candidate canonicalDocument is not a valid BrickDocumentV1.");
  }
  if (
    parsed.parts.length > MAXIMUM_REAL_BUILD_CANDIDATE_DOCUMENT_PARTS ||
    parsed.connections.length > MAXIMUM_REAL_BUILD_CANDIDATE_DOCUMENT_CONNECTIONS
  ) {
    throw new TypeError(
      `Candidate BrickDocument exceeds the ${MAXIMUM_REAL_BUILD_CANDIDATE_DOCUMENT_PARTS}-part or ${MAXIMUM_REAL_BUILD_CANDIDATE_DOCUMENT_CONNECTIONS}-connection snapshot bound.`,
    );
  }
  if (canonicalStringify(normalizeBrickDocument(parsed)) !== canonicalDocument) {
    throw new TypeError("Candidate BrickDocument bytes are not exact kernel canonical JSON.");
  }
  const measuredHash = documentStructuralHash(parsed);
  if (measuredHash !== expectedDocumentHash) {
    throw new TypeError(
      "Candidate BrickDocument structural hash does not match identity.documentHash.",
    );
  }
  deepFreezeParsedJson(parsed);
  const snapshot = Object.freeze({
    canonicalBytes: canonicalDocument,
    canonicalByteLength,
    canonicalBytesHash: `sha256:${sha256Hex(canonicalDocument)}`,
    document: parsed,
    documentHash: measuredHash,
  }) as RealBuildCandidateDocumentSnapshot;
  snapshots.add(snapshot);
  return snapshot;
}

export function requireRealBuildCandidateDocumentSnapshot(
  value: unknown,
  identity: Pick<RealBuildLineageIdentity, "documentHash">,
): RealBuildCandidateDocumentSnapshot {
  let snapshot: RealBuildCandidateDocumentSnapshot;
  try {
    snapshot = requireRealBuildCandidateDocumentSnapshotValue(value);
  } catch {
    throw new TypeError(
      "Candidate lineage requires a module-created immutable BrickDocument snapshot bound to identity.documentHash.",
    );
  }
  let identityDocumentHash: unknown;
  try {
    const descriptor = Object.getOwnPropertyDescriptor(identity, "documentHash");
    identityDocumentHash =
      descriptor !== undefined && "value" in descriptor ? descriptor.value : null;
  } catch {
    identityDocumentHash = null;
  }
  if (snapshot.documentHash !== identityDocumentHash) {
    throw new TypeError(
      "Candidate lineage requires a module-created immutable BrickDocument snapshot bound to identity.documentHash.",
    );
  }
  return snapshot;
}

/** Checks private provenance before reading any snapshot field. */
export function requireRealBuildCandidateDocumentSnapshotValue(
  value: unknown,
): RealBuildCandidateDocumentSnapshot {
  if (value === null || typeof value !== "object" || !snapshots.has(value)) {
    throw new TypeError(
      "Candidate document must be the exact immutable snapshot returned by this module.",
    );
  }
  return value as RealBuildCandidateDocumentSnapshot;
}
