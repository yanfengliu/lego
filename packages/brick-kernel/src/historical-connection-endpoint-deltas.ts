import type { ConnectionSemanticsEndpointDelta } from "./connection-semantics-projection.ts";
import { deepFreeze } from "./canonical.ts";
import type { ReviewedCarriedEndpointDelta } from "./historical-connection-carry-forward.ts";
import { CAPACITY_CELLS_ADDED_FOR_ABSENT_PEERS } from "./historical-connection-carry-forward.ts";

/**
 * The reviewed connector endpoint deltas from each historical source truth to
 * the current catalog, composed into one list per source truth.
 * `historical-connection-semantics.ts` binds each list to the truth hashes it
 * covers; `npm run migration-history:check` re-derives each truth's list from
 * its source commit and fails when they differ.
 */

/**
 * /30 gives 15573 a centre underside seat, and its two grid clutches join
 * shared-capacity groups with it. The two grid clutches read the same in every
 * source truth that has the part (/4 on), so every such source carries these
 * three deltas.
 */
export const JUMPER_1X2_CENTRE_SEAT_CHANGES = deepFreeze([
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
] as const satisfies readonly ConnectionSemanticsEndpointDelta[]);

/**
 * The two 15573 changes above that migration carries a saved edge across.
 * Each grid clutch changes only by joining one shared-capacity group, whose
 * other member is the centre seat no source truth had. A row whose deltas
 * hold one of these exact changes carries it (`historical-connection-semantics.ts`),
 * and `npm run migration-history:check` proves the class for that row.
 */
export const REVIEWED_CARRIED_ENDPOINT_DELTAS = deepFreeze([
  {
    ...JUMPER_1X2_CENTRE_SEAT_CHANGES[0],
    deltaClass: CAPACITY_CELLS_ADDED_FOR_ABSENT_PEERS,
    addedSharedCapacityGroupIds: ["15573:negative-z-half"],
    reportedUnderCatalogVersion: "builtin.basic-parts/30",
  },
  {
    ...JUMPER_1X2_CENTRE_SEAT_CHANGES[1],
    deltaClass: CAPACITY_CELLS_ADDED_FOR_ABSENT_PEERS,
    addedSharedCapacityGroupIds: ["15573:positive-z-half"],
    reportedUnderCatalogVersion: "builtin.basic-parts/30",
  },
] as const satisfies readonly ReviewedCarriedEndpointDelta[]);

const WEDGE_REMOVALS = deepFreeze([
  {
    partId: "builtin:wedge-plate-2x3-left",
    portId: "undersideClutch:1:1",
    sourceDigest: "sha256:7d96a286162e774ac4c24732fab2e9c57ac11ba7e034f65e76fd715602bdbd30",
    targetDigest: null,
  },
  {
    partId: "builtin:wedge-plate-2x3-left",
    portId: "undersideClutch:1:2",
    sourceDigest: "sha256:b26977099aad1fc173d2cfae62f56815e6e5078d8eb775a418a81195322a9928",
    targetDigest: null,
  },
  {
    partId: "builtin:wedge-plate-2x3-right",
    portId: "undersideClutch:0:1",
    sourceDigest: "sha256:0577e1f3ae1151b349926f80f5b8d196e5202b37d1a147943dfb26e7bffbfd8a",
    targetDigest: null,
  },
  {
    partId: "builtin:wedge-plate-2x3-right",
    portId: "undersideClutch:0:2",
    sourceDigest: "sha256:81f931ab2b883dce44a67f2c883025902099a7366de1f0888d6cc6711a579795",
    targetDigest: null,
  },
  {
    partId: "builtin:wedge-plate-2x4-left",
    portId: "undersideClutch:1:2",
    sourceDigest: "sha256:817f199f36c98c9d125a5e407ae9dd0655892042a309e04bba3b7d40504a280a",
    targetDigest: null,
  },
  {
    partId: "builtin:wedge-plate-2x4-right",
    portId: "undersideClutch:0:2",
    sourceDigest: "sha256:a3cb899561a06dafcde3c672e3b305a4b185b5c07b2ccc720bcc2f64569ea131",
    targetDigest: null,
  },
] as const satisfies readonly ConnectionSemanticsEndpointDelta[]);

