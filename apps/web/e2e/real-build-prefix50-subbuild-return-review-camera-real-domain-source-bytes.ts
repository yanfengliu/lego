export interface RealBuildPrefix50Step44RealDomainSourcePixelVault {
  readonly kind: "opaque-real-domain-source-pixel-vault";
}

interface SourcePixels {
  readonly rgba: Uint8Array;
  readonly eligibleMask: Uint8Array;
  readonly parentOnlyForegroundMask: Uint8Array;
}

const pixelVaults = new WeakMap<object, SourcePixels>();

export function sealRealBuildPrefix50Step44RealDomainSourcePixels(
  input: SourcePixels,
): RealBuildPrefix50Step44RealDomainSourcePixelVault {
  const vault = Object.freeze({
    kind: "opaque-real-domain-source-pixel-vault" as const,
  });
  pixelVaults.set(
    vault,
    Object.freeze({
      rgba: new Uint8Array(input.rgba),
      eligibleMask: new Uint8Array(input.eligibleMask),
      parentOnlyForegroundMask: new Uint8Array(input.parentOnlyForegroundMask),
    }),
  );
  return vault;
}

export function readRealBuildPrefix50Step44RealDomainSourcePixelVault(
  vault: RealBuildPrefix50Step44RealDomainSourcePixelVault,
): SourcePixels {
  const pixels = pixelVaults.get(vault);
  if (pixels === undefined)
    throw new TypeError("Real-domain source pixel vault must be minted by the live source loader.");
  return Object.freeze({
    rgba: new Uint8Array(pixels.rgba),
    eligibleMask: new Uint8Array(pixels.eligibleMask),
    parentOnlyForegroundMask: new Uint8Array(pixels.parentOnlyForegroundMask),
  });
}
