import { CONNECTOR_PAIR_RULES, PART_DEFINITIONS, getPartDefinition } from "@lego-studio/catalog";
import type { ConnectorKind } from "@lego-studio/catalog";
import type { BrickDocumentV1 } from "@lego-studio/protocol";

import type {
  ConnectionSemanticsEndpointDelta,
  ConnectionSemanticsPairDelta,
  ProjectedConnectionSemantics,
} from "./connection-semantics-projection.ts";
import {
  connectionEndpointKey,
  connectionPairKey,
  projectConnectionSemantics,
} from "./connection-semantics-projection.ts";
import { deepFreeze } from "./canonical.ts";

type Sha256Digest = `sha256:${string}`;

export interface ReviewedHistoricalConnectionSemantics {
  readonly sourceCommit: string;
  readonly sourceEndpointCount: number;
  readonly sourceEndpointMapDigest: Sha256Digest;
  readonly sourcePairCount: number;
  readonly sourcePairMapDigest: Sha256Digest;
  readonly endpointDeltas: readonly ConnectionSemanticsEndpointDelta[];
  readonly pairDeltas: readonly ConnectionSemanticsPairDelta[];
}

export const CURRENT_CONNECTION_SEMANTICS_AUTHORITY = deepFreeze({
  truthHash: "sha256:54762419e4779c6c15566052062fcaa432cb45e3a13704b5af1563b4fa94e8eb",
  endpointCount: 2339,
  endpointMapDigest: "sha256:b911e1d62c84c4abcb4c2fc5ae5568d41482b413beb9ef5186f7766a2e677688",
  pairCount: 4,
  pairMapDigest: "sha256:92dd1cdfb9f34879f55a5ee5a0827b5c24c830da654c90bd3b00896025ca5731",
} as const);

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

