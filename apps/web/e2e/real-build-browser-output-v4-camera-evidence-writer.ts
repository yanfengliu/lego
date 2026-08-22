import { isProxy } from "node:util/types";

import {
  deriveRealBuildCompiledObservationCameraId,
  deriveRealBuildCompiledObservationSourceId,
} from "./real-build-compiled-observation-closure-digest";
import {
  MAXIMUM_REAL_BUILD_COMPILED_OBSERVATION_PIXEL_VISITS,
  REAL_BUILD_COMPILED_OBSERVATION_METRIC,
  type RealBuildCompiledObservationCameraId,
  type RealBuildCompiledObservationMaskReference,
} from "./real-build-compiled-observation-closure-types";
import {
  createRealBuildCompiledObservationRegistrationVerifier,
  packRealBuildCompiledBinaryMaskMsb,
  realBuildCompiledObservationRegistrationVisits,
} from "./real-build-compiled-observation-registration";
import { encodeRealBuildSafeJson } from "./real-build-safe-json-bytes";
import {
  createRealBuildBrowserObservationMaskReference,
  deriveRealBuildBrowserCameraEvidenceId,
  deriveRealBuildBrowserD4CameraRecipeDigest,
  deriveRealBuildBrowserFittedCameraDigest,
  deriveRealBuildBrowserRendererSnapshotDigest,
  digestRealBuildBrowserCameraEvidenceBytes,
} from "./real-build-browser-output-v4-camera-evidence-digest";
import {
  append,
  field,
  measureBytes,
  normalizeMetadata,
  snapshotBytes,
} from "./real-build-browser-output-v4-camera-evidence-writer-primitives";
import {
  MAXIMUM_REAL_BUILD_BROWSER_CAMERA_EVIDENCE_INDEX_BYTES,
  MAXIMUM_REAL_BUILD_BROWSER_CAMERA_EVIDENCE_ROLE_BYTES,
  MAXIMUM_REAL_BUILD_BROWSER_CAMERA_EVIDENCE_ROWS,
  MAXIMUM_REAL_BUILD_BROWSER_CAMERA_EVIDENCE_TOTAL_BYTES,
  REAL_BUILD_BROWSER_CAMERA_EVIDENCE_SCHEMA_VERSION,
  type RealBuildBrowserCameraEvidenceBytes,
  type RealBuildBrowserCameraEvidenceInput,
  type RealBuildBrowserCameraEvidenceManifest,
  type RealBuildBrowserCameraEvidenceRenderReference,
  type RealBuildBrowserCameraEvidenceRow,
} from "./real-build-browser-output-v4-camera-evidence-types";

const SAFE_ARRAY_IS_ARRAY = Array.isArray;
const SAFE_GET_OWN_PROPERTY_DESCRIPTOR = Object.getOwnPropertyDescriptor;
const MAXIMUM_CAMERA_MASK_REFERENCE_TRIALS = 1_000_000;

interface RetainedMask {
  readonly reference: RealBuildCompiledObservationMaskReference;
  readonly bytes: Uint8Array;
}

interface RetainedSource {
  readonly sourceMask: RetainedMask;
  readonly excludedMask: RetainedMask;
}

function equalBytes(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) return false;
  for (let index = 0; index < left.length; index += 1)
    if (left[index] !== right[index]) return false;
  return true;
}

function maskMatches(
  retained: RetainedMask,
  bytes: Uint8Array,
  widthPx: number,
  heightPx: number,
): boolean {
  return (
    retained.reference.widthPx === widthPx &&
    retained.reference.heightPx === heightPx &&
    equalBytes(retained.bytes, bytes)
  );
}

function maskContentKey(reference: RealBuildCompiledObservationMaskReference): string {
  return `${reference.widthPx}:${reference.heightPx}:${reference.digest}`;
}

function retainMask(masksByContent: Map<string, RetainedMask[]>, retained: RetainedMask): void {
  const key = maskContentKey(retained.reference);
  const matching = masksByContent.get(key);
  if (matching === undefined) masksByContent.set(key, [retained]);
  else matching.push(retained);
}

