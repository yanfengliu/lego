import { resolve } from "node:path";

import { expect, test } from "@playwright/test";

import {
  installStep7Gate3CloseTimeFetchControl,
  runStep7Gate3BrowserErrorBoundaryControl,
} from "./real-build-step7-gate3-browser-boundary-controls";
import type { Step7Gate3BrowserResult } from "./real-build-step7-gate3-diagnostic-browser";
import { snapshotBlankRunnerState } from "./real-build-step7-gate3-diagnostic-fixture";
import {
  createStep7Gate3SourceExecutionBoundary,
  STEP7_GATE3_BLANK_RUNNER_CONTENT_SECURITY_POLICY,
  STEP7_GATE3_CLOSE_TIME_COMPANION_PATH,
  STEP7_GATE3_CLOSE_TIME_CONTROL_PATH,
} from "./real-build-step7-gate3-diagnostic-source";
import { drainStep7Gate3ObserverFrontier } from "./real-build-step7-gate3-observer-closure";
import {
  executeStep7Gate3PostResultObserverClosure,
  step7Gate3UnverifiedHostExecution,
} from "./real-build-step7-gate3-host-execution";
import {
  runStep7Gate3ContextIsolationControl,
  type Step7Gate3ExecutionPolicyControl,
} from "./real-build-step7-gate3-host-policy-control";
import { captureServedJavaScript } from "./real-build-step7-gate3-served-source";
import {
  runStep7Gate3WorkerExecutionPolicyControl,
  STEP7_GATE3_PDF_WORKER_CONTENT_SECURITY_POLICY,
  STEP7_GATE3_WORKER_CONTROL_PATH,
} from "./real-build-step7-gate3-worker-policy";
import { workspaceModuleUrl } from "./workspace-module";

const POLICY_PATH = "apps/web/e2e/real-build-production-policy.ts";
const POLICY_URL = "/e2e/real-build-production-policy.ts";
const DIAGNOSTIC_CONTRACT_PATH =
  "apps/web/e2e/real-build-step7-gate3-diagnostic-browser-contract.ts";
const DIAGNOSTIC_CONTRACT_URL = "/e2e/real-build-step7-gate3-diagnostic-browser-contract.ts";
const LATE_FORBIDDEN_URL = "/e2e/real-build-successful-step-mechanism.ts";
const PDF_WORKER_PATH = "node_modules/pdfjs-dist/build/pdf.worker.mjs";
const CLOSE_TIME_CONTROL_DIGEST =
  "sha256:f7375339845a4acf8a025a9b47ccb285b7a058231db10e804af0b17e36dd760f";
const CLOSE_TIME_CONTROL_BYTES = 77;
const CLOSE_TIME_MESSAGE_DELAY_MS = 100;
const CLOSE_TIME_RESPONSE_CONSUMPTION_DELAY_MS = 100;
const LEGACY_TWO_STABLE_PASSES_WINDOW_MS = 20;

const EXECUTION_POLICY_CONTROL = Object.freeze({
  moduleInitializationEvalBlocked: true,
  workerEvalBlocked: true,
  workerEvalFailureName: "EvalError",
  workerSharedWorkerConstructorPresent: false,
  workerSharedWorkerBlocked: true,
  workerSharedWorkerFailureName: "Unavailable",
  blobImportBlocked: true,
  dataImportBlocked: true,
  externalImportBlocked: true,
  cspImportControlUrls: Object.freeze({
    blobUrl: "blob:http://127.0.0.1:4173/test-control",
    dataUrl: "data:text/javascript,export default 'gate3-data-control'",
    externalUrl: "https://gate3-control.invalid/external-module.js",
  }),
  serviceWorkerApiPresent: true,
  serviceWorkerRegistrationBlocked: true,
  serviceWorkerRegistrationFailureName: "Error",
  sharedWorkerConstructorPresent: true,
  sharedWorkerBlocked: true,
  sharedWorkerFailureName: "SecurityError",
  violations: Object.freeze([]),
}) satisfies Step7Gate3ExecutionPolicyControl;

