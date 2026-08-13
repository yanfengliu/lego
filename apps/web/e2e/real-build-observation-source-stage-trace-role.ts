import { sha256Hex, type Sha256Digest } from "@lego-studio/brick-kernel";

import type { PanelArtStages } from "../src/assembly/panel-art-stages";
import { snapshotHostileUint8Array } from "./real-build-hostile-uint8array";
import {
  MAXIMUM_REAL_BUILD_OBSERVATION_SOURCE_STAGE_HIGH_PIXELS,
  MAXIMUM_REAL_BUILD_OBSERVATION_SOURCE_STAGE_PANELS,
  MAXIMUM_REAL_BUILD_OBSERVATION_SOURCE_STAGE_ROLE_BYTES,
  MAXIMUM_REAL_BUILD_OBSERVATION_SOURCE_STAGE_WORK_FACTOR,
  MAXIMUM_REAL_BUILD_OBSERVATION_SOURCE_STAGE_WORK_PIXELS,
  REAL_BUILD_OBSERVATION_SOURCE_STAGE_MASK_ENCODING,
  REAL_BUILD_OBSERVATION_SOURCE_STAGE_ORDER,
  REAL_BUILD_OBSERVATION_SOURCE_STAGE_ROLE,
  type RealBuildObservationSourceStageMaskReference,
  type RealBuildObservationSourceStageName,
} from "./real-build-observation-source-stage-trace-types";

export interface RealBuildObservationSourceStageRoleInput {
  readonly stepNumber: number;
  readonly stages: PanelArtStages;
}

export interface RealBuildObservationSourceStageRolePanel {
  readonly stepNumber: number;
  readonly stages: readonly RealBuildObservationSourceStageMaskReference[];
}

export interface RealBuildObservationSourceStageRoleArtifact {
  readonly byteLength: number;
  readonly digest: Sha256Digest;
  readonly panels: readonly RealBuildObservationSourceStageRolePanel[];
  readonly readBytes: () => Uint8Array;
}

interface MaskDefinition {
  readonly stage: RealBuildObservationSourceStageName;
  readonly scale: "high" | "work";
  readonly width: number;
  readonly height: number;
  readonly mask: Uint8Array;
}

const rawDigest = (bytes: Uint8Array): Sha256Digest => `sha256:${sha256Hex(bytes)}`;

function exactPixels(width: number, height: number, scale: "high" | "work"): number {
  const maximum =
    scale === "high"
      ? MAXIMUM_REAL_BUILD_OBSERVATION_SOURCE_STAGE_HIGH_PIXELS
      : MAXIMUM_REAL_BUILD_OBSERVATION_SOURCE_STAGE_WORK_PIXELS;
  const pixels = width * height;
  if (
    !Number.isSafeInteger(width) ||
    !Number.isSafeInteger(height) ||
    width < 1 ||
    height < 1 ||
    !Number.isSafeInteger(pixels) ||
    pixels > maximum
  ) {
    throw new RangeError(
      `Observation source ${scale} stage dimensions ${String(width)}x${String(height)} must cover 1 through ${maximum} pixels.`,
    );
  }
  return pixels;
}

function snapshotMask(
  value: unknown,
  pixels: number,
  stage: RealBuildObservationSourceStageName,
): Uint8Array {
  const snapshot = snapshotHostileUint8Array(value, {
    maximumBytes: pixels,
    typeError: `Observation source stage ${stage} must be one exact Uint8Array.`,
    oversizeError: (length) =>
      `Observation source stage ${stage} has ${length} pixels; expected exactly ${pixels}.`,
    sharedError: `Observation source stage ${stage} cannot use SharedArrayBuffer storage.`,
    copyError: `Observation source stage ${stage} bytes could not be copied from live storage.`,
  });
  if (snapshot.length !== pixels) {
    throw new RangeError(
      `Observation source stage ${stage} has ${snapshot.length} pixels; expected exactly ${pixels}.`,
    );
  }
  return snapshot;
}

function packMask(mask: Uint8Array, stage: RealBuildObservationSourceStageName): Uint8Array {
  const packed = new Uint8Array(Math.ceil(mask.length / 8));
  for (let pixel = 0; pixel < mask.length; pixel += 1) {
    const value = mask[pixel]!;
    if (value !== 0 && value !== 1) {
      throw new TypeError(
        `Observation source stage ${stage} pixel ${pixel} must be exactly 0 or 1; received ${value}.`,
      );
    }
    if (value === 1) {
      const byte = pixel >>> 3;
      packed[byte] = packed[byte]! | (1 << (7 - (pixel & 7)));
    }
  }
  return packed;
}

