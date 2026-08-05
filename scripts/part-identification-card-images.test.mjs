import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { describe, expect, it } from "vitest";

import { sha256Digest } from "./part-identification-artifacts.mjs";
import { unexpectedCardPngs } from "./part-identification-cards.mjs";
import {
  MAX_CARD_IMAGE_CLOSURE_PIXELS,
  MAX_CARD_IMAGE_SET_PIXELS,
  assertCardImageFilesAndBundle,
  authenticateCardImageBundle,
  cardImageBundleArtifact,
  createCardImageDecodeBudget,
  encodeCardImageBundle,
  readCardImageBundleFromRoot,
  verifyRetainedCardImageClosure,
} from "./part-identification-card-images.mjs";
import { assertBoundedPngDimensions, createPngDecodeBudget } from "./part-thumbnail-image.mjs";
import { canonicalPng, pngHeader } from "./part-identification-test-fixture.mjs";

/** A cards root on disk with one card PNG and its retained replay bundle. */
function publishOneCardClosure(cards = [canonicalPng(2, 2, 7)]) {
  const root = mkdtempSync(join(tmpdir(), "lego-card-image-closure-"));
  const runId = "0123456789abcdef01234567";
  const manifest = {
    runId,
    imagesFile: `runs/${runId}/images.bin`,
    cards: Object.fromEntries(
      cards.map((bytes, index) => {
        const cardId = `card-${String(index).padStart(4, "0")}`;
        return [cardId, { sha256: sha256Digest(bytes), file: `runs/${runId}/${cardId}.png` }];
      }),
    ),
  };
  const bundlePath = join(root, ...manifest.imagesFile.split("/"));
  mkdirSync(dirname(bundlePath), { recursive: true });
  for (const [cardId, entry] of Object.entries(manifest.cards)) {
    writeFileSync(join(root, ...entry.file.split("/")), cards[Number(cardId.slice(5))]);
  }
  const bundle = encodeCardImageBundle(
    manifest,
    new Map(Object.keys(manifest.cards).map((cardId, index) => [cardId, cards[index]])),
  );
  writeFileSync(bundlePath, bundle);
  return { root, manifest, bundle };
}

