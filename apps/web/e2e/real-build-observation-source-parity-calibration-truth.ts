import {
  canonicalDigest,
  deepFreeze,
  sha256Hex,
  type Sha256Digest,
} from "@lego-studio/brick-kernel";

import { unpackRealBuildCompiledBinaryMaskMsb } from "./real-build-compiled-observation-registration";
import {
  REAL_BUILD_SOURCE_PARITY_CALIBRATION_PANEL_PAGES,
  type RealBuildSourceParityCalibrationPanelContract,
} from "./real-build-observation-source-parity-calibration-contract";
import { REAL_BUILD_SOURCE_PARITY_MAXIMUM_PIXELS } from "./real-build-observation-source-parity-contract";
import {
  boundedDenseSourceParityArray,
  exactSourceParityKeys,
  snapshotDenseSourceParityArray,
  snapshotSourceParityRecord,
  sourceParityDigest,
  sourceParityInteger,
} from "./real-build-observation-source-parity-output-primitives";

export const REAL_BUILD_SOURCE_PARITY_CALIBRATION_TRUTH_ROLE = "human-truth-w-mask-bytes" as const;
export const REAL_BUILD_SOURCE_PARITY_CALIBRATION_TRUTH_ENCODING = "packed-msb/1" as const;
export const REAL_BUILD_SOURCE_PARITY_MAXIMUM_CALIBRATION_TRUTH_PIXELS =
  REAL_BUILD_SOURCE_PARITY_CALIBRATION_PANEL_PAGES.length * REAL_BUILD_SOURCE_PARITY_MAXIMUM_PIXELS;
export const REAL_BUILD_SOURCE_PARITY_MAXIMUM_CALIBRATION_TRUTH_BYTES = Math.ceil(
  REAL_BUILD_SOURCE_PARITY_MAXIMUM_CALIBRATION_TRUTH_PIXELS / 8,
);

export interface RealBuildSourceParityCalibrationTruthPanel extends RealBuildSourceParityCalibrationPanelContract {
  readonly byteOffset: number;
  readonly byteLength: number;
  readonly lowPaddingBits: number;
  readonly packedDigest: Sha256Digest;
  readonly unpackedDigest: Sha256Digest;
}

interface RealBuildSourceParityCalibrationReviewClaim {
  readonly status: "human-reviewed";
  readonly authority: "external-to-packet";
  readonly method: "exact-human-inspection";
}

export interface InspectedRealBuildSourceParityCalibrationPacket {
  readonly schemaVersion: "lego.real-build-observation-source-parity-calibration-truth/1";
  readonly claimedReview: {
    readonly claimedStatus: "human-reviewed";
    readonly claimedAuthority: "external-to-packet";
    readonly claimedMethod: "exact-human-inspection";
    readonly verification: "unverified-external-review-claim";
  };
  readonly reviewedCalibrationDigest: Sha256Digest;
  readonly reviewedExecutionIdentityDigest: Sha256Digest;
  readonly pdfDigest: Sha256Digest;
  readonly fullPreparedPanelsDigest: Sha256Digest;
  readonly calibrationPreparedPanelsDigest: Sha256Digest;
  readonly role: {
    readonly role: typeof REAL_BUILD_SOURCE_PARITY_CALIBRATION_TRUTH_ROLE;
    readonly encoding: typeof REAL_BUILD_SOURCE_PARITY_CALIBRATION_TRUTH_ENCODING;
    readonly byteLength: number;
    readonly packedDigest: Sha256Digest;
  };
  readonly panels: readonly RealBuildSourceParityCalibrationTruthPanel[];
  readonly packetDigest: Sha256Digest;
}

const inspectionMasks = new WeakMap<
  InspectedRealBuildSourceParityCalibrationPacket,
  readonly Uint8Array[]
