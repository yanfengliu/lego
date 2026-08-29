import { execFileSync } from "node:child_process";
import { lstatSync } from "node:fs";

const normalizePath = (value) => value.replaceAll("\\", "/");

const parseGitPathList = (output) =>
  output.toString("utf8").split("\0").filter(Boolean).map(normalizePath);

export function excludeGitReportedDeletedSourcePaths(relativeFiles, deletedFiles) {
  const deleted = new Set(deletedFiles.map(normalizePath));
  return [...new Set(relativeFiles.map(normalizePath))]
    .filter((relativeFile) => !deleted.has(relativeFile))
    .sort();
}

export function checkedSourcePopulation(repositoryRoot) {
  let output;
  let deletedOutput;
  try {
    output = execFileSync(
      "git",
      [
        "-c",
        `safe.directory=${normalizePath(repositoryRoot)}`,
        "ls-files",
        "-z",
        "--cached",
        "--others",
        "--exclude-standard",
        "--",
        "apps",
        "packages",
        "scripts",
      ],
      { cwd: repositoryRoot, encoding: "buffer", maxBuffer: 16 * 1_024 * 1_024 },
    );
    deletedOutput = execFileSync(
      "git",
      [
        "-c",
        `safe.directory=${normalizePath(repositoryRoot)}`,
        "ls-files",
        "-z",
        "--deleted",
        "--",
        "apps",
        "packages",
        "scripts",
      ],
      { cwd: repositoryRoot, encoding: "buffer", maxBuffer: 16 * 1_024 * 1_024 },
    );
  } catch (error) {
    throw new Error(
      `could not enumerate the Git tracked plus non-ignored source population: ${error.message}`,
      { cause: error },
    );
  }
  const population = excludeGitReportedDeletedSourcePaths(
    parseGitPathList(output),
    parseGitPathList(deletedOutput),
  );
  assertRegularSourcePopulation(repositoryRoot, population);
  return population;
}

export function assertRegularSourcePopulation(repositoryRoot, relativeFiles, inspect = lstatSync) {
  for (const relativeFile of relativeFiles) {
    let status;
    try {
      status = inspect(`${repositoryRoot}/${relativeFile}`);
    } catch {
      throw new Error(`Git enumerated ${relativeFile}, but the regular file could not be read`);
    }
    if (status.isSymbolicLink() || !status.isFile()) {
      throw new Error(
        `Git enumerated ${relativeFile}, but it is not a regular in-repository file (symbolic links and reparse-style entries are refused)`,
      );
    }
  }
}
