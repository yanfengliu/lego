const SHA256_DIGEST_PATTERN = /^sha256:[0-9a-f]{64}$/u;
const EXPECTED_KEYS = [
  "arch",
  "bootstrapSourceManifestDigest",
  "browser",
  "node",
  "platform",
  "playwright",
  "replayProtocol",
  "runContractDigest",
  "schemaVersion",
  "servedResponseManifestDigest",
  "versions",
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hasExactKeys(record: Record<string, unknown>, expected: readonly string[]): boolean {
  return (
    JSON.stringify(Object.keys(record).sort((left, right) => left.localeCompare(right))) ===
    JSON.stringify([...expected].sort((left, right) => left.localeCompare(right)))
  );
}

export interface RealBuildEnvironment {
  readonly schemaVersion: "lego.real-build-environment/1";
  readonly node: string;
  readonly platform: "win32";
  readonly arch: "x64";
  readonly bootstrapSourceManifestDigest: string;
  readonly versions: Readonly<Record<string, string>>;
  readonly browser: {
    readonly name: "chromium" | "firefox" | "webkit";
    readonly version: string;
  };
  readonly playwright: "@playwright/test (exact package bytes retained in source bundle)";
  readonly replayProtocol: 1;
  readonly runContractDigest: string;
  readonly servedResponseManifestDigest: string;
}

/** Closed environment schema used by both replay writing and independent verification. */
export function assertRealBuildEnvironment(
  value: unknown,
  expectedRunContractDigest: string,
): asserts value is RealBuildEnvironment {
  if (!isRecord(value) || !hasExactKeys(value, EXPECTED_KEYS)) {
    throw new TypeError(
      "Replay environment must contain exactly the declared platform, runtime, browser, protocol, and digest fields.",
    );
  }
  if (
    value.schemaVersion !== "lego.real-build-environment/1" ||
    typeof value.node !== "string" ||
    !/^v[0-9]+\.[0-9]+\.[0-9]+(?:[-+][0-9A-Za-z.-]+)?$/u.test(value.node) ||
    value.platform !== "win32" ||
    value.arch !== "x64" ||
    value.playwright !== "@playwright/test (exact package bytes retained in source bundle)" ||
    value.replayProtocol !== 1 ||
    !SHA256_DIGEST_PATTERN.test(String(value.bootstrapSourceManifestDigest)) ||
    value.runContractDigest !== expectedRunContractDigest ||
    !SHA256_DIGEST_PATTERN.test(String(value.servedResponseManifestDigest))
  ) {
    throw new TypeError(
      "Replay environment has an invalid schema, runtime identity, protocol, or run-contract/served-response binding.",
    );
  }
  if (
    !isRecord(value.browser) ||
    !hasExactKeys(value.browser, ["name", "version"]) ||
    !["chromium", "firefox", "webkit"].includes(String(value.browser.name)) ||
    typeof value.browser.version !== "string" ||
    !/^[0-9A-Za-z.+_-]{1,128}$/u.test(value.browser.version)
  ) {
    throw new TypeError(
      "Replay environment browser must declare a supported engine and bounded exact version.",
    );
  }
  if (!isRecord(value.versions)) {
    throw new TypeError("Replay environment versions must be a bounded string map.");
  }
  const versionEntries = Object.entries(value.versions);
  if (versionEntries.length < 3 || versionEntries.length > 128) {
    throw new TypeError(
      `Replay environment versions must hold between 3 and 128 entries, but held ${versionEntries.length}.`,
    );
  }
  for (const [name, version] of versionEntries) {
    if (!/^[a-z0-9_-]{1,64}$/u.test(name)) {
      throw new TypeError(
        `Replay environment version name ${JSON.stringify(name)} must be 1-64 characters of [a-z0-9_-].`,
      );
    }
    if (typeof version !== "string") {
      throw new TypeError(
        `Replay environment version ${JSON.stringify(name)} must be a string, but was ${typeof version}.`,
      );
    }
    // Node reports an empty string for a bundled component that was compiled
    // out - this build reports "" for nghttp3 and ngtcp2 - so an empty value is
    // a real observation, not a malformed one. Only the upper bound and the
    // control characters that would break canonical serialization are rejected.
    if (!/^[^\r\n\0]{0,256}$/u.test(version)) {
      throw new TypeError(
        `Replay environment version ${JSON.stringify(name)} must be at most 256 characters with no CR, LF or NUL, ` +
          `but was ${version.length} characters.`,
      );
    }
  }
  if (value.versions.node !== value.node.slice(1)) {
    throw new TypeError(
      `Replay environment versions.node ${JSON.stringify(value.versions.node)} must equal ` +
        `node ${JSON.stringify(value.node)} without its leading "v".`,
    );
  }
  if (typeof value.versions.v8 !== "string" || typeof value.versions.modules !== "string") {
    throw new TypeError(
      `Replay environment versions must include V8 and module ABI strings, but v8 was ` +
        `${typeof value.versions.v8} and modules was ${typeof value.versions.modules}.`,
    );
  }
}
