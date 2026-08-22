import { sha256Hex, type Sha256Digest } from "@lego-studio/brick-kernel";

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
  decodeRealBuildAtomicCompiledBranchEvidenceWire,
  executeRealBuildAtomicCompiledBranchBatch,
} from "../e2e/real-build-atomic-compiled-branch-batch";
import {
  createRealBuildLineageIdentity,
  realBuildDocumentCandidateId,
} from "../e2e/real-build-candidate-lineage-identity";
import { createRealBuildCandidateDocumentSnapshot } from "../e2e/real-build-candidate-document-snapshot";
import { bindRealBuildExactRootLineageIdentity } from "../e2e/real-build-exact-lineage-identity";
import { snapshotRealBuildEnumeratedPlacementOffer } from "../e2e/real-build-enumerated-placement-witness";
import {
  createRealBuildBrowserObservationMaskReference,
  deriveRealBuildBrowserD4CameraRecipeDigest,
  deriveRealBuildBrowserFittedCameraDigest,
  deriveRealBuildBrowserRendererSnapshotDigest,
  digestRealBuildBrowserCameraEvidenceBytes,
} from "../e2e/real-build-browser-output-v4-camera-evidence-digest";
import { readRealBuildBrowserCameraEvidence } from "../e2e/real-build-browser-output-v4-camera-evidence-reader";
import type { RealBuildBrowserCameraEvidenceInput } from "../e2e/real-build-browser-output-v4-camera-evidence-types";
import { writeRealBuildBrowserCameraEvidence } from "../e2e/real-build-browser-output-v4-camera-evidence-writer";
import { REAL_BUILD_BROWSER_OUTPUT_V4_ABSENT_COMPLETION_AUTHORITY } from "../e2e/real-build-browser-output-v4-envelope";
import { deriveRealBuildBrowserOutputV4MissingRoleFailure } from "../e2e/real-build-browser-output-v4-reader-failure";
import { createInitialRealBuildBrowserOutputV4Frontier } from "../e2e/real-build-browser-output-v4-reader-frontier";
import {
  createRealBuildBrowserBranchRoleWriterResult,
  readRealBuildBrowserBranchRoleWriterBytes,
} from "../e2e/real-build-browser-output-v4-role-writer";
import {
  createRealBuildBrowserOutputV4TransitionEvidenceManifest,
  serializeRealBuildBrowserOutputV4TransitionEvidenceManifest,
} from "../e2e/real-build-browser-output-v4-transition-frontier";
import { unexecutedStepReport } from "../e2e/real-build-contract";
import { createRealBuildPreparedSearchLedger } from "../e2e/real-build-prepared-search-ledger";
import {
  inspectRealBuildPreparedObservationPolicy,
  inspectRealBuildPreparedPanelFromRunInput,
  inspectRealBuildPreparedStepFromRunInput,
} from "../e2e/real-build-prepared-step-authority";
import type { StepFailure } from "../e2e/real-build-safety";
import { selectedReaderCompletedReport } from "./real-build-browser-output-v4-reader-selected-report.fixture";
import {
  realBuildBrowserOutputV4SelectedSourceFixture,
  unpackSelectedSourceMask,
} from "./real-build-browser-output-v4-reader-selected-source.fixture";

const ENCODER = new TextEncoder();
const PROVISIONAL_STEP_IDENTITY = `sha256:${"3".repeat(64)}` as Sha256Digest;

function digest(bytes: Uint8Array): Sha256Digest {
  return `sha256:${sha256Hex(bytes)}`;
}

function role(role: string, bytes: Uint8Array) {
  return { role, bytes: bytes.byteLength, digest: digest(bytes) };
}

