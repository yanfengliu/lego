import {
  canonicalBrickDocument,
  createEmptyBrickDocument,
  documentStructuralHash,
} from "@lego-studio/brick-kernel";
import type { BrickDocumentV1 } from "@lego-studio/protocol";
import { describe, expect, it } from "vitest";

import {
  createRealBuildLineageIdentity,
  deriveRealBuildLineageIdentity,
  realBuildDocumentCandidateId,
  type RealBuildLineageIdentity,
} from "../e2e/real-build-candidate-lineage-identity";
import { createRealBuildCandidateDocumentSnapshot } from "../e2e/real-build-candidate-document-snapshot";
import { snapshotLineagedFartherInspection } from "../e2e/real-build-farther-lineage-inspection";
import type {
  InspectedLineagedFartherPanelScore,
  LineagedFartherInspectionSnapshot,
} from "../e2e/real-build-farther-lineage-inspection-types";
import {
  describeFirstLineagedPanelError,
  describeLineagedFartherCarryError,
  describeLineagedFartherFrontierError,
} from "../e2e/real-build-farther-lineage-validation";
import { realBuildLineageAttemptEvidenceId } from "../e2e/real-build-lineage-attempt-evidence-id";

const piece = Object.freeze({
  catalogPartId: "builtin:brick-1x1",
  colorId: "builtin:black",
  transform: Object.freeze({
    positionLdu: Object.freeze([0, 0, 0] as [number, number, number]),
    orientationId: "upright-yaw-0",
  }),
});
const pieces = Object.freeze([piece]);
const digest = (character: string): string => `sha256:${character.repeat(64)}`;

function document(variant: number): BrickDocumentV1 {
  const base = createEmptyBrickDocument({
    id: `candidate-${variant}`,
    name: `Candidate ${variant}`,
  });
  return {
    ...base,
    constraints: { ...base.constraints, maxParts: base.constraints.maxParts - variant },
  };
}

function snapshot(value: BrickDocumentV1) {
  return createRealBuildCandidateDocumentSnapshot({
    canonicalDocument: canonicalBrickDocument(value),
    expectedDocumentHash: documentStructuralHash(value),
  });
}

function identity(
  value: BrickDocumentV1,
  parent: RealBuildLineageIdentity | null,
  step: number,
  id: string,
  kind: "decision" | "evidence" = "decision",
): RealBuildLineageIdentity {
  const documentHash = documentStructuralHash(value);
  return createRealBuildLineageIdentity({
    candidateId: realBuildDocumentCandidateId(documentHash),
    documentHash,
    parent,
    throughStepNumber: step,
    localIdentity: { kind, id },
  });
}

function originFrontier(converged = false) {
  const firstDocument = document(0);
  const secondDocument = converged ? firstDocument : document(1);
  const firstRoot = identity(firstDocument, null, 0, "root-a");
  const secondRoot = identity(secondDocument, null, 0, "root-b");
  const first = identity(firstDocument, firstRoot, 1, "origin-a");
  const second = identity(secondDocument, secondRoot, 1, "origin-b");
  const firstSnapshot = snapshot(firstDocument);
  const secondSnapshot = converged ? firstSnapshot : snapshot(secondDocument);
  return {
    originStepNumber: 1,
    throughStepNumber: 1,
    observationPanelStepNumber: 1,
    panelRendersUsed: 0,
    candidates: [
      {
        identity: first,
        fartherOriginLineageId: first.lineageId,
        documentSnapshot: firstSnapshot,
      },
      {
        identity: second,
        fartherOriginLineageId: second.lineageId,
        documentSnapshot: secondSnapshot,
      },
    ],
    nodes: [
      { identity: first, documentSnapshot: firstSnapshot, pieces },
      { identity: second, documentSnapshot: secondSnapshot, pieces },
    ],
  };
}

function carryInput() {
  const frontier = originFrontier();
  return {
    frontier,
    stepNumber: 2,
    expectedAtomicPieces: [{ catalogPartId: piece.catalogPartId, colorId: piece.colorId }],
    expansions: frontier.candidates.map((parent, index) => ({
      parentLineageId: parent.identity.lineageId,
      narrowingRenders: 1,
      offeredPerPiece: [1],
      carriedPerPiece: [1],
      children: [
        {
          parentLineageId: parent.identity.lineageId,
          throughStepNumber: 2,
          documentSnapshot: snapshot(document(index + 2)),
          pieces,
        },
      ],
    })),
    maximumLineages: 4,
    maximumNarrowingRenders: 4,
  };
}

