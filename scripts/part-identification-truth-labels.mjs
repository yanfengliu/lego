import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

/**
 * Rebuilds scripts/fixtures/part-identification-truth-first50-labels.json, which
 * binds each verdict of the first-fifty truth to the count label whose crop was
 * judged.
 *
 *   node scripts/part-identification-truth-labels.mjs
 *   LEGO_JUDGED_CROPS_DIR=path/to/run node scripts/part-identification-truth-labels.mjs
 *
 * The judged crops are the files of the ignored run
 * output/callout-thumbnails/runs/1e37c50ffee4df7741ac6722, found by climbing from
 * this checkout (a worktree has no output/ of its own). Each is named
 * p<page>-q<count>-x<x>-y<y>.png, "d" standing for the decimal point, after the
 * pdf.js position of its count label. A verdict binds to every crop whose SHA-256
 * equals its judgedCropSha256. Only `labels` is derived: the notes and the errata
 * are authored conclusions, so they are carried over from the tracked fixture.
 *
 * Writes the ignored output/booklet/part-identification-truth-first50-labels.json
 * and says whether it equals the tracked fixture; copy it over only after reading
 * the difference. It reads crops and writes no pixel. Without the run it prints
 * "skipped (input absent)".
 */
const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const RUN = "output/callout-thumbnails/runs/1e37c50ffee4df7741ac6722";
const TRUTH = resolve(repositoryRoot, "scripts/fixtures/part-identification-truth-first50.json");
const TRACKED = resolve(
  repositoryRoot,
  "scripts/fixtures/part-identification-truth-first50-labels.json",
);
const OUTPUT = resolve(
  repositoryRoot,
  "output/booklet/part-identification-truth-first50-labels.json",
);
const CROP_NAME = /^p(\d+)-q(\d+)-x(\d+d\d+)-y(\d+d\d+)\.png$/;

/** The count label a crop file is named after, or null when the name is not a crop's. */
export function cropPosition(name) {
  const m = CROP_NAME.exec(name);
  if (!m) return null;
  return {
    page: Number(m[1]),
    quantity: Number(m[2]),
    xPt: Number(m[3].replace("d", ".")),
    yPt: Number(m[4].replace("d", ".")),
  };
}

/**
 * One row per crop carrying a verdict's digest, in verdict order. Every verdict,
 * judged or unjudgeable, must find at least one crop.
 */
export function bindVerdicts(truth, crops) {
  const byDigest = new Map();
  for (const { name, sha256 } of crops) {
    const position = cropPosition(name);
    if (position === null) continue;
    const found = byDigest.get(sha256);
    if (found) found.push(position);
    else byDigest.set(sha256, [position]);
  }
  const verdicts = [...truth.verdicts, ...truth.unjudgeable];
  const missing = verdicts.filter((v) => !byDigest.has(v.judgedCropSha256)).map((v) => v.n);
  if (missing.length > 0) {
    throw new Error(
      `No crop carries the digest judged for verdict ${missing.join(", ")} (${missing.length} of ${verdicts.length}); point LEGO_JUDGED_CROPS_DIR at the run whose crops were judged, ${RUN}.`,
    );
  }
  return verdicts
    .flatMap((v) =>
      byDigest.get(v.judgedCropSha256).map((position) => ({
        n: v.n,
        judgedCropSha256: v.judgedCropSha256,
        ...position,
      })),
    )
    .sort((a, b) => a.n - b.n || a.page - b.page || a.xPt - b.xPt);
}

/** The fixture: the tracked file's authored fields, around freshly bound labels. */
export function labelsFixture(tracked, labels) {
  const { schemaVersion, truth, note, errataNote, errata } = tracked;
  return `${JSON.stringify({ schemaVersion, truth, note, errataNote, errata, labels }, null, 2)}\n`;
}

function findUp(relative) {
  let directory = repositoryRoot;
  for (let depth = 0; depth < 12; depth += 1) {
    const candidate = resolve(directory, relative);
    if (existsSync(candidate)) return candidate;
    const parent = dirname(directory);
    if (parent === directory) return null;
    directory = parent;
  }
  return null;
}

function main() {
  const directory = process.env.LEGO_JUDGED_CROPS_DIR || findUp(RUN);
  if (!directory || !existsSync(directory)) {
    console.log(
      `part-identification-truth-labels: skipped (input absent): ${directory ? `no directory at ${directory}` : `${RUN} not found above this checkout`}; set LEGO_JUDGED_CROPS_DIR to the judged crop run.`,
    );
    return;
  }
  const crops = readdirSync(directory)
    .filter((name) => name.endsWith(".png"))
    .map((name) => ({
      name,
      sha256: `sha256:${createHash("sha256")
        .update(readFileSync(resolve(directory, name)))
        .digest("hex")}`,
    }));
  const truth = JSON.parse(readFileSync(TRUTH, "utf8"));
  const trackedText = readFileSync(TRACKED, "utf8");
  const labels = bindVerdicts(truth, crops);
  const text = labelsFixture(JSON.parse(trackedText), labels);
  mkdirSync(dirname(OUTPUT), { recursive: true });
  writeFileSync(OUTPUT, text);
  const verdicts = new Set(labels.map((row) => row.n)).size;
  console.log(
    `bound ${verdicts} verdicts to ${labels.length} count labels by the digests of ${crops.length} crops in ${directory}`,
  );
  console.log(
    text === trackedText.replace(/\r\n/g, "\n")
      ? `identical to the tracked ${TRACKED}`
      : `DIFFERS from the tracked ${TRACKED}; read the difference before copying ${OUTPUT} over it`,
  );
  console.log(`wrote ${OUTPUT}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
