export interface TarOptions {
  /** The tar to run; defaults to `tarExecutable()`. */
  readonly executable?: string;
  readonly maxBuffer?: number;
}

export function tarExecutable(): string;

export function extractTarArchive(
  archivePath: string,
  destination: string,
  options?: TarOptions,
): void;

export function readArchiveMember(
  archivePath: string,
  memberPath: string,
  options?: TarOptions,
): Buffer;
