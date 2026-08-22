import { describe, expect, it } from "vitest";

import { consumeRealBuildBrowserOutputV4ExactFiveTrustedUserEvent } from "../e2e/real-build-browser-output-v4-exact-five-user-event";

describe("exact-five external trusted-user event seam", () => {
  it("has no repository-local parser, constructor, or issuer", () => {
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
    expect(() =>
      consumeRealBuildBrowserOutputV4ExactFiveTrustedUserEvent(selfLabelledClaim, {
        schemaVersion: "lego.real-build-browser-output-v4-exact-five-user-event-challenge/1",
        purpose: "admit-exact-five-official-frame-equivalence",
        requestDigest: `sha256:${"0".repeat(64)}`,
      }),
    ).toThrow(/no external authenticated one-use trusted-user event consumer is integrated/u);
    expect(reads).toBe(0);
  });
});
