import { dispatchRealBuildPrefix50Step44BlindBatch } from "./real-build-prefix50-subbuild-return-review-batch-dispatch.ts";
import { sha256RealBuildPrefix50Step44BlindBytes } from "./real-build-prefix50-subbuild-return-review-blind.ts";
import { deriveRealBuildPrefix50Step44Page45CameraInstrument } from "./real-build-prefix50-subbuild-return-review-camera.ts";
import { writeRealBuildPrefix50Step44ReviewContactSheets } from "./real-build-prefix50-subbuild-return-review-contact-sheet.ts";
import {
  REAL_BUILD_PREFIX50_STEP44_PUBLICATION_COMPLETE_FILE,
  runRealBuildPrefix50Step44ReviewTransaction,
  type RealBuildPrefix50Step44TransactionDefinition,
} from "./real-build-prefix50-subbuild-return-review-transaction.ts";
import type { RealBuildPrefix50SubBuildReturnReviewBatchEnvelope } from "./real-build-prefix50-subbuild-return-contract.ts";
import type { RealBuildPrefix50Step44RealDomainQualificationBinding } from "./real-build-prefix50-subbuild-return-review-camera-real-domain-gate-evidence.ts";

const PUBLIC_MANIFEST_FILE = "real-build-prefix50-step44-public-batch-manifest.json";
const WITHHELD_MANIFEST_FILE = "real-build-prefix50-step44-withheld-batch-capture-manifest.json";
const SUCCESS_FILE = "real-build-prefix50-step44-public-harness-success.json";
const DISPATCH_PLAN_FILE = "real-build-prefix50-step44-blind-dispatch-plan.json";

type ProductionContact = Awaited<
  ReturnType<typeof writeRealBuildPrefix50Step44ReviewContactSheets>
>;

