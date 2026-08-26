import { describe, expect, it } from "vitest";

import { sha256Digest } from "../e2e/real-build-artifacts";
import {
  pieceEvidenceDigest,
  validateRealBuildActionLedger,
  type CoverageLedgerClaim,
  type LedgerPieceIdentity,
  type LedgerStep,
  type OfficialModelIndex,
  type RealBuildActionLedger,
} from "../e2e/real-build-ledger";
import {
  realBuildLedgerPrefix,
  realBuildLedgerTestFixture,
} from "./real-build-ledger-test-fixture";

describe("real build ledger exact element binding", () => {
  it("rejects swapped same-design Brick refs after every attacker-controlled digest is recomputed", () => {
    const fixture = realBuildLedgerTestFixture();
    const firstStep = fixture.ledger.steps[0]!;
    const secondStep = fixture.ledger.steps[1]!;
    if (firstStep.action.kind !== "place-callouts") throw new Error("fixture action changed");
    const template = firstStep.action.pieces[0]!;
    const officialItemNos = { "brick-a": ["300501"], "brick-b": ["300502"] } as const;
    const officialModelDigest = sha256Digest(JSON.stringify(officialItemNos));
    const official: OfficialModelIndex = {
      ...fixture.official,
      digest: officialModelDigest,
      bricks: {
        ...fixture.official.bricks,
        "brick-a": { ...fixture.official.bricks["brick-a"]!, itemNos: officialItemNos["brick-a"] },
        "brick-b": { ...fixture.official.bricks["brick-b"]!, itemNos: officialItemNos["brick-b"] },
      },
      directBrickRefs: new Set(["brick-a", "brick-b"]),
      multiBuildByActualRef: new Map(),
    };
    const cropA = sha256Digest("crop-element-300501");
    const cropB = sha256Digest("crop-element-300502");
    const resolution = fixture.coverageByCallout["p1-c0.png"]!.resolution!;
    const coverageByCallout: Readonly<Record<string, CoverageLedgerClaim>> = {
      "p1-c0.png": {
        pageNumber: 1,
        stepNumber: 1,
        quantity: 1,
        elementId: "300501",
        identificationConfidence: "vision-kept",
        cropDigest: cropA,
        inputDigest: fixture.manifestDigest,
        resolution,
      },
      "p2-c0.png": {
        pageNumber: 2,
        stepNumber: 2,
        quantity: 1,
        elementId: "300502",
        identificationConfidence: "vision-kept",
        cropDigest: cropB,
        inputDigest: fixture.manifestDigest,
        resolution,
      },
    };
    const coverageDigest = sha256Digest(JSON.stringify(coverageByCallout));
    const piece = (
      brickRef: string,
      calloutKey: string,
      cropDigest: string,
      step: LedgerStep,
    ): LedgerPieceIdentity => {
      const { evidenceDigest: _evidenceDigest, ...withoutOldEvidence } = template;
      void _evidenceDigest;
      const content = {
        ...withoutOldEvidence,
        brickRef,
        calloutKey,
        cropDigest,
      };
      return {
        ...content,
        evidenceDigest: pieceEvidenceDigest({
          pdfDigest: fixture.pdfDigest,
          panelEvidenceDigest: step.panelEvidenceDigest,
          officialModelDigest,
          coverageDigest,
          calloutManifestDigest: fixture.manifestDigest,
          sourceArtReboundDigest: fixture.sourceArtReboundDigest,
          builderCalibrationDigest: fixture.builderCalibrationDigest,
          stepNumber: step.stepNumber,
          pageNumber: step.pageNumber,
          piece: content,
        }),
      };
    };
    const steps = (firstBrickRef: string, secondBrickRef: string): readonly LedgerStep[] => {
      const firstPiece = piece(firstBrickRef, "p1-c0.png", cropA, firstStep);
      const secondPiece = piece(secondBrickRef, "p2-c0.png", cropB, secondStep);
      return [
        {
          ...firstStep,
          callouts: [
            {
              calloutKey: "p1-c0.png",
              physicalBrickRefs: [firstBrickRef],
              semanticMultiplierQuantity: 0,
            },
          ],
          action: { kind: "place-callouts", pieces: [firstPiece], omittedPieces: [] },
        },
        {
          ...secondStep,
          callouts: [
            {
              calloutKey: "p2-c0.png",
              physicalBrickRefs: [secondBrickRef],
              semanticMultiplierQuantity: 0,
            },
          ],
          action: { kind: "place-callouts", pieces: [secondPiece], omittedPieces: [] },
        },
        ...fixture.ledger.steps.slice(2),
      ];
    };
    const ledger = (ledgerSteps: readonly LedgerStep[]): RealBuildActionLedger =>
      realBuildLedgerPrefix(
        { ...fixture.ledger, officialModelDigest, coverageDigest },
        2,
        ledgerSteps.slice(0, 2),
      );
    const validate = (candidate: RealBuildActionLedger) =>
      validateRealBuildActionLedger({
        ledger: candidate,
        ledgerDigest: sha256Digest(JSON.stringify(candidate)),
        requestedLastStep: 2,
        lastStep: 2,
        official,
        pdfDigest: fixture.pdfDigest,
        coverageDigest,
        calloutManifestDigest: fixture.manifestDigest,
        sourceArtReboundDigest: fixture.sourceArtReboundDigest,
        builderCalibrationDigest: fixture.builderCalibrationDigest,
        transitionClassificationsDigest: fixture.transitionClassificationsDigest,
        coverageByCallout,
        panelEvidenceByStep: fixture.panelEvidenceByStep,
        transitionClassificationsByStep: fixture.transitionClassificationsByStep,
      });

    expect(validate(ledger(steps("brick-a", "brick-b")))).toEqual([]);
    const swappedFailures = validate(ledger(steps("brick-b", "brick-a")));
    expect(swappedFailures).toHaveLength(4);
    expect(swappedFailures.every(({ message }) => message.includes("official itemNo"))).toBe(true);
    expect(swappedFailures.map(({ message }) => message).join(" ")).not.toContain(
      "evidence digest does not bind",
    );
  });
});
