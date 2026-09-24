import type { BrickDocumentV1 } from "@lego-studio/protocol";

import { EXPECTED_JUMPER_1X2_CARRIED_ENDPOINT_DELTAS } from "./migration-historical-fixtures.test-support.ts";

/**
 * Literal /31 fixtures, copied from `npm run migration-history:check -- --print`
 * rather than imported from the tables they check.
 *
 * The 26 stud endpoints whose projection /31 moves by giving seven measured
 * parts the nominal-stud-tube/1 profile, in the order the parts were admitted:
 * 2450 and 79491 by /8, 28802 at /15, 15254 at /18, 41682 at /19, 2877 at /20
 * and 32064 at /23. Each changes the same way in every source truth that has it.
 */
export const EXPECTED_V31_STUD_PROFILE_CHANGES = [
  {
    partId: "builtin:wedge-plate-3x3-cut-corner",
    portId: "stud:0",
    sourceDigest: "sha256:5d13a1b90714ca40eeaebaf77ecabcfdc88c026cfde76ac8fbfe0fa1672ef5ca",
    targetDigest: "sha256:a2eeb06d3569d59b853e5f6b681788b2080dddab02da7449c60f148d242871de",
  },
  {
    partId: "builtin:wedge-plate-3x3-cut-corner",
    portId: "stud:1",
    sourceDigest: "sha256:50a0749b012c54ed667a1413fe3b07895db37e3d34018ec527e42ab9ac4f8710",
    targetDigest: "sha256:f067013c5bba17c32278cb2b00c92477637392a2ee672f5e2bb5fe0a2a3ebd47",
  },
  {
    partId: "builtin:wedge-plate-3x3-cut-corner",
    portId: "stud:2",
    sourceDigest: "sha256:ffcaee0d4b63c2fdcd0fd08afc58f706e246b6fb34c9689d05e55be31876b355",
    targetDigest: "sha256:b8c275fbf486bf8001d6043f9ae67f6f4ac8f54a98b35ab5542593d9ee3e996a",
  },
  {
    partId: "builtin:wedge-plate-3x3-cut-corner",
    portId: "stud:3",
    sourceDigest: "sha256:fb005ff004f132e4b2aee85c5b2c3dad5531a6014d0a56e7557544a64309eec2",
    targetDigest: "sha256:4c3d439633881d7119ee8d4c0dcf56446eae3cb38b1a6e85b544c4f17e168318",
  },
  {
    partId: "builtin:wedge-plate-3x3-cut-corner",
    portId: "stud:4",
    sourceDigest: "sha256:bdf77e32ba9ac2ea1de3322586a0430ce6196238ea0752fca290f834b1780b75",
    targetDigest: "sha256:ba6e0b23d74ba436c2a59d3d398025b0c664d247f0f9a84d301e1a69803c9369",
  },
  {
    partId: "builtin:wedge-plate-3x3-cut-corner",
    portId: "stud:5",
    sourceDigest: "sha256:d51fb9214bb9f865c52ba7b1b3427d589cb0328764eaf9659a6a464e56677b30",
    targetDigest: "sha256:4cb3c98b802d0e8098e33b90270047e3a01e44ab48626b624b90de940df36726",
  },
  {
    partId: "builtin:corner-plate-2x2-round",
    portId: "stud:0",
    sourceDigest: "sha256:86fdc6997d32dd599d8ce21cac29ddbb5d9020fb461e2d34828fa8799158c80b",
    targetDigest: "sha256:81bdf45fc51111361af87654ab365ef62a168d7f1eaab4f50ea36db3d0412f9d",
  },
  {
    partId: "builtin:corner-plate-2x2-round",
    portId: "stud:1",
    sourceDigest: "sha256:85b521112777da90e1fd5d59b0bda34c5fb827af4294e415f2996fab30fd86e9",
    targetDigest: "sha256:8dea88d4ba6ab339182e44f9992217138d5206d07b3ef71b71ff62afdf5e99c9",
  },
  {
    partId: "builtin:bracket-1x2-1x4-rounded-bottom",
    portId: "stud:0",
    sourceDigest: "sha256:90e85b902e7cd6a7410f95960092450d12d356a09e3ab55ac66ac980f823479c",
    targetDigest: "sha256:d1f81a006d30dad1288c7ca7fae5ba07a9e03178208d22390a0448966cef8c72",
  },
  {
    partId: "builtin:bracket-1x2-1x4-rounded-bottom",
    portId: "stud:1",
    sourceDigest: "sha256:c24c273ad355979535ef9182541d89ffd23a1c5422c9c014fc9aeeb78b9b2a97",
    targetDigest: "sha256:2a9b5447b5e8f5ad7ad00f2f7e689f128901b0892b70b990eb3e516010427d62",
  },
  {
    partId: "builtin:bracket-1x2-1x4-rounded-bottom",
    portId: "stud:2",
    sourceDigest: "sha256:c8edbeb2d399253bbbe5b651b6029834719de75a22366230b58f4b79cb9b30f3",
    targetDigest: "sha256:555b7536866c2c181fe27262b07127045bd67b1acca991ed4fddf5cfbc90bae2",
  },
  {
    partId: "builtin:bracket-1x2-1x4-rounded-bottom",
    portId: "stud:3",
    sourceDigest: "sha256:c44be19ddd313fbcae2150ed45948d608349b4f3a9fff4c6d74483666308a416",
    targetDigest: "sha256:2868e38c2cb430f639d1535994c3528300890e448f1d2fa98e01a950980020d7",
  },
  {
    partId: "builtin:bracket-1x2-1x4-rounded-bottom",
    portId: "stud:4",
    sourceDigest: "sha256:05be104c219c88aa6ebd1dc51503cf959b0940aaab96dfc2716af913804769f5",
    targetDigest: "sha256:48958b21a05fa7f3abe8ef92689a8c408ce590f72f21f108975a8c6c99401f39",
  },
  {
    partId: "builtin:bracket-1x2-1x4-rounded-bottom",
    portId: "stud:5",
    sourceDigest: "sha256:cf16d3d7ec9feb5f43226287c93631f0ed31e5556a930092c2644f208ea39dbb",
    targetDigest: "sha256:fec8553481ae3ca586e2540bb20785144f2926f129c248feef0a0d12114789eb",
  },
  {
    partId: "builtin:arch-1x6-thin-top",
    portId: "stud:0",
    sourceDigest: "sha256:b5d3141f86fcc59fee998636ae60b0aa21d812add478dae1c1a3af01ff27b230",
    targetDigest: "sha256:3a0b3038add9e289560afe547678ea272b49c5bf72ba2e8b0079dc0245fcc7ad",
  },
  {
    partId: "builtin:arch-1x6-thin-top",
    portId: "stud:1",
    sourceDigest: "sha256:ee2480d9cf787dce91585794b6d886b95d2f1faaf06582245c9bc3436cd94141",
    targetDigest: "sha256:e67ea5b7edbaa771c6ce0aebf6f68f50aa4073c64fccb0442dcef8bda7c6c756",
  },
  {
    partId: "builtin:arch-1x6-thin-top",
    portId: "stud:2",
    sourceDigest: "sha256:161dc3a010d2d0f37d873a474b5032c2aa4f0293190f266acf3ba4c3f5f54974",
    targetDigest: "sha256:5c1e81a22c2d3f9582464e997337596ccc219fd5d252873c6960e2472dc913dd",
  },
  {
    partId: "builtin:arch-1x6-thin-top",
    portId: "stud:3",
    sourceDigest: "sha256:2fe93cf402082385c3dec8efbfc667583eac2b02912e21bbe382d46feaec5142",
    targetDigest: "sha256:63e75758efc187f467c367b686f54ed8a20b99f401d6c91b7e98be753f0393c2",
  },
  {
    partId: "builtin:arch-1x6-thin-top",
    portId: "stud:4",
    sourceDigest: "sha256:5dbc3577d14c839e4465e0ffe12e759be9351b5acd896184dde3253d073e2ec6",
    targetDigest: "sha256:b4da05044288ec4e872c6ce347d15ae928598aee58fb55828ed1953f3811959a",
  },
  {
    partId: "builtin:arch-1x6-thin-top",
    portId: "stud:5",
    sourceDigest: "sha256:f8cfbd08059db3010a3f59bd4396dfc3441296b47df3593c97541e33c0f41de5",
    targetDigest: "sha256:4795c40cd23e50181632cb8420ca42f232378ce773b1b42c1d97cacbfacf6094",
  },
  {
    partId: "builtin:bracket-2x2-1x2-vertical-studs",
    portId: "stud:0",
    sourceDigest: "sha256:4a99b1abf864318954c0420ba3f74e548242e2fb0d6ada03a2c6f3542256f09b",
    targetDigest: "sha256:cc4dc7a878f13a133c61cabdab18d2d5923481b83885a204cb23c4245312308d",
  },
  {
    partId: "builtin:bracket-2x2-1x2-vertical-studs",
    portId: "stud:1",
    sourceDigest: "sha256:123cfb55d092b68b5f7867f3baf472fd248ad10d8fa9900a67eac43b61bb8b1f",
    targetDigest: "sha256:c9eeb17812520caa79bfe37f4ad84eaa74935e61fb258181597eecf551bc99b4",
  },
  {
    partId: "builtin:brick-1x2-grille",
    portId: "stud:0",
    sourceDigest: "sha256:212771ef8fb14438dc224ac05fe918eea96366414fe22c59165e769bc7fe3fb6",
    targetDigest: "sha256:0052bcf0cac6ddf47137cb8aaf8d07ebb71dd55707d1c1141c1552ed15dbe90e",
  },
  {
    partId: "builtin:brick-1x2-grille",
    portId: "stud:1",
    sourceDigest: "sha256:781aaa3396fcde3510887d34ab7cd8580f200e8c245cf6e67f9d642473be6aae",
    targetDigest: "sha256:ca95b584db634e480d4b29727c1a94e604e7767d81cb1bfe8429a9a6dde222a6",
  },
  {
    partId: "builtin:technic-brick-1x2-axle-hole",
    portId: "stud:0",
    sourceDigest: "sha256:212771ef8fb14438dc224ac05fe918eea96366414fe22c59165e769bc7fe3fb6",
    targetDigest: "sha256:0052bcf0cac6ddf47137cb8aaf8d07ebb71dd55707d1c1141c1552ed15dbe90e",
  },
  {
    partId: "builtin:technic-brick-1x2-axle-hole",
    portId: "stud:1",
    sourceDigest: "sha256:781aaa3396fcde3510887d34ab7cd8580f200e8c245cf6e67f9d642473be6aae",
    targetDigest: "sha256:ca95b584db634e480d4b29727c1a94e604e7767d81cb1bfe8429a9a6dde222a6",
  },
] as const;

