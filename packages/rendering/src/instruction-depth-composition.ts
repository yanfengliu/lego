export const INSTRUCTION_DEPTH_COMPOSITION_SCHEMA = "lego.instruction-depth-composition/1" as const;
export const INSTRUCTION_DEPTH_CLEAR = 0x00ff_ffff;
export const MAX_INSTRUCTION_DEPTH_COMPOSITION_PIXELS = 4_194_304;

const MAX_DIMENSION = 8192;

/**
 * This prototype proves only pixel composition, not cache identity.
 *
 * A caller must still prove that the retained prefix and isolated probe are an exact partition of
 * the render subject it intends to replace: the same object/material/program inputs, mutations,
 * and relative ordering inside each partition. Matching caller-supplied renderer and camera fields
 * catches declared frame mismatches, but neither authenticates a capture nor forms a Three.js cache key.
 */
export interface InstructionDepthCompatibility {
  readonly schemaVersion: typeof INSTRUCTION_DEPTH_COMPOSITION_SCHEMA;
  readonly rendererInstanceKey: string;
  readonly width: number;
  readonly height: number;
  readonly backgroundHex: number;
  readonly contextVendor: string;
  readonly contextRenderer: string;
  readonly contextVersion: string;
  readonly antialias: false;
  readonly samples: 0;
  readonly referenceDepthAttachment: "depth-component24-renderbuffer";
  readonly captureDepthAttachment: "depth-component24-texture";
  readonly depthAttachmentBits: 24;
  readonly depthReadback: "depth-texture-uint24-rgb8-pack";
  readonly depthFunction: "less-equal";
  readonly depthOrder: "smaller-is-nearer";
  readonly clearDepth: typeof INSTRUCTION_DEPTH_CLEAR;
  readonly outputColorSpace: "srgb";
  readonly toneMapping: "none";
}

export interface InstructionDepthCameraState {
  readonly projectionMatrix: readonly number[];
  readonly matrixWorldInverse: readonly number[];
  readonly layersMask: number;
  readonly coordinateSystem: number;
}

export interface InstructionDepthSurface {
  readonly subjectKey: string;
  readonly compatibility: InstructionDepthCompatibility;
  readonly camera: InstructionDepthCameraState;
  /** Returns a defensive copy of top-to-bottom RGBA rows. */
  copyColor(): Uint8ClampedArray;
  /** Returns a defensive copy of the corresponding unsigned 24-bit stored-depth codes. */
  copyDepth(): Uint32Array;
}

interface SurfaceStorage {
  readonly copyColor: () => Uint8ClampedArray;
  readonly copyDepth: () => Uint32Array;
  readonly compatibilityKey: string;
  readonly cameraKey: string;
}

const surfaceStorage = new WeakMap<object, SurfaceStorage>();

function storageOf(surface: InstructionDepthSurface): SurfaceStorage | undefined {
  return surfaceStorage.get(surface);
}

export interface InstructionDepthReadback {
  readonly subjectKey: string;
  readonly compatibility: InstructionDepthCompatibility;
  readonly camera: InstructionDepthCameraState;
  readonly color: Uint8Array | Uint8ClampedArray;
  readonly depth: Uint32Array;
}

export type InstructionDepthCompositionResult =
  | {
      readonly status: "composed";
      readonly pixels: Uint8ClampedArray;
      readonly probeVisibleMask: Uint8Array;
      readonly prefixVisiblePixels: number;
      readonly probeVisiblePixels: number;
      readonly prefixSubjectKey: string;
      readonly probeSubjectKey: string;
    }
  | {
      readonly status: "refused";
      readonly reason: "unrecognized-surface" | "incompatible-frame" | "equal-depth-tie";
      readonly message: string;
      readonly pixelIndex?: number;
      readonly x?: number;
      readonly y?: number;
      readonly depth?: number;
    };

function requireDimensions(width: number, height: number): number {
  if (!Number.isInteger(width) || width <= 0 || !Number.isInteger(height) || height <= 0) {
    throw new RangeError(
      `Instruction depth dimensions must be positive integers, received ${String(width)}x${String(height)}.`,
    );
  }
  if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
    throw new RangeError(
      `Instruction depth dimensions are bounded to ${MAX_DIMENSION}x${MAX_DIMENSION}, received ${width}x${height}.`,
    );
  }
  const pixels = width * height;
  if (pixels > MAX_INSTRUCTION_DEPTH_COMPOSITION_PIXELS) {
    throw new RangeError(
      `Instruction depth composition is bounded to ${MAX_INSTRUCTION_DEPTH_COMPOSITION_PIXELS} pixels, received ${pixels}.`,
    );
  }
  return pixels;
}

function requireHex(value: number, label: string): number {
  if (!Number.isInteger(value) || value < 0 || value > 0xff_ffff) {
    throw new RangeError(
      `${label} must be an integer in 0x000000..0xffffff, received ${String(value)}.`,
    );
  }
  return value;
}

