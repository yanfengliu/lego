import { canonicalStringify, type Sha256Digest } from "@lego-studio/brick-kernel";

import { isRealBuildBrowserOutputV4SourceEvidencePanelDescriptor } from "./real-build-browser-output-v4-source-evidence-brands";
import { createRealBuildBrowserOutputV4SourceEvidencePanel } from "./real-build-browser-output-v4-source-evidence-panel-writer";
import {
  sourceEvidenceCanonicalBytes,
  sourceEvidenceConcat,
  sourceEvidenceCopyBytes,
  sourceEvidenceDenseArray,
  sourceEvidenceDigest,
  sourceEvidenceDigestValue,
  sourceEvidenceEqualBytes,
  sourceEvidenceExactRecord,
  sourceEvidenceFinite,
  sourceEvidenceFreshCopy,
  sourceEvidenceInteger,
} from "./real-build-browser-output-v4-source-evidence-primitives";
import {
  MAXIMUM_REAL_BUILD_BROWSER_OUTPUT_V4_SOURCE_EVIDENCE_HIGH_PANEL_BYTES,
  MAXIMUM_REAL_BUILD_BROWSER_OUTPUT_V4_SOURCE_EVIDENCE_MASK_PANEL_BYTES,
  MAXIMUM_REAL_BUILD_BROWSER_OUTPUT_V4_SOURCE_EVIDENCE_WORK_PANEL_BYTES,
  type RealBuildBrowserOutputV4SourceEvidencePanelArtifact,
} from "./real-build-browser-output-v4-source-evidence-types";
import {
  readRealBuildExactThreeSourcePacket,
  requireRealBuildExactThreeSourcePacketInspection,
} from "./real-build-exact-three-source-packet-reader";
import {
  MAXIMUM_REAL_BUILD_EXACT_THREE_SOURCE_PACKET_HIGH_BYTES,
  MAXIMUM_REAL_BUILD_EXACT_THREE_SOURCE_PACKET_MASK_BYTES,
  MAXIMUM_REAL_BUILD_EXACT_THREE_SOURCE_PACKET_WORK_BYTES,
  REAL_BUILD_EXACT_THREE_INDEXED_STEP_LABEL_COUNT,
  REAL_BUILD_EXACT_THREE_MATERIALIZED_PAGE_PANEL_COUNT,
  REAL_BUILD_EXACT_THREE_PAGE_NUMBER,
  REAL_BUILD_EXACT_THREE_PLACEMENT_STEPS,
  REAL_BUILD_EXACT_THREE_REGISTRATION_PANELS,
  REAL_BUILD_EXACT_THREE_SOURCE_AUTHORITY,
  REAL_BUILD_EXACT_THREE_SOURCE_PACKET_SCHEMA_VERSION,
  REAL_BUILD_EXACT_THREE_SOURCE_ROLE_ENCODINGS,
  REAL_BUILD_EXACT_THREE_SOURCE_ROLES,
  type CreateRealBuildExactThreeSourcePacketInput,
  type RealBuildExactThreeSourcePacketArtifact,
  type RealBuildExactThreeSourcePacketBounds,
  type RealBuildExactThreeSourcePacketBytes,
  type RealBuildExactThreeSourcePacketPanel,
} from "./real-build-exact-three-source-packet-types";
import { intrinsicRealBuildFreeze } from "./real-build-intrinsic-freeze";
import { stepPanelEvidenceDigest } from "./real-build-panel-evidence-digest";

const RETAINED_BYTES = new WeakMap<object, RealBuildExactThreeSourcePacketBytes>();
const REFLECT_APPLY = Reflect.apply;
const WEAK_MAP_GET = WeakMap.prototype.get;
const WEAK_MAP_SET = WeakMap.prototype.set;

interface ScopedPanelSnapshot {
  readonly stepNumber: 2 | 3 | 4;
  readonly pageNumber: typeof REAL_BUILD_EXACT_THREE_PAGE_NUMBER;
  readonly bounds: RealBuildExactThreeSourcePacketBounds;
  readonly calloutBoxes: readonly RealBuildExactThreeSourcePacketBounds[];
  readonly commitmentDigest: Sha256Digest;
}

