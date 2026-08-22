import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { isDeepStrictEqual } from "node:util";

import {
  assertBoundMatchArtifacts,
  assertCardsArtifact,
  boundAnswers,
  readJsonArtifact,
  sha256Digest,
} from "./part-identification-artifacts.mjs";
import {
  MAX_CARD_IMAGE_BUNDLE_BYTES,
  authenticateCardImageBundle,
} from "./part-identification-card-images.mjs";
import { PART_IDENTIFICATION_MODEL_ID } from "./part-identification-model.mjs";
import { PART_IDENTIFICATION_PROMPT_DIGEST } from "./part-identification-prompt.mjs";
import { commandSummary } from "./part-identification-score.mjs";
import {
  ActionLedgerVerificationError,
  verifyCanonicalActionLedger,
} from "./part-identification-action-ledger-verifier.mjs";
import {
  MAX_JSON_ARTIFACT_BYTES,
  readBoundedFile,
  readContainedFile,
} from "./part-identification-io.mjs";
import { option } from "./part-identification.mjs";
import { parseStrictJsonBytes } from "./part-identification-strict-json.mjs";
import { verifyBookletCatalogCoverageClosure } from "./booklet-catalog-coverage.mjs";
import {
  PART_IDENTIFICATION_MAX_CALLS,
  PART_IDENTIFICATION_MAX_PROOF_BYTES,
} from "./part-identification-transport-contract.mjs";

const SCHEMA = "lego.part-identification-report-verification/1";
const MAX_REQUEST_BYTES = 64 * 1024;
const SHA256 = /^sha256:[0-9a-f]{64}$/u;
const PATH_LIMIT = 4_096;
const MAX_BOOKLET_PDF_BYTES = 96 * 1024 * 1024;
const BUILDER_GEOMETRY_EXACT_BYTES = 1_091_772;
const OFFICIAL_MODEL_MAX_BYTES = 8 * 1024 * 1024;
const MAX_INVENTORY_LABELS = 4_096;

class SafeVerificationError extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}

function exactObject(value, label) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }
  return value;
}

function artifactSpec(request, role) {
  const spec = exactObject(request.artifacts?.[role], `Artifact ${role}`);
  if (
    typeof spec.path !== "string" ||
    spec.path.length < 1 ||
    spec.path.length > PATH_LIMIT ||
    spec.path.includes("\0") ||
    typeof spec.digest !== "string" ||
    !SHA256.test(spec.digest)
  ) {
    throw new Error(`Artifact ${role} has no bounded path and digest.`);
  }
  return spec;
}

function jsonArtifact(request, role) {
  const spec = artifactSpec(request, role);
  const artifact = readJsonArtifact(spec.path, `Python report ${role}`);
  if (artifact.digest !== spec.digest) throw new Error(`Artifact ${role} changed generation.`);
  return artifact;
}

function binaryArtifact(request, role, maximumBytes = MAX_CARD_IMAGE_BUNDLE_BYTES) {
  const spec = artifactSpec(request, role);
  const bytes = readBoundedFile(spec.path, {
    label: `Python report ${role}`,
    maxBytes: maximumBytes,
  });
  if (sha256Digest(bytes) !== spec.digest) throw new Error(`Artifact ${role} changed generation.`);
  return { bytes, digest: spec.digest };
}

async function verifyActionLedger(request, actionLedgerVerifier) {
  let stage = "inputs";
  try {
    const builderGeometry = binaryArtifact(
      request,
      "builderGeometry",
      BUILDER_GEOMETRY_EXACT_BYTES,
    );
    if (builderGeometry.bytes.byteLength !== BUILDER_GEOMETRY_EXACT_BYTES) {
      throw new Error("Builder geometry has the wrong exact byte length.");
    }
    const input = {
      ledger: jsonArtifact(request, "actionLedger"),
      coverage: jsonArtifact(request, "coverage"),
      features: jsonArtifact(request, "features"),
      calloutManifest: jsonArtifact(request, "calloutManifest"),
      builderCalibration: jsonArtifact(request, "builderCalibration"),
      transitionClassifications: jsonArtifact(request, "transitionClassifications"),
      officialModel: binaryArtifact(request, "officialModel", OFFICIAL_MODEL_MAX_BYTES),
      bookletPdf: binaryArtifact(request, "bookletPdf", MAX_BOOKLET_PDF_BYTES),
      builderGeometry,
    };
    stage = "reproduction";
    await actionLedgerVerifier(input);
  } catch (error) {
    if (error instanceof SafeVerificationError) throw error;
    if (error instanceof ActionLedgerVerificationError) {
      throw new SafeVerificationError(`action-ledger-${error.code}`);
    }
    throw new SafeVerificationError(`action-ledger-${stage}`);
  }
}

