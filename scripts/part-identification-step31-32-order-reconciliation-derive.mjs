import { isDeepStrictEqual } from "node:util";

import {
  CURRENT_STEP31_32_ORDER_RECONCILIATION_PINS,
  REVIEWED_STEP31_32_SEMANTIC_MAP,
  STEP31_32_ORDER_RECONCILIATION_SCHEMA,
  STEP31_32_PHASE_BLUEPRINTS,
  assertReviewedSemanticMap,
  commitmentFor,
} from "./part-identification-step31-32-order-reconciliation-source.mjs";

export const STEP31_32_ORDER_RECONCILIATION_AUTHORITY = Object.freeze({
  kind: "local-diagnostic",
  authenticated: false,
  sourceExecution: false,
  preparedRun: false,
  semanticIdentity: true,
  officialOrderReconciliation: true,
  physicalIdentityInventory: true,
  coverageTrust: false,
  coveragePublication: false,
  catalogAdmission: false,
  physicalFrame: false,
  assignmentAuthority: false,
  documentMutation: false,
  placement: false,
  acceptedDocument: false,
  replay: false,
  completion: false,
});
export const STEP31_32_ORDER_RECONCILIATION_DISCLOSURE = Object.freeze({
  directBrickUuidToCalloutRowsSerialized: false,
  reviewedPhysicalJoinReconstructibleFromPinnedInputs: true,
  confidential: false,
});

const REVIEWED_KEYS = [
  "elementId",
  "evidenceMethod",
  "identity",
  "inventoryCropSha256",
  "officialDesignId",
  "pageNumber",
  "quantity",
  "sourceCropSha256",
  "stepNumber",
];
const FORBIDDEN_PUBLICATION_KEYS = new Set([
  "brickUuidToCallout",
  "calloutAssignment",
  "calloutKey",
  "catalogPartId",
  "frameEvidenceDigest",
  "orientationId",
  "partId",
  "positionLdu",
  "sourceBrickRef",
  "transform",
]);
const RECONCILED_PHASES_BY_STEP = Object.freeze({
  31: Object.freeze([50, 51, 52]),
  32: Object.freeze([49, 53, 54]),
});

function multiset(rows) {
  const byElement = new Map();
  for (const row of rows) {
    const prior = byElement.get(row.elementId);
    if (prior !== undefined && prior.designId !== row.designId) {
      throw new Error(
        `Element ${row.elementId} changes design inside the bounded step-31/32 order window.`,
      );
    }
    byElement.set(row.elementId, {
      elementId: row.elementId,
      designId: row.designId,
      quantity: (prior?.quantity ?? 0) + 1,
    });
  }
  return [...byElement.values()].sort((left, right) =>
    left.elementId < right.elementId ? -1 : left.elementId > right.elementId ? 1 : 0,
  );
}

function stepQuantity(manifestEvidence, stepNumber) {
  return manifestEvidence.callouts
    .filter((row) => row.evidenceKind === "part-art" && row.stepNumber === stepNumber)
    .reduce((total, row) => total + row.quantity, 0);
}

function officialIdentityRows(official) {
  const rows = [];
  for (const phase of official.builderOrder.phases) {
    const refs =
      phase.kind === "direct" ? phase.brickRefs : phase.copies.map((copy) => copy.actualBrickRef);
    for (const [phaseMemberIndex, brickRef] of refs.entries()) {
      const brick = official.bricks[brickRef];
      if (brick === undefined || brick.itemNos.length !== 1) {
        throw new Error(
          `Official phase ${phase.sequence} member ${brickRef} requires one exact physical Brick element identity.`,
        );
      }
      rows.push({
        sourceKind: phase.kind,
        sourcePhaseSequence: phase.sequence,
        sourcePhaseId: phase.phaseId,
        sourcePhaseDigest: phase.sourceDigest,
        sourcePhaseMemberOrdinal: phaseMemberIndex + 1,
        sourceBuilderIdentityOrdinal: rows.length + 1,
        brickRef,
        elementId: brick.itemNos[0],
        designId: brick.designId,
        designRevision: brick.designRevision,
        materialId: brick.materialId,
      });
    }
  }
  return rows;
}

