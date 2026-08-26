import { randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it, vi } from "vitest";

const identificationClosureCalls = vi.hoisted(() => vi.fn());
const legacyRunContractV4Calls = vi.hoisted(() => vi.fn());

vi.mock("../e2e/real-build-identification-closure", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../e2e/real-build-identification-closure")>();
  return {
    ...actual,
    verifyRealBuildIdentificationClosure: (
      input: Parameters<typeof actual.prepareRealBuildIdentificationClosure>[0],
    ) => {
      identificationClosureCalls(input);
      const prepared = actual.prepareRealBuildIdentificationClosure(input);
      return JSON.parse(
        new TextDecoder("utf8", { fatal: true }).decode(prepared.coverageBytes),
      ) as unknown;
    },
  };
});

vi.mock("../e2e/real-build-run-contract-legacy-v4", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../e2e/real-build-run-contract-legacy-v4")>();
  return {
    ...actual,
    verifyLegacyRealBuildRunContractV4: (
      input: Parameters<typeof actual.verifyLegacyRealBuildRunContractV4>[0],
    ) => {
      legacyRunContractV4Calls(input);
      return actual.verifyLegacyRealBuildRunContractV4(input);
    },
  };
});

const reconstructOfficialMock = vi.hoisted(() => vi.fn());

vi.mock("../e2e/real-build-replay-official", () => ({
  reconstructRealBuildOfficialReplay: reconstructOfficialMock,
}));

import { createRealBuildRunContract, sha256Digest } from "../e2e/real-build-artifacts";
import {
  captureRealBuildSourceBundle,
  materializeRealBuildSourceMirror,
  planRealBuildSourceMirrorBundle,
  verifyRealBuildReplayClosureData,
  writeRealBuildReplayClosure,
} from "../e2e/real-build-replay";
import {
  createRealBuildBootstrapSourceManifest,
  REAL_BUILD_SOURCE_ROOT_POLICY_PATH,
} from "../e2e/real-build-bootstrap-source";
import {
  encodeCurrentRealBuildRunContract,
  realBuildRunBudgets,
  realBuildRunThresholds,
} from "../e2e/real-build-run-contract";
import { encodeRealBuildPreparedRunInput } from "../e2e/real-build-prepared-run-input-parser";
import {
  canonicalRealBuildJsonClone,
  encodeCanonicalRealBuildJson,
} from "../e2e/real-build-json-admission";
import { REAL_BUILD_TEST_DIGEST } from "./real-build-test-options";
import { realBuildLedgerTestFixture } from "./real-build-ledger-test-fixture";
import {
  replayIdentificationClosureDigests as identificationClosure,
  replayInputDigests as inputDigests,
  replayOptions as options,
  replayPanelSourceDigest as panelSourceDigest,
  replayRawRoleBytes as rawRoleBytes,
} from "./real-build-replay-fixture";

const replayOfficialFixture = realBuildLedgerTestFixture().official;
reconstructOfficialMock.mockImplementation(
  (input: { readonly roleDigests: Readonly<Record<string, string>> }) => ({
    ...replayOfficialFixture,
    digest: input.roleDigests["official-model"]!,
    calibrationDigest: input.roleDigests["builder-calibration"]!,
    builderGeometryDigest: input.roleDigests["builder-geometry"]!,
    instructionBrickRefs: new Set([...replayOfficialFixture.instructionBrickRefs, "brick-b"]),
    directBrickRefs: new Set([...replayOfficialFixture.directBrickRefs, "brick-b"]),
  }),
);

interface MutableReplayManifest extends Record<string, unknown> {
  roles: Array<{ role: string; digest: string; bytes: number; casPath: string }>;
  environmentDigest: string;
}

function encodeRehashedReplayManifest(value: MutableReplayManifest): Uint8Array {
  const withoutDigest = canonicalRealBuildJsonClone(value);
  delete withoutDigest.manifestDigest;
  return encodeCanonicalRealBuildJson(
    {
      ...withoutDigest,
      manifestDigest: sha256Digest(encodeCanonicalRealBuildJson(withoutDigest)),
    },
    "pretty-one-space-line",
  );
}

