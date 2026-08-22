import type { Sha256Digest } from "@lego-studio/brick-kernel";
import { describe, expect, it } from "vitest";

import {
  deriveRealBuildCompiledObservationCameraId,
  deriveRealBuildCompiledObservationSourceId,
} from "../e2e/real-build-compiled-observation-closure-digest";
import { REAL_BUILD_COMPILED_OBSERVATION_METRIC } from "../e2e/real-build-compiled-observation-closure-types";
import { packRealBuildCompiledBinaryMaskMsb } from "../e2e/real-build-compiled-observation-registration";
import {
  createRealBuildBrowserObservationMaskReference,
  deriveRealBuildBrowserD4CameraRecipeDigest,
  deriveRealBuildBrowserFittedCameraDigest,
  deriveRealBuildBrowserRendererSnapshotDigest,
  digestRealBuildBrowserCameraEvidenceBytes,
} from "../e2e/real-build-browser-output-v4-camera-evidence-digest";
import { readRealBuildBrowserCameraEvidence } from "../e2e/real-build-browser-output-v4-camera-evidence-reader";
import type {
  RealBuildBrowserCameraEvidenceBytes,
  RealBuildBrowserCameraEvidenceInput,
  RealBuildBrowserCameraEvidenceManifest,
} from "../e2e/real-build-browser-output-v4-camera-evidence-types";
import { writeRealBuildBrowserCameraEvidence } from "../e2e/real-build-browser-output-v4-camera-evidence-writer";

const digest = (character: string): Sha256Digest =>
  `sha256:${character.repeat(64)}` as Sha256Digest;
const WIDTH = 9;
const HEIGHT = 1;
const SOURCE = Uint8Array.of(0, 1, 1, 0, 1, 0, 0, 0, 1);
const EXCLUDED = new Uint8Array(WIDTH);
const CANDIDATE_A = Uint8Array.of(1, 1, 0, 0, 1, 0, 0, 0, 1);
const CANDIDATE_B = Uint8Array.of(1, 0, 1, 0, 1, 0, 0, 0, 1);

