import { createPartInstance } from "@lego-studio/brick-kernel";
import type { PartInstance } from "@lego-studio/protocol";
import { describe, expect, it } from "vitest";

import { composeBuilderTransforms, resolveBuilderBoneTransform } from "../e2e/real-build-official";
import type { BuilderBoneTransform } from "../e2e/real-build-official";
import { assessSupport, findBodyOverlaps, findStudConnections } from "../src/placement";

/**
 * Three LXFML Bones that are only a model under one reading of the basis.
 *
 * The mirror this guards was invisible for as long as it was because every
 * check that could have seen it was a check of one part against its own
 * surface: a design's Builder Shell measured against its own expanded LDraw
 * geometry agrees exactly as well in a mirrored world as in a real one, because
 * both sides move together. So does a lattice check, a residual check, and a
 * digest. What a reflection cannot survive is other parts — the model has to
 * still hold itself up.
 *
 * These are raw Bone rows, not a transform written twice. Nothing in this file
 * names the basis; the fixture is asserted by placing what it resolves to and
 * asking the editor's own support rule whether the result would stay put. Under
 * the correct reading the three plates interlock into one body. Under the
 * mirrored reading the exact same three Bones put two of them in mid-air, which
 * the editor refuses at the command.
 *
 * The fixture is chiral on purpose, in both halves of the basis at once. The
 * quarter-turned wedge plate is a *right* wedge, whose footprint has no
 * 180-degree symmetry to hide behind, and every Bone carries a non-zero z, so a
 * change that corrected the rotation without the position, or the position
 * without the rotation, fails here too rather than trading one wrong answer for
 * another.
 */
const CHIRAL_BONES = [
  {
    catalogPartId: "builtin:corner-plate-5x5-quarter-ring",
    bone: { matrix: [1, 0, 0, 0, 1, 0, 0, 0, 1], position: [0, -0.32, 0] },
  },
  {
    catalogPartId: "builtin:corner-plate-4x4-round",
    bone: { matrix: [1, 0, 0, 0, 1, 0, 0, 0, 1], position: [1.6, 0, 1.6] },
  },
  {
    catalogPartId: "builtin:wedge-plate-3x6-right",
    bone: { matrix: [0, 0, -1, 0, 1, 0, 1, 0, 0], position: [-2.4, 0, 3.6] },
  },
] as const satisfies readonly {
  readonly catalogPartId: string;
  readonly bone: {
    readonly matrix: readonly number[];
    readonly position: readonly [number, number, number];
  };
}[];

/**
 * The mirror the repository read the model through until 2026-08-07: the Bone
 * position's z kept its sign, and the rotation was conjugated by a reflection
 * rather than a rotation, which exchanges the two quarter turns. Applied to a
 * resolved transform the pair is exactly that difference, so the counterfactual
 * below runs the same fixture through the reading this change replaced.
 */
const MIRRORED_YAW: Readonly<Record<string, string>> = {
  "upright-yaw-0": "upright-yaw-0",
  "upright-yaw-90": "upright-yaw-270",
  "upright-yaw-180": "upright-yaw-180",
  "upright-yaw-270": "upright-yaw-90",
};

function resolvedParts(mirrored: boolean): readonly PartInstance[] {
  return CHIRAL_BONES.map(({ catalogPartId, bone }, index) => {
    const resolved = resolveBuilderBoneTransform({
      ...bone,
      sourceDigest: `sha256:${String(index).repeat(64)}`,
    } as unknown as BuilderBoneTransform);
    if (resolved.transform === null) throw new TypeError(resolved.failure ?? "unresolved Bone");
    // An identity design frame keeps this test on the world half of the map.
    // Composition is exercised so the assertion covers the same path
    // `applyBuilderCanonicalCalibration` takes, not a shortcut around it.
    const composed = composeBuilderTransforms(resolved.transform, {
      positionLdu: [0, 0, 0],
      orientationId: "upright-yaw-0",
    });
    if (composed === null) throw new TypeError("composition produced no upright transform");
    const [x, y, z] = composed.positionLdu;
    return createPartInstance({
      id: `bone-${index}`,
      catalogPartId,
      colorId: "builtin:light-bluish-gray",
      transform: mirrored
        ? { positionLdu: [x, y, -z], orientationId: MIRRORED_YAW[composed.orientationId]! }
        : composed,
    });
  });
}

function physicalVerdict(parts: readonly PartInstance[]): readonly string[] {
  return parts.map((candidate) => {
    const others = parts.filter(({ id }) => id !== candidate.id);
    const connections = findStudConnections(candidate, others);
    const support = assessSupport(candidate, connections);
    return (
      `${candidate.catalogPartId} ${candidate.transform.positionLdu.join("/")} ` +
      `${candidate.transform.orientationId} connections=${connections.length} ` +
      `${support.supported ? `held-by-${support.held}` : "REFUSED"} ` +
      `overlaps=${findBodyOverlaps(candidate, others).length}`
    );
  });
}

describe("LXFML Bone basis", () => {
  it("resolves a chiral Bone trio into an assembly that holds itself up", () => {
    expect(physicalVerdict(resolvedParts(false))).toEqual([
      "builtin:corner-plate-5x5-quarter-ring 0/8/0 upright-yaw-0 connections=4 held-by-connections overlaps=0",
      "builtin:corner-plate-4x4-round 40/0/-40 upright-yaw-0 connections=3 held-by-connections overlaps=0",
      "builtin:wedge-plate-3x6-right -60/0/-90 upright-yaw-270 connections=1 held-by-connections overlaps=0",
    ]);
  });

  it("refuses the same three Bones read through the mirror", () => {
    // Absence needs its own outcome. Without this the first assertion could
    // pass because `assessSupport` had stopped saying no, and nothing would
    // notice that the fixture had lost its power to discriminate.
    expect(physicalVerdict(resolvedParts(true))).toEqual([
      "builtin:corner-plate-5x5-quarter-ring 0/8/0 upright-yaw-0 connections=0 held-by-build-plate overlaps=0",
      "builtin:corner-plate-4x4-round 40/0/40 upright-yaw-0 connections=0 REFUSED overlaps=0",
      "builtin:wedge-plate-3x6-right -60/0/90 upright-yaw-90 connections=0 REFUSED overlaps=0",
    ]);
  });
});
