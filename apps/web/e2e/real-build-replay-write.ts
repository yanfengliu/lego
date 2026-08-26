import { createHash } from "node:crypto";
import { dirname } from "node:path";

import { encodeBoundedJson } from "./bounded-json";
import { readContainedBoundedRegularFile } from "./bounded-file-read";
import { writeContainedRegularFileAtomic } from "./contained-atomic-write";
import { ensureContainedDirectoryTree } from "./contained-directory";
import { normalizeRealBuildRelativePath, readRealBuildSourceFile } from "./real-build-replay-files";
import {
  assertSourceExactIdentificationRoles,
  CONDITIONAL_IDENTIFICATION_ROLES,
  MANDATORY_IDENTIFICATION_ROLES,
} from "./real-build-replay-identification";
import {
  assertReplayDeclaredBudgets,
  MAXIMUM_REPLAY_MANIFEST_BYTES,
  MAXIMUM_REPLAY_ROLE_COUNT,
  MAXIMUM_REPLAY_SOURCE_BYTES,
  MAXIMUM_REPLAY_SOURCE_FILES,
  MAXIMUM_REPLAY_WORK_ITEMS,
  REAL_BUILD_REPLAY_ROLE_BYTE_LIMITS,
} from "./real-build-replay-policy";
import {
  parseRealBuildRunContract,
  REAL_BUILD_INPUT_ROLE_BY_DIGEST,
  REAL_BUILD_PANEL_SOURCE_ROLE,
  verifyRealBuildRunContractRoleDigests,
} from "./real-build-run-contract";
import {
  REAL_BUILD_REPLAY_CLOSURE_SCHEMA,
  type RealBuildReplayClosureManifest,
} from "./real-build-replay-types";
import { parseRealBuildPreparedRunInput } from "./real-build-prepared-run-input-parser";
import { assertRealBuildEnvironment } from "./real-build-environment";
import { assertReadableRealBuildBrowserOutput } from "./real-build-browser-output";
import {
  canonicalRealBuildJsonClone,
  encodeCanonicalRealBuildJson,
  parseCanonicalRealBuildJson,
  parseDuplicateFreeRealBuildJson,
} from "./real-build-json-admission";
import {
  createRealBuildBootstrapSourceManifest,
  REAL_BUILD_SOURCE_ROOT_POLICY_PATH,
} from "./real-build-bootstrap-source";

const SAFE_ROLE_PATTERN = /^[a-z][a-z0-9-]{0,63}$/u;
const REQUIRED_RAW_ROLES = [
  ...Object.values(REAL_BUILD_INPUT_ROLE_BY_DIGEST),
  ...MANDATORY_IDENTIFICATION_ROLES,
] as const;
const REQUIRED_METADATA_ROLES = [
  ...REQUIRED_RAW_ROLES,
  "run-contract",
  "prepared-options",
] as const;
const REQUIRED_DOWNSTREAM_ROLES = [...REQUIRED_METADATA_ROLES, "browser-output"] as const;
const ALLOWED_LOCAL_ROLES = new Set<string>(
  Object.keys(REAL_BUILD_REPLAY_ROLE_BYTE_LIMITS).filter((role) => role !== "environment"),
);

export const replayDigest = (value: string | Uint8Array): string =>
  `sha256:${createHash("sha256").update(value).digest("hex")}`;

function hasCode(error: unknown, code: string): boolean {
  if ((error as NodeJS.ErrnoException | undefined)?.code === code) return true;
  if (error instanceof AggregateError && error.errors.some((entry) => hasCode(entry, code))) {
    return true;
  }
  return error instanceof Error && "cause" in error ? hasCode(error.cause, code) : false;
}

