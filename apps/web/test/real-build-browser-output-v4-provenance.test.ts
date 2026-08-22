import { createEmptyBrickDocument, sha256Hex, type Sha256Digest } from "@lego-studio/brick-kernel";
import { describe, expect, it } from "vitest";

import { downsampleRaster } from "../src/assembly/panel-art";
import { readRealBuildBrowserCameraEvidence } from "../e2e/real-build-browser-output-v4-camera-evidence-reader";
import { writeRealBuildBrowserCameraEvidence } from "../e2e/real-build-browser-output-v4-camera-evidence-writer";
import {
  inspectRealBuildBrowserOutputV4Envelope,
  REAL_BUILD_BROWSER_OUTPUT_V4_ABSENT_COMPLETION_AUTHORITY,
  verifyRealBuildBrowserOutputV4EvidenceRoleBytes,
} from "../e2e/real-build-browser-output-v4-envelope";
import {
  inspectRealBuildBrowserOutputV4Provenance,
  requireRealBuildBrowserOutputV4ProvenanceInspection,
} from "../e2e/real-build-browser-output-v4-provenance";
import {
  createRealBuildBrowserBranchRoleWriterResult,
  readRealBuildBrowserBranchRoleWriterBytes,
} from "../e2e/real-build-browser-output-v4-role-writer";
import { inspectRealBuildBrowserBranchDetailedEvidence } from "../e2e/real-build-browser-output-v4-semantic";
import { createRealBuildBrowserOutputV4SourceEvidencePanel } from "../e2e/real-build-browser-output-v4-source-evidence-panel-writer";
import {
  beginRealBuildBrowserOutputV4SourceEvidenceInspection,
  finishRealBuildBrowserOutputV4SourceEvidenceInspection,
  inspectRealBuildBrowserOutputV4SourceEvidencePanel,
} from "../e2e/real-build-browser-output-v4-source-evidence-reader";
import { createRealBuildBrowserOutputV4SourceEvidenceManifest } from "../e2e/real-build-browser-output-v4-source-evidence-writer";
import { unexecutedStepReport } from "../e2e/real-build-contract";
import { stepPanelEvidenceDigest } from "../e2e/real-build-panel-evidence-digest";
import { inspectRealBuildPreparedRunInput } from "../e2e/real-build-prepared-step-authority";
import type { RealBuildOptions, RealBuildPanelSpec, StepFailure } from "../e2e/real-build-safety";
import { completeRealBuildTestOptions } from "./real-build-test-options";

const EMPTY_BYTES = new Uint8Array();

function digest(bytes: Uint8Array): Sha256Digest {
  return `sha256:${sha256Hex(bytes)}`;
}

function tinyPreparedRun(): { readonly bytes: Uint8Array; readonly options: RealBuildOptions } {
  const base = completeRealBuildTestOptions(359);
  const pdfDigest = base.inputDigests.pdf as Sha256Digest;
  const panels = base.panels.map((panel): RealBuildPanelSpec => {
    const bounds = { minXPt: 0, maxXPt: 1_000, minYPt: 0, maxYPt: 1 };
    const calloutBoxes: readonly [] = [];
    const panelEvidenceDigest = stepPanelEvidenceDigest({
      pdfDigest,
      stepNumber: panel.stepNumber,
      pageNumber: panel.pageNumber,
      bounds,
      calloutBoxes,
    });
    return {
      ...panel,
      ...bounds,
      calloutBoxes,
      action:
        panel.action.kind === "transition"
          ? { ...panel.action, panelEvidenceDigest }
          : panel.action,
    };
  });
  const options = { ...base, panels };
  return { bytes: new TextEncoder().encode(JSON.stringify(options)), options };
}

function sourceInspection(preparedBytes: Uint8Array, options: RealBuildOptions) {
  const prepared = inspectRealBuildPreparedRunInput(preparedBytes);
  const pdfDigest = options.inputDigests.pdf as Sha256Digest;
  const artifacts = options.panels.map((panel) => {
    const high = new Uint8ClampedArray(1_000 * 4);
    for (let pixel = 0; pixel < 1_000; pixel += 1) {
      high[pixel * 4] = 0x89;
      high[pixel * 4 + 1] = 0x90;
      high[pixel * 4 + 2] = 0x93;
      high[pixel * 4 + 3] = 255;
    }
    high[(panel.stepNumber % 1_000) * 4] = 0;
    const work = downsampleRaster({ width: 1_000, height: 1, pixels: high }, 2).pixels;
    return createRealBuildBrowserOutputV4SourceEvidencePanel({
      pdfDigest,
      panel: {
        stepNumber: panel.stepNumber,
        pageNumber: panel.pageNumber,
        minXPt: panel.minXPt,
        maxXPt: panel.maxXPt,
        minYPt: panel.minYPt,
        maxYPt: panel.maxYPt,
        calloutBoxes: panel.calloutBoxes,
        panelEvidenceDigest: stepPanelEvidenceDigest({
          pdfDigest,
          stepNumber: panel.stepNumber,
          pageNumber: panel.pageNumber,
          bounds: panel,
          calloutBoxes: panel.calloutBoxes,
        }) as Sha256Digest,
      },
      highRgba: high,
      workRgba: work,
    });
  });
  const manifest = createRealBuildBrowserOutputV4SourceEvidenceManifest({
    preparedRunInputInspection: prepared,
    panels: artifacts.map(({ descriptor }) => descriptor),
  });
  const manifestBytes = manifest.readManifestBytes();
  const session = beginRealBuildBrowserOutputV4SourceEvidenceInspection(manifestBytes, prepared);
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
  return {
    inspection: finishRealBuildBrowserOutputV4SourceEvidenceInspection(session),
    manifestBytes,
  };
}

