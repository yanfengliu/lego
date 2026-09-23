import { describe, expect, it } from "vitest";

import { makeMeasuredPartDefinition } from "./measured-part-factory.ts";
import type {
  MeasuredClutchPortSemanticRow,
  MeasuredPartBlueprint,
} from "./measured-part-types.ts";
import { SET_6651557_MEASURED_BLUEPRINTS } from "./part-blueprints-6651557-measured.ts";

const legacy: MeasuredPartBlueprint = SET_6651557_MEASURED_BLUEPRINTS.find(
  ({ designId }) => designId === "99563",
)!;
const { clutchSharedCapacityGroupIds: legacyGroups, ...withoutLegacyGroups } = legacy;

function blueprint(rows: unknown): MeasuredPartBlueprint {
  return {
    ...withoutLegacyGroups,
    clutchPortSemantics: rows,
  } as unknown as MeasuredPartBlueprint;
}

const VALID_ROWS = [
  {
    positionLdu: [0, 4, -10],
    id: "undersideClutch:0:0",
    sharedCapacityGroupIds: ["negative"],
  },
  {
    positionLdu: [0, 4, 0],
    id: "undersideClutch:center",
    sharedCapacityGroupIds: ["negative", "positive"],
  },
  {
    positionLdu: [0, 4, 10],
    id: "undersideClutch:0:1",
    sharedCapacityGroupIds: ["positive"],
  },
] as const satisfies readonly MeasuredClutchPortSemanticRow[];

describe("measured clutch port semantics", () => {
  it("keeps explicit stable ids and derives each allowance id from the full suffix", () => {
    const part = makeMeasuredPartDefinition(blueprint(VALID_ROWS));
    const clutches = part.connectors.filter(({ kind }) => kind === "undersideClutch");

    expect(clutches.map(({ id }) => id)).toEqual([
      "undersideClutch:0:0",
      "undersideClutch:center",
      "undersideClutch:0:1",
    ]);
    expect(clutches.map(({ sharedCapacityGroupIds }) => sharedCapacityGroupIds)).toEqual([
      ["negative"],
      ["negative", "positive"],
      ["positive"],
    ]);
    expect(part.collision.allowances.map(({ id, portId }) => ({ id, portId }))).toEqual([
      { id: "tubeSeat:0:0", portId: "undersideClutch:0:0" },
      { id: "tubeSeat:center", portId: "undersideClutch:center" },
      { id: "tubeSeat:0:1", portId: "undersideClutch:0:1" },
    ]);
  });

  it("leaves legacy index ids and allowance ids unchanged when semantics are absent", () => {
    const part = makeMeasuredPartDefinition(legacy);

    expect(
      part.connectors.filter(({ kind }) => kind === "undersideClutch").map(({ id }) => id),
    ).toEqual(["undersideClutch:0", "undersideClutch:1", "undersideClutch:2"]);
    expect(part.collision.allowances.map(({ id }) => id)).toEqual([
      "tubeSeat:0",
      "tubeSeat:1",
      "tubeSeat:2",
    ]);
  });

  it("refuses missing rows, malformed ids, duplicate ids, and ambiguous capacity groups", () => {
    expect(() => makeMeasuredPartDefinition(blueprint(VALID_ROWS.slice(0, 2)))).toThrow(
      /2 stable clutch semantic rows for 3 underside clutches.*aligned one-for-one/u,
    );

    for (const invalidId of ["stud:0", "undersideClutch:", "undersideClutch:bad id"]) {
      const rows = VALID_ROWS.map((row, index) => (index === 1 ? { ...row, id: invalidId } : row));
      expect(() => makeMeasuredPartDefinition(blueprint(rows))).toThrow(
        /require undersideClutch:<non-empty colon-separated token>/u,
      );
    }

    const duplicateIds = VALID_ROWS.map((row, index) =>
      index === 1 ? { ...row, id: VALID_ROWS[0].id } : row,
    );
    expect(() => makeMeasuredPartDefinition(blueprint(duplicateIds))).toThrow(
      /repeats connector id undersideClutch:0:0/u,
    );

    for (const groups of [[], [""], ["same", "same"]]) {
      const rows = VALID_ROWS.map((row, index) =>
        index === 1 ? { ...row, sharedCapacityGroupIds: groups } : row,
      );
      expect(() => makeMeasuredPartDefinition(blueprint(rows))).toThrow(
        /when present they must be non-empty unique text/u,
      );
    }
  });

  it("refuses shuffled identities or a position witness that differs from its measured seat", () => {
    expect(() =>
      makeMeasuredPartDefinition(blueprint([VALID_ROWS[2], VALID_ROWS[1], VALID_ROWS[0]])),
    ).toThrow(/row 0 witnesses positionLdu \[0,4,10\].*source seat 0 is \[0, 4, -10\]/u);

    const mismatched = VALID_ROWS.map((row, index) =>
      index === 1 ? { ...row, positionLdu: [0, 4, 1] as const } : row,
    );
    expect(() => makeMeasuredPartDefinition(blueprint(mismatched))).toThrow(
      /row 1 witnesses positionLdu \[0,4,1\].*source seat 1 is \[0, 4, 0\]/u,
    );
  });

  it("refuses declarations whose stable and legacy rows both claim capacity semantics", () => {
    expect(() =>
      makeMeasuredPartDefinition({
        ...legacy,
        clutchPortSemantics: VALID_ROWS,
        clutchSharedCapacityGroupIds: legacyGroups!,
      }),
    ).toThrow(/declares both stable clutch semantics and legacy clutch shared-capacity rows/u);
  });
});
