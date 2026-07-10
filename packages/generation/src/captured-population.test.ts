import { describe, expect, it } from "vitest";

import {
  canonicalDigest,
  createEmptyBrickDocument,
  documentStructuralHash,
} from "@lego-studio/brick-kernel";
import { COLOR_DEFINITIONS, PART_DEFINITIONS } from "@lego-studio/catalog";
import type { BuildBriefV1, BuildProgramV1, ScopeCapabilityV1 } from "@lego-studio/protocol";

import {
  generateDeterministicPrograms,
  normalizeRestrictedTextBrief,
  replayCapturedMakerPopulation,
  runDeterministicMakerPopulation,
  type DeterministicMakerPopulationInput,
  type GeneratedRecipeResult,
} from "./index.ts";

function fixture(prompt = "Build a red and yellow 16 piece tower") {
  const document = createEmptyBrickDocument({
    id: "captured-population-test",
    name: "Captured population test",
  });
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
      maxRenders: 28,
      maxStoredBytes: 16_777_216,
    },
    consent: {
      policyVersion: "local-captured-population-1",
      providerTransmission: "none",
      retainRunArtifacts: true,
      knowledgeUse: false,
      benchmarkUse: false,
      trainingUse: false,
    },
  } satisfies BuildBriefV1;
  const scope = {
    schemaVersion: "lego.scope-capability/1",
    capabilityId: "captured-full-empty-scope",
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
  return {
    jobId: "captured-population-job",
    document,
    brief,
    scope,
  } satisfies DeterministicMakerPopulationInput;
}

function generatedFor(input: DeterministicMakerPopulationInput) {
  const normalized = normalizeRestrictedTextBrief(input);
  if (!normalized.ok) throw new Error(normalized.failure.message);
  return generateDeterministicPrograms(normalized.brief, normalized.scope.budgets.maxOperations);
}

function recolorFirstProgram(
  generated: readonly GeneratedRecipeResult[],
): readonly GeneratedRecipeResult[] {
  return generated.map((result, index) => {
    if (index !== 0 || !("program" in result)) return result;
    const operations = result.program.operations.map((operation) =>
      operation.kind === "placePart" && operation.operationId === "place-1"
        ? { ...operation, colorId: "builtin:blue" }
        : operation,
    );
    const program: BuildProgramV1 = { ...result.program, operations };
    return { ...result, program, programHash: canonicalDigest(program) };
  });
}

describe("captured maker population replay", () => {
  it("matches the live deterministic path while compiling only the captured recipe results", () => {
    const input = fixture();
    const generated = generatedFor(input);

    expect(replayCapturedMakerPopulation(input, generated)).toEqual(
      runDeterministicMakerPopulation(input),
    );
    expect(canonicalDigest(runDeterministicMakerPopulation(input))).toBe(
      "sha256:331198ffc2353e357d5ecf7c1f93ccd2f42ebd728d7a519fe495a20291d4c840",
    );
  });

  it("uses a changed but valid captured program instead of regenerating the recipe", () => {
    const input = fixture();
    const generated = generatedFor(input);
    const captured = recolorFirstProgram(generated);

    const replayed = replayCapturedMakerPopulation(input, captured);
    const live = runDeterministicMakerPopulation(input);

    expect(replayed.ok).toBe(true);
    expect(live.ok).toBe(true);
    if (!replayed.ok || !live.ok) return;
    expect(replayed.rankedCandidates).not.toEqual(live.rankedCandidates);
    expect(replayed.attempts[0]!.programHash).toBe(
      "program" in captured[0]! ? captured[0]!.programHash : null,
    );
    expect(replayed.attempts[0]!.programHash).not.toBe(live.attempts[0]!.programHash);
  });

  it("rejects a forged captured program hash before compilation", () => {
    const input = fixture();
    const generated = generatedFor(input);
    const forged = generated.map((result, index) =>
      index === 0 && "program" in result
        ? { ...result, programHash: `sha256:${"f".repeat(64)}` }
        : result,
    );

    expect(replayCapturedMakerPopulation(input, forged)).toEqual({
      ok: false,
      failure: expect.objectContaining({
        stage: "captured-output",
        code: "PROGRAM_HASH_MISMATCH",
        path: "/capturedPrograms/0/programHash",
      }),
    });
  });

  it("rejects schema-valid but non-normalized program bytes before compilation", () => {
    const input = fixture();
    const generated = generatedFor(input);
    const nonCanonical = generated.map((result, index) => {
      if (index !== 0 || !("program" in result)) return result;
      const operations = result.program.operations.map((operation) =>
        operation.kind === "placePart" && operation.operationId === "place-1"
          ? { ...operation, semanticTags: ["z-last", "a-first"] }
          : operation,
      );
      const program: BuildProgramV1 = { ...result.program, operations };
      return { ...result, program, programHash: canonicalDigest(program) };
    });

    expect(replayCapturedMakerPopulation(input, nonCanonical)).toEqual({
      ok: false,
      failure: expect.objectContaining({
        stage: "captured-output",
        code: "PROGRAM_NOT_NORMALIZED",
        path: "/capturedPrograms/0/program",
      }),
    });
  });

  it("requires exactly the admitted candidate count and unique strategy identifiers", () => {
    const input = fixture();
    const generated = generatedFor(input);

    expect(replayCapturedMakerPopulation(input, generated.slice(0, 3))).toEqual({
      ok: false,
      failure: expect.objectContaining({ code: "CANDIDATE_COUNT_MISMATCH" }),
    });
    expect(
      replayCapturedMakerPopulation(input, [generated[0]!, generated[0]!, ...generated.slice(2)]),
    ).toEqual({
      ok: false,
      failure: expect.objectContaining({ code: "DUPLICATE_STRATEGY_ID" }),
    });
  });

  it("rejects unknown fields, accessors, cycles, and oversized captured output", () => {
    const input = fixture();
    const generated = generatedFor(input);
    const withUnknown = generated.map((result, index) =>
      index === 0 ? { ...result, authority: "trusted" } : result,
    );
    const accessor = generated.map((result) => ({ ...result }));
    Object.defineProperty(accessor[0]!, "programHash", {
      enumerable: true,
      get: () => `sha256:${"0".repeat(64)}`,
    });
    const cyclic: unknown[] = [];
    cyclic.push(cyclic, ...generated.slice(1));
    const oversized = Array.from({ length: 5 }, (_, index) => ({
      strategyId: `oversized-${index}`,
      shape: "tower",
      failure: {
        stage: "generation",
        code: "NO_CONNECTION_PATH",
        message: "x".repeat(2_000),
      },
    }));

    for (const value of [withUnknown, accessor, cyclic, oversized]) {
      const result = replayCapturedMakerPopulation(input, value);
      expect(result.ok).toBe(false);
      if (result.ok) continue;
      expect(result.failure.stage).toBe("captured-output");
    }
  });

  it("preserves input rejection without interpreting attacker-controlled captured output", () => {
    const input = { ...fixture(), jobId: "bad id" };
    const poison = new Proxy(
      {},
      {
        ownKeys() {
          throw new Error("captured output should not be inspected");
        },
      },
    );

    const result = replayCapturedMakerPopulation(input, poison);

    expect(result).toEqual({
      ok: false,
      failure: expect.objectContaining({ stage: "input", code: "JOB_ID_INVALID" }),
    });
  });
});
