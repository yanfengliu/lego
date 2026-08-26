export interface ReviewedHistoricalCatalogRoster {
  readonly catalogPartIds: readonly string[];
  readonly colorIds: readonly string[];
}

function extend(base: readonly string[], additions: readonly string[]): readonly string[] {
  return Object.freeze([...base, ...additions]);
}

// These ordered rosters are copied from the catalog tests at the exact commits
// named by REVIEWED_HISTORICAL_TRUTH_SNAPSHOTS. Version /4 was reused while its
// roster grew, so the full truth hash, not the version label, selects a row.
const PART_IDS_V1 = Object.freeze([
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
]);

const PART_IDS_V3 = extend(PART_IDS_V1, [
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
]);

const PART_IDS_V4_55 = extend(PART_IDS_V3, [
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
]);

const PART_IDS_V4_59 = extend(PART_IDS_V4_55, [
  "builtin:wedge-plate-2x4-left",
  "builtin:wedge-plate-2x4-right",
  "builtin:wedge-plate-2x3-left",
  "builtin:wedge-plate-2x3-right",
]);

const PART_IDS_V4_61 = extend(PART_IDS_V4_59, ["builtin:technic-brick-1x2", "builtin:axle-1x2"]);

const PART_IDS_V5 = extend(PART_IDS_V4_61, [
  "builtin:axle-1x4",
  "builtin:wheel-1x2",
  "builtin:arch-1x4",
  "builtin:arch-1x6",
  "builtin:curved-slope-1x2",
  "builtin:curved-slope-1x3",
  "builtin:curved-slope-1x4",
  "builtin:cheese-slope-1x1",
  "builtin:cheese-slope-2x1",
  "builtin:corner-plate-2x2",
]);

const PART_IDS_V6 = extend(PART_IDS_V5, [
  "builtin:plate-2x14",
  "builtin:wedge-plate-4x4-cut-corner",
  "builtin:wedge-plate-6x6-cut-corner",
  "builtin:wedge-plate-3x6-right",
  "builtin:corner-plate-4x4-round",
  "builtin:corner-plate-5x5-quarter-ring",
]);

const PART_IDS_V7 = extend(PART_IDS_V6, [
  "builtin:tile-1x2-cut-right-45",
  "builtin:plate-1x2-round-end",
  "builtin:wedge-plate-2x4-wing",
  "builtin:corner-plate-3x3",
  "builtin:curved-slope-1x4-double",
]);

const PART_IDS_V8 = extend(PART_IDS_V7, [
  "builtin:plate-3x3-corner-round",
  "builtin:wedge-plate-3x3-cut-corner",
  "builtin:corner-plate-2x2-round",
]);

const PART_IDS_V14 = extend(PART_IDS_V8, ["builtin:tile-1x1-quarter-round"]);
const PART_IDS_V15 = extend(PART_IDS_V14, ["builtin:bracket-1x2-1x4-rounded-bottom"]);
const PART_IDS_V16 = extend(PART_IDS_V15, ["builtin:tile-2x2-triangular"]);
const PART_IDS_V17 = extend(PART_IDS_V16, ["builtin:roller-skate"]);
const PART_IDS_V18 = extend(PART_IDS_V17, ["builtin:arch-1x6-thin-top"]);
const PART_IDS_V19 = extend(PART_IDS_V18, ["builtin:bracket-2x2-1x2-vertical-studs"]);
const PART_IDS_V20 = extend(PART_IDS_V19, ["builtin:brick-1x2-grille"]);
const PART_IDS_V21 = extend(PART_IDS_V20, ["builtin:slope-1x2-45"]);
const PART_IDS_V22 = extend(PART_IDS_V21, ["builtin:axle-1x3"]);
const PART_IDS_V23 = extend(PART_IDS_V22, ["builtin:technic-brick-1x2-axle-hole"]);
const PART_IDS_V24 = extend(PART_IDS_V23, ["builtin:plate-3x3"]);
const PART_IDS_V25 = extend(PART_IDS_V24, ["builtin:plate-2x2-two-studs"]);
const PART_IDS_V26 = extend(PART_IDS_V25, ["builtin:plate-1x5"]);

const COLOR_IDS_V1 = Object.freeze([
  "builtin:black",
  "builtin:blue",
  "builtin:green",
  "builtin:red",
  "builtin:yellow",
  "builtin:white",
  "builtin:light-bluish-gray",
  "builtin:dark-bluish-gray",
]);

const COLOR_IDS_V2 = Object.freeze([
  "builtin:black",
  "builtin:blue",
  "builtin:green",
  "builtin:dark-turquoise",
  "builtin:red",
  "builtin:dark-pink",
  "builtin:brown",
  "builtin:light-gray",
  "builtin:dark-gray",
  "builtin:light-blue",
  "builtin:bright-green",
  "builtin:light-turquoise",
  "builtin:salmon",
  "builtin:pink",
  "builtin:yellow",
  "builtin:white",
  "builtin:light-green",
  "builtin:light-yellow",
  "builtin:tan",
  "builtin:light-violet",
  "builtin:purple",
  "builtin:orange",
  "builtin:magenta",
  "builtin:lime",
  "builtin:dark-tan",
  "builtin:bright-pink",
  "builtin:reddish-brown",
  "builtin:light-bluish-gray",
  "builtin:dark-bluish-gray",
  "builtin:medium-blue",
  "builtin:medium-green",
  "builtin:light-pink",
  "builtin:dark-purple",
  "builtin:nougat",
  "builtin:dark-blue",
  "builtin:dark-green",
  "builtin:dark-red",
  "builtin:dark-azure",
  "builtin:medium-azure",
  "builtin:olive-green",
  "builtin:sand-green",
  "builtin:sand-blue",
  "builtin:medium-orange",
  "builtin:dark-orange",
  "builtin:very-light-gray",
]);

