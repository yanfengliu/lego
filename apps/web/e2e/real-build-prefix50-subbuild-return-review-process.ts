import { randomBytes } from "node:crypto";
import { spawn, type ChildProcess } from "node:child_process";
import { once } from "node:events";
import { createInterface, type Interface } from "node:readline";
import { type Readable } from "node:stream";
import { fileURLToPath } from "node:url";

import {
  queryRealBuildPrefix50Step44WindowsCreationIdentity,
  startRealBuildPrefix50Step44WindowsJobOwner,
  type RealBuildPrefix50Step44WindowsJobOwner,
  type RealBuildPrefix50Step44WindowsJobQuiescence,
} from "./real-build-prefix50-subbuild-return-review-process-windows.ts";
import {
  encodeRealBuildPrefix50Step44OwnedProcessJob,
  scrubRealBuildPrefix50Step44OwnedProcessEnvironment,
  type RealBuildPrefix50Step44OwnedProcessJob,
} from "./real-build-prefix50-subbuild-return-review-process-jobs.ts";
import {
  assertRealBuildPrefix50Step44SameOwnedProcessIntegrity,
  verifyRealBuildPrefix50Step44OwnedProcessIntegrity,
} from "./real-build-prefix50-subbuild-return-review-process-integrity.ts";
import { createRealBuildPrefix50Step44SingleLaunch } from "./real-build-prefix50-subbuild-return-review-process-single-launch.ts";

const START_TIMEOUT_MS = 20_000;
const STOP_TIMEOUT_MS = 10_000;
const MAXIMUM_STATUS_LINE_BYTES = 8_192;
const bootstrapPath = fileURLToPath(
  new URL("./real-build-prefix50-subbuild-return-review-process-bootstrap.ts", import.meta.url),
);
const repositoryRoot = fileURLToPath(new URL("../../../", import.meta.url));

type OwnedStdio = "ignore" | "pipe" | number;

export interface RealBuildPrefix50Step44OwnedProcessSpawnInput {
  readonly job: RealBuildPrefix50Step44OwnedProcessJob;
  readonly stdout?: OwnedStdio;
  readonly stderr?: OwnedStdio;
}

interface BootstrapState {
  healthy: boolean;
  stopping: boolean;
  workloadExited: boolean;
  workloadExitCode: number | null;
  workloadExitSignal: NodeJS.Signals | null;
  workloadError: string | null;
}

export interface RealBuildPrefix50Step44OwnedProcessTree {
  readonly root: ChildProcess;
  readonly rootPid: number;
  readonly workloadPid: number;
  readonly containment: "windows-job" | "posix-process-group";
  readonly activeProcessCountAtAssignment: number;
  readonly activeProcessCountBeforeStop: number | null;
  readonly activeProcessCountAfterStop: number | null;
  readonly workloadExited: boolean;
  readonly workloadError: string | null;
  readonly bootstrapLaunchAttempts: 1;
  readonly bootstrapLaunchResults: 1;
  readonly workloadLaunchAttempts: 1;
  readonly workloadLaunchResults: 1;
  stop(): Promise<boolean>;
}

export function realBuildPrefix50Step44ProcessExists(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return !(error instanceof Error && "code" in error && error.code === "ESRCH");
  }
}

async function nextBootstrapLine(
  lines: AsyncIterator<string>,
  description: string,
): Promise<string> {
  const next = await Promise.race([
    lines.next(),
    new Promise<never>((_resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error(`Step-44 owned bootstrap timed out waiting for ${description}.`)),
        START_TIMEOUT_MS,
      );
      timer.unref();
    }),
  ]);
  if (next.done) throw new Error(`Step-44 owned bootstrap exited before ${description}.`);
  if (Buffer.byteLength(next.value) > MAXIMUM_STATUS_LINE_BYTES)
    throw new RangeError("Step-44 owned bootstrap status exceeded 8 KiB.");
  return next.value;
}

