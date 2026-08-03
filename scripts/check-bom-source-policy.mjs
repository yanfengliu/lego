import { readFileSync } from "node:fs";

const forbiddenRawSourceExtension = /\.(?:bin|bundle|dat|glb|gltf|ldr|lxf|lxfml|mpd|xml)$/i;
const reviewedTextSourceExtension = /\.(?:css|html|js|json|jsx|md|mjs|mts|ts|tsx|txt)$/i;
const forbiddenBinarySignatures = [
  ["ZIP", Buffer.from([0x50, 0x4b, 0x03, 0x04])],
  ["empty ZIP", Buffer.from([0x50, 0x4b, 0x05, 0x06])],
  ["spanned ZIP", Buffer.from([0x50, 0x4b, 0x07, 0x08])],
  ["PNG", Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])],
  ["JPEG", Buffer.from([0xff, 0xd8, 0xff])],
  ["GIF87a", Buffer.from("GIF87a")],
  ["GIF89a", Buffer.from("GIF89a")],
  ["little-endian TIFF", Buffer.from([0x49, 0x49, 0x2a, 0x00])],
  ["big-endian TIFF", Buffer.from([0x4d, 0x4d, 0x00, 0x2a])],
  ["ICO", Buffer.from([0x00, 0x00, 0x01, 0x00])],
  ["gzip", Buffer.from([0x1f, 0x8b])],
  ["7-Zip", Buffer.from([0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c])],
  ["RAR", Buffer.from([0x52, 0x61, 0x72, 0x21, 0x1a, 0x07])],
];

