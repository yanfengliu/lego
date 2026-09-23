import { resolve } from "node:path";

import { describe, expect, it, vi } from "vitest";

const preUnlockReceiptSeam = vi.hoisted(() => ({ syntheticBranchEnabled: false }));
const calibrationCropSentinel = vi.hoisted(() => ({ calls: 0 }));
const sourceAnchorSeam = vi.hoisted(() => ({ syntheticAnchorEnabled: false }));
const sourceGeometryAdmissionSeam = vi.hoisted(() => ({ admission: Object.freeze({}) }));

vi.mock(
  "../e2e/real-build-prefix50-subbuild-return-review-camera-real-domain-source-anchor.ts",
  async (importOriginal) => {
    const actual =
      await importOriginal<
        typeof import("../e2e/real-build-prefix50-subbuild-return-review-camera-real-domain-source-anchor.ts")
      >();
    const { canonicalDigest, deepFreeze } = await import("@lego-studio/brick-kernel");
    const lattice =
      await import("../e2e/real-build-prefix50-subbuild-return-review-camera-real-domain-lattice.ts");
    return {
      ...actual,
      deriveRegisteredRealBuildPrefix50Step44SourceAnchor: (
        inputs: readonly [Uint8Array, Uint8Array],
      ) => {
        if (!sourceAnchorSeam.syntheticAnchorEnabled)
          return actual.deriveRegisteredRealBuildPrefix50Step44SourceAnchor(inputs);
        const diagnostic = lattice.deriveRealBuildPrefix50Step44RealDomainLatticeDiagnostic(
          inputs[0],
        );
        const body = {
          schemaVersion: "lego.real-build-prefix50-page44-shared-orientation-anchor/1" as const,
          authority: "pooled-steps41-42-source-only-lattice-field" as const,
          calibrationPanelSteps: [41, 42] as const,
          pageCeiling: 44 as const,
          sourceFieldCommitments: [
            canonicalDigest({ testOnly: "step41" }),
            canonicalDigest({ testOnly: "step42" }),
          ] as const,
          pooledFieldCommitment: canonicalDigest({ testOnly: "pooled" }),
          selectedPanelStep: null,
          corroboratingPanelStep: null,
          corroboration: null,
          pooledCounterevidenceFailure: "test-only anchor seam",
          latticeFit: diagnostic.latticeFit,
          latticeFitCommitment: canonicalDigest(diagnostic.latticeFit),
          qualified: true as const,
          thresholdsChanged: false as const,
        };
        return deepFreeze({ ...body, commitment: canonicalDigest(body) });
      },
    };
  },
);

