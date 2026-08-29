import { describe, expect, it } from "vitest";

import { CONNECTOR_PAIR_RULES, PART_DEFINITIONS } from "@lego-studio/catalog";

import {
  connectionEndpointKey,
  projectConnectionSemantics,
} from "./connection-semantics-projection";
import { findCatalogCollisions } from "./collisions";
import { createPartInstance } from "./factory";
import { createAttachedTransform } from "./transforms";

const UPRIGHT_ORIENTATIONS = [
  "upright-yaw-0",
  "upright-yaw-90",
  "upright-yaw-180",
  "upright-yaw-270",
] as const;

describe("3245b blind axle-holder connection semantics", () => {
  it("refuses every upright attempt to point a horizontal 4519 axle into the vertical blind mouth", () => {
    const holder = createPartInstance({
      id: "holder",
      catalogPartId: "builtin:brick-1x2x2-inside-axle-holder",
    });

    for (const orientationId of UPRIGHT_ORIENTATIONS) {
      expect(() =>
        createAttachedTransform(
          holder,
          "blindAxleHole:0",
          "builtin:axle-1x3",
          "axle:0",
          orientationId,
        ),
      ).toThrow(/must be opposed/u);
    }
  });

  it("authors the catalog-legal horizontal axle seat through the proper orientation", () => {
    const holder = createPartInstance({
      id: "holder",
      catalogPartId: "builtin:brick-1x2x2-inside-axle-holder",
    });
    const transform = createAttachedTransform(
      holder,
      "blindAxleHole:0",
      "builtin:axle-1x3",
      "axle:0",
      "proper-m-00pp000p0",
    );
    const axle = createPartInstance({
      id: "axle",
      catalogPartId: "builtin:axle-1x3",
      transform,
    });

    expect(transform).toEqual({
      positionLdu: [0, 22, 0],
      orientationId: "proper-m-00pp000p0",
    });
    expect(findCatalogCollisions([holder, axle], [])).toEqual([]);
  });

  it("binds the one-sided span into the endpoint semantics digest", () => {
    const key = connectionEndpointKey("builtin:brick-1x2x2-inside-axle-holder", "blindAxleHole:0");
    const baseline = projectConnectionSemantics(
      PART_DEFINITIONS,
      CONNECTOR_PAIR_RULES,
      "live-strict",
    );
    const mutated = PART_DEFINITIONS.map((part) =>
      part.id !== "builtin:brick-1x2x2-inside-axle-holder"
        ? part
        : {
            ...part,
            connectors: part.connectors.map((connector) =>
              connector.kind !== "blindAxleHole"
                ? connector
                : {
                    ...connector,
                    axialSpan: { ...connector.axialSpan, depthLdu: 43 },
                  },
            ),
          },
    );

    expect(baseline.endpointDigests.get(key)).toBeDefined();
    expect(
      projectConnectionSemantics(mutated, CONNECTOR_PAIR_RULES, "live-strict").endpointDigests.get(
        key,
      ),
    ).not.toBe(baseline.endpointDigests.get(key));
  });
});
