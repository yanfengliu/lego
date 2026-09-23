import { spawn, type ChildProcess } from "node:child_process";
import { once } from "node:events";
import { createInterface, type Interface } from "node:readline";
import { fileURLToPath } from "node:url";

const HELPER_TIMEOUT_MS = 15_000;
const FORCED_HELPER_EXIT_TIMEOUT_MS = 5_000;
const MAXIMUM_HELPER_OUTPUT_BYTES = 16_384;
const helperPath = fileURLToPath(
  new URL("./real-build-prefix50-subbuild-return-review-process-job.ps1", import.meta.url),
);

function helperArguments(argumentsAfterFile: readonly string[]): string[] {
  return [
    "-NoLogo",
    "-NoProfile",
    "-NonInteractive",
    "-ExecutionPolicy",
    "Bypass",
    "-File",
    helperPath,
    ...argumentsAfterFile,
  ];
}

async function waitForExitEvidence(
  child: ChildProcess,
  timeoutMs: number,
): Promise<readonly [number | null, NodeJS.Signals | null] | null> {
  if (child.exitCode !== null || child.signalCode !== null)
    return [child.exitCode, child.signalCode] as const;
  return Promise.race([
    once(child, "exit").then(
      ([code, signal]) => [code as number | null, signal as NodeJS.Signals | null] as const,
    ),
    new Promise<null>((resolveTimeout) => {
      const timer = setTimeout(() => resolveTimeout(null), timeoutMs);
      timer.unref();
    }),
  ]);
}

async function killExactHelperAndWait(child: ChildProcess): Promise<boolean> {
  if (child.exitCode !== null || child.signalCode !== null) return true;
  child.kill("SIGKILL");
  return (await waitForExitEvidence(child, FORCED_HELPER_EXIT_TIMEOUT_MS)) !== null;
}

async function waitForExit(
  child: ChildProcess,
  timeoutMs = HELPER_TIMEOUT_MS,
): Promise<readonly [number | null, NodeJS.Signals | null]> {
  const result = await waitForExitEvidence(child, timeoutMs);
  if (result !== null) return result;
  if (!(await killExactHelperAndWait(child)))
    throw new Error(
      `Step-44 Windows Job Object helper did not exit after exact helper termination within ${FORCED_HELPER_EXIT_TIMEOUT_MS}ms.`,
    );
  throw new Error(`Step-44 Windows Job Object helper did not finish in ${timeoutMs}ms.`);
}

function collectStderr(child: ChildProcess): () => string {
  let stderr = "";
  child.stderr?.setEncoding("utf8");
  child.stderr?.on("data", (chunk: string) => {
    stderr = `${stderr}${chunk}`.slice(-MAXIMUM_HELPER_OUTPUT_BYTES);
  });
  return () => stderr.trim();
}

export async function queryRealBuildPrefix50Step44WindowsCreationIdentity(
  processId: number,
): Promise<string> {
  if (!Number.isSafeInteger(processId) || processId <= 4)
    throw new TypeError("Step-44 creation-identity query requires a safe PID greater than four.");
  const helper = spawn(
    "powershell.exe",
    helperArguments(["-Mode", "Query", "-TargetProcessId", String(processId)]),
    { windowsHide: true, stdio: ["ignore", "pipe", "pipe"] },
  );
  const stderr = collectStderr(helper);
  let output = "";
  helper.stdout?.setEncoding("utf8");
  helper.stdout?.on("data", (chunk: string) => {
    output += chunk;
    if (output.length > MAXIMUM_HELPER_OUTPUT_BYTES) helper.kill("SIGKILL");
  });
  const [code, signal] = await waitForExit(helper);
  const identity = output.trim();
  if (code !== 0 || signal !== null || !/^\d{1,20}$/u.test(identity) || identity === "0")
    throw new Error(
      `Step-44 creation-identity query failed with code ${String(code)}, signal ${String(signal)}, output ${JSON.stringify(identity)}: ${stderr()}.`,
    );
  return identity;
}

