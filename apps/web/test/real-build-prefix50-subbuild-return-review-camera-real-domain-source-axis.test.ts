import { existsSync, readFileSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";

import { beforeAll, describe, expect, it } from "vitest";

import { loadCurrentPrefix50Step42SourceGeometryFixture } from "../../../scripts/part-identification-prefix50-verified-projection-step42-source-geometry-test-support.mjs";

import {
  deriveRealBuildPrefix50Step42SourceAxisDiagnostic,
  requireRealBuildPrefix50Step42SignedSourceAxis,
} from "../e2e/real-build-prefix50-subbuild-return-review-camera-real-domain-source-axis";
import { REAL_BUILD_PREFIX50_STEP44_REAL_DOMAIN_SOURCE_SPEC } from "../e2e/real-build-prefix50-subbuild-return-review-camera-real-domain-source-spec";
import { rerenderRealBuildPrefix50Step42SourceCrop } from "../e2e/real-build-prefix50-subbuild-return-review-camera-real-domain-step42-raster";
import {
  admitRealBuildPrefix50Step42SourceGeometry,
  type RealBuildPrefix50Step42SourceGeometryAdmission,
} from "../e2e/real-build-prefix50-subbuild-return-review-camera-real-domain-step42-admission";
import {
  deriveRealBuildPrefix50Step42VectorSourceEvidence,
  verifyRealBuildPrefix50Step44Page44VectorSource,
} from "../e2e/real-build-prefix50-subbuild-return-review-camera-real-domain-source-vector";

const REPOSITORY_ROOT = resolve(process.cwd());
let sourceGeometryAdmission: RealBuildPrefix50Step42SourceGeometryAdmission;

beforeAll(async () => {
  const fixture = await loadCurrentPrefix50Step42SourceGeometryFixture();
  sourceGeometryAdmission = admitRealBuildPrefix50Step42SourceGeometry(fixture.reader);
}, 180_000);

function sourceCrop(): Uint8Array {
  return rerenderRealBuildPrefix50Step42SourceCrop({
    repositoryRoot: REPOSITORY_ROOT,
    sourcePdfArtifactPath: REAL_BUILD_PREFIX50_STEP44_REAL_DOMAIN_SOURCE_SPEC.sourcePdfArtifactPath,
  }).rgba;
}

describe("prefix-50 Step-42 source-only signed-axis boundary", () => {
  it("reproduces four dark cores, exact source-geometry 6636/3710/3069 order, and refuses +Y", () => {
    const diagnostic = deriveRealBuildPrefix50Step42SourceAxisDiagnostic({
      panelStep: 42,
      rgba: sourceCrop(),
      sourceGeometryAdmission,
    });
    expect(diagnostic).toMatchObject({
      authority: "none",
      selectionAuthority: false,
      status: "signed-y-refused",
      sourceCropPixelDigest:
        "sha256:d99e7b1cc959810d9f4d32dfa5eb2d28e2edeeb6ae600e962e15011070fbab1d",
      measuredPlusDocumentY: null,
      fullRankCameraSeedCommitment: null,
      directVerticalCorrespondences: [],
      native: {
        darkComponentCount: 34,
        qualifiedStudCores: [
          { pixels: 86, bounds: { minX: 344, minY: 230, maxX: 365, maxY: 237 } },
          { pixels: 88, bounds: { minX: 377, minY: 243, maxX: 398, maxY: 250 } },
          { pixels: 98, bounds: { minX: 411, minY: 257, maxX: 432, maxY: 264 } },
          { pixels: 94, bounds: { minX: 444, minY: 270, maxX: 466, maxY: 278 } },
        ],
        yellow: {
          pixels: 3223,
          bounds: { minX: 128, minY: 134, maxX: 554, maxY: 330 },
          imageLengthRoster: [6, 4, 2],
        },
        sourceRows: [
          { occurrenceOrdinal: 274, officialDesignId: "6636", documentX: 400, threeX: 20 },
          { occurrenceOrdinal: 276, officialDesignId: "3710", documentX: 300, threeX: 15 },
          { occurrenceOrdinal: 275, officialDesignId: "3069", documentX: 240, threeX: 12 },
        ],
        sourceImageRightDocumentUnitAxis: [-1, 0, 0],
        sourceImageRightThreeUnitAxis: [-1, 0, 0],
      },
      controls: {
        verticalMirror: { status: "unsigned-pass" },
        horizontalMirror: { status: "unsigned-refused" },
        combinedMirror: { status: "unsigned-refused" },
        erasedLowerWall: { status: "signed-y-refused" },
        ambiguityRefusal: { status: "signed-y-refused" },
      },
    });
    expect(diagnostic.commitment).toMatch(/^sha256:[0-9a-f]{64}$/u);
    expect(() => requireRealBuildPrefix50Step42SignedSourceAxis(diagnostic)).toThrow(
      "Step-42 signed +Y source-axis receipt refused",
    );
  });

  it("refuses Step 41 and any pixel mutation before geometry can select a branch", () => {
    const rgba = sourceCrop();
    expect(() =>
      deriveRealBuildPrefix50Step42SourceAxisDiagnostic({
        panelStep: 41,
        rgba,
        sourceGeometryAdmission,
      }),
    ).toThrow("Step 41 is an unsigned control");
    const mutated = new Uint8Array(rgba);
    mutated[0] = mutated[0]! ^ 1;
    expect(() =>
      deriveRealBuildPrefix50Step42SourceAxisDiagnostic({
        panelStep: 42,
        rgba: mutated,
        sourceGeometryAdmission,
      }),
    ).toThrow("not the exact pinned native crop");
    expect(() =>
      deriveRealBuildPrefix50Step42SourceAxisDiagnostic({
        panelStep: 42,
        rgba,
        sourceGeometryAdmission: {} as RealBuildPrefix50Step42SourceGeometryAdmission,
      }),
    ).toThrow("process-local opaque admission");
  });

  it("caps exact vector face evidence at Step 42 and refuses branch publication", async () => {
    const bytes = readFileSync(
      resolve(
        REPOSITORY_ROOT,
        REAL_BUILD_PREFIX50_STEP44_REAL_DOMAIN_SOURCE_SPEC.sourcePdfArtifactPath,
      ),
    );
    const evidence = await deriveRealBuildPrefix50Step42VectorSourceEvidence(
      REPOSITORY_ROOT,
      bytes,
      sourceGeometryAdmission,
    );
    expect(evidence).toMatchObject({
      selectionAuthority: false,
      vectorInputsCommitment:
        REAL_BUILD_PREFIX50_STEP44_REAL_DOMAIN_SOURCE_SPEC.faceEvidence.vectorInputsCommitment,
      faceRowsCommitment:
        REAL_BUILD_PREFIX50_STEP44_REAL_DOMAIN_SOURCE_SPEC.faceEvidence.rowsCommitment,
      terminalFace: "studs-up",
      sourceAxisDiagnostic: { status: "signed-y-refused" },
    });
    await expect(
      verifyRealBuildPrefix50Step44Page44VectorSource(
        REPOSITORY_ROOT,
        bytes,
        sourceGeometryAdmission,
      ),
    ).rejects.toThrow("Step-42 signed +Y source-axis receipt refused");
  }, 120_000);

  it("keeps the Step-42 source proof import closure free of later-source and search dependencies", () => {
    const roots = [
      "real-build-prefix50-subbuild-return-review-camera-real-domain-source-axis.ts",
      "real-build-prefix50-subbuild-return-review-camera-real-domain-source-branches.ts",
      "real-build-prefix50-subbuild-return-review-camera-real-domain-source-spec.ts",
      "real-build-prefix50-subbuild-return-review-camera-real-domain-source-vector.ts",
      "real-build-prefix50-subbuild-return-review-camera-real-domain-step42-binding.ts",
      "real-build-prefix50-subbuild-return-review-camera-real-domain-step42-raster.ts",
    ].map((file) => resolve(REPOSITORY_ROOT, "apps/web/e2e", file));
    const forbidden =
      /(?:step[-_]?43|page[-_]?45|repair|candidate[^/\\]*score|verified-projection[^/\\]*test-support|(?:^|[/\\])(?:part-identification-prefix50-verified-projection|real-build-prefix50-projection)(?:\.(?:mjs|ts))?$)/iu;
    const pending = [...roots];
    const visited = new Set<string>();
    while (pending.length > 0) {
      const file = pending.pop()!;
      if (visited.has(file)) continue;
      visited.add(file);
      expect(forbidden.test(basename(file)), `forbidden source-proof dependency ${file}`).toBe(
        false,
      );
      const text = readFileSync(file, "utf8");
      const imports = [...text.matchAll(/(?:from\s+|import\s*\()\s*["']([^"']+)["']/gu)].map(
        (match) => match[1]!,
      );
      for (const specifier of imports) {
        expect(forbidden.test(specifier), `forbidden source-proof import ${specifier}`).toBe(false);
        if (!specifier.startsWith(".")) continue;
        const direct = resolve(dirname(file), specifier);
        const imported = [direct, `${direct}.ts`, direct.replace(/\.js$/u, ".ts")].find(existsSync);
        if (imported === undefined)
          throw new TypeError(
            `Focused source-proof closure cannot resolve ${specifier} from ${file}.`,
          );
        pending.push(imported);
      }
    }
    expect(roots.every((root) => visited.has(root))).toBe(true);
  });
});
