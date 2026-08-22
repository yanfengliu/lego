import type { Sha256Digest } from "@lego-studio/brick-kernel";

import { downsampleRaster } from "../src/assembly/panel-art";
import { createRealBuildBrowserOutputV4SourceEvidencePanel } from "../e2e/real-build-browser-output-v4-source-evidence-panel-writer";
import {
  beginRealBuildBrowserOutputV4SourceEvidenceInspection,
  finishRealBuildBrowserOutputV4SourceEvidenceInspection,
  inspectRealBuildBrowserOutputV4SourceEvidencePanel,
} from "../e2e/real-build-browser-output-v4-source-evidence-reader";
import type {
  RealBuildBrowserOutputV4SourceEvidenceMask,
  RealBuildBrowserOutputV4SourceEvidencePanelArtifact,
} from "../e2e/real-build-browser-output-v4-source-evidence-types";
import { createRealBuildBrowserOutputV4SourceEvidenceManifest } from "../e2e/real-build-browser-output-v4-source-evidence-writer";
import { stepPanelEvidenceDigest } from "../e2e/real-build-panel-evidence-digest";
import { inspectRealBuildPreparedRunInput } from "../e2e/real-build-prepared-step-authority";
import type { RealBuildOptions } from "../e2e/real-build-safety";

const HIGH_WIDTH = 1_000;
const HIGH_HEIGHT = 10;

function sourceArtifact(
  options: RealBuildOptions,
  stepNumber: number,
  blank: boolean,
): RealBuildBrowserOutputV4SourceEvidencePanelArtifact {
  const panel = options.panels[stepNumber - 1]!;
  const high = new Uint8ClampedArray(HIGH_WIDTH * HIGH_HEIGHT * 4);
  for (let pixel = 0; pixel < high.length / 4; pixel += 1) {
    high[pixel * 4] = 0x89;
    high[pixel * 4 + 1] = 0x90;
    high[pixel * 4 + 2] = 0x93;
    high[pixel * 4 + 3] = 255;
  }
  if (!blank) {
    const left = 40 + ((stepNumber * 17) % 800);
    for (let y = 2; y < 8; y += 1) {
      for (let x = left; x < left + 32; x += 1) {
        const offset = (y * HIGH_WIDTH + x) * 4;
        high[offset] = 0;
        high[offset + 1] = 0;
        high[offset + 2] = 0;
      }
    }
  }
  const work = downsampleRaster(
    { width: HIGH_WIDTH, height: HIGH_HEIGHT, pixels: high },
    options.workFactor,
  ).pixels;
  const pdfDigest = options.inputDigests.pdf as Sha256Digest;
  return createRealBuildBrowserOutputV4SourceEvidencePanel({
    pdfDigest,
    panel: {
      stepNumber,
      pageNumber: panel.pageNumber,
      minXPt: panel.minXPt,
      maxXPt: panel.maxXPt,
      minYPt: panel.minYPt,
      maxYPt: panel.maxYPt,
      calloutBoxes: panel.calloutBoxes,
      panelEvidenceDigest: stepPanelEvidenceDigest({
        pdfDigest,
        stepNumber,
        pageNumber: panel.pageNumber,
        bounds: panel,
        calloutBoxes: panel.calloutBoxes,
      }) as Sha256Digest,
    },
    highRgba: high,
    workRgba: work,
  });
}

export function twoStepSourceEvidence(
  preparedRunInputBytes: Uint8Array,
  options: RealBuildOptions,
  blankStepNumber: number | null,
) {
  const prepared = inspectRealBuildPreparedRunInput(preparedRunInputBytes);
  const artifacts = options.panels.map((_, index) =>
    sourceArtifact(options, index + 1, index + 1 === blankStepNumber),
  );
  const manifestBytes = createRealBuildBrowserOutputV4SourceEvidenceManifest({
    preparedRunInputInspection: prepared,
    panels: artifacts.map(({ descriptor }) => descriptor),
  }).readManifestBytes();
  const session = beginRealBuildBrowserOutputV4SourceEvidenceInspection(manifestBytes, prepared);
  for (let index = 0; index < artifacts.length; index += 1) {
    const artifact = artifacts[index]!;
    inspectRealBuildBrowserOutputV4SourceEvidencePanel(
      session,
      index + 1,
      artifact.highRgbaBytes,
      artifact.workRgbaBytes,
      artifact.packedMaskBytes,
    );
  }
  return {
    artifacts,
    manifestBytes,
    inspection: finishRealBuildBrowserOutputV4SourceEvidenceInspection(session),
  };
}

export function unpackTwoStepSourceMask(
  artifact: RealBuildBrowserOutputV4SourceEvidencePanelArtifact,
  name: RealBuildBrowserOutputV4SourceEvidenceMask,
): Uint8Array {
  const reference = artifact.descriptor.masks.find((mask) => mask.name === name);
  if (reference === undefined) throw new TypeError(`Two-step source fixture lacks ${name}.`);
  const packed = artifact.packedMaskBytes.subarray(
    reference.offset,
    reference.offset + reference.byteLength,
  );
  const result = new Uint8Array(reference.pixelCount);
  for (let index = 0; index < result.length; index += 1)
    result[index] = (packed[Math.floor(index / 8)]! >> (7 - (index % 8))) & 1;
  return result;
}
