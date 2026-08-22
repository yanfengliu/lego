import type { Sha256Digest } from "@lego-studio/brick-kernel";
import { isProxy } from "node:util/types";

import type { RealBuildDocumentCandidateId } from "./real-build-candidate-lineage-identity";
import { MAXIMUM_REAL_BUILD_COMPILED_OBSERVATION_RASTER_PIXELS } from "./real-build-compiled-observation-closure-types";
import {
  createIntrinsicUint8Array,
  inspectHostileUint8ArrayLength,
  setIntrinsicUint8Array,
  snapshotHostileUint8Array,
} from "./real-build-hostile-uint8array";
import {
  MAXIMUM_REAL_BUILD_BROWSER_CAMERA_EVIDENCE_ROLE_BYTES,
  type RealBuildBrowserCameraEvidenceInput,
} from "./real-build-browser-output-v4-camera-evidence-types";

const SAFE_ARRAY_IS_ARRAY = Array.isArray;
const SAFE_GET_OWN_PROPERTY_DESCRIPTOR = Object.getOwnPropertyDescriptor;
const SAFE_OBJECT_KEYS = Object.keys;
const SAFE_OBJECT_ENTRIES = Object.entries;
const SAFE_OBJECT_HAS_OWN = Object.hasOwn;
const SAFE_TYPED_ARRAY_BUFFER = Object.getOwnPropertyDescriptor(
  Object.getPrototypeOf(Uint8Array.prototype) as object,
  "buffer",
)?.get;
const SAFE_REFLECT_APPLY = Reflect.apply;
const DIGEST_PATTERN = /^sha256:[0-9a-f]{64}$/u;
const SOURCE_PATTERN = /^compiled-observation-source:sha256:[0-9a-f]{64}$/u;
const CAMERA_PATTERN = /^compiled-observation-camera:sha256:[0-9a-f]{64}$/u;
const CANDIDATE_PATTERN = /^document:sha256:[0-9a-f]{64}$/u;

export function field(record: unknown, key: string, path: string): unknown {
  if (
    record === null ||
    typeof record !== "object" ||
    isProxy(record) ||
    SAFE_ARRAY_IS_ARRAY(record)
  ) {
    throw new TypeError(`${path} must be a non-Proxy object containing own data fields.`);
  }
  const descriptor = SAFE_GET_OWN_PROPERTY_DESCRIPTOR(record, key);
  if (descriptor === undefined || !("value" in descriptor) || !descriptor.enumerable) {
    throw new TypeError(`${path}.${key} must be an enumerable own data field.`);
  }
  return descriptor.value;
}

export function exactKeys(record: unknown, keys: readonly string[], path: string): void {
  if (
    record === null ||
    typeof record !== "object" ||
    isProxy(record) ||
    SAFE_ARRAY_IS_ARRAY(record)
  ) {
    throw new TypeError(`${path} must be a non-Proxy object.`);
  }
  const actual = SAFE_OBJECT_KEYS(record);
  if (actual.length !== keys.length) throw new TypeError(`${path} has unexpected fields.`);
  for (const key of keys) {
    const descriptor = SAFE_GET_OWN_PROPERTY_DESCRIPTOR(record, key);
    if (
      !SAFE_OBJECT_HAS_OWN(record, key) ||
      descriptor === undefined ||
      !("value" in descriptor) ||
      !descriptor.enumerable
    ) {
      throw new TypeError(`${path}.${key} must be an enumerable own data field.`);
    }
  }
}

export function exactDenseArray(value: unknown, length: number, path: string): readonly unknown[] {
  if (!SAFE_ARRAY_IS_ARRAY(value) || isProxy(value) || value.length !== length)
    throw new TypeError(`${path} must be a dense array of length ${length}.`);
  for (let index = 0; index < length; index += 1) {
    const descriptor = SAFE_GET_OWN_PROPERTY_DESCRIPTOR(value, String(index));
    if (descriptor === undefined || !("value" in descriptor) || !descriptor.enumerable)
      throw new TypeError(`${path}[${index}] must be an enumerable own data entry.`);
  }
  return value;
}

