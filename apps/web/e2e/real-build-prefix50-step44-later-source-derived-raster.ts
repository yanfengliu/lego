import { createHash } from "node:crypto";
import { join } from "node:path";

import { canonicalDigest } from "@lego-studio/brick-kernel";

import { readContainedBoundedRegularFile } from "./bounded-file-read.ts";
import {
  createContainedDirectoryExclusive,
  ensureContainedDirectoryTree,
  removeContainedDirectoryTree,
} from "./contained-directory.ts";
import {
  acquireContainedDirectoryLiveGuard,
  reassertContainedDirectoryLiveGuard,
  releaseContainedDirectoryLiveGuard,
  type ContainedDirectoryLiveGuard,
} from "./contained-directory-live-guard.ts";
import {
  REAL_BUILD_PREFIX50_STEP44_DERIVED_OUTPUT_ROOT,
  type RealBuildPrefix50Step44LaterSourceDerivedOperationRequest,
  type RealBuildPrefix50Step44LaterSourcePreparedState,
  type RealBuildPrefix50Step44LaterSourceRasterResult,
} from "./real-build-prefix50-step44-later-source-derived-contract.ts";
import { decodeRealBuildPrefix50Step44ReviewPng } from "./real-build-prefix50-subbuild-return-review-png.ts";
import { runRealBuildPrefix50Step44Poppler } from "./real-build-prefix50-subbuild-return-review-poppler.ts";

const MAXIMUM_RENDER_BYTES = 32 * 1024 * 1024;
const MAXIMUM_RENDER_PIXELS = 10_000_000;

function sha256(bytes: Uint8Array): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

export function renderRealBuildPrefix50Step44LaterSourceRaster(
  sourceBytes: Buffer,
  request: Extract<
    RealBuildPrefix50Step44LaterSourceDerivedOperationRequest,
    { readonly kind: "raster-page" }
  >,
  output: RealBuildPrefix50Step44LaterSourcePreparedState,
): RealBuildPrefix50Step44LaterSourceRasterResult {
  let directoryCreated = false;
  let popplerQuiescent = false;
  let liveGuard: ContainedDirectoryLiveGuard | undefined;
  let renderedBytes: Buffer | undefined;
  let decodedBytes: Uint8Array | undefined;
  let primaryFailure: unknown;
  let result: RealBuildPrefix50Step44LaterSourceRasterResult | undefined;
  try {
    ensureContainedDirectoryTree(
      output.repositoryRoot,
      REAL_BUILD_PREFIX50_STEP44_DERIVED_OUTPUT_ROOT,
      "Step-44 later-source derived-output root",
    );
    createContainedDirectoryExclusive(
      output.repositoryRoot,
      output.outputCandidate,
      "Step-44 later-source derived-output scope",
    );
    directoryCreated = true;
    liveGuard = acquireContainedDirectoryLiveGuard(
      output.repositoryRoot,
      output.outputCandidate,
      "Step-44 later-source derived-output scope",
    );
    reassertContainedDirectoryLiveGuard(liveGuard, output.repositoryRoot, output.outputCandidate);
    const outputName = "physical-page-45";
    const outputPrefix = join(liveGuard.canonicalDirectory, outputName);
    const poppler = runRealBuildPrefix50Step44Poppler({
      sourceBytes,
      label: `Step-44 ${request.purpose} derived page raster`,
      arguments: [
        "-f",
        "45",
        "-l",
        "45",
        "-r",
        String(request.densityDpi),
        "-png",
        "-singlefile",
        "-",
        outputPrefix,
      ],
    });
    popplerQuiescent = true;
    reassertContainedDirectoryLiveGuard(liveGuard, output.repositoryRoot, output.outputCandidate);
    renderedBytes = readContainedBoundedRegularFile(
      liveGuard.canonicalDirectory,
      `${outputName}.png`,
      {
        label: "Step-44 bounded derived page raster",
        maximumBytes: MAXIMUM_RENDER_BYTES,
      },
    );
    reassertContainedDirectoryLiveGuard(liveGuard, output.repositoryRoot, output.outputCandidate);
    const decoded = decodeRealBuildPrefix50Step44ReviewPng(
      renderedBytes,
      MAXIMUM_RENDER_PIXELS,
      "Step-44 bounded derived page raster",
    );
    decodedBytes = decoded.rgba;
    const body = {
      kind: "raster-page" as const,
      purpose: request.purpose,
      physicalPageNumber: 45 as const,
      densityDpi: request.densityDpi,
      rendererVersion: poppler.version,
      popplerToolchainCommitment: poppler.toolchainCommitment,
      pngDigest: sha256(renderedBytes),
      pixelDigest: sha256(decodedBytes),
      width: decoded.width,
      height: decoded.height,
      retainDecodedBytes: request.retainDecodedBytes,
    };
    const derivedCommitment = canonicalDigest(body);
    result = Object.freeze(
      request.retainDecodedBytes
        ? {
            ...body,
            retainDecodedBytes: true as const,
            derivedCommitment,
            pngBytes: new Uint8Array(renderedBytes),
            rgba: new Uint8Array(decodedBytes),
          }
        : { ...body, retainDecodedBytes: false as const, derivedCommitment },
    );
  } catch (error) {
    primaryFailure = error;
  }
  renderedBytes?.fill(0);
  decodedBytes?.fill(0);
  let cleanupFailure: unknown;
  if (liveGuard !== undefined) cleanupFailure = releaseContainedDirectoryLiveGuard(liveGuard);
  if (directoryCreated && cleanupFailure === null) cleanupFailure = undefined;
  // Retain the exact output scope when a failed wrapper return leaves child exit unknown.
  if (directoryCreated && popplerQuiescent && cleanupFailure === undefined) {
    try {
      removeContainedDirectoryTree(
        output.repositoryRoot,
        output.outputCandidate,
        "Step-44 later-source derived-output cleanup",
      );
    } catch (error) {
      cleanupFailure = error;
    }
  }
  if (primaryFailure !== undefined && cleanupFailure !== undefined)
    throw new AggregateError(
      [primaryFailure, cleanupFailure],
      "Later-source raster derivation failed and its owned output scope could not be removed.",
      { cause: primaryFailure },
    );
  if (primaryFailure !== undefined) throw primaryFailure;
  if (cleanupFailure !== undefined)
    throw new TypeError("Later-source raster owned output scope could not be removed.", {
      cause: cleanupFailure,
    });
  return result!;
}