vi.mock(
  "../e2e/real-build-prefix50-subbuild-return-review-camera-real-domain-preunlock-receipt.ts",
  async (importOriginal) => {
    const actual =
      await importOriginal<
        typeof import("../e2e/real-build-prefix50-subbuild-return-review-camera-real-domain-preunlock-receipt.ts")
      >();
    const { canonicalDigest } = await import("@lego-studio/brick-kernel");
    const sourceSpec =
      await import("../e2e/real-build-prefix50-subbuild-return-review-camera-real-domain-source-spec.ts");
    const sourceBinding =
      await import("../e2e/real-build-prefix50-subbuild-return-review-camera-real-domain-step42-binding.ts");
    const pins = await import("../e2e/real-build-prefix50-source-pdf-pins.ts");
    return {
      ...actual,
      requireRealBuildPrefix50Step44PreUnlockSourceReceipt: (
        sourceGeometryAdmission: Parameters<
          typeof actual.requireRealBuildPrefix50Step44PreUnlockSourceReceipt
        >[0],
      ) => {
        if (!preUnlockReceiptSeam.syntheticBranchEnabled)
          return actual.requireRealBuildPrefix50Step44PreUnlockSourceReceipt(
            sourceGeometryAdmission,
          );
        if (sourceGeometryAdmission !== sourceGeometryAdmissionSeam.admission)
          throw new TypeError("Synthetic pre-unlock seam requires its exact forwarded admission.");
        const body = {
          schemaVersion: "lego.real-build-prefix50-step44-pre-unlock-source-receipt/2" as const,
          authority: "admitted-static-step-through-42-receipt" as const,
          sourcePdfArtifactPath: pins.REAL_BUILD_PREFIX50_STEP44_SOURCE_PDF_ARTIFACT_PATH,
          sourcePdfDigest: pins.REAL_BUILD_PREFIX50_STEP44_SOURCE_PDF_DIGEST,
          boundedCalibrationSpecCommitment:
            sourceSpec.REAL_BUILD_PREFIX50_STEP44_BOUNDED_CALIBRATION_SOURCE_SPEC_COMMITMENT,
          earlierPageVectorInputsCommitment:
            actual.REAL_BUILD_PREFIX50_STEP44_ADMITTED_EARLIER_VECTOR_INPUTS_COMMITMENT,
          earlierPageFaceRowsCommitment:
            actual.REAL_BUILD_PREFIX50_STEP44_ADMITTED_EARLIER_FACE_ROWS_COMMITMENT,
          boundedCalibrationPanelReceiptCommitment:
            actual.REAL_BUILD_PREFIX50_STEP44_ADMITTED_BOUNDED_PANEL_RECEIPT_COMMITMENT,
          vectorInputsCommitment:
            actual.REAL_BUILD_PREFIX50_STEP44_ADMITTED_VECTOR_INPUTS_COMMITMENT,
          faceRowsCommitment: actual.REAL_BUILD_PREFIX50_STEP44_ADMITTED_FACE_ROWS_COMMITMENT,
          sourceGeometryBindingCommitment:
            sourceBinding.REAL_BUILD_PREFIX50_STEP42_SOURCE_GEOMETRY_BINDING_COMMITMENT,
          sourceGeometrySemanticCommitment:
            sourceBinding.REAL_BUILD_PREFIX50_STEP42_SEMANTIC_GEOMETRY_COMMITMENT,
          sourceGeometryVerifierManifestCommitment:
            sourceBinding.REAL_BUILD_PREFIX50_STEP42_SOURCE_GEOMETRY_BINDING
              .verifierManifestCommitment,
          calibrationPanelSteps: [41, 42] as const,
          expectedBranchKey: "face:studs-up/hand:as-fitted/turn:0" as const,
        };
        return Object.freeze({ ...body, commitment: canonicalDigest(body) });
      },
    };
  },
);

vi.mock(
  "../e2e/real-build-prefix50-subbuild-return-review-camera-real-domain-calibration-raster.ts",
  async (importOriginal) => {
    const actual =
      await importOriginal<
        typeof import("../e2e/real-build-prefix50-subbuild-return-review-camera-real-domain-calibration-raster.ts")
      >();
    return {
      ...actual,
      rerenderRealBuildPrefix50Step44CalibrationSourceCrops: (
        input: Parameters<typeof actual.rerenderRealBuildPrefix50Step44CalibrationSourceCrops>[0],
      ) => {
        calibrationCropSentinel.calls += 1;
        return actual.rerenderRealBuildPrefix50Step44CalibrationSourceCrops(input);
      },
    };
  },
);

import { captureRealBuildPrefix50Step44CameraOnlyLiveSourceLock } from "../e2e/real-build-prefix50-step44-camera-only-source-lock.ts";
import { REAL_BUILD_PREFIX50_STEP44_CAMERA_ONLY_BATCH_RELATIVE_PATH } from "../e2e/real-build-prefix50-step44-review-batch-pin.ts";
import {
  prepareRealBuildPrefix50Step44RealDomainSourceSequence,
  requireRealBuildPrefix50Step44RealDomainSourceSequence,
} from "../e2e/real-build-prefix50-subbuild-return-review-camera-real-domain-source.ts";
import { withRealStep44SourceLock } from "./real-build-prefix50-source-lock-test-helper.ts";

