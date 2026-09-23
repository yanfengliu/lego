import type {
  RealBuildPrefix50Step44LaterSourceDerivedOperationResult,
  RealBuildPrefix50Step44PreparedLaterSourceDerivedOperation,
} from "./real-build-prefix50-step44-later-source-derived-contract.ts";
import {
  physicalPageForRealBuildPrefix50Step44LaterSourceDerivedOperation,
  prepareRealBuildPrefix50Step44LaterSourceDerivedOperation,
  requestForRealBuildPrefix50Step44PreparedLaterSourceDerivedOperation,
  requireRealBuildPrefix50Step44ExactKeys,
  stateForRealBuildPrefix50Step44PreparedLaterSourceDerivedOperation,
} from "./real-build-prefix50-step44-later-source-derived-contract.ts";
import { renderRealBuildPrefix50Step44LaterSourceRaster } from "./real-build-prefix50-step44-later-source-derived-raster.ts";
import { deriveRealBuildPrefix50Step44LaterSourcePanelPrefix } from "./real-build-prefix50-step44-later-source-derived-vector.ts";

export type {
  RealBuildPrefix50Step44LaterSourceDerivedOperationRequest,
  RealBuildPrefix50Step44LaterSourceDerivedOperationResult,
  RealBuildPrefix50Step44LaterSourcePanelResult,
  RealBuildPrefix50Step44LaterSourcePanelRow,
  RealBuildPrefix50Step44LaterSourceRasterPurpose,
  RealBuildPrefix50Step44LaterSourceRasterResult,
  RealBuildPrefix50Step44LaterSourceVectorPurpose,
  RealBuildPrefix50Step44PreparedLaterSourceDerivedOperation,
} from "./real-build-prefix50-step44-later-source-derived-contract.ts";
export {
  physicalPageForRealBuildPrefix50Step44LaterSourceDerivedOperation,
  prepareRealBuildPrefix50Step44LaterSourceDerivedOperation,
  requestForRealBuildPrefix50Step44PreparedLaterSourceDerivedOperation,
};

const MAXIMUM_SOURCE_BYTES = 96 * 1024 * 1024;
const SHA256 = /^sha256:[0-9a-f]{64}$/u;
const resultBrands = new WeakSet<object>();
const usedPreparedOperations = new WeakSet<object>();

export async function executeRealBuildPrefix50Step44LaterSourceDerivedOperation(input: {
  readonly sourceBytes: Buffer;
  readonly prepared: RealBuildPrefix50Step44PreparedLaterSourceDerivedOperation;
}): Promise<RealBuildPrefix50Step44LaterSourceDerivedOperationResult> {
  if (arguments.length !== 1 || input === null || typeof input !== "object")
    throw new TypeError("Later-source derivation requires one closed internal input.");
  requireRealBuildPrefix50Step44ExactKeys(
    input,
    ["prepared", "sourceBytes"],
    "Later-source derived-operation input",
  );
  if (
    !Buffer.isBuffer(input.sourceBytes) ||
    input.sourceBytes.byteLength < 1 ||
    input.sourceBytes.byteLength > MAXIMUM_SOURCE_BYTES
  )
    throw new TypeError("Later-source derivation requires one bounded authenticated byte buffer.");
  const output = stateForRealBuildPrefix50Step44PreparedLaterSourceDerivedOperation(input.prepared);
  if (usedPreparedOperations.has(input.prepared))
    throw new TypeError("Later-source prepared operation permits exactly one execution attempt.");
  usedPreparedOperations.add(input.prepared);
  const request = requestForRealBuildPrefix50Step44PreparedLaterSourceDerivedOperation(
    input.prepared,
  );
  const result =
    request.kind === "raster-page"
      ? renderRealBuildPrefix50Step44LaterSourceRaster(input.sourceBytes, request, output)
      : await deriveRealBuildPrefix50Step44LaterSourcePanelPrefix(input.sourceBytes, request);
  resultBrands.add(result);
  return result;
}

export function summarizeRealBuildPrefix50Step44LaterSourceDerivedOperation(input: {
  readonly sourceByteLength: number;
  readonly sourceBindingCommitment: `sha256:${string}`;
  readonly result: RealBuildPrefix50Step44LaterSourceDerivedOperationResult;
}): Readonly<{
  sourceByteLength: number;
  sourceBindingCommitment: `sha256:${string}`;
  derivedCommitment: `sha256:${string}`;
}> {
  requireRealBuildPrefix50Step44ExactKeys(
    input,
    ["result", "sourceBindingCommitment", "sourceByteLength"],
    "Later-source derived-operation summary input",
  );
  if (
    !Number.isSafeInteger(input.sourceByteLength) ||
    input.sourceByteLength < 1 ||
    !SHA256.test(input.sourceBindingCommitment) ||
    !resultBrands.has(input.result)
  )
    throw new TypeError("Later-source derived-operation summary requires its exact live result.");
  return Object.freeze({
    sourceByteLength: input.sourceByteLength,
    sourceBindingCommitment: input.sourceBindingCommitment,
    derivedCommitment: input.result.derivedCommitment,
  });
}
