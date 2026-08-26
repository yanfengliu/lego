import { intrinsicRealBuildFreeze } from "./real-build-intrinsic-freeze";
import { COLOR_DEFINITIONS, PART_DEFINITIONS } from "@lego-studio/catalog";
import {
  applyBuildOperations,
  BUILTIN_COMPILER_SNAPSHOT_HASH,
  canonicalDigest,
  canonicalSha256,
  deepFreeze,
  documentStructuralHash,
  normalizeScopeCapability,
  type CompilationResult,
} from "@lego-studio/brick-kernel";
import type {
  BrickDocumentV1,
  BuildOperation,
  BuildProgramV1,
  BuildStep,
  ScopeCapabilityV1,
} from "@lego-studio/protocol";

export interface RealBuildAutomaticPrintedStepMetadata {
  readonly name: string;
  readonly sourceActionDigest: `sha256:${string}`;
}

export interface RealBuildPreparedAutomaticPrintedStep {
  readonly addStepOperation: BuildOperation & { readonly kind: "addStep" };
  readonly preparationOperations: readonly BuildOperation[];
  readonly documentWithStep: BrickDocumentV1;
  readonly step: BuildStep;
}

export const REAL_BUILD_AUTOMATIC_MAXIMUM_OPERATIONS = 1_024;
export const REAL_BUILD_AUTOMATIC_MAXIMUM_STEP_PREPARATION_OPERATIONS = 2;
export const REAL_BUILD_AUTOMATIC_MAXIMUM_REQUIRED_BASE_PORTS = 256;
export const REAL_BUILD_AUTOMATIC_MAXIMUM_GRAPH_VISITS = 2_000_000;
export const REAL_BUILD_AUTOMATIC_MAXIMUM_BYTE_VISITS = 256 * 1024 * 1024;
export const REAL_BUILD_AUTOMATIC_MAXIMUM_IDENTIFIER_LENGTH = 128;
export const REAL_BUILD_AUTOMATIC_MAXIMUM_STEP_NUMBER = 359;
export const REAL_BUILD_AUTOMATIC_MAXIMUM_STEP_NAME_LENGTH = 256;
export const REAL_BUILD_AUTOMATIC_MINIMUM_LDU = -10_000_000;
export const REAL_BUILD_AUTOMATIC_MAXIMUM_LDU = 10_000_000;

export const REAL_BUILD_AUTOMATIC_PLACEMENT_COMPILER_MANIFEST = deepFreeze({
  schemaVersion: "lego.real-build-automatic-placement-compiler-manifest/1",
  compilerVersion: "lego.real-build-automatic-placement-compiler/3",
  kernelCompilerSnapshotHash: BUILTIN_COMPILER_SNAPSHOT_HASH,
  acceptedInputSchema: "lego.real-build-automatic-placement-input/2",
  emittedProgramSchema: "lego.real-build-automatic-printed-step-program/1",
  emittedReceiptSchema: "lego.real-build-automatic-placement-receipt/1",
  stepPolicy: "replace-exact-empty-root-bootstrap-or-append-contiguous-step/1",
  transitionPolicy: "one-atomic-step-preparation-plus-restricted-placement-program/1",
  provenancePolicy: "recompile-with-final-structural-document-candidate-id/1",
  validationPolicy: "kernel-compile-twice-then-combined-independent-hard-replay/1",
  connectorCapacityPolicy: "part-local-exact-port-plus-source-reviewed-shared-cells/1",
  workPolicy: "preflight-three-whole-transition-passes/1",
  supportPolicy: "web-placement-build-plate-or-declared-connection/1",
  limits: {
    maximumOperations: REAL_BUILD_AUTOMATIC_MAXIMUM_OPERATIONS,
    maximumStepPreparationOperations: REAL_BUILD_AUTOMATIC_MAXIMUM_STEP_PREPARATION_OPERATIONS,
    maximumRequiredBasePorts: REAL_BUILD_AUTOMATIC_MAXIMUM_REQUIRED_BASE_PORTS,
    maximumGraphVisits: REAL_BUILD_AUTOMATIC_MAXIMUM_GRAPH_VISITS,
    maximumByteVisits: REAL_BUILD_AUTOMATIC_MAXIMUM_BYTE_VISITS,
    maximumIdentifierLength: REAL_BUILD_AUTOMATIC_MAXIMUM_IDENTIFIER_LENGTH,
    maximumStepNumber: REAL_BUILD_AUTOMATIC_MAXIMUM_STEP_NUMBER,
    maximumStepNameLength: REAL_BUILD_AUTOMATIC_MAXIMUM_STEP_NAME_LENGTH,
    minimumLdu: REAL_BUILD_AUTOMATIC_MINIMUM_LDU,
    maximumLdu: REAL_BUILD_AUTOMATIC_MAXIMUM_LDU,
  },
} as const);

