import { spawnSync } from "node:child_process";

import { describe, expect, it } from "vitest";

import { snapshotRealBuildCodeRoots } from "../e2e/real-build-artifacts";
import { preflightRealBuildOptions } from "../e2e/real-build-contract";
import { deriveMeasuredFartherOriginSourceAttestation } from "../e2e/real-build-farther-origin-source-attestation";
import {
  MEASURED_FARTHER_ORIGIN_REQUIRED_SOURCE_PATHS,
  MEASURED_FARTHER_ORIGIN_SOURCE_ATTESTATION,
  MEASURED_FARTHER_ORIGIN_SOURCE_MANIFEST_PATH,
  isMeasuredFartherOriginSourcePath,
} from "../e2e/real-build-farther-origin-source-manifest";
import {
  createRealBuildRunContract,
  REAL_BUILD_IDENTIFICATION_ROLE_BY_DIGEST,
  REAL_BUILD_INPUT_ROLE_BY_DIGEST,
  realBuildRunBudgets,
  realBuildRunThresholds,
  verifyRealBuildRunContract,
} from "../e2e/real-build-run-contract";
import type { RealBuildSourceSnapshot } from "../e2e/real-build-replay-files";
import type { RealBuildOptions } from "../e2e/real-build-safety";
import { REAL_BUILD_SOURCE_ROOTS } from "../e2e/real-build-source-roots";
import { REAL_BUILD_TEST_DIGEST, completeRealBuildTestOptions } from "./real-build-test-options";

const DIFFERENT_DIGEST = `sha256:${"b".repeat(64)}`;
const codeUnitCompare = (left: string, right: string): number =>
  left < right ? -1 : left > right ? 1 : 0;

const canonicalFixtureSnapshots = (): Readonly<Record<string, string>> =>
  Object.fromEntries(
    MEASURED_FARTHER_ORIGIN_REQUIRED_SOURCE_PATHS.map((path) => [path, REAL_BUILD_TEST_DIGEST]),
  );

function executionSnapshots(
  canonical: Readonly<Record<string, string>>,
): Readonly<Record<string, string>> {
  const rows: [string, string][] = [];
  for (const [path, digest] of Object.entries(canonical)) {
    rows.push([path, digest]);
    const packageMatch = /^packages\/([^/]+)\/(.+)$/u.exec(path);
    if (packageMatch !== null) {
      rows.push([`node_modules/@lego-studio/${packageMatch[1]!}/${packageMatch[2]!}`, digest]);
    }
  }
  rows.push(["inputs/booklet.pdf", REAL_BUILD_TEST_DIGEST]);
  return Object.fromEntries(rows.sort(([left], [right]) => codeUnitCompare(left, right)));
}

const retainedSources = (
  snapshots: Readonly<Record<string, string>>,
): readonly RealBuildSourceSnapshot[] =>
  Object.entries(snapshots).map(([path, digest]) => ({ path, digest, bytes: 1 }));

const identificationClosure = {
  source: "deterministic" as const,
  features: REAL_BUILD_TEST_DIGEST,
  match: REAL_BUILD_TEST_DIGEST,
  distances: REAL_BUILD_TEST_DIGEST,
  elements: REAL_BUILD_TEST_DIGEST,
  cards: null,
  cardImages: null,
  answers: null,
  pairJudged: REAL_BUILD_TEST_DIGEST,
};

const roleDigests = Object.fromEntries(
  [
    ...Object.values(REAL_BUILD_INPUT_ROLE_BY_DIGEST),
    REAL_BUILD_IDENTIFICATION_ROLE_BY_DIGEST.features,
    REAL_BUILD_IDENTIFICATION_ROLE_BY_DIGEST.match,
    REAL_BUILD_IDENTIFICATION_ROLE_BY_DIGEST.distances,
    REAL_BUILD_IDENTIFICATION_ROLE_BY_DIGEST.elements,
    REAL_BUILD_IDENTIFICATION_ROLE_BY_DIGEST.pairJudged,
  ].map((role) => [role, REAL_BUILD_TEST_DIGEST]),
);

