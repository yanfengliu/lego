import { canonicalDigest, type Sha256Digest } from "@lego-studio/brick-kernel";

import type {
  RealBuildPrefix50Step44RealDomainSourceCase,
  RealBuildPrefix50Step44RealDomainSourceSequence,
} from "../e2e/real-build-prefix50-subbuild-return-review-camera-real-domain-source.ts";
import type { RealBuildPrefix50Step44RealDomainPredecessorCase } from "../e2e/real-build-prefix50-subbuild-return-review-camera-real-domain-predecessor.ts";

const WIDTH = 720;
const HEIGHT = 470;
const caseBrands = new WeakSet<object>();
const sequenceBrands = new WeakSet<object>();
const predecessorBrands = new WeakSet<object>();
const pixelVault = new WeakMap<
  object,
  Readonly<{
    rgba: Uint8Array;
    eligibleMask: Uint8Array;
    parentOnlyForegroundMask: Uint8Array;
  }>
>();

function fixtureDigest(label: string): Sha256Digest {
  return canonicalDigest({ persistedQualificationFixture: label });
}

function syntheticCase(
  panelStep: 41 | 42,
  sourceLockCommitment: Sha256Digest,
): RealBuildPrefix50Step44RealDomainSourceCase {
  const rgba = new Uint8Array(WIDTH * HEIGHT * 4);
  for (let offset = 0; offset < rgba.length; offset += 4)
    rgba.set([0x89, 0x90, 0x93, 0xff], offset);
  const eligibleMask = new Uint8Array(WIDTH * HEIGHT).fill(1);
  const parentOnlyForegroundMask = new Uint8Array(WIDTH * HEIGHT).fill(1);
  const body = {
    schemaVersion: "lego.test-only-synthetic-real-domain-source-case/1" as const,
    authority: "test-only-downstream-persistence-seam" as const,
    panelStep,
    splitRole: "calibration" as const,
    sourceLockCommitment,
    pageRasterCommitment: fixtureDigest("page-raster"),
    sourceCaseCommitment: fixtureDigest(`synthetic-source-case-${panelStep}`),
  };
  const sourceCase = Object.freeze({
    ...body,
    commitment: canonicalDigest(body),
  }) as unknown as RealBuildPrefix50Step44RealDomainSourceCase;
  caseBrands.add(sourceCase);
  pixelVault.set(sourceCase, { rgba, eligibleMask, parentOnlyForegroundMask });
  return sourceCase;
}

export function createSyntheticPersistedQualificationSourceSequence(
  sourceLockCommitment: Sha256Digest,
): RealBuildPrefix50Step44RealDomainSourceSequence {
  const calibrationCases = [
    syntheticCase(41, sourceLockCommitment),
    syntheticCase(42, sourceLockCommitment),
  ] as const;
  const body = {
    calibrationCases,
    sourceLockCommitment,
    pageRasterCommitment: fixtureDigest("page-raster"),
    sharedOrientationAnchorCommitment: fixtureDigest("synthetic-anchor"),
  };
  const sequence = Object.freeze({
    ...body,
    commitment: canonicalDigest(body),
  }) as RealBuildPrefix50Step44RealDomainSourceSequence;
  sequenceBrands.add(sequence);
  return sequence;
}

export function isSyntheticPersistedQualificationSourceCase(value: object): boolean {
  return caseBrands.has(value);
}

export function isSyntheticPersistedQualificationSourceSequence(value: object): boolean {
  return sequenceBrands.has(value);
}

export function readSyntheticPersistedQualificationSourceCasePixels(value: object) {
  const pixels = pixelVault.get(value);
  if (!caseBrands.has(value) || pixels === undefined)
    throw new TypeError("Test-only synthetic source case lacks its private brand.");
  return {
    rgba: new Uint8Array(pixels.rgba),
    eligibleMask: new Uint8Array(pixels.eligibleMask),
    parentOnlyForegroundMask: new Uint8Array(pixels.parentOnlyForegroundMask),
  };
}

export function createSyntheticPersistedQualificationPredecessorCase(
  panelStep: 41 | 42,
): RealBuildPrefix50Step44RealDomainPredecessorCase {
  const predecessor = Object.freeze({ panelStep, splitRole: "calibration" as const });
  predecessorBrands.add(predecessor);
  return predecessor as unknown as RealBuildPrefix50Step44RealDomainPredecessorCase;
}

export function isSyntheticPersistedQualificationPredecessorCase(value: object): boolean {
  return predecessorBrands.has(value);
}
