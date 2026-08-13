import { Buffer } from "node:buffer";

import { snapshotBoundedUint8Array } from "./bounded-uint8-snapshot";
import {
  parseRealBuildBootstrapSourceManifest,
  REAL_BUILD_BOOTSTRAP_LOCK_SCHEMA,
  type RealBuildBootstrapSourceManifest,
} from "./real-build-bootstrap-source";
import { sha256Digest } from "./real-build-artifacts";
import {
  boundedDenseSourceParityArray,
  exactSourceParityKeys,
  sourceParityDigest,
  sourceParityInteger,
} from "./real-build-observation-source-parity-output-primitives";
import type {
  RealBuildSourceParityProvenanceRole,
  RealBuildSourceParitySourceSnapshot,
} from "./real-build-observation-source-parity-types";
import {
  REAL_BUILD_SOURCE_PARITY_MAXIMUM_SOURCE_BUNDLE_BYTES,
  REAL_BUILD_SOURCE_PARITY_MAXIMUM_SOURCE_BUNDLE_MANIFEST_BYTES,
  REAL_BUILD_SOURCE_PARITY_SOURCE_BUNDLE_MANIFEST_ROLE,
  REAL_BUILD_SOURCE_PARITY_SOURCE_BUNDLE_ROLE,
} from "./real-build-observation-source-parity-source-bundle";
import { validateRealBuildSourceParitySourceBundle } from "./real-build-observation-source-parity-source-bundle-validation";
import { verifyRealBuildServedResponseEvidenceBytes } from "./real-build-served-response-verification-memory";
import { validateRealBuildSourceParityEnvironment } from "./real-build-observation-source-parity-environment";
import { parseFatalUtf8Json } from "./strict-json";

const MAXIMUM_PROVENANCE_ROLES = 10;
const MAXIMUM_BOOTSTRAP_MANIFEST_BYTES = 4 * 1024 * 1024;
const MAXIMUM_MIRROR_MANIFEST_BYTES = 4 * 1024 * 1024;
const MAXIMUM_ENVIRONMENT_BYTES = 1024 * 1024;
const MAXIMUM_SERVED_MANIFEST_BYTES = 16 * 1024 * 1024;
const MAXIMUM_SERVED_BODY_BYTES = 32 * 1024 * 1024;
const MAXIMUM_PROVENANCE_BYTES = 384 * 1024 * 1024;
const SERVED_MANIFEST_ROLE = "served-response/served-response-manifest.json";
const SERVED_BODY_PATTERN = /^served-response\/served-response-bodies-([0-9]{3})\.bin$/u;
const STRICT_SOURCE_PATH = /^[A-Za-z0-9._@/-]+$/u;

export interface PreparedRealBuildSourceParityProvenanceRole {
  readonly role: string;
  readonly digest: string;
  readonly bytes: Buffer;
}

function roleMaximumBytes(role: string): number {
  if (role === "bootstrap-source-manifest") return MAXIMUM_BOOTSTRAP_MANIFEST_BYTES;
  if (role === "execution-source-mirror-manifest") return MAXIMUM_MIRROR_MANIFEST_BYTES;
  if (role === "execution-environment") return MAXIMUM_ENVIRONMENT_BYTES;
  if (role === REAL_BUILD_SOURCE_PARITY_SOURCE_BUNDLE_MANIFEST_ROLE) {
    return REAL_BUILD_SOURCE_PARITY_MAXIMUM_SOURCE_BUNDLE_MANIFEST_BYTES;
  }
  if (role === REAL_BUILD_SOURCE_PARITY_SOURCE_BUNDLE_ROLE) {
    return REAL_BUILD_SOURCE_PARITY_MAXIMUM_SOURCE_BUNDLE_BYTES;
  }
  if (role === SERVED_MANIFEST_ROLE) return MAXIMUM_SERVED_MANIFEST_BYTES;
  if (SERVED_BODY_PATTERN.test(role)) return MAXIMUM_SERVED_BODY_BYTES;
  throw new TypeError(`Source-parity provenance role ${JSON.stringify(role)} is not allowed.`);
}

function snapshotBytes(value: unknown, maximum: number, role: string): Buffer {
  return snapshotBoundedUint8Array(value, {
    label: `Source-parity provenance role ${role} bytes`,
    minimumBytes: 1,
    maximumBytes: maximum,
  });
}

function requireRole(
  roles: ReadonlyMap<string, PreparedRealBuildSourceParityProvenanceRole>,
  role: string,
  digest: string,
): PreparedRealBuildSourceParityProvenanceRole {
  const found = roles.get(role);
  if (found === undefined || found.digest !== digest) {
    throw new TypeError(`Source-parity provenance role ${role} does not match ${digest}.`);
  }
  return found;
}

