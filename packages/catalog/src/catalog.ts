import {
  BRICK_HEIGHT_LDU,
  BUILTIN_CATALOG_VERSION,
  COLLISION_MODEL_VERSION,
  CONNECTOR_TAXONOMY_VERSION,
  LDRAW_IDENTIFIER_PROVENANCE,
  PLATE_HEIGHT_LDU,
  PROJECT_CATALOG_PROVENANCE,
  PROJECT_COLOR_PROVENANCE,
  PROJECT_GEOMETRY_PROVENANCE,
  STUD_HEIGHT_LDU,
  STUD_PITCH_LDU,
  STUD_RADIUS_LDU,
  TRANSFORM_POLICY_VERSION,
  UPRIGHT_ORIENTATIONS,
} from "./constants.ts";
import type {
  CatalogAlias,
  CatalogSnapshotDigestInput,
  CollisionAllowance,
  CollisionPrimitive,
  ColorDefinition,
  ConnectorPortDefinition,
  LduBounds,
  PartDefinition,
  PartFamily,
} from "./types.ts";

const deepFreeze = <T>(value: T): T => {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) {
    return value;
  }

  for (const child of Object.values(value as Record<string, unknown>)) {
    deepFreeze(child);
  }
  Object.freeze(value);
  return value;
};

const makeColor = (
  id: string,
  displayName: string,
  displayHex: `#${string}`,
  ldrawCode: number,
): ColorDefinition =>
  deepFreeze({
    id,
    displayName,
    displayHex,
    ldrawCode,
    provenance: PROJECT_COLOR_PROVENANCE,
    ldrawCodeProvenance: LDRAW_IDENTIFIER_PROVENANCE,
  });

/**
 * The palette is catalog truth: every entry is hashed into a document's pinned
 * `TruthSnapshot` and must map to a stable LDraw code so exports round-trip.
 * Entries are therefore only ever added, never renamed or renumbered, and the
 * original eight IDs keep the codes they shipped with.
 */
export const COLOR_DEFINITIONS: readonly ColorDefinition[] = deepFreeze([
  makeColor("builtin:black", "Black", "#05131D", 0),
  makeColor("builtin:blue", "Blue", "#0055BF", 1),
  makeColor("builtin:green", "Green", "#237841", 2),
  makeColor("builtin:dark-turquoise", "Dark Turquoise", "#008F9B", 3),
  makeColor("builtin:red", "Red", "#C91A09", 4),
  makeColor("builtin:dark-pink", "Dark Pink", "#C870A0", 5),
  makeColor("builtin:brown", "Brown", "#583927", 6),
  makeColor("builtin:light-gray", "Light Gray", "#9BA19D", 7),
  makeColor("builtin:dark-gray", "Dark Gray", "#6D6E5C", 8),
  makeColor("builtin:light-blue", "Light Blue", "#B4D2E3", 9),
  makeColor("builtin:bright-green", "Bright Green", "#4B9F4A", 10),
  makeColor("builtin:light-turquoise", "Light Turquoise", "#55A5AF", 11),
  makeColor("builtin:salmon", "Salmon", "#F2705E", 12),
  makeColor("builtin:pink", "Pink", "#FC97AC", 13),
  makeColor("builtin:yellow", "Yellow", "#F2CD37", 14),
  makeColor("builtin:white", "White", "#FFFFFF", 15),
  makeColor("builtin:light-green", "Light Green", "#C2DAB8", 17),
  makeColor("builtin:light-yellow", "Light Yellow", "#FBE696", 18),
  makeColor("builtin:tan", "Tan", "#E4CD9E", 19),
  makeColor("builtin:light-violet", "Light Violet", "#C9CAE2", 20),
  makeColor("builtin:purple", "Purple", "#81007B", 22),
  makeColor("builtin:orange", "Orange", "#FE8A18", 25),
  makeColor("builtin:magenta", "Magenta", "#923978", 26),
  makeColor("builtin:lime", "Lime", "#BBE90B", 27),
  makeColor("builtin:dark-tan", "Dark Tan", "#958A73", 28),
  makeColor("builtin:bright-pink", "Bright Pink", "#E4ADC8", 29),
  makeColor("builtin:reddish-brown", "Reddish Brown", "#582A12", 70),
  makeColor("builtin:light-bluish-gray", "Light Bluish Gray", "#A0A5A9", 71),
  makeColor("builtin:dark-bluish-gray", "Dark Bluish Gray", "#6C6E68", 72),
  makeColor("builtin:medium-blue", "Medium Blue", "#5A93DB", 73),
  makeColor("builtin:medium-green", "Medium Green", "#73DCA1", 74),
  makeColor("builtin:light-pink", "Light Pink", "#FECCCF", 77),
  makeColor("builtin:dark-purple", "Dark Purple", "#3F3691", 85),
  makeColor("builtin:nougat", "Nougat", "#D09168", 92),
  makeColor("builtin:dark-blue", "Dark Blue", "#0A3463", 272),
  makeColor("builtin:dark-green", "Dark Green", "#184632", 288),
  makeColor("builtin:dark-red", "Dark Red", "#720E0F", 320),
  makeColor("builtin:dark-azure", "Dark Azure", "#1498D7", 321),
  makeColor("builtin:medium-azure", "Medium Azure", "#3EC2DD", 322),
  makeColor("builtin:olive-green", "Olive Green", "#77774E", 330),
  makeColor("builtin:sand-green", "Sand Green", "#708E7C", 378),
  makeColor("builtin:sand-blue", "Sand Blue", "#70819A", 379),
  makeColor("builtin:medium-orange", "Medium Orange", "#FFA70B", 462),
  makeColor("builtin:dark-orange", "Dark Orange", "#A95500", 484),
  makeColor("builtin:very-light-gray", "Very Light Gray", "#E6E3DA", 503),
]);

