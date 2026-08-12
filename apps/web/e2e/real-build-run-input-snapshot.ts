import { describeBrowserThrown } from "./real-build-browser-error-boundary";
import { snapshotPanelCameraCanonicalDocument } from "./real-build-panel-camera-json-snapshot";
import type { RealBuildOptions, StepFailure } from "./real-build-safety";

interface DetachedRunInput {
  readonly parts: readonly [RealBuildOptions];
}

export interface RealBuildRunInputSnapshot {
  readonly options: RealBuildOptions;
  readonly canonical: string;
  readonly suppliedOptions: RealBuildOptions;
}

function snapshotOptions(value: unknown): {
  readonly options: RealBuildOptions;
  readonly canonical: string;
} {
  // Reuse the bounded, descriptor-only canonical JSON detacher. The one
  // `parts` entry is the complete options value; nested panels, accounting,
  // digests, coverage, actions, identities and coordinates are all copied.
  const snapshot = snapshotPanelCameraCanonicalDocument<DetachedRunInput>(
    Object.freeze({ parts: Object.freeze([value]) }),
    { maximumParts: 1 },
  );
  return { options: snapshot.document.parts[0], canonical: snapshot.canonical };
}

/** Detaches every result-determining JSON-like option before the first await. */
export function snapshotRealBuildRunInput(
  suppliedOptions: RealBuildOptions,
): RealBuildRunInputSnapshot {
  const detached = snapshotOptions(suppliedOptions);
  return Object.freeze({
    options: detached.options,
    canonical: detached.canonical,
    suppliedOptions,
  });
}

/**
 * Rejects post-preflight mutation before page rasterization or placement. The
 * detached copy remains the execution input, while this comparison makes a
 * concurrent caller edit explicit instead of silently changing run identity.
 */
export function realBuildRunInputDriftFailure(
  snapshot: RealBuildRunInputSnapshot,
): StepFailure | null {
  try {
    if (snapshotOptions(snapshot.suppliedOptions).canonical === snapshot.canonical) return null;
    return {
      code: "printed-step-sequence-invalid",
      stage: "input",
      inputKey: "panels",
      message:
        "The preflight-bound real-build input, including its panel order/page bindings, digests, accounting, " +
        "coverage, or execution budgets, changed during asynchronous module/PDF preparation. Execution was " +
        "refused before page rasterization, candidate search, or placement; submit one immutable input.",
    };
  } catch (error) {
    return {
      code: "printed-step-sequence-invalid",
      stage: "input",
      inputKey: "panels",
      message:
        "The preflight-bound real-build input could not be re-inspected after asynchronous module/PDF " +
        `preparation: ${describeBrowserThrown(error)}. Execution was refused before page rasterization, ` +
        "candidate search, or placement; submit plain immutable input data.",
    };
  }
}
