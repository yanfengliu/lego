// Generated from schemas/protocol.schema.json. Do not edit by hand.
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
export type ScopeCapabilityV1 = DeepReadonly<Wire.ScopeCapabilityV1>;
export type AllowedVolume = DeepReadonly<Wire.AllowedVolume>;
export type ScopeBudgets = DeepReadonly<Wire.ScopeBudgets>;
export type AssemblyPatchV1 = DeepReadonly<Wire.AssemblyPatchV1>;
export type AddPartOperation = DeepReadonly<Wire.AddPartOperation>;
export type RemovePartOperation = DeepReadonly<Wire.RemovePartOperation>;
export type UpdatePartOperation = DeepReadonly<Wire.UpdatePartOperation>;
export type AddConnectionOperation = DeepReadonly<Wire.AddConnectionOperation>;
export type RemoveConnectionOperation =
  DeepReadonly<Wire.RemoveConnectionOperation>;
export type GenerationProvenance = DeepReadonly<Wire.GenerationProvenance>;
export type ValidationReportV1 = DeepReadonly<Wire.ValidationReportV1>;
export type ValidationIssue = DeepReadonly<Wire.ValidationIssue>;
