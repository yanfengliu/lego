import { createHash } from "node:crypto";
import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { TextDecoder } from "node:util";

import { runBoundedChild } from "./part-identification-io.mjs";
import { PartIdentificationClaudeTransportError } from "./part-identification-claude-error.mjs";
import { parsePartIdentificationClaudeStream } from "./part-identification-claude-stream.mjs";
import {
  assertClaudeBinaryStable,
  assertPinnedClaudeVersionResult,
  auditPartIdentificationTaskRoot,
  boundedPartIdentificationEnvironment,
  closeClaudeBinary,
  cleanupPartIdentificationTaskRoot,
  createPartIdentificationTaskRoot,
  providerPartIdentificationEnvironment,
  resolveClaudeBinary,
} from "./part-identification-claude-runtime.mjs";
import {
  partIdentificationInstructionBytes,
  PART_IDENTIFICATION_PROMPT_DIGEST,
} from "./part-identification-instruction.mjs";
import {
  createPartIdentificationMcpRequest,
  partIdentificationEvidenceContent,
  verifyPartIdentificationMcpRequest,
} from "./part-identification-mcp-server.mjs";
import {
  PART_IDENTIFICATION_CLAUDE_TOOL,
  PART_IDENTIFICATION_CLAUDE_CLI_VERSION,
  PART_IDENTIFICATION_MAX_COST_MICROUSD,
  PART_IDENTIFICATION_MAX_PROOF_BYTES,
  PART_IDENTIFICATION_MAX_RESULT_BYTES,
  PART_IDENTIFICATION_MAX_STDERR_BYTES,
  PART_IDENTIFICATION_MAX_STDOUT_BYTES,
  PART_IDENTIFICATION_MAX_WALL_TIME_MS,
  PART_IDENTIFICATION_MCP_SERVER,
  PART_IDENTIFICATION_SYSTEM_PROMPT,
  PART_IDENTIFICATION_TRANSPORT_CONTRACT,
  PART_IDENTIFICATION_TRANSPORT_CONTRACT_DIGEST,
} from "./part-identification-transport-contract.mjs";