function replaceLegacyReplayRoles(
  directory: string,
  replacements: ReadonlyMap<string, Uint8Array>,
): void {
  const manifestPath = join(directory, "replay-closure.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as MutableReplayManifest;
  manifest.roles = manifest.roles
    .filter(({ role }) => role !== "source-art-rebound")
    .map((entry) => {
      const bytes = replacements.get(entry.role);
      if (bytes === undefined) return entry;
      const digest = sha256Digest(bytes);
      const hex = digest.slice("sha256:".length);
      const casPath = `cas/sha256/${hex.slice(0, 2)}/${hex.slice(2)}`;
      mkdirSync(join(directory, "cas", "sha256", hex.slice(0, 2)), { recursive: true });
      writeFileSync(join(directory, casPath), bytes);
      return { role: entry.role, digest, bytes: bytes.byteLength, casPath };
    });
  manifest.environmentDigest = sha256Digest(replacements.get("environment")!);
  writeFileSync(manifestPath, encodeRehashedReplayManifest(manifest));
}

describe("frozen real-build replay generation 4", () => {
  it("routes coverage/2 without newer identification inputs through the real /4 verifier", async () => {
    const outputRoot = join(
      process.cwd(),
      "output",
      `real-build-replay-legacy-v4-test-${randomUUID()}`,
    );
    try {
      mkdirSync(outputRoot, { recursive: true });
      const sourceFiles = ["apps/web/e2e/real-build-replay.ts", REAL_BUILD_SOURCE_ROOT_POLICY_PATH];
      const sourceBundle = captureRealBuildSourceBundle(process.cwd(), sourceFiles);
      const sourcePolicy = sourceBundle.find(
        ({ path }) => path === REAL_BUILD_SOURCE_ROOT_POLICY_PATH,
      )!;
      const bootstrapManifest = createRealBuildBootstrapSourceManifest({
        files: sourceBundle,
        sourceRootsPolicyDigest: sourcePolicy.digest,
      });
      const executionSourceBundle = planRealBuildSourceMirrorBundle({
        sourceFiles: sourceBundle,
        fixedInputs: [
          {
            path: "inputs/booklet.pdf",
            digest: inputDigests.pdf,
            bytes: rawRoleBytes.pdf!.byteLength,
          },
        ],
      });
      const codeSnapshots = Object.fromEntries(
        executionSourceBundle.map(({ path, digest }) => [path, digest]),
      );
      const currentContract = createRealBuildRunContract({
        inputDigests,
        identificationClosure,
        panelSourceDigest,
        panels: options.panels,
        passivePanels: options.passivePanels,
        budgets: realBuildRunBudgets(options),
        thresholds: realBuildRunThresholds(options),
        codeSnapshots,
      });
      const sourceMirror = materializeRealBuildSourceMirror({
        directory: outputRoot,
        repoRoot: process.cwd(),
        sourceFiles,
        fixedInputs: [{ path: "inputs/booklet.pdf", bytes: rawRoleBytes.pdf! }],
      });
      const replayEnvironment = {
        schemaVersion: "lego.real-build-environment/1" as const,
        node: process.version,
        platform: process.platform,
        arch: process.arch,
        versions: process.versions,
        browser: { name: "chromium", version: "test" },
        playwright: "@playwright/test (exact package bytes retained in source bundle)",
        replayProtocol: 1 as const,
        bootstrapSourceManifestDigest: bootstrapManifest.manifestDigest,
        runContractDigest: currentContract.contractDigest,
        servedResponseManifestDigest: REAL_BUILD_TEST_DIGEST,
      };
      const closureDirectory = join(outputRoot, "closure");
      mkdirSync(closureDirectory);
      await writeRealBuildReplayClosure({
        directory: closureDirectory,
        repoRoot: sourceMirror.root,
        roles: [
          ...Object.entries(rawRoleBytes).map(([role, bytes]) => ({ role, bytes })),
          { role: "prepared-options", bytes: encodeRealBuildPreparedRunInput(options) },
          { role: "run-contract", bytes: encodeCurrentRealBuildRunContract(currentContract) },
        ],
        sourceFiles: sourceMirror.files.map(({ path }) => path),
        environment: replayEnvironment,
        browserOutputRetained: false,
      });

      const currentCoverage = JSON.parse(
        Buffer.from(rawRoleBytes.coverage!).toString("utf8"),
      ) as Record<string, unknown> & { inputDigests: Record<string, string> };
      const { sourceArtRebound: omittedRebound, ...legacyCoverageInputDigests } =
        currentCoverage.inputDigests;
      expect(omittedRebound).toBe(identificationClosure.sourceArtRebound);
      const legacyCoverageBytes = encodeCanonicalRealBuildJson(
        {
          ...currentCoverage,
          schemaVersion: "lego.real-build-catalog-coverage/2",
          inputDigests: legacyCoverageInputDigests,
        },
        "pretty-one-space-line",
      );
      const legacyInputDigests = {
        ...inputDigests,
        coverage: sha256Digest(legacyCoverageBytes),
      };
      const legacyOptions = { ...options, inputDigests: legacyInputDigests };
      const currentShape = createRealBuildRunContract({
        inputDigests: legacyInputDigests,
        identificationClosure,
        panelSourceDigest,
        panels: legacyOptions.panels,
        passivePanels: legacyOptions.passivePanels,
        budgets: realBuildRunBudgets(legacyOptions),
        thresholds: realBuildRunThresholds(legacyOptions),
        codeSnapshots,
      });
      const { sourceArtRebound: omittedContractRebound, ...legacyIdentificationClosure } =
        currentShape.identificationClosure;
      const { contractDigest: currentDigest, ...currentBase } = currentShape;
      expect(omittedContractRebound).toBe(identificationClosure.sourceArtRebound);
      expect(currentDigest).toBe(currentShape.contractDigest);
      const legacyContractBase = {
        ...currentBase,
        schemaVersion: "lego.real-build-run-contract/4" as const,
        identificationClosure: legacyIdentificationClosure,
      };
      const legacyContract = {
        ...legacyContractBase,
        contractDigest: sha256Digest(encodeCanonicalRealBuildJson(legacyContractBase)),
      };
      const legacyEnvironmentBytes = encodeCanonicalRealBuildJson({
        ...replayEnvironment,
        runContractDigest: legacyContract.contractDigest,
      });
      replaceLegacyReplayRoles(
        closureDirectory,
        new Map<string, Uint8Array>([
          ["coverage", legacyCoverageBytes],
          ["prepared-options", encodeRealBuildPreparedRunInput(legacyOptions)],
          ["run-contract", encodeCanonicalRealBuildJson(legacyContract)],
          ["environment", legacyEnvironmentBytes],
        ]),
      );

      identificationClosureCalls.mockClear();
      legacyRunContractV4Calls.mockClear();
      const verified = await verifyRealBuildReplayClosureData(closureDirectory);

      expect(verified.roleBytes.has("pdf")).toBe(true);
      expect(verified.roleBytes.has("source-art-rebound")).toBe(false);
      expect(verified.admittedActionLedger).toBeNull();
      expect(identificationClosureCalls).toHaveBeenCalledTimes(1);
      const identificationInput = identificationClosureCalls.mock.calls[0]![0] as {
        coverage: { value: { schemaVersion: string; inputDigests: Record<string, string> } };
        pdf: unknown;
        sourceArtRebound: unknown;
      };
      expect(identificationInput.coverage.value.schemaVersion).toBe(
        "lego.real-build-catalog-coverage/2",
      );
      expect(identificationInput.coverage.value.inputDigests).not.toHaveProperty(
        "sourceArtRebound",
      );
      expect(identificationInput.pdf).toBeNull();
      expect(identificationInput.sourceArtRebound).toBeNull();
      expect(legacyRunContractV4Calls).toHaveBeenCalledTimes(1);
      const legacyVerifierInput = legacyRunContractV4Calls.mock.calls[0]![0] as {
        contract: { schemaVersion: string };
        roleDigests: Record<string, string>;
      };
      expect(legacyVerifierInput.contract.schemaVersion).toBe("lego.real-build-run-contract/4");
      expect(legacyVerifierInput.roleDigests).not.toHaveProperty("source-art-rebound");
      expect(legacyVerifierInput.roleDigests.pdf).toBe(legacyOptions.inputDigests.pdf);
    } finally {
      rmSync(outputRoot, { recursive: true, force: true });
    }
  });
});
