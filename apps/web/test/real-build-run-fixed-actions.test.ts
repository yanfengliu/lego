import { describe, expect, it } from "vitest";

import { readRealBuildBrowserOutput } from "../e2e/real-build-browser-output";
import { UNRESOLVED_PANEL_CAMERA_PHYSICAL_FRAME } from "../e2e/real-build-panel-camera-resolver-boundary";
import { executeRunFixedActionWithPhysicalAuthority } from "../e2e/real-build-run-fixed-actions";
import { stepPrerequisiteFacts, type RealBuildStepReport } from "../e2e/real-build-safety";
import {
  browserOutput,
  completeReport,
  documentJson,
  options,
} from "./real-build-adversarial-fixtures";

const SOURCE_HASH = `sha256:${"a".repeat(64)}`;

describe("real-build runner fixed-action authority", () => {
  it("refuses a MultiBuild copy before reading its executor or mutating the document and identities", () => {
    const stepBaseDocument = Object.freeze({ parts: Object.freeze(["source"]) });
    const runState: { document: { readonly parts: readonly string[] } } = {
      document: stepBaseDocument,
    };
    const identityBindings = new Map([["source", "part-source"]]);
    let executorGetterReads = 0;
    let executionCalls = 0;
    const guarded = executeRunFixedActionWithPhysicalAuthority({
      stepNumber: 6,
      actionKind: "multi-build-copy",
      sourceDocumentHash: SOURCE_HASH,
      frameDecision: UNRESOLVED_PANEL_CAMERA_PHYSICAL_FRAME,
      rollbackDocument: stepBaseDocument,
      get execute() {
        executorGetterReads += 1;
        return () => {
          executionCalls += 1;
          runState.document = { parts: ["source", "copy"] };
          identityBindings.set("copy", "part-copy");
        };
      },
    });
    runState.document = guarded.document;

    expect(guarded).toMatchObject({
      status: "refused",
      document: stepBaseDocument,
      partIds: [],
      registrations: [],
      placed: 0,
      stepId: null,
      failure: {
        code: "fixed-ledger-frame-unresolved",
        stage: "placement",
        stepNumber: 6,
      },
    });
    expect(executorGetterReads).toBe(0);
    expect(executionCalls).toBe(0);
    expect(runState.document).toBe(stepBaseDocument);
    expect([...identityBindings]).toStrictEqual([["source", "part-source"]]);
  });

  it("refuses omitted ledger pieces before direct placement or identity mutation begins", () => {
    const stepBaseDocument = Object.freeze({ parts: Object.freeze(["source"]) });
    const runState: { document: { readonly parts: readonly string[] } } = {
      document: stepBaseDocument,
    };
    const identityBindings = new Map([["source", "part-source"]]);
    const pendingRegistrations: string[] = [];
    let executorGetterReads = 0;
    let directPlacementCalls = 0;
    let structuralHashCalls = 0;
    let sourceLookupCalls = 0;
    let placementCalls = 0;
    const guarded = executeRunFixedActionWithPhysicalAuthority({
      stepNumber: 7,
      actionKind: "omitted-ledger-pieces",
      sourceDocumentHash: SOURCE_HASH,
      frameDecision: null,
      rollbackDocument: stepBaseDocument,
      get execute() {
        executorGetterReads += 1;
        return () => {
          structuralHashCalls += 1;
          sourceLookupCalls += 1;
          placementCalls += 1;
          directPlacementCalls += 1;
          runState.document = { parts: ["source", "direct", "omitted"] };
          identityBindings.set("direct", "part-direct");
          identityBindings.set("omitted", "part-omitted");
        };
      },
    });

    runState.document = guarded.document;
    expect(guarded.failure).toMatchObject({
      code: "fixed-ledger-frame-unresolved",
      stage: "placement",
      stepNumber: 7,
    });
    expect(guarded.failure.message).toContain("remains unexecuted");
    expect(executorGetterReads).toBe(0);
    expect({
      directPlacementCalls,
      structuralHashCalls,
      sourceLookupCalls,
      placementCalls,
    }).toStrictEqual({
      directPlacementCalls: 0,
      structuralHashCalls: 0,
      sourceLookupCalls: 0,
      placementCalls: 0,
    });
    expect(runState.document).toBe(stepBaseDocument);
    expect(pendingRegistrations).toStrictEqual([]);
    expect([...identityBindings]).toStrictEqual([["source", "part-source"]]);
  });

  it("does not let an early omitted-authority refusal bypass the retained root frontier", () => {
    const baseOptions = options(1);
    const omittedPiece = {
      identityKey: "omitted-1",
      designId: "3005",
      materialId: "21",
      catalogPartId: "builtin:brick-1x1",
      colorId: "builtin:red",
      evidenceDigest: SOURCE_HASH,
      transform: {
        positionLdu: [0, 0, 0] as const,
        orientationId: "upright-yaw-0",
      },
    };
    const panel = {
      ...baseOptions.panels[0]!,
      action: {
        kind: "place-callouts" as const,
        assembledPieces: 1,
        evidenceDigest: SOURCE_HASH,
      },
      pieces: [],
      omittedPieces: [omittedPiece],
      calloutPieces: 0,
      classifiedPhysicalCalloutPieces: 0,
      omittedPhysicalPieces: 1,
    };
    const prepared = {
      ...baseOptions,
      panels: [panel, ...baseOptions.panels.slice(1)],
    };
    const failure = executeRunFixedActionWithPhysicalAuthority({
      stepNumber: 1,
      actionKind: "omitted-ledger-pieces",
      sourceDocumentHash: prepared.inputDigests.officialModel,
      frameDecision: UNRESOLVED_PANEL_CAMERA_PHYSICAL_FRAME,
      rollbackDocument: JSON.parse(documentJson(0)) as unknown,
      execute: () => {
        throw new Error("early omitted executor must remain unread");
      },
    }).failure;
    const report: RealBuildStepReport = {
      ...completeReport(1),
      calloutPieces: 0,
      expectedAssembledPieces: 1,
      attemptedPieces: 0,
      placedPieces: 0,
      action: panel.action,
      actionEvidenceDigest: panel.action.evidenceDigest,
      canonicalStepId: null,
      prerequisites: stepPrerequisiteFacts({
        stepNumber: 1,
        actionKind: panel.action.kind,
        blockingStep: null,
        coverageFailures: [],
        unresolvedCallouts: [],
        missingDesigns: [],
        calloutPieces: 0,
        expectedAssembledPieces: 1,
        resolvedPieces: 1,
      }),
      outcome: {
        status: "failed",
        mechanism: "deferred",
        attemptedMechanism: "official-ledger",
        failure,
      },
      validation: {
        attempted: false,
        targetDocumentHash: null,
        truthSnapshotHash: null,
        validatorSetHash: null,
        documentGloballyValid: null,
        blockingIssues: [],
        failure: null,
      },
      panelCamera: null,
      pieces: [],
      deferral: null,
      farther: null,
      fartherCaptures: [],
      documentParts: 0,
    };
    const generated = browserOutput(1, [report], documentJson(0));
    const reading = readRealBuildBrowserOutput({ ...generated, reports: [report] }, prepared);

    expect(reading.envelopeDefect).toBeNull();
    expect(reading.reportDefects[0]).toMatch(/must retain the eight-way step-0 root/u);
  });
});
