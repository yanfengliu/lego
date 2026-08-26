import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";

import { jsonArtifactFromBytes } from "./part-identification-artifact-source.mjs";
import {
  MAX_IMAGE_ARTIFACT_BYTES,
  assertCanonicalRelativePath,
  readContainedFile,
} from "./part-identification-io.mjs";
import { measureExactBottomBackgroundRecut } from "./part-identification-source-art-canonical.mjs";
import { createPngDecodeBudget, decodeCanonicalCardRgba } from "./part-thumbnail-image-guard.mjs";

const SHA256 = /^sha256:[0-9a-f]{64}$/u;
const MAX_CALLOUTS = 2_000;
export const LEGACY_RECUT_MAX_DECODE_PIXELS = 16 * 1024 * 1024;
export const sha256Digest = (bytes) => `sha256:${createHash("sha256").update(bytes).digest("hex")}`;

export const CURRENT_LEGACY_RECUT_PINS = Object.freeze({
  kind: "module-owned-current-pins",
  sourceHash: "sha256:baef0a373164b58d7c982984b52d4e50b10cc59ed28007acb456faa72359bd27",
  lastStep: 50,
  legacyManifest: Object.freeze({
    path: "output/callout-thumbnails/runs/1e37c50ffee4df7741ac6722/manifest.json",
    schemaVersion: "lego.callout-thumbnails/5",
    digest: "sha256:e64a38507306d60d68d40cbd7f9e19158581faf1dc75fb77077d76850a33a0c3",
    bytes: 1_016_698,
    runId: "1e37c50ffee4df7741ac6722",
    pagesCropped: 196,
    calloutCount: 881,
  }),
  currentManifest: Object.freeze({
    path: "output/callout-thumbnails/manifest.json",
    schemaVersion: "lego.callout-thumbnails/6",
    digest: "sha256:c8d20cfe87ef9d21488725b393b94e61870fcc82b26bb497ea734fc7b97a67bf",
    bytes: 1_018_634,
    runId: "e49496b28d8fecb0ccc158a1",
    pagesCropped: 196,
    calloutCount: 881,
  }),
  truth: Object.freeze({
    path: "scripts/fixtures/part-identification-truth-first50.json",
    schemaVersion: "lego.part-identification-truth/3",
    digest: "sha256:c7b6aa8990ab9771a4de7c960ffa0b2e69a0d26e8e802ff28d1be4cc8291ca0c",
    bytes: 23_515,
  }),
  expectedSourceIndex: Object.freeze({
    expectedPrintedSteps: 359,
    lastIndexedStep: 358,
    rosterSha256: "sha256:a494a35f15b9038bd36c64846ce5835f2bcaddaec00f4eb8b00e38ee9d95fbe2",
    rosterBytes: 296_107,
    calloutRows: 881,
    partArtRows: 859,
    nonPartRows: 22,
    subassemblyRepeatRows: 17,
    assemblyActionRows: 5,
    prefixLastStep: 50,
    prefixRows: 189,
    prefixPieces: 326,
    prefixPartArtRows: 187,
    prefixPartArtPieces: 320,
    suffixStepsReconstructed: false,
    cropBytesAuthenticated: "truth-linked-first-50-only",
  }),
  expectedRelationCommitment: Object.freeze({
    rows: 85,
    bytes: 34_782,
    digest: "sha256:bacedddff0083438324e106c45b55e8eea61b866572387d9f147eab011aa927a",
  }),
  expectedArtifact: Object.freeze({
    bytes: 102_513,
    digest: "sha256:1f7a0fdcb2d665bd3fd30b8e5666307a18c884607640e6b229ef2077f3ebbc8c",
  }),
  expectedAccounting: Object.freeze({
    truthVerdicts: 82,
    truthUnjudgeable: 2,
    verdictRelations: 83,
    verdictPieces: 126,
    retainedSameRelations: 74,
    retainedSamePieces: 115,
    retainedDifferentRelations: 9,
    retainedDifferentPieces: 11,
    acceptedSameRelations: 73,
    acceptedSamePieces: 113,
    acceptedSameExactPngRelations: 25,
    acceptedSameExactPngPieces: 26,
    acceptedSameBottomRecutRelations: 48,
    acceptedSameBottomRecutPieces: 87,
    acceptedDifferentRelations: 8,
    acceptedDifferentPieces: 10,
    acceptedDifferentExactPngRelations: 4,
    acceptedDifferentExactPngPieces: 5,
    acceptedDifferentBottomRecutRelations: 4,
    acceptedDifferentBottomRecutPieces: 5,
    refusedSameRelations: 1,
    refusedSamePieces: 2,
    refusedDifferentRelations: 1,
    refusedDifferentPieces: 1,
    refusedRelations: 2,
    refusedPieces: 3,
    unjudgeableRelations: 2,
    unjudgeablePieces: 4,
    perCompileSelectedCropImages: 170,
    perCompileDecodePixels: 14_611_220,
    perCompileDecodePixelLimit: LEGACY_RECUT_MAX_DECODE_PIXELS,
  }),
});

