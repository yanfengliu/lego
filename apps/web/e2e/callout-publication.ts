import { createHash, randomUUID } from "node:crypto";
import {
  closeSync,
  existsSync,
  fsyncSync,
  mkdirSync,
  openSync,
  renameSync,
  rmSync,
  unlinkSync,
  writeSync,
} from "node:fs";
import { basename, join } from "node:path";

import {
  assertCanonicalCardPng,
  createPngDecodeBudget,
} from "../../../scripts/part-thumbnail-image-guard.mjs";
import { assertPublishedQuantityFaces } from "./callout-faces";
import { assertCalloutEvidenceContract } from "./callout-evidence-contract";
import { assertCalloutManifestClosure } from "./callout-manifest-closure";
import {
  applyCalloutRootPngCleanupPlan,
  prepareCalloutFilesystem,
  retainedCalloutRunBytes,
  verifyCalloutRunDirectory,
  type CalloutRootPngCleanupResult,
} from "./callout-publication-filesystem";
import {
  CALLOUT_PUBLICATION_LIMITS,
  snapshotPublicationInput,
  type PreparedCrop,
  type PublishCalloutRunInput,
} from "./callout-publication-snapshot";
import { assertMeasuredRecoveryBenchmark } from "./callout-recovery-contract";
import { CALLOUT_RECOVERY_FIXTURE } from "./callout-recovery-fixture";
import { assertCalloutComponentOwnership } from "../../../scripts/callout-component-ownership.mjs";
import { assertCalloutManifestExactShape } from "../../../scripts/callout-manifest-shape.mjs";
import { deriveCalloutManifestRunId } from "./callout-run-id";

const JSON_STRINGIFY = JSON.stringify;
const OBJECT_KEYS = Object.keys;

export {
  CALLOUT_PUBLICATION_LIMITS,
  type PreparedCrop,
  type PublishCalloutRunInput,
  type PublishFaultPhase,
} from "./callout-publication-snapshot";
export { cleanupObsoleteRootPngs } from "./callout-publication-filesystem";