const AVAILABLE_COLOR_IDS: readonly string[] = deepFreeze(COLOR_DEFINITIONS.map(({ id }) => id));
const LEGAL_ORIENTATION_IDS: readonly string[] = deepFreeze(
  UPRIGHT_ORIENTATIONS.map(({ id }) => id),
);

interface PartBlueprint {
  readonly family: PartFamily;
  readonly widthStuds: number;
  readonly lengthStuds: number;
  /** LDraw part identifiers may carry a variant letter, so this is not numeric. */
  readonly ldrawId: `${string}.dat`;
  readonly geometrySha256: string;
  /**
   * Stud centres in LDU from the part's centre. Omit for a stud on every cell,
   * which is what a plate or brick has.
   */
  readonly studOffsetsLdu?: readonly (readonly [x: number, z: number])[];
  /**
   * Slopes one vertical face away, turning the body from a box into a right
   * prism. Measured from the part's own LDraw file rather than guessed.
   */
  readonly bodyWedge?: {
    readonly cutNormalXZ: readonly [x: number, z: number];
    readonly cutOffsetLdu: number;
  };
  /**
   * Distinguishes parts that share a family and a footprint but not a shape —
   * a wedge plate comes in a left and a right that are not interchangeable.
   */
  readonly variant?: string;
}

