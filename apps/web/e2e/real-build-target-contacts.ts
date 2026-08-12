import {
  connectorPairRule,
  getPartDefinition,
  type ConnectorPortDefinition,
  type LduVector3,
} from "@lego-studio/catalog";
import type { RigidTransform } from "@lego-studio/protocol";

import {
  applyFramePoint,
  composeFrameTransforms,
  rigidTransformToFrameTransform,
  rotateFramePoint,
  type FrameTransform,
} from "./real-build-catalog-frame";

/** Hostile coincident connectors cannot turn refusal-only diagnostics quadratic. */
export const MAXIMUM_SEMANTIC_CONTACT_PAIR_COMPARISONS = 1_000_000;
export const MAXIMUM_SEMANTIC_CONTACTS = 100_000;
export const MAXIMUM_SEMANTIC_CONTACT_CONNECTORS = 500_000;

export interface SemanticContactPlacement {
  readonly identityKey: string;
  readonly stepNumber: number;
  readonly catalogPartId: string;
  readonly transform: RigidTransform;
}

export interface SemanticContactInference {
  readonly supported: boolean;
  readonly keys: readonly string[];
  readonly connectorCount: number;
  readonly pairComparisons: number;
  readonly witness: string | null;
}

interface ConnectorFrame {
  readonly placement: SemanticContactPlacement;
  readonly connector: ConnectorPortDefinition;
  readonly position: LduVector3;
  readonly normal: LduVector3;
}

const positionKey = (position: LduVector3): string => JSON.stringify(position);

function unsupported(
  connectorCount: number,
  pairComparisons: number,
  witness: string,
): SemanticContactInference {
  return { supported: false, keys: [], connectorCount, pairComparisons, witness };
}

function connectorFrames(
  placements: readonly SemanticContactPlacement[],
  globalFrame: FrameTransform,
): ConnectorFrame[] {
  const frames: ConnectorFrame[] = [];
  for (const placement of placements) {
    const definition = getPartDefinition(placement.catalogPartId);
    if (definition === undefined) {
      throw new TypeError(
        `Semantic contact placement ${JSON.stringify(placement.identityKey)} names unknown catalog part ${JSON.stringify(placement.catalogPartId)}.`,
      );
    }
    const world = composeFrameTransforms(
      globalFrame,
      rigidTransformToFrameTransform(placement.transform),
    );
    for (const connector of definition.connectors) {
      frames.push({
        placement,
        connector,
        position: applyFramePoint(world, connector.positionLdu),
        normal: rotateFramePoint(world, connector.normal),
      });
    }
  }
  return frames;
}

function contactKey(left: ConnectorFrame, right: ConnectorFrame): string | null {
  if (left.placement.identityKey === right.placement.identityKey) return null;
  const rule = connectorPairRule(left.connector.kind, right.connector.kind);
  if (rule === undefined) return null;
  const opposed = left.normal.every((coordinate, axis) => coordinate === -right.normal[axis]!);
  const collinear =
    opposed || left.normal.every((coordinate, axis) => coordinate === right.normal[axis]);
  if (rule.axisMatching === "opposed" ? !opposed : !collinear) return null;
  const ordered = [left, right].sort((a, b) =>
    a.placement.identityKey.localeCompare(b.placement.identityKey),
  );
  return JSON.stringify({
    firstStep: Math.max(left.placement.stepNumber, right.placement.stepNumber),
    positionLdu: left.position,
    endpoints: ordered.map(({ placement, connector, normal }) => ({
      identityKey: placement.identityKey,
      kind: connector.kind,
      geometryRole: connector.geometryRole,
      profileId: connector.profileId,
      gender: connector.gender,
      normal,
    })),
  });
}

/**
 * Infers exact semantic contacts by position bucket. The budget is calculated
 * before a bucket is scanned, so even a hostile all-coincident input has a
 * deterministic refusal cost instead of entering an all-pairs loop.
 */
export function inferSemanticContactKeys(input: {
  readonly placements: readonly SemanticContactPlacement[];
  readonly globalFrame: FrameTransform;
}): SemanticContactInference {
  const frames = connectorFrames(input.placements, input.globalFrame);
  if (frames.length > MAXIMUM_SEMANTIC_CONTACT_CONNECTORS) {
    return unsupported(
      frames.length,
      0,
      `Semantic contact inference has ${frames.length} connectors, above the ${MAXIMUM_SEMANTIC_CONTACT_CONNECTORS} fail-closed connector budget.`,
    );
  }
  const buckets = new Map<string, ConnectorFrame[]>();
  for (const frame of frames) {
    const key = positionKey(frame.position);
    const bucket = buckets.get(key) ?? [];
    bucket.push(frame);
    buckets.set(key, bucket);
  }
  const orderedBuckets = [...buckets.entries()].sort(([left], [right]) =>
    left.localeCompare(right),
  );
  let pairComparisons = 0;
  for (const [, bucket] of orderedBuckets) {
    pairComparisons += (bucket.length * (bucket.length - 1)) / 2;
    if (pairComparisons > MAXIMUM_SEMANTIC_CONTACT_PAIR_COMPARISONS) {
      return unsupported(
        frames.length,
        pairComparisons,
        `Semantic contact position buckets require ${pairComparisons} pair comparisons, above the ${MAXIMUM_SEMANTIC_CONTACT_PAIR_COMPARISONS} fail-closed budget.`,
      );
    }
  }
  const contacts: string[] = [];
  for (const [, bucket] of orderedBuckets) {
    bucket.sort(
      (left, right) =>
        left.placement.identityKey.localeCompare(right.placement.identityKey) ||
        left.connector.id.localeCompare(right.connector.id),
    );
    for (let leftIndex = 0; leftIndex < bucket.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < bucket.length; rightIndex += 1) {
        const key = contactKey(bucket[leftIndex]!, bucket[rightIndex]!);
        if (key === null) continue;
        contacts.push(key);
        if (contacts.length > MAXIMUM_SEMANTIC_CONTACTS) {
          return unsupported(
            frames.length,
            pairComparisons,
            `Semantic contact inference found more than ${MAXIMUM_SEMANTIC_CONTACTS} contacts; the refusal-only diagnostic is bounded and cannot retain this input.`,
          );
        }
      }
    }
  }
  contacts.sort((left, right) => left.localeCompare(right));
  return {
    supported: true,
    keys: contacts,
    connectorCount: frames.length,
    pairComparisons,
    witness: null,
  };
}
