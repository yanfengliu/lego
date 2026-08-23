import { describe, expect, it, vi } from "vitest";

import type { Step7Gate3BrowserResult } from "../e2e/real-build-step7-gate3-diagnostic-browser";
import type { Step7Gate3SourceExecutionBoundary } from "../e2e/real-build-step7-gate3-diagnostic-source";
import {
  describeStep7Gate3HostThrownWithoutProbing,
  executeStep7Gate3PostResultObserverClosure,
  Step7Gate3HostExecutionError,
  step7Gate3UnverifiedHostExecution,
} from "../e2e/real-build-step7-gate3-host-execution";
import type { captureServedJavaScript } from "../e2e/real-build-step7-gate3-served-source";

describe("Gate-3 post-result host execution failure", () => {
  it("formats primitives and brands retained failures without consulting live globals or inherited setters", () => {
    const NativeString = String;
    const globalStringDescriptor = Object.getOwnPropertyDescriptor(globalThis, "String");
    const errorNameDescriptor = Object.getOwnPropertyDescriptor(Error.prototype, "name");
    const weakMapSetDescriptor = Object.getOwnPropertyDescriptor(WeakMap.prototype, "set");
    const weakMapGetDescriptor = Object.getOwnPropertyDescriptor(WeakMap.prototype, "get");
    if (
      globalStringDescriptor === undefined ||
      errorNameDescriptor === undefined ||
      weakMapSetDescriptor === undefined ||
      weakMapGetDescriptor === undefined
    ) {
      throw new TypeError(
        "Expected host String, Error.prototype.name, and WeakMap method descriptors.",
      );
    }
    const calls = { globalString: 0, inheritedNameSetter: 0, weakMapSet: 0, weakMapGet: 0 };
    const retainedEvidence = {} as never;
    let shownNumber: string;
    let retainedFailure: Step7Gate3HostExecutionError;
    let recoveredEvidence: unknown;
    try {
      Object.defineProperty(globalThis, "String", {
        configurable: globalStringDescriptor.configurable === true,
        enumerable: globalStringDescriptor.enumerable === true,
        get: () => {
          calls.globalString += 1;
          return NativeString;
        },
      });
      Object.defineProperty(Error.prototype, "name", {
        configurable: errorNameDescriptor.configurable === true,
        enumerable: errorNameDescriptor.enumerable === true,
        set: () => {
          calls.inheritedNameSetter += 1;
        },
      });
      Object.defineProperty(WeakMap.prototype, "set", {
        ...weakMapSetDescriptor,
        value: () => {
          calls.weakMapSet += 1;
          throw new Error("must use captured WeakMap.prototype.set");
        },
      });
      Object.defineProperty(WeakMap.prototype, "get", {
        ...weakMapGetDescriptor,
        value: () => {
          calls.weakMapGet += 1;
          throw new Error("must use captured WeakMap.prototype.get");
        },
      });
      shownNumber = describeStep7Gate3HostThrownWithoutProbing(42);
      retainedFailure = new Step7Gate3HostExecutionError("retained failure", retainedEvidence, {
        cause: 42,
      });
      recoveredEvidence = step7Gate3UnverifiedHostExecution(retainedFailure);
    } finally {
      Object.defineProperty(globalThis, "String", globalStringDescriptor);
      Object.defineProperty(Error.prototype, "name", errorNameDescriptor);
      Object.defineProperty(WeakMap.prototype, "set", weakMapSetDescriptor);
      Object.defineProperty(WeakMap.prototype, "get", weakMapGetDescriptor);
    }

    expect(shownNumber).toBe("42");
    expect(Object.getOwnPropertyDescriptor(retainedFailure, "name")?.value).toBe(
      "Step7Gate3HostExecutionError",
    );
    expect(recoveredEvidence).toBe(retainedEvidence);
    expect(calls).toEqual({
      globalString: 0,
      inheritedNameSetter: 0,
      weakMapSet: 0,
      weakMapGet: 0,
    });
  });

  it("retains the browser result while formatting a hostile closure rejection without probing it", async () => {
    const traps = { get: 0, descriptor: 0, keys: 0, prototype: 0 };
    const hostile = new Proxy(Object.create(null) as object, {
      get: () => {
        traps.get += 1;
        throw new Error("must not read");
      },
      getOwnPropertyDescriptor: () => {
        traps.descriptor += 1;
        throw new Error("must not inspect descriptors");
      },
      getPrototypeOf: () => {
        traps.prototype += 1;
        throw new Error("must not inspect the prototype");
      },
      ownKeys: () => {
        traps.keys += 1;
        throw new Error("must not enumerate");
      },
    });
    const requestBoundary = {
      drainExecutableResponseUrls: vi.fn().mockRejectedValue(hostile),
      quiesce: vi.fn().mockResolvedValue(undefined),
      dispose: vi.fn().mockResolvedValue(undefined),
      snapshotUnverified: vi.fn().mockReturnValue({
        schemaVersion: "lego.step7-gate3-unverified-source-execution/1",
        verification: "unverified-counterevidence",
        authority: "none",
        expectedOrigin: "http://127.0.0.1:4173",
        bootstrapSourceManifestDigest: `sha256:${"1".repeat(64)}`,
        events: [],
        blockedRequests: [
          {
            sequence: 1,
            absoluteRequestUrl: "http://127.0.0.1:4173/blocked.mjs",
            method: "GET",
            resourceType: "script",
            fetchDestination: "script",
            failure: "blocked source request",
          },
        ],
        observerLifecycle: {
          observedRequests: 2,
          uniqueObservedRequests: 2,
          routedRequests: 2,
          pendingRoutes: 0,
          contextClosed: true,
          pages: 0,
          serviceWorkers: 0,
          dedicatedWorkers: 0,
          preRouteCspControlFailures: [],
          sharedWorkerExecution: "blocked-by-context-init-script",
        },
      }),
    } as unknown as Step7Gate3SourceExecutionBoundary;
    const responseCapture = Object.assign(vi.fn(), {
      drain: vi.fn().mockResolvedValue([]),
      dispose: vi.fn().mockResolvedValue(undefined),
      snapshotUnverified: vi.fn().mockReturnValue({
        schemaVersion: "lego.step7-gate3-unverified-served-javascript/1",
        verification: "unverified-counterevidence",
        authority: "none",
        browserInputDigest: `sha256:${"2".repeat(64)}`,
        expectedOrigin: "http://127.0.0.1:4173",
        bodyLimitSemantics:
          "canonical-content-length-required-when-present-plus-preflight-and-post-materialization-retained-evidence-bound",
        responseBodiesRetained: false,
        observedExecutableUrls: ["http://127.0.0.1:4173/unreadable.mjs"],
        settledResponses: [],
        responseReadFailures: [
          {
            status: "failed",
            sequence: 2,
            absoluteUrl: "http://127.0.0.1:4173/unreadable.mjs",
            failure: "body unavailable after context closure",
          },
        ],
        contextClosed: true,
        pages: 0,
        serviceWorkers: 0,
      }),
    }) as unknown as ReturnType<typeof captureServedJavaScript>;
    const result = Object.freeze({
      marker: "browser-result",
    }) as unknown as Step7Gate3BrowserResult;
    const blankRunner = {
      title: "LEGO Gate-3 Blank Runner",
      scriptCount: 0,
      indexedDbNames: [],
      localStorageKeys: [],
      sessionStorageKeys: [],
      cacheNames: [],
      cookie: "",
      serviceWorkerScopes: [],
    };

    let failure: unknown = null;
    try {
      await executeStep7Gate3PostResultObserverClosure({
        result,
        blankRunnerBefore: blankRunner,
        blankRunnerAfter: blankRunner,
        executionPolicyControl: {
          moduleInitializationEvalBlocked: true,
          workerEvalBlocked: true,
          workerEvalFailureName: "EvalError",
          workerSharedWorkerConstructorPresent: false,
          workerSharedWorkerBlocked: true,
          workerSharedWorkerFailureName: "Unavailable",
          blobImportBlocked: true,
          dataImportBlocked: true,
          externalImportBlocked: true,
          cspImportControlUrls: {
            blobUrl: "blob:http://127.0.0.1:4173/test-control",
            dataUrl: "data:text/javascript,export default 'gate3-data-control'",
            externalUrl: "https://gate3-control.invalid/external-module.js",
          },
          serviceWorkerApiPresent: true,
          serviceWorkerRegistrationBlocked: true,
          serviceWorkerRegistrationFailureName: "Error",
          sharedWorkerConstructorPresent: true,
          sharedWorkerBlocked: true,
          sharedWorkerFailureName: "SecurityError",
          violations: [],
        },
        viteOrigin: "http://127.0.0.1:4173",
        requestBoundary,
        responseCapture,
      });
    } catch (error) {
      failure = error;
    }

    const unverified = step7Gate3UnverifiedHostExecution(failure);
    expect(unverified?.result).toBe(result);
    expect(unverified?.sourceExecutionPartial?.blockedRequests).toEqual([
      expect.objectContaining({ absoluteRequestUrl: "http://127.0.0.1:4173/blocked.mjs" }),
    ]);
    expect(unverified?.servedJavaScriptPartial?.responseReadFailures).toEqual([
      expect.objectContaining({ absoluteUrl: "http://127.0.0.1:4173/unreadable.mjs" }),
    ]);
    expect(failure).toMatchObject({ name: "Step7Gate3HostExecutionError" });
    expect((failure as Error).message).toContain("a thrown object");
    expect((failure as Error).message.length).toBeLessThanOrEqual(512);
    expect(traps).toEqual({ get: 0, descriptor: 0, keys: 0, prototype: 0 });
    expect(requestBoundary.quiesce).toHaveBeenCalledOnce();
    expect(responseCapture.dispose).toHaveBeenCalledOnce();
    expect(requestBoundary.dispose).toHaveBeenCalledOnce();
  });
});