function panelScore(
  parent: ReturnType<typeof originFrontier>["candidates"][number],
  panelStep: number,
  sourceEvidenceId: string,
  candidateMaskDigest: string,
  agreement: number,
): InspectedLineagedFartherPanelScore {
  const localId = realBuildLineageAttemptEvidenceId({
    candidateId: parent.identity.candidateId,
    parentLineageId: parent.identity.lineageId,
    throughStepNumber: parent.identity.throughStepNumber,
    registrationPanelStepNumber: panelStep,
    status: "scored",
    sourceEvidenceId,
  });
  const scoreIdentity = deriveRealBuildLineageIdentity({
    candidateId: parent.identity.candidateId,
    documentHash: parent.identity.documentHash,
    parent: parent.identity,
    throughStepNumber: parent.identity.throughStepNumber,
    localIdentity: { kind: "evidence", id: localId },
  });
  return {
    identity: scoreIdentity,
    fartherOriginLineageId: parent.fartherOriginLineageId,
    cameraEvidenceId: sourceEvidenceId,
    measure: "iou",
    candidateMaskDigest,
    builtMaskDigest: digest("b"),
    excludedMaskDigest: null,
    shiftPx: [0, 0],
    agreement,
  };
}

function panelInput(converged = false) {
  const frontier = originFrontier(converged);
  const sharedSource = `camera-evidence:${"a".repeat(64)}`;
  const scores = frontier.candidates.map((parent, index) =>
    panelScore(
      parent,
      2,
      converged ? sharedSource : `camera-evidence:${String(index + 1).repeat(64)}`,
      converged ? digest("c") : digest(String(index + 1)),
      converged ? 0.8 : 0.8 - index * 0.1,
    ),
  );
  return {
    frontier,
    panels: [{ stepNumber: 2, status: "scored", renderCount: 2, scores }],
    minimumAgreement: 0.5,
    minimumMargin: 0.05,
    maximumPanelRenders: 4,
    maximumReachSteps: 2,
    fartherPanelsAvailable: true,
  };
}

