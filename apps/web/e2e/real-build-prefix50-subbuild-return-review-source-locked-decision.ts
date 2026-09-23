import { canonicalStringify, deepFreeze } from "@lego-studio/brick-kernel";

import { readRealBuildPrefix50Step44ReviewArtifact } from "./real-build-prefix50-subbuild-return-review-artifact-io.ts";
import {
  createRealBuildPrefix50Step44BlindDispositionLane,
  createRealBuildPrefix50Step44FullResolutionOutcome,
} from "./real-build-prefix50-subbuild-return-review-blind.ts";
import type {
  RealBuildPrefix50Step44BlindDispositionLane,
  RealBuildPrefix50Step44BlindReviewPacket,
  RealBuildPrefix50Step44FullResolutionOutcome,
} from "./real-build-prefix50-subbuild-return-review-blind-contract.ts";
import { preflightRealBuildPrefix50Step44ReviewJsonStructure } from "./real-build-prefix50-subbuild-return-review-harness-input.ts";
import { assertRealBuildPrefix50Step44CompleteLockedInputRoot } from "./real-build-prefix50-subbuild-return-review-source-locked-tree.ts";
import {
  requireRealBuildPrefix50Step44LockedInput,
  type RealBuildPrefix50Step44SourceLockCapability,
} from "./real-build-prefix50-subbuild-return-review-source-lock.ts";

export const REAL_BUILD_PREFIX50_STEP44_RAW_LANE_A_FILE =
  "real-build-prefix50-step44-lane-a-input.json" as const;
export const REAL_BUILD_PREFIX50_STEP44_RAW_LANE_B_FILE =
  "real-build-prefix50-step44-lane-b-input.json" as const;
export const REAL_BUILD_PREFIX50_STEP44_RAW_FULL_RESOLUTION_FILE =
  "real-build-prefix50-step44-full-resolution-input.json" as const;

type LaneCreatorInput = Parameters<typeof createRealBuildPrefix50Step44BlindDispositionLane>[0];
type FullCreatorInput = Parameters<typeof createRealBuildPrefix50Step44FullResolutionOutcome>[0];
type RawLane = Omit<LaneCreatorInput, "packet"> & {
  readonly schemaVersion: "lego.real-build-prefix50-step44-blind-lane-input/1";
};
type RawFullResolution = Omit<FullCreatorInput, "packet" | "lanes"> & {
  readonly schemaVersion: "lego.real-build-prefix50-step44-full-resolution-input/1";
};

function exactKeys(value: unknown, expected: readonly string[], label: string): void {
  if (value === null || typeof value !== "object" || Array.isArray(value))
    throw new TypeError(`${label} must be a data object.`);
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (actual.length !== wanted.length || actual.some((key, index) => key !== wanted[index]))
    throw new TypeError(`${label} must contain exactly ${wanted.join(", ")}.`);
}

function parseCanonical<T>(input: {
  readonly repositoryRoot: string;
  readonly logicalPath: string;
  readonly label: string;
  readonly capability: RealBuildPrefix50Step44SourceLockCapability;
}): T {
  const locked = requireRealBuildPrefix50Step44LockedInput(input.capability, input.logicalPath);
  const bytes = readRealBuildPrefix50Step44ReviewArtifact(
    input.repositoryRoot,
    input.logicalPath,
    locked.bytes,
    input.label,
    locked.digest,
  );
  if (bytes.byteLength !== locked.bytes) throw new TypeError(`${input.label} byte length drifted.`);
  const text = bytes.toString("utf8");
  const value: unknown = JSON.parse(text);
  preflightRealBuildPrefix50Step44ReviewJsonStructure(value);
  if (canonicalStringify(value) !== text)
    throw new TypeError(`${input.label} is not canonical JSON.`);
  return value as T;
}

function requireRawLane(value: RawLane, lane: "lane-a" | "lane-b"): void {
  exactKeys(
    value,
    ["lane", "reviewSessionId", "reviewerId", "rows", "schemaVersion"],
    `Step-44 raw ${lane}`,
  );
  if (
    value.schemaVersion !== "lego.real-build-prefix50-step44-blind-lane-input/1" ||
    value.lane !== lane
  )
    throw new TypeError(`Step-44 raw ${lane} schema or lane identity drifted.`);
  for (const [index, row] of value.rows.entries()) {
    exactKeys(
      row,
      ["blindId", "criteria", "shortlistNote", "shortlisted"],
      `Step-44 raw ${lane} row ${index + 1}`,
    );
    for (const [criterionIndex, criterion] of row.criteria.entries())
      exactKeys(
        criterion,
        ["criterionId", "note", "outcome"],
        `Step-44 raw ${lane} row ${index + 1} criterion ${criterionIndex + 1}`,
      );
  }
}

