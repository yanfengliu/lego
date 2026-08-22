import { existsSync, lstatSync } from "node:fs";
import { join } from "node:path";

import { authenticateJsonArtifact } from "./part-identification-artifact-source.mjs";
import {
  assertInternallyValidPartIdentificationCheckpoint,
  PART_ANSWERS_SCHEMA,
  PART_IDENTIFICATION_ANSWER_FIELDS,
  validPartIdentificationCheckpointReference,
} from "./part-identification-answer-state.mjs";
import { callProofJsonBytes, callProofSha256 } from "./part-identification-call-proof-digest.mjs";
import {
  MAX_JSON_ARTIFACT_BYTES,
  boundedDirectoryFiles,
  readContainedFile,
  writeContainedFile,
} from "./part-identification-io.mjs";
import {
  exactOwnKeys,
  isArray,
  isOrdinaryObject,
  own,
  ownKeys,
  setAdd,
  setDelete,
  setHas,
  setSize,
} from "./part-identification-safe-shape.mjs";
import { publishImmutableContainedBytes } from "./part-identification-immutable-cas.mjs";
import {
  PART_IDENTIFICATION_MAX_CALLS,
  PART_IDENTIFICATION_TRANSPORT_CONTRACT_DIGEST,
} from "./part-identification-transport-contract.mjs";

export { PART_ANSWERS_SCHEMA, PART_IDENTIFICATION_ANSWER_FIELDS };

const MAX_CHAIN_BYTES = 96 * 1024 * 1024;
const NativeSet = Set;

function referenceFor(bytes, digest = callProofSha256(bytes)) {
  const hex = digest.slice("sha256:".length);
  return {
    path: `answer-checkpoints/sha256/${hex}.json`,
    byteLength: bytes.length,
    digest,
  };
}

function validReference(reference) {
  return validPartIdentificationCheckpointReference(reference);
}

function readReference(out, reference, traceArtifacts = null) {
  if (!validReference(reference))
    throw new Error("Answer checkpoint predecessor reference is malformed.");
  const bytes =
    isOrdinaryObject(traceArtifacts) && own(traceArtifacts, reference.path)
      ? Buffer.from(traceArtifacts[reference.path])
      : readContainedFile(out, reference.path, {
          label: "Immutable part-identification answer checkpoint",
          pathLabel: "Answer-checkpoint path",
          maxBytes: MAX_JSON_ARTIFACT_BYTES,
        });
  if (bytes.length !== reference.byteLength || callProofSha256(bytes) !== reference.digest) {
    throw new Error("Answer checkpoint predecessor does not reproduce its exact retained bytes.");
  }
  return authenticateJsonArtifact(
    { bytes, digest: reference.digest },
    "immutable part-identification answer checkpoint",
  );
}

export function auditPartIdentificationAnswerCheckpointStore(
  out,
  allowedDigests = new NativeSet(),
  traceArtifacts = null,
) {
  if (isOrdinaryObject(traceArtifacts)) {
    const keys = ownKeys(traceArtifacts);
    let entries = 0;
    let aggregate = 0;
    for (let index = 0; index < keys.length; index += 1) {
      const path = keys[index];
      if (!/^answer-checkpoints\/sha256\/[0-9a-f]{64}\.json$/u.test(path)) continue;
      entries += 1;
      const bytes = Buffer.from(traceArtifacts[path]);
      aggregate += bytes.length;
      const digest = `sha256:${path.slice("answer-checkpoints/sha256/".length, -".json".length)}`;
      if (
        bytes.length < 1 ||
        bytes.length > MAX_JSON_ARTIFACT_BYTES ||
        aggregate > MAX_CHAIN_BYTES ||
        !setHas(allowedDigests, digest)
      ) {
        throw new Error(
          "In-memory answer-checkpoint artifacts contain a malformed or orphaned node.",
        );
      }
    }
    if (entries !== setSize(allowedDigests)) {
      throw new Error(
        "In-memory answer-checkpoint artifacts and current lineage have different node counts.",
      );
    }
    return aggregate;
  }
  const root = join(out, "answer-checkpoints", "sha256");
  if (!existsSync(root)) {
    if (setSize(allowedDigests) === 0) return 0;
    throw new Error("Answer-checkpoint store is absent for the current immutable lineage.");
  }
  const files = boundedDirectoryFiles(root, {
    label: "Part-identification answer-checkpoint store",
    maxEntries: PART_IDENTIFICATION_MAX_CALLS,
  });
  let aggregate = 0;
  for (let index = 0; index < files.length; index += 1) {
    const name = files[index];
    const digest = `sha256:${name.slice(0, -".json".length)}`;
    const stats = lstatSync(join(root, name), { bigint: true });
    const size = Number(stats.size);
    if (
      !/^[0-9a-f]{64}\.json$/u.test(name) ||
      !stats.isFile() ||
      stats.isSymbolicLink() ||
      size < 1 ||
      size > MAX_JSON_ARTIFACT_BYTES
    ) {
      throw new Error(`Answer-checkpoint store entry ${JSON.stringify(name)} is not canonical.`);
    }
    aggregate += size;
    if (aggregate > MAX_CHAIN_BYTES) {
      throw new Error("Answer-checkpoint store exceeds its complete generation byte ceiling.");
    }
    if (!setHas(allowedDigests, digest)) {
      throw new Error(
        `Answer-checkpoint store entry ${JSON.stringify(name)} is crash-orphaned from the current pointer lineage.`,
      );
    }
  }
  if (files.length !== setSize(allowedDigests)) {
    throw new Error(
      "Answer-checkpoint store and current predecessor lineage have different node counts.",
    );
  }
  return aggregate;
}

