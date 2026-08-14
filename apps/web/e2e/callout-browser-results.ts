import type { BrowserCrop, BrowserResult } from "./callout-types";

export const MAX_CALLOUT_BROWSER_RESULT_CHARACTERS = 64 * 1024 * 1024;

const cropCharacters = (crop: BrowserCrop | null): number => crop?.url.length ?? 0;

/** Drops unneeded legacy alternatives and charges every retained PNG URL before accumulation. */
export function retainBoundedCalloutBrowserResults(
  results: readonly BrowserResult[],
  keepLegacyIdentities: ReadonlySet<string>,
  alreadyRetainedCharacters: number,
): { readonly results: readonly BrowserResult[]; readonly retainedCharacters: number } {
  if (
    !Array.isArray(results) ||
    results.length < 1 ||
    results.length > 16 ||
    !Number.isSafeInteger(alreadyRetainedCharacters) ||
    alreadyRetainedCharacters < 0 ||
    alreadyRetainedCharacters > MAX_CALLOUT_BROWSER_RESULT_CHARACTERS
  ) {
    throw new Error(
      `Callout browser results require 1..16 rows and a prior character charge in 0..${MAX_CALLOUT_BROWSER_RESULT_CHARACTERS}.`,
    );
  }
  const retained: BrowserResult[] = [];
  let characters = alreadyRetainedCharacters;
  for (let index = 0; index < results.length; index += 1) {
    const result = results[index]!;
    const kept = keepLegacyIdentities.has(result.identity) ? result : { ...result, legacy: null };
    const next =
      characters +
      cropCharacters(kept.legacy) +
      cropCharacters(kept.ranked) +
      cropCharacters(kept.action);
    if (!Number.isSafeInteger(next) || next > MAX_CALLOUT_BROWSER_RESULT_CHARACTERS) {
      throw new Error(
        `Callout browser results exceed ${MAX_CALLOUT_BROWSER_RESULT_CHARACTERS} retained PNG URL characters at ${result.identity}.`,
      );
    }
    characters = next;
    retained.push(kept);
  }
  return { results: retained, retainedCharacters: characters };
}