const PART_BLUEPRINTS = [
  {
    family: "brick",
    widthStuds: 1,
    lengthStuds: 1,
    ldrawId: "3005.dat",
    geometrySha256: "73b89ab50e9bb1c89218d3397ee9c5da57fe2169155f5f72443e8f9d5aead2ab",
  },
  {
    family: "brick",
    widthStuds: 1,
    lengthStuds: 2,
    ldrawId: "3004.dat",
    geometrySha256: "c651efdf0edff93eb58762331bfa4d48ba2e0865da55f30a53f6c463f8808703",
  },
  {
    family: "brick",
    widthStuds: 1,
    lengthStuds: 3,
    ldrawId: "3622.dat",
    geometrySha256: "ec43567075e2e78638a0a1678a64d9053bbe3313a878925d82cb32271867b7e6",
  },
  {
    family: "brick",
    widthStuds: 1,
    lengthStuds: 4,
    ldrawId: "3010.dat",
    geometrySha256: "fb627092b8a0676692026b6f4cdb4b9c7f5df24068c6885af4fdc122ee5b6e39",
  },
  {
    family: "brick",
    widthStuds: 2,
    lengthStuds: 2,
    ldrawId: "3003.dat",
    geometrySha256: "b196de40b90eb315c5a5f9894a7893a5f92f88d7662f828793e81da3fb5d0e2d",
  },
  {
    family: "brick",
    widthStuds: 2,
    lengthStuds: 3,
    ldrawId: "3002.dat",
    geometrySha256: "b32fd84da7361f6d027a3293aafd9736fe355c3dc61b74472ecae3fc63eafe49",
  },
  {
    family: "brick",
    widthStuds: 2,
    lengthStuds: 4,
    ldrawId: "3001.dat",
    geometrySha256: "d0d92d9729acccfe98f150c508ee17afa6989a20e27c6b8e4427c94d164baf7e",
  },
  {
    family: "plate",
    widthStuds: 1,
    lengthStuds: 1,
    ldrawId: "3024.dat",
    geometrySha256: "d7b5377adc7f83d4ef8ac1104b033b1e260e1bc1b32ded4908ab500d8686c7b4",
  },
  {
    family: "plate",
    widthStuds: 1,
    lengthStuds: 2,
    ldrawId: "3023.dat",
    geometrySha256: "8b5f299154c608219620127c7b9c07cd8a91d3f19c824efefe66545109f6a81c",
  },
  {
    family: "plate",
    widthStuds: 1,
    lengthStuds: 3,
    ldrawId: "3623.dat",
    geometrySha256: "be39f9cc8c037195e897c58f9e93c1d07eb471e0907bfdca416870ff63f97807",
  },
  {
    family: "plate",
    widthStuds: 1,
    lengthStuds: 4,
    ldrawId: "3710.dat",
    geometrySha256: "ef4f1243f23310fd10cacd6f6a897488fe3606243bffd401f9252b3f7c0c43a3",
  },
  {
    family: "plate",
    widthStuds: 2,
    lengthStuds: 2,
    ldrawId: "3022.dat",
    geometrySha256: "5cc6be1894fbe90e798bf9f6fd2347c959444772c8ea29e38c3d5af87707e49a",
  },
  {
    family: "plate",
    widthStuds: 2,
    lengthStuds: 3,
    ldrawId: "3021.dat",
    geometrySha256: "68056bca3b64ff8356dfaee3bf76c00a516e6babf346043e22ec081f97dbd28e",
  },
  {
    family: "plate",
    widthStuds: 2,
    lengthStuds: 4,
    ldrawId: "3020.dat",
    geometrySha256: "d8f724a2a69a877ed375fd0af2f972a2f2c9cf8368f8d25f1cd14a4f7fe656fb",
  },
  {
    family: "brick",
    widthStuds: 1,
    lengthStuds: 6,
    ldrawId: "3009.dat",
    geometrySha256: "a39673a7a26bd5134a7def1b874155f9252cf2e1e46dfc268ac6adc3518fac97",
  },
  {
    family: "brick",
    widthStuds: 1,
    lengthStuds: 8,
    ldrawId: "3008.dat",
    geometrySha256: "ce996a13367d204b4fef05dd8847c192f7c7874ec622a6a243bcf917a015d38b",
  },
  {
    family: "brick",
    widthStuds: 2,
    lengthStuds: 6,
    ldrawId: "2456.dat",
    geometrySha256: "12ea8a4b21daf80ac25acde3d471ef66441eac6dbd10dcc43b9590c067830cdf",
  },
  {
    family: "brick",
    widthStuds: 2,
    lengthStuds: 8,
    ldrawId: "3007.dat",
    geometrySha256: "8d9364d50084709518f1231e5a9403076961bf06180d1e4bbca49d15217fe00a",
  },
  {
    family: "plate",
    widthStuds: 1,
    lengthStuds: 6,
    ldrawId: "3666.dat",
    geometrySha256: "af63c4c912633771e191760b46969be3f7c44160b929b47661219204ff1dd704",
  },
  {
    family: "plate",
    widthStuds: 1,
    lengthStuds: 8,
    ldrawId: "3460.dat",
    geometrySha256: "13e20371fb2b7ea6b3f2b9bf1fa9b88ab2b8a21af765804108f2a2957da39580",
  },
  {
    family: "plate",
    widthStuds: 2,
    lengthStuds: 6,
    ldrawId: "3795.dat",
    geometrySha256: "9387b1ffc85a804032119b3a8d4176633ab63dd358689b438cdc1f8849a8dc19",
  },
  {
    family: "plate",
    widthStuds: 2,
    lengthStuds: 8,
    ldrawId: "3034.dat",
    geometrySha256: "ba58c17ea77dbf723f987cc66c9e164ef1f41666ac8cd5d9bfbf61f908f7d4ef",
  },
  {
    family: "plate",
    widthStuds: 4,
    lengthStuds: 4,
    ldrawId: "3031.dat",
    geometrySha256: "7201407ad86f4326a5080c364c9de0e99928e4e2138285721ae30b7d7af0f252",
  },
  {
    family: "plate",
    widthStuds: 4,
    lengthStuds: 6,
    ldrawId: "3032.dat",
    geometrySha256: "764ffd2a23a1f14aba56484bd1648662b4875ec74c52f853f00965815726eaa6",
  },
  {
    family: "plate",
    widthStuds: 4,
    lengthStuds: 8,
    ldrawId: "3035.dat",
    geometrySha256: "0dac4ba95078814da7706149cf474473fbb1ba29c9a37aad5bd83a6f2b98f15a",
  },
  {
    family: "plate",
    widthStuds: 6,
    lengthStuds: 6,
    ldrawId: "3958.dat",
    geometrySha256: "a7d7bbd2f427f284bd9d0afc5797c2b0de9733c3d12196ec106257f88dd74808",
  },
  {
    family: "tile",
    widthStuds: 1,
    lengthStuds: 1,
    ldrawId: "3070b.dat",
    geometrySha256: "a8558d2b0f09ccb2413df94fe8c3d896e6ab604cfdaad56e095cf68d22bd5260",
  },
  {
    family: "tile",
    widthStuds: 1,
    lengthStuds: 2,
    ldrawId: "3069b.dat",
    geometrySha256: "ade47abaa811daec9696fed03a01cbda150cbee2c825ba1225680f05a504edbc",
  },
  {
    family: "tile",
    widthStuds: 1,
    lengthStuds: 4,
    ldrawId: "2431.dat",
    geometrySha256: "8f8d07e5b09f96749db3f042e3f388d0da8bf40c825727838ed4d91414423c6f",
  },
  {
    family: "tile",
    widthStuds: 1,
    lengthStuds: 6,
    ldrawId: "6636.dat",
    geometrySha256: "dde5a0450c18cb4307d85ce8c4ad45291d28bd409f194c7bd95c9c0953bcab7f",
  },
  {
    family: "tile",
    widthStuds: 2,
    lengthStuds: 2,
    ldrawId: "3068b.dat",
    geometrySha256: "bed2affa6477b3c8d05f14700ef8290fb7acba0af1d8fb48b5f6039596da70c4",
  },
  {
    family: "tile",
    widthStuds: 2,
    lengthStuds: 4,
    ldrawId: "87079.dat",
    geometrySha256: "a7f6f08b781a1cc7e31a2a54b156314114a8d428de5be9381950fc4a5cbf1ded",
  },
  {
    family: "plate",
    widthStuds: 1,
    lengthStuds: 10,
    ldrawId: "4477.dat",
    geometrySha256: "e85fb288c822f23d381ada146734f0f525ad0fee0b1180fc9450f597fc1258d3",
  },
  {
    family: "plate",
    widthStuds: 1,
    lengthStuds: 12,
    ldrawId: "60479.dat",
    geometrySha256: "320cac1477590d96249d57e034b1bfa6c759c97d99b8bf98ac7d0e289c0e1bcf",
  },
  {
    family: "plate",
    widthStuds: 2,
    lengthStuds: 10,
    ldrawId: "3832.dat",
    geometrySha256: "47abdc29456bfdc0189c32353bbdc5a8ecde4bb7bb4714d9100e2c523aa7dab0",
  },
  {
    family: "plate",
    widthStuds: 2,
    lengthStuds: 12,
    ldrawId: "2445.dat",
    geometrySha256: "67a8a6a9975e46caba8f504e8cefcd27cf33920971c7857a53369d7795052693",
  },
  {
    family: "plate",
    widthStuds: 4,
    lengthStuds: 10,
    ldrawId: "3030.dat",
    geometrySha256: "02903b5f6bb273ecc413a190244aa13f1a2d7c80f448fe04159c8c170ffa2527",
  },
  {
    family: "plate",
    widthStuds: 4,
    lengthStuds: 12,
    ldrawId: "3029.dat",
    geometrySha256: "ca77fffe94bcf0cc4fcf8ca35d275c90f5666cbc7983e7d6846fcf5bbe56e2f1",
  },
  {
    family: "plate",
    widthStuds: 6,
    lengthStuds: 8,
    ldrawId: "3036.dat",
    geometrySha256: "ec30f8714fbecf194501d1416b77b9ad6402d139c4d4137c436a076d05273730",
  },
  {
    family: "plate",
    widthStuds: 6,
    lengthStuds: 10,
    ldrawId: "3033.dat",
    geometrySha256: "d9afbaf030bae0a9aa371471c3dbc75e16ae6f67c0e1af246d0b53678a76889a",
  },
  {
    family: "plate",
    widthStuds: 6,
    lengthStuds: 12,
    ldrawId: "3028.dat",
    geometrySha256: "80b977099604d230f4f9d5fce3c143d791c6f1bf4f3641ccd4915dce57bab86e",
  },
  {
    family: "plate",
    widthStuds: 6,
    lengthStuds: 16,
    ldrawId: "3027.dat",
    geometrySha256: "539e316384e959dcb3019bb0f9c3f7fe591c5f99655007285cec8e760eb689e2",
  },
  {
    family: "plate",
    widthStuds: 8,
    lengthStuds: 8,
    ldrawId: "41539.dat",
    geometrySha256: "7cc021c5d231d2f2d9906fe6a36cc2480b183b557ea510a982425855225988d2",
  },
  {
    family: "plate",
    widthStuds: 8,
    lengthStuds: 16,
    ldrawId: "92438.dat",
    geometrySha256: "fd5eaa06d59c1aa2ca12e92ecd050b5cf218810ed38cec6af252bcd013d4ea7a",
  },
  {
    family: "brick",
    widthStuds: 1,
    lengthStuds: 10,
    ldrawId: "6111.dat",
    geometrySha256: "52901c059aed63ed1f60628c851b7cd35018f6156a15830aa47652de2e65dade",
  },
  {
    family: "brick",
    widthStuds: 1,
    lengthStuds: 12,
    ldrawId: "6112.dat",
    geometrySha256: "d0ef7b58ea4fde2e5f76921c62508d95ab80215bf6d21719f95707fe78a9d07a",
  },
  {
    family: "brick",
    widthStuds: 1,
    lengthStuds: 16,
    ldrawId: "2465.dat",
    geometrySha256: "e622810c1f697ca04bd28a8aea4c5916c06597dee309f703b0b4584ef21e3f70",
  },
  {
    family: "brick",
    widthStuds: 2,
    lengthStuds: 10,
    ldrawId: "3006.dat",
    geometrySha256: "69ca426ba04162c18c816edfbe60f4572a1509ee87547678a00957b5cb3260f9",
  },
  {
    family: "tile",
    widthStuds: 1,
    lengthStuds: 3,
    ldrawId: "63864.dat",
    geometrySha256: "e85e6f599984e9d3e1e8a04c4777f334d05025e47ba653e8dc9f6dc1c1a6c3f4",
  },
  {
    family: "tile",
    widthStuds: 1,
    lengthStuds: 8,
    ldrawId: "4162.dat",
    geometrySha256: "0cecd6a8e819ab911948785ee3d9da4acaacbd1630b5bc4f8430b685ffa3dec8",
  },
  {
    family: "tile",
    widthStuds: 2,
    lengthStuds: 6,
    ldrawId: "69729.dat",
    geometrySha256: "06b4318dcc0118d86793a68e28b6a64498351f0caac04f1f56537819f24dcf40",
  },
  {
    family: "grille-tile",
    widthStuds: 1,
    lengthStuds: 2,
    ldrawId: "2412b.dat",
    geometrySha256: "a934c3222aa8971918d4f6f91b7c13fa530cd0f2c2625235310035e1cd313d89",
  },
  {
    family: "jumper-plate",
    widthStuds: 1,
    lengthStuds: 2,
    ldrawId: "15573.dat",
    studOffsetsLdu: [[0, 0]],
    geometrySha256: "5c01813b69245ec073dbd5b30051180eef39c3bc525d0e19e888b60ba91f2662",
  },
  {
    family: "jumper-plate",
    widthStuds: 2,
    lengthStuds: 2,
    ldrawId: "87580.dat",
    studOffsetsLdu: [[0, 0]],
    geometrySha256: "f9a8c90a7e2ec0ce7138267abc2aa41d95f487f9a588b6c20d55af015e484a97",
  },
  {
    family: "jumper-plate",
    widthStuds: 1,
    lengthStuds: 3,
    ldrawId: "34103.dat",
    // "Offset" in the part's name: the two studs sit half a pitch off the cell
    // grid, at the boundaries between cells, not on the outer cells.
    studOffsetsLdu: [
      [0, -10],
      [0, 10],
    ],
    geometrySha256: "310166865a722342abdd48cd8bcd312716f935e440f7c312c2d9df7b3d7bc17c",
  },
  {
    family: "wedge-plate",
    widthStuds: 2,
    lengthStuds: 4,
    variant: "left",
    ldrawId: "41770a.dat",
    studOffsetsLdu: [
      [-10, -30],
      [-10, -10],
      [-10, 10],
      [-10, 30],
    ],
    bodyWedge: { cutNormalXZ: [4, -1], cutOffsetLdu: 40 },
    geometrySha256: "f0a7d07de1e70ebcfafc25609a2f4859eeb5e060452fcf5ffcfca448a50e936a",
  },
  {
    family: "wedge-plate",
    widthStuds: 2,
    lengthStuds: 4,
    variant: "right",
    ldrawId: "41769a.dat",
    studOffsetsLdu: [
      [10, -30],
      [10, -10],
      [10, 10],
      [10, 30],
    ],
    bodyWedge: { cutNormalXZ: [-4, -1], cutOffsetLdu: 40 },
    geometrySha256: "01fe4912925c0adad52815bd1ff44c447e0f0ef47191ae2ccc6d993c8ddde9fc",
  },
  {
    family: "wedge-plate",
    widthStuds: 2,
    lengthStuds: 3,
    variant: "left",
    ldrawId: "43723a.dat",
    studOffsetsLdu: [
      [-10, -20],
      [-10, 0],
      [-10, 20],
    ],
    bodyWedge: { cutNormalXZ: [3, -1], cutOffsetLdu: 30 },
    geometrySha256: "07f5e2351292bbc7779a5b0a6080e3d4da241c365ddcaceff3f86805be3d96f0",
  },
  {
    family: "wedge-plate",
    widthStuds: 2,
    lengthStuds: 3,
    variant: "right",
    ldrawId: "43722a.dat",
    studOffsetsLdu: [
      [10, -20],
      [10, 0],
      [10, 20],
    ],
    bodyWedge: { cutNormalXZ: [-3, -1], cutOffsetLdu: 30 },
    geometrySha256: "bf94e0979d89b8e27d2c29ec02deb3730716fdad78177b20497504d1ee0f3d32",
  },
] as const satisfies readonly PartBlueprint[];