function validateBootstrap(
  role: PreparedRealBuildSourceParityProvenanceRole,
  snapshot: RealBuildSourceParitySourceSnapshot,
): RealBuildBootstrapSourceManifest {
  const manifest = parseRealBuildBootstrapSourceManifest(role.bytes);
  const lockedBytes = manifest.files.reduce((sum, file) => sum + file.bytes, 0);
  if (
    manifest.manifestDigest !== snapshot.bootstrapManifestDigest ||
    manifest.sourceRootsPolicyDigest !== snapshot.sourceRootsPolicyDigest ||
    manifest.files.length !== snapshot.bootstrapLockedFiles ||
    lockedBytes !== snapshot.bootstrapLockedBytes
  ) {
    throw new TypeError("Retained bootstrap manifest does not reproduce the source snapshot.");
  }
  const lockManifestBytes = Buffer.from(
    `${JSON.stringify({
      schemaVersion: REAL_BUILD_BOOTSTRAP_LOCK_SCHEMA,
      files: manifest.files,
    })}\n`,
  );
  if (sha256Digest(lockManifestBytes) !== snapshot.bootstrapLockManifestDigest) {
    throw new TypeError("Retained bootstrap files do not reproduce the authenticated lock digest.");
  }
  return manifest;
}

function validateMirror(input: {
  readonly role: PreparedRealBuildSourceParityProvenanceRole;
  readonly snapshot: RealBuildSourceParitySourceSnapshot;
  readonly pdfDigest: string;
  readonly pdfBytes: number;
}): ReadonlyMap<
  string,
  { readonly path: string; readonly digest: string; readonly bytes: number }
> {
  const manifest = parseFatalUtf8Json<Record<string, unknown>>(
    input.role.bytes,
    "source-parity execution mirror manifest",
  );
  exactSourceParityKeys(manifest, ["schemaVersion", "files"], "Execution mirror manifest");
  if (manifest.schemaVersion !== "lego.real-build-source-parity-execution-mirror/1") {
    throw new TypeError("Execution mirror manifest schema is invalid.");
  }
  boundedDenseSourceParityArray(manifest.files, 1, 10_020, "Execution mirror files");
  let totalBytes = 0;
  let previousPath = "";
  let pdfFound = false;
  const files = new Map<
    string,
    { readonly path: string; readonly digest: string; readonly bytes: number }
  >();
  for (const rawFile of manifest.files) {
    exactSourceParityKeys(rawFile, ["path", "digest", "bytes"], "Execution mirror file");
    const file = rawFile as {
      readonly path: unknown;
      readonly digest: unknown;
      readonly bytes: unknown;
    };
    if (
      typeof file.path !== "string" ||
      file.path.length === 0 ||
      !STRICT_SOURCE_PATH.test(file.path) ||
      file.path
        .split("/")
        .some((segment) => segment === "" || segment === "." || segment === "..") ||
      file.path.localeCompare(previousPath) <= 0
    ) {
      throw new TypeError("Execution mirror file paths must be unique and canonical.");
    }
    previousPath = file.path;
    const digest = sourceParityDigest(file.digest, `Execution mirror file ${file.path} digest`);
    const bytes = sourceParityInteger(
      file.bytes,
      0,
      96 * 1024 * 1024,
      `Execution mirror file ${file.path} bytes`,
    );
    totalBytes += bytes;
    files.set(file.path, { path: file.path, digest, bytes });
    if (file.path === "inputs/booklet.pdf") {
      pdfFound = file.digest === input.pdfDigest && file.bytes === input.pdfBytes;
    }
  }
  if (
    !pdfFound ||
    manifest.files.length !== input.snapshot.executionMirrorFiles ||
    totalBytes !== input.snapshot.executionMirrorBytes
  ) {
    throw new TypeError("Execution mirror manifest does not reproduce its PDF and source bounds.");
  }
  return files;
}

function validateServedRoles(
  roles: readonly PreparedRealBuildSourceParityProvenanceRole[],
  snapshot: RealBuildSourceParitySourceSnapshot,
  mirrorFiles: ReadonlyMap<
    string,
    { readonly path: string; readonly digest: string; readonly bytes: number }
  >,
  repoRoot: string,
): Buffer {
  const served = roles.filter(({ role }) => role.startsWith("served-response/"));
  const bodies = served.filter(({ role }) => SERVED_BODY_PATTERN.test(role));
  bodies.forEach(({ role }, index) => {
    const match = SERVED_BODY_PATTERN.exec(role)!;
    if (Number(match[1]) !== index) {
      throw new TypeError("Served-response body roles must form a dense zero-based sequence.");
    }
  });
  if (
    served.length !== snapshot.servedResponseFiles ||
    served.reduce((sum, role) => sum + role.bytes.length, 0) !== snapshot.servedResponseBytes
  ) {
    throw new TypeError("Retained served-response roles do not reproduce their declared bounds.");
  }
  const manifestRole = roles.find(({ role }) => role === SERVED_MANIFEST_ROLE);
  if (manifestRole === undefined) {
    throw new TypeError("Source-parity provenance omitted served-response manifest bytes.");
  }
  const verifiedFiles = verifyRealBuildServedResponseEvidenceBytes({
    manifestBytes: manifestRole.bytes,
    bodyChunkBytes: bodies.map(({ bytes }) => bytes),
    expectedManifestDigest: snapshot.servedResponseManifestDigest,
    sourceFiles: [...mirrorFiles.values()],
    requireRunner: true,
    expectedCheckoutRoot: repoRoot,
  });
  const roleFiles = [
    ...bodies.map(({ role }) => role.slice("served-response/".length)),
    "served-response-manifest.json",
  ];
  if (JSON.stringify(verifiedFiles) !== JSON.stringify(roleFiles)) {
    throw new TypeError("Served-response roles do not reproduce the fully verified file sequence.");
  }
  return manifestRole.bytes;
}

