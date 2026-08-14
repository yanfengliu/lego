import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";

import { describe, expect, it, vi } from "vitest";

import {
  askBatch,
  claudeFailureStderrDiagnostic,
  claudeFailureStdoutDiagnostic,
  pendingAnswerClusterIndexes,
} from "./part-identification-ask.mjs";
import { sha256Digest } from "./part-identification-artifacts.mjs";
import { PART_IDENTIFICATION_MODEL_ID } from "./part-identification-model.mjs";
import { canonicalPng } from "./part-identification-test-fixture.mjs";

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

  it("surfaces the safe stdout cause on a nonzero bounded vision call", async () => {
    const png = canonicalPng(2, 2, 7);
    const spawnImpl = vi.fn(() => {
      const child = new EventEmitter();
      child.stdout = new PassThrough();
      child.stderr = new PassThrough();
      child.kill = vi.fn(() => true);
      child.pid = 10_004;
      queueMicrotask(() => {
        child.stdout.end(JSON.stringify(oauthFailure));
        child.stderr.end("credential=secret session_id=private card-0000 C:/private/input.png");
        child.emit("close", 1, null);
      });
      return child;
    });
    let failure;
    try {
      await askBatch(["card-0000"], PART_IDENTIFICATION_MODEL_ID, "unused", {
        cardImages: new Map([["card-0000", png]]),
        cardDigests: new Map([["card-0000", sha256Digest(png)]]),
        spawnImpl,
      });
    } catch (error) {
      failure = error;
    }
    expect(failure).toBeInstanceOf(Error);
    expect(failure.message).toMatch(
      /exited 1; stderr: \d+ UTF-8 bytes omitted; stdout: JSON error \(stdoutBytes=\d+, api_error_status=401, terminal_reason="api_error", remediation="reauthenticate with \\"claude auth login --claudeai/u,
    );
    expect(failure.message).not.toContain("credential=secret");
    expect(failure.message).not.toContain("session_id=private");
    expect(failure.message).not.toContain("OAuth access token has expired");
    expect(spawnImpl).toHaveBeenCalledOnce();
  });
});
