import { describe, expect, test } from "vitest";

import { sha256Digest } from "../e2e/real-build-artifacts";
import { validateRealBuildActionLedger } from "../e2e/real-build-ledger";
import { realBuildLedgerTestFixture } from "./real-build-ledger-test-fixture";
import PANEL_FACE_GROUND_TRUTH from "./fixtures/panel-face-ground-truth.json" with { type: "json" };
import {
  assembleTransitionClassificationBundle,
  buildTransitionClassificationEntry,
  classifyTransitionPanels,
  encodeTransitionClassificationBundle,
  readTransitionClassificationBundle,
  TRANSITION_CLASSIFICATIONS_SCHEMA,
  TRANSITION_UNAUTHENTICATED_CLASSIFICATION_SCHEMA,
  type TransitionClassifier,
  type TransitionClassifierProposal,
} from "../e2e/real-build-transition-classification";
import {
  derivePanelFaces,
  DETERMINISTIC_TRANSITION_CLASSIFIER_ID,
  deriveTransitionPanelFeatures,
  deterministicTransitionClassifier,
  proposeDeterministicTransition,
  ROTATION_ICON_FILL_HEX,
  ROTATION_ICON_SIDE_PT,
  type TransitionPanelFeatures,
} from "../e2e/real-build-transition-features";
import type { PageShape } from "../../web/src/instructions/page-shapes";
import type { StepPanel } from "../../web/src/instructions/step-panels";

const PDF_DIGEST = `sha256:${"a".repeat(64)}`;
const PANEL_DIGEST = `sha256:${"b".repeat(64)}`;
const OTHER_PANEL_DIGEST = `sha256:${"c".repeat(64)}`;
const TERMINAL_STEP = 359;

function features(overrides: Partial<TransitionPanelFeatures> = {}): TransitionPanelFeatures {
  return {
    stepNumber: 44,
    pageNumber: 45,
    panelEvidenceDigest: PANEL_DIGEST,
    newPieceCalloutCount: 0,
    isTerminalPrintedStep: false,
    panelFace: "studs-up",
    rotationIconPresent: false,
    ...overrides,
  };
}

function proposal(
  overrides: Partial<TransitionClassifierProposal> = {},
): TransitionClassifierProposal {
  return {
    decision: "attachment",
    classifierKind: "human-claim",
    notes: "A leader arrow ends on a highlighted subassembly and no piece is called out.",
    ...overrides,
  };
}

function entry(
  panel: TransitionPanelFeatures = features(),
  override: Partial<TransitionClassifierProposal> = {},
) {
  return buildTransitionClassificationEntry({
    panel,
    proposal: proposal(override),
    classifierId: DETERMINISTIC_TRANSITION_CLASSIFIER_ID,
  });
}

describe("deterministic transition classifier", () => {
  test("reads a mid-booklet panel with no piece callout as an attachment", () => {
    const decided = proposeDeterministicTransition(features());
    expect(decided?.decision).toBe("attachment");
    expect(decided?.classifierKind).toBe("human-claim");
    expect(decided?.notes).toContain("no Nx piece callout");
  });

  test("reads the terminal printed step as the final view", () => {
    const decided = proposeDeterministicTransition(
      features({ stepNumber: TERMINAL_STEP, pageNumber: 219, isTerminalPrintedStep: true }),
    );
    expect(decided?.decision).toBe("final-view");
  });

  test("declines a panel that still prints piece callouts", () => {
    expect(proposeDeterministicTransition(features({ newPieceCalloutCount: 2 }))).toBeNull();
  });

  /**
   * Measured on 6651557: the rotate icon is printed on 39 steps and 33 of them
   * place pieces, so it annotates the viewpoint rather than naming the action.
   * Reading it as a rotation decision would mislabel six placement steps.
   */
  test("does not turn the rotate-the-model icon into a rotation decision", () => {
    const withIcon = proposeDeterministicTransition(features({ rotationIconPresent: true }));
    expect(withIcon?.decision).toBe("attachment");
    expect(withIcon?.notes).toContain("rotate-the-model icon is printed");
    expect(withIcon?.notes).toContain("not the action");
  });

  test("states in its own notes that it cannot see the rotation cue", () => {
    expect(proposeDeterministicTransition(features())?.notes).toContain(
      "rotation-only step could not have been told apart",
    );
  });

  test("never proposes a rotation, because the cue that would prove one is raster", async () => {
    const decisions = await Promise.all(
      [true, false].flatMap((rotationIconPresent) =>
        [true, false].map(async (isTerminalPrintedStep) => {
          const decided = await deterministicTransitionClassifier(
            features({
              rotationIconPresent,
              isTerminalPrintedStep,
              stepNumber: isTerminalPrintedStep ? TERMINAL_STEP : 44,
            }),
          );
          return decided?.decision;
        }),
      ),
    );
    expect(decisions).not.toContain("rotation");
    expect(new Set(decisions)).toEqual(new Set(["attachment", "final-view"]));
  });
});

