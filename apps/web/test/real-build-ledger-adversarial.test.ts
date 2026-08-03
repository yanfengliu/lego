import { describe, expect, it } from "vitest";

import { sha256Digest } from "../e2e/real-build-artifacts";
import { executeFixedLedgerPlacements } from "../e2e/real-build-fixed-actions";
import {
  actionEvidenceDigest,
  applyBuilderCanonicalCalibration,
  isUnauthenticatedTransitionClassification,
  pieceEvidenceDigest,
  transitionClassificationEvidenceDigest,
  validateRealBuildActionLedger,
  type BuilderCanonicalCalibration,
  type LedgerCopyIdentity,
  type LedgerStep,
  type RealBuildActionLedger,
} from "../e2e/real-build-ledger";
import { realBuildLedgerTestFixture } from "./real-build-ledger-test-fixture";
import { REAL_BUILD_TEST_DIGEST } from "./real-build-test-options";

describe("real build adversarial ledger contracts", () => {
  it("rejects fabricated identities, source step/color, and omitted copy rows", () => {
    const fixture = realBuildLedgerTestFixture();
    const validate = (ledger: RealBuildActionLedger) =>
      validateRealBuildActionLedger({
        ledger,
        ledgerDigest: sha256Digest(JSON.stringify(ledger)),
        lastStep: 359,
        official: fixture.official,
        pdfDigest: fixture.pdfDigest,
        coverageDigest: fixture.coverageDigest,
        calloutManifestDigest: fixture.manifestDigest,
        builderCalibrationDigest: fixture.builderCalibrationDigest,
        transitionClassificationsDigest: fixture.transitionClassificationsDigest,
        coverageByCallout: fixture.coverageByCallout,
        panelEvidenceByStep: fixture.panelEvidenceByStep,
        transitionClassificationsByStep: fixture.transitionClassificationsByStep,
      });
    expect(validate({} as RealBuildActionLedger)).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "action-ledger-incomplete" })]),
    );
    expect(validate(fixture.ledger)).toEqual([]);
    const directStep = fixture.ledger.steps[0]!;
    const copyStep = fixture.ledger.steps[1]!;
    if (
      directStep.action.kind !== "place-callouts" ||
      copyStep.action.kind !== "multi-build-copy"
    ) {
      throw new Error("fixture action changed");
    }
    const copyAction = copyStep.action;
    const replaceCopy = (action: LedgerStep["action"]): RealBuildActionLedger => ({
      ...fixture.ledger,
      steps: [directStep, { ...copyStep, action }, ...fixture.ledger.steps.slice(2)],
    });
    const wrongSource = replaceCopy({ ...copyStep.action, sourceStepNumber: 99 });
    const wrongColor = replaceCopy({
      ...copyStep.action,
      copies: [{ ...copyStep.action.copies[0]!, colorId: "builtin:white" }],
    });
    const copyWithTransform = (
      transform: LedgerCopyIdentity["transform"],
    ): RealBuildActionLedger => {
      const { evidenceDigest: _evidenceDigest, ...copyWithoutEvidence } = {
        ...copyAction.copies[0]!,
        transform,
      };
      void _evidenceDigest;
      const copy = {
        ...copyWithoutEvidence,
        evidenceDigest: pieceEvidenceDigest({
          pdfDigest: fixture.pdfDigest,
          panelEvidenceDigest: copyStep.panelEvidenceDigest,
          officialModelDigest: fixture.official.digest,
          coverageDigest: fixture.coverageDigest,
          calloutManifestDigest: fixture.manifestDigest,
          builderCalibrationDigest: fixture.builderCalibrationDigest,
          stepNumber: copyStep.stepNumber,
          pageNumber: copyStep.pageNumber,
          piece: copyWithoutEvidence,
        }),
      };
      return replaceCopy({ ...copyAction, copies: [copy] });
    };
    const oneLduWrong = copyWithTransform({
      positionLdu: [21, 0, 0],
      orientationId: "upright-yaw-270",
    });
    const wrongOrientation = copyWithTransform({
      positionLdu: [20, 0, 0],
      orientationId: "upright-yaw-0",
    });
    const omittedCopy = replaceCopy({
      kind: "transition",
      transition: "rotation",
      classificationEvidenceDigest: REAL_BUILD_TEST_DIGEST,
    });
    const wrongDirect: RealBuildActionLedger = {
      ...fixture.ledger,
      steps: [
        {
          ...directStep,
          action: {
            ...directStep.action,
            pieces: [
              {
                ...directStep.action.pieces[0]!,
                designId: "forged-design",
                identificationConfidence: "official-model",
                identificationInputDigest: REAL_BUILD_TEST_DIGEST,
              },
            ],
          },
        },
        ...fixture.ledger.steps.slice(1),
      ],
    };
    const panelStep = fixture.ledger.steps[2]!;
    const wrongPanel: RealBuildActionLedger = {
      ...fixture.ledger,
      steps: [
        ...fixture.ledger.steps.slice(0, 2),
        { ...panelStep, panelEvidenceDigest: REAL_BUILD_TEST_DIGEST },
        ...fixture.ledger.steps.slice(3),
      ],
    };

    expect(
      validate(wrongSource)
        .map(({ message }) => message)
        .join(" "),
    ).toContain("action source step 99");
    expect(
      validate(wrongColor)
        .map(({ message }) => message)
        .join(" "),
    ).toMatch(/evidence digest|Callout binding/u);
    expect(
      validate(omittedCopy)
        .map(({ message }) => message)
        .join(" "),
    ).toMatch(/MultiBuild identities|ledger classification/u);
    expect(
      validate(wrongDirect)
        .map(({ message }) => message)
        .join(" "),
    ).toMatch(/official-model identity|evidence digest|coverage claim/u);
    expect(
      validate(wrongPanel)
        .map(({ message }) => message)
        .join(" "),
    ).toContain("exact PDF panel evidence");
    expect(
      validate(oneLduWrong)
        .map(({ message }) => message)
        .join(" "),
    ).toContain("does not equal calibrated official Bone truth");
    expect(
      validate(wrongOrientation)
        .map(({ message }) => message)
        .join(" "),
    ).toContain("does not equal calibrated official Bone truth");
  });

  it("validates an action-ledger prefix without trusting or requiring its unrequested tail", () => {
    const fixture = realBuildLedgerTestFixture();
    const validate = (ledger: RealBuildActionLedger, lastStep: number) =>
      validateRealBuildActionLedger({
        ledger,
        ledgerDigest: sha256Digest(JSON.stringify(ledger)),
        lastStep,
        official: fixture.official,
        pdfDigest: fixture.pdfDigest,
        coverageDigest: fixture.coverageDigest,
        calloutManifestDigest: fixture.manifestDigest,
        builderCalibrationDigest: fixture.builderCalibrationDigest,
        transitionClassificationsDigest: fixture.transitionClassificationsDigest,
        coverageByCallout: fixture.coverageByCallout,
        panelEvidenceByStep: fixture.panelEvidenceByStep,
        transitionClassificationsByStep: fixture.transitionClassificationsByStep,
      });
    const prefixLedger: RealBuildActionLedger = {
      ...fixture.ledger,
      steps: fixture.ledger.steps.slice(0, 2),
    };
    const invalidTailLedger: RealBuildActionLedger = {
      ...fixture.ledger,
      steps: [
        ...fixture.ledger.steps.slice(0, 2),
        { ...fixture.ledger.steps[2]!, panelEvidenceDigest: REAL_BUILD_TEST_DIGEST },
        ...fixture.ledger.steps.slice(3),
      ],
    };

    expect(validate(prefixLedger, 2)).toEqual([]);
    expect(validate(invalidTailLedger, 2)).toEqual([]);
    expect(validate(prefixLedger, 359)).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "action-ledger-incomplete" })]),
    );
    expect(validate(invalidTailLedger, 359)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "action-ledger-incomplete",
          stepNumber: 3,
        }),
      ]),
    );
  });

  it("includes transition classification in action evidence", () => {
    const fixture = realBuildLedgerTestFixture();
    const step = fixture.ledger.steps[2]!;
    const classification = fixture.transitionClassificationsByStep[3]!;
    if (step.action.kind !== "transition") throw new Error("fixture action changed");
    const digest = (candidate: LedgerStep) =>
      actionEvidenceDigest({
        ledgerDigest: fixture.ledgerDigest,
        officialModelDigest: fixture.official.digest,
        builderCalibrationDigest: fixture.builderCalibrationDigest,
        transitionClassificationsDigest: fixture.transitionClassificationsDigest,
        step: candidate,
      });

    expect(digest(step)).not.toBe(
      digest({ ...step, action: { ...step.action, transition: "attachment" } }),
    );
    const { evidenceDigest: _evidenceDigest, ...classificationWithoutDigest } = classification;
    void _evidenceDigest;
    expect(transitionClassificationEvidenceDigest(classificationWithoutDigest)).toBe(
      classification.evidenceDigest,
    );
    expect(
      transitionClassificationEvidenceDigest({
        ...classificationWithoutDigest,
        localClassification: {
          ...classification.localClassification,
          decision: "attachment",
          notes:
            "Tampered local claim now asserts attachment instead of the retained rotation decision.",
        },
      }),
    ).not.toBe(classification.evidenceDigest);
    expect(isUnauthenticatedTransitionClassification(classification.localClassification)).toBe(
      true,
    );
    expect(
      isUnauthenticatedTransitionClassification({
        ...classification.localClassification,
        authenticated: true,
      }),
    ).toBe(false);
    expect(
      isUnauthenticatedTransitionClassification({
        ...classification.localClassification,
        reasonCodes: ["attachment-cue", "no-new-piece-callout"],
      }),
    ).toBe(false);
    expect(
      isUnauthenticatedTransitionClassification({
        ...classification.localClassification,
        reasonCodes: ["rotation-cue", "rotation-cue", "no-new-piece-callout"],
      }),
    ).toBe(false);
  });

  it("fails closed when a used design revision has no independently verified catalog frame", () => {
    const fixture = realBuildLedgerTestFixture();
    const unframedCalibration: BuilderCanonicalCalibration = {
      ...fixture.calibration,
      designFrames: [],
    };
    const calibrationBytes = new TextEncoder().encode(JSON.stringify(unframedCalibration));
    const calibrationDigest = sha256Digest(calibrationBytes);
    const unframedOfficial = applyBuilderCanonicalCalibration(
      fixture.rawOfficial,
      calibrationBytes,
      calibrationDigest,
      fixture.builderGeometryBytes,
      fixture.builderGeometryDigest,
    );
    const ledger = { ...fixture.ledger, builderCalibrationDigest: calibrationDigest };
    const failures = validateRealBuildActionLedger({
      ledger,
      ledgerDigest: sha256Digest(JSON.stringify(ledger)),
      lastStep: 359,
      official: unframedOfficial,
      pdfDigest: fixture.pdfDigest,
      coverageDigest: fixture.coverageDigest,
      calloutManifestDigest: fixture.manifestDigest,
      builderCalibrationDigest: calibrationDigest,
      transitionClassificationsDigest: fixture.transitionClassificationsDigest,
      coverageByCallout: fixture.coverageByCallout,
      panelEvidenceByStep: fixture.panelEvidenceByStep,
      transitionClassificationsByStep: fixture.transitionClassificationsByStep,
    });

    expect(failures).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "official-frame-calibration-missing" }),
      ]),
    );
    expect(failures.map(({ message }) => message).join(" ")).toContain("no independently verified");
  });

  it("executes a fixed MultiBuild copy only from a prior exact canonical source", () => {
    type TestDocument = {
      readonly parts: readonly {
        readonly id: string;
        readonly catalogPartId: string;
        readonly colorId: string;
        readonly transform: {
          readonly positionLdu: readonly number[];
          readonly orientationId: string;
        };
      }[];
    };
    const base: TestDocument = {
      parts: [
        {
          id: "part-a",
          catalogPartId: "builtin:brick-1x1",
          colorId: "builtin:black",
          transform: { positionLdu: [0, 0, 0], orientationId: "upright-yaw-0" },
        },
      ],
    };
    const piece = {
      identityKey: "brick-b",
      sourceIdentityKey: "brick-a",
      designId: "3005",
      materialId: "1",
      catalogPartId: "builtin:brick-1x1",
      colorId: "builtin:black",
      transform: { positionLdu: [20, 0, 0] as const, orientationId: "upright-yaw-0" },
    };
    const prior = new Map([
      [
        "brick-a",
        {
          identityKey: "brick-a",
          partId: "part-a",
          stepNumber: 1,
          designId: "3005",
          materialId: "1",
          catalogPartId: "builtin:brick-1x1",
          colorId: "builtin:black",
        },
      ],
    ]);
    const execute = (priorIdentities: typeof prior) =>
      executeFixedLedgerPlacements<TestDocument>({
        stepNumber: 2,
        baseDocument: base,
        targetStepId: null,
        pieces: [piece],
        priorIdentities,
        getParts: ({ parts }) => parts,
        structuralHash: () => REAL_BUILD_TEST_DIGEST,
        place: (document, fixed) => ({
          document: {
            parts: [
              ...document.parts,
              {
                id: "part-b",
                catalogPartId: fixed.catalogPartId,
                colorId: fixed.colorId,
                transform: fixed.transform,
              },
            ],
          },
          partId: "part-b",
          stepId: "step-2",
        }),
      });

    expect(execute(prior)).toMatchObject({ failure: null, stepId: "step-2" });
    expect(execute(new Map())).toMatchObject({ failure: { code: "multi-build-source-invalid" } });
  });
});