describe("lineaged farther bounded carry inspection", () => {
  it("admits exact complete carry evidence and rejects empty, repeated, and unchanged children", () => {
    const valid = carryInput();
    expect(
      describeLineagedFartherCarryError(snapshotLineagedFartherInspection("carry", valid)),
    ).toBeNull();

    const empty = carryInput();
    empty.expansions[0]!.children = [];
    expect(
      describeLineagedFartherCarryError(snapshotLineagedFartherInspection("carry", empty)),
    ).toMatch(/no complete child lineage/u);

    const unchanged = carryInput();
    unchanged.expansions[0]!.children[0]!.documentSnapshot =
      unchanged.frontier.candidates[0]!.documentSnapshot;
    expect(
      describeLineagedFartherCarryError(snapshotLineagedFartherInspection("carry", unchanged)),
    ).toMatch(/different candidate document/u);

    const repeated = carryInput();
    repeated.expansions.push(repeated.expansions[0]!);
    expect(
      describeLineagedFartherCarryError(snapshotLineagedFartherInspection("carry", repeated)),
    ).toMatch(/unknown or repeated parentLineageId/u);

    const inflatedCarry = carryInput();
    inflatedCarry.expansions[0]!.offeredPerPiece = [1];
    inflatedCarry.expansions[0]!.carriedPerPiece = [2];
    expect(
      describeLineagedFartherCarryError(snapshotLineagedFartherInspection("carry", inflatedCarry)),
    ).toMatch(/0 <= carried <= offered/u);
  });

  it("retains exact historical parent snapshots after carry removes parents from the frontier", () => {
    const input = carryInput();
    expect(
      describeLineagedFartherCarryError(snapshotLineagedFartherInspection("carry", input)),
    ).toBeNull();
    const childRows = input.expansions.map((expansion, index) => {
      const parent = input.frontier.candidates[index]!;
      const transition = expansion.children[0]!;
      const childIdentity = identity(
        transition.documentSnapshot.document,
        parent.identity,
        input.stepNumber,
        `carry-child-${index}`,
      );
      return {
        candidate: {
          identity: childIdentity,
          fartherOriginLineageId: parent.fartherOriginLineageId,
          documentSnapshot: transition.documentSnapshot,
        },
        node: {
          identity: childIdentity,
          documentSnapshot: transition.documentSnapshot,
          pieces: transition.pieces,
        },
      };
    });
    const carried = {
      originStepNumber: input.frontier.originStepNumber,
      throughStepNumber: input.stepNumber,
      observationPanelStepNumber: input.stepNumber,
      panelRendersUsed: input.frontier.panelRendersUsed,
      candidates: childRows.map(({ candidate }) => candidate),
      nodes: [...input.frontier.nodes, ...childRows.map(({ node }) => node)],
    };
    const inspected = snapshotLineagedFartherInspection("frontier", carried);
    expect(describeLineagedFartherFrontierError(inspected)).toBeNull();
    expect(
      inspected.value.nodes.slice(0, 2).map(({ documentSnapshot }) => documentSnapshot),
    ).toEqual(input.frontier.candidates.map(({ documentSnapshot }) => documentSnapshot));
    expect(inspected.value.candidates.map(({ documentSnapshot }) => documentSnapshot)).toEqual(
      input.expansions.map(({ children }) => children[0]!.documentSnapshot),
    );
  });

  it("rejects snapshot aliases and enforces aggregate child work before reading excess rows", () => {
    const aliased = carryInput();
    const firstChild = aliased.expansions[0]!.children[0]!;
    aliased.expansions[1]!.children[0]!.documentSnapshot = snapshot(
      firstChild.documentSnapshot.document,
    );
    expect(() => snapshotLineagedFartherInspection("carry", aliased)).toThrow(
      /different document-snapshot object/u,
    );

    const bounded = carryInput();
    bounded.expansions[0]!.children = new Array(8_192).fill(bounded.expansions[0]!.children[0]);
    let excessIndexReads = 0;
    bounded.expansions[1]!.children = new Proxy([...bounded.expansions[1]!.children], {
      getOwnPropertyDescriptor(target, key) {
        if (key !== "length") excessIndexReads += 1;
        return Reflect.getOwnPropertyDescriptor(target, key);
      },
    });
    expect(() => snapshotLineagedFartherInspection("carry", bounded)).toThrow(
      /aggregate farther-inspection child budget/u,
    );
    expect(excessIndexReads).toBe(0);
  });

  it("projects the frontier before hostile nested rows and rejects fake brands inertly", () => {
    let nestedReads = 0;
    const hostileNested = new Proxy([], {
      getOwnPropertyDescriptor(target, key) {
        nestedReads += 1;
        return Reflect.getOwnPropertyDescriptor(target, key);
      },
    });
    expect(() =>
      snapshotLineagedFartherInspection("carry", {
        frontier: {},
        stepNumber: 2,
        expectedAtomicPieces: hostileNested,
        expansions: hostileNested,
        maximumLineages: 2,
        maximumNarrowingRenders: 2,
      }),
    ).toThrow(/frontier\.originStepNumber/u);
    expect(nestedReads).toBe(0);

    let fakeReads = 0;
    const hostileValue = new Proxy(
      {},
      {
        get() {
          fakeReads += 1;
          throw new Error("must remain inert");
        },
        getOwnPropertyDescriptor() {
          fakeReads += 1;
          throw new Error("must remain inert");
        },
        ownKeys() {
          fakeReads += 1;
          throw new Error("must remain inert");
        },
      },
    );
    expect(() =>
      describeLineagedFartherCarryError(hostileValue as LineagedFartherInspectionSnapshot<"carry">),
    ).toThrow(/exact bounded inspection snapshot/u);
    expect(fakeReads).toBe(0);
  });
});

