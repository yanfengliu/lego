import type { RealBuildPrefix50EligibleMaskSearchRefusal } from "./real-build-prefix50-subbuild-return-review-camera-registration-types.ts";
import {
  compareMaskAgreement,
  similarityCoordinateKey,
} from "./real-build-prefix50-subbuild-return-review-camera-registration-primitives.ts";
import { compareRealBuildPrefix50ExactWarpRuns } from "./real-build-prefix50-subbuild-return-review-camera-registration-runs.ts";
import type { RealBuildPrefix50CameraSearchCandidate as Candidate } from "./real-build-prefix50-subbuild-return-review-camera-registration-support.ts";

export interface RealBuildPrefix50CoarseTieClassification {
  readonly expected: number;
  readonly classified: number;
  readonly complete: boolean;
  readonly centerBoundaryHit: boolean;
  readonly scaleBoundaryHit: boolean;
  readonly equivalentSeeds: readonly Candidate[];
}

export interface RealBuildPrefix50ExactTieClassification {
  readonly expected: number;
  readonly classified: number;
  readonly complete: boolean;
  readonly equivalentSeeds: readonly Candidate[];
}

export interface RealBuildPrefix50SearchBoundaryHit {
  readonly centerBoundaryHit: boolean;
  readonly scaleBoundaryHit: boolean;
}

export interface RealBuildPrefix50EquivalentRasterClassifier {
  readonly reset: (best: Candidate) => void;
  readonly classify: (candidate: Candidate, best: Candidate | null) => boolean;
  readonly isClassified: (candidate: Candidate) => boolean;
  readonly isEquivalent: (candidate: Candidate) => boolean;
  readonly equivalentCandidates: () => readonly Candidate[];
  readonly equivalentTieCount: () => number;
  readonly runComparisonsPerformed: () => number;
  readonly ambiguous: () => boolean;
}

export function createRealBuildPrefix50EquivalentRasterClassifier(input: {
  readonly chargeComparison: (maximumVisits: number) => boolean;
  readonly recordComparisonVisits: (visits: number) => void;
}): RealBuildPrefix50EquivalentRasterClassifier {
  const equivalentCandidates = new Map<string, Candidate>();
  const distinctKeys = new Set<string>();
  let equivalentTieCount = 0;
  let runComparisonsPerformed = 0;
  let ambiguous = false;
  return {
    reset(best) {
      equivalentTieCount = 0;
      ambiguous = false;
      equivalentCandidates.clear();
      equivalentCandidates.set(similarityCoordinateKey(best.coordinate), best);
      distinctKeys.clear();
    },
    classify(candidate, best) {
      if (best === null || compareMaskAgreement(candidate.agreement, best.agreement) !== 0)
        return false;
      const key = similarityCoordinateKey(candidate.coordinate);
      if (equivalentCandidates.has(key)) return true;
      if (distinctKeys.has(key)) return false;
      const candidateOffscreen =
        candidate.agreement.warpedUnclipped - candidate.agreement.warpedInRaster;
      const bestOffscreen = best.agreement.warpedUnclipped - best.agreement.warpedInRaster;
      if (candidateOffscreen !== bestOffscreen) {
        distinctKeys.add(key);
        ambiguous = true;
        return false;
      }
      if (best.eligibleWarpRuns === undefined || candidate.eligibleWarpRuns === undefined)
        throw new TypeError(
          "Exact camera candidates must retain canonical eligible-warp row spans.",
        );
      const maximumVisits = Math.max(
        best.eligibleWarpRuns.length,
        candidate.eligibleWarpRuns.length,
      );
      if (!input.chargeComparison(maximumVisits)) return false;
      runComparisonsPerformed += 1;
      const comparison = compareRealBuildPrefix50ExactWarpRuns(
        best.eligibleWarpRuns,
        candidate.eligibleWarpRuns,
      );
      input.recordComparisonVisits(comparison.visits);
      if (!comparison.equal) {
        distinctKeys.add(key);
        ambiguous = true;
        return false;
      }
      equivalentCandidates.set(key, candidate);
      equivalentTieCount += 1;
      return true;
    },
    isClassified(candidate) {
      const key = similarityCoordinateKey(candidate.coordinate);
      return equivalentCandidates.has(key) || distinctKeys.has(key);
    },
    isEquivalent(candidate) {
      return equivalentCandidates.has(similarityCoordinateKey(candidate.coordinate));
    },
    equivalentCandidates: () => [...equivalentCandidates.values()],
    equivalentTieCount: () => equivalentTieCount,
    runComparisonsPerformed: () => runComparisonsPerformed,
    ambiguous: () => ambiguous,
  };
}

export function classifyRealBuildPrefix50CoarseObjectiveTies(input: {
  readonly coarseCandidates: readonly Candidate[];
  readonly best: Candidate | null;
  readonly boundaryFor: (coordinate: Candidate["coordinate"]) => RealBuildPrefix50SearchBoundaryHit;
  readonly evaluateExactCandidate: (candidate: Candidate) => Candidate | null;
  readonly classifier: RealBuildPrefix50EquivalentRasterClassifier;
  readonly readBudgetReason: () => RealBuildPrefix50EligibleMaskSearchRefusal | null;
}): RealBuildPrefix50CoarseTieClassification {
  if (input.best === null)
    return {
      expected: 0,
      classified: 0,
      complete: false,
      centerBoundaryHit: false,
      scaleBoundaryHit: false,
      equivalentSeeds: [],
    };
  const tyingRows = input.coarseCandidates.filter(
    (candidate) => compareMaskAgreement(candidate.agreement, input.best!.agreement) === 0,
  );
  const equivalentSeeds: Candidate[] = [];
  let classified = 0;
  for (const coarse of tyingRows) {
    const exact = input.evaluateExactCandidate(coarse);
    if (exact === null || input.readBudgetReason() !== null) break;
    input.classifier.classify(exact, input.best);
    if (!input.classifier.isClassified(exact)) break;
    classified += 1;
    if (input.classifier.isEquivalent(exact)) equivalentSeeds.push(exact);
  }
  const boundaries = tyingRows.map((candidate) => input.boundaryFor(candidate.coordinate));
  return {
    expected: tyingRows.length,
    classified,
    complete: classified === tyingRows.length,
    centerBoundaryHit: boundaries.some((boundary) => boundary.centerBoundaryHit),
    scaleBoundaryHit: boundaries.some((boundary) => boundary.scaleBoundaryHit),
    equivalentSeeds,
  };
}

export function classifyRealBuildPrefix50CachedExactObjectiveTies(input: {
  readonly candidates: readonly Candidate[];
  readonly best: Candidate | null;
  readonly classifier: RealBuildPrefix50EquivalentRasterClassifier;
  readonly readBudgetReason: () => RealBuildPrefix50EligibleMaskSearchRefusal | null;
}): RealBuildPrefix50ExactTieClassification {
  if (input.best === null)
    return { expected: 0, classified: 0, complete: false, equivalentSeeds: [] };
  const tyingRows = input.candidates.filter(
    (candidate) => compareMaskAgreement(candidate.agreement, input.best!.agreement) === 0,
  );
  let classified = 0;
  for (const candidate of tyingRows) {
    input.classifier.classify(candidate, input.best);
    if (input.readBudgetReason() !== null || !input.classifier.isClassified(candidate)) break;
    classified += 1;
  }
  return {
    expected: tyingRows.length,
    classified,
    complete: classified === tyingRows.length,
    equivalentSeeds: input.classifier.equivalentCandidates(),
  };
}
