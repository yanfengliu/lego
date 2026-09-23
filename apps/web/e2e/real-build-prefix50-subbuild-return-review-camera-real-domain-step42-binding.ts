import { canonicalDigest, deepFreeze } from "@lego-studio/brick-kernel";
import type { RigidTransform } from "@lego-studio/protocol";

export interface RealBuildPrefix50Step42SourceGeometryMember {
  readonly occurrenceOrdinal: 274 | 275 | 276;
  readonly phaseMemberOrdinal: 1 | 2 | 3;
  readonly builderBrickRef:
    | "27fedc66-8b4f-4c03-87d7-27a53abd009e"
    | "c415d8f1-20b7-491c-824e-f498b2d10759"
    | "4ad443a5-76cf-4ceb-9d45-c07a8b542dea";
  readonly officialDesignId: "6636" | "3069" | "3710";
  readonly designRevision: "6636;N" | "3069;Q" | "3710;L";
  readonly catalogPartId: "builtin:tile-1x6" | "builtin:tile-1x2" | "builtin:plate-1x4";
  readonly catalogWorldTransform: RigidTransform;
}

const MEMBERS = [
  {
    occurrenceOrdinal: 274,
    phaseMemberOrdinal: 1,
    builderBrickRef: "27fedc66-8b4f-4c03-87d7-27a53abd009e",
    officialDesignId: "6636",
    designRevision: "6636;N",
    catalogPartId: "builtin:tile-1x6",
    catalogWorldTransform: {
      positionLdu: [400, -98, -110],
      orientationId: "proper-m-00nn000p0",
    },
  },
  {
    occurrenceOrdinal: 275,
    phaseMemberOrdinal: 2,
    builderBrickRef: "c415d8f1-20b7-491c-824e-f498b2d10759",
    officialDesignId: "3069",
    designRevision: "3069;Q",
    catalogPartId: "builtin:tile-1x2",
    catalogWorldTransform: {
      positionLdu: [240, -98, -110],
      orientationId: "proper-m-00pp000p0",
    },
  },
  {
    occurrenceOrdinal: 276,
    phaseMemberOrdinal: 3,
    builderBrickRef: "4ad443a5-76cf-4ceb-9d45-c07a8b542dea",
    officialDesignId: "3710",
    designRevision: "3710;L",
    catalogPartId: "builtin:plate-1x4",
    catalogWorldTransform: {
      positionLdu: [300, -98, -110],
      orientationId: "proper-m-00nn000p0",
    },
  },
] as const satisfies readonly RealBuildPrefix50Step42SourceGeometryMember[];

export const REAL_BUILD_PREFIX50_STEP42_SOURCE_GEOMETRY_BINDING = deepFreeze({
  schemaVersion: "lego.real-build-prefix50-step42-source-geometry-binding/4" as const,
  authority: "exact-step42-action-and-projection-binding" as const,
  sourceSetId: "6651557" as const,
  sourcePdfDigest:
    "sha256:baef0a373164b58d7c982984b52d4e50b10cc59ed28007acb456faa72359bd27" as const,
  sourceModuleDigest:
    "sha256:444ede9567a3186ae962401769866ffc3a7c80526969ecebba1363f283adc037" as const,
  verifierManifestCommitment:
    "sha256:6b7eb5c97520b50172f6f2365048cbd8810721535ae734a5c13f4d51f57aace3" as const,
  semanticGeometryCommitment:
    "sha256:cfd9678202a6459644721638610e17c7b284e9fe4d329f1c8c1705ef186ad9d8" as const,
  actionPreparationDigest:
    "sha256:cc1163b91bcc3892137e73dd99ae51b9626589572ca683f55e74302bd4a2b267" as const,
  officialModelPhaseDigest:
    "sha256:8988e328aa5793b07fc6c398eb518f4d972d90c8de85c41006db02b2792d896e" as const,
  stepActionDigest:
    "sha256:21a075a8a05ced0e42ad7acb10e0cad752fe812826fa8b6a4e38ca874a49eb0d" as const,
  phaseSourceDigest:
    "sha256:aed22188ce55f7bf14d36903b11da202c5c0afec8e1f844474380c6fad5a9c99" as const,
  independentCatalogOrientationTruth: {
    schemaVersion: "lego.step42-independent-catalog-orientation-truth/1" as const,
    transformPolicyVersion: "part-scoped-proper-orientations-negative-y-up/2" as const,
    rosterDigest:
      "sha256:57446894cd2b917eb5463672655baa012d7c03539ba4147cd89e9c774a309201" as const,
    algebraControlCommitment:
      "sha256:58de4c32f1420988310cd3661f4674c3db7b7458a53f32b644a529e621915904" as const,
    compositionLaw:
      "catalog-world=source-world*transpose(source-to-catalog);position=source-position-catalog-world*frame-translation" as const,
  },
  printedStepNumber: 42 as const,
  phaseSequence: 68 as const,
  phaseKind: "direct" as const,
  phaseId: "direct:f6e6a500-90fd-4af9-bd0b-9cd1bc62e058:1" as const,
  stepUuid: "f6e6a500-90fd-4af9-bd0b-9cd1bc62e058" as const,
  subBuildPath: [
    "7004cf0d-d97f-4b0d-8572-970e23815c05",
    "2956f76b-0e29-497c-84ae-d8bd9099aa3f",
  ] as const,
  callout: {
    identity: "p44|q1|x101.684|y227.599" as const,
    pageNumber: 44 as const,
    quantity: 1 as const,
    cropDigest: "sha256:66fda118c6cbad71c6058ac3cf7b4f5e69161fd0ad026a19389edf96687bc888" as const,
  },
  members: MEMBERS,
});

export const REAL_BUILD_PREFIX50_STEP42_SOURCE_GEOMETRY_BINDING_COMMITMENT = canonicalDigest(
  REAL_BUILD_PREFIX50_STEP42_SOURCE_GEOMETRY_BINDING,
);

const SEMANTIC_GEOMETRY = deepFreeze({
  schemaVersion: "lego.real-build-prefix50-step42-semantic-geometry/1" as const,
  sourceSetId: REAL_BUILD_PREFIX50_STEP42_SOURCE_GEOMETRY_BINDING.sourceSetId,
  printedStepNumber: REAL_BUILD_PREFIX50_STEP42_SOURCE_GEOMETRY_BINDING.printedStepNumber,
  phaseSequence: REAL_BUILD_PREFIX50_STEP42_SOURCE_GEOMETRY_BINDING.phaseSequence,
  phaseId: REAL_BUILD_PREFIX50_STEP42_SOURCE_GEOMETRY_BINDING.phaseId,
  calloutIdentity: REAL_BUILD_PREFIX50_STEP42_SOURCE_GEOMETRY_BINDING.callout.identity,
  members: REAL_BUILD_PREFIX50_STEP42_SOURCE_GEOMETRY_BINDING.members.map(
    ({
      occurrenceOrdinal,
      phaseMemberOrdinal,
      builderBrickRef,
      officialDesignId,
      designRevision,
      catalogPartId,
      catalogWorldTransform,
    }) => ({
      occurrenceOrdinal,
      phaseMemberOrdinal,
      builderBrickRef,
      officialDesignId,
      designRevision,
      catalogPartId,
      catalogWorldTransform,
    }),
  ),
});

export const REAL_BUILD_PREFIX50_STEP42_SEMANTIC_GEOMETRY_COMMITMENT =
  canonicalDigest(SEMANTIC_GEOMETRY);