function definitions(stages: PanelArtStages): readonly MaskDefinition[] {
  if (stages.authority !== "absent") {
    throw new TypeError(
      `Observation source stages.authority observed ${String(stages.authority)}; expected absent.`,
    );
  }
  if (
    !Number.isSafeInteger(stages.workFactor) ||
    stages.workFactor < 1 ||
    stages.workFactor > MAXIMUM_REAL_BUILD_OBSERVATION_SOURCE_STAGE_WORK_FACTOR
  ) {
    throw new RangeError(
      `Observation source stages.workFactor observed ${String(stages.workFactor)}; expected a safe integer from 1 through ${MAXIMUM_REAL_BUILD_OBSERVATION_SOURCE_STAGE_WORK_FACTOR}.`,
    );
  }
  exactPixels(stages.width, stages.height, "high");
  const expectedWorkWidth = Math.ceil(stages.width / stages.workFactor);
  if (stages.workWidth !== expectedWorkWidth) {
    throw new RangeError(
      `Observation source stages.workWidth observed ${String(stages.workWidth)}; expected ${expectedWorkWidth} from ceil(${stages.width}/${stages.workFactor}).`,
    );
  }
  const expectedWorkHeight = Math.ceil(stages.height / stages.workFactor);
  if (stages.workHeight !== expectedWorkHeight) {
    throw new RangeError(
      `Observation source stages.workHeight observed ${String(stages.workHeight)}; expected ${expectedWorkHeight} from ceil(${stages.height}/${stages.workFactor}).`,
    );
  }
  exactPixels(stages.workWidth, stages.workHeight, "work");
  return [
    {
      stage: "high-cleaned-art",
      scale: "high",
      width: stages.width,
      height: stages.height,
      mask: stages.highCleanedArtMask,
    },
    {
      stage: "high-art-key-downsampled",
      scale: "work",
      width: stages.workWidth,
      height: stages.workHeight,
      mask: stages.highArtKeyDownsampledMask,
    },
    {
      stage: "high-printed-furniture-downsampled",
      scale: "work",
      width: stages.workWidth,
      height: stages.workHeight,
      mask: stages.highPrintedFurnitureDownsampledMask,
    },
    {
      stage: "high-callout-clear-downsampled",
      scale: "work",
      width: stages.workWidth,
      height: stages.workHeight,
      mask: stages.highCalloutClearDownsampledMask,
    },
    {
      stage: "high-cleaned-art-downsampled",
      scale: "work",
      width: stages.workWidth,
      height: stages.workHeight,
      mask: stages.highCleanedArtDownsampledMask,
    },
    {
      stage: "isolate-then-downsample",
      scale: "work",
      width: stages.workWidth,
      height: stages.workHeight,
      mask: stages.isolateThenDownsampleMask,
    },
    {
      stage: "downsample-then-isolate",
      scale: "work",
      width: stages.workWidth,
      height: stages.workHeight,
      mask: stages.downsampleThenIsolateMask,
    },
  ];
}

