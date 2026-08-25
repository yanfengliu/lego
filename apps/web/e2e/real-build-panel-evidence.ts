import { createHash } from "node:crypto";

import { canonicalDigest } from "@lego-studio/brick-kernel";

import {
  INSTRUCTION_PDF_LIMITS,
  type InstructionSourceV1,
} from "../src/instructions/instruction-source";
import type { PanelCalloutBox, StepPanel } from "../src/instructions/step-panels";

import {
  sampleBookletCalloutBoxes,
  sampleBookletPanelIndex,
  sampleBookletPanels,
  sampleBookletPanelsForPages,
} from "./booklet-fixture";
import { snapshotDenseDataArray, snapshotExactDataObject } from "./bounded-data-snapshot";
import { snapshotBoundedInstructionSource } from "./bounded-instruction-source";
import { snapshotBoundedUint8Array } from "./bounded-uint8-snapshot";
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

export interface CallerSourcePanelCommitment {
  readonly pageNumber: number;
  readonly commitmentDigest: string;
}

export interface RealBuildPanelEvidence {
  readonly panels: readonly StepPanel[];
  readonly calloutBoxesByStep: Readonly<Record<number, readonly PanelCalloutBox[]>>;
  readonly panelEvidenceByStep: Readonly<Record<number, PanelEvidenceEntry>>;
}

export interface ScopedRealBuildPanelEvidence {
  readonly panels: readonly StepPanel[];
  readonly calloutBoxesByStep: Readonly<Record<number, readonly PanelCalloutBox[]>>;
  /** A deterministic commitment, not a legacy ledger-authorizing evidence map. */
  readonly callerSourcePanelCommitmentByStep: Readonly<Record<number, CallerSourcePanelCommitment>>;
  readonly authority: Readonly<{
    readonly sourceText: "caller-supplied-unverified";
    readonly preparedRun: "absent";
    readonly placement: "absent";
    readonly completion: "absent";
  }>;
  readonly binding: Readonly<{
    readonly pdfBytesDigest: string;
    readonly callerInstructionSourceSnapshotDigest: string;
    readonly callerSourceContentHashClaimMatchedPdfBytes: true;
    readonly sourceTextParserReplay: "not-performed";
  }>;
  readonly scope: Readonly<{
    requestedStepNumbers: readonly number[];
    calloutProbePageNumbers: readonly number[];
    indexedStepLabelCount: number;
    materializedPagePanelCount: number;
    emittedPanelCount: number;
  }>;
}

type CalloutBoxesByPage = Awaited<ReturnType<typeof sampleBookletCalloutBoxes>>;
const PANEL_EVIDENCE_INPUT_KEYS = ["pdfBytes", "source", "pdfDigest"] as const;
const SCOPED_PANEL_EVIDENCE_INPUT_KEYS = [...PANEL_EVIDENCE_INPUT_KEYS, "stepNumbers"] as const;

function assertPanelGeometry(panels: readonly StepPanel[], source: InstructionSourceV1): void {
  for (const panel of panels) {
    const page = source.pages[panel.pageNumber - 1];
    const bounds = panel.bounds;
    if (
      page === undefined ||
      page.pageNumber !== panel.pageNumber ||
      ![bounds.minXPt, bounds.maxXPt, bounds.minYPt, bounds.maxYPt].every(Number.isFinite) ||
      bounds.minXPt < 0 ||
      bounds.minXPt >= bounds.maxXPt ||
      bounds.maxXPt > page.widthPt ||
      bounds.minYPt < 0 ||
      bounds.minYPt >= bounds.maxYPt ||
      bounds.maxYPt > page.heightPt ||
      panel.labelXPt < bounds.minXPt ||
      panel.labelXPt >= bounds.maxXPt ||
      panel.labelYPt < bounds.minYPt ||
      panel.labelYPt >= bounds.maxYPt
    ) {
      throw new TypeError(
        `Panel evidence step ${panel.stepNumber} does not form one finite, nonempty page-bounded cell containing its label.`,
      );
    }
  }
}

