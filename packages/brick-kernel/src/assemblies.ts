import { connectorPairRule, getPartDefinition, type ConnectorRotation } from "@lego-studio/catalog";
import type { BrickDocumentV1, ConnectionEdge } from "@lego-studio/protocol";

/**
 * Which parts move together, and where they hinge.
 *
 * A physics engine wants one body per group of parts that cannot move relative
 * to each other, and one constraint per place they can. It does not want a body
 * per part or a constraint per stud: a 1465-piece model held together by studs
 * is one rigid thing, and simulating it as 1465 bodies joined by thousands of
 * constraints is both slower and less stable than simulating one.
 *
 * So this splits the document into rigid components over its *valid*
 * connections only, treating articulated pairs as boundaries rather than edges.
 * Whether a pair is rigid comes from the connector taxonomy, where it is a
 * property of the pair — the same axle is rigid in an axle hole and free in a
 * pin hole.
 *
 * Pure model: no engine, no scene, no floating point. It is the input physics
 * consumes, and it is correct or not on its own.
 */

export const ASSEMBLY_GRAPH_SCHEMA_VERSION = "lego.assembly-graph/1" as const;

export interface RigidComponent {
  /** Derived from the smallest part id it holds, so it is stable across runs. */
  readonly id: string;
  readonly partIds: readonly string[];
}

export interface ArticulatedJoint {
  readonly connectionId: string;
  readonly componentIds: readonly [string, string];
  readonly partIds: readonly [string, string];
  readonly allowedRotation: ConnectorRotation;
}

export interface AssemblyGraph {
  readonly schemaVersion: typeof ASSEMBLY_GRAPH_SCHEMA_VERSION;
  readonly components: readonly RigidComponent[];
  /** Joints between two different components; a joint inside one is not a joint. */
  readonly joints: readonly ArticulatedJoint[];
  readonly componentIdByPartId: ReadonlyMap<string, string>;
}

function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

/** The kind of a connection's endpoint, or undefined if the catalog lacks it. */
function endpointKind(
  endpoint: ConnectionEdge["a"],
  catalogPartIdByPartId: ReadonlyMap<string, string>,
) {
  const catalogPartId = catalogPartIdByPartId.get(endpoint.partId);
  if (catalogPartId === undefined) return undefined;
  return getPartDefinition(catalogPartId)?.connectors.find(({ id }) => id === endpoint.portId)
    ?.kind;
}

/**
 * How a connection behaves, or undefined when the taxonomy does not recognise
 * the pair. An unrecognised pair is treated as no edge at all rather than as a
 * rigid one, because joining two parts that cannot join must not silently weld
 * them into one body.
 */
export function connectionBehaviour(
  connection: ConnectionEdge,
  catalogPartIdByPartId: ReadonlyMap<string, string>,
) {
  const a = endpointKind(connection.a, catalogPartIdByPartId);
  const b = endpointKind(connection.b, catalogPartIdByPartId);
  if (a === undefined || b === undefined) return undefined;
  return connectorPairRule(a, b);
}

class DisjointSet {
  private readonly parent = new Map<string, string>();

  add(id: string): void {
    if (!this.parent.has(id)) this.parent.set(id, id);
  }

  find(id: string): string {
    let root = id;
    while (this.parent.get(root) !== root) root = this.parent.get(root)!;
    // Path compression, iteratively: a deep chain must not recurse.
    let walk = id;
    while (this.parent.get(walk) !== root) {
      const next = this.parent.get(walk)!;
      this.parent.set(walk, root);
      walk = next;
    }
    return root;
  }

  union(left: string, right: string): void {
    const a = this.find(left);
    const b = this.find(right);
    if (a === b) return;
    // Smaller id wins, so the representative does not depend on edge order.
    if (compareStrings(a, b) <= 0) this.parent.set(b, a);
    else this.parent.set(a, b);
  }
}

export interface DeriveAssembliesOptions {
  /**
   * Connections already found valid. Pass the validator's list: an unvalidated
   * edge can claim a join the geometry does not support, and welding two bodies
   * on that claim would make the simulation disagree with the model.
   */
  readonly validConnections: readonly ConnectionEdge[];
}

export function deriveAssemblies(
  document: BrickDocumentV1,
  { validConnections }: DeriveAssembliesOptions,
): AssemblyGraph {
  const catalogPartIdByPartId = new Map(
    document.parts.map((part) => [part.id, part.catalogPartId] as const),
  );
  const sets = new DisjointSet();
  for (const part of document.parts) sets.add(part.id);

  const articulated: { connection: ConnectionEdge; allowedRotation: ConnectorRotation }[] = [];
  for (const connection of validConnections) {
    if (!catalogPartIdByPartId.has(connection.a.partId)) continue;
    if (!catalogPartIdByPartId.has(connection.b.partId)) continue;
    const rule = connectionBehaviour(connection, catalogPartIdByPartId);
    if (rule === undefined) continue;
    if (rule.articulation === "rigid") {
      sets.union(connection.a.partId, connection.b.partId);
    } else {
      articulated.push({ connection, allowedRotation: rule.allowedRotation });
    }
  }

  const byRoot = new Map<string, string[]>();
  for (const part of document.parts) {
    const root = sets.find(part.id);
    const members = byRoot.get(root) ?? [];
    members.push(part.id);
    byRoot.set(root, members);
  }

  const components = [...byRoot.values()]
    .map((partIds) => {
      const sorted = [...partIds].sort(compareStrings);
      return { id: `assembly:${sorted[0]!}`, partIds: sorted } satisfies RigidComponent;
    })
    .sort((left, right) => compareStrings(left.id, right.id));

  const componentIdByPartId = new Map<string, string>();
  for (const component of components) {
    for (const partId of component.partIds) componentIdByPartId.set(partId, component.id);
  }

  const joints = articulated
    .map(({ connection, allowedRotation }) => {
      const aComponent = componentIdByPartId.get(connection.a.partId)!;
      const bComponent = componentIdByPartId.get(connection.b.partId)!;
      return {
        connectionId: connection.id,
        componentIds: [aComponent, bComponent] as const,
        partIds: [connection.a.partId, connection.b.partId] as const,
        allowedRotation,
      } satisfies ArticulatedJoint;
    })
    // An articulated connection inside one rigid component cannot move: some
    // other path through the graph already holds those parts together.
    .filter(({ componentIds }) => componentIds[0] !== componentIds[1])
    .sort((left, right) => compareStrings(left.connectionId, right.connectionId));

  return {
    schemaVersion: ASSEMBLY_GRAPH_SCHEMA_VERSION,
    components,
    joints,
    componentIdByPartId,
  };
}
