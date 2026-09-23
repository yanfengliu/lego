import { createHash } from "node:crypto";
import { lstat, mkdir, open, realpath } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";

import {
  canonicalDigest,
  canonicalStringify,
  documentStructuralHash,
  validateBrickDocument,
} from "@lego-studio/brick-kernel";

import type {
  RealBuildPrefix50SubBuildReturnReviewBatchEnvelope,
  RealBuildPrefix50SubBuildReturnReviewHarnessEnvelope,
} from "./real-build-prefix50-subbuild-return-contract.ts";
import { requireRealBuildPrefix50Step44ReviewBatchEnvelope } from "./real-build-prefix50-subbuild-return-review-batch-input.ts";
import { realBuildPrefix50SubBuildReturnReviewHarnessEnvelopeCommitment } from "./real-build-prefix50-subbuild-return-review-envelope.ts";

const CANDIDATE_KEY = /^[0-9a-f]{64}$/u;
const SHA256 = /^sha256:[0-9a-f]{64}$/u;
const MAXIMUM_INPUT_BYTES = 4 * 1024 * 1024;
export const REAL_BUILD_PREFIX50_STEP44_MAXIMUM_COMPACT_BATCH_BYTES = 16 * 1024 * 1024;
const MAXIMUM_OBJECT_KEYS = 128;
const MAXIMUM_STRING_LENGTH = 64 * 1024;

interface JsonStructureLimits {
  readonly maximumDepth: number;
  readonly maximumNodes: number;
  readonly maximumArrayItems: number;
}

const ENVELOPE_STRUCTURE_LIMITS: JsonStructureLimits = {
  maximumDepth: 48,
  maximumNodes: 200_000,
  maximumArrayItems: 8_192,
};
const BATCH_STRUCTURE_LIMITS: JsonStructureLimits = {
  maximumDepth: 52,
  maximumNodes: 4_000_000,
  maximumArrayItems: 32_768,
};

export const REAL_BUILD_PREFIX50_STEP44_REVIEW_OUTPUT_ROOT = resolve(
  "output/playwright/real-build-prefix50-step44-return-review",
);

function sha256(bytes: Uint8Array): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function exactKeys(value: unknown, expected: readonly string[], label: string): void {
  if (value === null || typeof value !== "object" || Array.isArray(value))
    throw new TypeError(`${label} must be a data object.`);
  const keys = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (keys.length !== wanted.length || keys.some((key, index) => key !== wanted[index]))
    throw new TypeError(`${label} must contain exactly ${wanted.join(", ")}.`);
}

export function preflightRealBuildPrefix50Step44ReviewJsonStructure(
  value: unknown,
  limits: JsonStructureLimits = ENVELOPE_STRUCTURE_LIMITS,
): void {
  const pending: { value: unknown; depth: number }[] = [{ value, depth: 0 }];
  let nodes = 0;
  while (pending.length > 0) {
    const row = pending.pop()!;
    nodes += 1;
    if (nodes > limits.maximumNodes)
      throw new RangeError(
        `Step-44 review input exceeds the ${limits.maximumNodes}-node JSON limit.`,
      );
    if (row.depth > limits.maximumDepth)
      throw new RangeError(
        `Step-44 review input exceeds the ${limits.maximumDepth}-level JSON depth limit.`,
      );
    if (typeof row.value === "string") {
      if (row.value.length > MAXIMUM_STRING_LENGTH)
        throw new RangeError(
          `Step-44 review input contains a string longer than ${MAXIMUM_STRING_LENGTH} characters.`,
        );
      continue;
    }
    if (row.value === null || typeof row.value !== "object") continue;
    if (Array.isArray(row.value)) {
      if (row.value.length > limits.maximumArrayItems)
        throw new RangeError(
          `Step-44 review input contains an array longer than ${limits.maximumArrayItems} items.`,
        );
      for (let index = row.value.length - 1; index >= 0; index -= 1)
        pending.push({ value: row.value[index], depth: row.depth + 1 });
      continue;
    }
    const entries = Object.entries(row.value);
    if (entries.length > MAXIMUM_OBJECT_KEYS)
      throw new RangeError(
        `Step-44 review input contains an object with more than ${MAXIMUM_OBJECT_KEYS} keys.`,
      );
    for (let index = entries.length - 1; index >= 0; index -= 1)
      pending.push({ value: entries[index]![1], depth: row.depth + 1 });
  }
}