const maxJoinedEncodedLiteralCharacters = (source) => {
  const literalPattern = /(["'`])([A-Za-z0-9+/]+={0,2})\1/g;
  let maximum = 0;
  let current = 0;
  let previousEnd;
  for (const match of source.matchAll(literalPattern)) {
    const value = match[2];
    const excludedMetadata =
      /^(?:[0-9a-f]{32}|[0-9a-f]{64})$/.test(value) ||
      /^\/(?:[A-Za-z0-9._~-]+\/)+[A-Za-z0-9._~-]+$/.test(value);
    const separator =
      previousEnd === undefined
        ? ""
        : source
            .slice(previousEnd, match.index)
            .replace(/\/\*[\s\S]*?\*\//g, "")
            .replace(/\/\/[^\r\n]*/g, "");
    current =
      excludedMetadata || (previousEnd !== undefined && !/^[\s,+]*$/.test(separator))
        ? excludedMetadata
          ? 0
          : value.length
        : current + value.length;
    maximum = Math.max(maximum, current);
    previousEnd = match.index + match[0].length;
  }
  return maximum;
};

export function inspectAppPackageSourceBytes(relativeFile, sourceBytes) {
  if (forbiddenRawSourceExtension.test(relativeFile)) {
    return [
      `${relativeFile} has a raw geometry/source extension forbidden from app and package contents; retain only bounded metadata in the quarantine ledger or add a separately reviewed BOM/package policy before including it`,
    ];
  }
  if (!reviewedTextSourceExtension.test(relativeFile)) {
    return [
      `${relativeFile} has a file type that is not reviewed for app and package contents; bind the asset to an explicit BOM/package policy before including it`,
    ];
  }

  const signatureSearchBytes = sourceBytes.subarray(0, 1_024);
  const hasPdfSignature = signatureSearchBytes.includes(Buffer.from("%PDF-"));
  const forbiddenSignature = forbiddenBinarySignatures.find(([, signature]) =>
    sourceBytes.subarray(0, signature.length).equals(signature),
  );
  const hasWebpSignature =
    sourceBytes.subarray(0, 4).equals(Buffer.from("RIFF")) &&
    sourceBytes.subarray(8, 12).equals(Buffer.from("WEBP"));
  const isoBmffBoxSize = sourceBytes.length >= 8 ? sourceBytes.readUInt32BE(0) : 0;
  const hasIsoBmffSignature =
    sourceBytes.subarray(4, 8).equals(Buffer.from("ftyp")) &&
    isoBmffBoxSize >= 8 &&
    isoBmffBoxSize <= sourceBytes.length;
  const bmpFileSize = sourceBytes.length >= 14 ? sourceBytes.readUInt32LE(2) : 0;
  const bmpPixelOffset = sourceBytes.length >= 14 ? sourceBytes.readUInt32LE(10) : 0;
  const hasBmpSignature =
    sourceBytes.subarray(0, 2).equals(Buffer.from("BM")) &&
    bmpFileSize >= 14 &&
    bmpFileSize <= sourceBytes.length &&
    bmpPixelOffset >= 14 &&
    bmpPixelOffset <= bmpFileSize;
  if (
    hasPdfSignature ||
    forbiddenSignature ||
    hasWebpSignature ||
    hasIsoBmffSignature ||
    hasBmpSignature
  ) {
    const label = hasPdfSignature
      ? "PDF"
      : hasWebpSignature
        ? "WebP"
        : hasIsoBmffSignature
          ? "ISO-BMFF"
          : hasBmpSignature
            ? "BMP"
            : forbiddenSignature[0];
    return [
      `${relativeFile} contains a ${label} binary signature under a reviewed text extension; retain only bounded metadata or add a separately reviewed BOM/package policy`,
    ];
  }

  const binaryControlByteCount = sourceBytes.reduce(
    (count, byte) =>
      count + (byte < 0x20 && byte !== 0x09 && byte !== 0x0a && byte !== 0x0d ? 1 : 0),
    0,
  );
  if (binaryControlByteCount > 8) {
    return [
      `${relativeFile} contains ${binaryControlByteCount} binary control bytes under a reviewed text extension; retain only bounded metadata or add a separately reviewed BOM/package policy`,
    ];
  }

  let source;
  try {
    source = new TextDecoder("utf-8", { fatal: true }).decode(sourceBytes);
  } catch {
    return [
      `${relativeFile} is not valid UTF-8 despite using a reviewed text extension; retain only bounded metadata or add a separately reviewed BOM/package policy`,
    ];
  }

  const issues = [];
  if (/<LXFML\b/i.test(source) || /"binaryBase64"\s*:/.test(source)) {
    issues.push(
      `${relativeFile} contains an LXFML or binaryBase64 raw-payload signature; remove the payload and retain only its digest, identity, counts, and bounded measurements`,
    );
  }
  const encodedLikeRuns = source.match(/[A-Za-z0-9+/]{32,}={0,2}/g) ?? [];
  const encodedLikeCharacters = encodedLikeRuns
    .filter(
      (run) =>
        !/^(?:[0-9a-f]{32}|[0-9a-f]{64})$/.test(run) &&
        !/^\/(?:[A-Za-z0-9._~-]+\/)+[A-Za-z0-9._~-]+$/.test(run),
    )
    .reduce((total, run) => total + run.length, 0);
  const joinedEncodedLiteralCharacters = maxJoinedEncodedLiteralCharacters(source);
  if (
    encodedLikeRuns.some((run) => run.length >= 128) ||
    encodedLikeCharacters >= 4_096 ||
    joinedEncodedLiteralCharacters >= 4_096
  ) {
    issues.push(
      `${relativeFile} contains long or aggregate base64-like content; replace embedded source bytes with a digest-bound external artifact`,
    );
  }
  if (
    !/\.(?:spec|test)\.[cm]?[jt]sx?$/i.test(relativeFile) &&
    /[A-Za-z]:(?:\\{1,4}|\/)(?:Users|tmp)(?:\\{1,4}|\/)/i.test(source)
  ) {
    issues.push(
      `${relativeFile} contains a machine-local Users or tmp path; replace it with a logical locator and keep the absolute path outside committed package content`,
    );
  }
  return issues;
}

export function inspectAppPackageSourceFile(relativeFile, absoluteFile) {
  return inspectAppPackageSourceBytes(relativeFile, readFileSync(absoluteFile));
}
