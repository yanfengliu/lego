import { createHash } from "node:crypto";

import type { Page, Response } from "@playwright/test";

import {
  boundedStringWithoutLivePrototype,
  normalizeThrownWithoutProbing,
} from "./non-probing-error";
import {
  auditedStep7Gate3RequiredResponseUrls,
  isStep7Gate3ExecutableContentType,
  relativeStep7Gate3HttpUrl,
} from "./real-build-step7-gate3-source-policy";

const digest = (bytes: Uint8Array | string): string =>
  `sha256:${createHash("sha256").update(bytes).digest("hex")}`;

const MAXIMUM_SERVED_RESPONSES = 10_000;
const MAXIMUM_RESPONSE_URL_CHARACTERS = 8_192;
const MAXIMUM_RESPONSE_METADATA_CHARACTERS = 4_096;
const MAXIMUM_RESPONSE_FAILURE_CHARACTERS = 512;
const MAXIMUM_RESPONSE_BODY_BYTES = 16 * 1024 * 1024;
const MAXIMUM_TOTAL_RESPONSE_BODY_BYTES = 64 * 1024 * 1024;
const BODY_LIMIT_SEMANTICS =
  "canonical-content-length-required-when-present-plus-preflight-and-post-materialization-retained-evidence-bound" as const;

interface ServedJavaScriptResponse {
  readonly sequence: number;
  readonly absoluteUrl: string;
  readonly origin: string;
  readonly relativeUrl: string;
  readonly status: number;
  readonly method: string;
  readonly resourceType: string;
  readonly contentType: string;
  readonly contentSecurityPolicy: string | null;
  readonly declaredContentLength: number | null;
  readonly bytes: number;
  readonly digest: string;
}

type SettledRead =
  | { readonly status: "ok"; readonly response: ServedJavaScriptResponse }
  | {
      readonly status: "failed";
      readonly sequence: number;
      readonly absoluteUrl: string;
      readonly failure: string;
    };

export interface Step7Gate3UnverifiedServedJavaScriptSnapshot {
  readonly schemaVersion: "lego.step7-gate3-unverified-served-javascript/1";
  readonly verification: "unverified-counterevidence";
  readonly authority: "none";
  readonly browserInputDigest: string;
  readonly expectedOrigin: string;
  readonly bodyLimitSemantics: typeof BODY_LIMIT_SEMANTICS;
  readonly responseBodiesRetained: false;
  readonly observedExecutableUrls: readonly string[];
  readonly settledResponses: readonly ServedJavaScriptResponse[];
  readonly responseReadFailures: readonly Extract<SettledRead, { readonly status: "failed" }>[];
  readonly contextClosed: boolean;
  readonly pages: number;
  readonly serviceWorkers: number;
}

const canonicalContentLength = (value: string | undefined): number | null => {
  if (value === undefined) return null;
  if (value.length > 32 || !/^(?:0|[1-9][0-9]*)$/u.test(value)) {
    throw new TypeError(
      "Served JavaScript Content-Length is present but is not a canonical decimal byte count.",
    );
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) {
    throw new RangeError("Served JavaScript Content-Length exceeds the safe integer range.");
  }
  return parsed;
};

const boundedFailure = (error: unknown): string =>
  boundedStringWithoutLivePrototype(
    normalizeThrownWithoutProbing(
      error,
      "Served JavaScript response read rejected with a non-native value.",
    ).message,
    MAXIMUM_RESPONSE_FAILURE_CHARACTERS,
  );

