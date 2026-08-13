import { deepFreeze, sha256Hex, type Sha256Digest } from "@lego-studio/brick-kernel";

import {
  requireRealBuildSourceParityCalibrationContract,
  type RealBuildSourceParityCalibrationContract,
} from "./real-build-observation-source-parity-calibration-contract";
import {
  copyRealBuildSourceParityCalibrationInspectionMask,
  requireInspectedRealBuildSourceParityCalibrationPacket,
  type InspectedRealBuildSourceParityCalibrationPacket,
} from "./real-build-observation-source-parity-calibration-truth";
import {
  boundedDenseSourceParityArray,
  exactSourceParityKeys,
  snapshotDenseSourceParityArray,
  snapshotSourceParityRecord,
  sourceParityDigest,
  sourceParityInteger,
} from "./real-build-observation-source-parity-output-primitives";
import { snapshotObservationSourceCandidateMask } from "./real-build-observation-source-raster-candidate-input";

interface CalibrationCandidatePanel {
  readonly stepNumber: number;
  readonly pageNumber: number;
  readonly width: number;
  readonly height: number;
  readonly pixelCount: number;
  readonly workFactor: number;
  readonly wMask: Uint8Array;
}

export type RealBuildSourceParityCalibrationAdjudication = Readonly<{
  schemaVersion: "lego.real-build-observation-source-parity-calibration-adjudication/1";
  authority: "absent";
  status: "needs-adjudication";
  reason:
    | "human-truth-not-supplied"
    | "claimed-review-evidence-drifted"
    | "human-review-authority-not-supplied";
  comparison:
    | "not-run"
    | "candidate-w-differs-from-unverified-packet"
    | "candidate-w-exactly-matches-unverified-packet";
  calibrationDigest: Sha256Digest;
  executionIdentityDigest: Sha256Digest;
  truthPacketDigest: Sha256Digest | null;
  comparedPanels: number;
  differingSteps: readonly number[];
}>;

const ROW_KEYS = [
  "stepNumber",
  "pageNumber",
  "width",
  "height",
  "pixelCount",
  "workFactor",
  "wMask",
] as const;

function result(
  contract: RealBuildSourceParityCalibrationContract,
  executionIdentityDigest: Sha256Digest,
  inspection: InspectedRealBuildSourceParityCalibrationPacket | null,
  reason: RealBuildSourceParityCalibrationAdjudication["reason"],
  comparison: RealBuildSourceParityCalibrationAdjudication["comparison"],
  comparedPanels: number,
  differingSteps: readonly number[],
): RealBuildSourceParityCalibrationAdjudication {
  return deepFreeze({
    schemaVersion: "lego.real-build-observation-source-parity-calibration-adjudication/1" as const,
    authority: "absent" as const,
    status: "needs-adjudication" as const,
    reason,
    comparison,
    calibrationDigest: contract.calibrationDigest,
    executionIdentityDigest,
    truthPacketDigest: inspection?.packetDigest ?? null,
    comparedPanels,
    differingSteps: [...differingSteps],
  });
}

function snapshotCandidateRows(
  value: unknown,
  contract: RealBuildSourceParityCalibrationContract,
): readonly CalibrationCandidatePanel[] {
  boundedDenseSourceParityArray(
    value,
    contract.panels.length,
    contract.panels.length,
    "Calibration candidate W panels",
  );
  const rawRows = snapshotDenseSourceParityArray(value);
  const preflighted = rawRows.map((raw, index) => {
    const label = `Calibration candidate W row ${index}`;
    exactSourceParityKeys(raw, ROW_KEYS, label);
    const row = snapshotSourceParityRecord(raw as CalibrationCandidatePanel, ROW_KEYS);
    const expected = contract.panels[index]!;
    const width = sourceParityInteger(row.width, 1, 1_048_576, `${label}.width`);
    const height = sourceParityInteger(row.height, 1, 1_048_576, `${label}.height`);
    const pixelCount = width * height;
    if (
      row.stepNumber !== expected.stepNumber ||
      row.pageNumber !== expected.pageNumber ||
      width !== expected.width ||
      height !== expected.height ||
      row.pixelCount !== expected.pixelCount ||
      row.workFactor !== expected.workFactor ||
      !Number.isSafeInteger(pixelCount) ||
      pixelCount !== expected.pixelCount
    ) {
      throw new TypeError(
        `${label} does not reproduce contract step/page ${expected.stepNumber}/${expected.pageNumber}, ${expected.width}x${expected.height}, ${expected.pixelCount} pixels at factor ${expected.workFactor}.`,
      );
    }
    return { ...row, width, height, pixelCount };
  });
  return preflighted.map((row) => ({
    ...row,
    wMask: snapshotObservationSourceCandidateMask(row.wMask, row.pixelCount),
  }));
}

