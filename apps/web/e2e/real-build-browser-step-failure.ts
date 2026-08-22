import * as nodeUtilTypes from "node:util/types";

import { intrinsicRealBuildFreeze } from "./real-build-intrinsic-freeze";
import {
  isRealBuildStepFailureCode,
  isRealBuildStepFailureStage,
  type StepFailure,
} from "./real-build-step-failure";

const ARRAY_IS_ARRAY = Array.isArray;
const GET_OWN_PROPERTY_DESCRIPTORS = Object.getOwnPropertyDescriptors;
const IS_PROXY = nodeUtilTypes.isProxy;
const OWN_KEYS = Reflect.ownKeys;
const OPTIONAL_INTEGER_KEYS = ["causedByStep", "pieceIndex", "stepNumber"] as const;
const OPTIONAL_STRING_KEYS = ["catalogPartId", "inputKey"] as const;
const ALLOWED_KEYS = [
  "code",
  "stage",
  "message",
  ...OPTIONAL_INTEGER_KEYS,
  ...OPTIONAL_STRING_KEYS,
] as const;

function allowedKey(value: PropertyKey): value is (typeof ALLOWED_KEYS)[number] {
  if (typeof value !== "string") return false;
  for (let index = 0; index < ALLOWED_KEYS.length; index += 1) {
    if (value === ALLOWED_KEYS[index]) return true;
  }
  return false;
}

export function parseRealBuildBrowserStepFailure(value: unknown, path: string): StepFailure {
  if (value === null || typeof value !== "object" || IS_PROXY(value) || ARRAY_IS_ARRAY(value)) {
    throw new TypeError(`${path} must be one non-Proxy typed step failure.`);
  }
  const descriptors = GET_OWN_PROPERTY_DESCRIPTORS(value);
  const keys = OWN_KEYS(descriptors);
  for (let index = 0; index < keys.length; index += 1) {
    const key = keys[index]!;
    const descriptor = allowedKey(key) ? descriptors[key] : undefined;
    if (descriptor === undefined || !descriptor.enumerable || !("value" in descriptor)) {
      throw new TypeError(`${path} contains an unsupported or unstable failure field.`);
    }
  }
  const field = (key: (typeof ALLOWED_KEYS)[number]): unknown => descriptors[key]?.value;
  const code = field("code");
  const stage = field("stage");
  const message = field("message");
  if (
    !isRealBuildStepFailureCode(code) ||
    !isRealBuildStepFailureStage(stage) ||
    typeof message !== "string" ||
    message.length < 1 ||
    message.length > 4_096
  ) {
    throw new TypeError(`${path} must contain one supported code, stage, and bounded message.`);
  }
  const optional: Record<string, number | string> = {};
  for (let index = 0; index < OPTIONAL_INTEGER_KEYS.length; index += 1) {
    const key = OPTIONAL_INTEGER_KEYS[index]!;
    const candidate = field(key);
    if (candidate === undefined) continue;
    if (!Number.isSafeInteger(candidate) || (candidate as number) < 0) {
      throw new TypeError(`${path}.${key} must be an optional non-negative safe integer.`);
    }
    optional[key] = candidate as number;
  }
  for (let index = 0; index < OPTIONAL_STRING_KEYS.length; index += 1) {
    const key = OPTIONAL_STRING_KEYS[index]!;
    const candidate = field(key);
    if (candidate === undefined) continue;
    if (typeof candidate !== "string" || candidate.length > 1_024) {
      throw new TypeError(`${path}.${key} must be an optional bounded string.`);
    }
    optional[key] = candidate;
  }
  return intrinsicRealBuildFreeze({ code, stage, message, ...optional }) as StepFailure;
}

export function isRealBuildBrowserStepFailure(value: unknown): value is StepFailure {
  try {
    parseRealBuildBrowserStepFailure(value, "Step failure");
    return true;
  } catch {
    return false;
  }
}
