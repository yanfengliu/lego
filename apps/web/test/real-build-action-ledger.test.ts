import { describe, expect, it } from "vitest";

import { sha256Digest } from "../e2e/real-build-artifacts";
import {
  assembleRealBuildActionLedger,
  emittedRealBuildActionLedger,
  encodeRealBuildActionLedger,
  flattenOfficialBuilderIdentities,
  formatActionLedgerRefusalOutput,
  type ActionLedgerRefusal,
  type RealBuildActionLedgerBindings,
} from "../e2e/real-build-action-ledger";
import { pieceRefusal } from "../e2e/real-build-action-ledger-cut";
import type { CalloutResolution } from "../e2e/real-build-input-files";
import {
  parseOfficialModelIndex,
  stepPanelEvidenceDigest,
  validateRealBuildActionLedger,
  type OfficialModelIndex,
  type TransitionClassificationEvidence,
} from "../e2e/real-build-ledger";
import { buildTransitionClassificationEntry } from "../e2e/real-build-transition-classification";

/**
 * The action-ledger assembler's contract, checked against the same validator
 * the real-build probe applies. These fixtures are synthetic and repo-owned:
 * the published ledger is an uncommitted artifact, so the gate has to be able
 * to reject a bad assembler without it.
 */

const CATALOG_PART = "builtin:brick-1x1";
const OTHER_CATALOG_PART = "builtin:brick-1x2";
const SUCCESSFUL_CURSOR_RESULT =
  "the cumulative quantity cursor was corroborated through printed step 1; " +
  "this does not claim every retained callout was admitted as a ledger action.";

type OfficialDesignFixture = readonly [brickRef: string, designId: string, itemNos?: string];

function officialXml(designs: readonly OfficialDesignFixture[]): Uint8Array {
  const bricks = designs
    .map(
      ([brickRef, designId, itemNos = designId], index) =>
        `<Brick uuid="${brickRef}" designID="${designId}" itemNos="${itemNos}">` +
        `<Part uuid="part-${brickRef}" designID="${designId}" materials="1">` +
        `<Bone uuid="bone-${brickRef}" transformation="1,0,0,0,1,0,0,0,1,${index * 0.8},0,0"/>` +
        `</Part></Brick>`,
    )
    .join("");
  const ins = designs.map(([brickRef]) => `<In brickRef="${brickRef}"/>`).join("");
  return new TextEncoder().encode(
    `<Root><Bricks>${bricks}</Bricks>` +
      `<BuildingInstructions>` +
      `<BuildingInstruction name="Building Instruction ##B" uuid="fixture-instruction">` +
      `<Steps><Step uuid="fixture-root">${ins}` +
      `<EndOnHighView><Added/><Removed/></EndOnHighView></Step></Steps></BuildingInstruction>` +
      `<BuildingInstruction name="Group #IX" uuid="fixture-aggregate"><Steps>` +
      `<Step uuid="fixture-aggregate-step">${ins}` +
      `<EndOnHighView><Added/><Removed/></EndOnHighView></Step></Steps></BuildingInstruction>` +
      `</BuildingInstructions>` +
      `<BIGraph><BINode uuid="node-primary" buildingInstructionRef="fixture-instruction"/>` +
      `<BINode uuid="node-aggregate" buildingInstructionRef="fixture-aggregate"/>` +
      `<Dependency predecessorRef="node-primary" successorRef="node-aggregate"/>` +
      `</BIGraph></Root>`,
  );
}

const BINDINGS: RealBuildActionLedgerBindings = {
  pdfDigest: sha256Digest("fixture-pdf"),
  coverageDigest: sha256Digest("fixture-coverage"),
  calloutManifestDigest: sha256Digest("fixture-manifest"),
  builderCalibrationDigest: sha256Digest("fixture-calibration"),
  transitionClassificationsDigest: sha256Digest("fixture-transitions"),
};

/** Calibrates every design except those named, so a missing frame can be exercised. */
function calibratedOfficial(
  designs: readonly OfficialDesignFixture[],
  uncalibrated: readonly string[] = [],
): OfficialModelIndex {
  const parsed = parseOfficialModelIndex(officialXml(designs));
  return {
    ...parsed,
    calibrationDigest: BINDINGS.builderCalibrationDigest,
    builderGeometryDigest: sha256Digest("fixture-geometry"),
    bricks: Object.fromEntries(
      Object.entries(parsed.bricks).map(([brickRef, brick]) => [
        brickRef,
        uncalibrated.includes(brickRef)
          ? {
              ...brick,
              canonicalTransform: null,
              canonicalTransformFailure: "no independently verified frame",
              calibratedCatalogPartId: null,
              frameEvidenceDigest: null,
            }
          : {
              ...brick,
              canonicalTransform: {
                positionLdu: [0, 8, 0] as const,
                orientationId: "upright-yaw-0",
              },
              canonicalTransformFailure: null,
              calibratedCatalogPartId: CATALOG_PART,
              frameEvidenceDigest: sha256Digest(`frame-${brick.designRevision}`),
            },
      ]),
    ),
  };
}

