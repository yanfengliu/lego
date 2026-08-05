import type { InstructionSourceV1 } from "../src/instructions/instruction-source";
import type { PanelCalloutBox, StepPanel } from "../src/instructions/step-panels";

import { sampleBookletCalloutBoxes, sampleBookletPanels } from "./booklet-fixture";
import { stepPanelEvidenceDigest } from "./real-build-ledger";

/**
 * The one derivation of "which printed step owns which piece of which page".
 *
 * The real-build probe and every publisher that has to name a panel must agree
 * byte for byte, because `stepPanelEvidenceDigest` binds the panel bounds and
 * the callout boxes inside them: a second derivation that rounds a cut
 * differently produces a different digest for the same printed step, and the
 * action ledger then rejects a classification that was in fact about the very
 * same panel. So the derivation lives here once and both callers import it.
 */

export interface PanelEvidenceEntry {
  readonly pageNumber: number;
  readonly digest: string;
}

export interface RealBuildPanelEvidence {
  readonly panels: readonly StepPanel[];
  readonly calloutBoxesByStep: Readonly<Record<number, readonly PanelCalloutBox[]>>;
  readonly panelEvidenceByStep: Readonly<Record<number, PanelEvidenceEntry>>;
}

/**
 * Callout boxes must be found before panels, because a row cut is placed above
 * the callout box between two steps rather than at the midpoint between their
 * step numbers. Panels are therefore derived twice: once coarsely to learn
 * which pages carry steps at all, then again with the boxes those pages hold.
 */
export async function deriveRealBuildPanelEvidence(input: {
  readonly pdfBytes: Buffer;
  readonly source: InstructionSourceV1;
  readonly pdfDigest: string;
}): Promise<RealBuildPanelEvidence> {
  if (!/^sha256:[0-9a-f]{64}$/u.test(input.pdfDigest)) {
    throw new TypeError(
      `Panel evidence must be bound to one exact booklet digest of the form sha256:<64 hex>; received ` +
        `${JSON.stringify(input.pdfDigest)}. Hash the same bytes the probe ingested.`,
    );
  }
  const coarsePanels = sampleBookletPanels(input.source);
  const probedPages = [...new Set(coarsePanels.map(({ pageNumber }) => pageNumber))];
  const boxesByPage = await sampleBookletCalloutBoxes(input.pdfBytes, input.source, probedPages);
  const panels = sampleBookletPanels(
    input.source,
    new Map(
      [...boxesByPage].map(([pageNumber, entries]) => [pageNumber, entries.map(({ box }) => box)]),
    ),
  );
  const calloutBoxesByStep = Object.fromEntries(
    panels.map((panel) => {
      const boxes = (boxesByPage.get(panel.pageNumber) ?? [])
        .filter(
          ({ labelXPt, labelYPt }) =>
            labelXPt >= panel.bounds.minXPt &&
            labelXPt < panel.bounds.maxXPt &&
            labelYPt >= panel.bounds.minYPt &&
            labelYPt < panel.bounds.maxYPt,
        )
        .map(({ box }) => box);
      return [panel.stepNumber, boxes] as const;
    }),
  );
  const panelEvidenceByStep = Object.fromEntries(
    panels.map((panel) => [
      panel.stepNumber,
      {
        pageNumber: panel.pageNumber,
        digest: stepPanelEvidenceDigest({
          pdfDigest: input.pdfDigest,
          stepNumber: panel.stepNumber,
          pageNumber: panel.pageNumber,
          bounds: panel.bounds,
          calloutBoxes: calloutBoxesByStep[panel.stepNumber] ?? [],
        }),
      },
    ]),
  );
  return { panels, calloutBoxesByStep, panelEvidenceByStep };
}
