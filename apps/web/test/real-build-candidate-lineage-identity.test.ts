import { describe, expect, it } from "vitest";

import {
  assertRealBuildLineageParent,
  createRealBuildLineageIdentity,
  deriveRealBuildLineageIdentity,
  REAL_BUILD_ID_MAXIMUM_LENGTH,
  REAL_BUILD_LINEAGE_ID_PATTERN,
  REAL_BUILD_LINEAGE_MAXIMUM_STEP_NUMBER,
  realBuildDocumentCandidateId,
  snapshotRealBuildCandidateIdentity,
  snapshotRealBuildLineageIdentity,
  type RealBuildLineageIdentity,
} from "../e2e/real-build-candidate-lineage-identity";

const HASH_A = `sha256:${"a".repeat(64)}`;
const HASH_B = `sha256:${"b".repeat(64)}`;

function candidate(documentHash = HASH_A) {
  return {
    candidateId: realBuildDocumentCandidateId(documentHash),
    documentHash,
  };
}

function root(localId = "camera-seed:as-fitted:0") {
  return createRealBuildLineageIdentity({
    ...candidate(),
    parent: null,
    throughStepNumber: 0,
    localIdentity: { kind: "evidence", id: localId },
  });
}

function child(parent: RealBuildLineageIdentity, documentHash = HASH_A) {
  return createRealBuildLineageIdentity({
    ...candidate(documentHash),
    parent,
    throughStepNumber: 1,
    localIdentity: { kind: "decision", id: "step-1:selected" },
  });
}

