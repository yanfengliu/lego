import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { claimsFor } from "./part-identification-score.mjs";
import {
  assertBoundMatchArtifacts,
  assertCardsArtifact,
  assertV4CalloutManifest,
  boundAnswers,
  readJsonArtifact,
  sha256Digest,
} from "./part-identification-artifacts.mjs";
import {
  resolveElementPart,
  summarizeCatalogCoverage,
} from "../apps/web/src/assembly/element-catalog.ts";

/**
 * How much of the booklet's opening this catalog could place, if it were asked.
 *
 * Part identification answers a callout with an element id, and the published
 * parts list turns that into a design number. Neither is a thing the enumerator
 * can place. This walks the whole chain — callout, element, design number,
 * catalog part — and reports where it breaks, per step and per design.
 *
 * It is the measurement that has to come before any attempt to rebuild the set,
 * because a build cannot skip a step: the step after a missing part has nothing
 * to attach to. So the number that matters is not how many steps are covered
 * but how long the covered prefix is.
 *
 * Reads only what earlier passes already wrote; runs no model and no browser.
 */
const CALLOUTS = "output/callout-thumbnails";
const IDENTIFICATION = "output/part-identification";
const OUT = "output/real-build";
const COVERAGE_SCHEMA = "lego.real-build-catalog-coverage/1";
const FEATURE_BINDING_FIELDS = [
  "identity",
  "file",
  "pageNumber",
  "stepNumber",
  "quantity",
  "sha256",
  "evidenceKind",
];

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function requireJson(path, produce) {
  if (!existsSync(path)) {
    throw new Error(`Missing ${path}. Produce it with: ${produce}`);
  }
  return readJson(path);
}

function option(argv, name, fallback) {
  const at = argv.indexOf(`--${name}`);
  return at === -1 || at === argv.length - 1 ? fallback : argv[at + 1];
}

function parseManifest(manifestBytes, expectation) {
  let manifest;
  try {
    manifest = JSON.parse(Buffer.from(manifestBytes).toString("utf8"));
  } catch (error) {
    throw new Error(
      `Callout manifest bytes are not valid JSON: ${error instanceof Error ? error.message : String(error)}.`,
      { cause: error },
    );
  }
  return assertV4CalloutManifest(manifest, expectation);
}

function assertFeaturesBindManifest(features, manifest) {
  if (!Array.isArray(features?.callouts)) {
    throw new Error("Part-identification features have no callouts array.");
  }
  if (features.callouts.length !== manifest.callouts.length) {
    throw new Error(
      `Part-identification features contain ${features.callouts.length} callouts, but the exact v4 manifest contains ${manifest.callouts.length}. Regenerate features and every index-bound identification artifact from this manifest.`,
    );
  }
  for (let index = 0; index < manifest.callouts.length; index += 1) {
    const expected = manifest.callouts[index];
    const actual = features.callouts[index];
    if (typeof actual !== "object" || actual === null) {
      throw new Error(`Part-identification feature callout ${index} is not an object.`);
    }
    for (const field of FEATURE_BINDING_FIELDS) {
      if (actual[field] !== expected[field]) {
        throw new Error(
          `Part-identification feature callout ${index} field ${field} is ${JSON.stringify(actual[field] ?? "missing")}, but the exact v4 manifest binds ${JSON.stringify(expected[field])}. Regenerate features and every index-bound identification artifact from this manifest.`,
        );
      }
    }
  }
}

/**
 * Compiles content-bound catalog coverage without reading or writing the filesystem.
 * Claims stay index-bound only after every identity-bearing feature field has been
 * proven byte-for-byte equivalent to the exact v4 manifest entry at that index.
 */
