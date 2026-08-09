import { STUD_PITCH_LDU, UPRIGHT_ORIENTATIONS } from "@lego-studio/catalog";
import type { RigidTransform } from "@lego-studio/protocol";

/**
 * Turning what a person can see in a printed panel into a bounded candidate set.
 *
 * The search this narrows enumerates every lattice placement of every piece and
 * scores each against the printed art: 240 places for one piece of printed step
 * 4 and 334 for the other, an 80,160 product. A person does not consider any of
 * them. They look at the picture, see that the long plate lies across the seam
 * with the wedge to its right, and that is the answer — so the expensive half of
 * this loop is discovery, and discovery is what a reading can supply.
 *
 * Three rules hold everything here in place.
 *
 * **The reading is untrusted data.** It arrives from a vision call, it can be
 * wrong, and every field of it is a *filter* over placements the enumerator
 * already proved legal. Nothing here can author a transform the domain would
 * refuse, because nothing here authors a transform at all — it only deletes
 * candidates. That is why a wrong reading costs a refusal rather than a wrong
 * build: delete every candidate and the result is an empty set with a named
 * reason, never a placement nobody proposed.
 *
 * **The vocabulary is visible, and the arithmetic is here.** A reading says
 * "its long side runs up and to the right" and "it sits on top of the green 4x2,
 * three studs of it overlapping". It never says a coordinate, because a model
 * looking at a picture cannot measure one and asking for it collects fiction.
 * Resolving "up and to the right" to a lattice basis vector, "on top of" to a
 * discovered stud connection, and "three studs" to a connection count is this
 * module's job and it is all exact.
 *
 * **The printed contour still decides.** What comes out is a smaller candidate
 * set, handed to the same scorer with the same margin. A reading that narrows to
 * one candidate has not placed it; the panel still has to agree, and if it does
 * not the step refuses exactly as it did before.
 */

export const PANEL_READING_SCHEMA_VERSION = "lego.panel-reading/1" as const;

/** How far off a page axis a projected vector may sit and still be called diagonal. */
const VERTICAL_DEADZONE = 0.2;
/** Anchor descriptions resolving to more placed parts than this are refused. */
export const MAXIMUM_ANCHOR_MATCHES = 4;
/** Studs of overlap at or below which a piece is resting on one end only. */
export const BRIDGE_MAXIMUM_OVERLAP_STUDS = 2;

export type PageDirection =
  | "up-and-right"
  | "down-and-right"
  | "down-and-left"
  | "up-and-left"
  | "straight-up"
  | "straight-down";

export type PanelReadingRelation =
  "on-top-of" | "underneath" | "beside" | "bridges" | "cannot-tell";

export class PanelReadingError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "PanelReadingError";
  }
}

export interface PixelVector {
  readonly xPx: number;
  readonly yPx: number;
}

/**
 * The panel's own lattice, in page pixels.
 *
 * `a` is one stud along world +X, `b` one stud along world +Z, `up` one plate
 * toward the sky — which is world -Y, because this frame is negative-Y-up. These
 * are the same three vectors `latticeTranslations` sweeps, so a direction named
 * on the page and a direction in the model are the same statement here.
 */
export interface PanelProjection {
  readonly a: PixelVector;
  readonly b: PixelVector;
  readonly up: PixelVector;
}

export interface PartBox {
  readonly min: readonly [number, number, number];
  readonly max: readonly [number, number, number];
}

export interface PartFacts {
  readonly boundsLdu: PartBox;
  readonly colorName: string;
}

export interface PlacedPart {
  readonly partId: string;
  readonly catalogPartId: string;
  readonly colorId: string;
  readonly transform: RigidTransform;
}

export interface DiscoveredConnectionLike {
  readonly targetPartId: string;
  readonly targetPortId: string;
  readonly candidatePortId: string;
}

export interface ReadingCandidate {
  readonly transform: RigidTransform;
  readonly connections: readonly DiscoveredConnectionLike[];
}

