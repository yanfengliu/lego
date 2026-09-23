function maskRgba(mask: Uint8Array, allowed: readonly [number, number, number]): Uint8Array {
  const rgba = new Uint8Array(mask.length * 4);
  for (let index = 0; index < mask.length; index += 1) {
    const offset = index * 4;
    const color = mask[index] === 1 ? allowed : ([0x28, 0x2b, 0x29] as const);
    rgba[offset] = color[0];
    rgba[offset + 1] = color[1];
    rgba[offset + 2] = color[2];
    rgba[offset + 3] = 0xff;
  }
  return rgba;
}

export function renderRealBuildPrefix50Step44CameraMask(
  mask: Uint8Array,
  kind: "eligible-parent-region" | "parent-only-target",
): Uint8Array {
  return maskRgba(
    mask,
    kind === "eligible-parent-region" ? [0xe8, 0xee, 0xe9] : [0xff, 0x30, 0xd8],
  );
}
