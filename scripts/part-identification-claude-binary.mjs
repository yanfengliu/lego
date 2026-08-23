import { isAbsolute, join, resolve } from "node:path";

import {
  PART_IDENTIFICATION_CLAUDE_BINARY_BYTES,
  PART_IDENTIFICATION_CLAUDE_BINARY_DIGEST,
  PART_IDENTIFICATION_CLAUDE_CLI_VERSION,
} from "./part-identification-transport-contract.mjs";

const own = Function.call.bind(Object.prototype.hasOwnProperty);
const getOwnPropertyDescriptor = Object.getOwnPropertyDescriptor;
const stringIncludes = Function.call.bind(String.prototype.includes);
const PINNED_VERSION_STORE_ENTRY = "2.1.232";
const MAX_CLAUDE_BINARY_BYTES = 384 * 1024 * 1024;
const SHA256 = /^sha256:[0-9a-f]{64}$/u;

const PRODUCTION_PIN = Object.freeze({
  byteLength: PART_IDENTIFICATION_CLAUDE_BINARY_BYTES,
  digest: PART_IDENTIFICATION_CLAUDE_BINARY_DIGEST,
});

if (PART_IDENTIFICATION_CLAUDE_CLI_VERSION !== `${PINNED_VERSION_STORE_ENTRY} (Claude Code)`) {
  throw new Error(
    `Pinned Claude version-store entry ${PINNED_VERSION_STORE_ENTRY} does not match transport version ${PART_IDENTIFICATION_CLAUDE_CLI_VERSION}.`,
  );
}

function exactPin(pin) {
  const byteLengthProperty =
    pin !== null && typeof pin === "object"
      ? getOwnPropertyDescriptor(pin, "byteLength")
      : undefined;
  const digestProperty =
    pin !== null && typeof pin === "object" ? getOwnPropertyDescriptor(pin, "digest") : undefined;
  const byteLength = byteLengthProperty?.value;
  const digest = digestProperty?.value;
  if (
    pin === null ||
    typeof pin !== "object" ||
    !own(pin, "byteLength") ||
    !own(pin, "digest") ||
    byteLengthProperty?.get !== undefined ||
    byteLengthProperty?.set !== undefined ||
    digestProperty?.get !== undefined ||
    digestProperty?.set !== undefined ||
    !Number.isSafeInteger(byteLength) ||
    byteLength < 1 ||
    byteLength > MAX_CLAUDE_BINARY_BYTES ||
    typeof digest !== "string" ||
    !SHA256.test(digest)
  ) {
    throw new Error(
      `Pinned Claude launch requires a 1..${MAX_CLAUDE_BINARY_BYTES}-byte exact SHA-256.`,
    );
  }
  return Object.freeze({ byteLength, digest });
}

function exactUserProfile(environment) {
  const value = own(environment, "USERPROFILE") ? environment.USERPROFILE : undefined;
  if (
    typeof value !== "string" ||
    value.length < 1 ||
    value.length > 32_768 ||
    stringIncludes(value, "\0") ||
    !isAbsolute(value)
  ) {
    throw new Error(
      "Pinned Claude resolution requires one absolute NUL-free USERPROFILE path of at most 32768 characters; ambient PATH candidates are deliberately ignored.",
    );
  }
  return resolve(value);
}

export function resolveClaudeBinaryWithPin(environment, pinInput = PRODUCTION_PIN) {
  if (environment === null || typeof environment !== "object") {
    throw new Error("Pinned Claude resolution requires an environment object.");
  }
  const pin = exactPin(pinInput);
  const path = join(
    exactUserProfile(environment),
    ".local",
    "share",
    "claude",
    "versions",
    PINNED_VERSION_STORE_ENTRY,
  );
  return Object.freeze({
    path,
    exactExecutablePin: pin,
    evidence: Object.freeze({ byteLength: pin.byteLength, digest: pin.digest }),
  });
}

export function resolveClaudeBinary(environment) {
  if (process.platform !== "win32") {
    throw new Error(
      "Publishable pinned Claude calls require the Windows exact-executable launch guard; no weaker cross-platform fallback is configured.",
    );
  }
  return resolveClaudeBinaryWithPin(environment, PRODUCTION_PIN);
}

export const __testOnly = Object.freeze({
  resolveClaudeBinaryWithPin,
});
