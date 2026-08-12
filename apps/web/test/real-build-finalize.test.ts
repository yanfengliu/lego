import { describe, expect, it } from "vitest";

import {
  createEmptyBrickDocument,
  createPartInstance,
  validateBrickDocument,
} from "@lego-studio/brick-kernel";

import { finalizeExecutedRealBuildResult } from "../e2e/real-build-finalize";
import {
  stepPrerequisiteFacts,
  type RealBuildOptions,
  type RealBuildPanelSpec,
  type RealBuildPieceReport,
  type RealBuildStepReport,
} from "../e2e/real-build-safety";
import type {
  RealBuildBrowserOutput,
  RealBuildIdentityBinding,
} from "../e2e/real-build-browser-output";
import {
  REAL_BUILD_TEST_DIGEST,
  completeRealBuildTestOptions,
  realBuildTransitionPanel,
} from "./real-build-test-options";

const DIGEST = REAL_BUILD_TEST_DIGEST;
const LEFT = { positionLdu: [0, 0, 0] as const, orientationId: "upright-yaw-0" };
const RIGHT = { positionLdu: [40, 0, 0] as const, orientationId: "upright-yaw-0" };

function identityOptions(): RealBuildOptions {
  const trusted = completeRealBuildTestOptions(1);
  const sourcePanel = trusted.panels[357]!;
  if (sourcePanel.action.kind !== "place-callouts") {
    throw new TypeError("The complete fixture must retain its direct-piece panel at step 358.");
  }
  const removedCallouts = new Set(sourcePanel.pieces.slice(-2).map(({ calloutKey }) => calloutKey));
  const panel: RealBuildPanelSpec = {
    ...realBuildTransitionPanel(1),
    action: { kind: "place-callouts", assembledPieces: 2, evidenceDigest: DIGEST },
    pieces: [
      {
        identityKey: "brick-left",
        designId: "3005",
        materialId: "1",
        catalogPartId: "builtin:brick-1x1",
        colorId: "builtin:black",
        calloutKey: "p1-left.png",
        identificationConfidence: "vision-kept",
        cropDigest: DIGEST,
        identificationInputDigest: DIGEST,
        expectedTransform: LEFT,
      },
      {
        identityKey: "brick-right",
        designId: "3005",
        materialId: "1",
        catalogPartId: "builtin:brick-1x1",
        colorId: "builtin:black",
        calloutKey: "p1-right.png",
        identificationConfidence: "vision-kept",
        cropDigest: DIGEST,
        identificationInputDigest: DIGEST,
        expectedTransform: RIGHT,
      },
    ],
    calloutPieces: 2,
    classifiedPhysicalCalloutPieces: 2,
    mappedCalloutKeys: ["p1-left.png", "p1-right.png"],
  };
  const rebalancedSourcePanel: RealBuildPanelSpec = {
    ...sourcePanel,
    pieces: sourcePanel.pieces.slice(0, -2),
    mappedCalloutKeys: sourcePanel.mappedCalloutKeys.slice(0, -2),
    calloutPieces: sourcePanel.calloutPieces - 2,
    classifiedPhysicalCalloutPieces: sourcePanel.classifiedPhysicalCalloutPieces - 2,
    action: { ...sourcePanel.action, assembledPieces: sourcePanel.action.assembledPieces - 2 },
  };
  return {
    ...trusted,
    panels: trusted.panels.map((candidate) => {
      if (candidate.stepNumber === 1) return panel;
      if (candidate.stepNumber === 358) return rebalancedSourcePanel;
      return candidate;
    }),
    coverageByCallout: {
      ...Object.fromEntries(
        Object.entries(trusted.coverageByCallout).filter(
          ([calloutKey]) => !removedCallouts.has(calloutKey),
        ),
      ),
      "p1-left.png": {
        pageNumber: 1,
        stepNumber: 1,
        quantity: 1,
        identificationConfidence: "vision-kept",
        cropDigest: DIGEST,
        inputDigest: DIGEST,
      },
      "p1-right.png": {
        pageNumber: 1,
        stepNumber: 1,
        quantity: 1,
        identificationConfidence: "vision-kept",
        cropDigest: DIGEST,
        inputDigest: DIGEST,
      },
    },
  };
}

const pieceReport = (transform: typeof LEFT | typeof RIGHT): RealBuildPieceReport => ({
  catalogPartId: "builtin:brick-1x1",
  blind: {
    comparisonPrefixHash: DIGEST,
    distinctCandidates: 1,
    feasible: true,
    rendered: 1,
    bestScore: 0.9,
    runnerUpScore: null,
    agreesWithHighlight: true,
    refusal: null,
    elapsedMs: 1,
  },
  enumerated: 1,
  afterProximity: 1,
  rendered: 1,
  bestScore: 0.9,
  runnerUpScore: null,
  placed: true,
  positionLdu: transform.positionLdu,
  orientationId: transform.orientationId,
  failure: null,
});