/** One direct Brick in a completed SubBuild, then one MultiBuild copy of it. */
function multiBuildOfficial(): OfficialModelIndex {
  const physical = (brickRef: string, offset: number): string =>
    `<Brick uuid="${brickRef}" designID="3005" itemNos="3005">` +
    `<Part uuid="part-${brickRef}" designID="3005" materials="1">` +
    `<Bone uuid="bone-${brickRef}" transformation="1,0,0,0,1,0,0,0,1,${offset},0,0"/>` +
    `</Part></Brick>`;
  const parsed = parseOfficialModelIndex(
    new TextEncoder().encode(
      `<Root><Bricks>${physical("brick-a", 0)}${physical("copy-b", 0.8)}</Bricks>` +
        `<BuildingInstructions>` +
        `<BuildingInstruction name="Building Instruction ##B" uuid="fixture-instruction">` +
        `<Steps><Step uuid="fixture-root">` +
        `<SubBuild uuid="fixture-master"><Step uuid="fixture-master-step">` +
        `<In brickRef="brick-a"/></Step><CameraFittingRange range="0,1"/>` +
        `<StartImageView uuid="fixture-start"><Added/><Removed/></StartImageView></SubBuild>` +
        `<MultiBuild name="fixture-copy" masterSubBuildRef="fixture-master">` +
        `<MultiBuildBrick originalBrickRef="brick-a" actualBrickRef="copy-b"/></MultiBuild>` +
        `<EndOnHighView><Added/><Removed/></EndOnHighView></Step></Steps></BuildingInstruction>` +
        `<BuildingInstruction name="Group #IX" uuid="fixture-aggregate"><Steps>` +
        `<Step uuid="fixture-aggregate-step"><In brickRef="brick-a"/><In brickRef="copy-b"/>` +
        `<EndOnHighView><Added/><Removed/></EndOnHighView></Step></Steps></BuildingInstruction>` +
        `</BuildingInstructions>` +
        `<BIGraph><BINode uuid="node-primary" buildingInstructionRef="fixture-instruction"/>` +
        `<BINode uuid="node-aggregate" buildingInstructionRef="fixture-aggregate"/>` +
        `<Dependency predecessorRef="node-primary" successorRef="node-aggregate"/>` +
        `</BIGraph></Root>`,
    ),
  );
  return {
    ...parsed,
    calibrationDigest: BINDINGS.builderCalibrationDigest,
    bricks: Object.fromEntries(
      Object.entries(parsed.bricks).map(([brickRef, brick]) => [
        brickRef,
        {
          ...brick,
          canonicalTransform: { positionLdu: [0, 8, 0] as const, orientationId: "upright-yaw-0" },
          canonicalTransformFailure: null,
          calibratedCatalogPartId: CATALOG_PART,
          frameEvidenceDigest: sha256Digest(`frame-${brick.designRevision}`),
        },
      ]),
    ),
  };
}

function panelEvidence(
  steps: readonly number[],
): Readonly<Record<number, { readonly pageNumber: number; readonly digest: string }>> {
  return Object.fromEntries(
    steps.map((stepNumber) => [
      stepNumber,
      {
        pageNumber: stepNumber,
        digest: stepPanelEvidenceDigest({
          pdfDigest: BINDINGS.pdfDigest,
          stepNumber,
          pageNumber: stepNumber,
          bounds: { minXPt: 0, maxXPt: 1, minYPt: 0, maxYPt: 1 },
          calloutBoxes: [],
        }),
      },
    ]),
  );
}

function claim(input: {
  readonly stepNumber: number;
  readonly quantity: number;
  readonly partNum: string;
  readonly confidence?: string;
  readonly catalogPartId?: string | null;
  readonly elementId?: string | null;
}): CalloutResolution {
  return {
    pageNumber: input.stepNumber,
    stepNumber: input.stepNumber,
    quantity: input.quantity,
    identificationConfidence: input.confidence ?? "vision-kept",
    cropDigest: sha256Digest(`crop-${input.stepNumber}-${input.partNum}`),
    inputDigest: BINDINGS.calloutManifestDigest,
    elementId: input.elementId === undefined ? input.partNum : input.elementId,
    resolution: {
      catalogPartId: input.catalogPartId === undefined ? CATALOG_PART : input.catalogPartId,
      colorId: "builtin:black",
      partNum: input.partNum,
      name: `Fixture ${input.partNum}`,
    },
  };
}

