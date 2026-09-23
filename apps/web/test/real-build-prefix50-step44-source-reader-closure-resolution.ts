import { lstatSync } from "node:fs";
import { isAbsolute, relative, resolve, sep } from "node:path";

import {
  REAL_BUILD_PREFIX50_STEP44_OWNED_PROCESS_JOB_KINDS,
  type RealBuildPrefix50Step44OwnedProcessJob,
} from "../e2e/real-build-prefix50-subbuild-return-review-process-jobs.ts";
import {
  REAL_BUILD_PREFIX50_STEP44_STATIC_APP_ASSETS,
  REAL_BUILD_PREFIX50_STEP44_STATIC_APP_ROOT,
} from "../e2e/real-build-prefix50-subbuild-return-review-static-app-manifest.ts";
import {
  materializeRealBuildPrefix50Step44ProcessLaunch,
  REAL_BUILD_PREFIX50_STEP44_PROCESS_LAUNCH_TABLE,
} from "../e2e/real-build-prefix50-subbuild-return-review-process-launch-table.ts";
import {
  snapshotStep44ClosureFile,
  type Step44ClosureFileKind,
  type Step44ClosureFileSnapshot,
} from "./real-build-prefix50-step44-source-reader-closure-files.ts";

const STEP44_WORKSPACE_PACKAGE_DIRECTORIES = Object.freeze({
  "@lego-studio/brick-kernel": "packages/brick-kernel",
  "@lego-studio/catalog": "packages/catalog",
  "@lego-studio/protocol": "packages/protocol",
  "@lego-studio/rendering": "packages/rendering",
} satisfies Readonly<Record<string, string>>);

function candidateExists(path: string): boolean {
  try {
    return lstatSync(path).isFile();
  } catch {
    return false;
  }
}

export function step44ClosureTargetKind(file: string): Step44ClosureFileKind {
  if (file.endsWith(".dll")) return "external-immutable-binary";
  return file.endsWith(".ps1") || file.endsWith(".json")
    ? "external-immutable-helper"
    : "typescript-source";
}

export function resolveStep44WorkspaceExport(input: {
  readonly repositoryRoot: string;
  readonly specifier: string;
  readonly manifests: Map<string, Step44ClosureFileSnapshot>;
}): Readonly<{ manifest: Step44ClosureFileSnapshot; target: string }> {
  const match = /^(@lego-studio\/[^/]+)(\/.*)?$/u.exec(input.specifier);
  const packageName = match?.[1];
  const packageSubpath = match?.[2];
  if (packageName === undefined)
    throw new TypeError(`Step-44 workspace package specifier is malformed: ${input.specifier}.`);
  const packageDirectory =
    STEP44_WORKSPACE_PACKAGE_DIRECTORIES[
      packageName as keyof typeof STEP44_WORKSPACE_PACKAGE_DIRECTORIES
    ];
  if (packageDirectory === undefined)
    throw new TypeError(`Step-44 workspace package is outside its exact roster: ${packageName}.`);
  const packageRoot = resolve(input.repositoryRoot, packageDirectory);
  const manifestPath = resolve(packageRoot, "package.json");
  let manifest = input.manifests.get(manifestPath);
  if (manifest === undefined) {
    manifest = snapshotStep44ClosureFile({
      candidate: manifestPath,
      repositoryRoot: input.repositoryRoot,
      kind: "external-immutable-helper",
    });
    input.manifests.set(manifestPath, manifest);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(manifest.text);
  } catch (error) {
    throw new TypeError(`Step-44 workspace package manifest is invalid JSON: ${packageName}.`, {
      cause: error,
    });
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed))
    throw new TypeError(`Step-44 workspace package manifest is not an object: ${packageName}.`);
  const record = parsed as Readonly<Record<string, unknown>>;
  if (
    record.name !== packageName ||
    record.private !== true ||
    record.type !== "module" ||
    record.exports === null ||
    typeof record.exports !== "object" ||
    Array.isArray(record.exports)
  )
    throw new TypeError(`Step-44 workspace package identity/exports are invalid: ${packageName}.`);
  const exportKey = packageSubpath === undefined ? "." : `.${packageSubpath}`;
  const exportTarget = (record.exports as Readonly<Record<string, unknown>>)[exportKey];
  if (
    typeof exportTarget !== "string" ||
    !exportTarget.startsWith("./") ||
    exportTarget.includes("\\") ||
    exportTarget.includes("\0")
  )
    throw new TypeError(
      `Step-44 workspace package export is not one literal local target: ${input.specifier}.`,
    );
  const target = resolve(packageRoot, exportTarget);
  const local = relative(packageRoot, target);
  if (local.length === 0 || local === ".." || local.startsWith(`..${sep}`) || isAbsolute(local))
    throw new TypeError(
      `Step-44 workspace package export escaped its package: ${input.specifier}.`,
    );
  if (!candidateExists(target))
    throw new TypeError(`Step-44 workspace package export is absent: ${input.specifier}.`);
  return { manifest, target };
}

function sampleJob(jobKind: string): RealBuildPrefix50Step44OwnedProcessJob {
  if (jobKind === "static-app-server") return { jobKind, port: 1 };
  if (jobKind === "containment-transient-parent") return { jobKind, detachGrandchild: false };
  if (jobKind === "playwright-browser-worker" || jobKind === "containment-hold") return { jobKind };
  throw new TypeError(`Step-44 finite launch table contains unknown job ${jobKind}.`);
}

export function finiteStep44LaunchTargets(
  repositoryRoot: string,
  opaqueSnapshots: Map<string, Step44ClosureFileSnapshot>,
): readonly Readonly<{
  file: string;
  kind: Step44ClosureFileKind;
  targetClass: "local-script" | "trusted-dependency-script";
}>[] {
  const keys = Object.keys(REAL_BUILD_PREFIX50_STEP44_PROCESS_LAUNCH_TABLE);
  if (keys.join("\n") !== REAL_BUILD_PREFIX50_STEP44_OWNED_PROCESS_JOB_KINDS.join("\n"))
    throw new TypeError("Step-44 launch table does not equal its exact finite job roster.");
  return keys.map((jobKind) => {
    const launch = materializeRealBuildPrefix50Step44ProcessLaunch(sampleJob(jobKind));
    if (launch.arguments.filter((argument) => argument === launch.target).length !== 1)
      throw new TypeError(`Step-44 finite job ${jobKind} did not materialize one target.`);
    if (jobKind === "static-app-server")
      for (const asset of REAL_BUILD_PREFIX50_STEP44_STATIC_APP_ASSETS) {
        const snapshot = snapshotStep44ClosureFile({
          candidate: resolve(
            repositoryRoot,
            REAL_BUILD_PREFIX50_STEP44_STATIC_APP_ROOT,
            asset.relativePath,
          ),
          repositoryRoot,
          kind: "external-immutable-helper",
        });
        if (snapshot.digest !== asset.digest || snapshot.bytes.byteLength !== asset.bytes)
          throw new TypeError(
            `Step-44 static app asset changed without reviewed repin: ${asset.relativePath}.`,
          );
        opaqueSnapshots.set(snapshot.file, snapshot);
      }
    return {
      file: launch.target,
      kind:
        launch.targetClass === "trusted-dependency-script"
          ? "external-immutable-helper"
          : step44ClosureTargetKind(launch.target),
      targetClass: launch.targetClass,
    };
  });
}
