import { describe, expect, it } from "vitest";

import {
  executeRealBuildFixedActionWithPhysicalAuthority,
  type RealBuildPhysicalFrameDecision,
} from "../e2e/real-build-fixed-frame-authority";

const SOURCE_HASH = `sha256:${"1".repeat(64)}`;
const OTHER_SOURCE_HASH = `sha256:${"2".repeat(64)}`;
const EVIDENCE_DIGEST = `sha256:${"3".repeat(64)}`;

const properDecision = (sourceDocumentHash = SOURCE_HASH): RealBuildPhysicalFrameDecision => ({
  schemaVersion: "lego.real-build-physical-frame-decision/1",
  auditBasis: "independent-physical-frame-audit",
  status: "proper",
  determinant: 1,
  mapping: "catalog-world-identity",
  sourceDocumentHash,
  evidenceDigest: EVIDENCE_DIGEST,
  reason: null,
});

const reflectedDecision: RealBuildPhysicalFrameDecision = {
  schemaVersion: "lego.real-build-physical-frame-decision/1",
  auditBasis: "independent-physical-frame-audit",
  status: "reflected",
  determinant: -1,
  mapping: null,
  sourceDocumentHash: SOURCE_HASH,
  evidenceDigest: EVIDENCE_DIGEST,
  reason: "Only an x-reflected ledger relation remains.",
};

const unresolvedDecision: RealBuildPhysicalFrameDecision = {
  schemaVersion: "lego.real-build-physical-frame-decision/1",
  auditBasis: "independent-physical-frame-audit",
  status: "unresolved",
  determinant: null,
  mapping: null,
  sourceDocumentHash: SOURCE_HASH,
  evidenceDigest: EVIDENCE_DIGEST,
  reason: "The two proper horizontal yaws remain tied.",
};

const panelCameraRegistration = {
  latticeHand: "x-reflected",
  latticeDeterminant: -1,
  registrationPanelStepNumber: 7,
  turnDegrees: 90,
  shiftPx: [4, -2],
};

function guardedExecution(frameDecision: unknown) {
  const calls = { structuralHash: 0, getParts: 0, place: 0, assess: 0 };
  const result = executeRealBuildFixedActionWithPhysicalAuthority({
    stepNumber: 6,
    actionKind: "multi-build-copy",
    sourceDocumentHash: SOURCE_HASH,
    frameDecision,
    execute: () => {
      calls.structuralHash += 1;
      calls.getParts += 1;
      calls.place += 1;
      calls.assess += 1;
      return "legacy-exact-transform";
    },
  });
  return { calls, result };
}

describe("real-build fixed physical-frame authority", () => {
  it.each([
    ["missing authority", undefined, "no complete independent physical-frame decision"],
    ["panel-camera registration", panelCameraRegistration, "not physical transform authority"],
    ["reflected decision", reflectedDecision, "Reflections and unresolved mappings"],
    ["unresolved decision", unresolvedDecision, "two proper horizontal yaws remain tied"],
    ["wrong source", properDecision(OTHER_SOURCE_HASH), "not the requested canonical source"],
    ["forged proper identity decision", properDecision(), "cannot certify itself"],
  ])(
    "refuses %s before hash, source lookup, placement, or assessment",
    (_label, decision, text) => {
      const { calls, result } = guardedExecution(decision);

      expect(calls).toStrictEqual({ structuralHash: 0, getParts: 0, place: 0, assess: 0 });
      expect(result).toMatchObject({
        status: "refused",
        authority: null,
        value: null,
        failure: {
          code: "fixed-ledger-frame-unresolved",
          stage: "placement",
          stepNumber: 6,
        },
      });
      expect(result.failure?.message).toContain(text);
      expect(result.failure?.message).toContain("remains unexecuted");
    },
  );

  it.each([
    ["panel-camera evidence", panelCameraRegistration],
    ["a forged proper identity decision", properDecision()],
  ])("does not read the executor callback for %s", (_label, frameDecision) => {
    const input = {
      stepNumber: 6,
      actionKind: "omitted-ledger-pieces",
      sourceDocumentHash: SOURCE_HASH,
      frameDecision,
    } as Record<string, unknown>;
    Object.defineProperty(input, "execute", {
      enumerable: true,
      get: () => {
        throw new Error("executor getter must stay behind the authority seam");
      },
    });

    expect(executeRealBuildFixedActionWithPhysicalAuthority(input)).toMatchObject({
      status: "refused",
      failure: { code: "fixed-ledger-frame-unresolved" },
    });
  });
});
