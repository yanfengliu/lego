import { __testOnly as coverageTestOnly } from "./booklet-catalog-coverage.mjs";
import { sha256Digest } from "./part-identification-artifacts.mjs";
import { runVerifierCli } from "./part-identification-report-verifier.mjs";
import { verifySyntheticActionLedger } from "./part-identification-report-test-action-ledger.mjs";

const EXPECTATIONS = new Map([
  [
    "sha256:0ea8582b833a5353160aa05b0af6ef41886a9813c8b9c6b3829f533a1689bc73",
    {
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
    },
  ],
  [
    "sha256:5685f93e64d4f73900c193f5f8ce6361cbba8d60a6f0e155e52ca9f8d51244b8",
    {
      sourceHash: "sha256:67530dc7ae96e0d6524e4e388ce3dfd78202fedf75b09d0f170c9065100f7acd",
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
    },
  ],
]);

function verifyFixtureCoverage(input) {
  const expectation = EXPECTATIONS.get(sha256Digest(input.manifestBytes));
  if (expectation === undefined) throw new Error("Unknown report-contract test manifest.");
  coverageTestOnly.verifyBookletCatalogCoverageClosure(input, expectation);
}

await runVerifierCli({
  actionLedgerVerifier: verifySyntheticActionLedger,
  coverageClosureVerifier: verifyFixtureCoverage,
});