const makeAliases = (displayName: string, ldrawId: `${string}.dat`): readonly CatalogAlias[] =>
  deepFreeze([
    {
      namespace: "human",
      value: displayName,
      qualifiedValue: `human:${displayName}`,
      provenance: PROJECT_CATALOG_PROVENANCE,
    },
    {
      namespace: "ldraw",
      value: ldrawId,
      qualifiedValue: `ldraw:${ldrawId}`,
      provenance: LDRAW_IDENTIFIER_PROVENANCE,
    },
  ]);

/** Tiles and grille tiles are plate-height but present a smooth top, so they carry no studs. */
const isStudded = (family: PartFamily): boolean => family !== "tile" && family !== "grille-tile";

const familyHeightLdu = (family: PartFamily): number =>
  family === "brick" ? BRICK_HEIGHT_LDU : PLATE_HEIGHT_LDU;

const FAMILY_DISPLAY_NAMES: Readonly<Record<PartFamily, string>> = Object.freeze({
  brick: "Brick",
  plate: "Plate",
  tile: "Tile",
  "jumper-plate": "Jumper plate",
  "grille-tile": "Grille tile",
  "wedge-plate": "Wedge plate",
});

/**
 * A part with no explicit stud offsets hashes exactly as it did before offsets
 * existed, so adding them did not re-hash the thirty-two parts before it.
 */
