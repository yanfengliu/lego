import { deriveRealBuildPrefix50Step44RealDomainSourcePixels } from "./real-build-prefix50-subbuild-return-review-camera-real-domain-source-pixels.ts";

const WIDTH = 720;
const HEIGHT = 470;

export function deriveRealBuildPrefix50Step44RealDomainSourceCropPixels(rgba: Uint8Array) {
  if (rgba.byteLength !== WIDTH * HEIGHT * 4)
    throw new RangeError(
      `Real-domain source crop must contain exactly ${WIDTH * HEIGHT * 4} RGBA bytes.`,
    );
  return deriveRealBuildPrefix50Step44RealDomainSourcePixels({
    pageRgba: rgba,
    pageWidth: WIDTH,
    crop: { x: 0, y: 0, width: WIDTH, height: HEIGHT },
  });
}
