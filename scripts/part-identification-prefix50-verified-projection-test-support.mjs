import { existsSync, readFileSync } from "node:fs";

import { importRepositoryTypeScript } from "./part-identification-typescript-runtime.mjs";
import { bytesFromVerifiedPrefix50ActionPreparation } from "./part-identification-prefix50-action-preparation.mjs";
import {
  CURRENT_PREFIX50_ACTION_PREPARATION_PINS,
  PREFIX50_ACTION_PREPARATION_OUTPUT_PATH,
} from "./part-identification-prefix50-action-preparation-source.mjs";
import {
  bytesFromVerifiedPrefix50OfficialWorldReconciliation,
  verifyPrefix50OfficialWorldReconciliation,
} from "./part-identification-prefix50-official-world-reconciliation.mjs";
import { reproduceCurrentPrefix50OfficialWorldReconciliation } from "./part-identification-prefix50-official-world-reconciliation-current.mjs";
import {
  PREFIX50_OFFICIAL_WORLD_RECONCILIATION_OUTPUT_PATH,
  PREFIX50_OFFICIAL_WORLD_RECONCILIATION_PINS,
} from "./part-identification-prefix50-official-world-reconciliation-source.mjs";
import { verifyCurrentPrefix50StructuralEvents } from "./part-identification-prefix50-structural-events-current.mjs";
import { PREFIX50_STRUCTURAL_EVENTS_OUTPUT_PATH } from "./part-identification-prefix50-structural-events-source.mjs";
import { createRealBuildPrefix50VerifiedProjectionReader } from "./part-identification-prefix50-verified-projection.mjs";

const OFFICIAL_MODEL_PATH = "output/official-model/vx1087034_21066_a.xml";
const BUILDER_GEOMETRY_BUNDLE_PATH = "output/real-build/builder-shell-geometry.bin";

export const realEvidencePresent =
  CURRENT_PREFIX50_ACTION_PREPARATION_PINS.expectedArtifact !== null &&
  PREFIX50_OFFICIAL_WORLD_RECONCILIATION_PINS.expectedArtifact !== null &&
  existsSync(PREFIX50_ACTION_PREPARATION_OUTPUT_PATH) &&
  existsSync(PREFIX50_OFFICIAL_WORLD_RECONCILIATION_OUTPUT_PATH) &&
  existsSync(PREFIX50_STRUCTURAL_EVENTS_OUTPUT_PATH) &&
  existsSync(OFFICIAL_MODEL_PATH) &&
  existsSync(BUILDER_GEOMETRY_BUNDLE_PATH);

const projectionModuleUrl = new URL(
  "../apps/web/e2e/real-build-prefix50-projection.ts",
  import.meta.url,
).href;
const exactCompilerModuleUrl = new URL(
  "../apps/web/e2e/real-build-prefix50-exact-compiler.ts",
  import.meta.url,
).href;
const step45RelationalModuleUrl = new URL(
  "../apps/web/e2e/real-build-prefix50-step45-relational-compilation.ts",
  import.meta.url,
).href;
const candidateSnapshotModuleUrl = new URL(
  "../apps/web/e2e/real-build-candidate-document-snapshot.ts",
  import.meta.url,
).href;
const brickKernelModuleUrl = new URL("../packages/brick-kernel/src/index.ts", import.meta.url).href;
const occurrence30SourceRepairModuleUrl = new URL(
  "../apps/web/e2e/real-build-prefix50-occurrence30-source-repair.ts",
  import.meta.url,
).href;
const step41SourceRepairModuleUrl = new URL(
  "../apps/web/e2e/real-build-prefix50-step41-source-repair.ts",
  import.meta.url,
).href;
const step41PanelFaceFixtureModuleUrl = new URL(
  "../apps/web/e2e/real-build-prefix50-step41-panel-face-fixture.ts",
  import.meta.url,
).href;
const step42SourceRepairModuleUrl = new URL(
  "../apps/web/e2e/real-build-prefix50-step42-source-repair.ts",
  import.meta.url,
).href;
const step42PanelFaceFixtureModuleUrl = new URL(
  "../apps/web/e2e/real-build-prefix50-step42-panel-face-fixture.ts",
  import.meta.url,
).href;
const step42_43SourceRepairModuleUrl = new URL(
  "../apps/web/e2e/real-build-prefix50-step42-43-source-repair.ts",
  import.meta.url,
).href;
const step42_43PanelFixtureModuleUrl = new URL(
  "../apps/web/e2e/real-build-prefix50-step42-43-panel-fixture.ts",
  import.meta.url,
).href;
const transformPolicyModuleUrl = new URL(
  "../packages/catalog/src/part-factory-support.ts",
  import.meta.url,
).href;