export const JUMPER_CHANGES = deepFreeze([
  ...JUMPER_1X2_CENTRE_SEAT_CHANGES,
  {
    partId: "builtin:jumper-plate-1x3",
    portId: "stud:0",
    sourceDigest: "sha256:589e90f7cada0e991ece593d547b997fd108125ce85d133576957495b3919d36",
    targetDigest: "sha256:173a337c5cee0cdcf428790641da69f1fc80633160ac05e5c397e5ecb3ff7240",
  },
  {
    partId: "builtin:jumper-plate-1x3",
    portId: "stud:1",
    sourceDigest: "sha256:c912c87f3a6e9f976319b7e016a1162205385e4de2bb25e2c56ee538462c5469",
    targetDigest: "sha256:3c39749aac7bc93b9b045fa0db709f2efb118f584124e25afd300972206f0b6b",
  },
] as const satisfies readonly ConnectionSemanticsEndpointDelta[]);

export const JUMPER_AND_WEDGE_CHANGES = deepFreeze([
  ...JUMPER_1X2_CENTRE_SEAT_CHANGES,
  ...WEDGE_REMOVALS,
] as const satisfies readonly ConnectionSemanticsEndpointDelta[]);

export const AXLE_JUMPER_AND_WEDGE_CHANGES = deepFreeze([
  {
    partId: "builtin:axle-1x2",
    portId: "axle:1",
    sourceDigest: "sha256:00a6dcd9f9f4f550a4101f6856c8a7daa2471700c0fc8084696a6a46ee44349f",
    targetDigest: "sha256:86ec517d52162afd0c77393514529fb4cff365455388d7a1bbdfcc4d8bfc73b8",
  },
  {
    partId: "builtin:axle-1x2",
    portId: "axle:2",
    sourceDigest: null,
    targetDigest: "sha256:d0684e2d606d8018d12d576e38dd09fed13684135d93e3bd60bf2e57497b4dbd",
  },
  ...JUMPER_AND_WEDGE_CHANGES,
] as const satisfies readonly ConnectionSemanticsEndpointDelta[]);

const TECHNIC_BRICK_1X2_AXLE_HOLE_THROUGH_BORE_CHANGE = deepFreeze({
  partId: "builtin:technic-brick-1x2-axle-hole",
  portId: "axleHole:0",
  sourceDigest: "sha256:5b3166a63945434503bd33561dea6e46ecafccff07184cfa7e4352b4823d278b",
  targetDigest: "sha256:8492dfdbf8872bc38cb469a3aad2fe6766c8081324df2eb03a00ca9c5c027570",
} as const satisfies ConnectionSemanticsEndpointDelta);

const TECHNIC_BRICK_1X1_AXLE_HOLE_THROUGH_BORE_CHANGE = deepFreeze({
  partId: "builtin:technic-brick-1x1-axle-hole",
  portId: "axleHole:0",
  sourceDigest: "sha256:4d9edf941f68ee2fd09361212dd188deaadec9ea1d2e6a08c7048b6ef6016c7a",
  targetDigest: "sha256:1129ccb8e7e4bd94dd789e33bf2c63c140327b5bc99588d57fd49cedf232171a",
} as const satisfies ConnectionSemanticsEndpointDelta);

const VALIDATED_STUD_PROFILE_CHANGES_CORNER_3X3 = deepFreeze([
  {
    partId: "builtin:corner-plate-3x3",
    portId: "stud:0",
    sourceDigest: "sha256:b4d12e16864626ccce9f50bb777794fc72156deffb32bfe0448c5e16244dba68",
    targetDigest: "sha256:6d18cd98abc61c5dc6e8f7c2150b01e4c1f3399e221cb7ea98490bc9469b47a2",
  },
  {
    partId: "builtin:corner-plate-3x3",
    portId: "stud:1",
    sourceDigest: "sha256:195df048f7d475bd6df93b81478072f4eee964d10d84e8b352b851ac15f1f35d",
    targetDigest: "sha256:818aa1ea00dda1905b5cb318b11ad6e4838c7505b80c77ab6cf03da81af71541",
  },
  {
    partId: "builtin:corner-plate-3x3",
    portId: "stud:2",
    sourceDigest: "sha256:d2773b502cb1d1460734790599e41ed63a47dab2728babed42715fbad1793e37",
    targetDigest: "sha256:de7980c09429e9eefdeb3dfdcc24a3548ca897a9468f4d518edfd037fd4bd849",
  },
  {
    partId: "builtin:corner-plate-3x3",
    portId: "stud:3",
    sourceDigest: "sha256:a3617bbbe630e0e586d0ca9d66cec0b56aea7a083db132476de8cd59071dbd4a",
    targetDigest: "sha256:f663b690d61fe1c87f9b64b7fc57073d24e07b3542a588c559661b6768dd7891",
  },
  {
    partId: "builtin:corner-plate-3x3",
    portId: "stud:4",
    sourceDigest: "sha256:9ad1f20c13c6b6ab63de3e425ced0f525b375e81a83bfc29eb98ea34cabe657b",
    targetDigest: "sha256:7c6b8a5c08fdc858a65625629e6bd28abebd6b9c8c954911ea26b792d6ac8223",
  },
] as const satisfies readonly ConnectionSemanticsEndpointDelta[]);

