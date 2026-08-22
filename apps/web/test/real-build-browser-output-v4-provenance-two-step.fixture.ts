import { createEmptyBrickDocument, sha256Hex, type Sha256Digest } from "@lego-studio/brick-kernel";

import {
  deriveRealBuildCompiledObservationCameraId,
  deriveRealBuildCompiledObservationId,
  deriveRealBuildCompiledObservationSourceId,
} from "../e2e/real-build-compiled-observation-closure-digest";
import {
  REAL_BUILD_COMPILED_OBSERVATION_METRIC,
  type RealBuildCompiledObservationClosure,
  type RealBuildCompiledObservationSourceCommitment,
} from "../e2e/real-build-compiled-observation-closure-types";
import {
  createRealBuildCompiledObservationRegistrationVerifier,
  packRealBuildCompiledBinaryMaskMsb,
} from "../e2e/real-build-compiled-observation-registration";
import {
  createRealBuildBrowserObservationMaskReference,
  deriveRealBuildBrowserD4CameraRecipeDigest,
  deriveRealBuildBrowserFittedCameraDigest,
  deriveRealBuildBrowserRendererSnapshotDigest,
} from "../e2e/real-build-browser-output-v4-camera-evidence-digest";
import { readRealBuildBrowserCameraEvidence } from "../e2e/real-build-browser-output-v4-camera-evidence-reader";
import type { RealBuildBrowserCameraEvidenceInput } from "../e2e/real-build-browser-output-v4-camera-evidence-types";
import { writeRealBuildBrowserCameraEvidence } from "../e2e/real-build-browser-output-v4-camera-evidence-writer";
import {
  inspectRealBuildBrowserOutputV4Envelope,
  REAL_BUILD_BROWSER_OUTPUT_V4_ABSENT_COMPLETION_AUTHORITY,
} from "../e2e/real-build-browser-output-v4-envelope";
import { inspectRealBuildBrowserOutputV4Provenance } from "../e2e/real-build-browser-output-v4-provenance";
import {
  createRealBuildBrowserBranchRoleWriterResult,
  readRealBuildBrowserBranchRoleWriterBytes,
} from "../e2e/real-build-browser-output-v4-role-writer";
import { inspectRealBuildBrowserBranchDetailedEvidence } from "../e2e/real-build-browser-output-v4-semantic";
import type { RealBuildBrowserOutputV4SourceEvidencePanelArtifact } from "../e2e/real-build-browser-output-v4-source-evidence-types";
import { unexecutedStepReport } from "../e2e/real-build-contract";
import {
  inspectRealBuildPreparedObservationPolicy,
  inspectRealBuildPreparedRunInput,
} from "../e2e/real-build-prepared-step-authority";
import type { RealBuildOptions, StepFailure } from "../e2e/real-build-safety";
import {
  realBuildBrowserOutputV4SemanticTwoStepFixture,
  type RealBuildBrowserOutputV4SemanticCompiledStepFixture,
} from "./real-build-browser-output-v4-semantic-two-step.fixture";
import {
  twoStepSourceEvidence,
  unpackTwoStepSourceMask,
} from "./real-build-browser-output-v4-provenance-two-step-source.fixture";

const ENCODER = new TextEncoder();
const DECODER = new TextDecoder();

function digest(bytes: Uint8Array): Sha256Digest {
  return `sha256:${sha256Hex(bytes)}`;
}

function role(roleName: string, bytes: Uint8Array) {
  return { role: roleName, bytes: bytes.length, digest: digest(bytes) };
}

