import { createHash } from "node:crypto";

import {
  MAX_IMAGE_ARTIFACT_BYTES,
  readBoundedFile,
  readContainedFile,
} from "./part-identification-io.mjs";
import {
  assertCanonicalCardPng,
  assertCanonicalCardPngHeader,
} from "./part-thumbnail-image-guard.mjs";

export const PART_CARD_IMAGES_SCHEMA = "lego.part-identification-card-images/1";
export const MAX_CARD_IMAGE_COUNT = 4_096;
export const MAX_CARD_IMAGE_BUNDLE_BYTES = 192 * 1024 * 1024;

/**
 * How much raster work one card set may cost, and how much a whole closure verification may.
 *
 * Cards are inflated one at a time and released, so this bounds cumulative work
 * rather than peak memory: a gigapixel is roughly 4 GiB of RGBA scanlines
 * decoded and discarded card by card, while any single card still stays under
 * the 32-mebipixel canvas ceiling.
 *
 * The size is set from what this booklet can actually produce. A distinct
 * drawing per physical callout is the ceiling — 863 of them — and the canonical
 * card raster is 1280 x 756, so the largest set the closure can honestly retain
 * is about 835 mebipixels. The previous 256-mebipixel bound admitted only 273
 * cards and left the retained closure 1.6% under its own authenticator: five
 * more clusters and sealed evidence would have become unreadable by the code
 * that must read it, which regenerating cannot fix because the run is immutable.
 *
 * A closure verification reads the retained bundle once and the current PNGs
 * once, so `assertCardImageFilesAndBundle` and `verifyRetainedCardImageClosure`
 * charge both halves against one shared budget of exactly twice the set bound.
 * Nothing charges the same set twice under a bound that names a single set.
 */
export const MAX_CARD_IMAGE_SET_PIXELS = 1024 * 1024 * 1024;
export const MAX_CARD_IMAGE_CLOSURE_PIXELS = 2 * MAX_CARD_IMAGE_SET_PIXELS;
const MAGIC = Buffer.from(`${PART_CARD_IMAGES_SCHEMA}\n`, "ascii");
const SHA256 = /^sha256:[0-9a-f]{64}$/u;
const CARD_ID = /^card-(\d{4,10})$/u;

const sha256 = (bytes) => `sha256:${createHash("sha256").update(bytes).digest("hex")}`;

function manifestEntries(manifest) {
  if (
    typeof manifest !== "object" ||
    manifest === null ||
    typeof manifest.cards !== "object" ||
    manifest.cards === null ||
    Array.isArray(manifest.cards)
  ) {
    throw new Error(
      "Card-image verification requires an already validated cards manifest with an object-valued cards index.",
    );
  }
  const entries = Object.entries(manifest.cards).sort(([left], [right]) =>
    left.localeCompare(right),
  );
  if (entries.length < 1 || entries.length > MAX_CARD_IMAGE_COUNT) {
    throw new Error(
      `Card-image verification requires 1 through ${MAX_CARD_IMAGE_COUNT} manifest entries; received ${entries.length}.`,
    );
  }
  for (const [cardId, entry] of entries) {
    const match = CARD_ID.exec(cardId);
    const index = match === null ? Number.NaN : Number(match[1]);
    if (
      match === null ||
      !Number.isSafeInteger(index) ||
      index < 0 ||
      index > 0xffffffff ||
      `card-${String(index).padStart(4, "0")}` !== cardId ||
      typeof entry !== "object" ||
      entry === null ||
      !SHA256.test(entry.sha256 ?? "")
    ) {
      throw new Error(
        `Card-image manifest entry ${JSON.stringify(cardId)} must use the canonical card-NNNN id and declare one sha256 digest.`,
      );
    }
  }
  return entries;
}

function bytesFor(cardBytes, cardId) {
  const bytes = cardBytes instanceof Map ? cardBytes.get(cardId) : cardBytes?.[cardId];
  if (!(bytes instanceof Uint8Array)) {
    throw new Error(
      `Card-image bytes are missing for ${cardId}. Regenerate the complete card set.`,
    );
  }
  return Buffer.from(bytes);
}

function assertOneCard(cardId, entry, bytes) {
  if (bytes.length < 1 || bytes.length > MAX_IMAGE_ARTIFACT_BYTES) {
    throw new Error(
      `Vision card ${cardId} is ${bytes.length} bytes; required 1..${MAX_IMAGE_ARTIFACT_BYTES} bounded PNG bytes.`,
    );
  }
  assertCanonicalCardPng(bytes, `Vision card ${cardId}`);
  const digest = sha256(bytes);
  if (digest !== entry.sha256) {
    throw new Error(
      `Vision card ${cardId} hashes to ${digest}, but its exact match-bound manifest requires ${entry.sha256}. Regenerate every tile, card, and card-image bundle before using adjudicated answers.`,
    );
  }
  return bytes;
}

