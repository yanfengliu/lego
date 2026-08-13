import { describe, expect, it } from "vitest";

import { verifyRealBuildCompiledObservationClosure } from "../e2e/real-build-compiled-observation-closure";
import {
  deriveRealBuildCompiledObservationCameraId as deriveCameraId,
  deriveRealBuildCompiledObservationSourceId as deriveSourceId,
} from "../e2e/real-build-compiled-observation-closure-digest";
import { realBuildCompiledObservationRegistrationVisits } from "../e2e/real-build-compiled-observation-registration";
import { verifyRealBuildCompiledObservationRows } from "../e2e/real-build-compiled-observation-closure-verification";
import {
  MAXIMUM_REAL_BUILD_COMPILED_OBSERVATION_PIXEL_VISITS,
  type RealBuildCompiledObservation,
  type RealBuildCompiledObservationClosure,
  type RealBuildCompiledObservationMaskReference,
} from "../e2e/real-build-compiled-observation-closure-types";
import {
  commitCompiledObservation,
  compiledObservationClosureFixture,
  digestCompiledObservationBytes,
  encodeCompiledObservationClosure,
} from "./real-build-compiled-observation-closure.fixture";
import {
  compiledPlacementLineageBytes,
  compiledPlacementLineageFixture,
} from "./real-build-compiled-placement-lineage.fixture";

type Fixture = ReturnType<typeof compiledObservationClosureFixture>;

function verify(
  fixture: Fixture,
  closure: unknown = fixture.closure,
  role: unknown = fixture.roleBytes,
) {
  return verifyRealBuildCompiledObservationClosure(
    fixture.lineageBytes,
    encodeCompiledObservationClosure(closure),
    role,
    fixture.policy,
  );
}

function commitRows(
  rows: readonly RealBuildCompiledObservation[],
  patch: (
    row: RealBuildCompiledObservation,
    index: number,
  ) => Omit<RealBuildCompiledObservation, "observationId">,
) {
  return rows.map((row, index) => {
    const changed = patch(row, index) as RealBuildCompiledObservation;
    const { observationId: _observationId, ...committed } = changed;
    void _observationId;
    return commitCompiledObservation(committed);
  });
}

describe("compiled observation closure semantic refusal", () => {
  it("keeps structural row verification behind its module-created bytes preflight", () => {
    expect(() => verifyRealBuildCompiledObservationRows({}, new Uint8Array())).toThrow(
      /exact bytes-only preflight inspection/u,
    );
  });

  it("refuses linked /1 status changes and legacy observation generations", () => {
    const fixture = compiledObservationClosureFixture();
    const statusBytes = compiledPlacementLineageBytes({
      ...fixture.lineage,
      status: "selected",
      selection: {
        ...fixture.lineage.selection,
        status: "selected",
        selectedCandidateId: fixture.lineage.childCandidates[0]!.candidateId,
        selectedLineageIds: fixture.lineage.lineageEdges.map(({ child }) => child.lineageId),
      },
    });
    expect(() =>
      verifyRealBuildCompiledObservationClosure(
        statusBytes,
        fixture.closureBytes,
        fixture.roleBytes,
        fixture.policy,
      ),
    ).toThrow();

    const legacy = compiledPlacementLineageFixture();
    const reference: RealBuildCompiledObservationMaskReference = {
      role: "branch-observation-bytes",
      offset: 0,
      bytes: 1,
      digest: `sha256:${"a".repeat(64)}`,
      encoding: "packed-binary-mask-msb/1",
      widthPx: 8,
      heightPx: 1,
    };
    const legacyBytes = compiledPlacementLineageBytes({
      ...legacy,
      observationBytes: { role: reference.role, bytes: 1, digest: reference.digest },
      observationRefs: [
        {
          observationId: "legacy-observation",
          lineageId: legacy.lineageEdges[0]!.child.lineageId,
          sourceEvidenceId: "legacy-source",
          cameraEvidenceId: "legacy-camera",
          registrationPanelStepNumber: 2,
          status: "scored",
          score: 1,
          sourceMask: reference,
          candidateMask: reference,
          excludedMask: null,
        },
      ],
    });
    expect(() =>
      verifyRealBuildCompiledObservationClosure(
        legacyBytes,
        fixture.closureBytes,
        fixture.roleBytes,
        fixture.policy,
      ),
    ).toThrow();
  });

  it("refuses forged selection and accepted-transition projections", () => {
    const fixture = compiledObservationClosureFixture();
    expect(() =>
      verify(fixture, {
        ...fixture.closure,
        selection: { ...fixture.closure.selection, bestScore: 0.5 },
      }),
    ).toThrow(/selection does not reproduce/u);
    expect(() =>
      verify(fixture, {
        ...fixture.closure,
        acceptedTransition: {
          ...fixture.closure.acceptedTransition!,
          placedPieces: fixture.closure.acceptedTransition!.placedPieces + 1,
        },
      }),
    ).toThrow(/acceptedTransition does not reproduce/u);
  });

  it("requires failed rows to carry no dangling source or camera identity", () => {
    const fixture = compiledObservationClosureFixture("failed");
    const inventedSource = `compiled-observation-source:sha256:${"0".repeat(64)}` as const;
    const rows = commitRows(fixture.closure.observations, (row) => ({
      ...row,
      sourceId: inventedSource,
    }));
    expect(() => verify(fixture, { ...fixture.closure, observations: rows })).toThrow(
      /failed rows require null source\/camera/u,
    );
    expect(() => verify(fixture, fixture.closure, new Uint8Array())).toThrow(
      /requires null role input/u,
    );
  });

  it("rejects same-group shift or score changes before pixel replay", () => {
    const fixture = compiledObservationClosureFixture();
    const rows = commitRows(fixture.closure.observations, (row, index) => ({
      ...row,
      shiftPx: index === 0 ? [row.shiftPx![0] + 1, row.shiftPx![1]] : row.shiftPx,
    }));
    expect(() => verify(fixture, { ...fixture.closure, observations: rows })).toThrow(
      /group changes its retained shift or score/u,
    );
  });
});

