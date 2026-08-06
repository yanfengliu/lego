import { createHash, randomUUID } from "node:crypto";
import {
  closeSync,
  existsSync,
  fsyncSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  unlinkSync,
  writeSync,
} from "node:fs";
import { basename, isAbsolute, join, relative, resolve } from "node:path";

import { assertPublishedQuantityFaces } from "./callout-faces";
import type { CalloutManifest, PublishedCallout } from "./callout-types";

export const CALLOUT_PUBLICATION_LIMITS = Object.freeze({
  maxCropBytes: 2 * 1024 * 1024,
  maxRunBytes: 32 * 1024 * 1024,
  maxRetainedRunBytes: 128 * 1024 * 1024,
});

export interface PreparedCrop {
  readonly metadata: PublishedCallout;
  readonly png: Buffer;
}

export type PublishFaultPhase = "before-run-promote" | "before-pointer-swap";

export interface PublishCalloutRunInput {
  readonly outDirectory: string;
  readonly pointerFile: "manifest.json" | "manifest.partial.json";
  readonly runId: string;
  readonly manifest: CalloutManifest;
  readonly crops: readonly PreparedCrop[];
  readonly fault?: (phase: PublishFaultPhase) => void;
}

function sha256(bytes: Uint8Array): string {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function manifestBytes(manifest: CalloutManifest): Buffer {
  return Buffer.from(`${JSON.stringify(manifest, null, 1)}\n`);
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

function assertCrop(crop: PreparedCrop): void {
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
  const dimensions = inspectPng(png);
  if (dimensions.width !== metadata.widthPx || dimensions.height !== metadata.heightPx) {
    throw new Error(
      `${metadata.identity} IHDR is ${dimensions.width}x${dimensions.height}, not ${metadata.widthPx}x${metadata.heightPx}.`,
    );
  }
}

function assertManifest(input: PublishCalloutRunInput, bytes: Buffer): void {
  if (!/^[0-9a-f]{24}$/.test(input.runId))
    throw new Error(`Run id ${input.runId} is not 24 hex digits.`);
  if (input.manifest.failures.length > 0)
    throw new Error("A success manifest cannot retain failures.");
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
  // Derived independently of the preregistered recovery fixture: the type size
  // the booklet printed has to agree with the class about to be published, so a
  // multiplier nobody registered cannot be published as a physical piece.
  assertPublishedQuantityFaces(input.manifest.callouts);
  const names = input.crops.map(({ metadata }) => metadata.fileName);
  if (new Set(names).size !== names.length) throw new Error("Crop file names are not unique.");
  const identities = input.crops.map(({ metadata }) => metadata.identity);
  if (new Set(identities).size !== identities.length)
    throw new Error("Crop identities are not unique.");
  for (const crop of input.crops) {
    if (crop.metadata.fileName !== basename(crop.metadata.fileName)) {
      throw new Error(`${crop.metadata.identity} file name escapes the run directory.`);
    }
    assertCrop(crop);
    const manifestCrop = input.manifest.callouts.find(
      ({ identity }) => identity === crop.metadata.identity,
    );
    const { fileName, ...metadata } = crop.metadata;
    const expectedManifestCrop = {
      ...metadata,
      file: `runs/${input.runId}/${fileName}`,
    };
    if (!manifestCrop || JSON.stringify(manifestCrop) !== JSON.stringify(expectedManifestCrop)) {
      throw new Error(
        `${crop.metadata.identity} manifest metadata is absent, noncanonical, or differs from its staged PNG record.`,
      );
    }
  }
  const runBytes = bytes.length + input.crops.reduce((total, { png }) => total + png.length, 0);
  if (runBytes > CALLOUT_PUBLICATION_LIMITS.maxRunBytes) {
    throw new Error(
      `Run needs ${runBytes} bytes, above the ${CALLOUT_PUBLICATION_LIMITS.maxRunBytes} cap.`,
    );
  }
}

function verifyRunDirectory(
  directory: string,
  expectedManifest: Buffer,
  crops: readonly PreparedCrop[],
): void {
  const directoryStat = lstatSync(directory);
  if (!directoryStat.isDirectory() || directoryStat.isSymbolicLink()) {
    throw new Error(`Run path ${directory} is not a regular directory.`);
  }
  const expectedNames = ["manifest.json", ...crops.map(({ metadata }) => metadata.fileName)].sort();
  const entries = readdirSync(directory, { withFileTypes: true });
  const actualNames = entries.map(({ name }) => name).sort();
  if (JSON.stringify(actualNames) !== JSON.stringify(expectedNames)) {
    throw new Error(
      `Run closure differs: expected ${JSON.stringify(expectedNames)}, found ${JSON.stringify(actualNames)}.`,
    );
  }
  for (const entry of entries) {
    if (!entry.isFile() || entry.isSymbolicLink()) {
      throw new Error(`Run closure entry ${entry.name} is not a regular file.`);
    }
  }
  const storedManifest = readFileSync(join(directory, "manifest.json"));
  if (!storedManifest.equals(expectedManifest)) {
    throw new Error("Existing run manifest is not byte-identical to the staged manifest.");
  }
  for (const crop of crops) {
    const stored = readFileSync(join(directory, crop.metadata.fileName));
    if (stored.length !== crop.metadata.byteLength || sha256(stored) !== crop.metadata.sha256) {
      throw new Error(
        `${crop.metadata.identity} existing PNG bytes do not match the staged digest.`,
      );
    }
    const dimensions = inspectPng(stored);
    if (
      dimensions.width !== crop.metadata.widthPx ||
      dimensions.height !== crop.metadata.heightPx
    ) {
      throw new Error(`${crop.metadata.identity} existing PNG IHDR does not match the manifest.`);
    }
  }
}

function retainedRunBytes(runsDirectory: string): number {
  if (!existsSync(runsDirectory)) return 0;
  let total = 0;
  for (const run of readdirSync(runsDirectory, { withFileTypes: true })) {
    if (!run.isDirectory() || run.isSymbolicLink()) {
      throw new Error(`Retained run entry ${run.name} is not a regular directory.`);
    }
    for (const entry of readdirSync(join(runsDirectory, run.name), { withFileTypes: true })) {
      if (!entry.isFile() || entry.isSymbolicLink()) {
        throw new Error(`Retained run ${run.name}/${entry.name} is not a regular file.`);
      }
      total += lstatSync(join(runsDirectory, run.name, entry.name)).size;
    }
  }
  return total;
}

function pointerRootReferences(outDirectory: string): Set<string> {
  const referenced = new Set<string>();
  for (const pointer of ["manifest.json", "manifest.partial.json"]) {
    const path = join(outDirectory, pointer);
    if (!existsSync(path)) continue;
    try {
      const parsed = JSON.parse(readFileSync(path, "utf8")) as {
        callouts?: readonly { readonly file?: unknown }[];
      };
      for (const callout of parsed.callouts ?? []) {
        if (typeof callout.file === "string" && !callout.file.includes("/"))
          referenced.add(callout.file);
      }
    } catch {
      throw new Error(`${pointer} is unreadable, so obsolete root PNG ownership cannot be proven.`);
    }
  }
  return referenced;
}

export function cleanupObsoleteRootPngs(outDirectory: string): {
  readonly removedFiles: number;
  readonly removedBytes: number;
} {
  const referenced = pointerRootReferences(outDirectory);
  const obsolete = readdirSync(outDirectory, { withFileTypes: true }).filter(
    (entry) =>
      entry.isFile() &&
      !entry.isSymbolicLink() &&
      /^p\d+-c\d+\.png$/.test(entry.name) &&
      !referenced.has(entry.name),
  );
  let removedBytes = 0;
  for (const entry of obsolete) {
    const path = resolve(outDirectory, entry.name);
    const fromRoot = relative(resolve(outDirectory), path);
    if (!isAbsolute(fromRoot) && !fromRoot.startsWith("..") && lstatSync(path).isFile()) {
      removedBytes += lstatSync(path).size;
      unlinkSync(path);
    }
  }
  return { removedFiles: obsolete.length, removedBytes };
}

export function publishCalloutRun(input: PublishCalloutRunInput): {
  readonly runDirectory: string;
  readonly pointerPath: string;
  readonly reused: boolean;
  readonly cleanup: { readonly removedFiles: number; readonly removedBytes: number };
} {
  const bytes = manifestBytes(input.manifest);
  assertManifest(input, bytes);
  mkdirSync(input.outDirectory, { recursive: true });
  const runsDirectory = join(input.outDirectory, "runs");
  mkdirSync(runsDirectory, { recursive: true });
  const stageDirectory = join(input.outDirectory, `.stage-${process.pid}-${randomUUID()}`);
  const pointerTemp = join(input.outDirectory, `.${input.pointerFile}.${randomUUID()}.tmp`);
  const runDirectory = join(runsDirectory, input.runId);
  let reused = false;
  mkdirSync(stageDirectory);
  try {
    for (const crop of input.crops)
      writeDurably(join(stageDirectory, crop.metadata.fileName), crop.png);
    writeDurably(join(stageDirectory, "manifest.json"), bytes);
    verifyRunDirectory(stageDirectory, bytes, input.crops);
    const retainedBefore = retainedRunBytes(runsDirectory);
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
      verifyRunDirectory(runDirectory, bytes, input.crops);
      reused = true;
      rmSync(stageDirectory, { recursive: true });
    } else {
      input.fault?.("before-run-promote");
      renameSync(stageDirectory, runDirectory);
      verifyRunDirectory(runDirectory, bytes, input.crops);
    }
    input.fault?.("before-pointer-swap");
    writeDurably(pointerTemp, bytes);
    renameSync(pointerTemp, join(input.outDirectory, input.pointerFile));
    const cleanup = cleanupObsoleteRootPngs(input.outDirectory);
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