/** Packs panel-major, fixed-stage-order bytes into one bounded external role. */
export function createRealBuildObservationSourceStageRole(
  inputs: readonly RealBuildObservationSourceStageRoleInput[],
): RealBuildObservationSourceStageRoleArtifact {
  if (inputs.length < 1 || inputs.length > MAXIMUM_REAL_BUILD_OBSERVATION_SOURCE_STAGE_PANELS) {
    throw new RangeError(
      `Observation source stage role requires 1 through ${MAXIMUM_REAL_BUILD_OBSERVATION_SOURCE_STAGE_PANELS} panels; received ${inputs.length}.`,
    );
  }
  const pieces: Uint8Array[] = [];
  const panels: RealBuildObservationSourceStageRolePanel[] = [];
  let offset = 0;
  let previousStep = 0;
  for (const input of inputs) {
    if (
      !Number.isSafeInteger(input.stepNumber) ||
      input.stepNumber <= previousStep ||
      input.stepNumber > MAXIMUM_REAL_BUILD_OBSERVATION_SOURCE_STAGE_PANELS
    ) {
      throw new RangeError(
        `Observation source stage panels must be strictly step-ordered in 1..359; received ${String(input.stepNumber)} after ${previousStep}.`,
      );
    }
    previousStep = input.stepNumber;
    const references: RealBuildObservationSourceStageMaskReference[] = [];
    const panelDefinitions = definitions(input.stages);
    if (
      panelDefinitions.length !== REAL_BUILD_OBSERVATION_SOURCE_STAGE_ORDER.length ||
      panelDefinitions.some(
        ({ stage }, index) => stage !== REAL_BUILD_OBSERVATION_SOURCE_STAGE_ORDER[index],
      )
    ) {
      throw new TypeError("Observation source stage role factory violated its fixed stage order.");
    }
    for (const definition of panelDefinitions) {
      const pixelCount = exactPixels(definition.width, definition.height, definition.scale);
      const unpacked = snapshotMask(definition.mask, pixelCount, definition.stage);
      const packed = packMask(unpacked, definition.stage);
      const nextOffset = offset + packed.length;
      if (
        !Number.isSafeInteger(nextOffset) ||
        nextOffset > MAXIMUM_REAL_BUILD_OBSERVATION_SOURCE_STAGE_ROLE_BYTES
      ) {
        throw new RangeError(
          `Observation source stage role exceeds ${MAXIMUM_REAL_BUILD_OBSERVATION_SOURCE_STAGE_ROLE_BYTES} bytes at step ${input.stepNumber} stage ${definition.stage}.`,
        );
      }
      references.push(
        Object.freeze({
          stage: definition.stage,
          scale: definition.scale,
          role: REAL_BUILD_OBSERVATION_SOURCE_STAGE_ROLE,
          encoding: REAL_BUILD_OBSERVATION_SOURCE_STAGE_MASK_ENCODING,
          width: definition.width,
          height: definition.height,
          pixelCount,
          offset,
          bytes: packed.length,
          lowPaddingBits: (8 - (pixelCount & 7)) & 7,
          packedDigest: rawDigest(packed),
          unpackedDigest: rawDigest(unpacked),
        }),
      );
      pieces.push(packed);
      offset = nextOffset;
    }
    panels.push(Object.freeze({ stepNumber: input.stepNumber, stages: Object.freeze(references) }));
  }
  const bytes = new Uint8Array(offset);
  let cursor = 0;
  for (const piece of pieces) {
    bytes.set(piece, cursor);
    cursor += piece.length;
  }
  return Object.freeze({
    byteLength: bytes.length,
    digest: rawDigest(bytes),
    panels: Object.freeze(panels),
    readBytes: () => new Uint8Array(bytes),
  });
}

/** Verifies one exact packed slice and returns fresh logical 0/1 bytes. */
export function unpackRealBuildObservationSourceStageMask(
  packed: Uint8Array,
  reference: RealBuildObservationSourceStageMaskReference,
): Uint8Array {
  if (packed.length !== reference.bytes) {
    throw new TypeError(
      `Observation source stage ${reference.stage} packed length observed ${packed.length}; expected reference.bytes ${reference.bytes}.`,
    );
  }
  const expectedBytes = Math.ceil(reference.pixelCount / 8);
  if (reference.bytes !== expectedBytes) {
    throw new TypeError(
      `Observation source stage ${reference.stage} reference.bytes observed ${reference.bytes}; expected ${expectedBytes} for ${reference.pixelCount} pixels.`,
    );
  }
  const observedDigest = rawDigest(packed);
  if (observedDigest !== reference.packedDigest) {
    throw new TypeError(
      `Observation source stage ${reference.stage} packed digest observed ${observedDigest}; expected ${reference.packedDigest}.`,
    );
  }
  const expectedPadding = (8 - (reference.pixelCount & 7)) & 7;
  if (reference.lowPaddingBits !== expectedPadding) {
    throw new TypeError(
      `Observation source stage ${reference.stage} declares ${reference.lowPaddingBits} low padding bits; expected ${expectedPadding}.`,
    );
  }
  if (expectedPadding > 0 && (packed[packed.length - 1]! & ((1 << expectedPadding) - 1)) !== 0) {
    throw new TypeError(
      `Observation source stage ${reference.stage} has non-zero low MSB padding bits.`,
    );
  }
  const unpacked = new Uint8Array(reference.pixelCount);
  for (let pixel = 0; pixel < unpacked.length; pixel += 1) {
    unpacked[pixel] = (packed[pixel >>> 3]! >>> (7 - (pixel & 7))) & 1;
  }
  if (rawDigest(unpacked) !== reference.unpackedDigest) {
    throw new TypeError(
      `Observation source stage ${reference.stage} does not reproduce its logical mask digest.`,
    );
  }
  return unpacked;
}