function fixture() {
  const prepared = tinyPreparedRun();
  const preparedInspection = inspectRealBuildPreparedRunInput(prepared.bytes);
  const source = sourceInspection(prepared.bytes, prepared.options);
  const branchResult = createRealBuildBrowserBranchRoleWriterResult([]);
  const branchBytes = readRealBuildBrowserBranchRoleWriterBytes(branchResult);
  const branch = inspectRealBuildBrowserBranchDetailedEvidence(
    branchBytes.branchEvidence,
    branchBytes.compiledBranchRole,
    branchBytes.observationRole,
    prepared.bytes,
  );
  const cameraBytes = writeRealBuildBrowserCameraEvidence([]);
  const camera = readRealBuildBrowserCameraEvidence(cameraBytes);
  const failure: StepFailure = {
    code: "camera-handedness-unresolved",
    stage: "camera-registration",
    stepNumber: 1,
    message: "No exact branch or camera row was attempted.",
  };
  const report = unexecutedStepReport(prepared.options.panels[0]!, failure, {
    documentParts: 0,
    elapsedMs: 0,
    reason: failure.message,
  });
  const evidence = {
    preparedRunInputDigest: preparedInspection.preparedRunInputDigest,
    branchEvidence: {
      role: "branch-evidence-index",
      bytes: branchBytes.branchEvidence.length,
      digest: digest(branchBytes.branchEvidence),
    },
    compiledBranchRole: branchResult.evidence.compiledBranchRole,
    branchObservationRole: branchResult.evidence.observationRole,
    sourceManifest: {
      role: "source-evidence-manifest",
      bytes: source.manifestBytes.length,
      digest: digest(source.manifestBytes),
    },
    cameraManifest: {
      role: "camera-evidence-manifest",
      bytes: cameraBytes.manifestBytes.length,
      digest: digest(cameraBytes.manifestBytes),
    },
    cameraRenderRole: camera.manifest.renderRole,
    cameraMaskRole: camera.manifest.maskRole,
    transitionManifest: {
      role: "transition-evidence-manifest",
      bytes: 0,
      digest: digest(EMPTY_BYTES),
    },
  };
  const output = {
    schemaVersion: "lego.real-build-browser-output/4",
    status: "failed",
    evidence,
    reports: [report],
    documentJson: JSON.stringify(
      createEmptyBrickDocument({
        id: "real-build",
        name: "Real booklet rebuild",
        maxParts: prepared.options.maxParts,
      }),
    ),
    identityBindings: [],
    fetchedPdfDigest: prepared.options.inputDigests.pdf,
    failure,
    totalElapsedMs: 0,
    completionAuthority: REAL_BUILD_BROWSER_OUTPUT_V4_ABSENT_COMPLETION_AUTHORITY,
  };
  const envelope = inspectRealBuildBrowserOutputV4Envelope(output, prepared.bytes);
  return { prepared, source, branchBytes, branch, cameraBytes, camera, envelope };
}

describe("browser-output /4 prepared/source/camera provenance cross-binding", () => {
  it("rejects Proxy and accessor input without invoking hostile code", () => {
    let traps = 0;
    const proxy = new Proxy(
      { envelope: null, branch: null, source: null, camera: null },
      {
        get() {
          traps += 1;
          throw new Error("unexpected provenance getter");
        },
        ownKeys() {
          traps += 1;
          throw new Error("unexpected provenance ownKeys");
        },
      },
    );
    expect(() => inspectRealBuildBrowserOutputV4Provenance(proxy)).toThrow(
      /non-Proxy plain data object/iu,
    );
    expect(traps).toBe(0);

    let reads = 0;
    const accessor = { envelope: null, branch: null, source: null, camera: null };
    Object.defineProperty(accessor, "branch", {
      enumerable: true,
      get() {
        reads += 1;
        return null;
      },
    });
    expect(() => inspectRealBuildBrowserOutputV4Provenance(accessor)).toThrow(
      /branch.*own data field.*never invoked/iu,
    );
    expect(reads).toBe(0);
  });

  it("binds exact 359 prepared panel derivations and empty terminal roles without authority", () => {
    const { source, branchBytes, branch, cameraBytes, camera, envelope } = fixture();
    verifyRealBuildBrowserOutputV4EvidenceRoleBytes(
      envelope,
      "branchEvidence",
      branchBytes.branchEvidence,
    );
    verifyRealBuildBrowserOutputV4EvidenceRoleBytes(
      envelope,
      "sourceManifest",
      source.manifestBytes,
    );
    verifyRealBuildBrowserOutputV4EvidenceRoleBytes(
      envelope,
      "cameraManifest",
      cameraBytes.manifestBytes,
    );
    const inspection = inspectRealBuildBrowserOutputV4Provenance({
      envelope,
      branch,
      source: source.inspection,
      camera,
    });

    expect(inspection).toMatchObject({
      preparedPanels: 359,
      indexedBranchSteps: 0,
      cameraRows: 0,
      derivationReproducible: true,
      provenanceAuthority: "absent",
      provisionalAuthority: "absent",
      sourceExecutionProvenanceAuthority: "absent",
    });
    expect(inspection.steps).toEqual([]);
    expect(inspection.completionAuthority.authorized).toBe(false);
    expect(requireRealBuildBrowserOutputV4ProvenanceInspection(inspection)).toBe(inspection);
    expect(() => requireRealBuildBrowserOutputV4ProvenanceInspection({ ...inspection })).toThrow(
      /exact authority-free cross-binding result/u,
    );
  });
});
