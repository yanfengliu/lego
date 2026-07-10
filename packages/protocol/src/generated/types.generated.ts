// Generated from schemas/protocol.schema.json. Do not edit by hand.

/**
 * Authoritative version-1 wire contracts for canonical brick documents, untrusted build programs, trusted patches, scope, and validation.
 */
export type LegoStudioProtocol =
  | TruthSnapshot
  | RigidTransform
  | BrickDocumentV1
  | BuildProgramV1
  | ScopeCapabilityV1
  | AssemblyPatchV1
  | ValidationReportV1;
export type Identifier = string;
export type Hash = string;
/**
 * @minItems 3
 * @maxItems 3
 */
export type LduVector = [LduCoordinate, LduCoordinate, LduCoordinate];
export type LduCoordinate = number;
export type ShortText = string;
export type ProgramOperation =
  | PlacePartInstruction
  | AttachInstruction
  | RemovePartInstruction
  | ReplacePartInstruction
  | MovePartInstruction
  | RecolorPartInstruction
  | AssignStepInstruction
  | InstantiateTemplateInstruction;
export type BuildOperation =
  | AddPartOperation
  | RemovePartOperation
  | UpdatePartOperation
  | AddConnectionOperation
  | RemoveConnectionOperation;

export interface TruthSnapshot {
  schemaVersion: "lego.truth-snapshot/1";
  catalog: SnapshotRef;
  connectorTaxonomy: SnapshotRef;
  collisionModel: SnapshotRef;
  transformPolicy: SnapshotRef;
  validatorSet: SnapshotRef;
}
export interface SnapshotRef {
  id: Identifier;
  version: Identifier;
  hash: Hash;
}
export interface RigidTransform {
  positionLdu: LduVector;
  orientationId: Identifier;
}
export interface BrickDocumentV1 {
  schemaVersion: "lego.brick-document/1";
  id: Identifier;
  revision: Identifier;
  truth: TruthSnapshot;
  name: ShortText;
  parts: PartInstance[];
  connections: ConnectionEdge[];
  submodels: Submodel[];
  steps: BuildStep[];
  semanticRegions: SemanticRegion[];
  constraints: DocumentConstraints;
  provenance: DocumentProvenance;
}
export interface PartInstance {
  id: Identifier;
  catalogPartId: Identifier;
  colorId: Identifier;
  transform: RigidTransform;
  submodelId: Identifier;
  stepId: Identifier;
  semanticTags: Identifier[];
  provenance: EntityProvenance;
}
export interface EntityProvenance {
  source: "manual" | "ai" | "import" | "template" | "migration";
  sourceId?: Identifier;
}
export interface ConnectionEdge {
  id: Identifier;
  kind: "stud-tube";
  a: PartPortRef;
  b: PartPortRef;
  provenance: EntityProvenance;
}
export interface PartPortRef {
  partId: Identifier;
  portId: Identifier;
}
export interface Submodel {
  id: Identifier;
  name: ShortText;
  partIds: Identifier[];
}
export interface BuildStep {
  id: Identifier;
  index: number;
  name: ShortText;
  partIds: Identifier[];
}
export interface SemanticRegion {
  id: Identifier;
  label: ShortText;
  partIds: Identifier[];
}
export interface DocumentConstraints {
  maxParts: number;
  allowedCatalogPartIds: Identifier[];
  allowedColorIds: Identifier[];
}
export interface DocumentProvenance {
  origin: "manual" | "import" | "migration";
  sourceId?: Identifier;
}
export interface BuildProgramV1 {
  schemaVersion: "lego.build-program/1";
  operations: ProgramOperation[];
}
export interface PlacePartInstruction {
  kind: "placePart";
  operationId: Identifier;
  localPartId: Identifier;
  catalogPartId: Identifier;
  colorId: Identifier;
  transform: RigidTransform;
  submodelId: Identifier;
  stepId: Identifier;
  semanticTags: Identifier[];
}
export interface AttachInstruction {
  kind: "attach";
  operationId: Identifier;
  a: PartPortRef;
  b: PartPortRef;
  connectionKind: "stud-tube";
}
export interface RemovePartInstruction {
  kind: "removePart";
  operationId: Identifier;
  partId: Identifier;
}
export interface ReplacePartInstruction {
  kind: "replacePart";
  operationId: Identifier;
  partId: Identifier;
  catalogPartId: Identifier;
  colorId: Identifier;
}
export interface MovePartInstruction {
  kind: "movePart";
  operationId: Identifier;
  partId: Identifier;
  transform: RigidTransform;
}
export interface RecolorPartInstruction {
  kind: "recolorPart";
  operationId: Identifier;
  partId: Identifier;
  colorId: Identifier;
}
export interface AssignStepInstruction {
  kind: "assignStep";
  operationId: Identifier;
  partId: Identifier;
  stepId: Identifier;
}
export interface InstantiateTemplateInstruction {
  kind: "instantiateTemplate";
  operationId: Identifier;
  instanceLocalId: Identifier;
  templateId: Identifier;
  parameters: TemplateParameter[];
  transform: RigidTransform;
  submodelId: Identifier;
  stepId: Identifier;
}
export interface TemplateParameter {
  name: Identifier;
  value: string | number | boolean;
}
export interface ScopeCapabilityV1 {
  schemaVersion: "lego.scope-capability/1";
  capabilityId: Identifier;
  baseRevision: Identifier;
  baseDocumentHash: Hash;
  frozenPartIds: Identifier[];
  mutablePartIds: Identifier[];
  requiredAttachmentPorts: PartPortRef[];
  allowedVolume: AllowedVolume;
  allowedCatalogPartIds: Identifier[];
  allowedColorIds: Identifier[];
  budgets: ScopeBudgets;
}
export interface AllowedVolume {
  minLdu: LduVector;
  maxLdu: LduVector;
}
export interface ScopeBudgets {
  maxAddedParts: number;
  maxRemovedParts: number;
  maxOperations: number;
}
export interface AssemblyPatchV1 {
  schemaVersion: "lego.assembly-patch/1";
  baseRevision: Identifier;
  baseDocumentHash: Hash;
  truthSnapshotHash: Hash;
  scopeCapabilityId: Identifier;
  scopeDigest: Hash;
  operations: BuildOperation[];
  provenance: GenerationProvenance;
}
export interface AddPartOperation {
  kind: "addPart";
  operationId: Identifier;
  part: PartInstance;
  semanticRegionIds: Identifier[];
}
export interface RemovePartOperation {
  kind: "removePart";
  operationId: Identifier;
  part: PartInstance;
  semanticRegionIds: Identifier[];
}
export interface UpdatePartOperation {
  kind: "updatePart";
  operationId: Identifier;
  before: PartInstance;
  after: PartInstance;
}
export interface AddConnectionOperation {
  kind: "addConnection";
  operationId: Identifier;
  connection: ConnectionEdge;
}
export interface RemoveConnectionOperation {
  kind: "removeConnection";
  operationId: Identifier;
  connection: ConnectionEdge;
}
export interface GenerationProvenance {
  jobId: Identifier;
  candidateId: Identifier;
  compilerSnapshotHash: Hash;
  buildProgramHash: Hash;
}
export interface ValidationReportV1 {
  schemaVersion: "lego.validation-report/1";
  targetDocumentHash: Hash;
  truthSnapshotHash: Hash;
  validatorSetHash: Hash;
  patchValid: boolean;
  documentGloballyValid: boolean;
  issues: ValidationIssue[];
}
export interface ValidationIssue {
  issueId: Identifier;
  validatorId: Identifier;
  code: string;
  severity: "blocking" | "advisory";
  message: ShortText;
  path: string;
  partIds: Identifier[];
  connectionIds: Identifier[];
  scope: "patch" | "document";
}
