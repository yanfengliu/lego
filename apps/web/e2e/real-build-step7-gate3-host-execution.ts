import { expect } from "@playwright/test";

import {
  assertRealBuildBootstrapSourceLockHeld,
  readRequiredRealBuildBootstrapSourceManifest,
} from "./real-build-bootstrap-source";
import type { Step7Gate3BrowserResult } from "./real-build-step7-gate3-diagnostic-browser";
import { snapshotBlankRunnerState, SOURCE_RUN } from "./real-build-step7-gate3-diagnostic-fixture";
import {
  createStep7Gate3SourceExecutionBoundary,
  STEP7_GATE3_BLANK_RUNNER_CONTENT_SECURITY_POLICY,
} from "./real-build-step7-gate3-diagnostic-source";
import type {
  Step7Gate3SourceExecutionBoundary,
  Step7Gate3SourceExecutionBoundaryManifest,
} from "./real-build-step7-gate3-diagnostic-source";
import type { Step7Gate3UnverifiedSourceExecutionBoundarySnapshot } from "./real-build-step7-gate3-source-evidence";
import {
  runStep7Gate3HostExecutionPolicyControl,
  STEP7_GATE3_DATA_IMPORT_CONTROL_URL,
  STEP7_GATE3_EXTERNAL_IMPORT_CONTROL_URL,
  type Step7Gate3ExecutionPolicyControl,
} from "./real-build-step7-gate3-host-policy-control";
import { drainStep7Gate3ObserverFrontier } from "./real-build-step7-gate3-observer-closure";
import { captureServedJavaScript } from "./real-build-step7-gate3-served-source";
import type { Step7Gate3UnverifiedServedJavaScriptSnapshot } from "./real-build-step7-gate3-served-source";
import type { PreparedStep7Gate3HostRun } from "./real-build-step7-gate3-host-preparation";
import { STEP7_GATE3_PDF_WORKER_CONTENT_SECURITY_POLICY } from "./real-build-step7-gate3-worker-policy";
import { defineOwnErrorNameWithoutInheritedSetter, nativeErrorOwnData } from "./non-probing-error";

const MAXIMUM_HOST_FAILURE_MESSAGE_CHARACTERS = 512;
const SAFE_REFLECT_APPLY = Reflect.apply;
const SAFE_STRING_SLICE = String.prototype.slice;
const SAFE_NUMBER_TO_STRING = Number.prototype.toString;
const SAFE_ERROR_CONSTRUCTOR = Error;
const SAFE_WEAK_MAP_SET = WeakMap.prototype.set;
const SAFE_WEAK_MAP_GET = WeakMap.prototype.get;

const boundedMessage = (message: string): string =>
  message.length <= MAXIMUM_HOST_FAILURE_MESSAGE_CHARACTERS
    ? message
    : `${SAFE_REFLECT_APPLY(SAFE_STRING_SLICE, message, [
        0,
        MAXIMUM_HOST_FAILURE_MESSAGE_CHARACTERS - 3,
      ])}...`;

export const describeStep7Gate3HostThrownWithoutProbing = (value: unknown): string => {
  if (value === undefined) return "undefined";
  if (value === null) return "null";
  if (typeof value === "string") return boundedMessage(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") {
    return SAFE_REFLECT_APPLY(SAFE_NUMBER_TO_STRING, value, []);
  }
  if (typeof value === "bigint") return "a thrown bigint";
  if (typeof value === "symbol") return "a thrown symbol";
  const native = nativeErrorOwnData(value);
  return native === null ? `a thrown ${typeof value}` : boundedMessage(native.message);
};

const normalizedError = (error: unknown): Error =>
  new SAFE_ERROR_CONSTRUCTOR(describeStep7Gate3HostThrownWithoutProbing(error), { cause: error });

type BlankRunnerState = Awaited<ReturnType<typeof snapshotBlankRunnerState>>;
type ServedJavaScriptManifest = Awaited<ReturnType<ReturnType<typeof captureServedJavaScript>>>;

export interface UnverifiedStep7Gate3HostExecution {
  readonly schemaVersion: "lego.step7-gate3-unverified-host-execution/1";
  readonly verification: "unverified-counterevidence";
  readonly result: Step7Gate3BrowserResult | null;
  readonly blankRunnerBefore: BlankRunnerState | null;
  readonly blankRunnerAfter: BlankRunnerState | null;
  readonly sourceExecution: Step7Gate3SourceExecutionBoundaryManifest | null;
  readonly servedJavaScript: ServedJavaScriptManifest | null;
  readonly sourceExecutionPartial: Step7Gate3UnverifiedSourceExecutionBoundarySnapshot | null;
  readonly servedJavaScriptPartial: Step7Gate3UnverifiedServedJavaScriptSnapshot | null;
  readonly executionPolicyControl: Step7Gate3ExecutionPolicyControl | null;
  readonly viteOrigin: string | null;
}