describe("part-identification card-image replay bundle", () => {
  it("identifies stale canonical card PNGs before a new card publication writes anything", () => {
    expect(
      unexpectedCardPngs(
        ["card-0000.png", "card-0001.png", "images.bin", "manifest.json", "notes.txt"],
        ["card-0000"],
      ),
    ).toEqual(["card-0001.png"]);
  });

  it("rejects oversized PNG dimensions before invoking the native image decoder", () => {
    expect(() => assertBoundedPngDimensions(pngHeader(4_097, 1), "adversarial PNG")).toThrow(
      /4096 per side/,
    );
    const badCrc = pngHeader();
    badCrc[29] ^= 1;
    expect(() => assertBoundedPngDimensions(badCrc, "tampered PNG")).toThrow(
      /unauthenticated PNG IHDR/,
    );
    const incomplete = pngHeader();
    expect(() =>
      encodeCardImageBundle(
        { cards: { "card-0000": { sha256: sha256Digest(incomplete) } } },
        new Map([["card-0000", incomplete]]),
      ),
    ).toThrow(/incomplete.*IHDR, IDAT, and IEND/);
  });

  it("detaches authenticated card images from every caller-owned bundle buffer", () => {
    const original = canonicalPng(2, 2, 7);
    const replacement = canonicalPng(2, 2, 11);
    expect(replacement).toHaveLength(original.length);
    const manifest = {
      cards: { "card-0000": { sha256: sha256Digest(original) } },
    };
    const encoded = encodeCardImageBundle(manifest, new Map([["card-0000", original]]));
    const artifact = cardImageBundleArtifact(encoded);
    const authenticated = authenticateCardImageBundle(artifact, manifest);

    replacement.copy(encoded, encoded.length - replacement.length);
    replacement.copy(artifact.bytes, artifact.bytes.length - replacement.length);
    authenticated.bytes.fill(0);

    expect(authenticated.images.get("card-0000")).toEqual(original);
  });

  it("rejects aggregate card raster work before inflating the first image", () => {
    const image = pngHeader(4_096, 4_096);
    const cards = Object.fromEntries(
      Array.from({ length: MAX_CARD_IMAGE_SET_PIXELS / (4_096 * 4_096) + 1 }, (_, index) => [
        `card-${String(index).padStart(4, "0")}`,
        { sha256: sha256Digest(image) },
      ]),
    );
    const bytes = new Map(Object.keys(cards).map((id) => [id, image]));
    expect(() => encodeCardImageBundle({ cards }, bytes)).toThrow(/aggregate replay-work limit/);
  });

  it("charges aggregate thumbnail and sheet work before each native decode", () => {
    const budget = createPngDecodeBudget("adversarial image workflow", 12);
    expect(budget.charge(pngHeader(2, 2), "first thumbnail")).toEqual({ width: 2, height: 2 });
    expect(() => budget.charge(pngHeader(3, 3), "second sheet cell")).toThrow(
      /13 pixels.*12-pixel aggregate work limit.*before invoking the native decoder/,
    );
    expect(budget.usedPixels).toBe(4);
  });

  it("reads the declared imagesFile exactly once, so no accessor can redirect it", () => {
    const { root, manifest, bundle } = publishOneCardClosure();
    const decoyPath = join(root, "decoy.bin");
    writeFileSync(decoyPath, Buffer.concat([bundle, Buffer.from("trailing")]));
    let reads = 0;
    const accessorManifest = {
      cards: manifest.cards,
      get imagesFile() {
        reads += 1;
        // First read passes the typeof guard, every later read redirects.
        return reads === 1 ? manifest.imagesFile : "decoy.bin";
      },
    };
    try {
      const retained = readCardImageBundleFromRoot(root, accessorManifest);
      expect(reads).toBe(1);
      expect(retained.bytes).toEqual(bundle);
      expect(retained.digest).toBe(sha256Digest(bundle));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("charges one shared budget across both halves of a closure verification", () => {
    const card = canonicalPng(2, 2, 7);
    const { root, manifest } = publishOneCardClosure([card]);
    const onlyOneSet = createCardImageDecodeBudget(4, "Card-image closure");
    try {
      // Four pixels is exactly one 2x2 card set. The retained bundle spends it,
      // so re-reading the same set from disk under the same budget must fail:
      // a fresh per-call counter would silently let a closure charge twice.
      expect(() => verifyRetainedCardImageClosure(root, manifest, onlyOneSet)).toThrow(
        /Card-image closure would decode 8 pixels after card-0000/,
      );
      expect(onlyOneSet.usedPixels).toBe(4);

      const artifact = cardImageBundleArtifact(
        encodeCardImageBundle(manifest, new Map([["card-0000", card]])),
      );
      expect(() =>
        assertCardImageFilesAndBundle(
          root,
          artifact,
          manifest,
          createCardImageDecodeBudget(4, "Card-image closure"),
        ),
      ).toThrow(/Card-image closure would decode 8 pixels after card-0000/);

      // Under the real bound both halves fit, and the whole closure verifies.
      expect(verifyRetainedCardImageClosure(root, manifest).images.get("card-0000")).toEqual(card);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("bounds a closure at exactly two card sets and leaves the retained set real headroom", () => {
    expect(MAX_CARD_IMAGE_CLOSURE_PIXELS).toBe(2 * MAX_CARD_IMAGE_SET_PIXELS);

    // The pinned booklet holds 863 physical callouts, so one distinct drawing
    // per callout is the largest card set it can produce; the canonical card
    // raster is 1280 x 756. The retained 273-card closure sat 1.6% under the
    // old 256-mebipixel bound, which sealed evidence cannot be regenerated to fit.
    const canonicalCardPixels = 1_280 * 756;
    expect(273 * canonicalCardPixels).toBeLessThan(MAX_CARD_IMAGE_SET_PIXELS / 2);
    expect(863 * canonicalCardPixels).toBeLessThan(MAX_CARD_IMAGE_SET_PIXELS);
  });

  it("says that a sealed run cannot be regenerated smaller when its cards exceed the bound", () => {
    const budget = createCardImageDecodeBudget(3, "Card-image set");
    expect(() => budget.charge("card-0000", pngHeader(2, 2))).toThrow(
      /A sealed run cannot be regenerated smaller/,
    );
    expect(() => budget.charge("card-0000", pngHeader(2, 2))).toThrow(
      /raise MAX_CARD_IMAGE_SET_PIXELS in scripts\/part-identification-card-images\.mjs deliberately/,
    );
    expect(budget.usedPixels).toBe(0);
  });
});
