import { describe, expect, it } from "vitest";

import { validateRealBuildSourceParityEnvironment } from "./real-build-observation-source-parity-environment";
import { REAL_BUILD_SOURCE_PARITY_MAXIMUM_CANONICAL_BROWSER_RESULT_BYTES } from "./real-build-observation-source-parity-contract";
import {
  createRealBuildSourceParityTestFixture,
  createRealBuildSourceParityTestProvenance,
  SOURCE_PARITY_TEST_REPO_ROOT,
} from "./real-build-observation-source-parity-test-fixture";

function fixture(): {
  readonly environment: Record<string, unknown>;
  readonly snapshot: ReturnType<typeof createRealBuildSourceParityTestFixture>["sourceSnapshot"];
} {
  const probe = createRealBuildSourceParityTestFixture(SOURCE_PARITY_TEST_REPO_ROOT);
  const role = createRealBuildSourceParityTestProvenance(SOURCE_PARITY_TEST_REPO_ROOT).find(
    ({ role }) => role === "execution-environment",
  )!;
  return {
    environment: JSON.parse(Buffer.from(role.bytes).toString("utf8")) as Record<string, unknown>,
    snapshot: probe.sourceSnapshot,
  };
}

const BASE = fixture();
const environmentFixture = (): Record<string, unknown> => structuredClone(BASE.environment);

function validate(environment: Record<string, unknown>, snapshot = BASE.snapshot): void {
  validateRealBuildSourceParityEnvironment({
    environment,
    snapshot,
    repoRoot: SOURCE_PARITY_TEST_REPO_ROOT,
    expectedNode: process.version,
    expectedPlatform: process.platform,
    expectedArch: process.arch,
    expectedVersions: process.versions,
  });
}

describe("source-parity execution environment", () => {
  it("reproduces the exact verifier-side Node runtime and closed browser engine", () => {
    expect(() => validate(environmentFixture())).not.toThrow();
  });

  it.each([
    [
      "node",
      (environment: Record<string, unknown>) => (environment.node = "v0.0.0"),
      /Execution environment node was "v0\.0\.0"; expected exact runtime value/,
    ],
    [
      "versions key set",
      (environment: Record<string, unknown>) =>
        ((environment.versions as Record<string, unknown>).forged = "1"),
      /Execution environment versions must contain exactly/,
    ],
    [
      "versions value",
      (environment: Record<string, unknown>) =>
        ((environment.versions as Record<string, unknown>).node = "forged"),
      /versions\.node was "forged"; expected current verifier runtime value/,
    ],
    [
      "browser name",
      (environment: Record<string, unknown>) =>
        ((environment.browser as Record<string, unknown>).name = "firefox"),
      /Execution browser name was "firefox"; expected exact parity engine "chromium"/,
    ],
    [
      "browser version",
      (environment: Record<string, unknown>) =>
        ((environment.browser as Record<string, unknown>).version = "bad\nversion"),
      /Execution browser version.*closed version string/,
    ],
    [
      "playwright binding",
      (environment: Record<string, unknown>) => (environment.playwright = "opaque package"),
      /Execution environment playwright was "opaque package"; expected/,
    ],
  ])("rejects malformed %s with a leaf-specific error", (_label, mutate, pattern) => {
    const environment = environmentFixture();
    mutate(environment);
    expect(() => validate(environment)).toThrow(pattern);
  });

  it("accepts the shared canonical browser-result byte ceiling and rejects one byte above it", () => {
    const environment = environmentFixture();
    environment.browserResultBytes =
      REAL_BUILD_SOURCE_PARITY_MAXIMUM_CANONICAL_BROWSER_RESULT_BYTES;
    const snapshot = {
      ...BASE.snapshot,
      browserResultBytes: REAL_BUILD_SOURCE_PARITY_MAXIMUM_CANONICAL_BROWSER_RESULT_BYTES,
    };
    expect(() => validate(environment, snapshot)).not.toThrow();
    environment.browserResultBytes =
      REAL_BUILD_SOURCE_PARITY_MAXIMUM_CANONICAL_BROWSER_RESULT_BYTES + 1;
    expect(() => validate(environment, snapshot)).toThrow(
      new RegExp(
        `browserResultBytes must be an integer from 1 through ${REAL_BUILD_SOURCE_PARITY_MAXIMUM_CANONICAL_BROWSER_RESULT_BYTES}`,
      ),
    );
  });
});
