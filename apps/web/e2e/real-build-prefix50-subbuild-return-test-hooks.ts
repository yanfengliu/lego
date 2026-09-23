import { enumerateRigidSubassemblyReturns } from "../src/assembly/rigid-subassembly-return";
import { intrinsicRealBuildFreeze } from "./real-build-intrinsic-freeze";
import type {
  RealBuildPrefix50Step43ReturnPredecessorMintInput,
  RealBuildPrefix50SubBuildReturnInput,
  RealBuildPrefix50SubBuildReturnResult,
  RealBuildPrefix50SubBuildReturnReviewBatchEnvelope,
  RealBuildPrefix50SubBuildReturnReviewHarnessEnvelope,
  RealBuildPrefix50SubBuildReturnReviewRosterSummary,
} from "./real-build-prefix50-subbuild-return-contract";
import {
  verifyRepositoryRealBuildPrefix50Step44ReviewArtifacts,
  type RealBuildPrefix50Step44ArtifactVerificationOptions,
} from "./real-build-prefix50-subbuild-return-review-artifacts";
import type { RealBuildPrefix50Step44ReviewedReturnFixture } from "./real-build-prefix50-subbuild-return-review-fixture";
import { __testOnlyPredecessor } from "./real-build-prefix50-subbuild-return-predecessor";

type Enumerator = typeof enumerateRigidSubassemblyReturns;
type Construct = (
  input: RealBuildPrefix50SubBuildReturnInput,
  enumerate: Enumerator,
) => RealBuildPrefix50SubBuildReturnResult;
type CreateEnvelope = (
  resultValue: unknown,
  candidateKey: string,
) => RealBuildPrefix50SubBuildReturnReviewHarnessEnvelope;
type CreateReviewExportMaterials = (resultValue: unknown) => {
  readonly result: RealBuildPrefix50SubBuildReturnResult;
  readonly rosterSummary: RealBuildPrefix50SubBuildReturnReviewRosterSummary;
  readonly reviewBatch: RealBuildPrefix50SubBuildReturnReviewBatchEnvelope;
};

export function createRealBuildPrefix50SubBuildReturnTestHooks(
  construct: Construct,
  brandResult: (
    result: RealBuildPrefix50SubBuildReturnResult,
  ) => RealBuildPrefix50SubBuildReturnResult,
  createEnvelope: CreateEnvelope,
  createReviewExportMaterials: CreateReviewExportMaterials,
) {
  return intrinsicRealBuildFreeze({
    constructWithEnumerator: construct,
    constructSyntheticWithEnumerator: (
      input: Omit<RealBuildPrefix50Step43ReturnPredecessorMintInput, "step42_43SourceRepairProof">,
      enumerate: Enumerator,
    ) => {
      const mintSynthetic = __testOnlyPredecessor.mintSynthetic;
      if (mintSynthetic === undefined)
        throw new TypeError("Synthetic Step-43 predecessor test hook is unavailable.");
      return construct({ predecessor: mintSynthetic(input) }, enumerate);
    },
    mintSyntheticPredecessorForTest: (
      input: Omit<RealBuildPrefix50Step43ReturnPredecessorMintInput, "step42_43SourceRepairProof">,
    ) => {
      const mintSynthetic = __testOnlyPredecessor.mintSynthetic;
      if (mintSynthetic === undefined)
        throw new TypeError("Synthetic Step-43 predecessor test hook is unavailable.");
      return mintSynthetic(input);
    },
    brandReturnResultForReviewTests: brandResult,
    createCandidateReviewEnvelopeForTest: createEnvelope,
    createReviewExportMaterialsForTest: createReviewExportMaterials,
    selectWithReviewedFixtureForTest: async (
      resultValue: unknown,
      fixture: RealBuildPrefix50Step44ReviewedReturnFixture,
      artifactOptions: RealBuildPrefix50Step44ArtifactVerificationOptions,
    ) => {
      const envelope = createEnvelope(resultValue, fixture.candidateKey);
      await verifyRepositoryRealBuildPrefix50Step44ReviewArtifacts(
        fixture,
        envelope,
        artifactOptions,
      );
      throw new TypeError(
        "Step-44 legacy fixture selection is disabled; use the persisted blind promotion route.",
      );
    },
    selectWithPromotedFixtureForTest: (
      _resultValue: unknown,
      _fixture: RealBuildPrefix50Step44ReviewedReturnFixture,
    ) => {
      void _resultValue;
      void _fixture;
      throw new TypeError(
        "Step-44 reviewStatus cannot mint selection; use the persisted blind promotion route.",
      );
    },
  });
}

export type RealBuildPrefix50SubBuildReturnTestHooks = ReturnType<
  typeof createRealBuildPrefix50SubBuildReturnTestHooks
>;
