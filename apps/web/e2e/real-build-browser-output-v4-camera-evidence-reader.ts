import {
  deriveRealBuildCompiledObservationCameraId,
  deriveRealBuildCompiledObservationSourceId,
} from "./real-build-compiled-observation-closure-digest";
import {
  MAXIMUM_REAL_BUILD_COMPILED_OBSERVATION_PIXEL_VISITS,
  MAXIMUM_REAL_BUILD_COMPILED_OBSERVATION_RASTER_PIXELS,
  REAL_BUILD_COMPILED_OBSERVATION_METRIC,
} from "./real-build-compiled-observation-closure-types";
import {
  createRealBuildCompiledObservationRegistrationVerifier,
  packRealBuildCompiledBinaryMaskMsb,
  realBuildCompiledObservationRegistrationVisits,
  unpackRealBuildCompiledBinaryMaskMsb,
} from "./real-build-compiled-observation-registration";
import { createIntrinsicUint8Array } from "./real-build-hostile-uint8array";
import { intrinsicRealBuildFreeze } from "./real-build-intrinsic-freeze";
import {
  deriveRealBuildBrowserCameraEvidenceId,
  deriveRealBuildBrowserD4CameraRecipeDigest,
  deriveRealBuildBrowserFittedCameraDigest,
  deriveRealBuildBrowserRendererSnapshotDigest,
  digestRealBuildBrowserCameraEvidenceBytes,
} from "./real-build-browser-output-v4-camera-evidence-digest";
import {
  CAMERA_PATTERN,
  EVIDENCE_PATTERN,
  exact,
  identifier,
  integer,
  parseRealBuildBrowserCameraEvidenceInput,
  SOURCE_PATTERN,
} from "./real-build-browser-output-v4-camera-evidence-reader-primitives";
import {
  authority,
  child,
  equalBytes,
  fitted,
  lattice,
  maskReference,
  prepared,
  registration,
  renderer,
  renderReference,
  slice,
} from "./real-build-browser-output-v4-camera-evidence-reader-row-primitives";
import {
  MAXIMUM_REAL_BUILD_BROWSER_CAMERA_EVIDENCE_ROWS,
  REAL_BUILD_BROWSER_CAMERA_EVIDENCE_SCHEMA_VERSION,
  type RealBuildBrowserCameraEvidenceBytes,
  type RealBuildBrowserCameraEvidenceInspection,
  type RealBuildBrowserCameraEvidenceManifest,
  type RealBuildBrowserCameraEvidenceRow,
} from "./real-build-browser-output-v4-camera-evidence-types";
import { preflightRealBuildBrowserCameraEvidenceRoleLayout } from "./real-build-browser-output-v4-camera-evidence-role-layout";

const SAFE_ARRAY_IS_ARRAY = Array.isArray;
const SAFE_OBJECT_HAS_OWN = Object.hasOwn;
const SAFE_OBJECT_KEYS = Object.keys;
const SAFE_REFLECT_APPLY = Reflect.apply;
const SAFE_WEAK_SET_ADD = WeakSet.prototype.add;
const SAFE_WEAK_SET_HAS = WeakSet.prototype.has;
const VERIFIED_CAMERA_EVIDENCE_INSPECTIONS = new WeakSet<object>();

export function requireRealBuildBrowserCameraEvidenceInspection(
  value: unknown,
): RealBuildBrowserCameraEvidenceInspection {
  if (
    value === null ||
    typeof value !== "object" ||
    !SAFE_REFLECT_APPLY(SAFE_WEAK_SET_HAS, VERIFIED_CAMERA_EVIDENCE_INSPECTIONS, [value])
  )
    throw new TypeError(
      "Camera evidence inspection must be the exact privately branded result of the camera evidence reader.",
    );
  return value as RealBuildBrowserCameraEvidenceInspection;
}

function deepFreezeCameraEvidence(value: unknown): unknown {
  if (value === null || typeof value !== "object") return value;
  const record = value as Record<string, unknown>;
  const keys = SAFE_OBJECT_KEYS(record);
  for (let index = 0; index < keys.length; index += 1)
    deepFreezeCameraEvidence(record[keys[index]!] as unknown);
  return intrinsicRealBuildFreeze(value);
}

