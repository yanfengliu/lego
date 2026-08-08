import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { BUILTIN_CATALOG_VERSION } from "@lego-studio/catalog";
import { createPartInstance } from "@lego-studio/brick-kernel";
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
  BUILDER_STEP1_GEOMETRY_BUNDLE,
  BUILDER_STEP1_OFFICIAL_MODEL_DIGEST,
  type BuilderDesignSourcePin,
  type BuilderFramePoint,
} from "../e2e/real-build-builder-sources";
import { assessSupport, findBodyOverlaps, findStudConnections } from "../src/placement";

type Point = BuilderFramePoint;
type Triangle = readonly [Point, Point, Point];

const officialModelPath = resolve(process.cwd(), "output/official-model/vx1087034_21066_a.xml");
const geometryBundlePath = resolve(process.cwd(), "output/real-build/builder-shell-geometry.bin");
const calibrationPath = resolve(
  process.cwd(),
  "output/real-build/builder-canonical-calibration.json",
);
/**
 * The retained calibration report is a claim about the exact catalog it was
 * taken from: it embeds that catalog's version and every design's definition
 * digests, and `applyBuilderCanonicalCalibration` refuses an artifact that does
 * not reproduce the code-derived report byte for byte. Every part definition
 * carries the catalog version in its provenance, so every catalog bump makes the
 * retained report stale — twice now it has gone stale unnoticed and surfaced as
 * a real build rejecting with `builder-calibration-invalid`.
 *
 * A missing report is not a failure: a fresh checkout has no local Builder
 * evidence and there is nothing to cross-check, so the retained case skips. A
 * report that is present and pinned to a superseded version is a different
 * thing — somebody kept it, and it now claims agreement with a catalog that no
 * longer exists. That is failed here by name rather than announced in a warning
 * nobody reads while the case quietly stops running.
 */
function retainedCalibrationCatalogVersions(): readonly string[] {
  if (!existsSync(calibrationPath)) return [];
  const retained = JSON.parse(readFileSync(calibrationPath, "utf8")) as {
    readonly designFrames?: readonly { readonly catalogVersion?: string }[];
  };
  return [
    ...new Set((retained.designFrames ?? []).map(({ catalogVersion }) => catalogVersion ?? "")),
  ];
}

const retainedCalibrationVersions = retainedCalibrationCatalogVersions();
const retainedCalibrationIsCurrent =
  retainedCalibrationVersions.length > 0 &&
  retainedCalibrationVersions.every((version) => version === BUILTIN_CATALOG_VERSION);
const hasRetainedCalibration =
  [officialModelPath, geometryBundlePath, calibrationPath].every(existsSync) &&
  retainedCalibrationIsCurrent;
const IN_STEP = "absent, or pinned to the current catalog version";

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

