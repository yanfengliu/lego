import { describe, expect, it } from "vitest";

import { canonicalDigest } from "@lego-studio/brick-kernel";
import type { BuildProgramV1 } from "@lego-studio/protocol";

import {
  generateDeterministicPrograms,
  normalizeRestrictedTextBrief,
  replayCapturedMakerPopulation,
  runDeterministicMakerPopulation,
  type DeterministicMakerPopulationInput,
  type GeneratedRecipeResult,
} from "./index.ts";
import { DETERMINISTIC_RUN_PIN } from "./run-pin.generated.ts";
import { describePinDrift, liveCatalogTruth, pinnedRunInput } from "./run-pin.ts";

/** The pinned run doubles as this file's fixture, so the pin covers what is tested. */
const fixture = (): DeterministicMakerPopulationInput => pinnedRunInput();

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
  });

  it("still produces the pinned run digest", () => {
    const liveDigest = canonicalDigest(runDeterministicMakerPopulation(fixture()));

    expect(liveDigest, describePinDrift(DETERMINISTIC_RUN_PIN, liveDigest)).toBe(
      DETERMINISTIC_RUN_PIN.populationDigest,
    );
  });

  it("pins the digest against the catalog truth it was taken from", () => {
    // Without this the pin could be re-generated against one catalog and read
    // as evidence about another, which is the whole basis of telling a catalog
    // change apart from a change in the deterministic path.
    const live = liveCatalogTruth();

    expect(
      { version: live.version, hash: live.hash },
      "The recorded catalog truth is stale relative to this build. Run `npm run pin:generate`.",
    ).toEqual({
      version: DETERMINISTIC_RUN_PIN.catalogVersion,
      hash: DETERMINISTIC_RUN_PIN.catalogTruthHash,
    });
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
