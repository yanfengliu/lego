import { describe, expect, it } from "vitest";

import { assertCurrentArtifactReplayBoundaryVerifiable } from "../e2e/real-build-artifact-input-rejection-policy";
import { LOCAL_REAL_BUILD_AUTHORITY } from "../e2e/real-build-authority";
import { writeRealBuildArtifactManifest } from "../e2e/real-build-artifacts";

const metadataOnlyBoundary = {
  replayLevel: "metadata-only" as const,
  earliestBoundary: "input-rejection" as const,
};

describe("current artifact input-rejection policy", () => {
  it("refuses verifier authority for metadata-only closures without a rejection witness", () => {
    expect(() =>
      assertCurrentArtifactReplayBoundaryVerifiable(metadataOnlyBoundary, "verify"),
    ).toThrow(/no typed digest-bound rejection evidence/u);
  });

  it("does not let a caller-authored input-rejected result bypass the artifact writer", () => {
    const forgedResult = {
      status: "input-rejected",
      authority: LOCAL_REAL_BUILD_AUTHORITY,
      inputFailures: [
        {
          code: "forged",
          stage: "preflight",
          message: "Caller-authored refusal with no retained witness.",
        },
      ],
    };
    expect(() =>
      writeRealBuildArtifactManifest({
        directory: "unread-because-policy-fails-first",
        runId: "forged-input-rejection",
        runContract: { schemaVersion: "lego.real-build-run-contract/4" } as never,
        result: forgedResult as never,
        artifactFiles: [],
        replayClosure: {
          schemaVersion: "lego.real-build-replay-closure/3",
          ...metadataOnlyBoundary,
        } as never,
      }),
    ).toThrow(/no typed digest-bound rejection evidence/u);
    expect(() =>
      writeRealBuildArtifactManifest({
        directory: "unread-because-finalizer-brand-fails-first",
        runId: "forged-input-rejection",
        runContract: { schemaVersion: "lego.real-build-run-contract/4" } as never,
        result: forgedResult as never,
        artifactFiles: [],
        replayClosure: {
          schemaVersion: "lego.real-build-replay-closure/3",
          replayLevel: "downstream-only",
          earliestBoundary: "browser-output",
        } as never,
      }),
    ).toThrow(/not produced by the local Node finalizer/u);
  });

  it("keeps downstream browser evidence eligible for ordinary verification", () => {
    expect(() =>
      assertCurrentArtifactReplayBoundaryVerifiable(
        { replayLevel: "downstream-only", earliestBoundary: "browser-output" },
        "verify",
      ),
    ).not.toThrow();
  });
});