function verifyAdjudication(request) {
  let stage = "inputs";
  try {
    const matchArtifact = jsonArtifact(request, "match");
    const cardsArtifact = jsonArtifact(request, "cards");
    const answersArtifact = jsonArtifact(request, "answers");
    const binding = exactObject(request.artifacts["features-binding"], "Feature binding");
    if (binding.path !== "" || typeof binding.digest !== "string" || !SHA256.test(binding.digest)) {
      throw new Error("Feature binding is malformed.");
    }
    stage = "cards";
    const cards = assertCardsArtifact(cardsArtifact, {
      featuresDigest: binding.digest,
      matchDigest: matchArtifact.digest,
      clusters: matchArtifact.value.clusters,
    });
    stage = "cardImages";
    const cardsSpec = artifactSpec(request, "cards");
    const cardImagesBytes = readBoundedFile(
      join(dirname(cardsSpec.path), ...cards.imagesFile.split("/")),
      {
        label: "Adjudication retained card-image bundle",
        maxBytes: MAX_CARD_IMAGE_BUNDLE_BYTES,
      },
    );
    const cardImagesArtifact = { bytes: cardImagesBytes, digest: sha256Digest(cardImagesBytes) };
    const authenticatedCardImages = authenticateCardImageBundle(cardImagesArtifact, cards);
    stage = "answers";
    boundAnswers(answersArtifact, {
      model: PART_IDENTIFICATION_MODEL_ID,
      matchDigest: matchArtifact.digest,
      cardsDigest: cardsArtifact.digest,
      promptDigest: PART_IDENTIFICATION_PROMPT_DIGEST,
      clusters: matchArtifact.value.clusters,
      cards: cards.cards,
      cardImages: authenticatedCardImages.images,
      traceRoot: dirname(artifactSpec(request, "answers").path),
    });
  } catch (error) {
    if (error instanceof SafeVerificationError) throw error;
    throw new SafeVerificationError(`adjudication-${stage}`);
  }
}

function verifyIdentification(request) {
  assertBoundMatchArtifacts({
    featuresArtifact: jsonArtifact(request, "features"),
    matchArtifact: jsonArtifact(request, "match"),
    distancesArtifact: jsonArtifact(request, "distances"),
  });
}

function verifyCoverage(request, coverageClosureVerifier) {
  const coverageArtifact = jsonArtifact(request, "coverage");
  const source = coverageArtifact.value?.identification?.source;
  const adjudicated = source === "adjudicated";
  const input = {
    coverageBytes: coverageArtifact.bytes,
    source,
    assignment: coverageArtifact.value?.identification?.assignment,
    model: coverageArtifact.value?.identification?.model,
    featuresArtifact: jsonArtifact(request, "features"),
    matchArtifact: jsonArtifact(request, "match"),
    distancesArtifact: jsonArtifact(request, "distances"),
    elementsArtifact: jsonArtifact(request, "elementResolution"),
    cardsArtifact: adjudicated ? jsonArtifact(request, "cards") : null,
    cardImagesArtifact: adjudicated ? binaryArtifact(request, "cardImages") : null,
    answersArtifact: adjudicated ? jsonArtifact(request, "answers") : null,
    traceRoot: adjudicated ? dirname(artifactSpec(request, "answers").path) : null,
    traceArtifacts: null,
    pairJudgedArtifact: jsonArtifact(request, "pairJudged"),
    manifestBytes: jsonArtifact(request, "calloutManifest").bytes,
    lastStep: coverageArtifact.value?.lastStep,
  };
  coverageClosureVerifier(input);
}

function writeArtifact(root, relativePath, bytes) {
  const destination = join(root, ...relativePath.split("/"));
  mkdirSync(dirname(destination), { recursive: true });
  writeFileSync(destination, bytes);
}

function retainedTraceBytes(traceRoot, reference, label, maxBytes) {
  const bytes = readContainedFile(traceRoot, reference.path, {
    label,
    pathLabel: `${label} path`,
    maxBytes,
  });
  if (bytes.length !== reference.byteLength || sha256Digest(bytes) !== reference.digest) {
    throw new Error(`${label} does not reproduce its retained byte length and digest.`);
  }
  return bytes;
}