export function assertExpectedStep31_32PhaseWindow(official, identityRows) {
  const phaseWindow = official.builderOrder.phases.filter(
    (phase) => phase.sequence >= 49 && phase.sequence <= 54,
  );
  if (
    phaseWindow.length !== 6 ||
    phaseWindow.some((phase, index) => phase.sequence !== 49 + index)
  ) {
    throw new Error(
      "Official Builder phases 49..54 must remain one ordered, complete six-phase source window.",
    );
  }
  const observed = phaseWindow.map((phase) => {
    const rows = identityRows.filter((row) => row.sourcePhaseSequence === phase.sequence);
    return {
      sequence: phase.sequence,
      phaseId: phase.phaseId,
      sourceDigest: phase.sourceDigest,
      firstBuilderIdentityOrdinal: rows[0]?.sourceBuilderIdentityOrdinal,
      memberCommitment: commitmentFor(
        rows.map((row) => ({
          sourceBuilderIdentityOrdinal: row.sourceBuilderIdentityOrdinal,
          brickRef: row.brickRef,
          elementId: row.elementId,
          designId: row.designId,
        })),
      ),
    };
  });
  if (!isDeepStrictEqual(observed, STEP31_32_PHASE_BLUEPRINTS)) {
    throw new Error(
      "Official Builder phase 49..54 order or physical membership drifted from the exact reviewed repartition blueprint.",
    );
  }
}

function assertExpectedMultisets(naive, reconciled, combined) {
  const expectedNaive = {
    31: [
      { elementId: "4211065", designId: "3020", quantity: 1 },
      { elementId: "4211104", designId: "3622", quantity: 2 },
      { elementId: "4618852", designId: "3245", quantity: 1 },
    ],
    32: [
      { elementId: "300526", designId: "3005", quantity: 2 },
      { elementId: "365926", designId: "3659", quantity: 1 },
      { elementId: "4211398", designId: "3023", quantity: 1 },
      { elementId: "4618852", designId: "3245", quantity: 5 },
      { elementId: "6184876", designId: "15254", quantity: 1 },
    ],
  };
  const expectedReconciled = {
    31: [
      { elementId: "4211065", designId: "3020", quantity: 1 },
      { elementId: "4211398", designId: "3023", quantity: 1 },
      { elementId: "4618852", designId: "3245", quantity: 2 },
    ],
    32: [
      { elementId: "300526", designId: "3005", quantity: 2 },
      { elementId: "365926", designId: "3659", quantity: 1 },
      { elementId: "4211104", designId: "3622", quantity: 2 },
      { elementId: "4618852", designId: "3245", quantity: 4 },
      { elementId: "6184876", designId: "15254", quantity: 1 },
    ],
  };
  const expectedCombined = [
    { elementId: "300526", designId: "3005", quantity: 2 },
    { elementId: "365926", designId: "3659", quantity: 1 },
    { elementId: "4211065", designId: "3020", quantity: 1 },
    { elementId: "4211104", designId: "3622", quantity: 2 },
    { elementId: "4211398", designId: "3023", quantity: 1 },
    { elementId: "4618852", designId: "3245", quantity: 6 },
    { elementId: "6184876", designId: "15254", quantity: 1 },
  ];
  if (
    !isDeepStrictEqual(naive, expectedNaive) ||
    !isDeepStrictEqual(reconciled, expectedReconciled) ||
    !isDeepStrictEqual(combined, expectedCombined)
  ) {
    throw new Error(
      "Step-31/32 naive cuts, exact phase repartition, or combined 14-piece multiset drifted from the reviewed result.",
    );
  }
}

function exactKeys(rows, keys, label) {
  for (const [index, row] of rows.entries()) {
    if (Object.keys(row).sort().join(",") !== keys.join(",")) {
      throw new Error(`${label} ${index} must contain exactly ${keys.join(", ")}.`);
    }
  }
}