function observedStep(
  step: RealBuildBrowserOutputV4SemanticCompiledStepFixture,
  artifact: RealBuildBrowserOutputV4SourceEvidencePanelArtifact,
  panelFace: "studs-up" | "underside",
  renderOffset: number,
  retainCamera: boolean,
) {
  const descriptor = artifact.descriptor;
  const sourceMask = unpackTwoStepSourceMask(artifact, "own-panel-source");
  const excludedMask = unpackTwoStepSourceMask(artifact, "own-panel-exclusion");
  const candidateMask = Uint8Array.from(sourceMask);
  const packedSource = packRealBuildCompiledBinaryMaskMsb(
    sourceMask,
    descriptor.workWidth,
    descriptor.workHeight,
  );
  const packedExcluded = packRealBuildCompiledBinaryMaskMsb(
    excludedMask,
    descriptor.workWidth,
    descriptor.workHeight,
  );
  const packedCandidate = packRealBuildCompiledBinaryMaskMsb(
    candidateMask,
    descriptor.workWidth,
    descriptor.workHeight,
  );
  const sourceMaskReference = createRealBuildBrowserObservationMaskReference({
    offset: 0,
    bytes: packedSource.length,
    digest: digest(packedSource),
    widthPx: descriptor.workWidth,
    heightPx: descriptor.workHeight,
  });
  const excludedMaskReference = createRealBuildBrowserObservationMaskReference({
    offset: packedSource.length,
    bytes: packedExcluded.length,
    digest: digest(packedExcluded),
    widthPx: descriptor.workWidth,
    heightPx: descriptor.workHeight,
  });
  const candidateMaskReference = createRealBuildBrowserObservationMaskReference({
    offset: packedSource.length + packedExcluded.length,
    bytes: packedCandidate.length,
    digest: digest(packedCandidate),
    widthPx: descriptor.workWidth,
    heightPx: descriptor.workHeight,
  });
  const provisionalStepIdentity = `sha256:${String(step.stepNumber).repeat(64)}` as Sha256Digest;
  const sourceBody: Omit<RealBuildCompiledObservationSourceCommitment, "sourceId"> = {
    preparedRunInputDigest: step.preparedStep.preparedRunInputDigest,
    preparedStepIdentity: step.preparedStep.printedStepIdentity,
    provisionalStepIdentity,
    observationMode: "own-panel",
    compiledThroughStepNumber: step.stepNumber,
    registrationPanelStepNumber: step.stepNumber,
    pageNumber: descriptor.pageNumber,
    panelDigest: descriptor.panelEvidenceDigest,
    cropDigest: descriptor.cropDescriptorDigest,
    sourceDescriptorDigest: descriptor.ownPanel.sourceDescriptorDigest,
    exclusionDescriptorDigest: descriptor.ownPanel.exclusionDescriptorDigest,
    metric: REAL_BUILD_COMPILED_OBSERVATION_METRIC,
    measure: descriptor.ownPanel.measure,
    sourceMask: sourceMaskReference,
    excludedMask: excludedMaskReference,
  };
  const source = {
    sourceId: deriveRealBuildCompiledObservationSourceId(sourceBody),
    ...sourceBody,
  };
  if (!retainCamera) {
    if (sourceMask.some((pixel) => pixel !== 0))
      throw new TypeError("Source-only closure fixture requires an exactly empty source mask.");
    const roleBytes = new Uint8Array(packedSource.length + packedExcluded.length);
    roleBytes.set(packedSource, 0);
    roleBytes.set(packedExcluded, packedSource.length);
    const observations = step.lineage.lineageEdges.map(({ child }) => {
      const body = {
        lineageId: child.lineageId,
        sourceId: source.sourceId,
        cameraId: null,
        status: "not-observable" as const,
        shiftPx: null,
        score: null,
        outcome: "source-mask-empty" as const,
      };
      return { observationId: deriveRealBuildCompiledObservationId(body), ...body };
    });
    const closure: RealBuildCompiledObservationClosure = {
      schemaVersion: "lego.real-build-compiled-observation-closure/1",
      compiledLineageBytesDigest: digest(step.lineageBytes),
      roleBytes: roleBytes.length,
      roleDigest: digest(roleBytes),
      sources: [source],
      cameras: [],
      observations,
      selection: {
        status: "unresolved",
        decisionSourceId: source.sourceId,
        selectedCameraId: null,
        selectedCandidateId: null,
        selectedLineageIds: [],
        bestScore: null,
        runnerUpScore: null,
        margin: null,
      },
      acceptedTransition: null,
      completionAuthority: {
        status: "absent",
        authorized: false,
        reason: "compiled-observation-closure-is-inspection-only",
      },
    };
    return {
      closureBytes: ENCODER.encode(JSON.stringify(closure)),
      roleBytes,
      cameraInput: null,
    };
  }
  const child = step.lineage.childCandidates[0]!;
  const canonicalDocumentBytes = ENCODER.encode(child.canonicalBytes);
  const cameraChild = {
    candidateId: child.candidateId,
    documentHash: child.documentHash,
    canonicalBytesDigest: digest(canonicalDocumentBytes),
    canonicalByteLength: canonicalDocumentBytes.length,
  };
  const preparedPanel = {
    preparedRunInputDigest: source.preparedRunInputDigest,
    preparedStepIdentity: source.preparedStepIdentity,
    provisionalStepIdentity,
    observationMode: "own-panel" as const,
    compiledThroughStepNumber: step.stepNumber,
    registrationPanelStepNumber: step.stepNumber,
    pageNumber: descriptor.pageNumber,
    panelDigest: descriptor.panelEvidenceDigest,
    cropDigest: descriptor.cropDescriptorDigest,
    sourceDescriptorDigest: descriptor.ownPanel.sourceDescriptorDigest,
    exclusionDescriptorDigest: descriptor.ownPanel.exclusionDescriptorDigest,
    crop: {
      minXPt: descriptor.minXPt,
      maxXPt: descriptor.maxXPt,
      minYPt: descriptor.minYPt,
      maxYPt: descriptor.maxYPt,
    },
    face: panelFace,
    measure: descriptor.ownPanel.measure,
  };
  const fittedCamera = {
    azimuthDegrees: 45,
    elevationDegrees: 30,
    pixelsPerUnit: 12,
    residualPx: 0.25,
    coherence: 0.95,
    centerXPx: descriptor.workWidth / 2,
    centerYPx: descriptor.workHeight / 2,
  };
  const lattice = {
    hand: "as-fitted" as const,
    determinant: 1 as const,
    turnDegrees: (step.stepNumber === 1 ? 0 : 90) as 0 | 90,
  };
  const rendererInputs = {
    renderer: "three-webgl" as const,
    rendererVersion: "two-step-provenance-test/1",
    widthPx: descriptor.workWidth,
    heightPx: descriptor.workHeight,
    pixelRatio: 1 as const,
    backgroundRgba: [0, 0, 0, 0] as const,
    colorSpace: "srgb" as const,
    antialias: false,
    alpha: true as const,
    preserveDrawingBuffer: true as const,
    cameraProjection: "perspective" as const,
    viewMatrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, -10, 1] as const,
    projectionMatrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, -1, -1, 0, 0, -0.2, 0] as const,
    cameraNear: 0.1,
    cameraFar: 1_000,
    sceneSnapshotDigest: child.canonicalBytesHash,
  };
  const fittedCameraDigest = deriveRealBuildBrowserFittedCameraDigest(fittedCamera);
  const d4CameraRecipeDigest = deriveRealBuildBrowserD4CameraRecipeDigest({
    sourceId: source.sourceId,
    child: cameraChild,
    preparedPanel,
    fittedCamera,
    fittedCameraDigest,
    lattice,
  });
  const renderRgba = new Uint8Array(descriptor.workPixelCount * 4);
  for (let pixel = 0; pixel < candidateMask.length; pixel += 1)
    renderRgba[pixel * 4 + 3] = candidateMask[pixel] === 0 ? 0 : 255;
  const render = {
    role: "d4-child-render-rgba-bytes" as const,
    offset: renderOffset,
    bytes: renderRgba.length,
    digest: digest(renderRgba),
    encoding: "rgba8-top-left-row-major/1" as const,
    widthPx: descriptor.workWidth,
    heightPx: descriptor.workHeight,
  };
  const rendererSnapshotDigest = deriveRealBuildBrowserRendererSnapshotDigest({
    child: cameraChild,
    d4CameraRecipeDigest,
    rendererInputs,
    render,
  });
  const cameraId = deriveRealBuildCompiledObservationCameraId({
    sourceId: source.sourceId,
    candidateId: child.candidateId,
    documentHash: child.documentHash,
    d4CameraRecipeDigest,
    rendererSnapshotDigest,
    candidateMask: candidateMaskReference,
  });
  const roleBytes = new Uint8Array(
    packedSource.length + packedExcluded.length + packedCandidate.length,
  );
  roleBytes.set(packedSource, 0);
  roleBytes.set(packedExcluded, packedSource.length);
  roleBytes.set(packedCandidate, packedSource.length + packedExcluded.length);
  const registration = createRealBuildCompiledObservationRegistrationVerifier(1_000_000).register({
    source: packedSource,
    excluded: packedExcluded,
    candidate: packedCandidate,
    width: descriptor.workWidth,
    height: descriptor.workHeight,
    measure: descriptor.ownPanel.measure,
    path: `two-step provenance step ${step.stepNumber}`,
  });
  const camera = {
    cameraId,
    sourceId: source.sourceId,
    candidateId: child.candidateId,
    documentHash: child.documentHash,
    d4CameraRecipeDigest,
    rendererSnapshotDigest,
    candidateMask: candidateMaskReference,
  };
  const observationBody = {
    lineageId: step.lineage.lineageEdges[0]!.child.lineageId,
    sourceId: source.sourceId,
    cameraId,
    status: "scored" as const,
    shiftPx: registration.shiftPx,
    score: registration.score,
    outcome: null,
  };
  const transition = step.lineage.uniqueTransitions[0]!;
  const closure: RealBuildCompiledObservationClosure = {
    schemaVersion: "lego.real-build-compiled-observation-closure/1",
    compiledLineageBytesDigest: digest(step.lineageBytes),
    roleBytes: roleBytes.length,
    roleDigest: digest(roleBytes),
    sources: [source],
    cameras: [camera],
    observations: [
      { observationId: deriveRealBuildCompiledObservationId(observationBody), ...observationBody },
    ],
    selection: {
      status: "selected",
      decisionSourceId: source.sourceId,
      selectedCameraId: cameraId,
      selectedCandidateId: child.candidateId,
      selectedLineageIds: [observationBody.lineageId],
      bestScore: registration.score,
      runnerUpScore: null,
      margin: null,
    },
    acceptedTransition: {
      candidateId: child.candidateId,
      documentHash: child.documentHash,
      lineageIds: [observationBody.lineageId],
      transitionIds: [transition.transitionId],
      canonicalStepId: transition.receipt.canonicalStepId,
      placedPieces: transition.pieces.length,
    },
    completionAuthority: {
      status: "absent",
      authorized: false,
      reason: "compiled-observation-closure-is-inspection-only",
    },
  };
  const cameraInput: RealBuildBrowserCameraEvidenceInput = {
    sourceId: source.sourceId,
    cameraId,
    candidateId: child.candidateId,
    documentHash: child.documentHash,
    canonicalDocumentBytes,
    preparedPanel,
    fittedCamera,
    lattice,
    rendererInputs,
    renderRgba,
    sourceMask,
    excludedMask,
    candidateMask,
  };
  return { closureBytes: ENCODER.encode(JSON.stringify(closure)), roleBytes, cameraInput };
}

