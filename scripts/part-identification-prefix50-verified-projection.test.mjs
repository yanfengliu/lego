import { beforeAll, describe, expect, it } from "vitest";

import {
  loadCurrentPrefix50VerifiedProjectionFixture,
  realEvidencePresent,
} from "./part-identification-prefix50-verified-projection-test-support.mjs";
import { createRealBuildPrefix50VerifiedProjectionReader } from "./part-identification-prefix50-verified-projection.mjs";

describe.runIf(realEvidencePresent)("current prefix-50 opaque verified projection", () => {
  let action;
  let reconciliation;
  let structural;
  let readProjection;
  let reader;
  let projection;
  let compilation;
  let loadCompilation;
  let loadSourceRepairEvidence;
  let exactCompilerModule;
  let kernel;
  let transformPolicy;
  let repairEvidence;
  let repairProposal;
  let occurrence30ActionBinding;

  beforeAll(async () => {
    ({
      action,
      reconciliation,
      structural,
      readProjection,
      reader,
      projection,
      loadCompilation,
      loadSourceRepairEvidence,
      exactCompilerModule,
      kernel,
      transformPolicy,
      repairEvidence,
      repairProposal,
      occurrence30ActionBinding,
    } = await loadCurrentPrefix50VerifiedProjectionFixture());
  }, 240_000);

  it("compiles the exact real-evidence prefix and binds only the three axle-seat repairs", async () => {
    compilation = await loadCompilation();
    expect(projection.occurrences[0].sourceWorldTransform).toEqual({
      positionLdu: [500, -4, -234],
      orientationId: "upright-yaw-0",
    });
    expect(compilation.worldGaugeSourceRepair).toMatchObject({
      occurrenceOrdinal: 1,
      catalogPartId: "builtin:corner-plate-5x5-quarter-ring",
      sourceWorldTransform: {
        positionLdu: [500, -4, -234],
        orientationId: "upright-yaw-0",
      },
      repairedSourceWorldTransform: {
        positionLdu: [560, -4, -194],
        orientationId: "upright-yaw-0",
      },
      sourceResidualLdu: [60, 0, 40],
      projectAnchorPolicy: "first-ordered-direct-empty-enumeration/1",
      schemaVersion: "lego.real-build-prefix50-world-gauge-source-repair/2",
      basis: "complete-prefix50-exact-enumeration",
      repairedTargetTransform: {
        positionLdu: [0, 8, 0],
        orientationId: "upright-yaw-0",
      },
    });
    expect(compilation.worldGaugeSourceRepair.proof).toEqual({
      schemaVersion: "lego.real-build-prefix50-world-gauge-source-repair-proof/1",
      projectionCommitment: compilation.projectionCommitment,
      completedPrintedStep: 50,
      stepCount: 50,
      compiledPartCount: 320,
      occurrenceCount: 320,
      occurrenceOrdinalOrder: "exact-indexed-1-through-320",
      sourceSuffixOccurrenceCount: 0,
      placementOrdinalCount: 320,
      placementOrdinalRoster: "exact-unique-1-through-320",
      stepIndexOrder: "exact-indexed-0-through-49",
      zeroPieceStepNumber: 44,
      hasStep51Suffix: false,
      finalDocumentHash: kernel.documentStructuralHash(compilation.document),
    });
    expect(
      compilation.document.parts.some(
        ({ id, catalogPartId, transform }) =>
          id === compilation.worldGaugeSourceRepair.candidatePartId &&
          catalogPartId === "builtin:corner-plate-5x5-quarter-ring" &&
          transform.positionLdu.every(
            (coordinate, index) =>
              coordinate ===
              compilation.worldGaugeSourceRepair.repairedTargetTransform.positionLdu[index],
          ) &&
          transform.orientationId ===
            compilation.worldGaugeSourceRepair.repairedTargetTransform.orientationId,
      ),
    ).toBe(true);
    expect(compilation.sourcePlacementRepairs).toHaveLength(3);
    expect(
      compilation.sourcePlacementRepairs.map(({ occurrenceOrdinal, expectedReceiverOrdinal }) => [
        occurrenceOrdinal,
        expectedReceiverOrdinal,
      ]),
    ).toEqual([
      [281, 265],
      [282, 261],
      [283, 264],
    ]);

    const repairByOrdinal = new Map(
      compilation.sourcePlacementRepairs.map((repair) => [repair.occurrenceOrdinal, repair]),
    );
    const repairedProjection = {
      ...projection,
      occurrences: projection.occurrences.map((occurrence) => {
        const repair = repairByOrdinal.get(occurrence.ordinal);
        return repair === undefined
          ? occurrence
          : { ...occurrence, sourceWorldTransform: repair.repairedSourceWorldTransform };
      }),
    };
    expect(compilation.projectionCommitment).toBe(kernel.canonicalDigest(projection));
    expect(compilation.projectionCommitment).not.toBe(kernel.canonicalDigest(repairedProjection));

    const gaugeRotatedResidualPoint = kernel.transformLduPoint(compilation.gauge, [0, 0, 0.5]);
    const gaugeRotatedResidual = gaugeRotatedResidualPoint.map(
      (coordinate, index) => coordinate - compilation.gauge.positionLdu[index],
    );
    for (const repair of compilation.sourcePlacementRepairs) {
      expect(repair.sourceWorldTransform.positionLdu[2]).toBe(-96.5);
      expect(repair.repairedSourceWorldTransform.positionLdu[2]).toBe(-96);
      expect(repair.sourceResidualLdu).toEqual([0, 0, 0.5]);

      const originalTarget = kernel.composeRigidTransforms(
        compilation.gauge,
        repair.sourceWorldTransform,
      );
      expect(
        repair.repairedTargetTransform.positionLdu.map(
          (coordinate, index) => coordinate - originalTarget.positionLdu[index],
        ),
      ).toEqual(gaugeRotatedResidual);

      expect(compilation.document.parts.some(({ id }) => id === repair.candidatePartId)).toBe(true);
      expect(compilation.document.parts.some(({ id }) => id === repair.receiverPartId)).toBe(true);
      const endpointMatches = compilation.document.connections.filter(
        ({ a, b }) =>
          (a.partId === repair.candidatePartId &&
            a.portId === "axle:2" &&
            b.partId === repair.receiverPartId &&
            b.portId === "axleHole:0") ||
          (b.partId === repair.candidatePartId &&
            b.portId === "axle:2" &&
            a.partId === repair.receiverPartId &&
            a.portId === "axleHole:0"),
      );
      expect(endpointMatches).toHaveLength(1);
      expect(endpointMatches[0]?.id).toBe(repair.connectionId);
    }

    expect(compilation.document.steps).toHaveLength(50);
    expect(compilation.document.parts).toHaveLength(320);
    expect(compilation.document.steps[43]).toMatchObject({ index: 43, partIds: [] });
    expect(compilation.document.steps.some(({ index }) => index === 50)).toBe(false);
  });

  it("binds the opaque occurrence-30 repair without consulting future occurrence 147", async () => {
    compilation = await loadCompilation();
    expect(repairProposal).toMatchObject({
      schemaVersion: "lego.real-build-prefix50-occurrence30-source-repair/1",
      occurrenceOrdinal: 30,
      expectedReceiverOrdinal: 31,
      futureCollisionControlOrdinal: 147,
      catalogPartId: "builtin:corner-plate-3x3",
      sourceWorldTransform: {
        positionLdu: [30, -4, -364],
        orientationId: "upright-yaw-0",
      },
      repairedSourceWorldTransform: {
        positionLdu: [10, -4, -344],
        orientationId: "upright-yaw-0",
      },
      sourceResidualLdu: [-20, 0, 20],
      provisionalBasis: "opaque-builder-source-awaiting-complete-prefix-proof",
    });
    expect(repairProposal.sourceEvidence).toBe(repairEvidence);
    expect(repairProposal.repairCommitment).toMatch(/^sha256:[0-9a-f]{64}$/u);

    const futureBlindOccurrences = new Proxy(projection.occurrences, {
      get(target, property, receiver) {
        if (property === "146") throw new Error("occurrence 147 was consulted");
        return Reflect.get(target, property, receiver);
      },
    });
    const futureBlindCommitment = exactCompilerModule.__testOnly.occurrence30RepairCommitment(
      { sourceSetId: projection.sourceSetId, occurrences: futureBlindOccurrences },
      occurrence30ActionBinding,
      repairEvidence,
    );
    const mutated147 = projection.occurrences.map((occurrence) =>
      occurrence.ordinal === 147
        ? {
            ...occurrence,
            sourceWorldTransform: {
              ...occurrence.sourceWorldTransform,
              positionLdu: [999, 999, 999],
            },
          }
        : occurrence,
    );
    const deleted147 = projection.occurrences.filter(({ ordinal }) => ordinal !== 147);
    for (const occurrences of [mutated147, deleted147]) {
      expect(
        exactCompilerModule.__testOnly.occurrence30RepairCommitment(
          { sourceSetId: projection.sourceSetId, occurrences },
          occurrence30ActionBinding,
          repairEvidence,
        ),
      ).toBe(futureBlindCommitment);
    }

    expect(compilation.occurrence30SourceRepair).toMatchObject({
      schemaVersion: "lego.real-build-prefix50-occurrence30-source-repair/2",
      basis: "opaque-source-plus-complete-prefix50-exact-enumeration",
      repairCommitment: futureBlindCommitment,
      repairedTargetTransform: {
        positionLdu: [-550, 8, -150],
        orientationId: "upright-yaw-0",
      },
      proof: {
        projectionCommitment: compilation.projectionCommitment,
        completedPrintedStep: 50,
        compiledPartCount: 320,
        exactEnumeratedPoseRetained: true,
        distinctCandidatePortCount: 5,
        distinctReceiverPortCount: 5,
        finalDocumentCollisionCount: 0,
        occurrence30To147CollisionCount: 0,
      },
    });
    expect(compilation.occurrence30SourceRepair.connectionIds).toHaveLength(5);
    expect(new Set(compilation.occurrence30SourceRepair.connectionIds).size).toBe(5);
  });

  it("corroborates the project-authored part-scoped non-upright transform decision", () => {
    const uprightOrientationIds = new Set(transformPolicy.LEGAL_ORIENTATION_IDS);
    const pairs = (values) =>
      [...new Set(values.map((pair) => JSON.stringify(pair)))]
        .map((pair) => JSON.parse(pair))
        .sort(([leftPartId, leftOrientationId], [rightPartId, rightOrientationId]) =>
          `${leftPartId}\u0000${leftOrientationId}`.localeCompare(
            `${rightPartId}\u0000${rightOrientationId}`,
          ),
        );
    const sourceCorroborationPairs = pairs(
      projection.occurrences
        .filter(
          ({ sourceWorldTransform }) =>
            !uprightOrientationIds.has(sourceWorldTransform.orientationId),
        )
        .map(({ partIdentity, sourceWorldTransform }) => [
          partIdentity.reconciledCatalogPartId,
          sourceWorldTransform.orientationId,
        ]),
    );
    const projectAuthoredPairs = pairs(
      Object.entries(transformPolicy.PART_SCOPED_NON_UPRIGHT_LEGAL_ORIENTATION_IDS).flatMap(
        ([partId, orientationIds]) =>
          orientationIds.map((orientationId) => [partId, orientationId]),
      ),
    );
    // Bound: exact raw prefix rows plus all three opaque local repair proofs.
    // These corroborate six catalog grants, not camera/placement authority or Step-44 selection.
    const { step41, step42, step42_43 } = loadSourceRepairEvidence();
    const repairedRows = [
      ...step41.pairs.map((pair) => [pair.candidateOrdinal, pair.repairedSourceWorldTransform]),
      [step42.occurrenceOrdinal, step42.repairedSourceTransform],
      ...step42_43.rows.map((row) => [row.ordinal, row.repairedSourceWorldTransform]),
    ];
    expect(repairedRows.map(([ordinal]) => ordinal)).toEqual([
      270, 271, 272, 273, 274, 275, 276, 277, 278, 279, 280,
    ]);
    const repairPairs = pairs(
      repairedRows.map(([ordinal, transform]) => {
        const row = projection.occurrences[ordinal - 1];
        expect(row.ordinal).toBe(ordinal);
        return [row.partIdentity.reconciledCatalogPartId, transform.orientationId];
      }),
    );
    expect(repairPairs).toEqual([
      ["builtin:plate-1x2-round-end", "proper-m-00n0n0n00"],
      ["builtin:plate-1x4", "proper-m-00n0n0n00"],
      ["builtin:slope-1x2-45", "proper-m-00n0n0n00"],
      ["builtin:slope-1x2-45", "proper-m-00p0n0p00"],
      ["builtin:tile-1x2", "proper-m-00n0n0n00"],
      ["builtin:tile-1x6", "proper-m-00n0n0n00"],
    ]);
    expect(sourceCorroborationPairs).toHaveLength(13);
    expect(projectAuthoredPairs).toHaveLength(19);
    expect(pairs([...sourceCorroborationPairs, ...repairPairs])).toEqual(projectAuthoredPairs);
  }, 240_000);

  it("projects only exact steps 1..50, 320 occurrences, and the zero-piece step 44", () => {
    expect(projection.steps.map(({ printedStepNumber }) => printedStepNumber)).toEqual(
      Array.from({ length: 50 }, (_, index) => index + 1),
    );
    expect(projection.steps.every(({ name }) => /^Printed step \d+$/u.test(name))).toBe(true);
    expect(
      projection.steps.every(({ sourceActionDigest }) =>
        /^sha256:[0-9a-f]{64}$/u.test(sourceActionDigest),
      ),
    ).toBe(true);
    expect(projection.occurrences).toHaveLength(320);
    expect(projection.occurrences.map(({ ordinal }) => ordinal)).toEqual(
      Array.from({ length: 320 }, (_, index) => index + 1),
    );
    expect(
      projection.occurrences.filter(({ printedStepNumber }) => printedStepNumber === 44),
    ).toEqual([]);
    expect(
      Math.max(...projection.occurrences.map(({ printedStepNumber }) => printedStepNumber)),
    ).toBe(50);
    expect(Object.isFrozen(reader)).toBe(true);
    expect(Object.isFrozen(projection)).toBe(true);
    expect(Object.isFrozen(projection.occurrences[0])).toBe(true);
  });

  it("binds every occurrence to its exact action phase and projects the one official child window", () => {
    expect(projection.schemaVersion).toBe("lego.real-build-prefix50-verified-projection/2");
    expect(projection.occurrences[257]).toMatchObject({
      ordinal: 258,
      printedStepNumber: 38,
      phaseSequence: 64,
      phaseMemberOrdinal: 1,
      subBuildPath: [
        "7004cf0d-d97f-4b0d-8572-970e23815c05",
        "2956f76b-0e29-497c-84ae-d8bd9099aa3f",
      ],
    });
    expect(projection.occurrences[258]).toMatchObject({
      ordinal: 259,
      printedStepNumber: 38,
      phaseSequence: 64,
      phaseMemberOrdinal: 2,
    });
    expect(projection.occurrences[279]).toMatchObject({
      ordinal: 280,
      printedStepNumber: 43,
      phaseSequence: 71,
      phaseMemberOrdinal: 1,
    });
    expect(projection.childSubBuildWindow).toEqual({
      schemaVersion: "lego.real-build-prefix50-child-subbuild-window/1",
      sourceStructuralEventSequence: 8,
      sourceStructuralEventDigest:
        "sha256:4a4a56a9a4a802601d2fff37d8cc788cfd479e5573bf68d9013bf2aecca9f9ad",
      parentStepUuid: "c02cc03b-119d-4615-8619-4b12fd9ccf78",
      parentSubBuildPath: ["7004cf0d-d97f-4b0d-8572-970e23815c05"],
      childSubBuildUuid: "2956f76b-0e29-497c-84ae-d8bd9099aa3f",
      childSubBuildPath: [
        "7004cf0d-d97f-4b0d-8572-970e23815c05",
        "2956f76b-0e29-497c-84ae-d8bd9099aa3f",
      ],
      entryPrintedStepNumber: 38,
      lastPhysicalPrintedStepNumber: 43,
      returnPrintedStepNumber: 44,
      firstOccurrenceOrdinal: 258,
      lastOccurrenceOrdinal: 280,
      sourceBuilderIdentityOrdinals: Array.from({ length: 23 }, (_, index) => index + 258),
      precedingPhaseSequence: 71,
      followingPhaseSequence: 72,
      memberCommitment: {
        schemaVersion: "lego.part-identification-prefix50-structural-member-commitment/1",
        rows: 23,
        bytes: 2141,
        digest: "sha256:4944f0b5ef959fc73471c1dc9bcad76ed7b47aec0f74b76cf2d55a85f7cd725c",
      },
    });
    expect(Object.isFrozen(projection.childSubBuildWindow)).toBe(true);
    expect(Object.isFrozen(projection.childSubBuildWindow.sourceBuilderIdentityOrdinals)).toBe(
      true,
    );
  });

  it("retains nine member corrections, two moved roots, and all catalog-world transforms", () => {
    const corrections = projection.occurrences.filter(
      ({ partIdentity }) => partIdentity.basis === "official-member-revision",
    );
    const movedRoots = projection.occurrences.filter(
      ({ partIdentity }) => partIdentity.basis === "official-archive-identity-moved-root",
    );
    expect(corrections.map(({ ordinal }) => ordinal)).toEqual([
      139, 147, 178, 183, 185, 190, 191, 192, 193,
    ]);
    expect(movedRoots.map(({ ordinal, partIdentity }) => ({ ordinal, partIdentity }))).toEqual([
      {
        ordinal: 25,
        partIdentity: {
          publishedCatalogPartId: "builtin:wedge-plate-2x4-right",
          reconciledCatalogPartId: "builtin:wedge-plate-2x4-right",
          officialDesignId: "41769",
          officialDesignRevision: "41769;G",
          sourceLDrawPartId: "41769",
          catalogLDrawPartId: "41769a",
          identityProofId: "41769.dat->41769a.dat",
          basis: "official-archive-identity-moved-root",
        },
      },
      {
        ordinal: 39,
        partIdentity: {
          publishedCatalogPartId: "builtin:wedge-plate-2x4-left",
          reconciledCatalogPartId: "builtin:wedge-plate-2x4-left",
          officialDesignId: "41770",
          officialDesignRevision: "41770;H",
          sourceLDrawPartId: "41770",
          catalogLDrawPartId: "41770a",
          identityProofId: "41770.dat->41770a.dat",
          basis: "official-archive-identity-moved-root",
        },
      },
    ]);
    expect(
      projection.occurrences
        .filter(({ sourceWorldTransform }) =>
          sourceWorldTransform.positionLdu.some((coordinate) => !Number.isInteger(coordinate)),
        )
        .map(({ ordinal }) => ordinal),
    ).toEqual([281, 282, 283]);
  });

  it("derives stable step digests and refuses detached byte claims", () => {
    const secondReader = createRealBuildPrefix50VerifiedProjectionReader({
      actionPreparation: { bytes: action.bytes, verified: action.verified },
      officialWorldReconciliation: {
        bytes: reconciliation.bytes,
        verified: reconciliation.verified,
      },
      structuralEvents: { bytes: structural.bytes, verified: structural.verified },
    });
    expect(
      readProjection(secondReader).steps.map(({ sourceActionDigest }) => sourceActionDigest),
    ).toEqual(projection.steps.map(({ sourceActionDigest }) => sourceActionDigest));
    expect(readProjection(secondReader).sourceArtifactDigest).toBe(projection.sourceArtifactDigest);

    const changedActionBytes = Buffer.from(action.bytes);
    changedActionBytes[0] ^= 1;
    expect(() =>
      createRealBuildPrefix50VerifiedProjectionReader({
        actionPreparation: { bytes: changedActionBytes, verified: action.verified },
        officialWorldReconciliation: {
          bytes: reconciliation.bytes,
          verified: reconciliation.verified,
        },
        structuralEvents: { bytes: structural.bytes, verified: structural.verified },
      }),
    ).toThrow(/must exactly equal the fresh bytes/u);

    const changedReconciliationBytes = Buffer.from(reconciliation.bytes);
    changedReconciliationBytes[0] ^= 1;
    expect(() =>
      createRealBuildPrefix50VerifiedProjectionReader({
        actionPreparation: { bytes: action.bytes, verified: action.verified },
        officialWorldReconciliation: {
          bytes: changedReconciliationBytes,
          verified: reconciliation.verified,
        },
        structuralEvents: { bytes: structural.bytes, verified: structural.verified },
      }),
    ).toThrow(/must exactly equal the fresh bytes/u);

    const changedStructuralBytes = Buffer.from(structural.bytes);
    changedStructuralBytes[0] ^= 1;
    expect(() =>
      createRealBuildPrefix50VerifiedProjectionReader({
        actionPreparation: { bytes: action.bytes, verified: action.verified },
        officialWorldReconciliation: {
          bytes: reconciliation.bytes,
          verified: reconciliation.verified,
        },
        structuralEvents: { bytes: changedStructuralBytes, verified: structural.verified },
      }),
    ).toThrow(/must exactly equal the fresh bytes/u);
    expect(() =>
      createRealBuildPrefix50VerifiedProjectionReader({
        actionPreparation: { bytes: action.bytes, verified: action.verified },
        officialWorldReconciliation: { bytes: reconciliation.bytes, verified: {} },
        structuralEvents: { bytes: structural.bytes, verified: structural.verified },
      }),
    ).toThrow(/opaque independent-verifier result/u);
  });
});
