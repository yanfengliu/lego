import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it, vi } from "vitest";

import {
  FULL_CALLOUT_MANIFEST_EXPECTATION,
  readBoundInventoryThumbnail,
  readBoundManifestCrop,
  sha256Digest,
} from "./part-identification-artifacts.mjs";
import {
  canonicalPng,
  expectationFor,
  manifestFor,
} from "./booklet-catalog-coverage-test-fixture.mjs";
import { commandFeatures, runPartIdentificationCli } from "./part-identification.mjs";
import { derivePartIdentificationMatch } from "./part-identification-derivation.mjs";
import {
  RUN_ID,
  assignmentByIdentity,
  descriptor,
  physical,
} from "./part-identification-test-fixture.mjs";

describe("part-identification feature extraction and bound source reads", () => {
  it("reports truthful help and explicitly rejects the nonexistent resolve command", async () => {
    const stdout = vi.fn();
    const stderr = vi.fn();
    await expect(runPartIdentificationCli(["--help"], { stdout, stderr })).resolves.toBe(0);
    expect(stdout.mock.calls.flat().join("\n")).toMatch(/features.*match.*ask.*score/s);
    await expect(runPartIdentificationCli(["resolve"], { stdout, stderr })).resolves.toBe(1);
    expect(stderr.mock.calls.flat().join("\n")).toMatch(/There is no resolver command/);
  });

  it("rejects arbitrary manifest evidence before feature extraction", async () => {
    const directory = mkdtempSync(join(tmpdir(), "lego-manifest-contract-"));
    const identity = "p11|q1|x43.074|y486.271";
    const identityDigest = sha256Digest(identity);
    const manifest = {
      schemaVersion: "lego.callout-thumbnails/6",
      sourceHash: FULL_CALLOUT_MANIFEST_EXPECTATION.sourceHash,
      pageSelection: "full booklet",
      pagesCropped: 1,
      calloutCount: 1,
      accounting: {
        rawNxIdentityCount: 1,
        rawNxQuantityTotal: 1,
        physicalPartArtIdentityCount: 0,
        physicalPartArtQuantityTotal: 0,
        semanticIdentityCount: 1,
        semanticQuantityTotal: 1,
      },
      recoveryBenchmark: {
        schemaVersion: "lego.callout-recovery-benchmark-result/2",
        fixtureSourceHash: FULL_CALLOUT_MANIFEST_EXPECTATION.sourceHash,
        fixedFailureClassSize: 1,
        observedLegacyFailureIdentities: [identity],
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
            invalidIdentities: [identity],
            points: 0,
          },
        ],
        selected: "evidence-aware",
        winner: "evidence-aware",
        winningMargin: 1_011_111,
      },
      conservation: {
        expectedIdentityCount: 1,
        expectedRawNxQuantityTotal: 1,
        expectedIdentitySetSha256: identityDigest,
        publishedIdentityCount: 1,
        publishedRawNxQuantityTotal: 1,
        publishedIdentitySetSha256: identityDigest,
      },
      failures: [],
      callouts: [
        {
          identity,
          file: `runs/${RUN_ID}/p11-q1-x43d074-y486d271.png`,
          pageNumber: 11,
          stepNumber: 1,
          quantity: 1,
          xPt: 43.074,
          yPt: 486.271,
          heightPt: 8,
          evidenceKind: "attacker-controlled",
          sha256: sha256Digest("crop"),
        },
      ],
    };
    try {
      writeFileSync(join(directory, "manifest.json"), JSON.stringify(manifest));
      await expect(
        commandFeatures(["--callouts", directory, "--inventory", join(directory, "missing")], {
          manifestExpectation: {
            sourceHash: manifest.sourceHash,
            pagesCropped: 1,
            identityCount: 1,
            rawQuantity: 1,
            identitySetDigest: identityDigest,
            accounting: manifest.accounting,
            recoveryFailureIdentities: [identity],
          },
        }),
      ).rejects.toThrow(/exactly its versioned keys|fixed evidence contract/);
      await expect(
        commandFeatures(["--callouts", directory, "--inventory", join(directory, "missing")]),
      ).rejects.toThrow(/independently pinned full-booklet publication/);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("authenticates missing and tampered semantic crop bytes before feature derivation", async () => {
    const directory = mkdtempSync(join(tmpdir(), "lego-semantic-crop-"));
    const inventoryDirectory = join(directory, "inventory");
    const png = canonicalPng(1_200, 500);
    const semantic = {
      identity: "p33|q4|x274.854|y340.077",
      file: "placeholder.png",
      pageNumber: 33,
      stepNumber: 29,
      quantity: 4,
      xPt: 274.854,
      yPt: 340.077,
      heightPt: 16,
      boxMethod: "vector-smallest",
      box: { minXPt: 250, minYPt: 300, maxXPt: 350, maxYPt: 400 },
      evidenceKind: "subassembly-repeat",
      regionKind: "vector-box-full",
      cropStrategy: "semantic-action-region",
      masksApplied: ["quantity-label"],
      contamination: [],
      widthPx: 1_200,
      heightPx: 500,
      foregroundPixels: 10_000,
      sourceTextGlyphPixels: 10,
      sourceQuantityGlyphPixels: 10,
      textGlyphOverlapPixels: 0,
      quantityGlyphOverlapPixels: 0,
      quantityGlyphPixelsMasked: 10,
      cropRectPx: { left: 0, top: 0, right: 1_199, bottom: 499 },
      boundaryClearancePx: { left: 16, top: 16, right: 16, bottom: 16 },
      sourceComponent: null,
      sha256: sha256Digest(png),
      byteLength: png.length,
    };
    const manifest = manifestFor([semantic]);
    const cropPath = join(directory, ...manifest.callouts[0].file.split("/"));
    try {
      mkdirSync(inventoryDirectory, { recursive: true });
      writeFileSync(join(directory, "manifest.json"), `${JSON.stringify(manifest, null, 1)}\n`);
      await expect(
        commandFeatures(["--callouts", directory, "--inventory", inventoryDirectory], {
          manifestExpectation: expectationFor(manifest),
        }),
      ).rejects.toThrow(/semantic.*could not be read|p33\|q4.*could not be read/s);

      mkdirSync(join(cropPath, ".."), { recursive: true });
      writeFileSync(cropPath, Buffer.alloc(png.length));
      await expect(
        commandFeatures(["--callouts", directory, "--inventory", inventoryDirectory], {
          manifestExpectation: expectationFor(manifest),
        }),
      ).rejects.toThrow(/p33\|q4.*digest.*manifest binds/s);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("keeps physical clusters and claims invariant when semantic rows are inserted", () => {
    const physicalOnly = [
      physical("physical-a1", 0, 100),
      physical("physical-a2", 0, 90),
      physical("physical-b", 1, 80),
    ];
    const withSemantic = [
      physicalOnly[0],
      {
        identity: "semantic-repeat",
        file: "semantic-repeat.png",
        quantity: 4,
        evidenceKind: "subassembly-repeat",
        descriptor: descriptor(1, 10_000),
      },
      physicalOnly[1],
      physicalOnly[2],
    ];
    const inventory = {
      300501: physicalOnly[0].descriptor,
      300502: physicalOnly[2].descriptor,
    };
    const identityGroups = (callouts) =>
      derivePartIdentificationMatch({ callouts, inventory }).clusters.map(({ members }) =>
        members.map((index) => callouts[index].identity).sort(),
      );
    expect(identityGroups(withSemantic)).toEqual(identityGroups(physicalOnly));
    expect(
      derivePartIdentificationMatch({ callouts: withSemantic, inventory }).clusters.flatMap(
        ({ members }) => members,
      ),
    ).not.toContain(1);
    expect(assignmentByIdentity(withSemantic)).toEqual(assignmentByIdentity(physicalOnly));
  });

  it("splits close drawings with different independent inventory tops and joins matching tops", () => {
    const lead = descriptor(0, 4);
    const closeDifferentTop = {
      ...lead,
      mean: [13, 13, 13],
      colours: [{ rgb: [8, 8, 8], share: 1 }],
    };
    const inventory = {
      300501: lead,
      300502: closeDifferentTop,
    };
    const callouts = [
      { ...physical("lead", 0, 4), descriptor: lead },
      { ...physical("member", 0, 3), descriptor: closeDifferentTop },
    ];
    const split = derivePartIdentificationMatch({ callouts, inventory });
    expect(split.clusters.map(({ members }) => members)).toEqual([[0], [1]]);
    expect(split.clusters.map(({ memberTopElementIds }) => memberTopElementIds)).toEqual([
      ["300501"],
      ["300502"],
    ]);

    const joined = derivePartIdentificationMatch({
      callouts: [callouts[0], { ...callouts[1], descriptor: lead }],
      inventory,
    });
    expect(joined.clusters.map(({ members }) => members)).toEqual([[0, 1]]);
    expect(joined.clusters[0].memberTopElementIds).toEqual(["300501", "300501"]);
  });

  it("never merges across a legacy base cluster even when a foreign lead has the same top", () => {
    const gray = (value, pixels) => ({
      ...descriptor(0, 4),
      pixels,
      mean: [value, value, value],
      lightFace: value,
      colours: [{ rgb: [value, value, value], share: 1 }],
    });
    const a = gray(0, 3);
    const b = gray(70, 2);
    const c = gray(36, 1);
    const result = derivePartIdentificationMatch({
      callouts: [
        { ...physical("a", 0, 3), descriptor: a },
        { ...physical("b", 0, 2), descriptor: b },
        { ...physical("c", 0, 1), descriptor: c },
      ],
      inventory: { 300501: a, 300502: b },
    });

    // Legacy distance-only greedy is [a,c], [b]. Refinement may split [a,c]
    // but c cannot move into the foreign [b] base even though both top 300502.
    expect(result.clusters.map(({ members }) => members)).toEqual([[0], [2], [1]]);
    expect(result.clusters.map(({ memberTopElementIds }) => memberTopElementIds)).toEqual([
      ["300501"],
      ["300502"],
      ["300502"],
    ]);
    expect(result.clusterGuard.noCrossBaseClusterMerge).toBe(true);
  });

  it("orders candidates by element id, refuses tied guard minima, and never scores semantics", () => {
    const same = descriptor(0, 4);
    const semantic = {
      ...physical("semantic", 0, 4),
      evidenceKind: "subassembly-repeat",
      descriptor: null,
    };
    const result = derivePartIdentificationMatch({
      callouts: [physical("first", 0, 4), physical("second", 0, 4), semantic],
      inventory: { 300502: same, 300501: same },
    });
    expect(result.elementIds).toEqual(["300501", "300502"]);
    expect(result.clusters).toHaveLength(2);
    expect(result.clusters[0]).toMatchObject({
      lead: "first.png",
      members: [0],
      memberTopElementIds: [null],
    });
    expect(result.clusters[1]).toMatchObject({ members: [1], memberTopElementIds: [null] });
    expect(result.clusters[0].candidates.map(({ elementId }) => elementId)).toEqual([
      "300501",
      "300502",
    ]);
    expect(result.clusters.flatMap(({ members }) => members)).not.toContain(2);
  });

  it("uses lower feature index when equal-pixel callouts share one unique inventory top", () => {
    const same = descriptor(0, 4);
    const result = derivePartIdentificationMatch({
      callouts: [physical("first", 0, 4), physical("second", 0, 4)],
      inventory: { 300501: same },
    });
    expect(result.clusters).toHaveLength(1);
    expect(result.clusters[0]).toMatchObject({ lead: "first.png", members: [0, 1] });
  });

  it("rejects mutated crop bytes before decoding and decodes only the authenticated Buffer", async () => {
    const directory = mkdtempSync(join(tmpdir(), "lego-bound-crop-"));
    const relative = `runs/${RUN_ID}/p11-q1-x43d074-y486d271.png`;
    const path = join(directory, ...relative.split("/"));
    const original = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYGD4DwABBAEAX+XDSwAAAABJRU5ErkJggg==",
      "base64",
    );
    const entry = {
      identity: "p11|q1|x43.074|y486.271",
      file: relative,
      sha256: sha256Digest(original),
      byteLength: original.length,
      widthPx: 1,
      heightPx: 1,
    };
    try {
      mkdirSync(join(directory, "runs", RUN_ID), { recursive: true });
      writeFileSync(path, "mutated crop bytes");
      const decode = vi.fn();
      await expect(readBoundManifestCrop(entry, directory, decode)).rejects.toThrow(
        /p11\|q1\|x43\.074\|y486\.271.*digest.*manifest binds/s,
      );
      expect(decode).not.toHaveBeenCalled();

      writeFileSync(path, original);
      const decoded = await readBoundManifestCrop(entry, directory, async (bytes) => {
        writeFileSync(path, "changed after authenticated read");
        expect(bytes).toEqual(original);
        return Buffer.from("transformed crop");
      });
      expect(decoded).toEqual(Buffer.from("transformed crop"));

      writeFileSync(path, original);
      const decodeLengthLie = vi.fn(async () => Buffer.from("must not decode"));
      await expect(
        readBoundManifestCrop(
          { ...entry, byteLength: original.length + 1 },
          directory,
          decodeLengthLie,
        ),
      ).rejects.toThrow(/contains .* bytes.*manifest binds/s);
      expect(decodeLengthLie).not.toHaveBeenCalled();

      await expect(
        readBoundManifestCrop({ ...entry, widthPx: 2 }, directory, async () =>
          Buffer.from("must not decode"),
        ),
      ).rejects.toThrow(/authenticated PNG header of 1 x 1 pixels.*manifest binds 2 x 1/s);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("rejects a same-length post-feature inventory replacement before any derived image decode", async () => {
    const directory = mkdtempSync(join(tmpdir(), "lego-bound-inventory-"));
    const path = join(directory, "300501.png");
    const original = Buffer.from("inventory-A");
    const replacement = Buffer.from("inventory-B");
    expect(replacement.length).toBe(original.length);
    try {
      writeFileSync(path, replacement);
      const decode = vi.fn();
      await expect(
        readBoundInventoryThumbnail("300501", sha256Digest(original), directory, decode),
      ).rejects.toThrow(/300501.*digest.*features bind.*same-path replacement/s);
      expect(decode).not.toHaveBeenCalled();

      writeFileSync(path, original);
      const decoded = await readBoundInventoryThumbnail(
        "300501",
        sha256Digest(original),
        directory,
        async (bytes) => {
          writeFileSync(path, replacement);
          expect(bytes).toEqual(original);
          return { decoded: true };
        },
      );
      expect(decoded).toEqual({ decoded: true });
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
