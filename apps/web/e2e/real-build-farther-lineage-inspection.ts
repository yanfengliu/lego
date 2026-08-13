import {
  projectFirstLineagedRevealingPanel,
  projectLineagedFartherCarry,
} from "./real-build-farther-lineage-inspection-inputs";
import { lineagedFartherInspectionFailureMessage } from "./real-build-farther-lineage-inspection-primitives";
import {
  projectLineagedFartherFrontier,
  projectLineagedFartherOrigin,
} from "./real-build-farther-lineage-inspection-projection";
import type {
  LineagedFartherInspectionKind,
  LineagedFartherInspectionSnapshot,
  LineagedFartherInspectionValueMap,
  LineagedFartherProjectionContext,
} from "./real-build-farther-lineage-inspection-types";

const snapshots = new WeakSet<object>();

function createProjectionContext(): LineagedFartherProjectionContext {
  return {
    budget: { entries: 0, stringUnits: 0, witnesses: 0, children: 0, scores: 0 },
    identities: new WeakMap(),
    candidates: new WeakMap(),
    nodes: new WeakMap(),
    witnesses: new WeakMap(),
    witnessArrays: new WeakMap(),
    snapshotsByCandidateId: new Map(),
    snapshotsByBytesHash: new Map(),
    chargedSnapshots: new WeakSet(),
    retainedSnapshotBytes: 0,
  };
}

export function snapshotLineagedFartherInspection<K extends LineagedFartherInspectionKind>(
  kind: K,
  value: unknown,
): LineagedFartherInspectionSnapshot<K> {
  if (kind !== "frontier" && kind !== "origin" && kind !== "carry" && kind !== "panel") {
    throw new TypeError(
      "Lineaged farther inspection kind must be frontier, origin, carry, or panel.",
    );
  }
  const context = createProjectionContext();
  let projected: LineagedFartherInspectionValueMap[LineagedFartherInspectionKind];
  try {
    if (kind === "frontier") {
      projected = projectLineagedFartherFrontier(value, "lineaged frontier", context);
    } else if (kind === "origin") {
      projected = projectLineagedFartherOrigin(value, context);
    } else if (kind === "carry") {
      projected = projectLineagedFartherCarry(value, context);
    } else {
      projected = projectFirstLineagedRevealingPanel(value, context);
    }
  } catch (error) {
    const failureMessage = lineagedFartherInspectionFailureMessage(error);
    if (failureMessage !== null) throw new TypeError(failureMessage, { cause: error });
    throw new TypeError("Lineaged farther input could not be inspected safely", {
      cause: error,
    });
  }
  const result = Object.freeze({ kind, value: projected }) as LineagedFartherInspectionSnapshot<K>;
  snapshots.add(result);
  return result;
}

export function requireLineagedFartherInspectionSnapshot<K extends LineagedFartherInspectionKind>(
  value: unknown,
  kind: K,
): LineagedFartherInspectionSnapshot<K> {
  if (value === null || typeof value !== "object" || !snapshots.has(value)) {
    throw new TypeError(
      "Lineaged farther validation requires an exact bounded inspection snapshot.",
    );
  }
  const result = value as LineagedFartherInspectionSnapshot<K>;
  if (result.kind !== kind) {
    throw new TypeError(
      "Lineaged farther validation requires the matching inspection snapshot kind.",
    );
  }
  return result;
}