function transitionAt(
  stepNumber: number,
  panels: ReturnType<typeof panelEvidence>,
): Readonly<Record<number, TransitionClassificationEvidence>> {
  return {
    [stepNumber]: buildTransitionClassificationEntry({
      panel: {
        stepNumber,
        pageNumber: panels[stepNumber]!.pageNumber,
        panelEvidenceDigest: panels[stepNumber]!.digest,
        newPieceCalloutCount: 0,
        isTerminalPrintedStep: false,
      },
      proposal: {
        decision: "rotation",
        classifierKind: "human-claim",
        notes: "Fixture panel prints no new piece callout and shows a rotate-the-model icon.",
      },
      classifierId: "lego.fixture-classifier/1",
    }),
  };
}

describe("assembleRealBuildActionLedger", () => {
  it("binds every printed step it can corroborate and the validator accepts it", () => {
    const designs = [
      ["brick-a", "3005"],
      ["brick-b", "3004"],
    ] as const;
    const official = calibratedOfficial(designs);
    const panels = panelEvidence([1, 2, 3]);
    const coverageByCallout = {
      "p1|q1|x1.000|y1.000": claim({ stepNumber: 1, quantity: 1, partNum: "3005" }),
      "p3|q1|x1.000|y1.000": claim({ stepNumber: 3, quantity: 1, partNum: "3004" }),
    };
    const transitions = transitionAt(2, panels);
    const assembled = assembleRealBuildActionLedger({
      official,
      bindings: BINDINGS,
      coverageByCallout,
      panelEvidenceByStep: panels,
      transitionClassificationsByStep: transitions,
      expectedPrintedSteps: 3,
    });
    expect(assembled.alignedThroughStep).toBe(3);
    expect(assembled.directPieceCount).toBe(2);
    expect(assembled.transitionStepCount).toBe(1);
    expect(assembled.refusals).toEqual([]);
    expect(assembled.ledger.steps[1]!.action).toEqual({
      kind: "transition",
      transition: "rotation",
      classificationEvidenceDigest: transitions[2]!.evidenceDigest,
    });
    expect(
      validateRealBuildActionLedger({
        ledger: assembled.ledger,
        ledgerDigest: sha256Digest(
          encodeRealBuildActionLedger(emittedRealBuildActionLedger(assembled, 3)),
        ),
        lastStep: 3,
        official,
        pdfDigest: BINDINGS.pdfDigest,
        coverageDigest: BINDINGS.coverageDigest,
        calloutManifestDigest: BINDINGS.calloutManifestDigest,
        builderCalibrationDigest: BINDINGS.builderCalibrationDigest,
        transitionClassificationsDigest: BINDINGS.transitionClassificationsDigest,
        coverageByCallout,
        panelEvidenceByStep: panels,
        transitionClassificationsByStep: transitions,
      }),
    ).toEqual([]);
  });

  it("refuses a callout the identification pipeline did not keep instead of certifying it", () => {
    const designs = [["brick-a", "3005"]] as const;
    const official = calibratedOfficial(designs);
    const panels = panelEvidence([1]);
    const assembled = assembleRealBuildActionLedger({
      official,
      bindings: BINDINGS,
      coverageByCallout: {
        "p1|q1|x1.000|y1.000": claim({
          stepNumber: 1,
          quantity: 1,
          partNum: "3005",
          confidence: "self-contradicted",
        }),
      },
      panelEvidenceByStep: panels,
      transitionClassificationsByStep: {},
      expectedPrintedSteps: 1,
    });
    expect(assembled.directPieceCount).toBe(0);
    expect(assembled.ledger.steps[0]!.callouts).toEqual([]);
    expect(assembled.refusals).toHaveLength(1);
    expect(assembled.refusals[0]!.reason).toContain("self-contradicted");
    // Names every trust source a callout could have been established by, so the
    // refusal says what would satisfy it rather than only what failed.
    expect(assembled.refusals[0]!.reason).toContain(
      'only "vision-kept" and "pair-judged-same" callouts may become a ledger piece',
    );
    expect(JSON.stringify(assembled.ledger)).not.toContain("self-contradicted");
  });

  it("refuses a piece whose callout disagrees with the official identity cut to it", () => {
    const designs = [["brick-a", "3005"]] as const;
    const official = calibratedOfficial(designs);
    const panels = panelEvidence([1]);
    const assembled = assembleRealBuildActionLedger({
      official,
      bindings: BINDINGS,
      coverageByCallout: {
        // A trusted claim about a different part is drift, not a piece: the walk stops.
        "p1|q1|x1.000|y1.000": claim({ stepNumber: 1, quantity: 1, partNum: "9999" }),
      },
      panelEvidenceByStep: panels,
      transitionClassificationsByStep: {},
      expectedPrintedSteps: 1,
    });
    expect(assembled.alignedThroughStep).toBe(0);
    expect(assembled.stopReason).toContain("p1|q1|x1.000|y1.000");
    expect(assembled.stopReason).toContain("9999");
  });

  it("corroborates the already quantity-cut disputed rows while keeping unresolved 28802 refused", () => {
    const official = calibratedOfficial([
      ["brick-a", "10201", "6168620"],
      ["brick-b", "10201", "6168620"],
    ]);
    const panels = panelEvidence([1]);
    const assembled = assembleRealBuildActionLedger({
      official,
      bindings: BINDINGS,
      coverageByCallout: {
        "p30|q2|x84.228|y407.699": claim({
          stepNumber: 1,
          quantity: 2,
          partNum: "28802",
          elementId: "6168620",
          catalogPartId: null,
          confidence: "pair-judged-same",
        }),
      },
      panelEvidenceByStep: panels,
      transitionClassificationsByStep: {},
      expectedPrintedSteps: 1,
    });
    expect(assembled.alignedThroughStep).toBe(1);
    expect(assembled.stopReason).toBe(SUCCESSFUL_CURSOR_RESULT);
    expect(assembled.directPieceCount).toBe(0);
    expect(assembled.ledger.steps[0]!.callouts).toEqual([]);
    expect(assembled.refusals.map(({ brickRef }) => brickRef)).toEqual(["brick-a", "brick-b"]);
    expect(assembled.refusals.map(({ reason }) => reason)).toEqual([
      expect.stringContaining("has no resolved catalog part"),
      expect.stringContaining("has no resolved catalog part"),
    ]);
  });

  it("refuses two distinct trusted callouts that claim the same element in one step", () => {
    const official = calibratedOfficial([
      ["brick-a", "3005", "300501"],
      ["brick-b", "3005", "300501"],
    ]);
    const assembled = assembleRealBuildActionLedger({
      official,
      bindings: BINDINGS,
      coverageByCallout: {
        "p1|q1|x1.000|y1.000": claim({
          stepNumber: 1,
          quantity: 1,
          partNum: "3005",
          elementId: "300501",
          confidence: "vision-kept",
        }),
        "p1|q1|x2.000|y1.000": claim({
          stepNumber: 1,
          quantity: 1,
          partNum: "3005",
          elementId: "300501",
          confidence: "pair-judged-same",
        }),
      },
      panelEvidenceByStep: panelEvidence([1]),
      transitionClassificationsByStep: {},
      expectedPrintedSteps: 1,
    });
    expect(assembled.alignedThroughStep).toBe(0);
    expect(assembled.ledger.steps).toEqual([]);
    expect(assembled.stopReason).toContain('"p1|q1|x1.000|y1.000"');
    expect(assembled.stopReason).toContain('"p1|q1|x2.000|y1.000"');
    expect(assembled.stopReason).toContain('both claim element "300501"');
    expect(assembled.stopReason).toContain(
      "cannot decide which callout owns which physical Brick UUID",
    );
    expect(assembled.stopReason).toContain("full printed quantity on one callout");
  });

  it("does not let a matching design substitute for the exact official element identity", () => {
    const designs = Array.from(
      { length: 20 },
      (_, index) =>
        [`brick-${index.toString().padStart(2, "0")}`, "3005", `${3005000 + index}`] as const,
    );
    const official = calibratedOfficial(designs);
    const panels = panelEvidence([1]);
    const assembled = assembleRealBuildActionLedger({
      official,
      bindings: BINDINGS,
      coverageByCallout: {
        "p1|q20|x1.000|y1.000": claim({
          stepNumber: 1,
          quantity: 20,
          partNum: "3005",
          elementId: "9999999",
        }),
      },
      panelEvidenceByStep: panels,
      transitionClassificationsByStep: {},
      expectedPrintedSteps: 1,
    });
    expect(assembled.alignedThroughStep).toBe(0);
    expect(assembled.stopReason).toContain('claims element "9999999"');
    expect(assembled.stopReason).toContain("only 0 of 20 printed unit(s) matched");
    expect(assembled.stopReason).toContain("8 more identities omitted");
    expect(assembled.stopReason).not.toContain("brick-19");
    expect(assembled.stopReason!.length).toBeLessThan(4_096);
  });

  it("does not search an adjacent Builder window when the quantity-derived cut mismatches", () => {
    const official = calibratedOfficial([
      ["brick-a", "3005", "300501"],
      ["brick-b", "3005", "300502"],
    ]);
    const assembled = assembleRealBuildActionLedger({
      official,
      bindings: BINDINGS,
      coverageByCallout: {
        "p1|q1|x1.000|y1.000": claim({
          stepNumber: 1,
          quantity: 1,
          partNum: "3005",
          elementId: "300502",
        }),
      },
      panelEvidenceByStep: panelEvidence([1]),
      transitionClassificationsByStep: {},
      expectedPrintedSteps: 1,
    });
    expect(assembled.alignedThroughStep).toBe(0);
    expect(assembled.stopReason).toContain("quantity-derived cursor");
    expect(assembled.stopReason).toContain("does not search or select an adjacent Builder window");
    expect(assembled.stopReason).toContain("brick-a");
    expect(assembled.stopReason).not.toContain("brick-b");
  });

  it("fails closed when an official cut identity has missing or multiple itemNos", () => {
    for (const itemNos of [[], ["300501", "300502"]] as const) {
      const parsed = calibratedOfficial([["brick-a", "3005", "300501"]]);
      const official: OfficialModelIndex = {
        ...parsed,
        bricks: {
          ...parsed.bricks,
          "brick-a": { ...parsed.bricks["brick-a"]!, itemNos },
        },
      };
      const assembled = assembleRealBuildActionLedger({
        official,
        bindings: BINDINGS,
        coverageByCallout: {
          "p1|q1|x1.000|y1.000": claim({
            stepNumber: 1,
            quantity: 1,
            partNum: "3005",
            elementId: "300501",
          }),
        },
        panelEvidenceByStep: panelEvidence([1]),
        transitionClassificationsByStep: {},
        expectedPrintedSteps: 1,
      });
      expect(assembled.alignedThroughStep).toBe(0);
      expect(assembled.stopReason).toContain(`has ${itemNos.length} itemNos`);
      expect(assembled.stopReason).toContain("requires exactly one itemNo");
      expect(assembled.stopReason).toContain('"itemNoCount"');
      expect(assembled.stopReason!.length).toBeLessThan(4_096);
    }
  });

  it("requires every printed quantity unit to have a distinct physical Brick with the same itemNo", () => {
    const official = calibratedOfficial([
      ["brick-a", "10201", "6168620"],
      ["brick-b", "10201", "6168621"],
    ]);
    const assembled = assembleRealBuildActionLedger({
      official,
      bindings: BINDINGS,
      coverageByCallout: {
        "p30|q2|x84.228|y407.699": claim({
          stepNumber: 1,
          quantity: 2,
          partNum: "28802",
          elementId: "6168620",
          catalogPartId: null,
        }),
      },
      panelEvidenceByStep: panelEvidence([1]),
      transitionClassificationsByStep: {},
      expectedPrintedSteps: 1,
    });
    expect(assembled.alignedThroughStep).toBe(0);
    expect(assembled.stopReason).toContain("only 1 of 2 printed unit(s) matched");
    expect(assembled.stopReason).toContain("6168620");
    expect(assembled.stopReason).toContain("6168621");
  });

  it("still refuses an exact-element slot whose admitted catalog part disagrees with official design", () => {
    const official = calibratedOfficial([["brick-a", "10201", "6168620"]]);
    const assembled = assembleRealBuildActionLedger({
      official,
      bindings: BINDINGS,
      coverageByCallout: {
        "p30|q1|x84.228|y407.699": claim({
          stepNumber: 1,
          quantity: 1,
          partNum: "28802",
          elementId: "6168620",
          catalogPartId: CATALOG_PART,
        }),
      },
      panelEvidenceByStep: panelEvidence([1]),
      transitionClassificationsByStep: {},
      expectedPrintedSteps: 1,
    });
    expect(assembled.alignedThroughStep).toBe(1);
    expect(assembled.stopReason).toBe(SUCCESSFUL_CURSOR_RESULT);
    expect(assembled.directPieceCount).toBe(0);
    expect(assembled.ledger.steps[0]!.callouts).toEqual([]);
    expect(assembled.refusals).toHaveLength(1);
    expect(assembled.refusals[0]!.reason).toContain('identifies part "28802"');
    expect(assembled.refusals[0]!.reason).toContain('design "10201"');
  });

  it("stops at the first printed step the official cut no longer corroborates", () => {
    const designs = [
      ["brick-a", "3005"],
      ["brick-b", "3005"],
    ] as const;
    const official = calibratedOfficial(designs);
    const panels = panelEvidence([1, 2]);
    const assembled = assembleRealBuildActionLedger({
      official,
      bindings: BINDINGS,
      coverageByCallout: {
        "p1|q1|x1.000|y1.000": claim({ stepNumber: 1, quantity: 1, partNum: "3005" }),
        "p2|q2|x1.000|y1.000": claim({ stepNumber: 2, quantity: 2, partNum: "3005" }),
      },
      panelEvidenceByStep: panels,
      transitionClassificationsByStep: {},
      expectedPrintedSteps: 2,
    });
    expect(assembled.alignedThroughStep).toBe(1);
    expect(assembled.stopReason).toContain("printed step 2");
    expect(assembled.stopReason).toContain("only 1 remain");
  });

  it("binds a callout's whole printed quantity or none of it", () => {
    const official = multiBuildOfficial();
    const panels = panelEvidence([1]);
    const assembled = assembleRealBuildActionLedger({
      official,
      bindings: BINDINGS,
      coverageByCallout: {
        // Two printed pieces, but the Builder cut makes the second one a copy of
        // the first, which retained coverage does not carry a multiplier for.
        "p1|q2|x1.000|y1.000": claim({ stepNumber: 1, quantity: 2, partNum: "3005" }),
      },
      panelEvidenceByStep: panels,
      transitionClassificationsByStep: {},
      expectedPrintedSteps: 1,
    });
    expect(assembled.directPieceCount).toBe(0);
    expect(assembled.ledger.steps[0]!.callouts).toEqual([]);
    expect(assembled.refusals).toHaveLength(2);
    expect(assembled.refusals[0]!.reason).toContain(
      'official identity "copy-b" is a MultiBuild copy of "brick-a"',
    );
    expect(assembled.refusals[1]!.reason).toContain(
      "callout p1|q2|x1.000|y1.000 prints 2 piece(s) but only 1 could be bound",
    );
  });

  it.each([
    ["self-contradicted", "vision-kept", "mixed-trust"],
    ["self-contradicted", "self-contradicted", "untrusted"],
  ])(
    "refuses %s/%s cross-callout element competition without assigning a physical UUID",
    (firstConfidence, secondConfidence, trustDescription) => {
      const official = multiBuildOfficial();
      const assembled = assembleRealBuildActionLedger({
        official,
        bindings: BINDINGS,
        coverageByCallout: {
          "p1|q1|x1.000|y1.000": claim({
            stepNumber: 1,
            quantity: 1,
            partNum: "3005",
            elementId: "3005",
            confidence: firstConfidence,
          }),
          "p1|q1|x2.000|y1.000": claim({
            stepNumber: 1,
            quantity: 1,
            partNum: "3005",
            elementId: "3005",
            confidence: secondConfidence,
          }),
        },
        panelEvidenceByStep: panelEvidence([1]),
        transitionClassificationsByStep: {},
        expectedPrintedSteps: 1,
      });
      expect(assembled.alignedThroughStep).toBe(0);
      expect(assembled.directPieceCount).toBe(0);
      expect(assembled.ledger.steps).toEqual([]);
      expect(assembled.refusals).toEqual([]);
      expect(assembled.stopReason).toContain(`${trustDescription} callouts`);
      expect(assembled.stopReason).toContain('both claim element "3005"');
      expect(assembled.stopReason).toContain("trust priority cannot manufacture");
      expect(assembled.stopReason).toContain("will not choose arbitrarily");
    },
  );

  it("records one bounded aggregate refusal when no exact identity can be assigned", () => {
    const official = calibratedOfficial([["brick-a", "3005", "300501"]]);
    const calloutKey = `p1|q1|x1.000|y1.000|${"x".repeat(500)}`;
    const assembled = assembleRealBuildActionLedger({
      official,
      bindings: BINDINGS,
      coverageByCallout: {
        [calloutKey]: claim({
          stepNumber: 1,
          quantity: 1,
          partNum: "3005",
          elementId: "999999",
          confidence: "self-contradicted",
        }),
      },
      panelEvidenceByStep: panelEvidence([1]),
      transitionClassificationsByStep: {},
      expectedPrintedSteps: 1,
    });
    expect(assembled.alignedThroughStep).toBe(1);
    expect(assembled.directPieceCount).toBe(0);
    expect(assembled.ledger.steps[0]!.callouts).toEqual([]);
    expect(assembled.refusals).toHaveLength(1);
    expect(assembled.refusals[0]).toMatchObject({ calloutKey, brickRef: null });
    expect(assembled.refusals[0]!.reason).toContain("but only 0 could be assigned one-to-one");
    expect(assembled.refusals[0]!.reason).toContain("1 remain without an official identity");
    expect(assembled.refusals[0]!.reason).not.toContain(calloutKey);
    expect(assembled.refusals[0]!.reason.length).toBeLessThan(600);
  });

  it("records an official identity whose design frame is missing so the validator names it", () => {
    const official = calibratedOfficial([["brick-a", "3005"]], ["brick-a"]);
    const panels = panelEvidence([1]);
    const coverageByCallout = {
      "p1|q1|x1.000|y1.000": claim({
        stepNumber: 1,
        quantity: 1,
        partNum: "3005",
        catalogPartId: OTHER_CATALOG_PART,
      }),
    };
    const assembled = assembleRealBuildActionLedger({
      official,
      bindings: BINDINGS,
      coverageByCallout,
      panelEvidenceByStep: panels,
      transitionClassificationsByStep: {},
      expectedPrintedSteps: 1,
    });
    expect(assembled.directPieceCount).toBe(1);
    expect(assembled.refusals).toEqual([]);
    const failures = validateRealBuildActionLedger({
      ledger: assembled.ledger,
      ledgerDigest: sha256Digest("fixture-ledger-bytes"),
      lastStep: 1,
      official,
      pdfDigest: BINDINGS.pdfDigest,
      coverageDigest: BINDINGS.coverageDigest,
      calloutManifestDigest: BINDINGS.calloutManifestDigest,
      builderCalibrationDigest: BINDINGS.builderCalibrationDigest,
      transitionClassificationsDigest: BINDINGS.transitionClassificationsDigest,
      coverageByCallout,
      panelEvidenceByStep: panels,
      transitionClassificationsByStep: {},
    });
    expect(failures.map(({ code }) => code)).toEqual([
      "official-frame-calibration-missing",
      "action-ledger-incomplete",
    ]);
    expect(failures[0]!.message).toContain("3005");
  });

  it("stops when a zero-callout printed step carries no transition classification", () => {
    const designs = [["brick-a", "3005"]] as const;
    const official = calibratedOfficial(designs);
    const panels = panelEvidence([1, 2]);
    const assembled = assembleRealBuildActionLedger({
      official,
      bindings: BINDINGS,
      coverageByCallout: {
        "p1|q1|x1.000|y1.000": claim({ stepNumber: 1, quantity: 1, partNum: "3005" }),
      },
      panelEvidenceByStep: panels,
      transitionClassificationsByStep: {},
      expectedPrintedSteps: 2,
    });
    expect(assembled.alignedThroughStep).toBe(1);
    expect(assembled.stopReason).toContain("rotation, attachment, or final view");
  });

  it("names the binding a caller supplied when it is not a retained digest", () => {
    expect(() =>
      assembleRealBuildActionLedger({
        official: calibratedOfficial([["brick-a", "3005"]]),
        bindings: { ...BINDINGS, coverageDigest: "not-a-digest" },
        coverageByCallout: {},
        panelEvidenceByStep: panelEvidence([1]),
        transitionClassificationsByStep: {},
        expectedPrintedSteps: 1,
      }),
    ).toThrow(/coverageDigest is "not-a-digest".*sha256:<64 hex>/su);
  });
});