export const REAL_BUILD_AUTOMATIC_PLACEMENT_COMPILER_SNAPSHOT_HASH = canonicalDigest(
  REAL_BUILD_AUTOMATIC_PLACEMENT_COMPILER_MANIFEST,
);

export interface RealBuildAutomaticPrintedStepProgram {
  readonly schemaVersion: "lego.real-build-automatic-printed-step-program/1";
  readonly compilerInputDigest: `sha256:${string}`;
  readonly baseCanonicalBytesHash: `sha256:${string}`;
  readonly baseCanonicalByteLength: number;
  readonly baseDocumentHash: `sha256:${string}`;
  readonly printedStepNumber: number;
  readonly printedStep: Readonly<RealBuildAutomaticPrintedStepMetadata>;
  readonly preparationOperations: readonly BuildOperation[];
  readonly placementProgram: BuildProgramV1;
}

export interface RealBuildAutomaticPlacementReceipt {
  readonly schemaVersion: "lego.real-build-automatic-placement-receipt/1";
  readonly compilerSnapshotHash: `sha256:${string}`;
  readonly programHash: `sha256:${string}`;
  readonly placementProgramHash: `sha256:${string}`;
  readonly jobId: string;
  readonly candidateId: string;
  readonly program: RealBuildAutomaticPrintedStepProgram;
  readonly placementScope: ScopeCapabilityV1;
  readonly combinedScope: ScopeCapabilityV1;
}

export type RealBuildAutomaticPlacementCompilationSuccess = CompilationSuccess & {
  /** Data-only replay commitments; this value grants no execution or acceptance authority. */
  readonly automaticPlacement: RealBuildAutomaticPlacementReceipt;
};

export type RealBuildAutomaticPlacementCompilationResult =
  Exclude<CompilationResult, CompilationSuccess> | RealBuildAutomaticPlacementCompilationSuccess;

const SHA256_DIGEST_PATTERN = /^sha256:[0-9a-f]{64}$/u;

export function realBuildAutomaticUtf8ByteLength(value: string): number {
  let bytes = 0;
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code <= 0x7f) bytes += 1;
    else if (code <= 0x7ff) bytes += 2;
    else if (code >= 0xd800 && code <= 0xdbff && index + 1 < value.length) {
      const next = value.charCodeAt(index + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        bytes += 4;
        index += 1;
      } else bytes += 3;
    } else bytes += 3;
  }
  return bytes;
}

