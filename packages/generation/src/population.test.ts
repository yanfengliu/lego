import { describe, expect, it } from "vitest";

import { createEmptyBrickDocument, documentStructuralHash } from "@lego-studio/brick-kernel";
import { COLOR_DEFINITIONS, PART_DEFINITIONS } from "@lego-studio/catalog";
import type { BuildBriefV1, ScopeCapabilityV1 } from "@lego-studio/protocol";

import { runDeterministicMakerPopulation } from "./index.ts";

function fixture(
  options: {
    readonly prompt?: string;
    readonly maxCandidates?: number;
    readonly allowedCatalogPartIds?: readonly string[];
    readonly allowedColorIds?: readonly string[];
    readonly volumeHalfExtent?: number;
    readonly pieceBudget?: number;
    readonly maxOperations?: number;
    readonly maxStoredBytes?: number;
  } = {},
) {
  const document = createEmptyBrickDocument({ id: "population-test", name: "Population test" });
  const baseDocumentHash = documentStructuralHash(document);
  const allowedCatalogPartIds = [
    ...(options.allowedCatalogPartIds ?? PART_DEFINITIONS.map(({ id }) => id)),
  ];
  const allowedColorIds = [...(options.allowedColorIds ?? COLOR_DEFINITIONS.map(({ id }) => id))];
  const brief = {
    schemaVersion: "lego.build-brief/1",
    mode: "full",
    prompt: options.prompt ?? "Build a red and yellow 16 piece tower",
    referenceArtifactIds: [],
    baseRevision: document.revision,
    baseDocumentHash,
    allowedCatalogPartIds,
    allowedColorIds,
    pieceBudget: options.pieceBudget ?? 24,
    semanticRequirements: ["one connected model"],
    styleTags: ["simple"],
    budgets: {
      maxCandidates: options.maxCandidates ?? 4,
      maxRepairs: 0,
      maxProviderCalls: 0,
      maxTokens: 0,
      maxCostMicros: 0,
      maxWallTimeMs: 10_000,
      maxRenders: 32,
      maxStoredBytes: options.maxStoredBytes ?? 16_777_216,
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
  const halfExtent = options.volumeHalfExtent ?? 400;
  const scope = {
    schemaVersion: "lego.scope-capability/1",
    capabilityId: "full-empty-scope",
    baseRevision: document.revision,
    baseDocumentHash,
    frozenPartIds: [],
    mutablePartIds: [],
    requiredAttachmentPorts: [],
    allowedVolume: {
      minLdu: [-halfExtent, -halfExtent, -halfExtent],
      maxLdu: [halfExtent, halfExtent, halfExtent],
    },
    allowedCatalogPartIds,
    allowedColorIds,
    budgets: {
      maxAddedParts: options.pieceBudget ?? 24,
      maxRemovedParts: 0,
      maxOperations: options.maxOperations ?? 160,
    },
  } satisfies ScopeCapabilityV1;
  return { jobId: "population-job", document, brief, scope };
}

describe("deterministic maker population", () => {
  it("generates, compiles, deduplicates, and ranks four immutable hard-valid candidates", () => {
    const first = runDeterministicMakerPopulation(fixture());
    const second = runDeterministicMakerPopulation(fixture());

    expect(first).toEqual(second);
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.attempts).toHaveLength(4);
    expect(first.rankedCandidates).toHaveLength(4);
    expect(first.rankedCandidates.map(({ rank }) => rank)).toEqual([1, 2, 3, 4]);
    expect(first.rankedCandidates[0]!.shape).toBe("tower");
    expect(first.rankedCandidates[0]!.metrics.shapeMatchPermyriad).toBe(10_000);
    expect(
      first.rankedCandidates.slice(1).every(({ metrics }) => metrics.shapeMatchPermyriad === 0),
    ).toBe(true);
    expect(
      new Set(first.rankedCandidates.map(({ structuralHash }) => structuralHash)),
    ).toHaveLength(4);
    for (const candidate of first.rankedCandidates) {
      expect(candidate.status).toBe("hard-valid");
      expect(candidate.validationReport.patchValid).toBe(true);
      expect(candidate.validationReport.documentGloballyValid).toBe(true);
      expect(candidate.metrics.partCount).toBeGreaterThanOrEqual(10);
      expect(candidate.metrics.partCount).toBeLessThanOrEqual(40);
      expect(candidate.program.operations.length).toBeLessThanOrEqual(512);
      expect(candidate.lineage.parentCandidateId).toBeNull();
      expect(Object.isFrozen(candidate)).toBe(true);
      expect(Object.isFrozen(candidate.program)).toBe(true);
    }
    expect(Object.isFrozen(first)).toBe(true);
  });

  it("honors the lower of the brief and maker four-candidate ceilings", () => {
    const result = runDeterministicMakerPopulation(fixture({ maxCandidates: 2 }));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.normalizedBrief.candidateLimit).toBe(2);
    expect(result.attempts).toHaveLength(2);
    expect(result.rankedCandidates).toHaveLength(2);
  });

  it.each([10, 40])("keeps every emitted model inside the 10-40 part milestone at %i", (target) => {
    const result = runDeterministicMakerPopulation(
      fixture({
        prompt: `Build a red and yellow ${target} piece tower`,
        pieceBudget: target,
        maxOperations: 512,
        volumeHalfExtent: 600,
      }),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.rankedCandidates).toHaveLength(4);
    expect(result.rankedCandidates.every(({ metrics }) => metrics.partCount === target)).toBe(true);
  });

  it("retains duplicate attempts as typed evidence while ranking only one structural result", () => {
    const result = runDeterministicMakerPopulation(
      fixture({
        prompt: "Build a red 16 piece tower",
        allowedCatalogPartIds: ["builtin:brick-1x1"],
        allowedColorIds: ["builtin:red"],
      }),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.rankedCandidates).toHaveLength(1);
    expect(result.attempts.filter(({ status }) => status === "duplicate")).toHaveLength(3);
    const duplicate = result.attempts.find(({ status }) => status === "duplicate");
    expect(duplicate).toMatchObject({
      program: { schemaVersion: "lego.build-program/1" },
      programHash: expect.stringMatching(/^sha256:/u),
      structuralHash: result.rankedCandidates[0]!.structuralHash,
      document: null,
      patch: null,
      validationReport: null,
      metrics: null,
    });
    expect(result.attempts.slice(1)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          status: "duplicate",
          failure: expect.objectContaining({
            stage: "deduplication",
            code: "DUPLICATE_STRUCTURAL_HASH",
          }),
        }),
      ]),
    );
  });

  it("keeps trusted compiler failures inspectable and out of ranking", () => {
    const result = runDeterministicMakerPopulation(fixture({ volumeHalfExtent: 20 }));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.rankedCandidates).toHaveLength(0);
    expect(result.attempts).toHaveLength(4);
    for (const attempt of result.attempts) {
      expect(attempt).toMatchObject({
        status: "failed",
        failure: { stage: "compile", code: "COMPILATION_REJECTED" },
      });
      if (attempt.status !== "failed" || attempt.failure.stage !== "compile") continue;
      expect(attempt.failure.issues.map(({ code }) => code)).toContain("SCOPE_VOLUME_EXCEEDED");
    }
  });

  it("fails closed when canonical retained evidence exceeds the storage budget", () => {
    const result = runDeterministicMakerPopulation(fixture({ maxStoredBytes: 1 }));

    expect(result).toMatchObject({
      ok: false,
      failure: { code: "OUTPUT_STORAGE_BUDGET_EXCEEDED" },
    });
  });

  it("rejects non-empty bases for the full-model milestone without mutating them", () => {
    const input = fixture();
    const part = {
      id: "existing-part",
      catalogPartId: "builtin:brick-1x1",
      colorId: "builtin:red",
      transform: {
        positionLdu: [0, 0, 0] as [number, number, number],
        orientationId: "upright-yaw-0",
      },
      submodelId: "root",
      stepId: "step-1",
      semanticTags: [],
      provenance: { source: "manual" as const },
    };
    const document = {
      ...input.document,
      parts: [part],
      submodels: [{ ...input.document.submodels[0]!, partIds: [part.id] }],
      steps: [{ ...input.document.steps[0]!, partIds: [part.id] }],
    };
    const before = structuredClone(document);
    const result = runDeterministicMakerPopulation({ ...input, document });

    expect(result).toMatchObject({ ok: false, failure: { code: "BASE_NOT_EMPTY" } });
    expect(document).toEqual(before);
  });
});