const JUMPER_CHANGES = deepFreeze([
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

const AXLE_AND_WEDGE_CHANGES = deepFreeze([
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
  ...WEDGE_REMOVALS,
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

const VALIDATED_STUD_PROFILE_CHANGES_BEFORE_30357 = deepFreeze([
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

const VALIDATED_STUD_PROFILE_CHANGES_V7 = deepFreeze([
  ...VALIDATED_STUD_PROFILE_CHANGES_BEFORE_30357,
  ...VALIDATED_STUD_PROFILE_CHANGES_WING,
] as const satisfies readonly ConnectionSemanticsEndpointDelta[]);

const VALIDATED_STUD_PROFILE_CHANGES_V8 = deepFreeze([
  ...VALIDATED_STUD_PROFILE_CHANGES_BEFORE_30357,
  ...VALIDATED_STUD_PROFILE_CHANGES_30357,
  ...VALIDATED_STUD_PROFILE_CHANGES_WING,
] as const satisfies readonly ConnectionSemanticsEndpointDelta[]);

const VALIDATED_STUD_PROFILE_AND_1X2_THROUGH_BORE_CHANGES = deepFreeze([
  ...VALIDATED_STUD_PROFILE_CHANGES_BEFORE_30357,
  ...VALIDATED_STUD_PROFILE_CHANGES_30357,
  TECHNIC_BRICK_1X2_AXLE_HOLE_THROUGH_BORE_CHANGE,
  ...VALIDATED_STUD_PROFILE_CHANGES_WING,
] as const satisfies readonly ConnectionSemanticsEndpointDelta[]);

const VALIDATED_STUD_PROFILE_AND_THROUGH_BORE_CHANGES = deepFreeze([
  ...VALIDATED_STUD_PROFILE_CHANGES_BEFORE_30357,
  ...VALIDATED_STUD_PROFILE_CHANGES_30357,
  TECHNIC_BRICK_1X1_AXLE_HOLE_THROUGH_BORE_CHANGE,
  TECHNIC_BRICK_1X2_AXLE_HOLE_THROUGH_BORE_CHANGE,
  ...VALIDATED_STUD_PROFILE_CHANGES_WING,
] as const satisfies readonly ConnectionSemanticsEndpointDelta[]);

const EARLY_PAIR_DIGEST = "sha256:8add57fce92fab25775aa9767a664ba5e273019877f73a98179ae4add2ebdaa1";
const TWO_PAIR_DIGEST = "sha256:fe0a92b6d87e947470792811b2c45a859aa4a87f46dfd9355dc860c15de8fcae";
const THREE_PAIR_DIGEST = "sha256:7431a242907aa9829ead6a279d0b530fe5f5d00ee31e6ddc1576fe66a8a07add";

function authority(
  sourceCommit: string,
  sourceEndpointCount: number,
  sourceEndpointMapDigest: Sha256Digest,
  sourcePairCount: number,
  sourcePairMapDigest: Sha256Digest,
  endpointDeltas: readonly ConnectionSemanticsEndpointDelta[] = [],
): ReviewedHistoricalConnectionSemantics {
  return deepFreeze({
    sourceCommit,
    sourceEndpointCount,
    sourceEndpointMapDigest,
    sourcePairCount,
    sourcePairMapDigest,
    endpointDeltas,
    pairDeltas: [],
  });
}

export const REVIEWED_HISTORICAL_CONNECTION_SEMANTICS_BY_TRUTH_HASH: Readonly<
  Record<string, ReviewedHistoricalConnectionSemantics>
> = deepFreeze({
  "sha256:0f6b9dcb03a9dd570b4ccc68f41a015bb33422e5cf6c1fe032f1a15bfbd76a8a": authority(
    "b62cbdf53ced2b45cfd8c49d3bcbd74dc5b9b711",
    112,
    "sha256:a7db6ea41fab89fe858be69a5399b7d0820d9b225367f43b23f3c1698d0c37c9",
    1,
    EARLY_PAIR_DIGEST,
  ),
  "sha256:2d980a480fc5b82011b3a09f9e962d74a8e7af068595503ceaa88e9811a7b17a": authority(
    "98a3b14e95c6f60cfe7bb852053dfdeb4a56243b",
    112,
    "sha256:a7db6ea41fab89fe858be69a5399b7d0820d9b225367f43b23f3c1698d0c37c9",
    1,
    EARLY_PAIR_DIGEST,
  ),
  "sha256:e10d6cd07af66fc3bf9bbb2917992e74bb15f76385ec989bd7e94bcd4cffeedd": authority(
    "d86b274750aa0b971769df605ba70e2dd68cc02a",
    521,
    "sha256:79247d5b4eeee2f13a1d8aa9fd3de841431e6124d6df42b435dda2cc44ea81b3",
    1,
    EARLY_PAIR_DIGEST,
  ),
  "sha256:f48bb1cae251f592923d94b4b992a55c06e74ea49b0f81be9ff4d416bb38e843": authority(
    "e0f99cddd820f6dd3915fa10a9ce2f856fc852c4",
    1919,
    "sha256:d5acef03f2a4944afe1356e08b4292a08dc05462e9c6e97a8cf9d258bdff3392",
    1,
    EARLY_PAIR_DIGEST,
    JUMPER_CHANGES,
  ),
  "sha256:4a1dea5f4706dba84aeee1bcbd495fec7eac0f7321e7447979a03a8fb089d3bc": authority(
    "d493dcf390e3009046b457d681a7b80733c3804c",
    1955,
    "sha256:7a0cd2bb52ca27ede1ed7081898c6aebe01bad06c5dd9ad30c2a6e484827abee",
    1,
    EARLY_PAIR_DIGEST,
    WEDGE_REMOVALS,
  ),
  "sha256:6015f52a986a0ed4f5c5310f8b30c2a35b58f8b015025db8804c67e14ff5e9ef": authority(
    "5d2ca4f25bd8fae1437daf608c762b99c63ac2a6",
    1962,
    "sha256:bdc89dbc11e865e7a0242009b3bfa356f4e2620afef2f31b1e4604c4835878a7",
    2,
    TWO_PAIR_DIGEST,
    AXLE_AND_WEDGE_CHANGES,
  ),
  "sha256:72657715102652a49e08ae683650758958d5c9fad2235761368269ffd15fc4aa": authority(
    "0267c0919156df1cede84db91dd716f4565d0fb2",
    2001,
    "sha256:1f60d35a87f577ccbc8a4813e16e0cbeb288b7f1f72794752455a027aa50e267",
    3,
    THREE_PAIR_DIGEST,
    WEDGE_REMOVALS,
  ),
  "sha256:e5ae3655ebac2b16ede784efa82728c2412d0c95021183653b07222ac9d76a09": authority(
    "c78c6f31744b4ef846ecc477015dea4aa20d6ee3",
    2175,
    "sha256:80e758d9faadf1c02e30c4b4701081acddb7bd8891c001b66f51634ebeff1108",
    3,
    THREE_PAIR_DIGEST,
  ),
  "sha256:29eaae6325eba701dc52827a9373c7583889ce3fd16fd8057f3c6f243a8ab868": authority(
    "9d0ebed8f6639d71affeaed63ab1682f35e1a18b",
    2202,
    "sha256:c56125791d72ad79dc6cff2f62693823a128f379505fbcac2e891cef2b9a0f5f",
    3,
    THREE_PAIR_DIGEST,
    VALIDATED_STUD_PROFILE_CHANGES_V7,
  ),
  "sha256:33787b02b898a83957e2cc92cff5b8da39da45dfaa3cafcd12f2446e30748613": authority(
    "262d274b51f819f13de0c118b836747da1fd14db",
    2234,
    "sha256:9e419f49c13be5f6da330706dd6d7d6d5148a53f01ecf891081e07209a3be202",
    3,
    THREE_PAIR_DIGEST,
    VALIDATED_STUD_PROFILE_CHANGES_V8,
  ),
  "sha256:79cca11d5dbee2dd620b20a6cba7815235fefd53bd2f6b3d003586c8d5a1c635": authority(
    "108d5b3cc873a90eddce34a1d0e1688c0dce6f16",
    2234,
    "sha256:9e419f49c13be5f6da330706dd6d7d6d5148a53f01ecf891081e07209a3be202",
    3,
    THREE_PAIR_DIGEST,
    VALIDATED_STUD_PROFILE_CHANGES_V8,
  ),
  "sha256:17ab2f6c385ecb861526921817a96805b77f29f87574c4eff0c174be6abbe5fb": authority(
    "081bd53edccf4c0c62691660c94eed5c723dc152",
    2234,
    "sha256:9e419f49c13be5f6da330706dd6d7d6d5148a53f01ecf891081e07209a3be202",
    3,
    THREE_PAIR_DIGEST,
    VALIDATED_STUD_PROFILE_CHANGES_V8,
  ),
  "sha256:6b784ce4259131b1ed637815b78bbf14a0bd2e92627ce2a8f4d09c3504465c43": authority(
    "bd46506950385df6e4be0f82385f910616e11675",
    2234,
    "sha256:9e419f49c13be5f6da330706dd6d7d6d5148a53f01ecf891081e07209a3be202",
    3,
    THREE_PAIR_DIGEST,
    VALIDATED_STUD_PROFILE_CHANGES_V8,
  ),
  "sha256:cdfeae99ea405770f35f83173eec10804078346d257c5e56006707639313ae8e": authority(
    "e70346d7ec2c75a206a436e8c9cc233e1ca2de37",
    2234,
    "sha256:9e419f49c13be5f6da330706dd6d7d6d5148a53f01ecf891081e07209a3be202",
    3,
    THREE_PAIR_DIGEST,
    VALIDATED_STUD_PROFILE_CHANGES_V8,
  ),
  "sha256:de62fae6dbc8095dfd460983e5e845ddfac4bf9ec2ea1f99572bc46026941cb5": authority(
    "8fc01861ec059da71eb09c3273815f7ea49eec62",
    2234,
    "sha256:9e419f49c13be5f6da330706dd6d7d6d5148a53f01ecf891081e07209a3be202",
    3,
    THREE_PAIR_DIGEST,
    VALIDATED_STUD_PROFILE_CHANGES_V8,
  ),
  "sha256:db8c1740f23c65a4c0046c679e321a559623ac18a9c3fe59357b912e3a48a1b3": authority(
    "5d90788b0c10576ae1fef592206a66540dbcb131",
    2235,
    "sha256:2bfc3d37c11482bca35f5a741fe4050227faa1f5ffe6a5b47bce3fbce06201f2",
    3,
    THREE_PAIR_DIGEST,
    VALIDATED_STUD_PROFILE_CHANGES_V8,
  ),
  "sha256:f8e7efbd1bc969ac699fd68db9696af693898a15ffb7901821e676d843240e2f": authority(
    "8ac4c6e9518e7b00fd0ed23ad44c6f38b657efe3",
    2243,
    "sha256:2a961d8063e735f3c6e21260d31fb15b4a3a871bcecf66d8c1ebc84574cdf9f6",
    3,
    THREE_PAIR_DIGEST,
    VALIDATED_STUD_PROFILE_CHANGES_V8,
  ),
  "sha256:71c76ba1d6740cbaf89b1ab721dba2ffa3136e9d742198b289373ad2205be1be": authority(
    "d58ea055120ea8e99a30faab35384a7a54f18de2",
    2246,
    "sha256:6d814f546dfc8662a2c5ee0c1221db6ac73fde54abf59a17d731d720ae32fef3",
    3,
    THREE_PAIR_DIGEST,
    VALIDATED_STUD_PROFILE_CHANGES_V8,
  ),
  "sha256:d21bdecc6a269b1b92e0915664cae9a147168fe8d7576ee17213e8e9446c7926": authority(
    "4cb37ef80c045ab5b7732dd9021938590ecbb086",
    2248,
    "sha256:df77717eff73f86b966ab4543bdf67cff3d2087b9bbc172e2199803b3996a87c",
    3,
    THREE_PAIR_DIGEST,
    VALIDATED_STUD_PROFILE_CHANGES_V8,
  ),
  "sha256:8172cc4f993b46bb9fa8f782bb2b295c516e95c16f2d6861e4a18219ef2e1b20": authority(
    "201fafba454d1db74a986ef0087f84530f96214e",
    2256,
    "sha256:960172943e8082add409c5964db59831d0270aa012c933cc816dc6fbeab145bc",
    3,
    THREE_PAIR_DIGEST,
    VALIDATED_STUD_PROFILE_CHANGES_V8,
  ),
  "sha256:e34fcc8ac627f0dcfdb1d779246a723101d765f931830a4c06514d9daff75c26": authority(
    "a49137131566247daeb01d80ff88302b41bcf538",
    2262,
    "sha256:4224f8ca202557d357bd4c7a94707fc9d3e58617e2d87a8e8e16059d516a58ba",
    3,
    THREE_PAIR_DIGEST,
    VALIDATED_STUD_PROFILE_CHANGES_V8,
  ),
  "sha256:9c4c32efcaf9bc5f2a251e77188134075f58ca536c6da6148e34b93419d84ad2": authority(
    "e037b7e60e1240ddf196d381850ae49bc8c80e9b",
    2266,
    "sha256:863b65218ceb2522510b7bf2e52f4cd9749c7b87fc5979499b9ef191523f6799",
    3,
    THREE_PAIR_DIGEST,
    VALIDATED_STUD_PROFILE_CHANGES_V8,
  ),
  "sha256:44044c90de3bb380f32c26db561bad1bd0f247c22ea35c54d75aa5ec6ef8f9a1": authority(
    "98dc1e82b309eb52a6a32e0928ce075acb3e93ed",
    2269,
    "sha256:f84f1e0ec3e1d628b1bd49d869e6b9f3dbdb9d95be87b2fa81b396a566462d2b",
    3,
    THREE_PAIR_DIGEST,
    VALIDATED_STUD_PROFILE_CHANGES_V8,
  ),
  "sha256:7f64021239ab6395a3666f1f72908fd420b73065909822bc68e5226785bfa12e": authority(
    "94db468e6a5045a0a7732f8f4adc128e90f025b6",
    2272,
    "sha256:006157a4816e7dc9a001b0c15a7c2e45fdbaeb611142b428458457f2ea4b8ff2",
    3,
    THREE_PAIR_DIGEST,
    VALIDATED_STUD_PROFILE_CHANGES_V8,
  ),
  "sha256:af781e7356e28622fb13afcb571d28495a0962d6aa78ef70d988126a9c4aeefb": authority(
    "d99b74d355684c8ceaca0ad6f2df76d96ebe4937",
    2277,
    "sha256:5c441a333206827791b01f59643c145102ddf28d1410667d183fadafc0d0d84c",
    3,
    THREE_PAIR_DIGEST,
    VALIDATED_STUD_PROFILE_AND_1X2_THROUGH_BORE_CHANGES,
  ),
  "sha256:09288fc048ec112225b9e605df7af2d2e9692031b9eb7a89755575956af4c10d": authority(
    "ec2387bf8b3b1a8d70a11e95c6c6547049037886",
    2295,
    "sha256:6dfd3657c9d4d3af8815fa6dad9cb2906416436239a07cfdcb968932b90f2ab1",
    3,
    THREE_PAIR_DIGEST,
    VALIDATED_STUD_PROFILE_AND_1X2_THROUGH_BORE_CHANGES,
  ),
  "sha256:364ef046160736292eb51b331ce27ff246fa8940e16b256d53a68b9656a6018f": authority(
    "cf8996f015eee595d76ef79f06c15169f674aca6",
    2301,
    "sha256:0d2515f203b36c14ea14c3ab70c22aa3adcefef088ea0ba03ea3d9d3f2d52d54",
    3,
    THREE_PAIR_DIGEST,
    VALIDATED_STUD_PROFILE_AND_1X2_THROUGH_BORE_CHANGES,
  ),
  "sha256:3226590b11882fea03d8a6370d4ca3c6c8201feaddb56882a243a69acba627e9": authority(
    "2361a30117f7a393e12c8563fc9a66d140bff323",
    2311,
    "sha256:ff3ec2777e568cdab960bea84bdf54dd6aafb26497c262ebdfa42487312c3f93",
    3,
    THREE_PAIR_DIGEST,
    VALIDATED_STUD_PROFILE_AND_1X2_THROUGH_BORE_CHANGES,
  ),
  "sha256:614c61787b6c45d645e3e84c71dd931a15c258535a1959ee4b3aa1906303b70f": authority(
    "8a947a9acedd090c6215d547d631a13d6ce747e0",
    2319,
    "sha256:f72d9f2d06d5e593d1e6b00bff4c31d02f07a42f230b18d15963a5b437d36ad0",
    3,
    THREE_PAIR_DIGEST,
    VALIDATED_STUD_PROFILE_AND_THROUGH_BORE_CHANGES,
  ),
  "sha256:643185fe21f0d0c77a7aada8b170395f11bb7da1079f97d5c0cd0a03d7464f1b": authority(
    "aad79008cd820f3f0cfbec98ae508c0352d65fc9",
    2326,
    "sha256:d6759940824fb337ffbbe8d99c8461f74c945bdf3d2cd7a17113523d64c382ba",
    3,
    THREE_PAIR_DIGEST,
    VALIDATED_STUD_PROFILE_AND_THROUGH_BORE_CHANGES,
  ),
});

const LIVE_CONNECTION_SEMANTICS = projectConnectionSemantics(
  PART_DEFINITIONS,
  CONNECTOR_PAIR_RULES,
  "live-strict",
);

function targetAuthorityFailures(
  targetTruthHash: string,
  target: ProjectedConnectionSemantics,
): string[] {
  const failures: string[] = [];
  if (targetTruthHash !== CURRENT_CONNECTION_SEMANTICS_AUTHORITY.truthHash) {
    failures.push(
      `Current truth hash ${targetTruthHash} differs from connector migration authority ${CURRENT_CONNECTION_SEMANTICS_AUTHORITY.truthHash}; regenerate and review historical connector semantics before migrating`,
    );
  }
  if (
    target.endpointCount !== CURRENT_CONNECTION_SEMANTICS_AUTHORITY.endpointCount ||
    target.endpointMapDigest !== CURRENT_CONNECTION_SEMANTICS_AUTHORITY.endpointMapDigest
  ) {
    failures.push(
      `Current connector endpoint projection is ${target.endpointCount}/${target.endpointMapDigest}, expected ${CURRENT_CONNECTION_SEMANTICS_AUTHORITY.endpointCount}/${CURRENT_CONNECTION_SEMANTICS_AUTHORITY.endpointMapDigest}; run npm run migration-history:check and review the complete delta`,
    );
  }
  if (
    target.pairCount !== CURRENT_CONNECTION_SEMANTICS_AUTHORITY.pairCount ||
    target.pairMapDigest !== CURRENT_CONNECTION_SEMANTICS_AUTHORITY.pairMapDigest
  ) {
    failures.push(
      `Current reachable connector-pair projection is ${target.pairCount}/${target.pairMapDigest}, expected ${CURRENT_CONNECTION_SEMANTICS_AUTHORITY.pairCount}/${CURRENT_CONNECTION_SEMANTICS_AUTHORITY.pairMapDigest}; run npm run migration-history:check and review the complete delta`,
    );
  }
  return failures;
}

function connectorPair(
  left: { readonly kind: ConnectorKind; readonly gender: "male" | "female" },
  right: { readonly kind: ConnectorKind; readonly gender: "male" | "female" },
): readonly [male: ConnectorKind, female: ConnectorKind] | undefined {
  if (left.gender === "male" && right.gender === "female") return [left.kind, right.kind];
  if (right.gender === "male" && left.gender === "female") return [right.kind, left.kind];
  return undefined;
}

export function historicalConnectionSemanticsBlockingReasons(
  document: BrickDocumentV1,
  sourceTruthHash: string,
  targetTruthHash: string,
  target: ProjectedConnectionSemantics = LIVE_CONNECTION_SEMANTICS,
): readonly string[] {
  const targetFailures = targetAuthorityFailures(targetTruthHash, target);
  if (targetFailures.length > 0) return targetFailures;
  const authority = REVIEWED_HISTORICAL_CONNECTION_SEMANTICS_BY_TRUTH_HASH[sourceTruthHash];
  if (authority === undefined) {
    return [
      `Truth snapshot ${sourceTruthHash} has no reviewed connector-semantics authority; migration cannot infer historical ports from the current catalog`,
    ];
  }

  const endpointDeltas = new Map(
    authority.endpointDeltas.map((delta) => [
      connectionEndpointKey(delta.partId, delta.portId),
      delta,
    ]),
  );
  const pairDeltas = new Map(
    authority.pairDeltas.map((delta) => [connectionPairKey(delta.male, delta.female), delta]),
  );
  const partById = new Map<string, BrickDocumentV1["parts"][number]>();
  const duplicatePartIds = new Set<string>();
  for (const part of document.parts) {
    if (partById.has(part.id)) duplicatePartIds.add(part.id);
    else partById.set(part.id, part);
  }
  const blockingReasons: string[] = [];

  for (const connection of document.connections) {
    const resolved = [];
    for (const endpoint of [connection.a, connection.b]) {
      const label = `${endpoint.partId}/${endpoint.portId}`;
      if (duplicatePartIds.has(endpoint.partId)) {
        blockingReasons.push(
          `Connection ${connection.id} endpoint ${label} resolves to multiple source part instances with duplicate ID ${endpoint.partId} under reviewed source truth ${sourceTruthHash}; make part IDs unique before migration so connector semantics can be authenticated`,
        );
        continue;
      }
      const instance = partById.get(endpoint.partId);
      if (instance === undefined) {
        blockingReasons.push(
          `Connection ${connection.id} endpoint ${label} references missing part ${endpoint.partId} under reviewed source truth ${sourceTruthHash}; add that source-truth-valid part instance or remove the dangling connection before migration`,
        );
        continue;
      }
      const definition = getPartDefinition(instance.catalogPartId);
      if (definition === undefined) continue;
      const connector = definition.connectors.find(({ id }) => id === endpoint.portId);
      const delta = endpointDeltas.get(
        connectionEndpointKey(instance.catalogPartId, endpoint.portId),
      );
      if (delta?.sourceDigest === null) {
        blockingReasons.push(
          `Connection ${connection.id} endpoint ${label} did not exist in reviewed source truth ${sourceTruthHash}; migration cannot legitimize a later connector`,
        );
      } else if (delta?.targetDigest === null) {
        blockingReasons.push(
          `Connection ${connection.id} endpoint ${label} existed in reviewed source truth ${sourceTruthHash} but current truth removes it; migration cannot preserve the edge`,
        );
      } else if (delta !== undefined && delta.sourceDigest !== delta.targetDigest) {
        blockingReasons.push(
          `Connection ${connection.id} endpoint ${label} changed after reviewed source truth ${sourceTruthHash}; migration cannot preserve its connector semantics`,
        );
      } else if (connector === undefined) {
        blockingReasons.push(
          `Connection ${connection.id} endpoint ${label} is absent from both reviewed source truth ${sourceTruthHash} and current truth; migration cannot authorize an unknown connector`,
        );
      }
      if (connector !== undefined) resolved.push(connector);
    }
    if (resolved.length !== 2) continue;
    const pair = connectorPair(resolved[0]!, resolved[1]!);
    if (pair === undefined) continue;
    const delta = pairDeltas.get(connectionPairKey(...pair));
    if (delta?.sourceDigest === null) {
      blockingReasons.push(
        `Connection ${connection.id} uses ${pair[0]} to ${pair[1]}, which reviewed source truth ${sourceTruthHash} did not admit; migration cannot legitimize a later connector pair`,
      );
    } else if (delta?.targetDigest === null) {
      blockingReasons.push(
        `Connection ${connection.id} uses ${pair[0]} to ${pair[1]}, which current truth removes; migration cannot preserve the historical pair`,
      );
    } else if (delta !== undefined && delta.sourceDigest !== delta.targetDigest) {
      blockingReasons.push(
        `Connection ${connection.id} uses ${pair[0]} to ${pair[1]}, whose behavior changed after reviewed source truth ${sourceTruthHash}; migration cannot reinterpret the pair`,
      );
    }
  }
  return blockingReasons;
}
