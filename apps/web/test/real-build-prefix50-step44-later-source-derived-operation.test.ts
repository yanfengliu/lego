import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  createContainedDirectoryExclusive,
  removeContainedDirectoryTree,
} from "../e2e/contained-directory.ts";
import {
  executeRealBuildPrefix50Step44LaterSourceDerivedOperation,
  physicalPageForRealBuildPrefix50Step44LaterSourceDerivedOperation,
  prepareRealBuildPrefix50Step44LaterSourceDerivedOperation,
  summarizeRealBuildPrefix50Step44LaterSourceDerivedOperation,
} from "../e2e/real-build-prefix50-step44-later-source-derived-operation.ts";
import { REAL_BUILD_PREFIX50_STEP44_POPPLER_TOOLCHAIN_COMMITMENT } from "../e2e/real-build-prefix50-subbuild-return-review-poppler-toolchain.ts";
import { createStep44SourceFreeTestPdfBytes } from "./real-build-prefix50-subbuild-return-review-test-pdf.ts";

const testOnWindows = process.platform === "win32" ? it : it.skip;
const SOURCE_BINDING = `sha256:${"1".repeat(64)}` as const;
const DERIVED_OUTPUT_ROOT = join(
  process.cwd(),
  "output",
  "playwright",
  "real-build-prefix50-step44-later-source-derived",
);

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

async function waitForCrashControlReady(child: ReturnType<typeof spawn>): Promise<void> {
  let stderr = "";
  child.stderr?.setEncoding("utf8");
  child.stderr?.on("data", (chunk: string) => {
    if (stderr.length < 4_096) stderr += chunk;
  });
  await new Promise<void>((resolveReady, rejectReady) => {
    let stdout = "";
    const timeout = setTimeout(
      () => rejectReady(new Error(`Derived-scope crash child timed out: ${stderr}`)),
      15_000,
    );
    const finish = (action: () => void): void => {
      clearTimeout(timeout);
      child.stdout?.removeListener("data", onData);
      child.removeListener("exit", onExit);
      action();
    };
    const onData = (chunk: Buffer): void => {
      stdout += chunk.toString("utf8");
      const newline = stdout.indexOf("\n");
      if (newline < 0) return;
      try {
        expect(JSON.parse(stdout.slice(0, newline))).toEqual({ ready: true });
        finish(resolveReady);
      } catch (error) {
        finish(() => rejectReady(error));
      }
    };
    const onExit = (code: number | null): void =>
      finish(() =>
        rejectReady(
          new Error(`Derived-scope crash child exited ${String(code)} before ready: ${stderr}`),
        ),
      );
    child.stdout?.on("data", onData);
    child.once("exit", onExit);
  });
}

