import {
  canonicalDigest,
  deepFreeze,
  type Sha256Digest,
} from "../../../packages/brick-kernel/src/canonical.ts";
import {
  PART_VISUAL_ADMISSION_CAPTURE_POLICY,
  PART_VISUAL_ADMISSION_VIEW_NAMES,
  type PartVisualAdmissionViewName,
} from "../../../packages/rendering/src/part-visual-admission-policy.ts";
import { isCanonicalUtcTimestamp } from "../../../packages/protocol/src/utc-timestamp.ts";

import type { PartVisualAdmissionPacket } from "./part-visual-admission-artifacts.ts";

export const PART_VISUAL_ADMISSION_REVIEW_SCHEMA = "lego.part-visual-admission-review/1" as const;

const DIGEST_PATTERN = /^sha256:[0-9a-f]{64}$/u;
const REVIEW_OUTCOMES = ["same", "different", "not-observable"] as const;
const PACKET_IMAGE_KEYS = [
  "side",
  "viewName",
  "cameraName",
  "projection",
  "path",
  "sha256",
  "bytes",
  "width",
  "height",
  "rgbaSha256",
  "rgbaBytes",
  "rgbaOrigin",
] as const;

export type PartVisualAdmissionReviewOutcome = (typeof REVIEW_OUTCOMES)[number];

export interface PartVisualAdmissionViewReviewInput {
  readonly viewName: PartVisualAdmissionViewName;
  readonly outcome: PartVisualAdmissionReviewOutcome;
  readonly note: string;
}

interface BoundReviewImage {
  readonly pngSha256: Sha256Digest;
  readonly rgbaSha256: Sha256Digest;
}

export interface PartVisualAdmissionReviewRecord {
  readonly schemaVersion: typeof PART_VISUAL_ADMISSION_REVIEW_SCHEMA;
  readonly packetHash: Sha256Digest;
  readonly createdAt: string;
  readonly reviewer: string;
  readonly method: string;
  readonly outcome: PartVisualAdmissionReviewOutcome;
  readonly views: readonly {
    readonly viewName: PartVisualAdmissionViewName;
    readonly source: BoundReviewImage;
    readonly candidate: BoundReviewImage;
    readonly outcome: PartVisualAdmissionReviewOutcome;
    readonly note: string;
  }[];
  readonly reviewHash: Sha256Digest;
}

export interface VerifiedPacketReviewImage {
  readonly path: string;
  readonly bytes: number;
  readonly pngSha256: Sha256Digest;
  readonly rgbaSha256: Sha256Digest;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function exactRecord(
  value: unknown,
  expectedKeys: readonly string[],
  label: string,
): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new TypeError(`${label} must be a JSON object with exactly: ${expectedKeys.join(", ")}.`);
  }
  const actual = Object.keys(value).sort();
  const expected = [...expectedKeys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    throw new TypeError(
      `${label} keys must be exactly ${expectedKeys.join(", ")}; received ${actual.join(", ") || "none"}.`,
    );
  }
  return value;
}

function digest(value: unknown, label: string): Sha256Digest {
  if (typeof value !== "string" || !DIGEST_PATTERN.test(value)) {
    throw new TypeError(`${label} must be a sha256:<64 lowercase hex> digest.`);
  }
  return value as Sha256Digest;
}

function positiveSafeInteger(value: unknown, label: string): number {
  if (!Number.isSafeInteger(value) || (value as number) <= 0) {
    throw new TypeError(`${label} must be a positive safe integer.`);
  }
  return value as number;
}

export function requirePartVisualAdmissionReviewText(
  value: unknown,
  label: string,
  maximum: number,
  requireCanonical = false,
): string {
  if (typeof value !== "string") {
    throw new TypeError(`${label} must be a string containing 1..${maximum} printable characters.`);
  }
  const normalized = value.trim();
  const hasForbiddenControl = [...normalized].some((character) => {
    const code = character.charCodeAt(0);
    return (code < 32 && ![9, 10, 13].includes(code)) || code === 127;
  });
  if (normalized.length === 0 || normalized.length > maximum || hasForbiddenControl) {
    throw new TypeError(`${label} must contain 1..${maximum} printable characters.`);
  }
  if (requireCanonical && normalized !== value) {
    throw new TypeError(`${label} must already be trimmed before its review hash is computed.`);
  }
  return normalized;
}

export function requirePartVisualAdmissionReviewTimestamp(value: unknown, label: string): string {
  if (!isCanonicalUtcTimestamp(value)) {
    throw new TypeError(
      `${label} must be one real canonical UTC instant in YYYY-MM-DDTHH:mm:ss.sssZ form.`,
    );
  }
  return value;
}

function reviewOutcome(value: unknown, label: string): PartVisualAdmissionReviewOutcome {
  if (typeof value !== "string" || !REVIEW_OUTCOMES.includes(value as never)) {
    throw new TypeError(
      `${label} must be same, different, or not-observable; received ${JSON.stringify(value)}.`,
    );
  }
  return value as PartVisualAdmissionReviewOutcome;
}

