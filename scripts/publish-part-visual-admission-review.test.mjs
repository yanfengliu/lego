import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  renameSync,
  rmSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";

import {
  cleanupExpectedDirectory,
  directoryIdentity,
  exactFile,
  publishExpectedDirectory,
  verifyCaptureBatch,
  verifyPacketPngBinding,
} from "./part-visual-admission-pair-files.mjs";

function visualReviewTestDirectory(prefix) {
  mkdirSync("test-results", { recursive: true });
  return mkdtempSync(join("test-results", prefix));
}

describe("part visual-admission review CLI", () => {
  it("names both supported publication modes when arguments are incomplete", () => {
    const result = spawnSync(
      process.execPath,
      [resolve("scripts/publish-part-visual-admission-review.mjs")],
      { cwd: process.cwd(), encoding: "utf8", windowsHide: true, maxBuffer: 256 * 1024 },
    );

    expect(result.status).toBe(2);
    expect(result.stderr).toContain(
      "Visual review requires either --packet <packet.json> --input <review-input.json> or --batch <capture-batch.json>.",
    );
  });

  it("names a JSON null input as a malformed review-input schema", () => {
    const directory = visualReviewTestDirectory("visual-review-cli-");
    try {
      const input = join(directory, "review-input.json");
      writeFileSync(input, "null\n");
      const result = spawnSync(
        process.execPath,
        [
          resolve("scripts/publish-part-visual-admission-review.mjs"),
          "--packet",
          join(directory, "missing-packet.json"),
          "--input",
          input,
        ],
        { cwd: process.cwd(), encoding: "utf8", windowsHide: true, maxBuffer: 256 * 1024 },
      );

      expect(result.status).toBe(1);
      expect(result.stderr).toContain(
        "Visual-review input must be lego.part-visual-admission-review-input/1",
      );
      expect(result.stderr).not.toContain("Cannot convert undefined or null to object");
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("refuses a review input reached through a linked directory ancestor", () => {
    const directory = visualReviewTestDirectory("visual-review-link-");
    const outside = mkdtempSync(join(tmpdir(), "lego-visual-review-outside-"));
    const linked = join(directory, "linked");
    try {
      writeFileSync(join(outside, "review-input.json"), "{}\n");
      symlinkSync(outside, linked, process.platform === "win32" ? "junction" : "dir");
      const result = spawnSync(
        process.execPath,
        [
          resolve("scripts/publish-part-visual-admission-review.mjs"),
          "--packet",
          join(directory, "runs", "missing", "packet.json"),
          "--input",
          join(linked, "review-input.json"),
        ],
        { cwd: process.cwd(), encoding: "utf8", windowsHide: true, maxBuffer: 256 * 1024 },
      );

      expect(result.status).toBe(1);
      expect(result.stderr).toMatch(/linked|junction|symbolic-link/iu);
    } finally {
      if (existsSync(linked)) unlinkSync(linked);
      rmSync(directory, { recursive: true, force: true });
      rmSync(outside, { recursive: true, force: true });
    }
  });

  it("refuses a capture batch reached through a linked directory ancestor", () => {
    const directory = visualReviewTestDirectory("visual-pairs-link-");
    const outside = mkdtempSync(join(tmpdir(), "lego-visual-pairs-outside-"));
    const linked = join(directory, "linked");
    try {
      mkdirSync(join(outside, "batches"));
      writeFileSync(join(outside, "batches", "capture.json"), "{}\n");
      symlinkSync(outside, linked, process.platform === "win32" ? "junction" : "dir");
      const result = spawnSync(
        process.execPath,
        [
          resolve("scripts/create-part-visual-admission-pairs.mjs"),
          "--batch",
          join(linked, "batches", "capture.json"),
          "--output",
          join(directory, "native-pairs"),
        ],
        { cwd: process.cwd(), encoding: "utf8", windowsHide: true, maxBuffer: 256 * 1024 },
      );

      expect(result.status).not.toBe(0);
      expect(result.stderr).toMatch(/linked|junction|symbolic-link/iu);
    } finally {
      if (existsSync(linked)) unlinkSync(linked);
      rmSync(directory, { recursive: true, force: true });
      rmSync(outside, { recursive: true, force: true });
    }
  }, 15_000);

  it("refuses a native-pair output reached through a linked directory ancestor", () => {
    const directory = visualReviewTestDirectory("visual-pairs-output-link-");
    const outside = mkdtempSync(join(tmpdir(), "lego-visual-pairs-output-outside-"));
    const linked = join(directory, "linked");
    try {
      const batches = join(directory, "batches");
      mkdirSync(batches);
      writeFileSync(join(batches, "capture.json"), "{}\n");
      symlinkSync(outside, linked, process.platform === "win32" ? "junction" : "dir");
      const result = spawnSync(
        process.execPath,
        [
          resolve("scripts/create-part-visual-admission-pairs.mjs"),
          "--batch",
          join(batches, "capture.json"),
          "--output",
          join(linked, "native-pairs"),
        ],
        { cwd: process.cwd(), encoding: "utf8", windowsHide: true, maxBuffer: 256 * 1024 },
      );

      expect(result.status).not.toBe(0);
      expect(result.stderr).toMatch(/linked|junction|symbolic-link/iu);
      expect(existsSync(join(outside, "native-pairs"))).toBe(false);
    } finally {
      if (existsSync(linked)) unlinkSync(linked);
      rmSync(directory, { recursive: true, force: true });
      rmSync(outside, { recursive: true, force: true });
    }
  }, 15_000);

  it("bounds the opened descriptor and rejects a path replacement after lstat", () => {
    const directory = visualReviewTestDirectory("visual-pairs-exact-file-");
    try {
      const path = join(directory, "pair.png");
      const replacement = join(directory, "replacement.png");
      const displaced = join(directory, "displaced.png");
      writeFileSync(path, "tiny");
      writeFileSync(replacement, "replacement-is-over-the-eight-byte-limit");

      expect(() =>
        exactFile(path, 8, "test pair", {
          __testHooks: {
            afterPathLstat: () => {
              renameSync(path, displaced);
              renameSync(replacement, path);
            },
          },
        }),
      ).toThrow(/changed identity, size, or timestamps between lstat and open/iu);
      expect(() => exactFile(path, 8, "test replacement")).toThrow(
        /opened as 40 bytes; allowed range is 1\.\.8/iu,
      );
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("rejects a staging-directory replacement even when the rename itself succeeds", () => {
    const directory = visualReviewTestDirectory("visual-pairs-publish-swap-");
    const staging = join(directory, "staging");
    const replacement = join(directory, "replacement");
    const displaced = join(directory, "displaced");
    const destination = join(directory, "published");
    mkdirSync(staging);
    mkdirSync(replacement);
    const expectedIdentity = directoryIdentity(staging, "test staging");
    try {
      expect(() =>
        publishExpectedDirectory({
          destination,
          expectedIdentity,
          label: "test publication",
          renameContainedDirectoryAtomic: (root, source, target) =>
            renameSync(join(root, source), join(root, target)),
          staging,
          __testHooks: {
            afterPreflight: () => {
              renameSync(staging, displaced);
              renameSync(replacement, staging);
            },
          },
        }),
      ).toThrow(/target changed identity or resolution/iu);
      expect(directoryIdentity(displaced, "displaced staging").ino).toBe(expectedIdentity.ino);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("does not recursively clean a replacement that appears after the identity match", () => {
    const directory = visualReviewTestDirectory("visual-pairs-cleanup-swap-");
    const staging = join(directory, "staging");
    const replacement = join(directory, "replacement");
    const displaced = join(directory, "displaced");
    mkdirSync(staging);
    mkdirSync(replacement);
    const expectedIdentity = directoryIdentity(staging, "test cleanup staging");
    const removeContainedDirectoryTree = vi.fn();
    try {
      expect(() =>
        cleanupExpectedDirectory({
          candidates: [staging],
          expectedIdentity,
          label: "test cleanup",
          removeContainedDirectoryTree,
          __testHooks: {
            afterIdentityMatch: () => {
              renameSync(staging, displaced);
              renameSync(replacement, staging);
            },
          },
        }),
      ).toThrow(/changed identity or resolution/iu);
      expect(removeContainedDirectoryTree).not.toHaveBeenCalled();
      expect(existsSync(staging)).toBe(true);
      expect(existsSync(displaced)).toBe(true);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("names observed capture-schema, count, and PNG-dimension values", () => {
    const digest = `sha256:${"a".repeat(64)}`;
    expect(() =>
      verifyCaptureBatch(
        { schemaVersion: "wrong/1", batchHash: digest, requestedPartIds: [], packets: [] },
        () => digest,
      ),
    ).toThrow(
      /schemaVersion is "wrong\/1"; required lego\.part-visual-admission-capture-batch\/1/iu,
    );
    expect(() =>
      verifyCaptureBatch(
        {
          schemaVersion: "lego.part-visual-admission-capture-batch/1",
          batchHash: digest,
          requestedPartIds: ["builtin:brick-1x1"],
          packets: [],
        },
        () => digest,
      ),
    ).toThrow(/has 1 requestedPartIds and 0 packets; the counts must match exactly/iu);
    expect(() =>
      verifyPacketPngBinding({
        candidate: { width: 640, height: 640, bytes: 1, sha256: digest },
        candidateBytes: Buffer.from("x"),
        label: "builtin:brick-1x1/top",
        requiredHeight: 640,
        requiredWidth: 640,
        sha256: () => digest,
        source: { width: 320, height: 640, bytes: 1, sha256: digest },
        sourceBytes: Buffer.from("x"),
      }),
    ).toThrow(/source declares 320x640; required 640x640/iu);
  });
});
