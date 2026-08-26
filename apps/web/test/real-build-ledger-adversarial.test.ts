import { describe, expect, it } from "vitest";

import { sha256Digest } from "../e2e/real-build-artifacts";
import { executeFixedLedgerPlacements } from "../e2e/real-build-fixed-actions";
import {
  actionEvidenceDigest,
  isUnauthenticatedTransitionClassification,
  pieceEvidenceDigest,
  transitionClassificationEvidenceDigest,
  validateRealBuildActionLedger,
  type LedgerCopyIdentity,
  type LedgerStep,
  type RealBuildActionLedger,
} from "../e2e/real-build-ledger";
import {
  realBuildLedgerPrefix,
  realBuildLedgerTestFixture,
} from "./real-build-ledger-test-fixture";
import { REAL_BUILD_TEST_DIGEST } from "./real-build-test-options";

describe("real build adversarial ledger contracts", () => {
  it("rejects fabricated identities, source step/color, and omitted copy rows", () => {
    const fixture = realBuildLedgerTestFixture();
    const validate = (ledger: RealBuildActionLedger) =>
      validateRealBuildActionLedger({
        ledger,
        ledgerDigest: sha256Digest(JSON.stringify(ledger)),
        requestedLastStep: 50,
        lastStep: 50,
        official: fixture.official,
        pdfDigest: fixture.pdfDigest,
        coverageDigest: fixture.coverageDigest,
        calloutManifestDigest: fixture.manifestDigest,
        sourceArtReboundDigest: fixture.sourceArtReboundDigest,
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
          sourceArtReboundDigest: fixture.sourceArtReboundDigest,
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
    ).toMatch(/MultiBuild identities|ledger classification|transition-classification claim/u);
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

  it("separates an artifact request from its aligned rows and refuses execution gaps or raw tails", () => {
    const fixture = realBuildLedgerTestFixture();
    const validate = (ledger: RealBuildActionLedger, lastStep: number) =>
      validateRealBuildActionLedger({
        ledger,
        ledgerDigest: sha256Digest(JSON.stringify(ledger)),
        requestedLastStep: ledger.provenance.requestedLastStep,
        lastStep,
        official: fixture.official,
        pdfDigest: fixture.pdfDigest,
        coverageDigest: fixture.coverageDigest,
        calloutManifestDigest: fixture.manifestDigest,
        sourceArtReboundDigest: fixture.sourceArtReboundDigest,
        builderCalibrationDigest: fixture.builderCalibrationDigest,
        transitionClassificationsDigest: fixture.transitionClassificationsDigest,
        coverageByCallout: fixture.coverageByCallout,
        panelEvidenceByStep: fixture.panelEvidenceByStep,
        transitionClassificationsByStep: fixture.transitionClassificationsByStep,
      });
    const prefixLedger = realBuildLedgerPrefix(
      fixture.ledger,
      50,
      fixture.ledger.steps.slice(0, 2),
    );
    const invalidTailLedger = realBuildLedgerPrefix(fixture.ledger, 2, [
      ...fixture.ledger.steps.slice(0, 2),
      { ...fixture.ledger.steps[2]!, panelEvidenceDigest: REAL_BUILD_TEST_DIGEST },
      ...fixture.ledger.steps.slice(3),
    ]);

    expect(validate(prefixLedger, 2)).toEqual([]);
    expect(
      validate(prefixLedger, 50)
        .map(({ message }) => message)
        .join(" "),
    ).toContain("validated printed step 1..50");
    expect(
      validate(invalidTailLedger, 2)
        .map(({ message }) => message)
        .join(" "),
    ).toMatch(/row 3 lies above requestedLastStep 2|no row above that request/u);
    const legacyV3 = {
      ...realBuildLedgerPrefix(fixture.ledger, 2),
      schemaVersion: "lego.real-build-action-ledger/3",
    } as unknown as RealBuildActionLedger;
    expect(
      validate(legacyV3, 2)
        .map(({ message }) => message)
        .join(" "),
    ).toContain("lego.real-build-action-ledger/4");
  });

  it("refuses oversized top-level and nested rows before invoking array work", () => {
    const fixture = realBuildLedgerTestFixture();
    const validate = (ledger: RealBuildActionLedger, lastStep = 1) =>
      validateRealBuildActionLedger({
        ledger,
        ledgerDigest: fixture.ledgerDigest,
        requestedLastStep: lastStep,
        lastStep,
        official: fixture.official,
        pdfDigest: fixture.pdfDigest,
        coverageDigest: fixture.coverageDigest,
        calloutManifestDigest: fixture.manifestDigest,
        sourceArtReboundDigest: fixture.sourceArtReboundDigest,
        builderCalibrationDigest: fixture.builderCalibrationDigest,
        transitionClassificationsDigest: fixture.transitionClassificationsDigest,
        coverageByCallout: fixture.coverageByCallout,
        panelEvidenceByStep: fixture.panelEvidenceByStep,
        transitionClassificationsByStep: fixture.transitionClassificationsByStep,
      });
    const trapArrayWork = <T>(rows: T[]): T[] => {
      const unexpected = () => {
        throw new Error("oversized hostile array was iterated or transformed");
      };
      Object.defineProperties(rows, {
        filter: { value: unexpected },
        map: { value: unexpected },
        sort: { value: unexpected },
        [Symbol.iterator]: { value: unexpected },
      });
      return rows;
    };
    const firstStep = fixture.ledger.steps[0]!;
    if (firstStep.action.kind !== "place-callouts") throw new Error("fixture action changed");
    const firstAction = firstStep.action;
    const oversizedSteps = trapArrayWork(Array.from({ length: 360 }, () => firstStep));
    const oversizedPieces = trapArrayWork(
      Array.from({ length: 1_466 }, () => firstAction.pieces[0]!),
    );
    const oversizedCallouts = trapArrayWork(
      Array.from({ length: 1_466 }, () => firstStep.callouts[0]!),
    );
    let hostileRowReads = 0;
    const millionRowSparse: LedgerStep[] = [];
    Object.defineProperty(millionRowSparse, "0", {
      enumerable: true,
      configurable: true,
      get: () => {
        hostileRowReads += 1;
        throw new Error("oversized hostile row getter was inspected");
      },
    });
    millionRowSparse.length = 1_000_000;

    expect(validate({ ...fixture.ledger, steps: oversizedSteps })).toEqual([
      expect.objectContaining({
        code: "action-ledger-incomplete",
        message: expect.stringContaining("1 through 359"),
      }),
    ]);
    expect(validate({ ...fixture.ledger, steps: millionRowSparse })).toEqual([
      expect.objectContaining({
        code: "action-ledger-incomplete",
        message: expect.stringContaining("1 through 359"),
      }),
    ]);
    expect(hostileRowReads).toBe(0);
    expect(
      validate({
        ...fixture.ledger,
        steps: [
          {
            ...firstStep,
            action: { ...firstAction, pieces: oversizedPieces },
          },
        ],
      }),
    ).toEqual([
      expect.objectContaining({
        code: "action-ledger-incomplete",
        message: expect.stringContaining("at most 1465"),
      }),
    ]);
    expect(
      validate({ ...fixture.ledger, steps: [{ ...firstStep, callouts: oversizedCallouts }] }),
    ).toEqual([
      expect.objectContaining({
        code: "action-ledger-incomplete",
        message: expect.stringContaining("at most 1465"),
      }),
    ]);
    expect(
      validate({
        ...fixture.ledger,
        steps: [
          {
            ...firstStep,
            action: {
              ...firstAction,
              pieces: Array.from({ length: 1_000 }, () => firstAction.pieces[0]!),
              omittedPieces: Array.from({ length: 466 }, () => firstAction.pieces[0]!),
            },
          },
        ],
      }),
    ).toEqual([
      expect.objectContaining({
        code: "action-ledger-incomplete",
        message: expect.stringContaining("exceeds the 1465-identity official inventory bound"),
      }),
    ]);
  });

  it("rejects accessor-backed schema fields without invoking their getters", () => {
    const fixture = realBuildLedgerTestFixture();
    let getterReads = 0;
    const hostile = { ...fixture.ledger } as RealBuildActionLedger;
    Object.defineProperty(hostile, "provenance", {
      enumerable: true,
      configurable: true,
      get: () => {
        getterReads += 1;
        throw new Error("hostile provenance getter was invoked");
      },
    });

    const failures = validateRealBuildActionLedger({
      ledger: hostile,
      ledgerDigest: fixture.ledgerDigest,
      requestedLastStep: 50,
      lastStep: 50,
      official: fixture.official,
      pdfDigest: fixture.pdfDigest,
      coverageDigest: fixture.coverageDigest,
      calloutManifestDigest: fixture.manifestDigest,
      sourceArtReboundDigest: fixture.sourceArtReboundDigest,
      builderCalibrationDigest: fixture.builderCalibrationDigest,
      transitionClassificationsDigest: fixture.transitionClassificationsDigest,
      coverageByCallout: fixture.coverageByCallout,
      panelEvidenceByStep: fixture.panelEvidenceByStep,
      transitionClassificationsByStep: fixture.transitionClassificationsByStep,
    });

    expect(failures).toEqual([
      expect.objectContaining({
        code: "action-ledger-incomplete",
        message: expect.stringContaining("descriptor-safe data"),
      }),
    ]);
    expect(getterReads).toBe(0);
  });

  it("caps hostile validation failures with an explicit terminal sentinel", () => {
    const fixture = realBuildLedgerTestFixture();
    const firstStep = fixture.ledger.steps[0]!;
    if (firstStep.action.kind !== "place-callouts") throw new Error("fixture action changed");
    const hostilePiece = {
      ...firstStep.action.pieces[0]!,
      designId: "forged-design",
      catalogPartId: "builtin:forged-part",
      evidenceDigest: REAL_BUILD_TEST_DIGEST,
    };
    const ledger: RealBuildActionLedger = {
      ...fixture.ledger,
      steps: [
        {
          ...firstStep,
          action: {
            ...firstStep.action,
            pieces: Array.from({ length: 1_465 }, () => hostilePiece),
          },
        },
      ],
    };

    const failures = validateRealBuildActionLedger({
      ledger,
      ledgerDigest: fixture.ledgerDigest,
      requestedLastStep: ledger.provenance.requestedLastStep,
      lastStep: 1,
      official: fixture.official,
      pdfDigest: fixture.pdfDigest,
      coverageDigest: fixture.coverageDigest,
      calloutManifestDigest: fixture.manifestDigest,
      sourceArtReboundDigest: fixture.sourceArtReboundDigest,
      builderCalibrationDigest: fixture.builderCalibrationDigest,
      transitionClassificationsDigest: fixture.transitionClassificationsDigest,
      coverageByCallout: fixture.coverageByCallout,
      panelEvidenceByStep: fixture.panelEvidenceByStep,
      transitionClassificationsByStep: fixture.transitionClassificationsByStep,
    });

    expect(failures).toHaveLength(4_096);
    expect(failures.at(-1)).toMatchObject({
      code: "validation-failure-limit",
      stage: "input",
      inputKey: "actionLedger.validationFailures",
    });
    expect(failures.at(-1)?.message).toMatch(/retained 4095 failures and omitted \d+/u);
  });

  it("requires zero-coverage steps to retain transition authority and rejects unknown actions", () => {
    const fixture = realBuildLedgerTestFixture();
    const validate = (ledger: RealBuildActionLedger) =>
      validateRealBuildActionLedger({
        ledger,
        ledgerDigest: sha256Digest(JSON.stringify(ledger)),
        requestedLastStep: 3,
        lastStep: 3,
        official: fixture.official,
        pdfDigest: fixture.pdfDigest,
        coverageDigest: fixture.coverageDigest,
        calloutManifestDigest: fixture.manifestDigest,
        sourceArtReboundDigest: fixture.sourceArtReboundDigest,
        builderCalibrationDigest: fixture.builderCalibrationDigest,
        transitionClassificationsDigest: fixture.transitionClassificationsDigest,
        coverageByCallout: fixture.coverageByCallout,
        panelEvidenceByStep: fixture.panelEvidenceByStep,
        transitionClassificationsByStep: fixture.transitionClassificationsByStep,
      });
    const baseline = realBuildLedgerPrefix(fixture.ledger, 3);
    const replaceThirdAction = (action: LedgerStep["action"]): RealBuildActionLedger =>
      realBuildLedgerPrefix(fixture.ledger, 3, [
        ...fixture.ledger.steps.slice(0, 2),
        { ...fixture.ledger.steps[2]!, action },
      ]);

    expect(validate(baseline)).toEqual([]);
    const emptyPlacement = validate(
      replaceThirdAction({ kind: "place-callouts", pieces: [], omittedPieces: [] }),
    );
    expect(emptyPlacement).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "action-ledger-incomplete", stepNumber: 3 }),
      ]),
    );
    expect(emptyPlacement.map(({ message }) => message).join(" ")).toMatch(
      /zero retained callouts.*transition action and classification/u,
    );

    const unknownAction = validate(
      replaceThirdAction({ kind: "forged" } as unknown as LedgerStep["action"]),
    );
    expect(unknownAction).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "action-ledger-incomplete",
          inputKey: "actionLedger.steps",
        }),
      ]),
    );
    expect(unknownAction.map(({ message }) => message).join(" ")).toContain(
      "action.kind is outside the current /4 action union",
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
    const unframedCalibration = {
      ...fixture.calibration,
      designFrames: [],
    };
    const calibrationBytes = new TextEncoder().encode(JSON.stringify(unframedCalibration));
    const calibrationDigest = sha256Digest(calibrationBytes);
    const unframedOfficial = {
      ...fixture.official,
      calibrationDigest,
      bricks: Object.fromEntries(
        Object.entries(fixture.official.bricks).map(([brickRef, brick]) => [
          brickRef,
          {
            ...brick,
            canonicalTransform: null,
            canonicalTransformFailure:
              `Design revision ${brick.designRevision} has no independently verified ` +
              `code-pinned Builder type-23 plus independent LDraw surface calibration.`,
            calibratedCatalogPartId: null,
            frameEvidenceDigest: null,
          },
        ]),
      ),
    };
    const ledger = { ...fixture.ledger, builderCalibrationDigest: calibrationDigest };
    const failures = validateRealBuildActionLedger({
      ledger,
      ledgerDigest: sha256Digest(JSON.stringify(ledger)),
      requestedLastStep: 50,
      lastStep: 50,
      official: unframedOfficial,
      pdfDigest: fixture.pdfDigest,
      coverageDigest: fixture.coverageDigest,
      calloutManifestDigest: fixture.manifestDigest,
      sourceArtReboundDigest: fixture.sourceArtReboundDigest,
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
