import { sha256Hex, type Sha256Digest } from "@lego-studio/brick-kernel";

import { analysePanelArtStageComponents } from "../src/assembly/panel-art-stages";
import { snapshotHostileUint8Array } from "./real-build-hostile-uint8array";
import {
  compareRealBuildObservationSourceStageTopology,
  realBuildObservationSourceStageComponentFacts,
} from "./real-build-observation-source-stage-trace-trace";
import {
  denseStageTraceArray as denseArray,
  exactStageTraceRecord as exactRecord,
  requireCanonicalStageTraceJson,
  requireExactStageTraceMatch,
  requireExactStageTraceUtf8,
  stageTraceDigest as digest,
  stageTraceInteger as integer,
} from "./real-build-observation-source-stage-trace-parser-structure";
import { parseRealBuildObservationSourceStageReference as parseReference } from "./real-build-observation-source-stage-trace-parser-reference";
import {
  MAXIMUM_REAL_BUILD_OBSERVATION_SOURCE_STAGE_HIGH_PIXELS,
  MAXIMUM_REAL_BUILD_OBSERVATION_SOURCE_STAGE_MANIFEST_BYTES,
  MAXIMUM_REAL_BUILD_OBSERVATION_SOURCE_STAGE_PANELS,
  MAXIMUM_REAL_BUILD_OBSERVATION_SOURCE_STAGE_ROLE_BYTES,
  MAXIMUM_REAL_BUILD_OBSERVATION_SOURCE_STAGE_VERIFICATION_PIXELS,
  MAXIMUM_REAL_BUILD_OBSERVATION_SOURCE_STAGE_WORK_FACTOR,
  MAXIMUM_REAL_BUILD_OBSERVATION_SOURCE_STAGE_WORK_PIXELS,
  REAL_BUILD_OBSERVATION_SOURCE_STAGE_ORDER,
  REAL_BUILD_OBSERVATION_SOURCE_STAGE_ROLE,
  REAL_BUILD_OBSERVATION_SOURCE_STAGE_TRACE_SCHEMA,
  type RealBuildObservationSourceStageMaskReference,
  type RealBuildObservationSourceStagePanelTrace,
  type RealBuildObservationSourceStageTrace,
} from "./real-build-observation-source-stage-trace-types";

const rawDigest = (bytes: Uint8Array): Sha256Digest => `sha256:${sha256Hex(bytes)}`;

function unpackSlice(
  role: Uint8Array,
  reference: RealBuildObservationSourceStageMaskReference,
  path: string,
): Uint8Array {
  const packed = role.subarray(reference.offset, reference.offset + reference.bytes);
  const observedPackedDigest = rawDigest(packed);
  if (observedPackedDigest !== reference.packedDigest) {
    throw new TypeError(
      `${path}.packedDigest observed ${observedPackedDigest}; expected ${reference.packedDigest}.`,
    );
  }
  if (
    reference.lowPaddingBits > 0 &&
    (packed[packed.length - 1]! & ((1 << reference.lowPaddingBits) - 1)) !== 0
  ) {
    throw new TypeError(
      `${path}.packedBytes observed non-zero low MSB padding bits; expected ${reference.lowPaddingBits} zero low padding bits.`,
    );
  }
  const unpacked = new Uint8Array(reference.pixelCount);
  for (let pixel = 0; pixel < unpacked.length; pixel += 1) {
    unpacked[pixel] = (packed[pixel >>> 3]! >>> (7 - (pixel & 7))) & 1;
  }
  const observedUnpackedDigest = rawDigest(unpacked);
  if (observedUnpackedDigest !== reference.unpackedDigest) {
    throw new TypeError(
      `${path}.unpackedDigest observed ${observedUnpackedDigest}; expected ${reference.unpackedDigest}.`,
    );
  }
  return unpacked;
}

interface PanelPreflight {
  readonly path: string;
  readonly record: Record<string, unknown>;
  readonly stepNumber: number;
  readonly pageNumber: number;
  readonly source: RealBuildObservationSourceStagePanelTrace["source"];
  readonly dimensions: RealBuildObservationSourceStagePanelTrace["dimensions"];
  readonly stages: readonly RealBuildObservationSourceStageMaskReference[];
  readonly nextOffset: number;
  readonly logicalPixels: number;
}

