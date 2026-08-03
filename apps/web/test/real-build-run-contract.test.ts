import { describe, expect, it } from "vitest";

import {
  createRealBuildRunContract,
  parseRealBuildRunContract,
  REAL_BUILD_INPUT_ROLE_BY_DIGEST,
  realBuildRunBudgets,
  realBuildRunThresholds,
  verifyRealBuildRunContract,
} from "../e2e/real-build-run-contract";
import { REAL_BUILD_TEST_DIGEST, completeRealBuildTestOptions } from "./real-build-test-options";

const DIFFERENT_DIGEST = `sha256:${"b".repeat(64)}`;

describe("real-build run contract", () => {
  it("binds prepared options to every raw role and exact source/action bytes", () => {
    const options = completeRealBuildTestOptions(1);
    const sourceFiles = [
      { path: "apps/web/e2e/real-build-finalize.ts", digest: REAL_BUILD_TEST_DIGEST },
    ];
    const contract = createRealBuildRunContract({
      inputDigests: options.inputDigests,
      panels: options.panels,
      budgets: realBuildRunBudgets(options),
      thresholds: realBuildRunThresholds(options),
      codeSnapshots: Object.fromEntries(sourceFiles.map(({ path, digest }) => [path, digest])),
    });
    const roleDigests = Object.fromEntries(
      Object.values(REAL_BUILD_INPUT_ROLE_BY_DIGEST).map((role) => [role, REAL_BUILD_TEST_DIGEST]),
    );
    const verify = (
      candidateOptions = options,
      candidateRoles = roleDigests,
      candidateSources = sourceFiles,
    ) =>
      verifyRealBuildRunContract({
        contract,
        options: candidateOptions,
        roleDigests: candidateRoles,
        sourceFiles: candidateSources,
      });

    expect(verify).not.toThrow();
    expect(() =>
      verify(
        {
          ...options,
          panels: options.panels.map((panel, index) =>
            index === 0
              ? {
                  ...panel,
                  action: { ...panel.action, evidenceDigest: DIFFERENT_DIGEST },
                }
              : panel,
          ),
        },
        roleDigests,
        sourceFiles,
      ),
    ).toThrow(/do not exactly reproduce/u);
    expect(() => verify(options, { ...roleDigests, pdf: DIFFERENT_DIGEST }, sourceFiles)).toThrow(
      /raw role pdf/u,
    );
    expect(() =>
      verify(options, roleDigests, [{ ...sourceFiles[0]!, digest: DIFFERENT_DIGEST }]),
    ).toThrow(/do not exactly reproduce/u);

    const encoded = new TextEncoder().encode(JSON.stringify(contract));
    expect(parseRealBuildRunContract(encoded)).toEqual(contract);
    const tampered = new TextEncoder().encode(
      JSON.stringify({ ...contract, normalizedPanelsDigest: DIFFERENT_DIGEST }),
    );
    expect(() => parseRealBuildRunContract(tampered)).toThrow(/content digest/u);
  });
});
