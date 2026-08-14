import { describe, expect, it } from "vitest";

import { assertCalloutManifestExactShape } from "./callout-manifest-shape.mjs";

const score = (strategy) => ({
  strategy,
  valid: 1,
  recovered: 1,
  kindCorrect: 1,
  regionCorrect: 1,
  masksCorrect: 1,
  uncontaminated: 1,
  invalidIdentities: [],
  points: 1,
});

const manifest = () => ({
  schemaVersion: "lego.callout-thumbnails/6",
  sourceHash: "sha256:" + "a".repeat(64),
  pageSelection: [1],
  pagesCropped: 1,
  calloutCount: 1,
  accounting: {
    rawNxIdentityCount: 1,
    rawNxQuantityTotal: 1,
    physicalPartArtIdentityCount: 1,
    physicalPartArtQuantityTotal: 1,
    semanticIdentityCount: 0,
    semanticQuantityTotal: 0,
  },
  recoveryBenchmark: {
    schemaVersion: "lego.callout-recovery-benchmark-result/2",
    fixtureSourceHash: "sha256:" + "a".repeat(64),
    fixedFailureClassSize: 1,
    observedLegacyFailureIdentities: ["p1|q1|x1.000|y1.000"],
    scores: [score("evidence-aware"), score("legacy-seed")],
    selected: "evidence-aware",
    winner: "evidence-aware",
    winningMargin: 1,
  },
  conservation: {
    expectedIdentityCount: 1,
    expectedRawNxQuantityTotal: 1,
    expectedIdentitySetSha256: "sha256:" + "b".repeat(64),
    publishedIdentityCount: 1,
    publishedRawNxQuantityTotal: 1,
    publishedIdentitySetSha256: "sha256:" + "b".repeat(64),
  },
  failures: [],
  callouts: [
    {
      identity: "p1|q1|x1.000|y1.000",
      file: "runs/aaaaaaaaaaaaaaaaaaaaaaaa/p1-q1-x1d000-y1d000.png",
      pageNumber: 1,
      stepNumber: 1,
      quantity: 1,
      xPt: 1,
      yPt: 1,
      heightPt: 8,
      boxMethod: "vector-smallest",
      box: { minXPt: 0, minYPt: 0, maxXPt: 1, maxYPt: 1 },
      evidenceKind: "part-art",
      regionKind: "isolated-component",
      cropStrategy: "ranked-component",
      masksApplied: ["all-pdf-text"],
      contamination: [],
      sha256: "sha256:" + "c".repeat(64),
      byteLength: 1,
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
        absoluteForegroundSha256: "sha256:" + "d".repeat(64),
      },
    },
  ],
});

describe("callout manifest exact shape", () => {
  it("accepts the exact v6 container shape", () => {
    expect(assertCalloutManifestExactShape(manifest())).toBeTruthy();
  });

  it("rejects extra semantics at every propagation boundary", () => {
    for (const mutate of [
      (value) => (value.attacker = true),
      (value) => (value.callouts[0].attacker = true),
      (value) => (value.callouts[0].sourceComponent.attacker = true),
      (value) => (value.recoveryBenchmark.scores[0].attacker = true),
    ]) {
      const value = manifest();
      mutate(value);
      expect(() => assertCalloutManifestExactShape(value)).toThrow(/exactly its versioned keys/u);
    }
  });

  it("is invariant to ambient Array.prototype.toJSON hooks", () => {
    const value = manifest();
    value.callouts[0].sourceComponent.attacker = true;
    let calls = 0;
    try {
      Object.defineProperty(Array.prototype, "toJSON", {
        configurable: true,
        value: () => {
          calls += 1;
          return [];
        },
      });
      expect(() => assertCalloutManifestExactShape(value)).toThrow(/exactly its versioned keys/u);
    } finally {
      delete Array.prototype.toJSON;
    }
    expect(calls).toBe(0);
  });

  it("cannot be bypassed by replacing ambient array predicates", () => {
    const value = manifest();
    delete value.callouts[0].box.minXPt;
    value.callouts[0].box.attacker = 7;
    const original = Object.getOwnPropertyDescriptor(Array.prototype, "every");
    try {
      Object.defineProperty(Array.prototype, "every", {
        configurable: true,
        value: () => true,
      });
      expect(() => assertCalloutManifestExactShape(value)).toThrow(/exactly its versioned keys/u);
    } finally {
      if (original) Object.defineProperty(Array.prototype, "every", original);
      else delete Array.prototype.every;
    }
  });

  it("rejects non-scalar or out-of-contract callout geometry before propagation", () => {
    for (const mutate of [
      (value) => (value.callouts[0].byteLength = {}),
      (value) => (value.callouts[0].box.minXPt = {}),
      (value) => (value.callouts[0].boxMethod = "invented"),
      (value) => (value.callouts[0].heightPt = 101),
    ]) {
      const value = manifest();
      mutate(value);
      expect(() => assertCalloutManifestExactShape(value)).toThrow(/bounded canonical/u);
    }
  });
});
