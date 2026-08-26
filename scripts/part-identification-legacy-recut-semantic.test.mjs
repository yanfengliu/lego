import { existsSync, readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { CURRENT_LEGACY_RECUT_PINS } from "./part-identification-legacy-recut.mjs";
import {
  CURRENT_LEGACY_RECUT_SEMANTIC_PINS,
  __testOnly,
  bytesFromVerifiedPartIdentificationLegacyRecutSemantic,
  compilePartIdentificationLegacyRecutSemantic,
  encodePartIdentificationLegacyRecutSemantic,
  inspectVerifiedPartIdentificationLegacyRecutSemantic,
  isVerifiedPartIdentificationLegacyRecutSemantic,
  verifyPartIdentificationLegacyRecutSemantic,
} from "./part-identification-legacy-recut-semantic.mjs";

const EXACT_AUTHORITY = {
  kind: "local-diagnostic",
  authenticated: false,
  answerArtifactsConsumed: false,
  sourceExecution: false,
  preparedRun: false,
  physicalFrame: false,
  semanticIdentity: true,
  coverageTrust: false,
  coveragePublication: false,
  catalogAdmission: false,
  assignmentAuthority: false,
  documentMutation: false,
  placement: false,
  acceptedDocument: false,
  completion: false,
};

const SEMANTIC_ROW_KEYS = [
  "comparisonMethod",
  "currentCropSha256",
  "elementId",
  "identity",
  "legacyCropSha256",
  "n",
  "officialDesignId",
  "officialStepElementQuantity",
  "pageNumber",
  "quantity",
  "relationGroupClaimedQuantity",
  "stepNumber",
];
const QUARANTINE_ROW_KEYS = [
  "comparisonMethod",
  "currentCropSha256",
  "elementId",
  "identity",
  "legacyCropSha256",
  "legacyRefusalReason",
  "maximumChannelDelta",
  "n",
  "officialStepElementQuantity",
  "pageNumber",
  "quantity",
  "quarantineReason",
  "relationGroupClaimedQuantity",
  "retainedDifferingPixels",
  "stepNumber",
];

const availabilityKey = (stepNumber, elementId) => `${stepNumber}\0${elementId}`;

function sameRow({
  n,
  stepNumber,
  quantity = 1,
  elementId,
  disposition = "accepted",
  method = "exact-png-bytes",
}) {
  return {
    n,
    judgedCropSha256: `sha256:${"a".repeat(64)}`,
    elementId,
    verdict: "same",
    comparisonDisposition: disposition,
    identity: `p${stepNumber + 4}|q${quantity}|x${n}.000|y${n}.000`,
    pageNumber: stepNumber + 4,
    stepNumber,
    quantity,
    legacyCrop: { sha256: `sha256:${"b".repeat(64)}` },
    currentCrop: { sha256: `sha256:${"c".repeat(64)}` },
    comparison:
      disposition === "accepted"
        ? { method }
        : {
            method: "refused",
            reason: "retained-rgba-changed",
            retainedDifferingPixels: 7,
            maximumChannelDelta: 9,
          },
  };
}

describe("legacy-recut exact semantic classification", () => {
  it("publishes only capacity-compatible accepted-same relations and retains refusal evidence", () => {
    const rows = [
      sameRow({ n: 1, stepNumber: 2, quantity: 2, elementId: "1001" }),
      sameRow({ n: 2, stepNumber: 3, elementId: "1002" }),
      sameRow({
        n: 3,
        stepNumber: 4,
        elementId: "1003",
        disposition: "refused",
      }),
      { ...sameRow({ n: 4, stepNumber: 5, elementId: "1004" }), verdict: "different" },
    ];
    const classified = __testOnly.classifySemanticRelations(
      { relations: rows },
      new Map([[availabilityKey(2, "1001"), { elementId: "1001", designId: "3001", quantity: 2 }]]),
      50,
    );
    expect(classified.semanticRelations).toEqual([
      expect.objectContaining({
        n: 1,
        quantity: 2,
        elementId: "1001",
        officialDesignId: "3001",
        officialStepElementQuantity: 2,
      }),
    ]);
    expect(classified.quarantinedSameRelations).toEqual([
      expect.objectContaining({
        n: 2,
        quarantineReason: "official-step-element-capacity-insufficient",
        officialStepElementQuantity: 0,
      }),
      expect.objectContaining({
        n: 3,
        quarantineReason: "legacy-recut-comparison-refused",
        legacyRefusalReason: "retained-rgba-changed",
        retainedDifferingPixels: 7,
        maximumChannelDelta: 9,
      }),
    ]);
    expect(classified.semanticRelations[0]).not.toHaveProperty("brickRef");
    expect(classified.semanticRelations[0]).not.toHaveProperty("assignment");
  });

  it("quarantines an under-capacity claim group instead of choosing a partial winner", () => {
    const recut = {
      relations: [
        sameRow({ n: 1, stepNumber: 7, elementId: "2001" }),
        sameRow({ n: 2, stepNumber: 7, elementId: "2001" }),
      ],
    };
    const insufficient = __testOnly.classifySemanticRelations(
      recut,
      new Map([[availabilityKey(7, "2001"), { elementId: "2001", designId: "4001", quantity: 1 }]]),
      50,
    );
    expect(insufficient.semanticRelations).toHaveLength(0);
    expect(insufficient.quarantinedSameRelations).toHaveLength(2);
    expect(insufficient.quarantinedSameRelations.map((row) => row.n)).toEqual([1, 2]);
    expect(insufficient.quarantinedSameRelations[0]).toMatchObject({
      officialStepElementQuantity: 1,
      relationGroupClaimedQuantity: 2,
    });

    const exact = __testOnly.classifySemanticRelations(
      recut,
      new Map([[availabilityKey(7, "2001"), { elementId: "2001", designId: "4001", quantity: 2 }]]),
      50,
    );
    expect(exact.semanticRelations.map((row) => row.n)).toEqual([1, 2]);
    expect(exact.quarantinedSameRelations).toHaveLength(0);
  });

  it("refuses accepted-same claims outside the bounded publication prefix", () => {
    expect(() =>
      __testOnly.classifySemanticRelations(
        { relations: [sameRow({ n: 1, stepNumber: 51, elementId: "3001" })] },
        new Map(),
        50,
      ),
    ).toThrow(/outside the published step-1-50 semantic prefix/);
  });
});

const realEvidencePresent = [
  CURRENT_LEGACY_RECUT_PINS.legacyManifest.path,
  CURRENT_LEGACY_RECUT_PINS.currentManifest.path,
  CURRENT_LEGACY_RECUT_PINS.truth.path,
  CURRENT_LEGACY_RECUT_SEMANTIC_PINS.legacyRecut.path,
  CURRENT_LEGACY_RECUT_SEMANTIC_PINS.officialModel.path,
  "output/callout-thumbnails",
].every(existsSync);

function realInput() {
  return {
    calloutRoot: "output/callout-thumbnails",
    currentManifestBytes: readFileSync(CURRENT_LEGACY_RECUT_PINS.currentManifest.path),
    legacyManifestBytes: readFileSync(CURRENT_LEGACY_RECUT_PINS.legacyManifest.path),
    legacyRecutArtifactBytes: readFileSync(CURRENT_LEGACY_RECUT_SEMANTIC_PINS.legacyRecut.path),
    officialModelBytes: readFileSync(CURRENT_LEGACY_RECUT_SEMANTIC_PINS.officialModel.path),
    truthBytes: readFileSync(CURRENT_LEGACY_RECUT_PINS.truth.path),
  };
}

it.runIf(realEvidencePresent)("reproduces the exact safe first-50 semantic subset", async () => {
  const input = realInput();
  const compiled = await compilePartIdentificationLegacyRecutSemantic(input);
  expect(compiled.accounting).toEqual(CURRENT_LEGACY_RECUT_SEMANTIC_PINS.expectedAccounting);
  expect(compiled.sourceIndex).toEqual(CURRENT_LEGACY_RECUT_PINS.expectedSourceIndex);
  expect(compiled.scope).toEqual({
    firstPrintedStep: 1,
    lastPrintedStep: 50,
    expectedPrintedSteps: 359,
    identityPublication: "listed-compatible-relations-only",
    suffixStepsReconstructed: false,
  });
  expect(compiled.authority).toEqual(EXACT_AUTHORITY);
  expect(compiled.perCompileWork).toEqual(
    CURRENT_LEGACY_RECUT_SEMANTIC_PINS.expectedPerCompileWork,
  );
  expect(compiled.officialCut).toEqual({
    firstPrintedStep: 1,
    lastPrintedStep: 50,
    prefixPieces: 320,
    assignmentPublished: false,
    commitment: CURRENT_LEGACY_RECUT_SEMANTIC_PINS.expectedOfficialCutCommitment,
  });
  expect(compiled.semanticCommitment).toEqual(
    CURRENT_LEGACY_RECUT_SEMANTIC_PINS.expectedSemanticCommitment,
  );
  expect(compiled.quarantineCommitment).toEqual(
    CURRENT_LEGACY_RECUT_SEMANTIC_PINS.expectedQuarantineCommitment,
  );
  expect(
    compiled.quarantinedSameRelations.map((row) => ({
      n: row.n,
      stepNumber: row.stepNumber,
      quantity: row.quantity,
      elementId: row.elementId,
      reason: row.quarantineReason,
      officialQuantity: row.officialStepElementQuantity,
    })),
  ).toEqual([
    {
      n: 16,
      stepNumber: 11,
      quantity: 1,
      elementId: "4210678",
      reason: "official-step-element-capacity-insufficient",
      officialQuantity: 0,
    },
    {
      n: 38,
      stepNumber: 24,
      quantity: 2,
      elementId: "4211399",
      reason: "legacy-recut-comparison-refused",
      officialQuantity: null,
    },
    {
      n: 54,
      stepNumber: 32,
      quantity: 2,
      elementId: "4211104",
      reason: "official-step-element-capacity-insufficient",
      officialQuantity: 0,
    },
    {
      n: 82,
      stepNumber: 49,
      quantity: 3,
      elementId: "4210690",
      reason: "official-step-element-capacity-insufficient",
      officialQuantity: 0,
    },
  ]);
  expect(
    compiled.semanticIdentityRelations.every(
      (row) => Object.keys(row).sort().join(",") === SEMANTIC_ROW_KEYS.join(","),
    ),
  ).toBe(true);
  expect(
    compiled.quarantinedSameRelations.every(
      (row) => Object.keys(row).sort().join(",") === QUARANTINE_ROW_KEYS.join(","),
    ),
  ).toBe(true);
  for (const row of [...compiled.semanticIdentityRelations, ...compiled.quarantinedSameRelations]) {
    expect(row).not.toHaveProperty("brickRef");
    expect(row).not.toHaveProperty("sourceBrickRef");
    expect(row).not.toHaveProperty("assignment");
    expect(row).not.toHaveProperty("builderTransform");
    expect(row).not.toHaveProperty("canonicalTransform");
    expect(row).not.toHaveProperty("transform");
    expect(row).not.toHaveProperty("positionLdu");
    expect(row).not.toHaveProperty("orientationId");
    expect(row).not.toHaveProperty("catalogPartId");
  }

  const artifactBytes = encodePartIdentificationLegacyRecutSemantic(compiled);
  const verified = await verifyPartIdentificationLegacyRecutSemantic({
    ...input,
    artifactBytes,
  });
  expect(isVerifiedPartIdentificationLegacyRecutSemantic(verified)).toBe(true);
  expect(isVerifiedPartIdentificationLegacyRecutSemantic(Object.freeze({ verified: true }))).toBe(
    false,
  );
  const firstCopy = bytesFromVerifiedPartIdentificationLegacyRecutSemantic(verified);
  const firstByte = firstCopy[0];
  firstCopy[0] ^= 0xff;
  expect(bytesFromVerifiedPartIdentificationLegacyRecutSemantic(verified)[0]).toBe(firstByte);
  const inspection = inspectVerifiedPartIdentificationLegacyRecutSemantic(verified);
  expect(inspection.digest).toBe(CURRENT_LEGACY_RECUT_SEMANTIC_PINS.expectedArtifact.digest);
  expect(bytesFromVerifiedPartIdentificationLegacyRecutSemantic(verified)).toHaveLength(
    CURRENT_LEGACY_RECUT_SEMANTIC_PINS.expectedArtifact.bytes,
  );
  expect(Object.isFrozen(inspection.artifact.semanticIdentityRelations)).toBe(true);
  expect(Object.isFrozen(inspection.artifact.semanticIdentityRelations[0])).toBe(true);
});

it.runIf(realEvidencePresent)(
  "owns every compiler and verifier byte role before the first async boundary",
  async () => {
    const compileInput = realInput();
    const compilePromise = compilePartIdentificationLegacyRecutSemantic(compileInput);
    for (const key of [
      "currentManifestBytes",
      "legacyManifestBytes",
      "legacyRecutArtifactBytes",
      "officialModelBytes",
      "truthBytes",
    ]) {
      compileInput[key].fill(0);
    }
    const compiled = await compilePromise;
    expect(compiled.accounting).toEqual(CURRENT_LEGACY_RECUT_SEMANTIC_PINS.expectedAccounting);

    const verifyInput = {
      ...realInput(),
      artifactBytes: encodePartIdentificationLegacyRecutSemantic(compiled),
    };
    const verifyPromise = verifyPartIdentificationLegacyRecutSemantic(verifyInput);
    for (const key of [
      "artifactBytes",
      "currentManifestBytes",
      "legacyManifestBytes",
      "legacyRecutArtifactBytes",
      "officialModelBytes",
      "truthBytes",
    ]) {
      verifyInput[key].fill(0);
    }
    const verified = await verifyPromise;
    expect(isVerifiedPartIdentificationLegacyRecutSemantic(verified)).toBe(true);
  },
);

it.runIf(realEvidencePresent)(
  "rejects edited authority, changed official bytes, changed recut bytes, and extra roles",
  async () => {
    const input = realInput();
    const compiled = await compilePartIdentificationLegacyRecutSemantic(input);
    const edited = structuredClone(compiled);
    edited.authority.assignmentAuthority = true;
    await expect(
      verifyPartIdentificationLegacyRecutSemantic({
        ...input,
        artifactBytes: encodePartIdentificationLegacyRecutSemantic(edited),
      }),
    ).rejects.toThrow(/does not exactly reproduce/);

    await expect(
      compilePartIdentificationLegacyRecutSemantic({
        ...input,
        officialModelBytes: Buffer.concat([input.officialModelBytes, Buffer.from(" ")]),
      }),
    ).rejects.toThrow(/exact pinned/);

    await expect(
      compilePartIdentificationLegacyRecutSemantic({
        ...input,
        legacyRecutArtifactBytes: Buffer.concat([input.legacyRecutArtifactBytes, Buffer.from(" ")]),
      }),
    ).rejects.toThrow(/has 102514 bytes|does not exactly reproduce/);

    await expect(
      compilePartIdentificationLegacyRecutSemantic({
        ...input,
        answersBytes: Buffer.from("detached answer role"),
      }),
    ).rejects.toThrow(/must contain exactly/);
  },
  20_000,
);
