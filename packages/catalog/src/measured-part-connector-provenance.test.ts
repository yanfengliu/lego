import { describe, expect, it } from "vitest";

import { getPartDefinition } from "./index.js";

const BUILDER_CONNECTOR_PART_IDS = [
  "builtin:tile-1x2-cut-right-45",
  "builtin:plate-1x2-round-end",
  "builtin:wedge-plate-2x4-wing",
  "builtin:corner-plate-3x3",
  "builtin:curved-slope-1x4-double",
  "builtin:arch-1x6-thin-top",
  "builtin:brick-1x2-grille",
  "builtin:slope-1x2-45",
] as const;

/** Every measured part whose connector rows the LDCad shadow library authors. */
const LDCAD_CONNECTOR_PART_IDS = [
  "builtin:plate-3x3-corner-round",
  "builtin:wedge-plate-3x3-cut-corner",
  "builtin:corner-plate-2x2-round",
  "builtin:tile-1x1-quarter-round",
  "builtin:bracket-1x2-1x4-rounded-bottom",
  "builtin:tile-2x2-triangular",
  "builtin:roller-skate",
  "builtin:bracket-2x2-1x2-vertical-studs",
  "builtin:axle-1x3",
  "builtin:technic-brick-1x2-axle-hole",
  "builtin:plate-3x3",
  "builtin:plate-2x2-two-studs",
  "builtin:plate-1x5",
  "builtin:tile-1x2-chamfered-indented",
  "builtin:technic-brick-1x1-axle-hole",
  "builtin:slope-1x1-double-45",
  "builtin:curved-slope-1x1-outside-bow",
  "builtin:brick-1x2x2-without-understud",
  "builtin:brick-1x1x5-solid-stud",
  "builtin:bracket-1x2-1x4-rounded-corners",
  "builtin:brick-1x2x2-inside-axle-holder",
] as const;

function requirePart(id: string) {
  const part = getPartDefinition(id);
  if (part === undefined) throw new Error(`the catalog is missing admitted part ${id}`);
  return part;
}

describe("measured-part connector provenance", () => {
  it("distinguishes the eight Builder declarations from the twenty-one LDCad declarations", () => {
    expect(BUILDER_CONNECTOR_PART_IDS).toHaveLength(8);
    expect(LDCAD_CONNECTOR_PART_IDS).toHaveLength(21);
    for (const id of BUILDER_CONNECTOR_PART_IDS) {
      expect([id, requirePart(id).provenance.sourceId]).toEqual([
        id,
        "lego-studio:measured-part-admission",
      ]);
    }
    for (const id of LDCAD_CONNECTOR_PART_IDS) {
      expect([id, requirePart(id).provenance.sourceId]).toEqual([
        id,
        "lego-studio:ldcad-shadow-measured-part-admission",
      ]);
    }
  });

  it("carries the shadow library's attribution and share-alike position with its data", () => {
    for (const id of LDCAD_CONNECTOR_PART_IDS) {
      const { provenance } = requirePart(id);
      expect(provenance.sourceType).toBe("external-connector-metadata");
      expect(provenance.externalGeometryBundled).toBe(false);
      expect(provenance.licenseExpression).toBe("MIT AND CC-BY-SA-4.0");
      expect(provenance.attribution).toContain("Roland Melkert");
      expect(provenance.attribution).toMatch(/ShareAlike attaches to this derived connector data/u);
      expect(provenance.sourceVersion).toContain("15aa1e718b6a8da37d24fc7af5e52e262c041bfb");
      expect(provenance.sourceVersion).toContain(
        "668bc047a45e5560ff0fbbd69e9eb5adafab127781720bcb069a1554cb3f0c0f",
      );
      expect(provenance.trainingUseAllowed).toBe(false);
    }
  });

  it("describes 3245b's finite one-sided holder without through-hole claims", () => {
    const { attribution } = requirePart("builtin:brick-1x2x2-inside-axle-holder").provenance;

    expect(attribution).toContain("caps=one");
    expect(attribution).toContain("female A6x44 finite span");
    expect(attribution).toContain("slide=false");
    expect(attribution).not.toContain("capless");
    expect(attribution).not.toContain("sliding, YOnly-scaled");
  });
});