const PRODUCTION_DEFINITION_BODY: RealBuildPrefix50Step44TransactionDefinition<ProductionContact> =
  {
    mode: "production-211",
    captureCount: 211,
    publicManifestFile: PUBLIC_MANIFEST_FILE,
    withheldManifestFile: WITHHELD_MANIFEST_FILE,
    successFile: SUCCESS_FILE,
    completeFile: REAL_BUILD_PREFIX50_STEP44_PUBLICATION_COMPLETE_FILE,
    deriveCamera: deriveRealBuildPrefix50Step44Page45CameraInstrument,
    dispatch: dispatchRealBuildPrefix50Step44BlindBatch,
    composeContact: writeRealBuildPrefix50Step44ReviewContactSheets,
    publicManifestBody: ({ contact }) => ({
      schemaVersion: "lego.real-build-prefix50-step44-public-blind-batch/1" as const,
      authority: "none" as const,
      selectionAuthority: false as const,
      fixturePromotionAuthority: false as const,
      sourceSetId: "6651557" as const,
      sourcePdfArtifactPath: contact.index.reference.sourcePdfArtifactPath,
      sourcePdfDigest: contact.index.reference.sourcePdfDigest,
      page45SourcePolicyCommitment: contact.index.page45SourcePolicyCommitment,
      candidateCount: 211 as const,
      blindIds: contact.index.blindIds,
      reviewIsolationInstructionFile: contact.index.reviewIsolationInstructionFile,
      reviewIsolationInstructionDigest: contact.index.reviewIsolationInstructionDigest,
      referenceArtifactFile: contact.index.reference.artifactFile,
      referenceCommitment: contact.index.reference.commitment,
      blindReviewPacketFile: contact.indexFile,
      blindReviewPacketByteDigest: contact.byteDigest,
      blindReviewPacketCommitment: contact.index.commitment,
      withheldUnblindingMapCommitment: contact.withheldMap.commitment,
      contactSheetPageCommitments: contact.index.pages.map(({ commitment }) => commitment),
    }),
    withheldManifestBody: ({
      inputBytesHash,
      batch,
      plan,
      planBytes,
      captures,
      contact,
      publicManifest,
    }) => ({
      schemaVersion: "lego.real-build-prefix50-step44-withheld-batch-capture/1" as const,
      authority: "none" as const,
      publicDuringReview: false as const,
      sourceSetId: "6651557" as const,
      expectedHarnessInputBytesHash: inputBytesHash,
      reviewBatchEnvelopeCommitment: batch.commitment,
      candidateRosterCommitment: batch.candidateRosterCommitment,
      candidateKeysCommitment: batch.candidateKeysCommitment,
      dispatchPlanFile: DISPATCH_PLAN_FILE,
      dispatchPlanByteDigest: sha256RealBuildPrefix50Step44BlindBytes(planBytes),
      dispatchPlanCommitment: plan.commitment,
      captures,
      publicManifest,
      publicPacketCoreCommitment: contact.index.publicPacketCoreCommitment,
      publicPacketCommitment: contact.index.commitment,
      withheldUnblindingMapFile: contact.withheldMapFile,
      withheldUnblindingMapByteDigest: contact.withheldMapByteDigest,
      withheldUnblindingMapCommitment: contact.withheldMap.commitment,
    }),
    successBody: ({ publicManifest, withheldManifest, contact, cleanup }) => ({
      schemaVersion: "lego.real-build-prefix50-step44-public-harness-success/1" as const,
      authority: "none" as const,
      status: "complete" as const,
      selectionAuthority: false as const,
      fixturePromotionAuthority: false as const,
      sourceSetId: "6651557" as const,
      sourcePdfArtifactPath: contact.index.reference.sourcePdfArtifactPath,
      sourcePdfDigest: contact.index.reference.sourcePdfDigest,
      page45SourcePolicyCommitment: contact.index.page45SourcePolicyCommitment,
      candidateCount: 211 as const,
      capturedCandidateCount: 211 as const,
      publicManifestFile: PUBLIC_MANIFEST_FILE,
      publicManifestByteDigest: publicManifest.byteDigest,
      publicManifestCommitment: publicManifest.commitment,
      withheldManifestFile: WITHHELD_MANIFEST_FILE,
      withheldManifestByteDigest: withheldManifest.byteDigest,
      withheldManifestCommitment: withheldManifest.commitment,
      blindReviewPacketFile: contact.indexFile,
      blindReviewPacketByteDigest: contact.byteDigest,
      blindReviewPacketCommitment: contact.index.commitment,
      cleanup,
    }),
    completeBody: ({
      inputBytesHash,
      batch,
      publicManifest,
      withheldManifest,
      success,
      contact,
      cleanup,
      publicationDirectories,
    }) => ({
      schemaVersion: "lego.real-build-prefix50-step44-publication-complete/2" as const,
      authority: "none" as const,
      status: "complete" as const,
      selectionAuthority: false as const,
      fixturePromotionAuthority: false as const,
      sourceSetId: "6651557" as const,
      sourcePdfArtifactPath: contact.index.reference.sourcePdfArtifactPath,
      sourcePdfDigest: contact.index.reference.sourcePdfDigest,
      page45SourcePolicyCommitment: contact.index.page45SourcePolicyCommitment,
      expectedHarnessInputBytesHash: inputBytesHash,
      reviewBatchEnvelopeCommitment: batch.commitment,
      candidateRosterCommitment: batch.candidateRosterCommitment,
      candidateKeysCommitment: batch.candidateKeysCommitment,
      candidateCount: 211 as const,
      capturedCandidateCount: 211 as const,
      publicDirectory: "public" as const,
      withheldDirectory: "withheld" as const,
      publicationDirectories,
      publicManifestFile: publicManifest.artifactFile,
      publicManifestByteDigest: publicManifest.byteDigest,
      publicManifestCommitment: publicManifest.commitment,
      withheldManifestFile: withheldManifest.artifactFile,
      withheldManifestByteDigest: withheldManifest.byteDigest,
      withheldManifestCommitment: withheldManifest.commitment,
      publicSuccessFile: success.artifactFile,
      publicSuccessByteDigest: success.byteDigest,
      publicSuccessCommitment: success.commitment,
      cleanup,
    }),
  };
const PRODUCTION_DEFINITION = Object.freeze(PRODUCTION_DEFINITION_BODY);

export function readRealBuildPrefix50Step44ProductionTransactionBindingForTest() {
  if (process.env.NODE_ENV !== "test")
    throw new TypeError("Step-44 production transaction binding is readable only in tests.");
  return Object.freeze({
    sharedTransactionRunner: runRealBuildPrefix50Step44ReviewTransaction,
    definition: PRODUCTION_DEFINITION,
    cameraDependency: deriveRealBuildPrefix50Step44Page45CameraInstrument,
    dispatchDependency: dispatchRealBuildPrefix50Step44BlindBatch,
    contactDependency: writeRealBuildPrefix50Step44ReviewContactSheets,
  });
}

export async function runRealBuildPrefix50Step44ProductionTransaction(input: {
  readonly outputPath: string;
  readonly repositoryRoot: string;
  readonly inputBytesHash: `sha256:${string}`;
  readonly batch: RealBuildPrefix50SubBuildReturnReviewBatchEnvelope;
  readonly realDomainQualification: RealBuildPrefix50Step44RealDomainQualificationBinding;
}) {
  return runRealBuildPrefix50Step44ReviewTransaction({
    ...input,
    definition: PRODUCTION_DEFINITION,
  });
}