export interface PieceReading {
  readonly id: string;
  readonly visible: boolean;
  readonly longAxis: PageDirection | "square" | "cannot-tell";
  readonly anchorId: string | null;
  readonly relation: PanelReadingRelation;
  readonly side: PageDirection | "centred" | "cannot-tell";
  readonly overlapStuds: number | null;
  readonly confidence: number;
  readonly note?: string;
  readonly cannotTell?: string;
}

export type PanelReadingRefusalCode =
  | "reading-missing-piece"
  | "reading-declined"
  | "anchor-unresolved"
  | "anchor-not-yet-placed"
  | "reading-contradicts-enumeration"
  | "reading-under-determined"
  | "panel-viewpoint-disagrees";

export interface PanelReadingRefusal {
  readonly code: PanelReadingRefusalCode;
  readonly pieceId: string | null;
  readonly message: string;
}

export interface PieceNarrowing {
  readonly pieceId: string;
  readonly catalogPartId: string;
  readonly offered: number;
  readonly kept: number;
  readonly keptCandidates: readonly ReadingCandidate[];
  /** Which fields were consumed, so a narrowing can be read back to its reason. */
  readonly appliedPredicates: readonly string[];
  readonly refusal: PanelReadingRefusal | null;
}

export interface PanelReadingNarrowing {
  readonly schemaVersion: typeof PANEL_READING_SCHEMA_VERSION;
  readonly perPiece: readonly PieceNarrowing[];
  readonly refusals: readonly PanelReadingRefusal[];
  /** Product of the surviving per-piece sets, or null when a piece refused. */
  readonly productSize: number | null;
  readonly usable: boolean;
}

const ORIENTATION_MATRICES = new Map(
  UPRIGHT_ORIENTATIONS.map((orientation) => [orientation.id, orientation.matrix]),
);

function rotate(
  matrix: readonly number[],
  point: readonly [number, number, number],
): [number, number, number] {
  return [
    matrix[0]! * point[0] + matrix[1]! * point[1] + matrix[2]! * point[2],
    matrix[3]! * point[0] + matrix[4]! * point[1] + matrix[5]! * point[2],
    matrix[6]! * point[0] + matrix[7]! * point[1] + matrix[8]! * point[2],
  ];
}

function orientationMatrix(orientationId: string): readonly number[] {
  const matrix = ORIENTATION_MATRICES.get(orientationId);
  if (matrix === undefined) {
    throw new PanelReadingError(
      `No upright orientation ${JSON.stringify(orientationId)}; a reading can only narrow placements the enumerator produced.`,
    );
  }
  return matrix;
}

/** The world axis-aligned box a placement occupies. */
export function worldBox(box: PartBox, transform: RigidTransform): PartBox {
  const matrix = orientationMatrix(transform.orientationId);
  const min: [number, number, number] = [
    Number.POSITIVE_INFINITY,
    Number.POSITIVE_INFINITY,
    Number.POSITIVE_INFINITY,
  ];
  const max: [number, number, number] = [
    Number.NEGATIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
  ];
  for (const x of [box.min[0], box.max[0]]) {
    for (const y of [box.min[1], box.max[1]]) {
      for (const z of [box.min[2], box.max[2]]) {
        const corner = rotate(matrix, [x, y, z]);
        for (let axis = 0; axis < 3; axis += 1) {
          const value = corner[axis]! + transform.positionLdu[axis]!;
          if (value < min[axis]!) min[axis] = value;
          if (value > max[axis]!) max[axis] = value;
        }
      }
    }
  }
  return { min, max };
}

/** Projects a world displacement onto the page. World -Y is up the page. */
export function projectLdu(
  projection: PanelProjection,
  displacement: readonly [number, number, number],
): PixelVector {
  const studsA = displacement[0] / STUD_PITCH_LDU;
  const studsB = displacement[2] / STUD_PITCH_LDU;
  const plates = -displacement[1] / 8;
  return {
    xPx: studsA * projection.a.xPx + studsB * projection.b.xPx + plates * projection.up.xPx,
    yPx: studsA * projection.a.yPx + studsB * projection.b.yPx + plates * projection.up.yPx,
  };
}

