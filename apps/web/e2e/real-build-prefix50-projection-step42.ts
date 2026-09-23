import type { RigidTransform } from "@lego-studio/protocol";

import {
  readOpaqueRealBuildPrefix50Step42ActionBinding,
  readOpaqueRealBuildPrefix50Step42SourceGeometryReceipt,
} from "../../../scripts/part-identification-prefix50-verified-projection-step42-source-geometry.mjs";

export interface RealBuildPrefix50Step42ActionMemberBinding {
  readonly occurrenceOrdinal: 274 | 275 | 276;
  readonly phaseMemberOrdinal: 1 | 2 | 3;
  readonly builderBrickRef:
    | "27fedc66-8b4f-4c03-87d7-27a53abd009e"
    | "c415d8f1-20b7-491c-824e-f498b2d10759"
    | "4ad443a5-76cf-4ceb-9d45-c07a8b542dea";
  readonly officialDesignId: "6636" | "3069" | "3710";
  readonly designRevision: "6636;N" | "3069;Q" | "3710;L";
}

export interface RealBuildPrefix50Step42ActionBinding {
  readonly schemaVersion: "lego.real-build-prefix50-step42-action-binding/1";
  readonly sourceSetId: "6651557";
  readonly actionPreparationDigest: `sha256:${string}`;
  readonly officialModelPhaseDigest: `sha256:${string}`;
  readonly sourcePdfDigest: `sha256:${string}`;
  readonly stepActionDigest: `sha256:${string}`;
  readonly printedStepNumber: 42;
  readonly phaseSequence: 68;
  readonly phaseKind: "direct";
  readonly phaseId: "direct:f6e6a500-90fd-4af9-bd0b-9cd1bc62e058:1";
  readonly phaseSourceDigest: `sha256:${string}`;
  readonly stepUuid: "f6e6a500-90fd-4af9-bd0b-9cd1bc62e058";
  readonly subBuildPath: readonly [string, string];
  readonly callout: {
    readonly identity: "p44|q1|x101.684|y227.599";
    readonly pageNumber: 44;
    readonly quantity: 1;
    readonly cropDigest: `sha256:${string}`;
  };
  readonly members: readonly [
    RealBuildPrefix50Step42ActionMemberBinding,
    RealBuildPrefix50Step42ActionMemberBinding,
    RealBuildPrefix50Step42ActionMemberBinding,
  ];
}

export interface RealBuildPrefix50Step42SourceGeometryRow {
  readonly occurrenceOrdinal: 274 | 275 | 276;
  readonly printedStepNumber: 42;
  readonly phaseSequence: 68;
  readonly phaseMemberOrdinal: 1 | 2 | 3;
  readonly builderBrickRef: RealBuildPrefix50Step42ActionMemberBinding["builderBrickRef"];
  readonly partIdentity: {
    readonly officialDesignId: RealBuildPrefix50Step42ActionMemberBinding["officialDesignId"];
    readonly officialDesignRevision: RealBuildPrefix50Step42ActionMemberBinding["designRevision"];
    readonly publishedCatalogPartId: "builtin:tile-1x6" | "builtin:tile-1x2" | "builtin:plate-1x4";
    readonly reconciledCatalogPartId: "builtin:tile-1x6" | "builtin:tile-1x2" | "builtin:plate-1x4";
    readonly sourceLDrawPartId: string;
    readonly catalogLDrawPartId: string;
    readonly basis: "published-exact";
  };
  readonly sourceWorldProposal: RigidTransform & {
    readonly orientationResidual: number;
    readonly positionResidualLdu: number;
  };
  readonly catalogFrameEvidence: {
    readonly orientationId: string;
    readonly translationLdu: readonly [number, number, number];
  };
  readonly catalogWorldTransform: RigidTransform;
}

interface RealBuildPrefix50FullRosterCommitment {
  readonly algorithm: "sha256-json-array-v1";
  readonly rowCount: 320;
  readonly order: "sourceBuilderIdentityOrdinal-ascending";
  readonly digest: `sha256:${string}`;
}

export type RealBuildPrefix50Step42SourceGeometryBinding = Omit<
  RealBuildPrefix50Step42ActionBinding,
  "schemaVersion" | "members"
