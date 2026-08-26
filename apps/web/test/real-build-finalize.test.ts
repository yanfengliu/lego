import { describe, expect, it } from "vitest";

import {
  createEmptyBrickDocument,
  createPartInstance,
  validateBrickDocument,
} from "@lego-studio/brick-kernel";

import { finalizeExecutedRealBuildResult } from "../e2e/real-build-finalize";
import { auditRealBuildIdentityBindings } from "../e2e/real-build-finalize-identity";
import { unexecutedStepReport } from "../e2e/real-build-contract";
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
const RIGHT = { positionLdu: [0, -24, 0] as const, orientationId: "upright-yaw-0" };

function identityOptions(): RealBuildOptions {
  const trusted = completeRealBuildTestOptions(1);
  const complete = completeRealBuildTestOptions(359);
  const sourcePanel = complete.panels[357]!;
  if (sourcePanel.action.kind !== "place-callouts") {
    throw new TypeError("The complete fixture must retain its direct-piece panel at step 358.");
  }
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
  return {
    ...trusted,
    panels: [panel],
    coverageByCallout: {
      ...trusted.coverageByCallout,
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

function interruptedPrefixOptions(): RealBuildOptions {
  const trusted = identityOptions();
  const throughTwo = completeRealBuildTestOptions(2);
  const complete = completeRealBuildTestOptions(359);
  const sourcePanel = complete.panels[357]!;
  if (sourcePanel.action.kind !== "place-callouts") {
    throw new TypeError("The complete fixture must retain its direct-piece panel at step 358.");
  }
  const moved = sourcePanel.pieces.at(-1)!;
  const secondPanel: RealBuildPanelSpec = {
    ...realBuildTransitionPanel(2),
    action: { kind: "place-callouts", assembledPieces: 1, evidenceDigest: DIGEST },
    pieces: [moved],
    calloutPieces: 1,
    classifiedPhysicalCalloutPieces: 1,
    mappedCalloutKeys: [moved.calloutKey],
  };
  return {
    ...trusted,
    lastStep: 2,
    panels: [trusted.panels[0]!, secondPanel],
    passivePanels: throughTwo.passivePanels,
    coverageByCallout: {
      ...trusted.coverageByCallout,
      [moved.calloutKey]: {
        ...complete.coverageByCallout[moved.calloutKey]!,
        pageNumber: 2,
        stepNumber: 2,
        quantity: 1,
        identificationConfidence: moved.identificationConfidence,
        cropDigest: moved.cropDigest,
        inputDigest: moved.identificationInputDigest,
      },
    },
  };
}

function frameUnreconciledOptions(): RealBuildOptions {
  const trusted = identityOptions();
  return {
    ...trusted,
    panels: trusted.panels.map((panel) =>
      panel.stepNumber !== 1
        ? panel
        : {
            ...panel,
            pieces: panel.pieces.map((piece, index) =>
              index === 0
                ? {
                    ...piece,
                    expectedTransform: {
                      positionLdu: [20, 0, 0] as const,
                      orientationId: "upright-yaw-90" as const,
                    },
                  }
                : piece,
            ),
          },
    ),
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
    panelCamera: null,
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
    schemaVersion: "lego.real-build-browser-output/3",
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
    connections: [
      {
        id: "connection-left-right",
        kind: "stud-tube" as const,
        a: { partId: partAtLeft.id, portId: "stud:0:0" },
        b: { partId: partAtRight.id, portId: "undersideClutch:0:0" },
        provenance: { source: "manual" as const },
      },
    ],
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
  it("diagnoses an unreconciled target only after identity audit and rejects rootless scalar completion", () => {
    const document = reversedIdentityDocument();
    const output = browserOutput(document, reversedBindings);
    const identityFailures = auditRealBuildIdentityBindings({
      options: frameUnreconciledOptions(),
      document,
      reports: output.reports,
      bindings: reversedBindings,
    });
    expect(identityFailures).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "official-frame-calibration-missing", stepNumber: 1 }),
      ]),
    );
    const result = finalizeExecutedRealBuildResult({
      options: frameUnreconciledOptions(),
      browserOutput: output,
    });

    expect(result).toMatchObject({
      status: "incomplete",
      documentJson: null,
      structuralHash: null,
      finalParts: 0,
      diagnosticPrefix: null,
    });
    expect(result.completionFailures.length).toBeGreaterThan(0);

    const colludingMetadataFailure = finalizeExecutedRealBuildResult({
      options: frameUnreconciledOptions(),
      browserOutput: browserOutput(document, [
        { ...reversedBindings[0]!, designId: "3004" },
        reversedBindings[1]!,
      ]),
    });
    expect(colludingMetadataFailure.diagnosticPrefix).toBeNull();
    expect(colludingMetadataFailure).toMatchObject({
      documentJson: null,
      structuralHash: null,
      finalParts: 0,
    });
  });

  it("accepts reversed identical-piece identity assignment only as the exact transform multiset", () => {
    const options = identityOptions();
    const reversed = reversedIdentityDocument();
    const acceptedOutput = browserOutput(reversed, reversedBindings);
    const accepted = auditRealBuildIdentityBindings({
      options,
      document: reversed,
      reports: acceptedOutput.reports,
      bindings: reversedBindings,
    });
    expect(accepted.map(({ message }) => message).join("\n")).not.toContain("transform multiset");

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
    const wrongTransformOutput = browserOutput(wrongTransform, reversedBindings);
    const rejectedTransform = auditRealBuildIdentityBindings({
      options,
      document: wrongTransform,
      reports: wrongTransformOutput.reports,
      bindings: reversedBindings,
    });
    expect(rejectedTransform.map(({ message }) => message).join("\n")).toContain(
      "transform multiset",
    );

    const rejectedMetadata = auditRealBuildIdentityBindings({
      options,
      document: reversed,
      reports: acceptedOutput.reports,
      bindings: [{ ...reversedBindings[0]!, designId: "3004" }, reversedBindings[1]!],
    });
    expect(rejectedMetadata.map(({ message }) => message).join("\n")).toContain(
      "transform multiset",
    );
  });

  it("independently audits and retains the longest complete canonical prefix after a later refusal", () => {
    const options = interruptedPrefixOptions();
    const document = reversedIdentityDocument();
    const output = browserOutput(document, reversedBindings);
    const secondPanel = options.panels.find(({ stepNumber }) => stepNumber === 2)!;
    const interruptedOutput: RealBuildBrowserOutput = {
      ...output,
      reports: [
        output.reports[0]!,
        unexecutedStepReport(secondPanel, {
          code: "run-incomplete",
          stage: "validation",
          stepNumber: 2,
          message: "Synthetic later-step refusal.",
        }),
      ],
    };
    const interrupted = finalizeExecutedRealBuildResult({
      options,
      browserOutput: interruptedOutput,
    });

    expect(interrupted.status).toBe("incomplete");
    expect(interrupted.finalParts).toBe(0);
    expect(interrupted.structuralHash).toBeNull();
    expect(interrupted.documentJson).toBeNull();
    expect(interrupted.completionFailures.map(({ message }) => message).join("\n")).toContain(
      "identity binding(s) were retained against 3",
    );
    expect(interrupted.completionFailures.map(({ message }) => message).join("\n")).toContain(
      "must retain the eight-way step-0 root",
    );

    const wrongBinding = finalizeExecutedRealBuildResult({
      options,
      browserOutput: {
        ...interruptedOutput,
        identityBindings: [{ ...reversedBindings[0]!, designId: "3004" }, reversedBindings[1]!],
      },
    });
    expect(wrongBinding).toMatchObject({
      status: "incomplete",
      documentJson: null,
      structuralHash: null,
      finalParts: 0,
    });
    expect(wrongBinding.completionFailures.map(({ message }) => message).join("\n")).toContain(
      "identity binding(s) were retained against 3",
    );

    const wrongMetadataDocument = {
      ...document,
      steps: document.steps.map((step) => ({ ...step, name: "Forged prefix step" })),
    };
    const wrongMetadataOutput = browserOutput(wrongMetadataDocument, reversedBindings);
    const wrongMetadata = finalizeExecutedRealBuildResult({
      options,
      browserOutput: {
        ...wrongMetadataOutput,
        reports: [wrongMetadataOutput.reports[0]!, interruptedOutput.reports[1]!],
      },
    });
    expect(wrongMetadata).toMatchObject({
      status: "incomplete",
      documentJson: null,
      structuralHash: null,
      finalParts: 0,
    });
    expect(wrongMetadata.completionFailures.map(({ message }) => message).join("\n")).toContain(
      "identity binding(s) were retained against 3",
    );
  });
});
