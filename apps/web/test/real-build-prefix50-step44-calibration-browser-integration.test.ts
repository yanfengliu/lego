import { createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import {
  createEmptyBrickDocument,
  createPartInstance,
  documentStructuralHash,
} from "@lego-studio/brick-kernel";
import { describe, expect, it } from "vitest";

import { RealBuildStep44CalibrationRequestRefusal } from "../e2e/real-build-prefix50-step44-calibration-request-policy.ts";
import { runRealBuildPrefix50Step44CalibrationBrowserLifecycle } from "../e2e/real-build-prefix50-subbuild-return-review-browser-lifecycle.ts";
import { seedRealBuildPrefix50DocumentInApp } from "../e2e/real-build-prefix50-subbuild-return-review-camera-app.ts";
import {
  calibrationPolicyCanary,
  calibrationPolicyFileSentinel,
  calibrationPolicyOutput,
  writeCalibrationPolicyEvidence,
} from "./real-build-prefix50-step44-calibration-browser-fixture.ts";

const closed = { browserClosed: true, browserProcessTreeClosed: true, serverClosed: true };
const negatives = [
  "foreign-fetch",
  "popup",
  "second-page",
  "fs-path",
  "recipe-path",
  "unknown-asset",
  "query-variant",
  "post",
  "websocket",
] as const;

describe("calibration guarded browser content", () => {
  // Bound: the frozen static app, two synthetic one-brick imports, seven native views,
  // nine explicit HTTP/WS negatives, and two owned file controls. No booklet source is read.
  it("imports two exact structures and retains all seven native model views", async () => {
    const output = await calibrationPolicyOutput("positive");
    const base = createEmptyBrickDocument({ id: "synthetic-review", name: "Synthetic review" });
    const part = createPartInstance({ id: "synthetic-brick" });
    const first = {
      ...base,
      parts: [part],
      submodels: base.submodels.map((row) => ({ ...row, partIds: [part.id] })),
      steps: base.steps.map((row) => ({ ...row, partIds: [part.id] })),
    };
    const second = { ...first, parts: [{ ...part, colorId: "builtin:blue" }] };
    const captures: { name: string; sha256: string; bytes: number }[] = [];
    const result = await runRealBuildPrefix50Step44CalibrationBrowserLifecycle({
      serverLogPath: resolve(output, "static-app.log"),
      execute: async (runtime) => {
        expect(Object.keys(runtime).sort()).toEqual(["appUrl", "page"]);
        const { page } = runtime;
        expect(page.viewportSize()).toEqual({ width: 1280, height: 720 });
        const failures: string[] = [];
        let imports = 0;
        page.on("filechooser", () => {
          imports += 1;
        });
        page.on("pageerror", () => failures.push("page-error"));
        page.on("response", (response) => {
          if (response.status() >= 400) failures.push("http-error");
        });
        await seedRealBuildPrefix50DocumentInApp(page, first, 1, "first synthetic parent");
        await seedRealBuildPrefix50DocumentInApp(page, second, 1, "second synthetic parent");
        await seedRealBuildPrefix50DocumentInApp(page, second, 1, "already matching parent");
        expect(imports).toBe(2);
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
        for (const [name, data] of Object.entries(views)) {
          expect(data).toMatch(/^data:image\/png;base64,/u);
          const bytes = Buffer.from(data.slice(data.indexOf(",") + 1), "base64");
          expect(bytes.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
          expect(bytes.byteLength).toBeGreaterThan(1000);
          await writeFile(resolve(output, `${name}.png`), bytes, { flag: "wx" });
          captures.push({
            name,
            sha256: createHash("sha256").update(bytes).digest("hex"),
            bytes: bytes.length,
          });
        }
        expect(new Set(captures.map(({ sha256 }) => sha256)).size).toBeGreaterThanOrEqual(3);
        expect(failures).toEqual([]);
        return { imports, partCount: 1, captures: captures.length };
      },
    });
    await writeCalibrationPolicyEvidence(output, { result, captures });
    expect(result).toMatchObject({ status: "complete", cleanup: closed });
  }, 90_000);

  it.each(negatives)(
    "records %s policy refusal and prevents canary delivery",
    async (name) => {
      const output = await calibrationPolicyOutput(name);
      const canary = await calibrationPolicyCanary();
      let result;
      try {
        result = await runRealBuildPrefix50Step44CalibrationBrowserLifecycle({
          serverLogPath: resolve(output, "static-app.log"),
          execute: async ({ page, appUrl }) => {
            if (name === "popup") {
              const failed = page.context().waitForEvent("requestfailed", {
                predicate: (request) => request.url() === canary.url,
                timeout: 5000,
              });
              await page.evaluate((url) => {
                window.open(url);
              }, canary.url);
              await failed;
            } else if (name === "second-page") {
              const second = await page.context().newPage();
              try {
                await second.goto(canary.url);
              } finally {
                await second.close();
              }
            } else if (name === "websocket") {
              await page.evaluate(
                async (url) =>
                  new Promise<void>((done) => {
                    const socket = new WebSocket(url.replace("http:", "ws:"));
                    const timer = setTimeout(() => {
                      socket.close();
                      done();
                    }, 5000);
                    const finish = () => {
                      clearTimeout(timer);
                      done();
                    };
                    socket.onclose = finish;
                    socket.onerror = finish;
                  }),
                canary.url,
              );
            } else {
              const paths = {
                "fs-path": "/@fs/synthetic-sentinel.txt",
                "recipe-path": "/recipes/sentinel.pdf",
                "unknown-asset": "/unreviewed-asset.js",
                "query-variant": "/index.html?sentinel=1",
                post: "/index.html",
              };
              const url = name === "foreign-fetch" ? canary.url : new URL(paths[name], appUrl).href;
              await page.evaluate(
                async ({ url, method }) => {
                  try {
                    await (await fetch(url, { method })).text();
                  } catch {
                    /* deliberately caught */
                  }
                },
                { url, method: name === "post" ? "POST" : "GET" },
              );
            }
            return "callback completed";
          },
        });
      } finally {
        await canary.close();
      }
      const errors =
        result.status === "failed" ? [result.primaryError, ...result.cleanupErrors] : [];
      const refusal = errors.find(
        (error) => error instanceof RealBuildStep44CalibrationRequestRefusal,
      );
      await writeCalibrationPolicyEvidence(output, {
        status: result.status,
        cleanup: result.cleanup,
        canaryProof: canary.proof,
        canary: canary.counts(),
        policyRefusal:
          refusal instanceof RealBuildStep44CalibrationRequestRefusal ? refusal.counts : null,
      });
      expect(canary.counts()).toEqual({ httpHits: 0, upgradeHits: 0, closed: true });
      expect(refusal).toBeInstanceOf(RealBuildStep44CalibrationRequestRefusal);
      for (const error of errors) expect(String(error)).not.toContain(canary.url);
      expect(result).toMatchObject({ status: "failed", cleanup: closed });
    },
    90_000,
  );

  it.each(["fetch", "navigation"] as const)(
    "keeps the owned file sentinel unread through %s",
    async (mode) => {
      const output = await calibrationPolicyOutput(`file-${mode}`);
      const sentinel = await calibrationPolicyFileSentinel(output);
      let readable = false;
      let attempted = false;
      let callbackCompleted = false;
      let operationRejected = false;
      const result = await runRealBuildPrefix50Step44CalibrationBrowserLifecycle({
        serverLogPath: resolve(output, "static-app.log"),
        execute: async ({ page }) => {
          attempted = true;
          if (mode === "fetch") {
            const observation = await page.evaluate(async ({ url, marker }) => {
              try {
                return {
                  readable: (await (await fetch(url)).text()).includes(marker),
                  rejected: false,
                };
              } catch {
                return { readable: false, rejected: true };
              }
            }, sentinel);
            readable = observation.readable;
            operationRejected = observation.rejected;
          } else {
            try {
              await page.goto(sentinel.url);
              readable = (await page.locator("body").innerText()).includes(sentinel.marker);
            } catch {
              operationRejected = true;
            }
          }
          callbackCompleted = true;
          return { readable };
        },
      });
      const errors =
        result.status === "failed" ? [result.primaryError, ...result.cleanupErrors] : [];
      const refusal = errors.find(
        (error) => error instanceof RealBuildStep44CalibrationRequestRefusal,
      );
      await writeCalibrationPolicyEvidence(output, {
        mode,
        independentFileRead: sentinel.proof,
        attempted,
        callbackCompleted,
        operationRejected,
        readable,
        status: result.status,
        cleanup: result.cleanup,
        outcome: readable
          ? "unresolved-file-read"
          : refusal
            ? "policy-refusal"
            : operationRejected && callbackCompleted
              ? "browser-native-refusal"
              : "unresolved-control",
        policyRefusal:
          refusal instanceof RealBuildStep44CalibrationRequestRefusal ? refusal.counts : null,
      });
      expect(result.cleanup).toEqual(closed);
      expect(attempted && callbackCompleted).toBe(true);
      expect(operationRejected).toBe(true);
      if (refusal === undefined) expect(result.status).toBe("complete");
      expect(readable, "A post-read failure cannot count as file-read prevention.").toBe(false);
    },
    90_000,
  );
});
