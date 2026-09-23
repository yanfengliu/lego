import { createHash } from "node:crypto";

// One byte-reproduced, repository-authored assembly, not an extension-wide allowance.
// The companion C# source remains in the ordinary encoded-source literal census.
export const REVIEWED_POPPLER_LAUNCHER = Object.freeze({
  binaryPath: "apps/web/e2e/real-build-prefix50-subbuild-return-review-poppler-job-launcher.dll",
  binaryBytes: 15_360,
  binaryDigest: "10b825ba6ff6dff1866cb90927798ee9884ef2e3a351388ba31eb2fadff11c8b",
  sourcePath: "apps/web/e2e/real-build-prefix50-subbuild-return-review-poppler-job-launcher.cs",
  sourceBytes: 18_635,
  sourceDigest: "02841a492c0b1a49afedb27bfc6f0ad7f3e6c0538aad3a4d4c45f3376bf378f2",
});

export const sourcePolicySha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

export function inspectReviewedSourceBinary(relativeFile, sourceBytes, entries) {
  const pin = REVIEWED_POPPLER_LAUNCHER;
  if (relativeFile !== pin.binaryPath) return undefined;
  const issues = [];
  if (
    sourceBytes.length !== pin.binaryBytes ||
    sourcePolicySha256(sourceBytes) !== pin.binaryDigest
  )
    issues.push(
      `${relativeFile} launcher bytes differ from the ${pin.binaryBytes}-byte source-reproduced assembly; rebuild and review the exact C# source/binary pair before changing its admission`,
    );
  const matching = (path) =>
    entries.filter((entry) => entry.relativeFile.replaceAll("\\", "/") === path);
  const sources = matching(pin.sourcePath);
  if (
    matching(pin.binaryPath).length !== 1 ||
    sources.length !== 1 ||
    sources[0].sourceBytes.length !== pin.sourceBytes ||
    sourcePolicySha256(sources[0].sourceBytes) !== pin.sourceDigest
  )
    issues.push(
      `${relativeFile} launcher admission requires exactly one binary and its exact complete ${pin.sourcePath} source in the same census population; restore the reviewed source pair or perform a new reproducible-build review`,
    );
  return issues;
}
