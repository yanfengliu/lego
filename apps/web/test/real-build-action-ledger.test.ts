import { describe, expect, it } from "vitest";

import { sha256Digest } from "../e2e/real-build-artifacts";
import {
  assembleRealBuildActionLedger,
  emittedRealBuildActionLedger,
  encodeRealBuildActionLedger,
  flattenOfficialBuilderIdentities,
  type RealBuildActionLedgerBindings,
} from "../e2e/real-build-action-ledger";
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

function officialXml(designs: readonly (readonly [string, string])[]): Uint8Array {
  const bricks = designs
    .map(
      ([brickRef, designId], index) =>
        `<Brick uuid="${brickRef}" designID="${designId}" itemNos="${index + 1}0">` +
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
  designs: readonly (readonly [string, string])[],
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
    `<Brick uuid="${brickRef}" designID="3005" itemNos="10">` +
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
  readonly catalogPartId?: string;
}): CalloutResolution {
  return {
    pageNumber: input.stepNumber,
    stepNumber: input.stepNumber,
    quantity: input.quantity,
    identificationConfidence: input.confidence ?? "vision-kept",
    cropDigest: sha256Digest(`crop-${input.stepNumber}-${input.partNum}`),
    inputDigest: BINDINGS.calloutManifestDigest,
    elementId: `element-${input.partNum}`,
    resolution: {
      catalogPartId: input.catalogPartId ?? CATALOG_PART,
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
    expect(assembled.refusals[0]!.reason).toContain("only vision-kept callouts");
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
      "official identity copy-b is a MultiBuild copy of brick-a",
    );
    expect(assembled.refusals[1]!.reason).toContain(
      "callout p1|q2|x1.000|y1.000 prints 2 piece(s) but only 1 could be bound",
    );
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
