import { describe, expect, it } from "vitest";

import { BUILTIN_CATALOG_VERSION } from "@lego-studio/catalog";

import { sha256Digest } from "../e2e/real-build-artifacts";
import {
  applyBuilderCanonicalCalibration,
  createBuilderFrameEvidence,
  officialTransformFailure,
  parseOfficialModelIndex,
  validateOfficialModelAccounting,
  type BuilderCanonicalCalibration,
} from "../e2e/real-build-official";
import { builderCuboidGeometry } from "./real-build-frame-test-fixture";

const identityBone = "1,0,0,0,1,0,0,0,1,0,0,0";

function exactAccountingXml(): Uint8Array {
  const bricks = Array.from({ length: 1_465 }, (_, index) => {
    const design = index === 1_464 ? "31510" : "3005";
    return `<Brick uuid="b${index}"><Part designID="${design}" materials="1"><Bone transformation="${identityBone}"/></Part></Brick>`;
  });
  const instructions = Array.from({ length: 1_464 }, (_, index) => `<In brickRef="b${index}"/>`);
  const copies = Array.from(
    { length: 69 },
    (_, index) =>
      `<MultiBuildBrick originalBrickRef="b${index}" actualBrickRef="b${1_395 + index}"/>`,
  );
  return new TextEncoder().encode(
    `<Root>${bricks.join("")}${instructions.join("")}${copies.join("")}</Root>`,
  );
}

function calibrationFor(official: ReturnType<typeof parseOfficialModelIndex>): {
  readonly calibration: BuilderCanonicalCalibration;
  readonly builderGeometryBytes: Buffer;
} {
  const catalogToBuilderLocalTransform = {
    positionLdu: [0, 0, 0] as const,
    orientationId: "upright-yaw-90",
  };
  const builderGeometry = builderCuboidGeometry(
    "builtin:brick-1x1",
    catalogToBuilderLocalTransform,
  );
  const frameEvidence = createBuilderFrameEvidence({
    catalogPartId: "builtin:brick-1x1",
    catalogToBuilderLocalTransform,
    builderGeometry: builderGeometry.reference,
    builderGeometryBundleBytes: builderGeometry.bytes,
    builderGeometryBundleDigest: builderGeometry.digest,
    protocol: "builder-ldraw-surface-alignment/1",
  });
  const calibration: BuilderCanonicalCalibration = {
    schemaVersion: "lego.builder-canonical-calibration/5",
    matrixConvention: "lxf-row-major-transposed-to-canonical-column-vector",
    builderUnitsPerLdu: 0.04,
    axisMapping: ["x", "-y", "z"],
    maximumMatrixError: 0.000001,
    maximumPositionErrorLdu: 0.001,
    maximumFrameP95DistanceLdu: 2,
    builderGeometryBundleDigest: builderGeometry.digest,
    cases: [
      ["yaw-0", "upright-yaw-0"],
      ["yaw-270", "upright-yaw-270"],
      ["yaw-180", "upright-yaw-180"],
      ["yaw-90", "upright-yaw-90"],
    ].map(([brickRef, orientationId]) => ({
      brickRef: brickRef!,
      builderTransformationDigest: official.bricks[brickRef!]!.builderTransform!.sourceDigest,
      expectedTransform: { positionLdu: [0, 0, 0], orientationId: orientationId! },
    })),
    designFrames: [
      {
        designRevision: "3005;rev-a",
        catalogPartId: "builtin:brick-1x1",
        catalogVersion: BUILTIN_CATALOG_VERSION,
        catalogDefinitionDigest: frameEvidence.catalogDefinitionDigest,
        route: "verified-ldraw-fallback",
        catalogToBuilderLocalTransform,
        builderGeometry: builderGeometry.reference,
        catalogGeometryDigest: frameEvidence.catalogGeometryDigest,
        connectorFrameDigest: frameEvidence.connectorFrameDigest,
        collisionFrameDigest: frameEvidence.collisionFrameDigest,
        verification: {
          protocol: "builder-ldraw-surface-alignment/1",
          inputDigest: frameEvidence.inputDigest,
          evidenceDigest: frameEvidence.evidenceDigest,
          sampleCount: frameEvidence.sampleCount,
          builderTriangleCount: frameEvidence.builderTriangleCount,
          p95SurfaceDistanceLdu: frameEvidence.p95SurfaceDistanceLdu,
        },
      },
    ],
  };
  return { calibration, builderGeometryBytes: builderGeometry.bytes };
}

