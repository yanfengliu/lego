import { UPRIGHT_ORIENTATIONS } from "@lego-studio/catalog";
import type { PartDefinition } from "@lego-studio/catalog";

import {
  InconclusiveSymmetry,
  applyUpright,
  isCatalogPartSelfSymmetry,
  normalizeZero,
  orientationOf,
  residualTransform,
} from "./real-build-builder-frame-geometry";
import type { Point } from "./real-build-builder-frame-geometry";
import type { LedgerTransform } from "./real-build-official";

export {
  applyUpright,
  invertUpright,
  isCatalogPartSelfSymmetry,
  isResolvedMeshAssetSelfSymmetry,
  residualTransform,
} from "./real-build-builder-frame-geometry";

/**
 * Choosing one catalog-to-Builder frame when the stud lattice admits several.
 *
 * An exact correspondence is not a unique answer. A 4x6 plate's stud set is
 * unchanged by a half turn and an 8x8 plate's by every quarter turn, so the
 * exact enumeration returns two or four frames for parts whose placement is a
 * single fact. Only two things may settle that, and they are different claims:
 *
 *  * **The part's own symmetry.** If the residual transform between two
 *    candidates maps the catalog part onto itself — every connector, every
 *    collision primitive, every clutch allowance, both bounds and the footprint
 *    dimensions — then the two frames place the same part in the same cells with
 *    the same grips, and the residual choice is not observable by anything
 *    downstream. It is canonicalized rather than decided.
 *  * **An independent surface witness.** Where the residual is *not* a symmetry,
 *    the part is genuinely different under the two frames and geometry has to
 *    say which. Builder's own Shell vertices are carried through each candidate
 *    and their mean distance to the expanded LDraw surface is compared; the
 *    winner must beat the runner-up by a stated factor, and that factor is
 *    reported so the choice can be judged instead of trusted.
 *
 * The symmetry proof is deliberately narrow and says so: it covers the box and
 * cylinder collision primitives and parametric recipes, and refuses by name
 * rather than assuming for anything else. A refusal here is a design whose frame
 * is not pinned, which is a missing step; a wrong quotient is a part placed
 * slightly wrong, which reads as a step that succeeded.
 */

export type FrameSelectionMethod =
  | "unique-stud-correspondence"
  | "unique-anchor-correspondence"
  | "catalog-part-self-symmetry"
  | "surface-registration-catalog-symmetry"
  | "ldraw-surface-bound"
  | "ldraw-surface-witness"
  | "ldraw-surface-registration"
  | "opaque-identity-local-part-frame";

/** The runner-up must be at least this many times worse, in mean surface distance. */
export const FRAME_WITNESS_MINIMUM_MARGIN_MICRO_RATIO = 4_000_000;

export interface FrameSelection {
  readonly transform: LedgerTransform;
  readonly candidateCount: number;
  readonly equivalenceClassCount: number;
  readonly method: FrameSelectionMethod;
  /** Runner-up mean over chosen mean, scaled by 10^6; explicit infinity; null only without competition. */
  readonly witnessMarginMicroRatio: number | "infinite" | null;
}

const SURFACE_REGISTRATION_TRANSLATION_STEP_LDU = 10;
const SURFACE_REGISTRATION_TRANSLATION_REACH_LDU = 80;
const SURFACE_REGISTRATION_BOX_SLACK_LDU = 10;
const SURFACE_REGISTRATION_VERTICAL_ENDPOINT_DRIFT_LDU = 2;

function canonicalOrder(left: LedgerTransform, right: LedgerTransform): number {
  return (
    orientationOf(left.orientationId).quarterTurns -
      orientationOf(right.orientationId).quarterTurns ||
    left.positionLdu[0]! - right.positionLdu[0]! ||
    left.positionLdu[1]! - right.positionLdu[1]! ||
    left.positionLdu[2]! - right.positionLdu[2]!
  );
}

