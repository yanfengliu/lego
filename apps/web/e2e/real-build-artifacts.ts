import { createHash, randomUUID } from "node:crypto";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { rename } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";

import type { RealBuildInputDigests, RealBuildOptions, RealBuildResult } from "./real-build-safety";
import { isLocalRealBuildAuthority } from "./real-build-authority";
import { isLocallyFinalizedRealBuildResult } from "./real-build-finalize";
import {
  createRealBuildRunContract,
  parseRealBuildRunContract,
  verifyRealBuildRunContract,
  type RealBuildRunContract,
} from "./real-build-run-contract";
export { createRealBuildRunContract } from "./real-build-run-contract";
import {
  readRealBuildReplayRole,
  resolveRealBuildPath,
  verifyRealBuildReplayClosure,
  type RealBuildReplayClosureManifest,
} from "./real-build-replay";

export const REAL_BUILD_SCORE_SCHEMA = "lego.real-build-score/3" as const;
export const REAL_BUILD_ARTIFACT_MANIFEST_SCHEMA = "lego.real-build-artifact-manifest/2" as const;

export function sha256Digest(value: string | Uint8Array): string {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

export function snapshotRealBuildCode(paths: readonly string[]): Readonly<Record<string, string>> {
  return Object.fromEntries(paths.map((path) => [path, sha256Digest(readFileSync(path))]));
}

/** Enumerates only regular, non-symlink source files below deliberately scoped repository roots. */
export function enumerateRealBuildCodeRoots(
  roots: readonly string[],
  repoRoot = process.cwd(),
): readonly string[] {
  const files: string[] = [];
  const visit = (path: string): void => {
    const stat = lstatSync(path);
    if (stat.isSymbolicLink()) {
      throw new TypeError(`Real-build code snapshot root may not traverse symlink ${path}.`);
    }
    if (stat.isDirectory()) {
      for (const name of readdirSync(path).sort((left, right) => left.localeCompare(right))) {
        if ([".git", "node_modules", "output", "var"].includes(name)) continue;
        visit(join(path, name));
      }
      return;
    }
    if (stat.isFile()) {
      files.push(relative(resolve(repoRoot), path).replaceAll("\\", "/"));
    }
  };
  for (const root of roots) {
    visit(
      resolveRealBuildPath(repoRoot, root, {
        mustExist: true,
        label: "real-build source root",
      }),
    );
  }
  files.sort((left, right) => left.localeCompare(right));
  return files;
}

/** Recursively binds every result-determining source under deliberately scoped roots. */
export function snapshotRealBuildCodeRoots(
  roots: readonly string[],
  repoRoot = process.cwd(),
): Readonly<Record<string, string>> {
  const files = enumerateRealBuildCodeRoots(roots, repoRoot);
  return Object.fromEntries(
    files.map((path) => [
      path,
      sha256Digest(
        readFileSync(
          resolveRealBuildPath(repoRoot, path, {
            mustExist: true,
            label: "real-build source snapshot",
          }),
        ),
      ),
    ]),
  );
}

export function writeRealBuildArtifactManifest(input: {
  readonly directory: string;
  readonly runId: string;
  readonly runContract: ReturnType<typeof createRealBuildRunContract>;
  readonly result: RealBuildResult;
  readonly artifactFiles: readonly string[];
  readonly replayClosure: RealBuildReplayClosureManifest;
}): string {
  if (!isLocalRealBuildAuthority(input.result.authority)) {
    throw new TypeError(
      "Artifact result authority is malformed; this local driver may publish only explicitly unauthenticated diagnostic evidence.",
    );
  }
  if (
    input.result.status !== "input-rejected" &&
    !isLocallyFinalizedRealBuildResult(input.result)
  ) {
    throw new TypeError(
      "Artifact result was not produced by the local Node finalizer in this process; deserialized or browser-authored completion cannot be published.",
    );
  }
  const artifacts = input.artifactFiles
    .slice()
    .sort((left, right) => left.localeCompare(right))
    .map((file) => ({ file, digest: sha256Digest(readFileSync(join(input.directory, file))) }));
  const validationSnapshots = [
    ...new Map(
      input.result.steps
        .filter(({ validation }) => validation.attempted)
        .map(({ validation }) => [
          JSON.stringify([
            validation.truthSnapshotHash,
            validation.validatorSetHash,
            validation.targetDocumentHash,
          ]),
          {
            truthSnapshotHash: validation.truthSnapshotHash,
            validatorSetHash: validation.validatorSetHash,
            targetDocumentHash: validation.targetDocumentHash,
          },
        ]),
    ).values(),
  ];
  const manifest = {
    schemaVersion: REAL_BUILD_ARTIFACT_MANIFEST_SCHEMA,
    authority: input.result.authority,
    runId: input.runId,
    runContract: input.runContract,
    truthSnapshots: {
      availability:
        validationSnapshots.length > 0 ? ("captured" as const) : ("unavailable" as const),
      validationSnapshots,
      finalStructuralHash: input.result.structuralHash,
    },
    replayClosure: {
      manifestDigest: input.replayClosure.manifestDigest,
      replayLevel: input.replayClosure.replayLevel,
      earliestBoundary: input.replayClosure.earliestBoundary,
      sourceBundleDigest: input.replayClosure.sourceBundle.digest,
      environmentDigest: input.replayClosure.environmentDigest,
    },
    artifacts,
  };
  const path = join(input.directory, "artifact-manifest.json");
  writeFileSync(path, `${JSON.stringify(manifest, null, 1)}\n`);
  return path;
}

export function verifyRealBuildArtifactManifest(directory: string): void {
  const manifestPath = resolveRealBuildPath(directory, "artifact-manifest.json", {
    mustExist: true,
    label: "artifact manifest",
  });
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
    readonly schemaVersion?: string;
    readonly authority?: RealBuildResult["authority"];
    readonly runContract?: RealBuildRunContract;
    readonly replayClosure?: { readonly manifestDigest?: string };
    readonly artifacts?: readonly { readonly file: string; readonly digest: string }[];
  };
  if (
    manifest.schemaVersion !== REAL_BUILD_ARTIFACT_MANIFEST_SCHEMA ||
    manifest.authority?.kind !== "local-diagnostic" ||
    manifest.authority.authenticated !== false ||
    manifest.authority.trustSealDigest !== null ||
    manifest.authority.reason !== "released-companion-broker-unavailable" ||
    manifest.runContract?.schemaVersion !== "lego.real-build-run-contract/1" ||
    !Array.isArray(manifest.artifacts) ||
    !/^sha256:[0-9a-f]{64}$/u.test(manifest.replayClosure?.manifestDigest ?? "")
  ) {
    throw new TypeError("Real-build artifact manifest schema or replay binding is invalid.");
  }
  const closure = verifyRealBuildReplayClosure(directory);
  if (
    closure.manifestDigest !== manifest.replayClosure!.manifestDigest ||
    closure.authority !== manifest.authority!.kind ||
    closure.authenticated !== manifest.authority!.authenticated
  ) {
    throw new TypeError("Artifact manifest does not bind the verified replay closure.");
  }
  const retainedContract = parseRealBuildRunContract(
    readRealBuildReplayRole(directory, "run-contract"),
  );
  if (JSON.stringify(retainedContract) !== JSON.stringify(manifest.runContract)) {
    throw new TypeError(
      "Artifact manifest run contract differs from the retained run-contract role.",
    );
  }
  let preparedOptions: RealBuildOptions;
  try {
    preparedOptions = JSON.parse(
      readRealBuildReplayRole(directory, "prepared-options").toString("utf8"),
    ) as RealBuildOptions;
  } catch (error) {
    throw new TypeError(
      `Artifact prepared-options role is not JSON: ${error instanceof Error ? error.message : String(error)}.`,
      { cause: error },
    );
  }
  verifyRealBuildRunContract({
    contract: retainedContract,
    options: preparedOptions,
    roleDigests: Object.fromEntries(closure.roles.map(({ role, digest }) => [role, digest])),
    sourceFiles: closure.sourceBundle.files,
  });
  for (const artifact of manifest.artifacts) {
    const path = resolveRealBuildPath(directory, artifact.file, {
      mustExist: true,
      label: "retained artifact",
    });
    if (sha256Digest(readFileSync(path)) !== artifact.digest) {
      throw new TypeError(`Retained artifact ${artifact.file} failed pre-publication hash check.`);
    }
  }
}

