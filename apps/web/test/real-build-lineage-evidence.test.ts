import { describe, expect, it } from "vitest";

import {
  createRealBuildLineageIdentity,
  realBuildDocumentCandidateId,
  type RealBuildLineageIdentity,
} from "../e2e/real-build-candidate-lineage-identity";
import {
  MAXIMUM_REAL_BUILD_LINEAGE_EVIDENCE_ATTEMPTS,
  parseRealBuildLineageEvidence,
  projectRealBuildLineageEvidence,
  realBuildLineageAttemptEvidenceId,
} from "../e2e/real-build-lineage-evidence";

const digest = (character: string) => `sha256:${character.repeat(64)}`;
const cameraId = (character: string) => `camera-evidence:${character.repeat(64)}`;
const TIE_POLICY = Object.freeze({
  metric: "panel-agreement/1" as const,
  direction: "higher-is-better" as const,
  minimumScore: 0.7,
  minimumMargin: 0.05,
  exactTie: "refuse" as const,
});

function rootSeed(index: number): RealBuildLineageIdentity {
  const documentHash = digest("0");
  const candidateId = realBuildDocumentCandidateId(documentHash);
  const hand = index < 4 ? "as-fitted" : "x-reflected";
  const determinant = hand === "as-fitted" ? 1 : -1;
  return createRealBuildLineageIdentity({
    candidateId,
    documentHash,
    parent: null,
    throughStepNumber: 0,
    localIdentity: {
      kind: "evidence",
      id:
        `${candidateId}:panel-camera-seed:p001:${hand}:d${determinant}:q` +
        String([0, 90, 180, 270][index % 4]).padStart(3, "0"),
    },
  });
}

const rootAttempt = (identity: RealBuildLineageIdentity) => ({
  ...identity,
  sourceEvidenceId: null,
  attemptEvidenceId: null,
  cameraEvidenceId: null,
  registrationPanelStepNumber: 1,
  status: "seeded" as const,
  score: null,
});

function scoredAttempt(input: {
  readonly parent: RealBuildLineageIdentity;
  readonly documentCharacter: string;
  readonly cameraCharacter: string;
  readonly score: number;
}) {
  const documentHash = digest(input.documentCharacter);
  const evidenceId = cameraId(input.cameraCharacter);
  const candidateId = realBuildDocumentCandidateId(documentHash);
  const attemptEvidenceId = realBuildLineageAttemptEvidenceId({
    candidateId,
    parentLineageId: input.parent.lineageId,
    throughStepNumber: 1,
    registrationPanelStepNumber: 2,
    status: "scored",
    sourceEvidenceId: evidenceId,
  });
  const identity = createRealBuildLineageIdentity({
    candidateId,
    documentHash,
    parent: input.parent,
    throughStepNumber: 1,
    localIdentity: { kind: "evidence", id: attemptEvidenceId },
  });
  return {
    ...identity,
    sourceEvidenceId: evidenceId,
    attemptEvidenceId,
    cameraEvidenceId: evidenceId,
    registrationPanelStepNumber: 2,
    status: "scored" as const,
    score: input.score,
  };
}

function failedAttempt(parent: RealBuildLineageIdentity, ordinal: number) {
  const documentHash = digest("c");
  const candidateId = realBuildDocumentCandidateId(documentHash);
  const sourceEvidenceId = `failure-evidence:${String(ordinal).repeat(64)}`;
  const attemptEvidenceId = realBuildLineageAttemptEvidenceId({
    candidateId,
    parentLineageId: parent.lineageId,
    throughStepNumber: 1,
    registrationPanelStepNumber: 2,
    status: "failed",
    sourceEvidenceId,
  });
  const identity = createRealBuildLineageIdentity({
    candidateId,
    documentHash,
    parent,
    throughStepNumber: 1,
    localIdentity: { kind: "evidence", id: attemptEvidenceId },
  });
  return {
    ...identity,
    sourceEvidenceId,
    attemptEvidenceId,
    cameraEvidenceId: null,
    registrationPanelStepNumber: 2,
    status: "failed" as const,
    score: null,
  };
}