>();
const TYPED_ARRAY_PROTOTYPE = Object.getPrototypeOf(Uint8Array.prototype) as object;
const TYPED_ARRAY_LENGTH = Object.getOwnPropertyDescriptor(TYPED_ARRAY_PROTOTYPE, "length")?.get;
const TYPED_ARRAY_BUFFER = Object.getOwnPropertyDescriptor(TYPED_ARRAY_PROTOTYPE, "buffer")?.get;
const TYPED_ARRAY_TAG = Object.getOwnPropertyDescriptor(
  TYPED_ARRAY_PROTOTYPE,
  Symbol.toStringTag,
)?.get;
const SHARED_BYTE_LENGTH =
  typeof SharedArrayBuffer === "undefined"
    ? undefined
    : Object.getOwnPropertyDescriptor(SharedArrayBuffer.prototype, "byteLength")?.get;

const rawDigest = (bytes: Uint8Array): Sha256Digest => `sha256:${sha256Hex(bytes)}`;

function snapshotPrivateRoleBytes(value: unknown, expectedLength: number): Uint8Array {
  let length: number;
  let buffer: ArrayBufferLike;
  let tag: string;
  try {
    if (
      TYPED_ARRAY_LENGTH === undefined ||
      TYPED_ARRAY_BUFFER === undefined ||
      TYPED_ARRAY_TAG === undefined
    ) {
      throw null;
    }
    length = TYPED_ARRAY_LENGTH.call(value) as number;
    buffer = TYPED_ARRAY_BUFFER.call(value) as ArrayBufferLike;
    tag = TYPED_ARRAY_TAG.call(value) as string;
  } catch {
    throw new TypeError(
      "Calibration human-truth role bytes must be one exact intrinsic Uint8Array, not a proxy or array-like wrapper.",
    );
  }
  if (tag !== "Uint8Array") {
    throw new TypeError(
      "Calibration human-truth role bytes must be one exact intrinsic Uint8Array, not a clamped or alternate typed array.",
    );
  }
  let prototype: object | null;
  try {
    prototype = Object.getPrototypeOf(value) as object | null;
  } catch {
    throw new TypeError("Calibration human-truth role bytes prototype refused safe inspection.");
  }
  if (prototype !== Uint8Array.prototype) {
    throw new TypeError(
      "Calibration human-truth role bytes must use the exact intrinsic Uint8Array prototype.",
    );
  }
  if (length !== expectedLength) {
    throw new RangeError(
      `Calibration human-truth role holds ${length} bytes; its preflighted packet requires exactly ${expectedLength}.`,
    );
  }
  if (SHARED_BYTE_LENGTH !== undefined) {
    let shared = false;
    try {
      SHARED_BYTE_LENGTH.call(buffer);
      shared = true;
    } catch {
      // The SharedArrayBuffer intrinsic rejects ordinary ArrayBuffer storage.
    }
    if (shared) {
      throw new TypeError(
        "Calibration human-truth role must not use SharedArrayBuffer storage; pass a private immutable snapshot.",
      );
    }
  }
  const snapshot = new Uint8Array(length);
  try {
    Uint8Array.prototype.set.call(snapshot, value as Uint8Array);
  } catch {
    throw new TypeError(
      "Calibration human-truth role bytes could not be copied from live non-shared storage.",
    );
  }
  return snapshot;
}

function parseReview(value: unknown): RealBuildSourceParityCalibrationReviewClaim {
  exactSourceParityKeys(value, ["status", "authority", "method"], "Calibration truth review");
  const review = snapshotSourceParityRecord(value as RealBuildSourceParityCalibrationReviewClaim, [
    "status",
    "authority",
    "method",
  ]);
  if (
    review.status !== "human-reviewed" ||
    review.authority !== "external-to-packet" ||
    review.method !== "exact-human-inspection"
  ) {
    throw new TypeError(
      "Calibration truth review must explicitly be human-reviewed, external-to-packet, and exact-human-inspection.",
    );
  }
  return Object.freeze({ ...review });
}

