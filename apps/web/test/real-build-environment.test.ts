import { describe, expect, it } from "vitest";

import { assertRealBuildEnvironment } from "../e2e/real-build-environment";

const RUN_CONTRACT_DIGEST = `sha256:${"a".repeat(64)}`;
const MANIFEST_DIGEST = `sha256:${"b".repeat(64)}`;
const SERVED_DIGEST = `sha256:${"c".repeat(64)}`;

function environment(versions: Readonly<Record<string, unknown>>): unknown {
  return {
    schemaVersion: "lego.real-build-environment/1",
    node: "v24.18.1",
    platform: "win32",
    arch: "x64",
    bootstrapSourceManifestDigest: MANIFEST_DIGEST,
    versions,
    browser: { name: "chromium", version: "141.0.7390.37" },
    playwright: "@playwright/test (exact package bytes retained in source bundle)",
    replayProtocol: 1,
    runContractDigest: RUN_CONTRACT_DIGEST,
    servedResponseManifestDigest: SERVED_DIGEST,
  };
}

const BASE_VERSIONS = { node: "24.18.1", v8: "13.6.233.10-node.18", modules: "137" };

describe("real-build replay environment", () => {
  it("accepts the empty version string Node reports for a compiled-out component", () => {
    // Node reports "" for a bundled dependency that was compiled out. This
    // build reports it for nghttp3 and ngtcp2, so requiring at least one
    // character rejected the real runtime and made every replay write fail on
    // a machine whose Node was built without QUIC.
    expect(() =>
      assertRealBuildEnvironment(
        environment({ ...BASE_VERSIONS, nghttp3: "", ngtcp2: "" }),
        RUN_CONTRACT_DIGEST,
      ),
    ).not.toThrow();
  });

  it("accepts this runtime's own process.versions", () => {
    expect(() =>
      assertRealBuildEnvironment(environment({ ...process.versions }), RUN_CONTRACT_DIGEST),
    ).not.toThrow();
  });

  it("still rejects a version longer than the bound, naming the field and its length", () => {
    expect(() =>
      assertRealBuildEnvironment(
        environment({ ...BASE_VERSIONS, openssl: "x".repeat(257) }),
        RUN_CONTRACT_DIGEST,
      ),
    ).toThrow(/"openssl".*at most 256 characters.*was 257 characters/su);
  });

  it("still rejects control characters that would break canonical serialization", () => {
    for (const control of ["\r", "\n", "\0"]) {
      expect(() =>
        assertRealBuildEnvironment(
          environment({ ...BASE_VERSIONS, openssl: `3.0${control}15` }),
          RUN_CONTRACT_DIGEST,
        ),
      ).toThrow(/"openssl".*no CR, LF or NUL/su);
    }
  });

  it("names the offending version field rather than reporting five causes at once", () => {
    expect(() =>
      assertRealBuildEnvironment(
        environment({ ...BASE_VERSIONS, "Bad Name": "1" }),
        RUN_CONTRACT_DIGEST,
      ),
    ).toThrow(/"Bad Name".*1-64 characters/su);
  });

  it("reports the observed entry count when the map is too small", () => {
    expect(() =>
      assertRealBuildEnvironment(environment({ node: "24.18.1" }), RUN_CONTRACT_DIGEST),
    ).toThrow(/between 3 and 128 entries, but held 1\./u);
  });

  it("reports both sides when versions.node does not match node", () => {
    expect(() =>
      assertRealBuildEnvironment(
        environment({ ...BASE_VERSIONS, node: "24.18.0" }),
        RUN_CONTRACT_DIGEST,
      ),
    ).toThrow(/"24\.18\.0".*"v24\.18\.1"/su);
  });

  it("reports the observed types when the V8 or module ABI string is absent", () => {
    expect(() =>
      assertRealBuildEnvironment(
        environment({ node: "24.18.1", modules: "137", uv: "1.51.0" }),
        RUN_CONTRACT_DIGEST,
      ),
    ).toThrow(/v8 was undefined/u);
  });
});
