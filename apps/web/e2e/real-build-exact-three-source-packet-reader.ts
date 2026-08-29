import {
  CALLER_INSTRUCTION_SOURCE_SNAPSHOT_DIGEST,
  CALLER_SOURCE_CONTENT_HASH_CLAIM_MATCHED_PDF_BYTES,
  CALLER_SOURCE_PANEL_COMMITMENT_DIGEST,
} from "./real-build-source-packet-field-names.ts";
import { canonicalStringify } from "@lego-studio/brick-kernel";

import { createRealBuildBrowserOutputV4SourceEvidencePanel } from "./real-build-browser-output-v4-source-evidence-panel-writer";
import {
  sourceEvidenceCopyBytes,
  sourceEvidenceDenseArray,
  sourceEvidenceDigest,
  sourceEvidenceDigestValue,
  sourceEvidenceEqualBytes,
  sourceEvidenceExactRecord,
  sourceEvidenceFinite,
  sourceEvidenceInteger,
  sourceEvidenceParseCanonicalJson,
} from "./real-build-browser-output-v4-source-evidence-primitives";
import { intrinsicRealBuildFreeze } from "./real-build-intrinsic-freeze";
import { deriveRealBuildExactThreeCompiledObservationSource } from "./real-build-exact-three-compiled-source";
import {
  snapshotRealBuildCompiledObservationSource,
  type RealBuildCompiledObservationSourceInput,
} from "./real-build-compiled-observation-source";
import { stepPanelEvidenceDigest } from "./real-build-panel-evidence-digest";
import {
  MAXIMUM_REAL_BUILD_EXACT_THREE_SOURCE_PACKET_HIGH_BYTES,
  MAXIMUM_REAL_BUILD_EXACT_THREE_SOURCE_PACKET_MANIFEST_BYTES,
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
  type RealBuildExactThreeSourcePacketBounds,
  type RealBuildExactThreeSourcePacketBytes,
  type RealBuildExactThreeSourcePacketInspection,
  type RealBuildExactThreeSourcePacketManifest,
  type RealBuildExactThreeSourcePacketPanel,
  type RealBuildExactThreeSourcePacketRoleDescriptor,
  type RealBuildExactThreeSourcePacketRoleSlice,
} from "./real-build-exact-three-source-packet-types";

const INSPECTIONS = new WeakSet<object>();
const COMPILED_SOURCES = new WeakMap<object, readonly RealBuildCompiledObservationSourceInput[]>();
const REFLECT_APPLY = Reflect.apply;
const WEAK_SET_ADD = WeakSet.prototype.add;
const WEAK_SET_HAS = WeakSet.prototype.has;

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

function fixedNumbers(
  value: unknown,
  expected: readonly number[],
  path: string,
): readonly number[] {
  const rows = sourceEvidenceDenseArray(value, expected.length, expected.length, path);
  const result = rows.map((entry, index) => {
    const parsed = sourceEvidenceInteger(
      entry,
      expected[index]!,
      expected[index]!,
      `${path}[${index}]`,
    );
    return parsed;
  });
  return intrinsicRealBuildFreeze(result);
}

function roleDescriptor(
  value: unknown,
  index: number,
): RealBuildExactThreeSourcePacketRoleDescriptor {
  const path = `manifest.roles[${index}]`;
  const row = sourceEvidenceExactRecord(
    value,
    ["role", "contentEncoding", "byteLength", "digest"],
    path,
  );
  const role = REAL_BUILD_EXACT_THREE_SOURCE_ROLES[index]!;
  const encoding = REAL_BUILD_EXACT_THREE_SOURCE_ROLE_ENCODINGS[role];
  if (row.role !== role || row.contentEncoding !== encoding) {
    throw new TypeError(`${path} must retain fixed role ${role} with encoding ${encoding}.`);
  }
  const maximum =
    role === "source-high-rgba8"
      ? MAXIMUM_REAL_BUILD_EXACT_THREE_SOURCE_PACKET_HIGH_BYTES
      : role === "source-work-rgba8"
        ? MAXIMUM_REAL_BUILD_EXACT_THREE_SOURCE_PACKET_WORK_BYTES
        : MAXIMUM_REAL_BUILD_EXACT_THREE_SOURCE_PACKET_MASK_BYTES;
  return intrinsicRealBuildFreeze({
    role,
    contentEncoding: encoding,
    byteLength: sourceEvidenceInteger(row.byteLength, 1, maximum, `${path}.byteLength`),
    digest: sourceEvidenceDigestValue(row.digest, `${path}.digest`),
  });
}

