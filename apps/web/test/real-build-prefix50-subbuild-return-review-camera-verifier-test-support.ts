import { canonicalDigest } from "@lego-studio/brick-kernel";

import type { RealBuildPrefix50Step44CameraSearchAttempt } from "../e2e/real-build-prefix50-subbuild-return-review-camera-search-types.ts";

export type Mutable<T> = {
  -readonly [Key in keyof T]: T[Key] extends readonly (infer Item)[]
    ? Mutable<Item>[]
    : T[Key] extends object
      ? Mutable<T[Key]>
      : T[Key];
};

function withoutCommitment(value: object): Record<string, unknown> {
  const body = { ...value } as Record<string, unknown>;
  Reflect.deleteProperty(body, "commitment");
  return body;
}

export function recommitCameraAttempt(
  attempt: Mutable<RealBuildPrefix50Step44CameraSearchAttempt>,
): void {
  for (const branch of attempt.branchMeasurements) {
    for (const pass of branch.alignmentPasses) {
      if (pass.registrationProposal) {
        const proposal = pass.registrationProposal as unknown as Mutable<
          NonNullable<
            RealBuildPrefix50Step44CameraSearchAttempt["branchMeasurements"][number]["alignmentPasses"][number]["registrationProposal"]
          >
        >;
        proposal.commitment = canonicalDigest(withoutCommitment(proposal));
      }
      pass.commitment = canonicalDigest(withoutCommitment(pass));
    }
    branch.alignmentPassesCommitment = canonicalDigest(branch.alignmentPasses);
    branch.interiorFeatureMeasurement.commitment = canonicalDigest(
      withoutCommitment(branch.interiorFeatureMeasurement),
    );
    const geometry = withoutCommitment(branch);
    Reflect.deleteProperty(geometry, "geometryCommitment");
    Reflect.deleteProperty(geometry, "interiorFeatureMeasurement");
    branch.geometryCommitment = canonicalDigest(geometry);
    branch.commitment = canonicalDigest(withoutCommitment(branch));
  }
  attempt.geometrySelection.eligibleGeometryCommitments = attempt.branchMeasurements
    .filter((branch) => branch.geometryEligible)
    .map((branch) => branch.geometryCommitment);
  attempt.geometrySelection.counterevidenceGeometryCommitments = attempt.branchMeasurements
    .filter((branch) => !branch.geometryEligible)
    .map((branch) => branch.geometryCommitment);
  attempt.geometrySelection.commitment = canonicalDigest(
    withoutCommitment(attempt.geometrySelection),
  );
  attempt.geometrySelectionCommitment = attempt.geometrySelection.commitment;
  attempt.featureCorroboration.geometrySelectionCommitment = attempt.geometrySelection.commitment;
  attempt.featureCorroboration.branchMeasurementCommitments = attempt.branchMeasurements.map(
    (branch) => branch.interiorFeatureMeasurement.commitment,
  );
  attempt.featureCorroboration.commitment = canonicalDigest(
    withoutCommitment(attempt.featureCorroboration),
  );
  attempt.featureCorroborationCommitment = attempt.featureCorroboration.commitment;
  attempt.branchMeasurementsCommitment = canonicalDigest(attempt.branchMeasurements);
  attempt.commitment = canonicalDigest(withoutCommitment(attempt));
}
