import { describe, expect, it, vi } from "vitest";

vi.mock("../e2e/real-build-candidate-document-snapshot", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../e2e/real-build-candidate-document-snapshot")>();
  return {
    ...actual,
    createRealBuildCandidateDocumentSnapshot: vi.fn(
      actual.createRealBuildCandidateDocumentSnapshot,
    ),
  };
});

vi.mock("../e2e/real-build-compiled-placement-lineage-validation", async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import("../e2e/real-build-compiled-placement-lineage-validation")
    >();
  return {
    ...actual,
    validateRealBuildCompiledPlacementLineage: vi.fn(
      actual.validateRealBuildCompiledPlacementLineage,
    ),
  };
});

import { validateRealBuildCompiledPlacementLineage } from "../e2e/real-build-compiled-placement-lineage-validation";
import { createRealBuildCandidateDocumentSnapshot } from "../e2e/real-build-candidate-document-snapshot";
import {
  deriveRealBuildCompiledObservationCameraId,
  deriveRealBuildCompiledObservationSourceId,
} from "../e2e/real-build-compiled-observation-closure-digest";
import { parseRealBuildCompiledObservationClosure } from "../e2e/real-build-compiled-observation-closure-parser";
import {
  DIFFERENT_PRINTED_STEP_IDENTITY,
  branchFixture,
  inspect,
  preparedRunBytes,
  rebindObservationClosure,
} from "./real-build-browser-output-v4-semantic.fixture";

