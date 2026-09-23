import { createHash } from "node:crypto";
import { linkSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const boundary = vi.hoisted(() => ({
  spawnSync: vi.fn(),
  reviewedConfiguration: vi.fn(),
  roots: [] as string[],
  reads: [] as { operation: string; path: string }[],
  forbidden: [] as string[],
  descriptors: new Map<number, string>(),
}));

vi.mock("node:child_process", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  const clone = Object.fromEntries(
    Object.entries(actual).map(([name, value]) => [
      name,
      name === "spawnSync"
        ? boundary.spawnSync
        : typeof value === "function"
          ? function forbiddenChild() {
              boundary.forbidden.push(`child_process.${name}`);
              throw new Error(`Poppler unit tests forbid child_process.${name}.`);
            }
          : value,
    ]),
  );
  if ("default" in clone) clone.default = clone;
  return clone;
});

vi.mock("node:fs", async (importOriginal) => {
  const { guardedPopplerFilesystem } =
    await import("./real-build-poppler-diagnostic-test-support.ts");
  return guardedPopplerFilesystem(await importOriginal<typeof import("node:fs")>(), boundary);
});

vi.mock(
  "../e2e/real-build-prefix50-subbuild-return-review-poppler-toolchain-verifier.ts",
  async (importOriginal) => ({
    ...(await importOriginal<
      typeof import("../e2e/real-build-prefix50-subbuild-return-review-poppler-toolchain-verifier.ts")
    >()),
    reviewedRealBuildPrefix50Step44PopplerToolchainConfiguration: boundary.reviewedConfiguration,
  }),
);

import { runRealBuildPrefix50Step44Poppler } from "../e2e/real-build-prefix50-subbuild-return-review-poppler.ts";
import {
  __testOnlyRealBuildPrefix50Step44PopplerToolchain as toolchain,
  verifyRealBuildPrefix50Step44PopplerToolchain,
  type RealBuildPrefix50Step44PopplerToolchainConfiguration,
} from "../e2e/real-build-prefix50-subbuild-return-review-poppler-toolchain-verifier.ts";
import {
  inspectDiagnosticGraph,
  retainPopplerDiagnosticEvidence,
  serializeInstalledPlaywright,
  syntheticRootExists,
} from "./real-build-poppler-diagnostic-test-support.ts";

const roots = boundary.roots;
const diagnosticRecords: Record<string, unknown>[] = [];
const cleanup: { root: string; removed: boolean }[] = [];

function sha256(bytes: Uint8Array): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function configure(): Readonly<{
  executable: string;
  configuration: RealBuildPrefix50Step44PopplerToolchainConfiguration;
}> {
  const root = mkdtempSync(join(tmpdir(), "lego-step44-poppler-test-"));
  roots.push(root);
  const bin = join(root, "bin");
  mkdirSync(bin);
  const executable = join(bin, "pdftoppm.exe");
  const bytes = Buffer.from("immutable source-free Poppler sentinel\n", "utf8");
  writeFileSync(executable, bytes);
  return {
    executable,
    configuration: toolchain.configuration({
      root,
      version: "26.05.0-test",
      directories: ["bin"],
      files: [{ relativePath: "bin/pdftoppm.exe", digest: sha256(bytes), bytes: bytes.length }],
      loaderEnvironment: { SystemRoot: "C:\\Windows", WINDIR: "C:\\Windows" },
    }),
  };
}

function success() {
  return {
    error: undefined,
    status: 0,
    stdout: JSON.stringify({
      schemaVersion: "lego.real-build-prefix50-step44-poppler-result/1",
      totalProcesses: 2,
      activeProcesses: 0,
    }),
    stderr: "",
  };
}

function request(): Readonly<{
  header: Record<string, unknown>;
  sourceBytes: Buffer;
  environment: NodeJS.ProcessEnv;
  commandArguments: readonly string[];
}> {
  const call = boundary.spawnSync.mock.calls[0]!;
  const options = call[2] as { input: Buffer; env: NodeJS.ProcessEnv };
  const headerLength = options.input.readUInt32LE(0);
  const headerEnd = 4 + headerLength;
  return {
    header: JSON.parse(options.input.subarray(4, headerEnd).toString("utf8")) as Record<
      string,
      unknown
    >,
    sourceBytes: options.input.subarray(headerEnd),
    environment: options.env,
    commandArguments: call[1] as readonly string[],
  };
}

