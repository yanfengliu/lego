import { requireSemanticColorMaskTargetIds } from "@lego-studio/rendering";

export function requireInstructionViewCaptureBounds(input: {
  readonly scene: unknown;
  readonly renderMode: unknown;
  readonly targetColorIds?: unknown;
  readonly backgroundHex: unknown;
  readonly frame: { readonly widthPx: unknown; readonly heightPx: unknown };
}): {
  readonly widthPx: number;
  readonly heightPx: number;
  readonly targetColorIds: readonly string[] | null;
} {
  if (input.scene !== "model-only")
    throw new RangeError("Instruction-view capture scene must be model-only.");
  if (input.renderMode !== "instruction-art" && input.renderMode !== "semantic-color-id-mask")
    throw new RangeError(
      `Instruction-view capture renderMode must be instruction-art or semantic-color-id-mask; received ${String(input.renderMode)}.`,
    );
  const targetColorIds =
    input.renderMode === "semantic-color-id-mask"
      ? requireSemanticColorMaskTargetIds(input.targetColorIds as readonly string[])
      : null;
  if (input.renderMode === "instruction-art" && input.targetColorIds !== undefined)
    throw new TypeError("Instruction-art capture must not carry semantic targetColorIds.");
  if (
    !Number.isInteger(input.backgroundHex) ||
    (input.backgroundHex as number) < 0 ||
    (input.backgroundHex as number) > 0xffffff
  )
    throw new RangeError(
      `Instruction-view capture backgroundHex must be an integer from 0x000000 through 0xffffff; received ${String(input.backgroundHex)}.`,
    );
  const { widthPx, heightPx } = input.frame;
  if (
    !Number.isInteger(widthPx) ||
    !Number.isInteger(heightPx) ||
    (widthPx as number) < 1 ||
    (heightPx as number) < 1 ||
    (widthPx as number) > 2_048 ||
    (heightPx as number) > 2_048 ||
    (widthPx as number) * (heightPx as number) > 4_000_000
  )
    throw new RangeError(
      `Instruction-view capture frame must be 1..2048 per axis and at most four million pixels; received ${String(widthPx)}x${String(heightPx)}.`,
    );
  return { widthPx: widthPx as number, heightPx: heightPx as number, targetColorIds };
}

export function withInstructionViewCaptureStateRestored<T>(
  capture: () => T,
  restore: () => void,
): T {
  try {
    return capture();
  } finally {
    restore();
  }
}
