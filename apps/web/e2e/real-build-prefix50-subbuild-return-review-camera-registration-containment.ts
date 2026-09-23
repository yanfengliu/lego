import type {
  RealBuildPrefix50EligibleMaskSearchOptions,
  RealBuildPrefix50EligibleMaskSearchRefusal,
} from "./real-build-prefix50-subbuild-return-review-camera-registration-types.ts";
import {
  compareMaskAgreement,
  similarityCoordinateKey,
  type RealBuildPrefix50SimilaritySearchCoordinate as SearchCoordinate,
} from "./real-build-prefix50-subbuild-return-review-camera-registration-primitives.ts";
import type { RealBuildPrefix50EquivalentRasterExtent as RasterExtent } from "./real-build-prefix50-subbuild-return-review-camera-registration-report.ts";
import type { RealBuildPrefix50CameraSearchCandidate as Candidate } from "./real-build-prefix50-subbuild-return-review-camera-registration-support.ts";

export interface RealBuildPrefix50LocalContainmentResult {
  readonly equivalentExtent: RasterExtent | null;
  readonly localNeighborOptimal: boolean;
  readonly equivalenceComponentComplete: boolean;
  readonly equivalenceComponentMembersVisited: number;
  readonly centerBoundaryHit: boolean;
  readonly scaleBoundaryHit: boolean;
}

function initialExtent(coordinate: SearchCoordinate): RasterExtent {
  return {
    minimumX: coordinate.deltaX,
    maximumX: coordinate.deltaX,
    minimumY: coordinate.deltaY,
    maximumY: coordinate.deltaY,
    minimumScale: coordinate.relativeScaleDelta,
    maximumScale: coordinate.relativeScaleDelta,
  };
}

function expandExtent(extent: RasterExtent, coordinate: SearchCoordinate): void {
  extent.minimumX = Math.min(extent.minimumX, coordinate.deltaX);
  extent.maximumX = Math.max(extent.maximumX, coordinate.deltaX);
  extent.minimumY = Math.min(extent.minimumY, coordinate.deltaY);
  extent.maximumY = Math.max(extent.maximumY, coordinate.deltaY);
  extent.minimumScale = Math.min(extent.minimumScale, coordinate.relativeScaleDelta);
  extent.maximumScale = Math.max(extent.maximumScale, coordinate.relativeScaleDelta);
}

export function proveRealBuildPrefix50LocalSearchContainment(input: {
  readonly options: Required<RealBuildPrefix50EligibleMaskSearchOptions>;
  readonly readBestCandidate: () => Candidate | null;
  readonly evaluateExactCandidate: (coordinate: SearchCoordinate) => Candidate | null;
  readonly isEquivalentBestRaster: (candidate: Candidate) => boolean;
  readonly readEquivalentSeeds: () => readonly Candidate[];
  readonly boundaryFor: (coordinate: SearchCoordinate) => {
    readonly centerBoundaryHit: boolean;
    readonly scaleBoundaryHit: boolean;
  };
  readonly readBudgetReason: () => RealBuildPrefix50EligibleMaskSearchRefusal | null;
}): RealBuildPrefix50LocalContainmentResult {
  let candidatesVisited = 0;
  searchAgain: while (input.readBudgetReason() === null) {
    const root = input.readBestCandidate();
    if (root === null) break;
    const seeds = input.readEquivalentSeeds();
    if (input.readBudgetReason() !== null)
      return {
        equivalentExtent: initialExtent(root.coordinate),
        localNeighborOptimal: false,
        equivalenceComponentComplete: false,
        equivalenceComponentMembersVisited: candidatesVisited,
        centerBoundaryHit: false,
        scaleBoundaryHit: false,
      };
    const extent = initialExtent(root.coordinate);
    let centerBoundaryHit = false;
    let scaleBoundaryHit = false;
    const queue: Candidate[] = [];
    const seen = new Set<string>();
    for (const candidate of [root, ...seeds]) {
      const key = similarityCoordinateKey(candidate.coordinate);
      if (seen.has(key)) continue;
      seen.add(key);
      queue.push(candidate);
    }
    for (let queueIndex = 0; queueIndex < queue.length; queueIndex += 1) {
      const current = queue[queueIndex]!;
      candidatesVisited += 1;
      expandExtent(extent, current.coordinate);
      const boundary = input.boundaryFor(current.coordinate);
      centerBoundaryHit ||= boundary.centerBoundaryHit;
      scaleBoundaryHit ||= boundary.scaleBoundaryHit;
      for (const scaleDirection of [-1, 0, 1])
        for (const yDirection of [-1, 0, 1])
          for (const xDirection of [-1, 0, 1]) {
            if (scaleDirection === 0 && yDirection === 0 && xDirection === 0) continue;
            const candidate = input.evaluateExactCandidate({
              deltaX: current.coordinate.deltaX + xDirection * input.options.finalCenterCellPx,
              deltaY: current.coordinate.deltaY + yDirection * input.options.finalCenterCellPx,
              relativeScaleDelta:
                current.coordinate.relativeScaleDelta +
                scaleDirection * input.options.finalRelativeScaleCell,
            });
            if (input.readBudgetReason() !== null)
              return {
                equivalentExtent: extent,
                localNeighborOptimal: false,
                equivalenceComponentComplete: false,
                equivalenceComponentMembersVisited: candidatesVisited,
                centerBoundaryHit,
                scaleBoundaryHit,
              };
            if (candidate === null) continue;
            const comparison = compareMaskAgreement(candidate.agreement, root.agreement);
            if (comparison > 0) continue searchAgain;
            if (comparison !== 0 || !input.isEquivalentBestRaster(candidate)) continue;
            const key = similarityCoordinateKey(candidate.coordinate);
            if (seen.has(key)) continue;
            seen.add(key);
            queue.push(candidate);
          }
    }
    return {
      equivalentExtent: extent,
      localNeighborOptimal: !centerBoundaryHit && !scaleBoundaryHit,
      equivalenceComponentComplete: true,
      equivalenceComponentMembersVisited: candidatesVisited,
      centerBoundaryHit,
      scaleBoundaryHit,
    };
  }
  return {
    equivalentExtent: null,
    localNeighborOptimal: false,
    equivalenceComponentComplete: false,
    equivalenceComponentMembersVisited: candidatesVisited,
    centerBoundaryHit: false,
    scaleBoundaryHit: false,
  };
}
