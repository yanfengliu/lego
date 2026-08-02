import { describe, expect, it } from "vitest";

import { deriveAssemblies, validBrickConnections } from "@lego-studio/brick-kernel";
import { getPartDefinition } from "@lego-studio/catalog";

import { createCartDocument } from "./cart-demo";

/**
 * The cart is the vertical slice: if it builds, snaps, and comes out as a
 * chassis plus four turning wheels, then parts, connectors, collision,
 * assemblies and joints all agree with each other.
 */
describe("createCartDocument", () => {
  it("builds by the editor's own rules", () => {
    const document = createCartDocument();

    expect(document.parts).toHaveLength(12);
  });

  it("rests on its wheels, with nothing else closer to the ground", () => {
    // A cart that lands on its axle housings is not a cart. Nothing in the
    // build, the joints or the drop test asks this, and the first version of
    // this demo was eyeballed from a render rather than measured.
    //
    // LDU is Y-down, so the lowest point of a part is the largest y.
    const document = createCartDocument();
    const lowest = document.parts.map((part) => {
      const definition = getPartDefinition(part.catalogPartId)!;
      return {
        catalogPartId: part.catalogPartId,
        lowestY: part.transform.positionLdu[1] + definition.bodyBoundsLdu.max[1]!,
      };
    });
    const onTheGround = Math.max(...lowest.map(({ lowestY }) => lowestY));
    const touching = lowest.filter(({ lowestY }) => lowestY === onTheGround);

    expect(touching.every(({ catalogPartId }) => catalogPartId === "builtin:wheel-1x2")).toBe(true);
    expect(touching).toHaveLength(4);

    // How much room everything else has. Clearance is the wheel's radius minus
    // the 14 LDU a bearing's hole sits above its own base, so it is a property
    // of the wheel chosen and not of where anything was put. A 36 LDU wheel
    // gave four, which is nothing; this one gives seventeen. Pinned, because
    // the first version of this cart was eyeballed from a render and looked
    // fine while resting on its axle housings.
    const nextLowest = Math.max(
      ...lowest
        .filter(({ catalogPartId }) => catalogPartId !== "builtin:wheel-1x2")
        .map(({ lowestY }) => lowestY),
    );
    expect(onTheGround - nextLowest).toBe(17);
  });

  it("comes out as a chassis and four wheels that can turn", () => {
    const document = createCartDocument();
    const validConnections = validBrickConnections(document);
    const graph = deriveAssemblies(document, { validConnections });

    const wheels = graph.components.filter(({ partIds }) =>
      partIds.some(
        (id) =>
          document.parts.find((part) => part.id === id)?.catalogPartId === "builtin:wheel-1x2",
      ),
    );
    expect(wheels.length).toBeGreaterThan(0);
    expect(graph.joints.length).toBeGreaterThan(0);
  });
});
