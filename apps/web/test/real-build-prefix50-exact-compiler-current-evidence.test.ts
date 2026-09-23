import { existsSync, readFileSync } from "node:fs";
import { performance } from "node:perf_hooks";

import { canonicalBrickDocument, documentStructuralHash } from "@lego-studio/brick-kernel";
import { expect, it } from "vitest";

// @ts-expect-error This opaque Node verifier intentionally has no caller-facing TS surface.
import { bytesFromVerifiedPrefix50ActionPreparation } from "../../../scripts/part-identification-prefix50-action-preparation.mjs";
// @ts-expect-error This opaque Node verifier intentionally has no caller-facing TS surface.
import { bytesFromVerifiedPrefix50OfficialWorldReconciliation } from "../../../scripts/part-identification-prefix50-official-world-reconciliation.mjs";
// @ts-expect-error This opaque Node verifier intentionally has no caller-facing TS surface.
import { verifyPrefix50OfficialWorldReconciliation } from "../../../scripts/part-identification-prefix50-official-world-reconciliation.mjs";
// @ts-expect-error This ignored-evidence reproducer intentionally has no caller-facing TS surface.
import { reproduceCurrentPrefix50OfficialWorldReconciliation } from "../../../scripts/part-identification-prefix50-official-world-reconciliation-current.mjs";
// @ts-expect-error This ignored-evidence verifier intentionally has no caller-facing TS surface.
import { verifyCurrentPrefix50StructuralEvents } from "../../../scripts/part-identification-prefix50-structural-events-current.mjs";
import { createRealBuildPrefix50VerifiedProjectionReader } from "../../../scripts/part-identification-prefix50-verified-projection.mjs";
import { createRealBuildCandidateDocumentSnapshot } from "../e2e/real-build-candidate-document-snapshot";
import { diagnoseRealBuildPrefix50VerifiedProjection } from "../e2e/real-build-prefix50-exact-compiler";
import { RealBuildPrefix50Step44ReviewRequiredError } from "../e2e/real-build-prefix50-exact-loop";
import { createRealBuildPrefix50ProductionBaseDocument } from "../e2e/real-build-prefix50-production-base";
import { exportRealBuildPrefix50Step44ReturnReviewArtifacts } from "../e2e/real-build-prefix50-subbuild-return-review-export";
import { verifyRealBuildPrefix50Occurrence30SourceRepair } from "../e2e/real-build-prefix50-occurrence30-source-repair";
import { readRealBuildPrefix50VerifiedProjection } from "../e2e/real-build-prefix50-projection";
import { REAL_BUILD_PREFIX50_STEP41_PANEL_FACE_FIXTURE } from "../e2e/real-build-prefix50-step41-panel-face-fixture";
import { verifyRealBuildPrefix50Step41SourceRepair } from "../e2e/real-build-prefix50-step41-source-repair";
import { REAL_BUILD_PREFIX50_STEP42_43_PANEL_FIXTURE } from "../e2e/real-build-prefix50-step42-43-panel-fixture";
import { verifyRealBuildPrefix50Step42_43SourceRepair } from "../e2e/real-build-prefix50-step42-43-source-repair";
import { REAL_BUILD_PREFIX50_STEP42_PANEL_FACE_FIXTURE } from "../e2e/real-build-prefix50-step42-panel-face-fixture";
import { verifyRealBuildPrefix50Step42SourceRepair } from "../e2e/real-build-prefix50-step42-source-repair";

const OFFICIAL_MODEL_PATH = "output/official-model/vx1087034_21066_a.xml";
const BUILDER_GEOMETRY_PATH = "output/real-build/builder-shell-geometry.bin";
const REAL_EVIDENCE_PATHS = [
  OFFICIAL_MODEL_PATH,
  BUILDER_GEOMETRY_PATH,
  "output/part-identification/prefix50-semantic-closure.json",
  "output/real-build/action-preparation.json",
  "output/real-build/prefix50-official-ldraw-world-proposal.json",
  "output/real-build/prefix50-ldraw-catalog-frames.json",
  "output/real-build/prefix50-official-world-reconciliation.json",
  "output/real-build/prefix50-structural-events.json",
] as const;

const hasRealEvidence = REAL_EVIDENCE_PATHS.every((path) => existsSync(path));

