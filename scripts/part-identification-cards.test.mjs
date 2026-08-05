import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { commandAsk } from "./part-identification-ask.mjs";
import {
  PART_ANSWERS_SCHEMA,
  PART_CARDS_SCHEMA,
  PART_DISTANCES_SCHEMA,
  PART_FEATURES_SCHEMA,
  PART_MATCH_SCHEMA,
  deriveCardRunId,
  sha256Digest,
} from "./part-identification-artifacts.mjs";
import { commandCards } from "./part-identification-cards.mjs";
import {
  cardImageBundleArtifact,
  encodeCardImageBundle,
} from "./part-identification-card-images.mjs";
import { writeContainedFile } from "./part-identification-io.mjs";
import { PART_IDENTIFICATION_MODEL_ID } from "./part-identification-model.mjs";
import { PART_IDENTIFICATION_MODEL_IDENTITY } from "./part-identification-model.mjs";
import { PART_IDENTIFICATION_PROMPT_DIGEST } from "./part-identification-prompt.mjs";
import { option, writeNestedArtifact } from "./part-identification.mjs";
import {
  RUN_ID,
  boundCallout,
  canonicalPng,
  descriptor,
  digest,
  twoTonePng,
  writeArtifact,
  writeIdentificationClosure,
} from "./part-identification-test-fixture.mjs";

/**
 * Card rendering is the slowest thing in this partition — three full canvas
 * publications plus a Windows exact-handle write — so the gallery and its bound
 * closure are built once and the two publication tests carry explicit timeouts.
 * A default 5-second budget failed here under concurrent load for reasons that
 * had nothing to do with the code under test.
 */