const UNVERIFIED_EXECUTIONS = new WeakMap<object, UnverifiedStep7Gate3HostExecution>();

export class Step7Gate3HostExecutionError extends Error {
  constructor(
    message: string,
    unverifiedExecution: UnverifiedStep7Gate3HostExecution,
    options: ErrorOptions,
  ) {
    super(message, options);
    defineOwnErrorNameWithoutInheritedSetter(this, "Step7Gate3HostExecutionError");
    SAFE_REFLECT_APPLY(SAFE_WEAK_MAP_SET, UNVERIFIED_EXECUTIONS, [this, unverifiedExecution]);
  }
}

/** Reads only module-owned error identity; hostile thrown objects are not probed. */
export function step7Gate3UnverifiedHostExecution(
  value: unknown,
): UnverifiedStep7Gate3HostExecution | null {
  if ((typeof value !== "object" || value === null) && typeof value !== "function") return null;
  return SAFE_REFLECT_APPLY(SAFE_WEAK_MAP_GET, UNVERIFIED_EXECUTIONS, [value]) ?? null;
}

export async function executeStep7Gate3PostResultObserverClosure(input: {
  readonly result: Step7Gate3BrowserResult;
  readonly blankRunnerBefore: BlankRunnerState;
  readonly blankRunnerAfter: BlankRunnerState;
  readonly executionPolicyControl: Step7Gate3ExecutionPolicyControl;
  readonly viteOrigin: string;
  readonly requestBoundary: Step7Gate3SourceExecutionBoundary;
  readonly responseCapture: ReturnType<typeof captureServedJavaScript>;
  readonly postPagehideCompletionAck?: Promise<void>;
}): Promise<{
  readonly sourceExecution: Step7Gate3SourceExecutionBoundaryManifest;
  readonly servedJavaScript: ServedJavaScriptManifest;
}> {
  let sourceExecution: Step7Gate3SourceExecutionBoundaryManifest | null = null;
  let servedJavaScript: ServedJavaScriptManifest | null = null;
  let failure: Error | null = null;
  try {
    await drainStep7Gate3ObserverFrontier({
      requestBoundary: input.requestBoundary,
      responseCapture: input.responseCapture,
    });
    await input.requestBoundary.quiesce(async () => {
      await input.postPagehideCompletionAck;
      await drainStep7Gate3ObserverFrontier({
        requestBoundary: input.requestBoundary,
        responseCapture: input.responseCapture,
      });
    });
    const [sourceOutcome, captureOutcome] = await Promise.allSettled([
      input.requestBoundary.finish(),
      input.responseCapture(),
    ]);
    if (sourceOutcome.status === "fulfilled") sourceExecution = sourceOutcome.value;
    if (captureOutcome.status === "fulfilled") servedJavaScript = captureOutcome.value;
    const failures = [sourceOutcome, captureOutcome]
      .filter((outcome) => outcome.status === "rejected")
      .map((outcome) => normalizedError(outcome.reason));
    if (failures.length > 0) {
      throw new AggregateError(
        failures,
        "Gate-3 request boundary and served-response capture did not both finalize cleanly.",
      );
    }
  } catch (error) {
    failure = normalizedError(error);
  }
  if (failure !== null) {
    const cleanupFailures: Error[] = [];
    try {
      await input.requestBoundary.quiesce();
    } catch (error) {
      cleanupFailures.push(normalizedError(error));
    }
    const cleanupOutcomes = await Promise.allSettled([
      input.responseCapture.dispose(),
      input.requestBoundary.dispose(),
    ]);
    cleanupFailures.push(
      ...cleanupOutcomes
        .filter((outcome) => outcome.status === "rejected")
        .map((outcome) => normalizedError(outcome.reason)),
    );
    const cause =
      cleanupFailures.length === 0
        ? failure
        : new AggregateError(
            [failure, ...cleanupFailures],
            `Gate-3 post-result observer closure failed: ${failure.message} Cleanup also recorded ${cleanupFailures.length} failures.`,
          );
    throw new Step7Gate3HostExecutionError(
      boundedMessage(
        `Gate-3 post-result observer closure failed with bounded unverified counterevidence: ${cause.message}`,
      ),
      Object.freeze({
        schemaVersion: "lego.step7-gate3-unverified-host-execution/1",
        verification: "unverified-counterevidence",
        result: input.result,
        blankRunnerBefore: input.blankRunnerBefore,
        blankRunnerAfter: input.blankRunnerAfter,
        sourceExecution,
        servedJavaScript,
        sourceExecutionPartial: input.requestBoundary.snapshotUnverified(),
        servedJavaScriptPartial: input.responseCapture.snapshotUnverified(),
        executionPolicyControl: input.executionPolicyControl,
        viteOrigin: input.viteOrigin,
      }),
      { cause },
    );
  }
  if (sourceExecution === null || servedJavaScript === null) {
    throw new TypeError("Gate-3 post-result observer closure produced no closed manifests.");
  }
  return Object.freeze({ sourceExecution, servedJavaScript });
}