function boundedCardBytes(cardId, bytes) {
  if (bytes.length < 1 || bytes.length > MAX_IMAGE_ARTIFACT_BYTES) {
    throw new Error(
      `Vision card ${cardId} is ${bytes.length} bytes; required 1..${MAX_IMAGE_ARTIFACT_BYTES} bounded PNG bytes.`,
    );
  }
  return bytes;
}

/**
 * One aggregate raster charge, shared by every half of the same verification.
 *
 * Passing a budget in is how a caller says "this is still the same closure";
 * omitting it charges one fresh set, which is what a single-set entry point
 * such as `encodeCardImageBundle` or a bare `readCardImages` costs.
 */
export function createCardImageDecodeBudget(
  maxPixels = MAX_CARD_IMAGE_SET_PIXELS,
  label = "Card-image set",
) {
  if (!Number.isSafeInteger(maxPixels) || maxPixels < 1) {
    throw new Error(
      `${label} pixel budget must be a positive safe integer; received ${JSON.stringify(maxPixels)}.`,
    );
  }
  let usedPixels = 0;
  return {
    charge(cardId, bytes) {
      const dimensions = assertCanonicalCardPngHeader(
        boundedCardBytes(cardId, bytes),
        `Vision card ${cardId}`,
      );
      const next = usedPixels + dimensions.width * dimensions.height;
      if (!Number.isSafeInteger(next) || next > maxPixels) {
        throw new Error(
          `${label} would decode ${next} pixels after ${cardId}, above its ${maxPixels}-pixel aggregate replay-work limit. ` +
            `A sealed run cannot be regenerated smaller, so this is not fixed by rerunning the card command: cut a smaller card set before sealing the next run, ` +
            `or raise MAX_CARD_IMAGE_SET_PIXELS in scripts/part-identification-card-images.mjs deliberately, with the per-card canvas ceiling and every retained closure re-verified against the new bound.`,
        );
      }
      usedPixels = next;
      return dimensions;
    },
    get usedPixels() {
      return usedPixels;
    },
  };
}

function preflightCardRecords(records, budget = createCardImageDecodeBudget()) {
  for (const { cardId, bytes } of records) budget.charge(cardId, bytes);
  return budget;
}

/** Re-read every actual PNG through the contained same-handle boundary. */
export function readCardImages(cardsRoot, manifest, budget = createCardImageDecodeBudget()) {
  let totalBytes = 0;
  const records = manifestEntries(manifest).map(([cardId, entry]) => {
    if (typeof entry.file !== "string") {
      throw new Error(
        `Vision card ${cardId} has no immutable-run file in its validated manifest. Regenerate the complete card closure.`,
      );
    }
    const bytes = readContainedFile(cardsRoot, entry.file, {
      label: `Vision card ${cardId}`,
      pathLabel: "Vision card path",
      maxBytes: MAX_IMAGE_ARTIFACT_BYTES,
    });
    totalBytes += 8 + bytes.length;
    if (totalBytes > MAX_CARD_IMAGE_BUNDLE_BYTES) {
      throw new Error(
        `Current card PNGs require ${totalBytes} record bytes through ${cardId}, above the ${MAX_CARD_IMAGE_BUNDLE_BYTES}-byte retained-set limit. A sealed run cannot be regenerated smaller: cut a smaller card set before sealing the next run, or raise MAX_CARD_IMAGE_BUNDLE_BYTES deliberately and re-verify every retained closure against it.`,
      );
    }
    return { cardId, entry, bytes };
  });
  preflightCardRecords(records, budget);
  const images = new Map();
  for (const { cardId, entry, bytes } of records) {
    images.set(cardId, assertOneCard(cardId, entry, bytes));
  }
  return images;
}

/**
 * Exactly the named cards, each authenticated against the digest its manifest binds.
 *
 * A reader that needs the pixels of five cards out of two hundred and sixty-nine
 * should not inflate the other two hundred and sixty-four to get them. The bound
 * is the same either way: the manifest is validated whole before this is called,
 * and each returned card still has to hash to the entry that names it, so a
 * subset read is as authenticated as the closure — it simply proves less about
 * the cards it did not open, which is exactly what it claims.
 */
