import { describe, expect, it } from "vitest";

import measuredFarther from "./fixtures/real-build-farther/measured-step-5-6-7.json";
import { MEASURED_FARTHER_ORIGIN_SOURCE_ATTESTATION } from "../e2e/real-build-farther-origin-source-manifest";
import {
  MEASURED_FARTHER_ORIGIN_CANDIDATES,
  MEASURED_FARTHER_ORIGIN_PANEL_SPECS,
  measuredFartherOriginProbeIneligibility,
} from "../e2e/real-build-farther-origin-policy";

const exactInput = () => ({
  originSpec: structuredClone(MEASURED_FARTHER_ORIGIN_PANEL_SPECS[0]!),
  interveningSpec: structuredClone(MEASURED_FARTHER_ORIGIN_PANEL_SPECS[1]!),
  fartherSpec: structuredClone(MEASURED_FARTHER_ORIGIN_PANEL_SPECS[2]!),
  origins: structuredClone(MEASURED_FARTHER_ORIGIN_CANDIDATES),
  options: {
    inputDigests: {
      pdf: "sha256:baef0a373164b58d7c982984b52d4e50b10cc59ed28007acb456faa72359bd27",
      calloutManifest: "sha256:e64a38507306d60d68d40cbd7f9e19158581faf1dc75fb77077d76850a33a0c3",
      coverage: "sha256:0ed8fb0225057ba6d36ae00f45d37921a0b590ff6de42fa96774545d62a4c3c6",
      officialModel: "sha256:c0564fd86ede633f6cb18738f999fbb70ee948ba93a55cc8d338b4b5f02b5922",
      actionLedger: "sha256:e88688b23310b9ae16039c57f0ffbf2c5cbf36385e81af6e4824ac9faf64a377",
      highlightCalibration:
        "sha256:f18939b8b9b98123868c437561113f81c44142b4004aa206dfaf7d4b954ffadf",
      builderCalibration: "sha256:da326b44897eec7d0a3a7049c0d06cb8ae8c0fbcbcda2e3f7423d7017abd241b",
      builderGeometry: "sha256:da8260f77540db459bd745d75ebb072d1b08d357d1628569a06c58d6aed77c55",
      transitionClassifications:
        "sha256:80efaa9573d3611e820f9a5108fe89f48e22139164fa7f56c297aa13350670ab",
    },
    minimumDeferredAgreement: 0.85,
    minimumDeferredAgreementMargin: 0.02,
    renderScale: 6,
    panelWidth: 1_000,
    workFactor: 2,
    deferredNarrowingRenderBudget: 8_192,
    fartherPanelMaximumReachSteps: 2,
    fartherPanelRenderBudget: 16,
    measuredFartherOriginSourceAttestation: MEASURED_FARTHER_ORIGIN_SOURCE_ATTESTATION,
  },
});

describe("measured farther-origin policy", () => {
  it("binds the direct K winner to the same family as the full intervening frontier", () => {
    const directWinner = Object.entries(measuredFarther.directOriginPanel7Observation.scores).sort(
      ([, left], [, right]) => right - left,
    )[0]![0];
    const frontierWinner = Object.entries(measuredFarther.frontierScores).sort(
      ([, left], [, right]) => right - left,
    )[0]![0];
    expect(directWinner).toBe(measuredFarther.selectedOriginCandidateId);
    expect(frontierWinner).toMatch(/^step6-1-/u);
    expect(measuredFarther.unresolvedDescendantIds).toContain(frontierWinner);
  });

  it("admits only the exact measured ordered origins, panel specs, and cost policy", () => {
    const input = exactInput();
    expect(measuredFartherOriginProbeIneligibility(input)).toBeNull();

    expect(
      measuredFartherOriginProbeIneligibility({
        ...input,
        origins: [...input.origins].reverse(),
      }),
    ).not.toBeNull();
    expect(
      measuredFartherOriginProbeIneligibility({
        ...input,
        origins: [
          { ...input.origins[0]!, lookaheadAgreement: input.origins[0]!.lookaheadAgreement + 0.01 },
          input.origins[1]!,
        ],
      }),
    ).not.toBeNull();
    expect(
      measuredFartherOriginProbeIneligibility({
        ...input,
        origins: [
          {
            ...input.origins[0]!,
            pieces: [
              {
                ...input.origins[0]!.pieces[0]!,
                transform: {
                  ...input.origins[0]!.pieces[0]!.transform,
                  positionLdu: [0, 0, 0] as const,
                },
              },
              input.origins[0]!.pieces[1]!,
            ],
          },
          input.origins[1]!,
        ],
      }),
    ).not.toBeNull();
    expect(
      measuredFartherOriginProbeIneligibility({
        ...input,
        fartherSpec: { ...input.fartherSpec, minXPt: input.fartherSpec.minXPt + 1 },
      }),
    ).not.toBeNull();
    expect(
      measuredFartherOriginProbeIneligibility({
        ...input,
        originSpec: {
          ...input.originSpec,
          pieces: [
            { ...input.originSpec.pieces[0]!, identityKey: "relabelled" },
            ...input.originSpec.pieces.slice(1),
          ],
        },
      }),
    ).not.toBeNull();
    expect(
      measuredFartherOriginProbeIneligibility({
        ...input,
        options: { ...input.options, fartherPanelRenderBudget: 17 },
      }),
    ).not.toBeNull();
    expect(
      measuredFartherOriginProbeIneligibility({
        ...input,
        options: { ...input.options, measuredFartherOriginSourceAttestation: null },
      }),
    ).not.toBeNull();
  });
});
