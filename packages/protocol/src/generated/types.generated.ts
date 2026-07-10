// Generated from schemas/protocol.schema.json and schemas/fragments/*.schema.json. Do not edit by hand.

/**
 * Authoritative version-1 wire contracts for canonical brick documents, restricted generation, evidence, authority, and validation.
 */
export type LegoStudioProtocol =
  | TruthSnapshot
  | RigidTransform
  | BrickDocumentV1
  | BuildProgramV1
  | BuildOperation
  | ScopeCapabilityV1
  | AssemblyPatchV1
  | ValidationIssue
  | ValidationReportV1
  | TrustNamespaceV1
  | ArtifactRefV1
  | BuildBriefV1
  | ProviderCapabilitiesV1
  | RenderPacketV1
  | ActorObservationV1
  | MakerObservationV1
  | CandidateProgramSubmissionV1
  | AttemptTranscriptV1
  | GenerationJobRecordV1
  | CandidateRecordV1
  | PresentedPatchEnvelopeV1
  | AcceptanceAuthorizationV1
  | RunEventV1
  | NativeSealedRunManifestV1
  | DeterministicMakerOutputV1
  | TemplateSnapshotV1;
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
export type TrustNamespaceV1 = "production" | "test" | "evaluation";
export type LongText = string;
export type AttemptTerminalV1 =
  | AttemptSuccessTerminalV1
  | AttemptNoMutationTerminalV1
  | AttemptFailureTerminalV1;
