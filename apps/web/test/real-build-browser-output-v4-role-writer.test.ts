import { describe, expect, it } from "vitest";

import { compileRealBuildAutomaticPlacement } from "../e2e/real-build-automatic-placement-compiler";
import {
  decodeRealBuildAtomicCompiledBranchEvidenceWire,
  executeRealBuildAtomicCompiledBranchBatch,
} from "../e2e/real-build-atomic-compiled-branch-batch";
import {
  MAXIMUM_REAL_BUILD_COMPILED_OBSERVATION_CLOSURE_BYTES,
  MAXIMUM_REAL_BUILD_COMPILED_OBSERVATION_ROLE_BYTES,
} from "../e2e/real-build-compiled-observation-closure";
import {
  inspectRealBuildCompiledPlacementLineageReplayWork,
  inspectRealBuildCompiledPlacementLineageWork,
} from "../e2e/real-build-compiled-placement-lineage-parser";
import {
  createRealBuildBrowserBranchRoleWriterResult,
  readRealBuildBrowserBranchRoleWriterBytes,
} from "../e2e/real-build-browser-output-v4-role-writer";
import {
  inspectRealBuildBrowserBranchEvidenceV1,
  readRealBuildBrowserBranchStepEvidenceBytes,
} from "../e2e/real-build-browser-output-v4-role";
import { inspectRealBuildBrowserBranchSemanticEvidence } from "../e2e/real-build-browser-output-v4-semantic";
import { snapshotRealBuildEnumeratedPlacementOffer } from "../e2e/real-build-enumerated-placement-witness";
import { createRealBuildPreparedSearchLedger } from "../e2e/real-build-prepared-search-ledger";
import {
  inspectRealBuildPreparedObservationPolicy,
  inspectRealBuildPreparedStepInput,
} from "../e2e/real-build-prepared-step-authority";
import { rebindObservationClosureForLineage } from "./real-build-browser-output-v4-semantic.fixture";
import { realBuildBrowserOutputV4SemanticTwoStepFixture } from "./real-build-browser-output-v4-semantic-two-step.fixture";
import {
  preparedSearchEmptyParent,
  preparedSearchOptionsBytes,
} from "./real-build-prepared-search.fixture";

function observedTwoStepInputs() {
  const fixture = realBuildBrowserOutputV4SemanticTwoStepFixture();
  const policyInspection = inspectRealBuildPreparedObservationPolicy(fixture.preparedRunInputBytes);
  const observations = fixture.steps.map((step) =>
    rebindObservationClosureForLineage(
      fixture.preparedRunInputBytes,
      step.lineage,
      step.lineageBytes,
    ),
  );
  return {
    fixture,
    observations,
    inputs: fixture.steps.map((step, index) => ({
      batchResult: step.batchResult,
      observation: {
        closureBytes: observations[index]!.closureBytes,
        roleBytes: observations[index]!.roleBytes,
        policyInspection,
      },
    })),
  };
}

function terminalStepOneResult(kind: "budget-refused" | "failed") {
  const preparedStep = inspectRealBuildPreparedStepInput(preparedSearchOptionsBytes(1, 1), 1);
  const parent = preparedSearchEmptyParent();
  const piece = preparedStep.expectedAtomicPieces[0]!;
  const input = {
    preparedStep,
    rootCandidates: [{ documentSnapshot: parent.documentSnapshot, identities: [parent.identity] }],
    enumeratedParents: [
      {
        parentLineageId: parent.identity.lineageId,
        candidates: [
          {
            partIds: ["writer-terminal-part"],
            offeredCandidates: [
              snapshotRealBuildEnumeratedPlacementOffer({
                catalogPartId: piece.catalogPartId,
                transform: { positionLdu: [0, 0, 0], orientationId: "upright-yaw-0" },
                connections: [],
                restsOnBuildPlate: true,
              }),
            ],
          },
        ],
      },
    ],
    ledger: createRealBuildPreparedSearchLedger(kind === "budget-refused" ? 0 : 1),
  };
  return executeRealBuildAtomicCompiledBranchBatch(
    input,
    kind === "failed"
      ? ((() => {
          throw new Error("injected compiler failure");
        }) as typeof compileRealBuildAutomaticPlacement)
      : compileRealBuildAutomaticPlacement,
  );
}

