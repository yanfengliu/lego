import { describe, expect, it } from "vitest";

import {
  snapshotCalloutManifest,
  snapshotPublishedCallout,
} from "./callout-publication-schema-snapshot";
import type { CalloutManifest, PublishedCallout, RecoveryBenchmark } from "./callout-types";

const HASH = `sha256:${"a".repeat(64)}`;
const MAX_BYTES = 32 * 1024 * 1024;

function publishedCallout(): PublishedCallout {
  return {
    identity: "p11|q1|x1.000|y1.000",
    fileName: "p11-q1.png",
    pageNumber: 11,
    stepNumber: 1,
    quantity: 2,
    xPt: 1,
    yPt: 2,
    heightPt: 8,
    boxMethod: "vector-smallest",
    box: { minXPt: 0, maxXPt: 10, minYPt: 1, maxYPt: 11 },
    evidenceKind: "part-art",
    regionKind: "isolated-component",
    cropStrategy: "ranked-component",
    masksApplied: ["all-pdf-text", "quantity-label"],
    contamination: [],
    sha256: HASH,
    byteLength: 70,
    widthPx: 8,
    heightPx: 9,
    foregroundPixels: 10,
    sourceTextGlyphPixels: 11,
    sourceQuantityGlyphPixels: 12,
    textGlyphOverlapPixels: 0,
    quantityGlyphOverlapPixels: 1,
    quantityGlyphPixelsMasked: 2,
    cropRectPx: { left: 3, top: 4, right: 5, bottom: 6 },
    boundaryClearancePx: { left: 7, top: 8, right: 9, bottom: 10 },
    sourceComponent: {
      rasterScale: 8,
      boundsPx: { left: 11, top: 12, right: 13, bottom: 14 },
      foregroundPixels: 15,
      rawComponentCount: 2,
      absoluteForegroundSha256: HASH,
    },
  };
}

function recoveryBenchmark(): RecoveryBenchmark {
  return {
    schemaVersion: "lego.callout-recovery-benchmark-result/2",
    fixtureSourceHash: HASH,
    fixedFailureClassSize: 1,
    observedLegacyFailureIdentities: ["p11|q1|x1.000|y1.000"],
    scores: [
      {
        strategy: "evidence-aware",
        valid: 1,
        recovered: 1,
        kindCorrect: 1,
        regionCorrect: 1,
        masksCorrect: 1,
        uncontaminated: 1,
        invalidIdentities: [],
        points: 1_011_111,
      },
      {
        strategy: "legacy-seed",
        valid: 0,
        recovered: 0,
        kindCorrect: 0,
        regionCorrect: 0,
        masksCorrect: 0,
        uncontaminated: 0,
        invalidIdentities: ["p11|q1|x1.000|y1.000"],
        points: 0,
      },
    ],
    selected: "evidence-aware",
    winner: "evidence-aware",
    winningMargin: 1_011_111,
  };
}

function manifest(): CalloutManifest {
  const metadata = publishedCallout();
  const { fileName, ...callout } = metadata;
  return {
    schemaVersion: "lego.callout-thumbnails/6",
    sourceHash: HASH,
    pageSelection: [11],
    pagesCropped: 1,
    calloutCount: 1,
    accounting: {
      rawNxIdentityCount: 1,
      rawNxQuantityTotal: 2,
      physicalPartArtIdentityCount: 1,
      physicalPartArtQuantityTotal: 2,
      semanticIdentityCount: 0,
      semanticQuantityTotal: 0,
    },
    recoveryBenchmark: recoveryBenchmark(),
    conservation: {
      expectedIdentityCount: 1,
      expectedRawNxQuantityTotal: 2,
      expectedIdentitySetSha256: HASH,
      publishedIdentityCount: 1,
      publishedRawNxQuantityTotal: 2,
      publishedIdentitySetSha256: HASH,
    },
    failures: [],
    callouts: [{ ...callout, file: `runs/aaaaaaaaaaaaaaaaaaaaaaaa/${fileName}` }],
  };
}

function addIgnoredGetter(value: object, key: PropertyKey, called: { count: number }): void {
  Object.defineProperty(value, key, {
    enumerable: true,
    get: () => {
      called.count += 1;
      throw new Error("ignored extension was read");
    },
  });
}

