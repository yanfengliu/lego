import { getPartDefinition } from "@lego-studio/catalog";
import {
  canonicalSha256,
  createAttachedTransform,
  createPartInstance,
  getConnectorWorldFrame,
} from "@lego-studio/brick-kernel";
import type {
  BrickDocumentV1,
  BuildOperation,
  ConnectionEdge,
  PartInstance,
  RigidTransform,
} from "@lego-studio/protocol";

import {
  assessSupport,
  endpointKey,
  findStudConnections,
  type DiscoveredConnection,
} from "./placement";

export class ManualCommandError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "ManualCommandError";
  }
}

function occupiedPorts(document: BrickDocumentV1): ReadonlySet<string> {
  return new Set(
    document.connections.flatMap(({ a, b }) => [
      endpointKey(a.partId, a.portId),
      endpointKey(b.partId, b.portId),
    ]),
  );
}

function requirePart(document: BrickDocumentV1, partId: string): PartInstance {
  const part = document.parts.find(({ id }) => id === partId);
  if (!part) throw new ManualCommandError(`Part does not exist: ${partId}`);
  return part;
}

function nextId(
  prefix: "manual-part" | "manual-connection" | "manual-operation" | "manual-step",
  seed: unknown,
) {
  return `${prefix}-${canonicalSha256(seed).slice(0, 20)}`;
}

export interface AddPartCommandOptions {
  readonly catalogPartId: string;
  readonly colorId: string;
  readonly selectedPartId: string | null;
}

export function createAddPartTransaction(
  document: BrickDocumentV1,
  { catalogPartId, colorId, selectedPartId }: AddPartCommandOptions,
): {
  readonly label: string;
  readonly operations: readonly BuildOperation[];
  readonly partId: string;
} {
  const definition = getPartDefinition(catalogPartId);
  if (!definition) throw new ManualCommandError(`Unknown catalog part: ${catalogPartId}`);
  if (!definition.availableColorIds.includes(colorId)) {
    throw new ManualCommandError(`Color ${colorId} is unavailable for ${catalogPartId}`);
  }
  if (document.parts.length >= document.constraints.maxParts) {
    throw new ManualCommandError("The document part budget is exhausted");
  }
  if (document.parts.length > 0 && selectedPartId === null) {
    throw new ManualCommandError("Select a part to choose the attachment target");
  }

  const seed = {
    revision: document.revision,
    partCount: document.parts.length,
    catalogPartId,
    colorId,
    selectedPartId,
  };
  const partId = nextId("manual-part", seed);
  let transform: RigidTransform = {
    positionLdu: [0, 0, 0],
    orientationId: "upright-yaw-0",
  };
  let submodelId = document.submodels[0]?.id ?? "root";
  let stepId = document.steps[0]?.id ?? "step-1";
  let targetPortId: string | undefined;
  let targetPart: PartInstance | undefined;

  if (selectedPartId !== null) {
    const selectedTargetPart = requirePart(document, selectedPartId);
    targetPart = selectedTargetPart;
    const targetDefinition = getPartDefinition(selectedTargetPart.catalogPartId);
    if (!targetDefinition) throw new ManualCommandError("The selected part has no catalog truth");
    const occupied = occupiedPorts(document);
    targetPortId = targetDefinition.connectors
      .filter(({ kind }) => kind === "stud")
      .map(({ id }) => id)
      .find((portId) => !occupied.has(endpointKey(selectedTargetPart.id, portId)));
    if (!targetPortId) throw new ManualCommandError("The selected part has no free top stud");
    const undersidePort = definition.connectors.find(({ kind }) => kind === "undersideClutch");
    if (!undersidePort) throw new ManualCommandError("The new part has no underside clutch port");
    transform = createAttachedTransform(
      selectedTargetPart,
      targetPortId,
      catalogPartId,
      undersidePort.id,
      selectedTargetPart.transform.orientationId,
    );
    submodelId = selectedTargetPart.submodelId;
    stepId = selectedTargetPart.stepId;
  }

  const part = createPartInstance({
    id: partId,
    catalogPartId,
    colorId,
    transform,
    submodelId,
    stepId,
    source: "manual",
  });
  const operations: BuildOperation[] = [
    {
      kind: "addPart",
      operationId: nextId("manual-operation", { ...seed, kind: "addPart" }),
      part,
      semanticRegionIds: [],
    },
  ];

  if (targetPart && targetPortId !== undefined) {
    const occupied = occupiedPorts(document);
    const targetDefinition = getPartDefinition(targetPart.catalogPartId)!;
    const attachmentPairs = targetDefinition.connectors
      .filter(
        (connector) =>
          connector.kind === "stud" && !occupied.has(endpointKey(targetPart.id, connector.id)),
      )
      .flatMap((targetConnector) => {
        const targetFrame = getConnectorWorldFrame(targetPart, targetConnector.id);
        return definition.connectors
          .filter(({ kind }) => kind === "undersideClutch")
          .filter((newConnector) => {
            const newFrame = getConnectorWorldFrame(part, newConnector.id);
            return (
              targetFrame.positionLdu.every(
                (coordinate, axis) => coordinate === newFrame.positionLdu[axis],
              ) &&
              targetFrame.normal.every((coordinate, axis) => coordinate === -newFrame.normal[axis]!)
            );
          })
          .map((newConnector) => ({ targetConnector, newConnector }));
      })
      .sort(
        (left, right) =>
          left.targetConnector.id.localeCompare(right.targetConnector.id) ||
          left.newConnector.id.localeCompare(right.newConnector.id),
      );
    attachmentPairs.forEach(({ targetConnector, newConnector }, index) => {
      const connectionSeed = {
        ...seed,
        kind: "addConnection",
        index,
        targetPortId: targetConnector.id,
        newPortId: newConnector.id,
      };
      operations.push({
        kind: "addConnection",
        operationId: nextId("manual-operation", connectionSeed),
        connection: {
          id: nextId("manual-connection", connectionSeed),
          kind: "stud-tube",
          a: { partId: targetPart.id, portId: targetConnector.id },
          b: { partId, portId: newConnector.id },
          provenance: { source: "manual" },
        },
      });
    });
  }

  return { label: `Add ${definition.displayName}`, operations, partId };
}

