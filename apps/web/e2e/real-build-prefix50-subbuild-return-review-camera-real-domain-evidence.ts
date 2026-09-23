import { createHash } from "node:crypto";
import { lstat, mkdir, readdir, realpath } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";

import { canonicalDigest, type Sha256Digest } from "@lego-studio/brick-kernel";

import { readContainedBoundedRegularFile } from "./bounded-file-read.ts";
import { writeContainedRegularFileAtomic } from "./contained-atomic-write.ts";
import { REAL_BUILD_PREFIX50_STEP44_REVIEW_OUTPUT_ROOT } from "./real-build-prefix50-subbuild-return-review-harness-input.ts";
import { replayRealBuildPrefix50Step44RealDomainObservationCommitment } from "./real-build-prefix50-subbuild-return-review-camera-real-domain-calibration-contract.ts";
import {
  requireRealBuildPrefix50Step44RealDomainCapturedCase,
  type RealBuildPrefix50Step44RealDomainCapturedCase,
} from "./real-build-prefix50-subbuild-return-review-camera-real-domain-capture.ts";
import { requireRealBuildPrefix50Step44RealDomainSourceCase } from "./real-build-prefix50-subbuild-return-review-camera-real-domain-source.ts";
import type { SharedOrientationAnchor } from "./real-build-prefix50-subbuild-return-review-camera-real-domain-lattice.ts";
import { requireRealBuildPrefix50LiveCameraSearchAttemptEvidence } from "./real-build-prefix50-subbuild-return-review-camera-search.ts";
import { encodeCanonicalRealBuildPrefix50Step44ReviewPng } from "./real-build-prefix50-subbuild-return-review-png.ts";
import { independentlyReplayRealBuildPrefix50Step44RealDomainCapture } from "./real-build-prefix50-subbuild-return-review-camera-real-domain-replay.ts";
import {
  prospectiveRealBuildPrefix50Step44CalibrationFinalPath,
  type RealBuildPrefix50Step44CalibrationDirectoryTransaction,
} from "./real-build-prefix50-step44-calibration-directory-transaction.ts";

const CASE_MANIFEST_FILE = "real-domain-camera-case.json";
const SOURCE_CROP_FILE = "source-crop.png";
const ELIGIBLE_MASK_FILE = "eligible-mask.png";
const PARENT_TARGET_FILE = "parent-target-mask.png";
const WIDTH = 720;
const HEIGHT = 470;
const caseProofBrands = new WeakMap<object, RealBuildPrefix50Step44RealDomainCapturedCase>();

