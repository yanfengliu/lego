import { createHash } from "node:crypto";
import { isAbsolute, resolve } from "node:path";

import type { Page, Route } from "@playwright/test";

import {
  boundedStringWithoutLivePrototype,
  normalizeThrownWithoutProbing,
} from "./non-probing-error";
import {
  STEP7_GATE3_DATA_IMPORT_CONTROL_URL,
  STEP7_GATE3_EXTERNAL_IMPORT_CONTROL_URL,
  type Step7Gate3CspImportControlUrls,
} from "./real-build-step7-gate3-host-policy-control";
import { createStep7Gate3ObserverLifecycle } from "./real-build-step7-gate3-observer-lifecycle";
import { classifyStep7Gate3RequestResource } from "./real-build-step7-gate3-request-resource";
import type {
  Gate3BoundaryEvent,
  Step7Gate3BlockedBoundaryEvent,
  Step7Gate3SourceExecutionBoundary,
} from "./real-build-step7-gate3-source-evidence";
import {
  assertExactStep7Gate3LocalHttpOrigin,
  auditedStep7Gate3RequiredResponseUrls,
  isAuditedStep7Gate3ViteQuery,
  isStep7Gate3ExecutableContentType,
  relativeStep7Gate3HttpUrl,
  step7Gate3RedirectChain,
} from "./real-build-step7-gate3-source-policy";
import { STEP7_GATE3_BLANK_RUNNER_CONTENT_SECURITY_POLICY } from "./real-build-step7-gate3-runner-policy";
import {
  STEP7_GATE3_PDF_WORKER_CONTENT_SECURITY_POLICY,
  STEP7_GATE3_WORKER_CONTROL_PATH,
} from "./real-build-step7-gate3-worker-policy";
import {
  assertStep7Gate3CloseTimeControlClosure,
  fulfillStep7Gate3SyntheticSource,
  requiredStep7Gate3CloseTimeControlUrl,
} from "./real-build-step7-gate3-synthetic-source";

export type {
  Step7Gate3SourceExecutionBoundary,
  Step7Gate3SourceExecutionBoundaryManifest,
} from "./real-build-step7-gate3-source-evidence";
export {
  STEP7_GATE3_BLANK_RUNNER_CONTENT_SECURITY_POLICY,
  STEP7_GATE3_BLANK_RUNNER_HTML,
} from "./real-build-step7-gate3-runner-policy";
export {
  STEP7_GATE3_CLOSE_TIME_COMPANION_PATH,
  STEP7_GATE3_CLOSE_TIME_CONTROL_PATH,
} from "./real-build-step7-gate3-synthetic-source";

const MAXIMUM_BOUNDARY_EVENTS = 10_000;
const MAXIMUM_BOUNDARY_URL_CHARACTERS = 8_192;
const MAXIMUM_BOUNDARY_FAILURE_CHARACTERS = 512;
const PDF_CONTENT_TYPE = /application\/pdf/iu;

const digest = (bytes: Uint8Array | string): string =>
  `sha256:${createHash("sha256").update(bytes).digest("hex")}`;

