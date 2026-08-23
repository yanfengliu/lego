import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { writeContainedFileAtomic } from "./part-identification-contained-write.mjs";
import {
  deeplyFreezeGate0,
  exactGate0Array,
  exactGate0Object,
  failGate0,
  gate0ArrayMap,
  gate0Digest,
  gate0Integer,
  gate0PolicyReview,
  partIdentificationGate0BytesDigest,
  partIdentificationGate0Digest,
  partIdentificationGate0JsonBytes,
  PART_IDENTIFICATION_GATE0_POLICY_SCHEMA,
  PART_IDENTIFICATION_GATE0_POLICY_SOURCES,
  sameGate0Value,
} from "./part-identification-gate0-foundation.mjs";
import { readContainedFile } from "./part-identification-io.mjs";
import { PART_IDENTIFICATION_GATE0_DEFAULT_ROOT } from "./part-identification-gate0-root.mjs";
import { parseStrictJsonBytes } from "./part-identification-strict-json.mjs";

export const PART_IDENTIFICATION_GATE0_POLICY_EVIDENCE_SCHEMA =
  "lego.part-identification-gate0-policy-evidence/1";
const MAX_POLICY_BODY_BYTES = 512 * 1024;
const MAX_POLICY_RECORD_BYTES = 64 * 1024;
const MIN_POLICY_BODY_BYTES = 4 * 1024;
const POLICY_FETCH_TIMEOUT_MS = 15_000;
const SHA256 = /^sha256:([0-9a-f]{64})$/u;
const dateNow = Date.now.bind(Date);
const arrayPush = Function.call.bind(Array.prototype.push);
const bufferEquals = Function.call.bind(Buffer.prototype.equals);
const bufferConcat = Buffer.concat;
const fetchDefault = globalThis.fetch.bind(globalThis);
const stringStartsWith = Function.call.bind(String.prototype.startsWith);
const stringToLowerCase = Function.call.bind(String.prototype.toLowerCase);

function digestKey(value, label) {
  const digest = gate0Digest(value, label);
  const match = SHA256.exec(digest);
  if (match === null) failGate0(`${label} is not a content-addressable SHA-256.`);
  return match[1];
}

function bodyPath(digest) {
  return `policy-bodies/${digestKey(digest, "Policy body digest")}.html`;
}

function evidencePath(digest) {
  return `policy-reviews/${digestKey(digest, "Policy evidence digest")}.json`;
}

function publishContentAddressed(root, path, bytes, maxBytes, label) {
  try {
    writeContainedFileAtomic(root, path, bytes, {
      exclusive: true,
      label,
      pathLabel: `${label} path`,
      rootLabel: "Gate-0 local state root",
    });
  } catch (error) {
    if (!existsSync(resolve(root, ...path.split("/")))) throw error;
    const retained = readContainedFile(root, path, { maxBytes, label });
    if (!bufferEquals(retained, bytes)) {
      failGate0(`${label} path exists with bytes different from its content address.`);
    }
  }
}

async function boundedPolicyBody(response, label) {
  const reader = response.body?.getReader?.();
  if (reader === undefined) failGate0(`${label} has no bounded readable response body.`);
  const chunks = [];
  let total = 0;
  for (;;) {
    const record = await reader.read();
    if (record.done === true) break;
    if (!(record.value instanceof Uint8Array)) failGate0(`${label} returned a non-byte chunk.`);
    total += record.value.byteLength;
    if (total > MAX_POLICY_BODY_BYTES) {
      await reader.cancel().catch(() => {});
      failGate0(`${label} exceeds the ${MAX_POLICY_BODY_BYTES}-byte evidence ceiling.`);
    }
    arrayPush(chunks, Buffer.from(record.value));
  }
  if (total < MIN_POLICY_BODY_BYTES) {
    failGate0(`${label} is too small to retain as the reviewed official article.`);
  }
  return bufferConcat(chunks, total);
}

async function fetchPolicyBody(source, fetchImpl) {
  let response;
  try {
    response = await fetchImpl(source.officialUrl, {
      cache: "no-store",
      credentials: "omit",
      redirect: "error",
      referrerPolicy: "no-referrer",
      signal: AbortSignal.timeout(POLICY_FETCH_TIMEOUT_MS),
      headers: { accept: "text/html" },
    });
  } catch (cause) {
    throw new Error(`Gate-0 could not retrieve the exact official ${source.topic} article.`, {
      cause,
    });
  }
  const contentType = response.headers?.get?.("content-type") ?? "";
  if (
    response.status !== 200 ||
    response.url !== source.officialUrl ||
    !stringStartsWith(stringToLowerCase(contentType), "text/html")
  ) {
    failGate0(
      `Gate-0 ${source.topic} evidence must be a direct 200 text/html response from its exact official URL.`,
    );
  }
  const bytes = await boundedPolicyBody(response, `Gate-0 ${source.topic} evidence`);
  return { bytes, contentType };
}

function policyEvidenceCore(policyReview, bodies) {
  return {
    schemaVersion: PART_IDENTIFICATION_GATE0_POLICY_EVIDENCE_SCHEMA,
    policyReview,
    bodies,
  };
}

