import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  nextRealBuildPrefix50Step44CalibrationDirectoryHelperLine,
  realBuildPrefix50Step44CalibrationDirectoryProcessTestOnly,
  stopRealBuildPrefix50Step44CalibrationDirectoryHelper,
  waitForRealBuildPrefix50Step44CalibrationDirectoryHelper,
} from "../e2e/real-build-prefix50-step44-calibration-directory-process.ts";

function failedSession() {
  return realBuildPrefix50Step44CalibrationDirectoryProcessTestOnly!.startWithMissingExecutable(
    "e30=",
    resolve("."),
  );
}

describe("page44 calibration native-helper process failure", () => {
  it("rejects line reads when CreateProcess fails", async () => {
    await expect(
      nextRealBuildPrefix50Step44CalibrationDirectoryHelperLine(failedSession()),
    ).rejects.toThrow("could not start system PowerShell");
  });

  it("rejects process waits when CreateProcess fails", async () => {
    await expect(
      waitForRealBuildPrefix50Step44CalibrationDirectoryHelper(failedSession()),
    ).rejects.toThrow("could not start system PowerShell");
  });

  it("rejects process stops when CreateProcess fails", async () => {
    await expect(
      stopRealBuildPrefix50Step44CalibrationDirectoryHelper(failedSession()),
    ).rejects.toThrow("could not start system PowerShell");
  });
});