const rawDigest = (bytes: Uint8Array): Sha256Digest => `sha256:${sha256Hex(bytes)}`;

/** Pure inspection decision; no current input can execute or authorize the full 359-panel probe. */
export function adjudicateRealBuildSourceParityCalibration(
  rawInput: unknown,
): RealBuildSourceParityCalibrationAdjudication {
  exactSourceParityKeys(
    rawInput,
    ["contract", "executionIdentityDigest", "truth", "candidatePanels"],
    "Source-parity calibration adjudication input",
  );
  const input = snapshotSourceParityRecord(
    rawInput as {
      readonly contract: unknown;
      readonly executionIdentityDigest: unknown;
      readonly truth: unknown;
      readonly candidatePanels: unknown;
    },
    ["contract", "executionIdentityDigest", "truth", "candidatePanels"],
  );
  const contract = requireRealBuildSourceParityCalibrationContract(input.contract);
  const executionIdentityDigest = sourceParityDigest(
    input.executionIdentityDigest,
    "Calibration current execution identity digest",
  ) as Sha256Digest;
  if (input.truth === null) {
    return result(
      contract,
      executionIdentityDigest,
      null,
      "human-truth-not-supplied",
      "not-run",
      0,
      [],
    );
  }
  const inspection = requireInspectedRealBuildSourceParityCalibrationPacket(input.truth);
  if (
    inspection.reviewedCalibrationDigest !== contract.calibrationDigest ||
    inspection.reviewedExecutionIdentityDigest !== executionIdentityDigest ||
    inspection.pdfDigest !== contract.pdfDigest ||
    inspection.fullPreparedPanelsDigest !== contract.fullPreparedPanelsDigest ||
    inspection.calibrationPreparedPanelsDigest !== contract.calibrationPreparedPanelsDigest ||
    inspection.panels.some((panel, index) => {
      const expected = contract.panels[index]!;
      return (
        panel.stepNumber !== expected.stepNumber ||
        panel.pageNumber !== expected.pageNumber ||
        panel.width !== expected.width ||
        panel.height !== expected.height ||
        panel.pixelCount !== expected.pixelCount ||
        panel.workFactor !== expected.workFactor
      );
    })
  ) {
    return result(
      contract,
      executionIdentityDigest,
      inspection,
      "claimed-review-evidence-drifted",
      "not-run",
      0,
      [],
    );
  }
  const candidates = snapshotCandidateRows(input.candidatePanels, contract);
  const differingSteps: number[] = [];
  for (let index = 0; index < candidates.length; index += 1) {
    const candidate = candidates[index]!;
    const inspectedMask = copyRealBuildSourceParityCalibrationInspectionMask(inspection, index);
    if (rawDigest(candidate.wMask) !== inspection.panels[index]!.unpackedDigest) {
      differingSteps.push(candidate.stepNumber);
      continue;
    }
    for (let pixel = 0; pixel < candidate.pixelCount; pixel += 1) {
      if (candidate.wMask[pixel] !== inspectedMask[pixel]) {
        differingSteps.push(candidate.stepNumber);
        break;
      }
    }
  }
  // There is deliberately no review-authority input. A later human-owned channel must add a
  // separately reviewed issuer/consumer boundary; packet bytes and matching candidates cannot
  // stand in for it. Exact equality remains an inspection fact and cannot change this refusal.
  return result(
    contract,
    executionIdentityDigest,
    inspection,
    "human-review-authority-not-supplied",
    differingSteps.length === 0
      ? "candidate-w-exactly-matches-unverified-packet"
      : "candidate-w-differs-from-unverified-packet",
    candidates.length,
    differingSteps,
  );
}
