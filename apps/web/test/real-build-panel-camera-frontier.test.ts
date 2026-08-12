import { describe, expect, it } from "vitest";

import { createRealBuildPanelCameraBranchBudgetLedger } from "../e2e/real-build-panel-camera-branch-budget";
import { resolveRealBuildPanelCameraFrontier } from "../e2e/real-build-panel-camera-frontier";
import {
  BUILT_MASK,
  HASH_A,
  HASH_B,
  WEAKER_MASK,
  frontierDocument,
  frontierInput,
  frontierPrefix,
} from "./real-build-panel-camera-frontier.fixture";

describe("resolveRealBuildPanelCameraFrontier", () => {
  it("reserves every parent atomically but renders each document hypothesis once", () => {
    const ledger = createRealBuildPanelCameraBranchBudgetLedger(24);
    const supplied = frontierInput({ ledger });
    const hashes: string[] = [];
    const renders: string[] = [];
    const result = resolveRealBuildPanelCameraFrontier({
      ...supplied,
      hashDocument: (document) => {
        expect(ledger.reserved).toBe(24);
        expect(Object.isFrozen(document)).toBe(true);
        hashes.push(document.metadata.name);
        return document.metadata.name === "a" ? HASH_A : HASH_B;
      },
      renderModelMask: ({ candidateId, document, hypothesis }) => {
        expect(ledger.reserved).toBe(24);
        expect(Object.isFrozen(document)).toBe(true);
        expect(Object.isFrozen(hypothesis)).toBe(true);
        renders.push(`${candidateId}:${hypothesis.latticeHand}:${hypothesis.turnDegrees}`);
        return hypothesis.latticeHand === "as-fitted" && hypothesis.turnDegrees === 0
          ? BUILT_MASK
          : WEAKER_MASK;
      },
    });

    expect(result.status).toBe("observed");
    expect(result.reservation).toEqual({
      budget: 24,
      reservedBefore: 0,
      requested: 24,
      reservedAfter: 24,
      failure: null,
    });
    expect(hashes).toEqual(["a", "b"]);
    expect(renders).toHaveLength(16);
    expect(new Set(renders)).toHaveLength(16);
    expect(result.candidates).toHaveLength(2);
    expect(result.candidates.map(({ attempts }) => attempts.length)).toEqual([8, 8]);
    expect(result.candidates.map(({ observationIds }) => observationIds.length)).toEqual([8, 8]);
    expect(result.candidates[0]!.parentLineageIds).toEqual(["root-a-0", "root-a-1"]);
    expect(result.candidates[1]!.parentLineageIds).toEqual(["root-b-0"]);
    expect(result.observations).toHaveLength(24);
    expect(new Set(result.observations.map(({ lineageId }) => lineageId)).size).toBe(24);
    expect(new Set(result.observations.map(({ candidateId }) => candidateId))).toEqual(
      new Set([`document:${HASH_A}`, `document:${HASH_B}`]),
    );

    const aRows = result.observations.filter(
      ({ candidateId }) => candidateId === `document:${HASH_A}`,
    );
    expect(aRows).toHaveLength(16);
    expect(new Set(aRows.map(({ observationId }) => observationId)).size).toBe(8);
    for (const observationId of new Set(aRows.map(({ observationId }) => observationId))) {
      const copies = aRows.filter((row) => row.observationId === observationId);
      expect(copies.map(({ parentLineageId }) => parentLineageId)).toEqual([
        "root-a-0",
        "root-a-1",
      ]);
      expect(new Set(copies.map(({ lineageId }) => lineageId)).size).toBe(2);
    }
    expect(
      result.candidates.every(({ selectedObservationId }) => selectedObservationId !== null),
    ).toBe(true);
    expect(result.candidates.map(({ selectedLineageIds }) => selectedLineageIds.length)).toEqual([
      2, 1,
    ]);
    for (const candidate of result.candidates) {
      for (const selected of candidate.selectedLineageIds) {
        expect(result.observations).toContainEqual(
          expect.objectContaining({
            observationId: candidate.selectedObservationId,
            parentLineageId: selected.parentLineageId,
            lineageId: selected.lineageId,
          }),
        );
      }
    }
    expect(result.physicalFrameDecision).toEqual({
      status: "unresolved",
      authorizedTransform: null,
      reason: "panel-camera-silhouette-is-not-physical-transform-authority",
    });
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.candidates)).toBe(true);
    expect(Object.isFrozen(result.observations)).toBe(true);
    for (const candidate of result.candidates) {
      expect(Object.isFrozen(candidate)).toBe(true);
      expect(Object.isFrozen(candidate.document)).toBe(true);
      expect(Object.isFrozen(candidate.document.metadata.labels)).toBe(true);
      expect(Object.isFrozen(candidate.parentLineageIds)).toBe(true);
      expect(Object.isFrozen(candidate.attempts)).toBe(true);
      expect(Object.isFrozen(candidate.observationIds)).toBe(true);
      expect(Object.isFrozen(candidate.selectedLineageIds)).toBe(true);
      expect(candidate.selectedLineageIds.every(Object.isFrozen)).toBe(true);
    }
    expect(result.observations.every(Object.isFrozen)).toBe(true);
    expect(Object.isFrozen(result.reservation)).toBe(true);
    expect(Object.isFrozen(result.physicalFrameDecision)).toBe(true);
    expect(Object.isFrozen(supplied.prefixes[0]!.document)).toBe(false);

    supplied.prefixes[0]!.document.metadata.labels.push("caller mutation");
    expect(result.candidates[0]!.document.metadata.labels).toEqual(["retained"]);
  });

  it("allows one parent to retain two document candidates without lineage collision", () => {
    let renders = 0;
    const result = resolveRealBuildPanelCameraFrontier({
      ...frontierInput({
        prefixes: [frontierPrefix("shared-parent"), frontierPrefix("shared-parent", "b")],
        ledger: createRealBuildPanelCameraBranchBudgetLedger(16),
      }),
      renderModelMask: ({ hypothesis }) => {
        renders += 1;
        return hypothesis.latticeHand === "as-fitted" && hypothesis.turnDegrees === 0
          ? BUILT_MASK
          : WEAKER_MASK;
      },
    });

    expect(result.reservation).toMatchObject({ requested: 16, reservedAfter: 16 });
    expect(renders).toBe(16);
    expect(result.candidates.map(({ parentLineageIds }) => parentLineageIds)).toEqual([
      ["shared-parent"],
      ["shared-parent"],
    ]);
    expect(result.observations).toHaveLength(16);
    expect(new Set(result.observations.map(({ lineageId }) => lineageId)).size).toBe(16);
  });

  it("refuses capacity before traversing, cloning, hashing, or rendering documents", () => {
    const ledger = createRealBuildPanelCameraBranchBudgetLedger(7);
    let partsReads = 0;
    const hostileDocument = {
      get parts(): never {
        partsReads += 1;
        throw new Error("an under-budget document must remain opaque");
      },
      metadata: { name: "a" as const, labels: ["retained"] },
    };
    let renders = 0;
    let hashes = 0;
    const result = resolveRealBuildPanelCameraFrontier({
      ...frontierInput({
        ledger,
        prefixes: [
          frontierPrefix("under-budget", "a", {
            document: hostileDocument,
          }),
        ],
      }),
      hashDocument: () => {
        hashes += 1;
        return HASH_A;
      },
      renderModelMask: () => {
        renders += 1;
        return BUILT_MASK;
      },
    });

    expect(partsReads).toBe(0);
    expect(hashes).toBe(0);
    expect(renders).toBe(0);
    expect(result.status).toBe("budget-refused");
    expect(result.candidates).toEqual([]);
    expect(result.observations).toEqual([]);
    expect(result.reservation).toEqual({
      budget: 7,
      reservedBefore: 0,
      requested: 8,
      reservedAfter: 0,
      failure: { reservedBefore: 0, requested: 8, budget: 7 },
    });
    expect(ledger.reserved).toBe(0);
  });

  it("finishes every hypothesis and later candidate after one renderer throws", () => {
    const calls: string[] = [];
    const result = resolveRealBuildPanelCameraFrontier({
      ...frontierInput(),
      renderModelMask: ({ candidateId, hypothesis }) => {
        calls.push(`${candidateId}:${hypothesis.latticeHand}:${hypothesis.turnDegrees}`);
        if (
          candidateId === `document:${HASH_A}` &&
          hypothesis.latticeHand === "as-fitted" &&
          hypothesis.turnDegrees === 90
        ) {
          throw new Error("synthetic GPU loss");
        }
        return hypothesis.latticeHand === "as-fitted" && hypothesis.turnDegrees === 0
          ? BUILT_MASK
          : WEAKER_MASK;
      },
    });

    expect(calls).toHaveLength(16);
    const [a, b] = result.candidates;
    expect(result.status).toBe("failed");
    expect(a).toMatchObject({
      status: "failed",
      selectedObservationId: null,
      failure: { code: "rendering-error", stage: "rendering" },
    });
    expect(a!.attempts).toHaveLength(8);
    expect(a!.observationIds).toHaveLength(7);
    expect(b).toMatchObject({ status: "observed", failure: null });
    expect(b!.attempts).toHaveLength(8);
    expect(b!.observationIds).toHaveLength(8);
    expect(b!.selectedObservationId).not.toBeNull();
    expect(result.observations).toHaveLength(22);
    expect(result.failure?.message).toContain("synthetic GPU loss");
  });

  it("reports the failed candidate over an earlier unresolved candidate with detached failures", () => {
    const result = resolveRealBuildPanelCameraFrontier({
      ...frontierInput({
        prefixes: [frontierPrefix("parent-a"), frontierPrefix("parent-b", "b")],
        ledger: createRealBuildPanelCameraBranchBudgetLedger(16),
      }),
      renderModelMask: ({ candidateId, hypothesis }) => {
        if (candidateId === `document:${HASH_A}`) return BUILT_MASK;
        if (hypothesis.latticeHand === "as-fitted" && hypothesis.turnDegrees === 90) {
          throw new Error("later candidate render failed");
        }
        return hypothesis.latticeHand === "as-fitted" && hypothesis.turnDegrees === 0
          ? BUILT_MASK
          : WEAKER_MASK;
      },
    });

    expect(result.candidates.map(({ status }) => status)).toEqual(["unresolved", "failed"]);
    expect(result).toMatchObject({
      status: "failed",
      failure: { code: "rendering-error", stage: "rendering" },
    });
    const candidateFailure = result.candidates[1]!.failure!;
    const aggregateFailure = result.failure!;
    expect(Object.isFrozen(candidateFailure)).toBe(true);
    expect(Object.isFrozen(aggregateFailure)).toBe(true);
    expect(aggregateFailure).not.toBe(candidateFailure);
    const retainedMessage = aggregateFailure.message;
    expect(() => Object.assign(candidateFailure, { message: "caller mutation" })).toThrow(
      TypeError,
    );
    expect(result.failure?.message).toBe(retainedMessage);
  });

  it("retains exact cross-hand ties per candidate without choosing a physical hand", () => {
    const result = resolveRealBuildPanelCameraFrontier({
      ...frontierInput(),
      renderModelMask: () => BUILT_MASK,
    });

    expect(result.status).toBe("unresolved");
    expect(result.candidates).toHaveLength(2);
    expect(
      result.candidates.every(
        ({ status, attempts, observationIds, selectedObservationId, failure }) =>
          status === "unresolved" &&
          attempts.length === 8 &&
          observationIds.length === 8 &&
          selectedObservationId === null &&
          failure?.code === "camera-handedness-unresolved",
      ),
    ).toBe(true);
    expect(result.observations).toHaveLength(24);
    expect(result.physicalFrameDecision.authorizedTransform).toBeNull();
  });

  it("rejects malformed, duplicate, aliased, or falsely hashed prefixes before budget", () => {
    const cases: readonly {
      readonly prefixes: readonly ReturnType<typeof frontierPrefix>[];
      readonly pattern: RegExp;
      readonly reserved: number;
    }[] = [
      {
        prefixes: [frontierPrefix("same"), frontierPrefix("same")],
        pattern: /repeats parent.*each \(parentLineageId, candidateId\) pair must be unique/su,
        reserved: 0,
      },
      {
        prefixes: [
          frontierPrefix("parent-a"),
          frontierPrefix("parent-b", "b", { documentHash: HASH_A }),
        ],
        pattern: /aliases different canonical document bytes/su,
        reserved: 16,
      },
      {
        prefixes: [
          frontierPrefix("parent-a"),
          frontierPrefix("parent-b", "b", { throughStepNumber: 4 }),
        ],
        pattern: /one frontier must retain one exact step/su,
        reserved: 0,
      },
    ];
    for (const entry of cases) {
      const ledger = createRealBuildPanelCameraBranchBudgetLedger(16);
      let hashes = 0;
      expect(() =>
        resolveRealBuildPanelCameraFrontier({
          ...frontierInput({ prefixes: entry.prefixes, ledger }),
          hashDocument: () => {
            hashes += 1;
            return HASH_A;
          },
        }),
      ).toThrow(entry.pattern);
      expect(hashes).toBe(0);
      expect(ledger.reserved).toBe(entry.reserved);
    }

    const sparse = [frontierPrefix("parent-a")] as ReturnType<typeof frontierPrefix>[];
    sparse.length = 2;
    expect(() => resolveRealBuildPanelCameraFrontier(frontierInput({ prefixes: sparse }))).toThrow(
      /hole at index 1/su,
    );

    const ledger = createRealBuildPanelCameraBranchBudgetLedger(24);
    let renders = 0;
    expect(() =>
      resolveRealBuildPanelCameraFrontier({
        ...frontierInput({ ledger }),
        hashDocument: () => HASH_B,
        renderModelMask: () => {
          renders += 1;
          return BUILT_MASK;
        },
      }),
    ).toThrow(/claims.*detached document hashes to.*after reservation.*ledger must be discarded/su);
    expect(renders).toBe(0);
    expect(ledger.reserved).toBe(24);
  });

  it("bounds aggregate input part references before cloning admitted documents", () => {
    const ledger = createRealBuildPanelCameraBranchBudgetLedger(24);
    const maximumParts = Array.from({ length: 100_000 }, () => null) as unknown as {
      id: string;
    }[];
    let hashes = 0;
    let renders = 0;
    expect(() =>
      resolveRealBuildPanelCameraFrontier({
        ...frontierInput({
          ledger,
          prefixes: [
            frontierPrefix("parent-a", "a", {
              document: { ...frontierDocument("a"), parts: maximumParts },
            }),
            frontierPrefix("parent-b", "b", {
              document: { ...frontierDocument("b"), parts: maximumParts },
            }),
            frontierPrefix("parent-c", "a"),
          ],
        }),
        hashDocument: () => {
          hashes += 1;
          return HASH_A;
        },
        renderModelMask: () => {
          renders += 1;
          return BUILT_MASK;
        },
      }),
    ).toThrow(/more than 200000 aggregate input parts.*no document was cloned.*discarded/su);
    expect(ledger.reserved).toBe(24);
    expect(hashes).toBe(0);
    expect(renders).toBe(0);
  });

  it("detects external-ledger poisoning around hash and render callbacks", () => {
    const hashLedger = createRealBuildPanelCameraBranchBudgetLedger(25);
    expect(() =>
      resolveRealBuildPanelCameraFrontier({
        ...frontierInput({ ledger: hashLedger }),
        hashDocument: () => {
          expect(hashLedger.tryReserve(1)).toBe(true);
          return HASH_A;
        },
      }),
    ).toThrow(/hash callback.*changed the external branch ledger.*discard/su);
    expect(hashLedger.reserved).toBe(25);

    const renderLedger = createRealBuildPanelCameraBranchBudgetLedger(25);
    let renderCalls = 0;
    let renderPoison: unknown;
    try {
      resolveRealBuildPanelCameraFrontier({
        ...frontierInput({ ledger: renderLedger }),
        renderModelMask: () => {
          renderCalls += 1;
          expect(renderLedger.tryReserve(1)).toBe(true);
          throw new Error("subordinate renderer error");
        },
      });
    } catch (error) {
      renderPoison = error;
    }
    expect(renderPoison).toBeInstanceOf(TypeError);
    expect((renderPoison as Error).message).toMatch(
      /All unique candidate\/hypothesis attempts finished.*discard the mutated ledger/su,
    );
    expect((renderPoison as Error).message).not.toContain("subordinate renderer error");
    expect(renderCalls).toBe(1);
    expect(renderLedger.reserved).toBe(25);
  });

  it("copies raster evidence before hash callbacks can mutate caller buffers", () => {
    const builtMask = new Uint8Array(BUILT_MASK);
    const excludedMask = new Uint8Array(4);
    const result = resolveRealBuildPanelCameraFrontier({
      ...frontierInput({ builtMask, excludedMask }),
      hashDocument: (document) => {
        builtMask.fill(0);
        excludedMask.fill(1);
        return document.metadata.name === "a" ? HASH_A : HASH_B;
      },
    });

    expect(result.status).toBe("observed");
    expect(
      result.candidates.every(({ selectedObservationId }) => selectedObservationId !== null),
    ).toBe(true);
  });

  it("groups only byte-identical snapshots even when callers later mutate both sources", () => {
    const first = frontierDocument("a");
    const second = structuredClone(first);
    const input = frontierInput({
      prefixes: [
        frontierPrefix("parent-0", "a", { document: first }),
        frontierPrefix("parent-1", "a", { document: second }),
      ],
      ledger: createRealBuildPanelCameraBranchBudgetLedger(16),
    });
    let hashes = 0;
    let renders = 0;
    const result = resolveRealBuildPanelCameraFrontier({
      ...input,
      hashDocument: (document) => {
        hashes += 1;
        return input.hashDocument(document);
      },
      renderModelMask: (renderInput) => {
        renders += 1;
        return input.renderModelMask(renderInput);
      },
    });
    first.metadata.labels.push("first mutation");
    second.metadata.labels.push("second mutation");

    expect(result.candidates).toHaveLength(1);
    expect(result.reservation).toMatchObject({ requested: 16, reservedAfter: 16 });
    expect(hashes).toBe(1);
    expect(renders).toBe(8);
    expect(result.candidates[0]!.parentLineageIds).toEqual(["parent-0", "parent-1"]);
    expect(result.candidates[0]!.selectedLineageIds).toHaveLength(2);
    expect(
      result.candidates[0]!.selectedLineageIds.map(({ parentLineageId }) => parentLineageId),
    ).toEqual(["parent-0", "parent-1"]);
    expect(result.candidates[0]!.document.metadata.labels).toEqual(["retained"]);
    expect(result.observations).toHaveLength(16);
  });
});
