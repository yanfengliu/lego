import type { RealBuildOptions } from "./real-build-safety";
import { assertReadableRealBuildBrowserOutput } from "./real-build-browser-output";
import {
  createRealBuildBootstrapSourceManifest,
  REAL_BUILD_SOURCE_ROOT_POLICY_PATH,
} from "./real-build-bootstrap-source";
import { readContainedBoundedRegularFile } from "./bounded-file-read";
import {
  captureRealBuildSourceBundle,
  materializeRealBuildSourceMirror,
  normalizeRealBuildRelativePath,
  planRealBuildSourceMirrorBundle,
  realBuildSourceMirrorDestinations,
  resolveRealBuildPath,
  sourceDriftFailures,
  type RealBuildSourceMirror,
  type RealBuildSourceSnapshot,
} from "./real-build-replay-files";
import {
  assertSourceExactIdentificationRoles,
  reconstructRealBuildIdentificationReplay,
} from "./real-build-replay-identification";
import {
  assertReplayDeclaredBudgets,
  MAXIMUM_REPLAY_MANIFEST_BYTES,
  MAXIMUM_REPLAY_SOURCE_FILE_BYTES,
  MAXIMUM_REPLAY_UNIQUE_CAS_BYTES,
  REAL_BUILD_REPLAY_ROLE_BYTE_LIMITS,
  replayRoleMaximumBytes,
} from "./real-build-replay-policy";
import {
  parseRealBuildRunContract,
  verifyRealBuildRunContract,
  verifyRealBuildRunContractRoleDigests,
} from "./real-build-run-contract";
import {
  REAL_BUILD_REPLAY_CLOSURE_SCHEMA,
  type RealBuildReplayClosureManifest,
  type RealBuildReplayInspection,
  type VerifiedRealBuildReplayClosure,
} from "./real-build-replay-types";
import {
  rejectAuthoritativeReplay,
  rejectExecutableDiagnosticReplay,
} from "./real-build-replay-unavailable";
import {
  assertExactReplayRoles,
  canonicalReplayManifestDigest,
  expectedReplayRoles,
  replayDigest,
  writeRealBuildReplayClosureUnverified,
  type RealBuildReplayClosureWriteInput,
} from "./real-build-replay-write";
import { parseFatalUtf8Json } from "./strict-json";
import { assertRealBuildEnvironment } from "./real-build-environment";

export {
  captureRealBuildSourceBundle,
  materializeRealBuildSourceMirror,
  planRealBuildSourceMirrorBundle,
  realBuildSourceMirrorDestinations,
  resolveRealBuildPath,
  sourceDriftFailures,
};
export type { RealBuildSourceMirror, RealBuildSourceSnapshot };
export {
  REAL_BUILD_REPLAY_CLOSURE_SCHEMA,
  type RealBuildReplayClosureManifest,
  type RealBuildReplayInspection,
  type VerifiedRealBuildReplayClosure,
};

const SHA256_PATTERN = /^sha256:[0-9a-f]{64}$/u;
const SAFE_ROLE_PATTERN = /^[a-z][a-z0-9-]{0,63}$/u;

function readReplayBytes(
  root: string,
  candidate: string,
  label: string,
  expectedBytes: number,
  maximumBytes: number,
  expectedDigest?: string,
): Buffer {
  if (!Number.isSafeInteger(expectedBytes) || expectedBytes < 0 || expectedBytes > maximumBytes) {
    throw new TypeError(
      `${label} declares ${String(expectedBytes)} bytes; its strict maximum is ${maximumBytes}.`,
    );
  }
  return readContainedBoundedRegularFile(root, candidate, {
    label,
    minimumBytes: 0,
    maximumBytes,
    exactBytes: expectedBytes,
    ...(expectedDigest === undefined ? {} : { expectedSha256: expectedDigest }),
  });
}

/** Writes exact input/output/environment/source bytes to CAS and atomically closes the manifest. */
export function writeRealBuildReplayClosure(
  input: RealBuildReplayClosureWriteInput,
): RealBuildReplayClosureManifest {
  const manifest = writeRealBuildReplayClosureUnverified(input);
  verifyRealBuildReplayClosure(input.directory);
  return manifest;
}