const VALIDATED_STUD_PROFILE_CHANGES_ROUND_END = deepFreeze([
  {
    partId: "builtin:plate-1x2-round-end",
    portId: "stud:0",
    sourceDigest: "sha256:fd0ba97932bf9f7b92d4ec059528c9c2f1e1f0a335099b76bc103ec3ae79dad8",
    targetDigest: "sha256:15158510ad11e069e314bf31698a6c1795710b51f1fe8dfb7ea2570610e75484",
  },
  {
    partId: "builtin:plate-1x2-round-end",
    portId: "stud:1",
    sourceDigest: "sha256:eeb004d5b764e4cdf679b11579c3bcf43c613e0c3ac7ec400cc09935bb3d7354",
    targetDigest: "sha256:f0d3dc36b90755df22edc81c27aad0d5ac201123c5e7f3611742fed0bee2411b",
  },
] as const satisfies readonly ConnectionSemanticsEndpointDelta[]);

const VALIDATED_STUD_PROFILE_CHANGES_30357 = deepFreeze([
  {
    partId: "builtin:plate-3x3-corner-round",
    portId: "stud:0",
    sourceDigest: "sha256:b4d12e16864626ccce9f50bb777794fc72156deffb32bfe0448c5e16244dba68",
    targetDigest: "sha256:6d18cd98abc61c5dc6e8f7c2150b01e4c1f3399e221cb7ea98490bc9469b47a2",
  },
  {
    partId: "builtin:plate-3x3-corner-round",
    portId: "stud:1",
    sourceDigest: "sha256:195df048f7d475bd6df93b81478072f4eee964d10d84e8b352b851ac15f1f35d",
    targetDigest: "sha256:818aa1ea00dda1905b5cb318b11ad6e4838c7505b80c77ab6cf03da81af71541",
  },
  {
    partId: "builtin:plate-3x3-corner-round",
    portId: "stud:2",
    sourceDigest: "sha256:d2773b502cb1d1460734790599e41ed63a47dab2728babed42715fbad1793e37",
    targetDigest: "sha256:de7980c09429e9eefdeb3dfdcc24a3548ca897a9468f4d518edfd037fd4bd849",
  },
  {
    partId: "builtin:plate-3x3-corner-round",
    portId: "stud:3",
    sourceDigest: "sha256:a3617bbbe630e0e586d0ca9d66cec0b56aea7a083db132476de8cd59071dbd4a",
    targetDigest: "sha256:f663b690d61fe1c87f9b64b7fc57073d24e07b3542a588c559661b6768dd7891",
  },
  {
    partId: "builtin:plate-3x3-corner-round",
    portId: "stud:4",
    sourceDigest: "sha256:c9c2f5ba3750b8541edfcf96d7e327012de62b1f8d5b7beedbe288ec531b3211",
    targetDigest: "sha256:9e132e923f9f4706395854a5d7d9efe521415064f9490af07155aafffe42930c",
  },
  {
    partId: "builtin:plate-3x3-corner-round",
    portId: "stud:5",
    sourceDigest: "sha256:3d0afb2f3e960b3d5ca8bae04197e2a390843f998fc7d8f63b9003bbed034b67",
    targetDigest: "sha256:99c6951c4839d6a98e31891b312b12c3530a86203f9b04794a873c17706c500b",
  },
  {
    partId: "builtin:plate-3x3-corner-round",
    portId: "stud:6",
    sourceDigest: "sha256:71fc4dd967baa29cb407410b19dae407acc7033de479fef2b0e7975f38852168",
    targetDigest: "sha256:330b44ce8ad4fa6ab50e8482e463c3e2cd41c6ac0d7b2fbfc181b6c965b79f82",
  },
  {
    partId: "builtin:plate-3x3-corner-round",
    portId: "stud:7",
    sourceDigest: "sha256:a18652c51195609b1546a6d7d9e21b5f8be1cac873fa93ae64a23fe40eabbf8a",
    targetDigest: "sha256:0a0877e0f4b6e1f2ade5a94591b31c4d74fac6b9bbcafbd5c3874353792221d5",
  },
] as const satisfies readonly ConnectionSemanticsEndpointDelta[]);

