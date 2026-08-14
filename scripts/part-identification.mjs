import { existsSync, mkdirSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { pathToFileURL } from "node:url";

import { commandAsk } from "./part-identification-ask.mjs";
import { commandCards } from "./part-identification-cards.mjs";
import { commandPairsheet, commandSheets } from "./part-identification-sheets.mjs";
import { commandScore, commandSummary } from "./part-identification-score.mjs";
import { commandObservations, commandReask } from "./part-identification-observations-run.mjs";
import {
  contactSheet,
  createPngDecodeBudget,
  cropToContent,
  describe,
  readThumbnail,
} from "./part-thumbnail-image.mjs";
import {
  derivePartIdentificationMatch,
  partIdentificationDistancesValue,
  partIdentificationMatchValue,
} from "./part-identification-derivation.mjs";
import {
  MAX_IMAGE_ARTIFACT_BYTES,
  MAX_JSON_ARTIFACT_BYTES,
  boundedDirectoryFiles,
  readContainedFile,
  writeContainedFile,
} from "./part-identification-io.mjs";
import {
  PART_FEATURES_SCHEMA,
  assertV6CalloutManifest,
  assertBoundMatchArtifacts,
  assertFeaturesArtifact,
  nonClusteredCalloutRecords,
  readBoundManifestCrop,
  readBoundInventoryThumbnail,
  readJsonArtifact,
  sha256Digest,
} from "./part-identification-artifacts.mjs";
import { PART_IDENTIFICATION_MODEL_ID } from "./part-identification-model.mjs";
import { DEFAULT_MAX_REASKS } from "./part-identification-reask.mjs";

/** Match each step callout to the labelled inventory: geometry proposes, vision may pick, and inventory conservation disposes. */

const OUT = "output/part-identification";
const CROP_LIMIT = 4000;

export function usage() {
  return [
    "usage: node scripts/part-identification.mjs <command> [options]",
    "",
    "  features   --callouts DIR --inventory DIR    read both galleries into descriptors",
    "  match      [--k 6]                            rank inventory candidates per callout",
    "  tiles      [--callouts DIR --inventory DIR]   re-cut both galleries to their ink",
    "  labelsheet [--last-step 50]                   numbered sheets to read ground truth off",
    "  cards      [--k 6] [--callouts DIR --inventory DIR]  draw source-bound cards plus exact replay bundle",
    `  ask        [--model ${PART_IDENTIFICATION_MODEL_ID}] [--jobs 6] [--batch 6] [--last-step N]  the vision calls`,
    "  pairsheet  [--source ...] [--assign ...]      callout beside claimed element, to judge",
    "  score      [--source deterministic|adjudicated] [--assign ...]  conservation and accuracy",
    "  observations [--model M]                      what the call wrote, grouped and read",
    `  reask      [--model M] [--max ${DEFAULT_MAX_REASKS}]              one narrowed question where two candidates stood`,
    `  summary    [--models ${PART_IDENTIFICATION_MODEL_ID}]  every configuration side by side into score.json`,
    "  sheets                                        contact sheets of hits and misses",
    "  --help                                        print this help and exit successfully",
    "",
    `every command reads and writes ${OUT}/`,
  ].join("\n");
}

function option(argv, name, fallback) {
  const flag = `--${name}`;
  const positions = argv.flatMap((value, index) => (value === flag ? [index] : []));
  if (positions.length === 0) return fallback;
  if (positions.length > 1) {
    throw new Error(`${flag} may be provided only once; received ${positions.length} occurrences.`);
  }
  const at = positions[0];
  if (at === argv.length - 1 || argv[at + 1].startsWith("--")) {
    throw new Error(`${flag} requires a value; received no value.`);
  }
  return argv[at + 1];
}

function writeJson(path, value) {
  writeContainedFile(dirname(path), basename(path), `${JSON.stringify(value, null, 1)}\n`, {
    label: "Part-identification JSON artifact",
    pathLabel: "Part-identification JSON path",
    maxBytes: MAX_JSON_ARTIFACT_BYTES,
  });
}

/**
 * The printed inventory: 276 element ids and the pieces the set holds of each.
 *
 * The digest travels with the value because it comes from the same single read;
 * anything that reopens the path to hash it is reporting a different file.
 */
function inventoryHeld() {
  const artifact = readJsonArtifact(
    "output/inventory-thumbnails/labels.json",
    "part-identification inventory labels",
  );
  return {
    held: new Map(artifact.value.entries.map(({ elementId, quantity }) => [elementId, quantity])),
    digest: artifact.digest,
  };
}

/** Element id to published part number and name, checked against the printed quantities. */
function elementNames() {
  const path = join(OUT, "element-resolution.json");
  if (!existsSync(path)) return { names: new Map(), digest: null };
  const artifact = readJsonArtifact(path, "part-identification element resolution");
  return {
    names: new Map(Object.entries(artifact.value).map(([id, entry]) => [id, entry])),
    digest: artifact.digest,
  };
}

async function commandFeatures(argv, context = {}) {
  const calloutDir = option(argv, "callouts", "output/callout-thumbnails");
  const inventoryDir = option(argv, "inventory", "output/inventory-thumbnails");
  mkdirSync(OUT, { recursive: true });

  const manifestPath = join(calloutDir, "manifest.json");
  if (!existsSync(manifestPath)) {
    throw new Error(
      `No full callout manifest at ${manifestPath}. A page-limited run writes manifest.partial.json instead; ` +
        `produce the full one with CALLOUT_PAGE_LIMIT=0 npx playwright test callout-thumbnails.`,
    );
  }
  const manifestArtifact = readJsonArtifact(manifestPath, "callout manifest");
  const manifest = assertV6CalloutManifest(manifestArtifact.value, context.manifestExpectation);

  const inventory = {};
  const inventorySourceDigests = {};
  const decodeBudget = createPngDecodeBudget("Part-identification feature extraction");
  const inventoryFiles = boundedDirectoryFiles(inventoryDir, {
    label: "Inventory thumbnail directory",
  }).filter((file) => file.endsWith(".png"));
  for (const file of inventoryFiles) {
    if (!/^\d{3,12}\.png$/u.test(file)) {
      throw new Error(
        `Inventory thumbnail ${JSON.stringify(file)} is not a canonical decimal element-id PNG. Regenerate the inventory gallery before extracting features.`,
      );
    }
    const bytes = readContainedFile(inventoryDir, file, {
      label: `Inventory thumbnail ${file}`,
      pathLabel: "Inventory thumbnail file",
      maxBytes: MAX_IMAGE_ARTIFACT_BYTES,
    });
    const thumbnail = await readThumbnail(bytes, decodeBudget);
    if (!thumbnail) continue;
    const elementId = basename(file, ".png");
    inventory[elementId] = describe(thumbnail);
    inventorySourceDigests[elementId] = sha256Digest(bytes);
  }

  const callouts = [];
  for (const entry of manifest.callouts.slice(0, CROP_LIMIT)) {
    const thumbnail = await readBoundManifestCrop(entry, calloutDir, (bytes) =>
      entry.evidenceKind === "part-art" ? readThumbnail(bytes, decodeBudget) : null,
    );
    if (entry.evidenceKind !== "part-art") {
      // Semantic action/multiplier records stay index-aligned with the v6
      // manifest for coverage provenance. Their exact retained PNG bytes and
      // dimensions are still authenticated, but they never receive a descriptor
      // that could make them look assignable to a physical inventory element.
      callouts.push({ ...entry });
      continue;
    }
    if (!thumbnail) {
      throw new Error(
        `Callout crop ${JSON.stringify(entry.identity)} at ${JSON.stringify(entry.file)} contains no decodable part drawing. Regenerate or repair this exact crop before extracting features.`,
      );
    }
    callouts.push({ ...entry, descriptor: describe(thumbnail) });
  }

  const { held } = inventoryHeld();
  const withoutThumbnail = [...held.keys()].filter((id) => !(id in inventory));
  const nonClusteredCallouts = nonClusteredCalloutRecords(callouts);
  const physicalCallouts = callouts.filter(({ evidenceKind }) => evidenceKind === "part-art");
  writeJson(join(OUT, "features.json"), {
    schemaVersion: PART_FEATURES_SCHEMA,
    inputDigests: {
      pdf: manifest.sourceHash,
      calloutManifest: manifestArtifact.digest,
    },
    note: "Descriptors plus exact source-image digests. Nothing here names a part.",
    calloutDir,
    inventoryDir,
    manifestCalloutCount: callouts.length,
    calloutCount: physicalCallouts.length,
    nonClusteredCalloutCount: nonClusteredCallouts.length,
    nonClusteredCallouts,
    piecesCalledOut: physicalCallouts.reduce((total, { quantity }) => total + quantity, 0),
    inventoryCount: Object.keys(inventory).length,
    inventoryHeldCount: held.size,
    elementsWithoutThumbnail: withoutThumbnail,
    piecesWithoutThumbnail: withoutThumbnail.reduce((total, id) => total + held.get(id), 0),
    inventory,
    inventorySourceDigests,
    callouts,
  });
  console.log(
    `${physicalCallouts.length} physical callouts (${physicalCallouts.reduce((total, { quantity }) => total + quantity, 0)} pieces) ` +
      `and ${nonClusteredCallouts.length} explicitly non-clustered semantic records ` +
      `against ${Object.keys(inventory).length} of ${held.size} inventory thumbnails; ` +
      `${withoutThumbnail.length} elements have no thumbnail to match against`,
  );
}

/**
 * Callouts close enough to share one later identification question.
 *
 * It is only an economy: the fixed distance threshold and each member's
 * independently computed inventory top must both agree before one vision call
 * may answer for a cluster. The conservation check still sees every callout.
 */
async function commandMatch(argv) {
  const k = Number(option(argv, "k", "6"));
  if (!Number.isInteger(k) || k < 1 || k > 32) {
    throw new Error(`--k must be an integer from 1 through 32; received ${JSON.stringify(k)}.`);
  }
  const featuresArtifact = readJsonArtifact(
    join(OUT, "features.json"),
    "part-identification features",
  );
  const features = assertFeaturesArtifact(featuresArtifact);
  const derived = derivePartIdentificationMatch(features, k);
  const match = partIdentificationMatchValue(featuresArtifact.digest, derived);
  writeJson(join(OUT, "match.json"), match);
  const matchDigest = sha256Digest(Buffer.from(`${JSON.stringify(match, null, 1)}\n`));
  writeJson(
    join(OUT, "distances.json"),
    partIdentificationDistancesValue(featuresArtifact.digest, matchDigest, derived),
  );
  console.log(
    `${features.calloutCount} physical callouts fell into ${derived.clusters.length} legacy-bound refined drawings; ` +
      `median top-1 margin ${median(derived.clusters.map(({ margin }) => margin)).toFixed(3)}`,
  );
}

function median(values) {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
}

/**
 * The picture the vision call is asked about: the callout drawing, and the
 * shortlist it has to choose from, numbered.
 *
 * Every drawing is blown up to fill its own box rather than kept at the size
 * the booklet printed it. Printed size is a real cue in the inventory, where
 * everything is drawn to one scale, but the callout is not on that scale and
 * offering both invites the wrong comparison; stud counting is what decides
 * these, and it wants pixels.
 */
/** Both galleries re-cut to their ink, so cards and sheets show the part, not the cell. */
async function commandTiles(argv) {
  const featuresArtifact = readJsonArtifact(
    join(OUT, "features.json"),
    "part-identification features",
  );
  const features = assertFeaturesArtifact(featuresArtifact);
  const calloutDir = option(argv, "callouts", "output/callout-thumbnails");
  const inventoryDir = option(argv, "inventory", "output/inventory-thumbnails");
  if (features.calloutDir !== calloutDir || features.inventoryDir !== inventoryDir) {
    throw new Error(
      `Tile roots ${JSON.stringify(calloutDir)}/${JSON.stringify(inventoryDir)} do not match the feature provenance ${JSON.stringify(features.calloutDir)}/${JSON.stringify(features.inventoryDir)}. Pass the exact original roots or regenerate features; artifact text cannot redirect later reads.`,
    );
  }
  const calloutTiles = join(OUT, "tiles", "callout");
  const inventoryTiles = join(OUT, "tiles", "inventory");
  mkdirSync(calloutTiles, { recursive: true });
  mkdirSync(inventoryTiles, { recursive: true });

  let written = 0;
  const decodeBudget = createPngDecodeBudget("Part-identification tile extraction");
  for (const elementId of Object.keys(features.inventory)) {
    if (!/^\d{3,12}$/u.test(elementId)) {
      throw new Error(
        `Feature inventory key ${JSON.stringify(elementId)} is not a decimal element id.`,
      );
    }
    const relativePath = `${elementId}.png`;
    const png = await readBoundInventoryThumbnail(
      elementId,
      features.inventorySourceDigests[elementId],
      inventoryDir,
      (bytes) => cropToContent(bytes, 6, decodeBudget),
    );
    if (!png) continue;
    writeNestedArtifact(inventoryTiles, relativePath, png);
    written += 1;
  }
  for (const callout of features.callouts) {
    const png = await readBoundManifestCrop(callout, calloutDir, (bytes) =>
      cropToContent(bytes, 6, decodeBudget),
    );
    if (!png) continue;
    writeNestedArtifact(calloutTiles, callout.file, png);
    written += 1;
  }
  console.log(`cut ${written} tiles into ${join(OUT, "tiles")}`);
}

function writeNestedArtifact(root, relativePath, bytes) {
  writeContainedFile(root, relativePath, bytes, {
    label: "Part-identification tile",
    pathLabel: "Part-identification tile path",
    maxBytes: MAX_IMAGE_ARTIFACT_BYTES,
  });
}

/**
 * Sheets to read ground truth off, before anything has proposed an answer.
 *
 * Accuracy needs a label that did not come out of this pipeline, so the first
 * fifty steps' callouts are laid out numbered and unannotated — no candidate,
 * no element id, no name — and read as a kind and a stud size. Showing the
 * pipeline's guess here would turn labelling into agreement.
 */
async function commandLabelsheet(argv) {
  const lastStep = Number(option(argv, "last-step", "50"));
  if (!Number.isInteger(lastStep) || lastStep < 1 || lastStep > 359) {
    throw new Error(
      `--last-step must be an integer from 1 through 359; received ${JSON.stringify(lastStep)}.`,
    );
  }
  const featuresArtifact = readJsonArtifact(
    join(OUT, "features.json"),
    "part-identification features",
  );
  const matchArtifact = readJsonArtifact(join(OUT, "match.json"), "part-identification match");
  const distancesArtifact = readJsonArtifact(
    join(OUT, "distances.json"),
    "part-identification distances",
  );
  const { features, match } = assertBoundMatchArtifacts({
    featuresArtifact,
    matchArtifact,
    distancesArtifact,
  });
  const dir = join(OUT, "label-sheets");
  mkdirSync(dir, { recursive: true });

  // 186 callouts in the first fifty steps are 82 distinct drawings, so labelling
  // the drawings and letting the callouts inherit is the same job five times
  // smaller. The cost is that a drawing wrongly grouped is invisible to the
  // label, which is why the grouping is reported with its own worst distance.
  const clusterOf = new Map();
  for (const cluster of match.clusters) {
    for (const member of cluster.members) clusterOf.set(member, cluster);
  }
  const seen = new Map();
  for (const [index, callout] of features.callouts.entries()) {
    if (callout.stepNumber === null || callout.stepNumber > lastStep) continue;
    const cluster = clusterOf.get(index);
    if (!cluster) continue;
    const entry = seen.get(cluster.clusterIndex) ?? {
      clusterIndex: cluster.clusterIndex,
      lead: cluster.lead,
      firstStep: callout.stepNumber,
      calloutsInRange: 0,
      piecesInRange: 0,
    };
    entry.calloutsInRange += 1;
    entry.piecesInRange += callout.quantity;
    entry.firstStep = Math.min(entry.firstStep, callout.stepNumber);
    seen.set(cluster.clusterIndex, entry);
  }
  const wanted = [...seen.values()].sort(
    (left, right) => left.firstStep - right.firstStep || left.clusterIndex - right.clusterIndex,
  );

  const perSheet = 9;
  const decodeBudget = createPngDecodeBudget("Part-identification label sheets");
  const entries = [];
  for (let page = 0; page * perSheet < wanted.length; page += 1) {
    const slice = wanted.slice(page * perSheet, page * perSheet + perSheet);
    const png = await contactSheet(
      slice.map((drawing, at) => ({
        path: readContainedFile(join(OUT, "tiles", "callout"), drawing.lead, {
          label: `Label-sheet callout ${drawing.lead}`,
          pathLabel: "Label-sheet callout path",
          maxBytes: MAX_IMAGE_ARTIFACT_BYTES,
        }),
        lines: [
          `#${page * perSheet + at + 1}`,
          `first step ${drawing.firstStep} · ${drawing.calloutsInRange} callouts`,
        ],
      })),
      {
        columns: 3,
        cellWidth: 660,
        cellHeight: 500,
        title: `label sheet ${page + 1}`,
        decodeBudget,
      },
    );
    writeNestedArtifact(dir, `labels-${page}.png`, png);
    for (const [at, drawing] of slice.entries()) {
      entries.push({ n: page * perSheet + at + 1, ...drawing });
    }
  }
  writeJson(join(dir, "index.json"), {
    note: "One entry per distinct callout drawing in the first N steps; label these, not the callouts.",
    lastStep,
    drawings: wanted.length,
    callouts: wanted.reduce((total, { calloutsInRange }) => total + calloutsInRange, 0),
    entries,
  });
  console.log(
    `${wanted.length} distinct drawings covering ` +
      `${wanted.reduce((total, { calloutsInRange }) => total + calloutsInRange, 0)} callouts, ` +
      `over ${Math.ceil(wanted.length / perSheet)} sheets in ${dir}`,
  );
}

export { commandFeatures, commandMatch, median, option, writeNestedArtifact };

const helpers = { option, inventoryHeld, elementNames };

const COMMANDS = {
  features: commandFeatures,
  match: commandMatch,
  tiles: commandTiles,
  labelsheet: commandLabelsheet,
  cards: (argv) => commandCards(argv, { option, writeJson, writeNestedArtifact }),
  ask: commandAsk,
  pairsheet: (argv) => commandPairsheet(argv, helpers),
  score: (argv) => commandScore(argv, helpers),
  summary: (argv) => commandSummary(argv, helpers),
  observations: (argv) => commandObservations(argv, helpers),
  reask: (argv) => commandReask(argv, helpers),
  sheets: (argv) => commandSheets(argv, helpers),
};

export async function runPartIdentificationCli(argv = process.argv.slice(2), context = {}) {
  const [command, ...rest] = argv;
  const stdout = context.stdout ?? console.log;
  const stderr = context.stderr ?? console.error;
  if (command === "--help" || command === "-h" || command === "help") {
    stdout(usage());
    return 0;
  }
  const run = COMMANDS[command];
  if (!run) {
    const resolveNote =
      command === "resolve"
        ? "\n\nThere is no resolver command: element-resolution.json is a retained prerequisite and must be restored or reproduced from its pinned source."
        : "";
    stderr(command ? `Unknown command "${command}".${resolveNote}\n\n${usage()}` : usage());
    return 1;
  }
  await run(rest);
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await runPartIdentificationCli();
}