function sameJson(left, right) {
  return callProofJsonBytes(left).equals(callProofJsonBytes(right));
}

function bindingFieldsEqual(child, parent) {
  for (const key of [
    "schemaVersion",
    "model",
    "modelIdentity",
    "matchDigest",
    "cardsDigest",
    "promptDigest",
    "transportContractDigest",
  ]) {
    if (!sameJson(child[key], parent[key])) return false;
  }
  return true;
}

function assertAppendOnlyTransition(child, parent) {
  if (
    !exactOwnKeys(parent, PART_IDENTIFICATION_ANSWER_FIELDS) ||
    parent.schemaVersion !== PART_ANSWERS_SCHEMA ||
    parent.transportContractDigest !== PART_IDENTIFICATION_TRANSPORT_CONTRACT_DIGEST ||
    !isOrdinaryObject(parent.calls) ||
    !isOrdinaryObject(parent.attempts) ||
    !isOrdinaryObject(parent.answers) ||
    !bindingFieldsEqual(child, parent)
  ) {
    throw new Error(
      "Answer checkpoint predecessor has a different schema, transport, or source binding.",
    );
  }
  const parentCalls = ownKeys(parent.calls);
  const childCalls = ownKeys(child.calls);
  if (childCalls.length !== parentCalls.length + 1) {
    throw new Error(
      "Each answer checkpoint must append exactly one call proof to its predecessor.",
    );
  }
  let appendedCallDigest = null;
  for (let index = 0; index < childCalls.length; index += 1) {
    const digest = childCalls[index];
    if (own(parent.calls, digest)) {
      if (!sameJson(child.calls[digest], parent.calls[digest])) {
        throw new Error(`Answer checkpoint changed retained call ${digest}.`);
      }
    } else if (appendedCallDigest === null) appendedCallDigest = digest;
    else throw new Error("Answer checkpoint appended more than one new call.");
  }
  if (appendedCallDigest === null)
    throw new Error("Answer checkpoint did not append its new call.");
  const appendedCall = child.calls[appendedCallDigest];
  const appendedCards = new NativeSet();
  for (let index = 0; index < appendedCall.orderedCardIds.length; index += 1) {
    setAdd(appendedCards, appendedCall.orderedCardIds[index]);
  }
  let appendedAttempts = 0;
  const childAttemptKeys = ownKeys(child.attempts);
  const parentAttemptKeys = ownKeys(parent.attempts);
  for (let index = 0; index < parentAttemptKeys.length; index += 1) {
    if (!own(child.attempts, parentAttemptKeys[index])) {
      throw new Error(`Answer checkpoint deleted attempt lineage for ${parentAttemptKeys[index]}.`);
    }
  }
  for (let keyIndex = 0; keyIndex < childAttemptKeys.length; keyIndex += 1) {
    const key = childAttemptKeys[keyIndex];
    const before = own(parent.attempts, key) ? parent.attempts[key] : [];
    const after = child.attempts[key];
    if (
      !isArray(before) ||
      !isArray(after) ||
      after.length < before.length ||
      after.length > before.length + 1
    ) {
      throw new Error(`Answer checkpoint attempt list ${key} is not a one-record append.`);
    }
    for (let index = 0; index < before.length; index += 1) {
      if (!sameJson(before[index], after[index])) {
        throw new Error(`Answer checkpoint rewrote attempt ${key}[${index}].`);
      }
    }
    if (after.length === before.length) {
      if (!sameJson(child.answers[key], parent.answers[key])) {
        throw new Error(`Answer checkpoint changed answer ${key} without one appended attempt.`);
      }
      continue;
    }
    const record = after[after.length - 1];
    if (record.callDigest !== appendedCallDigest || !setHas(appendedCards, record.cardId)) {
      throw new Error(`Answer checkpoint attempt ${key} is not owned by its one appended call.`);
    }
    setDelete(appendedCards, record.cardId);
    appendedAttempts += 1;
  }
  if (appendedAttempts !== appendedCall.orderedCardIds.length || setSize(appendedCards) !== 0) {
    throw new Error(
      "Answer checkpoint did not append exactly one owned attempt per new call card.",
    );
  }
  const parentAnswerKeys = ownKeys(parent.answers);
  for (let index = 0; index < parentAnswerKeys.length; index += 1) {
    if (!own(child.answers, parentAnswerKeys[index])) {
      throw new Error(`Answer checkpoint deleted answer ${parentAnswerKeys[index]}.`);
    }
  }
}