function panelEvidence(
  pdfDigest: string,
  panels: readonly StepPanel[],
  boxesByPage: CalloutBoxesByPage,
  source: InstructionSourceV1,
): RealBuildPanelEvidence {
  assertPanelGeometry(panels, source);
  for (const [pageNumber, entries] of boxesByPage) {
    const page = source.pages[pageNumber - 1];
    if (page === undefined || page.pageNumber !== pageNumber) {
      throw new TypeError(`Panel evidence callouts name missing source page ${pageNumber}.`);
    }
    for (const entry of entries) {
      const bounds = entry.box;
      if (
        !Number.isSafeInteger(entry.quantity) ||
        entry.quantity < 1 ||
        entry.quantity > 999 ||
        ![entry.labelXPt, entry.labelYPt, ...Object.values(bounds)].every(Number.isFinite) ||
        entry.labelXPt < 0 ||
        entry.labelXPt > page.widthPt ||
        entry.labelYPt < 0 ||
        entry.labelYPt > page.heightPt ||
        bounds.minXPt < 0 ||
        bounds.minXPt >= bounds.maxXPt ||
        bounds.maxXPt > page.widthPt ||
        bounds.minYPt < 0 ||
        bounds.minYPt >= bounds.maxYPt ||
        bounds.maxYPt > page.heightPt
      ) {
        throw new TypeError(
          `Panel evidence callout on page ${pageNumber} must carry a bounded quantity, label, and finite nonempty in-page box.`,
        );
      }
    }
  }
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
          pdfDigest,
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

function requirePanelEvidenceDigest(value: unknown): asserts value is string {
  if (typeof value !== "string" || !/^sha256:[0-9a-f]{64}$/u.test(value)) {
    throw new TypeError(
      "Panel evidence must be bound to one exact booklet digest of the form sha256:<64 hex>. " +
        "Hash the same bytes the probe ingested.",
    );
  }
}

function bindPanelEvidenceInput(fields: Readonly<Record<string, unknown>>): {
  readonly pdfBytes: Buffer;
  readonly source: InstructionSourceV1;
  readonly pdfDigest: string;
  readonly callerInstructionSourceSnapshotDigest: string;
} {
  const pdfBytes = snapshotBoundedUint8Array(fields.pdfBytes, {
    label: "Panel evidence PDF bytes",
    minimumBytes: 1,
    maximumBytes: INSTRUCTION_PDF_LIMITS.maxBytes,
  });
  const sourceInput = fields.source;
  const pdfDigest = fields.pdfDigest;
  requirePanelEvidenceDigest(pdfDigest);
  const measuredDigest = `sha256:${createHash("sha256").update(pdfBytes).digest("hex")}`;
  const source = snapshotBoundedInstructionSource(sourceInput, "Panel evidence instruction source");
  if (
    pdfDigest !== measuredDigest ||
    source.contentHash !== measuredDigest ||
    source.byteLength !== pdfBytes.byteLength
  ) {
    throw new TypeError(
      `Panel evidence input identity mismatch: received ${pdfBytes.byteLength} bytes hashing to ${measuredDigest}, ` +
        `an instruction source declaring ${source.byteLength} bytes at ${JSON.stringify(source.contentHash)}, and ` +
        `booklet digest ${JSON.stringify(pdfDigest)}. Re-ingest these exact PDF bytes and pass that source and digest together.`,
    );
  }
  const callerInstructionSourceSnapshotDigest = canonicalDigest({
    schemaVersion: "lego.caller-instruction-source-snapshot/1",
    source,
  });
  return { pdfBytes, source, pdfDigest: measuredDigest, callerInstructionSourceSnapshotDigest };
}

/**
 * Callout boxes must be found before panels, because a row cut is placed above
 * the callout box between two steps rather than at the midpoint between their
 * step numbers. Panels are therefore derived twice: once coarsely to learn
 * which pages carry steps at all, then again with the boxes those pages hold.
 * This legacy surface commits to caller-supplied positioned text; the separate
 * source-parity contracts must authenticate any stronger provenance claim.
 */
export async function deriveRealBuildPanelEvidence(input: {
  readonly pdfBytes: Buffer;
  readonly source: InstructionSourceV1;
  readonly pdfDigest: string;
}): Promise<RealBuildPanelEvidence> {
  const fields = snapshotExactDataObject(input, "Panel evidence input", PANEL_EVIDENCE_INPUT_KEYS);
  const bound = bindPanelEvidenceInput(fields);
  const coarsePanels = sampleBookletPanels(bound.source);
  const probedPages = [...new Set(coarsePanels.map(({ pageNumber }) => pageNumber))];
  const boxesByPage = await sampleBookletCalloutBoxes(bound.pdfBytes, bound.source, probedPages);
  const panels = sampleBookletPanels(
    bound.source,
    new Map(
      [...boxesByPage].map(([pageNumber, entries]) => [pageNumber, entries.map(({ box }) => box)]),
    ),
  );
  return panelEvidence(bound.pdfDigest, panels, boxesByPage, bound.source);
}

/**
 * Reproduces deterministic panel evidence for selected steps while reading vector
 * callout geometry only from the complete pages that contain those steps.
 * The booklet-global step-number inference still scans the already-ingested
 * text source; this function does not claim to avoid PDF ingestion. The fixed
 * parser binds vector shapes to the copied PDF bytes, but the positioned text
 * remains a detached caller-supplied source, so this result carries no source,
 * placement, prepared-run or completion authority.
 */
export async function deriveScopedRealBuildPanelEvidence(input: {
  readonly pdfBytes: Buffer;
  readonly source: InstructionSourceV1;
  readonly pdfDigest: string;
  readonly stepNumbers: readonly number[];
}): Promise<ScopedRealBuildPanelEvidence> {
  const fields = snapshotExactDataObject(
    input,
    "Scoped panel evidence input",
    SCOPED_PANEL_EVIDENCE_INPUT_KEYS,
  );
  const stepNumbersInput = snapshotDenseDataArray(
    fields.stepNumbers,
    "Scoped panel evidence step numbers",
    359,
  );
  if (stepNumbersInput.length < 1 || stepNumbersInput.length > 359) {
    throw new RangeError("Scoped panel evidence requires 1 through 359 requested steps.");
  }
  const requestedStepNumbers: number[] = [];
  let previous = 0;
  for (let index = 0; index < stepNumbersInput.length; index += 1) {
    const stepNumber = stepNumbersInput[index];
    if (
      typeof stepNumber !== "number" ||
      !Number.isSafeInteger(stepNumber) ||
      stepNumber < 1 ||
      stepNumber > 359
    ) {
      throw new RangeError("Scoped panel evidence step numbers must be safe integers in 1..359.");
    }
    if (stepNumber <= previous) {
      throw new RangeError(
        "Scoped panel evidence step numbers must be strictly increasing and unique.",
      );
    }
    requestedStepNumbers.push(stepNumber);
    previous = stepNumber;
  }
  const bound = bindPanelEvidenceInput(fields);
  const panelIndex = sampleBookletPanelIndex(bound.source);
  const pageByStep = new Map<number, number>();
  for (const entry of panelIndex.entries) {
    if (pageByStep.has(entry.stepNumber)) {
      throw new TypeError(
        `Scoped panel evidence found duplicate indexed step label ${entry.stepNumber}.`,
      );
    }
    pageByStep.set(entry.stepNumber, entry.pageNumber);
  }
  const calloutProbePageNumbers = [
    ...new Set(
      requestedStepNumbers.map((stepNumber) => {
        const pageNumber = pageByStep.get(stepNumber);
        if (pageNumber === undefined) {
          throw new TypeError(
            `Scoped panel evidence found no indexed step label for step ${stepNumber}.`,
          );
        }
        return pageNumber;
      }),
    ),
  ];
  const boxesByPage = await sampleBookletCalloutBoxes(
    bound.pdfBytes,
    bound.source,
    calloutProbePageNumbers,
  );
  const pagePanels = sampleBookletPanelsForPages(
    bound.source,
    calloutProbePageNumbers,
    new Map(
      [...boxesByPage].map(([pageNumber, entries]) => [pageNumber, entries.map(({ box }) => box)]),
    ),
    panelIndex.stepNumberHeightPt,
  );
  assertPanelGeometry(pagePanels, bound.source);
  const panelByStep = new Map(pagePanels.map((panel) => [panel.stepNumber, panel]));
  const panels = requestedStepNumbers.map((stepNumber) => {
    const panel = panelByStep.get(stepNumber);
    if (panel === undefined) {
      throw new TypeError(
        `Scoped panel evidence page-complete derivation omitted requested step ${stepNumber}.`,
      );
    }
    return panel;
  });
  const evidence = panelEvidence(bound.pdfDigest, panels, boxesByPage, bound.source);
  return {
    panels: evidence.panels,
    calloutBoxesByStep: evidence.calloutBoxesByStep,
    callerSourcePanelCommitmentByStep: Object.fromEntries(
      evidence.panels.map((panel) => {
        const entry = evidence.panelEvidenceByStep[panel.stepNumber]!;
        return [
          panel.stepNumber,
          { pageNumber: entry.pageNumber, commitmentDigest: entry.digest },
        ] as const;
      }),
    ),
    authority: Object.freeze({
      sourceText: "caller-supplied-unverified" as const,
      preparedRun: "absent" as const,
      placement: "absent" as const,
      completion: "absent" as const,
    }),
    binding: Object.freeze({
      pdfBytesDigest: bound.pdfDigest,
      callerInstructionSourceSnapshotDigest: bound.callerInstructionSourceSnapshotDigest,
      callerSourceContentHashClaimMatchedPdfBytes: true as const,
      sourceTextParserReplay: "not-performed" as const,
    }),
    scope: Object.freeze({
      requestedStepNumbers: Object.freeze(requestedStepNumbers),
      calloutProbePageNumbers: Object.freeze(calloutProbePageNumbers),
      indexedStepLabelCount: panelIndex.entries.length,
      materializedPagePanelCount: pagePanels.length,
      emittedPanelCount: panels.length,
    }),
  };
}
