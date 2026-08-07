import { isAbsolute, relative, resolve, sep } from "node:path";

import type { Page, Route } from "@playwright/test";

import { writeContainedRegularFileAtomic } from "./contained-atomic-write";
import {
  type RealBuildSourceMirror,
  type RealBuildSourceSnapshot,
} from "./real-build-replay-files";
import type { RealBuildSourceLock } from "./real-build-source-lock";
import {
  assertNoSensitiveServedRequestHeaders,
  assertNoSensitiveServedResponseHeaders,
  MAXIMUM_BUNDLED_SERVED_RESPONSE_BYTES,
  MAXIMUM_SERVED_RESPONSE_BODY_AGGREGATE_BYTES,
  MAXIMUM_SERVED_RESPONSE_BODY_BYTES,
  MAXIMUM_SERVED_RESPONSE_BODY_CHUNK_BYTES,
  MAXIMUM_SERVED_RESPONSE_HEADER_AGGREGATE_CHARACTERS,
  MAXIMUM_SERVED_RESPONSE_MANIFEST_BYTES,
  MAXIMUM_SERVED_RESPONSE_REQUEST_KEY_CHARACTERS,
  MAXIMUM_SERVED_RESPONSE_REQUEST_KEY_LENGTH,
  MAXIMUM_SERVED_RESPONSE_REQUEST_URL_LENGTH,
  MAXIMUM_SERVED_RESPONSE_REQUESTS,
  MAXIMUM_SERVED_RESPONSES,
  REAL_BUILD_SERVED_RESPONSE_MANIFEST,
  REAL_BUILD_SERVED_RESPONSE_RUNNER_PATH,
  REAL_BUILD_SERVED_RESPONSE_RUNNER_BODY,
  REAL_BUILD_SERVED_RESPONSE_RUNNER_HEADERS,
  REAL_BUILD_SERVED_RESPONSE_RUNNER_STATUS,
  REAL_BUILD_SERVED_RESPONSE_SCHEMA,
  normalizedServedResponseSourceRoot,
  servedResponseChunkName,
  servedResponseDigest,
  servedResponseRequestKey,
  strictServedResponseHeaders,
  type ServedResponseHeader,
} from "./real-build-served-response-policy";

export {
  REAL_BUILD_SERVED_RESPONSE_MANIFEST,
  REAL_BUILD_SERVED_RESPONSE_SCHEMA,
} from "./real-build-served-response-policy";

const ROUTE_PATTERN = "**/*";
const RUNNER_BYTES = Buffer.from(REAL_BUILD_SERVED_RESPONSE_RUNNER_BODY);

function inside(root: string, candidate: string): boolean {
  const path = relative(root, candidate);
  return path === "" || (!path.startsWith(`..${sep}`) && path !== ".." && !isAbsolute(path));
}

function comparableAbsolute(path: string): string {
  const absolute = resolve(path);
  return process.platform === "win32" ? absolute.toLocaleLowerCase("en-US") : absolute;
}

interface CachedResponse {
  readonly requestKey: string;
  readonly requestUrl: string;
  readonly requestHeaders: readonly ServedResponseHeader[];
  readonly sourcePath: string | null;
  readonly status: number;
  readonly headers: Readonly<Record<string, string>>;
  readonly headerEntries: readonly ServedResponseHeader[];
  readonly body: Buffer;
  readonly bodyDigest: string;
}

type CapturedEvent =
  | {
      readonly sequence: number;
      readonly outcome: "fulfilled";
      readonly requestKey: string;
      readonly responseKey: string;
      readonly cacheHit: boolean;
    }
  | {
      readonly sequence: number;
      readonly outcome: "blocked";
      readonly requestKey: string;
      readonly reason:
        | "invalid-url"
        | "origin-before-runner"
        | "cross-origin"
        | "non-get"
        | "outside-locked-source";
    };

export interface RealBuildServedResponseEvidence {
  readonly manifestDigest: string;
  readonly files: readonly string[];
}

export interface RealBuildServedResponseRecorder {
  install(): Promise<void>;
  writeEvidence(directory: string): Promise<RealBuildServedResponseEvidence>;
  dispose(): Promise<void>;
}

function headersRecord(entries: readonly ServedResponseHeader[]): Readonly<Record<string, string>> {
  return Object.fromEntries(entries.map(({ name, value }) => [name, value]));
}

