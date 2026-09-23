import { createHash, randomBytes } from "node:crypto";
import { spawn, type ChildProcess } from "node:child_process";
import { once } from "node:events";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { describe, expect, it } from "vitest";

import {
  __testOnly,
  realBuildPrefix50Step44ProcessExists,
  spawnRealBuildPrefix50Step44OwnedProcess,
  stopRealBuildPrefix50Step44OwnedProcessTree,
  type RealBuildPrefix50Step44OwnedProcessTree,
} from "../e2e/real-build-prefix50-subbuild-return-review-process";
import { REAL_BUILD_PREFIX50_STEP44_STATIC_APP_ASSETS } from "../e2e/real-build-prefix50-subbuild-return-review-static-app-manifest.ts";

const LONG_LIVED_SCRIPT = "setInterval(() => undefined, 1000);";

async function waitForExit(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) return;
  await once(child, "exit");
}

async function waitUntil(predicate: () => boolean, description: string): Promise<void> {
  const deadline = Date.now() + 5_000;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await new Promise((resolveWait) => setTimeout(resolveWait, 10));
  }
  throw new Error(`Timed out waiting for ${description}.`);
}

async function freePort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolveListen, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolveListen);
  });
  const address = server.address();
  if (address === null || typeof address === "string")
    throw new Error("Static-app control could not reserve a local port.");
  await new Promise<void>((resolveClose, reject) =>
    server.close((error) => (error === undefined ? resolveClose() : reject(error))),
  );
  return address.port;
}

async function waitForStaticApp(
  url: string,
  tree: RealBuildPrefix50Step44OwnedProcessTree,
): Promise<Response> {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    if (tree.workloadError !== null || tree.workloadExited)
      throw new Error("Static-app control exited before readiness.");
    try {
      const response = await fetch(url);
      if (response.ok) return response;
    } catch {
      // The exact task-owned child remains live; retry within the bounded readiness window.
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 25));
  }
  throw new Error("Static-app control did not become ready within 10000ms.");
}

async function readGrandchildEvidence(output: NodeJS.ReadableStream): Promise<{
  pid: number;
  transientMilliseconds: number;
}> {
  return new Promise((resolveEvidence, rejectEvidence) => {
    let text = "";
    const timer = setTimeout(
      () => rejectEvidence(new Error("Transient-parent control did not report its evidence.")),
      5_000,
    );
    timer.unref();
    output.setEncoding("utf8");
    output.on("data", (chunk: string) => {
      text += chunk;
      const pid = /GRANDCHILD:(\d+)/u.exec(text)?.[1];
      const milliseconds = /TRANSIENT_MS:(\d+)/u.exec(text)?.[1];
      if (pid === undefined || milliseconds === undefined) return;
      clearTimeout(timer);
      resolveEvidence({ pid: Number(pid), transientMilliseconds: Number(milliseconds) });
    });
    output.once("error", rejectEvidence);
  });
}

function spawnUnrelatedControl(): ChildProcess {
  return spawn(process.execPath, ["--input-type=commonjs", "-e", LONG_LIVED_SCRIPT], {
    detached: true,
    windowsHide: true,
    stdio: "ignore",
  });
}

function expectSingleLaunchEvidence(tree: RealBuildPrefix50Step44OwnedProcessTree): void {
  expect([
    tree.bootstrapLaunchAttempts,
    tree.bootstrapLaunchResults,
    tree.workloadLaunchAttempts,
    tree.workloadLaunchResults,
  ]).toEqual([1, 1, 1, 1]);
}

async function killExactControl(child: ChildProcess): Promise<void> {
  if (child.pid !== undefined && realBuildPrefix50Step44ProcessExists(child.pid))
    child.kill("SIGKILL");
  await waitForExit(child).catch(() => undefined);
}