function requireRawFullResolution(value: RawFullResolution): void {
  exactKeys(
    value,
    ["disposition", "fullResolutionReviews", "schemaVersion"],
    "Step-44 raw full-resolution input",
  );
  if (value.schemaVersion !== "lego.real-build-prefix50-step44-full-resolution-input/1")
    throw new TypeError("Step-44 raw full-resolution schema drifted.");
  exactKeys(
    value.disposition,
    value.disposition.kind === "selected-one" ? ["blindId", "kind", "note"] : ["kind", "reason"],
    "Step-44 raw full-resolution disposition",
  );
  for (const [index, row] of value.fullResolutionReviews.entries()) {
    exactKeys(
      row,
      [
        "blindId",
        "criteria",
        "note",
        "reviewedCellCommitments",
        "reviewedFixedCameraEvidenceCommitment",
        "survives",
      ],
      `Step-44 raw full-resolution row ${index + 1}`,
    );
    for (const [criterionIndex, criterion] of row.criteria.entries())
      exactKeys(
        criterion,
        ["criterionId", "note", "outcome"],
        `Step-44 raw full-resolution row ${index + 1} criterion ${criterionIndex + 1}`,
      );
  }
}

export function deriveRealBuildPrefix50Step44SourceLockedDecision(input: {
  readonly repositoryRoot: string;
  readonly rawLogicalRoot: string;
  readonly packet: RealBuildPrefix50Step44BlindReviewPacket;
  readonly capability: RealBuildPrefix50Step44SourceLockCapability;
}): Readonly<{
  lanes: readonly [
    RealBuildPrefix50Step44BlindDispositionLane,
    RealBuildPrefix50Step44BlindDispositionLane,
  ];
  outcome: RealBuildPrefix50Step44FullResolutionOutcome;
}> {
  const laneAPath = `${input.rawLogicalRoot}/${REAL_BUILD_PREFIX50_STEP44_RAW_LANE_A_FILE}`;
  const laneBPath = `${input.rawLogicalRoot}/${REAL_BUILD_PREFIX50_STEP44_RAW_LANE_B_FILE}`;
  const fullResolutionPath = `${input.rawLogicalRoot}/${REAL_BUILD_PREFIX50_STEP44_RAW_FULL_RESOLUTION_FILE}`;
  const expectedPaths = [laneAPath, laneBPath, fullResolutionPath].sort((left, right) =>
    left.localeCompare(right),
  );
  const rows = assertRealBuildPrefix50Step44CompleteLockedInputRoot({
    repositoryRoot: input.repositoryRoot,
    logicalRoot: input.rawLogicalRoot,
    label: "Step-44 raw reviewer-input tree",
    capability: input.capability,
  });
  if (
    rows.length !== expectedPaths.length ||
    rows.some(({ path }, index) => path !== expectedPaths[index])
  )
    throw new TypeError(
      `Step-44 raw reviewer-input tree must contain exactly ${expectedPaths.join(", ")}.`,
    );
  const read = <T>(logicalPath: string, label: string): T =>
    parseCanonical<T>({ ...input, logicalPath, label });
  const rawA = read<RawLane>(laneAPath, "Step-44 raw lane-a input");
  const rawB = read<RawLane>(laneBPath, "Step-44 raw lane-b input");
  const rawFull = read<RawFullResolution>(fullResolutionPath, "Step-44 raw full-resolution input");
  requireRawLane(rawA, "lane-a");
  requireRawLane(rawB, "lane-b");
  requireRawFullResolution(rawFull);
  const laneA = createRealBuildPrefix50Step44BlindDispositionLane({
    ...rawA,
    packet: input.packet,
  });
  const laneB = createRealBuildPrefix50Step44BlindDispositionLane({
    ...rawB,
    packet: input.packet,
  });
  const outcome = createRealBuildPrefix50Step44FullResolutionOutcome({
    ...rawFull,
    packet: input.packet,
    lanes: [laneA, laneB],
  });
  assertRealBuildPrefix50Step44CompleteLockedInputRoot({
    repositoryRoot: input.repositoryRoot,
    logicalRoot: input.rawLogicalRoot,
    label: "Step-44 raw reviewer-input tree",
    capability: input.capability,
  });
  return deepFreeze({ lanes: [laneA, laneB] as const, outcome });
}
