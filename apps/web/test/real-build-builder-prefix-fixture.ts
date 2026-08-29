import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

export const readRepositoryFile = (path: string): Buffer =>
  readFileSync(resolve(repositoryRoot, path));

export const sha256 = (bytes: Uint8Array): string =>
  `sha256:${createHash("sha256").update(bytes).digest("hex")}`;

export const PREFIX_INPUTS = {
  official: {
    path: "output/official-model/vx1087034_21066_a.xml",
    bytes: 1_903_169,
    digest: "sha256:c0564fd86ede633f6cb18738f999fbb70ee948ba93a55cc8d338b4b5f02b5922",
  },
  geometry: {
    path: "output/real-build/builder-shell-geometry.bin",
    bytes: 1_820_412,
    digest: "sha256:7e91e1402f2ab609fee6e502336f86ee74fb3a94d970e9b0b75acf07f925a76f",
  },
  calibration: {
    path: "output/real-build/builder-canonical-calibration.json",
    bytes: 54_993,
    digest: "sha256:69555bf4a0b7a7beaeb4f98b6d0e5750fa28b6946a957cdc5772633602636a70",
  },
  coverage: {
    path: "output/real-build/catalog-coverage.json",
    bytes: 588_467,
    digest: "sha256:861d08a28dac94619e8c541e928d7803b4b6cab9fe9fa12da9f166fc0e46444d",
  },
  actionPreparation: {
    path: "output/real-build/action-preparation.json",
    bytes: 317_152,
    digest: "sha256:5fbab00b90c6ffbe6c9b09727819e0b3a964cebbd88138232bd2418df6100fb6",
  },
} as const;

interface ActionMember {
  readonly sourceBuilderIdentityOrdinal: number;
  readonly builderBrickRef: string;
  readonly designRevision: string;
  readonly calloutIdentity: string;
}

interface ActionCallout {
  readonly identity: string;
  readonly catalogPartId: string;
  readonly preparedBuilderBrickRefs: readonly string[];
}

interface ActionPhase {
  readonly sequence: number;
  readonly members: readonly ActionMember[];
}

interface ActionStep {
  readonly stepNumber: number;
  readonly callouts: readonly ActionCallout[];
  readonly phases: readonly ActionPhase[];
}

export interface ActionArtifact {
  readonly schemaVersion: string;
  readonly authority: Readonly<Record<string, boolean | string>>;
  readonly steps: readonly ActionStep[];
}

export interface CoverageArtifact {
  readonly schemaVersion: string;
  readonly byCallout: Readonly<
    Record<
      string,
      {
        readonly resolution: {
          readonly catalogPartId: string;
          readonly partNum: string;
        };
        readonly semanticEvidence: {
          readonly officialDesignId: string;
          readonly publishedPartNum: string;
          readonly publishedMatchesOfficialDesignId: boolean;
        } | null;
      }
    >
  >;
}

export const parseJson = <T>(bytes: Uint8Array): T => JSON.parse(bytes.toString()) as T;

export function actionRows(artifact: ActionArtifact) {
  return artifact.steps.flatMap((step) =>
    step.phases.flatMap((phase) =>
      phase.members.map((member) => ({ ...member, stepNumber: step.stepNumber })),
    ),
  );
}
