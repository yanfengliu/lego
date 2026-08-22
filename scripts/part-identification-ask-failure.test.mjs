import { randomUUID } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it, vi } from "vitest";

import {
  askBatch,
  claudeFailureStderrDiagnostic,
  claudeFailureStdoutDiagnostic,
  commandAsk,
  pendingAnswerClusterIndexes,
} from "./part-identification-ask.mjs";
import { runPartIdentificationCli } from "./part-identification.mjs";
import { PART_IDENTIFICATION_MODEL_ID } from "./part-identification-model.mjs";

const oauthFailure = {
  type: "result",
  subtype: "error_during_execution",
  is_error: true,
  api_error_status: 401,
  terminal_reason: "api_error",
  result:
    "Failed to authenticate. API Error: 401 OAuth access token has expired. Re-authenticate to continue.",
  session_id: "must-not-leave-the-child-boundary",
  prompt: "Read C:/private/lego-identification-call-secret/card-0000.png",
  model_output: "must-not-be-reported",
};

describe("part-identification Claude failure diagnostics", () => {
  it("retries null refusals and missing replies without reasking usable answers", () => {
    const clusters = [0, 1, 2].map((clusterIndex) => ({ clusterIndex }));
    const answers = {
      0: null,
      2: {
        kind: "brick",
        studsLong: 1,
        studsWide: 1,
        colour: "black",
        pick: 1,
        alsoCouldBe: 0,
        differsFromPick: "nothing",
        confidence: 0.9,
      },
    };

    expect(pendingAnswerClusterIndexes(clusters, answers)).toEqual([0, 1]);
    expect(pendingAnswerClusterIndexes(clusters, answers, { only: "0" })).toEqual([0]);
  });

  it("reports only bounded allowlisted fields from a JSON API-error envelope", () => {
    const diagnostic = claudeFailureStdoutDiagnostic(JSON.stringify(oauthFailure));
    expect(diagnostic).toContain("api_error_status=401");
    expect(diagnostic).toContain('terminal_reason="api_error"');
    expect(diagnostic).toContain("claude auth login --claudeai");
    expect(diagnostic).toContain("resultBytes=");
    expect(diagnostic).not.toContain("OAuth access token has expired");
    expect(diagnostic).not.toContain(oauthFailure.session_id);
    expect(diagnostic).not.toContain("card-0000");
    expect(diagnostic).not.toContain(oauthFailure.model_output);
  });

  it("omits non-JSON stdout and names only its exact byte count", () => {
    const stdout = "Read C:/private/lego-identification-call-secret/card-0000.png";
    expect(claudeFailureStdoutDiagnostic(stdout)).toBe(
      `non-JSON ${Buffer.byteLength(stdout)} UTF-8 bytes omitted`,
    );
  });

  it("omits arbitrary API-error result text even when it looks like one safe line", () => {
    const hostileResult =
      "credential=super-secret session_id=private prompt=booklet model_output=private";
    const diagnostic = claudeFailureStdoutDiagnostic(
      JSON.stringify({
        ...oauthFailure,
        result: hostileResult,
      }),
    );
    expect(diagnostic).toContain("resultBytes=");
    expect(diagnostic).not.toContain(hostileResult);
    expect(diagnostic).not.toContain("super-secret");
    expect(diagnostic).not.toContain("booklet");
  });

  it.each([
    [429, "wait for the provider or account limit to reset"],
    [500, "verify Claude CLI authentication and pinned-model access"],
  ])("maps API status %i to static remediation", (status, remediation) => {
    const diagnostic = claudeFailureStdoutDiagnostic(
      JSON.stringify({ ...oauthFailure, api_error_status: status }),
    );
    expect(diagnostic).toContain(remediation);
    expect(diagnostic).not.toContain("OAuth access token has expired");
  });

  it("omits an unknown terminal reason instead of trusting token-shaped text", () => {
    const reason = "session-secret-token";
    const diagnostic = claudeFailureStdoutDiagnostic(
      JSON.stringify({ ...oauthFailure, terminal_reason: reason }),
    );
    expect(diagnostic).toContain(`terminalReasonBytes=${Buffer.byteLength(reason)} omitted`);
    expect(diagnostic).not.toContain(reason);
  });

  it("bounds an allowlisted API-error result before it reaches the thrown message", () => {
    const diagnostic = claudeFailureStdoutDiagnostic(
      JSON.stringify({ ...oauthFailure, result: `API Error: 500 ${"x".repeat(2_000)}` }),
    );
    expect(diagnostic.length).toBeLessThan(512);
    expect(diagnostic).toContain("resultBytes=2015 omitted");
    expect(diagnostic).not.toContain("x".repeat(500));
  });

  it("never copies hostile stderr into a failure message", () => {
    const stderr = "credential=secret session_id=private card-0000 C:/private/input.png";
    expect(claudeFailureStderrDiagnostic(stderr)).toBe(
      `${Buffer.byteLength(stderr)} UTF-8 bytes omitted`,
    );
  });

  it("rejects the removed child hook before any provider launch", async () => {
    const spawnImpl = vi.fn();
    await expect(
      askBatch(["card-0000"], PART_IDENTIFICATION_MODEL_ID, "unused", { spawnImpl }),
    ).rejects.toThrow(/removed local-path provider hook/u);
    expect(spawnImpl).not.toHaveBeenCalled();
  });

  it("refuses valid pilot flags at authorization before artifacts, journal, or provider", async () => {
    const out = join(tmpdir(), `lego-disabled-part-id-${process.pid}-${randomUUID()}`);
    expect(existsSync(out)).toBe(false);
    await expect(
      commandAsk([
        "--out",
        out,
        "--jobs",
        "4",
        "--batch",
        "6",
        "--max-calls",
        "1",
        "--pilot",
        "true",
      ]),
    ).rejects.toThrow(/pilot is disabled.*Gate-0 record before any provider process may launch/u);
    expect(existsSync(out)).toBe(false);
  });

  it("refuses the re-ask CLI before reading answers, writing output, or reaching a provider", async () => {
    const out = mkdtempSync(join(tmpdir(), "lego-disabled-part-id-reask-"));
    const answers = join(out, `answers-${PART_IDENTIFICATION_MODEL_ID}.json`);
    const sentinel = "this malformed answer file must not be read\n";
    writeFileSync(answers, sentinel);
    try {
      await expect(
        runPartIdentificationCli([
          "reask",
          "--out",
          out,
          "--model",
          PART_IDENTIFICATION_MODEL_ID,
          "--max",
          "24",
        ]),
      ).rejects.toThrow(
        /re-ask is disabled before artifact reads, output writes, or provider work/u,
      );
      expect(readFileSync(answers, "utf8")).toBe(sentinel);
      expect(existsSync(join(out, `reasks-${PART_IDENTIFICATION_MODEL_ID}.json`))).toBe(false);
    } finally {
      rmSync(out, { recursive: true, force: true });
    }
  });
});