export function writeRealBuildBrowserCameraEvidence(
  inputs: readonly RealBuildBrowserCameraEvidenceInput[],
): RealBuildBrowserCameraEvidenceBytes {
  if (isProxy(inputs)) throw new TypeError("Camera evidence rows cannot be a Proxy.");
  const lengthDescriptor = SAFE_GET_OWN_PROPERTY_DESCRIPTOR(inputs, "length");
  const count = lengthDescriptor && "value" in lengthDescriptor ? lengthDescriptor.value : null;
  if (
    !SAFE_ARRAY_IS_ARRAY(inputs) ||
    !Number.isSafeInteger(count) ||
    count < 0 ||
    count > MAXIMUM_REAL_BUILD_BROWSER_CAMERA_EVIDENCE_ROWS
  )
    throw new RangeError(
      `Camera evidence requires 0 through ${MAXIMUM_REAL_BUILD_BROWSER_CAMERA_EVIDENCE_ROWS} dense rows.`,
    );
  const preflight: Array<{
    readonly input: RealBuildBrowserCameraEvidenceInput;
    readonly path: string;
    readonly metadata: ReturnType<typeof normalizeMetadata>;
  }> = [];
  let inputBytes = 0;
  let retainedRoleBytes = 0;
  let visits = 0;
  for (let index = 0; index < count; index += 1) {
    const descriptor = SAFE_GET_OWN_PROPERTY_DESCRIPTOR(inputs, String(index));
    if (descriptor === undefined || !("value" in descriptor) || !descriptor.enumerable)
      throw new TypeError(
        `Camera evidence rows must be dense own data entries; row ${index} is not.`,
      );
    const input = descriptor.value as RealBuildBrowserCameraEvidenceInput;
    const path = `rows[${index}]`;
    const metadata = normalizeMetadata(input, path);
    const canonicalLength = measureBytes(
      field(input, "canonicalDocumentBytes", path),
      MAXIMUM_REAL_BUILD_BROWSER_CAMERA_EVIDENCE_ROLE_BYTES,
      `${path}.canonicalDocumentBytes`,
    );
    const renderLength = measureBytes(
      field(input, "renderRgba", path),
      MAXIMUM_REAL_BUILD_BROWSER_CAMERA_EVIDENCE_ROLE_BYTES,
      `${path}.renderRgba`,
    );
    const sourceLength = measureBytes(
      field(input, "sourceMask", path),
      metadata.pixels,
      `${path}.sourceMask`,
    );
    const excludedLength = measureBytes(
      field(input, "excludedMask", path),
      metadata.pixels,
      `${path}.excludedMask`,
    );
    const candidateLength = measureBytes(
      field(input, "candidateMask", path),
      metadata.pixels,
      `${path}.candidateMask`,
    );
    if (canonicalLength < 1)
      throw new RangeError(`${path}.canonicalDocumentBytes cannot be empty.`);
    if (renderLength !== metadata.pixels * 4)
      throw new RangeError(`${path}.renderRgba must contain exactly four bytes per pixel.`);
    if (
      sourceLength !== metadata.pixels ||
      excludedLength !== metadata.pixels ||
      candidateLength !== metadata.pixels
    )
      throw new RangeError(`${path} masks must contain exactly one unpacked byte per pixel.`);
    inputBytes += canonicalLength + renderLength + sourceLength + excludedLength + candidateLength;
    retainedRoleBytes += renderLength + Math.ceil(metadata.pixels / 8) * 3;
    visits += realBuildCompiledObservationRegistrationVisits(metadata.width, metadata.height);
    if (inputBytes > MAXIMUM_REAL_BUILD_BROWSER_CAMERA_EVIDENCE_TOTAL_BYTES)
      throw new RangeError(
        `Camera evidence input exceeds the aggregate ${MAXIMUM_REAL_BUILD_BROWSER_CAMERA_EVIDENCE_TOTAL_BYTES}-byte work cap at ${path}.`,
      );
    if (
      retainedRoleBytes + MAXIMUM_REAL_BUILD_BROWSER_CAMERA_EVIDENCE_INDEX_BYTES >
      MAXIMUM_REAL_BUILD_BROWSER_CAMERA_EVIDENCE_TOTAL_BYTES
    )
      throw new RangeError(
        `Camera evidence cannot reserve its manifest and retained roles within the aggregate ${MAXIMUM_REAL_BUILD_BROWSER_CAMERA_EVIDENCE_TOTAL_BYTES}-byte cap.`,
      );
    if (visits > MAXIMUM_REAL_BUILD_COMPILED_OBSERVATION_PIXEL_VISITS)
      throw new RangeError(
        `Camera evidence exceeds the bounded registration work budget at ${path}.`,
      );
    preflight.push({ input, path, metadata });
  }
  const seenBuffers = new WeakSet<object>();
  const renderChunks: Uint8Array[] = [];
  const maskChunks: Uint8Array[] = [];
  const rows: RealBuildBrowserCameraEvidenceRow[] = [];
  let retainedMasksByContent = new Map<string, RetainedMask[]>();
  let sourcesById = new Map<string, RetainedSource>();
  const verifier = createRealBuildCompiledObservationRegistrationVerifier(
    MAXIMUM_REAL_BUILD_COMPILED_OBSERVATION_PIXEL_VISITS,
  );
  let renderOffset = 0;
  let maskOffset = 0;
  let localMaskOffset = 0;
  let maskRoleBaseOffset = 0;
  let currentStepNumber: number | null = null;
  let maskReferenceTrials = 0;
  for (let index = 0; index < count; index += 1) {
    const { input, path, metadata } = preflight[index]!;
    const stepNumber = metadata.preparedPanel.compiledThroughStepNumber;
    if (currentStepNumber === null || stepNumber !== currentStepNumber) {
      if (currentStepNumber !== null && stepNumber <= currentStepNumber)
        throw new TypeError(
          `${path} must follow cameras grouped by strictly increasing compiled step number.`,
        );
      if (maskRoleBaseOffset + localMaskOffset !== maskOffset)
        throw new TypeError("Camera evidence writer lost exact local-to-global mask closure.");
      currentStepNumber = stepNumber;
      maskRoleBaseOffset = maskOffset;
      localMaskOffset = 0;
      retainedMasksByContent = new Map<string, RetainedMask[]>();
      sourcesById = new Map<string, RetainedSource>();
    }
    const canonical = snapshotBytes(
      field(input, "canonicalDocumentBytes", path),
      MAXIMUM_REAL_BUILD_BROWSER_CAMERA_EVIDENCE_ROLE_BYTES,
      `${path}.canonicalDocumentBytes`,
      seenBuffers,
    );
    const render = snapshotBytes(
      field(input, "renderRgba", path),
      MAXIMUM_REAL_BUILD_BROWSER_CAMERA_EVIDENCE_ROLE_BYTES,
      `${path}.renderRgba`,
      seenBuffers,
    );
    const source = snapshotBytes(
      field(input, "sourceMask", path),
      metadata.pixels,
      `${path}.sourceMask`,
      seenBuffers,
    );
    const excluded = snapshotBytes(
      field(input, "excludedMask", path),
      metadata.pixels,
      `${path}.excludedMask`,
      seenBuffers,
    );
    const candidate = snapshotBytes(
      field(input, "candidateMask", path),
      metadata.pixels,
      `${path}.candidateMask`,
      seenBuffers,
    );
    if (render.length !== metadata.pixels * 4)
      throw new RangeError(`${path}.renderRgba must contain exactly four bytes per pixel.`);
    if (
      source.length !== metadata.pixels ||
      excluded.length !== metadata.pixels ||
      candidate.length !== metadata.pixels
    )
      throw new RangeError(`${path} masks must contain exactly one unpacked byte per pixel.`);
    for (let pixel = 0; pixel < metadata.pixels; pixel += 1) {
      const derived = render[pixel * 4 + 3] === 0 ? 0 : 1;
      if (candidate[pixel] !== derived)
        throw new TypeError(
          `${path}.candidateMask disagrees with rendered alpha at pixel ${pixel}.`,
        );
    }
    const child = {
      candidateId: metadata.candidateId,
      documentHash: metadata.documentHash,
      canonicalBytesDigest: digestRealBuildBrowserCameraEvidenceBytes(canonical),
      canonicalByteLength: canonical.length,
    };
    const packedSource = packRealBuildCompiledBinaryMaskMsb(
      source,
      metadata.width,
      metadata.height,
    );
    const packedExcluded = packRealBuildCompiledBinaryMaskMsb(
      excluded,
      metadata.width,
      metadata.height,
    );
    const packedCandidate = packRealBuildCompiledBinaryMaskMsb(
      candidate,
      metadata.width,
      metadata.height,
    );
    const retainedSource = sourcesById.get(metadata.sourceId);
    let sourceMask: RealBuildCompiledObservationMaskReference;
    let excludedMask: RealBuildCompiledObservationMaskReference;
    if (retainedSource === undefined) {
      sourceMask = createRealBuildBrowserObservationMaskReference({
        offset: localMaskOffset,
        bytes: packedSource.length,
        digest: digestRealBuildBrowserCameraEvidenceBytes(packedSource),
        widthPx: metadata.width,
        heightPx: metadata.height,
      });
      localMaskOffset += packedSource.length;
      excludedMask = createRealBuildBrowserObservationMaskReference({
        offset: localMaskOffset,
        bytes: packedExcluded.length,
        digest: digestRealBuildBrowserCameraEvidenceBytes(packedExcluded),
        widthPx: metadata.width,
        heightPx: metadata.height,
      });
      localMaskOffset += packedExcluded.length;
    } else {
      if (
        !maskMatches(retainedSource.sourceMask, packedSource, metadata.width, metadata.height) ||
        !maskMatches(retainedSource.excludedMask, packedExcluded, metadata.width, metadata.height)
      )
        throw new TypeError(`${path}.sourceId reuses different exact source mask bytes.`);
      sourceMask = retainedSource.sourceMask.reference;
      excludedMask = retainedSource.excludedMask.reference;
    }
    const expectedSourceId = deriveRealBuildCompiledObservationSourceId({
      preparedRunInputDigest: metadata.preparedPanel.preparedRunInputDigest,
      preparedStepIdentity: metadata.preparedPanel.preparedStepIdentity,
      provisionalStepIdentity: metadata.preparedPanel.provisionalStepIdentity,
      observationMode: metadata.preparedPanel.observationMode,
      compiledThroughStepNumber: metadata.preparedPanel.compiledThroughStepNumber,
      registrationPanelStepNumber: metadata.preparedPanel.registrationPanelStepNumber,
      pageNumber: metadata.preparedPanel.pageNumber,
      panelDigest: metadata.preparedPanel.panelDigest,
      cropDigest: metadata.preparedPanel.cropDigest,
      sourceDescriptorDigest: metadata.preparedPanel.sourceDescriptorDigest,
      exclusionDescriptorDigest: metadata.preparedPanel.exclusionDescriptorDigest,
      metric: REAL_BUILD_COMPILED_OBSERVATION_METRIC,
      measure: metadata.preparedPanel.measure,
      sourceMask,
      excludedMask,
    });
    if (metadata.sourceId !== expectedSourceId)
      throw new TypeError(
        `${path}.sourceId does not bind the exact prepared source and mask references.`,
      );
    if (retainedSource === undefined) {
      const retainedSourceMask = { reference: sourceMask, bytes: packedSource };
      const retainedExcludedMask = { reference: excludedMask, bytes: packedExcluded };
      sourcesById.set(metadata.sourceId, {
        sourceMask: retainedSourceMask,
        excludedMask: retainedExcludedMask,
      });
      retainMask(retainedMasksByContent, retainedSourceMask);
      retainMask(retainedMasksByContent, retainedExcludedMask);
      maskChunks.push(packedSource, packedExcluded);
      maskOffset += packedSource.length + packedExcluded.length;
    }
    const fittedCameraDigest = deriveRealBuildBrowserFittedCameraDigest(metadata.fittedCamera);
    const d4CameraRecipeDigest = deriveRealBuildBrowserD4CameraRecipeDigest({
      sourceId: metadata.sourceId,
      child,
      preparedPanel: metadata.preparedPanel,
      fittedCamera: metadata.fittedCamera,
      fittedCameraDigest,
      lattice: metadata.lattice,
    });
    const renderReference: RealBuildBrowserCameraEvidenceRenderReference = {
      role: "d4-child-render-rgba-bytes",
      offset: renderOffset,
      bytes: render.length,
      digest: digestRealBuildBrowserCameraEvidenceBytes(render),
      encoding: "rgba8-top-left-row-major/1",
      widthPx: metadata.width,
      heightPx: metadata.height,
    };
    renderOffset += render.length;
    const rendererSnapshotDigest = deriveRealBuildBrowserRendererSnapshotDigest({
      child,
      d4CameraRecipeDigest,
      rendererInputs: metadata.rendererInputs,
      render: renderReference,
    });
    const newCandidateMask = createRealBuildBrowserObservationMaskReference({
      offset: localMaskOffset,
      bytes: packedCandidate.length,
      digest: digestRealBuildBrowserCameraEvidenceBytes(packedCandidate),
      widthPx: metadata.width,
      heightPx: metadata.height,
    });
    const reproduceCameraId = (
      reference: RealBuildCompiledObservationMaskReference,
    ): RealBuildCompiledObservationCameraId =>
      deriveRealBuildCompiledObservationCameraId({
        sourceId: expectedSourceId,
        candidateId: metadata.candidateId,
        documentHash: metadata.documentHash,
        d4CameraRecipeDigest,
        rendererSnapshotDigest,
        candidateMask: reference,
      });
    let candidateMask: RealBuildCompiledObservationMaskReference | undefined;
    let reproducedCameraId = reproduceCameraId(newCandidateMask);
    if (metadata.cameraId === reproducedCameraId) candidateMask = newCandidateMask;
    else {
      const retainedCandidates = retainedMasksByContent.get(maskContentKey(newCandidateMask)) ?? [];
      for (const retained of retainedCandidates) {
        maskReferenceTrials += 1;
        if (maskReferenceTrials > MAXIMUM_CAMERA_MASK_REFERENCE_TRIALS)
          throw new RangeError(
            `Camera evidence exceeds the aggregate ${MAXIMUM_CAMERA_MASK_REFERENCE_TRIALS}-reference alias search budget at ${path}.`,
          );
        if (!maskMatches(retained, packedCandidate, metadata.width, metadata.height)) continue;
        const expectedCameraId = reproduceCameraId(retained.reference);
        if (metadata.cameraId !== expectedCameraId) continue;
        candidateMask = retained.reference;
        reproducedCameraId = expectedCameraId;
        break;
      }
    }
    if (candidateMask === undefined || reproducedCameraId === undefined)
      throw new TypeError(
        `${path}.cameraId does not bind the exact child, D4 recipe, render, and candidate mask.`,
      );
    if (candidateMask === newCandidateMask) {
      const retainedCandidate = { reference: candidateMask, bytes: packedCandidate };
      retainMask(retainedMasksByContent, retainedCandidate);
      maskChunks.push(packedCandidate);
      maskOffset += packedCandidate.length;
      localMaskOffset += packedCandidate.length;
    }
    const registration = verifier.register({
      source: packedSource,
      excluded: packedExcluded,
      candidate: packedCandidate,
      width: metadata.width,
      height: metadata.height,
      measure: metadata.preparedPanel.measure,
      path,
    });
    const body = {
      sourceId: metadata.sourceId,
      cameraId: reproducedCameraId,
      child,
      preparedPanel: metadata.preparedPanel,
      fittedCamera: metadata.fittedCamera,
      fittedCameraDigest,
      lattice: metadata.lattice,
      d4CameraRecipeDigest,
      rendererInputs: metadata.rendererInputs,
      rendererSnapshotDigest,
      render: renderReference,
      maskExtraction: "rgba-alpha-nonzero/1" as const,
      maskRoleBaseOffset,
      sourceMask,
      excludedMask,
      candidateMask,
      registration,
    };
    rows.push({ evidenceId: deriveRealBuildBrowserCameraEvidenceId(body), ...body });
    renderChunks.push(render);
  }
  if (maskRoleBaseOffset + localMaskOffset !== maskOffset)
    throw new TypeError("Camera evidence writer lost exact terminal local-to-global mask closure.");
  const renderRoleBytes = append(renderChunks, renderOffset, "Camera render role");
  const maskRoleBytes = append(maskChunks, maskOffset, "Camera mask role");
  const absent = { status: "absent" as const, authorized: false as const };
  const manifest: RealBuildBrowserCameraEvidenceManifest = {
    schemaVersion: REAL_BUILD_BROWSER_CAMERA_EVIDENCE_SCHEMA_VERSION,
    renderRole: {
      role: "d4-child-render-rgba-bytes",
      bytes: renderRoleBytes.length,
      digest: digestRealBuildBrowserCameraEvidenceBytes(renderRoleBytes),
    },
    maskRole: {
      role: "branch-observation-bytes",
      bytes: maskRoleBytes.length,
      digest: digestRealBuildBrowserCameraEvidenceBytes(maskRoleBytes),
    },
    rows,
    provisionalAuthority: absent,
    sourceExecutionProvenanceAuthority: absent,
    physicalAuthority: absent,
    placementAuthority: absent,
    completionAuthority: absent,
  };
  const manifestBytes = encodeRealBuildSafeJson(manifest);
  if (manifestBytes.length > MAXIMUM_REAL_BUILD_BROWSER_CAMERA_EVIDENCE_INDEX_BYTES)
    throw new RangeError(
      `Camera evidence manifest contains ${manifestBytes.length} bytes; maximum is ${MAXIMUM_REAL_BUILD_BROWSER_CAMERA_EVIDENCE_INDEX_BYTES}.`,
    );
  if (
    manifestBytes.length + renderRoleBytes.length + maskRoleBytes.length >
    MAXIMUM_REAL_BUILD_BROWSER_CAMERA_EVIDENCE_TOTAL_BYTES
  )
    throw new RangeError(
      `Camera evidence exceeds the aggregate ${MAXIMUM_REAL_BUILD_BROWSER_CAMERA_EVIDENCE_TOTAL_BYTES}-byte retained-evidence cap.`,
    );
  return { manifestBytes, renderRoleBytes, maskRoleBytes };
}
