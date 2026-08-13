import { Buffer } from "node:buffer";

import { realBuildSourceParityBrowserResultEvidence } from "./real-build-observation-source-parity-browser-result";
import type {
  RealBuildSourceParityAggregate,
  RealBuildSourceParityBrowserResult,
  RealBuildSourceParityProbeResult,
} from "./real-build-observation-source-parity-types";

interface PreparedCapture {
  readonly digest: string;
  readonly width: number;
  readonly height: number;
  readonly bytes: Buffer;
}

interface PreparedPackedEvidence {
  readonly packedDigest: string;
  readonly pixelCount: number;
  readonly byteLength: number;
  readonly lowPaddingBits: number;
  readonly bytes: Buffer;
}

export function validateRealBuildSourceParityBrowserResultBinding(input: {
  readonly result: RealBuildSourceParityProbeResult;
  readonly summaryCore: Readonly<Record<string, unknown>>;
  readonly captures: readonly PreparedCapture[];
  readonly packedEvidence: readonly PreparedPackedEvidence[];
}): void {
  const browserResult: RealBuildSourceParityBrowserResult = {
    pdfDigest: input.result.pdfDigest,
    pdfBytes: input.result.pdfBytes,
    preparedPanelsDigest: input.result.preparedPanelsDigest,
    steps: input.summaryCore.steps as RealBuildSourceParityBrowserResult["steps"],
    aggregate: input.summaryCore.aggregate as readonly RealBuildSourceParityAggregate[],
    captures: input.captures.map(({ digest, width, height, bytes }) => ({
      digest,
      width,
      height,
      png: `data:image/png;base64,${bytes.toString("base64")}`,
    })),
    packedEvidence: input.packedEvidence.map(
      ({ packedDigest, pixelCount, byteLength, lowPaddingBits, bytes }) => ({
        packedDigest,
        pixelCount,
        byteLength,
        lowPaddingBits,
        base64: bytes.toString("base64"),
      }),
    ),
  };
  const evidence = realBuildSourceParityBrowserResultEvidence(browserResult);
  if (
    evidence.digest !== input.result.sourceSnapshot.browserResultDigest ||
    evidence.bytes !== input.result.sourceSnapshot.browserResultBytes ||
    browserResult.preparedPanelsDigest !== input.result.sourceSnapshot.preparedPanelsDigest
  ) {
    throw new TypeError(
      "Detached source-parity browser result does not reproduce its execution digest, length, and prepared-panel binding.",
    );
  }
}