function artifactFor(bytes, pin, label) {
  const artifact = jsonArtifactFromBytes(bytes, label);
  if (
    artifact.bytes.length !== pin.bytes ||
    artifact.digest !== pin.digest ||
    artifact.value?.schemaVersion !== pin.schemaVersion
  ) {
    throw new Error(
      `${label} must be the exact pinned ${pin.schemaVersion} artifact at ${pin.digest} with ${pin.bytes} bytes; received ${artifact.value?.schemaVersion ?? "missing schema"}, ${artifact.digest}, ${artifact.bytes.length} bytes. Restore the retained generation instead of migrating its evidence in place.`,
    );
  }
  return artifact;
}

function finiteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function manifestRows(artifact, pin, sourceHash, label) {
  const value = artifact.value;
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    value.sourceHash !== sourceHash ||
    value.pageSelection !== "full booklet" ||
    value.pagesCropped !== pin.pagesCropped ||
    value.calloutCount !== pin.calloutCount ||
    !Array.isArray(value.callouts) ||
    value.callouts.length !== pin.calloutCount ||
    value.callouts.length > MAX_CALLOUTS
  ) {
    throw new Error(
      `${label} must retain the exact full-booklet source, ${pin.pagesCropped} cropped pages, and ${pin.calloutCount} bounded callout rows. A partial or detached manifest cannot bridge judged crops.`,
    );
  }
  const rows = new Map();
  for (const [index, row] of value.callouts.entries()) {
    const box = row?.box;
    if (
      typeof row?.identity !== "string" ||
      rows.has(row.identity) ||
      !Number.isSafeInteger(row.pageNumber) ||
      row.pageNumber < 1 ||
      !Number.isSafeInteger(row.stepNumber) ||
      row.stepNumber < 1 ||
      row.stepNumber > 359 ||
      !Number.isSafeInteger(row.quantity) ||
      row.quantity < 1 ||
      !finiteNumber(row.xPt) ||
      !finiteNumber(row.yPt) ||
      !finiteNumber(row.heightPt) ||
      row.heightPt <= 0 ||
      typeof row.boxMethod !== "string" ||
      typeof row.regionKind !== "string" ||
      typeof box !== "object" ||
      box === null ||
      Array.isArray(box) ||
      ![box.minXPt, box.minYPt, box.maxXPt, box.maxYPt].every(finiteNumber) ||
      box.maxXPt <= box.minXPt ||
      box.maxYPt <= box.minYPt ||
      !["part-art", "subassembly-repeat", "assembly-action"].includes(row.evidenceKind) ||
      typeof row.file !== "string" ||
      !SHA256.test(row.sha256 ?? "") ||
      !Number.isSafeInteger(row.byteLength) ||
      row.byteLength < 1 ||
      !Number.isSafeInteger(row.widthPx) ||
      row.widthPx < 1 ||
      !Number.isSafeInteger(row.heightPx) ||
      row.heightPx < 1
    ) {
      throw new Error(
        `${label} callout ${index} must have one unique identity, bounded source coordinates, evidence kind, canonical file, digest, byte count, and dimensions. Restore the exact retained manifest.`,
      );
    }
    assertCanonicalRelativePath(row.file, `${label} callout ${index} file`);
    const expectedStem = row.identity.replaceAll("|", "-").replaceAll(".", "d");
    if (row.file !== `runs/${pin.runId}/${expectedStem}.png`) {
      throw new Error(
        `${label} callout ${index} selects ${JSON.stringify(row.file)} instead of its pinned run ${pin.runId} and identity-derived filename. Cross-run crop splicing is not a recut proof.`,
      );
    }
    rows.set(row.identity, row);
  }
  return rows;
}

