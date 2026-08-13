import { Buffer } from "node:buffer";

import { sha256Digest } from "./real-build-artifacts";
import { writeContainedRegularFileAtomic } from "./contained-atomic-write";
import { ensureContainedDirectoryTree } from "./contained-directory";
import {
  prepareRealBuildSourceParityPublication,
  type RealBuildSourceParityPublicationLimits,
} from "./real-build-observation-source-parity-output-validation";
import {
  snapshotRealBuildSourceParityPublishInput,
  type RealBuildSourceParityPublishInput,
} from "./real-build-observation-source-parity-output-input";
import type {
  RealBuildSourceParityProbeResult,
  RealBuildSourceParityProvenanceRole,
} from "./real-build-observation-source-parity-types";

const OUTPUT_DIRECTORY = "output/playwright/real-build-source-parity";
const MAXIMUM_SUMMARY_BYTES = 8 * 1024 * 1024;

export function publishRealBuildObservationSourceParity(rawInput: {
  readonly repoRoot: string;
  readonly result: RealBuildSourceParityProbeResult;
  readonly provenance: readonly RealBuildSourceParityProvenanceRole[];
  /** @internal Tests may only lower hard publication bounds. */
  readonly __testLimits?: Partial<RealBuildSourceParityPublicationLimits>;
}): {
  readonly summaryPath: string;
  readonly captureBytes: number;
  readonly packedEvidenceBytes: number;
  readonly provenanceBytes: number;
} {
  const input: RealBuildSourceParityPublishInput =
    snapshotRealBuildSourceParityPublishInput(rawInput);
  const prepared = prepareRealBuildSourceParityPublication({
    repoRoot: input.repoRoot,
    result: input.result,
    provenance: input.provenance,
    ...(input.__testLimits === undefined ? {} : { limits: input.__testLimits }),
  });
  const captureDescriptors = prepared.captures.map(({ digest, width, height, bytes }) => ({
    digest,
    width,
    height,
    bytes: bytes.length,
  }));
  const packedDescriptors = prepared.packedEvidence.map(
    ({ packedDigest, pixelCount, byteLength, lowPaddingBits }) => ({
      encoding: "packed-msb/1" as const,
      packedDigest,
      pixelCount,
      byteLength,
      lowPaddingBits,
    }),
  );
  const provenanceDescriptors = prepared.provenance.map(({ role, digest, bytes }) => ({
    role,
    digest,
    bytes: bytes.length,
  }));
  const measurementDigest = sha256Digest(
    JSON.stringify({
      summaryCore: prepared.summaryCore,
      captures: captureDescriptors,
      packedEvidence: packedDescriptors,
      provenance: provenanceDescriptors,
    }),
  );
  const measurementHash = measurementDigest.slice("sha256:".length);
  const runDirectory = `${OUTPUT_DIRECTORY}/runs/${measurementHash}`;
  const publishedCaptures = captureDescriptors.map((capture) => ({
    ...capture,
    file: `${runDirectory}/captures/${capture.digest.slice("sha256:".length)}.png`,
  }));
  const publishedPackedEvidence = packedDescriptors.map((entry) => ({
    ...entry,
    file: `${runDirectory}/masks/${entry.packedDigest.slice("sha256:".length)}.bin`,
  }));
  const publishedProvenance = provenanceDescriptors.map((entry) => ({
    ...entry,
    file: `${runDirectory}/provenance/${entry.digest.slice("sha256:".length)}.bin`,
  }));
  const captureBytes = captureDescriptors.reduce((sum, capture) => sum + capture.bytes, 0);
  const packedEvidenceBytes = packedDescriptors.reduce((sum, entry) => sum + entry.byteLength, 0);
  const provenanceBytes = provenanceDescriptors.reduce((sum, entry) => sum + entry.bytes, 0);
  const summaryBytes = Buffer.from(
    `${JSON.stringify(
      {
        ...prepared.summaryCore,
        measurementDigest,
        captureBytes,
        packedEvidenceBytes,
        provenanceBytes,
        captures: publishedCaptures,
        packedEvidence: publishedPackedEvidence,
        provenance: publishedProvenance,
      },
      null,
      2,
    )}\n`,
  );
  if (summaryBytes.length > MAXIMUM_SUMMARY_BYTES) {
    throw new RangeError(
      `Source-parity JSON summary has ${summaryBytes.length} bytes, exceeding ${MAXIMUM_SUMMARY_BYTES}.`,
    );
  }

  // Content-addressed roles land first. Until the one atomic summary replacement below, any
  // interrupted write is unreferenced data and the prior public summary remains self-consistent.
  if (prepared.captures.length > 0) {
    ensureContainedDirectoryTree(
      input.repoRoot,
      `${runDirectory}/captures`,
      "Source-parity capture directory",
    );
  }
  if (prepared.packedEvidence.length > 0) {
    ensureContainedDirectoryTree(
      input.repoRoot,
      `${runDirectory}/masks`,
      "Source-parity packed-evidence directory",
    );
  }
  ensureContainedDirectoryTree(
    input.repoRoot,
    `${runDirectory}/provenance`,
    "Source-parity provenance directory",
  );
  prepared.captures.forEach((capture, index) => {
    const published = publishedCaptures[index]!;
    writeContainedRegularFileAtomic(input.repoRoot, published.file, capture.bytes, {
      label: `Source-parity capture ${capture.digest}`,
      replace: true,
    });
  });
  prepared.packedEvidence.forEach((entry, index) => {
    const published = publishedPackedEvidence[index]!;
    writeContainedRegularFileAtomic(input.repoRoot, published.file, entry.bytes, {
      label: `Source-parity packed evidence ${entry.packedDigest}`,
      replace: true,
    });
  });
  const writtenProvenance = new Set<string>();
  prepared.provenance.forEach((entry, index) => {
    if (writtenProvenance.has(entry.digest)) return;
    const published = publishedProvenance[index]!;
    writeContainedRegularFileAtomic(input.repoRoot, published.file, entry.bytes, {
      label: `Source-parity provenance ${entry.role}`,
      replace: true,
    });
    writtenProvenance.add(entry.digest);
  });
  ensureContainedDirectoryTree(input.repoRoot, OUTPUT_DIRECTORY, "Source-parity output directory");
  const summaryPath = `${OUTPUT_DIRECTORY}/summary.json`;
  writeContainedRegularFileAtomic(input.repoRoot, summaryPath, summaryBytes, {
    label: `Source-parity summary ${summaryPath}`,
    replace: true,
  });
  return { summaryPath, captureBytes, packedEvidenceBytes, provenanceBytes };
}