function stageAnswerTraceClosure(destinationRoot, traceRoot, answersArtifact) {
  const currentPath = `answer-checkpoints/sha256/${answersArtifact.digest.slice("sha256:".length)}.json`;
  writeArtifact(
    destinationRoot,
    `output/part-identification/${currentPath}`,
    answersArtifact.bytes,
  );
  const calls = answersArtifact.value.calls;
  const callDigests = Object.keys(calls);
  for (let index = 0; index < callDigests.length; index += 1) {
    const reference = calls[callDigests[index]].proof;
    writeArtifact(
      destinationRoot,
      `output/part-identification/${reference.path}`,
      retainedTraceBytes(
        traceRoot,
        reference,
        "Sanitized score-reproduction call proof",
        PART_IDENTIFICATION_MAX_PROOF_BYTES,
      ),
    );
  }
  let predecessor = answersArtifact.value.predecessor;
  let nodes = 1;
  while (predecessor !== null) {
    nodes += 1;
    if (nodes > PART_IDENTIFICATION_MAX_CALLS) {
      throw new Error("Score-reproduction answer checkpoint lineage exceeds its node ceiling.");
    }
    const bytes = retainedTraceBytes(
      traceRoot,
      predecessor,
      "Score-reproduction answer checkpoint",
      MAX_JSON_ARTIFACT_BYTES,
    );
    writeArtifact(destinationRoot, `output/part-identification/${predecessor.path}`, bytes);
    predecessor = parseStrictJsonBytes(bytes).predecessor;
  }
}

async function verifyScoreSummary(request, requestDirectory) {
  let stage = "inputs";
  try {
    const scoreArtifact = jsonArtifact(request, "score");
    const featuresArtifact = jsonArtifact(request, "features");
    const matchArtifact = jsonArtifact(request, "match");
    const distancesArtifact = jsonArtifact(request, "distances");
    const cardsArtifact = jsonArtifact(request, "cards");
    const answersArtifact = jsonArtifact(request, "answers");
    const elementsArtifact = jsonArtifact(request, "elementResolution");
    const labelsArtifact = jsonArtifact(request, "inventoryLabels");
    const truthArtifact = jsonArtifact(request, "truthFirstFifty");
    const cardImagesArtifact = binaryArtifact(request, "cardImages");
    const inventoryEntries = labelsArtifact.value?.entries;
    if (
      !Array.isArray(inventoryEntries) ||
      inventoryEntries.length < 1 ||
      inventoryEntries.length > MAX_INVENTORY_LABELS ||
      inventoryEntries.some(
        (entry) =>
          typeof entry !== "object" ||
          entry === null ||
          Array.isArray(entry) ||
          Object.keys(entry).sort().join(",") !== "elementId,quantity" ||
          typeof entry.elementId !== "string" ||
          !/^[0-9]{3,12}$/u.test(entry.elementId) ||
          !Number.isSafeInteger(entry.quantity) ||
          entry.quantity < 1 ||
          entry.quantity > 10_000,
      ) ||
      new Set(inventoryEntries.map(({ elementId }) => elementId)).size !== inventoryEntries.length
    ) {
      throw new Error("Inventory labels are not one bounded unique canonical element table.");
    }
    stage = "identification";
    const identified = assertBoundMatchArtifacts({
      featuresArtifact,
      matchArtifact,
      distancesArtifact,
    });
    const cards = assertCardsArtifact(cardsArtifact, {
      featuresDigest: featuresArtifact.digest,
      matchDigest: matchArtifact.digest,
      clusters: identified.match.clusters,
    });
    const authenticatedCardImages = authenticateCardImageBundle(cardImagesArtifact, cards);
    boundAnswers(answersArtifact, {
      model: PART_IDENTIFICATION_MODEL_ID,
      matchDigest: matchArtifact.digest,
      cardsDigest: cardsArtifact.digest,
      promptDigest: PART_IDENTIFICATION_PROMPT_DIGEST,
      clusters: identified.match.clusters,
      cards: cards.cards,
      cardImages: authenticatedCardImages.images,
      traceRoot: dirname(artifactSpec(request, "answers").path),
    });

    const temporaryRoot = join(requestDirectory, "score-work");
    mkdirSync(temporaryRoot);
    const previousCwd = process.cwd();
    const previousLog = console.log;
    try {
      stage = "sandbox";
      for (const [relativePath, artifact] of [
        ["output/part-identification/features.json", featuresArtifact],
        ["output/part-identification/match.json", matchArtifact],
        ["output/part-identification/distances.json", distancesArtifact],
        ["output/part-identification/cards/manifest.json", cardsArtifact],
        [
          `output/part-identification/answers-${PART_IDENTIFICATION_MODEL_ID}.json`,
          answersArtifact,
        ],
        ["output/part-identification/element-resolution.json", elementsArtifact],
        ["output/inventory-thumbnails/labels.json", labelsArtifact],
        ["scripts/fixtures/part-identification-truth-first50.json", truthArtifact],
      ]) {
        writeArtifact(temporaryRoot, relativePath, artifact.bytes);
      }
      if (!/^runs\/[0-9a-f]{24}\/images\.bin$/u.test(cards.imagesFile)) {
        throw new Error("Cards image path is not canonical.");
      }
      writeArtifact(
        temporaryRoot,
        `output/part-identification/cards/${cards.imagesFile}`,
        cardImagesArtifact.bytes,
      );
      for (const [cardId, imageBytes] of authenticatedCardImages.images) {
        writeArtifact(
          temporaryRoot,
          `output/part-identification/cards/${cards.cards[cardId].file}`,
          imageBytes,
        );
      }
      stageAnswerTraceClosure(
        temporaryRoot,
        dirname(artifactSpec(request, "answers").path),
        answersArtifact,
      );
      const inventoryHeld = () => ({
        held: new Map(inventoryEntries.map(({ elementId, quantity }) => [elementId, quantity])),
        digest: labelsArtifact.digest,
      });
      const elementNames = () => ({
        names: new Map(Object.entries(elementsArtifact.value)),
        digest: elementsArtifact.digest,
      });
      const headline = scoreArtifact.value?.headline;
      process.chdir(temporaryRoot);
      console.log = () => {};
      stage = "generation";
      await commandSummary(
        [
          "--models",
          PART_IDENTIFICATION_MODEL_ID,
          "--headline-source",
          headline?.source,
          "--headline-assign",
          headline?.assignment,
          "--headline-model",
          headline?.model,
        ],
        { option, inventoryHeld, elementNames },
      );
      const reproduced = readBoundedFile("output/part-identification/score.json", {
        label: "Reproduced score summary",
        maxBytes: MAX_JSON_ARTIFACT_BYTES,
      });
      stage = "comparison";
      if (!isDeepStrictEqual(Buffer.from(reproduced), Buffer.from(scoreArtifact.bytes))) {
        throw new Error("Score summary did not reproduce exactly.");
      }
    } finally {
      console.log = previousLog;
      process.chdir(previousCwd);
      rmSync(temporaryRoot, { recursive: true, force: true });
    }
  } catch (error) {
    if (error instanceof SafeVerificationError) throw error;
    const message = error instanceof Error ? error.message : "";
    const category = [
      ["features-file", /features\.json/u],
      ["match-file", /match\.json/u],
      ["distances-file", /distances\.json/u],
      ["cards-file", /cards[\\/]manifest\.json/u],
      ["answers-file", /answers-[^\\/]+\.json/u],
      ["elements-file", /element-resolution\.json/u],
      ["labels-file", /inventory-thumbnails[\\/]labels\.json/u],
      ["truth-file", /part-identification-truth-first50\.json/u],
      ["missing-file", /ENOENT|no such file|does not exist|No retained/u],
      ["path-boundary", /path|contain|directory|regular file|inode/u],
      ["card-images", /card-image|image bundle|images\.bin|PNG/u],
      ["answers", /answer|prompt|model/u],
      ["truth", /truth|verdict|judged/u],
      ["digest", /digest|generation|bind/u],
      ["score", /score|variant|headline/u],
    ].find(([, pattern]) => pattern.test(message))?.[0];
    throw new SafeVerificationError(`score-${stage}${category ? `-${category}` : ""}`);
  }
}

