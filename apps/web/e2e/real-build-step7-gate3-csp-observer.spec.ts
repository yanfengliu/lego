import { resolve } from "node:path";

import { expect, test } from "@playwright/test";

import {
  createStep7Gate3SourceExecutionBoundary,
  STEP7_GATE3_BLANK_RUNNER_CONTENT_SECURITY_POLICY,
} from "./real-build-step7-gate3-diagnostic-source";
import {
  runStep7Gate3HostExecutionPolicyControl,
  STEP7_GATE3_EXTERNAL_IMPORT_CONTROL_URL,
} from "./real-build-step7-gate3-host-policy-control";
import { drainStep7Gate3ObserverFrontier } from "./real-build-step7-gate3-observer-closure";
import { captureServedJavaScript } from "./real-build-step7-gate3-served-source";
import { workspaceModuleUrl } from "./workspace-module";

const POLICY_PATH = "apps/web/e2e/real-build-production-policy.ts";
const POLICY_URL = "/e2e/real-build-production-policy.ts";
const VITE_CLIENT_PATH = "node_modules/vite/dist/client/client.mjs";
const VITE_ENV_PATH = "node_modules/vite/dist/client/env.mjs";
const PDF_WORKER_PATH = "node_modules/pdfjs-dist/build/pdf.worker.mjs";
const UNEXPECTED_CSP_URL = "https://gate3-unexpected.invalid/extra-module.js";

const exactOrigin = (baseURL: string | undefined): string => {
  if (baseURL === undefined) throw new TypeError("Playwright baseURL is required.");
  return new URL(baseURL).origin;
};

const createBoundary = (
  page: Parameters<typeof createStep7Gate3SourceExecutionBoundary>[0]["page"],
  expectedOrigin: string,
  workerUrl: string,
) =>
  createStep7Gate3SourceExecutionBoundary({
    page,
    expectedOrigin,
    repoRoot: resolve(process.cwd()),
    bootstrapSourceManifestDigest: `sha256:${"0".repeat(64)}`,
    allowedSourcePaths: [POLICY_PATH, PDF_WORKER_PATH, VITE_CLIENT_PATH, VITE_ENV_PATH],
    requiredEntryUrls: [POLICY_URL, workerUrl],
    requiredPdfUrl: null,
    requiredWorkerUrl: workerUrl,
    requiredCloseTimeControlUrl: null,
    forbiddenUrlFragments: ["/output/", "/cas/"],
  });

const loadExactWorker = (page: Parameters<typeof createBoundary>[0], workerUrl: string) =>
  page.evaluate(
    async (exactWorkerUrl) =>
      new Promise<void>((resolveWorker, rejectWorker) => {
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
      }),
    workerUrl,
  );