const exactOrigin = (baseURL: string | undefined): string => {
  if (baseURL === undefined) throw new TypeError("Playwright baseURL is required.");
  return new URL(baseURL).origin;
};

test("serves the exact PDF worker and a worker eval control under the no-eval worker CSP", async ({
  page,
  baseURL,
}) => {
  const expectedOrigin = exactOrigin(baseURL);
  const workerUrl = workspaceModuleUrl(PDF_WORKER_PATH);
  const requiredEntryUrls = [POLICY_URL, workerUrl];
  const boundary = createStep7Gate3SourceExecutionBoundary({
    page,
    expectedOrigin,
    repoRoot: resolve(process.cwd()),
    bootstrapSourceManifestDigest: `sha256:${"0".repeat(64)}`,
    allowedSourcePaths: [
      POLICY_PATH,
      DIAGNOSTIC_CONTRACT_PATH,
      PDF_WORKER_PATH,
      "node_modules/vite/dist/client/client.mjs",
      "node_modules/vite/dist/client/env.mjs",
    ],
    requiredEntryUrls,
    requiredPdfUrl: null,
    requiredWorkerUrl: workerUrl,
    requiredCloseTimeControlUrl: null,
    forbiddenUrlFragments: ["/output/", "/cas/"],
  });
  await boundary.install();
  let capture: ReturnType<typeof captureServedJavaScript> | null = null;
  try {
    const runner = await page.goto("/__real_build_runner__");
    expect(runner?.headers()["content-security-policy"]).toBe(
      STEP7_GATE3_BLANK_RUNNER_CONTENT_SECURITY_POLICY,
    );
    capture = captureServedJavaScript({
      page,
      expectedOrigin,
      requiredEntryUrls,
      forbiddenUrlFragments: ["/output/", "/cas/"],
      browserInputDigest: `sha256:${"1".repeat(64)}`,
    });
    const contextIsolation = await runStep7Gate3ContextIsolationControl(page, POLICY_URL);
    expect(contextIsolation).toMatchObject({
      serviceWorkerApiPresent: true,
      serviceWorkerRegistrationBlocked: true,
      sharedWorkerConstructorPresent: true,
      sharedWorkerBlocked: true,
      sharedWorkerFailureName: "SecurityError",
    });
    expect(contextIsolation.serviceWorkerRegistrationFailureName).not.toBe("none");
    const browserErrorBoundary = await runStep7Gate3BrowserErrorBoundaryControl(
      page,
      DIAGNOSTIC_CONTRACT_URL,
    );
    expect(browserErrorBoundary).toMatchObject({
      objectMessage: "a thrown non-primitive value",
      functionMessage: "a thrown non-primitive value",
      nativeErrorMessage: "native error detail",
      nativeErrorWithHostilePrototypeMessage: "hostile prototype detail",
      accessorErrorMessage: "a thrown non-primitive value",
      proxiedErrorMessage: "a thrown non-primitive value",
      liveGlobalErrorMessage: "live global detail",
      pollutedPrototypeAccessorErrorMessage: "a thrown non-primitive value",
      numberMessage: "42.5",
      hostileTrapCalls: {
        get: 0,
        descriptor: 0,
        keys: 0,
        prototype: 0,
        apply: 0,
        construct: 0,
        accessor: 0,
        globalError: 0,
        inheritedDescriptorValue: 0,
      },
      replacementIntrinsicCalls: {
        reflectApply: 0,
        stringSlice: 0,
        numberToString: 0,
        errorIsError: 0,
        objectGetOwnPropertyDescriptor: 0,
      },
    });
    expect(browserErrorBoundary.longStringMessage).toHaveLength(512);
    expect(browserErrorBoundary.longStringMessage.endsWith("...")).toBe(true);
    await expect(runStep7Gate3WorkerExecutionPolicyControl(page)).resolves.toEqual({
      schemaVersion: "lego.step7-gate3-worker-policy-control/1",
      evalBlocked: true,
      evalFailureName: "EvalError",
      sharedWorkerConstructorPresent: false,
      sharedWorkerBlocked: true,
      sharedWorkerFailureName: "Unavailable",
    });
    await page.evaluate(
      async ({ policyUrl, exactWorkerUrl }) => {
        await import(/* @vite-ignore */ policyUrl);
        await new Promise<void>((resolveWorker, rejectWorker) => {
          const worker = new Worker(exactWorkerUrl, { type: "module" });
          const timeout = setTimeout(() => {
            resolveWorker();
          }, 250);
          worker.addEventListener(
            "error",
            () => {
              clearTimeout(timeout);
              worker.terminate();
              rejectWorker(
                new Error("Exact PDF worker failed to initialize under its response CSP."),
              );
            },
            { once: true },
          );
        });
      },
      { policyUrl: POLICY_URL, exactWorkerUrl: workerUrl },
    );
    await drainStep7Gate3ObserverFrontier({ requestBoundary: boundary, responseCapture: capture });
    await boundary.quiesce();
    const [boundaryOutcome, captureOutcome] = await Promise.allSettled([
      boundary.finish(),
      capture(),
    ]);
    if (boundaryOutcome.status === "rejected") throw boundaryOutcome.reason;
    if (captureOutcome.status === "rejected") {
      throw new AggregateError(
        [captureOutcome.reason],
        JSON.stringify(
          boundaryOutcome.value.events.map(({ absoluteRequestUrl, resourceKind }) => ({
            absoluteRequestUrl,
            resourceKind,
          })),
        ),
      );
    }
    expect(boundaryOutcome.status).toBe("fulfilled");
    expect(captureOutcome.status).toBe("fulfilled");
    if (boundaryOutcome.status !== "fulfilled" || captureOutcome.status !== "fulfilled") return;
    expect(boundaryOutcome.value.observerClosure).toMatchObject({
      contextClosed: true,
      pages: 0,
      serviceWorkers: 0,
      dedicatedWorkers: 0,
      sharedWorkerExecution: "blocked-by-context-init-script",
    });
    expect(boundaryOutcome.value.upstreamResponseMemoryBound).toBe(
      "not-proved-route-fetch-may-materialize-before-body-evidence",
    );
    expect(captureOutcome.value).toMatchObject({
      bodyLimitSemantics:
        "canonical-content-length-required-when-present-plus-preflight-and-post-materialization-retained-evidence-bound",
      responseBodiesRetained: false,
    });
    expect(boundaryOutcome.value.workerContentSecurityPolicy).toBe(
      STEP7_GATE3_PDF_WORKER_CONTENT_SECURITY_POLICY,
    );
    const workerUrls = new Set([
      new URL(workerUrl, expectedOrigin).href,
      new URL(STEP7_GATE3_WORKER_CONTROL_PATH, expectedOrigin).href,
    ]);
    expect(
      captureOutcome.value.responses
        .filter(({ absoluteUrl }) => workerUrls.has(absoluteUrl))
        .map(({ contentSecurityPolicy }) => contentSecurityPolicy),
    ).toEqual([
      STEP7_GATE3_PDF_WORKER_CONTENT_SECURITY_POLICY,
      STEP7_GATE3_PDF_WORKER_CONTENT_SECURITY_POLICY,
    ]);
  } finally {
    await boundary.quiesce();
    await Promise.allSettled([capture?.dispose() ?? Promise.resolve(), boundary.dispose()]);
  }
});

