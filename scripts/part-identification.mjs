import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { pathToFileURL } from "node:url";

import { commandAsk } from "./part-identification-ask.mjs";
import { commandPairsheet, commandSheets } from "./part-identification-sheets.mjs";
import { commandScore, commandSummary } from "./part-identification-score.mjs";
import {
  canvasApi,
  contactSheet,
  cropToContent,
  describe,
  readThumbnail,
  thumbnailDistance,
} from "./part-thumbnail-image.mjs";
import {
  PART_DISTANCES_SCHEMA,
  PART_FEATURES_SCHEMA,
  PART_MATCH_SCHEMA,
  assertV4CalloutManifest,
  PART_CARDS_SCHEMA,
  assertFeaturesArtifact,
  nonClusteredCalloutRecords,
  readBoundManifestCrop,
  readJsonArtifact,
  sha256Digest,
} from "./part-identification-artifacts.mjs";

/**
 * What part does a step add?
 *
 * A step prints a small picture of each part it adds. The back of the book
 * prints the same drawing of every part in the set beside the element id that
 * names it, and that gallery is labelled without anything having looked at a
 * picture — the ids come out of the text layer. So naming a callout is matching
 * one drawing to a labelled gallery of the same drawings.
 *
 * The grader is the printed inventory itself: every callout in the book, summed
 * per element, must come to the quantities printed at the back. That scores all
 * 359 steps at once with nothing hand-labelled, and it is falsifiable — claiming
 * a part 104 times when the set holds 21 is provably wrong.
 *
 * Geometry proposes a shortlist, a vision call picks from it, and the inventory
 * disposes: a pick must name a listed element, must agree with the free
 * description the same call gave, and is capped by what the set actually holds.
 */

const OUT = "output/part-identification";
const CROP_LIMIT = 4000;

function usage() {
  return [
    "usage: node scripts/part-identification.mjs <command> [options]",
    "",
    "  features   --callouts DIR --inventory DIR    read both galleries into descriptors",
    "  match      [--k 6]                            rank inventory candidates per callout",
    "  tiles                                         re-cut both galleries to their ink",
    "  labelsheet [--last-step 50]                   numbered sheets to read ground truth off",
    "  cards      [--k 8]                            draw one adjudication card per cluster",
    "  ask        [--model sonnet] [--jobs 6] [--batch 6] [--last-step N]  the vision calls",
    "  pairsheet  [--source ...] [--assign ...]      callout beside claimed element, to judge",
    "  score      [--source deterministic|adjudicated] [--assign ...]  conservation and accuracy",
    "  summary    [--models haiku,sonnet]            every configuration side by side into score.json",
    "  sheets                                        contact sheets of hits and misses",
    "",
    `every command reads and writes ${OUT}/`,
  ].join("\n");
}