describe("current real-build candidate and lineage identities", () => {
  it("keeps candidate identity content-addressed while different parents create distinct lineages", () => {
    const parentA = root("root:a");
    const parentB = root("root:b");
    const childA = child(parentA);
    const childB = child(parentB);

    expect(childA.candidateId).toBe(childB.candidateId);
    expect(childA.documentHash).toBe(childB.documentHash);
    expect(childA.lineageId).not.toBe(childB.lineageId);
    expect(childA.parentLineageId).toBe(parentA.lineageId);
    expect(childB.parentLineageId).toBe(parentB.lineageId);
    expect(childA.originLineageId).toBe(parentA.originLineageId);
    expect(childB.originLineageId).toBe(parentB.originLineageId);
  });

  it("derives the same identity deterministically from the same exact inputs", () => {
    const parent = root();
    const first = child(parent);
    const second = child(parent);

    expect(second).not.toBe(first);
    expect(second).toEqual(first);
    expect(second.lineageId).toBe(first.lineageId);
  });

  it("keeps digest-valid and direct-parent-linked identities inspection-only", () => {
    const authoritativeRoot = root();
    const authoritativeChild = child(authoritativeRoot);
    const detached = snapshotRealBuildLineageIdentity({ ...authoritativeChild });
    expect(detached).toEqual(authoritativeChild);
    assertRealBuildLineageParent(detached, authoritativeRoot);
  });

  it("rejects candidate and hash mismatches or malformed digests", () => {
    expect(() =>
      snapshotRealBuildCandidateIdentity({
        candidateId: realBuildDocumentCandidateId(HASH_A),
        documentHash: HASH_B,
      }),
    ).toThrow(/candidateId must equal document:sha256:b{64}/u);
    expect(() => realBuildDocumentCandidateId(`sha256:${"A".repeat(64)}`)).toThrow(
      /64 lowercase hexadecimal/u,
    );
    expect(() =>
      createRealBuildLineageIdentity({
        candidateId: realBuildDocumentCandidateId(HASH_A),
        documentHash: HASH_B,
        parent: null,
        throughStepNumber: 0,
        localIdentity: { kind: "evidence", id: "root" },
      }),
    ).toThrow(/candidate identity cannot differ/u);
  });

  it("makes root, parent, and inherited origin semantics explicit", () => {
    const origin = root();
    const descendant = child(origin);

    expect(origin).toMatchObject({
      lineageOrigin: "root",
      parentLineageId: null,
      originLineageId: origin.lineageId,
      throughStepNumber: 0,
    });
    expect(descendant).toMatchObject({
      lineageOrigin: "descendant",
      parentLineageId: origin.lineageId,
      originLineageId: origin.lineageId,
      throughStepNumber: 1,
    });
    expect(() =>
      createRealBuildLineageIdentity({
        ...candidate(),
        parent: null,
        throughStepNumber: 1,
        localIdentity: { kind: "decision", id: "orphan" },
      }),
    ).toThrow(/parent may be null only at throughStepNumber 0/u);
    expect(() =>
      createRealBuildLineageIdentity({
        ...candidate(),
        parent: origin,
        throughStepNumber: 0,
        localIdentity: { kind: "decision", id: "false-root" },
      }),
    ).toThrow(/throughStepNumber 0 is a root/u);
    expect(() =>
      createRealBuildLineageIdentity({
        ...candidate(),
        parent: { ...origin },
        throughStepNumber: 1,
        localIdentity: { kind: "decision", id: "forged-parent" },
      }),
    ).toThrow(/inspection continuity only/u);
  });

  it("detaches values, freezes outputs, and never freezes inputs", () => {
    const localInput = { id: "camera@panel-1", kind: "evidence" as const };
    const creationInput = {
      ...candidate(),
      localIdentity: localInput,
      parent: null,
      throughStepNumber: 0,
    };

    const identity = createRealBuildLineageIdentity(creationInput);

    expect(Object.isFrozen(creationInput)).toBe(false);
    expect(Object.isFrozen(localInput)).toBe(false);
    expect(Object.isFrozen(identity)).toBe(true);
    expect(Object.isFrozen(identity.localIdentity)).toBe(true);
    localInput.id = "changed";
    expect(identity.localIdentity.id).toBe("camera@panel-1");
  });

  it("accepts bounded grammar extrema and rejects out-of-range identifiers and steps", () => {
    const longestLocalId = `a${"-".repeat(REAL_BUILD_ID_MAXIMUM_LENGTH - 1)}`;
    const origin = root(longestLocalId);
    const last = createRealBuildLineageIdentity({
      ...candidate(HASH_B),
      parent: origin,
      throughStepNumber: REAL_BUILD_LINEAGE_MAXIMUM_STEP_NUMBER,
      localIdentity: { kind: "decision", id: "z" },
    });

    expect(origin.localIdentity.id).toHaveLength(REAL_BUILD_ID_MAXIMUM_LENGTH);
    expect(last.throughStepNumber).toBe(REAL_BUILD_LINEAGE_MAXIMUM_STEP_NUMBER);
    for (const value of [
      origin.candidateId,
      origin.lineageId,
      origin.originLineageId,
      last.lineageId,
    ]) {
      expect(value.length).toBeLessThanOrEqual(REAL_BUILD_ID_MAXIMUM_LENGTH);
      expect(REAL_BUILD_LINEAGE_ID_PATTERN.test(value)).toBe(true);
    }
    for (const id of ["", `a${"-".repeat(REAL_BUILD_ID_MAXIMUM_LENGTH)}`, "has/slash"])
      expect(() => root(id)).toThrow(/localIdentity.id/u);
    for (const throughStepNumber of [-1, 1.5, Number.MAX_SAFE_INTEGER, 360]) {
      expect(() =>
        createRealBuildLineageIdentity({
          ...candidate(),
          parent: origin,
          throughStepNumber,
          localIdentity: { kind: "decision", id: "range" },
        }),
      ).toThrow(/safe integer from 0 through 359/u);
    }
  });

  it("domain-separates every collision-sensitive derivation input", () => {
    const parentA = root("parent:a");
    const parentB = root("parent:b");
    const baseline = createRealBuildLineageIdentity({
      ...candidate(HASH_A),
      parent: parentA,
      throughStepNumber: 1,
      localIdentity: { kind: "evidence", id: "a:b" },
    });
    const variants = [
      createRealBuildLineageIdentity({
        ...candidate(HASH_A),
        parent: parentB,
        throughStepNumber: 1,
        localIdentity: { kind: "evidence", id: "a:b" },
      }),
      createRealBuildLineageIdentity({
        ...candidate(HASH_B),
        parent: parentA,
        throughStepNumber: 1,
        localIdentity: { kind: "evidence", id: "a:b" },
      }),
      createRealBuildLineageIdentity({
        ...candidate(HASH_A),
        parent: parentA,
        throughStepNumber: 2,
        localIdentity: { kind: "evidence", id: "a:b" },
      }),
      createRealBuildLineageIdentity({
        ...candidate(HASH_A),
        parent: parentA,
        throughStepNumber: 1,
        localIdentity: { kind: "decision", id: "a:b" },
      }),
      createRealBuildLineageIdentity({
        ...candidate(HASH_A),
        parent: parentA,
        throughStepNumber: 1,
        localIdentity: { kind: "evidence", id: "a" },
      }),
    ];

    expect(new Set([baseline, ...variants].map(({ lineageId }) => lineageId)).size).toBe(6);
  });

  it("verifies wire claims against the exact validated parent and origin chain", () => {
    const origin = root();
    const descendant = child(origin);
    const parsedOrigin = snapshotRealBuildLineageIdentity({ ...origin });
    const parsedDescendant = snapshotRealBuildLineageIdentity({ ...descendant });

    expect(parsedOrigin).toEqual(origin);
    expect(parsedDescendant).toEqual(descendant);
    expect(Object.isFrozen(parsedDescendant)).toBe(true);
    assertRealBuildLineageParent(parsedOrigin, null);
    assertRealBuildLineageParent(parsedDescendant, parsedOrigin);
    const samePrefixObservation = child(parsedDescendant);
    expect(samePrefixObservation.parentLineageId).toBe(parsedDescendant.lineageId);
    expect(samePrefixObservation.throughStepNumber).toBe(parsedDescendant.throughStepNumber);
    expect(() =>
      snapshotRealBuildLineageIdentity({
        ...descendant,
        originLineageId: descendant.lineageId,
      }),
    ).toThrow(/lineageId does not match its canonical candidate/u);
    expect(() =>
      snapshotRealBuildLineageIdentity({
        ...descendant,
        parentLineageId: root("other").lineageId,
      }),
    ).toThrow(/lineageId does not match its canonical candidate/u);
    expect(() =>
      snapshotRealBuildLineageIdentity({
        ...descendant,
        lineageId: `lineage:sha256:${"f".repeat(64)}`,
      }),
    ).toThrow(/lineageId does not match its canonical candidate/u);
    expect(() => assertRealBuildLineageParent(parsedDescendant, root("wrong"))).toThrow(
      /does not match the exact direct parent/u,
    );
  });

  it("derives from a detached direct parent without minting missing ancestry authority", () => {
    const origin = root();
    const parent = child(origin);
    const detachedParent = snapshotRealBuildLineageIdentity({ ...parent });
    const detachedChild = deriveRealBuildLineageIdentity({
      ...candidate(HASH_B),
      parent: detachedParent,
      throughStepNumber: 1,
      localIdentity: { kind: "evidence", id: "panel-2-observation" },
    });

    expect(detachedChild.parentLineageId).toBe(detachedParent.lineageId);
    expect(detachedChild.originLineageId).toBe(origin.lineageId);
    assertRealBuildLineageParent(detachedChild, detachedParent);
    expect(() => child(detachedChild)).toThrow(/inspection continuity only/u);
    expect(() =>
      deriveRealBuildLineageIdentity({
        ...candidate(),
        parent: null,
        throughStepNumber: 0,
        localIdentity: { kind: "evidence", id: "forged-root" },
      }),
    ).toThrow(/requires a digest-valid non-null parent/u);
  });

  it("canonically drops unknown fields without unbounded own-key enumeration", () => {
    expect(
      snapshotRealBuildCandidateIdentity({
        ...candidate(),
        extra: true,
        [Symbol("hidden")]: true,
      }),
    ).toEqual(candidate());
    expect(() =>
      snapshotRealBuildCandidateIdentity(
        Object.assign(Object.create({ inherited: true }) as object, candidate()),
      ),
    ).toThrow(/must be a plain object/u);
    let ownKeysCalls = 0;
    expect(
      snapshotRealBuildCandidateIdentity(
        new Proxy(candidate(), {
          ownKeys() {
            ownKeysCalls += 1;
            throw new Error("must not enumerate");
          },
        }),
      ),
    ).toEqual(candidate());
    expect(ownKeysCalls).toBe(0);
  });

  it("never invokes getters, toJSON, coercion hooks, or proxy get traps", () => {
    let getterCalls = 0;
    const accessorCandidate = {
      candidateId: realBuildDocumentCandidateId(HASH_A),
      get documentHash() {
        getterCalls += 1;
        return HASH_A;
      },
    };
    expect(() => snapshotRealBuildCandidateIdentity(accessorCandidate)).toThrow(
      /accessors are not invoked/u,
    );
    expect(getterCalls).toBe(0);

    let toJsonCalls = 0;
    let coercionCalls = 0;
    let getTrapCalls = 0;
    const rawCandidate = {
      ...candidate(),
      toJSON() {
        toJsonCalls += 1;
        return candidate();
      },
      [Symbol.toPrimitive]() {
        coercionCalls += 1;
        return "candidate";
      },
    };
    const proxy = new Proxy(rawCandidate, {
      get(target, property, receiver) {
        getTrapCalls += 1;
        return Reflect.get(target, property, receiver);
      },
    });
    expect(snapshotRealBuildCandidateIdentity(proxy)).toEqual(candidate());
    expect({ getterCalls, toJsonCalls, coercionCalls, getTrapCalls }).toEqual({
      getterCalls: 0,
      toJsonCalls: 0,
      coercionCalls: 0,
      getTrapCalls: 0,
    });
  });

  it("never reinspects hostile values thrown by descriptor or array checks", () => {
    let thrownPrototypeCalls = 0;
    let thrownPropertyCalls = 0;
    let thrownOwnKeysCalls = 0;
    const hostileThrownValue = new Proxy(Object.create(null) as object, {
      getPrototypeOf() {
        thrownPrototypeCalls += 1;
        throw new Error("second hostile prototype trap");
      },
      get() {
        thrownPropertyCalls += 1;
        throw new Error("second hostile property trap");
      },
      ownKeys() {
        thrownOwnKeysCalls += 1;
        throw new Error("second hostile ownKeys trap");
      },
    });
    const descriptorProxy = new Proxy(candidate(), {
      getOwnPropertyDescriptor() {
        throw hostileThrownValue;
      },
    });
    let caught: unknown;
    try {
      snapshotRealBuildCandidateIdentity(descriptorProxy);
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(TypeError);
    expect((caught as TypeError).message).toMatch(/properties could not be inspected safely/u);
    expect((caught as TypeError & { cause?: unknown }).cause).toBeUndefined();
    Reflect.ownKeys(caught as object);
    expect({ thrownPrototypeCalls, thrownPropertyCalls, thrownOwnKeysCalls }).toEqual({
      thrownPrototypeCalls: 0,
      thrownPropertyCalls: 0,
      thrownOwnKeysCalls: 0,
    });

    const revocable = Proxy.revocable(candidate(), {});
    revocable.revoke();
    expect(() => snapshotRealBuildCandidateIdentity(revocable.proxy)).toThrow(
      /could not be inspected without invoking hostile object traps/u,
    );
  });
});