/** Intercepts every browser request, serves only locked mirror files, and retains exact delivered bytes. */
export function createRealBuildServedResponseRecorder(input: {
  readonly page: Page;
  readonly mirror: RealBuildSourceMirror;
  readonly sourceLock: RealBuildSourceLock;
  /** Checkout the mirror was captured from, so a checkout path can be matched back to a declared source. */
  readonly repoRoot: string;
}): RealBuildServedResponseRecorder {
  const sourceByAbsolute = new Map<string, RealBuildSourceSnapshot>();
  const sourceByPath = new Map(input.mirror.files.map((source) => [source.path, source]));
  for (const source of input.mirror.files) {
    sourceByAbsolute.set(comparableAbsolute(resolve(input.mirror.root, source.path)), source);
  }
  const cache = new Map<string, Promise<CachedResponse>>();
  const events: CapturedEvent[] = [];
  const inFlight = new Set<Promise<void>>();
  let origin: string | null = null;
  let installed = false;
  let everInstalled = false;
  let stopped = false;
  let nextSequence = 0;
  let requestCharacters = 0;
  let responseBodyBytes = 0;
  let headerCharacters = 0;
  let failure: Error | null = null;

  const rememberFailure = (error: unknown): Error => {
    const normalized = error instanceof Error ? error : new Error(String(error));
    failure ??= normalized;
    return normalized;
  };

  const reserveEvent = (requestKey: string): number => {
    if (nextSequence >= MAXIMUM_SERVED_RESPONSE_REQUESTS) {
      throw new TypeError(
        `Browser execution attempted more than ${MAXIMUM_SERVED_RESPONSE_REQUESTS} requests; the closed route refused further work.`,
      );
    }
    if (requestKey.length > MAXIMUM_SERVED_RESPONSE_REQUEST_KEY_LENGTH) {
      throw new TypeError(
        `Browser request key has ${requestKey.length} characters; maximum is ${MAXIMUM_SERVED_RESPONSE_REQUEST_KEY_LENGTH}.`,
      );
    }
    requestCharacters += requestKey.length;
    if (requestCharacters > MAXIMUM_SERVED_RESPONSE_REQUEST_KEY_CHARACTERS) {
      throw new TypeError(
        `Browser request keys exceed the ${MAXIMUM_SERVED_RESPONSE_REQUEST_KEY_CHARACTERS}-character aggregate bound.`,
      );
    }
    const sequence = nextSequence;
    nextSequence += 1;
    return sequence;
  };

  /**
   * The one URL family the bundler invents, resolved against the mirror rather
   * than admitted from outside it.
   *
   * Every module this run asks for by name arrives as `/@fs/<mirror path>`,
   * which is what keeps the mirror the only thing that executes. Vite's
   * dependency pre-bundle is the exception: it rewrites a bare import inside a
   * mirrored file to `/node_modules/.vite/deps/<name>.js`, a path relative to
   * the dev server's root and carrying no `/@fs/` prefix, so it named no mirror
   * file and was refused as `outside-locked-source`. Two ajv CommonJS helpers
   * reach the browser only this way, and serving them raw instead is not an
   * option, because pre-bundling is also what converts them to ESM.
   *
   * The invariant is unchanged: the bytes must still be a file the mirror
   * declared and hashed, `inside` still rejects anything that climbs out, and a
   * dep the mirror does not carry is still blocked. All that changes is that a
   * second spelling can name a mirrored file.
   *
   * The cache lives under vite's own root rather than beside the lockfile —
   * `apps/web/node_modules/.vite` — which is why the declared source root has to
   * name that path. Declaring the repository-root one instead mirrors an empty
   * directory and changes nothing.
   */
  const DEP_CACHE_PREFIX = "/node_modules/.vite/";
  /** Dev-server root, which root-relative request paths resolve against. */
  const SERVER_ROOT_IN_MIRROR = "apps/web";

  /**
   * Vite's own client, whose import it injects into every module it transforms
   * in dev — independently of HMR, so turning HMR off removes the socket and
   * not the import. Fixed virtual routes onto real files in a root the mirror
   * already declares, so they resolve like any other mirrored module rather
   * than being waved through.
   */
  const VITE_CLIENT_ROUTES: ReadonlyMap<string, string> = new Map([
    ["/@vite/client", "node_modules/vite/dist/client/client.mjs"],
    ["/@vite/env", "node_modules/vite/dist/client/env.mjs"],
  ]);

  const sourceForUrl = (url: URL): RealBuildSourceSnapshot | null => {
    const clientRoute = VITE_CLIENT_ROUTES.get(url.pathname);
    if (clientRoute !== undefined) {
      return sourceByPath.get(clientRoute) ?? null;
    }
    const isFsUrl = url.pathname.startsWith("/@fs/");
    if (!isFsUrl && !url.pathname.startsWith(DEP_CACHE_PREFIX)) return null;
    let decoded: string;
    try {
      decoded = decodeURIComponent(
        isFsUrl ? url.pathname.slice("/@fs/".length) : url.pathname.slice(1),
      );
    } catch {
      return null;
    }
    if (decoded.includes("\0")) return null;
    if (process.platform === "win32" && /^\/[A-Za-z]:\//u.test(decoded)) decoded = decoded.slice(1);
    const mirrorRoot = resolve(input.mirror.root);
    const absolute = isFsUrl
      ? resolve(decoded)
      : resolve(mirrorRoot, SERVER_ROOT_IN_MIRROR, decoded);
    if (inside(mirrorRoot, absolute)) {
      return sourceByAbsolute.get(comparableAbsolute(absolute)) ?? null;
    }
    // Vite resolves an import inside a served module against its own module
    // graph, which is rooted in the ordinary checkout, so a mirrored file can be
    // handed back a sibling's absolute path outside the mirror — vite's client
    // importing `env.mjs` is the case that surfaced it. Chasing those one route
    // at a time was the wrong cut; what the mirror actually vouches for is a
    // *file*, identified by its repository-relative path, and the run's own
    // drift check proves the checkout still holds the bytes that were captured.
    // So a checkout path is accepted exactly when the mirror declares the same
    // relative path, and refused otherwise.
    const repoRelative = relative(resolve(input.repoRoot), absolute).replaceAll("\\", "/");
    if (repoRelative === "" || repoRelative.startsWith("../") || isAbsolute(repoRelative)) {
      return null;
    }
    return sourceByPath.get(repoRelative) ?? null;
  };

  const createResponse = async (
    route: Route,
    requestKey: string,
    requestUrl: string,
    requestHeaders: readonly ServedResponseHeader[],
    source: RealBuildSourceSnapshot | null,
  ): Promise<CachedResponse> => {
    input.sourceLock.assertHeld();
    let status: number;
    let headerEntries: readonly ServedResponseHeader[];
    let body: Buffer;
    if (requestUrl === REAL_BUILD_SERVED_RESPONSE_RUNNER_PATH) {
      status = REAL_BUILD_SERVED_RESPONSE_RUNNER_STATUS;
      headerEntries = strictServedResponseHeaders(REAL_BUILD_SERVED_RESPONSE_RUNNER_HEADERS);
      body = RUNNER_BYTES;
    } else {
      const response = await route.fetch({ maxRedirects: 0, timeout: 120_000 });
      status = response.status();
      if (status < 200 || status >= 300) {
        throw new TypeError(
          `Locked browser source ${requestUrl} returned HTTP ${status}; only a successful exact response may execute.`,
        );
      }
      headerEntries = strictServedResponseHeaders(response.headers());
      assertNoSensitiveServedResponseHeaders(headerEntries);
      body = await response.body();
    }
    input.sourceLock.assertHeld();
    if (body.length > MAXIMUM_SERVED_RESPONSE_BODY_BYTES) {
      throw new TypeError(
        `Served response ${requestUrl} has ${body.length} bytes; maximum is ${MAXIMUM_SERVED_RESPONSE_BODY_BYTES}.`,
      );
    }
    responseBodyBytes += body.length;
    if (responseBodyBytes > MAXIMUM_SERVED_RESPONSE_BODY_AGGREGATE_BYTES) {
      throw new TypeError(
        `Served responses exceed the ${MAXIMUM_SERVED_RESPONSE_BODY_AGGREGATE_BYTES}-byte aggregate bound at ${requestUrl}.`,
      );
    }
    headerCharacters += [...requestHeaders, ...headerEntries].reduce(
      (total, entry) => total + entry.name.length + entry.value.length,
      0,
    );
    if (headerCharacters > MAXIMUM_SERVED_RESPONSE_HEADER_AGGREGATE_CHARACTERS) {
      throw new TypeError(
        `Served response headers exceed the ${MAXIMUM_SERVED_RESPONSE_HEADER_AGGREGATE_CHARACTERS}-character aggregate bound.`,
      );
    }
    return {
      requestKey,
      requestUrl,
      requestHeaders,
      sourcePath: source?.path ?? null,
      status,
      headers: headersRecord(headerEntries),
      headerEntries,
      body,
      bodyDigest: servedResponseDigest(body),
    };
  };

  const handle = async (route: Route): Promise<void> => {
    let requestKey = "invalid-url";
    try {
      const request = route.request();
      let url: URL;
      try {
        url = new URL(request.url());
      } catch {
        const sequence = reserveEvent(requestKey);
        events.push({ sequence, outcome: "blocked", requestKey, reason: "invalid-url" });
        await route.abort("blockedbyclient");
        return;
      }
      const requestUrl = `${url.pathname}${url.search}`;
      if (requestUrl.length > MAXIMUM_SERVED_RESPONSE_REQUEST_URL_LENGTH) {
        throw new TypeError(
          `Browser request URL has ${requestUrl.length} characters; maximum is ${MAXIMUM_SERVED_RESPONSE_REQUEST_URL_LENGTH}.`,
        );
      }
      const requestHeaders = strictServedResponseHeaders(await request.allHeaders());
      assertNoSensitiveServedRequestHeaders(requestHeaders);
      requestKey = servedResponseRequestKey(requestUrl, requestHeaders);
      const sequence = reserveEvent(requestKey);
      if (origin === null && requestUrl === REAL_BUILD_SERVED_RESPONSE_RUNNER_PATH)
        origin = url.origin;
      const blockedReason =
        origin === null
          ? ("origin-before-runner" as const)
          : url.origin !== origin
            ? ("cross-origin" as const)
            : request.method() !== "GET"
              ? ("non-get" as const)
              : null;
      const source =
        requestUrl === REAL_BUILD_SERVED_RESPONSE_RUNNER_PATH ? null : sourceForUrl(url);
      const reason =
        blockedReason ??
        (requestUrl !== REAL_BUILD_SERVED_RESPONSE_RUNNER_PATH && source === null
          ? ("outside-locked-source" as const)
          : null);
      if (reason !== null) {
        events.push({ sequence, outcome: "blocked", requestKey, reason });
        await route.abort("blockedbyclient");
        return;
      }
      const cached = cache.get(requestKey);
      if (cached === undefined && cache.size >= MAXIMUM_SERVED_RESPONSES) {
        throw new TypeError(
          `Browser execution requested more than ${MAXIMUM_SERVED_RESPONSES} unique responses.`,
        );
      }
      const responsePromise =
        cached ?? createResponse(route, requestKey, requestUrl, requestHeaders, source);
      if (cached === undefined) cache.set(requestKey, responsePromise);
      const response = await responsePromise;
      input.sourceLock.assertHeld();
      await route.fulfill({
        status: response.status,
        headers: response.headers,
        body: response.body,
      });
      events.push({
        sequence,
        outcome: "fulfilled",
        requestKey,
        responseKey: response.requestKey,
        cacheHit: cached !== undefined,
      });
      return;
    } catch (error) {
      rememberFailure(error);
      try {
        await route.abort("failed");
      } catch {
        // The route may already have been fulfilled or aborted; the retained failure remains fatal.
      }
    }
  };

  const routeHandler = (route: Route): Promise<void> => {
    const pending = handle(route).finally(() => inFlight.delete(pending));
    inFlight.add(pending);
    return pending;
  };

  const stop = async (): Promise<void> => {
    if (!installed) return;
    await input.page.unroute(ROUTE_PATTERN, routeHandler);
    installed = false;
    await Promise.all([...inFlight]);
  };

  return {
    install: async () => {
      if (stopped || installed)
        throw new TypeError("Served-response recorder may be installed once.");
      await input.page.route(ROUTE_PATTERN, routeHandler);
      installed = true;
      everInstalled = true;
    },
    writeEvidence: async (directory) => {
      if (stopped) throw new TypeError("Served-response evidence was already finalized.");
      if (!everInstalled) {
        throw new TypeError(
          "Served-response recorder was never installed; empty evidence cannot stand in for a closed browser route.",
        );
      }
      stopped = true;
      await stop();
      if (failure !== null) throw failure;
      input.sourceLock.assertHeld();
      const responses = await Promise.all([...cache.values()]);
      responses.sort((left, right) => left.requestKey.localeCompare(right.requestKey));
      const responseIndex = new Map(
        responses.map((response, index) => [response.requestKey, index]),
      );
      const bundled: Buffer[] = [];
      let bundledBytes = 0;
      const responseRecords = responses.map((response, index) => {
        const source = response.sourcePath === null ? null : sourceByPath.get(response.sourcePath);
        const sourceBacked =
          source !== null &&
          source !== undefined &&
          source.bytes === response.body.length &&
          source.digest === response.bodyDigest;
        const body = sourceBacked
          ? {
              kind: "source" as const,
              path: source.path,
              bytes: response.body.length,
              digest: response.bodyDigest,
            }
          : {
              kind: "bundle" as const,
              offset: bundledBytes,
              bytes: response.body.length,
              digest: response.bodyDigest,
            };
        if (!sourceBacked) {
          bundled.push(response.body);
          bundledBytes += response.body.length;
          if (bundledBytes > MAXIMUM_BUNDLED_SERVED_RESPONSE_BYTES) {
            throw new TypeError(
              `Transformed served responses require ${bundledBytes} retained bytes; maximum is ${MAXIMUM_BUNDLED_SERVED_RESPONSE_BYTES}.`,
            );
          }
        }
        return {
          index,
          requestKey: response.requestKey,
          requestUrl: response.requestUrl,
          requestHeaders: response.requestHeaders,
          sourcePath: response.sourcePath,
          status: response.status,
          headers: response.headerEntries,
          body,
        };
      });
      const bodyBundle = Buffer.concat(bundled, bundledBytes);
      const chunkRecords: { file: string; bytes: number; digest: string }[] = [];
      const files: string[] = [];
      for (let offset = 0, index = 0; offset < bodyBundle.length; index += 1) {
        const chunk = bodyBundle.subarray(
          offset,
          offset + MAXIMUM_SERVED_RESPONSE_BODY_CHUNK_BYTES,
        );
        const file = servedResponseChunkName(index);
        chunkRecords.push({ file, bytes: chunk.length, digest: servedResponseDigest(chunk) });
        files.push(file);
        offset += chunk.length;
      }
      const manifest = {
        schemaVersion: REAL_BUILD_SERVED_RESPONSE_SCHEMA,
        sourceRoot: normalizedServedResponseSourceRoot(input.mirror.root),
        events: events
          .slice()
          .sort((left, right) => left.sequence - right.sequence)
          .map((event) => {
            if (event.outcome === "blocked") return event;
            return {
              sequence: event.sequence,
              outcome: event.outcome,
              requestKey: event.requestKey,
              responseIndex: responseIndex.get(event.responseKey),
              cacheHit: event.cacheHit,
            };
          }),
        responses: responseRecords,
        bodyChunks: chunkRecords,
      };
      const manifestBytes = Buffer.from(`${JSON.stringify(manifest)}\n`);
      if (manifestBytes.length > MAXIMUM_SERVED_RESPONSE_MANIFEST_BYTES) {
        throw new TypeError(
          `Served-response manifest has ${manifestBytes.length} bytes; maximum is ${MAXIMUM_SERVED_RESPONSE_MANIFEST_BYTES}.`,
        );
      }
      for (let index = 0; index < chunkRecords.length; index += 1) {
        const record = chunkRecords[index]!;
        const start = index * MAXIMUM_SERVED_RESPONSE_BODY_CHUNK_BYTES;
        writeContainedRegularFileAtomic(
          directory,
          record.file,
          bodyBundle.subarray(start, start + record.bytes),
          { label: "served-response body evidence" },
        );
      }
      writeContainedRegularFileAtomic(
        directory,
        REAL_BUILD_SERVED_RESPONSE_MANIFEST,
        manifestBytes,
        {
          label: "served-response manifest",
        },
      );
      files.push(REAL_BUILD_SERVED_RESPONSE_MANIFEST);
      return { manifestDigest: servedResponseDigest(manifestBytes), files };
    },
    dispose: async () => {
      stopped = true;
      await stop();
    },
  };
}