function requireBoundedString(value: string, label: string): string {
  if (typeof value !== "string" || value.length === 0 || value.length > 1024) {
    throw new RangeError(`${label} must contain 1..1024 UTF-16 code units.`);
  }
  return value;
}

function normalizeMatrix(values: readonly number[], label: string): readonly number[] {
  if (values.length !== 16 || values.some((value) => !Number.isFinite(value))) {
    throw new RangeError(`${label} must contain exactly 16 finite matrix elements.`);
  }
  return Object.freeze(values.map((value) => (Object.is(value, -0) ? 0 : value)));
}

export function createInstructionDepthCompatibility(
  value: InstructionDepthCompatibility,
): InstructionDepthCompatibility {
  const pixels = requireDimensions(value.width, value.height);
  void pixels;
  if (
    value.schemaVersion !== INSTRUCTION_DEPTH_COMPOSITION_SCHEMA ||
    value.antialias !== false ||
    value.samples !== 0 ||
    value.referenceDepthAttachment !== "depth-component24-renderbuffer" ||
    value.captureDepthAttachment !== "depth-component24-texture" ||
    value.depthAttachmentBits !== 24 ||
    value.depthReadback !== "depth-texture-uint24-rgb8-pack" ||
    value.depthFunction !== "less-equal" ||
    value.depthOrder !== "smaller-is-nearer" ||
    value.clearDepth !== INSTRUCTION_DEPTH_CLEAR ||
    value.outputColorSpace !== "srgb" ||
    value.toneMapping !== "none"
  ) {
    throw new TypeError(
      `Instruction depth readback does not declare the exact unantialiased DEPTH_COMPONENT24 texture/renderbuffer parity and LEQUAL state required by ${INSTRUCTION_DEPTH_COMPOSITION_SCHEMA}.`,
    );
  }
  return Object.freeze({
    schemaVersion: INSTRUCTION_DEPTH_COMPOSITION_SCHEMA,
    rendererInstanceKey: requireBoundedString(value.rendererInstanceKey, "rendererInstanceKey"),
    width: value.width,
    height: value.height,
    backgroundHex: requireHex(value.backgroundHex, "backgroundHex"),
    contextVendor: requireBoundedString(value.contextVendor, "contextVendor"),
    contextRenderer: requireBoundedString(value.contextRenderer, "contextRenderer"),
    contextVersion: requireBoundedString(value.contextVersion, "contextVersion"),
    antialias: false,
    samples: 0,
    referenceDepthAttachment: "depth-component24-renderbuffer",
    captureDepthAttachment: "depth-component24-texture",
    depthAttachmentBits: 24,
    depthReadback: "depth-texture-uint24-rgb8-pack",
    depthFunction: "less-equal",
    depthOrder: "smaller-is-nearer",
    clearDepth: INSTRUCTION_DEPTH_CLEAR,
    outputColorSpace: "srgb",
    toneMapping: "none",
  });
}

function normalizeCamera(value: InstructionDepthCameraState): InstructionDepthCameraState {
  if (!Number.isInteger(value.layersMask) || !Number.isInteger(value.coordinateSystem)) {
    throw new RangeError(`Instruction depth camera layers and coordinate system must be integers.`);
  }
  return Object.freeze({
    projectionMatrix: normalizeMatrix(value.projectionMatrix, "camera projectionMatrix"),
    matrixWorldInverse: normalizeMatrix(value.matrixWorldInverse, "camera matrixWorldInverse"),
    layersMask: value.layersMask >>> 0,
    coordinateSystem: value.coordinateSystem,
  });
}

/**
 * Adapts a caller-asserted readback into an immutable surface for pure composition analysis. This
 * factory authenticates neither its renderer nor its scene partition; no runtime capture adapter or
 * production call site exists. The private brand prevents structural substitution after creation.
 */
