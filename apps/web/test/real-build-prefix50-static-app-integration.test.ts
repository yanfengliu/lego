import { createHash } from "node:crypto";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { resolve } from "node:path";

import {
  createEmptyBrickDocument,
  createPartInstance,
  documentStructuralHash,
} from "@lego-studio/brick-kernel";
import { describe, expect, it } from "vitest";

import { seedRealBuildPrefix50DocumentInApp } from "../e2e/real-build-prefix50-subbuild-return-review-camera-app.ts";
import {
  runRealBuildPrefix50Step44BrowserLifecycle,
  realBuildPrefix50Step44BrowserLifecycleError,
} from "../e2e/real-build-prefix50-subbuild-return-review-browser-lifecycle.ts";

describe("first-50 static review app integration", () => {
  // Bound: the real six-asset static server and two synthetic one-brick UI imports.
  // This catches missing inspection hooks and source-only imports; it is not booklet qualification.
  it("imports two exact structures through the UI and captures all seven model views", async () => {
    const outputParent = resolve("output/playwright/step44-static-integration");
    await mkdir(outputParent, { recursive: true });
    const output = await mkdtemp(resolve(outputParent, "run-"));
    const base = createEmptyBrickDocument({ id: "synthetic-review", name: "Synthetic review" });
    const part = createPartInstance({ id: "synthetic-brick" });
    const first = {
      ...base,
      parts: [part],
      submodels: base.submodels.map((row) => ({ ...row, partIds: [part.id] })),
      steps: base.steps.map((row) => ({ ...row, partIds: [part.id] })),
    };
    const second = { ...first, parts: [{ ...part, colorId: "builtin:blue" }] };
    const result = await runRealBuildPrefix50Step44BrowserLifecycle({
      serverLogPath: resolve(output, "static-app.log"),
      execute: async ({ page }) => {
        const failures: string[] = [];
        let fileChooserCount = 0;
        page.on("filechooser", () => {
          fileChooserCount += 1;
        });
        page.on("pageerror", (error) => failures.push(error.message));
        page.on("response", (response) => {
          if (response.status() >= 400) failures.push(`${response.status()} ${response.url()}`);
        });
        try {
          await seedRealBuildPrefix50DocumentInApp(page, first, 1, "first synthetic parent");
          await seedRealBuildPrefix50DocumentInApp(page, second, 1, "second synthetic parent");
          await seedRealBuildPrefix50DocumentInApp(page, second, 1, "already matching parent");
          expect(fileChooserCount).toBe(2);
          expect(await page.evaluate(() => window.get_model_snapshot!())).toMatchObject({
            partCount: 1,
            structuralHash: documentStructuralHash(second),
            documentGloballyValid: true,
          });
          const views = await page.evaluate(() =>
            window.capture_model_views!({ scene: "model-only" }),
          );
          expect(Object.keys(views)).toEqual([
            "isometric",
            "front",
            "back",
            "left",
            "right",
            "top",
            "underside",
          ]);
          const digests = Object.values(views).map((value) => {
            expect(value).toMatch(/^data:image\/png;base64,/u);
            const bytes = Buffer.from(value.slice(value.indexOf(",") + 1), "base64");
            expect(bytes.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
            expect(bytes.byteLength).toBeGreaterThan(1000);
            return createHash("sha256").update(bytes).digest("hex");
          });
          expect(new Set(digests).size).toBeGreaterThanOrEqual(3);
          expect(failures).toEqual([]);
        } catch (error) {
          await page.screenshot({ path: resolve(output, "failure.png") });
          throw error;
        }
      },
    });
    if (result.status === "failed") throw realBuildPrefix50Step44BrowserLifecycleError(result);
    expect(result.cleanup).toEqual({
      browserClosed: true,
      browserProcessTreeClosed: true,
      serverClosed: true,
    });
    await rm(output, { recursive: true });
  }, 90_000);
});