export function finite(value: unknown, path: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new TypeError(`${path} must be finite.`);
  }
  return Object.is(value, -0) ? 0 : value;
}

export function integer(value: unknown, path: string, minimum = 0): number {
  if (!Number.isSafeInteger(value) || (value as number) < minimum) {
    throw new RangeError(`${path} must be a safe integer at least ${minimum}.`);
  }
  return value as number;
}

export function digest(value: unknown, path: string): Sha256Digest {
  if (typeof value !== "string" || !DIGEST_PATTERN.test(value)) {
    throw new TypeError(`${path} must be an exact lowercase SHA-256 digest.`);
  }
  return value as Sha256Digest;
}

export function snapshotBytes(
  value: unknown,
  maximumBytes: number,
  path: string,
  seenBuffers: WeakSet<object>,
): Uint8Array {
  let buffer: object;
  try {
    if (SAFE_TYPED_ARRAY_BUFFER === undefined) throw null;
    buffer = SAFE_REFLECT_APPLY(SAFE_TYPED_ARRAY_BUFFER, value, []) as object;
  } catch {
    throw new TypeError(`${path} must be a genuine Uint8Array.`);
  }
  if (seenBuffers.has(buffer)) throw new TypeError(`${path} aliases previously supplied bytes.`);
  seenBuffers.add(buffer);
  return snapshotHostileUint8Array(value, {
    maximumBytes,
    typeError: `${path} must be a genuine Uint8Array.`,
    oversizeError: (length) => `${path} contains ${length} bytes; maximum is ${maximumBytes}.`,
    sharedError: `${path} cannot use SharedArrayBuffer storage.`,
    copyError: `${path} changed or detached during copying.`,
  });
}

export function measureBytes(value: unknown, maximumBytes: number, path: string): number {
  return inspectHostileUint8ArrayLength(value, {
    maximumBytes,
    typeError: `${path} must be a genuine Uint8Array.`,
    oversizeError: (length) => `${path} contains ${length} bytes; maximum is ${maximumBytes}.`,
    sharedError: `${path} cannot use SharedArrayBuffer storage.`,
  });
}

export function append(chunks: readonly Uint8Array[], total: number, label: string): Uint8Array {
  if (total > MAXIMUM_REAL_BUILD_BROWSER_CAMERA_EVIDENCE_ROLE_BYTES) {
    throw new RangeError(
      `${label} contains ${total} bytes; maximum is ${MAXIMUM_REAL_BUILD_BROWSER_CAMERA_EVIDENCE_ROLE_BYTES}.`,
    );
  }
  const result = createIntrinsicUint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    setIntrinsicUint8Array(result, chunk, offset);
    offset += chunk.length;
  }
  return result;
}

