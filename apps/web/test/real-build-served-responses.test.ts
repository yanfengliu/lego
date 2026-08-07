import { createHash } from "node:crypto";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import type { Page, Route } from "@playwright/test";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createRealBuildServedResponseRecorder,
  REAL_BUILD_SERVED_RESPONSE_MANIFEST,
} from "../e2e/real-build-served-responses";
import {
  assertNoSensitiveServedRequestHeaders,
  assertNoSensitiveServedResponseHeaders,
} from "../e2e/real-build-served-response-policy";
import { verifyRealBuildServedResponseEvidence } from "../e2e/real-build-served-response-verification";
import type { RealBuildSourceLock } from "../e2e/real-build-source-lock";

const digest = (bytes: Uint8Array): string =>
  `sha256:${createHash("sha256").update(bytes).digest("hex")}`;

interface FakeRoute {
  readonly route: Route;
  readonly fetch: ReturnType<typeof vi.fn>;
  readonly fulfill: ReturnType<typeof vi.fn>;
  readonly abort: ReturnType<typeof vi.fn>;
}

function fakeRoute(input: {
  readonly url: string;
  readonly body?: Uint8Array | string;
  readonly method?: string;
  readonly headers?: Readonly<Record<string, string>>;
  readonly responseHeaders?: Readonly<Record<string, string>>;
}): FakeRoute {
  const fetch = vi.fn(async () => ({
    status: () => 200,
    headers: () =>
      input.responseHeaders ?? {
        "content-type": "application/javascript",
        "cache-control": "no-cache",
      },
    body: async () => Buffer.from(input.body ?? ""),
  }));
  const fulfill = vi.fn(async () => undefined);
  const abort = vi.fn(async () => undefined);
  return {
    route: {
      request: () => ({
        url: () => input.url,
        method: () => input.method ?? "GET",
        allHeaders: async () => input.headers ?? { accept: "*/*" },
      }),
      fetch,
      fulfill,
      abort,
    } as unknown as Route,
    fetch,
    fulfill,
    abort,
  };
}

