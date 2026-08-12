import { describe, expect, it, vi } from "vitest";
import { canonicalStringify } from "@lego-studio/brick-kernel";

import { createRealBuildPanelCameraBranchBudgetLedger } from "../e2e/real-build-panel-camera-branch-budget";
import { resolveRealBuildPanelCameraFrontier } from "../e2e/real-build-panel-camera-frontier";
import {
  preparePanelCameraFrontierCandidates,
  snapshotPanelCameraFrontierPrefixHeaders,
} from "../e2e/real-build-panel-camera-frontier-input";
import {
  describePanelCameraValue,
  snapshotPanelCameraBinaryMask,
} from "../e2e/real-build-panel-camera-resolver-boundary";
import { snapshotPanelCameraCanonicalDocument } from "../e2e/real-build-panel-camera-json-snapshot";
import type { RealBuildPanelCameraPrefixInput } from "../e2e/real-build-panel-camera-resolver";
import {
  BUILT_MASK,
  HASH_A,
  HASH_B,
  WEAKER_MASK,
  type FrontierDocument,
  frontierDocument,
  frontierInput,
  frontierPrefix,
} from "./real-build-panel-camera-frontier.fixture";

describe("resolveRealBuildPanelCameraFrontier hostile boundaries", () => {
  it("matches canonical JSON while enforcing byte, node, and cycle bounds", () => {
    const document = {
      z: { unicode: "brick 🧱", negativeZero: -0 },
      parts: [{ id: "a", nested: [true, null, 4] }],
      a: "first",
    };
    const snapshot = snapshotPanelCameraCanonicalDocument(document);
    expect(snapshot.canonical).toBe(canonicalStringify(document));
    expect(snapshot.document).toEqual({ ...document, z: { ...document.z, negativeZero: 0 } });
    expect(Object.isFrozen(snapshot.document)).toBe(true);

    expect(() =>
      snapshotPanelCameraCanonicalDocument(document, { maximumCanonicalBytes: 16 }),
    ).toThrow(/canonical JSON exceeds|JSON string.*encoded bytes.*remaining/su);
    expect(() => snapshotPanelCameraCanonicalDocument(document, { maximumNodes: 3 })).toThrow(
      /descriptor entries remain|exceeds 3 canonical value nodes/su,
    );
    const cyclic: { parts: unknown[]; self?: unknown } = { parts: [{}] };
    cyclic.self = cyclic;
    expect(() => snapshotPanelCameraCanonicalDocument(cyclic)).toThrow(/contains a cycle/su);
  });

  it("refuses excess flat keys before reading descriptors or sorting them", () => {
    let descriptorReads = 0;
    const hostile = new Proxy(Object.create(null) as object, {
      getPrototypeOf: () => Object.prototype,
      ownKeys: () => ["parts", "a", "b", "c"],
      getOwnPropertyDescriptor: (_target, key) => {
        descriptorReads += 1;
        return {
          value: key === "parts" ? [] : key,
          enumerable: true,
          configurable: true,
          writable: true,
        };
      },
    });

    expect(() =>
      snapshotPanelCameraCanonicalDocument(hostile, {
        maximumNodes: 3,
        maximumCanonicalBytes: 1_024,
      }),
    ).toThrow(/exposes 4 data entries.*Reject it before copying or sorting keys/su);
    expect(descriptorReads).toBe(0);
  });

  it("checks raster length before copying and rejects shared storage", () => {
    const set = vi.spyOn(Uint8Array.prototype, "set");
    try {
      expect(() =>
        snapshotPanelCameraBinaryMask(new Uint8Array(1_000_000), 4, "Hostile oversized mask"),
      ).toThrow(/exactly 4 pixels.*received 1000000.*No raster copy was allocated/su);
      expect(set).not.toHaveBeenCalled();

      expect(() =>
        snapshotPanelCameraBinaryMask(
          new Uint16Array([256, 257, 2, 0]),
          4,
          "Wrong typed-array kind",
        ),
      ).toThrow(/must be a genuine Uint8Array of exactly 4 binary pixels/su);
      expect(set).not.toHaveBeenCalled();
    } finally {
      set.mockRestore();
    }

    if (typeof SharedArrayBuffer !== "undefined") {
      expect(() =>
        snapshotPanelCameraBinaryMask(new Uint8Array(new SharedArrayBuffer(4)), 4, "Shared mask"),
      ).toThrow(/SharedArrayBuffer.*required a private ArrayBuffer-backed Uint8Array/su);
    }
  });

  it("retains bounded observed ledger values in diagnostics", () => {
    expect(
      describePanelCameraValue({
        budget: 24,
        reserved: 8,
        refused: true,
        failure: { budget: 24, requested: 20, reservedBefore: 8 },
      }),
    ).toBe(
      '{"budget":24,"reserved":8,"refused":true,"failure":{"budget":24,"requested":20,"reservedBefore":8}}',
    );
  });

  it("collects a large shared candidate's parents once without quadratic array rebuilding", () => {
    const document = frontierDocument("a");
    const prefixes = Array.from({ length: 8_192 }, (_, index) =>
      frontierPrefix(`parent-${index}`, "a", { document }),
    );
    const headers = snapshotPanelCameraFrontierPrefixHeaders({
      prefixes,
      registrationPanelStepNumber: 6,
    });
    const candidates = preparePanelCameraFrontierCandidates(headers);

    expect(candidates).toHaveLength(1);
    expect(candidates[0]!.parentLineageIds).toHaveLength(8_192);
    expect(candidates[0]!.parentLineageIds[0]).toBe("parent-0");
    expect(candidates[0]!.parentLineageIds.at(-1)).toBe("parent-8191");
    expect(Object.isFrozen(candidates[0]!.parentLineageIds)).toBe(true);
  });

  it("snapshots each top-level input getter exactly once before callbacks", () => {
    const plain = frontierInput();
    const reads = {} as Record<keyof typeof plain, number>;
    let hashCallbacks = 0;
    const base = {
      ...plain,
      hashDocument: (document: Parameters<typeof plain.hashDocument>[0]) => {
        hashCallbacks += 1;
        expect(Object.values(reads)).toEqual(Array.from({ length: 9 }, () => 1));
        return plain.hashDocument(document);
      },
    };
    const input = {} as typeof base;
    for (const key of Object.keys(base) as (keyof typeof base)[]) {
      Object.defineProperty(input, key, {
        enumerable: true,
        get() {
          reads[key] = (reads[key] ?? 0) + 1;
          if (reads[key] !== 1) throw new Error(`${key} was reread`);
          return base[key];
        },
      });
    }

    expect(resolveRealBuildPanelCameraFrontier(input).status).toBe("observed");
    expect(hashCallbacks).toBe(2);
    expect(Object.values(reads)).toEqual(Array.from({ length: 9 }, () => 1));
    expect(Object.isFrozen(input)).toBe(false);
  });

  it("fixes the row set and rejects a prefix accessor without invoking it", () => {
    const ledger = createRealBuildPanelCameraBranchBudgetLedger(8);
    const prefixes: RealBuildPanelCameraPrefixInput<FrontierDocument>[] = [];
    const prefix = frontierPrefix("parent-a");
    let reads = 0;
    Object.defineProperty(prefix, "document", {
      enumerable: true,
      get() {
        reads += 1;
        prefixes.push(frontierPrefix(`appended-${reads}`));
        return frontierDocument("a");
      },
    });
    prefixes.push(prefix);

    expect(() => resolveRealBuildPanelCameraFrontier(frontierInput({ prefixes, ledger }))).toThrow(
      /enumerable own data properties/su,
    );
    expect(reads).toBe(0);
    expect(prefixes).toHaveLength(1);
    expect(ledger.reserved).toBe(0);
  });

  it("rejects document accessors without invoking them after its one reservation", () => {
    const ledger = createRealBuildPanelCameraBranchBudgetLedger(8);
    let reads = 0;
    let hashes = 0;
    let renders = 0;
    const document = {
      metadata: { name: "a", labels: ["retained"] },
    } as unknown as FrontierDocument;
    Object.defineProperty(document, "parts", {
      enumerable: true,
      get() {
        reads += 1;
        return reads === 1 ? [{ id: "small" }] : new Array(250_001).fill(null);
      },
    });

    expect(() =>
      resolveRealBuildPanelCameraFrontier({
        ...frontierInput({
          prefixes: [frontierPrefix("parent-a", "a", { document })],
          ledger,
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
    ).toThrow(/accessors and unstable proxies are not accepted/su);
    expect(reads).toBe(0);
    expect(hashes).toBe(0);
    expect(renders).toBe(0);
    expect(ledger.reserved).toBe(8);
  });

  it("bounds nested non-part metadata before hashing or rendering", () => {
    const ledger = createRealBuildPanelCameraBranchBudgetLedger(8);
    let nested: unknown = { leaf: true };
    for (let index = 0; index < 130; index += 1) nested = { nested };
    const document = {
      parts: [{ id: "part-a" }],
      metadata: nested,
    } as unknown as FrontierDocument;
    let hashes = 0;
    let renders = 0;

    expect(() =>
      resolveRealBuildPanelCameraFrontier({
        ...frontierInput({
          prefixes: [frontierPrefix("parent-a", "a", { document })],
          ledger,
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
    ).toThrow(/exceeds canonical depth 128.*before hashing or rendering/su);
    expect(hashes).toBe(0);
    expect(renders).toBe(0);
    expect(ledger.reserved).toBe(8);
  });

  it("rejects non-binary source evidence before reserving budget", () => {
    const ledger = createRealBuildPanelCameraBranchBudgetLedger(24);
    expect(() =>
      resolveRealBuildPanelCameraFrontier(
        frontierInput({ builtMask: new Uint8Array([1, 2, 0, 0]), ledger }),
      ),
    ).toThrow(/builtMask pixel 1 is 2.*binary byte 0 or 1/su);
    expect(ledger.reserved).toBe(0);
  });

  it("isolates malformed and hostile renderer results while finishing the frontier", () => {
    const calls: string[] = [];
    const hostileThrown = new Proxy(Object.create(null) as object, {
      getOwnPropertyDescriptor() {
        throw new Error("message descriptor trap");
      },
      getPrototypeOf() {
        throw new Error("prototype trap");
      },
    });
    const proxiedRaster = new Proxy(new Uint8Array(BUILT_MASK), {});
    const result = resolveRealBuildPanelCameraFrontier({
      ...frontierInput(),
      renderModelMask: ({ candidateId, hypothesis }) => {
        calls.push(`${candidateId}:${hypothesis.latticeHand}:${hypothesis.turnDegrees}`);
        if (
          candidateId === `document:${HASH_A}` &&
          hypothesis.latticeHand === "as-fitted" &&
          hypothesis.turnDegrees === 90
        ) {
          return new Uint8Array([1, 2, 0, 0]);
        }
        if (
          candidateId === `document:${HASH_A}` &&
          hypothesis.latticeHand === "as-fitted" &&
          hypothesis.turnDegrees === 180
        ) {
          return proxiedRaster;
        }
        if (
          candidateId === `document:${HASH_B}` &&
          hypothesis.latticeHand === "as-fitted" &&
          hypothesis.turnDegrees === 90
        ) {
          throw hostileThrown;
        }
        return hypothesis.latticeHand === "as-fitted" && hypothesis.turnDegrees === 0
          ? BUILT_MASK
          : WEAKER_MASK;
      },
    });

    expect(calls).toHaveLength(16);
    expect(result.status).toBe("failed");
    expect(result.throughStepNumber).toBe(5);
    expect(result.candidates.map(({ status }) => status)).toEqual(["failed", "failed"]);
    expect(result.candidates.map(({ attempts }) => attempts.length)).toEqual([8, 8]);
    expect(result.candidates.map(({ observationIds }) => observationIds.length)).toEqual([6, 7]);
    expect(result.observations).toHaveLength(19);
    expect(result.candidates[0]!.failure?.message).toMatch(/pixel 1 is 2.*genuine Uint8Array/su);
    expect(result.candidates[1]!.failure?.message).toContain(
      "a hostile thrown object whose message could not be inspected",
    );
    expect(
      result.candidates.every(({ selectedObservationId }) => selectedObservationId === null),
    ).toBe(true);
  });
});