function sha256(bytes: Uint8Array): string {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function detachedJson(value: unknown): string {
  return Reflect.apply(JSON_STRINGIFY, JSON, [value]) as string;
}

function manifestRecordForCrop(metadata: PreparedCrop["metadata"], runId: string): object {
  const record = Object.create(null) as Record<string, unknown>;
  for (const key of Reflect.apply(OBJECT_KEYS, Object, [metadata]) as string[]) {
    if (key === "fileName") continue;
    const descriptor = Object.getOwnPropertyDescriptor(metadata, key)!;
    Object.defineProperty(record, key, {
      value: descriptor.value,
      enumerable: true,
      configurable: true,
      writable: true,
    });
  }
  Object.defineProperty(record, "file", {
    value: `runs/${runId}/${metadata.fileName}`,
    enumerable: true,
    configurable: true,
    writable: true,
  });
  return record;
}

function writeDurably(path: string, bytes: Uint8Array): void {
  const descriptor = openSync(path, "wx");
  try {
    let offset = 0;
    while (offset < bytes.length) {
      const written = writeSync(descriptor, bytes, offset, bytes.length - offset);
      if (written <= 0)
        throw new Error(`Writing ${path} stopped after ${offset}/${bytes.length} bytes.`);
      offset += written;
    }
    fsyncSync(descriptor);
  } finally {
    closeSync(descriptor);
  }
}

export function inspectPng(bytes: Buffer): { readonly width: number; readonly height: number } {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (bytes.length < 33 || !bytes.subarray(0, 8).equals(signature)) {
    throw new Error("PNG signature is absent or truncated.");
  }
  let offset = 8;
  let width = 0;
  let height = 0;
  let chunkIndex = 0;
  let closed = false;
  while (offset < bytes.length) {
    if (offset + 12 > bytes.length)
      throw new Error(`PNG chunk header at byte ${offset} is truncated.`);
    const length = bytes.readUInt32BE(offset);
    const type = bytes.toString("ascii", offset + 4, offset + 8);
    const next = offset + 12 + length;
    if (next > bytes.length)
      throw new Error(`PNG ${type} chunk at byte ${offset} overruns the file.`);
    if (chunkIndex === 0) {
      if (type !== "IHDR" || length !== 13)
        throw new Error("PNG does not begin with a 13-byte IHDR.");
      width = bytes.readUInt32BE(offset + 8);
      height = bytes.readUInt32BE(offset + 12);
      if (width === 0 || height === 0)
        throw new Error(`PNG IHDR dimensions are ${width}x${height}.`);
    }
    if (type === "IEND") {
      if (length !== 0 || next !== bytes.length) {
        throw new Error("PNG IEND is malformed or trailing bytes follow the image closure.");
      }
      closed = true;
    }
    offset = next;
    chunkIndex += 1;
  }
  if (!closed) throw new Error("PNG has no terminal IEND closure.");
  return { width, height };
}

function assertCrop(crop: PreparedCrop): { readonly width: number; readonly height: number } {
  const { metadata, png } = crop;
  if (png.length === 0 || png.length > CALLOUT_PUBLICATION_LIMITS.maxCropBytes) {
    throw new Error(
      `${metadata.identity} PNG is ${png.length} bytes; each crop must be 1..${CALLOUT_PUBLICATION_LIMITS.maxCropBytes}.`,
    );
  }
  if (metadata.byteLength !== png.length) {
    throw new Error(
      `${metadata.identity} declares ${metadata.byteLength} bytes but holds ${png.length}.`,
    );
  }
  if (metadata.sha256 !== sha256(png)) {
    throw new Error(`${metadata.identity} PNG digest does not match ${metadata.sha256}.`);
  }
  const dimensions = assertCanonicalCardPng(png, `${metadata.identity} callout PNG`);
  const inspected = inspectPng(png);
  if (inspected.width !== dimensions.width || inspected.height !== dimensions.height) {
    throw new Error(`${metadata.identity} PNG validators disagreed about its dimensions.`);
  }
  if (dimensions.width !== metadata.widthPx || dimensions.height !== metadata.heightPx) {
    throw new Error(
      `${metadata.identity} IHDR is ${dimensions.width}x${dimensions.height}, not ${metadata.widthPx}x${metadata.heightPx}.`,
    );
  }
  return dimensions;
}

function assertManifest(input: PublishCalloutRunInput, bytes: Buffer): void {
  if (!/^[0-9a-f]{24}$/.test(input.runId))
    throw new Error(`Run id ${input.runId} is not 24 hex digits.`);
  if (!Array.isArray(input.manifest.failures) || input.manifest.failures.length > 0)
    throw new Error("A success manifest must retain an exact empty failures array.");
  if (input.manifest.calloutCount === 0 || input.crops.length === 0) {
    throw new Error("A callout run cannot publish an empty crop set.");
  }
  if (input.manifest.calloutCount !== input.crops.length) {
    throw new Error(
      `Manifest declares ${input.manifest.calloutCount} callouts but ${input.crops.length} PNGs were staged.`,
    );
  }
  if (input.manifest.callouts.length !== input.crops.length) {
    throw new Error(
      `Manifest contains ${input.manifest.callouts.length} callout records for ${input.crops.length} PNGs.`,
    );
  }
  assertCalloutManifestExactShape(input.manifest, "Callout publication manifest");
  assertPublishedQuantityFaces(input.manifest.callouts);
  assertCalloutManifestClosure(input);
  assertMeasuredRecoveryBenchmark(
    input.manifest.recoveryBenchmark,
    input.manifest.sourceHash,
    CALLOUT_RECOVERY_FIXTURE.cases.map(({ identity }) => identity).sort(),
  );
  // Derived independently of the preregistered recovery fixture: the type size
  // the booklet printed has to agree with the class about to be published, so a
  // multiplier nobody registered cannot be published as a physical piece.
  assertCalloutEvidenceContract(input.manifest.callouts, "Callout publication");
  assertCalloutComponentOwnership(input.manifest.callouts, "Callout publication");
  const names = input.crops.map(({ metadata }) => metadata.fileName);
  if (new Set(names).size !== names.length) throw new Error("Crop file names are not unique.");
  const identities = input.crops.map(({ metadata }) => metadata.identity);
  if (new Set(identities).size !== identities.length)
    throw new Error("Crop identities are not unique.");
  const decodeBudget = createPngDecodeBudget("Callout publication crop decodes");
  for (let cropIndex = 0; cropIndex < input.crops.length; cropIndex += 1) {
    const crop = input.crops[cropIndex]!;
    if (crop.metadata.fileName !== basename(crop.metadata.fileName)) {
      throw new Error(`${crop.metadata.identity} file name escapes the run directory.`);
    }
    decodeBudget.charge(crop.png, `${crop.metadata.identity} callout PNG`);
    assertCrop(crop);
    const manifestCrop = input.manifest.callouts[cropIndex];
    const expectedManifestCrop = manifestRecordForCrop(crop.metadata, input.runId);
    if (!manifestCrop || detachedJson(manifestCrop) !== detachedJson(expectedManifestCrop)) {
      throw new Error(
        `${crop.metadata.identity} manifest metadata at index ${cropIndex} is absent, noncanonical, or differs from its staged PNG record at that same index. Manifest and PNG order is part of the run address and cannot be independently reordered.`,
      );
    }
  }
  const derivedRunId = deriveCalloutManifestRunId(input.manifest);
  if (input.runId !== derivedRunId) {
    throw new Error(
      `Callout publication declares run ${input.runId}, but its snapshotted v6 source, selection, benchmark, accounting, conservation, and crop metadata derive content-addressed run ${derivedRunId}. Publish under the derived run id; renamed or spliced metadata cannot select a retained directory.`,
    );
  }
  const runBytes = bytes.length + input.crops.reduce((total, { png }) => total + png.length, 0);
  if (runBytes > CALLOUT_PUBLICATION_LIMITS.maxRunBytes) {
    throw new Error(
      `Run needs ${runBytes} bytes, above the ${CALLOUT_PUBLICATION_LIMITS.maxRunBytes} cap.`,
    );
  }
}

export function publishCalloutRun(input: PublishCalloutRunInput): {
  readonly runDirectory: string;
  readonly pointerPath: string;
  readonly reused: boolean;
  readonly cleanup: CalloutRootPngCleanupResult;
} {
  const snapshot = snapshotPublicationInput(input);
  input = snapshot.input;
  const bytes = snapshot.bytes;
  assertManifest(input, bytes);
  const { runsDirectory, cleanupPlan } = prepareCalloutFilesystem(input);
  const stageDirectory = join(input.outDirectory, `.stage-${process.pid}-${randomUUID()}`);
  const pointerTemp = join(input.outDirectory, `.${input.pointerFile}.${randomUUID()}.tmp`);
  const runDirectory = join(runsDirectory, input.runId);
  let reused = false;
  mkdirSync(stageDirectory);
  try {
    for (const crop of input.crops)
      writeDurably(join(stageDirectory, crop.metadata.fileName), crop.png);
    writeDurably(join(stageDirectory, "manifest.json"), bytes);
    verifyCalloutRunDirectory(stageDirectory, bytes, input.crops);
    const retainedBefore = retainedCalloutRunBytes(runsDirectory);
    const candidateBytes =
      bytes.length + input.crops.reduce((total, { png }) => total + png.length, 0);
    if (retainedBefore > CALLOUT_PUBLICATION_LIMITS.maxRetainedRunBytes) {
      throw new Error(
        `Retained callout runs use ${retainedBefore} bytes, above the ${CALLOUT_PUBLICATION_LIMITS.maxRetainedRunBytes} cap.`,
      );
    }
    if (
      !existsSync(runDirectory) &&
      retainedBefore + candidateBytes > CALLOUT_PUBLICATION_LIMITS.maxRetainedRunBytes
    ) {
      throw new Error(
        `Retaining this run needs ${retainedBefore + candidateBytes} bytes, above the ${CALLOUT_PUBLICATION_LIMITS.maxRetainedRunBytes} cap.`,
      );
    }
    if (existsSync(runDirectory)) {
      verifyCalloutRunDirectory(runDirectory, bytes, input.crops);
      reused = true;
      rmSync(stageDirectory, { recursive: true });
    } else {
      input.fault?.("before-run-promote");
      renameSync(stageDirectory, runDirectory);
      verifyCalloutRunDirectory(runDirectory, bytes, input.crops);
    }
    input.fault?.("before-pointer-swap");
    writeDurably(pointerTemp, bytes);
    renameSync(pointerTemp, join(input.outDirectory, input.pointerFile));
    const cleanup = applyCalloutRootPngCleanupPlan(input.outDirectory, cleanupPlan);
    return {
      runDirectory,
      pointerPath: join(input.outDirectory, input.pointerFile),
      reused,
      cleanup,
    };
  } finally {
    if (existsSync(pointerTemp)) unlinkSync(pointerTemp);
    if (existsSync(stageDirectory)) rmSync(stageDirectory, { recursive: true });
  }
}

export function assertPublishableCalloutRun(input: PublishCalloutRunInput): void {
  const snapshot = snapshotPublicationInput(input);
  assertManifest(snapshot.input, snapshot.bytes);
}