describe("pieceRefusal", () => {
  it("bounds attacker-controlled identity, design, and claim values in every refusal path", () => {
    const baseOfficial = calibratedOfficial([["brick-a", "3005", "3005"]]);
    const baseBrick = baseOfficial.bricks["brick-a"]!;
    const hostile = {
      brickRef: `brick-${"b".repeat(500)}`,
      designId: `design-${"d".repeat(500)}`,
      designRevision: `revision-${"r".repeat(500)}`,
      partNum: `part-${"p".repeat(500)}`,
      calloutKey: `callout-${"k".repeat(500)}`,
      confidence: `confidence-${"c".repeat(500)}`,
      cropDigest: `crop-${"o".repeat(500)}`,
      inputDigest: `input-${"i".repeat(500)}`,
      manifestDigest: `manifest-${"m".repeat(500)}`,
    };
    const hostileOfficial: OfficialModelIndex = {
      ...baseOfficial,
      bricks: {
        [hostile.brickRef]: {
          ...baseBrick,
          brickRef: hostile.brickRef,
          designId: hostile.designId,
          designRevision: hostile.designRevision,
        },
      },
    };
    const acceptedClaim = claim({
      stepNumber: 1,
      quantity: 1,
      partNum: "3005",
      elementId: "3005",
    });
    const reasons = [
      pieceRefusal({
        stepNumber: 1,
        calloutKey: hostile.calloutKey,
        identity: { kind: "direct", brickRef: hostile.brickRef, sourceBrickRef: null },
        claim: acceptedClaim,
        official: baseOfficial,
        calloutManifestDigest: BINDINGS.calloutManifestDigest,
      }),
      pieceRefusal({
        stepNumber: 1,
        calloutKey: hostile.calloutKey,
        identity: { kind: "direct", brickRef: "brick-a", sourceBrickRef: null },
        claim: { ...acceptedClaim, identificationConfidence: hostile.confidence },
        official: baseOfficial,
        calloutManifestDigest: BINDINGS.calloutManifestDigest,
      }),
      pieceRefusal({
        stepNumber: 1,
        calloutKey: hostile.calloutKey,
        identity: { kind: "direct", brickRef: hostile.brickRef, sourceBrickRef: null },
        claim: claim({
          stepNumber: 1,
          quantity: 1,
          partNum: hostile.partNum,
          elementId: "3005",
        }),
        official: hostileOfficial,
        calloutManifestDigest: BINDINGS.calloutManifestDigest,
      }),
      pieceRefusal({
        stepNumber: 1,
        calloutKey: hostile.calloutKey,
        identity: { kind: "direct", brickRef: "brick-a", sourceBrickRef: null },
        claim: { ...acceptedClaim, cropDigest: hostile.cropDigest },
        official: baseOfficial,
        calloutManifestDigest: BINDINGS.calloutManifestDigest,
      }),
      pieceRefusal({
        stepNumber: 1,
        calloutKey: hostile.calloutKey,
        identity: { kind: "direct", brickRef: "brick-a", sourceBrickRef: null },
        claim: { ...acceptedClaim, inputDigest: hostile.inputDigest },
        official: baseOfficial,
        calloutManifestDigest: hostile.manifestDigest,
      }),
    ];
    expect(reasons).not.toContain(null);
    const rendered = reasons.join("\n");
    for (const value of Object.values(hostile)) expect(rendered).not.toContain(value);
    for (const reason of reasons) expect(reason!.length).toBeLessThan(800);
    expect(rendered).toContain("...");
  });
});