describe("part-identification card publication", () => {
  const state = {};

  beforeAll(() => {
    const directory = mkdtempSync(join(tmpdir(), "lego-source-bound-cards-"));
    const out = join(directory, "identification");
    const calloutRoot = join(directory, "callouts");
    const inventoryRoot = join(directory, "inventory");
    const callouts = [
      boundCallout(),
      {
        ...boundCallout(),
        identity: "p11|q1|x108.908|y486.271",
        file: `runs/${RUN_ID}/p11-q1-x108d908-y486d271.png`,
        xPt: 108.908,
        descriptor: descriptor(1, 1),
      },
    ];
    const calloutPaths = callouts.map((callout) => join(calloutRoot, ...callout.file.split("/")));
    const inventoryPaths = [join(inventoryRoot, "300501.png"), join(inventoryRoot, "300502.png")];
    const calloutPng = twoTonePng();
    const inventoryPng = twoTonePng();
    const writeJson = (path, value) =>
      writeFileSync(path, `${JSON.stringify(value, null, 1)}\n`, "utf8");

    for (const path of calloutPaths) mkdirSync(dirname(path), { recursive: true });
    mkdirSync(inventoryRoot, { recursive: true });
    mkdirSync(out, { recursive: true });
    for (const path of calloutPaths) writeFileSync(path, calloutPng);
    for (const path of inventoryPaths) writeFileSync(path, inventoryPng);
    for (const callout of callouts) callout.sha256 = sha256Digest(calloutPng);

    const featuresArtifact = writeArtifact(join(out, "features.json"), {
      schemaVersion: PART_FEATURES_SCHEMA,
      inputDigests: { pdf: digest("pdf"), calloutManifest: digest("manifest") },
      calloutDir: calloutRoot,
      inventoryDir: inventoryRoot,
      manifestCalloutCount: 2,
      calloutCount: 2,
      nonClusteredCalloutCount: 0,
      nonClusteredCallouts: [],
      inventory: { 300501: descriptor(0, 1), 300502: descriptor(1, 1) },
      inventorySourceDigests: {
        300501: sha256Digest(inventoryPng),
        300502: sha256Digest(inventoryPng),
      },
      callouts,
    });
    const matchArtifact = writeArtifact(join(out, "match.json"), {
      schemaVersion: PART_MATCH_SCHEMA,
      featuresDigest: featuresArtifact.digest,
      calloutCount: 2,
      clusterCount: 2,
      clusters: [
        {
          clusterIndex: 0,
          lead: callouts[0].file,
          members: [0],
          pieces: 1,
          candidates: [{ elementId: "300501", total: 0.1 }],
        },
        {
          clusterIndex: 1,
          lead: callouts[1].file,
          members: [1],
          pieces: 1,
          candidates: [{ elementId: "300502", total: 0.1 }],
        },
      ],
    });
    writeArtifact(join(out, "distances.json"), {
      schemaVersion: PART_DISTANCES_SCHEMA,
      featuresDigest: featuresArtifact.digest,
      elementIds: ["300501", "300502"],
      rows: [
        [0.1, 0.2],
        [0.2, 0.1],
      ],
    });

    Object.assign(state, {
      directory,
      out,
      calloutRoot,
      inventoryRoot,
      callouts,
      calloutPaths,
      inventoryPaths,
      calloutPng,
      inventoryPng,
      featuresArtifact,
      matchArtifact,
      helpers: { out, option, writeJson, writeNestedArtifact },
      argv: ["--k", "1", "--callouts", calloutRoot, "--inventory", inventoryRoot],
      manifestPath: join(out, "cards", "manifest.json"),
    });
  });

  afterAll(() => {
    if (state.directory) rmSync(state.directory, { recursive: true, force: true });
  });

  const expectPublishedRunUnchanged = () => {
    expect(readdirSync(state.exactRunDirectory).sort()).toEqual(
      Object.keys(state.exactRunFiles).sort(),
    );
    for (const [file, bytes] of Object.entries(state.exactRunFiles)) {
      expect(readFileSync(join(state.exactRunDirectory, file))).toEqual(bytes);
    }
  };
  const expectNoStagedRuns = () => {
    expect(
      readdirSync(join(state.out, "cards", "runs")).filter((name) => name.startsWith(".staging-")),
    ).toEqual([]);
  };

  it(
    "builds cards from authenticated raw galleries and ignores post-tile swaps",
    { timeout: 30_000 },
    async () => {
      const { argv, helpers, manifestPath } = state;
      await commandCards(argv, helpers);
      const exactManifest = readFileSync(manifestPath);
      const manifest = JSON.parse(exactManifest);
      expect(manifest).toMatchObject({
        schemaVersion: PART_CARDS_SCHEMA,
        featuresDigest: state.featuresArtifact.digest,
        matchDigest: state.matchArtifact.digest,
      });
      state.exactManifest = exactManifest;
      state.exactRunDirectory = join(state.out, "cards", "runs", manifest.runId);
      state.exactRunFiles = Object.fromEntries(
        readdirSync(state.exactRunDirectory).map((file) => [
          file,
          readFileSync(join(state.exactRunDirectory, file)),
        ]),
      );

      // Tiles are a derived convenience; cards must come from the raw galleries.
      const fakeCalloutTile = join(
        state.out,
        "tiles",
        "callout",
        ...state.callouts[0].file.split("/"),
      );
      const fakeInventoryTile = join(state.out, "tiles", "inventory", "300501.png");
      mkdirSync(dirname(fakeCalloutTile), { recursive: true });
      mkdirSync(dirname(fakeInventoryTile), { recursive: true });
      writeFileSync(fakeCalloutTile, "attacker tile A");
      writeFileSync(fakeInventoryTile, "attacker tile B");
      await commandCards(argv, helpers);
      expect(readFileSync(manifestPath)).toEqual(exactManifest);

      let sameRunWrites = 0;
      await commandCards(argv, {
        ...helpers,
        writeContainedFile(root, relativePath, bytes, options) {
          sameRunWrites += 1;
          const corrupted = Buffer.from(bytes);
          corrupted[corrupted.length - 1] ^= 1;
          return writeContainedFile(root, relativePath, corrupted, options);
        },
      });
      expect(sameRunWrites).toBe(0);
      expect(readFileSync(manifestPath)).toEqual(exactManifest);
      expectPublishedRunUnchanged();
      expectNoStagedRuns();
    },
  );

  it(
    "refuses every partial republication and rejects post-feature source swaps",
    { timeout: 30_000 },
    async () => {
      const { helpers, manifestPath, exactManifest, matchArtifact } = state;
      const expandedMatchArtifact = writeArtifact(join(state.out, "match.json"), {
        ...matchArtifact.value,
        clusters: matchArtifact.value.clusters.map((cluster, clusterIndex) => ({
          ...cluster,
          candidates:
            clusterIndex === 0
              ? [
                  { elementId: "300501", total: 0.1 },
                  { elementId: "300502", total: 0.2 },
                ]
              : [
                  { elementId: "300502", total: 0.1 },
                  { elementId: "300501", total: 0.2 },
                ],
        })),
      });
      expect(expandedMatchArtifact.digest).not.toBe(matchArtifact.digest);
      const expandedArgv = [
        "--k",
        "2",
        "--callouts",
        state.calloutRoot,
        "--inventory",
        state.inventoryRoot,
      ];

      await expect(
        commandCards(expandedArgv, {
          ...helpers,
          writeContainedFile(root, relativePath, bytes, options) {
            if (relativePath.endsWith("/images.bin")) throw new Error("injected bundle fault");
            return writeContainedFile(root, relativePath, bytes, options);
          },
        }),
      ).rejects.toThrow(/injected bundle fault/);
      expect(readFileSync(manifestPath)).toEqual(exactManifest);
      expectPublishedRunUnchanged();
      expectNoStagedRuns();

      await expect(
        commandCards(expandedArgv, {
          ...helpers,
          writeContainedFile(root, relativePath, bytes, options) {
            const published = Buffer.from(bytes);
            if (relativePath.endsWith("/images.bin")) {
              published[published.length - 1] ^= 1;
            }
            return writeContainedFile(root, relativePath, published, options);
          },
        }),
      ).rejects.toThrow(/failed (?:its )?PNG CRC|differs byte-for-byte|digest/s);
      expect(readFileSync(manifestPath)).toEqual(exactManifest);
      expectPublishedRunUnchanged();
      expectNoStagedRuns();

      await expect(
        commandCards(expandedArgv, {
          ...helpers,
          writeContainedFile(root, relativePath, bytes, options) {
            const published = Buffer.from(bytes);
            if (relativePath.endsWith("/card-0000.png")) {
              published[published.length - 1] ^= 1;
            }
            return writeContainedFile(root, relativePath, published, options);
          },
        }),
      ).rejects.toThrow(/failed (?:its )?PNG CRC|differs byte-for-byte|digest/s);
      expect(readFileSync(manifestPath)).toEqual(exactManifest);
      expectPublishedRunUnchanged();
      expectNoStagedRuns();

      await expect(
        commandCards(expandedArgv, {
          ...helpers,
          writeJson() {
            throw new Error("injected pointer fault");
          },
        }),
      ).rejects.toThrow(/injected pointer fault/);
      expect(readFileSync(manifestPath)).toEqual(exactManifest);
      expectPublishedRunUnchanged();
      expectNoStagedRuns();

      const changedCallout = Buffer.from(state.calloutPng);
      changedCallout[changedCallout.length - 1] ^= 1;
      expect(changedCallout.length).toBe(state.calloutPng.length);
      writeFileSync(state.calloutPaths[0], changedCallout);
      await expect(commandCards(state.argv, helpers)).rejects.toThrow(/digest.*manifest binds/s);
      expect(readFileSync(manifestPath)).toEqual(exactManifest);
      writeFileSync(state.calloutPaths[0], state.calloutPng);

      const changedInventory = Buffer.from(state.inventoryPng);
      changedInventory[changedInventory.length - 1] ^= 1;
      expect(changedInventory.length).toBe(state.inventoryPng.length);
      writeFileSync(state.inventoryPaths[1], changedInventory);
      await expect(commandCards(state.argv, helpers)).rejects.toThrow(
        /digest.*features bind.*same-path replacement/s,
      );
      expect(readFileSync(manifestPath)).toEqual(exactManifest);
      expectPublishedRunUnchanged();
    },
  );
});

