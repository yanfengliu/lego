import { describe, expect, it } from "vitest";

import {
  inspectRealBuildPreparedObservationPolicy,
  inspectRealBuildPreparedStepInput,
  requireRealBuildPreparedObservationPolicyInspection,
} from "../e2e/real-build-prepared-step-authority";
import { snapshotRealBuildRunInput } from "../e2e/real-build-run-input-snapshot";
import { deriveRealBuildProvisionalRunPreparationFacts } from "../e2e/real-build-run-provisional-preparation";
import {
  preparedSearchOptions,
  preparedSearchOptionsBytes,
} from "./real-build-prepared-search.fixture";

function preparedPolicyBytes(
  patch: Partial<{
    minimumDeferredAgreement: number;
    minimumDeferredAgreementMargin: number;
  }>,
): Uint8Array {
  return new TextEncoder().encode(JSON.stringify({ ...preparedSearchOptions(), ...patch }));
}

describe("prepared real-build observation policy", () => {
  it("maps the exact prepared thresholds and shares the prepared-run digest", () => {
    const bytes = preparedSearchOptionsBytes();
    const options = preparedSearchOptions();
    const policy = inspectRealBuildPreparedObservationPolicy(bytes);
    const step = inspectRealBuildPreparedStepInput(bytes, 2);

    expect(policy).toEqual({
      preparedRunInputDigest: step.preparedRunInputDigest,
      minimumScore: options.minimumDeferredAgreement,
      minimumMargin: options.minimumDeferredAgreementMargin,
      authority: "absent",
    });
    expect(policy.minimumScore).toBe(0.85);
    expect(policy.minimumMargin).toBe(0.02);
    expect(Object.isFrozen(policy)).toBe(true);
    expect(requireRealBuildPreparedObservationPolicyInspection(policy)).toBe(policy);
  });

  it("matches provisional preparation's canonical prepared-run digest", () => {
    const options = preparedSearchOptions();
    const policy = inspectRealBuildPreparedObservationPolicy(
      new TextEncoder().encode(JSON.stringify(options)),
    );
    const digest = `sha256:${"a".repeat(64)}`;
    const provisional = deriveRealBuildProvisionalRunPreparationFacts(
      snapshotRealBuildRunInput(options).canonical,
      digest,
      digest,
      digest,
      digest,
    );
    expect(policy.preparedRunInputDigest).toBe(provisional.preparedRunInputDigest);
  });

  it("binds valid threshold mutations into both policy values and run digest", () => {
    const first = inspectRealBuildPreparedObservationPolicy(
      preparedPolicyBytes({
        minimumDeferredAgreement: 1,
        minimumDeferredAgreementMargin: 0,
      }),
    );
    const second = inspectRealBuildPreparedObservationPolicy(
      preparedPolicyBytes({
        minimumDeferredAgreement: 0.5,
        minimumDeferredAgreementMargin: 0.5,
      }),
    );
    expect(first).toMatchObject({ minimumScore: 1, minimumMargin: 0 });
    expect(second).toMatchObject({ minimumScore: 0.5, minimumMargin: 0.5 });
    expect(first.preparedRunInputDigest).not.toBe(second.preparedRunInputDigest);
  });

  it("requires the exact WeakSet-branded inspection instead of a structural copy", () => {
    const policy = inspectRealBuildPreparedObservationPolicy(preparedSearchOptionsBytes());

    expect(() => requireRealBuildPreparedObservationPolicyInspection({ ...policy })).toThrow(
      /exact non-authoritative result of bounded run-input inspection/u,
    );
    expect(() =>
      requireRealBuildPreparedObservationPolicyInspection(Object.create(policy) as unknown),
    ).toThrow(/exact non-authoritative result/u);
    expect(() => requireRealBuildPreparedObservationPolicyInspection(null)).toThrow(
      /exact non-authoritative result/u,
    );
  });

  it.each([
    ["zero minimum score", { minimumDeferredAgreement: 0 }],
    ["minimum score above one", { minimumDeferredAgreement: 1 + Number.EPSILON }],
    ["negative minimum margin", { minimumDeferredAgreementMargin: -Number.EPSILON }],
    ["minimum margin above one", { minimumDeferredAgreementMargin: 1 + Number.EPSILON }],
  ] as const)("rejects %s", (_label, patch) => {
    expect(() => inspectRealBuildPreparedObservationPolicy(preparedPolicyBytes(patch))).toThrow();
  });

  it("rejects other typed-array brands before their values can be parsed as JSON", () => {
    const bytes = preparedSearchOptionsBytes();

    expect(() => inspectRealBuildPreparedObservationPolicy(Int8Array.from(bytes))).toThrow(
      /genuine Uint8Array/u,
    );
    expect(() => inspectRealBuildPreparedObservationPolicy(Uint16Array.from(bytes))).toThrow(
      /genuine Uint8Array/u,
    );
  });

  it("rejects shared storage and hostile proxies without consulting proxy traps", () => {
    if (typeof SharedArrayBuffer !== "undefined") {
      const bytes = preparedSearchOptionsBytes();
      const shared = new Uint8Array(new SharedArrayBuffer(bytes.length));
      shared.set(bytes);
      expect(() => inspectRealBuildPreparedObservationPolicy(shared)).toThrow(/shared storage/u);
    }

    let traps = 0;
    const hostile = new Proxy(preparedSearchOptionsBytes(), {
      get() {
        traps += 1;
        throw new Error("must remain inert");
      },
      getPrototypeOf() {
        traps += 1;
        throw new Error("must remain inert");
      },
      ownKeys() {
        traps += 1;
        throw new Error("must remain inert");
      },
    });

    expect(() => inspectRealBuildPreparedObservationPolicy(hostile)).toThrow(/genuine Uint8Array/u);
    expect(traps).toBe(0);
  });
});