const makeGeometryDigestInput = (
  family: PartFamily,
  widthStuds: number,
  lengthStuds: number,
  heightLdu: number,
  studOffsetsLdu: readonly (readonly [number, number])[] | undefined,
  bodyWedge: PartBlueprint["bodyWedge"],
): string =>
  JSON.stringify({
    generatorId: "builtin:parametric-rectilinear-part/1",
    family,
    widthStuds,
    lengthStuds,
    heightLdu,
    studPitchLdu: STUD_PITCH_LDU,
    studRadiusLdu: STUD_RADIUS_LDU,
    studHeightLdu: STUD_HEIGHT_LDU,
    studMode: studModeFor(family, studOffsetsLdu),
    undersideMode: "semantic-tube-seat-grid",
    ...(studOffsetsLdu === undefined ? {} : { studOffsetsLdu }),
    ...(bodyWedge === undefined ? {} : { bodyMode: "wedge-prism", bodyWedge }),
  });

const studModeFor = (
  family: PartFamily,
  studOffsetsLdu: readonly (readonly [number, number])[] | undefined,
): "cylinder-grid" | "cylinder-offsets" | "none" => {
  if (!isStudded(family)) return "none";
  return studOffsetsLdu === undefined ? "cylinder-grid" : "cylinder-offsets";
};

