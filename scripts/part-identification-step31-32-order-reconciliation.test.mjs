import { existsSync, readFileSync } from "node:fs";

import { beforeAll, describe, expect, it } from "vitest";

import {
  CURRENT_STEP31_32_ORDER_RECONCILIATION_PINS,
  REVIEWED_STEP31_32_SEMANTIC_MAP,
  __testOnly,
  bytesFromVerifiedStep31_32OrderReconciliation,
  compileStep31_32OrderReconciliation,
  encodeStep31_32OrderReconciliation,
  inspectVerifiedStep31_32OrderReconciliation,
  isVerifiedStep31_32OrderReconciliation,
  verifyStep31_32OrderReconciliation,
} from "./part-identification-step31-32-order-reconciliation.mjs";

const realEvidencePresent = [
  CURRENT_STEP31_32_ORDER_RECONCILIATION_PINS.currentManifest.path,
  CURRENT_STEP31_32_ORDER_RECONCILIATION_PINS.officialModel.path,
].every(existsSync);

const realInput = () => ({
  currentManifestBytes: readFileSync(
    CURRENT_STEP31_32_ORDER_RECONCILIATION_PINS.currentManifest.path,
  ),
  officialModelBytes: readFileSync(CURRENT_STEP31_32_ORDER_RECONCILIATION_PINS.officialModel.path),
});

function mutableOfficial(official) {
  return {
    ...official,
    builderOrder: {
      ...official.builderOrder,
      phases: official.builderOrder.phases.map((phase) =>
        phase.kind === "direct"
          ? { ...phase, subBuildPath: [...phase.subBuildPath], brickRefs: [...phase.brickRefs] }
          : {
              ...phase,
              subBuildPath: [...phase.subBuildPath],
              copies: phase.copies.map((copy) => ({ ...copy })),
            },
      ),
    },
  };
}

