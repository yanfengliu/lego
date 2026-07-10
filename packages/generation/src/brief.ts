import { COLOR_DEFINITIONS, PART_DEFINITIONS } from "@lego-studio/catalog";
import {
  canonicalDigest,
  deepFreeze,
  documentStructuralHash,
  validateBrickDocument,
} from "@lego-studio/brick-kernel";
import {
  validateBrickDocumentV1,
  validateBuildBriefV1,
  validateScopeCapabilityV1,
  type BrickDocumentV1,
  type BuildBriefV1,
  type ScopeCapabilityV1,
} from "@lego-studio/protocol";

import { cloneBoundedDataOnlyJson } from "./data-only.ts";
import type {
  MakerInputFailure,
  MakerInputFailureCode,
  NormalizeRestrictedTextBriefInput,
  NormalizeRestrictedTextBriefResult,
  NormalizedTextBrief,
  SupportedShape,
} from "./types.ts";

export const MAX_RESTRICTED_PROMPT_CHARS = 1_024;
export const MAX_MAKER_CANDIDATES = 4;
export const MIN_MAKER_PARTS = 10;
export const MAX_MAKER_PARTS = 40;
export const MAX_MAKER_ALLOWED_PART_IDS = 64;
export const MAX_MAKER_ALLOWED_COLOR_IDS = 32;
export const MIN_MAKER_OPERATIONS = MIN_MAKER_PARTS * 2 - 1;
export const MAX_MAKER_BRIEF_LIST_ITEMS = 16;
export const MAX_MAKER_BASE_ANNOTATIONS = 64;
export const MIN_DETERMINISTIC_MAKER_WALL_TIME_MS = 10_000;
const MAX_MAKER_INPUT_NODES = 12_000;

const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/u;
const PART_COUNT = /\b(\d{1,3})\s*[-‐‑–—]?\s*(?:pieces?|parts?|bricks?)\b/u;

const shapePatterns: readonly [SupportedShape, RegExp][] = [
  ["staircase", /\b(?:staircase|stairs?|steps?|stepped)\b/u],
  ["spire", /\b(?:spire|needle|mast)\b/u],
  ["column", /\b(?:column|pillar|wall)\b/u],
  ["tower", /\b(?:tower|turret|stack)\b/u],
];

function failure(
  code: MakerInputFailureCode,
  message: string,
  path: string,
): { readonly ok: false; readonly failure: MakerInputFailure } {
  return { ok: false, failure: { stage: "input", code, message, path } };
}

function isSubset(values: readonly string[], allowed: ReadonlySet<string>): boolean {
  return values.every((value) => allowed.has(value));
}

function hasDisallowedControlCharacter(value: string): boolean {
  for (const character of value) {
    const code = character.codePointAt(0)!;
    if ((code < 32 && code !== 9 && code !== 10 && code !== 13) || code === 127) return true;
  }
  return false;
}

function containsPhrase(text: string, phrase: string): boolean {
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&").replace(/\s+/gu, "\\s+");
  return new RegExp(`(?:^|[^a-z0-9])${escaped}(?:$|[^a-z0-9])`, "u").test(text);
}

function requestedColors(
  prompt: string,
  allowedColorIds: readonly string[],
): {
  readonly colorIds: readonly string[];
  readonly explicit: boolean;
  readonly disallowed: boolean;
} {
  const allowed = new Set(allowedColorIds);
  const matches = COLOR_DEFINITIONS.filter(({ id, displayName }) => {
    const shortId = id.slice(id.indexOf(":") + 1).replace(/-/gu, " ");
    return containsPhrase(prompt, displayName.toLowerCase()) || containsPhrase(prompt, shortId);
  }).map(({ id }) => id);
  return {
    colorIds: matches.length > 0 ? matches : [allowedColorIds[0]!],
    explicit: matches.length > 0,
    disallowed: matches.some((colorId) => !allowed.has(colorId)),
  };
}

function requestedShape(prompt: string): SupportedShape | undefined {
  const matches = shapePatterns.filter(([, pattern]) => pattern.test(prompt));
  return matches.length === 1 ? matches[0]![0] : undefined;
}

function normalizedShortText(value: string): string {
  return value.normalize("NFKC").trim().replace(/\s+/gu, " ").toLowerCase();
}

function isSupportedSemanticRequirement(value: string): boolean {
  return /^(?:one |single )?connected (?:model|assembly|component)$/u.test(
    normalizedShortText(value),
  );
}

