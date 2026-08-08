import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  renameSync,
  rmdirSync,
  unlinkSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  assertBoundedCanvasDimensions,
  canvasApi,
  createPngDecodeBudget,
  cropToContent,
} from "./part-thumbnail-image.mjs";
import {
  MAX_IMAGE_ARTIFACT_BYTES,
  boundedDirectoryFiles,
  readContainedFile,
  writeContainedFile,
} from "./part-identification-io.mjs";
import {
  PART_CARDS_SCHEMA,
  assertBoundMatchArtifacts,
  deriveCardRunId,
  readBoundInventoryThumbnail,
  readBoundManifestCrop,
  readJsonArtifact,
  sha256Digest,
} from "./part-identification-artifacts.mjs";
import {
  MAX_CARD_IMAGE_BUNDLE_BYTES,
  MAX_CARD_IMAGE_COUNT,
  encodeCardImageBundle,
  verifyRetainedCardImageClosure,
} from "./part-identification-card-images.mjs";
import { assertOrdinaryDirectoryPath } from "./part-identification-contained-path.mjs";
import {
  CARD_LAYOUT,
  cardHeightForLayout,
  cardWidthFor,
  panelBox,
} from "./part-identification-handedness.mjs";

const OUT = "output/part-identification";
const MAX_RETAINED_CARD_RUN_BYTES = 512 * 1024 * 1024;
const MAX_RETAINED_CARD_RUNS = 64;
const WINDOWS_EXACT_DIRECTORY_CLEANUP = fileURLToPath(
  new URL("./windows-lock-exact-files.ps1", import.meta.url),
);
const CARD_RUN_ID = /^[0-9a-f]{24}$/u;
const CARD_RUN_FILE = /^(?:images\.bin|card-\d{4,10}\.png)$/u;

async function drawCard(query, candidates, decodeBudget) {
  if (!Array.isArray(candidates) || candidates.length < 1 || candidates.length > 32) {
    throw new Error(
      `Part-identification cards require 1 through 32 candidates; received ${candidates?.length}.`,
    );
  }
  // Every panel rectangle below comes from the same declaration the handedness
  // reader measures with. A card drawn to one layout and scored against another
  // does not fail loudly — it reads an empty rectangle and calls the hand
  // undecidable — so the two share one source rather than two copies.
  const { cell, queryHeight } = CARD_LAYOUT;
  const width = cardWidthFor(candidates.length);
  const cardDimensions = assertBoundedCanvasDimensions(
    width,
    cardHeightForLayout(),
    "Part-identification card canvas",
  );
  const sources = [query];
  for (const candidate of candidates) {
    sources.push(candidate);
  }
  const prepared = sources.map((source) => ({
    ...source,
    expected: decodeBudget.charge(source.bytes, source.label),
  }));
  const { createCanvas, loadImage } = await canvasApi();
  const canvas = createCanvas(cardDimensions.width, cardDimensions.height);
  const context = canvas.getContext("2d");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#000000";
  context.font = "bold 22px sans-serif";
  context.fillText("QUERY", 12, 26);
  context.fillText("CANDIDATES", 12, queryHeight + 64);
  const place = async ({ bytes, expected }, { left, top, width: boxWidth, height: boxHeight }) => {
    const image = await loadImage(bytes);
    if (image.width !== expected.width || image.height !== expected.height) {
      throw new Error(
        `Part-identification card image decoded as ${image.width} x ${image.height}, but its authenticated PNG IHDR declared ${expected.width} x ${expected.height}.`,
      );
    }
    const scale = Math.min(boxWidth / image.width, boxHeight / image.height);
    context.drawImage(
      image,
      left + (boxWidth - image.width * scale) / 2,
      top + (boxHeight - image.height * scale) / 2,
      image.width * scale,
      image.height * scale,
    );
  };
  await place(prepared[0], panelBox(0, candidates.length));
  for (const [index] of candidates.entries()) {
    const left = index * cell;
    const top = queryHeight + CARD_LAYOUT.candidateTop;
    context.strokeStyle = "#888888";
    context.strokeRect(left + 2, top, cell - 4, cell - 4);
    await place(prepared[index + 1], panelBox(index + 1, candidates.length));
    context.fillStyle = "#000000";
    context.font = "bold 24px sans-serif";
    context.fillText(`${index + 1}`, left + 12, top + 24);
  }
  return canvas.encode("png");
}

