/**
 * LDraw mould suffixes that name physically distinct variants in this catalog.
 *
 * Most legacy aliases use a trailing letter for an interchangeable mould
 * revision, but these families distinguish observable construction semantics.
 * Callers may match the exact suffixed alias; they must not add or remove its
 * suffix to manufacture an identity the source did not publish.
 */
export const NON_INTERCHANGEABLE_LDRAW_MOULD_BASES: readonly string[] = Object.freeze([
  "2453",
  "3245",
]);

export function isInterchangeableLdrawMouldRevisionBase(base: string): boolean {
  return /^\d+$/u.test(base) && !NON_INTERCHANGEABLE_LDRAW_MOULD_BASES.includes(base);
}
