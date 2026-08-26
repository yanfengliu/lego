import { INSTRUCTION_PDF_LIMITS } from "../src/instructions/instruction-source";

import { REAL_BUILD_RAW_REPLAY_ROLE_BYTE_POLICIES } from "./real-build-input-limits";

export const MAXIMUM_REPLAY_MANIFEST_BYTES = 16 * 1024 * 1024;
/**
 * Bound on declared replay roles, set above the number the run can actually
 * emit rather than at it.
 *
 * 20 was below that number. `real-build.spec.ts` declares fourteen input roles,
 * three more when identification is adjudicated, `run-contract`,
 * `prepared-options`, and `browser-output` — twenty — and
 * `writeRealBuildReplayClosure` adds `environment`, for twenty-one. Only the
 * last of those is conditional on the browser having run to completion, so
 * every run that failed earlier declared twenty and passed, and the first run
 * ever to execute the browser tripped a limit that had been one too small since
 * it was written. A bound no input can move, tripped only by success, is the
 * shape of a check that has never been exercised.
 *
 * The headroom is for the roles this closure will grow, not for unbounded
 * input: the count is fixed by code, so a change that needs more than this is a
 * change to the closure and should say so here.
 */
export const MAXIMUM_REPLAY_ROLE_COUNT = 24;
export const MAXIMUM_REPLAY_ROLE_BYTES = 512 * 1024 * 1024;
export const MAXIMUM_REPLAY_SOURCE_FILES = 10_000;
// Fixed booklet inputs are part of the execution mirror, so this boundary must admit the exact
// same PDF bytes as the live instruction reader instead of silently imposing a smaller limit.
export const MAXIMUM_REPLAY_SOURCE_FILE_BYTES = INSTRUCTION_PDF_LIMITS.maxBytes;
export const MAXIMUM_REPLAY_SOURCE_BYTES = 256 * 1024 * 1024;
export const MAXIMUM_REPLAY_UNIQUE_CAS_BYTES = 768 * 1024 * 1024;
export const MAXIMUM_REPLAY_WORK_ITEMS = 10_020;

export const REAL_BUILD_REPLAY_ROLE_BYTE_LIMITS = {
  ...Object.fromEntries(
    Object.entries(REAL_BUILD_RAW_REPLAY_ROLE_BYTE_POLICIES).map(([role, policy]) => [
      role,
      policy.maximumBytes,
    ]),
  ),
  "run-contract": 8 * 1024 * 1024,
  "panel-source": 32 * 1024 * 1024,
  "prepared-options": 16 * 1024 * 1024,
  "browser-output": 64 * 1024 * 1024,
  environment: 1024 * 1024,
} as Readonly<Record<string, number>>;

const DERIVED_JSON_ROLE_MINIMUM_BYTES: Readonly<Record<string, number>> = {
  "run-contract": 2,
  "panel-source": 2,
  "prepared-options": 2,
  "browser-output": 2,
  environment: 2,
};

export type RealBuildReplayRole = keyof typeof REAL_BUILD_REPLAY_ROLE_BYTE_LIMITS;

export function replayRoleMaximumBytes(role: string): number {
  const maximum = (REAL_BUILD_REPLAY_ROLE_BYTE_LIMITS as Readonly<Record<string, number>>)[role];
  if (maximum === undefined) {
    throw new TypeError(
      `Replay role ${JSON.stringify(role)} is not in the closed retained-role policy.`,
    );
  }
  return maximum;
}

export function assertReplayDeclaredBudgets(input: {
  readonly roles: readonly { readonly role: string; readonly bytes: number }[];
  readonly sources: readonly { readonly path: string; readonly bytes: number }[];
  readonly allowRejectedInputPlaceholders?: boolean;
}): void {
  if (input.roles.length > MAXIMUM_REPLAY_ROLE_COUNT) {
    throw new TypeError(
      `Replay closure declares ${input.roles.length} roles; the closed policy permits at most ${MAXIMUM_REPLAY_ROLE_COUNT}.`,
    );
  }
  if (input.sources.length > MAXIMUM_REPLAY_SOURCE_FILES) {
    throw new TypeError(
      `Replay closure declares ${input.sources.length} source files; the bounded policy permits at most ${MAXIMUM_REPLAY_SOURCE_FILES}.`,
    );
  }
  if (input.roles.length + input.sources.length > MAXIMUM_REPLAY_WORK_ITEMS) {
    throw new TypeError(
      `Replay closure declares ${input.roles.length + input.sources.length} verification items; the bounded policy permits at most ${MAXIMUM_REPLAY_WORK_ITEMS}.`,
    );
  }
  let roleBytes = 0;
  for (const entry of input.roles) {
    const maximum = replayRoleMaximumBytes(entry.role);
    const rawPolicy = (
      REAL_BUILD_RAW_REPLAY_ROLE_BYTE_POLICIES as Readonly<
        Record<
          string,
          {
            readonly minimumNonEmptyBytes: number;
            readonly exactBytes?: number;
            readonly allowEmpty?: boolean;
          }
        >
      >
    )[entry.role];
    const minimum =
      rawPolicy?.minimumNonEmptyBytes ?? DERIVED_JSON_ROLE_MINIMUM_BYTES[entry.role] ?? 0;
    const emptyPermitted =
      rawPolicy?.allowEmpty === true && input.allowRejectedInputPlaceholders === true;
    const allowedEmpty = entry.bytes === 0 && emptyPermitted;
    const exactMismatch =
      !allowedEmpty && rawPolicy?.exactBytes !== undefined && entry.bytes !== rawPolicy.exactBytes;
    if (
      !Number.isSafeInteger(entry.bytes) ||
      (!allowedEmpty && entry.bytes < minimum) ||
      entry.bytes > maximum ||
      exactMismatch
    ) {
      const requirement =
        rawPolicy?.exactBytes === undefined
          ? `${emptyPermitted ? "0 or " : ""}${minimum}..${maximum}`
          : `${emptyPermitted ? "0 or " : ""}exactly ${rawPolicy.exactBytes}`;
      throw new TypeError(
        `Replay role ${entry.role} declares ${String(entry.bytes)} bytes; its role-specific requirement is ${requirement}.`,
      );
    }
    roleBytes += entry.bytes;
  }
  if (roleBytes > MAXIMUM_REPLAY_ROLE_BYTES) {
    throw new TypeError(
      `Replay roles declare ${roleBytes} aggregate bytes; the bounded aggregate maximum is ${MAXIMUM_REPLAY_ROLE_BYTES}.`,
    );
  }
  let sourceBytes = 0;
  for (const entry of input.sources) {
    if (
      !Number.isSafeInteger(entry.bytes) ||
      entry.bytes < 0 ||
      entry.bytes > MAXIMUM_REPLAY_SOURCE_FILE_BYTES
    ) {
      throw new TypeError(
        `Replay source ${entry.path} declares ${String(entry.bytes)} bytes; each source is limited to ${MAXIMUM_REPLAY_SOURCE_FILE_BYTES}.`,
      );
    }
    sourceBytes += entry.bytes;
  }
  if (sourceBytes > MAXIMUM_REPLAY_SOURCE_BYTES) {
    throw new TypeError(
      `Replay sources declare ${sourceBytes} aggregate bytes; the bounded aggregate maximum is ${MAXIMUM_REPLAY_SOURCE_BYTES}.`,
    );
  }
}
