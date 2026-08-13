import { sha256Hex } from "@lego-studio/brick-kernel";
import { describe, expect, it, vi } from "vitest";

import { packRealBuildCompiledBinaryMaskMsb } from "./real-build-compiled-observation-registration";
import { adjudicateRealBuildSourceParityCalibration } from "./real-build-observation-source-parity-calibration-adjudication";
import {
  createRealBuildSourceParityCalibrationContract,
  REAL_BUILD_SOURCE_PARITY_CALIBRATION_PANEL_PAGES,
  type RealBuildSourceParityCalibrationContract,
} from "./real-build-observation-source-parity-calibration-contract";
import {
  parseRealBuildSourceParityCalibrationTruth,
  REAL_BUILD_SOURCE_PARITY_CALIBRATION_TRUTH_ENCODING,
  REAL_BUILD_SOURCE_PARITY_CALIBRATION_TRUTH_ROLE,
} from "./real-build-observation-source-parity-calibration-truth";
import { realBuildSourceParityPreparedPanelsManifest } from "./real-build-observation-source-parity-contract";
import type { RealBuildSourceParityProbePanel } from "./real-build-observation-source-parity-types";

const digest = (value: string | Uint8Array) => `sha256:${sha256Hex(value)}` as const;

function pageForStep(stepNumber: number): number {
  if (stepNumber < 90) return 1;
  if (stepNumber < 101) return 79;
  if (stepNumber < 346) return 87;
  if (stepNumber < 358) return 213;
  return stepNumber === 358 ? 218 : 219;
}

function preparedPanels(): RealBuildSourceParityProbePanel[] {
  return Array.from({ length: 359 }, (_, index) => {
    const stepNumber = index + 1;
    return {
      stepNumber,
      pageNumber: pageForStep(stepNumber),
      minXPt: 0,
      maxXPt: 100,
      minYPt: 0,
      maxYPt: 99.7,
      calloutBoxes: [],
      panelEvidenceDigest: digest(`panel:${stepNumber}`),
    };
  });
}

function calibrationContract(): RealBuildSourceParityCalibrationContract {
  const pdfDigest = digest("pdf");
  const panels = preparedPanels();
  const fullPreparedPanelsDigest = digest(
    JSON.stringify(realBuildSourceParityPreparedPanelsManifest(pdfDigest, panels)),
  );
  return createRealBuildSourceParityCalibrationContract({
    pdfDigest,
    fullPreparedPanelsDigest,
    panels,
  });
}

function calibrationMasks(contract: RealBuildSourceParityCalibrationContract): Uint8Array[] {
  return contract.panels.map((panel, index) => {
    const mask = new Uint8Array(panel.pixelCount);
    mask[index + 1] = 1;
    mask[panel.pixelCount - index - 2] = 1;
    return mask;
  });
}