function parseRoleDescriptor(
  value: unknown,
): InspectedRealBuildSourceParityCalibrationPacket["role"] {
  exactSourceParityKeys(
    value,
    ["role", "encoding", "byteLength", "packedDigest"],
    "Calibration truth role descriptor",
  );
  const role = snapshotSourceParityRecord(
    value as InspectedRealBuildSourceParityCalibrationPacket["role"],
    ["role", "encoding", "byteLength", "packedDigest"],
  );
  if (
    role.role !== REAL_BUILD_SOURCE_PARITY_CALIBRATION_TRUTH_ROLE ||
    role.encoding !== REAL_BUILD_SOURCE_PARITY_CALIBRATION_TRUTH_ENCODING
  ) {
    throw new TypeError(
      `Calibration truth must declare role ${REAL_BUILD_SOURCE_PARITY_CALIBRATION_TRUTH_ROLE} with ${REAL_BUILD_SOURCE_PARITY_CALIBRATION_TRUTH_ENCODING}.`,
    );
  }
  return Object.freeze({
    role: role.role,
    encoding: role.encoding,
    byteLength: sourceParityInteger(
      role.byteLength,
      1,
      REAL_BUILD_SOURCE_PARITY_MAXIMUM_CALIBRATION_TRUTH_BYTES,
      "Calibration truth role byteLength",
    ),
    packedDigest: sourceParityDigest(
      role.packedDigest,
      "Calibration truth role packedDigest",
    ) as Sha256Digest,
  });
}

function parsePanel(
  value: unknown,
  index: number,
  expectedOffset: number,
): RealBuildSourceParityCalibrationTruthPanel {
  const label = `Calibration truth panel row ${index}`;
  exactSourceParityKeys(
    value,
    [
      "stepNumber",
      "pageNumber",
      "width",
      "height",
      "pixelCount",
      "workFactor",
      "byteOffset",
      "byteLength",
      "lowPaddingBits",
      "packedDigest",
      "unpackedDigest",
    ],
    label,
  );
  const row = snapshotSourceParityRecord(value as RealBuildSourceParityCalibrationTruthPanel, [
    "stepNumber",
    "pageNumber",
    "width",
    "height",
    "pixelCount",
    "workFactor",
    "byteOffset",
    "byteLength",
    "lowPaddingBits",
    "packedDigest",
    "unpackedDigest",
  ]);
  const expectedIdentity = REAL_BUILD_SOURCE_PARITY_CALIBRATION_PANEL_PAGES[index]!;
  const width = sourceParityInteger(
    row.width,
    1,
    REAL_BUILD_SOURCE_PARITY_MAXIMUM_PIXELS,
    `${label}.width`,
  );
  const height = sourceParityInteger(
    row.height,
    1,
    REAL_BUILD_SOURCE_PARITY_MAXIMUM_PIXELS,
    `${label}.height`,
  );
  const pixelCount = width * height;
  if (
    row.stepNumber !== expectedIdentity.stepNumber ||
    row.pageNumber !== expectedIdentity.pageNumber ||
    row.workFactor !== 2
  ) {
    throw new TypeError(
      `${label} must bind step/page ${expectedIdentity.stepNumber}/${expectedIdentity.pageNumber} at work factor 2.`,
    );
  }
  if (
    !Number.isSafeInteger(pixelCount) ||
    pixelCount < 1 ||
    pixelCount > REAL_BUILD_SOURCE_PARITY_MAXIMUM_PIXELS ||
    row.pixelCount !== pixelCount
  ) {
    throw new RangeError(
      `${label} dimensions ${width}x${height} require ${String(pixelCount)} pixels, not ${String(row.pixelCount)}.`,
    );
  }
  const byteLength = Math.ceil(pixelCount / 8);
  const lowPaddingBits = (8 - (pixelCount & 7)) & 7;
  if (
    row.byteOffset !== expectedOffset ||
    row.byteLength !== byteLength ||
    row.lowPaddingBits !== lowPaddingBits
  ) {
    throw new RangeError(
      `${label} must start at byte ${expectedOffset}, retain ${byteLength} packed bytes, and declare ${lowPaddingBits} low padding bits.`,
    );
  }
  return Object.freeze({
    stepNumber: row.stepNumber,
    pageNumber: row.pageNumber,
    width,
    height,
    pixelCount,
    workFactor: 2,
    byteOffset: expectedOffset,
    byteLength,
    lowPaddingBits,
    packedDigest: sourceParityDigest(row.packedDigest, `${label}.packedDigest`) as Sha256Digest,
    unpackedDigest: sourceParityDigest(
      row.unpackedDigest,
      `${label}.unpackedDigest`,
    ) as Sha256Digest,
  });
}