describe("browser-output /4 pre-replay observation binding", () => {
  it("requires the raw observation role when a closure commits masks", () => {
    const preparedBytes = preparedRunBytes();
    const closure = rebindObservationClosure(preparedBytes);
    const withoutRole = branchFixture({
      lineageBytes: closure.lineageBytes,
      closureBytes: closure.closureBytes,
    });
    const validate = vi.mocked(validateRealBuildCompiledPlacementLineage);
    validate.mockClear();

    expect(() => inspect(withoutRole, preparedBytes)).toThrow(
      /observation closure commits \d+ raw-role bytes, but the branch index has no observation role reference before replay/iu,
    );
    expect(validate).not.toHaveBeenCalled();
  });

  it("refuses closure-to-lineage digest drift before semantic validation", () => {
    const preparedBytes = preparedRunBytes();
    const closure = rebindObservationClosure(preparedBytes);
    const parsed = JSON.parse(new TextDecoder().decode(closure.closureBytes)) as Record<
      string,
      unknown
    >;
    const driftedClosureBytes = new TextEncoder().encode(
      JSON.stringify({ ...parsed, compiledLineageBytesDigest: DIFFERENT_PRINTED_STEP_IDENTITY }),
    );
    const validate = vi.mocked(validateRealBuildCompiledPlacementLineage);
    validate.mockClear();

    expect(() =>
      inspect(
        branchFixture({
          lineageBytes: closure.lineageBytes,
          closureBytes: driftedClosureBytes,
          roleBytes: closure.roleBytes,
        }),
        preparedBytes,
      ),
    ).toThrow(
      /observation closure commits compiled lineage digest .*; expected .* before replay/iu,
    );
    expect(validate).not.toHaveBeenCalled();
  });

  it("refuses closure-to-role digest drift before semantic validation", () => {
    const preparedBytes = preparedRunBytes();
    const closure = rebindObservationClosure(preparedBytes);
    const parsed = JSON.parse(new TextDecoder().decode(closure.closureBytes)) as Record<
      string,
      unknown
    >;
    const driftedClosureBytes = new TextEncoder().encode(
      JSON.stringify({ ...parsed, roleDigest: DIFFERENT_PRINTED_STEP_IDENTITY }),
    );
    const validate = vi.mocked(validateRealBuildCompiledPlacementLineage);
    validate.mockClear();

    expect(() =>
      inspect(
        branchFixture({
          lineageBytes: closure.lineageBytes,
          closureBytes: driftedClosureBytes,
          roleBytes: closure.roleBytes,
        }),
        preparedBytes,
      ),
    ).toThrow(
      /observation role reference commits digest .*; expected the closure's .* before replay/iu,
    );
    expect(validate).not.toHaveBeenCalled();
  });

  it("refuses closure-to-role byte-length drift before semantic validation", () => {
    const preparedBytes = preparedRunBytes();
    const closure = rebindObservationClosure(preparedBytes);
    const parsed = JSON.parse(new TextDecoder().decode(closure.closureBytes)) as Record<
      string,
      unknown
    >;
    const driftedClosureBytes = new TextEncoder().encode(
      JSON.stringify({ ...parsed, roleBytes: closure.roleBytes.length + 1 }),
    );
    const validate = vi.mocked(validateRealBuildCompiledPlacementLineage);
    validate.mockClear();

    expect(() =>
      inspect(
        branchFixture({
          lineageBytes: closure.lineageBytes,
          closureBytes: driftedClosureBytes,
          roleBytes: closure.roleBytes,
        }),
        preparedBytes,
      ),
    ).toThrow(
      /observation role reference commits \d+ bytes; expected the closure's \d+ bytes before replay/iu,
    );
    expect(validate).not.toHaveBeenCalled();
  });

  it("refuses orphan source and camera tables before root reconstruction or replay", () => {
    const preparedBytes = preparedRunBytes();
    const closure = rebindObservationClosure(preparedBytes);
    const parsed = parseRealBuildCompiledObservationClosure(closure.closureBytes);
    const source = parsed.sources[0]!;
    const camera = parsed.cameras[0]!;
    const orphanSourceCommitment = {
      preparedRunInputDigest: source.preparedRunInputDigest,
      preparedStepIdentity: source.preparedStepIdentity,
      provisionalStepIdentity: source.provisionalStepIdentity,
      observationMode: source.observationMode,
      compiledThroughStepNumber: source.compiledThroughStepNumber,
      registrationPanelStepNumber: source.registrationPanelStepNumber,
      pageNumber: source.pageNumber,
      panelDigest: source.panelDigest,
      cropDigest: source.cropDigest,
      sourceDescriptorDigest: DIFFERENT_PRINTED_STEP_IDENTITY,
      exclusionDescriptorDigest: source.exclusionDescriptorDigest,
      metric: source.metric,
      measure: source.measure,
      sourceMask: source.sourceMask,
      excludedMask: source.excludedMask,
    };
    const orphanSource = {
      sourceId: deriveRealBuildCompiledObservationSourceId(orphanSourceCommitment),
      ...orphanSourceCommitment,
    };
    const orphanCameraCommitment = {
      sourceId: camera.sourceId,
      candidateId: camera.candidateId,
      documentHash: camera.documentHash,
      d4CameraRecipeDigest: DIFFERENT_PRINTED_STEP_IDENTITY,
      rendererSnapshotDigest: camera.rendererSnapshotDigest,
      candidateMask: camera.candidateMask,
    };
    const orphanCamera = {
      cameraId: deriveRealBuildCompiledObservationCameraId(orphanCameraCommitment),
      ...orphanCameraCommitment,
    };
    const variants = [
      {
        label: "source",
        closure: {
          ...parsed,
          sources: [...parsed.sources, orphanSource],
        },
      },
      {
        label: "camera",
        closure: {
          ...parsed,
          cameras: [...parsed.cameras, orphanCamera],
        },
      },
    ] as const;
    const snapshot = vi.mocked(createRealBuildCandidateDocumentSnapshot);
    const validate = vi.mocked(validateRealBuildCompiledPlacementLineage);

    for (const variant of variants) {
      snapshot.mockClear();
      validate.mockClear();
      const closureBytes = new TextEncoder().encode(JSON.stringify(variant.closure));
      expect(() =>
        inspect(
          branchFixture({
            lineageBytes: closure.lineageBytes,
            closureBytes,
            roleBytes: closure.roleBytes,
          }),
          preparedBytes,
        ),
      ).toThrow(new RegExp(`orphan ${variant.label} before replay`, "iu"));
      expect(snapshot).not.toHaveBeenCalled();
      expect(validate).not.toHaveBeenCalled();
    }
  });
});
