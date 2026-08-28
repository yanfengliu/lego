import { existsSync, readFileSync } from "node:fs";

import { beforeAll, describe, expect, it } from "vitest";

import {
  bytesFromVerifiedPrefix50OfficialWorldReconciliation,
  compilePrefix50OfficialWorldReconciliation,
  encodePrefix50OfficialWorldReconciliation,
  inspectVerifiedPrefix50OfficialWorldReconciliation,
  isVerifiedPrefix50OfficialWorldReconciliation,
  verifyPrefix50OfficialWorldReconciliation,
} from "./part-identification-prefix50-official-world-reconciliation.mjs";
import { inspectVerifiedPrefix50ActionPreparation } from "./part-identification-prefix50-action-preparation.mjs";
import { reproduceCurrentPrefix50OfficialWorldReconciliation } from "./part-identification-prefix50-official-world-reconciliation-current.mjs";
import {
  PREFIX50_FIRST_EIGHT_EXPECTED_CONTACTS,
  PREFIX50_OFFICIAL_WORLD_RECONCILIATION_AUTHORITY,
  PREFIX50_OFFICIAL_WORLD_RECONCILIATION_OUTPUT_PATH,
  PREFIX50_OFFICIAL_WORLD_RECONCILIATION_PINS,
  PREFIX50_OFFICIAL_WORLD_RECONCILIATION_SCHEMA,
} from "./part-identification-prefix50-official-world-reconciliation-source.mjs";
import { PREFIX50_LDRAW_CATALOG_FRAMES_OUTPUT_PATH } from "./part-identification-prefix50-ldraw-catalog-frames-source.mjs";
import { PREFIX50_OFFICIAL_LDRAW_WORLD_PROPOSAL_OUTPUT_PATH } from "./part-identification-prefix50-official-ldraw-world-proposal-source.mjs";

const inputsPresent = [
  PREFIX50_OFFICIAL_LDRAW_WORLD_PROPOSAL_OUTPUT_PATH,
  PREFIX50_LDRAW_CATALOG_FRAMES_OUTPUT_PATH,
  PREFIX50_OFFICIAL_WORLD_RECONCILIATION_OUTPUT_PATH,
].every(existsSync);

function hostileBytes(artifact, change) {
  const changed = structuredClone(artifact);
  change(changed);
  return encodePrefix50OfficialWorldReconciliation(changed);
}