function rosterRow(row) {
  return {
    identity: row.identity,
    pageNumber: row.pageNumber,
    stepNumber: row.stepNumber,
    quantity: row.quantity,
    xPt: row.xPt,
    yPt: row.yPt,
    heightPt: row.heightPt,
    boxMethod: row.boxMethod,
    box: {
      minXPt: row.box.minXPt,
      minYPt: row.box.minYPt,
      maxXPt: row.box.maxXPt,
      maxYPt: row.box.maxYPt,
    },
    evidenceKind: row.evidenceKind,
    regionKind: row.regionKind,
  };
}

function sourceIndexFor(legacyRows, currentRows, pins) {
  const legacyRoster = [...legacyRows.values()].map(rosterRow);
  const currentRoster = [...currentRows.values()].map(rosterRow);
  if (!isDeepStrictEqual(legacyRoster, currentRoster)) {
    throw new Error(
      "Legacy /5 and current /6 manifests do not retain the same ordered full-booklet identity, page, step, quantity, vector-coordinate, box, and evidence-kind roster. Re-cutting may change pixels, not the 359-step source index.",
    );
  }
  const rosterBytes = Buffer.from(`${JSON.stringify(currentRoster)}\n`);
  const rows = [...currentRows.values()];
  const prefix = rows.filter((row) => row.stepNumber <= pins.lastStep);
  const partArt = rows.filter((row) => row.evidenceKind === "part-art");
  const prefixPartArt = prefix.filter((row) => row.evidenceKind === "part-art");
  const observed = {
    expectedPrintedSteps: 359,
    lastIndexedStep: Math.max(...rows.map((row) => row.stepNumber)),
    rosterSha256: sha256Digest(rosterBytes),
    rosterBytes: rosterBytes.length,
    calloutRows: rows.length,
    partArtRows: partArt.length,
    nonPartRows: rows.length - partArt.length,
    subassemblyRepeatRows: rows.filter((row) => row.evidenceKind === "subassembly-repeat").length,
    assemblyActionRows: rows.filter((row) => row.evidenceKind === "assembly-action").length,
    prefixLastStep: pins.lastStep,
    prefixRows: prefix.length,
    prefixPieces: prefix.reduce((total, row) => total + row.quantity, 0),
    prefixPartArtRows: prefixPartArt.length,
    prefixPartArtPieces: prefixPartArt.reduce((total, row) => total + row.quantity, 0),
    suffixStepsReconstructed: false,
    cropBytesAuthenticated: "truth-linked-first-50-only",
  };
  if (pins.expectedSourceIndex !== null && !isDeepStrictEqual(observed, pins.expectedSourceIndex)) {
    throw new Error(
      `Legacy-recut full source index does not reproduce its pinned 359-step roster. Expected ${JSON.stringify(pins.expectedSourceIndex)}, received ${JSON.stringify(observed)}. Preserve the suffix index without reconstructing it.`,
    );
  }
  return observed;
}

export function authenticateLegacyRecutInputs(input, pins) {
  const legacyArtifact = artifactFor(
    input.legacyManifestBytes,
    pins.legacyManifest,
    "Legacy callout manifest",
  );
  const currentArtifact = artifactFor(
    input.currentManifestBytes,
    pins.currentManifest,
    "Current callout manifest",
  );
  const truthArtifact = artifactFor(input.truthBytes, pins.truth, "Pair-judged truth");
  const legacyRows = manifestRows(
    legacyArtifact,
    pins.legacyManifest,
    pins.sourceHash,
    "Legacy callout manifest",
  );
  const currentRows = manifestRows(
    currentArtifact,
    pins.currentManifest,
    pins.sourceHash,
    "Current callout manifest",
  );
  return {
    legacyRows,
    currentRows,
    truthArtifact,
    sourceIndex: sourceIndexFor(legacyRows, currentRows, pins),
  };
}

