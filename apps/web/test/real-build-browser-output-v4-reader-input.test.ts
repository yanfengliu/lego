import { describe, expect, it } from "vitest";

import { inspectRealBuildBrowserOutputV4 } from "../e2e/real-build-browser-output-v4-reader";
import { snapshotCurrentRealBuildBrowserOutputV4 } from "../e2e/real-build-browser-output-snapshot";
import type { InspectRealBuildBrowserOutputV4Input } from "../e2e/real-build-browser-output-v4-reader-types";

function inertTuple(): InspectRealBuildBrowserOutputV4Input {
  return {
    browserOutput: null,
    preparedRunInputBytes: null,
    branchEvidenceBytes: null,
    compiledBranchRoleBytes: null,
    branchObservationRoleBytes: null,
    sourceManifestBytes: null,
    sourceInspection: null,
    cameraManifestBytes: null,
    cameraRenderRoleBytes: null,
    cameraMaskRoleBytes: null,
    transitionManifestBytes: null,
  };
}

describe("browser-output /4 outer tuple snapshot", () => {
  it("charges repeated aliases by their expanded detached JSON size", () => {
    const aliased = Object.fromEntries(
      Array.from({ length: 128 }, (_, index) => [
        `${String(index).padStart(3, "0")}${"x".repeat(253)}`,
        null,
      ]),
    );
    const expanded = Array.from({ length: 2_100 }, () => aliased);

    expect(snapshotCurrentRealBuildBrowserOutputV4(expanded, 359, 100_000)).toEqual({
      ok: false,
      defect: "Browser-output serialized JSON exceeds 67108864 bytes.",
    });
  });

  it("rejects a Proxy without invoking any trap", () => {
    let traps = 0;
    const hostile = new Proxy(inertTuple(), {
      get() {
        traps += 1;
        throw new Error("reader invoked a hostile get trap");
      },
      getOwnPropertyDescriptor() {
        traps += 1;
        throw new Error("reader invoked a hostile descriptor trap");
      },
      ownKeys() {
        traps += 1;
        throw new Error("reader invoked a hostile ownKeys trap");
      },
    });

    expect(() => inspectRealBuildBrowserOutputV4(hostile)).toThrow(/non-Proxy plain object/iu);
    expect(traps).toBe(0);
  });

  it("rejects an accessor without invoking it", () => {
    let reads = 0;
    const hostile = inertTuple() as unknown as Record<string, unknown>;
    Object.defineProperty(hostile, "sourceManifestBytes", {
      enumerable: true,
      configurable: true,
      get() {
        reads += 1;
        return reads === 1 ? new Uint8Array([1]) : new Uint8Array([2]);
      },
    });

    expect(() =>
      inspectRealBuildBrowserOutputV4(hostile as unknown as InspectRealBuildBrowserOutputV4Input),
    ).toThrow(/sourceManifestBytes.*own data field.*never invoked/iu);
    expect(reads).toBe(0);
  });

  it("rejects extra tuple fields before parsing any role", () => {
    const hostile = { ...inertTuple(), surpriseRole: new Uint8Array([1]) };
    expect(() => inspectRealBuildBrowserOutputV4(hostile)).toThrow(/must contain exactly/iu);
  });
});
