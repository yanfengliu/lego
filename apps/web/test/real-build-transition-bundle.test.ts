import { existsSync, readFileSync } from "node:fs";

import { describe, expect, test } from "vitest";

import {
  MANIFEST_PATH,
  readJsonArtifact,
  TRANSITION_CLASSIFICATIONS_PATH,
  type CalloutManifest,
  type TransitionClassificationBundle,
} from "../e2e/real-build-input-files";
import { readTransitionClassificationBundle } from "../e2e/real-build-transition-classification";
import type { StepFailure } from "../e2e/real-build-safety";

/**
 * The labelled sample this booklet's classifier was measured against.
 *
 * Every step listed here was rendered from its own panel bounds and looked at.
 * The 26 `transition` rows are the printed steps whose panel calls out no new
 * piece; the 12 `places-pieces` rows are ordinary steps sampled across the
 * booklet, two of them (124, 342) deliberately chosen because their panels
 * carry an assembly-action callout rather than a plain part callout.
 *
 * Steps 172, 188, 205, 250, 285 and 297 print the rotate-the-model icon and are
 * still labelled `attachment`: 33 of the 39 steps that print that icon also
 * place pieces, so it records the viewpoint, not the action.
 *
 * Step 359 is the one label that rests on a convention rather than on a cue —
 * its panel is drawn exactly like the other 25 placements, and it is called the
 * final view because it is the terminal printed step and the completed-model
 * plate on the next page carries no step number.
 */
const LABELLED_SAMPLE: Readonly<Record<number, "rotation" | "attachment" | "final-view" | null>> = {
  3: null,
  27: null,
  44: "attachment",
  58: null,
  69: "attachment",
  84: "attachment",
  92: "attachment",
  101: null,
  112: "attachment",
  123: "attachment",
  124: null,
  135: "attachment",
  146: "attachment",
  158: null,
  172: "attachment",
  180: "attachment",
  188: "attachment",
  196: "attachment",
  199: null,
  205: "attachment",
  214: "attachment",
  223: "attachment",
  230: "attachment",
  231: null,
  236: "attachment",
  247: "attachment",
  250: "attachment",
  258: null,
  285: "attachment",
  289: null,
  297: "attachment",
  310: "attachment",
  312: null,
  317: "attachment",
  325: "attachment",
  342: null,
  343: "attachment",
  359: "final-view",
};

const published = existsSync(TRANSITION_CLASSIFICATIONS_PATH);

describe.skipIf(!published)(`published ${TRANSITION_CLASSIFICATIONS_PATH}`, () => {
  const failures: StepFailure[] = [];
  const artifact = readJsonArtifact<TransitionClassificationBundle>(
    TRANSITION_CLASSIFICATIONS_PATH,
    failures,
  );

  test("is readable inside the real-build input byte policy", () => {
    expect(failures).toEqual([]);
    expect(artifact.digest).toMatch(/^sha256:[0-9a-f]{64}$/u);
  });

  test("is accepted by the live run contract, entry for entry", () => {
    const read = readTransitionClassificationBundle(artifact.value, artifact.value.pdfDigest ?? "");
    expect(read.rejections).toEqual([]);
    expect(read.entries.length).toBeGreaterThan(0);
    expect(Object.keys(read.byStep).length).toBe(read.entries.length);
  });

  test("binds the same booklet the callout manifest was published from", () => {
    if (!existsSync(MANIFEST_PATH)) {
      expect(artifact.value.pdfDigest).toMatch(/^sha256:[0-9a-f]{64}$/u);
      return;
    }
    const manifestFailures: StepFailure[] = [];
    const manifest = readJsonArtifact<CalloutManifest>(MANIFEST_PATH, manifestFailures);
    expect(manifestFailures).toEqual([]);
    expect(artifact.value.pdfDigest).toBe(manifest.value.sourceHash);
  });

  test("matches every label a person read off the rendered panels", () => {
    const byStep = readTransitionClassificationBundle(
      artifact.value,
      artifact.value.pdfDigest ?? "",
    ).byStep;
    const disagreements = Object.entries(LABELLED_SAMPLE)
      .map(([step, label]) => {
        const observed = byStep[Number(step)]?.transition ?? null;
        return observed === label
          ? null
          : `printed step ${step}: labelled ${label ?? "not a transition"}, classified ${observed ?? "not a transition"}`;
      })
      .filter((row): row is string => row !== null);
    expect(disagreements).toEqual([]);
  });

  test("claims nothing beyond the panels it reviewed", () => {
    const entries = artifact.value.entries ?? [];
    expect(
      entries.every(({ localClassification }) => localClassification.authenticated === false),
    ).toBe(true);
    expect(
      entries.every(
        ({ localClassification, panelEvidenceDigest }) =>
          localClassification.reasonCodes.includes("no-new-piece-callout") &&
          localClassification.reviewedPanelDigest === panelEvidenceDigest,
      ),
    ).toBe(true);
    expect(
      JSON.parse(readFileSync(TRANSITION_CLASSIFICATIONS_PATH, "utf8")).provenance,
    ).toMatchObject({ authenticated: false });
  });
});

test.skipIf(published)(
  `${TRANSITION_CLASSIFICATIONS_PATH} is absent, so only its contract is under test`,
  () => {
    expect(published).toBe(false);
  },
);
