import { createHash } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { CURRENT_LEGACY_RECUT_PINS } from "./part-identification-legacy-recut-source.mjs";
import {
  CURRENT_LEGACY_RECUT_SEMANTIC_PINS,
  verifyPartIdentificationLegacyRecutSemantic,
} from "./part-identification-legacy-recut-semantic.mjs";
import {
  CURRENT_SOURCE_ART_SEMANTIC_REBOUND_PINS,
  verifyPartIdentificationSourceArtSemanticRebound,
} from "./part-identification-source-art-semantic-rebound.mjs";
import { __testOnly as evidenceTestOnly } from "./part-identification-prefix50-semantic-closure-evidence.mjs";
import { bindSameReviewOutcomes } from "./part-identification-prefix50-semantic-closure-review.mjs";
import {
  __testOnly,
  compilePartIdentificationPrefix50SemanticClosure,
  encodePartIdentificationPrefix50SemanticClosure,
  inspectVerifiedPartIdentificationPrefix50SemanticClosure,
  verifyPartIdentificationPrefix50SemanticClosure,
} from "./part-identification-prefix50-semantic-closure.mjs";
import {
  CURRENT_PREFIX50_SEMANTIC_CLOSURE_PINS,
  assertGlobalPrefixConservation,
} from "./part-identification-prefix50-semantic-closure-source.mjs";

const LEGACY_SEMANTIC_PATH = "output/part-identification/legacy-recut-semantic.json";
const SOURCE_ART_PATH = "output/part-identification/source-art-semantic-rebound.json";
const REQUIRED_PATHS = [
  CURRENT_LEGACY_RECUT_PINS.currentManifest.path,
  CURRENT_LEGACY_RECUT_PINS.legacyManifest.path,
  CURRENT_LEGACY_RECUT_PINS.truth.path,
  CURRENT_LEGACY_RECUT_SEMANTIC_PINS.legacyRecut.path,
  CURRENT_LEGACY_RECUT_SEMANTIC_PINS.officialModel.path,
  CURRENT_SOURCE_ART_SEMANTIC_REBOUND_PINS.pdf.path,
  CURRENT_PREFIX50_SEMANTIC_CLOSURE_PINS.inventoryManifest.path,
  CURRENT_PREFIX50_SEMANTIC_CLOSURE_PINS.elementResolution.path,
  CURRENT_PREFIX50_SEMANTIC_CLOSURE_PINS.review57.path,
  CURRENT_PREFIX50_SEMANTIC_CLOSURE_PINS.review3.path,
  CURRENT_PREFIX50_SEMANTIC_CLOSURE_PINS.reviewOutcomes.path,
  LEGACY_SEMANTIC_PATH,
  SOURCE_ART_PATH,
];
const realDescribe = REQUIRED_PATHS.every(existsSync) ? describe : describe.skip;
const digest = (bytes) => `sha256:${createHash("sha256").update(bytes).digest("hex")}`;

function legacySemanticInput() {
  return {
    calloutRoot: "output/callout-thumbnails",
    currentManifestBytes: readFileSync(CURRENT_LEGACY_RECUT_PINS.currentManifest.path),
    legacyManifestBytes: readFileSync(CURRENT_LEGACY_RECUT_PINS.legacyManifest.path),
    legacyRecutArtifactBytes: readFileSync(CURRENT_LEGACY_RECUT_SEMANTIC_PINS.legacyRecut.path),
    officialModelBytes: readFileSync(CURRENT_LEGACY_RECUT_SEMANTIC_PINS.officialModel.path),
    truthBytes: readFileSync(CURRENT_LEGACY_RECUT_PINS.truth.path),
  };
}