/**
 * Every upright frame under which one exact catalog anchor set lands on its Builder counterpart.
 *
 * The comparison is exact integer equality on both sets, in both directions, so
 * a missing anchor, an extra anchor, or a center from a different authored role
 * leaves no candidate at all rather than a near fit.
 */
export function deriveCatalogToBuilderFrames(
  catalogAnchorCenters: readonly Point[],
  builderAnchorCenters: readonly Point[],
): LedgerTransform[] {
  if (
    catalogAnchorCenters.length < 1 ||
    catalogAnchorCenters.length !== builderAnchorCenters.length
  ) {
    throw new TypeError(
      `Builder anchor set has ${builderAnchorCenters.length} centers while the catalog anchor set has ` +
        `${catalogAnchorCenters.length}; a missing, extra, or cross-role substitution cannot calibrate a frame.`,
    );
  }
  const expected = JSON.stringify(
    [...builderAnchorCenters]
      .map((point) => point.map(normalizeZero))
      .sort((left, right) => left[0]! - right[0]! || left[1]! - right[1]! || left[2]! - right[2]!),
  );
  const first = catalogAnchorCenters[0]!;
  const found = new Map<string, LedgerTransform>();
  for (const orientation of UPRIGHT_ORIENTATIONS) {
    const rotatedFirst = applyUpright(
      { positionLdu: [0, 0, 0], orientationId: orientation.id },
      first,
    );
    for (const target of builderAnchorCenters) {
      const candidate: LedgerTransform = {
        positionLdu: target.map(
          (coordinate, axis) => coordinate - rotatedFirst[axis]!,
        ) as unknown as LedgerTransform["positionLdu"],
        orientationId: orientation.id,
      };
      const mapped = JSON.stringify(
        catalogAnchorCenters
          .map((point) => applyUpright(candidate, point))
          .sort(
            (left, right) => left[0]! - right[0]! || left[1]! - right[1]! || left[2]! - right[2]!,
          ),
      );
      if (mapped === expected) found.set(JSON.stringify(candidate), candidate);
    }
  }
  return [...found.values()].sort(canonicalOrder);
}

/**
 * One frame, with the reason it is the frame.
 *
 * `measure` is the independent witness and is called only when the part's own
 * symmetry cannot account for the residual choice, because for a symmetric part
 * every candidate scores identically by construction and a tie is not evidence.
 */
export function selectCatalogToBuilderFrame(input: {
  readonly definition: PartDefinition;
  readonly designRevision: string;
  readonly catalogStudCenters: readonly Point[];
  readonly builderStudCenters: readonly Point[];
  readonly measure: (frame: LedgerTransform) => readonly number[];
}): FrameSelection {
  const { definition, designRevision, catalogStudCenters, builderStudCenters, measure } = input;
  const candidates = deriveCatalogToBuilderFrames(catalogStudCenters, builderStudCenters);
  if (candidates.length === 0) {
    throw new TypeError(
      `Builder type-23 centers and catalog stud centers for ${designRevision} yield no upright local ` +
        `frame at all, so the two sources do not describe the same stud lattice.`,
    );
  }
  return selectFrameCandidates({
    definition,
    designRevision,
    candidates,
    measure,
    candidateDescription: "Builder type-23 centers",
    uniqueMethod: "unique-stud-correspondence",
    symmetryMethod: "catalog-part-self-symmetry",
    witnessMethod: "ldraw-surface-witness",
    applyHardSurfaceBound: false,
  });
}

