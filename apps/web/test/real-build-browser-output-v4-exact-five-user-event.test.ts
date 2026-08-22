import { describe, expect, it } from "vitest";

import {
  consumeRealBuildBrowserOutputV4ExactFiveTrustedUserEvent,
  requireRealBuildBrowserOutputV4ExactFiveAuthenticatedTrustedUserEvent,
} from "../e2e/real-build-browser-output-v4-exact-five-user-event";

describe("exact-five external trusted-user event seam", () => {
  it("has no repository-local production pairing, capability constructor, or issuer", async () => {
    let reads = 0;
    const selfLabelledClaim = new Proxy(
      {
        authority: "trusted-user",
        origin: "external-authenticated-user-event",
        replayState: "consumed-one-use",
      },
      {
        get() {
          reads += 1;
          throw new Error("untrusted event claim must remain unread");
        },
      },
    );
    await expect(
      consumeRealBuildBrowserOutputV4ExactFiveTrustedUserEvent(selfLabelledClaim, {
        schemaVersion: "lego.real-build-browser-output-v4-exact-five-user-event-request/1",
        namespace: "production",
        purpose: "admit-exact-five-official-frame-equivalence",
        scope: "exact-five-source-parity-calibration-panels-only",
        requestDigest: `sha256:${"0".repeat(64)}`,
        reviewPresentationDigest: `sha256:${"1".repeat(64)}`,
      }),
    ).rejects.toThrow(
      /no external authenticated one-use trusted-user event consumer is integrated/u,
    );
    expect(reads).toBe(0);
  });

  it("rejects an unauthenticated object without reading it", () => {
    let reads = 0;
    const forgedEvent = new Proxy(
      {},
      {
        get() {
          reads += 1;
          throw new Error("forged event must remain unread");
        },
      },
    );
    expect(() =>
      requireRealBuildBrowserOutputV4ExactFiveAuthenticatedTrustedUserEvent(forgedEvent),
    ).toThrow(/module-authenticated one-use trusted-user event capability/u);
    expect(reads).toBe(0);
  });
});