async function waitForExit(child: ChildProcess, timeoutMs: number): Promise<boolean> {
  if (child.exitCode !== null || child.signalCode !== null) return true;
  return Promise.race([
    once(child, "exit").then(() => true),
    new Promise<false>((resolveTimeout) => {
      const timer = setTimeout(() => resolveTimeout(false), timeoutMs);
      timer.unref();
    }),
  ]);
}

async function waitForOwnedRootAndWorkloadExit(input: {
  readonly root: ChildProcess;
  readonly workloadPid: number;
  readonly state: BootstrapState;
}): Promise<boolean> {
  if (!(await waitForExit(input.root, STOP_TIMEOUT_MS))) return false;
  if (input.state.workloadExited) return true;
  const deadline = Date.now() + STOP_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (!realBuildPrefix50Step44ProcessExists(input.workloadPid)) return true;
    await new Promise((resolveWait) => setTimeout(resolveWait, 20));
  }
  return false;
}

function consumeBootstrapStatus(
  lines: AsyncIterator<string>,
  lineReader: Interface,
  nonce: string,
  state: BootstrapState,
): void {
  void (async () => {
    try {
      for (;;) {
        const next = await lines.next();
        if (next.done) break;
        const exit = new RegExp(
          `^STEP44_WORKLOAD_EXIT,${nonce},(null|-?\\d+),(null|[A-Z0-9]+)$`,
          "u",
        ).exec(next.value);
        if (exit !== null) {
          state.workloadExited = true;
          state.workloadExitCode = exit[1] === "null" ? null : Number(exit[1]);
          state.workloadExitSignal = exit[2] === "null" ? null : (exit[2] as NodeJS.Signals);
          continue;
        }
        const failure = new RegExp(`^STEP44_WORKLOAD_ERROR,${nonce},SPAWN_ERROR$`, "u").exec(
          next.value,
        );
        if (failure !== null) {
          state.workloadError = "SPAWN_ERROR";
          continue;
        }
        state.healthy = false;
      }
      if (!state.stopping) state.healthy = false;
    } catch {
      state.healthy = false;
    } finally {
      lineReader.close();
    }
  })();
}

class OwnedProcessTree implements RealBuildPrefix50Step44OwnedProcessTree {
  public readonly root: ChildProcess;
  public readonly rootPid: number;
  public readonly workloadPid: number;
  public readonly containment: "windows-job" | "posix-process-group";
  public readonly activeProcessCountAtAssignment: number;
  public readonly bootstrapLaunchAttempts = 1 as const;
  public readonly bootstrapLaunchResults = 1 as const;
  public readonly workloadLaunchAttempts = 1 as const;
  public readonly workloadLaunchResults = 1 as const;
  public activeProcessCountBeforeStop: number | null = null;
  public activeProcessCountAfterStop: number | null = null;
  private readonly state: BootstrapState;
  private readonly windowsJob: RealBuildPrefix50Step44WindowsJobOwner | null;
  private stopped = false;
  private stopAttempt: Promise<boolean> | null = null;

  public constructor(input: {
    root: ChildProcess;
    rootPid: number;
    workloadPid: number;
    state: BootstrapState;
    windowsJob: RealBuildPrefix50Step44WindowsJobOwner | null;
  }) {
    this.root = input.root;
    this.rootPid = input.rootPid;
    this.workloadPid = input.workloadPid;
    this.state = input.state;
    this.windowsJob = input.windowsJob;
    this.containment = input.windowsJob === null ? "posix-process-group" : "windows-job";
    this.activeProcessCountAtAssignment = input.windowsJob?.activeProcessCountAtAssignment ?? 1;
  }

  public get workloadExited(): boolean {
    return this.state.workloadExited;
  }

  public get workloadError(): string | null {
    return this.state.workloadError;
  }

  public async stop(): Promise<boolean> {
    if (this.stopped) return false;
    if (this.stopAttempt !== null) return this.stopAttempt;
    const attempt = this.stopOnce();
    this.stopAttempt = attempt;
    try {
      const success = await attempt;
      if (success) this.stopped = true;
      return success;
    } finally {
      if (!this.stopped) this.state.stopping = false;
      this.stopAttempt = null;
    }
  }

