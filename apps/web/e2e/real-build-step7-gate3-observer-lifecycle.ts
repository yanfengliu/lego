import type { Page, Request, Response, Route, Worker } from "@playwright/test";

export interface Step7Gate3PreRouteCspControlFailure {
  readonly control: "blob-import" | "external-import";
  readonly absoluteRequestUrl: string;
  readonly method: "GET";
  readonly resourceType: "script";
  readonly failure: "csp";
  readonly responseObserved: false;
  readonly redirectObserved: false;
}

export interface Step7Gate3ObserverLifecycle {
  install(): Promise<void>;
  authorizePreRouteCspControlRequests(input: {
    readonly blobUrl: string;
    readonly externalUrl: string;
  }): void;
  drain(): Promise<void>;
  quiesce(beforeContextClose?: () => Promise<void>): Promise<void>;
  finish(): Promise<void>;
  dispose(): Promise<void>;
  snapshot(): Step7Gate3ObserverLifecycleSnapshot;
}

export interface Step7Gate3ObserverLifecycleSnapshot {
  readonly observedRequests: number;
  readonly uniqueObservedRequests: number;
  readonly routedRequests: number;
  readonly pendingRoutes: number;
  readonly contextClosed: boolean;
  readonly pages: number;
  readonly serviceWorkers: number;
  readonly dedicatedWorkers: number;
  readonly preRouteCspControlFailures: readonly Step7Gate3PreRouteCspControlFailure[];
  readonly sharedWorkerExecution: "blocked-by-context-init-script";
}

/**
 * Keeps the independent request observer and the routing gate attached until
 * every page in the observed context is closed and every routed request has
 * settled. Chromium can emit the two deliberately CSP-blocked policy-control
 * requests without invoking a route, so object-identity reconciliation keeps
 * that exact pre-authorized class separate from routing.
 */