/**
 * Names the quadrant a page vector points into.
 *
 * Page y runs down, which is why "up" tests negative. The deadzone exists
 * because a vector that is nearly vertical on the page is one a reader would
 * call straight up rather than picking a diagonal, and forcing it into one would
 * manufacture a disagreement out of a rounding.
 */
export function classifyPageDirection(vector: PixelVector): PageDirection | null {
  const { xPx, yPx } = vector;
  if (xPx === 0 && yPx === 0) return null;
  if (Math.abs(xPx) < VERTICAL_DEADZONE * Math.abs(yPx)) {
    return yPx < 0 ? "straight-up" : "straight-down";
  }
  if (xPx > 0) return yPx < 0 ? "up-and-right" : "down-and-right";
  return yPx < 0 ? "up-and-left" : "down-and-left";
}

/**
 * The undirected line a page direction lies on.
 *
 * A plate's long side is a line, not an arrow: "up and to the right" and "down
 * and to the left" describe the same plate. The prompt asks for one end anyway,
 * because for a chiral part the end carries real information, but only the line
 * is consumed — checking the end would measure which way the reader chose to
 * point, and a symmetric plate has no answer to that.
 */
export function directionLine(direction: PageDirection): "ne-sw" | "nw-se" | "vertical" {
  if (direction === "straight-up" || direction === "straight-down") return "vertical";
  return direction === "up-and-right" || direction === "down-and-left" ? "ne-sw" : "nw-se";
}

/** The part's own longest horizontal axis, in local coordinates. */
function longAxisLocal(box: PartBox): [number, number, number] | null {
  const spanX = box.max[0] - box.min[0];
  const spanZ = box.max[2] - box.min[2];
  if (Math.abs(spanX - spanZ) < STUD_PITCH_LDU / 2) return null;
  return spanZ > spanX ? [0, 0, 1] : [1, 0, 0];
}

function centre(box: PartBox): [number, number, number] {
  return [
    (box.min[0] + box.max[0]) / 2,
    (box.min[1] + box.max[1]) / 2,
    (box.min[2] + box.max[2]) / 2,
  ];
}

const BUILT_ANCHOR = /^built:([A-Za-z][A-Za-z ]{0,31}) (\d{1,2})x(\d{1,2})$/u;

function studSpan(box: PartBox): { long: number; wide: number } {
  const x = Math.round((box.max[0] - box.min[0]) / STUD_PITCH_LDU);
  const z = Math.round((box.max[2] - box.min[2]) / STUD_PITCH_LDU);
  return { long: Math.max(x, z), wide: Math.min(x, z) };
}

/**
 * Resolves an anchor description to the placed parts it could name.
 *
 * A description is a colour and two stud counts, both of which a reader can take
 * off the drawing. It is allowed to match several parts — this booklet places
 * three 4x4 wedge plates in its first six steps — and every match is carried,
 * because the job is a bounded candidate set and not a unique answer. What it
 * may not do is match nothing, or match so many that the narrowing means
 * nothing; both refuse by name.
 */
export function resolveAnchor(
  anchorId: string,
  placed: readonly PlacedPart[],
  facts: ReadonlyMap<string, PartFacts>,
): { matches: readonly PlacedPart[]; refusal: string | null } {
  const parsed = BUILT_ANCHOR.exec(anchorId);
  if (parsed === null) {
    return {
      matches: [],
      refusal: `Anchor ${JSON.stringify(anchorId)} is not a built-piece description.`,
    };
  }
  const colour = parsed[1]!.trim().toLocaleLowerCase("en-US");
  const first = Number(parsed[2]);
  const second = Number(parsed[3]);
  const wantedLong = Math.max(first, second);
  const wantedWide = Math.min(first, second);
  const matches = placed.filter((part) => {
    const fact = facts.get(part.catalogPartId);
    if (fact === undefined) return false;
    if (fact.colorName.toLocaleLowerCase("en-US") !== colour) return false;
    const span = studSpan(fact.boundsLdu);
    return span.long === wantedLong && span.wide === wantedWide;
  });
  if (matches.length === 0) {
    return {
      matches: [],
      refusal:
        `Anchor ${JSON.stringify(anchorId)} names no piece that has been placed. A description that ` +
        `resolves to nothing cannot narrow anything, and guessing which piece was meant is how a ` +
        `misread size becomes a wrong placement.`,
    };
  }
  if (matches.length > MAXIMUM_ANCHOR_MATCHES) {
    return {
      matches: [],
      refusal:
        `Anchor ${JSON.stringify(anchorId)} matches ${matches.length} placed pieces, over the ` +
        `${MAXIMUM_ANCHOR_MATCHES} this narrowing will carry.`,
    };
  }
  return { matches, refusal: null };
}