test("captures an allowed close-time keepalive GET in both closed manifests", async ({
  page,
  baseURL,
}) => {
  const expectedOrigin = exactOrigin(baseURL);
  const closeTimeControlAbsoluteUrl = new URL(STEP7_GATE3_CLOSE_TIME_CONTROL_PATH, expectedOrigin)
    .href;
  const closeTimeCompanionAbsoluteUrl = new URL(
    STEP7_GATE3_CLOSE_TIME_COMPANION_PATH,
    expectedOrigin,
  ).href;
  const boundary = createStep7Gate3SourceExecutionBoundary({
    page,
    expectedOrigin,
    repoRoot: resolve(process.cwd()),
    bootstrapSourceManifestDigest: `sha256:${"4".repeat(64)}`,
    allowedSourcePaths: [POLICY_PATH],
    requiredEntryUrls: [POLICY_URL],
    requiredPdfUrl: null,
    requiredWorkerUrl: null,
    requiredCloseTimeControlUrl: STEP7_GATE3_CLOSE_TIME_CONTROL_PATH,
    forbiddenUrlFragments: ["/output/", "/cas/"],
  });
  await boundary.install();
  let capture: ReturnType<typeof captureServedJavaScript> | null = null;
  try {
    await page.goto("/__real_build_runner__");
    capture = captureServedJavaScript({
      page,
      expectedOrigin,
      requiredEntryUrls: [POLICY_URL],
      forbiddenUrlFragments: ["/output/", "/cas/"],
      browserInputDigest: `sha256:${"5".repeat(64)}`,
    });
    await page.evaluate(async (policyUrl) => import(/* @vite-ignore */ policyUrl), POLICY_URL);
    await drainStep7Gate3ObserverFrontier({ requestBoundary: boundary, responseCapture: capture });
    const closeTimeControl = await installStep7Gate3CloseTimeFetchControl(
      page,
      closeTimeCompanionAbsoluteUrl,
      closeTimeControlAbsoluteUrl,
      {
        messageHandlingDelayMs: CLOSE_TIME_MESSAGE_DELAY_MS,
        responseConsumptionDelayMs: CLOSE_TIME_RESPONSE_CONSUMPTION_DELAY_MS,
      },
    );

    const retainedBrowserResult = Object.freeze({
      schemaVersion: "test.post-result-close-time-success/1",
    }) as unknown as Step7Gate3BrowserResult;
    const blankRunnerState = await snapshotBlankRunnerState(page);
    const closureStartedAt = performance.now();
    let closed: Awaited<ReturnType<typeof executeStep7Gate3PostResultObserverClosure>>;
    try {
      closed = await executeStep7Gate3PostResultObserverClosure({
        result: retainedBrowserResult,
        blankRunnerBefore: blankRunnerState,
        blankRunnerAfter: blankRunnerState,
        executionPolicyControl: EXECUTION_POLICY_CONTROL,
        viteOrigin: expectedOrigin,
        requestBoundary: boundary,
        responseCapture: capture,
        postPagehideCompletionAck: closeTimeControl.completion.then(() => undefined),
      });
    } catch (error) {
      const partial = step7Gate3UnverifiedHostExecution(error);
      if (partial === null) throw error;
      throw new Error(
        `Close-time observer counterevidence: ${JSON.stringify({
          sourceEvents: partial.sourceExecutionPartial?.events,
          blockedRequests: partial.sourceExecutionPartial?.blockedRequests,
          observedResponses: partial.servedJavaScriptPartial?.observedExecutableUrls,
          settledResponses: partial.servedJavaScriptPartial?.settledResponses,
          responseReadFailures: partial.servedJavaScriptPartial?.responseReadFailures,
        })}`,
        { cause: error },
      );
    }
    const closureElapsedMs = performance.now() - closureStartedAt;
    const closeTimeAck = await closeTimeControl.completion;

    expect(closed.sourceExecution.requiredCloseTimeControlUrl).toBe(
      STEP7_GATE3_CLOSE_TIME_CONTROL_PATH,
    );
    const sourceEvents = closed.sourceExecution.events.filter(
      ({ absoluteRequestUrl }) => absoluteRequestUrl === closeTimeControlAbsoluteUrl,
    );
    expect(sourceEvents).toEqual([
      expect.objectContaining({
        absoluteRequestUrl: closeTimeControlAbsoluteUrl,
        origin: expectedOrigin,
        relativeRequestUrl: STEP7_GATE3_CLOSE_TIME_CONTROL_PATH,
        method: "GET",
        resourceType: "fetch",
        navigationRequest: false,
        redirectChain: [],
        resourceKind: "close-time-control",
        sourcePath: null,
        response: {
          absoluteUrl: closeTimeControlAbsoluteUrl,
          status: 200,
          contentType: "text/javascript; charset=utf-8",
          contentSecurityPolicy: STEP7_GATE3_PDF_WORKER_CONTENT_SECURITY_POLICY,
          location: null,
          synthetic: true,
          bodyDigest: CLOSE_TIME_CONTROL_DIGEST,
        },
      }),
    ]);
    const servedResponses = closed.servedJavaScript.responses.filter(
      ({ absoluteUrl }) => absoluteUrl === closeTimeControlAbsoluteUrl,
    );
    expect(servedResponses).toEqual([
      expect.objectContaining({
        absoluteUrl: closeTimeControlAbsoluteUrl,
        origin: expectedOrigin,
        relativeUrl: STEP7_GATE3_CLOSE_TIME_CONTROL_PATH,
        status: 200,
        method: "GET",
        resourceType: "fetch",
        contentType: "text/javascript; charset=utf-8",
        contentSecurityPolicy: STEP7_GATE3_PDF_WORKER_CONTENT_SECURITY_POLICY,
        bytes: CLOSE_TIME_CONTROL_BYTES,
        digest: CLOSE_TIME_CONTROL_DIGEST,
      }),
    ]);
    expect(CLOSE_TIME_MESSAGE_DELAY_MS).toBeGreaterThan(LEGACY_TWO_STABLE_PASSES_WINDOW_MS);
    expect(closeTimeAck).toMatchObject({
      schemaVersion: "lego.step7-gate3-close-time-completion/1",
      status: "complete",
      absoluteUrl: closeTimeControlAbsoluteUrl,
      pagehideSignalReceived: true,
      fetchCompleted: true,
      responseConsumed: true,
      bytes: CLOSE_TIME_CONTROL_BYTES,
      messageHandlingDelayMs: CLOSE_TIME_MESSAGE_DELAY_MS,
      responseConsumptionDelayMs: CLOSE_TIME_RESPONSE_CONSUMPTION_DELAY_MS,
    });
    expect(closeTimeAck.signalToFetchElapsedMs).toBeGreaterThanOrEqual(
      CLOSE_TIME_MESSAGE_DELAY_MS - 10,
    );
    expect(closeTimeAck.responseToConsumptionElapsedMs).toBeGreaterThanOrEqual(
      CLOSE_TIME_RESPONSE_CONSUMPTION_DELAY_MS - 10,
    );
    expect(closureElapsedMs).toBeGreaterThanOrEqual(
      CLOSE_TIME_MESSAGE_DELAY_MS +
        CLOSE_TIME_RESPONSE_CONSUMPTION_DELAY_MS -
        LEGACY_TWO_STABLE_PASSES_WINDOW_MS,
    );
    expect(closed.sourceExecution.observerClosure).toMatchObject({
      contextClosed: true,
      pages: 0,
      serviceWorkers: 0,
      dedicatedWorkers: 0,
    });
    expect(page.isClosed()).toBe(true);
    expect(closeTimeControl.companion.isClosed()).toBe(true);
    expect(page.context().pages()).toEqual([]);
  } finally {
    await boundary.quiesce();
    await Promise.allSettled([capture?.dispose() ?? Promise.resolve(), boundary.dispose()]);
  }
});

