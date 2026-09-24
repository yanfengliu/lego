import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, realpathSync, statSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";

/**
 * The harness's file boundary: the inputs it reads, and the outputs it may write.
 *
 * Every input is sized before a byte of it is read, so a file past its limit
 * is reported without being hashed or parsed. Every output must land where Git
 * ignores it: the status rows carry official transforms, and the repository is
 * public, so a BOOKLET_OUT inside a tracked, non-ignored path is refused.
 */
export const INPUT_LIMITS = Object.freeze({
  bookletPdfBytes: 256 * 1024 * 1024,
  lxfmlBytes: 32 * 1024 * 1024,
  officialLdrawBytes: 8 * 1024 * 1024,
  ldrawFramesBytes: 8 * 1024 * 1024,
});

export interface InputFile {
  readonly path: string;
  readonly present: boolean;
  readonly bytes: number | null;
  readonly sha256: string | null;
  /** Why a present file cannot be read: not a file, or over its size limit. */
  readonly problem: string | null;
}

export function inputFile(path: string, maxBytes: number): InputFile {
  let stat;
  try {
    stat = statSync(path);
  } catch {
    return { path, present: false, bytes: null, sha256: null, problem: null };
  }
  if (!stat.isFile()) {
    return { path, present: true, bytes: null, sha256: null, problem: `${path} is not a file` };
  }
  if (stat.size > maxBytes) {
    return {
      path,
      present: true,
      bytes: stat.size,
      sha256: null,
      problem: `${path} is ${stat.size} bytes, over the ${maxBytes}-byte limit; point the variable at the right file`,
    };
  }
  return {
    path,
    present: true,
    bytes: stat.size,
    sha256: `sha256:${createHash("sha256").update(readFileSync(path)).digest("hex")}`,
    problem: null,
  };
}

/**
 * The opt-in for inputs that are ignored run evidence rather than product
 * inputs (the first-50 frame registry). It reads `LEGO_RUN_EVIDENCE` the way
 * scripts/run-evidence-gate.mjs reads it for tests: unset, "" or "0" is off,
 * "1" is on, and anything else is refused by name. That module imports
 * vitest, so the harness reads the variable itself.
 */
export const RUN_EVIDENCE_VARIABLE = "LEGO_RUN_EVIDENCE";

export type RunEvidenceOptIn =
  { readonly status: "off" | "on" } | { readonly status: "invalid"; readonly reason: string };

export function readRunEvidenceOptIn(value: string | undefined): RunEvidenceOptIn {
  if (value === undefined || value === "" || value === "0") return { status: "off" };
  if (value === "1") return { status: "on" };
  return {
    status: "invalid",
    reason: `${RUN_EVIDENCE_VARIABLE} is ${JSON.stringify(value)}; set it to 1 to read ignored run evidence (the first-50 frame registry), or leave it unset (or 0) to skip it.`,
  };
}

/** The main checkout, where the ignored inputs live; a worktree shares its Git directory. */
export function mainCheckoutRoot(repositoryRoot: string): string {
  try {
    const common = execFileSync(
      "git",
      ["rev-parse", "--path-format=absolute", "--git-common-dir"],
      {
        cwd: repositoryRoot,
        encoding: "utf8",
        windowsHide: true,
        stdio: ["ignore", "pipe", "ignore"],
      },
    ).trim();
    return dirname(common);
  } catch {
    return repositoryRoot;
  }
}

export class OutputGuardError extends Error {
  override readonly name = "OutputGuardError";
}

/**
 * Refuses to write `path` unless Git ignores it or no repository contains it.
 * Asked of Git itself (`git check-ignore`), from the nearest directory that
 * exists, so a tracked file, a negated ignore rule or a nested repository is
 * judged by the repository that would actually hold the file.
 */
export function assertOutputIgnored(path: string): void {
  let existing = dirname(resolve(path));
  while (!existsSync(existing) && dirname(existing) !== existing) existing = dirname(existing);
  const directory = realpathSync(existing);
  const target = relative(existing, resolve(path)).split("\\").join("/");
  const check = spawnSync("git", ["check-ignore", "-q", "--", target], {
    cwd: directory,
    encoding: "utf8",
    windowsHide: true,
  });
  if (check.error) {
    throw new OutputGuardError(
      `Cannot ask Git whether ${path} is ignored (${check.error.message}); install Git or set BOOKLET_OUT to a directory outside every repository.`,
    );
  }
  if (check.status === 0) return;
  if (check.status === 128 && /not a git repository/iu.test(check.stderr)) return;
  if (check.status === 1) {
    throw new OutputGuardError(
      `Refusing to write ${path}: Git does not ignore it (repository around ${directory}), and the booklet rows carry the official model's transforms, which must never be committable. Set BOOKLET_OUT to an ignored directory such as output/booklet, or to one outside the repository.`,
    );
  }
  throw new OutputGuardError(
    `Git could not say whether ${path} is ignored (exit ${check.status}: ${check.stderr.trim().slice(0, 200)}); set BOOKLET_OUT to an ignored directory such as output/booklet.`,
  );
}
