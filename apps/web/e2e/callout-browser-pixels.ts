import type { CropStrategy, PixelBounds } from "./callout-types";

export type CalloutRgb = readonly [number, number, number];

/** Invalid legacy evidence remains a benchmark miss; ranked publication evidence must fail closed. */
export function discardEmptyLegacyComponent(
  strategy: CropStrategy,
  foregroundPixels: number,
): boolean {
  return strategy === "legacy-seed" && foregroundPixels === 0;
}

export function clampCalloutPixelBounds(
  bounds: PixelBounds,
  canvasWidth: number,
  canvasHeight: number,
): PixelBounds {
  return {
    left: Math.max(0, Math.min(canvasWidth - 1, bounds.left)),
    top: Math.max(0, Math.min(canvasHeight - 1, bounds.top)),
    right: Math.max(0, Math.min(canvasWidth - 1, bounds.right)),
    bottom: Math.max(0, Math.min(canvasHeight - 1, bounds.bottom)),
  };
}

export const insideCalloutPixelBounds = (bounds: PixelBounds, x: number, y: number): boolean =>
  x >= bounds.left && x <= bounds.right && y >= bounds.top && y <= bounds.bottom;

export function sampledCalloutBackground(
  box: PixelBounds,
  colourAt: (x: number, y: number) => CalloutRgb,
): [number, number, number] {
  const tally = new Map<string, number>();
  const stepX = Math.max(1, Math.floor((box.right - box.left) / 60));
  const stepY = Math.max(1, Math.floor((box.bottom - box.top) / 60));
  for (let y = box.top; y <= box.bottom; y += stepY) {
    for (let x = box.left; x <= box.right; x += stepX) {
      const [red, green, blue] = colourAt(x, y);
      const key = `${red >> 3},${green >> 3},${blue >> 3}`;
      tally.set(key, (tally.get(key) ?? 0) + 1);
    }
  }
  const commonest = [...tally].sort((left, right) => right[1] - left[1])[0]?.[0] ?? "31,31,31";
  return commonest.split(",").map((channel) => (Number(channel) << 3) + 4) as [
    number,
    number,
    number,
  ];
}
