import { canonicalDigest } from "@lego-studio/brick-kernel";
import type { Page } from "playwright";

interface CameraOnlyProbeSnapshot {
  readonly partCount: unknown;
  readonly structuralHash: unknown;
  readonly documentGloballyValid: unknown;
}

interface CameraOnlyProbeCall {
  readonly request: Readonly<Record<string, unknown>>;
  readonly before: CameraOnlyProbeSnapshot | null;
  readonly after: CameraOnlyProbeSnapshot | null;
  readonly outputWidth: unknown;
  readonly outputHeight: unknown;
}

export interface CameraOnlyProbe {
  readonly calls: readonly CameraOnlyProbeCall[];
}

export interface CameraOnlyRuntimeState {
  readonly snapshot: CameraOnlyProbeSnapshot;
  readonly probe: unknown;
}

function requireCondition(condition: unknown, message: string): asserts condition {
  if (!condition) throw new TypeError(message);
}

function sameValue(left: unknown, right: unknown): boolean {
  return canonicalDigest(left) === canonicalDigest(right);
}

export async function installCameraOnlyProbe(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const state: { calls: unknown[] } = { calls: [] };
    Object.defineProperty(window, "__step44_camera_only_gate_probe", {
      configurable: false,
      enumerable: false,
      value: state,
      writable: false,
    });
    let implementation: unknown;
    Object.defineProperty(window, "capture_instruction_view", {
      configurable: true,
      enumerable: true,
      get: () => implementation,
      set: (value: unknown) => {
        implementation =
          typeof value !== "function"
            ? value
            : async (request: unknown) => {
                const before = window.get_model_snapshot?.() ?? null;
                const output = (await Reflect.apply(value, window, [request])) as {
                  readonly width?: unknown;
                  readonly height?: unknown;
                };
                const after = window.get_model_snapshot?.() ?? null;
                state.calls.push({
                  request,
                  before,
                  after,
                  outputWidth: output.width,
                  outputHeight: output.height,
                });
                return output;
              };
      },
    });
  });
  await page.reload();
  await page.waitForFunction(
    () =>
      typeof window.get_model_snapshot === "function" &&
      typeof window.capture_instruction_view === "function",
  );
}

export async function captureCameraOnlyRuntimeState(page: Page): Promise<CameraOnlyRuntimeState> {
  const snapshot = await page.evaluate(() => window.get_model_snapshot!());
  const probe = await page.evaluate(
    () =>
      (
        window as typeof window & {
          __step44_camera_only_gate_probe?: unknown;
        }
      ).__step44_camera_only_gate_probe,
  );
  return { snapshot, probe };
}

export function requireCameraOnlyProbe(input: {
  readonly value: unknown;
  readonly expectedBeautyAlignmentRenderCount: number;
  readonly semanticTargetColorIds: readonly string[];
  readonly parentHash: string;
}): CameraOnlyProbe {
  requireCondition(
    input.value !== null && typeof input.value === "object" && !Array.isArray(input.value),
    "Camera-only Step-44 render probe is absent.",
  );
  const probe = input.value as CameraOnlyProbe;
  const expectedTotalCaptureCount = input.expectedBeautyAlignmentRenderCount + 17;
  requireCondition(
    Array.isArray(probe.calls) && probe.calls.length === expectedTotalCaptureCount,
    `Camera-only Step-44 probe observed ${String(probe.calls?.length)}, not ${expectedTotalCaptureCount}, total captures.`,
  );
  let beautyCaptureCount = 0;
  let semanticCaptureCount = 0;
  for (const [index, call] of probe.calls.entries()) {
    requireCondition(
      call !== null && typeof call === "object" && !Array.isArray(call),
      `Camera-only Step-44 probe call ${index} is malformed.`,
    );
    const request = call.request;
    const frame = request.frame as Readonly<Record<string, unknown>> | undefined;
    if (request.renderMode === "instruction-art") {
      beautyCaptureCount += 1;
      requireCondition(
        request.targetColorIds === undefined,
        `Camera-only Step-44 beauty probe call ${index} unexpectedly carried semantic targets.`,
      );
    } else if (request.renderMode === "semantic-color-id-mask") {
      semanticCaptureCount += 1;
      requireCondition(
        sameValue(request.targetColorIds, input.semanticTargetColorIds),
        `Camera-only Step-44 semantic probe call ${index} drifted from the exact target color IDs.`,
      );
    } else {
      throw new TypeError(`Camera-only Step-44 probe call ${index} has an unknown render mode.`);
    }
    requireCondition(
      request.scene === "model-only" &&
        request.backgroundHex === 0x899093 &&
        frame?.widthPx === 720 &&
        frame.heightPx === 470,
      `Camera-only Step-44 probe call ${index} was not one exact model-only 720x470 camera request.`,
    );
    for (const [phase, snapshot] of [
      ["before", call.before],
      ["after", call.after],
    ] as const)
      requireCondition(
        snapshot?.partCount === 257 &&
          snapshot.structuralHash === input.parentHash &&
          snapshot.documentGloballyValid === true,
        `Camera-only Step-44 probe call ${index} ${phase} state was not the exact hard-valid 257-part parent.`,
      );
    requireCondition(
      call.outputWidth === 720 && call.outputHeight === 470,
      `Camera-only Step-44 probe call ${index} returned a non-720x470 raster.`,
    );
  }
  requireCondition(
    beautyCaptureCount === input.expectedBeautyAlignmentRenderCount + 1 &&
      semanticCaptureCount === 16,
    `Camera-only Step-44 probe observed ${beautyCaptureCount} beauty and ${semanticCaptureCount} semantic captures; expected ${input.expectedBeautyAlignmentRenderCount + 1} and 16.`,
  );
  return probe;
}