export function unexpectedCardPngs(files, expectedCardIds) {
  const expected = new Set(expectedCardIds.map((cardId) => `${cardId}.png`));
  return files.filter((file) => /^card-\d{4}\.png$/u.test(file) && !expected.has(file)).sort();
}

function manifestAtRun(manifest, runPath) {
  return {
    ...manifest,
    imagesFile: `${runPath}/images.bin`,
    cards: Object.fromEntries(
      Object.entries(manifest.cards).map(([cardId, entry]) => [
        cardId,
        { ...entry, file: `${runPath}/${cardId}.png` },
      ]),
    ),
  };
}

function assertExactRunDirectory(cardsRoot, manifest, runPath) {
  const directory = assertOrdinaryDirectoryPath(join(cardsRoot, ...runPath.split("/")), {
    label: `Part-identification immutable card run ${JSON.stringify(runPath)}`,
  });
  const entries = readdirSync(directory, { withFileTypes: true });
  const expected = [
    "images.bin",
    ...Object.keys(manifest.cards).map((cardId) => `${cardId}.png`),
  ].sort();
  const actual = entries.map(({ name }) => name).sort();
  if (
    entries.some((entry) => !entry.isFile() || entry.isSymbolicLink()) ||
    actual.length !== expected.length ||
    actual.some((name, index) => name !== expected[index])
  ) {
    throw new Error(
      `Immutable card run ${JSON.stringify(runPath)} must contain exactly ${expected.length} ordinary files (${expected.join(", ")}); observed ${actual.join(", ") || "no entries"}. Preserve the rejected run for diagnosis and publish a newly derived run rather than repairing reachable bytes in place.`,
    );
  }
  return verifyRetainedCardImageClosure(cardsRoot, manifest);
}

function sameDirectoryIdentity(left, right) {
  return left.ino === right.ino && (left.dev === 0n || right.dev === 0n || left.dev === right.dev);
}

function ordinaryRunEntries(directory, label, { allowEmpty = false } = {}) {
  const entries = readdirSync(directory, { withFileTypes: true });
  if (
    (!allowEmpty && entries.length < 1) ||
    entries.length > MAX_CARD_IMAGE_COUNT + 1 ||
    entries.some(
      (entry) => !entry.isFile() || entry.isSymbolicLink() || !CARD_RUN_FILE.test(entry.name),
    )
  ) {
    throw new Error(
      `${label} must contain ${allowEmpty ? "zero through " : "one through "}${MAX_CARD_IMAGE_COUNT + 1} direct ordinary card-NNNN.png/images.bin files and no links, subdirectories, or foreign entries; observed ${
        entries
          .map(({ name }) => name)
          .sort()
          .join(", ") || "no entries"
      }.`,
    );
  }
  return entries;
}

function retainedCardRunBytes(cardsRoot, ignoredStagingRunPath = null) {
  const runsDirectory = assertOrdinaryDirectoryPath(join(cardsRoot, "runs"), {
    create: true,
    label: "Part-identification retained card-runs root",
  });
  const runs = readdirSync(runsDirectory, { withFileTypes: true });
  if (runs.length > MAX_RETAINED_CARD_RUNS) {
    throw new Error(
      `Part-identification card storage retains ${runs.length} run entries, above the ${MAX_RETAINED_CARD_RUNS}-run audit limit. Preserve and remove obsolete exact runs before publishing another closure.`,
    );
  }
  let total = 0;
  const ignoredStagingName = ignoredStagingRunPath?.split("/").at(-1) ?? null;
  for (const run of runs) {
    if (run.name === ignoredStagingName) continue;
    if (!run.isDirectory() || run.isSymbolicLink() || !CARD_RUN_ID.test(run.name)) {
      throw new Error(
        `Part-identification card storage contains unexpected run entry ${JSON.stringify(run.name)}. Only ordinary immutable 24-hex run directories may remain between publications; exact .staging-* directories must be cleaned by their owning failed invocation.`,
      );
    }
    const directory = assertOrdinaryDirectoryPath(join(runsDirectory, run.name), {
      label: `Retained immutable card run ${run.name}`,
    });
    for (const entry of ordinaryRunEntries(directory, `Retained immutable card run ${run.name}`)) {
      const size = lstatSync(join(directory, entry.name), { bigint: true }).size;
      if (size < 1n || size > BigInt(MAX_CARD_IMAGE_BUNDLE_BYTES)) {
        throw new Error(
          `Retained immutable card run ${run.name}/${entry.name} is ${size} bytes; every retained file must be 1..${MAX_CARD_IMAGE_BUNDLE_BYTES} bytes.`,
        );
      }
      total += Number(size);
      if (!Number.isSafeInteger(total) || total > MAX_RETAINED_CARD_RUN_BYTES) {
        throw new Error(
          `Retained immutable card runs use more than the ${MAX_RETAINED_CARD_RUN_BYTES}-byte aggregate limit. Preserve and remove obsolete exact runs before publishing another closure.`,
        );
      }
    }
  }
  return total;
}