function roleSlice(
  value: unknown,
  panelIndex: number,
  roleIndex: number,
  maximum: number,
): RealBuildExactThreeSourcePacketRoleSlice {
  const path = `manifest.panels[${panelIndex}].roleSlices[${roleIndex}]`;
  const row = sourceEvidenceExactRecord(value, ["role", "offset", "byteLength", "digest"], path);
  const role = REAL_BUILD_EXACT_THREE_SOURCE_ROLES[roleIndex]!;
  if (row.role !== role) throw new TypeError(`${path}.role must be ${role}.`);
  return intrinsicRealBuildFreeze({
    role,
    offset: sourceEvidenceInteger(row.offset, 0, maximum, `${path}.offset`),
    byteLength: sourceEvidenceInteger(row.byteLength, 1, maximum, `${path}.byteLength`),
    digest: sourceEvidenceDigestValue(row.digest, `${path}.digest`),
  });
}

function copyRole(
  value: unknown,
  descriptor: RealBuildExactThreeSourcePacketRoleDescriptor,
  maximum: number,
  path: string,
): Uint8Array {
  const bytes = sourceEvidenceCopyBytes(
    value,
    ["Uint8Array"],
    descriptor.byteLength,
    maximum,
    path,
  );
  if (sourceEvidenceDigest(bytes) !== descriptor.digest) {
    throw new TypeError(`${path} does not reproduce its manifest role digest.`);
  }
  return bytes;
}

function sliceRole(bytes: Uint8Array, slice: RealBuildExactThreeSourcePacketRoleSlice): Uint8Array {
  if (slice.byteLength > bytes.byteLength - slice.offset) {
    throw new RangeError(`Role slice ${slice.role} lies outside its retained role bytes.`);
  }
  const result = bytes.slice(slice.offset, slice.offset + slice.byteLength);
  if (sourceEvidenceDigest(result) !== slice.digest) {
    throw new TypeError(`Role slice ${slice.role} does not reproduce its digest.`);
  }
  return result;
}