describe("transition panel features", () => {
  const panel = (stepNumber: number, pageNumber: number): StepPanel => ({
    stepNumber,
    pageNumber,
    bounds: { minXPt: 0, maxXPt: 400, minYPt: 0, maxYPt: 500 },
    labelXPt: 10,
    labelYPt: 480,
    quantities: [],
  });
  const icon = (minXPt: number, minYPt: number): PageShape => ({
    fillHex: ROTATION_ICON_FILL_HEX,
    bounds: {
      minXPt,
      minYPt,
      maxXPt: minXPt + ROTATION_ICON_SIDE_PT,
      maxYPt: minYPt + ROTATION_ICON_SIDE_PT,
    },
    pointCount: 4,
  });

  test("counts the piece callouts printed in each panel and finds the icon inside it", () => {
    const derived = deriveTransitionPanelFeatures({
      panels: [panel(2, 11), panel(1, 11)],
      calloutBoxesByStep: {
        1: [{ minXPt: 1, maxXPt: 2, minYPt: 1, maxYPt: 2 }],
        2: [],
      },
      panelEvidenceByStep: {
        1: { pageNumber: 11, digest: PANEL_DIGEST },
        2: { pageNumber: 11, digest: OTHER_PANEL_DIGEST },
      },
      shapesByPage: new Map([[11, [icon(30, 400), icon(1_000, 400)]]]),
      expectedPrintedSteps: 2,
    });
    expect(derived.map(({ stepNumber }) => stepNumber)).toEqual([1, 2]);
    expect(derived[0]!.newPieceCalloutCount).toBe(1);
    expect(derived[0]!.isTerminalPrintedStep).toBe(false);
    expect(derived[0]!.rotationIconPresent).toBe(true);
    expect(derived[1]!.newPieceCalloutCount).toBe(0);
    expect(derived[1]!.isTerminalPrintedStep).toBe(true);
  });

  test("ignores a same-page icon whose centre falls outside the panel", () => {
    const derived = deriveTransitionPanelFeatures({
      panels: [panel(1, 11)],
      calloutBoxesByStep: {},
      panelEvidenceByStep: { 1: { pageNumber: 11, digest: PANEL_DIGEST } },
      shapesByPage: new Map([[11, [icon(1_000, 400)]]]),
      expectedPrintedSteps: 1,
    });
    expect(derived[0]!.rotationIconPresent).toBe(false);
  });

  test("refuses a panel whose evidence digest is missing or names another page", () => {
    expect(() =>
      deriveTransitionPanelFeatures({
        panels: [panel(1, 11)],
        calloutBoxesByStep: {},
        panelEvidenceByStep: {},
        shapesByPage: new Map(),
        expectedPrintedSteps: 1,
      }),
    ).toThrow(/step 1 has a panel but no panel-evidence digest/);
    expect(() =>
      deriveTransitionPanelFeatures({
        panels: [panel(1, 11)],
        calloutBoxesByStep: {},
        panelEvidenceByStep: { 1: { pageNumber: 12, digest: PANEL_DIGEST } },
        shapesByPage: new Map(),
        expectedPrintedSteps: 1,
      }),
    ).toThrow(/is on page 11 but its panel evidence names page 12/);
  });

  test("refuses a printed step count that cannot name a terminal step", () => {
    expect(() =>
      deriveTransitionPanelFeatures({
        panels: [],
        calloutBoxesByStep: {},
        panelEvidenceByStep: {},
        shapesByPage: new Map(),
        expectedPrintedSteps: 0,
      }),
    ).toThrow(/printed step count as a positive integer/);
  });
});

