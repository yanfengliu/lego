import { readFileSync } from "node:fs";

import { canonicalBrickDocument, documentStructuralHash } from "@lego-studio/brick-kernel";

import { createRealBuildCandidateDocumentSnapshot } from "./real-build-candidate-document-snapshot.ts";
import { diagnoseRealBuildPrefix50VerifiedProjection } from "./real-build-prefix50-exact-compiler.ts";
import { RealBuildPrefix50Step44ReviewRequiredError } from "./real-build-prefix50-exact-loop-contract.ts";
import { createRealBuildPrefix50ProductionBaseDocument } from "./real-build-prefix50-production-base.ts";
import { verifyRealBuildPrefix50Occurrence30SourceRepair } from "./real-build-prefix50-occurrence30-source-repair.ts";
import { readRealBuildPrefix50VerifiedProjection } from "./real-build-prefix50-projection.ts";
import { REAL_BUILD_PREFIX50_STEP41_PANEL_FACE_FIXTURE } from "./real-build-prefix50-step41-panel-face-fixture.ts";
import { verifyRealBuildPrefix50Step41SourceRepair } from "./real-build-prefix50-step41-source-repair.ts";
import { REAL_BUILD_PREFIX50_STEP42_43_PANEL_FIXTURE } from "./real-build-prefix50-step42-43-panel-fixture.ts";
import { verifyRealBuildPrefix50Step42_43SourceRepair } from "./real-build-prefix50-step42-43-source-repair.ts";
import { REAL_BUILD_PREFIX50_STEP42_PANEL_FACE_FIXTURE } from "./real-build-prefix50-step42-panel-face-fixture.ts";
import { verifyRealBuildPrefix50Step42SourceRepair } from "./real-build-prefix50-step42-source-repair.ts";
import { reproduceRealBuildPrefix50Step42SourceGeometryAuthority } from "./real-build-prefix50-step42-source-geometry-reproduction.ts";
import {
  type RealBuildPrefix50SubBuildReturnResult,
  type RealBuildPrefix50SubBuildReturnReviewBatchEnvelope,
} from "./real-build-prefix50-subbuild-return-contract.ts";
import { createRealBuildPrefix50SubBuildReturnReviewBatchEnvelope } from "./real-build-prefix50-subbuild-return-runtime.ts";

const OFFICIAL_MODEL_PATH = "output/official-model/vx1087034_21066_a.xml";
const BUILDER_GEOMETRY_PATH = "output/real-build/builder-shell-geometry.bin";
export interface RealBuildPrefix50Step44ProductionMaterials {
  readonly result: RealBuildPrefix50SubBuildReturnResult;
  readonly batch: RealBuildPrefix50SubBuildReturnReviewBatchEnvelope;
  readonly sourceGeometryAdmission: Awaited<
    ReturnType<typeof reproduceRealBuildPrefix50Step42SourceGeometryAuthority>
  >["sourceGeometryAdmission"];
}

/**
 * Replays the exact current source-evidence path to the authority-free Step-44 boundary.
 * The returned result carries the runtime enumeration brand promotion requires; parsed JSON
 * cannot substitute for this reproduction.
 */
export async function rederiveRealBuildPrefix50Step44ProductionMaterials(): Promise<RealBuildPrefix50Step44ProductionMaterials> {
  const { projectionReader, sourceGeometryAdmission } =
    await reproduceRealBuildPrefix50Step42SourceGeometryAuthority();
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
  const emptyDocument = createRealBuildPrefix50ProductionBaseDocument();
  let result: RealBuildPrefix50SubBuildReturnResult;
  try {
    const diagnostic = diagnoseRealBuildPrefix50VerifiedProjection({
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
    throw new TypeError(
      `Step-44 source-locked production did not stop at its review boundary: ${JSON.stringify(diagnostic)}.`,
    );
  } catch (error) {
    if (!(error instanceof RealBuildPrefix50Step44ReviewRequiredError)) throw error;
    result = error.result;
  }
  return {
    result,
    batch: createRealBuildPrefix50SubBuildReturnReviewBatchEnvelope(result),
    sourceGeometryAdmission,
  };
}