function preflightPanel(
  value: unknown,
  path: string,
  previousStep: number,
  expectedOffset: number,
  declaredRoleBytes: number,
): PanelPreflight {
  const record = exactRecord(value, path, [
    "stepNumber",
    "pageNumber",
    "source",
    "dimensions",
    "highComponents",
    "downsampledComponents",
    "topology",
    "workOnlyStage",
    "stages",
  ]);
  const stepNumber = integer(record.stepNumber, `${path}.stepNumber`, previousStep + 1, 359);
  const pageNumber = integer(record.pageNumber, `${path}.pageNumber`, 1, Number.MAX_SAFE_INTEGER);
  const source = exactRecord(record.source, `${path}.source`, [
    "schemaVersion",
    "reproduction",
    "pdfDigest",
    "panelEvidenceDigest",
    "cropDescriptorDigest",
    "policyDescriptorDigest",
    "workPixelsDigest",
  ]);
  requireExactStageTraceMatch(
    source.schemaVersion,
    "lego.real-build-observation-source-stage-opaque-provenance/1",
    `${path}.source.schemaVersion`,
  );
  requireExactStageTraceMatch(source.reproduction, "not-claimed", `${path}.source.reproduction`);
  const parsedSource = Object.freeze({
    schemaVersion: "lego.real-build-observation-source-stage-opaque-provenance/1" as const,
    reproduction: "not-claimed" as const,
    pdfDigest: digest(source.pdfDigest, `${path}.source.pdfDigest`),
    panelEvidenceDigest: digest(source.panelEvidenceDigest, `${path}.source.panelEvidenceDigest`),
    cropDescriptorDigest: digest(
      source.cropDescriptorDigest,
      `${path}.source.cropDescriptorDigest`,
    ),
    policyDescriptorDigest: digest(
      source.policyDescriptorDigest,
      `${path}.source.policyDescriptorDigest`,
    ),
    workPixelsDigest: digest(source.workPixelsDigest, `${path}.source.workPixelsDigest`),
  });
  const dimensions = exactRecord(record.dimensions, `${path}.dimensions`, [
    "highWidth",
    "highHeight",
    "workWidth",
    "workHeight",
    "workFactor",
  ]);
  const workFactor = integer(
    dimensions.workFactor,
    `${path}.dimensions.workFactor`,
    1,
    MAXIMUM_REAL_BUILD_OBSERVATION_SOURCE_STAGE_WORK_FACTOR,
  );
  const highWidth = integer(
    dimensions.highWidth,
    `${path}.dimensions.highWidth`,
    1,
    MAXIMUM_REAL_BUILD_OBSERVATION_SOURCE_STAGE_HIGH_PIXELS,
  );
  const highHeight = integer(
    dimensions.highHeight,
    `${path}.dimensions.highHeight`,
    1,
    MAXIMUM_REAL_BUILD_OBSERVATION_SOURCE_STAGE_HIGH_PIXELS,
  );
  const workWidth = integer(
    dimensions.workWidth,
    `${path}.dimensions.workWidth`,
    1,
    MAXIMUM_REAL_BUILD_OBSERVATION_SOURCE_STAGE_WORK_PIXELS,
  );
  const workHeight = integer(
    dimensions.workHeight,
    `${path}.dimensions.workHeight`,
    1,
    MAXIMUM_REAL_BUILD_OBSERVATION_SOURCE_STAGE_WORK_PIXELS,
  );
  const highPixels = highWidth * highHeight;
  if (highPixels > MAXIMUM_REAL_BUILD_OBSERVATION_SOURCE_STAGE_HIGH_PIXELS) {
    throw new RangeError(
      `${path}.dimensions high raster observed ${highWidth}x${highHeight} = ${highPixels} pixels; expected at most ${MAXIMUM_REAL_BUILD_OBSERVATION_SOURCE_STAGE_HIGH_PIXELS}.`,
    );
  }
  const workPixels = workWidth * workHeight;
  if (workPixels > MAXIMUM_REAL_BUILD_OBSERVATION_SOURCE_STAGE_WORK_PIXELS) {
    throw new RangeError(
      `${path}.dimensions work raster observed ${workWidth}x${workHeight} = ${workPixels} pixels; expected at most ${MAXIMUM_REAL_BUILD_OBSERVATION_SOURCE_STAGE_WORK_PIXELS}.`,
    );
  }
  const expectedWorkWidth = Math.ceil(highWidth / workFactor);
  if (workWidth !== expectedWorkWidth) {
    throw new RangeError(
      `${path}.dimensions.workWidth observed ${workWidth}; expected ${expectedWorkWidth} from ceil(${highWidth}/${workFactor}).`,
    );
  }
  const expectedWorkHeight = Math.ceil(highHeight / workFactor);
  if (workHeight !== expectedWorkHeight) {
    throw new RangeError(
      `${path}.dimensions.workHeight observed ${workHeight}; expected ${expectedWorkHeight} from ceil(${highHeight}/${workFactor}).`,
    );
  }
  const refs = denseArray(
    record.stages,
    `${path}.stages`,
    REAL_BUILD_OBSERVATION_SOURCE_STAGE_ORDER.length,
  );
  if (refs.length !== REAL_BUILD_OBSERVATION_SOURCE_STAGE_ORDER.length)
    throw new TypeError(`${path}.stages must retain all seven fixed stages.`);
  const parsedRefs: RealBuildObservationSourceStageMaskReference[] = [];
  let offset = expectedOffset;
  for (let index = 0; index < refs.length; index += 1) {
    const ref = parseReference(
      refs[index],
      `${path}.stages[${index}]`,
      REAL_BUILD_OBSERVATION_SOURCE_STAGE_ORDER[index]!,
      { highWidth, highHeight, workWidth, workHeight },
      offset,
    );
    parsedRefs.push(ref);
    offset += ref.bytes;
    if (offset > declaredRoleBytes)
      throw new RangeError(`${path}.stages exceed the exact retained role length.`);
  }
  const workOnly = exactRecord(record.workOnlyStage, `${path}.workOnlyStage`, ["status", "reason"]);
  requireExactStageTraceMatch(workOnly.status, "missing", `${path}.workOnlyStage.status`);
  requireExactStageTraceMatch(
    workOnly.reason,
    "work-raster-candidate-is-not-coupled-to-panel-art-stages/1",
    `${path}.workOnlyStage.reason`,
  );
  return Object.freeze({
    path,
    record,
    stepNumber,
    pageNumber,
    source: parsedSource,
    dimensions: Object.freeze({ highWidth, highHeight, workWidth, workHeight, workFactor }),
    stages: Object.freeze(parsedRefs),
    nextOffset: offset,
    logicalPixels: parsedRefs.reduce((total, reference) => total + reference.pixelCount, 0),
  });
}

