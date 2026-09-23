import {
  executeRealBuildPrefix50Step44LaterSourceDerivation,
  type RealBuildPrefix50Step44LaterSourceDerivationResult,
  type RealBuildPrefix50Step44LaterSourceReadCapability,
  type RealBuildPrefix50Step44LaterSourceReadPurpose,
} from "./real-build-prefix50-step44-later-source-authority.ts";

type RasterPurpose = Exclude<
  RealBuildPrefix50Step44LaterSourceReadPurpose,
  "page44-step43-vector" | "page45-step44-vector"
>;
type RasterResult = Extract<
  RealBuildPrefix50Step44LaterSourceDerivationResult,
  { readonly kind: "raster-page" }
>;
type RetainedRasterResult = Extract<RasterResult, { readonly retainDecodedBytes: true }>;
type UnretainedRasterResult = Extract<RasterResult, { readonly retainDecodedBytes: false }>;
interface RasterInput<Retain extends boolean> {
  readonly capability: RealBuildPrefix50Step44LaterSourceReadCapability;
  readonly purpose: RasterPurpose;
  readonly densityDpi: number;
  readonly retainDecodedBytes: Retain;
}

export function rerenderRealBuildPrefix50Step44PdfPage(
  input: RasterInput<true>,
): Promise<RetainedRasterResult>;
export function rerenderRealBuildPrefix50Step44PdfPage(
  input: RasterInput<false>,
): Promise<UnretainedRasterResult>;
export async function rerenderRealBuildPrefix50Step44PdfPage(
  input: RasterInput<boolean>,
): Promise<RasterResult> {
  const { result } = await executeRealBuildPrefix50Step44LaterSourceDerivation({
    capability: input.capability,
    request: {
      kind: "raster-page",
      purpose: input.purpose,
      densityDpi: input.densityDpi,
      retainDecodedBytes: input.retainDecodedBytes,
    },
  });
  if (
    result.kind !== "raster-page" ||
    result.purpose !== input.purpose ||
    result.retainDecodedBytes !== input.retainDecodedBytes
  )
    throw new TypeError("Later-source raster authority returned the wrong fixed derivation kind.");
  return result;
}