async function nextLine(
  lines: AsyncIterator<string>,
  description: string,
  timeoutMs = HELPER_TIMEOUT_MS,
): Promise<string> {
  const next = await Promise.race([
    lines.next(),
    new Promise<never>((_resolve, reject) => {
      const timer = setTimeout(
        () =>
          reject(
            new Error(`Step-44 Windows Job Object helper timed out waiting for ${description}.`),
          ),
        timeoutMs,
      );
      timer.unref();
    }),
  ]);
  if (next.done) throw new Error(`Step-44 Windows Job Object helper exited before ${description}.`);
  if (next.value.length > MAXIMUM_HELPER_OUTPUT_BYTES)
    throw new RangeError("Step-44 Windows Job Object helper output exceeded 16 KiB.");
  return next.value;
}

export interface RealBuildPrefix50Step44WindowsJobQuiescence {
  readonly activeProcessCountBeforeStop: number | null;
  readonly activeProcessCountAfterStop: 0;
  readonly helperExitForced: boolean;
}

export class RealBuildPrefix50Step44WindowsJobOwner {
  public readonly child: ChildProcess;
  public readonly activeProcessCountAtAssignment = 1 as const;
  private readonly nonce: string;
  private readonly lines: AsyncIterator<string>;
  private readonly lineReader: Interface;
  private readonly readStderr: () => string;
  private readonly stopTimeoutMs: number;
  private stopRequested = false;
  private protocolAbandoned = false;
  private closedResult: RealBuildPrefix50Step44WindowsJobQuiescence | null = null;
  private stopAttempt: Promise<RealBuildPrefix50Step44WindowsJobQuiescence> | null = null;

  public constructor(input: {
    child: ChildProcess;
    nonce: string;
    lineReader: Interface;
    lines: AsyncIterator<string>;
    readStderr: () => string;
    stopTimeoutMs: number;
  }) {
    this.child = input.child;
    this.nonce = input.nonce;
    this.lineReader = input.lineReader;
    this.lines = input.lines;
    this.readStderr = input.readStderr;
    this.stopTimeoutMs = input.stopTimeoutMs;
  }

  public async stop(): Promise<RealBuildPrefix50Step44WindowsJobQuiescence> {
    if (this.closedResult !== null) return this.closedResult;
    if (this.stopAttempt !== null) return this.stopAttempt;
    const attempt = this.stopOnce();
    this.stopAttempt = attempt;
    try {
      const result = await attempt;
      this.closedResult = result;
      return result;
    } finally {
      this.stopAttempt = null;
    }
  }

  private async stopOnce(): Promise<RealBuildPrefix50Step44WindowsJobQuiescence> {
    if (this.protocolAbandoned) return this.forceHelperExit();
    if (!this.stopRequested) {
      this.stopRequested = true;
      this.child.stdin?.end(`STOP,${this.nonce}\n`);
    }
    try {
      const line = await nextLine(this.lines, "kernel quiescence evidence", this.stopTimeoutMs);
      const match = new RegExp(`^STEP44_JOB_QUIESCENT,${this.nonce},(\\d+),0$`, "u").exec(line);
      const activeProcessCountBeforeStop = Number(match?.[1]);
      if (
        match === null ||
        !Number.isSafeInteger(activeProcessCountBeforeStop) ||
        activeProcessCountBeforeStop < 0
      )
        throw new Error(`Step-44 Windows Job Object returned invalid quiescence evidence ${line}.`);
      const exit = await waitForExitEvidence(this.child, this.stopTimeoutMs);
      if (exit === null)
        throw new Error(
          `Step-44 Windows Job Object owner remained alive after quiescence evidence for ${this.stopTimeoutMs}ms.`,
        );
      const [code, signal] = exit;
      if (code !== 0 || signal !== null)
        throw new Error(
          `Step-44 Windows Job Object owner exited with code ${String(code)}, signal ${String(signal)}: ${this.readStderr()}.`,
        );
      this.lineReader.close();
      return {
        activeProcessCountBeforeStop,
        activeProcessCountAfterStop: 0,
        helperExitForced: false,
      };
    } catch (error) {
      this.protocolAbandoned = true;
      try {
        return await this.forceHelperExit();
      } catch (forceError) {
        throw new AggregateError(
          [error, forceError],
          `Step-44 Windows Job Object owner returned no quiescence evidence and exact helper termination did not prove closure: ${this.readStderr()}.`,
          { cause: forceError },
        );
      }
    }
  }

