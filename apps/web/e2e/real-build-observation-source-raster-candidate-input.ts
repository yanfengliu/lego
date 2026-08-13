const TYPED_ARRAY_PROTOTYPE = Object.getPrototypeOf(Uint8Array.prototype) as object;
const TYPED_ARRAY_LENGTH = Object.getOwnPropertyDescriptor(TYPED_ARRAY_PROTOTYPE, "length")?.get;
const TYPED_ARRAY_BUFFER = Object.getOwnPropertyDescriptor(TYPED_ARRAY_PROTOTYPE, "buffer")?.get;
const TYPED_ARRAY_TAG = Object.getOwnPropertyDescriptor(
  TYPED_ARRAY_PROTOTYPE,
  Symbol.toStringTag,
)?.get;
const SHARED_BYTE_LENGTH =
  typeof SharedArrayBuffer === "undefined"
    ? undefined
    : Object.getOwnPropertyDescriptor(SharedArrayBuffer.prototype, "byteLength")?.get;

function brandedTypedArray(
  value: unknown,
  acceptedTags: ReadonlySet<string>,
  typeError: string,
): { readonly tag: string; readonly length: number; readonly buffer: ArrayBufferLike } {
  let tag: string;
  let length: number;
  let buffer: ArrayBufferLike;
  try {
    if (
      TYPED_ARRAY_LENGTH === undefined ||
      TYPED_ARRAY_BUFFER === undefined ||
      TYPED_ARRAY_TAG === undefined
    ) {
      throw null;
    }
    tag = TYPED_ARRAY_TAG.call(value) as string;
    if (!acceptedTags.has(tag)) throw null;
    length = TYPED_ARRAY_LENGTH.call(value) as number;
    buffer = TYPED_ARRAY_BUFFER.call(value) as ArrayBufferLike;
  } catch {
    throw new TypeError(typeError);
  }
  return { tag, length, buffer };
}

function rejectShared(buffer: ArrayBufferLike, message: string): void {
  if (SHARED_BYTE_LENGTH === undefined) return;
  let shared = false;
  try {
    SHARED_BYTE_LENGTH.call(buffer);
    shared = true;
  } catch {
    // The SharedArrayBuffer intrinsic rejects ordinary ArrayBuffer storage.
  }
  if (shared) throw new TypeError(message);
}

/** Snapshots only intrinsic-branded, non-shared byte storage without consulting wrappers. */
export function snapshotObservationSourceCandidateRgba(
  value: unknown,
  expectedLength: number,
): Uint8ClampedArray {
  const inspected = brandedTypedArray(
    value,
    new Set(["Uint8Array", "Uint8ClampedArray"]),
    "Observation source candidate RGBA must be an exact Uint8Array or Uint8ClampedArray. Pass the retained work-raster bytes, not an array-like object or accessor wrapper.",
  );
  if (inspected.length !== expectedLength) {
    throw new RangeError(
      `Observation source candidate RGBA holds ${inspected.length} bytes but the raster needs ${expectedLength}. ` +
        "Pass all four channels for every pixel, with row zero at the top.",
    );
  }
  rejectShared(
    inspected.buffer,
    "Observation source candidate RGBA must not use SharedArrayBuffer storage. Pass a private copy so concurrent writes cannot change the derived masks.",
  );
  const snapshot = new Uint8ClampedArray(inspected.length);
  try {
    Uint8ClampedArray.prototype.set.call(snapshot, value as Uint8Array);
  } catch {
    throw new TypeError(
      "Observation source candidate RGBA could not be copied from its typed-array storage. Pass a live, non-detached retained work-raster buffer.",
    );
  }
  return snapshot;
}

/** Snapshots an exact intrinsic binary-mask byte array before packing or hashing it. */
export function snapshotObservationSourceCandidateMask(
  value: unknown,
  expectedLength: number,
): Uint8Array {
  const inspected = brandedTypedArray(
    value,
    new Set(["Uint8Array"]),
    "Observation source candidate mask must be one exact Uint8Array. Pass intrinsic non-shared binary-mask storage, not a proxy, clamped array, or array-like wrapper.",
  );
  if (inspected.length !== expectedLength) {
    throw new RangeError(
      `Observation source candidate mask holds ${inspected.length} pixels but its dimensions require ${expectedLength}. Pass exactly one binary byte per pixel.`,
    );
  }
  rejectShared(
    inspected.buffer,
    "Observation source candidate mask must not use SharedArrayBuffer storage. Pass a private copy so concurrent writes cannot change the packed bytes or either digest.",
  );
  const snapshot = new Uint8Array(inspected.length);
  try {
    Uint8Array.prototype.set.call(snapshot, value as Uint8Array);
  } catch {
    throw new TypeError(
      "Observation source candidate mask could not be copied from its typed-array storage. Pass a live, non-detached Uint8Array.",
    );
  }
  return snapshot;
}

/** Snapshots a bounded exact Float64Array without accepting shared or wrapper storage. */
export function snapshotObservationSourceCandidateCallouts(
  value: unknown,
  maximumCoordinates: number,
): Float64Array {
  const inspected = brandedTypedArray(
    value,
    new Set(["Float64Array"]),
    "Observation source candidate callouts must be one exact Float64Array of minX,maxX,minY,maxY groups. Flatten the prepared panel callout boxes before deriving raster evidence.",
  );
  if (inspected.length > maximumCoordinates) {
    throw new RangeError(
      `Observation source candidate has ${inspected.length / 4} callouts, exceeding the ${maximumCoordinates / 4}-box bound. ` +
        "Reject the panel preparation instead of traversing an unbounded callout list.",
    );
  }
  rejectShared(
    inspected.buffer,
    "Observation source candidate callouts must not use SharedArrayBuffer storage. Pass a private copy so concurrent writes cannot change the cleared regions.",
  );
  const snapshot = new Float64Array(inspected.length);
  try {
    Float64Array.prototype.set.call(snapshot, value as Float64Array);
  } catch {
    throw new TypeError(
      "Observation source candidate callouts could not be copied from their typed-array storage. Pass a live, non-detached Float64Array.",
    );
  }
  return snapshot;
}
