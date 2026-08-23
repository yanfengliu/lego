import { createHash } from "node:crypto";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  answerBundle,
  boundAnswerCheckpoint,
  PART_ANSWERS_SCHEMA,
  publishPartIdentificationAnswerCheckpoint,
} from "./part-identification-answer-checkpoint.mjs";
import { parsePartIdentificationAnswerLines } from "./part-identification-answer-lines.mjs";
import { callProofJsonBytes, callProofSha256 } from "./part-identification-call-proof-digest.mjs";
import {
  answerRecordDigest,
  verifyPartIdentificationCallProof,
} from "./part-identification-call-proof.mjs";
import { createPartIdentificationClaudeTransportForTest } from "./part-identification-claude-transport-test-only.mjs";
import {
  partIdentificationInstructionBytes,
  PART_IDENTIFICATION_PROMPT_DIGEST,
} from "./part-identification-instruction.mjs";
import { publishImmutableContainedBytes } from "./part-identification-immutable-cas.mjs";
import {
  partIdentificationEvidenceContent,
  createPartIdentificationMcpRequest,
} from "./part-identification-mcp-server.mjs";
import { readJsonArtifact } from "./part-identification-artifacts.mjs";
import {
  PART_IDENTIFICATION_MODEL_ID,
  PART_IDENTIFICATION_MODEL_IDENTITY,
} from "./part-identification-model.mjs";
import {
  PART_IDENTIFICATION_CLAUDE_CLI_VERSION,
  PART_IDENTIFICATION_CLAUDE_TOOL,
  PART_IDENTIFICATION_MCP_SERVER,
  PART_IDENTIFICATION_TRANSPORT_CONTRACT_DIGEST,
} from "./part-identification-transport-contract.mjs";

