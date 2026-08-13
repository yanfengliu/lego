import {
  assertRealBuildLineageParent,
  REAL_BUILD_ID_MAXIMUM_LENGTH,
  REAL_BUILD_LINEAGE_MAXIMUM_STEP_NUMBER,
  type RealBuildLineageIdentity,
} from "./real-build-candidate-lineage-identity";
import {
  MAXIMUM_LINEAGED_FARTHER_LINEAGES,
  type FartherPlacementWitness,
} from "./real-build-farther-panel-types";
import type {
  InspectedLineagedFartherFrontier,
  InspectedLineagedFartherNode,
} from "./real-build-farther-lineage-inspection-types";

const shown = (value: string | number | null): string =>
  typeof value === "string" ? JSON.stringify(value) : String(value);

function duplicate(values: readonly string[]): string | null {
  const seen = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) return value;
    seen.add(value);
  }
  return null;
}

function witnessesError(pieces: readonly FartherPlacementWitness[], path: string): string | null {
  if (pieces.length === 0) return `${path} has no atomic placement witnesses`;
  for (let index = 0; index < pieces.length; index += 1) {
    const piece = pieces[index]!;
    if (
      piece.catalogPartId.length === 0 ||
      piece.catalogPartId.length > REAL_BUILD_ID_MAXIMUM_LENGTH ||
      piece.colorId.length === 0 ||
      piece.colorId.length > REAL_BUILD_ID_MAXIMUM_LENGTH
    ) {
      return `${path}[${index}] must bind catalogPartId and colorId of 1 through ${REAL_BUILD_ID_MAXIMUM_LENGTH} characters`;
    }
    if (
      piece.transform.orientationId.length === 0 ||
      piece.transform.orientationId.length > REAL_BUILD_ID_MAXIMUM_LENGTH
    ) {
      return `${path}[${index}].transform.orientationId must contain 1 through ${REAL_BUILD_ID_MAXIMUM_LENGTH} characters`;
    }
    const invalid = piece.transform.positionLdu.findIndex(
      (coordinate) => !Number.isSafeInteger(coordinate),
    );
    if (invalid >= 0) {
      return `${path}[${index}].transform.positionLdu[${invalid}] must be a safe-integer LDU coordinate`;
    }
  }
  return null;
}

function sameIdentity(left: RealBuildLineageIdentity, right: RealBuildLineageIdentity): boolean {
  return (
    left.lineageId === right.lineageId &&
    left.candidateId === right.candidateId &&
    left.documentHash === right.documentHash &&
    left.lineageOrigin === right.lineageOrigin &&
    left.originLineageId === right.originLineageId &&
    left.parentLineageId === right.parentLineageId &&
    left.throughStepNumber === right.throughStepNumber &&
    left.localIdentity.kind === right.localIdentity.kind &&
    left.localIdentity.id === right.localIdentity.id
  );
}

