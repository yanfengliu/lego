import type { RealBuildCompiledObservationMaskReference } from "./real-build-compiled-observation-closure-types";
import { MAXIMUM_REAL_BUILD_COMPILED_OBSERVATION_RASTER_PIXELS } from "./real-build-compiled-observation-closure-types";
import {
  MAXIMUM_REAL_BUILD_BROWSER_CAMERA_EVIDENCE_ROLE_BYTES,
  type RealBuildBrowserCameraEvidenceChild,
  type RealBuildBrowserCameraEvidenceFittedCamera,
  type RealBuildBrowserCameraEvidenceLattice,
  type RealBuildBrowserCameraEvidencePreparedPanel,
  type RealBuildBrowserCameraEvidenceRegistration,
  type RealBuildBrowserCameraEvidenceRenderReference,
  type RealBuildBrowserCameraEvidenceRendererInputs,
} from "./real-build-browser-output-v4-camera-evidence-types";
import {
  digest,
  exact,
  identifier,
  integer,
  number,
} from "./real-build-browser-output-v4-camera-evidence-reader-primitives";

const SAFE_ARRAY_IS_ARRAY = Array.isArray;
const SAFE_REFLECT_APPLY = Reflect.apply;
const SAFE_TYPED_ARRAY_SLICE = Uint8Array.prototype.slice;
const CANDIDATE_PATTERN = /^document:sha256:[0-9a-f]{64}$/u;

export function child(value: unknown, path: string): RealBuildBrowserCameraEvidenceChild {
  const row = exact(value, path, [
    "candidateId",
    "documentHash",
    "canonicalBytesDigest",
    "canonicalByteLength",
  ]);
  return {
    candidateId: identifier(
      row.candidateId,
      CANDIDATE_PATTERN,
      `${path}.candidateId`,
    ) as RealBuildBrowserCameraEvidenceChild["candidateId"],
    documentHash: digest(row.documentHash, `${path}.documentHash`),
    canonicalBytesDigest: digest(row.canonicalBytesDigest, `${path}.canonicalBytesDigest`),
    canonicalByteLength: integer(
      row.canonicalByteLength,
      `${path}.canonicalByteLength`,
      1,
      MAXIMUM_REAL_BUILD_BROWSER_CAMERA_EVIDENCE_ROLE_BYTES,
    ),
  };
}

export function prepared(
  value: unknown,
  path: string,
): RealBuildBrowserCameraEvidencePreparedPanel {
  const row = exact(value, path, [
    "preparedRunInputDigest",
    "preparedStepIdentity",
    "provisionalStepIdentity",
    "observationMode",
    "compiledThroughStepNumber",
    "registrationPanelStepNumber",
    "pageNumber",
    "panelDigest",
    "cropDigest",
    "sourceDescriptorDigest",
    "exclusionDescriptorDigest",
    "crop",
    "face",
    "measure",
  ]);
  const cropRow = exact(row.crop, `${path}.crop`, ["minXPt", "maxXPt", "minYPt", "maxYPt"]);
  const crop = {
    minXPt: number(cropRow.minXPt, `${path}.crop.minXPt`),
    maxXPt: number(cropRow.maxXPt, `${path}.crop.maxXPt`),
    minYPt: number(cropRow.minYPt, `${path}.crop.minYPt`),
    maxYPt: number(cropRow.maxYPt, `${path}.crop.maxYPt`),
  };
  if (crop.minXPt >= crop.maxXPt || crop.minYPt >= crop.maxYPt)
    throw new RangeError(`${path}.crop must have positive extent.`);
  if (row.observationMode !== "own-panel" && row.observationMode !== "lookahead")
    throw new TypeError(`${path}.observationMode is invalid.`);
  if (row.face !== "studs-up" && row.face !== "underside")
    throw new TypeError(`${path}.face is invalid.`);
  if (row.measure !== "iou" && row.measure !== "containment")
    throw new TypeError(`${path}.measure is invalid.`);
  return {
    preparedRunInputDigest: digest(row.preparedRunInputDigest, `${path}.preparedRunInputDigest`),
    preparedStepIdentity: digest(row.preparedStepIdentity, `${path}.preparedStepIdentity`),
    provisionalStepIdentity: digest(row.provisionalStepIdentity, `${path}.provisionalStepIdentity`),
    observationMode: row.observationMode,
    compiledThroughStepNumber: integer(
      row.compiledThroughStepNumber,
      `${path}.compiledThroughStepNumber`,
    ),
    registrationPanelStepNumber: integer(
      row.registrationPanelStepNumber,
      `${path}.registrationPanelStepNumber`,
      1,
    ),
    pageNumber: integer(row.pageNumber, `${path}.pageNumber`, 1),
    panelDigest: digest(row.panelDigest, `${path}.panelDigest`),
    cropDigest: digest(row.cropDigest, `${path}.cropDigest`),
    sourceDescriptorDigest: digest(row.sourceDescriptorDigest, `${path}.sourceDescriptorDigest`),
    exclusionDescriptorDigest: digest(
      row.exclusionDescriptorDigest,
      `${path}.exclusionDescriptorDigest`,
    ),
    crop,
    face: row.face,
    measure: row.measure,
  };
}

