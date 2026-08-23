import type { Page, Response } from "@playwright/test";
import { describe, expect, it, vi } from "vitest";

import { captureServedJavaScript } from "../e2e/real-build-step7-gate3-served-source";

const ORIGIN = "http://127.0.0.1:4173";

function fakeObservedPage() {
  const listeners = new Map<string, Set<(value?: unknown) => void>>();
  const context = {
    on: (event: string, listener: (value?: unknown) => void) => {
      const registered = listeners.get(event) ?? new Set();
      registered.add(listener);
      listeners.set(event, registered);
    },
    off: (event: string, listener: (value?: unknown) => void) => {
      listeners.get(event)?.delete(listener);
    },
    pages: () => [],
    serviceWorkers: () => [],
  };
  return {
    page: { context: () => context } as unknown as Page,
    emit: (event: string, value?: unknown) => {
      for (const listener of listeners.get(event) ?? []) listener(value);
    },
  };
}

function fakeExecutableResponse(input: {
  readonly path: string;
  readonly body: () => Promise<Buffer>;
  readonly contentLength?: number | string;
}): Response {
  return {
    headers: () => ({
      "content-type": "text/javascript; charset=utf-8",
      ...(input.contentLength === undefined
        ? {}
        : { "content-length": String(input.contentLength) }),
    }),
    url: () => `${ORIGIN}${input.path}`,
    body: input.body,
    status: () => 200,
    request: () => ({ method: () => "GET", resourceType: () => "script" }),
  } as unknown as Response;
}

const beginCapture = (page: Page, requiredEntryUrl: string) =>
  captureServedJavaScript({
    page,
    expectedOrigin: ORIGIN,
    requiredEntryUrls: [requiredEntryUrl],
    forbiddenUrlFragments: ["/output/", "/cas/"],
    browserInputDigest: `sha256:${"4".repeat(64)}`,
  });

describe("Gate-3 served JavaScript partial evidence", () => {
  it("retains a bounded authority-none response-body read failure", async () => {
    const observed = fakeObservedPage();
    const capture = beginCapture(observed.page, "/unreadable.mjs");
    observed.emit(
      "response",
      fakeExecutableResponse({
        path: "/unreadable.mjs",
        body: vi.fn().mockRejectedValue(new Error("injected body read failure")),
      }),
    );
    observed.emit("close");

    await expect(capture()).rejects.toThrow(/injected body read failure/u);
    expect(capture.snapshotUnverified()).toMatchObject({
      authority: "none",
      responseBodiesRetained: false,
      responseReadFailures: [
        {
          absoluteUrl: `${ORIGIN}/unreadable.mjs`,
          failure: expect.stringContaining("injected body read failure"),
        },
      ],
    });
  });

  it("refuses an oversized canonical Content-Length before response.body allocation", async () => {
    const observed = fakeObservedPage();
    const capture = beginCapture(observed.page, "/oversized.mjs");
    const body = vi.fn().mockResolvedValue(Buffer.from("must not read"));
    observed.emit(
      "response",
      fakeExecutableResponse({ path: "/oversized.mjs", body, contentLength: 16 * 1024 * 1024 + 1 }),
    );
    observed.emit("close");

    await expect(capture()).rejects.toThrow(/declares .* maximum is 16 MiB/u);
    expect(body).not.toHaveBeenCalled();
    expect(capture.snapshotUnverified().responseReadFailures).toHaveLength(1);
  });

  it.each([
    ["malformed", "", /canonical decimal byte count/u],
    ["negative", "-1", /canonical decimal byte count/u],
    ["noncanonical leading-zero", "01", /canonical decimal byte count/u],
    ["noncanonical exponent", "1e3", /canonical decimal byte count/u],
    ["unsafe", "9007199254740992", /safe integer range/u],
  ] as const)(
    "refuses a present %s Content-Length before response.body allocation",
    async (_label, contentLength, expectedFailure) => {
      const observed = fakeObservedPage();
      const capture = beginCapture(observed.page, "/invalid-content-length.mjs");
      const body = vi.fn().mockResolvedValue(Buffer.from("must not read"));
      observed.emit(
        "response",
        fakeExecutableResponse({
          path: "/invalid-content-length.mjs",
          body,
          contentLength,
        }),
      );
      observed.emit("close");

      await expect(capture()).rejects.toThrow(expectedFailure);
      expect(body).not.toHaveBeenCalled();
      expect(capture.snapshotUnverified().responseReadFailures).toEqual([
        expect.objectContaining({
          absoluteUrl: `${ORIGIN}/invalid-content-length.mjs`,
          failure: expect.stringMatching(expectedFailure),
        }),
      ]);
    },
  );

  it("retains a hostile non-Error body rejection without invoking Proxy traps", async () => {
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
        throw new Error("must not inspect prototype");
      },
      ownKeys: () => {
        traps.keys += 1;
        throw new Error("must not enumerate");
      },
    });
    const observed = fakeObservedPage();
    const capture = beginCapture(observed.page, "/hostile.mjs");
    observed.emit(
      "response",
      fakeExecutableResponse({
        path: "/hostile.mjs",
        body: vi.fn().mockRejectedValue(hostile),
      }),
    );
    observed.emit("close");

    await expect(capture()).rejects.toThrow(/non-native value/u);
    expect(
      capture.snapshotUnverified().responseReadFailures[0]?.failure.length,
    ).toBeLessThanOrEqual(512);
    expect(traps).toEqual({ get: 0, descriptor: 0, keys: 0, prototype: 0 });
  });
});
