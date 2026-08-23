import { createHash } from "node:crypto";
import { existsSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

import { describe, expect, it } from "vitest";

import { parsePartIdentificationAnswerLines } from "./part-identification-answer-lines.mjs";
import {
  answerRecordDigest,
  verifyPartIdentificationCallProof,
} from "./part-identification-call-proof.mjs";
import {
  parsePartIdentificationClaudeStream,
  runPartIdentificationClaudeTransport,
} from "./part-identification-claude-transport.mjs";
import { createPartIdentificationClaudeTransportForTest } from "./part-identification-claude-transport-test-only.mjs";
import * as supportedTransport from "./part-identification-claude-transport.mjs";
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
  PART_IDENTIFICATION_MAX_EVENTS,
  PART_IDENTIFICATION_MAX_STDOUT_BYTES,
  PART_IDENTIFICATION_MCP_SERVER,
} from "./part-identification-transport-contract.mjs";

const sha256 = (bytes) => `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
const cardIds = ["card-0001", "card-0002"];
const images = new Map([
  [cardIds[0], Buffer.from("89504e470d0a1a0a0102", "hex")],
  [cardIds[1], Buffer.from("89504e470d0a1a0a030405", "hex")],
]);
const digests = new Map([
  [cardIds[0], sha256(images.get(cardIds[0]))],
  [cardIds[1], sha256(images.get(cardIds[1]))],
]);
const cardsDigest = `sha256:${"a".repeat(64)}`;
const resultText = [
  `card-0001 ${JSON.stringify({
    kind: "brick",
    studsLong: 2,
    studsWide: 4,
    colour: "Red",
    pick: 1,
    alsoCouldBe: 0,
    differsFromPick: "nothing",
    confidence: 0.95,
  })}`,
  `card-0002 ${JSON.stringify({
    kind: "other",
    studsLong: 0,
    studsWide: 0,
    colour: "unknown",
    pick: 0,
    alsoCouldBe: 0,
    differsFromPick: "not-on-card",
    confidence: 0.1,
    note: "The outline is not shown among the numbered candidates.",
  })}`,
].join("\n");

function request() {
  return createPartIdentificationMcpRequest({
    cardIds,
    images,
    digests,
    model: PART_IDENTIFICATION_MODEL_ID,
    cardsDigest,
    promptDigest: PART_IDENTIFICATION_PROMPT_DIGEST,
    instructionBytes: partIdentificationInstructionBytes(cardIds),
  });
}

function stream(requestValue, cwd, overrides = {}) {
  const toolId = overrides.toolId ?? "toolu_01-bound";
  const terminalText = overrides.terminalText ?? resultText;
  const finalText = overrides.finalText ?? terminalText;
  const events = [
    {
      type: "system",
      subtype: "init",
      cwd: overrides.cwd ?? cwd,
      model: overrides.model ?? PART_IDENTIFICATION_MODEL_ID,
      permissionMode: overrides.permissionMode ?? "dontAsk",
      claude_code_version: overrides.version ?? PART_IDENTIFICATION_CLAUDE_CLI_VERSION,
      session_id: "must-not-enter-sanitized-proof",
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
            name: overrides.toolName ?? PART_IDENTIFICATION_CLAUDE_TOOL,
            input: overrides.toolInput ?? {},
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
            tool_use_id: overrides.resultToolId ?? toolId,
            is_error: false,
            content: overrides.content ?? partIdentificationEvidenceContent(requestValue),
          },
        ],
      },
    },
    {
      type: "assistant",
      message: { role: "assistant", content: [{ type: "text", text: finalText }] },
    },
    {
      type: "result",
      subtype: "success",
      is_error: false,
      result: terminalText,
      session_id: "also-must-not-enter-proof",
      modelUsage: {
        [PART_IDENTIFICATION_MODEL_ID]: { canonicalModel: "claude-opus-5", provider: "firstParty" },
      },
      usage: {
        input_tokens: 100,
        cache_creation_input_tokens: 20,
        cache_read_input_tokens: 30,
        output_tokens: 12,
      },
      total_cost_usd: 0.012345,
    },
  ];
  if (overrides.extraEvent) events.splice(4, 0, overrides.extraEvent);
  return `${events.map((event) => JSON.stringify(event)).join("\n")}\n`;
}

const input = () => ({
  cardIds,
  images,
  digests,
  model: PART_IDENTIFICATION_MODEL_ID,
  cardsDigest,
});

describe("strict part-identification Claude transport", () => {
  it("keeps the injectable runner outside the supported production surface", () => {
    expect(supportedTransport).not.toHaveProperty("createPartIdentificationClaudeTransportForTest");
  });

  it("refuses production before any preflight without an opaque Gate-0 admission", async () => {
    await expect(runPartIdentificationClaudeTransport(input())).rejects.toThrow(
      /admission capability is absent or foreign/u,
    );
  });

  it("uses only the one bound MCP image tool and retains exact sanitized proof replay", async () => {
    const observed = {};
    const transport = createPartIdentificationClaudeTransportForTest({
      environment: {
        PATH: "C:\\fake-bin",
        APPDATA: "C:\\auth-state",
        SystemRoot: "C:\\Windows",
        UNRELATED_SECRET: "must-not-cross",
      },
      async runChild(command, args, options) {
        observed.command = command;
        observed.args = args;
        observed.options = options;
        return {
          code: 0,
          signal: null,
          stdout: stream(request(), options.cwd),
          stderr: "",
        };
      },
    });
    const result = await transport(input());
    expect(observed.command).toBe("claude-test-double");
    expect(observed.args).toContain("--tools=");
    expect(observed.args).toContain("--strict-mcp-config");
    expect(observed.args).toContain("--setting-sources=");
    expect(observed.args).toContain("--no-session-persistence");
    expect(observed.args).toContain("--no-chrome");
    expect(observed.args).toContain("--safe-mode");
    expect(observed.args).not.toContain("Read");
    expect(observed.args).not.toContain("Bash");
    expect(observed.args).not.toContain("Edit");
    expect(Object.getPrototypeOf(observed.options.env)).toBeNull();
    expect(observed.options.env.UNRELATED_SECRET).toBeUndefined();
    expect(observed.options.env.PATH).toBeUndefined();
    expect(observed.options.env.CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC).toBe("1");
    expect(existsSync(observed.options.cwd)).toBe(false);
    expect(result.proof.rawStream.events).toHaveLength(5);
    expect(JSON.stringify(result.proof)).not.toContain("must-not-enter");
    const parsed = parsePartIdentificationAnswerLines(result.terminalResult, cardIds);
    expect(() =>
      verifyPartIdentificationCallProof({ ...result.proof, parsedAnswers: parsed.parsedAnswers }),
    ).not.toThrow();
    expect(result.proof.cliContract.binary).toEqual({
      byteLength: PART_IDENTIFICATION_CLAUDE_BINARY_BYTES,
      digest: PART_IDENTIFICATION_CLAUDE_BINARY_DIGEST,
      version: PART_IDENTIFICATION_CLAUDE_CLI_VERSION,
    });
    expect(result.modelIdentity).toEqual(PART_IDENTIFICATION_MODEL_IDENTITY);
  });

  it("rejects extra, nested, mismatched, or capability-contradicting stream events", () => {
    const bound = request();
    const cwd = "C:\\task-root";
    const cases = [
      {
        extraEvent: { type: "assistant", message: { content: [{ type: "text", text: "extra" }] } },
      },
      { finalText: `${resultText} changed` },
      { toolName: "Read" },
      { toolInput: [] },
      { resultToolId: "wrong" },
      { cwd: "C:\\ambient" },
      { model: "mutable-alias" },
      { permissionMode: "default" },
      { version: "2.1.231 (Claude Code)" },
    ];
    for (const overrides of cases) {
      expect(() =>
        parsePartIdentificationClaudeStream(Buffer.from(stream(bound, cwd, overrides)), bound, cwd),
      ).toThrow();
    }
  });

  it("refuses event 65 while incrementally scanning a near-24 MiB newline stream", () => {
    const tail = Buffer.from("{}\n".repeat(PART_IDENTIFICATION_MAX_EVENTS + 1));
    const raw = Buffer.alloc(PART_IDENTIFICATION_MAX_STDOUT_BYTES - 1, 0x0a);
    tail.copy(raw, raw.length - tail.length);
    expect(raw.length).toBe(PART_IDENTIFICATION_MAX_STDOUT_BYTES - 1);
    expect(() => parsePartIdentificationClaudeStream(raw, request(), "C:\\task-root")).toThrow(
      `more than ${PART_IDENTIFICATION_MAX_EVENTS} events`,
    );
  });

  it("rejects one successful stderr byte and cleans the task root", async () => {
    let cwd;
    const transport = createPartIdentificationClaudeTransportForTest({
      async runChild(_command, _args, options) {
        cwd = options.cwd;
        return { code: 0, signal: null, stdout: stream(request(), cwd), stderr: "x" };
      },
    });
    await expect(transport(input())).rejects.toThrow(/unexpected stderr bytes/u);
    expect(existsSync(cwd)).toBe(false);
  });

  it("refuses a stdout cap that cannot carry the exact base64 packet before child launch", async () => {
    const largeIds = Array.from(
      { length: 6 },
      (_, index) => `card-${String(index + 10).padStart(4, "0")}`,
    );
    const largeImages = new Map();
    const largeDigests = new Map();
    for (const id of largeIds) {
      const bytes = Buffer.alloc(900_000, 7);
      Buffer.from("89504e470d0a1a0a", "hex").copy(bytes);
      largeImages.set(id, bytes);
      largeDigests.set(id, sha256(bytes));
    }
    let launched = false;
    const transport = createPartIdentificationClaudeTransportForTest({
      maxStdoutBytes: 4 * 1024 * 1024,
      async runChild() {
        launched = true;
        throw new Error("must not launch");
      },
    });
    await expect(
      transport({
        cardIds: largeIds,
        images: largeImages,
        digests: largeDigests,
        model: PART_IDENTIFICATION_MODEL_ID,
        cardsDigest,
      }),
    ).rejects.toThrow(/needs at least/u);
    expect(launched).toBe(false);
  });

  it("reparses terminal answers and refuses self-consistent forged proof fields", async () => {
    const transport = createPartIdentificationClaudeTransportForTest({
      async runChild(_command, _args, options) {
        return { code: 0, signal: null, stdout: stream(request(), options.cwd), stderr: "" };
      },
    });
    const result = await transport(input());
    const parsed = parsePartIdentificationAnswerLines(result.terminalResult, cardIds).parsedAnswers;
    const base = { ...result.proof, parsedAnswers: parsed };
    const nullForged = structuredClone(base);
    nullForged.parsedAnswers[0] = {
      cardId: cardIds[0],
      outcome: "no-usable-reply",
      answer: null,
      answerDigest: answerRecordDigest(null),
    };
    expect(() => verifyPartIdentificationCallProof(nullForged)).toThrow(
      /replay from the exact terminal/u,
    );
    const swapped = structuredClone(base);
    swapped.parsedAnswers.reverse();
    expect(() => verifyPartIdentificationCallProof(swapped)).toThrow(/ordered card/u);
    const changedTerminal = structuredClone(base);
    changedTerminal.terminal.result = resultText.replace('"confidence":0.95', '"confidence":0.5');
    changedTerminal.terminal.resultDigest = sha256(Buffer.from(changedTerminal.terminal.result));
    changedTerminal.rawStream.events[3].textDigest = changedTerminal.terminal.resultDigest;
    changedTerminal.rawStream.events[3].byteLength = Buffer.byteLength(
      changedTerminal.terminal.result,
    );
    changedTerminal.rawStream.events[4].resultDigest = changedTerminal.terminal.resultDigest;
    expect(() => verifyPartIdentificationCallProof(changedTerminal)).toThrow();
    for (const invalidInput of [null, [], { garbage: true }]) {
      const wrongTool = structuredClone(base);
      wrongTool.tool.input = invalidInput;
      expect(() => verifyPartIdentificationCallProof(wrongTool)).toThrow(
        /empty-input allowed tool/u,
      );
    }
    const leakedEnvironment = structuredClone(base);
    leakedEnvironment.cliContract.environmentKeys.push("ZZZ_SECRET");
    expect(() => verifyPartIdentificationCallProof(leakedEnvironment)).toThrow(
      /provider allowlist/u,
    );
  });

  it("refuses a persistent child-created file and quarantines the exact task root", async () => {
    let cwd;
    let resolved = false;
    const transport = createPartIdentificationClaudeTransportForTest({
      async runChild(_command, _args, options) {
        cwd = options.cwd;
        writeFileSync(`${cwd}\\an3.py`, "hostile child write");
        return { code: 0, signal: null, stdout: stream(request(), cwd), stderr: "" };
      },
    });
    await transport(input()).then(
      () => {
        resolved = true;
      },
      (error) => expect(error.message).toMatch(/persistent child-created entry/u),
    );
    expect(resolved).toBe(false);
    expect(existsSync(cwd)).toBe(true);
    rmSync(cwd, { recursive: true, force: true });
    expect(existsSync(cwd)).toBe(false);
  });

  it("keeps captured structural boundaries closed under prototype poisoning", () => {
    const code = `
      import { assertPartIdentificationTransportContract } from ${JSON.stringify(new URL("./part-identification-transport-contract.mjs", import.meta.url).href)};
      import { isPinnedModelIdentity, PART_IDENTIFICATION_MODEL_IDENTITY } from ${JSON.stringify(new URL("./part-identification-model.mjs", import.meta.url).href)};
      import { createPartIdentificationMcpRequest, verifyPartIdentificationMcpRequest } from ${JSON.stringify(new URL("./part-identification-mcp-server.mjs", import.meta.url).href)};
      import { PART_CARDS_SCHEMA, assertCardsArtifact, deriveCardRunId, validAnswerRecord } from ${JSON.stringify(new URL("./part-identification-artifact-vision.mjs", import.meta.url).href)};
      import { partIdentificationInstructionBytes, PART_IDENTIFICATION_PROMPT_DIGEST } from ${JSON.stringify(new URL("./part-identification-instruction.mjs", import.meta.url).href)};
      import { parseStrictJsonBytes } from ${JSON.stringify(new URL("./part-identification-strict-json.mjs", import.meta.url).href)};
      import { canonicalPng } from ${JSON.stringify(new URL("./part-identification-test-fixture.mjs", import.meta.url).href)};
      import { syntheticPartIdentificationAnswerClosure } from ${JSON.stringify(new URL("./part-identification-synthetic-proof-fixture.mjs", import.meta.url).href)};
      import { boundAnswers, jsonArtifactFromBytes } from ${JSON.stringify(new URL("./part-identification-artifacts.mjs", import.meta.url).href)};
      import { createHash } from "node:crypto";
      const ids = ["card-0001", "card-0002"];
      const png = canonicalPng(2, 2, 7);
      const digest = "sha256:" + createHash("sha256").update(png).digest("hex");
      const request = createPartIdentificationMcpRequest({
        cardIds: ids,
        images: new Map(ids.map((id) => [id, png])),
        digests: new Map(ids.map((id) => [id, digest])),
        model: "claude-opus-5",
        cardsDigest: "sha256:" + "a".repeat(64),
        promptDigest: PART_IDENTIFICATION_PROMPT_DIGEST,
        instructionBytes: partIdentificationInstructionBytes(ids),
      });
      const duplicated = structuredClone(request);
      duplicated.cards[1].cardId = duplicated.cards[0].cardId;
      const core = {
        schemaVersion: duplicated.schemaVersion,
        model: duplicated.model,
        cardsDigest: duplicated.cardsDigest,
        promptDigest: duplicated.promptDigest,
        transportContractDigest: duplicated.transportContractDigest,
        instruction: duplicated.instruction,
        cards: duplicated.cards,
      };
      duplicated.requestDigest = "sha256:" + createHash("sha256").update(Buffer.from(JSON.stringify(core))).digest("hex");
      const cardsDigest = "sha256:" + "c".repeat(64);
      const matchDigest = "sha256:" + "d".repeat(64);
      const featuresDigest = "sha256:" + "e".repeat(64);
      const cardEntries = { "card-0001": { sha256: digest, candidateElementIds: ["3001"] } };
      const cardRunId = deriveCardRunId(featuresDigest, matchDigest, cardEntries);
      const cardsValue = {
        schemaVersion: PART_CARDS_SCHEMA,
        featuresDigest,
        matchDigest,
        runId: cardRunId,
        imagesFile: "runs/" + cardRunId + "/images.bin",
        cards: {
          "card-0001": {
            ...cardEntries["card-0001"],
            file: "runs/" + cardRunId + "/card-0001.png",
          },
        },
      };
      const cardsArtifact = jsonArtifactFromBytes(Buffer.from(JSON.stringify(cardsValue)));
      const forgedCardsArtifact = jsonArtifactFromBytes(
        Buffer.from(JSON.stringify({ ...cardsValue, session_id: "x" })),
      );
      const cardContext = {
        featuresDigest,
        matchDigest,
        clusters: [{ clusterIndex: 1, candidates: [{ elementId: "3001" }] }],
      };
      const answer = { kind: "brick", studsLong: 1, studsWide: 1, colour: "Red", pick: 1, alsoCouldBe: 0, differsFromPick: "nothing", confidence: 0.9 };
      const closure = syntheticPartIdentificationAnswerClosure({ cardId: "card-0001", image: png, cardsDigest, matchDigest, answer });
      const forgedValue = structuredClone(closure.answersArtifact.value);
      forgedValue.answers[1].session_id = "x";
      const forgedArtifact = jsonArtifactFromBytes(Buffer.from(JSON.stringify(forgedValue)));
      const forgedTrace = Object.assign(Object.create(null), closure.traceArtifacts);
      delete forgedTrace["answer-checkpoints/sha256/" + closure.answersArtifact.digest.slice(7) + ".json"];
      forgedTrace["answer-checkpoints/sha256/" + forgedArtifact.digest.slice(7) + ".json"] = forgedArtifact.bytes;
      const checkpointContext = {
        model: "claude-opus-5",
        matchDigest,
        cardsDigest,
        promptDigest: PART_IDENTIFICATION_PROMPT_DIGEST,
        clusters: [{ clusterIndex: 1 }],
        cards: { "card-0001": { sha256: digest, candidateElementIds: ["3001"] } },
        cardImages: new Map([["card-0001", png]]),
        traceArtifacts: closure.traceArtifacts,
      };
      Array.prototype.sort = () => [];
      Array.prototype.join = () => "";
      Array.prototype.some = () => false;
      Array.prototype.map = () => [];
      Array.prototype.includes = () => false;
      Array.prototype.find = () => undefined;
      Object.keys = () => [];
      Set.prototype.has = () => false;
      Set.prototype.add = function () { return this; };
      Map.prototype.has = () => false;
      Map.prototype.get = () => undefined;
      Map.prototype.set = function () { return this; };
      Map.prototype.delete = () => false;
      let rejected = 0;
      try { assertPartIdentificationTransportContract({ garbage: true }); } catch { rejected += 1; }
      if (!isPinnedModelIdentity({ ...PART_IDENTIFICATION_MODEL_IDENTITY, session_id: "x" }, "claude-opus-5")) rejected += 1;
      try { verifyPartIdentificationMcpRequest({ garbage: true }); } catch { rejected += 1; }
      if (!validAnswerRecord({ kind: "brick", studsLong: 1, studsWide: 1, colour: "Red", pick: 1, alsoCouldBe: 0, differsFromPick: "nothing", confidence: 0.9, session_id: "x" })) rejected += 1;
      try { verifyPartIdentificationMcpRequest(duplicated); } catch { rejected += 1; }
      try { parseStrictJsonBytes(Buffer.from('{"a":1,"a":2}')); } catch { rejected += 1; }
      if (assertCardsArtifact(cardsArtifact, cardContext).runId === cardRunId) rejected += 1;
      try { assertCardsArtifact(forgedCardsArtifact, cardContext); } catch { rejected += 1; }
      if (boundAnswers(closure.answersArtifact, checkpointContext)[1].pick === 1) rejected += 1;
      try { boundAnswers(forgedArtifact, { ...checkpointContext, traceArtifacts: forgedTrace }); } catch { rejected += 1; }
      if (rejected !== 10) process.exit(7);
    `;
    const child = spawnSync(process.execPath, ["--input-type=module", "-e", code], {
      encoding: "utf8",
      windowsHide: true,
    });
    expect(child.status, child.stderr).toBe(0);
  });

  it("rejects narrative prefixes and suffixes around an otherwise valid answer", () => {
    expect(() =>
      parsePartIdentificationAnswerLines(
        `evil words card-0001 ${resultText.split("\n")[0].slice("card-0001 ".length)}`,
        ["card-0001"],
      ),
    ).toThrow(/exactly one requested card id/u);
    expect(() =>
      parsePartIdentificationAnswerLines(`${resultText.split("\n")[0]} trailing`, ["card-0001"]),
    ).toThrow(/exactly one requested card id/u);
  });
});
