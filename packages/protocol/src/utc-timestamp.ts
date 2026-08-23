import type { UtcTimestamp } from "./generated/public-types.generated.js";

const CANONICAL_UTC_TIMESTAMP_COMPONENTS =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})\.(\d{3})Z$/u;

function leapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

/**
 * Checks the one signed-wire spelling `YYYY-MM-DDTHH:mm:ss.sssZ` without
 * parsing, normalizing, or replacing the caller's bytes.
 */
export function isCanonicalUtcTimestamp(value: unknown): value is UtcTimestamp {
  if (typeof value !== "string") return false;
  const match = CANONICAL_UTC_TIMESTAMP_COMPONENTS.exec(value);
  if (match === null) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  if (month < 1 || month > 12 || hour > 23 || minute > 59 || second > 59) return false;
  const days = [31, leapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day >= 1 && day <= days[month - 1]!;
}
