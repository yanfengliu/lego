import { decodeCanonicalCardRgba } from "./part-thumbnail-image-guard.mjs";

/**
 * Which hand the query drawing is, decided from the card's own pixels.
 *
 * The check this replaces asked the model to name the mirror twin's candidate
 * number in its note, and promoted the pick when it did. That has no
 * discriminating power against the failure it exists to catch, and it was
 * refuted by execution rather than by argument: feeding the grader the swapped
 * pick on card-0039 together with the note "candidate 1 is the mirror" returned
 * the same `vision-kept` and the same trusted element as the correct answer.
 * Noticing that a mirror pair exists is not resolving which hand the query is,
 * and no wording of a note can be made to carry the difference — the twin's
 * number is the same number whichever hand was picked.
 *
 * So the question is put to the drawing instead. A left wedge plate and a right
 * one are reflections, so the query's silhouette matches one of them and matches
 * the other only after being flipped. Both comparisons are made and the wider
 * one decides, which is a fact about the card computable before any answer
 * exists — the same property that makes `mirrorTwinCandidate` a check rather
 * than a second opinion, now applied to the part of the question that matters.
 *
 * Deterministic and offline by construction: PNG un-filtering, a modal
 * background, connected components and a fixed grid. No model call, no native
 * decoder, nothing that could differ between two machines running the same
 * bytes.
 */

/**
 * The card geometry, declared once and consumed by both the renderer and this reader.
 *
 * `drawCard` in `part-identification-cards.mjs` lays panels out from these
 * numbers and `panelBox` below reads them back. A reader carrying its own copy
 * of the layout would keep scoring the wrong rectangle for as long as it took
 * somebody to notice that the numbers had drifted, which on a silhouette
 * comparison looks like a low score rather than like a bug.
 */
export const CARD_LAYOUT = Object.freeze({
  cell: 320,
  queryHeight: 340,
  minWidth: 900,
  headerHeight: 96,
  queryTop: 34,
  queryBottomGap: 44,
  candidateTop: 72,
  candidateInset: 6,
  candidateNumberHeight: 28,
  candidateBottomGap: 36,
});

export const cardWidthFor = (candidateCount) =>
  Math.max(CARD_LAYOUT.cell * candidateCount, CARD_LAYOUT.minWidth);

export const cardHeightForLayout = () =>
  CARD_LAYOUT.queryHeight + CARD_LAYOUT.cell + CARD_LAYOUT.headerHeight;

/**
 * The rectangle one panel's drawing was scaled into; index 0 is the query.
 *
 * These are the exact boxes `drawCard` passes to its `place` helper, so the
 * numbers here and the numbers there have to move together.
 */
export function panelBox(index, candidateCount) {
  const width = cardWidthFor(candidateCount);
  if (index === 0) {
    return {
      left: 0,
      top: CARD_LAYOUT.queryTop,
      width,
      height: CARD_LAYOUT.queryHeight - CARD_LAYOUT.queryBottomGap,
    };
  }
  const left = (index - 1) * CARD_LAYOUT.cell;
  return {
    left: left + CARD_LAYOUT.candidateInset,
    top: CARD_LAYOUT.queryHeight + CARD_LAYOUT.candidateTop + CARD_LAYOUT.candidateNumberHeight,
    width: CARD_LAYOUT.cell - 2 * CARD_LAYOUT.candidateInset,
    height: CARD_LAYOUT.cell - CARD_LAYOUT.candidateBottomGap,
  };
}

/** Resolution of the normalised silhouette. Fine enough to see a stepped edge. */
export const SILHOUETTE_GRID = 64;

/** How far from the card's own white a pixel must be before it counts as a drawing. */
const CARD_BACKGROUND_TOLERANCE = 24;

/** How far from the drawing's own ground a pixel must be before it counts as part. */
const GROUND_TOLERANCE = 34;

/** A drawing smaller than this carries too few pixels for a silhouette to mean anything. */
const MIN_PART_PIXELS = 400;

/** A tile whose commonest colour covers less than this is not one part on one flat ground. */
const MIN_GROUND_SHARE = 0.25;

/** A companion blob this large, touching the part's own box, is part of the drawing. */
const COMPANION_BLOB_SHARE = 0.12;

/**
 * How mirror-asymmetric a query must be before its hand is a measurable thing.
 *
 * A part that is its own reflection — a plain brick, a round plate — scores the
 * same against a candidate whichever way it is flipped, and no amount of
 * comparing can extract a hand from it. That case has to come back undecided
 * rather than resolved by whichever way the last decimal fell.
 */
export const MIN_QUERY_ASYMMETRY = 0.05;