function bounds(value: unknown, path: string): RealBuildExactThreeSourcePacketBounds {
  const row = sourceEvidenceExactRecord(value, ["minXPt", "maxXPt", "minYPt", "maxYPt"], path);
  const result = intrinsicRealBuildFreeze({
    minXPt: sourceEvidenceFinite(row.minXPt, `${path}.minXPt`),
    maxXPt: sourceEvidenceFinite(row.maxXPt, `${path}.maxXPt`),
    minYPt: sourceEvidenceFinite(row.minYPt, `${path}.minYPt`),
    maxYPt: sourceEvidenceFinite(row.maxYPt, `${path}.maxYPt`),
  });
  if (result.maxXPt <= result.minXPt || result.maxYPt <= result.minYPt) {
    throw new RangeError(`${path} must have positive finite width and height.`);
  }
  return result;
}

function snapshotScoped(value: unknown) {
  const scoped = sourceEvidenceExactRecord(
    value,
    [
      "panels",
      "calloutBoxesByStep",
      "callerSourcePanelCommitmentByStep",
      "authority",
      "binding",
      "scope",
    ],
    "Exact-three scoped panel evidence",
  );
  const rawPanels = sourceEvidenceDenseArray(
    scoped.panels,
    3,
    3,
    "Exact-three scoped panel evidence.panels",
  );
  const rawCallouts = sourceEvidenceExactRecord(
    scoped.calloutBoxesByStep,
    ["2", "3", "4"],
    "Exact-three scoped panel evidence.calloutBoxesByStep",
  );
  const rawCommitments = sourceEvidenceExactRecord(
    scoped.callerSourcePanelCommitmentByStep,
    ["2", "3", "4"],
    "Exact-three scoped panel evidence.callerSourcePanelCommitmentByStep",
  );
  const rawAuthority = sourceEvidenceExactRecord(
    scoped.authority,
    ["sourceText", "preparedRun", "placement", "completion"],
    "Exact-three scoped panel evidence.authority",
  );
  if (
    rawAuthority.sourceText !== "caller-supplied-unverified" ||
    rawAuthority.preparedRun !== "absent" ||
    rawAuthority.placement !== "absent" ||
    rawAuthority.completion !== "absent"
  ) {
    throw new TypeError("Exact-three scoped panel evidence must retain all existing absences.");
  }
  const rawBinding = sourceEvidenceExactRecord(
    scoped.binding,
    [
      "pdfBytesDigest",
      "callerInstructionSourceSnapshotDigest",
      "callerSourceContentHashClaimMatchedPdfBytes",
      "sourceTextParserReplay",
    ],
    "Exact-three scoped panel evidence.binding",
  );
  if (
    rawBinding.callerSourceContentHashClaimMatchedPdfBytes !== true ||
    rawBinding.sourceTextParserReplay !== "not-performed"
  ) {
    throw new TypeError("Exact-three scoped panel evidence must retain parser replay as absent.");
  }
  const pdfDigest = sourceEvidenceDigestValue(
    rawBinding.pdfBytesDigest,
    "Exact-three scoped panel evidence.binding.pdfBytesDigest",
  );
  const callerSourceSnapshotDigest = sourceEvidenceDigestValue(
    rawBinding.callerInstructionSourceSnapshotDigest,
    "Exact-three scoped panel evidence.binding.callerInstructionSourceSnapshotDigest",
  );
  const rawScope = sourceEvidenceExactRecord(
    scoped.scope,
    [
      "requestedStepNumbers",
      "calloutProbePageNumbers",
      "indexedStepLabelCount",
      "materializedPagePanelCount",
      "emittedPanelCount",
    ],
    "Exact-three scoped panel evidence.scope",
  );
  const requestedSteps = sourceEvidenceDenseArray(
    rawScope.requestedStepNumbers,
    3,
    3,
    "Exact-three scoped panel evidence.scope.requestedStepNumbers",
  );
  for (let index = 0; index < 3; index += 1) {
    sourceEvidenceInteger(
      requestedSteps[index],
      REAL_BUILD_EXACT_THREE_REGISTRATION_PANELS[index]!,
      REAL_BUILD_EXACT_THREE_REGISTRATION_PANELS[index]!,
      `Exact-three scoped panel evidence.scope.requestedStepNumbers[${index}]`,
    );
  }
  sourceEvidenceInteger(
    rawScope.emittedPanelCount,
    3,
    3,
    "Exact-three scoped panel evidence.scope.emittedPanelCount",
  );

  const panels: ScopedPanelSnapshot[] = [];
  const observedPages: number[] = [];
  for (let index = 0; index < 3; index += 1) {
    const stepNumber = REAL_BUILD_EXACT_THREE_REGISTRATION_PANELS[index]!;
    const path = `Exact-three scoped panel evidence.panels[${index}]`;
    const panel = sourceEvidenceExactRecord(
      rawPanels[index],
      ["stepNumber", "pageNumber", "bounds", "labelXPt", "labelYPt", "quantities"],
      path,
    );
    sourceEvidenceInteger(panel.stepNumber, stepNumber, stepNumber, `${path}.stepNumber`);
    const pageNumber = sourceEvidenceInteger(
      panel.pageNumber,
      REAL_BUILD_EXACT_THREE_PAGE_NUMBER,
      REAL_BUILD_EXACT_THREE_PAGE_NUMBER,
      `${path}.pageNumber`,
    ) as typeof REAL_BUILD_EXACT_THREE_PAGE_NUMBER;
    if (!observedPages.includes(pageNumber)) observedPages.push(pageNumber);
    const panelBounds = bounds(panel.bounds, `${path}.bounds`);
    const labelXPt = sourceEvidenceFinite(panel.labelXPt, `${path}.labelXPt`);
    const labelYPt = sourceEvidenceFinite(panel.labelYPt, `${path}.labelYPt`);
    if (
      labelXPt < panelBounds.minXPt ||
      labelXPt >= panelBounds.maxXPt ||
      labelYPt < panelBounds.minYPt ||
      labelYPt >= panelBounds.maxYPt
    ) {
      throw new TypeError(`${path} does not contain its printed label.`);
    }
    const quantities = sourceEvidenceDenseArray(panel.quantities, 0, 1_024, `${path}.quantities`);
    quantities.forEach((quantity, quantityIndex) =>
      sourceEvidenceInteger(quantity, 1, 999, `${path}.quantities[${quantityIndex}]`),
    );
    const calloutsValue = rawCallouts[String(stepNumber)];
    const calloutRows = sourceEvidenceDenseArray(
      calloutsValue,
      0,
      1_024,
      `Exact-three scoped panel evidence.calloutBoxesByStep.${stepNumber}`,
    );
    const calloutBoxes = intrinsicRealBuildFreeze(
      calloutRows.map((box, boxIndex) =>
        bounds(
          box,
          `Exact-three scoped panel evidence.calloutBoxesByStep.${stepNumber}[${boxIndex}]`,
        ),
      ),
    );
    const commitmentRow = sourceEvidenceExactRecord(
      rawCommitments[String(stepNumber)],
      ["pageNumber", "commitmentDigest"],
      `Exact-three scoped panel evidence.callerSourcePanelCommitmentByStep.${stepNumber}`,
    );
    sourceEvidenceInteger(
      commitmentRow.pageNumber,
      pageNumber,
      pageNumber,
      `Exact-three scoped panel evidence.callerSourcePanelCommitmentByStep.${stepNumber}.pageNumber`,
    );
    const commitmentDigest = sourceEvidenceDigestValue(
      commitmentRow.commitmentDigest,
      `Exact-three scoped panel evidence.callerSourcePanelCommitmentByStep.${stepNumber}.commitmentDigest`,
    );
    const reproduced = stepPanelEvidenceDigest({
      pdfDigest,
      stepNumber,
      pageNumber,
      bounds: panelBounds,
      calloutBoxes,
    });
    if (commitmentDigest !== reproduced) {
      throw new TypeError(`Exact-three scoped panel ${stepNumber} commitment does not reproduce.`);
    }
    panels[index] = intrinsicRealBuildFreeze({
      stepNumber,
      pageNumber,
      bounds: panelBounds,
      calloutBoxes,
      commitmentDigest,
    });
  }
  const rawProbePages = sourceEvidenceDenseArray(
    rawScope.calloutProbePageNumbers,
    1,
    1,
    "Exact-three scoped panel evidence.scope.calloutProbePageNumbers",
  );
  const probePages = intrinsicRealBuildFreeze(
    rawProbePages.map((page, index) =>
      sourceEvidenceInteger(
        page,
        REAL_BUILD_EXACT_THREE_PAGE_NUMBER,
        REAL_BUILD_EXACT_THREE_PAGE_NUMBER,
        `Exact-three scoped panel evidence.scope.calloutProbePageNumbers[${index}]`,
      ),
    ),
  );
  return intrinsicRealBuildFreeze({
    panels: intrinsicRealBuildFreeze(panels),
    pdfDigest,
    callerSourceSnapshotDigest,
    calloutProbePageNumbers: probePages,
    indexedStepLabelCount: sourceEvidenceInteger(
      rawScope.indexedStepLabelCount,
      REAL_BUILD_EXACT_THREE_INDEXED_STEP_LABEL_COUNT,
      REAL_BUILD_EXACT_THREE_INDEXED_STEP_LABEL_COUNT,
      "Exact-three scoped panel evidence.scope.indexedStepLabelCount",
    ) as typeof REAL_BUILD_EXACT_THREE_INDEXED_STEP_LABEL_COUNT,
    materializedPagePanelCount: sourceEvidenceInteger(
      rawScope.materializedPagePanelCount,
      REAL_BUILD_EXACT_THREE_MATERIALIZED_PAGE_PANEL_COUNT,
      REAL_BUILD_EXACT_THREE_MATERIALIZED_PAGE_PANEL_COUNT,
      "Exact-three scoped panel evidence.scope.materializedPagePanelCount",
    ) as typeof REAL_BUILD_EXACT_THREE_MATERIALIZED_PAGE_PANEL_COUNT,
  });
}

