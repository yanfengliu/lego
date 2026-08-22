import { describe, expect, it, vi } from "vitest";

const testLimits = vi.hoisted(() => ({ combinedRoleBytes: 1 }));

vi.mock("../e2e/real-build-browser-output-v4-role-limits", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../e2e/real-build-browser-output-v4-role-limits")>();
  return {
    ...actual,
    MAXIMUM_REAL_BUILD_BROWSER_BRANCH_ROLE_BYTES_TOTAL: testLimits.combinedRoleBytes,
  };
});

vi.mock("../e2e/real-build-atomic-compiled-branch-batch", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../e2e/real-build-atomic-compiled-branch-batch")>();
  return {
    ...actual,
    decodeRealBuildAtomicCompiledBranchEvidenceWire: vi.fn(
      actual.decodeRealBuildAtomicCompiledBranchEvidenceWire,
    ),
  };
});

import { decodeRealBuildAtomicCompiledBranchEvidenceWire } from "../e2e/real-build-atomic-compiled-branch-batch";
import { createRealBuildBrowserBranchRoleWriterResult } from "../e2e/real-build-browser-output-v4-role-writer";
import { realBuildBrowserOutputV4SemanticTwoStepFixture } from "./real-build-browser-output-v4-semantic-two-step.fixture";

describe("browser-output /4 branch-role writer aggregate byte ceiling", () => {
  it("refuses the combined role ceiling before decoding or copying a retained lineage", () => {
    const batchResult = realBuildBrowserOutputV4SemanticTwoStepFixture().step1.batchResult;
    expect(batchResult.evidenceWire.byteLength).toBeGreaterThan(testLimits.combinedRoleBytes);
    const decode = vi.mocked(decodeRealBuildAtomicCompiledBranchEvidenceWire);
    decode.mockClear();
    let result: unknown = null;

    expect(() => {
      result = createRealBuildBrowserBranchRoleWriterResult([{ batchResult, observation: null }]);
    }).toThrow(
      `Browser branch roles exceed the combined ${testLimits.combinedRoleBytes}-byte limit; no role bytes were copied.`,
    );
    expect(decode).not.toHaveBeenCalled();
    expect(result).toBeNull();
  });
});