const roots = [];
afterEach(() => {
  while (roots.length > 0) rmSync(roots.pop(), { recursive: true, force: true });
});
const root = () => {
  const value = join(
    tmpdir(),
    `lego-answer-checkpoint-${process.pid}-${Date.now()}-${roots.length}`,
  );
  roots.push(value);
  return value;
};
const sha256 = (bytes) => `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
const cardId = "card-0001";
const image = Buffer.from("89504e470d0a1a0a010203", "hex");
const imageDigest = sha256(image);
const cardsDigest = `sha256:${"a".repeat(64)}`;
const matchDigest = `sha256:${"b".repeat(64)}`;

const answerText = (pick, note) =>
  `${cardId} ${JSON.stringify({
    kind: "brick",
    studsLong: 2,
    studsWide: 4,
    colour: "Red",
    pick,
    alsoCouldBe: 0,
    differsFromPick: pick === 0 ? "not-on-card" : "nothing",
    confidence: pick === 0 ? 0.2 : 0.9,
    ...(pick === 0 ? { note } : {}),
  })}`;

function request() {
  return createPartIdentificationMcpRequest({
    cardIds: [cardId],
    images: new Map([[cardId, image]]),
    digests: new Map([[cardId, imageDigest]]),
    model: PART_IDENTIFICATION_MODEL_ID,
    cardsDigest,
    promptDigest: PART_IDENTIFICATION_PROMPT_DIGEST,
    instructionBytes: partIdentificationInstructionBytes([cardId]),
  });
}

function stream(requestValue, cwd, text) {
  const toolId = "toolu_lineage";
  return `${[
    {
      type: "system",
      subtype: "init",
      cwd,
      model: PART_IDENTIFICATION_MODEL_ID,
      permissionMode: "dontAsk",
      claude_code_version: PART_IDENTIFICATION_CLAUDE_CLI_VERSION,
      tools: [PART_IDENTIFICATION_CLAUDE_TOOL],
      mcp_servers: [{ name: PART_IDENTIFICATION_MCP_SERVER, status: "connected" }],
      plugins: [],
      skills: [],
      slash_commands: [],
      agents: [],
      hooks: [],
      commands: [],
    },
    {
      type: "assistant",
      message: {
        role: "assistant",
        content: [
          { type: "tool_use", id: toolId, name: PART_IDENTIFICATION_CLAUDE_TOOL, input: {} },
        ],
      },
    },
    {
      type: "user",
      message: {
        role: "user",
        content: [
          {
            type: "tool_result",
            tool_use_id: toolId,
            is_error: false,
            content: partIdentificationEvidenceContent(requestValue),
          },
        ],
      },
    },
    { type: "assistant", message: { role: "assistant", content: [{ type: "text", text }] } },
    {
      type: "result",
      subtype: "success",
      is_error: false,
      result: text,
      modelUsage: {
        [PART_IDENTIFICATION_MODEL_ID]: { canonicalModel: "claude-opus-5", provider: "firstParty" },
      },
      usage: {
        input_tokens: 10,
        cache_creation_input_tokens: 2,
        cache_read_input_tokens: 3,
        output_tokens: 4,
      },
      total_cost_usd: 0.01,
    },
  ]
    .map((event) => JSON.stringify(event))
    .join("\n")}\n`;
}

async function retainedProof(out, text) {
  const requestValue = request();
  const transport = createPartIdentificationClaudeTransportForTest({
    async runChild(_command, _args, options) {
      return { code: 0, signal: null, stdout: stream(requestValue, options.cwd, text), stderr: "" };
    },
  });
  const result = await transport({
    cardIds: [cardId],
    images: new Map([[cardId, image]]),
    digests: new Map([[cardId, imageDigest]]),
    model: PART_IDENTIFICATION_MODEL_ID,
    cardsDigest,
  });
  const parsed = parsePartIdentificationAnswerLines(text, [cardId]);
  const proof = verifyPartIdentificationCallProof({
    ...result.proof,
    parsedAnswers: parsed.parsedAnswers,
  });
  const bytes = callProofJsonBytes(proof);
  const digest = callProofSha256(bytes);
  const path = `call-proofs/sha256/${digest.slice("sha256:".length)}.json`;
  publishImmutableContainedBytes(out, path, bytes, {
    label: "Test sanitized call proof",
    pathLabel: "Test proof path",
    maxBytes: 24 * 1024 * 1024,
  });
  return {
    parsed: parsed.parsedAnswers[0],
    digest,
    reference: { path, byteLength: bytes.length, digest },
  };
}

const context = (out) => ({
  model: PART_IDENTIFICATION_MODEL_ID,
  matchDigest,
  cardsDigest,
  promptDigest: PART_IDENTIFICATION_PROMPT_DIGEST,
  clusters: [{ clusterIndex: 1 }],
  cards: { [cardId]: { sha256: imageDigest, candidateElementIds: ["3001"] } },
  cardImages: new Map([[cardId, image]]),
  traceRoot: out,
});

function bundleFor(proofs, predecessor = null) {
  const current = proofs[proofs.length - 1];
  const calls = {};
  const attempts = { 1: [] };
  for (const proof of proofs) {
    calls[proof.digest] = { proof: proof.reference, orderedCardIds: [cardId] };
    attempts[1].push({
      callDigest: proof.digest,
      cardId,
      answerDigest: proof.parsed.answerDigest,
      outcome: proof.parsed.outcome,
    });
  }
  return answerBundle({
    model: PART_IDENTIFICATION_MODEL_ID,
    modelIdentity: PART_IDENTIFICATION_MODEL_IDENTITY,
    matchDigest,
    cardsDigest,
    promptDigest: PART_IDENTIFICATION_PROMPT_DIGEST,
    predecessor,
    calls,
    attempts,
    answers: { 1: current.parsed.answer },
  });
}

describe("immutable /5 answer checkpoints", () => {
  it("refuses an answer whose blank-note canonicalization would hide an own __proto__ key", async () => {
    const out = root();
    const text =
      `${cardId} {"kind":"brick","studsLong":2,"studsWide":4,"colour":"Red",` +
      '"pick":1,"alsoCouldBe":0,"differsFromPick":"nothing","confidence":0.9,' +
      '"note":"","__proto__":null}';
    const proof = await retainedProof(out, text);
    expect(proof.parsed).toMatchObject({ outcome: "no-usable-reply", answer: null });
    publishPartIdentificationAnswerCheckpoint(
      out,
      `answers-${PART_IDENTIFICATION_MODEL_ID}.json`,
      bundleFor([proof]),
    );
    const artifact = readJsonArtifact(
      join(out, `answers-${PART_IDENTIFICATION_MODEL_ID}.json`),
      "prototype-key answer checkpoint",
    );
    expect(boundAnswerCheckpoint(artifact, context(out)).answers[1]).toBeNull();
  });

  it("replays exact proofs/card bytes and an append-only predecessor chain", async () => {
    const out = root();
    const first = await retainedProof(out, answerText(0, "first view unclear"));
    const firstRef = publishPartIdentificationAnswerCheckpoint(
      out,
      `answers-${PART_IDENTIFICATION_MODEL_ID}.json`,
      bundleFor([first]),
    );
    const second = await retainedProof(out, answerText(1, "second view resolves studs"));
    publishPartIdentificationAnswerCheckpoint(
      out,
      `answers-${PART_IDENTIFICATION_MODEL_ID}.json`,
      bundleFor([first, second], firstRef),
    );
    const artifact = readJsonArtifact(
      join(out, `answers-${PART_IDENTIFICATION_MODEL_ID}.json`),
      "test /5 answers",
    );
    const replay = boundAnswerCheckpoint(artifact, context(out));
    expect(replay.answers[1].pick).toBe(1);
    expect(Object.keys(replay.calls)).toHaveLength(2);
    expect(replay.attempts[1]).toHaveLength(2);
    expect(replay.checkpointReference.digest).toBe(artifact.digest);
  });

  it("refuses legacy /4, mixed fields, transplanted card bytes, and deleted ancestry", async () => {
    const out = root();
    const proof = await retainedProof(out, answerText(1, "exact card"));
    const reference = publishPartIdentificationAnswerCheckpoint(
      out,
      `answers-${PART_IDENTIFICATION_MODEL_ID}.json`,
      bundleFor([proof]),
    );
    const artifact = readJsonArtifact(
      join(out, `answers-${PART_IDENTIFICATION_MODEL_ID}.json`),
      "answers",
    );
    const legacy = Buffer.from(
      JSON.stringify({ ...artifact.value, schemaVersion: "lego.part-identification-answers/4" }),
    );
    expect(() => boundAnswerCheckpoint({ bytes: legacy }, context(out))).toThrow(/schemaVersion/u);
    const mixed = Buffer.from(JSON.stringify({ ...artifact.value, legacyAnswers: {} }));
    expect(() => boundAnswerCheckpoint({ bytes: mixed }, context(out))).toThrow(/legacy or mixed/u);
    expect(() =>
      boundAnswerCheckpoint(artifact, {
        ...context(out),
        cardImages: new Map([[cardId, Buffer.from(image).fill(9)]]),
      }),
    ).toThrow(/card\/model bindings/u);
    const malicious = bundleFor([proof], reference);
    expect(() =>
      publishPartIdentificationAnswerCheckpoint(out, "malicious.json", malicious),
    ).toThrow(/append exactly one call/u);
    expect(existsSync(join(out, "malicious.json"))).toBe(false);
  });

  it("refuses a future answer with no attempt in every retained ancestor", async () => {
    const out = root();
    const first = await retainedProof(out, answerText(1, "first answer"));
    const base = bundleFor([first]);
    const futureAnswer = first.parsed.answer;
    const forgedParent = { ...base, answers: { ...base.answers, 2: futureAnswer } };
    const parentBytes = callProofJsonBytes(forgedParent);
    const parentDigest = callProofSha256(parentBytes);
    const parentReference = {
      path: `answer-checkpoints/sha256/${parentDigest.slice("sha256:".length)}.json`,
      byteLength: parentBytes.length,
      digest: parentDigest,
    };
    publishImmutableContainedBytes(out, parentReference.path, parentBytes, {
      label: "Forged predecessor fixture",
      pathLabel: "Forged predecessor path",
      maxBytes: 32 * 1024 * 1024,
    });

    const futureCallDigest = sha256(Buffer.from("future-call"));
    const child = answerBundle({
      model: base.model,
      modelIdentity: base.modelIdentity,
      matchDigest: base.matchDigest,
      cardsDigest: base.cardsDigest,
      promptDigest: base.promptDigest,
      predecessor: parentReference,
      calls: {
        ...base.calls,
        [futureCallDigest]: {
          proof: {
            path: `call-proofs/sha256/${futureCallDigest.slice("sha256:".length)}.json`,
            byteLength: 1,
            digest: futureCallDigest,
          },
          orderedCardIds: ["card-0002"],
        },
      },
      attempts: {
        ...base.attempts,
        2: [
          {
            callDigest: futureCallDigest,
            cardId: "card-0002",
            answerDigest: answerRecordDigest(futureAnswer),
            outcome: "usable",
          },
        ],
      },
      answers: { ...base.answers, 2: futureAnswer },
    });
    expect(() => publishPartIdentificationAnswerCheckpoint(out, "refused.json", child)).toThrow(
      /not internally complete: attempt keys must exactly equal answer keys/u,
    );
    expect(existsSync(join(out, "refused.json"))).toBe(false);

    const childBytes = callProofJsonBytes(child);
    const childDigest = callProofSha256(childBytes);
    const childPath = `answer-checkpoints/sha256/${childDigest.slice("sha256:".length)}.json`;
    publishImmutableContainedBytes(out, childPath, childBytes, {
      label: "Forged child fixture",
      pathLabel: "Forged child path",
      maxBytes: 32 * 1024 * 1024,
    });
    writeFileSync(join(out, "forged.json"), childBytes);
    const forgedArtifact = readJsonArtifact(join(out, "forged.json"), "forged lineage");
    expect(() => boundAnswerCheckpoint(forgedArtifact, context(out))).toThrow(
      /immutable predecessor lineage refused: Answer checkpoint is not internally complete/u,
    );
  });

  it("reuses identical CAS bytes and refuses different preexisting bytes without mutation", () => {
    const out = root();
    const path = `call-proofs/sha256/${"c".repeat(64)}.json`;
    const first = Buffer.from("same bytes");
    publishImmutableContainedBytes(out, path, first, {
      label: "Test CAS",
      pathLabel: "Test CAS path",
      maxBytes: 1024,
    });
    expect(() =>
      publishImmutableContainedBytes(out, path, first, {
        label: "Test CAS",
        pathLabel: "Test CAS path",
        maxBytes: 1024,
      }),
    ).not.toThrow();
    expect(() =>
      publishImmutableContainedBytes(out, path, Buffer.from("different"), {
        label: "Test CAS",
        pathLabel: "Test CAS path",
        maxBytes: 1024,
      }),
    ).toThrow(/did not replace/u);
    expect(readFileSync(join(out, ...path.split("/"))).equals(first)).toBe(true);
    expect(existsSync(join(out, ...path.split("/")))).toBe(true);
  });

  it("requires exact object maps for calls, attempts, and answers", async () => {
    const out = root();
    const proof = await retainedProof(out, answerText(1, "shape"));
    const base = bundleFor([proof]);
    for (const field of ["calls", "attempts", "answers"]) {
      for (const invalid of [8, "x", [], null]) {
        const bytes = Buffer.from(JSON.stringify({ ...base, [field]: invalid }));
        expect(() => boundAnswerCheckpoint({ bytes }, context(out))).toThrow(
          /objects|legacy or mixed/u,
        );
      }
    }
    expect(base.schemaVersion).toBe(PART_ANSWERS_SCHEMA);
    expect(base.transportContractDigest).toBe(PART_IDENTIFICATION_TRANSPORT_CONTRACT_DIGEST);
  });

  it("rejects a proof-owned pick beyond the candidates displayed on its bound card", async () => {
    const out = root();
    const proof = await retainedProof(out, answerText(2, "not retained"));
    publishPartIdentificationAnswerCheckpoint(
      out,
      `answers-${PART_IDENTIFICATION_MODEL_ID}.json`,
      bundleFor([proof]),
    );
    const artifact = readJsonArtifact(
      join(out, `answers-${PART_IDENTIFICATION_MODEL_ID}.json`),
      "answers with an out-of-range pick",
    );
    expect(() => boundAnswerCheckpoint(artifact, context(out))).toThrow(/did not display/u);
  });
});