function verifyPanel(
  preflight: PanelPreflight,
  role: Uint8Array,
): RealBuildObservationSourceStagePanelTrace {
  const { highWidth, highHeight, workWidth, workHeight, workFactor } = preflight.dimensions;
  const masks = preflight.stages.map((reference, index) =>
    unpackSlice(role, reference, `${preflight.path}.stages[${index}]`),
  );
  const highAnalysis = analysePanelArtStageComponents(masks[0]!, highWidth, highHeight);
  const downsampledAnalysis = analysePanelArtStageComponents(masks[4]!, workWidth, workHeight);
  for (let y = 0; y < workHeight; y += 1) {
    for (let x = 0; x < workWidth; x += 1) {
      const workPixel = y * workWidth + x;
      const highPixel = y * workFactor * highWidth + x * workFactor;
      const cleaned = masks[4]![workPixel]!;
      const recomposed =
        masks[1]![workPixel] === 1 && masks[2]![workPixel] === 0 && masks[3]![workPixel] === 0
          ? 1
          : 0;
      if (cleaned !== masks[0]![highPixel] || cleaned !== recomposed) {
        throw new TypeError(
          `${preflight.path} cleaned stages do not reproduce exact point-downsampling and art-minus-furniture-minus-callout composition at work pixel ${workPixel}.`,
        );
      }
      if (masks[5]![workPixel] !== highAnalysis.mask[highPixel]) {
        throw new TypeError(
          `${preflight.path} isolate-then-downsample does not reproduce high component selection at work pixel ${workPixel}.`,
        );
      }
      if (masks[6]![workPixel] !== downsampledAnalysis.mask[workPixel]) {
        throw new TypeError(
          `${preflight.path} downsample-then-isolate does not reproduce work component selection at work pixel ${workPixel}.`,
        );
      }
    }
  }
  const highFacts = realBuildObservationSourceStageComponentFacts(highAnalysis.facts);
  const downsampledFacts = realBuildObservationSourceStageComponentFacts(downsampledAnalysis.facts);
  const topology = compareRealBuildObservationSourceStageTopology(masks[5]!, masks[6]!);
  requireExactStageTraceMatch(
    preflight.record.highComponents,
    highFacts,
    `${preflight.path}.highComponents`,
  );
  requireExactStageTraceMatch(
    preflight.record.downsampledComponents,
    downsampledFacts,
    `${preflight.path}.downsampledComponents`,
  );
  requireExactStageTraceMatch(preflight.record.topology, topology, `${preflight.path}.topology`);
  return Object.freeze({
    stepNumber: preflight.stepNumber,
    pageNumber: preflight.pageNumber,
    source: preflight.source,
    dimensions: preflight.dimensions,
    highComponents: highFacts,
    downsampledComponents: downsampledFacts,
    topology,
    workOnlyStage: Object.freeze({
      status: "missing",
      reason: "work-raster-candidate-is-not-coupled-to-panel-art-stages/1",
    }),
    stages: preflight.stages,
  });
}

