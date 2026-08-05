import { expect, test } from "@playwright/test";

import { sha256Digest } from "./real-build-artifacts";
import { captureHighlightExclusivityRenderCases } from "./real-build-highlight-browser";
import {
  compileHighlightExclusivityCompatibility,
  verifyHighlightExclusivityCompatibility,
} from "./real-build-highlight-compatibility";
import {
  HIGHLIGHT_RENDERER_COMPATIBILITY_PATH,
  HIGHLIGHT_RENDERER_CASES_PATH,
} from "./real-build-input-files";
import { writeHighlightRendererCompatibilityArtifacts } from "./real-build-highlight-output";
import {
  BRICK_KERNEL_MODULE_URL,
  MANUAL_COMMANDS_MODULE_URL,
  RENDERING_MODULE_URL,
  workspaceModuleUrl,
} from "./workspace-module";

test("records renderer compatibility with the explicit highlight policy", async ({ page }) => {
  test.skip(
    process.env.LEGO_UPDATE_HIGHLIGHT_COMPATIBILITY !== "1",
    "Retained compatibility evidence is regenerated only by an explicit evidence-update run.",
  );
  test.setTimeout(120_000);
  await page.goto("/");
  const renderCasesBytes = await captureHighlightExclusivityRenderCases(page, {
    contractUrl: workspaceModuleUrl("apps/web/e2e/real-build-contract.ts"),
    kernelUrl: BRICK_KERNEL_MODULE_URL,
    commandsUrl: MANUAL_COMMANDS_MODULE_URL,
    renderingUrl: RENDERING_MODULE_URL,
  });
  const compiled = compileHighlightExclusivityCompatibility(renderCasesBytes);
  const renderCasesDigest = sha256Digest(renderCasesBytes);
  const compatibilityDigest = sha256Digest(compiled.summaryBytes);

  expect(
    verifyHighlightExclusivityCompatibility({
      renderCasesBytes,
      summaryBytes: compiled.summaryBytes,
      expectedRenderCasesDigest: renderCasesDigest,
      expectedCompatibilityDigest: compatibilityDigest,
    }),
  ).toEqual(compiled.summary);
  expect(compiled.summary.policyMinimumExclusiveHighlightPixelsPerPiece).toBe(8);

  writeHighlightRendererCompatibilityArtifacts({
    repoRoot: process.cwd(),
    renderCasesPath: HIGHLIGHT_RENDERER_CASES_PATH,
    compatibilityPath: HIGHLIGHT_RENDERER_COMPATIBILITY_PATH,
    renderCasesBytes,
    compatibilityBytes: compiled.summaryBytes,
  });
});
