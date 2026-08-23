import type { BrickDocumentV1 } from "@lego-studio/protocol";

import {
  detachAndFreezeExactPlainData,
  detachExactPlainData,
  exactPlainDataBytes,
} from "./real-build-step7-gate3-exact-plain-data";
import type { Step7Gate3ParentReconstructionDependencies } from "./real-build-step7-gate3-parent-reconstruction-types";

const SAFE_TYPE_ERROR = TypeError;

export function detachedStructuralHash(
  document: BrickDocumentV1,
  label: string,
  dependencies: Step7Gate3ParentReconstructionDependencies,
): { readonly bytes: string; readonly hash: string } {
  const bytes = exactPlainDataBytes(document, `${label} structural-hash authority`);
  const detached = detachExactPlainData(document, `${label} detached structural-hash input`);
  if (detached.bytes !== bytes) {
    throw new SAFE_TYPE_ERROR(`${label} changed while its structural-hash input was detached.`);
  }
  const hash = dependencies.documentStructuralHash(detached.value);
  if (exactPlainDataBytes(document, `${label} structural-hash closure`) !== bytes) {
    throw new SAFE_TYPE_ERROR(`${label} changed while its detached structural hash was measured.`);
  }
  return { bytes, hash };
}

export function detachedTruthDigest(
  document: BrickDocumentV1,
  label: string,
  dependencies: Step7Gate3ParentReconstructionDependencies,
): string {
  const documentBytes = exactPlainDataBytes(document, `${label} document`);
  const detachedTruth = detachAndFreezeExactPlainData(document.truth, `${label} truth`);
  const digest = dependencies.truthDigest(detachedTruth.value);
  if (
    exactPlainDataBytes(document, `${label} document closure`) !== documentBytes ||
    exactPlainDataBytes(detachedTruth.value, `${label} detached truth closure`) !==
      detachedTruth.bytes
  ) {
    throw new SAFE_TYPE_ERROR(`${label} changed while its detached truth digest was measured.`);
  }
  return digest;
}
