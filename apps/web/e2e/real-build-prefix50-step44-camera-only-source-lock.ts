import { createHash } from "node:crypto";

import { canonicalDigest } from "@lego-studio/brick-kernel";

import {
  assertRealBuildBootstrapSourceLockHeld,
  readRequiredRealBuildBootstrapSourceManifest,
  REAL_BUILD_BOOTSTRAP_LOCK_SCHEMA,
} from "./real-build-bootstrap-source.ts";
import {
  REAL_BUILD_PREFIX50_STEP44_SOURCE_PDF_ARTIFACT_PATH,
  REAL_BUILD_PREFIX50_STEP44_SOURCE_PDF_DIGEST,
} from "./real-build-prefix50-source-pdf-pins.ts";

export const REAL_BUILD_PREFIX50_STEP44_CAMERA_ONLY_SOURCE_PDF_BYTES = 70_238_655 as const;
const liveSourceLockBrands = new WeakSet<object>();

function requireCondition(condition: unknown, message: string): asserts condition {
  if (!condition) throw new TypeError(message);
}

function withoutCommitment(value: object): Record<string, unknown> {
  const body = { ...value } as Record<string, unknown>;
  Reflect.deleteProperty(body, "commitment");
  return body;
}

function sha256(value: Uint8Array | string): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

export interface RealBuildPrefix50Step44CameraOnlySourceLockEvidence {
  readonly schemaVersion: "lego.real-build-prefix50-step44-camera-only-source-lock/1";
  readonly bootstrapSourceManifestDigest: `sha256:${string}`;
  readonly lockManifestDigest: `sha256:${string}`;
  readonly lockedFileCount: number;
  readonly lockedByteCount: number;
  readonly sourcePdf: {
    readonly artifactPath: typeof REAL_BUILD_PREFIX50_STEP44_SOURCE_PDF_ARTIFACT_PATH;
    readonly byteDigest: typeof REAL_BUILD_PREFIX50_STEP44_SOURCE_PDF_DIGEST;
    readonly bytes: typeof REAL_BUILD_PREFIX50_STEP44_CAMERA_ONLY_SOURCE_PDF_BYTES;
  };
  readonly commitment: `sha256:${string}`;
}

export interface RealBuildPrefix50Step44CameraOnlyLiveSourceLock {
  readonly evidence: RealBuildPrefix50Step44CameraOnlySourceLockEvidence;
  readonly runtimeIdentity: {
    readonly directory: string;
    readonly helperPid: number;
    readonly repoRoot: string;
    readonly lockManifestDigest: `sha256:${string}`;
  };
}

interface RealBuildPrefix50Step44CameraOnlySourceLockInput {
  readonly repositoryRoot: string;
  readonly manifest: {
    readonly manifestDigest: unknown;
    readonly files: readonly {
      readonly path: unknown;
      readonly digest: unknown;
      readonly bytes: unknown;
    }[];
  };
  readonly lock: {
    readonly repoRoot: unknown;
    readonly directory: unknown;
    readonly helperPid: unknown;
    readonly lockManifestDigest: unknown;
    readonly lockedFiles: unknown;
    readonly lockedBytes: unknown;
  };
}