export function strictestPartVisualAdmissionReviewOutcome(
  values: readonly { readonly outcome: PartVisualAdmissionReviewOutcome }[],
): PartVisualAdmissionReviewOutcome {
  return values.some(({ outcome }) => outcome === "different")
    ? "different"
    : values.some(({ outcome }) => outcome === "not-observable")
      ? "not-observable"
      : "same";
}

export function verifyPendingPartVisualAdmissionPacket(value: unknown): PartVisualAdmissionPacket {
  if (!isRecord(value)) {
    throw new TypeError(`Visual-admission packet must be a JSON object.`);
  }
  if (value.reviewState !== "pending") {
    throw new TypeError(`Visual-admission packet generation must leave reviewState pending.`);
  }
  const packetHash = digest(value.packetHash, "Visual-admission packet packetHash");
  const base = { ...value };
  delete base.packetHash;
  if (packetHash !== canonicalDigest(base)) {
    throw new Error(`Visual-admission packet content does not match packetHash ${packetHash}.`);
  }
  if (!Array.isArray(value.images)) {
    throw new TypeError(`Visual-admission packet images must be an ordered JSON array.`);
  }
  if (value.images.length !== PART_VISUAL_ADMISSION_VIEW_NAMES.length * 2) {
    throw new RangeError(
      `Visual-admission packet has ${value.images.length} images; expected ${PART_VISUAL_ADMISSION_VIEW_NAMES.length * 2}.`,
    );
  }
  const bindings = new Set<string>();
  value.images.forEach((candidate, index) => {
    const image = exactRecord(
      candidate,
      PACKET_IMAGE_KEYS,
      `Visual-admission packet image ${index}`,
    );
    if (image.side !== "source" && image.side !== "candidate") {
      throw new TypeError(
        `Visual-admission packet image ${index} side must be source or candidate.`,
      );
    }
    if (
      typeof image.viewName !== "string" ||
      !PART_VISUAL_ADMISSION_VIEW_NAMES.includes(image.viewName as PartVisualAdmissionViewName)
    ) {
      throw new TypeError(`Visual-admission packet image ${index} has an unknown viewName.`);
    }
    const binding = `${image.side}/${image.viewName}`;
    if (bindings.has(binding)) {
      throw new TypeError(`Visual-admission packet contains duplicate ${binding} image bindings.`);
    }
    bindings.add(binding);
    if (image.cameraName !== `part-visual-admission-camera:${image.viewName}`) {
      throw new TypeError(`Visual-admission packet ${binding} cameraName is not policy-bound.`);
    }
    if (image.projection !== "orthographic" && image.projection !== "perspective") {
      throw new TypeError(`Visual-admission packet ${binding} projection is invalid.`);
    }
    if (image.path !== `${binding}.png`) {
      throw new TypeError(`Visual-admission packet ${binding} path must be ${binding}.png.`);
    }
    digest(image.sha256, `Visual-admission packet ${binding} PNG hash`);
    digest(image.rgbaSha256, `Visual-admission packet ${binding} RGBA hash`);
    const bytes = positiveSafeInteger(image.bytes, `Visual-admission packet ${binding} PNG bytes`);
    if (bytes > PART_VISUAL_ADMISSION_CAPTURE_POLICY.maxPngBytes) {
      throw new RangeError(
        `Visual-admission packet ${binding} PNG is ${bytes} bytes; maximum is ${PART_VISUAL_ADMISSION_CAPTURE_POLICY.maxPngBytes}.`,
      );
    }
    if (
      image.width !== PART_VISUAL_ADMISSION_CAPTURE_POLICY.width ||
      image.height !== PART_VISUAL_ADMISSION_CAPTURE_POLICY.height ||
      image.rgbaBytes !==
        PART_VISUAL_ADMISSION_CAPTURE_POLICY.width *
          PART_VISUAL_ADMISSION_CAPTURE_POLICY.height *
          4 ||
      image.rgbaOrigin !== PART_VISUAL_ADMISSION_CAPTURE_POLICY.rgbaOrigin
    ) {
      throw new TypeError(
        `Visual-admission packet ${binding} dimensions/RGBA layout are not policy-bound.`,
      );
    }
  });
  for (const side of ["source", "candidate"] as const) {
    for (const viewName of PART_VISUAL_ADMISSION_VIEW_NAMES) {
      if (!bindings.has(`${side}/${viewName}`)) {
        throw new TypeError(
          `Visual-admission packet is missing the ${side}/${viewName} image binding.`,
        );
      }
    }
  }
  return value as unknown as PartVisualAdmissionPacket;
}