  private async stopOnce(): Promise<boolean> {
    this.state.stopping = true;
    if (this.windowsJob !== null) {
      let quiescence: RealBuildPrefix50Step44WindowsJobQuiescence;
      try {
        quiescence = await this.windowsJob.stop();
      } catch {
        return false;
      }
      this.activeProcessCountBeforeStop = quiescence.activeProcessCountBeforeStop;
      this.activeProcessCountAfterStop = quiescence.activeProcessCountAfterStop;
      return (
        (await waitForOwnedRootAndWorkloadExit({
          root: this.root,
          workloadPid: this.workloadPid,
          state: this.state,
        })) && this.state.healthy
      );
    }
    this.activeProcessCountBeforeStop = 1;
    try {
      process.kill(-this.rootPid, "SIGKILL");
    } catch (error) {
      if (!(error instanceof Error && "code" in error && error.code === "ESRCH")) return false;
    }
    if (!(await waitForExit(this.root, STOP_TIMEOUT_MS))) return false;
    const deadline = Date.now() + STOP_TIMEOUT_MS;
    while (Date.now() < deadline) {
      try {
        process.kill(-this.rootPid, 0);
      } catch (error) {
        if (error instanceof Error && "code" in error && error.code === "ESRCH") {
          this.activeProcessCountAfterStop = 0;
          return this.state.healthy;
        }
        return false;
      }
      await new Promise((resolveWait) => setTimeout(resolveWait, 20));
    }
    return false;
  }
}

async function abortStart(
  root: ChildProcess,
  rootPid: number,
  windowsJob: RealBuildPrefix50Step44WindowsJobOwner | null,
): Promise<void> {
  if (windowsJob !== null) await windowsJob.stop().catch(() => undefined);
  else if (process.platform === "win32") root.kill("SIGKILL");
  else
    try {
      process.kill(-rootPid, "SIGKILL");
    } catch {
      root.kill("SIGKILL");
    }
  await waitForExit(root, STOP_TIMEOUT_MS);
}