function requireDigest(value: unknown, label: string): void {
  if (typeof value !== "string" || !SHA256.test(value))
    throw new TypeError(`${label} must be an exact sha256 digest.`);
}

export function requireRealBuildPrefix50Step44ReviewEnvelope(
  value: unknown,
): RealBuildPrefix50SubBuildReturnReviewHarnessEnvelope {
  exactKeys(
    value,
    [
      "authority",
      "candidateKey",
      "candidateRosterCommitment",
      "childSubBuildWindowCommitment",
      "commitment",
      "detachedStateCommitment",
      "projectionCommitment",
      "returnResultCommitment",
      "schemaVersion",
      "selectedDocument",
      "selectedDocumentCommitment",
      "selectedDocumentHash",
      "sourceDocumentHash",
      "sourceMemberRowsCommitment",
      "sourceSetId",
      "step42_43RepairCommitment",
      "step43PredecessorCommitment",
    ],
    "Step-44 review input",
  );
  const envelope = value as RealBuildPrefix50SubBuildReturnReviewHarnessEnvelope;
  const documentValue = envelope.selectedDocument as unknown;
  if (documentValue === null || typeof documentValue !== "object" || Array.isArray(documentValue))
    throw new TypeError("Step-44 review selectedDocument must be a bounded data object.");
  const documentShape = documentValue as Record<string, unknown>;
  if (
    !Array.isArray(documentShape.parts) ||
    documentShape.parts.length !== 280 ||
    !Array.isArray(documentShape.steps) ||
    documentShape.steps.length !== 43 ||
    !Array.isArray(documentShape.connections) ||
    documentShape.connections.length > 4_096
  )
    throw new TypeError(
      "Step-44 review input must preflight as exactly 280 parts, 43 steps, and at most 4096 connections before hashing.",
    );
  for (const [label, digest] of [
    ["returnResultCommitment", envelope.returnResultCommitment],
    ["candidateRosterCommitment", envelope.candidateRosterCommitment],
    ["projectionCommitment", envelope.projectionCommitment],
    ["childSubBuildWindowCommitment", envelope.childSubBuildWindowCommitment],
    ["sourceMemberRowsCommitment", envelope.sourceMemberRowsCommitment],
    ["detachedStateCommitment", envelope.detachedStateCommitment],
    ["step42_43RepairCommitment", envelope.step42_43RepairCommitment],
    ["step43PredecessorCommitment", envelope.step43PredecessorCommitment],
    ["sourceDocumentHash", envelope.sourceDocumentHash],
    ["selectedDocumentHash", envelope.selectedDocumentHash],
    ["selectedDocumentCommitment", envelope.selectedDocumentCommitment],
    ["commitment", envelope.commitment],
  ] as const)
    requireDigest(digest, `Step-44 review input.${label}`);
  if (
    envelope.schemaVersion !== "lego.real-build-prefix50-subbuild-return-review-harness-input/2" ||
    envelope.authority !== "none" ||
    envelope.sourceSetId !== "6651557" ||
    !CANDIDATE_KEY.test(envelope.candidateKey)
  )
    throw new TypeError(
      "Step-44 review input must be the closed authority-none set-6651557 review-envelope schema.",
    );
  const body = { ...envelope } as typeof envelope & { commitment?: unknown };
  Reflect.deleteProperty(body, "commitment");
  if (
    envelope.commitment !== realBuildPrefix50SubBuildReturnReviewHarnessEnvelopeCommitment(body) ||
    envelope.selectedDocumentCommitment !== canonicalDigest(envelope.selectedDocument)
  )
    throw new TypeError(
      "Step-44 review input self commitment or exact selected-document commitment is inconsistent.",
    );
  const measuredDocumentHash = documentStructuralHash(envelope.selectedDocument);
  const report = validateBrickDocument(envelope.selectedDocument);
  if (
    envelope.selectedDocumentHash !== measuredDocumentHash ||
    !report.documentGloballyValid ||
    report.targetDocumentHash !== measuredDocumentHash
  )
    throw new TypeError(
      "Step-44 review input must bind the exact globally-valid 280-part/43-step returned document.",
    );
  return envelope;
}