function validateEnvironment(
  role: PreparedRealBuildSourceParityProvenanceRole,
  snapshot: RealBuildSourceParitySourceSnapshot,
  repoRoot: string,
): void {
  const environment = parseFatalUtf8Json<Record<string, unknown>>(
    role.bytes,
    "source-parity execution environment",
  );
  validateRealBuildSourceParityEnvironment({
    environment,
    snapshot,
    repoRoot,
    expectedNode: process.version,
    expectedPlatform: process.platform,
    expectedArch: process.arch,
    expectedVersions: process.versions,
  });
}

export function prepareRealBuildSourceParityProvenance(input: {
  readonly roles: readonly RealBuildSourceParityProvenanceRole[];
  readonly snapshot: RealBuildSourceParitySourceSnapshot;
  readonly pdfDigest: string;
  readonly pdfBytes: number;
  readonly repoRoot: string;
}): readonly PreparedRealBuildSourceParityProvenanceRole[] {
  boundedDenseSourceParityArray(input.roles, 4, MAXIMUM_PROVENANCE_ROLES, "Provenance roles");
  let aggregateBytes = 0;
  const prepared = input.roles.map((rawRole) => {
    exactSourceParityKeys(rawRole, ["role", "digest", "bytes"], "Source-parity provenance role");
    if (typeof rawRole.role !== "string") throw new TypeError("Provenance role must be a string.");
    const maximum = roleMaximumBytes(rawRole.role);
    const bytes = snapshotBytes(rawRole.bytes, maximum, rawRole.role);
    aggregateBytes += bytes.length;
    if (aggregateBytes > MAXIMUM_PROVENANCE_BYTES) {
      throw new RangeError(
        `Source-parity provenance has ${aggregateBytes} bytes; maximum is ${MAXIMUM_PROVENANCE_BYTES}.`,
      );
    }
    const digest = sourceParityDigest(rawRole.digest, `Provenance role ${rawRole.role} digest`);
    if (sha256Digest(bytes) !== digest) {
      throw new TypeError(`Source-parity provenance role ${rawRole.role} bytes do not reproduce.`);
    }
    return { role: rawRole.role, digest, bytes };
  });
  prepared.sort((left, right) => left.role.localeCompare(right.role));
  if (new Set(prepared.map(({ role }) => role)).size !== prepared.length) {
    throw new TypeError("Source-parity provenance roles are duplicated.");
  }
  const byRole = new Map(prepared.map((role) => [role.role, role]));
  const bootstrap = requireRole(
    byRole,
    "bootstrap-source-manifest",
    input.snapshot.bootstrapManifestEvidenceDigest,
  );
  requireRole(
    byRole,
    "execution-source-mirror-manifest",
    input.snapshot.executionMirrorManifestDigest,
  );
  const environment = requireRole(
    byRole,
    "execution-environment",
    input.snapshot.environmentDigest,
  );
  requireRole(byRole, SERVED_MANIFEST_ROLE, input.snapshot.servedResponseManifestDigest);
  const bootstrapManifest = validateBootstrap(bootstrap, input.snapshot);
  const mirrorFiles = validateMirror({
    role: byRole.get("execution-source-mirror-manifest")!,
    snapshot: input.snapshot,
    pdfDigest: input.pdfDigest,
    pdfBytes: input.pdfBytes,
  });
  for (const file of bootstrapManifest.files) {
    const mirrored = mirrorFiles.get(file.path);
    if (mirrored?.digest !== file.digest || mirrored.bytes !== file.bytes) {
      throw new TypeError(`Execution mirror does not reproduce bootstrap source ${file.path}.`);
    }
  }
  const servedManifestBytes = validateServedRoles(
    prepared,
    input.snapshot,
    mirrorFiles,
    input.repoRoot,
  );
  validateEnvironment(environment, input.snapshot, input.repoRoot);
  validateRealBuildSourceParitySourceBundle({
    roles: byRole,
    snapshot: input.snapshot,
    pdfDigest: input.pdfDigest,
    pdfBytes: input.pdfBytes,
    mirrorFiles,
    servedManifestBytes,
  });
  return prepared;
}
