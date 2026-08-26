import type { PanelCalloutBox, StepPanel } from "../src/instructions/step-panels";

import type { CalloutResolution } from "./real-build-input-files";
import type { OfficialModelIndex } from "./real-build-ledger";
import type {
  RealBuildInputDigests,
  RealBuildPanelRasterSpec,
  RealBuildPanelSpec,
  V6ManifestCallout,
} from "./real-build-safety";
import { buildRealBuildPanelSpecs } from "./real-build-panel-specs";
import {
  realBuildPassivePanelSpec,
  requireRealBuildRunPanelWindow,
  type RealBuildRunPanelWindow,
} from "./real-build-run-panel-window";
import type { PanelFace } from "../src/assembly/panel-face";

function optionalDataStepNumber(value: unknown, label: string): number | null {
  if (typeof value !== "object" || value === null) return null;
  let descriptor: PropertyDescriptor | undefined;
  try {
    descriptor = Object.getOwnPropertyDescriptor(value, "stepNumber");
  } catch {
    throw new TypeError(`${label} stepNumber descriptor could not be inspected.`);
  }
  if (descriptor === undefined || !("value" in descriptor) || descriptor.value === null)
    return null;
  if (!Number.isSafeInteger(descriptor.value)) {
    throw new TypeError(`${label} stepNumber must be a safe-integer own data property or null.`);
  }
  return descriptor.value as number;
}

function rowsThroughStep<T>(rows: readonly T[], lastStep: number, label: string): readonly T[] {
  const selected: T[] = [];
  for (let index = 0; index < rows.length; index += 1) {
    const stepNumber = optionalDataStepNumber(rows[index], `${label} ${index}`);
    if (stepNumber !== null && stepNumber <= lastStep) selected.push(rows[index]!);
  }
  return Object.freeze(selected);
}

function coverageThroughStep(
  coverage: Readonly<Record<string, CalloutResolution>> | null,
  lastStep: number,
): Readonly<Record<string, CalloutResolution>> | null {
  if (coverage === null) return null;
  let descriptors: PropertyDescriptorMap;
  try {
    descriptors = Object.getOwnPropertyDescriptors(coverage);
  } catch {
    throw new TypeError(
      "Coverage callout descriptors could not be inspected before prefix projection.",
    );
  }
  const selected = Object.create(null) as Record<string, CalloutResolution>;
  for (const [identity, descriptor] of Object.entries(descriptors)) {
    if (!("value" in descriptor)) {
      throw new TypeError(`Coverage callout ${identity} must be one own data property.`);
    }
    const stepNumber = optionalDataStepNumber(descriptor.value, `Coverage callout ${identity}`);
    if (stepNumber !== null && stepNumber <= lastStep) {
      selected[identity] = descriptor.value as CalloutResolution;
    }
  }
  return Object.freeze(selected);
}

/**
 * Compiles executable specs only after the full raw source index was windowed.
 * Tail ledger/callout rows are selected by their own step number and no action,
 * piece, crop path or callout identity field above the prefix is dereferenced.
 */
export function produceRealBuildRunPanelInputs(input: {
  readonly repoRoot: string;
  readonly calloutDirectory: string;
  readonly panelWindow: RealBuildRunPanelWindow<StepPanel>;
  readonly requestedLastStep: number;
  readonly facesByStep: ReadonlyMap<number, PanelFace>;
  readonly calloutBoxesByStep: Readonly<Record<number, readonly PanelCalloutBox[]>>;
  readonly stepByCalloutIdentity: ReadonlyMap<string, number>;
  readonly manifestCallouts: readonly V6ManifestCallout[];
  readonly ledgerSteps: readonly unknown[];
  readonly officialModel: OfficialModelIndex | null;
  readonly coverageByCallout: Readonly<Record<string, CalloutResolution>> | null;
  readonly inputDigests: RealBuildInputDigests;
}): Readonly<{
  specs: readonly RealBuildPanelSpec[];
  passivePanels: readonly RealBuildPanelRasterSpec[];
  coverageByCallout: Readonly<Record<string, CalloutResolution>> | null;
}> {
  const panelWindow = requireRealBuildRunPanelWindow<StepPanel>(input.panelWindow);
  if (
    panelWindow.requestedLastStep !== input.requestedLastStep ||
    panelWindow.executionPanels.length !== input.requestedLastStep
  ) {
    throw new TypeError(
      `Real-build panel production requires one validated 359-step source window whose executable prefix ` +
        `ends exactly at requestedLastStep ${input.requestedLastStep}; received window request ` +
        `${panelWindow.requestedLastStep}, ${panelWindow.executionPanels.length} execution rows, ` +
        `and ${panelWindow.passiveObservationPanels.length}/${panelWindow.maximumPassiveLookaheadSteps} passive rows.`,
    );
  }
  const manifestCallouts = rowsThroughStep(
    input.manifestCallouts,
    input.requestedLastStep,
    "Manifest callout",
  );
  const ledgerSteps = rowsThroughStep(
    input.ledgerSteps,
    input.requestedLastStep,
    "Action-ledger step",
  );
  const coverageByCallout = coverageThroughStep(input.coverageByCallout, input.requestedLastStep);
  const specs = buildRealBuildPanelSpecs({
    repoRoot: input.repoRoot,
    calloutDirectory: input.calloutDirectory,
    panels: panelWindow.executionPanels,
    facesByStep: input.facesByStep,
    calloutBoxesByStep: input.calloutBoxesByStep,
    stepByCalloutIdentity: input.stepByCalloutIdentity,
    manifestCallouts,
    ledgerSteps,
    officialModel: input.officialModel,
    coverageByCallout,
    inputDigests: input.inputDigests,
  });
  const passivePanels = Object.freeze(
    panelWindow.passiveObservationPanels.map((panel) =>
      realBuildPassivePanelSpec({
        panel,
        panelFace: input.facesByStep.get(panel.stepNumber) ?? null,
        calloutBoxes: input.calloutBoxesByStep[panel.stepNumber] ?? [],
      }),
    ),
  );
  return Object.freeze({ specs, passivePanels, coverageByCallout });
}

export const __testOnly = Object.freeze({ coverageThroughStep, rowsThroughStep });