export function parseRealBuildPrefix50Step44ReviewArguments(argv: readonly string[]): {
  inputPath: string;
  expectedInputBytesHash: `sha256:${string}`;
  outputPath: string;
} | null {
  if (argv.length === 1 && (argv[0] === "--help" || argv[0] === "-h")) return null;
  if (
    argv.length !== 6 ||
    argv[0] !== "--input" ||
    argv[2] !== "--expected-input-sha256" ||
    argv[4] !== "--output"
  )
    throw new TypeError(
      "Expected --input <authority-none-envelope.json> --expected-input-sha256 <sha256:digest> --output <new-run-dir>.",
    );
  const inputPath = resolve(argv[1]!);
  const expectedInputBytesHash = argv[3]!;
  const outputPath = resolve(argv[5]!);
  requireDigest(expectedInputBytesHash, "--expected-input-sha256");
  for (const [label, path] of [
    ["input", inputPath],
    ["output", outputPath],
  ] as const) {
    const local = relative(REAL_BUILD_PREFIX50_STEP44_REVIEW_OUTPUT_ROOT, path);
    if (
      local.length === 0 ||
      local.startsWith("..") ||
      resolve(REAL_BUILD_PREFIX50_STEP44_REVIEW_OUTPUT_ROOT, local) !== path
    )
      throw new TypeError(
        `Step-44 review ${label} must be below ${REAL_BUILD_PREFIX50_STEP44_REVIEW_OUTPUT_ROOT}; received ${path}.`,
      );
  }
  if (
    dirname(inputPath) !== REAL_BUILD_PREFIX50_STEP44_REVIEW_OUTPUT_ROOT ||
    dirname(outputPath) !== REAL_BUILD_PREFIX50_STEP44_REVIEW_OUTPUT_ROOT
  )
    throw new TypeError("Step-44 review input and output must be direct task-root children.");
  return {
    inputPath,
    expectedInputBytesHash: expectedInputBytesHash as `sha256:${string}`,
    outputPath,
  };
}

async function readReviewJson(
  inputPath: string,
  maximumBytes: number,
  expectedBytesHash?: `sha256:${string}`,
): Promise<{ value: unknown; bytes: Buffer; bytesHash: `sha256:${string}` }> {
  await mkdir(REAL_BUILD_PREFIX50_STEP44_REVIEW_OUTPUT_ROOT, { recursive: true });
  const [realRoot, realInput] = await Promise.all([
    realpath(REAL_BUILD_PREFIX50_STEP44_REVIEW_OUTPUT_ROOT),
    realpath(inputPath),
  ]);
  if (
    resolve(realRoot) !== REAL_BUILD_PREFIX50_STEP44_REVIEW_OUTPUT_ROOT ||
    dirname(realInput) !== realRoot
  )
    throw new TypeError(
      "Step-44 review input and task root must be real in-repository paths, not symlink or junction escapes.",
    );
  const handle = await open(realInput, "r");
  let bytes: Buffer;
  try {
    const stats = await handle.stat();
    if (!stats.isFile() || stats.size < 1 || stats.size > maximumBytes)
      throw new RangeError(
        `Step-44 review input must be a regular 1..${maximumBytes}-byte file; received ${stats.size}.`,
      );
    bytes = await handle.readFile();
    const afterStats = await handle.stat();
    if (
      !afterStats.isFile() ||
      afterStats.size !== stats.size ||
      bytes.byteLength !== stats.size ||
      bytes.byteLength < 1 ||
      bytes.byteLength > maximumBytes
    )
      throw new RangeError(
        "Step-44 review input changed size while it was being read or exceeded its byte bound.",
      );
  } finally {
    await handle.close();
  }
  const bytesHash = sha256(bytes);
  if (expectedBytesHash !== undefined && bytesHash !== expectedBytesHash)
    throw new TypeError(
      `Step-44 review input bytes hashed as ${bytesHash}, not externally pinned ${expectedBytesHash}; refuse parsing or output creation.`,
    );
  return { value: JSON.parse(bytes.toString("utf8")) as unknown, bytes, bytesHash };
}

