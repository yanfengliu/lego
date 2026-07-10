// Generated from schemas/protocol.schema.json and schemas/fragments/*.schema.json. Do not edit by hand.
import type * as Wire from "./types.generated.js";

export type DeepReadonly<T> = T extends
  string | number | boolean | bigint | symbol | null | undefined
  ? T
  : T extends readonly unknown[]
    ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
    : T extends object
      ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
      : T;

export type LegoStudioProtocol = DeepReadonly<Wire.LegoStudioProtocol>;
export type Identifier = DeepReadonly<Wire.Identifier>;
export type Hash = DeepReadonly<Wire.Hash>;
export type LduVector = DeepReadonly<Wire.LduVector>;
export type LduCoordinate = DeepReadonly<Wire.LduCoordinate>;
export type ShortText = DeepReadonly<Wire.ShortText>;
export type ProgramOperation = DeepReadonly<Wire.ProgramOperation>;
export type BuildOperation = DeepReadonly<Wire.BuildOperation>;
export type TrustNamespaceV1 = DeepReadonly<Wire.TrustNamespaceV1>;
export type LongText = DeepReadonly<Wire.LongText>;
export type AttemptTerminalV1 = DeepReadonly<Wire.AttemptTerminalV1>;
export type UtcTimestamp = DeepReadonly<Wire.UtcTimestamp>;
export type Ed25519Signature = DeepReadonly<Wire.Ed25519Signature>;
export type TemplateColorValueV1 = DeepReadonly<Wire.TemplateColorValueV1>;
export type TruthSnapshot = DeepReadonly<Wire.TruthSnapshot>;
export type SnapshotRef = DeepReadonly<Wire.SnapshotRef>;
export type RigidTransform = DeepReadonly<Wire.RigidTransform>;
export type BrickDocumentV1 = DeepReadonly<Wire.BrickDocumentV1>;
export type PartInstance = DeepReadonly<Wire.PartInstance>;
export type EntityProvenance = DeepReadonly<Wire.EntityProvenance>;
export type ConnectionEdge = DeepReadonly<Wire.ConnectionEdge>;
export type PartPortRef = DeepReadonly<Wire.PartPortRef>;
export type Submodel = DeepReadonly<Wire.Submodel>;
export type BuildStep = DeepReadonly<Wire.BuildStep>;
export type SemanticRegion = DeepReadonly<Wire.SemanticRegion>;
export type DocumentConstraints = DeepReadonly<Wire.DocumentConstraints>;
export type DocumentProvenance = DeepReadonly<Wire.DocumentProvenance>;
export type BuildProgramV1 = DeepReadonly<Wire.BuildProgramV1>;
export type PlacePartInstruction = DeepReadonly<Wire.PlacePartInstruction>;
export type AttachInstruction = DeepReadonly<Wire.AttachInstruction>;
export type RemovePartInstruction = DeepReadonly<Wire.RemovePartInstruction>;
export type ReplacePartInstruction = DeepReadonly<Wire.ReplacePartInstruction>;
export type MovePartInstruction = DeepReadonly<Wire.MovePartInstruction>;
export type RecolorPartInstruction = DeepReadonly<Wire.RecolorPartInstruction>;
export type AssignStepInstruction = DeepReadonly<Wire.AssignStepInstruction>;
export type InstantiateTemplateInstruction =
  DeepReadonly<Wire.InstantiateTemplateInstruction>;
export type TemplateParameter = DeepReadonly<Wire.TemplateParameter>;
export type AddPartOperation = DeepReadonly<Wire.AddPartOperation>;
export type RemovePartOperation = DeepReadonly<Wire.RemovePartOperation>;
export type UpdatePartOperation = DeepReadonly<Wire.UpdatePartOperation>;
export type AddConnectionOperation = DeepReadonly<Wire.AddConnectionOperation>;
export type RemoveConnectionOperation =
  DeepReadonly<Wire.RemoveConnectionOperation>;
