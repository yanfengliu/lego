import { thumbnailDistance } from "./part-thumbnail-image.mjs";

export const PART_MATCH_SCHEMA = "lego.part-identification-match/3";
export const PART_DISTANCES_SCHEMA = "lego.part-identification-distances/3";
export const PART_IDENTIFICATION_MATCH_NOTE =
  "Geometry only: legacy distance clusters refined by each drawing's unique inventory minimum.";
export const PART_IDENTIFICATION_DISTANCES_NOTE =
  "Every refined cluster lead against every element, in canonical elementIds order.";

export const PART_IDENTIFICATION_CLUSTER_GUARD = Object.freeze({
  algorithm: "thumbnail-distance-then-inventory-top-refinement/1",
  maximumDistanceExclusive: 0.055,
  noCrossBaseClusterMerge: true,
  elementOrder: "code-point-ascending",
  calloutOrder: "pixels-desc-feature-index-asc",
  inventoryGuard: "unique-minimum-total-or-null",
  candidateOrder: "total-asc-element-id-code-point-asc",
});

const compareElementIds = (left, right) => (left < right ? -1 : left > right ? 1 : 0);

/**
 * Re-derives the complete match partition and every retained lead-distance row.
 *
 * The legacy distance-only greedy partition remains the outer boundary. Within
 * each legacy cluster, a member may inherit its refined lead's later claim only
 * when both drawings independently have the same unique best inventory element
 * and remain inside the direct distance guard. Exact minimum ties are null and
 * non-inheriting. Full inventory totals and physical-pair distances are cached,
 * so the declared member-by-inventory plus one all-pairs work bound is honest.
 *
 * @internal Callers must first authenticate and run `assertFeaturesArtifact`.
 * This allocation-oriented primitive deliberately does not repeat the feature
 * count, descriptor-shape, and comparison-work preflight on every use.
 */
