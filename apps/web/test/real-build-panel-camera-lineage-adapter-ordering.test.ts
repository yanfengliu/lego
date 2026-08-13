import { describe, expect, it } from "vitest";
import {
  createEmptyBrickDocument,
  documentStructuralHash,
  type Sha256Digest,
} from "@lego-studio/brick-kernel";

import { createRealBuildPanelCameraBranchBudgetLedger } from "../e2e/real-build-panel-camera-branch-budget";
import { projectRealBuildPanelCameraLineageEvidence } from "../e2e/real-build-panel-camera-lineage-adapter";
import { resolveRealBuildPanelCameraBranches } from "../e2e/real-build-panel-camera-resolver";

function seededAtPanel(registrationPanelStepNumber: number) {
  const document = createEmptyBrickDocument({
    id: `ordering-${registrationPanelStepNumber}`,
    name: "Ordering",
    maxParts: 10,
  });
  const documentHash = documentStructuralHash(document) as Sha256Digest;
  return resolveRealBuildPanelCameraBranches({
    prefix: { throughStepNumber: 0, parentLineageId: null, document, documentHash },
    registrationPanelStepNumber,
    renderModelMask: () => {
      throw new Error("seed must not render");
    },
    builtMask: new Uint8Array(1),
    excludedMask: null,
    widthPx: 1,
    heightPx: 1,
    ledger: createRealBuildPanelCameraBranchBudgetLedger(8),
    hashDocument: () => documentHash,
  });
}

describe("panel-camera lineage adapter validation ordering", () => {
  it("rejects a genuine printed panel above 359 before root attempt projection", () => {
    expect(() =>
      projectRealBuildPanelCameraLineageEvidence({
        resolution: seededAtPanel(360),
        parent: null,
      }),
    ).toThrow(/registration panel 1\.\.359/u);
  });

  it("snapshots and rejects an invalid tie policy before root attempt projection", () => {
    expect(() =>
      projectRealBuildPanelCameraLineageEvidence({
        resolution: seededAtPanel(1),
        parent: null,
        tiePolicy: {
          metric: "forged",
          direction: "higher-is-better",
          minimumScore: 0,
          minimumMargin: 0,
          exactTie: "refuse",
        } as never,
      }),
    ).toThrow(/tiePolicy must use panel-agreement\/1/u);
  });
});