function closureInput(source) {
  return {
    calloutManifestBytes: readFileSync(CURRENT_PREFIX50_SEMANTIC_CLOSURE_PINS.calloutManifest.path),
    calloutRoot: "output/callout-thumbnails",
    elementResolutionBytes: readFileSync(
      CURRENT_PREFIX50_SEMANTIC_CLOSURE_PINS.elementResolution.path,
    ),
    inventoryManifestBytes: readFileSync(
      CURRENT_PREFIX50_SEMANTIC_CLOSURE_PINS.inventoryManifest.path,
    ),
    inventoryRoot: "output/inventory-thumbnails",
    officialModelBytes: readFileSync(CURRENT_PREFIX50_SEMANTIC_CLOSURE_PINS.officialModel.path),
    review3Bytes: readFileSync(CURRENT_PREFIX50_SEMANTIC_CLOSURE_PINS.review3.path),
    review57Bytes: readFileSync(CURRENT_PREFIX50_SEMANTIC_CLOSURE_PINS.review57.path),
    reviewOutcomesBytes: readFileSync(CURRENT_PREFIX50_SEMANTIC_CLOSURE_PINS.reviewOutcomes.path),
    source,
  };
}

async function verifiedSource() {
  const semantic = await verifyPartIdentificationLegacyRecutSemantic({
    ...legacySemanticInput(),
    artifactBytes: readFileSync(LEGACY_SEMANTIC_PATH),
  });
  return verifyPartIdentificationSourceArtSemanticRebound({
    manifestBytes: readFileSync(CURRENT_SOURCE_ART_SEMANTIC_REBOUND_PINS.manifest.path),
    officialModelBytes: readFileSync(CURRENT_SOURCE_ART_SEMANTIC_REBOUND_PINS.officialModel.path),
    pdfBytes: readFileSync(CURRENT_SOURCE_ART_SEMANTIC_REBOUND_PINS.pdf.path),
    semantic,
    artifactBytes: readFileSync(SOURCE_ART_PATH),
  });
}

describe("prefix-50 semantic closure hostile primitives", () => {
  it("rejects fake opaque source handles before consuming evidence", async () => {
    await expect(
      compilePartIdentificationPrefix50SemanticClosure({
        calloutManifestBytes: Buffer.from([1]),
        calloutRoot: "x",
        elementResolutionBytes: Buffer.from([1]),
        inventoryManifestBytes: Buffer.from([1]),
        inventoryRoot: "x",
        officialModelBytes: Buffer.from([1]),
        review3Bytes: Buffer.from([1]),
        review57Bytes: Buffer.from([1]),
        reviewOutcomesBytes: Buffer.from([1]),
        source: {},
      }),
    ).rejects.toThrow(/opaque result/u);
  });

  it("has no static-map route around the separate inspected review-outcomes input", async () => {
    await expect(
      compilePartIdentificationPrefix50SemanticClosure({
        calloutManifestBytes: Buffer.from([1]),
        calloutRoot: "x",
        elementResolutionBytes: Buffer.from([1]),
        inventoryManifestBytes: Buffer.from([1]),
        inventoryRoot: "x",
        officialModelBytes: Buffer.from([1]),
        review3Bytes: Buffer.from([1]),
        review57Bytes: Buffer.from([1]),
        source: {},
      }),
    ).rejects.toThrow(/must contain exactly.*reviewOutcomesBytes/u);
  });

  it("rejects malformed review-outcome claims and global quantity drift", () => {
    expect(() => evidenceTestOnly.assertReviewOutcomes({}, [])).toThrow(
      /inspected review-outcomes contract/u,
    );
    expect(() =>
      assertGlobalPrefixConservation(
        [{ elementId: "1", quantity: 320 }],
        Array.from({ length: 320 }, (_, builderIdentityOrdinal) => ({
          builderIdentityOrdinal: builderIdentityOrdinal + 1,
          elementId: "2",
        })),
      ),
    ).toThrow(/Global prefix conservation requires/u);
  });

  it("admits only explicit same outcomes to manual semantic evidence", () => {
    const verified = ["same", "different", "not-observable"].map((identity) => ({
      semantic: { identity },
      evidence: { identity },
    }));
    const reviews = ["same", "different", "not-observable"].map((identity) => ({
      identity,
      review: identity,
    }));
    expect(bindSameReviewOutcomes(verified, reviews)).toEqual([
      expect.objectContaining({ reviewOutcome: "same", semantic: { identity: "same" } }),
    ]);
  });

  it("rejects duplicate, missing, and extra residual review relations", () => {
    const exact = Array.from({ length: 101 }, (_, index) => ({ identity: `i${index}` }));
    expect(() => __testOnly.assertResidualClosure(exact.slice(0, 100), exact)).toThrow(
      /missing, extra, or duplicate/u,
    );
    expect(() =>
      __testOnly.assertResidualClosure([...exact.slice(0, 100), exact[0]], exact),
    ).toThrow(/missing, extra, or duplicate/u);
    expect(() =>
      __testOnly.assertResidualClosure([...exact, { identity: "extra" }], exact),
    ).toThrow(/missing, extra, or duplicate/u);
  });

  it("rejects nonempty source or inventory contamination independently", () => {
    const source = {
      identity: "p1|q1|x1.000|y1.000",
      pageNumber: 1,
      stepNumber: 1,
      quantity: 1,
      evidenceKind: "part-art",
      file: "source.png",
      sha256: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      byteLength: 1,
      contamination: ["text"],
    };
    const inventory = {
      elementId: "1",
      file: "1.png",
      quantity: 1,
      sha256: "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      byteLength: 1,
      contamination: [],
    };
    const context = {
      calloutRoot: "unused",
      inventoryRoot: "unused",
      callouts: new Map([[source.identity, source]]),
      inventory: new Map([["1", inventory]]),
      resolution: { 1: { colorId: "1", name: "x", partNum: "1", quantity: 1 } },
      officialDesign: new Map([["1", "1"]]),
    };
    const row = { identity: source.identity, elementId: "1", evidenceMethod: "review" };
    expect(() => evidenceTestOnly.verifyManualRow(row, context)).toThrow(/contamination/u);
    source.contamination = [];
    inventory.contamination = ["rival"];
    expect(() => evidenceTestOnly.verifyManualRow(row, context)).toThrow(/contamination/u);
  });
});