export function createInstructionDepthSurfaceFromReadback(
  input: InstructionDepthReadback,
): InstructionDepthSurface {
  const compatibility = createInstructionDepthCompatibility(input.compatibility);
  const camera = normalizeCamera(input.camera);
  const subjectKey = requireBoundedString(input.subjectKey, "subjectKey");
  const pixels = compatibility.width * compatibility.height;
  if (input.color.length !== pixels * 4 || input.depth.length !== pixels) {
    throw new RangeError(
      `Instruction depth readback for ${JSON.stringify(subjectKey)} has ${input.color.length} color bytes and ${input.depth.length} depth values; ${compatibility.width}x${compatibility.height} requires ${pixels * 4} and ${pixels}.`,
    );
  }
  const color = new Uint8ClampedArray(input.color);
  const depth = new Uint32Array(input.depth);
  const red = (compatibility.backgroundHex >> 16) & 0xff;
  const green = (compatibility.backgroundHex >> 8) & 0xff;
  const blue = compatibility.backgroundHex & 0xff;
  for (let pixel = 0; pixel < pixels; pixel += 1) {
    const offset = pixel * 4;
    if (depth[pixel]! > INSTRUCTION_DEPTH_CLEAR) {
      throw new TypeError(
        `Instruction depth readback pixel ${pixel} holds ${depth[pixel]}, outside the unsigned 24-bit attachment range.`,
      );
    }
    if (color[offset + 3] !== 0xff) {
      throw new TypeError(
        `Instruction depth readback pixel ${pixel} has alpha ${String(color[offset + 3])}; the exact opaque dialect requires 255.`,
      );
    }
    if (
      depth[pixel] === INSTRUCTION_DEPTH_CLEAR &&
      (color[offset] !== red || color[offset + 1] !== green || color[offset + 2] !== blue)
    ) {
      throw new TypeError(
        `Instruction depth readback pixel ${pixel} has the clear depth code but non-background color; a far-plane fragment cannot be distinguished from empty space, so composition is refused.`,
      );
    }
  }
  const compatibilityKey = JSON.stringify(compatibility);
  const cameraKey = JSON.stringify(camera);
  const surface = Object.freeze({
    subjectKey,
    compatibility,
    camera,
    copyColor: () => color.slice(),
    copyDepth: () => depth.slice(),
  });
  surfaceStorage.set(
    surface,
    Object.freeze({
      copyColor: () => color.slice(),
      copyDepth: () => depth.slice(),
      compatibilityKey,
      cameraKey,
    } satisfies SurfaceStorage),
  );
  return surface;
}

/**
 * Composes two opaque depth minima without rerasterizing them. Strictly nearer fragments are
 * order-independent. Equal non-clear depths are not: Three sorts opaque draws by group order,
 * render order, material id, shader variant, z, and object id, while LEQUAL lets the later draw
 * replace the earlier one. The API therefore returns no pixels at all when it encounters a tie.
 */
export function composeInstructionDepthSurfaces(
  prefix: InstructionDepthSurface,
  probe: InstructionDepthSurface,
): InstructionDepthCompositionResult {
  const prefixStorage = storageOf(prefix);
  const probeStorage = storageOf(probe);
  if (prefixStorage === undefined || probeStorage === undefined) {
    return {
      status: "refused",
      reason: "unrecognized-surface",
      message: `Both inputs must be immutable surfaces created by createInstructionDepthSurfaceFromReadback.`,
    };
  }
  if (
    prefixStorage.compatibilityKey !== probeStorage.compatibilityKey ||
    prefixStorage.cameraKey !== probeStorage.cameraKey
  ) {
    return {
      status: "refused",
      reason: "incompatible-frame",
      message: `Prefix ${JSON.stringify(prefix.subjectKey)} and probe ${JSON.stringify(probe.subjectKey)} do not share the same declared renderer instance, viewport, background, depth state, and camera state.`,
    };
  }
  const prefixDepths = prefixStorage.copyDepth();
  const probeDepths = probeStorage.copyDepth();
  const width = prefix.compatibility.width;
  for (let pixel = 0; pixel < prefixDepths.length; pixel += 1) {
    const prefixDepth = prefixDepths[pixel]!;
    const probeDepth = probeDepths[pixel]!;
    if (prefixDepth === probeDepth && prefixDepth !== INSTRUCTION_DEPTH_CLEAR) {
      return {
        status: "refused",
        reason: "equal-depth-tie",
        message: `Prefix ${JSON.stringify(prefix.subjectKey)} and probe ${JSON.stringify(probe.subjectKey)} both resolve to depth ${prefixDepth} at pixel ${pixel}; LEQUAL ownership depends on whole-scene draw order.`,
        pixelIndex: pixel,
        x: pixel % width,
        y: Math.floor(pixel / width),
        depth: prefixDepth,
      };
    }
  }
  const pixels = prefixStorage.copyColor();
  const probeColors = probeStorage.copyColor();
  const probeVisibleMask = new Uint8Array(prefixDepths.length);
  let prefixVisiblePixels = 0;
  let probeVisiblePixels = 0;
  for (let pixel = 0; pixel < prefixDepths.length; pixel += 1) {
    const prefixDepth = prefixDepths[pixel]!;
    const probeDepth = probeDepths[pixel]!;
    if (
      probeDepth === INSTRUCTION_DEPTH_CLEAR ||
      (prefixDepth !== INSTRUCTION_DEPTH_CLEAR && probeDepth > prefixDepth)
    ) {
      if (prefixDepth !== INSTRUCTION_DEPTH_CLEAR) prefixVisiblePixels += 1;
      continue;
    }
    probeVisibleMask[pixel] = 1;
    probeVisiblePixels += 1;
    const offset = pixel * 4;
    pixels.set(probeColors.subarray(offset, offset + 4), offset);
  }
  return {
    status: "composed",
    pixels,
    probeVisibleMask,
    prefixVisiblePixels,
    probeVisiblePixels,
    prefixSubjectKey: prefix.subjectKey,
    probeSubjectKey: probe.subjectKey,
  };
}