const VALIDATED_STUD_PROFILE_CHANGES_WING = deepFreeze([
  {
    partId: "builtin:wedge-plate-2x4-wing",
    portId: "stud:0",
    sourceDigest: "sha256:2b002f006574d17503e4f52fbfdaf60e6d4ab9cd45d7c99706b1c5c096682285",
    targetDigest: "sha256:5588d9bc50b037e5807f4f24c7dd2b12de0d48eeddf4f47dac23e9f491beaec0",
  },
  {
    partId: "builtin:wedge-plate-2x4-wing",
    portId: "stud:1",
    sourceDigest: "sha256:d48a3c1fa52d7b64e550a86f0432b4ab6481b6b2c2e0b022fe98492d4d2f8c38",
    targetDigest: "sha256:775ce0673214061fb79a50ee284f6cb063ad19e37692abba0cf7f4222398ec92",
  },
  {
    partId: "builtin:wedge-plate-2x4-wing",
    portId: "stud:2",
    sourceDigest: "sha256:9295b3b3735326cafc91f0ab73e400256975c5de26708106fe684d55a915f632",
    targetDigest: "sha256:2684219e107f050b581b9955694ba23f49f9887c48fb09de4deeef588449c62a",
  },
  {
    partId: "builtin:wedge-plate-2x4-wing",
    portId: "stud:3",
    sourceDigest: "sha256:d86e5c4997f704ddf3f957108b35f0a88f5288073b504d2fe7b1e2f0d11e1151",
    targetDigest: "sha256:4e88085a108341418a376454f0bd7eca5fa6510e8211786a7b20f9f6181cff70",
  },
] as const satisfies readonly ConnectionSemanticsEndpointDelta[]);

/**
 * The stud-profile deltas of the parts admitted before 30357, with 15573's
 * centre-seat deltas where their keys sort: after the 3x3 corner plate's,
 * before the round-end plate's.
 */
const STUD_PROFILE_AND_CENTRE_SEAT_CHANGES_BEFORE_30357 = deepFreeze([
  ...VALIDATED_STUD_PROFILE_CHANGES_CORNER_3X3,
  ...JUMPER_1X2_CENTRE_SEAT_CHANGES,
  ...VALIDATED_STUD_PROFILE_CHANGES_ROUND_END,
] as const satisfies readonly ConnectionSemanticsEndpointDelta[]);

export const VALIDATED_STUD_PROFILE_CHANGES_V7 = deepFreeze([
  ...STUD_PROFILE_AND_CENTRE_SEAT_CHANGES_BEFORE_30357,
  ...VALIDATED_STUD_PROFILE_CHANGES_WING,
] as const satisfies readonly ConnectionSemanticsEndpointDelta[]);

export const VALIDATED_STUD_PROFILE_CHANGES_V8 = deepFreeze([
  ...STUD_PROFILE_AND_CENTRE_SEAT_CHANGES_BEFORE_30357,
  ...VALIDATED_STUD_PROFILE_CHANGES_30357,
  ...VALIDATED_STUD_PROFILE_CHANGES_WING,
] as const satisfies readonly ConnectionSemanticsEndpointDelta[]);

export const VALIDATED_STUD_PROFILE_AND_1X2_THROUGH_BORE_CHANGES = deepFreeze([
  ...STUD_PROFILE_AND_CENTRE_SEAT_CHANGES_BEFORE_30357,
  ...VALIDATED_STUD_PROFILE_CHANGES_30357,
  TECHNIC_BRICK_1X2_AXLE_HOLE_THROUGH_BORE_CHANGE,
  ...VALIDATED_STUD_PROFILE_CHANGES_WING,
] as const satisfies readonly ConnectionSemanticsEndpointDelta[]);

export const VALIDATED_STUD_PROFILE_AND_THROUGH_BORE_CHANGES = deepFreeze([
  ...STUD_PROFILE_AND_CENTRE_SEAT_CHANGES_BEFORE_30357,
  ...VALIDATED_STUD_PROFILE_CHANGES_30357,
  TECHNIC_BRICK_1X1_AXLE_HOLE_THROUGH_BORE_CHANGE,
  TECHNIC_BRICK_1X2_AXLE_HOLE_THROUGH_BORE_CHANGE,
  ...VALIDATED_STUD_PROFILE_CHANGES_WING,
] as const satisfies readonly ConnectionSemanticsEndpointDelta[]);
