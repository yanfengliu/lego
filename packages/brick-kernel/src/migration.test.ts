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
import {
  REVIEWED_HISTORICAL_CATALOG_ROSTERS_BY_TRUTH_HASH,
  getReviewedHistoricalCatalogRoster,
} from "./historical-catalog-rosters.ts";
import { validateBrickDocument } from "./validation.ts";

function legacyDocument(overrides: Partial<BrickDocumentV1> = {}): BrickDocumentV1 {
  const current = createEmptyBrickDocument({ id: "legacy", name: "Legacy model" });
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
    ...overrides,
  };
}

const POST_V8_TRUTH_HASHES = {
  connector: "sha256:57489cb5a3b5e1bf367984c2768318f151e19051d2b1b6ee3713a7e6ef53f6a2",
  collision: "sha256:a14d660a6b24a63326ab6c24865fc07ea59496b1cf48002cea83a4b615724edb",
  transform: "sha256:0b440dad9403f63aa89496e0e129ef3cf5d78391565294cbde18e239ec66c7b6",
} as const;

interface HistoricalDocumentOptions {
  readonly id: string;
  readonly name: string;
  readonly catalogVersion: string;
  readonly catalogHash: BrickDocumentV1["truth"]["catalog"]["hash"];
  readonly connectorHash?: BrickDocumentV1["truth"]["connectorTaxonomy"]["hash"];
  readonly collisionVersion?: BrickDocumentV1["truth"]["collisionModel"]["version"];
  readonly collisionHash?: BrickDocumentV1["truth"]["collisionModel"]["hash"];
  readonly transformHash?: BrickDocumentV1["truth"]["transformPolicy"]["hash"];
  readonly validatorVersion?: BrickDocumentV1["truth"]["validatorSet"]["version"];
  readonly validatorHash?: BrickDocumentV1["truth"]["validatorSet"]["hash"];
  readonly allowedCatalogPartCount?: number;
  readonly part?: BrickDocumentV1["parts"][number];
}

function historicalDocument(options: HistoricalDocumentOptions): BrickDocumentV1 {
  const current = createEmptyBrickDocument({ id: options.id, name: options.name });
  const document: BrickDocumentV1 = {
    ...current,
    truth: {
      schemaVersion: "lego.truth-snapshot/1",
      catalog: {
        id: "builtin.basic-parts",
        version: options.catalogVersion,
        hash: options.catalogHash,
      },
      connectorTaxonomy: {
        id: "stud-tube",
        version: "stud-tube/1",
        hash: options.connectorHash ?? POST_V8_TRUTH_HASHES.connector,
      },
      collisionModel: {
        id: "rectilinear-stud-clearance",
        version: options.collisionVersion ?? "rectilinear-stud-clearance/2",
        hash: options.collisionHash ?? POST_V8_TRUTH_HASHES.collision,
      },
      transformPolicy: {
        id: "upright-quarter-turns-negative-y-up",
        version: "upright-quarter-turns-negative-y-up/1",
        hash: options.transformHash ?? POST_V8_TRUTH_HASHES.transform,
      },
      validatorSet: {
        id: "lego.kernel-validators",
        version: options.validatorVersion ?? "lego.kernel-validators/2",
        hash:
          options.validatorHash ??
          "sha256:cb2767cfa8c8d7adfe145bef950b49428d8c8fced235a04b5f984c29799a031e",
      },
    },
  };
  const populated =
    options.part === undefined
      ? document
      : {
          ...document,
          parts: [options.part],
          submodels: [{ ...current.submodels[0]!, partIds: [options.part.id] }],
          steps: [{ ...current.steps[0]!, partIds: [options.part.id] }],
        };
  const truthHash = canonicalDigest(document.truth);
  const sourceRoster = getReviewedHistoricalCatalogRoster(truthHash);
  if (sourceRoster === undefined) {
    throw new Error(`The reviewed roster fixture for ${truthHash} is missing.`);
  }
  const allowedCatalogPartIds =
    options.allowedCatalogPartCount === undefined
      ? sourceRoster.catalogPartIds
      : PART_DEFINITIONS.slice(0, options.allowedCatalogPartCount).map(({ id }) => id);
  return {
    ...populated,
    constraints: {
      ...current.constraints,
      allowedCatalogPartIds: [...allowedCatalogPartIds].sort(),
    },
  };
}

