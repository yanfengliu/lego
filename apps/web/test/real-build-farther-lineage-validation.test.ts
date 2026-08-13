import {
  canonicalBrickDocument,
  createEmptyBrickDocument,
  documentStructuralHash,
} from "@lego-studio/brick-kernel";
import type { BrickDocumentV1 } from "@lego-studio/protocol";
import { describe, expect, it } from "vitest";

import {
  createRealBuildLineageIdentity,
  realBuildDocumentCandidateId,
  type RealBuildLineageIdentity,
} from "../e2e/real-build-candidate-lineage-identity";
import { createRealBuildCandidateDocumentSnapshot } from "../e2e/real-build-candidate-document-snapshot";
import { freezeLineagedFartherNode } from "../e2e/real-build-farther-panel-freeze";
import { snapshotLineagedFartherInspection } from "../e2e/real-build-farther-lineage-inspection";
import {
  describeLineagedFartherFrontierError,
  describeLineagedFartherOriginError,
} from "../e2e/real-build-farther-lineage-validation";
import type {
  FartherPlacementWitness,
  LineagedFartherFrontierSnapshot,
} from "../e2e/real-build-farther-panel-types";
import type { LineagedFartherInspectionSnapshot } from "../e2e/real-build-farther-lineage-inspection-types";

const witness: readonly FartherPlacementWitness[] = [
  {
    catalogPartId: "builtin:brick-1x1",
    colorId: "builtin:black",
    transform: { positionLdu: [0, 0, 0], orientationId: "upright-yaw-0" },
  },
];

function identity(
  document: BrickDocumentV1,
  parent: RealBuildLineageIdentity | null,
  throughStepNumber: number,
  id: string,
  kind: "decision" | "evidence" = "decision",
): RealBuildLineageIdentity {
  const documentHash = documentStructuralHash(document);
  return createRealBuildLineageIdentity({
    candidateId: realBuildDocumentCandidateId(documentHash),
    documentHash,
    parent,
    throughStepNumber,
    localIdentity: { kind, id },
  });
}

const snapshot = (document: BrickDocumentV1) =>
  createRealBuildCandidateDocumentSnapshot({
    canonicalDocument: canonicalBrickDocument(document),
    expectedDocumentHash: documentStructuralHash(document),
  });

function convergentFrontier(): LineagedFartherFrontierSnapshot<BrickDocumentV1> {
  const x = createEmptyBrickDocument({ id: "candidate-x", name: "Candidate X" });
  const y = {
    ...createEmptyBrickDocument({ id: "candidate-y", name: "Candidate Y" }),
    constraints: {
      ...x.constraints,
      maxParts: x.constraints.maxParts - 1,
    },
  };
  const originDocumentA = {
    ...x,
    constraints: { ...x.constraints, maxParts: x.constraints.maxParts - 2 },
  };
  const originDocumentB = {
    ...x,
    constraints: { ...x.constraints, maxParts: x.constraints.maxParts - 3 },
  };
  const rootA = identity(originDocumentA, null, 0, "root-a");
  const rootB = identity(originDocumentB, null, 0, "root-b");
  const originA = identity(originDocumentA, rootA, 1, "origin-a");
  const originB = identity(originDocumentB, rootB, 1, "origin-b");
  const aX = identity(x, originA, 2, "a-to-x");
  const aY = identity(y, originA, 2, "a-to-y");
  const bX = identity(x, originB, 2, "b-to-x");
  const snapshotX = snapshot(x);
  const snapshotY = snapshot(y);
  const snapshotOriginA = snapshot(originDocumentA);
  const snapshotOriginB = snapshot(originDocumentB);
  return {
    originStepNumber: 1,
    throughStepNumber: 2,
    observationPanelStepNumber: 2,
    panelRendersUsed: 0,
    candidates: [
      { identity: aX, fartherOriginLineageId: originA.lineageId, documentSnapshot: snapshotX },
      {
        identity: aY,
        fartherOriginLineageId: originA.lineageId,
        documentSnapshot: snapshotY,
      },
      { identity: bX, fartherOriginLineageId: originB.lineageId, documentSnapshot: snapshotX },
    ],
    nodes: [
      { identity: originA, documentSnapshot: snapshotOriginA, pieces: witness },
      { identity: originB, documentSnapshot: snapshotOriginB, pieces: witness },
      { identity: aX, documentSnapshot: snapshotX, pieces: witness },
      { identity: aY, documentSnapshot: snapshotY, pieces: witness },
      { identity: bX, documentSnapshot: snapshotX, pieces: witness },
    ],
  };
}

