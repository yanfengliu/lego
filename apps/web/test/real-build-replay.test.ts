import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("../e2e/real-build-identification-closure", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../e2e/real-build-identification-closure")>();
  const { __testOnly } = await import("../../../scripts/booklet-catalog-coverage.mjs");
  const { SYNTHETIC_IDENTIFICATION_MANIFEST_EXPECTATION } =
    await import("./real-build-identification-golden");
  return {
    ...actual,
    verifyRealBuildIdentificationClosure: (
      input: Parameters<typeof actual.prepareRealBuildIdentificationClosure>[0],
    ) =>
      __testOnly.verifyBookletCatalogCoverageClosure(
        actual.prepareRealBuildIdentificationClosure(input),
        SYNTHETIC_IDENTIFICATION_MANIFEST_EXPECTATION,
      ),
  };
});

import { createEmptyBrickDocument, validateBrickDocument } from "@lego-studio/brick-kernel";

import {
  beginAtomicRun,
  createRealBuildScore,
  createRealBuildRunContract,
  planAtomicRunDirectory,
  sha256Digest,
  verifyRealBuildArtifactManifest,
  writeRealBuildArtifactManifest,
} from "../e2e/real-build-artifacts";
import type { RealBuildBrowserOutput } from "../e2e/real-build-browser-output";
import { finalizeExecutedRealBuildResult } from "../e2e/real-build-finalize";
import {
  BUILDER_GEOMETRY_EXACT_BYTES,
  encodeHighlightRendererCompatibilityInputClosure,
} from "../e2e/real-build-input-files";
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
  normalizedServedResponseSourceRoot,
  REAL_BUILD_SERVED_RESPONSE_MANIFEST,
  REAL_BUILD_SERVED_RESPONSE_RUNNER_BODY,
  REAL_BUILD_SERVED_RESPONSE_RUNNER_HEADERS,
  REAL_BUILD_SERVED_RESPONSE_RUNNER_PATH,
  REAL_BUILD_SERVED_RESPONSE_RUNNER_STATUS,
  REAL_BUILD_SERVED_RESPONSE_SCHEMA,
  servedResponseChunkName,
  servedResponseDigest,
  servedResponseRequestKey,
  strictServedResponseHeaders,
} from "../e2e/real-build-served-response-policy";
import {
  createRealBuildBootstrapSourceManifest,
  REAL_BUILD_SOURCE_ROOT_POLICY_PATH,
} from "../e2e/real-build-bootstrap-source";
import {
  REAL_BUILD_INPUT_ROLE_BY_DIGEST,
  REAL_BUILD_IDENTIFICATION_ROLE_BY_DIGEST,
  realBuildRunBudgets,
  realBuildRunThresholds,
} from "../e2e/real-build-run-contract";
import { stepPrerequisiteFacts, type RealBuildStepReport } from "../e2e/real-build-safety";
import {
  REAL_BUILD_TEST_DIGEST,
  completeRealBuildTestOptions,
  realBuildTransitionPanel,
} from "./real-build-test-options";
import {
  SYNTHETIC_IDENTIFICATION_GOLDEN,
  syntheticIdentificationGoldenBytes,
} from "./real-build-identification-golden";