function compiledBatch(source: ReturnType<typeof realBuildBrowserOutputV4SelectedSourceFixture>) {
  const initial = createInitialRealBuildBrowserOutputV4Frontier(source.options.maxParts);
  const roots = Array.from({ length: 8 }, (_, index) =>
    bindRealBuildExactRootLineageIdentity({
      documentSnapshot: initial.documentSnapshot,
      identity: createRealBuildLineageIdentity({
        candidateId: realBuildDocumentCandidateId(initial.documentSnapshot.documentHash),
        documentHash: initial.documentSnapshot.documentHash,
        parent: null,
        throughStepNumber: 0,
        localIdentity: { kind: "evidence", id: `selected-reader-camera-root:${index}` },
      }),
    }),
  );
  const preparedStep = inspectRealBuildPreparedStepFromRunInput(source.preparedRun, 1);
  const piece = preparedStep.expectedAtomicPieces[0];
  if (piece === undefined || preparedStep.expectedAtomicPieces.length !== 1) {
    throw new TypeError("Selected reader fixture step 1 must prepare exactly one piece.");
  }
  const offer = snapshotRealBuildEnumeratedPlacementOffer({
    catalogPartId: piece.catalogPartId,
    transform: { positionLdu: [0, 0, 0], orientationId: "upright-yaw-0" },
    connections: [],
    restsOnBuildPlate: true,
  });
  const batchResult = executeRealBuildAtomicCompiledBranchBatch({
    preparedStep,
    rootCandidates: [{ documentSnapshot: initial.documentSnapshot, identities: roots }],
    enumeratedParents: roots.map(({ lineageId }) => ({
      parentLineageId: lineageId,
      candidates: [{ partIds: ["selected-reader-part-1"], offeredCandidates: [offer] }],
    })),
    ledger: createRealBuildPreparedSearchLedger(8),
  });
  if (batchResult.status !== "compiled") {
    throw new TypeError("Selected reader fixture compiler did not produce a branch batch.");
  }
  const lineage = batchResult.evidence;
  if (
    lineage.rootCandidates[0]?.identities.length !== 8 ||
    lineage.lineageEdges.length !== 8 ||
    lineage.childCandidates.length !== 1 ||
    lineage.uniqueTransitions.length !== 1
  ) {
    throw new TypeError("Selected reader fixture did not produce convergent eight-root evidence.");
  }
  return { initial, preparedStep, batchResult, lineage };
}

