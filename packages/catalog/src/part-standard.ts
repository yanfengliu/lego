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

interface StandardPart {
  readonly id: string;
  readonly connectors?: readonly { readonly kind?: string }[];
  readonly geometry?: {
    readonly undersideMode?: string;
    readonly studMode?: string;
    readonly studRadiusLdu?: number;
  };
  readonly collision?: { readonly primitives?: readonly unknown[] };
  readonly bodyBoundsLdu?: { readonly min: readonly number[]; readonly max: readonly number[] };
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

  return violations;
}

/** Every violation across a catalog, in part order, for a gate to print whole. */
export function catalogStandardViolations(
  parts: readonly StandardPart[],
): readonly PartStandardViolation[] {
  return parts.flatMap((part) => partStandardViolations(part));
}