function truthFixture(
  contract: RealBuildSourceParityCalibrationContract,
  masks = calibrationMasks(contract),
  executionIdentityDigest = digest("execution"),
) {
  const packed = masks.map((mask, index) =>
    packRealBuildCompiledBinaryMaskMsb(
      mask,
      contract.panels[index]!.width,
      contract.panels[index]!.height,
    ),
  );
  const bytes = new Uint8Array(packed.reduce((sum, value) => sum + value.length, 0));
  let byteOffset = 0;
  const panels = contract.panels.map((panel, index) => {
    const rowBytes = packed[index]!;
    const row = {
      ...panel,
      byteOffset,
      byteLength: rowBytes.length,
      lowPaddingBits: (8 - (panel.pixelCount & 7)) & 7,
      packedDigest: digest(rowBytes),
      unpackedDigest: digest(masks[index]!),
    };
    bytes.set(rowBytes, byteOffset);
    byteOffset += rowBytes.length;
    return row;
  });
  return {
    packet: {
      schemaVersion: "lego.real-build-observation-source-parity-calibration-truth/1",
      review: {
        status: "human-reviewed",
        authority: "external-to-packet",
        method: "exact-human-inspection",
      },
      reviewedCalibrationDigest: contract.calibrationDigest,
      reviewedExecutionIdentityDigest: executionIdentityDigest,
      pdfDigest: contract.pdfDigest,
      fullPreparedPanelsDigest: contract.fullPreparedPanelsDigest,
      calibrationPreparedPanelsDigest: contract.calibrationPreparedPanelsDigest,
      role: {
        role: REAL_BUILD_SOURCE_PARITY_CALIBRATION_TRUTH_ROLE,
        encoding: REAL_BUILD_SOURCE_PARITY_CALIBRATION_TRUTH_ENCODING,
        byteLength: bytes.length,
        packedDigest: digest(bytes),
      },
      panels,
    },
    role: {
      role: REAL_BUILD_SOURCE_PARITY_CALIBRATION_TRUTH_ROLE,
      encoding: REAL_BUILD_SOURCE_PARITY_CALIBRATION_TRUTH_ENCODING,
      bytes,
    },
    masks,
    executionIdentityDigest,
  };
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function candidatePanels(
  contract: RealBuildSourceParityCalibrationContract,
  masks: readonly Uint8Array[],
) {
  return contract.panels.map((panel, index) => ({ ...panel, wMask: masks[index]! }));
}

describe("source-parity exact-five calibration foundation", () => {
  it("binds the fixed step/page tuple to both the dense full manifest and exact subset", () => {
    const contract = calibrationContract();
    expect(
      contract.panels.map(({ stepNumber, pageNumber }) => ({ stepNumber, pageNumber })),
    ).toEqual(REAL_BUILD_SOURCE_PARITY_CALIBRATION_PANEL_PAGES);
    expect(contract.authority).toBe("absent");
    expect(contract.fullPreparedPanelsDigest).not.toBe(contract.calibrationPreparedPanelsDigest);
    expect(Object.isFrozen(contract)).toBe(true);
    expect(Object.isFrozen(contract.panels)).toBe(true);
  });

  it("rejects proxy, accessor, and sparse full-manifest inputs without invoking accessors", () => {
    const panels = preparedPanels();
    const pdfDigest = digest("pdf");
    const fullPreparedPanelsDigest = digest(
      JSON.stringify(realBuildSourceParityPreparedPanelsManifest(pdfDigest, panels)),
    );
    let reads = 0;
    const accessor = { pdfDigest, fullPreparedPanelsDigest, panels };
    Object.defineProperty(accessor, "panels", {
      enumerable: true,
      get: () => {
        reads += 1;
        return panels;
      },
    });
    expect(() => createRealBuildSourceParityCalibrationContract(accessor)).toThrow(
      /data properties/su,
    );
    expect(reads).toBe(0);
    expect(() =>
      createRealBuildSourceParityCalibrationContract({
        pdfDigest,
        fullPreparedPanelsDigest,
        panels: new Proxy(panels, {}),
      }),
    ).toThrow(/ordinary dense Array/su);
    const sparse = new Array(359);
    expect(() =>
      createRealBuildSourceParityCalibrationContract({
        pdfDigest,
        fullPreparedPanelsDigest,
        panels: sparse,
      }),
    ).toThrow(/dense accessor-free array/su);
  });

  it("preflights caps, contiguity, and row shape before inspecting the external role", () => {
    const contract = calibrationContract();
    const fixture = truthFixture(contract);
    const invalid = clone(fixture.packet);
    invalid.panels[1]!.byteOffset += 1;
    let roleInspections = 0;
    const hostileRole = new Proxy(fixture.role, {
      getOwnPropertyDescriptor: () => {
        roleInspections += 1;
        throw new Error("role must remain untouched");
      },
    });
    expect(() => parseRealBuildSourceParityCalibrationTruth(invalid, hostileRole)).toThrow(
      /must start at byte/su,
    );
    expect(roleInspections).toBe(0);

    const oversized = clone(fixture.packet);
    oversized.panels[0]!.width = 1_048_576;
    oversized.panels[0]!.height = 2;
    oversized.panels[0]!.pixelCount = 2_097_152;
    expect(() => parseRealBuildSourceParityCalibrationTruth(oversized, hostileRole)).toThrow(
      /dimensions.*pixels/su,
    );
    expect(roleInspections).toBe(0);
  });

  it("validates every packet scalar and fixed literal before inspecting the external role", () => {
    const contract = calibrationContract();
    const fixture = truthFixture(contract);
    type Packet = typeof fixture.packet;
    const cases: readonly [string, (packet: Packet) => void][] = [
      ["schemaVersion", (packet) => (packet.schemaVersion = "wrong")],
      ["review.status", (packet) => (packet.review.status = "wrong")],
      ["review.authority", (packet) => (packet.review.authority = "wrong")],
      ["review.method", (packet) => (packet.review.method = "wrong")],
      [
        "reviewedCalibrationDigest",
        (packet) => (packet.reviewedCalibrationDigest = "wrong" as never),
      ],
      [
        "reviewedExecutionIdentityDigest",
        (packet) => (packet.reviewedExecutionIdentityDigest = "wrong" as never),
      ],
      ["pdfDigest", (packet) => (packet.pdfDigest = "wrong" as never)],
      [
        "fullPreparedPanelsDigest",
        (packet) => (packet.fullPreparedPanelsDigest = "wrong" as never),
      ],
      [
        "calibrationPreparedPanelsDigest",
        (packet) => (packet.calibrationPreparedPanelsDigest = "wrong" as never),
      ],
      ["role.role", (packet) => (packet.role.role = "wrong" as never)],
      ["role.encoding", (packet) => (packet.role.encoding = "wrong" as never)],
      ["role.byteLength", (packet) => (packet.role.byteLength = 0)],
      ["role.packedDigest", (packet) => (packet.role.packedDigest = "wrong" as never)],
      ["panel.stepNumber", (packet) => (packet.panels[0]!.stepNumber = 91)],
      ["panel.pageNumber", (packet) => (packet.panels[0]!.pageNumber = 80)],
      ["panel.width", (packet) => (packet.panels[0]!.width += 1)],
      ["panel.height", (packet) => (packet.panels[0]!.height += 1)],
      ["panel.pixelCount", (packet) => (packet.panels[0]!.pixelCount += 1)],
      ["panel.workFactor", (packet) => (packet.panels[0]!.workFactor = 3 as never)],
      ["panel.byteOffset", (packet) => (packet.panels[0]!.byteOffset = 1)],
      ["panel.byteLength", (packet) => (packet.panels[0]!.byteLength += 1)],
      ["panel.lowPaddingBits", (packet) => (packet.panels[0]!.lowPaddingBits = 0)],
      ["panel.packedDigest", (packet) => (packet.panels[0]!.packedDigest = "wrong" as never)],
      ["panel.unpackedDigest", (packet) => (packet.panels[0]!.unpackedDigest = "wrong" as never)],
    ];
    let roleInspections = 0;
    const original = Object.getOwnPropertyDescriptors;
    const descriptorSpy = vi.spyOn(Object, "getOwnPropertyDescriptors").mockImplementation(((
      value: object,
    ) => {
      if (value === fixture.role) roleInspections += 1;
      return original(value);
    }) as typeof Object.getOwnPropertyDescriptors);
    try {
      for (const [label, mutate] of cases) {
        const malformed = clone(fixture.packet);
        mutate(malformed);
        roleInspections = 0;
        expect(
          () => parseRealBuildSourceParityCalibrationTruth(malformed, fixture.role),
          label,
        ).toThrow();
        expect(roleInspections, label).toBe(0);
      }
    } finally {
      descriptorSpy.mockRestore();
    }
  });

  it("rejects sparse/accessor/proxy packet shapes and shared role storage", () => {
    const contract = calibrationContract();
    const fixture = truthFixture(contract);
    expect(() =>
      parseRealBuildSourceParityCalibrationTruth(new Proxy(fixture.packet, {}), fixture.role),
    ).toThrow(/non-proxy plain data record/su);
    const sparse = clone(fixture.packet);
    sparse.panels = new Array(5) as typeof sparse.panels;
    expect(() => parseRealBuildSourceParityCalibrationTruth(sparse, fixture.role)).toThrow(
      /dense accessor-free array/su,
    );
    const accessor = clone(fixture.packet);
    let reads = 0;
    Object.defineProperty(accessor.panels[0], "width", {
      enumerable: true,
      get: () => {
        reads += 1;
        return 500;
      },
    });
    expect(() => parseRealBuildSourceParityCalibrationTruth(accessor, fixture.role)).toThrow(
      /data properties/su,
    );
    expect(reads).toBe(0);
    if (typeof SharedArrayBuffer !== "undefined") {
      const shared = new Uint8Array(new SharedArrayBuffer(fixture.role.bytes.length));
      shared.set(fixture.role.bytes);
      expect(() =>
        parseRealBuildSourceParityCalibrationTruth(fixture.packet, {
          ...fixture.role,
          bytes: shared,
        }),
      ).toThrow(/SharedArrayBuffer/su);
    }
  });

  it("rejects padding, packed-digest, and logical-digest tampering", () => {
    const contract = calibrationContract();
    const fixture = truthFixture(contract);
    const digestTamper = clone(fixture.packet);
    digestTamper.role.packedDigest = digest("different");
    expect(() => parseRealBuildSourceParityCalibrationTruth(digestTamper, fixture.role)).toThrow(
      /role bytes.*packedDigest/su,
    );
    const logicalTamper = clone(fixture.packet);
    logicalTamper.panels[3]!.unpackedDigest = digest("different-mask");
    expect(() => parseRealBuildSourceParityCalibrationTruth(logicalTamper, fixture.role)).toThrow(
      /logical digest/su,
    );
    const paddingPacket = clone(fixture.packet);
    const paddingBytes = new Uint8Array(fixture.role.bytes);
    const first = paddingPacket.panels[0]!;
    const paddingIndex = first.byteOffset + first.byteLength - 1;
    paddingBytes[paddingIndex] = paddingBytes[paddingIndex]! | 1;
    first.packedDigest = digest(
      paddingBytes.slice(first.byteOffset, first.byteOffset + first.byteLength),
    );
    paddingPacket.role.packedDigest = digest(paddingBytes);
    expect(() =>
      parseRealBuildSourceParityCalibrationTruth(paddingPacket, {
        ...fixture.role,
        bytes: paddingBytes,
      }),
    ).toThrow(/non-zero low padding bits/su);
  });

  it("keeps absent, drifted, differing, and exact packet masks non-authoritative", () => {
    const contract = calibrationContract();
    const fixture = truthFixture(contract);
    const parsed = parseRealBuildSourceParityCalibrationTruth(fixture.packet, fixture.role);
    const candidates = candidatePanels(contract, fixture.masks);
    const absent = adjudicateRealBuildSourceParityCalibration({
      contract,
      executionIdentityDigest: fixture.executionIdentityDigest,
      truth: null,
      candidatePanels: new Proxy([], {
        get: () => {
          throw new Error("must not inspect");
        },
      }),
    });
    expect(absent).toMatchObject({
      authority: "absent",
      status: "needs-adjudication",
      reason: "human-truth-not-supplied",
      comparison: "not-run",
      comparedPanels: 0,
    });
    const driftFixture = truthFixture(contract, fixture.masks, digest("old-execution"));
    const driftTruth = parseRealBuildSourceParityCalibrationTruth(
      driftFixture.packet,
      driftFixture.role,
    );
    expect(
      adjudicateRealBuildSourceParityCalibration({
        contract,
        executionIdentityDigest: fixture.executionIdentityDigest,
        truth: driftTruth,
        candidatePanels: candidates,
      }),
    ).toMatchObject({
      status: "needs-adjudication",
      reason: "claimed-review-evidence-drifted",
      comparison: "not-run",
    });
    const changedMasks = fixture.masks.map((mask) => new Uint8Array(mask));
    changedMasks[2]![17] = changedMasks[2]![17]! ^ 1;
    expect(
      adjudicateRealBuildSourceParityCalibration({
        contract,
        executionIdentityDigest: fixture.executionIdentityDigest,
        truth: parsed,
        candidatePanels: candidatePanels(contract, changedMasks),
      }),
    ).toMatchObject({
      status: "needs-adjudication",
      reason: "human-review-authority-not-supplied",
      comparison: "candidate-w-differs-from-unverified-packet",
      differingSteps: [346],
    });
    const exact = adjudicateRealBuildSourceParityCalibration({
      contract,
      executionIdentityDigest: fixture.executionIdentityDigest,
      truth: parsed,
      candidatePanels: candidates,
    });
    expect(exact).toMatchObject({
      authority: "absent",
      status: "needs-adjudication",
      reason: "human-review-authority-not-supplied",
      comparison: "candidate-w-exactly-matches-unverified-packet",
      comparedPanels: 5,
      differingSteps: [],
    });
    expect(parsed.claimedReview.verification).toBe("unverified-external-review-claim");
    expect(Object.isFrozen(exact)).toBe(true);
    expect(() =>
      adjudicateRealBuildSourceParityCalibration({
        contract,
        executionIdentityDigest: fixture.executionIdentityDigest,
        truth: parsed,
        candidatePanels: candidates,
        humanReviewAuthority: parsed,
      }),
    ).toThrow(/must contain exactly/su);
  });

  it("rejects sparse, accessor, proxy, and shared candidate masks before comparison", () => {
    const contract = calibrationContract();
    const fixture = truthFixture(contract);
    const truth = parseRealBuildSourceParityCalibrationTruth(fixture.packet, fixture.role);
    const base = candidatePanels(contract, fixture.masks);
    const adjudicate = (candidatePanelsValue: unknown) =>
      adjudicateRealBuildSourceParityCalibration({
        contract,
        executionIdentityDigest: fixture.executionIdentityDigest,
        truth,
        candidatePanels: candidatePanelsValue,
      });
    expect(() => adjudicate(new Array(5))).toThrow(/dense accessor-free array/su);
    expect(() =>
      adjudicate(base.map((row, index) => (index === 1 ? new Proxy(row, {}) : row))),
    ).toThrow(/non-proxy plain data record/su);
    const accessor = base.map((row) => ({ ...row }));
    let reads = 0;
    Object.defineProperty(accessor[0], "wMask", {
      enumerable: true,
      get: () => {
        reads += 1;
        return fixture.masks[0];
      },
    });
    expect(() => adjudicate(accessor)).toThrow(/data properties/su);
    expect(reads).toBe(0);
    if (typeof SharedArrayBuffer !== "undefined") {
      const shared = new Uint8Array(new SharedArrayBuffer(fixture.masks[0]!.length));
      shared.set(fixture.masks[0]!);
      const sharedRows = [...base];
      sharedRows[0] = { ...sharedRows[0]!, wMask: shared };
      expect(() => adjudicate(sharedRows)).toThrow(/SharedArrayBuffer/su);
    }
  });
});
