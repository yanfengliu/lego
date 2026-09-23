import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { runRealBuildPrefix50Step44Poppler } from "../e2e/real-build-prefix50-subbuild-return-review-poppler.ts";
import { REAL_BUILD_PREFIX50_STEP44_POPPLER_TOOLCHAIN_COMMITMENT } from "../e2e/real-build-prefix50-subbuild-return-review-poppler-toolchain.ts";
import { createStep44SourceFreeTestPdfBytes } from "./real-build-prefix50-subbuild-return-review-test-pdf.ts";

const testOnWindows = process.platform === "win32" ? it : it.skip;
const POWERSHELL = "C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe";
const LAUNCHER = fileURLToPath(
  new URL(
    "../e2e/real-build-prefix50-subbuild-return-review-poppler-job-launcher.dll",
    import.meta.url,
  ),
);

function powershellLiteral(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

describe("locked Poppler toolchain integration", () => {
  testOnWindows("renders one synthetic stdin PDF and returns a quiescent job receipt", () => {
    const directory = mkdtempSync(join(tmpdir(), "lego-step44-poppler-integration-"));
    try {
      const outputPrefix = join(directory, "page45");
      const result = runRealBuildPrefix50Step44Poppler({
        arguments: ["-f", "45", "-l", "45", "-r", "180", "-png", "-singlefile", "-", outputPrefix],
        sourceBytes: createStep44SourceFreeTestPdfBytes([0.16, 0.48, 0.95]),
        label: "source-free locked Poppler integration",
      });
      expect(result).toEqual({
        version: "26.05.0",
        toolchainCommitment: REAL_BUILD_PREFIX50_STEP44_POPPLER_TOOLCHAIN_COMMITMENT,
        totalProcesses: 2,
        activeProcesses: 0,
      });
      expect(existsSync(`${outputPrefix}.png`)).toBe(true);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  testOnWindows("bounds stdin even when the contained child never reads it", () => {
    const childCommand = "[Threading.Thread]::Sleep(30000)";
    const script = [
      '$ErrorActionPreference = "Stop"',
      `[void][Reflection.Assembly]::Load([IO.File]::ReadAllBytes(${powershellLiteral(LAUNCHER)}))`,
      "$environment = [Collections.Generic.Dictionary[string,string]]::new([StringComparer]::OrdinalIgnoreCase)",
      '$environment.Add("SystemRoot", "C:\\Windows")',
      '$environment.Add("WINDIR", "C:\\Windows")',
      "$stdin = [byte[]]::new(8388608)",
      "$arguments = [string[]]@('-NoLogo', '-NoProfile', '-NonInteractive', '-Command', " +
        powershellLiteral(childCommand) +
        ")",
      "try {",
      `  [void][Step44PopplerJobLauncher]::Run(${powershellLiteral(POWERSHELL)}, 'C:\\Windows\\System32', $arguments, $environment, $stdin, 250)`,
      '  throw "launcher unexpectedly returned"',
      "} catch {",
      "  $failure = $_.Exception.GetBaseException()",
      "  if ($failure -isnot [TimeoutException]) { throw $failure }",
      "  [Console]::Out.Write($failure.Message)",
      "}",
    ].join("\n");
    const encoded = Buffer.from(script, "utf16le").toString("base64");
    const started = performance.now();
    const outcome = spawnSync(
      POWERSHELL,
      ["-NoLogo", "-NoProfile", "-NonInteractive", "-EncodedCommand", encoded],
      { encoding: "utf8", timeout: 10_000, windowsHide: true },
    );
    const elapsed = performance.now() - started;
    expect(outcome.error).toBeUndefined();
    expect(outcome.status, outcome.stderr).toBe(0);
    expect(outcome.stdout).toMatch(/job-contained Poppler timed out/u);
    expect(elapsed).toBeLessThan(8_000);
  });
});
