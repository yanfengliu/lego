import { describe, expect, it } from "vitest";

import {
  createRealBuildRunContract,
  parseRealBuildRunContract,
  REAL_BUILD_IDENTIFICATION_ROLE_BY_DIGEST,
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
      {
        path: "apps/web/e2e/real-build-finalize.ts",
        digest: REAL_BUILD_TEST_DIGEST,
        bytes: 1,
      },
      { path: "inputs/booklet.pdf", digest: REAL_BUILD_TEST_DIGEST, bytes: 1 },
    ];
    const contract = createRealBuildRunContract({
      inputDigests: options.inputDigests,
      identificationClosure: {
        source: "deterministic",
        features: REAL_BUILD_TEST_DIGEST,
        match: REAL_BUILD_TEST_DIGEST,
        distances: REAL_BUILD_TEST_DIGEST,
        elements: REAL_BUILD_TEST_DIGEST,
        cards: null,
        cardImages: null,
        answers: null,
        pairJudged: REAL_BUILD_TEST_DIGEST,
      },
      panels: options.panels,
      budgets: realBuildRunBudgets(options),
      thresholds: realBuildRunThresholds(options),
      codeSnapshots: Object.fromEntries(sourceFiles.map(({ path, digest }) => [path, digest])),
    });
    const roleDigests = Object.fromEntries(
      [
        ...Object.values(REAL_BUILD_INPUT_ROLE_BY_DIGEST),
        REAL_BUILD_IDENTIFICATION_ROLE_BY_DIGEST.features,
        REAL_BUILD_IDENTIFICATION_ROLE_BY_DIGEST.match,
        REAL_BUILD_IDENTIFICATION_ROLE_BY_DIGEST.distances,
        REAL_BUILD_IDENTIFICATION_ROLE_BY_DIGEST.elements,
        REAL_BUILD_IDENTIFICATION_ROLE_BY_DIGEST.pairJudged,
      ].map((role) => [role, REAL_BUILD_TEST_DIGEST]),
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
      verify(
        options,
        {
          ...roleDigests,
          [REAL_BUILD_IDENTIFICATION_ROLE_BY_DIGEST.cards]: REAL_BUILD_TEST_DIGEST,
        },
        sourceFiles,
      ),
    ).toThrow(/Deterministic run contract must omit/u);
    expect(() =>
      verify(options, roleDigests, [
        { ...sourceFiles[0]!, digest: DIFFERENT_DIGEST },
        ...sourceFiles.slice(1),
      ]),
    ).toThrow(/do not exactly reproduce/u);
    expect(() => verify(options, roleDigests, sourceFiles.slice(0, 1))).toThrow(
      /inputs\/booklet\.pdf/u,
    );
    const packageSource = {
      path: "packages/demo/src/index.ts",
      digest: REAL_BUILD_TEST_DIGEST,
      bytes: 1,
    };
    expect(() => verify(options, roleDigests, [...sourceFiles, packageSource])).toThrow(
      /workspace\/alias counterpart/u,
    );

    const encoded = new TextEncoder().encode(JSON.stringify(contract));
    expect(parseRealBuildRunContract(encoded)).toEqual(contract);
    const tampered = new TextEncoder().encode(
      JSON.stringify({ ...contract, normalizedPanelsDigest: DIFFERENT_DIGEST }),
    );
    expect(() => parseRealBuildRunContract(tampered)).toThrow(/content digest/u);
  });
});