type ExpectedDelta = (typeof EXPECTED_V31_STUD_PROFILE_CHANGES)[number];

/** The first `count` of those: what a source truth holds once its parts exist. */
const upTo = (count: number): readonly ExpectedDelta[] =>
  EXPECTED_V31_STUD_PROFILE_CHANGES.slice(0, count);
export const EXPECTED_V31_STUD_PROFILE_CHANGES_FROM_V8 = upTo(8);
export const EXPECTED_V31_STUD_PROFILE_CHANGES_FROM_V15 = upTo(14);
export const EXPECTED_V31_STUD_PROFILE_CHANGES_FROM_V18 = upTo(20);
export const EXPECTED_V31_STUD_PROFILE_CHANGES_FROM_V19 = upTo(22);
export const EXPECTED_V31_STUD_PROFILE_CHANGES_FROM_V20 = upTo(24);
export const EXPECTED_V31_STUD_PROFILE_CHANGES_FROM_V23 = upTo(26);

/** Those changes as the rows carry them. */
export function expectedV31CarriedDeltas(changes: readonly ExpectedDelta[]) {
  return changes.map((change) => ({
    ...change,
    deltaClass: "validated-stud-profile-added-to-unchanged-stud" as const,
    addedValidatedConnectionStudProfile: "nominal-stud-tube/1" as const,
    reportedUnderCatalogVersion: "builtin.basic-parts/31",
  }));
}

