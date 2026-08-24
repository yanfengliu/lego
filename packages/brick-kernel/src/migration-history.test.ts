import { COLOR_DEFINITIONS, PART_DEFINITIONS } from "@lego-studio/catalog";
import { describe, expect, it } from "vitest";

import {
  REVIEWED_HISTORICAL_CATALOG_ROSTERS_BY_TRUTH_HASH,
  getReviewedHistoricalCatalogRoster,
} from "./historical-catalog-rosters.ts";
import { MIGRATABLE_CATALOG_VERSIONS, REVIEWED_HISTORICAL_TRUTH_SNAPSHOTS } from "./migration.ts";

describe("reviewed migration history", () => {
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
    [
      "builtin.basic-parts/18",
      "201fafba454d1db74a986ef0087f84530f96214e",
      "sha256:8172cc4f993b46bb9fa8f782bb2b295c516e95c16f2d6861e4a18219ef2e1b20",
    ],
    [
      "builtin.basic-parts/19",
      "a49137131566247daeb01d80ff88302b41bcf538",
      "sha256:e34fcc8ac627f0dcfdb1d779246a723101d765f931830a4c06514d9daff75c26",
    ],
    [
      "builtin.basic-parts/20",
      "e037b7e60e1240ddf196d381850ae49bc8c80e9b",
      "sha256:9c4c32efcaf9bc5f2a251e77188134075f58ca536c6da6148e34b93419d84ad2",
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
    expect(REVIEWED_HISTORICAL_TRUTH_SNAPSHOTS).toHaveLength(22);
    expect(
      new Set(REVIEWED_HISTORICAL_TRUTH_SNAPSHOTS.map(({ sourceCommit }) => sourceCommit)).size,
    ).toBe(22);
    expect(
      new Set(REVIEWED_HISTORICAL_TRUTH_SNAPSHOTS.map(({ truthHash }) => truthHash)).size,
    ).toBe(22);
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
});
