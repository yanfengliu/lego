import type { RealBuildSourceParityProbePanel } from "./real-build-observation-source-parity-types";

export interface RealBuildSourceParityBrowserModuleUrls {
  readonly pdfjsUrl: string;
  readonly workerUrl: string;
  readonly pdfUrl: string;
  readonly latticeUrl: string;
  readonly assemblyUrl: string;
  readonly panelRasterUrl: string;
  readonly candidateUrl: string;
}

export interface RealBuildSourceParityMeasurementInput {
  readonly urls: RealBuildSourceParityBrowserModuleUrls;
  readonly expectedPdfDigest: string;
  readonly expectedPdfBytes: number;
  readonly preparedPanelsDigest: string;
  readonly panels: readonly RealBuildSourceParityProbePanel[];
}
