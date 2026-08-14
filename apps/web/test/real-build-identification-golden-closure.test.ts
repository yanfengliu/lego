import { describe, expect, it } from "vitest";

import { __testOnly as coverageTestOnly } from "../../../scripts/booklet-catalog-coverage.mjs";
import { sha256Digest } from "../e2e/real-build-artifacts";
import {
  prepareRealBuildIdentificationClosure,
  type RawJsonArtifact,
  type RealBuildIdentificationClosureInput,
} from "../e2e/real-build-identification-closure";
import {
  SYNTHETIC_IDENTIFICATION_GOLDEN,
  SYNTHETIC_IDENTIFICATION_MANIFEST_EXPECTATION,
  syntheticIdentificationGoldenBytes,
} from "./real-build-identification-golden";

function goldenArtifact(role: keyof typeof SYNTHETIC_IDENTIFICATION_GOLDEN): RawJsonArtifact {
  const bytes = syntheticIdentificationGoldenBytes(role);
  return {
    bytes,
    digest: SYNTHETIC_IDENTIFICATION_GOLDEN[role].digest,
    value: JSON.parse(bytes.toString("utf8")) as unknown,
  };
}

describe("real-build deterministic identification golden closure", () => {
  it("reproduces independently pinned deterministic golden bytes and digests", () => {
    const input: RealBuildIdentificationClosureInput = {
      coverage: goldenArtifact("coverage"),
      manifest: goldenArtifact("manifest"),
      features: goldenArtifact("features"),
      match: goldenArtifact("match"),
      distances: goldenArtifact("distances"),
      elementResolution: goldenArtifact("elementResolution"),
      pairJudged: goldenArtifact("pairJudged"),
      cards: null,
      cardImages: null,
      answers: null,
      requestedLastStep: 1,
    };
    for (const role of Object.keys(
      SYNTHETIC_IDENTIFICATION_GOLDEN,
    ) as (keyof typeof SYNTHETIC_IDENTIFICATION_GOLDEN)[]) {
      expect(sha256Digest(syntheticIdentificationGoldenBytes(role))).toBe(
        SYNTHETIC_IDENTIFICATION_GOLDEN[role].digest,
      );
    }
    expect(() =>
      coverageTestOnly.verifyBookletCatalogCoverageClosure(
        prepareRealBuildIdentificationClosure(input),
        SYNTHETIC_IDENTIFICATION_MANIFEST_EXPECTATION,
      ),
    ).not.toThrow();
  });

  it("does not require or bind adjudication roles for deterministic coverage", () => {
    const input: RealBuildIdentificationClosureInput = {
      coverage: goldenArtifact("coverage"),
      manifest: goldenArtifact("manifest"),
      features: goldenArtifact("features"),
      match: goldenArtifact("match"),
      distances: goldenArtifact("distances"),
      elementResolution: goldenArtifact("elementResolution"),
      pairJudged: goldenArtifact("pairJudged"),
      requestedLastStep: 1,
    };
    expect(prepareRealBuildIdentificationClosure(input)).toMatchObject({
      source: "deterministic",
      cardsArtifact: null,
      cardImagesArtifact: null,
      answersArtifact: null,
    });
  });
});
