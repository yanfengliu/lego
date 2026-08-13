import { createHash } from "node:crypto";
import { deflateSync } from "node:zlib";

import { packRealBuildCompiledBinaryMaskMsb } from "./real-build-compiled-observation-registration";
import {
  createRealBuildBootstrapSourceManifest,
  REAL_BUILD_BOOTSTRAP_LOCK_SCHEMA,
  REAL_BUILD_SOURCE_ROOT_POLICY_PATH,
} from "./real-build-bootstrap-source";
import { realBuildSourceParityBrowserResultEvidence } from "./real-build-observation-source-parity-browser-result";
import {
  REAL_BUILD_SOURCE_PARITY_EXPECTED_STEPS,
  realBuildSourceParityPreparedPanelsManifest,
} from "./real-build-observation-source-parity-contract";
import {
  REAL_BUILD_SOURCE_PARITY_CLASSES,
  type RealBuildSourceParityAggregate,
  type RealBuildSourceParityBrowserResult,
  type RealBuildSourceParityMaskComparison,
  type RealBuildSourceParityProbePanel,
  type RealBuildSourceParityProbeResult,
  type RealBuildSourceParityProvenanceRole,
} from "./real-build-observation-source-parity-types";
import { stepPanelEvidenceDigest } from "./real-build-ledger";
import {
  REAL_BUILD_SERVED_RESPONSE_RUNNER_BODY,
  REAL_BUILD_SERVED_RESPONSE_RUNNER_HEADERS,
  REAL_BUILD_SERVED_RESPONSE_RUNNER_PATH,
  REAL_BUILD_SERVED_RESPONSE_RUNNER_STATUS,
  REAL_BUILD_SERVED_RESPONSE_SCHEMA,
  servedResponseChunkName,
  servedResponseRequestKey,
  strictServedResponseHeaders,
} from "./real-build-served-response-policy";
import {
  REAL_BUILD_SOURCE_PARITY_SOURCE_BUNDLE_MANIFEST_ROLE,
  REAL_BUILD_SOURCE_PARITY_SOURCE_BUNDLE_ROLE,
  REAL_BUILD_SOURCE_PARITY_SOURCE_BUNDLE_SCHEMA,
} from "./real-build-observation-source-parity-source-bundle";

export const sourceParityTestDigest = (value: Uint8Array | string): string =>
  `sha256:${createHash("sha256").update(value).digest("hex")}`;

const crc32 = (bytes: Uint8Array): number => {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc & 1) === 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
};

const chunk = (type: string, data: Uint8Array): Buffer => {
  const result = Buffer.alloc(12 + data.length);
  result.writeUInt32BE(data.length, 0);
  Buffer.from(type, "ascii").copy(result, 4);
  Buffer.from(data).copy(result, 8);
  result.writeUInt32BE(crc32(result.subarray(4, 8 + data.length)), 8 + data.length);
  return result;
};

