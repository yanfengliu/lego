import type { BrickDocumentV1 } from "@lego-studio/protocol";

import { canonicalDigest } from "./canonical.ts";
import { createEmptyBrickDocument } from "./factory.ts";
import { getReviewedHistoricalCatalogRoster } from "./historical-catalog-rosters.ts";

export function documentAtReviewedTruth(options: {
  readonly id: string;
  readonly name: string;
  readonly truth: BrickDocumentV1["truth"];
  readonly part?: BrickDocumentV1["parts"][number];
}): BrickDocumentV1 {
  const current = createEmptyBrickDocument({ id: options.id, name: options.name });
  const truthHash = canonicalDigest(options.truth);
  const sourceRoster = getReviewedHistoricalCatalogRoster(truthHash);
  if (sourceRoster === undefined) {
    throw new Error(`The reviewed roster fixture for ${truthHash} is missing.`);
  }
  const parts = options.part === undefined ? [] : [options.part];
  const partIds = parts.map(({ id }) => id);
  return {
    ...current,
    truth: options.truth,
    parts,
    submodels: [{ ...current.submodels[0]!, partIds }],
    steps: [{ ...current.steps[0]!, partIds }],
    constraints: {
      ...current.constraints,
      allowedCatalogPartIds: [...sourceRoster.catalogPartIds],
      allowedColorIds: [...sourceRoster.colorIds],
    },
  };
}

export const REVIEWED_TRUTH_V1 = {
  schemaVersion: "lego.truth-snapshot/1",
  catalog: {
    id: "builtin.basic-parts",
    version: "builtin.basic-parts/1",
    hash: "sha256:7dfcbd517582cece04114731a1a39dee961c93858ded4f636b39a660850f00f3",
  },
  connectorTaxonomy: {
    id: "stud-tube",
    version: "stud-tube/1",
    hash: "sha256:989e4eecb6f41d91e7287f7f3f03f60ed6bead7134b1a761c046ed5aeaae3f64",
  },
  collisionModel: {
    id: "rectilinear-stud-clearance",
    version: "rectilinear-stud-clearance/1",
    hash: "sha256:ea8e6d5bdb25b039c1870e840afad61985b3cac9b7c00e371382d1950c35436f",
  },
  transformPolicy: {
    id: "upright-quarter-turns-negative-y-up",
    version: "upright-quarter-turns-negative-y-up/1",
    hash: "sha256:2a26f5992c7a554977374f56b247ed5e5e4e9992674ea4a8181395033afa7b07",
  },
  validatorSet: {
    id: "lego.kernel-validators",
    version: "lego.kernel-validators/1",
    hash: "sha256:287a04704c5f94930242b85dda7198b22f6eed195334b55a448a5e60d65e517b",
  },
} as const satisfies BrickDocumentV1["truth"];

function reviewedTruthV4(hashes: {
  readonly catalog: BrickDocumentV1["truth"]["catalog"]["hash"];
  readonly connector: BrickDocumentV1["truth"]["connectorTaxonomy"]["hash"];
  readonly collision: BrickDocumentV1["truth"]["collisionModel"]["hash"];
  readonly transform: BrickDocumentV1["truth"]["transformPolicy"]["hash"];
}): BrickDocumentV1["truth"] {
  return {
    schemaVersion: "lego.truth-snapshot/1",
    catalog: { id: "builtin.basic-parts", version: "builtin.basic-parts/4", hash: hashes.catalog },
    connectorTaxonomy: { id: "stud-tube", version: "stud-tube/1", hash: hashes.connector },
    collisionModel: {
      id: "rectilinear-stud-clearance",
      version: "rectilinear-stud-clearance/1",
      hash: hashes.collision,
    },
    transformPolicy: {
      id: "upright-quarter-turns-negative-y-up",
      version: "upright-quarter-turns-negative-y-up/1",
      hash: hashes.transform,
    },
    validatorSet: REVIEWED_TRUTH_V1.validatorSet,
  };
}

/**
 * The connector deltas /30 gives 15573 against every source truth that has it
 * (/4 on), as `npm run migration-history:check -- --print` derives them: its
 * two grid clutches join shared-capacity groups and a centre seat appears.
 */
