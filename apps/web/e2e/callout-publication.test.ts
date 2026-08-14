import { createHash } from "node:crypto";
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  truncateSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  CALLOUT_PUBLICATION_LIMITS,
  assertPublishableCalloutRun,
  inspectPng,
  publishCalloutRun,
  type PreparedCrop,
  type PublishCalloutRunInput,
} from "./callout-publication";
import { CALLOUT_RECOVERY_FIXTURE } from "./callout-recovery-fixture";
import { deriveCalloutManifestRunId, deriveCalloutRunId } from "./callout-run-id";
import type { CalloutManifest, PublishedCallout, RecoveryBenchmark } from "./callout-types";

const roots: string[] = [];
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYGD4DwABBAEAX+XDSwAAAABJRU5ErkJggg==",
  "base64",
);
const SOURCE_HASH = CALLOUT_RECOVERY_FIXTURE.sourceHash;

function hash(bytes: Uint8Array): string {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function root(): string {
  const path = mkdtempSync(join(tmpdir(), "lego-callout-publication-"));
  roots.push(path);
  return path;
}

function benchmark(): RecoveryBenchmark {
  const identities = CALLOUT_RECOVERY_FIXTURE.cases.map(({ identity }) => identity).sort();
  const size = identities.length;
  return {
    schemaVersion: "lego.callout-recovery-benchmark-result/2",
    fixtureSourceHash: SOURCE_HASH,
    fixedFailureClassSize: size,
    observedLegacyFailureIdentities: identities,
    scores: [
      {
        strategy: "evidence-aware",
        valid: size,
        recovered: size,
        kindCorrect: size,
        regionCorrect: size,
        masksCorrect: size,
        uncontaminated: size,
        invalidIdentities: [],
        points: size * 1_011_111,
      },
      {
        strategy: "legacy-seed",
        valid: 0,
        recovered: 0,
        kindCorrect: 0,
        regionCorrect: 0,
        masksCorrect: 0,
        uncontaminated: 0,
        invalidIdentities: identities,
        points: 0,
      },
    ],
    selected: "evidence-aware",
    winner: "evidence-aware",
    winningMargin: size * 1_011_111,
  };
}

function input(
  outDirectory: string,
  requestedRunId?: string,
  overrides: Partial<PublishedCallout> = {},
): PublishCalloutRunInput {
  const metadata: PublishedCallout = {
    identity: "p11|q1|x1.000|y1.000",
    fileName: "p11-q1-x1d000-y1d000.png",
    pageNumber: 11,
    stepNumber: 1,
    quantity: 1,
    xPt: 1,
    yPt: 1,
    heightPt: 8,
    boxMethod: "vector-smallest",
    box: { minXPt: 0, minYPt: 0, maxXPt: 10, maxYPt: 10 },
    evidenceKind: "part-art",
    regionKind: "isolated-component",
    cropStrategy: "ranked-component",
    masksApplied: ["all-pdf-text"],
    contamination: [],
    sha256: hash(PNG),
    byteLength: PNG.length,
    widthPx: 1,
    heightPx: 1,
    foregroundPixels: 1,
    sourceTextGlyphPixels: 0,
    sourceQuantityGlyphPixels: 0,
    textGlyphOverlapPixels: 0,
    quantityGlyphOverlapPixels: 0,
    quantityGlyphPixelsMasked: 0,
    cropRectPx: { left: 0, top: 0, right: 0, bottom: 0 },
    boundaryClearancePx: { left: 0, top: 0, right: 0, bottom: 0 },
    sourceComponent: {
      rasterScale: 8,
      boundsPx: { left: 0, top: 0, right: 0, bottom: 0 },
      foregroundPixels: 1,
      rawComponentCount: 1,
      absoluteForegroundSha256: hash(Buffer.from("component")),
    },
    ...overrides,
  };
  const crops: PreparedCrop[] = [{ metadata, png: PNG }];
  const { fileName, ...manifestMetadata } = metadata;
  const identitySetSha256 = hash(Buffer.from(metadata.identity));
  const recoveryBenchmark = benchmark();
  const accounting = {
    rawNxIdentityCount: 1,
    rawNxQuantityTotal: 1,
    physicalPartArtIdentityCount: 1,
    physicalPartArtQuantityTotal: 1,
    semanticIdentityCount: 0,
    semanticQuantityTotal: 0,
  };
  const conservation = {
    expectedIdentityCount: 1,
    expectedRawNxQuantityTotal: 1,
    expectedIdentitySetSha256: identitySetSha256,
    publishedIdentityCount: 1,
    publishedRawNxQuantityTotal: 1,
    publishedIdentitySetSha256: identitySetSha256,
  };
  const pageSelection = [11] as const;
  const runId =
    requestedRunId ??
    deriveCalloutRunId({
      schemaVersion: "lego.callout-thumbnails/6",
      sourceHash: SOURCE_HASH,
      pageSelection,
      recoveryBenchmark,
      accounting,
      conservation,
      crops: crops.map(({ metadata: cropMetadata }) => cropMetadata),
    });
  const manifest: CalloutManifest = {
    schemaVersion: "lego.callout-thumbnails/6",
    sourceHash: SOURCE_HASH,
    pageSelection,
    pagesCropped: 1,
    calloutCount: 1,
    accounting,
    recoveryBenchmark,
    conservation,
    failures: [],
    callouts: [{ ...manifestMetadata, file: `runs/${runId}/${fileName}` }],
  };
  return { outDirectory, pointerFile: "manifest.partial.json", runId, manifest, crops };
}

function twoCropInput(outDirectory: string): PublishCalloutRunInput {
  const first = input(outDirectory);
  const secondMetadata: PublishedCallout = {
    ...first.crops[0]!.metadata,
    identity: "p12|q1|x2.000|y2.000",
    fileName: "p12-q1-x2d000-y2d000.png",
    pageNumber: 12,
    xPt: 2,
    yPt: 2,
    sourceComponent: {
      ...first.crops[0]!.metadata.sourceComponent!,
      absoluteForegroundSha256: hash(Buffer.from("second component")),
    },
  };
  const crops: PreparedCrop[] = [first.crops[0]!, { metadata: secondMetadata, png: PNG }];
  const identities = crops.map(({ metadata }) => metadata.identity).sort();
  const identitySetSha256 = hash(Buffer.from(identities.join("\n")));
  const accounting = {
    rawNxIdentityCount: 2,
    rawNxQuantityTotal: 2,
    physicalPartArtIdentityCount: 2,
    physicalPartArtQuantityTotal: 2,
    semanticIdentityCount: 0,
    semanticQuantityTotal: 0,
  };
  const conservation = {
    expectedIdentityCount: 2,
    expectedRawNxQuantityTotal: 2,
    expectedIdentitySetSha256: identitySetSha256,
    publishedIdentityCount: 2,
    publishedRawNxQuantityTotal: 2,
    publishedIdentitySetSha256: identitySetSha256,
  };
  const pageSelection = [11, 12] as const;
  const runId = deriveCalloutRunId({
    schemaVersion: "lego.callout-thumbnails/6",
    sourceHash: SOURCE_HASH,
    pageSelection,
    recoveryBenchmark: first.manifest.recoveryBenchmark,
    accounting,
    conservation,
    crops: crops.map(({ metadata }) => metadata),
  });
  const callouts = crops.map(({ metadata: { fileName, ...metadata } }) => ({
    ...metadata,
    file: `runs/${runId}/${fileName}`,
  }));
  return {
    outDirectory,
    pointerFile: "manifest.partial.json",
    runId,
    manifest: {
      schemaVersion: "lego.callout-thumbnails/6",
      sourceHash: SOURCE_HASH,
      pageSelection,
      pagesCropped: 2,
      calloutCount: 2,
      accounting,
      recoveryBenchmark: first.manifest.recoveryBenchmark,
      conservation,
      failures: [],
      callouts,
    },
    crops,
  };
}

afterEach(() => {
  for (const path of roots.splice(0)) rmSync(path, { recursive: true, force: true });
});

describe("callout publication", () => {
  it("ignores an unknown manifest hook without invoking caller toJSON", () => {
    const directory = root();
    const prepared = input(directory);
    let toJsonCalls = 0;
    const manifest = {
      ...prepared.manifest,
      toJSON: () => {
        toJsonCalls += 1;
        return { ...prepared.manifest, schemaVersion: "attacker-schema" };
      },
    } as unknown as CalloutManifest;
    expect(() => assertPublishableCalloutRun({ ...prepared, manifest })).not.toThrow();
    expect(toJsonCalls).toBe(0);
    expect(readdirSync(directory)).toEqual([]);
  });

  it("refuses stateful crop metadata without invoking its accessor", () => {
    const directory = root();
    const prepared = input(directory);
    const outside = join(directory, "..", `${basename(directory)}-outside.png`);
    roots.push(outside);
    const metadata = { ...prepared.crops[0]!.metadata };
    let fileNameReads = 0;
    Object.defineProperty(metadata, "fileName", {
      enumerable: true,
      get: () => {
        fileNameReads += 1;
        return fileNameReads === 1
          ? prepared.crops[0]!.metadata.fileName
          : `../${basename(outside)}`;
      },
    });
    expect(() =>
      assertPublishableCalloutRun({
        ...prepared,
        crops: [{ metadata, png: prepared.crops[0]!.png }],
      }),
    ).toThrow(/metadata\.fileName must be one stable own data property/u);
    expect(fileNameReads).toBe(0);
    expect(existsSync(outside)).toBe(false);
    expect(readdirSync(directory)).toEqual([]);
  });

  it("never invokes a caller-overridden crop iterator", () => {
    const directory = root();
    const prepared = input(directory);
    const crops = [...prepared.crops];
    let entriesCalled = false;
    Object.defineProperty(crops, "entries", {
      value: function* () {
        entriesCalled = true;
        while (true) yield [0, prepared.crops[0]!];
      },
    });
    expect(() => assertPublishableCalloutRun({ ...prepared, crops })).not.toThrow();
    expect(entriesCalled).toBe(false);
    expect(readdirSync(directory)).toEqual([]);
  });

  it("rejects Proxy/accessor containers before invoking caller hooks", () => {
    const directory = root();
    const prepared = input(directory);
    let traps = 0;
    const proxiedInput = new Proxy(prepared, {
      get: (target, property, receiver) => {
        traps += 1;
        return Reflect.get(target, property, receiver);
      },
    });
    expect(() => assertPublishableCalloutRun(proxiedInput)).toThrow(/non-Proxy object/u);
    expect(traps).toBe(0);

    let manifestReads = 0;
    const accessorInput = { ...prepared };
    Object.defineProperty(accessorInput, "manifest", {
      get: () => {
        manifestReads += 1;
        return prepared.manifest;
      },
    });
    expect(() => assertPublishableCalloutRun(accessorInput)).toThrow(
      /input\.manifest must be one stable own data property/u,
    );
    expect(manifestReads).toBe(0);

    let cropTraps = 0;
    const proxiedCrop = new Proxy(prepared.crops[0]!, {
      get: (target, property, receiver) => {
        cropTraps += 1;
        return Reflect.get(target, property, receiver);
      },
    });
    expect(() => assertPublishableCalloutRun({ ...prepared, crops: [proxiedCrop] })).toThrow(
      /Callout crop 0 must be one non-Proxy object/u,
    );
    expect(cropTraps).toBe(0);
    expect(readdirSync(directory)).toEqual([]);
  });

  it("rejects a decorated Buffer length without invoking it or writing", () => {
    const directory = root();
    const prepared = input(directory);
    const png = Buffer.from(prepared.crops[0]!.png);
    let lengthReads = 0;
    Object.defineProperty(png, "length", {
      get: () => {
        lengthReads += 1;
        return 1_000_000_000;
      },
    });
    expect(() =>
      assertPublishableCalloutRun({
        ...prepared,
        crops: [{ ...prepared.crops[0]!, png }],
      }),
    ).toThrow(/must not decorate its intrinsic byte length/u);
    expect(lengthReads).toBe(0);
    expect(readdirSync(directory)).toEqual([]);
  });

  it("refuses a Proxy callout array without consulting its traps", () => {
    const directory = root();
    const prepared = input(directory);
    let lengthReads = 0;
    const callouts = new Proxy([...prepared.manifest.callouts], {
      get: (target, property, receiver) => {
        if (property === "length") {
          lengthReads += 1;
          return lengthReads === 1 ? target.length : 1_000_000_000;
        }
        if (property === "toJSON") throw new Error("caller array toJSON was consulted");
        return Reflect.get(target, property, receiver);
      },
    });
    expect(() =>
      assertPublishableCalloutRun({
        ...prepared,
        manifest: { ...prepared.manifest, callouts },
      }),
    ).toThrow(/\.callouts must be one non-Proxy dense array/u);
    expect(lengthReads).toBe(0);
    expect(readdirSync(directory)).toEqual([]);
  });

  it("rejects a path-like pointer name before any filesystem write", () => {
    const sandbox = root();
    const outDirectory = join(sandbox, "out");
    mkdirSync(join(outDirectory, "..."), { recursive: true });
    const outside = join(sandbox, "outside.json");
    const hostile = {
      ...input(outDirectory),
      pointerFile: "../outside.json",
    } as unknown as PublishCalloutRunInput;
    expect(() => publishCalloutRun(hostile)).toThrow(/exact pointer name and run id/);
    expect(existsSync(outside)).toBe(false);
    expect(readdirSync(outDirectory)).toEqual(["..."]);
  });

  it("refuses a linked runs root before staging any retained bytes", () => {
    const directory = root();
    const outside = root();
    const runs = join(directory, "runs");
    symlinkSync(outside, runs, "junction");
    try {
      expect(() => publishCalloutRun(input(directory))).toThrow(
        /Callout runs root .*real directory, not a symlink or junction/u,
      );
      expect(readdirSync(outside)).toEqual([]);
      expect(existsSync(join(directory, "manifest.partial.json"))).toBe(false);
    } finally {
      unlinkSync(runs);
    }
  });

  it("bounds an existing sibling pointer before staging or pointer mutation", () => {
    const directory = root();
    const sibling = join(directory, "manifest.json");
    writeFileSync(sibling, "{");
    truncateSync(sibling, CALLOUT_PUBLICATION_LIMITS.maxPointerBytes + 1);
    expect(() => publishCalloutRun(input(directory))).toThrow(
      /manifest\.json is unreadable.*4194305 bytes; required 2\.\.4194304 bytes/u,
    );
    expect(existsSync(join(directory, "manifest.partial.json"))).toBe(false);
    expect(existsSync(join(directory, "runs"))).toBe(false);
  });

  it("repairs an existing target pointer without parsing an unrelated malformed sibling", () => {
    const directory = root();
    const prepared = input(directory);
    const target = join(directory, prepared.pointerFile);
    const sibling = join(directory, "manifest.json");
    writeFileSync(target, "old-target\n", { flag: "wx" });
    writeFileSync(sibling, "{malformed sibling", { flag: "wx" });

    expect(publishCalloutRun(prepared).reused).toBe(false);
    expect(readFileSync(sibling, "utf8")).toBe("{malformed sibling");
    expect(JSON.parse(readFileSync(target, "utf8"))).toMatchObject({
      schemaVersion: "lego.callout-thumbnails/6",
    });
  });

  it("rejects duplicate callouts keys in an existing pointer without publishing or cleanup", () => {
    const directory = root();
    const sibling = join(directory, "manifest.json");
    const duplicatePointer =
      '{"schemaVersion":"lego.callout-thumbnails/6","callouts":[],"call\\u006futs":[{"file":"p11-c0.png"}]}\n';
    const obsolete = join(directory, "p12-c0.png");
    writeFileSync(sibling, duplicatePointer, { flag: "wx" });
    writeFileSync(obsolete, PNG, { flag: "wx" });

    expect(() => publishCalloutRun(input(directory))).toThrow(
      /manifest\.json is unreadable.*strict JSON.*repeats key "callouts"/su,
    );
    expect(readFileSync(sibling, "utf8")).toBe(duplicatePointer);
    expect(existsSync(obsolete)).toBe(true);
    expect(existsSync(join(directory, "manifest.partial.json"))).toBe(false);
    expect(existsSync(join(directory, "runs"))).toBe(false);
  });

  it("refuses an aggregate PNG snapshot before copying beyond the run limit", () => {
    const directory = root();
    const prepared = input(directory);
    const large = Buffer.alloc(CALLOUT_PUBLICATION_LIMITS.maxCropBytes);
    const crops = Array.from({ length: 17 }, () => ({
      metadata: prepared.crops[0]!.metadata,
      png: large,
    }));
    expect(() => assertPublishableCalloutRun({ ...prepared, crops })).toThrow(
      /run limit before PNG copying/,
    );
    expect(readdirSync(directory)).toEqual([]);
  });

  it("ignores unknown metadata extensions without traversing them", () => {
    const directory = root();
    const prepared = input(directory);
    const metadata = {
      ...prepared.crops[0]!.metadata,
      hostilePadding: Array(1_000_000_000),
    } as unknown as PublishedCallout;
    const crops = [{ metadata, png: PNG }];
    expect(() => assertPublishableCalloutRun({ ...prepared, crops })).not.toThrow();
    expect(readdirSync(directory)).toEqual([]);
  });

  it("validates PNG signature, IHDR, and exact IEND closure", () => {
    expect(inspectPng(PNG)).toEqual({ width: 1, height: 1 });
    expect(() => inspectPng(Buffer.concat([PNG, Buffer.from([0])]))).toThrow(/trailing bytes/);
    expect(() => inspectPng(Buffer.from(PNG.subarray(1)))).toThrow(/signature/);
  });

  it("refuses a crop whose recomputed digest hides a bad PNG chunk CRC", () => {
    const prepared = input(root());
    const corrupt = Buffer.from(PNG);
    corrupt[45] = corrupt[45]! ^ 1;
    expect(() =>
      publishCalloutRun({
        ...prepared,
        crops: [
          {
            metadata: {
              ...prepared.crops[0]!.metadata,
              sha256: hash(corrupt),
            },
            png: corrupt,
          },
        ],
      }),
    ).toThrow(/CRC/);
  });

  it("refuses an empty self-declared recovery benchmark before writing", () => {
    const prepared = input(root());
    const hostile = {
      ...prepared,
      manifest: {
        ...prepared.manifest,
        recoveryBenchmark: { ...prepared.manifest.recoveryBenchmark, scores: [] },
      } as CalloutManifest,
    };
    expect(() => publishCalloutRun(hostile)).toThrow(/exactly two score records/);
    expect(readdirSync(hostile.outDirectory)).toEqual([]);
  });

  it("refuses a non-array failures claim before writing", () => {
    const prepared = input(root());
    const hostile = {
      ...prepared,
      manifest: { ...prepared.manifest, failures: { length: 0 } },
    } as unknown as PublishCalloutRunInput;
    expect(() => publishCalloutRun(hostile)).toThrow(/failures must be one non-Proxy dense array/);
    expect(readdirSync(hostile.outDirectory)).toEqual([]);
  });

  it("refuses a self-declared schema and accounting closure before writing", () => {
    const prepared = input(root());
    const hostile = {
      ...prepared,
      manifest: {
        ...prepared.manifest,
        schemaVersion: "attacker-schema",
        accounting: { ...prepared.manifest.accounting, rawNxQuantityTotal: 999 },
      } as unknown as CalloutManifest,
    };
    expect(() => publishCalloutRun(hostile)).toThrow(/must be a \/6 publication/);
    expect(readdirSync(hostile.outDirectory)).toEqual([]);
  });

  it("refuses a truncated crop set from replacing the full-booklet pointer", () => {
    const prepared = input(root());
    const hostile = {
      ...prepared,
      pointerFile: "manifest.json" as const,
      manifest: { ...prepared.manifest, pageSelection: "full booklet" as const },
    };
    expect(() => publishCalloutRun(hostile)).toThrow(/must be a \/6 publication/);
    expect(readdirSync(hostile.outDirectory)).toEqual([]);
  });

  it("refuses noncanonical identity coordinates and non-JSON numbers before writing", () => {
    for (const { callout, expected } of [
      {
        callout: { ...input(root()).manifest.callouts[0]!, xPt: Number.NaN },
        expected: /\.callouts\[0\]\.xPt must be null, a boolean, a string, or one finite number/u,
      },
      {
        callout: { ...input(root()).manifest.callouts[0]!, identity: "forged-identity" },
        expected: /bounded callout records/u,
      },
    ]) {
      const prepared = input(root());
      const hostile = {
        ...prepared,
        manifest: { ...prepared.manifest, callouts: [callout] },
      } as PublishCalloutRunInput;
      expect(() => publishCalloutRun(hostile)).toThrow(expected);
      expect(readdirSync(hostile.outDirectory)).toEqual([]);
    }
  });

  it("refuses huge sparse nested arrays before serialization or writing", () => {
    const prepared = input(root());
    const sparse = Array(1_000_000_000) as string[];
    const hostileCallout = {
      ...prepared.manifest.callouts[0]!,
      contamination: sparse,
    };
    expect(() =>
      publishCalloutRun({
        ...prepared,
        manifest: { ...prepared.manifest, callouts: [hostileCallout] },
      }),
    ).toThrow(/\.callouts\[0\]\.contamination\.length must be a safe integer in 0\.\.256/u);
    const hostileBenchmark = {
      ...prepared,
      manifest: {
        ...prepared.manifest,
        recoveryBenchmark: { ...prepared.manifest.recoveryBenchmark, scores: sparse },
      },
    } as unknown as PublishCalloutRunInput;
    expect(() => publishCalloutRun(hostileBenchmark)).toThrow(
      /\.recoveryBenchmark\.scores\.length must be a safe integer in 0\.\.2/u,
    );
    expect(() =>
      publishCalloutRun({
        ...prepared,
        crops: [
          {
            ...prepared.crops[0]!,
            metadata: { ...prepared.crops[0]!.metadata, contamination: sparse },
          },
        ],
      }),
    ).toThrow(/metadata\.contamination\.length must be a safe integer in 0\.\.256/u);
    expect(readdirSync(prepared.outDirectory)).toEqual([]);
  });

  it("reuses only a byte-identical closed run", () => {
    const directory = root();
    expect(publishCalloutRun(input(directory)).reused).toBe(false);
    expect(publishCalloutRun(input(directory)).reused).toBe(true);
  });

  it("refuses a valid publication renamed to a non-content-addressed run", () => {
    const directory = root();
    const prepared = input(directory);
    const forgedRunId = prepared.runId === "f".repeat(24) ? "e".repeat(24) : "f".repeat(24);
    const hostile = {
      ...prepared,
      runId: forgedRunId,
      manifest: {
        ...prepared.manifest,
        callouts: prepared.manifest.callouts.map((callout) => ({
          ...callout,
          file: callout.file.replace(prepared.runId, forgedRunId),
        })),
      },
    };
    expect(() => publishCalloutRun(hostile)).toThrow(
      new RegExp(
        `declares run ${forgedRunId}.*derive content-addressed run ${prepared.runId}`,
        "su",
      ),
    );
    expect(readdirSync(directory)).toEqual([]);
  });

  it("derives the same run address without ambient array, string, JSON, or toJSON hooks", () => {
    const prepared = input(root());
    const descriptors = {
      arrayIterator: Object.getOwnPropertyDescriptor(Array.prototype, Symbol.iterator)!,
      arrayMap: Object.getOwnPropertyDescriptor(Array.prototype, "map")!,
      arrayToJson: Object.getOwnPropertyDescriptor(Array.prototype, "toJSON"),
      objectToJson: Object.getOwnPropertyDescriptor(Object.prototype, "toJSON"),
      replaceAll: Object.getOwnPropertyDescriptor(String.prototype, "replaceAll")!,
      stringify: Object.getOwnPropertyDescriptor(JSON, "stringify")!,
    };
    const hostile = () => {
      throw new Error("ambient hook consulted");
    };
    let observed: string;
    try {
      Object.defineProperty(Array.prototype, Symbol.iterator, {
        ...descriptors.arrayIterator,
        value: hostile,
      });
      Object.defineProperty(Array.prototype, "map", { ...descriptors.arrayMap, value: hostile });
      Object.defineProperty(Array.prototype, "toJSON", {
        configurable: true,
        writable: true,
        value: hostile,
      });
      Object.defineProperty(Object.prototype, "toJSON", {
        configurable: true,
        writable: true,
        value: hostile,
      });
      Object.defineProperty(String.prototype, "replaceAll", {
        ...descriptors.replaceAll,
        value: hostile,
      });
      Object.defineProperty(JSON, "stringify", { ...descriptors.stringify, value: hostile });
      observed = deriveCalloutManifestRunId(prepared.manifest);
    } finally {
      Object.defineProperty(Array.prototype, Symbol.iterator, descriptors.arrayIterator);
      Object.defineProperty(Array.prototype, "map", descriptors.arrayMap);
      if (descriptors.arrayToJson) {
        Object.defineProperty(Array.prototype, "toJSON", descriptors.arrayToJson);
      } else {
        delete (Array.prototype as { toJSON?: unknown }).toJSON;
      }
      if (descriptors.objectToJson) {
        Object.defineProperty(Object.prototype, "toJSON", descriptors.objectToJson);
      } else {
        delete (Object.prototype as { toJSON?: unknown }).toJSON;
      }
      Object.defineProperty(String.prototype, "replaceAll", descriptors.replaceAll);
      Object.defineProperty(JSON, "stringify", descriptors.stringify);
    }
    expect(observed).toBe(prepared.runId);
  });

  it("refuses independently reordered manifest records or staged crops", () => {
    for (const reordered of ["manifest", "crops"] as const) {
      const directory = root();
      const prepared = twoCropInput(directory);
      const hostile =
        reordered === "manifest"
          ? {
              ...prepared,
              manifest: {
                ...prepared.manifest,
                callouts: [...prepared.manifest.callouts].reverse(),
              },
            }
          : { ...prepared, crops: [...prepared.crops].reverse() };
      expect(() => publishCalloutRun(hostile)).toThrow(
        /metadata at index 0 .*differs from its staged PNG record at that same index/u,
      );
      expect(readdirSync(directory)).toEqual([]);
    }
  });

  it("rejects empty, oversized, or internally inconsistent candidates before pointer mutation", () => {
    const directory = root();
    const prepared = input(directory);
    const pointer = join(directory, prepared.pointerFile);
    writeFileSync(pointer, "old-pointer\n", { flag: "wx" });
    const oversized = Buffer.alloc(CALLOUT_PUBLICATION_LIMITS.maxCropBytes + 1);
    expect(() =>
      publishCalloutRun({
        ...prepared,
        crops: [
          {
            metadata: {
              ...prepared.crops[0]!.metadata,
              byteLength: oversized.length,
              sha256: hash(oversized),
            },
            png: oversized,
          },
        ],
      }),
    ).toThrow(/crop 0 PNG must contain/);
    expect(() =>
      publishCalloutRun({
        ...prepared,
        manifest: {
          ...prepared.manifest,
          callouts: [{ ...prepared.manifest.callouts[0]!, stepNumber: 2 }],
        },
      }),
    ).toThrow(/differs from its staged PNG record/);
    expect(() =>
      publishCalloutRun({
        ...prepared,
        manifest: { ...prepared.manifest, calloutCount: 0, callouts: [] },
        crops: [],
      }),
    ).toThrow(/cannot publish an empty/);
    expect(readFileSync(pointer, "utf8")).toBe("old-pointer\n");
  });

  it("leaves the pointer unchanged when an existing manifest is tampered", () => {
    const directory = root();
    const prepared = input(directory);
    publishCalloutRun(prepared);
    const pointer = join(directory, prepared.pointerFile);
    writeFileSync(pointer, "old-pointer\n");
    appendFileSync(join(directory, "runs", prepared.runId, "manifest.json"), "tamper");
    expect(() => publishCalloutRun(prepared)).toThrow(/required exactly .* bytes/);
    expect(readFileSync(pointer, "utf8")).toBe("old-pointer\n");
  });

  it("leaves the pointer unchanged when an existing PNG is missing or changed", () => {
    for (const mode of ["missing", "tampered"] as const) {
      const directory = root();
      const prepared = input(directory);
      publishCalloutRun(prepared);
      const pointer = join(directory, prepared.pointerFile);
      writeFileSync(pointer, `old-${mode}\n`);
      const pngPath = join(directory, "runs", prepared.runId, prepared.crops[0]!.metadata.fileName);
      if (mode === "missing") unlinkSync(pngPath);
      else appendFileSync(pngPath, "tamper");
      expect(() => publishCalloutRun(prepared)).toThrow();
      expect(readFileSync(pointer, "utf8")).toBe(`old-${mode}\n`);
    }
  });

  it("leaves the pointer unchanged across an interrupted pointer swap", () => {
    const directory = root();
    const prepared = input(directory);
    const pointer = join(directory, prepared.pointerFile);
    writeFileSync(pointer, "old-pointer\n", { flag: "wx" });
    expect(() =>
      publishCalloutRun({
        ...prepared,
        fault: (phase) => {
          if (phase === "before-pointer-swap") throw new Error("injected interruption");
        },
      }),
    ).toThrow(/injected interruption/);
    expect(readFileSync(pointer, "utf8")).toBe("old-pointer\n");
    expect(
      readdirSync(directory).filter((name) => name.startsWith(".stage-") || name.endsWith(".tmp")),
    ).toEqual([]);
    expect(publishCalloutRun(prepared).reused).toBe(true);
  });

  /**
   * The type size the booklet printed is the second, independent source for a
   * label's class, and it fails closed. Before it existed, `evidenceContract`
   * returned `part-art` for every identity nobody had preregistered, so four
   * multiplier labels were published as physical and put the piece total 8 above
   * the printed inventory. Each case below must refuse the whole publication and
   * leave the previous pointer and run set untouched.
   */
  describe("published quantity-label type size", () => {
    function refuses(overrides: Partial<PublishedCallout>, expected: RegExp): void {
      const directory = root();
      const prepared = input(directory, "b".repeat(24), overrides);
      const pointer = join(directory, prepared.pointerFile);
      writeFileSync(pointer, "old-pointer\n", { flag: "wx" });
      expect(() => publishCalloutRun(prepared)).toThrow(expected);
      expect(readFileSync(pointer, "utf8")).toBe("old-pointer\n");
      expect(existsSync(join(directory, "runs", prepared.runId))).toBe(false);
    }

    it("refuses a multiplier-face label published as physical part art", () => {
      refuses(
        { heightPt: 16, evidenceKind: "part-art" },
        /multiplier type size but published as physical part art.*p11\|q1\|x1\.000\|y1\.000 at 16pt, published as "part-art"/su,
      );
      refuses({ heightPt: 40, evidenceKind: "part-art" }, /at 40pt, published as "part-art"/u);
    });

    it("refuses a parts-bin-face label published as semantic", () => {
      for (const evidenceKind of ["subassembly-repeat", "assembly-action"] as const) {
        refuses(
          { heightPt: 8, evidenceKind, regionKind: "vector-box-full" },
          new RegExp(
            `parts-bin type size but published as semantic.*at 8pt, published as "${evidenceKind}"`,
            "su",
          ),
        );
      }
    });

    it("refuses a type size the booklet has never been measured at", () => {
      // The gap between the 8pt parts bin and the 16pt multiplier is empty, and
      // 6pt is the back-matter inventory row, which is neither. A face in any of
      // those bands is a new case, so it must stop the run rather than default.
      for (const heightPt of [12, 6, 4, 15.9]) {
        refuses(
          { heightPt },
          new RegExp(`never been measured at.*at ${heightPt}pt, published as "part-art"`, "su"),
        );
      }
    });

    it("refuses a record that publishes no measured type size at all", () => {
      // The exact defect this check exists for: heightPt was extracted from the
      // PDF and then dropped before the manifest record was written.
      refuses(
        { heightPt: undefined as unknown as number },
        /\.callouts\[0\]\.heightPt must be null, a boolean, a string, or one finite number/u,
      );
    });
  });

  it("retains obsolete root PNGs when publication cannot lock both pointers", () => {
    const directory = root();
    writeFileSync(join(directory, "p11-c0.png"), PNG, { flag: "wx" });
    writeFileSync(join(directory, "keep.png"), PNG, { flag: "wx" });
    const prepared = input(directory);
    const result = publishCalloutRun(prepared);
    expect(result.cleanup).toMatchObject({ removedFiles: 0, skippedFiles: 1 });
    expect(result.cleanup.warning).toMatch(/does not hold an atomic lock/u);
    expect(existsSync(join(directory, "p11-c0.png"))).toBe(true);
    expect(existsSync(join(directory, "keep.png"))).toBe(true);
    expect(existsSync(join(result.runDirectory, prepared.crops[0]!.metadata.fileName))).toBe(true);
  });
});
