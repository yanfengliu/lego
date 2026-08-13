export const STEP_13_ALIGNMENT_INPUT_SCHEMA = "lego.step-13-alignment-input/1" as const;

export type AlignmentStepNumber = 12 | 13 | 14;

export interface AlignmentIdentity {
  readonly brickRef: string;
  readonly designId: string;
}

export interface AlignmentPhase {
  readonly sequence: number;
  readonly phaseId: string;
  readonly subBuildPath: readonly string[];
  /** Detached caller assertion; the diagnostic reports this phase window as unverified. */
  readonly sourceIdentityCount: number;
  readonly identities: readonly AlignmentIdentity[];
}

export interface PairJudgement {
  readonly judgedCropDigest: string;
  readonly elementId: string;
  readonly designId: string;
  readonly verdict: "same" | "different";
}

export interface IdentificationEvidence {
  readonly ownCropDigest: string;
  readonly claimedElementId: string;
  readonly inheritedJudgement: PairJudgement | null;
  readonly candidates: readonly {
    readonly elementId: string;
    readonly designId: string;
    readonly distance: number;
  }[];
  readonly studCore: {
    readonly observedCount: number;
    readonly expectedByDesign: readonly {
      readonly designId: string;
      readonly count: number;
    }[];
  } | null;
}

export interface AlignmentCallout {
  readonly calloutKey: string;
  readonly quantity: number;
  readonly claimedDesignId: string;
  readonly identification: IdentificationEvidence | null;
}

export interface AlignmentStep {
  readonly stepNumber: AlignmentStepNumber;
  readonly callouts: readonly AlignmentCallout[];
}

export interface Step13AlignmentInput {
  readonly schemaVersion: typeof STEP_13_ALIGNMENT_INPUT_SCHEMA;
  readonly builderSourceDigest: string;
  readonly builderPhaseDigest: string;
  readonly phaseWindowStartIdentityCursor: number;
  readonly anchor: { readonly afterStepNumber: 12; readonly identityCursor: 26 };
  readonly phases: readonly AlignmentPhase[];
  readonly steps: readonly AlignmentStep[];
}
