import { describe, expect, it } from "vitest";

import { makeMeasuredPartDefinition, MEASURED_PART_DEFINITIONS } from "./measured-part-factory.ts";
import { SET_6651557_NOMINAL_STUD_SOURCE_CLASS } from "./measured-stud-source-class-6651557.ts";
import {
  isNominalStudSourceRoundingClass,
  NOMINAL_STUD_TUBE_VALIDATED_CONNECTION_PROFILE,
} from "./measured-stud.ts";
import type { MeasuredPartBlueprint } from "./measured-part-types.ts";
import { SET_6651557_MEASURED_BLUEPRINTS } from "./part-blueprints-6651557-measured.ts";
import { PART_DEFINITIONS } from "./part-factory.ts";

type ConnectorAuthority = "builder" | "builder-connectivity" | "ldcad-shadow";

const PROFILE_CLASS_INVENTORY = [
  ["35480", "builder", 2],
  ["51739", "builder", 4],
  ["77844", "builder", 5],
  ["30357", "ldcad-shadow", 8],
  ["2450", "ldcad-shadow", 6],
  ["79491", "ldcad-shadow", 2],
  ["30503", "ldcad-shadow", 10],
  ["6106", "ldcad-shadow", 26],
  ["30565", "ldcad-shadow", 11],
  ["80015", "builder-connectivity", 5],
  ["28802", "ldcad-shadow", 6],
  ["11253", "ldcad-shadow", 1],
  ["15254", "builder", 6],
  ["41682", "ldcad-shadow", 2],
  ["2877", "builder", 2],
  ["3040", "builder", 1],
  ["32064", "ldcad-shadow", 2],
  ["11212", "ldcad-shadow", 9],
  ["33909", "ldcad-shadow", 2],
  ["78329", "ldcad-shadow", 5],
  ["73230", "ldcad-shadow", 1],
  ["3245c", "ldcad-shadow", 2],
  ["2453b", "ldcad-shadow", 1],
  ["10201", "ldcad-shadow", 6],
  ["3245b", "ldcad-shadow", 2],
  ["15573", "ldcad-shadow", 1],
] as const satisfies readonly (readonly [string, ConnectorAuthority, number])[];

const NO_STUD_BLUEPRINTS = [
  "5092",
  "93273",
  "25269",
  "35787",
  "4519",
  "99563",
  "35464",
  "49307",
] as const;

const RENDER_ONLY_PHYSICAL_OVERRIDE_DESIGNS = ["30503", "6106", "30565", "80015"] as const;

const NEW_LIVE_PROFILE_INVENTORY = [
  ["2450", "builtin:wedge-plate-3x3-cut-corner", 6],
  ["79491", "builtin:corner-plate-2x2-round", 2],
  ["28802", "builtin:bracket-1x2-1x4-rounded-bottom", 6],
  ["15254", "builtin:arch-1x6-thin-top", 6],
  ["41682", "builtin:bracket-2x2-1x2-vertical-studs", 2],
  ["2877", "builtin:brick-1x2-grille", 2],
  ["32064", "builtin:technic-brick-1x2-axle-hole", 2],
] as const;

function catalogId(blueprint: MeasuredPartBlueprint): string {
  const variant = blueprint.variant === undefined ? "" : `-${blueprint.variant}`;
  return (
    blueprint.catalogId ??
    `builtin:${blueprint.family}-${blueprint.widthStuds}x${blueprint.lengthStuds}${variant}`
  );
}

function connectorAuthority(blueprint: MeasuredPartBlueprint): ConnectorAuthority {
  const sources = [
    ["builder", blueprint.builderSource !== undefined],
    ["builder-connectivity", blueprint.builderConnectivitySource !== undefined],
    ["ldcad-shadow", blueprint.ldcadShadowSource !== undefined],
  ].filter(([, present]) => present);
  if (sources.length !== 1) {
    throw new Error(
      `Measured blueprint ${blueprint.designId} exposes ${sources.length} connector authorities; expected exactly one.`,
    );
  }
  return sources[0]![0] as ConnectorAuthority;
}

function withoutProfile(blueprint: MeasuredPartBlueprint): MeasuredPartBlueprint {
  const copy = { ...blueprint };
  delete copy.validatedConnectionStudProfile;
  return copy;
}

