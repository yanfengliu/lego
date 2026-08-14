import { assignDrawings } from "./part-assignment.mjs";
import { mirrorTwinCandidate } from "./part-identification-mirror-pairs.mjs";
import { COLOR_DEFINITIONS } from "../packages/catalog/src/colors.ts";

const normalizeColourName = (value) =>
  typeof value === "string"
    ? value
        .normalize("NFKC")
        .toLowerCase()
        .replace(/\bgrey\b/gu, "gray")
        .replace(/[^a-z0-9]+/gu, " ")
        .trim()
        .replace(/\s+/gu, " ")
    : null;

const COLOUR_BY_LDRAW_CODE = new Map(
  COLOR_DEFINITIONS.map(({ ldrawCode, displayName }) => [
    ldrawCode,
    normalizeColourName(displayName),
  ]),
);

/** Checks a model's independent description against the metadata of its pick. */
export function describesSameThing(answer, element) {
  if (
    typeof answer !== "object" ||
    answer === null ||
    typeof element !== "object" ||
    element === null ||
    typeof element.name !== "string" ||
    element.name.length === 0 ||
    typeof answer.kind !== "string" ||
    !Number.isInteger(answer.studsLong) ||
    !Number.isInteger(answer.studsWide)
  )
    return null;
  const plain = element.name.toLowerCase();
  const kindWords = {
    brick: ["brick"],
    plate: ["plate"],
    tile: ["tile"],
    slope: ["slope", "sloped", "wedge", "cheese"],
    wedge: ["wedge", "slope", "sloped"],
    arch: ["arch", "bow"],
    round: ["round", "cylinder", "dish", "cone"],
    technic: ["technic", "pin", "axle"],
  }[answer.kind.toLowerCase()];
  const kindAgrees =
    kindWords === undefined ? null : kindWords.some((word) => plain.includes(word));
  const printed = [...plain.matchAll(/(\d+)\s*x\s*(\d+)/g)].map(([, left, right]) => [
    Number(left),
    Number(right),
  ]);
  const sizeAgrees =
    answer.studsLong > 0 && answer.studsWide > 0 && printed.length > 0
      ? printed.some(
          ([left, right]) =>
            (left === answer.studsLong && right === answer.studsWide) ||
            (left === answer.studsWide && right === answer.studsLong),
        )
      : null;
  const colorCode =
    Number.isInteger(element.colorId) || /^\d+$/u.test(element.colorId ?? "")
      ? Number(element.colorId)
      : null;
  const expectedColour = colorCode === null ? null : (COLOUR_BY_LDRAW_CODE.get(colorCode) ?? null);
  const statedColour = normalizeColourName(answer.colour);
  const colourAgrees =
    expectedColour === null || statedColour === null || statedColour.length === 0
      ? null
      : expectedColour === statedColour;
  return { kindAgrees, sizeAgrees, colourAgrees };
}

/** Reduces one bounded vision answer to a deterministically checked element proposal. */
export function visionPick(cluster, answers, names, cards, handedness = null) {
  const answer = answers?.[cluster.clusterIndex] ?? null;
  if (answer === null || answer === undefined) return { elementId: null, picked: "unanswered" };
  const pick = Number(answer.pick ?? 0);
  if (pick === 0) return { elementId: null, picked: "refused" };
  const differs = answer.differsFromPick ?? "nothing";
  const cardId = `card-${String(cluster.clusterIndex).padStart(4, "0")}`;
  const displayed = cards?.[cardId]?.candidateElementIds;
  if (!Array.isArray(displayed)) return { elementId: null, picked: "description-unverifiable" };
  if (!Number.isInteger(pick) || pick < 1 || pick > displayed.length) {
    return { elementId: null, picked: "out-of-range" };
  }
  if (differs !== "nothing" && differs !== "view") {
    return { elementId: null, picked: `differs-${differs}` };
  }
  const elementId = displayed[pick - 1];
  if (!(names instanceof Map)) return { elementId: null, picked: "description-unverifiable" };
  const verdict = describesSameThing(answer, names.get(elementId));
  if (
    verdict === null ||
    verdict.kindAgrees !== true ||
    verdict.sizeAgrees !== true ||
    verdict.colourAgrees !== true
  ) {
    return {
      elementId: null,
      picked:
        verdict?.kindAgrees === false ||
        verdict?.sizeAgrees === false ||
        verdict?.colourAgrees === false
          ? "self-contradicted"
          : "description-unverifiable",
    };
  }
  const twin = mirrorTwinCandidate(displayed, names, pick);
  if (twin !== 0) {
    const hand =
      (handedness instanceof Map ? handedness.get(cardId) : handedness?.[cardId]) ?? null;
    if (hand?.decided !== true) return { elementId: null, picked: "handedness-unverified" };
    if (hand.hand !== pick) return { elementId: null, picked: "handedness-refuted" };
  }
  const second = Number(answer.alsoCouldBe ?? 0);
  const alsoCouldBe =
    Number.isInteger(second) && second >= 1 && second <= displayed.length && second !== pick
      ? displayed[second - 1]
      : null;
  return { elementId, picked: "vision-kept", alsoCouldBe };
}

