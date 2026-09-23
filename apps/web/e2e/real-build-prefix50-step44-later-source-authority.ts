import { realpathSync } from "node:fs";
import { resolve } from "node:path";
import { types as nodeTypes } from "node:util";

import { canonicalDigest } from "@lego-studio/brick-kernel";

import {
  assertRealBuildPrefix50Step44CameraOnlySameLiveSourceLock,
  captureRealBuildPrefix50Step44CameraOnlyLiveSourceLock,
  requireRealBuildPrefix50Step44CameraOnlyLiveSourceLock,
  type RealBuildPrefix50Step44CameraOnlyLiveSourceLock,
} from "./real-build-prefix50-step44-camera-only-source-lock.ts";
import type { RealBuildPrefix50Step44RealDomainQualificationBinding } from "./real-build-prefix50-subbuild-return-review-camera-real-domain-gate-contract.ts";
import { requireRealBuildPrefix50Step44RealDomainQualificationBinding } from "./real-build-prefix50-subbuild-return-review-camera-real-domain-gate-evidence.ts";
import {
  REAL_BUILD_PREFIX50_STEP44_SOURCE_PDF_ARTIFACT_PATH,
  REAL_BUILD_PREFIX50_STEP44_SOURCE_PDF_DIGEST,
  REAL_BUILD_PREFIX50_STEP44_SOURCE_PDF_MAXIMUM_BYTES,
} from "./real-build-prefix50-source-pdf-pins.ts";
import {
  executeRealBuildPrefix50Step44LaterSourceDerivedOperation,
  prepareRealBuildPrefix50Step44LaterSourceDerivedOperation,
  physicalPageForRealBuildPrefix50Step44LaterSourceDerivedOperation,
  requestForRealBuildPrefix50Step44PreparedLaterSourceDerivedOperation,
  summarizeRealBuildPrefix50Step44LaterSourceDerivedOperation,
  type RealBuildPrefix50Step44LaterSourceDerivedOperationRequest,
  type RealBuildPrefix50Step44LaterSourceDerivedOperationResult,
} from "./real-build-prefix50-step44-later-source-derived-operation.ts";
import {
  abandonRealBuildPrefix50Step44LaterSourceInternalTransaction,
  beginRealBuildPrefix50Step44LaterSourceInternalTransaction,
  completeRealBuildPrefix50Step44LaterSourceInternalTransaction,
} from "./real-build-prefix50-step44-later-source-ledger.ts";
import {
  runRealBuildPrefix50Step44LaterSourceLedgerClosed,
  runRealBuildPrefix50Step44LaterSourceLedgerClosedAsync,
} from "./real-build-prefix50-step44-later-source-ledger-errors.ts";
import {
  claimRealBuildPrefix50Step44LaterSourceIssuance,
  readRealBuildPrefix50Step44ReviewArtifact,
  type RealBuildPrefix50Step44LaterSourceLedgerClaim,
  type RealBuildPrefix50Step44LaterSourceLedgerPurpose,
  type RealBuildPrefix50Step44LaterSourceTransactionEvidence,
} from "./real-build-prefix50-subbuild-return-review-artifact-io.ts";

export type RealBuildPrefix50Step44LaterSourceReadPurpose =
  RealBuildPrefix50Step44LaterSourceLedgerPurpose;
export type RealBuildPrefix50Step44LaterSourceDerivationRequest =
  RealBuildPrefix50Step44LaterSourceDerivedOperationRequest;
export type RealBuildPrefix50Step44LaterSourceDerivationResult =
  RealBuildPrefix50Step44LaterSourceDerivedOperationResult;

export interface RealBuildPrefix50Step44LaterSourceReadCapability {
  readonly schemaVersion: "lego.real-build-prefix50-step44-later-source-read-capability/2";
  readonly purpose: RealBuildPrefix50Step44LaterSourceReadPurpose;
  readonly physicalPageNumber: 44 | 45;
  readonly sourceLockCommitment: `sha256:${string}`;
  readonly qualificationCommitment: `sha256:${string}`;
  readonly commitment: `sha256:${string}`;
}