function sha256(bytes: Uint8Array): Sha256Digest {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function withoutCommitment<T extends { readonly commitment: unknown }>(
  value: T,
): Omit<T, "commitment"> {
  const { commitment, ...body } = value;
  void commitment;
  return body;
}

function maskPng(mask: Uint8Array, on: readonly [number, number, number]): Uint8Array {
  if (!(mask instanceof Uint8Array) || mask.byteLength !== WIDTH * HEIGHT)
    throw new TypeError("Real-domain persisted source mask must contain exactly 720x470 pixels.");
  const rgba = new Uint8Array(mask.byteLength * 4);
  for (let index = 0; index < mask.length; index += 1) {
    if (mask[index] !== 0 && mask[index] !== 1)
      throw new TypeError("Real-domain persisted source mask must be binary.");
    const offset = index * 4;
    const color = mask[index] === 1 ? on : ([0x28, 0x2b, 0x29] as const);
    rgba[offset] = color[0];
    rgba[offset + 1] = color[1];
    rgba[offset + 2] = color[2];
    rgba[offset + 3] = 0xff;
  }
  return encodeCanonicalRealBuildPrefix50Step44ReviewPng({ width: WIDTH, height: HEIGHT, rgba });
}

function sourceArtifacts(capture: RealBuildPrefix50Step44RealDomainCapturedCase) {
  const source = requireRealBuildPrefix50Step44RealDomainSourceCase(capture.sourceCase);
  return Object.freeze({
    [SOURCE_CROP_FILE]: encodeCanonicalRealBuildPrefix50Step44ReviewPng({
      width: WIDTH,
      height: HEIGHT,
      rgba: source.rgba,
    }),
    [ELIGIBLE_MASK_FILE]: maskPng(source.eligibleMask, [0xe8, 0xee, 0xe9]),
    [PARENT_TARGET_FILE]: maskPng(source.parentOnlyForegroundMask, [0xff, 0x30, 0xd8]),
  });
}

export interface PersistedCaseManifest {
  readonly schemaVersion: "lego.real-build-prefix50-real-domain-camera-case/1";
  readonly authority: "none";
  readonly panelStep: 41 | 42 | 43;
  readonly splitRole: "calibration" | "held-out-validation";
  readonly sourceLockCommitment: Sha256Digest;
  /** Legacy name: commits measured Step-41/42 crop rows only. */
  readonly pageRasterCommitment: Sha256Digest;
  readonly sourceCaseCommitment: Sha256Digest;
  readonly sharedOrientationAnchor: SharedOrientationAnchor;
  readonly perPanelLatticeCounterevidence: RealBuildPrefix50Step44RealDomainCapturedCase["sourceCase"]["perPanelLatticeCounterevidence"];
  readonly predecessorCaseCommitment: Sha256Digest;
  readonly activeChildDocumentHash: Sha256Digest;
  readonly activeChildDocumentCommitment: Sha256Digest;
  readonly semanticPolicyCommitment: Sha256Digest;
  readonly observationCommitment: Sha256Digest;
  readonly runtimeStateCommitment: Sha256Digest;
  readonly independentReplayCommitment: Sha256Digest;
  readonly searchAttemptCommitment: Sha256Digest;
  readonly searchAttempt: RealBuildPrefix50Step44RealDomainCapturedCase["attemptEvidence"]["attempt"];
  readonly artifactFiles: readonly string[];
  readonly artifactBindings: readonly {
    readonly artifactFile: string;
    readonly byteLength: number;
    readonly pngDigest: Sha256Digest;
  }[];
  readonly artifactBindingsCommitment: Sha256Digest;
  readonly commitment: Sha256Digest;
}

export interface RealBuildPrefix50Step44VerifiedPersistedRealDomainCase {
  readonly schemaVersion: "lego.real-build-prefix50-verified-real-domain-camera-case/1";
  readonly panelStep: 41 | 42 | 43;
  readonly outputRealPathCommitment: Sha256Digest;
  readonly caseManifestCommitment: Sha256Digest;
  readonly observationCommitment: Sha256Digest;
  readonly searchAttemptCommitment: Sha256Digest;
  readonly commitment: Sha256Digest;
}

export async function requireRealBuildPrefix50Step44RealDomainOutputChild(
  outputPath: string,
): Promise<string> {
  const [root, output] = await Promise.all([
    realpath(REAL_BUILD_PREFIX50_STEP44_REVIEW_OUTPUT_ROOT),
    realpath(outputPath),
  ]);
  if (dirname(output) !== root)
    throw new TypeError("Real-domain calibration output must be a direct task-root child.");
  return output;
}

function caseDirectory(outputPath: string, panelStep: 41 | 42 | 43): string {
  return resolve(outputPath, `step-${panelStep}`);
}

async function exactDirectoryIdentity(path: string) {
  const state = await lstat(path, { bigint: true });
  if (state.isSymbolicLink() || !state.isDirectory())
    throw new TypeError(`Real-domain evidence directory must remain a real directory: ${path}.`);
  return Object.freeze({ dev: state.dev, ino: state.ino });
}

async function requireSameDirectoryIdentity(
  path: string,
  expected: Readonly<{ dev: bigint; ino: bigint }>,
): Promise<void> {
  const actual = await exactDirectoryIdentity(path);
  if (
    actual.ino !== expected.ino ||
    (actual.dev !== 0n && expected.dev !== 0n && actual.dev !== expected.dev)
  )
    throw new TypeError(
      `Real-domain evidence directory identity changed during publication: ${path}.`,
    );
}

export async function persistRealBuildPrefix50Step44RealDomainCase(input: {
  readonly outputPath: string;
  readonly capture: RealBuildPrefix50Step44RealDomainCapturedCase;
  readonly publicationTransaction: RealBuildPrefix50Step44CalibrationDirectoryTransaction;
}): Promise<RealBuildPrefix50Step44VerifiedPersistedRealDomainCase> {
  const outputPath = await requireRealBuildPrefix50Step44RealDomainOutputChild(input.outputPath);
  const capture = requireRealBuildPrefix50Step44RealDomainCapturedCase(input.capture);
  const source = requireRealBuildPrefix50Step44RealDomainSourceCase(capture.sourceCase);
  const evidence = requireRealBuildPrefix50LiveCameraSearchAttemptEvidence(capture.attemptEvidence);
  const independentReplay = independentlyReplayRealBuildPrefix50Step44RealDomainCapture(capture);
  const bindingFailures = [
    ...(source.sharedOrientationAnchor === null
      ? ["source shared-orientation anchor is absent"]
      : []),
    ...(capture.panelStep !== source.panelStep
      ? [`capture panel ${capture.panelStep} does not match source panel ${source.panelStep}`]
      : []),
    ...(capture.observation.liveSearchAttemptCommitment !== evidence.attempt.commitment
      ? ["observation live-search attempt commitment does not match captured evidence"]
      : []),
    ...(capture.observation.observationCommitment !==
    replayRealBuildPrefix50Step44RealDomainObservationCommitment(capture.observation)
      ? ["observation self commitment does not replay from its exact body"]
      : []),
  ];
  if (bindingFailures.length > 0)
    throw new TypeError(
      `Real-domain panel ${capture.panelStep} case persistence rejected its exact live capture bindings: ${bindingFailures.join("; ")}.`,
    );
  const directory = caseDirectory(outputPath, capture.panelStep);
  await mkdir(directory, { recursive: false });
  const actualDirectory = await realpath(directory);
  const directoryIdentity = await exactDirectoryIdentity(directory);
  if (
    dirname(actualDirectory) !== outputPath ||
    basename(actualDirectory) !== `step-${capture.panelStep}`
  )
    throw new TypeError("Real-domain case directory escaped its exact output child.");
  const artifacts: Readonly<Record<string, Uint8Array>> = Object.freeze({
    ...sourceArtifacts(capture),
    ...evidence.renderArtifacts,
  });
  const artifactFiles = Object.freeze(Object.keys(artifacts).sort());
  const artifactBindings = Object.freeze(
    artifactFiles.map((artifactFile) =>
      Object.freeze({
        artifactFile,
        byteLength: artifacts[artifactFile]!.byteLength,
        pngDigest: sha256(artifacts[artifactFile]!),
      }),
    ),
  );
  const body = {
    schemaVersion: "lego.real-build-prefix50-real-domain-camera-case/1" as const,
    authority: "none" as const,
    panelStep: capture.panelStep,
    splitRole: source.splitRole,
    sourceLockCommitment: source.sourceLockCommitment,
    pageRasterCommitment: source.pageRasterCommitment,
    sourceCaseCommitment: source.sourceCaseCommitment,
    sharedOrientationAnchor: source.sharedOrientationAnchor,
    perPanelLatticeCounterevidence: source.perPanelLatticeCounterevidence,
    predecessorCaseCommitment: capture.predecessorCase.commitment,
    activeChildDocumentHash: capture.predecessorCase.activeChildPredecessor.documentHash,
    activeChildDocumentCommitment:
      capture.predecessorCase.activeChildPredecessor.documentCommitment,
    semanticPolicyCommitment: capture.semanticPolicy.commitment,
    observationCommitment: capture.observation.observationCommitment,
    runtimeStateCommitment: capture.runtimeStateCommitment,
    independentReplayCommitment: independentReplay.commitment,
    searchAttemptCommitment: evidence.attempt.commitment,
    searchAttempt: evidence.attempt,
    artifactFiles,
    artifactBindings,
    artifactBindingsCommitment: canonicalDigest(artifactBindings),
  };
  const manifest = Object.freeze({ ...body, commitment: canonicalDigest(body) });
  for (const artifactFile of artifactFiles) {
    await requireSameDirectoryIdentity(actualDirectory, directoryIdentity);
    writeContainedRegularFileAtomic(actualDirectory, artifactFile, artifacts[artifactFile]!, {
      label: `real-domain panel ${capture.panelStep} artifact ${artifactFile}`,
    });
  }
  await requireSameDirectoryIdentity(actualDirectory, directoryIdentity);
  writeContainedRegularFileAtomic(
    actualDirectory,
    CASE_MANIFEST_FILE,
    `${JSON.stringify(manifest, null, 2)}\n`,
    { label: `real-domain panel ${capture.panelStep} authority manifest` },
  );
  return verifyPersistedRealBuildPrefix50Step44RealDomainCaseAtProofPath({
    outputPath,
    capture,
    proofPath: (physicalPath) =>
      prospectiveRealBuildPrefix50Step44CalibrationFinalPath(
        input.publicationTransaction,
        physicalPath,
      ),
  });
}

async function verifyPersistedRealBuildPrefix50Step44RealDomainCaseAtProofPath(input: {
  readonly outputPath: string;
  readonly capture: RealBuildPrefix50Step44RealDomainCapturedCase;
  readonly proofPath: (physicalPath: string) => string;
}): Promise<RealBuildPrefix50Step44VerifiedPersistedRealDomainCase> {
  requireRealBuildPrefix50Step44RealDomainCapturedCase(input.capture);
  const independentReplay = independentlyReplayRealBuildPrefix50Step44RealDomainCapture(
    input.capture,
  );
  const outputPath = await requireRealBuildPrefix50Step44RealDomainOutputChild(input.outputPath);
  const candidateDirectory = caseDirectory(outputPath, input.capture.panelStep);
  const directoryIdentity = await exactDirectoryIdentity(candidateDirectory);
  const directory = await realpath(candidateDirectory);
  if (dirname(directory) !== outputPath)
    throw new TypeError("Real-domain case verifier escaped output.");
  const manifestBytes = readContainedBoundedRegularFile(directory, CASE_MANIFEST_FILE, {
    label: "real-domain camera case manifest",
    maximumBytes: 64 * 1024 * 1024,
  });
  const manifest = JSON.parse(manifestBytes.toString("utf8")) as PersistedCaseManifest;
  const expectedSourceArtifacts = sourceArtifacts(input.capture);
  const entries = await readdir(directory, { withFileTypes: true });
  if (entries.some((entry) => !entry.isFile()))
    throw new TypeError(
      "Persisted real-domain case must contain only its exact flat regular-file roster.",
    );
  const files = entries.map(({ name }) => name).sort();
  const expectedFiles = [...manifest.artifactFiles, CASE_MANIFEST_FILE].sort();
  if (
    files.length !== expectedFiles.length ||
    files.some((file, index) => file !== expectedFiles[index]) ||
    manifest.commitment !== canonicalDigest(withoutCommitment(manifest)) ||
    manifest.panelStep !== input.capture.panelStep ||
    manifest.sourceCaseCommitment !== input.capture.sourceCase.sourceCaseCommitment ||
    manifest.sharedOrientationAnchor.commitment !==
      input.capture.sourceCase.sharedOrientationAnchor?.commitment ||
    manifest.perPanelLatticeCounterevidence.commitment !==
      input.capture.sourceCase.perPanelLatticeCounterevidence.commitment ||
    manifest.predecessorCaseCommitment !== input.capture.predecessorCase.commitment ||
    manifest.observationCommitment !== input.capture.observation.observationCommitment ||
    manifest.runtimeStateCommitment !== input.capture.runtimeStateCommitment ||
    manifest.independentReplayCommitment !== independentReplay.commitment ||
    manifest.searchAttemptCommitment !== input.capture.attemptEvidence.attempt.commitment ||
    manifest.searchAttemptCommitment !== manifest.searchAttempt.commitment ||
    manifest.artifactBindingsCommitment !== canonicalDigest(manifest.artifactBindings) ||
    canonicalDigest(manifest.artifactFiles) !==
      canonicalDigest(manifest.artifactBindings.map(({ artifactFile }) => artifactFile))
  )
    throw new TypeError("Persisted real-domain case manifest or exact roster drifted.");
  for (const binding of manifest.artifactBindings) {
    const bytes = readContainedBoundedRegularFile(directory, binding.artifactFile, {
      label: `real-domain camera artifact ${binding.artifactFile}`,
      maximumBytes: 16 * 1024 * 1024,
      exactBytes: binding.byteLength,
    });
    const expectedSource =
      expectedSourceArtifacts[binding.artifactFile as keyof typeof expectedSourceArtifacts];
    if (
      sha256(bytes) !== binding.pngDigest ||
      (expectedSource !== undefined && !Buffer.from(bytes).equals(Buffer.from(expectedSource)))
    )
      throw new TypeError(`Persisted real-domain artifact ${binding.artifactFile} drifted.`);
  }
  await requireSameDirectoryIdentity(directory, directoryIdentity);
  const proofBody = {
    schemaVersion: "lego.real-build-prefix50-verified-real-domain-camera-case/1" as const,
    panelStep: input.capture.panelStep,
    outputRealPathCommitment: canonicalDigest({ realPath: input.proofPath(directory) }),
    caseManifestCommitment: manifest.commitment,
    observationCommitment: manifest.observationCommitment,
    searchAttemptCommitment: manifest.searchAttemptCommitment,
  };
  const proof = Object.freeze({ ...proofBody, commitment: canonicalDigest(proofBody) });
  caseProofBrands.set(proof, input.capture);
  return proof;
}

export function verifyPersistedRealBuildPrefix50Step44RealDomainCase(input: {
  readonly outputPath: string;
  readonly capture: RealBuildPrefix50Step44RealDomainCapturedCase;
  readonly publicationTransaction?: RealBuildPrefix50Step44CalibrationDirectoryTransaction;
}): Promise<RealBuildPrefix50Step44VerifiedPersistedRealDomainCase> {
  return verifyPersistedRealBuildPrefix50Step44RealDomainCaseAtProofPath({
    ...input,
    proofPath: (physicalPath) =>
      input.publicationTransaction === undefined
        ? physicalPath
        : prospectiveRealBuildPrefix50Step44CalibrationFinalPath(
            input.publicationTransaction,
            physicalPath,
          ),
  });
}

export function requireRealBuildPrefix50Step44VerifiedPersistedRealDomainCase(
  proof: RealBuildPrefix50Step44VerifiedPersistedRealDomainCase,
): RealBuildPrefix50Step44RealDomainCapturedCase {
  const capture = caseProofBrands.get(proof);
  if (
    capture === undefined ||
    proof.panelStep !== capture.panelStep ||
    proof.observationCommitment !== capture.observation.observationCommitment ||
    proof.searchAttemptCommitment !== capture.attemptEvidence.attempt.commitment ||
    proof.commitment !== canonicalDigest(withoutCommitment(proof))
  )
    throw new TypeError(
      "Real-domain camera gate requires an exact runtime-branded persisted case proof.",
    );
  return capture;
}
