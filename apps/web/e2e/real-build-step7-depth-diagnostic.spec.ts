import { test } from "@playwright/test";

import {
  executeStep7Gate3HostRun,
  step7Gate3UnverifiedHostExecution,
  type ExecutedStep7Gate3HostRun,
} from "./real-build-step7-gate3-host-execution";
import {
  prepareStep7Gate3HostRun,
  type PreparedStep7Gate3HostRun,
} from "./real-build-step7-gate3-host-preparation";
import { retainStep7Gate3UnverifiedFailureEnvelope } from "./real-build-step7-gate3-diagnostic-output";
import {
  retainVerifiedStep7DepthHostRun,
  verifyStep7DepthHostRun,
} from "./real-build-step7-depth-diagnostic";
import { hasSampleBooklet } from "./sample-booklet";

const REQUIRED = process.env.LEGO_GATE3_STEP7_DEPTH_DIAGNOSTIC === "1";
const OUTPUT_ROOT =
  process.env.LEGO_GATE3_STEP7_DEPTH_DIAGNOSTIC_OUT ?? "output/gate3-step7-depth-diagnostic";

test("replays all step-7 rows exactly under the fixed physical subject-render ledger", async ({
  page,
  baseURL,
}) => {
  test.setTimeout(7_200_000);
  test.skip(!REQUIRED, "set LEGO_GATE3_STEP7_DEPTH_DIAGNOSTIC=1 for the fixed-8192 proof");
  test.skip(!hasSampleBooklet, "no sample booklet");

  let stage: "preparation" | "execution" | "verification" | "publication" = "preparation";
  let prepared: PreparedStep7Gate3HostRun | null = null;
  let execution: ExecutedStep7Gate3HostRun | null = null;
  try {
    const preparedOutcome = await prepareStep7Gate3HostRun({
      page,
      baseURL,
      prewarm: false,
      parentOnly: false,
    });
    if (preparedOutcome.status === "done") return;
    prepared = preparedOutcome;
    stage = "execution";
    execution = await executeStep7Gate3HostRun(prepared, "depth-composed");
    stage = "verification";
    const verification = verifyStep7DepthHostRun(prepared, execution);
    stage = "publication";
    const retained = retainVerifiedStep7DepthHostRun({
      prepared,
      execution,
      verification,
      outputRoot: OUTPUT_ROOT,
    });
    console.log(
      `gate3-step7-depth-complete: ${JSON.stringify({
        runRelative: retained.runRelative,
        traceDigest: retained.summary.traceDigest,
        subjectRenders: verification.totals.subjectRenders,
        logicalRows: verification.totals.logicalRows,
        fallbackCaptures: verification.totals.fallbackCaptures,
        peakCachePayloadBytes: verification.totals.peakCachePayloadBytes,
      })}`,
    );
  } catch (error) {
    const hostCounterevidence = step7Gate3UnverifiedHostExecution(error);
    const retainedFailure = retainStep7Gate3UnverifiedFailureEnvelope({
      outputRoot: OUTPUT_ROOT,
      stage,
      failure: error,
      counterevidence:
        (hostCounterevidence === null ? null : { ...hostCounterevidence }) ??
        (execution === null
          ? prepared === null
            ? null
            : { browserInputDigest: prepared.browserInputDigest }
          : {
              result: execution.result,
              sourceExecution: execution.sourceExecution,
              servedJavaScript: execution.servedJavaScript,
            }),
    });
    console.error(
      `gate3-step7-depth-unverified: ${JSON.stringify({
        fileRelative: retainedFailure.fileRelative,
        digest: retainedFailure.digest,
        bytes: retainedFailure.bytes,
        stage,
      })}`,
    );
    throw error;
  }
});
