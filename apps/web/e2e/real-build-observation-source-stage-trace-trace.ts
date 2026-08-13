import { canonicalStringify, sha256Hex, type Sha256Digest } from "@lego-studio/brick-kernel";

import type {
  PanelArtStageComponentFacts,
  PanelArtStageComponentSummary,
  PanelArtStages,
} from "../src/assembly/panel-art-stages";
import { createRealBuildObservationSourceStageRole } from "./real-build-observation-source-stage-trace-role";
import {
  MAXIMUM_REAL_BUILD_OBSERVATION_SOURCE_STAGE_MANIFEST_BYTES,
  MAXIMUM_REAL_BUILD_OBSERVATION_SOURCE_STAGE_PANELS,
  REAL_BUILD_OBSERVATION_SOURCE_STAGE_ROLE,
  REAL_BUILD_OBSERVATION_SOURCE_STAGE_TRACE_SCHEMA,
  type RealBuildObservationSourceStageComponentFacts,
  type RealBuildObservationSourceStageComponentSummary,
  type RealBuildObservationSourceStagePanelTrace,
  type RealBuildObservationSourceStageTopologyComparison,
  type RealBuildObservationSourceStageTraceArtifact,
} from "./real-build-observation-source-stage-trace-types";

export interface RealBuildObservationSourceStageTracePanelInput {
  readonly stepNumber: number;
  readonly pageNumber: number;
  readonly source: {
    readonly schemaVersion: "lego.real-build-observation-source-stage-opaque-provenance/1";
    readonly reproduction: "not-claimed";
    readonly pdfDigest: Sha256Digest;
    readonly panelEvidenceDigest: Sha256Digest;
    readonly cropDescriptorDigest: Sha256Digest;
    readonly policyDescriptorDigest: Sha256Digest;
    readonly workPixelsDigest: Sha256Digest;
  };
  readonly stages: PanelArtStages;
}

const DIGEST = /^sha256:[0-9a-f]{64}$/u;
const rawDigest = (bytes: Uint8Array): Sha256Digest => `sha256:${sha256Hex(bytes)}`;

function componentSummary(
  summary: PanelArtStageComponentSummary,
): RealBuildObservationSourceStageComponentSummary {
  return Object.freeze({
    scanIndex: summary.scanIndex,
    seedPixel: summary.seedPixel,
    areaPx: summary.areaPx,
    bounds: Object.freeze({ ...summary.bounds }),
    touchesLeft: summary.touchesLeft,
    touchesRight: summary.touchesRight,
    touchesTop: summary.touchesTop,
    touchesBottom: summary.touchesBottom,
  });
}

export function realBuildObservationSourceStageComponentFacts(
  facts: PanelArtStageComponentFacts,
): RealBuildObservationSourceStageComponentFacts {
  return Object.freeze({
    width: facts.width,
    height: facts.height,
    componentCount: facts.componentCount,
    setPixels: facts.setPixels,
    componentPartitionDigest: facts.componentPartitionDigest,
    maximumAreaPx: facts.maximumAreaPx,
    largestComponentCount: facts.largestComponentCount,
    retainedTopComponents: Object.freeze(facts.retainedTopComponents.map(componentSummary)),
    legacySelectedScanIndex: facts.legacySelected?.scanIndex ?? null,
    unambiguousLargestSelectionScanIndex: facts.unambiguousLargestSelection?.scanIndex ?? null,
    selectionRefusal: facts.selectionRefusal,
  });
}

export function compareRealBuildObservationSourceStageTopology(
  isolateThenDownsample: Uint8Array,
  downsampleThenIsolate: Uint8Array,
): RealBuildObservationSourceStageTopologyComparison {
  if (isolateThenDownsample.length !== downsampleThenIsolate.length) {
    throw new RangeError(
      `Observation source topology comparison received ${isolateThenDownsample.length} and ${downsampleThenIsolate.length} pixels; both stages must share one work raster.`,
    );
  }
  let differingPixels = 0;
  let intersectionPixels = 0;
  let unionPixels = 0;
  for (let pixel = 0; pixel < isolateThenDownsample.length; pixel += 1) {
    const left = isolateThenDownsample[pixel]!;
    const right = downsampleThenIsolate[pixel]!;
    if ((left !== 0 && left !== 1) || (right !== 0 && right !== 1)) {
      throw new TypeError(
        `Observation source topology comparison pixel ${pixel} must be binary in both masks.`,
      );
    }
    if (left !== right) differingPixels += 1;
    if (left === 1 && right === 1) intersectionPixels += 1;
    if (left === 1 || right === 1) unionPixels += 1;
  }
  return Object.freeze({
    status: differingPixels === 0 ? "equal" : "different",
    differingPixels,
    intersectionPixels,
    unionPixels,
    iou: unionPixels === 0 ? null : intersectionPixels / unionPixels,
  });
}