export function assertSelectedDecodeBudget(pairs, maxPixels = LEGACY_RECUT_MAX_DECODE_PIXELS) {
  let pixels = 0;
  for (const { legacy, current } of pairs) {
    pixels += legacy.widthPx * legacy.heightPx + current.widthPx * current.heightPx;
    if (!Number.isSafeInteger(pixels) || pixels > maxPixels) {
      throw new Error(
        `Legacy-recut selected crops declare ${pixels} aggregate decode pixels, above the fixed ${maxPixels}-pixel workflow limit. Narrow or split the evidence population before decoding; do not raise the bound implicitly.`,
      );
    }
  }
  return { images: pairs.length * 2, pixels, limit: maxPixels };
}

function readCrop(root, row, label, decodeBudget) {
  const bytes = readContainedFile(root, row.file, {
    label,
    pathLabel: `${label} path`,
    maxBytes: MAX_IMAGE_ARTIFACT_BYTES,
  });
  const digest = sha256Digest(bytes);
  if (digest !== row.sha256 || bytes.length !== row.byteLength) {
    throw new Error(
      `${label} derives ${digest} and ${bytes.length} bytes, but its manifest binds ${row.sha256} and ${row.byteLength}. Re-read one immutable retained crop generation.`,
    );
  }
  const dimensions = decodeBudget.charge(bytes, label);
  if (dimensions.width !== row.widthPx || dimensions.height !== row.heightPx) {
    throw new Error(
      `${label} has ${dimensions.width} x ${dimensions.height} authenticated PNG dimensions, but its manifest binds ${row.widthPx} x ${row.heightPx}.`,
    );
  }
  return { bytes, decoded: decodeCanonicalCardRgba(bytes, label) };
}

function refusalDiagnostics(legacy, current) {
  const overlapWidth = Math.min(legacy.width, current.width);
  const overlapHeight = Math.min(legacy.height, current.height);
  let retainedDifferingPixels = 0;
  let maximumChannelDelta = 0;
  for (let y = 0; y < overlapHeight; y += 1) {
    for (let x = 0; x < overlapWidth; x += 1) {
      const legacyOffset = (y * legacy.width + x) * 4;
      const currentOffset = (y * current.width + x) * 4;
      let differs = false;
      for (let channel = 0; channel < 4; channel += 1) {
        const delta = Math.abs(
          legacy.data[legacyOffset + channel] - current.data[currentOffset + channel],
        );
        if (delta > 0) differs = true;
        maximumChannelDelta = Math.max(maximumChannelDelta, delta);
      }
      if (differs) retainedDifferingPixels += 1;
    }
  }
  const reason =
    legacy.width !== current.width || legacy.height <= current.height
      ? "not-a-shorter-same-width-bottom-recut"
      : retainedDifferingPixels > 0
        ? "retained-rgba-changed"
        : "removed-suffix-is-not-exact-background";
  return {
    method: "refused",
    reason,
    legacyWidth: legacy.width,
    legacyHeight: legacy.height,
    currentWidth: current.width,
    currentHeight: current.height,
    overlapWidth,
    overlapHeight,
    retainedDifferingPixels,
    maximumChannelDelta,
  };
}

export function createLegacyRecutCropComparator(root) {
  const decodeBudget = createPngDecodeBudget(
    "Legacy-recut selected crop decoding",
    LEGACY_RECUT_MAX_DECODE_PIXELS,
  );
  return (legacyRow, currentRow, label) => {
    const legacy = readCrop(root, legacyRow, `${label} legacy crop`, decodeBudget);
    const current = readCrop(root, currentRow, `${label} current crop`, decodeBudget);
    if (legacyRow.sha256 === currentRow.sha256) {
      if (!legacy.bytes.equals(current.bytes)) {
        throw new Error(
          `${label} uses one declared digest for two different byte strings. Refusing a cryptographic collision instead of treating it as exact evidence.`,
        );
      }
      return {
        method: "exact-png-bytes",
        sharedSha256: legacyRow.sha256,
        sharedBytes: legacy.bytes.length,
        width: legacy.decoded.width,
        height: legacy.decoded.height,
      };
    }
    try {
      const proof = measureExactBottomBackgroundRecut(legacy.decoded, current.decoded, label);
      return { method: "exact-bottom-background-recut", ...proof };
    } catch {
      return refusalDiagnostics(legacy.decoded, current.decoded);
    }
  };
}