describe("formatActionLedgerRefusalOutput", () => {
  const refusal = (stepNumber: number, reason: string): ActionLedgerRefusal => ({
    stepNumber,
    calloutKey: `callout-${stepNumber}`,
    brickRef: null,
    reason,
  });

  it("caps the number of printed refusals and reports the omitted count", () => {
    const output = formatActionLedgerRefusalOutput(
      [refusal(1, "first"), refusal(2, "second"), refusal(3, "third"), refusal(4, "fourth")],
      { maximumCount: 2, maximumCharacters: 2_048 },
    );
    expect(output).toContain("refused step 1: first");
    expect(output).toContain("refused step 2: second");
    expect(output).not.toContain("refused step 3");
    expect(output).toContain("2 additional refusals omitted");
    expect(output.length).toBeLessThanOrEqual(2_048);
  });

  it("caps total printed characters while preserving an omission count", () => {
    const output = formatActionLedgerRefusalOutput(
      [refusal(1, "a".repeat(120)), refusal(2, "b".repeat(120)), refusal(3, "c".repeat(120))],
      { maximumCount: 10, maximumCharacters: 256 },
    );
    expect(output).toContain("refused step 1");
    expect(output).not.toContain("refused step 2");
    expect(output).toContain("2 additional refusals omitted");
    expect(output.length).toBeLessThanOrEqual(256);
  });
});

