import { describe, expect, it } from "vitest";

import {
  inspectRealBuildPreparedObservationPolicyFromRunInput,
  inspectRealBuildPreparedRunInput,
  inspectRealBuildPreparedStepFromRunInput,
} from "../e2e/real-build-prepared-step-authority";
import { preparedSearchOptionsBytes } from "./real-build-prepared-search.fixture";

describe("prepared real-build run input inspection", () => {
  it("detaches one complete parse before later step and policy lookups", () => {
    const supplied = preparedSearchOptionsBytes(2);
    const prepared = inspectRealBuildPreparedRunInput(supplied);
    const expectedDigest = prepared.preparedRunInputDigest;

    supplied.fill(0xff);
    structuredClone(supplied.buffer, { transfer: [supplied.buffer] });

    const step = inspectRealBuildPreparedStepFromRunInput(prepared, 2);
    const policy = inspectRealBuildPreparedObservationPolicyFromRunInput(prepared);
    expect(step.expectedAtomicPieces).toHaveLength(2);
    expect(step.preparedRunInputDigest).toBe(expectedDigest);
    expect(policy.preparedRunInputDigest).toBe(expectedDigest);
    expect(policy.authority).toBe("absent");
    expect(Object.isFrozen(prepared)).toBe(true);
  });

  it("requires the branded parsed-run inspection and performs exact panel lookup", () => {
    const prepared = inspectRealBuildPreparedRunInput(preparedSearchOptionsBytes());
    expect(inspectRealBuildPreparedStepFromRunInput(prepared, 2).stepNumber).toBe(2);
    expect(() => inspectRealBuildPreparedStepFromRunInput({ ...prepared }, 2)).toThrow(
      /exact result of one bounded byte parse/u,
    );
    expect(() => inspectRealBuildPreparedObservationPolicyFromRunInput({ ...prepared })).toThrow(
      /exact result of one bounded byte parse/u,
    );
    expect(() => inspectRealBuildPreparedStepFromRunInput(prepared, 359)).toThrow(
      /beyond requested lastStep 358/u,
    );
  });

  it("keeps invalid step-number refusal ahead of prepared-byte inspection", async () => {
    const authority = await import("../e2e/real-build-prepared-step-authority");
    expect(() => authority.inspectRealBuildPreparedStepInput({}, 0)).toThrow(
      /step number must be a safe integer/u,
    );
  });
});
