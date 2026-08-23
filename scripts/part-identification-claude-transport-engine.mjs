import { createHash } from "node:crypto";
import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { TextDecoder } from "node:util";

import { runBoundedChild } from "./part-identification-io.mjs";
import { PartIdentificationClaudeTransportError } from "./part-identification-claude-error.mjs";
import { parsePartIdentificationClaudeStream } from "./part-identification-claude-stream.mjs";
import {
  assertPinnedClaudeVersionResult,
  auditPartIdentificationTaskRoot,
  boundedPartIdentificationEnvironment,
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
  partIdentificationMcpVerifiedRequestArtifact,
  partIdentificationEvidenceContent,
} from "./part-identification-mcp-server.mjs";
import { partIdentificationGate0CanonicalJsonBytes } from "./part-identification-gate0-json.mjs";
import { sameGate0Value } from "./part-identification-gate0-foundation.mjs";
import {
  assertPartIdentificationGate0AdmissionCapability,
  claimPartIdentificationGate0Launch,
  consumePartIdentificationGate0Admission,
  revalidatePartIdentificationGate0Launch,
  settlePartIdentificationGate0Launch,
} from "./part-identification-gate0-store.mjs";
import { estimatePartIdentificationProofReservation } from "./part-identification-proof-reservation.mjs";
import {
  PART_IDENTIFICATION_CLAUDE_TOOL,
  PART_IDENTIFICATION_CLAUDE_CLI_VERSION,
  PART_IDENTIFICATION_MAX_COST_MICROUSD,
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
const objectKeys = Object.keys;
const arraySort = Function.call.bind(Array.prototype.sort);
const monotonicNow = process.hrtime.bigint;
const hashPrototype = Object.getPrototypeOf(createHash("sha256"));
const hashUpdate = Function.call.bind(hashPrototype.update);
const hashDigest = Function.call.bind(hashPrototype.digest);
const sha256 = (bytes) => {
  const hash = createHash("sha256");
  hashUpdate(hash, bytes);
  return `sha256:${hashDigest(hash, "hex")}`;
};
const jsonBytes = (value) => partIdentificationGate0CanonicalJsonBytes(value);

function elapsedMilliseconds(startedAt) {
  const nanoseconds = monotonicNow() - startedAt;
  return Number((nanoseconds + 999_999n) / 1_000_000n);
}

function remainingMilliseconds(deadline, label) {
  const remaining = deadline - monotonicNow();
  const milliseconds = Number(remaining / 1_000_000n);
  if (!Number.isSafeInteger(milliseconds) || milliseconds < 1) {
    throw new PartIdentificationClaudeTransportError(
      `${label} exhausted the shared strict-Claude wall-time deadline before launch; no provider child was created.`,
    );
  }
  return milliseconds;
}

function assertExecutableReceipt(result, binary, label) {
  if (
    result?.executableEvidence?.byteLength !== binary.exactExecutablePin.byteLength ||
    result.executableEvidence.digest !== binary.exactExecutablePin.digest
  ) {
    throw new PartIdentificationClaudeTransportError(
      `${label} did not return the exact executable receipt bound by the Windows launcher; no output is trusted.`,
    );
  }
}

export { PartIdentificationClaudeTransportError, parsePartIdentificationClaudeStream };
export { estimatePartIdentificationProofReservation };

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
  const transportStartedAt = monotonicNow();
  const timeoutMs = runtime.timeoutMs ?? PART_IDENTIFICATION_MAX_WALL_TIME_MS;
  const maxStderrBytes = runtime.maxStderrBytes ?? PART_IDENTIFICATION_MAX_STDERR_BYTES;
  if (runtime.publishable) {
    assertPartIdentificationGate0AdmissionCapability(input.gate0Admission);
  }
  if (
    !Number.isSafeInteger(timeoutMs) ||
    timeoutMs < 1 ||
    timeoutMs > PART_IDENTIFICATION_MAX_WALL_TIME_MS ||
    !Number.isSafeInteger(maxStderrBytes) ||
    maxStderrBytes < 1 ||
    maxStderrBytes > PART_IDENTIFICATION_MAX_STDERR_BYTES
  ) {
    throw new PartIdentificationClaudeTransportError(
      `Strict Claude caller bounds require one total timeout of 1..${PART_IDENTIFICATION_MAX_WALL_TIME_MS} ms and stderr 1..${PART_IDENTIFICATION_MAX_STDERR_BYTES} bytes.`,
    );
  }
  const deadline = transportStartedAt + BigInt(timeoutMs) * 1_000_000n;
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
  let gate0Ticket = null;
  let gate0FailureCategory = "runtime-preflight";
  let expectedFiles = null;
  try {
    const requestBytes = partIdentificationMcpVerifiedRequestArtifact(request).bytes;
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
      gate0Ticket = consumePartIdentificationGate0Admission(input.gate0Admission);
      const claimed = claimPartIdentificationGate0Launch(gate0Ticket);
      if (!sameGate0Value(claimed.request, request)) {
        throw new PartIdentificationClaudeTransportError(
          "Gate-0 durable launch claim does not reproduce the exact constructed provider request; no provider child was created.",
        );
      }
      expectedFiles = [];
      auditPartIdentificationTaskRoot(root, identity, expectedFiles);
      const version = await runBoundedChild(binary.path, ["--version"], {
        label: "Pinned Claude CLI version probe",
        cwd: root,
        timeoutMs: Math.min(10_000, remainingMilliseconds(deadline, "Claude version probe")),
        maxStdoutBytes: 4 * 1024,
        maxStderrBytes: 4 * 1024,
        env,
        exactExecutablePin: binary.exactExecutablePin,
      });
      assertExecutableReceipt(version, binary, "Claude version probe");
      auditPartIdentificationTaskRoot(root, identity, expectedFiles);
      assertPinnedClaudeVersionResult(version);
      binaryEvidence = {
        byteLength: version.executableEvidence.byteLength,
        digest: version.executableEvidence.digest,
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
    writeFileSync(requestPath, requestBytes, { flag: "wx", mode: 0o600 });
    writeFileSync(configPath, configBytes, { flag: "wx", mode: 0o600 });
    expectedFiles = [
      { name: "mcp.json", bytes: configBytes },
      { name: "request.json", bytes: requestBytes },
    ];
    auditPartIdentificationTaskRoot(root, identity, expectedFiles);
    if (runtime.publishable) revalidatePartIdentificationGate0Launch(gate0Ticket);
    gate0FailureCategory = "provider-launch";
    const child = await runtime.runChild(binary.path, args, {
      label: `Strict MCP Claude part-identification call for ${request.cards.length} cards`,
      cwd: root,
      timeoutMs: remainingMilliseconds(deadline, "Strict MCP Claude provider call"),
      maxStdoutBytes,
      maxStderrBytes,
      env,
      ...(runtime.publishable ? { exactExecutablePin: binary.exactExecutablePin } : {}),
    });
    const elapsedMs = elapsedMilliseconds(transportStartedAt);
    gate0FailureCategory = "provider-terminal";
    if (runtime.publishable) assertExecutableReceipt(child, binary, "Claude provider call");
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
    gate0FailureCategory = "provider-stream";
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
      Object.defineProperty(output, "gate0Ticket", { value: gate0Ticket });
    }
  } catch (error) {
    failure = error instanceof Error ? error : new Error(String(error));
  }
  let cleanupFailure = null;
  try {
    (runtime.cleanup ?? cleanupPartIdentificationTaskRoot)(root, identity, expectedFiles ?? []);
    if (existsSync(root)) {
      throw new PartIdentificationClaudeTransportError(
        `Task-owned Claude root ${JSON.stringify(root)} still exists after cleanup returned.`,
      );
    }
  } catch (error) {
    cleanupFailure = error instanceof Error ? error : new Error(String(error));
    try {
      cleanupPartIdentificationTaskRoot(root, identity, expectedFiles ?? []);
    } catch (fallback) {
      cleanupFailure = new AggregateError([cleanupFailure, fallback]);
    }
  }
  if (failure !== null && cleanupFailure !== null) {
    reservationTicket.release();
    if (gate0Ticket !== null) {
      try {
        settlePartIdentificationGate0Launch(gate0Ticket, {
          status: "failure",
          evidence: gate0FailureCategory,
        });
      } catch (gate0Failure) {
        cleanupFailure = new AggregateError([cleanupFailure, gate0Failure]);
      }
    }
    throw new AggregateError(
      [failure, cleanupFailure],
      `Strict MCP Claude call failed and its exact task-root cleanup also failed. Primary: ${failure.message} Cleanup: ${cleanupFailure.message}`,
    );
  }
  if (failure !== null) {
    reservationTicket.release();
    if (gate0Ticket !== null) {
      try {
        settlePartIdentificationGate0Launch(gate0Ticket, {
          status: "failure",
          evidence: gate0FailureCategory,
        });
      } catch (gate0Failure) {
        throw new AggregateError(
          [failure, gate0Failure],
          "Claude transport and its Gate-0 failure settlement both failed.",
          { cause: gate0Failure },
        );
      }
    }
    throw failure;
  }
  if (cleanupFailure !== null) {
    reservationTicket.release();
    if (gate0Ticket !== null) {
      try {
        settlePartIdentificationGate0Launch(gate0Ticket, {
          status: "failure",
          evidence: "cleanup",
        });
      } catch (gate0Failure) {
        throw new AggregateError(
          [cleanupFailure, gate0Failure],
          "Claude task cleanup and its Gate-0 failure settlement both failed.",
          { cause: gate0Failure },
        );
      }
    }
    throw cleanupFailure;
  }
  return output;
}

export function runPartIdentificationClaudeTransport(input) {
  return runTransport(input, {
    publishable: true,
    runChild: runBoundedChild,
  });
}

/** Internal injected engine for adversarial tests; it cannot mint publishable proofs. */
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
