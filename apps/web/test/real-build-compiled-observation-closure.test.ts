import { describe, expect, it } from "vitest";

import { verifyRealBuildCompiledObservationClosure } from "../e2e/real-build-compiled-observation-closure";
import { encodeRealBuildPreparedRunInput } from "../e2e/real-build-prepared-run-input-parser";
import { inspectRealBuildPreparedObservationPolicy } from "../e2e/real-build-prepared-step-authority";
import {
  commitCompiledObservation,
  compiledObservationClosureFixture,
  digestCompiledObservationBytes,
  encodeCompiledObservationClosure,
} from "./real-build-compiled-observation-closure.fixture";
import { preparedSearchOptions } from "./real-build-prepared-search.fixture";

function preparedPolicy(patch: {
  readonly minimumDeferredAgreement?: number;
  readonly minimumDeferredAgreementMargin?: number;
}) {
  return inspectRealBuildPreparedObservationPolicy(
    encodeRealBuildPreparedRunInput({ ...preparedSearchOptions(1, 1), ...patch }),
  );
}

function verifyFixture(fixture: ReturnType<typeof compiledObservationClosureFixture>) {
  return verifyRealBuildCompiledObservationClosure(
    fixture.lineageBytes,
    fixture.closureBytes,
    fixture.roleBytes,
    fixture.policy,
  );
}

