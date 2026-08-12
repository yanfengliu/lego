import type { PartDefinition } from "@lego-studio/catalog";
import type { RigidTransform } from "@lego-studio/protocol";

import {
  catalogPartRealizationMatches,
  catalogPartUprightSelfSymmetries,
  type CatalogPartRealizationComparison,
} from "./real-build-catalog-realization";
import {
  composeFrameTransforms,
  frameTransformKey,
  invertFrameTransform,
  rigidTransformToFrameTransform,
  type FrameTransform,
} from "./real-build-catalog-frame";

const IDENTITY_FRAME: FrameTransform = {
  matrix: [1, 0, 0, 0, 1, 0, 0, 0, 1],
  translationLdu: [0, 0, 0],
};

export interface TargetRealizationCacheStats {
  readonly selfSymmetryEvaluations: number;
  readonly comparisonEvaluations: number;
  readonly comparisonHits: number;
}

export interface TargetRealizationCache {
  selfSymmetries(definition: PartDefinition): readonly RigidTransform[];
  properOrbitKey(definition: PartDefinition, world: FrameTransform): string | null;
  compare(
    definition: PartDefinition,
    leftWorld: FrameTransform,
    rightWorld: FrameTransform,
  ): CatalogPartRealizationComparison;
  stats(): TargetRealizationCacheStats;
}

/**
 * Per-audit realization cache. Equality is invariant under applying the same
 * D4 frame to both sides, so comparison keys use `left^-1 . right`: repeated
 * copies regenerate one catalog surface per distinct residual, not once per
 * identity pair or matching-path revisit.
 */
export function createTargetRealizationCache(): TargetRealizationCache {
  const symmetries = new WeakMap<PartDefinition, readonly RigidTransform[]>();
  const comparisons = new WeakMap<PartDefinition, Map<string, CatalogPartRealizationComparison>>();
  let selfSymmetryEvaluations = 0;
  let comparisonEvaluations = 0;
  let comparisonHits = 0;

  const selfSymmetries = (definition: PartDefinition): readonly RigidTransform[] => {
    const retained = symmetries.get(definition);
    if (retained !== undefined) return retained;
    selfSymmetryEvaluations += 1;
    const proven = catalogPartUprightSelfSymmetries(definition);
    symmetries.set(definition, proven);
    return proven;
  };

  const compare = (
    definition: PartDefinition,
    leftWorld: FrameTransform,
    rightWorld: FrameTransform,
  ): CatalogPartRealizationComparison => {
    const residual = composeFrameTransforms(invertFrameTransform(leftWorld), rightWorld);
    const key = frameTransformKey(residual);
    const byResidual = comparisons.get(definition) ?? new Map();
    const retained = byResidual.get(key);
    if (retained !== undefined) {
      comparisonHits += 1;
      return retained;
    }
    comparisonEvaluations += 1;
    const comparison = catalogPartRealizationMatches(definition, IDENTITY_FRAME, residual);
    byResidual.set(key, comparison);
    comparisons.set(definition, byResidual);
    return comparison;
  };

  const properOrbitKey = (definition: PartDefinition, world: FrameTransform): string | null =>
    selfSymmetries(definition)
      .map((symmetry) =>
        frameTransformKey(composeFrameTransforms(world, rigidTransformToFrameTransform(symmetry))),
      )
      .sort((left, right) => left.localeCompare(right))[0] ?? null;

  return {
    selfSymmetries,
    properOrbitKey,
    compare,
    stats: () => ({ selfSymmetryEvaluations, comparisonEvaluations, comparisonHits }),
  };
}