export function parseRealBuildSourceParityCalibrationTruth(
  rawPacket: unknown,
  rawRole: unknown,
): InspectedRealBuildSourceParityCalibrationPacket {
  exactSourceParityKeys(
    rawPacket,
    [
      "schemaVersion",
      "review",
      "reviewedCalibrationDigest",
      "reviewedExecutionIdentityDigest",
      "pdfDigest",
      "fullPreparedPanelsDigest",
      "calibrationPreparedPanelsDigest",
      "role",
      "panels",
    ],
    "Calibration truth packet",
  );
  const packet = snapshotSourceParityRecord(rawPacket as Record<string, unknown>, [
    "schemaVersion",
    "review",
    "reviewedCalibrationDigest",
    "reviewedExecutionIdentityDigest",
    "pdfDigest",
    "fullPreparedPanelsDigest",
    "calibrationPreparedPanelsDigest",
    "role",
    "panels",
  ]);
  if (packet.schemaVersion !== "lego.real-build-observation-source-parity-calibration-truth/1") {
    throw new TypeError(
      "Calibration truth packet schemaVersion must be lego.real-build-observation-source-parity-calibration-truth/1.",
    );
  }
  const reviewClaim = parseReview(packet.review);
  const reviewedCalibrationDigest = sourceParityDigest(
    packet.reviewedCalibrationDigest,
    "Calibration truth reviewedCalibrationDigest",
  ) as Sha256Digest;
  const reviewedExecutionIdentityDigest = sourceParityDigest(
    packet.reviewedExecutionIdentityDigest,
    "Calibration truth reviewedExecutionIdentityDigest",
  ) as Sha256Digest;
  const pdfDigest = sourceParityDigest(
    packet.pdfDigest,
    "Calibration truth PDF digest",
  ) as Sha256Digest;
  const fullPreparedPanelsDigest = sourceParityDigest(
    packet.fullPreparedPanelsDigest,
    "Calibration truth full prepared-panels digest",
  ) as Sha256Digest;
  const calibrationPreparedPanelsDigest = sourceParityDigest(
    packet.calibrationPreparedPanelsDigest,
    "Calibration truth subset prepared-panels digest",
  ) as Sha256Digest;
  const role = parseRoleDescriptor(packet.role);
  boundedDenseSourceParityArray(
    packet.panels,
    REAL_BUILD_SOURCE_PARITY_CALIBRATION_PANEL_PAGES.length,
    REAL_BUILD_SOURCE_PARITY_CALIBRATION_PANEL_PAGES.length,
    "Calibration truth panels",
  );
  let expectedOffset = 0;
  let totalPixels = 0;
  const panels = snapshotDenseSourceParityArray(packet.panels).map((value, index) => {
    const panel = parsePanel(value, index, expectedOffset);
    expectedOffset += panel.byteLength;
    totalPixels += panel.pixelCount;
    if (totalPixels > REAL_BUILD_SOURCE_PARITY_MAXIMUM_CALIBRATION_TRUTH_PIXELS) {
      throw new RangeError(
        `Calibration truth rows exceed ${REAL_BUILD_SOURCE_PARITY_MAXIMUM_CALIBRATION_TRUTH_PIXELS} aggregate pixels before external role access.`,
      );
    }
    return panel;
  });
  if (expectedOffset !== role.byteLength) {
    throw new RangeError(
      `Calibration truth contiguous rows require ${expectedOffset} bytes, not role byteLength ${role.byteLength}, before external role access.`,
    );
  }

  exactSourceParityKeys(rawRole, ["role", "encoding", "bytes"], "Calibration truth external role");
  const externalRole = snapshotSourceParityRecord(
    rawRole as { readonly role: unknown; readonly encoding: unknown; readonly bytes: unknown },
    ["role", "encoding", "bytes"],
  );
  if (externalRole.role !== role.role || externalRole.encoding !== role.encoding) {
    throw new TypeError(
      "Calibration truth external role identity or packed-MSB encoding differs from its preflighted packet descriptor.",
    );
  }
  const roleBytes = snapshotPrivateRoleBytes(externalRole.bytes, role.byteLength);
  if (rawDigest(roleBytes) !== role.packedDigest) {
    throw new TypeError(
      "Calibration truth external role bytes do not reproduce the packet role packedDigest.",
    );
  }
  const masks = panels.map((panel) => {
    const packed = roleBytes.slice(panel.byteOffset, panel.byteOffset + panel.byteLength);
    if (rawDigest(packed) !== panel.packedDigest) {
      throw new TypeError(
        `Calibration truth step ${panel.stepNumber} packed bytes do not reproduce its row digest.`,
      );
    }
    const unpacked = unpackRealBuildCompiledBinaryMaskMsb(packed, panel.width, panel.height);
    if (rawDigest(unpacked) !== panel.unpackedDigest) {
      throw new TypeError(
        `Calibration truth step ${panel.stepNumber} unpacked mask does not reproduce its logical digest.`,
      );
    }
    return unpacked;
  });
  const packetBase = {
    schemaVersion: "lego.real-build-observation-source-parity-calibration-truth/1" as const,
    review: reviewClaim,
    reviewedCalibrationDigest,
    reviewedExecutionIdentityDigest,
    pdfDigest,
    fullPreparedPanelsDigest,
    calibrationPreparedPanelsDigest,
    role,
    panels,
  };
  const parsed = deepFreeze({
    schemaVersion: packetBase.schemaVersion,
    claimedReview: {
      claimedStatus: reviewClaim.status,
      claimedAuthority: reviewClaim.authority,
      claimedMethod: reviewClaim.method,
      verification: "unverified-external-review-claim" as const,
    },
    reviewedCalibrationDigest,
    reviewedExecutionIdentityDigest,
    pdfDigest,
    fullPreparedPanelsDigest,
    calibrationPreparedPanelsDigest,
    role,
    panels,
    packetDigest: canonicalDigest(packetBase),
  });
  inspectionMasks.set(parsed, masks);
  return parsed;
}

