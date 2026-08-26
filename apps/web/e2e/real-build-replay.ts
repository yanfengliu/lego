import type { RealBuildOptions } from "./real-build-safety";
import { assertReadableRealBuildBrowserOutput } from "./real-build-browser-output";
import { inspectFrozenLegacyBrowserOutputV2 } from "./real-build-artifact-legacy-browser-v2";
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
  REAL_BUILD_PANEL_SOURCE_ROLE,
  verifyRealBuildRunContract,
  verifyRealBuildRunContractRoleDigests,
} from "./real-build-run-contract";
import { verifyLegacyRealBuildRunContractV2 } from "./real-build-run-contract-legacy-v2";
import { verifyLegacyRealBuildRunContractV3 } from "./real-build-run-contract-legacy-v3";
import { parseRealBuildPreparedRunInput } from "./real-build-prepared-run-input-parser";
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
import { assertRealBuildEnvironment } from "./real-build-environment";
import { admitCanonicalRealBuildActionLedgerBytes } from "./real-build-action-ledger-admission";
import { assertRealBuildActionLedgerMatchesPreparedOptions } from "./real-build-run-action-ledger-binding";
import type { RealBuildActionLedger } from "./real-build-ledger-contract";
import type { OfficialModelIndex } from "./real-build-ledger";
import { reconstructRealBuildOfficialReplay } from "./real-build-replay-official";
import { verifyRealBuildReplayActionLedgerSemantics } from "./real-build-replay-action-ledger";
import { replayRealBuildPanelSource } from "./real-build-replay-panel-source";
import {
  assertCanonicalRealBuildJsonBytes,
  encodeCanonicalRealBuildJson,
  parseCanonicalRealBuildJson,
  parseDuplicateFreeRealBuildJson,
} from "./real-build-json-admission";

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
  const replayManifestBytes = readContainedBoundedRegularFile(directory, "replay-closure.json", {
    label: "replay closure manifest",
    maximumBytes: MAXIMUM_REPLAY_MANIFEST_BYTES,
  });
  const parsed = parseDuplicateFreeRealBuildJson<RealBuildReplayClosureManifest>(
    replayManifestBytes,
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
  const retainedContract = parseRealBuildRunContract(retainedContractBytes);
  if (retainedContract.schemaVersion === "lego.real-build-run-contract/4") {
    assertCanonicalRealBuildJsonBytes(
      replayManifestBytes,
      parsed,
      "current replay closure manifest",
      "pretty-one-space-line",
    );
  }
  assertExactReplayRoles(
    roleNames,
    expectedReplayRoles(
      parsed.replayLevel,
      retainedContract.identificationClosure.source,
      retainedContract.schemaVersion,
    ),
  );
  const roleBytes = new Map<string, Buffer>();
  for (const role of parsed.roles) {
    roleBytes.set(
      role.role,
      readCas(role, replayRoleMaximumBytes(role.role), `replay role ${role.role}`, true)!,
    );
  }
  let admittedActionLedger: RealBuildActionLedger | null = null;
  if (retainedContract.schemaVersion === "lego.real-build-run-contract/4") {
    admittedActionLedger = admitCanonicalRealBuildActionLedgerBytes({
      bytes: roleBytes.get("action-ledger")!,
      label: "replay action-ledger role",
      mode: parsed.replayLevel === "downstream-only" ? "exact-execution" : "retained-prefix",
      requestedLastStep: retainedContract.budgets.lastStep!,
    });
  }
  const environment =
    retainedContract.schemaVersion === "lego.real-build-run-contract/4"
      ? parseCanonicalRealBuildJson<Record<string, unknown>>(
          roleBytes.get("environment")!,
          "current replay environment role",
        )
      : parseDuplicateFreeRealBuildJson<Record<string, unknown>>(
          roleBytes.get("environment")!,
          "legacy replay environment role",
        );
  assertRealBuildEnvironment(environment, retainedContract.contractDigest);
  const roleDigests = Object.fromEntries(
    parsed.roles.map(({ role, digest: roleDigest }) => [role, roleDigest]),
  );
  verifyRealBuildRunContractRoleDigests(retainedContract, roleDigests);
  const replayedPanelSource =
    retainedContract.schemaVersion === "lego.real-build-run-contract/4"
      ? replayRealBuildPanelSource({
          pdfBytes: roleBytes.get("pdf")!,
          retainedSourceBytes: roleBytes.get(REAL_BUILD_PANEL_SOURCE_ROLE)!,
          manifestBytes: roleBytes.get("callout-manifest")!,
        })
      : null;
  let calibratedOfficial: OfficialModelIndex | null = null;
  if (retainedContract.schemaVersion === "lego.real-build-run-contract/4") {
    calibratedOfficial = reconstructRealBuildOfficialReplay({ roleBytes, roleDigests });
  }
  const preparedOptions =
    retainedContract.schemaVersion === "lego.real-build-run-contract/4"
      ? parseRealBuildPreparedRunInput(roleBytes.get("prepared-options")!).options
      : parseDuplicateFreeRealBuildJson<unknown>(
          roleBytes.get("prepared-options")!,
          "legacy replay prepared-options role",
        );
  assertSourceExactIdentificationRoles(roleNames, retainedContract.identificationClosure.source);
  const reconstructedCoverage = reconstructRealBuildIdentificationReplay(
    roleBytes,
    retainedContract,
  );
  if (retainedContract.schemaVersion === "lego.real-build-run-contract/4") {
    assertRealBuildActionLedgerMatchesPreparedOptions({
      ledger: admittedActionLedger!,
      ledgerDigest: roleDigests["action-ledger"]!,
      options: preparedOptions as RealBuildOptions,
      official: calibratedOfficial!,
    });
    verifyRealBuildReplayActionLedgerSemantics({
      ledger: admittedActionLedger!,
      ledgerDigest: roleDigests["action-ledger"]!,
      options: preparedOptions as RealBuildOptions,
      official: calibratedOfficial!,
      reconstructedCoverage,
      replayedPanelSource: replayedPanelSource!,
      transitionClassificationsBytes: roleBytes.get("transition-classifications")!,
    });
    verifyRealBuildRunContract({
      contract: retainedContract,
      options: preparedOptions as RealBuildOptions,
      roleDigests,
      sourceFiles: parsed.sourceBundle.files,
    });
  } else if (retainedContract.schemaVersion === "lego.real-build-run-contract/3") {
    verifyLegacyRealBuildRunContractV3({
      contract: retainedContract,
      options: preparedOptions as RealBuildOptions,
      roleDigests,
      sourceFiles: parsed.sourceBundle.files,
    });
  } else {
    verifyLegacyRealBuildRunContractV2({
      contract: retainedContract,
      options: preparedOptions,
      roleDigests,
      sourceFiles: parsed.sourceBundle.files,
    });
  }
  if (parsed.replayLevel === "downstream-only") {
    const browserOutput =
      retainedContract.schemaVersion === "lego.real-build-run-contract/4"
        ? parseCanonicalRealBuildJson<unknown>(
            roleBytes.get("browser-output")!,
            "current replay browser-output role",
          )
        : parseDuplicateFreeRealBuildJson<unknown>(
            roleBytes.get("browser-output")!,
            "legacy replay browser-output role",
          );
    if (retainedContract.schemaVersion !== "lego.real-build-run-contract/2") {
      assertReadableRealBuildBrowserOutput(browserOutput, preparedOptions as RealBuildOptions);
    } else {
      inspectFrozenLegacyBrowserOutputV2(browserOutput, preparedOptions as RealBuildOptions);
    }
  }
  const reproducedSourceBundleDigest =
    retainedContract.schemaVersion === "lego.real-build-run-contract/4"
      ? replayDigest(encodeCanonicalRealBuildJson(parsed.sourceBundle.files))
      : replayDigest(JSON.stringify(parsed.sourceBundle.files));
  if (reproducedSourceBundleDigest !== parsed.sourceBundle.digest) {
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
    files: bootstrapFiles.map(({ path, digest, bytes }) => ({ path, digest, bytes })),
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
  return { manifest: parsed, roleBytes, admittedActionLedger };
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
  let contractSchemaVersion: RealBuildReplayInspection["contractSchemaVersion"] = null;
  if (manifest.replayLevel === "downstream-only") {
    const contract = parseRealBuildRunContract(roleBytes.get("run-contract")!);
    contractDigest = contract.contractDigest;
    contractSchemaVersion = contract.schemaVersion;
  }
  return {
    authority: "local-diagnostic",
    authenticated: false,
    replayLevel: manifest.replayLevel,
    contractDigest,
    contractSchemaVersion,
    roleTrace: manifest.roles.map(({ role, digest, bytes }) => ({ role, digest, bytes })),
    sourceTrace: manifest.sourceBundle.files,
  };
}

export const replayRealBuildFinalization = (directory: string): Promise<never> =>
  rejectAuthoritativeReplay(directory, inspectRealBuildReplayClosure);
export const replayRealBuildFinalizationDiagnostic = (directory: string): Promise<never> =>
  rejectExecutableDiagnosticReplay(directory, inspectRealBuildReplayClosure);