/**
 * How much wider the winning comparison must be than the losing one.
 *
 * Set from the two ends of what this code measures on this booklet, not from
 * what would make a particular card pass. Across all 269 cards of the sealed
 * run, two candidates the comparison genuinely cannot separate come within
 * 0.0001 and 79 of 267 pairs fall inside 0.03; the tightest of the four real
 * chiral separations is 0.375. The floor sits an order of magnitude above the
 * noise and an order of magnitude below the signal, and it was chosen before any
 * card was allowed to depend on it. Raising it toward a failing card would be
 * the tolerance following the answer.
 */
export const MIN_HANDEDNESS_MARGIN = 0.03;

const blank = (reason, detail = {}) => ({ silhouette: null, reason, ...detail });

/**
 * The drawing inside one panel, cut down to the part and normalised for scale.
 *
 * Two stages, because a panel holds two backgrounds. The card is painted white
 * and the booklet tile that was drawn onto it carries its own flat ground, so
 * the white is cut away first to find the tile, and the tile's own modal colour
 * is what the part is then separated from. Doing only the second stage would
 * make the query's ground the card's white and hand back a rectangle; doing only
 * the first would hand back the tile.
 */
export function panelSilhouette(raster, box) {
  const tile = largestForeground(
    raster,
    box,
    (data, at) =>
      765 - data[at] - data[at + 1] - data[at + 2] > CARD_BACKGROUND_TOLERANCE ||
      data[at + 3] < 0xff,
  );
  if (tile === null) return blank("panel-empty");
  const tileBox = {
    left: tile.minX,
    top: tile.minY,
    width: tile.maxX - tile.minX + 1,
    height: tile.maxY - tile.minY + 1,
  };
  if (tileBox.width < 24 || tileBox.height < 24) return blank("panel-too-small", { tileBox });

  const ground = modalColour(raster, tileBox);
  if (ground.share < MIN_GROUND_SHARE)
    return blank("no-flat-ground", { groundShare: ground.share });
  const part = largestForeground(
    raster,
    tileBox,
    (data, at) =>
      Math.abs(data[at] - ground.rgb[0]) +
        Math.abs(data[at + 1] - ground.rgb[1]) +
        Math.abs(data[at + 2] - ground.rgb[2]) >
      GROUND_TOLERANCE,
  );
  if (part === null || part.pixels < MIN_PART_PIXELS) {
    return blank("part-too-small", { partPixels: part?.pixels ?? 0 });
  }
  const boxWidth = part.maxX - part.minX + 1;
  const boxHeight = part.maxY - part.minY + 1;
  if (boxWidth < 16 || boxHeight < 16) return blank("part-too-small", { boxWidth, boxHeight });

  // Letterboxed into a square rather than stretched to one: the aspect is most
  // of what separates a 4x2 wedge from a 6x2, and the two hands of one part have
  // the same aspect, so stretching would throw away the only term that keeps a
  // different-sized rival from scoring like a twin.
  const span = Math.max(boxWidth, boxHeight);
  const offsetX = (span - boxWidth) / 2;
  const offsetY = (span - boxHeight) / 2;
  const grid = new Float32Array(SILHOUETTE_GRID * SILHOUETTE_GRID);
  const weight = new Float32Array(SILHOUETTE_GRID * SILHOUETTE_GRID);
  for (let y = part.minY; y <= part.maxY; y += 1) {
    for (let x = part.minX; x <= part.maxX; x += 1) {
      const cellX = Math.min(
        SILHOUETTE_GRID - 1,
        Math.floor(((x - part.minX + offsetX) / span) * SILHOUETTE_GRID),
      );
      const cellY = Math.min(
        SILHOUETTE_GRID - 1,
        Math.floor(((y - part.minY + offsetY) / span) * SILHOUETTE_GRID),
      );
      const cell = cellY * SILHOUETTE_GRID + cellX;
      weight[cell] += 1;
      if (part.mask[(y - part.minY) * boxWidth + (x - part.minX)]) grid[cell] += 1;
    }
  }
  for (let cell = 0; cell < grid.length; cell += 1) {
    if (weight[cell] > 0) grid[cell] /= weight[cell];
  }
  return { silhouette: { grid, boxWidth, boxHeight, pixels: part.pixels }, reason: null };
}

/** The same silhouette seen in a mirror, which is the whole question. */
export function mirrorSilhouette(silhouette) {
  const grid = new Float32Array(silhouette.grid.length);
  for (let y = 0; y < SILHOUETTE_GRID; y += 1) {
    for (let x = 0; x < SILHOUETTE_GRID; x += 1) {
      grid[y * SILHOUETTE_GRID + x] =
        silhouette.grid[y * SILHOUETTE_GRID + (SILHOUETTE_GRID - 1 - x)];
    }
  }
  return { ...silhouette, grid };
}

