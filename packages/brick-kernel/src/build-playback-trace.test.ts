import { describe, expect, it } from "vitest";

import type { BuildOperation } from "@lego-studio/protocol";

import {
  BuildPlaybackTraceError,
  BUILD_PLAYBACK_TRACE_LIMITS,
  createBuildPlaybackTrace,
  deriveBuildSequenceFromTrace,
} from "./build-playback-trace.ts";
import { canonicalDigest } from "./canonical.ts";
import { deriveBuildSequence } from "./build-sequence.ts";
import { createEmptyBrickDocument, createPartInstance } from "./factory.ts";
import { applyBuildOperations } from "./operations.ts";

function fixture() {
  const base = createEmptyBrickDocument({ id: "trace", name: "Exact trace" });
  const initialPart = createPartInstance({
    id: "part-1",
    catalogPartId: "builtin:brick-1x1",
    colorId: "builtin:red",
    transform: { positionLdu: [0, 0, 0], orientationId: "upright-yaw-0" },
  });
  const returnedPart = {
    ...initialPart,
    transform: { positionLdu: [20, 0, 0] as const, orientationId: "upright-yaw-0" },
  };
  const step1Operations: readonly BuildOperation[] = [
    {
      kind: "addPart",
      operationId: "step-1-add-part",
      part: initialPart,
      semanticRegionIds: [],
    },
  ];
  const returnOperations: readonly BuildOperation[] = [
    {
      kind: "updatePart",
      operationId: "step-2-return-part",
      before: initialPart,
      after: returnedPart,
    },
  ];
  const zeroStepOperations: readonly BuildOperation[] = [
    {
      kind: "addStep",
      operationId: "step-2-add-empty-step",
      step: { id: "step-2", index: 1, name: "Step 2 return", partIds: [] },
    },
  ];
  const transitionGroups: readonly (readonly (readonly BuildOperation[])[])[] = [
    [step1Operations],
    [returnOperations, zeroStepOperations],
  ];
  let target = base;
  for (const groups of transitionGroups) {
    for (const operations of groups) target = applyBuildOperations(target, operations);
  }
  return { base, transitionGroups, initialPart, returnedPart, target };
}