realDescribe("prefix-50 semantic identity closure", () => {
  let source;
  let input;
  let artifact;
  let artifactBytes;
  let tempRoot;

  beforeAll(async () => {
    source = await verifiedSource();
    input = closureInput(source);
    artifact = await compilePartIdentificationPrefix50SemanticClosure(input);
    artifactBytes = encodePartIdentificationPrefix50SemanticClosure(artifact);
  }, 180_000);

  afterAll(() => {
    if (tempRoot !== undefined) rmSync(tempRoot, { recursive: true, force: true });
  });

  it("reconstructs exactly 187 relations and 320 pieces while retaining the 359-step index", () => {
    expect(artifact.accounting).toEqual(CURRENT_PREFIX50_SEMANTIC_CLOSURE_PINS.expectedAccounting);
    expect(artifact.sourceIndex).toMatchObject({
      calloutRows: 881,
      expectedPrintedSteps: 359,
      prefixPartArtRows: 187,
      prefixPartArtPieces: 320,
    });
    expect(artifact.scope).toMatchObject({
      firstPrintedStep: 1,
      lastPrintedStep: 50,
      suffixStepsReconstructed: false,
    });
    expect(artifact.semanticIdentity).toHaveLength(187);
    expect(artifact.manualEvidence).toHaveLength(101);
    expect(artifact.manualEvidence.every(({ reviewOutcome }) => reviewOutcome === "same")).toBe(
      true,
    );
    expect(artifact.commitments).toMatchObject({
      officialFirst320Sequence: { rows: 320 },
      officialFirst320ElementAggregate: { rows: 86 },
      semanticElementAggregate: { rows: 86 },
    });
    expect(artifact.semanticIdentity).toContainEqual(
      expect.objectContaining({
        identity: "p35|q2|x147.987|y481.711",
        elementId: "4618852",
        officialDesignId: "3245",
        publishedPartNum: "3245c",
      }),
    );
  });

  it("independently verifies exact artifact bytes and returns only an opaque handle", async () => {
    expect(artifactBytes.length).toBe(
      CURRENT_PREFIX50_SEMANTIC_CLOSURE_PINS.expectedArtifact.bytes,
    );
    expect(digest(artifactBytes)).toBe(
      CURRENT_PREFIX50_SEMANTIC_CLOSURE_PINS.expectedArtifact.digest,
    );
    const verified = await verifyPartIdentificationPrefix50SemanticClosure({
      ...input,
      artifactBytes,
    });
    const inspection = inspectVerifiedPartIdentificationPrefix50SemanticClosure(verified);
    expect(Object.keys(verified)).toEqual([]);
    expect(inspection.digest).toBe(CURRENT_PREFIX50_SEMANTIC_CLOSURE_PINS.expectedArtifact.digest);
  });

  it("rejects review-byte, official-byte, and element-resolution drift", async () => {
    for (const key of [
      "review57Bytes",
      "reviewOutcomesBytes",
      "officialModelBytes",
      "elementResolutionBytes",
    ]) {
      const changed = Buffer.from(input[key]);
      changed[0] ^= 1;
      await expect(
        compilePartIdentificationPrefix50SemanticClosure({ ...input, [key]: changed }),
      ).rejects.toThrow(/exact|pinned|valid JSON/u);
    }
  });

  it("rejects manifest contamination drift before it can redefine current evidence", async () => {
    const changed = JSON.parse(input.calloutManifestBytes.toString("utf8"));
    const reviewed = changed.callouts.find(
      ({ identity }) => identity === "p23|q1|x120.898|y467.756",
    );
    reviewed.contamination = ["quantity-glyph"];
    await expect(
      compilePartIdentificationPrefix50SemanticClosure({
        ...input,
        calloutManifestBytes: Buffer.from(`${JSON.stringify(changed)}\n`),
      }),
    ).rejects.toThrow(/exact pinned/u);
  });

  it("rejects a reopened crop whose bytes drift from the manifest digest", async () => {
    tempRoot = mkdtempSync(join(tmpdir(), "lego-prefix50-closure-"));
    const calloutRoot = join(tempRoot, "callouts");
    const inventoryRoot = join(tempRoot, "inventory");
    const manifest = JSON.parse(input.calloutManifestBytes.toString("utf8"));
    const byIdentity = new Map(manifest.callouts.map((row) => [row.identity, row]));
    const inventoryManifest = JSON.parse(input.inventoryManifestBytes.toString("utf8"));
    const byElement = new Map(inventoryManifest.thumbnails.map((row) => [row.elementId, row]));
    for (const row of artifact.manualEvidence) {
      const callout = byIdentity.get(row.identity);
      const inventory = byElement.get(row.elementId);
      const calloutTarget = join(calloutRoot, callout.file);
      const inventoryTarget = join(inventoryRoot, inventory.file);
      mkdirSync(dirname(calloutTarget), { recursive: true });
      mkdirSync(dirname(inventoryTarget), { recursive: true });
      copyFileSync(join(input.calloutRoot, callout.file), calloutTarget);
      if (!existsSync(inventoryTarget)) {
        copyFileSync(join(input.inventoryRoot, inventory.file), inventoryTarget);
      }
    }
    const first = byIdentity.get("p23|q1|x120.898|y467.756");
    writeFileSync(join(calloutRoot, first.file), Buffer.from([0x89, 0x50, 0x4e, 0x47]));
    await expect(
      compilePartIdentificationPrefix50SemanticClosure({
        ...input,
        calloutRoot,
        inventoryRoot,
      }),
    ).rejects.toThrow(/reopened as .* not manifest-bound/u);
  });

  it("rejects current-claim, quantity, and forbidden-authority artifact edits", async () => {
    const changed = structuredClone(artifact);
    changed.accounting.closurePieces += 1;
    changed.semanticIdentity[0].quantity += 1;
    await expect(
      verifyPartIdentificationPrefix50SemanticClosure({
        ...input,
        artifactBytes: encodePartIdentificationPrefix50SemanticClosure(changed),
      }),
    ).rejects.toThrow(/does not independently reproduce/u);
    const forbidden = structuredClone(artifact);
    forbidden.semanticIdentity[0].brickRef = "manufactured-physical-authority";
    expect(() => __testOnly.assertClosedAuthority(forbidden)).toThrow(/forbids/u);
  });
});