function writeCasBlob(
  directory: string,
  bytes: Uint8Array,
  preparedParents: Set<string>,
  storedBlobs: Map<
    string,
    { readonly digest: string; readonly bytes: number; readonly casPath: string }
  >,
): { readonly digest: string; readonly bytes: number; readonly casPath: string } {
  const valueDigest = replayDigest(bytes);
  const cached = storedBlobs.get(valueDigest);
  if (cached !== undefined) return cached;
  const hex = valueDigest.slice("sha256:".length);
  const casPath = `cas/sha256/${hex.slice(0, 2)}/${hex.slice(2)}`;
  const parent = dirname(casPath).replaceAll("\\", "/");
  if (!preparedParents.has(parent)) {
    ensureContainedDirectoryTree(directory, parent, "CAS parent");
    preparedParents.add(parent);
  }
  const readExisting = (): Buffer | null => {
    try {
      return readContainedBoundedRegularFile(directory, casPath, {
        label: "existing CAS blob",
        minimumBytes: 0,
        maximumBytes: bytes.byteLength,
        exactBytes: bytes.byteLength,
        expectedSha256: valueDigest,
      });
    } catch (error) {
      if (hasCode(error, "ENOENT")) return null;
      throw error;
    }
  };
  let existing = readExisting();
  if (existing === null) {
    try {
      writeContainedRegularFileAtomic(directory, casPath, bytes, { label: "CAS blob" });
    } catch (writeError) {
      existing = readExisting();
      if (existing === null) throw writeError;
    }
  }
  if (existing !== null && replayDigest(existing) !== valueDigest) {
    throw new TypeError(`Existing CAS blob ${casPath} does not match address ${valueDigest}.`);
  }
  const stored = { digest: valueDigest, bytes: bytes.byteLength, casPath };
  storedBlobs.set(valueDigest, stored);
  return stored;
}

export function canonicalReplayManifestDigest(
  manifest: Omit<RealBuildReplayClosureManifest, "manifestDigest">,
): string {
  return replayDigest(JSON.stringify(manifest));
}

export function expectedReplayRoles(
  replayLevel: RealBuildReplayClosureManifest["replayLevel"],
  identificationSource: "deterministic" | "adjudicated",
  contractSchemaVersion:
    | "lego.real-build-run-contract/2"
    | "lego.real-build-run-contract/3"
    | "lego.real-build-run-contract/4",
): ReadonlySet<string> {
  return new Set([
    ...(replayLevel === "downstream-only" ? REQUIRED_DOWNSTREAM_ROLES : REQUIRED_METADATA_ROLES),
    ...(contractSchemaVersion === "lego.real-build-run-contract/4"
      ? [REAL_BUILD_PANEL_SOURCE_ROLE]
      : []),
    ...(identificationSource === "adjudicated" ? CONDITIONAL_IDENTIFICATION_ROLES : []),
    "environment",
  ]);
}

export function assertExactReplayRoles(
  actual: ReadonlySet<string>,
  expected: ReadonlySet<string>,
): void {
  const missing = [...expected].filter((role) => !actual.has(role));
  const extra = [...actual].filter((role) => !expected.has(role));
  if (missing.length > 0 || extra.length > 0 || actual.size !== expected.size) {
    throw new TypeError(
      `Replay closure role set is not closed: missing [${missing.join(", ")}], unexpected [${extra.join(", ")}].`,
    );
  }
}

export interface RealBuildReplayClosureWriteInput {
  readonly directory: string;
  readonly repoRoot: string;
  readonly roles: readonly { readonly role: string; readonly bytes: Uint8Array }[];
  readonly sourceFiles: readonly string[];
  readonly environment: Readonly<Record<string, unknown>>;
  readonly browserOutputRetained: boolean;
}

