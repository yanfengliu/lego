import * as nodeUtilTypes from "node:util/types";

import { intrinsicRealBuildFreeze } from "./real-build-intrinsic-freeze";
import type { InspectRealBuildBrowserOutputV4Input } from "./real-build-browser-output-v4-reader-types";

const ARRAY_IS_ARRAY = Array.isArray;
const OBJECT_CREATE = Object.create;
const GET_OWN_PROPERTY_DESCRIPTORS = Object.getOwnPropertyDescriptors;
const GET_PROTOTYPE_OF = Object.getPrototypeOf;
const OBJECT_PROTOTYPE = Object.prototype;
const OWN_KEYS = Reflect.ownKeys;
const IS_PROXY = nodeUtilTypes.isProxy;
const INPUT_FIELDS =
  "browserOutput, preparedRunInputBytes, branchEvidenceBytes, compiledBranchRoleBytes, " +
  "branchObservationRoleBytes, sourceManifestBytes, sourceInspection, cameraManifestBytes, " +
  "cameraRenderRoleBytes, cameraMaskRoleBytes, transitionManifestBytes";

const INPUT_KEYS = intrinsicRealBuildFreeze([
  "browserOutput",
  "preparedRunInputBytes",
  "branchEvidenceBytes",
  "compiledBranchRoleBytes",
  "branchObservationRoleBytes",
  "sourceManifestBytes",
  "sourceInspection",
  "cameraManifestBytes",
  "cameraRenderRoleBytes",
  "cameraMaskRoleBytes",
  "transitionManifestBytes",
] as const);

type InputKey = (typeof INPUT_KEYS)[number];

/** Snapshots the complete tuple before any role parser can observe hostile mutable access. */
export function snapshotRealBuildBrowserOutputV4ReaderInput(
  value: unknown,
): InspectRealBuildBrowserOutputV4Input {
  if (
    value === null ||
    typeof value !== "object" ||
    IS_PROXY(value) ||
    ARRAY_IS_ARRAY(value) ||
    (GET_PROTOTYPE_OF(value) !== OBJECT_PROTOTYPE && GET_PROTOTYPE_OF(value) !== null)
  ) {
    throw new TypeError(
      "Browser output /4 reader input must be one non-Proxy plain object of stable own data fields.",
    );
  }
  const descriptors = GET_OWN_PROPERTY_DESCRIPTORS(value);
  const keys = OWN_KEYS(descriptors);
  let exactKeys = keys.length === INPUT_KEYS.length;
  for (let index = 0; exactKeys && index < keys.length; index += 1) {
    const key = keys[index];
    let expected = false;
    for (let expectedIndex = 0; expectedIndex < INPUT_KEYS.length; expectedIndex += 1) {
      if (key === INPUT_KEYS[expectedIndex]) expected = true;
    }
    if (typeof key !== "string" || !expected) exactKeys = false;
  }
  if (!exactKeys) {
    throw new TypeError(
      `Browser output /4 reader input must contain exactly ${INPUT_FIELDS} as own fields.`,
    );
  }
  const snapshot = OBJECT_CREATE(null) as Record<InputKey, unknown>;
  for (let index = 0; index < INPUT_KEYS.length; index += 1) {
    const key = INPUT_KEYS[index]!;
    const descriptor = descriptors[key];
    if (descriptor === undefined || !descriptor.enumerable || !("value" in descriptor)) {
      throw new TypeError(
        `Browser output /4 reader input.${key} must be one enumerable own data field; accessors are never invoked.`,
      );
    }
    snapshot[key] = descriptor.value;
  }
  return intrinsicRealBuildFreeze(snapshot) as unknown as InspectRealBuildBrowserOutputV4Input;
}
