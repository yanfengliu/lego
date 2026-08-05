import { existsSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, relative, resolve } from "node:path";

function inside(root: string, candidate: string): boolean {
  const path = relative(root, candidate);
  return path !== ".." && !path.startsWith("../") && !path.startsWith("..\\");
}

/** Releases and removes only the unique pre-discovery lock owned by this Playwright run. */
export default async function realBuildGlobalTeardown(): Promise<void> {
  const directoryValue = process.env.LEGO_REAL_BUILD_BOOTSTRAP_DIRECTORY;
  if (directoryValue === undefined) return;
  const directory = resolve(directoryValue);
  const temporaryRoot = resolve(tmpdir());
  const releasePath = process.env.LEGO_REAL_BUILD_BOOTSTRAP_RELEASE;
  const pid = Number(process.env.LEGO_REAL_BUILD_BOOTSTRAP_LOCK_PID);
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