export function createStep7Gate3SourceExecutionBoundary(input: {
  readonly page: Page;
  readonly expectedOrigin: string;
  readonly repoRoot: string;
  readonly bootstrapSourceManifestDigest: string;
  readonly allowedSourcePaths: readonly string[];
  readonly requiredEntryUrls: readonly string[];
  readonly requiredPdfUrl: string | null;
  readonly requiredWorkerUrl: string | null;
  readonly requiredCloseTimeControlUrl: string | null;
  readonly forbiddenUrlFragments: readonly string[];
}): Step7Gate3SourceExecutionBoundary {
  assertExactStep7Gate3LocalHttpOrigin(input.expectedOrigin, "Gate-3 request-boundary origin");
  const repoRoot = resolve(input.repoRoot);
  const allowedSourcePaths = new Set(input.allowedSourcePaths);
  if (
    allowedSourcePaths.size === 0 ||
    allowedSourcePaths.size !== input.allowedSourcePaths.length ||
    input.allowedSourcePaths.some(
      (path) =>
        path === "" ||
        path === ".." ||
        path.startsWith("../") ||
        path.includes("\\") ||
        isAbsolute(path),
    )
  ) {
    throw new TypeError("Gate-3 request boundary requires unique canonical source paths.");
  }
  const requiredPdfRelativeUrl =
    input.requiredPdfUrl === null ? null : relativeStep7Gate3HttpUrl(input.requiredPdfUrl);
  const requiredWorkerRelativeUrl =
    input.requiredWorkerUrl === null ? null : relativeStep7Gate3HttpUrl(input.requiredWorkerUrl);
  const requiredCloseTimeControlRelativeUrl = requiredStep7Gate3CloseTimeControlUrl(
    input.requiredCloseTimeControlUrl,
  );
  const events: Gate3BoundaryEvent[] = [];
  const blockedEvents: Step7Gate3BlockedBoundaryEvent[] = [];
  let finished = false;
  let failure: Error | null = null;
  let failureReported = false;
  let sequence = 0;

  const rememberFailure = (error: unknown): Error => {
    const normalized = normalizeThrownWithoutProbing(
      error,
      "Gate-3 source observer retained a non-native thrown value without probing it.",
    );
    failure ??= normalized;
    return normalized;
  };

  const reserveSequence = (): number => {
    if (sequence >= MAXIMUM_BOUNDARY_EVENTS) {
      throw new RangeError(
        `Gate-3 browser attempted more than ${MAXIMUM_BOUNDARY_EVENTS} requests.`,
      );
    }
    const reserved = sequence;
    sequence += 1;
    return reserved;
  };

  const handle = async (route: Route): Promise<void> => {
    const request = route.request();
    let reservedSequence: number | null = null;
    let fetchDestination: string | null = null;
    try {
      reservedSequence = reserveSequence();
      if (request.url().length > MAXIMUM_BOUNDARY_URL_CHARACTERS) {
        throw new RangeError(
          `Gate-3 browser request URL has ${request.url().length} characters; maximum is ${MAXIMUM_BOUNDARY_URL_CHARACTERS}.`,
        );
      }
      const url = new URL(request.url());
      const requestRedirectChain = step7Gate3RedirectChain(request);
      fetchDestination = request.headers()["sec-fetch-dest"] ?? null;
      if ((fetchDestination?.length ?? 0) > 64) {
        throw new RangeError(
          `Gate-3 browser request ${url.href} has an oversized fetch destination.`,
        );
      }
      if (
        url.protocol !== "http:" ||
        url.origin !== input.expectedOrigin ||
        url.username !== "" ||
        url.password !== "" ||
        url.hash !== ""
      ) {
        throw new TypeError(
          `Gate-3 browser request ${url.href} escaped exact origin ${input.expectedOrigin}.`,
        );
      }
      if (request.method() !== "GET") {
        throw new TypeError(
          `Gate-3 browser request ${url.href} used ${request.method()}; only GET is admitted.`,
        );
      }
      if (requestRedirectChain.length !== 0) {
        throw new TypeError(
          `Gate-3 browser request ${url.href} followed ${requestRedirectChain.length} redirect hops; redirects are forbidden.`,
        );
      }
      let decodedAbsoluteUrl: string;
      try {
        decodedAbsoluteUrl = decodeURIComponent(url.href).replaceAll("\\", "/");
      } catch {
        throw new TypeError(`Gate-3 browser request ${url.href} has invalid URL escaping.`);
      }
      if (
        input.forbiddenUrlFragments.some((fragment) =>
          decodedAbsoluteUrl
            .toLocaleLowerCase("en-US")
            .includes(fragment.replaceAll("\\", "/").toLocaleLowerCase("en-US")),
        )
      ) {
        throw new TypeError(
          `Gate-3 browser request ${url.href} names retained run or CAS material.`,
        );
      }

      const relativeRequestUrl = relativeStep7Gate3HttpUrl(url.href);
      const {
        isRunner,
        isWorkerControl,
        isCloseTimeControl,
        isCloseTimeCompanion,
        isPdfWorker,
        isPdf,
        sourcePath,
        resourceKind,
      } = classifyStep7Gate3RequestResource({
        url,
        relativeRequestUrl,
        repoRoot,
        allowedSourcePaths,
        requiredPdfRelativeUrl,
        requiredWorkerRelativeUrl,
        requiredCloseTimeControlRelativeUrl,
      });
      if (
        fetchDestination === "sharedworker" ||
        fetchDestination === "serviceworker" ||
        (fetchDestination === "worker" && !isWorkerControl && !isPdfWorker)
      ) {
        throw new TypeError(
          `Gate-3 browser request ${url.href} used forbidden fetch destination ${fetchDestination}.`,
        );
      }
      if (
        (!isRunner &&
          !isWorkerControl &&
          !isCloseTimeControl &&
          !isCloseTimeCompanion &&
          !isPdf &&
          (sourcePath === null || !isAuditedStep7Gate3ViteQuery(url))) ||
        (isRunner &&
          (url.search !== "" ||
            !request.isNavigationRequest() ||
            request.resourceType() !== "document")) ||
        (isWorkerControl &&
          (url.search !== "" ||
            request.isNavigationRequest() ||
            request.resourceType() !== "script")) ||
        (isCloseTimeControl &&
          (url.search !== "" ||
            request.isNavigationRequest() ||
            request.resourceType() !== "fetch")) ||
        (isCloseTimeCompanion &&
          (url.search !== "" ||
            !request.isNavigationRequest() ||
            request.resourceType() !== "document")) ||
        (isPdfWorker && request.isNavigationRequest()) ||
        (isPdf && request.resourceType() !== "fetch")
      ) {
        throw new TypeError(
          `Gate-3 browser request ${url.href} is not the runner, worker/close control, exact PDF/worker fetch, or an audited locked-source module request.`,
        );
      }

      let response: Gate3BoundaryEvent["response"];
      if (isRunner) {
        response = await fulfillStep7Gate3SyntheticSource(route, url.href, "runner");
      } else if (isWorkerControl) {
        response = await fulfillStep7Gate3SyntheticSource(route, url.href, "worker-control");
      } else if (isCloseTimeControl) {
        response = await fulfillStep7Gate3SyntheticSource(route, url.href, "close-time-control");
      } else if (isCloseTimeCompanion) {
        response = await fulfillStep7Gate3SyntheticSource(route, url.href, "close-time-companion");
      } else {
        const fetched = await route.fetch({ maxRedirects: 0, timeout: 120_000 });
        const responseUrl = new URL(fetched.url());
        const headers = fetched.headers();
        const contentType = headers["content-type"] ?? "";
        const location = headers.location ?? null;
        if (
          fetched.status() < 200 ||
          fetched.status() >= 300 ||
          responseUrl.href !== url.href ||
          responseUrl.origin !== input.expectedOrigin ||
          location !== null
        ) {
          throw new TypeError(
            `Gate-3 browser response for ${url.href} returned URL ${responseUrl.href}, HTTP ${fetched.status()}, and redirect location ${JSON.stringify(location)}; exact non-redirected success is required.`,
          );
        }
        if (
          ((resourceKind === "locked-source" || resourceKind === "pdf-worker") &&
            !isStep7Gate3ExecutableContentType(contentType)) ||
          (resourceKind === "input-pdf" && !PDF_CONTENT_TYPE.test(contentType))
        ) {
          throw new TypeError(
            `Gate-3 ${resourceKind} response ${url.href} has content type ${JSON.stringify(contentType)}.`,
          );
        }
        const contentSecurityPolicy =
          resourceKind === "pdf-worker"
            ? STEP7_GATE3_PDF_WORKER_CONTENT_SECURITY_POLICY
            : (headers["content-security-policy"] ?? null);
        await route.fulfill(
          resourceKind === "pdf-worker"
            ? {
                response: fetched,
                headers: {
                  ...headers,
                  "content-security-policy": STEP7_GATE3_PDF_WORKER_CONTENT_SECURITY_POLICY,
                },
              }
            : { response: fetched },
        );
        response = Object.freeze({
          absoluteUrl: responseUrl.href,
          status: fetched.status(),
          contentType,
          contentSecurityPolicy,
          location: null,
          synthetic: false,
          bodyDigest: null,
        });
      }
      events.push(
        Object.freeze({
          sequence: reservedSequence,
          absoluteRequestUrl: url.href,
          origin: url.origin,
          relativeRequestUrl,
          method: request.method(),
          resourceType: request.resourceType(),
          fetchDestination,
          navigationRequest: request.isNavigationRequest(),
          redirectChain: requestRedirectChain,
          resourceKind,
          sourcePath,
          response,
        }),
      );
    } catch (error) {
      const normalized = rememberFailure(error);
      if (blockedEvents.length < MAXIMUM_BOUNDARY_EVENTS) {
        blockedEvents.push(
          Object.freeze({
            sequence: reservedSequence,
            absoluteRequestUrl: boundedStringWithoutLivePrototype(
              request.url(),
              MAXIMUM_BOUNDARY_URL_CHARACTERS,
            ),
            method: request.method(),
            resourceType: request.resourceType(),
            fetchDestination,
            failure: boundedStringWithoutLivePrototype(
              normalized.message,
              MAXIMUM_BOUNDARY_FAILURE_CHARACTERS,
            ),
          }),
        );
      }
      try {
        await route.abort("blockedbyclient");
      } catch {
        // The retained boundary failure remains fatal if the route already settled.
      }
    }
  };

  const lifecycle = createStep7Gate3ObserverLifecycle({
    page: input.page,
    maximumRequests: MAXIMUM_BOUNDARY_EVENTS,
    maximumUrlCharacters: MAXIMUM_BOUNDARY_URL_CHARACTERS,
    maximumPages: requiredCloseTimeControlRelativeUrl === null ? 1 : 2,
    handleRoute: handle,
    rememberFailure,
  });

  return {
    install: async () => {
      if (finished) {
        throw new TypeError("Gate-3 source execution boundary may be installed once.");
      }
      await lifecycle.install();
    },
    authorizePreRouteCspControlRequests: (urls: Step7Gate3CspImportControlUrls) => {
      if (finished) {
        throw new TypeError(
          "Gate-3 pre-route CSP controls cannot be authorized after source finalization.",
        );
      }
      let blobUrl: URL;
      try {
        blobUrl = new URL(urls.blobUrl);
      } catch {
        throw new TypeError(
          `Gate-3 blob import control URL ${JSON.stringify(urls.blobUrl)} is not an absolute URL.`,
        );
      }
      if (
        urls.blobUrl.length > MAXIMUM_BOUNDARY_URL_CHARACTERS ||
        blobUrl.protocol !== "blob:" ||
        blobUrl.origin !== input.expectedOrigin ||
        !urls.blobUrl.startsWith(`blob:${input.expectedOrigin}/`)
      ) {
        throw new TypeError(
          `Gate-3 blob import control ${JSON.stringify(urls.blobUrl)} must be one bounded blob URL owned by ${input.expectedOrigin}.`,
        );
      }
      if (urls.dataUrl !== STEP7_GATE3_DATA_IMPORT_CONTROL_URL) {
        throw new TypeError(
          `Gate-3 data import control ${JSON.stringify(urls.dataUrl)} does not match the fixed CSP probe.`,
        );
      }
      if (urls.externalUrl !== STEP7_GATE3_EXTERNAL_IMPORT_CONTROL_URL) {
        throw new TypeError(
          `Gate-3 external import control ${JSON.stringify(urls.externalUrl)} does not match the fixed CSP probe.`,
        );
      }
      lifecycle.authorizePreRouteCspControlRequests({
        blobUrl: urls.blobUrl,
        externalUrl: urls.externalUrl,
      });
    },
    drainExecutableResponseUrls: async () => {
      await lifecycle.drain();
      if (failure !== null) throw failure;
      return Object.freeze(
        events
          .filter(
            ({ resourceKind }) =>
              resourceKind === "locked-source" ||
              resourceKind === "pdf-worker" ||
              resourceKind === "worker-control" ||
              resourceKind === "close-time-control",
          )
          .sort((left, right) => left.sequence - right.sequence)
          .map(({ absoluteRequestUrl }) => absoluteRequestUrl),
      );
    },
    quiesce: lifecycle.quiesce,
    finish: async () => {
      if (finished) throw new TypeError("Gate-3 source execution boundary was already finalized.");
      finished = true;
      try {
        await lifecycle.finish();
      } catch (error) {
        const normalized = rememberFailure(error);
        failureReported = true;
        throw normalized;
      }
      if (failure !== null) {
        failureReported = true;
        throw failure;
      }
      const orderedEvents = Object.freeze(
        events.slice().sort((left, right) => left.sequence - right.sequence),
      );
      if (
        orderedEvents.length === 0 ||
        orderedEvents[0]?.resourceKind !== "runner" ||
        orderedEvents.filter(({ resourceKind }) => resourceKind === "runner").length !== 1
      ) {
        throw new TypeError(
          "Gate-3 source execution boundary did not observe one first synthetic runner request.",
        );
      }
      const requiredEntryMatches = Object.freeze(
        input.requiredEntryUrls.map((required) => {
          const allowedRelativeRequestUrls = auditedStep7Gate3RequiredResponseUrls(required);
          const matchedAbsoluteRequestUrls = Object.freeze(
            orderedEvents
              .filter(
                ({ origin, relativeRequestUrl, resourceKind }) =>
                  origin === input.expectedOrigin &&
                  (resourceKind === "locked-source" || resourceKind === "pdf-worker") &&
                  allowedRelativeRequestUrls.includes(relativeRequestUrl),
              )
              .map(({ absoluteRequestUrl }) => absoluteRequestUrl)
              .filter((url, index, urls) => urls.indexOf(url) === index)
              .sort((left, right) => left.localeCompare(right)),
          );
          return Object.freeze({
            requiredUrl: relativeStep7Gate3HttpUrl(required),
            allowedRelativeRequestUrls,
            matchedAbsoluteRequestUrls,
          });
        }),
      );
      const missingEntries = requiredEntryMatches
        .filter(({ matchedAbsoluteRequestUrls }) => matchedAbsoluteRequestUrls.length === 0)
        .map(({ requiredUrl }) => requiredUrl);
      if (missingEntries.length > 0) {
        throw new TypeError(
          `Gate-3 closed request boundary did not serve required entries: ${missingEntries.join(", ")}.`,
        );
      }
      if (
        requiredPdfRelativeUrl !== null &&
        !orderedEvents.some(
          ({ relativeRequestUrl, resourceKind }) =>
            resourceKind === "input-pdf" && relativeRequestUrl === requiredPdfRelativeUrl,
        )
      ) {
        throw new TypeError(
          `Gate-3 closed request boundary did not serve exact PDF ${requiredPdfRelativeUrl}.`,
        );
      }
      if (
        requiredWorkerRelativeUrl !== null &&
        (!orderedEvents.some(
          ({ relativeRequestUrl, resourceKind, response }) =>
            resourceKind === "pdf-worker" &&
            relativeRequestUrl === requiredWorkerRelativeUrl &&
            response.contentSecurityPolicy === STEP7_GATE3_PDF_WORKER_CONTENT_SECURITY_POLICY,
        ) ||
          !orderedEvents.some(
            ({ relativeRequestUrl, resourceKind, response }) =>
              resourceKind === "worker-control" &&
              relativeRequestUrl === STEP7_GATE3_WORKER_CONTROL_PATH &&
              response.contentSecurityPolicy === STEP7_GATE3_PDF_WORKER_CONTENT_SECURITY_POLICY,
          ))
      ) {
        throw new TypeError(
          `Gate-3 closed request boundary did not serve the exact PDF worker and worker control with CSP ${JSON.stringify(STEP7_GATE3_PDF_WORKER_CONTENT_SECURITY_POLICY)}.`,
        );
      }
      assertStep7Gate3CloseTimeControlClosure(orderedEvents, requiredCloseTimeControlRelativeUrl);
      const base = Object.freeze({
        schemaVersion: "lego.step7-gate3-source-execution-boundary/2" as const,
        expectedOrigin: input.expectedOrigin,
        bootstrapSourceManifestDigest: input.bootstrapSourceManifestDigest,
        allowedSourceFiles: allowedSourcePaths.size,
        requiredEntryMatches,
        requiredPdfUrl: requiredPdfRelativeUrl,
        requiredWorkerUrl: requiredWorkerRelativeUrl,
        requiredCloseTimeControlUrl: requiredCloseTimeControlRelativeUrl,
        contentSecurityPolicy: STEP7_GATE3_BLANK_RUNNER_CONTENT_SECURITY_POLICY,
        workerContentSecurityPolicy:
          requiredWorkerRelativeUrl === null
            ? null
            : STEP7_GATE3_PDF_WORKER_CONTENT_SECURITY_POLICY,
        blockedRequests: 0 as const,
        redirectResponses: 0 as const,
        upstreamResponseMemoryBound:
          "not-proved-route-fetch-may-materialize-before-body-evidence" as const,
        events: orderedEvents,
        observerClosure: lifecycle.snapshot(),
      });
      return Object.freeze({ ...base, manifestDigest: digest(JSON.stringify(base)) });
    },
    dispose: async () => {
      finished = true;
      await lifecycle.dispose();
      if (failure !== null && !failureReported) {
        failureReported = true;
        throw failure;
      }
    },
    snapshotUnverified: () =>
      Object.freeze({
        schemaVersion: "lego.step7-gate3-unverified-source-execution/1" as const,
        verification: "unverified-counterevidence" as const,
        authority: "none" as const,
        expectedOrigin: input.expectedOrigin,
        bootstrapSourceManifestDigest: input.bootstrapSourceManifestDigest,
        events: Object.freeze(events.slice().sort((left, right) => left.sequence - right.sequence)),
        blockedRequests: Object.freeze(
          blockedEvents
            .slice()
            .sort((left, right) => (left.sequence ?? sequence) - (right.sequence ?? sequence)),
        ),
        observerLifecycle: lifecycle.snapshot(),
      }),
  };
}