function requireCanonicalJsonBytes(value: unknown, bytes: Uint8Array): void {
  const canonicalBytes = Buffer.from(canonicalStringify(value));
  if (!canonicalBytes.equals(bytes))
    throw new TypeError(
      "Step-44 review harness input must use exact canonical JSON bytes; duplicate, reordered, whitespace-padded, or noncanonical input is rejected before schema dispatch.",
    );
}

export async function readRealBuildPrefix50Step44ReviewEnvelope(inputPath: string): Promise<{
  envelope: RealBuildPrefix50SubBuildReturnReviewHarnessEnvelope;
  bytesHash: `sha256:${string}`;
}> {
  const { value, bytes, bytesHash } = await readReviewJson(inputPath, MAXIMUM_INPUT_BYTES);
  preflightRealBuildPrefix50Step44ReviewJsonStructure(value);
  requireCanonicalJsonBytes(value, bytes);
  return { envelope: requireRealBuildPrefix50Step44ReviewEnvelope(value), bytesHash };
}

export async function readRealBuildPrefix50Step44ReviewHarnessInput(
  inputPath: string,
  expectedInputBytesHash: `sha256:${string}`,
): Promise<{
  input:
    | RealBuildPrefix50SubBuildReturnReviewHarnessEnvelope
    | RealBuildPrefix50SubBuildReturnReviewBatchEnvelope;
  bytesHash: `sha256:${string}`;
}> {
  requireDigest(expectedInputBytesHash, "Step-44 externally pinned harness input digest");
  const { value, bytes, bytesHash } = await readReviewJson(
    inputPath,
    REAL_BUILD_PREFIX50_STEP44_MAXIMUM_COMPACT_BATCH_BYTES,
    expectedInputBytesHash,
  );
  const schemaVersion =
    value !== null && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>).schemaVersion
      : undefined;
  preflightRealBuildPrefix50Step44ReviewJsonStructure(value, BATCH_STRUCTURE_LIMITS);
  requireCanonicalJsonBytes(value, bytes);
  if (schemaVersion === "lego.real-build-prefix50-subbuild-return-review-batch-input/2") {
    return {
      input: requireRealBuildPrefix50Step44ReviewBatchEnvelope(value),
      bytesHash,
    };
  }
  if (bytes.byteLength > MAXIMUM_INPUT_BYTES)
    throw new RangeError(
      `Step-44 single-envelope harness input exceeds its ${MAXIMUM_INPUT_BYTES}-byte limit.`,
    );
  preflightRealBuildPrefix50Step44ReviewJsonStructure(value);
  return { input: requireRealBuildPrefix50Step44ReviewEnvelope(value), bytesHash };
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await lstat(path);
    return true;
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return false;
    throw error;
  }
}

const reviewOutputPublicationBrands = new WeakMap<
  object,
  RealBuildPrefix50Step44ClaimedDirectoryIdentity
>();

export async function prepareRealBuildPrefix50Step44ReviewOutputPublication(
  outputPath: string,
): Promise<RealBuildPrefix50Step44ReviewOutputPublication> {
  await mkdir(REAL_BUILD_PREFIX50_STEP44_REVIEW_OUTPUT_ROOT, { recursive: true });
  const realRoot = await realpath(REAL_BUILD_PREFIX50_STEP44_REVIEW_OUTPUT_ROOT);
  if (
    resolve(realRoot) !== REAL_BUILD_PREFIX50_STEP44_REVIEW_OUTPUT_ROOT ||
    dirname(outputPath) !== realRoot ||
    resolve(outputPath) !== outputPath
  )
    throw new TypeError(
      "Step-44 review output must remain an absent direct child of the real task root.",
    );
  if (await pathExists(outputPath))
    throw new TypeError(
      `Step-44 review output already exists; choose a new run directory: ${outputPath}.`,
    );
  const rootIdentity = await captureRealBuildPrefix50Step44ClaimedDirectoryIdentity(
    realRoot,
    await realpath(dirname(realRoot)),
  );
  const publication = Object.freeze({ outputPath });
  reviewOutputPublicationBrands.set(publication, rootIdentity);
  return publication;
}