function data(value: unknown, key: string, path: string): unknown {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${path} must be a data object.`);
  }
  let descriptor: PropertyDescriptor | undefined;
  try {
    descriptor = Object.getOwnPropertyDescriptor(value, key);
  } catch {
    throw new TypeError(`${path}.${key} could not be inspected safely.`);
  }
  if (descriptor === undefined || !descriptor.enumerable || !("value" in descriptor)) {
    throw new TypeError(`${path}.${key} must be an enumerable own data property.`);
  }
  return descriptor.value;
}

export function snapshotRealBuildAutomaticPrintedStepMetadata(
  value: unknown,
): Readonly<RealBuildAutomaticPrintedStepMetadata> {
  const name = data(value, "name", "Automatic printed-step metadata");
  const sourceActionDigest = data(value, "sourceActionDigest", "Automatic printed-step metadata");
  if (
    typeof name !== "string" ||
    name.length < 1 ||
    name.length > REAL_BUILD_AUTOMATIC_MAXIMUM_STEP_NAME_LENGTH
  ) {
    throw new TypeError(
      `Automatic printed-step metadata.name must contain 1 through ${REAL_BUILD_AUTOMATIC_MAXIMUM_STEP_NAME_LENGTH} characters.`,
    );
  }
  if (typeof sourceActionDigest !== "string" || !SHA256_DIGEST_PATTERN.test(sourceActionDigest)) {
    throw new TypeError(
      "Automatic printed-step metadata.sourceActionDigest must be an exact sha256 digest.",
    );
  }
  return intrinsicRealBuildFreeze({
    name,
    sourceActionDigest: sourceActionDigest as `sha256:${string}`,
  });
}

function deterministicId(prefix: string, value: unknown): string {
  return `${prefix}-${canonicalSha256(value).slice(0, 24)}`;
}

const partDefinitionById = new Map(
  PART_DEFINITIONS.map((definition) => [definition.id, definition]),
);

export function measureRealBuildAutomaticCollisionPrimitiveCount(
  catalogPartIds: readonly string[],
): number {
  return catalogPartIds.reduce((total, catalogPartId) => {
    const definition = partDefinitionById.get(catalogPartId);
    if (definition === undefined) {
      throw new TypeError(
        `Automatic placement cannot preflight collision work for unknown catalog part ${catalogPartId}.`,
      );
    }
    return total + definition.collision.primitives.length;
  }, 0);
}

export function createRealBuildAutomaticScope(input: {
  readonly document: BrickDocumentV1;
  readonly printedStepNumber: number;
  readonly maximumAddedParts: number;
  readonly maximumOperations: number;
  readonly requiredAttachmentPorts: ScopeCapabilityV1["requiredAttachmentPorts"];
  readonly compilerInputDigest: `sha256:${string}`;
  readonly phase: "placement" | "combined";
}): ScopeCapabilityV1 {
  return normalizeScopeCapability({
    schemaVersion: "lego.scope-capability/1",
    capabilityId: deterministicId("real-build-scope", {
      documentHash: documentStructuralHash(input.document),
      printedStepNumber: input.printedStepNumber,
      maximumAddedParts: input.maximumAddedParts,
      maximumOperations: input.maximumOperations,
      compilerInputDigest: input.compilerInputDigest,
      phase: input.phase,
    }),
    baseRevision: input.document.revision,
    baseDocumentHash: documentStructuralHash(input.document),
    frozenPartIds: input.document.parts.map(({ id }) => id),
    mutablePartIds: [],
    requiredAttachmentPorts: input.requiredAttachmentPorts,
    allowedVolume: {
      minLdu: [
        REAL_BUILD_AUTOMATIC_MINIMUM_LDU,
        REAL_BUILD_AUTOMATIC_MINIMUM_LDU,
        REAL_BUILD_AUTOMATIC_MINIMUM_LDU,
      ],
      maxLdu: [
        REAL_BUILD_AUTOMATIC_MAXIMUM_LDU,
        REAL_BUILD_AUTOMATIC_MAXIMUM_LDU,
        REAL_BUILD_AUTOMATIC_MAXIMUM_LDU,
      ],
    },
    allowedCatalogPartIds: PART_DEFINITIONS.map(({ id }) => id),
    allowedColorIds: COLOR_DEFINITIONS.map(({ id }) => id),
    budgets: {
      maxAddedParts: input.maximumAddedParts,
      maxRemovedParts: 0,
      maxOperations: input.maximumOperations,
    },
  });
}

function requireExactPriorPrintedSteps(
  document: BrickDocumentV1,
  printedStepNumber: number,
): readonly BuildOperation[] {
  if (printedStepNumber === 1) {
    const bootstrap = document.steps[0];
    const isExactEmptyBootstrap =
      document.steps.length === 1 &&
      bootstrap?.id === "step-1" &&
      bootstrap.index === 0 &&
      bootstrap.name === "Step 1" &&
      bootstrap.partIds.length === 0 &&
      document.parts.length === 0 &&
      document.connections.length === 0 &&
      document.semanticRegions.length === 0 &&
      document.submodels.every(({ partIds }) => partIds.length === 0);
    if (!isExactEmptyBootstrap) {
      throw new TypeError(
        "Automatic printed step 1 requires the exact empty root bootstrap BuildStep step-1; a populated or relabeled step cannot be replaced automatically.",
      );
    }
    return [
      intrinsicRealBuildFreeze({
        kind: "removeStep" as const,
        operationId: "remove-empty-root-bootstrap-step",
        step: bootstrap,
      }),
    ];
  }
  const expectedPriorSteps = printedStepNumber - 1;
  if (document.steps.length !== expectedPriorSteps) {
    throw new TypeError(
      `Automatic printed step ${printedStepNumber} requires exactly ${expectedPriorSteps} retained prior BuildStep(s) and no pre-created target step; found ${document.steps.length}.`,
    );
  }
  for (let index = 0; index < document.steps.length; index += 1) {
    if (document.steps[index]!.index !== index) {
      throw new TypeError(
        `Automatic printed step ${printedStepNumber} requires retained BuildStep indexes 0 through ${expectedPriorSteps - 1} without gaps.`,
      );
    }
  }
  const first = document.steps[0]!;
  if (
    first.id === "step-1" &&
    first.name === "Step 1" &&
    first.partIds.length === 0 &&
    !document.parts.some(({ stepId }) => stepId === first.id)
  ) {
    throw new TypeError(
      `Automatic printed step ${printedStepNumber} cannot treat the untouched empty root bootstrap as printed step 1; compile printed step 1 first.`,
    );
  }
  return [];
}

export function prepareRealBuildAutomaticPrintedStep(input: {
  readonly document: BrickDocumentV1;
  readonly printedStepNumber: number;
  readonly metadata: Readonly<RealBuildAutomaticPrintedStepMetadata>;
  readonly compilerInputDigest: `sha256:${string}`;
}): RealBuildPreparedAutomaticPrintedStep {
  const prefixOperations = requireExactPriorPrintedSteps(input.document, input.printedStepNumber);
  const step: BuildStep = intrinsicRealBuildFreeze({
    id: deterministicId("real-build-step", {
      compilerInputDigest: input.compilerInputDigest,
      printedStepNumber: input.printedStepNumber,
      metadata: input.metadata,
    }),
    index: input.printedStepNumber - 1,
    name: input.metadata.name,
    partIds: intrinsicRealBuildFreeze([]),
  });
  const addStepOperation = intrinsicRealBuildFreeze({
    kind: "addStep" as const,
    operationId: deterministicId("add-printed-step", {
      compilerInputDigest: input.compilerInputDigest,
      step,
    }),
    step,
  });
  const preparationOperations = intrinsicRealBuildFreeze([...prefixOperations, addStepOperation]);
  let documentWithStep: BrickDocumentV1;
  try {
    documentWithStep = applyBuildOperations(input.document, preparationOperations);
  } catch {
    throw new TypeError(
      `Automatic printed step ${input.printedStepNumber} could not be added to the exact retained parent document.`,
    );
  }
  return intrinsicRealBuildFreeze({
    addStepOperation,
    preparationOperations,
    documentWithStep,
    step,
  });
}

type CompilationSuccess = Extract<CompilationResult, { readonly ok: true }>;
