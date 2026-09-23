import { readOpaqueRealBuildPrefix50Step43ActionBinding } from "../../../scripts/part-identification-prefix50-verified-projection.mjs";

export interface RealBuildPrefix50Step43ActionMemberBinding {
  readonly occurrenceOrdinal: 277 | 278 | 279 | 280;
  readonly phaseMemberOrdinal: 1 | 2;
  readonly builderBrickRef: string;
  readonly officialDesignId: "3710" | "3040" | "3069";
  readonly designRevision: "3710;L" | "3040;F" | "3069;Q";
}

export interface RealBuildPrefix50Step43ActionPhaseBinding {
  readonly sequence: 69 | 70 | 71;
  readonly phaseId: string;
  readonly sourceDigest: `sha256:${string}`;
  readonly stepUuid: string;
  readonly members: readonly RealBuildPrefix50Step43ActionMemberBinding[];
}

export interface RealBuildPrefix50Step43ActionBinding {
  readonly schemaVersion: "lego.real-build-prefix50-step43-action-binding/1";
  readonly sourceSetId: "6651557";
  readonly actionPreparationDigest: `sha256:${string}`;
  readonly officialModelPhaseDigest: `sha256:${string}`;
  readonly sourcePdfDigest: `sha256:${string}`;
  readonly stepActionDigest: `sha256:${string}`;
  readonly printedStepNumber: 43;
  readonly lateStep42: {
    readonly stepActionDigest: `sha256:${string}`;
    readonly callouts: readonly {
      readonly identity: string;
      readonly quantity: 1;
      readonly catalogPartId: "builtin:tile-1x2" | "builtin:plate-1x4";
      readonly cropDigest: `sha256:${string}`;
    }[];
  };
  readonly subBuildPath: readonly [string, string];
  readonly phases: readonly RealBuildPrefix50Step43ActionPhaseBinding[];
  readonly callouts: readonly {
    readonly identity: string;
    readonly quantity: 1 | 2;
    readonly catalogPartId: string;
    readonly cropDigest: `sha256:${string}`;
  }[];
}

export function readRealBuildPrefix50Step43ActionBinding(
  unsafeReader: unknown,
): RealBuildPrefix50Step43ActionBinding {
  return readOpaqueRealBuildPrefix50Step43ActionBinding(
    unsafeReader,
  ) as RealBuildPrefix50Step43ActionBinding;
}
