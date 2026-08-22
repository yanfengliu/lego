import { describe, expect, it } from "vitest";

import { createRealBuildBrowserOutputV4TransitionFrontier } from "../e2e/real-build-browser-output-v4-transition-frontier";
import { createRealBuildBrowserOutputV4TransitionEvidenceManifest } from "../e2e/real-build-browser-output-v4-transition-frontier-evidence";

describe("browser-output /4 transition hostile inputs", () => {
  it("rejects a frontier Proxy without invoking a trap", () => {
    let traps = 0;
    const proxy = new Proxy(
      { throughStepNumber: 0, documentSnapshot: null, identities: [] },
      {
        getOwnPropertyDescriptor() {
          traps += 1;
          throw new Error("unexpected frontier descriptor trap");
        },
      },
    );
    expect(() => createRealBuildBrowserOutputV4TransitionFrontier(proxy)).toThrow(
      /non-Proxy object.*stable own data/iu,
    );
    expect(traps).toBe(0);
  });

  it("rejects a manifest-row Proxy without invoking a trap", () => {
    let traps = 0;
    const row = new Proxy(
      {},
      {
        getOwnPropertyDescriptor() {
          traps += 1;
          throw new Error("unexpected row descriptor trap");
        },
      },
    );
    expect(() => createRealBuildBrowserOutputV4TransitionEvidenceManifest([row] as never)).toThrow(
      /must be created or read by this module/iu,
    );
    expect(traps).toBe(0);
  });
});
