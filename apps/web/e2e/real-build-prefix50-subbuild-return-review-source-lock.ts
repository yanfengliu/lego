import { canonicalDigest, deepFreeze } from "@lego-studio/brick-kernel";
import { resolve } from "node:path";

import {
  assertRealBuildBootstrapSourceLockHeld,
  readRequiredRealBuildBootstrapSourceManifest,
  type RealBuildBootstrapSourceLockEvidence,
  type RealBuildBootstrapSourceManifest,
} from "./real-build-bootstrap-source.ts";
import { normalizeRealBuildRelativePath } from "./real-build-replay-files.ts";

export const REAL_BUILD_PREFIX50_STEP44_SOURCE_LOCKED_OPERATION_ENV =
  "LEGO_REAL_BUILD_PREFIX50_STEP44_SOURCE_LOCKED_OPERATION" as const;
export const REAL_BUILD_PREFIX50_STEP44_LOCKED_INPUTS_ENV =
  "LEGO_REAL_BUILD_PREFIX50_STEP44_LOCKED_INPUTS_JSON" as const;
// playwright.config.ts also locks all of scripts/, covering every transitive verifier import.
export const REAL_BUILD_PREFIX50_STEP44_STABLE_PRODUCTION_SOURCE_PATHS = [
  "recipes/6651557.pdf",
  "output/official-model/vx1087034_21066_a.xml",
  "output/part-identification/prefix50-semantic-closure.json",
  "output/real-build/action-preparation.json",
  "output/real-build/builder-shell-geometry.bin",
  "output/real-build/prefix50-ldraw-catalog-frames.json",
  "output/real-build/prefix50-official-ldraw-world-proposal.json",
  "output/real-build/prefix50-official-world-reconciliation.json",
  "output/real-build/prefix50-structural-events.json",
  "scripts/part-identification-prefix50-action-preparation.mjs",
  "scripts/part-identification-prefix50-official-world-reconciliation-current.mjs",
  "scripts/part-identification-prefix50-official-world-reconciliation.mjs",
  "scripts/part-identification-prefix50-structural-events-current.mjs",
  "scripts/part-identification-prefix50-verified-projection.mjs",
] as const;

const DIGEST = /^sha256:[0-9a-f]{64}$/u;

export interface RealBuildPrefix50Step44LockedInputRow {
  readonly path: string;
  readonly digest: `sha256:${string}`;
  readonly bytes: number;
}

export interface RealBuildPrefix50Step44SourceLockBinding {
  readonly schemaVersion: "lego.real-build-prefix50-step44-source-lock-binding/2";
  readonly sourceRootsPolicyDigest: `sha256:${string}`;
  readonly stableSourceCommitment: `sha256:${string}`;
  readonly operationSourceManifestDigest: `sha256:${string}`;
  readonly operationLockManifestDigest: `sha256:${string}`;
  readonly lockedFileCount: number;
  readonly lockedByteCount: number;
  readonly operationInputRoots: readonly string[];
  readonly operationInputFileCount: number;
  readonly operationInputByteCount: number;
  readonly operationInputsCommitment: `sha256:${string}`;
  readonly batchInput: RealBuildPrefix50Step44LockedInputRow;
  readonly commitment: `sha256:${string}`;
}

export interface RealBuildPrefix50Step44VerifiedSourceLock {
  readonly binding: RealBuildPrefix50Step44SourceLockBinding;
  readonly operationInputs: readonly RealBuildPrefix50Step44LockedInputRow[];
  readonly runtimeIdentity: {
    readonly repoRoot: string;
    readonly directory: string;
    readonly helperPid: number;
    readonly lockManifestDigest: string;
  };
}

/** Opaque process-local authority. Its data shape alone is deliberately insufficient. */
export interface RealBuildPrefix50Step44SourceLockCapability {
  readonly binding: RealBuildPrefix50Step44SourceLockBinding;
}

interface CapabilityState {
  readonly repositoryRoot: string;
  readonly operationInputRoots: readonly string[];
  readonly batchInputPath: string;
  readonly verified: RealBuildPrefix50Step44VerifiedSourceLock;
}