export function readBoundCardImages(
  cardsRoot,
  manifest,
  cardIds,
  budget = createCardImageDecodeBudget(),
) {
  const entries = new Map(manifestEntries(manifest));
  const images = new Map();
  for (const cardId of cardIds) {
    const entry = entries.get(cardId);
    if (entry === undefined || typeof entry.file !== "string") {
      throw new Error(
        `Vision card ${JSON.stringify(cardId)} is not one immutable-run entry of the validated cards manifest.`,
      );
    }
    const bytes = readContainedFile(cardsRoot, entry.file, {
      label: `Vision card ${cardId}`,
      pathLabel: "Vision card path",
      maxBytes: MAX_IMAGE_ARTIFACT_BYTES,
    });
    budget.charge(cardId, bytes);
    images.set(cardId, assertOneCard(cardId, entry, bytes));
  }
  return images;
}

/** Encode sorted card id/length/PNG records without base64 inflation or archive ambiguity. */
export function encodeCardImageBundle(manifest, cardBytes) {
  const entries = manifestEntries(manifest);
  const records = entries.map(([cardId, entry]) => ({
    cardId,
    entry,
    bytes: bytesFor(cardBytes, cardId),
  }));
  const encodedBytes = records.reduce((total, { bytes }) => total + 8 + bytes.length, 0);
  if (MAGIC.length + 4 + encodedBytes > MAX_CARD_IMAGE_BUNDLE_BYTES) {
    throw new Error(
      `Card-image bundle would be ${MAGIC.length + 4 + encodedBytes} bytes, above the ${MAX_CARD_IMAGE_BUNDLE_BYTES}-byte replay-role limit. Reduce the card set before sealing this run; a run already sealed at this size cannot be regenerated smaller and needs a deliberately raised bound instead.`,
    );
  }
  preflightCardRecords(records);
  const header = Buffer.alloc(MAGIC.length + 4);
  MAGIC.copy(header, 0);
  header.writeUInt32BE(entries.length, MAGIC.length);
  const chunks = [header];
  let totalBytes = header.length;
  for (const { cardId, entry, bytes: held } of records) {
    const bytes = assertOneCard(cardId, entry, held);
    const record = Buffer.alloc(8);
    record.writeUInt32BE(Number(CARD_ID.exec(cardId)[1]), 0);
    record.writeUInt32BE(bytes.length, 4);
    totalBytes += record.length + bytes.length;
    if (totalBytes > MAX_CARD_IMAGE_BUNDLE_BYTES) {
      throw new Error(
        `Card-image bundle would be ${totalBytes} bytes, above the ${MAX_CARD_IMAGE_BUNDLE_BYTES}-byte replay-role limit. Reduce the bounded card set instead of producing an unretainable run.`,
      );
    }
    chunks.push(record, bytes);
  }
  return Buffer.concat(chunks, totalBytes);
}

export function cardImageBundleArtifact(bytes) {
  if (!(bytes instanceof Uint8Array)) {
    throw new Error("Card-image bundle artifact requires exact binary bytes.");
  }
  const held = Buffer.from(bytes);
  if (held.length < MAGIC.length + 4 || held.length > MAX_CARD_IMAGE_BUNDLE_BYTES) {
    throw new Error(
      `Card-image bundle is ${held.length} bytes; required ${MAGIC.length + 4}..${MAX_CARD_IMAGE_BUNDLE_BYTES} bytes.`,
    );
  }
  return { bytes: held, digest: sha256(held) };
}

