import { describe, expect, it } from "vitest";

import { deriveAssemblies } from "./assemblies.ts";
import type { BrickDocumentV1, ConnectionEdge, PartInstance } from "@lego-studio/protocol";
import { createEmptyBrickDocument } from "./factory.ts";

/**
 * Rigid components are what a physics engine is handed, so they have to be
 * right before an engine exists. These drive `deriveAssemblies` on hand-built
 * documents: no rendering, no solver, no floating point.
 *
 * Connections are passed in already validated, which is the contract — an
 * unvalidated edge can claim a join the geometry does not support, and welding
 * two bodies on that claim would make a simulation disagree with the model.
 */
const part = (id: string, catalogPartId: string, positionLdu: readonly [number, number, number]) =>
  ({
    id,
    catalogPartId,
    colorId: "builtin:light-bluish-gray",
    transform: { positionLdu, orientationId: "upright-yaw-0" },
    submodelId: "root",
    stepId: "step-1",
    semanticTags: [],
    provenance: { source: "manual" },
  }) satisfies PartInstance;

const edge = (
  id: string,
  aPartId: string,
  aPortId: string,
  bPartId: string,
  bPortId: string,
): ConnectionEdge => ({
  id,
  kind: "stud-tube",
  a: { partId: aPartId, portId: aPortId },
  b: { partId: bPartId, portId: bPortId },
  provenance: { source: "manual" },
});

const documentOf = (parts: readonly PartInstance[]): BrickDocumentV1 => ({
  ...createEmptyBrickDocument({ id: "assemblies", name: "Assemblies" }),
  parts: [...parts],
});

describe("deriveAssemblies", () => {
  it("gives an unconnected part a component of its own", () => {
    const document = documentOf([
      part("a", "builtin:brick-2x4", [0, 0, 0]),
      part("b", "builtin:brick-2x4", [200, 0, 0]),
    ]);

    const graph = deriveAssemblies(document, { validConnections: [] });

    expect(graph.components.map(({ id }) => id)).toEqual(["assembly:a", "assembly:b"]);
  });

  it("welds a chain of rigid connections into one body", () => {
    const document = documentOf([
      part("a", "builtin:brick-2x4", [0, 0, 0]),
      part("b", "builtin:brick-2x4", [0, -24, 0]),
      part("c", "builtin:brick-2x4", [0, -48, 0]),
    ]);
    const validConnections = [
      edge("ab", "a", "stud:0:0", "b", "undersideClutch:0:0"),
      edge("bc", "b", "stud:0:0", "c", "undersideClutch:0:0"),
    ];

    const graph = deriveAssemblies(document, { validConnections });

    expect(graph.components).toHaveLength(1);
    expect(graph.components[0]!.partIds).toEqual(["a", "b", "c"]);
    // One body, and no constraint for either stud connection.
    expect(graph.joints).toEqual([]);
  });

  it("does not depend on the order connections arrive in", () => {
    const document = documentOf([
      part("a", "builtin:brick-2x4", [0, 0, 0]),
      part("b", "builtin:brick-2x4", [0, -24, 0]),
      part("c", "builtin:brick-2x4", [0, -48, 0]),
    ]);
    const ab = edge("ab", "a", "stud:0:0", "b", "undersideClutch:0:0");
    const bc = edge("bc", "b", "stud:0:0", "c", "undersideClutch:0:0");

    expect(deriveAssemblies(document, { validConnections: [ab, bc] })).toEqual(
      deriveAssemblies(document, { validConnections: [bc, ab] }),
    );
  });

  it("splits when the part bridging two halves is removed", () => {
    // The property the specification asks for by name: deleting a structural
    // part must split an assembly rather than leave one body behind.
    const parts = [
      part("a", "builtin:brick-2x4", [0, 0, 0]),
      part("bridge", "builtin:brick-2x4", [0, -24, 0]),
      part("c", "builtin:brick-2x4", [0, -48, 0]),
    ];
    const joined = [
      edge("ab", "a", "stud:0:0", "bridge", "undersideClutch:0:0"),
      edge("bc", "bridge", "stud:0:0", "c", "undersideClutch:0:0"),
    ];
    expect(deriveAssemblies(documentOf(parts), { validConnections: joined })).toHaveProperty(
      "components.length",
      1,
    );

    const withoutBridge = documentOf(parts.filter(({ id }) => id !== "bridge"));
    const graph = deriveAssemblies(withoutBridge, { validConnections: [] });

    expect(graph.components.map(({ id }) => id)).toEqual(["assembly:a", "assembly:c"]);
  });

  it("ignores a connection naming a part the document does not hold", () => {
    const document = documentOf([part("a", "builtin:brick-2x4", [0, 0, 0])]);

    const graph = deriveAssemblies(document, {
      validConnections: [edge("ghost", "a", "stud:0:0", "missing", "undersideClutch:0:0")],
    });

    expect(graph.components).toHaveLength(1);
    expect(graph.joints).toEqual([]);
  });

  it("maps every part to exactly one component", () => {
    const document = documentOf([
      part("a", "builtin:brick-2x4", [0, 0, 0]),
      part("b", "builtin:brick-2x4", [0, -24, 0]),
      part("loose", "builtin:plate-1x1", [200, 0, 0]),
    ]);

    const graph = deriveAssemblies(document, {
      validConnections: [edge("ab", "a", "stud:0:0", "b", "undersideClutch:0:0")],
    });

    expect([...graph.componentIdByPartId.keys()].sort()).toEqual(["a", "b", "loose"]);
    expect(graph.componentIdByPartId.get("a")).toBe(graph.componentIdByPartId.get("b"));
    expect(graph.componentIdByPartId.get("loose")).toBe("assembly:loose");
    expect(graph.components.flatMap(({ partIds }) => partIds)).toHaveLength(document.parts.length);
  });
});
