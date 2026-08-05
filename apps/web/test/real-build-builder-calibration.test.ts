import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { sha256Digest } from "../e2e/real-build-artifacts";
import {
  applyBuilderCanonicalCalibration,
  createBuilderCanonicalCalibration,
  createBuilderFrameEvidence,
  parseOfficialModelIndex,
  type OfficialModelIndex,
} from "../e2e/real-build-official";
import {
  BUILDER_STEP1_DESIGN_SOURCES,
  BUILDER_STEP1_OFFICIAL_MODEL_DIGEST,
  type BuilderDesignSourcePin,
  type BuilderFramePoint,
} from "../e2e/real-build-builder-sources";

type Point = BuilderFramePoint;
type Triangle = readonly [Point, Point, Point];

const officialModelPath = resolve(process.cwd(), "output/official-model/vx1087034_21066_a.xml");
const geometryBundlePath = resolve(process.cwd(), "output/real-build/builder-shell-geometry.bin");
const calibrationPath = resolve(
  process.cwd(),
  "output/real-build/builder-canonical-calibration.json",
);
const hasRetainedCalibration = [officialModelPath, geometryBundlePath, calibrationPath].every(
  existsSync,
);

const typedDigest = (value: string | Uint8Array): `sha256:${string}` =>
  sha256Digest(value) as `sha256:${string}`;

function encodeTriangles(triangles: readonly Triangle[], builderFrame: boolean): Buffer {
  const bytes = Buffer.alloc(triangles.length * 36);
  let offset = 0;
  for (const triangle of triangles) {
    for (const point of triangle) {
      const encoded = builderFrame
        ? [(point[0] + 30) * 0.04, -(point[1] - 4) * 0.04, (point[2] - 30) * 0.04]
        : point;
      for (const coordinate of encoded) {
        bytes.writeFloatLE(coordinate, offset);
        offset += 4;
      }
    }
  }
  return bytes;
}

/** Project-authored disjoint triangles keep each surface-distance assertion unambiguous. */
function sourceNativeFixture(outlierLdu = 0): {
  readonly source: BuilderDesignSourcePin;
  readonly bytes: Buffer;
  readonly digest: `sha256:${string}`;
} {
  const referenceTriangles = Array.from({ length: 7 }, (_, index) => {
    const x = index * 100;
    return [
      [x, 0, 0],
      [x + 5, 0, 0],
      [x, 0, 5],
    ] as Triangle;
  });
  const builderTriangles = referenceTriangles.map((triangle, triangleIndex) =>
    triangle.map((point, pointIndex) =>
      triangleIndex === 0 && pointIndex === 0
        ? ([point[0], point[1] + outlierLdu, point[2]] as Point)
        : point,
    ),
  ) as unknown as Triangle[];
  const builderBytes = encodeTriangles(builderTriangles, true);
  const ldrawBytes = encodeTriangles(referenceTriangles, false);
  const bytes = Buffer.concat([builderBytes, ldrawBytes]);
  const base = BUILDER_STEP1_DESIGN_SOURCES[0];
  const source: BuilderDesignSourcePin = {
    ...base,
    designRevision: "project-authored-disjoint-surface;1",
    sourceIdentity: {
      ...base.sourceIdentity,
      bundleSha256: typedDigest("project-authored-builder-frame-fixture"),
      manifestMd5: "md5:00000000000000000000000000000000",
      primitiveXmlSha256: typedDigest("project-authored-type-23-centers"),
      shellPathId: "project-authored-disjoint-surface",
      shellCanonicalSha256: typedDigest(builderBytes),
      shellVertexCount: 21,
      shellTriangleCount: 7,
      ldrawOfficialArchiveSha256: typedDigest("project-authored-ldraw-reference"),
      ldrawUnofficialArchiveSha256: typedDigest("project-authored-no-unofficial-input"),
    },
    builderGeometry: {
      format: "lego.builder-shell-triangles-f32le/1",
      byteOffset: 0,
      byteLength: builderBytes.length,
      digest: typedDigest(builderBytes),
      triangleCount: 7,
    },
    ldrawReferenceGeometry: {
      format: "lego.ldraw-expanded-triangles-f32le/1",
      byteOffset: builderBytes.length,
      byteLength: ldrawBytes.length,
      digest: typedDigest(ldrawBytes),
      triangleCount: 7,
    },
    ldrawToCatalogLocalTransform: {
      positionLdu: [0, 0, 0],
      orientationId: "upright-yaw-0",
    },
    uniqueBuilderVertexCount: 21,
  };
  return { source, bytes, digest: typedDigest(bytes) };
}