interface CapabilityState {
  readonly repositoryRoot: string;
  readonly maximumSourceBytes: number;
  readonly qualification: RealBuildPrefix50Step44RealDomainQualificationBinding;
  readonly sourceLock: RealBuildPrefix50Step44CameraOnlyLiveSourceLock;
  readonly claim: RealBuildPrefix50Step44LaterSourceLedgerClaim;
}

const capabilities = new WeakMap<object, CapabilityState>();
const consumedCapabilities = new WeakSet<object>();
const issuedQualificationPurposes = new Set<string>();
const INVALID_REQUEST_SNAPSHOT = Object.freeze({ malformedRequest: true as const });
const PURPOSE_PAGES: Readonly<Record<RealBuildPrefix50Step44LaterSourceReadPurpose, 44 | 45>> =
  Object.freeze({
    "page44-step43-vector": 44,
    "page45-step44-vector": 45,
    "page45-camera-raster": 45,
    "page45-contact-raster": 45,
    "page45-review-artifact-raster": 45,
    "page45-promotion-raster": 45,
  });

function requirePurposePage(
  purpose: RealBuildPrefix50Step44LaterSourceReadPurpose,
  physicalPageNumber: 44 | 45,
): void {
  const expectedPage = PURPOSE_PAGES[purpose];
  if (expectedPage === undefined)
    throw new TypeError("Later-source purpose must be one closed finite operation.");
  if (physicalPageNumber !== expectedPage)
    throw new TypeError("Later-source purpose and physical page binding is invalid.");
}

function claimFor(
  capability: RealBuildPrefix50Step44LaterSourceReadCapability,
): RealBuildPrefix50Step44LaterSourceLedgerClaim {
  return Object.freeze({
    qualificationCommitment: capability.qualificationCommitment,
    sourceLockCommitment: capability.sourceLockCommitment,
    purpose: capability.purpose,
    physicalPageNumber: capability.physicalPageNumber,
    capabilityCommitment: capability.commitment,
  });
}

function snapshotRequest(value: unknown): unknown {
  try {
    if (
      value === null ||
      typeof value !== "object" ||
      Array.isArray(value) ||
      nodeTypes.isProxy(value) ||
      (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)
    )
      return INVALID_REQUEST_SNAPSHOT;
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const keys = Reflect.ownKeys(descriptors);
    if (keys.length < 1 || keys.length > 4 || keys.some((key) => typeof key !== "string"))
      return INVALID_REQUEST_SNAPSHOT;
    const snapshot: Record<string, string | number | boolean> = {};
    for (const key of keys as string[]) {
      const descriptor = descriptors[key]!;
      if (
        !("value" in descriptor) ||
        (typeof descriptor.value !== "string" &&
          typeof descriptor.value !== "number" &&
          typeof descriptor.value !== "boolean")
      )
        return INVALID_REQUEST_SNAPSHOT;
      snapshot[key] = descriptor.value;
    }
    return Object.freeze(snapshot);
  } catch {
    return INVALID_REQUEST_SNAPSHOT;
  }
}

function snapshotInvocation(value: unknown): Readonly<{
  capability: unknown;
  request: unknown;
}> {
  if (
    value === null ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    nodeTypes.isProxy(value)
  )
    throw new TypeError(
      "Later-source access requires one exact data-only capability/request invocation.",
    );
  let descriptors: PropertyDescriptorMap;
  try {
    descriptors = Object.getOwnPropertyDescriptors(value);
  } catch {
    throw new TypeError(
      "Later-source access requires one exact data-only capability/request invocation.",
    );
  }
  const keys = Reflect.ownKeys(descriptors);
  const capability = descriptors.capability;
  if (capability === undefined || !("value" in capability))
    throw new TypeError(
      "Later-source access requires one exact data-only capability/request invocation.",
    );
  const request = descriptors.request;
  const exactOuter =
    keys.length === 2 &&
    keys.every((key) => key === "capability" || key === "request") &&
    request !== undefined &&
    "value" in request;
  return Object.freeze({
    capability: capability.value,
    request: exactOuter ? snapshotRequest(request.value) : INVALID_REQUEST_SNAPSHOT,
  });
}

