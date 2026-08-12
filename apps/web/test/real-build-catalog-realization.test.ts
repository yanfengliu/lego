import { getPartDefinition } from "@lego-studio/catalog";
import { describe, expect, it } from "vitest";

import {
  catalogPartUprightSelfSymmetries,
  catalogPartRealizationMatches,
  composeFrameTransforms,
  isCatalogPartUprightSelfSymmetry,
  rigidTransformToFrameTransform,
} from "../e2e/real-build-catalog-realization";
import { createTargetRealizationCache } from "../e2e/real-build-target-realization-cache";

const IDENTITY = rigidTransformToFrameTransform({
  positionLdu: [0, 0, 0],
  orientationId: "upright-yaw-0",
});
const HALF_TURN = {
  positionLdu: [0, 0, 0] as const,
  orientationId: "upright-yaw-180",
};

function requirePart(id: string) {
  const definition = getPartDefinition(id);
  if (definition === undefined) throw new Error(`Test catalog is missing ${id}.`);
  return definition;
}

describe("catalog part realization equivalence", () => {
  it.each(["builtin:brick-1x2", "builtin:plate-4x6"])(
    "proves the complete half-turn self-symmetry of %s",
    (catalogPartId) => {
      const definition = requirePart(catalogPartId);
      const comparison = catalogPartRealizationMatches(
        definition,
        IDENTITY,
        rigidTransformToFrameTransform(HALF_TURN),
      );

      expect(comparison).toMatchObject({
        matches: true,
        layers: {
          connectors: { matches: true, supported: true },
          collision: { matches: true, supported: true },
          allowances: { matches: true, supported: true },
          bounds: { matches: true, supported: true },
          render: { matches: true, supported: true },
        },
        witness: null,
      });
      expect(isCatalogPartUprightSelfSymmetry(definition, HALF_TURN)).toBe(true);
      expect(catalogPartUprightSelfSymmetries(definition)).toContainEqual(HALF_TURN);
    },
  );

  it("rejects a wedge half turn as a different structural and visible realization", () => {
    const definition = requirePart("builtin:wedge-plate-2x4-left");
    const comparison = catalogPartRealizationMatches(
      definition,
      IDENTITY,
      rigidTransformToFrameTransform(HALF_TURN),
    );

    expect(comparison.matches).toBe(false);
    expect(comparison.layers.collision).toMatchObject({ matches: false, supported: true });
    expect(comparison.layers.render).toMatchObject({ matches: false, supported: true });
    expect(comparison.witness).toMatch(/^connectors:|^collision:/);
    expect(isCatalogPartUprightSelfSymmetry(definition, HALF_TURN)).toBe(false);
  });

  it("fails closed when the render layer is disabled", () => {
    const definition = requirePart("builtin:brick-1x2");
    const comparison = catalogPartRealizationMatches(
      definition,
      IDENTITY,
      rigidTransformToFrameTransform(HALF_TURN),
      { includeRender: false },
    );

    expect(comparison.matches).toBe(false);
    expect(comparison.layers.render).toMatchObject({ matches: false, supported: false });
    expect(comparison.witness).toContain("complete catalog realization equivalence is unproved");
  });

  it("derives the compensating translation for an off-origin complete symmetry", () => {
    const base = requirePart("builtin:brick-1x2");
    const shifted = {
      ...base,
      id: "test:off-origin-brick-1x2",
      connectors: base.connectors.map((connector) => ({
        ...connector,
        positionLdu: [
          connector.positionLdu[0] + 20,
          connector.positionLdu[1],
          connector.positionLdu[2],
        ] as const,
      })),
      collision: {
        ...base.collision,
        primitives: base.collision.primitives.map((primitive) => {
          if (primitive.kind === "box") {
            return {
              ...primitive,
              minLdu: [primitive.minLdu[0] + 20, primitive.minLdu[1], primitive.minLdu[2]] as const,
              maxLdu: [primitive.maxLdu[0] + 20, primitive.maxLdu[1], primitive.maxLdu[2]] as const,
            };
          }
          if (primitive.kind === "cylinder") {
            return {
              ...primitive,
              centerLdu: [
                primitive.centerLdu[0] + 20,
                primitive.centerLdu[1],
                primitive.centerLdu[2],
              ] as const,
            };
          }
          return primitive;
        }),
        allowances: base.collision.allowances.map((allowance) => ({
          ...allowance,
          centerLdu: [
            allowance.centerLdu[0] + 20,
            allowance.centerLdu[1],
            allowance.centerLdu[2],
          ] as const,
        })),
      },
      bodyBoundsLdu: {
        min: [
          base.bodyBoundsLdu.min[0] + 20,
          base.bodyBoundsLdu.min[1],
          base.bodyBoundsLdu.min[2],
        ] as const,
        max: [
          base.bodyBoundsLdu.max[0] + 20,
          base.bodyBoundsLdu.max[1],
          base.bodyBoundsLdu.max[2],
        ] as const,
      },
      boundsLdu: {
        min: [base.boundsLdu.min[0] + 20, base.boundsLdu.min[1], base.boundsLdu.min[2]] as const,
        max: [base.boundsLdu.max[0] + 20, base.boundsLdu.max[1], base.boundsLdu.max[2]] as const,
      },
    };

    expect(catalogPartUprightSelfSymmetries(shifted)).toContainEqual({
      positionLdu: [40, 0, 0],
      orientationId: "upright-yaw-180",
    });
  });

  it("caches complete comparisons by algebraic relative frame", () => {
    const definition = requirePart("builtin:brick-1x2");
    const cache = createTargetRealizationCache();
    const residual = rigidTransformToFrameTransform(HALF_TURN);
    const shiftedLeft = rigidTransformToFrameTransform({
      positionLdu: [100, -24, 40],
      orientationId: "upright-yaw-90",
    });
    const shiftedRight = composeFrameTransforms(shiftedLeft, residual);

    const first = cache.compare(definition, IDENTITY, residual);
    const repeated = cache.compare(definition, shiftedLeft, shiftedRight);
    cache.selfSymmetries(definition);
    cache.selfSymmetries(definition);

    expect(first).toBe(repeated);
    expect(first.matches).toBe(true);
    expect(cache.properOrbitKey(definition, IDENTITY)).toBe(
      cache.properOrbitKey(definition, residual),
    );
    expect(cache.stats()).toEqual({
      selfSymmetryEvaluations: 1,
      comparisonEvaluations: 1,
      comparisonHits: 1,
    });
  });
});