function snapshotArtifact(
  value: unknown,
  scoped: ScopedPanelSnapshot,
  pdfDigest: Sha256Digest,
  index: number,
): RealBuildBrowserOutputV4SourceEvidencePanelArtifact {
  const path = `Exact-three source panel artifacts[${index}]`;
  const row = sourceEvidenceExactRecord(
    value,
    ["descriptor", "highRgbaBytes", "workRgbaBytes", "packedMaskBytes"],
    path,
  );
  if (!isRealBuildBrowserOutputV4SourceEvidencePanelDescriptor(row.descriptor)) {
    throw new TypeError(`${path}.descriptor must be an existing module-created panel descriptor.`);
  }
  const descriptor = row.descriptor;
  const high = sourceEvidenceCopyBytes(
    row.highRgbaBytes,
    ["Uint8Array"],
    descriptor.highRgba.byteLength,
    MAXIMUM_REAL_BUILD_BROWSER_OUTPUT_V4_SOURCE_EVIDENCE_HIGH_PANEL_BYTES,
    `${path}.highRgbaBytes`,
  );
  const work = sourceEvidenceCopyBytes(
    row.workRgbaBytes,
    ["Uint8Array"],
    descriptor.workRgba.byteLength,
    MAXIMUM_REAL_BUILD_BROWSER_OUTPUT_V4_SOURCE_EVIDENCE_WORK_PANEL_BYTES,
    `${path}.workRgbaBytes`,
  );
  const maskLength = descriptor.roles[2]?.byteLength ?? -1;
  const masks = sourceEvidenceCopyBytes(
    row.packedMaskBytes,
    ["Uint8Array"],
    maskLength,
    MAXIMUM_REAL_BUILD_BROWSER_OUTPUT_V4_SOURCE_EVIDENCE_MASK_PANEL_BYTES,
    `${path}.packedMaskBytes`,
  );
  const reproduced = createRealBuildBrowserOutputV4SourceEvidencePanel({
    pdfDigest,
    panel: {
      stepNumber: scoped.stepNumber,
      pageNumber: scoped.pageNumber,
      ...scoped.bounds,
      calloutBoxes: scoped.calloutBoxes,
      panelEvidenceDigest: scoped.commitmentDigest,
    },
    highRgba: new Uint8ClampedArray(high),
    workRgba: new Uint8ClampedArray(work),
  });
  if (
    canonicalStringify(descriptor) !== canonicalStringify(reproduced.descriptor) ||
    !sourceEvidenceEqualBytes(high, reproduced.highRgbaBytes) ||
    !sourceEvidenceEqualBytes(work, reproduced.workRgbaBytes) ||
    !sourceEvidenceEqualBytes(masks, reproduced.packedMaskBytes)
  ) {
    throw new TypeError(
      `${path} does not independently reproduce from its scoped panel and roles.`,
    );
  }
  return reproduced;
}

