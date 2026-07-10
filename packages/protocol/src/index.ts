import type { ErrorObject, ValidateFunction } from "ajv";

import {
  validateAcceptanceAuthorizationV1 as generatedValidateAcceptanceAuthorizationV1,
  validateActorObservationV1 as generatedValidateActorObservationV1,
  validateArtifactRefV1 as generatedValidateArtifactRefV1,
  validateAssemblyPatchV1 as generatedValidateAssemblyPatchV1,
  validateAttemptTranscriptV1 as generatedValidateAttemptTranscriptV1,
  validateBrickDocumentV1 as generatedValidateBrickDocumentV1,
  validateBuildBriefV1 as generatedValidateBuildBriefV1,
  validateBuildProgramV1 as generatedValidateBuildProgramV1,
  validateBuildOperation as generatedValidateBuildOperation,
  validateCandidateProgramSubmissionV1 as generatedValidateCandidateProgramSubmissionV1,
  validateCandidateRecordV1 as generatedValidateCandidateRecordV1,
  validateDataUseConsentV1 as generatedValidateDataUseConsentV1,
  validateGenerationBudgetsV1 as generatedValidateGenerationBudgetsV1,
  validateGenerationJobRecordV1 as generatedValidateGenerationJobRecordV1,
  validateMakerObservationV1 as generatedValidateMakerObservationV1,
  validateNativeSealedRunManifestV1 as generatedValidateNativeSealedRunManifestV1,
  validatePresentedPatchEnvelopeV1 as generatedValidatePresentedPatchEnvelopeV1,
  validateProviderCapabilitiesV1 as generatedValidateProviderCapabilitiesV1,
  validateRenderPacketV1 as generatedValidateRenderPacketV1,
  validateRigidTransform as generatedValidateRigidTransform,
  validateRunEventV1 as generatedValidateRunEventV1,
  validateScopeCapabilityV1 as generatedValidateScopeCapabilityV1,
  validateTemplateSnapshotV1 as generatedValidateTemplateSnapshotV1,
  validateTruthSnapshot as generatedValidateTruthSnapshot,
  validateTrustNamespaceV1 as generatedValidateTrustNamespaceV1,
  validateValidationIssue as generatedValidateValidationIssue,
  validateValidationReportV1 as generatedValidateValidationReportV1,
} from "./generated/validators.generated.js";

import type {
  AcceptanceAuthorizationV1,
  ActorObservationV1,
  ArtifactRefV1,
  AssemblyPatchV1,
  AttemptTranscriptV1,
  BrickDocumentV1,
  BuildBriefV1,
  BuildProgramV1,
  BuildOperation,
  CandidateProgramSubmissionV1,
  CandidateRecordV1,
  DataUseConsentV1,
  GenerationBudgetsV1,
  GenerationJobRecordV1,
  MakerObservationV1,
  NativeSealedRunManifestV1,
  PresentedPatchEnvelopeV1,
  ProviderCapabilitiesV1,
  RenderPacketV1,
  RigidTransform,
  RunEventV1,
  ScopeCapabilityV1,
  TemplateSnapshotV1,
  TruthSnapshot,
  TrustNamespaceV1,
  ValidationIssue,
  ValidationReportV1,
} from "./generated/public-types.generated.js";

import { checkTemplateSnapshotSemantics } from "./template-snapshot.ts";

export type * from "./generated/public-types.generated.js";
export * from "./template-snapshot.ts";

export const PROTOCOL_VERSION = "lego.protocol/1" as const;

const ROOT_SCHEMA_ID = "https://schemas.brick-studio.local/protocol/1";

