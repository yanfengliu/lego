import { existsSync, readFileSync } from "node:fs";

import {
  canonicalBrickDocument,
  createEmptyBrickDocument,
  documentStructuralHash,
} from "@lego-studio/brick-kernel";
import { expect, it } from "vitest";

// @ts-expect-error This opaque Node verifier intentionally has no caller-facing TS surface.
import { bytesFromVerifiedPrefix50ActionPreparation } from "../../../scripts/part-identification-prefix50-action-preparation.mjs";
// @ts-expect-error This opaque Node verifier intentionally has no caller-facing TS surface.
import { bytesFromVerifiedPrefix50OfficialWorldReconciliation } from "../../../scripts/part-identification-prefix50-official-world-reconciliation.mjs";
// @ts-expect-error This opaque Node verifier intentionally has no caller-facing TS surface.
import { verifyPrefix50OfficialWorldReconciliation } from "../../../scripts/part-identification-prefix50-official-world-reconciliation.mjs";
// @ts-expect-error This ignored-evidence reproducer intentionally has no caller-facing TS surface.
import { reproduceCurrentPrefix50OfficialWorldReconciliation } from "../../../scripts/part-identification-prefix50-official-world-reconciliation-current.mjs";
import { createRealBuildPrefix50VerifiedProjectionReader } from "../../../scripts/part-identification-prefix50-verified-projection.mjs";
import { createRealBuildCandidateDocumentSnapshot } from "../e2e/real-build-candidate-document-snapshot";
import { diagnoseRealBuildPrefix50VerifiedProjection } from "../e2e/real-build-prefix50-exact-compiler";
import { verifyRealBuildPrefix50Occurrence30SourceRepair } from "../e2e/real-build-prefix50-occurrence30-source-repair";

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
] as const;

const hasRealEvidence = REAL_EVIDENCE_PATHS.every((path) => existsSync(path));

it.runIf(hasRealEvidence)(
  "reports the current catalog/29 selected-path blocker without minting completion or reading a suffix",
  async () => {
    const reproduced = await reproduceCurrentPrefix50OfficialWorldReconciliation();
    const reconciliation = await verifyPrefix50OfficialWorldReconciliation({
      ...reproduced.input,
      artifactBytes: reproduced.bytes,
    });
    const projectionReader = createRealBuildPrefix50VerifiedProjectionReader({
      actionPreparation: {
        bytes: bytesFromVerifiedPrefix50ActionPreparation(reproduced.input.actionPreparation),
        verified: reproduced.input.actionPreparation,
      },
      officialWorldReconciliation: {
        bytes: bytesFromVerifiedPrefix50OfficialWorldReconciliation(reconciliation),
        verified: reconciliation,
      },
    });
    const occurrence30SourceRepairProof = verifyRealBuildPrefix50Occurrence30SourceRepair({
      officialModelBytes: readFileSync(OFFICIAL_MODEL_PATH),
      builderGeometryBundleBytes: readFileSync(BUILDER_GEOMETRY_PATH),
    });
    const emptyDocument = createEmptyBrickDocument({
      id: "prefix50-current-diagnostic",
      name: "Prefix 50 current diagnostic",
    });
    expect(emptyDocument.truth.catalog.version).toBe("builtin.basic-parts/29");

    const diagnostic = diagnoseRealBuildPrefix50VerifiedProjection({
      documentSnapshot: createRealBuildCandidateDocumentSnapshot({
        canonicalDocument: canonicalBrickDocument(emptyDocument),
        expectedDocumentHash: documentStructuralHash(emptyDocument),
      }),
      occurrence30SourceRepairProof,
      projectionReader,
    });

    expect(diagnostic).toMatchObject({
      schemaVersion: "lego.real-build-prefix50-selected-path-diagnostic/1",
      placementAuthority: false,
      completionAuthority: false,
      documentAuthority: false,
      publicationAuthority: false,
      searchScope: {
        committedPrefixSelection: "first-locally-complete-order-per-step",
        currentStepBacktracking: "within-step-only",
        crossStepBacktracking: false,
        nodeBudget: "cumulative-across-prefix",
      },
      outcome: "selected-committed-prefix-within-step-blocker",
      blocker: {
        printedStepNumber: 29,
        occurrenceOrdinal: 165,
        catalogPartId: "builtin:jumper-plate-1x2",
        baseStepCount: 28,
      },
      observation: {
        completedPrintedStep: 28,
        compiledStepCount: 28,
        enumerationCount: 749,
        searchNodeCount: 256,
      },
    });
    expect(diagnostic.blocker?.printedStepNumber).toBeLessThanOrEqual(50);
    expect(JSON.stringify(diagnostic)).not.toContain("step 51");
  },
  360_000,
);
