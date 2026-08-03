import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it, vi } from "vitest";

import { claimsFor } from "./part-identification-score.mjs";
import { commandAsk } from "./part-identification-ask.mjs";
import {
  PART_ANSWERS_SCHEMA,
  PART_CARDS_SCHEMA,
  PART_MATCH_SCHEMA,
  FULL_CALLOUT_MANIFEST_EXPECTATION,
  readBoundManifestCrop,
  sha256Digest,
} from "./part-identification-artifacts.mjs";
import { clusterCallouts, commandFeatures } from "./part-identification.mjs";

function descriptor(seed, pixels) {
  return {
    grid: seed === 0 ? [255, 0] : [0, 255],
    detail: seed === 0 ? [10, 0] : [0, 240],
    aspect: seed === 0 ? 1 : 2,
    ink: seed === 0 ? 0.5 : 0.9,
    pixels,
    mean: seed === 0 ? [10, 10, 10] : [240, 240, 240],
    lightFace: seed === 0 ? 20 : 250,
    colours: [{ rgb: seed === 0 ? [8, 8, 8] : [248, 248, 248], share: 1 }],
  };
}

function physical(identity, seed, pixels) {
  return {
    identity,
    file: `${identity}.png`,
    quantity: 1,
    evidenceKind: "part-art",
    descriptor: descriptor(seed, pixels),
  };
}

function assignmentByIdentity(callouts) {
  const clusters = clusterCallouts(callouts).map((cluster, clusterIndex) => ({
    ...cluster,
    clusterIndex,
    candidates: [{ elementId: `element-${clusterIndex}`, total: 0 }],
  }));
  const claims = claimsFor({ clusters }, { elementIds: [], rows: [] }, "deterministic", null, {
    assign: "nearest",
  });
  return Object.fromEntries(
    [...claims].map(([index, claim]) => [callouts[index].identity, claim.elementId]).sort(),
  );
}

describe("physical part-identification inputs", () => {
  it("rejects an arbitrary manifest evidence kind before feature extraction", async () => {
    const directory = mkdtempSync(join(tmpdir(), "lego-manifest-contract-"));
    const identity = "p11|q1|x43.074|y486.271";
    const identityDigest = sha256Digest(identity);
    const manifest = {
      schemaVersion: "lego.callout-thumbnails/4",
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
          file: "runs/run/crop.png",
          pageNumber: 11,
          stepNumber: 1,
          quantity: 1,
          xPt: 43.074,
          yPt: 486.271,
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
          },
        }),
      ).rejects.toThrow(/fixed evidence contract/);
      await expect(
        commandFeatures(["--callouts", directory, "--inventory", join(directory, "missing")]),
      ).rejects.toThrow(/independently pinned full-booklet publication/);
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
        // If this row were eligible, its high pixel count would make it the
        // first cluster and shift every physical cluster/claim identity.
        descriptor: descriptor(1, 10_000),
      },
      physicalOnly[1],
      physicalOnly[2],
    ];

    const identityGroups = (callouts) =>
      clusterCallouts(callouts).map(({ members }) =>
        members.map((index) => callouts[index].identity).sort(),
      );

    expect(identityGroups(withSemantic)).toEqual(identityGroups(physicalOnly));
    expect(clusterCallouts(withSemantic).flatMap(({ members }) => members)).not.toContain(1);
    expect(assignmentByIdentity(withSemantic)).toEqual(assignmentByIdentity(physicalOnly));
  });

  it("rejects mutated crop bytes before decoding and names the exact input", async () => {
    const directory = mkdtempSync(join(tmpdir(), "lego-bound-crop-"));
    const path = join(directory, "crop.png");
    const original = Buffer.from("original crop bytes");
    const mutated = Buffer.from("mutated crop bytes");
    const decode = vi.fn();
    const entry = {
      identity: "p11|q1|x43.074|y486.271",
      file: "runs/run/p11-q1-x43d074-y486d271.png",
      sha256: sha256Digest(original),
    };
    try {
      writeFileSync(path, mutated);
      await expect(readBoundManifestCrop(entry, path, decode)).rejects.toThrow(
        /p11\|q1\|x43\.074\|y486\.271.*p11-q1-x43d074-y486d271\.png.*digest.*manifest binds/s,
      );
      expect(decode).not.toHaveBeenCalled();
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("rejects a mutated card even when its cluster already has an answer", async () => {
    const directory = mkdtempSync(join(tmpdir(), "lego-card-closure-"));
    const cardsDirectory = join(directory, "cards");
    mkdirSync(cardsDirectory);
    const writeArtifact = (path, value) => {
      const bytes = Buffer.from(JSON.stringify(value));
      writeFileSync(path, bytes);
      return sha256Digest(bytes);
    };
    try {
      const match = {
        schemaVersion: PART_MATCH_SCHEMA,
        featuresDigest: sha256Digest("features"),
        calloutCount: 1,
        clusterCount: 1,
        clusters: [{ clusterIndex: 0 }],
      };
      const matchDigest = writeArtifact(join(directory, "match.json"), match);
      const expectedCardDigest = sha256Digest("expected card bytes");
      const cardsDigest = writeArtifact(join(cardsDirectory, "manifest.json"), {
        schemaVersion: PART_CARDS_SCHEMA,
        matchDigest,
        cards: { "card-0000": expectedCardDigest },
      });
      writeFileSync(join(cardsDirectory, "card-0000.png"), "mutated card bytes");
      writeArtifact(join(directory, "answers-sonnet.json"), {
        schemaVersion: PART_ANSWERS_SCHEMA,
        model: "sonnet",
        matchDigest,
        cardsDigest,
        answers: { 0: { pick: 1 } },
      });

      await expect(commandAsk(["--out", directory, "--model", "sonnet"])).rejects.toThrow(
        /including already-answered clusters/,
      );
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("decodes the same authenticated Buffer even if the path changes afterward", async () => {
    const directory = mkdtempSync(join(tmpdir(), "lego-bound-crop-"));
    const path = join(directory, "crop.png");
    const original = Buffer.from("original crop bytes");
    const entry = {
      identity: "p12|q1|x1.000|y2.000",
      file: "runs/run/p12-q1-x1d000-y2d000.png",
      sha256: sha256Digest(original),
    };
    try {
      writeFileSync(path, original);
      const decoded = await readBoundManifestCrop(entry, path, async (bytes) => {
        writeFileSync(path, "changed after authenticated read");
        expect(bytes).toEqual(original);
        return { decoded: true };
      });
      expect(decoded).toEqual({ decoded: true });
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