function expectReviewedCurrentTruthChanges(
  report: ReturnType<typeof migrateDocumentTruth>["report"],
  fromVersion: string,
): void {
  expect(report.truthComponentChanges).toEqual([
    { component: "catalog", fromVersion, toVersion: BUILTIN_CATALOG_VERSION },
    {
      component: "collision-model",
      fromVersion: "rectilinear-stud-clearance/2",
      toVersion: "rectilinear-stud-clearance/3",
    },
    {
      component: "validator-set",
      fromVersion: "lego.kernel-validators/2",
      toVersion: "lego.kernel-validators/3",
    },
  ]);
}

const VERSION_13_RENDER_PART_IDS = [
  "builtin:wedge-plate-2x4-left",
  "builtin:wedge-plate-2x4-right",
  "builtin:wedge-plate-2x3-left",
  "builtin:wedge-plate-2x3-right",
  "builtin:arch-1x4",
  "builtin:arch-1x6",
  "builtin:curved-slope-1x2",
  "builtin:curved-slope-1x3",
  "builtin:curved-slope-1x4",
  "builtin:cheese-slope-1x1",
  "builtin:cheese-slope-2x1",
  "builtin:wedge-plate-4x4-cut-corner",
  "builtin:wedge-plate-6x6-cut-corner",
  "builtin:wedge-plate-3x6-right",
  "builtin:corner-plate-4x4-round",
  "builtin:corner-plate-5x5-quarter-ring",
  "builtin:tile-1x2-cut-right-45",
  "builtin:plate-1x2-round-end",
  "builtin:wedge-plate-2x4-wing",
  "builtin:corner-plate-3x3",
  "builtin:curved-slope-1x4-double",
  "builtin:plate-3x3-corner-round",
  "builtin:wedge-plate-3x3-cut-corner",
  "builtin:corner-plate-2x2-round",
] as const;

