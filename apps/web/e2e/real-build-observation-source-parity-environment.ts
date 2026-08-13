import {
  exactSourceParityKeys,
  sourceParityDigest,
  sourceParityInteger,
} from "./real-build-observation-source-parity-output-primitives";
import { REAL_BUILD_SOURCE_PARITY_MAXIMUM_CANONICAL_BROWSER_RESULT_BYTES } from "./real-build-observation-source-parity-contract";
import type { RealBuildSourceParitySourceSnapshot } from "./real-build-observation-source-parity-types";

const ENVIRONMENT_SCHEMA = "lego.real-build-source-parity-environment/1";
const PLAYWRIGHT_BINDING =
  "@playwright/test (bootstrap and execution-mirror manifests bind package paths/digests)";
const MAXIMUM_VERSION_ENTRIES = 128;
const MAXIMUM_VERSION_CHARACTERS = 256;

const shown = (value: unknown): string => JSON.stringify(value) ?? String(value);

function exactRuntimeValue(value: unknown, expected: string, path: string): void {
  if (value !== expected) {
    throw new TypeError(
      `${path} was ${shown(value)}; expected exact runtime value ${shown(expected)}.`,
    );
  }
}

function validateVersions(
  value: unknown,
  expectedVersions: Readonly<Record<string, string | undefined>>,
): void {
  const expectedEntries = Object.entries(expectedVersions).filter(
    (entry): entry is [string, string] => typeof entry[1] === "string",
  );
  const expectedKeys = expectedEntries
    .map(([key]) => key)
    .sort((left, right) => left.localeCompare(right));
  if (expectedKeys.length < 3 || expectedKeys.length > MAXIMUM_VERSION_ENTRIES) {
    throw new Error(
      `Verifier runtime exposes ${expectedKeys.length} version fields; supported bound is 3 through ${MAXIMUM_VERSION_ENTRIES}.`,
    );
  }
  exactSourceParityKeys(value, expectedKeys, "Execution environment versions");
  const versions = value as Record<string, unknown>;
  for (const key of expectedKeys) {
    if (!/^[a-z0-9_-]{1,64}$/u.test(key)) {
      throw new Error(`Verifier runtime version key ${shown(key)} is outside the closed grammar.`);
    }
    const observed = versions[key];
    const expected = expectedVersions[key]!;
    if (
      typeof observed !== "string" ||
      observed.length > MAXIMUM_VERSION_CHARACTERS ||
      /[\r\n\0]/u.test(observed)
    ) {
      throw new TypeError(
        `Execution environment versions.${key} was ${shown(observed)}; expected a string of at most ${MAXIMUM_VERSION_CHARACTERS} characters without CR, LF, or NUL.`,
      );
    }
    if (observed !== expected) {
      throw new TypeError(
        `Execution environment versions.${key} was ${shown(observed)}; expected current verifier runtime value ${shown(expected)}.`,
      );
    }
  }
}

/** Reproduces Node-side runtime fields; the browser version remains a bounded observed commitment. */
export function validateRealBuildSourceParityEnvironment(input: {
  readonly environment: Record<string, unknown>;
  readonly snapshot: RealBuildSourceParitySourceSnapshot;
  readonly repoRoot: string;
  readonly expectedNode: string;
  readonly expectedPlatform: string;
  readonly expectedArch: string;
  readonly expectedVersions: Readonly<Record<string, string | undefined>>;
}): void {
  const { environment, snapshot } = input;
  exactSourceParityKeys(
    environment,
    [
      "schemaVersion",
      "node",
      "platform",
      "arch",
      "versions",
      "browser",
      "playwright",
      "bootstrapSourceManifestDigest",
      "executionSourceMirrorManifestDigest",
      "servedResponseManifestDigest",
      "servedSourceBundleManifestDigest",
      "servedSourceBundleDigest",
      "checkoutRoot",
      "browserResultDigest",
      "browserResultBytes",
      "preparedPanelsDigest",
    ],
    "Source-parity execution environment",
  );
  if (environment.schemaVersion !== ENVIRONMENT_SCHEMA) {
    throw new TypeError(
      `Execution environment schemaVersion was ${shown(environment.schemaVersion)}; expected ${shown(ENVIRONMENT_SCHEMA)}.`,
    );
  }
  exactRuntimeValue(environment.node, input.expectedNode, "Execution environment node");
  exactRuntimeValue(environment.platform, input.expectedPlatform, "Execution environment platform");
  exactRuntimeValue(environment.arch, input.expectedArch, "Execution environment arch");
  validateVersions(environment.versions, input.expectedVersions);
  exactSourceParityKeys(environment.browser, ["name", "version"], "Execution browser");
  const browser = environment.browser as Record<string, unknown>;
  if (browser.name !== "chromium") {
    throw new TypeError(
      `Execution browser name was ${shown(browser.name)}; expected exact parity engine "chromium".`,
    );
  }
  if (typeof browser.version !== "string" || !/^[0-9A-Za-z.+_-]{1,128}$/u.test(browser.version)) {
    throw new TypeError(
      `Execution browser version was ${shown(browser.version)}; expected a 1-128 character closed version string.`,
    );
  }
  if (environment.playwright !== PLAYWRIGHT_BINDING) {
    throw new TypeError(
      `Execution environment playwright was ${shown(environment.playwright)}; expected ${shown(PLAYWRIGHT_BINDING)}.`,
    );
  }
  exactRuntimeValue(environment.checkoutRoot, input.repoRoot, "Execution environment checkoutRoot");
  const digestBindings = [
    ["bootstrapSourceManifestDigest", snapshot.bootstrapManifestDigest],
    ["executionSourceMirrorManifestDigest", snapshot.executionMirrorManifestDigest],
    ["servedResponseManifestDigest", snapshot.servedResponseManifestDigest],
    ["servedSourceBundleManifestDigest", snapshot.servedSourceBundleManifestDigest],
    ["servedSourceBundleDigest", snapshot.servedSourceBundleDigest],
    ["browserResultDigest", snapshot.browserResultDigest],
    ["preparedPanelsDigest", snapshot.preparedPanelsDigest],
  ] as const;
  for (const [key, expected] of digestBindings) {
    const observed = sourceParityDigest(environment[key], `Execution environment ${key}`);
    if (observed !== expected) {
      throw new TypeError(
        `Execution environment ${key} was ${shown(observed)}; expected source snapshot ${shown(expected)}.`,
      );
    }
  }
  const browserResultBytes = sourceParityInteger(
    environment.browserResultBytes,
    1,
    REAL_BUILD_SOURCE_PARITY_MAXIMUM_CANONICAL_BROWSER_RESULT_BYTES,
    "Execution environment browserResultBytes",
  );
  if (browserResultBytes !== snapshot.browserResultBytes) {
    throw new TypeError(
      `Execution environment browserResultBytes was ${browserResultBytes}; expected source snapshot ${snapshot.browserResultBytes}.`,
    );
  }
}
