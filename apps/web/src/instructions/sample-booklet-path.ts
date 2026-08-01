import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";

/**
 * Locates the uncommitted sample booklet the scoreboards are driven against.
 *
 * Resolving it against the working directory is right in one checkout and wrong
 * in every worktree, which have no `recipes/` of their own and keep the sample
 * in the repository they were cut from. A scoreboard that resolves it that way
 * does not fail — it writes "skipped" and reports nothing, which reads exactly
 * like a booklet nobody has downloaded yet. So the search climbs instead.
 */
const SAMPLE = "recipes/6651557.pdf";
/** Deep enough to climb out of `apps/web/src/instructions` inside a worktree. */
const SEARCH_DEPTH = 12;

export const SAMPLE_BOOKLET = SAMPLE;

export function findSampleBooklet(from: string = process.cwd()): string | null {
  let directory = from;
  for (let depth = 0; depth < SEARCH_DEPTH; depth += 1) {
    const candidate = resolve(directory, SAMPLE);
    if (existsSync(candidate)) return candidate;
    const parent = dirname(directory);
    if (parent === directory) break;
    directory = parent;
  }
  return null;
}