describe("lineaged farther bounded panel inspection", () => {
  it("binds every score to its parent, camera witness, metric, and converged candidate", () => {
    const valid = panelInput();
    expect(
      describeFirstLineagedPanelError(snapshotLineagedFartherInspection("panel", valid)),
    ).toBeNull();

    const wrongWitness = panelInput();
    wrongWitness.panels[0]!.scores[0] = {
      ...wrongWitness.panels[0]!.scores[0]!,
      cameraEvidenceId: `camera-evidence:${"f".repeat(64)}`,
    };
    expect(
      describeFirstLineagedPanelError(snapshotLineagedFartherInspection("panel", wrongWitness)),
    ).toMatch(/identity does not bind/u);

    const coherentConvergence = panelInput(true);
    coherentConvergence.panels[0]!.renderCount = 1;
    expect(
      describeFirstLineagedPanelError(
        snapshotLineagedFartherInspection("panel", coherentConvergence),
      ),
    ).toBeNull();
    const conflictingConvergence = panelInput(true);
    conflictingConvergence.panels[0]!.renderCount = 1;
    conflictingConvergence.panels[0]!.scores[1] = {
      ...conflictingConvergence.panels[0]!.scores[1]!,
      agreement: 0.7,
    };
    expect(
      describeFirstLineagedPanelError(
        snapshotLineagedFartherInspection("panel", conflictingConvergence),
      ),
    ).toMatch(/conflicting measurements/u);

    const incomplete = panelInput();
    incomplete.panels[0]!.scores = incomplete.panels[0]!.scores.slice(0, 1);
    incomplete.panels[0]!.renderCount = 1;
    expect(
      describeFirstLineagedPanelError(snapshotLineagedFartherInspection("panel", incomplete)),
    ).toMatch(/score every current lineage exactly once/u);

    const settledFamily = panelInput();
    settledFamily.frontier.candidates = settledFamily.frontier.candidates.slice(0, 1);
    settledFamily.frontier.nodes = settledFamily.frontier.nodes.slice(0, 1);
    settledFamily.panels[0]!.scores = settledFamily.panels[0]!.scores.slice(0, 1);
    settledFamily.panels[0]!.renderCount = 1;
    expect(
      describeFirstLineagedPanelError(snapshotLineagedFartherInspection("panel", settledFamily)),
    ).toMatch(/at least two unresolved farther-origin families/u);
  });

  it("advances exact evidence children and accounts renders and reach cumulatively", () => {
    const input = panelInput();
    const firstScores = input.panels[0]!.scores;
    const nextParents = firstScores.map((score, index) => ({
      identity: score.identity,
      fartherOriginLineageId: score.fartherOriginLineageId,
      documentSnapshot: input.frontier.candidates[index]!.documentSnapshot,
    }));
    input.panels.push({
      stepNumber: 3,
      status: "scored",
      renderCount: 2,
      scores: nextParents.map((parent, index) =>
        panelScore(
          parent,
          3,
          `camera-evidence:${String(index + 3).repeat(64)}`,
          digest(String(index + 3)),
          0.9 - index * 0.1,
        ),
      ),
    });
    expect(
      describeFirstLineagedPanelError(snapshotLineagedFartherInspection("panel", input)),
    ).toBeNull();

    input.frontier.panelRendersUsed = 1;
    expect(
      describeFirstLineagedPanelError(snapshotLineagedFartherInspection("panel", input)),
    ).toMatch(/aggregate render budget/u);

    input.frontier.panelRendersUsed = 0;
    input.maximumPanelRenders = 3;
    expect(
      describeFirstLineagedPanelError(snapshotLineagedFartherInspection("panel", input)),
    ).toMatch(/aggregate render budget/u);

    input.maximumPanelRenders = 4;
    input.maximumReachSteps = 1;
    expect(
      describeFirstLineagedPanelError(snapshotLineagedFartherInspection("panel", input)),
    ).toMatch(/maximum farther-panel reach/u);
  });

  it("projects the frontier before panels and rejects a fake panel snapshot without reads", () => {
    let panelReads = 0;
    const hostilePanels = new Proxy([], {
      getOwnPropertyDescriptor(target, key) {
        panelReads += 1;
        return Reflect.getOwnPropertyDescriptor(target, key);
      },
    });
    expect(() =>
      snapshotLineagedFartherInspection("panel", {
        frontier: {},
        panels: hostilePanels,
        minimumAgreement: 0.5,
        minimumMargin: 0.1,
        maximumPanelRenders: 2,
        maximumReachSteps: 2,
        fartherPanelsAvailable: true,
      }),
    ).toThrow(/frontier\.originStepNumber/u);
    expect(panelReads).toBe(0);

    let fakeReads = 0;
    const hostileValue = new Proxy(
      {},
      {
        get() {
          fakeReads += 1;
          throw new Error("must remain inert");
        },
        getOwnPropertyDescriptor() {
          fakeReads += 1;
          throw new Error("must remain inert");
        },
        ownKeys() {
          fakeReads += 1;
          throw new Error("must remain inert");
        },
      },
    );
    expect(() =>
      describeFirstLineagedPanelError(hostileValue as LineagedFartherInspectionSnapshot<"panel">),
    ).toThrow(/exact bounded inspection snapshot/u);
    expect(fakeReads).toBe(0);
  });
});
