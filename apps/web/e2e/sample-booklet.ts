import { existsSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Locates what the booklet probes load: the pdfjs build they import into the
 * page, and the sample instruction PDF they read.
 *
 * Neither can be spelled out as a path under the checkout being tested. A git
 * worktree carries no `node_modules` and no `recipes/` of its own — it resolves
 * both from the repository it was cut from — so a hardcoded absolute path is
 * right in exactly one checkout and silently unservable everywhere else. Both
 * are resolved here instead, and the vite dev server is told to serve them.
 */

const require = createRequire(import.meta.url);

/** Absolute path with forward slashes, which is the form vite's `/@fs/` prefix takes. */
function toPosix(path: string): string {
  return path.replaceAll("\\", "/");
}

export const PDFJS_MODULE_PATH = toPosix(require.resolve("pdfjs-dist/build/pdf.mjs"));
export const PDFJS_WORKER_PATH = toPosix(require.resolve("pdfjs-dist/build/pdf.worker.mjs"));

const SAMPLE_BOOKLET = "recipes/6651557.pdf";
/** Deep enough to climb out of `apps/web/e2e` inside `.claude/worktrees/<name>`. */
const SEARCH_DEPTH = 12;

/** The sample booklet is large and uncommitted, so every caller must tolerate its absence. */
function findSampleBooklet(): string | null {
  let directory = dirname(fileURLToPath(import.meta.url));
  for (let depth = 0; depth < SEARCH_DEPTH; depth += 1) {
    const candidate = resolve(directory, SAMPLE_BOOKLET);
    if (existsSync(candidate)) return toPosix(candidate);
    const parent = dirname(directory);
    if (parent === directory) break;
    directory = parent;
  }
  return null;
}

export const SAMPLE_BOOKLET_PATH = findSampleBooklet();
export const hasSampleBooklet = SAMPLE_BOOKLET_PATH !== null;

export function fsUrl(absolutePath: string): string {
  return `/@fs/${absolutePath}`;
}

/** What a probe needs handed into the page to open the sample booklet. */
export function bookletProbeUrls(): {
  readonly pdfjsUrl: string;
  readonly workerUrl: string;
  readonly pdfUrl: string;
  readonly expectedSourceBytes: number;
} {
  if (SAMPLE_BOOKLET_PATH === null) {
    throw new Error(
      `No sample booklet: ${SAMPLE_BOOKLET} was not found in this checkout or any of its ${SEARCH_DEPTH} parent directories. Probes that need it must skip when hasSampleBooklet is false.`,
    );
  }
  return {
    pdfjsUrl: fsUrl(PDFJS_MODULE_PATH),
    workerUrl: fsUrl(PDFJS_WORKER_PATH),
    pdfUrl: fsUrl(SAMPLE_BOOKLET_PATH),
    expectedSourceBytes: statSync(SAMPLE_BOOKLET_PATH).size,
  };
}

/** Directories the dev server must serve beyond its own root, for `fs.allow`. */
export function servableRoots(): readonly string[] {
  const pdfjsPackage = dirname(dirname(PDFJS_MODULE_PATH));
  return SAMPLE_BOOKLET_PATH === null
    ? [pdfjsPackage]
    : [pdfjsPackage, dirname(SAMPLE_BOOKLET_PATH)];
}