export function validateRealBuildOutputRoot(root: string): void {
  const normalized = root.replaceAll("\\", "/");
  if (!/^output(?:\/[a-z0-9][a-z0-9._-]*)+$/u.test(normalized)) {
    throw new TypeError(
      `Real-build output root must be a descendant of output/ without traversal; received ${JSON.stringify(root)}.`,
    );
  }
  resolveRealBuildPath(process.cwd(), normalized, { label: "real-build output root" });
}

export const REAL_BUILD_RUN_ID_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z-[0-9a-f]{12}-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;

export function planAtomicRunDirectory(input: {
  readonly outputRoot: string;
  readonly inputDigests: RealBuildInputDigests;
  readonly runContractDigest: string;
  readonly timestamp?: string;
  readonly nonce?: string;
}): {
  readonly runId: string;
  readonly temporaryDirectory: string;
  readonly finalDirectory: string;
  readonly pointerPath: string;
} {
  validateRealBuildOutputRoot(input.outputRoot);
  const rawTimestamp = input.timestamp ?? new Date().toISOString();
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(rawTimestamp)) {
    throw new TypeError(
      `Real-build timestamp must be canonical UTC ISO-8601; received ${rawTimestamp}.`,
    );
  }
  const timestamp = rawTimestamp.replaceAll(/[:.]/gu, "-");
  const nonce = input.nonce ?? randomUUID();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u.test(nonce)) {
    throw new TypeError(`Real-build nonce must be a lowercase UUIDv4; received ${nonce}.`);
  }
  const binding = sha256Digest(
    JSON.stringify({
      inputDigests: input.inputDigests,
      runContractDigest: input.runContractDigest,
    }),
  ).slice("sha256:".length, "sha256:".length + 12);
  const runId = `${timestamp}-${binding}-${nonce}`;
  if (!REAL_BUILD_RUN_ID_PATTERN.test(runId)) {
    throw new TypeError(`Real-build run id failed its closed grammar: ${runId}.`);
  }
  const runs = join(input.outputRoot, "runs");
  return {
    runId,
    temporaryDirectory: join(runs, `.tmp-${runId}`),
    finalDirectory: join(runs, runId),
    pointerPath: join(runs, "current.json"),
  };
}

