import { stringifyRealBuildSafeJson } from "./real-build-safe-json-bytes";

const SAFE_BUFFER_FROM = Buffer.from;
const SAFE_JSON_PARSE = JSON.parse;
const SAFE_OBJECT_FREEZE = Object.freeze;
const SAFE_OBJECT_GET_OWN_PROPERTY_DESCRIPTOR = Object.getOwnPropertyDescriptor;
const SAFE_REFLECT_OWN_KEYS = Reflect.ownKeys;

function freezeSnapshot(value: unknown): void {
  if (typeof value !== "object" || value === null) return;
  const keys = SAFE_REFLECT_OWN_KEYS(value);
  for (let index = 0; index < keys.length; index += 1) {
    const descriptor = SAFE_OBJECT_GET_OWN_PROPERTY_DESCRIPTOR(value, keys[index]!);
    if (descriptor !== undefined && "value" in descriptor) freezeSnapshot(descriptor.value);
  }
  SAFE_OBJECT_FREEZE(value);
}

export interface Step7Gate3JsonSnapshot<T> {
  readonly value: T;
  readonly json: string;
  readonly lineBytes: Buffer;
}

/**
 * Reads caller data through own data descriptors, ignores toJSON hooks, and serializes it once.
 * The parsed snapshot, exact string, and line bytes are thereafter the only publication inputs.
 */
export function snapshotStep7Gate3Json<T>(value: T, label: string): Step7Gate3JsonSnapshot<T> {
  let json: string;
  try {
    json = stringifyRealBuildSafeJson(value);
  } catch (error) {
    throw new TypeError(`${label} must be finite own-data JSON without accessors or cycles.`, {
      cause: error,
    });
  }
  const parsed = SAFE_JSON_PARSE(json) as T;
  freezeSnapshot(parsed);
  return SAFE_OBJECT_FREEZE({
    value: parsed,
    json,
    lineBytes: SAFE_BUFFER_FROM(`${json}\n`),
  });
}
