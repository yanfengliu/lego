import { existsSync } from "node:fs";

import { beforeAll, describe, expect, it } from "vitest";

import { inspectCurrentActionLedgerPrefix } from "./part-identification-action-ledger-prefix.mjs";
import {
  bytesFromVerifiedPrefix50ActionPreparation,
  encodePrefix50ActionPreparation,
  inspectVerifiedPrefix50ActionPreparation,
  isVerifiedPrefix50ActionPreparation,
  verifyPrefix50ActionPreparation,
} from "./part-identification-prefix50-action-preparation.mjs";
import { assertPublishedCounterevidenceBoundary } from "./part-identification-prefix50-action-preparation-publication-policy.mjs";
import {
  reproduceCurrentPrefix50ActionPreparation,
  verifyCurrentPrefix50ActionPreparation,
} from "./part-identification-prefix50-action-preparation-current.mjs";
import {
  CURRENT_PREFIX50_ACTION_PREPARATION_PINS,
  PREFIX50_ACTION_PREPARATION_AUTHORITY,
  PREFIX50_ACTION_PREPARATION_OUTPUT_PATH,
  PREFIX50_ACTION_PREPARATION_SCHEMA,
} from "./part-identification-prefix50-action-preparation-source.mjs";
import { importRepositoryTypeScript } from "./part-identification-typescript-runtime.mjs";

const moduleUrl = (relativePath) => new URL(relativePath, import.meta.url).href;
const realEvidencePresent = [
  CURRENT_PREFIX50_ACTION_PREPARATION_PINS.semanticCoverage.path,
  CURRENT_PREFIX50_ACTION_PREPARATION_PINS.calloutManifest.path,
  CURRENT_PREFIX50_ACTION_PREPARATION_PINS.officialModel.path,
  PREFIX50_ACTION_PREPARATION_OUTPUT_PATH,
].every(existsSync);

function phaseMembers(step, kind) {
  return step.phases.filter((phase) => phase.kind === kind).flatMap((phase) => phase.members);
}

describe("prefix-50 action-preparation publication boundary", () => {
  it("retains published mappings and delegates exact revision selection downstream", () => {
    const rows = [
      {
        identity: "p30|q2|x84.228|y407.699",
        publishedPartNum: "28802",
        officialDesignId: "10201",
        publishedCatalogPartId: "builtin:bracket-1x2-1x4-rounded-bottom",
        occurrenceCatalogPartId: "builtin:bracket-1x2-1x4-rounded-corners",
        members: [
          [139, "10201;H"],
          [147, "10201;H"],
        ],
      },
      {
        identity: "p34|q1|x62.389|y468.271",
        publishedPartNum: "3245c",
        officialDesignId: "3245",
        publishedCatalogPartId: "builtin:brick-1x2x2-without-understud",
        occurrenceCatalogPartId: "builtin:brick-1x2x2-inside-axle-holder",
        members: [[178, "3245;M"]],
      },
      {
        identity: "p35|q2|x147.987|y481.711",
        publishedPartNum: "3245c",
        officialDesignId: "3245",
        publishedCatalogPartId: "builtin:brick-1x2x2-without-understud",
        occurrenceCatalogPartId: "builtin:brick-1x2x2-inside-axle-holder",
        members: [
          [183, "3245;M"],
          [185, "3245;M"],
        ],
      },
      {
        identity: "p36|q4|x83.269|y421.615",
        publishedPartNum: "3245c",
        officialDesignId: "3245",
        publishedCatalogPartId: "builtin:brick-1x2x2-without-understud",
        occurrenceCatalogPartId: "builtin:brick-1x2x2-inside-axle-holder",
        members: [
          [190, "3245;M"],
          [191, "3245;M"],
          [192, "3245;M"],
          [193, "3245;M"],
        ],
      },
    ];
    const artifact = {
      authority: {
        semanticIdentity: true,
        exactOccurrenceIdentity: false,
        physicalFrame: false,
        assignmentAuthority: false,
        actionAuthority: false,
        placement: false,
      },
      steps: rows.map((row) => ({
        callouts: [
          {
            identity: row.identity,
            publishedPartNum: row.publishedPartNum,
            officialDesignId: row.officialDesignId,
            catalogPartId: row.occurrenceCatalogPartId,
          },
        ],
        phases: [
          {
            members: row.members.map(([sourceBuilderIdentityOrdinal, designRevision]) => ({
              calloutIdentity: row.identity,
              sourceBuilderIdentityOrdinal,
              designRevision,
            })),
          },
        ],
      })),
    };

    expect(() => assertPublishedCounterevidenceBoundary(artifact)).toThrow(
      /must retain its published mapping/u,
    );
    for (const [index, row] of rows.entries()) {
      artifact.steps[index].callouts[0].catalogPartId = row.publishedCatalogPartId;
    }
    expect(() => assertPublishedCounterevidenceBoundary(artifact)).not.toThrow();
  });
});