export function authenticateCardImageBundle(
  artifact,
  manifest,
  budget = createCardImageDecodeBudget(),
) {
  const sourceBytes = artifact?.bytes;
  const declaredDigest = artifact?.digest;
  if (!(sourceBytes instanceof Uint8Array)) {
    throw new Error("Card-image replay artifact must supply exact bounded binary bytes.");
  }
  const authenticated = cardImageBundleArtifact(sourceBytes);
  if (declaredDigest !== undefined && declaredDigest !== authenticated.digest) {
    throw new Error(
      `Card-image replay artifact declares ${JSON.stringify(declaredDigest)}, but its exact bytes hash to ${authenticated.digest}.`,
    );
  }
  const bytes = authenticated.bytes;
  if (!bytes.subarray(0, MAGIC.length).equals(MAGIC)) {
    throw new Error(
      `Card-image replay artifact does not begin with ${PART_CARD_IMAGES_SCHEMA}; regenerate the deterministic binary bundle.`,
    );
  }
  const entries = manifestEntries(manifest);
  const count = bytes.readUInt32BE(MAGIC.length);
  if (count !== entries.length) {
    throw new Error(
      `Card-image replay artifact declares ${count} records, but the exact cards manifest requires ${entries.length}.`,
    );
  }
  const images = new Map();
  const records = [];
  let offset = MAGIC.length + 4;
  for (const [cardId, entry] of entries) {
    if (offset + 8 > bytes.length) {
      throw new Error(`Card-image replay artifact ended before the ${cardId} record header.`);
    }
    const expectedIndex = Number(CARD_ID.exec(cardId)[1]);
    const index = bytes.readUInt32BE(offset);
    const length = bytes.readUInt32BE(offset + 4);
    offset += 8;
    if (index !== expectedIndex || length < 1 || length > MAX_IMAGE_ARTIFACT_BYTES) {
      throw new Error(
        `Card-image replay record for ${cardId} declares index ${index} and ${length} bytes; required index ${expectedIndex} and 1..${MAX_IMAGE_ARTIFACT_BYTES} bytes.`,
      );
    }
    if (offset + length > bytes.length) {
      throw new Error(
        `Card-image replay artifact ended inside ${cardId}: declared ${length} bytes with only ${bytes.length - offset} remaining.`,
      );
    }
    const image = bytes.subarray(offset, offset + length);
    records.push({ cardId, entry, bytes: image });
    offset += length;
  }
  if (offset !== bytes.length) {
    throw new Error(
      `Card-image replay artifact has ${bytes.length - offset} trailing bytes after its exact manifest-bound records.`,
    );
  }
  preflightCardRecords(records, budget);
  for (const { cardId, entry, bytes: image } of records) {
    images.set(cardId, Buffer.from(assertOneCard(cardId, entry, image)));
  }
  return { ...authenticated, images };
}

export function readCardImageBundle(path, manifest, budget = createCardImageDecodeBudget()) {
  const bytes = readBoundedFile(path, {
    label: "part-identification card-image replay bundle",
    maxBytes: MAX_CARD_IMAGE_BUNDLE_BYTES,
  });
  return authenticateCardImageBundle(cardImageBundleArtifact(bytes), manifest, budget);
}

export function readCardImageBundleFromRoot(
  cardsRoot,
  manifest,
  budget = createCardImageDecodeBudget(),
) {
  // Captured once: a manifest accessor must not be able to pass the containment
  // check with one path and hand the actual read a different one.
  const imagesFile = manifest?.imagesFile;
  if (typeof imagesFile !== "string") {
    throw new Error(
      "Card-image manifest must declare one contained immutable-run imagesFile before its bundle can be read.",
    );
  }
  const bytes = readContainedFile(cardsRoot, imagesFile, {
    label: "part-identification card-image replay bundle",
    pathLabel: "part-identification card-image replay bundle path",
    maxBytes: MAX_CARD_IMAGE_BUNDLE_BYTES,
  });
  return authenticateCardImageBundle(cardImageBundleArtifact(bytes), manifest, budget);
}

function assertSameImages(files, retained) {
  for (const [cardId, bytes] of files) {
    if (!bytes.equals(retained.images.get(cardId))) {
      throw new Error(
        `Vision card ${cardId} differs byte-for-byte between the current PNG and retained replay bundle despite manifest validation. Regenerate the entire card closure.`,
      );
    }
  }
}

/** Require both retained bundle bytes and the current on-disk PNGs to bind the same manifest. */
export function assertCardImageFilesAndBundle(
  cardsRoot,
  artifact,
  manifest,
  budget = createCardImageDecodeBudget(MAX_CARD_IMAGE_CLOSURE_PIXELS, "Card-image closure"),
) {
  const retained = authenticateCardImageBundle(artifact, manifest, budget);
  const files = readCardImages(cardsRoot, manifest, budget);
  assertSameImages(files, retained);
  return retained;
}

/**
 * The whole retained closure, read and cross-checked once under one budget.
 *
 * Reading the bundle and then re-authenticating the same held bytes through
 * `assertCardImageFilesAndBundle` charged a third set for no extra proof, which
 * is how a bound named for one set silently governed three.
 */
export function verifyRetainedCardImageClosure(
  cardsRoot,
  manifest,
  budget = createCardImageDecodeBudget(MAX_CARD_IMAGE_CLOSURE_PIXELS, "Card-image closure"),
) {
  const retained = readCardImageBundleFromRoot(cardsRoot, manifest, budget);
  const files = readCardImages(cardsRoot, manifest, budget);
  assertSameImages(files, retained);
  return retained;
}