export type UtcTimestamp = string;
export type Ed25519Signature = string;
export type TemplateColorValueV1 =
  TemplateLiteralColorV1 | TemplateParameterColorV1;

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
  templateVersion?: number;
  templateHash?: Hash;
  parameters: TemplateParameter[];
  transform: RigidTransform;
  submodelId: Identifier;
  stepId: Identifier;
}
export interface TemplateParameter {
  name: Identifier;
  value: string | number | boolean;
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
export interface GenerationProvenance {
  jobId: Identifier;
  candidateId: Identifier;
  compilerSnapshotHash: Hash;
  buildProgramHash: Hash;
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
export interface ValidationReportV1 {
  schemaVersion: "lego.validation-report/1";
  targetDocumentHash: Hash;
  truthSnapshotHash: Hash;
  validatorSetHash: Hash;
  patchValid: boolean;
  documentGloballyValid: boolean;
  issues: ValidationIssue[];
}
export interface ArtifactRefV1 {
  artifactId: Identifier;
  kind:
    | "input"
    | "program"
    | "patch"
    | "document"
    | "validation"
    | "render"
    | "critique"
    | "metrics"
    | "transcript"
    | "source"
    | "bundle"
    | "report"
    | "export";
  mediaType: string;
  sha256: Hash;
  byteLength: number;
  casKey: Hash;
}
export interface BuildBriefV1 {
  schemaVersion: "lego.build-brief/1";
  mode:
    "full" | "insertion" | "completion" | "replacement" | "repair" | "variant";
  prompt: LongText;
  referenceArtifactIds: Identifier[];
  referenceCameraAssumptions?: ShortText;
  baseRevision: Identifier;
  baseDocumentHash: Hash;
  allowedCatalogPartIds: Identifier[];
  allowedColorIds: Identifier[];
  pieceBudget: number;
  targetBoundsLdu?: AllowedVolume;
  semanticRequirements: ShortText[];
  styleTags: Identifier[];
  budgets: GenerationBudgetsV1;
  consent: DataUseConsentV1;
}
export interface GenerationBudgetsV1 {
  maxCandidates: number;
  maxRepairs: number;
  maxProviderCalls: number;
  maxTokens: number;
  maxCostMicros: number;
  maxWallTimeMs: number;
  maxRenders: number;
  maxStoredBytes: number;
}
export interface DataUseConsentV1 {
  policyVersion: Identifier;
  providerTransmission: "none" | "text-only" | "text-and-approved-assets";
  retainRunArtifacts: boolean;
  knowledgeUse: boolean;
  benchmarkUse: boolean;
  trainingUse: boolean;
}
export interface ProviderCapabilitiesV1 {
  schemaVersion: "lego.provider-capabilities/1";
  providerId: Identifier;
  policyVersion: Identifier;
  supportedProtocolVersions: Identifier[];
  supportedCatalogHashes: Hash[];
  inputKinds: ("text" | "image" | "mesh")[];
  supportsTools: boolean;
  supportsStreaming: boolean;
  cancellation: "real" | "best-effort" | "none";
  seedBehavior: "deterministic" | "best-effort" | "none";
  maxInputBytes: number;
  maxOutputBytes: number;
  maxTokens: number;
  execution: "local" | "external";
  retention: "none" | "transient" | "provider-policy";
  training: "prohibited" | "opt-out" | "allowed-with-consent";
  acceptedConsentClasses: ("none" | "text-only" | "text-and-approved-assets")[];
}
export interface RenderPacketV1 {
  schemaVersion: "lego.render-packet/1";
  documentHash: Hash;
  validationReportHash: Hash;
  rendererSnapshotHash: Hash;
  cameraSnapshotHash: Hash;
  capturePolicyHash: Hash;
  browserBuildHash: Hash;
  views: RenderViewArtifactV1[];
}
export interface RenderViewArtifactV1 {
  viewId: Identifier;
  pass:
    | "beauty"
    | "silhouette"
    | "depth"
    | "normal"
    | "part-id"
    | "connections"
    | "collision"
    | "disconnected"
    | "exposed-ports"
    | "support"
    | "closeup";
  artifact: ArtifactRefV1;
  width: number;
  height: number;
  devicePixelRatio: number;
}
export interface ActorObservationV1 {
  schemaVersion: "lego.actor-observation/1";
  observationHash: Hash;
  runId: Identifier;
  sequence: number;
  screenshotArtifact: ArtifactRefV1;
  visibleTextHash: Hash;
  offeredControls: OfferedControlV1[];
  viewport: ViewportV1;
  cameraSnapshotHash: Hash;
  renderConfigHash: Hash;
  applicationBuildHash: Hash;
  documentRevision: Identifier;
  documentHash: Hash;
  activeJobId?: Identifier;
  activeCandidateId?: Identifier;
}
export interface OfferedControlV1 {
  controlId: Identifier;
  label: ShortText;
  state: "enabled" | "disabled" | "selected";
  bounds: ControlBoundsV1;
  actionCategories: (
    | "click"
    | "type"
    | "select"
    | "drag"
    | "orbit"
    | "zoom"
    | "cancel"
    | "preview"
  )[];
}
export interface ControlBoundsV1 {
  x: number;
  y: number;
  width: number;
  height: number;
}
export interface ViewportV1 {
  width: number;
  height: number;
  devicePixelRatio: number;
}
export interface MakerObservationV1 {
  schemaVersion: "lego.maker-observation/1";
  observationHash: Hash;
  jobId: Identifier;
  attemptId: Identifier;
  consentPolicyHash: Hash;
  scopePolicyHash: Hash;
  baseRevision: Identifier;
  baseDocumentHash: Hash;
  brief: BuildBriefV1;
  scope: MakerScopeProjectionV1;
  documentSummary: MakerDocumentSummaryV1;
  validationSummary: ValidationReportV1;
  parentDiffArtifact?: ArtifactRefV1;
  renderPacket: RenderPacketV1;
  referenceArtifacts: ArtifactRefV1[];
  templateSnapshotHashes: Hash[];
  lessonSnapshotHashes: Hash[];
  remainingBudgets: GenerationBudgetsV1;
}
export interface MakerScopeProjectionV1 {
  mutablePartIds: Identifier[];
  readOnlyBoundaryPartIds: Identifier[];
  requiredAttachmentPorts: PartPortRef[];
  allowedVolume: AllowedVolume;
  allowedCatalogPartIds: Identifier[];
  allowedColorIds: Identifier[];
  budgets: ScopeBudgets;
}
export interface MakerDocumentSummaryV1 {
  partCount: number;
  connectionCount: number;
  componentCount: number;
  exposedPortCount: number;
  semanticTags: Identifier[];
  boundsLdu: AllowedVolume;
}
export interface CandidateProgramSubmissionV1 {
  schemaVersion: "lego.candidate-program-submission/1";
  jobId: Identifier;
  attemptId: Identifier;
  observationHash: Hash;
  program: BuildProgramV1;
}
export interface AttemptTranscriptV1 {
  schemaVersion: "lego.attempt-transcript/1";
  runId: Identifier;
  attemptId: Identifier;
  sequence: number;
  kind: "maker" | "provider" | "browser" | "critic";
  observationHash: Hash;
  inputArtifactHashes: Hash[];
  deadlineMs: number;
  startedEventHash: Hash;
  terminalEventHash: Hash;
  terminal: AttemptTerminalV1;
}
export interface AttemptSuccessTerminalV1 {
  status: "success";
  proposedDecisionArtifactHash?: Hash;
  executedActionArtifactHash?: Hash;
  commandTransactionHash?: Hash;
  preDocumentHash: Hash;
  postDocumentHash: Hash;
}
export interface AttemptNoMutationTerminalV1 {
  status: "staleObservation" | "capabilityRejected" | "controlUnavailable";
  proposedDecisionArtifactHash: Hash;
  reasonCode: Identifier;
  preDocumentHash: Hash;
  postDocumentHash: Hash;
}
export interface AttemptFailureTerminalV1 {
  status:
    | "timeout"
    | "malformedOutput"
    | "refusal"
    | "cancelled"
    | "crash"
    | "persistenceFailed";
  reasonCode: Identifier;
  proposedDecisionArtifactHash?: Hash;
  preDocumentHash: Hash;
  postDocumentHash: Hash;
}
export interface GenerationJobRecordV1 {
  schemaVersion: "lego.generation-job/1";
  namespace: "production" | "test";
  jobId: Identifier;
  idempotencyKey: Identifier;
  state:
    | "created"
    | "queued"
    | "running"
    | "draining"
    | "cancelling"
    | "cancelled"
    | "succeeded"
    | "failed"
    | "exhausted"
    | "persistenceFailed";
  baseRevision: Identifier;
  baseDocumentHash: Hash;
  truthSnapshotHash: Hash;
  scopeCapabilityId: Identifier;
  scopeDigest: Hash;
  briefHash: Hash;
  budgets: GenerationBudgetsV1;
  cancellationGeneration: number;
  candidateIds: Identifier[];
  eventSequence: number;
}
export interface CandidateRecordV1 {
  schemaVersion: "lego.candidate-record/1";
  jobId: Identifier;
  candidateId: Identifier;
  parentCandidateId?: Identifier;
  cancellationGeneration: number;
  state:
    | "received"
    | "compiled"
    | "compileRejected"
    | "hardValid"
    | "hardInvalid"
    | "diagnosticRendered"
    | "diagnosticReviewed"
    | "rendered"
    | "critiqued"
    | "ranked"
    | "presented"
    | "archived"
    | "cancelled"
    | "processingFailed"
    | "persistenceFailed";
  programArtifact: ArtifactRefV1;
  patchArtifact?: ArtifactRefV1;
  documentArtifact?: ArtifactRefV1;
  validationArtifact?: ArtifactRefV1;
  renderPacketArtifact?: ArtifactRefV1;
  critiqueArtifact?: ArtifactRefV1;
  metrics: CandidateMetricsV1;
  failureCodes?: Identifier[];
}
export interface CandidateMetricsV1 {
  partCount: number;
  operationCount: number;
  blockingIssueCount: number;
  advisoryIssueCount: number;
  intentScore?: number;
  visualScore?: number;
}
export interface PresentedPatchEnvelopeV1 {
  schemaVersion: "lego.presented-patch-envelope/1";
  namespace: "production" | "test";
  jobId: Identifier;
  candidateId: Identifier;
  cancellationGeneration: number;
  compilerSnapshotHash: Hash;
  buildProgramHash: Hash;
  validationReportHash: Hash;
  candidateState: "presented";
  patch: AssemblyPatchV1;
  issuedAt: UtcTimestamp;
  seal: Ed25519SealV1;
}
export interface Ed25519SealV1 {
  algorithm: "Ed25519";
  keyId: Identifier;
  keyEpoch: number;
  signature: Ed25519Signature;
}
export interface AcceptanceAuthorizationV1 {
  schemaVersion: "lego.acceptance-authorization/1";
  namespace: "production";
  authorizationId: Identifier;
  transactionId: Identifier;
  envelopeHash: Hash;
  baseDocumentHash: Hash;
  truthSnapshotHash: Hash;
  browserDeviceKeyId: Identifier;
  cancellationGeneration: number;
  issuedEventSequence: number;
  issuedEventRoot: Hash;
  seal: Ed25519SealV1;
}
export interface RunEventV1 {
  schemaVersion: "lego.run-event/1";
  runId: Identifier;
  sequence: number;
  previousEventHash: Hash;
  actorId: Identifier;
  transition: Identifier;
  idempotencyKey: Identifier;
  artifactHashes: Hash[];
  eventHash: Hash;
}
export interface NativeSealedRunManifestV1 {
  schemaVersion: "lego.native-run-manifest/1";
  namespace: "production" | "test";
  runId: Identifier;
  terminalState:
    "succeeded" | "exhausted" | "failed" | "cancelled" | "persistenceFailed";
  baseDocumentHash: Hash;
  truthSnapshotHash: Hash;
  applicationBuildHash: Hash;
  brokerBuildHash: Hash;
  harnessBuildHash: Hash;
  lockfileHash: Hash;
  runtimeHash: Hash;
  briefHash: Hash;
  scopeDigest: Hash;
  providerCapabilitiesHash?: Hash;
  budgets: GenerationBudgetsV1;
  candidateIds: Identifier[];
  eventCount: number;
  eventRoot: Hash;
  artifacts: ArtifactRefV1[];
  replayClosure: ReplayClosureCertificateV1;
  finalizedAt: UtcTimestamp;
  seal: Ed25519SealV1;
}
export interface ReplayClosureCertificateV1 {
  sealedReplayLevel: "full" | "downstream-only" | "metadata-only";
  earliestRetainedBoundary:
    "inputs" | "provider-response" | "program" | "metadata";
  artifactRoot: Hash;
  requiredArtifactHashes: Hash[];
  verifierVersion: Identifier;
}
export interface DeterministicMakerOutputV1 {
  schemaVersion: "lego.deterministic-maker-output/1";
  makerVersion: Identifier;
  slots: DeterministicMakerOutputSlotV1[];
}
export interface DeterministicMakerOutputSlotV1 {
  index: number;
  strategyId: Identifier;
  shape: "tower" | "staircase" | "spire" | "column";
  outcome:
    DeterministicMakerProgramOutcomeV1 | DeterministicMakerFailureOutcomeV1;
}
export interface DeterministicMakerProgramOutcomeV1 {
  kind: "program";
  program: BuildProgramV1;
  normalizedProgramHash: Hash;
}
export interface DeterministicMakerFailureOutcomeV1 {
  kind: "generationFailure";
  failure: DeterministicMakerGenerationFailureV1;
}
export interface DeterministicMakerGenerationFailureV1 {
  stage: "generation";
  code: "OPERATION_BUDGET_TOO_SMALL" | "NO_CONNECTION_PATH";
  message: string;
}
/**
 * Intrinsic immutable fixed-graph data. Admission must separately validate catalog parts, colors, transforms, and ports against the pinned catalog, truth, and admission-policy snapshots before compiler use.
 */
export interface TemplateSnapshotV1 {
  schemaVersion: "lego.template-snapshot/1";
  id: Identifier;
  version: number;
  parentId?: Identifier;
  contentHash: Hash;
  status: "draft" | "trial" | "canary" | "stable" | "rejected" | "deprecated";
  catalogHash: Hash;
  truthSnapshotHash: Hash;
  admissionPolicyHash: Hash;
  parameters: TemplateColorParameterV1[];
  parts: TemplateFixedPartV1[];
  internalConnections: TemplateInternalConnectionV1[];
  externalPorts: TemplateExternalPortV1[];
  clearanceVolume: TemplateClearanceVolumeV1;
  evidenceRunIds: Identifier[];
  counterexampleRunIds: Identifier[];
  benchmarkReportIds: Identifier[];
  provenance: TemplateProvenanceV1;
  license: TemplateLicenseV1;
}
export interface TemplateColorParameterV1 {
  kind: "color-enum";
  name: Identifier;
  allowedColorIds: Identifier[];
  defaultColorId?: Identifier;
}
export interface TemplateFixedPartV1 {
  localPartId: Identifier;
  catalogPartId: Identifier;
  color: TemplateColorValueV1;
  transform: RigidTransform;
  semanticTags: Identifier[];
}
export interface TemplateLiteralColorV1 {
  kind: "literal";
  colorId: Identifier;
}
export interface TemplateParameterColorV1 {
  kind: "parameter";
  parameterName: Identifier;
}
export interface TemplateInternalConnectionV1 {
  localConnectionId: Identifier;
  kind: "stud-tube";
  a: TemplateLocalPortRefV1;
  b: TemplateLocalPortRefV1;
}
export interface TemplateLocalPortRefV1 {
  localPartId: Identifier;
  portId: Identifier;
}
export interface TemplateExternalPortV1 {
  name: Identifier;
  endpoint: TemplateLocalPortRefV1;
}
export interface TemplateClearanceVolumeV1 {
  minLdu: LduVector;
  maxLdu: LduVector;
}
export interface TemplateProvenanceV1 {
  origin: "project" | "imported" | "generated";
  sourceId: Identifier;
  sourceHash?: Hash;
}
export interface TemplateLicenseV1 {
  spdxExpression: string;
  attribution: string;
  redistribution: "allowed" | "restricted" | "evaluation-only";
}