function verifyEvidenceEnvelope(value, proposedAtMs) {
  exactGate0Object(
    value,
    ["schemaVersion", "policyReview", "bodies", "evidenceDigest"],
    "Gate-0 policy evidence",
  );
  if (value.schemaVersion !== PART_IDENTIFICATION_GATE0_POLICY_EVIDENCE_SCHEMA)
    failGate0("Gate-0 policy evidence schema is not current.");
  const policyReview = gate0PolicyReview(value.policyReview, proposedAtMs);
  exactGate0Array(value.bodies, PART_IDENTIFICATION_GATE0_POLICY_SOURCES.length, "Policy bodies");
  const bodies = gate0ArrayMap(value.bodies, (body, index) => {
    exactGate0Object(
      body,
      ["topic", "officialUrl", "contentDigest", "byteLength", "contentType", "path"],
      `Policy body ${index}`,
    );
    const source = policyReview.sources[index];
    gate0Integer(
      body.byteLength,
      MIN_POLICY_BODY_BYTES,
      MAX_POLICY_BODY_BYTES,
      "Policy body bytes",
    );
    if (
      body.topic !== source.topic ||
      body.officialUrl !== source.officialUrl ||
      body.contentDigest !== source.contentDigest ||
      typeof body.contentType !== "string" ||
      !stringStartsWith(stringToLowerCase(body.contentType), "text/html") ||
      body.path !== bodyPath(body.contentDigest)
    ) {
      failGate0(`Policy body ${index} does not bind its exact reviewed source.`);
    }
    return {
      topic: body.topic,
      officialUrl: body.officialUrl,
      contentDigest: body.contentDigest,
      byteLength: body.byteLength,
      contentType: body.contentType,
      path: body.path,
    };
  });
  const core = policyEvidenceCore(policyReview, bodies);
  if (value.evidenceDigest !== partIdentificationGate0Digest(core))
    failGate0("Gate-0 policy evidence digest does not reproduce its canonical core.");
  return deeplyFreezeGate0({ ...core, evidenceDigest: value.evidenceDigest });
}

export async function retrievePartIdentificationGate0PolicyEvidence(options = {}) {
  const root = resolve(options.root ?? PART_IDENTIFICATION_GATE0_DEFAULT_ROOT);
  const fetchImpl = options.fetchImpl ?? fetchDefault;
  const bodies = [];
  const sources = [];
  for (let index = 0; index < PART_IDENTIFICATION_GATE0_POLICY_SOURCES.length; index += 1) {
    const source = PART_IDENTIFICATION_GATE0_POLICY_SOURCES[index];
    const response = await fetchPolicyBody(source, fetchImpl);
    const retrievedAtMs = dateNow();
    const contentDigest = partIdentificationGate0BytesDigest(response.bytes);
    const path = bodyPath(contentDigest);
    publishContentAddressed(
      root,
      path,
      response.bytes,
      MAX_POLICY_BODY_BYTES,
      `Gate-0 ${source.topic} policy body`,
    );
    arrayPush(sources, { ...source, contentDigest, retrievedAtMs });
    arrayPush(bodies, {
      ...source,
      contentDigest,
      byteLength: response.bytes.length,
      contentType: response.contentType,
      path,
    });
  }
  const reviewedAtMs = dateNow();
  const policyReview = {
    schemaVersion: PART_IDENTIFICATION_GATE0_POLICY_SCHEMA,
    evidenceBasis: "official-provider-published-consumer-policy",
    sourceAuthentication: "url-and-content-digest/not-authenticated-by-contract",
    reviewedAtMs,
    sources,
  };
  const core = policyEvidenceCore(gate0PolicyReview(policyReview, reviewedAtMs), bodies);
  const evidence = verifyEvidenceEnvelope(
    { ...core, evidenceDigest: partIdentificationGate0Digest(core) },
    reviewedAtMs,
  );
  const bytes = partIdentificationGate0JsonBytes(evidence);
  const path = evidencePath(evidence.evidenceDigest);
  publishContentAddressed(root, path, bytes, MAX_POLICY_RECORD_BYTES, "Gate-0 policy review");
  return deeplyFreezeGate0({
    policyReview: evidence.policyReview,
    reference: { path, digest: evidence.evidenceDigest, byteLength: bytes.length },
  });
}

export function verifyRetainedPartIdentificationGate0PolicyEvidence(
  reference,
  proposedAtMs,
  options = {},
) {
  exactGate0Object(reference, ["path", "digest", "byteLength"], "Policy evidence reference");
  gate0Integer(reference.byteLength, 1, MAX_POLICY_RECORD_BYTES, "Policy evidence byteLength");
  if (reference.path !== evidencePath(reference.digest))
    failGate0("Policy evidence reference path does not equal its digest-derived path.");
  const root = resolve(options.root ?? PART_IDENTIFICATION_GATE0_DEFAULT_ROOT);
  const bytes = readContainedFile(root, reference.path, {
    maxBytes: MAX_POLICY_RECORD_BYTES,
    label: "Gate-0 policy review",
  });
  if (bytes.length !== reference.byteLength) failGate0("Policy evidence byteLength changed.");
  const evidence = verifyEvidenceEnvelope(parseStrictJsonBytes(bytes), proposedAtMs);
  if (evidence.evidenceDigest !== reference.digest)
    failGate0("Policy evidence reference digest does not equal its retained envelope.");
  for (let index = 0; index < evidence.bodies.length; index += 1) {
    const body = evidence.bodies[index];
    const bodyBytes = readContainedFile(root, body.path, {
      maxBytes: MAX_POLICY_BODY_BYTES,
      label: `Gate-0 ${body.topic} policy body`,
    });
    if (
      bodyBytes.length !== body.byteLength ||
      partIdentificationGate0BytesDigest(bodyBytes) !== body.contentDigest
    ) {
      failGate0(`Gate-0 ${body.topic} retained policy bytes changed.`);
    }
  }
  if (
    !sameGate0Value(evidence.policyReview, gate0PolicyReview(evidence.policyReview, proposedAtMs))
  )
    failGate0("Gate-0 policy review is not canonical.");
  return evidence.policyReview;
}

export const __testOnly = Object.freeze({ bodyPath, evidencePath });