export function realBuildBrowserOutputV4TwoStepProvenanceFixture(sourceOnlyTerminal = false) {
  const compiled = realBuildBrowserOutputV4SemanticTwoStepFixture();
  const options = JSON.parse(DECODER.decode(compiled.preparedRunInputBytes)) as RealBuildOptions;
  const source = twoStepSourceEvidence(
    compiled.preparedRunInputBytes,
    options,
    sourceOnlyTerminal ? 2 : null,
  );
  const first = observedStep(compiled.step1, source.artifacts[0]!, "studs-up", 0, true);
  if (first.cameraInput === null)
    throw new TypeError("Two-step provenance fixture lost its first camera row.");
  const second = observedStep(
    compiled.step2,
    source.artifacts[1]!,
    "studs-up",
    first.cameraInput.renderRgba.length,
    !sourceOnlyTerminal,
  );
  const policy = inspectRealBuildPreparedObservationPolicy(compiled.preparedRunInputBytes);
  const branchResult = createRealBuildBrowserBranchRoleWriterResult(
    compiled.steps.map((step, index) => {
      const observed = index === 0 ? first : second;
      return {
        batchResult: step.batchResult,
        observation: {
          closureBytes: observed.closureBytes,
          roleBytes: observed.roleBytes,
          policyInspection: policy,
        },
      };
    }),
  );
  const branchBytes = readRealBuildBrowserBranchRoleWriterBytes(branchResult);
  const branch = inspectRealBuildBrowserBranchDetailedEvidence(
    branchBytes.branchEvidence,
    branchBytes.compiledBranchRole,
    branchBytes.observationRole,
    compiled.preparedRunInputBytes,
  );
  const cameraInputs = [first.cameraInput, second.cameraInput].filter(
    (input): input is RealBuildBrowserCameraEvidenceInput => input !== null,
  );
  const cameraBytes = writeRealBuildBrowserCameraEvidence(cameraInputs);
  const camera = readRealBuildBrowserCameraEvidence(cameraBytes);
  const failure: StepFailure = {
    code: "camera-handedness-unresolved",
    stage: "camera-registration",
    stepNumber: 1,
    message: "Synthetic envelope terminator outside this provenance-only branch test.",
  };
  const report = unexecutedStepReport(options.panels[0]!, failure, {
    documentParts: 0,
    elapsedMs: 0,
    reason: failure.message,
  });
  const empty = new Uint8Array();
  const prepared = inspectRealBuildPreparedRunInput(compiled.preparedRunInputBytes);
  const envelope = inspectRealBuildBrowserOutputV4Envelope(
    {
      schemaVersion: "lego.real-build-browser-output/4",
      status: "failed",
      evidence: {
        preparedRunInputDigest: prepared.preparedRunInputDigest,
        branchEvidence: role("branch-evidence-index", branchBytes.branchEvidence),
        compiledBranchRole: branchResult.evidence.compiledBranchRole,
        branchObservationRole: branchResult.evidence.observationRole,
        sourceManifest: role("source-evidence-manifest", source.manifestBytes),
        cameraManifest: role("camera-evidence-manifest", cameraBytes.manifestBytes),
        cameraRenderRole: camera.manifest.renderRole,
        cameraMaskRole: camera.manifest.maskRole,
        transitionManifest: role("transition-evidence-manifest", empty),
      },
      reports: [report],
      documentJson: JSON.stringify(
        createEmptyBrickDocument({
          id: "real-build",
          name: "Real booklet rebuild",
          maxParts: options.maxParts,
        }),
      ),
      identityBindings: [],
      fetchedPdfDigest: options.inputDigests.pdf,
      failure,
      totalElapsedMs: 0,
      completionAuthority: REAL_BUILD_BROWSER_OUTPUT_V4_ABSENT_COMPLETION_AUTHORITY,
    },
    compiled.preparedRunInputBytes,
  );
  const provenance = inspectRealBuildBrowserOutputV4Provenance({
    envelope,
    branch,
    source: source.inspection,
    camera,
  });
  return { branch, camera, provenance };
}
