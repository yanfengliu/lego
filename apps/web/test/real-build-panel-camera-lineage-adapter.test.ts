import { describe, expect, it } from "vitest";
import {
  createEmptyBrickDocument,
  documentStructuralHash,
  type Sha256Digest,
} from "@lego-studio/brick-kernel";

import {
  createRealBuildLineageIdentity,
  realBuildDocumentCandidateId,
} from "../e2e/real-build-candidate-lineage-identity";
import { createRealBuildPanelCameraBranchBudgetLedger } from "../e2e/real-build-panel-camera-branch-budget";
import { resolveRealBuildPanelCameraFrontier } from "../e2e/real-build-panel-camera-frontier";
import {
  indexRealBuildPanelCameraFrontierObservations,
  projectRealBuildPanelCameraFrontierLineageEvidence,
} from "../e2e/real-build-panel-camera-frontier-lineage-adapter";
import { projectRealBuildPanelCameraLineageEvidence } from "../e2e/real-build-panel-camera-lineage-adapter";
import { resolveRealBuildPanelCameraBranches } from "../e2e/real-build-panel-camera-resolver";

function seededResolution() {
  const document = createEmptyBrickDocument({ id: "lineage", name: "Lineage", maxParts: 10 });
  const documentHash = documentStructuralHash(document) as Sha256Digest;
  return resolveRealBuildPanelCameraBranches({
    prefix: { throughStepNumber: 0, parentLineageId: null, document, documentHash },
    registrationPanelStepNumber: 1,
    renderModelMask: () => {
      throw new Error("root must not render");
    },
    builtMask: new Uint8Array(1),
    excludedMask: null,
    widthPx: 1,
    heightPx: 1,
    ledger: createRealBuildPanelCameraBranchBudgetLedger(8),
    hashDocument: () => documentHash,
  });
}

function centralRoot(index = 0) {
  const root = projectRealBuildPanelCameraLineageEvidence({
    resolution: seededResolution(),
    parent: null,
  }).attempts[index]!;
  return createRealBuildLineageIdentity({
    candidateId: root.candidateId,
    documentHash: root.documentHash,
    parent: null,
    throughStepNumber: 0,
    localIdentity: root.localIdentity,
  });
}

function cameraParent(
  root: ReturnType<typeof centralRoot>,
  documentHash: Sha256Digest,
  localId: string,
  throughStepNumber = 1,
) {
  return createRealBuildLineageIdentity({
    candidateId: realBuildDocumentCandidateId(documentHash),
    documentHash,
    parent: root,
    throughStepNumber,
    localIdentity: { kind: "decision", id: localId },
  });
}

function budgetRefusedScalarResolution() {
  const document = createEmptyBrickDocument({
    id: "lineage-budget",
    name: "Lineage budget",
    maxParts: 10,
  });
  const documentHash = documentStructuralHash(document) as Sha256Digest;
  return resolveRealBuildPanelCameraBranches({
    prefix: { throughStepNumber: 0, parentLineageId: null, document, documentHash },
    registrationPanelStepNumber: 1,
    renderModelMask: () => {
      throw new Error("budget refusal must not render");
    },
    builtMask: new Uint8Array(1),
    excludedMask: null,
    widthPx: 1,
    heightPx: 1,
    ledger: createRealBuildPanelCameraBranchBudgetLedger(7),
    hashDocument: () => documentHash,
  });
}

function convergedFrontierResolution(
  parents: readonly ReturnType<typeof cameraParent>[],
  budget = parents.length * 8,
) {
  const document = { parts: [{ id: "shared" }] };
  const documentHash = `sha256:${"b".repeat(64)}` as Sha256Digest;
  return resolveRealBuildPanelCameraFrontier({
    prefixes: parents.map(({ lineageId }) => ({
      throughStepNumber: 1,
      parentLineageId: lineageId,
      document,
      documentHash,
    })),
    registrationPanelStepNumber: 2,
    renderModelMask: ({ hypothesis }) =>
      hypothesis.latticeHand === "as-fitted" && hypothesis.turnDegrees === 0
        ? new Uint8Array([1, 1, 0, 0])
        : new Uint8Array([1, 0, 0, 0]),
    builtMask: new Uint8Array([1, 1, 0, 0]),
    excludedMask: null,
    widthPx: 2,
    heightPx: 2,
    ledger: createRealBuildPanelCameraBranchBudgetLedger(budget),
    hashDocument: () => documentHash,
  });
}