/** Public hostile seam: bounded exact canonical manifest bytes plus external packed role bytes. */
export function parseRealBuildObservationSourceStageTrace(
  manifestValue: unknown,
  roleValue: unknown,
): RealBuildObservationSourceStageTrace {
  const manifestBytes = snapshotHostileUint8Array(manifestValue, {
    maximumBytes: MAXIMUM_REAL_BUILD_OBSERVATION_SOURCE_STAGE_MANIFEST_BYTES,
    typeError: "Observation source stage manifest must be one exact Uint8Array.",
    oversizeError: (length) =>
      `Observation source stage manifest has ${length} bytes; maximum is ${MAXIMUM_REAL_BUILD_OBSERVATION_SOURCE_STAGE_MANIFEST_BYTES}.`,
    sharedError: "Observation source stage manifest cannot use SharedArrayBuffer storage.",
    copyError: "Observation source stage manifest bytes could not be copied.",
  });
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(manifestBytes);
  } catch {
    throw new TypeError("Observation source stage manifest must be exact fatal UTF-8 JSON.");
  }
  requireExactStageTraceUtf8(manifestBytes, text);
  let value: unknown;
  try {
    value = JSON.parse(text) as unknown;
  } catch {
    throw new TypeError("Observation source stage manifest must be exact fatal UTF-8 JSON.");
  }
  requireCanonicalStageTraceJson(value, text);
  const root = exactRecord(value, "stageTrace", [
    "schemaVersion",
    "authority",
    "coverage",
    "role",
    "panels",
  ]);
  if (root.schemaVersion !== REAL_BUILD_OBSERVATION_SOURCE_STAGE_TRACE_SCHEMA)
    throw new TypeError(
      `stageTrace.schemaVersion must be ${REAL_BUILD_OBSERVATION_SOURCE_STAGE_TRACE_SCHEMA}.`,
    );
  const authority = exactRecord(root.authority, "stageTrace.authority", [
    "status",
    "authorized",
    "reason",
  ]);
  requireExactStageTraceMatch(authority.status, "absent", "stageTrace.authority.status");
  requireExactStageTraceMatch(authority.authorized, false, "stageTrace.authority.authorized");
  requireExactStageTraceMatch(
    authority.reason,
    "observation-source-stage-trace-is-inspection-only/1",
    "stageTrace.authority.reason",
  );
  const role = exactRecord(root.role, "stageTrace.role", ["name", "bytes", "digest"]);
  if (role.name !== REAL_BUILD_OBSERVATION_SOURCE_STAGE_ROLE) {
    throw new TypeError(
      `stageTrace.role.name must be ${REAL_BUILD_OBSERVATION_SOURCE_STAGE_ROLE}.`,
    );
  }
  const declaredRoleBytes = integer(
    role.bytes,
    "stageTrace.role.bytes",
    1,
    MAXIMUM_REAL_BUILD_OBSERVATION_SOURCE_STAGE_ROLE_BYTES,
  );
  const declaredRoleDigest = digest(role.digest, "stageTrace.role.digest");
  const rows = denseArray(
    root.panels,
    "stageTrace.panels",
    MAXIMUM_REAL_BUILD_OBSERVATION_SOURCE_STAGE_PANELS,
  );
  if (rows.length < 1) throw new RangeError("stageTrace.panels must retain at least one panel.");
  const preflights: PanelPreflight[] = [];
  let offset = 0;
  let verificationPixels = 0;
  for (let index = 0; index < rows.length; index += 1) {
    const parsed = preflightPanel(
      rows[index],
      `stageTrace.panels[${index}]`,
      preflights.at(-1)?.stepNumber ?? 0,
      offset,
      declaredRoleBytes,
    );
    preflights.push(parsed);
    offset = parsed.nextOffset;
    verificationPixels += parsed.logicalPixels;
    if (
      !Number.isSafeInteger(verificationPixels) ||
      verificationPixels > MAXIMUM_REAL_BUILD_OBSERVATION_SOURCE_STAGE_VERIFICATION_PIXELS
    ) {
      throw new RangeError(
        `stageTrace verification requires more than ${MAXIMUM_REAL_BUILD_OBSERVATION_SOURCE_STAGE_VERIFICATION_PIXELS} logical mask pixels.`,
      );
    }
  }
  if (offset !== declaredRoleBytes)
    throw new TypeError(
      `stageTrace stages cover ${offset} role bytes, not all ${declaredRoleBytes}.`,
    );
  const coverage = exactRecord(root.coverage, "stageTrace.coverage", [
    "expectedPanelCount",
    "retainedPanelCount",
    "status",
  ]);
  const complete =
    preflights.length === 359 &&
    preflights.every(({ stepNumber }, index) => stepNumber === index + 1);
  requireExactStageTraceMatch(
    coverage.expectedPanelCount,
    359,
    "stageTrace.coverage.expectedPanelCount",
  );
  requireExactStageTraceMatch(
    coverage.retainedPanelCount,
    preflights.length,
    "stageTrace.coverage.retainedPanelCount",
  );
  requireExactStageTraceMatch(
    coverage.status,
    complete ? "complete" : "partial",
    "stageTrace.coverage.status",
  );
  const roleBytes = snapshotHostileUint8Array(roleValue, {
    maximumBytes: declaredRoleBytes,
    typeError: "Observation source stage role must be one exact Uint8Array.",
    oversizeError: (length) =>
      `Observation source stage role has ${length} bytes; manifest declares exactly ${declaredRoleBytes}.`,
    sharedError: "Observation source stage role cannot use SharedArrayBuffer storage.",
    copyError: "Observation source stage role bytes could not be copied.",
  });
  if (roleBytes.length !== declaredRoleBytes) {
    throw new TypeError(
      `stageTrace.role does not bind external byte length: observed ${roleBytes.length}; expected ${declaredRoleBytes}.`,
    );
  }
  const observedRoleDigest = rawDigest(roleBytes);
  if (observedRoleDigest !== declaredRoleDigest) {
    throw new TypeError(
      `stageTrace.role does not bind external digest: observed ${observedRoleDigest}; expected ${declaredRoleDigest}.`,
    );
  }
  const panels = preflights.map((preflight) => verifyPanel(preflight, roleBytes));
  return Object.freeze({
    schemaVersion: REAL_BUILD_OBSERVATION_SOURCE_STAGE_TRACE_SCHEMA,
    authority: Object.freeze({
      status: "absent",
      authorized: false,
      reason: "observation-source-stage-trace-is-inspection-only/1",
    }),
    coverage: Object.freeze({
      expectedPanelCount: 359,
      retainedPanelCount: panels.length,
      status: complete ? "complete" : "partial",
    }),
    role: Object.freeze({
      name: REAL_BUILD_OBSERVATION_SOURCE_STAGE_ROLE,
      bytes: roleBytes.length,
      digest: declaredRoleDigest,
    }),
    panels: Object.freeze(panels),
  });
}