function cleanupStagedCardRun(cardsRoot, stagingRunPath) {
  const directory = assertOrdinaryDirectoryPath(join(cardsRoot, ...stagingRunPath.split("/")), {
    label: `Task-owned staged card run ${JSON.stringify(stagingRunPath)}`,
  });
  const directoryState = lstatSync(directory, { bigint: true });
  if (
    !directoryState.isDirectory() ||
    directoryState.isSymbolicLink() ||
    directoryState.ino <= 0n
  ) {
    throw new Error(
      `Task-owned staged card run ${JSON.stringify(stagingRunPath)} lost its ordinary comparable directory identity; no replacement path was removed.`,
    );
  }
  const entries = ordinaryRunEntries(
    directory,
    `Task-owned staged card run ${JSON.stringify(stagingRunPath)}`,
    { allowEmpty: true },
  );
  if (process.platform === "win32") {
    const files = entries.map(({ name }) => {
      const bytes = readContainedFile(cardsRoot, `${stagingRunPath}/${name}`, {
        label: `Task-owned staged card cleanup ${name}`,
        pathLabel: "Task-owned staged card cleanup path",
        maxBytes: MAX_CARD_IMAGE_BUNDLE_BYTES,
      });
      return { path: join(directory, name), digest: sha256Digest(bytes) };
    });
    const specification = Buffer.from(
      JSON.stringify({
        root: {
          path: directory,
          inode: directoryState.ino.toString(),
          device: directoryState.dev.toString(),
        },
        files,
      }),
      "utf8",
    ).toString("base64");
    const executable = resolve(
      process.env.SystemRoot ?? "C:\\Windows",
      "System32",
      "WindowsPowerShell",
      "v1.0",
      "powershell.exe",
    );
    const result = spawnSync(
      executable,
      [
        "-NoLogo",
        "-NoProfile",
        "-NonInteractive",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        WINDOWS_EXACT_DIRECTORY_CLEANUP,
        "-Specification",
        specification,
      ],
      { encoding: "utf8", timeout: 30_000, windowsHide: true, maxBuffer: 128 * 1024 },
    );
    if (result.status !== 0 || result.error !== undefined || existsSync(directory)) {
      const detail =
        result.error?.message ?? result.stderr?.trim() ?? `PowerShell exited ${result.status}`;
      throw new Error(
        `Task-owned staged card run ${JSON.stringify(stagingRunPath)} could not be removed through exact Windows file/directory handles: ${detail}. No replacement path was recursively removed.`,
        result.error === undefined ? undefined : { cause: result.error },
      );
    }
    return;
  }
  for (const { name } of entries) {
    const observedDirectory = lstatSync(directory, { bigint: true });
    if (!sameDirectoryIdentity(directoryState, observedDirectory)) {
      throw new Error(
        `Task-owned staged card run ${JSON.stringify(stagingRunPath)} changed identity during cleanup; no replacement path was removed.`,
      );
    }
    const file = join(directory, name);
    const state = lstatSync(file, { bigint: true });
    if (!state.isFile() || state.isSymbolicLink()) {
      throw new Error(
        `Task-owned staged card cleanup refused replaced or linked entry ${JSON.stringify(file)}.`,
      );
    }
    unlinkSync(file);
  }
  if (!sameDirectoryIdentity(directoryState, lstatSync(directory, { bigint: true }))) {
    throw new Error(
      `Task-owned staged card run ${JSON.stringify(stagingRunPath)} changed identity before directory removal.`,
    );
  }
  rmdirSync(directory);
}

function publishRunDirectory(cardsRoot, stagingRunPath, finalRunPath) {
  const staging = assertOrdinaryDirectoryPath(join(cardsRoot, ...stagingRunPath.split("/")), {
    label: `Verified staged card run ${JSON.stringify(stagingRunPath)}`,
  });
  const final = join(cardsRoot, ...finalRunPath.split("/"));
  if (existsSync(final)) {
    throw new Error(
      `Immutable card run ${JSON.stringify(finalRunPath)} appeared before publication. Verify and reuse that exact closure; never replace it in place.`,
    );
  }
  renameSync(staging, final);
}

