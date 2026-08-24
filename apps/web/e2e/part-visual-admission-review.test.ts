import { canonicalDigest, canonicalStringify } from "@lego-studio/brick-kernel";
import { PART_VISUAL_ADMISSION_VIEW_NAMES } from "@lego-studio/rendering";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import type { PartVisualAdmissionPacket } from "./part-visual-admission-artifacts.ts";
import {
  createPartVisualAdmissionReviewRecord,
  publishPartVisualAdmissionReview,
  publishPartVisualAdmissionReviewBatch,
  verifyPartVisualAdmissionReviewRecord,
  type PartVisualAdmissionReviewRecord,
  type PartVisualAdmissionViewReviewInput,
} from "./part-visual-admission-review.ts";
import { requirePartVisualAdmissionReviewTimestamp } from "./part-visual-admission-review-verification.ts";

const sha256 = (bytes: Uint8Array) =>
  `sha256:${createHash("sha256").update(bytes).digest("hex")}` as const;

function visualReviewTestDirectory(prefix: string): string {
  mkdirSync("test-results", { recursive: true });
  return mkdtempSync(join("test-results", prefix));
}

function pendingPacket(
  imageBytes = Buffer.from([1]),
  catalogPartId = "3001",
): PartVisualAdmissionPacket {
  const images = (["source", "candidate"] as const).flatMap((side) =>
    PART_VISUAL_ADMISSION_VIEW_NAMES.map((viewName) => ({
      side,
      viewName,
      cameraName: `part-visual-admission-camera:${viewName}`,
      projection: ["isometric", "underside-oblique"].includes(viewName)
        ? ("perspective" as const)
        : ("orthographic" as const),
      path: `${side}/${viewName}.png`,
      sha256: sha256(imageBytes),
      bytes: imageBytes.length,
      width: 640,
      height: 640,
      rgbaSha256: sha256(Buffer.from(`${side}:${viewName}`)),
      rgbaBytes: 640 * 640 * 4,
      rgbaOrigin: "bottom-left" as const,
    })),
  );
  const base = {
    schemaVersion: "lego.part-visual-admission-packet/1",
    runId: "unit-run",
    createdAt: "2026-08-11T00:00:00.000Z",
    reviewState: "pending",
    candidate: {
      catalogId: catalogPartId,
      catalogHash: sha256(Buffer.from("catalog")),
      definitionHash: sha256(Buffer.from("definition")),
      meshHash: sha256(Buffer.from("mesh")),
      frameHash: sha256(Buffer.from("frame")),
    },
    images,
  } as const;
  return { ...base, packetHash: canonicalDigest(base) } as unknown as PartVisualAdmissionPacket;
}

function mutableReview(review: PartVisualAdmissionReviewRecord): Record<string, unknown> {
  return JSON.parse(canonicalStringify(review)) as Record<string, unknown>;
}

function rehashedReview(review: Record<string, unknown>): Record<string, unknown> {
  const base = { ...review };
  delete base.reviewHash;
  return { ...base, reviewHash: canonicalDigest(base) };
}

function mutableView(review: Record<string, unknown>, index = 0): Record<string, unknown> {
  return (review.views as Record<string, unknown>[])[index]!;
}

function writePacketRun(
  root: string,
  options: { readonly review?: boolean; readonly catalogPartId?: string } = {},
) {
  const bytes = Buffer.from([1]);
  const catalogPartId = options.catalogPartId ?? "3001";
  const packet = pendingPacket(bytes, catalogPartId);
  const run = join(root, "runs", "unit-run");
  for (const image of packet.images) {
    const path = join(run, image.path);
    mkdirSync(join(path, ".."), { recursive: true });
    writeFileSync(path, bytes);
  }
  const packetPath = join(run, "packet.json");
  writeFileSync(packetPath, `${canonicalStringify(packet)}\n`);
  const review = createPartVisualAdmissionReviewRecord(packet, {
    reviewer: "unit reviewer",
    method: "human-visual-inspection",
    views: reviews(),
    timestamp: "2026-08-11T01:00:00.000Z",
  });
  const reviewPath = join(run, "review.json");
  if (options.review === true) writeFileSync(reviewPath, `${canonicalStringify(review)}\n`);
  return { catalogPartId, packet, packetPath, review, reviewPath, run };
}

