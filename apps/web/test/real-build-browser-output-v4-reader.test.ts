import {
  applyBuildOperations,
  canonicalBrickDocument,
  sha256Hex,
  validateBrickDocument,
  type Sha256Digest,
} from "@lego-studio/brick-kernel";
import { beforeAll, describe, expect, it } from "vitest";

import {
  readRealBuildBrowserBranchRoleWriterBytes,
  createRealBuildBrowserBranchRoleWriterResult,
} from "../e2e/real-build-browser-output-v4-role-writer";
import { writeRealBuildBrowserCameraEvidence } from "../e2e/real-build-browser-output-v4-camera-evidence-writer";
import { readRealBuildBrowserCameraEvidence } from "../e2e/real-build-browser-output-v4-camera-evidence-reader";
import { REAL_BUILD_BROWSER_OUTPUT_V4_ABSENT_COMPLETION_AUTHORITY } from "../e2e/real-build-browser-output-v4-envelope";
import {
  inspectRealBuildBrowserOutputV4,
  requireRealBuildBrowserOutputV4Inspection,
} from "../e2e/real-build-browser-output-v4-reader";
import { deriveRealBuildBrowserOutputV4MissingRoleFailure } from "../e2e/real-build-browser-output-v4-reader-failure";
import { createInitialRealBuildBrowserOutputV4Frontier } from "../e2e/real-build-browser-output-v4-reader-frontier";
import { createRealBuildBrowserOutputV4SourceEvidencePanel } from "../e2e/real-build-browser-output-v4-source-evidence-panel-writer";
import {
  beginRealBuildBrowserOutputV4SourceEvidenceInspection,
  finishRealBuildBrowserOutputV4SourceEvidenceInspection,
  inspectRealBuildBrowserOutputV4SourceEvidencePanel,
} from "../e2e/real-build-browser-output-v4-source-evidence-reader";
import { createRealBuildBrowserOutputV4SourceEvidenceManifest } from "../e2e/real-build-browser-output-v4-source-evidence-writer";
import {
  createRealBuildBrowserOutputV4TransitionEvidenceManifest,
  createRealBuildBrowserOutputV4TransitionEvidenceRow,
  serializeRealBuildBrowserOutputV4TransitionEvidenceManifest,
} from "../e2e/real-build-browser-output-v4-transition-frontier";
import { unexecutedStepReport } from "../e2e/real-build-contract";
import { inspectRealBuildPreparedPanelFromRunInput } from "../e2e/real-build-prepared-step-authority";
import type { RealBuildStepReport, StepFailure } from "../e2e/real-build-safety";
import {
  SOURCE_EVIDENCE_TEST_PREPARED_OPTIONS,
  SOURCE_EVIDENCE_TEST_PREPARED_RUN,
  sourceEvidenceTestPanelInput,
} from "./real-build-browser-output-v4-source-evidence-fixture";

const PREPARED_BYTES = new TextEncoder().encode(
  JSON.stringify(SOURCE_EVIDENCE_TEST_PREPARED_OPTIONS),
);

function digest(bytes: Uint8Array): Sha256Digest {
  return `sha256:${sha256Hex(bytes)}`;
}

let sourceManifestBytes: Uint8Array;
let sourceInspection: ReturnType<typeof finishRealBuildBrowserOutputV4SourceEvidenceInspection>;

beforeAll(() => {
  const artifacts = Array.from({ length: 359 }, (_, index) =>
    createRealBuildBrowserOutputV4SourceEvidencePanel(sourceEvidenceTestPanelInput(index + 1)),
  );
  sourceManifestBytes = createRealBuildBrowserOutputV4SourceEvidenceManifest({
    preparedRunInputInspection: SOURCE_EVIDENCE_TEST_PREPARED_RUN,
    panels: artifacts.map(({ descriptor }) => descriptor),
  }).readManifestBytes();
  const session = beginRealBuildBrowserOutputV4SourceEvidenceInspection(
    sourceManifestBytes,
    SOURCE_EVIDENCE_TEST_PREPARED_RUN,
  );
  for (let index = 0; index < artifacts.length; index += 1) {
    const artifact = artifacts[index]!;
    inspectRealBuildBrowserOutputV4SourceEvidencePanel(
      session,
      index + 1,
      artifact.highRgbaBytes,
      artifact.workRgbaBytes,
      artifact.packedMaskBytes,
    );
  }
  sourceInspection = finishRealBuildBrowserOutputV4SourceEvidenceInspection(session);
});

function role(role: string, bytes: Uint8Array) {
  return { role, bytes: bytes.byteLength, digest: digest(bytes) };
}

function failure(stepNumber: number): StepFailure {
  return {
    code: "camera-handedness-unresolved",
    stage: "camera-registration",
    stepNumber,
    message: `No exact branch or camera row was admitted for printed step ${stepNumber}.`,
  };
}