describe.runIf(realEvidencePresent)("bounded step-31/32 official-order reconciliation", () => {
  let input;
  let manifestEvidence;
  let official;
  let artifact;

  beforeAll(async () => {
    input = realInput();
    manifestEvidence = __testOnly.authenticateStep31_32Manifest(input.currentManifestBytes);
    official = await __testOnly.authenticateStep31_32OfficialModel(input.officialModelBytes);
    artifact = await compileStep31_32OrderReconciliation(input);
  });

  it("falsifies independent cuts and conserves the exact 14-piece two-step multiset", () => {
    expect(artifact.sourceIndex).toEqual(
      CURRENT_STEP31_32_ORDER_RECONCILIATION_PINS.expectedSourceIndex,
    );
    expect(artifact.sourceIndex.cropByteEvidence).toBe("not-consumed-reviewed-digests-only");
    expect(artifact.sourceIndex).not.toHaveProperty("cropBytesAuthenticated");
    expect(artifact.naiveIndependentCuts).toMatchObject({
      falsified: true,
      contradictions: [
        {
          identity: "p35|q1|x49.835|y481.711",
          elementId: "4211398",
          requiredQuantity: 1,
          naiveAvailableQuantity: 0,
        },
        {
          identity: "p35|q2|x147.987|y481.711",
          elementId: "4618852",
          requiredQuantity: 2,
          naiveAvailableQuantity: 1,
        },
        {
          identity: "p36|q2|x115.277|y421.615",
          elementId: "4211104",
          requiredQuantity: 2,
          naiveAvailableQuantity: 0,
        },
      ],
    });
    expect(artifact.combinedWindow).toEqual({
      pieces: 14,
      exactMultisetConserved: true,
      multiset: [
        { elementId: "300526", designId: "3005", quantity: 2 },
        { elementId: "365926", designId: "3659", quantity: 1 },
        { elementId: "4211065", designId: "3020", quantity: 1 },
        { elementId: "4211104", designId: "3622", quantity: 2 },
        { elementId: "4211398", designId: "3023", quantity: 1 },
        { elementId: "4618852", designId: "3245", quantity: 6 },
        { elementId: "6184876", designId: "15254", quantity: 1 },
      ],
    });
    expect(artifact.accounting).toEqual({
      sourceCalloutRows: 881,
      sourcePartArtRows: 859,
      officialInventoryBricks: 1465,
      officialSequencedIdentities: 1464,
      reviewedSemanticRows: 3,
      reviewedSemanticPieces: 5,
      naiveWindowPieces: 14,
      reconciledWindowPieces: 14,
      conservedPhysicalIdentities: 14,
    });
  });

  it("omits direct physical rows while disclosing that the reviewed join is reconstructible", () => {
    expect(artifact.reconciledSteps.map((step) => step.stepNumber)).toEqual([31, 32]);
    expect(artifact.reconciledSteps.map((step) => step.pieces)).toEqual([4, 10]);
    expect(artifact.disclosure).toEqual({
      directBrickUuidToCalloutRowsSerialized: false,
      reviewedPhysicalJoinReconstructibleFromPinnedInputs: true,
      confidential: false,
    });
    expect(artifact).not.toHaveProperty("physicalIdentitySourcePositionCommitment");
    expect(artifact.commitments).not.toHaveProperty("physicalIdentitySourcePositions");
    const published = JSON.stringify(artifact);
    expect(published).not.toContain("brickRef");
    expect(published).not.toContain("c5044336-bbf2-4d18-9ce3-41d050c927de");
    expect(published).not.toContain("57d25780-5977-495b-a1bd-5c91121bd2fd");
  });

  it("binds all reviewed source and inventory crops without granting assignment authority", () => {
    expect(artifact.reviewedSemanticMap).toEqual(REVIEWED_STEP31_32_SEMANTIC_MAP);
    expect(artifact.inputs.reviewEvidence).toEqual(
      CURRENT_STEP31_32_ORDER_RECONCILIATION_PINS.reviewEvidence,
    );
    expect(artifact.authority).toEqual(__testOnly.AUTHORITY);
    expect(artifact.scope.productionLedgerIntegrated).toBe(false);
    for (const row of artifact.reviewedSemanticMap) {
      expect(row).not.toHaveProperty("brickRef");
      expect(row).not.toHaveProperty("transform");
      expect(row).not.toHaveProperty("frameEvidenceDigest");
      expect(row).not.toHaveProperty("catalogPartId");
    }
    expect(artifact).not.toHaveProperty("physicalIdentitySourcePositions");
    expect(artifact.naiveIndependentCuts).not.toHaveProperty("cutAfterBuilderIdentityOrdinal");
    expect(
      artifact.reconciledSteps.every((step) => !Object.hasOwn(step, "sourcePhaseSequences")),
    ).toBe(true);
  });

  it("rejects phase, phase-order, and physical-member drift", () => {
    const phaseDrift = mutableOfficial(official);
    const phase49 = phaseDrift.builderOrder.phases.find((phase) => phase.sequence === 49);
    phase49.sourceDigest = `sha256:${"0".repeat(64)}`;
    expect(() =>
      __testOnly.deriveStep31_32OrderReconciliation(manifestEvidence, phaseDrift),
    ).toThrow(/phase 49\.\.54 order or physical membership drifted/);

    const orderDrift = mutableOfficial(official);
    const first = orderDrift.builderOrder.phases.findIndex((phase) => phase.sequence === 49);
    [orderDrift.builderOrder.phases[first], orderDrift.builderOrder.phases[first + 1]] = [
      orderDrift.builderOrder.phases[first + 1],
      orderDrift.builderOrder.phases[first],
    ];
    expect(() =>
      __testOnly.deriveStep31_32OrderReconciliation(manifestEvidence, orderDrift),
    ).toThrow(/ordered, complete six-phase source window/);

    const memberDrift = mutableOfficial(official);
    const memberPhase = memberDrift.builderOrder.phases.find((phase) => phase.sequence === 49);
    memberPhase.brickRefs.reverse();
    expect(() =>
      __testOnly.deriveStep31_32OrderReconciliation(manifestEvidence, memberDrift),
    ).toThrow(/phase 49\.\.54 order or physical membership drifted/);
  });

  it("rejects quantity-only substitutions plus incomplete or extra reviewed and phase rows", () => {
    const quantityOnly = structuredClone(REVIEWED_STEP31_32_SEMANTIC_MAP);
    quantityOnly[0].elementId = "4618852";
    quantityOnly[0].officialDesignId = "3245";
    quantityOnly[1].elementId = "4211104";
    quantityOnly[1].officialDesignId = "3622";
    expect(() =>
      __testOnly.deriveStep31_32OrderReconciliation(manifestEvidence, official, quantityOnly),
    ).toThrow(/quantity-only substitutions are forbidden/);
    for (const reviewed of [
      REVIEWED_STEP31_32_SEMANTIC_MAP.slice(0, 2),
      [...REVIEWED_STEP31_32_SEMANTIC_MAP, REVIEWED_STEP31_32_SEMANTIC_MAP[0]],
    ]) {
      expect(() =>
        __testOnly.deriveStep31_32OrderReconciliation(manifestEvidence, official, reviewed),
      ).toThrow(/incomplete or extra maps are forbidden/);
    }
    for (const edit of [
      (phases) => phases.filter((phase) => phase.sequence !== 54),
      (phases) => [...phases, { ...phases.find((phase) => phase.sequence === 54) }],
    ]) {
      const changed = mutableOfficial(official);
      changed.builderOrder.phases = edit(changed.builderOrder.phases);
      expect(() =>
        __testOnly.deriveStep31_32OrderReconciliation(manifestEvidence, changed),
      ).toThrow(/ordered, complete six-phase source window/);
    }
  });

  it("rejects manifest, official XML, and reviewed crop digest drift", async () => {
    const changedManifest = Buffer.from(input.currentManifestBytes);
    changedManifest[changedManifest.length - 2] ^= 1;
    await expect(
      compileStep31_32OrderReconciliation({ ...input, currentManifestBytes: changedManifest }),
    ).rejects.toThrow(/exact pinned|not valid JSON/);
    const changedOfficial = Buffer.from(input.officialModelBytes);
    changedOfficial[changedOfficial.length - 2] ^= 1;
    await expect(
      compileStep31_32OrderReconciliation({ ...input, officialModelBytes: changedOfficial }),
    ).rejects.toThrow(/exact .* XML/);
    const changedReview = structuredClone(REVIEWED_STEP31_32_SEMANTIC_MAP);
    changedReview[0].sourceCropSha256 = `sha256:${"f".repeat(64)}`;
    expect(() =>
      __testOnly.deriveStep31_32OrderReconciliation(manifestEvidence, official, changedReview),
    ).toThrow(/drifted from its exact visually reviewed identity/);
  });

  it("closes authority and rejects added assignment, frame, transform, placement, or document claims", async () => {
    for (const key of [
      "sourceExecution",
      "preparedRun",
      "coverageTrust",
      "coveragePublication",
      "catalogAdmission",
      "physicalFrame",
      "assignmentAuthority",
      "documentMutation",
      "placement",
      "acceptedDocument",
      "replay",
      "completion",
    ]) {
      const changed = structuredClone(artifact);
      changed.authority[key] = true;
      expect(() => __testOnly.assertExactPublishedShape(changed)).toThrow(/closed authority/);
    }
    const linked = structuredClone(artifact);
    linked.calloutAssignment = {
      brickRef: "57d25780-5977-495b-a1bd-5c91121bd2fd",
      identity: artifact.reviewedSemanticMap[0].identity,
    };
    expect(() => __testOnly.assertExactPublishedShape(linked)).toThrow();
    const transformed = structuredClone(artifact);
    transformed.transform = {};
    expect(() => __testOnly.assertExactPublishedShape(transformed)).toThrow();
    const falselyPrivate = structuredClone(artifact);
    falselyPrivate.disclosure.reviewedPhysicalJoinReconstructibleFromPinnedInputs = false;
    expect(() => __testOnly.assertExactPublishedShape(falselyPrivate)).toThrow(
      /must disclose that its reviewed physical join is reconstructible/,
    );
    const inheritedCropAuthority = structuredClone(artifact);
    inheritedCropAuthority.sourceIndex.cropBytesAuthenticated = "truth-linked-first-50-only";
    expect(() => __testOnly.assertExactPublishedShape(inheritedCropAuthority)).toThrow(
      /crop bytes were not consumed/,
    );
    const editedAuthority = structuredClone(artifact);
    editedAuthority.authority.placement = true;
    await expect(
      verifyStep31_32OrderReconciliation({
        ...input,
        artifactBytes: encodeStep31_32OrderReconciliation(editedAuthority),
      }),
    ).rejects.toThrow(/does not exactly reproduce/);
  });

  it("independently reproduces the pinned bytes and returns only an opaque immutable handle", async () => {
    const artifactBytes = encodeStep31_32OrderReconciliation(artifact);
    expect(artifactBytes).toHaveLength(
      CURRENT_STEP31_32_ORDER_RECONCILIATION_PINS.expectedArtifact.bytes,
    );
    const verified = await verifyStep31_32OrderReconciliation({ ...input, artifactBytes });
    expect(isVerifiedStep31_32OrderReconciliation(verified)).toBe(true);
    expect(isVerifiedStep31_32OrderReconciliation(Object.freeze({ verified: true }))).toBe(false);
    const inspection = inspectVerifiedStep31_32OrderReconciliation(verified);
    expect(inspection.digest).toBe(
      CURRENT_STEP31_32_ORDER_RECONCILIATION_PINS.expectedArtifact.digest,
    );
    expect(Object.isFrozen(inspection.artifact.reconciledSteps)).toBe(true);
    const copy = bytesFromVerifiedStep31_32OrderReconciliation(verified);
    const first = copy[0];
    copy[0] ^= 0xff;
    expect(bytesFromVerifiedStep31_32OrderReconciliation(verified)[0]).toBe(first);
  });

  it("owns every byte role before its first asynchronous boundary and rejects extra roles", async () => {
    const compileInput = realInput();
    const compilation = compileStep31_32OrderReconciliation(compileInput);
    compileInput.currentManifestBytes.fill(0);
    compileInput.officialModelBytes.fill(0);
    const compiled = await compilation;
    expect(compiled.combinedWindow.pieces).toBe(14);

    const verifyInput = {
      ...realInput(),
      artifactBytes: encodeStep31_32OrderReconciliation(compiled),
    };
    const verification = verifyStep31_32OrderReconciliation(verifyInput);
    verifyInput.currentManifestBytes.fill(0);
    verifyInput.officialModelBytes.fill(0);
    verifyInput.artifactBytes.fill(0);
    expect(isVerifiedStep31_32OrderReconciliation(await verification)).toBe(true);

    await expect(
      compileStep31_32OrderReconciliation({ ...realInput(), assignmentBytes: Buffer.from("no") }),
    ).rejects.toThrow(/must contain exactly/);
  });
});
