import type {
  ConnectionSemanticsEndpointDelta,
  ConnectionSemanticsPairDelta,
} from "./connection-semantics-projection.ts";
import { deepFreeze } from "./canonical.ts";
import type { ReviewedCarriedEndpointDelta } from "./historical-connection-carry-forward.ts";
import {
  AXLE_JUMPER_AND_WEDGE_CHANGES,
  JUMPER_1X2_CENTRE_SEAT_CHANGES,
  JUMPER_AND_WEDGE_CHANGES,
  JUMPER_CHANGES,
  REVIEWED_CARRIED_ENDPOINT_DELTAS,
  V32_BRACKET_RECESS_CLUTCH_ADDITIONS as V32_RECESS,
  VALIDATED_STUD_PROFILE_AND_1X2_THROUGH_BORE_CHANGES,
  VALIDATED_STUD_PROFILE_AND_THROUGH_BORE_CHANGES,
  VALIDATED_STUD_PROFILE_CHANGES_V7,
  VALIDATED_STUD_PROFILE_CHANGES_V8,
} from "./historical-connection-endpoint-deltas.ts";
import {
  V31_STUD_PROFILE_CHANGES_FROM_V15,
  V31_STUD_PROFILE_CHANGES_FROM_V18,
  V31_STUD_PROFILE_CHANGES_FROM_V19,
  V31_STUD_PROFILE_CHANGES_FROM_V20,
  V31_STUD_PROFILE_CHANGES_FROM_V23,
  V31_STUD_PROFILE_CHANGES_FROM_V8,
  mergeEndpointDeltas,
} from "./historical-connection-stud-profile-deltas.ts";

/**
 * The reviewed connector-semantics row of every historical source truth, and
 * the current authority they are measured against. Only data lives here;
 * `historical-connection-semantics.ts` reads it to authenticate saved edges,
 * and `npm run migration-history:check` re-derives every row from its source
 * commit.
 */

type Sha256Digest = `sha256:${string}`;

export interface ReviewedHistoricalConnectionSemantics {
  readonly sourceCommit: string;
  readonly sourceEndpointCount: number;
  readonly sourceEndpointMapDigest: Sha256Digest;
  readonly sourcePairCount: number;
  readonly sourcePairMapDigest: Sha256Digest;
  readonly endpointDeltas: readonly ConnectionSemanticsEndpointDelta[];
  readonly pairDeltas: readonly ConnectionSemanticsPairDelta[];
  /**
   * The endpoint changes of this row that migration carries a saved edge
   * across instead of refusing it: every reviewed carry whose exact change
   * the row holds. Absent when there is none.
   */
  readonly carriedEndpointDeltas?: readonly ReviewedCarriedEndpointDelta[];
}

export const CURRENT_CONNECTION_SEMANTICS_AUTHORITY = deepFreeze({
  truthHash: "sha256:dbb4c8147a20b8ed0598ebf617583993fa7dd89788cdc491056d1579ee7b19d6",
  endpointCount: 2342,
  endpointMapDigest: "sha256:1f6a6fccc50ccf2b2688ddc61e078717b8230db3d7c8478ba9446a427316d7ef",
  pairCount: 4,
  pairMapDigest: "sha256:92dd1cdfb9f34879f55a5ee5a0827b5c24c830da654c90bd3b00896025ca5731",
} as const);

const EARLY_PAIR_DIGEST = "sha256:8add57fce92fab25775aa9767a664ba5e273019877f73a98179ae4add2ebdaa1";
const TWO_PAIR_DIGEST = "sha256:fe0a92b6d87e947470792811b2c45a859aa4a87f46dfd9355dc860c15de8fcae";
const THREE_PAIR_DIGEST = "sha256:7431a242907aa9829ead6a279d0b530fe5f5d00ee31e6ddc1576fe66a8a07add";
const FOUR_PAIR_DIGEST = "sha256:92dd1cdfb9f34879f55a5ee5a0827b5c24c830da654c90bd3b00896025ca5731";

