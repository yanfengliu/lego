import { createHash } from "node:crypto";

import type { Route } from "@playwright/test";

import {
  STEP7_GATE3_BLANK_RUNNER_CONTENT_SECURITY_POLICY,
  STEP7_GATE3_BLANK_RUNNER_HTML,
} from "./real-build-step7-gate3-runner-policy";
import type {
  Gate3BoundaryEvent,
  Gate3BoundaryResourceKind,
} from "./real-build-step7-gate3-source-evidence";
import { relativeStep7Gate3HttpUrl } from "./real-build-step7-gate3-source-policy";
import {
  STEP7_GATE3_PDF_WORKER_CONTENT_SECURITY_POLICY,
  STEP7_GATE3_WORKER_CONTROL_SOURCE,
} from "./real-build-step7-gate3-worker-policy";

export const STEP7_GATE3_CLOSE_TIME_CONTROL_PATH =
  "/__real_build_close_time_observer_control__.mjs";
export const STEP7_GATE3_CLOSE_TIME_COMPANION_PATH =
  "/__real_build_close_time_observer_companion__";
export const STEP7_GATE3_CLOSE_TIME_CONTROL_SOURCE =
  'export const closeTimeObserverControl = "gate3-close-time-observer-control";\n';

type SyntheticResourceKind = Extract<
  Gate3BoundaryResourceKind,
  "runner" | "worker-control" | "close-time-control" | "close-time-companion"
>;

const digest = (body: string): string =>
  `sha256:${createHash("sha256").update(body).digest("hex")}`;

export const requiredStep7Gate3CloseTimeControlUrl = (url: string | null): string | null => {
  if (url === null) return null;
  const relativeUrl = relativeStep7Gate3HttpUrl(url);
  if (relativeUrl !== STEP7_GATE3_CLOSE_TIME_CONTROL_PATH) {
    throw new TypeError(
      `Gate-3 close-time control must use exact audited URL ${STEP7_GATE3_CLOSE_TIME_CONTROL_PATH}.`,
    );
  }
  return relativeUrl;
};

export const assertStep7Gate3CloseTimeControlClosure = (
  events: readonly Gate3BoundaryEvent[],
  requiredControlUrl: string | null,
): void => {
  if (requiredControlUrl === null) return;
  const controls = events.filter(
    ({ relativeRequestUrl, resourceKind }) =>
      resourceKind === "close-time-control" && relativeRequestUrl === requiredControlUrl,
  ).length;
  const companions = events.filter(
    ({ relativeRequestUrl, resourceKind }) =>
      resourceKind === "close-time-companion" &&
      relativeRequestUrl === STEP7_GATE3_CLOSE_TIME_COMPANION_PATH,
  ).length;
  if (controls !== 1 || companions !== 1) {
    throw new TypeError(
      `Gate-3 closed request boundary requires exactly one close-time companion and control; observed ${companions} and ${controls}.`,
    );
  }
};

const syntheticSource = (
  resourceKind: SyntheticResourceKind,
): {
  readonly body: string;
  readonly contentType: string;
  readonly contentSecurityPolicy: string;
} => {
  switch (resourceKind) {
    case "runner":
    case "close-time-companion":
      return {
        body: STEP7_GATE3_BLANK_RUNNER_HTML,
        contentType: "text/html; charset=utf-8",
        contentSecurityPolicy: STEP7_GATE3_BLANK_RUNNER_CONTENT_SECURITY_POLICY,
      };
    case "worker-control":
      return {
        body: STEP7_GATE3_WORKER_CONTROL_SOURCE,
        contentType: "text/javascript; charset=utf-8",
        contentSecurityPolicy: STEP7_GATE3_PDF_WORKER_CONTENT_SECURITY_POLICY,
      };
    case "close-time-control":
      return {
        body: STEP7_GATE3_CLOSE_TIME_CONTROL_SOURCE,
        contentType: "text/javascript; charset=utf-8",
        contentSecurityPolicy: STEP7_GATE3_PDF_WORKER_CONTENT_SECURITY_POLICY,
      };
  }
};

export async function fulfillStep7Gate3SyntheticSource(
  route: Route,
  absoluteUrl: string,
  resourceKind: SyntheticResourceKind,
): Promise<Gate3BoundaryEvent["response"]> {
  const source = syntheticSource(resourceKind);
  await route.fulfill({
    status: 200,
    headers: {
      "cache-control": "no-store",
      "content-security-policy": source.contentSecurityPolicy,
      "content-type": source.contentType,
    },
    body: source.body,
  });
  return Object.freeze({
    absoluteUrl,
    status: 200,
    contentType: source.contentType,
    contentSecurityPolicy: source.contentSecurityPolicy,
    location: null,
    synthetic: true,
    bodyDigest: digest(source.body),
  });
}