export function packetReviewImage(
  packet: PartVisualAdmissionPacket,
  side: "source" | "candidate",
  viewName: PartVisualAdmissionViewName,
): VerifiedPacketReviewImage {
  const image = packet.images.find(
    (candidate) => candidate.side === side && candidate.viewName === viewName,
  );
  if (image === undefined) {
    throw new Error(`Visual-admission packet is missing the ${side}/${viewName} image binding.`);
  }
  return {
    path: image.path,
    bytes: image.bytes,
    pngSha256: image.sha256,
    rgbaSha256: image.rgbaSha256,
  };
}

function boundReviewImage(
  value: unknown,
  packetImage: VerifiedPacketReviewImage,
  label: string,
): BoundReviewImage {
  const image = exactRecord(value, ["pngSha256", "rgbaSha256"], label);
  const pngSha256 = digest(image.pngSha256, `${label} pngSha256`);
  const rgbaSha256 = digest(image.rgbaSha256, `${label} rgbaSha256`);
  if (pngSha256 !== packetImage.pngSha256 || rgbaSha256 !== packetImage.rgbaSha256) {
    throw new Error(`${label} PNG/RGBA hashes do not match the retained packet image binding.`);
  }
  return { pngSha256, rgbaSha256 };
}

export function verifyPartVisualAdmissionReviewRecord(
  packetValue: unknown,
  value: unknown,
): PartVisualAdmissionReviewRecord {
  const packet = verifyPendingPartVisualAdmissionPacket(packetValue);
  const review = exactRecord(
    value,
    [
      "schemaVersion",
      "packetHash",
      "createdAt",
      "reviewer",
      "method",
      "outcome",
      "views",
      "reviewHash",
    ],
    "Visual-admission review",
  );
  if (review.schemaVersion !== PART_VISUAL_ADMISSION_REVIEW_SCHEMA) {
    throw new TypeError(
      `Visual-admission review schemaVersion must be ${PART_VISUAL_ADMISSION_REVIEW_SCHEMA}.`,
    );
  }
  const packetHash = digest(review.packetHash, "Visual-admission review packetHash");
  if (packetHash !== packet.packetHash) {
    throw new Error(`Visual-admission review packetHash does not match its retained packet.`);
  }
  const createdAt = requirePartVisualAdmissionReviewTimestamp(
    review.createdAt,
    "Visual-admission review timestamp",
  );
  const reviewer = requirePartVisualAdmissionReviewText(
    review.reviewer,
    "Visual-admission reviewer",
    120,
    true,
  );
  const method = requirePartVisualAdmissionReviewText(
    review.method,
    "Visual-admission review method",
    120,
    true,
  );
  const claimedOutcome = reviewOutcome(review.outcome, "Visual-admission review outcome");
  if (
    !Array.isArray(review.views) ||
    review.views.length !== PART_VISUAL_ADMISSION_VIEW_NAMES.length
  ) {
    throw new TypeError(
      `Visual-admission review views must be exactly ${PART_VISUAL_ADMISSION_VIEW_NAMES.join(", ")} in policy order.`,
    );
  }
  const views = review.views.map((candidate, index) => {
    const view = exactRecord(
      candidate,
      ["viewName", "source", "candidate", "outcome", "note"],
      `Visual-admission review view ${index}`,
    );
    const viewName = PART_VISUAL_ADMISSION_VIEW_NAMES[index]!;
    if (view.viewName !== viewName) {
      throw new TypeError(
        `Visual-admission review view ${index} must be ${viewName}; received ${JSON.stringify(view.viewName)}.`,
      );
    }
    return {
      viewName,
      source: boundReviewImage(
        view.source,
        packetReviewImage(packet, "source", viewName),
        `Visual-admission review ${viewName} source`,
      ),
      candidate: boundReviewImage(
        view.candidate,
        packetReviewImage(packet, "candidate", viewName),
        `Visual-admission review ${viewName} candidate`,
      ),
      outcome: reviewOutcome(view.outcome, `Visual-admission review ${viewName} outcome`),
      note: requirePartVisualAdmissionReviewText(
        view.note,
        `Visual-admission review ${viewName} note`,
        1_000,
        true,
      ),
    };
  });
  const outcome = strictestPartVisualAdmissionReviewOutcome(views);
  if (claimedOutcome !== outcome) {
    throw new Error(
      `Visual-admission review aggregate outcome is ${claimedOutcome}; ordered view outcomes require ${outcome}.`,
    );
  }
  const base = {
    schemaVersion: PART_VISUAL_ADMISSION_REVIEW_SCHEMA,
    packetHash,
    createdAt,
    reviewer,
    method,
    outcome,
    views,
  } as const;
  const reviewHash = digest(review.reviewHash, "Visual-admission review reviewHash");
  const expectedReviewHash = canonicalDigest(base);
  if (reviewHash !== expectedReviewHash) {
    throw new Error(
      `Visual-admission review content does not match reviewHash ${reviewHash}; expected ${expectedReviewHash}.`,
    );
  }
  return deepFreeze({ ...base, reviewHash });
}
