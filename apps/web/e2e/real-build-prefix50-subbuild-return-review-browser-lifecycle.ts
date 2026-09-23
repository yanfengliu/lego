import { open } from "node:fs/promises";
import { createServer } from "node:net";
import { type Readable } from "node:stream";

import { chromium, type Browser, type BrowserContext, type Page } from "playwright";

import { installRealBuildStep44CalibrationRequestPolicy } from "./real-build-prefix50-step44-calibration-request-policy.ts";

import {
  spawnRealBuildPrefix50Step44OwnedProcess,
  stopRealBuildPrefix50Step44OwnedProcessTree,
  type RealBuildPrefix50Step44OwnedProcessTree,
} from "./real-build-prefix50-subbuild-return-review-process.ts";

export interface RealBuildPrefix50Step44BrowserLifecycleCleanup {
  readonly browserClosed: boolean;
  readonly browserProcessTreeClosed: boolean;
  readonly serverClosed: boolean;
}

export type RealBuildPrefix50Step44BrowserLifecycleResult<T> =
  | Readonly<{
      status: "complete";
      value: T;
      cleanup: RealBuildPrefix50Step44BrowserLifecycleCleanup;
    }>
  | Readonly<{
      status: "failed";
      primaryError: unknown;
      cleanupErrors: readonly unknown[];
      cleanup: RealBuildPrefix50Step44BrowserLifecycleCleanup;
    }>;

async function freePort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolveListen, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolveListen);
  });
  const address = server.address();
  if (address === null || typeof address === "string")
    throw new Error("Could not reserve a local port.");
  await new Promise<void>((resolveClose, reject) =>
    server.close((error) => (error === undefined ? resolveClose() : reject(error))),
  );
  return address.port;
}

async function waitForServer(
  url: string,
  tree: RealBuildPrefix50Step44OwnedProcessTree,
): Promise<void> {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (tree.workloadError !== null)
      throw new Error(`Task-owned static app server could not launch: ${tree.workloadError}.`);
    if (tree.workloadExited)
      throw new Error(
        `Task-owned static app server workload PID ${String(tree.workloadPid)} exited before readiness.`,
      );
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // The exact task-owned child remains alive; retry within the bounded startup window.
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 100));
  }
  throw new Error(`Task-owned static app server did not become ready within 30000ms at ${url}.`);
}

async function readBrowserEndpoint(
  output: Readable,
  tree: RealBuildPrefix50Step44OwnedProcessTree,
): Promise<string> {
  let buffered = "";
  return new Promise<string>((resolveEndpoint, rejectEndpoint) => {
    const timer = setTimeout(() => {
      cleanup();
      rejectEndpoint(
        new Error(
          `Task-owned Playwright browser worker did not report its endpoint in 30000ms; exited=${String(tree.workloadExited)}, error=${String(tree.workloadError)}.`,
        ),
      );
    }, 30_000);
    timer.unref();
    const cleanup = (): void => {
      clearTimeout(timer);
      output.off("data", onData);
      output.off("end", onEnd);
      output.off("error", onError);
    };
    const onData = (chunk: Buffer | string): void => {
      buffered += chunk.toString();
      if (buffered.length > 8_192) {
        cleanup();
        rejectEndpoint(new RangeError("Task-owned Playwright endpoint output exceeded 8 KiB."));
        return;
      }
      const newline = buffered.indexOf("\n");
      if (newline < 0) return;
      const line = buffered.slice(0, newline).trimEnd();
      const match =
        /^STEP44_BROWSER_WS:(ws:\/\/(?:127\.0\.0\.1|localhost|\[::1\]):\d+\/[A-Za-z0-9_-]+)$/u.exec(
          line,
        );
      cleanup();
      if (match?.[1] === undefined)
        rejectEndpoint(new Error(`Task-owned Playwright browser worker returned ${line}.`));
      else resolveEndpoint(match[1]);
    };
    const onEnd = (): void => {
      cleanup();
      rejectEndpoint(new Error("Task-owned Playwright browser worker ended before its endpoint."));
    };
    const onError = (error: Error): void => {
      cleanup();
      rejectEndpoint(error);
    };
    output.on("data", onData);
    output.once("end", onEnd);
    output.once("error", onError);
  });
}

