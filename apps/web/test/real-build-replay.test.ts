import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("../e2e/real-build-identification-closure", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../e2e/real-build-identification-closure")>();
  return {
    ...actual,
    verifyRealBuildIdentificationClosure: (
      input: Parameters<typeof actual.prepareRealBuildIdentificationClosure>[0],
    ) => {
      const prepared = actual.prepareRealBuildIdentificationClosure(input);
      return JSON.parse(
        new TextDecoder("utf8", { fatal: true }).decode(prepared.coverageBytes),
      ) as unknown;
    },
  };
});

const reconstructOfficialMock = vi.hoisted(() => vi.fn());

vi.mock("../e2e/real-build-replay-official", () => ({
  reconstructRealBuildOfficialReplay: reconstructOfficialMock,
}));

import {
  beginAtomicRun,
  createRealBuildScore,
  createRealBuildRunContract,
  planAtomicRunDirectory,
  sha256Digest,
  verifyRealBuildArtifactManifest,
  writeRealBuildArtifactManifest,
} from "../e2e/real-build-artifacts";
import { admitCanonicalRealBuildActionLedgerBytes } from "../e2e/real-build-action-ledger-admission";
import { encodeRealBuildActionLedger } from "../e2e/real-build-action-ledger";
import { actionEvidenceDigest } from "../e2e/real-build-ledger";
import { finalizeExecutedRealBuildResult } from "../e2e/real-build-finalize";
import {
  replayRealBuildFinalization,
  replayRealBuildFinalizationDiagnostic,
  inspectRealBuildReplayClosure,
  resolveRealBuildPath,
  captureRealBuildSourceBundle,
  materializeRealBuildSourceMirror,
  planRealBuildSourceMirrorBundle,
  verifyRealBuildReplayClosure,
  verifyRealBuildReplayClosureData,
  writeRealBuildReplayClosure,
} from "../e2e/real-build-replay";
import { REAL_BUILD_SOURCE_ROOTS } from "../e2e/real-build-source-roots";
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
import { currentArtifactServedEvidence } from "./real-build-current-artifact-served-fixture";
import {
  replayBrowserOutput as browserOutput,
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

/** Run roots this file leaves behind, which must be none. */
function replayTestRoots(): readonly string[] {
  const output = join(process.cwd(), "output");
  if (!existsSync(output)) return [];
  return readdirSync(output).filter((name) => name.startsWith("real-build-replay-test-"));
}

function encodeRehashedReplayManifest(value: Record<string, unknown>): Uint8Array {
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

describe("real-build replay closure", () => {
  // Each of these tests snapshots repository sources into a run root, so one
  // that exits without cleaning up leaves roughly 100 MB behind. Six such roots
  // accumulated - 720 MB - while this suite was failing on an environment guard
  // that rejected the repository's own pinned Node versions, and nothing
  // noticed, because a directory under an ignored output path is invisible
  // until something scans it. The lint gate found them eventually, by going red
  // on 366 errors inside a source snapshot.
  //
  // The cleanup already existed and works; what was missing was anything that
  // would say so. This tolerates roots that predate the fix and fails on any
  // new one, so a recurrence is caught by the suite that caused it rather than
  // by a disk-usage scan weeks later.
  let rootsBefore: readonly string[] = [];
  beforeAll(() => {
    rootsBefore = replayTestRoots();
  });
  afterAll(() => {
    const leaked = replayTestRoots().filter((name) => !rootsBefore.includes(name));
    expect(
      leaked,
      `replay tests left ${leaked.length} run root(s) behind: ${leaked.join(", ")}. ` +
        `Each holds a full source snapshot, so they cost about 100 MB each. Remove them and ` +
        `restore the finally-block cleanup on whichever test created them.`,
    ).toEqual([]);
  });

  it("rejects calendar-invalid publication timestamps instead of normalizing run identities", () => {
    for (const timestamp of ["2026-02-30T00:00:00.000Z", "2026-01-01T24:00:00.000Z"]) {
      expect(() =>
        planAtomicRunDirectory({
          outputRoot: `output/real-build-invalid-timestamp-${randomUUID()}`,
          inputDigests,
          runContractDigest: REAL_BUILD_TEST_DIGEST,
          timestamp,
          nonce: randomUUID(),
        }),
      ).toThrow(/canonical UTC/u);
    }
  });

  it("never weakens a latched publication verifier after a pre-rename failure", () => {
    const outputRoot = `output/real-build-publication-verifier-test-${randomUUID()}`;
    const absoluteOutputRoot = join(process.cwd(), outputRoot);
    try {
      const plan = planAtomicRunDirectory({
        outputRoot,
        inputDigests,
        runContractDigest: REAL_BUILD_TEST_DIGEST,
        timestamp: "2026-08-02T12:34:56.789Z",
        nonce: randomUUID(),
      });
      const run = beginAtomicRun(plan);
      mkdirSync(join(run.directory, "source-snapshot"));
      let calls = 0;
      const requiredVerifier = (): never => {
        calls += 1;
        throw new Error("forced artifact verifier failure");
      };

      expect(() => run.publish(requiredVerifier)).toThrow(/forced artifact verifier failure/u);
      expect(() => run.publish()).toThrow(/forced artifact verifier failure/u);
      expect(calls).toBe(2);
      expect(existsSync(plan.finalDirectory)).toBe(false);
      expect(() =>
        run.publish(() => ({
          runId: plan.runId,
          replayClosureDigest: REAL_BUILD_TEST_DIGEST,
          artifactManifestDigest: REAL_BUILD_TEST_DIGEST,
        })),
      ).toThrow(/verifier was already latched/u);
    } finally {
      rmSync(absoluteOutputRoot, { recursive: true, force: true });
    }
  });

  it("atomically publishes, inspects retained data without execution, and detects CAS tampering", async () => {
    const outputRoot = `output/real-build-replay-test-${randomUUID()}`;
    const absoluteOutputRoot = join(process.cwd(), outputRoot);
    try {
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
      const runContract = createRealBuildRunContract({
        inputDigests,
        identificationClosure,
        panelSourceDigest,
        panels: options.panels,
        passivePanels: options.passivePanels,
        budgets: realBuildRunBudgets(options),
        thresholds: realBuildRunThresholds(options),
        codeSnapshots,
      });
      const plan = planAtomicRunDirectory({
        outputRoot,
        inputDigests,
        runContractDigest: runContract.contractDigest,
        timestamp: "2026-08-02T12:34:56.789Z",
        nonce: randomUUID(),
      });
      let injectedPostRenameFailure = false;
      const run = beginAtomicRun(plan, {
        afterDirectoryRename: () => {
          if (injectedPostRenameFailure) return;
          injectedPostRenameFailure = true;
          throw new Error("forced post-rename failure");
        },
      });
      const sourceMirror = materializeRealBuildSourceMirror({
        directory: run.directory,
        repoRoot: process.cwd(),
        sourceFiles,
        fixedInputs: [{ path: "inputs/booklet.pdf", bytes: rawRoleBytes.pdf! }],
      });
      const retainedBrowserOutput = browserOutput();
      const served = currentArtifactServedEvidence({
        sourceRoot: sourceMirror.root,
        pdfBytes: rawRoleBytes.pdf!.byteLength,
        pdfDigest: inputDigests.pdf,
      });
      const legacyActionLedgerBytes = Buffer.from(
        Buffer.from(rawRoleBytes["action-ledger"]!)
          .toString("utf8")
          .replace("lego.real-build-action-ledger/3", "lego.real-build-action-ledger/2"),
        "utf8",
      );
      const legacyInputDigests = {
        ...inputDigests,
        actionLedger: sha256Digest(legacyActionLedgerBytes),
      };
      const legacyOptions = { ...options, inputDigests: legacyInputDigests };
      const legacyLedgerContract = createRealBuildRunContract({
        inputDigests: legacyInputDigests,
        identificationClosure: runContract.identificationClosure,
        panelSourceDigest: runContract.panelSourceDigest,
        panels: legacyOptions.panels,
        passivePanels: legacyOptions.passivePanels,
        budgets: realBuildRunBudgets(legacyOptions),
        thresholds: realBuildRunThresholds(legacyOptions),
        codeSnapshots,
      });
      const legacyProbeDirectory = join(run.directory, "legacy-ledger-probe");
      mkdirSync(legacyProbeDirectory);
      expect(() =>
        writeRealBuildReplayClosure({
          directory: legacyProbeDirectory,
          repoRoot: sourceMirror.root,
          roles: [
            ...Object.entries(rawRoleBytes).map(([role, bytes]) => ({
              role,
              bytes: role === "action-ledger" ? legacyActionLedgerBytes : bytes,
            })),
            {
              role: "prepared-options",
              bytes: encodeRealBuildPreparedRunInput(legacyOptions),
            },
            {
              role: "run-contract",
              bytes: encodeCurrentRealBuildRunContract(legacyLedgerContract),
            },
          ],
          sourceFiles: sourceMirror.files.map(({ path }) => path),
          environment: {
            schemaVersion: "lego.real-build-environment/1",
            node: process.version,
            platform: process.platform,
            arch: process.arch,
            versions: process.versions,
            browser: { name: "chromium", version: "test" },
            playwright: "@playwright/test (exact package bytes retained in source bundle)",
            replayProtocol: 1,
            bootstrapSourceManifestDigest: bootstrapManifest.manifestDigest,
            runContractDigest: legacyLedgerContract.contractDigest,
            servedResponseManifestDigest: sha256Digest(served.manifestBytes),
          },
          browserOutputRetained: false,
        }),
      ).toThrow(/action-ledger.*lego\.real-build-action-ledger\/3/su);
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
        runContractDigest: runContract.contractDigest,
        servedResponseManifestDigest: sha256Digest(served.manifestBytes),
      };
      const currentReplayRoles = (
        preparedOptionsBytes: Uint8Array,
        retainedRunContract = runContract,
        roleOverrides: Readonly<Record<string, Uint8Array>> = {},
      ) => [
        ...Object.entries(rawRoleBytes).map(([role, bytes]) => ({
          role,
          bytes: roleOverrides[role] ?? bytes,
        })),
        {
          role: "browser-output",
          bytes: encodeCanonicalRealBuildJson(retainedBrowserOutput),
        },
        { role: "prepared-options", bytes: preparedOptionsBytes },
        {
          role: "run-contract",
          bytes: encodeCurrentRealBuildRunContract(retainedRunContract),
        },
      ];
      const admittedLedger = admitCanonicalRealBuildActionLedgerBytes({
        bytes: rawRoleBytes["action-ledger"]!,
        label: "replay mismatch control ledger",
        mode: "exact-execution",
        requestedLastStep: 1,
      });
      const contradictoryStep = {
        ...admittedLedger.steps[0]!,
        action: {
          kind: "transition" as const,
          transition: "rotation" as const,
          classificationEvidenceDigest: REAL_BUILD_TEST_DIGEST,
        },
      };
      const contradictoryLedger = {
        ...admittedLedger,
        steps: [contradictoryStep],
        provenance: {
          ...admittedLedger.provenance,
          directPieceCount: 0,
          transitionStepCount: 1,
        },
      };
      const contradictoryLedgerBytes = encodeRealBuildActionLedger(contradictoryLedger);
      expect(() =>
        admitCanonicalRealBuildActionLedgerBytes({
          bytes: contradictoryLedgerBytes,
          label: "replay mismatch contradictory ledger",
          mode: "exact-execution",
          requestedLastStep: 1,
        }),
      ).not.toThrow();
      const contradictoryInputDigests = {
        ...inputDigests,
        actionLedger: sha256Digest(contradictoryLedgerBytes),
      };
      const contradictoryPanel = {
        ...options.panels[0]!,
        action: {
          ...options.panels[0]!.action,
          evidenceDigest: actionEvidenceDigest({
            ledgerDigest: contradictoryInputDigests.actionLedger,
            officialModelDigest: contradictoryInputDigests.officialModel,
            builderCalibrationDigest: contradictoryInputDigests.builderCalibration,
            transitionClassificationsDigest: contradictoryInputDigests.transitionClassifications,
            step: contradictoryStep,
          }),
        },
      };
      const contradictoryOptions = {
        ...options,
        inputDigests: contradictoryInputDigests,
        panels: [contradictoryPanel],
      };
      const contradictoryContract = createRealBuildRunContract({
        inputDigests: contradictoryInputDigests,
        identificationClosure: runContract.identificationClosure,
        panelSourceDigest: runContract.panelSourceDigest,
        panels: contradictoryOptions.panels,
        passivePanels: contradictoryOptions.passivePanels,
        budgets: realBuildRunBudgets(contradictoryOptions),
        thresholds: realBuildRunThresholds(contradictoryOptions),
        codeSnapshots,
      });
      const contradictoryDirectory = join(run.directory, "contradictory-action-ledger-probe");
      mkdirSync(contradictoryDirectory);
      expect(() =>
        writeRealBuildReplayClosure({
          directory: contradictoryDirectory,
          repoRoot: sourceMirror.root,
          roles: [
            ...Object.entries(rawRoleBytes).map(([role, bytes]) => ({
              role,
              bytes: role === "action-ledger" ? contradictoryLedgerBytes : bytes,
            })),
            {
              role: "prepared-options",
              bytes: encodeRealBuildPreparedRunInput(contradictoryOptions),
            },
            {
              role: "run-contract",
              bytes: encodeCurrentRealBuildRunContract(contradictoryContract),
            },
          ],
          sourceFiles: sourceMirror.files.map(({ path }) => path),
          environment: {
            ...replayEnvironment,
            runContractDigest: contradictoryContract.contractDigest,
          },
          browserOutputRetained: false,
        }),
      ).toThrow(/does not exactly reproduce the prepared-options action/u);
      const sourceContradictoryOptions = {
        ...options,
        panels: [{ ...options.panels[0]!, minXPt: 0.01 }],
      };
      const sourceContradictoryContract = createRealBuildRunContract({
        inputDigests,
        identificationClosure: runContract.identificationClosure,
        panelSourceDigest: runContract.panelSourceDigest,
        panels: sourceContradictoryOptions.panels,
        passivePanels: sourceContradictoryOptions.passivePanels,
        budgets: realBuildRunBudgets(sourceContradictoryOptions),
        thresholds: realBuildRunThresholds(sourceContradictoryOptions),
        codeSnapshots,
      });
      const sourceContradictoryDirectory = join(run.directory, "contradictory-panel-source-probe");
      mkdirSync(sourceContradictoryDirectory);
      expect(() =>
        writeRealBuildReplayClosure({
          directory: sourceContradictoryDirectory,
          repoRoot: sourceMirror.root,
          roles: currentReplayRoles(
            encodeRealBuildPreparedRunInput(sourceContradictoryOptions),
            sourceContradictoryContract,
          ),
          sourceFiles: sourceMirror.files.map(({ path }) => path),
          environment: {
            ...replayEnvironment,
            runContractDigest: sourceContradictoryContract.contractDigest,
          },
          browserOutputRetained: true,
        }),
      ).toThrow(/independently replayed retained 359-step panel source/u);
      const faceContradictoryOptions = {
        ...options,
        passivePanels: [
          {
            ...options.passivePanels[0]!,
            panelFace:
              options.passivePanels[0]!.panelFace === "studs-up"
                ? ("underside" as const)
                : ("studs-up" as const),
          },
          ...options.passivePanels.slice(1),
        ],
      };
      const faceContradictoryContract = createRealBuildRunContract({
        inputDigests,
        identificationClosure: runContract.identificationClosure,
        panelSourceDigest: runContract.panelSourceDigest,
        panels: faceContradictoryOptions.panels,
        passivePanels: faceContradictoryOptions.passivePanels,
        budgets: realBuildRunBudgets(faceContradictoryOptions),
        thresholds: realBuildRunThresholds(faceContradictoryOptions),
        codeSnapshots,
      });
      const faceContradictoryDirectory = join(
        run.directory,
        "contradictory-panel-face-source-probe",
      );
      mkdirSync(faceContradictoryDirectory);
      expect(() =>
        writeRealBuildReplayClosure({
          directory: faceContradictoryDirectory,
          repoRoot: sourceMirror.root,
          roles: currentReplayRoles(
            encodeRealBuildPreparedRunInput(faceContradictoryOptions),
            faceContradictoryContract,
          ),
          sourceFiles: sourceMirror.files.map(({ path }) => path),
          environment: {
            ...replayEnvironment,
            runContractDigest: faceContradictoryContract.contractDigest,
          },
          browserOutputRetained: true,
        }),
      ).toThrow(/page\/face\/bounds\/calloutBoxes.*independently replayed/u);
      const widenedPanelSource = JSON.parse(
        Buffer.from(rawRoleBytes["panel-source"]!).toString("utf8"),
      ) as {
        requestedLastStep: number;
        pageShapes: Array<{ pageNumber: number; shapes: unknown[] }>;
      };
      widenedPanelSource.requestedLastStep = 2;
      widenedPanelSource.pageShapes.push({ pageNumber: 5, shapes: [] });
      const widenedPanelSourceBytes = encodeCanonicalRealBuildJson(widenedPanelSource);
      const widenedPanelSourceContract = createRealBuildRunContract({
        inputDigests,
        identificationClosure: runContract.identificationClosure,
        panelSourceDigest: sha256Digest(widenedPanelSourceBytes),
        panels: options.panels,
        passivePanels: options.passivePanels,
        budgets: realBuildRunBudgets(options),
        thresholds: realBuildRunThresholds(options),
        codeSnapshots,
      });
      const widenedPanelSourceDirectory = join(
        run.directory,
        "contradictory-panel-source-request-probe",
      );
      mkdirSync(widenedPanelSourceDirectory);
      expect(() =>
        writeRealBuildReplayClosure({
          directory: widenedPanelSourceDirectory,
          repoRoot: sourceMirror.root,
          roles: currentReplayRoles(
            encodeRealBuildPreparedRunInput(options),
            widenedPanelSourceContract,
            { "panel-source": widenedPanelSourceBytes },
          ),
          sourceFiles: sourceMirror.files.map(({ path }) => path),
          environment: {
            ...replayEnvironment,
            runContractDigest: widenedPanelSourceContract.contractDigest,
          },
          browserOutputRetained: true,
        }),
      ).toThrow(/panel-source requestedLastStep 2.*prepared-options lastStep 1/u);
      const noncanonicalPreparedProbeDirectory = join(run.directory, "noncanonical-prepared-probe");
      mkdirSync(noncanonicalPreparedProbeDirectory);
      const canonicalPreparedOptions = encodeRealBuildPreparedRunInput(options);
      expect(() =>
        writeRealBuildReplayClosure({
          directory: noncanonicalPreparedProbeDirectory,
          repoRoot: sourceMirror.root,
          roles: currentReplayRoles(Buffer.concat([Buffer.from(" "), canonicalPreparedOptions])),
          sourceFiles: sourceMirror.files.map(({ path }) => path),
          environment: replayEnvironment,
          browserOutputRetained: true,
        }),
      ).toThrow(/canonical compact JSON bytes/u);
      writeFileSync(join(run.directory, served.runnerFile), served.runnerBytes);
      writeFileSync(join(run.directory, served.manifestFile), served.manifestBytes);
      const replayClosure = writeRealBuildReplayClosure({
        directory: run.directory,
        repoRoot: sourceMirror.root,
        roles: currentReplayRoles(canonicalPreparedOptions),
        sourceFiles: sourceMirror.files.map(({ path }) => path),
        environment: replayEnvironment,
        browserOutputRetained: true,
      });
      const result = finalizeExecutedRealBuildResult({
        options,
        browserOutput: retainedBrowserOutput,
      });
      expect(result).toMatchObject({
        status: "incomplete",
        diagnosticPrefix: null,
        documentJson: null,
        structuralHash: null,
        finalParts: 0,
      });
      writeFileSync(
        join(run.directory, "score.json"),
        encodeCanonicalRealBuildJson(
          createRealBuildScore({
            runId: plan.runId,
            result,
            accounting: options.accounting,
            lastStep: options.lastStep,
          }),
          "pretty-one-space-line",
        ),
      );
      writeRealBuildArtifactManifest({
        directory: run.directory,
        runId: plan.runId,
        runContract,
        result,
        artifactFiles: [served.manifestFile, served.runnerFile, "score.json"],
        replayClosure,
      });
      mkdirSync(plan.pointerPath);
      const prePublishManifest = readFileSync(join(run.directory, "replay-closure.json"));
      const verifiedDirectories: string[] = [];
      const verifyClosure = (directory: string) => {
        verifiedDirectories.push(directory);
        return verifyRealBuildArtifactManifest(directory, plan.runId);
      };
      expect(() => run.publish(verifyClosure)).toThrow(
        /directory committed.*pointer was not written/u,
      );
      writeFileSync(join(plan.finalDirectory, "replay-closure.json"), "tampered");
      expect(() => run.publish()).toThrow();
      expect(existsSync(plan.pointerPath)).toBe(true);
      writeFileSync(join(plan.finalDirectory, "replay-closure.json"), prePublishManifest);
      expect(() => run.publish()).toThrow(/current-run pointer|existing target|regular file/u);
      expect(existsSync(plan.finalDirectory)).toBe(true);
      expect(existsSync(plan.temporaryDirectory)).toBe(false);
      rmSync(plan.pointerPath, { recursive: true });
      const published = run.publish();
      expect(verifiedDirectories).toEqual(
        expect.arrayContaining([plan.temporaryDirectory, plan.finalDirectory]),
      );
      expect(existsSync(join(published, "source-snapshot"))).toBe(false);
      const closure = verifyRealBuildReplayClosure(published);
      const artifactManifestDigest = sha256Digest(
        readFileSync(join(published, "artifact-manifest.json")),
      );
      expect(closure).toMatchObject({ authority: "local-diagnostic", authenticated: false });
      const verified = verifyRealBuildReplayClosureData(published);
      expect(verified.roleBytes.get("official-model")).not.toBe(
        verified.roleBytes.get("action-ledger"),
      );
      expect(verified.roleBytes.get("action-ledger")).toEqual(rawRoleBytes["action-ledger"]);
      expect(JSON.parse(readFileSync(plan.pointerPath, "utf8"))).toEqual({
        schemaVersion: "lego.real-build-run-pointer/2",
        runId: plan.runId,
        replayClosureDigest: closure.manifestDigest,
        artifactManifestDigest,
      });

      const scorePath = join(published, "score.json");
      const artifactManifestPath = join(published, "artifact-manifest.json");
      const originalScore = readFileSync(scorePath);
      const originalArtifactManifest = readFileSync(artifactManifestPath);
      const duplicateArtifactManifest = originalArtifactManifest
        .toString("utf8")
        .replace('"runContract":', '"runContract":{},"runContract":');
      writeFileSync(artifactManifestPath, duplicateArtifactManifest);
      expect(() => verifyRealBuildArtifactManifest(published, plan.runId)).toThrow(
        /duplicate-free finite UTF-8/u,
      );
      writeFileSync(artifactManifestPath, originalArtifactManifest);

      const duplicateScoreBytes = Buffer.from(
        originalScore.toString("utf8").replace('"steps":', '"steps":[],"steps":'),
      );
      const duplicateScoreManifest = JSON.parse(originalArtifactManifest.toString("utf8")) as {
        artifacts: { file: string; bytes: number; digest: string }[];
      };
      const duplicateScoreEntry = duplicateScoreManifest.artifacts.find(
        ({ file }) => file === "score.json",
      )!;
      duplicateScoreEntry.bytes = duplicateScoreBytes.length;
      duplicateScoreEntry.digest = sha256Digest(duplicateScoreBytes);
      writeFileSync(scorePath, duplicateScoreBytes);
      writeFileSync(
        artifactManifestPath,
        encodeCanonicalRealBuildJson(duplicateScoreManifest, "pretty-one-space-line"),
      );
      expect(() => verifyRealBuildArtifactManifest(published, plan.runId)).toThrow(
        /duplicate-free finite UTF-8/u,
      );
      writeFileSync(scorePath, originalScore);
      writeFileSync(artifactManifestPath, originalArtifactManifest);

      const forgedScore = JSON.parse(originalScore.toString("utf8")) as {
        steps: Record<string, unknown>[];
      };
      delete forgedScore.steps[0]!.fit;
      const forgedScoreBytes = encodeCanonicalRealBuildJson(forgedScore, "pretty-one-space-line");
      writeFileSync(scorePath, forgedScoreBytes);
      const forgedArtifactManifest = JSON.parse(originalArtifactManifest.toString("utf8")) as {
        artifacts: { file: string; bytes: number; digest: string }[];
      };
      const scoreEntry = forgedArtifactManifest.artifacts.find(
        ({ file }) => file === "score.json",
      )!;
      scoreEntry.bytes = forgedScoreBytes.length;
      scoreEntry.digest = sha256Digest(forgedScoreBytes);
      writeFileSync(
        artifactManifestPath,
        encodeCanonicalRealBuildJson(forgedArtifactManifest, "pretty-one-space-line"),
      );
      expect(() => verifyRealBuildArtifactManifest(published, plan.runId)).toThrow(
        /does not exactly reproduce/u,
      );
      writeFileSync(scorePath, originalScore);
      writeFileSync(artifactManifestPath, originalArtifactManifest);

      const mixedGenerationScore = JSON.parse(originalScore.toString("utf8")) as {
        schemaVersion: string;
      };
      mixedGenerationScore.schemaVersion = "lego.real-build-score/4";
      const mixedGenerationScoreBytes = encodeCanonicalRealBuildJson(
        mixedGenerationScore,
        "pretty-one-space-line",
      );
      writeFileSync(scorePath, mixedGenerationScoreBytes);
      const mixedGenerationManifest = JSON.parse(originalArtifactManifest.toString("utf8")) as {
        artifacts: { file: string; bytes: number; digest: string }[];
      };
      const mixedGenerationEntry = mixedGenerationManifest.artifacts.find(
        ({ file }) => file === "score.json",
      )!;
      mixedGenerationEntry.bytes = mixedGenerationScoreBytes.length;
      mixedGenerationEntry.digest = sha256Digest(mixedGenerationScoreBytes);
      writeFileSync(
        artifactManifestPath,
        encodeCanonicalRealBuildJson(mixedGenerationManifest, "pretty-one-space-line"),
      );
      expect(() => verifyRealBuildArtifactManifest(published, plan.runId)).toThrow(
        /Retained score must bind/u,
      );
      writeFileSync(scorePath, originalScore);
      writeFileSync(artifactManifestPath, originalArtifactManifest);

      writeFileSync(join(published, "document.json"), "{}\n");
      expect(() => verifyRealBuildArtifactManifest(published, plan.runId)).toThrow(
        /undeclared reserved evidence file.*document\.json/u,
      );
      rmSync(join(published, "document.json"));

      const inspected = inspectRealBuildReplayClosure(published);
      expect(inspected).toMatchObject({
        authority: "local-diagnostic",
        authenticated: false,
        replayLevel: "downstream-only",
        contractDigest: runContract.contractDigest,
        contractSchemaVersion: "lego.real-build-run-contract/4",
      });
      expect(inspected.roleTrace.map(({ role }) => role)).toContain("builder-geometry");
      expect(inspected.roleTrace.map(({ role }) => role)).toEqual(
        expect.arrayContaining([
          "identification-features",
          "identification-match",
          "identification-distances",
          "element-resolution",
        ]),
      );
      expect(inspected.roleTrace.map(({ role }) => role)).not.toContain("identification-cards");
      expect(inspected.roleTrace.map(({ role }) => role)).not.toContain("identification-answers");
      expect(inspected.sourceTrace.length).toBeGreaterThan(0);
      await expect(replayRealBuildFinalizationDiagnostic(published)).rejects.toThrow(
        /retained source is untrusted and is never loaded or executed/u,
      );
      await expect(replayRealBuildFinalization(published)).rejects.toThrow(
        /no released companion-broker trust root/u,
      );

      const manifestPath = join(published, "replay-closure.json");
      const originalManifest = readFileSync(manifestPath);
      writeFileSync(
        manifestPath,
        originalManifest.toString("utf8").replace('"roles":', '"roles":[],"roles":'),
      );
      expect(() => verifyRealBuildReplayClosure(published)).toThrow(/duplicate-free finite UTF-8/u);
      writeFileSync(manifestPath, originalManifest);
      const selfRehashed = JSON.parse(originalManifest.toString("utf8")) as Record<string, unknown>;
      selfRehashed.authenticated = true;
      writeFileSync(manifestPath, encodeRehashedReplayManifest(selfRehashed));
      expect(() => verifyRealBuildReplayClosure(published)).toThrow(/schema is malformed/u);
      writeFileSync(manifestPath, originalManifest);

      const rewriteReservedJsonRole = (
        roleName: "browser-output" | "environment",
        bytes: Uint8Array,
      ): void => {
        const forged = JSON.parse(originalManifest.toString("utf8")) as {
          roles: { role: string; digest: string; bytes: number; casPath: string }[];
          environmentDigest: string;
          manifestDigest?: string;
        };
        const entry = forged.roles.find(({ role }) => role === roleName)!;
        const roleDigest = sha256Digest(bytes);
        const hex = roleDigest.slice("sha256:".length);
        entry.digest = roleDigest;
        entry.bytes = bytes.byteLength;
        entry.casPath = `cas/sha256/${hex.slice(0, 2)}/${hex.slice(2)}`;
        if (roleName === "environment") forged.environmentDigest = roleDigest;
        mkdirSync(join(published, "cas", "sha256", hex.slice(0, 2)), { recursive: true });
        writeFileSync(join(published, entry.casPath), bytes);
        writeFileSync(manifestPath, encodeRehashedReplayManifest(forged));
      };
      rewriteReservedJsonRole("browser-output", Buffer.from("{}"));
      expect(() => verifyRealBuildReplayClosure(published)).toThrow(
        /browser-output must be an executed or failed object/u,
      );
      rewriteReservedJsonRole(
        "browser-output",
        Buffer.from('{"schemaVersion":"lego.real-build-browser-output/2"}'),
      );
      expect(() => verifyRealBuildReplayClosure(published)).toThrow(
        /browser-output must be an executed or failed object/u,
      );
      const duplicateBrowserOutput = new TextDecoder()
        .decode(encodeCanonicalRealBuildJson(browserOutput()))
        .replace('"reports":', '"reports":[],"reports":');
      rewriteReservedJsonRole("browser-output", Buffer.from(duplicateBrowserOutput));
      expect(() => verifyRealBuildReplayClosure(published)).toThrow(/duplicate-free finite UTF-8/u);
      rewriteReservedJsonRole(
        "browser-output",
        encodeCanonicalRealBuildJson({
          ...browserOutput(),
          reports: [
            {
              stepNumber: 1,
              pageNumber: 1,
              pieces: [],
              action: {},
              outcome: {},
              validation: { attempted: true, blockingIssues: [] },
              elapsedMs: 0,
              panelPng: null,
              buildPng: null,
            },
          ],
        }),
      );
      expect(() => verifyRealBuildReplayClosure(published)).toThrow(
        /complete prepared-panel boundary shape/u,
      );
      rewriteReservedJsonRole("environment", Buffer.from([0xc3, 0x28]));
      expect(() => verifyRealBuildReplayClosure(published)).toThrow(/duplicate-free finite UTF-8/u);
      const environmentRole = closure.roles.find(({ role }) => role === "environment")!;
      const originalEnvironment = readFileSync(join(published, environmentRole.casPath));
      rewriteReservedJsonRole(
        "environment",
        Buffer.from(
          originalEnvironment
            .toString("utf8")
            .replace('"schemaVersion":', '"schemaVersion":"hidden","schemaVersion":'),
        ),
      );
      expect(() => verifyRealBuildReplayClosure(published)).toThrow(/duplicate-free finite UTF-8/u);
      writeFileSync(manifestPath, originalManifest);

      const browserRole = closure.roles.find(({ role }) => role === "browser-output")!;
      writeFileSync(join(published, browserRole.casPath), "tampered");
      expect(() => verifyRealBuildReplayClosure(published)).toThrow(
        /CAS size\/hash|required exactly \d+ bytes/u,
      );
      writeFileSync(
        join(published, browserRole.casPath),
        encodeCanonicalRealBuildJson(browserOutput()),
      );

      writeFileSync(manifestPath, Buffer.from([0xff]));
      expect(() => verifyRealBuildReplayClosure(published)).toThrow(/duplicate-free finite UTF-8/u);

      const oversizedRoleManifest = JSON.parse(originalManifest.toString("utf8")) as {
        roles: { role: string; bytes: number }[];
        manifestDigest?: string;
      };
      oversizedRoleManifest.roles.find(({ role }) => role === "pdf")!.bytes = 96 * 1024 * 1024 + 1;
      writeFileSync(manifestPath, encodeRehashedReplayManifest(oversizedRoleManifest));
      expect(() => verifyRealBuildReplayClosure(published)).toThrow(
        /Replay role pdf.*role-specific requirement/u,
      );
      writeFileSync(manifestPath, originalManifest);
    } finally {
      rmSync(absoluteOutputRoot, { recursive: true, force: true });
    }
  }, 120_000);

  it("rejects traversal and absolute paths before filesystem access", () => {
    expect(() => resolveRealBuildPath(process.cwd(), "../escape")).toThrow(/strict relative/u);
    expect(() => resolveRealBuildPath(process.cwd(), "C:/escape")).toThrow(/strict relative/u);
    expect(REAL_BUILD_SOURCE_ROOTS).toEqual(
      expect.arrayContaining([
        "node_modules/fast-deep-equal",
        "node_modules/fast-uri",
        "node_modules/require-from-string",
        "packages/protocol/node_modules/json-schema-traverse",
      ]),
    );
    const replaySource = readFileSync(
      join(process.cwd(), "apps/web/e2e/real-build-replay.ts"),
      "utf8",
    );
    expect(replaySource).not.toMatch(
      /spawnSync|registerHooks|materializeRetainedRuntime|executeIsolated|stripTypeScriptTypes/u,
    );
    expect(replaySource).not.toMatch(/\bimport\s*\(/u);
  });
});
