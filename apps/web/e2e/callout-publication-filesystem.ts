import { createHash } from "node:crypto";
import { existsSync, lstatSync, mkdirSync, opendirSync, type Dirent } from "node:fs";
import { isAbsolute, join, relative, resolve } from "node:path";

import { readContainedBoundedRegularFile } from "./bounded-file-read";
import { STRICT_JSON_SNAPSHOT_LIMITS, strictBoundedJsonSnapshot } from "./callout-publication-json";
import {
  CALLOUT_PUBLICATION_LIMITS,
  type PreparedCrop,
  type PublishCalloutRunInput,
} from "./callout-publication-snapshot";

const JSON_PARSE = JSON.parse;
const JSON_STRINGIFY = JSON.stringify;
const POINTER_DECODER = new TextDecoder("utf-8", { fatal: true, ignoreBOM: false });

function sha256(bytes: Uint8Array): string {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

class DuplicateKeyScanner {
  private index = 0;
  private values = 0;

  constructor(private readonly text: string) {}

  scan(): void {
    this.skipWhitespace();
    this.scanValue(0);
    this.skipWhitespace();
    if (this.index !== this.text.length) this.fail("JSON has trailing non-whitespace data");
  }

  private fail(message: string): never {
    throw new SyntaxError(`${message} at UTF-16 offset ${this.index}`);
  }

  private skipWhitespace(): void {
    while (
      this.index < this.text.length &&
      (this.text[this.index] === " " ||
        this.text[this.index] === "\t" ||
        this.text[this.index] === "\n" ||
        this.text[this.index] === "\r")
    ) {
      this.index += 1;
    }
  }

  private scanValue(depth: number): void {
    if (depth > STRICT_JSON_SNAPSHOT_LIMITS.maxDepth) {
      this.fail(`JSON nesting exceeds ${STRICT_JSON_SNAPSHOT_LIMITS.maxDepth} levels`);
    }
    this.values += 1;
    if (this.values > STRICT_JSON_SNAPSHOT_LIMITS.maxNodes) {
      this.fail(`JSON contains more than ${STRICT_JSON_SNAPSHOT_LIMITS.maxNodes} values`);
    }
    const character = this.text[this.index];
    if (character === "{") this.scanObject(depth + 1);
    else if (character === "[") this.scanArray(depth + 1);
    else if (character === '"') this.scanString(false);
    else this.scanPrimitive();
  }

  private scanObject(depth: number): void {
    this.index += 1;
    const keys = new Set<string>();
    this.skipWhitespace();
    if (this.text[this.index] === "}") {
      this.index += 1;
      return;
    }
    for (;;) {
      if (this.text[this.index] !== '"') this.fail("Expected a quoted JSON object key");
      const key = this.scanString(true)!;
      if (keys.has(key)) {
        const rendered = key.length > 128 ? `${key.slice(0, 128)}…` : key;
        this.fail(`JSON object repeats key ${JSON_STRINGIFY(rendered)}`);
      }
      keys.add(key);
      this.skipWhitespace();
      if (this.text[this.index] !== ":") this.fail("Expected ':' after JSON object key");
      this.index += 1;
      this.skipWhitespace();
      this.scanValue(depth);
      this.skipWhitespace();
      if (this.text[this.index] === "}") {
        this.index += 1;
        return;
      }
      if (this.text[this.index] !== ",") this.fail("Expected ',' or '}' in JSON object");
      this.index += 1;
      this.skipWhitespace();
    }
  }

  private scanArray(depth: number): void {
    this.index += 1;
    this.skipWhitespace();
    if (this.text[this.index] === "]") {
      this.index += 1;
      return;
    }
    for (;;) {
      this.scanValue(depth);
      this.skipWhitespace();
      if (this.text[this.index] === "]") {
        this.index += 1;
        return;
      }
      if (this.text[this.index] !== ",") this.fail("Expected ',' or ']' in JSON array");
      this.index += 1;
      this.skipWhitespace();
    }
  }

  private scanString(decode: boolean): string | undefined {
    const start = this.index;
    this.index += 1;
    while (this.index < this.text.length) {
      const character = this.text[this.index];
      if (character === '"') {
        this.index += 1;
        return decode ? (JSON_PARSE(this.text.slice(start, this.index)) as string) : undefined;
      }
      this.index += character === "\\" ? 2 : 1;
    }
    this.fail("JSON string is unterminated");
  }

  private scanPrimitive(): void {
    const start = this.index;
    while (this.index < this.text.length) {
      const character = this.text[this.index]!;
      if (
        character === " " ||
        character === "\t" ||
        character === "\n" ||
        character === "\r" ||
        character === "," ||
        character === "]" ||
        character === "}"
      ) {
        break;
      }
      this.index += 1;
    }
    if (this.index === start) this.fail("Expected a JSON value");
  }
}

function parseStrictPointerJson<T>(bytes: Uint8Array, label: string): T {
  let text: string;
  try {
    text = POINTER_DECODER.decode(bytes);
  } catch (error) {
    throw new TypeError(
      `${label} is not canonical UTF-8; malformed byte sequences are rejected instead of replaced: ${error instanceof Error ? error.message : String(error)}.`,
      { cause: error },
    );
  }
  try {
    new DuplicateKeyScanner(text).scan();
    return JSON_PARSE(text) as T;
  } catch (error) {
    throw new TypeError(
      `${label} is not strict JSON: ${error instanceof Error ? error.message : String(error)}.`,
      { cause: error },
    );
  }
}

function boundedDirectoryEntries(directory: string, maximum: number, label: string): Dirent[] {
  const handle = opendirSync(directory);
  const entries: Dirent[] = [];
  try {
    for (;;) {
      const entry = handle.readSync();
      if (entry === null) return entries;
      if (entries.length >= maximum) {
        throw new Error(`${label} contains more than ${maximum} entries.`);
      }
      entries.push(entry);
    }
  } finally {
    handle.closeSync();
  }
}

export function assertRegularCalloutDirectory(path: string, label: string): void {
  const stat = lstatSync(path);
  if (!stat.isDirectory() || stat.isSymbolicLink()) {
    throw new Error(`${label} ${path} must be a real directory, not a symlink or junction.`);
  }
}

function ensureRegularDirectory(path: string, label: string): void {
  if (!existsSync(path)) mkdirSync(path, { recursive: true });
  assertRegularCalloutDirectory(path, label);
}

export function verifyCalloutRunDirectory(
  directory: string,
  expectedManifest: Buffer,
  crops: readonly PreparedCrop[],
): void {
  assertRegularCalloutDirectory(directory, "Callout run path");
  const expectedNames = ["manifest.json"];
  for (let index = 0; index < crops.length; index += 1) {
    expectedNames.push(crops[index]!.metadata.fileName);
  }
  expectedNames.sort();
  const entries = boundedDirectoryEntries(directory, expectedNames.length, "Callout run directory");
  const actualNames: string[] = [];
  for (const entry of entries) {
    if (!entry.isFile() || entry.isSymbolicLink()) {
      throw new Error(`Run closure entry ${entry.name} is not a regular file.`);
    }
    actualNames.push(entry.name);
  }
  actualNames.sort();
  if (actualNames.length !== expectedNames.length) {
    throw new Error(
      `Run closure contains ${actualNames.length} entries; expected exactly ${expectedNames.length}.`,
    );
  }
  for (let index = 0; index < expectedNames.length; index += 1) {
    if (actualNames[index] !== expectedNames[index]) {
      throw new Error(
        `Run closure entry ${index} is ${JSON.stringify(actualNames[index])}; expected ${JSON.stringify(expectedNames[index])}.`,
      );
    }
  }
  const storedManifest = readContainedBoundedRegularFile(directory, "manifest.json", {
    label: "Existing callout run manifest",
    maximumBytes: expectedManifest.length,
    exactBytes: expectedManifest.length,
    expectedSha256: sha256(expectedManifest),
  });
  if (!storedManifest.equals(expectedManifest)) {
    throw new Error("Existing run manifest is not byte-identical to the staged manifest.");
  }
  for (const crop of crops) {
    readContainedBoundedRegularFile(directory, crop.metadata.fileName, {
      label: `${crop.metadata.identity} existing callout PNG`,
      maximumBytes: crop.metadata.byteLength,
      exactBytes: crop.metadata.byteLength,
      expectedSha256: crop.metadata.sha256,
    });
  }
}

export function retainedCalloutRunBytes(runsDirectory: string): number {
  if (!existsSync(runsDirectory)) return 0;
  assertRegularCalloutDirectory(runsDirectory, "Retained callout runs root");
  let total = 0;
  for (const run of boundedDirectoryEntries(runsDirectory, 256, "Retained callout runs root")) {
    if (!run.isDirectory() || run.isSymbolicLink()) {
      throw new Error(`Retained run entry ${run.name} is not a regular directory.`);
    }
    const runDirectory = join(runsDirectory, run.name);
    assertRegularCalloutDirectory(runDirectory, `Retained run ${run.name}`);
    for (const entry of boundedDirectoryEntries(runDirectory, 2_001, `Retained run ${run.name}`)) {
      if (!entry.isFile() || entry.isSymbolicLink()) {
        throw new Error(`Retained run ${run.name}/${entry.name} is not a regular file.`);
      }
      const size = lstatSync(join(runDirectory, entry.name)).size;
      const next = total + size;
      if (!Number.isSafeInteger(next)) {
        throw new Error(`Retained run byte accounting overflowed at ${run.name}/${entry.name}.`);
      }
      total = next;
      if (total > CALLOUT_PUBLICATION_LIMITS.maxRetainedRunBytes) return total;
    }
  }
  return total;
}

function addPointerRootReferences(
  callouts: readonly { readonly file?: unknown }[],
  referenced: Set<string>,
): void {
  if (callouts.length > 2_000) {
    throw new Error("Callout pointer retains more than 2000 callout records.");
  }
  for (let index = 0; index < callouts.length; index += 1) {
    const file = callouts[index]!.file;
    if (typeof file === "string" && !file.includes("/")) referenced.add(file);
  }
}

function pointerRootReferences(
  outDirectory: string,
  replacement?: Pick<PublishCalloutRunInput, "manifest" | "pointerFile">,
): Set<string> {
  const referenced = new Set<string>();
  for (const pointer of ["manifest.json", "manifest.partial.json"]) {
    if (replacement?.pointerFile === pointer) {
      addPointerRootReferences(replacement.manifest.callouts, referenced);
      continue;
    }
    const path = join(outDirectory, pointer);
    if (!existsSync(path)) continue;
    try {
      const bytes = readContainedBoundedRegularFile(outDirectory, pointer, {
        label: `Existing ${pointer}`,
        minimumBytes: 2,
        maximumBytes: CALLOUT_PUBLICATION_LIMITS.maxPointerBytes,
      });
      const parsed = strictBoundedJsonSnapshot<{
        callouts?: readonly { readonly file?: unknown }[];
      }>(parseStrictPointerJson(bytes, pointer), pointer, bytes.length);
      if (!Array.isArray(parsed.callouts)) {
        throw new Error(`${pointer} has no bounded callout array.`);
      }
      addPointerRootReferences(parsed.callouts, referenced);
    } catch (error) {
      const detail = (error instanceof Error ? error.message : String(error)).slice(0, 500);
      throw new Error(
        `${pointer} is unreadable, so obsolete root PNG ownership cannot be proven: ${detail}`,
        { cause: error },
      );
    }
  }
  return referenced;
}

interface ObsoleteRootPng {
  readonly name: string;
  readonly path: string;
  readonly dev: bigint;
  readonly ino: bigint;
  readonly size: bigint;
  readonly mtimeNs: bigint;
  readonly ctimeNs: bigint;
}

function obsoleteRootPngPlan(
  outDirectory: string,
  referenced: ReadonlySet<string>,
): ObsoleteRootPng[] {
  assertRegularCalloutDirectory(outDirectory, "Callout output root");
  const plan: ObsoleteRootPng[] = [];
  for (const entry of boundedDirectoryEntries(outDirectory, 5_000, "Callout output root")) {
    if (
      !entry.isFile() ||
      entry.isSymbolicLink() ||
      !/^p\d+-c\d+\.png$/u.test(entry.name) ||
      referenced.has(entry.name)
    ) {
      continue;
    }
    const path = resolve(outDirectory, entry.name);
    const fromRoot = relative(resolve(outDirectory), path);
    if (isAbsolute(fromRoot) || fromRoot.startsWith("..")) {
      throw new Error(`Obsolete root PNG ${entry.name} escapes the callout output root.`);
    }
    const stat = lstatSync(path, { bigint: true });
    if (!stat.isFile() || stat.isSymbolicLink()) {
      throw new Error(`Obsolete root PNG ${entry.name} is not a real regular file.`);
    }
    plan.push({
      name: entry.name,
      path,
      dev: stat.dev,
      ino: stat.ino,
      size: stat.size,
      mtimeNs: stat.mtimeNs,
      ctimeNs: stat.ctimeNs,
    });
  }
  return plan;
}

export interface CalloutRootPngCleanupResult {
  readonly removedFiles: number;
  readonly removedBytes: number;
  readonly skippedFiles: number;
  readonly warning?: string;
}

export interface PreparedCalloutFilesystem {
  readonly runsDirectory: string;
  readonly cleanupPlan: readonly ObsoleteRootPng[];
}

export function prepareCalloutFilesystem(
  input: Pick<PublishCalloutRunInput, "manifest" | "outDirectory" | "pointerFile">,
): PreparedCalloutFilesystem {
  ensureRegularDirectory(input.outDirectory, "Callout output root");
  const replacingExistingPointer = existsSync(join(input.outDirectory, input.pointerFile));
  const references = replacingExistingPointer
    ? new Set<string>()
    : pointerRootReferences(input.outDirectory, input);
  const runsDirectory = join(input.outDirectory, "runs");
  if (!existsSync(runsDirectory)) mkdirSync(runsDirectory);
  assertRegularCalloutDirectory(runsDirectory, "Callout runs root");
  // Replacing an existing pointer is authoritative, but its old bytes may be
  // malformed or may race. Preserve legacy root PNGs for this publication;
  // a later explicit cleanup can delete only after both current pointers parse.
  return {
    runsDirectory,
    cleanupPlan: replacingExistingPointer
      ? []
      : obsoleteRootPngPlan(input.outDirectory, references),
  };
}

export function applyCalloutRootPngCleanupPlan(
  outDirectory: string,
  plan: readonly ObsoleteRootPng[],
): CalloutRootPngCleanupResult {
  let currentReferences: Set<string>;
  try {
    currentReferences = pointerRootReferences(outDirectory);
  } catch (error) {
    return {
      removedFiles: 0,
      removedBytes: 0,
      skippedFiles: plan.length,
      warning: `Skipped obsolete root PNG cleanup because current pointer ownership could not be reverified: ${(error instanceof Error ? error.message : String(error)).slice(0, 500)}`,
    };
  }
  let stillUnreferenced = 0;
  for (const candidate of plan) {
    if (!currentReferences.has(candidate.name)) stillUnreferenced += 1;
  }
  return {
    removedFiles: 0,
    removedBytes: 0,
    skippedFiles: stillUnreferenced,
    ...(stillUnreferenced === 0
      ? {}
      : {
          warning:
            `Retained ${stillUnreferenced} obsolete root PNGs because publication does not hold an atomic lock ` +
            "across both manifest pointers; explicit maintenance may remove them after quiescence.",
        }),
  };
}

export function cleanupObsoleteRootPngs(outDirectory: string): CalloutRootPngCleanupResult {
  const referenced = pointerRootReferences(outDirectory);
  return applyCalloutRootPngCleanupPlan(
    outDirectory,
    obsoleteRootPngPlan(outDirectory, referenced),
  );
}
