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
    bytes: 1_099,
    digest: "sha256:a974c73afb2836c09c5274cc74be67afe2ee354ea37647f2bee05732e5bf4a36",
  },
  distances: {
    file: "distances.json",
    bytes: 417,
    digest: "sha256:698e9f45d2648c21dc925fc3f4e772676c71c9490bede8e80e1c24fd0f641949",
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
    bytes: 699,
    digest: "sha256:d107d2146b18006948f78e7590d311a9be77d4d52d2f11a672c70cab85e68a2f",
  },
  coverage: {
    file: "coverage.json",
    bytes: 2_433,
    digest: "sha256:a5fe5c9cfd9b87ee190b4cc7e8e9deffb51b136222490b9928122b9d98e19b38",
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
