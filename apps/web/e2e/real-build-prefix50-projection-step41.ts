// @ts-expect-error The opaque verifier intentionally has no caller-facing TS surface.
import { readOpaqueRealBuildPrefix50Step41ActionBinding } from "../../../scripts/part-identification-prefix50-verified-projection.mjs";

export interface RealBuildPrefix50Step41ActionMemberBinding {
  readonly occurrenceOrdinal: 270 | 271 | 272 | 273;
  readonly phaseMemberOrdinal: 1 | 2 | 3 | 4;
  readonly builderBrickRef:
    | "1260a44e-b125-411e-8552-596f22aa32e4"
    | "a9aee720-9a6d-4d05-b1cb-2821d8101d03"
    | "4287ddd1-1cc4-4cc5-ae50-acf1d543cb06"
    | "8a6a770f-a0b9-430a-8802-8f057fbd748a";
  readonly officialDesignId: "35480";
  readonly designRevision: "35480;K";
}

export interface RealBuildPrefix50Step41ActionBinding {
  readonly schemaVersion: "lego.real-build-prefix50-step41-action-binding/1";
  readonly sourceSetId: "6651557";
  readonly actionPreparationDigest: `sha256:${string}`;
  readonly officialModelPhaseDigest: `sha256:${string}`;
  readonly sourcePdfDigest: `sha256:${string}`;
  readonly stepActionDigest: `sha256:${string}`;
  readonly printedStepNumber: 41;
  readonly phaseSequence: 67;
  readonly phaseKind: "direct";
  readonly phaseId: "direct:862c7cd5-226f-43a4-8d7b-a8da9cb94a9b:1";
  readonly phaseSourceDigest: `sha256:${string}`;
  readonly stepUuid: "862c7cd5-226f-43a4-8d7b-a8da9cb94a9b";
  readonly subBuildPath: readonly [string, string];
  readonly callout: {
    readonly identity: "p44|q4|x80.989|y495.535";
    readonly pageNumber: 44;
    readonly quantity: 4;
    readonly cropDigest: `sha256:${string}`;
  };
  readonly members: readonly [
    RealBuildPrefix50Step41ActionMemberBinding,
    RealBuildPrefix50Step41ActionMemberBinding,
    RealBuildPrefix50Step41ActionMemberBinding,
    RealBuildPrefix50Step41ActionMemberBinding,
  ];
}

export function readRealBuildPrefix50Step41ActionBinding(
  unsafeReader: unknown,
): RealBuildPrefix50Step41ActionBinding {
  return readOpaqueRealBuildPrefix50Step41ActionBinding(
    unsafeReader,
  ) as RealBuildPrefix50Step41ActionBinding;
}