export function createStep7Gate3ObserverLifecycle(input: {
  readonly page: Page;
  readonly maximumRequests: number;
  readonly maximumUrlCharacters: number;
  readonly maximumPages: 1 | 2;
  readonly handleRoute: (route: Route) => Promise<void>;
  readonly rememberFailure: (error: unknown) => Error;
}): Step7Gate3ObserverLifecycle {
  const context = input.page.context();
  const pending = new Set<Promise<void>>();
  const observedRequests: Request[] = [];
  const routedRequests = new Set<Request>();
  const failedRequests = new Map<Request, string>();
  const responseRequests = new Set<Request>();
  const observedPages = new Set<Page>();
  const observedDedicatedWorkers = new Set<Worker>();
  const dedicatedWorkers = new Set<Worker>();
  let installed = false;
  let quiesced = false;
  let detached = false;
  let contextClosed = false;
  let expectedPreRouteCspControlRequests: {
    readonly blobUrl: string;
    readonly externalUrl: string;
  } | null = null;
  let observedRequestIdentitiesAtControlAuthorization: ReadonlySet<Request> | null = null;
  let preRouteCspControlFailures: readonly Step7Gate3PreRouteCspControlFailure[] = Object.freeze(
    [],
  );

  const contextCloseObserver = (): void => {
    contextClosed = true;
  };

  const serviceWorkerObserver = (): void => {
    input.rememberFailure(
      new TypeError(
        "Gate-3 browser created a service worker even though the real-build context requires serviceWorkers=block.",
      ),
    );
  };

  const workerObserver = (worker: Worker): void => {
    if (observedDedicatedWorkers.has(worker)) return;
    observedDedicatedWorkers.add(worker);
    dedicatedWorkers.add(worker);
    worker.on("close", workerDestroyedObserver);
  };

  const workerDestroyedObserver = (worker: Worker): void => {
    dedicatedWorkers.delete(worker);
  };

  const observePage = (page: Page): void => {
    if (observedPages.has(page)) return;
    if (observedPages.size >= input.maximumPages) {
      input.rememberFailure(
        new RangeError(
          `Gate-3 browser created more than ${input.maximumPages} audited context pages.`,
        ),
      );
    }
    observedPages.add(page);
    for (const worker of page.workers()) workerObserver(worker);
    page.on("worker", workerObserver);
  };

  const detachPageObservers = (): void => {
    for (const page of observedPages) {
      page.off("worker", workerObserver);
    }
    for (const worker of observedDedicatedWorkers) worker.off("close", workerDestroyedObserver);
  };

  const routeHandler = (route: Route): Promise<void> => {
    routedRequests.add(route.request());
    const inFlight = input.handleRoute(route).finally(() => pending.delete(inFlight));
    pending.add(inFlight);
    return inFlight;
  };

  const requestObserver = (request: Request): void => {
    if (observedRequests.length >= input.maximumRequests) {
      input.rememberFailure(
        new RangeError(`Gate-3 browser emitted more than ${input.maximumRequests} request events.`),
      );
      return;
    }
    observedRequests.push(request);
  };

  const requestFailedObserver = (request: Request): void => {
    try {
      failedRequests.set(request, request.failure()?.errorText ?? "unavailable");
    } catch (error) {
      input.rememberFailure(error);
      failedRequests.set(request, "unavailable");
    }
  };

  const responseObserver = (response: Response): void => {
    responseRequests.add(response.request());
  };

  const drain = async (): Promise<void> => {
    while (pending.size > 0) await Promise.all([...pending]);
    await new Promise<void>((resolveTurn) => setImmediate(resolveTurn));
    while (pending.size > 0) await Promise.all([...pending]);
  };

  const reconcileRequestObservation = (): void => {
    const observed = new Set(observedRequests);
    const notObserved = [...routedRequests].find((request) => !observed.has(request));
    const unrouted = observedRequests.filter((request) => !routedRequests.has(request));
    const retainedControls: Step7Gate3PreRouteCspControlFailure[] = [];
    const problems: string[] = [];
    if (observed.size !== observedRequests.length) {
      problems.push("the request observer emitted duplicate Request identities");
    }
    if (notObserved !== undefined) {
      problems.push("a routed Request identity was absent from the independent request observer");
    }
    const expectedControls =
      expectedPreRouteCspControlRequests === null
        ? []
        : [
            {
              control: "blob-import" as const,
              absoluteRequestUrl: expectedPreRouteCspControlRequests.blobUrl,
            },
            {
              control: "external-import" as const,
              absoluteRequestUrl: expectedPreRouteCspControlRequests.externalUrl,
            },
          ];
    const unmatchedByUrl = new Map<string, Request[]>();
    for (const request of unrouted) {
      let url = "unavailable";
      try {
        url = request.url().slice(0, input.maximumUrlCharacters);
      } catch (error) {
        input.rememberFailure(error);
      }
      const requests = unmatchedByUrl.get(url) ?? [];
      requests.push(request);
      unmatchedByUrl.set(url, requests);
    }
    for (const expected of expectedControls) {
      const matches = unmatchedByUrl.get(expected.absoluteRequestUrl) ?? [];
      if (matches.length !== 1) {
        problems.push(
          `expected one ${expected.control} CSP control request at ${JSON.stringify(expected.absoluteRequestUrl)} but observed ${matches.length}`,
        );
        continue;
      }
      unmatchedByUrl.delete(expected.absoluteRequestUrl);
      const request = matches[0]!;
      if (observedRequestIdentitiesAtControlAuthorization?.has(request) === true) {
        problems.push(
          `${expected.control} CSP control ${JSON.stringify(expected.absoluteRequestUrl)} was observed before it was authorized`,
        );
        continue;
      }
      let method = "unavailable";
      let resourceType = "unavailable";
      let redirectObserved = true;
      try {
        method = request.method();
        resourceType = request.resourceType();
        redirectObserved = request.redirectedFrom() !== null || request.redirectedTo() !== null;
      } catch (error) {
        input.rememberFailure(error);
      }
      const failure = failedRequests.get(request) ?? "unavailable";
      const responseObserved = responseRequests.has(request);
      if (
        method !== "GET" ||
        resourceType !== "script" ||
        failure !== "csp" ||
        responseObserved ||
        redirectObserved
      ) {
        problems.push(
          `${expected.control} CSP control ${JSON.stringify(expected.absoluteRequestUrl)} was method=${method}, resourceType=${resourceType}, failure=${JSON.stringify(failure)}, responseObserved=${responseObserved}, redirectObserved=${redirectObserved}; required GET/script, exact csp failure, no response, and no redirect`,
        );
        continue;
      }
      retainedControls.push(
        Object.freeze({
          control: expected.control,
          absoluteRequestUrl: expected.absoluteRequestUrl,
          method: "GET" as const,
          resourceType: "script" as const,
          failure: "csp" as const,
          responseObserved: false as const,
          redirectObserved: false as const,
        }),
      );
    }
    const unaccounted = [...unmatchedByUrl.entries()];
    if (unaccounted.length > 0) {
      const [url, requests] = unaccounted[0]!;
      problems.push(
        `${unaccounted.reduce((count, [, entries]) => count + entries.length, 0)} unaccounted observed request(s), first ${JSON.stringify(url)} with ${requests.length} Request object(s)`,
      );
    }
    preRouteCspControlFailures = Object.freeze(retainedControls);
    if (problems.length > 0) {
      input.rememberFailure(
        new TypeError(
          `Gate-3 request observation/routing closure failed with ${observedRequests.length} request events, ` +
            `${observed.size} unique request objects, ${routedRequests.size} routed requests, and ` +
            `${retainedControls.length} exact pre-route CSP control failures: ${problems.join("; ")}. ` +
            "Every other observed request must pass the route gate before the context is quiesced.",
        ),
      );
    }
  };

  const detach = async (): Promise<void> => {
    if (!installed || detached) return;
    try {
      if (!contextClosed) await context.unroute("**/*", routeHandler);
    } finally {
      context.off("request", requestObserver);
      context.off("requestfailed", requestFailedObserver);
      context.off("response", responseObserver);
      context.off("serviceworker", serviceWorkerObserver);
      context.off("page", observePage);
      context.off("close", contextCloseObserver);
      detachPageObservers();
      detached = true;
    }
  };

  const quiesce = async (beforeContextClose?: () => Promise<void>): Promise<void> => {
    if (quiesced) return;
    if (!installed || detached) {
      throw new TypeError("Gate-3 source execution boundary was never installed.");
    }
    const initialPages = context.pages();
    if (
      initialPages.length !== input.maximumPages ||
      !initialPages.includes(input.page) ||
      input.page.isClosed()
    ) {
      input.rememberFailure(
        new TypeError(
          `Gate-3 request boundary expected ${input.maximumPages} live audited pages including its primary before quiescence; found ${initialPages.length} and primaryClosed=${input.page.isClosed()}.`,
        ),
      );
    }
    try {
      await input.page.goto("about:blank");
    } catch (error) {
      input.rememberFailure(error);
    }
    try {
      await beforeContextClose?.();
    } catch (error) {
      input.rememberFailure(error);
    }
    try {
      await drain();
    } catch (error) {
      input.rememberFailure(error);
    }
    try {
      const primaryPageClosed = input.page.waitForEvent("close", { timeout: 5_000 });
      await input.page.close({ runBeforeUnload: true });
      await primaryPageClosed;
      await drain();
    } catch (error) {
      input.rememberFailure(error);
    }
    try {
      await context.close();
    } catch (error) {
      input.rememberFailure(error);
    }
    if (
      !contextClosed ||
      context.pages().length !== 0 ||
      context.serviceWorkers().length !== 0 ||
      dedicatedWorkers.size !== 0
    ) {
      input.rememberFailure(
        new TypeError(
          `Gate-3 request boundary did not close its complete context: contextClosed=${contextClosed}, ` +
            `pages=${context.pages().length}, serviceWorkers=${context.serviceWorkers().length}, ` +
            `dedicatedWorkers=${dedicatedWorkers.size}.`,
        ),
      );
    }
    await drain();
    reconcileRequestObservation();
    quiesced =
      contextClosed &&
      context.pages().length === 0 &&
      context.serviceWorkers().length === 0 &&
      dedicatedWorkers.size === 0;
  };

  const finish = async (): Promise<void> => {
    if (!installed || detached) {
      throw new TypeError("Gate-3 source execution boundary was never installed.");
    }
    if (!quiesced) {
      throw new TypeError(
        "Gate-3 source execution boundary must quiesce its observed context before finalization.",
      );
    }
    await drain();
    reconcileRequestObservation();
    try {
      await detach();
    } catch (error) {
      input.rememberFailure(error);
    }
  };

  return {
    install: async () => {
      if (installed) {
        throw new TypeError("Gate-3 source execution boundary may be installed once.");
      }
      await context.addInitScript(() => {
        class BlockedSharedWorker {
          constructor() {
            throw new DOMException(
              "SharedWorker execution is disabled inside the Gate-3 source boundary.",
              "SecurityError",
            );
          }
        }
        Object.defineProperty(globalThis, "SharedWorker", {
          value: BlockedSharedWorker,
          configurable: false,
          enumerable: false,
          writable: false,
        });
      });
      if (context.serviceWorkers().length !== 0) {
        throw new TypeError(
          `Gate-3 source execution started with ${context.serviceWorkers().length} service workers; zero are required.`,
        );
      }
      context.on("request", requestObserver);
      context.on("requestfailed", requestFailedObserver);
      context.on("response", responseObserver);
      context.on("serviceworker", serviceWorkerObserver);
      context.on("page", observePage);
      context.on("close", contextCloseObserver);
      for (const page of context.pages()) observePage(page);
      try {
        await context.route("**/*", routeHandler);
        installed = true;
      } catch (error) {
        context.off("request", requestObserver);
        context.off("requestfailed", requestFailedObserver);
        context.off("response", responseObserver);
        context.off("serviceworker", serviceWorkerObserver);
        context.off("page", observePage);
        context.off("close", contextCloseObserver);
        detachPageObservers();
        throw error;
      }
    },
    authorizePreRouteCspControlRequests: ({ blobUrl, externalUrl }) => {
      if (!installed || detached || quiesced) {
        throw new TypeError(
          "Gate-3 pre-route CSP controls must be authorized after installation and before quiescence.",
        );
      }
      if (expectedPreRouteCspControlRequests !== null) {
        throw new TypeError("Gate-3 pre-route CSP controls may be authorized exactly once.");
      }
      expectedPreRouteCspControlRequests = Object.freeze({ blobUrl, externalUrl });
      observedRequestIdentitiesAtControlAuthorization = new Set(observedRequests);
    },
    drain,
    quiesce,
    finish,
    dispose: async () => {
      if (detached) return;
      if (!installed) {
        if (!contextClosed) await context.close();
        contextClosed = true;
        detached = true;
        return;
      }
      let disposalFailure: unknown = null;
      try {
        if (!quiesced) await quiesce();
        await drain();
        reconcileRequestObservation();
      } catch (error) {
        disposalFailure = error;
      }
      try {
        await detach();
      } catch (error) {
        disposalFailure ??= error;
      }
      if (disposalFailure !== null) throw disposalFailure;
    },
    snapshot: () =>
      Object.freeze({
        observedRequests: observedRequests.length,
        uniqueObservedRequests: new Set(observedRequests).size,
        routedRequests: routedRequests.size,
        pendingRoutes: pending.size,
        contextClosed,
        pages: context.pages().length,
        serviceWorkers: context.serviceWorkers().length,
        dedicatedWorkers: dedicatedWorkers.size,
        preRouteCspControlFailures,
        sharedWorkerExecution: "blocked-by-context-init-script" as const,
      }),
  };
}