/** Deltas from lists that share no endpoint, by partId and then portId. */
export function sortedEndpointDeltas<T extends { partId: string; portId: string }>(
  ...lists: readonly (readonly T[])[]
): T[] {
  const key = ({ partId, portId }: T) => `${partId}\0${portId}`;
  return lists.flat().sort((left, right) => (key(left) < key(right) ? -1 : 1));
}

/** The seven parts /31 reinterprets, in catalog order. */
export const EXPECTED_V31_STUD_PROFILE_PART_IDS = [
  "builtin:wedge-plate-3x3-cut-corner",
  "builtin:corner-plate-2x2-round",
  "builtin:bracket-1x2-1x4-rounded-bottom",
  "builtin:arch-1x6-thin-top",
  "builtin:bracket-2x2-1x2-vertical-studs",
  "builtin:brick-1x2-grille",
  "builtin:technic-brick-1x2-axle-hole",
] as const;

/** The /30 -> /31 row a report crossing /31 carries, for a roster with all seven. */
export const EXPECTED_V31_INTERPRETATION_CHANGE = {
  fromCatalogVersion: "builtin.basic-parts/30",
  toCatalogVersion: "builtin.basic-parts/31",
  affectedCatalogPartIds: EXPECTED_V31_STUD_PROFILE_PART_IDS,
  changedFields: ["connector-semantics", "collision-semantics"],
} as const;