export const SCHEMA_IDS = {
  root: ROOT_SCHEMA_ID,
  truthSnapshot: `${ROOT_SCHEMA_ID}#/definitions/TruthSnapshot`,
  rigidTransform: `${ROOT_SCHEMA_ID}#/definitions/RigidTransform`,
  brickDocumentV1: `${ROOT_SCHEMA_ID}#/definitions/BrickDocumentV1`,
  buildProgramV1: `${ROOT_SCHEMA_ID}#/definitions/BuildProgramV1`,
  buildOperation: `${ROOT_SCHEMA_ID}#/definitions/BuildOperation`,
  scopeCapabilityV1: `${ROOT_SCHEMA_ID}#/definitions/ScopeCapabilityV1`,
  assemblyPatchV1: `${ROOT_SCHEMA_ID}#/definitions/AssemblyPatchV1`,
  templateSnapshotV1: `${ROOT_SCHEMA_ID}#/definitions/TemplateSnapshotV1`,
  validationIssue: `${ROOT_SCHEMA_ID}#/definitions/ValidationIssue`,
  validationReportV1: `${ROOT_SCHEMA_ID}#/definitions/ValidationReportV1`,
  artifactRefV1: `${ROOT_SCHEMA_ID}#/definitions/ArtifactRefV1`,
  trustNamespaceV1: `${ROOT_SCHEMA_ID}#/definitions/TrustNamespaceV1`,
  generationBudgetsV1: `${ROOT_SCHEMA_ID}#/definitions/GenerationBudgetsV1`,
  dataUseConsentV1: `${ROOT_SCHEMA_ID}#/definitions/DataUseConsentV1`,
  buildBriefV1: `${ROOT_SCHEMA_ID}#/definitions/BuildBriefV1`,
  providerCapabilitiesV1: `${ROOT_SCHEMA_ID}#/definitions/ProviderCapabilitiesV1`,
  renderPacketV1: `${ROOT_SCHEMA_ID}#/definitions/RenderPacketV1`,
  actorObservationV1: `${ROOT_SCHEMA_ID}#/definitions/ActorObservationV1`,
  makerObservationV1: `${ROOT_SCHEMA_ID}#/definitions/MakerObservationV1`,
  candidateProgramSubmissionV1: `${ROOT_SCHEMA_ID}#/definitions/CandidateProgramSubmissionV1`,
  attemptTranscriptV1: `${ROOT_SCHEMA_ID}#/definitions/AttemptTranscriptV1`,
  generationJobRecordV1: `${ROOT_SCHEMA_ID}#/definitions/GenerationJobRecordV1`,
  candidateRecordV1: `${ROOT_SCHEMA_ID}#/definitions/CandidateRecordV1`,
  presentedPatchEnvelopeV1: `${ROOT_SCHEMA_ID}#/definitions/PresentedPatchEnvelopeV1`,
  acceptanceAuthorizationV1: `${ROOT_SCHEMA_ID}#/definitions/AcceptanceAuthorizationV1`,
  runEventV1: `${ROOT_SCHEMA_ID}#/definitions/RunEventV1`,
  nativeSealedRunManifestV1: `${ROOT_SCHEMA_ID}#/definitions/NativeSealedRunManifestV1`,
} as const;

export type ProtocolValidator<T> = ValidateFunction<T>;

function semanticError(instancePath: string, message: string): ErrorObject {
  return {
    keyword: "semantic",
    instancePath,
    schemaPath: "#/semantic",
    params: {},
    message,
  };
}

function withSemanticValidation<T>(
  generated: ValidateFunction<unknown>,
  semanticCheck: (value: T) => ErrorObject | null,
): ProtocolValidator<T> {
  const validate = ((value: unknown): value is T => {
    if (!generated(value)) {
      validate.errors = generated.errors ?? null;
      return false;
    }
    const error = semanticCheck(value as T);
    validate.errors = error ? [error] : null;
    return error === null;
  }) as ProtocolValidator<T>;
  validate.errors = null;
  return validate;
}

function withDetachedSemanticValidation<T>(
  generated: ValidateFunction<unknown>,
  semanticCheck: (value: T) => ErrorObject | null,
): ProtocolValidator<T> {
  const validate = ((value: unknown): value is T => {
    let detached: unknown;
    try {
      detached = structuredClone(value);
    } catch {
      validate.errors = [
        semanticError("", "Protocol value must be detached structured-cloneable data"),
      ];
      return false;
    }
    if (!generated(detached)) {
      validate.errors = generated.errors ?? null;
      return false;
    }
    const error = semanticCheck(detached as T);
    validate.errors = error ? [error] : null;
    return error === null;
  }) as ProtocolValidator<T>;
  validate.errors = null;
  return validate;
}

function unique(values: readonly string[]): boolean {
  return new Set(values).size === values.length;
}

function buildProgramSemanticError(value: BuildProgramV1): ErrorObject | null {
  for (let index = 0; index < value.operations.length; index += 1) {
    const operation = value.operations[index]!;
    if (operation.kind !== "instantiateTemplate") continue;
    const hasVersion = operation.templateVersion !== undefined;
    const hasHash = operation.templateHash !== undefined;
    if (hasVersion !== hasHash) {
      return semanticError(
        `/operations/${index}`,
        "Template version and content hash must be pinned together",
      );
    }
    if (!unique(operation.parameters.map(({ name }) => name))) {
      return semanticError(
        `/operations/${index}/parameters`,
        "Template parameter bindings must have unique names",
      );
    }
  }
  return null;
}