/** Area-normalised silhouette overlap in [0, 1]; 1 is the same drawing at any scale. */
export function silhouetteIou(left, right) {
  let intersection = 0;
  let union = 0;
  for (let cell = 0; cell < left.grid.length; cell += 1) {
    intersection += Math.min(left.grid[cell], right.grid[cell]);
    union += Math.max(left.grid[cell], right.grid[cell]);
  }
  return union === 0 ? 0 : intersection / union;
}

const round = (value) => Math.round(value * 1e6) / 1e6;

/**
 * Which of two mirrored candidates the query is, or that the card cannot say.
 *
 * Three numbers and a rule. The query is compared with the picked hand and with
 * its twin, and then the mirrored query is compared with the twin; the pick is
 * upheld when it wins the first pair by a clear margin, refuted when the twin
 * does, and left undecided otherwise. `mirroredAgainstTwin` is carried as the
 * corroborating half — it is the same statement read the other way round, and a
 * card where flipping the query does not improve its match to the twin is a card
 * whose two candidates are not actually being drawn as reflections.
 *
 * Undecided is a real outcome and is never resolved by guessing. A drawing that
 * is its own mirror has no hand to read; a panel too small, a tile with no flat
 * ground, or a card whose layout does not match the renderer's own constants has
 * no readable silhouette at all. Each of those returns the reason it could not
 * answer, and the grader leaves the pick unpromoted.
 */
export function handednessFromCard({ bytes, candidateCount, pick, twin, label = "Vision card" }) {
  const undecided = (reason, detail = {}) => ({ decided: false, hand: null, reason, ...detail });
  if (
    !Number.isInteger(candidateCount) ||
    candidateCount < 1 ||
    candidateCount > 32 ||
    !Number.isInteger(pick) ||
    pick < 1 ||
    pick > candidateCount ||
    !Number.isInteger(twin) ||
    twin < 1 ||
    twin > candidateCount ||
    twin === pick
  ) {
    return undecided("not-a-mirror-pair");
  }
  let raster;
  try {
    raster = decodeCanonicalCardRgba(bytes, label);
  } catch (error) {
    return undecided("undecodable-card", {
      detail: error instanceof Error ? error.message : String(error),
    });
  }
  if (raster.width !== cardWidthFor(candidateCount) || raster.height !== cardHeightForLayout()) {
    return undecided("unexpected-card-layout", {
      detail: `card is ${raster.width} x ${raster.height}; this candidate count lays out ${cardWidthFor(candidateCount)} x ${cardHeightForLayout()}`,
    });
  }

  const panels = {};
  for (const [role, index] of [
    ["query", 0],
    ["pick", pick],
    ["twin", twin],
  ]) {
    const read = panelSilhouette(raster, panelBox(index, candidateCount));
    if (read.silhouette === null) return undecided(`${role}-unreadable`, { detail: read.reason });
    panels[role] = read.silhouette;
  }

  const mirroredQuery = mirrorSilhouette(panels.query);
  const queryAgainstPick = silhouetteIou(panels.query, panels.pick);
  const queryAgainstTwin = silhouetteIou(panels.query, panels.twin);
  const mirroredAgainstTwin = silhouetteIou(mirroredQuery, panels.twin);
  const mirroredAgainstPick = silhouetteIou(mirroredQuery, panels.pick);
  const queryAsymmetry = 1 - silhouetteIou(panels.query, mirroredQuery);
  const margin = queryAgainstPick - queryAgainstTwin;
  const measurements = {
    queryAgainstPick: round(queryAgainstPick),
    queryAgainstTwin: round(queryAgainstTwin),
    mirroredAgainstTwin: round(mirroredAgainstTwin),
    mirroredAgainstPick: round(mirroredAgainstPick),
    queryAsymmetry: round(queryAsymmetry),
    margin: round(margin),
  };
  if (queryAsymmetry < MIN_QUERY_ASYMMETRY) {
    return undecided("query-is-its-own-mirror", measurements);
  }
  if (Math.abs(margin) < MIN_HANDEDNESS_MARGIN) {
    return undecided("hands-too-close-to-separate", measurements);
  }
  return {
    decided: true,
    hand: margin > 0 ? pick : twin,
    reason: null,
    // The corroboration travels with the verdict rather than gating it. It is
    // the same comparison read from the other side, so making it a second
    // condition would refuse a correctly separated card whenever one of two
    // dependent measurements fell the wrong side of a line.
    mirroringImprovesTwinMatch: mirroredAgainstTwin > queryAgainstTwin,
    ...measurements,
  };
}

/**
 * A verdict per card, for exactly the cards whose pick has a twin beside it.
 *
 * Only those cards are decoded. The rest of the run has no mirror question to
 * answer, and inflating 269 rasters to establish that would cost a minute per
 * score for nothing.
 */
