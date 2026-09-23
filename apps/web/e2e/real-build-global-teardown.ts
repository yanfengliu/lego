import { existsSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, relative, resolve } from "node:path";

import { realBuildViteShutdownPreservationDecision } from "./real-build-vite-shutdown-preservation.ts";

function inside(root: string, candidate: string): boolean {
  const path = relative(root, candidate);
  return path !== ".." && !path.startsWith("../") && !path.startsWith("..\\");
}

/** Releases and removes only the unique pre-discovery lock owned by this Playwright run. */
export async function realBuildGlobalTeardownWithEnvironment(
  environment: NodeJS.ProcessEnv,
): Promise<void> {
  const directoryValue = environment.LEGO_REAL_BUILD_BOOTSTRAP_DIRECTORY;
  if (directoryValue === undefined) return;
  const directory = resolve(directoryValue);
  const temporaryRoot = resolve(tmpdir());
  const releasePath = environment.LEGO_REAL_BUILD_BOOTSTRAP_RELEASE;
  const pid = Number(environment.LEGO_REAL_BUILD_BOOTSTRAP_LOCK_PID);
  if (
    !inside(temporaryRoot, directory) ||
    dirname(directory) !== temporaryRoot ||
    !basename(directory).startsWith("lego-real-build-bootstrap-") ||
    releasePath === undefined ||
    dirname(resolve(releasePath)) !== directory ||
    !Number.isSafeInteger(pid) ||
    pid <= 0
  ) {
    throw new Error(
      "Refusing to release a pre-discovery real-build lock outside its exact task-owned temporary directory.",
    );
  }
  const preservation = realBuildViteShutdownPreservationDecision({ directory, environment });
  if (preservation.preserve) {
    throw new Error(
      `Refusing to release or remove the real-build bootstrap after an unconfirmed Vite shutdown: ${preservation.reason}.`,
    );
  }
  if (!existsSync(releasePath)) writeFileSync(releasePath, "RELEASE\n", { flag: "wx" });
  const sleeper = new Int32Array(new SharedArrayBuffer(4));
  const deadline = Date.now() + 10_000;
  let running = true;
  while (running && Date.now() < deadline) {
    try {
      process.kill(pid, 0);
      Atomics.wait(sleeper, 0, 0, 50);
    } catch {
      running = false;
    }
  }
  if (running) {
    throw new Error(
      `Pre-discovery real-build source-lock process ${pid} did not release in 10 seconds; its task-owned bootstrap directory remains at ${directory}.`,
    );
  }
  if (existsSync(directory)) rmSync(directory, { recursive: true, force: false });
}

/** Playwright entrypoint; the environment seam above keeps preservation tests process-free. */
export default async function realBuildGlobalTeardown(): Promise<void> {
  await realBuildGlobalTeardownWithEnvironment(process.env);
}