describe("Step-44 kernel-owned process containment", () => {
  it("serves only the reviewed prebuilt app bytes and closes its owned process tree", async () => {
    const port = await freePort();
    const appUrl = `http://127.0.0.1:${port}/`;
    const indexAsset = REAL_BUILD_PREFIX50_STEP44_STATIC_APP_ASSETS.find(
      ({ relativePath }) => relativePath === "index.html",
    );
    if (indexAsset === undefined) throw new Error("Static-app manifest omitted index.html.");
    let tree: RealBuildPrefix50Step44OwnedProcessTree | null = null;
    try {
      tree = await spawnRealBuildPrefix50Step44OwnedProcess({
        job: { jobKind: "static-app-server", port },
        stdout: "pipe",
        stderr: "pipe",
      });
      expectSingleLaunchEvidence(tree);
      const response = await waitForStaticApp(appUrl, tree);
      const bytes = Buffer.from(await response.arrayBuffer());
      expect(bytes.byteLength).toBe(indexAsset.bytes);
      expect(`sha256:${createHash("sha256").update(bytes).digest("hex")}`).toBe(indexAsset.digest);
      expect(response.headers.get("etag")).toBe(`"${indexAsset.digest}"`);
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect((await fetch(`${appUrl}?unreviewed=1`)).status).toBe(404);
      expect((await fetch(`${appUrl}unreviewed.js`)).status).toBe(404);
      const head = await fetch(appUrl, { method: "HEAD" });
      expect(head.status).toBe(200);
      expect((await head.arrayBuffer()).byteLength).toBe(0);
      expect(await stopRealBuildPrefix50Step44OwnedProcessTree(tree)).toBe(true);
      expect(tree.activeProcessCountAfterStop).toBe(0);
      tree = null;
    } finally {
      await stopRealBuildPrefix50Step44OwnedProcessTree(tree).catch(() => undefined);
    }
  }, 30_000);

  it("scrubs NODE_OPTIONS and NODE_PATH before both owned Node launch boundaries", async () => {
    const root = resolve("output/step44-owned-process-environment-control");
    const modulePath = resolve(root, "hostile-node-option.mjs");
    const sentinel = resolve(root, "hostile-node-option-ran.txt");
    mkdirSync(root, { recursive: true });
    writeFileSync(
      modulePath,
      `import { writeFileSync } from "node:fs";\nwriteFileSync(${JSON.stringify(sentinel)}, "ran\\n");\n`,
      "utf8",
    );
    const previousOptions = process.env.NODE_OPTIONS;
    const previousPath = process.env.NODE_PATH;
    let tree: RealBuildPrefix50Step44OwnedProcessTree | null = null;
    try {
      process.env.NODE_OPTIONS = `--import=${pathToFileURL(modulePath).href}`;
      process.env.NODE_PATH = root;
      tree = await spawnRealBuildPrefix50Step44OwnedProcess({
        job: { jobKind: "containment-hold" },
      });
      expectSingleLaunchEvidence(tree);
      expect(existsSync(sentinel)).toBe(false);
    } finally {
      await stopRealBuildPrefix50Step44OwnedProcessTree(tree).catch(() => undefined);
      if (previousOptions === undefined) delete process.env.NODE_OPTIONS;
      else process.env.NODE_OPTIONS = previousOptions;
      if (previousPath === undefined) delete process.env.NODE_PATH;
      else process.env.NODE_PATH = previousPath;
      rmSync(root, { recursive: true, force: true });
    }
  });

  it.runIf(process.platform === "win32")(
    "contains a detached child born and orphaned inside one former 50ms sampling gap",
    async () => {
      const unrelated = spawnUnrelatedControl();
      let tree: RealBuildPrefix50Step44OwnedProcessTree | null = null;
      let grandchildPid: number | null = null;
      try {
        tree = await spawnRealBuildPrefix50Step44OwnedProcess({
          job: { jobKind: "containment-transient-parent", detachGrandchild: true },
          stdout: "pipe",
          stderr: "pipe",
        });
        expectSingleLaunchEvidence(tree);
        if (tree.root.stdout === null) throw new Error("Transient-parent control has no stdout.");
        const evidence = await readGrandchildEvidence(tree.root.stdout);
        grandchildPid = evidence.pid;
        await waitUntil(() => tree?.workloadExited === true, "the transient parent to exit");

        expect(evidence.transientMilliseconds).toBeLessThan(50);
        expect(realBuildPrefix50Step44ProcessExists(grandchildPid)).toBe(true);
        expect(realBuildPrefix50Step44ProcessExists(unrelated.pid ?? 0)).toBe(true);
        expect(tree.containment).toBe("windows-job");
        expect(tree.activeProcessCountAtAssignment).toBe(1);

        expect(await stopRealBuildPrefix50Step44OwnedProcessTree(tree)).toBe(true);
        expect(tree.activeProcessCountBeforeStop).toBeGreaterThanOrEqual(2);
        expect(tree.activeProcessCountAfterStop).toBe(0);
        expect(realBuildPrefix50Step44ProcessExists(grandchildPid)).toBe(false);
        expect(realBuildPrefix50Step44ProcessExists(unrelated.pid ?? 0)).toBe(true);
        tree = null;
      } finally {
        await stopRealBuildPrefix50Step44OwnedProcessTree(tree).catch(() => undefined);
        if (grandchildPid !== null && realBuildPrefix50Step44ProcessExists(grandchildPid))
          process.kill(grandchildPid, "SIGKILL");
        await killExactControl(unrelated);
      }
    },
    40_000,
  );

  it.runIf(process.platform === "win32")(
    "refuses a wrong creation identity without assigning or terminating the unrelated process",
    async () => {
      const unrelated = spawnUnrelatedControl();
      try {
        const processId = unrelated.pid;
        if (processId === undefined) throw new Error("Wrong-identity control has no PID.");
        const actual = await __testOnly.queryWindowsCreationIdentity(processId);
        await expect(
          __testOnly.startWindowsJobOwner({
            processId,
            expectedCreationIdentity: (BigInt(actual) + 1n).toString(),
            nonce: randomBytes(32).toString("hex"),
          }),
        ).rejects.toThrow(/creation identity mismatch/u);
        expect(realBuildPrefix50Step44ProcessExists(processId)).toBe(true);
      } finally {
        await killExactControl(unrelated);
      }
    },
    30_000,
  );

  it.runIf(process.platform === "win32")(
    "kills the assigned process when the Job Object owner exits unexpectedly",
    async () => {
      const root = spawnUnrelatedControl();
      try {
        const processId = root.pid;
        if (processId === undefined) throw new Error("Kill-on-close control has no PID.");
        const identity = await __testOnly.queryWindowsCreationIdentity(processId);
        const owner = await __testOnly.startWindowsJobOwner({
          processId,
          expectedCreationIdentity: identity,
          nonce: randomBytes(32).toString("hex"),
        });
        owner.child.kill("SIGKILL");
        await waitForExit(owner.child);
        await waitUntil(
          () => !realBuildPrefix50Step44ProcessExists(processId),
          "KILL_ON_JOB_CLOSE to terminate its root",
        );
        expect(realBuildPrefix50Step44ProcessExists(processId)).toBe(false);
      } finally {
        await killExactControl(root);
      }
    },
    30_000,
  );

  it.runIf(process.platform === "win32")(
    "forces an exact hung helper exit so KILL_ON_JOB_CLOSE closes every owned member",
    async () => {
      const unrelated = spawnUnrelatedControl();
      let tree: RealBuildPrefix50Step44OwnedProcessTree | null = null;
      try {
        tree = await __testOnly.spawnWithHungWindowsJobOwner({
          job: { jobKind: "containment-hold" },
          stdout: "ignore",
          stderr: "pipe",
        });
        expectSingleLaunchEvidence(tree);
        expect(realBuildPrefix50Step44ProcessExists(tree.rootPid)).toBe(true);
        expect(realBuildPrefix50Step44ProcessExists(tree.workloadPid)).toBe(true);
        expect(realBuildPrefix50Step44ProcessExists(unrelated.pid ?? 0)).toBe(true);

        expect(await stopRealBuildPrefix50Step44OwnedProcessTree(tree)).toBe(true);
        expect(tree.activeProcessCountBeforeStop).toBeNull();
        expect(tree.activeProcessCountAfterStop).toBe(0);
        expect(realBuildPrefix50Step44ProcessExists(tree.rootPid)).toBe(false);
        expect(realBuildPrefix50Step44ProcessExists(tree.workloadPid)).toBe(false);
        expect(realBuildPrefix50Step44ProcessExists(unrelated.pid ?? 0)).toBe(true);
        tree = null;
      } finally {
        await stopRealBuildPrefix50Step44OwnedProcessTree(tree).catch(() => undefined);
        await killExactControl(unrelated);
      }
    },
    30_000,
  );

  it.runIf(process.platform !== "win32")(
    "anchors an atomic POSIX process group until exact group cleanup",
    async () => {
      const unrelated = spawnUnrelatedControl();
      let tree: RealBuildPrefix50Step44OwnedProcessTree | null = null;
      let grandchildPid: number | null = null;
      try {
        tree = await spawnRealBuildPrefix50Step44OwnedProcess({
          job: { jobKind: "containment-transient-parent", detachGrandchild: false },
          stdout: "pipe",
          stderr: "pipe",
        });
        expectSingleLaunchEvidence(tree);
        if (tree.root.stdout === null)
          throw new Error("POSIX process-group control has no stdout.");
        grandchildPid = (await readGrandchildEvidence(tree.root.stdout)).pid;
        await waitUntil(() => tree?.workloadExited === true, "the POSIX transient parent to exit");
        expect(tree.containment).toBe("posix-process-group");
        expect(realBuildPrefix50Step44ProcessExists(grandchildPid)).toBe(true);
        expect(await stopRealBuildPrefix50Step44OwnedProcessTree(tree)).toBe(true);
        expect(realBuildPrefix50Step44ProcessExists(grandchildPid)).toBe(false);
        expect(realBuildPrefix50Step44ProcessExists(unrelated.pid ?? 0)).toBe(true);
        tree = null;
      } finally {
        await stopRealBuildPrefix50Step44OwnedProcessTree(tree).catch(() => undefined);
        if (grandchildPid !== null && realBuildPrefix50Step44ProcessExists(grandchildPid))
          process.kill(grandchildPid, "SIGKILL");
        await killExactControl(unrelated);
      }
    },
    20_000,
  );
});
