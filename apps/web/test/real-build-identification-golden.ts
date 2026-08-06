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
    bytes: 1_041,
    digest: "sha256:0ea8582b833a5353160aa05b0af6ef41886a9813c8b9c6b3829f533a1689bc73",
  },
  features: {
    file: "features.json",
    bytes: 11_913,
    digest: "sha256:33da68db3e015a3528e3ac3365461763c81c8b6ca51824ada6781e210d10e0f4",
  },
  match: {
    file: "match.json",
    bytes: 353,
    digest: "sha256:19493a3d5a09d05c488e624e111951826be053adc0c0f9c9f7bcf2f711596ab6",
  },
  distances: {
    file: "distances.json",
    bytes: 188,
    digest: "sha256:a1c770dcb15c6d687f969df20b17952619f8aa6fdcbccdd29a30c2d70e59f660",
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
    digest: "sha256:70a2f62c1dddad1e6b0bf8ce9bb1d2e74f377066868d23133f64fb3cb4b966b4",
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