describe("the deterministic disposer", () => {
  test("derives the reason codes and claim id, so the record cannot disagree with itself", () => {
    const built = entry();
    expect(built.localClassification.reasonCodes).toEqual([
      "attachment-cue",
      "no-new-piece-callout",
    ]);
    expect(built.localClassification.authenticated).toBe(false);
    expect(built.localClassification.schemaVersion).toBe(
      TRANSITION_UNAUTHENTICATED_CLASSIFICATION_SCHEMA,
    );
    expect(built.localClassification.classifierClaimId).toMatch(/^sha256:[0-9a-f]{64}$/u);
    expect(built.evidenceDigest).not.toBe(built.panelEvidenceDigest);
  });

  test("gives a different claim id to a different decision on the same panel", () => {
    const attachment = entry(features({ isTerminalPrintedStep: true }));
    const finalView = entry(features({ isTerminalPrintedStep: true }), { decision: "final-view" });
    expect(attachment.localClassification.classifierClaimId).not.toBe(
      finalView.localClassification.classifierClaimId,
    );
  });

  test("refuses a transition claim on a panel that prints piece callouts", () => {
    expect(() => entry(features({ newPieceCalloutCount: 3 }))).toThrow(
      /step 44 prints 3 piece callout\(s\).*place-callouts action in the action ledger/su,
    );
  });

  test("refuses a final-view claim on a step that is not the last printed one", () => {
    expect(() => entry(features(), { decision: "final-view" })).toThrow(
      /step 44, which is not the last printed step.*propose rotation or attachment instead/su,
    );
  });

  test("refuses an unknown decision, an unknown claim kind, and thin notes", () => {
    expect(() =>
      entry(features(), { decision: "rotate" as TransitionClassifierProposal["decision"] }),
    ).toThrow(/proposed "rotate".*rotation, attachment, final-view/su);
    expect(() =>
      entry(features(), {
        classifierKind: "broker" as TransitionClassifierProposal["classifierKind"],
      }),
    ).toThrow(/declared kind "broker".*human-claim or model-claim/su);
    expect(() => entry(features(), { notes: "too short" })).toThrow(
      /needs notes of 12\.\.2000 characters.*received 9 trimmed characters/su,
    );
  });

  test("refuses a panel digest that is not a sha256 digest, or a nonsense step or page", () => {
    expect(() => entry(features({ panelEvidenceDigest: "sha256:nope" }))).toThrow(
      /panelEvidenceDigest "sha256:nope".*Bind the panel digest/su,
    );
    expect(() => entry(features({ stepNumber: 0 }))).toThrow(/printed step number of 1 or more/u);
    expect(() => entry(features({ pageNumber: -3 }))).toThrow(/1-based booklet page/u);
  });
});

describe("the model seam", () => {
  const panels = [
    features({ stepNumber: 44, pageNumber: 45 }),
    features({ stepNumber: 69, pageNumber: 66, panelEvidenceDigest: OTHER_PANEL_DIGEST }),
    features({ stepNumber: 70, pageNumber: 67, newPieceCalloutCount: 2 }),
  ];

  test("accepts a mocked model classifier through the same interface", async () => {
    const seen: number[] = [];
    const model: TransitionClassifier<TransitionPanelFeatures> = async (panel) => {
      seen.push(panel.stepNumber);
      return {
        decision: "attachment",
        classifierKind: "model-claim",
        notes: `Vision call read a placement arrow on the panel of step ${panel.stepNumber}.`,
      };
    };
    const { entries, unclassified } = await classifyTransitionPanels({
      panels,
      classifier: model,
      classifierId: "test.mock-vision/1",
    });
    expect(seen).toEqual([44, 69]);
    expect(unclassified).toEqual([]);
    expect(entries.map(({ localClassification }) => localClassification.classifierKind)).toEqual([
      "model-claim",
      "model-claim",
    ]);
    expect(entries.every(({ localClassification }) => !localClassification.authenticated)).toBe(
      true,
    );
  });

  test("records a declined panel as unclassified instead of guessing", async () => {
    const { entries, unclassified } = await classifyTransitionPanels({
      panels,
      classifier: async (panel) => (panel.stepNumber === 44 ? null : proposal()),
      classifierId: "test.mock-vision/1",
    });
    expect(entries.map(({ stepNumber }) => stepNumber)).toEqual([69]);
    expect(unclassified).toEqual([
      {
        stepNumber: 44,
        reason: expect.stringContaining("declined printed step 44") as unknown as string,
      },
    ]);
  });

  test("isolates a classifier that throws, and keeps the other panels", async () => {
    const { entries, unclassified } = await classifyTransitionPanels({
      panels,
      classifier: async (panel) => {
        if (panel.stepNumber === 44) throw new Error("provider refused the request");
        return proposal();
      },
      classifierId: "test.mock-vision/1",
    });
    expect(entries.map(({ stepNumber }) => stepNumber)).toEqual([69]);
    expect(unclassified[0]?.reason).toContain("provider refused the request");
  });

  test("records a proposal the disposer refuses as unclassified, naming the reason", async () => {
    const { entries, unclassified } = await classifyTransitionPanels({
      panels,
      classifier: async () => proposal({ decision: "final-view" }),
      classifierId: "test.mock-vision/1",
    });
    expect(entries).toEqual([]);
    expect(unclassified.map(({ stepNumber }) => stepNumber)).toEqual([44, 69]);
    expect(unclassified[0]?.reason).toContain("not the last printed step");
  });
});

