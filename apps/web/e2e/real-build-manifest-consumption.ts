import { isV6ManifestCallout, type V6ManifestCallout } from "./real-build-safety";

export interface RealBuildManifestRows {
  readonly rawCount: number;
  readonly typed: readonly V6ManifestCallout[];
  readonly structurallyClosed: boolean;
  /** Rows are consumable only after the exact identification closure succeeds. */
  readonly trusted: readonly V6ManifestCallout[];
}

export function inspectRealBuildManifestRows(
  callouts: unknown,
  declaredCount: unknown,
  exactIdentificationClosureVerified: boolean,
): RealBuildManifestRows {
  const raw = Array.isArray(callouts) ? callouts : [];
  const typed = raw.filter(isV6ManifestCallout);
  const structurallyClosed =
    typed.length > 0 &&
    typed.length === raw.length &&
    declaredCount === typed.length &&
    new Set(typed.map(({ identity }) => identity)).size === typed.length;
  return {
    rawCount: raw.length,
    typed,
    structurallyClosed,
    trusted: exactIdentificationClosureVerified && structurallyClosed ? typed : [],
  };
}
