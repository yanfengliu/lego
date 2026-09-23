import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import {
  createEmptyBrickDocument,
  createPartInstance,
  documentStructuralHash,
} from "@lego-studio/brick-kernel";
import { type Page } from "playwright";
import ts from "typescript";
import { afterEach, describe, expect, it, vi } from "vitest";

import { RealBuildStep44CalibrationRequestRefusal } from "../e2e/real-build-prefix50-step44-calibration-request-policy.ts";
import {
  runRealBuildPrefix50Step44TwoPhaseCalibrationBrowserLifecycle as runPhases,
  type RealBuildPrefix50Step44BrowserLifecycleResult,
} from "../e2e/real-build-prefix50-subbuild-return-review-browser-lifecycle.ts";
import { seedRealBuildPrefix50DocumentInApp } from "../e2e/real-build-prefix50-subbuild-return-review-camera-app.ts";
import {
  calibrationPolicyCanary,
  calibrationPolicyOutput,
  writeCalibrationPolicyEvidence,
  mockCalibrationPhaseTransport,
  holdFirstCalibrationRequestMetadata,
} from "./real-build-prefix50-step44-calibration-browser-fixture.ts";

const closed = { browserClosed: true, browserProcessTreeClosed: true, serverClosed: true };
function policyRefusal(result: RealBuildPrefix50Step44BrowserLifecycleResult<unknown>) {
  return result.status === "failed"
    ? ([result.primaryError, ...result.cleanupErrors].find(
        (error) => error instanceof RealBuildStep44CalibrationRequestRefusal,
      ) as RealBuildStep44CalibrationRequestRefusal | undefined)
    : undefined;
}
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("calibration no-live-context source transition", () => {
  // Bound: synthetic source-entry counter, real lifecycle/policy, fake transport failures,
  // and owned loopback browser controls. No counter is a source capability or qualification.
  it("orders actual first-context close before transition and fresh validation context", async () => {
    const transport = mockCalibrationPhaseTransport();
    const output = await calibrationPolicyOutput("ordering-unit");
    const state = Object.freeze({ synthetic: true });
    const result = await runPhases({
      serverLogPath: resolve(output, "static-app.log"),
      calibrate: async () => {
        transport.events.push("calibrate");
        return state;
      },
      afterCalibrationClosed: async (received) => {
        expect(received).toBe(state);
        expect(transport.contexts[0]!.page.isClosed()).toBe(true);
        expect(transport.contexts[0]!.page.context().pages()).toEqual([]);
        transport.events.push("consume");
        return {
          status: "validate",
          execute: async () => {
            transport.events.push("validate");
            return "done";
          },
        };
      },
    });
    expect(result).toEqual({ status: "complete", value: "done", cleanup: closed });
    expect(transport.events).toEqual([
      "spawn-static-app-server",
      "spawn-playwright-browser-worker",
      "context-1",
      "calibrate",
      "close-1",
      "consume",
      "context-2",
      "validate",
      "close-2",
      "browser-close",
      "stop-playwright-browser-worker",
      "stop-static-app-server",
    ]);
  });

  it.each(["callback", "policy", "context-close"] as const)(
    "prevents transition and second context after %s failure",
    async (failure) => {
      const transport = mockCalibrationPhaseTransport(
        failure === "context-close" ? failure : undefined,
      );
      const output = await calibrationPolicyOutput(`failure-${failure}`);
      let consumeCount = 0;
      const result = await runPhases({
        serverLogPath: resolve(output, "static-app.log"),
        calibrate: async () => {
          if (failure === "callback") throw new Error("Synthetic calibration failed.");
          if (failure === "policy") await transport.contexts[0]!.request();
        },
        afterCalibrationClosed: async () => {
          consumeCount += 1;
          return { status: "validate", execute: async () => "unexpected" };
        },
      });
      expect(result.status).toBe("failed");
      expect(consumeCount).toBe(0);
      expect(transport.contexts).toHaveLength(1);
      expect(transport.events).toContain("stop-static-app-server");
      if (failure === "policy") expect(policyRefusal(result)).toBeDefined();
    },
  );

  it("ends refused calibration without consumption or second context", async () => {
    const transport = mockCalibrationPhaseTransport();
    const output = await calibrationPolicyOutput("refused-calibration");
    let consumeCount = 0;
    const result = await runPhases({
      serverLogPath: resolve(output, "static-app.log"),
      calibrate: async () => ({ status: "refused" as const }),
      afterCalibrationClosed: async (state) => {
        if (state.status === "refused") return { status: "complete", value: "refused" };
        consumeCount += 1;
        throw new Error("Unexpected qualification.");
      },
    });
    expect(result).toEqual({ status: "complete", value: "refused", cleanup: closed });
    expect(consumeCount).toBe(0);
    expect(transport.contexts).toHaveLength(1);
  });

  it.each(["validation", "browser-close", "browser-tree", "server"] as const)(
    "fails %s without retrying the consumed opportunity",
    async (failure) => {
      const transport = mockCalibrationPhaseTransport(
        failure === "validation" ? undefined : failure,
      );
      const output = await calibrationPolicyOutput(`failure-${failure}`);
      let consumeCount = 0;
      const result = await runPhases({
        serverLogPath: resolve(output, "static-app.log"),
        calibrate: async () => "synthetic calibration",
        afterCalibrationClosed: async () => {
          consumeCount += 1;
          return {
            status: "validate",
            execute: async () => {
              if (failure === "validation") throw new Error("Synthetic validation failed.");
              return "synthetic validation";
            },
          };
        },
      });
      expect(result.status).toBe("failed");
      expect(consumeCount).toBe(1);
      expect(transport.contexts).toHaveLength(2);
      expect(transport.events).toContain("stop-static-app-server");
      if (failure === "browser-tree") expect(result.cleanup.browserProcessTreeClosed).toBe(false);
      if (failure === "server") expect(result.cleanup.serverClosed).toBe(false);
      if (failure === "browser-close") expect(result.cleanup.browserClosed).toBe(false);
    },
  );

  it("keeps the real gate's sole genuine consumer inside afterCalibrationClosed", async () => {
    const path =
      "apps/web/e2e/real-build-prefix50-subbuild-return-review-camera-real-domain-gate.ts";
    const source = ts.createSourceFile(
      path,
      await readFile(path, "utf8"),
      ts.ScriptTarget.Latest,
      true,
    );
    let count = 0;
    const visit = (node: ts.Node) => {
      if (
        ts.isCallExpression(node) &&
        ts.isIdentifier(node.expression) &&
        node.expression.text === "consumeRealBuildPrefix50Step44CalibrationSessionForHeldOut"
      ) {
        count += 1;
        let parent: ts.Node | undefined = node.parent;
        while (parent !== undefined && !ts.isPropertyAssignment(parent)) parent = parent.parent;
        expect(
          parent !== undefined && ts.isPropertyAssignment(parent) && parent.name.getText(source),
        ).toBe("afterCalibrationClosed");
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
    expect(count).toBe(1);
  });

  it("refuses source-stage entry after a caught real calibration request refusal", async () => {
    const output = await calibrationPolicyOutput("caught-refusal");
    const canary = await calibrationPolicyCanary();
    let consumeCount = 0;
    let result;
    try {
      result = await runPhases({
        serverLogPath: resolve(output, "static-app.log"),
        calibrate: async ({ page }) => {
          await page.evaluate(async (url) => {
            try {
              await fetch(url);
            } catch {
              /* deliberately caught */
            }
          }, canary.url);
        },
        afterCalibrationClosed: async () => {
          consumeCount += 1;
          return { status: "validate", execute: async () => "unexpected" };
        },
      });
    } finally {
      await canary.close();
    }
    await writeCalibrationPolicyEvidence(output, {
      consumeCount,
      result,
      canary: canary.counts(),
      refusal: policyRefusal(result)?.counts,
    });
    expect(policyRefusal(result)?.counts["foreign-origin"]).toBe(1);
    expect(consumeCount).toBe(0);
    expect(result.cleanup).toEqual(closed);
    expect(canary.counts()).toEqual({ httpHits: 0, upgradeHits: 0, closed: true });
  }, 90_000);

  it("drains a real tracked in-flight request after context cancellation before transition", async () => {
    const output = await calibrationPolicyOutput("in-flight");
    const canary = await calibrationPolicyCanary();
    const held = holdFirstCalibrationRequestMetadata();
    let consumeCount = 0;
    const running = runPhases({
      serverLogPath: resolve(output, "static-app.log"),
      calibrate: async ({ page }) => {
        await page.evaluate((url) => {
          void fetch(url).catch(() => undefined);
        }, canary.url);
        await held.started.promise;
      },
      afterCalibrationClosed: async () => {
        consumeCount += 1;
        return { status: "validate", execute: async () => "unexpected" };
      },
    });
    let timer: ReturnType<typeof setTimeout> | undefined;
    let result;
    try {
      await Promise.race([
        held.contextClosed.promise,
        new Promise<never>((_, reject) => {
          timer = setTimeout(
            () =>
              reject(new Error("Context close did not settle while request metadata was held.")),
            15_000,
          );
        }),
      ]);
      expect(consumeCount).toBe(0);
      expect(held.contextCount()).toBe(1);
    } finally {
      clearTimeout(timer);
      held.release.resolve();
      result = await running;
      await canary.close();
      await writeCalibrationPolicyEvidence(output, {
        consumeCount,
        contextCount: held.contextCount(),
        result,
        canary: canary.counts(),
        refusal: policyRefusal(result)?.counts,
      });
    }
    expect(policyRefusal(result)?.counts["route-error"]).toBeGreaterThan(0);
    expect(consumeCount).toBe(0);
    expect(held.contextCount()).toBe(1);
    expect(result.cleanup).toEqual(closed);
    expect(canary.counts()).toEqual({ httpHits: 0, upgradeHits: 0, closed: true });
  }, 90_000);

  it("either refuses or cancels a scheduled request when destroying its context", async () => {
    const output = await calibrationPolicyOutput("scheduled-race");
    const canary = await calibrationPolicyCanary();
    let firstPage: Page | undefined;
    let observedRequests = 0;
    let consumeCount = 0;
    let result;
    try {
      result = await runPhases({
        serverLogPath: resolve(output, "static-app.log"),
        calibrate: async ({ page }) => {
          firstPage = page;
          page.on("request", (request) => {
            if (request.url() === canary.url) observedRequests += 1;
          });
          await page.evaluate((url) => {
            setTimeout(() => {
              void fetch(url).catch(() => undefined);
            }, 0);
          }, canary.url);
        },
        afterCalibrationClosed: async () => {
          expect(firstPage!.isClosed()).toBe(true);
          expect(firstPage!.context().pages()).toEqual([]);
          consumeCount += 1;
          return { status: "complete", value: "synthetic transition" };
        },
      });
    } finally {
      await canary.close();
    }
    const refusal = policyRefusal(result);
    await writeCalibrationPolicyEvidence(output, {
      consumeCount,
      observedRequests,
      result,
      canary: canary.counts(),
      outcome: refusal
        ? "explicit-policy-refusal"
        : "canceled-or-unobserved-before-context-destruction",
      refusal: refusal?.counts,
    });
    expect(consumeCount).toBe(refusal ? 0 : 1);
    expect(result.cleanup).toEqual(closed);
    expect(canary.counts()).toEqual({ httpHits: 0, upgradeHits: 0, closed: true });
  }, 90_000);

  it("imports in two distinct contexts and captures seven native validation views", async () => {
    const output = await calibrationPolicyOutput("two-context-positive");
    const base = createEmptyBrickDocument({ id: "synthetic-review", name: "Synthetic review" });
    const part = createPartInstance({ id: "synthetic-brick" });
    const first = {
      ...base,
      parts: [part],
      submodels: base.submodels.map((row) => ({ ...row, partIds: [part.id] })),
      steps: base.steps.map((row) => ({ ...row, partIds: [part.id] })),
    };
    const second = { ...first, parts: [{ ...part, colorId: "builtin:blue" }] };
    let firstPage!: Page;
    let firstImports = 0;
    let secondImports = 0;
    let consumeCount = 0;
    const captures: { name: string; sha256: string; bytes: number }[] = [];
    const failures: string[] = [];
    const observe = (page: Page) => {
      page.on("pageerror", () => failures.push("page-error"));
      page.on("response", (response) => {
        if (response.status() >= 400) failures.push("http-error");
      });
    };
    const result = await runPhases({
      serverLogPath: resolve(output, "real-domain-camera-static-app.log"),
      calibrate: async ({ page }) => {
        firstPage = page;
        observe(page);
        page.on("filechooser", () => {
          firstImports += 1;
        });
        await seedRealBuildPrefix50DocumentInApp(page, first, 1, "first synthetic parent");
        await seedRealBuildPrefix50DocumentInApp(page, second, 1, "second synthetic parent");
        return second;
      },
      afterCalibrationClosed: async (state) => {
        expect(state).toBe(second);
        expect(firstPage.isClosed()).toBe(true);
        expect(firstPage.context().pages()).toEqual([]);
        consumeCount += 1;
        return {
          status: "validate",
          execute: async ({ page }) => {
            expect(page.context()).not.toBe(firstPage.context());
            expect(page.viewportSize()).toEqual({ width: 1280, height: 720 });
            observe(page);
            page.on("filechooser", () => {
              secondImports += 1;
            });
            await seedRealBuildPrefix50DocumentInApp(page, state, 1, "fresh validation parent");
            await seedRealBuildPrefix50DocumentInApp(
              page,
              state,
              1,
              "already matching validation parent",
            );
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
            for (const [name, value] of Object.entries(views)) {
              expect(value).toMatch(/^data:image\/png;base64,/u);
              const bytes = Buffer.from(value.slice(value.indexOf(",") + 1), "base64");
              await writeFile(resolve(output, `${name}.png`), bytes, { flag: "wx" });
              captures.push({
                name,
                sha256: createHash("sha256").update(bytes).digest("hex"),
                bytes: bytes.length,
              });
            }
            return "synthetic validation";
          },
        };
      },
    });
    await writeCalibrationPolicyEvidence(output, {
      result,
      consumeCount,
      firstImports,
      secondImports,
      captures,
      failures,
    });
    expect(result).toMatchObject({ status: "complete", cleanup: closed });
    expect({ consumeCount, firstImports, secondImports }).toEqual({
      consumeCount: 1,
      firstImports: 2,
      secondImports: 1,
    });
    expect(captures).toHaveLength(7);
    expect(failures).toEqual([]);
  }, 90_000);
});