function connectionsTo(candidate: ReadingCandidate, partIds: ReadonlySet<string>): number {
  let count = 0;
  for (const connection of candidate.connections) {
    if (partIds.has(connection.targetPartId)) count += 1;
  }
  return count;
}

function boxesTouchHorizontally(left: PartBox, right: PartBox): boolean {
  const gapX = Math.max(left.min[0] - right.max[0], right.min[0] - left.max[0]);
  const gapZ = Math.max(left.min[2] - right.max[2], right.min[2] - left.max[2]);
  // Touching along one axis while genuinely overlapping along the other. A pure
  // corner touch is not "beside" in any sense a reader would mean by it.
  return (
    (gapX <= 0 && gapZ <= 0) ||
    (Math.abs(gapX) <= 1 && gapZ < 0) ||
    (Math.abs(gapZ) <= 1 && gapX < 0)
  );
}

interface NarrowInput {
  readonly reading: {
    readonly panel: { readonly viewpoint: string } | null;
    readonly pieces: readonly PieceReading[];
  };
  readonly pieces: readonly { readonly id: string; readonly catalogPartId: string }[];
  readonly candidatesByPiece: readonly (readonly ReadingCandidate[])[];
  readonly placed: readonly PlacedPart[];
  readonly facts: ReadonlyMap<string, PartFacts>;
  readonly projection: PanelProjection;
  /** The face the booklet's own rotate icon derived, which the reading must agree with. */
  readonly panelFace: "studs-up" | "underside" | null;
  /** Largest product of surviving per-piece sets this narrowing will call usable. */
  readonly maximumProduct: number;
}

/**
 * Applies one panel reading to one step's enumerated placements.
 *
 * Every predicate below is evaluated against candidates the enumerator produced,
 * so the output is always a subset of what the search would have scored anyway.
 * The reading can make the search cheaper and it can make it refuse; it can
 * never make it consider something new.
 */
