import { describe, expect, it } from "vitest";

import { createRealBuildPanelCameraBranchBudgetLedger } from "../e2e/real-build-panel-camera-branch-budget";
import { resolveRealBuildPanelCameraBranches } from "../e2e/real-build-panel-camera-resolver";
import {
  BUILT_MASK,
  HASH,
  WEAKER_MASK,
  document,
  observedInput,
  prefix,
} from "./real-build-panel-camera-resolver.fixture";

describe("resolveRealBuildPanelCameraBranches", () => {
  it("retains eight bounded empty-prefix seeds without inventing a registration shift", () => {
    let renders = 0;
    let hashes = 0;
    const ledger = createRealBuildPanelCameraBranchBudgetLedger(8);
    const result = resolveRealBuildPanelCameraBranches({
      ...observedInput(),
      prefix: prefix({
        throughStepNumber: 0,
        parentLineageId: null,
        document: document(0),
      }),
      registrationPanelStepNumber: 1,
      ledger,
      renderModelMask: () => {
        renders += 1;
        return BUILT_MASK;
      },
      hashDocument: () => {
        hashes += 1;
        return HASH;
      },
    });

    expect(result.status).toBe("seeded");
    expect(result.candidateId).toBe(`document:${HASH}`);
    expect(result.seeds).toHaveLength(8);
    expect(
      result.seeds.map(({ latticeHand, turnDegrees }) => `${latticeHand}:${turnDegrees}`),
    ).toEqual([
      "as-fitted:0",
      "as-fitted:90",
      "as-fitted:180",
      "as-fitted:270",
      "x-reflected:0",
      "x-reflected:90",
      "x-reflected:180",
      "x-reflected:270",
    ]);
    expect(
      result.seeds.every(
        ({ shiftPx, observationId }) => shiftPx === null && observationId === null,
      ),
    ).toBe(true);
    expect(new Set(result.seeds.map(({ lineageId }) => lineageId)).size).toBe(8);
    expect(result.seeds[0]!.lineageId).toMatch(/^panel-camera-lineage:[0-9a-f]{64}$/u);
    expect(result.seeds.every((seed) => Object.isFrozen(seed))).toBe(true);
    expect(result.seeds.every(({ document: snapshot }) => Object.isFrozen(snapshot))).toBe(true);
    expect(result.seeds.every(({ document: snapshot }) => snapshot.parts.length === 0)).toBe(true);
    expect(Object.isFrozen(result.seeds)).toBe(true);
    expect(result.reservation).toEqual({
      budget: 8,
      reservedBefore: 0,
      requested: 8,
      reservedAfter: 8,
      failure: null,
    });
    expect(ledger.reserved).toBe(8);
    expect(renders).toBe(0);
    expect(hashes).toBe(1);
  });

  it("reserves before rendering all eight immutable observations and preserves lineage", () => {
    const supplied = prefix();
    const ledger = createRealBuildPanelCameraBranchBudgetLedger(8);
    const rendered: string[] = [];
    let hashCalls = 0;
    const result = resolveRealBuildPanelCameraBranches({
      ...observedInput(),
      prefix: supplied,
      ledger,
      hashDocument: (snapshot) => {
        hashCalls += 1;
        expect(Object.isFrozen(snapshot)).toBe(true);
        expect(Object.isFrozen(snapshot.parts)).toBe(true);
        return HASH;
      },
      renderModelMask: ({ candidateId, parentLineageId, document: snapshot, hypothesis }) => {
        expect(ledger.reserved).toBe(8);
        expect(candidateId).toBe(`document:${HASH}`);
        expect(parentLineageId).toBe("step-004:parent");
        expect(Object.isFrozen(snapshot)).toBe(true);
        expect(Object.isFrozen(hypothesis)).toBe(true);
        rendered.push(`${hypothesis.latticeHand}:${hypothesis.turnDegrees}`);
        return hypothesis.latticeHand === "as-fitted" && hypothesis.turnDegrees === 0
          ? BUILT_MASK
          : WEAKER_MASK;
      },
    });

    expect(result.status).toBe("observed");
    expect(rendered).toHaveLength(8);
    expect(new Set(rendered)).toHaveLength(8);
    expect(hashCalls).toBe(1);
    expect(result.attempts).toHaveLength(8);
    expect(result.observations).toHaveLength(8);
    expect(new Set(result.observations.map(({ candidateId }) => candidateId))).toEqual(
      new Set([`document:${HASH}`]),
    );
    expect(new Set(result.observations.map(({ observationId }) => observationId)).size).toBe(8);
    expect(
      result.observations.every(({ parentLineageId }) => parentLineageId === "step-004:parent"),
    ).toBe(true);
    expect(result.selectedObservationId).toContain(":panel-camera:as-fitted:d1:p006:q000:");
    expect(result.physicalFrameDecision).toEqual({
      status: "unresolved",
      authorizedTransform: null,
      reason: "panel-camera-silhouette-is-not-physical-transform-authority",
    });
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.observations)).toBe(true);
    supplied.document.metadata.labels.push("caller mutation");
    expect(result.observations[0]!.document.metadata.labels).toEqual(["retained"]);
  });

  it("retains all cross-hand tie counterevidence as a typed unresolved result", () => {
    const result = resolveRealBuildPanelCameraBranches({
      ...observedInput(),
      renderModelMask: () => BUILT_MASK,
    });

    expect(result.status).toBe("unresolved");
    expect(result.failure).toMatchObject({
      code: "camera-handedness-unresolved",
      stage: "camera-registration",
      stepNumber: 6,
    });
    expect(result.attempts).toHaveLength(8);
    expect(result.observations).toHaveLength(8);
    expect(result.selectedObservationId).toBeNull();
    expect(result.physicalFrameDecision.authorizedTransform).toBeNull();
  });

  it("does not rekey the same detached document when through-step metadata is relabelled", () => {
    const atStep4 = resolveRealBuildPanelCameraBranches({
      ...observedInput(),
      prefix: prefix({ throughStepNumber: 4 }),
    });
    const atStep5 = resolveRealBuildPanelCameraBranches(observedInput());

    expect(atStep4.throughStepNumber).toBe(4);
    expect(atStep5.throughStepNumber).toBe(5);
    expect(atStep4.candidateId).toBe(`document:${HASH}`);
    expect(atStep5.candidateId).toBe(atStep4.candidateId);
    expect(atStep5.observations.map(({ observationId }) => observationId)).toEqual(
      atStep4.observations.map(({ observationId }) => observationId),
    );
    expect(
      atStep5.observations.every(({ observationId }) =>
        observationId.startsWith(`document:${HASH}:panel-camera:`),
      ),
    ).toBe(true);
  });

  it("keeps evidence identity stable but gives convergent observations distinct parent-bound lineages", () => {
    const parentA = resolveRealBuildPanelCameraBranches({
      ...observedInput(),
      prefix: prefix({ parentLineageId: "parent-a" }),
    });
    const parentB = resolveRealBuildPanelCameraBranches({
      ...observedInput(),
      prefix: prefix({ parentLineageId: "parent-b" }),
    });

    expect(parentA.observations.map(({ observationId }) => observationId)).toEqual(
      parentB.observations.map(({ observationId }) => observationId),
    );
    expect(parentA.observations.map(({ lineageId }) => lineageId)).not.toEqual(
      parentB.observations.map(({ lineageId }) => lineageId),
    );
    expect(
      parentA.observations.every(({ parentLineageId }) => parentLineageId === "parent-a"),
    ).toBe(true);
    expect(
      parentB.observations.every(({ parentLineageId }) => parentLineageId === "parent-b"),
    ).toBe(true);
  });

  it("round-trips every produced observation and seed lineage as the next parent", () => {
    const observed = resolveRealBuildPanelCameraBranches(observedInput());
    const longestObservation = observed.observations.reduce(
      (longest, here) => (here.lineageId.length > longest.length ? here.lineageId : longest),
      "",
    );
    expect(longestObservation.length).toBeLessThanOrEqual(256);
    expect(() =>
      resolveRealBuildPanelCameraBranches({
        ...observedInput(),
        prefix: prefix({ parentLineageId: longestObservation }),
      }),
    ).not.toThrow();

    const seeded = resolveRealBuildPanelCameraBranches({
      ...observedInput(),
      prefix: prefix({ throughStepNumber: 0, parentLineageId: null, document: document(0) }),
      registrationPanelStepNumber: 1,
    });
    expect(Math.max(...seeded.seeds.map(({ lineageId }) => lineageId.length))).toBeLessThanOrEqual(
      256,
    );
    expect(() =>
      resolveRealBuildPanelCameraBranches({
        ...observedInput(),
        prefix: prefix({ parentLineageId: seeded.seeds.at(-1)!.lineageId }),
      }),
    ).not.toThrow();
  });
});