function tuple(input: {
  readonly reports: readonly RealBuildStepReport[];
  readonly documentJson: string;
  readonly failure: StepFailure;
  readonly transitionManifestBytes: Uint8Array;
}) {
  const branchResult = createRealBuildBrowserBranchRoleWriterResult([]);
  const branch = readRealBuildBrowserBranchRoleWriterBytes(branchResult);
  const camera = writeRealBuildBrowserCameraEvidence([]);
  const cameraInspection = readRealBuildBrowserCameraEvidence(camera);
  const output = {
    schemaVersion: "lego.real-build-browser-output/4",
    status: "failed",
    evidence: {
      preparedRunInputDigest: SOURCE_EVIDENCE_TEST_PREPARED_RUN.preparedRunInputDigest,
      branchEvidence: role("branch-evidence-index", branch.branchEvidence),
      compiledBranchRole: branchResult.evidence.compiledBranchRole,
      branchObservationRole: branchResult.evidence.observationRole,
      sourceManifest: role("source-evidence-manifest", sourceManifestBytes),
      cameraManifest: role("camera-evidence-manifest", camera.manifestBytes),
      cameraRenderRole: cameraInspection.manifest.renderRole,
      cameraMaskRole: cameraInspection.manifest.maskRole,
      transitionManifest: role("transition-evidence-manifest", input.transitionManifestBytes),
    },
    reports: input.reports,
    documentJson: input.documentJson,
    identityBindings: [],
    fetchedPdfDigest: SOURCE_EVIDENCE_TEST_PREPARED_OPTIONS.inputDigests.pdf,
    failure: input.failure,
    totalElapsedMs: 0,
    completionAuthority: REAL_BUILD_BROWSER_OUTPUT_V4_ABSENT_COMPLETION_AUTHORITY,
  };
  return {
    browserOutput: output,
    preparedRunInputBytes: PREPARED_BYTES,
    branchEvidenceBytes: branch.branchEvidence,
    compiledBranchRoleBytes: branch.compiledBranchRole,
    branchObservationRoleBytes: branch.observationRole,
    sourceManifestBytes,
    sourceInspection,
    cameraManifestBytes: camera.manifestBytes,
    cameraRenderRoleBytes: camera.renderRoleBytes,
    cameraMaskRoleBytes: camera.maskRoleBytes,
    transitionManifestBytes: input.transitionManifestBytes,
  };
}

function emptyTransitionManifest(): Uint8Array {
  return serializeRealBuildBrowserOutputV4TransitionEvidenceManifest(
    createRealBuildBrowserOutputV4TransitionEvidenceManifest([]),
  );
}