export function readRealBuildExactThreeSourcePacket(
  inputValue: RealBuildExactThreeSourcePacketBytes | unknown,
): RealBuildExactThreeSourcePacketInspection {
  const input = sourceEvidenceExactRecord(
    inputValue,
    ["manifestBytes", "highRgbaRoleBytes", "workRgbaRoleBytes", "maskRoleBytes"],
    "Exact-three source packet bytes",
  );
  const parsed = sourceEvidenceParseCanonicalJson(
    input.manifestBytes,
    MAXIMUM_REAL_BUILD_EXACT_THREE_SOURCE_PACKET_MANIFEST_BYTES,
    "Exact-three source packet manifest",
  );
  const root = sourceEvidenceExactRecord(
    parsed.value,
    ["schemaVersion", "scope", "binding", "roles", "panels", "authority", "acceptedDocument"],
    "manifest",
  );
  if (root.schemaVersion !== REAL_BUILD_EXACT_THREE_SOURCE_PACKET_SCHEMA_VERSION) {
    throw new TypeError("Exact-three source packet schemaVersion is invalid.");
  }
  if (root.acceptedDocument !== null) {
    throw new TypeError("Exact-three source packet acceptedDocument must be null.");
  }

  const authority = sourceEvidenceExactRecord(
    root.authority,
    ["sourceText", "sourceExecution", "preparedRun", "physicalFrame", "placement", "completion"],
    "manifest.authority",
  );
  for (const key of Object.keys(REAL_BUILD_EXACT_THREE_SOURCE_AUTHORITY) as Array<
    keyof typeof REAL_BUILD_EXACT_THREE_SOURCE_AUTHORITY
  >) {
    if (authority[key] !== REAL_BUILD_EXACT_THREE_SOURCE_AUTHORITY[key]) {
      throw new TypeError(`manifest.authority.${key} must remain fixed and absent.`);
    }
  }

  const rawScope = sourceEvidenceExactRecord(
    root.scope,
    [
      "placementStepNumbers",
      "registrationPanelStepNumbers",
      "calloutProbePageNumbers",
      "indexedStepLabelCount",
      "materializedPagePanelCount",
      "emittedPanelCount",
    ],
    "manifest.scope",
  );
  const placementSteps = fixedNumbers(
    rawScope.placementStepNumbers,
    REAL_BUILD_EXACT_THREE_PLACEMENT_STEPS,
    "manifest.scope.placementStepNumbers",
  ) as typeof REAL_BUILD_EXACT_THREE_PLACEMENT_STEPS;
  const registrationPanels = fixedNumbers(
    rawScope.registrationPanelStepNumbers,
    REAL_BUILD_EXACT_THREE_REGISTRATION_PANELS,
    "manifest.scope.registrationPanelStepNumbers",
  ) as typeof REAL_BUILD_EXACT_THREE_REGISTRATION_PANELS;
  const probePagesRaw = sourceEvidenceDenseArray(
    rawScope.calloutProbePageNumbers,
    1,
    1,
    "manifest.scope.calloutProbePageNumbers",
  );
  const probePages = intrinsicRealBuildFreeze(
    probePagesRaw.map(
      (page, index) =>
        sourceEvidenceInteger(
          page,
          REAL_BUILD_EXACT_THREE_PAGE_NUMBER,
          REAL_BUILD_EXACT_THREE_PAGE_NUMBER,
          `manifest.scope.calloutProbePageNumbers[${index}]`,
        ) as typeof REAL_BUILD_EXACT_THREE_PAGE_NUMBER,
    ),
  );
  const scope = intrinsicRealBuildFreeze({
    placementStepNumbers: placementSteps,
    registrationPanelStepNumbers: registrationPanels,
    calloutProbePageNumbers: probePages,
    indexedStepLabelCount: sourceEvidenceInteger(
      rawScope.indexedStepLabelCount,
      REAL_BUILD_EXACT_THREE_INDEXED_STEP_LABEL_COUNT,
      REAL_BUILD_EXACT_THREE_INDEXED_STEP_LABEL_COUNT,
      "manifest.scope.indexedStepLabelCount",
    ) as typeof REAL_BUILD_EXACT_THREE_INDEXED_STEP_LABEL_COUNT,
    materializedPagePanelCount: sourceEvidenceInteger(
      rawScope.materializedPagePanelCount,
      REAL_BUILD_EXACT_THREE_MATERIALIZED_PAGE_PANEL_COUNT,
      REAL_BUILD_EXACT_THREE_MATERIALIZED_PAGE_PANEL_COUNT,
      "manifest.scope.materializedPagePanelCount",
    ) as typeof REAL_BUILD_EXACT_THREE_MATERIALIZED_PAGE_PANEL_COUNT,
    emittedPanelCount: sourceEvidenceInteger(
      rawScope.emittedPanelCount,
      3,
      3,
      "manifest.scope.emittedPanelCount",
    ) as 3,
  });

  const rawBinding = sourceEvidenceExactRecord(
    root.binding,
    [
      "pdfBytesDigest",
      CALLER_INSTRUCTION_SOURCE_SNAPSHOT_DIGEST,
      CALLER_SOURCE_CONTENT_HASH_CLAIM_MATCHED_PDF_BYTES,
      "sourceTextParserReplay",
    ],
    "manifest.binding",
  );
  if (
    rawBinding.callerSourceContentHashClaimMatchedPdfBytes !== true ||
    rawBinding.sourceTextParserReplay !== "not-performed"
  ) {
    throw new TypeError(
      "Exact-three source binding must retain its caller claim and parser absence.",
    );
  }
  const binding = intrinsicRealBuildFreeze({
    pdfBytesDigest: sourceEvidenceDigestValue(
      rawBinding.pdfBytesDigest,
      "manifest.binding.pdfBytesDigest",
    ),
    callerInstructionSourceSnapshotDigest: sourceEvidenceDigestValue(
      rawBinding.callerInstructionSourceSnapshotDigest,
      "manifest.binding." + CALLER_INSTRUCTION_SOURCE_SNAPSHOT_DIGEST,
    ),
    callerSourceContentHashClaimMatchedPdfBytes: true as const,
    sourceTextParserReplay: "not-performed" as const,
  });

  const rawRoles = sourceEvidenceDenseArray(root.roles, 3, 3, "manifest.roles");
  const roles = intrinsicRealBuildFreeze(rawRoles.map(roleDescriptor));
  const highRole = copyRole(
    input.highRgbaRoleBytes,
    roles[0]!,
    MAXIMUM_REAL_BUILD_EXACT_THREE_SOURCE_PACKET_HIGH_BYTES,
    "Exact-three high RGBA role",
  );
  const workRole = copyRole(
    input.workRgbaRoleBytes,
    roles[1]!,
    MAXIMUM_REAL_BUILD_EXACT_THREE_SOURCE_PACKET_WORK_BYTES,
    "Exact-three work RGBA role",
  );
  const maskRole = copyRole(
    input.maskRoleBytes,
    roles[2]!,
    MAXIMUM_REAL_BUILD_EXACT_THREE_SOURCE_PACKET_MASK_BYTES,
    "Exact-three packed-mask role",
  );
  const roleBytes = [highRole, workRole, maskRole] as const;
  const roleMaximums = [
    MAXIMUM_REAL_BUILD_EXACT_THREE_SOURCE_PACKET_HIGH_BYTES,
    MAXIMUM_REAL_BUILD_EXACT_THREE_SOURCE_PACKET_WORK_BYTES,
    MAXIMUM_REAL_BUILD_EXACT_THREE_SOURCE_PACKET_MASK_BYTES,
  ] as const;

  const rawPanels = sourceEvidenceDenseArray(root.panels, 3, 3, "manifest.panels");
  const offsets = [0, 0, 0];
  const panels: RealBuildExactThreeSourcePacketPanel[] = [];
  const compiledSources: RealBuildCompiledObservationSourceInput[] = [];
  const observedPages: number[] = [];
  for (let index = 0; index < 3; index += 1) {
    const path = `manifest.panels[${index}]`;
    const row = sourceEvidenceExactRecord(
      rawPanels[index],
      [
        "placementStepNumber",
        "registrationPanelStepNumber",
        "pageNumber",
        "bounds",
        "calloutBoxes",
        CALLER_SOURCE_PANEL_COMMITMENT_DIGEST,
        "sourceArtifactDescriptor",
        "roleSlices",
      ],
      path,
    );
    const placementStepNumber = sourceEvidenceInteger(
      row.placementStepNumber,
      REAL_BUILD_EXACT_THREE_PLACEMENT_STEPS[index]!,
      REAL_BUILD_EXACT_THREE_PLACEMENT_STEPS[index]!,
      `${path}.placementStepNumber`,
    ) as 1 | 2 | 3;
    const registrationPanelStepNumber = sourceEvidenceInteger(
      row.registrationPanelStepNumber,
      REAL_BUILD_EXACT_THREE_REGISTRATION_PANELS[index]!,
      REAL_BUILD_EXACT_THREE_REGISTRATION_PANELS[index]!,
      `${path}.registrationPanelStepNumber`,
    ) as 2 | 3 | 4;
    const pageNumber = sourceEvidenceInteger(
      row.pageNumber,
      REAL_BUILD_EXACT_THREE_PAGE_NUMBER,
      REAL_BUILD_EXACT_THREE_PAGE_NUMBER,
      `${path}.pageNumber`,
    ) as typeof REAL_BUILD_EXACT_THREE_PAGE_NUMBER;
    if (!observedPages.includes(pageNumber)) observedPages.push(pageNumber);
    const parsedBounds = bounds(row.bounds, `${path}.bounds`);
    const rawCallouts = sourceEvidenceDenseArray(
      row.calloutBoxes,
      0,
      1_024,
      `${path}.calloutBoxes`,
    );
    const calloutBoxes = intrinsicRealBuildFreeze(
      rawCallouts.map((box, boxIndex) => bounds(box, `${path}.calloutBoxes[${boxIndex}]`)),
    );
    const commitment = sourceEvidenceDigestValue(
      row.callerSourcePanelCommitmentDigest,
      `${path}.${CALLER_SOURCE_PANEL_COMMITMENT_DIGEST}`,
    );
    if (
      commitment !==
      stepPanelEvidenceDigest({
        pdfDigest: binding.pdfBytesDigest,
        stepNumber: registrationPanelStepNumber,
        pageNumber,
        bounds: parsedBounds,
        calloutBoxes,
      })
    ) {
      throw new TypeError(`${path} commitment does not reproduce its retained source binding.`);
    }
    const rawSlices = sourceEvidenceDenseArray(row.roleSlices, 3, 3, `${path}.roleSlices`);
    const slices = intrinsicRealBuildFreeze(
      rawSlices.map((slice, roleIndex) =>
        roleSlice(slice, index, roleIndex, roleMaximums[roleIndex]!),
      ),
    );
    for (let roleIndex = 0; roleIndex < 3; roleIndex += 1) {
      if (slices[roleIndex]!.offset !== offsets[roleIndex]) {
        throw new TypeError(`${path}.roleSlices[${roleIndex}] leaves a gap or overlap.`);
      }
      offsets[roleIndex] = offsets[roleIndex]! + slices[roleIndex]!.byteLength;
    }
    const high = sliceRole(roleBytes[0], slices[0]!);
    const work = sliceRole(roleBytes[1], slices[1]!);
    const masks = sliceRole(roleBytes[2], slices[2]!);
    const reproduced = createRealBuildBrowserOutputV4SourceEvidencePanel({
      pdfDigest: binding.pdfBytesDigest,
      panel: {
        stepNumber: registrationPanelStepNumber,
        pageNumber,
        ...parsedBounds,
        calloutBoxes,
        panelEvidenceDigest: commitment,
      },
      highRgba: new Uint8ClampedArray(high),
      workRgba: new Uint8ClampedArray(work),
    });
    if (
      canonicalStringify(row.sourceArtifactDescriptor) !==
        canonicalStringify(reproduced.descriptor) ||
      !sourceEvidenceEqualBytes(masks, reproduced.packedMaskBytes)
    ) {
      throw new TypeError(
        `${path} does not independently reproduce its source descriptor and masks.`,
      );
    }
    panels[index] = intrinsicRealBuildFreeze({
      placementStepNumber,
      registrationPanelStepNumber,
      pageNumber,
      bounds: parsedBounds,
      calloutBoxes,
      callerSourcePanelCommitmentDigest: commitment,
      sourceArtifactDescriptor: reproduced.descriptor,
      roleSlices: slices,
    });
    compiledSources[index] = deriveRealBuildExactThreeCompiledObservationSource(
      panels[index]!,
      masks,
    );
  }
  for (let roleIndex = 0; roleIndex < 3; roleIndex += 1) {
    if (offsets[roleIndex] !== roleBytes[roleIndex]!.byteLength) {
      throw new TypeError(
        `Exact-three role ${REAL_BUILD_EXACT_THREE_SOURCE_ROLES[roleIndex]} has orphan bytes.`,
      );
    }
  }
  if (
    observedPages.length !== probePages.length ||
    observedPages.some((page, index) => page !== probePages[index])
  ) {
    throw new TypeError("Exact-three panel pages do not reproduce the scoped callout probe pages.");
  }

  const manifest = intrinsicRealBuildFreeze({
    schemaVersion: REAL_BUILD_EXACT_THREE_SOURCE_PACKET_SCHEMA_VERSION,
    scope,
    binding,
    roles,
    panels: intrinsicRealBuildFreeze(panels),
    authority: REAL_BUILD_EXACT_THREE_SOURCE_AUTHORITY,
    acceptedDocument: null,
  }) as RealBuildExactThreeSourcePacketManifest;
  const inspection = intrinsicRealBuildFreeze({
    manifest,
    reproducible: true as const,
    sourceExecutionAuthority: "absent" as const,
    preparedRunAuthority: "absent" as const,
    physicalFrameAuthority: "absent" as const,
    placementAuthority: "absent" as const,
    completionAuthority: "absent" as const,
    acceptedDocument: null,
  });
  REFLECT_APPLY(WEAK_SET_ADD, INSPECTIONS, [inspection]);
  COMPILED_SOURCES.set(inspection, intrinsicRealBuildFreeze(compiledSources));
  return inspection;
}

export function readRealBuildExactThreeCompiledObservationSource(
  inspection: unknown,
  placementStepNumber: 1 | 2 | 3,
): RealBuildCompiledObservationSourceInput {
  requireRealBuildExactThreeSourcePacketInspection(inspection);
  const source = COMPILED_SOURCES.get(inspection as object)?.[placementStepNumber - 1];
  if (source === undefined) throw new TypeError("Exact-three compiled source was not retained.");
  return snapshotRealBuildCompiledObservationSource(source);
}

export function requireRealBuildExactThreeSourcePacketInspection(
  value: unknown,
): RealBuildExactThreeSourcePacketInspection {
  if (
    value === null ||
    typeof value !== "object" ||
    !(REFLECT_APPLY(WEAK_SET_HAS, INSPECTIONS, [value]) as boolean)
  ) {
    throw new TypeError(
      "Exact-three source packet inspection must be the exact privately branded reader result.",
    );
  }
  return value as RealBuildExactThreeSourcePacketInspection;
}