export async function executeStep7Gate3HostRun(prepared: PreparedStep7Gate3HostRun) {
  const {
    page,
    expectedViteOrigin,
    bootstrapBefore,
    sourceBoundaryInput,
    driverUrl,
    exactBrowserInput,
    currentModuleEntryUrls,
    browserInputDigest,
  } = prepared;
  const requiredServedEntryUrls = Object.freeze([
    ...currentModuleEntryUrls,
    exactBrowserInput.options.workerUrl,
  ]);
  const sourceExecutionBoundary = createStep7Gate3SourceExecutionBoundary({
    ...sourceBoundaryInput,
    requiredEntryUrls: requiredServedEntryUrls,
    requiredPdfUrl: exactBrowserInput.options.pdfUrl,
    requiredWorkerUrl: exactBrowserInput.options.workerUrl,
    requiredCloseTimeControlUrl: null,
  });
  let finishServedJavaScriptCapture: ReturnType<typeof captureServedJavaScript> | null = null;
  let result: Step7Gate3BrowserResult | null = null;
  let blankRunnerBefore: BlankRunnerState | null = null;
  let blankRunnerAfter: BlankRunnerState | null = null;
  let sourceExecution: Step7Gate3SourceExecutionBoundaryManifest | null = null;
  let servedJavaScript: ServedJavaScriptManifest | null = null;
  let sourceExecutionPartial: Step7Gate3UnverifiedSourceExecutionBoundarySnapshot | null = null;
  let servedJavaScriptPartial: Step7Gate3UnverifiedServedJavaScriptSnapshot | null = null;
  let executionPolicyControl: Step7Gate3ExecutionPolicyControl | null = null;
  let viteOrigin: string | null = null;
  let completed: {
    readonly result: Step7Gate3BrowserResult;
    readonly blankRunnerBefore: BlankRunnerState;
    readonly blankRunnerAfter: BlankRunnerState;
    readonly sourceExecution: Step7Gate3SourceExecutionBoundaryManifest;
    readonly servedJavaScript: ServedJavaScriptManifest;
    readonly executionPolicyControl: Step7Gate3ExecutionPolicyControl;
    readonly viteOrigin: string;
  } | null = null;
  let primaryFailure: Error | null = null;
  try {
    await sourceExecutionBoundary.install();
    await page.addInitScript(() => {
      Object.defineProperty(window, "WebSocket", { value: class {}, writable: true });
    });
    const runnerResponse = await page.goto("/__real_build_runner__");
    expect(runnerResponse?.headers()["content-security-policy"]).toBe(
      STEP7_GATE3_BLANK_RUNNER_CONTENT_SECURITY_POLICY,
    );
    blankRunnerBefore = await snapshotBlankRunnerState(page);
    expect(blankRunnerBefore).toEqual({
      title: "LEGO Gate-3 Blank Runner",
      scriptCount: 0,
      indexedDbNames: [],
      localStorageKeys: [],
      sessionStorageKeys: [],
      cacheNames: [],
      cookie: "",
      serviceWorkerScopes: [],
    });
    viteOrigin = new URL(page.url()).origin;
    expect(viteOrigin).toBe(expectedViteOrigin);
    finishServedJavaScriptCapture = captureServedJavaScript({
      page,
      expectedOrigin: viteOrigin,
      requiredEntryUrls: requiredServedEntryUrls,
      forbiddenUrlFragments: [SOURCE_RUN, "/cas/"],
      browserInputDigest,
    });
    executionPolicyControl = await runStep7Gate3HostExecutionPolicyControl(page, driverUrl, {
      authorizePreRouteCspControlRequests: (urls) =>
        sourceExecutionBoundary.authorizePreRouteCspControlRequests(urls),
    });
    expect(executionPolicyControl.moduleInitializationEvalBlocked).toBe(true);
    expect(executionPolicyControl.workerEvalBlocked).toBe(true);
    expect(executionPolicyControl.workerEvalFailureName).toBe("EvalError");
    expect(executionPolicyControl.workerSharedWorkerConstructorPresent).toBe(false);
    expect(executionPolicyControl.workerSharedWorkerBlocked).toBe(true);
    expect(executionPolicyControl.workerSharedWorkerFailureName).toBe("Unavailable");
    expect(executionPolicyControl.blobImportBlocked).toBe(true);
    expect(executionPolicyControl.dataImportBlocked).toBe(true);
    expect(executionPolicyControl.externalImportBlocked).toBe(true);
    expect(executionPolicyControl.violations).toEqual([
      {
        blockedUri: "blob",
        effectiveDirective: "script-src-elem",
        disposition: "enforce",
      },
      {
        blockedUri: "data",
        effectiveDirective: "script-src-elem",
        disposition: "enforce",
      },
      {
        blockedUri: STEP7_GATE3_EXTERNAL_IMPORT_CONTROL_URL,
        effectiveDirective: "script-src-elem",
        disposition: "enforce",
      },
    ]);
    expect(executionPolicyControl.cspImportControlUrls.dataUrl).toBe(
      STEP7_GATE3_DATA_IMPORT_CONTROL_URL,
    );
    expect(executionPolicyControl.cspImportControlUrls.externalUrl).toBe(
      STEP7_GATE3_EXTERNAL_IMPORT_CONTROL_URL,
    );
    expect(executionPolicyControl.serviceWorkerApiPresent).toBe(true);
    expect(executionPolicyControl.serviceWorkerRegistrationBlocked).toBe(true);
    expect(executionPolicyControl.serviceWorkerRegistrationFailureName).not.toBe("none");
    expect(executionPolicyControl.sharedWorkerConstructorPresent).toBe(true);
    expect(executionPolicyControl.sharedWorkerBlocked).toBe(true);
    expect(executionPolicyControl.sharedWorkerFailureName).toBe("SecurityError");
    result = (await page.evaluate(
      async ({ moduleUrl, input, expectedInputDigest }) => {
        const driver = await import(/* @vite-ignore */ moduleUrl);
        return driver.runStep7Gate3Diagnostic(input, expectedInputDigest);
      },
      { moduleUrl: driverUrl, input: exactBrowserInput, expectedInputDigest: browserInputDigest },
    )) as Step7Gate3BrowserResult;
    blankRunnerAfter = await snapshotBlankRunnerState(page);
    expect(blankRunnerAfter).toEqual(blankRunnerBefore);
    const closedObservers = await executeStep7Gate3PostResultObserverClosure({
      result,
      blankRunnerBefore,
      blankRunnerAfter,
      executionPolicyControl,
      viteOrigin,
      requestBoundary: sourceExecutionBoundary,
      responseCapture: finishServedJavaScriptCapture,
    });
    sourceExecution = closedObservers.sourceExecution;
    servedJavaScript = closedObservers.servedJavaScript;
    const closedSourceExecution = closedObservers.sourceExecution;
    const closedServedJavaScript = closedObservers.servedJavaScript;
    expect(closedSourceExecution.expectedOrigin).toBe(viteOrigin);
    expect(closedSourceExecution.blockedRequests).toBe(0);
    expect(closedSourceExecution.redirectResponses).toBe(0);
    expect(closedSourceExecution.observerClosure.preRouteCspControlFailures).toEqual([
      {
        control: "blob-import",
        absoluteRequestUrl: executionPolicyControl.cspImportControlUrls.blobUrl,
        method: "GET",
        resourceType: "script",
        failure: "csp",
        responseObserved: false,
        redirectObserved: false,
      },
      {
        control: "external-import",
        absoluteRequestUrl: executionPolicyControl.cspImportControlUrls.externalUrl,
        method: "GET",
        resourceType: "script",
        failure: "csp",
        responseObserved: false,
        redirectObserved: false,
      },
    ]);
    const boundaryJavaScriptUrls = closedSourceExecution.events
      .filter(
        ({ resourceKind }) =>
          resourceKind === "locked-source" ||
          resourceKind === "pdf-worker" ||
          resourceKind === "worker-control" ||
          resourceKind === "close-time-control",
      )
      .map(({ absoluteRequestUrl }) => absoluteRequestUrl)
      .sort((left, right) => left.localeCompare(right));
    const capturedJavaScriptUrls = closedServedJavaScript.responses
      .map(({ absoluteUrl }) => absoluteUrl)
      .sort((left, right) => left.localeCompare(right));
    expect(capturedJavaScriptUrls).toEqual(boundaryJavaScriptUrls);
    expect(closedSourceExecution.workerContentSecurityPolicy).toBe(
      STEP7_GATE3_PDF_WORKER_CONTENT_SECURITY_POLICY,
    );
    const workerResponseUrls = new Set([
      new URL(exactBrowserInput.options.workerUrl, viteOrigin).href,
      new URL("/__real_build_worker_control__.mjs", viteOrigin).href,
    ]);
    expect(
      closedServedJavaScript.responses
        .filter(({ absoluteUrl }) => workerResponseUrls.has(absoluteUrl))
        .map(({ contentSecurityPolicy }) => contentSecurityPolicy),
    ).toEqual([
      STEP7_GATE3_PDF_WORKER_CONTENT_SECURITY_POLICY,
      STEP7_GATE3_PDF_WORKER_CONTENT_SECURITY_POLICY,
    ]);

    const bootstrapAfter = readRequiredRealBuildBootstrapSourceManifest();
    assertRealBuildBootstrapSourceLockHeld();
    if (JSON.stringify(bootstrapAfter) !== JSON.stringify(bootstrapBefore)) {
      throw new TypeError("Gate-3 source manifest changed during the diagnostic run.");
    }
    completed = Object.freeze({
      result,
      blankRunnerBefore,
      blankRunnerAfter,
      sourceExecution: closedSourceExecution,
      servedJavaScript: closedServedJavaScript,
      executionPolicyControl,
      viteOrigin,
    });
  } catch (error) {
    primaryFailure = normalizedError(error);
    const priorCounterevidence = step7Gate3UnverifiedHostExecution(error);
    if (priorCounterevidence !== null) {
      result ??= priorCounterevidence.result;
      blankRunnerBefore ??= priorCounterevidence.blankRunnerBefore;
      blankRunnerAfter ??= priorCounterevidence.blankRunnerAfter;
      sourceExecution ??= priorCounterevidence.sourceExecution;
      servedJavaScript ??= priorCounterevidence.servedJavaScript;
      sourceExecutionPartial ??= priorCounterevidence.sourceExecutionPartial;
      servedJavaScriptPartial ??= priorCounterevidence.servedJavaScriptPartial;
      executionPolicyControl ??= priorCounterevidence.executionPolicyControl;
      viteOrigin ??= priorCounterevidence.viteOrigin;
    }
  }
  const cleanupFailures: Error[] = [];
  try {
    await sourceExecutionBoundary.quiesce();
  } catch (error) {
    cleanupFailures.push(normalizedError(error));
  }
  const cleanupOutcomes = await Promise.allSettled([
    finishServedJavaScriptCapture?.dispose() ?? Promise.resolve(),
    sourceExecutionBoundary.dispose(),
  ]);
  cleanupFailures.push(
    ...cleanupOutcomes
      .filter((outcome) => outcome.status === "rejected")
      .map((outcome) => normalizedError(outcome.reason)),
  );
  sourceExecutionPartial ??= sourceExecutionBoundary.snapshotUnverified();
  servedJavaScriptPartial ??= finishServedJavaScriptCapture?.snapshotUnverified() ?? null;
  if (cleanupFailures.length > 0) {
    primaryFailure = new AggregateError(
      primaryFailure === null ? cleanupFailures : [primaryFailure, ...cleanupFailures],
      primaryFailure === null
        ? `Gate-3 browser observer cleanup recorded ${cleanupFailures.length} failures.`
        : `${primaryFailure.message} Cleanup also recorded ${cleanupFailures.length} failures.`,
    );
  }
  if (primaryFailure !== null) {
    const unverifiedExecution = Object.freeze({
      schemaVersion: "lego.step7-gate3-unverified-host-execution/1" as const,
      verification: "unverified-counterevidence" as const,
      result,
      blankRunnerBefore,
      blankRunnerAfter,
      sourceExecution,
      servedJavaScript,
      sourceExecutionPartial,
      servedJavaScriptPartial,
      executionPolicyControl,
      viteOrigin,
    });
    throw new Step7Gate3HostExecutionError(
      boundedMessage(
        `Gate-3 browser execution failed with bounded unverified counterevidence: ${primaryFailure.message}`,
      ),
      unverifiedExecution,
      { cause: primaryFailure },
    );
  }
  if (completed === null) {
    throw new TypeError("Gate-3 host execution completed without a result or recorded failure.");
  }
  return completed;
}

export type ExecutedStep7Gate3HostRun = Awaited<ReturnType<typeof executeStep7Gate3HostRun>>;