const sortedCentersDigest = (centers: readonly Point[]): `sha256:${string}` =>
  typedDigest(
    JSON.stringify(
      [...centers].sort(
        (left, right) => left[0] - right[0] || left[1] - right[1] || left[2] - right[2],
      ),
    ),
  );

describe("Builder canonical calibration v6", () => {
  it("derives an asymmetric type-23 frame before corroborating source-native surfaces", () => {
    const fixture = sourceNativeFixture();
    const evidence = createBuilderFrameEvidence({
      source: fixture.source,
      builderGeometryBundleBytes: fixture.bytes,
      builderGeometryBundleDigest: fixture.digest,
    });

    expect(evidence.catalogToBuilderLocalTransform).toEqual({
      positionLdu: [30, -4, -30],
      orientationId: "upright-yaw-0",
    });
    expect(evidence).toMatchObject({
      uniqueBuilderVertexCount: 21,
      builderTriangleCount: 7,
      ldrawTriangleCount: 7,
    });
    expect(evidence.p95SurfaceDistanceMicroLdu).toBeLessThan(1_000);
    expect(evidence.maximumSurfaceDistanceMicroLdu).toBeLessThan(1_000);
  });

  it("rejects a changed pinned slice even when its outer bundle digest is recomputed", () => {
    const fixture = sourceNativeFixture();
    const changed = Buffer.from(fixture.bytes);
    changed[0] = changed[0]! ^ 1;

    expect(() =>
      createBuilderFrameEvidence({
        source: fixture.source,
        builderGeometryBundleBytes: changed,
        builderGeometryBundleDigest: typedDigest(changed),
      }),
    ).toThrow(/tandem-rehashed calibration metadata cannot replace reviewed source pins/u);
  });

  it("rejects caller-rehashed geometry at the production bundle pin without retained output", () => {
    const fixture = sourceNativeFixture();
    const official = { digest: BUILDER_STEP1_OFFICIAL_MODEL_DIGEST } as OfficialModelIndex;

    expect(() =>
      createBuilderCanonicalCalibration(official, fixture.bytes, fixture.digest),
    ).toThrow(/exact .* reviewed geometry bundle/u);
  });

  it("rejects connector-center tampering before geometry can choose a registration", () => {
    const fixture = sourceNativeFixture();
    const changedCenters = fixture.source.builderStudCentersLdu.map((point, index) =>
      index === 0 ? ([point[0] + 1, point[1], point[2]] as Point) : point,
    );
    const source: BuilderDesignSourcePin = {
      ...fixture.source,
      builderStudCentersLdu: changedCenters,
      builderStudCentersDigest: sortedCentersDigest(changedCenters),
    };

    expect(() =>
      createBuilderFrameEvidence({
        source,
        builderGeometryBundleBytes: fixture.bytes,
        builderGeometryBundleDigest: fixture.digest,
      }),
    ).toThrow(/exactly one is required so geometry cannot choose its own registration/u);
  });

  it("rejects one 3-LDU outlier even when the other 20 vertices keep p95 within tolerance", () => {
    const fixture = sourceNativeFixture(3);

    expect(() =>
      createBuilderFrameEvidence({
        source: fixture.source,
        builderGeometryBundleBytes: fixture.bytes,
        builderGeometryBundleDigest: fixture.digest,
      }),
    ).toThrow(/p95=.*max=3 LDU; both must be at most 2 LDU/u);
  });

  it.skipIf(!hasRetainedCalibration)(
    "recomputes the retained v6 report and derives the exact step-1 canonical origin",
    () => {
      const officialBytes = readFileSync(officialModelPath);
      const geometryBytes = readFileSync(geometryBundlePath);
      const calibrationBytes = readFileSync(calibrationPath);
      const official = parseOfficialModelIndex(officialBytes);
      const geometryDigest = sha256Digest(geometryBytes);
      const calibrationDigest = sha256Digest(calibrationBytes);

      expect(geometryDigest).toBe(
        "sha256:4c03dc3f534e7eab78da7e9c61bf3a539de064a01aa829b18023ac86340f8450",
      );
      expect(calibrationDigest).toBe(
        "sha256:78bcdc88850a40e5763e251ec90f2815a6926c8aa3b59a9988de561488e0fdb1",
      );
      const report = createBuilderCanonicalCalibration(official, geometryBytes, geometryDigest);
      expect(JSON.parse(calibrationBytes.toString("utf8"))).toEqual(report);
      expect(
        report.designFrames.map(
          ({ designRevision, catalogToBuilderLocalTransform, verification }) => ({
            designRevision,
            catalogToBuilderLocalTransform,
            uniqueBuilderVertexCount: verification.uniqueBuilderVertexCount,
            builderTriangleCount: verification.builderTriangleCount,
            ldrawTriangleCount: verification.ldrawTriangleCount,
            p95SurfaceDistanceMicroLdu: verification.p95SurfaceDistanceMicroLdu,
            maximumSurfaceDistanceMicroLdu: verification.maximumSurfaceDistanceMicroLdu,
          }),
        ),
      ).toEqual([
        {
          designRevision: "30565;E",
          catalogToBuilderLocalTransform: {
            positionLdu: [30, -4, -30],
            orientationId: "upright-yaw-0",
          },
          uniqueBuilderVertexCount: 127,
          builderTriangleCount: 236,
          ldrawTriangleCount: 1_368,
          p95SurfaceDistanceMicroLdu: 1_299_038,
          maximumSurfaceDistanceMicroLdu: 1_316_400,
        },
        {
          designRevision: "80015;E",
          catalogToBuilderLocalTransform: {
            positionLdu: [-70, -4, 10],
            orientationId: "upright-yaw-270",
          },
          uniqueBuilderVertexCount: 430,
          builderTriangleCount: 804,
          ldrawTriangleCount: 1_000,
          p95SurfaceDistanceMicroLdu: 1_251_371,
          maximumSurfaceDistanceMicroLdu: 1_589_701,
        },
      ]);

      const calibrated = applyBuilderCanonicalCalibration(
        official,
        calibrationBytes,
        calibrationDigest,
        geometryBytes,
        geometryDigest,
      );
      expect(calibrated.bricks["76092bf0-3d72-474a-baf3-06b837082f6a"]).toMatchObject({
        designRevision: "80015;E",
        calibratedCatalogPartId: "builtin:corner-plate-5x5-quarter-ring",
        canonicalTransform: { positionLdu: [0, 8, 0], orientationId: "upright-yaw-180" },
        canonicalTransformFailure: null,
      });
      expect(calibrated.bricks["21288f64-b9d5-4efb-92b9-427a17832a45"]).toMatchObject({
        designRevision: "30565;E",
        calibratedCatalogPartId: "builtin:corner-plate-4x4-round",
        canonicalTransform: { positionLdu: [60, 0, -20], orientationId: "upright-yaw-0" },
        canonicalTransformFailure: null,
      });

      const changedGeometry = Buffer.from(geometryBytes);
      changedGeometry[0] = changedGeometry[0]! ^ 1;
      expect(() =>
        createBuilderCanonicalCalibration(official, changedGeometry, sha256Digest(changedGeometry)),
      ).toThrow(/exact .* reviewed geometry bundle/u);

      const extraField = Buffer.from(JSON.stringify({ ...report, artifactAuthoredPin: true }));
      expect(() =>
        applyBuilderCanonicalCalibration(
          official,
          extraField,
          sha256Digest(extraField),
          geometryBytes,
          geometryDigest,
        ),
      ).toThrow(
        /artifact-authored sources, frames, cases, metrics, or extra fields are forbidden/u,
      );
    },
  );
});
