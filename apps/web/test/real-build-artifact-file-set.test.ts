import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { assertNoUndeclaredRealBuildArtifacts } from "../e2e/real-build-artifact-file-set";

const temporaryDirectories: string[] = [];

function artifactDirectory(): string {
  const directory = mkdtempSync(join(tmpdir(), "lego-artifact-file-set-"));
  temporaryDirectories.push(directory);
  writeFileSync(join(directory, "artifact-manifest.json"), "{}\n");
  return directory;
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { force: true, recursive: true });
  }
});

describe("real-build artifact reserved-file closure", () => {
  it("rejects an undeclared reserved directory before filtering by filesystem kind", () => {
    const directory = artifactDirectory();
    mkdirSync(join(directory, "score.json"));
    expect(() => assertNoUndeclaredRealBuildArtifacts(directory, new Set())).toThrow(
      /undeclared reserved evidence file.*score\.json/u,
    );
  });

  it("requires every declared reserved evidence path to be a regular non-link file", () => {
    const directory = artifactDirectory();
    mkdirSync(join(directory, "score.json"));
    expect(() => assertNoUndeclaredRealBuildArtifacts(directory, new Set(["score.json"]))).toThrow(
      /not regular non-link files.*score\.json/u,
    );
    rmSync(join(directory, "score.json"), { recursive: true });
    writeFileSync(join(directory, "score.json"), "{}\n");
    expect(() =>
      assertNoUndeclaredRealBuildArtifacts(directory, new Set(["score.json"])),
    ).not.toThrow();
  });

  it("rejects undeclared and declared reserved symbolic-link or junction entries", () => {
    const directory = artifactDirectory();
    const target = join(directory, "target-directory");
    mkdirSync(target);
    symlinkSync(target, join(directory, "document.json"), "junction");
    expect(() => assertNoUndeclaredRealBuildArtifacts(directory, new Set())).toThrow(
      /undeclared reserved evidence file.*document\.json/u,
    );
    expect(() =>
      assertNoUndeclaredRealBuildArtifacts(directory, new Set(["document.json"])),
    ).toThrow(/not regular non-link files.*document\.json/u);
  });

  it.each(["served-response-manifest.json", "served-response-bodies-000.bin"])(
    "reserves the complete served-response evidence namespace before filtering %s by kind",
    (name) => {
      const directory = artifactDirectory();
      mkdirSync(join(directory, name));
      expect(() => assertNoUndeclaredRealBuildArtifacts(directory, new Set())).toThrow(
        new RegExp(`undeclared reserved evidence file.*${name.replace(".", "\\.")}`, "u"),
      );
      expect(() => assertNoUndeclaredRealBuildArtifacts(directory, new Set([name]))).toThrow(
        new RegExp(`not regular non-link files.*${name.replace(".", "\\.")}`, "u"),
      );
    },
  );

  it.each(["served-response-manifest.json", "served-response-bodies-999.bin"])(
    "rejects undeclared and declared served-response junction %s",
    (name) => {
      const directory = artifactDirectory();
      const target = join(directory, "served-response-target");
      mkdirSync(target);
      symlinkSync(target, join(directory, name), "junction");
      expect(() => assertNoUndeclaredRealBuildArtifacts(directory, new Set())).toThrow(
        new RegExp(`undeclared reserved evidence file.*${name.replace(".", "\\.")}`, "u"),
      );
      expect(() => assertNoUndeclaredRealBuildArtifacts(directory, new Set([name]))).toThrow(
        new RegExp(`not regular non-link files.*${name.replace(".", "\\.")}`, "u"),
      );
    },
  );
});