function sourceDescriptor(
  source: RealBuildObservationSourceStageTracePanelInput["source"],
  stepNumber: number,
): RealBuildObservationSourceStageTracePanelInput["source"] {
  if (
    source.schemaVersion !== "lego.real-build-observation-source-stage-opaque-provenance/1" ||
    source.reproduction !== "not-claimed"
  ) {
    throw new TypeError(
      `Observation source stage step ${stepNumber} must label source descriptors as opaque, non-reproducing provenance.`,
    );
  }
  for (const key of [
    "pdfDigest",
    "panelEvidenceDigest",
    "cropDescriptorDigest",
    "policyDescriptorDigest",
    "workPixelsDigest",
  ] as const) {
    const value = source[key];
    if (!DIGEST.test(value)) {
      throw new TypeError(
        `Observation source stage step ${stepNumber} source.${key} must be one lowercase SHA-256 digest.`,
      );
    }
  }
  return Object.freeze({ ...source });
}

/**
 * Builds a panel-major manifest plus external packed role. This builder accepts
 * trusted in-process stage facts; hostile retained bytes must cross the parser.
 */
export function createRealBuildObservationSourceStageTrace(
  inputs: readonly RealBuildObservationSourceStageTracePanelInput[],
): RealBuildObservationSourceStageTraceArtifact {
  if (inputs.length < 1 || inputs.length > MAXIMUM_REAL_BUILD_OBSERVATION_SOURCE_STAGE_PANELS) {
    throw new RangeError(
      `Observation source stage trace requires 1 through ${MAXIMUM_REAL_BUILD_OBSERVATION_SOURCE_STAGE_PANELS} panels; received ${inputs.length}.`,
    );
  }
  const role = createRealBuildObservationSourceStageRole(
    inputs.map(({ stepNumber, stages }) => ({ stepNumber, stages })),
  );
  const panels: RealBuildObservationSourceStagePanelTrace[] = [];
  for (let index = 0; index < inputs.length; index += 1) {
    const input = inputs[index]!;
    const rolePanel = role.panels[index]!;
    if (!Number.isSafeInteger(input.pageNumber) || input.pageNumber < 1) {
      throw new RangeError(
        `Observation source stage step ${input.stepNumber} pageNumber must be a positive safe integer; received ${String(input.pageNumber)}.`,
      );
    }
    panels.push(
      Object.freeze({
        stepNumber: input.stepNumber,
        pageNumber: input.pageNumber,
        source: sourceDescriptor(input.source, input.stepNumber),
        dimensions: Object.freeze({
          highWidth: input.stages.width,
          highHeight: input.stages.height,
          workWidth: input.stages.workWidth,
          workHeight: input.stages.workHeight,
          workFactor: input.stages.workFactor,
        }),
        highComponents: realBuildObservationSourceStageComponentFacts(input.stages.highComponents),
        downsampledComponents: realBuildObservationSourceStageComponentFacts(
          input.stages.downsampledComponents,
        ),
        topology: compareRealBuildObservationSourceStageTopology(
          input.stages.isolateThenDownsampleMask,
          input.stages.downsampleThenIsolateMask,
        ),
        workOnlyStage: Object.freeze({ ...input.stages.workOnlyStage }),
        stages: rolePanel.stages,
      }),
    );
  }
  const complete =
    panels.length === MAXIMUM_REAL_BUILD_OBSERVATION_SOURCE_STAGE_PANELS &&
    panels.every(({ stepNumber }, index) => stepNumber === index + 1);
  const manifest = Object.freeze({
    schemaVersion: REAL_BUILD_OBSERVATION_SOURCE_STAGE_TRACE_SCHEMA,
    authority: Object.freeze({
      status: "absent" as const,
      authorized: false as const,
      reason: "observation-source-stage-trace-is-inspection-only/1" as const,
    }),
    coverage: Object.freeze({
      expectedPanelCount: 359 as const,
      retainedPanelCount: panels.length,
      status: complete ? ("complete" as const) : ("partial" as const),
    }),
    role: Object.freeze({
      name: REAL_BUILD_OBSERVATION_SOURCE_STAGE_ROLE,
      bytes: role.byteLength,
      digest: role.digest,
    }),
    panels: Object.freeze(panels),
  });
  const manifestBytes = new TextEncoder().encode(canonicalStringify(manifest));
  if (manifestBytes.length > MAXIMUM_REAL_BUILD_OBSERVATION_SOURCE_STAGE_MANIFEST_BYTES) {
    throw new RangeError(
      `Observation source stage manifest has ${manifestBytes.length} bytes; maximum is ${MAXIMUM_REAL_BUILD_OBSERVATION_SOURCE_STAGE_MANIFEST_BYTES}.`,
    );
  }
  const retainedManifestBytes = new Uint8Array(manifestBytes);
  const retainedRoleBytes = role.readBytes();
  return Object.freeze({
    manifest,
    manifestDigest: rawDigest(retainedManifestBytes),
    readManifestBytes: () => new Uint8Array(retainedManifestBytes),
    readRoleBytes: () => new Uint8Array(retainedRoleBytes),
  });
}
