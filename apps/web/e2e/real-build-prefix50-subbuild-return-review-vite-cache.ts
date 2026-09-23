import { mkdtemp, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  environmentWithTaskOwnedViteCache,
  STEP44_TASK_OWNED_VITE_CACHE_ENVIRONMENT_KEY,
  STEP44_TASK_OWNED_VITE_CACHE_PREFIX,
  taskOwnedViteCacheDirectory,
} from "../task-owned-vite-cache.ts";

export async function createRealBuildPrefix50Step44ViteCache(): Promise<{
  readonly directory: string;
  readonly environment: NodeJS.ProcessEnv;
}> {
  const created = await mkdtemp(join(tmpdir(), STEP44_TASK_OWNED_VITE_CACHE_PREFIX));
  try {
    const directory = await realpath(created);
    return {
      directory,
      environment: environmentWithTaskOwnedViteCache(directory),
    };
  } catch (error) {
    await rm(created, { recursive: true, force: true });
    throw error;
  }
}

export async function removeRealBuildPrefix50Step44ViteCache(directory: string): Promise<void> {
  const exact = taskOwnedViteCacheDirectory({
    [STEP44_TASK_OWNED_VITE_CACHE_ENVIRONMENT_KEY]: directory,
  });
  if (exact === undefined) throw new TypeError("Step-44 Vite cache directory was not published.");
  await rm(exact, { recursive: true, force: false });
}
