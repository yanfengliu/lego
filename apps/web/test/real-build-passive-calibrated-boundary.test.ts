import { describe, expect, it } from "vitest";

import {
  MEASURED_FARTHER_ORIGIN_CANDIDATES,
  MEASURED_FARTHER_ORIGIN_PANEL_SPECS,
  measuredFartherOriginProbeIneligibility,
} from "../e2e/real-build-farther-origin-policy";
import { MEASURED_FARTHER_ORIGIN_SOURCE_ATTESTATION } from "../e2e/real-build-farther-origin-source-manifest";
import { scoreFartherDocumentsAgainstPanel } from "../e2e/real-build-farther-step";
import type { PanelRasterEvidence } from "../e2e/real-build-panel-raster";
import { selectRealBuildDeferredPanelRoles } from "../e2e/real-build-run-panel-window";
import type { RealBuildPanelRasterSpec } from "../e2e/real-build-safety";
import { completeRealBuildTestOptions } from "./real-build-test-options";

const measuredInputDigests = {
  pdf: "sha256:baef0a373164b58d7c982984b52d4e50b10cc59ed28007acb456faa72359bd27",
  calloutManifest: "sha256:e64a38507306d60d68d40cbd7f9e19158581faf1dc75fb77077d76850a33a0c3",
  coverage: "sha256:0ed8fb0225057ba6d36ae00f45d37921a0b590ff6de42fa96774545d62a4c3c6",
  officialModel: "sha256:c0564fd86ede633f6cb18738f999fbb70ee948ba93a55cc8d338b4b5f02b5922",
  actionLedger: "sha256:e88688b23310b9ae16039c57f0ffbf2c5cbf36385e81af6e4824ac9faf64a377",
  highlightCalibration: "sha256:f18939b8b9b98123868c437561113f81c44142b4004aa206dfaf7d4b954ffadf",
  builderCalibration: "sha256:da326b44897eec7d0a3a7049c0d06cb8ae8c0fbcbcda2e3f7423d7017abd241b",
  builderGeometry: "sha256:da8260f77540db459bd745d75ebb072d1b08d357d1628569a06c58d6aed77c55",
  transitionClassifications:
    "sha256:80efaa9573d3611e820f9a5108fe89f48e22139164fa7f56c297aa13350670ab",
};

const rasterEvidence = (): PanelRasterEvidence => {
  const empty = new Uint8Array(1);
  return {
    width: 1,
    height: 1,
    workPixels: new Uint8ClampedArray(4),
    fitSolution: null,
    fitFailure: "passive test has no camera",
    fitCoherence: 0,
    faceCorrectedFit: null,
    highlight: {
      regions: [],
      closedContourRate: 0,
      keyedPx: 0,
      mask: empty,
      strokeMask: empty,
      contourStrokeMask: empty,
    },
    highlightBox: null,
    builtMask: empty,
    arrows: { arrows: [], rejected: [], redPx: 0 },
    arrowFamily: [],
  };
};

describe("real-build request-6 passive calibrated boundary", () => {
  it("sends passive step 7 only to raster scoring, never measured action-spec comparison", () => {
    const origin = structuredClone(MEASURED_FARTHER_ORIGIN_PANEL_SPECS[0]!);
    const intervening = structuredClone(MEASURED_FARTHER_ORIGIN_PANEL_SPECS[1]!);
    const measuredFarther = MEASURED_FARTHER_ORIGIN_PANEL_SPECS[2]!;
    let authorityReads = 0;
    const passive = Object.fromEntries(
      [
        "stepNumber",
        "pageNumber",
        "panelFace",
        "minXPt",
        "maxXPt",
        "minYPt",
        "maxYPt",
        "calloutBoxes",
      ].map((key) => [key, measuredFarther[key as keyof typeof measuredFarther]]),
    ) as unknown as RealBuildPanelRasterSpec;
    for (const field of ["action", "pieces", "mappedCalloutKeys"]) {
      Object.defineProperty(passive, field, {
        enumerable: true,
        get() {
          authorityReads += 1;
          throw new Error(`passive ${field} must not be canonicalized`);
        },
      });
    }
    const roles = selectRealBuildDeferredPanelRoles({
      interveningRasterPanel: intervening,
      executionPanels: [origin, intervening],
      observationPanels: [origin, intervening, passive],
    });
    const options = {
      ...completeRealBuildTestOptions(6),
      inputDigests: measuredInputDigests,
      measuredFartherOriginSourceAttestation: MEASURED_FARTHER_ORIGIN_SOURCE_ATTESTATION,
      minimumDeferredAgreement: 0.85,
      minimumDeferredAgreementMargin: 0.02,
      deferredNarrowingRenderBudget: 8_192,
    };

    expect(roles.interveningExecutionPanel?.stepNumber).toBe(6);
    expect(roles.fartherRasterPanel?.stepNumber).toBe(7);
    expect(roles.fartherExecutionPanel).toBeNull();
    expect(
      measuredFartherOriginProbeIneligibility({
        originSpec: origin,
        interveningSpec: intervening,
        fartherSpec: roles.fartherExecutionPanel,
        origins: structuredClone(MEASURED_FARTHER_ORIGIN_CANDIDATES),
        options,
      }),
    ).toBe("no farther panel is available");

    const score = scoreFartherDocumentsAgainstPanel({
      spec: roles.fartherRasterPanel!,
      evidence: rasterEvidence(),
      anchorDocument: {},
      candidates: [{ candidateId: "passive-candidate", document: {} }],
      reservedPanelRenders: 1,
      options,
      rendering: new Proxy(
        {},
        {
          get() {
            throw new Error("camera-unresolved passive raster must not invoke rendering");
          },
        },
      ) as never,
    });
    expect(score.observation).toEqual({
      stepNumber: 7,
      status: "not-observable",
      reason: "camera-unresolved",
    });
    expect(authorityReads).toBe(0);
  });
});