function contractFor(options: RealBuildOptions, codeSnapshots: Readonly<Record<string, string>>) {
  return createRealBuildRunContract({
    inputDigests: options.inputDigests,
    identificationClosure,
    panels: options.panels,
    budgets: realBuildRunBudgets(options),
    thresholds: realBuildRunThresholds(options),
    codeSnapshots,
  });
}

function attestedFixture() {
  const codeSnapshots = executionSnapshots(canonicalFixtureSnapshots());
  const options: RealBuildOptions = {
    ...completeRealBuildTestOptions(1),
    measuredFartherOriginSourceAttestation:
      deriveMeasuredFartherOriginSourceAttestation(codeSnapshots),
  };
  return {
    codeSnapshots,
    options,
    contract: contractFor(options, codeSnapshots),
    sourceFiles: retainedSources(codeSnapshots),
  };
}

describe("measured farther-origin source attestation", () => {
  it("imports its pure manifest and Node derivation directly without a Vite transform", () => {
    const moduleUrls = [
      new URL("../e2e/real-build-farther-origin-source-manifest.ts", import.meta.url).href,
      new URL("../e2e/real-build-farther-origin-source-attestation.ts", import.meta.url).href,
    ];
    const result = spawnSync(
      process.execPath,
      [
        "--input-type=module",
        "--eval",
        `await Promise.all(${JSON.stringify(moduleUrls)}.map((url) => import(url)));`,
      ],
      { cwd: process.cwd(), encoding: "utf8", windowsHide: true },
    );
    expect(
      result.status,
      [result.error?.message, result.stdout, result.stderr].filter(Boolean).join("\n"),
    ).toBe(0);
  });

  it("derives an order-independent canonical closure and ignores aliases and Vite cache", () => {
    const canonical = canonicalFixtureSnapshots();
    const reversed = Object.fromEntries(Object.entries(canonical).reverse());
    const baseline = deriveMeasuredFartherOriginSourceAttestation(canonical);
    const ignoredInputs = {
      ...canonical,
      "node_modules/@lego-studio/catalog/src/index.ts": DIFFERENT_DIGEST,
      "apps/web/node_modules/.vite/deps/three.js": DIFFERENT_DIGEST,
      "inputs/booklet.pdf": DIFFERENT_DIGEST,
    };

    expect(deriveMeasuredFartherOriginSourceAttestation(reversed)).toEqual(baseline);
    expect(deriveMeasuredFartherOriginSourceAttestation(ignoredInputs)).toEqual(baseline);
    expect(baseline.fileCount).toBe(MEASURED_FARTHER_ORIGIN_REQUIRED_SOURCE_PATHS.length);
    expect(isMeasuredFartherOriginSourcePath(MEASURED_FARTHER_ORIGIN_SOURCE_MANIFEST_PATH)).toBe(
      false,
    );
    expect(
      deriveMeasuredFartherOriginSourceAttestation({
        ...canonical,
        "apps/web/e2e/additional-runtime.ts": DIFFERENT_DIGEST,
      }),
    ).not.toEqual(baseline);
  });

  it("refuses missing anchors, non-canonical paths, and malformed digests", () => {
    const canonical = { ...canonicalFixtureSnapshots() };
    delete canonical["apps/web/e2e/real-build-farther-origin-attempt.ts"];
    expect(() => deriveMeasuredFartherOriginSourceAttestation(canonical)).toThrow(
      /missing 1 required canonical path/u,
    );
    expect(() =>
      deriveMeasuredFartherOriginSourceAttestation({
        ...canonicalFixtureSnapshots(),
        "apps/web/e2e/../escape.ts": REAL_BUILD_TEST_DIGEST,
      }),
    ).toThrow(/non-canonical path/u);
    expect(() =>
      deriveMeasuredFartherOriginSourceAttestation({
        ...canonicalFixtureSnapshots(),
        "apps/web/e2e/extra.ts": "sha256:not-a-digest",
      }),
    ).toThrow(/malformed digest/u);
  });

  it("accepts omitted legacy preflight state but refuses a malformed claimed attestation", () => {
    const legacy = { ...completeRealBuildTestOptions(1) } as Partial<RealBuildOptions> &
      Record<string, unknown>;
    delete (legacy as Record<string, unknown>).measuredFartherOriginSourceAttestation;
    expect(preflightRealBuildOptions(legacy as RealBuildOptions)).toEqual([]);

    const malformed = {
      ...completeRealBuildTestOptions(1),
      measuredFartherOriginSourceAttestation: {
        schemaVersion: "lego.real-build-source-attestation/1",
        fileCount: 0,
        digest: REAL_BUILD_TEST_DIGEST,
      },
    } as unknown as RealBuildOptions;
    expect(preflightRealBuildOptions(malformed)).toContainEqual(
      expect.objectContaining({
        code: "benchmark-policy-mismatch",
        inputKey: "measuredFartherOriginSourceAttestation",
      }),
    );
  });

  it("pins the expected manifest to the exact captured canonical source closure", () => {
    const active = deriveMeasuredFartherOriginSourceAttestation(
      snapshotRealBuildCodeRoots(REAL_BUILD_SOURCE_ROOTS),
    );
    expect(active).toEqual(MEASURED_FARTHER_ORIGIN_SOURCE_ATTESTATION);
  }, 30_000);

  it("independently rejects forged, missing, contract-mutated, and retained-mutated closure", () => {
    const fixture = attestedFixture();
    const verify = (
      input: {
        readonly contract?: typeof fixture.contract;
        readonly options?: RealBuildOptions;
        readonly sourceFiles?: readonly RealBuildSourceSnapshot[];
      } = {},
    ) =>
      verifyRealBuildRunContract({
        contract: input.contract ?? fixture.contract,
        options: input.options ?? fixture.options,
        roleDigests,
        sourceFiles: input.sourceFiles ?? fixture.sourceFiles,
      });

    expect(verify).not.toThrow();
    expect(() =>
      verify({
        options: {
          ...fixture.options,
          measuredFartherOriginSourceAttestation: {
            ...fixture.options.measuredFartherOriginSourceAttestation!,
            digest: DIFFERENT_DIGEST,
          },
        },
      }),
    ).toThrow(/does not reproduce from both/u);

    const contractMutation = {
      ...fixture.codeSnapshots,
      "apps/web/e2e/real-build-farther-origin-attempt.ts": DIFFERENT_DIGEST,
    };
    expect(() => verify({ contract: contractFor(fixture.options, contractMutation) })).toThrow(
      /does not reproduce from both/u,
    );

    const retainedMutation = fixture.sourceFiles.map((source) =>
      source.path === "apps/web/e2e/real-build-farther-origin-attempt.ts"
        ? { ...source, digest: DIFFERENT_DIGEST }
        : source,
    );
    expect(() => verify({ sourceFiles: retainedMutation })).toThrow(
      /does not reproduce from both/u,
    );

    const missingCanonical = { ...canonicalFixtureSnapshots() };
    delete missingCanonical["apps/web/e2e/real-build-farther-origin-attempt.ts"];
    const missingSnapshots = executionSnapshots(missingCanonical);
    expect(() =>
      verify({
        contract: contractFor(fixture.options, missingSnapshots),
        sourceFiles: retainedSources(missingSnapshots),
      }),
    ).toThrow(/missing 1 required canonical path/u);

    const legacyOptions = { ...fixture.options } as Partial<RealBuildOptions> &
      Record<string, unknown>;
    delete (legacyOptions as Record<string, unknown>).measuredFartherOriginSourceAttestation;
    expect(() => verify({ options: legacyOptions as RealBuildOptions })).not.toThrow();
  });
});