export function fitted(value: unknown, path: string): RealBuildBrowserCameraEvidenceFittedCamera {
  const keys = [
    "azimuthDegrees",
    "elevationDegrees",
    "pixelsPerUnit",
    "residualPx",
    "coherence",
    "centerXPx",
    "centerYPx",
  ] as const;
  const row = exact(value, path, keys);
  const result = {
    azimuthDegrees: number(row.azimuthDegrees, `${path}.azimuthDegrees`),
    elevationDegrees: number(row.elevationDegrees, `${path}.elevationDegrees`),
    pixelsPerUnit: number(row.pixelsPerUnit, `${path}.pixelsPerUnit`),
    residualPx: number(row.residualPx, `${path}.residualPx`),
    coherence: number(row.coherence, `${path}.coherence`),
    centerXPx: number(row.centerXPx, `${path}.centerXPx`),
    centerYPx: number(row.centerYPx, `${path}.centerYPx`),
  };
  if (result.pixelsPerUnit <= 0 || result.coherence < 0 || result.coherence > 1)
    throw new RangeError(`${path} has invalid scale or coherence.`);
  return result;
}

export function lattice(value: unknown, path: string): RealBuildBrowserCameraEvidenceLattice {
  const row = exact(value, path, ["hand", "determinant", "turnDegrees"]);
  if (row.hand !== "as-fitted" && row.hand !== "x-reflected")
    throw new TypeError(`${path}.hand is invalid.`);
  const determinant = integer(row.determinant, `${path}.determinant`, -1, 1);
  if ((row.hand === "as-fitted" ? 1 : -1) !== determinant)
    throw new TypeError(`${path} hand and determinant disagree.`);
  const turn = integer(row.turnDegrees, `${path}.turnDegrees`, 0, 270);
  if (turn !== 0 && turn !== 90 && turn !== 180 && turn !== 270)
    throw new TypeError(`${path}.turnDegrees is invalid.`);
  return {
    hand: row.hand,
    determinant: determinant as 1 | -1,
    turnDegrees: turn as 0 | 90 | 180 | 270,
  };
}

