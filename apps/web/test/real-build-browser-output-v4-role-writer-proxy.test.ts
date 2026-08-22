import { describe, expect, it } from "vitest";

import {
  createRealBuildBrowserBranchRoleWriterObservedStepInput,
  createRealBuildBrowserBranchRoleWriterRequest,
  createRealBuildBrowserBranchRoleWriterResult,
  createRealBuildBrowserBranchRoleWriterStepInput,
  readRealBuildBrowserBranchRoleWriterBytes,
} from "../e2e/real-build-browser-output-v4-role-writer";
import { inspectRealBuildBrowserBranchEvidenceV1 } from "../e2e/real-build-browser-output-v4-role";
import { inspectRealBuildPreparedObservationPolicy } from "../e2e/real-build-prepared-step-authority";
import { rebindObservationClosureForLineage } from "./real-build-browser-output-v4-semantic.fixture";
import { realBuildBrowserOutputV4SemanticTwoStepFixture } from "./real-build-browser-output-v4-semantic-two-step.fixture";

describe("browser-output /4 branch-role writer nested input", () => {
  it("brands positional browser requests and rejects wrapped steps and requests without traps", () => {
    const fixture = realBuildBrowserOutputV4SemanticTwoStepFixture();
    const policyInspection = inspectRealBuildPreparedObservationPolicy(
      fixture.preparedRunInputBytes,
    );
    const first = fixture.steps[0]!;
    const closure = rebindObservationClosureForLineage(
      fixture.preparedRunInputBytes,
      first.lineage,
      first.lineageBytes,
    );
    const observed = createRealBuildBrowserBranchRoleWriterObservedStepInput(
      first.batchResult,
      closure.closureBytes,
      closure.roleBytes,
      policyInspection,
    );
    const second = createRealBuildBrowserBranchRoleWriterStepInput(fixture.steps[1]!.batchResult);
    const request = createRealBuildBrowserBranchRoleWriterRequest(observed, second);
    const result = createRealBuildBrowserBranchRoleWriterResult(request);
    const bytes = readRealBuildBrowserBranchRoleWriterBytes(result);
    expect(result.evidence.steps.map(({ stepNumber }) => stepNumber)).toEqual([1, 2]);
    expect(bytes.compiledBranchRole.length).toBeGreaterThan(0);
    expect(bytes.observationRole.length).toBeGreaterThan(0);

    let traps = 0;
    const trap = {
      getOwnPropertyDescriptor() {
        traps += 1;
        throw new Error("branded wrappers must remain inert");
      },
    };
    expect(() => createRealBuildBrowserBranchRoleWriterRequest(new Proxy(observed, trap))).toThrow(
      /exact result of a positional step-input creator/iu,
    );
    expect(() => createRealBuildBrowserBranchRoleWriterResult(new Proxy(request, trap))).toThrow(
      /could not be inspected safely|requires the exact result/iu,
    );
    expect(traps).toBe(0);
  });

  it("does not snapshot branded observation bytes before aggregate request preflight", () => {
    const fixture = realBuildBrowserOutputV4SemanticTwoStepFixture();
    const policyInspection = inspectRealBuildPreparedObservationPolicy(
      fixture.preparedRunInputBytes,
    );
    const first = fixture.steps[0]!;
    const closure = rebindObservationClosureForLineage(
      fixture.preparedRunInputBytes,
      first.lineage,
      first.lineageBytes,
    );
    if (closure.roleBytes === null) throw new Error("Fixture must retain an observation role.");
    const closureBytes = new Uint8Array(closure.closureBytes);
    const roleBytes = new Uint8Array(closure.roleBytes);
    const observed = createRealBuildBrowserBranchRoleWriterObservedStepInput(
      first.batchResult,
      closureBytes,
      roleBytes,
      policyInspection,
    );

    structuredClone([closureBytes.buffer, roleBytes.buffer], {
      transfer: [closureBytes.buffer, roleBytes.buffer],
    });

    expect(() => createRealBuildBrowserBranchRoleWriterRequest(observed, observed)).toThrow(
      /strictly increasing/iu,
    );
    const request = createRealBuildBrowserBranchRoleWriterRequest(observed);
    expect(() => createRealBuildBrowserBranchRoleWriterResult(request)).toThrow(
      /changed|detached|genuine Uint8Array/iu,
    );
  });

  it("rejects an observation Proxy before its descriptor trap can poison array control flow", () => {
    const fixture = realBuildBrowserOutputV4SemanticTwoStepFixture();
    const step = fixture.steps[0]!;
    const policyInspection = inspectRealBuildPreparedObservationPolicy(
      fixture.preparedRunInputBytes,
    );
    const closure = rebindObservationClosureForLineage(
      fixture.preparedRunInputBytes,
      step.lineage,
      step.lineageBytes,
    );
    const input = {
      batchResult: step.batchResult,
      observation: {
        closureBytes: closure.closureBytes,
        roleBytes: closure.roleBytes,
        policyInspection,
      },
    };
    const originalPush = Array.prototype.push;
    let traps = 0;
    const observation = new Proxy(input.observation, {
      getOwnPropertyDescriptor(target, property) {
        traps += 1;
        Array.prototype.push = () => 0;
        return Reflect.getOwnPropertyDescriptor(target, property);
      },
    });
    try {
      expect(() =>
        createRealBuildBrowserBranchRoleWriterResult([{ ...input, observation }]),
      ).toThrow(/observation may not be a Proxy/iu);
      expect(traps).toBe(0);
      expect(Array.prototype.push).toBe(originalPush);

      const result = createRealBuildBrowserBranchRoleWriterResult([input]);
      const first = readRealBuildBrowserBranchRoleWriterBytes(result);
      first.compiledBranchRole.fill(0);
      const second = readRealBuildBrowserBranchRoleWriterBytes(result);
      expect(second.compiledBranchRole).not.toEqual(first.compiledBranchRole);
      expect(
        inspectRealBuildBrowserBranchEvidenceV1(
          second.branchEvidence,
          second.compiledBranchRole,
          second.observationRole,
        ),
      ).toEqual(result.evidence);
    } finally {
      Array.prototype.push = originalPush;
    }
  });
});