export function derivePartIdentificationMatch(features, candidateLimit = 6) {
  if (!Number.isSafeInteger(candidateLimit) || candidateLimit < 1 || candidateLimit > 32) {
    throw new RangeError(
      `Part-identification candidate limit must be a safe integer from 1 through 32; received ${JSON.stringify(candidateLimit)}.`,
    );
  }
  const elementIds = Object.keys(features.inventory).sort(compareElementIds);
  const physicalIndexes = [...features.callouts.keys()].filter(
    (index) => features.callouts[index].evidenceKind === "part-art",
  );
  if (elementIds.length < 1 || physicalIndexes.length < 1) {
    throw new TypeError(
      `Part-identification derivation requires at least one inventory element and one physical callout; received ${elementIds.length}/${physicalIndexes.length}. Validate the feature artifact before deriving match semantics.`,
    );
  }
  const totalsByCallout = new Map();
  const topByCallout = new Map();
  for (const index of physicalIndexes) {
    const descriptor = features.callouts[index].descriptor;
    const totals = new Float64Array(elementIds.length);
    let minimum = Number.POSITIVE_INFINITY;
    let minimumElementId = null;
    let minimumCount = 0;
    for (const [elementIndex, elementId] of elementIds.entries()) {
      const total = thumbnailDistance(descriptor, features.inventory[elementId]).total;
      if (!Number.isFinite(total)) {
        throw new TypeError(
          `Part-identification inventory distance for physical callout ${index} and element ${JSON.stringify(elementId)} must be finite; received ${JSON.stringify(total)}. Validate the feature artifact before deriving match semantics.`,
        );
      }
      totals[elementIndex] = total;
      if (total < minimum) {
        minimum = total;
        minimumElementId = elementId;
        minimumCount = 1;
      } else if (total === minimum) {
        minimumCount += 1;
      }
    }
    totalsByCallout.set(index, totals);
    topByCallout.set(index, minimumCount === 1 ? minimumElementId : null);
  }

  const order = [...physicalIndexes].sort(
    (left, right) =>
      features.callouts[right].descriptor.pixels - features.callouts[left].descriptor.pixels ||
      left - right,
  );
  const physicalPosition = new Map(physicalIndexes.map((index, position) => [index, position]));
  const pairTotals = new Float64Array((physicalIndexes.length * (physicalIndexes.length - 1)) / 2);
  pairTotals.fill(Number.NaN);
  const pairDistance = (leftIndex, rightIndex) => {
    if (leftIndex === rightIndex) return 0;
    let left = physicalPosition.get(leftIndex);
    let right = physicalPosition.get(rightIndex);
    if (left > right) [left, right] = [right, left];
    const offset = (right * (right - 1)) / 2 + left;
    let total = pairTotals[offset];
    if (Number.isNaN(total)) {
      total = thumbnailDistance(
        features.callouts[leftIndex].descriptor,
        features.callouts[rightIndex].descriptor,
      ).total;
      if (!Number.isFinite(total)) {
        throw new TypeError(
          `Part-identification pair distance for physical callouts ${leftIndex}/${rightIndex} must be finite; received ${JSON.stringify(total)}. Validate the feature artifact before deriving match semantics.`,
        );
      }
      pairTotals[offset] = total;
    }
    return total;
  };

  // First reproduce the legacy threshold-only greedy partition exactly.
  const baseGroups = [];
  for (const index of order) {
    let joined = false;
    for (const group of baseGroups) {
      if (
        pairDistance(index, group.leadIndex) <
        PART_IDENTIFICATION_CLUSTER_GUARD.maximumDistanceExclusive
      ) {
        group.members.push(index);
        joined = true;
        break;
      }
    }
    if (!joined) baseGroups.push({ leadIndex: index, members: [index] });
  }

  // Refine in place. No member is ever compared with or moved into another
  // legacy base cluster, even if a foreign lead has the same inventory top.
  const groups = [];
  for (const baseGroup of baseGroups) {
    const refined = [];
    for (const index of baseGroup.members) {
      const memberTop = topByCallout.get(index);
      let joined = false;
      if (memberTop !== null) {
        for (const group of refined) {
          if (
            memberTop === topByCallout.get(group.leadIndex) &&
            pairDistance(index, group.leadIndex) <
              PART_IDENTIFICATION_CLUSTER_GUARD.maximumDistanceExclusive
          ) {
            group.members.push(index);
            joined = true;
            break;
          }
        }
      }
      if (!joined)
        refined.push({ baseLeadIndex: baseGroup.leadIndex, leadIndex: index, members: [index] });
    }
    groups.push(...refined);
  }

  const rows = [];
  const clusters = groups.map((group, clusterIndex) => {
    const descriptor = features.callouts[group.leadIndex].descriptor;
    const totals = totalsByCallout.get(group.leadIndex);
    const rankedIndexes = [...elementIds.keys()].sort(
      (left, right) =>
        totals[left] - totals[right] || compareElementIds(elementIds[left], elementIds[right]),
    );
    const candidates = rankedIndexes.slice(0, candidateLimit).map((elementIndex) => ({
      elementId: elementIds[elementIndex],
      ...thumbnailDistance(descriptor, features.inventory[elementIds[elementIndex]]),
    }));
    rows.push(Array.from(totals));
    return {
      clusterIndex,
      lead: features.callouts[group.leadIndex].file,
      members: [...group.members],
      memberTopElementIds: group.members.map((member) => topByCallout.get(member)),
      pieces: group.members.reduce(
        (total, member) => total + features.callouts[member].quantity,
        0,
      ),
      candidates,
      margin:
        (rankedIndexes[1] === undefined ? 1 : totals[rankedIndexes[1]]) - totals[rankedIndexes[0]],
    };
  });
  return {
    candidateLimit,
    clusterGuard: { ...PART_IDENTIFICATION_CLUSTER_GUARD },
    elementIds,
    clusters,
    rows,
  };
}

/** Canonical match bytes are built from the same derivation the verifier repeats. */
export function partIdentificationMatchValue(featuresDigest, derived) {
  return {
    schemaVersion: PART_MATCH_SCHEMA,
    featuresDigest,
    candidateLimit: derived.candidateLimit,
    clusterGuard: derived.clusterGuard,
    note: PART_IDENTIFICATION_MATCH_NOTE,
    clusterCount: derived.clusters.length,
    calloutCount: derived.clusters.reduce((total, cluster) => total + cluster.members.length, 0),
    clusters: derived.clusters,
  };
}

/** Distances are published only after the exact serialized match digest exists. */
export function partIdentificationDistancesValue(featuresDigest, matchDigest, derived) {
  return {
    schemaVersion: PART_DISTANCES_SCHEMA,
    featuresDigest,
    matchDigest,
    note: PART_IDENTIFICATION_DISTANCES_NOTE,
    elementIds: derived.elementIds,
    rows: derived.rows,
  };
}