export const validateTruthSnapshot =
  generatedValidateTruthSnapshot as ProtocolValidator<TruthSnapshot>;
export const validateRigidTransform =
  generatedValidateRigidTransform as ProtocolValidator<RigidTransform>;
export const validateBrickDocumentV1 =
  generatedValidateBrickDocumentV1 as ProtocolValidator<BrickDocumentV1>;
export const validateBuildProgramV1 = withDetachedSemanticValidation<BuildProgramV1>(
  generatedValidateBuildProgramV1,
  buildProgramSemanticError,
);
export const validateBuildOperation =
  generatedValidateBuildOperation as ProtocolValidator<BuildOperation>;
export const validateScopeCapabilityV1 =
  generatedValidateScopeCapabilityV1 as ProtocolValidator<ScopeCapabilityV1>;
export const validateAssemblyPatchV1 =
  generatedValidateAssemblyPatchV1 as ProtocolValidator<AssemblyPatchV1>;
export const validateValidationIssue =
  generatedValidateValidationIssue as ProtocolValidator<ValidationIssue>;
export const validateValidationReportV1 =
  generatedValidateValidationReportV1 as ProtocolValidator<ValidationReportV1>;
export const validateTemplateSnapshotV1 = withDetachedSemanticValidation<TemplateSnapshotV1>(
  generatedValidateTemplateSnapshotV1,
  (value) => {
    const error = checkTemplateSnapshotSemantics(value);
    return error === null ? null : semanticError(error.instancePath, error.message);
  },
);
export const validateArtifactRefV1 = withSemanticValidation<ArtifactRefV1>(
  generatedValidateArtifactRefV1,
  (value) =>
    value.casKey === value.sha256
      ? null
      : semanticError("/casKey", "CAS key must equal the artifact content hash"),
);
export const validateTrustNamespaceV1 =
  generatedValidateTrustNamespaceV1 as ProtocolValidator<TrustNamespaceV1>;
export const validateGenerationBudgetsV1 =
  generatedValidateGenerationBudgetsV1 as ProtocolValidator<GenerationBudgetsV1>;
export const validateDataUseConsentV1 =
  generatedValidateDataUseConsentV1 as ProtocolValidator<DataUseConsentV1>;
export const validateBuildBriefV1 =
  generatedValidateBuildBriefV1 as ProtocolValidator<BuildBriefV1>;
export const validateProviderCapabilitiesV1 =
  generatedValidateProviderCapabilitiesV1 as ProtocolValidator<ProviderCapabilitiesV1>;
export const validateRenderPacketV1 = withSemanticValidation<RenderPacketV1>(
  generatedValidateRenderPacketV1,
  (value) => {
    const artifactIds = value.views.map(({ artifact }) => artifact.artifactId);
    if (!unique(artifactIds)) {
      return semanticError("/views", "Render artifact identifiers must be unique");
    }
    const passIds = value.views.map(({ pass, viewId }) => `${viewId}\u0000${pass}`);
    if (!unique(passIds)) {
      return semanticError("/views", "Render view and pass pairs must be unique");
    }
    const malformedArtifact = value.views.find(
      ({ artifact }) => artifact.kind !== "render" || artifact.casKey !== artifact.sha256,
    );
    return malformedArtifact
      ? semanticError("/views", "Render views must reference content-addressed render artifacts")
      : null;
  },
);
export const validateActorObservationV1 =
  generatedValidateActorObservationV1 as ProtocolValidator<ActorObservationV1>;
export const validateMakerObservationV1 = withSemanticValidation<MakerObservationV1>(
  generatedValidateMakerObservationV1,
  (value) => {
    if (
      value.baseRevision !== value.brief.baseRevision ||
      value.baseDocumentHash !== value.brief.baseDocumentHash
    ) {
      return semanticError("/brief", "Maker brief must bind the observation's exact base");
    }
    if (value.scope.budgets.maxAddedParts > value.brief.pieceBudget) {
      return semanticError("/scope/budgets", "Maker scope cannot exceed the brief piece budget");
    }
    const allowedParts = new Set(value.brief.allowedCatalogPartIds);
    const allowedColors = new Set(value.brief.allowedColorIds);
    if (value.scope.allowedCatalogPartIds.some((partId) => !allowedParts.has(partId))) {
      return semanticError("/scope/allowedCatalogPartIds", "Maker scope cannot broaden the brief");
    }
    if (value.scope.allowedColorIds.some((colorId) => !allowedColors.has(colorId))) {
      return semanticError("/scope/allowedColorIds", "Maker scope cannot broaden the brief");
    }
    return null;
  },
);
export const validateCandidateProgramSubmissionV1 =
  generatedValidateCandidateProgramSubmissionV1 as ProtocolValidator<CandidateProgramSubmissionV1>;