describe("fixed later-source derived operation", () => {
  it("maps only the closed purpose union to its implicit physical page", () => {
    const page44 = prepareRealBuildPrefix50Step44LaterSourceDerivedOperation({
      repositoryRoot: process.cwd(),
      request: {
        kind: "panel-prefix",
        purpose: "page44-step43-vector",
      },
    });
    expect(physicalPageForRealBuildPrefix50Step44LaterSourceDerivedOperation(page44)).toBe(44);
    const page45 = prepareRealBuildPrefix50Step44LaterSourceDerivedOperation({
      repositoryRoot: process.cwd(),
      request: {
        kind: "raster-page",
        purpose: "page45-camera-raster",
        densityDpi: 180,
        retainDecodedBytes: false,
      },
    });
    expect(physicalPageForRealBuildPrefix50Step44LaterSourceDerivedOperation(page45)).toBe(45);
    const malformed = prepareRealBuildPrefix50Step44LaterSourceDerivedOperation({
      repositoryRoot: process.cwd(),
      request: {
        kind: "panel-prefix",
        purpose: "page45-step44-vector",
        repositoryRoot: ".",
      },
    });
    expect(() =>
      physicalPageForRealBuildPrefix50Step44LaterSourceDerivedOperation(malformed),
    ).toThrow(/must contain only/u);
  });

  it("binds the exact request and opaque output scope before execution", () => {
    const first = prepareRealBuildPrefix50Step44LaterSourceDerivedOperation({
      repositoryRoot: process.cwd(),
      request: {
        kind: "raster-page",
        purpose: "page45-camera-raster",
        densityDpi: 180,
        retainDecodedBytes: false,
      },
    });
    const changed = prepareRealBuildPrefix50Step44LaterSourceDerivedOperation({
      repositoryRoot: process.cwd(),
      request: {
        kind: "raster-page",
        purpose: "page45-camera-raster",
        densityDpi: 181,
        retainDecodedBytes: true,
      },
    });
    expect(first.requestCommitment).not.toBe(changed.requestCommitment);
    expect(first.outputScopeCommitment).not.toBe(changed.outputScopeCommitment);
    expect(first.commitment).not.toBe(changed.commitment);
    expect(Object.keys(first).sort()).toEqual([
      "commitment",
      "outputScopeCommitment",
      "requestCommitment",
      "schemaVersion",
    ]);
  });

  it("snapshots bounded own data without invoking accessors or rereading the request", () => {
    const mutable: {
      kind: "panel-prefix";
      purpose: "page44-step43-vector" | "page45-step44-vector";
    } = { kind: "panel-prefix", purpose: "page44-step43-vector" };
    const stable = prepareRealBuildPrefix50Step44LaterSourceDerivedOperation({
      repositoryRoot: process.cwd(),
      request: mutable,
    });
    mutable.purpose = "page45-step44-vector";
    expect(physicalPageForRealBuildPrefix50Step44LaterSourceDerivedOperation(stable)).toBe(44);

    let getterInvocations = 0;
    const accessor = {
      kind: "panel-prefix",
      get purpose() {
        getterInvocations += 1;
        return "page44-step43-vector";
      },
    };
    const malformedAccessor = prepareRealBuildPrefix50Step44LaterSourceDerivedOperation({
      repositoryRoot: process.cwd(),
      request: accessor,
    });
    expect(getterInvocations).toBe(0);
    expect(() =>
      physicalPageForRealBuildPrefix50Step44LaterSourceDerivedOperation(malformedAccessor),
    ).toThrow(/closed operation request/u);
    expect(getterInvocations).toBe(0);

    const prototypeKey = Object.create(null) as Record<string, unknown>;
    Object.defineProperties(prototypeKey, {
      kind: { value: "panel-prefix", enumerable: true },
      purpose: { value: "page44-step43-vector", enumerable: true },
    });
    Object.defineProperty(prototypeKey, "__proto__", {
      value: "forbidden",
      enumerable: true,
    });
    const malformedPrototypeKey = prepareRealBuildPrefix50Step44LaterSourceDerivedOperation({
      repositoryRoot: process.cwd(),
      request: prototypeKey,
    });
    expect(() =>
      physicalPageForRealBuildPrefix50Step44LaterSourceDerivedOperation(malformedPrototypeKey),
    ).toThrow(/must contain only/u);
  });

  testOnWindows(
    "retains one exact marker-owned ignored scope after a real child crash",
    async () => {
      const repositoryRoot = process.cwd();
      const prepared = prepareRealBuildPrefix50Step44LaterSourceDerivedOperation({
        repositoryRoot,
        request: {
          kind: "raster-page",
          purpose: "page45-camera-raster",
          densityDpi: 180,
          retainDecodedBytes: false,
        },
      });
      const outputCandidate = [
        "output",
        "playwright",
        "real-build-prefix50-step44-later-source-derived",
        `scope-${prepared.outputScopeCommitment.slice(7)}`,
      ].join("/");
      const exactOutputScope = resolve(repositoryRoot, outputCandidate);
      const child = spawn(
        process.execPath,
        [
          "--experimental-strip-types",
          resolve(
            "apps/web/test/real-build-prefix50-step44-later-source-derived-scope-process.mjs",
          ),
          repositoryRoot,
          outputCandidate,
        ],
        {
          cwd: repositoryRoot,
          windowsHide: true,
          stdio: ["ignore", "pipe", "pipe"],
          env: {
            SystemRoot: process.env.SystemRoot ?? "C:\\Windows",
            WINDIR: process.env.WINDIR ?? "C:\\Windows",
          },
        },
      );
      let exited = false;
      child.once("exit", () => {
        exited = true;
      });
      try {
        await waitForCrashControlReady(child);
        const exit = new Promise<void>((resolveExit) => child.once("exit", () => resolveExit()));
        expect(child.kill()).toBe(true);
        await exit;
        const names = readdirSync(exactOutputScope);
        expect(names).toContain(".lego-contained-owner");
        expect(names.some((name) => name.startsWith(".lego-contained-live-guard-"))).toBe(true);
        expect(() =>
          createContainedDirectoryExclusive(
            repositoryRoot,
            outputCandidate,
            "Step-44 crash-control same-scope reuse",
          ),
        ).toThrow(/already exists/u);
        removeContainedDirectoryTree(
          repositoryRoot,
          outputCandidate,
          "Step-44 crash-control exact post-mortem cleanup",
        );
        expect(existsSync(exactOutputScope)).toBe(false);
      } finally {
        if (!exited) {
          const exit = new Promise<void>((resolveExit) => child.once("exit", () => resolveExit()));
          child.kill();
          await exit;
        }
        if (existsSync(exactOutputScope))
          removeContainedDirectoryTree(
            repositoryRoot,
            outputCandidate,
            "Step-44 crash-control exact finally cleanup",
          );
      }
    },
    30_000,
  );

  testOnWindows("returns only bounded derived raster bytes and a live summary", async () => {
    const sourceBytes = createStep44SourceFreeTestPdfBytes([0.16, 0.48, 0.95]);
    const sourceDigest = sha256(sourceBytes);
    const prepared = prepareRealBuildPrefix50Step44LaterSourceDerivedOperation({
      repositoryRoot: process.cwd(),
      request: {
        kind: "raster-page",
        purpose: "page45-camera-raster",
        densityDpi: 180,
        retainDecodedBytes: true,
      },
    });
    const exactOutputScope = join(
      DERIVED_OUTPUT_ROOT,
      `scope-${prepared.outputScopeCommitment.slice(7)}`,
    );
    try {
      const result = await executeRealBuildPrefix50Step44LaterSourceDerivedOperation({
        sourceBytes,
        prepared,
      });
      expect(result).toMatchObject({
        kind: "raster-page",
        purpose: "page45-camera-raster",
        physicalPageNumber: 45,
        densityDpi: 180,
        retainDecodedBytes: true,
        popplerToolchainCommitment: REAL_BUILD_PREFIX50_STEP44_POPPLER_TOOLCHAIN_COMMITMENT,
      });
      if (result.kind !== "raster-page" || !result.retainDecodedBytes)
        throw new Error("fixed derived operation returned the wrong test result kind");
      expect(result.width).toBeGreaterThan(0);
      expect(result.height).toBeGreaterThan(0);
      expect(result.pngBytes.byteLength).toBeGreaterThan(0);
      expect(result.rgba.byteLength).toBe(result.width * result.height * 4);
      expect(result.derivedCommitment).toMatch(/^sha256:[0-9a-f]{64}$/u);
      expect(
        summarizeRealBuildPrefix50Step44LaterSourceDerivedOperation({
          sourceByteLength: sourceBytes.byteLength,
          sourceBindingCommitment: SOURCE_BINDING,
          result,
        }),
      ).toEqual({
        sourceByteLength: sourceBytes.byteLength,
        sourceBindingCommitment: SOURCE_BINDING,
        derivedCommitment: result.derivedCommitment,
      });
      expect(() =>
        summarizeRealBuildPrefix50Step44LaterSourceDerivedOperation({
          sourceByteLength: sourceBytes.byteLength,
          sourceBindingCommitment: SOURCE_BINDING,
          result: Object.freeze({ ...result }) as never,
        }),
      ).toThrow(/exact live result/u);
      expect(sha256(sourceBytes)).toBe(sourceDigest);
      expect(existsSync(exactOutputScope)).toBe(false);
      await expect(
        executeRealBuildPrefix50Step44LaterSourceDerivedOperation({ sourceBytes, prepared }),
      ).rejects.toThrow(/exactly one execution attempt/u);
    } finally {
      sourceBytes.fill(0);
    }
  });

  it("rejects an unrostered request before invoking either parser family", async () => {
    const sourceBytes = createStep44SourceFreeTestPdfBytes([0.1, 0.2, 0.3]);
    const prepared = prepareRealBuildPrefix50Step44LaterSourceDerivedOperation({
      repositoryRoot: process.cwd(),
      request: {
        kind: "raster-page",
        purpose: "page45-camera-raster",
        densityDpi: 180,
        retainDecodedBytes: false,
        sourcePdfDigest: SOURCE_BINDING,
      },
    });
    try {
      await expect(
        executeRealBuildPrefix50Step44LaterSourceDerivedOperation({
          sourceBytes,
          prepared,
        }),
      ).rejects.toThrow(/closed operation request|must contain only/u);
    } finally {
      sourceBytes.fill(0);
    }
  });
});
