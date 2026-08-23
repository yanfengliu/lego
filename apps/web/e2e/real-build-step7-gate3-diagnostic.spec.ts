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
import {
  assertStep7Gate3RetainableTerminal,
  retainUnverifiedStep7Gate3HostFailure,
  retainVerifiedStep7Gate3HostRun,
  type Step7Gate3HostFailureStage,
} from "./real-build-step7-gate3-host-retention";
import { verifyStep7Gate3HostRun } from "./real-build-step7-gate3-host-verification";
import { hasSampleBooklet } from "./sample-booklet";

const REQUIRED = process.env.LEGO_GATE3_STEP7_DIAGNOSTIC === "1";
const PREWARM = process.env.LEGO_GATE3_STEP7_PREWARM === "1";
const PARENT_ONLY = process.env.LEGO_GATE3_STEP7_PARENT_ONLY === "1";

test("measures the current additive-migration continuation of all four retained step-6 parents", async ({
  page,
  baseURL,
}) => {
  test.setTimeout(7_200_000);
  test.skip(
    !REQUIRED && !PREWARM && !PARENT_ONLY,
    "set LEGO_GATE3_STEP7_DIAGNOSTIC=1 or LEGO_GATE3_STEP7_PARENT_ONLY=1 for a Gate-3 control",
  );
  test.skip(!hasSampleBooklet && !PREWARM, "no sample booklet");

  let stage: Step7Gate3HostFailureStage = "preparation";
  let prepared: PreparedStep7Gate3HostRun | null = null;
  let execution: ExecutedStep7Gate3HostRun | null = null;
  try {
    const preparedOutcome = await prepareStep7Gate3HostRun({
      page,
      baseURL,
      prewarm: PREWARM,
      parentOnly: PARENT_ONLY,
    });
    if (preparedOutcome.status === "done") return;
    prepared = preparedOutcome;
    stage = "execution";
    execution = await executeStep7Gate3HostRun(prepared);
    stage = "terminal-admission";
    assertStep7Gate3RetainableTerminal(execution.result, prepared.browserInputDigest);
    stage = "verification";
    const verification = verifyStep7Gate3HostRun(prepared, execution);
    stage = "publication";
    retainVerifiedStep7Gate3HostRun(prepared, execution, verification);
  } catch (error) {
    if (REQUIRED && !PREWARM && !PARENT_ONLY) {
      try {
        const retainedFailure = retainUnverifiedStep7Gate3HostFailure({
          stage,
          failure: error,
          prepared,
          execution,
          unverifiedExecution: step7Gate3UnverifiedHostExecution(error),
        });
        console.error(
          `gate3-step7-unverified: ${JSON.stringify({
            fileRelative: retainedFailure.fileRelative,
            digest: retainedFailure.digest,
            bytes: retainedFailure.bytes,
            verification: retainedFailure.envelope.verification,
            completeRun: retainedFailure.envelope.completeRun,
          })}`,
        );
      } catch (retentionError) {
        throw new AggregateError(
          [error, retentionError],
          "Gate-3 diagnostic failed and its unverified raw counterevidence could not be retained.",
          { cause: retentionError },
        );
      }
    }
    throw error;
  }
});