/** Writes exact bounded bytes and returns the manifest for an independent read-back verification. */
export function writeRealBuildReplayClosureUnverified(
  input: RealBuildReplayClosureWriteInput,
): RealBuildReplayClosureManifest {
  if (input.roles.length + 1 > MAXIMUM_REPLAY_ROLE_COUNT) {
    throw new TypeError(
      `Replay closure declares ${input.roles.length + 1} roles including environment; the closed policy permits at most ${MAXIMUM_REPLAY_ROLE_COUNT}.`,
    );
  }
  if (input.sourceFiles.length > MAXIMUM_REPLAY_SOURCE_FILES) {
    throw new TypeError(
      `Replay closure declares ${input.sourceFiles.length} source files; the bounded policy permits at most ${MAXIMUM_REPLAY_SOURCE_FILES}.`,
    );
  }
  if (input.roles.length + 1 + input.sourceFiles.length > MAXIMUM_REPLAY_WORK_ITEMS) {
    throw new TypeError(
      `Replay closure declares ${input.roles.length + 1 + input.sourceFiles.length} work items; the bounded policy permits at most ${MAXIMUM_REPLAY_WORK_ITEMS}.`,
    );
  }
  const roleDeclarations = input.roles.map(({ role, bytes }) => ({
    role,
    bytes: bytes.byteLength,
  }));
  assertReplayDeclaredBudgets({
    roles: roleDeclarations,
    sources: [],
    allowRejectedInputPlaceholders: true,
  });
  const roleSnapshots = input.roles.map(({ role, bytes }) => ({
    role,
    bytes: Buffer.from(bytes),
  }));
  const roleNames = roleDeclarations.map(({ role }) => role);
  if (
    new Set(roleNames).size !== roleNames.length ||
    roleNames.some((role) => !SAFE_ROLE_PATTERN.test(role) || !ALLOWED_LOCAL_ROLES.has(role))
  ) {
    throw new TypeError(
      "Replay closure roles must be unique members of the closed lowercase kebab-case role policy; environment is reserved.",
    );
  }
  const normalizedSources = input.sourceFiles.map((path) =>
    normalizeRealBuildRelativePath(path, "source bundle file"),
  );
  if (new Set(normalizedSources).size !== normalizedSources.length) {
    throw new TypeError("Replay source bundle paths must be unique after canonical normalization.");
  }
  const runContractBytes = roleSnapshots.find(({ role }) => role === "run-contract")?.bytes;
  if (runContractBytes === undefined) {
    throw new TypeError("Every replay closure requires its digest-bound run-contract role.");
  }
  const runContract = parseRealBuildRunContract(runContractBytes);
  if (runContract.schemaVersion !== "lego.real-build-run-contract/4") {
    throw new TypeError(
      "New replay publication requires run-contract /4; retained generation-2 and generation-3 bytes are inspection-only and cannot be republished as current evidence.",
    );
  }
  const replayLevel = input.browserOutputRetained ? "downstream-only" : "metadata-only";
  assertExactReplayRoles(
    new Set([...roleNames, "environment"]),
    expectedReplayRoles(
      replayLevel,
      runContract.identificationClosure.source,
      runContract.schemaVersion,
    ),
  );
  const preparedOptionsBytes = roleSnapshots.find(({ role }) => role === "prepared-options")?.bytes;
  if (preparedOptionsBytes === undefined) {
    throw new TypeError("Every replay closure requires retained prepared-options bytes.");
  }
  const preparedOptions = parseRealBuildPreparedRunInput(preparedOptionsBytes).options;
  if (replayLevel === "downstream-only") {
    const browserOutputBytes = roleSnapshots.find(({ role }) => role === "browser-output")?.bytes;
    if (browserOutputBytes === undefined) {
      throw new TypeError("Downstream replay requires retained browser-output bytes.");
    }
    const browserOutput = parseCanonicalRealBuildJson<unknown>(
      browserOutputBytes,
      "current replay browser-output role",
    );
    assertReadableRealBuildBrowserOutput(browserOutput, preparedOptions);
  }
  const boundedEnvironmentBytes = encodeBoundedJson(
    input.environment,
    REAL_BUILD_REPLAY_ROLE_BYTE_LIMITS.environment!,
    "replay environment",
  );
  const boundedEnvironment = parseDuplicateFreeRealBuildJson<Record<string, unknown>>(
    boundedEnvironmentBytes,
    "bounded replay environment",
  );
  const environmentBytes = encodeCanonicalRealBuildJson(boundedEnvironment);
  if (environmentBytes.length > REAL_BUILD_REPLAY_ROLE_BYTE_LIMITS.environment!) {
    throw new TypeError(
      `Canonical replay environment encoded to ${environmentBytes.length} bytes; maximum is ${REAL_BUILD_REPLAY_ROLE_BYTE_LIMITS.environment}.`,
    );
  }
  const environment = parseCanonicalRealBuildJson<Record<string, unknown>>(
    environmentBytes,
    "current replay environment",
  );
  assertRealBuildEnvironment(environment, runContract.contractDigest);
  assertReplayDeclaredBudgets({
    roles: [...roleDeclarations, { role: "environment", bytes: environmentBytes.length }],
    sources: normalizedSources.map((path) => ({ path, bytes: 0 })),
    allowRejectedInputPlaceholders: replayLevel === "metadata-only",
  });
  const roleDigests = Object.fromEntries(
    roleSnapshots.map(({ role, bytes }) => [role, replayDigest(bytes)]),
  );
  verifyRealBuildRunContractRoleDigests(runContract, roleDigests);
  assertSourceExactIdentificationRoles(
    new Set(roleNames),
    runContract.identificationClosure.source,
  );
  let sourceAggregateBytes = 0;
  const sourceBuffers = normalizedSources
    .slice()
    .sort((left, right) => left.localeCompare(right))
    .map((path) => {
      const bytes = readRealBuildSourceFile(input.repoRoot, path, "source bundle file");
      sourceAggregateBytes += bytes.length;
      if (sourceAggregateBytes > MAXIMUM_REPLAY_SOURCE_BYTES) {
        throw new TypeError(
          `Replay source bundle exceeds the ${MAXIMUM_REPLAY_SOURCE_BYTES}-byte aggregate bound at ${path}.`,
        );
      }
      return { path, bytes };
    });
  assertReplayDeclaredBudgets({
    roles: [...roleDeclarations, { role: "environment", bytes: environmentBytes.length }],
    sources: sourceBuffers.map(({ path, bytes }) => ({ path, bytes: bytes.length })),
    allowRejectedInputPlaceholders: replayLevel === "metadata-only",
  });
  const preparedCasParents = new Set<string>();
  const storedCasBlobs = new Map<
    string,
    { readonly digest: string; readonly bytes: number; readonly casPath: string }
  >();
  const roles = roleSnapshots
    .map(({ role, bytes }) => ({
      role,
      ...writeCasBlob(input.directory, bytes, preparedCasParents, storedCasBlobs),
    }))
    .sort((left, right) => left.role.localeCompare(right.role));
  const sourceBundleFiles = sourceBuffers.map(({ path, bytes }) => {
    const stored = writeCasBlob(input.directory, bytes, preparedCasParents, storedCasBlobs);
    return { path, digest: stored.digest, bytes: stored.bytes };
  });
  const bootstrapFiles = sourceBundleFiles.filter(
    ({ path }) => !path.startsWith("inputs/") && !path.startsWith("node_modules/@lego-studio/"),
  );
  const sourceRootPolicy = bootstrapFiles.find(
    ({ path }) => path === REAL_BUILD_SOURCE_ROOT_POLICY_PATH,
  );
  if (sourceRootPolicy === undefined) {
    throw new TypeError("Replay source bundle is missing its bootstrap source-root policy.");
  }
  const reproducedBootstrap = createRealBuildBootstrapSourceManifest({
    files: bootstrapFiles,
    sourceRootsPolicyDigest: sourceRootPolicy.digest,
  });
  if (reproducedBootstrap.manifestDigest !== environment.bootstrapSourceManifestDigest) {
    throw new TypeError(
      "Replay environment bootstrap-source digest does not reproduce the exact original source inputs.",
    );
  }
  roles.push({
    role: "environment",
    ...writeCasBlob(input.directory, environmentBytes, preparedCasParents, storedCasBlobs),
  });
  roles.sort((left, right) => left.role.localeCompare(right.role));
  assertReplayDeclaredBudgets({
    roles,
    sources: sourceBundleFiles,
    allowRejectedInputPlaceholders: replayLevel === "metadata-only",
  });
  const sourceBundle = {
    files: sourceBundleFiles,
    digest: replayDigest(encodeCanonicalRealBuildJson(sourceBundleFiles)),
  };
  const base = canonicalRealBuildJsonClone<Omit<RealBuildReplayClosureManifest, "manifestDigest">>({
    schemaVersion: REAL_BUILD_REPLAY_CLOSURE_SCHEMA,
    authority: "local-diagnostic",
    authenticated: false,
    replayLevel,
    earliestBoundary: input.browserOutputRetained ? "browser-output" : "input-rejection",
    roles,
    sourceBundle,
    environmentDigest: roles.find(({ role }) => role === "environment")!.digest,
  });
  const manifest = canonicalRealBuildJsonClone<RealBuildReplayClosureManifest>({
    ...base,
    manifestDigest: canonicalReplayManifestDigest(base),
  });
  const manifestBytes = encodeCanonicalRealBuildJson(manifest, "pretty-one-space-line");
  if (manifestBytes.length > MAXIMUM_REPLAY_MANIFEST_BYTES) {
    throw new TypeError(
      `Replay closure manifest is ${manifestBytes.length} bytes; maximum is ${MAXIMUM_REPLAY_MANIFEST_BYTES}.`,
    );
  }
  writeContainedRegularFileAtomic(input.directory, "replay-closure.json", manifestBytes, {
    label: "replay closure manifest",
  });
  return manifest;
}
