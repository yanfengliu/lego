import { REAL_BUILD_PRODUCTION_EXPECTED_PRINTED_STEPS } from "./real-build-production-policy";
import type { RealBuildOptions, RealBuildPanelSpec } from "./real-build-safety";

interface RetainedRealBuildActionContract {
  readonly actionLedger: readonly unknown[];
  readonly budgets: Readonly<Record<string, number>>;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** Admits only an already-projected, exact action-bearing execution prefix. */
export function selectRealBuildExecutablePanels(
  panels: readonly RealBuildPanelSpec[],
  requestedLastStep: number,
): readonly RealBuildPanelSpec[] {
  if (
    !Number.isSafeInteger(requestedLastStep) ||
    requestedLastStep < 1 ||
    requestedLastStep > REAL_BUILD_PRODUCTION_EXPECTED_PRINTED_STEPS
  ) {
    throw new TypeError(
      `Real-build executable panel selection requires a safe requested last step from 1 through ` +
        `${REAL_BUILD_PRODUCTION_EXPECTED_PRINTED_STEPS}; received ` +
        `${JSON.stringify(requestedLastStep)}.`,
    );
  }
  if (!Array.isArray(panels)) {
    throw new TypeError(
      "Real-build executable panel selection requires one exact ordinary dense data array.",
    );
  }
  let descriptors: PropertyDescriptorMap;
  try {
    descriptors = Object.getOwnPropertyDescriptors(panels) as unknown as PropertyDescriptorMap;
  } catch {
    throw new TypeError(
      "Real-build executable panel selection could not inspect array descriptors safely.",
    );
  }
  const lengthDescriptor = descriptors.length;
  const length =
    lengthDescriptor !== undefined && "value" in lengthDescriptor
      ? lengthDescriptor.value
      : Number.NaN;
  if (length !== requestedLastStep) {
    throw new TypeError(
      `Real-build executable panel selection received ${String(length)} rows; the fixed source/index ` +
        `contract requires exactly ordered action-bearing steps 1..${requestedLastStep}. Broader raw ` +
        `359-step source descriptors must be projected only by the source panel-window planner, and ` +
        `tail action specs are rejected rather than filtered.`,
    );
  }
  const expectedIndices = Array.from({ length: requestedLastStep }, (_, index) => String(index));
  const unexpectedArrayKey = Reflect.ownKeys(descriptors).find(
    (key) => key !== "length" && (typeof key !== "string" || !expectedIndices.includes(key)),
  );
  if (unexpectedArrayKey !== undefined) {
    throw new TypeError(
      `Real-build executable panel selection contains unsupported array field ` +
        `${typeof unexpectedArrayKey === "symbol" ? unexpectedArrayKey.toString() : JSON.stringify(unexpectedArrayKey)}; ` +
        `expected only length and dense steps 1..${requestedLastStep}.`,
    );
  }
  const exactPanels: RealBuildPanelSpec[] = [];
  for (let index = 0; index < requestedLastStep; index += 1) {
    const rowDescriptor = descriptors[String(index)];
    if (rowDescriptor === undefined || !rowDescriptor.enumerable || !("value" in rowDescriptor)) {
      throw new TypeError(
        `Real-build executable panel ${index} must be one enumerable own data property.`,
      );
    }
    const panel = rowDescriptor.value as RealBuildPanelSpec;
    if (typeof panel !== "object" || panel === null || Array.isArray(panel)) {
      throw new TypeError(`Real-build executable panel ${index} must be one panel data object.`);
    }
    let descriptor: PropertyDescriptor | undefined;
    try {
      descriptor = Object.getOwnPropertyDescriptor(panel, "stepNumber");
    } catch {
      throw new TypeError(
        `Real-build executable panel ${index} stepNumber descriptor could not be inspected.`,
      );
    }
    const stepNumber = descriptor !== undefined && "value" in descriptor ? descriptor.value : null;
    if (stepNumber !== index + 1) {
      throw new TypeError(
        `Real-build executable panel selection requires exactly ordered action-bearing steps ` +
          `1..${requestedLastStep}; row ${index} names ${JSON.stringify(stepNumber)} instead of ` +
          `${index + 1}. Gaps, duplicates, reordering, and tail rows are not projected here.`,
      );
    }
    exactPanels.push(panel);
  }
  return Object.freeze(exactPanels);
}

/** Guards both retained action-bearing roles immediately before publication. */
export function assertRealBuildRetainedActionPrefix(input: {
  readonly contract: RetainedRealBuildActionContract;
  readonly options: RealBuildOptions;
}): void {
  const requestedLastStep = input.options.lastStep;
  if (
    input.options.expectedPrintedSteps !== REAL_BUILD_PRODUCTION_EXPECTED_PRINTED_STEPS ||
    !Number.isSafeInteger(requestedLastStep) ||
    requestedLastStep < 1 ||
    requestedLastStep > REAL_BUILD_PRODUCTION_EXPECTED_PRINTED_STEPS
  ) {
    throw new TypeError(
      `Retained real-build action roles require the fixed ` +
        `${REAL_BUILD_PRODUCTION_EXPECTED_PRINTED_STEPS}-step source/index contract and one safe requested ` +
        `last step from 1 through ${REAL_BUILD_PRODUCTION_EXPECTED_PRINTED_STEPS}; received ` +
        `expectedPrintedSteps=${String(input.options.expectedPrintedSteps)} and ` +
        `lastStep=${String(requestedLastStep)}.`,
    );
  }
  if (
    input.options.panels.length > REAL_BUILD_PRODUCTION_EXPECTED_PRINTED_STEPS ||
    input.contract.actionLedger.length > REAL_BUILD_PRODUCTION_EXPECTED_PRINTED_STEPS
  ) {
    throw new TypeError(
      `Retained real-build action roles exceed the fixed ` +
        `${REAL_BUILD_PRODUCTION_EXPECTED_PRINTED_STEPS}-row bound: prepared panels=` +
        `${input.options.panels.length}, action rows=${input.contract.actionLedger.length}.`,
    );
  }
  const panelStepNumbers = input.options.panels.map(({ stepNumber }) => stepNumber);
  const actionStepNumbers = input.contract.actionLedger.map((value) =>
    isRecord(value) ? value.stepNumber : undefined,
  );
  const expected = Array.from({ length: requestedLastStep }, (_, index) => index + 1);
  if (
    input.contract.budgets.lastStep !== requestedLastStep ||
    JSON.stringify(panelStepNumbers) !== JSON.stringify(expected) ||
    JSON.stringify(actionStepNumbers) !== JSON.stringify(expected)
  ) {
    throw new TypeError(
      `Retained real-build run-contract actionLedger and prepared-options panels must each contain ` +
        `exactly executable printed steps 1..${requestedLastStep}; received action steps ` +
        `${JSON.stringify(actionStepNumbers)} and prepared steps ${JSON.stringify(panelStepNumbers)}. ` +
        `The separate booklet source/index contract remains 359 steps, but it cannot supply tail actions.`,
    );
  }
}