export function selectCatalogToBuilderAnchorFrame(input: {
  readonly definition: PartDefinition;
  readonly designRevision: string;
  readonly catalogAnchorCenters: readonly Point[];
  readonly builderAnchorCenters: readonly Point[];
  readonly anchorDescription: string;
  readonly measure: (frame: LedgerTransform) => readonly number[];
}): FrameSelection {
  const {
    definition,
    designRevision,
    catalogAnchorCenters,
    builderAnchorCenters,
    anchorDescription,
    measure,
  } = input;
  const candidates = deriveCatalogToBuilderFrames(catalogAnchorCenters, builderAnchorCenters);
  if (candidates.length === 0) {
    throw new TypeError(
      `${anchorDescription} for ${designRevision} yields no upright local frame, so the two exact ` +
        `source surfaces do not describe the same anchor lattice.`,
    );
  }
  return selectFrameCandidates({
    definition,
    designRevision,
    candidates,
    measure,
    candidateDescription: anchorDescription,
    uniqueMethod: "unique-anchor-correspondence",
    symmetryMethod: "catalog-part-self-symmetry",
    witnessMethod: "ldraw-surface-witness",
    applyHardSurfaceBound: true,
  });
}

function pointBounds(points: readonly Point[]): { readonly min: Point; readonly max: Point } {
  if (points.length === 0) throw new TypeError("A surface registration needs at least one point.");
  return {
    min: [0, 1, 2].map((axis) =>
      Math.min(...points.map((point) => point[axis]!)),
    ) as unknown as Point,
    max: [0, 1, 2].map((axis) =>
      Math.max(...points.map((point) => point[axis]!)),
    ) as unknown as Point,
  };
}

function transformedBounds(transform: LedgerTransform, bounds: { min: Point; max: Point }) {
  const corners: Point[] = [];
  for (const x of [bounds.min[0], bounds.max[0]]) {
    for (const y of [bounds.min[1], bounds.max[1]]) {
      for (const z of [bounds.min[2], bounds.max[2]]) {
        corners.push(applyUpright(transform, [x, y, z]));
      }
    }
  }
  return pointBounds(corners);
}

/** The bounded proper-upright registration used only when no authored node lattice exists. */
export function deriveCatalogToBuilderSurfaceFrames(
  catalogSurfacePoints: readonly Point[],
  builderSurfacePoints: readonly Point[],
): LedgerTransform[] {
  const catalog = pointBounds(catalogSurfacePoints);
  const builder = pointBounds(builderSurfacePoints);
  const lowOffset = builder.min[1] - catalog.min[1];
  const highOffset = builder.max[1] - catalog.max[1];
  if (Math.abs(lowOffset - highOffset) > SURFACE_REGISTRATION_VERTICAL_ENDPOINT_DRIFT_LDU) {
    throw new TypeError(
      `Builder and catalog surface Y endpoints imply offsets ${lowOffset} and ${highOffset} LDU; ` +
        `their ${Math.abs(lowOffset - highOffset)} LDU disagreement exceeds the ` +
        `${SURFACE_REGISTRATION_VERTICAL_ENDPOINT_DRIFT_LDU} LDU source-surface bound.`,
    );
  }
  const measuredVertical = (lowOffset + highOffset) / 2;
  const vertical = Math.round(measuredVertical);
  if (Math.abs(measuredVertical - vertical) > 0.001) {
    throw new TypeError(
      `Builder/catalog surface registration implies non-integral vertical offset ` +
        `${measuredVertical} LDU; the local frame remains uncalibrated.`,
    );
  }
  const found: LedgerTransform[] = [];
  for (const orientation of UPRIGHT_ORIENTATIONS) {
    for (
      let x = -SURFACE_REGISTRATION_TRANSLATION_REACH_LDU;
      x <= SURFACE_REGISTRATION_TRANSLATION_REACH_LDU;
      x += SURFACE_REGISTRATION_TRANSLATION_STEP_LDU
    ) {
      for (
        let z = -SURFACE_REGISTRATION_TRANSLATION_REACH_LDU;
        z <= SURFACE_REGISTRATION_TRANSLATION_REACH_LDU;
        z += SURFACE_REGISTRATION_TRANSLATION_STEP_LDU
      ) {
        const candidate: LedgerTransform = {
          positionLdu: [x, vertical, z],
          orientationId: orientation.id,
        };
        const mapped = transformedBounds(candidate, catalog);
        if (
          [0, 1, 2].every(
            (axis) =>
              Math.abs(mapped.min[axis]! - builder.min[axis]!) <=
                SURFACE_REGISTRATION_BOX_SLACK_LDU &&
              Math.abs(mapped.max[axis]! - builder.max[axis]!) <=
                SURFACE_REGISTRATION_BOX_SLACK_LDU,
          )
        ) {
          found.push(candidate);
        }
      }
    }
  }
  return found.sort(canonicalOrder);
}