const capabilities = new WeakMap<object, CapabilityState>();

function exactKeys(value: unknown, expected: readonly string[], label: string): void {
  if (value === null || typeof value !== "object" || Array.isArray(value))
    throw new TypeError(`${label} must be a data object.`);
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (actual.length !== wanted.length || actual.some((key, index) => key !== wanted[index]))
    throw new TypeError(`${label} must contain exactly ${wanted.join(", ")}.`);
}

function exactRoots(paths: readonly string[]): readonly string[] {
  if (paths.length < 1 || paths.length > 16)
    throw new TypeError("Step-44 source-locked production requires 1..16 exact input roots.");
  const normalized = paths.map((path) =>
    normalizeRealBuildRelativePath(path, "Step-44 source-locked production input root"),
  );
  if (new Set(normalized).size !== normalized.length)
    throw new TypeError("Step-44 source-locked production input roots must be unique.");
  return normalized.slice().sort((left, right) => left.localeCompare(right));
}

function matchesRoot(path: string, root: string): boolean {
  return path === root || path.startsWith(`${root}/`);
}

export function requireRealBuildPrefix50Step44SourceLockBinding(
  value: RealBuildPrefix50Step44SourceLockBinding,
): RealBuildPrefix50Step44SourceLockBinding {
  exactKeys(
    value,
    [
      "batchInput",
      "commitment",
      "lockedByteCount",
      "lockedFileCount",
      "operationInputByteCount",
      "operationInputFileCount",
      "operationInputRoots",
      "operationInputsCommitment",
      "operationLockManifestDigest",
      "operationSourceManifestDigest",
      "schemaVersion",
      "sourceRootsPolicyDigest",
      "stableSourceCommitment",
    ],
    "Step-44 source-lock binding",
  );
  exactKeys(value.batchInput, ["bytes", "digest", "path"], "Step-44 locked batch row");
  if (!Array.isArray(value.operationInputRoots))
    throw new TypeError("Step-44 source-lock binding requires an input-root roster.");
  const roots = exactRoots(value.operationInputRoots);
  const batchRooted = roots.some((root) => matchesRoot(value.batchInput.path, root));
  const { commitment, ...body } = value;
  if (
    value.schemaVersion !== "lego.real-build-prefix50-step44-source-lock-binding/2" ||
    roots.some((root, index) => root !== value.operationInputRoots[index]) ||
    !batchRooted ||
    !DIGEST.test(value.sourceRootsPolicyDigest) ||
    !DIGEST.test(value.stableSourceCommitment) ||
    !DIGEST.test(value.operationSourceManifestDigest) ||
    !DIGEST.test(value.operationLockManifestDigest) ||
    !DIGEST.test(value.operationInputsCommitment) ||
    !DIGEST.test(value.batchInput.digest) ||
    !Number.isSafeInteger(value.batchInput.bytes) ||
    value.batchInput.bytes < 1 ||
    !Number.isSafeInteger(value.operationInputFileCount) ||
    value.operationInputFileCount < 1 ||
    !Number.isSafeInteger(value.operationInputByteCount) ||
    value.operationInputByteCount < value.batchInput.bytes ||
    !Number.isSafeInteger(value.lockedFileCount) ||
    value.lockedFileCount < value.operationInputFileCount ||
    !Number.isSafeInteger(value.lockedByteCount) ||
    value.lockedByteCount < value.operationInputByteCount ||
    commitment !== canonicalDigest(body)
  )
    throw new TypeError("Step-44 source-lock binding is malformed or uncommitted.");
  return value;
}

function requireManifestRow(
  files: readonly RealBuildPrefix50Step44LockedInputRow[],
  path: string,
  label: string,
): RealBuildPrefix50Step44LockedInputRow {
  const rows = files.filter((file) => file.path === path);
  if (rows.length !== 1)
    throw new TypeError(
      `${label} must contain exactly one locked row for ${path}; observed ${rows.length}.`,
    );
  return rows[0]!;
}