describe("part-identification card closure before a vision call", () => {
  it("rejects a mutated card even when its cluster already has an answer", async () => {
    const directory = mkdtempSync(join(tmpdir(), "lego-card-closure-"));
    const cardsDirectory = join(directory, "cards");
    mkdirSync(cardsDirectory);
    try {
      const { featuresArtifact, matchArtifact } = writeIdentificationClosure(directory);
      const expectedCard = canonicalPng(2, 2);
      const cardEntries = {
        "card-0000": {
          sha256: sha256Digest(expectedCard),
          candidateElementIds: ["300501"],
        },
      };
      const cardRunId = deriveCardRunId(featuresArtifact.digest, matchArtifact.digest, cardEntries);
      const cardsArtifact = writeArtifact(join(cardsDirectory, "manifest.json"), {
        schemaVersion: PART_CARDS_SCHEMA,
        featuresDigest: featuresArtifact.digest,
        matchDigest: matchArtifact.digest,
        runId: cardRunId,
        imagesFile: `runs/${cardRunId}/images.bin`,
        cards: {
          "card-0000": {
            ...cardEntries["card-0000"],
            file: `runs/${cardRunId}/card-0000.png`,
          },
        },
      });
      const manifest = cardsArtifact.value;
      const bundlePath = join(cardsDirectory, ...manifest.imagesFile.split("/"));
      mkdirSync(dirname(bundlePath), { recursive: true });
      writeFileSync(
        bundlePath,
        cardImageBundleArtifact(
          encodeCardImageBundle(manifest, new Map([["card-0000", expectedCard]])),
        ).bytes,
      );
      const cardPath = join(cardsDirectory, ...manifest.cards["card-0000"].file.split("/"));
      mkdirSync(dirname(cardPath), { recursive: true });
      writeFileSync(cardPath, canonicalPng(3, 2, 1));
      writeArtifact(join(directory, `answers-${PART_IDENTIFICATION_MODEL_ID}.json`), {
        schemaVersion: PART_ANSWERS_SCHEMA,
        model: PART_IDENTIFICATION_MODEL_ID,
        modelIdentity: PART_IDENTIFICATION_MODEL_IDENTITY,
        matchDigest: matchArtifact.digest,
        cardsDigest: cardsArtifact.digest,
        promptDigest: PART_IDENTIFICATION_PROMPT_DIGEST,
        answers: {
          0: {
            kind: "brick",
            studsLong: 1,
            studsWide: 1,
            colour: "black",
            pick: 1,
            confidence: 0.9,
          },
        },
      });
      await expect(
        commandAsk(["--out", directory, "--model", PART_IDENTIFICATION_MODEL_ID]),
      ).rejects.toThrow(/including already-answered clusters/);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
