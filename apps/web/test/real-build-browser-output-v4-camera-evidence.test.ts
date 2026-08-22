import { describe, expect, it } from "vitest";

import type { Sha256Digest } from "@lego-studio/brick-kernel";

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
import {
  readRealBuildBrowserCameraEvidence,
  requireRealBuildBrowserCameraEvidenceInspection,
} from "../e2e/real-build-browser-output-v4-camera-evidence-reader";
import {
  MAXIMUM_REAL_BUILD_BROWSER_CAMERA_EVIDENCE_INDEX_BYTES,
  MAXIMUM_REAL_BUILD_BROWSER_CAMERA_EVIDENCE_ROLE_BYTES,
  type RealBuildBrowserCameraEvidenceBytes,
  type RealBuildBrowserCameraEvidenceInput,
  type RealBuildBrowserCameraEvidenceManifest,
} from "../e2e/real-build-browser-output-v4-camera-evidence-types";
import { writeRealBuildBrowserCameraEvidence } from "../e2e/real-build-browser-output-v4-camera-evidence-writer";

const digest = (character: string): Sha256Digest =>
  `sha256:${character.repeat(64)}` as Sha256Digest;

function makeInput(maskOffset = 0, renderOffset = 0): RealBuildBrowserCameraEvidenceInput {
  const canonicalDocumentBytes = Uint8Array.of(0x7b, 0x7d);
  const renderRgba = Uint8Array.of(
    10,
    20,
    30,
    255,
    40,
    50,
    60,
    255,
    70,
    80,
    90,
    0,
    100,
    110,
    120,
    0,
  );
  const sourceMask = Uint8Array.of(0, 1, 1, 0);
  const excludedMask = Uint8Array.of(0, 0, 0, 0);
  const candidateMask = Uint8Array.of(1, 1, 0, 0);
  const packedSource = packRealBuildCompiledBinaryMaskMsb(sourceMask, 2, 2);
  const packedExcluded = packRealBuildCompiledBinaryMaskMsb(excludedMask, 2, 2);
  const packedCandidate = packRealBuildCompiledBinaryMaskMsb(candidateMask, 2, 2);
  const sourceReference = createRealBuildBrowserObservationMaskReference({
    offset: maskOffset,
    bytes: 1,
    digest: digestRealBuildBrowserCameraEvidenceBytes(packedSource),
    widthPx: 2,
    heightPx: 2,
  });
  const excludedReference = createRealBuildBrowserObservationMaskReference({
    offset: maskOffset + 1,
    bytes: 1,
    digest: digestRealBuildBrowserCameraEvidenceBytes(packedExcluded),
    widthPx: 2,
    heightPx: 2,
  });
  const candidateReference = createRealBuildBrowserObservationMaskReference({
    offset: maskOffset + 2,
    bytes: 1,
    digest: digestRealBuildBrowserCameraEvidenceBytes(packedCandidate),
    widthPx: 2,
    heightPx: 2,
  });
  const preparedPanel = {
    preparedRunInputDigest: digest("1"),
    preparedStepIdentity: digest("2"),
    provisionalStepIdentity: digest("3"),
    observationMode: "own-panel" as const,
    compiledThroughStepNumber: 7,
    registrationPanelStepNumber: 7,
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
    centerXPx: 1,
    centerYPx: 1,
  };
  const lattice = { hand: "as-fitted" as const, determinant: 1 as const, turnDegrees: 90 as const };
  const rendererInputs = {
    renderer: "three-webgl" as const,
    rendererVersion: "test-renderer-1",
    widthPx: 2,
    heightPx: 2,
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
    offset: renderOffset,
    bytes: renderRgba.length,
    digest: digestRealBuildBrowserCameraEvidenceBytes(renderRgba),
    encoding: "rgba8-top-left-row-major/1" as const,
    widthPx: 2,
    heightPx: 2,
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

function copyBytes(bytes: Uint8Array): Uint8Array {
  return Uint8Array.from(bytes);
}

function copyBundle(
  bundle: RealBuildBrowserCameraEvidenceBytes,
): RealBuildBrowserCameraEvidenceBytes {
  return {
    manifestBytes: copyBytes(bundle.manifestBytes),
    renderRoleBytes: copyBytes(bundle.renderRoleBytes),
    maskRoleBytes: copyBytes(bundle.maskRoleBytes),
  };
}

function mutateManifest(
  bundle: RealBuildBrowserCameraEvidenceBytes,
  mutate: (manifest: RealBuildBrowserCameraEvidenceManifest) => void,
): RealBuildBrowserCameraEvidenceBytes {
  const manifest = JSON.parse(
    new TextDecoder().decode(bundle.manifestBytes),
  ) as RealBuildBrowserCameraEvidenceManifest;
  mutate(manifest);
  return {
    manifestBytes: new TextEncoder().encode(JSON.stringify(manifest)),
    renderRoleBytes: copyBytes(bundle.renderRoleBytes),
    maskRoleBytes: copyBytes(bundle.maskRoleBytes),
  };
}

describe("browser-output /4 exact D4 child-render evidence", () => {
  it("round-trips the exact child, prepared source, D4 camera, renderer, masks, and registration without authority", () => {
    const input = makeInput();
    const bytes = writeRealBuildBrowserCameraEvidence([input]);
    const inspected = readRealBuildBrowserCameraEvidence(bytes);
    const row = inspected.manifest.rows[0]!;
    expect(row.sourceId).toBe(input.sourceId);
    expect(row.cameraId).toBe(input.cameraId);
    expect(row.child).toMatchObject({
      candidateId: input.candidateId,
      documentHash: input.documentHash,
      canonicalByteLength: input.canonicalDocumentBytes.length,
      canonicalBytesDigest: digestRealBuildBrowserCameraEvidenceBytes(input.canonicalDocumentBytes),
    });
    expect(row.preparedPanel.crop).toEqual(input.preparedPanel.crop);
    expect(row.preparedPanel.face).toBe("studs-up");
    expect(row.lattice).toEqual({ hand: "as-fitted", determinant: 1, turnDegrees: 90 });
    expect(row.registration.shiftPx).toHaveLength(2);
    expect(inspected).toMatchObject({
      reproducible: true,
      provenanceAuthority: "absent",
      provisionalAuthority: "absent",
      sourceExecutionProvenanceAuthority: "absent",
      physicalAuthority: "absent",
      placementAuthority: "absent",
      completionAuthority: "absent",
    });
    expect(inspected.manifest.physicalAuthority.authorized).toBe(false);
    expect(Object.isFrozen(row.child)).toBe(true);
    expect(requireRealBuildBrowserCameraEvidenceInspection(inspected)).toBe(inspected);
    expect(() =>
      requireRealBuildBrowserCameraEvidenceInspection({
        manifest: inspected.manifest,
        reproducible: true,
      }),
    ).toThrow(/privately branded/iu);
    const dense = readRealBuildBrowserCameraEvidence(
      writeRealBuildBrowserCameraEvidence([makeInput(), makeInput(3, 16)]),
    );
    expect(dense.manifest.rows).toHaveLength(2);
    expect(dense.manifest.rows[1]).toMatchObject({
      render: { offset: 16 },
      sourceMask: { offset: 3 },
      excludedMask: { offset: 4 },
      candidateMask: { offset: 5 },
    });
  });

  it("rejects exact-binding mutations to source, child, camera recipe, renderer, dense roles, shift, and score", () => {
    const bytes = writeRealBuildBrowserCameraEvidence([makeInput()]);
    const mutations: readonly ((manifest: RealBuildBrowserCameraEvidenceManifest) => void)[] = [
      (manifest) => {
        (manifest.rows[0] as { sourceId: string }).sourceId =
          `compiled-observation-source:${digest("a")}`;
      },
      (manifest) => {
        (manifest.rows[0]!.child as { canonicalBytesDigest: Sha256Digest }).canonicalBytesDigest =
          digest("b");
      },
      (manifest) => {
        (manifest.rows[0]!.preparedPanel as { face: "underside" }).face = "underside";
      },
      (manifest) => {
        (manifest.rows[0]!.fittedCamera as { elevationDegrees: number }).elevationDegrees = 31;
      },
      (manifest) => {
        (manifest.rows[0]!.lattice as { turnDegrees: number }).turnDegrees = 180;
      },
      (manifest) => {
        (manifest.rows[0]!.rendererInputs as { rendererVersion: string }).rendererVersion =
          "wrong-renderer";
      },
      (manifest) => {
        (manifest.rows[0] as { d4CameraRecipeDigest: Sha256Digest }).d4CameraRecipeDigest =
          digest("c");
      },
      (manifest) => {
        (manifest.rows[0] as { rendererSnapshotDigest: Sha256Digest }).rendererSnapshotDigest =
          digest("d");
      },
      (manifest) => {
        (manifest.rows[0]!.sourceMask as { offset: number }).offset = 1;
      },
      (manifest) => {
        const shift = manifest.rows[0]!.registration.shiftPx as unknown as [number, number];
        shift[0] = shift[0] + 1;
      },
      (manifest) => {
        (manifest.rows[0]!.registration as { score: number }).score = 0.123;
      },
      (manifest) => {
        (manifest.rows[0]!.registration as { sourcePixels: number }).sourcePixels += 1;
      },
      (manifest) => {
        (manifest.physicalAuthority as { authorized: boolean }).authorized = true;
      },
    ];
    for (const mutate of mutations) {
      expect(() => readRealBuildBrowserCameraEvidence(mutateManifest(bytes, mutate))).toThrow();
    }
    const renderFlip = copyBundle(bytes);
    renderFlip.renderRoleBytes[0] = renderFlip.renderRoleBytes[0]! ^ 1;
    expect(() => readRealBuildBrowserCameraEvidence(renderFlip)).toThrow(/render role/iu);
    const maskFlip = copyBundle(bytes);
    maskFlip.maskRoleBytes[2] = maskFlip.maskRoleBytes[2]! ^ 0x80;
    expect(() => readRealBuildBrowserCameraEvidence(maskFlip)).toThrow(/mask role/iu);
    const alphaFlip = copyBundle(bytes);
    alphaFlip.renderRoleBytes[3] = 0;
    const alphaManifest = JSON.parse(
      new TextDecoder().decode(alphaFlip.manifestBytes),
    ) as RealBuildBrowserCameraEvidenceManifest;
    (alphaManifest.renderRole as { digest: Sha256Digest }).digest =
      digestRealBuildBrowserCameraEvidenceBytes(alphaFlip.renderRoleBytes);
    (alphaManifest.rows[0]!.render as { digest: Sha256Digest }).digest =
      digestRealBuildBrowserCameraEvidenceBytes(alphaFlip.renderRoleBytes);
    (alphaFlip as { manifestBytes: Uint8Array }).manifestBytes = new TextEncoder().encode(
      JSON.stringify(alphaManifest),
    );
    expect(() => readRealBuildBrowserCameraEvidence(alphaFlip)).toThrow(/rendered alpha/iu);
    const candidateFlip = copyBundle(bytes);
    candidateFlip.maskRoleBytes[2] = candidateFlip.maskRoleBytes[2]! ^ 0x80;
    const candidateManifest = JSON.parse(
      new TextDecoder().decode(candidateFlip.manifestBytes),
    ) as RealBuildBrowserCameraEvidenceManifest;
    (candidateManifest.maskRole as { digest: Sha256Digest }).digest =
      digestRealBuildBrowserCameraEvidenceBytes(candidateFlip.maskRoleBytes);
    (candidateManifest.rows[0]!.candidateMask as { digest: Sha256Digest }).digest =
      digestRealBuildBrowserCameraEvidenceBytes(candidateFlip.maskRoleBytes.slice(2, 3));
    (candidateFlip as { manifestBytes: Uint8Array }).manifestBytes = new TextEncoder().encode(
      JSON.stringify(candidateManifest),
    );
    expect(() => readRealBuildBrowserCameraEvidence(candidateFlip)).toThrow(/rendered alpha/iu);
    expect(() =>
      readRealBuildBrowserCameraEvidence({
        manifestBytes: copyBytes(bytes.manifestBytes),
        renderRoleBytes: copyBytes(bytes.maskRoleBytes),
        maskRoleBytes: copyBytes(bytes.renderRoleBytes),
      }),
    ).toThrow();
  });

  it("rejects writer accessors, aliases, proxy/shared/detached bytes, alpha-mask disagreement, and oversize reader input", () => {
    let accessorReads = 0;
    const accessorInput = makeInput() as RealBuildBrowserCameraEvidenceInput &
      Record<string, unknown>;
    Object.defineProperty(accessorInput, "renderRgba", {
      enumerable: true,
      get: () => {
        accessorReads += 1;
        return Uint8Array.of();
      },
    });
    expect(() => writeRealBuildBrowserCameraEvidence([accessorInput])).toThrow(/own data field/iu);
    expect(accessorReads).toBe(0);

    const proxyInput = makeInput() as RealBuildBrowserCameraEvidenceInput & {
      renderRgba: Uint8Array;
    };
    let byteProxyTraps = 0;
    proxyInput.renderRgba = new Proxy(proxyInput.renderRgba, {
      get: () => {
        byteProxyTraps += 1;
        return undefined;
      },
    });
    expect(() => writeRealBuildBrowserCameraEvidence([proxyInput])).toThrow(/genuine Uint8Array/iu);
    expect(byteProxyTraps).toBe(0);

    const aliasInput = makeInput() as RealBuildBrowserCameraEvidenceInput & {
      canonicalDocumentBytes: Uint8Array;
      renderRgba: Uint8Array;
    };
    const aliasedStorage = new ArrayBuffer(16);
    aliasInput.canonicalDocumentBytes = new Uint8Array(aliasedStorage, 0, 2);
    aliasInput.renderRgba = new Uint8Array(aliasedStorage);
    expect(() => writeRealBuildBrowserCameraEvidence([aliasInput])).toThrow(/aliases/iu);

    const wrongMask = makeInput() as RealBuildBrowserCameraEvidenceInput & {
      candidateMask: Uint8Array;
    };
    wrongMask.candidateMask = Uint8Array.of(0, 1, 0, 0);
    expect(() => writeRealBuildBrowserCameraEvidence([wrongMask])).toThrow(/rendered alpha/iu);

    const wrongCanonical = makeInput() as RealBuildBrowserCameraEvidenceInput & {
      canonicalDocumentBytes: Uint8Array;
    };
    wrongCanonical.canonicalDocumentBytes[0] = wrongCanonical.canonicalDocumentBytes[0]! ^ 1;
    expect(() => writeRealBuildBrowserCameraEvidence([wrongCanonical])).toThrow(/cameraId/iu);

    if (typeof SharedArrayBuffer !== "undefined") {
      const sharedInput = makeInput() as RealBuildBrowserCameraEvidenceInput & {
        canonicalDocumentBytes: Uint8Array;
      };
      sharedInput.canonicalDocumentBytes = new Uint8Array(new SharedArrayBuffer(2));
      expect(() => writeRealBuildBrowserCameraEvidence([sharedInput])).toThrow(
        /SharedArrayBuffer/iu,
      );
    }

    const detachedInput = makeInput() as RealBuildBrowserCameraEvidenceInput & {
      canonicalDocumentBytes: Uint8Array;
    };
    structuredClone(detachedInput.canonicalDocumentBytes, {
      transfer: [detachedInput.canonicalDocumentBytes.buffer],
    });
    expect(() => writeRealBuildBrowserCameraEvidence([detachedInput])).toThrow();

    const bytes = writeRealBuildBrowserCameraEvidence([makeInput()]);
    let readerAccessorReads = 0;
    const readerAccessor = copyBundle(bytes) as RealBuildBrowserCameraEvidenceBytes &
      Record<string, unknown>;
    Object.defineProperty(readerAccessor, "manifestBytes", {
      enumerable: true,
      get: () => {
        readerAccessorReads += 1;
        return copyBytes(bytes.manifestBytes);
      },
    });
    expect(() => readRealBuildBrowserCameraEvidence(readerAccessor)).toThrow(/own data field/iu);
    expect(readerAccessorReads).toBe(0);
    expect(() =>
      readRealBuildBrowserCameraEvidence({
        manifestBytes: copyBytes(bytes.manifestBytes),
        renderRoleBytes: bytes.renderRoleBytes,
        maskRoleBytes: bytes.renderRoleBytes,
      }),
    ).toThrow(/aliases/iu);
    expect(() =>
      readRealBuildBrowserCameraEvidence({
        manifestBytes: new Proxy(copyBytes(bytes.manifestBytes), {}),
        renderRoleBytes: copyBytes(bytes.renderRoleBytes),
        maskRoleBytes: copyBytes(bytes.maskRoleBytes),
      }),
    ).toThrow(/genuine Uint8Array/iu);
    expect(() =>
      readRealBuildBrowserCameraEvidence({
        manifestBytes: new Uint8Array(MAXIMUM_REAL_BUILD_BROWSER_CAMERA_EVIDENCE_INDEX_BYTES + 1),
        renderRoleBytes: copyBytes(bytes.renderRoleBytes),
        maskRoleBytes: copyBytes(bytes.maskRoleBytes),
      }),
    ).toThrow(/maximum/iu);

    let writerProxyTraps = 0;
    const rowProxy = new Proxy(makeInput(), {
      ownKeys: () => {
        writerProxyTraps += 1;
        return [];
      },
    });
    expect(() => writeRealBuildBrowserCameraEvidence([rowProxy])).toThrow(/Proxy/iu);
    expect(writerProxyTraps).toBe(0);

    let readerProxyTraps = 0;
    const inputProxy = new Proxy(copyBundle(bytes), {
      getOwnPropertyDescriptor: () => {
        readerProxyTraps += 1;
        return undefined;
      },
    });
    expect(() => readRealBuildBrowserCameraEvidence(inputProxy)).toThrow(/Proxy/iu);
    expect(readerProxyTraps).toBe(0);

    expect(() =>
      readRealBuildBrowserCameraEvidence({
        manifestBytes: Uint8Array.of(0),
        renderRoleBytes: new Uint8Array(MAXIMUM_REAL_BUILD_BROWSER_CAMERA_EVIDENCE_ROLE_BYTES),
        maskRoleBytes: new Uint8Array(MAXIMUM_REAL_BUILD_BROWSER_CAMERA_EVIDENCE_ROLE_BYTES),
      }),
    ).toThrow(/aggregate maximum/iu);
  });
});
