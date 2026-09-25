export const LDRAW_FRAME_ARCHIVE_PIN: {
  readonly logicalName: string;
  readonly bytes: number;
  readonly sha256: string;
};
export const DEFAULT_OFFICIAL_ARCHIVE: string;

/** Where the pinned archive is read from: LEGO_LDRAW_OFFICIAL_ARCHIVE, else the default. */
export function officialArchivePath(env?: Record<string, string | undefined>): string;

/** The pinned archive's bytes; throws unless they are exactly the pinned archive. */
export function readPinnedArchive(path: string): Buffer;
