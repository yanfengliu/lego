import { createHash } from "node:crypto";
import { lstatSync, readdirSync, realpathSync } from "node:fs";
import { resolve } from "node:path";

import { canonicalDigest } from "@lego-studio/brick-kernel";

import { readContainedBoundedRegularFile } from "./bounded-file-read.ts";
import { requireRealBuildPrefix50Step44RealDomainOutputChild } from "./real-build-prefix50-subbuild-return-review-camera-real-domain-evidence.ts";
import { assertWindowsPathsHaveOnlyDefaultDataStreams } from "./windows-alternate-data-streams.ts";

const GATE_MANIFEST_FILE = "real-domain-camera-gate.json";

interface RealDomainGateTreeSnapshot {
  readonly root: Readonly<{ dev: string; ino: string }>;
  readonly entries: readonly Readonly<{
    name: string;
    kind: "file" | "directory";
    dev: string;
    ino: string;
    size: string;
    digest?: `sha256:${string}`;
    files?: readonly Readonly<{
      name: string;
      dev: string;
      ino: string;
      size: string;
      digest: `sha256:${string}`;
    }>[];
  }>[];
}

function digest(root: string, file: string): `sha256:${string}` {
  const bytes = readContainedBoundedRegularFile(root, file, {
    label: `real-domain camera gate immutable tree entry ${file}`,
    maximumBytes: 64 * 1024 * 1024,
  });
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function names(path: string): string[] {
  return readdirSync(path).sort((left, right) => left.localeCompare(right));
}

function gateTreeIdentity(
  outputPath: string,
  persistedCaseCount: 2 | 3,
): RealDomainGateTreeSnapshot {
  const root = lstatSync(outputPath, { bigint: true });
  if (
    !root.isDirectory() ||
    root.isSymbolicLink() ||
    root.dev < 0n ||
    root.ino <= 0n ||
    realpathSync.native(outputPath) !== outputPath
  )
    throw new TypeError(
      "Real-domain camera gate output root must remain one exact real directory.",
    );
  const expectedNames = [
    GATE_MANIFEST_FILE,
    "real-domain-camera-static-app.log",
    ...Array.from({ length: persistedCaseCount }, (_, index) => `step-${index + 41}`),
  ].sort();
  const observedNames = names(outputPath);
  if (
    observedNames.length !== expectedNames.length ||
    observedNames.some((name, index) => name !== expectedNames[index])
  )
    throw new TypeError(
      `Real-domain camera gate output must contain only its static-app log, gate manifest, and exact ordered ${persistedCaseCount}-case evidence tree.`,
    );
  const entries = observedNames.map((name) => {
    const path = resolve(outputPath, name);
    const state = lstatSync(path, { bigint: true });
    if (state.isSymbolicLink() || state.dev < 0n || state.ino <= 0n)
      throw new TypeError(`Real-domain camera gate entry ${name} is linked or unidentifiable.`);
    if (name === GATE_MANIFEST_FILE || name === "real-domain-camera-static-app.log") {
      if (!state.isFile() || state.nlink !== 1n)
        throw new TypeError(
          `Real-domain camera gate file ${name} must be singly linked and regular.`,
        );
      return Object.freeze({
        name,
        kind: "file" as const,
        dev: state.dev.toString(),
        ino: state.ino.toString(),
        size: state.size.toString(),
        digest: digest(outputPath, name),
      });
    }
    if (!state.isDirectory() || realpathSync.native(path) !== path)
      throw new TypeError(`Real-domain camera gate case ${name} must be one exact real directory.`);
    const files = names(path).map((file) => {
      const fileState = lstatSync(resolve(path, file), { bigint: true });
      if (
        fileState.isSymbolicLink() ||
        !fileState.isFile() ||
        fileState.nlink !== 1n ||
        fileState.dev < 0n ||
        fileState.ino <= 0n
      )
        throw new TypeError(
          `Real-domain camera gate case ${name} contains a linked, nested, or non-regular entry ${file}.`,
        );
      return Object.freeze({
        name: file,
        dev: fileState.dev.toString(),
        ino: fileState.ino.toString(),
        size: fileState.size.toString(),
        digest: digest(path, file),
      });
    });
    return Object.freeze({
      name,
      kind: "directory" as const,
      dev: state.dev.toString(),
      ino: state.ino.toString(),
      size: state.size.toString(),
      files: Object.freeze(files),
    });
  });
  assertWindowsPathsHaveOnlyDefaultDataStreams(
    [
      outputPath,
      ...entries.flatMap((entry) => [
        resolve(outputPath, entry.name),
        ...("files" in entry
          ? entry.files.map((file) => resolve(outputPath, entry.name, file.name))
          : []),
      ]),
    ],
    "Real-domain camera gate output tree",
  );
  return Object.freeze({
    root: Object.freeze({ dev: root.dev.toString(), ino: root.ino.toString() }),
    entries: Object.freeze(entries),
  });
}

interface StableGateTreeInput {
  readonly outputPath: string;
  readonly persistedCaseCount: 2 | 3;
  readonly __testHooks?: Readonly<{ afterEnumeration?: () => Promise<void> | void }>;
}

export function captureRealBuildPrefix50Step44RealDomainGateOutputTreeCommitment(
  input: Pick<StableGateTreeInput, "outputPath" | "persistedCaseCount">,
): `sha256:${string}` {
  return canonicalDigest(gateTreeIdentity(resolve(input.outputPath), input.persistedCaseCount));
}

export async function withStableRealBuildPrefix50Step44RealDomainGateOutputTree<Result>(
  input: StableGateTreeInput,
  verify: () => Promise<Result> | Result,
): Promise<Result> {
  const outputPath = await requireRealBuildPrefix50Step44RealDomainOutputChild(input.outputPath);
  if (input.__testHooks !== undefined && process.env.NODE_ENV !== "test")
    throw new TypeError("Real-domain tree race hooks are available only to tests.");
  const before = gateTreeIdentity(outputPath, input.persistedCaseCount);
  await input.__testHooks?.afterEnumeration?.();
  const result = await verify();
  const after = gateTreeIdentity(outputPath, input.persistedCaseCount);
  if (canonicalDigest(before) !== canonicalDigest(after))
    throw new TypeError("Real-domain camera gate output tree changed during verification.");
  return result;
}

export async function assertRealBuildPrefix50Step44RealDomainGateOutputTree(
  input: StableGateTreeInput,
): Promise<void> {
  await withStableRealBuildPrefix50Step44RealDomainGateOutputTree(input, () => undefined);
}
