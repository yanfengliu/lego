import { canonicalDigest } from "@lego-studio/brick-kernel";

import type { RealBuildPrefix50ReviewedVisualBinding } from "./real-build-prefix50-subbuild-return-contract";
import type {
  RealBuildPrefix50Step44ReviewedPanelCrop,
  RealBuildPrefix50Step44ReviewedRender,
  RealBuildPrefix50Step44ReviewedReturnFixture,
  RealBuildPrefix50Step44ReviewedSourcePageRaster,
} from "./real-build-prefix50-subbuild-return-review-fixture";

export function realBuildPrefix50ReviewedVisualBindingCommitment(
  binding:
    | RealBuildPrefix50ReviewedVisualBinding
    | Omit<RealBuildPrefix50ReviewedVisualBinding, "commitment">,
): `sha256:${string}` {
  return commitmentWithoutSelf(binding);
}

function commitmentWithoutSelf(value: object): `sha256:${string}` {
  const body = { ...value } as Record<string, unknown>;
  Reflect.deleteProperty(body, "commitment");
  return canonicalDigest(body);
}

export function realBuildPrefix50Step44SourcePageRasterCommitment(
  raster:
    | RealBuildPrefix50Step44ReviewedSourcePageRaster
    | Omit<RealBuildPrefix50Step44ReviewedSourcePageRaster, "commitment">,
): `sha256:${string}` {
  return commitmentWithoutSelf(raster);
}

export function realBuildPrefix50Step44PanelCropCommitment(
  crop:
    | RealBuildPrefix50Step44ReviewedPanelCrop
    | Omit<RealBuildPrefix50Step44ReviewedPanelCrop, "commitment">,
): `sha256:${string}` {
  return commitmentWithoutSelf(crop);
}

export function realBuildPrefix50Step44RenderReviewCommitment(
  review:
    | RealBuildPrefix50Step44ReviewedRender
    | Omit<RealBuildPrefix50Step44ReviewedRender, "commitment">,
): `sha256:${string}` {
  return commitmentWithoutSelf(review);
}

export function realBuildPrefix50Step44ReviewedFixtureCommitment(
  fixture:
    | RealBuildPrefix50Step44ReviewedReturnFixture
    | Omit<RealBuildPrefix50Step44ReviewedReturnFixture, "commitment">,
): `sha256:${string}` {
  return commitmentWithoutSelf(fixture);
}
