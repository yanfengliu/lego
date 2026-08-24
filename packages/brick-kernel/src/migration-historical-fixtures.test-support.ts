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
