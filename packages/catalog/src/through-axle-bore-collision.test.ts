import { describe, expect, it } from "vitest";

import { getPartDefinition } from "./catalog.ts";
import { makeMeasuredPartDefinition } from "./measured-part-factory.ts";
import type { MeasuredPartBlueprint } from "./measured-part-types.ts";
import { validateMeshPartDefinitionAdmission } from "./mesh-admission.ts";
import { SET_6651557_MEASURED_BLUEPRINTS } from "./part-blueprints-6651557-measured.ts";
import type { PartDefinition } from "./types.ts";

const ELIGIBLE_IDS = [
  "builtin:technic-brick-1x2-axle-hole",
  "builtin:technic-brick-1x1-axle-hole",
] as const;

function blueprint(designId: string): MeasuredPartBlueprint {
  const value = SET_6651557_MEASURED_BLUEPRINTS.find(
    (candidate) => candidate.designId === designId,
  );
  if (!value) throw new Error(`Missing measured blueprint ${designId}`);
  return value;
}

function unsafeBlueprint(value: unknown): MeasuredPartBlueprint {
  return value as MeasuredPartBlueprint;
}

function unsafePart(value: unknown): PartDefinition {
  return value as PartDefinition;
}

describe("measured through axle-bore collision admission", () => {
  it("retains one exact A6x1 region on 32064 and 73230, but none on blind 3245b", () => {
    expect(
      ELIGIBLE_IDS.map((id) => getPartDefinition(id)!.collision.throughAxleBoreAllowances),
    ).toEqual([
      [
        expect.objectContaining({
          schemaVersion: "collision-through-axle-bore-allowance/1",
          portId: "axleHole:0",
          sourceSection: "A 6 1",
          startLdu: [-10, -2, 0],
          endLdu: [10, -2, 0],
          radiusLdu: 6,
          segmentLengthLdu: 20,
          caps: "none",
          sliding: true,
          requiresValidatedConnection: true,
        }),
      ],
      [
        expect.objectContaining({
          schemaVersion: "collision-through-axle-bore-allowance/1",
          portId: "axleHole:0",
          sourceSection: "A 6 1",
          startLdu: [10, -2, 0],
          endLdu: [-10, -2, 0],
          radiusLdu: 6,
          segmentLengthLdu: 20,
          caps: "none",
          sliding: true,
          requiresValidatedConnection: true,
        }),
      ],
    ]);
    expect(
      getPartDefinition("builtin:brick-1x2x2-inside-axle-holder")!.collision
        .throughAxleBoreAllowances,
    ).toBeUndefined();
  });

  it("refuses missing, malformed, displaced, or wrongly scoped measured evidence", () => {
    const original = blueprint("32064");
    const source = original.sourceConnectorsLdu![0]!;
    const evidence = source.kind === "axleHole" ? source.throughBoreCollision : undefined;
    if (!evidence) throw new Error("32064 has no through-bore source evidence");
    const malformed = [
      { ...source, throughBoreCollision: undefined },
      { ...source, throughBoreCollision: { ...evidence, radiusLdu: 7 } },
      { ...source, throughBoreCollision: { ...evidence, caps: "one" } },
      {
        ...source,
        throughBoreCollision: { ...evidence, startLdu: [-9, -2, 0] },
      },
      {
        ...source,
        throughBoreCollision: { ...evidence, endLdu: [11, -2, 0] },
      },
    ];
    for (const candidate of malformed) {
      expect(() =>
        makeMeasuredPartDefinition(
          unsafeBlueprint({ ...original, sourceConnectorsLdu: [candidate] }),
        ),
      ).toThrow(/through axle-bore|throughBoreCollision|bore segment|measured-through-axle-bore/);
    }

    const blind = blueprint("3245b");
    const blindSource = blind.sourceConnectorsLdu![0]!;
    expect(() =>
      makeMeasuredPartDefinition(
        unsafeBlueprint({
          ...blind,
          sourceConnectorsLdu: [{ ...blindSource, throughBoreCollision: evidence }],
        }),
      ),
    ).toThrow(/only an exact through axleHole/);
  });

  it("fails closed when production collision rows are erased, duplicated, forged, or malformed", () => {
    const through = getPartDefinition(ELIGIBLE_IDS[0])!;
    const allowance = through.collision.throughAxleBoreAllowances![0]!;
    const variants = [
      { ...through.collision, throughAxleBoreAllowances: undefined },
      { ...through.collision, throughAxleBoreAllowances: [allowance, allowance] },
      {
        ...through.collision,
        throughAxleBoreAllowances: [{ ...allowance, portId: "axleHole:forged" }],
      },
      {
        ...through.collision,
        throughAxleBoreAllowances: [{ ...allowance, segmentLengthLdu: 21 }],
      },
      { ...through.collision, throughAxleBoreAllowances: { ...allowance } },
    ];
    for (const collision of variants) {
      const result = validateMeshPartDefinitionAdmission(unsafePart({ ...through, collision }));
      expect(result.accepted).toBe(false);
      expect(result.issues.map(({ code }) => code)).toEqual(
        expect.arrayContaining([
          expect.stringMatching(
            /MESH_ADMISSION_(?:COLLISION_INVALID|CONNECTOR_COLLISION_MISMATCH)/,
          ),
        ]),
      );
    }

    const blind = getPartDefinition("builtin:brick-1x2x2-inside-axle-holder")!;
    const result = validateMeshPartDefinitionAdmission(
      unsafePart({
        ...blind,
        collision: { ...blind.collision, throughAxleBoreAllowances: [allowance] },
      }),
    );
    expect(result.accepted).toBe(false);
    expect(result.issues.map(({ code }) => code)).toContain("MESH_ADMISSION_COLLISION_INVALID");
  });
});