describe("measured source-rounded nominal stud profile completeness", () => {
  const rounded = (SET_6651557_MEASURED_BLUEPRINTS as readonly MeasuredPartBlueprint[]).filter(
    ({ studsLdu }) => studsLdu.some(isNominalStudSourceRoundingClass),
  );

  it("pins the exact 26-blueprint R6x4 generator and connector-authority census", () => {
    expect(
      rounded.map((blueprint) => [
        blueprint.designId,
        connectorAuthority(blueprint),
        blueprint.studsLdu.length,
      ]),
    ).toEqual(PROFILE_CLASS_INVENTORY);
    expect(rounded).toHaveLength(26);
    expect(rounded.reduce((count, blueprint) => count + blueprint.studsLdu.length, 0)).toBe(128);
    expect(
      SET_6651557_MEASURED_BLUEPRINTS.filter(({ studsLdu }) => studsLdu.length === 0).map(
        ({ designId }) => designId,
      ),
    ).toEqual(NO_STUD_BLUEPRINTS);
    for (const blueprint of rounded) {
      expect(blueprint.studsLdu.every(isNominalStudSourceRoundingClass)).toBe(true);
    }
  });

  it("binds every reviewed design to code-generated checksum-pinned visible-stud ancestry", () => {
    expect(
      SET_6651557_NOMINAL_STUD_SOURCE_CLASS.map(
        ({ designId, connectorAuthority: authority, studCount }) => [
          designId,
          authority,
          studCount,
        ],
      ),
    ).toEqual(PROFILE_CLASS_INVENTORY);
    for (const row of SET_6651557_NOMINAL_STUD_SOURCE_CLASS) {
      expect(row.visibleStudSources.length, row.designId).toBeGreaterThan(0);
      for (const source of row.visibleStudSources) {
        expect(source.archiveId, row.designId).toBe("official");
        expect(source.path, row.designId).toMatch(/^p\/(?:stud|stug)/u);
        expect(source.sha256, `${row.designId}/${source.path}`).toMatch(/^sha256:[0-9a-f]{64}$/u);
      }
    }
  });

  it("carries the profile at definition level and on every measured stud cylinder", () => {
    for (const blueprint of rounded) {
      const definition = MEASURED_PART_DEFINITIONS.find(
        ({ geometry }) => geometry.provenance.sourceId === `ldraw:official:${blueprint.ldrawId}`,
      );
      expect(blueprint.validatedConnectionStudProfile, blueprint.designId).toBe(
        NOMINAL_STUD_TUBE_VALIDATED_CONNECTION_PROFILE,
      );
      expect(definition?.collision.validatedConnectionStudProfile, blueprint.designId).toBe(
        NOMINAL_STUD_TUBE_VALIDATED_CONNECTION_PROFILE,
      );
      for (const [index, row] of blueprint.studsLdu.entries()) {
        expect(
          definition?.collision.primitives.find(({ id }) => id === `stud:${index}`),
          `${blueprint.designId}/stud:${index}`,
        ).toMatchObject({
          kind: "cylinder",
          radiusLdu: row[3],
          heightLdu: row[4],
          validatedConnectionProfileRadiusLdu: 6,
        });
      }
    }
  });

  it("keeps the live product denominator distinct from render-only physical overrides", () => {
    const liveRows = rounded.map((blueprint) => {
      const definition = PART_DEFINITIONS.find(({ id }) => id === catalogId(blueprint));
      expect(definition, blueprint.designId).toBeDefined();
      return { blueprint, definition: definition! };
    });
    const profiled = liveRows.filter(
      ({ definition }) =>
        definition.collision.validatedConnectionStudProfile ===
        NOMINAL_STUD_TUBE_VALIDATED_CONNECTION_PROFILE,
    );

    expect(profiled).toHaveLength(22);
    expect(
      profiled.reduce(
        (count, { definition }) =>
          count +
          definition.collision.primitives.filter(
            (primitive) =>
              primitive.kind === "cylinder" &&
              primitive.tag === "stud" &&
              primitive.validatedConnectionProfileRadiusLdu === 6,
          ).length,
        0,
      ),
    ).toBe(76);
    expect(
      liveRows
        .filter(
          ({ definition }) => definition.collision.validatedConnectionStudProfile === undefined,
        )
        .map(({ blueprint }) => blueprint.designId),
    ).toEqual(RENDER_ONLY_PHYSICAL_OVERRIDE_DESIGNS);
    for (const { blueprint, definition } of liveRows.filter(({ blueprint }) =>
      RENDER_ONLY_PHYSICAL_OVERRIDE_DESIGNS.includes(
        blueprint.designId as (typeof RENDER_ONLY_PHYSICAL_OVERRIDE_DESIGNS)[number],
      ),
    )) {
      expect(
        definition.collision.validatedConnectionStudProfile,
        blueprint.designId,
      ).toBeUndefined();
      expect(
        definition.collision.primitives.filter(
          (primitive) =>
            primitive.kind === "cylinder" &&
            primitive.validatedConnectionProfileRadiusLdu !== undefined,
        ),
        blueprint.designId,
      ).toEqual([]);
    }
  });

  it("pins the seven newly profiled live definitions and their 26 stud cylinders", () => {
    expect(
      NEW_LIVE_PROFILE_INVENTORY.map(([designId, partId, studCount]) => {
        const definition = PART_DEFINITIONS.find(({ id }) => id === partId);
        expect(definition, designId).toBeDefined();
        const profiledStuds = definition!.collision.primitives.filter(
          (primitive) =>
            primitive.kind === "cylinder" &&
            primitive.tag === "stud" &&
            primitive.validatedConnectionProfileRadiusLdu === 6,
        );
        expect(definition!.collision.validatedConnectionStudProfile, designId).toBe(
          NOMINAL_STUD_TUBE_VALIDATED_CONNECTION_PROFILE,
        );
        expect(profiledStuds, designId).toHaveLength(studCount);
        return [designId, partId, profiledStuds.length];
      }),
    ).toEqual(NEW_LIVE_PROFILE_INVENTORY);
    expect(NEW_LIVE_PROFILE_INVENTORY.reduce((count, row) => count + row[2], 0)).toBe(26);
  });

  it.each([
    ["15254", "builder"],
    ["2450", "ldcad-shadow"],
    ["80015", "builder-connectivity"],
  ] as const)("refuses an omitted profile on the %s %s route", (designId, connectorAuthority) => {
    const blueprint = rounded.find((candidate) => candidate.designId === designId)!;

    expect(() => makeMeasuredPartDefinition(withoutProfile(blueprint)), connectorAuthority).toThrow(
      /every measured stud in this R6x4 rounding class requires the definition-level profile/u,
    );
  });

  it("retains one exact source commitment from every connector-authority route", () => {
    const builder = rounded.find(({ designId }) => designId === "15254")!;
    const shadow = rounded.find(({ designId }) => designId === "2450")!;
    const connectivity = rounded.find(({ designId }) => designId === "80015")!;

    expect(builder).toMatchObject({
      ldrawSource: {
        rootSha256: "sha256:d0a46511d5348dcab1d16852e930fb2f7ea96ed461aed46cf0343b0a2feae883",
      },
      builderSource: {
        revision: "J",
        recordSha256: "sha256:0ae335fc6d5ee2adf9e2aadf4dc71bce8db432d9ce1dc5283fbe1da7456ff6f2",
        frameSha256: "sha256:3fab6aeb6e5bcbab80d312937e62d53d86e671816b6f8e1c3eaecc89afc728c5",
      },
    });
    expect(shadow).toMatchObject({
      ldrawSource: {
        rootSha256: "sha256:5bdb50ad11b750ca1621a7c1717f1dee4af58ae8816af3c77f4af75f7e72f408",
      },
      ldcadShadowSource: {
        commit: "15aa1e718b6a8da37d24fc7af5e52e262c041bfb",
        manifestSha256: "sha256:668bc047a45e5560ff0fbbd69e9eb5adafab127781720bcb069a1554cb3f0c0f",
        shadowFiles: ["p/stud.dat", "p/stud4.dat", "parts/2450.dat"],
      },
    });
    expect(connectivity).toMatchObject({
      ldrawSource: {
        rootSha256: "sha256:b2c08c34303be83aaba7ab12aecf0ce203773e32189691f2c2b59b2a789d29d5",
      },
      builderConnectivitySource: {
        sourceRevision: "80015;revision-E;platform-Android",
        manifestSha256: "sha256:3e57aa4df4ab5327c5b8408912d056ba73b93cd98e769e41d6aabaf6cb0618a6",
        bundleSha256: "sha256:f3a11d40f9de9fa54670bdd87db0a87e034896d87b56e64e9f382c3ef0098c75",
        primitiveXmlSha256:
          "sha256:ad9aca4ca7275358e2f680ad154b5f577f8fc79b87a8ea1c60aea4558a0a23bc",
      },
    });
  });
});
