import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { MAX_JSON_ARTIFACT_BYTES, writeContainedFile } from "./part-identification-io.mjs";
import { PART_IDENTIFICATION_MODEL_ID } from "./part-identification-model.mjs";
import { PART_TRUTH_PATH } from "./part-identification-truth-key.mjs";
import { readJsonArtifact } from "./part-identification-artifacts.mjs";
import { verifyRetainedCardImageClosure } from "./part-identification-card-images.mjs";

const CALLOUTS = "output/callout-thumbnails";
const IDENTIFICATION = "output/part-identification";
const OUT = "output/real-build";

function requireJsonArtifact(path, recovery, label) {
  if (!existsSync(path)) {
    throw new Error(`Missing ${path}. ${recovery}`);
  }
  return readJsonArtifact(path, label);
}

function option(argv, name, fallback) {
  const flag = `--${name}`;
  const positions = argv.flatMap((value, index) => (value === flag ? [index] : []));
  if (positions.length > 1) {
    throw new Error(`${flag} may be supplied once; received ${positions.length} occurrences.`);
  }
  if (positions.length === 0) return fallback;
  const at = positions[0];
  if (at === argv.length - 1 || argv[at + 1].startsWith("--")) {
    throw new Error(`${flag} requires a value.`);
  }
  return argv[at + 1];
}

export function bookletCatalogCoverageUsage() {
  return [
    "Usage: node scripts/booklet-catalog-coverage.mjs [options]",
    "",
    "Adjudicated example (requires current card PNGs, their retained images.bin bundle, match-bound manifest, and pinned-model answers):",
    `  node scripts/booklet-catalog-coverage.mjs --source adjudicated --model ${PART_IDENTIFICATION_MODEL_ID} --assign one-to-one --last-step 50`,
    "",
    "Deterministic example (geometry only; no cards or answers are read):",
    "  node scripts/booklet-catalog-coverage.mjs --source deterministic --assign one-to-one --last-step 50",
    "",
    "Required for both modes: output/callout-thumbnails/manifest.json plus raw-byte-bound features, match, distances, and output/part-identification/element-resolution.json.",
    "element-resolution.json is a retained prerequisite; part-identification has no resolve command.",
    `Also required for both modes: the tracked blind pair-judging verdicts at ${PART_TRUTH_PATH}, bound as the pairJudged closure role.`,
    "",
    "Options: --source deterministic|adjudicated  --model <pinned-id>  --assign nearest|one-to-one|quantity-informed  --last-step 1..50  --help",
  ].join("\n");
}