function diagnosticPng(): Buffer {
  const width = 512;
  const height = 1;
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const row = y * (width * 4 + 1);
    raw[row] = 0;
    for (let x = 0; x < width; x += 1) {
      const pixel = row + 1 + x * 4;
      const column = Math.floor(x / 128);
      const on = y === 0 && x % 128 === 0 && (column === 1 || column === 3);
      const rgba =
        column === 0
          ? [80, 90, 100, 255]
          : on
            ? column === 3
              ? [224, 0, 126, 255]
              : [14, 34, 44, 255]
            : [255, 255, 255, 255];
      rgba.forEach((value, offset) => {
        raw[pixel + offset] = value;
      });
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

export const SOURCE_PARITY_TEST_PNG = diagnosticPng();
const dataUrl = `data:image/png;base64,${SOURCE_PARITY_TEST_PNG.toString("base64")}`;
const WIDTH = 500;
const HEIGHT = 1;
const PIXELS = WIDTH * HEIGHT;
const zero = new Uint8Array(PIXELS);
const one = new Uint8Array(PIXELS);
one[0] = 1;
const packedZero = packRealBuildCompiledBinaryMaskMsb(zero, WIDTH, HEIGHT);
const packedOne = packRealBuildCompiledBinaryMaskMsb(one, WIDTH, HEIGHT);
const zeroDigest = sourceParityTestDigest(zero);
const oneDigest = sourceParityTestDigest(one);
const packedZeroDigest = sourceParityTestDigest(packedZero);
const packedOneDigest = sourceParityTestDigest(packedOne);
const fixturePdfDigest = sourceParityTestDigest("pdf");
const sourceRootsPolicyDigest = sourceParityTestDigest("roots");
const bootstrapManifest = createRealBuildBootstrapSourceManifest({
  files: [{ path: REAL_BUILD_SOURCE_ROOT_POLICY_PATH, digest: sourceRootsPolicyDigest, bytes: 1 }],
  sourceRootsPolicyDigest,
});
const bootstrapManifestBytes = Buffer.from(`${JSON.stringify(bootstrapManifest)}\n`);
const bootstrapLockManifestBytes = Buffer.from(
  `${JSON.stringify({
    schemaVersion: REAL_BUILD_BOOTSTRAP_LOCK_SCHEMA,
    files: bootstrapManifest.files,
  })}\n`,
);
const mirrorFiles = [
  { path: "apps/web/e2e/fake.ts", digest: sourceParityTestDigest("x"), bytes: 1 },
  { path: REAL_BUILD_SOURCE_ROOT_POLICY_PATH, digest: sourceRootsPolicyDigest, bytes: 1 },
  { path: "inputs/booklet.pdf", digest: fixturePdfDigest, bytes: 3 },
];
const mirrorManifestBytes = Buffer.from(
  `${JSON.stringify({
    schemaVersion: "lego.real-build-source-parity-execution-mirror/1",
    files: mirrorFiles,
  })}\n`,
);
const runnerBytes = Buffer.from(REAL_BUILD_SERVED_RESPONSE_RUNNER_BODY);
const runnerHeaders = strictServedResponseHeaders(REAL_BUILD_SERVED_RESPONSE_RUNNER_HEADERS);
const requestHeaders = strictServedResponseHeaders({});
const runnerKey = servedResponseRequestKey(REAL_BUILD_SERVED_RESPONSE_RUNNER_PATH, requestHeaders);
const pdfUrl = "/@fs/C:/fixture/source-snapshot/inputs/booklet.pdf";
const pdfKey = servedResponseRequestKey(pdfUrl, requestHeaders);
const responseDrafts = [
  {
    requestKey: runnerKey,
    requestUrl: REAL_BUILD_SERVED_RESPONSE_RUNNER_PATH,
    requestHeaders,
    sourcePath: null,
    status: REAL_BUILD_SERVED_RESPONSE_RUNNER_STATUS,
    headers: runnerHeaders,
    body: {
      kind: "bundle",
      offset: 0,
      bytes: runnerBytes.length,
      digest: sourceParityTestDigest(runnerBytes),
    },
  },
  {
    requestKey: pdfKey,
    requestUrl: pdfUrl,
    requestHeaders,
    sourcePath: "inputs/booklet.pdf",
    status: 200,
    headers: [],
    body: { kind: "source", path: "inputs/booklet.pdf", bytes: 3, digest: fixturePdfDigest },
  },
].sort((left, right) => left.requestKey.localeCompare(right.requestKey));
const responses = responseDrafts.map((response, index) => ({ index, ...response }));
const responseIndex = new Map(responses.map(({ requestKey, index }) => [requestKey, index]));
const servedManifest = {
  schemaVersion: REAL_BUILD_SERVED_RESPONSE_SCHEMA,
  sourceRoot: "C:/fixture/source-snapshot",
  events: [
    {
      sequence: 0,
      outcome: "fulfilled",
      requestKey: runnerKey,
      responseIndex: responseIndex.get(runnerKey)!,
      cacheHit: false,
    },
    {
      sequence: 1,
      outcome: "fulfilled",
      requestKey: pdfKey,
      responseIndex: responseIndex.get(pdfKey)!,
      cacheHit: false,
    },
  ],
  responses,
  bodyChunks: [
    {
      file: servedResponseChunkName(0),
      bytes: runnerBytes.length,
      digest: sourceParityTestDigest(runnerBytes),
    },
  ],
};
const servedManifestBytes = Buffer.from(`${JSON.stringify(servedManifest)}\n`);
const sourceBundleBytes = Buffer.from("pdf");
const sourceBundleManifestBytes = Buffer.from(
  `${JSON.stringify({
    schemaVersion: REAL_BUILD_SOURCE_PARITY_SOURCE_BUNDLE_SCHEMA,
    bundleDigest: sourceParityTestDigest(sourceBundleBytes),
    sources: [{ path: "inputs/booklet.pdf", digest: fixturePdfDigest, bytes: 3, contentIndex: 0 }],
    contents: [{ index: 0, digest: fixturePdfDigest, bytes: 3, offset: 0 }],
  })}\n`,
);

function comparison(
  stepNumber: number,
  sourceClass: (typeof REAL_BUILD_SOURCE_PARITY_CLASSES)[number],
): RealBuildSourceParityMaskComparison {
  const differing = stepNumber === 1 && sourceClass === "assembly";
  return {
    sourceClass,
    productionArea: differing ? 1 : 0,
    candidateArea: 0,
    intersectionPixels: 0,
    unionPixels: differing ? 1 : 0,
    mismatchPixels: differing ? 1 : 0,
    iou: differing ? 0 : 1,
    productionMaskDigest: differing ? oneDigest : zeroDigest,
    candidateMaskDigest: zeroDigest,
    xorMaskDigest: differing ? oneDigest : zeroDigest,
    mismatchBounds: differing
      ? { minXPx: 0, minYPx: 0, maxXPxExclusive: 1, maxYPxExclusive: 1 }
      : null,
    diagnosticCaptureDigest: differing ? sourceParityTestDigest(SOURCE_PARITY_TEST_PNG) : null,
    xorEvidencePackedDigest: differing ? packedOneDigest : null,
    productionEvidencePackedDigest: differing ? packedOneDigest : packedZeroDigest,
  };
}

function aggregate(
  sourceClass: (typeof REAL_BUILD_SOURCE_PARITY_CLASSES)[number],
  steps: RealBuildSourceParityBrowserResult["steps"],
): RealBuildSourceParityAggregate {
  const rows = steps.map((step) =>
    step.comparisons.find((row) => row.sourceClass === sourceClass)!,
  );
  const total = (
    key:
      "productionArea" | "candidateArea" | "intersectionPixels" | "unionPixels" | "mismatchPixels",
  ) => rows.reduce((sum, row) => sum + row[key], 0);
  const intersectionPixels = total("intersectionPixels");
  const unionPixels = total("unionPixels");
  return {
    sourceClass,
    panels: rows.length,
    panelsDiffering: rows.filter(({ mismatchPixels }) => mismatchPixels > 0).length,
    totalPixels: steps.length * PIXELS,
    productionArea: total("productionArea"),
    candidateArea: total("candidateArea"),
    intersectionPixels,
    unionPixels,
    mismatchPixels: total("mismatchPixels"),
    iou: unionPixels === 0 ? 1 : intersectionPixels / unionPixels,
    meanIou: rows.reduce((sum, row) => sum + row.iou, 0) / rows.length,
    minimumIou: Math.min(...rows.map(({ iou }) => iou)),
  };
}

function browserFixture(): RealBuildSourceParityBrowserResult {
  const panels: RealBuildSourceParityProbePanel[] = Array.from(
    { length: REAL_BUILD_SOURCE_PARITY_EXPECTED_STEPS },
    (_, index) => {
      const stepNumber = index + 1;
      // The production width is fixed at 500 work pixels. A legal 1000:1 panel
      // aspect ratio keeps the synthetic fixture one row tall, preserving all
      // 359-step/class/evidence invariants without rechecking 448M zero pixels.
      const bounds = { minXPt: 0, maxXPt: 1_000, minYPt: 0, maxYPt: 1 };
      return {
        stepNumber,
        pageNumber: stepNumber,
        ...bounds,
        calloutBoxes: [],
        panelEvidenceDigest: stepPanelEvidenceDigest({
          pdfDigest: fixturePdfDigest,
          stepNumber,
          pageNumber: stepNumber,
          bounds,
          calloutBoxes: [],
        }),
      };
    },
  );
  const steps = panels.map((panel) => ({
    ...panel,
    width: WIDTH,
    height: HEIGHT,
    workRgbaBrowserCommitmentDigest: sourceParityTestDigest(`rgba-${panel.stepNumber}`),
    candidatePolicyBrowserCommitmentDigest: sourceParityTestDigest("policy"),
    candidateDerivationBrowserCommitmentDigest: sourceParityTestDigest(
      `candidate-${panel.stepNumber}`,
    ),
    comparisons: REAL_BUILD_SOURCE_PARITY_CLASSES.map((sourceClass) =>
      comparison(panel.stepNumber, sourceClass),
    ),
  }));
  return {
    pdfDigest: fixturePdfDigest,
    pdfBytes: 3,
    preparedPanelsDigest: sourceParityTestDigest(
      JSON.stringify(realBuildSourceParityPreparedPanelsManifest(fixturePdfDigest, panels)),
    ),
    steps,
    aggregate: REAL_BUILD_SOURCE_PARITY_CLASSES.map((sourceClass) => aggregate(sourceClass, steps)),
    captures: [
      {
        digest: sourceParityTestDigest(SOURCE_PARITY_TEST_PNG),
        width: 512,
        height: 1,
        png: dataUrl,
      },
    ],
    packedEvidence: [
      {
        packedDigest: packedZeroDigest,
        pixelCount: PIXELS,
        byteLength: packedZero.length,
        lowPaddingBits: 4,
        base64: Buffer.from(packedZero).toString("base64"),
      },
      {
        packedDigest: packedOneDigest,
        pixelCount: PIXELS,
        byteLength: packedOne.length,
        lowPaddingBits: 4,
        base64: Buffer.from(packedOne).toString("base64"),
      },
    ].sort((left, right) => left.packedDigest.localeCompare(right.packedDigest)),
  };
}

function environmentBytes(
  repoRoot: string,
  browser: RealBuildSourceParityBrowserResult,
  evidence: ReturnType<typeof realBuildSourceParityBrowserResultEvidence>,
): Buffer {
  return Buffer.from(
    `${JSON.stringify({
      schemaVersion: "lego.real-build-source-parity-environment/1",
      node: process.version,
      platform: process.platform,
      arch: process.arch,
      versions: process.versions,
      browser: { name: "chromium", version: "test" },
      playwright:
        "@playwright/test (bootstrap and execution-mirror manifests bind package paths/digests)",
      bootstrapSourceManifestDigest: bootstrapManifest.manifestDigest,
      executionSourceMirrorManifestDigest: sourceParityTestDigest(mirrorManifestBytes),
      servedResponseManifestDigest: sourceParityTestDigest(servedManifestBytes),
      servedSourceBundleManifestDigest: sourceParityTestDigest(sourceBundleManifestBytes),
      servedSourceBundleDigest: sourceParityTestDigest(sourceBundleBytes),
      checkoutRoot: repoRoot,
      browserResultDigest: evidence.digest,
      browserResultBytes: evidence.bytes,
      preparedPanelsDigest: browser.preparedPanelsDigest,
    })}\n`,
  );
}

// Construction authenticates every synthetic digest and walks all 359x5 rows.
// Keep that immutable module-private fact once; callers receive a detached clone.
const browserFixtureTemplate = browserFixture();
const browserFixtureEvidence = realBuildSourceParityBrowserResultEvidence(browserFixtureTemplate);

export function createRealBuildSourceParityTestFixture(
  repoRoot: string,
): RealBuildSourceParityProbeResult {
  const browser = structuredClone(browserFixtureTemplate);
  const environment = environmentBytes(repoRoot, browserFixtureTemplate, browserFixtureEvidence);
  return {
    ...browser,
    sourceSnapshot: {
      state: "authenticated-bootstrap-and-execution-mirror-locks-held-before-and-after-measurement",
      bootstrapManifestDigest: bootstrapManifest.manifestDigest,
      bootstrapManifestEvidenceDigest: sourceParityTestDigest(bootstrapManifestBytes),
      sourceRootsPolicyDigest,
      bootstrapLockManifestDigest: sourceParityTestDigest(bootstrapLockManifestBytes),
      bootstrapLockedFiles: 1,
      bootstrapLockedBytes: 1,
      bootstrapLockCoversInstructionPdf: false,
      executionMirrorManifestDigest: sourceParityTestDigest(mirrorManifestBytes),
      executionMirrorFiles: mirrorFiles.length,
      executionMirrorBytes: 5,
      executionMirrorCoversInstructionPdf: true,
      servedResponseManifestDigest: sourceParityTestDigest(servedManifestBytes),
      servedResponseFiles: 2,
      servedResponseBytes: servedManifestBytes.length + runnerBytes.length,
      servedSourceBundleManifestDigest: sourceParityTestDigest(sourceBundleManifestBytes),
      servedSourceBundleDigest: sourceParityTestDigest(sourceBundleBytes),
      servedSourceFiles: 1,
      servedSourceUniqueBytes: sourceBundleBytes.length,
      browserResultDigest: browserFixtureEvidence.digest,
      browserResultBytes: browserFixtureEvidence.bytes,
      preparedPanelsDigest: browser.preparedPanelsDigest,
      environmentDigest: sourceParityTestDigest(environment),
    },
  };
}

export function createRealBuildSourceParityTestProvenance(
  repoRoot: string,
): RealBuildSourceParityProvenanceRole[] {
  const environment = environmentBytes(repoRoot, browserFixtureTemplate, browserFixtureEvidence);
  return [
    {
      role: "bootstrap-source-manifest",
      digest: sourceParityTestDigest(bootstrapManifestBytes),
      bytes: Buffer.from(bootstrapManifestBytes),
    },
    {
      role: "execution-environment",
      digest: sourceParityTestDigest(environment),
      bytes: environment,
    },
    {
      role: "execution-source-mirror-manifest",
      digest: sourceParityTestDigest(mirrorManifestBytes),
      bytes: Buffer.from(mirrorManifestBytes),
    },
    {
      role: `served-response/${servedResponseChunkName(0)}`,
      digest: sourceParityTestDigest(runnerBytes),
      bytes: Buffer.from(runnerBytes),
    },
    {
      role: "served-response/served-response-manifest.json",
      digest: sourceParityTestDigest(servedManifestBytes),
      bytes: Buffer.from(servedManifestBytes),
    },
    {
      role: REAL_BUILD_SOURCE_PARITY_SOURCE_BUNDLE_MANIFEST_ROLE,
      digest: sourceParityTestDigest(sourceBundleManifestBytes),
      bytes: Buffer.from(sourceBundleManifestBytes),
    },
    {
      role: REAL_BUILD_SOURCE_PARITY_SOURCE_BUNDLE_ROLE,
      digest: sourceParityTestDigest(sourceBundleBytes),
      bytes: Buffer.from(sourceBundleBytes),
    },
  ];
}

export function createRealBuildSourceParityTestServedEvidence(): {
  readonly manifestBytes: Buffer;
  readonly bodyChunkBytes: readonly Buffer[];
  readonly sourceFiles: typeof mirrorFiles;
} {
  return {
    manifestBytes: Buffer.from(servedManifestBytes),
    bodyChunkBytes: [Buffer.from(runnerBytes)],
    sourceFiles: mirrorFiles.map((file) => ({ ...file })),
  };
}

export const SOURCE_PARITY_TEST_REPO_ROOT = "C:/fixture/checkout";
