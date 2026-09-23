import type {
  RealBuildPrefix50EligibleMaskSearchOptions,
  RealBuildPrefix50EligibleMaskSearchRefusal,
} from "./real-build-prefix50-subbuild-return-review-camera-registration-types.ts";
import {
  cameraSearchRowOrder,
  diverseCameraSearchRows,
  snappedCameraSearchCoordinate,
  type RealBuildPrefix50CameraSearchCandidate as Candidate,
} from "./real-build-prefix50-subbuild-return-review-camera-registration-support.ts";
import type { RealBuildPrefix50SimilaritySearchCoordinate as SearchCoordinate } from "./real-build-prefix50-subbuild-return-review-camera-registration-primitives.ts";
import { similarityCoordinateKey } from "./real-build-prefix50-subbuild-return-review-camera-registration-primitives.ts";

export interface RealBuildPrefix50SampledCameraRefinement {
  readonly hypotheses: readonly SearchCoordinate[];
  readonly callerBasin: SearchCoordinate;
  readonly analyticBasin: SearchCoordinate | null;
  readonly refinementStarts: number;
}

export function refineRealBuildPrefix50SampledCameraBasins(input: {
  readonly coarseCandidates: readonly Candidate[];
  readonly beamWidth: number;
  readonly identity: SearchCoordinate;
  readonly callerInitial: Candidate | null;
  readonly analyticInitial: Candidate | null;
  readonly options: Required<RealBuildPrefix50EligibleMaskSearchOptions>;
  readonly evaluate: (coordinate: SearchCoordinate) => Candidate | null;
  readonly readBudgetReason: () => RealBuildPrefix50EligibleMaskSearchRefusal | null;
}): RealBuildPrefix50SampledCameraRefinement {
  let hypotheses = diverseCameraSearchRows(input.coarseCandidates, input.beamWidth).map(
    (candidate) => candidate.coordinate,
  );
  let callerBasin = input.callerInitial?.coordinate ?? input.identity;
  let analyticBasin = input.analyticInitial?.coordinate ?? null;
  const refinementStarts = new Set(
    [input.callerInitial?.coordinate, input.analyticInitial?.coordinate, ...hypotheses]
      .filter(
        (coordinate): coordinate is SearchCoordinate =>
          coordinate !== undefined && coordinate !== null,
      )
      .map(similarityCoordinateKey),
  ).size;
  let centerStep = Math.max(
    input.options.finalCenterCellPx,
    input.options.coarseStridePx / 2,
    input.options.initialCenterStepPx / 2,
  );
  let scaleStep = Math.max(
    input.options.finalRelativeScaleCell,
    input.options.initialRelativeScaleStep / 2,
  );
  const neighbors = (anchor: SearchCoordinate | null): Candidate[] => {
    if (anchor === null) return [];
    const rows: Candidate[] = [];
    for (const scaleDirection of [-1, 0, 1])
      for (const yDirection of [-1, 0, 1])
        for (const xDirection of [-1, 0, 1]) {
          const candidate = input.evaluate(
            snappedCameraSearchCoordinate(
              {
                deltaX: anchor.deltaX + xDirection * centerStep,
                deltaY: anchor.deltaY + yDirection * centerStep,
                relativeScaleDelta: anchor.relativeScaleDelta + scaleDirection * scaleStep,
              },
              centerStep,
              scaleStep,
            ),
          );
          if (candidate !== null) rows.push(candidate);
        }
    return rows;
  };
  while (input.readBudgetReason() === null && hypotheses.length > 0) {
    callerBasin = neighbors(callerBasin).sort(cameraSearchRowOrder)[0]?.coordinate ?? callerBasin;
    analyticBasin =
      neighbors(analyticBasin).sort(cameraSearchRowOrder)[0]?.coordinate ?? analyticBasin;
    const expanded = new Map<string, Candidate>();
    for (const hypothesis of hypotheses)
      for (const candidate of neighbors(hypothesis))
        expanded.set(similarityCoordinateKey(candidate.coordinate), candidate);
    hypotheses = diverseCameraSearchRows([...expanded.values()], input.beamWidth).map(
      (candidate) => candidate.coordinate,
    );
    if (
      input.readBudgetReason() !== null ||
      (centerStep <= input.options.finalCenterCellPx &&
        scaleStep <= input.options.finalRelativeScaleCell)
    )
      break;
    centerStep = Math.max(input.options.finalCenterCellPx, centerStep / 2);
    scaleStep = Math.max(input.options.finalRelativeScaleCell, scaleStep / 2);
  }
  return { hypotheses, callerBasin, analyticBasin, refinementStarts };
}

export function refineRealBuildPrefix50ExactCameraBasin(input: {
  readonly start: SearchCoordinate | null;
  readonly options: Required<RealBuildPrefix50EligibleMaskSearchOptions>;
  readonly evaluate: (coordinate: SearchCoordinate) => Candidate | null;
  readonly readBudgetReason: () => RealBuildPrefix50EligibleMaskSearchRefusal | null;
  readonly order: (left: Candidate, right: Candidate) => number;
}): Candidate | null {
  if (input.start === null || input.readBudgetReason() !== null) return null;
  let anchor = input.evaluate(input.start);
  let centerStep = Math.max(
    input.options.finalCenterCellPx,
    Math.min(4, input.options.initialCenterStepPx / 2),
  );
  let scaleStep = Math.max(
    input.options.finalRelativeScaleCell,
    Math.min(0.02, input.options.initialRelativeScaleStep / 2),
  );
  while (anchor !== null && input.readBudgetReason() === null) {
    const rows: Candidate[] = [anchor];
    for (const scaleDirection of [-1, 0, 1])
      for (const yDirection of [-1, 0, 1])
        for (const xDirection of [-1, 0, 1]) {
          const candidate = input.evaluate(
            snappedCameraSearchCoordinate(
              {
                deltaX: anchor.coordinate.deltaX + xDirection * centerStep,
                deltaY: anchor.coordinate.deltaY + yDirection * centerStep,
                relativeScaleDelta:
                  anchor.coordinate.relativeScaleDelta + scaleDirection * scaleStep,
              },
              centerStep,
              scaleStep,
            ),
          );
          if (candidate !== null) rows.push(candidate);
        }
    anchor = rows.sort(input.order)[0] ?? anchor;
    if (
      centerStep <= input.options.finalCenterCellPx &&
      scaleStep <= input.options.finalRelativeScaleCell
    )
      break;
    centerStep = Math.max(
      input.options.finalCenterCellPx,
      centerStep <= 1 ? input.options.finalCenterCellPx : centerStep / 4,
    );
    scaleStep = Math.max(
      input.options.finalRelativeScaleCell,
      scaleStep <= 0.005 ? input.options.finalRelativeScaleCell : scaleStep / 4,
    );
  }
  return anchor;
}