/** Verifies each unique CAS digest once and returns the already-verified role buffers. */
export function verifyRealBuildReplayClosureData(
  directory: string,
): VerifiedRealBuildReplayClosure {
  const parsed = parseFatalUtf8Json<RealBuildReplayClosureManifest>(
    readContainedBoundedRegularFile(directory, "replay-closure.json", {
      label: "replay closure manifest",
      maximumBytes: MAXIMUM_REPLAY_MANIFEST_BYTES,
    }),
    "replay closure manifest",
  );
  if (
    parsed.schemaVersion !== REAL_BUILD_REPLAY_CLOSURE_SCHEMA ||
    parsed.authority !== "local-diagnostic" ||
    parsed.authenticated !== false ||
    !SHA256_PATTERN.test(parsed.manifestDigest) ||
    !SHA256_PATTERN.test(parsed.environmentDigest) ||
    !Array.isArray(parsed.roles) ||
    !Array.isArray(parsed.sourceBundle?.files) ||
    !SHA256_PATTERN.test(parsed.sourceBundle?.digest ?? "") ||
    !["downstream-only:browser-output", "metadata-only:input-rejection"].includes(
      `${parsed.replayLevel}:${parsed.earliestBoundary}`,
    )
  ) {
    throw new TypeError("Replay closure manifest schema is malformed.");
  }
  const { manifestDigest, ...base } = parsed;
  if (canonicalReplayManifestDigest(base) !== manifestDigest) {
    throw new TypeError("Replay closure manifest digest does not match its canonical contents.");
  }
  const roleNames = new Set<string>();
  for (const role of parsed.roles) {
    if (
      role === null ||
      typeof role !== "object" ||
      roleNames.has(role.role) ||
      !SAFE_ROLE_PATTERN.test(role.role) ||
      !Object.hasOwn(REAL_BUILD_REPLAY_ROLE_BYTE_LIMITS, role.role) ||
      !SHA256_PATTERN.test(role.digest) ||
      role.casPath !== `cas/sha256/${role.digest.slice(7, 9)}/${role.digest.slice(9)}`
    ) {
      throw new TypeError(`Replay closure role is malformed or duplicated: ${String(role?.role)}.`);
    }
    roleNames.add(role.role);
  }
  const sourcePaths = new Set<string>();
  for (const source of parsed.sourceBundle.files) {
    const normalized = normalizeRealBuildRelativePath(source.path, "replay source-bundle entry");
    if (
      sourcePaths.has(normalized) ||
      normalized !== source.path ||
      !SHA256_PATTERN.test(source.digest)
    ) {
      throw new TypeError(`Replay source-bundle entry is malformed or duplicated: ${source.path}.`);
    }
    sourcePaths.add(normalized);
  }
  if (
    parsed.roles.some((entry, index) =>
      index > 0 ? parsed.roles[index - 1]!.role.localeCompare(entry.role) >= 0 : false,
    ) ||
    parsed.sourceBundle.files.some((entry, index) =>
      index > 0 ? parsed.sourceBundle.files[index - 1]!.path.localeCompare(entry.path) >= 0 : false,
    )
  ) {
    throw new TypeError("Replay closure roles and source files must be uniquely sorted.");
  }
  assertReplayDeclaredBudgets({
    roles: parsed.roles,
    sources: parsed.sourceBundle.files,
    allowRejectedInputPlaceholders: parsed.replayLevel === "metadata-only",
  });
  const casCache = new Map<string, { readonly bytes: number; readonly retained: Buffer | null }>();
  let uniqueCasBytes = 0;
  const readCas = (
    entry: { readonly digest: string; readonly bytes: number; readonly casPath: string },
    maximum: number,
    label: string,
    retain: boolean,
  ): Buffer | null => {
    const cached = casCache.get(entry.digest);
    if (cached !== undefined) {
      if (cached.bytes !== entry.bytes) {
        throw new TypeError(
          `${label} aliases a CAS digest with a conflicting declared byte length.`,
        );
      }
      if (retain && cached.retained === null) {
        throw new TypeError(`${label} was not retained when its role digest was first verified.`);
      }
      return cached.retained;
    }
    uniqueCasBytes += entry.bytes;
    if (uniqueCasBytes > MAXIMUM_REPLAY_UNIQUE_CAS_BYTES) {
      throw new TypeError(
        `Replay closure unique CAS bytes exceed ${MAXIMUM_REPLAY_UNIQUE_CAS_BYTES} at ${label}.`,
      );
    }
    const bytes = readReplayBytes(
      directory,
      entry.casPath,
      label,
      entry.bytes,
      maximum,
      entry.digest,
    );
    if (replayDigest(bytes) !== entry.digest) {
      throw new TypeError(`${label} failed CAS size/hash verification.`);
    }
    casCache.set(entry.digest, { bytes: bytes.length, retained: retain ? bytes : null });
    return retain ? bytes : null;
  };
  const retainedContractEntry = parsed.roles.find(({ role }) => role === "run-contract");
  if (retainedContractEntry === undefined) {
    throw new TypeError("Replay closure is missing its mandatory retained run-contract bytes.");
  }
  const retainedContractBytes = readCas(
    retainedContractEntry,
    replayRoleMaximumBytes("run-contract"),
    "replay role run-contract",
    true,
  )!;
  parseFatalUtf8Json<unknown>(retainedContractBytes, "replay run-contract role");
  const retainedContract = parseRealBuildRunContract(retainedContractBytes);
  assertExactReplayRoles(
    roleNames,
    expectedReplayRoles(parsed.replayLevel, retainedContract.identificationClosure.source),
  );
  const roleBytes = new Map<string, Buffer>();
  for (const role of parsed.roles) {
    roleBytes.set(
      role.role,
      readCas(role, replayRoleMaximumBytes(role.role), `replay role ${role.role}`, true)!,
    );
  }
  const environment = parseFatalUtf8Json<Record<string, unknown>>(
    roleBytes.get("environment")!,
    "replay environment role",
  );
  assertRealBuildEnvironment(environment, retainedContract.contractDigest);
  const roleDigests = Object.fromEntries(
    parsed.roles.map(({ role, digest: roleDigest }) => [role, roleDigest]),
  );
  verifyRealBuildRunContractRoleDigests(retainedContract, roleDigests);
  const preparedOptions = parseFatalUtf8Json<RealBuildOptions>(
    roleBytes.get("prepared-options")!,
    "replay prepared-options role",
  );
  verifyRealBuildRunContract({
    contract: retainedContract,
    options: preparedOptions,
    roleDigests,
    sourceFiles: parsed.sourceBundle.files,
  });
  if (parsed.replayLevel === "downstream-only") {
    const browserOutput = parseFatalUtf8Json<unknown>(
      roleBytes.get("browser-output")!,
      "replay browser-output role",
    );
    assertReadableRealBuildBrowserOutput(browserOutput, preparedOptions);
  }
  assertSourceExactIdentificationRoles(roleNames, retainedContract.identificationClosure.source);
  reconstructRealBuildIdentificationReplay(roleBytes, retainedContract);
  if (replayDigest(JSON.stringify(parsed.sourceBundle.files)) !== parsed.sourceBundle.digest) {
    throw new TypeError("Replay source-bundle listing digest is invalid.");
  }
  const bootstrapFiles = parsed.sourceBundle.files.filter(
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
      "Replay environment bootstrap-source digest does not reproduce the retained original source bundle.",
    );
  }
  for (const source of parsed.sourceBundle.files) {
    const hex = source.digest.slice("sha256:".length);
    readCas(
      {
        digest: source.digest,
        bytes: source.bytes,
        casPath: `cas/sha256/${hex.slice(0, 2)}/${hex.slice(2)}`,
      },
      MAXIMUM_REPLAY_SOURCE_FILE_BYTES,
      `source bundle ${source.path}`,
      false,
    );
  }
  if (
    parsed.roles.find(({ role }) => role === "environment")?.digest !== parsed.environmentDigest
  ) {
    throw new TypeError("Replay environment digest is not bound to the reserved environment role.");
  }
  return { manifest: parsed, roleBytes };
}