function roster(
  catalogPartIds: readonly string[],
  colorIds: readonly string[] = COLOR_IDS_V2,
): ReviewedHistoricalCatalogRoster {
  return Object.freeze({ catalogPartIds, colorIds });
}

export const REVIEWED_HISTORICAL_CATALOG_ROSTERS_BY_TRUTH_HASH: Readonly<
  Record<string, ReviewedHistoricalCatalogRoster>
> = Object.freeze({
  "sha256:0f6b9dcb03a9dd570b4ccc68f41a015bb33422e5cf6c1fe032f1a15bfbd76a8a": roster(
    PART_IDS_V1,
    COLOR_IDS_V1,
  ),
  "sha256:2d980a480fc5b82011b3a09f9e962d74a8e7af068595503ceaa88e9811a7b17a": roster(PART_IDS_V1),
  "sha256:e10d6cd07af66fc3bf9bbb2917992e74bb15f76385ec989bd7e94bcd4cffeedd": roster(PART_IDS_V3),
  "sha256:f48bb1cae251f592923d94b4b992a55c06e74ea49b0f81be9ff4d416bb38e843": roster(PART_IDS_V4_55),
  "sha256:4a1dea5f4706dba84aeee1bcbd495fec7eac0f7321e7447979a03a8fb089d3bc": roster(PART_IDS_V4_59),
  "sha256:6015f52a986a0ed4f5c5310f8b30c2a35b58f8b015025db8804c67e14ff5e9ef": roster(PART_IDS_V4_61),
  "sha256:72657715102652a49e08ae683650758958d5c9fad2235761368269ffd15fc4aa": roster(PART_IDS_V5),
  "sha256:e5ae3655ebac2b16ede784efa82728c2412d0c95021183653b07222ac9d76a09": roster(PART_IDS_V6),
  "sha256:29eaae6325eba701dc52827a9373c7583889ce3fd16fd8057f3c6f243a8ab868": roster(PART_IDS_V7),
  "sha256:33787b02b898a83957e2cc92cff5b8da39da45dfaa3cafcd12f2446e30748613": roster(PART_IDS_V8),
  "sha256:79cca11d5dbee2dd620b20a6cba7815235fefd53bd2f6b3d003586c8d5a1c635": roster(PART_IDS_V8),
  "sha256:17ab2f6c385ecb861526921817a96805b77f29f87574c4eff0c174be6abbe5fb": roster(PART_IDS_V8),
  "sha256:6b784ce4259131b1ed637815b78bbf14a0bd2e92627ce2a8f4d09c3504465c43": roster(PART_IDS_V8),
  "sha256:cdfeae99ea405770f35f83173eec10804078346d257c5e56006707639313ae8e": roster(PART_IDS_V8),
  "sha256:de62fae6dbc8095dfd460983e5e845ddfac4bf9ec2ea1f99572bc46026941cb5": roster(PART_IDS_V8),
  "sha256:db8c1740f23c65a4c0046c679e321a559623ac18a9c3fe59357b912e3a48a1b3": roster(PART_IDS_V14),
  "sha256:f8e7efbd1bc969ac699fd68db9696af693898a15ffb7901821e676d843240e2f": roster(PART_IDS_V15),
  "sha256:71c76ba1d6740cbaf89b1ab721dba2ffa3136e9d742198b289373ad2205be1be": roster(PART_IDS_V16),
  "sha256:d21bdecc6a269b1b92e0915664cae9a147168fe8d7576ee17213e8e9446c7926": roster(PART_IDS_V17),
  "sha256:8172cc4f993b46bb9fa8f782bb2b295c516e95c16f2d6861e4a18219ef2e1b20": roster(PART_IDS_V18),
  "sha256:e34fcc8ac627f0dcfdb1d779246a723101d765f931830a4c06514d9daff75c26": roster(PART_IDS_V19),
  "sha256:9c4c32efcaf9bc5f2a251e77188134075f58ca536c6da6148e34b93419d84ad2": roster(PART_IDS_V20),
  "sha256:44044c90de3bb380f32c26db561bad1bd0f247c22ea35c54d75aa5ec6ef8f9a1": roster(PART_IDS_V21),
  "sha256:7f64021239ab6395a3666f1f72908fd420b73065909822bc68e5226785bfa12e": roster(PART_IDS_V22),
  "sha256:af781e7356e28622fb13afcb571d28495a0962d6aa78ef70d988126a9c4aeefb": roster(PART_IDS_V23),
  "sha256:09288fc048ec112225b9e605df7af2d2e9692031b9eb7a89755575956af4c10d": roster(PART_IDS_V24),
  "sha256:364ef046160736292eb51b331ce27ff246fa8940e16b256d53a68b9656a6018f": roster(PART_IDS_V25),
  "sha256:3226590b11882fea03d8a6370d4ca3c6c8201feaddb56882a243a69acba627e9": roster(PART_IDS_V26),
});

export function getReviewedHistoricalCatalogRoster(
  truthHash: string,
): ReviewedHistoricalCatalogRoster | undefined {
  return REVIEWED_HISTORICAL_CATALOG_ROSTERS_BY_TRUTH_HASH[truthHash];
}
