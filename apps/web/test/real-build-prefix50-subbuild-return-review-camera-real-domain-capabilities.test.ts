import { link, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { canonicalDigest } from "@lego-studio/brick-kernel";
import { describe, expect, it } from "vitest";

import {
  recordRealBuildPrefix50Step44RealDomainObservation,
  replayRealBuildPrefix50Step44RealDomainObservationCommitment,
  type RealBuildPrefix50Step44RealDomainObservation,
} from "../e2e/real-build-prefix50-subbuild-return-review-camera-real-domain-calibration-contract.ts";
import {
  requireRealBuildPrefix50Step44BrowserCaptureCapability,
  requireRealBuildPrefix50Step44RealDomainCapturedCase,
  type RealBuildPrefix50Step44BrowserCaptureCapability,
  type RealBuildPrefix50Step44RealDomainCapturedCase,
} from "../e2e/real-build-prefix50-subbuild-return-review-camera-real-domain-capture.ts";
import {
  consumeRealBuildPrefix50Step44CalibrationSessionForHeldOut,
  requireRealBuildPrefix50Step44RealDomainCalibrationSession,
  requireRealBuildPrefix50Step44RealDomainHeldOutPair,
  type RealBuildPrefix50Step44RealDomainCalibrationSession,
  type RealBuildPrefix50Step44RealDomainHeldOutPair,
} from "../e2e/real-build-prefix50-subbuild-return-review-camera-real-domain-session.ts";
import {
  requireRealBuildPrefix50Step44RealDomainQualificationBinding,
  type RealBuildPrefix50Step44RealDomainQualificationBinding,
} from "../e2e/real-build-prefix50-subbuild-return-review-camera-real-domain-gate-evidence.ts";
import { assertRealBuildPrefix50Step44RealDomainGateOutputTree } from "../e2e/real-build-prefix50-subbuild-return-review-camera-real-domain-gate-evidence.ts";
import { REAL_BUILD_PREFIX50_STEP44_REVIEW_OUTPUT_ROOT } from "../e2e/real-build-prefix50-subbuild-return-review-harness-input.ts";

const fakeCaptureCapability = Object.freeze({
  panelStep: 41,
  sourceCaseCommitment: `sha256:${"1".repeat(64)}`,
  predecessorCaseCommitment: `sha256:${"2".repeat(64)}`,
  attemptCommitment: `sha256:${"3".repeat(64)}`,
  runtimeCaptureCount: 33,
  commitment: `sha256:${"4".repeat(64)}`,
}) as RealBuildPrefix50Step44BrowserCaptureCapability;

const fakeSession = Object.freeze({
  schemaVersion: "lego.real-build-prefix50-real-domain-calibration-session/1",
  status: "qualified-for-heldout",
  sourceLockCommitment: `sha256:${"1".repeat(64)}`,
  pageRasterCommitment: `sha256:${"2".repeat(64)}`,
  sharedOrientationAnchorCommitment: `sha256:${"3".repeat(64)}`,
  reviewBatchEnvelopeCommitment: `sha256:${"4".repeat(64)}`,
  orderedCalibrationObservationCommitment: `sha256:${"5".repeat(64)}`,
  calibrationReceiptCommitment: `sha256:${"6".repeat(64)}`,
  commitment: `sha256:${"7".repeat(64)}`,
}) as RealBuildPrefix50Step44RealDomainCalibrationSession;

describe("prefix-50 Step-44 real-domain opaque capabilities", () => {
  it("replays an observation self commitment from the exact body only", () => {
    const digest = (character: string): `sha256:${string}` =>
      `sha256:${character.repeat(64).slice(0, 64)}`;
    const body = Object.freeze({
      panelStep: 41 as const,
      predecessorCaseCommitment: digest("1"),
      sourceCaseCommitment: digest("2"),
      sourceLockCommitment: digest("3"),
      pageRasterCommitment: digest("4"),
      semanticPolicyCommitment: digest("5"),
      liveSearchAttemptCommitment: digest("6"),
      renderArtifactRosterCommitment: digest("7"),
      registrationReceiptsCommitment: digest("8"),
      sourceSharedOrientationAnchorCommitment: digest("9"),
      sourcePerPanelLatticeCounterevidenceCommitment: digest("a"),
      sourcePooledLatticeCounterevidenceFailure: null,
      sourceLatticeFitCommitment: digest("b"),
      sourceLatticeFitQualified: true,
      sourceLatticeFitFailure: null,
      expectedBranchKey: "face:studs-up/hand:as-fitted/turn:0" as const,
      selectedBranchKey: "face:studs-up/hand:as-fitted/turn:0",
      parentOnlyIntersectionOverUnion: 0.75,
      expectedBranchGeometryMargin: 0.125,
      maximumObservedPredictionActualIntersectionOverUnionDrift: 0.01,
      blueCyanF1: 0.8,
      expectedBranchBlueCyanF1Margin: 0.2,
    });
    const observation = Object.freeze({
      ...body,
      observationCommitment: canonicalDigest(body),
    }) satisfies RealBuildPrefix50Step44RealDomainObservation;

    expect(replayRealBuildPrefix50Step44RealDomainObservationCommitment(observation)).toBe(
      observation.observationCommitment,
    );
    expect(
      replayRealBuildPrefix50Step44RealDomainObservationCommitment({
        ...observation,
        observationCommitment: digest("f"),
      }),
    ).toBe(observation.observationCommitment);
    expect(
      replayRealBuildPrefix50Step44RealDomainObservationCommitment({
        ...observation,
        panelStep: 42,
      }),
    ).not.toBe(observation.observationCommitment);
  });

  it("rejects Node-created browser capture capabilities and structural captures", () => {
    expect(() =>
      requireRealBuildPrefix50Step44BrowserCaptureCapability(fakeCaptureCapability),
    ).toThrow("minted after actual in-app snapshots and render captures");
    expect(() =>
      recordRealBuildPrefix50Step44RealDomainObservation({
        browserCaptureCapability: fakeCaptureCapability,
        predecessorCase: {} as never,
        sourceCase: {} as never,
        semanticPolicyCommitment: `sha256:${"8".repeat(64)}`,
        evidence: {} as never,
      }),
    ).toThrow("minted after actual in-app snapshots and render captures");
    expect(() =>
      requireRealBuildPrefix50Step44RealDomainCapturedCase(
        {} as RealBuildPrefix50Step44RealDomainCapturedCase,
      ),
    ).toThrow("must originate from captureRealBuildPrefix50Step44RealDomainCaseInApp");
  });

  it("rejects a structural session before Step 43 and cannot replay it", async () => {
    expect(() => requireRealBuildPrefix50Step44RealDomainCalibrationSession(fakeSession)).toThrow(
      "exact opaque calibration-session capability",
    );
    await expect(
      consumeRealBuildPrefix50Step44CalibrationSessionForHeldOut(fakeSession),
    ).rejects.toThrow("exact opaque calibration-session capability");
  });

  it("rejects mixed or structural heldout pairs", () => {
    const pair = {
      schemaVersion: "lego.real-build-prefix50-real-domain-heldout-pair/1",
      calibrationSessionCommitment: fakeSession.commitment,
      sourceCase: {},
      predecessorCase: {},
      commitment: `sha256:${"8".repeat(64)}`,
    } as unknown as RealBuildPrefix50Step44RealDomainHeldOutPair;
    expect(() => requireRealBuildPrefix50Step44RealDomainHeldOutPair(pair, fakeSession)).toThrow(
      "same consumed session",
    );
  });

  it("rejects a self-shaped but unbranded production qualification binding", () => {
    const binding = {
      schemaVersion: "lego.real-build-prefix50-step44-real-domain-qualification-binding/1",
      qualificationOutputRealPathCommitment: `sha256:${"1".repeat(64)}`,
      reviewBatchEnvelopeCommitment: `sha256:${"2".repeat(64)}`,
      sourceLockCommitment: `sha256:${"3".repeat(64)}`,
      calibrationSessionCommitment: `sha256:${"4".repeat(64)}`,
      calibrationReceiptCommitment: `sha256:${"5".repeat(64)}`,
      heldOutReceiptCommitment: `sha256:${"6".repeat(64)}`,
      persistedManifestCommitment: `sha256:${"7".repeat(64)}`,
      qualificationProofCommitment: `sha256:${"8".repeat(64)}`,
      commitment: `sha256:${"9".repeat(64)}`,
    } as RealBuildPrefix50Step44RealDomainQualificationBinding;
    expect(() => requireRealBuildPrefix50Step44RealDomainQualificationBinding(binding)).toThrow(
      "runtime-branded persisted Steps-41/42-qualified",
    );
  });

  it("rejects linked and injected entries in the persisted calibration authority tree", async () => {
    await mkdir(REAL_BUILD_PREFIX50_STEP44_REVIEW_OUTPUT_ROOT, { recursive: true });
    const output = await mkdtemp(
      resolve(REAL_BUILD_PREFIX50_STEP44_REVIEW_OUTPUT_ROOT, "unit-calibration-tree-"),
    );
    const outside = await mkdtemp(
      resolve(REAL_BUILD_PREFIX50_STEP44_REVIEW_OUTPUT_ROOT, "unit-calibration-link-"),
    );
    try {
      const linkedSource = resolve(outside, "vite.log");
      await writeFile(linkedSource, "shared\n", "utf8");
      await link(linkedSource, resolve(output, "real-domain-camera-static-app.log"));
      await writeFile(resolve(output, "real-domain-camera-gate.json"), "{}\n", "utf8");
      await mkdir(resolve(output, "step-41"));
      await mkdir(resolve(output, "step-42"));
      await expect(
        assertRealBuildPrefix50Step44RealDomainGateOutputTree({
          outputPath: output,
          persistedCaseCount: 2,
        }),
      ).rejects.toThrow(
        "Real-domain camera gate file real-domain-camera-static-app.log must be singly linked and regular.",
      );

      await rm(resolve(output, "real-domain-camera-static-app.log"));
      await writeFile(resolve(output, "real-domain-camera-static-app.log"), "owned\n", "utf8");
      await mkdir(resolve(output, "nested-injection"));
      await expect(
        assertRealBuildPrefix50Step44RealDomainGateOutputTree({
          outputPath: output,
          persistedCaseCount: 2,
        }),
      ).rejects.toThrow("exact ordered 2-case evidence tree");
    } finally {
      await rm(output, { recursive: true, force: true });
      await rm(outside, { recursive: true, force: true });
    }
  });
});
