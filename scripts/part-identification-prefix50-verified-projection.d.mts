import type { RealBuildPrefix50VerifiedProjection } from "../apps/web/e2e/real-build-prefix50-projection.js";

export interface VerifiedProjectionSourceRole {
  readonly bytes: Uint8Array;
  readonly verified: object;
}

export interface VerifiedProjectionAdapterInput {
  readonly actionPreparation: VerifiedProjectionSourceRole;
  readonly officialWorldReconciliation: VerifiedProjectionSourceRole;
}

export interface RealBuildPrefix50VerifiedProjectionReader {
  readonly readVerifiedPrefix50Projection: () => RealBuildPrefix50VerifiedProjection;
}

export function createRealBuildPrefix50VerifiedProjectionReader(
  value: VerifiedProjectionAdapterInput,
): RealBuildPrefix50VerifiedProjectionReader;

export function readOpaqueRealBuildPrefix50VerifiedProjection(
  value: unknown,
): RealBuildPrefix50VerifiedProjection;

export interface RealBuildPrefix50Occurrence30ActionBinding {
  readonly occurrenceOrdinal: 30;
  readonly printedStepNumber: 14;
  readonly phaseSequence: 18;
  readonly actionKind: "direct";
  readonly calloutIdentity: "p18|q1|x29.480|y468.911";
  readonly builderBrickRef: "40304bdc-7c5b-46cf-bdcc-61a53aeae2c4";
  readonly officialDesignId: "77844";
  readonly designRevision: "77844;B";
}

export function readOpaqueRealBuildPrefix50Occurrence30ActionBinding(
  value: unknown,
): RealBuildPrefix50Occurrence30ActionBinding;

export function readSyntheticRealBuildPrefix50ProjectionForTest(
  value: unknown,
): RealBuildPrefix50VerifiedProjection;

export const __testOnly: Readonly<{
  createSyntheticProjectionReaderForTest(
    projection: RealBuildPrefix50VerifiedProjection,
  ): RealBuildPrefix50VerifiedProjectionReader;
}>;