function writeCaptureBatch(root: string, packet: PartVisualAdmissionPacket, catalogPartId: string) {
  const directory = join(root, "batches");
  mkdirSync(directory, { recursive: true });
  const base = {
    schemaVersion: "lego.part-visual-admission-capture-batch/1",
    requestedPartIds: [catalogPartId],
    packets: [
      {
        catalogPartId,
        packetPath: "runs/unit-run/packet.json",
        packetHash: packet.packetHash,
      },
    ],
  } as const;
  const batch = { ...base, batchHash: canonicalDigest(base) };
  const path = join(directory, "unit.json");
  writeFileSync(path, `${canonicalStringify(batch)}\n`);
  return path;
}

function reviews(
  outcome: "same" | "different" | "not-observable" = "same",
): PartVisualAdmissionViewReviewInput[] {
  return PART_VISUAL_ADMISSION_VIEW_NAMES.map((viewName) => ({
    viewName,
    outcome,
    note: `Inspected ${viewName} source and candidate pair.`,
  }));
}

describe("part visual-admission review sidecar", () => {
  const cleanup: string[] = [];
  afterEach(() => {
    for (const path of cleanup.splice(0)) rmSync(path, { recursive: true, force: true });
  });

  it("binds every source/candidate hash and derives the strictest reviewed outcome", () => {
    const input = reviews();
    input[3] = { ...input[3]!, outcome: "not-observable", note: "Back cavity is occluded." };
    const review = createPartVisualAdmissionReviewRecord(pendingPacket(), {
      reviewer: "unit reviewer",
      method: "human-visual-inspection",
      views: input,
      timestamp: "2026-08-11T01:00:00.000Z",
    });

    expect(review.outcome).toBe("not-observable");
    expect(review.views).toHaveLength(8);
    expect(
      review.views.every(({ source, candidate }) => source.pngSha256 === candidate.pngSha256),
    ).toBe(true);
    const { reviewHash, ...base } = review;
    expect(reviewHash).toBe(canonicalDigest(base));
  });

  it("refuses missing views, a pending per-view claim, and packet tampering", () => {
    const packet = pendingPacket();
    expect(() =>
      createPartVisualAdmissionReviewRecord(packet, {
        reviewer: "reviewer",
        method: "human",
        views: reviews().slice(0, -1),
      }),
    ).toThrow(/exactly top, bottom, front, back, left, right, isometric, underside-oblique/);
    const pending = reviews() as unknown as Array<{
      viewName: string;
      outcome: string;
      note: string;
    }>;
    pending[0]!.outcome = "pending";
    expect(() =>
      createPartVisualAdmissionReviewRecord(packet, {
        reviewer: "reviewer",
        method: "human",
        views: pending as PartVisualAdmissionViewReviewInput[],
      }),
    ).toThrow(/must be same, different, or not-observable/);
    expect(() =>
      createPartVisualAdmissionReviewRecord(
        { ...packet, createdAt: "tampered" },
        { reviewer: "reviewer", method: "human", views: reviews() },
      ),
    ).toThrow(/does not match packetHash/);
  });

  it("refuses a retained PNG that no longer matches its pending packet", () => {
    const root = visualReviewTestDirectory("visual-admission-review-");
    cleanup.push(root);
    const run = join(root, "runs", "unit-run");
    const bytes = Buffer.from([1]);
    const packet = pendingPacket(bytes);
    for (const image of packet.images) {
      const path = join(run, image.path);
      mkdirSync(join(path, ".."), { recursive: true });
      writeFileSync(path, bytes);
    }
    const packetPath = join(run, "packet.json");
    writeFileSync(packetPath, `${canonicalStringify(packet)}\n`);
    writeFileSync(join(run, packet.images[0]!.path), Buffer.from([2]));

    expect(() =>
      publishPartVisualAdmissionReview({
        packetPath,
        reviewer: "reviewer",
        method: "human",
        views: reviews(),
      }),
    ).toThrow(/caller pinned/);
  });

  it("strictly rejects rehashed aggregate, image-binding, nested-key, text, and timestamp changes", () => {
    const packet = pendingPacket();
    const valid = createPartVisualAdmissionReviewRecord(packet, {
      reviewer: "reviewer",
      method: "human",
      views: reviews(),
      timestamp: "2026-08-11T01:00:00.000Z",
    });

    const aggregate = mutableReview(valid);
    mutableView(aggregate).outcome = "different";
    expect(() => verifyPartVisualAdmissionReviewRecord(packet, rehashedReview(aggregate))).toThrow(
      /aggregate outcome.*require different/,
    );

    const binding = mutableReview(valid);
    const source = mutableView(binding).source as Record<string, unknown>;
    source.pngSha256 = sha256(Buffer.from("replacement"));
    expect(() => verifyPartVisualAdmissionReviewRecord(packet, rehashedReview(binding))).toThrow(
      /PNG\/RGBA hashes do not match the retained packet/,
    );

    const extraNestedKey = mutableReview(valid);
    (mutableView(extraNestedKey).source as Record<string, unknown>).extra = true;
    expect(() =>
      verifyPartVisualAdmissionReviewRecord(packet, rehashedReview(extraNestedKey)),
    ).toThrow(/keys must be exactly pngSha256, rgbaSha256/);

    const untrimmed = mutableReview(valid);
    untrimmed.reviewer = " reviewer ";
    expect(() => verifyPartVisualAdmissionReviewRecord(packet, rehashedReview(untrimmed))).toThrow(
      /must already be trimmed/,
    );

    const impossibleTimestamp = mutableReview(valid);
    impossibleTimestamp.createdAt = "2026-02-30T00:00:00.000Z";
    expect(() =>
      verifyPartVisualAdmissionReviewRecord(packet, rehashedReview(impossibleTimestamp)),
    ).toThrow(/must be one real canonical UTC instant/);

    let toJsonCalls = 0;
    expect(() =>
      requirePartVisualAdmissionReviewTimestamp(
        {
          toJSON: () => {
            toJsonCalls += 1;
            return "2026-08-11T01:00:00.000Z";
          },
        },
        "Hostile timestamp",
      ),
    ).toThrow(/must be one real canonical UTC instant/);
    expect(toJsonCalls).toBe(0);
  });

  it("batch publication re-verifies aggregate and packet-bound PNG/RGBA hashes", () => {
    const root = visualReviewTestDirectory("visual-admission-review-batch-");
    cleanup.push(root);
    const fixture = writePacketRun(root, { review: true });
    const captureBatchPath = writeCaptureBatch(root, fixture.packet, fixture.catalogPartId);

    const aggregate = mutableReview(fixture.review);
    mutableView(aggregate).outcome = "different";
    writeFileSync(fixture.reviewPath, `${canonicalStringify(rehashedReview(aggregate))}\n`);
    expect(() =>
      publishPartVisualAdmissionReviewBatch({
        captureBatchPath,
        timestamp: "2026-08-11T02:00:00.000Z",
      }),
    ).toThrow(/aggregate outcome.*require different/);

    const binding = mutableReview(fixture.review);
    (mutableView(binding).candidate as Record<string, unknown>).rgbaSha256 = sha256(
      Buffer.from("replacement-rgba"),
    );
    writeFileSync(fixture.reviewPath, `${canonicalStringify(rehashedReview(binding))}\n`);
    expect(() =>
      publishPartVisualAdmissionReviewBatch({
        captureBatchPath,
        timestamp: "2026-08-11T02:00:00.000Z",
      }),
    ).toThrow(/PNG\/RGBA hashes do not match the retained packet/);
  });

  it("batch publication re-reads every packet PNG after the review sidecar is created", () => {
    const root = visualReviewTestDirectory("visual-admission-review-batch-png-");
    cleanup.push(root);
    const fixture = writePacketRun(root, { review: true });
    const captureBatchPath = writeCaptureBatch(root, fixture.packet, fixture.catalogPartId);
    writeFileSync(join(fixture.run, fixture.packet.images[0]!.path), Buffer.from([2]));

    expect(() =>
      publishPartVisualAdmissionReviewBatch({
        captureBatchPath,
        timestamp: "2026-08-11T02:00:00.000Z",
      }),
    ).toThrow(/caller pinned/);
  });

  it("rejects a packet path whose in-repository ancestor is a symlink or junction", () => {
    const linkedRoot = visualReviewTestDirectory("visual-admission-review-link-");
    const targetRoot = visualReviewTestDirectory("visual-admission-review-target-");
    cleanup.push(linkedRoot, targetRoot);
    writePacketRun(targetRoot);
    symlinkSync(
      resolve(targetRoot, "runs"),
      join(linkedRoot, "runs"),
      process.platform === "win32" ? "junction" : "dir",
    );

    expect(() =>
      publishPartVisualAdmissionReview({
        packetPath: join(linkedRoot, "runs", "unit-run", "packet.json"),
        reviewer: "reviewer",
        method: "human",
        views: reviews(),
      }),
    ).toThrow(/symlink, junction/);
  });
});
