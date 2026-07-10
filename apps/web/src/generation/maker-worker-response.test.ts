import { describe, expect, it } from "vitest";

import { createEmptyBrickDocument } from "@lego-studio/brick-kernel";
import {
  runDeterministicMakerPopulation,
  type MakerPopulationSuccess,
} from "@lego-studio/generation";

import { createCandidateLabRequest } from "./candidate-lab-request";
import { computeTrustedPopulationDigest } from "./candidate-lab-verifier";
import { parsePopulationWorkerResponse } from "./maker-worker-response";

function fixture() {
  const document = createEmptyBrickDocument({ id: "worker-parser", name: "Worker parser" });
  const request = createCandidateLabRequest(document, "Build an 18-piece red tower", "parser-job");
  const result = runDeterministicMakerPopulation(request);
  if (!result.ok) throw new Error(result.failure.message);
  const envelope = (candidate: unknown) => ({
    kind: "population-result",
    requestId: "parser-request",
    result: candidate,
  });
  const trustedDigest = {
    kind: "trusted-population-digest",
    requestId: "parser-request",
    ...computeTrustedPopulationDigest(request),
  };
  const parse = (candidate: unknown, verifier: unknown = trustedDigest) =>
    parsePopulationWorkerResponse(envelope(candidate), verifier, "parser-request", request);
  return { request, result, envelope, trustedDigest, parse };
}

function mutableResult(result: MakerPopulationSuccess) {
  return structuredClone(result) as unknown as {
    makerVersion: string;
    rankingPolicyHash: string;
    attempts: Array<{
      candidateId: string;
      status: string;
      programHash: string | null;
      patch: { provenance: { jobId: string } } | null;
      metrics: { weightedScorePermyriad: number } | null;
      document: { name: string } | null;
      validationReport: { issues: unknown[] } | null;
    }>;
    rankedCandidates: Array<{
      candidateId: string;
      metrics: { weightedScorePermyriad: number };
    }>;
  };
}

describe("maker worker response parser", () => {
  it("accepts exact same-build population evidence", () => {
    const { result, parse } = fixture();
    expect(parse(result)).toMatchObject({
      ok: true,
      result: { jobId: "parser-job", attempts: { length: 4 } },
    });
  });

  it("rejects manifest, program, provenance, and ranked-copy tampering", () => {
    const { result, parse } = fixture();
    const mutations: ReadonlyArray<
      readonly [string, (candidate: ReturnType<typeof mutableResult>) => void]
    > = [
      [
        "maker version",
        (candidate) => {
          candidate.makerVersion = "lego.generation/tampered";
        },
      ],
      [
        "ranking policy",
        (candidate) => {
          candidate.rankingPolicyHash = `sha256:${"f".repeat(64)}`;
        },
      ],
      [
        "program hash",
        (candidate) => {
          const hardValid = candidate.attempts.find(({ status }) => status === "hard-valid");
          if (hardValid) hardValid.programHash = `sha256:${"0".repeat(64)}`;
        },
      ],
      [
        "patch provenance",
        (candidate) => {
          const hardValid = candidate.attempts.find(({ status }) => status === "hard-valid");
          if (hardValid?.patch) hardValid.patch.provenance.jobId = "different-job";
        },
      ],
      [
        "ranked copy",
        (candidate) => {
          const ranked = candidate.rankedCandidates[0];
          if (ranked) {
            candidate.rankedCandidates[0] = structuredClone(ranked);
            candidate.rankedCandidates[0]!.metrics.weightedScorePermyriad -= 1;
          }
        },
      ],
      [
        "paired shared metric",
        (candidate) => {
          const hardValid = candidate.attempts.find(({ status }) => status === "hard-valid");
          if (!hardValid?.metrics) return;
          const forgedScore = hardValid.metrics.weightedScorePermyriad - 1;
          hardValid.metrics.weightedScorePermyriad = forgedScore;
          const ranked = candidate.rankedCandidates.find(
            ({ candidateId }) => candidateId === hardValid.candidateId,
          );
          if (ranked) ranked.metrics.weightedScorePermyriad = forgedScore;
        },
      ],
      [
        "forged report and document",
        (candidate) => {
          const hardValid = candidate.attempts.find(({ status }) => status === "hard-valid");
          if (hardValid?.document) hardValid.document.name = "Forged worker label";
          hardValid?.validationReport?.issues.push({
            issueId: "forged-advisory",
            validatorId: "forged-worker",
            code: "FORGED_WORKER_CLAIM",
            severity: "advisory",
            message: "Looks plausible but did not come from the trusted validator",
            path: "",
            partIds: [],
            connectionIds: [],
            scope: "document",
          });
        },
      ],
    ];

    for (const [label, mutate] of mutations) {
      const candidate = mutableResult(result);
      mutate(candidate);
      expect(parse(candidate), label).toMatchObject({
        ok: false,
        code: "MALFORMED_WORKER_RESPONSE",
      });
    }
  });

  it("is total for cycles and rejects malformed failures, counts, and unknown fields", () => {
    const { result, parse, trustedDigest } = fixture();

    const cyclic = structuredClone(result) as unknown as Record<string, unknown>;
    cyclic.self = cyclic;
    expect(() => parse(cyclic)).not.toThrow();
    expect(parse(cyclic)).toMatchObject({ ok: false, code: "MALFORMED_WORKER_RESPONSE" });

    const malformedCompile = structuredClone(result) as unknown as {
      attempts: Array<Record<string, unknown>>;
    };
    const attempt = malformedCompile.attempts[0]!;
    Object.assign(attempt, {
      status: "failed",
      document: null,
      patch: null,
      validationReport: null,
      metrics: null,
      rank: null,
      structuralHash: null,
      failure: {
        stage: "compile",
        code: "COMPILATION_REJECTED",
        message: "Missing required issue evidence",
      },
    });
    expect(parse(malformedCompile)).toMatchObject({
      ok: false,
      code: "MALFORMED_WORKER_RESPONSE",
    });

    const shortPopulation = structuredClone(result) as unknown as { attempts: unknown[] };
    shortPopulation.attempts.pop();
    expect(parse(shortPopulation)).toMatchObject({
      ok: false,
      code: "MALFORMED_WORKER_RESPONSE",
    });

    const extraField = structuredClone(result) as unknown as Record<string, unknown>;
    extraField.untrustedLabel = "looks valid";
    expect(parse(extraField)).toMatchObject({
      ok: false,
      code: "MALFORMED_WORKER_RESPONSE",
    });

    const falseMakerFailure = {
      ok: false,
      failure: {
        stage: "input",
        code: "PROMPT_EMPTY",
        message: "The worker falsely claimed the non-empty prompt was empty",
        path: "/brief/prompt",
      },
    };
    expect(parse(falseMakerFailure)).toMatchObject({
      ok: false,
      code: "MALFORMED_WORKER_RESPONSE",
    });

    expect(
      parse(result, { ...trustedDigest, requestHash: `sha256:${"0".repeat(64)}` }),
    ).toMatchObject({ ok: false, code: "MALFORMED_WORKER_RESPONSE" });
  });
});
