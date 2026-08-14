import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

import { readBoundedRegularFile } from "../e2e/bounded-file-read";

export const SYNTHETIC_IDENTIFICATION_MANIFEST_EXPECTATION = {
  sourceHash: "sha256:f76be473d1118d69bb7596dc8ea1b5905571e54ecacced0e210c4e2193779865",
  pagesCropped: 1,
  identityCount: 1,
  rawQuantity: 1,
  identitySetDigest: "sha256:4aa4143460264eb0c486da460a1595693e634b3919f9d0ffcbdfcdb0d8d62080",
  recoveryFailureIdentities: ["p11|q1|x43.074|y486.271"],
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
    bytes: 2_502,
    digest: "sha256:8ffa64e6331992fef91ae70186b8754106cb481bc0ad325146bdf64598b348bd",
  },
  features: {
    file: "features.json",
    bytes: 13_093,
    digest: "sha256:ecd0e263f731fc472275e642f8bba04160491da3f0bb60a33a66467a8f6a8afa",
  },
  match: {
    file: "match.json",
    bytes: 1_099,
    digest: "sha256:0bc30b3007f8a61d9a62736ec711184d786376e768a710697d4028ce96694b6f",
  },
  distances: {
    file: "distances.json",
    bytes: 417,
    digest: "sha256:53e3f3f361b4f3ffa3f27bcdd137b6bcd8967364545da721b5b6501b5dc249ed",
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
    digest: "sha256:6b22b5ccca4bc81ca086696449226cd57de9f5b004fb85ec573ae30ac89ce9b3",
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