it.runIf(hasRealEvidence)(
  "reaches the authority-free Step-44 return boundary without minting completion or reading a suffix",
  async () => {
    const startedAt = performance.now();
    let previousPhaseAt = startedAt;
    const markPhase = (phase: string): void => {
      const observedAt = performance.now();
      console.log(
        "PREFIX50_CURRENT_EVIDENCE_PHASE",
        JSON.stringify({
          phase,
          deltaMs: Math.round(observedAt - previousPhaseAt),
          elapsedMs: Math.round(observedAt - startedAt),
        }),
      );
      previousPhaseAt = observedAt;
    };
    const reproduced = await reproduceCurrentPrefix50OfficialWorldReconciliation();
    const reconciliation = await verifyPrefix50OfficialWorldReconciliation({
      ...reproduced.input,
      artifactBytes: reproduced.bytes,
    });
    const structural = await verifyCurrentPrefix50StructuralEvents();
    markPhase("reconciliation-verified");
    const projectionReader = createRealBuildPrefix50VerifiedProjectionReader({
      actionPreparation: {
        bytes: bytesFromVerifiedPrefix50ActionPreparation(reproduced.input.actionPreparation),
        verified: reproduced.input.actionPreparation,
      },
      officialWorldReconciliation: {
        bytes: bytesFromVerifiedPrefix50OfficialWorldReconciliation(reconciliation),
        verified: reconciliation,
      },
      structuralEvents: { bytes: structural.bytes, verified: structural.verified },
    });
    const occurrence30SourceRepairProof = verifyRealBuildPrefix50Occurrence30SourceRepair({
      officialModelBytes: readFileSync(OFFICIAL_MODEL_PATH),
      builderGeometryBundleBytes: readFileSync(BUILDER_GEOMETRY_PATH),
    });
    const projection = readRealBuildPrefix50VerifiedProjection(projectionReader);
    const step41SourceRepairProof = verifyRealBuildPrefix50Step41SourceRepair({
      projectionReader,
      reviewedPanelFaceFixture: REAL_BUILD_PREFIX50_STEP41_PANEL_FACE_FIXTURE,
      sourceRows: projection.occurrences.slice(265, 273),
    });
    const step42SourceRepairProof = verifyRealBuildPrefix50Step42SourceRepair({
      projectionReader,
      step41SourceRepairProof,
      reviewedPanelFaceFixture: REAL_BUILD_PREFIX50_STEP42_PANEL_FACE_FIXTURE,
      sourceRows: projection.occurrences.slice(257, 274),
    });
    const step42_43SourceRepairProof = verifyRealBuildPrefix50Step42_43SourceRepair({
      projectionReader,
      reviewedPanelFixture: REAL_BUILD_PREFIX50_STEP42_43_PANEL_FIXTURE,
      sourceRows: projection.occurrences.slice(257, 280),
      step41SourceRepairProof,
      step42SourceRepairProof,
    });
    markPhase("projection-and-repairs-ready");
    const emptyDocument = createRealBuildPrefix50ProductionBaseDocument();
    expect(emptyDocument.truth.catalog.version).toBe("builtin.basic-parts/30");

    let observed: unknown;
    let diagnostic: ReturnType<typeof diagnoseRealBuildPrefix50VerifiedProjection> | undefined;
    markPhase("compiler-start");
    try {
      diagnostic = diagnoseRealBuildPrefix50VerifiedProjection({
        documentSnapshot: createRealBuildCandidateDocumentSnapshot({
          canonicalDocument: canonicalBrickDocument(emptyDocument),
          expectedDocumentHash: documentStructuralHash(emptyDocument),
        }),
        occurrence30SourceRepairProof,
        projectionReader,
        step41SourceRepairProof,
        step42SourceRepairProof,
        step42_43SourceRepairProof,
      });
    } catch (error) {
      observed = error;
    }
    if (observed === undefined) {
      throw new Error(`Unexpected prefix-50 diagnostic: ${JSON.stringify(diagnostic)}.`);
    }
    if (!(observed instanceof RealBuildPrefix50Step44ReviewRequiredError)) {
      throw observed;
    }
    markPhase("compiler-return-boundary");
    const result = (observed as RealBuildPrefix50Step44ReviewRequiredError).result;
    expect(result).toMatchObject({
      schemaVersion: "lego.real-build-prefix50-subbuild-return/1",
      authority: "none",
      sourceSetId: "6651557",
      completedPrintedStep: 43,
      returnPrintedStepNumber: 44,
      parentPartCount: 257,
      childPartCount: 23,
    });
    expect(result.enumeration.counts.accepted).toBe(211);
    expect(result.enumeration.candidates).toHaveLength(211);
    expect(result.candidateRoster).toHaveLength(211);
    const rosterKeys = result.candidateRoster.map(({ candidateKey }) => candidateKey);
    const candidateKeys = result.enumeration.candidates.map(({ candidateKey }) => candidateKey);
    expect(new Set(rosterKeys).size).toBe(211);
    expect(new Set(candidateKeys).size).toBe(211);
    expect([...rosterKeys].sort()).toEqual([...candidateKeys].sort());
    expect(rosterKeys.every((candidateKey) => /^[0-9a-f]{64}$/u.test(candidateKey))).toBe(true);
    expect(
      result.enumeration.candidates.every(
        ({ hardValidDocument, validationReport }) =>
          validationReport.documentGloballyValid &&
          validationReport.targetDocumentHash === documentStructuralHash(hardValidDocument),
      ),
    ).toBe(true);
    expect(observed.enumerationError).toMatchObject({
      code: "AMBIGUOUS_RETURN_REQUIRES_VISUAL_BINDING",
      result,
    });
    expect(JSON.stringify(observed)).not.toContain("step 51");
    markPhase("export-start");
    const exported = await exportRealBuildPrefix50Step44ReturnReviewArtifacts(result);
    markPhase("export-complete");
    expect(exported.index).toMatchObject({
      returnResultCommitment: result.commitment,
      candidateRosterCommitment: result.candidateRosterCommitment,
      candidateCount: 211,
    });
    console.log(
      "PREFIX50_STEP44_RETURN_RECEIPT",
      JSON.stringify({
        returnResultCommitment: result.commitment,
        candidateRosterCommitment: result.candidateRosterCommitment,
        sourceDocumentHash: result.sourceDocumentHash,
        candidateCount: result.candidateRoster.length,
        expectedHarnessInputBytesHash: exported.index.expectedHarnessInputBytesHash,
        reviewExportIndexPath: exported.indexPath,
        rosterSummaryPath: exported.rosterPath,
        reviewBatchPath: exported.batchPath,
      }),
    );
  },
  900_000,
);
