import { beforeAll, describe, expect, it } from "vitest";

import { inspectRealBuildBrowserOutputV4 } from "../e2e/real-build-browser-output-v4-reader";
import { realBuildBrowserOutputV4ClosureAbsentTupleFixture } from "./real-build-browser-output-v4-reader-terminal.fixture";

let fixture: ReturnType<typeof realBuildBrowserOutputV4ClosureAbsentTupleFixture>;

beforeAll(() => {
  fixture = realBuildBrowserOutputV4ClosureAbsentTupleFixture();
});

describe("browser-output /4 terminal branch report binding", () => {
  it("accepts only the deterministic closure-absent failure projection", () => {
    const inspected = inspectRealBuildBrowserOutputV4(fixture.tuple);
    expect(inspected).toMatchObject({
      status: "failed",
      retainedReports: 1,
      completedSteps: 0,
      throughStepNumber: 0,
      branchSteps: 1,
    });
    expect(fixture.projection.failure.inputKey).toMatch(
      /^browser-output-v4-terminal:sha256:[0-9a-f]{64}$/u,
    );
  });

  it("rejects a self-consistent outer/report failure with a drifted terminal identity", () => {
    const output = fixture.tuple.browserOutput;
    const report = output.reports[0]!;
    const failure = {
      ...report.outcome.failure,
      inputKey: `browser-output-v4-terminal:sha256:${"f".repeat(64)}`,
    };
    const drifted = {
      ...fixture.tuple,
      browserOutput: {
        ...output,
        failure,
        reports: [{ ...report, outcome: { ...report.outcome, failure } }],
      },
    };
    expect(() => inspectRealBuildBrowserOutputV4(drifted)).toThrow(
      /exact evidence-bound failure projection/iu,
    );
  });
});
