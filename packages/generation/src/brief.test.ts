import { describe, expect, it } from "vitest";

import { createEmptyBrickDocument, documentStructuralHash } from "@lego-studio/brick-kernel";
import { COLOR_DEFINITIONS, PART_DEFINITIONS } from "@lego-studio/catalog";
import type { BuildBriefV1, ScopeCapabilityV1 } from "@lego-studio/protocol";

import { MAX_RESTRICTED_PROMPT_CHARS, normalizeRestrictedTextBrief } from "./index.ts";

function fixture(prompt = "  Build\nA RED and yellow staircase with 18 pieces.  ") {
  const document = createEmptyBrickDocument({ id: "brief-test", name: "Brief test" });
  const baseDocumentHash = documentStructuralHash(document);
  const allowedCatalogPartIds = PART_DEFINITIONS.map(({ id }) => id);
  const allowedColorIds = COLOR_DEFINITIONS.map(({ id }) => id);
  const brief = {
    schemaVersion: "lego.build-brief/1",
    mode: "full",
    prompt,
    referenceArtifactIds: [],
    baseRevision: document.revision,
    baseDocumentHash,
    allowedCatalogPartIds,
    allowedColorIds,
    pieceBudget: 24,
    semanticRequirements: ["one connected model"],
    styleTags: ["simple"],
    budgets: {
      maxCandidates: 4,
      maxRepairs: 0,
      maxProviderCalls: 0,
      maxTokens: 0,
      maxCostMicros: 0,
      maxWallTimeMs: 10_000,
      maxRenders: 32,
      maxStoredBytes: 1_048_576,
    },
    consent: {
      policyVersion: "local-text-1",
      providerTransmission: "none",
      retainRunArtifacts: true,
      knowledgeUse: false,
      benchmarkUse: false,
      trainingUse: false,
    },
  } satisfies BuildBriefV1;
  const scope = {
    schemaVersion: "lego.scope-capability/1",
    capabilityId: "full-empty-scope",
    baseRevision: document.revision,
    baseDocumentHash,
    frozenPartIds: [],
    mutablePartIds: [],
    requiredAttachmentPorts: [],
    allowedVolume: { minLdu: [-400, -400, -400], maxLdu: [400, 400, 400] },
    allowedCatalogPartIds,
    allowedColorIds,
    budgets: { maxAddedParts: 24, maxRemovedParts: 0, maxOperations: 160 },
  } satisfies ScopeCapabilityV1;
  return { document, brief, scope };
}