> & {
  readonly schemaVersion: "lego.real-build-prefix50-step42-source-geometry-binding/4";
  readonly authority: "exact-step42-action-and-projection-binding";
  readonly sourceModuleDigest: `sha256:${string}`;
  readonly verifierManifestCommitment: `sha256:${string}`;
  readonly semanticGeometryCommitment: `sha256:${string}`;
  readonly independentCatalogOrientationTruth: {
    readonly schemaVersion: "lego.step42-independent-catalog-orientation-truth/1";
    readonly transformPolicyVersion: "part-scoped-proper-orientations-negative-y-up/2";
    readonly rosterDigest: `sha256:${string}`;
    readonly algebraControlCommitment: `sha256:${string}`;
    readonly compositionLaw: "catalog-world=source-world*transpose(source-to-catalog);position=source-position-catalog-world*frame-translation";
  };
  readonly members: readonly [
    RealBuildPrefix50Step42ActionMemberBinding & {
      readonly catalogPartId: "builtin:tile-1x6" | "builtin:tile-1x2" | "builtin:plate-1x4";
      readonly catalogWorldTransform: RigidTransform;
    },
    RealBuildPrefix50Step42ActionMemberBinding & {
      readonly catalogPartId: "builtin:tile-1x6" | "builtin:tile-1x2" | "builtin:plate-1x4";
      readonly catalogWorldTransform: RigidTransform;
    },
    RealBuildPrefix50Step42ActionMemberBinding & {
      readonly catalogPartId: "builtin:tile-1x6" | "builtin:tile-1x2" | "builtin:plate-1x4";
      readonly catalogWorldTransform: RigidTransform;
    },
  ];
};

export interface RealBuildPrefix50Step42SourceGeometryReceipt {
  readonly schemaVersion: "lego.real-build-prefix50-step42-source-geometry-admission/2";
  readonly authority: "offline-opaque-source-geometry-diagnostic";
  readonly sourceSetId: "6651557";
  readonly actionPreparationDigest: `sha256:${string}`;
  readonly officialWorldReconciliationDigest: `sha256:${string}`;
  readonly occurrenceCommitment: RealBuildPrefix50FullRosterCommitment;
  readonly worldTransformCommitment: RealBuildPrefix50FullRosterCommitment;
  readonly verifierManifest: {
    readonly schemaVersion: "lego.step42-source-geometry-verifier-manifest/2";
    readonly algorithm: "sha256-exact-file-bytes-v1";
    readonly files: readonly {
      readonly role: string;
      readonly relativePath: string;
      readonly bytes: number;
      readonly digest: `sha256:${string}`;
    }[];
  };
  readonly verifierManifestCommitment: `sha256:${string}`;
  readonly semanticGeometryCommitment: `sha256:${string}`;
  readonly independentCatalogOrientationTruth: {
    readonly schemaVersion: "lego.step42-independent-catalog-orientation-truth/1";
    readonly transformPolicyVersion: "part-scoped-proper-orientations-negative-y-up/2";
    readonly rosterDigest: `sha256:${string}`;
    readonly algebraControlCommitment: `sha256:${string}`;
    readonly compositionLaw: "catalog-world=source-world*transpose(source-to-catalog);position=source-position-catalog-world*frame-translation";
  };
  readonly admittedBinding: RealBuildPrefix50Step42SourceGeometryBinding;
  readonly admittedBindingCommitment: `sha256:${string}`;
  readonly rows: readonly [
    RealBuildPrefix50Step42SourceGeometryRow,
    RealBuildPrefix50Step42SourceGeometryRow,
    RealBuildPrefix50Step42SourceGeometryRow,
  ];
  readonly authorityLimits: {
    readonly placement: false;
    readonly documentLegality: false;
    readonly acceptance: false;
    readonly completion: false;
  };
  readonly receiptCommitment: `sha256:${string}`;
}

export function readRealBuildPrefix50Step42ActionBinding(
  unsafeReader: unknown,
): RealBuildPrefix50Step42ActionBinding {
  return readOpaqueRealBuildPrefix50Step42ActionBinding(
    unsafeReader,
  ) as RealBuildPrefix50Step42ActionBinding;
}

export function readRealBuildPrefix50Step42SourceGeometryReceipt(
  unsafeReader: unknown,
): RealBuildPrefix50Step42SourceGeometryReceipt {
  return readOpaqueRealBuildPrefix50Step42SourceGeometryReceipt(
    unsafeReader,
  ) as RealBuildPrefix50Step42SourceGeometryReceipt;
}