beforeEach(() => {
  boundary.reads.length = 0;
  boundary.forbidden.length = 0;
  boundary.spawnSync.mockReset();
  boundary.spawnSync.mockImplementation(success);
  boundary.reviewedConfiguration.mockReset();
  boundary.reviewedConfiguration.mockImplementation(() => {
    throw new Error("Source-free Poppler unit case must choose its configuration explicitly.");
  });
});

afterEach(() => {
  try {
    while (roots.length > 0) {
      const root = roots.at(-1)!;
      rmSync(root, { recursive: true, force: true });
      const removed = !syntheticRootExists(root);
      cleanup.push({ root, removed });
      roots.pop();
      expect(removed).toBe(true);
    }
    expect(boundary.descriptors.size).toBe(0);
    expect(boundary.forbidden).toEqual([]);
  } finally {
    vi.unstubAllEnvs();
  }
});

afterAll(() => retainPopplerDiagnosticEvidence(diagnosticRecords, cleanup));

const testOnWindows = process.platform === "win32" ? it : it.skip;

describe("source-free Poppler boundary unit controls", () => {
  // Bound: synthetic exact toolchain files and mocked spawn, with the real verifier,
  // framing and response parser. Windows and the pinned host PowerShell/repository
  // helpers are still required. This suite does not qualify installed Poppler.
  it("keeps the actual production factory frozen at its independently recorded roster", async () => {
    const actual = await vi.importActual<
      typeof import("../e2e/real-build-prefix50-subbuild-return-review-poppler-toolchain-verifier.ts")
    >("../e2e/real-build-prefix50-subbuild-return-review-poppler-toolchain-verifier.ts");
    const configuration = actual.reviewedRealBuildPrefix50Step44PopplerToolchainConfiguration();
    expect(Object.isFrozen(configuration)).toBe(true);
    expect(configuration.version).toBe("26.05.0");
    expect(configuration.files).toHaveLength(178);
    const body = JSON.stringify({
      root: configuration.root,
      version: configuration.version,
      directories: configuration.directories,
      files: configuration.files,
      loaderEnvironment: configuration.loaderEnvironment,
    });
    expect(configuration.bodyJson).toBe(body);
    expect(sha256(Buffer.from(body, "utf8"))).toBe(
      "sha256:ad3675e883db5966ee288583783841777cd63d908789ec4d2f77247f7433824f",
    );
    expect(configuration.commitment).toBe(
      "sha256:ad3675e883db5966ee288583783841777cd63d908789ec4d2f77247f7433824f",
    );
    expect(boundary.spawnSync).not.toHaveBeenCalled();
  });

  it("propagates the production-factory refusal before spawning", () => {
    const refusal = new TypeError("synthetic production-factory refusal");
    boundary.reviewedConfiguration.mockImplementationOnce(() => {
      throw refusal;
    });
    expect(() =>
      runRealBuildPrefix50Step44Poppler({
        arguments: ["-v"],
        sourceBytes: new Uint8Array([1]),
        label: "factory refusal control",
      }),
    ).toThrow(refusal);
    expect(boundary.reviewedConfiguration).toHaveBeenCalledExactlyOnceWith();
    expect(boundary.spawnSync).not.toHaveBeenCalled();
  });

  testOnWindows(
    "frames the factory-selected synthetic configuration and ignores caller overrides",
    () => {
      const { configuration } = configure();
      boundary.reviewedConfiguration.mockReturnValueOnce(configuration);
      const sourceBytes = Buffer.from("%PDF source-free sentinel\n", "utf8");
      vi.stubEnv("PATH", "C:\\hostile-path");
      vi.stubEnv("NODE_OPTIONS", "--require=C:\\hostile-loader.cjs");
      const input = {
        arguments: ["-f", "45", "-l", "45", "-png", "-singlefile", "-", "output-prefix"],
        sourceBytes,
        label: "source-free Poppler control",
        toolchain: { root: "C:\\hostile-toolchain", commitment: "caller-supplied" },
      };
      const result = runRealBuildPrefix50Step44Poppler(input);
      expect(result).toMatchObject({
        version: "26.05.0-test",
        toolchainCommitment: configuration.commitment,
        totalProcesses: 2,
        activeProcesses: 0,
      });
      expect(boundary.spawnSync).toHaveBeenCalledTimes(1);
      expect(boundary.reviewedConfiguration).toHaveBeenCalledExactlyOnceWith();
      const framed = request();
      expect(framed.header).toMatchObject({
        schemaVersion: "lego.real-build-prefix50-step44-poppler-request/1",
        arguments: ["-f", "45", "-l", "45", "-png", "-singlefile", "-", "output-prefix"],
        sourceBytes: sourceBytes.byteLength,
        toolchainCommitment: configuration.commitment,
        toolchainBodyBase64: Buffer.from(configuration.bodyJson, "utf8").toString("base64"),
        launcherAssemblyBase64: expect.any(String),
      });
      expect(framed.sourceBytes).toEqual(sourceBytes);
      expect(framed.environment).toEqual({ SystemRoot: "C:\\Windows", WINDIR: "C:\\Windows" });
      expect(framed.commandArguments).toEqual([
        "-NoLogo",
        "-NoProfile",
        "-NonInteractive",
        "-EncodedCommand",
        expect.any(String),
      ]);
    },
  );

  testOnWindows("public wrapper rejects mutated synthetic toolchain bytes before spawning", () => {
    const { executable, configuration } = configure();
    boundary.reviewedConfiguration.mockReturnValueOnce(configuration);
    writeFileSync(executable, "changed after factory selection\n", "utf8");
    expect(() =>
      runRealBuildPrefix50Step44Poppler({
        arguments: ["-v"],
        sourceBytes: new Uint8Array([1]),
        label: "wrapper verifier control",
      }),
    ).toThrow(/single-name|digest pin/u);
    expect(boundary.reviewedConfiguration).toHaveBeenCalledExactlyOnceWith();
    expect(boundary.spawnSync).not.toHaveBeenCalled();
  });

  testOnWindows("rejects a wrong file digest before the helper can spawn", () => {
    const { configuration } = configure();
    const invalid = toolchain.configuration({
      ...configuration,
      files: [
        {
          ...configuration.files[0]!,
          digest: "sha256:0000000000000000000000000000000000000000000000000000000000000000",
        },
      ],
    });
    expect(() => verifyRealBuildPrefix50Step44PopplerToolchain(invalid)).toThrow(/digest pin/u);
    expect(boundary.spawnSync).not.toHaveBeenCalled();
  });

  testOnWindows("rejects hardlinks and duplicate file identities before spawning", () => {
    const { executable, configuration } = configure();
    linkSync(executable, `${executable}.alias`);
    expect(() => verifyRealBuildPrefix50Step44PopplerToolchain(configuration)).toThrow(
      /file set|single-name/u,
    );
    expect(boundary.spawnSync).not.toHaveBeenCalled();
  });

  testOnWindows("detects toolchain identity drift before any contained launch", () => {
    const { executable, configuration } = configure();
    expect(() => verifyRealBuildPrefix50Step44PopplerToolchain(configuration)).not.toThrow();
    writeFileSync(executable, "changed after authentication\n", "utf8");
    expect(() => verifyRealBuildPrefix50Step44PopplerToolchain(configuration)).toThrow(
      /file set|changed|digest pin|single-name/u,
    );
    expect(boundary.spawnSync).not.toHaveBeenCalled();
  });

  testOnWindows("withholds stderr and rejects an unauthenticated quiescence receipt", () => {
    const { configuration } = configure();
    boundary.reviewedConfiguration.mockReturnValue(configuration);
    boundary.spawnSync.mockReturnValueOnce({
      error: undefined,
      status: 1,
      stdout: "",
      stderr: "SENSITIVE_STDERR_SENTINEL",
    });
    let message = "";
    try {
      runRealBuildPrefix50Step44Poppler({
        arguments: ["-v"],
        sourceBytes: new Uint8Array([1]),
        label: "stderr control",
      });
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }
    expect(message).toMatch(/stderr bytes were withheld/u);
    expect(message).not.toContain("SENSITIVE_STDERR_SENTINEL");
    expect(boundary.spawnSync).toHaveBeenCalledTimes(1);
    boundary.spawnSync.mockReturnValueOnce({
      ...success(),
      stdout: JSON.stringify({
        schemaVersion: "lego.real-build-prefix50-step44-poppler-result/1",
        totalProcesses: 2,
        activeProcesses: 1,
      }),
    });
    expect(() =>
      runRealBuildPrefix50Step44Poppler({
        arguments: ["-v"],
        sourceBytes: new Uint8Array([1]),
        label: "non-quiescent control",
      }),
    ).toThrow(/invalid quiescence receipt/u);
    expect(boundary.spawnSync).toHaveBeenCalledTimes(2);
    boundary.spawnSync.mockReturnValueOnce({ ...success(), stdout: "not-json" });
    expect(() =>
      runRealBuildPrefix50Step44Poppler({
        arguments: ["-v"],
        sourceBytes: new Uint8Array([1]),
        label: "malformed stdout control",
      }),
    ).toThrow(/no exact quiescence receipt/u);
    expect(boundary.spawnSync).toHaveBeenCalledTimes(3);
  });
});

