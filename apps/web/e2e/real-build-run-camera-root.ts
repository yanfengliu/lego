import type { Sha256Digest } from "@lego-studio/brick-kernel";

import { createRealBuildPanelCameraBranchBudgetLedger } from "./real-build-panel-camera-branches";
import { projectRealBuildPanelCameraResolutionEvidence } from "./real-build-panel-camera-evidence";
import { resolveRealBuildPanelCameraBranches } from "./real-build-panel-camera-resolver";
import type { RealBuildStepReport } from "./real-build-safety";

type RootDocument = { readonly parts: readonly unknown[] };

/** Retains all eight empty-root D4 camera histories before any panel or placement callback. */
export function createRealBuildRunRootPanelCamera<D extends RootDocument>(input: {
  readonly document: D;
  readonly documentHash: Sha256Digest;
  readonly branchBudget: number;
  readonly hashDocument: (document: D) => Sha256Digest;
}): NonNullable<RealBuildStepReport["panelCamera"]> {
  const ledger = createRealBuildPanelCameraBranchBudgetLedger(input.branchBudget);
  return projectRealBuildPanelCameraResolutionEvidence(
    resolveRealBuildPanelCameraBranches({
      prefix: {
        throughStepNumber: 0,
        parentLineageId: null,
        document: input.document,
        documentHash: input.documentHash,
      },
      registrationPanelStepNumber: 1,
      renderModelMask: () => new Uint8Array(1),
      builtMask: new Uint8Array(1),
      excludedMask: null,
      widthPx: 1,
      heightPx: 1,
      ledger,
      hashDocument: input.hashDocument,
    }),
  );
}
