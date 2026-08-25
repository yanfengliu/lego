import { canonicalDigest, sha256Hex } from "@lego-studio/brick-kernel";

import {
  snapshotRealBuildCompiledObservationSource,
  type RealBuildCompiledObservationSourceInput,
} from "./real-build-compiled-observation-source";
import { unpackRealBuildCompiledBinaryMaskMsb } from "./real-build-compiled-observation-registration";
import type { RealBuildExactThreeSourcePacketPanel } from "./real-build-exact-three-source-packet-types";

function unpack(
  panel: RealBuildExactThreeSourcePacketPanel,
  packedRoleSlice: Uint8Array,
  name: "lookahead-source" | "lookahead-exclusion",
): Uint8Array {
  const reference = panel.sourceArtifactDescriptor.masks.find(
    (candidate) => candidate.name === name,
  );
  if (
    reference === undefined ||
    reference.offset + reference.byteLength > packedRoleSlice.byteLength
  ) {
    throw new RangeError(`Exact-three ${name} reference lies outside its verified panel role.`);
  }
  const packed = packedRoleSlice.slice(reference.offset, reference.offset + reference.byteLength);
  if (`sha256:${sha256Hex(packed)}` !== reference.packedDigest) {
    throw new TypeError(`Exact-three ${name} packed bytes do not reproduce their descriptor.`);
  }
  const result = unpackRealBuildCompiledBinaryMaskMsb(packed, reference.width, reference.height);
  if (`sha256:${sha256Hex(result)}` !== reference.unpackedDigest) {
    throw new TypeError(`Exact-three ${name} pixels do not reproduce their descriptor.`);
  }
  return result;
}

/** Internal bridge from an independently replayed exact-three panel to score-only source pixels. */
export function deriveRealBuildExactThreeCompiledObservationSource(
  panel: RealBuildExactThreeSourcePacketPanel,
  packedMaskRoleSlice: Uint8Array,
): RealBuildCompiledObservationSourceInput {
  const descriptor = panel.sourceArtifactDescriptor;
  if (
    descriptor.stepNumber !== panel.registrationPanelStepNumber ||
    panel.registrationPanelStepNumber !== panel.placementStepNumber + 1
  ) {
    throw new TypeError("Exact-three compiled source requires one adjacent placement/panel pair.");
  }
  return snapshotRealBuildCompiledObservationSource({
    provisionalStepIdentity: canonicalDigest({
      schemaVersion: "lego.real-build-exact-three-provisional-step/1",
      placementStepNumber: panel.placementStepNumber,
      registrationPanelStepNumber: panel.registrationPanelStepNumber,
      callerSourcePanelCommitmentDigest: panel.callerSourcePanelCommitmentDigest,
      descriptor,
    }),
    observationMode: "lookahead",
    registrationPanelStepNumber: panel.registrationPanelStepNumber,
    pageNumber: panel.pageNumber,
    panelDigest: panel.callerSourcePanelCommitmentDigest,
    cropDigest: descriptor.cropDescriptorDigest,
    sourceDescriptorDigest: descriptor.lookahead.sourceDescriptorDigest,
    exclusionDescriptorDigest: descriptor.lookahead.exclusionDescriptorDigest,
    measure: descriptor.lookahead.measure,
    widthPx: descriptor.workWidth,
    heightPx: descriptor.workHeight,
    sourceMask: unpack(panel, packedMaskRoleSlice, "lookahead-source"),
    excludedMask: unpack(panel, packedMaskRoleSlice, "lookahead-exclusion"),
  });
}
