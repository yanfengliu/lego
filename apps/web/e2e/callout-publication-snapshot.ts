import { isProxy } from "node:util/types";

import { snapshotBoundedBuffer } from "./callout-publication-buffer";
import {
  snapshotCalloutManifest,
  snapshotPublishedCallout,
} from "./callout-publication-schema-snapshot";
import type { CalloutManifest, PublishedCallout } from "./callout-types";

const JSON_STRINGIFY = JSON.stringify;
const BUFFER_BYTE_LENGTH = Buffer.byteLength;
const BUFFER_FROM = Buffer.from;

export const CALLOUT_PUBLICATION_LIMITS = Object.freeze({
  maxCropBytes: 2 * 1024 * 1024,
  maxRunBytes: 32 * 1024 * 1024,
  maxPointerBytes: 4 * 1024 * 1024,
  maxMetadataSnapshotBytes: 8 * 1024 * 1024,
  maxMetadataSnapshotNodes: 150_000,
  maxRetainedRunBytes: 128 * 1024 * 1024,
});

export interface PreparedCrop {
  readonly metadata: PublishedCallout;
  readonly png: Buffer;
}

export type PublishFaultPhase = "before-run-promote" | "before-pointer-swap";

export interface PublishCalloutRunInput {
  readonly outDirectory: string;
  readonly pointerFile: "manifest.json" | "manifest.partial.json";
  readonly runId: string;
  readonly manifest: CalloutManifest;
  readonly crops: readonly PreparedCrop[];
  readonly fault?: (phase: PublishFaultPhase) => void;
}

function ownData<T>(value: unknown, key: string, label: string, optional = false): T | undefined {
  if (
    value === null ||
    (typeof value !== "object" && typeof value !== "function") ||
    isProxy(value)
  )
    throw new Error(`${label} must be one non-Proxy object with stable own data properties.`);
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  if (descriptor === undefined && optional) return undefined;
  if (descriptor === undefined || !("value" in descriptor)) {
    throw new Error(`${label}.${key} must be one stable own data property.`);
  }
  return descriptor.value as T;
}

function manifestBytes(report: {
  readonly value: CalloutManifest;
  readonly encodedBytes: number;
}): Buffer {
  if (report.encodedBytes + 1 > CALLOUT_PUBLICATION_LIMITS.maxRunBytes) {
    throw new Error("Callout manifest plus its newline exceeds the bounded run byte limit.");
  }
  const encoded = Reflect.apply(JSON_STRINGIFY, JSON, [report.value]) as string;
  if (Reflect.apply(BUFFER_BYTE_LENGTH, Buffer, [encoded]) !== report.encodedBytes) {
    throw new Error(
      "Callout manifest strict snapshot and compact encoder disagree on byte length.",
    );
  }
  return Reflect.apply(BUFFER_FROM, Buffer, [`${encoded}\n`]) as Buffer;
}

export function snapshotPublicationInput(input: PublishCalloutRunInput): {
  readonly input: PublishCalloutRunInput;
  readonly bytes: Buffer;
} {
  const outDirectory = ownData<string>(input, "outDirectory", "Callout publication input")!;
  const pointerFile = ownData<PublishCalloutRunInput["pointerFile"]>(
    input,
    "pointerFile",
    "Callout publication input",
  )!;
  const runId = ownData<string>(input, "runId", "Callout publication input")!;
  const fault = ownData<PublishCalloutRunInput["fault"]>(
    input,
    "fault",
    "Callout publication input",
    true,
  );
  const sourceManifest = ownData<unknown>(input, "manifest", "Callout publication input");
  const sourceCrops = ownData<unknown>(input, "crops", "Callout publication input");
  const sourceCropCount =
    Array.isArray(sourceCrops) && !isProxy(sourceCrops)
      ? ownData<number>(sourceCrops, "length", "Callout publication crops")!
      : -1;
  if (Array.isArray(sourceCrops) && sourceCropCount === 0) {
    throw new Error("Callout publication cannot publish an empty manifest or crop set.");
  }
  if (
    typeof outDirectory !== "string" ||
    outDirectory.length < 1 ||
    outDirectory.length > 32_768 ||
    outDirectory.includes("\0") ||
    (pointerFile !== "manifest.json" && pointerFile !== "manifest.partial.json") ||
    typeof runId !== "string" ||
    !/^[0-9a-f]{24}$/u.test(runId) ||
    !Array.isArray(sourceCrops) ||
    sourceCropCount < 1 ||
    sourceCropCount > 2_000 ||
    (fault !== undefined && typeof fault !== "function")
  ) {
    throw new Error(
      "Callout publication requires one bounded output path, an exact pointer name and run id, 1..2000 crops, and an optional fault callback before snapshotting.",
    );
  }
  const manifestReport = snapshotCalloutManifest(
    sourceManifest,
    "Callout manifest",
    CALLOUT_PUBLICATION_LIMITS.maxRunBytes,
  );
  const manifest = manifestReport.value;
  if (!Array.isArray(manifest.callouts) || manifest.callouts.length === 0) {
    throw new Error("Callout publication cannot publish an empty manifest or crop set.");
  }
  if (manifest.callouts.length > 2_000 || !Array.isArray(manifest.failures)) {
    throw new Error(
      "Callout publication requires 1..2000 manifest records and an exact empty failures array.",
    );
  }
  const bytes = manifestBytes(manifestReport);
  let aggregateBytes = bytes.length;
  const crops: PreparedCrop[] = [];
  let metadataBytes = 0;
  let metadataNodes = 0;
  for (let index = 0; index < sourceCropCount; index += 1) {
    const sourceCrop = ownData<object>(sourceCrops, String(index), "Callout publication crops")!;
    const sourceMetadata = ownData<unknown>(sourceCrop, "metadata", `Callout crop ${index}`);
    const remainingMetadataBytes =
      CALLOUT_PUBLICATION_LIMITS.maxMetadataSnapshotBytes - metadataBytes;
    const remainingMetadataNodes =
      CALLOUT_PUBLICATION_LIMITS.maxMetadataSnapshotNodes - metadataNodes;
    if (remainingMetadataBytes < 1 || remainingMetadataNodes < 1) {
      throw new Error(`Callout crop metadata work budget is exhausted before crop ${index}.`);
    }
    const metadataReport = snapshotPublishedCallout(
      sourceMetadata,
      `Callout crop ${index} metadata`,
      Math.min(128 * 1024, remainingMetadataBytes),
      remainingMetadataNodes,
    );
    metadataBytes += metadataReport.encodedBytes;
    metadataNodes += metadataReport.nodes;
    const sourcePng = snapshotBoundedBuffer(
      ownData<unknown>(sourceCrop, "png", `Callout crop ${index}`),
      `Callout crop ${index} PNG`,
      CALLOUT_PUBLICATION_LIMITS.maxCropBytes,
      (byteLength) => {
        const next = aggregateBytes + byteLength;
        if (!Number.isSafeInteger(next) || next > CALLOUT_PUBLICATION_LIMITS.maxRunBytes) {
          throw new Error(
            `Callout snapshot reaches ${next} bytes at crop ${index}, above the ${CALLOUT_PUBLICATION_LIMITS.maxRunBytes}-byte run limit before PNG copying.`,
          );
        }
        aggregateBytes = next;
      },
    );
    crops.push({ metadata: metadataReport.value, png: sourcePng });
  }
  return {
    input: {
      outDirectory,
      pointerFile,
      runId,
      manifest,
      crops,
      ...(fault === undefined ? {} : { fault }),
    },
    bytes,
  };
}
