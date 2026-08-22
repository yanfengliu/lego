import { describe, expect, it } from "vitest";

import { realBuildBrowserOutputV4TwoStepProvenanceFixture } from "./real-build-browser-output-v4-provenance-two-step.fixture";

describe("browser-output /4 two-placement-step camera provenance", () => {
  it("cross-binds closure-local mask offsets to disjoint external global role bases", () => {
    const fixture = realBuildBrowserOutputV4TwoStepProvenanceFixture();
    expect(fixture.branch.steps).toHaveLength(2);
    expect(
      fixture.branch.steps.map(
        ({ observation }) => observation?.closure.sources[0]?.sourceMask.offset,
      ),
    ).toEqual([0, 0]);
    expect(fixture.camera.manifest.rows.map(({ sourceMask }) => sourceMask.offset)).toEqual([0, 0]);
    const firstRoleBytes = fixture.branch.steps[0]!.observation!.closure.roleBytes;
    expect(fixture.branch.steps.map(({ index }) => index.observations?.offset)).toEqual([
      0,
      firstRoleBytes,
    ]);
    expect(
      fixture.camera.manifest.rows.map(({ maskRoleBaseOffset }) => maskRoleBaseOffset),
    ).toEqual([0, firstRoleBytes]);
    expect(fixture.camera.manifest.maskRole).toEqual(fixture.branch.branch.observationRole);
    expect(fixture.provenance.steps).toMatchObject([
      { stepNumber: 1, sourceAndCameraDerivation: "verified" },
      { stepNumber: 2, sourceAndCameraDerivation: "verified" },
    ]);
  }, 15_000);

  it("keeps terminal source-only closure bytes in branch replay and out of the camera role", () => {
    const fixture = realBuildBrowserOutputV4TwoStepProvenanceFixture(true);
    const terminal = fixture.branch.steps[1]!.observation!.closure;
    expect(terminal).toMatchObject({
      roleBytes: expect.any(Number),
      sources: [{ sourceMask: { offset: 0 } }],
      cameras: [],
      selection: { status: "unresolved" },
    });
    expect(terminal.roleBytes).toBeGreaterThan(0);
    expect(fixture.camera.manifest.rows).toHaveLength(1);
    expect(fixture.camera.manifest.maskRole.bytes).toBeLessThan(
      fixture.branch.branch.observationRole.bytes,
    );
    expect(fixture.provenance.steps[1]).toMatchObject({
      stepNumber: 2,
      sourceCommitments: 1,
      cameraCommitments: 0,
      scoredObservations: 0,
      sourceAndCameraDerivation: "verified",
    });
  }, 15_000);
});