export function createRealBuildExactThreeSourcePacket(
  inputValue: CreateRealBuildExactThreeSourcePacketInput | unknown,
): RealBuildExactThreeSourcePacketArtifact {
  const input = sourceEvidenceExactRecord(
    inputValue,
    ["scopedPanelEvidence", "sourcePanels"],
    "Exact-three source packet input",
  );
  const scoped = snapshotScoped(input.scopedPanelEvidence);
  const rawArtifacts = sourceEvidenceDenseArray(
    input.sourcePanels,
    3,
    3,
    "Exact-three source packet input.sourcePanels",
  );
  const artifacts = rawArtifacts.map((artifact, index) =>
    snapshotArtifact(artifact, scoped.panels[index]!, scoped.pdfDigest, index),
  );
  const high = sourceEvidenceConcat(
    artifacts.map(({ highRgbaBytes }) => highRgbaBytes),
    MAXIMUM_REAL_BUILD_EXACT_THREE_SOURCE_PACKET_HIGH_BYTES,
    "Exact-three high RGBA role",
  );
  const work = sourceEvidenceConcat(
    artifacts.map(({ workRgbaBytes }) => workRgbaBytes),
    MAXIMUM_REAL_BUILD_EXACT_THREE_SOURCE_PACKET_WORK_BYTES,
    "Exact-three work RGBA role",
  );
  const masks = sourceEvidenceConcat(
    artifacts.map(({ packedMaskBytes }) => packedMaskBytes),
    MAXIMUM_REAL_BUILD_EXACT_THREE_SOURCE_PACKET_MASK_BYTES,
    "Exact-three packed-mask role",
  );
  const aggregateRoles = [high, work, masks] as const;
  const roles = intrinsicRealBuildFreeze(
    REAL_BUILD_EXACT_THREE_SOURCE_ROLES.map((role, index) =>
      intrinsicRealBuildFreeze({
        role,
        contentEncoding: REAL_BUILD_EXACT_THREE_SOURCE_ROLE_ENCODINGS[role],
        byteLength: aggregateRoles[index]!.bytes.byteLength,
        digest: sourceEvidenceDigest(aggregateRoles[index]!.bytes),
      }),
    ),
  );
  const panels: RealBuildExactThreeSourcePacketPanel[] = artifacts.map((artifact, index) => {
    const panel = scoped.panels[index]!;
    const roleSlices = intrinsicRealBuildFreeze(
      REAL_BUILD_EXACT_THREE_SOURCE_ROLES.map((role, roleIndex) => {
        const bytes =
          roleIndex === 0
            ? artifact.highRgbaBytes
            : roleIndex === 1
              ? artifact.workRgbaBytes
              : artifact.packedMaskBytes;
        return intrinsicRealBuildFreeze({
          role,
          offset: aggregateRoles[roleIndex]!.offsets[index]!,
          byteLength: bytes.byteLength,
          digest: sourceEvidenceDigest(bytes),
        });
      }),
    );
    return intrinsicRealBuildFreeze({
      placementStepNumber: REAL_BUILD_EXACT_THREE_PLACEMENT_STEPS[index]!,
      registrationPanelStepNumber: panel.stepNumber,
      pageNumber: panel.pageNumber,
      bounds: panel.bounds,
      calloutBoxes: panel.calloutBoxes,
      callerSourcePanelCommitmentDigest: panel.commitmentDigest,
      sourceArtifactDescriptor: artifact.descriptor,
      roleSlices,
    });
  });
  const manifest = intrinsicRealBuildFreeze({
    schemaVersion: REAL_BUILD_EXACT_THREE_SOURCE_PACKET_SCHEMA_VERSION,
    scope: intrinsicRealBuildFreeze({
      placementStepNumbers: REAL_BUILD_EXACT_THREE_PLACEMENT_STEPS,
      registrationPanelStepNumbers: REAL_BUILD_EXACT_THREE_REGISTRATION_PANELS,
      calloutProbePageNumbers: scoped.calloutProbePageNumbers,
      indexedStepLabelCount: scoped.indexedStepLabelCount,
      materializedPagePanelCount: scoped.materializedPagePanelCount,
      emittedPanelCount: 3 as const,
    }),
    binding: intrinsicRealBuildFreeze({
      pdfBytesDigest: scoped.pdfDigest,
      callerInstructionSourceSnapshotDigest: scoped.callerSourceSnapshotDigest,
      callerSourceContentHashClaimMatchedPdfBytes: true as const,
      sourceTextParserReplay: "not-performed" as const,
    }),
    roles,
    panels: intrinsicRealBuildFreeze(panels),
    authority: REAL_BUILD_EXACT_THREE_SOURCE_AUTHORITY,
    acceptedDocument: null,
  });
  const retained = intrinsicRealBuildFreeze({
    manifestBytes: sourceEvidenceCanonicalBytes(manifest),
    highRgbaRoleBytes: high.bytes,
    workRgbaRoleBytes: work.bytes,
    maskRoleBytes: masks.bytes,
  });
  const inspection = requireRealBuildExactThreeSourcePacketInspection(
    readRealBuildExactThreeSourcePacket(retained),
  );
  const artifact = intrinsicRealBuildFreeze({
    manifest: inspection.manifest,
    manifestDigest: sourceEvidenceDigest(retained.manifestBytes),
    authority: REAL_BUILD_EXACT_THREE_SOURCE_AUTHORITY,
    acceptedDocument: null,
  });
  REFLECT_APPLY(WEAK_MAP_SET, RETAINED_BYTES, [artifact, retained]);
  return artifact;
}

export function readRealBuildExactThreeSourcePacketBytes(
  value: unknown,
): RealBuildExactThreeSourcePacketBytes {
  const retained =
    value !== null && typeof value === "object"
      ? (REFLECT_APPLY(WEAK_MAP_GET, RETAINED_BYTES, [value]) as
          RealBuildExactThreeSourcePacketBytes | undefined)
      : undefined;
  if (retained === undefined) {
    throw new TypeError(
      "Exact-three source packet bytes require the exact module-created artifact.",
    );
  }
  return intrinsicRealBuildFreeze({
    manifestBytes: sourceEvidenceFreshCopy(retained.manifestBytes),
    highRgbaRoleBytes: sourceEvidenceFreshCopy(retained.highRgbaRoleBytes),
    workRgbaRoleBytes: sourceEvidenceFreshCopy(retained.workRgbaRoleBytes),
    maskRoleBytes: sourceEvidenceFreshCopy(retained.maskRoleBytes),
  });
}
