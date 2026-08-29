import { CONNECTOR_PAIR_RULES, PART_DEFINITIONS } from "@lego-studio/catalog";
import { describe, expect, it } from "vitest";

import {
  connectionEndpointKey,
  projectConnectionSemantics,
} from "./connection-semantics-projection.ts";

describe("connection-semantics roster projection", () => {
  it("does not reinterpret an existing axle endpoint for a future absent connector kind", () => {
    const withoutBlindSocket = PART_DEFINITIONS.filter((part) =>
      part.connectors.every(({ kind }) => kind !== "blindAxleHole"),
    );
    const withoutBlindRule = CONNECTOR_PAIR_RULES.filter(
      ({ male, female }) => male !== "blindAxleHole" && female !== "blindAxleHole",
    );
    const projectedWithFutureRule = projectConnectionSemantics(
      withoutBlindSocket,
      CONNECTOR_PAIR_RULES,
      "live-strict",
    );
    const projectedWithoutFutureRule = projectConnectionSemantics(
      withoutBlindSocket,
      withoutBlindRule,
      "live-strict",
    );
    const axleKey = connectionEndpointKey("builtin:axle-1x3", "axle:0");

    expect(projectedWithFutureRule.endpointDigests.get(axleKey)).toBe(
      projectedWithoutFutureRule.endpointDigests.get(axleKey),
    );
    expect(projectedWithFutureRule.endpointMapDigest).toBe(
      projectedWithoutFutureRule.endpointMapDigest,
    );
    expect(projectedWithFutureRule.pairMapDigest).toBe(projectedWithoutFutureRule.pairMapDigest);

    const fullLive = projectConnectionSemantics(
      PART_DEFINITIONS,
      CONNECTOR_PAIR_RULES,
      "live-strict",
    );
    expect(fullLive.pairCount).toBe(projectedWithFutureRule.pairCount + 1);
    expect(fullLive.endpointDigests.get(axleKey)).not.toBe(
      projectedWithFutureRule.endpointDigests.get(axleKey),
    );

    const changedExistingRule = withoutBlindRule.map((rule) =>
      rule.male === "axle" && rule.female === "axleHole"
        ? { ...rule, axisMatching: "opposed" as const }
        : rule,
    );
    const reinterpretedExistingPair = projectConnectionSemantics(
      withoutBlindSocket,
      changedExistingRule,
      "live-strict",
    );
    expect(reinterpretedExistingPair.endpointDigests.get(axleKey)).not.toBe(
      projectedWithoutFutureRule.endpointDigests.get(axleKey),
    );
    expect(reinterpretedExistingPair.pairMapDigest).not.toBe(
      projectedWithoutFutureRule.pairMapDigest,
    );
  });
});