function isSupportedStyleTag(value: string): boolean {
  return normalizedShortText(value) === "simple";
}

function intersectVolume(
  scope: ScopeCapabilityV1["allowedVolume"],
  target: BuildBriefV1["targetBoundsLdu"],
): ScopeCapabilityV1["allowedVolume"] | null {
  const minLdu = scope.minLdu.map((value, index) =>
    Math.max(value, target?.minLdu[index] ?? value),
  ) as [number, number, number];
  const maxLdu = scope.maxLdu.map((value, index) =>
    Math.min(value, target?.maxLdu[index] ?? value),
  ) as [number, number, number];
  return minLdu.every((value, index) => value <= maxLdu[index]!) ? { minLdu, maxLdu } : null;
}

export function normalizeRestrictedTextBrief(
  input: NormalizeRestrictedTextBriefInput,
): NormalizeRestrictedTextBriefResult {
  const detachedInput = cloneBoundedDataOnlyJson(input, {
    maxDepth: 24,
    maxNodes: MAX_MAKER_INPUT_NODES,
    maxStringChars: 8_192,
    maxKeyChars: 128,
    maxTotalChars: 256_000,
  });
  if (
    detachedInput === null ||
    typeof detachedInput !== "object" ||
    !("document" in detachedInput) ||
    !("brief" in detachedInput) ||
    !("scope" in detachedInput)
  ) {
    return failure(
      "INPUT_NOT_DATA_ONLY",
      "Maker inputs must be bounded, detached, data-only JSON",
      "",
    );
  }
  const documentValue = detachedInput.document;
  const briefValue = detachedInput.brief;
  const scopeValue = detachedInput.scope;
  if (!validateBrickDocumentV1(documentValue)) {
    return failure(
      "DOCUMENT_SCHEMA_INVALID",
      "Base document does not satisfy the BrickDocument schema",
      "/document",
    );
  }
  if (!validateBuildBriefV1(briefValue)) {
    return failure(
      "BRIEF_SCHEMA_INVALID",
      "Build brief does not satisfy the generation protocol",
      "/brief",
    );
  }
  if (!validateScopeCapabilityV1(scopeValue)) {
    return failure(
      "SCOPE_SCHEMA_INVALID",
      "Scope capability does not satisfy the generation protocol",
      "/scope",
    );
  }

  const document = documentValue as BrickDocumentV1;
  const brief = briefValue as BuildBriefV1;
  const scope = scopeValue as ScopeCapabilityV1;
  const validation = validateBrickDocument(document);
  if (!validation.documentGloballyValid) {
    return failure(
      "DOCUMENT_HARD_INVALID",
      "Full-model generation requires a globally valid empty base document",
      "/document",
    );
  }
  if (brief.mode !== "full") {
    return failure(
      "MODE_NOT_SUPPORTED",
      "This maker milestone supports full mode only",
      "/brief/mode",
    );
  }
  if (brief.referenceArtifactIds.length > 0) {
    return failure(
      "REFERENCES_NOT_SUPPORTED",
      "This deterministic maker accepts text-only briefs",
      "/brief/referenceArtifactIds",
    );
  }
  if (brief.prompt.length > MAX_RESTRICTED_PROMPT_CHARS) {
    return failure(
      "PROMPT_TOO_LARGE",
      `Prompt exceeds the ${MAX_RESTRICTED_PROMPT_CHARS}-character maker limit`,
      "/brief/prompt",
    );
  }
  if (hasDisallowedControlCharacter(brief.prompt)) {
    return failure(
      "PROMPT_CONTROL_CHARACTER",
      "Prompt contains a disallowed control character",
      "/brief/prompt",
    );
  }
  const normalizedPrompt = brief.prompt
    .normalize("NFKC")
    .trim()
    .replace(/\s+/gu, " ")
    .toLowerCase();
  if (normalizedPrompt.length === 0) {
    return failure("PROMPT_EMPTY", "Prompt must contain text", "/brief/prompt");
  }
  if (normalizedPrompt.length > MAX_RESTRICTED_PROMPT_CHARS) {
    return failure(
      "PROMPT_TOO_LARGE",
      `Normalized prompt exceeds the ${MAX_RESTRICTED_PROMPT_CHARS}-character maker limit`,
      "/brief/prompt",
    );
  }
  const shape = requestedShape(normalizedPrompt);
  if (shape === undefined) {
    return failure(
      "SHAPE_NOT_SUPPORTED",
      "Prompt must name one supported shape: tower, staircase, spire, or column",
      "/brief/prompt",
    );
  }
  if (document.parts.length > 0 || document.connections.length > 0) {
    return failure(
      "BASE_NOT_EMPTY",
      "This full-model maker milestone requires an empty base document",
      "/document/parts",
    );
  }
  if (
    document.submodels.length > MAX_MAKER_BASE_ANNOTATIONS ||
    document.steps.length > MAX_MAKER_BASE_ANNOTATIONS ||
    document.semanticRegions.length > MAX_MAKER_BASE_ANNOTATIONS
  ) {
    return failure(
      "BASE_METADATA_TOO_LARGE",
      "Empty maker base contains too many annotation records",
      "/document",
    );
  }

  const baseDocumentHash = documentStructuralHash(document);
  if (
    brief.baseRevision !== document.revision ||
    brief.baseDocumentHash !== baseDocumentHash ||
    scope.baseRevision !== document.revision ||
    scope.baseDocumentHash !== baseDocumentHash
  ) {
    return failure(
      "BASE_BINDING_MISMATCH",
      "Brief and scope must bind the exact base revision and structural hash",
      "/brief/baseDocumentHash",
    );
  }
  if (
    scope.frozenPartIds.length > 0 ||
    scope.mutablePartIds.length > 0 ||
    scope.requiredAttachmentPorts.length > 0 ||
    scope.budgets.maxRemovedParts !== 0
  ) {
    return failure(
      "SCOPE_NOT_FULL_EMPTY",
      "Full empty-model scope cannot name existing parts, attachments, or removals",
      "/scope",
    );
  }
  if (
    brief.allowedCatalogPartIds.length > MAX_MAKER_ALLOWED_PART_IDS ||
    scope.allowedCatalogPartIds.length > MAX_MAKER_ALLOWED_PART_IDS ||
    brief.allowedColorIds.length > MAX_MAKER_ALLOWED_COLOR_IDS ||
    scope.allowedColorIds.length > MAX_MAKER_ALLOWED_COLOR_IDS
  ) {
    return failure(
      "ALLOWLIST_TOO_LARGE",
      "Maker allowlists exceed the bounded local catalog limits",
      "/brief/allowedCatalogPartIds",
    );
  }
  if (
    brief.semanticRequirements.length > MAX_MAKER_BRIEF_LIST_ITEMS ||
    brief.styleTags.length > MAX_MAKER_BRIEF_LIST_ITEMS
  ) {
    return failure(
      "BRIEF_METADATA_TOO_LARGE",
      "Maker semantic requirements or style tags exceed the local bounded limit",
      "/brief/semanticRequirements",
    );
  }
  if (!brief.semanticRequirements.every(isSupportedSemanticRequirement)) {
    return failure(
      "SEMANTIC_REQUIREMENT_NOT_SUPPORTED",
      "Restricted maker cannot claim an unimplemented semantic requirement",
      "/brief/semanticRequirements",
    );
  }
  if (!brief.styleTags.every(isSupportedStyleTag)) {
    return failure(
      "STYLE_TAG_NOT_SUPPORTED",
      "Restricted maker cannot claim an unimplemented style tag",
      "/brief/styleTags",
    );
  }

  const knownPartIds = new Set(PART_DEFINITIONS.map(({ id }) => id));
  const knownColorIds = new Set(COLOR_DEFINITIONS.map(({ id }) => id));
  const documentPartIds = new Set(document.constraints.allowedCatalogPartIds);
  const documentColorIds = new Set(document.constraints.allowedColorIds);
  if (
    !isSubset(brief.allowedCatalogPartIds, knownPartIds) ||
    !isSubset(scope.allowedCatalogPartIds, knownPartIds) ||
    !isSubset(brief.allowedCatalogPartIds, documentPartIds) ||
    !isSubset(scope.allowedCatalogPartIds, documentPartIds)
  ) {
    return failure(
      "UNSUPPORTED_CATALOG_PART",
      "Maker part allowlists must contain only canonical built-in parts allowed by the document",
      "/brief/allowedCatalogPartIds",
    );
  }
  if (
    !isSubset(brief.allowedColorIds, knownColorIds) ||
    !isSubset(scope.allowedColorIds, knownColorIds) ||
    !isSubset(brief.allowedColorIds, documentColorIds) ||
    !isSubset(scope.allowedColorIds, documentColorIds)
  ) {
    return failure(
      "UNSUPPORTED_COLOR",
      "Maker color allowlists must contain only canonical built-in colors allowed by the document",
      "/brief/allowedColorIds",
    );
  }
  if (
    !isSubset(scope.allowedCatalogPartIds, new Set(brief.allowedCatalogPartIds)) ||
    !isSubset(scope.allowedColorIds, new Set(brief.allowedColorIds))
  ) {
    return failure(
      "SCOPE_BROADENS_BRIEF",
      "Scope capability cannot broaden the brief's part or color authority",
      "/scope",
    );
  }

  const availablePartBudget = Math.min(
    MAX_MAKER_PARTS,
    brief.pieceBudget,
    scope.budgets.maxAddedParts,
    document.constraints.maxParts,
  );
  if (availablePartBudget < MIN_MAKER_PARTS) {
    return failure(
      "PART_BUDGET_TOO_SMALL",
      `Maker needs capacity for at least ${MIN_MAKER_PARTS} parts`,
      "/brief/pieceBudget",
    );
  }
  if (scope.budgets.maxOperations < MIN_MAKER_OPERATIONS) {
    return failure(
      "OPERATION_BUDGET_TOO_SMALL",
      `Maker needs at least ${MIN_MAKER_OPERATIONS} operations for a connected ten-part model`,
      "/scope/budgets/maxOperations",
    );
  }
  if (brief.budgets.maxWallTimeMs < MIN_DETERMINISTIC_MAKER_WALL_TIME_MS) {
    return failure(
      "WALL_TIME_BUDGET_TOO_SMALL",
      `Deterministic four-candidate compilation requires a ${MIN_DETERMINISTIC_MAKER_WALL_TIME_MS}ms admitted worker deadline`,
      "/brief/budgets/maxWallTimeMs",
    );
  }

  const requestedPartCountText = normalizedPrompt.match(PART_COUNT)?.[1];
  const requestedPartCount =
    requestedPartCountText === undefined ? undefined : Number(requestedPartCountText);
  if (
    requestedPartCount !== undefined &&
    (requestedPartCount < MIN_MAKER_PARTS || requestedPartCount > MAX_MAKER_PARTS)
  ) {
    return failure(
      "TARGET_PART_COUNT_UNSUPPORTED",
      `Explicit part target must be between ${MIN_MAKER_PARTS} and ${MAX_MAKER_PARTS}`,
      "/brief/prompt",
    );
  }
  if (requestedPartCount !== undefined && requestedPartCount > availablePartBudget) {
    return failure(
      "TARGET_EXCEEDS_BUDGET",
      "Explicit part target exceeds the brief, scope, or document budget",
      "/brief/prompt",
    );
  }

  const generationVolume = intersectVolume(scope.allowedVolume, brief.targetBoundsLdu);
  if (generationVolume === null) {
    return failure(
      "ALLOWED_VOLUME_EMPTY",
      "Brief target bounds and scope volume do not intersect",
      "/brief/targetBoundsLdu",
    );
  }
  const allowedCatalogPartIds = [...scope.allowedCatalogPartIds].sort();
  const allowedColorIds = [...scope.allowedColorIds].sort();
  const colorIntent = requestedColors(normalizedPrompt, allowedColorIds);
  if (colorIntent.disallowed) {
    return failure(
      "REQUESTED_COLOR_NOT_ALLOWED",
      "Prompt requests a known color outside the brief or scope allowlist",
      "/brief/prompt",
    );
  }
  const normalized: NormalizedTextBrief = {
    schemaVersion: "lego.normalized-text-brief/1",
    sourceBriefHash: canonicalDigest(brief),
    normalizedPrompt,
    requestedShape: shape,
    requestedColorIds: colorIntent.colorIds,
    colorIntent: colorIntent.explicit ? "explicit" : "default",
    allowedCatalogPartIds,
    allowedColorIds,
    targetPartCount: requestedPartCount ?? availablePartBudget,
    candidateLimit: Math.min(MAX_MAKER_CANDIDATES, brief.budgets.maxCandidates),
    generationVolume,
  };
  return deepFreeze({ ok: true, brief: normalized, document, sourceBrief: brief, scope });
}

export function validateMakerJobId(jobId: string): MakerInputFailure | null {
  return IDENTIFIER.test(jobId)
    ? null
    : {
        stage: "input",
        code: "JOB_ID_INVALID",
        message: "Job identifier must satisfy the protocol identifier grammar",
        path: "/jobId",
      };
}