export function realBuildPrefix50Step44BrowserLifecycleError(
  result: Extract<RealBuildPrefix50Step44BrowserLifecycleResult<unknown>, { status: "failed" }>,
): AggregateError {
  return new AggregateError(
    [result.primaryError, ...result.cleanupErrors].filter((error) => error !== null),
    `Step-44 review browser lifecycle failed or did not close every task-owned process: ${JSON.stringify(result.cleanup)}.`,
  );
}

interface BrowserLifecycleInput<T> {
  readonly serverLogPath: string;
  readonly execute: (runtime: {
    readonly page: Page;
    readonly browser: Browser;
    readonly appUrl: string;
  }) => Promise<T>;
}

export function runRealBuildPrefix50Step44BrowserLifecycle<T>(
  input: BrowserLifecycleInput<T>,
): Promise<RealBuildPrefix50Step44BrowserLifecycleResult<T>> {
  return runBrowserLifecycle({ ...input, execute: (runtime) => input.execute(runtime) }, false);
}

export function runRealBuildPrefix50Step44CalibrationBrowserLifecycle<T>(input: {
  readonly serverLogPath: string;
  readonly execute: (runtime: { readonly page: Page; readonly appUrl: string }) => Promise<T>;
}): Promise<RealBuildPrefix50Step44BrowserLifecycleResult<T>> {
  return runBrowserLifecycle(
    { ...input, execute: ({ page, appUrl }) => input.execute({ page, appUrl }) },
    true,
  );
}

interface GuardedPageRuntime {
  readonly page: Page;
  readonly appUrl: string;
}

export function runRealBuildPrefix50Step44TwoPhaseCalibrationBrowserLifecycle<C, T>(input: {
  readonly serverLogPath: string;
  readonly calibrate: (runtime: GuardedPageRuntime) => Promise<C>;
  readonly afterCalibrationClosed: (
    calibration: C,
  ) => Promise<
    | Readonly<{ status: "complete"; value: T }>
    | Readonly<{ status: "validate"; execute: (runtime: GuardedPageRuntime) => Promise<T> }>
  >;
}): Promise<RealBuildPrefix50Step44BrowserLifecycleResult<T>> {
  return runBrowserLifecycle(
    {
      serverLogPath: input.serverLogPath,
      execute: async ({ page, appUrl }, contexts) => {
        const calibration = await input.calibrate({ page, appUrl });
        await contexts.closeAndFinish();
        // No calibration context remains alive while the trusted transition consumes its session.
        const transition = await input.afterCalibrationClosed(calibration);
        if (transition.status === "complete") return transition.value;
        return transition.execute({ page: await contexts.createPage(), appUrl });
      },
    },
    true,
  );
}

interface GuardedContextControls {
  readonly closeAndFinish: () => Promise<void>;
  readonly createPage: () => Promise<Page>;
}

