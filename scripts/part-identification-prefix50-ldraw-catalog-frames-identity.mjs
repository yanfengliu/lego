import { isDeepStrictEqual } from "node:util";

import { sha256Digest } from "./part-identification-artifact-source.mjs";
import { expandExactLdrawPart } from "./part-identification-prefix50-ldraw-catalog-frames-archive.mjs";

const IDENTITY_REFERENCE = Object.freeze([
  "16",
  "0",
  "0",
  "0",
  "1",
  "0",
  "0",
  "0",
  "1",
  "0",
  "0",
  "0",
  "1",
]);

function assertPinnedRoot(bytes, expected, label) {
  const digest = sha256Digest(bytes);
  if (bytes.length !== expected.bytes || digest !== expected.digest) {
    throw new TypeError(
      `${label} must be the exact ${expected.bytes}-byte root at ${expected.digest}; received ${bytes.length} bytes at ${digest}.`,
    );
  }
}

function assertOneIdentityMovedRoot(sourceBytes, targetFilename, label) {
  const geometryRows = sourceBytes
    .toString("utf8")
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line !== "" && !line.startsWith("0 "));
  if (geometryRows.length !== 1) {
    throw new TypeError(`${label} must contain exactly one non-meta LDraw row.`);
  }
  const tokens = geometryRows[0].split(/\s+/u);
  if (
    tokens[0] !== "1" ||
    tokens.length !== 15 ||
    !isDeepStrictEqual(tokens.slice(1, 14), IDENTITY_REFERENCE) ||
    tokens[14].replaceAll("\\", "/").toLowerCase() !== targetFilename.toLowerCase()
  ) {
    throw new TypeError(
      `${label} must be one color-16, zero-translation, identity-matrix reference to same-hand target ${targetFilename}.`,
    );
  }
}

const closureProjection = (expanded) => ({
  root: {
    filename: expanded.root.path.slice("ldraw/parts/".length),
    bytes: expanded.root.bytes,
    digest: expanded.root.digest,
  },
  closureFileCount: expanded.closureFileCount,
  closureDigest: expanded.closureDigest,
  expandedTriangleCount: expanded.expandedTriangleCount,
  expandedGeometryDigest: sha256Digest(Buffer.from(JSON.stringify(expanded.triangles))),
  bounds: expanded.bounds,
});

export function verifyPrefix50OccurrenceIdentityMovedRoot({ archive, expectation, occurrence }) {
  if (
    occurrence.sourceBuilderIdentityOrdinal !== expectation.sourceBuilderIdentityOrdinal ||
    occurrence.designRevision !== expectation.designRevision ||
    occurrence.catalogPartId !== expectation.catalogPartId ||
    occurrence.ldrawFilename !== expectation.sourceRoot.filename ||
    occurrence.catalogLdrawFilename !== expectation.targetRoot.filename ||
    occurrence.bindingKind !== "identity-moved-root" ||
    occurrence.occurrenceScoped !== true ||
    occurrence.movedRootProofId !== expectation.proofId
  ) {
    throw new TypeError(
      `Moved-root proof ${expectation.proofId} does not match its exact occurrence-scoped ordinal/design/catalog/source/target basis.`,
    );
  }
  const sourceBytes = archive.read(`ldraw/parts/${expectation.sourceRoot.filename}`);
  const targetBytes = archive.read(`ldraw/parts/${expectation.targetRoot.filename}`);
  assertPinnedRoot(sourceBytes, expectation.sourceRoot, `Moved-root source ${expectation.proofId}`);
  assertPinnedRoot(targetBytes, expectation.targetRoot, `Moved-root target ${expectation.proofId}`);
  assertOneIdentityMovedRoot(
    sourceBytes,
    expectation.targetRoot.filename,
    `Moved-root source ${expectation.proofId}`,
  );
  const source = closureProjection(expandExactLdrawPart(archive, expectation.sourceRoot.filename));
  const target = closureProjection(expandExactLdrawPart(archive, expectation.targetRoot.filename));
  const expectedSource = {
    root: {
      filename: expectation.sourceRoot.filename,
      bytes: expectation.sourceRoot.bytes,
      digest: expectation.sourceRoot.digest,
    },
    closureFileCount: expectation.sourceRoot.closureFileCount,
    closureDigest: expectation.sourceRoot.closureDigest,
    expandedTriangleCount: expectation.expandedTriangleCount,
    expandedGeometryDigest: expectation.expandedGeometryDigest,
    bounds: expectation.bounds,
  };
  const expectedTarget = {
    root: {
      filename: expectation.targetRoot.filename,
      bytes: expectation.targetRoot.bytes,
      digest: expectation.targetRoot.digest,
    },
    closureFileCount: expectation.targetRoot.closureFileCount,
    closureDigest: expectation.targetRoot.closureDigest,
    expandedTriangleCount: expectation.expandedTriangleCount,
    expandedGeometryDigest: expectation.expandedGeometryDigest,
    bounds: expectation.bounds,
  };
  if (
    !isDeepStrictEqual(source, expectedSource) ||
    !isDeepStrictEqual(target, expectedTarget) ||
    source.expandedGeometryDigest !== target.expandedGeometryDigest
  ) {
    throw new TypeError(
      `Moved-root proof ${expectation.proofId} does not retain the pinned source/target closures and exact expanded geometry.`,
    );
  }
  return Object.freeze({
    proofKind: "official-archive-one-hop-identity-moved-root",
    proofId: expectation.proofId,
    source,
    target,
    sameExpandedGeometry: true,
    globalAliasClaimed: false,
  });
}
