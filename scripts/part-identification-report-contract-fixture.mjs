import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { __testOnly as coverageTestOnly } from "./booklet-catalog-coverage.mjs";
import { closureFixture } from "./booklet-catalog-coverage-test-fixture.mjs";
import { authenticateCardImageBundle } from "./part-identification-card-images.mjs";
import { PART_IDENTIFICATION_MODEL_ID } from "./part-identification-model.mjs";
import { option } from "./part-identification.mjs";
import { commandSummary } from "./part-identification-score.mjs";
import { jsonArtifactFromBytes, sha256Digest } from "./part-identification-artifacts.mjs";
import {
  TEST_BOOKLET_BYTES,
  TEST_BUILDER_CALIBRATION,
  TEST_BUILDER_GEOMETRY_BYTES,
  TEST_OFFICIAL_MODEL_BYTES,
  TEST_TRANSITION_CLASSIFICATIONS,
  reproduceSyntheticActionLedger,
} from "./part-identification-report-test-action-ledger.mjs";

function write(root, relativePath, bytes) {
  const path = join(root, ...relativePath.split("/"));
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, bytes);
}

const jsonArtifact = (value) =>
  jsonArtifactFromBytes(Buffer.from(`${JSON.stringify(value, null, 1)}\n`), "report fixture");
const TEST_ROOT_MARKER = ".lego-report-contract-fixture-root";
const TEST_ROOT_MARKER_CONTENT = "lego-report-contract-fixture/1\n";
const REPOSITORY_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function requireEmptyMarkedTestRoot(root) {
  const repositoryBoundary = `${REPOSITORY_ROOT}${sep}`;
  const rootBoundary = `${root}${sep}`;
  if (
    root === REPOSITORY_ROOT ||
    root.startsWith(repositoryBoundary) ||
    REPOSITORY_ROOT.startsWith(rootBoundary)
  ) {
    throw new Error("Report fixture root must be outside the repository and its ancestors.");
  }
  const entries = readdirSync(root);
  if (
    entries.length !== 1 ||
    entries[0] !== TEST_ROOT_MARKER ||
    readFileSync(join(root, TEST_ROOT_MARKER), "utf8") !== TEST_ROOT_MARKER_CONTENT
  ) {
    throw new Error("Report fixture root must be empty except for its exact test-owner marker.");
  }
}

/**
 * Materialize one tiny producer-authenticated closure for Python integration tests.
 * Only the explicit test verifier imports the hard-coded one-callout expectation;
 * the production verifier always authenticates retained content through canonical replay.
 */
export async function writePythonReportContractFixture(rootInput, coverageSource = "adjudicated") {
  const root = resolve(rootInput);
  requireEmptyMarkedTestRoot(root);
  const fixture = closureFixture();
  if (coverageSource !== "adjudicated" && coverageSource !== "deterministic") {
    throw new Error("Report fixture coverage source must be adjudicated or deterministic.");
  }
  const labelsArtifact = jsonArtifact({
    entries: [{ elementId: "300501", quantity: 1 }],
  });
  const artifacts = [
    ["output/part-identification/features.json", fixture.featuresArtifact],
    ["output/part-identification/match.json", fixture.matchArtifact],
    ["output/part-identification/distances.json", fixture.distancesArtifact],
    ["output/part-identification/cards/manifest.json", fixture.cardsArtifact],
    [
      `output/part-identification/answers-${PART_IDENTIFICATION_MODEL_ID}.json`,
      fixture.answersArtifact,
    ],
    ["output/part-identification/element-resolution.json", fixture.elementsArtifact],
    ["output/inventory-thumbnails/labels.json", labelsArtifact],
    ["scripts/fixtures/part-identification-truth-first50.json", fixture.pairJudgedArtifact],
  ];
  for (const [relativePath, artifact] of artifacts) write(root, relativePath, artifact.bytes);
  write(root, "output/callout-thumbnails/manifest.json", fixture.manifestBytes);
  write(
    root,
    `output/part-identification/cards/${fixture.cardsArtifact.value.imagesFile}`,
    fixture.cardImagesArtifact.bytes,
  );
  const images = authenticateCardImageBundle(
    fixture.cardImagesArtifact,
    fixture.cardsArtifact.value,
  ).images;
  for (const [cardId, bytes] of images) {
    write(
      root,
      `output/part-identification/cards/${fixture.cardsArtifact.value.cards[cardId].file}`,
      bytes,
    );
  }
  write(root, "recipes/6651557.pdf", TEST_BOOKLET_BYTES);
  write(root, "output/real-build/builder-shell-geometry.bin", TEST_BUILDER_GEOMETRY_BYTES);
  const coverageInput =
    coverageSource === "adjudicated"
      ? fixture
      : {
          ...fixture,
          source: "deterministic",
          model: null,
          cardsArtifact: null,
          cardImagesArtifact: null,
          answersArtifact: null,
        };
  const coverage = coverageTestOnly.compileBookletCatalogCoverageClosure(
    coverageInput,
    fixture.manifestExpectation,
  );
  const coverageArtifact = jsonArtifact(coverage);
  write(root, "output/real-build/catalog-coverage.json", coverageArtifact.bytes);
  const calibrationArtifact = jsonArtifact(TEST_BUILDER_CALIBRATION);
  const transitionsArtifact = jsonArtifact(TEST_TRANSITION_CLASSIFICATIONS);
  write(root, "output/real-build/builder-canonical-calibration.json", calibrationArtifact.bytes);
  write(root, "output/real-build/transition-classifications.json", transitionsArtifact.bytes);
  write(root, "output/official-model/vx1087034_21066_a.xml", TEST_OFFICIAL_MODEL_BYTES);
  if (coverageSource === "adjudicated") {
    const ledgerFixture = await reproduceSyntheticActionLedger({
      coverage: coverageArtifact,
      calloutManifest: jsonArtifactFromBytes(fixture.manifestBytes, "report fixture manifest"),
      officialModel: {
        bytes: TEST_OFFICIAL_MODEL_BYTES,
        digest: sha256Digest(TEST_OFFICIAL_MODEL_BYTES),
      },
      bookletPdf: { bytes: TEST_BOOKLET_BYTES, digest: sha256Digest(TEST_BOOKLET_BYTES) },
      builderCalibration: calibrationArtifact,
      builderGeometry: {
        bytes: TEST_BUILDER_GEOMETRY_BYTES,
        digest: sha256Digest(TEST_BUILDER_GEOMETRY_BYTES),
      },
      transitionClassifications: transitionsArtifact,
    });
    write(root, "output/real-build/action-ledger.json", ledgerFixture.encoded);
  }

  const inventoryHeld = () => ({
    held: new Map(
      labelsArtifact.value.entries.map(({ elementId, quantity }) => [elementId, quantity]),
    ),
    digest: labelsArtifact.digest,
  });
  const elementNames = () => ({
    names: new Map(Object.entries(fixture.elementsArtifact.value)),
    digest: fixture.elementsArtifact.digest,
  });
  const previous = process.cwd();
  const previousLog = console.log;
  try {
    process.chdir(root);
    console.log = () => {};
    await commandSummary(
      [
        "--models",
        PART_IDENTIFICATION_MODEL_ID,
        "--headline-source",
        "adjudicated",
        "--headline-assign",
        "nearest",
        "--headline-model",
        PART_IDENTIFICATION_MODEL_ID,
      ],
      { option, inventoryHeld, elementNames },
    );
  } finally {
    console.log = previousLog;
    process.chdir(previous);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href && process.argv[2]) {
  await writePythonReportContractFixture(process.argv[2], process.argv[3]);
}