/** Assigns one element claim to each exact callout index. */
export function claimsFor(match, distances, source, answers, options = {}) {
  if (source !== "deterministic" && source !== "adjudicated") {
    throw new Error(
      `Part-identification source must be deterministic or adjudicated; received ${JSON.stringify(source)}.`,
    );
  }
  if (!["nearest", "one-to-one", "quantity-informed"].includes(options.assign ?? "one-to-one")) {
    throw new Error(
      `Part-identification assignment must be nearest, one-to-one, or quantity-informed; received ${JSON.stringify(options.assign)}.`,
    );
  }
  const useAssignment = options.assign !== "nearest";
  const chosen = new Map();
  if (useAssignment) {
    const held = options.held ?? new Map();
    const elements = distances.elementIds.map((elementId) => ({
      elementId,
      held: held.get(elementId) ?? 0,
    }));
    const drawings = match.clusters.map((cluster, row) => {
      const vision =
        source === "deterministic"
          ? null
          : visionPick(cluster, answers, options.names, options.cards, options.handedness);
      return {
        distanceTo: distances.rows[row],
        pieces: cluster.pieces,
        picked: vision?.elementId ?? null,
        alsoCouldBe: vision?.elementId === null ? null : (vision?.alsoCouldBe ?? null),
      };
    });
    const result = assignDrawings(drawings, elements, {
      useQuantities: options.assign === "quantity-informed",
    });
    for (const [row, elementId] of result.entries()) {
      chosen.set(match.clusters[row].clusterIndex, elementId);
    }
  }

  const claims = new Map();
  for (const cluster of match.clusters) {
    const vision =
      source === "deterministic"
        ? null
        : visionPick(cluster, answers, options.names, options.cards, options.handedness);
    const nearest = cluster.candidates[0]?.elementId ?? null;
    const elementId = useAssignment
      ? (chosen.get(cluster.clusterIndex) ?? null)
      : (vision?.elementId ?? nearest);
    let picked = source === "deterministic" ? "geometry" : (vision?.picked ?? "unanswered");
    if (useAssignment && vision?.elementId) {
      picked = vision.elementId === elementId ? "vision-kept" : "vision-overruled";
    }
    for (const [position, member] of cluster.members.entries()) {
      claims.set(member, {
        elementId,
        clusterIndex: cluster.clusterIndex,
        picked: picked === "vision-kept" && position > 0 ? "vision-member-unreviewed" : picked,
      });
    }
  }
  return claims;
}

/** Conserves claimed quantities against the published inventory. */
export function conservation(callouts, claims, held) {
  const claimed = new Map();
  let unclaimedPieces = 0;
  for (const [index, claim] of claims) {
    const quantity = callouts[index].quantity;
    if (claim.elementId === null) {
      unclaimedPieces += quantity;
      continue;
    }
    claimed.set(claim.elementId, (claimed.get(claim.elementId) ?? 0) + quantity);
  }
  const perElement = [...held].map(([elementId, holds]) => ({
    elementId,
    held: holds,
    claimed: claimed.get(elementId) ?? 0,
  }));
  for (const [elementId, count] of claimed) {
    if (!held.has(elementId)) perElement.push({ elementId, held: 0, claimed: count });
  }
  const over = perElement.filter((row) => row.claimed > row.held);
  const under = perElement.filter((row) => row.claimed < row.held);
  return {
    elementsHeld: held.size,
    piecesHeld: [...held.values()].reduce((total, value) => total + value, 0),
    piecesClaimed: [...claimed.values()].reduce((total, value) => total + value, 0),
    piecesUnclaimed: unclaimedPieces,
    elementsExact: perElement.filter((row) => row.claimed === row.held).length,
    elementsNeverClaimed: perElement.filter((row) => row.claimed === 0 && row.held > 0).length,
    elementsClaimedButNotHeld: perElement.filter((row) => row.held === 0).length,
    piecesOverClaimed: over.reduce((total, row) => total + row.claimed - row.held, 0),
    piecesUnderClaimed: under.reduce((total, row) => total + row.held - row.claimed, 0),
    piecesReconciled: perElement.reduce((total, row) => total + Math.min(row.claimed, row.held), 0),
    worstOverClaims: [...over]
      .sort((left, right) => right.claimed - right.held - (left.claimed - left.held))
      .slice(0, 20),
    worstUnderClaims: [...under]
      .sort((left, right) => right.held - right.claimed - (left.held - left.claimed))
      .slice(0, 20),
    perElement: perElement.sort((left, right) => left.elementId.localeCompare(right.elementId)),
  };
}