  private async forceHelperExit(): Promise<RealBuildPrefix50Step44WindowsJobQuiescence> {
    if (!(await killExactHelperAndWait(this.child)))
      throw new Error(
        "Step-44 Windows Job Object exact helper remained alive; owner stop may be retried.",
      );
    this.lineReader.close();
    return {
      activeProcessCountBeforeStop: null,
      activeProcessCountAfterStop: 0,
      helperExitForced: true,
    };
  }
}

export async function startRealBuildPrefix50Step44WindowsJobOwner(input: {
  readonly processId: number;
  readonly expectedCreationIdentity: string;
  readonly nonce: string;
  readonly testOnlyStopMode?: "hang";
  readonly testOnlyStopTimeoutMs?: number;
}): Promise<RealBuildPrefix50Step44WindowsJobOwner> {
  if (
    !Number.isSafeInteger(input.processId) ||
    input.processId <= 4 ||
    !/^\d{1,20}$/u.test(input.expectedCreationIdentity) ||
    input.expectedCreationIdentity === "0" ||
    !/^[a-f0-9]{64}$/u.test(input.nonce)
  )
    throw new TypeError(
      "Step-44 Windows Job Object assignment requires a safe PID, creation identity, and nonce.",
    );
  if (
    (input.testOnlyStopMode !== undefined || input.testOnlyStopTimeoutMs !== undefined) &&
    process.env.NODE_ENV !== "test"
  )
    throw new TypeError("Step-44 Windows Job Object stop-failure injection is test-only.");
  const stopTimeoutMs = input.testOnlyStopTimeoutMs ?? HELPER_TIMEOUT_MS;
  if (
    !Number.isSafeInteger(stopTimeoutMs) ||
    stopTimeoutMs < 50 ||
    stopTimeoutMs > HELPER_TIMEOUT_MS
  )
    throw new TypeError("Step-44 Windows Job Object stop timeout must be 50..15000ms.");
  const child = spawn(
    "powershell.exe",
    helperArguments([
      "-Mode",
      "Own",
      "-TargetProcessId",
      String(input.processId),
      "-ExpectedCreationIdentity",
      input.expectedCreationIdentity,
      "-Nonce",
      input.nonce,
      ...(input.testOnlyStopMode === undefined
        ? []
        : ["-TestOnlyStopMode", input.testOnlyStopMode]),
    ]),
    { windowsHide: true, stdio: ["pipe", "pipe", "pipe"] },
  );
  const readStderr = collectStderr(child);
  if (child.stdout === null)
    throw new Error("Step-44 Windows Job Object owner has no status stream.");
  child.stdout.setEncoding("utf8");
  const lineReader = createInterface({ input: child.stdout, crlfDelay: Infinity });
  const lines = lineReader[Symbol.asyncIterator]();
  let line: string;
  try {
    line = await nextLine(lines, "assignment evidence");
  } catch (error) {
    lineReader.close();
    await waitForExit(child).catch(() => undefined);
    throw new Error(`Step-44 Windows Job Object assignment failed: ${readStderr()}.`, {
      cause: error,
    });
  }
  const expected = `STEP44_JOB_READY,${input.nonce},${String(input.processId)},${input.expectedCreationIdentity},1`;
  if (line !== expected) {
    lineReader.close();
    child.stdin?.destroy();
    child.kill("SIGKILL");
    await waitForExit(child).catch(() => undefined);
    throw new Error(`Step-44 Windows Job Object returned invalid assignment evidence ${line}.`);
  }
  return new RealBuildPrefix50Step44WindowsJobOwner({
    child,
    nonce: input.nonce,
    lineReader,
    lines,
    readStderr,
    stopTimeoutMs,
  });
}