export function normalizeMetadata(input: RealBuildBrowserCameraEvidenceInput, path: string) {
  exactKeys(
    input,
    [
      "sourceId",
      "cameraId",
      "candidateId",
      "documentHash",
      "canonicalDocumentBytes",
      "preparedPanel",
      "fittedCamera",
      "lattice",
      "rendererInputs",
      "renderRgba",
      "sourceMask",
      "excludedMask",
      "candidateMask",
    ],
    path,
  );
  const sourceId = field(input, "sourceId", path);
  const cameraId = field(input, "cameraId", path);
  const candidateId = field(input, "candidateId", path);
  if (typeof sourceId !== "string" || !SOURCE_PATTERN.test(sourceId))
    throw new TypeError(`${path}.sourceId is invalid.`);
  if (typeof cameraId !== "string" || !CAMERA_PATTERN.test(cameraId))
    throw new TypeError(`${path}.cameraId is invalid.`);
  if (typeof candidateId !== "string" || !CANDIDATE_PATTERN.test(candidateId))
    throw new TypeError(`${path}.candidateId is invalid.`);
  const preparedPanel = field(
    input,
    "preparedPanel",
    path,
  ) as RealBuildBrowserCameraEvidenceInput["preparedPanel"];
  const fittedCamera = field(
    input,
    "fittedCamera",
    path,
  ) as RealBuildBrowserCameraEvidenceInput["fittedCamera"];
  const lattice = field(input, "lattice", path) as RealBuildBrowserCameraEvidenceInput["lattice"];
  const rendererInputs = field(
    input,
    "rendererInputs",
    path,
  ) as RealBuildBrowserCameraEvidenceInput["rendererInputs"];
  exactKeys(
    preparedPanel,
    [
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
    ],
    `${path}.preparedPanel`,
  );
  exactKeys(
    preparedPanel.crop,
    ["minXPt", "maxXPt", "minYPt", "maxYPt"],
    `${path}.preparedPanel.crop`,
  );
  exactKeys(
    fittedCamera,
    [
      "azimuthDegrees",
      "elevationDegrees",
      "pixelsPerUnit",
      "residualPx",
      "coherence",
      "centerXPx",
      "centerYPx",
    ],
    `${path}.fittedCamera`,
  );
  exactKeys(lattice, ["hand", "determinant", "turnDegrees"], `${path}.lattice`);
  exactKeys(
    rendererInputs,
    [
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
    ],
    `${path}.rendererInputs`,
  );
  const background = exactDenseArray(
    rendererInputs.backgroundRgba,
    4,
    `${path}.rendererInputs.backgroundRgba`,
  );
  const viewMatrix = exactDenseArray(
    rendererInputs.viewMatrix,
    16,
    `${path}.rendererInputs.viewMatrix`,
  );
  const projectionMatrix = exactDenseArray(
    rendererInputs.projectionMatrix,
    16,
    `${path}.rendererInputs.projectionMatrix`,
  );
  for (const [key, value] of SAFE_OBJECT_ENTRIES(fittedCamera))
    finite(value, `${path}.fittedCamera.${key}`);
  if (fittedCamera.pixelsPerUnit <= 0 || fittedCamera.coherence < 0 || fittedCamera.coherence > 1)
    throw new RangeError(`${path}.fittedCamera has invalid scale or coherence.`);
  if (lattice.hand !== "as-fitted" && lattice.hand !== "x-reflected")
    throw new TypeError(`${path}.lattice.hand is invalid.`);
  if ((lattice.hand === "as-fitted" ? 1 : -1) !== lattice.determinant)
    throw new TypeError(`${path}.lattice hand and determinant disagree.`);
  if (
    lattice.turnDegrees !== 0 &&
    lattice.turnDegrees !== 90 &&
    lattice.turnDegrees !== 180 &&
    lattice.turnDegrees !== 270
  )
    throw new TypeError(`${path}.lattice.turnDegrees is not a D4 quarter turn.`);
  const width = integer(rendererInputs.widthPx, `${path}.rendererInputs.widthPx`, 1);
  const height = integer(rendererInputs.heightPx, `${path}.rendererInputs.heightPx`, 1);
  const pixels = width * height;
  if (
    !Number.isSafeInteger(pixels) ||
    pixels > MAXIMUM_REAL_BUILD_COMPILED_OBSERVATION_RASTER_PIXELS
  )
    throw new RangeError(`${path}.rendererInputs dimensions exceed the observation raster bound.`);
  if (
    rendererInputs.renderer !== "three-webgl" ||
    typeof rendererInputs.rendererVersion !== "string" ||
    rendererInputs.rendererVersion.length < 1 ||
    rendererInputs.rendererVersion.length > 128
  )
    throw new TypeError(`${path}.rendererInputs renderer identity is invalid.`);
  if (
    rendererInputs.pixelRatio !== 1 ||
    rendererInputs.colorSpace !== "srgb" ||
    typeof rendererInputs.antialias !== "boolean" ||
    rendererInputs.alpha !== true ||
    rendererInputs.preserveDrawingBuffer !== true ||
    rendererInputs.cameraProjection !== "perspective"
  )
    throw new TypeError(`${path}.rendererInputs is not the exact supported snapshot contract.`);
  finite(rendererInputs.cameraNear, `${path}.rendererInputs.cameraNear`);
  finite(rendererInputs.cameraFar, `${path}.rendererInputs.cameraFar`);
  for (let index = 0; index < 16; index += 1) {
    finite(viewMatrix[index], `${path}.rendererInputs.viewMatrix[${index}]`);
    finite(projectionMatrix[index], `${path}.rendererInputs.projectionMatrix[${index}]`);
  }
  digest(rendererInputs.sceneSnapshotDigest, `${path}.rendererInputs.sceneSnapshotDigest`);
  if (rendererInputs.cameraNear <= 0 || rendererInputs.cameraFar <= rendererInputs.cameraNear)
    throw new RangeError(`${path}.rendererInputs camera planes are invalid.`);
  for (let index = 0; index < 4; index += 1)
    if (
      !Number.isInteger(background[index]) ||
      (background[index] as number) < 0 ||
      (background[index] as number) > 255
    )
      throw new TypeError(`${path}.rendererInputs.backgroundRgba must contain four bytes.`);
  if (
    preparedPanel.crop.minXPt >= preparedPanel.crop.maxXPt ||
    preparedPanel.crop.minYPt >= preparedPanel.crop.maxYPt
  )
    throw new RangeError(`${path}.preparedPanel.crop must have positive extent.`);
  for (const [key, value] of SAFE_OBJECT_ENTRIES(preparedPanel.crop))
    finite(value, `${path}.preparedPanel.crop.${key}`);
  digest(preparedPanel.preparedRunInputDigest, `${path}.preparedPanel.preparedRunInputDigest`);
  digest(preparedPanel.preparedStepIdentity, `${path}.preparedPanel.preparedStepIdentity`);
  digest(preparedPanel.provisionalStepIdentity, `${path}.preparedPanel.provisionalStepIdentity`);
  digest(preparedPanel.panelDigest, `${path}.preparedPanel.panelDigest`);
  digest(preparedPanel.cropDigest, `${path}.preparedPanel.cropDigest`);
  digest(preparedPanel.sourceDescriptorDigest, `${path}.preparedPanel.sourceDescriptorDigest`);
  digest(
    preparedPanel.exclusionDescriptorDigest,
    `${path}.preparedPanel.exclusionDescriptorDigest`,
  );
  integer(
    preparedPanel.compiledThroughStepNumber,
    `${path}.preparedPanel.compiledThroughStepNumber`,
  );
  integer(
    preparedPanel.registrationPanelStepNumber,
    `${path}.preparedPanel.registrationPanelStepNumber`,
    1,
  );
  integer(preparedPanel.pageNumber, `${path}.preparedPanel.pageNumber`, 1);
  if (
    preparedPanel.observationMode !== "own-panel" &&
    preparedPanel.observationMode !== "lookahead"
  )
    throw new TypeError(`${path}.preparedPanel.observationMode is invalid.`);
  if (preparedPanel.face !== "studs-up" && preparedPanel.face !== "underside")
    throw new TypeError(`${path}.preparedPanel.face is invalid.`);
  if (preparedPanel.measure !== "iou" && preparedPanel.measure !== "containment")
    throw new TypeError(`${path}.preparedPanel.measure is invalid.`);
  return {
    sourceId,
    cameraId,
    candidateId: candidateId as RealBuildDocumentCandidateId,
    documentHash: digest(field(input, "documentHash", path), `${path}.documentHash`),
    preparedPanel,
    fittedCamera,
    lattice,
    rendererInputs,
    width,
    height,
    pixels,
  } as const;
}
