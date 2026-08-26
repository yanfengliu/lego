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
  it("binds explicitly synthetic component-group evidence", () => {
    const manifest = JSON.parse(
      syntheticIdentificationGoldenBytes("manifest").toString("utf8"),
    ) as {
      readonly callouts: readonly {
        readonly sourceComponent: {
          readonly rawComponentCount: number;
          readonly absoluteForegroundSha256: string;
        } | null;
      }[];
    };
    expect(manifest.callouts[0]?.sourceComponent).toMatchObject({
      rawComponentCount: 1,
      absoluteForegroundSha256: sha256Digest("synthetic-source-component-group"),
    });
  });

  it("retains a mathematically complete synthetic recovery benchmark", () => {
    const manifest = JSON.parse(
      syntheticIdentificationGoldenBytes("manifest").toString("utf8"),
    ) as {
      readonly recoveryBenchmark: {
        readonly fixedFailureClassSize: number;
        readonly observedLegacyFailureIdentities: readonly string[];
        readonly scores: readonly {
          readonly strategy: "legacy-seed" | "evidence-aware";
          readonly valid: number;
          readonly recovered: number;
          readonly kindCorrect: number;
          readonly regionCorrect: number;
          readonly masksCorrect: number;
          readonly uncontaminated: number;
          readonly invalidIdentities: readonly string[];
          readonly points: number;
        }[];
        readonly selected: "evidence-aware";
        readonly winner: "legacy-seed" | "evidence-aware";
        readonly winningMargin: number;
      };
    };
    const benchmark = manifest.recoveryBenchmark;
    expect(benchmark.observedLegacyFailureIdentities).toHaveLength(benchmark.fixedFailureClassSize);
    expect(benchmark.scores.map(({ strategy }) => strategy)).toEqual([
      "evidence-aware",
      "legacy-seed",
    ]);
    for (const score of benchmark.scores) {
      expect(score.points).toBe(
        score.valid * 1_000_000 +
          score.kindCorrect * 10_000 +
          score.regionCorrect * 1_000 +
          score.masksCorrect * 100 +
          score.uncontaminated * 10 +
          score.recovered,
      );
      expect(score.valid + score.invalidIdentities.length).toBe(benchmark.fixedFailureClassSize);
    }
    const selected = benchmark.scores.find(({ strategy }) => strategy === benchmark.selected)!;
    const runnerUp = benchmark.scores.find(({ strategy }) => strategy !== benchmark.selected)!;
    expect(selected.valid).toBe(benchmark.fixedFailureClassSize);
    expect(benchmark.winner).toBe(benchmark.selected);
    expect(benchmark.winningMargin).toBe(selected.points - runnerUp.points);
  });

  it("reproduces independently pinned deterministic golden bytes and digests", async () => {
    const input: RealBuildIdentificationClosureInput = {
      coverage: goldenArtifact("coverage"),
      pdf: null,
      manifest: goldenArtifact("manifest"),
      sourceArtRebound: null,
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
    await expect(
      coverageTestOnly.verifyBookletCatalogCoverageClosure(
        prepareRealBuildIdentificationClosure(input),
        SYNTHETIC_IDENTIFICATION_MANIFEST_EXPECTATION,
      ),
    ).resolves.toBeDefined();
  });

  it("does not require or bind adjudication roles for deterministic coverage", () => {
    const input: RealBuildIdentificationClosureInput = {
      coverage: goldenArtifact("coverage"),
      pdf: null,
      manifest: goldenArtifact("manifest"),
      sourceArtRebound: null,
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
      pdfBytes: null,
      sourceArtReboundArtifact: null,
    });
  });
});
