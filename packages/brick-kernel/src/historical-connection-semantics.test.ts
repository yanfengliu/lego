import { CONNECTOR_PAIR_RULES, PART_DEFINITIONS } from "@lego-studio/catalog";
import { describe, expect, it } from "vitest";

import {
  connectionEndpointKey,
  projectConnectionSemantics,
} from "./connection-semantics-projection.ts";
import {
  CURRENT_CONNECTION_SEMANTICS_AUTHORITY,
  REVIEWED_HISTORICAL_CONNECTION_SEMANTICS_BY_TRUTH_HASH,
  historicalConnectionSemanticsBlockingReasons,
} from "./historical-connection-semantics.ts";
import { REVIEWED_HISTORICAL_TRUTH_SNAPSHOTS } from "./migration.ts";
import {
  REVIEWED_TRUTH_V1,
  documentAtReviewedTruth,
} from "./migration-historical-fixtures.test-support.ts";
import { getReviewedHistoricalCatalogRoster } from "./historical-catalog-rosters.ts";

const EXPECTED_JUMPER_15573_V30_CHANGES = [
  {
    partId: "builtin:jumper-plate-1x2",
    portId: "stud:0",
    sourceDigest: "sha256:61dfdb8f0f1be08d2f879c6eb8cc6adcbf983c3b60adbf78e7a8e58000a1ab1c",
    targetDigest: "sha256:6d18cd98abc61c5dc6e8f7c2150b01e4c1f3399e221cb7ea98490bc9469b47a2",
  },
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

const EXPECTED_V30_NOMINAL_STUD_PROFILE_CHANGES = [
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
] as const;

const EXPECTED_VALIDATED_STUD_PROFILE_CHANGES_BEFORE_30357 = [
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
  ...EXPECTED_JUMPER_15573_V30_CHANGES,
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
] as const;

const EXPECTED_VALIDATED_STUD_PROFILE_CHANGES_30357 = [
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
] as const;

const EXPECTED_VALIDATED_STUD_PROFILE_CHANGES_WING = [
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
] as const;

const EXPECTED_TECHNIC_BRICK_1X2_THROUGH_BORE_CHANGE = {
  partId: "builtin:technic-brick-1x2-axle-hole",
  portId: "axleHole:0",
  sourceDigest: "sha256:5b3166a63945434503bd33561dea6e46ecafccff07184cfa7e4352b4823d278b",
  targetDigest: "sha256:8492dfdbf8872bc38cb469a3aad2fe6766c8081324df2eb03a00ca9c5c027570",
} as const;

type ExpectedEndpointDelta = {
  readonly partId: string;
  readonly portId: string;
  readonly sourceDigest: string | null;
  readonly targetDigest: string | null;
};

function mergeExpectedEndpointDeltas(
  ...groups: readonly (readonly ExpectedEndpointDelta[])[]
): readonly ExpectedEndpointDelta[] {
  return groups
    .flat()
    .sort((left, right) =>
      connectionEndpointKey(left.partId, left.portId).localeCompare(
        connectionEndpointKey(right.partId, right.portId),
      ),
    );
}

function expectedV30NominalStudProfileChanges(
  ...partIds: readonly string[]
): readonly ExpectedEndpointDelta[] {
  const included = new Set(partIds);
  return EXPECTED_V30_NOMINAL_STUD_PROFILE_CHANGES.filter(({ partId }) => included.has(partId));
}

const EXPECTED_V30_NOMINAL_STUD_PROFILE_CHANGES_V8 = expectedV30NominalStudProfileChanges(
  "builtin:wedge-plate-3x3-cut-corner",
  "builtin:corner-plate-2x2-round",
);
const EXPECTED_V30_NOMINAL_STUD_PROFILE_CHANGES_V15 = expectedV30NominalStudProfileChanges(
  "builtin:wedge-plate-3x3-cut-corner",
  "builtin:corner-plate-2x2-round",
  "builtin:bracket-1x2-1x4-rounded-bottom",
);
const EXPECTED_V30_NOMINAL_STUD_PROFILE_CHANGES_V18 = expectedV30NominalStudProfileChanges(
  "builtin:wedge-plate-3x3-cut-corner",
  "builtin:corner-plate-2x2-round",
  "builtin:bracket-1x2-1x4-rounded-bottom",
  "builtin:arch-1x6-thin-top",
);
const EXPECTED_V30_NOMINAL_STUD_PROFILE_CHANGES_V19 = expectedV30NominalStudProfileChanges(
  "builtin:wedge-plate-3x3-cut-corner",
  "builtin:corner-plate-2x2-round",
  "builtin:bracket-1x2-1x4-rounded-bottom",
  "builtin:arch-1x6-thin-top",
  "builtin:bracket-2x2-1x2-vertical-studs",
);
const EXPECTED_V30_NOMINAL_STUD_PROFILE_CHANGES_V20 = expectedV30NominalStudProfileChanges(
  "builtin:wedge-plate-3x3-cut-corner",
  "builtin:corner-plate-2x2-round",
  "builtin:bracket-1x2-1x4-rounded-bottom",
  "builtin:arch-1x6-thin-top",
  "builtin:bracket-2x2-1x2-vertical-studs",
  "builtin:brick-1x2-grille",
);

function expectedValidatedStudProfileChanges(
  v30Changes: readonly ExpectedEndpointDelta[],
): readonly ExpectedEndpointDelta[] {
  return mergeExpectedEndpointDeltas(
    EXPECTED_VALIDATED_STUD_PROFILE_CHANGES_BEFORE_30357,
    EXPECTED_VALIDATED_STUD_PROFILE_CHANGES_30357,
    EXPECTED_VALIDATED_STUD_PROFILE_CHANGES_WING,
    v30Changes,
  );
}

const EXPECTED_VALIDATED_STUD_PROFILE_CHANGES_V8 = expectedValidatedStudProfileChanges(
  EXPECTED_V30_NOMINAL_STUD_PROFILE_CHANGES_V8,
);
const EXPECTED_VALIDATED_STUD_PROFILE_CHANGES_V15 = expectedValidatedStudProfileChanges(
  EXPECTED_V30_NOMINAL_STUD_PROFILE_CHANGES_V15,
);
const EXPECTED_VALIDATED_STUD_PROFILE_CHANGES_V18 = expectedValidatedStudProfileChanges(
  EXPECTED_V30_NOMINAL_STUD_PROFILE_CHANGES_V18,
);
const EXPECTED_VALIDATED_STUD_PROFILE_CHANGES_V19 = expectedValidatedStudProfileChanges(
  EXPECTED_V30_NOMINAL_STUD_PROFILE_CHANGES_V19,
);
const EXPECTED_VALIDATED_STUD_PROFILE_CHANGES_V20 = expectedValidatedStudProfileChanges(
  EXPECTED_V30_NOMINAL_STUD_PROFILE_CHANGES_V20,
);
const EXPECTED_VALIDATED_STUD_PROFILE_AND_1X2_THROUGH_BORE_CHANGES = mergeExpectedEndpointDeltas(
  EXPECTED_VALIDATED_STUD_PROFILE_CHANGES_BEFORE_30357,
  EXPECTED_VALIDATED_STUD_PROFILE_CHANGES_30357,
  [EXPECTED_TECHNIC_BRICK_1X2_THROUGH_BORE_CHANGE],
  EXPECTED_VALIDATED_STUD_PROFILE_CHANGES_WING,
  EXPECTED_V30_NOMINAL_STUD_PROFILE_CHANGES,
);
const EXPECTED_VERSION_30_ENDPOINT_CHANGES = mergeExpectedEndpointDeltas(
  EXPECTED_V30_NOMINAL_STUD_PROFILE_CHANGES,
  EXPECTED_JUMPER_15573_V30_CHANGES,
);

describe("reviewed historical connection semantics", () => {
  it("binds every reviewed truth to an immutable exhaustive authority row", () => {
    const truthHashes = REVIEWED_HISTORICAL_TRUTH_SNAPSHOTS.map(({ truthHash }) => truthHash);
    const rows = Object.entries(REVIEWED_HISTORICAL_CONNECTION_SEMANTICS_BY_TRUTH_HASH);

    expect(rows.map(([truthHash]) => truthHash)).toEqual(truthHashes);
    expect(Object.isFrozen(REVIEWED_HISTORICAL_CONNECTION_SEMANTICS_BY_TRUTH_HASH)).toBe(true);
    expect(rows.every(([, row]) => Object.isFrozen(row))).toBe(true);
    expect(rows.reduce((count, [, row]) => count + row.endpointDeltas.length, 0)).toBe(946);
    expect(rows.flatMap(([, row]) => row.pairDeltas)).toEqual([]);
    for (const [, row] of rows) {
      const keys = row.endpointDeltas.map(({ partId, portId }) =>
        connectionEndpointKey(partId, portId),
      );
      expect(new Set(keys).size).toBe(keys.length);
    }
  });

  it("pins the complete /19 connector authority that /20 extends additively", () => {
    expect(
      REVIEWED_HISTORICAL_CONNECTION_SEMANTICS_BY_TRUTH_HASH[
        "sha256:e34fcc8ac627f0dcfdb1d779246a723101d765f931830a4c06514d9daff75c26"
      ],
    ).toEqual({
      sourceCommit: "a49137131566247daeb01d80ff88302b41bcf538",
      sourceEndpointCount: 2262,
      sourceEndpointMapDigest:
        "sha256:4224f8ca202557d357bd4c7a94707fc9d3e58617e2d87a8e8e16059d516a58ba",
      sourcePairCount: 3,
      sourcePairMapDigest:
        "sha256:7431a242907aa9829ead6a279d0b530fe5f5d00ee31e6ddc1576fe66a8a07add",
      endpointDeltas: EXPECTED_VALIDATED_STUD_PROFILE_CHANGES_V19,
      pairDeltas: [],
    });
  });

  it("pins each additive profile-class admission stage before /19", () => {
    expect(
      REVIEWED_HISTORICAL_CONNECTION_SEMANTICS_BY_TRUTH_HASH[
        "sha256:db8c1740f23c65a4c0046c679e321a559623ac18a9c3fe59357b912e3a48a1b3"
      ]?.endpointDeltas,
    ).toEqual(EXPECTED_VALIDATED_STUD_PROFILE_CHANGES_V8);
    expect(
      REVIEWED_HISTORICAL_CONNECTION_SEMANTICS_BY_TRUTH_HASH[
        "sha256:f8e7efbd1bc969ac699fd68db9696af693898a15ffb7901821e676d843240e2f"
      ]?.endpointDeltas,
    ).toEqual(EXPECTED_VALIDATED_STUD_PROFILE_CHANGES_V15);
    expect(
      REVIEWED_HISTORICAL_CONNECTION_SEMANTICS_BY_TRUTH_HASH[
        "sha256:8172cc4f993b46bb9fa8f782bb2b295c516e95c16f2d6861e4a18219ef2e1b20"
      ]?.endpointDeltas,
    ).toEqual(EXPECTED_VALIDATED_STUD_PROFILE_CHANGES_V18);
  });

  it("preserves a historical source root while the live target excludes a future blind kind", () => {
    const historicalRow =
      REVIEWED_HISTORICAL_CONNECTION_SEMANTICS_BY_TRUTH_HASH[
        "sha256:e34fcc8ac627f0dcfdb1d779246a723101d765f931830a4c06514d9daff75c26"
      ]!;
    expect(historicalRow.sourceEndpointMapDigest).toBe(
      "sha256:4224f8ca202557d357bd4c7a94707fc9d3e58617e2d87a8e8e16059d516a58ba",
    );

    const roster = getReviewedHistoricalCatalogRoster(
      "sha256:e34fcc8ac627f0dcfdb1d779246a723101d765f931830a4c06514d9daff75c26",
    )!;
    const historicalKinds = CONNECTOR_PAIR_RULES.flatMap(({ male, female }) =>
      female === "blindAxleHole" ? [] : [male, female],
    );
    const target = projectConnectionSemantics(
      PART_DEFINITIONS.filter(({ id }) => roster.catalogPartIds.includes(id)),
      CONNECTOR_PAIR_RULES,
      "live-strict",
      { semanticConnectorKinds: historicalKinds },
    );
    expect(target.pairCount).toBe(3);
    expect(target.pairMapDigest).toBe(
      "sha256:7431a242907aa9829ead6a279d0b530fe5f5d00ee31e6ddc1576fe66a8a07add",
    );
  });

  it("pins the complete /20 connector authority that /21 extends additively", () => {
    expect(
      REVIEWED_HISTORICAL_CONNECTION_SEMANTICS_BY_TRUTH_HASH[
        "sha256:9c4c32efcaf9bc5f2a251e77188134075f58ca536c6da6148e34b93419d84ad2"
      ],
    ).toEqual({
      sourceCommit: "e037b7e60e1240ddf196d381850ae49bc8c80e9b",
      sourceEndpointCount: 2266,
      sourceEndpointMapDigest:
        "sha256:863b65218ceb2522510b7bf2e52f4cd9749c7b87fc5979499b9ef191523f6799",
      sourcePairCount: 3,
      sourcePairMapDigest:
        "sha256:7431a242907aa9829ead6a279d0b530fe5f5d00ee31e6ddc1576fe66a8a07add",
      endpointDeltas: EXPECTED_VALIDATED_STUD_PROFILE_CHANGES_V20,
      pairDeltas: [],
    });
  });

  it("pins the complete /21 connector authority that /22 extends additively", () => {
    expect(
      REVIEWED_HISTORICAL_CONNECTION_SEMANTICS_BY_TRUTH_HASH[
        "sha256:44044c90de3bb380f32c26db561bad1bd0f247c22ea35c54d75aa5ec6ef8f9a1"
      ],
    ).toEqual({
      sourceCommit: "98dc1e82b309eb52a6a32e0928ce075acb3e93ed",
      sourceEndpointCount: 2269,
      sourceEndpointMapDigest:
        "sha256:f84f1e0ec3e1d628b1bd49d869e6b9f3dbdb9d95be87b2fa81b396a566462d2b",
      sourcePairCount: 3,
      sourcePairMapDigest:
        "sha256:7431a242907aa9829ead6a279d0b530fe5f5d00ee31e6ddc1576fe66a8a07add",
      endpointDeltas: EXPECTED_VALIDATED_STUD_PROFILE_CHANGES_V20,
      pairDeltas: [],
    });
  });

  it("pins the complete /22 connector authority that /23 extends additively", () => {
    expect(
      REVIEWED_HISTORICAL_CONNECTION_SEMANTICS_BY_TRUTH_HASH[
        "sha256:7f64021239ab6395a3666f1f72908fd420b73065909822bc68e5226785bfa12e"
      ],
    ).toEqual({
      sourceCommit: "94db468e6a5045a0a7732f8f4adc128e90f025b6",
      sourceEndpointCount: 2272,
      sourceEndpointMapDigest:
        "sha256:006157a4816e7dc9a001b0c15a7c2e45fdbaeb611142b428458457f2ea4b8ff2",
      sourcePairCount: 3,
      sourcePairMapDigest:
        "sha256:7431a242907aa9829ead6a279d0b530fe5f5d00ee31e6ddc1576fe66a8a07add",
      endpointDeltas: EXPECTED_VALIDATED_STUD_PROFILE_CHANGES_V20,
      pairDeltas: [],
    });
  });

  it("pins the complete /23 connector authority that /24 extends additively", () => {
    expect(
      REVIEWED_HISTORICAL_CONNECTION_SEMANTICS_BY_TRUTH_HASH[
        "sha256:af781e7356e28622fb13afcb571d28495a0962d6aa78ef70d988126a9c4aeefb"
      ],
    ).toEqual({
      sourceCommit: "d99b74d355684c8ceaca0ad6f2df76d96ebe4937",
      sourceEndpointCount: 2277,
      sourceEndpointMapDigest:
        "sha256:5c441a333206827791b01f59643c145102ddf28d1410667d183fadafc0d0d84c",
      sourcePairCount: 3,
      sourcePairMapDigest:
        "sha256:7431a242907aa9829ead6a279d0b530fe5f5d00ee31e6ddc1576fe66a8a07add",
      endpointDeltas: EXPECTED_VALIDATED_STUD_PROFILE_AND_1X2_THROUGH_BORE_CHANGES,
      pairDeltas: [],
    });
  });

  it("pins the complete /24 connector authority that /25 extends additively", () => {
    expect(
      REVIEWED_HISTORICAL_CONNECTION_SEMANTICS_BY_TRUTH_HASH[
        "sha256:09288fc048ec112225b9e605df7af2d2e9692031b9eb7a89755575956af4c10d"
      ],
    ).toEqual({
      sourceCommit: "ec2387bf8b3b1a8d70a11e95c6c6547049037886",
      sourceEndpointCount: 2295,
      sourceEndpointMapDigest:
        "sha256:6dfd3657c9d4d3af8815fa6dad9cb2906416436239a07cfdcb968932b90f2ab1",
      sourcePairCount: 3,
      sourcePairMapDigest:
        "sha256:7431a242907aa9829ead6a279d0b530fe5f5d00ee31e6ddc1576fe66a8a07add",
      endpointDeltas: EXPECTED_VALIDATED_STUD_PROFILE_AND_1X2_THROUGH_BORE_CHANGES,
      pairDeltas: [],
    });
  });

  it("pins the complete /29 connector authority that /30 reinterprets", () => {
    expect(
      REVIEWED_HISTORICAL_CONNECTION_SEMANTICS_BY_TRUTH_HASH[
        "sha256:54762419e4779c6c15566052062fcaa432cb45e3a13704b5af1563b4fa94e8eb"
      ],
    ).toEqual({
      sourceCommit: "6b02e50732d7908374b168ce0582476ac0422769",
      sourceEndpointCount: 2339,
      sourceEndpointMapDigest:
        "sha256:3ee33ad94b3f4ff2ea0024c27753d871f26b7bbe0cd8d74c7309287c804d2be9",
      sourcePairCount: 4,
      sourcePairMapDigest:
        "sha256:92dd1cdfb9f34879f55a5ee5a0827b5c24c830da654c90bd3b00896025ca5731",
      endpointDeltas: EXPECTED_VERSION_30_ENDPOINT_CHANGES,
      pairDeltas: [],
    });
  });

  it("pins the complete live target and every delta's source-roster target", () => {
    const live = projectConnectionSemantics(PART_DEFINITIONS, CONNECTOR_PAIR_RULES, "live-strict");

    expect({
      endpointCount: live.endpointCount,
      endpointMapDigest: live.endpointMapDigest,
      pairCount: live.pairCount,
      pairMapDigest: live.pairMapDigest,
    }).toEqual({
      endpointCount: CURRENT_CONNECTION_SEMANTICS_AUTHORITY.endpointCount,
      endpointMapDigest: CURRENT_CONNECTION_SEMANTICS_AUTHORITY.endpointMapDigest,
      pairCount: CURRENT_CONNECTION_SEMANTICS_AUTHORITY.pairCount,
      pairMapDigest: CURRENT_CONNECTION_SEMANTICS_AUTHORITY.pairMapDigest,
    });
    for (const [truthHash, row] of Object.entries(
      REVIEWED_HISTORICAL_CONNECTION_SEMANTICS_BY_TRUTH_HASH,
    )) {
      const roster = getReviewedHistoricalCatalogRoster(truthHash);
      expect(roster, `historical roster ${truthHash}`).toBeDefined();
      const target = projectConnectionSemantics(
        PART_DEFINITIONS.filter(({ id }) => roster!.catalogPartIds.includes(id)),
        CONNECTOR_PAIR_RULES,
        "live-strict",
        {
          semanticConnectorKinds: CONNECTOR_PAIR_RULES.flatMap(({ male, female }) =>
            female === "blindAxleHole" ? [] : [male, female],
          ),
        },
      );
      for (const delta of row.endpointDeltas) {
        expect(
          target.endpointDigests.get(connectionEndpointKey(delta.partId, delta.portId)) ?? null,
        ).toBe(delta.targetDigest);
      }
    }
  });

  it("fails closed when the live target no longer matches its reviewed projection", () => {
    const historical = documentAtReviewedTruth({
      id: "target-drift",
      name: "Target drift",
      truth: REVIEWED_TRUTH_V1,
    });
    const truncatedTarget = projectConnectionSemantics(
      PART_DEFINITIONS.slice(0, -1),
      CONNECTOR_PAIR_RULES,
      "live-strict",
    );

    expect(
      historicalConnectionSemanticsBlockingReasons(
        historical,
        "sha256:0f6b9dcb03a9dd570b4ccc68f41a015bb33422e5cf6c1fe032f1a15bfbd76a8a",
        CURRENT_CONNECTION_SEMANTICS_AUTHORITY.truthHash,
        truncatedTarget,
      ),
    ).toEqual([
      `Current connector endpoint projection is ${truncatedTarget.endpointCount}/${truncatedTarget.endpointMapDigest}, expected ${CURRENT_CONNECTION_SEMANTICS_AUTHORITY.endpointCount}/${CURRENT_CONNECTION_SEMANTICS_AUTHORITY.endpointMapDigest}; run npm run migration-history:check and review the complete delta`,
      `Current reachable connector-pair projection is ${truncatedTarget.pairCount}/${truncatedTarget.pairMapDigest}, expected ${CURRENT_CONNECTION_SEMANTICS_AUTHORITY.pairCount}/${CURRENT_CONNECTION_SEMANTICS_AUTHORITY.pairMapDigest}; run npm run migration-history:check and review the complete delta`,
    ]);
  });

  it("does not normalize a missing live connector gender into the reviewed target", () => {
    const mutatedParts = structuredClone(PART_DEFINITIONS) as unknown as {
      id: string;
      connectors: { id: string; gender?: unknown }[];
    }[];
    const brick = mutatedParts.find(({ id }) => id === "builtin:brick-1x1")!;
    const stud = brick.connectors.find(({ id }) => id === "stud:0:0")!;
    delete stud.gender;
    const mutatedTarget = projectConnectionSemantics(
      mutatedParts as unknown as typeof PART_DEFINITIONS,
      CONNECTOR_PAIR_RULES,
      "live-strict",
    );
    const historical = documentAtReviewedTruth({
      id: "missing-live-gender",
      name: "Missing live gender",
      truth: REVIEWED_TRUTH_V1,
    });

    expect(mutatedTarget.endpointMapDigest).not.toBe(
      CURRENT_CONNECTION_SEMANTICS_AUTHORITY.endpointMapDigest,
    );
    expect(
      historicalConnectionSemanticsBlockingReasons(
        historical,
        "sha256:0f6b9dcb03a9dd570b4ccc68f41a015bb33422e5cf6c1fe032f1a15bfbd76a8a",
        CURRENT_CONNECTION_SEMANTICS_AUTHORITY.truthHash,
        mutatedTarget,
      ),
    ).toEqual([
      `Current connector endpoint projection is ${mutatedTarget.endpointCount}/${mutatedTarget.endpointMapDigest}, expected ${CURRENT_CONNECTION_SEMANTICS_AUTHORITY.endpointCount}/${CURRENT_CONNECTION_SEMANTICS_AUTHORITY.endpointMapDigest}; run npm run migration-history:check and review the complete delta`,
    ]);
  });

  it("includes future connector fields in the live endpoint authority", () => {
    const mutatedParts = structuredClone(PART_DEFINITIONS) as unknown as {
      id: string;
      connectors: (Record<string, unknown> & { id: string })[];
    }[];
    const brick = mutatedParts.find(({ id }) => id === "builtin:brick-1x1")!;
    const stud = brick.connectors.find(({ id }) => id === "stud:0:0")!;
    stud.futureRuntimeSemantics = "must-move-the-root";

    const mutatedTarget = projectConnectionSemantics(
      mutatedParts as unknown as typeof PART_DEFINITIONS,
      CONNECTOR_PAIR_RULES,
      "live-strict",
    );

    expect(mutatedTarget.endpointMapDigest).not.toBe(
      CURRENT_CONNECTION_SEMANTICS_AUTHORITY.endpointMapDigest,
    );
    expect(mutatedTarget.pairMapDigest).toBe(CURRENT_CONNECTION_SEMANTICS_AUTHORITY.pairMapDigest);
  });

  it("deep-freezes live pair rows and distinguishes a missing live axis rule", () => {
    const firstRule = CONNECTOR_PAIR_RULES[0]!;
    const originalAxis = firstRule.axisMatching;
    expect(Object.isFrozen(firstRule)).toBe(true);
    expect(Reflect.set(firstRule, "axisMatching", "collinear")).toBe(false);
    expect(firstRule.axisMatching).toBe(originalAxis);

    const rulesWithoutAxis = CONNECTOR_PAIR_RULES.map((rule, index) => {
      if (index !== 0) return rule;
      const withoutAxis = { ...rule } as Record<string, unknown>;
      delete withoutAxis.axisMatching;
      return withoutAxis;
    });
    const mutatedTarget = projectConnectionSemantics(
      PART_DEFINITIONS,
      rulesWithoutAxis as unknown as typeof CONNECTOR_PAIR_RULES,
      "live-strict",
    );

    expect(mutatedTarget.endpointMapDigest).not.toBe(
      CURRENT_CONNECTION_SEMANTICS_AUTHORITY.endpointMapDigest,
    );
    expect(mutatedTarget.pairMapDigest).not.toBe(
      CURRENT_CONNECTION_SEMANTICS_AUTHORITY.pairMapDigest,
    );
  });

  it("includes future pair-rule fields in both live authorities", () => {
    const mutatedRules = structuredClone(CONNECTOR_PAIR_RULES) as unknown as Record<
      string,
      unknown
    >[];
    mutatedRules[0]!.futureRuntimeSemantics = "must-move-both-roots";

    const mutatedTarget = projectConnectionSemantics(
      PART_DEFINITIONS,
      mutatedRules as unknown as typeof CONNECTOR_PAIR_RULES,
      "live-strict",
    );

    expect(mutatedTarget.endpointMapDigest).not.toBe(
      CURRENT_CONNECTION_SEMANTICS_AUTHORITY.endpointMapDigest,
    );
    expect(mutatedTarget.pairMapDigest).not.toBe(
      CURRENT_CONNECTION_SEMANTICS_AUTHORITY.pairMapDigest,
    );
  });
});
