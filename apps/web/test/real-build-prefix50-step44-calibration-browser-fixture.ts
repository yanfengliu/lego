import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { connect, type Socket } from "node:net";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { PassThrough } from "node:stream";

import { chromium, type Browser, type BrowserContext, type Page, type Route } from "playwright";
import { vi } from "vitest";

import * as ownedProcess from "../e2e/real-build-prefix50-subbuild-return-review-process.ts";

export async function calibrationPolicyOutput(name: string): Promise<string> {
  const parent = resolve(
    process.env.LEGO_STEP44_CALIBRATION_POLICY_TEST_OUTPUT ?? "output/calibration-browser-policy",
  );
  await mkdir(parent, { recursive: true });
  return mkdtemp(resolve(parent, `${name}-`));
}

export async function writeCalibrationPolicyEvidence(
  output: string,
  value: unknown,
): Promise<void> {
  await writeFile(resolve(output, "result.json"), `${JSON.stringify(value, null, 2)}\n`, {
    flag: "wx",
  });
}

// A real owned canary is proved reachable through Node before browser probes. Its
// counters distinguish policy interception from CORS, DNS, or an absent listener.
export async function calibrationPolicyCanary() {
  const sockets = new Set<Socket>();
  let httpHits = 0;
  let upgradeHits = 0;
  let closed = false;
  const marker = "owned-calibration-loopback-sentinel";
  const server = createServer((_request, response) => {
    httpHits += 1;
    response.writeHead(200, {
      "Access-Control-Allow-Origin": "*",
      "Content-Type": "text/plain",
    });
    response.end(marker);
  });
  server.on("connection", (socket) => {
    sockets.add(socket);
    socket.once("close", () => sockets.delete(socket));
  });
  server.on("upgrade", (request, socket) => {
    upgradeHits += 1;
    const accept = createHash("sha1")
      .update(`${request.headers["sec-websocket-key"]}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`)
      .digest("base64");
    socket.write(
      `HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n\r\n`,
    );
  });
  await new Promise<void>((ready, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", ready);
  });
  const address = server.address();
  if (address === null || typeof address === "string") throw new Error("Canary port unavailable.");
  const url = `http://127.0.0.1:${address.port}/sentinel`;
  const close = async (): Promise<void> => {
    const closing = new Promise<void>((done, reject) =>
      server.close((error) => (error === undefined ? done() : reject(error))),
    );
    for (const socket of sockets) socket.destroy();
    await closing;
    closed = !server.listening;
  };
  try {
    const response = await fetch(url);
    if ((await response.text()) !== marker || httpHits !== 1)
      throw new Error("Owned HTTP canary failed its independent positive control.");
    await new Promise<void>((done, reject) => {
      const socket = connect(address.port, "127.0.0.1");
      const timer = setTimeout(() => {
        socket.destroy();
        reject(new Error("Owned WebSocket canary positive control timed out."));
      }, 5000);
      socket.once("error", reject);
      socket.once("close", () => clearTimeout(timer));
      socket.once("connect", () => {
        socket.write(
          "GET /sentinel HTTP/1.1\r\nHost: 127.0.0.1\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: c3ludGhldGljc2VudGluZWw=\r\nSec-WebSocket-Version: 13\r\n\r\n",
        );
      });
      socket.once("data", (bytes) => {
        socket.destroy();
        if (bytes.toString().startsWith("HTTP/1.1 101") && upgradeHits === 1) done();
        else reject(new Error("Owned WebSocket canary failed its positive control."));
      });
    });
    httpHits = 0;
    upgradeHits = 0;
    return {
      url,
      marker,
      proof: { http: true, websocket: true },
      counts: () => ({ httpHits, upgradeHits, closed }),
      close,
    };
  } catch (error) {
    await close();
    throw error;
  }
}

export async function calibrationPolicyFileSentinel(output: string) {
  const path = resolve(output, "owned-file-sentinel.txt");
  const marker = "owned-calibration-file-sentinel";
  await writeFile(path, marker, { flag: "wx" });
  if ((await readFile(path, "utf8")) !== marker)
    throw new Error("Owned file sentinel failed independent positive read.");
  return { url: pathToFileURL(path).href, marker, proof: true };
}

export function calibrationPhaseDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