function cameraInput(input: {
  readonly candidate: Uint8Array;
  readonly candidateOffset: number;
  readonly renderOffset: number;
  readonly turnDegrees: 0 | 90 | 180 | 270;
  readonly compiledThroughStepNumber?: number;
}): RealBuildBrowserCameraEvidenceInput {
  const canonicalDocumentBytes = Uint8Array.of(0x7b, 0x7d);
  const sourceMask = Uint8Array.from(SOURCE);
  const excludedMask = Uint8Array.from(EXCLUDED);
  const candidateMask = Uint8Array.from(input.candidate);
  const renderRgba = new Uint8Array(WIDTH * HEIGHT * 4);
  for (let pixel = 0; pixel < candidateMask.length; pixel += 1) {
    renderRgba[pixel * 4] = 32 + pixel;
    renderRgba[pixel * 4 + 1] = 64 + pixel;
    renderRgba[pixel * 4 + 2] = 96 + pixel;
    renderRgba[pixel * 4 + 3] = candidateMask[pixel] === 0 ? 0 : 255;
  }
  const packedSource = packRealBuildCompiledBinaryMaskMsb(sourceMask, WIDTH, HEIGHT);
  const packedExcluded = packRealBuildCompiledBinaryMaskMsb(excludedMask, WIDTH, HEIGHT);
  const packedCandidate = packRealBuildCompiledBinaryMaskMsb(candidateMask, WIDTH, HEIGHT);
  const sourceReference = createRealBuildBrowserObservationMaskReference({
    offset: 0,
    bytes: packedSource.length,
    digest: digestRealBuildBrowserCameraEvidenceBytes(packedSource),
    widthPx: WIDTH,
    heightPx: HEIGHT,
  });
  const excludedReference = createRealBuildBrowserObservationMaskReference({
    offset: packedSource.length,
    bytes: packedExcluded.length,
    digest: digestRealBuildBrowserCameraEvidenceBytes(packedExcluded),
    widthPx: WIDTH,
    heightPx: HEIGHT,
  });
  const candidateReference = createRealBuildBrowserObservationMaskReference({
    offset: input.candidateOffset,
    bytes: packedCandidate.length,
    digest: digestRealBuildBrowserCameraEvidenceBytes(packedCandidate),
    widthPx: WIDTH,
    heightPx: HEIGHT,
  });
  const preparedPanel = {
    preparedRunInputDigest: digest("1"),
    preparedStepIdentity: digest("2"),
    provisionalStepIdentity: digest("3"),
    observationMode: "own-panel" as const,
    compiledThroughStepNumber: input.compiledThroughStepNumber ?? 7,
    registrationPanelStepNumber: input.compiledThroughStepNumber ?? 7,
    pageNumber: 12,
    panelDigest: digest("4"),
    cropDigest: digest("5"),
    sourceDescriptorDigest: digest("6"),
    exclusionDescriptorDigest: digest("7"),
    crop: { minXPt: 10, maxXPt: 110, minYPt: 20, maxYPt: 120 },
    face: "studs-up" as const,
    measure: "iou" as const,
  };
  const sourceId = deriveRealBuildCompiledObservationSourceId({
    preparedRunInputDigest: preparedPanel.preparedRunInputDigest,
    preparedStepIdentity: preparedPanel.preparedStepIdentity,
    provisionalStepIdentity: preparedPanel.provisionalStepIdentity,
    observationMode: preparedPanel.observationMode,
    compiledThroughStepNumber: preparedPanel.compiledThroughStepNumber,
    registrationPanelStepNumber: preparedPanel.registrationPanelStepNumber,
    pageNumber: preparedPanel.pageNumber,
    panelDigest: preparedPanel.panelDigest,
    cropDigest: preparedPanel.cropDigest,
    sourceDescriptorDigest: preparedPanel.sourceDescriptorDigest,
    exclusionDescriptorDigest: preparedPanel.exclusionDescriptorDigest,
    metric: REAL_BUILD_COMPILED_OBSERVATION_METRIC,
    measure: preparedPanel.measure,
    sourceMask: sourceReference,
    excludedMask: excludedReference,
  });
  const candidateId = `document:${digest("8")}` as const;
  const documentHash = digest("9");
  const child = {
    candidateId,
    documentHash,
    canonicalBytesDigest: digestRealBuildBrowserCameraEvidenceBytes(canonicalDocumentBytes),
    canonicalByteLength: canonicalDocumentBytes.length,
  };
  const fittedCamera = {
    azimuthDegrees: 45,
    elevationDegrees: 30,
    pixelsPerUnit: 12,
    residualPx: 0.25,
    coherence: 0.95,
    centerXPx: 4,
    centerYPx: 0,
  };
  const lattice = {
    hand: "as-fitted" as const,
    determinant: 1 as const,
    turnDegrees: input.turnDegrees,
  };
  const rendererInputs = {
    renderer: "three-webgl" as const,
    rendererVersion: "test-renderer-1",
    widthPx: WIDTH,
    heightPx: HEIGHT,
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
    cameraFar: 1000,
    sceneSnapshotDigest: digest("e"),
  };
  const fittedCameraDigest = deriveRealBuildBrowserFittedCameraDigest(fittedCamera);
  const d4CameraRecipeDigest = deriveRealBuildBrowserD4CameraRecipeDigest({
    sourceId,
    child,
    preparedPanel,
    fittedCamera,
    fittedCameraDigest,
    lattice,
  });
  const render = {
    role: "d4-child-render-rgba-bytes" as const,
    offset: input.renderOffset,
    bytes: renderRgba.length,
    digest: digestRealBuildBrowserCameraEvidenceBytes(renderRgba),
    encoding: "rgba8-top-left-row-major/1" as const,
    widthPx: WIDTH,
    heightPx: HEIGHT,
  };
  const rendererSnapshotDigest = deriveRealBuildBrowserRendererSnapshotDigest({
    child,
    d4CameraRecipeDigest,
    rendererInputs,
    render,
  });
  const cameraId = deriveRealBuildCompiledObservationCameraId({
    sourceId,
    candidateId,
    documentHash,
    d4CameraRecipeDigest,
    rendererSnapshotDigest,
    candidateMask: candidateReference,
  });
  return {
    sourceId,
    cameraId,
    candidateId,
    documentHash,
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
}

function mutateBundle(
  bytes: RealBuildBrowserCameraEvidenceBytes,
  mutate: (manifest: RealBuildBrowserCameraEvidenceManifest) => Uint8Array | undefined,
): RealBuildBrowserCameraEvidenceBytes {
  const manifest = JSON.parse(
    new TextDecoder().decode(bytes.manifestBytes),
  ) as RealBuildBrowserCameraEvidenceManifest;
  const replacementMaskRole = mutate(manifest);
  const maskRoleBytes = replacementMaskRole ?? Uint8Array.from(bytes.maskRoleBytes);
  if (replacementMaskRole !== undefined) {
    (manifest.maskRole as { bytes: number; digest: Sha256Digest }).bytes = maskRoleBytes.length;
    (manifest.maskRole as { bytes: number; digest: Sha256Digest }).digest =
      digestRealBuildBrowserCameraEvidenceBytes(maskRoleBytes);
  }
  return {
    manifestBytes: new TextEncoder().encode(JSON.stringify(manifest)),
    renderRoleBytes: Uint8Array.from(bytes.renderRoleBytes),
    maskRoleBytes,
  };
}

function aliasedInputs(): readonly [
  RealBuildBrowserCameraEvidenceInput,
  RealBuildBrowserCameraEvidenceInput,
] {
  return [
    cameraInput({ candidate: CANDIDATE_A, candidateOffset: 4, renderOffset: 0, turnDegrees: 0 }),
    cameraInput({ candidate: CANDIDATE_A, candidateOffset: 4, renderOffset: 36, turnDegrees: 90 }),
  ];
}

function disjointInputs(): readonly [
  RealBuildBrowserCameraEvidenceInput,
  RealBuildBrowserCameraEvidenceInput,
] {
  return [
    cameraInput({ candidate: CANDIDATE_A, candidateOffset: 4, renderOffset: 0, turnDegrees: 0 }),
    cameraInput({ candidate: CANDIDATE_B, candidateOffset: 6, renderOffset: 36, turnDegrees: 90 }),
  ];
}

describe("browser-output /4 aliased camera mask role", () => {
  it("round-trips two exact cameras with one shared source pair and aliased candidate mask", () => {
    const inputs = aliasedInputs();
    const inspected = readRealBuildBrowserCameraEvidence(
      writeRealBuildBrowserCameraEvidence(inputs),
    );
    expect(inspected.manifest.maskRole.bytes).toBe(6);
    expect(inspected.manifest.rows[0]!.sourceId).toBe(inspected.manifest.rows[1]!.sourceId);
    expect(inspected.manifest.rows[0]!.cameraId).not.toBe(inspected.manifest.rows[1]!.cameraId);
    expect(inspected.manifest.rows[1]).toMatchObject({
      sourceMask: { offset: 0, bytes: 2 },
      excludedMask: { offset: 2, bytes: 2 },
      candidateMask: { offset: 4, bytes: 2 },
      render: { offset: 36 },
    });
  });

  it("retains a new disjoint candidate range when that exact reference reproduces cameraId", () => {
    const inspected = readRealBuildBrowserCameraEvidence(
      writeRealBuildBrowserCameraEvidence(disjointInputs()),
    );
    expect(inspected.manifest.maskRole.bytes).toBe(8);
    expect(inspected.manifest.rows[1]).toMatchObject({
      sourceMask: { offset: 0 },
      excludedMask: { offset: 2 },
      candidateMask: { offset: 6, bytes: 2 },
    });
  });

  it("keeps closure-local offsets while assigning distinct global bases across placement steps", () => {
    const first = cameraInput({
      candidate: CANDIDATE_A,
      candidateOffset: 4,
      renderOffset: 0,
      turnDegrees: 0,
      compiledThroughStepNumber: 7,
    });
    const second = cameraInput({
      candidate: CANDIDATE_A,
      candidateOffset: 4,
      renderOffset: 36,
      turnDegrees: 90,
      compiledThroughStepNumber: 8,
    });
    const inspected = readRealBuildBrowserCameraEvidence(
      writeRealBuildBrowserCameraEvidence([first, second]),
    );
    expect(inspected.manifest.maskRole.bytes).toBe(12);
    expect(inspected.manifest.rows.map(({ maskRoleBaseOffset }) => maskRoleBaseOffset)).toEqual([
      0, 6,
    ]);
    for (const row of inspected.manifest.rows) {
      expect(row.sourceMask.offset).toBe(0);
      expect(row.excludedMask.offset).toBe(2);
      expect(row.candidateMask.offset).toBe(4);
    }
  });

  it("rejects source byte drift behind a repeated exact sourceId", () => {
    const inputs = aliasedInputs();
    inputs[1].sourceMask[0] = 1;
    expect(() => writeRealBuildBrowserCameraEvidence(inputs)).toThrow(
      /reuses different exact source mask bytes/iu,
    );
  });

  it("rejects partial overlaps, unused gaps, alias descriptor drift, and trailing bytes", () => {
    const disjoint = writeRealBuildBrowserCameraEvidence(disjointInputs());
    const overlap = mutateBundle(disjoint, (manifest) => {
      (manifest.rows[1]!.candidateMask as { offset: number }).offset = 5;
      return undefined;
    });
    expect(() => readRealBuildBrowserCameraEvidence(overlap)).toThrow(/partial overlap/iu);

    const gap = mutateBundle(disjoint, (manifest) => {
      (manifest.rows[1]!.candidateMask as { offset: number }).offset = 7;
      const role = new Uint8Array(disjoint.maskRoleBytes.length + 1);
      role.set(disjoint.maskRoleBytes.subarray(0, 6), 0);
      role.set(disjoint.maskRoleBytes.subarray(6), 7);
      return role;
    });
    expect(() => readRealBuildBrowserCameraEvidence(gap)).toThrow(/unused gap/iu);

    const aliased = writeRealBuildBrowserCameraEvidence(aliasedInputs());
    const drift = mutateBundle(aliased, (manifest) => {
      (manifest.rows[1]!.candidateMask as { digest: Sha256Digest }).digest = digest("f");
      return undefined;
    });
    expect(() => readRealBuildBrowserCameraEvidence(drift)).toThrow(/different descriptor/iu);

    const trailing = mutateBundle(aliased, () => {
      const role = new Uint8Array(aliased.maskRoleBytes.length + 1);
      role.set(aliased.maskRoleBytes);
      return role;
    });
    expect(() => readRealBuildBrowserCameraEvidence(trailing)).toThrow(/cover 6 bytes/iu);
  });
});
