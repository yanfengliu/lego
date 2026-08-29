import { describe, expect, it } from "vitest";

import type { MeasuredPartBlueprint, MeasuredSourceConnectorRow } from "./measured-part-types.ts";
import type { PartDefinition } from "./types.ts";

import { getPartDefinition, validateMeshPartDefinitionAdmission } from "./index.js";
import { makeMeasuredPartDefinition } from "./measured-part-factory.ts";
import { SET_6651557_MEASURED_BLUEPRINTS_H } from "./part-blueprints-6651557-measured-h.ts";

const PART_ID = "builtin:brick-1x2x2-inside-axle-holder";

function blueprint(): MeasuredPartBlueprint {
  const value: MeasuredPartBlueprint | undefined = SET_6651557_MEASURED_BLUEPRINTS_H.find(
    ({ designId }) => designId === "3245b",
  );
  if (value === undefined) throw new Error("Catalog /29 must declare exact 3245b");
  return value;
}

function unsafeSource(value: unknown): MeasuredSourceConnectorRow {
  return value as MeasuredSourceConnectorRow;
}

describe("3245b blind axle-holder contract", () => {
  it("retains the exact one-sided source span in the admitted connector", () => {
    expect(blueprint().sourceConnectorsLdu).toEqual([
      {
        kind: "blindAxleHole",
        positionLdu: [0, 2, 0],
        normal: [0, 1, 0],
        axialSpan: {
          schemaVersion: "connector-axial-span/1",
          openEndLdu: [0, 24, 0],
          closedEndLdu: [0, -20, 0],
          depthLdu: 44,
          sliding: false,
        },
      },
    ]);
    const definition = getPartDefinition(PART_ID)!;
    expect(definition.connectors.find(({ kind }) => kind === "blindAxleHole")).toMatchObject({
      id: "blindAxleHole:0",
      geometryRole: "axleBore",
      profileId: "axle-cross/1",
      gender: "female",
      compatibleKinds: ["axle"],
      axialSpan: blueprint().sourceConnectorsLdu?.[0]?.axialSpan,
    });
    expect(validateMeshPartDefinitionAdmission(definition)).toEqual({ accepted: true, issues: [] });
  });

  it("rejects missing, direction-reversed, off-midpoint, sliding, and through-hole spans", () => {
    const base = blueprint();
    const span = {
      schemaVersion: "connector-axial-span/1",
      openEndLdu: [0, 24, 0],
      closedEndLdu: [0, -20, 0],
      depthLdu: 44,
      sliding: false,
    } as const;
    const compile = (source: unknown) =>
      makeMeasuredPartDefinition({ ...base, sourceConnectorsLdu: [unsafeSource(source)] });

    expect(() =>
      compile({ kind: "blindAxleHole", positionLdu: [0, 2, 0], normal: [0, 1, 0] }),
    ).toThrow(/requires an axialSpan object/u);
    expect(() =>
      compile({
        kind: "blindAxleHole",
        positionLdu: [0, 2, 0],
        normal: [0, -1, 0],
        axialSpan: span,
      }),
    ).toThrow(/normal must point from the closed end to the open mouth/u);
    expect(() =>
      compile({
        kind: "blindAxleHole",
        positionLdu: [0, 3, 0],
        normal: [0, 1, 0],
        axialSpan: span,
      }),
    ).toThrow(/exact midpoint/u);
    expect(() =>
      compile({
        kind: "blindAxleHole",
        positionLdu: [0, 2, 0],
        normal: [0, 1, 0],
        axialSpan: { ...span, sliding: true },
      }),
    ).toThrow(/preserve slide=false/u);
    expect(() =>
      compile({ kind: "axleHole", positionLdu: [0, 2, 0], normal: [0, 1, 0], axialSpan: span }),
    ).toThrow(/kind axleHole is not one-sided/u);
    expect(() =>
      compile({
        kind: "blindAxleHole",
        positionLdu: [0, 2, 0],
        normal: [0, 1, 0],
        axialSpan: {
          ...span,
          openEndLdu: [0, 30, 0],
          closedEndLdu: [0, -26, 0],
          depthLdu: 56,
        },
      }),
    ).toThrow(/outside body bounds/u);
  });

  it("makes the production admission gate reject a blind socket with erased span evidence", () => {
    const valid = getPartDefinition(PART_ID)!;
    const invalid = {
      ...valid,
      connectors: valid.connectors.map((connector) =>
        connector.kind === "blindAxleHole"
          ? (() => {
              const erased = { ...connector } as Partial<typeof connector>;
              Reflect.deleteProperty(erased, "axialSpan");
              return erased;
            })()
          : connector,
      ),
    } as unknown as PartDefinition;

    expect(validateMeshPartDefinitionAdmission(invalid).issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "MESH_ADMISSION_CONNECTOR_INVALID",
          message: expect.stringContaining("blindAxleHole requires an axialSpan object"),
        }),
      ]),
    );

    const outOfBody = {
      ...valid,
      connectors: valid.connectors.map((connector) =>
        connector.kind !== "blindAxleHole"
          ? connector
          : {
              ...connector,
              positionLdu: [0, 2, 0] as const,
              axialSpan: {
                ...connector.axialSpan,
                openEndLdu: [0, 30, 0] as const,
                closedEndLdu: [0, -26, 0] as const,
                depthLdu: 56,
              },
            },
      ),
    };
    expect(validateMeshPartDefinitionAdmission(outOfBody).issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "MESH_ADMISSION_CONNECTOR_INVALID" }),
      ]),
    );
  });
});