/** A rename on one output volume publishes the complete run directory at once. */
export function beginAtomicRun(plan: ReturnType<typeof planAtomicRunDirectory>): {
  readonly directory: string;
  publish: (verify?: (directory: string) => void) => Promise<string>;
} {
  mkdirSync(dirname(plan.temporaryDirectory), { recursive: true });
  mkdirSync(plan.temporaryDirectory);
  let published = false;
  return {
    directory: plan.temporaryDirectory,
    publish: async (verify) => {
      if (published) throw new Error(`Real-build run ${plan.runId} was already published.`);
      const sourceMirror = resolveRealBuildPath(plan.temporaryDirectory, "source-snapshot", {
        label: "transient real-build source execution mirror",
      });
      if (existsSync(sourceMirror)) {
        try {
          rmSync(sourceMirror, { recursive: true, maxRetries: 7, retryDelay: 50 });
        } catch (error) {
          throw new Error(
            `Real-build run ${plan.runId} cannot publish while its transient source execution mirror ` +
              `remains at ${sourceMirror}. Close task-owned readers of that mirror and retry publication: ` +
              `${error instanceof Error ? error.message : String(error)}.`,
            { cause: error },
          );
        }
      }
      verify?.(plan.temporaryDirectory);
      const closure = verifyRealBuildReplayClosure(plan.temporaryDirectory);
      for (let attempt = 0; ; attempt += 1) {
        try {
          await rename(plan.temporaryDirectory, plan.finalDirectory);
          break;
        } catch (error) {
          const code = (error as NodeJS.ErrnoException).code;
          if ((code !== "EPERM" && code !== "EBUSY") || attempt >= 7) throw error;
          await new Promise((resolve) => setTimeout(resolve, 25 * (attempt + 1)));
        }
      }
      const pointer = {
        schemaVersion: "lego.real-build-run-pointer/1",
        runId: plan.runId,
        replayClosureDigest: closure.manifestDigest,
      };
      const pointerTemporary = `${plan.pointerPath}.tmp-${randomUUID()}`;
      writeFileSync(pointerTemporary, `${JSON.stringify(pointer)}\n`, { flag: "wx" });
      for (let attempt = 0; ; attempt += 1) {
        try {
          await rename(pointerTemporary, plan.pointerPath);
          break;
        } catch (error) {
          const code = (error as NodeJS.ErrnoException).code;
          if ((code !== "EPERM" && code !== "EBUSY") || attempt >= 7) throw error;
          await new Promise((resolve) => setTimeout(resolve, 25 * (attempt + 1)));
        }
      }
      published = true;
      return plan.finalDirectory;
    },
  };
}
