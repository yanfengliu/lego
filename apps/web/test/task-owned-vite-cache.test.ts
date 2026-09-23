import { existsSync, mkdtempSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  environmentWithTaskOwnedViteCache,
  STEP44_TASK_OWNED_VITE_CACHE_ENVIRONMENT_KEY,
  STEP44_TASK_OWNED_VITE_CACHE_PREFIX,
  taskOwnedViteCacheConfig,
} from "../task-owned-vite-cache";
import {
  createRealBuildPrefix50Step44ViteCache,
  removeRealBuildPrefix50Step44ViteCache,
} from "../e2e/real-build-prefix50-subbuild-return-review-vite-cache";

const ownedDirectories: string[] = [];

function ownedCacheDirectory(): string {
  const created = mkdtempSync(join(tmpdir(), STEP44_TASK_OWNED_VITE_CACHE_PREFIX));
  const canonical = realpathSync.native(created);
  ownedDirectories.push(canonical);
  return canonical;
}

afterEach(() => {
  for (const directory of ownedDirectories.splice(0))
    rmSync(directory, { recursive: true, force: true });
});

describe("task-owned Vite cache", () => {
  it("leaves ordinary Vite runs unchanged and configures the exact owned cache when requested", () => {
    expect(taskOwnedViteCacheConfig({})).toEqual({});
    const directory = ownedCacheDirectory();
    const environment = environmentWithTaskOwnedViteCache(directory, { NODE_ENV: "test" });

    expect(environment).toEqual({
      NODE_ENV: "test",
      [STEP44_TASK_OWNED_VITE_CACHE_ENVIRONMENT_KEY]: directory,
    });
    expect(taskOwnedViteCacheConfig(environment)).toEqual({ cacheDir: directory });
  });

  it("refuses a child cache outside the exact temporary ownership boundary", () => {
    expect(() => environmentWithTaskOwnedViteCache(resolve("apps/web"), {})).toThrow(
      /must be an ordinary canonical lego-step44-vite-cache-\* directory/u,
    );
  });

  it("creates and removes the standalone lifecycle cache as an exact temporary leaf", async () => {
    const cache = await createRealBuildPrefix50Step44ViteCache();
    ownedDirectories.push(cache.directory);

    expect(existsSync(cache.directory)).toBe(true);
    expect(taskOwnedViteCacheConfig(cache.environment)).toEqual({ cacheDir: cache.directory });
    await removeRealBuildPrefix50Step44ViteCache(cache.directory);
    expect(existsSync(cache.directory)).toBe(false);
    ownedDirectories.pop();
  });
});