describe("bundle assembly", () => {
  const bundleOf = (steps: readonly number[]) =>
    assembleTransitionClassificationBundle({
      pdfDigest: PDF_DIGEST,
      classifierId: DETERMINISTIC_TRANSITION_CLASSIFIER_ID,
      printedStepCount: TERMINAL_STEP,
      unclassifiedSteps: [],
      entries: steps.map((stepNumber) =>
        entry(
          features({
            stepNumber,
            panelEvidenceDigest: `sha256:${String(stepNumber).padStart(64, "0")}`,
          }),
        ),
      ),
    });

  test("sorts entries, declares the schema, and repeats that it is unauthenticated", () => {
    const bundle = bundleOf([69, 44]);
    expect(bundle.schemaVersion).toBe(TRANSITION_CLASSIFICATIONS_SCHEMA);
    expect(bundle.entries.map(({ stepNumber }) => stepNumber)).toEqual([44, 69]);
    expect(bundle.provenance.authenticated).toBe(false);
    expect(bundle.provenance.transitionStepCount).toBe(2);
  });

  test("encodes the same input to the same bytes", () => {
    expect(encodeTransitionClassificationBundle(bundleOf([44, 69]))).toEqual(
      encodeTransitionClassificationBundle(bundleOf([69, 44])),
    );
  });

  test("refuses an empty bundle and a repeated step", () => {
    expect(() =>
      assembleTransitionClassificationBundle({
        pdfDigest: PDF_DIGEST,
        classifierId: DETERMINISTIC_TRANSITION_CLASSIFIER_ID,
        printedStepCount: TERMINAL_STEP,
        unclassifiedSteps: [],
        entries: [],
      }),
    ).toThrow(/must contain at least one entry/u);
    expect(() =>
      assembleTransitionClassificationBundle({
        pdfDigest: PDF_DIGEST,
        classifierId: DETERMINISTIC_TRANSITION_CLASSIFIER_ID,
        printedStepCount: TERMINAL_STEP,
        unclassifiedSteps: [],
        entries: [entry(), entry()],
      }),
    ).toThrow(/steps \[44\] repeat/u);
  });

  test("refuses a bundle that is not bound to one exact booklet", () => {
    expect(() =>
      assembleTransitionClassificationBundle({
        pdfDigest: "sha256:short",
        classifierId: DETERMINISTIC_TRANSITION_CLASSIFIER_ID,
        printedStepCount: TERMINAL_STEP,
        unclassifiedSteps: [],
        entries: [entry()],
      }),
    ).toThrow(/must bind one exact booklet digest/u);
  });

  /** The run contract re-hashes the entry as JSON parsed back out of the file. */
  test("reproduces every claim digest through a JSON round trip", () => {
    const encoded = encodeTransitionClassificationBundle(bundleOf([44, 69, 359]));
    const parsed = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(encoded));
    expect(readTransitionClassificationBundle(parsed, PDF_DIGEST).rejections).toEqual([]);
  });
});

/**
 * The other half of the contract: the action ledger looks these entries up by
 * step and re-derives their digest. A bundle the input contract accepts but the
 * ledger rejects would still leave the run input-rejected, so both sides are
 * driven from one builder here.
 */