async function spawnRealBuildPrefix50Step44OwnedProcessInternal(
  input: RealBuildPrefix50Step44OwnedProcessSpawnInput,
  windowsJobTest?: Readonly<{ stopMode: "hang"; stopTimeoutMs: number }>,
): Promise<RealBuildPrefix50Step44OwnedProcessTree> {
  const nonce = randomBytes(32).toString("hex");
  const encodedJob = encodeRealBuildPrefix50Step44OwnedProcessJob(input.job);
  const initialIntegrity = verifyRealBuildPrefix50Step44OwnedProcessIntegrity(input.job);
  const scrubbedEnvironment = scrubRealBuildPrefix50Step44OwnedProcessEnvironment(process.env);
  const bootstrapLaunch = createRealBuildPrefix50Step44SingleLaunch(() =>
    spawn(process.execPath, ["--experimental-strip-types", bootstrapPath, nonce, encodedJob], {
      cwd: repositoryRoot,
      env: scrubbedEnvironment,
      windowsHide: true,
      detached: process.platform !== "win32",
      stdio: ["pipe", input.stdout ?? "ignore", input.stderr ?? "ignore", "pipe"],
    }),
  );
  const root = bootstrapLaunch.invoke(undefined);
  const bootstrapEvidence = bootstrapLaunch.evidence();
  if (bootstrapEvidence.attempts !== 1 || bootstrapEvidence.results !== 1) {
    root.kill("SIGKILL");
    throw new Error("Step-44 owned parent did not produce one bootstrap launch result.");
  }
  const rootPid = root.pid;
  const statusStream = root.stdio[3];
  if (
    rootPid === undefined ||
    statusStream === undefined ||
    statusStream === null ||
    !("read" in statusStream)
  ) {
    root.kill("SIGKILL");
    throw new Error("Step-44 owned bootstrap did not expose a PID and status pipe.");
  }
  const lineReader = createInterface({ input: statusStream as Readable, crlfDelay: Infinity });
  const lines = lineReader[Symbol.asyncIterator]();
  let windowsJob: RealBuildPrefix50Step44WindowsJobOwner | null = null;
  try {
    const ready = await nextBootstrapLine(lines, "its inert-ready evidence");
    if (ready !== `STEP44_BOOTSTRAP_READY,${nonce},${String(rootPid)}`)
      throw new Error(`Step-44 owned bootstrap returned invalid inert-ready evidence ${ready}.`);
    assertRealBuildPrefix50Step44SameOwnedProcessIntegrity(
      initialIntegrity,
      verifyRealBuildPrefix50Step44OwnedProcessIntegrity(input.job),
    );
    if (process.platform === "win32") {
      const expectedCreationIdentity =
        await queryRealBuildPrefix50Step44WindowsCreationIdentity(rootPid);
      windowsJob = await startRealBuildPrefix50Step44WindowsJobOwner({
        processId: rootPid,
        expectedCreationIdentity,
        nonce,
        ...(windowsJobTest === undefined
          ? {}
          : {
              testOnlyStopMode: windowsJobTest.stopMode,
              testOnlyStopTimeoutMs: windowsJobTest.stopTimeoutMs,
            }),
      });
    }
    root.stdin?.write(`GO,${nonce}\n`);
    const attempt = await nextBootstrapLine(lines, "its single workload attempt evidence");
    if (attempt !== `STEP44_WORKLOAD_ATTEMPT,${nonce},1`)
      throw new Error("Step-44 owned bootstrap did not report exactly one workload attempt.");
    const started = await nextBootstrapLine(lines, "its contained-workload evidence");
    const match = new RegExp(`^STEP44_WORKLOAD_STARTED,${nonce},(\\d+),1,1$`, "u").exec(started);
    const workloadPid = Number(match?.[1]);
    if (match === null || !Number.isSafeInteger(workloadPid) || workloadPid <= 4)
      throw new Error(`Step-44 owned bootstrap returned invalid workload evidence ${started}.`);
    assertRealBuildPrefix50Step44SameOwnedProcessIntegrity(
      initialIntegrity,
      verifyRealBuildPrefix50Step44OwnedProcessIntegrity(input.job),
    );
    const state: BootstrapState = {
      healthy: true,
      stopping: false,
      workloadExited: false,
      workloadExitCode: null,
      workloadExitSignal: null,
      workloadError: null,
    };
    consumeBootstrapStatus(lines, lineReader, nonce, state);
    return new OwnedProcessTree({ root, rootPid, workloadPid, state, windowsJob });
  } catch (error) {
    lineReader.close();
    await abortStart(root, rootPid, windowsJob);
    throw error;
  }
}

export async function spawnRealBuildPrefix50Step44OwnedProcess(
  input: RealBuildPrefix50Step44OwnedProcessSpawnInput,
): Promise<RealBuildPrefix50Step44OwnedProcessTree> {
  return spawnRealBuildPrefix50Step44OwnedProcessInternal(input);
}

export async function stopRealBuildPrefix50Step44OwnedProcessTree(
  tree: RealBuildPrefix50Step44OwnedProcessTree | null,
): Promise<boolean> {
  return tree === null ? true : tree.stop();
}

export const __testOnly = Object.freeze({
  queryWindowsCreationIdentity: queryRealBuildPrefix50Step44WindowsCreationIdentity,
  startWindowsJobOwner: startRealBuildPrefix50Step44WindowsJobOwner,
  spawnWithHungWindowsJobOwner: (input: RealBuildPrefix50Step44OwnedProcessSpawnInput) => {
    if (process.env.NODE_ENV !== "test")
      throw new TypeError("Step-44 hung Windows Job Object owner injection is test-only.");
    if (process.platform !== "win32")
      throw new TypeError("Step-44 hung Windows Job Object owner injection requires Windows.");
    return spawnRealBuildPrefix50Step44OwnedProcessInternal(input, {
      stopMode: "hang",
      stopTimeoutMs: 100,
    });
  },
});
