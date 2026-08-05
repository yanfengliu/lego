import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { relative, resolve } from "node:path";
import { spawnSync } from "node:child_process";

import { afterEach, describe, expect, it } from "vitest";

import { writeHighlightRendererCompatibilityArtifacts } from "../e2e/real-build-highlight-output";

const temporaryDirectories: string[] = [];

function temporaryOutputDirectory(): string {
  const root = resolve(process.cwd(), "output");
  mkdirSync(root, { recursive: true });
  const directory = mkdtempSync(resolve(root, "highlight-compatibility-writer-test-"));
  temporaryDirectories.push(directory);
  return directory;
}

const repoRelative = (path: string): string => relative(process.cwd(), path);

function git(repoRoot: string, args: readonly string[]): void {
  const result = spawnSync(
    "git",
    ["-c", `safe.directory=${repoRoot.replaceAll("\\", "/")}`, "-C", repoRoot, ...args],
    { encoding: "utf8", windowsHide: true },
  );
  expect(result.status, [result.error?.message, result.stderr].filter(Boolean).join("; ")).toBe(0);
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { force: true, recursive: true });
  }
});

describe("highlight renderer-compatibility artifact transaction", () => {
  it("writes a complete pair only below confirmed-ignored output", () => {
    const directory = temporaryOutputDirectory();
    const renderCases = resolve(directory, "render-cases.json");
    const compatibility = resolve(directory, "compatibility.json");

    writeHighlightRendererCompatibilityArtifacts({
      repoRoot: process.cwd(),
      renderCasesPath: repoRelative(renderCases),
      compatibilityPath: repoRelative(compatibility),
      renderCasesBytes: Buffer.from("raw-render-cases"),
      compatibilityBytes: Buffer.from("derived-compatibility"),
    });

    expect(readFileSync(renderCases, "utf8")).toBe("raw-render-cases");
    expect(readFileSync(compatibility, "utf8")).toBe("derived-compatibility");
    expect(readdirSync(directory).sort()).toEqual(["compatibility.json", "render-cases.json"]);
  });

  it("restores the complete prior pair after a failure between public renames", () => {
    const directory = temporaryOutputDirectory();
    const renderCases = resolve(directory, "render-cases.json");
    const compatibility = resolve(directory, "compatibility.json");
    writeFileSync(renderCases, "prior-raw");
    writeFileSync(compatibility, "prior-summary");

    expect(() =>
      writeHighlightRendererCompatibilityArtifacts({
        repoRoot: process.cwd(),
        renderCasesPath: repoRelative(renderCases),
        compatibilityPath: repoRelative(compatibility),
        renderCasesBytes: Buffer.from("replacement-raw"),
        compatibilityBytes: Buffer.from("replacement-summary"),
        testHooks: {
          beforeCompatibilityCommit: () => {
            throw new Error("injected second-commit failure");
          },
        },
      }),
    ).toThrow(/injected second-commit failure/u);

    expect(readFileSync(renderCases, "utf8")).toBe("prior-raw");
    expect(readFileSync(compatibility, "utf8")).toBe("prior-summary");
    expect(readdirSync(directory).sort()).toEqual(["compatibility.json", "render-cases.json"]);
  });

  it("restores the prior pair after a failure following both verified public commits", () => {
    const directory = temporaryOutputDirectory();
    const renderCases = resolve(directory, "render-cases.json");
    const compatibility = resolve(directory, "compatibility.json");
    writeFileSync(renderCases, "prior-raw");
    writeFileSync(compatibility, "prior-summary");

    expect(() =>
      writeHighlightRendererCompatibilityArtifacts({
        repoRoot: process.cwd(),
        renderCasesPath: repoRelative(renderCases),
        compatibilityPath: repoRelative(compatibility),
        renderCasesBytes: Buffer.from("replacement-raw"),
        compatibilityBytes: Buffer.from("replacement-summary"),
        testHooks: {
          afterCompatibilityCommit: () => {
            throw new Error("injected post-commit failure");
          },
        },
      }),
    ).toThrow(/injected post-commit failure/u);

    expect(readFileSync(renderCases, "utf8")).toBe("prior-raw");
    expect(readFileSync(compatibility, "utf8")).toBe("prior-summary");
    expect(readdirSync(directory).sort()).toEqual(["compatibility.json", "render-cases.json"]);
  });

  it("reports cleanup failure without masking the trigger after restoring the prior pair", () => {
    const directory = temporaryOutputDirectory();
    const renderCases = resolve(directory, "render-cases.json");
    const compatibility = resolve(directory, "compatibility.json");
    writeFileSync(renderCases, "prior-raw");
    writeFileSync(compatibility, "prior-summary");
    let retainedPath = "";
    let thrown: unknown;
    try {
      writeHighlightRendererCompatibilityArtifacts({
        repoRoot: process.cwd(),
        renderCasesPath: repoRelative(renderCases),
        compatibilityPath: repoRelative(compatibility),
        renderCasesBytes: Buffer.from("replacement-raw"),
        compatibilityBytes: Buffer.from("replacement-summary"),
        testHooks: {
          beforeCompatibilityCommit: () => {
            throw new Error("primary injected commit failure");
          },
          beforeCleanupPath: (path) => {
            if (retainedPath.length === 0) {
              retainedPath = path;
              throw new Error("secondary injected cleanup failure");
            }
          },
        },
      });
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(AggregateError);
    const aggregate = thrown as AggregateError;
    expect(aggregate.message).toMatch(/prior public pair was restored.*cleanup also failed/u);
    expect(aggregate.errors.map(String).join(" ")).toMatch(
      /primary injected commit failure.*secondary injected cleanup failure/u,
    );
    expect(aggregate.message).toContain(retainedPath);
    expect(existsSync(retainedPath)).toBe(true);
    expect(readFileSync(renderCases, "utf8")).toBe("prior-raw");
    expect(readFileSync(compatibility, "utf8")).toBe("prior-summary");
  });

  it("reports cleanup failure after commit while leaving a byte-consistent public pair", () => {
    const directory = temporaryOutputDirectory();
    const renderCases = resolve(directory, "render-cases.json");
    const compatibility = resolve(directory, "compatibility.json");
    writeFileSync(renderCases, "prior-raw");
    writeFileSync(compatibility, "prior-summary");
    let retainedPath = "";

    expect(() =>
      writeHighlightRendererCompatibilityArtifacts({
        repoRoot: process.cwd(),
        renderCasesPath: repoRelative(renderCases),
        compatibilityPath: repoRelative(compatibility),
        renderCasesBytes: Buffer.from("replacement-raw"),
        compatibilityBytes: Buffer.from("replacement-summary"),
        testHooks: {
          beforeCleanupPath: (path) => {
            if (retainedPath.length === 0 && path.includes(".bak-")) {
              retainedPath = path;
              throw new Error("injected committed-pair cleanup failure");
            }
          },
        },
      }),
    ).toThrow(/public pair is committed and byte-verified.*cleanup failed/u);

    expect(retainedPath).not.toBe("");
    expect(existsSync(retainedPath)).toBe(true);
    expect(readFileSync(renderCases, "utf8")).toBe("replacement-raw");
    expect(readFileSync(compatibility, "utf8")).toBe("replacement-summary");
  });

  it("rejects an ignored output target that is already tracked in its repository", () => {
    const nestedRepository = temporaryOutputDirectory();
    git(nestedRepository, ["init", "--quiet"]);
    writeFileSync(resolve(nestedRepository, ".gitignore"), "/output/\n");
    const nestedOutput = resolve(nestedRepository, "output");
    mkdirSync(nestedOutput);
    const tracked = resolve(nestedOutput, "tracked.json");
    writeFileSync(tracked, "tracked evidence must not be overwritten");
    git(nestedRepository, ["add", "--force", "output/tracked.json"]);

    expect(() =>
      writeHighlightRendererCompatibilityArtifacts({
        repoRoot: nestedRepository,
        renderCasesPath: "output/tracked.json",
        compatibilityPath: "output/untracked.json",
        renderCasesBytes: Buffer.from("replacement-raw"),
        compatibilityBytes: Buffer.from("replacement-summary"),
      }),
    ).toThrow(/is tracked by Git/u);
    expect(readFileSync(tracked, "utf8")).toBe("tracked evidence must not be overwritten");
    expect(existsSync(resolve(nestedOutput, "untracked.json"))).toBe(false);
  });

  it("rejects aliases, repository paths, and non-file targets before writing", () => {
    const directory = temporaryOutputDirectory();
    const shared = repoRelative(resolve(directory, "shared.json"));
    expect(() =>
      writeHighlightRendererCompatibilityArtifacts({
        repoRoot: process.cwd(),
        renderCasesPath: shared,
        compatibilityPath: shared,
        renderCasesBytes: Buffer.from("raw"),
        compatibilityBytes: Buffer.from("summary"),
      }),
    ).toThrow(/need distinct paths/u);

    expect(() =>
      writeHighlightRendererCompatibilityArtifacts({
        repoRoot: process.cwd(),
        renderCasesPath: "apps/web/render-cases.json",
        compatibilityPath: repoRelative(resolve(directory, "compatibility.json")),
        renderCasesBytes: Buffer.from("raw"),
        compatibilityBytes: Buffer.from("summary"),
      }),
    ).toThrow(/strictly below/u);

    const nonFile = resolve(directory, "non-file.json");
    mkdirSync(nonFile);
    expect(() =>
      writeHighlightRendererCompatibilityArtifacts({
        repoRoot: process.cwd(),
        renderCasesPath: repoRelative(nonFile),
        compatibilityPath: repoRelative(resolve(directory, "compatibility.json")),
        renderCasesBytes: Buffer.from("raw"),
        compatibilityBytes: Buffer.from("summary"),
      }),
    ).toThrow(/absent or a regular file/u);

    const blockedParent = resolve(directory, "blocked-parent");
    writeFileSync(blockedParent, "not a directory");
    expect(() =>
      writeHighlightRendererCompatibilityArtifacts({
        repoRoot: process.cwd(),
        renderCasesPath: repoRelative(resolve(blockedParent, "render-cases.json")),
        compatibilityPath: repoRelative(resolve(directory, "compatibility.json")),
        renderCasesBytes: Buffer.from("raw"),
        compatibilityBytes: Buffer.from("summary"),
      }),
    ).toThrow(/real directory/u);
  });

  it("rejects a real symlink or Windows junction in the output directory chain", ({ skip }) => {
    const external = mkdtempSync(resolve(tmpdir(), "lego-highlight-output-link-target-"));
    temporaryDirectories.push(external);
    const directory = temporaryOutputDirectory();
    const linkedParent = resolve(directory, "linked-parent");
    try {
      symlinkSync(external, linkedParent, process.platform === "win32" ? "junction" : "dir");
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (
        process.platform === "win32" &&
        code === "EPERM" &&
        /privilege|not permitted/iu.test(error instanceof Error ? error.message : String(error))
      ) {
        skip(
          `Windows denied junction creation with a demonstrated privilege error: ${String(error)}`,
        );
        return;
      }
      throw error;
    }

    expect(() =>
      writeHighlightRendererCompatibilityArtifacts({
        repoRoot: process.cwd(),
        renderCasesPath: repoRelative(resolve(linkedParent, "render-cases.json")),
        compatibilityPath: repoRelative(resolve(directory, "compatibility.json")),
        renderCasesBytes: Buffer.from("raw"),
        compatibilityBytes: Buffer.from("summary"),
      }),
    ).toThrow(/real directory, not a symlink/u);
    expect(readdirSync(external)).toEqual([]);
  });
});
