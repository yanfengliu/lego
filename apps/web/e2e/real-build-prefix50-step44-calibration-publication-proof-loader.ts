import type { RealBuildPrefix50Step44CalibrationPublicationDescriptor } from "./real-build-prefix50-step44-calibration-publication-marker.ts";
import type {
  RealBuildPrefix50Step44CalibrationDirectoryPublicationProof,
  RealBuildPrefix50Step44CalibrationDirectoryTransaction,
} from "./real-build-prefix50-step44-calibration-directory-state.ts";

export async function reassertRealBuildPrefix50Step44CalibrationPublicationProof(
  transaction: RealBuildPrefix50Step44CalibrationDirectoryTransaction,
  publicationProof: RealBuildPrefix50Step44CalibrationDirectoryPublicationProof,
  final: boolean,
): Promise<RealBuildPrefix50Step44CalibrationPublicationDescriptor> {
  const module = await import("./real-build-prefix50-step44-calibration-publication-proof.ts");
  return module.reassertRealBuildPrefix50Step44CalibrationDirectoryPublicationProof({
    transaction,
    publicationProof,
    final,
  });
}