function browserOutput(
  document: ReturnType<typeof createEmptyBrickDocument>,
  identityBindings: readonly RealBuildIdentityBinding[],
): RealBuildBrowserOutput {
  const validation = validateBrickDocument(document);
  const report: RealBuildStepReport = {
    stepNumber: 1,
    pageNumber: 1,
    panelFace: "studs-up",
    calloutPieces: 2,
    expectedAssembledPieces: 2,
    attemptedPieces: 2,
    placedPieces: 2,
    action: { kind: "place-callouts", assembledPieces: 2, evidenceDigest: DIGEST },
    actionEvidenceDigest: DIGEST,
    canonicalStepId: document.steps[0]!.id,
    prerequisites: stepPrerequisiteFacts({
      stepNumber: 1,
      actionKind: "place-callouts",
      blockingStep: null,
      coverageFailures: [],
      unresolvedCallouts: [],
      missingDesigns: [],
      calloutPieces: 2,
      expectedAssembledPieces: 2,
      resolvedPieces: 2,
    }),
    outcome: { status: "complete", mechanism: "highlight", failure: null },
    validation: {
      attempted: true,
      targetDocumentHash: validation.targetDocumentHash,
      truthSnapshotHash: validation.truthSnapshotHash,
      validatorSetHash: validation.validatorSetHash,
      documentGloballyValid: validation.documentGloballyValid,
      blockingIssues: validation.issues
        .filter(({ severity }) => severity === "blocking")
        .map(({ code, message, path, partIds }) => ({ code, message, path, partIds })),
      failure: null,
    },
    fit: {
      azimuthDegrees: null,
      elevationDegrees: null,
      pixelsPerUnit: null,
      residualPx: null,
      coherence: 0,
      failure: null,
    },
    camera: null,
    highlight: { regions: 0, closedContourRate: 0, strokePx: 0, boundsPx: null },
    arrows: { kept: 0, redPx: 0, rejected: 0, displacementFamily: 0, displacementFamilyLdu: [] },
    pieces: [pieceReport(LEFT), pieceReport(RIGHT)],
    jointVisual: null,
    deferral: null,
    farther: null,
    fartherCaptures: [],
    explodedGhost: null,
    documentParts: 2,
    elapsedMs: 1,
    panelPng: null,
    buildPng: null,
  };
  return {
    schemaVersion: "lego.real-build-browser-output/2",
    status: "executed",
    reports: [report],
    documentJson: JSON.stringify(document),
    identityBindings,
    fetchedPdfDigest: DIGEST,
    totalElapsedMs: 1,
  };
}

function reversedIdentityDocument() {
  const base = createEmptyBrickDocument({ id: "identity", name: "identity", maxParts: 10 });
  const partAtRight = createPartInstance({
    id: "part-at-right",
    stepId: base.steps[0]!.id,
    catalogPartId: "builtin:brick-1x1",
    colorId: "builtin:black",
    transform: RIGHT,
  });
  const partAtLeft = createPartInstance({
    id: "part-at-left",
    stepId: base.steps[0]!.id,
    catalogPartId: "builtin:brick-1x1",
    colorId: "builtin:black",
    transform: LEFT,
  });
  return {
    ...base,
    parts: [partAtRight, partAtLeft],
    steps: [{ ...base.steps[0]!, partIds: [partAtRight.id, partAtLeft.id] }],
    submodels: [{ ...base.submodels[0]!, partIds: [partAtRight.id, partAtLeft.id] }],
  };
}

const reversedBindings: readonly RealBuildIdentityBinding[] = [
  {
    identityKey: "brick-left",
    partId: "part-at-right",
    stepNumber: 1,
    designId: "3005",
    materialId: "1",
    catalogPartId: "builtin:brick-1x1",
    colorId: "builtin:black",
  },
  {
    identityKey: "brick-right",
    partId: "part-at-left",
    stepNumber: 1,
    designId: "3005",
    materialId: "1",
    catalogPartId: "builtin:brick-1x1",
    colorId: "builtin:black",
  },
];

describe("real build finalizer identical-piece identity groups", () => {
  it("accepts reversed identical-piece identity assignment only as the exact transform multiset", () => {
    const options = identityOptions();
    const reversed = reversedIdentityDocument();
    const accepted = finalizeExecutedRealBuildResult({
      options,
      browserOutput: browserOutput(reversed, reversedBindings),
    });
    expect(accepted.finalParts).toBe(2);
    expect(accepted.completionFailures.map(({ message }) => message).join("\n")).not.toContain(
      "transform multiset",
    );

    const wrongTransform = {
      ...reversed,
      parts: reversed.parts.map((part, index) =>
        index === 1
          ? {
              ...part,
              transform: {
                positionLdu: [80, 0, 0] as const,
                orientationId: "upright-yaw-0",
              },
            }
          : part,
      ),
    };
    const rejectedTransform = finalizeExecutedRealBuildResult({
      options,
      browserOutput: browserOutput(wrongTransform, reversedBindings),
    });
    expect(rejectedTransform.status).toBe("incomplete");
    expect(rejectedTransform.completionFailures.map(({ message }) => message).join("\n")).toContain(
      "transform multiset",
    );

    const rejectedMetadata = finalizeExecutedRealBuildResult({
      options,
      browserOutput: browserOutput(reversed, [
        { ...reversedBindings[0]!, designId: "3004" },
        reversedBindings[1]!,
      ]),
    });
    expect(rejectedMetadata.status).toBe("incomplete");
    expect(rejectedMetadata.completionFailures.map(({ message }) => message).join("\n")).toContain(
      "transform multiset",
    );
  });
});
