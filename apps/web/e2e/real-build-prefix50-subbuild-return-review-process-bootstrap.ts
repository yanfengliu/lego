import { spawn, type ChildProcess, type SpawnOptions } from "node:child_process";
import { createWriteStream } from "node:fs";
import { fileURLToPath } from "node:url";

import {
  decodeRealBuildPrefix50Step44OwnedProcessJob,
  scrubRealBuildPrefix50Step44OwnedProcessEnvironment,
  type RealBuildPrefix50Step44OwnedProcessJob,
} from "./real-build-prefix50-subbuild-return-review-process-jobs.ts";
import {
  assertRealBuildPrefix50Step44SameOwnedProcessIntegrity,
  verifyRealBuildPrefix50Step44OwnedProcessIntegrity,
} from "./real-build-prefix50-subbuild-return-review-process-integrity.ts";
import { materializeRealBuildPrefix50Step44ProcessLaunch } from "./real-build-prefix50-subbuild-return-review-process-launch-table.ts";
import { createRealBuildPrefix50Step44SingleLaunch } from "./real-build-prefix50-subbuild-return-review-process-single-launch.ts";

const repositoryRoot = fileURLToPath(new URL("../../../", import.meta.url));
const [nonce, encodedJob, ...unexpectedArguments] = process.argv.slice(2);

if (nonce === undefined || !/^[a-f0-9]{64}$/u.test(nonce))
  throw new TypeError("Step-44 owned-process bootstrap requires its exact 256-bit nonce.");
if (unexpectedArguments.length !== 0)
  throw new TypeError("Step-44 owned-process bootstrap rejects trailing command arguments.");
const job = decodeRealBuildPrefix50Step44OwnedProcessJob(encodedJob);
const initialIntegrity = verifyRealBuildPrefix50Step44OwnedProcessIntegrity(job);

const status = createWriteStream("", { fd: 3, autoClose: false });
let input = "";

function writeStatus(fields: readonly (string | number)[]): void {
  status.write(`${fields.join(",")}\n`);
}

function spawnJob(selected: RealBuildPrefix50Step44OwnedProcessJob): ChildProcess {
  const stdio = Object.freeze(["ignore", "inherit", "inherit"]) as unknown as SpawnOptions["stdio"];
  const options: Readonly<SpawnOptions> = Object.freeze({
    cwd: repositoryRoot,
    env: scrubRealBuildPrefix50Step44OwnedProcessEnvironment(process.env),
    windowsHide: true,
    stdio,
  });
  const launch = materializeRealBuildPrefix50Step44ProcessLaunch(selected);
  if (launch.testOnly && process.env.NODE_ENV !== "test")
    throw new TypeError("Step-44 containment probe jobs are test-only.");
  return spawn(process.execPath, launch.arguments, options);
}

const workloadLaunch = createRealBuildPrefix50Step44SingleLaunch(spawnJob);

writeStatus(["STEP44_BOOTSTRAP_READY", nonce, process.pid]);
process.stdin.setEncoding("utf8");
const onControlData = (chunk: string): void => {
  input += chunk;
  if (input.length > 256)
    throw new RangeError("Step-44 owned-process bootstrap control input exceeded 256 bytes.");
  const newline = input.indexOf("\n");
  if (newline < 0) return;
  const line = input.slice(0, newline).trimEnd();
  input = input.slice(newline + 1);
  if (line !== `GO,${nonce}` || input.length !== 0)
    throw new TypeError("Step-44 owned-process bootstrap received an invalid GO capability.");
  process.stdin.off("data", onControlData);
  process.stdin.pause();
  writeStatus(["STEP44_WORKLOAD_ATTEMPT", nonce, 1]);
  assertRealBuildPrefix50Step44SameOwnedProcessIntegrity(
    initialIntegrity,
    verifyRealBuildPrefix50Step44OwnedProcessIntegrity(job),
  );
  const workload = workloadLaunch.invoke(job);
  assertRealBuildPrefix50Step44SameOwnedProcessIntegrity(
    initialIntegrity,
    verifyRealBuildPrefix50Step44OwnedProcessIntegrity(job),
  );
  const launchEvidence = workloadLaunch.evidence();
  if (launchEvidence.attempts !== 1 || launchEvidence.results !== 1)
    throw new TypeError("Step-44 owned-process bootstrap did not produce one launch result.");
  workload.once("spawn", () => {
    writeStatus([
      "STEP44_WORKLOAD_STARTED",
      nonce,
      workload.pid ?? 0,
      launchEvidence.attempts,
      launchEvidence.results,
    ]);
  });
  workload.once("error", () => {
    writeStatus(["STEP44_WORKLOAD_ERROR", nonce, "SPAWN_ERROR"]);
  });
  workload.once("exit", (code, signal) => {
    writeStatus(["STEP44_WORKLOAD_EXIT", nonce, code === null ? "null" : code, signal ?? "null"]);
  });
};
process.stdin.on("data", onControlData);
process.stdin.resume();

// The bootstrap is the stable containment identity. It deliberately remains alive
// after its workload exits until its Job Object or POSIX process group is closed.
setInterval(() => undefined, 60_000).unref();