export function buildBookletCatalogCoverageReport(input) {
  if (!Number.isInteger(input.lastStep) || input.lastStep < 1) {
    throw new Error(
      `lastStep must be a positive integer; received ${JSON.stringify(input.lastStep)}.`,
    );
  }
  if (!(input.claims instanceof Map)) {
    throw new Error("Part-identification claims must be a Map keyed by exact feature index.");
  }
  if (
    typeof input.elements !== "object" ||
    input.elements === null ||
    Array.isArray(input.elements)
  ) {
    throw new Error("Element resolution input must be an object keyed by element id.");
  }

  const manifest = parseManifest(input.manifestBytes, input.manifestExpectation);
  assertFeaturesBindManifest(input.features, manifest);
  const manifestDigest = sha256Digest(input.manifestBytes);
  const byCallout = Object.create(null);
  const requirements = [];
  let unidentified = 0;

  for (let index = 0; index < input.features.callouts.length; index += 1) {
    const callout = input.features.callouts[index];
    if (callout.evidenceKind !== "part-art") continue;
    const claim = input.claims.get(index);
    const elementId = claim?.elementId ?? null;
    const identificationConfidence = claim?.picked ?? null;
    const element = elementId === null ? null : input.elements[elementId];
    const binding = {
      identity: callout.identity,
      file: callout.file,
      pageNumber: callout.pageNumber,
      stepNumber: callout.stepNumber,
      quantity: callout.quantity,
      cropDigest: callout.sha256,
      inputDigest: manifestDigest,
    };
    if (element === null || element === undefined) {
      unidentified += 1;
      byCallout[callout.identity] = {
        ...binding,
        elementId,
        identificationConfidence,
        resolution: null,
        unidentifiedBecause:
          elementId === null
            ? `Part identification made no claim for callout ${callout.identity}; it is one of the ${input.features.callouts.length} stable identities the assignment left unmatched.`
            : `Part identification claimed element ${elementId} for callout ${callout.identity}, but the published parts list resolves no design number for it.`,
      };
      continue;
    }
    const resolution = resolveElementPart({
      elementId,
      partNum: element.partNum,
      name: element.name,
      colorId: element.colorId,
    });
    byCallout[callout.identity] = {
      ...binding,
      elementId,
      identificationConfidence,
      resolution,
      unidentifiedBecause: null,
    };
    if (callout.stepNumber >= 1 && callout.stepNumber <= input.lastStep) {
      requirements.push({
        stepNumber: callout.stepNumber,
        quantity: callout.quantity,
        resolution,
      });
    }
  }

  return {
    schemaVersion: COVERAGE_SCHEMA,
    inputDigests: {
      pdf: manifest.sourceHash,
      calloutManifest: manifestDigest,
      ...input.identificationDigests,
    },
    what:
      "Whether the pinned catalog holds the parts the real booklet's opening steps place. " +
      "The covered prefix is the number that governs a rebuild: a step whose part is absent cannot be skipped, " +
      "because the step after it has nothing to attach to.",
    identification: {
      source: input.source,
      model: input.source === "deterministic" ? null : input.model,
      assignment: input.assignment,
    },
    lastStep: input.lastStep,
    calloutsConsidered: requirements.length,
    calloutsUnidentified: unidentified,
    coverage: summarizeCatalogCoverage(requirements),
    byCallout,
  };
}

export function runBookletCatalogCoverageCli(argv = process.argv.slice(2)) {
  const source = option(argv, "source", "adjudicated");
  const model = option(argv, "model", "sonnet");
  const assignment = option(argv, "assign", "one-to-one");
  const lastStepValue = option(argv, "last-step", "50");
  const lastStep = Number(lastStepValue);
  if (!Number.isInteger(lastStep) || lastStep < 1) {
    throw new Error(
      `--last-step must be a positive integer, received ${JSON.stringify(lastStepValue)}.`,
    );
  }

  const manifestPath = join(CALLOUTS, "manifest.json");
  if (!existsSync(manifestPath)) {
    throw new Error(
      `Missing ${manifestPath}. Produce the full v4 manifest with: CALLOUT_PAGE_LIMIT=0 npx playwright test callout-thumbnails.`,
    );
  }
  const manifestBytes = readFileSync(manifestPath);
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
  const { features, match, distances } = assertBoundMatchArtifacts({
    featuresArtifact,
    matchArtifact,
    distancesArtifact,
  });
  const elements = requireJson(
    join(IDENTIFICATION, "element-resolution.json"),
    "node scripts/part-identification.mjs resolve",
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
      `Source ${JSON.stringify(source)} needs a match-bound cards manifest at ${cardsPath}. Regenerate tiles and cards for the exact current match.`,
    );
  }
  const cardsArtifact =
    source === "deterministic" ? null : readJsonArtifact(cardsPath, "part-identification cards");
  if (cardsArtifact !== null) {
    assertCardsArtifact(cardsArtifact, {
      matchDigest: matchArtifact.digest,
      clusterIndexes: match.clusters.map(({ clusterIndex }) => clusterIndex),
    });
  }
  const answersArtifact =
    source !== "deterministic" && existsSync(answersPath)
      ? readJsonArtifact(answersPath, `vision answers for ${model}`)
      : null;
  const answers =
    source === "deterministic" || answersArtifact === null
      ? null
      : boundAnswers(answersArtifact, {
          model,
          matchDigest: matchArtifact.digest,
          cardsDigest: cardsArtifact.digest,
          clusterIndexes: match.clusters.map(({ clusterIndex }) => clusterIndex),
        });
  const held = new Map(Object.entries(elements).map(([id, entry]) => [id, entry.quantity]));
  const names = new Map(Object.entries(elements).map(([id, entry]) => [id, entry]));
  const claims = claimsFor(match, distances, source, answers, {
    assign: assignment,
    held,
    names,
  });
  const report = buildBookletCatalogCoverageReport({
    manifestBytes,
    features,
    claims,
    elements,
    source,
    model,
    assignment,
    lastStep,
    identificationDigests: {
      features: featuresArtifact.digest,
      match: matchArtifact.digest,
      distances: distancesArtifact.digest,
      ...(cardsArtifact === null ? {} : { cards: cardsArtifact.digest }),
      ...(answersArtifact === null ? {} : { answers: answersArtifact.digest }),
    },
  });

  mkdirSync(OUT, { recursive: true });
  writeFileSync(join(OUT, "catalog-coverage.json"), `${JSON.stringify(report, null, 1)}\n`);
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

const directInvocation =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
if (directInvocation) runBookletCatalogCoverageCli();