export async function dispatch(
  request,
  requestDirectory,
  {
    actionLedgerVerifier = verifyCanonicalActionLedger,
    coverageClosureVerifier = verifyBookletCatalogCoverageClosure,
  } = {},
) {
  if (request.schemaVersion !== SCHEMA || Number(process.versions.node.split(".")[0]) !== 24) {
    throw new Error("Verifier schema or runtime mismatch.");
  }
  exactObject(request.artifacts, "Artifacts");
  if (request.kind === "identification") verifyIdentification(request);
  else if (request.kind === "adjudication") verifyAdjudication(request);
  else if (request.kind === "coverage") verifyCoverage(request, coverageClosureVerifier);
  else if (request.kind === "score-summary") await verifyScoreSummary(request, requestDirectory);
  else if (request.kind === "action-ledger") {
    await verifyActionLedger(request, actionLedgerVerifier);
  } else throw new Error("Unsupported verification kind.");
  return {
    schemaVersion: SCHEMA,
    kind: request.kind,
    ok: true,
    digests: Object.fromEntries(
      Object.entries(request.artifacts).map(([role, spec]) => [role, spec.digest]),
    ),
  };
}

export async function runVerifierCli(options = {}) {
  let response;
  let exitCode = 0;
  try {
    const requestPath = process.argv[2];
    if (typeof requestPath !== "string") throw new Error("Missing request path.");
    const bytes = readBoundedFile(requestPath, {
      label: "Python report verification request",
      maxBytes: MAX_REQUEST_BYTES,
    });
    const request = parseStrictJsonBytes(bytes);
    response = await dispatch(request, dirname(resolve(requestPath)), options);
  } catch (error) {
    exitCode = 2;
    response = {
      schemaVersion: SCHEMA,
      kind: "rejected",
      ok: false,
      code: error instanceof SafeVerificationError ? error.code : "canonical-rejection",
      digests: {},
    };
  }
  process.stdout.write(JSON.stringify(response));
  process.exitCode = exitCode;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await runVerifierCli();
}
