import type { RealBuildOptions, RealBuildPanelSpec, StepFailure } from "./real-build-safety";

interface RealBuildPanelPrefixPreflightInput {
  readonly panels: readonly RealBuildPanelSpec[];
  readonly passivePanels: RealBuildOptions["passivePanels"];
  readonly expectedPrintedSteps: number;
  readonly lastStep: number;
  readonly fartherPanelMaximumReachSteps: number;
}

const EXPECTED_PRINTED_STEPS = 359;

export const REAL_BUILD_PASSIVE_PANEL_AUTHORITY_KEYS = [
  "mappedCalloutKeys",
  "action",
  "pieces",
  "omittedPieces",
  "calloutPieces",
  "classifiedPhysicalCalloutPieces",
  "semanticMultiplierQuantity",
  "omittedPhysicalPieces",
  "coverageFailures",
  "missingDesigns",
  "unresolvedCallouts",
] as const;

/** Validates the executable prefix and its bounded raster-only corroboration suffix. */
export function preflightRealBuildPanelPrefix(
  input: RealBuildPanelPrefixPreflightInput,
): readonly StepFailure[] {
  const failures: StepFailure[] = [];
  const hasFixedPrintedStepContract = input.expectedPrintedSteps === EXPECTED_PRINTED_STEPS;
  const validLastStep =
    hasFixedPrintedStepContract &&
    Number.isSafeInteger(input.lastStep) &&
    input.lastStep >= 1 &&
    input.lastStep <= EXPECTED_PRINTED_STEPS;
  if (!validLastStep) {
    failures.push({
      code: "printed-step-sequence-invalid",
      stage: "input",
      inputKey: "lastStep",
      message:
        `The requested real-build prefix must end at an integer printed step from 1 through ` +
        `${EXPECTED_PRINTED_STEPS} under the fixed ${EXPECTED_PRINTED_STEPS}-step source/index ` +
        `contract; received expectedPrintedSteps=${String(input.expectedPrintedSteps)} and ` +
        `lastStep=${String(input.lastStep)}.`,
    });
  }

  const hasBoundedPanelCount = input.panels.length <= EXPECTED_PRINTED_STEPS;
  const numbers = hasBoundedPanelCount ? input.panels.map(({ stepNumber }) => stepNumber) : [];
  const unique = new Set(numbers);
  const expected = validLastStep
    ? Array.from({ length: input.lastStep }, (_, index) => index + 1)
    : [];
  if (
    !hasFixedPrintedStepContract ||
    !hasBoundedPanelCount ||
    (validLastStep &&
      (numbers.length !== expected.length ||
        unique.size !== numbers.length ||
        numbers.some((step, index) => step !== expected[index])))
  ) {
    const missing = expected.filter((step) => !unique.has(step));
    const duplicates = [...unique].filter(
      (step) => numbers.filter((candidate) => candidate === step).length > 1,
    );
    const abovePrefix = validLastStep
      ? numbers.filter((step) => !Number.isSafeInteger(step) || step > input.lastStep || step < 1)
      : [];
    failures.push({
      code: "printed-step-sequence-invalid",
      stage: "input",
      inputKey: "panels",
      message:
        `Executable real-build panels must be exactly ordered printed steps ` +
        `${validLastStep ? `1..${input.lastStep}` : "inside one valid requested prefix"} within the fixed ` +
        `359-step source/index contract; received ${numbers.length} panels and ${unique.size} unique numbers. ` +
        `Missing: ${missing.join(", ") || "none"}; duplicates: ${duplicates.join(", ") || "none"}; ` +
        `outside prefix: ${abovePrefix.join(", ") || "none"}. Rotation and attachment steps inside the ` +
        `requested prefix must be explicit zero-piece transitions. Full-booklet raw source descriptors are ` +
        `validated before this action-bearing projection and do not belong in options.panels.`,
    });
  }

  const hasBoundedPassivePanels =
    Array.isArray(input.passivePanels) && input.passivePanels.length <= EXPECTED_PRINTED_STEPS;
  const passivePanels = hasBoundedPassivePanels ? input.passivePanels : [];
  if (!hasBoundedPassivePanels) {
    failures.push({
      code: "printed-step-sequence-invalid",
      stage: "input",
      inputKey: "passivePanels",
      message:
        "Passive real-build panel observations must be a bounded raster-only array after the executable prefix.",
    });
  }
  const validPassiveReach =
    hasFixedPrintedStepContract &&
    Number.isSafeInteger(input.fartherPanelMaximumReachSteps) &&
    input.fartherPanelMaximumReachSteps >= 1 &&
    input.fartherPanelMaximumReachSteps < EXPECTED_PRINTED_STEPS;
  const maximumPassiveStep =
    validLastStep && validPassiveReach
      ? Math.min(input.expectedPrintedSteps, input.lastStep + input.fartherPanelMaximumReachSteps)
      : null;
  const passivePanelObservations = passivePanels.map((panel) => {
    let stepNumber = Number.NaN;
    let pageNumber = Number.NaN;
    let authorityKey:
      (typeof REAL_BUILD_PASSIVE_PANEL_AUTHORITY_KEYS)[number] | "uninspectable" | undefined;
    try {
      const descriptors = Object.getOwnPropertyDescriptors(panel) as unknown as Readonly<
        Record<PropertyKey, PropertyDescriptor>
      >;
      const observedStepNumber = descriptors["stepNumber"]?.value;
      const observedPageNumber = descriptors["pageNumber"]?.value;
      stepNumber = typeof observedStepNumber === "number" ? observedStepNumber : Number.NaN;
      pageNumber = typeof observedPageNumber === "number" ? observedPageNumber : Number.NaN;
      authorityKey = REAL_BUILD_PASSIVE_PANEL_AUTHORITY_KEYS.find(
        (key) => descriptors[key] !== undefined,
      );
    } catch {
      authorityKey = "uninspectable";
    }
    return { stepNumber, pageNumber, authorityKey };
  });
  const passiveNumbers = passivePanelObservations.map(({ stepNumber }) => stepNumber);
  if (
    validLastStep &&
    validPassiveReach &&
    passiveNumbers.some(
      (step, index) =>
        !Number.isSafeInteger(step) ||
        step <= input.lastStep ||
        step > maximumPassiveStep! ||
        (index > 0 && step <= passiveNumbers[index - 1]!),
    )
  ) {
    failures.push({
      code: "printed-step-sequence-invalid",
      stage: "input",
      inputKey: "passivePanels",
      message:
        `Passive real-build observations must be an ordered unique raster-only subset after requested step ` +
        `${input.lastStep} and no later than step ${String(maximumPassiveStep)}; received ` +
        `[${passiveNumbers.join(", ") || "none"}]. These panels may corroborate the final requested action, ` +
        `but cannot carry an executable action, identity, coverage claim, or completion authority.`,
    });
  }
  for (const { stepNumber, pageNumber, authorityKey } of passivePanelObservations) {
    if (
      !Number.isSafeInteger(stepNumber) ||
      !Number.isSafeInteger(pageNumber) ||
      pageNumber < 1 ||
      authorityKey !== undefined
    ) {
      failures.push({
        code: "printed-step-sequence-invalid",
        stage: "input",
        inputKey: "passivePanels",
        message:
          `Passive panel ${String(stepNumber)} must contain only a typed booklet raster ` +
          `descriptor with a positive page number${
            authorityKey === undefined
              ? ""
              : authorityKey === "uninspectable"
                ? "; its own property descriptors could not be inspected safely"
                : `; forbidden action-authority field ${JSON.stringify(authorityKey)} was present`
          }. Remove executable actions and identities from passive lookahead.`,
      });
    }
  }

  const panelsByPrintedStep = [
    ...(hasBoundedPanelCount
      ? input.panels.map(({ stepNumber, pageNumber }) => ({ stepNumber, pageNumber }))
      : []),
    ...passivePanelObservations
      .filter(
        ({ stepNumber, pageNumber }) =>
          Number.isSafeInteger(stepNumber) && Number.isSafeInteger(pageNumber),
      )
      .map(({ stepNumber, pageNumber }) => ({ stepNumber, pageNumber })),
  ].sort((left, right) => left.stepNumber - right.stepNumber);
  const reversedPage = panelsByPrintedStep.find(
    (panel, index) => index > 0 && panel.pageNumber < panelsByPrintedStep[index - 1]!.pageNumber,
  );
  if (reversedPage !== undefined) {
    const prior = panelsByPrintedStep[panelsByPrintedStep.indexOf(reversedPage) - 1]!;
    failures.push({
      code: "printed-step-sequence-invalid",
      stage: "input",
      inputKey: "panels",
      message:
        `Printed step ${reversedPage.stepNumber} is assigned to booklet page ${reversedPage.pageNumber}, ` +
        `which precedes step ${prior.stepNumber} on page ${prior.pageNumber}. Printed-step execution must ` +
        `advance monotonically through booklet pages so page grouping cannot execute a later step before ` +
        `its retained predecessor. Correct the panel page binding before the browser loads the PDF.`,
    });
  }
  return failures;
}