export async function runBookletCatalogCoverageCliWithCompiler(
  compileClosure,
  argv = process.argv.slice(2),
  context = {},
) {
  if (argv.includes("--help") || argv.includes("-h")) {
    (context.stdout ?? console.log)(bookletCatalogCoverageUsage());
    return 0;
  }
  const source = option(argv, "source", "adjudicated");
  const model = option(argv, "model", PART_IDENTIFICATION_MODEL_ID);
  const assignment = option(argv, "assign", "one-to-one");
  if (source !== "deterministic" && source !== "adjudicated") {
    throw new Error(
      `--source must be deterministic or adjudicated; received ${JSON.stringify(source)}.`,
    );
  }
  if (!["nearest", "one-to-one", "quantity-informed"].includes(assignment)) {
    throw new Error(
      `--assign must be nearest, one-to-one, or quantity-informed; received ${JSON.stringify(assignment)}.`,
    );
  }
  const lastStepValue = option(argv, "last-step", "50");
  const lastStep = Number(lastStepValue);
  if (!Number.isInteger(lastStep) || lastStep < 1 || lastStep > 50) {
    throw new Error(
      `--last-step must be an integer from 1 through 50; received ${JSON.stringify(lastStepValue)}.`,
    );
  }

  const manifestPath = join(CALLOUTS, "manifest.json");
  if (!existsSync(manifestPath)) {
    throw new Error(
      `Missing ${manifestPath}. Produce the full v6 manifest with: CALLOUT_PAGE_LIMIT=0 npx playwright test callout-thumbnails.`,
    );
  }
  const manifestArtifact = readJsonArtifact(manifestPath, "callout manifest");
  const manifestBytes = manifestArtifact.bytes;
  const featuresPath = join(IDENTIFICATION, "features.json");
  const matchPath = join(IDENTIFICATION, "match.json");
  const distancesPath = join(IDENTIFICATION, "distances.json");
  for (const [path, produce] of [
    [featuresPath, "node scripts/part-identification.mjs features"],
    [matchPath, "node scripts/part-identification.mjs match"],
    [distancesPath, "node scripts/part-identification.mjs match"],
  ]) {
    if (!existsSync(path)) throw new Error(`Missing ${path}. Produce it with: ${produce}`);
  }
  const featuresArtifact = readJsonArtifact(featuresPath, "part-identification features");
  const matchArtifact = readJsonArtifact(matchPath, "part-identification match");
  const distancesArtifact = readJsonArtifact(distancesPath, "part-identification distances");
  const elementsPath = join(IDENTIFICATION, "element-resolution.json");
  const elementsArtifact = requireJsonArtifact(
    elementsPath,
    "Restore or reproduce the retained element-resolution artifact from its pinned source; part-identification has no resolve command.",
    "part-identification element resolution",
  );
  const answersPath = join(IDENTIFICATION, `answers-${model}.json`);
  if (source !== "deterministic" && !existsSync(answersPath)) {
    throw new Error(
      `Source ${JSON.stringify(source)} needs vision answers at ${answersPath}. ` +
        `Produce them with: node scripts/part-identification.mjs ask --model ${model}. ` +
        `Or pass --source deterministic to score geometry alone, which is measurably worse on the first fifty steps.`,
    );
  }
  const cardsPath = join(IDENTIFICATION, "cards", "manifest.json");
  if (source !== "deterministic" && !existsSync(cardsPath)) {
    throw new Error(
      `Source ${JSON.stringify(source)} needs a feature/match-bound cards manifest at ${cardsPath}. Regenerate cards from the exact unchanged feature galleries.`,
    );
  }
  const cardsArtifact =
    source === "deterministic" ? null : readJsonArtifact(cardsPath, "part-identification cards");
  const cardsRoot = join(IDENTIFICATION, "cards");
  const cardImagesArtifact =
    source === "deterministic"
      ? null
      : verifyRetainedCardImageClosure(cardsRoot, cardsArtifact.value);
  const answersArtifact =
    source !== "deterministic" && existsSync(answersPath)
      ? readJsonArtifact(answersPath, `vision answers for ${model}`)
      : null;
  const pairJudgedArtifact = requireJsonArtifact(
    PART_TRUTH_PATH,
    `The blind pair-judging verdicts are a tracked repository input, not a regenerable output: restore ${PART_TRUTH_PATH} from Git rather than compiling coverage without the trust source.`,
    "part-identification pair-judged truth",
  );
  const sourceArtReboundArtifact = requireJsonArtifact(
    join(IDENTIFICATION, "source-art-rebound.json"),
    "Recompile it from the exact PDF and callout manifest before compiling coverage.",
    "part-identification source-art rebound",
  );
  const pdfPath = join("recipes", "6651557.pdf");
  if (!existsSync(pdfPath)) {
    throw new Error(
      `Missing ${pdfPath}. Coverage/3 replays source-art rebound from the retained PDF bytes rather than trusting relation JSON alone.`,
    );
  }
  const report = await compileClosure({
    manifestBytes,
    featuresArtifact,
    matchArtifact,
    distancesArtifact,
    cardsArtifact,
    cardImagesArtifact,
    answersArtifact,
    traceRoot: source === "deterministic" ? null : IDENTIFICATION,
    traceArtifacts: null,
    pairJudgedArtifact,
    sourceArtReboundArtifact,
    pdfBytes: readFileSync(pdfPath),
    elementsArtifact,
    source,
    model: source === "deterministic" ? null : model,
    assignment,
    lastStep,
  });

  mkdirSync(OUT, { recursive: true });
  writeContainedFile(OUT, "catalog-coverage.json", `${JSON.stringify(report, null, 1)}\n`, {
    label: "Catalog coverage report",
    pathLabel: "Catalog coverage report path",
    maxBytes: MAX_JSON_ARTIFACT_BYTES,
  });
  console.log(
    [
      `steps covered ${report.coverage.stepsCovered}/${report.coverage.stepsTotal}`,
      `covered prefix ${report.coverage.coveredPrefixLength}`,
      `first covered step ${report.coverage.firstCoveredStep ?? "none"}`,
      `pieces placeable ${report.coverage.piecesPlaceable}/${report.coverage.piecesTotal}`,
      `designs missing ${report.coverage.missingDesigns.length}`,
    ].join(" | "),
  );
  for (const design of report.coverage.missingDesigns.slice(0, 12)) {
    console.log(
      `  ${design.partNum.padEnd(12)} ${String(design.pieces).padStart(3)} pieces  steps ${design.steps.join(",")}  ${design.name}`,
    );
  }
  return report;
}