const DIGEST = REAL_BUILD_TEST_DIGEST;
const panel = realBuildTransitionPanel(1);
const sharedOpaqueRoleBytes = new TextEncoder().encode("shared-opaque-role-bytes");
const rawRoleBytes = {
  ...Object.fromEntries(
    Object.values(REAL_BUILD_INPUT_ROLE_BY_DIGEST).map((role) => [
      role,
      new TextEncoder().encode(`retained-${role}`),
    ]),
  ),
  [REAL_BUILD_INPUT_ROLE_BY_DIGEST.pdf]: new TextEncoder().encode("synthetic-booklet"),
  [REAL_BUILD_INPUT_ROLE_BY_DIGEST.officialModel]: sharedOpaqueRoleBytes,
  [REAL_BUILD_INPUT_ROLE_BY_DIGEST.actionLedger]: sharedOpaqueRoleBytes,
  [REAL_BUILD_INPUT_ROLE_BY_DIGEST.highlightCalibration]:
    encodeHighlightRendererCompatibilityInputClosure(Buffer.from("{}"), Buffer.from("{}")),
  [REAL_BUILD_INPUT_ROLE_BY_DIGEST.builderGeometry]: Buffer.alloc(BUILDER_GEOMETRY_EXACT_BYTES),
  [REAL_BUILD_INPUT_ROLE_BY_DIGEST.calloutManifest]: syntheticIdentificationGoldenBytes("manifest"),
  [REAL_BUILD_INPUT_ROLE_BY_DIGEST.coverage]: syntheticIdentificationGoldenBytes("coverage"),
  [REAL_BUILD_IDENTIFICATION_ROLE_BY_DIGEST.features]:
    syntheticIdentificationGoldenBytes("features"),
  [REAL_BUILD_IDENTIFICATION_ROLE_BY_DIGEST.match]: syntheticIdentificationGoldenBytes("match"),
  [REAL_BUILD_IDENTIFICATION_ROLE_BY_DIGEST.distances]:
    syntheticIdentificationGoldenBytes("distances"),
  [REAL_BUILD_IDENTIFICATION_ROLE_BY_DIGEST.elements]:
    syntheticIdentificationGoldenBytes("elementResolution"),
  [REAL_BUILD_IDENTIFICATION_ROLE_BY_DIGEST.pairJudged]:
    syntheticIdentificationGoldenBytes("pairJudged"),
} as Readonly<Record<string, Uint8Array>>;
const inputDigests = Object.fromEntries(
  Object.entries(REAL_BUILD_INPUT_ROLE_BY_DIGEST).map(([inputKey, role]) => [
    inputKey,
    sha256Digest(rawRoleBytes[role]!),
  ]),
) as unknown as ReturnType<typeof completeRealBuildTestOptions>["inputDigests"];
const baseOptions = completeRealBuildTestOptions(1);
const options = {
  ...baseOptions,
  inputDigests,
  highlightCalibrationDigest: inputDigests.highlightCalibration,
  coverageInputBindings: {
    pdf: inputDigests.pdf,
    calloutManifest: inputDigests.calloutManifest,
  },
};

function browserOutput(): RealBuildBrowserOutput {
  const base = createEmptyBrickDocument({ id: "replay", name: "replay", maxParts: 1_464 });
  const document = {
    ...base,
    steps: [
      {
        id: "step-1",
        index: 0,
        name: `Step 1 [transition:rotation;panel=${DIGEST}]`,
        partIds: [],
      },
    ],
  };
  const validation = validateBrickDocument(document);
  const report: RealBuildStepReport = {
    stepNumber: 1,
    pageNumber: 1,
    calloutPieces: 0,
    expectedAssembledPieces: 0,
    attemptedPieces: 0,
    placedPieces: 0,
    action: panel.action,
    actionEvidenceDigest: DIGEST,
    canonicalStepId: "step-1",
    prerequisites: stepPrerequisiteFacts({
      stepNumber: 1,
      actionKind: "transition",
      blockingStep: null,
      coverageFailures: [],
      unresolvedCallouts: [],
      missingDesigns: [],
      calloutPieces: 0,
      expectedAssembledPieces: 0,
      resolvedPieces: 0,
    }),
    outcome: { status: "complete", mechanism: "instruction-transition", failure: null },
    validation: {
      attempted: true,
      targetDocumentHash: validation.targetDocumentHash,
      truthSnapshotHash: validation.truthSnapshotHash,
      validatorSetHash: validation.validatorSetHash,
      documentGloballyValid: validation.documentGloballyValid,
      blockingIssues: [],
      failure: null,
    },
    fit: {
      azimuthDegrees: null,
      elevationDegrees: null,
      pixelsPerUnit: null,
      residualPx: null,
      coherence: 0,
      failure: null,
    },
    camera: null,
    highlight: { regions: 0, closedContourRate: 0, strokePx: 0, boundsPx: null },
    arrows: { kept: 0, redPx: 0, rejected: 0, displacementFamily: 0 },
    pieces: [],
    jointVisual: null,
    documentParts: 0,
    elapsedMs: 1,
    panelPng: null,
    buildPng: null,
  };
  return {
    schemaVersion: "lego.real-build-browser-output/1",
    status: "executed",
    reports: [report],
    documentJson: JSON.stringify(document),
    identityBindings: [],
    fetchedPdfDigest: inputDigests.pdf,
    totalElapsedMs: 1,
  };
}

