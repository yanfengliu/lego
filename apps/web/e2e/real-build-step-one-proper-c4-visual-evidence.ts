export function createRealBuildStepOneProperC4ContactCanvas(
  attribute: "camera" | "alternate",
  value: string,
): {
  readonly canvas: HTMLCanvasElement;
  readonly context: CanvasRenderingContext2D;
} {
  const canvas = document.createElement("canvas");
  canvas.dataset.properC4CurrentContact = "true";
  if (attribute === "camera") canvas.dataset.properC4CurrentContactCamera = value;
  else canvas.dataset.properC4CurrentContactAlternateFrame = value;
  canvas.width = 1_000;
  canvas.height = 680;
  const context = canvas.getContext("2d");
  if (context === null) throw new TypeError("Proper-C4 contact sheet needs 2D canvas.");
  document.body.append(canvas);
  return { canvas, context };
}

export function drawRealBuildStepOneProperC4ContactFrame(input: {
  readonly context: CanvasRenderingContext2D;
  readonly scratch: HTMLCanvasElement;
  readonly scratchContext: CanvasRenderingContext2D;
  readonly pixels: Uint8Array;
  readonly widthPx: number;
  readonly heightPx: number;
  readonly index: number;
}): void {
  input.scratchContext.putImageData(
    new ImageData(new Uint8ClampedArray(input.pixels), input.widthPx, input.heightPx),
    0,
    0,
  );
  input.context.drawImage(
    input.scratch,
    (input.index % 10) * 100,
    Math.floor(input.index / 10) * 68,
    100,
    68,
  );
}