export function issueRealBuildPrefix50Step44LaterSourceReadCapability(input: {
  readonly repositoryRoot: string;
  readonly qualification: RealBuildPrefix50Step44RealDomainQualificationBinding;
  readonly purpose: RealBuildPrefix50Step44LaterSourceReadPurpose;
  readonly physicalPageNumber: 44 | 45;
}): RealBuildPrefix50Step44LaterSourceReadCapability {
  requirePurposePage(input.purpose, input.physicalPageNumber);
  const qualification = requireRealBuildPrefix50Step44RealDomainQualificationBinding(
    input.qualification,
  );
  const issuanceKey = canonicalDigest({
    qualificationCommitment: qualification.commitment,
    purpose: input.purpose,
  });
  if (issuedQualificationPurposes.has(issuanceKey))
    throw new TypeError(
      `This post-Step-43 qualification has already issued its one ${input.purpose} source operation.`,
    );
  let repositoryRoot: string;
  let sourceLock: RealBuildPrefix50Step44CameraOnlyLiveSourceLock;
  try {
    repositoryRoot = realpathSync(resolve(input.repositoryRoot));
    sourceLock = requireRealBuildPrefix50Step44CameraOnlyLiveSourceLock(
      captureRealBuildPrefix50Step44CameraOnlyLiveSourceLock(repositoryRoot),
    );
  } catch {
    throw new TypeError(
      "Later Step-43/44 source access requires its exact still-live PDF source lock.",
    );
  }
  if (
    sourceLock.runtimeIdentity.repoRoot !== repositoryRoot ||
    qualification.sourceLockCommitment !== sourceLock.evidence.commitment
  )
    throw new TypeError(
      "Later Step-43/44 source access requires the qualification's exact still-live PDF source lock.",
    );
  const body = {
    schemaVersion: "lego.real-build-prefix50-step44-later-source-read-capability/2" as const,
    purpose: input.purpose,
    physicalPageNumber: input.physicalPageNumber,
    sourceLockCommitment: qualification.sourceLockCommitment,
    qualificationCommitment: qualification.commitment,
  };
  const capability = Object.freeze({ ...body, commitment: canonicalDigest(body) });
  const claim = claimFor(capability);
  claimRealBuildPrefix50Step44LaterSourceIssuance({ repositoryRoot, claim });
  issuedQualificationPurposes.add(issuanceKey);
  capabilities.set(
    capability,
    Object.freeze({
      repositoryRoot,
      maximumSourceBytes: REAL_BUILD_PREFIX50_STEP44_SOURCE_PDF_MAXIMUM_BYTES,
      qualification,
      sourceLock,
      claim,
    }),
  );
  return capability;
}

export async function executeRealBuildPrefix50Step44LaterSourceDerivation(input: {
  readonly capability: RealBuildPrefix50Step44LaterSourceReadCapability;
  readonly request: RealBuildPrefix50Step44LaterSourceDerivationRequest;
}): Promise<
  Readonly<{
    transactionEvidence: RealBuildPrefix50Step44LaterSourceTransactionEvidence;
    result: RealBuildPrefix50Step44LaterSourceDerivationResult;
  }>