export function captureServedJavaScript(input: {
  readonly page: Page;
  readonly expectedOrigin: string;
  readonly requiredEntryUrls: readonly string[];
  readonly forbiddenUrlFragments: readonly string[];
  readonly browserInputDigest: string;
}) {
  const expectedOrigin = new URL(input.expectedOrigin);
  if (
    expectedOrigin.origin !== input.expectedOrigin ||
    expectedOrigin.protocol !== "http:" ||
    (expectedOrigin.hostname !== "127.0.0.1" && expectedOrigin.hostname !== "localhost")
  ) {
    throw new TypeError(
      `Gate-3 expected served-module origin ${input.expectedOrigin} is not an exact local HTTP origin.`,
    );
  }
  const context = input.page.context();
  const reads: Promise<SettledRead>[] = [];
  const settledOutcomes: SettledRead[] = [];
  const pending = new Set<Promise<SettledRead>>();
  const observedExecutableUrls: string[] = [];
  let responseSequence = 0;
  let overflowRecorded = false;
  let declaredPreflightBytes = 0;
  let materializedBytes = 0;
  let contextClosed = false;
  const contextCloseListener = (): void => {
    contextClosed = true;
  };
  const listener = (response: Response): void => {
    const headers = response.headers();
    const contentType = headers["content-type"] ?? "";
    if (!isStep7Gate3ExecutableContentType(contentType)) return;
    const sequence = responseSequence;
    responseSequence += 1;
    const boundedUrl = response.url().slice(0, MAXIMUM_RESPONSE_URL_CHARACTERS);
    if (sequence >= MAXIMUM_SERVED_RESPONSES) {
      if (!overflowRecorded) {
        overflowRecorded = true;
        settledOutcomes.push(
          Object.freeze({
            status: "failed",
            sequence,
            absoluteUrl: boundedUrl,
            failure: `Gate-3 observed more than ${MAXIMUM_SERVED_RESPONSES} executable responses.`,
          }),
        );
      }
      return;
    }
    const url = new URL(response.url());
    observedExecutableUrls.push(boundedUrl);
    const read = (async (): Promise<ServedJavaScriptResponse> => {
      const contentSecurityPolicy = headers["content-security-policy"] ?? null;
      if (
        url.href.length > MAXIMUM_RESPONSE_URL_CHARACTERS ||
        contentType.length > MAXIMUM_RESPONSE_METADATA_CHARACTERS ||
        (contentSecurityPolicy?.length ?? 0) > MAXIMUM_RESPONSE_METADATA_CHARACTERS
      ) {
        throw new RangeError(`Served JavaScript ${boundedUrl} has oversized retained metadata.`);
      }
      const declaredContentLength = canonicalContentLength(headers["content-length"]);
      if (declaredContentLength !== null) {
        if (declaredContentLength > MAXIMUM_RESPONSE_BODY_BYTES) {
          throw new RangeError(
            `Served JavaScript ${url.href} declares ${declaredContentLength} bytes; maximum is 16 MiB.`,
          );
        }
        declaredPreflightBytes += declaredContentLength;
        if (declaredPreflightBytes > MAXIMUM_TOTAL_RESPONSE_BODY_BYTES) {
          throw new RangeError(
            `Gate-3 served JavaScript declares more than 64 MiB in aggregate; body read refused.`,
          );
        }
      }
      let body: Buffer;
      try {
        body = await response.body();
      } catch (error) {
        const normalized = normalizeThrownWithoutProbing(
          error,
          "Served JavaScript response body rejected with a non-native value.",
        );
        throw new Error(
          `Served JavaScript ${url.href} body could not be read: ${normalized.message}`,
          { cause: error },
        );
      }
      if (body.length > MAXIMUM_RESPONSE_BODY_BYTES) {
        throw new RangeError(
          `Served JavaScript ${url.href} has ${body.length} bytes; maximum is 16 MiB.`,
        );
      }
      materializedBytes += body.length;
      if (materializedBytes > MAXIMUM_TOTAL_RESPONSE_BODY_BYTES) {
        throw new RangeError(
          `Gate-3 served JavaScript materialized more than 64 MiB; retained evidence refused.`,
        );
      }
      return Object.freeze({
        sequence,
        absoluteUrl: url.href,
        origin: url.origin,
        relativeUrl: relativeStep7Gate3HttpUrl(url.href),
        status: response.status(),
        method: response.request().method(),
        resourceType: response.request().resourceType(),
        contentType,
        contentSecurityPolicy,
        declaredContentLength,
        bytes: body.length,
        digest: digest(body),
      });
    })();
    const settled = read.then<SettledRead, SettledRead>(
      (servedResponse) => Object.freeze({ status: "ok", response: servedResponse }),
      (error: unknown) =>
        Object.freeze({
          status: "failed",
          sequence,
          absoluteUrl: boundedUrl,
          failure: boundedFailure(error),
        }),
    );
    reads.push(settled);
    pending.add(settled);
    void settled.then((outcome) => {
      settledOutcomes.push(outcome);
      pending.delete(settled);
    });
  };
  context.on("response", listener);
  context.on("close", contextCloseListener);
  let detached = false;
  let finished = false;
  const detach = (): void => {
    if (detached) return;
    context.off("response", listener);
    context.off("close", contextCloseListener);
    detached = true;
  };
  const drainPending = async (): Promise<void> => {
    while (pending.size > 0) await Promise.all([...pending]);
    await new Promise<void>((resolveTurn) => setImmediate(resolveTurn));
    while (pending.size > 0) await Promise.all([...pending]);
  };
  const settledReads = async (): Promise<readonly SettledRead[]> => {
    await drainPending();
    const settled = await Promise.all(reads);
    const failures = settled.filter(
      (entry): entry is Extract<SettledRead, { readonly status: "failed" }> =>
        entry.status === "failed",
    );
    if (overflowRecorded) {
      failures.push(
        settledOutcomes.find(
          (entry): entry is Extract<SettledRead, { readonly status: "failed" }> =>
            entry.status === "failed" && entry.sequence === MAXIMUM_SERVED_RESPONSES,
        ) ??
          Object.freeze({
            status: "failed",
            sequence: MAXIMUM_SERVED_RESPONSES,
            absoluteUrl: "unavailable",
            failure: `Gate-3 observed more than ${MAXIMUM_SERVED_RESPONSES} executable responses.`,
          }),
      );
    }
    if (failures.length > 0) {
      throw new TypeError(
        `Gate-3 served-module capture failed: ${failures.map(({ failure }) => failure).join("; ")}.`,
      );
    }
    return settled;
  };
  const drain = async (): Promise<readonly string[]> => {
    await settledReads();
    return Object.freeze(observedExecutableUrls.slice());
  };
  const assertQuiesced = (): void => {
    if (!contextClosed || context.pages().length !== 0 || context.serviceWorkers().length !== 0) {
      throw new TypeError(
        `Gate-3 served-module capture cannot detach before complete context closure: ` +
          `contextClosed=${contextClosed}, pages=${context.pages().length}, ` +
          `serviceWorkers=${context.serviceWorkers().length}.`,
      );
    }
  };
  const dispose = async (): Promise<void> => {
    if (detached) return;
    try {
      assertQuiesced();
      await settledReads();
    } finally {
      detach();
    }
  };
  const finish = async () => {
    if (finished) throw new TypeError("Gate-3 served-module capture was already finalized.");
    finished = true;
    let settled: readonly SettledRead[];
    try {
      assertQuiesced();
      settled = await settledReads();
    } finally {
      detach();
    }
    const responses = settled
      .map((entry) => (entry as Extract<SettledRead, { readonly status: "ok" }>).response)
      .sort(
        (left, right) =>
          left.absoluteUrl.localeCompare(right.absoluteUrl) ||
          left.digest.localeCompare(right.digest),
      );
    const totalBytes = responses.reduce((total, response) => total + response.bytes, 0);
    if (totalBytes > 64 * 1024 * 1024) {
      throw new RangeError(
        `Gate-3 served JavaScript evidence covers ${totalBytes} response bytes; maximum is 64 MiB.`,
      );
    }
    if (
      responses.length === 0 ||
      responses.some(
        ({ absoluteUrl, origin, status, method }) =>
          origin !== input.expectedOrigin ||
          status !== 200 ||
          method !== "GET" ||
          input.forbiddenUrlFragments.some((fragment) => {
            try {
              return decodeURIComponent(absoluteUrl).includes(fragment.replaceAll("\\", "/"));
            } catch {
              return true;
            }
          }),
      )
    ) {
      throw new TypeError(
        "Gate-3 served-module capture was empty, non-200, non-GET, or reached a retained-source URL.",
      );
    }
    const requiredEntryMatches = Object.freeze(
      input.requiredEntryUrls.map((required) => {
        const allowedRelativeResponseUrls = auditedStep7Gate3RequiredResponseUrls(required);
        const matchedAbsoluteResponseUrls = Object.freeze(
          responses
            .filter(
              ({ origin, relativeUrl }) =>
                origin === input.expectedOrigin &&
                allowedRelativeResponseUrls.includes(relativeUrl),
            )
            .map(({ absoluteUrl }) => absoluteUrl)
            .filter((url, index, urls) => urls.indexOf(url) === index)
            .sort((left, right) => left.localeCompare(right)),
        );
        return Object.freeze({
          requiredUrl: relativeStep7Gate3HttpUrl(required),
          allowedRelativeResponseUrls,
          matchedAbsoluteResponseUrls,
        });
      }),
    );
    const missingEntries = requiredEntryMatches
      .filter(({ matchedAbsoluteResponseUrls }) => matchedAbsoluteResponseUrls.length === 0)
      .map(({ requiredUrl }) => requiredUrl);
    if (missingEntries.length > 0) {
      throw new TypeError(
        `Gate-3 browser did not fetch required current entry modules: ${missingEntries.join(", ")}.`,
      );
    }
    const base = Object.freeze({
      schemaVersion: "lego.step7-gate3-served-javascript/2" as const,
      browserInputDigest: input.browserInputDigest,
      expectedOrigin: input.expectedOrigin,
      requiredEntryUrls: Object.freeze(input.requiredEntryUrls.map(relativeStep7Gate3HttpUrl)),
      requiredEntryMatches,
      totalBytes,
      bodyLimitSemantics: BODY_LIMIT_SEMANTICS,
      responseBodiesRetained: false as const,
      responses: Object.freeze(responses),
    });
    return Object.freeze({ ...base, manifestDigest: digest(JSON.stringify(base)) });
  };
  const snapshotUnverified = (): Step7Gate3UnverifiedServedJavaScriptSnapshot => {
    const ordered = settledOutcomes.slice().sort((left, right) => {
      const leftSequence = left.status === "ok" ? left.response.sequence : left.sequence;
      const rightSequence = right.status === "ok" ? right.response.sequence : right.sequence;
      return leftSequence - rightSequence;
    });
    return Object.freeze({
      schemaVersion: "lego.step7-gate3-unverified-served-javascript/1",
      verification: "unverified-counterevidence",
      authority: "none",
      browserInputDigest: input.browserInputDigest,
      expectedOrigin: input.expectedOrigin,
      bodyLimitSemantics: BODY_LIMIT_SEMANTICS,
      responseBodiesRetained: false,
      observedExecutableUrls: Object.freeze(observedExecutableUrls.slice()),
      settledResponses: Object.freeze(
        ordered
          .filter(
            (entry): entry is Extract<SettledRead, { readonly status: "ok" }> =>
              entry.status === "ok",
          )
          .map(({ response }) => response),
      ),
      responseReadFailures: Object.freeze(
        ordered.filter(
          (entry): entry is Extract<SettledRead, { readonly status: "failed" }> =>
            entry.status === "failed",
        ),
      ),
      contextClosed,
      pages: context.pages().length,
      serviceWorkers: context.serviceWorkers().length,
    });
  };
  return Object.assign(finish, { dispose, drain, snapshotUnverified });
}
