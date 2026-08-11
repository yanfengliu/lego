import {
  canonicalDigest,
  canonicalStringify,
  deepFreeze,
  type Sha256Digest,
} from "../../../packages/brick-kernel/src/canonical.ts";
import {
  PART_VISUAL_ADMISSION_CAPTURE_POLICY,
  PART_VISUAL_ADMISSION_VIEW_NAMES,
} from "../../../packages/rendering/src/part-visual-admission-policy.ts";
import { existsSync, realpathSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";

import { readContainedBoundedRegularFile } from "./bounded-file-read";
import { writeContainedRegularFileAtomic } from "./contained-atomic-write";
import type { PartVisualAdmissionPacket } from "./part-visual-admission-artifacts.ts";
import {
  packetReviewImage,
  PART_VISUAL_ADMISSION_REVIEW_SCHEMA as REVIEW_SCHEMA,
  requirePartVisualAdmissionReviewText,
  requirePartVisualAdmissionReviewTimestamp,
  strictestPartVisualAdmissionReviewOutcome,
  verifyPartVisualAdmissionReviewRecord,
  verifyPendingPartVisualAdmissionPacket,
  type PartVisualAdmissionReviewOutcome,
  type PartVisualAdmissionReviewRecord,
  type PartVisualAdmissionViewReviewInput,
} from "./part-visual-admission-review-verification";

export { verifyPartVisualAdmissionReviewRecord };
export type {
  PartVisualAdmissionReviewOutcome,
  PartVisualAdmissionReviewRecord,
  PartVisualAdmissionViewReviewInput,
};

const REVIEW_BATCH_SCHEMA = "lego.part-visual-admission-review-batch/1" as const;
const MAX_PACKET_BYTES = 4 * 1024 * 1024;
const DIGEST_PATTERN = /^sha256:[0-9a-f]{64}$/u;

export interface PartVisualAdmissionReviewBatch {
  readonly schemaVersion: typeof REVIEW_BATCH_SCHEMA;
  readonly captureBatchHash: Sha256Digest;
  readonly captureBatchPath: string;
  readonly createdAt: string;
  readonly outcome: PartVisualAdmissionReviewOutcome;
  readonly reviews: readonly {
    readonly catalogPartId: string;
    readonly packetPath: string;
    readonly packetHash: Sha256Digest;
    readonly reviewPath: string;
    readonly reviewHash: Sha256Digest;
    readonly outcome: PartVisualAdmissionReviewOutcome;
  }[];
  readonly reviewBatchHash: Sha256Digest;
}

function repositoryRelativePath(repository: string, path: string, label: string): string {
  const candidate = relative(repository, resolve(path)).replaceAll("\\", "/");
  if (
    candidate.length === 0 ||
    candidate === ".." ||
    candidate.startsWith("../") ||
    isAbsolute(candidate)
  ) {
    throw new TypeError(
      `${label} must resolve to a file below repository root ${repository}: ${path}.`,
    );
  }
  return candidate;
}

function exactContainedFile(input: {
  readonly repository: string;
  readonly path: string;
  readonly maximumBytes: number;
  readonly label: string;
  readonly exactBytes?: number;
  readonly expectedSha256?: Sha256Digest;
}): Buffer {
  return readContainedBoundedRegularFile(
    input.repository,
    repositoryRelativePath(input.repository, input.path, input.label),
    {
      label: input.label,
      maximumBytes: input.maximumBytes,
      ...(input.exactBytes === undefined ? {} : { exactBytes: input.exactBytes }),
      ...(input.expectedSha256 === undefined ? {} : { expectedSha256: input.expectedSha256 }),
    },
  );
}

function parseExactJson(bytes: Uint8Array, label: string): unknown {
  let text: string;
  try {
    text = new TextDecoder("utf8", { fatal: true }).decode(bytes);
  } catch (error) {
    throw new TypeError(`${label} must contain valid UTF-8 JSON bytes.`, { cause: error });
  }
  try {
    return JSON.parse(text) as unknown;
  } catch (error) {
    throw new TypeError(`${label} must contain one complete JSON value.`, { cause: error });
  }
}

function verifyRetainedPacketImages(
  repository: string,
  packetPath: string,
  packet: PartVisualAdmissionPacket,
): void {
  const runDirectory = dirname(packetPath);
  for (const image of packet.images) {
    exactContainedFile({
      repository,
      path: resolve(runDirectory, image.path),
      maximumBytes: PART_VISUAL_ADMISSION_CAPTURE_POLICY.maxPngBytes,
      exactBytes: image.bytes,
      expectedSha256: image.sha256,
      label: `visual-admission image ${image.side}/${image.viewName}`,
    });
  }
}

function writeContainedExclusive(
  repository: string,
  path: string,
  bytes: Uint8Array,
  label: string,
): void {
  writeContainedRegularFileAtomic(
    repository,
    repositoryRelativePath(repository, path, label),
    bytes,
    { label },
  );
}

export function createPartVisualAdmissionReviewRecord(
  packet: PartVisualAdmissionPacket,
  input: {
    readonly reviewer: string;
    readonly method: string;
    readonly views: readonly PartVisualAdmissionViewReviewInput[];
    readonly timestamp?: string;
  },
): PartVisualAdmissionReviewRecord {
  const verifiedPacket = verifyPendingPartVisualAdmissionPacket(packet);
  const reviewer = requirePartVisualAdmissionReviewText(
    input.reviewer,
    "Visual-admission reviewer",
    120,
  );
  const method = requirePartVisualAdmissionReviewText(
    input.method,
    "Visual-admission review method",
    120,
  );
  const expectedViews = [...PART_VISUAL_ADMISSION_VIEW_NAMES];
  if (
    input.views.length !== expectedViews.length ||
    input.views.some(({ viewName }, index) => viewName !== expectedViews[index])
  ) {
    throw new TypeError(
      `Visual-admission review views must be exactly ${expectedViews.join(", ")} in policy order.`,
    );
  }
  const views = input.views.map(({ viewName, outcome, note }) => {
    if (!["same", "different", "not-observable"].includes(outcome)) {
      throw new TypeError(
        `Visual-admission ${viewName} outcome must be same, different, or not-observable; received ${JSON.stringify(outcome)}.`,
      );
    }
    const source = packetReviewImage(verifiedPacket, "source", viewName);
    const candidate = packetReviewImage(verifiedPacket, "candidate", viewName);
    return {
      viewName,
      source: { pngSha256: source.pngSha256, rgbaSha256: source.rgbaSha256 },
      candidate: { pngSha256: candidate.pngSha256, rgbaSha256: candidate.rgbaSha256 },
      outcome,
      note: requirePartVisualAdmissionReviewText(note, `Visual-admission ${viewName} note`, 1_000),
    };
  });
  const outcome = strictestPartVisualAdmissionReviewOutcome(views);
  const createdAt = requirePartVisualAdmissionReviewTimestamp(
    input.timestamp ?? new Date().toISOString(),
    "Visual-admission review timestamp",
  );
  const base = {
    schemaVersion: REVIEW_SCHEMA,
    packetHash: verifiedPacket.packetHash,
    createdAt,
    reviewer,
    method,
    outcome,
    views,
  } as const;
  return verifyPartVisualAdmissionReviewRecord(verifiedPacket, {
    ...base,
    reviewHash: canonicalDigest(base),
  });
}

export function publishPartVisualAdmissionReview(input: {
  readonly packetPath: string;
  readonly reviewer: string;
  readonly method: string;
  readonly views: readonly PartVisualAdmissionViewReviewInput[];
  readonly timestamp?: string;
}): { readonly reviewPath: string; readonly review: PartVisualAdmissionReviewRecord } {
  const repository = realpathSync.native(process.cwd());
  const packetPath = resolve(input.packetPath);
  const relativePacket = repositoryRelativePath(repository, packetPath, "Visual-admission packet");
  if (!/^(?:output|test-results)\/.+\/runs\/.+\/packet\.json$/u.test(relativePacket)) {
    throw new TypeError(
      `Visual-admission packet must be below an ignored run directory: ${packetPath}.`,
    );
  }
  const packet = verifyPendingPartVisualAdmissionPacket(
    parseExactJson(
      exactContainedFile({
        repository,
        path: packetPath,
        maximumBytes: MAX_PACKET_BYTES,
        label: "visual-admission packet",
      }),
      "Visual-admission packet",
    ),
  );
  const runDirectory = dirname(packetPath);
  verifyRetainedPacketImages(repository, packetPath, packet);
  const review = createPartVisualAdmissionReviewRecord(packet, input);
  const reviewPath = join(runDirectory, "review.json");
  if (existsSync(reviewPath)) {
    throw new Error(
      `Visual-admission review sidecar is immutable and already exists: ${reviewPath}.`,
    );
  }
  writeContainedExclusive(
    repository,
    reviewPath,
    Buffer.from(`${canonicalStringify(review)}\n`),
    "visual-admission review sidecar",
  );
  const retained = verifyPartVisualAdmissionReviewRecord(
    packet,
    parseExactJson(
      exactContainedFile({
        repository,
        path: reviewPath,
        maximumBytes: MAX_PACKET_BYTES,
        label: "visual-admission review sidecar",
      }),
      "Visual-admission review sidecar",
    ),
  );
  if (retained.reviewHash !== review.reviewHash) {
    throw new Error(`Visual-admission review sidecar failed its retained digest check.`);
  }
  return { reviewPath, review };
}

export function publishPartVisualAdmissionReviewBatch(input: {
  readonly captureBatchPath: string;
  readonly timestamp?: string;
}): { readonly reviewBatchPath: string; readonly reviewBatch: PartVisualAdmissionReviewBatch } {
  const repository = realpathSync.native(process.cwd());
  const captureBatchPath = resolve(input.captureBatchPath);
  const relativeBatch = repositoryRelativePath(
    repository,
    captureBatchPath,
    "Visual-admission capture batch",
  );
  if (!/^(?:output|test-results)\/.+\/batches\/[^/]+\.json$/u.test(relativeBatch)) {
    throw new TypeError(
      `Visual-admission capture batch must be below an ignored batches directory: ${captureBatchPath}.`,
    );
  }
  const captureBatch = parseExactJson(
    exactContainedFile({
      repository,
      path: captureBatchPath,
      maximumBytes: MAX_PACKET_BYTES,
      label: "visual-admission capture batch",
    }),
    "Visual-admission capture batch",
  ) as {
    readonly schemaVersion?: unknown;
    readonly requestedPartIds?: unknown;
    readonly packets?: unknown;
    readonly batchHash?: unknown;
    readonly [key: string]: unknown;
  };
  const { batchHash, ...captureBatchBase } = captureBatch;
  if (
    captureBatch.schemaVersion !== "lego.part-visual-admission-capture-batch/1" ||
    typeof batchHash !== "string" ||
    !DIGEST_PATTERN.test(batchHash) ||
    batchHash !== canonicalDigest(captureBatchBase) ||
    !Array.isArray(captureBatch.requestedPartIds) ||
    !Array.isArray(captureBatch.packets) ||
    captureBatch.requestedPartIds.length === 0 ||
    captureBatch.requestedPartIds.length !== captureBatch.packets.length
  ) {
    throw new TypeError(
      `Visual-admission capture batch is malformed or does not match its batchHash: ${captureBatchPath}.`,
    );
  }
  const requestedPartIds = captureBatch.requestedPartIds as unknown[];
  const packets = captureBatch.packets as unknown[];
  const batchRoot = dirname(dirname(captureBatchPath));
  const seen = new Set<string>();
  const reviews = packets.map((value, index) => {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      throw new TypeError(`Visual-admission capture batch packet ${index} must be a JSON object.`);
    }
    const entry = value as Record<string, unknown>;
    const catalogPartId = entry.catalogPartId;
    const packetRelativePath = entry.packetPath;
    const packetHash = entry.packetHash;
    if (
      typeof catalogPartId !== "string" ||
      requestedPartIds[index] !== catalogPartId ||
      seen.has(catalogPartId) ||
      typeof packetRelativePath !== "string" ||
      !/^runs\/[^/]+\/packet\.json$/u.test(packetRelativePath) ||
      typeof packetHash !== "string" ||
      !DIGEST_PATTERN.test(packetHash)
    ) {
      throw new TypeError(
        `Visual-admission capture batch packet ${index} is malformed, duplicated, or out of requested order.`,
      );
    }
    seen.add(catalogPartId);
    const packetPath = resolve(batchRoot, packetRelativePath);
    if (relative(batchRoot, packetPath).startsWith("..")) {
      throw new TypeError(`Visual-admission capture packet escapes its batch root: ${packetPath}.`);
    }
    const packet = verifyPendingPartVisualAdmissionPacket(
      parseExactJson(
        exactContainedFile({
          repository,
          path: packetPath,
          maximumBytes: MAX_PACKET_BYTES,
          label: `visual-admission packet ${catalogPartId}`,
        }),
        `Visual-admission packet ${catalogPartId}`,
      ),
    );
    const candidate = packet.candidate as unknown;
    if (
      packet.packetHash !== packetHash ||
      typeof candidate !== "object" ||
      candidate === null ||
      Array.isArray(candidate) ||
      (candidate as Record<string, unknown>).catalogId !== catalogPartId
    ) {
      throw new Error(
        `Visual-admission capture batch binding disagrees with retained packet ${catalogPartId}.`,
      );
    }
    verifyRetainedPacketImages(repository, packetPath, packet);
    const reviewPath = join(dirname(packetPath), "review.json");
    const review = verifyPartVisualAdmissionReviewRecord(
      packet,
      parseExactJson(
        exactContainedFile({
          repository,
          path: reviewPath,
          maximumBytes: MAX_PACKET_BYTES,
          label: `visual-admission review ${catalogPartId}`,
        }),
        `Visual-admission review ${catalogPartId}`,
      ),
    );
    return {
      catalogPartId,
      packetPath: packetRelativePath,
      packetHash,
      reviewPath: relative(batchRoot, reviewPath).replaceAll("\\", "/"),
      reviewHash: review.reviewHash,
      outcome: review.outcome,
    } as const;
  });
  const outcome = strictestPartVisualAdmissionReviewOutcome(reviews);
  const createdAt = requirePartVisualAdmissionReviewTimestamp(
    input.timestamp ?? new Date().toISOString(),
    "Visual-admission review-batch timestamp",
  );
  const base = {
    schemaVersion: REVIEW_BATCH_SCHEMA,
    captureBatchHash: batchHash as Sha256Digest,
    captureBatchPath: relativeBatch,
    createdAt,
    outcome,
    reviews,
  } as const;
  const reviewBatch = deepFreeze({
    ...base,
    reviewBatchHash: canonicalDigest(base),
  }) satisfies PartVisualAdmissionReviewBatch;
  const reviewBatchPath = captureBatchPath.replace(/\.json$/u, ".review.json");
  if (existsSync(reviewBatchPath)) {
    throw new Error(
      `Visual-admission review-batch manifest is immutable and already exists: ${reviewBatchPath}.`,
    );
  }
  writeContainedExclusive(
    repository,
    reviewBatchPath,
    Buffer.from(`${canonicalStringify(reviewBatch)}\n`),
    "visual-admission review-batch manifest",
  );
  const retained = parseExactJson(
    exactContainedFile({
      repository,
      path: reviewBatchPath,
      maximumBytes: MAX_PACKET_BYTES,
      label: "visual-admission review-batch manifest",
    }),
    "Visual-admission review-batch manifest",
  ) as PartVisualAdmissionReviewBatch;
  const { reviewBatchHash, ...retainedBase } = retained;
  if (
    reviewBatchHash !== canonicalDigest(retainedBase) ||
    reviewBatchHash !== reviewBatch.reviewBatchHash
  ) {
    throw new Error(`Visual-admission review-batch manifest failed its retained digest check.`);
  }
  return { reviewBatchPath, reviewBatch };
}