export function verifyRealBuildReplayClosure(directory: string): RealBuildReplayClosureManifest {
  return verifyRealBuildReplayClosureData(directory).manifest;
}

export function readRealBuildReplayRole(directory: string, role: string): Buffer {
  const verified = verifyRealBuildReplayClosureData(directory);
  const bytes = verified.roleBytes.get(role);
  if (bytes === undefined) throw new TypeError(`Replay closure has no role ${role}.`);
  return bytes;
}

/** Verifies retained bytes and contracts without loading or executing retained source. */
export function inspectRealBuildReplayClosure(directory: string): RealBuildReplayInspection {
  const { manifest, roleBytes } = verifyRealBuildReplayClosureData(directory);
  let contractDigest: string | null = null;
  if (manifest.replayLevel === "downstream-only") {
    const options = parseFatalUtf8Json<RealBuildOptions>(
      roleBytes.get("prepared-options")!,
      "retained prepared-options role",
    );
    const contract = parseRealBuildRunContract(roleBytes.get("run-contract")!);
    verifyRealBuildRunContract({
      contract,
      options,
      roleDigests: Object.fromEntries(manifest.roles.map(({ role, digest }) => [role, digest])),
      sourceFiles: manifest.sourceBundle.files,
    });
    const browserOutput = parseFatalUtf8Json<unknown>(
      roleBytes.get("browser-output")!,
      "retained browser-output role",
    );
    assertReadableRealBuildBrowserOutput(browserOutput, options);
    contractDigest = contract.contractDigest;
  }
  return {
    authority: "local-diagnostic",
    authenticated: false,
    replayLevel: manifest.replayLevel,
    contractDigest,
    roleTrace: manifest.roles.map(({ role, digest, bytes }) => ({ role, digest, bytes })),
    sourceTrace: manifest.sourceBundle.files,
  };
}

export const replayRealBuildFinalization = (directory: string): Promise<never> =>
  rejectAuthoritativeReplay(directory, inspectRealBuildReplayClosure);
export const replayRealBuildFinalizationDiagnostic = (directory: string): Promise<never> =>
  rejectExecutableDiagnosticReplay(directory, inspectRealBuildReplayClosure);
