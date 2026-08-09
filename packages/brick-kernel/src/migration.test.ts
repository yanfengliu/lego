import {
  BUILTIN_CATALOG_VERSION,
  COLLISION_MODEL_VERSION,
  COLOR_DEFINITIONS,
  PART_DEFINITIONS,
} from "@lego-studio/catalog";
import type { BrickDocumentV1 } from "@lego-studio/protocol";
import { describe, expect, it } from "vitest";

import { createEmptyBrickDocument, createPartInstance } from "./factory.ts";
import { canonicalDigest } from "./canonical.ts";
import {
  MIGRATABLE_CATALOG_VERSIONS,
  REVIEWED_HISTORICAL_TRUTH_SNAPSHOTS,
  migrateDocumentTruth,
} from "./migration.ts";
import { validateBrickDocument } from "./validation.ts";

/** A document pinned to the exact reviewed `/5` truth snapshot. */
function legacyDocument(overrides: Partial<BrickDocumentV1> = {}): BrickDocumentV1 {
  const current = createEmptyBrickDocument({ id: "legacy", name: "Legacy model" });
  const part = createPartInstance({ id: "part-1", catalogPartId: "builtin:brick-2x2" });
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
  it.each([
    [
      "builtin.basic-parts/1",
      "b62cbdf53ced2b45cfd8c49d3bcbd74dc5b9b711",
      "sha256:0f6b9dcb03a9dd570b4ccc68f41a015bb33422e5cf6c1fe032f1a15bfbd76a8a",
    ],
    [
      "builtin.basic-parts/2",
      "98a3b14e95c6f60cfe7bb852053dfdeb4a56243b",
      "sha256:2d980a480fc5b82011b3a09f9e962d74a8e7af068595503ceaa88e9811a7b17a",
    ],
    [
      "builtin.basic-parts/3",
      "d86b274750aa0b971769df605ba70e2dd68cc02a",
      "sha256:e10d6cd07af66fc3bf9bbb2917992e74bb15f76385ec989bd7e94bcd4cffeedd",
    ],
    [
      "builtin.basic-parts/4",
      "e0f99cddd820f6dd3915fa10a9ce2f856fc852c4",
      "sha256:f48bb1cae251f592923d94b4b992a55c06e74ea49b0f81be9ff4d416bb38e843",
    ],
    [
      "builtin.basic-parts/4",
      "d493dcf390e3009046b457d681a7b80733c3804c",
      "sha256:4a1dea5f4706dba84aeee1bcbd495fec7eac0f7321e7447979a03a8fb089d3bc",
    ],
    [
      "builtin.basic-parts/4",
      "5d2ca4f25bd8fae1437daf608c762b99c63ac2a6",
      "sha256:6015f52a986a0ed4f5c5310f8b30c2a35b58f8b015025db8804c67e14ff5e9ef",
    ],
    [
      "builtin.basic-parts/5",
      "0267c0919156df1cede84db91dd716f4565d0fb2",
      "sha256:72657715102652a49e08ae683650758958d5c9fad2235761368269ffd15fc4aa",
    ],
  ])("pins reviewed %s truth from commit %s", (catalogVersion, sourceCommit, truthHash) => {
    expect(
      REVIEWED_HISTORICAL_TRUTH_SNAPSHOTS.find(
        (snapshot) => snapshot.sourceCommit === sourceCommit,
      ),
    ).toEqual({ catalogVersion, sourceCommit, truthHash });
    expect(MIGRATABLE_CATALOG_VERSIONS).toContain(catalogVersion);
  });

  it("admits no historical truth snapshots beyond the reviewed table", () => {
    expect(REVIEWED_HISTORICAL_TRUTH_SNAPSHOTS).toHaveLength(11);
    expect(
      new Set(REVIEWED_HISTORICAL_TRUTH_SNAPSHOTS.map(({ sourceCommit }) => sourceCommit)).size,
    ).toBe(11);
    expect(
      new Set(REVIEWED_HISTORICAL_TRUTH_SNAPSHOTS.map(({ truthHash }) => truthHash)).size,
    ).toBe(11);
  });

  it("pins the legacy fixture to a reviewed historical truth snapshot", () => {
    expect(canonicalDigest(legacyDocument().truth)).toBe(
      "sha256:72657715102652a49e08ae683650758958d5c9fad2235761368269ffd15fc4aa",
    );
  });
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
    expect(report.fromCatalogVersion).toBe("builtin.basic-parts/5");
    expect(report.toCatalogVersion).toBe(BUILTIN_CATALOG_VERSION);
    expect(report.addedColorIds.length).toBeGreaterThan(0);
    expect(report.addedColorIds).toContain("builtin:orange");
    expect(report.addedColorIds).not.toContain("builtin:red");
    expect(report.truthComponentChanges).toEqual([
      {
        component: "catalog",
        fromVersion: "builtin.basic-parts/5",
        toVersion: BUILTIN_CATALOG_VERSION,
      },
      {
        component: "collision-model",
        fromVersion: "rectilinear-stud-clearance/1",
        toVersion: COLLISION_MODEL_VERSION,
      },
      {
        component: "validator-set",
        fromVersion: "lego.kernel-validators/1",
        toVersion: "lego.kernel-validators/2",
      },
    ]);
    expect(document.constraints.allowedColorIds).toHaveLength(COLOR_DEFINITIONS.length);
  });

  it("carries a /6 document forward and names the five parts it gained", () => {
    // The snapshot this catalog version replaced. `/6` became historical at the
    // first production part admission, which is what makes this path exist.
    const current = createEmptyBrickDocument({ id: "six", name: "Saved at /6" });
    const document: BrickDocumentV1 = {
      ...current,
      truth: {
        schemaVersion: "lego.truth-snapshot/1",
        catalog: {
          id: "builtin.basic-parts",
          version: "builtin.basic-parts/6",
          hash: "sha256:590a94c9b9498faace4b29b74c4c9ba8352d644365585d9aeb96b4a7c53bdb7f",
        },
        connectorTaxonomy: {
          id: "stud-tube",
          version: "stud-tube/1",
          hash: "sha256:720d9d3f430c388bd4fa47de41f93aed138505642bf9b33b3f6e5ca6a0510dfb",
        },
        collisionModel: {
          id: "rectilinear-stud-clearance",
          version: "rectilinear-stud-clearance/2",
          hash: "sha256:692e143470b6a19f54299301de79daf74acd75af0ffeefb82437b5e81c6bda2a",
        },
        transformPolicy: {
          id: "upright-quarter-turns-negative-y-up",
          version: "upright-quarter-turns-negative-y-up/1",
          hash: "sha256:535a51b5b102dac0d5788ffecb3c1330d51e0799853d7cc9a1fa1236354f8a09",
        },
        validatorSet: {
          id: "lego.kernel-validators",
          version: "lego.kernel-validators/2",
          hash: "sha256:cb2767cfa8c8d7adfe145bef950b49428d8c8fced235a04b5f984c29799a031e",
        },
      },
      constraints: {
        ...current.constraints,
        allowedCatalogPartIds: PART_DEFINITIONS.slice(0, 77)
          .map(({ id }) => id)
          .sort(),
      },
    };

    const { report } = migrateDocumentTruth(document);

    expect(report.migrated).toBe(true);
    expect(report.blockingReasons).toEqual([]);
    expect(report.fromTruthHash).toBe(
      "sha256:e5ae3655ebac2b16ede784efa82728c2412d0c95021183653b07222ac9d76a09",
    );
    expect(report.addedCatalogPartIds).toEqual([
      "builtin:tile-1x2-cut-right-45",
      "builtin:plate-1x2-round-end",
      "builtin:wedge-plate-2x4-wing",
      "builtin:corner-plate-3x3",
      "builtin:curved-slope-1x4-double",
      "builtin:plate-3x3-corner-round",
      "builtin:wedge-plate-3x3-cut-corner",
      "builtin:corner-plate-2x2-round",
    ]);
    expect(report.addedColorIds).toEqual([]);
    expect(report.truthComponentChanges).toEqual([
      {
        component: "catalog",
        fromVersion: "builtin.basic-parts/6",
        toVersion: BUILTIN_CATALOG_VERSION,
      },
    ]);
  });

  it("carries a /7 document forward and names the three parts it gained", () => {
    // The snapshot /8 replaced. /7 admitted the five designs LEGO Builder has a
    // record for; the three named here are the ones it has none for, whose
    // clutch cells the LDCad shadow library authored instead.
    const current = createEmptyBrickDocument({ id: "seven", name: "Saved at /7" });
    const document: BrickDocumentV1 = {
      ...current,
      truth: {
        schemaVersion: "lego.truth-snapshot/1",
        catalog: {
          id: "builtin.basic-parts",
          version: "builtin.basic-parts/7",
          hash: "sha256:f26a1ba141ca0485f1bf046c68d94082497fcd8dcea85906723a389a09ec55d2",
        },
        connectorTaxonomy: {
          id: "stud-tube",
          version: "stud-tube/1",
          hash: "sha256:2f3f165461925f9ba3be532d9b5a2e76836d6eb1c93709f954ae7f6150d8db5e",
        },
        collisionModel: {
          id: "rectilinear-stud-clearance",
          version: "rectilinear-stud-clearance/2",
          hash: "sha256:c8b66e871ec0e730795ace974befb927844ecd1d99929f94c76cb955287c955c",
        },
        transformPolicy: {
          id: "upright-quarter-turns-negative-y-up",
          version: "upright-quarter-turns-negative-y-up/1",
          hash: "sha256:5d9342646d5f6434e57e0673aa43192d9274e47588e4dc07081960644402b7ca",
        },
        validatorSet: {
          id: "lego.kernel-validators",
          version: "lego.kernel-validators/2",
          hash: "sha256:cb2767cfa8c8d7adfe145bef950b49428d8c8fced235a04b5f984c29799a031e",
        },
      },
      constraints: {
        ...current.constraints,
        allowedCatalogPartIds: PART_DEFINITIONS.slice(0, 82)
          .map(({ id }) => id)
          .sort(),
      },
    };

    const { report } = migrateDocumentTruth(document);

    expect(report.migrated).toBe(true);
    expect(report.blockingReasons).toEqual([]);
    expect(report.fromTruthHash).toBe(
      "sha256:29eaae6325eba701dc52827a9373c7583889ce3fd16fd8057f3c6f243a8ab868",
    );
    expect(report.addedCatalogPartIds).toEqual([
      "builtin:plate-3x3-corner-round",
      "builtin:wedge-plate-3x3-cut-corner",
      "builtin:corner-plate-2x2-round",
    ]);
    expect(report.addedColorIds).toEqual([]);
    expect(report.truthComponentChanges).toEqual([
      {
        component: "catalog",
        fromVersion: "builtin.basic-parts/7",
        toVersion: BUILTIN_CATALOG_VERSION,
      },
    ]);
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
    expect(report.blockingReasons.join(" ")).toContain(
      `Catalog version someone-elses/9 has no migration to ${BUILTIN_CATALOG_VERSION}`,
    );
  });

  it("refuses unknown non-catalog truth instead of silently rewriting it", () => {
    const legacy = legacyDocument();
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

  it("refuses when a part references truth the current catalog dropped", () => {
    const legacy = legacyDocument();
    const { report } = migrateDocumentTruth({
      ...legacy,
      parts: [{ ...legacy.parts[0]!, colorId: "builtin:retired-color" }],
    });

    expect(report.migrated).toBe(false);
    expect(report.blockingReasons.join(" ")).toContain(
      `part-1 uses color builtin:retired-color, which ${BUILTIN_CATALOG_VERSION} no longer defines`,
    );
  });

  it("names the source versions it knows about", () => {
    expect(MIGRATABLE_CATALOG_VERSIONS).toContain("builtin.basic-parts/1");
    expect(MIGRATABLE_CATALOG_VERSIONS).toContain(BUILTIN_CATALOG_VERSION);
  });
});