let fixturePromise;

async function buildCurrentPrefix50VerifiedProjectionFixture() {
  let action;
  let reconciliation;
  let structural;
  let readProjection;
  let reader;
  let projection;
  let exactCompilerModule;
  let kernel;
  let transformPolicy;
  let repairEvidence;
  let repairProposal;
  let occurrence30ActionBinding;
  const reproduced = await reproduceCurrentPrefix50OfficialWorldReconciliation();
  const verified = await verifyPrefix50OfficialWorldReconciliation({
    ...reproduced.input,
    artifactBytes: readFileSync(PREFIX50_OFFICIAL_WORLD_RECONCILIATION_OUTPUT_PATH),
  });
  action = {
    bytes: bytesFromVerifiedPrefix50ActionPreparation(reproduced.input.actionPreparation),
    verified: reproduced.input.actionPreparation,
  };
  reconciliation = {
    bytes: bytesFromVerifiedPrefix50OfficialWorldReconciliation(verified),
    verified,
  };
  structural = await verifyCurrentPrefix50StructuralEvents();
  const [
    projectionModule,
    loadedExactCompilerModule,
    step45RelationalModule,
    candidateSnapshotModule,
    brickKernelModule,
    transformPolicyModule,
    occurrence30SourceRepairModule,
    step41SourceRepairModule,
    step41PanelFaceFixtureModule,
    step42SourceRepairModule,
    step42PanelFaceFixtureModule,
    step42_43SourceRepairModule,
    step42_43PanelFixtureModule,
  ] = await Promise.all([
    importRepositoryTypeScript(projectionModuleUrl),
    importRepositoryTypeScript(exactCompilerModuleUrl),
    importRepositoryTypeScript(step45RelationalModuleUrl),
    importRepositoryTypeScript(candidateSnapshotModuleUrl),
    importRepositoryTypeScript(brickKernelModuleUrl),
    importRepositoryTypeScript(transformPolicyModuleUrl),
    importRepositoryTypeScript(occurrence30SourceRepairModuleUrl),
    importRepositoryTypeScript(step41SourceRepairModuleUrl),
    importRepositoryTypeScript(step41PanelFaceFixtureModuleUrl),
    importRepositoryTypeScript(step42SourceRepairModuleUrl),
    importRepositoryTypeScript(step42PanelFaceFixtureModuleUrl),
    importRepositoryTypeScript(step42_43SourceRepairModuleUrl),
    importRepositoryTypeScript(step42_43PanelFixtureModuleUrl),
  ]);
  exactCompilerModule = loadedExactCompilerModule;
  ({ readRealBuildPrefix50VerifiedProjection: readProjection } = projectionModule);
  reader = createRealBuildPrefix50VerifiedProjectionReader({
    actionPreparation: { bytes: action.bytes, verified: action.verified },
    officialWorldReconciliation: {
      bytes: reconciliation.bytes,
      verified: reconciliation.verified,
    },
    structuralEvents: { bytes: structural.bytes, verified: structural.verified },
  });
  projection = readProjection(reader);
  kernel = brickKernelModule;
  transformPolicy = transformPolicyModule;
  const occurrence30SourceRepairProof =
    occurrence30SourceRepairModule.verifyRealBuildPrefix50Occurrence30SourceRepair({
      officialModelBytes: readFileSync(OFFICIAL_MODEL_PATH),
      builderGeometryBundleBytes: readFileSync(BUILDER_GEOMETRY_BUNDLE_PATH),
    });
  repairEvidence =
    occurrence30SourceRepairModule.requireRealBuildPrefix50Occurrence30SourceRepairProof(
      occurrence30SourceRepairProof,
    );
  occurrence30ActionBinding =
    projectionModule.readRealBuildPrefix50Occurrence30ActionBinding(reader);
  repairProposal = exactCompilerModule.__testOnly.proposeRealBuildPrefix50Occurrence30SourceRepair(
    projection,
    repairEvidence,
    occurrence30ActionBinding,
  );
  const emptyDocument = kernel.createEmptyBrickDocument({
    id: "prefix50-real-evidence",
    name: "Prefix 50 real evidence",
  });
  let sourceRepairs;
  const loadSourceRepairs = () => {
    if (sourceRepairs === undefined) {
      const step41SourceRepairProof =
        step41SourceRepairModule.verifyRealBuildPrefix50Step41SourceRepair({
          projectionReader: reader,
          reviewedPanelFaceFixture:
            step41PanelFaceFixtureModule.REAL_BUILD_PREFIX50_STEP41_PANEL_FACE_FIXTURE,
          sourceRows: projection.occurrences.slice(265, 273),
        });
      const step42SourceRepairProof =
        step42SourceRepairModule.verifyRealBuildPrefix50Step42SourceRepair({
          projectionReader: reader,
          step41SourceRepairProof,
          reviewedPanelFaceFixture:
            step42PanelFaceFixtureModule.REAL_BUILD_PREFIX50_STEP42_PANEL_FACE_FIXTURE,
          sourceRows: projection.occurrences.slice(257, 274),
        });
      const step42_43SourceRepairProof =
        step42_43SourceRepairModule.verifyRealBuildPrefix50Step42_43SourceRepair({
          projectionReader: reader,
          reviewedPanelFixture:
            step42_43PanelFixtureModule.REAL_BUILD_PREFIX50_STEP42_43_PANEL_FIXTURE,
          sourceRows: projection.occurrences.slice(257, 280),
          step41SourceRepairProof,
          step42SourceRepairProof,
        });
      sourceRepairs = {
        step41SourceRepairProof,
        step42SourceRepairProof,
        step42_43SourceRepairProof,
      };
    }
    return sourceRepairs;
  };
  const loadSourceRepairEvidence = () => {
    const proofs = loadSourceRepairs();
    return {
      step41: step41SourceRepairModule.requireRealBuildPrefix50Step41SourceRepairProof(
        proofs.step41SourceRepairProof,
      ),
      step42: step42SourceRepairModule.requireRealBuildPrefix50Step42SourceRepairProof(
        proofs.step42SourceRepairProof,
      ),
      step42_43: step42_43SourceRepairModule.requireRealBuildPrefix50Step42_43SourceRepairProof(
        proofs.step42_43SourceRepairProof,
      ),
    };
  };
  let compilationPromise;
  const loadCompilation = () => {
    compilationPromise ??= Promise.resolve().then(() => {
      const { step41SourceRepairProof, step42SourceRepairProof, step42_43SourceRepairProof } =
        loadSourceRepairs();
      return exactCompilerModule.compileRealBuildPrefix50ExactProjection(
        {
          documentSnapshot: candidateSnapshotModule.createRealBuildCandidateDocumentSnapshot({
            canonicalDocument: kernel.canonicalBrickDocument(emptyDocument),
            expectedDocumentHash: kernel.documentStructuralHash(emptyDocument),
          }),
          projectionReader: reader,
          occurrence30SourceRepairProof,
          step41SourceRepairProof,
          step42SourceRepairProof,
          step42_43SourceRepairProof,
        },
        step45RelationalModule.compileRealBuildPrefix50Step45RelationalTransition,
      );
    });
    return compilationPromise;
  };
  return {
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
  };
}

export function loadCurrentPrefix50VerifiedProjectionFixture() {
  fixturePromise ??= buildCurrentPrefix50VerifiedProjectionFixture();
  return fixturePromise;
}