/**
 * The step this placement belongs in. A fresh document opens with one empty
 * step, so the first placement fills it rather than leaving a step that adds
 * nothing to the build; every later placement opens the next one.
 */
function resolveBuildStep(
  document: BrickDocumentV1,
  seed: Record<string, unknown>,
): {
  readonly step: {
    readonly id: string;
    readonly index: number;
    readonly name: string;
    readonly partIds: readonly string[];
  };
  readonly isNew: boolean;
} {
  const ordered = [...document.steps].sort((left, right) => left.index - right.index);
  const last = ordered.at(-1);
  if (last && last.partIds.length === 0) return { step: last, isNew: false };

  const index = (last?.index ?? -1) + 1;
  return {
    step: {
      id: nextId("manual-step", { ...seed, kind: "addStep", index }),
      index,
      name: `Step ${index + 1}`,
      partIds: [],
    },
    isNew: true,
  };
}

export interface PlacePartCommandOptions {
  readonly catalogPartId: string;
  readonly colorId: string;
  readonly transform: RigidTransform;
}

function connectionOperations(
  discovered: readonly DiscoveredConnection[],
  candidatePartId: string,
  seed: Record<string, unknown>,
): BuildOperation[] {
  return discovered.map(({ targetPartId, targetPortId, candidatePortId }, index) => {
    const connectionSeed = { ...seed, kind: "addConnection", index, targetPortId, candidatePortId };
    return {
      kind: "addConnection",
      operationId: nextId("manual-operation", connectionSeed),
      connection: {
        id: nextId("manual-connection", connectionSeed),
        kind: "stud-tube",
        a: { partId: targetPartId, portId: targetPortId },
        b: { partId: candidatePartId, portId: candidatePortId },
        provenance: { source: "manual" },
      },
    } satisfies BuildOperation;
  });
}

/**
 * Places a part at an explicit transform rather than deriving one from the
 * selection, and attaches every stud it happens to land on. A placement that
 * touches nothing is allowed: manual editing may leave the document
 * draft-invalid, and the validator overlay is what tells the user so.
 */