describe("panel-camera central lineage adapter", () => {
  it("creates eight central roots from live D4 hypotheses and ignores legacy lineage labels", () => {
    const resolution = seededResolution();
    const evidence = projectRealBuildPanelCameraLineageEvidence({ resolution, parent: null });
    expect(evidence.attempts).toHaveLength(8);
    expect(new Set(evidence.attempts.map(({ lineageId }) => lineageId)).size).toBe(8);
    expect(evidence.attempts.map(({ localIdentity }) => localIdentity.id)).toEqual(
      resolution.seeds.map(
        (seed) =>
          `${resolution.candidateId}:panel-camera-seed:p001:${seed.latticeHand}:` +
          `d${seed.latticeDeterminant}:q${String(seed.turnDegrees).padStart(3, "0")}`,
      ),
    );
    expect(
      evidence.attempts.some(({ lineageId }) => lineageId.startsWith("panel-camera-lineage:")),
    ).toBe(false);
  });

  it("derives nonroot children from exact live observations and the supplied central parent", () => {
    const document = { parts: [{ id: "p" }] };
    const documentHash = `sha256:${"a".repeat(64)}` as Sha256Digest;
    const parent = cameraParent(centralRoot(), documentHash, "placement-decision:scalar");
    const resolution = resolveRealBuildPanelCameraBranches({
      prefix: { throughStepNumber: 1, parentLineageId: parent.lineageId, document, documentHash },
      registrationPanelStepNumber: 2,
      renderModelMask: ({ hypothesis }) =>
        hypothesis.latticeHand === "as-fitted" && hypothesis.turnDegrees === 0
          ? new Uint8Array([1, 1, 0, 0])
          : new Uint8Array([1, 0, 0, 0]),
      builtMask: new Uint8Array([1, 1, 0, 0]),
      excludedMask: null,
      widthPx: 2,
      heightPx: 2,
      ledger: createRealBuildPanelCameraBranchBudgetLedger(8),
      hashDocument: () => documentHash,
    });
    const evidence = projectRealBuildPanelCameraLineageEvidence({ resolution, parent });
    expect(evidence.status).toBe("selected");
    expect(evidence.parents).toEqual([parent]);
    expect(evidence.attempts).toHaveLength(8);
    expect(
      evidence.attempts.every(({ parentLineageId }) => parentLineageId === parent.lineageId),
    ).toBe(true);
    expect(evidence.selection.selectedLineageIds).toHaveLength(1);

    const scored = resolution.attempts.findIndex(({ status }) => status === "scored");
    const mutations: unknown[] = [
      {
        ...resolution,
        attempts: resolution.attempts.map((attempt, index) =>
          index === scored && attempt.status === "scored" ? { ...attempt, iou: 0.123 } : attempt,
        ),
      },
      {
        ...resolution,
        rasterMeasurement: {
          ...resolution.rasterMeasurement,
          builtMaskDigest: `sha256:${"f".repeat(64)}`,
        },
      },
      {
        ...resolution,
        renderMaskDigests: resolution.renderMaskDigests.map((digest, index) =>
          index === scored ? `sha256:${"e".repeat(64)}` : digest,
        ),
      },
      {
        ...resolution,
        observations: resolution.observations.map((observation, index) =>
          index === 0
            ? {
                ...observation,
                registration: { ...observation.registration, turnDegrees: 90 as const },
              }
            : observation,
        ),
      },
      { ...resolution, selectedObservationId: "forged-observation" },
    ];
    for (const forged of mutations) {
      expect(() =>
        projectRealBuildPanelCameraLineageEvidence({
          resolution: forged as typeof resolution,
          parent,
        }),
      ).toThrow(/exact immutable result/u);
    }
  });

  it("refuses failed batches without a typed exact failure witness producer", () => {
    const document = { parts: [{ id: "p" }] };
    const documentHash = `sha256:${"c".repeat(64)}` as Sha256Digest;
    const parent = cameraParent(centralRoot(), documentHash, "placement-decision:failed");
    const failed = resolveRealBuildPanelCameraBranches({
      prefix: {
        throughStepNumber: 1,
        parentLineageId: parent.lineageId,
        document,
        documentHash,
      },
      registrationPanelStepNumber: 2,
      renderModelMask: () => new Uint8Array(4),
      builtMask: new Uint8Array(4),
      excludedMask: null,
      widthPx: 2,
      heightPx: 2,
      ledger: createRealBuildPanelCameraBranchBudgetLedger(8),
      hashDocument: () => documentHash,
    });
    expect(() =>
      projectRealBuildPanelCameraLineageEvidence({ resolution: failed, parent }),
    ).toThrow(/typed exact failure/u);
  });

  it("refuses a genuine branded scalar budget result before root/nonroot routing", () => {
    const resolution = budgetRefusedScalarResolution();
    expect(resolution.status).toBe("budget-refused");
    expect(() => projectRealBuildPanelCameraLineageEvidence({ resolution, parent: null })).toThrow(
      /refuses budget-refused.*typed exact failure witness/u,
    );
  });

  it("refuses an observation whose exact parent names a different document prefix", () => {
    const parent = centralRoot();
    const document = { parts: [{ id: "mismatch" }] };
    const documentHash = `sha256:${"d".repeat(64)}` as Sha256Digest;
    const resolution = resolveRealBuildPanelCameraBranches({
      prefix: { throughStepNumber: 1, parentLineageId: parent.lineageId, document, documentHash },
      registrationPanelStepNumber: 2,
      renderModelMask: () => new Uint8Array([1]),
      builtMask: new Uint8Array([1]),
      excludedMask: null,
      widthPx: 1,
      heightPx: 1,
      ledger: createRealBuildPanelCameraBranchBudgetLedger(8),
      hashDocument: () => documentHash,
    });
    expect(() => projectRealBuildPanelCameraLineageEvidence({ resolution, parent })).toThrow(
      /retain the supplied parent candidateId, documentHash, and throughStepNumber/u,
    );
  });

  it("inspects scalar wrapper descriptors without invoking getters or ownKeys", () => {
    const resolution = seededResolution();
    let getterCalls = 0;
    const accessor = Object.defineProperty({ parent: null }, "resolution", {
      enumerable: true,
      get() {
        getterCalls += 1;
        return resolution;
      },
    });
    expect(() =>
      projectRealBuildPanelCameraLineageEvidence(
        accessor as unknown as Parameters<typeof projectRealBuildPanelCameraLineageEvidence>[0],
      ),
    ).toThrow(/resolution must be an enumerable own data property/u);
    expect(getterCalls).toBe(0);

    let propertyReads = 0;
    let ownKeyReads = 0;
    const wrapper = new Proxy(
      { resolution, parent: null },
      {
        get(target, key, receiver) {
          propertyReads += 1;
          return Reflect.get(target, key, receiver);
        },
        ownKeys(target) {
          ownKeyReads += 1;
          return Reflect.ownKeys(target);
        },
      },
    );
    expect(projectRealBuildPanelCameraLineageEvidence(wrapper).attempts).toHaveLength(8);
    expect(propertyReads).toBe(0);
    expect(ownKeyReads).toBe(0);
  });

  it("accepts only nonforgeable resolver results before reading nested camera facts", () => {
    const resolution = seededResolution();
    let reads = 0;
    const proxy = new Proxy(resolution, {
      get: () => {
        reads += 1;
        throw new Error("must not read");
      },
    });
    expect(() =>
      projectRealBuildPanelCameraLineageEvidence({ resolution: proxy, parent: null }),
    ).toThrow(/exact immutable result/u);
    expect(reads).toBe(0);

    for (const forged of [
      { ...resolution, reservation: { ...resolution.reservation, requested: 16 } },
      {
        ...resolution,
        seeds: resolution.seeds.map((seed, index) =>
          index === 0 ? { ...seed, latticeDeterminant: -1 as const } : seed,
        ),
      },
      { ...resolution, selectedObservationId: "forged" },
    ]) {
      expect(() =>
        projectRealBuildPanelCameraLineageEvidence({ resolution: forged, parent: null }),
      ).toThrow(/exact immutable result/u);
    }
  });

  it("fans one converged camera measurement into distinct children under two exact parents", () => {
    const sharedHash = `sha256:${"b".repeat(64)}` as Sha256Digest;
    const parents = [centralRoot(0), centralRoot(1)].map((root, index) =>
      cameraParent(root, sharedHash, `placement-decision:converged:${index}`),
    );
    const resolution = convergedFrontierResolution(parents);
    const [evidence] = projectRealBuildPanelCameraFrontierLineageEvidence({
      resolution,
      parents,
    });
    expect(evidence!.attempts).toHaveLength(16);
    expect(evidence!.selection.selectedLineageIds).toHaveLength(2);
    const selected = evidence!.attempts.filter(({ lineageId }) =>
      evidence!.selection.selectedLineageIds.includes(lineageId),
    );
    expect(new Set(selected.map(({ cameraEvidenceId }) => cameraEvidenceId)).size).toBe(1);
    expect(new Set(selected.map(({ attemptEvidenceId }) => attemptEvidenceId)).size).toBe(2);
    expect(new Set(selected.map(({ lineageId }) => lineageId)).size).toBe(2);
  });

  it("refuses a genuine branded frontier budget result before reading parents", () => {
    const sharedHash = `sha256:${"b".repeat(64)}` as Sha256Digest;
    const parents = [centralRoot(0), centralRoot(1)].map((root, index) =>
      cameraParent(root, sharedHash, `placement-decision:budget:${index}`),
    );
    const resolution = convergedFrontierResolution(parents, 15);
    expect(resolution.status).toBe("budget-refused");
    const hostileParents = Object.defineProperty([], "0", {
      enumerable: true,
      get() {
        throw new Error("budget status must win before parent inspection");
      },
    });
    Object.defineProperty(hostileParents, "length", { value: 1 });
    expect(() =>
      projectRealBuildPanelCameraFrontierLineageEvidence({
        resolution,
        parents: hostileParents,
      }),
    ).toThrow(/refuses budget-refused.*typed failure witness/u);
  });

  it("inspects frontier wrapper and parent-array descriptors without get or ownKeys", () => {
    const sharedHash = `sha256:${"b".repeat(64)}` as Sha256Digest;
    const parents = [centralRoot(0), centralRoot(1)].map((root, index) =>
      cameraParent(root, sharedHash, `placement-decision:wrapper:${index}`),
    );
    const resolution = convergedFrontierResolution(parents);
    let getterCalls = 0;
    const accessor = Object.defineProperty({ parents }, "resolution", {
      enumerable: true,
      get() {
        getterCalls += 1;
        return resolution;
      },
    });
    expect(() =>
      projectRealBuildPanelCameraFrontierLineageEvidence(
        accessor as unknown as Parameters<
          typeof projectRealBuildPanelCameraFrontierLineageEvidence
        >[0],
      ),
    ).toThrow(/resolution must be an enumerable own data property/u);
    expect(getterCalls).toBe(0);

    let wrapperReads = 0;
    let wrapperOwnKeys = 0;
    let parentReads = 0;
    let parentOwnKeys = 0;
    const parentProxy = new Proxy(parents, {
      get(target, key, receiver) {
        parentReads += 1;
        return Reflect.get(target, key, receiver);
      },
      ownKeys(target) {
        parentOwnKeys += 1;
        return Reflect.ownKeys(target);
      },
    });
    const wrapper = new Proxy(
      { resolution, parents: parentProxy },
      {
        get(target, key, receiver) {
          wrapperReads += 1;
          return Reflect.get(target, key, receiver);
        },
        ownKeys(target) {
          wrapperOwnKeys += 1;
          return Reflect.ownKeys(target);
        },
      },
    );
    expect(projectRealBuildPanelCameraFrontierLineageEvidence(wrapper)).toHaveLength(1);
    expect({ wrapperReads, wrapperOwnKeys, parentReads, parentOwnKeys }).toEqual({
      wrapperReads: 0,
      wrapperOwnKeys: 0,
      parentReads: 0,
      parentOwnKeys: 0,
    });
  });

  it("indexes a many-candidate frontier with exactly one visit per observation", () => {
    const origin = centralRoot();
    const candidateCount = 12;
    const fixtures = Array.from({ length: candidateCount }, (_, index) => {
      const documentHash = `sha256:${(index + 1).toString(16).padStart(64, "0")}` as Sha256Digest;
      return {
        parent: cameraParent(origin, documentHash, `placement-decision:linear:${index}`),
        documentHash,
      };
    });
    const parents = fixtures.map(({ parent }) => parent);
    const prefixes = fixtures.map(({ parent, documentHash }, index) => {
      return {
        throughStepNumber: 1,
        parentLineageId: parent.lineageId,
        document: { parts: [{ id: `part-${index}` }], expectedHash: documentHash },
        documentHash,
      };
    });
    const resolution = resolveRealBuildPanelCameraFrontier({
      prefixes,
      registrationPanelStepNumber: 2,
      renderModelMask: ({ hypothesis }) =>
        hypothesis.latticeHand === "as-fitted" && hypothesis.turnDegrees === 0
          ? new Uint8Array([1, 1, 0, 0])
          : new Uint8Array([1, 0, 0, 0]),
      builtMask: new Uint8Array([1, 1, 0, 0]),
      excludedMask: null,
      widthPx: 2,
      heightPx: 2,
      ledger: createRealBuildPanelCameraBranchBudgetLedger(candidateCount * 8),
      hashDocument: (document) => document.expectedHash,
    });
    const indexed = indexRealBuildPanelCameraFrontierObservations(resolution);
    expect(indexed.visitedObservationCount).toBe(resolution.observations.length);
    for (const candidate of resolution.candidates) {
      expect(
        indexed.observationsForId(candidate.candidateId, candidate.selectedObservationId!),
      ).toHaveLength(candidate.parentLineageIds.length);
    }
    const evidence = projectRealBuildPanelCameraFrontierLineageEvidence({
      resolution,
      parents,
    });
    expect(evidence).toHaveLength(candidateCount);
    expect(evidence.every(({ attempts }) => attempts.length === 8)).toBe(true);
  });
});