export interface RealBuildPrefix50Step44ReviewOutputPublication {
  readonly outputPath: string;
}

export function requireRealBuildPrefix50Step44ReviewOutputPublication(
  publication: RealBuildPrefix50Step44ReviewOutputPublication,
): RealBuildPrefix50Step44ReviewOutputPublication {
  if (!reviewOutputPublicationBrands.has(publication))
    throw new TypeError(
      "Step-44 review output publication requires its opaque prepared direct-child capability.",
    );
  return publication;
}

export function requireRealBuildPrefix50Step44ReviewOutputRootIdentity(
  publication: RealBuildPrefix50Step44ReviewOutputPublication,
): RealBuildPrefix50Step44ClaimedDirectoryIdentity {
  requireRealBuildPrefix50Step44ReviewOutputPublication(publication);
  return reviewOutputPublicationBrands.get(publication)!;
}

export interface RealBuildPrefix50Step44ClaimedDirectoryIdentity {
  readonly lexicalPath: string;
  readonly realPath: string;
  readonly device: string;
  readonly inode: string;
}

function sameClaimedDirectory(
  left: Readonly<{ dev: bigint; ino: bigint }>,
  right: Readonly<{ dev: bigint; ino: bigint }>,
): boolean {
  return left.dev === right.dev && left.ino === right.ino;
}

export async function captureRealBuildPrefix50Step44ClaimedDirectoryIdentity(
  lexicalPath: string,
  expectedRealParentPath: string,
): Promise<RealBuildPrefix50Step44ClaimedDirectoryIdentity> {
  const before = await lstat(lexicalPath, { bigint: true });
  const realPath = await realpath(lexicalPath);
  const after = await lstat(lexicalPath, { bigint: true });
  if (
    resolve(lexicalPath) !== lexicalPath ||
    realPath !== lexicalPath ||
    dirname(realPath) !== expectedRealParentPath ||
    !before.isDirectory() ||
    before.isSymbolicLink() ||
    !after.isDirectory() ||
    after.isSymbolicLink() ||
    !sameClaimedDirectory(before, after)
  )
    throw new TypeError(
      `Step-44 claimed directory identity is not one stable real direct child: ${lexicalPath}.`,
    );
  return {
    lexicalPath,
    realPath,
    device: before.dev.toString(10),
    inode: before.ino.toString(10),
  };
}

export async function assertRealBuildPrefix50Step44ClaimedDirectoryIdentity(
  expected: RealBuildPrefix50Step44ClaimedDirectoryIdentity,
): Promise<void> {
  const current = await captureRealBuildPrefix50Step44ClaimedDirectoryIdentity(
    expected.lexicalPath,
    dirname(expected.realPath),
  );
  if (
    current.lexicalPath !== expected.lexicalPath ||
    current.realPath !== expected.realPath ||
    current.device !== expected.device ||
    current.inode !== expected.inode
  )
    throw new TypeError(
      `Step-44 claimed directory identity changed before publication commit: ${expected.lexicalPath}.`,
    );
}

export async function claimRealBuildPrefix50Step44ReviewOutputPublication(
  publication: RealBuildPrefix50Step44ReviewOutputPublication,
): Promise<RealBuildPrefix50Step44ClaimedDirectoryIdentity> {
  const outputPath = requireRealBuildPrefix50Step44ReviewOutputPublication(publication).outputPath;
  try {
    await mkdir(outputPath, { recursive: false });
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "EEXIST")
      throw new TypeError(
        `Step-44 review output claim found an existing directory, file, symlink, or junction and will not replace it: ${outputPath}.`,
        { cause: error },
      );
    throw error;
  }
  return captureRealBuildPrefix50Step44ClaimedDirectoryIdentity(
    outputPath,
    await realpath(REAL_BUILD_PREFIX50_STEP44_REVIEW_OUTPUT_ROOT),
  );
}
