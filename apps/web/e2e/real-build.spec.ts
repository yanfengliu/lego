import { test } from "@playwright/test";

import { executeAndPublishRealBuildPlan } from "./real-build-run-execution";
import { prepareRealBuildInputs } from "./real-build-run-input-preparation";
import { prepareRealBuildPanelPlan } from "./real-build-run-panel-plan";
import { hasSampleBooklet } from "./sample-booklet";
import { skipWithoutRunEvidence } from "./run-evidence-gate";

const REAL_BUILD_REQUIRED = process.env.LEGO_REAL_BUILD_REQUIRED === "1";

test("rebuilds the real booklet from its own printed steps", async ({ page, browserName }) => {
  test.setTimeout(3_600_000);
  test.skip(
    !REAL_BUILD_REQUIRED,
    "set LEGO_REAL_BUILD_REQUIRED=1 to execute the retained real-booklet probe",
  );
  skipWithoutRunEvidence(
    test,
    "reads the sample booklet to rebuild it from its own printed steps",
    { onlyIf: hasSampleBooklet },
  );

  const inputs = await prepareRealBuildInputs();
  const prepared = await prepareRealBuildPanelPlan(inputs);
  await executeAndPublishRealBuildPlan({ page, browserName, prepared });
});