export const EXPECTED_JUMPER_1X2_CENTRE_SEAT_CHANGES = [
  {
    partId: "builtin:jumper-plate-1x2",
    portId: "undersideClutch:0:0",
    sourceDigest: "sha256:c15d33f08a5abe76a76463638f2ec6161b7b987b8fd550c7ec3776f0f337c1fb",
    targetDigest: "sha256:f0dfb4e576750a365b47ae6af4434dcae817440b61486a0e7d113ebb9758b5b2",
  },
  {
    partId: "builtin:jumper-plate-1x2",
    portId: "undersideClutch:0:1",
    sourceDigest: "sha256:926847873d79b7422369f1ed9d5688cf2d8578d81035a479ac5cb1c4f7d7ce5e",
    targetDigest: "sha256:ac2dd1ea96cebe00afbefb527188086cdfdd05417799beee63efee79100e7a67",
  },
  {
    partId: "builtin:jumper-plate-1x2",
    portId: "undersideClutch:center",
    sourceDigest: null,
    targetDigest: "sha256:b756d80ea0e8fdd60d88ae20d440470708b2848441d38052207e3e97ed1c7766",
  },
] as const;

/** The 61 parametric parts whose LDraw interchange frame /30 measured, in catalog order. */
export const EXPECTED_V30_LDRAW_FRAME_PART_IDS = [
  "builtin:brick-1x1",
  "builtin:brick-1x2",
  "builtin:brick-1x3",
  "builtin:brick-1x4",
  "builtin:brick-2x2",
  "builtin:brick-2x3",
  "builtin:brick-2x4",
  "builtin:plate-1x1",
  "builtin:plate-1x2",
  "builtin:plate-1x3",
  "builtin:plate-1x4",
  "builtin:plate-2x2",
  "builtin:plate-2x3",
  "builtin:plate-2x4",
  "builtin:brick-1x6",
  "builtin:brick-1x8",
  "builtin:brick-2x6",
  "builtin:brick-2x8",
  "builtin:plate-1x6",
  "builtin:plate-1x8",
  "builtin:plate-2x6",
  "builtin:plate-2x8",
  "builtin:plate-4x4",
  "builtin:plate-4x6",
  "builtin:plate-4x8",
  "builtin:plate-6x6",
  "builtin:tile-1x1",
  "builtin:tile-1x2",
  "builtin:tile-1x4",
  "builtin:tile-1x6",
  "builtin:tile-2x2",
  "builtin:tile-2x4",
  "builtin:plate-1x10",
  "builtin:plate-1x12",
  "builtin:plate-2x10",
  "builtin:plate-2x12",
  "builtin:plate-4x10",
  "builtin:plate-4x12",
  "builtin:plate-6x8",
  "builtin:plate-6x10",
  "builtin:plate-6x12",
  "builtin:plate-6x16",
  "builtin:plate-8x8",
  "builtin:plate-8x16",
  "builtin:brick-1x10",
  "builtin:brick-1x12",
  "builtin:brick-1x16",
  "builtin:brick-2x10",
  "builtin:tile-1x3",
  "builtin:tile-1x8",
  "builtin:tile-2x6",
  "builtin:grille-tile-1x2",
  "builtin:jumper-plate-1x2",
  "builtin:jumper-plate-2x2",
  "builtin:jumper-plate-1x3",
  "builtin:technic-brick-1x2",
  "builtin:axle-1x2",
  "builtin:axle-1x4",
  "builtin:wheel-1x2",
  "builtin:corner-plate-2x2",
  "builtin:plate-2x14",
] as const;

/**
 * The /29 -> /30 rows a report crossing /30 carries, for a source roster that
 * holds every affected part (/6 on). An older roster sees them filtered.
 */
export const EXPECTED_V30_INTERPRETATION_CHANGES = [
  {
    fromCatalogVersion: "builtin.basic-parts/29",
    toCatalogVersion: "builtin.basic-parts/30",
    affectedCatalogPartIds: EXPECTED_V30_LDRAW_FRAME_PART_IDS,
    changedFields: ["ldraw-interchange-frame"],
  },
  {
    fromCatalogVersion: "builtin.basic-parts/29",
    toCatalogVersion: "builtin.basic-parts/30",
    affectedCatalogPartIds: ["builtin:jumper-plate-1x2"],
    changedFields: ["connector-semantics", "collision-semantics"],
  },
] as const;