export function describeInspectedLineagedFartherFrontierError(
  frontier: InspectedLineagedFartherFrontier,
  path: string,
): string | null {
  if (!Number.isSafeInteger(frontier.originStepNumber) || frontier.originStepNumber < 1) {
    return `${path}.originStepNumber must be a positive safe integer`;
  }
  if (
    !Number.isSafeInteger(frontier.throughStepNumber) ||
    frontier.throughStepNumber < frontier.originStepNumber ||
    frontier.throughStepNumber > REAL_BUILD_LINEAGE_MAXIMUM_STEP_NUMBER
  ) {
    return `${path}.throughStepNumber must be at least originStepNumber ${frontier.originStepNumber}`;
  }
  if (
    !Number.isSafeInteger(frontier.observationPanelStepNumber) ||
    frontier.observationPanelStepNumber < frontier.throughStepNumber ||
    frontier.observationPanelStepNumber > REAL_BUILD_LINEAGE_MAXIMUM_STEP_NUMBER
  ) {
    return `${path}.observationPanelStepNumber must be at least throughStepNumber ${frontier.throughStepNumber}`;
  }
  if (
    !Number.isSafeInteger(frontier.panelRendersUsed) ||
    frontier.panelRendersUsed < 0 ||
    frontier.panelRendersUsed > MAXIMUM_LINEAGED_FARTHER_LINEAGES
  ) {
    return `${path}.panelRendersUsed must be a safe integer from 0 through ${MAXIMUM_LINEAGED_FARTHER_LINEAGES}`;
  }
  if (frontier.candidates.length === 0) {
    return `${path}.candidates must retain at least one lineage`;
  }
  if (frontier.nodes.length === 0 || frontier.nodes.length > MAXIMUM_LINEAGED_FARTHER_LINEAGES) {
    return `${path}.nodes must retain 1 through ${MAXIMUM_LINEAGED_FARTHER_LINEAGES} normalized lineage nodes`;
  }
  const repeated = duplicate(frontier.candidates.map(({ identity }) => identity.lineageId));
  if (repeated !== null) return `${path} repeats current lineageId ${shown(repeated)}`;
  const repeatedNode = duplicate(frontier.nodes.map(({ identity }) => identity.lineageId));
  if (repeatedNode !== null) return `${path}.nodes repeats lineageId ${shown(repeatedNode)}`;
  const nodeByLineageId = new Map(frontier.nodes.map((node) => [node.identity.lineageId, node]));
  const familyIds = new Set(
    frontier.candidates.map(({ fartherOriginLineageId }) => fartherOriginLineageId),
  );
  const decisionByParentCandidate = new Set<string>();
  for (let index = 0; index < frontier.nodes.length; index += 1) {
    const node = frontier.nodes[index]!;
    const nodePath = `${path}.nodes[${index}]`;
    if (node.documentSnapshot.documentHash !== node.identity.documentHash) {
      return `${nodePath}.documentSnapshot does not match identity.documentHash`;
    }
    if ((node.identity.localIdentity.kind === "decision") !== (node.pieces !== null)) {
      return `${nodePath} must retain witnesses exactly for decision identities`;
    }
    if (node.pieces !== null) {
      const defect = witnessesError(node.pieces, `${nodePath}.pieces`);
      if (defect !== null) return defect;
    }
    if (node.identity.localIdentity.kind === "decision") {
      const parentCandidateKey = `${node.identity.parentLineageId ?? "root"}\0${node.identity.candidateId}`;
      if (decisionByParentCandidate.has(parentCandidateKey)) {
        return `${nodePath} duplicates one candidate under the same direct parent`;
      }
      decisionByParentCandidate.add(parentCandidateKey);
    }
    if (familyIds.has(node.identity.lineageId)) {
      if (
        node.identity.localIdentity.kind !== "decision" ||
        node.identity.throughStepNumber !== frontier.originStepNumber ||
        node.pieces === null
      ) {
        return `${nodePath} is not a witnessed step-${frontier.originStepNumber} farther-origin decision`;
      }
      if (
        node.identity.parentLineageId !== null &&
        nodeByLineageId.has(node.identity.parentLineageId)
      ) {
        return `${nodePath} farther-origin family must be a local-root antichain member`;
      }
      continue;
    }
    const parent =
      node.identity.parentLineageId === null
        ? undefined
        : nodeByLineageId.get(node.identity.parentLineageId);
    if (parent === undefined) return `${nodePath} does not reference one retained direct parent`;
    try {
      assertRealBuildLineageParent(node.identity, parent.identity);
    } catch {
      return `${nodePath} does not preserve the exact direct-parent edge`;
    }
    if (node.identity.localIdentity.kind === "evidence") {
      if (
        node.identity.candidateId !== parent.identity.candidateId ||
        node.identity.documentHash !== parent.identity.documentHash ||
        node.identity.throughStepNumber !== parent.identity.throughStepNumber ||
        node.documentSnapshot !== parent.documentSnapshot
      ) {
        return `${nodePath} evidence edge must preserve the exact candidate, hash, document-prefix step, and snapshot reference`;
      }
    } else {
      if (node.identity.throughStepNumber !== parent.identity.throughStepNumber + 1) {
        return `${nodePath} decision edge must advance exactly one document-prefix step`;
      }
      if (node.documentSnapshot === parent.documentSnapshot) {
        return `${nodePath} decision edge must retain the exact advanced candidate snapshot`;
      }
    }
  }
  const resolvedFamily = new Map<string, string>();
  const reachable = new Set<string>();
  for (let index = 0; index < frontier.candidates.length; index += 1) {
    const candidate = frontier.candidates[index]!;
    const candidatePath = `${path}.candidates[${index}]`;
    const current = nodeByLineageId.get(candidate.identity.lineageId);
    if (
      current === undefined ||
      !sameIdentity(candidate.identity, current.identity) ||
      current.documentSnapshot !== candidate.documentSnapshot
    ) {
      return `${candidatePath} must equal one node identity and exact document-snapshot reference in the normalized lineage table`;
    }
    if (candidate.identity.throughStepNumber !== frontier.throughStepNumber) {
      return `${candidatePath}.identity.throughStepNumber is ${candidate.identity.throughStepNumber}; required ${frontier.throughStepNumber}`;
    }
    let cursor: InspectedLineagedFartherNode = current;
    const trail: string[] = [];
    const localSeen = new Set<string>();
    let family: string | undefined;
    while (family === undefined) {
      const lineageId = cursor.identity.lineageId;
      if (localSeen.has(lineageId)) return `${candidatePath} has a cyclic local lineage path`;
      localSeen.add(lineageId);
      reachable.add(lineageId);
      family = familyIds.has(lineageId) ? lineageId : resolvedFamily.get(lineageId);
      if (family !== undefined) break;
      trail.push(lineageId);
      const parentId: RealBuildLineageIdentity["parentLineageId"] = cursor.identity.parentLineageId;
      const parent: InspectedLineagedFartherNode | undefined =
        parentId === null ? undefined : nodeByLineageId.get(parentId);
      if (parent === undefined) return `${candidatePath} does not reach a farther-origin lineage`;
      cursor = parent;
    }
    for (const lineageId of trail) resolvedFamily.set(lineageId, family);
    if (family !== candidate.fartherOriginLineageId) {
      return `${candidatePath}.fartherOriginLineageId does not match its normalized direct-parent path`;
    }
  }
  return reachable.size === frontier.nodes.length
    ? null
    : `${path}.nodes must contain only nodes reachable from a current candidate through its farther-origin family`;
}