describe("browser-output /4 branch-role writer", () => {
  it("writes exact empty roles without acquiring authority", () => {
    const result = createRealBuildBrowserBranchRoleWriterResult([]);
    const first = readRealBuildBrowserBranchRoleWriterBytes(result);
    const inspected = inspectRealBuildBrowserBranchEvidenceV1(
      first.branchEvidence,
      first.compiledBranchRole,
      first.observationRole,
    );

    expect(inspected).toEqual(result.evidence);
    expect(inspected.steps).toEqual([]);
    expect(inspected.compiledBranchRole.bytes).toBe(0);
    expect(inspected.observationRole.bytes).toBe(0);
    expect(result.authority).toEqual({
      status: "absent",
      authorized: false,
      reason: "browser-branch-role-writer-is-transport-only",
    });
    expect(() => readRealBuildBrowserBranchRoleWriterBytes({ ...result })).toThrow(
      /exact module-created writer result/iu,
    );
  });

  it("finalizes two dense observed steps and round-trips semantic replay", () => {
    const { fixture, observations, inputs } = observedTwoStepInputs();
    const result = createRealBuildBrowserBranchRoleWriterResult(inputs);
    const bytes = readRealBuildBrowserBranchRoleWriterBytes(result);
    const inspected = inspectRealBuildBrowserBranchEvidenceV1(
      bytes.branchEvidence,
      bytes.compiledBranchRole,
      bytes.observationRole,
    );

    expect(inspected).toEqual(result.evidence);
    expect(inspected.steps.map(({ stepNumber }) => stepNumber)).toEqual([1, 2]);
    expect(inspected.steps[0]!.compiledLineage.offset).toBe(0);
    expect(inspected.steps[0]!.observationClosure!.offset).toBe(
      inspected.steps[0]!.compiledLineage.bytes,
    );
    expect(inspected.steps[1]!.compiledLineage.offset).toBe(
      inspected.steps[0]!.compiledLineage.bytes + inspected.steps[0]!.observationClosure!.bytes,
    );
    expect(inspected.steps[1]!.observations!.offset).toBe(inspected.steps[0]!.observations!.bytes);
    for (const step of fixture.steps) {
      const retained = readRealBuildBrowserBranchStepEvidenceBytes(inspected, step.stepNumber);
      expect(retained.compiledLineage).toEqual(step.lineageBytes);
      expect(retained.observationClosure).toEqual(observations[step.stepNumber - 1]!.closureBytes);
      expect(retained.observations).toEqual(observations[step.stepNumber - 1]!.roleBytes);
    }

    const semantic = inspectRealBuildBrowserBranchSemanticEvidence(
      bytes.branchEvidence,
      bytes.compiledBranchRole,
      bytes.observationRole,
      fixture.preparedRunInputBytes,
    );
    expect(semantic.steps).toHaveLength(2);
    expect(
      semantic.steps.every(({ observationClosure }) => observationClosure === "verified"),
    ).toBe(true);
    expect(semantic.placementAuthority).toMatchObject({
      status: "absent",
      authorized: false,
    });
    const repeated = createRealBuildBrowserBranchRoleWriterResult(inputs);
    const repeatedBytes = readRealBuildBrowserBranchRoleWriterBytes(repeated);
    expect(repeated.evidence).toEqual(result.evidence);
    expect(repeatedBytes.branchEvidence).toEqual(bytes.branchEvidence);
    expect(repeatedBytes.compiledBranchRole).toEqual(bytes.compiledBranchRole);
    expect(repeatedBytes.observationRole).toEqual(bytes.observationRole);
  });

  it("refuses genuine individually admissible steps at the cumulative replay-work limit", () => {
    const fixture = realBuildBrowserOutputV4SemanticTwoStepFixture(200, 100);
    const graphVisits = fixture.steps.map(
      ({ lineageBytes }) =>
        inspectRealBuildCompiledPlacementLineageReplayWork(
          inspectRealBuildCompiledPlacementLineageWork(lineageBytes),
        ).work.compilerGraphVisits,
    );
    expect(graphVisits.every((visits) => visits <= 2_000_000)).toBe(true);
    const aggregateGraphVisits = graphVisits.reduce((total, visits) => total + visits, 0);
    expect(aggregateGraphVisits).toBeGreaterThan(2_000_000);
    let result: unknown = null;

    expect(() => {
      result = createRealBuildBrowserBranchRoleWriterResult(
        fixture.steps.map(({ batchResult }) => ({ batchResult, observation: null })),
      );
    }).toThrow(
      new RegExp(
        `aggregates ${aggregateGraphVisits} compiler graph-visit work-policy units; maximum is 2000000`,
        "iu",
      ),
    );
    expect(result).toBeNull();
  }, 30_000);

  it("writes and semantically replays a raw-source-empty observation closure", () => {
    const fixture = realBuildBrowserOutputV4SemanticTwoStepFixture();
    const policyInspection = inspectRealBuildPreparedObservationPolicy(
      fixture.preparedRunInputBytes,
    );
    const observation = rebindObservationClosureForLineage(
      fixture.preparedRunInputBytes,
      fixture.step1.lineage,
      fixture.step1.lineageBytes,
      "raw-empty",
    );
    const result = createRealBuildBrowserBranchRoleWriterResult([
      {
        batchResult: fixture.step1.batchResult,
        observation: {
          closureBytes: observation.closureBytes,
          roleBytes: observation.roleBytes,
          policyInspection,
        },
      },
    ]);
    const bytes = readRealBuildBrowserBranchRoleWriterBytes(result);
    const inspected = inspectRealBuildBrowserBranchEvidenceV1(
      bytes.branchEvidence,
      bytes.compiledBranchRole,
      bytes.observationRole,
    );

    expect(observation.roleBytes.length).toBeGreaterThan(0);
    expect(inspected.steps[0]!.observationClosure).not.toBeNull();
    expect(inspected.steps[0]!.observations).not.toBeNull();
    expect(readRealBuildBrowserBranchStepEvidenceBytes(inspected, 1).observations).toEqual(
      observation.roleBytes,
    );
    expect(
      inspectRealBuildBrowserBranchSemanticEvidence(
        bytes.branchEvidence,
        bytes.compiledBranchRole,
        bytes.observationRole,
        fixture.preparedRunInputBytes,
      ).steps[0],
    ).toMatchObject({
      observationClosure: "verified",
      allObservationRowsScored: false,
      selectionStatus: "unresolved",
    });
  });

  it("writes a typed failed closure without creating a raw observation-role reference", () => {
    const fixture = realBuildBrowserOutputV4SemanticTwoStepFixture();
    const policyInspection = inspectRealBuildPreparedObservationPolicy(
      fixture.preparedRunInputBytes,
    );
    const observation = rebindObservationClosureForLineage(
      fixture.preparedRunInputBytes,
      fixture.step1.lineage,
      fixture.step1.lineageBytes,
      "failed",
    );
    expect(observation.roleBytes).toHaveLength(0);
    const result = createRealBuildBrowserBranchRoleWriterResult([
      {
        batchResult: fixture.step1.batchResult,
        observation: {
          closureBytes: observation.closureBytes,
          roleBytes: null,
          policyInspection,
        },
      },
    ]);
    const bytes = readRealBuildBrowserBranchRoleWriterBytes(result);
    const inspected = inspectRealBuildBrowserBranchEvidenceV1(
      bytes.branchEvidence,
      bytes.compiledBranchRole,
      bytes.observationRole,
    );

    expect(inspected.steps[0]!.observationClosure).not.toBeNull();
    expect(inspected.steps[0]!.observations).toBeNull();
    expect(bytes.observationRole).toHaveLength(0);
    expect(
      inspectRealBuildBrowserBranchSemanticEvidence(
        bytes.branchEvidence,
        bytes.compiledBranchRole,
        bytes.observationRole,
        fixture.preparedRunInputBytes,
      ).steps[0],
    ).toMatchObject({
      observationClosure: "verified",
      allObservationRowsScored: false,
      failedObservations: 1,
    });
  });

  it("copies inputs and returns fresh role storage on every read", () => {
    const { inputs } = observedTwoStepInputs();
    const closure = inputs[0]!.observation.closureBytes;
    const observation = inputs[0]!.observation.roleBytes;
    const result = createRealBuildBrowserBranchRoleWriterResult(inputs);
    const before = readRealBuildBrowserBranchRoleWriterBytes(result);

    closure.fill(0xff);
    observation.fill(0xff);
    before.branchEvidence.fill(0);
    before.compiledBranchRole.fill(0);
    before.observationRole.fill(0);

    const after = readRealBuildBrowserBranchRoleWriterBytes(result);
    const inspected = inspectRealBuildBrowserBranchEvidenceV1(
      after.branchEvidence,
      after.compiledBranchRole,
      after.observationRole,
    );
    expect(inspected).toEqual(result.evidence);
    expect(after.branchEvidence).not.toEqual(before.branchEvidence);
    expect(after.compiledBranchRole).not.toEqual(before.compiledBranchRole);
    expect(after.observationRole).not.toEqual(before.observationRole);
  });

  it("deep-freezes exposed evidence metadata while retaining independently readable bytes", () => {
    const { inputs } = observedTwoStepInputs();
    const result = createRealBuildBrowserBranchRoleWriterResult(inputs);
    const firstStep = result.evidence.steps[0]!;
    const originalOffset = firstStep.compiledLineage.offset;

    expect(Object.isFrozen(result.evidence)).toBe(true);
    expect(Object.isFrozen(result.evidence.steps)).toBe(true);
    expect(Object.isFrozen(firstStep)).toBe(true);
    expect(Object.isFrozen(firstStep.compiledLineage)).toBe(true);
    expect(
      Reflect.set(firstStep.compiledLineage as unknown as Record<string, unknown>, "offset", 99),
    ).toBe(false);
    expect(firstStep.compiledLineage.offset).toBe(originalOffset);
    expect(() => (result.evidence.steps as unknown as unknown[]).push(firstStep)).toThrow();

    const bytes = readRealBuildBrowserBranchRoleWriterBytes(result);
    expect(
      inspectRealBuildBrowserBranchEvidenceV1(
        bytes.branchEvidence,
        bytes.compiledBranchRole,
        bytes.observationRole,
      ),
    ).toEqual(result.evidence);
  });

  it("retains exact budget-refused and failed terminal lineage bytes without observations", () => {
    for (const status of ["budget-refused", "failed"] as const) {
      const batchResult = terminalStepOneResult(status);
      expect(batchResult.status).toBe(status);
      const result = createRealBuildBrowserBranchRoleWriterResult([
        { batchResult, observation: null },
      ]);
      const bytes = readRealBuildBrowserBranchRoleWriterBytes(result);
      const inspected = inspectRealBuildBrowserBranchEvidenceV1(
        bytes.branchEvidence,
        bytes.compiledBranchRole,
        bytes.observationRole,
      );
      expect(inspected.steps).toHaveLength(1);
      expect(inspected.steps[0]!.observationClosure).toBeNull();
      expect(inspected.steps[0]!.observations).toBeNull();
      expect(bytes.observationRole).toHaveLength(0);
      expect(readRealBuildBrowserBranchStepEvidenceBytes(inspected, 1).compiledLineage).toEqual(
        decodeRealBuildAtomicCompiledBranchEvidenceWire(batchResult.evidenceWire),
      );
    }
  });

  it("rejects every retained step after a terminal budget refusal or failure", () => {
    const later = realBuildBrowserOutputV4SemanticTwoStepFixture().step2.batchResult;
    for (const status of ["budget-refused", "failed"] as const) {
      let suffixReads = 0;
      const steps = [
        { batchResult: terminalStepOneResult(status), observation: null },
        { batchResult: later, observation: null },
      ];
      Object.defineProperty(steps, "1", {
        enumerable: true,
        configurable: true,
        get() {
          suffixReads += 1;
          throw new Error("terminal suffix must remain inert");
        },
      });
      let result: unknown = null;
      expect(() => {
        result = createRealBuildBrowserBranchRoleWriterResult(steps);
      }).toThrow(/follows terminal failed or budget-refused step 1/iu);
      expect(suffixReads).toBe(0);
      expect(result).toBeNull();
    }
  });

  it("keeps retained roles private when a hostile descriptor poisons typed-array set", () => {
    const { inputs } = observedTwoStepInputs();
    const originalSet = Uint8Array.prototype.set;
    const originalCall = Function.prototype.call;
    const safeReflectApply = Reflect.apply;
    const capturedTargets = new Set<Uint8Array>();
    let interceptedIntrinsicGetterCalls = 0;
    let poisoned = false;
    const observation = new Proxy(inputs[0]!.observation, {
      getOwnPropertyDescriptor(target, property) {
        if (property === "closureBytes" && !poisoned) {
          poisoned = true;
          Uint8Array.prototype.set = function (
            this: Uint8Array,
            source: ArrayLike<number>,
            offset?: number,
          ) {
            capturedTargets.add(this);
            return originalSet.call(this, source, offset);
          };
          Function.prototype.call = function (
            this: (...args: unknown[]) => unknown,
            receiver: unknown,
            ...args: unknown[]
          ) {
            if (
              this.name === "get length" ||
              this.name === "get buffer" ||
              this.name === "get [Symbol.toStringTag]" ||
              this.name === "get byteLength"
            ) {
              interceptedIntrinsicGetterCalls += 1;
              return 0;
            }
            return safeReflectApply(originalCall, this, [receiver, ...args]);
          };
        }
        return Reflect.getOwnPropertyDescriptor(target, property);
      },
    });
    try {
      const result = createRealBuildBrowserBranchRoleWriterResult([{ ...inputs[0], observation }]);
      for (const target of capturedTargets) target.fill(0);
      capturedTargets.clear();
      const first = readRealBuildBrowserBranchRoleWriterBytes(result);
      expect(poisoned).toBe(true);
      expect(interceptedIntrinsicGetterCalls).toBe(0);
      expect(capturedTargets.size).toBe(0);
      first.compiledBranchRole.fill(0);
      const second = readRealBuildBrowserBranchRoleWriterBytes(result);
      expect(second.compiledBranchRole).not.toEqual(first.compiledBranchRole);
      const inspected = inspectRealBuildBrowserBranchEvidenceV1(
        second.branchEvidence,
        second.compiledBranchRole,
        second.observationRole,
      );
      expect(inspected).toEqual(result.evidence);
      for (const target of capturedTargets) target.fill(0);
      const retainedStep = readRealBuildBrowserBranchStepEvidenceBytes(inspected, 1);
      expect(retainedStep.compiledLineage).toEqual(
        decodeRealBuildAtomicCompiledBranchEvidenceWire(inputs[0]!.batchResult.evidenceWire),
      );
      expect(retainedStep.observationClosure).toEqual(inputs[0]!.observation.closureBytes);
      expect(retainedStep.observations).toEqual(inputs[0]!.observation.roleBytes);
    } finally {
      Uint8Array.prototype.set = originalSet;
      Function.prototype.call = originalCall;
    }
  });

  it("ignores poisoned serialization, encoder, toJSON, and WeakMap publication intrinsics", () => {
    const originalStringify = JSON.stringify;
    const originalEncode = TextEncoder.prototype.encode;
    const originalWeakGet = WeakMap.prototype.get;
    const originalWeakSet = WeakMap.prototype.set;
    const originalFreeze = Object.freeze;
    const originalIterator = Array.prototype[Symbol.iterator];
    const originalUint8Array = globalThis.Uint8Array;
    const safeReflectConstruct = Reflect.construct;
    const objectToJson = Object.getOwnPropertyDescriptor(Object.prototype, "toJSON");
    const arrayToJson = Object.getOwnPropertyDescriptor(Array.prototype, "toJSON");
    let capturedBytes: Uint8Array | null = null;
    let zeroLengthConstructorCalls = 0;
    const capturedWeakValues: unknown[] = [];
    let result: ReturnType<typeof createRealBuildBrowserBranchRoleWriterResult> | undefined;
    let bytes: ReturnType<typeof readRealBuildBrowserBranchRoleWriterBytes> | undefined;
    try {
      JSON.stringify = (() => "{}") as typeof JSON.stringify;
      TextEncoder.prototype.encode = function (input?: string) {
        const bytes = originalEncode.call(this, input);
        capturedBytes = bytes;
        return bytes;
      };
      WeakMap.prototype.set = function (key: object, value: unknown) {
        capturedWeakValues.push(value);
        return originalWeakSet.call(this, key, value);
      };
      WeakMap.prototype.get = () => undefined;
      Object.freeze = ((value: unknown) => value) as typeof Object.freeze;
      Array.prototype[Symbol.iterator] = function () {
        return {
          next: () => ({ done: true, value: undefined }),
          [Symbol.iterator]() {
            return this;
          },
        };
      } as (typeof Array.prototype)[typeof Symbol.iterator];
      globalThis.Uint8Array = new Proxy(originalUint8Array, {
        construct(target, args) {
          if (args[0] === 0) zeroLengthConstructorCalls += 1;
          return safeReflectConstruct(target, args, target) as Uint8Array;
        },
      });
      Object.defineProperty(Object.prototype, "toJSON", {
        value: () => ({ poisoned: true }),
        configurable: true,
      });
      Object.defineProperty(Array.prototype, "toJSON", {
        value: () => ["poisoned"],
        configurable: true,
      });

      result = createRealBuildBrowserBranchRoleWriterResult([]);
      (capturedBytes as Uint8Array | null)?.fill(0);
      bytes = readRealBuildBrowserBranchRoleWriterBytes(result);
    } finally {
      JSON.stringify = originalStringify;
      TextEncoder.prototype.encode = originalEncode;
      WeakMap.prototype.get = originalWeakGet;
      WeakMap.prototype.set = originalWeakSet;
      Object.freeze = originalFreeze;
      Array.prototype[Symbol.iterator] = originalIterator;
      globalThis.Uint8Array = originalUint8Array;
      if (objectToJson === undefined) delete (Object.prototype as { toJSON?: unknown }).toJSON;
      else Object.defineProperty(Object.prototype, "toJSON", objectToJson);
      if (arrayToJson === undefined) delete (Array.prototype as { toJSON?: unknown }).toJSON;
      else Object.defineProperty(Array.prototype, "toJSON", arrayToJson);
    }
    const capturedWriterStores = capturedWeakValues.filter((value) => {
      if (value === null || typeof value !== "object") return false;
      const branch = Object.getOwnPropertyDescriptor(value, "branchEvidence")?.value;
      const compiled = Object.getOwnPropertyDescriptor(value, "compiledBranchRole")?.value;
      const observation = Object.getOwnPropertyDescriptor(value, "observationRole")?.value;
      return (
        branch instanceof Uint8Array &&
        compiled instanceof Uint8Array &&
        observation instanceof Uint8Array
      );
    });
    expect(result).toBeDefined();
    expect(bytes).toBeDefined();
    expect(capturedBytes).toBeNull();
    expect(zeroLengthConstructorCalls).toBe(0);
    expect(capturedWriterStores).toEqual([]);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result!.evidence)).toBe(true);
    expect(Object.isFrozen(result!.evidence.steps)).toBe(true);
    expect(Reflect.set(result!, "authority", { authorized: true })).toBe(false);
    expect(result!.authority).toMatchObject({ status: "absent", authorized: false });
    expect(
      inspectRealBuildBrowserBranchEvidenceV1(
        bytes!.branchEvidence,
        bytes!.compiledBranchRole,
        bytes!.observationRole,
      ),
    ).toEqual(result!.evidence);
  });

  it("rejects forged batches, relabelled prefixes, sparse inputs, and hostile bytes", () => {
    const { fixture, inputs } = observedTwoStepInputs();
    expect(() =>
      createRealBuildBrowserBranchRoleWriterResult([
        { ...inputs[0], batchResult: { ...fixture.step1.batchResult } },
      ]),
    ).toThrow(/exact immutable result/iu);
    expect(() => createRealBuildBrowserBranchRoleWriterResult([inputs[1]])).toThrow(
      /exact contiguous prefix step 1/iu,
    );

    const sparse = new Array(1);
    expect(() => createRealBuildBrowserBranchRoleWriterResult(sparse)).toThrow(
      /enumerable own data property/iu,
    );
    expect(() =>
      createRealBuildBrowserBranchRoleWriterResult([
        {
          ...inputs[0],
          observation: {
            ...inputs[0]!.observation,
            closureBytes: new Proxy(inputs[0]!.observation.closureBytes, {}),
          },
        },
      ]),
    ).toThrow(/genuine Uint8Array/iu);

    if (typeof SharedArrayBuffer !== "undefined") {
      const shared = new Uint8Array(
        new SharedArrayBuffer(inputs[0]!.observation.closureBytes.length),
      );
      shared.set(inputs[0]!.observation.closureBytes);
      expect(() =>
        createRealBuildBrowserBranchRoleWriterResult([
          {
            ...inputs[0],
            observation: { ...inputs[0]!.observation, closureBytes: shared },
          },
        ]),
      ).toThrow(/SharedArrayBuffer storage/iu);
    }
  });

  it("rejects proxied, shared, and already-detached raw observation-role bytes", () => {
    const { inputs } = observedTwoStepInputs();
    const first = inputs[0]!;
    const rawRole = first.observation.roleBytes;

    expect(() =>
      createRealBuildBrowserBranchRoleWriterResult([
        {
          ...first,
          observation: { ...first.observation, roleBytes: new Proxy(rawRole, {}) },
        },
      ]),
    ).toThrow(/genuine Uint8Array/iu);

    if (typeof SharedArrayBuffer !== "undefined") {
      const shared = new Uint8Array(new SharedArrayBuffer(rawRole.length));
      shared.set(rawRole);
      expect(() =>
        createRealBuildBrowserBranchRoleWriterResult([
          {
            ...first,
            observation: { ...first.observation, roleBytes: shared },
          },
        ]),
      ).toThrow(/SharedArrayBuffer storage/iu);
    }

    const detached = new Uint8Array(rawRole);
    structuredClone(detached.buffer, { transfer: [detached.buffer] });
    expect(() =>
      createRealBuildBrowserBranchRoleWriterResult([
        {
          ...first,
          observation: { ...first.observation, roleBytes: detached },
        },
      ]),
    ).toThrow(
      /commits .* raw-role bytes.*measured input has 0|genuine Uint8Array|changed or detached/iu,
    );
  });

  it("detects raw-role detachment between aggregate measurement and bounded copying", () => {
    const { inputs } = observedTwoStepInputs();
    const first = inputs[0]!;
    const roleBytes = new Uint8Array(first.observation.roleBytes);
    let detachedDuringPreflight = false;
    const observation = new Proxy(
      { ...first.observation, roleBytes },
      {
        getOwnPropertyDescriptor(target, property) {
          if (property === "policyInspection" && !detachedDuringPreflight) {
            const buffer = roleBytes.buffer as ArrayBuffer;
            structuredClone(buffer, { transfer: [buffer] });
            detachedDuringPreflight = true;
          }
          return Reflect.getOwnPropertyDescriptor(target, property);
        },
      },
    );
    let result: unknown = null;

    expect(() => {
      result = createRealBuildBrowserBranchRoleWriterResult([
        { batchResult: first.batchResult, observation },
      ]);
    }).toThrow(/genuine Uint8Array|changed or detached|changed from/iu);
    expect(detachedDuringPreflight).toBe(true);
    expect(result).toBeNull();
  });

  it("detects closure detachment between aggregate measurement and bounded copying", () => {
    const { inputs } = observedTwoStepInputs();
    const first = inputs[0]!;
    const closureBytes = new Uint8Array(first.observation.closureBytes);
    let detachedDuringPreflight = false;
    const observation = new Proxy(
      { ...first.observation, closureBytes },
      {
        getOwnPropertyDescriptor(target, property) {
          if (property === "policyInspection" && !detachedDuringPreflight) {
            const buffer = closureBytes.buffer as ArrayBuffer;
            structuredClone(buffer, { transfer: [buffer] });
            detachedDuringPreflight = true;
          }
          return Reflect.getOwnPropertyDescriptor(target, property);
        },
      },
    );
    let result: unknown = null;

    expect(() => {
      result = createRealBuildBrowserBranchRoleWriterResult([
        { batchResult: first.batchResult, observation },
      ]);
    }).toThrow(/genuine Uint8Array|changed or detached|changed from/iu);
    expect(detachedDuringPreflight).toBe(true);
    expect(result).toBeNull();
  });

  it("refuses more than 359 steps before inspecting any entry", () => {
    const steps = new Array(360);
    let entryReads = 0;
    Object.defineProperty(steps, "0", {
      enumerable: true,
      get() {
        entryReads += 1;
        throw new Error("oversized step entries must remain inert");
      },
    });

    expect(() => createRealBuildBrowserBranchRoleWriterResult(steps)).toThrow(
      /0 through 359 dense entries/iu,
    );
    expect(entryReads).toBe(0);
  });

  it("preflights an oversized closure before inspecting later observation fields", () => {
    const { inputs } = observedTwoStepInputs();
    const first = inputs[0]!;
    let roleDescriptorReads = 0;
    const observation = new Proxy(
      {
        ...first.observation,
        closureBytes: new Uint8Array(MAXIMUM_REAL_BUILD_COMPILED_OBSERVATION_CLOSURE_BYTES + 1),
      },
      {
        getOwnPropertyDescriptor(target, property) {
          if (property === "roleBytes") roleDescriptorReads += 1;
          return Reflect.getOwnPropertyDescriptor(target, property);
        },
      },
    );
    let result: unknown = null;

    expect(() => {
      result = createRealBuildBrowserBranchRoleWriterResult([
        { batchResult: first.batchResult, observation },
      ]);
    }).toThrow(/closureBytes contains .* maximum is .* no role bytes were copied/iu);
    expect(roleDescriptorReads).toBe(0);
    expect(result).toBeNull();
  });

  it("preflights an oversized raw role before inspecting its policy", () => {
    const { inputs } = observedTwoStepInputs();
    const first = inputs[0]!;
    let policyDescriptorReads = 0;
    const observation = new Proxy(
      {
        ...first.observation,
        roleBytes: new Uint8Array(MAXIMUM_REAL_BUILD_COMPILED_OBSERVATION_ROLE_BYTES + 1),
      },
      {
        getOwnPropertyDescriptor(target, property) {
          if (property === "policyInspection") policyDescriptorReads += 1;
          return Reflect.getOwnPropertyDescriptor(target, property);
        },
      },
    );
    let result: unknown = null;

    expect(() => {
      result = createRealBuildBrowserBranchRoleWriterResult([
        { batchResult: first.batchResult, observation },
      ]);
    }).toThrow(/roleBytes contains .* maximum is .* no role bytes were copied/iu);
    expect(policyDescriptorReads).toBe(0);
    expect(result).toBeNull();
  });

  it("refuses invalid observation semantics without exposing partial output", () => {
    const { inputs } = observedTwoStepInputs();
    const corrupted = new Uint8Array(inputs[1]!.observation.closureBytes);
    corrupted[corrupted.length - 1] = corrupted[corrupted.length - 1]! ^ 1;
    let result: unknown = null;
    expect(() => {
      result = createRealBuildBrowserBranchRoleWriterResult([
        inputs[0],
        {
          ...inputs[1],
          observation: { ...inputs[1]!.observation, closureBytes: corrupted },
        },
      ]);
    }).toThrow();
    expect(result).toBeNull();
  });
});