export function selectCatalogToBuilderSurfaceFrame(input: {
  readonly definition: PartDefinition;
  readonly designRevision: string;
  readonly catalogSurfacePoints: readonly Point[];
  readonly builderSurfacePoints: readonly Point[];
  readonly measure: (frame: LedgerTransform) => readonly number[];
}): FrameSelection {
  const { definition, designRevision, catalogSurfacePoints, builderSurfacePoints, measure } = input;
  const candidates = deriveCatalogToBuilderSurfaceFrames(
    catalogSurfacePoints,
    builderSurfacePoints,
  );
  if (candidates.length < 2) {
    throw new TypeError(
      `Bounded proper-upright surface registration for ${designRevision} leaves ` +
        `${candidates.length} candidate frames; at least two are required before a geometric ` +
        `winner or catalog-symmetry quotient can be measured.`,
    );
  }
  return selectFrameCandidates({
    definition,
    designRevision,
    candidates,
    measure,
    candidateDescription: "bounded proper-upright surface registration",
    uniqueMethod: "ldraw-surface-registration",
    symmetryMethod: "surface-registration-catalog-symmetry",
    witnessMethod: "ldraw-surface-registration",
    applyHardSurfaceBound: true,
  });
}

function selectFrameCandidates(input: {
  readonly definition: PartDefinition;
  readonly designRevision: string;
  readonly candidates: readonly LedgerTransform[];
  readonly measure: (frame: LedgerTransform) => readonly number[];
  readonly candidateDescription: string;
  readonly uniqueMethod: FrameSelectionMethod;
  readonly symmetryMethod: FrameSelectionMethod;
  readonly witnessMethod: FrameSelectionMethod;
  readonly applyHardSurfaceBound: boolean;
}): FrameSelection {
  const {
    definition,
    designRevision,
    candidates,
    measure,
    candidateDescription,
    uniqueMethod,
    symmetryMethod,
    witnessMethod,
    applyHardSurfaceBound,
  } = input;
  const classes: LedgerTransform[][] = [];
  let inconclusive: string | null = null;
  const equivalent = (group: LedgerTransform[], candidate: LedgerTransform): boolean => {
    try {
      return isCatalogPartSelfSymmetry(definition, residualTransform(group[0]!, candidate));
    } catch (error) {
      // A part the proof cannot describe is not a part the proof may quotient.
      // The residual stays a real ambiguity and the surface witness has to
      // settle it, which is the conservative direction: the alternative is
      // declaring two frames the same because nothing checked them.
      if (!(error instanceof InconclusiveSymmetry)) throw error;
      inconclusive = error.message;
      return false;
    }
  };
  for (const candidate of candidates) {
    const existing = classes.find((group) => equivalent(group, candidate));
    if (existing === undefined) classes.push([candidate]);
    else existing.push(candidate);
  }
  const representatives = classes.map((group) => [...group].sort(canonicalOrder)[0]!);
  if (representatives.length === 1) {
    return {
      transform: representatives[0]!,
      candidateCount: candidates.length,
      equivalenceClassCount: 1,
      method: candidates.length === 1 ? uniqueMethod : symmetryMethod,
      witnessMarginMicroRatio: null,
    };
  }
  const allScored = representatives
    .map((transform) => {
      const distances = measure(transform);
      if (
        distances.length < 1 ||
        !distances.every((value) => Number.isSafeInteger(value) && value >= 0)
      ) {
        throw new TypeError(
          `${candidateDescription} for ${designRevision} produced an empty, negative, fractional, or ` +
            `unsafe-integer micro-LDU surface measurement; exact witness arithmetic is required.`,
        );
      }
      const total = distances.reduce((sum, value) => sum + value, 0);
      if (!Number.isSafeInteger(total)) {
        throw new TypeError(
          `${candidateDescription} for ${designRevision} produced a surface-distance total outside ` +
            `safe exact integer arithmetic.`,
        );
      }
      return {
        transform,
        total,
        count: distances.length,
        mean: total / distances.length,
        maximum: Math.max(0, ...distances),
      };
    })
    .sort((left, right) => {
      const comparison =
        BigInt(left.total) * BigInt(right.count) - BigInt(right.total) * BigInt(left.count);
      return comparison < 0n
        ? -1
        : comparison > 0n
          ? 1
          : canonicalOrder(left.transform, right.transform);
    });
  const best = allScored[0]!;
  if (applyHardSurfaceBound && best.maximum > 2_000_000) {
    throw new TypeError(
      `${candidateDescription} for ${designRevision} selects a best representative whose independent ` +
        `source-surface maximum is ${best.maximum / 1_000_000} LDU; at most 2 LDU is required. ` +
        `A frame cannot be retained when its own corroboration bound fails.`,
    );
  }
  const runnerUp = allScored[1]!;
  if (best.total === 0 && runnerUp.total === 0) {
    throw new TypeError(
      `${candidateDescription} for ${designRevision} admits ${candidates.length} upright frames in ` +
        `${representatives.length} classes that ${definition.id}'s own symmetry cannot account for, and the ` +
        `independent LDraw surface witness exactly ties the best two at 0 LDU mean; ` +
        `${FRAME_WITNESS_MINIMUM_MARGIN_MICRO_RATIO / 1_000_000}x separation is required. A candidate local ` +
        `frame is not automatically the right frame, so this design stays uncalibrated rather than guessed.` +
        (inconclusive === null
          ? ""
          : ` Some residual pairs could not even be tested for symmetry: ${inconclusive}`),
    );
  }
  const exactMarginPasses =
    best.total === 0 ||
    BigInt(runnerUp.total) * BigInt(best.count) * 1_000_000n >=
      BigInt(best.total) *
        BigInt(runnerUp.count) *
        BigInt(FRAME_WITNESS_MINIMUM_MARGIN_MICRO_RATIO);
  const rawMargin = best.total === 0 ? Number.POSITIVE_INFINITY : runnerUp.mean / best.mean;
  const margin = Number.isFinite(rawMargin)
    ? Math.round(rawMargin * 1_000_000)
    : Number.POSITIVE_INFINITY;
  if (!exactMarginPasses) {
    throw new TypeError(
      `${candidateDescription} for ${designRevision} admits ${candidates.length} upright frames in ` +
        `${representatives.length} classes that ${definition.id}'s own symmetry cannot account for, and the ` +
        `independent LDraw surface witness separates the best two by only ${rawMargin}x ` +
        `(${best.mean / 1_000_000} LDU against ${runnerUp.mean / 1_000_000} LDU mean); ` +
        `${FRAME_WITNESS_MINIMUM_MARGIN_MICRO_RATIO / 1_000_000}x is required. A candidate local frame ` +
        `is not automatically the right frame, so this design stays uncalibrated rather than guessed.` +
        (inconclusive === null
          ? ""
          : ` Some residual pairs could not even be tested for symmetry: ${inconclusive}`),
    );
  }
  return {
    transform: best.transform,
    candidateCount: candidates.length,
    equivalenceClassCount: representatives.length,
    method: witnessMethod,
    witnessMarginMicroRatio: Number.isFinite(margin) ? margin : "infinite",
  };
}
