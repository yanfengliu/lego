export const MAX_JSON_ARTIFACT_BYTES: number;
export const MAX_IMAGE_ARTIFACT_BYTES: number;
export const MAX_DIRECTORY_ENTRIES: number;
export const MAX_CHILD_STDOUT_BYTES: number;
export const MAX_CHILD_STDERR_BYTES: number;
export const CHILD_TIMEOUT_MS: number;
export const MAX_NODE_TIMER_MS: 2147483647;

/** @internal Cross-platform file-identity comparison; a zero device id is unavailable, not unequal. */
export function sameFileIdentity(
  left: { readonly dev: number | bigint; readonly ino: number | bigint },
  right: { readonly dev: number | bigint; readonly ino: number | bigint },
): boolean;

export function assertCanonicalRelativePath(value: unknown, label?: string): string;

export function readBoundedFile(
  path: string,
  options?: { readonly maxBytes?: number; readonly label?: string },
): Buffer;

export function readContainedFile(
  root: string,
  relativePath: string,
  options?: {
    readonly maxBytes?: number;
    readonly label?: string;
    readonly inheritFds?: readonly number[];
    readonly pathLabel?: string;
    readonly rootLabel?: string;
    /** Test-only race seam; production callers leave this absent. */
    readonly __testHooks?: { readonly afterPreflight?: () => void };
  },
): Buffer;

export function boundedDirectoryFiles(
  root: string,
  options?: { readonly maxEntries?: number; readonly label?: string },
): string[];

export function writeContainedFile(
  root: string,
  relativePath: string,
  bytes: Uint8Array | string,
  options?: {
    readonly maxBytes?: number;
    readonly label?: string;
    readonly pathLabel?: string;
    readonly rootLabel?: string;
    /** Test-only race seams; production callers leave these absent. */
    readonly __testHooks?: {
      readonly afterPreflight?: () => void;
      readonly afterTemporaryWrite?: () => void;
      readonly afterRename?: () => void;
      readonly beforeExactCleanup?: (state: {
        readonly path: string;
        readonly published: boolean;
      }) => void;
    };
  },
): void;

export function runBoundedChild(
  command: string,
  args: readonly string[],
  options?: {
    readonly cwd?: string;
    readonly env?: NodeJS.ProcessEnv;
    readonly timeoutMs?: number;
    readonly maxStdoutBytes?: number;
    readonly maxStderrBytes?: number;
    readonly label?: string;
    readonly spawnImpl?: (...args: unknown[]) => unknown;
  },
): Promise<{
  readonly code: number | null;
  readonly signal: NodeJS.Signals | null;
  readonly stdout: string;
  readonly stderr: string;
}>;
