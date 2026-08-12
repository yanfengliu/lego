import { describe, expect, it } from "vitest";

import { createRealBuildPanelCameraBranchBudgetLedger } from "../e2e/real-build-panel-camera-branch-budget";
import {
  parseRealBuildPanelCameraEvidence,
  projectRealBuildPanelCameraFrontierEvidence,
  projectRealBuildPanelCameraResolutionEvidence,
} from "../e2e/real-build-panel-camera-evidence";
import { resolveRealBuildPanelCameraFrontier } from "../e2e/real-build-panel-camera-frontier";
import { resolveRealBuildPanelCameraBranches } from "../e2e/real-build-panel-camera-resolver";
import {
  BUILT_MASK as FRONTIER_BUILT_MASK,
  HASH_A,
  frontierInput,
  frontierPrefix,
} from "./real-build-panel-camera-frontier.fixture";
import {
  BUILT_MASK,
  document,
  observedInput,
  prefix,
} from "./real-build-panel-camera-resolver.fixture";
import { panelCameraTestMeasurementContext } from "./real-build-panel-camera-evidence.fixture";

type MutableJson<T> = T extends readonly (infer Entry)[]
  ? MutableJson<Entry>[]
  : T extends object
    ? { -readonly [Key in keyof T]: MutableJson<T[Key]> }
    : T;

const mutableJson = <T>(value: T): MutableJson<T> =>
  JSON.parse(JSON.stringify(value)) as MutableJson<T>;

function seedEvidence() {
  return projectRealBuildPanelCameraResolutionEvidence(
    resolveRealBuildPanelCameraBranches({
      ...observedInput(),
      prefix: prefix({
        throughStepNumber: 0,
        parentLineageId: null,
        document: document(0),
      }),
      registrationPanelStepNumber: 1,
      ledger: createRealBuildPanelCameraBranchBudgetLedger(8),
      renderModelMask: () => BUILT_MASK,
    }),
  );
}

function frontierEvidence() {
  return projectRealBuildPanelCameraFrontierEvidence(
    resolveRealBuildPanelCameraFrontier(frontierInput()),
    panelCameraTestMeasurementContext(6),
  );
}

