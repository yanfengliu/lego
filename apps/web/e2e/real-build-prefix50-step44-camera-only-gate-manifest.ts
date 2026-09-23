import { canonicalDigest, type Sha256Digest } from "@lego-studio/brick-kernel";

import { readContainedBoundedRegularFile } from "./bounded-file-read.ts";
import { writeContainedRegularFileAtomic } from "./contained-atomic-write.ts";
import { REAL_BUILD_PREFIX50_STEP44_CAMERA_ONLY_MANIFEST_FILE } from "./real-build-prefix50-step44-camera-only-gate-contract.ts";
import {
  assertRealBuildPrefix50Step44CameraOnlyManifestSourceLock,
  type RealBuildPrefix50Step44CameraOnlySourceLockEvidence,
} from "./real-build-prefix50-step44-camera-only-source-lock.ts";
import {
  requireRealBuildPrefix50Step44RealDomainQualificationBinding,
  type RealBuildPrefix50Step44RealDomainQualificationBinding,
} from "./real-build-prefix50-subbuild-return-review-camera-real-domain-gate-evidence.ts";

function withoutCommitment(value: object): Record<string, unknown> {
  const body = { ...value } as Record<string, unknown>;
  Reflect.deleteProperty(body, "commitment");
  return body;
}

export async function writeRealBuildPrefix50Step44CameraOnlyManifest(input: {
  readonly outputPath: string;
  readonly manifest: Readonly<Record<string, unknown>>;
}): Promise<void> {
  requireRealBuildPrefix50Step44RealDomainQualificationBinding(
    input.manifest.realDomainQualification as RealBuildPrefix50Step44RealDomainQualificationBinding,
  );
  writeContainedRegularFileAtomic(
    input.outputPath,
    REAL_BUILD_PREFIX50_STEP44_CAMERA_ONLY_MANIFEST_FILE,
    `${JSON.stringify(input.manifest, null, 2)}\n`,
    { label: "camera-only Step-44 authority manifest" },
  );
}

async function assertPersistedManifest(input: {
  readonly outputPath: string;
  readonly expectedManifest: Readonly<Record<string, unknown>> & {
    readonly status: "complete" | "refused";
    readonly commitment: Sha256Digest;
    readonly sourceLock: RealBuildPrefix50Step44CameraOnlySourceLockEvidence;
  };
}): Promise<void> {
  const qualification = requireRealBuildPrefix50Step44RealDomainQualificationBinding(
    input.expectedManifest
      .realDomainQualification as RealBuildPrefix50Step44RealDomainQualificationBinding,
  );
  const expectedBytes = Buffer.from(`${JSON.stringify(input.expectedManifest, null, 2)}\n`);
  let bytes: Buffer;
  try {
    bytes = readContainedBoundedRegularFile(
      input.outputPath,
      REAL_BUILD_PREFIX50_STEP44_CAMERA_ONLY_MANIFEST_FILE,
      {
        label: `camera-only Step-44 persisted ${input.expectedManifest.status} manifest`,
        maximumBytes: expectedBytes.length,
        exactBytes: expectedBytes.length,
      },
    );
  } catch (error) {
    throw new TypeError(
      `Camera-only Step-44 persisted ${input.expectedManifest.status} manifest did not reproduce its exact bytes, status, body, and commitment.`,
      { cause: error },
    );
  }
  if (!bytes.equals(expectedBytes))
    throw new TypeError(
      `Camera-only Step-44 persisted ${input.expectedManifest.status} manifest did not reproduce its exact bytes, status, body, and commitment.`,
    );
  const persisted = JSON.parse(bytes.toString("utf8")) as Readonly<Record<string, unknown>> & {
    readonly status?: unknown;
    readonly commitment?: unknown;
  };
  if (
    persisted.status !== input.expectedManifest.status ||
    persisted.commitment !== input.expectedManifest.commitment ||
    persisted.commitment !== canonicalDigest(withoutCommitment(persisted)) ||
    canonicalDigest(persisted) !== canonicalDigest(input.expectedManifest)
  )
    throw new TypeError(
      `Camera-only Step-44 persisted ${input.expectedManifest.status} manifest did not reproduce its exact bytes, status, body, and commitment.`,
    );
  assertRealBuildPrefix50Step44CameraOnlyManifestSourceLock({
    manifest: persisted,
    expectedSourceLock: input.expectedManifest.sourceLock,
  });
  if (canonicalDigest(persisted.realDomainQualification) !== canonicalDigest(qualification))
    throw new TypeError(
      `Camera-only Step-44 persisted ${input.expectedManifest.status} manifest lost its exact runtime-branded real-domain qualification binding.`,
    );
}

export async function assertRealBuildPrefix50Step44CameraOnlyCompleteManifest(input: {
  readonly outputPath: string;
  readonly expectedManifest: Readonly<Record<string, unknown>> & {
    readonly status: "complete";
    readonly commitment: Sha256Digest;
    readonly sourceLock: RealBuildPrefix50Step44CameraOnlySourceLockEvidence;
  };
}): Promise<void> {
  await assertPersistedManifest(input);
}

export async function assertRealBuildPrefix50Step44CameraOnlyRefusalManifest(input: {
  readonly outputPath: string;
  readonly expectedManifest: Readonly<Record<string, unknown>> & {
    readonly status: "refused";
    readonly commitment: Sha256Digest;
    readonly sourceLock: RealBuildPrefix50Step44CameraOnlySourceLockEvidence;
  };
}): Promise<void> {
  await assertPersistedManifest(input);
}