describe("flattenOfficialBuilderIdentities", () => {
  it("returns every sequenced identity once, in Builder source order", () => {
    const official = calibratedOfficial([
      ["brick-a", "3005"],
      ["brick-b", "3004"],
    ]);
    expect(flattenOfficialBuilderIdentities(official)).toEqual([
      { kind: "direct", brickRef: "brick-a", sourceBrickRef: null },
      { kind: "direct", brickRef: "brick-b", sourceBrickRef: null },
    ]);
  });
});

describe("encodeRealBuildActionLedger", () => {
  it("emits reproducible bytes that carry the refusals as unauthenticated provenance", () => {
    const official = calibratedOfficial([["brick-a", "3005"]]);
    const panels = panelEvidence([1]);
    const assembled = assembleRealBuildActionLedger({
      official,
      bindings: BINDINGS,
      coverageByCallout: {
        "p1|q1|x1.000|y1.000": claim({
          stepNumber: 1,
          quantity: 1,
          partNum: "3005",
          confidence: "refused",
        }),
      },
      panelEvidenceByStep: panels,
      transitionClassificationsByStep: {},
      expectedPrintedSteps: 1,
    });
    const emitted = emittedRealBuildActionLedger(assembled, 1);
    expect(emitted.provenance.authenticated).toBe(false);
    expect(emitted.provenance.refusals).toHaveLength(1);
    expect(encodeRealBuildActionLedger(emitted).equals(encodeRealBuildActionLedger(emitted))).toBe(
      true,
    );
  });
});
