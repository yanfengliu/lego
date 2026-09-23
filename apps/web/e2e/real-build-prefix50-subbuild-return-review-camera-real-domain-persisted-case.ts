import { createHash } from "node:crypto";
import { lstatSync, realpathSync } from "node:fs";
import { readdirSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";

import { canonicalDigest, type Sha256Digest } from "@lego-studio/brick-kernel";

import { readContainedBoundedRegularFile } from "./bounded-file-read.ts";
import { sha256RealBuildPrefix50Step44ReviewBytes } from "./real-build-prefix50-subbuild-return-review-artifact-io.ts";
import type { RealBuildPrefix50Step44RealDomainObservation } from "./real-build-prefix50-subbuild-return-review-camera-real-domain-calibration-contract.ts";
import type { PersistedCaseManifest } from "./real-build-prefix50-subbuild-return-review-camera-real-domain-evidence.ts";
import {
  deriveRealBuildPrefix50Step44ExactPersistedSourceArtifacts,
  deriveRealBuildPrefix50Step44PersistedRenderArtifactNames,
  REAL_BUILD_PREFIX50_STEP44_PERSISTED_CASE_SOURCE_FILES,
  requireRealBuildPrefix50Step44PersistedObservationMatchesCase,
  requireRealBuildPrefix50Step44PersistedSearchAttempt,
} from "./real-build-prefix50-subbuild-return-review-camera-real-domain-persisted-case-contract.ts";
import { independentlyReplayPersistedRealBuildPrefix50Step44RealDomainCase } from "./real-build-prefix50-subbuild-return-review-camera-real-domain-persisted-semantics.ts";
import {
  requireRealBuildPrefix50Step44RealDomainPredecessorCase,
  type RealBuildPrefix50Step44RealDomainPredecessorCase,
} from "./real-build-prefix50-subbuild-return-review-camera-real-domain-predecessor.ts";
import {
  requireRealBuildPrefix50Step44RealDomainSourceCase,
  type RealBuildPrefix50Step44RealDomainSourceCase,
} from "./real-build-prefix50-subbuild-return-review-camera-real-domain-source.ts";
import { decodeRealBuildPrefix50Step44ReviewPng } from "./real-build-prefix50-subbuild-return-review-png.ts";
import {
  prospectiveRealBuildPrefix50Step44CalibrationFinalPath,
  type RealBuildPrefix50Step44CalibrationDirectoryTransaction,
} from "./real-build-prefix50-step44-calibration-directory-transaction.ts";

const CASE_MANIFEST_FILE = "real-domain-camera-case.json";
const WIDTH = 720;
const HEIGHT = 470;
const offlineCaseStates = new WeakMap<object, RealBuildPrefix50Step44OfflineVerifiedCaseState>();

function sha256(bytes: Uint8Array): Sha256Digest {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function withoutCommitment(value: object): Record<string, unknown> {
  const body = { ...value } as Record<string, unknown>;
  Reflect.deleteProperty(body, "commitment");
  return body;
}

function exactKeys(value: object, expected: readonly string[], label: string): void {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (actual.length !== wanted.length || actual.some((key, index) => key !== wanted[index]))
    throw new TypeError(`${label} did not contain its exact persisted schema.`);
}

function exactDirectoryIdentity(path: string): Readonly<{ dev: bigint; ino: bigint }> {
  const state = lstatSync(path, { bigint: true });
  if (state.isSymbolicLink() || !state.isDirectory())
    throw new TypeError(`Persisted real-domain case must remain a real directory: ${path}.`);
  return Object.freeze({ dev: state.dev, ino: state.ino });
}

function requireSameDirectoryIdentity(
  path: string,
  expected: Readonly<{ dev: bigint; ino: bigint }>,
): void {
  const actual = exactDirectoryIdentity(path);
  if (
    actual.ino !== expected.ino ||
    (actual.dev !== 0n && expected.dev !== 0n && actual.dev !== expected.dev)
  )
    throw new TypeError("Persisted real-domain case directory identity changed during replay.");
}

interface PersistedCaseFileIdentity {
  readonly dev: string;
  readonly ino: string;
  readonly size: string;
}

function exactCaseFileIdentity(path: string): PersistedCaseFileIdentity {
  const state = lstatSync(path, { bigint: true });
  if (
    state.isSymbolicLink() ||
    !state.isFile() ||
    state.nlink !== 1n ||
    state.dev < 0n ||
    state.ino <= 0n
  )
    throw new TypeError(`Persisted real-domain case file is linked or non-regular: ${path}.`);
  return Object.freeze({
    dev: state.dev.toString(),
    ino: state.ino.toString(),
    size: state.size.toString(),
  });
}

function requireStableCaseFiles(input: {
  readonly directory: string;
  readonly expectedFiles: readonly string[];
  readonly initialIdentities: ReadonlyMap<string, PersistedCaseFileIdentity>;
  readonly expectedDigests: ReadonlyMap<string, Sha256Digest>;
}): void {
  const observed = readdirSync(input.directory).sort();
  if (
    observed.length !== input.expectedFiles.length ||
    observed.some((file, index) => file !== input.expectedFiles[index])
  )
    throw new TypeError("Persisted real-domain case roster changed during replay.");
  for (const file of observed) {
    const identity = exactCaseFileIdentity(resolve(input.directory, file));
    const initialIdentity = input.initialIdentities.get(file);
    if (
      initialIdentity === undefined ||
      canonicalDigest(identity) !== canonicalDigest(initialIdentity)
    )
      throw new TypeError(`Persisted real-domain case file identity changed: ${file}.`);
    const expectedSha256 = input.expectedDigests.get(file);
    if (expectedSha256 === undefined)
      throw new TypeError(`Persisted real-domain case lost its content digest: ${file}.`);
    readContainedBoundedRegularFile(input.directory, file, {
      label: `persisted real-domain final immutable reread ${file}`,
      maximumBytes: 64 * 1024 * 1024,
      expectedSha256,
    });
  }
  const after = readdirSync(input.directory).sort();
  if (canonicalDigest(after) !== canonicalDigest(observed))
    throw new TypeError("Persisted real-domain case roster changed after final digest reread.");
}

function readBinaryMask(
  directory: string,
  file: string,
  on: readonly [number, number, number],
): Uint8Array {
  const bytes = readContainedBoundedRegularFile(directory, file, {
    label: `persisted real-domain ${file}`,
    maximumBytes: 16 * 1024 * 1024,
  });
  const decoded = decodeRealBuildPrefix50Step44ReviewPng(bytes, WIDTH * HEIGHT, file);
  if (decoded.width !== WIDTH || decoded.height !== HEIGHT)
    throw new TypeError(`Persisted real-domain ${file} must be exactly ${WIDTH}x${HEIGHT}.`);
  const mask = new Uint8Array(WIDTH * HEIGHT);
  for (let index = 0; index < mask.length; index += 1) {
    const offset = index * 4;
    const pixel = [
      decoded.rgba[offset],
      decoded.rgba[offset + 1],
      decoded.rgba[offset + 2],
      decoded.rgba[offset + 3],
    ] as const;
    if (pixel[3] !== 0xff)
      throw new TypeError(`Persisted real-domain ${file} contains non-opaque mask pixels.`);
    if (pixel[0] === on[0] && pixel[1] === on[1] && pixel[2] === on[2]) mask[index] = 1;
    else if (pixel[0] !== 0x28 || pixel[1] !== 0x2b || pixel[2] !== 0x29)
      throw new TypeError(`Persisted real-domain ${file} contains a non-binary mask color.`);
  }
  return mask;
}

export interface RealBuildPrefix50Step44OfflineVerifiedRealDomainCase {
  readonly panelStep: 41 | 42 | 43;
  /** Legacy name: commits the bounded Step-41/42 calibration crop set. */
  readonly pageRasterCommitment: Sha256Digest;
  readonly sharedOrientationAnchorCommitment: Sha256Digest;
  readonly proofCommitment: Sha256Digest;
}

export interface RealBuildPrefix50Step44OfflineVerifiedCaseState {
  readonly sourceCase: RealBuildPrefix50Step44RealDomainSourceCase;
  readonly predecessorCase: RealBuildPrefix50Step44RealDomainPredecessorCase;
  readonly observation: RealBuildPrefix50Step44RealDomainObservation;
}

export function verifyPersistedRealBuildPrefix50Step44RealDomainCaseOffline(input: {
  readonly outputPath: string;
  readonly panelStep: 41 | 42 | 43;
  readonly sourceCase: RealBuildPrefix50Step44RealDomainSourceCase;
  readonly predecessorCase: RealBuildPrefix50Step44RealDomainPredecessorCase;
  readonly observation: RealBuildPrefix50Step44RealDomainObservation;
  readonly publicationTransaction?: RealBuildPrefix50Step44CalibrationDirectoryTransaction;
}): RealBuildPrefix50Step44OfflineVerifiedRealDomainCase {
  const sourceCase = requireRealBuildPrefix50Step44RealDomainSourceCase(input.sourceCase);
  const predecessorCase = requireRealBuildPrefix50Step44RealDomainPredecessorCase(
    input.predecessorCase,
  );
  if (
    sourceCase.panelStep !== input.panelStep ||
    predecessorCase.panelStep !== input.panelStep ||
    sourceCase.splitRole !== predecessorCase.splitRole
  )
    throw new TypeError("Persisted real-domain case mixed its exact source/predecessor panel.");
  const candidate = resolve(input.outputPath, `step-${input.panelStep}`);
  const directory = realpathSync(candidate);
  if (dirname(directory) !== input.outputPath || basename(directory) !== `step-${input.panelStep}`)
    throw new TypeError("Persisted real-domain case escaped its exact qualification output.");
  const identity = exactDirectoryIdentity(directory);
  const manifestBytes = readContainedBoundedRegularFile(directory, CASE_MANIFEST_FILE, {
    label: `persisted real-domain Step-${input.panelStep} case manifest`,
    maximumBytes: 64 * 1024 * 1024,
  });
  const manifest = JSON.parse(manifestBytes.toString("utf8")) as PersistedCaseManifest;
  const sourceArtifacts = deriveRealBuildPrefix50Step44ExactPersistedSourceArtifacts(sourceCase);
  exactKeys(
    manifest,
    [
      "activeChildDocumentCommitment",
      "activeChildDocumentHash",
      "artifactBindings",
      "artifactBindingsCommitment",
      "artifactFiles",
      "authority",
      "commitment",
      "independentReplayCommitment",
      "observationCommitment",
      "pageRasterCommitment",
      "panelStep",
      "perPanelLatticeCounterevidence",
      "predecessorCaseCommitment",
      "runtimeStateCommitment",
      "schemaVersion",
      "searchAttempt",
      "searchAttemptCommitment",
      "semanticPolicyCommitment",
      "sharedOrientationAnchor",
      "sourceCaseCommitment",
      "sourceLockCommitment",
      "splitRole",
    ],
    "Persisted real-domain case manifest",
  );
  const entries = readdirSync(directory, { withFileTypes: true });
  const files: string[] = [];
  const initialFileIdentities = new Map<string, PersistedCaseFileIdentity>();
  for (const entry of entries) {
    if (!entry.isFile())
      throw new TypeError("Persisted real-domain case contains a linked or non-regular entry.");
    initialFileIdentities.set(entry.name, exactCaseFileIdentity(resolve(directory, entry.name)));
    files.push(entry.name);
  }
  const expectedFiles = [...manifest.artifactFiles, CASE_MANIFEST_FILE].sort();
  files.sort();
  if (
    manifest.schemaVersion !== "lego.real-build-prefix50-real-domain-camera-case/1" ||
    manifest.authority !== "none" ||
    manifest.panelStep !== input.panelStep ||
    manifest.splitRole !== (input.panelStep === 43 ? "held-out-validation" : "calibration") ||
    manifest.sourceLockCommitment !== sourceCase.sourceLockCommitment ||
    manifest.pageRasterCommitment !== sourceCase.pageRasterCommitment ||
    manifest.sourceCaseCommitment !== sourceCase.sourceCaseCommitment ||
    canonicalDigest(manifest.sharedOrientationAnchor) !==
      canonicalDigest(sourceCase.sharedOrientationAnchor) ||
    canonicalDigest(manifest.perPanelLatticeCounterevidence) !==
      canonicalDigest(sourceCase.perPanelLatticeCounterevidence) ||
    manifest.predecessorCaseCommitment !== predecessorCase.commitment ||
    manifest.activeChildDocumentHash !== predecessorCase.activeChildPredecessor.documentHash ||
    manifest.activeChildDocumentCommitment !==
      predecessorCase.activeChildPredecessor.documentCommitment ||
    manifest.commitment !== canonicalDigest(withoutCommitment(manifest)) ||
    manifest.observationCommitment !== input.observation.observationCommitment ||
    manifest.searchAttemptCommitment !== manifest.searchAttempt.commitment ||
    manifest.artifactBindingsCommitment !== canonicalDigest(manifest.artifactBindings) ||
    manifest.sharedOrientationAnchor.commitment !==
      canonicalDigest(withoutCommitment(manifest.sharedOrientationAnchor)) ||
    manifest.perPanelLatticeCounterevidence.commitment !==
      canonicalDigest(withoutCommitment(manifest.perPanelLatticeCounterevidence)) ||
    canonicalDigest(manifest.artifactFiles) !==
      canonicalDigest(manifest.artifactBindings.map(({ artifactFile }) => artifactFile)) ||
    files.length !== expectedFiles.length ||
    files.some((file, index) => file !== expectedFiles[index])
  )
    throw new TypeError("Persisted real-domain case manifest or exact roster drifted.");
  const artifactBytes: Record<string, Uint8Array> = {};
  for (const binding of manifest.artifactBindings) {
    const bytes = readContainedBoundedRegularFile(directory, binding.artifactFile, {
      label: `persisted real-domain artifact ${binding.artifactFile}`,
      maximumBytes: 16 * 1024 * 1024,
      exactBytes: binding.byteLength,
    });
    const expectedSource =
      sourceArtifacts[
        binding.artifactFile as (typeof REAL_BUILD_PREFIX50_STEP44_PERSISTED_CASE_SOURCE_FILES)[number]
      ];
    if (
      sha256(bytes) !== binding.pngDigest ||
      (expectedSource !== undefined && !Buffer.from(bytes).equals(Buffer.from(expectedSource)))
    )
      throw new TypeError(`Persisted real-domain artifact ${binding.artifactFile} drifted.`);
    artifactBytes[binding.artifactFile] = new Uint8Array(bytes);
  }
  const eligible = readBinaryMask(directory, "eligible-mask.png", [0xe8, 0xee, 0xe9]);
  const target = readBinaryMask(directory, "parent-target-mask.png", [0xff, 0x30, 0xd8]);
  const source = readContainedBoundedRegularFile(directory, "source-crop.png", {
    label: "persisted real-domain source crop",
    maximumBytes: 16 * 1024 * 1024,
  });
  const decodedSource = decodeRealBuildPrefix50Step44ReviewPng(
    source,
    WIDTH * HEIGHT,
    "source crop",
  );
  if (decodedSource.width !== WIDTH || decodedSource.height !== HEIGHT)
    throw new TypeError("Persisted real-domain source crop must be exactly 720x470.");
  requireRealBuildPrefix50Step44PersistedSearchAttempt(
    manifest.searchAttempt,
    eligible,
    target,
    sha256RealBuildPrefix50Step44ReviewBytes,
  );
  const renders = manifest.artifactBindings.filter(
    ({ artifactFile }) =>
      !REAL_BUILD_PREFIX50_STEP44_PERSISTED_CASE_SOURCE_FILES.includes(
        artifactFile as (typeof REAL_BUILD_PREFIX50_STEP44_PERSISTED_CASE_SOURCE_FILES)[number],
      ),
  );
  if (
    canonicalDigest(renders.map(({ artifactFile }) => artifactFile)) !==
    canonicalDigest(
      deriveRealBuildPrefix50Step44PersistedRenderArtifactNames(manifest.searchAttempt),
    )
  )
    throw new TypeError("Persisted real-domain render roster drifted from its search attempt.");
  requireRealBuildPrefix50Step44PersistedObservationMatchesCase({
    manifest,
    observation: input.observation,
    renderBindings: renders,
  });
  const decodedArtifacts = Object.freeze(
    Object.fromEntries(
      renders.map(({ artifactFile }) => {
        const pngBytes = artifactBytes[artifactFile]!;
        const decoded = decodeRealBuildPrefix50Step44ReviewPng(
          pngBytes,
          WIDTH * HEIGHT,
          `persisted semantic replay ${artifactFile}`,
        );
        if (decoded.width !== WIDTH || decoded.height !== HEIGHT)
          throw new TypeError(
            `Persisted semantic replay ${artifactFile} must be exactly ${WIDTH}x${HEIGHT}.`,
          );
        return [artifactFile, { pngBytes, rgba: decoded.rgba }];
      }),
    ),
  );
  const semanticReplay = independentlyReplayPersistedRealBuildPrefix50Step44RealDomainCase({
    sourceCase,
    predecessorCase,
    observation: input.observation,
    attempt: manifest.searchAttempt,
    artifacts: decodedArtifacts,
  });
  if (
    manifest.semanticPolicyCommitment !== semanticReplay.semanticPolicyCommitment ||
    manifest.runtimeStateCommitment !== semanticReplay.runtimeStateCommitment ||
    manifest.independentReplayCommitment !== semanticReplay.independentReplayCommitment
  )
    throw new TypeError(
      "Persisted real-domain runtime state or independent camera replay did not reproduce.",
    );
  const expectedDigests = new Map<string, Sha256Digest>([
    [CASE_MANIFEST_FILE, sha256(manifestBytes)],
    ...manifest.artifactBindings.map(
      ({ artifactFile, pngDigest }) => [artifactFile, pngDigest] as const,
    ),
  ]);
  requireStableCaseFiles({
    directory,
    expectedFiles,
    initialIdentities: initialFileIdentities,
    expectedDigests,
  });
  requireSameDirectoryIdentity(directory, identity);
  const proofBody = {
    schemaVersion: "lego.real-build-prefix50-verified-real-domain-camera-case/1" as const,
    panelStep: input.panelStep,
    outputRealPathCommitment: canonicalDigest({
      realPath:
        input.publicationTransaction === undefined
          ? directory
          : prospectiveRealBuildPrefix50Step44CalibrationFinalPath(
              input.publicationTransaction,
              directory,
            ),
    }),
    caseManifestCommitment: manifest.commitment,
    observationCommitment: manifest.observationCommitment,
    searchAttemptCommitment: manifest.searchAttemptCommitment,
  };
  const proof = Object.freeze({
    panelStep: input.panelStep,
    pageRasterCommitment: manifest.pageRasterCommitment,
    sharedOrientationAnchorCommitment: manifest.sharedOrientationAnchor.commitment,
    proofCommitment: canonicalDigest(proofBody),
  });
  offlineCaseStates.set(
    proof,
    Object.freeze({ sourceCase, predecessorCase, observation: input.observation }),
  );
  return proof;
}

export function requirePersistedRealBuildPrefix50Step44RealDomainCaseOffline(
  proof: RealBuildPrefix50Step44OfflineVerifiedRealDomainCase,
): RealBuildPrefix50Step44OfflineVerifiedCaseState {
  const state = offlineCaseStates.get(proof);
  if (
    state === undefined ||
    proof.panelStep !== state.sourceCase.panelStep ||
    proof.panelStep !== state.predecessorCase.panelStep ||
    proof.pageRasterCommitment !== state.sourceCase.pageRasterCommitment
  )
    throw new TypeError("Persisted real-domain case proof lacks its exact runtime replay brand.");
  return state;
}