function mintRealBuildPrefix50Step44CameraOnlyLiveSourceLock(
  input: RealBuildPrefix50Step44CameraOnlySourceLockInput,
): RealBuildPrefix50Step44CameraOnlyLiveSourceLock {
  const digestPattern = /^sha256:[0-9a-f]{64}$/u;
  const rows = input.manifest.files.filter(
    ({ path }) => path === REAL_BUILD_PREFIX50_STEP44_SOURCE_PDF_ARTIFACT_PATH,
  );
  requireCondition(
    rows.length === 1,
    `Camera-only Step-44 source lock must contain exactly one ${REAL_BUILD_PREFIX50_STEP44_SOURCE_PDF_ARTIFACT_PATH} entry; observed ${rows.length}.`,
  );
  const sourcePdf = rows[0]!;
  requireCondition(
    sourcePdf.digest === REAL_BUILD_PREFIX50_STEP44_SOURCE_PDF_DIGEST &&
      sourcePdf.bytes === REAL_BUILD_PREFIX50_STEP44_CAMERA_ONLY_SOURCE_PDF_BYTES,
    `Camera-only Step-44 source lock must bind ${REAL_BUILD_PREFIX50_STEP44_SOURCE_PDF_ARTIFACT_PATH} as exactly ${REAL_BUILD_PREFIX50_STEP44_CAMERA_ONLY_SOURCE_PDF_BYTES} bytes with digest ${REAL_BUILD_PREFIX50_STEP44_SOURCE_PDF_DIGEST}.`,
  );
  const fullLockedByteCount = input.manifest.files.reduce((total, file) => {
    requireCondition(
      Number.isSafeInteger(file.bytes) && Number(file.bytes) >= 0,
      "Camera-only Step-44 source-lock manifest contains a malformed file byte count.",
    );
    return total + Number(file.bytes);
  }, 0);
  const expectedLockManifestDigest = sha256(
    `${JSON.stringify({
      schemaVersion: REAL_BUILD_BOOTSTRAP_LOCK_SCHEMA,
      files: input.manifest.files,
    })}\n`,
  );
  requireCondition(
    Number.isSafeInteger(fullLockedByteCount) &&
      typeof input.manifest.manifestDigest === "string" &&
      digestPattern.test(input.manifest.manifestDigest) &&
      input.lock.repoRoot === input.repositoryRoot &&
      typeof input.lock.directory === "string" &&
      input.lock.directory.length > 0 &&
      Number.isSafeInteger(input.lock.helperPid) &&
      Number(input.lock.helperPid) > 0 &&
      typeof input.lock.lockManifestDigest === "string" &&
      digestPattern.test(input.lock.lockManifestDigest) &&
      input.lock.lockManifestDigest === expectedLockManifestDigest &&
      input.lock.lockedFiles === input.manifest.files.length &&
      input.lock.lockedBytes === fullLockedByteCount,
    "Camera-only Step-44 source-lock evidence does not match its live bootstrap manifest, exact lock roster, helper identity, and repository root.",
  );
  const sourcePdfRow = Object.freeze({
    path: REAL_BUILD_PREFIX50_STEP44_SOURCE_PDF_ARTIFACT_PATH,
    digest: REAL_BUILD_PREFIX50_STEP44_SOURCE_PDF_DIGEST,
    bytes: REAL_BUILD_PREFIX50_STEP44_CAMERA_ONLY_SOURCE_PDF_BYTES,
  });
  const page44SourceRoster = Object.freeze([sourcePdfRow]);
  const body = {
    schemaVersion: "lego.real-build-prefix50-step44-camera-only-source-lock/1" as const,
    bootstrapSourceManifestDigest: sha256(
      JSON.stringify({
        schemaVersion: "lego.real-build-prefix50-step44-common-source-roster/1",
        files: page44SourceRoster,
      }),
    ),
    lockManifestDigest: sha256(
      `${JSON.stringify({
        schemaVersion: REAL_BUILD_BOOTSTRAP_LOCK_SCHEMA,
        files: page44SourceRoster,
      })}\n`,
    ),
    lockedFileCount: page44SourceRoster.length,
    lockedByteCount: REAL_BUILD_PREFIX50_STEP44_CAMERA_ONLY_SOURCE_PDF_BYTES,
    sourcePdf: Object.freeze({
      artifactPath: REAL_BUILD_PREFIX50_STEP44_SOURCE_PDF_ARTIFACT_PATH,
      byteDigest: REAL_BUILD_PREFIX50_STEP44_SOURCE_PDF_DIGEST,
      bytes: REAL_BUILD_PREFIX50_STEP44_CAMERA_ONLY_SOURCE_PDF_BYTES,
    }),
  };
  const evidence = Object.freeze({ ...body, commitment: canonicalDigest(body) });
  const runtimeIdentity = Object.freeze({
    directory: input.lock.directory,
    helperPid: Number(input.lock.helperPid),
    repoRoot: input.repositoryRoot,
    lockManifestDigest: expectedLockManifestDigest,
  });
  const capability = Object.freeze({ evidence, runtimeIdentity });
  liveSourceLockBrands.add(capability);
  return capability;
}

export function captureRealBuildPrefix50Step44CameraOnlyLiveSourceLock(
  repositoryRoot: string,
): RealBuildPrefix50Step44CameraOnlyLiveSourceLock {
  return mintRealBuildPrefix50Step44CameraOnlyLiveSourceLock({
    repositoryRoot,
    manifest: readRequiredRealBuildBootstrapSourceManifest(),
    lock: assertRealBuildBootstrapSourceLockHeld(),
  });
}

export function requireRealBuildPrefix50Step44CameraOnlyLiveSourceLock(
  value: RealBuildPrefix50Step44CameraOnlyLiveSourceLock,
): RealBuildPrefix50Step44CameraOnlyLiveSourceLock {
  if (!liveSourceLockBrands.has(value))
    throw new TypeError(
      "Camera-only Step-44 live source lock must be the opaque capability minted from this process's running bootstrap helper.",
    );
  return value;
}

export function assertRealBuildPrefix50Step44CameraOnlySourceLock(
  input: RealBuildPrefix50Step44CameraOnlySourceLockInput,
): RealBuildPrefix50Step44CameraOnlySourceLockEvidence {
  const { evidence } = mintRealBuildPrefix50Step44CameraOnlyLiveSourceLock(input);
  return evidence;
}

export function assertRealBuildPrefix50Step44CameraOnlySameLiveSourceLock(input: {
  readonly before: RealBuildPrefix50Step44CameraOnlyLiveSourceLock;
  readonly after: RealBuildPrefix50Step44CameraOnlyLiveSourceLock;
}): RealBuildPrefix50Step44CameraOnlySourceLockEvidence {
  requireRealBuildPrefix50Step44CameraOnlyLiveSourceLock(input.before);
  requireRealBuildPrefix50Step44CameraOnlyLiveSourceLock(input.after);
  requireCondition(
    canonicalDigest(input.after.evidence) === canonicalDigest(input.before.evidence) &&
      canonicalDigest(input.after.runtimeIdentity) ===
        canonicalDigest(input.before.runtimeIdentity),
    "Camera-only Step-44 PDF source-lock helper identity or exact locked roster changed before browser evidence closed.",
  );
  return input.after.evidence;
}

export function assertRealBuildPrefix50Step44CameraOnlyManifestSourceLock(input: {
  readonly manifest: Readonly<Record<string, unknown>>;
  readonly expectedSourceLock: RealBuildPrefix50Step44CameraOnlySourceLockEvidence;
}): void {
  requireCondition(
    input.expectedSourceLock.commitment ===
      canonicalDigest(withoutCommitment(input.expectedSourceLock)) &&
      input.manifest.schemaVersion ===
        "lego.real-build-prefix50-step44-camera-only-gate-manifest/2" &&
      (input.manifest.status === "complete" || input.manifest.status === "refused") &&
      canonicalDigest(input.manifest.sourceLock) === canonicalDigest(input.expectedSourceLock),
    "Camera-only Step-44 complete/refused manifest did not retain its exact live PDF source-lock binding.",
  );
}
