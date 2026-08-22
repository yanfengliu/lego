import { sha256Hex, type Sha256Digest } from "@lego-studio/brick-kernel";

import { readRealBuildBrowserCameraEvidence } from "../e2e/real-build-browser-output-v4-camera-evidence-reader";
import { writeRealBuildBrowserCameraEvidence } from "../e2e/real-build-browser-output-v4-camera-evidence-writer";
import { REAL_BUILD_BROWSER_OUTPUT_V4_ABSENT_COMPLETION_AUTHORITY } from "../e2e/real-build-browser-output-v4-envelope";
import { advanceRealBuildBrowserOutputV4PlacementFrontier } from "../e2e/real-build-browser-output-v4-reader-frontier";
import { deriveRealBuildBrowserOutputV4TerminalPlacementFailure } from "../e2e/real-build-browser-output-v4-reader-failure";
import {
  createRealBuildBrowserBranchRoleWriterResult,
  readRealBuildBrowserBranchRoleWriterBytes,
} from "../e2e/real-build-browser-output-v4-role-writer";
import { inspectRealBuildBrowserBranchDetailedEvidence } from "../e2e/real-build-browser-output-v4-semantic";
import {
  createRealBuildBrowserOutputV4TransitionEvidenceManifest,
  serializeRealBuildBrowserOutputV4TransitionEvidenceManifest,
} from "../e2e/real-build-browser-output-v4-transition-frontier";
import { unexecutedStepReport } from "../e2e/real-build-contract";
import type { RealBuildStepReport } from "../e2e/real-build-safety";
import { realBuildBrowserOutputV4SelectedTupleFixture } from "./real-build-browser-output-v4-reader-selected.fixture";

function digest(bytes: Uint8Array): Sha256Digest {
  return `sha256:${sha256Hex(bytes)}`;
}

function role(roleName: string, bytes: Uint8Array) {
  return { role: roleName, bytes: bytes.byteLength, digest: digest(bytes) };
}

export function realBuildBrowserOutputV4ClosureAbsentTupleFixture() {
  const selected = realBuildBrowserOutputV4SelectedTupleFixture();
  const branchResult = createRealBuildBrowserBranchRoleWriterResult([
    { batchResult: selected.compiled.batchResult, observation: null },
  ]);
  const branch = readRealBuildBrowserBranchRoleWriterBytes(branchResult);
  const detailed = inspectRealBuildBrowserBranchDetailedEvidence(
    branch.branchEvidence,
    branch.compiledBranchRole,
    branch.observationRole,
    selected.source.preparedRunInputBytes,
  );
  const branchStep = detailed.steps[0]!;
  const terminal = advanceRealBuildBrowserOutputV4PlacementFrontier({
    frontier: selected.compiled.initial,
    step: branchStep,
  });
  if (terminal.status !== "terminal" || terminal.reason !== "closure-absent") {
    throw new TypeError("Terminal reader fixture did not retain an absent observation closure.");
  }
  const projection = deriveRealBuildBrowserOutputV4TerminalPlacementFailure(branchStep, terminal);
  const report = {
    ...unexecutedStepReport(selected.source.options.panels[0]!, projection.failure, {
      documentParts: 0,
      elapsedMs: 0,
      reason: projection.failure.message,
    }),
    outcome: {
      status: "failed",
      mechanism: "deferred",
      attemptedMechanism: projection.attemptedMechanism,
      failure: projection.failure,
    },
  } as RealBuildStepReport;
  const cameraBytes = writeRealBuildBrowserCameraEvidence([]);
  const camera = readRealBuildBrowserCameraEvidence(cameraBytes);
  const transitionManifestBytes = serializeRealBuildBrowserOutputV4TransitionEvidenceManifest(
    createRealBuildBrowserOutputV4TransitionEvidenceManifest([]),
  );
  const output = {
    schemaVersion: "lego.real-build-browser-output/4",
    status: "failed",
    evidence: {
      preparedRunInputDigest: selected.source.preparedRun.preparedRunInputDigest,
      branchEvidence: role("branch-evidence-index", branch.branchEvidence),
      compiledBranchRole: branchResult.evidence.compiledBranchRole,
      branchObservationRole: branchResult.evidence.observationRole,
      sourceManifest: role("source-evidence-manifest", selected.source.manifestBytes),
      cameraManifest: role("camera-evidence-manifest", cameraBytes.manifestBytes),
      cameraRenderRole: camera.manifest.renderRole,
      cameraMaskRole: camera.manifest.maskRole,
      transitionManifest: role("transition-evidence-manifest", transitionManifestBytes),
    },
    reports: [report],
    documentJson: selected.compiled.initial.documentSnapshot.canonicalBytes,
    identityBindings: [],
    fetchedPdfDigest: selected.source.options.inputDigests.pdf,
    failure: projection.failure,
    totalElapsedMs: 0,
    completionAuthority: REAL_BUILD_BROWSER_OUTPUT_V4_ABSENT_COMPLETION_AUTHORITY,
  };
  return {
    projection,
    tuple: {
      browserOutput: output,
      preparedRunInputBytes: selected.source.preparedRunInputBytes,
      branchEvidenceBytes: branch.branchEvidence,
      compiledBranchRoleBytes: branch.compiledBranchRole,
      branchObservationRoleBytes: branch.observationRole,
      sourceManifestBytes: selected.source.manifestBytes,
      sourceInspection: selected.source.inspection,
      cameraManifestBytes: cameraBytes.manifestBytes,
      cameraRenderRoleBytes: cameraBytes.renderRoleBytes,
      cameraMaskRoleBytes: cameraBytes.maskRoleBytes,
      transitionManifestBytes,
    },
  };
}
