import { readFileSync } from "node:fs";

import { expect, test } from "@playwright/test";

import {
  extractPageShapes,
  type OperatorList,
  type PageShape,
} from "../src/instructions/page-shapes";

import { readSampleBooklet } from "./booklet-fixture";
import { writeContainedRegularFileAtomic } from "./contained-atomic-write";
import { sha256Digest } from "./real-build-artifacts";
import { TRANSITION_CLASSIFICATIONS_PATH } from "./real-build-input-files";
import { deriveRealBuildPanelEvidence } from "./real-build-panel-evidence";
import {
  assembleTransitionClassificationBundle,
  classifyTransitionPanels,
  encodeTransitionClassificationBundle,
  readTransitionClassificationBundle,
} from "./real-build-transition-classification";
import {
  DETERMINISTIC_TRANSITION_CLASSIFIER_ID,
  deriveTransitionPanelFeatures,
  deterministicTransitionClassifier,
} from "./real-build-transition-features";
import { hasSampleBooklet } from "./sample-booklet";

/**
 * Publishes `output/real-build/transition-classifications.json`.
 *
 * Opt-in, because it reads the 70MiB uncommitted booklet and writes a real-build
 * input. The contract that consumes the file is checked in Vitest against the
 * same functions the real-build probe uses, so the gate does not depend on this
 * spec having been run.
 */

const EXPECTED_PRINTED_STEPS = 359;
/**
 * Deliberately not `LEGO_REAL_BUILD_TRANSITIONS`: that name already redirects the
 * *path* this input is read from, and reusing it as a flag wrote the bundle to a
 * file called `1` in the repository root while every assertion still passed.
 */
const PUBLISH = process.env.LEGO_REAL_BUILD_PUBLISH_TRANSITIONS === "1";

test("publishes the booklet's transition classifications", async () => {
  test.setTimeout(900_000);
  test.skip(
    !PUBLISH,
    `set LEGO_REAL_BUILD_PUBLISH_TRANSITIONS=1 to republish ${TRANSITION_CLASSIFICATIONS_PATH}`,
  );
  test.skip(!hasSampleBooklet, "no sample booklet");

  const { bytes, source } = await readSampleBooklet();
  const pdfDigest = sha256Digest(bytes);
  const evidence = await deriveRealBuildPanelEvidence({ pdfBytes: bytes, source, pdfDigest });
  expect(evidence.panels.length).toBe(EXPECTED_PRINTED_STEPS);

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
  const { entries, unclassified } = await classifyTransitionPanels({
    panels: features,
    classifier: deterministicTransitionClassifier,
    classifierId: DETERMINISTIC_TRANSITION_CLASSIFIER_ID,
  });
  const bundle = assembleTransitionClassificationBundle({
    pdfDigest,
    classifierId: DETERMINISTIC_TRANSITION_CLASSIFIER_ID,
    printedStepCount: features.length,
    unclassifiedSteps: unclassified.map(({ stepNumber }) => stepNumber),
    entries,
  });
  const encoded = encodeTransitionClassificationBundle(bundle);

  // Re-read the emitted bytes through the live contract before they are written,
  // so a bundle the real-build probe would reject never reaches the output root.
  const reread = readTransitionClassificationBundle(
    JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(encoded)),
    pdfDigest,
  );
  expect(reread.rejections).toEqual([]);
  expect(Object.keys(reread.byStep).length).toBe(entries.length);

  const written = writeContainedRegularFileAtomic(
    process.cwd(),
    TRANSITION_CLASSIFICATIONS_PATH,
    encoded,
    {
      label: `Transition classification bundle ${TRANSITION_CLASSIFICATIONS_PATH}`,
      replace: true,
    },
  );
  const transitionSteps = features.filter(({ newPieceCalloutCount }) => newPieceCalloutCount === 0);
  const rotationIconSteps = features.filter(({ rotationIconPresent }) => rotationIconPresent);
  expect(written.replaceAll("\\", "/").endsWith(TRANSITION_CLASSIFICATIONS_PATH)).toBe(true);
  expect(readFileSync(written).equals(encoded)).toBe(true);
  process.stdout.write(
    `${written.replaceAll("\\", "/")}: ${entries.length} classified, ` +
      `${unclassified.length} unclassified, of ${transitionSteps.length} zero-callout steps in ` +
      `${features.length} printed steps; rotate icon on ${rotationIconSteps.length} steps ` +
      `(${rotationIconSteps.filter(({ newPieceCalloutCount }) => newPieceCalloutCount > 0).length} of them ` +
      `place pieces); file digest ${sha256Digest(encoded)}\n`,
  );
  for (const step of unclassified) process.stdout.write(`  unclassified ${step.reason}\n`);
});
