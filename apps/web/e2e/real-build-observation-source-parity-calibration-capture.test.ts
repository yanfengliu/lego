import { canonicalStringify } from "@lego-studio/brick-kernel";
import { describe, expect, it } from "vitest";

import {
  createRealBuildSourceParityCalibrationCaptureArtifact,
  preflightRealBuildSourceParityCalibrationBrowserCaptureEvidence,
} from "./real-build-observation-source-parity-calibration-capture";
import {
  copyRealBuildSourceParityCalibrationCaptureArtifact,
  parseRealBuildSourceParityCalibrationCapture,
} from "./real-build-observation-source-parity-calibration-capture-parser";
import { decodeRealBuildSourceParityCalibrationCapturePng } from "./real-build-observation-source-parity-calibration-capture-png";
import {
  calibrationCaptureTestDigest,
  encodeCalibrationCaptureSplitIdatTestPng,
  createCalibrationCaptureTestWire,
} from "./real-build-observation-source-parity-calibration-capture-test-fixture";

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function unpackMask(packed: Uint8Array, pixelCount: number): Uint8Array {
  const result = new Uint8Array(pixelCount);
  for (let pixel = 0; pixel < pixelCount; pixel += 1) {
    result[pixel] = (packed[pixel >>> 3]! >>> (7 - (pixel & 7))) & 1;
  }
  return result;
}

function pairwiseBinding(
  leftName: "P" | "D",
  rightName: "D" | "W",
  left: Uint8Array,
  right: Uint8Array,
) {
  const xor = new Uint8Array(left.length);
  let differingPixels = 0;
  let intersectionPixels = 0;
  let unionPixels = 0;
  left.forEach((value, pixel) => {
    const other = right[pixel]!;
    if (value !== other) {
      xor[pixel] = 1;
      differingPixels += 1;
    }
    if (value === 1 && other === 1) intersectionPixels += 1;
    if (value === 1 || other === 1) unionPixels += 1;
  });
  return {
    left: leftName,
    right: rightName,
    differingPixels,
    intersectionPixels,
    unionPixels,
    iou: unionPixels === 0 ? 1 : intersectionPixels / unionPixels,
    xorDigest: calibrationCaptureTestDigest(xor),
  };
}

function createArtifact() {
  return createRealBuildSourceParityCalibrationCaptureArtifact({
    browserCapture: createCalibrationCaptureTestWire(),
  });
}