export function narrowByPanelReading(input: NarrowInput): PanelReadingNarrowing {
  const refusals: PanelReadingRefusal[] = [];
  if (input.pieces.length !== input.candidatesByPiece.length) {
    throw new PanelReadingError(
      `A reading narrows ${input.pieces.length} pieces but ${input.candidatesByPiece.length} candidate sets were supplied.`,
    );
  }

  // The face is settled truth derived from the booklet's own rotate icon, and it
  // reproduces a blind reading of forty-three panels exactly. A reading that
  // disagrees with it has the picture upside down, so every direction it gave is
  // suspect and none of them may be consumed — this is a whole-panel refusal and
  // deliberately not a per-piece one.
  const claimed = input.reading.panel?.viewpoint ?? null;
  const expected =
    input.panelFace === "studs-up"
      ? "from-above"
      : input.panelFace === "underside"
        ? "from-underneath"
        : null;
  if (expected !== null && claimed !== null && claimed !== "cannot-tell" && claimed !== expected) {
    refusals.push({
      code: "panel-viewpoint-disagrees",
      pieceId: null,
      message:
        `The reading says this panel is drawn ${claimed} where the booklet's own rotate-the-model icon ` +
        `derives ${expected}. Every direction in the reading is measured against the page, so a panel ` +
        `read from the wrong side makes all of them wrong; the reading is refused whole rather than in part.`,
    });
  }

  const byId = new Map(input.reading.pieces.map((piece) => [piece.id, piece]));
  const perPiece: PieceNarrowing[] = [];
  for (const [index, piece] of input.pieces.entries()) {
    const offered = input.candidatesByPiece[index]!;
    const record = byId.get(piece.id) ?? null;
    const applied: string[] = [];
    if (record === undefined || record === null) {
      const refusal: PanelReadingRefusal = {
        code: "reading-missing-piece",
        pieceId: piece.id,
        message: `The reading has no line for ${piece.id}, so nothing about it was narrowed.`,
      };
      refusals.push(refusal);
      perPiece.push({
        pieceId: piece.id,
        catalogPartId: piece.catalogPartId,
        offered: offered.length,
        kept: offered.length,
        keptCandidates: offered,
        appliedPredicates: applied,
        refusal,
      });
      continue;
    }
    if (!record.visible) {
      // A piece the reader could not see is not a failure and not a licence to
      // guess: it contributes no predicate and every candidate survives. The
      // product cap below is what decides whether the step is still usable.
      const refusal: PanelReadingRefusal = {
        code: "reading-declined",
        pieceId: piece.id,
        message: `${piece.id} was not visible to the reader: ${record.cannotTell ?? "no reason given"}`,
      };
      refusals.push(refusal);
      perPiece.push({
        pieceId: piece.id,
        catalogPartId: piece.catalogPartId,
        offered: offered.length,
        kept: offered.length,
        keptCandidates: offered,
        appliedPredicates: applied,
        refusal,
      });
      continue;
    }

    const fact = input.facts.get(piece.catalogPartId);
    if (fact === undefined) {
      throw new PanelReadingError(`No geometry supplied for ${piece.catalogPartId}.`);
    }

    let kept = offered;

    const localLong = longAxisLocal(fact.boundsLdu);
    if (record.longAxis !== "cannot-tell" && record.longAxis !== "square" && localLong !== null) {
      const wantedLine = directionLine(record.longAxis);
      applied.push(`longAxis:${record.longAxis}`);
      kept = kept.filter((candidate) => {
        const world = rotate(orientationMatrix(candidate.transform.orientationId), localLong);
        const observed = classifyPageDirection(
          projectLdu(input.projection, [
            world[0] * STUD_PITCH_LDU,
            world[1] * STUD_PITCH_LDU,
            world[2] * STUD_PITCH_LDU,
          ]),
        );
        return observed !== null && directionLine(observed) === wantedLine;
      });
    }

    let anchorParts: readonly PlacedPart[] = [];
    if (record.anchorId !== null && record.relation !== "cannot-tell") {
      const resolved = resolveAnchor(record.anchorId, input.placed, input.facts);
      if (resolved.refusal !== null) {
        const refusal: PanelReadingRefusal = {
          code: record.anchorId.startsWith("built:")
            ? "anchor-unresolved"
            : "anchor-not-yet-placed",
          pieceId: piece.id,
          message: resolved.refusal,
        };
        refusals.push(refusal);
        perPiece.push({
          pieceId: piece.id,
          catalogPartId: piece.catalogPartId,
          offered: offered.length,
          kept: kept.length,
          keptCandidates: kept,
          appliedPredicates: applied,
          refusal,
        });
        continue;
      }
      anchorParts = resolved.matches;
    }

    if (anchorParts.length > 0) {
      const anchorIds = new Set(anchorParts.map((part) => part.partId));
      const anchorBoxes = anchorParts.map((part) => {
        const anchorFact = input.facts.get(part.catalogPartId);
        if (anchorFact === undefined) {
          throw new PanelReadingError(`No geometry supplied for anchor ${part.catalogPartId}.`);
        }
        return { part, box: worldBox(anchorFact.boundsLdu, part.transform) };
      });

      if (record.relation !== "cannot-tell") {
        applied.push(`relation:${record.relation}@${record.anchorId ?? "?"}`);
        kept = kept.filter((candidate) => {
          const touching = connectionsTo(candidate, anchorIds);
          const box = worldBox(fact.boundsLdu, candidate.transform);
          if (record.relation === "on-top-of" || record.relation === "underneath") {
            if (touching === 0) return false;
            // Negative-Y-up: a smaller y is higher. The comparison is between
            // centres and not between box faces, because a part's bounds include
            // its studs and a stacked pair therefore overlaps vertically by the
            // stud height — the studs are inside the clutches above them. Two
            // parts joined by a discovered stud pair can never share a centre,
            // so the comparison is exact.
            const here = centre(box)[1];
            return anchorBoxes.some(({ box: anchorBox }) =>
              record.relation === "on-top-of"
                ? here < centre(anchorBox)[1]
                : here > centre(anchorBox)[1],
            );
          }
          if (record.relation === "bridges") {
            return touching > 0 && touching <= BRIDGE_MAXIMUM_OVERLAP_STUDS;
          }
          // beside: level with the anchor and touching it edge on, with no stud
          // pair between them — two plates on the same surface, not stacked.
          if (touching > 0) return false;
          // Level with the anchor is a statement about the surface both rest on,
          // so it compares undersides — the largest y, this frame being
          // negative-Y-up — rather than centres, which would also demand the two
          // parts be the same height.
          return anchorBoxes.some(
            ({ box: anchorBox }) =>
              Math.abs(box.max[1] - anchorBox.max[1]) < 1e-6 &&
              boxesTouchHorizontally(box, anchorBox),
          );
        });
      }

      if (record.overlapStuds !== null) {
        applied.push(`overlapStuds:${record.overlapStuds}`);
        kept = kept.filter(
          (candidate) => connectionsTo(candidate, anchorIds) === record.overlapStuds,
        );
      }

      if (record.side !== "cannot-tell") {
        applied.push(`side:${record.side}`);
        kept = kept.filter((candidate) => {
          const box = worldBox(fact.boundsLdu, candidate.transform);
          const here = centre(box);
          return anchorBoxes.some(({ box: anchorBox }) => {
            const there = centre(anchorBox);
            const vector = projectLdu(input.projection, [
              here[0] - there[0],
              here[1] - there[1],
              here[2] - there[2],
            ]);
            const observed = classifyPageDirection(vector);
            if (record.side === "centred") {
              return (
                Math.hypot(vector.xPx, vector.yPx) <
                Math.hypot(input.projection.a.xPx, input.projection.a.yPx) / 2
              );
            }
            return observed === record.side;
          });
        });
      }
    }

    const refusal: PanelReadingRefusal | null =
      kept.length === 0
        ? {
            code: "reading-contradicts-enumeration",
            pieceId: piece.id,
            message:
              `The reading of ${piece.id} (${applied.join(", ") || "no predicates"}) keeps none of the ` +
              `${offered.length} placements the enumerator proved legal. Nothing the reader described is a ` +
              `place this piece could go, so the reading is refused rather than repaired.`,
          }
        : null;
    if (refusal !== null) refusals.push(refusal);
    perPiece.push({
      pieceId: piece.id,
      catalogPartId: piece.catalogPartId,
      offered: offered.length,
      kept: kept.length,
      keptCandidates: kept,
      appliedPredicates: applied,
      refusal,
    });
  }

  const blocking = refusals.some(
    (refusal) =>
      refusal.code === "reading-contradicts-enumeration" ||
      refusal.code === "panel-viewpoint-disagrees" ||
      refusal.code === "anchor-unresolved" ||
      refusal.code === "anchor-not-yet-placed" ||
      refusal.code === "reading-missing-piece",
  );
  const productSize = blocking
    ? null
    : perPiece.reduce((product, piece) => product * Math.max(piece.kept, 1), 1);
  if (productSize !== null && productSize > input.maximumProduct) {
    refusals.push({
      code: "reading-under-determined",
      pieceId: null,
      message:
        `The reading leaves ${productSize} whole-step candidates, over the ${input.maximumProduct} ` +
        `this narrowing will call a proposal. It described where the pieces are but not closely enough ` +
        `to propose, so the search runs as it did before rather than on a set nobody chose.`,
    });
  }
  return {
    schemaVersion: PANEL_READING_SCHEMA_VERSION,
    perPiece,
    refusals,
    productSize,
    usable: !blocking && productSize !== null && productSize <= input.maximumProduct,
  };
}