describe("Builder canonical calibration v8", () => {
  it("keeps a retained calibration report in step with the catalog it claims", () => {
    // The compared value is the whole remedy, so a failure prints what is wrong
    // and what to run rather than two digests that mean nothing on their own.
    const state =
      retainedCalibrationVersions.length === 0 || retainedCalibrationIsCurrent
        ? IN_STEP
        : `Retained output/real-build/builder-canonical-calibration.json is pinned to catalog ` +
          `${retainedCalibrationVersions.join(", ")} and this build is ${BUILTIN_CATALOG_VERSION}. ` +
          `Every part definition carries the catalog version in its provenance, so a bump ` +
          `invalidates the report and the real build then rejects with builder-calibration-invalid. ` +
          `Regenerate it with \`LEGO_REAL_BUILD_REGENERATE_INPUTS=1 npx playwright test ` +
          `apps/web/e2e/real-build-inputs.spec.ts\`, or delete it if this checkout is not meant to ` +
          `hold local Builder evidence. Do not edit the artifact into agreement.`;

    expect(state).toBe(IN_STEP);
  });

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
    ).toThrow(/yield no upright local frame at all/u);
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
    "recomputes the retained v8 report and derives the exact step-1 canonical origin",
    () => {
      const officialBytes = readFileSync(officialModelPath);
      const geometryBytes = readFileSync(geometryBundlePath);
      const calibrationBytes = readFileSync(calibrationPath);
      const official = parseOfficialModelIndex(officialBytes);
      const geometryDigest = sha256Digest(geometryBytes);
      const calibrationDigest = sha256Digest(calibrationBytes);

      // The geometry bundle is reviewed source and does not move with the
      // catalog, so its digest is pinned as a literal.
      expect(geometryDigest).toBe(BUILDER_STEP1_GEOMETRY_BUNDLE.digest);
      // The calibration report is not: `applyBuilderCanonicalCalibration` below
      // recomputes it from the live code and catalog and requires the retained
      // bytes to equal it exactly, and every part definition it embeds carries
      // BUILTIN_CATALOG_VERSION. So its digest necessarily moves on every
      // catalog bump, and a literal here was the previous run's output carried
      // forward by hand — the shape that silently stops checking anything the
      // day somebody updates it without looking. It was
      // sha256:78bcdc88850a40e5763e251ec90f2815a6926c8aa3b59a9988de561488e0fdb1
      // at builtin.basic-parts/7. What is worth asserting is that the digest
      // gate fires, which is checked directly rather than pinned.
      expect(calibrationDigest).toMatch(/^sha256:[0-9a-f]{64}$/u);
      expect(() =>
        applyBuilderCanonicalCalibration(
          official,
          calibrationBytes,
          `sha256:${"0".repeat(64)}`,
          geometryBytes,
          geometryDigest,
        ),
      ).toThrow(/do not match their declared digest/u);

      const report = createBuilderCanonicalCalibration(official, geometryBytes, geometryDigest);
      expect(JSON.parse(calibrationBytes.toString("utf8"))).toEqual(report);
      // Every frame, with the reason it is the frame and the margin it won by.
      // A reverted quotient shows up as a design that suddenly refuses; a
      // reverted witness shows up as a design whose method or margin moved.
      expect(
        report.designFrames.map(
          ({ designRevision, catalogPartId, catalogToBuilderLocalTransform, verification }) =>
            [
              designRevision,
              catalogPartId,
              catalogToBuilderLocalTransform.orientationId,
              catalogToBuilderLocalTransform.positionLdu.join("/"),
              verification.frameCandidateCount,
              verification.frameEquivalenceClassCount,
              verification.frameSelection,
              String(verification.frameWitnessMarginMicroRatio),
              verification.maximumSurfaceDistanceMicroLdu,
            ].join(" "),
        ),
      ).toEqual([
        "30565;E builtin:corner-plate-4x4-round upright-yaw-0 30/-4/-30 1 1 unique-stud-correspondence null 1316400",
        "80015;E builtin:corner-plate-5x5-quarter-ring upright-yaw-270 -70/-4/10 1 1 unique-stud-correspondence null 1589701",
        // 3020;L continues the 2xN family exactly: every one reads
        // [(N-1)*10, -4, 10] at yaw-90, and 3020 at N=4 reads 30/-4/10. That
        // was derived from its own type-23 field, not copied from the others.
        "3020;L builtin:plate-2x4 upright-yaw-90 30/-4/10 2 1 catalog-part-self-symmetry null 1305568",
        "3032;F builtin:plate-4x6 upright-yaw-90 50/-4/30 2 1 catalog-part-self-symmetry null 1299039",
        "3034;J builtin:plate-2x8 upright-yaw-90 70/-4/10 2 1 catalog-part-self-symmetry null 1299038",
        "3460;N builtin:plate-1x8 upright-yaw-90 70/-4/0 2 1 catalog-part-self-symmetry null 1299038",
        "3795;I builtin:plate-2x6 upright-yaw-90 50/-4/10 2 1 catalog-part-self-symmetry null 1299038",
        "3832;G builtin:plate-2x10 upright-yaw-90 90/-4/10 2 1 catalog-part-self-symmetry null 1299039",
        "6106;D builtin:wedge-plate-6x6-cut-corner upright-yaw-0 50/-4/-50 1 1 unique-stud-correspondence null 1375628",
        "30503;F builtin:wedge-plate-4x4-cut-corner upright-yaw-0 30/-4/-30 1 1 unique-stud-correspondence null 1299038",
        "41539;F builtin:plate-8x8 upright-yaw-0 70/-4/70 4 1 catalog-part-self-symmetry null 1299042",
        "51739;H builtin:wedge-plate-2x4-wing upright-yaw-270 30/-4/-10 4 4 ldraw-surface-witness 27425140 1060658",
        "54383;F builtin:wedge-plate-3x6-right upright-yaw-90 50/-4/20 1 1 unique-stud-correspondence null 1299038",
        "60479;F builtin:plate-1x12 upright-yaw-90 110/-4/0 2 1 catalog-part-self-symmetry null 1299038",
        "91988;F builtin:plate-2x14 upright-yaw-90 130/-4/10 2 1 catalog-part-self-symmetry null 1299039",
      ]);
      // Every Builder Shell vertex of every design is inside the 2 LDU the
      // independent LDraw surface has to corroborate it within.
      for (const frame of report.designFrames) {
        expect(frame.verification.maximumSurfaceDistanceMicroLdu).toBeLessThanOrEqual(2_000_000);
      }

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
        canonicalTransform: { positionLdu: [0, 8, 0], orientationId: "upright-yaw-0" },
        canonicalTransformFailure: null,
      });
      expect(calibrated.bricks["21288f64-b9d5-4efb-92b9-427a17832a45"]).toMatchObject({
        designRevision: "30565;E",
        calibratedCatalogPartId: "builtin:corner-plate-4x4-round",
        canonicalTransform: { positionLdu: [40, 0, -40], orientationId: "upright-yaw-0" },
        canonicalTransformFailure: null,
      });
      // The step-1 target has to be a thing two real bricks can be, and that is
      // the check the per-design surface evidence above cannot make: it scores
      // each part against its own LDraw surface, which a mirror leaves
      // untouched. Here the two parts are scored against *each other* by the
      // editor's own support rule. Under the mirrored reading these were
      // [0,8,0] yaw-180 and [60,0,-20] yaw-0, which derive no connection at all
      // and leave the 4x4 round resting 8 LDU above the plate with nothing
      // under it.
      const step1 = [
        calibrated.bricks["76092bf0-3d72-474a-baf3-06b837082f6a"]!,
        calibrated.bricks["21288f64-b9d5-4efb-92b9-427a17832a45"]!,
      ].map((brick, index) =>
        createPartInstance({
          id: `step1-${index}`,
          catalogPartId: brick.calibratedCatalogPartId!,
          colorId: "builtin:light-bluish-gray",
          transform: brick.canonicalTransform!,
        }),
      );
      expect(
        step1.map((candidate) => {
          const others = step1.filter(({ id }) => id !== candidate.id);
          const connections = findStudConnections(candidate, others);
          const support = assessSupport(candidate, connections);
          return (
            `${candidate.catalogPartId} ${candidate.transform.positionLdu.join("/")} ` +
            `${candidate.transform.orientationId} connections=${connections.length} ` +
            `${support.supported ? `held-by-${support.held}` : `REFUSED: ${support.reason}`} ` +
            `overlaps=${findBodyOverlaps(candidate, others).length}`
          );
        }),
      ).toEqual([
        "builtin:corner-plate-5x5-quarter-ring 0/8/0 upright-yaw-0 connections=3 held-by-connections overlaps=0",
        "builtin:corner-plate-4x4-round 40/0/-40 upright-yaw-0 connections=3 held-by-connections overlaps=0",
      ]);

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