function assertNoForbiddenPublication(value, path = "artifact") {
  if (typeof value !== "object" || value === null) return;
  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN_PUBLICATION_KEYS.has(key)) {
      throw new Error(
        `Step-31/32 reconciliation forbids ${path}.${key}; no callout assignment, frame, transform, catalog, placement, or document authority may be published.`,
      );
    }
    assertNoForbiddenPublication(child, `${path}.${key}`);
  }
}

export function assertExactStep31_32ReconciliationShape(artifact) {
  if (!isDeepStrictEqual(artifact.authority, STEP31_32_ORDER_RECONCILIATION_AUTHORITY)) {
    throw new Error("Step-31/32 reconciliation must retain its exact closed authority object.");
  }
  if (!isDeepStrictEqual(artifact.disclosure, STEP31_32_ORDER_RECONCILIATION_DISCLOSURE)) {
    throw new Error(
      "Step-31/32 reconciliation must disclose that its reviewed physical join is reconstructible from open pinned inputs.",
    );
  }
  if (
    !isDeepStrictEqual(
      artifact.sourceIndex,
      CURRENT_STEP31_32_ORDER_RECONCILIATION_PINS.expectedSourceIndex,
    )
  ) {
    throw new Error(
      "Step-31/32 reconciliation source index must state that crop bytes were not consumed and only reviewed digests were retained.",
    );
  }
  const topKeys = [
    "accounting",
    "authority",
    "combinedWindow",
    "commitments",
    "disclosure",
    "inputs",
    "naiveIndependentCuts",
    "reconciledSteps",
    "reviewedSemanticMap",
    "schemaVersion",
    "scope",
    "sourceIndex",
  ];
  if (Object.keys(artifact).sort().join(",") !== topKeys.join(",")) {
    throw new Error(
      `Step-31/32 reconciliation artifact must contain exactly ${topKeys.join(", ")}.`,
    );
  }
  exactKeys(artifact.reviewedSemanticMap, REVIEWED_KEYS, "Reviewed semantic row");
  assertNoForbiddenPublication(
    Object.fromEntries(Object.entries(artifact).filter(([key]) => key !== "authority")),
  );
}