test("retains both observers through context closure and refuses a beforeunload beacon", async ({
  page,
  baseURL,
}) => {
  const expectedOrigin = exactOrigin(baseURL);
  const boundary = createStep7Gate3SourceExecutionBoundary({
    page,
    expectedOrigin,
    repoRoot: resolve(process.cwd()),
    bootstrapSourceManifestDigest: `sha256:${"2".repeat(64)}`,
    allowedSourcePaths: [POLICY_PATH],
    requiredEntryUrls: [POLICY_URL],
    requiredPdfUrl: null,
    requiredWorkerUrl: null,
    requiredCloseTimeControlUrl: null,
    forbiddenUrlFragments: ["/output/", "/cas/"],
  });
  await boundary.install();
  let capture: ReturnType<typeof captureServedJavaScript> | null = null;
  try {
    await page.goto("/__real_build_runner__");
    capture = captureServedJavaScript({
      page,
      expectedOrigin,
      requiredEntryUrls: [POLICY_URL],
      forbiddenUrlFragments: ["/output/", "/cas/"],
      browserInputDigest: `sha256:${"3".repeat(64)}`,
    });
    await page.evaluate(async (policyUrl) => import(/* @vite-ignore */ policyUrl), POLICY_URL);
    await drainStep7Gate3ObserverFrontier({ requestBoundary: boundary, responseCapture: capture });
    let beforeUnloadDialogSeen = false;
    page.on("dialog", (dialog) => {
      if (dialog.type() === "beforeunload") beforeUnloadDialogSeen = true;
      void dialog.accept();
    });
    await page.mouse.click(10, 10);
    const beaconInstalled = await page.evaluate((lateUrl) => {
      addEventListener(
        "beforeunload",
        (event) => {
          navigator.sendBeacon(lateUrl, "gate3-close-control");
          event.preventDefault();
          event.returnValue = "";
        },
        { once: true },
      );
      return true;
    }, LATE_FORBIDDEN_URL);
    expect(beaconInstalled).toBe(true);

    const retainedBrowserResult = Object.freeze({
      schemaVersion: "test.post-result-counterevidence/1",
    }) as unknown as Step7Gate3BrowserResult;
    const blankRunnerState = await snapshotBlankRunnerState(page);
    let closureFailure: unknown = null;
    try {
      await executeStep7Gate3PostResultObserverClosure({
        result: retainedBrowserResult,
        blankRunnerBefore: blankRunnerState,
        blankRunnerAfter: blankRunnerState,
        executionPolicyControl: EXECUTION_POLICY_CONTROL,
        viteOrigin: expectedOrigin,
        requestBoundary: boundary,
        responseCapture: capture,
      });
    } catch (error) {
      closureFailure = error;
    }
    expect((closureFailure as Error).message).not.toContain("Cleanup also recorded");
    const unverified = step7Gate3UnverifiedHostExecution(closureFailure);
    expect(unverified?.result).toBe(retainedBrowserResult);
    expect(unverified?.verification).toBe("unverified-counterevidence");
    expect(unverified?.sourceExecutionPartial).toMatchObject({
      authority: "none",
      blockedRequests: [
        {
          absoluteRequestUrl: new URL(LATE_FORBIDDEN_URL, expectedOrigin).href,
          method: "POST",
        },
      ],
      observerLifecycle: {
        contextClosed: true,
        pages: 0,
        serviceWorkers: 0,
        dedicatedWorkers: 0,
      },
    });
    expect(unverified?.servedJavaScriptPartial).toMatchObject({
      authority: "none",
      responseBodiesRetained: false,
      contextClosed: true,
      pages: 0,
      serviceWorkers: 0,
    });
    expect(beforeUnloadDialogSeen).toBe(true);
    expect(page.isClosed()).toBe(true);
    expect(page.context().pages()).toEqual([]);
  } finally {
    await boundary.quiesce();
    await Promise.allSettled([capture?.dispose() ?? Promise.resolve(), boundary.dispose()]);
  }
});
