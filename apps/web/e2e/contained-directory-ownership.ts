import { createHash, randomUUID } from "node:crypto";
import { closeSync, fstatSync, fsyncSync, lstatSync, openSync, writeSync } from "node:fs";
import { join } from "node:path";

import {
  BoundedFileReadError,
  comparableFileState,
  readContainedBoundedRegularFile,
  type ComparableFileState,
} from "./bounded-file-read";
import { normalizeThrownWithoutProbing } from "./non-probing-error";

export const CONTAINED_DIRECTORY_OWNER_MARKER = ".lego-contained-owner";

export interface ContainedDirectoryIdentity {
  readonly dev: bigint;
  readonly ino: bigint;
  readonly ownerToken: string;
}

function ownerDigest(tokenBytes: Buffer): string {
  return `sha256:${createHash("sha256").update(tokenBytes).digest("hex")}`;
}

function sameIdentity(expected: ComparableFileState, actual: ComparableFileState): boolean {
  return (
    expected.ino === actual.ino &&
    (expected.dev === 0n || actual.dev === 0n || expected.dev === actual.dev)
  );
}

export function createContainedDirectoryOwnership(input: {
  readonly root: string;
  readonly directoryCandidate: string;
  readonly directoryTarget: string;
  readonly directoryState: ComparableFileState;
  readonly label: string;
}): ContainedDirectoryIdentity {
  const ownerToken = randomUUID();
  const tokenBytes = Buffer.from(ownerToken);
  const markerTarget = join(input.directoryTarget, CONTAINED_DIRECTORY_OWNER_MARKER);
  let markerDescriptor: number | null = null;
  try {
    markerDescriptor = openSync(markerTarget, "wx");
    const markerState = comparableFileState(
      fstatSync(markerDescriptor, { bigint: true }),
      `${input.label} owner marker descriptor`,
    );
    let offset = 0;
    while (offset < tokenBytes.length) {
      const written = writeSync(markerDescriptor, tokenBytes, offset, tokenBytes.length - offset);
      if (written <= 0) {
        throw new BoundedFileReadError(
          "WRITE_FAILED",
          `${input.label} owner marker write made no progress at byte ${offset}.`,
        );
      }
      offset += written;
    }
    fsyncSync(markerDescriptor);
    closeSync(markerDescriptor);
    markerDescriptor = null;
    const markerPathState = comparableFileState(
      lstatSync(markerTarget, { bigint: true }),
      `${input.label} owner marker path`,
    );
    if (!sameIdentity(markerState, markerPathState)) {
      throw new BoundedFileReadError(
        "PATH_POLICY_VIOLATION",
        `${input.label} owner marker path does not retain its created file identity.`,
      );
    }
    const identity = Object.freeze({
      dev: input.directoryState.dev,
      ino: input.directoryState.ino,
      ownerToken,
    });
    assertContainedDirectoryOwnership(
      input.root,
      input.directoryCandidate,
      identity,
      `${input.label} owner marker creation`,
    );
    return identity;
  } catch (error) {
    const primary = normalizeThrownWithoutProbing(
      error,
      `${input.label} owner-marker creation failed without a readable error; the exclusively created directory was retained rather than deleted by pathname.`,
    );
    if (markerDescriptor !== null) {
      try {
        closeSync(markerDescriptor);
      } catch (closeFailure) {
        throw new AggregateError(
          [
            primary,
            normalizeThrownWithoutProbing(
              closeFailure,
              `${input.label} owner-marker descriptor close failed without a readable error.`,
            ),
          ],
          `${input.label} owner-marker creation and descriptor close both failed; the directory pathname was retained.`,
          { cause: closeFailure },
        );
      }
    }
    throw primary;
  }
}

export function assertContainedDirectoryOwnership(
  root: string,
  directoryCandidate: string,
  expected: ContainedDirectoryIdentity,
  label: string,
): void {
  const tokenBytes = Buffer.from(expected.ownerToken);
  let observed: Buffer;
  try {
    observed = readContainedBoundedRegularFile(
      root,
      `${directoryCandidate}/${CONTAINED_DIRECTORY_OWNER_MARKER}`,
      {
        label: `${label} owner marker`,
        exactBytes: tokenBytes.length,
        maximumBytes: tokenBytes.length,
        expectedSha256: ownerDigest(tokenBytes),
      },
    );
  } catch (error) {
    throw new BoundedFileReadError(
      "PATH_POLICY_VIOLATION",
      `${label} does not carry the exact retained owner token for this directory identity.`,
      normalizeThrownWithoutProbing(error, `${label} owner marker verification failed.`),
    );
  }
  if (!observed.equals(tokenBytes)) {
    throw new BoundedFileReadError(
      "PATH_POLICY_VIOLATION",
      `${label} owner marker changed from its retained token bytes.`,
    );
  }
}
