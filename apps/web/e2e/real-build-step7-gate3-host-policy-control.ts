import type { Page } from "@playwright/test";

import { runStep7Gate3WorkerExecutionPolicyControl } from "./real-build-step7-gate3-worker-policy";

export const STEP7_GATE3_DATA_IMPORT_CONTROL_URL =
  "data:text/javascript,export default 'gate3-data-control'";
export const STEP7_GATE3_EXTERNAL_IMPORT_CONTROL_URL =
  "https://gate3-control.invalid/external-module.js";

export interface Step7Gate3CspImportControlUrls {
  readonly blobUrl: string;
  readonly dataUrl: typeof STEP7_GATE3_DATA_IMPORT_CONTROL_URL;
  readonly externalUrl: typeof STEP7_GATE3_EXTERNAL_IMPORT_CONTROL_URL;
}

export interface Step7Gate3ContextIsolationControl {
  readonly serviceWorkerApiPresent: boolean;
  readonly serviceWorkerRegistrationBlocked: boolean;
  readonly serviceWorkerRegistrationFailureName: string;
  readonly sharedWorkerConstructorPresent: boolean;
  readonly sharedWorkerBlocked: boolean;
  readonly sharedWorkerFailureName: string;
}

export interface Step7Gate3ExecutionPolicyControl extends Step7Gate3ContextIsolationControl {
  readonly moduleInitializationEvalBlocked: boolean;
  readonly workerEvalBlocked: boolean;
  readonly workerEvalFailureName: string;
  readonly workerSharedWorkerConstructorPresent: boolean;
  readonly workerSharedWorkerBlocked: boolean;
  readonly workerSharedWorkerFailureName: string;
  readonly blobImportBlocked: boolean;
  readonly dataImportBlocked: boolean;
  readonly externalImportBlocked: boolean;
  readonly cspImportControlUrls: Step7Gate3CspImportControlUrls;
  readonly violations: readonly {
    readonly blockedUri: string;
    readonly effectiveDirective: string;
    readonly disposition: string;
  }[];
}

export async function runStep7Gate3ContextIsolationControl(
  page: Page,
  serviceWorkerScriptUrl: string,
): Promise<Step7Gate3ContextIsolationControl> {
  return page.evaluate(async (scriptUrl) => {
    const failureName = (error: unknown): string =>
      error instanceof Error ? error.name : "non-Error rejection";
    const serviceWorkerApiPresent = "serviceWorker" in navigator;
    let serviceWorkerRegistrationBlocked = false;
    let serviceWorkerRegistrationFailureName = "none";
    try {
      const registration = await navigator.serviceWorker.register(scriptUrl, { type: "module" });
      await registration.unregister();
    } catch (error) {
      serviceWorkerRegistrationBlocked = true;
      serviceWorkerRegistrationFailureName = failureName(error);
    }
    const sharedWorkerConstructorPresent = typeof SharedWorker === "function";
    let sharedWorkerBlocked = false;
    let sharedWorkerFailureName = "none";
    try {
      const worker = new SharedWorker(scriptUrl, { type: "module" });
      worker.port.close();
    } catch (error) {
      sharedWorkerBlocked = true;
      sharedWorkerFailureName = failureName(error);
    }
    return {
      serviceWorkerApiPresent,
      serviceWorkerRegistrationBlocked,
      serviceWorkerRegistrationFailureName,
      sharedWorkerConstructorPresent,
      sharedWorkerBlocked,
      sharedWorkerFailureName,
    };
  }, serviceWorkerScriptUrl);
}

export async function runStep7Gate3HostExecutionPolicyControl(
  page: Page,
  driverUrl: string,
  options?: {
    readonly authorizePreRouteCspControlRequests?: (urls: Step7Gate3CspImportControlUrls) => void;
  },
): Promise<Step7Gate3ExecutionPolicyControl> {
  const workerControl = await runStep7Gate3WorkerExecutionPolicyControl(page);
  const moduleInitializationEvalBlocked = await page.evaluate(async (moduleUrl) => {
    const driver = await import(/* @vite-ignore */ moduleUrl);
    return driver.STEP7_GATE3_MODULE_INITIALIZATION_EVAL_BLOCKED as boolean;
  }, driverUrl);
  const preparedControlUrls = await page.evaluate(
    ({ dataUrl, externalUrl }) => ({
      blobUrl: URL.createObjectURL(
        new Blob(["export default 'gate3-blob-control';"], { type: "text/javascript" }),
      ),
      dataUrl,
      externalUrl,
    }),
    {
      dataUrl: STEP7_GATE3_DATA_IMPORT_CONTROL_URL,
      externalUrl: STEP7_GATE3_EXTERNAL_IMPORT_CONTROL_URL,
    },
  );
  if (
    typeof preparedControlUrls.blobUrl !== "string" ||
    preparedControlUrls.dataUrl !== STEP7_GATE3_DATA_IMPORT_CONTROL_URL ||
    preparedControlUrls.externalUrl !== STEP7_GATE3_EXTERNAL_IMPORT_CONTROL_URL
  ) {
    throw new TypeError("Gate-3 browser prepared malformed CSP import control URLs.");
  }
  const cspImportControlUrls: Step7Gate3CspImportControlUrls = Object.freeze({
    blobUrl: preparedControlUrls.blobUrl,
    dataUrl: STEP7_GATE3_DATA_IMPORT_CONTROL_URL,
    externalUrl: STEP7_GATE3_EXTERNAL_IMPORT_CONTROL_URL,
  });
  try {
    options?.authorizePreRouteCspControlRequests?.(cspImportControlUrls);
  } catch (error) {
    await page.evaluate((blobUrl) => URL.revokeObjectURL(blobUrl), cspImportControlUrls.blobUrl);
    throw error;
  }
  const browserControl = await page.evaluate(async (controlUrls) => {
    const violations: {
      blockedUri: string;
      effectiveDirective: string;
      disposition: string;
    }[] = [];
    const listener = (event: SecurityPolicyViolationEvent): void => {
      if (violations.length < 32) {
        violations.push({
          blockedUri: event.blockedURI,
          effectiveDirective: event.effectiveDirective,
          disposition: event.disposition,
        });
      }
    };
    document.addEventListener("securitypolicyviolation", listener);
    const blockedImport = async (url: string): Promise<boolean> => {
      try {
        await import(/* @vite-ignore */ url);
        return false;
      } catch {
        return true;
      }
    };
    try {
      const blobImportBlocked = await blockedImport(controlUrls.blobUrl);
      const dataImportBlocked = await blockedImport(controlUrls.dataUrl);
      const externalImportBlocked = await blockedImport(controlUrls.externalUrl);
      await new Promise<void>((resolveControl) => setTimeout(resolveControl, 0));
      return { blobImportBlocked, dataImportBlocked, externalImportBlocked, violations };
    } finally {
      URL.revokeObjectURL(controlUrls.blobUrl);
      document.removeEventListener("securitypolicyviolation", listener);
    }
  }, cspImportControlUrls);
  const contextControl = await runStep7Gate3ContextIsolationControl(page, driverUrl);
  return Object.freeze({
    moduleInitializationEvalBlocked,
    workerEvalBlocked: workerControl.evalBlocked,
    workerEvalFailureName: workerControl.evalFailureName,
    workerSharedWorkerConstructorPresent: workerControl.sharedWorkerConstructorPresent,
    workerSharedWorkerBlocked: workerControl.sharedWorkerBlocked,
    workerSharedWorkerFailureName: workerControl.sharedWorkerFailureName,
    ...browserControl,
    cspImportControlUrls: Object.freeze(cspImportControlUrls),
    ...contextControl,
  });
}
