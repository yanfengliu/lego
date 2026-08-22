import { createHash } from "node:crypto";

import { answerBundle } from "./part-identification-answer-checkpoint.mjs";
import { parsePartIdentificationAnswerLines } from "./part-identification-answer-lines.mjs";
import { jsonArtifactFromBytes } from "./part-identification-artifacts.mjs";
import { expectedPartIdentificationCliArgv } from "./part-identification-call-proof-contract.mjs";
import { callProofJsonBytes, callProofSha256 } from "./part-identification-call-proof-digest.mjs";
import { verifyPartIdentificationCallProof } from "./part-identification-call-proof.mjs";
import { parsePartIdentificationClaudeStream } from "./part-identification-claude-stream.mjs";
import {
  partIdentificationInstructionBytes,
  PART_IDENTIFICATION_PROMPT_DIGEST,
} from "./part-identification-instruction.mjs";
import {
  createPartIdentificationMcpRequest,
  partIdentificationEvidenceContent,
} from "./part-identification-mcp-server.mjs";
import {
  PART_IDENTIFICATION_MODEL_ID,
  PART_IDENTIFICATION_MODEL_IDENTITY,
} from "./part-identification-model.mjs";
import {
  PART_IDENTIFICATION_CLAUDE_BINARY_BYTES,
  PART_IDENTIFICATION_CLAUDE_BINARY_DIGEST,
  PART_IDENTIFICATION_CLAUDE_CLI_VERSION,
  PART_IDENTIFICATION_CLAUDE_TOOL,
  PART_IDENTIFICATION_MCP_SERVER,
  PART_IDENTIFICATION_PROVIDER_ENV_ALLOWLIST,
  PART_IDENTIFICATION_TRANSPORT_CONTRACT,
  PART_IDENTIFICATION_TRANSPORT_CONTRACT_DIGEST,
} from "./part-identification-transport-contract.mjs";

const sha256 = (bytes) => `sha256:${createHash("sha256").update(bytes).digest("hex")}`;

function stream(request, taskRoot, result) {
  const toolId = "toolu_synthetic_fixture";
  const events = [
    {
      type: "system",
      subtype: "init",
      cwd: taskRoot,
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
          {
            type: "tool_use",
            id: toolId,
            name: PART_IDENTIFICATION_CLAUDE_TOOL,
            input: {},
          },
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
            content: partIdentificationEvidenceContent(request),
          },
        ],
      },
    },
    {
      type: "assistant",
      message: { role: "assistant", content: [{ type: "text", text: result }] },
    },
    {
      type: "result",
      subtype: "success",
      is_error: false,
      result,
      modelUsage: {
        [PART_IDENTIFICATION_MODEL_ID]: {
          canonicalModel: PART_IDENTIFICATION_MODEL_IDENTITY.canonicalModel,
          provider: PART_IDENTIFICATION_MODEL_IDENTITY.provider,
        },
      },
      usage: {
        input_tokens: 10,
        cache_creation_input_tokens: 2,
        cache_read_input_tokens: 3,
        output_tokens: 4,
      },
      total_cost_usd: 0.01,
    },
  ];
  return Buffer.from(`${events.map((event) => JSON.stringify(event)).join("\n")}\n`);
}

/** Build replay-consistent local test evidence. It is synthetic, not provider-authenticated. */
export function syntheticPartIdentificationAnswerClosure({
  cardId,
  image,
  cardsDigest,
  matchDigest,
  answer,
}) {
  const instructionBytes = partIdentificationInstructionBytes([cardId]);
  const imageDigest = sha256(image);
  const request = createPartIdentificationMcpRequest({
    cardIds: [cardId],
    images: new Map([[cardId, image]]),
    digests: new Map([[cardId, imageDigest]]),
    model: PART_IDENTIFICATION_MODEL_ID,
    cardsDigest,
    promptDigest: PART_IDENTIFICATION_PROMPT_DIGEST,
    instructionBytes,
  });
  const result = `${cardId} ${JSON.stringify(answer)}`;
  const taskRoot = "synthetic-fixture-task-root";
  const parsedStream = parsePartIdentificationClaudeStream(
    stream(request, taskRoot, result),
    request,
    taskRoot,
  );
  parsedStream.proof.terminal.elapsedMs = 1;
  const environmentKeys = [...PART_IDENTIFICATION_PROVIDER_ENV_ALLOWLIST].sort();
  const argv = expectedPartIdentificationCliArgv(parsedStream.proof.request);
  const parsedAnswers = parsePartIdentificationAnswerLines(result, [cardId]).parsedAnswers;
  const proof = verifyPartIdentificationCallProof({
    ...parsedStream.proof,
    transportContractDigest: PART_IDENTIFICATION_TRANSPORT_CONTRACT_DIGEST,
    cliContract: {
      ...PART_IDENTIFICATION_TRANSPORT_CONTRACT,
      environmentKeys,
      binary: {
        version: PART_IDENTIFICATION_CLAUDE_CLI_VERSION,
        byteLength: PART_IDENTIFICATION_CLAUDE_BINARY_BYTES,
        digest: PART_IDENTIFICATION_CLAUDE_BINARY_DIGEST,
      },
      argv,
      argvDigest: sha256(callProofJsonBytes(argv)),
    },
    parsedAnswers,
  });
  const proofBytes = callProofJsonBytes(proof);
  const proofDigest = callProofSha256(proofBytes);
  const proofPath = `call-proofs/sha256/${proofDigest.slice("sha256:".length)}.json`;
  const clusterKey = String(Number(cardId.slice("card-".length)));
  const bundle = answerBundle({
    model: PART_IDENTIFICATION_MODEL_ID,
    modelIdentity: PART_IDENTIFICATION_MODEL_IDENTITY,
    matchDigest,
    cardsDigest,
    promptDigest: PART_IDENTIFICATION_PROMPT_DIGEST,
    predecessor: null,
    calls: {
      [proofDigest]: {
        proof: { path: proofPath, byteLength: proofBytes.length, digest: proofDigest },
        orderedCardIds: [cardId],
      },
    },
    attempts: {
      [clusterKey]: [
        {
          callDigest: proofDigest,
          cardId,
          answerDigest: parsedAnswers[0].answerDigest,
          outcome: parsedAnswers[0].outcome,
        },
      ],
    },
    answers: { [clusterKey]: answer },
  });
  const answerBytes = callProofJsonBytes(bundle);
  const answersArtifact = jsonArtifactFromBytes(answerBytes, "synthetic /5 answers fixture");
  const checkpointPath = `answer-checkpoints/sha256/${answersArtifact.digest.slice("sha256:".length)}.json`;
  const traceArtifacts = Object.create(null);
  traceArtifacts[proofPath] = proofBytes;
  traceArtifacts[checkpointPath] = answerBytes;
  return { answersArtifact, traceArtifacts };
}
