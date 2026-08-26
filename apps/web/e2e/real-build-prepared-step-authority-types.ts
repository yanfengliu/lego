import type { Sha256Digest } from "@lego-studio/brick-kernel";

import type { RealBuildBrowserOutputBoundary } from "./real-build-browser-output-types";
import type { RealBuildPanelRasterSpec, RealBuildPanelSpec } from "./real-build-safety";

declare const preparedStepAuthorityType: unique symbol;

export interface RealBuildPreparedAtomicPiece {
  readonly identityKey: string;
  readonly catalogPartId: string;
  readonly colorId: string;
}

export interface RealBuildPreparedStepCompilerMetadata {
  readonly name: string;
  readonly sourceActionDigest: Sha256Digest;
}

export interface RealBuildPreparedStepAuthority {
  readonly stepNumber: number;
  readonly preparedRunInputDigest: Sha256Digest;
  readonly printedStepIdentity: Sha256Digest;
  readonly compilerMetadata: RealBuildPreparedStepCompilerMetadata;
  readonly expectedAtomicPieces: readonly RealBuildPreparedAtomicPiece[];
  readonly [preparedStepAuthorityType]: true;
}

/** Bounded inspection only. This value cannot authorize placement or budget use. */
export type RealBuildPreparedStepInspection = Readonly<{
  stepNumber: number;
  preparedRunInputDigest: Sha256Digest;
  printedStepIdentity: Sha256Digest;
  compilerMetadata: RealBuildPreparedStepCompilerMetadata;
  expectedAtomicPieces: readonly RealBuildPreparedAtomicPiece[];
  authority: "absent";
}>;

export type RealBuildPreparedObservationPolicyInspection = Readonly<{
  preparedRunInputDigest: Sha256Digest;
  minimumScore: number;
  minimumMargin: number;
  authority: "absent";
}>;

/** One bounded parse of the complete prepared-run bytes, reusable only for inspection lookups. */
export type RealBuildPreparedRunInputInspection = Readonly<{
  preparedRunInputDigest: Sha256Digest;
  lastStep: number;
  authority: "absent";
}>;

/** Exact report-validation inputs retained by the same bounded prepared-run parse. */
export type RealBuildPreparedBrowserOutputBoundaryInspection = Readonly<
  RealBuildBrowserOutputBoundary & {
    readonly preparedRunInputDigest: Sha256Digest;
    /** Bounded source-bound observation rows. These carry no action or piece fields. */
    readonly passivePanels: readonly RealBuildPanelRasterSpec[];
    readonly authority: "absent";
  }
>;

export interface RealBuildPreparedPanelBoundsInspection {
  readonly minXPt: number;
  readonly maxXPt: number;
  readonly minYPt: number;
  readonly maxYPt: number;
}

/** Authority-free panel facts derived from one privately retained prepared-run parse. */
export type RealBuildPreparedPanelInspection = Readonly<{
  stepNumber: number;
  preparedRunInputDigest: Sha256Digest;
  preparedPanelIdentity: Sha256Digest;
  placementPrintedStepIdentity: Sha256Digest | null;
  pdfDigest: Sha256Digest;
  pageNumber: number;
  panelFace: "studs-up" | "underside" | null;
  bounds: RealBuildPreparedPanelBoundsInspection;
  calloutBoxes: readonly RealBuildPreparedPanelBoundsInspection[];
  panelEvidenceDigest: Sha256Digest;
  cropDigest: Sha256Digest;
  actionKind: RealBuildPanelSpec["action"]["kind"];
  assembledPieces: number;
  actionEvidenceDigest: Sha256Digest | null;
  actionCanonicalJson: string;
  actionDigest: Sha256Digest;
  expectedAtomicPieces: readonly RealBuildPreparedAtomicPiece[];
  prerequisiteFailureCounts: Readonly<{
    coverageFailures: number;
    unresolvedCallouts: number;
    missingDesigns: number;
  }>;
  authority: "absent";
}>;