// Synthetic transport only: runs the real lifecycle and unchanged policy with fake
// Playwright/process endpoints. No opaque source capability or real process is fabricated.
export function mockCalibrationPhaseTransport(
  failure?: "context-close" | "browser-close" | "browser-tree" | "server",
) {
  const events: string[] = [];
  const contexts: { page: Page; request: () => Promise<void> }[] = [];
  let connected = true;
  const browser = {
    newContext: async (options: unknown) => {
      if (
        JSON.stringify(options) !==
        JSON.stringify({ viewport: { width: 1280, height: 720 }, serviceWorkers: "block" })
      )
        throw new Error("Unexpected synthetic context options.");
      const index = contexts.length + 1;
      events.push(`context-${index}`);
      let closed = false;
      let handler!: (route: Route) => Promise<void>;
      const page = {
        goto: async () => {},
        waitForFunction: async () => {},
        isClosed: () => closed,
        context: () => context,
      } as unknown as Page;
      const context = {
        route: async (_pattern: string, callback: typeof handler) => {
          handler = callback;
        },
        routeWebSocket: async () => {},
        newPage: async () => page,
        pages: () => (closed ? [] : [page]),
        close: async () => {
          events.push(`close-${index}`);
          if (index === 1 && failure === "context-close")
            throw new Error("Synthetic context close failed.");
          closed = true;
        },
      } as unknown as BrowserContext;
      contexts.push({
        page,
        request: () =>
          handler({
            request: () => ({
              url: () => "http://127.0.0.1:1/sentinel",
              method: () => "GET",
              allHeaders: async () => ({}),
            }),
            abort: async () => {
              events.push("policy-abort");
            },
          } as unknown as Route),
      });
      return context;
    },
    close: async () => {
      events.push("browser-close");
      if (failure === "browser-close") throw new Error("Synthetic browser close failed.");
      connected = false;
    },
    isConnected: () => connected,
  } as unknown as Browser;
  vi.spyOn(chromium, "connect").mockResolvedValue(browser);
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response("ready")),
  );
  vi.spyOn(ownedProcess, "spawnRealBuildPrefix50Step44OwnedProcess").mockImplementation(
    async ({ job }) => {
      events.push(`spawn-${job.jobKind}`);
      const stream = new PassThrough();
      if (job.jobKind === "playwright-browser-worker")
        setTimeout(() => stream.end("STEP44_BROWSER_WS:ws://127.0.0.1:12345/synthetic\n"), 0);
      return {
        root: { stdout: stream },
        workloadExited: false,
        workloadError: null,
        jobKind: job.jobKind,
      } as unknown as ownedProcess.RealBuildPrefix50Step44OwnedProcessTree;
    },
  );
  vi.spyOn(ownedProcess, "stopRealBuildPrefix50Step44OwnedProcessTree").mockImplementation(
    async (tree) => {
      const kind = (tree as unknown as { jobKind: string } | null)?.jobKind;
      events.push(`stop-${kind}`);
      return !(
        (failure === "browser-tree" && kind === "playwright-browser-worker") ||
        (failure === "server" && kind === "static-app-server")
      );
    },
  );
  return { events, contexts };
}

// Instrument a real routed request at the public Playwright API before the policy
// sees it. The policy still owns classification/abort and tracks this pending handler.
export function holdFirstCalibrationRequestMetadata() {
  const started = calibrationPhaseDeferred<void>();
  const contextClosed = calibrationPhaseDeferred<void>();
  const release = calibrationPhaseDeferred<void>();
  let contextCount = 0;
  const connectBrowser = chromium.connect.bind(chromium);
  vi.spyOn(chromium, "connect").mockImplementation(async (...args) => {
    const browser = await connectBrowser(...args);
    const newContext = browser.newContext.bind(browser);
    vi.spyOn(browser, "newContext").mockImplementation(async (options) => {
      const context = await newContext(options);
      contextCount += 1;
      if (contextCount !== 1) return context;
      const route = context.route.bind(context);
      vi.spyOn(context, "route").mockImplementation(async (pattern, handler, options) =>
        route(
          pattern,
          async (requestRoute, request) => {
            if (request.url().endsWith("/sentinel"))
              vi.spyOn(request, "allHeaders").mockImplementation(async () => {
                started.resolve();
                await release.promise;
                throw new Error("Synthetic metadata canceled after context close.");
              });
            await handler(requestRoute, request);
          },
          options,
        ),
      );
      const close = context.close.bind(context);
      vi.spyOn(context, "close").mockImplementation(async (options) => {
        await close(options);
        contextClosed.resolve();
      });
      return context;
    });
    return browser;
  });
  return { started, contextClosed, release, contextCount: () => contextCount };
}
