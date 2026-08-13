import { describeInspectedLineagedFartherFrontierError } from "./real-build-farther-lineage-frontier-validation";
import { requireLineagedFartherInspectionSnapshot } from "./real-build-farther-lineage-inspection";
import type {
  InspectedLineagedFartherFrontier,
  LineagedFartherInspectionSnapshot,
} from "./real-build-farther-lineage-inspection-types";

export { describeInspectedLineagedFartherFrontierError };

export function describeLineagedFartherFrontierError(
  inspected: LineagedFartherInspectionSnapshot<"frontier">,
): string | null {
  const frontier = requireLineagedFartherInspectionSnapshot(inspected, "frontier").value;
  return describeInspectedLineagedFartherFrontierError(frontier, "lineaged frontier");
}

export function describeLineagedFartherOriginError(
  inspected: LineagedFartherInspectionSnapshot<"origin">,
): string | null {
  const input = requireLineagedFartherInspectionSnapshot(inspected, "origin").value;
  if (!Number.isSafeInteger(input.stepNumber) || input.stepNumber < 1) {
    return "lineaged origin.stepNumber must be a positive safe integer";
  }
  if (input.candidates.length < 2) {
    return "lineaged origin must retain at least two alternatives";
  }
  const frontier: InspectedLineagedFartherFrontier = {
    originStepNumber: input.stepNumber,
    throughStepNumber: input.stepNumber,
    observationPanelStepNumber: input.observationPanelStepNumber,
    panelRendersUsed: input.panelRendersUsed,
    candidates: input.candidates,
    nodes: input.nodes,
  };
  const defect = describeInspectedLineagedFartherFrontierError(
    frontier,
    "lineaged origin frontier",
  );
  if (defect !== null) return defect;
  const nonAnchor = input.candidates.findIndex(
    ({ identity, fartherOriginLineageId }) =>
      identity.lineageId !== fartherOriginLineageId ||
      identity.localIdentity.kind !== "decision" ||
      identity.throughStepNumber !== input.stepNumber,
  );
  if (nonAnchor >= 0) {
    return `lineaged origin.candidates[${nonAnchor}] must itself be its witnessed decision-family anchor`;
  }
  const families = new Set(
    input.candidates.map(({ fartherOriginLineageId }) => fartherOriginLineageId),
  );
  return families.size < 2
    ? "lineaged origin must retain at least two distinct farther-origin decision families"
    : null;
}

export {
  describeFirstLineagedPanelError,
  describeLineagedFartherCarryError,
} from "./real-build-farther-lineage-input-validation";
