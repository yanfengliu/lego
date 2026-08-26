import type { PanelFace } from "../src/assembly/panel-face";
import type { PanelCalloutBox, StepPanel } from "../src/instructions/step-panels";

import { produceRealBuildPassivePanel } from "./real-build-passive-panel-boundary";
import type { RealBuildPanelRasterSpec, RealBuildPanelSpec } from "./real-build-safety";

export interface RealBuildRunPanelWindow<Panel> {
  readonly requestedLastStep: number;
  readonly expectedPrintedSteps: number;
  readonly maximumPassiveLookaheadSteps: number;
  /** Raw source descriptors whose actions may be compiled. */
  readonly executionPanels: readonly Panel[];
  /** Raw source descriptors retained only for bounded passive raster observation. */
  readonly passiveObservationPanels: readonly Panel[];
  readonly observationPanels: readonly Panel[];
}

const plannedWindows = new WeakSet<object>();
const REFLECT_APPLY = Reflect.apply;
const WEAK_SET_ADD = WeakSet.prototype.add;
const WEAK_SET_HAS = WeakSet.prototype.has;

function plannedWindowAdd(value: object): void {
  REFLECT_APPLY(WEAK_SET_ADD, plannedWindows, [value]);
}

function plannedWindowHas(value: object): boolean {
  return REFLECT_APPLY(WEAK_SET_HAS, plannedWindows, [value]) as boolean;
}

function ownDataStepNumber(value: unknown, label: string): number {
  if (typeof value !== "object" || value === null) {
    throw new TypeError(`${label} must be one object with an own stepNumber data property.`);
  }
  let descriptor: PropertyDescriptor | undefined;
  try {
    descriptor = Object.getOwnPropertyDescriptor(value, "stepNumber");
  } catch {
    throw new TypeError(`${label} stepNumber descriptor could not be inspected.`);
  }
  const stepNumber = descriptor !== undefined && "value" in descriptor ? descriptor.value : null;
  if (!Number.isSafeInteger(stepNumber)) {
    throw new TypeError(`${label} stepNumber must be one safe-integer own data property.`);
  }
  return stepNumber as number;
}

function assertWindowBounds(input: {
  readonly requestedLastStep: number;
  readonly expectedPrintedSteps: number;
  readonly maximumPassiveLookaheadSteps: number;
}): void {
  if (
    input.expectedPrintedSteps !== 359 ||
    !Number.isSafeInteger(input.requestedLastStep) ||
    input.requestedLastStep < 1 ||
    input.requestedLastStep > input.expectedPrintedSteps ||
    !Number.isSafeInteger(input.maximumPassiveLookaheadSteps) ||
    input.maximumPassiveLookaheadSteps < 0 ||
    input.maximumPassiveLookaheadSteps >= input.expectedPrintedSteps
  ) {
    throw new RangeError(
      "Real-build panel planning requires the fixed 359-step source/index contract, a bounded requested prefix, and non-negative passive lookahead within that index.",
    );
  }
}

function exactSourcePanelDescriptors<Panel>(value: unknown): readonly Panel[] {
  if (!Array.isArray(value)) {
    throw new TypeError("Real-build source panel index must be one dense ordinary array.");
  }
  let lengthDescriptor: PropertyDescriptor | undefined;
  try {
    lengthDescriptor = Object.getOwnPropertyDescriptor(value, "length");
  } catch {
    throw new TypeError("Real-build source panel index length could not be inspected.");
  }
  if (
    lengthDescriptor === undefined ||
    !("value" in lengthDescriptor) ||
    lengthDescriptor.value !== 359
  ) {
    throw new RangeError(
      "Real-build source panel index must contain exactly 359 descriptors before prefix projection.",
    );
  }
  const panels: Panel[] = [];
  for (let index = 0; index < 359; index += 1) {
    let descriptor: PropertyDescriptor | undefined;
    try {
      descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    } catch {
      throw new TypeError(`Real-build source panel ${index} descriptor could not be inspected.`);
    }
    if (descriptor === undefined || !("value" in descriptor)) {
      throw new TypeError(
        `Real-build source panel index must be dense own data; row ${index} is absent or an accessor.`,
      );
    }
    panels.push(descriptor.value as Panel);
  }
  return panels;
}

/**
 * Validates the complete source index before projecting its execution/passive window.
 * Only `stepNumber` is read during projection; action, piece and callout identity
 * properties cannot be touched on a descriptor that falls outside execution.
 */