function option(argv, name, fallback) {
  const at = argv.indexOf(`--${name}`);
  return at === -1 || at === argv.length - 1 ? fallback : argv[at + 1];
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 1)}\n`);
}

/** The printed inventory: 276 element ids and the pieces the set holds of each. */
function inventoryHeld() {
  const labels = readJson("output/inventory-thumbnails/labels.json");
  return new Map(labels.entries.map(({ elementId, quantity }) => [elementId, quantity]));
}

/** Element id to published part number and name, checked against the printed quantities. */
function elementNames() {
  const path = join(OUT, "element-resolution.json");
  if (!existsSync(path)) return new Map();
  const resolved = readJson(path);
  return new Map(Object.entries(resolved).map(([id, entry]) => [id, entry]));
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
  const manifest = assertV4CalloutManifest(manifestArtifact.value, context.manifestExpectation);

  const inventory = {};
  const inventoryFiles = readdirSync(inventoryDir).filter((file) => file.endsWith(".png"));
  for (const file of inventoryFiles) {
    const thumbnail = await readThumbnail(join(inventoryDir, file));
    if (!thumbnail) continue;
    inventory[basename(file, ".png")] = describe(thumbnail);
  }

  const callouts = [];
  for (const entry of manifest.callouts.slice(0, CROP_LIMIT)) {
    const path = join(calloutDir, entry.file);
    if (entry.evidenceKind !== "part-art") {
      // Semantic action/multiplier records stay index-aligned with the v4
      // manifest for coverage provenance, but never receive a descriptor that
      // could make them look assignable to a physical inventory element.
      callouts.push({ ...entry });
      continue;
    }
    const thumbnail = await readBoundManifestCrop(entry, path, readThumbnail);
    if (!thumbnail) {
      throw new Error(
        `Callout crop ${JSON.stringify(entry.identity)} at ${JSON.stringify(entry.file)} contains no decodable part drawing. Regenerate or repair this exact crop before extracting features.`,
      );
    }
    callouts.push({ ...entry, descriptor: describe(thumbnail) });
  }

  const held = inventoryHeld();
  const withoutThumbnail = [...held.keys()].filter((id) => !(id in inventory));
  const nonClusteredCallouts = nonClusteredCalloutRecords(callouts);
  const physicalCallouts = callouts.filter(({ evidenceKind }) => evidenceKind === "part-art");
  writeJson(join(OUT, "features.json"), {
    schemaVersion: PART_FEATURES_SCHEMA,
    inputDigests: {
      pdf: manifest.sourceHash,
      calloutManifest: manifestArtifact.digest,
    },
    note: "Descriptors only. Nothing here names a part.",
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
 * Callouts that are the same drawing.
 *
 * The book redraws a part identically every time it calls it out, so a tight
 * threshold groups the repeats without merging different parts. It is only an
 * economy: one vision call answers for the whole cluster, and the conservation
 * check still sees every callout separately.
 */
function clusterCallouts(callouts, threshold = 0.055) {
  const order = [...callouts.keys()]
    .filter((index) => callouts[index].evidenceKind === "part-art")
    .sort((left, right) => callouts[right].descriptor.pixels - callouts[left].descriptor.pixels);
  const clusters = [];
  for (const index of order) {
    const descriptor = callouts[index].descriptor;
    let joined = false;
    for (const cluster of clusters) {
      const distance = thumbnailDistance(descriptor, callouts[cluster.lead].descriptor);
      if (distance.total < threshold) {
        cluster.members.push(index);
        joined = true;
        break;
      }
    }
    if (!joined) clusters.push({ lead: index, members: [index] });
  }
  return clusters;
}

async function commandMatch(argv) {
  const k = Number(option(argv, "k", "6"));
  const featuresArtifact = readJsonArtifact(
    join(OUT, "features.json"),
    "part-identification features",
  );
  const features = assertFeaturesArtifact(featuresArtifact);
  const inventory = Object.entries(features.inventory);
  const clusters = clusterCallouts(features.callouts);

  const elementIds = inventory.map(([elementId]) => elementId);
  const rows = [];
  const ranked = clusters.map((cluster, clusterIndex) => {
    const descriptor = features.callouts[cluster.lead].descriptor;
    const scored = inventory.map(([elementId, candidate]) => ({
      elementId,
      ...thumbnailDistance(descriptor, candidate),
    }));
    rows.push(scored.map(({ total }) => total));
    const ordered = [...scored].sort((left, right) => left.total - right.total);
    return {
      clusterIndex,
      lead: features.callouts[cluster.lead].file,
      members: cluster.members,
      pieces: cluster.members.reduce(
        (total, index) => total + features.callouts[index].quantity,
        0,
      ),
      candidates: ordered.slice(0, k),
      margin: (ordered[1]?.total ?? 1) - ordered[0].total,
    };
  });

  writeJson(join(OUT, "match.json"), {
    schemaVersion: PART_MATCH_SCHEMA,
    featuresDigest: featuresArtifact.digest,
    note: "Geometry only: a shortlist per cluster of identical callout drawings.",
    clusterCount: ranked.length,
    calloutCount: features.calloutCount,
    clusters: ranked,
  });
  writeJson(join(OUT, "distances.json"), {
    schemaVersion: PART_DISTANCES_SCHEMA,
    featuresDigest: featuresArtifact.digest,
    note: "Every drawing against every element, in elementIds order, for the global assignment.",
    elementIds,
    rows,
  });
  console.log(
    `${features.calloutCount} physical callouts fell into ${ranked.length} distinct drawings; ` +
      `median top-1 margin ${median(ranked.map(({ margin }) => margin)).toFixed(3)}`,
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
async function drawCard(lead, candidates, calloutDir, inventoryDir) {
  const { createCanvas, loadImage } = await canvasApi();
  const cell = 320;
  const queryHeight = 340;
  const width = Math.max(cell * candidates.length, 900);
  const canvas = createCanvas(width, queryHeight + cell + 96);
  const context = canvas.getContext("2d");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#000000";
  context.font = "bold 22px sans-serif";
  context.fillText("QUERY", 12, 26);
  context.fillText("CANDIDATES", 12, queryHeight + 64);

  const place = async (path, left, top, boxWidth, boxHeight) => {
    if (!existsSync(path)) return;
    const image = await loadImage(path);
    const scale = Math.min(boxWidth / image.width, boxHeight / image.height);
    context.drawImage(
      image,
      left + (boxWidth - image.width * scale) / 2,
      top + (boxHeight - image.height * scale) / 2,
      image.width * scale,
      image.height * scale,
    );
  };

  await place(join(calloutDir, lead), 0, 34, width, queryHeight - 44);
  for (const [index, candidate] of candidates.entries()) {
    const left = index * cell;
    const top = queryHeight + 72;
    context.strokeStyle = "#888888";
    context.strokeRect(left + 2, top, cell - 4, cell - 4);
    await place(
      join(inventoryDir, `${candidate.elementId}.png`),
      left + 6,
      top + 28,
      cell - 12,
      cell - 36,
    );
    context.fillStyle = "#000000";
    context.font = "bold 24px sans-serif";
    context.fillText(`${index + 1}`, left + 12, top + 24);
  }
  return canvas.encode("png");
}

/** Both galleries re-cut to their ink, so cards and sheets show the part, not the cell. */
async function commandTiles() {
  const features = readJson(join(OUT, "features.json"));
  const calloutTiles = join(OUT, "tiles", "callout");
  const inventoryTiles = join(OUT, "tiles", "inventory");
  mkdirSync(calloutTiles, { recursive: true });
  mkdirSync(inventoryTiles, { recursive: true });

  let written = 0;
  for (const elementId of Object.keys(features.inventory)) {
    const png = await cropToContent(join(features.inventoryDir, `${elementId}.png`));
    if (!png) continue;
    writeFileSync(join(inventoryTiles, `${elementId}.png`), png);
    written += 1;
  }
  for (const callout of features.callouts) {
    const png = await cropToContent(join(features.calloutDir, callout.file));
    if (!png) continue;
    writeFileSync(join(calloutTiles, callout.file), png);
    written += 1;
  }
  console.log(`cut ${written} tiles into ${join(OUT, "tiles")}`);
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
  const features = readJson(join(OUT, "features.json"));
  const match = readJson(join(OUT, "match.json"));
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
  const entries = [];
  for (let page = 0; page * perSheet < wanted.length; page += 1) {
    const slice = wanted.slice(page * perSheet, page * perSheet + perSheet);
    const png = await contactSheet(
      slice.map((drawing, at) => ({
        path: join(OUT, "tiles", "callout", drawing.lead),
        lines: [
          `#${page * perSheet + at + 1}`,
          `first step ${drawing.firstStep} · ${drawing.calloutsInRange} callouts`,
        ],
      })),
      { columns: 3, cellWidth: 660, cellHeight: 500, title: `label sheet ${page + 1}` },
    );
    writeFileSync(join(dir, `labels-${page}.png`), png);
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

