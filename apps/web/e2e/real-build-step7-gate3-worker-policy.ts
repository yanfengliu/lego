import type { Page } from "@playwright/test";

export const STEP7_GATE3_WORKER_CONTROL_PATH = "/__real_build_worker_control__.mjs";

export const STEP7_GATE3_PDF_WORKER_CONTENT_SECURITY_POLICY = [
  "default-src 'none'",
  "connect-src 'none'",
  "script-src 'self'",
  "worker-src 'none'",
].join("; ");

export const STEP7_GATE3_WORKER_CONTROL_SOURCE = `
let evalBlocked = false;
let evalFailureName = null;
const sharedWorkerConstructorPresent = typeof globalThis.SharedWorker === "function";
let sharedWorkerBlocked = false;
let sharedWorkerFailureName = null;
try {
  Reflect.apply(globalThis.eval, globalThis, ["1"]);
} catch (error) {
  evalBlocked = true;
  evalFailureName = error instanceof Error ? error.name : "non-Error";
}
if (sharedWorkerConstructorPresent) {
  try {
    const sharedWorker = new globalThis.SharedWorker("${STEP7_GATE3_WORKER_CONTROL_PATH}", {
      type: "module",
    });
    sharedWorker.port.close();
  } catch (error) {
    sharedWorkerBlocked = true;
    sharedWorkerFailureName = error instanceof Error ? error.name : "non-Error";
  }
} else {
  sharedWorkerBlocked = true;
  sharedWorkerFailureName = "Unavailable";
}
globalThis.postMessage({
  schemaVersion: "lego.step7-gate3-worker-policy-control/1",
  evalBlocked,
  evalFailureName,
  sharedWorkerConstructorPresent,
  sharedWorkerBlocked,
  sharedWorkerFailureName,
});
`;

export interface Step7Gate3WorkerExecutionPolicyControl {
  readonly schemaVersion: "lego.step7-gate3-worker-policy-control/1";
  readonly evalBlocked: true;
  readonly evalFailureName: "EvalError";
  readonly sharedWorkerConstructorPresent: boolean;
  readonly sharedWorkerBlocked: true;
  readonly sharedWorkerFailureName: "SecurityError" | "Unavailable";
}

/** Executes outside Playwright's evaluator in a response-CSP-governed module worker. */
export async function runStep7Gate3WorkerExecutionPolicyControl(
  page: Page,
): Promise<Step7Gate3WorkerExecutionPolicyControl> {
  const result = await page.evaluate(
    async ({ controlPath }) =>
      new Promise<unknown>((resolve, reject) => {
        const worker = new Worker(controlPath, {
          name: "lego-step7-gate3-policy-control",
          type: "module",
        });
        const timeout = setTimeout(() => {
          worker.terminate();
          reject(new Error("Gate-3 worker execution-policy control timed out."));
        }, 5_000);
        worker.addEventListener(
          "message",
          (event) => {
            clearTimeout(timeout);
            resolve(event.data);
          },
          { once: true },
        );
        worker.addEventListener(
          "error",
          () => {
            clearTimeout(timeout);
            worker.terminate();
            reject(new Error("Gate-3 worker execution-policy control failed to execute."));
          },
          { once: true },
        );
      }),
    { controlPath: STEP7_GATE3_WORKER_CONTROL_PATH },
  );
  if (
    typeof result !== "object" ||
    result === null ||
    Object.getPrototypeOf(result) !== Object.prototype ||
    Object.keys(result).sort().join(",") !==
      "evalBlocked,evalFailureName,schemaVersion,sharedWorkerBlocked,sharedWorkerConstructorPresent,sharedWorkerFailureName" ||
    (result as { readonly schemaVersion?: unknown }).schemaVersion !==
      "lego.step7-gate3-worker-policy-control/1" ||
    (result as { readonly evalBlocked?: unknown }).evalBlocked !== true ||
    (result as { readonly evalFailureName?: unknown }).evalFailureName !== "EvalError" ||
    (result as { readonly sharedWorkerBlocked?: unknown }).sharedWorkerBlocked !== true ||
    (result as { readonly sharedWorkerConstructorPresent?: unknown })
      .sharedWorkerConstructorPresent !==
      ((result as { readonly sharedWorkerFailureName?: unknown }).sharedWorkerFailureName ===
        "SecurityError") ||
    !["SecurityError", "Unavailable"].includes(
      (result as { readonly sharedWorkerFailureName?: string }).sharedWorkerFailureName ?? "",
    )
  ) {
    throw new TypeError(
      `Gate-3 worker execution-policy control returned ${JSON.stringify(result)}; an exact CSP EvalError refusal is required.`,
    );
  }
  return Object.freeze(result) as Step7Gate3WorkerExecutionPolicyControl;
}