test("accounts for only the two exact pre-route CSP import controls", async ({ page, baseURL }) => {
  const expectedOrigin = exactOrigin(baseURL);
  const workerUrl = workspaceModuleUrl(PDF_WORKER_PATH);
  const boundary = createBoundary(page, expectedOrigin, workerUrl);
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
      requiredEntryUrls: [POLICY_URL, workerUrl],
      forbiddenUrlFragments: ["/output/", "/cas/"],
      browserInputDigest: `sha256:${"1".repeat(64)}`,
    });
    const control = await runStep7Gate3HostExecutionPolicyControl(page, POLICY_URL, {
      authorizePreRouteCspControlRequests: (urls) =>
        boundary.authorizePreRouteCspControlRequests(urls),
    });
    await loadExactWorker(page, workerUrl);
    expect(control.violations).toEqual([
      { blockedUri: "blob", effectiveDirective: "script-src-elem", disposition: "enforce" },
      { blockedUri: "data", effectiveDirective: "script-src-elem", disposition: "enforce" },
      {
        blockedUri: STEP7_GATE3_EXTERNAL_IMPORT_CONTROL_URL,
        effectiveDirective: "script-src-elem",
        disposition: "enforce",
      },
    ]);
    await drainStep7Gate3ObserverFrontier({ requestBoundary: boundary, responseCapture: capture });
    await boundary.quiesce();
    const [sourceExecution, servedJavaScript] = await Promise.all([boundary.finish(), capture()]);
    const observer = sourceExecution.observerClosure;
    expect(observer.observedRequests).toBe(observer.routedRequests + 2);
    expect(observer.uniqueObservedRequests).toBe(observer.observedRequests);
    expect(observer.pendingRoutes).toBe(0);
    expect(observer.preRouteCspControlFailures).toEqual([
      {
        control: "blob-import",
        absoluteRequestUrl: control.cspImportControlUrls.blobUrl,
        method: "GET",
        resourceType: "script",
        failure: "csp",
        responseObserved: false,
        redirectObserved: false,
      },
      {
        control: "external-import",
        absoluteRequestUrl: control.cspImportControlUrls.externalUrl,
        method: "GET",
        resourceType: "script",
        failure: "csp",
        responseObserved: false,
        redirectObserved: false,
      },
    ]);
    expect(
      sourceExecution.events
        .filter(({ resourceKind }) =>
          ["locked-source", "pdf-worker", "worker-control", "close-time-control"].includes(
            resourceKind,
          ),
        )
        .map(({ absoluteRequestUrl }) => absoluteRequestUrl)
        .sort(),
    ).toEqual(servedJavaScript.responses.map(({ absoluteUrl }) => absoluteUrl).sort());
  } finally {
    await Promise.allSettled([capture?.dispose() ?? Promise.resolve(), boundary.dispose()]);
  }
});

test("keeps every additional CSP-blocked request fatal and makes disposal idempotent", async ({
  page,
  baseURL,
}) => {
  const expectedOrigin = exactOrigin(baseURL);
  const workerUrl = workspaceModuleUrl(PDF_WORKER_PATH);
  const boundary = createBoundary(page, expectedOrigin, workerUrl);
  await boundary.install();
  try {
    await page.goto("/__real_build_runner__");
    await runStep7Gate3HostExecutionPolicyControl(page, POLICY_URL, {
      authorizePreRouteCspControlRequests: (urls) =>
        boundary.authorizePreRouteCspControlRequests(urls),
    });
    await loadExactWorker(page, workerUrl);
    await page.evaluate(async (url) => {
      try {
        await import(/* @vite-ignore */ url);
      } catch {
        // The source lifecycle, not the page rejection, owns this negative control.
      }
      await new Promise<void>((resolveControl) => setTimeout(resolveControl, 0));
    }, UNEXPECTED_CSP_URL);
    await boundary.quiesce();
    await expect(boundary.finish()).rejects.toThrow(
      new RegExp(`unaccounted observed request.*${UNEXPECTED_CSP_URL.replaceAll(".", "\\.")}`, "u"),
    );
    expect(boundary.snapshotUnverified().observerLifecycle).toMatchObject({
      observedRequests: expect.any(Number),
      routedRequests: expect.any(Number),
      preRouteCspControlFailures: [
        { control: "blob-import", failure: "csp" },
        { control: "external-import", failure: "csp" },
      ],
    });
    await expect(boundary.dispose()).resolves.toBeUndefined();
    await expect(boundary.dispose()).resolves.toBeUndefined();
  } finally {
    await boundary.dispose().catch(() => undefined);
  }
});

test("refuses CSP control requests that were authorized only after observation", async ({
  page,
  baseURL,
}) => {
  const expectedOrigin = exactOrigin(baseURL);
  const workerUrl = workspaceModuleUrl(PDF_WORKER_PATH);
  const boundary = createBoundary(page, expectedOrigin, workerUrl);
  await boundary.install();
  try {
    await page.goto("/__real_build_runner__");
    const control = await runStep7Gate3HostExecutionPolicyControl(page, POLICY_URL);
    boundary.authorizePreRouteCspControlRequests(control.cspImportControlUrls);
    await loadExactWorker(page, workerUrl);
    await boundary.quiesce();
    await expect(boundary.finish()).rejects.toThrow(/observed before it was authorized/u);
  } finally {
    await boundary.dispose().catch(() => undefined);
  }
});
