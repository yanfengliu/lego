import type { RealBuildResult } from "./real-build-safety";

export const LOCAL_REAL_BUILD_AUTHORITY = Object.freeze({
  kind: "local-diagnostic",
  authenticated: false,
  trustSealDigest: null,
  reason: "released-companion-broker-unavailable",
} as const);

/** Runtime check for the only authority shape this unreleased local driver may emit. */
export function isLocalRealBuildAuthority(value: unknown): value is RealBuildResult["authority"] {
  if (typeof value !== "object" || value === null) return false;
  const authority = value as Partial<RealBuildResult["authority"]>;
  return (
    authority.kind === LOCAL_REAL_BUILD_AUTHORITY.kind &&
    authority.authenticated === LOCAL_REAL_BUILD_AUTHORITY.authenticated &&
    authority.trustSealDigest === LOCAL_REAL_BUILD_AUTHORITY.trustSealDigest &&
    authority.reason === LOCAL_REAL_BUILD_AUTHORITY.reason
  );
}