describe("callout publication exact-schema snapshots", () => {
  it("reconstructs only PublishedCallout fields without enumerating caller extensions", () => {
    const source = publishedCallout() as PublishedCallout & Record<PropertyKey, unknown>;
    const called = { count: 0 };
    Object.defineProperty(source, "fileName", {
      value: source.fileName,
      enumerable: false,
    });
    addIgnoredGetter(source, "toJSON", called);
    addIgnoredGetter(source, Symbol("root-extra"), called);
    addIgnoredGetter(source.box, "boxExtra", called);
    addIgnoredGetter(source.cropRectPx, "cropExtra", called);
    addIgnoredGetter(source.boundaryClearancePx, "clearanceExtra", called);
    addIgnoredGetter(source.sourceComponent!, "componentExtra", called);
    addIgnoredGetter(source.sourceComponent!.boundsPx, "boundsExtra", called);
    addIgnoredGetter(source.masksApplied, "arrayExtra", called);
    addIgnoredGetter(source.masksApplied, Symbol.iterator, called);

    const report = snapshotPublishedCallout(source, "Callout crop 0 metadata", MAX_BYTES);

    expect(report.value).toEqual(publishedCallout());
    expect(Object.keys(report.value)).toEqual([
      "identity",
      "pageNumber",
      "stepNumber",
      "quantity",
      "xPt",
      "yPt",
      "heightPt",
      "boxMethod",
      "box",
      "evidenceKind",
      "regionKind",
      "cropStrategy",
      "masksApplied",
      "contamination",
      "sha256",
      "byteLength",
      "widthPx",
      "heightPx",
      "foregroundPixels",
      "sourceTextGlyphPixels",
      "sourceQuantityGlyphPixels",
      "textGlyphOverlapPixels",
      "quantityGlyphOverlapPixels",
      "quantityGlyphPixelsMasked",
      "cropRectPx",
      "boundaryClearancePx",
      "sourceComponent",
      "fileName",
    ]);
    expect(Object.getPrototypeOf(report.value)).toBe(null);
    expect(Object.getOwnPropertyDescriptor(report.value.masksApplied, "toJSON")?.value).toBe(
      undefined,
    );
    expect(report.encodedBytes).toBe(Buffer.byteLength(JSON.stringify(report.value)));
    expect(called.count).toBe(0);
  });

  it("reconstructs the full manifest closure while ignoring extras at every record layer", () => {
    const source = manifest() as CalloutManifest & Record<PropertyKey, unknown>;
    const called = { count: 0 };
    for (const record of [
      source,
      source.accounting,
      source.conservation,
      source.recoveryBenchmark,
      source.recoveryBenchmark.scores[0]!,
      source.callouts[0]!,
    ]) {
      addIgnoredGetter(record, "extension", called);
    }
    addIgnoredGetter(source.pageSelection as object, "pageExtension", called);
    addIgnoredGetter(source.recoveryBenchmark.scores, "scoreExtension", called);
    addIgnoredGetter(source.callouts, Symbol.iterator, called);

    const report = snapshotCalloutManifest(source, "Callout manifest", MAX_BYTES);

    expect(report.value).toEqual(manifest());
    expect(Object.keys(report.value)).toEqual([
      "schemaVersion",
      "sourceHash",
      "pageSelection",
      "pagesCropped",
      "calloutCount",
      "accounting",
      "recoveryBenchmark",
      "conservation",
      "failures",
      "callouts",
    ]);
    expect(Object.keys(report.value.callouts[0]!).at(-1)).toBe("file");
    expect(report.encodedBytes).toBe(Buffer.byteLength(JSON.stringify(report.value)));
    expect(called.count).toBe(0);
  });

  it("rejects known accessors and nested proxies without invoking caller code", () => {
    const accessor = publishedCallout() as PublishedCallout & Record<string, unknown>;
    let getterCalls = 0;
    Object.defineProperty(accessor, "fileName", {
      get: () => {
        getterCalls += 1;
        return "forged.png";
      },
    });
    expect(() => snapshotPublishedCallout(accessor, "Callout crop 0 metadata", MAX_BYTES)).toThrow(
      /metadata\.fileName must be one stable own data property/u,
    );
    expect(getterCalls).toBe(0);

    let trapCalls = 0;
    const proxiedBox = new Proxy(
      { minXPt: 0, maxXPt: 1, minYPt: 0, maxYPt: 1 },
      {
        getOwnPropertyDescriptor: () => {
          trapCalls += 1;
          return undefined;
        },
        getPrototypeOf: () => {
          trapCalls += 1;
          return Object.prototype;
        },
      },
    );
    const withProxy = { ...publishedCallout(), box: proxiedBox };
    expect(() => snapshotPublishedCallout(withProxy, "Callout crop 0 metadata", MAX_BYTES)).toThrow(
      /metadata\.box must be one non-Proxy plain record/u,
    );
    expect(trapCalls).toBe(0);

    const revoked = Proxy.revocable({}, {});
    revoked.revoke();
    expect(() => snapshotCalloutManifest(revoked.proxy, "Callout manifest", MAX_BYTES)).toThrow(
      /non-Proxy plain record/u,
    );
  });

  it("requires bounded plain dense arrays but ignores all non-index decorations", () => {
    const sparse = { ...publishedCallout(), masksApplied: new Array(1) } as PublishedCallout;
    expect(() => snapshotPublishedCallout(sparse, "Callout crop 0 metadata", MAX_BYTES)).toThrow(
      /masksApplied\[0\] must be one stable own data property/u,
    );

    const oversized = {
      ...publishedCallout(),
      masksApplied: new Array(3).fill("all-pdf-text"),
    } as PublishedCallout;
    expect(() => snapshotPublishedCallout(oversized, "Callout crop 0 metadata", MAX_BYTES)).toThrow(
      /masksApplied\.length must be a safe integer in 0\.\.2/u,
    );

    const subclassed = {
      ...publishedCallout(),
      contamination: new (class extends Array<string> {})("x"),
    } as PublishedCallout;
    expect(() =>
      snapshotPublishedCallout(subclassed, "Callout crop 0 metadata", MAX_BYTES),
    ).toThrow(/contamination must be one non-Proxy dense array/u);

    let traps = 0;
    const proxied = {
      ...publishedCallout(),
      masksApplied: new Proxy(["all-pdf-text"], {
        get: () => {
          traps += 1;
          return undefined;
        },
      }),
    } as PublishedCallout;
    expect(() => snapshotPublishedCallout(proxied, "Callout crop 0 metadata", MAX_BYTES)).toThrow(
      /masksApplied must be one non-Proxy dense array/u,
    );
    expect(traps).toBe(0);
  });

  it("rejects object-valued scalar leaves before any own-key enumeration", () => {
    let getterCalls = 0;
    const hostileScalar = Object.create(null) as Record<string, unknown>;
    Object.defineProperty(hostileScalar, "x".repeat(128 * 1024), {
      enumerable: true,
      get: () => {
        getterCalls += 1;
        return "forged";
      },
    });

    const objectField = {
      ...publishedCallout(),
      identity: hostileScalar,
    } as unknown as PublishedCallout;
    expect(() =>
      snapshotPublishedCallout(objectField, "Callout crop 0 metadata", MAX_BYTES),
    ).toThrow(/metadata\.identity must be null, a boolean, a string, or one finite number/u);

    const objectArrayItem = {
      ...publishedCallout(),
      masksApplied: [hostileScalar],
    } as unknown as PublishedCallout;
    expect(() =>
      snapshotPublishedCallout(objectArrayItem, "Callout crop 0 metadata", MAX_BYTES),
    ).toThrow(
      /metadata\.masksApplied\[0\] must be null, a boolean, a string, or one finite number/u,
    );
    expect(getterCalls).toBe(0);
  });

  it("preserves exact byte and node reports and refuses one-unit overruns", () => {
    const source = publishedCallout();
    const report = snapshotPublishedCallout(source, "Callout crop 0 metadata", MAX_BYTES);
    expect(
      snapshotPublishedCallout(source, "Callout crop 0 metadata", report.encodedBytes, report.nodes)
        .value,
    ).toEqual(report.value);
    expect(() =>
      snapshotPublishedCallout(source, "Callout crop 0 metadata", report.encodedBytes - 1),
    ).toThrow(/byte UTF-8 ceiling/u);
    expect(() =>
      snapshotPublishedCallout(source, "Callout crop 0 metadata", MAX_BYTES, report.nodes - 1),
    ).toThrow(/exceeds .* nodes/u);
  });

  it("validates invocation limits before reflecting on the source", () => {
    let traps = 0;
    const source = new Proxy(
      {},
      {
        getOwnPropertyDescriptor: () => {
          traps += 1;
          return undefined;
        },
      },
    );
    expect(() => snapshotCalloutManifest(source, "bad\nlabel", MAX_BYTES)).toThrow(
      /printable ASCII/u,
    );
    expect(() => snapshotCalloutManifest(source, "Callout manifest", 0)).toThrow(/byte ceiling/u);
    expect(() => snapshotCalloutManifest(source, "Callout manifest", MAX_BYTES, 0)).toThrow(
      /node ceiling/u,
    );
    expect(traps).toBe(0);
  });

  it("rejects missing known fields and unsupported known values with exact paths", () => {
    const missing = publishedCallout() as PublishedCallout & Record<string, unknown>;
    Reflect.deleteProperty(missing, "identity");
    expect(() => snapshotPublishedCallout(missing, "Callout crop 0 metadata", MAX_BYTES)).toThrow(
      /metadata\.identity must be one stable own data property/u,
    );

    const invalid = { ...publishedCallout(), quantity: Number.NaN };
    expect(() => snapshotPublishedCallout(invalid, "Callout crop 0 metadata", MAX_BYTES)).toThrow(
      /metadata\.quantity must be null, a boolean, a string, or one finite number/u,
    );
  });
});