export function copyRealBuildSourceParityCalibrationInspectionMask(
  inspection: unknown,
  index: number,
): Uint8Array {
  if (
    inspection === null ||
    typeof inspection !== "object" ||
    !inspectionMasks.has(inspection as InspectedRealBuildSourceParityCalibrationPacket)
  ) {
    throw new TypeError(
      "Calibration mask inspection requires a structurally parsed packet; packet review claims remain unverified.",
    );
  }
  const masks = inspectionMasks.get(inspection as InspectedRealBuildSourceParityCalibrationPacket)!;
  if (!Number.isSafeInteger(index) || index < 0 || index >= masks.length) {
    throw new RangeError(
      `Calibration truth mask index ${String(index)} is outside 0..${masks.length - 1}.`,
    );
  }
  return new Uint8Array(masks[index]!);
}

export function requireInspectedRealBuildSourceParityCalibrationPacket(
  value: unknown,
): InspectedRealBuildSourceParityCalibrationPacket {
  if (
    value === null ||
    typeof value !== "object" ||
    !inspectionMasks.has(value as InspectedRealBuildSourceParityCalibrationPacket)
  ) {
    throw new TypeError(
      "Calibration adjudication requires a structurally parsed inspection packet; this does not authenticate its review claim.",
    );
  }
  return value as InspectedRealBuildSourceParityCalibrationPacket;
}
