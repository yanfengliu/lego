import { describe, expect, it } from "vitest";

import {
  createPanelCameraLineageContinuityState,
  panelCameraEvidenceDefect,
} from "../e2e/real-build-browser-output-panel-camera";
import { unexecutedStepReport } from "../e2e/real-build-contract";
import { completeReport, transitionPanel } from "./real-build-adversarial-fixtures";
import {
  PANEL_CAMERA_TEST_CAMERA,
  seededPanelCameraEvidence,
} from "./real-build-panel-camera-evidence.fixture";
import {
  MEASUREMENT_BOUNDARY,
  asDigest,
  continuationReport,
  continuityAfterRoot,
  continuedEvidence,
  hostileThrownObject,
  refusedEvidence,
  rootRefusalReport,
  wrongDocumentRoot,
} from "./real-build-browser-output-v3.fixture";

describe("real-build browser-output generation 3", () => {
  it("rejects reset ledgers, invented or dropped parents, and a selected non-target candidate", () => {
    const root = seededPanelCameraEvidence();
    const rootHash = root.candidates[0]!.documentHash;
    const parents = root.observations.map(({ lineageId }) => lineageId);

    const resetState = continuityAfterRoot(root);
    const reset = continuedEvidence(parents, 0, asDigest(rootHash));
    expect(
      panelCameraEvidenceDefect(
        reset,
        continuationReport(reset, rootHash),
        1,
        8_192,
        resetState,
        MEASUREMENT_BOUNDARY,
      ),
    ).toMatch(/resets or skips the cumulative branch ledger/u);

    const droppedState = continuityAfterRoot(root);
    const dropped = continuedEvidence([parents[0]!], 8, asDigest(rootHash));
    expect(
      panelCameraEvidenceDefect(
        dropped,
        continuationReport(dropped, rootHash),
        1,
        8_192,
        droppedState,
        MEASUREMENT_BOUNDARY,
      ),
    ).toMatch(/does not carry the complete preceding camera frontier/u);

    const inventedState = continuityAfterRoot(root);
    const invented = continuedEvidence(
      [...parents.slice(0, -1), "invented-parent"],
      8,
      asDigest(rootHash),
    );
    expect(
      panelCameraEvidenceDefect(
        invented,
        continuationReport(invented, rootHash),
        1,
        8_192,
        inventedState,
        MEASUREMENT_BOUNDARY,
      ),
    ).toMatch(/was not a root seed or selected lineage/u);

    const targetState = continuityAfterRoot(root);
    const selected = continuedEvidence(parents, 8, asDigest(rootHash));
    const falseTarget = {
      ...completeReport(2),
      camera: PANEL_CAMERA_TEST_CAMERA,
      expectedAssembledPieces: 1,
      placedPieces: 1,
      panelCamera: selected,
      validation: {
        ...completeReport(2).validation,
        targetDocumentHash: `sha256:${"d".repeat(64)}`,
      },
    };
    expect(
      panelCameraEvidenceDefect(selected, falseTarget, 1, 8_192, targetState, MEASUREMENT_BOUNDARY),
    ).toMatch(/target hash.*selected panel-camera candidate/u);
  });

  it("requires the canonical empty-document root and does not let a refusal replace or shrink it", () => {
    const root = seededPanelCameraEvidence(8);
    const expectedHash = root.candidates[0]!.documentHash;
    const state = createPanelCameraLineageContinuityState(expectedHash);

    expect(
      panelCameraEvidenceDefect(wrongDocumentRoot(), rootRefusalReport(), 0, 8_192, state),
    ).toMatch(/deterministic canonical empty real-build document/u);

    const parents = root.observations.map(({ lineageId }) => lineageId);
    const replacement = refusedEvidence(parents);
    const replacementState = createPanelCameraLineageContinuityState(expectedHash);
    expect(
      panelCameraEvidenceDefect(replacement, rootRefusalReport(), 0, 8, replacementState),
    ).toMatch(/must be the eight-way step-0 seeded root/u);

    const narrowed = refusedEvidence([parents[0]!]);
    const continuedState = continuityAfterRoot(root);
    expect(
      panelCameraEvidenceDefect(
        narrowed,
        {
          ...completeReport(2),
          canonicalStepId: null,
          outcome: {
            status: "failed",
            mechanism: "deferred",
            attemptedMechanism: null,
            failure: narrowed.failure!,
          },
        },
        1,
        8,
        continuedState,
      ),
    ).toMatch(/complete retained frontier.*requires 64/u);
    expect(continuedState.eligibleParents).toHaveLength(8);
  });

  it("does not accept a self-reported local failure as proof that lineage was never attempted", () => {
    const root = seededPanelCameraEvidence();
    const state = createPanelCameraLineageContinuityState(root.candidates[0]!.documentHash);
    state.seededRoot = true;
    state.reservedAfter = 8;
    for (const observation of root.observations) {
      state.eligibleParents.add(observation.lineageId);
      state.seenLineages.add(observation.lineageId);
    }
    const report = rootRefusalReport();
    const localFailure = {
      code: "coverage-key-mismatch" as const,
      stage: "coverage" as const,
      stepNumber: 2,
      message: "Self-reported current-row failure.",
    };
    expect(
      panelCameraEvidenceDefect(
        null,
        {
          ...report,
          stepNumber: 2,
          prerequisites: { ...report.prerequisites, blockingStep: null, localFailure },
          outcome: { ...report.outcome, failure: localFailure },
        },
        1,
        8_192,
        state,
      ),
    ).toMatch(/not causally blocked by an earlier accepted failed report/u);
  });

  it("keeps a failed root terminal and rejects camera work on later blocked rows", () => {
    const root = seededPanelCameraEvidence();
    const rootHash = root.candidates[0]!.documentHash;
    const state = createPanelCameraLineageContinuityState(rootHash);
    expect(panelCameraEvidenceDefect(root, rootRefusalReport(), 0, 8_192, state)).toBeNull();

    const blockedBase = unexecutedStepReport(
      transitionPanel(2),
      {
        code: "blocked-by-prior-step",
        stage: "causality",
        stepNumber: 2,
        causedByStep: 1,
        message: "Step 2 remains blocked by the unresolved root.",
      },
      { blockingStep: 1, documentParts: 0 },
    );
    const report = { ...blockedBase, outcome: { ...blockedBase.outcome, mechanism: "blocked" } };
    expect(
      panelCameraEvidenceDefect(
        continuedEvidence(
          root.observations.map(({ lineageId }) => lineageId),
          8,
          asDigest(rootHash),
        ),
        report,
        1,
        8_192,
        state,
        MEASUREMENT_BOUNDARY,
      ),
    ).toMatch(/must be null after failed printed step 1/u);
  });

  it("contains hostile nested array/descriptor traps and bounds their thrown payloads", () => {
    const root = seededPanelCameraEvidence();
    const rootHash = root.candidates[0]!.documentHash;
    const report = rootRefusalReport();
    const hostile = hostileThrownObject();
    const hostileLength = new Proxy(root.candidates as unknown as object[], {
      get: (target, key, receiver) => {
        if (key === "length") throw hostile;
        return Reflect.get(target, key, receiver);
      },
    });
    const hostileDescriptor = new Proxy(root.candidates as unknown as object[], {
      getOwnPropertyDescriptor: (_target, key) => {
        if (key === "0") throw "x".repeat(100_000);
        return Reflect.getOwnPropertyDescriptor(root.candidates, key);
      },
    });

    for (const candidates of [hostileLength, hostileDescriptor]) {
      const defect = panelCameraEvidenceDefect(
        { ...root, candidates },
        report,
        0,
        8_192,
        createPanelCameraLineageContinuityState(rootHash),
      );
      expect(defect).toContain("panelCamera is invalid");
      expect(defect!.length).toBeLessThan(1_024);
    }
  });

  it("contains a hostile nested report accessor without invoking its thrown object", () => {
    const root = seededPanelCameraEvidence();
    const report = { ...rootRefusalReport() } as Record<string, unknown>;
    const state = createPanelCameraLineageContinuityState(root.candidates[0]!.documentHash);
    Object.defineProperty(report, "outcome", {
      enumerable: true,
      get: () => {
        throw hostileThrownObject();
      },
    });

    const defect = panelCameraEvidenceDefect(root, report, 0, 8_192, state);
    expect(defect).toContain("could not be safely inspected");
    expect(defect).toContain("a thrown non-primitive value");
    expect(defect!.length).toBeLessThan(1_024);
    expect(state).toMatchObject({ seededRoot: false, reservedAfter: 0, blockingStep: null });
    expect(state.eligibleParents).toHaveLength(0);
    expect(state.seenLineages).toHaveLength(0);
  });

  it("contains hostile continuity iterators before evidence parsing begins", () => {
    const root = seededPanelCameraEvidence();
    const state = createPanelCameraLineageContinuityState(root.candidates[0]!.documentHash);
    const hostile = hostileThrownObject();
    Object.defineProperty(state.eligibleParents, Symbol.iterator, {
      value: () => {
        throw hostile;
      },
    });

    const defect = panelCameraEvidenceDefect(root, rootRefusalReport(), 0, 8_192, state);
    expect(defect).toContain("could not be safely inspected");
    expect(defect).toContain("a thrown non-primitive value");
  });
});
