import type { ErrorObject, ValidateFunction } from "ajv";

import {
  validateAssemblyPatchV1 as generatedValidateAssemblyPatchV1,
  validateBrickDocumentV1 as generatedValidateBrickDocumentV1,
  validateBuildProgramV1 as generatedValidateBuildProgramV1,
  validateBuildOperation as generatedValidateBuildOperation,
  validateRigidTransform as generatedValidateRigidTransform,
  validateScopeCapabilityV1 as generatedValidateScopeCapabilityV1,
  validateTruthSnapshot as generatedValidateTruthSnapshot,
  validateValidationReportV1 as generatedValidateValidationReportV1,
} from "./generated/validators.generated.js";

import type {
  AssemblyPatchV1,
  BrickDocumentV1,
  BuildProgramV1,
  BuildOperation,
  RigidTransform,
  ScopeCapabilityV1,
  TruthSnapshot,
  ValidationReportV1,
} from "./generated/public-types.generated.js";

export type * from "./generated/public-types.generated.js";

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
  validationReportV1: `${ROOT_SCHEMA_ID}#/definitions/ValidationReportV1`,
} as const;

export type ProtocolValidator<T> = ValidateFunction<T>;

export const validateTruthSnapshot =
  generatedValidateTruthSnapshot as ProtocolValidator<TruthSnapshot>;
export const validateRigidTransform =
  generatedValidateRigidTransform as ProtocolValidator<RigidTransform>;
export const validateBrickDocumentV1 =
  generatedValidateBrickDocumentV1 as ProtocolValidator<BrickDocumentV1>;
export const validateBuildProgramV1 =
  generatedValidateBuildProgramV1 as ProtocolValidator<BuildProgramV1>;
export const validateBuildOperation =
  generatedValidateBuildOperation as ProtocolValidator<BuildOperation>;
export const validateScopeCapabilityV1 =
  generatedValidateScopeCapabilityV1 as ProtocolValidator<ScopeCapabilityV1>;
export const validateAssemblyPatchV1 =
  generatedValidateAssemblyPatchV1 as ProtocolValidator<AssemblyPatchV1>;
export const validateValidationReportV1 =
  generatedValidateValidationReportV1 as ProtocolValidator<ValidationReportV1>;

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