export function deriveRealBuildPrefix50Step44VerifiedSourceLock(input: {
  readonly repositoryRoot: string;
  readonly operationInputRoots: readonly string[];
  readonly batchInputPath: string;
  readonly manifest: RealBuildBootstrapSourceManifest;
  readonly lock: RealBuildBootstrapSourceLockEvidence;
}): RealBuildPrefix50Step44VerifiedSourceLock {
  const operationInputRoots = exactRoots(input.operationInputRoots);
  const batchInputPath = normalizeRealBuildRelativePath(
    input.batchInputPath,
    "Step-44 locked compact batch input",
  );
  const files = input.manifest.files
    .slice()
    .sort((left, right) =>
      left.path.localeCompare(right.path),
    ) as RealBuildPrefix50Step44LockedInputRow[];
  for (const root of operationInputRoots) {
    if (!files.some(({ path }) => matchesRoot(path, root)))
      throw new TypeError(`Step-44 source lock input root ${root} contains no locked files.`);
  }
  const operationInputs = files.filter(({ path }) =>
    operationInputRoots.some((root) => matchesRoot(path, root)),
  );
  const batchInput = requireManifestRow(
    operationInputs,
    batchInputPath,
    "Step-44 source-lock operation inputs",
  );
  for (const path of REAL_BUILD_PREFIX50_STEP44_STABLE_PRODUCTION_SOURCE_PATHS) {
    const row = requireManifestRow(files, path, "Step-44 stable production source lock");
    if (row.bytes < 1 || !DIGEST.test(row.digest))
      throw new TypeError(`Step-44 stable production source ${path} is empty or malformed.`);
  }
  const lockedByteCount = files.reduce((total, file) => total + file.bytes, 0);
  if (
    input.lock.repoRoot !== input.repositoryRoot ||
    !DIGEST.test(input.lock.lockManifestDigest) ||
    input.lock.lockedFiles !== files.length ||
    input.lock.lockedBytes !== lockedByteCount ||
    input.manifest.files.length !== files.length ||
    !DIGEST.test(input.manifest.manifestDigest) ||
    !DIGEST.test(input.manifest.sourceRootsPolicyDigest)
  )
    throw new TypeError(
      "Step-44 source-lock evidence does not bind the exact repository root, manifest roster, and byte count.",
    );
  const operationPaths = new Set(operationInputs.map(({ path }) => path));
  const stableFiles = files.filter(({ path }) => !operationPaths.has(path));
  if (stableFiles.length === 0)
    throw new TypeError("Step-44 source lock has no stable source files after input separation.");
  const operationInputByteCount = operationInputs.reduce((total, row) => total + row.bytes, 0);
  const operationInputsCommitment = canonicalDigest({
    roots: operationInputRoots,
    files: operationInputs,
  });
  const body = {
    schemaVersion: "lego.real-build-prefix50-step44-source-lock-binding/2" as const,
    sourceRootsPolicyDigest: input.manifest.sourceRootsPolicyDigest as `sha256:${string}`,
    stableSourceCommitment: canonicalDigest({
      sourceRootsPolicyDigest: input.manifest.sourceRootsPolicyDigest,
      files: stableFiles,
    }),
    operationSourceManifestDigest: input.manifest.manifestDigest as `sha256:${string}`,
    operationLockManifestDigest: input.lock.lockManifestDigest as `sha256:${string}`,
    lockedFileCount: files.length,
    lockedByteCount,
    operationInputRoots,
    operationInputFileCount: operationInputs.length,
    operationInputByteCount,
    operationInputsCommitment,
    batchInput: deepFreeze({ ...batchInput }),
  };
  return deepFreeze({
    binding: { ...body, commitment: canonicalDigest(body) },
    operationInputs,
    runtimeIdentity: {
      repoRoot: input.lock.repoRoot,
      directory: input.lock.directory,
      helperPid: input.lock.helperPid,
      lockManifestDigest: input.lock.lockManifestDigest,
    },
  });
}

function captureVerified(input: {
  readonly repositoryRoot: string;
  readonly operationInputRoots: readonly string[];
  readonly batchInputPath: string;
}): RealBuildPrefix50Step44VerifiedSourceLock {
  return deriveRealBuildPrefix50Step44VerifiedSourceLock({
    ...input,
    manifest: readRequiredRealBuildBootstrapSourceManifest(),
    lock: assertRealBuildBootstrapSourceLockHeld(),
  });
}

