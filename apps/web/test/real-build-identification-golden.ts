import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

import { readBoundedRegularFile } from "../e2e/bounded-file-read";

export const SYNTHETIC_IDENTIFICATION_MANIFEST_EXPECTATION = {
  sourceHash: "sha256:f76be473d1118d69bb7596dc8ea1b5905571e54ecacced0e210c4e2193779865",
  pagesCropped: 1,
  identityCount: 1,
  rawQuantity: 1,
  identitySetDigest: "sha256:4aa4143460264eb0c486da460a1595693e634b3919f9d0ffcbdfcdb0d8d62080",
  accounting: {
    rawNxIdentityCount: 1,
    rawNxQuantityTotal: 1,
    physicalPartArtIdentityCount: 1,
    physicalPartArtQuantityTotal: 1,
    semanticIdentityCount: 0,
    semanticQuantityTotal: 0,
  },
} as const;

/** Small repo-authored JSON goldens live as reviewable fixtures instead of encoded source literals. */
export const SYNTHETIC_IDENTIFICATION_GOLDEN = {
  manifest: {
    file: "manifest.json",
    bytes: 1_028,
    digest: "sha256:23f58599faa5e6287c1de0eb1e145927ee69fefdf94309ddd8fac0b072d2b0bb",
  },
  features: {
    file: "features.json",
    bytes: 11_892,
    digest: "sha256:a907fa32d19e5cac90a2aed7d97fc121ecfceca972d03c81b43afcc7af25bbfe",
  },
  match: {
    file: "match.json",
    bytes: 353,
    digest: "sha256:2ea02f32549ad7f42c44f264a6ffbf75492aea05713cb784e141dcc137401fb8",
  },
  distances: {
    file: "distances.json",
    bytes: 188,
    digest: "sha256:066562a3dfb6a5044f4bde46b5736fad227197f742c3c8d582a0ab1865b2a6f4",
  },
  elementResolution: {
    file: "element-resolution.json",
    bytes: 76,
    digest: "sha256:9b1f5551504738d2b32b473588fb7c379e1a94c050b6be20444020f40057a7cc",
  },
  /**
   * One judged pair covering the single synthetic callout, so the deterministic
   * golden proves the pair-judged trust path end to end: the geometry claim this
   * closure would otherwise publish is upgraded to `pair-judged-same`, and the
   * upgrade only survives because the coverage bytes reproduce from these bytes.
   */
  pairJudged: {
    file: "pair-judged-truth.json",
    bytes: 631,
    digest: "sha256:f10acf1be4a328da456c871e63e1e96b1910d2d184a4f4f823252d31ded98d79",
  },
  coverage: {
    file: "coverage.json",
    bytes: 2_433,
    digest: "sha256:500ffe073becb6274837127abdb681dd07d7ea2237095a6eb1155368c84025bc",
  },
} as const;

const fixtureRoot = new URL("./fixtures/real-build-identification-golden/", import.meta.url);

export function syntheticIdentificationGoldenBytes(
  role: keyof typeof SYNTHETIC_IDENTIFICATION_GOLDEN,
): Buffer {
  const fixture = SYNTHETIC_IDENTIFICATION_GOLDEN[role];
  const bytes = readBoundedRegularFile(fileURLToPath(new URL(fixture.file, fixtureRoot)), {
    label: `synthetic identification ${role} golden`,
    minimumBytes: fixture.bytes,
    maximumBytes: fixture.bytes,
    exactBytes: fixture.bytes,
    expectedSha256: fixture.digest,
  });
  const actualDigest = `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
  if (actualDigest !== fixture.digest) {
    throw new TypeError(
      `Synthetic identification ${role} golden has digest ${actualDigest}; expected ${fixture.digest}.`,
    );
  }
  return bytes;
}