describe.runIf(inputsPresent)("prefix-50 official-world occurrence reconciliation", () => {
  let artifact;
  let bytes;
  let input;
  let verified;
  let expectedCopies;

  beforeAll(async () => {
    const reproduced = await reproduceCurrentPrefix50OfficialWorldReconciliation();
    artifact = reproduced.artifact;
    bytes = reproduced.bytes;
    input = reproduced.input;
    expectedCopies = inspectVerifiedPrefix50ActionPreparation(input.actionPreparation)
      .artifact.steps.flatMap(({ stepNumber, phases }) =>
        phases.flatMap((phase) =>
          phase.kind === "multi-build-copy"
            ? phase.members.map((member) => ({
                ordinal: member.sourceBuilderIdentityOrdinal,
                stepNumber,
                phaseSequence: phase.sequence,
                builderBrickRef: member.builderBrickRef,
                sourceBuilderBrickRef: member.sourceBuilderBrickRef,
                masterSubBuildRef: phase.masterSubBuildRef,
              }))
            : [],
        ),
      )
      .sort((left, right) => left.ordinal - right.ordinal);
    const diskBytes = readFileSync(PREFIX50_OFFICIAL_WORLD_RECONCILIATION_OUTPUT_PATH);
    expect(diskBytes).toEqual(bytes);
    verified = await verifyPrefix50OfficialWorldReconciliation({
      ...input,
      artifactBytes: diskBytes,
    });
  }, 180_000);

  it("reproduces the exact ignored artifact, three opaque inputs, and authority boundary", () => {
    const inspection = inspectVerifiedPrefix50OfficialWorldReconciliation(verified);
    expect(isVerifiedPrefix50OfficialWorldReconciliation(verified)).toBe(true);
    expect(bytesFromVerifiedPrefix50OfficialWorldReconciliation(verified)).toEqual(bytes);
    expect(inspection.digest).toBe(
      PREFIX50_OFFICIAL_WORLD_RECONCILIATION_PINS.expectedArtifact.digest,
    );
    expect(bytes).toHaveLength(PREFIX50_OFFICIAL_WORLD_RECONCILIATION_PINS.expectedArtifact.bytes);
    expect(artifact.schemaVersion).toBe(PREFIX50_OFFICIAL_WORLD_RECONCILIATION_SCHEMA);
    expect(artifact.authority).toEqual(PREFIX50_OFFICIAL_WORLD_RECONCILIATION_AUTHORITY);
    expect(artifact.inputs).toMatchObject({
      proposal: PREFIX50_OFFICIAL_WORLD_RECONCILIATION_PINS.proposal,
      frameRegistry: PREFIX50_OFFICIAL_WORLD_RECONCILIATION_PINS.frameRegistry,
      actionPreparation: PREFIX50_OFFICIAL_WORLD_RECONCILIATION_PINS.actionPreparation,
      catalogVersion: PREFIX50_OFFICIAL_WORLD_RECONCILIATION_PINS.catalogVersion,
    });
    expect(artifact.scope).toEqual({
      firstPrintedStep: 1,
      lastPrintedStep: 50,
      expectedPrintedSteps: 359,
      sourceIndexPreserved: true,
      suffixStepsReconstructed: false,
      scopeBasis: "opaque-action-ordinals-and-actual-builder-brickrefs-never-xml-prefix",
    });
    expect(artifact.accounting).toEqual(
      PREFIX50_OFFICIAL_WORLD_RECONCILIATION_PINS.expectedAccounting,
    );
  });

  it("binds 320 exact actual occurrences, 309 transforms, eleven quarantines, and half-LDU rows", () => {
    expect(
      artifact.rows.map(({ sourceBuilderIdentityOrdinal }) => sourceBuilderIdentityOrdinal),
    ).toEqual(Array.from({ length: 320 }, (_, index) => index + 1));
    expect(new Set(artifact.rows.map(({ builderBrickRef }) => builderBrickRef)).size).toBe(320);
    expect(new Set(artifact.rows.map(({ xmlRow }) => xmlRow)).size).toBe(320);
    expect(new Set(artifact.rows.map(({ topLevelLdrawRow }) => topLevelLdrawRow)).size).toBe(320);
    expect(artifact.rows.every((row) => row.xmlPartRow === 1)).toBe(true);
    expect(artifact.rows.every((row) => row.compositeLdrawRow === null)).toBe(true);
    expect(artifact.rows.every((row) => row.stepNumber <= 50)).toBe(true);
    expect(artifact.rows.every((row) => row.documentLegalityClaimed === false)).toBe(true);
    expect(artifact.rows.filter(({ status }) => status === "reconciled")).toHaveLength(309);
    expect(artifact.rows.filter(({ status }) => status === "quarantined-unchanged")).toHaveLength(
      11,
    );
    expect(
      artifact.rows
        .filter(({ actionKind }) => actionKind === "multi-build-copy")
        .map(
          ({
            sourceBuilderIdentityOrdinal,
            stepNumber,
            phaseSequence,
            builderBrickRef,
            sourceBuilderBrickRef,
            masterSubBuildRef,
          }) => ({
            ordinal: sourceBuilderIdentityOrdinal,
            stepNumber,
            phaseSequence,
            builderBrickRef,
            sourceBuilderBrickRef,
            masterSubBuildRef,
          }),
        ),
    ).toEqual(expectedCopies);
    expect(expectedCopies).toHaveLength(11);
    expect(
      artifact.rows
        .filter(({ actionKind }) => actionKind === "direct")
        .every(
          ({ sourceBuilderBrickRef, masterSubBuildRef }) =>
            sourceBuilderBrickRef === null && masterSubBuildRef === null,
        ),
    ).toBe(true);
    expect(
      artifact.rows
        .filter(({ catalogWorldTransform }) =>
          catalogWorldTransform?.positionLdu.some((coordinate) => !Number.isInteger(coordinate)),
        )
        .map(({ sourceBuilderIdentityOrdinal }) => sourceBuilderIdentityOrdinal),
    ).toEqual([281, 282, 283]);
    expect(
      artifact.rows.slice(0, 8).map(({ sourceBuilderIdentityOrdinal, catalogWorldTransform }) => ({
        ordinal: sourceBuilderIdentityOrdinal,
        orientationId: catalogWorldTransform.orientationId,
        positionLdu: catalogWorldTransform.positionLdu,
      })),
    ).toEqual([
      { ordinal: 1, orientationId: "upright-yaw-0", positionLdu: [500, -4, -234] },
      { ordinal: 2, orientationId: "upright-yaw-0", positionLdu: [600, -12, -234] },
      { ordinal: 3, orientationId: "upright-yaw-0", positionLdu: [580, -4, -214] },
      { ordinal: 4, orientationId: "upright-yaw-270", positionLdu: [580, -12, -134] },
      { ordinal: 5, orientationId: "upright-yaw-90", positionLdu: [560, -4, -164] },
      { ordinal: 6, orientationId: "upright-yaw-270", positionLdu: [580, -4, -114] },
      { ordinal: 7, orientationId: "upright-yaw-90", positionLdu: [400, -4, -94] },
      { ordinal: 8, orientationId: "upright-yaw-270", positionLdu: [500, -4, -194] },
    ]);
    expect(
      artifact.rows.every((row) =>
        row.status === "reconciled"
          ? row.frameApplied === true &&
            row.catalogFrameEvidence !== null &&
            row.catalogWorldTransform !== null
          : row.frameApplied === false &&
            row.catalogFrameEvidence === null &&
            row.catalogWorldTransform === null,
      ),
    ).toBe(true);
    expect(artifact.occurrenceCommitment).toMatchObject({
      algorithm: "sha256-json-array-v1",
      rowCount: 320,
      order: "sourceBuilderIdentityOrdinal-ascending",
    });
    expect(artifact.worldTransformCommitment).toMatchObject({
      algorithm: "sha256-json-array-v1",
      rowCount: 320,
      order: "sourceBuilderIdentityOrdinal-ascending",
    });
  });

  it("proves only the exact first-eight connector-position topology", () => {
    expect(artifact.firstEightConnectorTopology).toEqual({
      scope: { firstOrdinal: 1, lastOrdinal: 8 },
      instrument: "catalog-connector-position-coincidence-only",
      fullConnectionCensus: false,
      capacityResolved: false,
      collisionChecked: false,
      documentLegalityClaimed: false,
      parts: 8,
      catalogConnectors: expect.any(Number),
      connectorPairComparisons: expect.any(Number),
      components: 1,
      contacts: PREFIX50_FIRST_EIGHT_EXPECTED_CONTACTS,
    });
    expect(artifact.firstEightConnectorTopology.catalogConnectors).toBeGreaterThan(0);
    expect(artifact.firstEightConnectorTopology.connectorPairComparisons).toBeGreaterThan(0);
  });

  it("deep-freezes inspection and returns fresh verified bytes", () => {
    const inspection = inspectVerifiedPrefix50OfficialWorldReconciliation(verified);
    const position = inspection.artifact.rows[0].catalogWorldTransform.positionLdu;
    const original = [...position];
    expect(Object.isFrozen(inspection.artifact.rows[0])).toBe(true);
    expect(Object.isFrozen(position)).toBe(true);
    expect(() => {
      position[0] = 77;
    }).toThrow(TypeError);
    expect(position).toEqual(original);
    const first = bytesFromVerifiedPrefix50OfficialWorldReconciliation(verified);
    first[0] = 0;
    expect(bytesFromVerifiedPrefix50OfficialWorldReconciliation(verified)).toEqual(bytes);
  });

  it("rejects forged opaque proposal, frame-registry, and action-preparation handles", async () => {
    await expect(
      compilePrefix50OfficialWorldReconciliation({ ...input, proposal: {} }),
    ).rejects.toThrow(/opaque verified current 500,895-byte official-world proposal/);
    await expect(
      compilePrefix50OfficialWorldReconciliation({ ...input, frameRegistry: {} }),
    ).rejects.toThrow(/opaque verified exact first-50 LDraw-to-catalog frame registry/);
    await expect(
      compilePrefix50OfficialWorldReconciliation({ ...input, actionPreparation: {} }),
    ).rejects.toThrow(/opaque verified current first-50 action preparation/);
  });

  it("rejects same-design occurrence swaps and MultiBuild master substitution", async () => {
    const duplicatePair = artifact.rows.find((row, index) =>
      artifact.rows
        .slice(index + 1)
        .some(
          (other) =>
            other.designRevision === row.designRevision &&
            other.ldrawFilename === row.ldrawFilename &&
            other.builderBrickRef !== row.builderBrickRef,
        ),
    );
    const duplicateOther = artifact.rows.find(
      (row) =>
        row.designRevision === duplicatePair.designRevision &&
        row.ldrawFilename === duplicatePair.ldrawFilename &&
        row.builderBrickRef !== duplicatePair.builderBrickRef,
    );
    await expect(
      verifyPrefix50OfficialWorldReconciliation({
        ...input,
        artifactBytes: hostileBytes(artifact, (changed) => {
          changed.rows[duplicatePair.sourceBuilderIdentityOrdinal - 1].builderBrickRef =
            duplicateOther.builderBrickRef;
        }),
      }),
    ).rejects.toThrow(/exact official occurrence identity/);

    const copy = artifact.rows.find(({ actionKind }) => actionKind === "multi-build-copy");
    await expect(
      verifyPrefix50OfficialWorldReconciliation({
        ...input,
        artifactBytes: hostileBytes(artifact, (changed) => {
          changed.rows[copy.sourceBuilderIdentityOrdinal - 1].builderBrickRef =
            copy.sourceBuilderBrickRef;
        }),
      }),
    ).rejects.toThrow(/substitutes source/);
  });

  it("rejects step-51 injection and every exact alias/quarantine widening class", async () => {
    await expect(
      verifyPrefix50OfficialWorldReconciliation({
        ...input,
        artifactBytes: hostileBytes(artifact, (changed) => {
          changed.rows[319].stepNumber = 51;
        }),
      }),
    ).rejects.toThrow(/out-of-scope step 51/);

    const hostileAliases = [
      ["3245;M", "3245c.dat"],
      ["10201;H", "28802.dat"],
      ["41769;G", "41770.dat"],
    ];
    for (const [designRevision, widenedFilename] of hostileAliases) {
      await expect(
        verifyPrefix50OfficialWorldReconciliation({
          ...input,
          artifactBytes: hostileBytes(artifact, (changed) => {
            const row = changed.rows.find(
              (candidate) => candidate.designRevision === designRevision,
            );
            row.ldrawFilename = widenedFilename;
          }),
        }),
      ).rejects.toThrow(/occurrence identity|alias or quarantine/);
    }
  });

  it("rejects removed frame translations and an asymmetric quarter-turn", async () => {
    for (const translationY of [-4, -12]) {
      const source = artifact.rows.find(
        (row) =>
          row.status === "reconciled" &&
          row.catalogFrameEvidence.translationLdu[1] === translationY &&
          row.catalogWorldTransform.positionLdu.join(",") !==
            row.sourceWorldProposal.positionLdu.join(","),
      );
      expect(source).toBeDefined();
      await expect(
        verifyPrefix50OfficialWorldReconciliation({
          ...input,
          artifactBytes: hostileBytes(artifact, (changed) => {
            changed.rows[
              source.sourceBuilderIdentityOrdinal - 1
            ].catalogWorldTransform.positionLdu = [...source.sourceWorldProposal.positionLdu];
          }),
        }),
      ).rejects.toThrow(/changes its exact reconciled world transform/);
    }

    const asymmetric = artifact.rows.find(
      (row) =>
        row.status === "reconciled" &&
        row.catalogFrameEvidence.orientationId !== "upright-yaw-0" &&
        row.catalogWorldTransform.orientationId !== row.sourceWorldProposal.orientationId,
    );
    expect(asymmetric).toBeDefined();
    await expect(
      verifyPrefix50OfficialWorldReconciliation({
        ...input,
        artifactBytes: hostileBytes(artifact, (changed) => {
          changed.rows[
            asymmetric.sourceBuilderIdentityOrdinal - 1
          ].catalogWorldTransform.orientationId = asymmetric.sourceWorldProposal.orientationId;
        }),
      }),
    ).rejects.toThrow(/changes its exact reconciled world transform/);
  });
});