export function readRealBuildBrowserCameraEvidence(
  input: RealBuildBrowserCameraEvidenceBytes,
): RealBuildBrowserCameraEvidenceInspection {
  const { root, renderBytes, maskBytes, renderRole, maskRole } =
    parseRealBuildBrowserCameraEvidenceInput(input);
  if (
    !SAFE_ARRAY_IS_ARRAY(root.rows) ||
    root.rows.length < 0 ||
    root.rows.length > MAXIMUM_REAL_BUILD_BROWSER_CAMERA_EVIDENCE_ROWS
  )
    throw new RangeError("Camera evidence rows must be a bounded dense array.");
  preflightRealBuildBrowserCameraEvidenceRoleLayout(
    root.rows,
    renderBytes.length,
    maskBytes.length,
  );
  const rows: RealBuildBrowserCameraEvidenceRow[] = [];
  const verifier = createRealBuildCompiledObservationRegistrationVerifier(
    MAXIMUM_REAL_BUILD_COMPILED_OBSERVATION_PIXEL_VISITS,
  );
  let visits = 0;
  for (let index = 0; index < root.rows.length; index += 1) {
    if (!SAFE_OBJECT_HAS_OWN(root.rows, String(index)))
      throw new TypeError(`manifest.rows[${index}] is not dense.`);
    const path = `manifest.rows[${index}]`;
    const raw = exact(root.rows[index], path, [
      "evidenceId",
      "sourceId",
      "cameraId",
      "child",
      "preparedPanel",
      "fittedCamera",
      "fittedCameraDigest",
      "lattice",
      "d4CameraRecipeDigest",
      "rendererInputs",
      "rendererSnapshotDigest",
      "render",
      "maskExtraction",
      "maskRoleBaseOffset",
      "sourceMask",
      "excludedMask",
      "candidateMask",
      "registration",
    ]);
    const sourceId = identifier(
      raw.sourceId,
      SOURCE_PATTERN,
      `${path}.sourceId`,
    ) as RealBuildBrowserCameraEvidenceRow["sourceId"];
    const cameraId = identifier(
      raw.cameraId,
      CAMERA_PATTERN,
      `${path}.cameraId`,
    ) as RealBuildBrowserCameraEvidenceRow["cameraId"];
    const parsedChild = child(raw.child, `${path}.child`);
    const panel = prepared(raw.preparedPanel, `${path}.preparedPanel`);
    const camera = fitted(raw.fittedCamera, `${path}.fittedCamera`);
    const parsedLattice = lattice(raw.lattice, `${path}.lattice`);
    const rendererInputs = renderer(raw.rendererInputs, `${path}.rendererInputs`);
    const renderRef = renderReference(raw.render, `${path}.render`);
    const sourceMask = maskReference(raw.sourceMask, `${path}.sourceMask`);
    const excludedMask = maskReference(raw.excludedMask, `${path}.excludedMask`);
    const candidateMask = maskReference(raw.candidateMask, `${path}.candidateMask`);
    const maskRoleBaseOffset = integer(
      raw.maskRoleBaseOffset,
      `${path}.maskRoleBaseOffset`,
      0,
      maskBytes.length,
    );
    const claimedRegistration = registration(raw.registration, `${path}.registration`);
    if (raw.maskExtraction !== "rgba-alpha-nonzero/1")
      throw new TypeError(`${path}.maskExtraction is invalid.`);
    const pixels = rendererInputs.widthPx * rendererInputs.heightPx;
    if (
      !Number.isSafeInteger(pixels) ||
      pixels > MAXIMUM_REAL_BUILD_COMPILED_OBSERVATION_RASTER_PIXELS
    )
      throw new RangeError(`${path} raster exceeds the observation bound.`);
    if (
      renderRef.widthPx !== rendererInputs.widthPx ||
      renderRef.heightPx !== rendererInputs.heightPx ||
      renderRef.bytes !== pixels * 4
    )
      throw new TypeError(`${path}.render does not match renderer dimensions.`);
    const expectedPacked = Math.ceil(pixels / 8);
    for (const ref of [sourceMask, excludedMask, candidateMask])
      if (
        ref.widthPx !== rendererInputs.widthPx ||
        ref.heightPx !== rendererInputs.heightPx ||
        ref.bytes !== expectedPacked
      )
        throw new TypeError(`${path} mask dimensions or byte length are invalid.`);
    const rgba = slice(renderBytes, renderRef.offset, renderRef.bytes, `${path}.render`);
    const packedSource = slice(
      maskBytes,
      maskRoleBaseOffset + sourceMask.offset,
      sourceMask.bytes,
      `${path}.sourceMask`,
    );
    const packedExcluded = slice(
      maskBytes,
      maskRoleBaseOffset + excludedMask.offset,
      excludedMask.bytes,
      `${path}.excludedMask`,
    );
    const packedCandidate = slice(
      maskBytes,
      maskRoleBaseOffset + candidateMask.offset,
      candidateMask.bytes,
      `${path}.candidateMask`,
    );
    if (
      renderRef.digest !== digestRealBuildBrowserCameraEvidenceBytes(rgba) ||
      sourceMask.digest !== digestRealBuildBrowserCameraEvidenceBytes(packedSource) ||
      excludedMask.digest !== digestRealBuildBrowserCameraEvidenceBytes(packedExcluded) ||
      candidateMask.digest !== digestRealBuildBrowserCameraEvidenceBytes(packedCandidate)
    )
      throw new TypeError(`${path} contains a role-slice digest mismatch.`);
    const canonicalSource = packRealBuildCompiledBinaryMaskMsb(
      unpackRealBuildCompiledBinaryMaskMsb(
        packedSource,
        rendererInputs.widthPx,
        rendererInputs.heightPx,
      ),
      rendererInputs.widthPx,
      rendererInputs.heightPx,
    );
    const canonicalExcluded = packRealBuildCompiledBinaryMaskMsb(
      unpackRealBuildCompiledBinaryMaskMsb(
        packedExcluded,
        rendererInputs.widthPx,
        rendererInputs.heightPx,
      ),
      rendererInputs.widthPx,
      rendererInputs.heightPx,
    );
    if (
      !equalBytes(canonicalSource, packedSource) ||
      !equalBytes(canonicalExcluded, packedExcluded)
    )
      throw new TypeError(`${path} source masks are not canonical packed masks.`);
    const derivedCandidate = createIntrinsicUint8Array(pixels);
    for (let pixel = 0; pixel < pixels; pixel += 1)
      derivedCandidate[pixel] = rgba[pixel * 4 + 3] === 0 ? 0 : 1;
    const repackedCandidate = packRealBuildCompiledBinaryMaskMsb(
      derivedCandidate,
      rendererInputs.widthPx,
      rendererInputs.heightPx,
    );
    if (!equalBytes(repackedCandidate, packedCandidate))
      throw new TypeError(`${path}.candidateMask does not reproduce rendered alpha.`);
    const expectedSourceId = deriveRealBuildCompiledObservationSourceId({
      preparedRunInputDigest: panel.preparedRunInputDigest,
      preparedStepIdentity: panel.preparedStepIdentity,
      provisionalStepIdentity: panel.provisionalStepIdentity,
      observationMode: panel.observationMode,
      compiledThroughStepNumber: panel.compiledThroughStepNumber,
      registrationPanelStepNumber: panel.registrationPanelStepNumber,
      pageNumber: panel.pageNumber,
      panelDigest: panel.panelDigest,
      cropDigest: panel.cropDigest,
      sourceDescriptorDigest: panel.sourceDescriptorDigest,
      exclusionDescriptorDigest: panel.exclusionDescriptorDigest,
      metric: REAL_BUILD_COMPILED_OBSERVATION_METRIC,
      measure: panel.measure,
      sourceMask,
      excludedMask,
    });
    if (sourceId !== expectedSourceId)
      throw new TypeError(`${path}.sourceId does not reproduce from its exact source commitment.`);
    const fittedCameraDigest = deriveRealBuildBrowserFittedCameraDigest(camera);
    if (raw.fittedCameraDigest !== fittedCameraDigest)
      throw new TypeError(`${path}.fittedCameraDigest is invalid.`);
    const d4CameraRecipeDigest = deriveRealBuildBrowserD4CameraRecipeDigest({
      sourceId,
      child: parsedChild,
      preparedPanel: panel,
      fittedCamera: camera,
      fittedCameraDigest,
      lattice: parsedLattice,
    });
    if (raw.d4CameraRecipeDigest !== d4CameraRecipeDigest)
      throw new TypeError(`${path}.d4CameraRecipeDigest is invalid.`);
    const rendererSnapshotDigest = deriveRealBuildBrowserRendererSnapshotDigest({
      child: parsedChild,
      d4CameraRecipeDigest,
      rendererInputs,
      render: renderRef,
    });
    if (raw.rendererSnapshotDigest !== rendererSnapshotDigest)
      throw new TypeError(`${path}.rendererSnapshotDigest is invalid.`);
    const expectedCameraId = deriveRealBuildCompiledObservationCameraId({
      sourceId,
      candidateId: parsedChild.candidateId,
      documentHash: parsedChild.documentHash,
      d4CameraRecipeDigest,
      rendererSnapshotDigest,
      candidateMask,
    });
    if (cameraId !== expectedCameraId)
      throw new TypeError(`${path}.cameraId does not reproduce from its exact camera commitment.`);
    visits += realBuildCompiledObservationRegistrationVisits(
      rendererInputs.widthPx,
      rendererInputs.heightPx,
    );
    if (visits > MAXIMUM_REAL_BUILD_COMPILED_OBSERVATION_PIXEL_VISITS)
      throw new RangeError(
        `Camera evidence exceeds the bounded registration work budget at ${path}.`,
      );
    const reproduced = verifier.register({
      source: packedSource,
      excluded: packedExcluded,
      candidate: packedCandidate,
      width: rendererInputs.widthPx,
      height: rendererInputs.heightPx,
      measure: panel.measure,
      path,
    });
    if (
      reproduced.score !== claimedRegistration.score ||
      reproduced.shiftPx[0] !== claimedRegistration.shiftPx[0] ||
      reproduced.shiftPx[1] !== claimedRegistration.shiftPx[1] ||
      reproduced.sourcePixels !== claimedRegistration.sourcePixels ||
      reproduced.intersectionPixels !== claimedRegistration.intersectionPixels ||
      reproduced.denominatorPixels !== claimedRegistration.denominatorPixels
    )
      throw new TypeError(`${path}.registration does not reproduce exactly.`);
    const body = {
      sourceId,
      cameraId,
      child: parsedChild,
      preparedPanel: panel,
      fittedCamera: camera,
      fittedCameraDigest,
      lattice: parsedLattice,
      d4CameraRecipeDigest,
      rendererInputs,
      rendererSnapshotDigest,
      render: renderRef,
      maskExtraction: "rgba-alpha-nonzero/1" as const,
      maskRoleBaseOffset,
      sourceMask,
      excludedMask,
      candidateMask,
      registration: claimedRegistration,
    };
    const evidenceId = identifier(
      raw.evidenceId,
      EVIDENCE_PATTERN,
      `${path}.evidenceId`,
    ) as RealBuildBrowserCameraEvidenceRow["evidenceId"];
    if (evidenceId !== deriveRealBuildBrowserCameraEvidenceId(body))
      throw new TypeError(`${path}.evidenceId is invalid.`);
    rows.push({ evidenceId, ...body });
  }
  const manifest: RealBuildBrowserCameraEvidenceManifest = {
    schemaVersion: REAL_BUILD_BROWSER_CAMERA_EVIDENCE_SCHEMA_VERSION,
    renderRole: renderRole as RealBuildBrowserCameraEvidenceManifest["renderRole"],
    maskRole: maskRole as RealBuildBrowserCameraEvidenceManifest["maskRole"],
    rows,
    provisionalAuthority: authority(root.provisionalAuthority, "manifest.provisionalAuthority"),
    sourceExecutionProvenanceAuthority: authority(
      root.sourceExecutionProvenanceAuthority,
      "manifest.sourceExecutionProvenanceAuthority",
    ),
    physicalAuthority: authority(root.physicalAuthority, "manifest.physicalAuthority"),
    placementAuthority: authority(root.placementAuthority, "manifest.placementAuthority"),
    completionAuthority: authority(root.completionAuthority, "manifest.completionAuthority"),
  };
  const frozenManifest = deepFreezeCameraEvidence(
    manifest,
  ) as RealBuildBrowserCameraEvidenceManifest;
  const inspection = intrinsicRealBuildFreeze({
    manifest: frozenManifest,
    reproducible: true as const,
    provenanceAuthority: "absent" as const,
    provisionalAuthority: "absent" as const,
    sourceExecutionProvenanceAuthority: "absent" as const,
    physicalAuthority: "absent" as const,
    placementAuthority: "absent" as const,
    completionAuthority: "absent" as const,
  });
  SAFE_REFLECT_APPLY(SAFE_WEAK_SET_ADD, VERIFIED_CAMERA_EVIDENCE_INSPECTIONS, [inspection]);
  return inspection;
}