async function commandCards(argv) {
  const k = Number(option(argv, "k", "6"));
  const matchArtifact = readJsonArtifact(join(OUT, "match.json"), "part-identification match");
  const match = matchArtifact.value;
  if (match.schemaVersion !== PART_MATCH_SCHEMA) {
    throw new Error(`Cards require ${PART_MATCH_SCHEMA}; regenerate features and match first.`);
  }
  const cardDir = join(OUT, "cards");
  mkdirSync(cardDir, { recursive: true });

  const cards = {};
  for (const cluster of match.clusters) {
    const png = await drawCard(
      cluster.lead,
      cluster.candidates.slice(0, k),
      join(OUT, "tiles", "callout"),
      join(OUT, "tiles", "inventory"),
    );
    const id = `card-${String(cluster.clusterIndex).padStart(4, "0")}`;
    writeFileSync(join(cardDir, `${id}.png`), png);
    cards[id] = sha256Digest(png);
  }
  writeJson(join(cardDir, "manifest.json"), {
    schemaVersion: PART_CARDS_SCHEMA,
    matchDigest: matchArtifact.digest,
    cards,
  });
  console.log(`drew ${match.clusters.length} cards into ${cardDir}`);
}

export { clusterCallouts, commandFeatures, median, option };

const helpers = { option, inventoryHeld, elementNames };

const COMMANDS = {
  features: commandFeatures,
  match: commandMatch,
  tiles: commandTiles,
  labelsheet: commandLabelsheet,
  cards: commandCards,
  ask: commandAsk,
  pairsheet: (argv) => commandPairsheet(argv, helpers),
  score: (argv) => commandScore(argv, helpers),
  summary: (argv) => commandSummary(argv, helpers),
  sheets: (argv) => commandSheets(argv, helpers),
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [, , command, ...rest] = process.argv;
  const run = COMMANDS[command];
  if (!run) {
    console.error(command ? `Unknown command "${command}".\n\n${usage()}` : usage());
    process.exit(1);
  }
  await run(rest);
}