export const validateAttemptTranscriptV1 = withSemanticValidation<AttemptTranscriptV1>(
  generatedValidateAttemptTranscriptV1,
  (value) => {
    const noMutationStatuses = new Set([
      "staleObservation",
      "capabilityRejected",
      "controlUnavailable",
    ]);
    return noMutationStatuses.has(value.terminal.status) &&
      value.terminal.preDocumentHash !== value.terminal.postDocumentHash
      ? semanticError("/terminal", "Rejected browser decisions must prove no document mutation")
      : null;
  },
);
export const validateGenerationJobRecordV1 = withSemanticValidation<GenerationJobRecordV1>(
  generatedValidateGenerationJobRecordV1,
  (value) =>
    value.candidateIds.length <= value.budgets.maxCandidates
      ? null
      : semanticError("/candidateIds", "Job candidates exceed the recorded candidate budget"),
);
export const validateCandidateRecordV1 = withSemanticValidation<CandidateRecordV1>(
  generatedValidateCandidateRecordV1,
  (value) =>
    value.programArtifact.kind === "program" &&
    value.programArtifact.casKey === value.programArtifact.sha256
      ? null
      : semanticError(
          "/programArtifact",
          "Candidate program must be content-addressed program data",
        ),
);
export const validatePresentedPatchEnvelopeV1 = withSemanticValidation<PresentedPatchEnvelopeV1>(
  generatedValidatePresentedPatchEnvelopeV1,
  (value) => {
    const provenance = value.patch.provenance;
    return provenance.jobId === value.jobId &&
      provenance.candidateId === value.candidateId &&
      provenance.compilerSnapshotHash === value.compilerSnapshotHash &&
      provenance.buildProgramHash === value.buildProgramHash
      ? null
      : semanticError("/patch/provenance", "Presented patch provenance must match its envelope");
  },
);
export const validateAcceptanceAuthorizationV1 =
  generatedValidateAcceptanceAuthorizationV1 as ProtocolValidator<AcceptanceAuthorizationV1>;
export const validateRunEventV1 = generatedValidateRunEventV1 as ProtocolValidator<RunEventV1>;
export const validateNativeSealedRunManifestV1 = withSemanticValidation<NativeSealedRunManifestV1>(
  generatedValidateNativeSealedRunManifestV1,
  (value) => {
    if (value.candidateIds.length > value.budgets.maxCandidates) {
      return semanticError("/candidateIds", "Run candidates exceed the sealed candidate budget");
    }
    const artifactIds = value.artifacts.map(({ artifactId }) => artifactId);
    if (!unique(artifactIds)) {
      return semanticError("/artifacts", "Run artifact identifiers must be unique");
    }
    if (value.artifacts.some(({ casKey, sha256 }) => casKey !== sha256)) {
      return semanticError("/artifacts", "Every run artifact must be content-addressed");
    }
    const artifactHashes = new Set(value.artifacts.map(({ sha256 }) => sha256));
    if (value.replayClosure.requiredArtifactHashes.some((hash) => !artifactHashes.has(hash))) {
      return semanticError(
        "/replayClosure/requiredArtifactHashes",
        "Replay closure references an artifact absent from the sealed manifest",
      );
    }
    return null;
  },
);

export class ProtocolValidationError extends Error {
  readonly validationErrors: readonly ErrorObject[];

  constructor(label: string, validationErrors: readonly ErrorObject[]) {
    super(`${label} does not satisfy its protocol schema`);
    this.name = "ProtocolValidationError";
    this.validationErrors = validationErrors;
  }
}

export function assertProtocolValue<T>(
  validator: ProtocolValidator<T>,
  value: unknown,
  label = "Protocol value",
): asserts value is T {
  if (validator(value)) {
    return;
  }

  throw new ProtocolValidationError(label, validator.errors ?? []);
}