const VERSION_13_INTERPRETATION_CHANGES = [
  {
    fromCatalogVersion: "builtin.basic-parts/12",
    toCatalogVersion: "builtin.basic-parts/13",
    affectedCatalogPartIds: VERSION_13_RENDER_PART_IDS,
    changedFields: ["surface-normals"],
  },
  {
    fromCatalogVersion: "builtin.basic-parts/12",
    toCatalogVersion: "builtin.basic-parts/13",
    affectedCatalogPartIds: VERSION_13_RENDER_PART_IDS,
    changedFields: ["render-geometry"],
  },
  {
    fromCatalogVersion: "builtin.basic-parts/12",
    toCatalogVersion: "builtin.basic-parts/13",
    affectedCatalogPartIds: [
      "builtin:wedge-plate-2x4-left",
      "builtin:wedge-plate-2x4-right",
      "builtin:wedge-plate-2x3-left",
      "builtin:wedge-plate-2x3-right",
      "builtin:wedge-plate-3x6-right",
      "builtin:arch-1x4",
      "builtin:arch-1x6",
      "builtin:curved-slope-1x2",
      "builtin:curved-slope-1x3",
      "builtin:curved-slope-1x4",
      "builtin:cheese-slope-1x1",
      "builtin:cheese-slope-2x1",
    ],
    changedFields: ["body-bounds", "visual-bounds"],
  },
] as const;

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
    [
      "builtin.basic-parts/11",
      "bd46506950385df6e4be0f82385f910616e11675",
      "sha256:6b784ce4259131b1ed637815b78bbf14a0bd2e92627ce2a8f4d09c3504465c43",
    ],
    [
      "builtin.basic-parts/12",
      "e70346d7ec2c75a206a436e8c9cc233e1ca2de37",
      "sha256:cdfeae99ea405770f35f83173eec10804078346d257c5e56006707639313ae8e",
    ],
    [
      "builtin.basic-parts/13",
      "8fc01861ec059da71eb09c3273815f7ea49eec62",
      "sha256:de62fae6dbc8095dfd460983e5e845ddfac4bf9ec2ea1f99572bc46026941cb5",
    ],
    [
      "builtin.basic-parts/14",
      "5d90788b0c10576ae1fef592206a66540dbcb131",
      "sha256:db8c1740f23c65a4c0046c679e321a559623ac18a9c3fe59357b912e3a48a1b3",
    ],
    [
      "builtin.basic-parts/15",
      "8ac4c6e9518e7b00fd0ed23ad44c6f38b657efe3",
      "sha256:f8e7efbd1bc969ac699fd68db9696af693898a15ffb7901821e676d843240e2f",
    ],
    [
      "builtin.basic-parts/16",
      "d58ea055120ea8e99a30faab35384a7a54f18de2",
      "sha256:71c76ba1d6740cbaf89b1ab721dba2ffa3136e9d742198b289373ad2205be1be",
    ],
    [
      "builtin.basic-parts/17",
      "4cb37ef80c045ab5b7732dd9021938590ecbb086",
      "sha256:d21bdecc6a269b1b92e0915664cae9a147168fe8d7576ee17213e8e9446c7926",
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
    expect(REVIEWED_HISTORICAL_TRUTH_SNAPSHOTS).toHaveLength(19);
    expect(
      new Set(REVIEWED_HISTORICAL_TRUTH_SNAPSHOTS.map(({ sourceCommit }) => sourceCommit)).size,
    ).toBe(19);
    expect(
      new Set(REVIEWED_HISTORICAL_TRUTH_SNAPSHOTS.map(({ truthHash }) => truthHash)).size,
    ).toBe(19);
  });

  it("binds every reviewed truth hash to its exact immutable catalog roster", () => {
    expect(Object.keys(REVIEWED_HISTORICAL_CATALOG_ROSTERS_BY_TRUTH_HASH).sort()).toEqual(
      REVIEWED_HISTORICAL_TRUTH_SNAPSHOTS.map(({ truthHash }) => truthHash).sort(),
    );
    for (const { truthHash } of REVIEWED_HISTORICAL_TRUTH_SNAPSHOTS) {
      const roster = getReviewedHistoricalCatalogRoster(truthHash);
      expect(roster, truthHash).toBeDefined();
      if (roster === undefined) continue;
      expect(Object.isFrozen(roster), `${truthHash} roster`).toBe(true);
      expect(Object.isFrozen(roster.catalogPartIds), `${truthHash} part IDs`).toBe(true);
      expect(Object.isFrozen(roster.colorIds), `${truthHash} color IDs`).toBe(true);
      expect(new Set(roster.catalogPartIds).size, `${truthHash} unique part IDs`).toBe(
        roster.catalogPartIds.length,
      );
      expect(new Set(roster.colorIds).size, `${truthHash} unique color IDs`).toBe(
        roster.colorIds.length,
      );
      expect(
        PART_DEFINITIONS.slice(0, roster.catalogPartIds.length).map(({ id }) => id),
        `${truthHash} current catalog prefix`,
      ).toEqual(roster.catalogPartIds);
      expect(
        roster.colorIds.every((id) => COLOR_DEFINITIONS.some((color) => color.id === id)),
        `${truthHash} current color membership`,
      ).toBe(true);
    }
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

  it("carries a legacy document onto the current truth and reports newly allowed colours", () => {
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
        toVersion: "lego.kernel-validators/3",
      },
    ]);
    expect(document.constraints.allowedColorIds).toHaveLength(COLOR_DEFINITIONS.length);
  });

  it("names every in-place visual reinterpretation when a /11 document advances", () => {
    const part = createPartInstance({
      id: "quarter-ring",
      catalogPartId: "builtin:corner-plate-5x5-quarter-ring",
    });
    const savedAtEleven = historicalDocument({
      id: "eleven",
      name: "Saved at /11",
      catalogVersion: "builtin.basic-parts/11",
      catalogHash: "sha256:c7e1f3ff0c5edb175c3b97ad98795aa5ed776636941c5e1b3ff52fcee2daa3bc",
      part,
    });

    expect(canonicalDigest(savedAtEleven.truth)).toBe(
      "sha256:6b784ce4259131b1ed637815b78bbf14a0bd2e92627ce2a8f4d09c3504465c43",
    );
    const { document, report } = migrateDocumentTruth(savedAtEleven);

    expect(report.migrated).toBe(true);
    expect(report.addedCatalogPartIds).toEqual([
      "builtin:tile-1x1-quarter-round",
      "builtin:bracket-1x2-1x4-rounded-bottom",
      "builtin:tile-2x2-triangular",
      "builtin:roller-skate",
      "builtin:arch-1x6-thin-top",
    ]);
    expect(report.catalogInterpretationChanges).toEqual([
      {
        fromCatalogVersion: "builtin.basic-parts/11",
        toCatalogVersion: "builtin.basic-parts/12",
        affectedCatalogPartIds: [
          "builtin:wedge-plate-4x4-cut-corner",
          "builtin:wedge-plate-6x6-cut-corner",
          "builtin:corner-plate-4x4-round",
          "builtin:corner-plate-5x5-quarter-ring",
        ],
        changedFields: ["render-geometry", "visual-bounds"],
      },
      ...VERSION_13_INTERPRETATION_CHANGES,
    ]);
    expect(document.parts).toEqual(savedAtEleven.parts);
  });

  it("reports 24 normal and geometry plus 12 bounds reinterpretations at /13", () => {
    const part = createPartInstance({
      id: "three-by-six-right",
      catalogPartId: "builtin:wedge-plate-3x6-right",
    });
    const savedAtTwelve = historicalDocument({
      id: "twelve",
      name: "Saved at /12",
      catalogVersion: "builtin.basic-parts/12",
      catalogHash: "sha256:7a058d34855c49d1b46317e0fff51117c36aa92051ba57449465e506fb6986f5",
      part,
    });

    expect(canonicalDigest(savedAtTwelve.truth)).toBe(
      "sha256:cdfeae99ea405770f35f83173eec10804078346d257c5e56006707639313ae8e",
    );
    const { document, report } = migrateDocumentTruth(savedAtTwelve);

    expect(report.migrated).toBe(true);
    expect(report.addedCatalogPartIds).toEqual([
      "builtin:tile-1x1-quarter-round",
      "builtin:bracket-1x2-1x4-rounded-bottom",
      "builtin:tile-2x2-triangular",
      "builtin:roller-skate",
      "builtin:arch-1x6-thin-top",
    ]);
    expect(report.catalogInterpretationChanges).toEqual(VERSION_13_INTERPRETATION_CHANGES);
    expect(document.parts).toEqual(savedAtTwelve.parts);
  });

  it("carries /13 forward and reports all five complete additive definitions", () => {
    const savedAtThirteen = historicalDocument({
      id: "thirteen",
      name: "Saved at /13",
      catalogVersion: "builtin.basic-parts/13",
      catalogHash: "sha256:100283423bf1cfecfdfec5ba2216d1834a9eb19b1757c71772f7fa53223190d6",
      allowedCatalogPartCount: PART_DEFINITIONS.length - 5,
    });

    expect(canonicalDigest(savedAtThirteen.truth)).toBe(
      "sha256:de62fae6dbc8095dfd460983e5e845ddfac4bf9ec2ea1f99572bc46026941cb5",
    );
    const { document, report } = migrateDocumentTruth(savedAtThirteen);

    expect(report.migrated).toBe(true);
    expect(report.addedCatalogPartIds).toEqual([
      "builtin:tile-1x1-quarter-round",
      "builtin:bracket-1x2-1x4-rounded-bottom",
      "builtin:tile-2x2-triangular",
      "builtin:roller-skate",
      "builtin:arch-1x6-thin-top",
    ]);
    expect(report.catalogInterpretationChanges).toEqual([]);
    expectReviewedCurrentTruthChanges(report, "builtin.basic-parts/13");
    expect(document.parts).toEqual(savedAtThirteen.parts);
  });

  it("carries /14 forward and reports the complete 28802, 35787, 11253 and 15254 definitions", () => {
    const savedAtFourteen = historicalDocument({
      id: "fourteen",
      name: "Saved at /14",
      catalogVersion: "builtin.basic-parts/14",
      catalogHash: "sha256:c2a3556085f8a3a3efe66a2f52d2a70378be04ff52c53a57fbff2f2701cd194c",
      connectorHash: "sha256:537ec8b084b9ac9633c4511817204fcd2037e123d96b7628c3e6b803b32a31cf",
      collisionHash: "sha256:a219f827b9dcceda98b7f320bb53c9f7fa172d515a8081af4b97623975aaf97b",
      transformHash: "sha256:a005d64462b0805e82b28f8571e40aeb48d6b3602b8fe5db01a4e1cf56635896",
      allowedCatalogPartCount: PART_DEFINITIONS.length - 4,
    });

    expect(canonicalDigest(savedAtFourteen.truth)).toBe(
      "sha256:db8c1740f23c65a4c0046c679e321a559623ac18a9c3fe59357b912e3a48a1b3",
    );
    const { document, report } = migrateDocumentTruth(savedAtFourteen);

    expect(report.migrated).toBe(true);
    expect(report.addedCatalogPartIds).toEqual([
      "builtin:bracket-1x2-1x4-rounded-bottom",
      "builtin:tile-2x2-triangular",
      "builtin:roller-skate",
      "builtin:arch-1x6-thin-top",
    ]);
    expect(report.catalogInterpretationChanges).toEqual([]);
    expectReviewedCurrentTruthChanges(report, "builtin.basic-parts/14");
    expect(document.parts).toEqual(savedAtFourteen.parts);
  });

  it("carries /15 forward and reports the complete 35787, 11253 and 15254 definitions", () => {
    const savedAtFifteen = historicalDocument({
      id: "fifteen",
      name: "Saved at /15",
      catalogVersion: "builtin.basic-parts/15",
      catalogHash: "sha256:08e3812b08d6dd9f0b397dd6d79c6ae89c834e43900508ee00410dfb692f9905",
      connectorHash: "sha256:e64815499844dfc745d8d12c3caa0ff2a0ef55777b627f604a44506478999513",
      collisionHash: "sha256:a8a000c6402260d5302cd14c613d6577e74e44811b6f431fbb4269c2cfe75e04",
      transformHash: "sha256:80594a60bb36cb7d9def2c92566aef0d67181c0c9e9983214a673dae59315a53",
      allowedCatalogPartCount: PART_DEFINITIONS.length - 3,
    });

    expect(canonicalDigest(savedAtFifteen.truth)).toBe(
      "sha256:f8e7efbd1bc969ac699fd68db9696af693898a15ffb7901821e676d843240e2f",
    );
    const { document, report } = migrateDocumentTruth(savedAtFifteen);

    expect(report.migrated).toBe(true);
    expect(report.addedCatalogPartIds).toEqual([
      "builtin:tile-2x2-triangular",
      "builtin:roller-skate",
      "builtin:arch-1x6-thin-top",
    ]);
    expect(report.catalogInterpretationChanges).toEqual([]);
    expectReviewedCurrentTruthChanges(report, "builtin.basic-parts/15");
    expect(document.parts).toEqual(savedAtFifteen.parts);
  });

  it("carries /16 forward and reports the complete 11253 and 15254 definitions", () => {
    const savedAtSixteen = historicalDocument({
      id: "sixteen",
      name: "Saved at /16",
      catalogVersion: "builtin.basic-parts/16",
      catalogHash: "sha256:e80f7c99912fba393a549b53549e3f8b9578b48fe5331682ad5e140edca600f6",
      connectorHash: "sha256:6f19cd949127543229d54366a37dd377cb7fbcd8042115c9339aabbbfe4deddc",
      collisionHash: "sha256:8c32b975cd25b5b0417432f28789a1124b97053f1d056ab1b547730ec6899599",
      transformHash: "sha256:34aa4fb3af8d22fbb565fd67beaf48f824a888f68390c6183bab6657768819b2",
      allowedCatalogPartCount: PART_DEFINITIONS.length - 2,
    });

    expect(canonicalDigest(savedAtSixteen.truth)).toBe(
      "sha256:71c76ba1d6740cbaf89b1ab721dba2ffa3136e9d742198b289373ad2205be1be",
    );
    const { document, report } = migrateDocumentTruth(savedAtSixteen);

    expect(report.migrated).toBe(true);
    expect(report.addedCatalogPartIds).toEqual([
      "builtin:roller-skate",
      "builtin:arch-1x6-thin-top",
    ]);
    expect(report.catalogInterpretationChanges).toEqual([]);
    expectReviewedCurrentTruthChanges(report, "builtin.basic-parts/16");
    expect(document.parts).toEqual(savedAtSixteen.parts);
  });

  it("carries /17 forward and reports only the complete 15254 definition", () => {
    const savedAtSeventeen = historicalDocument({
      id: "seventeen",
      name: "Saved at /17",
      catalogVersion: "builtin.basic-parts/17",
      catalogHash: "sha256:c3d7b89c6424a9c7cd1e64c1f672aece15340a6bad5a064106f22dcf21512482",
      connectorHash: "sha256:4d42fd2f6536488797a91766825555d79013f4bb3a71b67fb2f5f10b102e3429",
      collisionVersion: "rectilinear-stud-clearance/3",
      collisionHash: "sha256:bf4d637eae33f2076f3172a131ea941b6fc4656652b47e2e4cb54ad4bc84d89f",
      transformHash: "sha256:3ee89b8113966fac1783cbf13e1a4e0edd12d227128f06e210412dc9d51ebc24",
      validatorVersion: "lego.kernel-validators/3",
      validatorHash: "sha256:fb0676931eb66a0096f393794d0be1297227811a77b986c0a1d05847ee3127d4",
      allowedCatalogPartCount: PART_DEFINITIONS.length - 1,
    });

    expect(canonicalDigest(savedAtSeventeen.truth)).toBe(
      "sha256:d21bdecc6a269b1b92e0915664cae9a147168fe8d7576ee17213e8e9446c7926",
    );
    const { document, report } = migrateDocumentTruth(savedAtSeventeen);

    expect(report.migrated).toBe(true);
    expect(report.addedCatalogPartIds).toEqual(["builtin:arch-1x6-thin-top"]);
    expect(report.catalogInterpretationChanges).toEqual([]);
    expect(report.truthComponentChanges).toEqual([
      {
        component: "catalog",
        fromVersion: "builtin.basic-parts/17",
        toVersion: BUILTIN_CATALOG_VERSION,
      },
    ]);
    expect(document.parts).toEqual(savedAtSeventeen.parts);
  });

  it.each([
    {
      catalogVersion: "builtin.basic-parts/13",
      catalogHash: "sha256:100283423bf1cfecfdfec5ba2216d1834a9eb19b1757c71772f7fa53223190d6",
      futurePartId: "builtin:tile-1x1-quarter-round",
    },
    {
      catalogVersion: "builtin.basic-parts/14",
      catalogHash: "sha256:c2a3556085f8a3a3efe66a2f52d2a70378be04ff52c53a57fbff2f2701cd194c",
      connectorHash: "sha256:537ec8b084b9ac9633c4511817204fcd2037e123d96b7628c3e6b803b32a31cf",
      collisionHash: "sha256:a219f827b9dcceda98b7f320bb53c9f7fa172d515a8081af4b97623975aaf97b",
      transformHash: "sha256:a005d64462b0805e82b28f8571e40aeb48d6b3602b8fe5db01a4e1cf56635896",
      futurePartId: "builtin:bracket-1x2-1x4-rounded-bottom",
    },
    {
      catalogVersion: "builtin.basic-parts/15",
      catalogHash: "sha256:08e3812b08d6dd9f0b397dd6d79c6ae89c834e43900508ee00410dfb692f9905",
      connectorHash: "sha256:e64815499844dfc745d8d12c3caa0ff2a0ef55777b627f604a44506478999513",
      collisionHash: "sha256:a8a000c6402260d5302cd14c613d6577e74e44811b6f431fbb4269c2cfe75e04",
      transformHash: "sha256:80594a60bb36cb7d9def2c92566aef0d67181c0c9e9983214a673dae59315a53",
      futurePartId: "builtin:tile-2x2-triangular",
    },
  ] as const)(
    "refuses $catalogVersion constraints and parts that pre-seed its immediate successor",
    ({ futurePartId, ...source }) => {
      const part = createPartInstance({ id: "future-part", catalogPartId: futurePartId });
      const historical = historicalDocument({
        id: `future-${source.catalogVersion}`,
        name: `Forged ${source.catalogVersion}`,
        ...source,
        part,
      });
      const forged: BrickDocumentV1 = {
        ...historical,
        constraints: {
          ...historical.constraints,
          allowedCatalogPartIds: [...historical.constraints.allowedCatalogPartIds, futurePartId],
        },
      };

      const { document, report } = migrateDocumentTruth(forged);

      expect(document).toBe(forged);
      expect(report.migrated).toBe(false);
      expect(report.blockingReasons).toContain(
        `Part future-part uses catalog part ${futurePartId}, which reviewed source truth ${report.fromTruthHash} (${source.catalogVersion}) did not define; the part cannot be legitimized by migration`,
      );
      expect(report.blockingReasons).toContain(
        `Document constraints allow catalog part ${futurePartId}, which reviewed source truth ${report.fromTruthHash} (${source.catalogVersion}) did not define; remove the future ID or load the document under the truth that introduced it`,
      );
    },
  );

  it("migrates legitimate /16 subset constraints and reports the exact document-level gains", () => {
    const brick = createPartInstance({
      id: "brick",
      catalogPartId: "builtin:brick-2x2",
      colorId: "builtin:red",
    });
    const historical = historicalDocument({
      id: "sixteen-subset",
      name: "Narrow /16",
      catalogVersion: "builtin.basic-parts/16",
      catalogHash: "sha256:e80f7c99912fba393a549b53549e3f8b9578b48fe5331682ad5e140edca600f6",
      connectorHash: "sha256:6f19cd949127543229d54366a37dd377cb7fbcd8042115c9339aabbbfe4deddc",
      collisionHash: "sha256:8c32b975cd25b5b0417432f28789a1124b97053f1d056ab1b547730ec6899599",
      transformHash: "sha256:34aa4fb3af8d22fbb565fd67beaf48f824a888f68390c6183bab6657768819b2",
      part: brick,
    });
    const narrowed: BrickDocumentV1 = {
      ...historical,
      constraints: {
        ...historical.constraints,
        allowedCatalogPartIds: [brick.catalogPartId],
        allowedColorIds: [brick.colorId],
      },
    };

    const { document, report } = migrateDocumentTruth(narrowed);

    expect(report.migrated).toBe(true);
    expect(report.blockingReasons).toEqual([]);
    expect(report.addedCatalogPartIds).toEqual(
      PART_DEFINITIONS.map(({ id }) => id).filter((id) => id !== brick.catalogPartId),
    );
    expect(report.addedColorIds).toEqual(
      COLOR_DEFINITIONS.map(({ id }) => id).filter((id) => id !== brick.colorId),
    );
    expect(document.parts).toEqual(narrowed.parts);
    expect(document.constraints.allowedCatalogPartIds).toHaveLength(PART_DEFINITIONS.length);
    expect(document.constraints.allowedColorIds).toHaveLength(COLOR_DEFINITIONS.length);
    expect(validateBrickDocument(document).documentGloballyValid).toBe(true);
  });

  it("refuses a /16 document whose constraints and parts pre-seed the /17 roller skate", () => {
    const savedAtSixteen = historicalDocument({
      id: "sixteen-future-constraint",
      name: "Forged /16 future constraint",
      catalogVersion: "builtin.basic-parts/16",
      catalogHash: "sha256:e80f7c99912fba393a549b53549e3f8b9578b48fe5331682ad5e140edca600f6",
      connectorHash: "sha256:6f19cd949127543229d54366a37dd377cb7fbcd8042115c9339aabbbfe4deddc",
      collisionHash: "sha256:8c32b975cd25b5b0417432f28789a1124b97053f1d056ab1b547730ec6899599",
      transformHash: "sha256:34aa4fb3af8d22fbb565fd67beaf48f824a888f68390c6183bab6657768819b2",
    });
    const current = createEmptyBrickDocument({ id: "current-roster", name: "Current roster" });
    const skate = createPartInstance({ id: "skate", catalogPartId: "builtin:roller-skate" });
    const forged: BrickDocumentV1 = {
      ...savedAtSixteen,
      parts: [skate],
      submodels: [{ ...savedAtSixteen.submodels[0]!, partIds: [skate.id] }],
      steps: [{ ...savedAtSixteen.steps[0]!, partIds: [skate.id] }],
      constraints: current.constraints,
    };

    const { document, report } = migrateDocumentTruth(forged);

    expect(document).toBe(forged);
    expect(report.migrated).toBe(false);
    expect(report.addedCatalogPartIds).toEqual([]);
    expect(report.blockingReasons).toContain(
      `Document constraints allow catalog part builtin:roller-skate, which reviewed source truth ${report.fromTruthHash} (builtin.basic-parts/16) did not define; remove the future ID or load the document under the truth that introduced it`,
    );
    expect(report.blockingReasons).toContain(
      `Part skate uses catalog part builtin:roller-skate, which reviewed source truth ${report.fromTruthHash} (builtin.basic-parts/16) did not define; the part cannot be legitimized by migration`,
    );
  });

  it("refuses a /16 roller skate even when its constraints omit the future ID", () => {
    const skate = createPartInstance({ id: "skate", catalogPartId: "builtin:roller-skate" });
    const forged = historicalDocument({
      id: "sixteen-future-part",
      name: "Forged /16 future part",
      catalogVersion: "builtin.basic-parts/16",
      catalogHash: "sha256:e80f7c99912fba393a549b53549e3f8b9578b48fe5331682ad5e140edca600f6",
      connectorHash: "sha256:6f19cd949127543229d54366a37dd377cb7fbcd8042115c9339aabbbfe4deddc",
      collisionHash: "sha256:8c32b975cd25b5b0417432f28789a1124b97053f1d056ab1b547730ec6899599",
      transformHash: "sha256:34aa4fb3af8d22fbb565fd67beaf48f824a888f68390c6183bab6657768819b2",
      part: skate,
    });

    const { document, report } = migrateDocumentTruth(forged);

    expect(document).toBe(forged);
    expect(report.migrated).toBe(false);
    expect(report.blockingReasons).not.toContain(
      expect.stringContaining("Document constraints allow catalog part builtin:roller-skate"),
    );
    expect(report.blockingReasons).toContain(
      `Part skate uses catalog part builtin:roller-skate, which reviewed source truth ${report.fromTruthHash} (builtin.basic-parts/16) did not define; the part cannot be legitimized by migration`,
    );
  });

  it("keeps the illicit actual-part reason inside the bounded diagnostic list", () => {
    const skate = createPartInstance({ id: "skate", catalogPartId: "builtin:roller-skate" });
    const historical = historicalDocument({
      id: "sixteen-bounded-errors",
      name: "Forged /16 with many future constraints",
      catalogVersion: "builtin.basic-parts/16",
      catalogHash: "sha256:e80f7c99912fba393a549b53549e3f8b9578b48fe5331682ad5e140edca600f6",
      connectorHash: "sha256:6f19cd949127543229d54366a37dd377cb7fbcd8042115c9339aabbbfe4deddc",
      collisionHash: "sha256:8c32b975cd25b5b0417432f28789a1124b97053f1d056ab1b547730ec6899599",
      transformHash: "sha256:34aa4fb3af8d22fbb565fd67beaf48f824a888f68390c6183bab6657768819b2",
      part: skate,
    });
    const forged: BrickDocumentV1 = {
      ...historical,
      constraints: {
        ...historical.constraints,
        allowedCatalogPartIds: [
          ...historical.constraints.allowedCatalogPartIds,
          ...Array.from({ length: 40 }, (_, index) => `builtin:future-${index}`),
        ],
      },
    };

    const { report } = migrateDocumentTruth(forged);

    expect(report.migrated).toBe(false);
    expect(report.blockingReasons).toHaveLength(32);
    expect(report.blockingReasons[0]).toBe(
      `Part skate uses catalog part builtin:roller-skate, which reviewed source truth ${report.fromTruthHash} (builtin.basic-parts/16) did not define; the part cannot be legitimized by migration`,
    );
  });

  it("carries a /6 document forward and names the twelve parts it gained", () => {
    const document = historicalDocument({
      id: "six",
      name: "Saved at /6",
      catalogVersion: "builtin.basic-parts/6",
      catalogHash: "sha256:590a94c9b9498faace4b29b74c4c9ba8352d644365585d9aeb96b4a7c53bdb7f",
      connectorHash: "sha256:720d9d3f430c388bd4fa47de41f93aed138505642bf9b33b3f6e5ca6a0510dfb",
      collisionHash: "sha256:692e143470b6a19f54299301de79daf74acd75af0ffeefb82437b5e81c6bda2a",
      transformHash: "sha256:535a51b5b102dac0d5788ffecb3c1330d51e0799853d7cc9a1fa1236354f8a09",
      allowedCatalogPartCount: 77,
    });

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
      "builtin:tile-1x1-quarter-round",
      "builtin:bracket-1x2-1x4-rounded-bottom",
      "builtin:tile-2x2-triangular",
      "builtin:roller-skate",
      "builtin:arch-1x6-thin-top",
    ]);
    expect(report.addedColorIds).toEqual([]);
    expectReviewedCurrentTruthChanges(report, "builtin.basic-parts/6");
  });

  it("carries a /7 document forward and names the seven parts it gained", () => {
    // Three earlier additions have no Builder record; 25269's record is not consumed.
    // Builder maps the observed 28802 element to contradictory 10201, so that
    // claim is refused. 35787's unframed native field is also refused. LDCad
    // routes own the admitted clutch fields for all six.
    const document = historicalDocument({
      id: "seven",
      name: "Saved at /7",
      catalogVersion: "builtin.basic-parts/7",
      catalogHash: "sha256:f26a1ba141ca0485f1bf046c68d94082497fcd8dcea85906723a389a09ec55d2",
      connectorHash: "sha256:2f3f165461925f9ba3be532d9b5a2e76836d6eb1c93709f954ae7f6150d8db5e",
      collisionHash: "sha256:c8b66e871ec0e730795ace974befb927844ecd1d99929f94c76cb955287c955c",
      transformHash: "sha256:5d9342646d5f6434e57e0673aa43192d9274e47588e4dc07081960644402b7ca",
      allowedCatalogPartCount: 82,
    });

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
      "builtin:tile-1x1-quarter-round",
      "builtin:bracket-1x2-1x4-rounded-bottom",
      "builtin:tile-2x2-triangular",
      "builtin:roller-skate",
      "builtin:arch-1x6-thin-top",
    ]);
    expect(report.addedColorIds).toEqual([]);
    expectReviewedCurrentTruthChanges(report, "builtin.basic-parts/7");
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
    expect(report.catalogInterpretationChanges).toEqual([]);
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
