import type { Page } from "@playwright/test";

import type { BrowserCropInput, BrowserResult } from "./callout-types";

const BROWSER_MODULE_URL = "/e2e/callout-browser-crops.ts";

export function renderCalloutCropsInPage(
  page: Page,
  input: BrowserCropInput,
): Promise<BrowserResult[]> {
  return page.evaluate(
    async ({ moduleUrl, browserInput }) => {
      const module = (await import(/* @vite-ignore */ moduleUrl)) as {
        renderCalloutCrops(value: BrowserCropInput): Promise<BrowserResult[]>;
      };
      return module.renderCalloutCrops(browserInput);
    },
    { moduleUrl: BROWSER_MODULE_URL, browserInput: input },
  );
}