describe("real-build panel-camera report evidence", () => {
  it("projects the exact eight root seeds without serializing a document or fake observation", () => {
    const evidence = seedEvidence();
    const encoded = JSON.stringify(evidence);
    const reparsed = parseRealBuildPanelCameraEvidence(JSON.parse(encoded));

    expect(reparsed).toEqual(evidence);
    expect(evidence).toMatchObject({
      schemaVersion: "lego.real-build-panel-camera-evidence/2",
      status: "seeded",
      throughStepNumber: 0,
      registrationPanelStepNumber: 1,
      reservation: { requested: 8, reservedAfter: 8, failure: null },
      failure: null,
      physicalFrameDecision: {
        status: "unresolved",
        authorizedTransform: null,
        reason: "panel-camera-silhouette-is-not-physical-transform-authority",
      },
    });
    expect(evidence.candidates).toHaveLength(1);
    expect(evidence.candidates[0]).toMatchObject({
      status: "seeded",
      parentLineageIds: [],
      observationIds: [],
      selectedObservationId: null,
      selectedLineageIds: [],
      failure: null,
    });
    expect(evidence.candidates[0]!.attempts).toHaveLength(8);
    expect(evidence.candidates[0]!.attempts.every(({ status }) => status === "unregistered")).toBe(
      true,
    );
    expect(evidence.observations).toHaveLength(8);
    expect(new Set(evidence.observations.map(({ lineageId }) => lineageId))).toHaveLength(8);
    expect(
      evidence.observations.every(
        ({ observationId, parentLineageId, silhouetteIou, registration }) =>
          observationId === null &&
          parentLineageId === null &&
          silhouetteIou === null &&
          registration.shiftPx === null,
      ),
    ).toBe(true);
    expect(encoded).not.toMatch(/"document"\s*:/u);
    expect(Object.isFrozen(reparsed)).toBe(true);
    expect(Object.isFrozen(reparsed.observations[0]!.registration)).toBe(true);
  });

  it("projects a convergent multi-parent frontier as stable candidates and flattened lineages", () => {
    const evidence = frontierEvidence();
    const [candidateA, candidateB] = evidence.candidates;

    expect(evidence.status).toBe("observed");
    expect(evidence.throughStepNumber).toBe(5);
    expect(evidence.reservation).toMatchObject({ requested: 24, reservedAfter: 24 });
    expect(evidence.candidates).toHaveLength(2);
    expect(candidateA!.parentLineageIds).toEqual(["root-a-0", "root-a-1"]);
    expect(candidateB!.parentLineageIds).toEqual(["root-b-0"]);
    expect(candidateA!.observationIds).toHaveLength(8);
    expect(candidateA!.selectedLineageIds).toHaveLength(2);
    expect(candidateB!.selectedLineageIds).toHaveLength(1);
    expect(evidence.observations).toHaveLength(24);
    expect(new Set(evidence.observations.map(({ lineageId }) => lineageId))).toHaveLength(24);
    for (const observationId of candidateA!.observationIds) {
      expect(
        evidence.observations
          .filter(
            (row) =>
              row.candidateId === candidateA!.candidateId && row.observationId === observationId,
          )
          .map(({ parentLineageId }) => parentLineageId),
      ).toEqual(["root-a-0", "root-a-1"]);
    }
    expect(parseRealBuildPanelCameraEvidence(mutableJson(evidence))).toEqual(evidence);
  });

  it("rejects deletion, document injection, sparse arrays, and the explicit aggregate input bound", () => {
    const evidence = frontierEvidence();
    const deleted = mutableJson(evidence);
    Reflect.deleteProperty(deleted.candidates[0]!, "documentHash");
    expect(() => parseRealBuildPanelCameraEvidence(deleted)).toThrow(/missing "documentHash"/u);

    const injected = mutableJson(evidence);
    Object.assign(injected.candidates[0]!, { document: { parts: [] } });
    expect(() => parseRealBuildPanelCameraEvidence(injected)).toThrow(/unexpected key "document"/u);

    const sparse = mutableJson(evidence);
    delete sparse.observations[2];
    expect(() => parseRealBuildPanelCameraEvidence(sparse)).toThrow(
      /missing; required a dense array/u,
    );

    expect(() => parseRealBuildPanelCameraEvidence(mutableJson(evidence), 8)).toThrow(
      /exceeding maximumEntries 8/u,
    );
    expect(() => parseRealBuildPanelCameraEvidence(mutableJson(evidence), 128)).not.toThrow();
  });

  it("rejects duplicate, reparented, swapped, and registration-relabelled lineage evidence", () => {
    const evidence = frontierEvidence();

    const duplicated = mutableJson(evidence);
    duplicated.observations[1]!.lineageId = duplicated.observations[0]!.lineageId;
    expect(() => parseRealBuildPanelCameraEvidence(duplicated)).toThrow(
      /does not bind|duplicates/u,
    );

    const reparented = mutableJson(evidence);
    reparented.observations[0]!.parentLineageId = "root-a-1";
    expect(() => parseRealBuildPanelCameraEvidence(reparented)).toThrow(
      /does not bind its parent/u,
    );

    const swapped = mutableJson(evidence);
    const first = swapped.candidates[0]!.selectedLineageIds[0]!.lineageId;
    swapped.candidates[0]!.selectedLineageIds[0]!.lineageId =
      swapped.candidates[0]!.selectedLineageIds[1]!.lineageId;
    swapped.candidates[0]!.selectedLineageIds[1]!.lineageId = first;
    expect(() => parseRealBuildPanelCameraEvidence(swapped)).toThrow(
      /does not reproduce its winning parent lineage/u,
    );

    const relabelled = mutableJson(evidence);
    relabelled.observations[0]!.registration.turnDegrees = 90;
    expect(() => parseRealBuildPanelCameraEvidence(relabelled)).toThrow(
      /does not match its scored attempt|observationId does not bind/u,
    );
  });

  it("rejects selection, status, failure, and reservation claims that disagree with retained rows", () => {
    const evidence = frontierEvidence();

    const selection = mutableJson(evidence);
    selection.candidates[0]!.selectedObservationId = selection.candidates[0]!.observationIds[1]!;
    expect(() => parseRealBuildPanelCameraEvidence(selection)).toThrow(
      /does not equal the resolver-derived winning observation/u,
    );

    const status = mutableJson(evidence);
    status.status = "unresolved";
    expect(() => parseRealBuildPanelCameraEvidence(status)).toThrow(/requires a failure/u);

    const failure = mutableJson(evidence);
    failure.candidates[0]!.failure = {
      code: "camera-handedness-unresolved",
      stage: "camera-registration",
      stepNumber: 6,
      message: "synthetic contradiction",
    };
    expect(() => parseRealBuildPanelCameraEvidence(failure)).toThrow(
      /status observed requires failure null/u,
    );

    const reservation = mutableJson(evidence);
    reservation.reservation.requested = 16;
    reservation.reservation.reservedAfter = 16;
    expect(() => parseRealBuildPanelCameraEvidence(reservation)).toThrow(
      /retained parent hypotheses require 24/u,
    );
  });

  it("derives the unique winning observation instead of trusting coordinated selection labels", () => {
    const evidence = frontierEvidence();
    const relabelled = mutableJson(evidence);
    const candidate = relabelled.candidates[0]!;
    const losingObservationId = candidate.observationIds[1]!;
    candidate.selectedObservationId = losingObservationId;
    candidate.selectedLineageIds = relabelled.observations
      .filter(
        (row) =>
          row.candidateId === candidate.candidateId && row.observationId === losingObservationId,
      )
      .map(({ parentLineageId, lineageId }) => ({ parentLineageId: parentLineageId!, lineageId }));

    expect(() => parseRealBuildPanelCameraEvidence(relabelled)).toThrow(
      /does not equal the resolver-derived winning observation/u,
    );
  });

  it("serializes both early-anchor and all-empty total failures without inventing observations", () => {
    const early = projectRealBuildPanelCameraResolutionEvidence(
      resolveRealBuildPanelCameraBranches({
        ...observedInput(),
        builtMask: new Uint8Array(4),
      }),
      panelCameraTestMeasurementContext(6),
    );
    expect(early).toMatchObject({
      status: "failed",
      failure: { code: "camera-anchor-failed" },
    });
    expect(early.candidates[0]!.attempts).toEqual([]);
    expect(early.observations).toEqual([]);

    const allEmpty = projectRealBuildPanelCameraResolutionEvidence(
      resolveRealBuildPanelCameraBranches({
        ...observedInput(),
        renderModelMask: () => new Uint8Array(4),
      }),
      panelCameraTestMeasurementContext(6),
    );
    expect(allEmpty).toMatchObject({
      status: "failed",
      failure: { code: "camera-anchor-failed" },
    });
    expect(allEmpty.candidates[0]!.attempts).toHaveLength(8);
    expect(allEmpty.candidates[0]!.attempts.every(({ status }) => status === "empty")).toBe(true);
    expect(allEmpty.observations).toEqual([]);
  });

  it("projects a failed aggregate after an earlier unresolved candidate", () => {
    const evidence = projectRealBuildPanelCameraFrontierEvidence(
      resolveRealBuildPanelCameraFrontier({
        ...frontierInput({
          prefixes: [frontierPrefix("parent-a"), frontierPrefix("parent-b", "b")],
          ledger: createRealBuildPanelCameraBranchBudgetLedger(16),
        }),
        renderModelMask: ({ candidateId, hypothesis }) => {
          if (candidateId === `document:${HASH_A}`) return FRONTIER_BUILT_MASK;
          if (hypothesis.latticeHand === "as-fitted" && hypothesis.turnDegrees === 90) {
            throw new Error("later candidate render failed");
          }
          return hypothesis.latticeHand === "as-fitted" && hypothesis.turnDegrees === 0
            ? FRONTIER_BUILT_MASK
            : new Uint8Array([1, 0, 0, 0]);
        },
      }),
      panelCameraTestMeasurementContext(6),
    );
    expect(evidence.candidates.map(({ status }) => status)).toEqual(["unresolved", "failed"]);
    expect(evidence).toMatchObject({
      status: "failed",
      failure: { code: "rendering-error" },
    });
  });

  it("uses a derived entry floor for budget eight and binds budget refusals to their prefix", () => {
    expect(() => seedEvidence()).not.toThrow();
    const refused = projectRealBuildPanelCameraResolutionEvidence(
      resolveRealBuildPanelCameraBranches({
        ...observedInput(),
        ledger: createRealBuildPanelCameraBranchBudgetLedger(7),
      }),
      panelCameraTestMeasurementContext(6),
    );
    expect(refused).toMatchObject({
      status: "budget-refused",
      throughStepNumber: 5,
      registrationPanelStepNumber: 6,
      failure: { stepNumber: 6 },
    });

    const wrongFailureStep = mutableJson(refused);
    wrongFailureStep.failure!.stepNumber = 5;
    expect(() => parseRealBuildPanelCameraEvidence(wrongFailureStep)).toThrow(
      /failure is not bound to the registration panel/u,
    );
    const missingPrefix = mutableJson(refused);
    Reflect.set(missingPrefix, "throughStepNumber", null);
    expect(() => parseRealBuildPanelCameraEvidence(missingPrefix)).toThrow(
      /throughStepNumber must be a safe integer/u,
    );
  });

  it("reserves step zero for seeded roots and validates a large convergent frontier linearly", () => {
    const observed = projectRealBuildPanelCameraResolutionEvidence(
      resolveRealBuildPanelCameraBranches(observedInput()),
      panelCameraTestMeasurementContext(6),
    );
    const forgedRoot = mutableJson(observed);
    forgedRoot.throughStepNumber = 0;
    expect(() => parseRealBuildPanelCameraEvidence(forgedRoot)).toThrow(
      /throughStepNumber 0 is reserved exactly/u,
    );

    const prefixes = Array.from({ length: 512 }, (_, index) => frontierPrefix(`parent-${index}`));
    const large = projectRealBuildPanelCameraFrontierEvidence(
      resolveRealBuildPanelCameraFrontier(
        frontierInput({
          prefixes,
          ledger: createRealBuildPanelCameraBranchBudgetLedger(prefixes.length * 8),
        }),
      ),
      panelCameraTestMeasurementContext(6),
    );
    expect(large.observations).toHaveLength(prefixes.length * 8);
    expect(parseRealBuildPanelCameraEvidence(mutableJson(large))).toEqual(large);
  });

  it("commits score, render mask, raster, source, camera, and crop into observation identity", () => {
    const evidence = frontierEvidence();
    const mutations: ((value: MutableJson<typeof evidence>) => void)[] = [
      (value) => {
        value.candidates[0]!.attempts[0]!.silhouetteIou = 0.123;
      },
      (value) => {
        value.candidates[0]!.attempts[0]!.renderMaskDigest = `sha256:${"f".repeat(64)}`;
      },
      (value) => {
        value.measurement!.builtMaskDigest = `sha256:${"e".repeat(64)}`;
      },
      (value) => {
        value.measurement!.sourcePanelPngDigest = `sha256:${"d".repeat(64)}`;
      },
      (value) => {
        value.measurement!.camera.azimuthDegrees += 1;
      },
      (value) => {
        value.measurement!.cropPt[0] = value.measurement!.cropPt[0]! + 1;
      },
    ];
    for (const mutate of mutations) {
      const changed = mutableJson(evidence);
      mutate(changed);
      expect(() => parseRealBuildPanelCameraEvidence(changed)).toThrow(
        /observation|winning|scored attempt|ranking order/u,
      );
    }
  });

  it("does not invoke hostile formatting hooks outside the explicit parse bound", () => {
    let invoked = 0;
    const hostile = Object.create(null) as Record<string, unknown>;
    Object.defineProperty(hostile, "toJSON", {
      enumerable: false,
      get() {
        invoked += 1;
        throw new Error("must not run");
      },
    });
    expect(() => parseRealBuildPanelCameraEvidence(hostile)).toThrow(/missing|unexpected/u);
    expect(invoked).toBe(0);

    const deep: Record<string, unknown> = {};
    let cursor = deep;
    for (let index = 0; index < 50_000; index += 1) {
      const next: Record<string, unknown> = {};
      cursor.next = next;
      cursor = next;
    }
    expect(() => parseRealBuildPanelCameraEvidence(deep, 8)).toThrow(/missing/u);
  });
});