function authority(
  sourceCommit: string,
  sourceEndpointCount: number,
  sourceEndpointMapDigest: Sha256Digest,
  sourcePairCount: number,
  sourcePairMapDigest: Sha256Digest,
  endpointDeltas: readonly ConnectionSemanticsEndpointDelta[] = [],
): ReviewedHistoricalConnectionSemantics {
  const carriedEndpointDeltas = REVIEWED_CARRIED_ENDPOINT_DELTAS.filter((carried) =>
    endpointDeltas.some(
      (delta) =>
        delta.partId === carried.partId &&
        delta.portId === carried.portId &&
        delta.sourceDigest === carried.sourceDigest &&
        delta.targetDigest === carried.targetDigest,
    ),
  );
  return deepFreeze({
    sourceCommit,
    sourceEndpointCount,
    sourceEndpointMapDigest,
    sourcePairCount,
    sourcePairMapDigest,
    endpointDeltas,
    pairDeltas: [],
    ...(carriedEndpointDeltas.length === 0 ? {} : { carriedEndpointDeltas }),
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
    JUMPER_AND_WEDGE_CHANGES,
  ),
  "sha256:6015f52a986a0ed4f5c5310f8b30c2a35b58f8b015025db8804c67e14ff5e9ef": authority(
    "5d2ca4f25bd8fae1437daf608c762b99c63ac2a6",
    1962,
    "sha256:bdc89dbc11e865e7a0242009b3bfa356f4e2620afef2f31b1e4604c4835878a7",
    2,
    TWO_PAIR_DIGEST,
    AXLE_JUMPER_AND_WEDGE_CHANGES,
  ),
  "sha256:72657715102652a49e08ae683650758958d5c9fad2235761368269ffd15fc4aa": authority(
    "0267c0919156df1cede84db91dd716f4565d0fb2",
    2001,
    "sha256:1f60d35a87f577ccbc8a4813e16e0cbeb288b7f1f72794752455a027aa50e267",
    3,
    THREE_PAIR_DIGEST,
    JUMPER_AND_WEDGE_CHANGES,
  ),
  "sha256:e5ae3655ebac2b16ede784efa82728c2412d0c95021183653b07222ac9d76a09": authority(
    "c78c6f31744b4ef846ecc477015dea4aa20d6ee3",
    2175,
    "sha256:80e758d9faadf1c02e30c4b4701081acddb7bd8891c001b66f51634ebeff1108",
    3,
    THREE_PAIR_DIGEST,
    JUMPER_1X2_CENTRE_SEAT_CHANGES,
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
    mergeEndpointDeltas(VALIDATED_STUD_PROFILE_CHANGES_V8, V31_STUD_PROFILE_CHANGES_FROM_V8),
  ),
  "sha256:79cca11d5dbee2dd620b20a6cba7815235fefd53bd2f6b3d003586c8d5a1c635": authority(
    "108d5b3cc873a90eddce34a1d0e1688c0dce6f16",
    2234,
    "sha256:9e419f49c13be5f6da330706dd6d7d6d5148a53f01ecf891081e07209a3be202",
    3,
    THREE_PAIR_DIGEST,
    mergeEndpointDeltas(VALIDATED_STUD_PROFILE_CHANGES_V8, V31_STUD_PROFILE_CHANGES_FROM_V8),
  ),
  "sha256:17ab2f6c385ecb861526921817a96805b77f29f87574c4eff0c174be6abbe5fb": authority(
    "081bd53edccf4c0c62691660c94eed5c723dc152",
    2234,
    "sha256:9e419f49c13be5f6da330706dd6d7d6d5148a53f01ecf891081e07209a3be202",
    3,
    THREE_PAIR_DIGEST,
    mergeEndpointDeltas(VALIDATED_STUD_PROFILE_CHANGES_V8, V31_STUD_PROFILE_CHANGES_FROM_V8),
  ),
  "sha256:6b784ce4259131b1ed637815b78bbf14a0bd2e92627ce2a8f4d09c3504465c43": authority(
    "bd46506950385df6e4be0f82385f910616e11675",
    2234,
    "sha256:9e419f49c13be5f6da330706dd6d7d6d5148a53f01ecf891081e07209a3be202",
    3,
    THREE_PAIR_DIGEST,
    mergeEndpointDeltas(VALIDATED_STUD_PROFILE_CHANGES_V8, V31_STUD_PROFILE_CHANGES_FROM_V8),
  ),
  "sha256:cdfeae99ea405770f35f83173eec10804078346d257c5e56006707639313ae8e": authority(
    "e70346d7ec2c75a206a436e8c9cc233e1ca2de37",
    2234,
    "sha256:9e419f49c13be5f6da330706dd6d7d6d5148a53f01ecf891081e07209a3be202",
    3,
    THREE_PAIR_DIGEST,
    mergeEndpointDeltas(VALIDATED_STUD_PROFILE_CHANGES_V8, V31_STUD_PROFILE_CHANGES_FROM_V8),
  ),
  "sha256:de62fae6dbc8095dfd460983e5e845ddfac4bf9ec2ea1f99572bc46026941cb5": authority(
    "8fc01861ec059da71eb09c3273815f7ea49eec62",
    2234,
    "sha256:9e419f49c13be5f6da330706dd6d7d6d5148a53f01ecf891081e07209a3be202",
    3,
    THREE_PAIR_DIGEST,
    mergeEndpointDeltas(VALIDATED_STUD_PROFILE_CHANGES_V8, V31_STUD_PROFILE_CHANGES_FROM_V8),
  ),
  "sha256:db8c1740f23c65a4c0046c679e321a559623ac18a9c3fe59357b912e3a48a1b3": authority(
    "5d90788b0c10576ae1fef592206a66540dbcb131",
    2235,
    "sha256:2bfc3d37c11482bca35f5a741fe4050227faa1f5ffe6a5b47bce3fbce06201f2",
    3,
    THREE_PAIR_DIGEST,
    mergeEndpointDeltas(VALIDATED_STUD_PROFILE_CHANGES_V8, V31_STUD_PROFILE_CHANGES_FROM_V8),
  ),
  "sha256:f8e7efbd1bc969ac699fd68db9696af693898a15ffb7901821e676d843240e2f": authority(
    "8ac4c6e9518e7b00fd0ed23ad44c6f38b657efe3",
    2243,
    "sha256:2a961d8063e735f3c6e21260d31fb15b4a3a871bcecf66d8c1ebc84574cdf9f6",
    3,
    THREE_PAIR_DIGEST,
    mergeEndpointDeltas(VALIDATED_STUD_PROFILE_CHANGES_V8, V31_STUD_PROFILE_CHANGES_FROM_V15),
  ),
  "sha256:71c76ba1d6740cbaf89b1ab721dba2ffa3136e9d742198b289373ad2205be1be": authority(
    "d58ea055120ea8e99a30faab35384a7a54f18de2",
    2246,
    "sha256:6d814f546dfc8662a2c5ee0c1221db6ac73fde54abf59a17d731d720ae32fef3",
    3,
    THREE_PAIR_DIGEST,
    mergeEndpointDeltas(VALIDATED_STUD_PROFILE_CHANGES_V8, V31_STUD_PROFILE_CHANGES_FROM_V15),
  ),
  "sha256:d21bdecc6a269b1b92e0915664cae9a147168fe8d7576ee17213e8e9446c7926": authority(
    "4cb37ef80c045ab5b7732dd9021938590ecbb086",
    2248,
    "sha256:df77717eff73f86b966ab4543bdf67cff3d2087b9bbc172e2199803b3996a87c",
    3,
    THREE_PAIR_DIGEST,
    mergeEndpointDeltas(VALIDATED_STUD_PROFILE_CHANGES_V8, V31_STUD_PROFILE_CHANGES_FROM_V15),
  ),
  "sha256:8172cc4f993b46bb9fa8f782bb2b295c516e95c16f2d6861e4a18219ef2e1b20": authority(
    "201fafba454d1db74a986ef0087f84530f96214e",
    2256,
    "sha256:960172943e8082add409c5964db59831d0270aa012c933cc816dc6fbeab145bc",
    3,
    THREE_PAIR_DIGEST,
    mergeEndpointDeltas(VALIDATED_STUD_PROFILE_CHANGES_V8, V31_STUD_PROFILE_CHANGES_FROM_V18),
  ),
  "sha256:e34fcc8ac627f0dcfdb1d779246a723101d765f931830a4c06514d9daff75c26": authority(
    "a49137131566247daeb01d80ff88302b41bcf538",
    2262,
    "sha256:4224f8ca202557d357bd4c7a94707fc9d3e58617e2d87a8e8e16059d516a58ba",
    3,
    THREE_PAIR_DIGEST,
    mergeEndpointDeltas(
      VALIDATED_STUD_PROFILE_CHANGES_V8,
      V31_STUD_PROFILE_CHANGES_FROM_V19,
      V32_RECESS,
    ),
  ),
  "sha256:9c4c32efcaf9bc5f2a251e77188134075f58ca536c6da6148e34b93419d84ad2": authority(
    "e037b7e60e1240ddf196d381850ae49bc8c80e9b",
    2266,
    "sha256:863b65218ceb2522510b7bf2e52f4cd9749c7b87fc5979499b9ef191523f6799",
    3,
    THREE_PAIR_DIGEST,
    mergeEndpointDeltas(
      VALIDATED_STUD_PROFILE_CHANGES_V8,
      V31_STUD_PROFILE_CHANGES_FROM_V20,
      V32_RECESS,
    ),
  ),
  "sha256:44044c90de3bb380f32c26db561bad1bd0f247c22ea35c54d75aa5ec6ef8f9a1": authority(
    "98dc1e82b309eb52a6a32e0928ce075acb3e93ed",
    2269,
    "sha256:f84f1e0ec3e1d628b1bd49d869e6b9f3dbdb9d95be87b2fa81b396a566462d2b",
    3,
    THREE_PAIR_DIGEST,
    mergeEndpointDeltas(
      VALIDATED_STUD_PROFILE_CHANGES_V8,
      V31_STUD_PROFILE_CHANGES_FROM_V20,
      V32_RECESS,
    ),
  ),
  "sha256:7f64021239ab6395a3666f1f72908fd420b73065909822bc68e5226785bfa12e": authority(
    "94db468e6a5045a0a7732f8f4adc128e90f025b6",
    2272,
    "sha256:006157a4816e7dc9a001b0c15a7c2e45fdbaeb611142b428458457f2ea4b8ff2",
    3,
    THREE_PAIR_DIGEST,
    mergeEndpointDeltas(
      VALIDATED_STUD_PROFILE_CHANGES_V8,
      V31_STUD_PROFILE_CHANGES_FROM_V20,
      V32_RECESS,
    ),
  ),
  "sha256:af781e7356e28622fb13afcb571d28495a0962d6aa78ef70d988126a9c4aeefb": authority(
    "d99b74d355684c8ceaca0ad6f2df76d96ebe4937",
    2277,
    "sha256:5c441a333206827791b01f59643c145102ddf28d1410667d183fadafc0d0d84c",
    3,
    THREE_PAIR_DIGEST,
    mergeEndpointDeltas(
      VALIDATED_STUD_PROFILE_AND_1X2_THROUGH_BORE_CHANGES,
      V31_STUD_PROFILE_CHANGES_FROM_V23,
      V32_RECESS,
    ),
  ),
  "sha256:09288fc048ec112225b9e605df7af2d2e9692031b9eb7a89755575956af4c10d": authority(
    "ec2387bf8b3b1a8d70a11e95c6c6547049037886",
    2295,
    "sha256:6dfd3657c9d4d3af8815fa6dad9cb2906416436239a07cfdcb968932b90f2ab1",
    3,
    THREE_PAIR_DIGEST,
    mergeEndpointDeltas(
      VALIDATED_STUD_PROFILE_AND_1X2_THROUGH_BORE_CHANGES,
      V31_STUD_PROFILE_CHANGES_FROM_V23,
      V32_RECESS,
    ),
  ),
  "sha256:364ef046160736292eb51b331ce27ff246fa8940e16b256d53a68b9656a6018f": authority(
    "cf8996f015eee595d76ef79f06c15169f674aca6",
    2301,
    "sha256:0d2515f203b36c14ea14c3ab70c22aa3adcefef088ea0ba03ea3d9d3f2d52d54",
    3,
    THREE_PAIR_DIGEST,
    mergeEndpointDeltas(
      VALIDATED_STUD_PROFILE_AND_1X2_THROUGH_BORE_CHANGES,
      V31_STUD_PROFILE_CHANGES_FROM_V23,
      V32_RECESS,
    ),
  ),
  "sha256:3226590b11882fea03d8a6370d4ca3c6c8201feaddb56882a243a69acba627e9": authority(
    "2361a30117f7a393e12c8563fc9a66d140bff323",
    2311,
    "sha256:ff3ec2777e568cdab960bea84bdf54dd6aafb26497c262ebdfa42487312c3f93",
    3,
    THREE_PAIR_DIGEST,
    mergeEndpointDeltas(
      VALIDATED_STUD_PROFILE_AND_1X2_THROUGH_BORE_CHANGES,
      V31_STUD_PROFILE_CHANGES_FROM_V23,
      V32_RECESS,
    ),
  ),
  "sha256:614c61787b6c45d645e3e84c71dd931a15c258535a1959ee4b3aa1906303b70f": authority(
    "8a947a9acedd090c6215d547d631a13d6ce747e0",
    2319,
    "sha256:f72d9f2d06d5e593d1e6b00bff4c31d02f07a42f230b18d15963a5b437d36ad0",
    3,
    THREE_PAIR_DIGEST,
    mergeEndpointDeltas(
      VALIDATED_STUD_PROFILE_AND_THROUGH_BORE_CHANGES,
      V31_STUD_PROFILE_CHANGES_FROM_V23,
      V32_RECESS,
    ),
  ),
  "sha256:643185fe21f0d0c77a7aada8b170395f11bb7da1079f97d5c0cd0a03d7464f1b": authority(
    "aad79008cd820f3f0cfbec98ae508c0352d65fc9",
    2326,
    "sha256:d6759940824fb337ffbbe8d99c8461f74c945bdf3d2cd7a17113523d64c382ba",
    3,
    THREE_PAIR_DIGEST,
    mergeEndpointDeltas(
      VALIDATED_STUD_PROFILE_AND_THROUGH_BORE_CHANGES,
      V31_STUD_PROFILE_CHANGES_FROM_V23,
      V32_RECESS,
    ),
  ),
  "sha256:54762419e4779c6c15566052062fcaa432cb45e3a13704b5af1563b4fa94e8eb": authority(
    "982634de7ddcb75310a802b9cc4dbba9d19d3d9c",
    2339,
    "sha256:3ee33ad94b3f4ff2ea0024c27753d871f26b7bbe0cd8d74c7309287c804d2be9",
    4,
    FOUR_PAIR_DIGEST,
    mergeEndpointDeltas(
      JUMPER_1X2_CENTRE_SEAT_CHANGES,
      V31_STUD_PROFILE_CHANGES_FROM_V23,
      V32_RECESS,
    ),
  ),
  "sha256:cf2d67907369f85551055665b6df0f849dd978d2e63330130ec2d2db8f6ccc0b": authority(
    "c6356f76520b130c326e2a6df3917045df551085",
    2340,
    "sha256:e831383ea4cf95204c5996eeef89010f16a3f048884a69a45e2c31a071831219",
    4,
    FOUR_PAIR_DIGEST,
    mergeEndpointDeltas(V31_STUD_PROFILE_CHANGES_FROM_V23, V32_RECESS),
  ),
  "sha256:b2ca21fb0fefefa18c17229cdcf1235475031bc2892d5d514103d45473a7d474": authority(
    "12995985b8a151b5e4bec84076e717e050be0fb3",
    2340,
    "sha256:d1b8e31895ee0eef012019fcfbcccea0d359097afa1d151a3cf0e049e8a12f8a",
    4,
    FOUR_PAIR_DIGEST,
    mergeEndpointDeltas(V32_RECESS),
  ),
});
