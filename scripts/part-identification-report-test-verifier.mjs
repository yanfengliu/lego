import { __testOnly as coverageTestOnly } from "./booklet-catalog-coverage.mjs";
import { sourceArtReboundTestClosure } from "./booklet-catalog-coverage-test-fixture.mjs";
import { sha256Digest } from "./part-identification-artifacts.mjs";
import { runVerifierCli } from "./part-identification-report-verifier.mjs";
import { verifySyntheticActionLedger } from "./part-identification-report-test-action-ledger.mjs";

const EXPECTATIONS = new Map([
  [
    "sha256:8ffa64e6331992fef91ae70186b8754106cb481bc0ad325146bdf64598b348bd",
    {
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
    },
  ],
  [
    "sha256:9653e0fd88141d34ddc4c932dc8d11728d60b1474b5b7f55606a57be9aebfe71",
    {
      sourceHash: "sha256:67530dc7ae96e0d6524e4e388ce3dfd78202fedf75b09d0f170c9065100f7acd",
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
    },
  ],
]);

async function verifyFixtureCoverage(input) {
  const expectation = EXPECTATIONS.get(sha256Digest(input.manifestBytes));
  if (expectation === undefined) throw new Error("Unknown report-contract test manifest.");
  const testRebound = sourceArtReboundTestClosure(input.manifestBytes, {
    pdfBytes: input.pdfBytes,
    sourceArtReboundArtifact: input.sourceArtReboundArtifact,
  });
  await coverageTestOnly.verifyBookletCatalogCoverageClosure(
    input,
    expectation,
    testRebound.__testOnlySourceArtReboundVerifier,
  );
}

async function verifyFixtureActionLedger(input) {
  const manifestBytes = input.calloutManifest.bytes;
  const expectation = EXPECTATIONS.get(sha256Digest(manifestBytes));
  if (expectation === undefined) throw new Error("Unknown report-contract test manifest.");
  const testRebound = sourceArtReboundTestClosure(manifestBytes, {
    pdfBytes: input.bookletPdf.bytes,
    sourceArtReboundArtifact: input.sourceArtRebound,
  });
  await coverageTestOnly.verifyBookletCatalogCoverageClosure(
    {
      coverageBytes: input.coverage.bytes,
      source: input.coverage.value.identification.source,
      assignment: input.coverage.value.identification.assignment,
      model: input.coverage.value.identification.model,
      featuresArtifact: input.features,
      matchArtifact: input.match,
      distancesArtifact: input.distances,
      elementsArtifact: input.elementResolution,
      cardsArtifact: input.cards,
      cardImagesArtifact: input.cardImages,
      answersArtifact: input.answers,
      traceRoot: input.traceRoot,
      traceArtifacts: null,
      pairJudgedArtifact: input.pairJudged,
      sourceArtReboundArtifact: input.sourceArtRebound,
      pdfBytes: input.bookletPdf.bytes,
      manifestBytes,
      lastStep: input.coverage.value.lastStep,
    },
    expectation,
    testRebound.__testOnlySourceArtReboundVerifier,
  );
  await verifySyntheticActionLedger(input);
}

await runVerifierCli({
  actionLedgerVerifier: verifyFixtureActionLedger,
  coverageClosureVerifier: verifyFixtureCoverage,
});
