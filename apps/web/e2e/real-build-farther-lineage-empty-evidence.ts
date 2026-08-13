import { freezeArray } from "./real-build-farther-panel-freeze";
import type {
  FartherRefusal,
  LineagedFartherCarryEvidence,
  LineagedFartherNode,
  LineagedFartherPanelEvidence,
} from "./real-build-farther-panel-types";

export const lineagedFartherRefusal = (
  code: FartherRefusal["code"],
  stage: FartherRefusal["stage"],
  stepNumber: number,
  message: string,
): FartherRefusal => Object.freeze({ code, stage, stepNumber, message });

export function emptyLineagedFartherCarryEvidence(): LineagedFartherCarryEvidence {
  return Object.freeze({
    parentLineages: 0,
    parentsExpanded: 0,
    offeredLineages: 0,
    narrowingRenders: 0,
    maximumLineages: 0,
    maximumNarrowingRenders: 0,
    expectedAtomicPieces: freezeArray([]),
    perParent: freezeArray([]),
    measuredLineages: freezeArray([]),
    nodes: freezeArray([]),
  });
}

export function emptyLineagedFartherPanelEvidence(maximumPanelRenders = 0, maximumReachSteps = 0) {
  return Object.freeze({
    panels: freezeArray([]) as readonly LineagedFartherPanelEvidence[],
    panelRenders: 0,
    maximumPanelRenders: Number.isSafeInteger(maximumPanelRenders) ? maximumPanelRenders : 0,
    maximumReachSteps: Number.isSafeInteger(maximumReachSteps) ? maximumReachSteps : 0,
    nodes: freezeArray([]) as readonly LineagedFartherNode[],
  });
}
