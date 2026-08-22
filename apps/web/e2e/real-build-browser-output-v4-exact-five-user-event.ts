import type { Sha256Digest } from "@lego-studio/brick-kernel";

const AUTHENTICATED_EVENT = Symbol(
  "RealBuildBrowserOutputV4ExactFiveAuthenticatedTrustedUserEvent",
);

export interface RealBuildBrowserOutputV4ExactFiveTrustedUserEventChallenge {
  readonly schemaVersion: "lego.real-build-browser-output-v4-exact-five-user-event-challenge/1";
  readonly purpose: "admit-exact-five-official-frame-equivalence";
  readonly requestDigest: Sha256Digest;
}

/**
 * Opaque result reserved for an external trusted-user event consumer. This
 * repository has no parser, constructor, or issuer for the private brand.
 */
export interface RealBuildBrowserOutputV4ExactFiveAuthenticatedTrustedUserEvent {
  readonly schemaVersion: "lego.real-build-browser-output-v4-exact-five-authenticated-user-event/1";
  readonly authority: "trusted-user";
  readonly origin: "external-authenticated-user-event";
  readonly purpose: "admit-exact-five-official-frame-equivalence";
  readonly requestDigest: Sha256Digest;
  readonly eventIdentityDigest: Sha256Digest;
  readonly replayState: "consumed-one-use";
  readonly [AUTHENTICATED_EVENT]: true;
}

/**
 * Future companion-broker seam. No current browser, harness, model, packet, or
 * repository-local factory can authenticate or consume a user event.
 */
export function consumeRealBuildBrowserOutputV4ExactFiveTrustedUserEvent(
  _rawEvent: unknown,
  _challenge: RealBuildBrowserOutputV4ExactFiveTrustedUserEventChallenge,
): RealBuildBrowserOutputV4ExactFiveAuthenticatedTrustedUserEvent {
  void _rawEvent;
  void _challenge;
  throw new TypeError(
    "Exact-five calibration admission is unavailable: no external authenticated one-use trusted-user event consumer is integrated.",
  );
}
