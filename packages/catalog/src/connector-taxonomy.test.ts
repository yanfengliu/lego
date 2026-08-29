import { describe, expect, it } from "vitest";

import {
  CONNECTOR_KIND_RULES,
  CONNECTOR_PAIR_RULES,
  PART_DEFINITIONS,
  connectorAccepts,
  connectorPairRule,
} from "./index.js";
import type { ConnectorKind } from "./index.js";

const KINDS = Object.keys(CONNECTOR_KIND_RULES) as ConnectorKind[];

/**
 * The connector tables are the only place compatibility is written, so these
 * are the properties nothing else checks.
 *
 * Mutuality is not among them: one row names both halves of a pair, so there is
 * no way to say a stud accepts a clutch without also saying the reverse. That
 * was worth restructuring for — the first version put `accepts` on each kind
 * and immediately disagreed with itself about whether an axle fits a pin hole.
 */
describe("connector taxonomy", () => {
  it("only opposite genders join", () => {
    for (const { male, female } of CONNECTOR_PAIR_RULES) {
      expect(CONNECTOR_KIND_RULES[male].gender, `${male} is on the male side`).toBe("male");
      expect(CONNECTOR_KIND_RULES[female].gender, `${female} is on the female side`).toBe("female");
    }
  });

  it("every kind can join something", () => {
    for (const kind of KINDS) {
      expect(connectorAccepts(kind), `${kind} accepts nothing`).not.toHaveLength(0);
    }
  });

  it("accepting is symmetric, because a pair is one row", () => {
    for (const kind of KINDS) {
      for (const other of connectorAccepts(kind)) {
        expect(connectorAccepts(other)).toContain(kind);
        expect(connectorPairRule(kind, other)).toBeDefined();
        // Order must not matter when asking about a pair.
        expect(connectorPairRule(other, kind)).toEqual(connectorPairRule(kind, other));
      }
    }
  });

  it("says nothing about a pair that cannot join", () => {
    expect(connectorPairRule("stud", "axleHole")).toBeUndefined();
    expect(connectorPairRule("stud", "stud")).toBeUndefined();
  });

  it("distinguishes what drives from what pivots", () => {
    // The mechanical difference the whole taxonomy exists to record. The same
    // axle is rigid in a cross hole it cannot slip round in, and free in a
    // round pin hole — which is how a wheel turns on an axle that is itself
    // locked into the chassis.
    expect(connectorPairRule("axle", "axleHole")).toMatchObject({
      articulation: "rigid",
      allowedRotation: "quarterTurns",
      axisMatching: "collinear",
    });
    expect(connectorPairRule("axle", "blindAxleHole")).toMatchObject({
      articulation: "rigid",
      allowedRotation: "quarterTurns",
      axisMatching: "opposed",
    });
    expect(connectorPairRule("axle", "pinHole")).toMatchObject({
      articulation: "revolute",
      allowedRotation: "continuous",
    });
  });

  it("keeps a stud in a clutch rigid", () => {
    expect(connectorPairRule("stud", "undersideClutch")).toMatchObject({
      articulation: "rigid",
      allowedRotation: "quarterTurns",
    });
  });

  it("every port a part declares matches the tables", () => {
    for (const part of PART_DEFINITIONS) {
      for (const port of part.connectors) {
        const rule = CONNECTOR_KIND_RULES[port.kind];

        expect(port.compatibleKinds, `${part.id} ${port.id}`).toEqual(connectorAccepts(port.kind));
        expect(port.gender).toBe(rule.gender);
        expect(port.profileId).toBe(rule.profileId);
        expect(port.geometryRole).toBe(rule.geometryRole);
      }
    }
  });
});
