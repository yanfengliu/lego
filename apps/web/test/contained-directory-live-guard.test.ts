import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  renameSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  acquireContainedDirectoryLiveGuard,
  reassertContainedDirectoryLiveGuard,
  releaseContainedDirectoryLiveGuard,
} from "../e2e/contained-directory-live-guard";

const RECEIPT = "real-build-prefix50-step44-promotion-receipt.json";

function attemptSamePathReplacement(directory: string, displaced: string): boolean {
  try {
    renameSync(directory, displaced);
    mkdirSync(directory);
    return true;
  } catch (error) {
    expect(error).toMatchObject({ code: expect.stringMatching(/^(?:EBUSY|EACCES|EPERM)$/u) });
    return false;
  }
}

function expectNoReceipt(directory: string): void {
  expect(existsSync(resolve(directory, RECEIPT))).toBe(false);
}

describe("contained live directory publication guard", () => {
  it("blocks or detects ordinary same-path replacement after authority mint", () => {
    const root = mkdtempSync(resolve(tmpdir(), "lego-promotion-directory-guard-"));
    const promotion = resolve(root, "promotion");
    const displaced = resolve(root, "promotion-displaced");
    mkdirSync(promotion);
    const guard = acquireContainedDirectoryLiveGuard(root, "promotion", "promotion authority");
    try {
      const replaced = attemptSamePathReplacement(promotion, displaced);
      if (replaced)
        expect(() => reassertContainedDirectoryLiveGuard(guard, root, "promotion")).toThrow(
          /canonical device\/inode identity|no longer names/u,
        );
      else reassertContainedDirectoryLiveGuard(guard, root, "promotion");
      expectNoReceipt(promotion);
      if (replaced) expectNoReceipt(displaced);
    } finally {
      releaseContainedDirectoryLiveGuard(guard);
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("blocks or detects replacement after payload but before the sole authority receipt", () => {
    const root = mkdtempSync(resolve(tmpdir(), "lego-promotion-payload-guard-"));
    const promotion = resolve(root, "promotion");
    const displaced = resolve(root, "promotion-displaced");
    mkdirSync(promotion);
    const guard = acquireContainedDirectoryLiveGuard(root, "promotion", "promotion authority");
    try {
      writeFileSync(resolve(promotion, "real-build-prefix50-step44-selected-document.json"), "{}");
      writeFileSync(resolve(promotion, "real-build-prefix50-step44-selected-envelope.json"), "{}");
      reassertContainedDirectoryLiveGuard(guard, root, "promotion");
      const replaced = attemptSamePathReplacement(promotion, displaced);
      if (replaced)
        expect(() => reassertContainedDirectoryLiveGuard(guard, root, "promotion")).toThrow(
          /canonical device\/inode identity|no longer names/u,
        );
      else reassertContainedDirectoryLiveGuard(guard, root, "promotion");
      expectNoReceipt(promotion);
      if (replaced) expectNoReceipt(displaced);
    } finally {
      releaseContainedDirectoryLiveGuard(guard);
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("rejects a symlink or Windows junction before minting a guard", () => {
    const root = mkdtempSync(resolve(tmpdir(), "lego-promotion-alias-guard-"));
    const outside = mkdtempSync(resolve(tmpdir(), "lego-promotion-alias-target-"));
    const alias = resolve(root, "promotion");
    try {
      symlinkSync(outside, alias, process.platform === "win32" ? "junction" : "dir");
      expect(() =>
        acquireContainedDirectoryLiveGuard(root, "promotion", "promotion authority"),
      ).toThrow(/symlink|junction|alias|real directory/u);
      expectNoReceipt(outside);
    } finally {
      rmSync(root, { recursive: true, force: true });
      rmSync(outside, { recursive: true, force: true });
    }
  });
});