async function runBrowserLifecycle<T>(
  input: {
    readonly serverLogPath: string;
    readonly execute: (
      runtime: { readonly page: Page; readonly browser: Browser; readonly appUrl: string },
      contexts: GuardedContextControls,
    ) => Promise<T>;
  },
  calibration: boolean,
): Promise<RealBuildPrefix50Step44BrowserLifecycleResult<T>> {
  let serverTree: RealBuildPrefix50Step44OwnedProcessTree | null = null;
  let browserTree: RealBuildPrefix50Step44OwnedProcessTree | null = null;
  let browser: Browser | null = null;
  const guarded: {
    context: BrowserContext | null;
    policy: Awaited<ReturnType<typeof installRealBuildStep44CalibrationRequestPolicy>> | null;
  } = { context: null, policy: null };
  let log: Awaited<ReturnType<typeof open>> | null = null;
  let value: T | undefined;
  let primaryError: unknown = null;
  const cleanupErrors: unknown[] = [];
  let browserClosed = false;
  let browserProcessTreeClosed = false;
  let serverClosed = false;
  try {
    log = await open(input.serverLogPath, "wx");
    const port = await freePort();
    const appUrl = `http://127.0.0.1:${port}/`;
    serverTree = await spawnRealBuildPrefix50Step44OwnedProcess({
      job: {
        jobKind: "static-app-server",
        port,
      },
      stdout: log.fd,
      stderr: log.fd,
    });
    await waitForServer(appUrl, serverTree);
    browserTree = await spawnRealBuildPrefix50Step44OwnedProcess({
      job: { jobKind: "playwright-browser-worker" },
      stdout: "pipe",
      stderr: log.fd,
    });
    if (browserTree.root.stdout === null)
      throw new Error("Task-owned Playwright browser worker has no endpoint stream.");
    const wsEndpoint = await readBrowserEndpoint(browserTree.root.stdout, browserTree);
    browser = await chromium.connect(wsEndpoint);
    const contexts: GuardedContextControls = {
      closeAndFinish: async () => {
        if (guarded.context === null || guarded.policy === null)
          throw new Error("Calibration transition requires its current guarded context.");
        await guarded.context.close();
        await guarded.policy.finish();
        guarded.context = null;
        guarded.policy = null;
      },
      createPage: async () => {
        if (browser === null || guarded.context !== null || guarded.policy !== null)
          throw new Error(
            "Calibration page creation requires no live preceding context or policy.",
          );
        guarded.context = await browser.newContext({
          viewport: { width: 1280, height: 720 },
          serviceWorkers: "block",
        });
        guarded.policy = await installRealBuildStep44CalibrationRequestPolicy(
          guarded.context,
          appUrl,
        );
        const page = await guarded.context.newPage();
        await page.goto(appUrl);
        await page.waitForFunction(() => typeof window.get_model_snapshot === "function");
        return page;
      },
    };
    const page = calibration
      ? await contexts.createPage()
      : await browser.newPage({ viewport: { width: 1280, height: 720 } });
    if (!calibration) {
      await page.goto(appUrl);
      await page.waitForFunction(() => typeof window.get_model_snapshot === "function");
    }
    value = await input.execute({ page, browser, appUrl }, contexts);
  } catch (error) {
    primaryError = error;
  } finally {
    if (guarded.context !== null)
      try {
        await guarded.context.close();
      } catch (error) {
        cleanupErrors.push(error);
      }
    if (browser !== null) {
      try {
        await browser.close();
        browserClosed = !browser.isConnected();
      } catch (error) {
        cleanupErrors.push(error);
      }
    } else browserClosed = true;
    try {
      browserProcessTreeClosed = await stopRealBuildPrefix50Step44OwnedProcessTree(browserTree);
    } catch (error) {
      cleanupErrors.push(error);
    }
    try {
      serverClosed = await stopRealBuildPrefix50Step44OwnedProcessTree(serverTree);
    } catch (error) {
      cleanupErrors.push(error);
    }
    if (log !== null)
      try {
        await log.close();
      } catch (error) {
        cleanupErrors.push(error);
      }
  }
  if (guarded.policy !== null)
    try {
      await guarded.policy.finish();
    } catch (error) {
      if (primaryError !== null)
        cleanupErrors.push(
          new Error(
            "Calibration callback also failed; details withheld after request-policy refusal.",
          ),
        );
      // Navigation errors include the refused URL. Preserve the bounded policy indication only.
      primaryError = error;
    }
  const cleanup = { browserClosed, browserProcessTreeClosed, serverClosed };
  if (
    primaryError !== null ||
    cleanupErrors.length > 0 ||
    !browserClosed ||
    !browserProcessTreeClosed ||
    !serverClosed
  )
    return {
      status: "failed",
      primaryError,
      cleanupErrors,
      cleanup,
    };
  return { status: "complete", value: value as T, cleanup };
}