describe("source-parity calibration capture", () => {
  it("admits an exact five-panel wire without minting human or document authority", () => {
    const wire = createCalibrationCaptureTestWire();
    const preflight = preflightRealBuildSourceParityCalibrationBrowserCaptureEvidence(wire);
    expect(preflight.browserCaptureDigest).toBe(
      calibrationCaptureTestDigest(preflight.browserCaptureBytes),
    );
    expect(new TextDecoder().decode(preflight.browserCaptureBytes)).toBe(
      canonicalStringify(preflight.browserCapture),
    );

    const artifact = createRealBuildSourceParityCalibrationCaptureArtifact({
      browserCapture: preflight.browserCapture,
    });
    expect(artifact.manifest.authority).toStrictEqual({
      status: "absent",
      authorized: false,
      reason: "pending-human-review/1",
    });
    expect(artifact.manifest.reviewState).toBe("pending-unreviewed");
    expect(artifact.manifest.browserCaptureDigest).toBe(preflight.browserCaptureDigest);
    expect(artifact.manifest.roles).toHaveLength(5);
    expect(artifact.manifest.panels).toHaveLength(5);
    expect(new TextDecoder().decode(artifact.readManifestBytes())).not.toContain("base64");
  });

  it("exports copy-on-read inert attachments and independently reparses them", () => {
    const artifact = createArtifact();
    const first = copyRealBuildSourceParityCalibrationCaptureArtifact(artifact);
    const originalManifestByte = first.manifestBytes[0]!;
    const originalRoleByte = first.roles[0]!.bytes[0]!;
    const originalPngByte = first.pngs[0]!.bytes[0]!;
    first.manifestBytes[0] = first.manifestBytes[0]! ^ 0xff;
    first.roles[0]!.bytes[0] = first.roles[0]!.bytes[0]! ^ 0xff;
    first.pngs[0]!.bytes[0] = first.pngs[0]!.bytes[0]! ^ 0xff;
    const second = copyRealBuildSourceParityCalibrationCaptureArtifact(artifact);
    expect(second.manifestBytes[0]).toBe(originalManifestByte);
    expect(second.roles[0]!.bytes[0]).toBe(originalRoleByte);
    expect(second.pngs[0]!.bytes[0]).toBe(originalPngByte);
    const reparsed = parseRealBuildSourceParityCalibrationCapture(
      second.manifestBytes,
      second.roles,
      second.pngs,
    );
    expect(reparsed.manifestDigest).toBe(artifact.manifestDigest);
    expect(() =>
      copyRealBuildSourceParityCalibrationCaptureArtifact({
        ...artifact,
      }),
    ).toThrow(/admitted by the current parser, not a detached lookalike/u);
  });

  it("rejects non-canonical and shape-hostile transient transport before decoding", () => {
    const wire = clone(createCalibrationCaptureTestWire()) as unknown as {
      roles: { base64: string }[];
    };
    wire.roles[0]!.base64 = `${wire.roles[0]!.base64.slice(0, -2)}==`;
    expect(() => preflightRealBuildSourceParityCalibrationBrowserCaptureEvidence(wire)).toThrow(
      /bounded canonical base64|canonical base64 spelling|decodes to 19999 bytes/u,
    );

    const accessorWire = clone(createCalibrationCaptureTestWire()) as unknown as Record<
      string,
      unknown
    >;
    let accessed = false;
    Object.defineProperty(accessorWire, "roles", {
      enumerable: true,
      get: () => {
        accessed = true;
        return [];
      },
    });
    expect(() =>
      preflightRealBuildSourceParityCalibrationBrowserCaptureEvidence(accessorWire),
    ).toThrow(/roles must be one enumerable data property, not an accessor/u);
    expect(accessed).toBe(false);
    expect(() =>
      preflightRealBuildSourceParityCalibrationBrowserCaptureEvidence(
        new Proxy(createCalibrationCaptureTestWire(), {}),
      ),
    ).toThrow(/non-proxy plain data record/u);
  });

  it("preflights malformed retained manifest before touching external roles", () => {
    const attachments = copyRealBuildSourceParityCalibrationCaptureArtifact(createArtifact());
    const manifest = JSON.parse(new TextDecoder().decode(attachments.manifestBytes)) as Record<
      string,
      unknown
    >;
    (manifest.panels as Record<string, unknown>[])[0]!.highPixelCount = 999;
    let roleAccessed = false;
    const role = Object.create(null) as Record<string, unknown>;
    Object.defineProperties(role, {
      role: { enumerable: true, value: attachments.roles[0]!.role },
      bytes: {
        enumerable: true,
        get: () => {
          roleAccessed = true;
          return attachments.roles[0]!.bytes;
        },
      },
    });
    expect(() =>
      parseRealBuildSourceParityCalibrationCapture(
        new TextEncoder().encode(canonicalStringify(manifest)),
        [role, ...attachments.roles.slice(1)],
        attachments.pngs,
      ),
    ).toThrow(/highPixelCount observed 999/u);
    expect(roleAccessed).toBe(false);
  });

  it("rejects PNG attachment bytes that are not exactly descriptor-bound", () => {
    const attachments = copyRealBuildSourceParityCalibrationCaptureArtifact(createArtifact());
    const pngs = attachments.pngs.map((row) => ({
      ...row,
      bytes: new Uint8Array(row.bytes),
    }));
    pngs[0]!.bytes[0] = pngs[0]!.bytes[0]! ^ 1;
    expect(() =>
      parseRealBuildSourceParityCalibrationCapture(
        attachments.manifestBytes,
        attachments.roles,
        pngs,
      ),
    ).toThrow(/attachment length\/digest does not match/u);
    expect(() =>
      decodeRealBuildSourceParityCalibrationCapturePng(
        encodeCalibrationCaptureSplitIdatTestPng(1_021),
        1,
        "Calibration adversarial split-IDAT fixture",
      ),
    ).toThrow(
      /Calibration adversarial split-IDAT fixture PNG contains more than 1020 IDAT chunks/u,
    );
  });

  it("rejects exact-role byte tamper and a manifest-rebound W that rederivation disproves", () => {
    const attachments = copyRealBuildSourceParityCalibrationCaptureArtifact(createArtifact());
    const tamperedRoles = attachments.roles.map((row, index) => ({
      ...row,
      bytes: index === 0 ? new Uint8Array(row.bytes) : row.bytes,
    }));
    tamperedRoles[0]!.bytes[0] = tamperedRoles[0]!.bytes[0]! ^ 1;
    expect(() =>
      parseRealBuildSourceParityCalibrationCapture(
        attachments.manifestBytes,
        tamperedRoles,
        attachments.pngs,
      ),
    ).toThrow(/does not match declared length\/digest/u);

    const wire = clone(createCalibrationCaptureTestWire()) as unknown as {
      roles: { base64: string; digest: string }[];
      panels: {
        pMask: { offset: number; bytes: number; pixelCount: number };
        dMask: { offset: number; bytes: number; pixelCount: number };
        wMask: {
          offset: number;
          byteLength: number;
          pixelCount: number;
          digest: string;
          unpackedDigest: string;
        };
        pairwisePdw: unknown[];
      }[];
    };
    const wRole = wire.roles[4]!;
    const wBytes = Buffer.from(wRole.base64, "base64");
    wBytes[0] = wBytes[0]! ^ 0x80;
    wRole.base64 = wBytes.toString("base64");
    wRole.digest = calibrationCaptureTestDigest(wBytes);
    const first = wire.panels[0]!;
    const firstPacked = wBytes.subarray(
      first.wMask.offset,
      first.wMask.offset + first.wMask.byteLength,
    );
    const reboundW = unpackMask(firstPacked, first.wMask.pixelCount);
    first.wMask.digest = calibrationCaptureTestDigest(firstPacked);
    first.wMask.unpackedDigest = calibrationCaptureTestDigest(reboundW);
    const stageBytes = Buffer.from(wire.roles[3]!.base64, "base64");
    const pMask = unpackMask(
      stageBytes.subarray(first.pMask.offset, first.pMask.offset + first.pMask.bytes),
      first.pMask.pixelCount,
    );
    const dMask = unpackMask(
      stageBytes.subarray(first.dMask.offset, first.dMask.offset + first.dMask.bytes),
      first.dMask.pixelCount,
    );
    first.pairwisePdw[1] = pairwiseBinding("P", "W", pMask, reboundW);
    first.pairwisePdw[2] = pairwiseBinding("D", "W", dMask, reboundW);
    expect(() => preflightRealBuildSourceParityCalibrationBrowserCaptureEvidence(wire)).toThrow(
      /retained W differs from W independently re-derived from exact work RGBA and prepared crop/u,
    );
  });

  it("rejects pairwise claims and browser reconstruction bindings that bytes do not reproduce", () => {
    const wire = clone(createCalibrationCaptureTestWire()) as unknown as {
      panels: { pairwisePdw: { differingPixels: number }[] }[];
    };
    wire.panels[0]!.pairwisePdw[0]!.differingPixels += 1;
    expect(() => preflightRealBuildSourceParityCalibrationBrowserCaptureEvidence(wire)).toThrow(
      /P\/D does not equal the value independently reproduced/u,
    );

    const artifact = createArtifact();
    const attachments = copyRealBuildSourceParityCalibrationCaptureArtifact(artifact);
    const manifest = JSON.parse(new TextDecoder().decode(attachments.manifestBytes)) as Record<
      string,
      unknown
    >;
    manifest.browserCaptureDigest = calibrationCaptureTestDigest("different-browser-capture");
    expect(() =>
      parseRealBuildSourceParityCalibrationCapture(
        new TextEncoder().encode(canonicalStringify(manifest)),
        attachments.roles,
        attachments.pngs,
      ),
    ).toThrow(/reconstruct browser evidence .* manifest binds/su);
  });
});