export async function commandCards(argv, helpers) {
  const out = helpers.out ?? OUT;
  const publishContained = helpers.writeContainedFile ?? writeContainedFile;
  const k = Number(helpers.option(argv, "k", "6"));
  if (!Number.isInteger(k) || k < 1 || k > 32) {
    throw new Error(`--k must be an integer from 1 through 32; received ${JSON.stringify(k)}.`);
  }
  const featuresArtifact = readJsonArtifact(
    join(out, "features.json"),
    "part-identification features",
  );
  const matchArtifact = readJsonArtifact(join(out, "match.json"), "part-identification match");
  const distancesArtifact = readJsonArtifact(
    join(out, "distances.json"),
    "part-identification distances",
  );
  const { features, match, artifacts } = assertBoundMatchArtifacts({
    featuresArtifact,
    matchArtifact,
    distancesArtifact,
  });
  const calloutDir = helpers.option(argv, "callouts", "output/callout-thumbnails");
  const inventoryDir = helpers.option(argv, "inventory", "output/inventory-thumbnails");
  if (features.calloutDir !== calloutDir || features.inventoryDir !== inventoryDir) {
    throw new Error(
      `Card source roots ${JSON.stringify(calloutDir)}/${JSON.stringify(inventoryDir)} do not match feature provenance ${JSON.stringify(features.calloutDir)}/${JSON.stringify(features.inventoryDir)}. Pass the exact original roots or regenerate features; artifact text cannot redirect source reads.`,
    );
  }
  const cardDir = join(out, "cards");
  mkdirSync(cardDir, { recursive: true });
  const expectedCardIds = match.clusters.map(
    ({ clusterIndex }) => `card-${String(clusterIndex).padStart(4, "0")}`,
  );
  const unexpected = unexpectedCardPngs(
    boundedDirectoryFiles(cardDir, { label: "Part-identification card directory" }),
    [],
  );
  if (unexpected.length > 0) {
    throw new Error(
      `Card directory contains ${unexpected.length} stale top-level canonical PNGs outside immutable run storage for the current ${expectedCardIds.length}-cluster match: ${unexpected.join(", ")}. Preserve or remove those exact files before republishing; a successful card closure cannot silently retain an older generation.`,
    );
  }
  const cards = {};
  const cardPngs = new Map();
  const decodeBudget = createPngDecodeBudget("Part-identification card rendering");
  const calloutsByFile = new Map(
    features.callouts
      .filter(({ evidenceKind }) => evidenceKind === "part-art")
      .map((callout) => [callout.file, callout]),
  );
  const calloutTiles = new Map();
  const inventoryTiles = new Map();
  const boundCalloutTile = (file) => {
    if (!calloutTiles.has(file)) {
      const callout = calloutsByFile.get(file);
      if (callout === undefined) {
        throw new Error(
          `Card query ${JSON.stringify(file)} is not one physical callout in the exact features closure. Regenerate match from these features.`,
        );
      }
      calloutTiles.set(
        file,
        readBoundManifestCrop(callout, calloutDir, (bytes) =>
          cropToContent(bytes, 6, decodeBudget),
        ).then((bytes) => {
          if (bytes === null) {
            throw new Error(
              `Card query ${JSON.stringify(file)} has no bounded content after authenticating its feature digest. Regenerate the exact callout publication instead of substituting an image.`,
            );
          }
          return { bytes, label: `Card query ${file}` };
        }),
      );
    }
    return calloutTiles.get(file);
  };
  const boundInventoryTile = (elementId) => {
    if (!/^\d{3,12}$/u.test(elementId)) {
      throw new Error(
        `Card candidate element id ${JSON.stringify(elementId)} is not a canonical decimal id.`,
      );
    }
    if (!inventoryTiles.has(elementId)) {
      inventoryTiles.set(
        elementId,
        readBoundInventoryThumbnail(
          elementId,
          features.inventorySourceDigests[elementId],
          inventoryDir,
          (bytes) => cropToContent(bytes, 6, decodeBudget),
        ).then((bytes) => {
          if (bytes === null) {
            throw new Error(
              `Card candidate ${JSON.stringify(elementId)} has no bounded content after authenticating its feature digest. Regenerate the exact inventory gallery instead of substituting an image.`,
            );
          }
          return { bytes, label: `Card candidate ${elementId}` };
        }),
      );
    }
    return inventoryTiles.get(elementId);
  };
  for (const cluster of match.clusters) {
    const displayed = cluster.candidates.slice(0, k);
    const query = await boundCalloutTile(cluster.lead);
    const candidateImages = await Promise.all(
      displayed.map(({ elementId }) => boundInventoryTile(elementId)),
    );
    const png = await drawCard(query, candidateImages, decodeBudget);
    const id = `card-${String(cluster.clusterIndex).padStart(4, "0")}`;
    cardPngs.set(id, png);
    cards[id] = {
      sha256: sha256Digest(png),
      candidateElementIds: displayed.map(({ elementId }) => elementId),
    };
  }
  const runId = deriveCardRunId(artifacts.features.digest, artifacts.match.digest, cards);
  const publishedCards = Object.fromEntries(
    Object.entries(cards).map(([cardId, entry]) => [
      cardId,
      { ...entry, file: `runs/${runId}/${cardId}.png` },
    ]),
  );
  const manifest = {
    schemaVersion: PART_CARDS_SCHEMA,
    featuresDigest: artifacts.features.digest,
    matchDigest: artifacts.match.digest,
    runId,
    imagesFile: `runs/${runId}/images.bin`,
    cards: publishedCards,
  };
  const bundle = encodeCardImageBundle(manifest, cardPngs);
  const finalRunPath = `runs/${runId}`;
  const finalRunDirectory = join(cardDir, ...finalRunPath.split("/"));
  const retainedBefore = retainedCardRunBytes(cardDir);
  const candidateBytes =
    bundle.length + [...cardPngs.values()].reduce((total, bytes) => total + bytes.length, 0);
  if (existsSync(finalRunDirectory)) {
    assertExactRunDirectory(cardDir, manifest, finalRunPath);
  } else {
    if (retainedBefore + candidateBytes > MAX_RETAINED_CARD_RUN_BYTES) {
      throw new Error(
        `Retaining card run ${runId} needs ${retainedBefore + candidateBytes} bytes, above the ${MAX_RETAINED_CARD_RUN_BYTES}-byte aggregate limit. Preserve and remove obsolete exact runs before publishing another closure.`,
      );
    }
    const stagingRunPath = `runs/.staging-${runId}-${randomBytes(12).toString("hex")}`;
    const stagingManifest = manifestAtRun(manifest, stagingRunPath);
    let publicationFailure = null;
    try {
      for (const [cardId, bytes] of cardPngs) {
        publishContained(cardDir, stagingManifest.cards[cardId].file, bytes, {
          label: `Staged immutable vision card ${cardId}`,
          pathLabel: "Staged immutable vision card path",
          maxBytes: MAX_IMAGE_ARTIFACT_BYTES,
        });
      }
      publishContained(cardDir, stagingManifest.imagesFile, bundle, {
        label: "Staged part-identification card-image replay bundle",
        pathLabel: "Staged part-identification card-image replay bundle path",
        maxBytes: MAX_CARD_IMAGE_BUNDLE_BYTES,
      });
      assertExactRunDirectory(cardDir, stagingManifest, stagingRunPath);
      if (retainedCardRunBytes(cardDir, stagingRunPath) !== retainedBefore) {
        throw new Error(
          "Retained immutable card-run storage changed while a new run was staged. Retry after the concurrent publisher finishes; no existing run will be replaced.",
        );
      }
      const publishDirectory = helpers.publishRunDirectory ?? publishRunDirectory;
      publishDirectory(cardDir, stagingRunPath, finalRunPath);
      assertExactRunDirectory(cardDir, manifest, finalRunPath);
    } catch (error) {
      publicationFailure = error instanceof Error ? error : new Error(String(error));
    } finally {
      if (existsSync(join(cardDir, ...stagingRunPath.split("/")))) {
        try {
          cleanupStagedCardRun(cardDir, stagingRunPath);
        } catch (cleanupError) {
          const heldCleanupError =
            cleanupError instanceof Error ? cleanupError : new Error(String(cleanupError));
          publicationFailure =
            publicationFailure === null
              ? heldCleanupError
              : new AggregateError(
                  [publicationFailure, heldCleanupError],
                  `Card-run publication failed and exact stage cleanup also failed. Primary: ${publicationFailure.message} Cleanup: ${heldCleanupError.message}`,
                );
        }
      }
    }
    if (publicationFailure !== null) throw publicationFailure;
  }
  helpers.writeJson(join(cardDir, "manifest.json"), manifest);
  console.log(
    `drew and replay-bound ${match.clusters.length} cards into immutable run ${runId} under ${cardDir}`,
  );
}
