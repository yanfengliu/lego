import { describe, expect, it } from "vitest";
import {
  createEmptyBrickDocument,
  documentStructuralHash,
  type Sha256Digest,
} from "@lego-studio/brick-kernel";

import { createRealBuildLineageIdentity } from "../e2e/real-build-candidate-lineage-identity";
import { createRealBuildPanelCameraBranchBudgetLedger } from "../e2e/real-build-panel-camera-branch-budget";
import { resolveRealBuildPanelCameraFrontier } from "../e2e/real-build-panel-camera-frontier";
import { projectRealBuildPanelCameraFrontierLineageEvidence } from "../e2e/real-build-panel-camera-frontier-lineage-adapter";
import { projectRealBuildPanelCameraLineageEvidence } from "../e2e/real-build-panel-camera-lineage-adapter";
import { resolveRealBuildPanelCameraBranches } from "../e2e/real-build-panel-camera-resolver";

function liveRoot() {
  const document = createEmptyBrickDocument({
    id: "lineage-capacity-root",
    name: "Lineage capacity root",
    maxParts: 10,
  });
  const documentHash = documentStructuralHash(document) as Sha256Digest;
  const resolution = resolveRealBuildPanelCameraBranches({
    prefix: { throughStepNumber: 0, parentLineageId: null, document, documentHash },
    registrationPanelStepNumber: 1,
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
  const root = projectRealBuildPanelCameraLineageEvidence({ resolution, parent: null })
    .attempts[0]!;
  return createRealBuildLineageIdentity({
    candidateId: root.candidateId,
    documentHash: root.documentHash,
    parent: null,
    throughStepNumber: 0,
    localIdentity: root.localIdentity,
  });
}

describe("panel-camera lineage adapter capacity", () => {
  it("projects one 8,200-attempt converged family above the 8,192 default", () => {
    const root = liveRoot();
    const parentCount = 1_025;
    const document = { parts: [{ id: "capacity" }] };
    const documentHash = `sha256:${"9".repeat(64)}` as Sha256Digest;
    const candidateId = `document:${documentHash}`;
    const parents = Array.from({ length: parentCount }, (_, index) =>
      createRealBuildLineageIdentity({
        candidateId,
        documentHash,
        parent: root,
        throughStepNumber: 1,
        localIdentity: { kind: "decision", id: `capacity-placement:${index}` },
      }),
    );
    const resolution = resolveRealBuildPanelCameraFrontier({
      prefixes: parents.map(({ lineageId }) => ({
        throughStepNumber: 1,
        parentLineageId: lineageId,
        document,
        documentHash,
      })),
      registrationPanelStepNumber: 2,
      renderModelMask: ({ hypothesis }) =>
        hypothesis.latticeHand === "as-fitted" && hypothesis.turnDegrees === 0
          ? new Uint8Array([1, 1, 0, 0])
          : new Uint8Array([1, 0, 0, 0]),
      builtMask: new Uint8Array([1, 1, 0, 0]),
      excludedMask: null,
      widthPx: 2,
      heightPx: 2,
      ledger: createRealBuildPanelCameraBranchBudgetLedger(parentCount * 8),
      hashDocument: () => documentHash,
    });
    const [evidence] = projectRealBuildPanelCameraFrontierLineageEvidence({
      resolution,
      parents,
    });
    expect(evidence!.attempts).toHaveLength(8_200);
    expect(evidence!.parents).toHaveLength(parentCount);
    expect(evidence!.selection.selectedLineageIds).toHaveLength(parentCount);
  }, 30_000);
});