describe("real-build served-response evidence", () => {
  let temporaryRoot: string | null = null;

  afterEach(() => {
    if (temporaryRoot !== null) rmSync(temporaryRoot, { recursive: true, force: true });
    temporaryRoot = null;
  });

  it("refuses common auth and session header names without retaining their values", () => {
    expect(() =>
      assertNoSensitiveServedRequestHeaders([
        { name: "x-session-id", value: "must-not-be-retained" },
      ]),
    ).toThrow(/x-session-id.*credential material/u);
    expect(() =>
      assertNoSensitiveServedResponseHeaders([{ name: "x-auth", value: "must-not-be-retained" }]),
    ).toThrow(/x-auth.*credential material/u);
  });

  it("closes routing to locked sources and binds raw, transformed, cached, and blocked requests", async () => {
    temporaryRoot = mkdtempSync(join(tmpdir(), "lego-served-responses-"));
    const mirrorRoot = join(temporaryRoot, "source-snapshot");
    const outputRoot = join(temporaryRoot, "run");
    const sourcePath = "packages/demo/src/index.ts";
    const sourceBytes = Buffer.from("export const value = 1;\n");
    const otherSourcePath = "packages/demo/src/other.ts";
    const otherSourceBytes = Buffer.from("export const other = 2;\n");
    mkdirSync(join(mirrorRoot, "packages", "demo", "src"), { recursive: true });
    mkdirSync(outputRoot);
    writeFileSync(join(mirrorRoot, sourcePath), sourceBytes);
    writeFileSync(join(mirrorRoot, otherSourcePath), otherSourceBytes);
    const sourceFiles = [
      { path: sourcePath, bytes: sourceBytes.length, digest: digest(sourceBytes) },
      { path: otherSourcePath, bytes: otherSourceBytes.length, digest: digest(otherSourceBytes) },
    ];

    let handler: ((route: Route) => Promise<void>) | null = null;
    const page = {
      route: vi.fn(async (_pattern: string, next: (route: Route) => Promise<void>) => {
        handler = next;
      }),
      unroute: vi.fn(async () => undefined),
    } as unknown as Page;
    const sourceLock: RealBuildSourceLock = {
      assertHeld: vi.fn(),
      release: vi.fn(async () => undefined),
    };
    const recorder = createRealBuildServedResponseRecorder({
      page,
      sourceLock,
      repoRoot: process.cwd(),
      mirror: {
        root: mirrorRoot,
        files: sourceFiles,
      },
    });
    await recorder.install();
    expect(handler).not.toBeNull();
    const invoke = handler as unknown as (route: Route) => Promise<void>;
    const origin = "http://127.0.0.1:4173";
    const runner = fakeRoute({ url: `${origin}/__real_build_runner__` });
    await invoke(runner.route);
    expect(runner.fetch).not.toHaveBeenCalled();
    expect(runner.fulfill).toHaveBeenCalledOnce();

    const fsPath = resolve(mirrorRoot, sourcePath).replaceAll("\\", "/");
    const raw = fakeRoute({ url: `${origin}/@fs/${fsPath}`, body: sourceBytes });
    await invoke(raw.route);
    expect(raw.fetch).toHaveBeenCalledOnce();

    const transformedBytes = Buffer.from("const value = 1; export { value };\n");
    const transformedUrl = `${origin}/@fs/${fsPath}?import`;
    const transformed = fakeRoute({ url: transformedUrl, body: transformedBytes });
    await invoke(transformed.route);
    const cached = fakeRoute({ url: transformedUrl, body: "must not be fetched" });
    await invoke(cached.route);
    expect(cached.fetch).not.toHaveBeenCalled();
    expect(cached.fulfill).toHaveBeenCalledWith(
      expect.objectContaining({ body: transformedBytes }),
    );

    const variedHeaders = fakeRoute({
      url: transformedUrl,
      headers: { accept: "application/json" },
      body: "export const representation = 'json';\n",
    });
    await invoke(variedHeaders.route);
    expect(variedHeaders.fetch).toHaveBeenCalledOnce();

    const blocked = fakeRoute({ url: `${origin}/@fs/C:/outside/not-locked.ts` });
    await invoke(blocked.route);
    expect(blocked.fetch).not.toHaveBeenCalled();
    expect(blocked.abort).toHaveBeenCalledWith("blockedbyclient");

    const evidence = await recorder.writeEvidence(outputRoot);
    expect(evidence.files).toContain(REAL_BUILD_SERVED_RESPONSE_MANIFEST);
    const manifestPath = join(outputRoot, REAL_BUILD_SERVED_RESPONSE_MANIFEST);
    const originalManifestBytes = readFileSync(manifestPath);
    const manifest = JSON.parse(originalManifestBytes.toString("utf8")) as {
      readonly events: readonly { readonly outcome: string; readonly cacheHit?: boolean }[];
      readonly responses: readonly {
        readonly requestKey: string;
        readonly requestUrl: string;
        readonly body: { readonly kind: string };
      }[];
    };
    expect(manifest.events.map(({ outcome }) => outcome)).toEqual([
      "fulfilled",
      "fulfilled",
      "fulfilled",
      "fulfilled",
      "fulfilled",
      "blocked",
    ]);
    expect(manifest.events[3]?.cacheHit).toBe(true);
    expect(
      manifest.responses.find(({ requestUrl }) => requestUrl.endsWith(sourcePath))?.body.kind,
    ).toBe("source");
    expect(
      manifest.responses.find(({ requestUrl }) => requestUrl.endsWith("?import"))?.body.kind,
    ).toBe("bundle");
    expect(
      manifest.responses.filter(({ requestUrl }) => requestUrl.endsWith("?import")),
    ).toHaveLength(2);
    expect(
      verifyRealBuildServedResponseEvidence({
        directory: outputRoot,
        expectedManifestDigest: evidence.manifestDigest,
        sourceFiles,
        requireRunner: true,
      }),
    ).toEqual(evidence.files);

    const expectManifestMutationRejected = (
      mutate: (candidate: Record<string, unknown>) => void,
      pattern: RegExp,
    ): void => {
      const candidate = JSON.parse(originalManifestBytes.toString("utf8")) as Record<
        string,
        unknown
      >;
      mutate(candidate);
      const bytes = Buffer.from(`${JSON.stringify(candidate)}\n`);
      writeFileSync(manifestPath, bytes);
      expect(() =>
        verifyRealBuildServedResponseEvidence({
          directory: outputRoot,
          expectedManifestDigest: digest(bytes),
          sourceFiles,
          requireRunner: true,
        }),
      ).toThrow(pattern);
      writeFileSync(manifestPath, originalManifestBytes);
    };
    expectManifestMutationRejected((candidate) => {
      candidate.events = [];
      candidate.responses = [];
      candidate.bodyChunks = [];
    }, /no closed-route runner/u);
    expectManifestMutationRejected((candidate) => {
      const responses = candidate.responses as Record<string, unknown>[];
      responses.find(({ requestUrl }) => requestUrl === "/__real_build_runner__")!.status = 204;
    }, /exact synthetic status/u);
    expectManifestMutationRejected((candidate) => {
      const responses = candidate.responses as Record<string, unknown>[];
      responses.find(({ requestUrl }) => requestUrl === "/__real_build_runner__")!.headers = [
        { name: "content-type", value: "text/plain" },
      ];
    }, /exact synthetic status, headers, and body/u);
    expectManifestMutationRejected((candidate) => {
      const responses = candidate.responses as Record<string, unknown>[];
      const runnerResponse = responses.find(
        ({ requestUrl }) => requestUrl === "/__real_build_runner__",
      )!;
      (runnerResponse.headers as Record<string, unknown>[])[0]!.authorization =
        "must-not-be-retained";
    }, /array of string name\/value headers/u);
    expectManifestMutationRejected((candidate) => {
      const responses = candidate.responses as Record<string, unknown>[];
      responses.find(
        ({ requestUrl }) =>
          typeof requestUrl === "string" &&
          requestUrl.endsWith(sourcePath) &&
          !requestUrl.includes("?"),
      )!.sourcePath = otherSourcePath;
    }, /sourcePath does not match/u);
    expectManifestMutationRejected((candidate) => {
      const events = candidate.events as Record<string, unknown>[];
      [events[0], events[1]] = [events[1]!, events[0]!];
      events[0]!.sequence = 0;
      events[1]!.sequence = 1;
    }, /runner must be the first fulfilled event/u);

    const bodyFile = evidence.files.find((file) => file.endsWith(".bin"));
    expect(bodyFile).toBeDefined();
    writeFileSync(join(outputRoot, bodyFile!), "tampered");
    expect(() =>
      verifyRealBuildServedResponseEvidence({
        directory: outputRoot,
        expectedManifestDigest: evidence.manifestDigest,
        sourceFiles,
        requireRunner: true,
      }),
    ).toThrow(/body chunk/u);
  });

  it("refuses uninstalled capture and request or response headers that could retain credentials", async () => {
    temporaryRoot = mkdtempSync(join(tmpdir(), "lego-served-response-policy-"));
    const mirrorRoot = join(temporaryRoot, "source-snapshot");
    const outputRoot = join(temporaryRoot, "run");
    mkdirSync(mirrorRoot);
    mkdirSync(outputRoot);
    let handler: ((route: Route) => Promise<void>) | null = null;
    const page = {
      route: vi.fn(async (_pattern: string, next: (route: Route) => Promise<void>) => {
        handler = next;
      }),
      unroute: vi.fn(async () => undefined),
    } as unknown as Page;
    const sourceLock: RealBuildSourceLock = {
      assertHeld: vi.fn(),
      release: vi.fn(async () => undefined),
    };
    const uninstalled = createRealBuildServedResponseRecorder({
      page,
      sourceLock,
      repoRoot: process.cwd(),
      mirror: { root: mirrorRoot, files: [] },
    });
    await expect(uninstalled.writeEvidence(outputRoot)).rejects.toThrow(/never installed/u);

    const recorder = createRealBuildServedResponseRecorder({
      page,
      sourceLock,
      repoRoot: process.cwd(),
      mirror: { root: mirrorRoot, files: [] },
    });
    await recorder.install();
    const credentialed = fakeRoute({
      url: "http://127.0.0.1:4173/__real_build_runner__",
      headers: { accept: "text/html", cookie: "session=must-not-be-retained" },
    });
    await (handler as unknown as (route: Route) => Promise<void>)(credentialed.route);
    expect(credentialed.fulfill).not.toHaveBeenCalled();
    expect(credentialed.abort).toHaveBeenCalledWith("failed");
    await expect(recorder.writeEvidence(outputRoot)).rejects.toThrow(
      /cookie.*credential material/u,
    );

    const responseRecorder = createRealBuildServedResponseRecorder({
      page,
      sourceLock,
      repoRoot: process.cwd(),
      mirror: {
        root: mirrorRoot,
        files: [
          {
            path: "apps/web/src/credential-response.ts",
            bytes: 23,
            digest: digest(Buffer.from("export const value = 1;\n")),
          },
        ],
      },
    });
    mkdirSync(join(mirrorRoot, "apps", "web", "src"), { recursive: true });
    writeFileSync(
      join(mirrorRoot, "apps", "web", "src", "credential-response.ts"),
      "export const value = 1;\n",
    );
    await responseRecorder.install();
    const runner = fakeRoute({
      url: "http://127.0.0.1:4173/__real_build_runner__",
    });
    await (handler as unknown as (route: Route) => Promise<void>)(runner.route);
    const responseWithCookie = fakeRoute({
      url: `http://127.0.0.1:4173/@fs/${resolve(
        mirrorRoot,
        "apps/web/src/credential-response.ts",
      ).replaceAll("\\", "/")}`,
      responseHeaders: {
        "content-type": "application/javascript",
        "set-cookie": "session=must-not-be-retained",
      },
    });
    await (handler as unknown as (route: Route) => Promise<void>)(responseWithCookie.route);
    expect(responseWithCookie.fulfill).not.toHaveBeenCalled();
    expect(responseWithCookie.abort).toHaveBeenCalledWith("failed");
    await expect(responseRecorder.writeEvidence(outputRoot)).rejects.toThrow(
      /response header set-cookie.*credential material/u,
    );
  });
});