describe("official Builder model truth", () => {
  it("independently derives the exact 1395 + 69 = 1464 accounting and unmatched separator", () => {
    const official = parseOfficialModelIndex(exactAccountingXml());

    expect(validateOfficialModelAccounting(official)).toEqual([]);
    expect(official.directBrickRefs.size).toBe(1_395);
    expect(official.multiBuildByActualRef.size).toBe(69);
    expect(official.unmatchedInventoryBrickRefs).toEqual(new Set(["b1464"]));
    const duplicated = new TextDecoder()
      .decode(exactAccountingXml())
      .replace("</Root>", '<In brickRef="b0"/></Root>');
    expect(() => parseOfficialModelIndex(new TextEncoder().encode(duplicated))).toThrow(
      /repeat In brickRef b0/u,
    );
  });

  it("transposes LXF rotations, composes a per-design verified local frame, and rejects unrepresentable Bone data", () => {
    const xml = new TextEncoder().encode(
      `<Root>` +
        `<Brick uuid="yaw-0"><Part designID="3005;rev-a" materials="1"><Bone transformation="${identityBone}"/></Part></Brick>` +
        `<Brick uuid="yaw-270"><Part designID="3005;rev-a" materials="1"><Bone transformation="0,0,1,0,1,0,-1,0,0,0,0,0"/></Part></Brick>` +
        `<Brick uuid="yaw-180"><Part designID="3005;rev-a" materials="1"><Bone transformation="-1,0,0,0,1,0,0,0,-1,0,0,0"/></Part></Brick>` +
        `<Brick uuid="yaw-90"><Part designID="3005;rev-a" materials="1"><Bone transformation="0,0,-1,0,1,0,1,0,0,0,0,0"/></Part></Brick>` +
        `<Brick uuid="tilted"><Part designID="3005;rev-a" materials="1"><Bone transformation="1,0,0,0,0,-1,0,1,0,0,0,0"/></Part></Brick>` +
        `<In brickRef="yaw-0"/><In brickRef="tilted"/></Root>`,
    );
    const raw = parseOfficialModelIndex(xml);
    const { calibration, builderGeometryBytes } = calibrationFor(raw);
    const bytes = new TextEncoder().encode(JSON.stringify(calibration));
    const calibrated = applyBuilderCanonicalCalibration(
      raw,
      bytes,
      sha256Digest(bytes),
      builderGeometryBytes,
      sha256Digest(builderGeometryBytes),
    );

    expect(calibrated.bricks["yaw-0"]!.canonicalTransform).toEqual({
      positionLdu: [0, 0, 0],
      orientationId: "upright-yaw-90",
    });
    expect(calibrated.bricks.tilted!.canonicalTransform).toBeNull();
    expect(officialTransformFailure(calibrated.bricks.tilted!, 2)).toMatchObject({
      code: "official-transform-unrepresentable",
      stepNumber: 2,
    });
    expect(() =>
      applyBuilderCanonicalCalibration(
        raw,
        bytes,
        sha256Digest("different"),
        builderGeometryBytes,
        sha256Digest(builderGeometryBytes),
      ),
    ).toThrow(/bytes do not match/u);
  });

  it("rejects a stale per-design frame benchmark above the fixed p95 threshold", () => {
    const raw = parseOfficialModelIndex(
      new TextEncoder().encode(
        `<Root>` +
          `<Brick uuid="yaw-0"><Part designID="3005;rev-a" materials="1"><Bone transformation="${identityBone}"/></Part></Brick>` +
          `<Brick uuid="yaw-270"><Part designID="3005;rev-a" materials="1"><Bone transformation="0,0,1,0,1,0,-1,0,0,0,0,0"/></Part></Brick>` +
          `<Brick uuid="yaw-180"><Part designID="3005;rev-a" materials="1"><Bone transformation="-1,0,0,0,1,0,0,0,-1,0,0,0"/></Part></Brick>` +
          `<Brick uuid="yaw-90"><Part designID="3005;rev-a" materials="1"><Bone transformation="0,0,-1,0,1,0,1,0,0,0,0,0"/></Part></Brick>` +
          `<In brickRef="yaw-0"/></Root>`,
      ),
    );
    const { calibration, builderGeometryBytes } = calibrationFor(raw);
    const stale = {
      ...calibration,
      designFrames: [
        {
          ...calibration.designFrames[0]!,
          verification: {
            ...calibration.designFrames[0]!.verification,
            p95SurfaceDistanceLdu: 20.97,
          },
        },
      ],
    };
    const bytes = new TextEncoder().encode(JSON.stringify(stale));

    expect(() =>
      applyBuilderCanonicalCalibration(
        raw,
        bytes,
        sha256Digest(bytes),
        builderGeometryBytes,
        sha256Digest(builderGeometryBytes),
      ),
    ).toThrow(/above the fixed 2 LDU p95 limit/u);
    const frame = calibration.designFrames[0]!;
    const fabricated = {
      ...calibration,
      designFrames: [
        {
          ...frame,
          builderGeometry: {
            ...frame.builderGeometry,
            bytesBase64: builderGeometryBytes.toString("base64"),
          },
        },
      ],
    };
    const fabricatedBytes = new TextEncoder().encode(JSON.stringify(fabricated));
    expect(() =>
      applyBuilderCanonicalCalibration(
        raw,
        fabricatedBytes,
        sha256Digest(fabricatedBytes),
        builderGeometryBytes,
        sha256Digest(builderGeometryBytes),
      ),
    ).toThrow(/duplicate, malformed, stale/u);
  });
});
