export interface ExactLdrawArchive {
  readonly entryCount: number;
  /** A member's bytes by its path in the archive (case-insensitive, "/" or "\\"); throws a TypeError naming a missing member. */
  read(filename: string): Buffer;
}

export function openExactLdrawArchive(bytes: Uint8Array): ExactLdrawArchive;
