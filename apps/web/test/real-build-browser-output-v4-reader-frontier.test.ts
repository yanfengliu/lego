import { describe, expect, it } from "vitest";

import { createRealBuildCandidateDocumentSnapshot } from "../e2e/real-build-candidate-document-snapshot";
import { bindRealBuildExactRootLineageIdentity } from "../e2e/real-build-exact-lineage-identity";
import {
  advanceRealBuildBrowserOutputV4PlacementFrontier,
  bindRealBuildBrowserOutputV4PlacementRoots,
} from "../e2e/real-build-browser-output-v4-reader-frontier";
import type { RealBuildBrowserBranchDetailedStepInspection } from "../e2e/real-build-browser-output-v4-semantic";
import { createRealBuildBrowserOutputV4TransitionFrontier } from "../e2e/real-build-browser-output-v4-transition-frontier";
import { compiledObservationClosureFixture } from "./real-build-compiled-observation-closure.fixture";

function fixture(mode: "selected" | "failed" = "selected") {
  const compiled = compiledObservationClosureFixture(mode);
  const root = compiled.lineage.rootCandidates[0]!;
  const documentSnapshot = createRealBuildCandidateDocumentSnapshot({
    canonicalDocument: root.canonicalBytes,
    expectedDocumentHash: root.documentHash,
  });
  const seed = bindRealBuildExactRootLineageIdentity({
    identity: root.identities[0]!,
    documentSnapshot,
  });
  const frontier = createRealBuildBrowserOutputV4TransitionFrontier({
    throughStepNumber: 0,
    documentSnapshot,
    identities: [seed],
  });
  const step = {
    stepNumber: 1,
    lineageInspection: { evidence: compiled.lineage },
    observation: { closure: compiled.closure },
  } as RealBuildBrowserBranchDetailedStepInspection;
  return { compiled, frontier, step };
}

describe("browser-output /4 exact placement frontier induction", () => {
  it("adopts all exact step-1 roots and derives every convergent selected child", () => {
    const { compiled, frontier, step } = fixture();
    const advanced = advanceRealBuildBrowserOutputV4PlacementFrontier({ frontier, step });
    expect(advanced.status).toBe("selected");
    if (advanced.status !== "selected") throw new TypeError("Expected selected fixture.");
    expect(advanced.frontier.throughStepNumber).toBe(1);
    expect(advanced.frontier.identities).toHaveLength(
      compiled.closure.selection.selectedLineageIds.length,
    );
    expect(advanced.frontier.documentSnapshot.canonicalBytes).toBe(
      compiled.lineage.childCandidates[0]!.canonicalBytes,
    );
    expect(advanced.frontier.identities.map(({ lineageId }) => lineageId)).toEqual(
      compiled.closure.selection.selectedLineageIds,
    );
    expect(advanced.witnesses).toEqual(compiled.lineage.uniqueTransitions[0]!.pieces);
  });

  it("freezes an unverified branch at the exact parent and rejects root-byte drift", () => {
    const { frontier, step } = fixture("failed");
    const advanced = advanceRealBuildBrowserOutputV4PlacementFrontier({ frontier, step });
    expect(advanced).toMatchObject({ status: "terminal", reason: "unverified-failure" });
    expect(advanced.frontier.documentSnapshot).toBe(frontier.documentSnapshot);

    const drifted = {
      ...step,
      lineageInspection: {
        evidence: {
          ...step.lineageInspection.evidence,
          rootCandidates: step.lineageInspection.evidence.rootCandidates.map((root) => ({
            ...root,
            canonicalBytesHash: `sha256:${"f".repeat(64)}`,
          })),
        },
      },
    } as unknown as RealBuildBrowserBranchDetailedStepInspection;
    expect(() => bindRealBuildBrowserOutputV4PlacementRoots(frontier, drifted)).toThrow(
      /does not equal the exact current document bytes/u,
    );
  });
});