describe("restricted text brief normalization", () => {
  it("canonicalizes bounded text and extracts only supported deterministic intent", () => {
    const { document, brief, scope } = fixture();
    const result = normalizeRestrictedTextBrief({ document, brief, scope });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.brief.normalizedPrompt).toBe("build a red and yellow staircase with 18 pieces.");
    expect(result.brief.requestedShape).toBe("staircase");
    expect(result.brief.requestedColorIds).toEqual(["builtin:red", "builtin:yellow"]);
    expect(result.brief.targetPartCount).toBe(18);
    expect(result.brief.candidateLimit).toBe(4);
    expect(Object.isFrozen(result.brief)).toBe(true);
    expect(Object.isFrozen(result.brief.requestedColorIds)).toBe(true);
  });

  it("parses common hyphenated piece-count syntax", () => {
    const { document, brief, scope } = fixture("Build a red 16-piece tower");
    const result = normalizeRestrictedTextBrief({ document, brief, scope });

    expect(result).toMatchObject({ ok: true, brief: { targetPartCount: 16 } });
  });

  it("fails closed on unsupported modes, references, oversized prompts, and sub-ten budgets", () => {
    const { document, brief, scope } = fixture();
    const cases: readonly [unknown, string][] = [
      [{ ...brief, mode: "repair" }, "MODE_NOT_SUPPORTED"],
      [{ ...brief, referenceArtifactIds: ["reference-1"] }, "REFERENCES_NOT_SUPPORTED"],
      [{ ...brief, prompt: "x".repeat(MAX_RESTRICTED_PROMPT_CHARS + 1) }, "PROMPT_TOO_LARGE"],
      [{ ...brief, pieceBudget: 9 }, "PART_BUDGET_TOO_SMALL"],
      [{ ...brief, budgets: { ...brief.budgets, maxWallTimeMs: 1 } }, "WALL_TIME_BUDGET_TOO_SMALL"],
    ];

    for (const [candidateBrief, expectedCode] of cases) {
      const result = normalizeRestrictedTextBrief({
        document,
        brief: candidateBrief,
        scope,
      });
      expect(result).toMatchObject({ ok: false, failure: { code: expectedCode } });
    }
  });

  it("rejects capabilities that broaden the brief instead of silently intersecting authority", () => {
    const { document, brief, scope } = fixture();
    const narrowedBrief = {
      ...brief,
      allowedCatalogPartIds: ["builtin:brick-1x1"],
      allowedColorIds: ["builtin:red"],
    } satisfies BuildBriefV1;
    const result = normalizeRestrictedTextBrief({
      document,
      brief: narrowedBrief,
      scope,
    });

    expect(result).toMatchObject({
      ok: false,
      failure: { stage: "input", code: "SCOPE_BROADENS_BRIEF" },
    });
  });

  it("rejects accessor-bearing input without executing the accessor", () => {
    const { document, brief, scope } = fixture();
    let reads = 0;
    const hostileBrief = { ...brief };
    Object.defineProperty(hostileBrief, "prompt", {
      enumerable: true,
      get: () => {
        reads += 1;
        return brief.prompt;
      },
    });

    const result = normalizeRestrictedTextBrief({ document, brief: hostileBrief, scope });

    expect(result).toMatchObject({
      ok: false,
      failure: { code: "INPUT_NOT_DATA_ONLY" },
    });
    expect(reads).toBe(0);
  });

  it("applies tighter local bounds to otherwise schema-valid brief metadata", () => {
    const { document, brief, scope } = fixture();
    const result = normalizeRestrictedTextBrief({
      document,
      brief: {
        ...brief,
        semanticRequirements: Array.from({ length: 17 }, (_, index) => `requirement ${index}`),
      },
      scope,
    });

    expect(result).toMatchObject({
      ok: false,
      failure: { code: "BRIEF_METADATA_TOO_LARGE" },
    });
  });

  it("rejects unsupported prompt and requirement semantics instead of inventing a match", () => {
    const { document, brief, scope } = fixture();

    expect(
      normalizeRestrictedTextBrief({
        document,
        brief: { ...brief, prompt: "Build a red elephant" },
        scope,
      }),
    ).toMatchObject({ ok: false, failure: { code: "SHAPE_NOT_SUPPORTED" } });
    expect(
      normalizeRestrictedTextBrief({
        document,
        brief: { ...brief, prompt: "Build a red tower with a staircase" },
        scope,
      }),
    ).toMatchObject({ ok: false, failure: { code: "SHAPE_NOT_SUPPORTED" } });
    expect(
      normalizeRestrictedTextBrief({
        document,
        brief: { ...brief, semanticRequirements: ["must have ears"] },
        scope,
      }),
    ).toMatchObject({
      ok: false,
      failure: { code: "SEMANTIC_REQUIREMENT_NOT_SUPPORTED" },
    });

    expect(
      normalizeRestrictedTextBrief({
        document,
        brief: {
          ...brief,
          prompt: "Build a blue 10 piece tower",
          allowedColorIds: ["builtin:red"],
        },
        scope: { ...scope, allowedColorIds: ["builtin:red"] },
      }),
    ).toMatchObject({
      ok: false,
      failure: { code: "REQUESTED_COLOR_NOT_ALLOWED" },
    });
  });

  it("rejects oversized ignored strings before cloning the full input graph", () => {
    const { document, brief, scope } = fixture();
    const oversizedInput = {
      document,
      brief,
      scope,
      padding: "x".repeat(8_193),
    };
    const result = normalizeRestrictedTextBrief(oversizedInput);

    expect(result).toMatchObject({ ok: false, failure: { code: "INPUT_NOT_DATA_ONLY" } });
  });
});