export function createPlacePartTransaction(
  document: BrickDocumentV1,
  { catalogPartId, colorId, transform }: PlacePartCommandOptions,
): {
  readonly label: string;
  readonly operations: readonly BuildOperation[];
  readonly partId: string;
} {
  const definition = getPartDefinition(catalogPartId);
  if (!definition) throw new ManualCommandError(`Unknown catalog part: ${catalogPartId}`);
  if (!definition.availableColorIds.includes(colorId)) {
    throw new ManualCommandError(`Color ${colorId} is unavailable for ${catalogPartId}`);
  }
  if (document.parts.length >= document.constraints.maxParts) {
    throw new ManualCommandError(
      `The document part budget is exhausted: ${document.parts.length} of ${document.constraints.maxParts} parts are placed`,
    );
  }

  const seed = {
    revision: document.revision,
    partCount: document.parts.length,
    catalogPartId,
    colorId,
    transform,
  };
  const partId = nextId("manual-part", seed);
  const part = createPartInstance({
    id: partId,
    catalogPartId,
    colorId,
    transform,
    submodelId: document.submodels[0]?.id ?? "root",
    stepId: document.steps[0]?.id ?? "step-1",
    source: "manual",
  });

  const discovered = findStudConnections(part, document.parts, occupiedPorts(document));
  const support = assessSupport(part, discovered);
  if (!support.supported) throw new ManualCommandError(support.reason);

  // Each placement becomes its own build step, so the model can be replayed in
  // the order it was actually built.
  const { step, isNew } = resolveBuildStep(document, seed);
  const placed = { ...part, stepId: step.id };
  return {
    label: `Place ${definition.displayName}`,
    operations: [
      ...(isNew
        ? [
            {
              kind: "addStep" as const,
              operationId: nextId("manual-operation", { ...seed, kind: "addStep" }),
              step,
            },
          ]
        : []),
      {
        kind: "addPart",
        operationId: nextId("manual-operation", { ...seed, kind: "addPart" }),
        part: placed,
        semanticRegionIds: [],
      },
      ...connectionOperations(discovered, partId, seed),
    ],
    partId,
  };
}

/**
 * What would hold a repositioned part up, worked out the way a real detach
 * works: its own incident edges are dropped first, then every pairing is
 * rediscovered at the destination.
 *
 * Both halves matter, and each one alone is a bug. Carrying the incident edges
 * over holds a part up by connections it has moved out from under — a false
 * accept. Rediscovering without dropping them first finds their target ports
 * still occupied, so a part set back down on the very studs it came from
 * discovers nothing and is refused — a false refusal, which in an editor is the
 * worse of the two because the user cannot work around it.
 */
function rediscoverAfterDetach(
  document: BrickDocumentV1,
  after: PartInstance,
  incident: readonly ConnectionEdge[],
): readonly DiscoveredConnection[] {
  const remainingOccupied = new Set(
    document.connections
      .filter((connection) => !incident.includes(connection))
      .flatMap(({ a, b }) => [endpointKey(a.partId, a.portId), endpointKey(b.partId, b.portId)]),
  );
  return findStudConnections(
    after,
    document.parts.filter(({ id }) => id !== after.id),
    remainingOccupied,
  );
}

/**
 * Moves an existing part to a new transform. Dragging is an explicit detach, so
 * incident edges are dropped and then rediscovered at the destination rather
 * than being carried along with stale geometry.
 */
export function createMovePartTransaction(
  document: BrickDocumentV1,
  partId: string,
  transform: RigidTransform,
): { readonly label: string; readonly operations: readonly BuildOperation[] } {
  const before = requirePart(document, partId);
  const definition = getPartDefinition(before.catalogPartId);
  if (!definition) throw new ManualCommandError(`Unknown catalog part: ${before.catalogPartId}`);
  if (!definition.legalOrientationIds.includes(transform.orientationId)) {
    throw new ManualCommandError(
      `Orientation ${transform.orientationId} is illegal for ${before.catalogPartId}`,
    );
  }

  const seed = { revision: document.revision, partId, transform };
  const incident = document.connections
    .filter(({ a, b }) => a.partId === partId || b.partId === partId)
    .sort((left, right) => left.id.localeCompare(right.id));
  const after = { ...before, transform, provenance: { source: "manual" as const } };

  const discovered = rediscoverAfterDetach(document, after, incident);
  const support = assessSupport(after, discovered);
  if (!support.supported) throw new ManualCommandError(support.reason);

  return {
    label: `Move ${definition.displayName}`,
    operations: [
      ...incident.map((connection, index) => ({
        kind: "removeConnection" as const,
        operationId: nextId("manual-operation", { ...seed, kind: "detach", index }),
        connection,
      })),
      {
        kind: "updatePart",
        operationId: nextId("manual-operation", { ...seed, kind: "updatePart" }),
        before,
        after,
      },
      ...connectionOperations(discovered, partId, seed),
    ],
  };
}