export function deriveStep31_32OrderReconciliation(
  manifestEvidence,
  official,
  reviewedMap = REVIEWED_STEP31_32_SEMANTIC_MAP,
) {
  assertReviewedSemanticMap(reviewedMap, manifestEvidence.identities);
  const identityRows = officialIdentityRows(official);
  assertExpectedStep31_32PhaseWindow(official, identityRows);
  const step31Quantity = stepQuantity(manifestEvidence, 31);
  const step32Quantity = stepQuantity(manifestEvidence, 32);
  const precedingQuantity = manifestEvidence.callouts
    .filter((row) => row.evidenceKind === "part-art" && row.stepNumber < 31)
    .reduce((total, row) => total + row.quantity, 0);
  if (precedingQuantity !== 180 || step31Quantity !== 4 || step32Quantity !== 10) {
    throw new Error(
      `Step-31/32 source quantities must retain the exact 180 + 4 + 10 cut; received ${precedingQuantity} + ${step31Quantity} + ${step32Quantity}.`,
    );
  }
  const combinedRows = identityRows.slice(precedingQuantity, precedingQuantity + 14);
  const naiveRows = {
    31: combinedRows.slice(0, step31Quantity),
    32: combinedRows.slice(step31Quantity),
  };
  const reconciledRows = {
    31: combinedRows.filter((row) =>
      RECONCILED_PHASES_BY_STEP[31].includes(row.sourcePhaseSequence),
    ),
    32: combinedRows.filter((row) =>
      RECONCILED_PHASES_BY_STEP[32].includes(row.sourcePhaseSequence),
    ),
  };
  const naiveMultisets = { 31: multiset(naiveRows[31]), 32: multiset(naiveRows[32]) };
  const reconciledMultisets = {
    31: multiset(reconciledRows[31]),
    32: multiset(reconciledRows[32]),
  };
  const combinedMultiset = multiset(combinedRows);
  assertExpectedMultisets(naiveMultisets, reconciledMultisets, combinedMultiset);
  if (
    !isDeepStrictEqual(
      multiset([...reconciledRows[31], ...reconciledRows[32]]),
      combinedMultiset,
    ) ||
    new Set(combinedRows.map((row) => row.brickRef)).size !== 14
  ) {
    throw new Error(
      "Step-31/32 repartition must conserve all 14 exact physical identities and their combined multiset.",
    );
  }
  const contradictions = reviewedMap.map((reviewed) => {
    const naive = naiveMultisets[reviewed.stepNumber].find(
      (row) => row.elementId === reviewed.elementId && row.designId === reviewed.officialDesignId,
    );
    const reconciled = reconciledMultisets[reviewed.stepNumber].find(
      (row) => row.elementId === reviewed.elementId && row.designId === reviewed.officialDesignId,
    );
    const naiveQuantity = naive?.quantity ?? 0;
    if (naiveQuantity >= reviewed.quantity || (reconciled?.quantity ?? 0) < reviewed.quantity) {
      throw new Error(
        `Reviewed semantic row ${reviewed.identity} does not falsify the naive cut and support the exact repartition.`,
      );
    }
    return {
      identity: reviewed.identity,
      stepNumber: reviewed.stepNumber,
      elementId: reviewed.elementId,
      officialDesignId: reviewed.officialDesignId,
      requiredQuantity: reviewed.quantity,
      naiveAvailableQuantity: naiveQuantity,
      naiveShortfall: reviewed.quantity - naiveQuantity,
    };
  });
  const reviewedRows = reviewedMap.map((row) => ({ ...row }));
  const reconciledSteps = [31, 32].map((stepNumber) => ({
    stepNumber,
    pieces: reconciledRows[stepNumber].length,
    multiset: reconciledMultisets[stepNumber],
  }));
  const commitments = {
    reviewedSemanticMap: commitmentFor(reviewedRows),
    reconciledSteps: commitmentFor(reconciledSteps),
  };
  const artifact = {
    schemaVersion: STEP31_32_ORDER_RECONCILIATION_SCHEMA,
    authority: STEP31_32_ORDER_RECONCILIATION_AUTHORITY,
    disclosure: STEP31_32_ORDER_RECONCILIATION_DISCLOSURE,
    scope: {
      firstPrintedStep: 31,
      lastPrintedStep: 32,
      expectedPrintedSteps: 359,
      prefixLimit: 50,
      suffixStepsReconstructed: false,
      productionLedgerIntegrated: false,
    },
    inputs: {
      currentManifest: { ...CURRENT_STEP31_32_ORDER_RECONCILIATION_PINS.currentManifest },
      officialModel: { ...CURRENT_STEP31_32_ORDER_RECONCILIATION_PINS.officialModel },
      officialPhaseDigest: CURRENT_STEP31_32_ORDER_RECONCILIATION_PINS.officialPhaseDigest,
      reviewEvidence: structuredClone(CURRENT_STEP31_32_ORDER_RECONCILIATION_PINS.reviewEvidence),
    },
    sourceIndex: { ...manifestEvidence.sourceIndex },
    accounting: {
      sourceCalloutRows: manifestEvidence.sourceIndex.calloutRows,
      sourcePartArtRows: manifestEvidence.sourceIndex.partArtRows,
      officialInventoryBricks: Object.keys(official.bricks).length,
      officialSequencedIdentities: identityRows.length,
      reviewedSemanticRows: reviewedRows.length,
      reviewedSemanticPieces: reviewedRows.reduce((total, row) => total + row.quantity, 0),
      naiveWindowPieces: combinedRows.length,
      reconciledWindowPieces: combinedRows.length,
      conservedPhysicalIdentities: new Set(combinedRows.map((row) => row.brickRef)).size,
    },
    reviewedSemanticMap: reviewedRows,
    naiveIndependentCuts: {
      falsified: true,
      contradictions,
    },
    combinedWindow: {
      pieces: combinedRows.length,
      exactMultisetConserved: true,
      multiset: combinedMultiset,
    },
    reconciledSteps,
    commitments,
  };
  assertExactStep31_32ReconciliationShape(artifact);
  return artifact;
}