function cameraAndClosure(
  source: ReturnType<typeof realBuildBrowserOutputV4SelectedSourceFixture>,
  compiled: ReturnType<typeof compiledBatch>,
) {
  const sourcePanel = source.firstPanelArtifact.descriptor;
  const sourceMask = unpackSelectedSourceMask(source.firstPanelArtifact, "own-panel-source");
  const excludedMask = unpackSelectedSourceMask(source.firstPanelArtifact, "own-panel-exclusion");
  if (!sourceMask.some((pixel) => pixel === 1)) {
    throw new TypeError("Selected reader fixture source mask unexpectedly contains no art.");
  }
  const candidateMask = Uint8Array.from(sourceMask);
  const packedSource = packRealBuildCompiledBinaryMaskMsb(
    sourceMask,
    sourcePanel.workWidth,
    sourcePanel.workHeight,
  );
  const packedExcluded = packRealBuildCompiledBinaryMaskMsb(
    excludedMask,
    sourcePanel.workWidth,
    sourcePanel.workHeight,
  );
  const packedCandidate = packRealBuildCompiledBinaryMaskMsb(
    candidateMask,
    sourcePanel.workWidth,
    sourcePanel.workHeight,
  );
  const sourceReference = createRealBuildBrowserObservationMaskReference({
    offset: 0,
    bytes: packedSource.length,
    digest: digestRealBuildBrowserCameraEvidenceBytes(packedSource),
    widthPx: sourcePanel.workWidth,
    heightPx: sourcePanel.workHeight,
  });
  const excludedReference = createRealBuildBrowserObservationMaskReference({
    offset: packedSource.length,
    bytes: packedExcluded.length,
    digest: digestRealBuildBrowserCameraEvidenceBytes(packedExcluded),
    widthPx: sourcePanel.workWidth,
    heightPx: sourcePanel.workHeight,
  });
  const candidateReference = createRealBuildBrowserObservationMaskReference({
    offset: packedSource.length + packedExcluded.length,
    bytes: packedCandidate.length,
    digest: digestRealBuildBrowserCameraEvidenceBytes(packedCandidate),
    widthPx: sourcePanel.workWidth,
    heightPx: sourcePanel.workHeight,
  });
  const sourceBody: Omit<RealBuildCompiledObservationSourceCommitment, "sourceId"> = {
    preparedRunInputDigest: compiled.preparedStep.preparedRunInputDigest,
    preparedStepIdentity: compiled.preparedStep.printedStepIdentity,
    provisionalStepIdentity: PROVISIONAL_STEP_IDENTITY,
    observationMode: "own-panel",
    compiledThroughStepNumber: 1,
    registrationPanelStepNumber: 1,
    pageNumber: sourcePanel.pageNumber,
    panelDigest: sourcePanel.panelEvidenceDigest,
    cropDigest: sourcePanel.cropDescriptorDigest,
    sourceDescriptorDigest: sourcePanel.ownPanel.sourceDescriptorDigest,
    exclusionDescriptorDigest: sourcePanel.ownPanel.exclusionDescriptorDigest,
    metric: REAL_BUILD_COMPILED_OBSERVATION_METRIC,
    measure: sourcePanel.ownPanel.measure,
    sourceMask: sourceReference,
    excludedMask: excludedReference,
  };
  const sourceCommitment = {
    sourceId: deriveRealBuildCompiledObservationSourceId(sourceBody),
    ...sourceBody,
  };
  const child = compiled.lineage.childCandidates[0]!;
  const canonicalDocumentBytes = ENCODER.encode(child.canonicalBytes);
  const preparedPanel = {
    preparedRunInputDigest: sourceCommitment.preparedRunInputDigest,
    preparedStepIdentity: sourceCommitment.preparedStepIdentity,
    provisionalStepIdentity: sourceCommitment.provisionalStepIdentity,
    observationMode: sourceCommitment.observationMode,
    compiledThroughStepNumber: 1,
    registrationPanelStepNumber: 1,
    pageNumber: sourcePanel.pageNumber,
    panelDigest: sourcePanel.panelEvidenceDigest,
    cropDigest: sourcePanel.cropDescriptorDigest,
    sourceDescriptorDigest: sourcePanel.ownPanel.sourceDescriptorDigest,
    exclusionDescriptorDigest: sourcePanel.ownPanel.exclusionDescriptorDigest,
    crop: {
      minXPt: sourcePanel.minXPt,
      maxXPt: sourcePanel.maxXPt,
      minYPt: sourcePanel.minYPt,
      maxYPt: sourcePanel.maxYPt,
    },
    face: source.options.panels[0]!.panelFace as "studs-up",
    measure: sourcePanel.ownPanel.measure,
  };
  const fittedCamera = {
    azimuthDegrees: 45,
    elevationDegrees: 30,
    pixelsPerUnit: 12,
    residualPx: 0.25,
    coherence: 0.95,
    centerXPx: sourcePanel.workWidth / 2,
    centerYPx: sourcePanel.workHeight / 2,
  };
  const lattice = { hand: "as-fitted" as const, determinant: 1 as const, turnDegrees: 0 as const };
  const rendererInputs = {
    renderer: "three-webgl" as const,
    rendererVersion: "selected-reader-test-renderer-1",
    widthPx: sourcePanel.workWidth,
    heightPx: sourcePanel.workHeight,
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
  const cameraChild = {
    candidateId: child.candidateId,
    documentHash: child.documentHash,
    canonicalBytesDigest: digestRealBuildBrowserCameraEvidenceBytes(canonicalDocumentBytes),
    canonicalByteLength: canonicalDocumentBytes.length,
  };
  const fittedCameraDigest = deriveRealBuildBrowserFittedCameraDigest(fittedCamera);
  const d4CameraRecipeDigest = deriveRealBuildBrowserD4CameraRecipeDigest({
    sourceId: sourceCommitment.sourceId,
    child: cameraChild,
    preparedPanel,
    fittedCamera,
    fittedCameraDigest,
    lattice,
  });
  const renderRgba = new Uint8Array(sourcePanel.workPixelCount * 4);
  for (let pixel = 0; pixel < candidateMask.length; pixel += 1) {
    renderRgba[pixel * 4] = 0x22;
    renderRgba[pixel * 4 + 1] = 0x33;
    renderRgba[pixel * 4 + 2] = 0x44;
    renderRgba[pixel * 4 + 3] = candidateMask[pixel] === 1 ? 255 : 0;
  }
  const render = {
    role: "d4-child-render-rgba-bytes" as const,
    offset: 0,
    bytes: renderRgba.length,
    digest: digestRealBuildBrowserCameraEvidenceBytes(renderRgba),
    encoding: "rgba8-top-left-row-major/1" as const,
    widthPx: sourcePanel.workWidth,
    heightPx: sourcePanel.workHeight,
  };
  const rendererSnapshotDigest = deriveRealBuildBrowserRendererSnapshotDigest({
    child: cameraChild,
    d4CameraRecipeDigest,
    rendererInputs,
    render,
  });
  const cameraId = deriveRealBuildCompiledObservationCameraId({
    sourceId: sourceCommitment.sourceId,
    candidateId: child.candidateId,
    documentHash: child.documentHash,
    d4CameraRecipeDigest,
    rendererSnapshotDigest,
    candidateMask: candidateReference,
  });
  const observationRoleBytes = new Uint8Array(
    packedSource.length + packedExcluded.length + packedCandidate.length,
  );
  observationRoleBytes.set(packedSource, 0);
  observationRoleBytes.set(packedExcluded, packedSource.length);
  observationRoleBytes.set(packedCandidate, packedSource.length + packedExcluded.length);
  const registration = createRealBuildCompiledObservationRegistrationVerifier(1_000_000).register({
    source: packedSource,
    excluded: packedExcluded,
    candidate: packedCandidate,
    width: sourcePanel.workWidth,
    height: sourcePanel.workHeight,
    measure: sourcePanel.ownPanel.measure,
    path: "selected reader independent closure registration",
  });
  const cameraCommitment = {
    cameraId,
    sourceId: sourceCommitment.sourceId,
    candidateId: child.candidateId,
    documentHash: child.documentHash,
    d4CameraRecipeDigest,
    rendererSnapshotDigest,
    candidateMask: candidateReference,
  };
  const lineageIds = compiled.lineage.lineageEdges.map(({ child: identity }) => identity.lineageId);
  const observations = lineageIds.map((lineageId) => {
    const body = {
      lineageId,
      sourceId: sourceCommitment.sourceId,
      cameraId,
      status: "scored" as const,
      shiftPx: registration.shiftPx,
      score: registration.score,
      outcome: null,
    };
    return { observationId: deriveRealBuildCompiledObservationId(body), ...body };
  });
  const transition = compiled.lineage.uniqueTransitions[0]!;
  const closure: RealBuildCompiledObservationClosure = {
    schemaVersion: "lego.real-build-compiled-observation-closure/1",
    compiledLineageBytesDigest: digest(
      decodeRealBuildAtomicCompiledBranchEvidenceWire(compiled.batchResult.evidenceWire),
    ),
    roleBytes: observationRoleBytes.length,
    roleDigest: digest(observationRoleBytes),
    sources: [sourceCommitment],
    cameras: [cameraCommitment],
    observations,
    selection: {
      status: "selected",
      decisionSourceId: sourceCommitment.sourceId,
      selectedCameraId: cameraId,
      selectedCandidateId: child.candidateId,
      selectedLineageIds: lineageIds,
      bestScore: registration.score,
      runnerUpScore: null,
      margin: null,
    },
    acceptedTransition: {
      candidateId: child.candidateId,
      documentHash: child.documentHash,
      lineageIds,
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
  const input: RealBuildBrowserCameraEvidenceInput = {
    sourceId: sourceCommitment.sourceId,
    cameraId,
    candidateId: child.candidateId,
    documentHash: child.documentHash,
    canonicalDocumentBytes,
    preparedPanel,
    fittedCamera,
    lattice,
    rendererInputs,
    renderRgba,
    sourceMask: Uint8Array.from(sourceMask),
    excludedMask: Uint8Array.from(excludedMask),
    candidateMask,
  };
  const cameraBytes = writeRealBuildBrowserCameraEvidence([input]);
  const cameraInspection = readRealBuildBrowserCameraEvidence(cameraBytes);
  return {
    cameraBytes,
    cameraInspection,
    closureBytes: ENCODER.encode(JSON.stringify(closure)),
  };
}

export function realBuildBrowserOutputV4SelectedTupleFixture() {
  const source = realBuildBrowserOutputV4SelectedSourceFixture();
  const compiled = compiledBatch(source);
  const camera = cameraAndClosure(source, compiled);
  const policyInspection = inspectRealBuildPreparedObservationPolicy(source.preparedRunInputBytes);
  const branchResult = createRealBuildBrowserBranchRoleWriterResult([
    {
      batchResult: compiled.batchResult,
      observation: {
        closureBytes: camera.closureBytes,
        roleBytes: camera.cameraBytes.maskRoleBytes,
        policyInspection,
      },
    },
  ]);
  const branchBytes = readRealBuildBrowserBranchRoleWriterBytes(branchResult);
  const transitionManifestBytes = serializeRealBuildBrowserOutputV4TransitionEvidenceManifest(
    createRealBuildBrowserOutputV4TransitionEvidenceManifest([]),
  );
  const child = compiled.lineage.childCandidates[0]!;
  const childSnapshot = createRealBuildCandidateDocumentSnapshot({
    canonicalDocument: child.canonicalBytes,
    expectedDocumentHash: child.documentHash,
  });
  const completed = selectedReaderCompletedReport({
    panel: source.options.panels[0]!,
    transition: compiled.lineage.uniqueTransitions[0]!,
    parentDocumentHash: compiled.initial.documentSnapshot.documentHash,
    cameraRow: camera.cameraInspection.manifest.rows[0]!,
  });
  const failure: StepFailure = deriveRealBuildBrowserOutputV4MissingRoleFailure(
    inspectRealBuildPreparedPanelFromRunInput(source.preparedRun, 2),
  );
  const failed = unexecutedStepReport(source.options.panels[1]!, failure, {
    documentParts: childSnapshot.document.parts.length,
    elapsedMs: 0,
    reason: failure.message,
  });
  const preparedPiece = source.options.panels[0]!.pieces[0]!;
  const childPart = childSnapshot.document.parts[0]!;
  const identityBindings = [
    {
      identityKey: preparedPiece.identityKey,
      partId: childPart.id,
      stepNumber: 1,
      designId: preparedPiece.designId,
      materialId: preparedPiece.materialId,
      catalogPartId: preparedPiece.catalogPartId,
      colorId: preparedPiece.colorId,
    },
  ];
  const browserOutput = {
    schemaVersion: "lego.real-build-browser-output/4",
    status: "failed",
    evidence: {
      preparedRunInputDigest: source.preparedRun.preparedRunInputDigest,
      branchEvidence: role("branch-evidence-index", branchBytes.branchEvidence),
      compiledBranchRole: branchResult.evidence.compiledBranchRole,
      branchObservationRole: branchResult.evidence.observationRole,
      sourceManifest: role("source-evidence-manifest", source.manifestBytes),
      cameraManifest: role("camera-evidence-manifest", camera.cameraBytes.manifestBytes),
      cameraRenderRole: camera.cameraInspection.manifest.renderRole,
      cameraMaskRole: camera.cameraInspection.manifest.maskRole,
      transitionManifest: role("transition-evidence-manifest", transitionManifestBytes),
    },
    reports: [completed, failed],
    documentJson: childSnapshot.canonicalBytes,
    identityBindings,
    fetchedPdfDigest: source.options.inputDigests.pdf,
    failure,
    totalElapsedMs: 0,
    completionAuthority: REAL_BUILD_BROWSER_OUTPUT_V4_ABSENT_COMPLETION_AUTHORITY,
  };
  return Object.freeze({
    source,
    compiled,
    camera,
    childSnapshot,
    tuple: {
      browserOutput,
      preparedRunInputBytes: source.preparedRunInputBytes,
      branchEvidenceBytes: branchBytes.branchEvidence,
      compiledBranchRoleBytes: branchBytes.compiledBranchRole,
      branchObservationRoleBytes: branchBytes.observationRole,
      sourceManifestBytes: source.manifestBytes,
      sourceInspection: source.inspection,
      cameraManifestBytes: camera.cameraBytes.manifestBytes,
      cameraRenderRoleBytes: camera.cameraBytes.renderRoleBytes,
      cameraMaskRoleBytes: camera.cameraBytes.maskRoleBytes,
      transitionManifestBytes,
    },
  });
}