export function acquireRealBuildPrefix50Step44SourceLockCapability(input: {
  readonly repositoryRoot: string;
  readonly operationInputRoots: readonly string[];
  readonly batchInputPath: string;
}): RealBuildPrefix50Step44SourceLockCapability {
  const verified = captureVerified(input);
  const capability = deepFreeze({ binding: verified.binding });
  capabilities.set(capability, {
    repositoryRoot: input.repositoryRoot,
    operationInputRoots: verified.binding.operationInputRoots,
    batchInputPath: verified.binding.batchInput.path,
    verified,
  });
  return capability;
}

function capabilityState(value: RealBuildPrefix50Step44SourceLockCapability): CapabilityState {
  const state = capabilities.get(value);
  if (state === undefined || value.binding !== state.verified.binding)
    throw new TypeError(
      "Step-44 production requires the opaque live bootstrap source-lock capability; a copied binding is evidence only.",
    );
  return state;
}

export function requireRealBuildPrefix50Step44SourceLockCapability(
  value: RealBuildPrefix50Step44SourceLockCapability,
): RealBuildPrefix50Step44SourceLockBinding {
  return capabilityState(value).verified.binding;
}

export function requireRealBuildPrefix50Step44SourceLockRepository(
  capability: RealBuildPrefix50Step44SourceLockCapability,
  repositoryRoot: string,
): void {
  const expected = resolve(capabilityState(capability).repositoryRoot);
  const observed = resolve(repositoryRoot);
  if (observed.toLocaleLowerCase("en-US") !== expected.toLocaleLowerCase("en-US"))
    throw new TypeError(
      `Step-44 live source-lock capability belongs to repository ${expected}, not ${observed}.`,
    );
}

export function requireRealBuildPrefix50Step44LockedInput(
  capability: RealBuildPrefix50Step44SourceLockCapability,
  path: string,
): RealBuildPrefix50Step44LockedInputRow {
  const normalized = normalizeRealBuildRelativePath(path, "Step-44 locked operation input");
  return requireManifestRow(
    capabilityState(capability).verified.operationInputs,
    normalized,
    "Step-44 live capability",
  );
}

export function listRealBuildPrefix50Step44LockedInputRoot(
  capability: RealBuildPrefix50Step44SourceLockCapability,
  root: string,
): readonly RealBuildPrefix50Step44LockedInputRow[] {
  const state = capabilityState(capability);
  const normalized = normalizeRealBuildRelativePath(root, "Step-44 locked operation input root");
  if (!state.operationInputRoots.includes(normalized))
    throw new TypeError(`Step-44 live capability does not bind exact input root ${normalized}.`);
  return state.verified.operationInputs.filter(({ path }) => matchesRoot(path, normalized));
}

export function listRealBuildPrefix50Step44LockedInputs(
  capability: RealBuildPrefix50Step44SourceLockCapability,
): readonly RealBuildPrefix50Step44LockedInputRow[] {
  return Object.freeze(
    capabilityState(capability).verified.operationInputs.map((row) => Object.freeze({ ...row })),
  );
}

export function reassertRealBuildPrefix50Step44SourceLockCapability(
  capability: RealBuildPrefix50Step44SourceLockCapability,
): RealBuildPrefix50Step44SourceLockBinding {
  const state = capabilityState(capability);
  const after = captureVerified({
    repositoryRoot: state.repositoryRoot,
    operationInputRoots: state.operationInputRoots,
    batchInputPath: state.batchInputPath,
  });
  if (
    canonicalDigest(after.binding) !== canonicalDigest(state.verified.binding) ||
    canonicalDigest(after.runtimeIdentity) !== canonicalDigest(state.verified.runtimeIdentity) ||
    canonicalDigest(after.operationInputs) !== canonicalDigest(state.verified.operationInputs)
  )
    throw new TypeError(
      "Step-44 live source-lock helper identity, immutable source roster, or operation input bytes changed.",
    );
  return after.binding;
}
