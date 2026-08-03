import { randomUUID } from "node:crypto";
import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { createEmptyBrickDocument, validateBrickDocument } from "@lego-studio/brick-kernel";

import {
  beginAtomicRun,
  createRealBuildRunContract,
  enumerateRealBuildCodeRoots,
  planAtomicRunDirectory,
  sha256Digest,
  snapshotRealBuildCodeRoots,
} from "../e2e/real-build-artifacts";
import type { RealBuildBrowserOutput } from "../e2e/real-build-browser-output";
import {
  replayRealBuildFinalization,
  replayRealBuildFinalizationDiagnostic,
  inspectRealBuildReplayClosure,
  resolveRealBuildPath,
  materializeRealBuildSourceMirror,
  verifyRealBuildReplayClosure,
  writeRealBuildReplayClosure,
} from "../e2e/real-build-replay";
import { REAL_BUILD_SOURCE_ROOTS } from "../e2e/real-build-source-roots";
import {
  REAL_BUILD_INPUT_ROLE_BY_DIGEST,
  realBuildRunBudgets,
  realBuildRunThresholds,
} from "../e2e/real-build-run-contract";
import { stepPrerequisiteFacts, type RealBuildStepReport } from "../e2e/real-build-safety";
import {
  REAL_BUILD_TEST_DIGEST,
  completeRealBuildTestOptions,
  realBuildTransitionPanel,
} from "./real-build-test-options";

const DIGEST = REAL_BUILD_TEST_DIGEST;
const panel = realBuildTransitionPanel(1);
const rawRoleBytes = Object.fromEntries(
  Object.values(REAL_BUILD_INPUT_ROLE_BY_DIGEST).map((role) => [
    role,
    new TextEncoder().encode(`retained-${role}`),
  ]),
) as Readonly<Record<string, Uint8Array>>;
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
    arrows: { kept: 0, redPx: 0, rejected: 0 },
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

describe("real-build replay closure", () => {
  it("atomically publishes, inspects retained data without execution, and detects CAS tampering", async () => {
    const outputRoot = `output/real-build-replay-test-${randomUUID()}`;
    const absoluteOutputRoot = join(process.cwd(), outputRoot);
    try {
      const sourceFiles = enumerateRealBuildCodeRoots(REAL_BUILD_SOURCE_ROOTS);
      const codeSnapshots = snapshotRealBuildCodeRoots(REAL_BUILD_SOURCE_ROOTS);
      const runContract = createRealBuildRunContract({
        inputDigests,
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
      const run = beginAtomicRun(plan);
      const sourceMirror = materializeRealBuildSourceMirror({
        directory: run.directory,
        repoRoot: process.cwd(),
        sourceFiles,
      });
      writeRealBuildReplayClosure({
        directory: run.directory,
        repoRoot: sourceMirror,
        roles: [
          ...Object.entries(rawRoleBytes).map(([role, bytes]) => ({ role, bytes })),
          {
            role: "browser-output",
            bytes: new TextEncoder().encode(JSON.stringify(browserOutput())),
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
        sourceFiles,
        environment: {
          schemaVersion: "lego.real-build-environment/1",
          node: process.version,
          platform: process.platform,
          arch: process.arch,
          replayProtocol: 1,
        },
        browserOutputRetained: true,
      });
      rmSync(sourceMirror, { recursive: true });
      const published = await run.publish();
      const closure = verifyRealBuildReplayClosure(published);
      expect(closure).toMatchObject({ authority: "local-diagnostic", authenticated: false });
      expect(JSON.parse(readFileSync(plan.pointerPath, "utf8"))).toEqual({
        schemaVersion: "lego.real-build-run-pointer/1",
        runId: plan.runId,
        replayClosureDigest: closure.manifestDigest,
      });

      const inspected = inspectRealBuildReplayClosure(published);
      expect(inspected).toMatchObject({
        authority: "local-diagnostic",
        authenticated: false,
        replayLevel: "downstream-only",
        contractDigest: runContract.contractDigest,
      });
      expect(inspected.roleTrace.map(({ role }) => role)).toContain("builder-geometry");
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

      const browserRole = closure.roles.find(({ role }) => role === "browser-output")!;
      writeFileSync(join(published, browserRole.casPath), "tampered");
      expect(() => verifyRealBuildReplayClosure(published)).toThrow(/CAS size\/hash/u);
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