describe("consumption by the action ledger", () => {
  test("accepts transitions this builder produced for the ledger's own panels", () => {
    const fixture = realBuildLedgerTestFixture();
    const built = new Map<number, ReturnType<typeof buildTransitionClassificationEntry>>();
    const steps = fixture.ledger.steps.map((step) => {
      if (step.action.kind !== "transition") return step;
      const panel: TransitionPanelFeatures = {
        stepNumber: step.stepNumber,
        pageNumber: step.pageNumber,
        panelEvidenceDigest: step.panelEvidenceDigest,
        newPieceCalloutCount: 0,
        isTerminalPrintedStep: step.stepNumber === TERMINAL_STEP,
        panelFace: "studs-up",
        rotationIconPresent: step.stepNumber % 7 === 0,
      };
      const decided = proposeDeterministicTransition(panel);
      if (decided === null) throw new Error(`classifier declined fixture step ${step.stepNumber}`);
      const evidence = buildTransitionClassificationEntry({
        panel,
        proposal: decided,
        classifierId: DETERMINISTIC_TRANSITION_CLASSIFIER_ID,
      });
      built.set(step.stepNumber, evidence);
      return {
        ...step,
        action: {
          ...step.action,
          transition: evidence.transition,
          classificationEvidenceDigest: evidence.evidenceDigest,
        },
      };
    });
    const ledger = { ...fixture.ledger, steps };
    expect(built.size).toBeGreaterThan(0);
    expect(
      validateRealBuildActionLedger({
        ledger,
        ledgerDigest: sha256Digest(JSON.stringify(ledger)),
        requestedLastStep: TERMINAL_STEP,
        lastStep: TERMINAL_STEP,
        official: fixture.official,
        pdfDigest: fixture.pdfDigest,
        coverageDigest: fixture.coverageDigest,
        calloutManifestDigest: fixture.manifestDigest,
        builderCalibrationDigest: fixture.builderCalibrationDigest,
        transitionClassificationsDigest: fixture.transitionClassificationsDigest,
        coverageByCallout: fixture.coverageByCallout,
        panelEvidenceByStep: fixture.panelEvidenceByStep,
        transitionClassificationsByStep: Object.fromEntries(built),
      }),
    ).toEqual([]);
  });
});

describe("derivePanelFaces", () => {
  /**
   * The measured opening of 6651557. Printed steps 1 to 12, with the icon on 4,
   * 5, 7, 8, 10 and 12, read off pages 11 to 15 by eye as up up up UNDER up up
   * UNDER up up UNDER UNDER up.
   *
   * Step 8 is the one that matters: its icon is on the same page as step 7's,
   * and it was invisible until extractPageShapes stopped leaking fill colour
   * across a restore. Without it the fold reports steps 8 and 9 as underside
   * and every later face is inverted.
   */
  const OPENING = [4, 5, 7, 8, 10, 12];

  function opening(iconSteps: readonly number[]) {
    return Array.from({ length: 12 }, (_unused, index) => ({
      stepNumber: index + 1,
      rotationIconPresent: iconSteps.includes(index + 1),
    }));
  }

  test("folds the booklet's opening icons into the faces its pages are drawn from", () => {
    expect(derivePanelFaces(opening(OPENING)).map(({ panelFace }) => panelFace)).toEqual([
      "studs-up",
      "studs-up",
      "studs-up",
      "underside",
      "studs-up",
      "studs-up",
      "underside",
      "studs-up",
      "studs-up",
      "underside",
      "underside",
      "studs-up",
    ]);
  });

  test("inverts every later face when one icon is missed", () => {
    const missed = derivePanelFaces(opening(OPENING.filter((step) => step !== 8)));
    const complete = derivePanelFaces(opening(OPENING));
    const diverged = complete.filter(
      (entry, index) => entry.panelFace !== missed[index]!.panelFace,
    );

    // Not "some steps are wrong", and not a span either: a missed icon inverts
    // the parity of every step after it, to the end of the booklet. Later icons
    // keep toggling, but from the wrong phase, so they never resynchronise.
    // That is why one dropped icon is a whole-build failure and not a local one.
    expect(diverged.map(({ stepNumber }) => stepNumber)).toEqual([8, 9, 10, 11, 12]);
  });

  test("carries a face forward across steps that print no icon", () => {
    expect(
      derivePanelFaces([
        { stepNumber: 1, rotationIconPresent: true },
        { stepNumber: 2, rotationIconPresent: false },
        { stepNumber: 3, rotationIconPresent: false },
      ]).map(({ panelFace }) => panelFace),
    ).toEqual(["underside", "underside", "underside"]);
  });

  test("takes an explicit seed, so one judged panel can fix the phase of the rest", () => {
    const steps = [
      { stepNumber: 1, rotationIconPresent: false },
      { stepNumber: 2, rotationIconPresent: true },
    ];

    expect(derivePanelFaces(steps, "underside").map(({ panelFace }) => panelFace)).toEqual([
      "underside",
      "studs-up",
    ]);
  });

  test("folds in printed order however the steps arrive", () => {
    const shuffled = [
      { stepNumber: 3, rotationIconPresent: false },
      { stepNumber: 1, rotationIconPresent: false },
      { stepNumber: 2, rotationIconPresent: true },
    ];

    expect(derivePanelFaces(shuffled)).toEqual([
      { stepNumber: 1, panelFace: "studs-up" },
      { stepNumber: 2, panelFace: "underside" },
      { stepNumber: 3, panelFace: "underside" },
    ]);
  });
});