/** The complete truth source commit 982634d emits at builtin.basic-parts/29. */
export const REVIEWED_TRUTH_V29 = {
  schemaVersion: "lego.truth-snapshot/1",
  catalog: {
    id: "builtin.basic-parts",
    version: "builtin.basic-parts/29",
    hash: "sha256:19c5e8a3f4e1d00d7747c8d3e0f377ee4391acc53915df8ead0c1830b75b8db6",
  },
  connectorTaxonomy: {
    id: "stud-tube",
    version: "stud-tube/2",
    hash: "sha256:b0b8a26e010f522ba88d55f3b8565add619b2e569f15abad59a46ffd2ccf0ddb",
  },
  collisionModel: {
    id: "rectilinear-stud-clearance",
    version: "rectilinear-stud-clearance/4",
    hash: "sha256:b1231af344c0c293e74c0721bd0005f4f7a6746ee144ccf71ca14e22caa07042",
  },
  transformPolicy: {
    id: "part-scoped-proper-orientations-negative-y-up",
    version: "part-scoped-proper-orientations-negative-y-up/1",
    hash: "sha256:44cf428cee1487a9441c609a75fbafefd6c3b4591512af30f8903e4508285f4c",
  },
  validatorSet: {
    id: "lego.kernel-validators",
    version: "lego.kernel-validators/5",
    hash: "sha256:44233e884c474210006e4e94b82e952fd7b446768396d5b53575eb7946cba4fe",
  },
} as const satisfies BrickDocumentV1["truth"];

export const REVIEWED_TRUTHS_V4 = Object.freeze([
  {
    truthHash: "sha256:f48bb1cae251f592923d94b4b992a55c06e74ea49b0f81be9ff4d416bb38e843",
    truth: reviewedTruthV4({
      catalog: "sha256:7e80adbcfb943b8cbe4442197c4827c21429e6f7a1565306817eb7c3b35ee886",
      connector: "sha256:5e33d62097c8da00071915dc8e2e91a78f57d2ad2c5bf5adcff496aeaf646707",
      collision: "sha256:33d0ecfcb722a71ea0994fdb8383c7516d6078854796dd95c0f21958934b1812",
      transform: "sha256:af2ffe0a400f73a7202ee5e4f5a5410a063880db3cb57a3f75464cf8387b6bf7",
    }),
  },
  {
    truthHash: "sha256:4a1dea5f4706dba84aeee1bcbd495fec7eac0f7321e7447979a03a8fb089d3bc",
    truth: reviewedTruthV4({
      catalog: "sha256:76ad2285975cf2418eeaec600a0eee2b387e3195a0c0e9d5b5239168916ed816",
      connector: "sha256:347112b6524e02ce4e90b8dac399966e471cc13c560f72dc9eecb1369fd073a1",
      collision: "sha256:f8bd551bf524fe0625022cfc971caa3e71b0e78d7cc7c70d476da5367be73cc8",
      transform: "sha256:5650cdc3bc3d14c694856aae5d091122cb67b906a1e52533a5058e462740a91e",
    }),
  },
  {
    truthHash: "sha256:6015f52a986a0ed4f5c5310f8b30c2a35b58f8b015025db8804c67e14ff5e9ef",
    truth: reviewedTruthV4({
      catalog: "sha256:0cd09dd318c928759ab059cab79a0fb3765a8ce45ec09064052c6f916a2bb13d",
      connector: "sha256:857b2d2b40777a7a14f1a480678d1c47dc1441478c347f3af3bee935028e54c7",
      collision: "sha256:290f536f9698afd39dcb1436425ade7170d14a5603c74a509044bf0546650c0a",
      transform: "sha256:98ad547d6f94fd2000644dc886e5acb42c34d8688d4d7f1d4c840f273b4e8868",
    }),
  },
]);
