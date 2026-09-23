import type { Canvas, SKRSContext2D } from "@napi-rs/canvas";

export function fitRealBuildPrefix50Step44ContainedRect(input: {
  readonly sourceWidth: number;
  readonly sourceHeight: number;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}) {
  const scale = Math.min(input.width / input.sourceWidth, input.height / input.sourceHeight);
  const width = input.sourceWidth * scale;
  const height = input.sourceHeight * scale;
  return {
    x: input.x + (input.width - width) / 2,
    y: input.y + (input.height - height) / 2,
    width,
    height,
  };
}

export function drawRealBuildPrefix50Step44Contained(
  context: SKRSContext2D,
  source: Canvas,
  x: number,
  y: number,
  width: number,
  height: number,
): void {
  const target = fitRealBuildPrefix50Step44ContainedRect({
    sourceWidth: source.width,
    sourceHeight: source.height,
    x,
    y,
    width,
    height,
  });
  context.drawImage(source, target.x, target.y, target.width, target.height);
}