/** Run roots this file leaves behind, which must be none. */
function replayTestRoots(): readonly string[] {
  const output = join(process.cwd(), "output");
  if (!existsSync(output)) return [];
  return readdirSync(output).filter((name) => name.startsWith("real-build-replay-test-"));
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
        identificationClosure: {
          source: "deterministic",
          features: SYNTHETIC_IDENTIFICATION_GOLDEN.features.digest,
          match: SYNTHETIC_IDENTIFICATION_GOLDEN.match.digest,
          distances: SYNTHETIC_IDENTIFICATION_GOLDEN.distances.digest,
          elements: SYNTHETIC_IDENTIFICATION_GOLDEN.elementResolution.digest,
          cards: null,
          cardImages: null,
          answers: null,
          pairJudged: SYNTHETIC_IDENTIFICATION_GOLDEN.pairJudged.digest,
        },
        panels: options.panels,
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
      const runnerBody = Buffer.from(REAL_BUILD_SERVED_RESPONSE_RUNNER_BODY);
      const runnerBodyDigest = servedResponseDigest(runnerBody);
      const runnerChunk = servedResponseChunkName(0);
      const runnerRequestHeaders = strictServedResponseHeaders({ accept: "*/*" });
      const runnerRequestKey = servedResponseRequestKey(
        REAL_BUILD_SERVED_RESPONSE_RUNNER_PATH,
        runnerRequestHeaders,
      );
      const servedResponseManifestBytes = Buffer.from(
        `${JSON.stringify({
          schemaVersion: REAL_BUILD_SERVED_RESPONSE_SCHEMA,
          sourceRoot: normalizedServedResponseSourceRoot(sourceMirror.root),
          events: [
            {
              sequence: 0,
              outcome: "fulfilled",
              requestKey: runnerRequestKey,
              responseIndex: 0,
              cacheHit: false,
            },
          ],
          responses: [
            {
              index: 0,
              requestKey: runnerRequestKey,
              requestUrl: REAL_BUILD_SERVED_RESPONSE_RUNNER_PATH,
              requestHeaders: runnerRequestHeaders,
              sourcePath: null,
              status: REAL_BUILD_SERVED_RESPONSE_RUNNER_STATUS,
              headers: strictServedResponseHeaders(REAL_BUILD_SERVED_RESPONSE_RUNNER_HEADERS),
              body: {
                kind: "bundle",
                offset: 0,
                bytes: runnerBody.length,
                digest: runnerBodyDigest,
              },
            },
          ],
          bodyChunks: [{ file: runnerChunk, bytes: runnerBody.length, digest: runnerBodyDigest }],
        })}\n`,
      );
      writeFileSync(join(run.directory, runnerChunk), runnerBody);
      writeFileSync(
        join(run.directory, REAL_BUILD_SERVED_RESPONSE_MANIFEST),
        servedResponseManifestBytes,
      );
      const replayClosure = writeRealBuildReplayClosure({
        directory: run.directory,
        repoRoot: sourceMirror.root,
        roles: [
          ...Object.entries(rawRoleBytes).map(([role, bytes]) => ({ role, bytes })),
          {
            role: "browser-output",
            bytes: new TextEncoder().encode(JSON.stringify(retainedBrowserOutput)),
          },
          {
            role: "prepared-options",
            bytes: new TextEncoder().encode(JSON.stringify(options)),
          },
          {
            role: "run-contract",
            bytes: new TextEncoder().encode(JSON.stringify(runContract)),
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
          runContractDigest: runContract.contractDigest,
          servedResponseManifestDigest: servedResponseDigest(servedResponseManifestBytes),
        },
        browserOutputRetained: true,
      });
      const result = finalizeExecutedRealBuildResult({
        options,
        browserOutput: retainedBrowserOutput,
      });
      if (result.documentJson === null)
        throw new Error("Replay fixture finalizer lost its document.");
      writeFileSync(join(run.directory, "document.json"), result.documentJson);
      writeFileSync(
        join(run.directory, "score.json"),
        `${JSON.stringify(
          createRealBuildScore({
            runId: plan.runId,
            result,
            accounting: options.accounting,
            lastStep: options.lastStep,
          }),
          null,
          1,
        )}\n`,
      );
      writeRealBuildArtifactManifest({
        directory: run.directory,
        runId: plan.runId,
        runContract,
        result,
        artifactFiles: [
          REAL_BUILD_SERVED_RESPONSE_MANIFEST,
          runnerChunk,
          "document.json",
          "score.json",
        ],
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
      expect(verified.roleBytes.get("official-model")).toBe(
        verified.roleBytes.get("action-ledger"),
      );
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
      const forgedScore = JSON.parse(originalScore.toString("utf8")) as {
        steps: Record<string, unknown>[];
      };
      delete forgedScore.steps[0]!.fit;
      const forgedScoreBytes = Buffer.from(`${JSON.stringify(forgedScore, null, 1)}\n`);
      writeFileSync(scorePath, forgedScoreBytes);
      const forgedArtifactManifest = JSON.parse(originalArtifactManifest.toString("utf8")) as {
        artifacts: { file: string; bytes: number; digest: string }[];
      };
      const scoreEntry = forgedArtifactManifest.artifacts.find(
        ({ file }) => file === "score.json",
      )!;
      scoreEntry.bytes = forgedScoreBytes.length;
      scoreEntry.digest = sha256Digest(forgedScoreBytes);
      writeFileSync(artifactManifestPath, `${JSON.stringify(forgedArtifactManifest, null, 1)}\n`);
      expect(() => verifyRealBuildArtifactManifest(published, plan.runId)).toThrow(
        /does not exactly reproduce/u,
      );
      writeFileSync(scorePath, originalScore);
      writeFileSync(artifactManifestPath, originalArtifactManifest);

      const inspected = inspectRealBuildReplayClosure(published);
      expect(inspected).toMatchObject({
        authority: "local-diagnostic",
        authenticated: false,
        replayLevel: "downstream-only",
        contractDigest: runContract.contractDigest,
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
      const selfRehashed = JSON.parse(originalManifest.toString("utf8")) as Record<string, unknown>;
      selfRehashed.authenticated = true;
      delete selfRehashed.manifestDigest;
      selfRehashed.manifestDigest = sha256Digest(JSON.stringify(selfRehashed));
      writeFileSync(manifestPath, `${JSON.stringify(selfRehashed, null, 1)}\n`);
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
        delete forged.manifestDigest;
        forged.manifestDigest = sha256Digest(JSON.stringify(forged));
        writeFileSync(manifestPath, `${JSON.stringify(forged, null, 1)}\n`);
      };
      rewriteReservedJsonRole("browser-output", Buffer.from("{}"));
      expect(() => verifyRealBuildReplayClosure(published)).toThrow(
        /browser-output must be an executed or failed object/u,
      );
      rewriteReservedJsonRole(
        "browser-output",
        Buffer.from('{"schemaVersion":"lego.real-build-browser-output/1"}'),
      );
      expect(() => verifyRealBuildReplayClosure(published)).toThrow(
        /browser-output must be an executed or failed object/u,
      );
      rewriteReservedJsonRole(
        "browser-output",
        Buffer.from(
          JSON.stringify({
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
        ),
      );
      expect(() => verifyRealBuildReplayClosure(published)).toThrow(
        /complete prepared-panel boundary shape/u,
      );
      rewriteReservedJsonRole("environment", Buffer.from([0xc3, 0x28]));
      expect(() => verifyRealBuildReplayClosure(published)).toThrow(/not canonical UTF-8/u);
      writeFileSync(manifestPath, originalManifest);

      const browserRole = closure.roles.find(({ role }) => role === "browser-output")!;
      writeFileSync(join(published, browserRole.casPath), "tampered");
      expect(() => verifyRealBuildReplayClosure(published)).toThrow(
        /CAS size\/hash|required exactly \d+ bytes/u,
      );
      writeFileSync(
        join(published, browserRole.casPath),
        new TextEncoder().encode(JSON.stringify(browserOutput())),
      );

      writeFileSync(manifestPath, Buffer.from([0xff]));
      expect(() => verifyRealBuildReplayClosure(published)).toThrow(/not canonical UTF-8/u);

      const oversizedRoleManifest = JSON.parse(originalManifest.toString("utf8")) as {
        roles: { role: string; bytes: number }[];
        manifestDigest?: string;
      };
      oversizedRoleManifest.roles.find(({ role }) => role === "pdf")!.bytes = 96 * 1024 * 1024 + 1;
      delete oversizedRoleManifest.manifestDigest;
      oversizedRoleManifest.manifestDigest = sha256Digest(JSON.stringify(oversizedRoleManifest));
      writeFileSync(manifestPath, `${JSON.stringify(oversizedRoleManifest, null, 1)}\n`);
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
