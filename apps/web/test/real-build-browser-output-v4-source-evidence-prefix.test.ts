import { describe, expect, it } from "vitest";

import { bindRealBuildBrowserOutputV4SourceEvidencePreparedRun } from "../e2e/real-build-browser-output-v4-source-evidence-prepared";
import {
  inspectRealBuildPreparedPanelFromRunInput,
  inspectRealBuildPreparedRunInput,
} from "../e2e/real-build-prepared-step-authority";
import { encodeRealBuildPreparedRunInput } from "../e2e/real-build-prepared-run-input-parser";
import {
  SOURCE_EVIDENCE_TEST_PDF_DIGEST as PDF_DIGEST,
  SOURCE_EVIDENCE_TEST_PREPARED_OPTIONS as PREPARED_OPTIONS,
  SOURCE_EVIDENCE_TEST_PREPARED_RUN as PREPARED_RUN,
  SOURCE_EVIDENCE_TEST_SOURCE_PANELS as SOURCE_PANELS,
} from "./real-build-browser-output-v4-source-evidence-fixture";

function preparedWithPanelChange(index: number) {
  const panels = PREPARED_OPTIONS.panels.map((panel, panelIndex) =>
    panelIndex === index ? { ...panel, minXPt: panel.minXPt + 0.25 } : panel,
  );
  const passivePanels = PREPARED_OPTIONS.passivePanels.map((panel) =>
    panel.stepNumber === index + 1 ? { ...panel, minXPt: panel.minXPt + 0.25 } : panel,
  );
  return inspectRealBuildPreparedRunInput(
    encodeRealBuildPreparedRunInput({ ...PREPARED_OPTIONS, panels, passivePanels }),
  );
}

describe("browser-output /4 prepared prefix against full source index", () => {
  it("binds 1..50 while retaining all 359 source labels", () => {
    expect(PREPARED_RUN.lastStep).toBe(50);
    expect(SOURCE_PANELS).toHaveLength(359);
    expect(
      bindRealBuildBrowserOutputV4SourceEvidencePreparedRun(PREPARED_RUN, SOURCE_PANELS),
    ).toEqual({
      preparedRunInputDigest: PREPARED_RUN.preparedRunInputDigest,
      pdfDigest: PDF_DIGEST,
    });
    expect(inspectRealBuildPreparedPanelFromRunInput(PREPARED_RUN, 50).stepNumber).toBe(50);
    expect(() => inspectRealBuildPreparedPanelFromRunInput(PREPARED_RUN, 51)).toThrow(
      /beyond requested lastStep 50/iu,
    );
  });

  it("binds passive geometry without turning a source-only suffix row into prepared authority", () => {
    const changedAbovePrefix = preparedWithPanelChange(50);
    expect(() =>
      bindRealBuildBrowserOutputV4SourceEvidencePreparedRun(changedAbovePrefix, SOURCE_PANELS),
    ).toThrow(/source evidence step 51 does not equal its exact prepared-run/iu);
    expect(() => inspectRealBuildPreparedPanelFromRunInput(changedAbovePrefix, 51)).toThrow(
      /beyond requested lastStep 50/iu,
    );

    expect(() =>
      bindRealBuildBrowserOutputV4SourceEvidencePreparedRun(
        preparedWithPanelChange(49),
        SOURCE_PANELS,
      ),
    ).toThrow(/source evidence step 50 does not equal its exact prepared-run/iu);
    expect(() =>
      bindRealBuildBrowserOutputV4SourceEvidencePreparedRun(
        PREPARED_RUN,
        SOURCE_PANELS.slice(0, 50),
      ),
    ).toThrow(/complete 359-panel source\/index container/iu);
  });
});