describe("browser-output /4 complete tuple reader", () => {
  it("retains an exact empty failed prefix with every authority still absent", () => {
    const terminalFailure = deriveRealBuildBrowserOutputV4MissingRoleFailure(
      inspectRealBuildPreparedPanelFromRunInput(SOURCE_EVIDENCE_TEST_PREPARED_RUN, 1),
    );
    const report = unexecutedStepReport(
      SOURCE_EVIDENCE_TEST_PREPARED_OPTIONS.panels[0]!,
      terminalFailure,
      { documentParts: 0, elapsedMs: 0, reason: terminalFailure.message },
    );
    const frontier = createInitialRealBuildBrowserOutputV4Frontier(
      SOURCE_EVIDENCE_TEST_PREPARED_OPTIONS.maxParts,
    );
    const inspected = inspectRealBuildBrowserOutputV4(
      tuple({
        reports: [report],
        documentJson: frontier.documentSnapshot.canonicalBytes,
        failure: terminalFailure,
        transitionManifestBytes: emptyTransitionManifest(),
      }),
    );

    expect(inspected).toMatchObject({
      status: "failed",
      retainedReports: 1,
      completedSteps: 0,
      throughStepNumber: 0,
      branchSteps: 0,
      transitionSteps: 0,
      derivationReproducible: true,
      sourceExecutionProvenanceAuthority: "absent",
      physicalFrameAuthority: "absent",
      placementAuthority: "absent",
    });
    expect(inspected.outputIdentityDigest).toMatch(/^sha256:[0-9a-f]{64}$/u);
    expect(inspected.completionAuthority.authorized).toBe(false);
    expect(requireRealBuildBrowserOutputV4Inspection(inspected)).toBe(inspected);
    expect(() => requireRealBuildBrowserOutputV4Inspection({ ...inspected })).toThrow(
      /exact branded result/u,
    );
  });

  it("refuses a caller-authored failed empty prefix without a retained report witness", () => {
    const frontier = createInitialRealBuildBrowserOutputV4Frontier(
      SOURCE_EVIDENCE_TEST_PREPARED_OPTIONS.maxParts,
    );
    let roleReads = 0;
    const unreadMalformedRole = new Proxy(new Uint8Array([1]), {
      get() {
        roleReads += 1;
        throw new Error("empty-report refusal must precede external role reading");
      },
    });
    expect(() =>
      inspectRealBuildBrowserOutputV4({
        ...tuple({
          reports: [],
          documentJson: frontier.documentSnapshot.canonicalBytes,
          failure: failure(1),
          transitionManifestBytes: emptyTransitionManifest(),
        }),
        branchEvidenceBytes: unreadMalformedRole,
      }),
    ).toThrow(/at least one retained report.*separate typed evidence role/iu);
    expect(roleReads).toBe(0);
  });

  it("replays one exact zero-piece transition before freezing at the next failed panel", () => {
    const panel = SOURCE_EVIDENCE_TEST_PREPARED_OPTIONS.panels[0]!;
    if (panel.action.kind !== "transition") throw new TypeError("Fixture step 1 must transition.");
    const prepared = inspectRealBuildPreparedPanelFromRunInput(
      SOURCE_EVIDENCE_TEST_PREPARED_RUN,
      1,
    );
    const frontier = createInitialRealBuildBrowserOutputV4Frontier(
      SOURCE_EVIDENCE_TEST_PREPARED_OPTIONS.maxParts,
    );
    const target = applyBuildOperations(frontier.documentSnapshot.document, [
      {
        kind: "removeStep",
        operationId: "remove-empty-root-bootstrap-step",
        step: frontier.documentSnapshot.document.steps[0]!,
      },
      {
        kind: "addStep",
        operationId: "real-build-transition-1",
        step: {
          id: "real-build-step-1",
          index: 0,
          name: `Step 1 [transition:${panel.action.transition};panel=${panel.action.panelEvidenceDigest}]`,
          partIds: [],
        },
      },
    ]);
    const validation = validateBrickDocument(target);
    const completeReport = {
      ...unexecutedStepReport(panel, failure(1), {
        documentParts: 0,
        elapsedMs: 0,
        reason: "replaced by exact transition",
      }),
      action: panel.action,
      actionEvidenceDigest: panel.action.evidenceDigest,
      canonicalStepId: "real-build-step-1",
      outcome: { status: "complete", mechanism: "instruction-transition", failure: null },
      validation: {
        attempted: true,
        targetDocumentHash: validation.targetDocumentHash,
        truthSnapshotHash: validation.truthSnapshotHash,
        validatorSetHash: validation.validatorSetHash,
        documentGloballyValid: true,
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
    } as RealBuildStepReport;
    const targetCanonical = canonicalBrickDocument(target);
    const targetBytes = new TextEncoder().encode(targetCanonical);
    const row = createRealBuildBrowserOutputV4TransitionEvidenceRow({
      preparedPanel: prepared,
      report: completeReport,
      source: {
        documentHash: frontier.documentSnapshot.documentHash,
        canonicalBytesHash: frontier.documentSnapshot.canonicalBytesHash,
        canonicalByteLength: frontier.documentSnapshot.canonicalByteLength,
      },
      target: {
        documentHash: validation.targetDocumentHash,
        canonicalBytesHash: digest(targetBytes),
        canonicalByteLength: targetBytes.byteLength,
      },
    });
    const transitionManifestBytes = serializeRealBuildBrowserOutputV4TransitionEvidenceManifest(
      createRealBuildBrowserOutputV4TransitionEvidenceManifest([row]),
    );
    const terminalFailure = deriveRealBuildBrowserOutputV4MissingRoleFailure(
      inspectRealBuildPreparedPanelFromRunInput(SOURCE_EVIDENCE_TEST_PREPARED_RUN, 2),
    );
    const failedReport = unexecutedStepReport(
      SOURCE_EVIDENCE_TEST_PREPARED_OPTIONS.panels[1]!,
      terminalFailure,
      { documentParts: 0, elapsedMs: 0, reason: terminalFailure.message },
    );
    const inspected = inspectRealBuildBrowserOutputV4(
      tuple({
        reports: [completeReport, failedReport],
        documentJson: targetCanonical,
        failure: terminalFailure,
        transitionManifestBytes,
      }),
    );

    expect(inspected).toMatchObject({
      completedSteps: 1,
      throughStepNumber: 1,
      branchSteps: 0,
      transitionSteps: 1,
    });
    expect(inspected.terminalDocument.documentHash).toBe(validation.targetDocumentHash);

    expect(() =>
      inspectRealBuildBrowserOutputV4(
        tuple({
          reports: [
            {
              ...completeReport,
              fit: {
                azimuthDegrees: 45,
                elevationDegrees: 30,
                pixelsPerUnit: 12,
                residualPx: 0,
                coherence: 1,
                failure: null,
              },
            },
            failedReport,
          ],
          documentJson: targetCanonical,
          failure: terminalFailure,
          transitionManifestBytes,
        }),
      ),
    ).toThrow(/neutral non-placement projection/iu);
  });

  it("rejects terminal document drift after all roles replay", () => {
    const terminalFailure = deriveRealBuildBrowserOutputV4MissingRoleFailure(
      inspectRealBuildPreparedPanelFromRunInput(SOURCE_EVIDENCE_TEST_PREPARED_RUN, 1),
    );
    const report = unexecutedStepReport(
      SOURCE_EVIDENCE_TEST_PREPARED_OPTIONS.panels[0]!,
      terminalFailure,
      { documentParts: 0, elapsedMs: 0, reason: terminalFailure.message },
    );
    expect(() =>
      inspectRealBuildBrowserOutputV4(
        tuple({
          reports: [report],
          documentJson: "{}",
          failure: terminalFailure,
          transitionManifestBytes: emptyTransitionManifest(),
        }),
      ),
    ).toThrow(/terminal documentJson does not byte-equal/u);
  });
});
