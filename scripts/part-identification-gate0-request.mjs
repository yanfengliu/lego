import { join } from "node:path";

import {
  assertBoundMatchArtifacts,
  assertCardsArtifact,
  readJsonArtifact,
} from "./part-identification-artifacts.mjs";
import { verifyRetainedCardImageClosure } from "./part-identification-card-images.mjs";
import {
  PART_IDENTIFICATION_GATE0_PILOT_CARD_IDS,
  snapshotGate0Request,
} from "./part-identification-gate0-foundation.mjs";
import { partIdentificationInstructionBytes } from "./part-identification-instruction.mjs";
import { createPartIdentificationMcpRequest } from "./part-identification-mcp-server.mjs";
import { PART_IDENTIFICATION_MODEL_ID } from "./part-identification-model.mjs";
import { PART_IDENTIFICATION_PROMPT_DIGEST } from "./part-identification-prompt.mjs";

export function reconstructRetainedPartIdentificationGate0Request(
  out = "output/part-identification",
) {
  const featuresArtifact = readJsonArtifact(join(out, "features.json"), "features");
  const matchArtifact = readJsonArtifact(join(out, "match.json"), "match");
  const distancesArtifact = readJsonArtifact(join(out, "distances.json"), "distances");
  const { match, artifacts } = assertBoundMatchArtifacts({
    featuresArtifact,
    matchArtifact,
    distancesArtifact,
  });
  const cardsRoot = join(out, "cards");
  const cardsArtifact = readJsonArtifact(join(cardsRoot, "manifest.json"), "cards");
  const manifest = assertCardsArtifact(cardsArtifact, {
    featuresDigest: artifacts.features.digest,
    matchDigest: artifacts.match.digest,
    clusters: match.clusters,
  });
  const closure = verifyRetainedCardImageClosure(cardsRoot, manifest);
  const digests = new Map(
    Object.entries(manifest.cards).map(([cardId, card]) => [cardId, card.sha256]),
  );
  const request = createPartIdentificationMcpRequest({
    cardIds: PART_IDENTIFICATION_GATE0_PILOT_CARD_IDS,
    images: closure.images,
    digests,
    model: PART_IDENTIFICATION_MODEL_ID,
    cardsDigest: cardsArtifact.digest,
    promptDigest: PART_IDENTIFICATION_PROMPT_DIGEST,
    instructionBytes: partIdentificationInstructionBytes(PART_IDENTIFICATION_GATE0_PILOT_CARD_IDS),
  });
  return snapshotGate0Request(request).canonical;
}