describe("compiled observation closure work preflight", () => {
  it("admits eight 1000x500 comparisons but rejects eight maximum rasters", () => {
    expect(realBuildCompiledObservationRegistrationVisits(1000, 500) * 8).toBeLessThanOrEqual(
      MAXIMUM_REAL_BUILD_COMPILED_OBSERVATION_PIXEL_VISITS,
    );
    expect(realBuildCompiledObservationRegistrationVisits(1024, 1024) * 8).toBeGreaterThan(
      MAXIMUM_REAL_BUILD_COMPILED_OBSERVATION_PIXEL_VISITS,
    );
  });

  it("rejects predicted work before requiring genuine role bytes", () => {
    const fixture = compiledObservationClosureFixture();
    const widthPx = 1024;
    const heightPx = 1024;
    const bytes = (widthPx * heightPx) / 8;
    const roleBytes = new Uint8Array(bytes * 10);
    roleBytes[0] = 0x80;
    const ref = (offset: number): RealBuildCompiledObservationMaskReference => ({
      ...fixture.closure.sources[0]!.sourceMask,
      offset,
      bytes,
      digest: digestCompiledObservationBytes(roleBytes.subarray(offset, offset + bytes)),
      widthPx,
      heightPx,
    });
    const sourceBase = fixture.closure.sources[0]!;
    const { sourceId: _sourceId, ...sourceCommitment } = sourceBase;
    void _sourceId;
    const sourceWithoutId = {
      ...sourceCommitment,
      sourceMask: ref(0),
      excludedMask: ref(bytes),
    };
    const source = {
      sourceId: deriveSourceId(sourceWithoutId),
      ...sourceWithoutId,
    };
    // Preflight refuses this intentionally malformed high-work closure before role-byte branding.
    const child = fixture.lineage.childCandidates[0]!;
    const cameras = fixture.lineage.lineageEdges.map((_edge, index) => {
      const commitment = {
        sourceId: source.sourceId,
        candidateId: child.candidateId,
        documentHash: child.documentHash,
        d4CameraRecipeDigest: `sha256:${index.toString(16).padStart(64, "0")}` as const,
        rendererSnapshotDigest: `sha256:${"f".repeat(64)}` as const,
        candidateMask: ref(bytes * (index + 2)),
      };
      return { cameraId: deriveCameraId(commitment), ...commitment };
    });
    const observations = fixture.closure.observations.map((row, index) =>
      commitCompiledObservation({
        lineageId: row.lineageId,
        sourceId: source.sourceId,
        cameraId: cameras[index]!.cameraId,
        status: "scored",
        shiftPx: [0, 0],
        score: 0,
        outcome: null,
      }),
    );
    const closure: RealBuildCompiledObservationClosure = {
      ...fixture.closure,
      roleBytes: roleBytes.length,
      roleDigest: digestCompiledObservationBytes(roleBytes),
      sources: [source],
      cameras,
      observations,
      selection: {
        status: "unresolved",
        decisionSourceId: source.sourceId,
        selectedCameraId: null,
        selectedCandidateId: null,
        selectedLineageIds: [],
        bestScore: 0,
        runnerUpScore: 0,
        margin: 0,
      },
      acceptedTransition: null,
    };
    expect(() => verify(fixture, closure, {})).toThrow(
      /pixel visits.*role bytes were not accessed/u,
    );
  });
});