export function createRemovePartTransaction(
  document: BrickDocumentV1,
  partId: string,
): { readonly label: string; readonly operations: readonly BuildOperation[] } {
  const part = requirePart(document, partId);
  const operations: BuildOperation[] = document.connections
    .filter(({ a, b }) => a.partId === partId || b.partId === partId)
    .sort((left, right) => left.id.localeCompare(right.id))
    .map((connection, index) => ({
      kind: "removeConnection",
      operationId: nextId("manual-operation", { revision: document.revision, partId, index }),
      connection,
    }));
  operations.push({
    kind: "removePart",
    operationId: nextId("manual-operation", {
      revision: document.revision,
      partId,
      kind: "remove",
    }),
    part,
    semanticRegionIds: document.semanticRegions
      .filter((region) => region.partIds.includes(part.id))
      .map((region) => region.id),
  });
  return { label: `Remove ${part.id}`, operations };
}

export function createUpdatePartTransaction(
  document: BrickDocumentV1,
  partId: string,
  changes: Partial<Pick<PartInstance, "colorId" | "transform" | "stepId">>,
  detachConnections: boolean,
): { readonly label: string; readonly operations: readonly BuildOperation[] } {
  const before = requirePart(document, partId);
  const incident = document.connections
    .filter(({ a, b }) => a.partId === partId || b.partId === partId)
    .sort((left, right) => left.id.localeCompare(right.id));
  const transformChanged =
    changes.transform !== undefined &&
    (changes.transform.orientationId !== before.transform.orientationId ||
      changes.transform.positionLdu.some(
        (coordinate, axis) => coordinate !== before.transform.positionLdu[axis],
      ));
  if (incident.length > 0 && !detachConnections && transformChanged) {
    throw new ManualCommandError("Moving a connected part requires an explicit detach");
  }

  const after = { ...before, ...changes, provenance: { source: "manual" as const } };
  // One rediscovery, read twice: it decides whether the edit is accepted, and
  // it is the edge set the accepted edit writes. Discovering it a second time
  // for the operations would let the two answers drift apart — the command
  // could accept a seat on the strength of pairings it then failed to record.
  const discovered = rediscoverAfterDetach(document, after, incident);
  // A transform typed into the inspector has to hold the part up exactly as a
  // drag does. The detach guard above is not that check: it asks whether the
  // user consented to dropping the edges, not whether anything is left holding
  // the part once they are dropped. Without this a floating Y is accepted, and
  // in a one-part document not even the validator objects, because connectivity
  // is trivially satisfied by a single part.
  //
  // Only a transform change can alter what supports a part, so a recolour or a
  // step reassignment is left alone rather than re-litigating a position the
  // user did not touch.
  if (transformChanged) {
    const support = assessSupport(after, discovered);
    if (!support.supported) throw new ManualCommandError(support.reason);
  }

  // Operation-id seeds. The three families this command emits carry disjoint
  // key sets under canonical JSON — detach is {revision, partId, kind, index},
  // updatePart is {revision, partId, changes}, and every reattachment is that
  // seed plus {kind, index, targetPortId, candidatePortId} — so no two encode
  // to the same bytes and no two can share an id. Within the reattachment
  // family `index` separates the edges, and `changes` keeps two edits of the
  // same part in the same revision apart. Every input is a value already in the
  // document or the caller's request, so a re-run reproduces the same ids.
  const seed = { revision: document.revision, partId, changes };
  const operations: BuildOperation[] = detachConnections
    ? incident.map((connection, index) => ({
        kind: "removeConnection",
        operationId: nextId("manual-operation", {
          revision: document.revision,
          partId,
          kind: "detach",
          index,
        }),
        connection,
      }))
    : [];
  operations.push({
    kind: "updatePart",
    operationId: nextId("manual-operation", seed),
    before,
    after,
  });
  // Detaching without reattaching leaves the document's edge set describing
  // geometry that is gone: a part seated perfectly on new studs reads as
  // DISCONNECTED_ASSEMBLY, and the studs it now sits on still look free, so a
  // later placement can double-occupy them. A drag already reattaches; typing
  // the same transform into the inspector has to reach the same document.
  //
  // A transform change without a detach is emitted too, and cannot duplicate:
  // the guard above only lets that case through when the part had no incident
  // edges at all.
  if (detachConnections || transformChanged) {
    operations.push(...connectionOperations(discovered, partId, seed));
  }
  return { label: `Edit ${partId}`, operations };
}