describe("lineaged farther normalized DAG inspection", () => {
  it("retains A-to-X,Y and B-to-X as three lineage rows without duplicating paths", () => {
    const frontier = convergentFrontier();
    expect(
      describeLineagedFartherFrontierError(snapshotLineagedFartherInspection("frontier", frontier)),
    ).toBeNull();
    expect(frontier.candidates.map(({ identity: row }) => row.candidateId)).toEqual([
      frontier.candidates[0]!.identity.candidateId,
      frontier.candidates[1]!.identity.candidateId,
      frontier.candidates[0]!.identity.candidateId,
    ]);
    expect(new Set(frontier.candidates.map(({ identity: row }) => row.lineageId)).size).toBe(3);
    expect(frontier.nodes).toHaveLength(5);
  });

  it("refuses structural-hash aliases and duplicate parent-candidate decisions", () => {
    const frontier = convergentFrontier();
    const xAlias = createEmptyBrickDocument({ id: "candidate-x-alias", name: "Alias bytes" });
    expect(documentStructuralHash(xAlias)).toBe(frontier.candidates[0]!.identity.documentHash);
    const aliased = {
      ...frontier,
      candidates: frontier.candidates.map((candidate, index) =>
        index === 2 ? { ...candidate, documentSnapshot: snapshot(xAlias) } : candidate,
      ),
    };
    expect(() => snapshotLineagedFartherInspection("frontier", aliased)).toThrow(
      /different document-snapshot object/u,
    );

    const parent = frontier.nodes[0]!.identity;
    const duplicate = identity(
      frontier.candidates[0]!.documentSnapshot.document,
      parent,
      2,
      "a-to-x-again",
    );
    const duplicated = {
      ...frontier,
      candidates: [
        ...frontier.candidates,
        {
          identity: duplicate,
          fartherOriginLineageId: parent.lineageId,
          documentSnapshot: frontier.candidates[0]!.documentSnapshot,
        },
      ],
      nodes: [
        ...frontier.nodes,
        {
          identity: duplicate,
          documentSnapshot: frontier.candidates[0]!.documentSnapshot,
          pieces: witness,
        },
      ],
    };
    expect(
      describeLineagedFartherFrontierError(
        snapshotLineagedFartherInspection("frontier", duplicated),
      ),
    ).toMatch(/duplicates one candidate under the same direct parent/u);
  });

  it("requires exact snapshot-object continuity for converged document identities", () => {
    const frontier = convergentFrontier();
    const distinctSnapshotOfSameDocument = snapshot(
      frontier.candidates[0]!.documentSnapshot.document,
    );
    expect(distinctSnapshotOfSameDocument.canonicalBytes).toBe(
      frontier.candidates[0]!.documentSnapshot.canonicalBytes,
    );
    expect(() =>
      snapshotLineagedFartherInspection("frontier", {
        ...frontier,
        candidates: frontier.candidates.map((candidate, index) =>
          index === 2
            ? { ...candidate, documentSnapshot: distinctSnapshotOfSameDocument }
            : candidate,
        ),
      }),
    ).toThrow(/different document-snapshot object/u);
  });

  it("rejects swapped same-structural-hash node metadata and preserves exact branded snapshots when freezing", () => {
    const frontier = convergentFrontier();
    const metadataAlias = {
      ...frontier.nodes[2]!.documentSnapshot.document,
      id: "candidate-x-provenance-alias",
      name: "Different metadata and provenance",
    };
    expect(documentStructuralHash(metadataAlias)).toBe(frontier.nodes[2]!.identity.documentHash);
    expect(() =>
      snapshotLineagedFartherInspection("frontier", {
        ...frontier,
        nodes: frontier.nodes.map((node, index) =>
          index === 2 ? { ...node, documentSnapshot: snapshot(metadataAlias) } : node,
        ),
      }),
    ).toThrow(/different document-snapshot object/u);

    const frozen = freezeLineagedFartherNode(frontier.nodes[0]!);
    expect(frozen.documentSnapshot).toBe(frontier.nodes[0]!.documentSnapshot);
    expect(Object.isFrozen(frozen)).toBe(true);
    expect(() =>
      freezeLineagedFartherNode({
        ...frontier.nodes[0]!,
        documentSnapshot: {} as (typeof frontier.nodes)[number]["documentSnapshot"],
      }),
    ).toThrow(/module-created immutable BrickDocument snapshot/u);
  });

  it("never invokes ownKeys or accessors and rejects raw validator input before reading it", () => {
    const frontier = convergentFrontier();
    let ownKeysCalls = 0;
    const ownKeysHostile = new Proxy(frontier, {
      ownKeys() {
        ownKeysCalls += 1;
        throw new Error("must remain inert");
      },
    });
    expect(
      describeLineagedFartherFrontierError(
        snapshotLineagedFartherInspection("frontier", ownKeysHostile),
      ),
    ).toBeNull();
    expect(ownKeysCalls).toBe(0);

    let getterCalls = 0;
    const accessorCandidate = Object.defineProperty({ ...frontier.candidates[0] }, "identity", {
      enumerable: true,
      get() {
        getterCalls += 1;
        throw new Error("must remain inert");
      },
    });
    expect(() =>
      snapshotLineagedFartherInspection("frontier", {
        ...frontier,
        candidates: [accessorCandidate, ...frontier.candidates.slice(1)],
      }),
    ).toThrow(/identity must be an enumerable own data property/u);
    expect(getterCalls).toBe(0);

    let rawReads = 0;
    const rawValidatorInput = new Proxy(
      {},
      {
        get() {
          rawReads += 1;
          throw new Error("must remain inert");
        },
        getOwnPropertyDescriptor() {
          rawReads += 1;
          throw new Error("must remain inert");
        },
        ownKeys() {
          rawReads += 1;
          throw new Error("must remain inert");
        },
      },
    );
    expect(() =>
      describeLineagedFartherFrontierError(
        rawValidatorInput as LineagedFartherInspectionSnapshot<"frontier">,
      ),
    ).toThrow(/exact bounded inspection snapshot/u);
    expect(rawReads).toBe(0);
  });

  it("refuses an oversized nested witness array before reading any index", () => {
    const frontier = convergentFrontier();
    let indexReads = 0;
    const oversizedPieces = new Proxy(new Array(32_769), {
      getOwnPropertyDescriptor(target, key) {
        if (key !== "length") {
          indexReads += 1;
          throw new Error("must not inspect entries after length refusal");
        }
        return Reflect.getOwnPropertyDescriptor(target, key);
      },
    });
    expect(() =>
      snapshotLineagedFartherInspection("frontier", {
        ...frontier,
        nodes: [{ ...frontier.nodes[0], pieces: oversizedPieces }, ...frontier.nodes.slice(1)],
      }),
    ).toThrow(/32768-entry bound/u);
    expect(indexReads).toBe(0);
  });

  it("refuses duplicate farther origins for the same parent and candidate", () => {
    const document = createEmptyBrickDocument({ id: "duplicate-origin", name: "Duplicate" });
    const root = identity(document, null, 0, "root");
    const first = identity(document, root, 1, "first-origin");
    const second = identity(document, root, 1, "second-origin");
    const documentSnapshot = snapshot(document);
    expect(
      describeLineagedFartherOriginError(
        snapshotLineagedFartherInspection("origin", {
          stepNumber: 1,
          observationPanelStepNumber: 1,
          panelRendersUsed: 0,
          candidates: [
            {
              identity: first,
              fartherOriginLineageId: first.lineageId,
              documentSnapshot,
            },
            {
              identity: second,
              fartherOriginLineageId: second.lineageId,
              documentSnapshot,
            },
          ],
          nodes: [
            { identity: first, documentSnapshot, pieces: witness },
            { identity: second, documentSnapshot, pieces: witness },
          ],
        }),
      ),
    ).toMatch(/duplicates one candidate under the same direct parent/u);
  });

  it("refuses switched-document evidence, same-prefix decisions, and descendant origins", () => {
    const frontier = convergentFrontier();
    const origin = frontier.nodes[0]!.identity;
    const switched = identity(
      frontier.candidates[1]!.documentSnapshot.document,
      origin,
      1,
      "switched-evidence",
      "evidence",
    );
    const switchedFrontier = {
      ...frontier,
      throughStepNumber: 1,
      observationPanelStepNumber: 1,
      candidates: [
        {
          identity: switched,
          fartherOriginLineageId: origin.lineageId,
          documentSnapshot: frontier.candidates[1]!.documentSnapshot,
        },
      ],
      nodes: [
        {
          identity: origin,
          documentSnapshot: frontier.nodes[0]!.documentSnapshot,
          pieces: witness,
        },
        {
          identity: switched,
          documentSnapshot: frontier.candidates[1]!.documentSnapshot,
          pieces: null,
        },
      ],
    };
    expect(
      describeLineagedFartherFrontierError(
        snapshotLineagedFartherInspection("frontier", switchedFrontier),
      ),
    ).toMatch(/evidence edge must preserve/u);

    const samePrefix = identity(
      frontier.candidates[0]!.documentSnapshot.document,
      origin,
      1,
      "same-prefix-decision",
    );
    expect(
      describeLineagedFartherFrontierError(
        snapshotLineagedFartherInspection("frontier", {
          ...switchedFrontier,
          candidates: [
            {
              identity: samePrefix,
              fartherOriginLineageId: origin.lineageId,
              documentSnapshot: frontier.candidates[0]!.documentSnapshot,
            },
          ],
          nodes: [
            {
              identity: origin,
              documentSnapshot: frontier.nodes[0]!.documentSnapshot,
              pieces: witness,
            },
            {
              identity: samePrefix,
              documentSnapshot: frontier.candidates[0]!.documentSnapshot,
              pieces: witness,
            },
          ],
        }),
      ),
    ).toMatch(/decision edge must advance exactly one/u);

    const observed = identity(
      frontier.nodes[0]!.documentSnapshot.document,
      origin,
      1,
      "origin-observation",
      "evidence",
    );
    expect(
      describeLineagedFartherOriginError(
        snapshotLineagedFartherInspection("origin", {
          stepNumber: 1,
          observationPanelStepNumber: 1,
          panelRendersUsed: 0,
          candidates: [
            {
              identity: observed,
              fartherOriginLineageId: origin.lineageId,
              documentSnapshot: frontier.nodes[0]!.documentSnapshot,
            },
            {
              identity: frontier.nodes[1]!.identity,
              fartherOriginLineageId: frontier.nodes[1]!.identity.lineageId,
              documentSnapshot: frontier.nodes[1]!.documentSnapshot,
            },
          ],
          nodes: [
            frontier.nodes[0]!,
            frontier.nodes[1]!,
            {
              identity: observed,
              documentSnapshot: frontier.nodes[0]!.documentSnapshot,
              pieces: null,
            },
          ],
        }),
      ),
    ).toMatch(/must itself be its witnessed decision-family anchor/u);
  });
});