> {
  const invocation = snapshotInvocation(input);
  const capability = invocation.capability as RealBuildPrefix50Step44LaterSourceReadCapability;
  const state = capabilities.get(capability);
  if (capability === null || typeof capability !== "object" || state === undefined)
    throw new TypeError(
      "Later-source access requires its exact opaque post-Step-43 qualification capability.",
    );
  const { commitment, ...body } = capability;
  if (
    commitment !== canonicalDigest(body) ||
    capability.schemaVersion !== "lego.real-build-prefix50-step44-later-source-read-capability/2"
  )
    throw new TypeError(
      "Later-source access requires its exact opaque post-Step-43 qualification capability.",
    );
  if (consumedCapabilities.has(capability))
    throw new TypeError("This later-source operation has already been consumed.");
  consumedCapabilities.add(capability);
  const prepared = runRealBuildPrefix50Step44LaterSourceLedgerClosed(() =>
    prepareRealBuildPrefix50Step44LaterSourceDerivedOperation({
      repositoryRoot: state.repositoryRoot,
      request: invocation.request,
    }),
  );
  const operationCommitment = canonicalDigest({
    schemaVersion: "lego.real-build-prefix50-step44-later-source-derived-operation/2",
    capabilityCommitment: capability.commitment,
    preparedOperationCommitment: prepared.commitment,
  });
  const transaction = runRealBuildPrefix50Step44LaterSourceLedgerClosed(() =>
    beginRealBuildPrefix50Step44LaterSourceInternalTransaction({
      repositoryRoot: state.repositoryRoot,
      claim: state.claim,
      operationCommitment,
    }),
  );
  let bytes: Buffer | undefined;
  try {
    const request = requestForRealBuildPrefix50Step44PreparedLaterSourceDerivedOperation(prepared);
    const physicalPageNumber =
      physicalPageForRealBuildPrefix50Step44LaterSourceDerivedOperation(prepared);
    if (
      capability.purpose !== request.purpose ||
      capability.physicalPageNumber !== physicalPageNumber
    )
      throw new TypeError(
        "Later-source request does not match the finite purpose/page; the operation is consumed.",
      );
    const qualification = requireRealBuildPrefix50Step44RealDomainQualificationBinding(
      state.qualification,
    );
    const before = requireRealBuildPrefix50Step44CameraOnlyLiveSourceLock(state.sourceLock);
    const after = captureRealBuildPrefix50Step44CameraOnlyLiveSourceLock(state.repositoryRoot);
    assertRealBuildPrefix50Step44CameraOnlySameLiveSourceLock({ before, after });
    if (
      qualification.commitment !== capability.qualificationCommitment ||
      qualification.sourceLockCommitment !== capability.sourceLockCommitment ||
      after.evidence.commitment !== capability.sourceLockCommitment
    )
      throw new TypeError(
        "Later-source operation lost its persisted qualification or live source-lock binding.",
      );
    bytes = runRealBuildPrefix50Step44LaterSourceLedgerClosed(() =>
      readRealBuildPrefix50Step44ReviewArtifact(
        state.repositoryRoot,
        REAL_BUILD_PREFIX50_STEP44_SOURCE_PDF_ARTIFACT_PATH,
        state.maximumSourceBytes,
        "Step-44 later-source authenticated input",
        REAL_BUILD_PREFIX50_STEP44_SOURCE_PDF_DIGEST,
      ),
    );
    const sourceBindingCommitment = canonicalDigest({
      capabilityCommitment: capability.commitment,
      qualificationCommitment: capability.qualificationCommitment,
      sourceLockCommitment: capability.sourceLockCommitment,
      sourceByteLength: bytes.byteLength,
      sourceDigest: REAL_BUILD_PREFIX50_STEP44_SOURCE_PDF_DIGEST,
    });
    const result = await runRealBuildPrefix50Step44LaterSourceLedgerClosedAsync(() =>
      executeRealBuildPrefix50Step44LaterSourceDerivedOperation({ sourceBytes: bytes!, prepared }),
    );
    const transactionEvidence = runRealBuildPrefix50Step44LaterSourceLedgerClosed(() =>
      completeRealBuildPrefix50Step44LaterSourceInternalTransaction({
        transaction,
        evidence: summarizeRealBuildPrefix50Step44LaterSourceDerivedOperation({
          sourceByteLength: bytes!.byteLength,
          sourceBindingCommitment,
          result,
        }),
      }),
    );
    return Object.freeze({ transactionEvidence, result });
  } catch (error) {
    runRealBuildPrefix50Step44LaterSourceLedgerClosed(() =>
      abandonRealBuildPrefix50Step44LaterSourceInternalTransaction(transaction),
    );
    throw error;
  } finally {
    bytes?.fill(0);
  }
}
