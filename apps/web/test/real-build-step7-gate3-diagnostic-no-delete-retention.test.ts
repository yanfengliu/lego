import { createHash, randomUUID } from "node:crypto";
import { existsSync, readdirSync, statSync } from "node:fs";
import { resolve } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { removeContainedDirectoryTree } from "../e2e/contained-directory";
import {
  retainStep7Gate3DiagnosticOutput,
  retainStep7Gate3UnverifiedFailureEnvelope,
} from "../e2e/real-build-step7-gate3-diagnostic-output";

const sha256 = (value: Uint8Array | string): string =>
  `sha256:${createHash("sha256").update(value).digest("hex")}`;

const taskOwnedOutputRoots = new Set<string>();

function taskOwnedOutputRoot(): string {
  const relative = `output/gate3-diagnostic-no-delete-test-${randomUUID()}`;
  taskOwnedOutputRoots.add(relative);
  return relative;
}

function captureThrown(action: () => unknown): unknown {
  try {
    action();
    throw new Error("Expected the injected no-delete failure to throw.");
  } catch (error) {
    return error;
  }
}

function validRetentionInput(outputRoot: string) {
  const panelPngBytes = Buffer.from("panel");
  const traceBase = Object.freeze({
    schemaVersion: "test.trace/1",
    outputPanel: Object.freeze({
      file: "step-007-panel.png",
      bytes: panelPngBytes.length,
      digest: sha256(panelPngBytes),
    }),
  });
  return {
    outputRoot,
    trace: Object.freeze({
      ...traceBase,
      traceDigest: sha256(JSON.stringify(traceBase)),
    }),
    panelPngBytes,
    summary: { status: "complete" },
    __testHooks: {
      artifactWriteFailure: { file: "summary.json", stage: "after-open" as const },
    },
  };
}

afterEach(() => {
  for (const outputRoot of taskOwnedOutputRoots) {
    if (!existsSync(resolve(process.cwd(), outputRoot))) continue;
    removeContainedDirectoryTree(
      process.cwd(),
      outputRoot,
      "Gate-3 no-delete retention test cleanup",
    );
  }
  taskOwnedOutputRoots.clear();
});

describe("step-7 Gate-3 no-delete partial retention", () => {
  it("retains a direct final-name bundle file after an injected post-open failure", () => {
    const outputRoot = taskOwnedOutputRoot();

    const failure = captureThrown(() =>
      retainStep7Gate3DiagnosticOutput(validRetentionInput(outputRoot)),
    );

    expect((failure as Error).message).toMatch(/after exclusive open/u);
    const runs = resolve(process.cwd(), outputRoot, "runs");
    const staging = readdirSync(runs).find((name) => name.startsWith(".tmp-"));
    expect(staging).toBeDefined();
    const summaryPath = resolve(runs, staging!, "summary.json");
    expect(existsSync(summaryPath)).toBe(true);
    expect(statSync(summaryPath).size).toBe(0);
    expect(readdirSync(resolve(process.cwd(), outputRoot, "unverified"))).toHaveLength(1);
  });

  it("keeps a partial envelope under a unique name and never overwrites it", () => {
    const outputRoot = taskOwnedOutputRoot();
    const capturedAt = "2026-08-23T12:34:56.789Z";

    const failure = captureThrown(() =>
      retainStep7Gate3UnverifiedFailureEnvelope({
        outputRoot,
        stage: "execution",
        failure: new Error("primary failure"),
        counterevidence: null,
        capturedAt,
        __testWriteFailureStage: "after-open",
      }),
    );
    expect((failure as Error).message).toMatch(/after exclusive open/u);
    const directory = resolve(process.cwd(), outputRoot, "unverified");
    const partial = readdirSync(directory);
    expect(partial).toHaveLength(1);
    expect(statSync(resolve(directory, partial[0]!)).size).toBe(0);

    const retained = retainStep7Gate3UnverifiedFailureEnvelope({
      outputRoot,
      stage: "execution",
      failure: new Error("primary failure"),
      counterevidence: null,
      capturedAt,
    });
    expect(readdirSync(directory)).toHaveLength(2);
    expect(retained.fileRelative.endsWith(partial[0]!)).toBe(false);
    expect(statSync(resolve(process.cwd(), retained.fileRelative)).size).toBeGreaterThan(0);
    expect(statSync(resolve(directory, partial[0]!)).size).toBe(0);
  });
});
