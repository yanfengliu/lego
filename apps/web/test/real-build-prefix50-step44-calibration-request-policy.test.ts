import { type BrowserContext, type Route, type WebSocketRoute } from "playwright";
import { describe, expect, it, vi } from "vitest";

import {
  installRealBuildStep44CalibrationRequestPolicy,
  realBuildStep44CalibrationRequestRefusal,
} from "../e2e/real-build-prefix50-step44-calibration-request-policy.ts";

const appUrl = "http://127.0.0.1:42317/";
const paths = [
  "/",
  "/index.html",
  "/assets/index-kRH0IL9f.js",
  "/assets/index-C9DZZugr.css",
  "/assets/pdf-Bo8U-z5P.js",
  "/assets/pdf.worker-BQQyum15.mjs",
  "/assets/pdf.worker-CFFBobiy.js",
];
const classify = (url: string, method = "GET", headers = {}) =>
  realBuildStep44CalibrationRequestRefusal({ appUrl, url, method, headers });

describe("calibration request policy", () => {
  // Bound: seven independently named frozen paths, supported methods, and the fixed hostile
  // request population below. Real context/page behavior is covered by the owned integration.
  it("admits all seven frozen paths only for GET and HEAD", () => {
    for (const path of paths)
      for (const method of ["GET", "HEAD"])
        expect(classify(new URL(path, appUrl).href, method)).toBeNull();
  });

  it.each([
    ["http://127.0.0.1:42318/", "GET", {}, "foreign-origin"],
    ["http://localhost:42317/", "GET", {}, "foreign-origin"],
    ["file:///synthetic-sentinel.txt", "GET", {}, "foreign-origin"],
    ["http://127.0.0.1:42317/@fs/synthetic", "GET", {}, "unreviewed-path"],
    ["http://127.0.0.1:42317/recipes/sentinel.pdf", "GET", {}, "unreviewed-path"],
    [`${appUrl}unknown`, "GET", {}, "unreviewed-path"],
    [`${appUrl}index.html?sentinel=1`, "GET", {}, "query-or-fragment"],
    [`${appUrl}index.html#sentinel`, "GET", {}, "query-or-fragment"],
    [`${appUrl}%69ndex.html`, "GET", {}, "unreviewed-path"],
    [appUrl, "POST", {}, "unsupported-method"],
    [appUrl, "OPTIONS", {}, "unsupported-method"],
    ["http://sentinel:secret@127.0.0.1:42317/", "GET", {}, "credentials"],
    [appUrl, "GET", { Authorization: "synthetic-secret" }, "credentials"],
    [appUrl, "GET", { Cookie: "synthetic-secret" }, "credentials"],
    [appUrl, "GET", { "Proxy-Authorization": "synthetic-secret" }, "credentials"],
    ["invalid", "GET", {}, "invalid-url"],
    ["x".repeat(4097), "GET", {}, "invalid-url"],
  ])("refuses fixed request case %#", (url, method, headers, reason) => {
    expect(classify(url, method, headers)).toBe(reason);
  });

  it("installs HTTP and WebSocket routes and retains bounded redacted refusals", async () => {
    let http: ((route: Route) => Promise<void>) | undefined;
    let socket: ((route: WebSocketRoute) => Promise<void>) | undefined;
    const order: string[] = [];
    const context = {
      route: async (pattern: string, handler: typeof http) => {
        expect(pattern).toBe("**/*");
        order.push("http");
        http = handler;
      },
      routeWebSocket: async (pattern: string, handler: typeof socket) => {
        expect(pattern).toBe("**/*");
        order.push("websocket");
        socket = handler;
      },
    } as unknown as BrowserContext;
    const policy = await installRealBuildStep44CalibrationRequestPolicy(context, appUrl);
    expect(order).toEqual(["http", "websocket"]);
    const abort = vi.fn(async () => {});
    const continueRequest = vi.fn(async () => {});
    const close = vi.fn(async () => {});
    const connectToServer = vi.fn();
    await http!({
      request: () => ({
        url: () => "http://foreign.invalid/private-secret-path?token=secret",
        method: () => "GET",
        allHeaders: async () => ({}),
      }),
      abort,
      continue: continueRequest,
    } as unknown as Route);
    for (let index = 0; index < 4100; index += 1)
      await socket!({ close, connectToServer } as unknown as WebSocketRoute);
    expect(abort).toHaveBeenCalledWith("blockedbyclient");
    expect(continueRequest).not.toHaveBeenCalled();
    expect(connectToServer).not.toHaveBeenCalled();
    expect(close).toHaveBeenCalledTimes(4100);
    await expect(policy.finish()).rejects.toMatchObject({
      counts: { "foreign-origin": 1, websocket: 4096 },
    });
    await expect(policy.finish()).rejects.not.toThrow(/private-secret|token=|foreign\.invalid/u);
  });

  it("aborts and retains a redacted refusal when request metadata fails", async () => {
    const abort = vi.fn(async () => {});
    const context = {
      route: async (_pattern: string, handler: (route: Route) => Promise<void>) =>
        handler({
          request: () => ({
            url: () => appUrl,
            method: () => "GET",
            allHeaders: async () => {
              throw new Error("synthetic-private-metadata");
            },
          }),
          abort,
        } as unknown as Route),
      routeWebSocket: async () => {},
    } as unknown as BrowserContext;
    const policy = await installRealBuildStep44CalibrationRequestPolicy(context, appUrl);
    expect(abort).toHaveBeenCalledWith("blockedbyclient");
    await expect(policy.finish()).rejects.toMatchObject({ counts: { "route-error": 1 } });
    await expect(policy.finish()).rejects.not.toThrow("synthetic-private-metadata");
  });
});