const makePart = (blueprint: PartBlueprint): PartDefinition => {
  const { family, widthStuds, lengthStuds, studOffsetsLdu, bodyWedge } = blueprint;
  const studded = isStudded(family);
  const heightLdu = familyHeightLdu(family);
  const widthLdu = widthStuds * STUD_PITCH_LDU;
  const lengthLdu = lengthStuds * STUD_PITCH_LDU;
  const topY = -heightLdu / 2;
  const bottomY = heightLdu / 2;
  const variantSuffix = blueprint.variant === undefined ? "" : `-${blueprint.variant}`;
  const displayName =
    `${FAMILY_DISPLAY_NAMES[family]} ${widthStuds} x ${lengthStuds}` +
    (blueprint.variant === undefined
      ? ""
      : ` ${blueprint.variant[0]!.toUpperCase()}${blueprint.variant.slice(1)}`);
  const id = `builtin:${family}-${widthStuds}x${lengthStuds}${variantSuffix}`;
  const bodyBoundsLdu: LduBounds = {
    min: [-widthLdu / 2, topY, -lengthLdu / 2],
    max: [widthLdu / 2, bottomY, lengthLdu / 2],
  };
  const boundsLdu: LduBounds = {
    min: [-widthLdu / 2, studded ? topY - STUD_HEIGHT_LDU : topY, -lengthLdu / 2],
    max: [widthLdu / 2, bottomY, lengthLdu / 2],
  };
  const connectors: ConnectorPortDefinition[] = [];
  const primitives: CollisionPrimitive[] = [
    bodyWedge
      ? {
          id: "body",
          kind: "wedge",
          tag: "body",
          minLdu: bodyBoundsLdu.min,
          maxLdu: bodyBoundsLdu.max,
          cutNormalXZ: bodyWedge.cutNormalXZ,
          cutOffsetLdu: bodyWedge.cutOffsetLdu,
        }
      : {
          id: "body",
          kind: "box",
          tag: "body",
          minLdu: bodyBoundsLdu.min,
          maxLdu: bodyBoundsLdu.max,
        },
  ];

  /**
   * A cell of the footprint the body actually fills. A wedge's tapered corner
   * is empty, so putting an underside clutch there would offer a connection to
   * thin air; leaving it out refuses a placement the real part cannot hold,
   * which is the safe direction to be wrong in.
   */
  const cellIsSolid = (x: number, z: number): boolean =>
    bodyWedge === undefined ||
    bodyWedge.cutNormalXZ[0] * x + bodyWedge.cutNormalXZ[1] * z <= bodyWedge.cutOffsetLdu;
  const allowances: CollisionAllowance[] = [];

  for (let xIndex = 0; xIndex < widthStuds; xIndex += 1) {
    for (let zIndex = 0; zIndex < lengthStuds; zIndex += 1) {
      const x = (xIndex - (widthStuds - 1) / 2) * STUD_PITCH_LDU;
      const z = (zIndex - (lengthStuds - 1) / 2) * STUD_PITCH_LDU;

      if (!cellIsSolid(x, z)) continue;

      if (studded && studOffsetsLdu === undefined) {
        connectors.push({
          id: `stud:${xIndex}:${zIndex}`,
          kind: "stud",
          geometryRole: "stud",
          profileId: CONNECTOR_TAXONOMY_VERSION,
          positionLdu: [x, topY, z],
          normal: [0, -1, 0],
          orientationId: "connector-up",
          capacity: 1,
          compatibleKinds: ["undersideClutch"],
        });
        primitives.push({
          id: `stud:${xIndex}:${zIndex}`,
          kind: "cylinder",
          tag: "stud",
          axis: "y",
          centerLdu: [x, topY - STUD_HEIGHT_LDU / 2, z],
          radiusLdu: STUD_RADIUS_LDU,
          heightLdu: STUD_HEIGHT_LDU,
        });
      }
      connectors.push({
        id: `undersideClutch:${xIndex}:${zIndex}`,
        kind: "undersideClutch",
        geometryRole: "tubeSeat",
        profileId: CONNECTOR_TAXONOMY_VERSION,
        positionLdu: [x, bottomY, z],
        normal: [0, 1, 0],
        orientationId: "connector-down",
        capacity: 1,
        compatibleKinds: ["stud"],
      });
      allowances.push({
        id: `tubeSeat:${xIndex}:${zIndex}`,
        portId: `undersideClutch:${xIndex}:${zIndex}`,
        portKind: "undersideClutch",
        incomingPrimitiveTag: "stud",
        centerLdu: [x, bottomY - STUD_HEIGHT_LDU / 2, z],
        radiusLdu: STUD_RADIUS_LDU,
        maxInsertionDepthLdu: STUD_HEIGHT_LDU,
        requiresValidatedConnection: true,
      });
    }
  }

  if (studded && studOffsetsLdu !== undefined) {
    studOffsetsLdu.forEach(([x, z], index) => {
      connectors.push({
        id: `stud:${index}`,
        kind: "stud",
        geometryRole: "stud",
        profileId: CONNECTOR_TAXONOMY_VERSION,
        positionLdu: [x, topY, z],
        normal: [0, -1, 0],
        orientationId: "connector-up",
        capacity: 1,
        compatibleKinds: ["undersideClutch"],
      });
      primitives.push({
        id: `stud:${index}`,
        kind: "cylinder",
        tag: "stud",
        axis: "y",
        centerLdu: [x, topY - STUD_HEIGHT_LDU / 2, z],
        radiusLdu: STUD_RADIUS_LDU,
        heightLdu: STUD_HEIGHT_LDU,
      });
    });
  }

  return deepFreeze({
    id,
    family,
    displayName,
    aliases: makeAliases(displayName, blueprint.ldrawId),
    dimensions: { widthStuds, lengthStuds, widthLdu, lengthLdu, heightLdu },
    bodyBoundsLdu,
    boundsLdu,
    geometry: {
      generatorId: "builtin:parametric-rectilinear-part/1",
      digestInput: makeGeometryDigestInput(
        family,
        widthStuds,
        lengthStuds,
        heightLdu,
        studOffsetsLdu,
        bodyWedge,
      ),
      contentHash: `sha256:${blueprint.geometrySha256}`,
      bodyMode: bodyWedge ? "compound" : "rectangular-prism",
      studMode: studModeFor(family, studOffsetsLdu),
      ...(studOffsetsLdu === undefined ? {} : { studOffsetsLdu }),
      undersideMode: "semantic-tube-seat-grid",
      studRadiusLdu: STUD_RADIUS_LDU,
      studHeightLdu: STUD_HEIGHT_LDU,
      provenance: PROJECT_GEOMETRY_PROVENANCE,
    },
    connectors,
    legalOrientationIds: LEGAL_ORIENTATION_IDS,
    collision: { modelVersion: COLLISION_MODEL_VERSION, primitives, allowances },
    availableColorIds: AVAILABLE_COLOR_IDS,
    substitutionGroupId: `${family}:${widthStuds}x${lengthStuds}${variantSuffix}`,
    inventory: {
      availability: "builtin-unlimited",
      knownMassGrams: null,
      physicalAvailabilityClaimed: false,
    },
    provenance: PROJECT_CATALOG_PROVENANCE,
  });
};

