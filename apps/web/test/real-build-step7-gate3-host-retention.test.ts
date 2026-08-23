import { describe, expect, it } from "vitest";

import {
  Step7Gate3HostExecutionError,
  step7Gate3UnverifiedHostExecution,
  type UnverifiedStep7Gate3HostExecution,
} from "../e2e/real-build-step7-gate3-host-execution";
import {
  assertStep7Gate3RetainableTerminal,
  buildStep7Gate3UnverifiedHostFailureCounterevidence,
  type Step7Gate3RetainableTerminalObservation,
} from "../e2e/real-build-step7-gate3-host-retention";

const digest = `sha256:${"1".repeat(64)}`;
const complete = Object.freeze({
  failure: null,
  cleanupFailures: Object.freeze([]),
  fullWorkloadComplete: true,
  parentAttempts: 4,
  narrowingRefused: false,
  candidateRefused: false,
  productionFrontierAdmitted: false,
  documentsPublished: false,
  inputFrozen: true,
  inputMutation: false,
  browserInputDigestBefore: digest,
  browserInputDigestAfter: digest,
  inputDocumentFrozen: true,
  inputDocumentMutation: false,
}) satisfies Step7Gate3RetainableTerminalObservation;

describe("step-7 Gate-3 terminal retention", () => {
  it("accepts the exact complete authority-free terminal before any output write", () => {
    expect(() => assertStep7Gate3RetainableTerminal(complete, digest)).not.toThrow();
  });

  it.each([
    ["production frontier", { productionFrontierAdmitted: true }],
    ["published document", { documentsPublished: true }],
  ])("refuses a complete-looking terminal that admitted a %s", (_label, mutation) => {
    expect(() => assertStep7Gate3RetainableTerminal({ ...complete, ...mutation }, digest)).toThrow(
      /diagnostic retention requires both false/u,
    );
  });

  it("refuses browser failure counterevidence before complete-run publication", () => {
    expect(() =>
      assertStep7Gate3RetainableTerminal(
        { ...complete, failure: "injected browser failure" },
        digest,
      ),
    ).toThrow(/carries browser failure/u);
  });

  it("refuses cleanup counterevidence before complete-run publication", () => {
    expect(() =>
      assertStep7Gate3RetainableTerminal(
        { ...complete, cleanupFailures: ["injected browser cleanup failure"] },
        digest,
      ),
    ).toThrow(/cleanup failures/u);
  });

  it("retains a branded post-result closure failure only as partial counterevidence", () => {
    const browserResult = Object.freeze({
      schemaVersion: "lego.step7-gate3-diagnostic-browser-result/1",
      status: "failed",
      failure: "injected post-result source closure mismatch",
    }) as unknown as NonNullable<UnverifiedStep7Gate3HostExecution["result"]>;
    const sourceExecutionPartial = Object.freeze({
      schemaVersion: "lego.step7-gate3-unverified-source-execution/1" as const,
      verification: "unverified-counterevidence" as const,
      authority: "none" as const,
      expectedOrigin: "http://127.0.0.1:4173",
      bootstrapSourceManifestDigest: `sha256:${"2".repeat(64)}`,
      events: Object.freeze([]),
      blockedRequests: Object.freeze([
        Object.freeze({
          sequence: 3,
          absoluteRequestUrl: "http://127.0.0.1:4173/blocked.mjs",
          method: "GET",
          resourceType: "script",
          fetchDestination: "script",
          failure: "blocked source request",
        }),
      ]),
      observerLifecycle: Object.freeze({
        observedRequests: 4,
        uniqueObservedRequests: 4,
        routedRequests: 4,
        pendingRoutes: 0,
        contextClosed: true,
        pages: 0,
        serviceWorkers: 0,
        dedicatedWorkers: 0,
        preRouteCspControlFailures: Object.freeze([]),
        sharedWorkerExecution: "blocked-by-context-init-script" as const,
      }),
    });
    const servedJavaScriptPartial = Object.freeze({
      schemaVersion: "lego.step7-gate3-unverified-served-javascript/1" as const,
      verification: "unverified-counterevidence" as const,
      authority: "none" as const,
      browserInputDigest: `sha256:${"3".repeat(64)}`,
      expectedOrigin: "http://127.0.0.1:4173",
      bodyLimitSemantics:
        "canonical-content-length-required-when-present-plus-preflight-and-post-materialization-retained-evidence-bound" as const,
      responseBodiesRetained: false as const,
      observedExecutableUrls: Object.freeze(["http://127.0.0.1:4173/unreadable.mjs"]),
      settledResponses: Object.freeze([]),
      responseReadFailures: Object.freeze([
        Object.freeze({
          status: "failed" as const,
          sequence: 4,
          absoluteUrl: "http://127.0.0.1:4173/unreadable.mjs",
          failure: "response body read failed",
        }),
      ]),
      contextClosed: true,
      pages: 0,
      serviceWorkers: 0,
    });
    const snapshot = Object.freeze({
      schemaVersion: "lego.step7-gate3-unverified-host-execution/1" as const,
      verification: "unverified-counterevidence" as const,
      result: browserResult,
      blankRunnerBefore: null,
      blankRunnerAfter: null,
      sourceExecution: null,
      servedJavaScript: null,
      sourceExecutionPartial,
      servedJavaScriptPartial,
      executionPolicyControl: null,
      viteOrigin: "http://127.0.0.1:4173",
    });
    const failure = new Step7Gate3HostExecutionError(
      "injected post-result source closure mismatch",
      snapshot,
      { cause: new Error("source closure mismatch") },
    );
    const recovered = step7Gate3UnverifiedHostExecution(failure);
    const counterevidence = buildStep7Gate3UnverifiedHostFailureCounterevidence({
      prepared: null,
      execution: null,
      unverifiedExecution: recovered,
    });

    expect(recovered).toBe(snapshot);
    expect(counterevidence).toMatchObject({
      verification: "unverified-raw-counterevidence",
      completeRun: false,
      prepared: null,
      execution: {
        kind: "partial-host-execution-counterevidence",
        schemaVersion: "lego.step7-gate3-unverified-host-execution/1",
        verification: "unverified-counterevidence",
        browserResult,
        sourceExecutionPartial,
        servedJavaScriptPartial,
      },
    });
    expect(counterevidence.execution).not.toHaveProperty("result");
  });
});