function projectionInput() {
  const roots = Array.from({ length: 8 }, (_, index) => rootSeed(index));
  const attempts = [
    scoredAttempt({ parent: roots[0]!, documentCharacter: "a", cameraCharacter: "1", score: 0.9 }),
    scoredAttempt({ parent: roots[1]!, documentCharacter: "a", cameraCharacter: "1", score: 0.9 }),
    scoredAttempt({ parent: roots[2]!, documentCharacter: "b", cameraCharacter: "2", score: 0.8 }),
  ];
  return {
    throughStepNumber: 1,
    registrationPanelStepNumber: 2,
    decisionPanelStepNumber: 2,
    tiePolicy: TIE_POLICY,
    parents: roots.slice(0, 3),
    attempts,
  };
}

const mutableCopy = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const wire = (value: unknown): Uint8Array => new TextEncoder().encode(JSON.stringify(value));

describe("current real-build lineage evidence", () => {
  it("retains eight root seeds sharing one stable candidate as eight distinct lineages", () => {
    const roots = Array.from({ length: 8 }, (_, index) => rootSeed(index));
    const evidence = projectRealBuildLineageEvidence({
      throughStepNumber: 0,
      registrationPanelStepNumber: 1,
      decisionPanelStepNumber: null,
      tiePolicy: TIE_POLICY,
      parents: [],
      attempts: roots.map(rootAttempt),
    });

    expect(new Set(evidence.attempts.map(({ candidateId }) => candidateId)).size).toBe(1);
    expect(new Set(evidence.attempts.map(({ lineageId }) => lineageId)).size).toBe(8);
    expect(evidence).toMatchObject({
      status: "seeded",
      selection: {
        status: "not-applicable",
        scoredGroups: 0,
        selectedLineageIds: [],
      },
      transitions: [],
      completionAuthority: { status: "absent", authorized: false },
    });
  });

  it("keeps one document candidate under multiple parents and derives the whole winning group", () => {
    const input = projectionInput();
    const evidence = projectRealBuildLineageEvidence(input);

    expect(evidence.selection).toEqual({
      status: "selected",
      scoredGroups: 2,
      selectedCandidateId: input.attempts[0]!.candidateId,
      selectedCameraEvidenceId: input.attempts[0]!.cameraEvidenceId,
      selectedLineageIds: [input.attempts[0]!.lineageId, input.attempts[1]!.lineageId],
      bestScore: 0.9,
      runnerUpScore: 0.8,
      margin: 0.09999999999999998,
    });
    expect(evidence.transitions).toEqual(
      input.attempts.map(({ parentLineageId, lineageId }) => ({
        parentLineageId,
        childLineageId: lineageId,
      })),
    );
    expect(Object.isFrozen(evidence)).toBe(true);
    expect(Object.isFrozen(evidence.attempts[0]!.localIdentity)).toBe(true);
  });

  it("refuses exact ties between distinct score-evidence groups without a caller winner", () => {
    const input = projectionInput();
    const tied = mutableCopy(input);
    tied.attempts[2]!.score = 0.9;
    (tied as { decisionPanelStepNumber: number | null }).decisionPanelStepNumber = null;
    const evidence = projectRealBuildLineageEvidence(tied);

    expect(evidence.status).toBe("unresolved");
    expect(evidence.selection).toMatchObject({
      status: "unresolved",
      selectedCandidateId: null,
      selectedCameraEvidenceId: null,
      selectedLineageIds: [],
      margin: 0,
    });
  });

  it("rejects eight root lineages that do not share one stable document candidate", () => {
    const roots = Array.from({ length: 8 }, (_, index) => rootSeed(index));
    const foreignHash = digest("f");
    const foreignCandidateId = realBuildDocumentCandidateId(foreignHash);
    roots[7] = createRealBuildLineageIdentity({
      candidateId: foreignCandidateId,
      documentHash: foreignHash,
      parent: null,
      throughStepNumber: 0,
      localIdentity: {
        kind: "evidence",
        id: `${foreignCandidateId}:panel-camera-seed:p001:x-reflected:d-1:q270`,
      },
    });
    expect(() =>
      projectRealBuildLineageEvidence({
        throughStepNumber: 0,
        registrationPanelStepNumber: 1,
        decisionPanelStepNumber: null,
        tiePolicy: TIE_POLICY,
        parents: [],
        attempts: roots.map(rootAttempt),
      }),
    ).toThrow(/one shared canonical candidate/u);
  });

  it("retains multiple failed hypotheses under one parent without collapsing their identities", () => {
    const parent = rootSeed(0);
    const attempts = [failedAttempt(parent, 3), failedAttempt(parent, 4)];
    const evidence = projectRealBuildLineageEvidence({
      throughStepNumber: 1,
      registrationPanelStepNumber: 2,
      decisionPanelStepNumber: null,
      tiePolicy: TIE_POLICY,
      parents: [parent],
      attempts,
    });
    expect(evidence.status).toBe("failed");
    expect(new Set(evidence.attempts.map(({ lineageId }) => lineageId)).size).toBe(2);
    expect(evidence.attempts.map(({ attemptEvidenceId }) => attemptEvidenceId)).toEqual([
      attempts[0]!.attemptEvidenceId,
      attempts[1]!.attemptEvidenceId,
    ]);
  });

  it("rejects forged selections, transitions, and a caller decision label", () => {
    const evidence = projectRealBuildLineageEvidence(projectionInput());
    const forgedSelection = mutableCopy(evidence);
    (forgedSelection.selection as unknown as { selectedLineageIds: string[] }).selectedLineageIds =
      [forgedSelection.attempts[2]!.lineageId];
    expect(() => parseRealBuildLineageEvidence(wire(forgedSelection))).toThrow(
      /selection does not reproduce/u,
    );

    const forgedTransition = mutableCopy(evidence);
    (forgedTransition.transitions[0] as { childLineageId: string }).childLineageId =
      forgedTransition.attempts[2]!.lineageId;
    expect(() => parseRealBuildLineageEvidence(wire(forgedTransition))).toThrow(
      /transitions do not reproduce/u,
    );

    const tied = mutableCopy(projectionInput());
    tied.attempts[2]!.score = 0.9;
    expect(() => projectRealBuildLineageEvidence(tied)).toThrow(/cannot claim a decision panel/u);
  });

  it("requires exact direct parents and central digest-bound local identities", () => {
    const input = projectionInput();
    const missingParent = mutableCopy(input);
    missingParent.parents.splice(1, 1);
    expect(() => projectRealBuildLineageEvidence(missingParent)).toThrow(
      /parent must be retained/u,
    );

    const extraParent = mutableCopy(input);
    extraParent.parents.push(rootSeed(7));
    expect(() => projectRealBuildLineageEvidence(extraParent)).toThrow(
      /exactly the direct-parent/u,
    );

    const forgedLocal = mutableCopy(input);
    (forgedLocal.attempts[0]!.localIdentity as { id: string }).id = cameraId("9");
    expect(() => projectRealBuildLineageEvidence(forgedLocal)).toThrow(/lineageId does not match/u);
  });

  it("bounds dense arrays and never invokes accessors or hostile coercion hooks", () => {
    expect(MAXIMUM_REAL_BUILD_LINEAGE_EVIDENCE_ATTEMPTS).toBe(800_000);
    const input = projectionInput();
    let getterCalls = 0;
    Object.defineProperty(input, "attempts", {
      enumerable: true,
      get: () => {
        getterCalls += 1;
        return [];
      },
    });
    expect(() => projectRealBuildLineageEvidence(input)).toThrow(/enumerable own data property/u);
    expect(getterCalls).toBe(0);

    const oversized = projectionInput();
    oversized.attempts = Array.from({ length: 101 }, () => oversized.attempts[0]!);
    expect(() => projectRealBuildLineageEvidence(oversized, 100)).toThrow(/maximumAttempts 100/u);

    const hostile = projectionInput();
    let ownKeysCalls = 0;
    hostile.parents = new Proxy(hostile.parents, {
      ownKeys: () => {
        ownKeysCalls += 1;
        throw new Error("must not run");
      },
    });
    expect(projectRealBuildLineageEvidence(hostile).attempts).toHaveLength(3);
    expect(ownKeysCalls).toBe(0);

    const topLevel = new Proxy(projectionInput(), {
      ownKeys: () => {
        ownKeysCalls += 1;
        throw new Error("must not run");
      },
    });
    expect(projectRealBuildLineageEvidence(topLevel).attempts).toHaveLength(3);
    expect(ownKeysCalls).toBe(0);

    const beyondBooklet = projectionInput();
    (beyondBooklet as { registrationPanelStepNumber: number }).registrationPanelStepNumber = 360;
    expect(() => projectRealBuildLineageEvidence(beyondBooklet)).toThrow(/printed step 359/u);
  });

  it("returns detached frozen output, drops unknown fields, and rejects cyclic array members", () => {
    const input = projectionInput();
    const evidence = projectRealBuildLineageEvidence(input);
    const original = evidence.attempts[0]!.lineageId;
    input.attempts.splice(0, 1);
    expect(evidence.attempts[0]!.lineageId).toBe(original);

    const extra = projectionInput() as ReturnType<typeof projectionInput> & { selected: boolean };
    extra.selected = true;
    expect(projectRealBuildLineageEvidence(extra)).not.toHaveProperty("selected");

    const cyclic = projectionInput();
    const cycle: unknown[] = [];
    cycle.push(cycle);
    cyclic.parents = cycle as unknown as RealBuildLineageIdentity[];
    expect(() => projectRealBuildLineageEvidence(cyclic)).toThrow(/must be an object/u);
  });

  it("accepts only bounded genuine UTF-8 JSON bytes at the external parser boundary", () => {
    const evidence = projectRealBuildLineageEvidence(projectionInput());
    expect(parseRealBuildLineageEvidence(wire(evidence))).toEqual(evidence);
    expect(() => parseRealBuildLineageEvidence(wire(evidence), 8_192, 8)).toThrow(
      /no text was decoded or parsed/u,
    );
    expect(() => parseRealBuildLineageEvidence(new Uint8Array([0xff]))).toThrow(
      /not well-formed UTF-8/u,
    );
    expect(() => parseRealBuildLineageEvidence(new TextEncoder().encode("{"))).toThrow(
      /not valid JSON/u,
    );
    expect(() => parseRealBuildLineageEvidence(new Proxy(wire(evidence), {}))).toThrow(
      /genuine Uint8Array/u,
    );
    if (typeof SharedArrayBuffer !== "undefined") {
      const shared = new Uint8Array(new SharedArrayBuffer(8));
      expect(() => parseRealBuildLineageEvidence(shared)).toThrow(/must not use concurrently/u);
    }
  });

  it("bounds unknown JSON depth and structural expansion before parsing", () => {
    const deep = new TextEncoder().encode(`{"unknown":${"[".repeat(129)}0${"]".repeat(129)}}`);
    expect(() => parseRealBuildLineageEvidence(deep)).toThrow(/exceeds depth 128 before parsing/u);

    const expanded = new TextEncoder().encode(`{"unknown":[${"0,".repeat(2_000_000)}0]}`);
    expect(() => parseRealBuildLineageEvidence(expanded)).toThrow(
      /exceeds 2000000 structural values before parsing/u,
    );
  });
});
