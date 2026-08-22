import {
  PART_IDENTIFICATION_PROMPT,
  PART_IDENTIFICATION_PROMPT_DIGEST,
} from "./part-identification-prompt.mjs";
import { PART_IDENTIFICATION_MAX_BATCH_CARDS } from "./part-identification-transport-contract.mjs";
import { isArray } from "./part-identification-safe-shape.mjs";

const CARD_ID = /^card-\d{4}$/u;

export function partIdentificationInstructionBytes(cardIds) {
  if (
    !isArray(cardIds) ||
    cardIds.length < 1 ||
    cardIds.length > PART_IDENTIFICATION_MAX_BATCH_CARDS
  ) {
    throw new Error(
      `Part-identification instruction requires 1 through ${PART_IDENTIFICATION_MAX_BATCH_CARDS} unique canonical card-NNNN ids.`,
    );
  }
  let ordered = "";
  for (let index = 0; index < cardIds.length; index += 1) {
    let duplicate = false;
    for (let prior = 0; prior < index; prior += 1) {
      if (cardIds[prior] === cardIds[index]) duplicate = true;
    }
    if (!CARD_ID.test(cardIds[index]) || duplicate) {
      throw new Error(`Part-identification instruction card ${index} is not unique and canonical.`);
    }
    ordered += `${index === 0 ? "" : ", "}${cardIds[index]}`;
  }
  return Buffer.from(
    `Call the supplied bound-card image tool exactly once. It returns these cards in this exact order: ${ordered}.\n\n` +
      `Answer separately about each card, in that order, one line per card. Each line must begin with its card id followed by the JSON. No prose or code fences.\n\n${PART_IDENTIFICATION_PROMPT}`,
    "utf8",
  );
}

export { PART_IDENTIFICATION_PROMPT_DIGEST };