export type ScopeCapabilityV1 = DeepReadonly<Wire.ScopeCapabilityV1>;
export type AllowedVolume = DeepReadonly<Wire.AllowedVolume>;
export type ScopeBudgets = DeepReadonly<Wire.ScopeBudgets>;
export type AssemblyPatchV1 = DeepReadonly<Wire.AssemblyPatchV1>;
export type GenerationProvenance = DeepReadonly<Wire.GenerationProvenance>;
export type ValidationIssue = DeepReadonly<Wire.ValidationIssue>;
export type ValidationReportV1 = DeepReadonly<Wire.ValidationReportV1>;
export type ArtifactRefV1 = DeepReadonly<Wire.ArtifactRefV1>;
export type BuildBriefV1 = DeepReadonly<Wire.BuildBriefV1>;
export type GenerationBudgetsV1 = DeepReadonly<Wire.GenerationBudgetsV1>;
export type DataUseConsentV1 = DeepReadonly<Wire.DataUseConsentV1>;
export type ProviderCapabilitiesV1 = DeepReadonly<Wire.ProviderCapabilitiesV1>;
export type RenderPacketV1 = DeepReadonly<Wire.RenderPacketV1>;
export type RenderViewArtifactV1 = DeepReadonly<Wire.RenderViewArtifactV1>;
export type ActorObservationV1 = DeepReadonly<Wire.ActorObservationV1>;
export type OfferedControlV1 = DeepReadonly<Wire.OfferedControlV1>;
export type ControlBoundsV1 = DeepReadonly<Wire.ControlBoundsV1>;
export type ViewportV1 = DeepReadonly<Wire.ViewportV1>;
export type MakerObservationV1 = DeepReadonly<Wire.MakerObservationV1>;
export type MakerScopeProjectionV1 = DeepReadonly<Wire.MakerScopeProjectionV1>;
export type MakerDocumentSummaryV1 = DeepReadonly<Wire.MakerDocumentSummaryV1>;
export type CandidateProgramSubmissionV1 =
  DeepReadonly<Wire.CandidateProgramSubmissionV1>;
export type AttemptTranscriptV1 = DeepReadonly<Wire.AttemptTranscriptV1>;
export type AttemptSuccessTerminalV1 =
  DeepReadonly<Wire.AttemptSuccessTerminalV1>;
export type AttemptNoMutationTerminalV1 =
  DeepReadonly<Wire.AttemptNoMutationTerminalV1>;
export type AttemptFailureTerminalV1 =
  DeepReadonly<Wire.AttemptFailureTerminalV1>;
export type GenerationJobRecordV1 = DeepReadonly<Wire.GenerationJobRecordV1>;
export type CandidateRecordV1 = DeepReadonly<Wire.CandidateRecordV1>;
export type CandidateMetricsV1 = DeepReadonly<Wire.CandidateMetricsV1>;
export type PresentedPatchEnvelopeV1 =
  DeepReadonly<Wire.PresentedPatchEnvelopeV1>;
export type Ed25519SealV1 = DeepReadonly<Wire.Ed25519SealV1>;
export type AcceptanceAuthorizationV1 =
  DeepReadonly<Wire.AcceptanceAuthorizationV1>;
export type RunEventV1 = DeepReadonly<Wire.RunEventV1>;
export type NativeSealedRunManifestV1 =
  DeepReadonly<Wire.NativeSealedRunManifestV1>;
export type ReplayClosureCertificateV1 =
  DeepReadonly<Wire.ReplayClosureCertificateV1>;
export type DeterministicMakerOutputV1 =
  DeepReadonly<Wire.DeterministicMakerOutputV1>;
export type DeterministicMakerOutputSlotV1 =
  DeepReadonly<Wire.DeterministicMakerOutputSlotV1>;
export type DeterministicMakerProgramOutcomeV1 =
  DeepReadonly<Wire.DeterministicMakerProgramOutcomeV1>;
export type DeterministicMakerFailureOutcomeV1 =
  DeepReadonly<Wire.DeterministicMakerFailureOutcomeV1>;
export type DeterministicMakerGenerationFailureV1 =
  DeepReadonly<Wire.DeterministicMakerGenerationFailureV1>;
export type TemplateSnapshotV1 = DeepReadonly<Wire.TemplateSnapshotV1>;
export type TemplateColorParameterV1 =
  DeepReadonly<Wire.TemplateColorParameterV1>;
export type TemplateFixedPartV1 = DeepReadonly<Wire.TemplateFixedPartV1>;
export type TemplateLiteralColorV1 = DeepReadonly<Wire.TemplateLiteralColorV1>;
export type TemplateParameterColorV1 =
  DeepReadonly<Wire.TemplateParameterColorV1>;
export type TemplateInternalConnectionV1 =
  DeepReadonly<Wire.TemplateInternalConnectionV1>;
export type TemplateLocalPortRefV1 = DeepReadonly<Wire.TemplateLocalPortRefV1>;
export type TemplateExternalPortV1 = DeepReadonly<Wire.TemplateExternalPortV1>;
export type TemplateClearanceVolumeV1 =
  DeepReadonly<Wire.TemplateClearanceVolumeV1>;
export type TemplateProvenanceV1 = DeepReadonly<Wire.TemplateProvenanceV1>;
export type TemplateLicenseV1 = DeepReadonly<Wire.TemplateLicenseV1>;
