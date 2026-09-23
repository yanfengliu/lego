import { accessSync, constants as fsConstants, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { expect, test } from "@playwright/test";
import {
  canonicalBrickDocument,
  canonicalDigest,
  documentStructuralHash,
} from "@lego-studio/brick-kernel";

// @ts-expect-error This opaque Node verifier intentionally has no caller-facing TS surface.
import { bytesFromVerifiedPrefix50ActionPreparation } from "../../../scripts/part-identification-prefix50-action-preparation.mjs";
// @ts-expect-error This opaque Node verifier intentionally has no caller-facing TS surface.
import { bytesFromVerifiedPrefix50OfficialWorldReconciliation } from "../../../scripts/part-identification-prefix50-official-world-reconciliation.mjs";
// @ts-expect-error This opaque Node verifier intentionally has no caller-facing TS surface.
import { verifyPrefix50OfficialWorldReconciliation } from "../../../scripts/part-identification-prefix50-official-world-reconciliation.mjs";
// @ts-expect-error This opaque current-evidence reproducer intentionally has no TS surface.
import { reproduceCurrentPrefix50OfficialWorldReconciliation } from "../../../scripts/part-identification-prefix50-official-world-reconciliation-current.mjs";
// @ts-expect-error This ignored-evidence verifier intentionally has no caller-facing TS surface.
import { verifyCurrentPrefix50StructuralEvents } from "../../../scripts/part-identification-prefix50-structural-events-current.mjs";
import { createRealBuildPrefix50VerifiedProjectionReader } from "../../../scripts/part-identification-prefix50-verified-projection.mjs";
import { createRealBuildCandidateDocumentSnapshot } from "./real-build-candidate-document-snapshot";
import {
  assertRealBuildBootstrapSourceLockHeld,
  readRequiredRealBuildBootstrapSourceManifest,
} from "./real-build-bootstrap-source";
import { type RealBuildPrefix50ExactCompilation } from "./real-build-prefix50-exact-compiler";
import {
  createRealBuildPrefix50IncompleteRunBoundary,
  type RealBuildPrefix50IncompleteRunBoundary,
} from "./real-build-prefix50-incomplete-run-boundary";
import { verifyRealBuildPrefix50Occurrence30SourceRepair } from "./real-build-prefix50-occurrence30-source-repair";
import { createRealBuildPrefix50ProductionBaseDocument } from "./real-build-prefix50-production-base";
import { readRealBuildPrefix50VerifiedProjection } from "./real-build-prefix50-projection";
import { REAL_BUILD_PREFIX50_STEP41_PANEL_FACE_FIXTURE } from "./real-build-prefix50-step41-panel-face-fixture";
import { verifyRealBuildPrefix50Step41SourceRepair } from "./real-build-prefix50-step41-source-repair";
import { REAL_BUILD_PREFIX50_STEP42_43_PANEL_FIXTURE } from "./real-build-prefix50-step42-43-panel-fixture";
import { verifyRealBuildPrefix50Step42_43SourceRepair } from "./real-build-prefix50-step42-43-source-repair";
import { REAL_BUILD_PREFIX50_STEP42_PANEL_FACE_FIXTURE } from "./real-build-prefix50-step42-panel-face-fixture";
import { verifyRealBuildPrefix50Step42SourceRepair } from "./real-build-prefix50-step42-source-repair";
import { captureSceneEvidence } from "./real-build-prefix50-ui-evidence";
import {
  assertPrefix50Step43To44VisualDelta,
  capturePrefix50Step44ModelOnlyEvidence,
  type Prefix50Step44ModelOnlyEvidence,
} from "./real-build-prefix50-step44-visual-evidence";
import {
  attachPrefix50Step43To44VisualReceipt,
  type Prefix50Step44CaptureBinding,
} from "./real-build-prefix50-step44-visual-receipt";
import {
  appObservation,
  expectPlaybackDidNotPersist,
  expectPlaybackPosition,
  independentPlaybackCommitments,
  savePrimaryProjectAndReload,
  seedPrimaryProject,
  type PlaybackCommitment,
} from "./real-build-prefix50-ui-replay-support";
import {
  REAL_BUILD_PREFIX50_UI_REPLAY_REVIEW_ROOT_ENV,
  compileRealBuildPrefix50UiReplayFromPersistedPromotion,
  requireRealBuildPrefix50UiReplayReviewRootFromEnvironment,
} from "./real-build-prefix50-ui-replay-compilation";
import {
  verifyTerminalGraphOracle,
  type TerminalGraphOracle,
} from "./real-build-prefix50-ui-terminal-oracle";

const OFFICIAL_MODEL_PATH = "output/official-model/vx1087034_21066_a.xml";
const BUILDER_GEOMETRY_PATH = "output/real-build/builder-shell-geometry.bin";
const REQUIRED = process.env.LEGO_REAL_BUILD_REQUIRED === "1";

let compilation: RealBuildPrefix50ExactCompilation;
let boundary: RealBuildPrefix50IncompleteRunBoundary;
let playbackCommitments: readonly PlaybackCommitment[];
let terminalGraph: TerminalGraphOracle;

test.describe.configure({ mode: "serial", timeout: 360_000 });
test.skip(
  !REQUIRED,
  `set LEGO_REAL_BUILD_REQUIRED=1 and ${REAL_BUILD_PREFIX50_UI_REPLAY_REVIEW_ROOT_ENV}=<persisted-review-root> to run the source-locked exact prefix-50 UI replay lane`,
);

function requireDirectEvidencePaths(): void {
  for (const path of [OFFICIAL_MODEL_PATH, BUILDER_GEOMETRY_PATH]) {
    try {
      accessSync(path, fsConstants.R_OK);
    } catch {
      throw new Error(
        `Required exact prefix-50 UI replay evidence is missing or unreadable at ${path}; the opted-in lane fails closed.`,
      );
    }
  }
}

test.beforeAll(async () => {
  test.setTimeout(600_000);
  readRequiredRealBuildBootstrapSourceManifest();
  assertRealBuildBootstrapSourceLockHeld();
  requireDirectEvidencePaths();
  const reproduced = await reproduceCurrentPrefix50OfficialWorldReconciliation();
  const verifiedReconciliation = await verifyPrefix50OfficialWorldReconciliation({
    ...reproduced.input,
    // Verify the fresh final reproduction against the reviewed pin rather than
    // trusting a leftover final output file. Its upstream current verifiers
    // deliberately require the ignored local evidence chain and fail closed
    // when that real-evidence chain is absent; this required lane never skips.
    artifactBytes: reproduced.bytes,
  });
  const structural = await verifyCurrentPrefix50StructuralEvents();
  const reader = createRealBuildPrefix50VerifiedProjectionReader({
    actionPreparation: {
      bytes: bytesFromVerifiedPrefix50ActionPreparation(reproduced.input.actionPreparation),
      verified: reproduced.input.actionPreparation,
    },
    officialWorldReconciliation: {
      bytes: bytesFromVerifiedPrefix50OfficialWorldReconciliation(verifiedReconciliation),
      verified: verifiedReconciliation,
    },
    structuralEvents: { bytes: structural.bytes, verified: structural.verified },
  });
  const emptyDocument = createRealBuildPrefix50ProductionBaseDocument();
  const projection = readRealBuildPrefix50VerifiedProjection(reader);
  const occurrence30SourceRepairProof = verifyRealBuildPrefix50Occurrence30SourceRepair({
    officialModelBytes: readFileSync(OFFICIAL_MODEL_PATH),
    builderGeometryBundleBytes: readFileSync(BUILDER_GEOMETRY_PATH),
  });
  const step41SourceRepairProof = verifyRealBuildPrefix50Step41SourceRepair({
    projectionReader: reader,
    reviewedPanelFaceFixture: REAL_BUILD_PREFIX50_STEP41_PANEL_FACE_FIXTURE,
    sourceRows: projection.occurrences.slice(265, 273),
  });
  const step42SourceRepairProof = verifyRealBuildPrefix50Step42SourceRepair({
    projectionReader: reader,
    step41SourceRepairProof,
    reviewedPanelFaceFixture: REAL_BUILD_PREFIX50_STEP42_PANEL_FACE_FIXTURE,
    sourceRows: projection.occurrences.slice(257, 274),
  });
  const step42_43SourceRepairProof = verifyRealBuildPrefix50Step42_43SourceRepair({
    projectionReader: reader,
    reviewedPanelFixture: REAL_BUILD_PREFIX50_STEP42_43_PANEL_FIXTURE,
    sourceRows: projection.occurrences.slice(257, 280),
    step41SourceRepairProof,
    step42SourceRepairProof,
  });
  const reviewRoot = requireRealBuildPrefix50UiReplayReviewRootFromEnvironment();
  compilation = await compileRealBuildPrefix50UiReplayFromPersistedPromotion({
    documentSnapshot: createRealBuildCandidateDocumentSnapshot({
      canonicalDocument: canonicalBrickDocument(emptyDocument),
      expectedDocumentHash: documentStructuralHash(emptyDocument),
    }),
    occurrence30SourceRepairProof,
    projectionReader: reader,
    qualificationOutputPath: `${reviewRoot}.page44-real-domain-calibration`,
    repositoryRoot: resolve("."),
    reviewRoot,
    step41SourceRepairProof,
    step42SourceRepairProof,
    step42_43SourceRepairProof,
  });
  boundary = createRealBuildPrefix50IncompleteRunBoundary(compilation);

  playbackCommitments = independentPlaybackCommitments(
    boundary.document,
    compilation.playbackTrace,
  );
  terminalGraph = verifyTerminalGraphOracle(
    boundary.document,
    boundary.exactCompilation.terminalDetachedState,
  );
});

test("replays the exact compiled first 50 printed steps through the real build controls", async ({
  page,
}, testInfo) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => consoleErrors.push(String(error)));

  expect(
    compilation.stateCommitments.map(
      ({ completedPrintedStep, partCount, documentHash, canonicalDocumentDigest }) => ({
        completedPrintedStep,
        partCount,
        documentHash,
        canonicalDocumentDigest,
      }),
    ),
  ).toEqual(
    playbackCommitments.map(
      ({ completedPrintedStep, partCount, documentHash, canonicalDocumentDigest }) => ({
        completedPrintedStep,
        partCount,
        documentHash,
        canonicalDocumentDigest,
      }),
    ),
  );
  expect(compilation.stateCommitments[44]).toMatchObject({
    completedPrintedStep: 44,
    partCount: 280,
  });
  expect(compilation.stateCommitments[45]).toMatchObject({
    completedPrintedStep: 45,
    partCount: 283,
  });
  expect(compilation.stateCommitments[50]).toMatchObject({
    completedPrintedStep: 50,
    partCount: 320,
  });
  expect(playbackCommitments[44]).toMatchObject({ addedPartCount: 0 });
  expect(playbackCommitments[45]).toMatchObject({ addedPartCount: 3 });
  expect(playbackCommitments[50]).toMatchObject({ addedPartCount: 9 });
  expect(playbackCommitments[50]).toMatchObject({ verdict: "trace-valid subassembly" });
  expect(playbackCommitments[43]?.partIds).toEqual(playbackCommitments[44]?.partIds);
  expect(playbackCommitments[43]?.partCount).toBe(280);
  expect(playbackCommitments[44]?.partCount).toBe(280);
  expect(playbackCommitments[43]?.documentHash).not.toBe(playbackCommitments[44]?.documentHash);
  const { traceCommitment, ...traceBody } = compilation.playbackTrace;
  expect(traceCommitment).toBe(canonicalDigest(traceBody));
  const step44Trace = compilation.playbackTrace.transitions[43]!;
  const selectedStep44Candidate = compilation.subBuildReturnEnumeration?.candidates.find(
    ({ candidateKey }) => candidateKey === compilation.selectedSubBuildReturn?.candidateKey,
  );
  expect(selectedStep44Candidate).toBeDefined();
  expect(step44Trace.operationGroups).toHaveLength(2);
  expect(step44Trace.operationGroups[0]).toEqual(selectedStep44Candidate!.operations);
  expect(step44Trace.operationGroups[1]?.at(-1)?.kind).toBe("addStep");
  expect(boundary).toMatchObject({
    authority: "none",
    completionAuthority: false,
    patchAuthority: false,
    userAcceptanceAuthority: false,
    exactBoundary: "printed-steps-1-through-50-only",
    step51Inspected: false,
    compiledPartCount: 320,
    compiledStepCount: 50,
    parentPartCount: 311,
    childPartCount: 9,
    childOccurrenceOrdinals: [312, 313, 314, 315, 316, 317, 318, 319, 320],
    combinedBlockingCodes: ["DISCONNECTED_ASSEMBLY"],
    crossComponentConnectionCount: 0,
  });
  const terminal = boundary.exactCompilation.terminalDetachedState;
  expect(terminalGraph.parentPartIds).toHaveLength(311);
  expect(terminalGraph.childPartIds).toEqual([...terminal.childPartIds].sort());
  expect(documentStructuralHash(terminalGraph.parentDocument)).toBe(boundary.parentDocumentHash);
  expect(documentStructuralHash(terminalGraph.childDocument)).toBe(boundary.childDocumentHash);
  expect(playbackCommitments[49]).toMatchObject({
    documentHash: boundary.parentDocumentHash,
    blockingCodes: [],
    buildable: true,
    connected: true,
    verdict: "trace-valid",
  });
  expect(playbackCommitments[50]).toMatchObject({
    documentHash: boundary.combinedDocumentHash,
    blockingCodes: ["DISCONNECTED_ASSEMBLY"],
    buildable: true,
    connected: false,
    verdict: "trace-valid subassembly",
  });

  // This required lane binds the persisted authority-free trace to the
  // runtime-branded exact compiler and its complete per-state commitments.
  const rawStoredProjectCommitment = await seedPrimaryProject(
    page,
    boundary.document,
    compilation.playbackTrace,
  );
  const assertPlaybackPosition = (position: number): Promise<void> =>
    expectPlaybackPosition(page, playbackCommitments, position);
  const assertPlaybackDidNotPersist = (position: number): Promise<void> =>
    expectPlaybackDidNotPersist({
      page,
      commitments: playbackCommitments,
      position,
      authoredDocument: boundary.document,
      playbackTrace: compilation.playbackTrace,
      expectedGeneration: 2,
      rawStoredProjectCommitment,
    });

  const fullSnapshot = await page.evaluate(() => window.get_model_snapshot!());
  expect(fullSnapshot).toMatchObject({
    partCount: 320,
    documentGloballyValid: false,
    structuralHash: compilation.stateCommitments[50]?.documentHash,
  });
  const fullObservation = await appObservation(page);
  expect(fullObservation.document.parts).toHaveLength(320);
  expect(fullObservation.document.steps).toHaveLength(50);
  expect(fullObservation.document.steps.map(({ index }) => index)).toEqual(
    Array.from({ length: 50 }, (_, index) => index),
  );
  expect(fullObservation.document.steps.map(({ name }) => name)).toEqual(
    Array.from({ length: 50 }, (_, index) => `Printed step ${index + 1}`),
  );
  expect(fullObservation.document.steps.some(({ name }) => name === "Printed step 51")).toBe(false);
  expect(fullObservation.documentHash).toBe(compilation.stateCommitments[50]?.documentHash);
  expect(fullObservation.validation).toMatchObject({
    documentGloballyValid: false,
    targetDocumentHash: compilation.stateCommitments[50]?.documentHash,
  });
  expect(
    fullObservation.validation.issues
      .filter(({ severity }) => severity === "blocking")
      .map(({ code }) => code),
  ).toEqual(["DISCONNECTED_ASSEMBLY"]);
  await expect(page.getByText("draft-invalid", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: /Build$/u }).click();
  const scrubber = page.locator(".playback-scrubber input");
  await expect(scrubber).toHaveAttribute("min", "0");
  await expect(scrubber).toHaveAttribute("max", "50");
  await assertPlaybackPosition(0);
  await assertPlaybackDidNotPersist(0);

  await page.getByRole("button", { name: "Next step" }).click();
  await assertPlaybackPosition(1);

  await page.getByRole("button", { name: "Play build" }).click();
  await expect.poll(async () => (await appObservation(page)).playback?.position).toBe(2);
  await page.getByRole("button", { name: "Pause build" }).click();
  await assertPlaybackPosition(2);
  await assertPlaybackDidNotPersist(2);

  let step43RendererCommitment: string | null = null;
  let step43VisualEvidence: Prefix50Step44ModelOnlyEvidence | null = null;
  let step44VisualEvidence: Prefix50Step44ModelOnlyEvidence | null = null;
  let step43CaptureBinding: Prefix50Step44CaptureBinding | null = null;
  let step44CaptureBinding: Prefix50Step44CaptureBinding | null = null;
  for (let position = 3; position <= 44; position += 1) {
    await scrubber.fill(String(position));
    await assertPlaybackPosition(position);
    if (position === 43) {
      const observation = await appObservation(page);
      step43RendererCommitment = observation.renderer?.viewPacket?.documentHash ?? null;
      expect(observation.playback).toMatchObject({
        position: 43,
        exact: true,
        traceCommitment,
        previewDocumentHash: playbackCommitments[43]?.documentHash,
      });
      if (observation.playback === null || step43RendererCommitment === null) {
        throw new Error("Step 43 capture lacks an exact playback/renderer observation.");
      }
      step43CaptureBinding = {
        position: 43,
        previewDocumentHash: observation.playback.previewDocumentHash,
        rendererDocumentHash: step43RendererCommitment,
      };
      step43VisualEvidence = await capturePrefix50Step44ModelOnlyEvidence({
        page,
        testInfo,
        completedPrintedStep: 43,
      });
    } else if (position === 44) {
      const observation = await appObservation(page);
      expect(observation.playback).toMatchObject({
        position: 44,
        exact: true,
        traceCommitment,
        previewDocumentHash: playbackCommitments[44]?.documentHash,
      });
      const rendererDocumentHash = observation.renderer?.viewPacket?.documentHash ?? null;
      if (observation.playback === null || rendererDocumentHash === null) {
        throw new Error("Step 44 capture lacks an exact playback/renderer observation.");
      }
      step44CaptureBinding = {
        position: 44,
        previewDocumentHash: observation.playback.previewDocumentHash,
        rendererDocumentHash,
      };
      step44VisualEvidence = await capturePrefix50Step44ModelOnlyEvidence({
        page,
        testInfo,
        completedPrintedStep: 44,
      });
    }
  }
  const step44RendererCommitment =
    (await appObservation(page)).renderer?.viewPacket?.documentHash ?? null;
  expect(step43RendererCommitment).toBe(playbackCommitments[43]?.documentHash);
  expect(step44RendererCommitment).toBe(playbackCommitments[44]?.documentHash);
  expect(step43RendererCommitment).not.toBe(step44RendererCommitment);
  if (
    step43VisualEvidence === null ||
    step44VisualEvidence === null ||
    step43CaptureBinding === null ||
    step44CaptureBinding === null
  ) {
    throw new Error("Step 43/44 model-only evidence capture did not run at both exact positions.");
  }
  const visualDelta = assertPrefix50Step43To44VisualDelta(
    step43VisualEvidence,
    step44VisualEvidence,
  );
  await attachPrefix50Step43To44VisualReceipt({
    testInfo,
    traceCommitment,
    step43: {
      stateCommitment: compilation.stateCommitments[43]!,
      playbackCommitment: playbackCommitments[43]!,
      captureBinding: step43CaptureBinding,
      evidence: step43VisualEvidence,
    },
    step44: {
      stateCommitment: compilation.stateCommitments[44]!,
      playbackCommitment: playbackCommitments[44]!,
      captureBinding: step44CaptureBinding,
      evidence: step44VisualEvidence,
    },
    transition: step44Trace,
    visualDelta,
  });
  await expect(page.locator(".playback-readout small")).toHaveText("44 / 50 · 280 parts");

  await page.getByRole("button", { name: "Next step" }).click();
  await assertPlaybackPosition(45);
  await expect(page.locator(".playback-readout small")).toHaveText("45 / 50 · 283 parts · +3");

  for (let position = 46; position <= 49; position += 1) {
    await scrubber.fill(String(position));
    await assertPlaybackPosition(position);
  }
  await expect(page.getByText("hard-valid", { exact: true })).toBeVisible();
  await assertPlaybackDidNotPersist(49);
  await testInfo.attach("prefix50-playback-step49-full-page.png", {
    body: await page.screenshot({ fullPage: true, animations: "disabled" }),
    contentType: "image/png",
  });
  await scrubber.fill("50");
  await assertPlaybackPosition(50);
  await expect(page.locator(".playback-readout small")).toHaveText("50 / 50 · 320 parts · +9");
  await expect(page.getByRole("button", { name: "Next step" })).toBeDisabled();
  await expect(page.getByText("Printed step 51", { exact: true })).toHaveCount(0);
  await expect(page.getByText("draft-invalid", { exact: true })).toBeVisible();
  await expect(page.getByText("disconnected assembly", { exact: true })).toBeVisible();
  await assertPlaybackDidNotPersist(50);
  await testInfo.attach("prefix50-playback-step50-full-page.png", {
    body: await page.screenshot({ fullPage: true, animations: "disabled" }),
    contentType: "image/png",
  });

  await page.getByRole("button", { name: "Exit", exact: true }).click();
  await expect.poll(async () => (await appObservation(page)).playback).toBeNull();
  let generation = await savePrimaryProjectAndReload(
    page,
    terminalGraph.parentDocument,
    2,
    "isolated Step49 parent",
  );
  await captureSceneEvidence({
    page,
    testInfo,
    label: "parent",
    document: terminalGraph.parentDocument,
    generation,
  });
  generation = await savePrimaryProjectAndReload(
    page,
    terminalGraph.childDocument,
    generation,
    "isolated Step50 child",
  );
  await captureSceneEvidence({
    page,
    testInfo,
    label: "child",
    document: terminalGraph.childDocument,
    generation,
  });
  generation = await savePrimaryProjectAndReload(
    page,
    boundary.document,
    generation,
    "restored Step50 compound",
    compilation.playbackTrace,
  );
  await captureSceneEvidence({
    page,
    testInfo,
    label: "combined",
    document: boundary.document,
    generation,
  });
  expect(generation).toBe(5);
  expect(consoleErrors).toEqual([]);
});