export function handednessVerdicts(pairs, cardImages) {
  const verdicts = new Map();
  for (const { cardId, candidateCount, pick, twin } of pairs) {
    const bytes = cardImages instanceof Map ? cardImages.get(cardId) : cardImages?.[cardId];
    verdicts.set(
      cardId,
      bytes === undefined
        ? { decided: false, hand: null, reason: "no-card-image" }
        : handednessFromCard({
            bytes,
            candidateCount,
            pick,
            twin,
            label: `Vision card ${cardId}`,
          }),
    );
  }
  return verdicts;
}

/** Modal colour of a rectangle, which on a booklet tile is the ground the part sits on. */
function modalColour(raster, box) {
  const tally = new Map();
  const { data, width } = raster;
  for (let y = box.top; y < box.top + box.height; y += 1) {
    for (let x = box.left; x < box.left + box.width; x += 1) {
      const at = (y * width + x) * 4;
      const key = ((data[at] >> 3) << 10) | ((data[at + 1] >> 3) << 5) | (data[at + 2] >> 3);
      tally.set(key, (tally.get(key) ?? 0) + 1);
    }
  }
  let best = 0;
  let seen = 0;
  for (const [key, count] of tally) {
    if (count > seen) {
      seen = count;
      best = key;
    }
  }
  return {
    rgb: [((best >> 10) & 31) * 8 + 4, ((best >> 5) & 31) * 8 + 4, (best & 31) * 8 + 4],
    share: seen / Math.max(1, box.width * box.height),
  };
}

/**
 * The biggest connected blob a predicate selects, plus whatever sits inside its box.
 *
 * The companion rule is the one `readThumbnail` already uses on these same
 * booklet tiles: a printed highlight or a detached shadow arrives as a second
 * blob and belongs to the part, while a caption underneath does not overlap the
 * part's own box and is dropped.
 */
function largestForeground(raster, box, selects) {
  const { data, width: rasterWidth } = raster;
  const { left, top, width, height } = box;
  const cells = width * height;
  const ink = new Uint8Array(cells);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      ink[y * width + x] = selects(data, ((top + y) * rasterWidth + (left + x)) * 4) ? 1 : 0;
    }
  }
  const label = new Int32Array(cells).fill(-1);
  const stack = new Int32Array(cells);
  const blobs = [];
  for (let seed = 0; seed < cells; seed += 1) {
    if (!ink[seed] || label[seed] !== -1) continue;
    const id = blobs.length;
    let depth = 0;
    let pixels = 0;
    let minX = width;
    let minY = height;
    let maxX = -1;
    let maxY = -1;
    stack[depth] = seed;
    depth += 1;
    label[seed] = id;
    while (depth > 0) {
      depth -= 1;
      const at = stack[depth];
      const x = at % width;
      const y = (at - x) / width;
      pixels += 1;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      for (const next of [
        x > 0 ? at - 1 : -1,
        x < width - 1 ? at + 1 : -1,
        y > 0 ? at - width : -1,
        y < height - 1 ? at + width : -1,
      ]) {
        if (next < 0 || !ink[next] || label[next] !== -1) continue;
        label[next] = id;
        stack[depth] = next;
        depth += 1;
      }
    }
    blobs.push({ id, pixels, minX, minY, maxX, maxY });
  }
  if (blobs.length === 0) return null;
  blobs.sort((a, b) => b.pixels - a.pixels);
  const main = blobs[0];
  const margin = 0.05 * Math.max(main.maxX - main.minX, main.maxY - main.minY);
  const keep = new Set(
    blobs
      .filter(
        (blob) =>
          blob.id === main.id ||
          (blob.pixels >= main.pixels * COMPANION_BLOB_SHARE &&
            blob.minX <= main.maxX + margin &&
            blob.maxX >= main.minX - margin &&
            blob.minY <= main.maxY + margin &&
            blob.maxY >= main.minY - margin),
      )
      .map(({ id }) => id),
  );
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  let pixels = 0;
  for (let cell = 0; cell < cells; cell += 1) {
    if (label[cell] === -1 || !keep.has(label[cell])) continue;
    pixels += 1;
    const x = cell % width;
    const y = (cell - x) / width;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  const boxWidth = maxX - minX + 1;
  const mask = new Uint8Array(boxWidth * (maxY - minY + 1));
  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const cell = y * width + x;
      if (label[cell] !== -1 && keep.has(label[cell])) mask[(y - minY) * boxWidth + (x - minX)] = 1;
    }
  }
  return {
    pixels,
    mask,
    minX: left + minX,
    minY: top + minY,
    maxX: left + maxX,
    maxY: top + maxY,
  };
}
