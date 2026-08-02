import { mkdirSync, writeFileSync } from "node:fs";

import { test, expect } from "@playwright/test";

import { RENDERING_MODULE_URL } from "./workspace-module";

const OUT = "output/cart-demo";
const WIDTH = 720;
const HEIGHT = 540;
const CART_MODULE_URL: string = "/src/physics/cart-demo.ts";
const SESSION_MODULE_URL: string = "/src/physics/simulation-session.ts";

/**
 * The wheeled cart, built and then dropped.
 *
 * Everything real: the cart is placed through the editor's own commands, the
 * assembly graph decides which parts are one body, Rapier moves them, and the
 * frames are the app's renderer drawing the poses the session reports.
 *
 * It writes frames to `output/cart-demo/` because a simulation is the one thing
 * a passing assertion genuinely cannot show you.
 */
test("builds a cart, drops it, and puts it back", async ({ page }) => {
  test.setTimeout(300_000);
  await page.goto("/");
  mkdirSync(OUT, { recursive: true });

  const result = await page.evaluate(
    async ({ renderingUrl, cartUrl, sessionUrl, width, height }) => {
      const rendering = await import(/* @vite-ignore */ renderingUrl);
      const { createCartDocument } = await import(/* @vite-ignore */ cartUrl);
      const { startSimulation } = await import(/* @vite-ignore */ sessionUrl);

      const document_ = createCartDocument();
      const renderer = rendering.createInstructionRenderer({ width, height });

      // One camera for every frame, framed on the cart at rest, so motion in
      // the frames is the cart moving and not the camera following it.
      const restScene = rendering.deriveBrickScene(document_, { finish: "instruction" });
      const frame = rendering.instructionViewFrame(restScene.bounds, width, height);
      const camera = rendering.createOrthographicViewCamera(
        {
          azimuthDegrees: 34,
          elevationDegrees: 22,
          pixelsPerUnit: 42,
          centerXPx: width / 2,
          centerYPx: height * 0.34,
        },
        frame,
      );
      restScene.dispose();

      const shoot = (
        poses?: ReadonlyMap<string, { positionLdu: number[]; rotation: number[] }>,
      ) => {
        const scene = rendering.deriveBrickScene(document_, { finish: "instruction" });
        if (poses) {
          for (const [partId, object] of scene.partObjects as Map<
            string,
            {
              position: { set(x: number, y: number, z: number): void };
              quaternion: { set(x: number, y: number, z: number, w: number): void };
              updateMatrix(): void;
            }
          >) {
            const pose = poses.get(partId);
            if (!pose) continue;
            object.position.set(
              pose.positionLdu[0]! * rendering.THREE_UNITS_PER_LDU,
              -pose.positionLdu[1]! * rendering.THREE_UNITS_PER_LDU,
              pose.positionLdu[2]! * rendering.THREE_UNITS_PER_LDU,
            );
            // Rapier reports rotation in a Y-up frame; the scene is Y-up too,
            // so only the handedness of x and z has to be undone.
            object.quaternion.set(
              -pose.rotation[0]!,
              pose.rotation[1]!,
              -pose.rotation[2]!,
              pose.rotation[3]!,
            );
            object.updateMatrix();
          }
          scene.root.updateMatrixWorld(true);
        }
        const pixels = renderer.render(scene.root, camera).slice();
        scene.dispose();
        const canvas = window.document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        canvas
          .getContext("2d")!
          .putImageData(new ImageData(new Uint8ClampedArray(pixels), width, height), 0, 0);
        return canvas.toDataURL("image/png");
      };

      const frames: { label: string; png: string }[] = [{ label: "00-rest", png: shoot() }];

      const session = await startSimulation(document_, { groundYLdu: 120 });
      const partCount = session.partPoses().size;
      const restY = session.partPoses().get(document_.parts[0]!.id)!.positionLdu[1];
      for (let shot = 1; shot <= 5; shot += 1) {
        for (let step = 0; step < 12; step += 1) session.step(1 / 60);
        frames.push({
          label: `0${shot}-t${((shot * 12) / 60).toFixed(1)}s`,
          png: shoot(session.partPoses()),
        });
      }
      const fellY = session.partPoses().get(document_.parts[0]!.id)!.positionLdu[1];
      session.dispose();

      // Leaving the session draws from the document again, which is untouched.
      frames.push({ label: "06-restored", png: shoot() });

      return {
        frames,
        partCount,
        fell: fellY - restY,
        documentUnchanged: document_.parts.length,
      };
    },
    {
      renderingUrl: RENDERING_MODULE_URL,
      cartUrl: CART_MODULE_URL,
      sessionUrl: SESSION_MODULE_URL,
      width: WIDTH,
      height: HEIGHT,
    },
  );

  for (const { label, png } of result.frames) {
    writeFileSync(`${OUT}/${label}.png`, Buffer.from(png.split(",")[1]!, "base64"));
  }
  console.log(`cart: ${result.partCount} parts, fell ${result.fell.toFixed(1)} LDU`);

  expect(result.partCount).toBe(12);
  // It really moved, so the restored frame meaning anything depends on it.
  expect(result.fell).toBeGreaterThan(10);
  expect(result.documentUnchanged).toBe(12);
});