describe("bounded Poppler caller and installed Playwright diagnostics", () => {
  // Bound: the accepted five synthetic returned-spawn cases only. The actual
  // wrapper and installed serializeError run; spawn is mocked, prerequisite reads
  // are identity-only, and no native source, publication or browser route runs.
  // Synchronous spawnSync throws remain outside this regression's measured class.
  testOnWindows.each([
    "valid",
    "nonquiescent",
    "stderr",
    "malformed-stdout",
    "spawn-error",
  ] as const)("withholds raw diagnostics for %s", (name) => {
    const record: Record<string, unknown> = { name, completed: false };
    diagnosticRecords.push(record);
    const { configuration } = configure();
    boundary.reviewedConfiguration.mockReturnValueOnce(configuration);
    const sourceBytes = Buffer.from("source-free-probe", "utf8");
    const spawnError = Object.assign(
      new Error("PDIAG7S:message", {
        cause: new Error("PDIAG7S:nested-cause"),
      }),
      { diagnostic: "PDIAG7S:own-field" },
    );
    Object.defineProperty(spawnError, "hiddenDiagnostic", {
      value: "PDIAG7S:non-enumerable",
      enumerable: false,
    });
    Object.defineProperty(spawnError, Symbol("syntheticDiagnostic"), {
      value: "PDIAG7S:symbol-field",
    });
    const run =
      name === "nonquiescent"
        ? {
            ...success(),
            stdout: JSON.stringify({
              schemaVersion: "lego.real-build-prefix50-step44-poppler-result/1",
              totalProcesses: 2,
              activeProcesses: 1,
            }),
          }
        : name === "stderr"
          ? { ...success(), status: 1, stderr: "PDIAG7E" }
          : name === "malformed-stdout"
            ? { ...success(), stdout: "PDIAG7Q" }
            : name === "spawn-error"
              ? { ...success(), status: null, error: spawnError }
              : success();
    boundary.spawnSync.mockReturnValueOnce(run);
    let result: ReturnType<typeof runRealBuildPrefix50Step44Poppler> | undefined;
    let caught: unknown;
    try {
      result = runRealBuildPrefix50Step44Poppler({
        arguments: ["-v"],
        sourceBytes,
        label: "diagnostic probe",
      });
    } catch (error) {
      caught = error;
    }
    record.wrapperCalls = boundary.spawnSync.mock.calls.length;
    record.factoryCalls = boundary.reviewedConfiguration.mock.calls.length;
    record.reads = [...boundary.reads];
    record.forbidden = [...boundary.forbidden];
    expect(boundary.spawnSync).toHaveBeenCalledTimes(1);
    expect(boundary.reviewedConfiguration).toHaveBeenCalledExactlyOnceWith();
    expect(boundary.forbidden).toEqual([]);
    expect(boundary.descriptors.size).toBe(0);
    const framed = request();
    expect(framed.sourceBytes).toEqual(sourceBytes);
    expect(framed.header).toMatchObject({
      arguments: ["-v"],
      sourceBytes: sourceBytes.length,
      toolchainCommitment: configuration.commitment,
      toolchainBodyBase64: Buffer.from(configuration.bodyJson, "utf8").toString("base64"),
    });
    expect(framed.environment).toEqual({ SystemRoot: "C:\\Windows", WINDIR: "C:\\Windows" });
    expect(boundary.spawnSync.mock.calls[0]![2]).toMatchObject({ windowsHide: true });
    for (const suffix of ["poppler-lock.ps1", "poppler-job-launcher.dll", "powershell.exe"]) {
      expect(
        boundary.reads.filter(
          (read) => read.operation === "read" && read.path.toLowerCase().endsWith(suffix),
        ).length,
      ).toBe(2);
    }
    if (name === "valid") {
      record.result = result;
      expect(caught).toBeUndefined();
      expect(result).toEqual({
        version: "26.05.0-test",
        toolchainCommitment: configuration.commitment,
        totalProcesses: 2,
        activeProcesses: 0,
      });
      record.completed = true;
      return;
    }
    expect(result).toBeUndefined();
    expect(caught).toBeInstanceOf(TypeError);
    const expected =
      name === "nonquiescent"
        ? "diagnostic probe returned an invalid quiescence receipt."
        : name === "stderr"
          ? "diagnostic probe failed with status 1; 7 stderr bytes were withheld."
          : name === "malformed-stdout"
            ? "diagnostic probe returned no exact quiescence receipt."
            : "diagnostic probe failed with status null; 0 stderr bytes were withheld.";
    const immediate = inspectDiagnosticGraph(caught);
    const serialized = serializeInstalledPlaywright(caught);
    const reported = inspectDiagnosticGraph(serialized.serialized);
    Object.assign(record, {
      immediate,
      reported,
      serializer: serialized.evidence,
      instrumentError:
        serialized.instrumentError === undefined ? null : String(serialized.instrumentError),
    });
    expect((caught as Error).message).toBe(expected);
    expect((caught as Error).message.length).toBeLessThanOrEqual(192);
    expect(serialized.instrumentError).toBeUndefined();
    expect(serialized.evidence).toMatchObject({
      calls: 1,
      loadComplete: true,
      restored: true,
      denied: [],
      preexistingCacheUnchanged: true,
    });
    expect(serialized.evidence.inertAgents).toEqual(["https.Agent", "http.Agent"]);
    expect(serialized.evidence.loads).toHaveLength(5);
    expect(serialized.evidence.removedCacheEntries.slice().sort()).toEqual(
      serialized.evidence.loads.map((load) => load.path).sort(),
    );
    expect(
      serialized.evidence.loads.find((load) => load.path === serialized.evidence.entry)?.sha256,
    ).toBe("6d5e08165ec78f576d4724c0e4693d07cf1e8e2662156daa706e380550d272a5");
    expect(serialized.serialized).toMatchObject({
      message: `TypeError: ${expected}`,
      stack: expect.any(String),
    });
    if (name === "spawn-error") {
      const control = inspectDiagnosticGraph(spawnError);
      record.inputGraph = control;
      expect(control.incomplete).toEqual([]);
      expect(control.cycles).toEqual([]);
      for (const marker of [
        "message",
        "nested-cause",
        "own-field",
        "non-enumerable",
        "symbol-field",
      ]) {
        expect(control.strings.some((entry) => entry.value.includes(`PDIAG7S:${marker}`))).toBe(
          true,
        );
      }
      let accessorCalls = 0;
      const accessor = Object.defineProperty({}, "hidden", {
        get() {
          accessorCalls++;
          return "unread";
        },
      });
      expect(inspectDiagnosticGraph(accessor).incomplete).toEqual([
        "$.hidden: accessor not invoked",
      ]);
      expect(accessorCalls).toBe(0);
      expect(inspectDiagnosticGraph("x".repeat(8193)).incomplete).toEqual(["$: string bound"]);
    }
    for (const graph of [immediate, reported]) {
      expect(graph.incomplete).toEqual([]);
      expect(graph.cycles).toEqual([]);
      expect(graph.strings.length).toBeGreaterThanOrEqual(2);
      for (const marker of ["PDIAG7E", "PDIAG7Q", "PDIAG7S"]) {
        expect(
          graph.strings.filter((entry) => entry.value.includes(marker)),
          `${name}: raw ${marker} escaped`,
        ).toEqual([]);
      }
    }
    expect(Object.hasOwn(caught as Error, "cause")).toBe(false);
    expect((serialized.serialized as { cause?: unknown }).cause).toBeUndefined();
    record.completed = true;
  });
});