describe.runIf(realEvidencePresent)("prefix-50 action preparation", () => {
  let artifact;
  let bytes;
  let input;
  let verified;
  let actionAdmission;
  let identificationTrust;

  beforeAll(async () => {
    const reproduced = await reproduceCurrentPrefix50ActionPreparation();
    artifact = reproduced.artifact;
    bytes = reproduced.bytes;
    input = reproduced.input;
    const current = await verifyCurrentPrefix50ActionPreparation();
    verified = current.verified;
    actionAdmission = await importRepositoryTypeScript(
      moduleUrl("../apps/web/e2e/real-build-action-ledger-admission.ts"),
    );
    identificationTrust = await importRepositoryTypeScript(
      moduleUrl("../apps/web/e2e/real-build-identification-trust.ts"),
    );
  }, 120_000);

  it("reproduces the exact pinned ignored artifact and complete bounded accounting", () => {
    expect(artifact.schemaVersion).toBe(PREFIX50_ACTION_PREPARATION_SCHEMA);
    expect(bytes).toHaveLength(317_152);
    expect(inspectVerifiedPrefix50ActionPreparation(verified).digest).toBe(
      "sha256:5fbab00b90c6ffbe6c9b09727819e0b3a964cebbd88138232bd2418df6100fb6",
    );
    expect(bytesFromVerifiedPrefix50ActionPreparation(verified)).toEqual(bytes);
    expect(isVerifiedPrefix50ActionPreparation(verified)).toBe(true);
    expect(artifact.accounting).toEqual({
      printedStepRows: 50,
      partBearingStepRows: 49,
      zeroPieceStepRows: 1,
      calloutRows: 187,
      physicalIdentities: 320,
      builderPhases: 95,
      directPhases: 91,
      copyPhases: 4,
      directIdentities: 309,
      copyIdentities: 11,
      repeatRows: 2,
    });
    expect(artifact.steps.map(({ stepNumber }) => stepNumber)).toEqual(
      Array.from({ length: 50 }, (_, index) => index + 1),
    );
    expect(artifact.scope).toEqual({
      firstPrintedStep: 1,
      lastPrintedStep: 50,
      expectedPrintedSteps: 359,
      sourceIndexPreserved: true,
      suffixStepsReconstructed: false,
    });
    expect(artifact.sourceIndex).toMatchObject({
      expectedPrintedSteps: 359,
      calloutRows: 881,
      partArtRows: 859,
      prefixPartArtRows: 187,
      prefixPartArtPieces: 320,
      suffixPartArtRows: 672,
      suffixStepsReconstructed: false,
    });
  });

  it("retains the exact mixed direct-master and same-step MultiBuild copies at steps 28 and 29", () => {
    const step28 = artifact.steps[27];
    expect(step28.phaseSequences).toEqual([38, 39, 40]);
    expect(step28.repeat).toMatchObject({
      identity: "p32|q2|x511.589|y390.747",
      quantity: 2,
      cropDigest: "sha256:c4db5f73f35f21c0a315cc57875abea713eae91d3217f60f878c81e673fc18c6",
      masterPhaseSequences: [39],
      copyPhaseSequences: [40],
    });
    expect(step28.callouts.find(({ elementId }) => elementId === "300526")).toMatchObject({
      quantity: 4,
      publishedPartNum: "3005",
      officialDesignId: "3005",
      publishedMatchesOfficialDesignId: true,
    });
    expect(phaseMembers(step28, "direct")).toHaveLength(4);
    expect(phaseMembers(step28, "multi-build-copy")).toHaveLength(2);

    const step29 = artifact.steps[28];
    expect(step29.phaseSequences).toEqual([41, 42, 43, 44, 45]);
    expect(step29.repeat).toMatchObject({
      identity: "p33|q4|x274.854|y340.077",
      quantity: 4,
      cropDigest: "sha256:6d8ef1b06ee10a333c566a9bd27da5271297d24e648522c2b91aba0ae7ce4db5",
      masterPhaseSequences: [41, 42],
      copyPhaseSequences: [43, 44, 45],
    });
    expect(step29.callouts.map(({ quantity }) => quantity)).toEqual([4, 4, 4]);
    expect(phaseMembers(step29, "direct")).toHaveLength(3);
    expect(phaseMembers(step29, "multi-build-copy")).toHaveLength(9);

    for (const step of [step28, step29]) {
      const direct = new Map(
        phaseMembers(step, "direct").map((member) => [member.builderBrickRef, member]),
      );
      for (const copy of phaseMembers(step, "multi-build-copy")) {
        expect(direct.get(copy.sourceBuilderBrickRef)).toMatchObject({
          elementId: copy.elementId,
          officialDesignId: copy.officialDesignId,
          designRevision: copy.designRevision,
          materialId: copy.materialId,
          calloutIdentity: copy.calloutIdentity,
        });
      }
    }
  });

  it("consumes the opaque step-31/32 partition and preserves both printed cursors", () => {
    const step31 = artifact.steps[30];
    const step32 = artifact.steps[31];
    expect(step31).toMatchObject({
      phaseSequences: [50, 51, 52],
      printedPieceCursorBefore: 180,
      printedPieceCursorAfter: 184,
      sourceBuilderIdentityOrdinals: [183, 184, 185, 186],
      orderBasis: "opaque-step31-32-reconciliation",
    });
    expect(step32).toMatchObject({
      phaseSequences: [49, 53, 54],
      printedPieceCursorBefore: 184,
      printedPieceCursorAfter: 194,
      sourceBuilderIdentityOrdinals: [181, 182, 187, 188, 189, 190, 191, 192, 193, 194],
      orderBasis: "opaque-step31-32-reconciliation",
    });
    expect(
      [...step31.sourceBuilderIdentityOrdinals, ...step32.sourceBuilderIdentityOrdinals].sort(
        (left, right) => left - right,
      ),
    ).toEqual(Array.from({ length: 14 }, (_, index) => 181 + index));
    expect(step31.callouts.find(({ elementId }) => elementId === "4618852")).toMatchObject({
      quantity: 2,
      publishedPartNum: "3245c",
      officialDesignId: "3245",
      publishedMatchesOfficialDesignId: false,
    });
  });

  it("retains printed step 44 as one exact zero-piece row without consuming a phase or identity", () => {
    const step44 = artifact.steps[43];
    expect(step44).toMatchObject({
      stepNumber: 44,
      printedPieceCursorBefore: 280,
      printedPieceCursorAfter: 280,
      printedPieces: 0,
      sourceBuilderIdentityOrdinals: [],
      phaseSequences: [],
      orderBasis: "zero-piece-printed-row",
      repeat: null,
      callouts: [],
      phases: [],
    });
  });

  it("rejects input and artifact digest tamper plus caller-shaped order tokens", async () => {
    const changedCoverage = Buffer.from(input.coverageBytes);
    changedCoverage[changedCoverage.length - 2] ^= 1;
    await expect(
      verifyPrefix50ActionPreparation({
        ...input,
        coverageBytes: changedCoverage,
        artifactBytes: bytes,
      }),
    ).rejects.toThrow(/exact pinned|valid JSON/);

    const changedArtifact = structuredClone(artifact);
    changedArtifact.steps[27].repeat.copyPhaseSequences = [39];
    await expect(
      verifyPrefix50ActionPreparation({
        ...input,
        artifactBytes: encodePrefix50ActionPreparation(changedArtifact),
      }),
    ).rejects.toThrow(/does not exactly reproduce/);
    await expect(
      verifyPrefix50ActionPreparation({
        ...input,
        artifactBytes: bytes,
        orderReconciliation: {},
      }),
    ).rejects.toThrow(/opaque step-31\/32 order verifier result/);
  });

  it("publishes preparation facts only and remains rejected by both production action consumers", () => {
    expect(artifact.authority).toEqual(PREFIX50_ACTION_PREPARATION_AUTHORITY);
    for (const key of [
      "authenticated",
      "exactOccurrenceIdentity",
      "productionActionLedger",
      "sourceExecution",
      "preparedRun",
      "physicalFrame",
      "assignmentAuthority",
      "actionAuthority",
      "placement",
      "documentMutation",
      "replay",
      "acceptedDocument",
      "completion",
    ]) {
      expect(artifact.authority[key]).toBe(false);
    }
    const serialized = JSON.stringify(artifact);
    for (const forbidden of [
      "positionLdu",
      "orientationId",
      "builderTransform",
      "canonicalTransform",
      "frameEvidenceDigest",
    ]) {
      expect(serialized).not.toContain(`"${forbidden}"`);
    }
    expect(() => inspectCurrentActionLedgerPrefix(artifact)).toThrow(/current bounded data fields/);
    expect(() =>
      actionAdmission.admitCanonicalRealBuildActionLedgerBytes({
        bytes,
        label: "Prefix-50 action preparation",
        mode: "retained-prefix",
      }),
    ).toThrow(/more than 16 members|closed current \/4 schema/);
    expect(identificationTrust.isTrustedIdentificationConfidence("prefix50-semantic-closure")).toBe(
      false,
    );
  });
});
