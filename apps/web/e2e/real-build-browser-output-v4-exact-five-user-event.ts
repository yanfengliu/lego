import type { Sha256Digest } from "@lego-studio/brick-kernel";

const AUTHENTICATED_EVENT = Symbol(
  "RealBuildBrowserOutputV4ExactFiveAuthenticatedTrustedUserEvent",
);
const authenticatedEvents = new WeakSet<object>();
const WEAK_SET_HAS = WeakSet.prototype.has;
const APPLY = Reflect.apply;

export interface RealBuildBrowserOutputV4ExactFiveTrustedUserEventRequest {
  readonly schemaVersion: "lego.real-build-browser-output-v4-exact-five-user-event-request/1";
  readonly namespace: "production";
  readonly purpose: "admit-exact-five-official-frame-equivalence";
  readonly scope: "exact-five-source-parity-calibration-panels-only";
  readonly requestDigest: Sha256Digest;
  readonly reviewPresentationDigest: Sha256Digest;
}

/**
 * Opaque result reserved for an external trusted-user event consumer. This
 * repository has no parser, constructor, or issuer for the runtime capability.
 */
export interface RealBuildBrowserOutputV4ExactFiveAuthenticatedTrustedUserEvent {
  readonly schemaVersion: "lego.real-build-browser-output-v4-exact-five-authenticated-user-event/1";
  readonly authority: "trusted-user";
  readonly origin: "external-authenticated-user-event";
  readonly namespace: "production";
  readonly purpose: "admit-exact-five-official-frame-equivalence";
  readonly scope: "exact-five-source-parity-calibration-panels-only";
  readonly requestDigest: Sha256Digest;
  readonly reviewPresentationDigest: Sha256Digest;
  readonly challengeNonce: string;
  readonly challengeIssuedAtUnixMs: number;
  readonly consumedAtUnixMs: number;
  readonly eventIdentityDigest: Sha256Digest;
  readonly replayState: "consumed-one-use";
  readonly [AUTHENTICATED_EVENT]: true;
}

/**
 * Future released companion-broker seam. The repository can inspect a bounded
 * signed receipt as authority-free data, but it has no authenticated production
 * pairing/key source and therefore no path into the private capability set.
 */
export async function consumeRealBuildBrowserOutputV4ExactFiveTrustedUserEvent(
  _rawEvent: unknown,
  _request: RealBuildBrowserOutputV4ExactFiveTrustedUserEventRequest,
): Promise<RealBuildBrowserOutputV4ExactFiveAuthenticatedTrustedUserEvent> {
  void _rawEvent;
  void _request;
  throw new TypeError(
    "Exact-five calibration admission is unavailable: no external authenticated one-use trusted-user event consumer is integrated.",
  );
}

/**
 * Runtime capability check for the future external consumer's result. The
 * repository has no path that adds an event to this private set today.
 */
export function requireRealBuildBrowserOutputV4ExactFiveAuthenticatedTrustedUserEvent(
  value: unknown,
): RealBuildBrowserOutputV4ExactFiveAuthenticatedTrustedUserEvent {
  if (
    value === null ||
    typeof value !== "object" ||
    !(APPLY(WEAK_SET_HAS, authenticatedEvents, [value]) as boolean)
  ) {
    throw new TypeError(
      "Exact-five calibration authority requires a module-authenticated one-use trusted-user event capability.",
    );
  }
  return value as RealBuildBrowserOutputV4ExactFiveAuthenticatedTrustedUserEvent;
}