export function renderer(
  value: unknown,
  path: string,
): RealBuildBrowserCameraEvidenceRendererInputs {
  const row = exact(value, path, [
    "renderer",
    "rendererVersion",
    "widthPx",
    "heightPx",
    "pixelRatio",
    "backgroundRgba",
    "colorSpace",
    "antialias",
    "alpha",
    "preserveDrawingBuffer",
    "cameraProjection",
    "viewMatrix",
    "projectionMatrix",
    "cameraNear",
    "cameraFar",
    "sceneSnapshotDigest",
  ]);
  if (
    row.renderer !== "three-webgl" ||
    typeof row.rendererVersion !== "string" ||
    row.rendererVersion.length < 1 ||
    row.rendererVersion.length > 128
  )
    throw new TypeError(`${path} renderer identity is invalid.`);
  if (
    row.pixelRatio !== 1 ||
    row.colorSpace !== "srgb" ||
    typeof row.antialias !== "boolean" ||
    row.alpha !== true ||
    row.preserveDrawingBuffer !== true ||
    row.cameraProjection !== "perspective"
  )
    throw new TypeError(`${path} is not the exact supported renderer snapshot contract.`);
  if (!SAFE_ARRAY_IS_ARRAY(row.backgroundRgba) || row.backgroundRgba.length !== 4)
    throw new TypeError(`${path}.backgroundRgba must contain four bytes.`);
  const background: [number, number, number, number] = [
    integer(row.backgroundRgba[0], `${path}.backgroundRgba[0]`, 0, 255),
    integer(row.backgroundRgba[1], `${path}.backgroundRgba[1]`, 0, 255),
    integer(row.backgroundRgba[2], `${path}.backgroundRgba[2]`, 0, 255),
    integer(row.backgroundRgba[3], `${path}.backgroundRgba[3]`, 0, 255),
  ];
  if (
    !SAFE_ARRAY_IS_ARRAY(row.viewMatrix) ||
    row.viewMatrix.length !== 16 ||
    !SAFE_ARRAY_IS_ARRAY(row.projectionMatrix) ||
    row.projectionMatrix.length !== 16
  )
    throw new TypeError(`${path} camera matrices must each contain exactly 16 finite entries.`);
  const viewMatrix: number[] = [];
  const projectionMatrix: number[] = [];
  for (let index = 0; index < 16; index += 1) {
    viewMatrix[index] = number(row.viewMatrix[index], `${path}.viewMatrix[${index}]`);
    projectionMatrix[index] = number(
      row.projectionMatrix[index],
      `${path}.projectionMatrix[${index}]`,
    );
  }
  const cameraNear = number(row.cameraNear, `${path}.cameraNear`);
  const cameraFar = number(row.cameraFar, `${path}.cameraFar`);
  if (cameraNear <= 0 || cameraFar <= cameraNear)
    throw new RangeError(`${path} camera planes are invalid.`);
  return {
    renderer: "three-webgl",
    rendererVersion: row.rendererVersion,
    widthPx: integer(row.widthPx, `${path}.widthPx`, 1),
    heightPx: integer(row.heightPx, `${path}.heightPx`, 1),
    pixelRatio: 1,
    backgroundRgba: background,
    colorSpace: "srgb",
    antialias: row.antialias,
    alpha: true,
    preserveDrawingBuffer: true,
    cameraProjection: "perspective",
    viewMatrix,
    projectionMatrix,
    cameraNear,
    cameraFar,
    sceneSnapshotDigest: digest(row.sceneSnapshotDigest, `${path}.sceneSnapshotDigest`),
  };
}

export function maskReference(
  value: unknown,
  path: string,
): RealBuildCompiledObservationMaskReference {
  const row = exact(value, path, [
    "role",
    "offset",
    "bytes",
    "digest",
    "encoding",
    "widthPx",
    "heightPx",
  ]);
  if (row.role !== "branch-observation-bytes" || row.encoding !== "packed-binary-mask-msb/1")
    throw new TypeError(`${path} role or encoding is invalid.`);
  return {
    role: "branch-observation-bytes",
    offset: integer(
      row.offset,
      `${path}.offset`,
      0,
      MAXIMUM_REAL_BUILD_BROWSER_CAMERA_EVIDENCE_ROLE_BYTES,
    ),
    bytes: integer(
      row.bytes,
      `${path}.bytes`,
      1,
      MAXIMUM_REAL_BUILD_BROWSER_CAMERA_EVIDENCE_ROLE_BYTES,
    ),
    digest: digest(row.digest, `${path}.digest`),
    encoding: "packed-binary-mask-msb/1",
    widthPx: integer(row.widthPx, `${path}.widthPx`, 1),
    heightPx: integer(row.heightPx, `${path}.heightPx`, 1),
  };
}

