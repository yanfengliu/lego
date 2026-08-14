import { describe, expect, it } from "vitest";

import {
  MAX_CALLOUT_BROWSER_RESULT_CHARACTERS,
  retainBoundedCalloutBrowserResults,
} from "./callout-browser-results";
import type { BrowserCrop, BrowserResult } from "./callout-types";

const crop = (url: string): BrowserCrop => ({ url }) as BrowserCrop;
const result = (identity: string): BrowserResult =>
  ({ identity, legacy: crop("legacy"), ranked: crop("ranked"), action: null }) as BrowserResult;

describe("bounded callout browser-result retention", () => {
  it("keeps legacy only for preregistered benchmark identities", () => {
    const retained = retainBoundedCalloutBrowserResults(
      [result("benchmark"), result("ordinary")],
      new Set(["benchmark"]),
      0,
    );
    expect(retained.results[0]!.legacy?.url).toBe("legacy");
    expect(retained.results[1]!.legacy).toBeNull();
    expect(retained.retainedCharacters).toBe("legacy".length + 2 * "ranked".length);
  });

  it("refuses before crossing the aggregate URL-character ceiling", () => {
    expect(() =>
      retainBoundedCalloutBrowserResults(
        [result("ordinary")],
        new Set(),
        MAX_CALLOUT_BROWSER_RESULT_CHARACTERS - "ranked".length + 1,
      ),
    ).toThrow(/retained PNG URL characters/u);
  });
});
