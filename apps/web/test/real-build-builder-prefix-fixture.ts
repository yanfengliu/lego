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
    bytes: 1_834_092,
    digest: "sha256:c047a4b78518ae658a34efd3f3121de11558d00821b1764a472b87cf0ee82b97",
  },
  calibration: {
    path: "output/real-build/builder-canonical-calibration.json",
    bytes: 56_235,
    digest: "sha256:7cc76c17cef27a74a9840d78769f4f839f85ee706ba123cdafbd12248698565c",
  },
  coverage: {
    path: "output/real-build/catalog-coverage.json",
    bytes: 588_467,
    digest: "sha256:9aabfaa4b1481b029c56873d4023925b3f5eed73aa4bef85255e2bbd56e8af5c",
  },
  actionPreparation: {
    path: "output/real-build/action-preparation.json",
    bytes: 317_152,
    digest: "sha256:b3b4c340570f9348c16e3a1fab5e9e0c2a2eda30559891ab041508b0ae1bae4e",
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