describe("real-domain production source isolation", () => {
  it("keeps a missing opaque Step-42 geometry admission fail-closed before any crop read", async () => {
    const repositoryRoot = resolve(".");
    preUnlockReceiptSeam.syntheticBranchEnabled = false;
    const cropCallsBefore = calibrationCropSentinel.calls;
    await withRealStep44SourceLock({
      repositoryRoot,
      operationInputRoots: ["scripts", REAL_BUILD_PREFIX50_STEP44_CAMERA_ONLY_BATCH_RELATIVE_PATH],
      batchInputPath: REAL_BUILD_PREFIX50_STEP44_CAMERA_ONLY_BATCH_RELATIVE_PATH,
      action: async () => {
        const sourceLock = captureRealBuildPrefix50Step44CameraOnlyLiveSourceLock(repositoryRoot);
        await expect(
          prepareRealBuildPrefix50Step44RealDomainSourceSequence({
            repositoryRoot,
            sourceLock,
            sourceGeometryAdmission: undefined as never,
          }),
        ).rejects.toThrow("process-local opaque admission");
      },
    });
    expect(calibrationCropSentinel.calls).toBe(cropCallsBefore);
  }, 900_000);

  it("reproduces corrected masks and the registered anchor refusal without held-out reads", async () => {
    const repositoryRoot = resolve(".");
    preUnlockReceiptSeam.syntheticBranchEnabled = true;
    const cropCallsBefore = calibrationCropSentinel.calls;
    try {
      await withRealStep44SourceLock({
        repositoryRoot,
        operationInputRoots: [
          "scripts",
          REAL_BUILD_PREFIX50_STEP44_CAMERA_ONLY_BATCH_RELATIVE_PATH,
        ],
        batchInputPath: REAL_BUILD_PREFIX50_STEP44_CAMERA_ONLY_BATCH_RELATIVE_PATH,
        action: async () => {
          const sourceLock = captureRealBuildPrefix50Step44CameraOnlyLiveSourceLock(repositoryRoot);
          await expect(
            prepareRealBuildPrefix50Step44RealDomainSourceSequence({
              repositoryRoot,
              sourceLock,
              sourceGeometryAdmission: sourceGeometryAdmissionSeam.admission as never,
            }),
          ).rejects.toThrow(
            "registered zero-qualified-pair orientation-anchor refusal; independent-signed-full-rank-camera-receipt must replace the obsolete anchor",
          );
        },
      });
    } finally {
      preUnlockReceiptSeam.syntheticBranchEnabled = false;
    }
    expect(calibrationCropSentinel.calls).toBe(cropCallsBefore + 1);
  }, 900_000);

  it("freezes the ordered calibration tuple and revalidates its exact live cases and self commitment", async () => {
    const repositoryRoot = resolve(".");
    preUnlockReceiptSeam.syntheticBranchEnabled = true;
    sourceAnchorSeam.syntheticAnchorEnabled = true;
    try {
      await withRealStep44SourceLock({
        repositoryRoot,
        operationInputRoots: [
          "scripts",
          REAL_BUILD_PREFIX50_STEP44_CAMERA_ONLY_BATCH_RELATIVE_PATH,
        ],
        batchInputPath: REAL_BUILD_PREFIX50_STEP44_CAMERA_ONLY_BATCH_RELATIVE_PATH,
        action: async () => {
          const sourceLock = captureRealBuildPrefix50Step44CameraOnlyLiveSourceLock(repositoryRoot);
          const sequence = await prepareRealBuildPrefix50Step44RealDomainSourceSequence({
            repositoryRoot,
            sourceLock,
            sourceGeometryAdmission: sourceGeometryAdmissionSeam.admission as never,
          });
          expect(Object.isFrozen(sequence)).toBe(true);
          expect(Object.isFrozen(sequence.calibrationCases)).toBe(true);
          expect(sequence.calibrationCases.map(({ panelStep }) => panelStep)).toEqual([41, 42]);
          expect(requireRealBuildPrefix50Step44RealDomainSourceSequence(sequence)).toBe(sequence);
          expect(Reflect.set(sequence.calibrationCases, 0, sequence.calibrationCases[1])).toBe(
            false,
          );
          expect(() =>
            Object.defineProperty(sequence, "commitment", {
              value: `sha256:${"f".repeat(64)}`,
            }),
          ).toThrow();
          expect(requireRealBuildPrefix50Step44RealDomainSourceSequence(sequence)).toBe(sequence);
        },
      });
    } finally {
      sourceAnchorSeam.syntheticAnchorEnabled = false;
      preUnlockReceiptSeam.syntheticBranchEnabled = false;
    }
  }, 900_000);
});
