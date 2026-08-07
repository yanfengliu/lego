import { expect, test } from "@playwright/test";

import {
  extractPageShapes,
  type OperatorList,
  type PageShape,
} from "../src/instructions/page-shapes";

import PANEL_FACE_GROUND_TRUTH from "../test/fixtures/panel-face-ground-truth.json" with { type: "json" };
import { readSampleBooklet } from "./booklet-fixture";
import { sha256Digest } from "./real-build-artifacts";
import { deriveRealBuildPanelEvidence } from "./real-build-panel-evidence";
import { derivePanelFaces, deriveTransitionPanelFeatures } from "./real-build-transition-features";
import { hasSampleBooklet } from "./sample-booklet";

/**
 * Binds the panel-face fixture to the booklet it claims to describe.
 *
 * Without this the fixture is only self-consistent: its `faces` agree with the
 * fold of its own `iconSteps`, and its raters' verdicts agree with both, but
 * nothing connects any of it to a printed page. That is the shape the repo's
 * identification trust model exists to refuse — a record that enters a list by
 * asserting itself. This runs the live detector over the real PDF and checks
 * the icons the fixture claims are the icons the booklet prints.
 *
 * It is the test that fails when `extractPageShapes` stops restoring fill
 * colour across a save, which is the regression the fixture was written for:
 * the second icon on a page goes back to reading `#000000`, step 8 disappears,
 * and the parity of every later panel inverts.
 */
const EXPECTED_PRINTED_STEPS = 359;

test("reproduces the fixture's icons from the booklet itself", async () => {
  test.setTimeout(900_000);
  test.skip(!hasSampleBooklet, "no sample booklet");

  const { bytes, source } = await readSampleBooklet();
  const evidence = await deriveRealBuildPanelEvidence({
    pdfBytes: bytes,
    source,
    pdfDigest: sha256Digest(bytes),
  });

  const { getDocument, OPS } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const document = await getDocument({ data: new Uint8Array(bytes), isEvalSupported: false })
    .promise;
  const shapesByPage = new Map<number, readonly PageShape[]>();
  try {
    const codes = {
      setFillRGBColor: OPS.setFillRGBColor,
      constructPath: OPS.constructPath,
      fill: OPS.fill,
      eoFill: OPS.eoFill,
      fillStroke: OPS.fillStroke,
      save: OPS.save,
      restore: OPS.restore,
      transform: OPS.transform,
    };
    for (const pageNumber of [...new Set(evidence.panels.map((panel) => panel.pageNumber))]) {
      const page = await document.getPage(pageNumber);
      shapesByPage.set(
        pageNumber,
        extractPageShapes((await page.getOperatorList()) as unknown as OperatorList, codes),
      );
    }
  } finally {
    await document.destroy();
  }

  const features = deriveTransitionPanelFeatures({
    panels: evidence.panels,
    calloutBoxesByStep: evidence.calloutBoxesByStep,
    panelEvidenceByStep: evidence.panelEvidenceByStep,
    shapesByPage,
    expectedPrintedSteps: EXPECTED_PRINTED_STEPS,
  });

  const judged = Object.keys(PANEL_FACE_GROUND_TRUTH.faces)
    .map(Number)
    .sort((left, right) => left - right);
  const lastJudged = judged.at(-1)!;
  const detected = features
    .filter((feature) => feature.rotationIconPresent && feature.stepNumber <= lastJudged)
    .map((feature) => feature.stepNumber);

  // The fixture's icon list is what the booklet prints, not what it was written
  // with. Step 8 is the one that only appears once fill colour survives a
  // restore, and it is the one whose loss inverts everything after it.
  expect(detected).toEqual(PANEL_FACE_GROUND_TRUTH.iconSteps);
  expect(detected).toContain(8);

  // And the faces the two raters read off the pages are what folding those
  // printed icons gives, over the steps they judged.
  const faces = new Map(
    derivePanelFaces(features.filter((feature) => feature.stepNumber <= lastJudged)).map(
      ({ stepNumber, panelFace }) => [stepNumber, panelFace],
    ),
  );
  const judgedFaces = PANEL_FACE_GROUND_TRUTH.faces as Record<string, string>;
  const disagreements = judged.filter((step) => faces.get(step) !== judgedFaces[String(step)]);
  expect(disagreements).toEqual([]);

  // Scored where it can actually be wrong: 38 of the 43 judged panels are
  // studs-up, so agreement over all of them would read 0.88 for a fold replaced
  // by a constant. The minority panels are the claim.
  for (const step of PANEL_FACE_GROUND_TRUTH.minorityPanels) {
    expect(faces.get(step)).toBe("underside");
  }
  expect(features.filter((feature) => feature.rotationIconPresent)).toHaveLength(43);
});