/** The complete truth source commit c6356f7 emits at builtin.basic-parts/30. */
export const REVIEWED_TRUTH_V30 = {
  schemaVersion: "lego.truth-snapshot/1",
  catalog: {
    id: "builtin.basic-parts",
    version: "builtin.basic-parts/30",
    hash: "sha256:4662bd517d807a952bda5fc3964c02e34e0ae502255f747635b6c969fb564ebc",
  },
  connectorTaxonomy: {
    id: "stud-tube",
    version: "stud-tube/2",
    hash: "sha256:73e50f5ea9f2ce529f241dae4e04dc99aeb2b57738c228d0844e5b30af66ceb2",
  },
  collisionModel: {
    id: "rectilinear-stud-clearance",
    version: "rectilinear-stud-clearance/4",
    hash: "sha256:369f49834d2cfe26e5ab5650272baab6af40f01add2c93f542847c5b1b2c29c0",
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

const FROM_VERSION = {
  8: EXPECTED_V31_STUD_PROFILE_CHANGES_FROM_V8,
  15: EXPECTED_V31_STUD_PROFILE_CHANGES_FROM_V15,
  18: EXPECTED_V31_STUD_PROFILE_CHANGES_FROM_V18,
  19: EXPECTED_V31_STUD_PROFILE_CHANGES_FROM_V19,
  20: EXPECTED_V31_STUD_PROFILE_CHANGES_FROM_V20,
  23: EXPECTED_V31_STUD_PROFILE_CHANGES_FROM_V23,
} as const;

/** A source row's pre-/31 deltas plus the /31 ones its source version holds. */
export function plusV31<T extends { partId: string; portId: string }>(
  base: readonly T[],
  sourceVersion: keyof typeof FROM_VERSION,
) {
  return sortedEndpointDeltas<{ partId: string; portId: string }>(
    base,
    FROM_VERSION[sourceVersion],
  );
}

/** What a source row from /8 on carries: 15573's two grid clutches, then its /31 studs. */
export function carriedPlusV31(sourceVersion: keyof typeof FROM_VERSION) {
  return [
    ...EXPECTED_JUMPER_1X2_CARRIED_ENDPOINT_DELTAS,
    ...expectedV31CarriedDeltas(FROM_VERSION[sourceVersion]),
  ];
}

/** The catalog version each of the seven parts was admitted at, in catalog order. */
const V31_PART_ADMITTED_AT = [8, 8, 15, 18, 19, 20, 23] as const;

/**
 * The /30 -> /31 row as a report from a source at `sourceVersion` carries it:
 * filtered to the parts that source's roster holds, and absent before /8.
 */
export function expectedV31InterpretationChanges(sourceVersion: number) {
  const affectedCatalogPartIds = EXPECTED_V31_STUD_PROFILE_PART_IDS.filter(
    (_, index) => V31_PART_ADMITTED_AT[index]! <= sourceVersion,
  );
  return affectedCatalogPartIds.length === 0
    ? []
    : [{ ...EXPECTED_V31_INTERPRETATION_CHANGE, affectedCatalogPartIds }];
}