export function planRealBuildRunPanelWindow<Panel>(input: {
  readonly panels: readonly Panel[];
  readonly requestedLastStep: number;
  readonly expectedPrintedSteps: number;
  readonly maximumPassiveLookaheadSteps: number;
}): RealBuildRunPanelWindow<Panel> {
  assertWindowBounds(input);
  const sourcePanels = exactSourcePanelDescriptors<Panel>(input.panels);
  const byStep = new Array<Panel | undefined>(input.expectedPrintedSteps);
  for (let index = 0; index < sourcePanels.length; index += 1) {
    const panel = sourcePanels[index]!;
    const stepNumber = ownDataStepNumber(panel, `Real-build source panel ${index}`);
    if (stepNumber < 1 || stepNumber > input.expectedPrintedSteps || byStep[stepNumber - 1]) {
      throw new RangeError(
        `Real-build source panel ${index} names duplicate or out-of-range step ${stepNumber}; required exactly 1..${input.expectedPrintedSteps}.`,
      );
    }
    byStep[stepNumber - 1] = panel;
  }
  if (byStep.some((panel) => panel === undefined)) {
    throw new RangeError(
      `Real-build source panel index must contain every descriptor 1..${input.expectedPrintedSteps}.`,
    );
  }
  const observationLastStep = Math.min(
    input.expectedPrintedSteps,
    input.requestedLastStep + input.maximumPassiveLookaheadSteps,
  );
  const ordered = byStep as Panel[];
  const executionPanels = Object.freeze(ordered.slice(0, input.requestedLastStep));
  const passiveObservationPanels = Object.freeze(
    ordered.slice(input.requestedLastStep, observationLastStep),
  );
  const planned = Object.freeze({
    requestedLastStep: input.requestedLastStep,
    expectedPrintedSteps: input.expectedPrintedSteps,
    maximumPassiveLookaheadSteps: input.maximumPassiveLookaheadSteps,
    executionPanels,
    passiveObservationPanels,
    observationPanels: Object.freeze([...executionPanels, ...passiveObservationPanels]),
  });
  plannedWindowAdd(planned);
  return planned;
}

/** Requires this module's exact immutable planner result and rechecks its current ordered labels. */
export function requireRealBuildRunPanelWindow<Panel>(
  value: unknown,
): RealBuildRunPanelWindow<Panel> {
  if (value === null || typeof value !== "object" || !plannedWindowHas(value)) {
    throw new TypeError(
      "Real-build panel production requires the exact module-planned 359-step source window.",
    );
  }
  const window = value as RealBuildRunPanelWindow<Panel>;
  const expectedPassiveRows =
    Math.min(
      window.expectedPrintedSteps,
      window.requestedLastStep + window.maximumPassiveLookaheadSteps,
    ) - window.requestedLastStep;
  if (
    window.expectedPrintedSteps !== 359 ||
    window.executionPanels.length !== window.requestedLastStep ||
    window.passiveObservationPanels.length !== expectedPassiveRows ||
    window.observationPanels.length !==
      window.executionPanels.length + window.passiveObservationPanels.length
  ) {
    throw new TypeError(
      "Real-build panel window no longer preserves its exact 359-step execution/passive bounds.",
    );
  }
  const ordered = [...window.executionPanels, ...window.passiveObservationPanels];
  for (let index = 0; index < ordered.length; index += 1) {
    if (
      ownDataStepNumber(ordered[index], `Real-build planned panel ${index}`) !== index + 1 ||
      window.observationPanels[index] !== ordered[index]
    ) {
      throw new TypeError(
        `Real-build panel window no longer preserves exact ordered descriptor ${index + 1}.`,
      );
    }
  }
  return window;
}

/** Projects one validated raw source row into a raster-only passive descriptor. */
export function realBuildPassivePanelSpec(input: {
  readonly panel: StepPanel;
  readonly panelFace: PanelFace | null;
  readonly calloutBoxes: readonly PanelCalloutBox[];
}): RealBuildPanelRasterSpec {
  return produceRealBuildPassivePanel(input);
}

export interface RealBuildDeferredPanelRoles {
  readonly interveningExecutionPanel: RealBuildPanelSpec | null;
  readonly fartherExecutionPanel: RealBuildPanelSpec | null;
  readonly fartherRasterPanel: RealBuildPanelRasterSpec | null;
}

/** Keeps passive K raster input separate from calibrated action-bearing K input. */
export function selectRealBuildDeferredPanelRoles(input: {
  readonly interveningRasterPanel: RealBuildPanelRasterSpec;
  readonly executionPanels: readonly RealBuildPanelSpec[];
  readonly observationPanels: readonly RealBuildPanelRasterSpec[];
}): RealBuildDeferredPanelRoles {
  const interveningStep = ownDataStepNumber(
    input.interveningRasterPanel,
    "Real-build intervening raster panel",
  );
  const execution = input.executionPanels.map((panel, index) => ({
    panel,
    stepNumber: ownDataStepNumber(panel, `Real-build execution panel ${index}`),
  }));
  const observations = input.observationPanels
    .map((panel, index) => ({
      panel,
      stepNumber: ownDataStepNumber(panel, `Real-build observation panel ${index}`),
    }))
    .sort((left, right) => left.stepNumber - right.stepNumber);
  const interveningExecutionPanel =
    execution.find(({ stepNumber }) => stepNumber === interveningStep)?.panel ?? null;
  const fartherRasterPanel =
    observations.find(({ stepNumber }) => stepNumber > interveningStep)?.panel ?? null;
  const fartherStep =
    fartherRasterPanel === null
      ? null
      : ownDataStepNumber(fartherRasterPanel, "Real-build farther raster panel");
  const fartherExecutionPanel =
    fartherStep === null
      ? null
      : (execution.find(({ stepNumber }) => stepNumber === fartherStep)?.panel ?? null);
  return Object.freeze({ interveningExecutionPanel, fartherExecutionPanel, fartherRasterPanel });
}

export const __testOnly = Object.freeze({ ownDataStepNumber });
