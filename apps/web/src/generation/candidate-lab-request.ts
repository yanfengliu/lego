import { COLOR_DEFINITIONS, PART_DEFINITIONS } from "@lego-studio/catalog";
import { documentStructuralHash } from "@lego-studio/brick-kernel";
import type { BrickDocumentV1, BuildBriefV1, ScopeCapabilityV1 } from "@lego-studio/protocol";
import type { DeterministicMakerPopulationInput } from "@lego-studio/generation";

const DEFAULT_PART_BUDGET = 24;
const FULL_EMPTY_VOLUME = {
  minLdu: [-400, -400, -400],
  maxLdu: [400, 400, 400],
} as const;

function allowedCatalogParts(document: BrickDocumentV1): string[] {
  const documentAllowed = new Set(document.constraints.allowedCatalogPartIds);
  return PART_DEFINITIONS.map(({ id }) => id).filter((id) => documentAllowed.has(id));
}

function allowedColors(document: BrickDocumentV1): string[] {
  const documentAllowed = new Set(document.constraints.allowedColorIds);
  return COLOR_DEFINITIONS.map(({ id }) => id).filter((id) => documentAllowed.has(id));
}

export interface CandidateLabRequest extends DeterministicMakerPopulationInput {
  readonly document: BrickDocumentV1;
  readonly brief: BuildBriefV1;
  readonly scope: ScopeCapabilityV1;
}

export function createCandidateLabRequest(
  document: BrickDocumentV1,
  prompt: string,
  jobId: string,
): CandidateLabRequest {
  const baseDocumentHash = documentStructuralHash(document);
  const allowedCatalogPartIds = allowedCatalogParts(document);
  const allowedColorIds = allowedColors(document);
  const pieceBudget = Math.min(DEFAULT_PART_BUDGET, document.constraints.maxParts);
  const brief: BuildBriefV1 = {
    schemaVersion: "lego.build-brief/1",
    mode: "full",
    prompt,
    referenceArtifactIds: [],
    baseRevision: document.revision,
    baseDocumentHash,
    allowedCatalogPartIds,
    allowedColorIds,
    pieceBudget,
    targetBoundsLdu: FULL_EMPTY_VOLUME,
    semanticRequirements: ["one connected model"],
    styleTags: ["simple"],
    budgets: {
      maxCandidates: 4,
      maxRepairs: 0,
      maxProviderCalls: 0,
      maxTokens: 0,
      maxCostMicros: 0,
      maxWallTimeMs: 10_000,
      maxRenders: 28,
      maxStoredBytes: 1_048_576,
    },
    consent: {
      policyVersion: "local-model-agnostic-lab-1",
      providerTransmission: "none",
      retainRunArtifacts: false,
      knowledgeUse: false,
      benchmarkUse: false,
      trainingUse: false,
    },
  };
  const scope: ScopeCapabilityV1 = {
    schemaVersion: "lego.scope-capability/1",
    capabilityId: `scope-${jobId}`,
    baseRevision: document.revision,
    baseDocumentHash,
    frozenPartIds: [],
    mutablePartIds: [],
    requiredAttachmentPorts: [],
    allowedVolume: FULL_EMPTY_VOLUME,
    allowedCatalogPartIds,
    allowedColorIds,
    budgets: { maxAddedParts: pieceBudget, maxRemovedParts: 0, maxOperations: 160 },
  };
  return { jobId, document, brief, scope };
}
