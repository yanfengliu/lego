import { EXPECTED_JUMPER_1X2_CENTRE_SEAT_CHANGES } from "./migration-historical-fixtures.test-support.ts";

/**
 * The reviewed endpoint deltas historical-connection-semantics.test.ts pins for
 * the /19-/25 authority rows: validated stud-profile, 15573 centre-seat and
 * 1x2 technic-brick through-bore changes, each a source and target digest.
 */
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

// /30's 15573 deltas sort between the 3x3 corner plate's and the round-end plate's.
const EXPECTED_STUD_PROFILE_AND_CENTRE_SEAT_CHANGES_BEFORE_30357 = [
  ...EXPECTED_VALIDATED_STUD_PROFILE_CHANGES_BEFORE_30357.filter(
    ({ partId }) => partId === "builtin:corner-plate-3x3",
  ),
  ...EXPECTED_JUMPER_1X2_CENTRE_SEAT_CHANGES,
  ...EXPECTED_VALIDATED_STUD_PROFILE_CHANGES_BEFORE_30357.filter(
    ({ partId }) => partId === "builtin:plate-1x2-round-end",
  ),
] as const;

export const EXPECTED_VALIDATED_STUD_PROFILE_CHANGES_V8 = [
  ...EXPECTED_STUD_PROFILE_AND_CENTRE_SEAT_CHANGES_BEFORE_30357,
  ...EXPECTED_VALIDATED_STUD_PROFILE_CHANGES_30357,
  ...EXPECTED_VALIDATED_STUD_PROFILE_CHANGES_WING,
] as const;

export const EXPECTED_VALIDATED_STUD_PROFILE_AND_1X2_THROUGH_BORE_CHANGES = [
  ...EXPECTED_STUD_PROFILE_AND_CENTRE_SEAT_CHANGES_BEFORE_30357,
  ...EXPECTED_VALIDATED_STUD_PROFILE_CHANGES_30357,
  EXPECTED_TECHNIC_BRICK_1X2_THROUGH_BORE_CHANGE,
  ...EXPECTED_VALIDATED_STUD_PROFILE_CHANGES_WING,
] as const;