const SERVER_PATH = fileURLToPath(new URL("./part-identification-mcp-server.mjs", import.meta.url));
const PRODUCTION_TRANSPORT = Symbol("production-part-identification-transport");
const PROOF_BUDGET = Symbol("part-identification-proof-budget");
const fatalUtf8 = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });
const stringify = JSON.stringify;
const objectKeys = Object.keys;
const arraySort = Function.call.bind(Array.prototype.sort);
const monotonicNow = process.hrtime.bigint;
const sha256 = (bytes) => `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
const jsonBytes = (value) => Buffer.from(stringify(value), "utf8");

export { PartIdentificationClaudeTransportError, parsePartIdentificationClaudeStream };
export function estimatePartIdentificationProofReservation(requestInput) {
  const request = verifyPartIdentificationMcpRequest(requestInput);
  const contentBytes = jsonBytes(partIdentificationEvidenceContent(request)).length;
  const reservation = contentBytes + PART_IDENTIFICATION_MAX_RESULT_BYTES + 256 * 1024;
  if (reservation > PART_IDENTIFICATION_MAX_PROOF_BYTES) {
    throw new PartIdentificationClaudeTransportError(
      `Exact card content reserves ${reservation} proof bytes above ${PART_IDENTIFICATION_MAX_PROOF_BYTES}; reduce the batch before provider launch.`,
    );
  }
  return reservation;
}

export function createPartIdentificationProofBudget(existingProofBytes = 0) {
  if (
    !Number.isSafeInteger(existingProofBytes) ||
    existingProofBytes < 0 ||
    existingProofBytes > PART_IDENTIFICATION_TRANSPORT_CONTRACT.maxAggregateProofBytes
  ) {
    throw new PartIdentificationClaudeTransportError(
      `Existing proof bytes must be 0..${PART_IDENTIFICATION_TRANSPORT_CONTRACT.maxAggregateProofBytes}; received ${JSON.stringify(existingProofBytes)}.`,
    );
  }
  let committed = existingProofBytes;
  let reserved = 0;
  return Object.freeze({
    [PROOF_BUDGET]: true,
    reserve(amount) {
      if (
        !Number.isSafeInteger(amount) ||
        amount < 1 ||
        committed + reserved + amount >
          PART_IDENTIFICATION_TRANSPORT_CONTRACT.maxAggregateProofBytes
      ) {
        throw new PartIdentificationClaudeTransportError(
          `Call-proof reservation ${amount} would move committed/reserved bytes ${committed}/${reserved} above ${PART_IDENTIFICATION_TRANSPORT_CONTRACT.maxAggregateProofBytes}; no provider call was launched.`,
        );
      }
      reserved += amount;
      let active = true;
      return Object.freeze({
        commit(actual) {
          if (!active || !Number.isSafeInteger(actual) || actual < 1 || actual > amount) {
            throw new PartIdentificationClaudeTransportError(
              `Call-proof charge ${actual} does not fit its active ${amount}-byte reservation.`,
            );
          }
          active = false;
          reserved -= amount;
          committed += actual;
        },
        release() {
          if (!active) return;
          active = false;
          reserved -= amount;
        },
      });
    },
  });
}

export function assertProductionPartIdentificationTransport(value) {
  if (value?.[PRODUCTION_TRANSPORT] !== true) {
    throw new PartIdentificationClaudeTransportError(
      "Only the non-injected native Claude transport can publish a retained /5 call proof.",
    );
  }
  return value;
}

function normalizedArgv(args, instructionDigest, configPath) {
  const held = [];
  for (let index = 0; index < args.length; index += 1) {
    if (index === 1) held.push(`<instruction:${instructionDigest}>`);
    else if (args[index] === configPath) held.push("<TASK_ROOT>/mcp.json");
    else held.push(args[index]);
  }
  return held;
}

async function runTransport(input, runtime) {
  const instructionBytes = partIdentificationInstructionBytes(input.cardIds);
  const request = createPartIdentificationMcpRequest({
    ...input,
    promptDigest: PART_IDENTIFICATION_PROMPT_DIGEST,
    instructionBytes,
  });
  const proofReservation = estimatePartIdentificationProofReservation(request);
  const minimumStdoutBytes =
    jsonBytes(partIdentificationEvidenceContent(request)).length +
    PART_IDENTIFICATION_MAX_RESULT_BYTES +
    64 * 1024;
  const maxStdoutBytes = runtime.maxStdoutBytes ?? PART_IDENTIFICATION_MAX_STDOUT_BYTES;
  if (
    !Number.isSafeInteger(maxStdoutBytes) ||
    maxStdoutBytes < minimumStdoutBytes ||
    maxStdoutBytes > PART_IDENTIFICATION_MAX_STDOUT_BYTES
  ) {
    throw new PartIdentificationClaudeTransportError(
      `Bound Claude stdout needs at least ${minimumStdoutBytes} bytes for this exact image packet and result, within hard maximum ${PART_IDENTIFICATION_MAX_STDOUT_BYTES}; received ${JSON.stringify(maxStdoutBytes)}.`,
    );
  }
  const reservationTicket = runtime.publishable
    ? (() => {
        if (input.proofBudget?.[PROOF_BUDGET] !== true) {
          throw new PartIdentificationClaudeTransportError(
            "Native transport requires one shared branded aggregate proof budget before provider launch.",
          );
        }
        return input.proofBudget.reserve(proofReservation);
      })()
    : { commit() {}, release() {} };
  let task;
  try {
    task = createPartIdentificationTaskRoot();
  } catch (cause) {
    reservationTicket.release();
    throw cause;
  }
  const { root, identity } = task;
  let failure = null;
  let output = null;
  let heldBinary = null;
  try {
    const requestBytes = jsonBytes(request);
    const requestPath = join(root, "request.json");
    const configPath = join(root, "mcp.json");
    const configBytes = jsonBytes({
      mcpServers: {
        [PART_IDENTIFICATION_MCP_SERVER]: {
          command: process.execPath,
          args: [SERVER_PATH, "--bundle", requestPath],
        },
      },
    });
    writeFileSync(requestPath, requestBytes, { flag: "wx", mode: 0o600 });
    writeFileSync(configPath, configBytes, { flag: "wx", mode: 0o600 });
    const expectedFiles = [
      { name: "mcp.json", bytes: configBytes },
      { name: "request.json", bytes: requestBytes },
    ];
    auditPartIdentificationTaskRoot(root, identity, expectedFiles);
    const resolverEnv = boundedPartIdentificationEnvironment(runtime.environment ?? process.env);
    const env = providerPartIdentificationEnvironment(resolverEnv);
    const args = [
      "-p",
      fatalUtf8.decode(instructionBytes),
      "--model",
      request.model,
      "--tools=",
      "--allowedTools",
      PART_IDENTIFICATION_CLAUDE_TOOL,
      "--permission-mode",
      "dontAsk",
      "--setting-sources=",
      "--disable-slash-commands",
      "--no-session-persistence",
      "--no-chrome",
      "--safe-mode",
      "--system-prompt",
      PART_IDENTIFICATION_SYSTEM_PROMPT,
      "--mcp-config",
      configPath,
      "--strict-mcp-config",
      "--output-format",
      "stream-json",
      "--verbose",
      "--max-turns",
      "2",
      "--max-budget-usd",
      (PART_IDENTIFICATION_MAX_COST_MICROUSD / 1_000_000).toFixed(6),
    ];
    let binary;
    let binaryEvidence;
    if (runtime.publishable) {
      binary = resolveClaudeBinary(resolverEnv);
      heldBinary = binary;
      assertClaudeBinaryStable(binary);
      const version = await runBoundedChild(binary.path, ["--version"], {
        label: "Pinned Claude CLI version probe",
        cwd: root,
        timeoutMs: 10_000,
        maxStdoutBytes: 4 * 1024,
        maxStderrBytes: 4 * 1024,
        env,
      });
      assertClaudeBinaryStable(binary);
      auditPartIdentificationTaskRoot(root, identity, expectedFiles);
      assertPinnedClaudeVersionResult(version);
      binaryEvidence = {
        ...binary.evidence,
        version: PART_IDENTIFICATION_CLAUDE_CLI_VERSION,
      };
    } else {
      binary = { path: runtime.command ?? "claude-test-double" };
      binaryEvidence = {
        byteLength: PART_IDENTIFICATION_TRANSPORT_CONTRACT.claudeBinaryByteLength,
        digest: PART_IDENTIFICATION_TRANSPORT_CONTRACT.claudeBinaryDigest,
        version: PART_IDENTIFICATION_CLAUDE_CLI_VERSION,
      };
    }
    const timeoutMs = runtime.timeoutMs ?? PART_IDENTIFICATION_MAX_WALL_TIME_MS;
    const maxStderrBytes = runtime.maxStderrBytes ?? PART_IDENTIFICATION_MAX_STDERR_BYTES;
    if (
      !Number.isSafeInteger(timeoutMs) ||
      timeoutMs < 1 ||
      timeoutMs > PART_IDENTIFICATION_MAX_WALL_TIME_MS ||
      !Number.isSafeInteger(maxStderrBytes) ||
      maxStderrBytes < 1 ||
      maxStderrBytes > PART_IDENTIFICATION_MAX_STDERR_BYTES
    ) {
      throw new PartIdentificationClaudeTransportError(
        `Strict Claude caller bounds require timeout 1..${PART_IDENTIFICATION_MAX_WALL_TIME_MS} ms and stderr 1..${PART_IDENTIFICATION_MAX_STDERR_BYTES} bytes.`,
      );
    }
    const startedAt = monotonicNow();
    const child = await runtime.runChild(binary.path, args, {
      label: `Strict MCP Claude part-identification call for ${request.cards.length} cards`,
      cwd: root,
      timeoutMs,
      maxStdoutBytes,
      maxStderrBytes,
      env,
    });
    const elapsedNanoseconds = monotonicNow() - startedAt;
    const elapsedMs = Number((elapsedNanoseconds + 999_999n) / 1_000_000n);
    if (runtime.publishable) assertClaudeBinaryStable(binary);
    auditPartIdentificationTaskRoot(root, identity, expectedFiles);
    if (child.code !== 0) {
      throw new PartIdentificationClaudeTransportError(
        `Strict MCP Claude call exited ${child.code}${child.signal == null ? "" : ` (${child.signal})`}; stdoutBytes=${Buffer.byteLength(child.stdout)} omitted; stderrBytes=${Buffer.byteLength(child.stderr)} omitted. No answer or proof was retained.`,
      );
    }
    if (child.stderr.length !== 0) {
      throw new PartIdentificationClaudeTransportError(
        `Strict MCP Claude call succeeded with ${Buffer.byteLength(child.stderr)} unexpected stderr bytes; contents omitted and no proof was retained.`,
      );
    }
    const parsed = parsePartIdentificationClaudeStream(
      Buffer.from(child.stdout, "utf8"),
      request,
      root,
    );
    parsed.proof.terminal.elapsedMs = elapsedMs;
    const environmentKeys = objectKeys(env);
    arraySort(environmentKeys);
    output = {
      ...parsed,
      request,
      proofReservation,
      reservationTicket,
      proof: {
        ...parsed.proof,
        transportContractDigest: PART_IDENTIFICATION_TRANSPORT_CONTRACT_DIGEST,
        cliContract: {
          ...PART_IDENTIFICATION_TRANSPORT_CONTRACT,
          environmentKeys,
          binary: binaryEvidence,
          argv: normalizedArgv(args, request.instruction.digest, configPath),
        },
      },
    };
    output.proof.cliContract.argvDigest = sha256(jsonBytes(output.proof.cliContract.argv));
    if (runtime.publishable) {
      Object.defineProperty(output, PRODUCTION_TRANSPORT, { value: true });
    }
  } catch (error) {
    failure = error instanceof Error ? error : new Error(String(error));
  }
  if (heldBinary !== null) {
    let binaryFailure = null;
    try {
      assertClaudeBinaryStable(heldBinary);
    } catch (error) {
      binaryFailure = error instanceof Error ? error : new Error(String(error));
    }
    try {
      closeClaudeBinary(heldBinary);
    } catch (error) {
      const closeFailure = error instanceof Error ? error : new Error(String(error));
      binaryFailure =
        binaryFailure === null
          ? closeFailure
          : new AggregateError(
              [binaryFailure, closeFailure],
              "Claude binary identity and close both failed.",
            );
    }
    if (binaryFailure !== null) {
      failure =
        failure === null
          ? binaryFailure
          : new AggregateError(
              [failure, binaryFailure],
              `Strict Claude transport failed and its held binary identity/handle did not close cleanly. Primary: ${failure.message} Binary: ${binaryFailure.message}`,
            );
    }
  }
  let cleanupFailure = null;
  try {
    (runtime.cleanup ?? cleanupPartIdentificationTaskRoot)(root, identity);
    if (existsSync(root)) {
      throw new PartIdentificationClaudeTransportError(
        `Task-owned Claude root ${JSON.stringify(root)} still exists after cleanup returned.`,
      );
    }
  } catch (error) {
    cleanupFailure = error instanceof Error ? error : new Error(String(error));
    try {
      cleanupPartIdentificationTaskRoot(root, identity);
    } catch (fallback) {
      cleanupFailure = new AggregateError([cleanupFailure, fallback]);
    }
  }
  if (failure !== null && cleanupFailure !== null) {
    reservationTicket.release();
    throw new AggregateError(
      [failure, cleanupFailure],
      `Strict MCP Claude call failed and its exact task-root cleanup also failed. Primary: ${failure.message} Cleanup: ${cleanupFailure.message}`,
    );
  }
  if (failure !== null) {
    reservationTicket.release();
    throw failure;
  }
  if (cleanupFailure !== null) {
    reservationTicket.release();
    throw cleanupFailure;
  }
  return output;
}

export function runPartIdentificationClaudeTransport(input) {
  void input;
  throw new PartIdentificationClaudeTransportError(
    "Production part-identification provider execution is disabled: no reviewed card-digest-bound provider policy/privacy authorization and immutable launch-settlement lineage exists yet. The test transport remains nonpublishable.",
  );
}

/** Injected transports are useful only for adversarial tests and cannot mint publishable proofs. */
export function createPartIdentificationClaudeTransportForTest(options = {}) {
  return (input) =>
    runTransport(input, {
      publishable: false,
      runChild: options.runChild,
      command: options.command,
      environment: options.environment,
      cleanup: options.cleanup,
      timeoutMs: options.timeoutMs,
      maxStdoutBytes: options.maxStdoutBytes,
      maxStderrBytes: options.maxStderrBytes,
    });
}
