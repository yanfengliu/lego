import { sha256Hex, type Sha256Digest } from "@lego-studio/brick-kernel";

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
import type { RealBuildOptions, RealBuildPanelSpec } from "../e2e/real-build-safety";
import { completeRealBuildTestOptions } from "./real-build-test-options";

const ENCODER = new TextEncoder();
const HIGH_WIDTH = 1_000;
const PANEL_BOUNDS = { minXPt: 0, maxXPt: 100, minYPt: 0, maxYPt: 1 } as const;

export const READER_SELECTED_SOURCE_PDF_DIGEST =
  `sha256:${sha256Hex("reader-selected-source-pdf")}` as Sha256Digest;

function directPanel(
  panel: RealBuildPanelSpec,
  pieces: RealBuildPanelSpec["pieces"],
  evidenceDigest: string | null,
): RealBuildPanelSpec {
  return {
    ...panel,
    action: { kind: "place-callouts", assembledPieces: pieces.length, evidenceDigest },
    pieces,
    omittedPieces: [],
    mappedCalloutKeys: pieces.map(({ calloutKey }) => calloutKey),
    calloutPieces: pieces.length,
    classifiedPhysicalCalloutPieces: pieces.length,
    semanticMultiplierQuantity: 0,
    omittedPhysicalPieces: 0,
  };
}

function preparedOptions(): RealBuildOptions {
  const base = completeRealBuildTestOptions(359);
  const panels = base.panels.map((panel): RealBuildPanelSpec => {
    const calloutBoxes: readonly [] = [];
    const panelEvidenceDigest = stepPanelEvidenceDigest({
      pdfDigest: READER_SELECTED_SOURCE_PDF_DIGEST,
      stepNumber: panel.stepNumber,
      pageNumber: panel.pageNumber,
      bounds: PANEL_BOUNDS,
      calloutBoxes,
    });
    return {
      ...panel,
      ...PANEL_BOUNDS,
      calloutBoxes,
      action:
        panel.action.kind === "transition"
          ? { ...panel.action, panelEvidenceDigest }
          : panel.action,
    };
  });
  const source = panels[357]!;
  if (source.action.kind !== "place-callouts" || source.pieces.length !== 1_395) {
    throw new TypeError("Selected reader fixture lost its 1,395-piece source panel.");
  }
  const moved = source.pieces.slice(0, 1);
  panels[0] = directPanel(panels[0]!, moved, source.action.evidenceDigest);
  panels[357] = directPanel(source, source.pieces.slice(1), source.action.evidenceDigest);
  const coverageByCallout = { ...base.coverageByCallout };
  const claim = coverageByCallout[moved[0]!.calloutKey];
  if (claim === undefined) {
    throw new TypeError("Selected reader fixture lost coverage for its moved step-1 piece.");
  }
  coverageByCallout[moved[0]!.calloutKey] = {
    ...claim,
    pageNumber: panels[0]!.pageNumber,
    stepNumber: 1,
  };
  return {
    ...base,
    panels,
    coverageByCallout,
    inputDigests: { ...base.inputDigests, pdf: READER_SELECTED_SOURCE_PDF_DIGEST },
    coverageInputBindings: {
      ...base.coverageInputBindings,
      pdf: READER_SELECTED_SOURCE_PDF_DIGEST,
    },
  };
}

function panelArtifact(
  options: RealBuildOptions,
  stepNumber: number,
): RealBuildBrowserOutputV4SourceEvidencePanelArtifact {
  const panel = options.panels[stepNumber - 1]!;
  const highHeight = 10;
  const high = new Uint8ClampedArray(HIGH_WIDTH * highHeight * 4);
  for (let pixel = 0; pixel < high.length / 4; pixel += 1) {
    high[pixel * 4] = 0x89;
    high[pixel * 4 + 1] = 0x90;
    high[pixel * 4 + 2] = 0x93;
    high[pixel * 4 + 3] = 255;
  }
  const left = 40 + ((stepNumber * 17) % 800);
  for (let y = 2; y < 8; y += 1) {
    for (let x = left; x < left + 32; x += 1) {
      const offset = (y * HIGH_WIDTH + x) * 4;
      high[offset] = 0;
      high[offset + 1] = 0;
      high[offset + 2] = 0;
    }
  }
  const work = downsampleRaster(
    { width: HIGH_WIDTH, height: highHeight, pixels: high },
    options.workFactor,
  ).pixels;
  return createRealBuildBrowserOutputV4SourceEvidencePanel({
    pdfDigest: READER_SELECTED_SOURCE_PDF_DIGEST,
    panel: {
      stepNumber,
      pageNumber: panel.pageNumber,
      ...PANEL_BOUNDS,
      calloutBoxes: panel.calloutBoxes,
      panelEvidenceDigest: stepPanelEvidenceDigest({
        pdfDigest: READER_SELECTED_SOURCE_PDF_DIGEST,
        stepNumber,
        pageNumber: panel.pageNumber,
        bounds: PANEL_BOUNDS,
        calloutBoxes: panel.calloutBoxes,
      }) as Sha256Digest,
    },
    highRgba: high,
    workRgba: work,
  });
}

export function unpackSelectedSourceMask(
  artifact: RealBuildBrowserOutputV4SourceEvidencePanelArtifact,
  name: RealBuildBrowserOutputV4SourceEvidenceMask,
): Uint8Array {
  const reference = artifact.descriptor.masks.find((candidate) => candidate.name === name);
  if (reference === undefined) throw new TypeError(`Selected reader fixture lacks ${name}.`);
  const packed = artifact.packedMaskBytes.subarray(
    reference.offset,
    reference.offset + reference.byteLength,
  );
  const unpacked = new Uint8Array(reference.pixelCount);
  for (let index = 0; index < unpacked.length; index += 1) {
    unpacked[index] = (packed[Math.floor(index / 8)]! >> (7 - (index % 8))) & 1;
  }
  return unpacked;
}

export function realBuildBrowserOutputV4SelectedSourceFixture() {
  const options = preparedOptions();
  const preparedRunInputBytes = ENCODER.encode(JSON.stringify(options));
  const preparedRun = inspectRealBuildPreparedRunInput(preparedRunInputBytes);
  const artifacts = Array.from({ length: 359 }, (_, index) => panelArtifact(options, index + 1));
  const manifestBytes = createRealBuildBrowserOutputV4SourceEvidenceManifest({
    preparedRunInputInspection: preparedRun,
    panels: artifacts.map(({ descriptor }) => descriptor),
  }).readManifestBytes();
  const session = beginRealBuildBrowserOutputV4SourceEvidenceInspection(manifestBytes, preparedRun);
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
  return Object.freeze({
    options,
    preparedRunInputBytes,
    preparedRun,
    firstPanelArtifact: artifacts[0]!,
    manifestBytes,
    inspection: finishRealBuildBrowserOutputV4SourceEvidenceInspection(session),
  });
}