export function renderReference(
  value: unknown,
  path: string,
): RealBuildBrowserCameraEvidenceRenderReference {
  const row = exact(value, path, [
    "role",
    "offset",
    "bytes",
    "digest",
    "encoding",
    "widthPx",
    "heightPx",
  ]);
  if (row.role !== "d4-child-render-rgba-bytes" || row.encoding !== "rgba8-top-left-row-major/1")
    throw new TypeError(`${path} role or encoding is invalid.`);
  return {
    role: "d4-child-render-rgba-bytes",
    offset: integer(
      row.offset,
      `${path}.offset`,
      0,
      MAXIMUM_REAL_BUILD_BROWSER_CAMERA_EVIDENCE_ROLE_BYTES,
    ),
    bytes: integer(
      row.bytes,
      `${path}.bytes`,
      1,
      MAXIMUM_REAL_BUILD_BROWSER_CAMERA_EVIDENCE_ROLE_BYTES,
    ),
    digest: digest(row.digest, `${path}.digest`),
    encoding: "rgba8-top-left-row-major/1",
    widthPx: integer(row.widthPx, `${path}.widthPx`, 1),
    heightPx: integer(row.heightPx, `${path}.heightPx`, 1),
  };
}

export function registration(
  value: unknown,
  path: string,
): RealBuildBrowserCameraEvidenceRegistration {
  const row = exact(value, path, [
    "score",
    "shiftPx",
    "sourcePixels",
    "intersectionPixels",
    "denominatorPixels",
  ]);
  if (!SAFE_ARRAY_IS_ARRAY(row.shiftPx) || row.shiftPx.length !== 2)
    throw new TypeError(`${path}.shiftPx must contain two integers.`);
  const score = number(row.score, `${path}.score`);
  if (score < 0 || score > 1) throw new RangeError(`${path}.score must be from zero through one.`);
  return {
    score,
    shiftPx: [
      integer(
        row.shiftPx[0],
        `${path}.shiftPx[0]`,
        -MAXIMUM_REAL_BUILD_COMPILED_OBSERVATION_RASTER_PIXELS,
      ),
      integer(
        row.shiftPx[1],
        `${path}.shiftPx[1]`,
        -MAXIMUM_REAL_BUILD_COMPILED_OBSERVATION_RASTER_PIXELS,
      ),
    ],
    sourcePixels: integer(row.sourcePixels, `${path}.sourcePixels`),
    intersectionPixels: integer(row.intersectionPixels, `${path}.intersectionPixels`),
    denominatorPixels: integer(row.denominatorPixels, `${path}.denominatorPixels`),
  };
}

export function slice(bytes: Uint8Array, offset: number, length: number, path: string): Uint8Array {
  if (offset + length > bytes.length) throw new RangeError(`${path} exceeds its role.`);
  return SAFE_REFLECT_APPLY(SAFE_TYPED_ARRAY_SLICE, bytes, [offset, offset + length]) as Uint8Array;
}

export function equalBytes(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) return false;
  for (let index = 0; index < left.length; index += 1)
    if (left[index] !== right[index]) return false;
  return true;
}

export function authority(
  value: unknown,
  path: string,
): { readonly status: "absent"; readonly authorized: false } {
  const row = exact(value, path, ["status", "authorized"]);
  if (row.status !== "absent" || row.authorized !== false)
    throw new TypeError(`${path} must remain explicitly absent.`);
  return { status: "absent", authorized: false };
}
