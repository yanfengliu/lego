import * as nodeUtilTypes from "node:util/types";

import { intrinsicRealBuildFreeze } from "./real-build-intrinsic-freeze";

export interface RealBuildBrowserOutputV4ProvenanceInput {
  readonly envelope: unknown;
  readonly branch: unknown;
  readonly source: unknown;
  readonly camera: unknown;
}

const ARRAY_IS_ARRAY = Array.isArray;
const GET_OWN_PROPERTY_DESCRIPTORS = Object.getOwnPropertyDescriptors;
const GET_PROTOTYPE_OF = Object.getPrototypeOf;
const IS_PROXY = nodeUtilTypes.isProxy;
const OBJECT_CREATE = Object.create;
const OBJECT_PROTOTYPE = Object.prototype;
const OWN_KEYS = Reflect.ownKeys;
const KEYS = intrinsicRealBuildFreeze(["envelope", "branch", "source", "camera"] as const);

type Key = (typeof KEYS)[number];

export function snapshotRealBuildBrowserOutputV4ProvenanceInput(
  value: unknown,
): RealBuildBrowserOutputV4ProvenanceInput {
  if (
    value === null ||
    typeof value !== "object" ||
    IS_PROXY(value) ||
    ARRAY_IS_ARRAY(value) ||
    (GET_PROTOTYPE_OF(value) !== OBJECT_PROTOTYPE && GET_PROTOTYPE_OF(value) !== null)
  ) {
    throw new TypeError(
      "Browser output /4 provenance input must be one non-Proxy plain data object.",
    );
  }
  const descriptors = GET_OWN_PROPERTY_DESCRIPTORS(value);
  const supplied = OWN_KEYS(descriptors);
  let exact = supplied.length === KEYS.length;
  for (let index = 0; exact && index < supplied.length; index += 1) {
    let expected = false;
    for (let expectedIndex = 0; expectedIndex < KEYS.length; expectedIndex += 1) {
      if (supplied[index] === KEYS[expectedIndex]) expected = true;
    }
    if (!expected) exact = false;
  }
  if (!exact) {
    throw new TypeError(
      "Browser output /4 provenance input must contain exactly envelope, branch, source, camera.",
    );
  }
  const snapshot = OBJECT_CREATE(null) as Record<Key, unknown>;
  for (let index = 0; index < KEYS.length; index += 1) {
    const key = KEYS[index]!;
    const descriptor = descriptors[key];
    if (descriptor === undefined || !descriptor.enumerable || !("value" in descriptor)) {
      throw new TypeError(
        `Browser output /4 provenance input.${key} must be one enumerable own data field; accessors are never invoked.`,
      );
    }
    snapshot[key] = descriptor.value;
  }
  return intrinsicRealBuildFreeze(snapshot) as unknown as RealBuildBrowserOutputV4ProvenanceInput;
}