describe("panel faces against a blind reading of the pages", () => {
  const TRUTH = PANEL_FACE_GROUND_TRUTH;
  const faceOf = (step: number): string => (TRUTH.faces as Record<string, string>)[String(step)]!;
  const steps = Object.keys(TRUTH.faces)
    .map(Number)
    .sort((left, right) => left - right);

  test("keeps the two raters' own verdicts, not just their summary", () => {
    // The summary is the thing that cannot be checked. Every panel carries both
    // raters' answers and the feature each named, so a claim of independence is
    // inspectable rather than asserted — this repo's identification trust model
    // already refuses anything that enters a list by asserting itself.
    expect(TRUTH.verdicts).toHaveLength(steps.length);
    for (const verdict of TRUTH.verdicts) {
      expect(verdict.raterA.evidence.length).toBeGreaterThan(20);
      expect(verdict.raterB.evidence.length).toBeGreaterThan(20);
      expect(verdict.raterA.evidence).not.toBe(verdict.raterB.evidence);
    }
    const agreed = TRUTH.verdicts.filter(
      (verdict) => verdict.raterA.face === verdict.raterB.face,
    ).length;
    expect(agreed / TRUTH.verdicts.length).toBeCloseTo(TRUTH.interRaterAgreement, 4);
    expect(
      Object.fromEntries(TRUTH.verdicts.map((v) => [String(v.stepNumber), v.raterA.face])),
    ).toEqual(TRUTH.faces);
  });

  test("states the baseline that makes its agreement rate readable", () => {
    // 38 of 43 panels are studs-up, so answering studs-up every time scores
    // 0.8837. Quoting a perfect agreement without that number overstates it by
    // a lot, and the whole question lives on the five minority panels.
    const counts = new Map<string, number>();
    for (const face of Object.values(TRUTH.faces)) counts.set(face, (counts.get(face) ?? 0) + 1);
    const majority = Math.max(...counts.values()) / steps.length;

    expect(majority).toBeCloseTo(TRUTH.majorityClassShare, 4);
    expect(TRUTH.minorityPanels.length).toBe(steps.length - Math.max(...counts.values()));
    expect(TRUTH.minorityPanels.every((step) => faceOf(step) === "underside")).toBe(true);
    // The claim worth making is about these five, not about all 43.
    expect(TRUTH.minorityPanels).toEqual([4, 7, 10, 11, 16]);
  });

  test("agrees with the fold on the minority panels, which is where it can disagree", () => {
    // Deliberately scored on the minority alone. Over all 43 this comparison is
    // near-vacuous: both sides are studs-up on 38 of them, so it would report
    // 0.88 even if the fold were replaced by a constant.
    const iconSteps = new Set<number>(TRUTH.iconSteps);
    const folded = new Map(
      derivePanelFaces(
        steps.map((stepNumber) => ({ stepNumber, rotationIconPresent: iconSteps.has(stepNumber) })),
      ).map(({ stepNumber, panelFace }) => [stepNumber, panelFace]),
    );

    const constant = steps.filter((step) => faceOf(step) === "studs-up").length;
    expect(constant / steps.length).toBeCloseTo(TRUTH.majorityClassShare, 4);

    for (const step of TRUTH.minorityPanels) expect(folded.get(step)).toBe("underside");
    const wrong = steps.filter((step) => folded.get(step) !== faceOf(step));
    expect(wrong).toEqual([]);
  });

  test("inverts the minority panels when any single icon is dropped", () => {
    for (const dropped of TRUTH.iconSteps) {
      const iconSteps = new Set(TRUTH.iconSteps.filter((step) => step !== dropped));
      const folded = derivePanelFaces(
        steps.map((stepNumber) => ({ stepNumber, rotationIconPresent: iconSteps.has(stepNumber) })),
      );
      const firstWrong = folded.findIndex((entry) => entry.panelFace !== faceOf(entry.stepNumber));

      // Every step at or after the dropped icon inverts and never recovers.
      expect(firstWrong).toBe(steps.indexOf(dropped));
    }
  });
});