describe("operation-backed build playback traces", () => {
  it("renders a zero-piece return as a distinct operation-replayed transition", () => {
    const { base, transitionGroups, initialPart, returnedPart, target } = fixture();
    const trace = createBuildPlaybackTrace(base, transitionGroups);
    const exact = deriveBuildSequenceFromTrace(target, trace);

    expect(exact).toMatchObject({
      mode: "operation-trace-exact",
      exact: true,
      traceCommitment: trace.traceCommitment,
    });
    expect(exact.states).toHaveLength(3);
    expect(exact.states[1]?.addedPartIds).toEqual([initialPart.id]);
    expect(exact.states[2]?.addedPartIds).toEqual([]);
    expect(exact.states[1]?.document.parts[0]?.transform).toEqual(initialPart.transform);
    expect(exact.states[2]?.document.parts[0]?.transform).toEqual(returnedPart.transform);
    expect(trace.transitions[1]?.operationGroups).toHaveLength(2);
    expect(canonicalDigest(exact.states[2]?.document)).toBe(canonicalDigest(target));
    expect(exact.states[1]?.report.targetDocumentHash).not.toBe(
      exact.states[2]?.report.targetDocumentHash,
    );

    const preview = deriveBuildSequence(target);
    expect(preview).toMatchObject({
      mode: "membership-preview",
      exact: false,
      traceCommitment: null,
    });
    expect(preview.states[1]?.document.parts[0]?.transform).toEqual(returnedPart.transform);
  });

  it("accepts the compiler's remove-bootstrap/add-printed-Step-1 operation shape", () => {
    const base = createEmptyBrickDocument({ id: "bootstrap", name: "Bootstrap" });
    const part = createPartInstance({ id: "printed-part", stepId: "printed-step-1" });
    const operations: readonly BuildOperation[] = [
      {
        kind: "removeStep",
        operationId: "remove-bootstrap-step",
        step: base.steps[0]!,
      },
      {
        kind: "addStep",
        operationId: "add-printed-step",
        step: { id: "printed-step-1", index: 0, name: "Printed step 1", partIds: [] },
      },
      {
        kind: "addPart",
        operationId: "add-printed-part",
        part,
        semanticRegionIds: [],
      },
    ];
    const target = applyBuildOperations(base, operations);
    const trace = createBuildPlaybackTrace(base, [[operations]]);

    expect(deriveBuildSequenceFromTrace(target, trace).states[1]).toMatchObject({
      stepId: "printed-step-1",
      stepName: "Printed step 1",
      addedPartIds: ["printed-part"],
    });
  });

  it("invalidates exactness on structural edits but deliberately tolerates cosmetic rename", () => {
    const { base, transitionGroups, target } = fixture();
    const trace = createBuildPlaybackTrace(base, transitionGroups);
    const recolored = {
      ...target,
      parts: target.parts.map((part) => ({ ...part, colorId: "builtin:yellow" })),
    };
    expect(() => deriveBuildSequenceFromTrace(recolored, trace)).toThrow(BuildPlaybackTraceError);

    const renamed = { ...target, name: "Cosmetic rename" };
    expect(deriveBuildSequenceFromTrace(renamed, trace)).toMatchObject({ exact: true });

    const relabeledStep = {
      ...target,
      steps: target.steps.map((step, index) =>
        index === 1 ? { ...step, name: "Untraced label" } : step,
      ),
    };
    expect(() => deriveBuildSequenceFromTrace(relabeledStep, trace)).toThrow(
      BuildPlaybackTraceError,
    );
  });

  it("contains hostile operation and document failures behind the typed trace boundary", () => {
    const { base, transitionGroups, target } = fixture();
    const trace = structuredClone(createBuildPlaybackTrace(base, transitionGroups));
    const forged = structuredClone(trace) as unknown as {
      transitions: { operationGroups: unknown[][] }[];
    };
    forged.transitions[0]!.operationGroups[0]![0] = {
      kind: "executeScript",
      source: "hostile",
    };
    expect(() => deriveBuildSequenceFromTrace(target, forged)).toThrow(BuildPlaybackTraceError);

    const hostileBase = structuredClone(trace) as unknown as { baseDocument: unknown };
    hostileBase.baseDocument = { schemaVersion: "not-a-document" };
    expect(() => deriveBuildSequenceFromTrace(target, hostileBase)).toThrow(
      BuildPlaybackTraceError,
    );
  });

  it("rejects nonempty or uncovered bases and missing target transitions", () => {
    const { base, transitionGroups, target } = fixture();
    expect(() => createBuildPlaybackTrace(target, [])).toThrow(BuildPlaybackTraceError);
    expect(() => createBuildPlaybackTrace(base, [])).toThrow(BuildPlaybackTraceError);

    const trace = structuredClone(createBuildPlaybackTrace(base, transitionGroups)) as unknown as {
      transitions: unknown[];
    };
    trace.transitions.pop();
    expect(() => deriveBuildSequenceFromTrace(target, trace)).toThrow(BuildPlaybackTraceError);

    const missingPrefix = structuredClone(
      createBuildPlaybackTrace(base, transitionGroups),
    ) as unknown as {
      transitions: unknown[];
    };
    missingPrefix.transitions.shift();
    expect(() => deriveBuildSequenceFromTrace(target, missingPrefix)).toThrow(
      BuildPlaybackTraceError,
    );
  });

  it("bounds the detached untrusted trace envelope before replay", () => {
    const { base, transitionGroups, target } = fixture();
    const trace = createBuildPlaybackTrace(base, transitionGroups);
    expect(() =>
      deriveBuildSequenceFromTrace(target, {
        ...trace,
        padding: "x".repeat(BUILD_PLAYBACK_TRACE_LIMITS.maxBytes),
      }),
    ).toThrow(BuildPlaybackTraceError);
  });
});
