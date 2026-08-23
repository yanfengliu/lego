import {
  applyBuildOperations,
  canonicalDigest,
  documentStructuralHash,
  migrateDocumentTruth,
} from "@lego-studio/brick-kernel";
import type { BrickDocumentV1 } from "@lego-studio/protocol";

import { createPlacePartTransaction } from "../src/manual-commands";
import { createCanonicalPrintedStepPlacer } from "./real-build-fixed-actions";
import { applyReviewedAdditiveLegacyBuildOperations } from "./real-build-reviewed-additive-legacy-operations";
import { groupPlacementOperationsInPrintedStep } from "./real-build-safety";
import type { Step7Gate3ParentReconstructionDependencies } from "./real-build-step7-gate3-parent-reconstruction-types";

const SAFE_OBJECT_FREEZE = Object.freeze;

const placeLegacy = createCanonicalPrintedStepPlacer<BrickDocumentV1>({
  createTransaction: (base, piece) =>
    createPlacePartTransaction(base, piece as Parameters<typeof createPlacePartTransaction>[1]),
  groupOperations: (operations, step) =>
    groupPlacementOperationsInPrintedStep(
      operations as Parameters<typeof groupPlacementOperationsInPrintedStep>[0],
      step,
    ),
  applyOperations: (base, operations) =>
    applyReviewedAdditiveLegacyBuildOperations(base, operations, {
      truthDigest: canonicalDigest,
      migrateDocumentTruth,
      applyBuildOperations: (document, buildOperations) =>
        applyBuildOperations(
          document,
          buildOperations as Parameters<typeof applyBuildOperations>[1],
        ),
    }),
});

/** Private-brand authority is bound only to these concrete production implementations. */
export const STEP7_GATE3_PRODUCTION_PARENT_DEPENDENCIES: Step7Gate3ParentReconstructionDependencies =
  SAFE_OBJECT_FREEZE<Step7Gate3ParentReconstructionDependencies>({
    truthDigest: canonicalDigest,
    documentStructuralHash,
    sourcePlace: (document, witness, stepId) => {
      const placed = placeLegacy(
        document,
        witness.catalogPartId,
        witness.transform,
        witness.colorId,
        6,
        stepId,
      );
      return SAFE_OBJECT_FREEZE({ document: placed.document, stepId: placed.stepId });
    },
    migrateDocumentTruth,
  });