export function verifyPartIdentificationAnswerLineage(
  artifact,
  bundle,
  out,
  traceArtifacts = null,
) {
  if ((typeof out !== "string" || out.length === 0) && !isOrdinaryObject(traceArtifacts)) {
    throw new Error(
      "Answer checkpoint lineage requires its exact retained output root or explicit content-addressed artifacts.",
    );
  }
  const current = authenticateJsonArtifact(artifact, "part-identification answers");
  assertInternallyValidPartIdentificationCheckpoint(bundle);
  const currentReference = referenceFor(current.bytes, current.digest);
  const retainedCurrent = readReference(out, currentReference, traceArtifacts);
  if (!retainedCurrent.bytes.equals(current.bytes)) {
    throw new Error(
      "Mutable answer pointer does not reproduce its immutable current checkpoint bytes.",
    );
  }
  const seen = new NativeSet();
  setAdd(seen, current.digest);
  let child = bundle;
  let reference = bundle.predecessor;
  let chainBytes = current.bytes.length;
  let nodes = 1;
  while (reference !== null) {
    if (!validReference(reference) || setHas(seen, reference.digest)) {
      throw new Error("Answer checkpoint predecessor chain is malformed or cyclic.");
    }
    setAdd(seen, reference.digest);
    chainBytes += reference.byteLength;
    nodes += 1;
    if (chainBytes > MAX_CHAIN_BYTES || nodes > PART_IDENTIFICATION_MAX_CALLS) {
      throw new Error(
        "Answer checkpoint predecessor chain exceeds its bounded bytes or node count.",
      );
    }
    const parentArtifact = readReference(out, reference, traceArtifacts);
    const parent = parentArtifact.value;
    assertInternallyValidPartIdentificationCheckpoint(parent);
    assertAppendOnlyTransition(child, parent);
    child = parent;
    reference = parent.predecessor;
  }
  if (ownKeys(child.calls).length !== 1) {
    throw new Error(
      "First immutable answer checkpoint must own exactly one successful provider call.",
    );
  }
  auditPartIdentificationAnswerCheckpointStore(out, seen, traceArtifacts);
  return currentReference;
}

export function publishPartIdentificationAnswerCheckpoint(out, pointerPath, bundle) {
  if (!exactOwnKeys(bundle, PART_IDENTIFICATION_ANSWER_FIELDS)) {
    throw new Error("Only an exact /5 answer bundle can enter the immutable checkpoint store.");
  }
  assertInternallyValidPartIdentificationCheckpoint(bundle);
  const bytes = callProofJsonBytes(bundle);
  const reference = referenceFor(bytes);
  const seen = new NativeSet();
  setAdd(seen, reference.digest);
  let child = bundle;
  let predecessor = bundle.predecessor;
  let chainBytes = bytes.length;
  let nodes = 1;
  while (predecessor !== null) {
    if (!validReference(predecessor) || setHas(seen, predecessor.digest)) {
      throw new Error("Answer checkpoint predecessor chain is malformed or cyclic.");
    }
    setAdd(seen, predecessor.digest);
    chainBytes += predecessor.byteLength;
    nodes += 1;
    if (chainBytes > MAX_CHAIN_BYTES || nodes > PART_IDENTIFICATION_MAX_CALLS) {
      throw new Error(
        "Answer checkpoint predecessor chain exceeds its bounded bytes or node count.",
      );
    }
    const parent = readReference(out, predecessor).value;
    assertInternallyValidPartIdentificationCheckpoint(parent);
    assertAppendOnlyTransition(child, parent);
    child = parent;
    predecessor = parent.predecessor;
  }
  if (ownKeys(child.calls).length !== 1) {
    throw new Error(
      "First immutable answer checkpoint must own exactly one successful provider call.",
    );
  }
  publishImmutableContainedBytes(out, reference.path, bytes, {
    label: "Immutable part-identification answer checkpoint",
    pathLabel: "Answer-checkpoint path",
    maxBytes: MAX_JSON_ARTIFACT_BYTES,
  });
  const reopened = readReference(out, reference);
  if (!reopened.bytes.equals(bytes)) {
    throw new Error("Published immutable answer checkpoint did not reopen as exact bytes.");
  }
  writeContainedFile(out, pointerPath, bytes, {
    label: "Current part-identification answer pointer",
    pathLabel: "Answer pointer path",
    maxBytes: MAX_JSON_ARTIFACT_BYTES,
  });
  return reference;
}
