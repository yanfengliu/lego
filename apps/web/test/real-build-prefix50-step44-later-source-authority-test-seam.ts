import { resolve } from "node:path";

import { canonicalDigest } from "@lego-studio/brick-kernel";

import { readContainedBoundedRegularFile } from "../e2e/bounded-file-read.ts";
import {
  executeRealBuildPrefix50Step44LaterSourceDerivedOperation,
  prepareRealBuildPrefix50Step44LaterSourceDerivedOperation,
  physicalPageForRealBuildPrefix50Step44LaterSourceDerivedOperation,
  requestForRealBuildPrefix50Step44PreparedLaterSourceDerivedOperation,
  summarizeRealBuildPrefix50Step44LaterSourceDerivedOperation,
} from "../e2e/real-build-prefix50-step44-later-source-derived-operation.ts";
import type {
  RealBuildPrefix50Step44LaterSourceDerivationRequest,
  RealBuildPrefix50Step44LaterSourceDerivationResult,
  RealBuildPrefix50Step44LaterSourceReadCapability,
  RealBuildPrefix50Step44LaterSourceReadPurpose,
} from "../e2e/real-build-prefix50-step44-later-source-authority.ts";

interface TestSourceState {
  readonly repositoryRoot: string;
  readonly sourcePdfArtifactPath: string;
  readonly sourcePdfDigest: `sha256:${string}`;
  readonly maximumSourceBytes: number;
}

const states = new WeakMap<object, TestSourceState>();
const consumed = new WeakSet<object>();

export function issueRealBuildPrefix50Step44LaterSourceReadCapabilityForTest(input: {
  readonly repositoryRoot: string;
  readonly sourcePdfArtifactPath: string;
  readonly sourcePdfDigest: `sha256:${string}`;
  readonly maximumSourceBytes: number;
  readonly purpose: RealBuildPrefix50Step44LaterSourceReadPurpose;
  readonly physicalPageNumber: 44 | 45;
}): RealBuildPrefix50Step44LaterSourceReadCapability {
  const body = {
    schemaVersion: "lego.real-build-prefix50-step44-later-source-read-capability/2" as const,
    purpose: input.purpose,
    physicalPageNumber: input.physicalPageNumber,
    sourceLockCommitment: canonicalDigest({ authority: "test-owned-seam" }),
    qualificationCommitment: canonicalDigest({ authority: "test-owned-seam" }),
  };
  const capability = Object.freeze({ ...body, commitment: canonicalDigest(body) });
  states.set(
    capability,
    Object.freeze({
      repositoryRoot: resolve(input.repositoryRoot),
      sourcePdfArtifactPath: input.sourcePdfArtifactPath,
      sourcePdfDigest: input.sourcePdfDigest,
      maximumSourceBytes: input.maximumSourceBytes,
    }),
  );
  return capability;
}

export async function executeRealBuildPrefix50Step44LaterSourceDerivation(input: {
  readonly capability: RealBuildPrefix50Step44LaterSourceReadCapability;
  readonly request: RealBuildPrefix50Step44LaterSourceDerivationRequest;
}): Promise<
  Readonly<{
    transactionEvidence: Readonly<{
      schemaVersion: "lego.real-build-prefix50-step44-later-source-transaction-evidence/2";
      operationCommitment: `sha256:${string}`;
      sourceByteLength: number;
      sourceBindingCommitment: `sha256:${string}`;
      derivedCommitment: `sha256:${string}`;
      transactionCommitment: `sha256:${string}`;
    }>;
    result: RealBuildPrefix50Step44LaterSourceDerivationResult;
  }>
> {
  const state = states.get(input.capability);
  if (state === undefined)
    throw new TypeError("Test-owned later-source authority refused an unknown capability.");
  if (consumed.has(input.capability))
    throw new TypeError("This test-owned later-source operation has already been consumed.");
  consumed.add(input.capability);
  const prepared = prepareRealBuildPrefix50Step44LaterSourceDerivedOperation({
    repositoryRoot: state.repositoryRoot,
    request: input.request,
  });
  const request = requestForRealBuildPrefix50Step44PreparedLaterSourceDerivedOperation(prepared);
  const physicalPageNumber =
    physicalPageForRealBuildPrefix50Step44LaterSourceDerivedOperation(prepared);
  if (
    input.capability.purpose !== request.purpose ||
    input.capability.physicalPageNumber !== physicalPageNumber
  )
    throw new TypeError("Test-owned later-source request mismatch; operation burned.");
  const bytes = readContainedBoundedRegularFile(state.repositoryRoot, state.sourcePdfArtifactPath, {
    label: "test-owned later-source input",
    minimumBytes: 1,
    maximumBytes: state.maximumSourceBytes,
    expectedSha256: state.sourcePdfDigest,
  });
  try {
    const result = await executeRealBuildPrefix50Step44LaterSourceDerivedOperation({
      sourceBytes: bytes,
      prepared,
    });
    const operationCommitment = canonicalDigest({
      capabilityCommitment: input.capability.commitment,
      preparedOperationCommitment: prepared.commitment,
    });
    const summary = summarizeRealBuildPrefix50Step44LaterSourceDerivedOperation({
      sourceByteLength: bytes.byteLength,
      sourceBindingCommitment: canonicalDigest({
        capabilityCommitment: input.capability.commitment,
        sourceByteLength: bytes.byteLength,
        sourceDigest: state.sourcePdfDigest,
      }),
      result,
    });
    const body = {
      schemaVersion: "lego.real-build-prefix50-step44-later-source-transaction-evidence/2" as const,
      operationCommitment,
      ...summary,
    };
    return Object.freeze({
      transactionEvidence: Object.freeze({
        ...body,
        transactionCommitment: canonicalDigest(body),
      }),
      result,
    });
  } finally {
    bytes.fill(0);
  }
}

export function issueRealBuildPrefix50Step44LaterSourceReadCapability(): never {
  throw new TypeError("Production later-source issuance is unavailable in the test-owned seam.");
}