export const PART_DEFINITIONS: readonly PartDefinition[] = deepFreeze(
  PART_BLUEPRINTS.map(makePart),
);

const normalizeLookupKey = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/\s*x\s*/g, "x");

const partIdByLookupKey = new Map<string, string>();
for (const part of PART_DEFINITIONS) {
  partIdByLookupKey.set(normalizeLookupKey(part.id), part.id);
  for (const alias of part.aliases) {
    partIdByLookupKey.set(normalizeLookupKey(alias.value), part.id);
    partIdByLookupKey.set(normalizeLookupKey(alias.qualifiedValue), part.id);
  }
}

const partById = new Map(PART_DEFINITIONS.map((part) => [part.id, part] as const));

const colorById = new Map(COLOR_DEFINITIONS.map((color) => [color.id, color] as const));

export const resolvePartId = (idOrAlias: string): string | undefined =>
  partIdByLookupKey.get(normalizeLookupKey(idOrAlias));

export const getPartDefinition = (idOrAlias: string): PartDefinition | undefined => {
  const id = resolvePartId(idOrAlias);
  return id === undefined ? undefined : partById.get(id);
};

export const getColorDefinition = (id: string): ColorDefinition | undefined => colorById.get(id);

export const BUILTIN_CATALOG: CatalogSnapshotDigestInput = deepFreeze({
  schemaVersion: "catalog-digest-input/1",
  catalogVersion: BUILTIN_CATALOG_VERSION,
  connectorTaxonomyVersion: CONNECTOR_TAXONOMY_VERSION,
  collisionModelVersion: COLLISION_MODEL_VERSION,
  transformPolicyVersion: TRANSFORM_POLICY_VERSION,
  coordinateSystem: { upAxis: "-Y", unit: "LDU", studPitchLdu: STUD_PITCH_LDU },
  provenanceLayers: [
    PROJECT_CATALOG_PROVENANCE,
    PROJECT_GEOMETRY_PROVENANCE,
    PROJECT_COLOR_PROVENANCE,
    LDRAW_IDENTIFIER_PROVENANCE,
  ],
  orientations: UPRIGHT_ORIENTATIONS,
  colors: COLOR_DEFINITIONS,
  parts: PART_DEFINITIONS,
});

export const getCatalogSnapshotDigestInput = (): CatalogSnapshotDigestInput => BUILTIN_CATALOG;
