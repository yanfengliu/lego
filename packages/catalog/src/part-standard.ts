/**
 * The standard every catalog part must meet, and the reason there is one.
 *
 * This project compares rendered parts against printed booklet panels pixel by
 * pixel - containment, stroke recall, anchor registration, placement margins.
 * Every one of those numbers is measured against geometry this catalog defines,
 * so a part that is not modelled as the real part makes each of them a precise
 * measurement of the wrong thing. That is not hypothetical: printed step 4 was
 * accepted by comparing a plate's underside, which renders as a flat rectangle,
 * against a printed panel whose stud lattice fits 57 drawn tube rings.
 *
 * The rules below are therefore about agreement between what a part CLAIMS and
 * what it DRAWS. A part that declares underside clutches is claiming a cavity
 * with tubes in it; if it draws a flat face, the claim and the drawing disagree
 * and any pixel comparison against that face is meaningless.
 *
 * Adding a part means running these again. If a new part legitimately cannot
 * meet a rule, the rule is what changes - deliberately, with its reason written
 * down here - never the part quietly exempted.
 */

/** LDraw units. A stud is 4.8mm across on a 0.4mm/LDU grid, so exactly 6. */
export const EXACT_STUD_RADIUS_LDU = 6;

/**
 * Underside modes that describe connector semantics rather than drawn geometry.
 *
 * `semantic-tube-seat-grid` means the tube seats exist for the clutch solver and
 * are not modelled. That is a legitimate thing for the solver and an illegitimate
 * thing to photograph: 69 of 85 parts carry it, and none of them draws an
 * underside, so every from-below comparison in this repository has been made
 * against a flat face.
 */
export const SEMANTIC_UNDERSIDE_MODES: readonly string[] = [
  "semantic-tube-seat-grid",
  "semantic-tube-seat-offsets",
];

export interface PartStandardViolation {
  readonly partId: string;
  readonly rule: string;
  readonly detail: string;
}

interface LduBoundsLike {
  readonly min: readonly [number, number, number];
  readonly max: readonly [number, number, number];
}

interface StandardPart {
  readonly id: string;
  readonly connectors?: readonly { readonly kind?: string }[];
  readonly geometry?: {
    readonly undersideMode?: string;
    readonly studMode?: string;
    readonly bodyMode?: string;
    readonly studRadiusLdu?: number;
    readonly studHeightLdu?: number;
  };
  readonly collision?: { readonly primitives?: readonly unknown[] };
  readonly bodyBoundsLdu?: LduBoundsLike;
  readonly boundsLdu?: LduBoundsLike;
}

/**
 * Every rule, applied to one part.
 *
 * Returns violations rather than throwing, so a caller can report the whole
 * catalog's gap at once instead of stopping at the first part. A gate that
 * reports only its first failure teaches nobody the shape of the problem.
 */
export function partStandardViolations(part: StandardPart): readonly PartStandardViolation[] {
  const violations: PartStandardViolation[] = [];
  const geometry = part.geometry ?? {};
  const connectors = part.connectors ?? [];
  const clutches = connectors.filter((connector) => connector.kind === "undersideClutch").length;
  const studs = connectors.filter((connector) => connector.kind === "stud").length;

  if (clutches > 0 && SEMANTIC_UNDERSIDE_MODES.includes(geometry.undersideMode ?? "")) {
    violations.push({
      partId: part.id,
      rule: "underside-is-drawn",
      detail:
        `declares ${clutches} underside clutch connector(s) but its undersideMode is ` +
        `"${geometry.undersideMode}", which models no cavity, walls or tubes - so a render ` +
        `from below is a flat face and cannot be compared against a printed underside panel`,
    });
  }

  if (
    studs > 0 &&
    geometry.studRadiusLdu !== undefined &&
    geometry.studRadiusLdu !== EXACT_STUD_RADIUS_LDU
  ) {
    violations.push({
      partId: part.id,
      rule: "stud-radius-is-exact",
      detail:
        `studRadiusLdu is ${geometry.studRadiusLdu} where a stud is exactly ` +
        `${EXACT_STUD_RADIUS_LDU} LDU; a measured circumradius over a rounded polygon is not ` +
        `the cylinder's radius, and the excess makes a correctly seated stud read as a collision`,
    });
  }

  if (geometry.undersideMode === undefined && geometry.studMode === undefined) {
    violations.push({
      partId: part.id,
      rule: "geometry-mode-is-declared",
      detail:
        "declares no bodyMode, studMode or undersideMode, so it was admitted by a different " +
        "route than the generated parts and no rule here can check what it draws",
    });
  }

  const primitives = part.collision?.primitives?.length ?? 0;
  if (primitives === 0) {
    violations.push({
      partId: part.id,
      rule: "collision-is-modelled",
      detail: "declares no collision primitives, so nothing can overlap it",
    });
  }

  /**
   * A solid block has nothing to clutch into.
   *
   * This is `underside-is-drawn` seen from the body rather than from the mode,
   * and it is the stronger statement of the two: a part can only accept a stud
   * underneath if there is a cavity there, so `rectangular-prism` and
   * `undersideClutch` are a contradiction in the declaration itself, before any
   * question of what the renderer draws. A plate is a shell - walls, a recessed
   * ceiling, and tubes - and modelling it as a filled box is wrong from below at
   * every viewpoint, not only in the render.
   */
  if (clutches > 0 && geometry.bodyMode === "rectangular-prism") {
    violations.push({
      partId: part.id,
      rule: "body-is-hollow-where-it-clutches",
      detail:
        `declares ${clutches} underside clutch connector(s) with bodyMode ` +
        `"rectangular-prism", a filled block - a stud cannot enter solid material, so the ` +
        `body must be a shell with a cavity where those clutches are`,
    });
  }

  const body = part.bodyBoundsLdu;
  const outer = part.boundsLdu;
  if (body && outer) {
    const escapes =
      body.min.some((value, axis) => value < (outer.min[axis] ?? value) - 1e-9) ||
      body.max.some((value, axis) => value > (outer.max[axis] ?? value) + 1e-9);
    if (escapes) {
      violations.push({
        partId: part.id,
        rule: "bounds-contain-body",
        detail:
          `bodyBoundsLdu ${JSON.stringify(body)} is not inside boundsLdu ` +
          `${JSON.stringify(outer)}, so the part draws outside the extent it declares`,
      });
    }

    /**
     * Studs are modelled at -Y because LDraw's +Y points down, so a part with a
     * stud grid must declare exactly `studHeightLdu` of extent below its body
     * and a part without studs must declare none. A mismatch means the declared
     * extent and the drawn studs disagree about how tall the part is.
     */
    const studExtent = (body.min[1] ?? 0) - (outer.min[1] ?? 0);
    const expected = studs > 0 ? (geometry.studHeightLdu ?? 0) : 0;
    if (geometry.studHeightLdu !== undefined && Math.abs(studExtent - expected) > 1e-9) {
      violations.push({
        partId: part.id,
        rule: "stud-extent-is-declared",
        detail:
          `declares ${studs} stud(s) at studHeightLdu ${geometry.studHeightLdu}, so boundsLdu ` +
          `should sit ${expected} LDU below bodyBoundsLdu; it sits ${studExtent}`,
      });
    }
  }

  return violations;
}

/** Every violation across a catalog, in part order, for a gate to print whole. */
export function catalogStandardViolations(
  parts: readonly StandardPart[],
): readonly PartStandardViolation[] {
  return parts.flatMap((part) => partStandardViolations(part));
}
