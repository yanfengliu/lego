import { COLOR_DEFINITIONS } from "@lego-studio/catalog";
import type { BrickDocumentV1 } from "@lego-studio/protocol";
import { describe, expect, it } from "vitest";

import { createEmptyBrickDocument, createPartInstance } from "./factory.ts";
import { MIGRATABLE_CATALOG_VERSIONS, migrateDocumentTruth } from "./migration.ts";
import { validateBrickDocument } from "./validation.ts";

/** A document as it was written by the eight-colour catalog. */
function legacyDocument(overrides: Partial<BrickDocumentV1> = {}): BrickDocumentV1 {
  const current = createEmptyBrickDocument({ id: "legacy", name: "Legacy model" });
  const part = createPartInstance({ id: "part-1", catalogPartId: "builtin:brick-2x2" });
  return {
    ...current,
    truth: {
      ...current.truth,
      catalog: {
        ...current.truth.catalog,
        version: "builtin.basic-parts/1",
        // Well-formed but different: the document is pinned to the older palette.
        hash: `sha256:${"a1b2c3d4".repeat(8)}`,
      },
    },
    parts: [part],
    submodels: [{ ...current.submodels[0]!, partIds: [part.id] }],
    steps: [{ ...current.steps[0]!, partIds: [part.id] }],
    constraints: {
      ...current.constraints,
      allowedColorIds: [
        "builtin:black",
        "builtin:blue",
        "builtin:dark-bluish-gray",
        "builtin:green",
        "builtin:light-bluish-gray",
        "builtin:red",
        "builtin:white",
        "builtin:yellow",
      ],
    },
    ...overrides,
  };
}

describe("migrateDocumentTruth", () => {
  it("leaves a current document untouched and reports no migration", () => {
    const current = createEmptyBrickDocument({ id: "current", name: "Current" });
    const { document, report } = migrateDocumentTruth(current);

    expect(document).toBe(current);
    expect(report.migrated).toBe(false);
    expect(report.blockingReasons).toEqual([]);
    expect(report.fromTruthHash).toBe(report.toTruthHash);
  });

  it("carries a legacy document onto the current truth and reports the new colours", () => {
    const { document, report } = migrateDocumentTruth(legacyDocument());

    expect(report.migrated).toBe(true);
    expect(report.fromCatalogVersion).toBe("builtin.basic-parts/1");
    expect(report.toCatalogVersion).toBe("builtin.basic-parts/2");
    expect(report.addedColorIds.length).toBeGreaterThan(0);
    expect(report.addedColorIds).toContain("builtin:orange");
    expect(report.addedColorIds).not.toContain("builtin:red");
    expect(document.constraints.allowedColorIds).toHaveLength(COLOR_DEFINITIONS.length);
  });

  it("produces a document the current validators accept", () => {
    const before = validateBrickDocument(legacyDocument());
    expect(before.documentGloballyValid).toBe(false);
    expect(before.issues.map(({ code }) => code)).toContain("TRUTH_SNAPSHOT_MISMATCH");

    const { document } = migrateDocumentTruth(legacyDocument());
    const after = validateBrickDocument(document);

    expect(after.documentGloballyValid).toBe(true);
  });

  it("preserves parts, colours, and transforms across the migration", () => {
    const legacy = legacyDocument();
    const { document } = migrateDocumentTruth(legacy);

    expect(document.parts).toHaveLength(1);
    expect(document.parts[0]!.id).toBe("part-1");
    expect(document.parts[0]!.colorId).toBe(legacy.parts[0]!.colorId);
    expect(document.parts[0]!.transform).toEqual(legacy.parts[0]!.transform);
  });

  it("advances the revision so the migration is a distinct, recorded state", () => {
    const legacy = legacyDocument();
    const { document } = migrateDocumentTruth(legacy);

    expect(document.revision).not.toBe(legacy.revision);
    expect(migrateDocumentTruth(legacy).document.revision).toBe(document.revision);
  });

  it("refuses an unknown source catalog version instead of reinterpreting it", () => {
    const exotic = legacyDocument();
    const { document, report } = migrateDocumentTruth({
      ...exotic,
      truth: { ...exotic.truth, catalog: { ...exotic.truth.catalog, version: "someone-elses/9" } },
    });

    expect(report.migrated).toBe(false);
    expect(document.truth.catalog.version).toBe("someone-elses/9");
    expect(report.blockingReasons[0]).toMatch(
      /Catalog version someone-elses\/9 has no migration to builtin.basic-parts\/2/,
    );
  });

  it("refuses when a part references truth the current catalog dropped", () => {
    const legacy = legacyDocument();
    const { report } = migrateDocumentTruth({
      ...legacy,
      parts: [{ ...legacy.parts[0]!, colorId: "builtin:retired-color" }],
    });

    expect(report.migrated).toBe(false);
    expect(report.blockingReasons.join(" ")).toMatch(
      /part-1 uses color builtin:retired-color, which builtin.basic-parts\/2 no longer defines/,
    );
  });

  it("names the source versions it knows about", () => {
    expect(MIGRATABLE_CATALOG_VERSIONS).toContain("builtin.basic-parts/1");
  });
});