describe("compiled observation closure", () => {
  it("selects one camera group while retaining all eight convergent lineages", () => {
    const fixture = compiledObservationClosureFixture();

    const inspection = verifyFixture(fixture);

    expect(inspection.authority).toBe("absent");
    expect(inspection.provenanceAuthority).toBe("absent");
    expect(inspection.reproducible).toBe(true);
    expect(inspection.failedObservationIds).toEqual([]);
    expect(inspection.closure.selection).toMatchObject({
      status: "selected",
      selectedCandidateId: fixture.lineage.childCandidates[0]!.candidateId,
      selectedLineageIds: fixture.lineage.lineageEdges.map(({ child }) => child.lineageId),
      bestScore: 1,
      runnerUpScore: null,
      margin: null,
    });
    expect(inspection.closure.acceptedTransition).toMatchObject({
      lineageIds: fixture.lineage.lineageEdges.map(({ child }) => child.lineageId),
      transitionIds: [fixture.lineage.uniqueTransitions[0]!.transitionId],
      placedPieces: 1,
    });
  });

  it("requires observations in canonical compiled-edge order", () => {
    const fixture = compiledObservationClosureFixture();
    const observations = fixture.closure.observations;
    const reordered = [observations[1]!, observations[0]!, ...observations.slice(2)];

    expect(() =>
      verifyRealBuildCompiledObservationClosure(
        fixture.lineageBytes,
        encodeCompiledObservationClosure({
          ...fixture.closure,
          observations: reordered,
        }),
        fixture.roleBytes,
        fixture.policy,
      ),
    ).toThrow(/canonical lineageEdges order/u);
  });

  it("rejects unbranded policy objects and policy/lineage digest mismatches", () => {
    const fixture = compiledObservationClosureFixture();

    expect(() =>
      verifyRealBuildCompiledObservationClosure(
        fixture.lineageBytes,
        fixture.closureBytes,
        fixture.roleBytes,
        { ...fixture.policy },
      ),
    ).toThrow(/exact non-authoritative result/u);

    const alteredLineage = {
      ...fixture.lineage,
      preparedStep: {
        ...fixture.lineage.preparedStep,
        preparedRunInputDigest: `sha256:${"a".repeat(64)}` as const,
      },
    };
    const alteredLineageBytes = encodeCompiledObservationClosure(alteredLineage);
    expect(() =>
      verifyRealBuildCompiledObservationClosure(
        alteredLineageBytes,
        encodeCompiledObservationClosure({
          ...fixture.closure,
          compiledLineageBytesDigest: digestCompiledObservationBytes(alteredLineageBytes),
        }),
        fixture.roleBytes,
        fixture.policy,
      ),
    ).toThrow(/policy digest does not match/u);
  });

  it("refuses rows measured against different source commitments", () => {
    const fixture = compiledObservationClosureFixture("different-sources");

    expect(() => verifyFixture(fixture)).toThrow(/Every decision row must share one exact source/u);
  });

  it("leaves an exact top tie unresolved across two cameras of the same candidate", () => {
    const fixture = compiledObservationClosureFixture("camera-tie");
    expect(fixture.closure.cameras[0]!.candidateId).toBe(fixture.closure.cameras[1]!.candidateId);
    expect(fixture.closure.cameras[0]!.cameraId).not.toBe(fixture.closure.cameras[1]!.cameraId);

    const inspection = verifyFixture(fixture);

    expect(inspection.closure.selection).toMatchObject({
      status: "unresolved",
      selectedCameraId: null,
      selectedCandidateId: null,
      selectedLineageIds: [],
      bestScore: 1,
      runnerUpScore: 1,
      margin: 0,
    });
    expect(inspection.closure.acceptedTransition).toBeNull();
  });

  it("accepts score equality but refuses margin equality at prepared boundaries", () => {
    const scoreEquality = compiledObservationClosureFixture(
      "selected",
      preparedPolicy({ minimumDeferredAgreement: 1 }),
    );
    expect(verifyFixture(scoreEquality).closure.selection.status).toBe("selected");

    const marginEquality = compiledObservationClosureFixture(
      "camera-tie",
      preparedPolicy({ minimumDeferredAgreementMargin: 0 }),
    );
    expect(verifyFixture(marginEquality).closure.selection).toMatchObject({
      status: "unresolved",
      margin: 0,
    });
  });

  it("retains typed failures as inspection-only non-certification", () => {
    const fixture = compiledObservationClosureFixture("failed");

    const inspection = verifyFixture(fixture);

    expect(inspection.reproducible).toBe(false);
    expect(inspection.failedObservationIds).toHaveLength(8);
    expect(inspection.closure.selection.status).toBe("unverified-failure");
    expect(inspection.closure.selection.selectedLineageIds).toEqual([]);
    expect(inspection.closure.acceptedTransition).toBeNull();
    expect(inspection.authority).toBe("absent");
  });

  it("scores a fully excluded nonempty source as zero but never calls it not observable", () => {
    const fixture = compiledObservationClosureFixture("fully-excluded");
    const inspection = verifyFixture(fixture);
    expect(inspection.closure.observations.every(({ score }) => score === 0)).toBe(true);
    expect(inspection.closure.selection).toMatchObject({
      status: "unresolved",
      bestScore: 0,
      runnerUpScore: null,
      margin: null,
    });

    const observations = fixture.closure.observations.map((row) =>
      commitCompiledObservation({
        lineageId: row.lineageId,
        sourceId: row.sourceId,
        cameraId: null,
        status: "not-observable",
        shiftPx: null,
        score: null,
        outcome: "source-mask-empty",
      }),
    );
    const notObservableRole = fixture.roleBytes!.subarray(0, 2);
    expect(() =>
      verifyRealBuildCompiledObservationClosure(
        fixture.lineageBytes,
        encodeCompiledObservationClosure({
          ...fixture.closure,
          roleBytes: notObservableRole.length,
          roleDigest: digestCompiledObservationBytes(notObservableRole),
          cameras: [],
          observations,
        }),
        notObservableRole,
        fixture.policy,
      ),
    ).toThrow(/nonempty raw source pixels/u);
  });

  it("retains raw-source-empty rows as reproducible not-observable decisions", () => {
    const inspection = verifyFixture(compiledObservationClosureFixture("raw-empty"));
    expect(inspection.reproducible).toBe(false);
    expect(inspection.closure.observations.every(({ status }) => status === "not-observable")).toBe(
      true,
    );
    expect(inspection.closure.selection).toMatchObject({
      status: "unresolved",
      bestScore: null,
      selectedLineageIds: [],
    });
  });

  it("rejects a committed score row whose shift is not the deterministic optimum", () => {
    const fixture = compiledObservationClosureFixture();
    const changed = fixture.closure.observations.map((row) =>
      commitCompiledObservation({
        lineageId: row.lineageId,
        sourceId: row.sourceId,
        cameraId: row.cameraId,
        status: row.status,
        shiftPx: [row.shiftPx![0] + 1, row.shiftPx![1]],
        score: row.score,
        outcome: row.outcome,
      }),
    );

    expect(() =>
      verifyRealBuildCompiledObservationClosure(
        fixture.lineageBytes,
        encodeCompiledObservationClosure({
          ...fixture.closure,
          observations: changed,
        }),
        fixture.roleBytes,
        fixture.policy,
      ),
    ).toThrow(/deterministic optimal registration/u);
  });

  it("rejects malformed commitment tables before reading the role input", () => {
    const fixture = compiledObservationClosureFixture();
    const malformedClosure = {
      ...fixture.closure,
      sources: [{ ...fixture.closure.sources[0]!, undeclaredDescriptor: "hostile" }],
    };
    expect(() =>
      verifyRealBuildCompiledObservationClosure(
        fixture.lineageBytes,
        encodeCompiledObservationClosure(malformedClosure),
        {},
        fixture.policy,
      ),
    ).toThrow(/must contain exactly/u);
  });
});
