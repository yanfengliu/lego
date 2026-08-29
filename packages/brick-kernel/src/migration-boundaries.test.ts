import { BUILTIN_CATALOG_VERSION } from "@lego-studio/catalog";
import type { BrickDocumentV1 } from "@lego-studio/protocol";
import { describe, expect, it } from "vitest";

import { createEmptyBrickDocument, createPartInstance } from "./factory.ts";
import { getReviewedHistoricalCatalogRoster } from "./historical-catalog-rosters.ts";
import { MIGRATABLE_CATALOG_VERSIONS, migrateDocumentTruth } from "./migration.ts";

function legacyBoundaryDocument(): BrickDocumentV1 {
  const current = createEmptyBrickDocument({ id: "legacy-boundary", name: "Legacy boundary" });
  const part = createPartInstance({ id: "part-1", catalogPartId: "builtin:brick-2x2" });
  const sourceRoster = getReviewedHistoricalCatalogRoster(
    "sha256:72657715102652a49e08ae683650758958d5c9fad2235761368269ffd15fc4aa",
  );
  if (sourceRoster === undefined) throw new Error("The reviewed /5 roster fixture is missing.");
  return {
    ...current,
    truth: {
      schemaVersion: "lego.truth-snapshot/1",
      catalog: {
        id: "builtin.basic-parts",
        version: "builtin.basic-parts/5",
        hash: "sha256:4fa0d526206cad697216ae205e3b7f3ec0948adc99ed8987a59b20bc16059dbf",
      },
      connectorTaxonomy: {
        id: "stud-tube",
        version: "stud-tube/1",
        hash: "sha256:6159d702f87b47daf3b33ada3a4510973defbe307c7a73c5af29c9d985cfd189",
      },
      collisionModel: {
        id: "rectilinear-stud-clearance",
        version: "rectilinear-stud-clearance/1",
        hash: "sha256:40e3d3a92d37faa4d2d9a91d52e8f9a6172fb4a37007d6573a54363114d16ad5",
      },
      transformPolicy: {
        id: "upright-quarter-turns-negative-y-up",
        version: "upright-quarter-turns-negative-y-up/1",
        hash: "sha256:9c5f5fcce76f51e86da80226f130654586c81a94226b0ab26779e06f0589d3c0",
      },
      validatorSet: {
        id: "lego.kernel-validators",
        version: "lego.kernel-validators/1",
        hash: "sha256:287a04704c5f94930242b85dda7198b22f6eed195334b55a448a5e60d65e517b",
      },
    },
    parts: [part],
    submodels: [{ ...current.submodels[0]!, partIds: [part.id] }],
    steps: [{ ...current.steps[0]!, partIds: [part.id] }],
    constraints: {
      ...current.constraints,
      allowedCatalogPartIds: sourceRoster.catalogPartIds,
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
  };
}

describe("migration truth boundaries", () => {
  it("refuses an unreviewed same-version truth hash as tampering, not migration", () => {
    const current = createEmptyBrickDocument({ id: "current", name: "Current" });
    const { document, report } = migrateDocumentTruth({
      ...current,
      truth: {
        ...current.truth,
        collisionModel: {
          ...current.truth.collisionModel,
          hash: `sha256:${"deadbeef".repeat(8)}`,
        },
      },
    });

    expect(report.migrated).toBe(false);
    expect(document.truth.collisionModel.hash).toBe(`sha256:${"deadbeef".repeat(8)}`);
    expect(report.blockingReasons.join(" ")).toContain(
      "not one of the reviewed historical builtin snapshots",
    );
  });

  it("names the source versions it knows about", () => {
    expect(MIGRATABLE_CATALOG_VERSIONS).toContain("builtin.basic-parts/1");
    expect(MIGRATABLE_CATALOG_VERSIONS).toContain(BUILTIN_CATALOG_VERSION);
  });

  it("refuses unknown non-catalog truth instead of silently rewriting it", () => {
    const legacy = legacyBoundaryDocument();
    const { document, report } = migrateDocumentTruth({
      ...legacy,
      truth: {
        ...legacy.truth,
        connectorTaxonomy: {
          ...legacy.truth.connectorTaxonomy,
          version: "someone-elses-connectors/9",
        },
        validatorSet: { ...legacy.truth.validatorSet, id: "someone-elses-validators" },
      },
    });

    expect(report.migrated).toBe(false);
    expect(document.truth.connectorTaxonomy.version).toBe("someone-elses-connectors/9");
    expect(report.blockingReasons.join(" ")).toContain(
      "Connector taxonomy version someone-elses-connectors/9 cannot migrate",
    );
    expect(report.blockingReasons.join(" ")).toContain(
      "Validator set id someone-elses-validators cannot migrate",
    );
  });

  it("refuses when a part references truth the current catalog dropped", () => {
    const legacy = legacyBoundaryDocument();
    const { report } = migrateDocumentTruth({
      ...legacy,
      parts: [{ ...legacy.parts[0]!, colorId: "builtin:retired-color" }],
    });

    expect(report.migrated).toBe(false);
    expect(report.blockingReasons.join(" ")).toContain(
      `part-1 uses color builtin:retired-color, which ${BUILTIN_CATALOG_VERSION} no longer defines`,
    );
  });
});
