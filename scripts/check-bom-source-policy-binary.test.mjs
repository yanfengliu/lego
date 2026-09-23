import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { inspectAppPackageSourceCensus } from "./check-bom-source-policy.mjs";

const binaryPath =
  "apps/web/e2e/real-build-prefix50-subbuild-return-review-poppler-job-launcher.dll";
const sourcePath = binaryPath.replace(/\.dll$/u, ".cs");
const binary = { relativeFile: binaryPath, sourceBytes: readFileSync(resolve(binaryPath)) };
const source = { relativeFile: sourcePath, sourceBytes: readFileSync(resolve(sourcePath)) };

describe("exact source-reproduced launcher binary admission", () => {
  // Bound: one exact launcher path, its complete C# source, and their reproduced bytes.
  // No extension-wide DLL exemption or source-free binary admission is permitted.
  it("admits the reproduced pair while still counting its C# source literals", () => {
    const result = inspectAppPackageSourceCensus([binary, source]);
    const textOnly = inspectAppPackageSourceCensus([source]);
    expect(result.issues).toEqual([]);
    expect(result.atomCount).toBeGreaterThan(0);
    expect(result.atomCount).toBe(textOnly.atomCount);
    expect(result.totalCharacters).toBe(textOnly.totalCharacters);
  });

  it("refuses changed binary bytes, a truncated binary, and a missing or changed source", () => {
    const changedBinary = Buffer.from(binary.sourceBytes);
    changedBinary[changedBinary.length - 1] ^= 1;
    for (const entries of [
      [{ ...binary, sourceBytes: changedBinary }, source],
      [{ ...binary, sourceBytes: binary.sourceBytes.subarray(1) }, source],
      [binary],
      [binary, { ...source, sourceBytes: Buffer.concat([source.sourceBytes, Buffer.from("\n")]) }],
      [binary, source, source],
    ]) {
      expect(inspectAppPackageSourceCensus(entries).issues.join("\n")).toMatch(
        /launcher.*(?:bytes|source)/iu,
      );
    }
  });

  it("does not admit renamed, unrelated, or text-disguised copies of the DLL", () => {
    for (const relativeFile of [
      "apps/web/e2e/other.dll",
      "scripts/real-build-prefix50-subbuild-return-review-poppler-job-launcher.dll",
      binaryPath.replace(/\.dll$/u, ".ts"),
    ]) {
      expect(
        inspectAppPackageSourceCensus([{ ...binary, relativeFile }, source]).issues.length,
      ).toBeGreaterThan(0);
    }
  });
});
